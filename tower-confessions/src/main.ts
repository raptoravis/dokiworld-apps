import { createAppClient } from "@dokiworld/app-sdk";
import { createCharacterClientExtension } from "@dokiworld/app-sdk/character";
import { createDialogueClientExtension } from "@dokiworld/app-sdk/dialogue";
import { createPersonaClientExtension } from "@dokiworld/app-sdk/persona";
import { createSpeechClientExtension } from "@dokiworld/app-sdk/speech";
import { createStorageClientExtension } from "@dokiworld/app-sdk/storage";
import { createGameResult } from "@dokiworld/app-sdk/game-result";
import {
  BLOCK_COUNT,
  HEART_MAX,
  blockRisk,
  characterCandidates,
  createTowerState,
  isPullable,
  nextTurn,
  pickCharacterBlock,
  pullBlock,
  recordChallenge,
  usePenaltySwap,
  useSkip,
  type ChallengeKind,
  type Difficulty,
  type TowerState,
} from "./gameState";
import "./style.css";

const APP_ID = "tower-confessions";
const CHECKPOINT = "doki.game.tower-confessions-state";
const app = createAppClient({
  appId: APP_ID,
  extensions: ["character", "dialogue", "persona", "progress", "resize", "speech", "storage"],
});
const characterApi = createCharacterClientExtension(app);
const dialogue = createDialogueClientExtension(app, { timeoutMs: 90_000 });
const personaApi = createPersonaClientExtension(app);
const speech = createSpeechClientExtension(app);
const storage = createStorageClientExtension(app);

type Locale = "en" | "zh-cn";
type Screen = "menu" | "game" | "thinking" | "result" | "celebration";
type Overlay = "rules" | "settings" | null;
type Challenge = { kind: ChallengeKind; text: string; owner: "player" | "character" };

