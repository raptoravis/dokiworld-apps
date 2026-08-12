import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createGameOptions } from "../src/game-options.js";

test("nested App iframe cannot escape its sandbox", async () => {
  const html = await readFile(new URL("../src/index.html", import.meta.url), "utf8");
  assert.doesNotMatch(html, /allow-scripts allow-same-origin/);
});

test("nested App host omits absent optional values from its v2 input", () => {
  assert.deepEqual(createGameOptions({ configId: "chapter-game" }), {
    configId: "chapter-game",
  });
});

test("Storyteller only launches platform v2 Apps through the SDK", async () => {
  const source = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /fetch\(["']\/games\/catalog\.json/);
  assert.match(source, /entry\.protocolVersion === 2/);
  assert.match(source, /apps\.launch/);
  assert.doesNotMatch(source, /createLegacyGameInitMessage|parseLegacyAppMessage|createAppHost/);
});

test("Storyteller business code uses the typed SDK extension instead of wire messages", async () => {
  const source = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  assert.match(source, /createEpisodeClientExtension/);
  assert.match(source, /createDialogueClientExtension/);
  assert.match(source, /dialogue\.generateDialogue/);
  assert.match(source, /dialogue\.regenerateDialogue/);
  assert.match(source, /dialogue\.generateSuggestions/);
  assert.doesNotMatch(source, /type:\s*"(?:episode\.reply|chat\.regenerate|chat\.suggest)"/);
  assert.doesNotMatch(source, /dokiworld-app-(?:episode|chat)/);
});

test("Storyteller declares DokiWorld P0 and P1 capabilities", async () => {
  const [manifest, source] = await Promise.all([
    readFile(new URL("../src/manifest.json", import.meta.url), "utf8").then(JSON.parse),
    readFile(new URL("../src/app.js", import.meta.url), "utf8"),
  ]);
  for (const capability of ["media", "speech", "storage", "character", "persona", "apps"]) {
    assert.ok(manifest.runtime.extensions.includes(capability), `missing ${capability}`);
    assert.match(source, new RegExp(`@dokiworld/app-sdk/${capability}`), `missing ${capability} SDK import`);
    assert.match(source, new RegExp(`const ${capability} = create[A-Z][A-Za-z]+ClientExtension\\(dokiworld(?:,\\s*\\{[^}]*\\})?\\)`), `missing ${capability} adapter`);
  }
  for (const call of ["media.generateImage", "media.generateVideo", "speech.synthesize", "storage.loadCheckpoint", "character.getCurrent", "persona.requestSelection", "apps.list", "apps.launch"]) {
    assert.ok(source.includes(call), `missing ${call} use`);
  }
  assert.match(source, /const APP_LAUNCH_TIMEOUT_MS = 60 \* 60 \* 1_000/);
  assert.match(source, /createAppsClientExtension\(dokiworld, \{ timeoutMs: APP_LAUNCH_TIMEOUT_MS \}\)/);
  assert.match(source, /parseGameResult\(launch\.output\)/);
  assert.match(source, /resolveConfiguredGameResult/);
  assert.match(source, /type:\s*"episode\.gameCompleted"/);
  assert.doesNotMatch(source, /type:\s*"episode\.gameResult"/);
  assert.doesNotMatch(source, /type:\s*"chat\.generateMedia"/);
  assert.ok(manifest.contextScopes.optional.includes("character.card"));
  assert.ok(manifest.contextScopes.optional.includes("player_persona"));
});

test("wide Storyteller dialogue does not recreate the empty dark column", async () => {
  const stylesheets = await Promise.all([
    readFile(new URL("../src/styles.css", import.meta.url), "utf8"),
    readFile(new URL("../dist/styles.css", import.meta.url), "utf8"),
  ]);
  stylesheets.forEach((styles) => {
    assert.match(styles, /\.lines\s*\{\s*width:\s*100%;\s*max-width:\s*none;\s*min-height:\s*auto;\s*margin:\s*0;/s);
    assert.match(styles, /\.message-group\.is-ai\s*\{\s*width:\s*100%;/s);
    assert.doesNotMatch(styles, /\.message-group\.is-ai\s*\{[^}]*--chat-message-max/s);
    assert.doesNotMatch(styles, /\.message-group\.is-ai\s*\{[^}]*76cqw/s);
  });
});

test("deployable assets and manifest are versioned together", async () => {
  const [packageJson, manifest, html] = await Promise.all([
    readFile(new URL("../package.json", import.meta.url), "utf8").then(JSON.parse),
    readFile(new URL("../dist/manifest.json", import.meta.url), "utf8").then(JSON.parse),
    readFile(new URL("../dist/index.html", import.meta.url), "utf8"),
  ]);
  assert.equal(manifest.version, packageJson.version);
  assert.equal(manifest.kind, "world");
  assert.match(html, new RegExp(`\\./styles\\.css\\?v=${packageJson.version.replaceAll(".", "\\.")}`));
  assert.match(html, new RegExp(`\\./app\\.js\\?v=${packageJson.version.replaceAll(".", "\\.")}`));
});

test("assistant identity is rendered inside every Storyteller message bubble", async () => {
  const source = await readFile(new URL("../src/app.js", import.meta.url), "utf8");

  assert.equal(source.match(/bubble\.prepend\(heading\);/g)?.length, 4);
  assert.equal(source.match(/content\.append\(bubble\);/g)?.length, 4);
  assert.doesNotMatch(source, /content\.append\(heading, bubble\)/);
});

test("Storyteller conversation uses the full left-aligned transcript width", async () => {
  const styles = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");

  assert.match(styles, /\.lines\s*\{\s*width:\s*100%;\s*max-width:\s*none;[\s\S]*?margin:\s*0;/);
  assert.match(styles, /\.message-group\.is-ai\s*\{\s*width:\s*100%;/);
  assert.match(styles, /\.opening-tagline\s*\{[\s\S]*?margin:\s*0 0 clamp\(24px,\s*2vw,\s*32px\);/);
});

test("Storyteller header spans the panel with tools aligned to its right edge", async () => {
  const styles = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");

  assert.match(styles, /\.topbar\s*\{[\s\S]*?margin-right:\s*0;/);
  assert.match(
    styles,
    /\.topbar\s*\{[\s\S]*?padding:\s*9px 14px 9px 16px;/,
  );
  assert.doesNotMatch(styles, /--host-exit-safe/);
});

test("Storyteller media buttons use the same image and video icons as chat", async () => {
  const html = await readFile(new URL("../src/index.html", import.meta.url), "utf8");

  assert.match(html, /id="generate-image"[\s\S]*?<svg[^>]*class="media-tool-icon"[\s\S]*?<rect[^>]*width="18"[^>]*height="18"[\s\S]*?<circle[^>]*cx="9"[^>]*cy="9"/);
  assert.match(html, /id="generate-video"[\s\S]*?<svg[^>]*class="media-tool-icon"[\s\S]*?<path[^>]*d="m16 13 5\.223 3\.482[^"]*"[\s\S]*?<rect[^>]*x="2"[^>]*y="6"/);
  assert.doesNotMatch(html, /[▧▣]/);
});
