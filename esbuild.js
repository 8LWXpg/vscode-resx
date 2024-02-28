const { build, context } = require("esbuild");

const baseConfig = {
  bundle: true,
  minify: true,
  sourcemap: false,
};

const extensionConfig = {
  ...baseConfig,
  platform: "node",
  format: "cjs",
  entryPoints: ["./src/extension.ts", "./src/ResXEditorProvider.ts"],
  outdir: "./out",
  external: ["vscode"],
};

(async () => {
  const args = process.argv.slice(2);
  try {
    await build(extensionConfig);
    console.log("build complete");
  } catch (err) {
    process.stderr.write(err);
    process.exit(1);
  }
})();
