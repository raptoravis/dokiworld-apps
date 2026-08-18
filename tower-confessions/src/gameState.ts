export type Turn = "player" | "character";
export type ChallengeKind = "truth" | "dare";
export type Winner = "player" | "character" | "draw";

export type TowerState = {
  seed: number;
  turn: Turn;
  removed: number[];
  pulls: number;
  stability: number;
  truthsAnswered: number;
  daresCompleted: number;
  lastChallenge: ChallengeKind | "none";
  winner: Winner | null;
};

export const BLOCK_COUNT = 30;
export const ROW_SIZE = 3;

export function createTowerState(seed = Date.now() % 1_000_000): TowerState {
  return {
    seed,
    turn: "player",
    removed: [],
    pulls: 0,
    stability: 100,
    truthsAnswered: 0,
    daresCompleted: 0,
    lastChallenge: "none",
    winner: null,
  };
}

function noise(seed: number): number {
  const value = Math.sin(seed * 12.9898) * 43_758.5453;
  return value - Math.floor(value);
}

export function isPullable(state: TowerState, blockId: number): boolean {
  const row = Math.floor(blockId / ROW_SIZE);
  const topOccupiedRow = Math.max(
    ...Array.from({ length: BLOCK_COUNT }, (_, id) => id)
      .filter((id) => !state.removed.includes(id))
      .map((id) => Math.floor(id / ROW_SIZE)),
  );
  return !state.removed.includes(blockId) && row < topOccupiedRow - 1;
}

export function pullBlock(state: TowerState, blockId: number): {
  state: TowerState;
  collapsed: boolean;
} {
  if (state.winner || !isPullable(state, blockId)) return { state, collapsed: false };
  const row = Math.floor(blockId / ROW_SIZE);
  const rowRemoved = state.removed.filter((id) => Math.floor(id / ROW_SIZE) === row).length;
  const centerPenalty = blockId % ROW_SIZE === 1 ? 7 : 2;
  const risk = Math.min(86, 5 + state.removed.length * 4 + rowRemoved * 13 + centerPenalty);
  const collapsed = noise(state.seed + blockId * 17 + state.pulls * 101) * 100 < risk;
  const stability = Math.max(0, 100 - risk - (collapsed ? 20 : 0));
  return {
    collapsed,
    state: {
      ...state,
      removed: [...state.removed, blockId],
      pulls: state.pulls + 1,
      stability,
      winner: collapsed ? (state.turn === "player" ? "character" : "player") : null,
    },
  };
}

export function nextTurn(state: TowerState): TowerState {
  if (state.winner) return state;
  return { ...state, turn: state.turn === "player" ? "character" : "player" };
}

export function recordChallenge(state: TowerState, kind: ChallengeKind): TowerState {
  return {
    ...state,
    lastChallenge: kind,
    truthsAnswered: state.truthsAnswered + (kind === "truth" ? 1 : 0),
    daresCompleted: state.daresCompleted + (kind === "dare" ? 1 : 0),
  };
}

export function pickCharacterBlock(state: TowerState): number | null {
  const candidates = Array.from({ length: BLOCK_COUNT }, (_, id) => id)
    .filter((id) => isPullable(state, id));
  if (!candidates.length) return null;
  const edges = candidates.filter((id) => id % ROW_SIZE !== 1);
  const pool = edges.length ? edges : candidates;
  return pool[Math.floor(noise(state.seed + state.pulls * 313) * pool.length)] ?? pool[0] ?? null;
}
