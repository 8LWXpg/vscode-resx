import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { ResXBuilder, ResXParser } from './resx.ts';

/** Mirrors the header slicing done in ResXEditorProvider.ts, without needing a vscode.TextDocument. */
function splitResx(text: string, lineEnding: string) {
	const tagPos = text.lastIndexOf('</resheader>');
	const indent = text.slice(text.lastIndexOf('\n', tagPos) + 1, tagPos);
	const start = tagPos + '</resheader>'.length + lineEnding.length;
	const end = text.lastIndexOf('</root>');
	return { indent, start, end };
}

function roundTrip(resxPath: string) {
	const before = readFileSync(resxPath, 'utf8');
	const lineEnding = before.includes('\r\n') ? '\r\n' : '\n';
	const { indent, start, end } = splitResx(before, lineEnding);

	const parser = new ResXParser();
	const data = parser.parse(before.slice(start, end - lineEnding.length));

	const builder = new ResXBuilder(indent, lineEnding);
	const output = builder.build(data);

	const after = before.slice(0, start) + output + before.slice(end);
	return { data, before, after };
}

test('should not parse numeric values as numbers', () => {
	const parser = new ResXParser();
	const parsed = parser.parse(`    <data name="res1" xml:space="preserve">
        <value>res 1 value</value>
    </data>
    <data name="res2" xml:space="preserve">
        <value>11</value>
    </data>
    <data name="res3" xml:space="preserve">
        <value>res 3 value</value>
    </data>`);

	assert.strictEqual(parsed.length, 3);
	assert.strictEqual(parsed[0]['@_name'], 'res1');
	assert.strictEqual(parsed[0].value, 'res 1 value');
	assert.strictEqual(typeof parsed[0].value, 'string');

	assert.strictEqual(parsed[1]['@_name'], 'res2');
	assert.strictEqual(parsed[1].value, '11');
	assert.strictEqual(
		typeof parsed[1].value,
		'string',
		'Numeric value should remain as string, not be parsed as number',
	);

	assert.strictEqual(parsed[2]['@_name'], 'res3');
	assert.strictEqual(parsed[2].value, 'res 3 value');
	assert.strictEqual(typeof parsed[2].value, 'string');
});

test('should persist the format for a plain resx', () => {
	const resx = path.resolve(import.meta.dirname, '../test-resx/Properties/Resources.resx');
	const { before, after } = roundTrip(resx);
	assert.strictEqual(before, after);
});

test('should round-trip quotes, apostrophes, ampersands, and angle brackets', () => {
	const resx = path.resolve(import.meta.dirname, '../test-resx/SpecialChars.resx');
	const { data, before, after } = roundTrip(resx);

	const quotes = data.find((d) => d['@_name'] === 'quotes_and_apostrophes');
	assert.strictEqual(quotes?.value, `She said "hello" and it's great`);

	const mixed = data.find((d) => d['@_name'] === 'mixed_special_chars');
	assert.strictEqual(mixed?.value, `<a href="#">Tom & Jerry's "show"</a>`);

	assert.strictEqual(before, after);
});
