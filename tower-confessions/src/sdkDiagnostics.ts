import type { AppClient } from "@dokiworld/app-sdk";
import { createAppsClientExtension } from "@dokiworld/app-sdk/apps";
import { createCharacterClientExtension } from "@dokiworld/app-sdk/character";
import { createDialogueClientExtension } from "@dokiworld/app-sdk/dialogue";
import { createFootprintClientExtension } from "@dokiworld/app-sdk/footprint";
import { createMediaClientExtension, type MediaJob } from "@dokiworld/app-sdk/media";
import { createMemoryClientExtension } from "@dokiworld/app-sdk/memory";
import { createPersonaClientExtension } from "@dokiworld/app-sdk/persona";
import { RUNTIME_EXTENSIONS, type RuntimeExtension } from "@dokiworld/app-sdk/runtime-extensions";
import { createSpeechClientExtension } from "@dokiworld/app-sdk/speech";
import { createStorageClientExtension } from "@dokiworld/app-sdk/storage";

export const SDK_ENABLED_MODULES = [
  "apps",
  "character",
  "checkpoint",
  "dialogue",
  "footprint",
  "media",
  "memory",
  "persona",
  "progress",
  "resize",
  "resume",
  "speech",
  "storage",
] as const satisfies readonly RuntimeExtension[];

export type DiagnosticApi = {
  id: string;
  name: string;
};

export type DiagnosticModule = {
  name: RuntimeExtension;
  enabled: boolean;
  apis: readonly DiagnosticApi[];
};

export type DiagnosticResult = {
  status: "passed" | "failed";
  detail: string;
  durationMs: number;
};

type DiagnosticContext = {
  appId: string;
  characterId: () => string;
  locale: () => string;
};

const API_NAMES: Partial<Record<RuntimeExtension, readonly string[]>> = {
  apps: ["list", "launch"],
  character: ["getCurrent", "getPublicProfile"],
  dialogue: ["generateDialogue", "regenerateDialogue", "generateOpening", "generateSuggestions", "generateTagline"],
  footprint: ["list"],
  media: ["generateImage", "generateVideo", "getJob", "cancelJob"],
  memory: ["list"],
  persona: ["list", "getSelected", "requestSelection"],
  speech: ["synthesize"],
  storage: ["loadCheckpoint", "saveCheckpoint", "clearCheckpoint", "listCheckpoints", "getItem", "setItem", "deleteItem", "listItems"],
};

const describe = (value: unknown): string => {
  if (value === null) return "OK · null";
  if (Array.isArray(value)) return `OK · ${value.length} item(s)`;
  if (typeof value === "object") {
    const keys = Object.keys(value as Record<string, unknown>);
    return `OK${keys.length ? ` · ${keys.slice(0, 4).join(", ")}` : ""}`;
  }
  return `OK · ${String(value).slice(0, 80)}`;
};

const errorDetail = (error: unknown): string => {
  if (!(error instanceof Error)) return String(error);
  const code = "code" in error ? String((error as Error & { code?: unknown }).code ?? "") : "";
  return [code, error.message].filter(Boolean).join(" · ");
};