const COPY = {
  en: {
    brand: "STACK OF HEARTS",
    title: "Tower\nof Hearts",
    subtitle: "You pull one, I pull one. Every block hides a question—whoever brings the tower down has to answer.",
    start: "Start the date",
    resume: "Continue last game",
    rules: "How to play",
    sound: "Sound",
    settings: "Settings",
    intensity: "Tonight's mood",
    sweet: "Soft",
    tipsy: "Tipsy",
    heartbeat: "Heart-racing",
    menuLine: "Only seven layers tonight. If you cannot answer, there may be a forfeit.",
    player: "You",
    round: "Round {round}",
    yourTurn: "Your turn",
    theirTurn: "{name}'s turn",
    pulled: "{count} pulled",
    steadyHand: "steady hand",
    waiting: "waiting",
    stability: "Tower stability",
    time: "Time",
    heart: "Heart meter",
    penalties: "Forfeit cards",
    penaltyHint: "The one who topples the tower draws one",
    choose: "Hold a lower block and pull it sideways.",
    inspect: "Hover over a block",
    blockLocation: "Layer {layer} · {side}",
    left: "left",
    middle: "middle",
    right: "right",
    pullChance: "Pull safety",
    danger: "Danger",
    safe: "Steady",
    risky: "Risky",
    pullHint: "Hold and drag sideways · release to commit · drag back to cancel",
    trembling: "The tower is trembling. Letting go could bring it down.",
    currentQuestion: "The block you pulled",
    answer: "I'll answer",
    completeDare: "I did it",
    askThem: "Let {name} answer",
    skip: "Change question ×{count}",
    answerPlaceholder: "Type what you want to share…",
    waitingAnswer: "Listening…",
    continue: "Continue",
    thinkingTitle: "{name} is weighing the options",
    thinking: "Thinking {seconds}s",
    weighing: "WHAT THEY ARE WEIGHING",
    thinkingLine: "That lower block looks safe—but you watched it for three seconds. I may choose the one that makes you talk.",
    personality: "Perceptive · playfully adventurous",
    hurry: "Nudge them",
    fell: "The tower fell",
    playerFell: "Your hand trembled. This answer is yours.",
    characterFell: "{name} pushed one risk too far. You win this round.",
    forfeit: "FORFEIT CARD · DRAWN",
    forfeitTruth: "Say the one thing you most want {name} to hear right now. No dodging.",
    accept: "I accept",
    swap: "Swap card ×{count}",
    totalRounds: "Rounds",
    blocks: "Blocks",
    answered: "Answered",
    heartGain: "Heart",
    comfort: "Relax. I'm listening.",
    heartFull: "Heart meter full",
    unlocked: "MEMORY UNLOCKED",
    cardTitle: "The night we stayed up together",
    cardNumber: "Memory card 07 · New",
    memorySummary: "You answered {answered} questions. {remembered} moments felt worth remembering.",
    memoryStored: "The card is tucked into your shared drawer for this visit.",
    replay: "Play again",
    store: "Put it in the drawer",
    celebrationLine: "I lost on purpose… would you believe me?",
    settle: "Finish the date",
    restored: "Your unfinished tower is ready.",
    savedAt: "Saved {time}",
    rulesTitle: "Take turns. Take a chance.",
    rulesBody: "Pull a block from below the top two layers. A safe pull reveals a truth or dare. Answer it to raise the heart meter. If the tower falls, the person who touched it draws a forfeit card.",
    close: "Got it",
    settingsTitle: "Date settings",
    soundOn: "Sound on",
    soundOff: "Sound off",
    privacy: "Your typed answers are never stored in the game checkpoint.",
    error: "Something interrupted the moment. You can try again.",
    resultRejected: "The host could not accept this result. Please try again.",
    companionFallback: "Companion",
    memoryDisclaimer: "This card remains visible for the current visit.",
    prompts: {
      sweet: {
        truth: ["What small thing made you smile today?", "When do you feel most at ease with me?", "What would your perfect quiet evening look like?"],
        dare: ["Give me one sincere compliment.", "Hold my gaze for five seconds.", "Make one tiny promise you can really keep."],
      },
      tipsy: {
        truth: ["Tell me something you have never said out loud.", "When did you first become curious about me?", "What question have you been afraid to ask me?"],
        dare: ["Describe the date you secretly want us to have.", "Say my name the way you would if you missed me.", "Tell me which moment tonight you would replay."],
      },
      heartbeat: {
        truth: ["What do you want from me that you have not dared to ask for?", "Which thought about us keeps returning late at night?", "If I moved closer right now, what would you do?"],
        dare: ["Confess one thing you find irresistible about me.", "Finish this sentence: if tonight did not have to end…", "Tell me exactly how close is too close."],
      },
    },
  },
  "zh-cn": {
    brand: "STACK OF HEARTS",
    title: "心动\n叠叠塔",
    subtitle: "你抽一块，我抽一块。每块木条背面都写着一个问题——谁让塔倒了，谁就得答。",
    start: "开始约会",
    resume: "继续上次牌局",
    rules: "玩法说明",
    sound: "音效",
    settings: "设置",
    intensity: "今晚的尺度",
    sweet: "轻甜",
    tipsy: "微醺",
    heartbeat: "心跳",
    menuLine: "今晚只抽七层，答不上来的可要罚哦。",
    player: "你",
    round: "第 {round} 轮",
    yourTurn: "轮到你",
    theirTurn: "轮到{name}",
    pulled: "已抽 {count} 块",
    steadyHand: "稳手",
    waiting: "等待中",
    stability: "塔的稳定度",
    time: "本局用时",
    heart: "心动值",
    penalties: "惩罚卡",
    penaltyHint: "塔倒者抽一张",
    choose: "按住下方木条，向两侧缓缓抽出。",
    inspect: "悬停木条查看风险",
    blockLocation: "第 {layer} 层 · {side}",
    left: "左侧",
    middle: "中间",
    right: "右侧",
    pullChance: "抽出稳定度",
    danger: "危险",
    safe: "稳定",
    risky: "小心",
    pullHint: "按住木条拖动抽出 · 松开落定 · 拖回原位取消",
    trembling: "塔在颤抖，松手可能就塌了。",
    currentQuestion: "刚抽出的木条",
    answer: "我来答",
    completeDare: "我做到了",
    askThem: "让{name}回答",
    skip: "换一题 ×{count}",
    answerPlaceholder: "写下你愿意分享的回答……",
    waitingAnswer: "她正在听……",
    continue: "继续本局",
    thinkingTitle: "{name}正在权衡",
    thinking: "思考中 {seconds}s",
    weighing: "她在权衡",
    thinkingLine: "底层那块看着最稳，可你刚才盯了它三秒。那我偏不选它——今晚我想听你说话。",
    personality: "会读你的犹豫 · 偏好冒险",
    hurry: "催她一下",
    fell: "塔倒了",
    playerFell: "是你的手抖了一下——这一题，由你回答。",
    characterFell: "{name}冒了一次险。你赢下了这一局。",
    forfeit: "惩罚卡 · 已抽出",
    forfeitTruth: "说出你现在最想对{name}说的一句话，不许绕。",
    accept: "我接受",
    swap: "换一张 ×{count}",
    totalRounds: "总轮次",
    blocks: "抽出木条",
    answered: "答题",
    heartGain: "心动值",
    comfort: "别紧张，我听着呢。",
    heartFull: "心动值满格",
    unlocked: "回忆已解锁",
    cardTitle: "第一次一起熬夜",
    cardNumber: "回忆卡 07 · 新解锁",
    memorySummary: "这一局你们回答了 {answered} 个问题，其中 {remembered} 个瞬间值得记下来。",
    memoryStored: "回忆卡已经收进你们这次约会的抽屉里。",
    replay: "再来一局",
    store: "收进抽屉",
    celebrationLine: "这局……我是故意输的，你信吗。",
    settle: "结束约会",
    restored: "上次未完成的木塔已经准备好了。",
    savedAt: "保存于 {time}",
    rulesTitle: "轮流抽取，也轮流心动",
    rulesBody: "从顶端两层以下抽取木条。安全抽出会翻开一道真心话或大冒险，完成后增加心动值。木塔倒下时，碰倒它的人需要抽取一张惩罚卡。",
    close: "知道了",
    settingsTitle: "约会设置",
    soundOn: "音效已开启",
    soundOff: "音效已关闭",
    privacy: "你输入的私密回答不会写入游戏存档。",
    error: "刚才的心动被打断了，可以再试一次。",
    resultRejected: "宿主未能接收本局结果，请重试。",
    companionFallback: "伴侣",
    memoryDisclaimer: "这张卡会在本次访问期间保留。",
    prompts: {
      sweet: {
        truth: ["今天有什么小事让你偷偷开心了？", "什么时候你在我身边最放松？", "你理想中的安静夜晚是什么样？"],
        dare: ["认真夸我一句，不许开玩笑。", "想象和我对视五秒。", "许下一个足够小、但你真的能做到的承诺。"],
      },
      tipsy: {
        truth: ["说一件你到现在都没告诉过我的小事。", "你第一次对我产生好奇，是什么时候？", "有什么问题，你一直想问却没问出口？"],
        dare: ["描述一次你偷偷期待的约会。", "用想念一个人时的语气叫我的名字。", "说出今晚你最想重来一次的瞬间。"],
      },
      heartbeat: {
        truth: ["你想从我这里得到、却一直不敢开口的是什么？", "深夜里，关于我们的哪个念头总会回来？", "如果我现在靠近一点，你会怎么做？"],
        dare: ["坦白一件你觉得我最让人无法抗拒的地方。", "说完这句话：如果今晚不用结束……", "告诉我，多近才算太近。"],
      },
    },
  },
} as const;

