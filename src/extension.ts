import * as vscode from 'vscode';
import { ResXDocument, ResXEditorProvider, activeEditor, XmlData } from './ResXEditorProvider';

export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(ResXEditorProvider.register(context));
	context.subscriptions.push(
		vscode.commands.registerCommand('code-resx.createEmptyFile', () => createEmptyFile(context)),
	);
	context.subscriptions.push(vscode.commands.registerCommand('code-resx.updateOtherResources', updateOtherResources));
	context.subscriptions.push(vscode.commands.registerCommand('code-resx.syncWithMainResource', syncWithMainResource));
}

async function createEmptyFile(context: vscode.ExtensionContext) {
	const fileUri = await vscode.window.showSaveDialog({
		filters: {
			ResX: ['resx'],
		},
		defaultUri: vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders[0].uri : undefined,
	});
	if (fileUri) {
		await vscode.workspace.fs.copy(vscode.Uri.joinPath(context.extensionUri, 'out', 'empty.resx'), fileUri);
		vscode.commands.executeCommand('vscode.openWith', fileUri, ResXEditorProvider.viewType);
	}
}

async function updateOtherResources(uri?: vscode.Uri) {
	const editorUri = uri || activeEditor;

	if (!editorUri) {
		vscode.window.showWarningMessage('No active editor');
		return;
	}

	const parent = vscode.Uri.joinPath(editorUri, '..');
	const mainFile = await ResXDocument.fromUri(editorUri);
	const otherFiles = await Promise.all(
		(await vscode.workspace.fs.readDirectory(parent))
			.filter(([name, type]) => type === vscode.FileType.File && name.endsWith('.resx'))
			.map(([name, _]) => vscode.Uri.joinPath(parent, name))
			.filter((file) => file.toString() !== editorUri.toString())
			.map((e) => ResXDocument.fromUri(e)),
	);

	syncFiles(mainFile, otherFiles);
}

async function syncWithMainResource(uri?: vscode.Uri) {
	const editorUri = uri || activeEditor;

	if (!editorUri) {
		vscode.window.showWarningMessage('No active editor');
		return;
	}

	const currentFile = await ResXDocument.fromUri(editorUri);
	const main = editorUri.toString().replace(/\.[a-z]{2}(-[A-Z]{2})?\.resx$/, '.resx');
	if (main === editorUri.toString()) {
		vscode.window.showInformationMessage("does not match pattern '.<locale>.resx'");
		return;
	}

	const mainFile = await ResXDocument.fromUri(main);
	syncFiles(mainFile, [currentFile]);
}

function syncFiles(main: ResXDocument, other: ResXDocument[]) {
	const names = main.parse().map((e) => e['@_name']);
	other.forEach((e) => {
		let data = e.parse();
		const otherNames = data.map((e) => e['@_name']);
		const uniqueElements = names.filter((e) => !otherNames.includes(e));
		e.build(
			data.concat(
				uniqueElements.map((e) => {
					return { '@_name': e, value: '' } as XmlData;
				}),
			),
		);
	});
}

export function deactivate() {}
