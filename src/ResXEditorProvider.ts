import * as vscode from 'vscode';
import { XMLParser, XMLBuilder, validationOptions } from 'fast-xml-parser';

type XmlData = {
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

		function updateTextDocument(document: vscode.TextDocument, obj: XmlData[]) {
			const edit = new vscode.WorkspaceEdit();

			// delete comment if empty
			for (const key in obj) {
				if (obj[key].comment === '') {
					delete obj[key].comment;
				}
			}

			const output: string = builder.build(obj);
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

class ResXParser extends XMLParser {
	constructor() {
		super({
			ignoreAttributes: false,
			attributeNamePrefix: '@_',
			isArray: (tagName) => tagName === 'data',
		});
	}

	public parse(resxData: string) {
		try {
			const data: XmlData[] = super.parse(resxData).data;
			data.forEach((obj) => {
				delete obj['@_xml:space'];
			});
			data.forEach((obj) => {
				if (obj.comment === '') {
					delete obj.comment;
				}
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

	public build(data: XmlData[]) {
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
