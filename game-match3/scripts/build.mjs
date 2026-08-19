import { createHash } from "node:crypto";
import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { generateManifest } from "./generate-manifest.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = resolve(root, "dist");
const excluded = new Set([
  "dist",
  "node_modules",
  "scripts",
  "tests",
  "package.json",
  "package-lock.json",
]);

await generateManifest();
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const entry of await readdir(root, { withFileTypes: true })) {
  if (excluded.has(entry.name)) continue;
  await cp(resolve(root, entry.name), resolve(output, entry.name), { recursive: true });
}
await build({ entryPoints: [resolve(root, "index.js")], bundle: true, format: "esm", outfile: resolve(output, "index.js") });
const checksumSource = await readFile(resolve(root, "SHA256SUMS.txt"), "utf8");
const checksumPaths = checksumSource.trim().split(/\r?\n/).map((line) => line.slice(66));
const checksums = await Promise.all(checksumPaths.map(async (path) => {
  const digest = createHash("sha256").update(await readFile(resolve(output, path))).digest("hex").toUpperCase();
  return `${digest}  ${path}`;
}));
await writeFile(resolve(output, "SHA256SUMS.txt"), `${checksums.join("\n")}\n`, "utf8");
console.log(`Built Heartline Match to ${output}`);
