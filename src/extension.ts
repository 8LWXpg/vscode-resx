import * as vscode from 'vscode';
import { generate } from './generator';
import { activeEditor, ResXDocument, ResXEditorProvider, XmlData } from './ResXEditorProvider';

export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(ResXEditorProvider.register(context));
	context.subscriptions.push(vscode.commands.registerCommand('code-resx.createEmptyFile', () => createEmptyFile(context)));
	context.subscriptions.push(vscode.commands.registerCommand('code-resx.updateOtherResources', updateOtherResources));
	context.subscriptions.push(vscode.commands.registerCommand('code-resx.syncWithMainResource', syncWithMainResource));
	context.subscriptions.push(vscode.commands.registerCommand('code-resx.generateResourceDesigner', generateResourceDesigner));
}

async function createEmptyFile(context: vscode.ExtensionContext) {
	const fileUri = await vscode.window.showSaveDialog({
		filters: {
			ResX: ['resx', 'resw'],
		},
		defaultUri: vscode.workspace.workspaceFolders?.at(0)?.uri,
	});
	if (fileUri) {
		await vscode.workspace.fs.copy(vscode.Uri.joinPath(context.extensionUri, 'out', 'empty.txt'), fileUri);
		vscode.commands.executeCommand('vscode.openWith', fileUri, ResXEditorProvider.viewType);
	}
}

async function updateOtherResources(uri?: vscode.Uri) {
	const editorUri = uri || activeEditor;

	if (!editorUri) {
		vscode.window.showWarningMessage('No active editor');
		return;
	}

	const baseName = editorUri.path.slice(editorUri.path.lastIndexOf('/') + 1, editorUri.path.lastIndexOf('.'));
	const nameRegex = new RegExp(`${baseName}\.[a-z]{2}(-[A-Z]{2})?\.res[wx]$`);
	const parent = vscode.Uri.joinPath(editorUri, '..');
	const mainFile = await ResXDocument.fromUri(editorUri);
	const otherFiles = await Promise.all(
		(await vscode.workspace.fs.readDirectory(parent))
			.filter(([name, _]) => nameRegex.test(name))
			.map(([name, _]) => vscode.Uri.joinPath(parent, name))
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
	const main = editorUri.toString().replace(/\.[a-z]{2}(?:-[A-Z]{2})?\.res([wx])$/, '.res$1');
	// Should be blocked from command
	// if (main === editorUri.toString()) {
	// 	vscode.window.showInformationMessage("File name does not match pattern '.<locale>.res[wx]'");
	// 	return;
	// }

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

async function generateResourceDesigner(uri?: vscode.Uri) {
	const editorUri = uri || activeEditor;
	if (!editorUri) {
		vscode.window.showWarningMessage('No active editor');
		return;
	}

	try {
		await generate(editorUri);
	} catch (error) {
		vscode.window.showErrorMessage(`${error}`);
	}
}

export function deactivate() {}
