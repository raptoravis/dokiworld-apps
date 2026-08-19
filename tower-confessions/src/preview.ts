import { createAppHost } from "@dokiworld/app-sdk";
import { createCharacterHostExtension } from "@dokiworld/app-sdk/character";
import { createDialogueHostExtension } from "@dokiworld/app-sdk/dialogue";
import { createPersonaHostExtension } from "@dokiworld/app-sdk/persona";
import { createSpeechHostExtension } from "@dokiworld/app-sdk/speech";
import { createStorageHostExtension } from "@dokiworld/app-sdk/storage";

const frame = document.querySelector<HTMLIFrameElement>("#game")!;
frame.addEventListener("load", () => {
  const host = createAppHost({
    appId: "tower-confessions",
    runId: "preview-run",
    target: frame.contentWindow!,
    targetOrigin: window.location.origin,
    expectedOrigin: window.location.origin,
    extensions: ["character", "dialogue", "persona", "progress", "resize", "speech", "storage"],
    init: {
      locale: new URLSearchParams(window.location.search).get("locale") === "zh-cn" ? "zh-cn" : "en",
      grantedScopes: ["character.identity", "character.avatar", "character.card", "player_persona"],
      context: {
        schemaVersion: 1,
        character: { id: "aster", displayName: "Aster", card: { description: "Warm, perceptive, and teasing.", tags: ["companion"] } },
      },
      input: { contract: "doki.game.tower-confessions-input", version: 1, data: { options: {} } },
    },
    outputs: [{ contract: "doki.game.result", version: 1 }],
  });
  const character = { id: "aster", name: "Aster", description: "Warm, perceptive, and teasing.", tags: ["companion"] };
  createCharacterHostExtension(host, {
    getCurrent: () => ({ character }),
    getPublicProfile: () => ({ character }),
  });
  createPersonaHostExtension(host, {
    list: () => ({ personas: [{ id: "preview", name: "You" }] }),
    getSelected: () => ({ persona: { id: "preview", name: "You" } }),
    requestSelection: () => ({ persona: { id: "preview", name: "You" } }),
  });
  createDialogueHostExtension(host, {
    generateDialogue: () => ({
      sessionId: 1,
      generationMode: "preview",
      sessionStatus: "active",
      utterances: [{ speaker: "character", speakerName: "Aster", segments: [{ type: "dialogue", text: "Then I'll be honest: I like the moment just before the tower moves—the same way I like the pause before you say what you really mean." }] }],
    }),
  });
  let checkpoint: { contract: string; version: number; data: unknown } | null = null;
  createStorageHostExtension(host, {
    loadCheckpoint: () => ({ checkpoint }),
    saveCheckpoint: ({ checkpoint: next }) => { checkpoint = next; return { saved: true }; },
    clearCheckpoint: () => { checkpoint = null; return { cleared: true }; },
  });
  createSpeechHostExtension(host, { synthesize: () => ({ audioUrl: "", cached: false }) });
  host.connect({ onComplete: () => ({ status: "accepted" }) });
});
