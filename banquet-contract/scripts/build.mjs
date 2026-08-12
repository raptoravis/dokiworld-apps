import { cp, mkdir, readdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { generateManifest } from "./generate-manifest.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = resolve(root, "dist");
const excluded = new Set(["dist", "node_modules", "scripts", "tests", "package.json", "package-lock.json"]);

await generateManifest();
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const entry of await readdir(root, { withFileTypes: true })) {
  if (excluded.has(entry.name)) continue;
  await cp(resolve(root, entry.name), resolve(output, entry.name), { recursive: true });
}
await build({ entryPoints: [resolve(root, "world.js")], bundle: true, format: "esm", outfile: resolve(output, "world.js") });
console.log(`Built Banquet Contract to ${output}`);
