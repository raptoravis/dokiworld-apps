import { createAppClient } from "@dokiworld/app-sdk";
import { createCharacterClientExtension } from "@dokiworld/app-sdk/character";
import { createDialogueClientExtension } from "@dokiworld/app-sdk/dialogue";
import { createMediaClientExtension } from "@dokiworld/app-sdk/media";
import { createPersonaClientExtension } from "@dokiworld/app-sdk/persona";
import { createSpeechClientExtension } from "@dokiworld/app-sdk/speech";
import { createStorageClientExtension } from "@dokiworld/app-sdk/storage";
import { createGameResult } from "@dokiworld/app-sdk/game-result";
import {
  BLOCK_COUNT,
  createTowerState,
  isPullable,
  nextTurn,
  pickCharacterBlock,
  pullBlock,
  recordChallenge,
  type ChallengeKind,
  type TowerState,
} from "./gameState";
import "./style.css";

const APP_ID = "tower-confessions";
const CHECKPOINT = "doki.game.tower-confessions-state";
const app = createAppClient({
  appId: APP_ID,
  extensions: ["character", "dialogue", "media", "persona", "progress", "resize", "speech", "storage"],
});
const characterApi = createCharacterClientExtension(app);
const dialogue = createDialogueClientExtension(app, { timeoutMs: 90_000 });
const media = createMediaClientExtension(app, { timeoutMs: 90_000 });
const personaApi = createPersonaClientExtension(app);
const speech = createSpeechClientExtension(app);
const storage = createStorageClientExtension(app);

type Locale = "en" | "zh-cn";
type Copy = (typeof COPY)[Locale];
type Challenge = { kind: ChallengeKind; text: string };

const COPY = {
  en: {
    eyebrow: "A two-person table ritual",
    title: "Tower of Truth",
    subtitle: "Pull carefully. Every block asks for a little honesty.",
    yourTurn: "Your pull",
    theirTurn: "{name}'s pull",
    choose: "Choose a lower block. The glowing pieces are safe to touch—for now.",
    thinking: "{name} is studying the tower…",
    stability: "Tower stability",
    pulls: "Pulls",
    truth: "Truth",
    dare: "Dare",
    askThem: "Ask {name}",
    answerMyself: "I'll answer",
    didIt: "I did it",
    submit: "Share honestly",
    placeholder: "Type your answer…",
    waiting: "Waiting for an answer…",
    continue: "Continue the round",
    collapsed: "The tower fell",
    playerWon: "You held your nerve. {name} brought it down.",
    characterWon: "The tower slipped on your turn. {name} wins this one.",
    draw: "The tower survived. Call it a draw—with secrets exchanged.",
    settle: "Settle this round",
    video: "Generate reaction video",
    generating: "Creating a reaction…",
    videoFailed: "The reaction video could not be created this time.",
    speaking: "Play voice",
    resume: "Your unfinished tower was restored.",
    truthPrompts: [
      "What is something you pretend not to care about, but secretly do?",
      "When did you first feel safe with the person across from you?",
      "What is one question you have been afraid to ask me?",
      "Which memory would you keep if the rest disappeared?",
    ],
    darePrompts: [
      "Give the person across from you one sincere compliment—no jokes.",
      "Hold eye contact for five seconds and say what you notice.",
      "Make a promise small enough that you can truly keep it.",
      "Describe the pose you would strike if you won this round.",
    ],
  },
  "zh-cn": {
    eyebrow: "只属于两个人的桌面仪式",
    title: "心动叠叠乐",
    subtitle: "小心抽取。每一块木头，都想听一点真话。",
    yourTurn: "轮到你抽",
    theirTurn: "轮到{name}抽",
    choose: "从下方选择木块。发光的木块现在还可以抽——只是现在。",
    thinking: "{name}正在观察木塔……",
    stability: "木塔稳定度",
    pulls: "已抽木块",
    truth: "真心话",
    dare: "大冒险",
    askThem: "让{name}回答",
    answerMyself: "我来回答",
    didIt: "我做到了",
    submit: "说出真心话",
    placeholder: "写下你的回答……",
    waiting: "正在等待回答……",
    continue: "继续本局",
    collapsed: "木塔倒下了",
    playerWon: "你稳住了手。{name}让木塔倒在了自己的回合。",
    characterWon: "木塔在你的回合滑落了。{name}赢下这一局。",
    draw: "木塔坚持到了最后。交换过秘密，就算平局吧。",
    settle: "结算本局",
    video: "生成角色反应视频",
    generating: "正在生成角色反应……",
    videoFailed: "这次没能生成反应视频。",
    speaking: "播放语音",
    resume: "已恢复上次未完成的木塔。",
    truthPrompts: [
      "有什么事你表面装作不在乎，其实一直很在意？",
      "你第一次在对面这个人身边感到安心，是什么时候？",
      "有什么问题，你一直想问我却没有问出口？",
      "如果只能留下一个回忆，你会选择哪一个？",
    ],
    darePrompts: [
      "认真夸对面的人一句，不许开玩笑。",
      "想象和对方对视五秒，然后说出你注意到了什么。",
      "许下一个足够小、但你真的能做到的承诺。",
      "描述一下如果赢了这局，你会摆出什么庆祝动作。",
    ],
  },
} as const;

