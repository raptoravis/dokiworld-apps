import { parseGameResult } from "@dokiworld/app-sdk/game-result";

const APP_RESULT_TEMPLATE = /\{\{app\.(outcome|score|maxScore|metrics\.([A-Za-z0-9_.:-]+))\}\}/g;

export function interpolateAppResultTemplate(value, result) {
  if (typeof value !== "string" || !result || typeof result !== "object") return value;
  return value.replace(APP_RESULT_TEMPLATE, (token, field, metricKey) => {
    let resolved;
    if (field === "outcome") resolved = result.outcome;
    else if (field === "score") resolved = result.normalizedScore;
    else if (field === "maxScore") resolved = 100;
    else resolved = result.metrics?.[metricKey];
    return ["string", "number", "boolean"].includes(typeof resolved)
      ? String(resolved)
      : token;
  });
}

export function resolveConfiguredAppResult(output, nextBeatId = null) {
  const result = parseGameResult(output);
  return result ? { result, nextBeatId } : null;
}
