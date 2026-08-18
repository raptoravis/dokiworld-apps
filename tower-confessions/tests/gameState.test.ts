import { describe, expect, it } from "vitest";
import {
  createTowerState,
  isPullable,
  nextTurn,
  pickCharacterBlock,
  pullBlock,
  recordChallenge,
} from "../src/gameState";

describe("Tower of Truth state", () => {
  it("only exposes blocks below the top two occupied rows", () => {
    const state = createTowerState(11);

    expect(isPullable(state, 0)).toBe(true);
    expect(isPullable(state, 23)).toBe(true);
    expect(isPullable(state, 24)).toBe(false);
    expect(isPullable(state, 29)).toBe(false);
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
});