let locale: Locale = "en";
let copy: Copy = COPY.en;
let character = { id: "", name: "Companion", avatarUrl: "" };
let playerName = "You";
let state: TowerState = createTowerState();
let challenge: Challenge | null = null;
let responseText = "";
let busy = false;
let restored = false;
let reactionVideoUrl = "";
let errorText = "";

const root = document.querySelector<HTMLDivElement>("#app")!;
const format = (value: string) => value.replaceAll("{name}", character.name);
const escapeHtml = (value: string) => value.replace(/[&<>'"]/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", "\"": "&quot;",
}[char]!));

function promptFor(kind: ChallengeKind): string {
  const prompts = kind === "truth" ? copy.truthPrompts : copy.darePrompts;
  return prompts[(state.pulls + state.seed) % prompts.length]!;
}

function towerMarkup(): string {
  return Array.from({ length: BLOCK_COUNT }, (_, id) => {
    const removed = state.removed.includes(id);
    const pullable = state.turn === "player" && !challenge && !busy && isPullable(state, id);
    return `<button class="block row-${Math.floor(id / 3) % 2} ${removed ? "is-removed" : ""} ${pullable ? "is-pullable" : ""}"
      data-block="${id}" ${pullable ? "" : "disabled"} aria-label="Block ${id + 1}"><span>${id + 1}</span></button>`;
  }).reverse().join("");
}

function resultText(): string {
  if (state.winner === "player") return format(copy.playerWon);
  if (state.winner === "character") return format(copy.characterWon);
  return copy.draw;
}

function render(): void {
  document.documentElement.lang = locale === "zh-cn" ? "zh-CN" : "en";
  const currentTurn = state.turn === "player" ? copy.yourTurn : format(copy.theirTurn);
  root.innerHTML = `
    <main class="game-shell ${state.winner ? "is-finished" : ""}">
      <header class="hero">
        <div>
          <p class="eyebrow">${copy.eyebrow}</p>
          <h1>${copy.title}</h1>
          <p class="subtitle">${copy.subtitle}</p>
        </div>
        <div class="companion">
          ${character.avatarUrl ? `<img src="${escapeHtml(character.avatarUrl)}" alt="" />` : `<span>${escapeHtml(character.name.slice(0, 1))}</span>`}
          <div><small>${state.turn === "player" ? playerName : character.name}</small><strong>${escapeHtml(currentTurn)}</strong></div>
        </div>
      </header>
      <section class="play-grid">
        <div class="tower-panel">
          <div class="tower ${state.winner ? "has-fallen" : ""}">${towerMarkup()}</div>
          <div class="table-line"></div>
        </div>
        <aside class="ritual-panel">
          <div class="meters">
            <div><span>${copy.stability}</span><strong>${state.stability}%</strong><i><b style="width:${state.stability}%"></b></i></div>
            <div><span>${copy.pulls}</span><strong>${state.pulls}</strong></div>
          </div>
          ${restored ? `<p class="notice">${copy.resume}</p>` : ""}
          ${errorText ? `<p class="notice is-error">${escapeHtml(errorText)}</p>` : ""}
          ${state.winner ? `
            <section class="result-card">
              <p class="eyebrow">${copy.collapsed}</p>
              <h2>${escapeHtml(resultText())}</h2>
              ${reactionVideoUrl ? `<video src="${escapeHtml(reactionVideoUrl)}" controls autoplay playsinline></video>` : ""}
              <div class="actions">
                <button data-action="video" class="secondary" ${busy ? "disabled" : ""}>${busy ? copy.generating : copy.video}</button>
                <button data-action="settle" class="primary" ${busy ? "disabled" : ""}>${copy.settle}</button>
              </div>
            </section>` : challenge ? `
            <section class="challenge-card is-${challenge.kind}">
              <p class="challenge-kind">${challenge.kind === "truth" ? copy.truth : copy.dare}</p>
              <h2>${escapeHtml(challenge.text)}</h2>
              ${responseText ? `<div class="response"><p>${escapeHtml(responseText)}</p><button data-action="speak" class="text-button">${copy.speaking}</button></div>` : ""}
              ${!responseText ? `
                <textarea data-answer placeholder="${copy.placeholder}" ${busy ? "disabled" : ""}></textarea>
                <div class="actions">
                  <button data-action="ask" class="secondary" ${busy ? "disabled" : ""}>${format(copy.askThem)}</button>
                  <button data-action="answer" class="primary" ${busy ? "disabled" : ""}>${challenge.kind === "truth" ? copy.submit : copy.didIt}</button>
                </div>` : `<button data-action="continue" class="primary wide">${copy.continue}</button>`}
              ${busy ? `<p class="waiting">${copy.waiting}</p>` : ""}
            </section>` : `
            <section class="turn-card">
              <p class="eyebrow">${escapeHtml(currentTurn)}</p>
              <h2>${state.turn === "player" ? copy.choose : format(copy.thinking)}</h2>
              <div class="truth-dare-mark"><span>${copy.truth}</span><i></i><span>${copy.dare}</span></div>
            </section>`}
        </aside>
      </section>
    </main>`;
  bindEvents();
  app.send("dokiworld-app-resize", { height: Math.max(640, root.scrollHeight) });
}

