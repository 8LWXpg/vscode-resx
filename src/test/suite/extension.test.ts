import * as assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { after, suite, test } from 'mocha';
import * as vscode from 'vscode';
import { ResXDocument } from '../../ResXEditorProvider';

import path = require('node:path');

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
