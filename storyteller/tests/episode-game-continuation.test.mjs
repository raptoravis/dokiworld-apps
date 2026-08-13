import assert from "node:assert/strict";
import test from "node:test";
import {
  interpolateAppResultUtterances,
  interpolateAppResultTemplate,
  resolveConfiguredAppResult,
} from "../src/episode-game-result.js";

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
  const resolution = resolveConfiguredAppResult(completedOutput, "episode-after-game");

  assert.equal(resolution?.nextBeatId, "episode-after-game");
  assert.equal(resolution?.result.normalizedScore, 57);
});

test("dialog and choice copy can interpolate the active app result", () => {
  const result = resolveConfiguredAppResult(completedOutput, null)?.result;

  assert.equal(
    interpolateAppResultTemplate(
      "Score {{app.score}}/{{app.maxScore}}, points {{app.metrics.points}} ({{app.outcome}})",
      result,
    ),
    "Score 57/100, points 340 (completed)",
  );
  assert.equal(
    interpolateAppResultTemplate("Missing {{app.metrics.moves}}", result),
    "Missing {{app.metrics.moves}}",
  );
});

test("a hosted continuation interpolates dialog and choice payloads before rendering", () => {
  const result = resolveConfiguredAppResult(completedOutput, null)?.result;
  const utterances = [{
    speaker: "character",
    segments: [{
      type: "dialogue",
      text: "{{app.outcome}} {{app.score}}/{{app.maxScore}} {{app.metrics.points}}",
    }, {
      type: "choices",
      text: "Choose after {{app.outcome}} with {{app.score}} points",
      options: [{ id: "continue", label: "Keep {{app.metrics.points}} points" }],
    }],
  }];

  assert.deepEqual(interpolateAppResultUtterances(utterances, result), [{
    speaker: "character",
    segments: [{
      type: "dialogue",
      text: "completed 57/100 340",
    }, {
      type: "choices",
      text: "Choose after completed with 57 points",
      options: [{ id: "continue", label: "Keep 340 points" }],
    }],
  }]);
});