function bindEvents(): void {
  root.querySelectorAll<HTMLButtonElement>("[data-block]").forEach((button) => {
    button.addEventListener("click", () => void playerPull(Number(button.dataset.block)));
  });
  root.querySelector<HTMLButtonElement>("[data-action='ask']")?.addEventListener("click", () => void askCharacter());
  root.querySelector<HTMLButtonElement>("[data-action='answer']")?.addEventListener("click", () => void answerChallenge());
  root.querySelector<HTMLButtonElement>("[data-action='continue']")?.addEventListener("click", continueRound);
  root.querySelector<HTMLButtonElement>("[data-action='settle']")?.addEventListener("click", () => void settle());
  root.querySelector<HTMLButtonElement>("[data-action='video']")?.addEventListener("click", () => void generateReactionVideo());
  root.querySelector<HTMLButtonElement>("[data-action='speak']")?.addEventListener("click", () => void speakResponse());
}

async function save(): Promise<void> {
  try {
    await storage.saveCheckpoint({ contract: CHECKPOINT, version: 1, data: state });
  } catch {
    // A game remains playable when private storage is unavailable.
  }
}

function emitProgress(): void {
  app.send("dokiworld-app-progress", { score: Math.min(95, state.pulls * 9), maxScore: 100 });
}

async function playerPull(blockId: number): Promise<void> {
  if (busy || state.turn !== "player") return;
  const result = pullBlock(state, blockId);
  state = result.state;
  emitProgress();
  await save();
  if (result.collapsed) {
    render();
    return;
  }
  const kind: ChallengeKind = (state.pulls + state.seed) % 2 === 0 ? "truth" : "dare";
  challenge = { kind, text: promptFor(kind) };
  responseText = "";
  render();
}

async function askCharacter(): Promise<void> {
  if (!challenge || busy) return;
  busy = true;
  errorText = "";
  render();
  try {
    const label = challenge.kind === "truth" ? copy.truth : copy.dare;
    const response = await dialogue.generateDialogue({
      characterId: character.id,
      playerInput: locale === "zh-cn"
        ? `我们正在玩心动叠叠乐。你抽到了一张${label}：${challenge.text} 请以角色身份直接回答或完成，不要发起新游戏。`
        : `We are playing Tower of Truth. You drew this ${label.toLowerCase()}: ${challenge.text} Respond or perform it directly in character; do not launch another game.`,
      inputMode: "behavior",
    });
    responseText = response.utterances.flatMap((utterance) => utterance.segments)
      .filter((segment) => ["dialogue", "action", "narration"].includes(segment.type))
      .map((segment) => segment.text).join(" ").trim();
    state = recordChallenge(state, challenge.kind);
    await save();
  } catch (error) {
    errorText = error instanceof Error ? error.message : "Dialogue unavailable";
  } finally {
    busy = false;
    render();
  }
}

async function answerChallenge(): Promise<void> {
  if (!challenge || busy) return;
  const input = root.querySelector<HTMLTextAreaElement>("[data-answer]")?.value.trim() ?? "";
  if (challenge.kind === "truth" && !input) return;
  busy = true;
  errorText = "";
  render();
  try {
    const playerStatement = challenge.kind === "truth" ? input : copy.didIt;
    const response = await dialogue.generateDialogue({
      characterId: character.id,
      playerInput: locale === "zh-cn"
        ? `叠叠乐挑战是：${challenge.text}。我的回应：${playerStatement}。请简短、自然地以角色身份回应，不要发起新游戏。`
        : `Our tower challenge was: ${challenge.text} My response: ${playerStatement}. React briefly and naturally in character; do not launch another game.`,
      inputMode: "speech",
    });
    responseText = response.utterances.flatMap((utterance) => utterance.segments)
      .filter((segment) => ["dialogue", "action", "narration"].includes(segment.type))
      .map((segment) => segment.text).join(" ").trim();
    state = recordChallenge(state, challenge.kind);
    await save();
  } catch (error) {
    errorText = error instanceof Error ? error.message : "Dialogue unavailable";
  } finally {
    busy = false;
    render();
  }
}

