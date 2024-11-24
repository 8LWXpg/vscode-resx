// @ts-check
const esbuild = require('esbuild');
const { isAwaitKeyword } = require('typescript');

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

/**
 * This plugin hooks into the build process to print errors in a format that the problem matcher in Visual Studio Code
 * can understand.
 *
 * @type {import('esbuild').Plugin}
 */
const esbuildProblemMatcherPlugin = {
	name: 'esbuild-problem-matcher',

	setup(build) {
		build.onStart(() => {
			console.log('[watch] build started');
		});
		build.onEnd((result) => {
			result.errors.forEach(({ text, location }) => {
				console.error(`✘ [ERROR] ${text}`);
				console.error(`    ${location?.file}:${location?.line}:${location?.column}:`);
			});
			console.log('[watch] build finished');
		});
	},
};

/** @type {import('esbuild').BuildOptions} */
const extensionConfig = {
	bundle: true,
	minify: production,
	sourcemap: !production,
	platform: 'node',
	format: 'cjs',
	entryPoints: ['./src/extension.ts'],
	outdir: './out',
	external: ['vscode'],
};

/** @type {import('esbuild').BuildOptions} */
const webviewConfig = {
	minify: production,
	entryPoints: ['./editor/webview.js'],
	outdir: './view',
};

/** @type {import('esbuild').BuildOptions} */
const webviewCssConfig = {
	minify: production,
	entryPoints: ['./editor/webview.css', './editor/sortable-base.min.css'],
	outdir: './view',
};

async function main() {
	const ctx = await esbuild.context({
		...extensionConfig,
		plugins: [esbuildProblemMatcherPlugin],
	});

	await esbuild.build(webviewConfig);
	await esbuild.build(webviewCssConfig);
	if (watch) {
		await ctx.watch();
	} else {
		await ctx.rebuild();
		await ctx.dispose();
	}
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
