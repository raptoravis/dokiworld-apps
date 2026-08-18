import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("an unfinished match-three run returns its current score during exit settlement", async () => {
  const source = await readFile(new URL("../index.js", import.meta.url), "utf8");

  assert.match(source, /onPrepareExit:\s*\(\)\s*=>\s*\(\{[\s\S]*output:\s*createCurrentResult\("exited"\)/);
  assert.match(source, /normalizedScore:\s*normalizedScore\(state\.score\)/);
  assert.match(source, /points:\s*displayedPoints/);
  assert.match(source, /moves:\s*state\.movesUsed/);
  assert.match(source, /cleared:\s*state\.cleared/);
  assert.match(source, /bestCascade:\s*state\.bestCascade/);
});
