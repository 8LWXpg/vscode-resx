import * as assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { after, suite, test } from 'mocha';
import * as vscode from 'vscode';
import { ResXDocument, ResXParser } from '../../ResXEditorProvider';

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

	test('should not parse numeric values as numbers', async () => {
		const resxData = `    <data name="res1" xml:space="preserve">
        <value>res 1 value</value>
    </data>
    <data name="res2" xml:space="preserve">
        <value>11</value>
    </data>
    <data name="res3" xml:space="preserve">
        <value>res 3 value</value>
    </data>`;

		const parser = new ResXParser();
		const parsed = parser.parse(resxData);

		assert.strictEqual(parsed.length, 3);
		assert.strictEqual(parsed[0]['@_name'], 'res1');
		assert.strictEqual(parsed[0].value, 'res 1 value');
		assert.strictEqual(typeof parsed[0].value, 'string');

		assert.strictEqual(parsed[1]['@_name'], 'res2');
		assert.strictEqual(parsed[1].value, '11');
		assert.strictEqual(typeof parsed[1].value, 'string', 'Numeric value should remain as string, not be parsed as number');

		assert.strictEqual(parsed[2]['@_name'], 'res3');
		assert.strictEqual(parsed[2].value, 'res 3 value');
		assert.strictEqual(typeof parsed[2].value, 'string');
	});
});
