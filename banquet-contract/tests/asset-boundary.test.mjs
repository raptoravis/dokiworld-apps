import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("CSS assets stay inside the published World package", () => {
  const stylesheetPath = resolve(root, "world.css");
  const stylesheet = readFileSync(stylesheetPath, "utf8");
  const assetUrls = [...stylesheet.matchAll(/url\(["']?([^"')]+)["']?\)/g)]
    .map((match) => match[1])
    .filter((url) => url.startsWith(".") || url.startsWith("/"));

  for (const assetUrl of assetUrls) {
    assert.doesNotMatch(assetUrl, /^\//, `${assetUrl} must be package-relative`);
    assert.equal(
      existsSync(resolve(dirname(stylesheetPath), assetUrl)),
      true,
      `${assetUrl} must be shipped with the World package`,
    );
  }
});
