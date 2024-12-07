import * as vscode from 'vscode';
import { XMLParser, XMLBuilder } from 'fast-xml-parser';

export let activeEditor: vscode.Uri | null = null;

export type XmlData = {
	'@_name': string;
	value: string;
	comment?: string;
};

export class ResXEditorProvider implements vscode.CustomTextEditorProvider {
	public static register(context: vscode.ExtensionContext): vscode.Disposable {
		const provider = new ResXEditorProvider(context);
		const providerRegistration = vscode.window.registerCustomEditorProvider(ResXEditorProvider.viewType, provider);
		return providerRegistration;
	}

	public static readonly viewType = 'resx.editor';

	constructor(private readonly context: vscode.ExtensionContext) {}

	// Called when custom editor is opened.
	public async resolveCustomTextEditor(
		document: vscode.TextDocument,
		webviewPanel: vscode.WebviewPanel,
	): Promise<void> {
		// Setup initial content for the webview
		webviewPanel.webview.options = {
			localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'view')],
			enableScripts: true,
		};
		webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);

		let start = 0;
		let indent = '';
		let lineEnding = '';
		let updateFromWebview = false;
		let documentVersion = 1;
		let parser: ResXParser;
		let builder: ResXBuilder;

		const text = document.getText();
		// get position of last </resheader> tag
		const tagPos = text.lastIndexOf('</resheader>');
		// get indent
		indent = text.substring(text.lastIndexOf('\n', tagPos) + 1, tagPos);
		start = tagPos + '</resheader>'.length;
		// get line ending
		lineEnding = document.eol === vscode.EndOfLine.LF ? '\n' : '\r\n';
		start += lineEnding.length;

		// parser, builder initialization
		parser = new ResXParser();
		builder = new ResXBuilder(indent, lineEnding);

		function updateWebview(doc: vscode.TextDocument) {
			const text = doc.getText();
			webviewPanel.webview.postMessage({
				type: 'update',
				obj: parser.parse(text.substring(start, text.lastIndexOf('</root>') - lineEnding.length)),
			});
		}

		function updateTextDocument(document: vscode.TextDocument, data: XmlData[]) {
			const edit = new vscode.WorkspaceEdit();
			const output: string = builder.build(data);
			const end = document.getText().lastIndexOf('</root>');

			edit.replace(document.uri, new vscode.Range(document.positionAt(start), document.positionAt(end)), output);

			return vscode.workspace.applyEdit(edit);
		}

		const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument((e) => {
			// Undo and Redo fires another onDidChangeTextDocument event, so we need to check if the version is different
			if (e.document.uri.toString() === document.uri.toString() && e.document.version !== documentVersion) {
				if (updateFromWebview) {
					updateFromWebview = false;
				} else {
					updateWebview(e.document);
				}
				documentVersion = e.document.version;
			}
		});

		webviewPanel.onDidChangeViewState((e) => {
			if (e.webviewPanel.active) {
				activeEditor = document.uri;
				// webview.js does not load in background,
				// so we need to update it incase the document is changed in that period.
				updateWebview(document);
			}
		});

		webviewPanel.onDidDispose(() => {
			changeDocumentSubscription.dispose();
		});

		webviewPanel.webview.onDidReceiveMessage((message) => {
			switch (message.type) {
				case 'update':
					updateFromWebview = true;
					updateTextDocument(document, message.obj);
					return;
			}
		});

		activeEditor = document.uri;
		updateWebview(document);
	}

	private getHtmlForWebview(webview: vscode.Webview): string {
		const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'view', 'webview.js'));
		const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'view', 'webview.css'));
		const sortableStyleUri = webview.asWebviewUri(
			vscode.Uri.joinPath(this.context.extensionUri, 'view', 'sortable-base.min.css'),
		);

		return /* html */ `<!DOCTYPE html>
<html lang="en">

<head>
	<meta charset="UTF-8">

	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<link href="${styleUri}" rel="stylesheet" />
	<link href="${sortableStyleUri}" rel="stylesheet" />
	<title>ResX Editor</title>
</head>

<body>
	<table class="sortable">
		<thead>
			<th class="no-sort"></th>
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
}

export class ResXDocument {
	private constructor(
		private lineEnding: string,
		private text: string,
		private start: number,
		private document: vscode.TextDocument,
		private parser: ResXParser,
		private builder: ResXBuilder,
	) {}

	static async fromUri(uri: vscode.Uri | string): Promise<ResXDocument> {
		if (typeof uri === 'string') {
			uri = vscode.Uri.parse(uri);
		}
		const document = await vscode.workspace.openTextDocument(uri);
		const text = document.getText();
		// get position of last </resheader> tag
		const tagPos = text.lastIndexOf('</resheader>');
		// get indent
		const indent = text.substring(text.lastIndexOf('\n', tagPos) + 1, tagPos);
		let start = tagPos + '</resheader>'.length;
		// get line ending
		const lineEnding = document.eol === vscode.EndOfLine.LF ? '\n' : '\r\n';
		start += lineEnding.length;

		// parser, builder initialization
		const parser = new ResXParser();
		const builder = new ResXBuilder(indent, lineEnding);

		return new ResXDocument(lineEnding, text, start, document, parser, builder);
	}

	public parse(): XmlData[] {
		return this.parser.parse(
			this.text.substring(this.start, this.text.lastIndexOf('</root>') - this.lineEnding.length),
		);
	}

	// update resx with new content
	public build(data: XmlData[]): Thenable<boolean> {
		const edit = new vscode.WorkspaceEdit();
		const output: string = this.builder.build(data);
		const end = this.text.lastIndexOf('</root>');

		edit.replace(
			this.document.uri,
			new vscode.Range(this.document.positionAt(this.start), this.document.positionAt(end)),
			output,
		);
		vscode.workspace.applyEdit(edit);

		return this.document.save();
	}
}

class ResXParser extends XMLParser {
	constructor() {
		super({
			ignoreAttributes: false,
			attributeNamePrefix: '@_',
			isArray: (tagName) => tagName === 'data',
		});
	}

	public parse(resxData: string): XmlData[] {
		try {
			const data: XmlData[] = super.parse(resxData).data;
			data.forEach((obj) => {
				delete obj['@_xml:space'];
			});

			return data;
		} catch (e) {
			// @ts-ignore
			vscode.window.showErrorMessage(e);
			return [];
		}
	}
}

class ResXBuilder extends XMLBuilder {
	private readonly lineEnding: string;

	constructor(indent: string, lineEnding: string) {
		super({
			ignoreAttributes: false,
			attributeNamePrefix: '@_',
			format: true,
			indentBy: indent,
		});
		this.lineEnding = lineEnding;
	}

	public build(data: XmlData[]): string {
		try {
			if (data.length === 0) {
				return '';
			}
			data.forEach((obj) => {
				obj['@_xml:space'] = 'preserve';
			});
			const formatted: string = super.build({ a: { data: data } });
			// replace '\n' it with the document line ending
			// resx supports " and ' without escaping
			return formatted
				.substring('<a>\n'.length, formatted.length - '</a>\n'.length)
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
