export function createGameOptions(config) {
  return Object.fromEntries(Object.entries({
    configId: config.configId,
    rows: config.rows,
    columns: config.columns ?? config.cols,
    moves: config.moves,
    timeLimit: config.timeLimit,
    targetScore: config.targetScore ?? config.target,
    seed: config.seed,
  }).filter(([, value]) => value !== undefined && value !== null));
}
