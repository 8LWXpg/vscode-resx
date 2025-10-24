import { runTests } from '@vscode/test-electron';

import path = require('node:path');

async function main() {
	try {
		const extensionDevelopmentPath = path.join(__dirname, '../../');
		const extensionTestsPath = path.join(__dirname, './suite/index');
		await runTests({ extensionDevelopmentPath, extensionTestsPath });
	} catch (err) {
		console.error(err);
		console.error('Failed to run tests');
		process.exit(1);
	}
}

main();
