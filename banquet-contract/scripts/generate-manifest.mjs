import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = resolve(root, "manifest.json");
const packagePath = resolve(root, "package.json");
const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const semverPattern = /^\d+\.\d+\.\d+$/;

export async function generateManifest(output = manifestPath) {
  const [manifest, packageJson] = await Promise.all([
    readFile(manifestPath, "utf8").then(JSON.parse),
    readFile(packagePath, "utf8").then(JSON.parse),
  ]);
  if (!idPattern.test(manifest.id) || manifest.id !== "banquet-contract") {
    throw new Error("manifest.json id must be banquet-contract");
  }
  if (!semverPattern.test(packageJson.version)) {
    throw new Error("package.json version must be semver");
  }
  if (manifest.schemaVersion !== 2 || manifest.protocolVersion !== undefined) {
    throw new Error("World manifest must use schemaVersion 2 without top-level protocolVersion");
  }
  if (manifest.runtime?.protocol !== "dokiworld.app" || manifest.runtime?.protocolVersion !== 2) {
    throw new Error("World runtime must use dokiworld.app/2");
  }
  if (
    !Array.isArray(manifest.context?.requiredScopes)
    || !Array.isArray(manifest.context?.optionalScopes)
  ) {
    throw new Error("World manifest context scopes must use the schemaVersion 2 shape");
  }
  manifest.version = packageJson.version;
  manifest.kind = "world";
  await writeFile(output, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return output;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const written = await generateManifest();
  console.log(`Generated ${written}`);
}
