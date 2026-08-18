import esbuild from "esbuild";
import process from "process";
import builtins from "builtin-modules";

const banner = "/* Note Calendar - built with esbuild */";

const prod = process.argv[2] === "production";

const context = await esbuild.context({
  banner: {
    js: banner,
  },
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: [
    "obsidian",
    "electron",
    "@codemirror/*",
    "@lezer/*",
    ...builtins,
  ],
  format: "cjs",
  target: "es2018",
  logLevel: "info",
  sourcemap: prod ? false : "inline",
  treeShaking: true,
  outfile: "main.js",
  // 迁移期不压缩，产物 diff 可读；收尾后再决定是否开启 minify
  minify: false,
});

if (prod) {
  await context.rebuild();
  process.exit(0);
} else {
  await context.watch();
}