type Copy = (typeof COPY)[Locale];

let locale: Locale = "en";
let copy: Copy = COPY.en;
let character = { id: "", name: "Companion", avatarUrl: "" };
let playerName = "You";
let state: TowerState = createTowerState();
let screen: Screen = "menu";
let overlay: Overlay = null;
let challenge: Challenge | null = null;
let responseText = "";
let errorText = "";
let busy = false;
let restored = false;
let soundEnabled = true;
let inspectedBlock: number | null = null;
let thinkingStartedAt = 0;
let thinkingTimer = 0;
let clockTimer = 0;
let forfeitOffset = 0;

const root = document.querySelector<HTMLDivElement>("#app")!;
const format = (value: string, variables: Record<string, string | number> = {}) => (
  Object.entries({ name: character.name, ...variables })
    .reduce((result, [key, replacement]) => result.replaceAll(`{${key}}`, String(replacement)), value)
);
const escapeHtml = (value: string) => value.replace(/[&<>'"]/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", "\"": "&quot;",
}[char]!));

function promptFor(kind: ChallengeKind, offset = 0): string {
  const prompts = copy.prompts[state.difficulty][kind];
  return prompts[(state.pulls + state.seed + offset) % prompts.length]!;
}

function blockLabel(blockId: number): string {
  const kind = blockId % 4;
  const labels = locale === "zh-cn"
    ? ["第一次心动", "真心话", "如果明天", "不敢说的"]
    : ["first spark", "truth", "if tomorrow", "unsaid"];
  return labels[kind]!;
}

function blockLocation(blockId: number): string {
  const sides = [copy.left, copy.middle, copy.right];
  return format(copy.blockLocation, {
    layer: Math.floor(blockId / 3) + 1,
    side: sides[blockId % 3]!,
  });
}

