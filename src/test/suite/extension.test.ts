import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import * as editor from '../../ResXEditorProvider';

type XmlData = {
  value: string;
  comment?: string;
  '@_name': string;
};

suite('Extension Test Suite', () => {
  let extensionContext: vscode.ExtensionContext;
  suiteSetup(async () => {
    // Trigger extension activation and grab the context as some tests depend on it
    await vscode.extensions.getExtension('8LWXpg.vscode-resx-editor')?.activate();
    extensionContext = (global as any).testExtensionContext;
  });

  test('xml js test', () => {
    const testEditor = new editor.ResXEditorProvider(extensionContext);
    const js2xml = testEditor['js2xml'];
  });
});
