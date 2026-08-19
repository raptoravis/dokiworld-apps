import { describe, expect, it } from "vitest";
import {
  BLOCK_COUNT,
  blockRisk,
  characterCandidates,
  createTowerState,
  isPullable,
  nextTurn,
  pickCharacterBlock,
  pullBlock,
  recordChallenge,
} from "../src/gameState";

describe("Tower of Hearts state", () => {
  it("only exposes blocks below the top two occupied rows", () => {
    const state = createTowerState(11);

    expect(isPullable(state, 0)).toBe(true);
    expect(isPullable(state, 14)).toBe(true);
    expect(isPullable(state, 15)).toBe(false);
    expect(isPullable(state, BLOCK_COUNT - 1)).toBe(false);
  });

  it("records social challenges without storing the player's private answer", () => {
    const afterTruth = recordChallenge(createTowerState(12), "truth");
    const afterDare = recordChallenge(afterTruth, "dare");

    expect(afterDare).toMatchObject({
      truthsAnswered: 1,
      daresCompleted: 1,
      lastChallenge: "dare",
    });
    expect(afterDare).not.toHaveProperty("answer");
  });

  it("chooses a legal character move and advances turns deterministically", () => {
    const characterTurn = nextTurn(createTowerState(13));
    const selected = pickCharacterBlock(characterTurn);

    expect(characterTurn.turn).toBe("character");
    expect(selected).not.toBeNull();
    expect(isPullable(characterTurn, selected!)).toBe(true);

    const result = pullBlock(characterTurn, selected!);
    expect(result.state.removed).toContain(selected);
    expect(result.state.pulls).toBe(1);
  });

  it("raises risk for center blocks and harder dates", () => {
    const sweet = createTowerState(21, "sweet");
    const heartbeat = createTowerState(21, "heartbeat");

    expect(blockRisk(sweet, 1)).toBeGreaterThan(blockRisk(sweet, 0));
    expect(blockRisk(heartbeat, 0)).toBeGreaterThan(blockRisk(sweet, 0));
  });

  it("returns three ranked, legal options for the character thinking panel", () => {
    const state = nextTurn(createTowerState(31));
    const candidates = characterCandidates(state);

    expect(candidates).toHaveLength(3);
    expect(candidates.every((candidate) => isPullable(state, candidate.blockId))).toBe(true);
    expect(candidates[0]!.preference).toBeGreaterThanOrEqual(candidates[1]!.preference);
  });

  it("unlocks a memory card when completed prompts fill the heart meter", () => {
    let state = createTowerState(41, "heartbeat");
    state = recordChallenge(state, "truth");
    state = recordChallenge(state, "dare");
    state = recordChallenge(state, "truth");

    expect(state.heart).toBe(100);
    expect(state.memoryCardUnlocked).toBe(true);
    expect(state.rememberedCount).toBeGreaterThan(0);
    expect(state).not.toHaveProperty("answer");
  });
});