function elapsed(): string {
  const seconds = Math.max(0, Math.floor((Date.now() - state.startedAt) / 1_000));
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function savedTime(): string {
  return new Intl.DateTimeFormat(locale === "zh-cn" ? "zh-CN" : "en", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(state.savedAt));
}

function playCue(kind: "pull" | "heart" | "fall"): void {
  if (!soundEnabled || typeof AudioContext === "undefined") return;
  try {
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = kind === "fall" ? "sawtooth" : "sine";
    oscillator.frequency.setValueAtTime(kind === "heart" ? 620 : kind === "fall" ? 140 : 310, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(kind === "fall" ? 62 : 470, context.currentTime + .22);
    gain.gain.setValueAtTime(.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(.055, context.currentTime + .02);
    gain.gain.exponentialRampToValueAtTime(.0001, context.currentTime + .28);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + .3);
    window.setTimeout(() => void context.close(), 380);
  } catch {
    // Audio is decorative and never blocks the game.
  }
}

function companionArt(mood: "idle" | "expect" | "think" | "smile" = "idle"): string {
  const initial = escapeHtml(character.name.slice(0, 1) || "♡");
  return `<div class="companion-art mood-${mood}">
    <div class="portrait-halo"></div>
    ${character.avatarUrl
      ? `<img src="${escapeHtml(character.avatarUrl)}" alt="" />`
      : `<div class="portrait-fallback"><span>${initial}</span><i></i></div>`}
    <div class="portrait-shadow"></div>
  </div>`;
}

function towerMarkup(options: { interactive?: boolean; fallen?: boolean; selected?: number } = {}): string {
  const rows = Array.from({ length: BLOCK_COUNT / 3 }, (_, row) => row).reverse();
  return `<div class="tower ${options.fallen ? "is-fallen" : ""}" aria-label="Tower">
    ${rows.map((row) => `<div class="tower-row orientation-${row % 2}" style="--layer:${row};--z:${row * 22}px;--scatter:${(row - 3) * 5}px">
      ${[0, 1, 2].map((column) => {
        const id = row * 3 + column;
        const removed = state.removed.includes(id);
        const pullable = Boolean(options.interactive && state.turn === "player" && !challenge && !busy && isPullable(state, id));
        const risk = pullable ? blockRisk(state, id) : 100;
        return `<button class="tower-block palette-${row % 4} ${removed ? "is-removed" : ""} ${pullable ? "is-pullable" : ""} ${risk >= 50 ? "is-danger" : ""} ${options.selected === id ? "is-selected" : ""}"
          data-block="${id}" ${pullable ? "" : "disabled"} aria-label="${escapeHtml(blockLocation(id))}">
          <span>${escapeHtml(blockLabel(id))}</span><i></i><b></b>
        </button>`;
      }).join("")}
    </div>`).join("")}
  </div>`;
}

function heartMeter(): string {
  return `<div class="heart-meter" aria-label="${copy.heart}: ${state.heart}">
    <span>${copy.heart}</span><i><b style="width:${state.heart}%"></b></i><strong>${state.heart}</strong>
  </div>`;
}

function topBar(): string {
  return `<header class="top-bar">
    <div class="player-pill is-active"><span>${escapeHtml(playerName.slice(0, 1))}</span><div><strong>${escapeHtml(playerName)}</strong><small>${format(copy.pulled, { count: Math.ceil(state.pulls / 2) })} · ${copy.steadyHand}</small></div></div>
    <div class="round-status"><strong>${format(copy.round, { round: Math.max(1, state.pulls + 1) })} · ${state.turn === "player" ? copy.yourTurn : format(copy.theirTurn)}</strong>${heartMeter()}</div>
    <div class="player-pill character-pill"><div><strong>${escapeHtml(character.name)}</strong><small>${format(copy.pulled, { count: Math.floor(state.pulls / 2) })} · ${state.turn === "character" ? copy.steadyHand : copy.waiting}</small></div><span>${escapeHtml(character.name.slice(0, 1))}</span></div>
  </header>`;
}

function utilityRail(): string {
  return `<aside class="utility-rail">
    <article class="glass-card stability-card"><small>${copy.stability}</small><strong>${state.stability}<em>%</em></strong><i><b style="width:${state.stability}%"></b></i><p>${state.stability > 65 ? copy.safe : state.stability > 35 ? copy.risky : copy.danger}</p></article>
    <article class="glass-card time-card"><small>${copy.time}</small><strong data-clock>${elapsed()}</strong></article>
    <article class="penalty-stack"><div class="cards"><i></i><i></i><b>${locale === "zh-cn" ? "惩罚" : "FORFEIT"}</b></div><strong>${copy.penalties} ×${state.penaltiesRemaining}</strong><small>${copy.penaltyHint}</small></article>
  </aside>`;
}

function inspectionPanel(): string {
  const id = inspectedBlock ?? Array.from({ length: BLOCK_COUNT }, (_, blockId) => blockId).find((blockId) => isPullable(state, blockId)) ?? 0;
  const risk = blockRisk(state, id);
  const safety = Math.max(0, 100 - risk);
  return `<article class="inspection-panel ${risk >= 50 ? "is-danger" : ""}" data-inspection>
    <small data-inspection-location>${escapeHtml(blockLocation(id))}</small>
    <strong><span data-inspection-safety>${safety}</span>%</strong>
    <em data-inspection-tone>${risk >= 50 ? copy.danger : risk >= 32 ? copy.risky : copy.safe}</em>
    <i><b data-inspection-bar style="width:${safety}%"></b></i>
    <p>${risk >= 50 ? copy.trembling : copy.pullHint}</p>
  </article>`;
}

function challengeCard(): string {
  if (!challenge) return "";
  const answered = Boolean(responseText);
  const isPlayer = challenge.owner === "player";
  return `<section class="question-card kind-${challenge.kind}">
    <i class="question-accent"></i>
    <div class="question-copy"><small>${copy.currentQuestion} · ${escapeHtml(blockLocation(state.removed.at(-1) ?? 0))}</small><h2>${escapeHtml(challenge.text)}</h2>
      ${responseText ? `<div class="answer-bubble"><p>${escapeHtml(responseText)}</p><button data-action="speak">♪</button></div>` : ""}
      ${busy ? `<p class="listening"><i></i><i></i><i></i>${copy.waitingAnswer}</p>` : ""}
    </div>
    <div class="question-actions">
      ${!answered && isPlayer && challenge.kind === "truth" ? `<textarea data-answer placeholder="${copy.answerPlaceholder}" maxlength="500"></textarea>` : ""}
      ${!answered && isPlayer ? `<button class="primary" data-action="answer" ${busy ? "disabled" : ""}>${challenge.kind === "truth" ? copy.answer : copy.completeDare}</button>
        <button class="soft" data-action="skip" ${state.skipsRemaining <= 0 || busy ? "disabled" : ""}>${format(copy.skip, { count: state.skipsRemaining })}</button>` : ""}
      ${!answered && !isPlayer ? `<div class="waiting-character"><span></span>${copy.waitingAnswer}</div>` : ""}
      ${answered ? `<button class="primary" data-action="continue">${copy.continue}</button>` : ""}
    </div>
  </section>`;
}

function renderMenu(): string {
  return `<main class="app-shell menu-screen">
    <div class="ambient ambient-one"></div><div class="ambient ambient-two"></div>
    <nav class="menu-tools"><button data-action="sound">${soundEnabled ? "♪" : "×"} ${copy.sound}</button><button data-action="settings">⚙ ${copy.settings}</button></nav>
    <section class="menu-copy"><p class="brand">${copy.brand}</p><h1>${copy.title.split("\n").map((line) => `<span>${line}</span>`).join("")}</h1><p class="menu-subtitle">${copy.subtitle}</p>
      <div class="menu-actions"><button class="primary jumbo" data-action="start">${copy.start}</button><button class="soft jumbo" data-action="rules">${copy.rules}</button></div>
      <fieldset class="difficulty"><legend>${copy.intensity}</legend>${(["sweet", "tipsy", "heartbeat"] as Difficulty[]).map((difficulty) => `<button data-difficulty="${difficulty}" class="${state.difficulty === difficulty ? "is-selected" : ""}">${copy[difficulty]}</button>`).join("")}</fieldset>
      ${restored ? `<button class="resume-link" data-action="resume">↻ ${copy.resume} · ${format(copy.savedAt, { time: savedTime() })}</button>` : ""}
    </section>
    <section class="menu-tower">${towerMarkup()}<div class="table-shadow"></div></section>
    <section class="menu-companion">${companionArt("idle")}<div class="speech-bubble">${copy.menuLine}</div></section>
  </main>`;
}

function renderGame(): string {
  return `<main class="app-shell game-screen ${inspectedBlock != null && blockRisk(state, inspectedBlock) >= 50 ? "danger-focus" : ""}">
    ${topBar()}
    <section class="game-stage">
      ${utilityRail()}
      <div class="tower-zone"><div class="tower-aura"></div>${towerMarkup({ interactive: screen === "game", selected: inspectedBlock ?? undefined })}<div class="table-shadow"></div>${screen === "game" && !challenge ? inspectionPanel() : ""}</div>
      <aside class="character-zone">${companionArt(challenge ? "expect" : "idle")}<div class="speech-bubble">${challenge ? (responseText || challenge.text) : copy.choose}</div></aside>
    </section>
    ${challengeCard()}
    ${errorText ? `<p class="toast is-error">${escapeHtml(errorText)}</p>` : ""}
  </main>`;
}

function renderThinking(): string {
  const candidates = characterCandidates(state);
  const seconds = Math.max(0, (Date.now() - thinkingStartedAt) / 1_000).toFixed(1);
  return `<main class="app-shell thinking-screen">
    ${topBar()}
    <section class="thinking-stage"><div class="thinking-character">${companionArt("think")}<div class="speech-bubble">${locale === "zh-cn" ? "唔……让我想想" : "Hmm… let me think"}<span class="dots"><i></i><i></i><i></i></span></div></div>
      <div class="thinking-tower">${towerMarkup({ selected: candidates[0]?.blockId })}<div class="table-shadow"></div></div>
      <article class="thinking-panel"><header><small>${copy.weighing}</small><span><i></i>${format(copy.thinking, { seconds })}</span></header>
        <div class="candidate-list">${candidates.map((candidate) => `<div><p><strong>${escapeHtml(blockLocation(candidate.blockId))} · “${escapeHtml(blockLabel(candidate.blockId))}”</strong><b>${candidate.preference}%</b></p><i><b style="width:${candidate.preference}%"></b></i></div>`).join("")}</div>
        <blockquote>${copy.thinkingLine}</blockquote><footer><span>${copy.personality}</span><button data-action="hurry">${copy.hurry}</button></footer>
      </article>
    </section>
  </main>`;
}

function stats(): string {
  return `<div class="result-stats"><div><small>${copy.totalRounds}</small><strong>${state.pulls}</strong></div><div><small>${copy.blocks}</small><strong>${state.removed.length}</strong></div><div><small>${copy.answered}</small><strong>${state.truthsAnswered + state.daresCompleted}</strong></div><div><small>${copy.heartGain}</small><strong>+${state.heartGained}</strong></div></div>`;
}

function forfeitPrompt(): string {
  const variants = [copy.forfeitTruth, ...copy.prompts.heartbeat.truth];
  return format(variants[forfeitOffset % variants.length]!);
}

function renderResult(): string {
  const playerToppled = state.winner === "character";
  return `<main class="app-shell result-screen">
    <section class="fallen-zone"><p class="brand">ROUND ${state.pulls} · END</p><h1>${copy.fell}</h1><p>${playerToppled ? copy.playerFell : format(copy.characterFell)}</p><div class="fallen-tower">${towerMarkup({ fallen: true })}</div></section>
    <section class="forfeit-card"><header><small>${copy.forfeit}</small><span>${state.penaltiesRemaining} ${locale === "zh-cn" ? "张剩余" : "left"}</span></header><article><small>${locale === "zh-cn" ? "真心话" : "TRUTH"}</small><h2>${forfeitPrompt()}</h2></article>
      <div class="result-actions"><button class="primary" data-action="accept">${playerToppled ? copy.accept : format(copy.askThem)}</button><button class="soft" data-action="swap" ${state.penaltiesRemaining <= 0 ? "disabled" : ""}>${format(copy.swap, { count: state.penaltiesRemaining })}</button></div>${stats()}
    </section>
    <aside class="result-companion">${companionArt("expect")}<div class="speech-bubble">${copy.comfort}</div></aside>
    ${errorText ? `<p class="toast is-error">${escapeHtml(errorText)}</p>` : ""}
  </main>`;
}

function renderCelebration(): string {
  return `<main class="app-shell celebration-screen"><div class="confetti">${Array.from({ length: 18 }, (_, index) => `<i style="--i:${index}"></i>`).join("")}</div>
    <header class="celebration-heading"><p class="brand">HEART FULL</p><h1>${copy.heartFull}</h1>${heartMeter()}</header>
    <section class="memory-layout"><article class="memory-card"><div class="memory-art"><span>♡</span><i></i><b></b></div><div><strong>${copy.cardTitle}</strong><small>${copy.cardNumber}</small></div></article>
      <div class="memory-copy"><p>${format(copy.memorySummary, { answered: state.truthsAnswered + state.daresCompleted, remembered: state.rememberedCount })}<br>${copy.memoryStored}</p><blockquote>${copy.celebrationLine}</blockquote><div><button class="primary jumbo" data-action="replay">${copy.replay}</button><button class="soft jumbo" data-action="store">${copy.store}</button></div><small>${copy.memoryDisclaimer}</small></div>
    </section><aside class="celebration-companion">${companionArt("smile")}</aside>
    ${errorText ? `<p class="toast is-error">${escapeHtml(errorText)}</p>` : ""}
  </main>`;
}

function overlayMarkup(): string {
  if (!overlay) return "";
  return `<div class="modal-scrim"><section class="modal-card" role="dialog" aria-modal="true"><button class="modal-x" data-action="close-overlay">×</button>
    <p class="brand">${overlay === "rules" ? copy.rules : copy.settings}</p><h2>${overlay === "rules" ? copy.rulesTitle : copy.settingsTitle}</h2>
    ${overlay === "rules" ? `<p>${copy.rulesBody}</p><ol><li>${copy.choose}</li><li>${copy.currentQuestion}</li><li>${copy.penaltyHint}</li></ol>` : `<button class="setting-toggle ${soundEnabled ? "is-on" : ""}" data-action="sound"><i></i><span>${soundEnabled ? copy.soundOn : copy.soundOff}</span></button><p>${copy.privacy}</p>`}
    <button class="primary modal-close" data-action="close-overlay">${copy.close}</button></section></div>`;
}

function render(): void {
  document.documentElement.lang = locale === "zh-cn" ? "zh-CN" : "en";
  document.title = locale === "zh-cn" ? "心动叠叠塔" : "Tower of Hearts";
  root.innerHTML = `${screen === "menu" ? renderMenu() : screen === "thinking" ? renderThinking() : screen === "result" ? renderResult() : screen === "celebration" ? renderCelebration() : renderGame()}${overlayMarkup()}`;
  bindEvents();
  app.send("dokiworld-app-resize", { height: Math.max(640, root.scrollHeight) });
}

function bindEvents(): void {
  root.querySelectorAll<HTMLButtonElement>("[data-difficulty]").forEach((button) => button.addEventListener("click", () => {
    state = createTowerState(Date.now() % 1_000_000, button.dataset.difficulty as Difficulty);
    restored = false;
    render();
  }));
  root.querySelector("[data-action='start']")?.addEventListener("click", () => startGame(false));
  root.querySelector("[data-action='resume']")?.addEventListener("click", () => startGame(true));
  root.querySelector("[data-action='rules']")?.addEventListener("click", () => { overlay = "rules"; render(); });
  root.querySelector("[data-action='settings']")?.addEventListener("click", () => { overlay = "settings"; render(); });
  root.querySelectorAll("[data-action='close-overlay']").forEach((button) => button.addEventListener("click", () => { overlay = null; render(); }));
  root.querySelectorAll("[data-action='sound']").forEach((button) => button.addEventListener("click", () => { soundEnabled = !soundEnabled; render(); }));
  root.querySelector("[data-action='answer']")?.addEventListener("click", () => void answerChallenge());
  root.querySelector("[data-action='skip']")?.addEventListener("click", skipChallenge);
  root.querySelector("[data-action='continue']")?.addEventListener("click", continueRound);
  root.querySelector("[data-action='speak']")?.addEventListener("click", () => void speakResponse());
  root.querySelector("[data-action='hurry']")?.addEventListener("click", () => void finishCharacterThinking());
  root.querySelector("[data-action='accept']")?.addEventListener("click", () => void acceptForfeit());
  root.querySelector("[data-action='swap']")?.addEventListener("click", swapForfeit);
  root.querySelector("[data-action='replay']")?.addEventListener("click", replay);
  root.querySelector("[data-action='store']")?.addEventListener("click", () => void settle());
  bindTowerDrag();
}

function bindTowerDrag(): void {
  root.querySelectorAll<HTMLButtonElement>(".tower-block.is-pullable").forEach((button) => {
    button.addEventListener("pointerenter", () => updateInspection(Number(button.dataset.block)));
    button.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") void playerPull(Number(button.dataset.block));
    });
    button.addEventListener("pointerdown", (event) => {
      if (busy || challenge) return;
      const blockId = Number(button.dataset.block);
      const startX = event.clientX;
      inspectedBlock = blockId;
      updateInspection(blockId);
      button.setPointerCapture(event.pointerId);
      button.classList.add("is-dragging");
      const move = (moveEvent: PointerEvent) => {
        const delta = Math.max(-105, Math.min(105, moveEvent.clientX - startX));
        button.style.setProperty("--drag", `${delta}px`);
        root.querySelector(".game-screen")?.classList.toggle("danger-focus", blockRisk(state, blockId) >= 50 && Math.abs(delta) > 24);
      };
      const finish = (upEvent: PointerEvent) => {
        button.removeEventListener("pointermove", move);
        button.removeEventListener("pointerup", finish);
        button.removeEventListener("pointercancel", finish);
        const delta = upEvent.clientX - startX;
        button.classList.remove("is-dragging");
        button.style.removeProperty("--drag");
        if (Math.abs(delta) >= 58) void playerPull(blockId);
        else render();
      };
      button.addEventListener("pointermove", move);
      button.addEventListener("pointerup", finish);
      button.addEventListener("pointercancel", finish);
    });
  });
}

