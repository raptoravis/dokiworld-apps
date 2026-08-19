import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("../src/style.css", import.meta.url), "utf8");
const source = readFileSync(new URL("../src/main.ts", import.meta.url), "utf8");

function rule(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return css.match(new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]+)\\}`))?.[1] ?? "";
}

describe("isometric tower rendering contract", () => {
  it("does not flatten the 3D scene at the tower root", () => {
    const towerRule = rule(".tower");

    expect(towerRule).toContain("transform-style: preserve-3d");
    expect(towerRule).not.toMatch(/\bfilter\s*:/);
    expect(towerRule).not.toMatch(/\boverflow\s*:\s*(hidden|clip)/);
    expect(towerRule).not.toMatch(/\bopacity\s*:/);
  });

  it("stacks layers on the depth axis without adding a second screen-space lift", () => {
    expect(source).toContain("--z:${row * 22}px");
    expect(source).not.toContain("--lift:");
    expect(rule(".tower-row")).toContain("translateZ(var(--z))");
    expect(rule(".tower-row")).not.toContain("translateY(var(--lift))");
  });

  it("keeps each cuboid's side faces in 3D and visibly matches layer depth", () => {
    const blockRules = css.match(/(?:^|\n)\.tower-block[^\{]*\{[^}]+\}/g)?.join("\n") ?? "";
    const pulse = css.match(/@keyframes blockPulse\s*\{\s*50%\s*\{([^}]*)\}\s*\}/)?.[1] ?? "";

    expect(rule(".tower-block")).toContain("--block-depth:");
    expect(rule(".tower-block::before")).toContain("height: var(--block-depth)");
    expect(rule(".tower-block::before")).toContain("rotateX(90deg)");
    expect(rule(".tower-block::after")).toContain("rotateY(90deg)");
    expect(blockRules).not.toMatch(/\bfilter\s*:/);
    expect(pulse).not.toMatch(/\bfilter\s*:/);
  });
});
