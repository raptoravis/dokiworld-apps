import { resolveEpisodeGameResult } from "@dokiworld/app-sdk/episode";

export function resolveConfiguredGameResult(output, beat, fallbackNextBeatId = null) {
  return resolveEpisodeGameResult(
    output,
    Array.isArray(beat?.action?.resultRoutes) ? beat.action.resultRoutes : [],
    fallbackNextBeatId,
  );
}