function updateInspection(blockId: number): void {
  inspectedBlock = blockId;
  const risk = blockRisk(state, blockId);
  const safety = Math.max(0, 100 - risk);
  const panel = root.querySelector<HTMLElement>("[data-inspection]");
  if (!panel) return;
  panel.classList.toggle("is-danger", risk >= 50);
  const location = panel.querySelector<HTMLElement>("[data-inspection-location]");
  const safetyText = panel.querySelector<HTMLElement>("[data-inspection-safety]");
  const tone = panel.querySelector<HTMLElement>("[data-inspection-tone]");
  const bar = panel.querySelector<HTMLElement>("[data-inspection-bar]");
  if (location) location.textContent = blockLocation(blockId);
  if (safetyText) safetyText.textContent = String(safety);
  if (tone) tone.textContent = risk >= 50 ? copy.danger : risk >= 32 ? copy.risky : copy.safe;
  if (bar) bar.style.width = `${safety}%`;
}

function startGame(useRestored: boolean): void {
  if (!useRestored) state = createTowerState(Date.now() % 1_000_000, state.difficulty);
  restored = false;
  screen = state.winner ? "result" : "game";
  challenge = null;
  responseText = "";
  errorText = "";
  render();
  void save();
}

async function save(): Promise<void> {
  try {
    state = { ...state, savedAt: Date.now() };
    await storage.saveCheckpoint({ contract: CHECKPOINT, version: 2, data: state });
  } catch {
    // The game remains playable if private checkpoint storage is unavailable.
  }
}

