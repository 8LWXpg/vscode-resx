import * as path from 'path';
import * as vscode from 'vscode';
import { XMLParser, XMLBuilder } from "fast-xml-parser";

type XmlData = {
	value: string;
	comment?: string;
	'@_name': string;
};

export class ResXEditorProvider implements vscode.CustomTextEditorProvider {

	public static register(context: vscode.ExtensionContext): vscode.Disposable {
		const provider = new ResXEditorProvider(context);
		const providerRegistration = vscode.window.registerCustomEditorProvider(ResXEditorProvider.viewType, provider);
		return providerRegistration;
	}

	private static readonly viewType = 'resx.editor';
	private start = 0;
	private indent = '';
	private lineEnding = '';
	private parser?: XMLParser;
	private builder?: XMLBuilder;

	constructor(
		private readonly context: vscode.ExtensionContext
	) { }

	// Called when custom editor is opened.
	public async resolveCustomTextEditor(
		document: vscode.TextDocument,
		webviewPanel: vscode.WebviewPanel,
	): Promise<void> {
		// Setup initial content for the webview
		webviewPanel.webview.options = {
			localResourceRoots: [vscode.Uri.file(path.join(this.context.extensionPath, 'editor'))],
			enableScripts: true,
		};
		webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);

		const text = document.getText();
		// get position of last </resheader> tag
		this.start = text.lastIndexOf('</resheader>') + '</resheader>'.length;
		// get line ending
		this.lineEnding = text.substring(this.start, text.indexOf('\n', this.start) + 1);
		this.start += this.lineEnding.length;
		// get indent
		this.indent = text.substring(this.start, text.indexOf('<', this.start));

		// parser, builder initialization
		const options = {
			ignoreAttributes: false,
			attributeNamePrefix: "@_",
		};
		this.parser = new XMLParser({
			// assume we only receive array of data
			isArray: (tagName) => tagName === 'data',
			...options,
		});
		this.builder = new XMLBuilder({
			format: true,
			indentBy: this.indent,
			...options,
		});

		function updateWebview(self: ResXEditorProvider, doc: vscode.TextDocument) {
			const text = doc.getText();
			webviewPanel.webview.postMessage({
				type: 'update',
				obj: self.xml2js(text.substring(self.start, text.lastIndexOf('</root>') - self.lineEnding.length)),
			});
		}

		const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(e => {
			if (e.document.uri.toString() === document.uri.toString() && (
				e.reason === vscode.TextDocumentChangeReason.Undo ||
				e.reason === vscode.TextDocumentChangeReason.Redo
			)) {
				updateWebview(this, e.document);
			}
		});

		webviewPanel.onDidDispose(() => {
			changeDocumentSubscription.dispose();
		});

		webviewPanel.webview.onDidReceiveMessage(message => {
			switch (message.type) {
				case 'update':
					this.updateTextDocument(document, message.obj);
					return;
			}
		});

		updateWebview(this, document);
	}

	private getHtmlForWebview(webview: vscode.Webview): string {
		const scriptUri = webview.asWebviewUri(vscode.Uri.file(path.join(this.context.extensionPath, 'editor', 'webview.js')));
		const styleUri = webview.asWebviewUri(vscode.Uri.file(path.join(this.context.extensionPath, 'editor', 'webview.css')));

		const sortableStyleUri = webview.asWebviewUri(vscode.Uri.file(path.join(this.context.extensionPath, 'editor', 'sortable-base.min.css')));

		return /* html */`<!DOCTYPE html>
<html lang="en">

<head>
	<meta charset="UTF-8">

	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<link href="${styleUri}" rel="stylesheet" />
	<link href="${sortableStyleUri}" rel="stylesheet" />
	<title>ResX Viewer</title>
</head>

<body>
	<table class="sortable">
		<thead>
			<th onclick="sortName(this)">Name</th>
			<th onclick="sortValue(this)">Value</th>
			<th onclick="sortComment(this)">Comment</th>
			<th class="no-sort"></th>
		</thead>
		<tbody>
		</tbody>
		<tfoot>
			<th colspan=4><button onclick="addContent()">+ Add</button></th>
		</tfoot>
	</table>

	<script src="${scriptUri}"></script>
</body>
</html>`;
	}

	private async updateTextDocument(document: vscode.TextDocument, obj: XmlData[]) {
		const edit = new vscode.WorkspaceEdit();

		// delete comment if empty
		for (const key in obj) {
			if (obj[key].comment === '') {
				delete obj[key].comment;
			}
		}

		const output: string = this.js2xml(obj);
		const end = document.getText().lastIndexOf('</root>') - this.lineEnding.length;

		edit.replace(
			document.uri,
			new vscode.Range(document.positionAt(this.start), document.positionAt(end)),
			output);

		return vscode.workspace.applyEdit(edit);
	}

	private xml2js(xml: string) {
		try {

			const data: XmlData[] = this.parser?.parse(xml).data;
			data.forEach(obj => { delete obj['@_xml:space']; });
			data.forEach(obj => { if (obj.comment === '') { delete obj.comment; } });

			return data;
		} catch (e) {
			// @ts-ignore
			vscode.window.showErrorMessage(e);
			return [];
		}
	}

	private js2xml(data: XmlData[]) {
		try {
			if (data.length === 0) {
				return '';
			}
			data.forEach(obj => { obj['@_xml:space'] = 'preserve'; });
			const formatted: string = this.builder?.build({ a: { data: data } });
			// xml builder uses \n as line ending, replace it with the original line ending
			return formatted
				.substring('<a>\n'.length, formatted.length - '\n</a>\n'.length)
				.replaceAll('&quot;', '"')
				.replaceAll('&apos;', "'")
				.replaceAll('\n', this.lineEnding);
		} catch (e) {
			// @ts-ignore
			vscode.window.showErrorMessage(e);
			return '';
		}
	}
}
