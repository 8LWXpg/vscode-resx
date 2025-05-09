// @ts-check
import * as esbuild from 'esbuild';
import { sassPlugin } from 'esbuild-sass-plugin';

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

/**
 * This plugin hooks into the build process to print errors in a format that the problem matcher in Visual Studio Code can
 * understand.
 *
 * @type {import('esbuild').Plugin}
 */
const esbuildProblemMatcherPlugin = {
	name: 'esbuild-problem-matcher',

	setup(build) {
		const buildType = watch ? 'watch' : 'build';
		build.onStart(() => {
			console.log(`[${buildType}] build started`);
		});
		build.onEnd((result) => {
			result.errors.forEach(({ text, location }) => {
				console.error(`✘ [ERROR] ${text}`);
				console.error(`    ${location?.file}:${location?.line}:${location?.column}:`);
			});
			console.log(`[${buildType}] build finished`);
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
	drop: production ? ['console'] : undefined,
	outdir: './out',
	external: ['vscode'],
	plugins: [esbuildProblemMatcherPlugin],
};

/** @type {import('esbuild').BuildOptions} */
const webviewConfig = {
	minify: production,
	entryPoints: ['./editor/webview.js'],
	drop: production ? ['console'] : undefined,
	outdir: './view',
	plugins: [esbuildProblemMatcherPlugin],
};

/** @type {import('esbuild').BuildOptions} */
const webviewCssConfig = {
	minify: production,
	entryPoints: ['./editor/webview.scss', './editor/sortable-base.min.css'],
	outdir: './view',
	plugins: [sassPlugin(), esbuildProblemMatcherPlugin],
};

async function main() {
	const ctx = await Promise.all([
		esbuild.context(extensionConfig),
		esbuild.context(webviewConfig),
		esbuild.context(webviewCssConfig),
	]);

	if (watch) {
		await Promise.all(ctx.map((c) => c.watch()));
	} else {
		await Promise.all(ctx.map((c) => c.rebuild()));
		await Promise.all(ctx.map((c) => c.dispose()));
	}
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