function emitProgress(): void {
  app.send("dokiworld-app-progress", { score: state.heart, maxScore: HEART_MAX });
}

async function playerPull(blockId: number): Promise<void> {
  if (busy || challenge || state.turn !== "player") return;
  busy = true;
  const result = pullBlock(state, blockId);
  state = result.state;
  playCue(result.collapsed ? "fall" : "pull");
  emitProgress();
  await save();
  busy = false;
  inspectedBlock = null;
  if (result.collapsed) {
    screen = "result";
    render();
    return;
  }
  const kind: ChallengeKind = (state.pulls + state.seed) % 2 === 0 ? "truth" : "dare";
  challenge = { kind, text: promptFor(kind), owner: "player" };
  responseText = "";
  render();
}

async function answerChallenge(): Promise<void> {
  if (!challenge || challenge.owner !== "player" || busy) return;
  const input = root.querySelector<HTMLTextAreaElement>("[data-answer]")?.value.trim() ?? "";
  if (challenge.kind === "truth" && !input) return;
  busy = true;
  errorText = "";
  render();
  try {
    const statement = challenge.kind === "truth" ? input : copy.completeDare;
    const response = await dialogue.generateDialogue({
      characterId: character.id,
      playerInput: locale === "zh-cn"
        ? `我们正在玩心动叠叠塔。问题是：${challenge.text}。玩家的回应：${statement}。请用角色身份做一句简短、温柔或俏皮的回应，不要发起新游戏。`
        : `We are playing Tower of Hearts. The prompt was: ${challenge.text} The player's response: ${statement}. React in character in one brief, warm or playful line. Do not launch another game.`,
      inputMode: "speech",
    });
    responseText = response.utterances.flatMap((utterance) => utterance.segments)
      .filter((segment) => ["dialogue", "action", "narration"].includes(segment.type))
      .map((segment) => segment.text).join(" ").trim();
    state = recordChallenge(state, challenge.kind);
    playCue("heart");
    emitProgress();
    await save();
  } catch (error) {
    errorText = error instanceof Error ? error.message : copy.error;
    responseText = locale === "zh-cn" ? "我听见了。这个答案，我会认真收好。" : "I heard you. I'll hold that answer gently.";
    state = recordChallenge(state, challenge.kind);
    await save();
  } finally {
    busy = false;
    render();
  }
}

