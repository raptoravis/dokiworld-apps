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

export function interpolateAppResultUtterances(utterances, result) {
  if (!Array.isArray(utterances)) return utterances;
  return utterances.map((utterance) => {
    if (!utterance || typeof utterance !== "object" || Array.isArray(utterance)) {
      return utterance;
    }
    const segments = Array.isArray(utterance.segments)
      ? utterance.segments.map((segment) => {
          if (!segment || typeof segment !== "object" || Array.isArray(segment)) {
            return segment;
          }
          const options = Array.isArray(segment.options)
            ? segment.options.map((option) => (
                option && typeof option === "object" && !Array.isArray(option)
                  ? {
                      ...option,
                      label: interpolateAppResultTemplate(option.label, result),
                    }
                  : option
              ))
            : segment.options;
          return {
            ...segment,
            text: interpolateAppResultTemplate(segment.text, result),
            ...(Array.isArray(segment.options) ? { options } : {}),
          };
        })
      : utterance.segments;
    return {
      ...utterance,
      ...(Array.isArray(utterance.segments) ? { segments } : {}),
    };
  });
}

export function resolveConfiguredAppResult(output, nextBeatId = null) {
  const result = parseGameResult(output);
  return result ? { result, nextBeatId } : null;
}
