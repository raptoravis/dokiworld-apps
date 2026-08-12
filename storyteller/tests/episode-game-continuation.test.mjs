import assert from "node:assert/strict";
import test from "node:test";
import { resolveConfiguredGameResult } from "../src/episode-game-result.js";

const completedOutput = {
  contract: "doki.game.result",
  version: 1,
  data: {
    outcome: "completed",
    normalizedScore: 57,
    metrics: { points: 340 },
  },
};

test("a configured game falls through to its inferred episode continuation", () => {
  const resolution = resolveConfiguredGameResult(
    completedOutput,
    { action: { type: "game", appId: "game-match3", resultRoutes: [] } },
    "episode-after-game",
  );

  assert.equal(resolution?.nextBeatId, "episode-after-game");
  assert.equal(resolution?.result.normalizedScore, 57);
});

test("an explicit result route takes precedence over the inferred continuation", () => {
  const resolution = resolveConfiguredGameResult(
    completedOutput,
    {
      action: {
        type: "game",
        appId: "game-match3",
        resultRoutes: [{
          id: "completed",
          when: { outcomes: ["completed"] },
          nextBeatId: "episode-result-branch",
        }],
      },
    },
    "episode-after-game",
  );

  assert.equal(resolution?.nextBeatId, "episode-result-branch");
});