async function askCharacter(): Promise<void> {
  if (!challenge || challenge.owner !== "character") return;
  busy = true;
  render();
  try {
    const response = await dialogue.generateDialogue({
      characterId: character.id,
      playerInput: locale === "zh-cn"
        ? `我们正在玩心动叠叠塔。你刚抽到的问题是：${challenge.text}。请直接以角色身份回答，用一到两句话，不要发起新游戏。`
        : `We are playing Tower of Hearts. You just pulled this prompt: ${challenge.text} Answer directly in character in one or two sentences. Do not launch another game.`,
      inputMode: "behavior",
    });
    responseText = response.utterances.flatMap((utterance) => utterance.segments)
      .filter((segment) => ["dialogue", "action", "narration"].includes(segment.type))
      .map((segment) => segment.text).join(" ").trim();
  } catch {
    responseText = locale === "zh-cn" ? "这个答案……等塔再高一点，我就告诉你。" : "That answer… let the tower grow a little taller first.";
  } finally {
    state = recordChallenge(state, challenge.kind);
    playCue("heart");
    emitProgress();
    await save();
    busy = false;
    render();
  }
}

function skipChallenge(): void {
  if (!challenge || challenge.owner !== "player" || state.skipsRemaining <= 0) return;
  state = useSkip(state);
  challenge = { ...challenge, text: promptFor(challenge.kind, 1 + state.skipsRemaining) };
  responseText = "";
  void save();
  render();
}

function continueRound(): void {
  challenge = null;
  responseText = "";
  if (state.memoryCardUnlocked) {
    screen = "celebration";
    render();
    return;
  }
  state = nextTurn(state);
  void save();
  if (state.turn === "character") beginCharacterThinking();
  else {
    screen = "game";
    render();
  }
}

function beginCharacterThinking(): void {
  screen = "thinking";
  thinkingStartedAt = Date.now();
  window.clearInterval(thinkingTimer);
  thinkingTimer = window.setInterval(() => {
    if (screen === "thinking") render();
  }, 400);
  render();
  window.setTimeout(() => void finishCharacterThinking(), 2_600);
}

