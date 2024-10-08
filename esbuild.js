// @ts-check
const { build } = require('esbuild');

/** @type {import("esbuild").BuildOptions} */
const baseConfig = {
	bundle: true,
	minify: true,
	sourcemap: false,
};

/** @type {import("esbuild").BuildOptions} */
const extensionConfig = {
	...baseConfig,
	platform: 'node',
	format: 'cjs',
	entryPoints: ['./src/extension.ts', './src/ResXEditorProvider.ts'],
	outdir: './out',
	external: ['vscode'],
};

/** @type {import("esbuild").BuildOptions} */
const webviewConfig = {
	minify: true,
	entryPoints: ['./editor/webview.js'],
	outfile: './view/webview.js',
};

/** @type {import("esbuild").BuildOptions} */
const webviewCssConfig = {
	minify: true,
	entryPoints: ['./editor/webview.css', './editor/sortable-base.min.css'],
	outdir: './view',
};

(async () => {
	const args = process.argv.slice(2);
	try {
		await build(extensionConfig);
		await build(webviewConfig);
		await build(webviewCssConfig);
		console.log('build complete');
	} catch (err) {
		process.stderr.write(err);
		process.exit(1);
	}
})();
