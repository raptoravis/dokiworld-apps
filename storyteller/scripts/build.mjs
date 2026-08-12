import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { generateManifest } from "./generate-manifest.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(root, "src");
const output = resolve(root, "dist");
const packageJson = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));

// 按 docs/external-game-provider-integration 规范刷新 manifest，确保 src/manifest.json
// 始终是生成产物，再随 src 一起拷贝进 dist。
generateManifest();

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(source, output, { recursive: true });
const outputIndex = resolve(output, "index.html");
const indexHtml = await readFile(outputIndex, "utf8");
await writeFile(
  outputIndex,
  indexHtml
    .replace('./styles.css', `./styles.css?v=${packageJson.version}`)
    .replace('./app.js', `./app.js?v=${packageJson.version}`),
  "utf8",
);
await build({
  entryPoints: [resolve(source, "app.js")],
  bundle: true,
  format: "esm",
  outfile: resolve(output, "app.js"),
});
console.log(`Built Storyteller to ${output}`);