async function finishCharacterThinking(): Promise<void> {
  if (screen !== "thinking" || busy) return;
  busy = true;
  window.clearInterval(thinkingTimer);
  const blockId = pickCharacterBlock(state);
  if (blockId == null) {
    state = { ...state, winner: "draw" };
    screen = "result";
    busy = false;
    render();
    return;
  }
  const result = pullBlock(state, blockId);
  state = result.state;
  playCue(result.collapsed ? "fall" : "pull");
  emitProgress();
  await save();
  busy = false;
  if (result.collapsed) {
    screen = "result";
    render();
    return;
  }
  const kind: ChallengeKind = (state.pulls + state.seed) % 2 === 0 ? "truth" : "dare";
  challenge = { kind, text: promptFor(kind), owner: "character" };
  responseText = "";
  screen = "game";
  render();
  void askCharacter();
}

function swapForfeit(): void {
  if (state.penaltiesRemaining <= 0) return;
  state = usePenaltySwap(state);
  forfeitOffset += 1;
  void save();
  render();
}

async function acceptForfeit(): Promise<void> {
  if (busy) return;
  const characterToppled = state.winner === "player";
  if (characterToppled) {
    busy = true;
    render();
    try {
      await dialogue.generateDialogue({
        characterId: character.id,
        playerInput: locale === "zh-cn"
          ? `你在心动叠叠塔里碰倒了木塔，抽到的惩罚题是：${forfeitPrompt()}。请直接以角色身份回答，一到两句话，不要发起新游戏。`
          : `You toppled the Tower of Hearts. Your forfeit is: ${forfeitPrompt()} Answer directly in character in one or two sentences. Do not launch another game.`,
        inputMode: "behavior",
      });
    } catch {
      // The authoritative game result can still settle if optional dialogue fails.
    }
    busy = false;
  }
  state = recordChallenge(state, "truth");
  state = { ...state, penaltiesRemaining: Math.max(0, state.penaltiesRemaining - 1) };
  playCue("heart");
  emitProgress();
  await save();
  if (state.memoryCardUnlocked) {
    screen = "celebration";
    render();
  } else {
    await settle();
  }
}

function normalizedScore(): number {
  if (state.memoryCardUnlocked) return 100;
  if (state.winner === "player") return Math.max(78, state.heart);
  if (state.winner === "character") return Math.max(38, Math.min(74, state.heart));
  return Math.max(65, state.heart);
}

function output(exited = false) {
  return createGameResult({
    normalizedScore: normalizedScore(),
    outcome: exited ? "exited" : state.winner === "player" ? "win" : state.winner === "character" ? "loss" : "completed",
    metrics: {
      winner: state.winner ?? "draw",
      pulls: state.pulls,
      towerStability: state.stability,
      truthsAnswered: state.truthsAnswered,
      daresCompleted: state.daresCompleted,
      lastChallenge: state.lastChallenge,
      relationshipSignal: state.memoryCardUnlocked ? "memory-unlocked" : state.heart >= 75 ? "trust" : "playful",
      heartGained: state.heartGained,
      memoryCardUnlocked: state.memoryCardUnlocked,
    },
  });
}

async function settle(): Promise<void> {
  if (busy) return;
  busy = true;
  errorText = "";
  render();
  try {
    const acknowledgement = await app.complete(output());
    if (acknowledgement.status === "accepted") {
      await storage.clearCheckpoint().catch(() => undefined);
    } else {
      errorText = copy.resultRejected;
    }
  } catch (error) {
    errorText = error instanceof Error ? error.message : copy.error;
  } finally {
    busy = false;
    render();
  }
}

function replay(): void {
  state = createTowerState(Date.now() % 1_000_000, state.difficulty);
  screen = "game";
  challenge = null;
  responseText = "";
  errorText = "";
  void save();
  render();
}

async function speakResponse(): Promise<void> {
  if (!responseText) return;
  try {
    const result = await speech.synthesize({ text: responseText, characterId: character.id, locale });
    if (result.audioUrl) await new Audio(result.audioUrl).play();
  } catch {
    // Written dialogue remains available if speech is not supported.
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
      name: current.character?.name ?? String(contextCharacter?.displayName ?? copy.companionFallback),
      avatarUrl: current.character?.portraitUrl ?? current.character?.avatarUrl ?? String((contextCharacter?.avatar as Record<string, unknown> | undefined)?.url ?? ""),
    };
    const selected = await personaApi.getSelected(character.id).catch(() => ({ persona: null }));
    playerName = selected.persona?.name ?? copy.player;
    const saved = await storage.loadCheckpoint().catch(() => ({ checkpoint: null }));
    if (saved.checkpoint?.contract === CHECKPOINT && [1, 2].includes(saved.checkpoint.version)) {
      const candidate = saved.checkpoint.data as Partial<TowerState>;
      if (Array.isArray(candidate.removed) && typeof candidate.seed === "number") {
        state = { ...createTowerState(candidate.seed, candidate.difficulty ?? "tipsy"), ...candidate } as TowerState;
        restored = state.pulls > 0 && !state.winner;
      }
    }
    window.clearInterval(clockTimer);
    clockTimer = window.setInterval(() => {
      const clock = root.querySelector<HTMLElement>("[data-clock]");
      if (clock) clock.textContent = elapsed();
    }, 1_000);
    render();
  },
  onPrepareExit: () => ({ isDirty: state.pulls > 0, canSuspend: true, output: output(true) }),
  onExitDecision: () => undefined,
  onError: (error) => {
    errorText = error instanceof Error ? error.message : copy.error;
    render();
  },
});
