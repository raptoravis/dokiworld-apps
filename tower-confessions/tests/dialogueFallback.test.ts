import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../src/main.ts", import.meta.url), "utf8");

function answerChallengeSource(): string {
  return source.match(/async function answerChallenge[\s\S]*?(?=\nasync function askCharacter)/)?.[0] ?? "";
}

describe("optional dialogue failure policy", () => {
  it("never exposes an SDK timeout after the player's answer", () => {
    const flow = answerChallengeSource();

    expect(flow).toContain("dialogue.generateDialogue");
    expect(flow).toContain("responseText = locale ===");
    expect(flow).toContain("state = recordChallenge");
    expect(flow).not.toContain("error.message");
    expect(flow).not.toContain("errorText = error");
    expect(source).not.toContain("error.message");
  });
});
