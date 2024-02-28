import * as vscode from 'vscode';
import { ResXEditorProvider } from './ResXEditorProvider';

export function activate(context: vscode.ExtensionContext) {

	context.subscriptions.push(ResXEditorProvider.register(context));
}

export function deactivate() { }
