import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const appSource = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
const styles = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");

test("a hosted game result shows an accessible three-dot generation indicator", () => {
  assert.match(appSource, /hostedResultCard = renderGameResult[\s\S]*renderGameResultThinking\(\)/);
  assert.match(appSource, /aria-label", copy\.generatingGameResult/);
  assert.match(appSource, /for \(let index = 0; index < 3; index \+= 1\)/);
  assert.match(styles, /@keyframes game-result-thinking-jump/);
});

test("the generation indicator is removed when result prose starts or completes", () => {
  const partialHandler = appSource.slice(
    appSource.indexOf("function appendHostedResolutionPartial"),
    appSource.indexOf("function removeStreamedResolutionSegments"),
  );
  const completionHandler = appSource.slice(
    appSource.indexOf("function completeHostedConfiguredApp"),
    appSource.indexOf("function requestAction"),
  );
  assert.match(partialHandler, /clearGameResultThinking\(\)/);
  assert.match(completionHandler, /clearGameResultThinking\(\)/);
});
