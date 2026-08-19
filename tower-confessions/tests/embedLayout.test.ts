import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync(new URL("../src/style.css", import.meta.url), "utf8");

describe("embedded layout", () => {
  it("sizes the game shell to the host viewport instead of forcing a scrollable design height", () => {
    expect(styles).toMatch(/html, body, #app \{[^}]*height: 100%[^}]*overflow: hidden;/s);
    expect(styles).toMatch(/\.app-shell \{[^}]*height: 100%[^}]*min-height: 0;/s);
    expect(styles).not.toMatch(/\.app-shell \{[^}]*min-height: (?:clamp\(|7[0-9]{2}px|8[0-9]{2}px)/s);
  });
});
