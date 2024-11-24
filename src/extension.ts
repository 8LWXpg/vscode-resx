import * as vscode from 'vscode';
import { ResXEditorProvider } from './ResXEditorProvider';

export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(ResXEditorProvider.register(context));
	context.subscriptions.push(
		vscode.commands.registerCommand('code-resx.createEmptyFile', () => createEmptyFile(context)),
	);
	context.subscriptions.push(
		vscode.commands.registerCommand('code-resx.updateOtherResources', (uri?: vscode.Uri) =>
			updateOtherResources(context, uri),
		),
	);
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

function updateOtherResources(context: vscode.ExtensionContext, uri?: vscode.Uri) {
	const editorUri = uri || vscode.window.activeTextEditor?.document.uri;

	if (!editorUri) {
		return;
	}
}

export function deactivate() {}
