export type Turn = "player" | "character";
export type ChallengeKind = "truth" | "dare";
export type Winner = "player" | "character" | "draw";
export type Difficulty = "sweet" | "tipsy" | "heartbeat";

export type TowerState = {
  seed: number;
  difficulty: Difficulty;
  turn: Turn;
  removed: number[];
  pulls: number;
  stability: number;
  truthsAnswered: number;
  daresCompleted: number;
  lastChallenge: ChallengeKind | "none";
  winner: Winner | null;
  heart: number;
  heartGained: number;
  skipsRemaining: number;
  penaltiesRemaining: number;
  startedAt: number;
  savedAt: number;
  rememberedCount: number;
  memoryCardUnlocked: boolean;
};

export type CharacterCandidate = {
  blockId: number;
  risk: number;
  preference: number;
};

export const BLOCK_COUNT = 21;
export const ROW_SIZE = 3;
export const HEART_MAX = 100;

const DIFFICULTY_RISK: Record<Difficulty, number> = {
  sweet: -6,
  tipsy: 0,
  heartbeat: 8,
};

const DIFFICULTY_HEART: Record<Difficulty, number> = {
  sweet: 9,
  tipsy: 12,
  heartbeat: 16,
};

export function createTowerState(
  seed = Date.now() % 1_000_000,
  difficulty: Difficulty = "tipsy",
): TowerState {
  const startedAt = Date.now();
  return {
    seed,
    difficulty,
    turn: "player",
    removed: [],
    pulls: 0,
    stability: 100,
    truthsAnswered: 0,
    daresCompleted: 0,
    lastChallenge: "none",
    winner: null,
    heart: 52,
    heartGained: 0,
    skipsRemaining: difficulty === "sweet" ? 2 : 1,
    penaltiesRemaining: 3,
    startedAt,
    savedAt: startedAt,
    rememberedCount: 0,
    memoryCardUnlocked: false,
  };
}

function noise(seed: number): number {
  const value = Math.sin(seed * 12.9898) * 43_758.5453;
  return value - Math.floor(value);
}

export function isPullable(state: TowerState, blockId: number): boolean {
  if (!Number.isInteger(blockId) || blockId < 0 || blockId >= BLOCK_COUNT) return false;
  const row = Math.floor(blockId / ROW_SIZE);
  const occupiedRows = Array.from({ length: BLOCK_COUNT }, (_, id) => id)
    .filter((id) => !state.removed.includes(id))
    .map((id) => Math.floor(id / ROW_SIZE));
  const topOccupiedRow = occupiedRows.length ? Math.max(...occupiedRows) : -1;
  return !state.removed.includes(blockId) && row < topOccupiedRow - 1;
}

export function blockRisk(state: TowerState, blockId: number): number {
  if (!isPullable(state, blockId)) return 100;
  const row = Math.floor(blockId / ROW_SIZE);
  const rowRemoved = state.removed.filter((id) => Math.floor(id / ROW_SIZE) === row).length;
  const centerPenalty = blockId % ROW_SIZE === 1 ? 11 : 3;
  const lowerLayerPenalty = Math.max(0, 4 - row) * 2;
  return Math.max(5, Math.min(
    88,
    8 + state.removed.length * 3 + rowRemoved * 15 + centerPenalty
      + lowerLayerPenalty + DIFFICULTY_RISK[state.difficulty],
  ));
}

export function pullBlock(state: TowerState, blockId: number): {
  state: TowerState;
  collapsed: boolean;
  risk: number;
} {
  if (state.winner || !isPullable(state, blockId)) {
    return { state, collapsed: false, risk: 100 };
  }
  const risk = blockRisk(state, blockId);
  const collapsed = noise(state.seed + blockId * 17 + state.pulls * 101) * 100 < risk;
  const stability = Math.max(0, 100 - risk - state.removed.length * 2 - (collapsed ? 18 : 0));
  return {
    collapsed,
    risk,
    state: {
      ...state,
      removed: [...state.removed, blockId],
      pulls: state.pulls + 1,
      stability,
      winner: collapsed ? (state.turn === "player" ? "character" : "player") : null,
      savedAt: Date.now(),
    },
  };
}

export function nextTurn(state: TowerState): TowerState {
  if (state.winner) return state;
  return {
    ...state,
    turn: state.turn === "player" ? "character" : "player",
    savedAt: Date.now(),
  };
}

export function recordChallenge(state: TowerState, kind: ChallengeKind): TowerState {
  const gain = DIFFICULTY_HEART[state.difficulty] + (kind === "truth" ? 2 : 0);
  const heart = Math.min(HEART_MAX, state.heart + gain);
  const completed = state.truthsAnswered + state.daresCompleted + 1;
  return {
    ...state,
    lastChallenge: kind,
    truthsAnswered: state.truthsAnswered + (kind === "truth" ? 1 : 0),
    daresCompleted: state.daresCompleted + (kind === "dare" ? 1 : 0),
    heart,
    heartGained: state.heartGained + gain,
    rememberedCount: Math.min(3, Math.floor((completed + 1) / 2)),
    memoryCardUnlocked: heart >= HEART_MAX,
    savedAt: Date.now(),
  };
}

export function useSkip(state: TowerState): TowerState {
  if (state.skipsRemaining <= 0) return state;
  return { ...state, skipsRemaining: state.skipsRemaining - 1, savedAt: Date.now() };
}

export function usePenaltySwap(state: TowerState): TowerState {
  if (state.penaltiesRemaining <= 0) return state;
  return { ...state, penaltiesRemaining: state.penaltiesRemaining - 1, savedAt: Date.now() };
}

export function characterCandidates(state: TowerState): CharacterCandidate[] {
  const candidates = Array.from({ length: BLOCK_COUNT }, (_, id) => id)
    .filter((id) => isPullable(state, id))
    .map((blockId) => {
      const risk = blockRisk(state, blockId);
      const personalityBias = blockId % ROW_SIZE === 1 ? 15 : 5;
      const curiosity = Math.round(noise(state.seed + blockId * 47 + state.pulls * 313) * 22);
      return {
        blockId,
        risk,
        preference: Math.max(1, 82 - risk + personalityBias + curiosity),
      };
    })
    .sort((a, b) => b.preference - a.preference || a.blockId - b.blockId)
    .slice(0, 3);

  const total = candidates.reduce((sum, item) => sum + item.preference, 0) || 1;
  return candidates.map((item) => ({
    ...item,
    preference: Math.max(1, Math.round((item.preference / total) * 100)),
  }));
}

export function pickCharacterBlock(state: TowerState): number | null {
  return characterCandidates(state)[0]?.blockId ?? null;
}
