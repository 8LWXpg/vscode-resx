import * as assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { after, suite, test } from 'mocha';
import * as vscode from 'vscode';
import { ResXDocument } from '../../ResXEditorProvider';

import path = require('node:path');

// Exercises the full ResXDocument.build() -> WorkspaceEdit -> document.save() flow, which needs
// a real extension host. Pure parsing/building logic is covered by the faster src/resx.test.ts
// (plain node:test, no vscode/Electron needed).
suite('ResX Builder', () => {
	after(() => {
		vscode.window.showInformationMessage('All tests done!');
	});

	test('should presist the format', async () => {
		const resx = path.resolve(__dirname, '../../../test-resx/Properties/Resources.resx');
		const before = readFileSync(resx, 'utf8');
		const document = await ResXDocument.fromUri(vscode.Uri.file(resx));
		const xml = document.parse();
		assert.ok(await document.build(xml));
		const after = readFileSync(resx, 'utf8');
		assert.strictEqual(before, after);
	});
});
