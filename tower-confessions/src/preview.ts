import { createAppHost } from "@dokiworld/app-sdk";
import { createAppsHostExtension } from "@dokiworld/app-sdk/apps";
import { createCharacterHostExtension } from "@dokiworld/app-sdk/character";
import { createDialogueHostExtension } from "@dokiworld/app-sdk/dialogue";
import { createFootprintHostExtension } from "@dokiworld/app-sdk/footprint";
import { createMediaHostExtension, type MediaJob } from "@dokiworld/app-sdk/media";
import { createMemoryHostExtension } from "@dokiworld/app-sdk/memory";
import { createPersonaHostExtension } from "@dokiworld/app-sdk/persona";
import { createSpeechHostExtension } from "@dokiworld/app-sdk/speech";
import { createStorageHostExtension } from "@dokiworld/app-sdk/storage";
import { SDK_ENABLED_MODULES } from "./sdkDiagnostics";

const frame = document.querySelector<HTMLIFrameElement>("#game")!;
frame.addEventListener("load", () => {
  const host = createAppHost({
    appId: "tower-confessions",
    runId: "preview-run",
    target: frame.contentWindow!,
    targetOrigin: window.location.origin,
    expectedOrigin: window.location.origin,
    modules: [...SDK_ENABLED_MODULES],
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
  createAppsHostExtension(host, {
    list: () => ({ apps: [{ id: "preview-app", name: "Preview app", protocolVersion: 2 }] }),
    launch: () => ({ status: "cancelled" }),
  });
  createFootprintHostExtension(host, {
    list: () => ({ footprints: [], cursor: null, hasMore: false }),
  });
  createMemoryHostExtension(host, {
    list: () => ({ memories: [], cursor: null, hasMore: false }),
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
    regenerateDialogue: () => ({ sessionId: 1, generationMode: "preview", sessionStatus: "active", utterances: [] }),
    generateOpening: () => ({ openingLine: "Welcome.", segments: [{ type: "dialogue", text: "Welcome." }] }),
    generateSuggestions: () => ({ suggestions: ["Tell me more."] }),
    generateTagline: () => ({ tagline: "A warm preview companion" }),
  });
  let checkpoint: { contract: string; version: number; data: unknown } | null = null;
  const items = new Map<string, unknown>();
  createStorageHostExtension(host, {
    loadCheckpoint: () => ({ checkpoint }),
    saveCheckpoint: ({ checkpoint: next }) => { checkpoint = next; return { saved: true }; },
    clearCheckpoint: () => { checkpoint = null; return { cleared: true }; },
    listCheckpoints: () => ({ items: [], nextCursor: null }),
    getItem: ({ key }) => ({ item: items.has(key) ? { key, value: items.get(key), updatedAt: new Date().toISOString() } : null }),
    setItem: ({ key, value }) => {
      items.set(key, value);
      return { item: { key, value, updatedAt: new Date().toISOString() } };
    },
    deleteItem: ({ key }) => ({ deleted: items.delete(key) }),
    listItems: () => ({
      items: Array.from(items, ([key, value]) => ({ key, value, updatedAt: new Date().toISOString() })),
      nextCursor: null,
    }),
  });
  const mediaJobs = new Map<string, MediaJob>();
  const createMediaJob = (mediaType: "image" | "video"): MediaJob => {
    const job: MediaJob = { id: `preview-${mediaType}`, mediaType, status: "done", urls: [] };
    mediaJobs.set(job.id, job);
    return job;
  };
  createMediaHostExtension(host, {
    generateImage: () => createMediaJob("image"),
    generateVideo: () => createMediaJob("video"),
    getJob: ({ jobId }) => mediaJobs.get(jobId) ?? { id: jobId, mediaType: "image", status: "failed", error: "Not found" },
    cancelJob: ({ jobId }) => ({ cancelled: mediaJobs.delete(jobId) }),
  });
  createSpeechHostExtension(host, { synthesize: () => ({ audioUrl: "https://example.com/sdk-diagnostic.mp3", cached: false }) });
  host.connect({ onComplete: () => ({ status: "accepted" }) });
});
