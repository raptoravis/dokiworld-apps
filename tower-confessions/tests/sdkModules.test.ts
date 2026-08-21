import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { SDK_ENABLED_MODULES } from "../src/sdkDiagnostics";

describe("SDK module declarations", () => {
  it("keeps the runtime manifest aligned with the client", () => {
    const manifest = JSON.parse(
      readFileSync(resolve(process.cwd(), "public/manifest.json"), "utf8"),
    ) as { runtime: { modules: string[] } };

    expect(manifest.runtime.modules).toEqual([...SDK_ENABLED_MODULES]);
    expect(SDK_ENABLED_MODULES).toContain("chat");
    expect(SDK_ENABLED_MODULES).toContain("checkpoint");
    expect(SDK_ENABLED_MODULES).toContain("resume");
  });
});
