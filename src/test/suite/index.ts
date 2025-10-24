import * as fs from 'node:fs';
import * as path from 'node:path';
import * as Mocha from 'mocha';

export function run(): Promise<void> {
	const mocha = new Mocha({
		ui: 'tdd',
		color: true,
		bail: true,
	});

	return new Promise((resolve, reject) => {
		const fileNames = fs.readdirSync(__dirname).filter((fileName) => fileName.endsWith('.test.js'));
		for (const fileName of fileNames) {
			mocha.addFile(path.join(__dirname, fileName));
		}
		try {
			mocha.run((failures) => {
				if (failures > 0) {
					reject(new Error(`${failures} tests failed.`));
				} else {
					resolve();
				}
			});
		} catch (err) {
			reject(err);
		}
	});
}