function continueRound(): void {
  challenge = null;
  responseText = "";
  state = nextTurn(state);
  render();
  if (state.turn === "character") window.setTimeout(() => void characterPull(), 850);
}

async function characterPull(): Promise<void> {
  const blockId = pickCharacterBlock(state);
  if (blockId == null) {
    state = { ...state, winner: "draw" };
    render();
    return;
  }
  const result = pullBlock(state, blockId);
  state = result.state;
  emitProgress();
  await save();
  if (!result.collapsed && state.pulls >= 12) state = { ...state, winner: "draw" };
  if (!state.winner) state = nextTurn(state);
  render();
}

function normalizedScore(): number {
  if (state.winner === "player") return 92;
  if (state.winner === "character") return 38;
  return 70;
}

function output(exited = false) {
  return createGameResult({
    normalizedScore: normalizedScore(),
    outcome: exited
      ? "exited"
      : state.winner === "player" ? "win" : state.winner === "character" ? "loss" : "draw",
    metrics: {
      winner: state.winner ?? "draw",
      pulls: state.pulls,
      towerStability: state.stability,
      truthsAnswered: state.truthsAnswered,
      daresCompleted: state.daresCompleted,
      lastChallenge: state.lastChallenge,
      relationshipSignal: state.truthsAnswered + state.daresCompleted >= 2 ? "trust" : "playful",
    },
  });
}

async function settle(): Promise<void> {
  busy = true;
  render();
  try {
    const acknowledgement = await app.complete(output());
    if (acknowledgement.status === "accepted") {
      await storage.clearCheckpoint().catch(() => undefined);
    } else {
      errorText = locale === "zh-cn" ? "宿主拒绝了本局结果，请重试。" : "The host rejected this result. Please try again.";
    }
  } catch (error) {
    errorText = error instanceof Error ? error.message : "Unable to settle this round";
  } finally {
    busy = false;
    render();
  }
}

async function generateReactionVideo(): Promise<void> {
  if (busy) return;
  busy = true;
  errorText = "";
  render();
  try {
    let job = await media.generateVideo({
      characterId: character.id,
      prompt: `${character.name} reacts immediately after a playful wooden tower game. ${resultText()}`,
      portraitUrl: character.avatarUrl || undefined,
    });
    for (let attempt = 0; attempt < 45 && job.status !== "done" && job.status !== "failed"; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 2_000));
      job = await media.getJob(job.id);
    }
    reactionVideoUrl = job.urls?.[0] ?? "";
    if (!reactionVideoUrl) errorText = copy.videoFailed;
  } catch {
    errorText = copy.videoFailed;
  } finally {
    busy = false;
    render();
  }
}

async function speakResponse(): Promise<void> {
  if (!responseText) return;
  try {
    const result = await speech.synthesize({ text: responseText, characterId: character.id, locale });
    const audio = new Audio(result.audioUrl);
    await audio.play();
  } catch {
    // Voice is an enhancement; the written response remains available.
  }
}

app.connect({
  onInit: async ({ locale: requestedLocale, context }) => {
    locale = requestedLocale.toLowerCase().startsWith("zh") ? "zh-cn" : "en";
    copy = COPY[locale];
    const contextCharacter = context.character as Record<string, unknown> | undefined;
    const current = await characterApi.getCurrent().catch(() => ({ character: null }));
    character = {
      id: current.character?.id ?? String(contextCharacter?.id ?? ""),
      name: current.character?.name ?? String(contextCharacter?.displayName ?? "Companion"),
      avatarUrl: current.character?.avatarUrl ?? String((contextCharacter?.avatar as Record<string, unknown> | undefined)?.url ?? ""),
    };
    const selected = await personaApi.getSelected(character.id).catch(() => ({ persona: null }));
    playerName = selected.persona?.name ?? (locale === "zh-cn" ? "你" : "You");
    const saved = await storage.loadCheckpoint().catch(() => ({ checkpoint: null }));
    if (saved.checkpoint?.contract === CHECKPOINT && saved.checkpoint.version === 1) {
      const candidate = saved.checkpoint.data as Partial<TowerState>;
      if (Array.isArray(candidate.removed) && typeof candidate.seed === "number") {
        state = { ...createTowerState(candidate.seed), ...candidate } as TowerState;
        restored = state.pulls > 0 && !state.winner;
      }
    }
    render();
  },
  onPrepareExit: () => ({ isDirty: state.pulls > 0, canSuspend: true, output: output(true) }),
  onExitDecision: () => undefined,
  onError: (error) => {
    errorText = error instanceof Error ? error.message : "App connection error";
    render();
  },
});