export function createSdkDiagnostics(app: AppClient, context: DiagnosticContext) {
  const apps = createAppsClientExtension(app);
  const character = createCharacterClientExtension(app);
  const dialogue = createDialogueClientExtension(app, { timeoutMs: 90_000 });
  const footprint = createFootprintClientExtension(app);
  const media = createMediaClientExtension(app, { timeoutMs: 90_000 });
  const memory = createMemoryClientExtension(app);
  const persona = createPersonaClientExtension(app);
  const speech = createSpeechClientExtension(app);
  const storage = createStorageClientExtension(app);
  const enabled = new Set<RuntimeExtension>(SDK_ENABLED_MODULES);
  const namespace = "sdk-diagnostics";
  const storageKey = "capability-test";
  let latestMediaJob: MediaJob | null = null;

  const requireCharacter = (): string => {
    const characterId = context.characterId();
    if (!characterId) throw new Error("No current character is available");
    return characterId;
  };

  const generateDialogue = () => dialogue.generateDialogue({
    characterId: requireCharacter(),
    playerInput: "SDK diagnostic: reply with OK in one short line.",
    inputMode: "speech",
  });

  const ensureMediaJob = async (): Promise<MediaJob> => {
    if (latestMediaJob) return latestMediaJob;
    latestMediaJob = await media.generateImage({ prompt: "A tiny pink heart icon on a plain background. SDK diagnostic test." });
    return latestMediaJob;
  };

  const runners: Record<string, () => Promise<unknown>> = {
    "apps.list": () => apps.list(),
    "apps.launch": async () => {
      const available = await apps.list();
      const target = available.apps.find((candidate) => candidate.id !== context.appId);
      if (!target) throw new Error("No other launchable app is available");
      return apps.launch({
        appId: target.id,
        input: { contract: "doki.sdk-diagnostics-input", version: 1, data: { source: context.appId } },
      });
    },
    "character.getCurrent": () => character.getCurrent(),
    "character.getPublicProfile": () => character.getPublicProfile(requireCharacter()),
    "dialogue.generateDialogue": generateDialogue,
    "dialogue.regenerateDialogue": async () => {
      const generated = await generateDialogue();
      return dialogue.regenerateDialogue({ characterId: requireCharacter(), sessionId: generated.sessionId });
    },
    "dialogue.generateOpening": () => dialogue.generateOpening({ characterId: requireCharacter() }),
    "dialogue.generateSuggestions": () => dialogue.generateSuggestions({ characterId: requireCharacter() }),
    "dialogue.generateTagline": () => dialogue.generateTagline({ characterId: requireCharacter() }),
    "footprint.list": () => footprint.list({ limit: 1 }),
    "media.generateImage": async () => {
      latestMediaJob = await media.generateImage({ prompt: "A tiny pink heart icon on a plain background. SDK diagnostic test." });
      return latestMediaJob;
    },
    "media.generateVideo": async () => {
      latestMediaJob = await media.generateVideo({ prompt: "A tiny pink heart gently pulses once. SDK diagnostic test." });
      return latestMediaJob;
    },
    "media.getJob": async () => media.getJob((await ensureMediaJob()).id),
    "media.cancelJob": async () => media.cancelJob((await ensureMediaJob()).id),
    "memory.list": () => memory.list({ limit: 1 }),
    "persona.list": () => persona.list(),
    "persona.getSelected": () => persona.getSelected(requireCharacter()),
    "persona.requestSelection": () => persona.requestSelection(requireCharacter()),
    "speech.synthesize": () => speech.synthesize({
      text: "SDK test successful.",
      characterId: requireCharacter(),
      locale: context.locale(),
    }),
    "storage.loadCheckpoint": () => storage.loadCheckpoint({ namespace }),
    "storage.saveCheckpoint": () => storage.saveCheckpoint({
      contract: "doki.sdk-diagnostics",
      version: 1,
      data: { testedAt: new Date().toISOString() },
    }, { namespace }),
    "storage.clearCheckpoint": () => storage.clearCheckpoint({ namespace }),
    "storage.listCheckpoints": () => storage.listCheckpoints({ namespace, limit: 1 }),
    "storage.getItem": () => storage.getItem(storageKey, { namespace }),
    "storage.setItem": () => storage.setItem(storageKey, { testedAt: new Date().toISOString() }, { namespace }),
    "storage.deleteItem": () => storage.deleteItem(storageKey, { namespace }),
    "storage.listItems": () => storage.listItems({ namespace, limit: 1 }),
  };

  const modules: readonly DiagnosticModule[] = RUNTIME_EXTENSIONS.map((name) => ({
    name,
    enabled: enabled.has(name),
    apis: (API_NAMES[name] ?? []).map((api) => ({ id: `${name}.${api}`, name: api })),
  }));

  const run = async (id: string): Promise<DiagnosticResult> => {
    const startedAt = performance.now();
    try {
      if (id.startsWith("module:")) {
        const moduleName = id.slice("module:".length) as RuntimeExtension;
        if (!enabled.has(moduleName)) throw new Error("Module is supported by the SDK but not enabled by this app");
        const firstApi = API_NAMES[moduleName]?.[0];
        if (!firstApi) {
          return { status: "passed", detail: "Transport module is declared by the app", durationMs: Math.round(performance.now() - startedAt) };
        }
        const value = await runners[`${moduleName}.${firstApi}`]?.();
        return { status: "passed", detail: describe(value), durationMs: Math.round(performance.now() - startedAt) };
      }
      const runner = runners[id];
      if (!runner) throw new Error("No standalone client API is exported for this operation");
      const value = await runner();
      return { status: "passed", detail: describe(value), durationMs: Math.round(performance.now() - startedAt) };
    } catch (error) {
      return { status: "failed", detail: errorDetail(error), durationMs: Math.round(performance.now() - startedAt) };
    }
  };

  return { modules, run, character, dialogue, persona, speech, storage };
}
