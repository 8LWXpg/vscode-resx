const { build, context } = require("esbuild");

const baseConfig = {
  bundle: true,
  minify: true,
  sourcemap: false,
};

const extensionConfig = {
  ...baseConfig,
  platform: "node",
  mainFields: ["module", "main"],
  format: "cjs",
  entryPoints: ["./src/extension.ts", "./src/ResXEditorProvider.ts"],
  outdir: "./out",
  external: ["vscode"],
};

const cssConfig = {
  ...baseConfig,
  entryPoints: ['./src/editor/webview.css'],
  outdir: './editor',
};

(async () => {
  const args = process.argv.slice(2);
  try {
    // Build source code
    await build(extensionConfig);
    await build(cssConfig);
    console.log("build complete");
  } catch (err) {
    process.stderr.write(err);
    process.exit(1);
  }
})();
