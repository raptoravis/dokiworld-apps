import { createAppClient } from "@dokiworld/app-sdk";
import {
  createEpisodeClientExtension,
} from "@dokiworld/app-sdk/episode";
import { parseGameResult } from "@dokiworld/app-sdk/game-result";
import { createDialogueClientExtension } from "@dokiworld/app-sdk/dialogue";
import { createMediaClientExtension } from "@dokiworld/app-sdk/media";
import { createSpeechClientExtension } from "@dokiworld/app-sdk/speech";
import { createStorageClientExtension } from "@dokiworld/app-sdk/storage";
import { createCharacterClientExtension } from "@dokiworld/app-sdk/character";
import { createPersonaClientExtension } from "@dokiworld/app-sdk/persona";
import { createAppsClientExtension } from "@dokiworld/app-sdk/apps";
import { createGameOptions } from "./game-options.js";
import {
  interpolateAppResultTemplate,
  resolveConfiguredAppResult,
} from "./episode-game-result.js";

const WORLD_ID = "storyteller";
const APP_LAUNCH_TIMEOUT_MS = 60 * 60 * 1_000;

const COPY = {
  en: {
    waiting: "Preparing your story…",
    yourChoice: "Your choice",
    replyLabel: "Or write your own response",
    send: "Send",
    episodeComplete: "Episode complete",
    continueStory: "The story can continue from here.",
    continueLabel: "What do you do next?",
    continue: "Continue",
    unable: "Unable to continue",
    tryAgain: "The episode paused unexpectedly.",
    retry: "Try again",
    next: "Next",
    interactiveApp: "Interactive app",
    loadingApp: "Opening app…",
    closeApp: "Close app",
    replay: "Replay episode",
    replayVideo: "Replay video",
    replayImage: "View image again",
    closeImage: "Close image",
    kicker: "Interactive episode",
    interactiveStory: "Interactive story",
    appUnavailable: "The configured app is unavailable.",
    appResultInvalid: "The app finished without a valid game result.",
    characterLabel: "Character",
    chatPlaceholder: "Write a message…",
    composerHint: "Enter to send · Shift + Enter for a new line",
    suggest: "Suggest a reply",
    tts: "Read dialogue aloud",
    textSize: "Change text size",
    skin: "Change appearance",
    regenerate: "Regenerate",
    you: "You",
    thinking: "Thinking…",
    hidePortrait: "Hide portrait",
    showPortrait: "Show portrait",
    characterProfile: "Character profile",
    personality: "Personality",
    about: "About",
    hotComments: "Hot comments",
    commentsEmpty: "Comments will appear here when community replies are available.",
    jumpLatest: "Jump to latest",
    conversationStatus: "Interactive story · Encrypted conversation",
    chooseRole: "Choose a role card",
    generateImage: "Generate image",
    generateVideo: "Generate video",
    roleCard: "Role card",
    roleCardHelp: "Choose who you are in this story.",
    roleName: "Name",
    roleGender: "Gender",
    roleAge: "Age",
    roleDescription: "Description",
    genderNeutral: "Non-binary",
    genderFemale: "Female",
    genderMale: "Male",
    clearRole: "Clear",
    saveRole: "Save and use",
    playMessage: "Play message",
    generatingImage: "Generating image…",
    generatingVideo: "Generating video…",
    aiGenerated: "All replies are AI-generated. All characters are portrayed as adults (18 or older).",
    encrypted: "Your chats and account are encrypted.",
    gameResult: "Game result",
    resultComplete: "Challenge complete",
    resultScore: "Score",
    resultPoints: "Points",
    resultMoves: "Moves",
    resultCleared: "Cleared",
    resultBestCascade: "Best cascade",
    continueAfterGame: "Continue story",
  },
  "zh-cn": {
    waiting: "正在准备你的故事…",
    yourChoice: "你的选择",
    replyLabel: "或者写下你自己的回应",
    send: "发送",
    episodeComplete: "本集结束",
    continueStory: "故事还可以从这里继续。",
    continueLabel: "接下来你要怎么做？",
    continue: "继续",
    unable: "暂时无法继续",
    tryAgain: "剧集意外暂停了。",
    retry: "重试",
    next: "下一段",
    interactiveApp: "互动应用",
    loadingApp: "正在打开应用…",
    closeApp: "关闭应用",
    replay: "重新体验",
    replayVideo: "重播视频",
    replayImage: "再次查看图片",
    closeImage: "关闭图片",
    kicker: "互动剧集",
    interactiveStory: "互动故事",
    appUnavailable: "配置的应用当前不可用。",
    appResultInvalid: "应用已结束，但没有返回有效的游戏结算。",
    characterLabel: "角色",
    chatPlaceholder: "写下你想说的话…",
    composerHint: "Enter 发送 · Shift + Enter 换行",
    suggest: "推荐回复",
    tts: "朗读对话",
    textSize: "调整文字大小",
    skin: "切换外观",
    regenerate: "重新生成",
    you: "你",
    thinking: "正在思考…",
    hidePortrait: "隐藏立绘",
    showPortrait: "显示立绘",
    characterProfile: "角色资料",
    personality: "性格",
    about: "关于",
    hotComments: "热门评论",
    commentsEmpty: "社区回复开放后，评论会显示在这里。",
    jumpLatest: "回到最新消息",
    conversationStatus: "互动故事 · 对话已加密",
    chooseRole: "选择角色卡",
    generateImage: "生成图片",
    generateVideo: "生成视频",
    roleCard: "角色卡",
    roleCardHelp: "选择你在这个故事中的身份。",
    roleName: "姓名",
    roleGender: "性别",
    roleAge: "年龄",
    roleDescription: "角色描述",
    genderNeutral: "非二元",
    genderFemale: "女性",
    genderMale: "男性",
    clearRole: "清除",
    saveRole: "保存并使用",
    playMessage: "播放消息",
    generatingImage: "正在生成图片…",
    generatingVideo: "正在生成视频…",
    aiGenerated: "所有回复均由 AI 生成。所有角色均按成年人（18 岁或以上）呈现。",
    encrypted: "你的对话和账户均已加密。",
    gameResult: "游戏结算",
    resultComplete: "挑战完成",
    resultScore: "评分",
    resultPoints: "得分",
    resultMoves: "步数",
    resultCleared: "消除数量",
    resultBestCascade: "最高连击",
    continueAfterGame: "继续剧情",
  },
};

const elements = {
  shell: document.querySelector("#app"),
  kicker: document.querySelector("#episode-kicker"),
  restart: document.querySelector("#restart"),
  portraitWrap: document.querySelector("#portrait-wrap"),
  portrait: document.querySelector("#portrait"),
  headerAvatar: document.querySelector("#header-avatar"),
  portraitToggle: document.querySelector("#portrait-toggle"),
  hidePortrait: document.querySelector("#hide-portrait"),
  headerCharacterName: document.querySelector("#header-character-name"),
  railCharacterName: document.querySelector("#rail-character-name"),
  railCharacterTags: document.querySelector("#rail-character-tags"),
  profileName: document.querySelector("#profile-name"),
  profileTags: document.querySelector("#profile-tags"),
  profileAbout: document.querySelector("#profile-about"),
  railCharacterDescription: document.querySelector("#rail-character-description"),
  ttsToggle: document.querySelector("#tts-toggle"),
  textSize: document.querySelector("#text-size"),
  skinToggle: document.querySelector("#skin-toggle"),
  waiting: document.querySelector("#waiting"),
  mediaView: document.querySelector("#media-view"),
  closeReplayedImage: document.querySelector("#close-replayed-image"),
  image: document.querySelector("#story-image"),
  video: document.querySelector("#story-video"),
  caption: document.querySelector("#media-caption"),
  dialogueView: document.querySelector("#dialogue-view"),
  lines: document.querySelector("#lines"),
  jumpLatest: document.querySelector("#jump-latest"),
  openingTagline: document.querySelector("#opening-tagline"),
  taglineText: document.querySelector("#tagline-text"),
  choiceView: document.querySelector("#choice-view"),
  choicePrompt: document.querySelector("#choice-prompt"),
  choices: document.querySelector("#choices"),
  endView: document.querySelector("#end-view"),
  continueForm: document.querySelector("#continue-form"),
  continueReply: document.querySelector("#continue-reply"),
  errorView: document.querySelector("#error-view"),
  errorRetry: document.querySelector("#error-retry"),
  controls: document.querySelector("#story-controls"),
  progressLabel: document.querySelector("#progress-label"),
  progress: document.querySelector("#progress"),
  continue: document.querySelector("#continue"),
  appDialog: document.querySelector("#app-dialog"),
  appTitle: document.querySelector("#app-title"),
  appFrame: document.querySelector("#app-frame"),
  appLoading: document.querySelector("#app-loading"),
  closeApp: document.querySelector("#close-app"),
  chatDock: document.querySelector("#chat-dock"),
  chatForm: document.querySelector("#chat-form"),
  chatInput: document.querySelector("#chat-input"),
  chatSend: document.querySelector("#chat-send"),
  chatStatus: document.querySelector("#chat-status"),
  suggest: document.querySelector("#suggest"),
  suggestionPanel: document.querySelector("#suggestion-panel"),
  personaOpen: document.querySelector("#persona-open"),
  personaDialog: document.querySelector("#persona-dialog"),
  personaForm: document.querySelector("#persona-form"),
  personaClose: document.querySelector("#persona-close"),
  personaClear: document.querySelector("#persona-clear"),
  personaName: document.querySelector("#persona-name"),
  personaGender: document.querySelector("#persona-gender"),
  personaAge: document.querySelector("#persona-age"),
  personaDescription: document.querySelector("#persona-description"),
  generateImage: document.querySelector("#generate-image"),
  generateVideo: document.querySelector("#generate-video"),
};

const dokiworld = createAppClient({
  appId: WORLD_ID,
  extensions: ["world", "episode", "chat", "dialogue", "media", "speech", "storage", "character", "persona", "apps", "checkpoint"],
});
const episode = createEpisodeClientExtension(dokiworld);
const dialogue = createDialogueClientExtension(dokiworld);
const media = createMediaClientExtension(dokiworld);
const speech = createSpeechClientExtension(dokiworld);
const storage = createStorageClientExtension(dokiworld);
const character = createCharacterClientExtension(dokiworld);
const persona = createPersonaClientExtension(dokiworld);
const apps = createAppsClientExtension(dokiworld, { timeoutMs: APP_LAUNCH_TIMEOUT_MS });
let locale = "en";
let copy = COPY.en;
let experience = null;
let queue = [];
let totalSegments = 0;
let presentedSegments = 0;
let waitingForHost = true;
let pendingAction = null;
let activeApp = null;
let appCatalog = [];
let ttsEnabled = false;
let textScaleIndex = 1;
let lightSkin = false;
let runtimeConfig = null;
let beatsById = new Map();
let assetsById = new Map();
let linkedBeatIds = new Set();
let localActionBeat = null;
let localAppResultContext = null;
let hostedResultPending = false;
let playerPersona = null;
let activeVideo = null;
let activeImage = null;
let videoWatchdog = null;
let dialogueSessionId = null;
let speechAudio = null;

const VIDEO_LOAD_TIMEOUT_MS = 20_000;
const VIDEO_PLAYBACK_GRACE_MS = 10_000;

function clearVideoWatchdog() {
  if (videoWatchdog !== null) {
    window.clearTimeout(videoWatchdog);
    videoWatchdog = null;
  }
}

function armVideoWatchdog(item, timeoutMs = VIDEO_LOAD_TIMEOUT_MS) {
  clearVideoWatchdog();
  videoWatchdog = window.setTimeout(() => {
    videoWatchdog = null;
    if (activeVideo === item) renderNext();
  }, timeoutMs);
}
let replayingImage = false;

function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function safeUrl(value) {
  if (typeof value !== "string" || !value.trim()) return "";
  try {
    const url = new URL(value, document.baseURI);
    const origin = new URL(document.baseURI).origin;
    if (url.protocol === "https:" || url.origin === origin) return url.href;
  } catch {
    return "";
  }
  return "";
}

function applyCopy() {
  document.documentElement.lang = locale;
  document.querySelectorAll("[data-copy]").forEach((node) => {
    const key = node.dataset.copy;
    if (copy[key]) node.textContent = copy[key];
  });
  document.querySelectorAll("[data-copy-title]").forEach((node) => {
    const key = node.dataset.copyTitle;
    if (!copy[key]) return;
    node.setAttribute("title", copy[key]);
    node.setAttribute("aria-label", copy[key]);
  });
  document.querySelectorAll("[data-copy-placeholder]").forEach((node) => {
    const key = node.dataset.copyPlaceholder;
    if (copy[key]) node.setAttribute("placeholder", copy[key]);
  });
  elements.kicker.textContent = copy.interactiveStory;
  elements.restart.setAttribute("aria-label", copy.replay);
  elements.restart.title = copy.replay;
  elements.closeApp.setAttribute("aria-label", copy.closeApp);
  elements.closeApp.title = copy.closeApp;
  elements.ttsToggle.setAttribute("aria-label", copy.tts);
  elements.ttsToggle.title = copy.tts;
  elements.textSize.setAttribute("aria-label", copy.textSize);
  elements.textSize.title = copy.textSize;
  elements.skinToggle.setAttribute("aria-label", copy.skin);
  elements.skinToggle.title = copy.skin;
  elements.portraitToggle.setAttribute("aria-label", copy.hidePortrait);
  elements.portraitToggle.setAttribute("aria-expanded", "true");
}

function hideViews() {
  [
    elements.waiting,
    elements.mediaView,
    elements.dialogueView,
    elements.choiceView,
    elements.endView,
    elements.errorView,
    elements.controls,
  ].forEach((node) => node.classList.add("is-hidden"));
  elements.video.pause();
}

function setComposerEnabled(enabled) {
  elements.chatInput.disabled = !enabled;
  elements.chatSend.disabled = !enabled || !elements.chatInput.value.trim();
  elements.suggest.disabled = !enabled;
}

async function speak(text, force = false) {
  if ((!ttsEnabled && !force) || !text.trim() || !experience?.characterId) return;
  speechAudio?.pause();
  try {
    const result = await speech.synthesize({
      text,
      characterId: experience.characterId,
      locale,
    });
    speechAudio = new Audio(result.audioUrl);
    await speechAudio.play();
  } catch {
    elements.chatStatus.textContent = copy.tryAgain;
  }
}

function post(event) {
  if (!dokiworld.runId) return;
  episode.send(event);
}

function savePlatformCheckpoint() {
  void storage.saveCheckpoint({
    contract: "doki.world.storyteller-state",
    version: 1,
    data: {
      dialogueSessionId,
      playerPersonaId: playerPersona?.id || null,
    },
  }).catch(() => undefined);
}

function showWaiting() {
  hideViews();
  waitingForHost = true;
  elements.shell.dataset.phase = "waiting";
  elements.waiting.classList.remove("is-hidden");
}

function showDialogueHistory() {
  hideViews();
  waitingForHost = false;
  elements.shell.dataset.phase = "dialogue";
  elements.dialogueView.classList.remove("is-hidden");
  elements.chatDock.classList.remove("is-hidden");
  elements.chatStatus.textContent = "";
  setComposerEnabled(true);
  elements.dialogueView.scrollTop = elements.dialogueView.scrollHeight;
}

function showChatWaiting() {
  showDialogueHistory();
  waitingForHost = true;
  elements.chatStatus.textContent = copy.thinking;
  setComposerEnabled(false);
}

function showError(message = copy.tryAgain) {
  hideViews();
  waitingForHost = false;
  elements.shell.dataset.phase = "error";
  elements.errorView.querySelector("h1").textContent = message;
  elements.errorView.classList.remove("is-hidden");
}

function updateProgress() {
  const position = Math.max(1, presentedSegments);
  elements.progressLabel.textContent = String(position).padStart(2, "0");
  elements.progress.style.width = `${Math.min(100, (presentedSegments / Math.max(1, totalSegments)) * 100)}%`;
}

function showControls() {
  updateProgress();
  if (elements.shell.dataset.phase === "dialogue") {
    const content = elements.lines.querySelector(".message-group.is-ai:last-of-type .message-content");
    if (content && !content.querySelector(".inline-next")) {
      const next = document.createElement("button");
      next.className = "inline-next";
      next.type = "button";
      next.textContent = `${copy.next}  →`;
      next.addEventListener("click", () => {
        next.disabled = true;
        renderNext();
      }, { once: true });
      content.append(next);
      window.setTimeout(() => next.focus(), 80);
    }
    return;
  }
  elements.controls.classList.remove("is-hidden");
  window.setTimeout(() => elements.continue.focus(), 80);
}

function episodeItems(utterances) {
  if (!Array.isArray(utterances)) return [];
  return utterances.flatMap((utterance) => {
    if (!isRecord(utterance) || !Array.isArray(utterance.segments)) return [];
    const speakerName = typeof utterance.speakerName === "string" ? utterance.speakerName.trim() : "";
    return utterance.segments
      .filter(isRecord)
      .map((segment) => ({ segment, speakerName }));
  });
}

function orderedBeats() {
  return Array.isArray(runtimeConfig?.beats)
    ? [...runtimeConfig.beats].filter(isRecord).sort((a, b) => (
        Number(a.position || 0) - Number(b.position || 0)
        || String(a.id).localeCompare(String(b.id))
      ))
    : [];
}

function nextConfiguredBeat(beat) {
  if (typeof beat?.nextBeatId === "string") return beatsById.get(beat.nextBeatId) || null;
  if (typeof beat?.id === "string") {
    const inferredTargetIds = new Set();
    beatsById.forEach((candidate) => {
      const options = Array.isArray(candidate?.choices?.options)
        ? candidate.choices.options
        : [];
      if (!options.some((option) => option?.nextBeatId === beat.id)) return;
      options.forEach((option) => {
        if (option?.nextBeatId === beat.id) return;
        const sibling = beatsById.get(option?.nextBeatId) || null;
        if (typeof sibling?.nextBeatId === "string" && beatsById.has(sibling.nextBeatId)) {
          inferredTargetIds.add(sibling.nextBeatId);
        }
      });
    });
    if (inferredTargetIds.size === 1) {
      return beatsById.get([...inferredTargetIds][0]) || null;
    }
  }
  if (beat?.choices || linkedBeatIds.size > 0) return null;
  const beats = orderedBeats();
  const index = beats.findIndex((candidate) => candidate.id === beat?.id);
  return index >= 0 ? beats[index + 1] || null : null;
}

function configuredRoot() {
  const roots = orderedBeats().filter((beat) => !linkedBeatIds.has(beat.id));
  return roots.find((beat) => beat.required === true) || roots[0] || null;
}

function pathNeedsLlm(startBeatId) {
  let beat = beatsById.get(startBeatId) || null;
  const visited = new Set();
  while (beat && !visited.has(beat.id)) {
    visited.add(beat.id);
    if (
      Array.isArray(beat.utterances)
      && beat.utterances.some((utterance) => isRecord(utterance) && utterance.source === "llm")
    ) return true;
    if (beat.choices || beat.action) return false;
    beat = nextConfiguredBeat(beat);
  }
  return false;
}

function localPathItems(startBeatId) {
  const items = [];
  let beat = beatsById.get(startBeatId) || null;
  const visited = new Set();
  while (beat && !visited.has(beat.id)) {
    visited.add(beat.id);
    const assetRefs = Array.isArray(beat.assets)
      ? [...beat.assets].filter(isRecord).sort((a, b) => Number(a.position || 0) - Number(b.position || 0))
      : [];
    assetRefs.forEach((reference) => {
      const asset = assetsById.get(reference.assetId);
      if (!asset || !safeUrl(asset.url)) return;
      items.push({
        speakerName: experience?.title || "",
        segment: {
          type: asset.kind,
          beatId: beat.id,
          assetId: asset.id,
          mediaUrl: asset.url,
          caption: asset.title || "",
          localAuthored: true,
        },
      });
    });
    (Array.isArray(beat.utterances) ? beat.utterances : []).forEach((utterance) => {
      if (!isRecord(utterance) || utterance.source === "llm") return;
      (Array.isArray(utterance.segments) ? utterance.segments : []).forEach((segment) => {
        if (!isRecord(segment)) return;
        items.push({
          speakerName: experience?.title || "",
          segment: {
            ...segment,
            text: interpolateAppResultTemplate(segment.text, localAppResultContext),
            beatId: beat.id,
            localAuthored: true,
          },
        });
      });
    });
    if (isRecord(beat.choices)) {
      const options = Array.isArray(beat.choices.options)
        ? beat.choices.options.map((option) => isRecord(option) ? {
          ...option,
          label: interpolateAppResultTemplate(option.label, localAppResultContext),
        } : option)
        : [];
      items.push({
        speakerName: experience?.title || "",
        segment: {
          type: "choices",
          beatId: beat.id,
          text: interpolateAppResultTemplate(
            typeof beat.choices.description === "string" ? beat.choices.description : beat.goal,
            localAppResultContext,
          ),
          options,
          allowFreeText: true,
          localAuthored: true,
        },
      });
      break;
    }
    if (isRecord(beat.action)) {
      items.push({
        speakerName: experience?.title || "",
        segment: {
          type: "game",
          beatId: beat.id,
          gameConfig: {
            gameType: "external",
            gameId: beat.action.appId,
            configId: beat.action.configId,
          },
          localAuthored: true,
        },
      });
      break;
    }
    beat = nextConfiguredBeat(beat);
  }
  return items;
}

function playConfiguredPath(startBeatId) {
  const items = localPathItems(startBeatId);
  queue = items;
  totalSegments = Math.max(1, items.length);
  presentedSegments = 0;
  waitingForHost = false;
  renderNext();
}

function startConfiguredExperience() {
  localAppResultContext = null;
  const root = configuredRoot();
  if (!root || pathNeedsLlm(root.id)) {
    showWaiting();
    post({ type: "episode.start" });
    return;
  }
  playConfiguredPath(root.id);
}

function renderDialogue(first) {
  const items = [first];
  while (
    queue.length
    && ["dialogue", "action", "thought", "narration"].includes(queue[0].segment.type)
  ) {
    items.push(queue.shift());
  }
  presentedSegments += items.length;
  showDialogueHistory();
  const spoken = [];
  const groups = [];
  items.forEach((item) => {
    const previous = groups.at(-1);
    if (previous && previous.speakerName === item.speakerName) previous.items.push(item);
    else groups.push({ speakerName: item.speakerName, items: [item] });
  });
  groups.forEach((entry, groupIndex) => {
    const group = document.createElement("article");
    group.className = "message-group is-ai";
    if (experience?.avatarUrl) {
      const avatar = document.createElement("img");
      avatar.className = "message-avatar";
      avatar.src = experience.avatarUrl;
      avatar.alt = "";
      group.append(avatar);
    }
    const content = document.createElement("div");
    content.className = "message-content";
    const speaker = document.createElement("p");
    speaker.className = "speaker";
    speaker.textContent = entry.speakerName || experience?.title || copy.kicker;
    const heading = document.createElement("div");
    heading.className = "message-heading";
    const play = document.createElement("button");
    play.className = "message-play";
    play.type = "button";
    play.textContent = "▶";
    play.setAttribute("aria-label", copy.playMessage);
    const bubble = document.createElement("div");
    bubble.className = "message-bubble";
    entry.items.forEach(({ segment }) => {
      const line = document.createElement("p");
      const type = ["dialogue", "action", "thought", "narration"].includes(segment.type)
        ? segment.type
        : "narration";
      line.className = `line ${type}`;
      line.textContent = typeof segment.text === "string" ? segment.text : "";
      bubble.append(line);
      if (line.textContent) spoken.push(line.textContent);
    });
    play.addEventListener("click", () => {
      const text = entry.items.map(({ segment }) => segment.text || "").join(" ");
      speak(text, true);
    });
    heading.append(speaker, play);
    bubble.prepend(heading);
    content.append(bubble);
    if (
      groupIndex === groups.length - 1
      && !entry.items.some(({ segment }) => segment.localAuthored === true)
    ) {
      const actions = document.createElement("div");
      actions.className = "message-actions";
      const regenerate = document.createElement("button");
      regenerate.type = "button";
      regenerate.textContent = copy.regenerate;
      regenerate.addEventListener("click", () => {
        if (waitingForHost) return;
        void regenerateLatestDialogue();
      });
      actions.append(regenerate);
      content.append(actions);
    }
    group.append(content);
    elements.lines.append(group);
  });
  elements.dialogueView.scrollTop = elements.dialogueView.scrollHeight;
  speak(spoken.join(" "));
  if (queue.length > 0) showControls();
}

function renderImage(item) {
  const src = safeUrl(item.segment.mediaUrl);
  if (!src) return renderNext();
  activeImage = item;
  replayingImage = false;
  elements.closeReplayedImage.classList.add("is-hidden");
  presentedSegments += 1;
  hideViews();
  elements.shell.dataset.phase = "media";
  elements.image.src = src;
  elements.image.alt = typeof item.segment.caption === "string" ? item.segment.caption : "";
  elements.image.classList.remove("is-hidden");
  elements.video.classList.add("is-hidden");
  elements.caption.textContent = elements.image.alt;
  elements.mediaView.classList.remove("is-hidden");
  showControls();
}

function renderVideo(item) {
  const src = safeUrl(item.segment.mediaUrl);
  if (!src) return renderNext();
  activeVideo = item;
  replayingImage = false;
  elements.closeReplayedImage.classList.add("is-hidden");
  presentedSegments += 1;
  hideViews();
  elements.shell.dataset.phase = "media";
  elements.video.autoplay = true;
  elements.video.muted = false;
  elements.video.src = src;
  elements.video.classList.remove("is-hidden");
  elements.image.classList.add("is-hidden");
  elements.caption.textContent = typeof item.segment.caption === "string" ? item.segment.caption : "";
  elements.mediaView.classList.remove("is-hidden");
  showControls();
  armVideoWatchdog(item);
  elements.video.addEventListener("loadedmetadata", () => {
    if (activeVideo !== item || !Number.isFinite(elements.video.duration)) return;
    armVideoWatchdog(
      item,
      Math.max(
        VIDEO_LOAD_TIMEOUT_MS,
        elements.video.duration * 1_000 + VIDEO_PLAYBACK_GRACE_MS,
      ),
    );
  }, { once: true });
  void elements.video.play().catch(() => {
    elements.video.muted = true;
    return elements.video.play();
  }).catch(() => {
    if (activeVideo === item) renderNext();
  });
}

function appendCompletedVideo(item) {
  const src = safeUrl(item?.segment?.mediaUrl);
  if (!src) return;
  const group = document.createElement("article");
  group.className = "message-group is-ai completed-video-group";
  if (experience?.avatarUrl) {
    const avatar = document.createElement("img");
    avatar.className = "message-avatar";
    avatar.src = experience.avatarUrl;
    avatar.alt = "";
    group.append(avatar);
  }
  const content = document.createElement("div");
  content.className = "message-content";
  const heading = document.createElement("div");
  heading.className = "message-heading";
  const speaker = document.createElement("p");
  speaker.className = "speaker";
  speaker.textContent = item.speakerName || experience?.title || copy.kicker;
  heading.append(speaker);
  const bubble = document.createElement("div");
  bubble.className = "message-bubble completed-video-bubble";
  const media = document.createElement("video");
  media.className = "completed-video-media";
  media.src = src;
  media.controls = true;
  media.playsInline = true;
  media.preload = "metadata";
  media.setAttribute("aria-label", copy.replayVideo);
  const frame = document.createElement("div");
  frame.className = "completed-video-frame";
  const replay = document.createElement("button");
  replay.className = "completed-video-replay";
  replay.type = "button";
  replay.textContent = "▶";
  replay.setAttribute("aria-label", copy.replayVideo);
  replay.addEventListener("click", () => void media.play().catch(() => undefined));
  media.addEventListener("play", () => replay.classList.add("is-hidden"));
  media.addEventListener("pause", () => replay.classList.remove("is-hidden"));
  media.addEventListener("ended", () => replay.classList.remove("is-hidden"));
  frame.append(media, replay);
  bubble.append(frame);
  const caption = typeof item.segment.caption === "string" ? item.segment.caption.trim() : "";
  if (caption) {
    const label = document.createElement("p");
    label.className = "completed-video-caption";
    label.textContent = caption;
    bubble.append(label);
  }
  bubble.prepend(heading);
  content.append(bubble);
  group.append(content);
  elements.lines.append(group);
}

async function submitReply(value) {
  const playerInput = value.trim();
  if (!playerInput || waitingForHost) return;
  const group = document.createElement("article");
  group.className = "message-group is-user";
  const speaker = document.createElement("p");
  speaker.className = "speaker";
  speaker.textContent = copy.you;
  const bubble = document.createElement("div");
  bubble.className = "message-bubble";
  const line = document.createElement("p");
  line.className = "line dialogue";
  line.textContent = playerInput;
  bubble.append(line);
  group.append(speaker, bubble);
  elements.lines.append(group);
  showChatWaiting();
  try {
    const response = await dialogue.generateDialogue({
      characterId: experience?.characterId || "",
      playerInput,
      sessionId: dialogueSessionId,
      inputMode: "speech",
      playerPersona,
    });
    dialogueSessionId = response.sessionId;
    savePlatformCheckpoint();
    acceptEpisode(response.utterances);
  } catch {
    showError();
  }
}

async function regenerateLatestDialogue() {
  showChatWaiting();
  try {
    const response = await dialogue.regenerateDialogue({
      characterId: experience?.characterId || "",
      sessionId: dialogueSessionId,
      playerPersona,
    });
    dialogueSessionId = response.sessionId;
    savePlatformCheckpoint();
    elements.lines.querySelector(".message-group.is-ai:last-of-type")?.remove();
    acceptEpisode(response.utterances);
  } catch {
    showError();
  }
}

function renderSuggestions(items) {
  elements.chatStatus.textContent = "";
  elements.suggestionPanel.replaceChildren();
  const suggestions = Array.isArray(items)
    ? items.filter((item) => typeof item === "string" && item.trim()).slice(0, 3)
    : [];
  suggestions.forEach((suggestion) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = suggestion;
    button.addEventListener("click", () => {
      elements.chatInput.value = suggestion;
      elements.suggestionPanel.classList.add("is-hidden");
      elements.chatInput.focus();
      elements.chatSend.disabled = false;
    });
    elements.suggestionPanel.append(button);
  });
  elements.suggestionPanel.classList.toggle("is-hidden", suggestions.length === 0);
}

async function requestDialogueSuggestions() {
  elements.suggestionPanel.replaceChildren();
  elements.suggestionPanel.classList.remove("is-hidden");
  elements.chatStatus.textContent = copy.thinking;
  elements.suggest.disabled = true;
  try {
    const response = await dialogue.generateSuggestions({
      characterId: experience?.characterId || "",
      sessionId: dialogueSessionId,
      playerPersona,
    });
    renderSuggestions(response.suggestions);
  } catch {
    renderSuggestions([]);
    elements.chatStatus.textContent = copy.tryAgain;
  } finally {
    elements.suggest.disabled = waitingForHost;
  }
}

function appendGeneratedMedia(type, url) {
  const src = safeUrl(url);
  if (!src) return;
  showDialogueHistory();
  const group = document.createElement("article");
  group.className = "message-group is-ai generated-media-group";
  if (experience?.avatarUrl) {
    const avatar = document.createElement("img");
    avatar.className = "message-avatar";
    avatar.src = experience.avatarUrl;
    avatar.alt = "";
    group.append(avatar);
  }
  const content = document.createElement("div");
  content.className = "message-content";
  const heading = document.createElement("div");
  heading.className = "message-heading";
  const speaker = document.createElement("p");
  speaker.className = "speaker";
  speaker.textContent = experience?.title || copy.kicker;
  heading.append(speaker);
  const bubble = document.createElement("div");
  bubble.className = "message-bubble generated-media-bubble";
  const media = document.createElement(type === "video" ? "video" : "img");
  media.className = "generated-chat-media";
  media.src = src;
  if (type === "video") {
    media.controls = true;
    media.playsInline = true;
  } else media.alt = "";
  bubble.append(media);
  bubble.prepend(heading);
  content.append(bubble);
  group.append(content);
  elements.lines.append(group);
  elements.dialogueView.scrollTo({ top: elements.dialogueView.scrollHeight, behavior: "smooth" });
}

function renderChoices(item) {
  const options = Array.isArray(item.segment.options)
    ? item.segment.options.filter((option) => isRecord(option) && typeof option.id === "string")
    : [];
  if (!options.length) return renderNext();
  presentedSegments += 1;
  hideViews();
  elements.shell.dataset.phase = "choice";
  elements.choicePrompt.textContent = typeof item.segment.text === "string" && item.segment.text.trim()
    ? item.segment.text
    : copy.yourChoice;
  elements.choices.replaceChildren();
  options.forEach((option, index) => {
    const button = document.createElement("button");
    button.className = "choice-button";
    button.type = "button";
    const marker = document.createElement("span");
    marker.textContent = String(index + 1).padStart(2, "0");
    const label = document.createElement("strong");
    label.textContent = typeof option.label === "string" ? option.label : option.id;
    button.append(marker, label);
    button.addEventListener("click", () => {
      const targetBeatId = typeof option.nextBeatId === "string" ? option.nextBeatId : "";
      const deterministicItems = targetBeatId ? localPathItems(targetBeatId) : [];
      const hasDeterministicProgress = deterministicItems.some(({ segment }) => (
        ["image", "video", "game", "choices"].includes(segment.type)
      ));
      if (
        item.segment.localAuthored === true
        && targetBeatId
        && (!pathNeedsLlm(targetBeatId) || hasDeterministicProgress)
      ) {
        playConfiguredPath(targetBeatId);
        return;
      }
      if (item.segment.localAuthored === true && !targetBeatId) {
        showEnd();
        return;
      }
      showWaiting();
      post({
        type: "episode.choice",
        beatId: item.segment.beatId,
        optionId: option.id,
      });
    });
    elements.choices.append(button);
  });
  elements.choiceView.classList.remove("is-hidden");
  window.setTimeout(() => elements.choices.querySelector("button")?.focus(), 80);
}

async function findConfiguredApp(gameId) {
  const app = appCatalog.find((entry) => (
    isRecord(entry)
    && entry.id === gameId
    && entry.protocolVersion === 2
  ));
  if (!app) throw new Error("app unavailable");
  return app;
}

async function openConfiguredApp(config) {
  const gameId = typeof config?.gameId === "string" && config.gameId.trim()
    ? config.gameId.trim()
    : (config?.gameType === "match3" || config?.gameType === "builtin" ? "game-match3" : "");
  if (!gameId) {
    showError(copy.appUnavailable);
    return;
  }
  try {
    hostedResultPending = false;
    elements.shell.dataset.phase = "app";
    const app = await findConfiguredApp(gameId);
    const runtime = isRecord(app.runtime) ? app.runtime : {};
    const launch = await apps.launch({
      appId: gameId,
      input: {
        contract: runtime.input?.contract || "doki.game.match3-input",
        version: runtime.input?.version || 1,
        data: { options: createGameOptions(config) },
      },
    });
    if (launch.status === "completed" && parseGameResult(launch.output)) {
      settleActiveGameResult({ config }, launch.output);
    } else if (launch.status === "cancelled" && localActionBeat) {
      completeLocalConfiguredApp();
    } else if (launch.status === "cancelled") {
      renderNext();
    } else {
      showError(copy.appResultInvalid);
    }
  } catch {
    activeApp = null;
    showError(copy.appUnavailable);
  }
}

function renderGameResult(result, nextBeatId, config, onContinue = null) {
  showDialogueHistory();
  const card = document.createElement("article");
  card.className = "game-result-panel";
  const kicker = document.createElement("span");
  kicker.className = "game-result-kicker";
  kicker.textContent = `✦  ${copy.gameResult}`;
  const title = document.createElement("h2");
  title.textContent = typeof config?.title === "string" && config.title.trim()
    ? config.title
    : copy.resultComplete;
  const summary = document.createElement("div");
  summary.className = "game-result-summary";
  const scoreLabel = document.createElement("span");
  scoreLabel.textContent = copy.resultScore;
  const score = document.createElement("strong");
  const normalizedScore = Number(result.normalizedScore);
  score.textContent = Number.isFinite(normalizedScore)
    ? `${Math.round(Math.max(0, Math.min(100, normalizedScore)))} / 100`
    : copy.resultComplete;
  summary.append(scoreLabel, score);
  const metrics = isRecord(result.metrics) ? result.metrics : {};
  const metricDefinitions = [
    ["points", copy.resultPoints],
    ["moves", copy.resultMoves],
    ["cleared", copy.resultCleared],
    ["bestCascade", copy.resultBestCascade],
  ];
  const metricList = document.createElement("dl");
  metricList.className = "game-result-metrics";
  metricDefinitions.forEach(([key, label]) => {
    const value = metrics[key];
    if (typeof value !== "string" && !Number.isFinite(Number(value))) return;
    const term = document.createElement("dt");
    term.textContent = label;
    const detail = document.createElement("dd");
    detail.textContent = String(value);
    metricList.append(term, detail);
  });
  card.append(kicker, title, summary);
  if (metricList.childElementCount > 0) card.append(metricList);
  const target = typeof nextBeatId === "string" ? beatsById.get(nextBeatId) || null : null;
  if (target || typeof onContinue === "function") {
    const next = document.createElement("button");
    next.className = "game-result-continue";
    next.type = "button";
    next.textContent = `${copy.continueAfterGame}  →`;
    next.addEventListener("click", () => {
      next.disabled = true;
      if (typeof onContinue === "function") onContinue();
      else playConfiguredPath(target.id);
    }, { once: true });
    card.append(next);
  }
  elements.lines.append(card);
  elements.dialogueView.scrollTo({ top: elements.dialogueView.scrollHeight, behavior: "smooth" });
}

function replayCompletedImage(item) {
  const src = safeUrl(item?.segment?.mediaUrl);
  if (!src) return;
  replayingImage = true;
  hideViews();
  elements.shell.dataset.phase = "media";
  elements.image.src = src;
  elements.image.alt = typeof item.segment.caption === "string" ? item.segment.caption : "";
  elements.image.classList.remove("is-hidden");
  elements.video.classList.add("is-hidden");
  elements.caption.textContent = elements.image.alt;
  elements.mediaView.classList.remove("is-hidden");
  elements.closeReplayedImage.classList.remove("is-hidden");
  showControls();
  window.setTimeout(() => elements.closeReplayedImage.focus(), 80);
}

function closeReplayedImage() {
  if (!replayingImage) return;
  replayingImage = false;
  elements.closeReplayedImage.classList.add("is-hidden");
  showDialogueHistory();
}

function preserveCompletedImage(item) {
  const src = safeUrl(item?.segment?.mediaUrl);
  if (!src) return;
  const group = document.createElement("article");
  group.className = "message-group is-ai completed-image-group";
  if (experience?.avatarUrl) {
    const avatar = document.createElement("img");
    avatar.className = "message-avatar";
    avatar.src = experience.avatarUrl;
    avatar.alt = "";
    group.append(avatar);
  }
  const content = document.createElement("div");
  content.className = "message-content";
  const heading = document.createElement("div");
  heading.className = "message-heading";
  const speaker = document.createElement("p");
  speaker.className = "speaker";
  speaker.textContent = item.speakerName || experience?.title || copy.kicker;
  heading.append(speaker);
  const bubble = document.createElement("div");
  bubble.className = "message-bubble completed-image-bubble";
  const preview = document.createElement("button");
  preview.className = "completed-image-preview";
  preview.type = "button";
  preview.setAttribute("aria-label", copy.replayImage);
  const media = document.createElement("img");
  media.className = "completed-image-media";
  media.src = src;
  media.alt = typeof item.segment.caption === "string" ? item.segment.caption : "";
  media.loading = "lazy";
  preview.append(media);
  preview.addEventListener("click", () => replayCompletedImage(item));
  bubble.append(preview);
  const caption = typeof item.segment.caption === "string" ? item.segment.caption.trim() : "";
  if (caption) {
    const label = document.createElement("p");
    label.className = "completed-image-caption";
    label.textContent = caption;
    bubble.append(label);
  }
  bubble.prepend(heading);
  content.append(bubble);
  group.append(content);
  elements.lines.append(group);
}

function settleActiveGameResult(current, output) {
  const result = parseGameResult(output);
  if (!result) {
    showError(copy.appResultInvalid);
    return;
  }
  if (localActionBeat) {
    window.queueMicrotask(() => completeLocalConfiguredApp(output));
    return;
  }
  const config = current.config;
  hostedResultPending = true;
  post({
    type: "episode.gameCompleted",
    configId: current.config.configId,
    output,
  });
  closeConfiguredApp(false);
  renderGameResult(result, null, config);
}

function closeConfiguredApp(resume = true) {
  if (elements.appDialog.open) elements.appDialog.close();
  elements.appFrame.removeAttribute("src");
  activeApp = null;
  pendingAction = null;
  if (resume) renderNext();
}

function completeLocalConfiguredApp(output = null) {
  const beat = localActionBeat;
  const config = activeApp?.config || pendingAction?.gameConfig || {};
  localActionBeat = null;
  closeConfiguredApp(false);
  if (isRecord(output)) {
    const inferredTarget = nextConfiguredBeat(beat);
    const resolution = resolveConfiguredAppResult(output, inferredTarget?.id ?? null);
    if (!resolution) {
      showError(copy.appResultInvalid);
      return;
    }
    localAppResultContext = resolution.result;
    renderGameResult(resolution.result, resolution.nextBeatId, config);
    return;
  }
  const target = nextConfiguredBeat(beat);
  if (target) playConfiguredPath(target.id);
  else showEnd();
}

function completeHostedConfiguredApp(result, utterances = null) {
  if (hostedResultPending) {
    hostedResultPending = false;
    if (Array.isArray(utterances)) acceptEpisode(utterances);
    else showDialogueHistory();
    return;
  }
  const config = activeApp?.config || pendingAction?.gameConfig || {};
  const continueWithNarrative = Array.isArray(utterances)
    ? () => acceptEpisode(utterances)
    : null;
  closeConfiguredApp(false);
  renderGameResult(result, null, config, continueWithNarrative);
}

function requestAction(item) {
  const beatId = typeof item.segment.beatId === "string" ? item.segment.beatId : "";
  if (!beatId) return renderNext();
  presentedSegments += 1;
  pendingAction = item.segment;
  const configuredBeat = beatsById.get(beatId) || null;
  const target = nextConfiguredBeat(configuredBeat);
  if (
    item.segment.localAuthored === true
    && (!target || !pathNeedsLlm(target.id))
  ) {
    localActionBeat = configuredBeat;
    void openConfiguredApp(item.segment.gameConfig);
    return;
  }
  showWaiting();
  post({ type: "episode.action", beatId });
}

function showEnd() {
  if (elements.lines.childElementCount > 0) {
    showDialogueHistory();
    window.setTimeout(() => elements.chatInput.focus(), 80);
    return;
  }
  hideViews();
  waitingForHost = false;
  elements.shell.dataset.phase = "complete";
  elements.endView.classList.remove("is-hidden");
  window.setTimeout(() => elements.continueReply.focus(), 80);
}

function renderNext() {
  clearVideoWatchdog();
  waitingForHost = false;
  if (activeImage) {
    preserveCompletedImage(activeImage);
    activeImage = null;
  }
  if (activeVideo) {
    appendCompletedVideo(activeVideo);
    activeVideo = null;
  }
  if (!queue.length) {
    showEnd();
    return;
  }
  const item = queue.shift();
  const type = item.segment.type;
  if (["dialogue", "action", "thought", "narration"].includes(type)) renderDialogue(item);
  else if (type === "image") renderImage(item);
  else if (type === "video") renderVideo(item);
  else if (type === "choices") renderChoices(item);
  else if (type === "game") requestAction(item);
  else if (type === "chat-return") showDialogueHistory();
  else renderNext();
}

function acceptEpisode(utterances) {
  if (elements.appDialog.open) elements.appDialog.close();
  elements.appFrame.removeAttribute("src");
  activeApp = null;
  pendingAction = null;
  localActionBeat = null;
  hostedResultPending = false;
  activeVideo = null;
  activeImage = null;
  replayingImage = false;
  const items = episodeItems(utterances);
  queue = items;
  totalSegments = Math.max(1, items.length);
  presentedSegments = 0;
  waitingForHost = false;
  renderNext();
}

function restartEpisode() {
  queue = [];
  totalSegments = 0;
  presentedSegments = 0;
  pendingAction = null;
  localActionBeat = null;
  hostedResultPending = false;
  activeVideo = null;
  activeImage = null;
  replayingImage = false;
  dialogueSessionId = null;
  void storage.clearCheckpoint().catch(() => undefined);
  closeConfiguredApp(false);
  elements.lines.replaceChildren();
  elements.suggestionPanel.replaceChildren();
  elements.suggestionPanel.classList.add("is-hidden");
  const root = configuredRoot();
  if (root && !pathNeedsLlm(root.id)) {
    playConfiguredPath(root.id);
    return;
  }
  showWaiting();
  post({ type: "episode.restart" });
  window.setTimeout(() => post({ type: "episode.start" }), 0);
}

function initialize(message) {
  locale = String(message.locale).toLowerCase().startsWith("zh") ? "zh-cn" : "en";
  copy = COPY[locale];
  dialogueSessionId = null;
  appCatalog = [];
  const candidate = isRecord(message.experience) ? message.experience : {};
  experience = {
    characterId: typeof candidate.characterId === "string" ? candidate.characterId : "",
    title: typeof candidate.title === "string" ? candidate.title : "",
    description: typeof candidate.description === "string" ? candidate.description : "",
    portraitUrl: safeUrl(candidate.portraitUrl),
    avatarUrl: safeUrl(candidate.avatarUrl) || safeUrl(candidate.portraitUrl),
    tags: Array.isArray(candidate.tags)
      ? candidate.tags.filter((tag) => typeof tag === "string" && tag.trim()).slice(0, 2)
      : [],
  };
  runtimeConfig = isRecord(candidate.config) ? candidate.config : null;
  const beats = Array.isArray(runtimeConfig?.beats) ? runtimeConfig.beats.filter(isRecord) : [];
  const assets = Array.isArray(runtimeConfig?.assets) ? runtimeConfig.assets.filter(isRecord) : [];
  beatsById = new Map(beats.map((beat) => [beat.id, beat]));
  assetsById = new Map(assets.map((asset) => [asset.id, asset]));
  linkedBeatIds = new Set(beats.flatMap((beat) => [
    ...(typeof beat.nextBeatId === "string" ? [beat.nextBeatId] : []),
    ...(Array.isArray(beat.choices?.options)
      ? beat.choices.options.flatMap((option) => (
          typeof option?.nextBeatId === "string" ? [option.nextBeatId] : []
        ))
      : []),
  ]));
  applyCopy();
  if (experience.portraitUrl) {
    elements.portrait.src = experience.portraitUrl;
    elements.portrait.alt = "";
    elements.portraitWrap.classList.remove("is-hidden");
    elements.headerAvatar.src = experience.avatarUrl;
    elements.headerAvatar.classList.remove("is-hidden");
  }
  elements.railCharacterName.textContent = experience.title || copy.kicker;
  elements.headerCharacterName.textContent = experience.title || copy.kicker;
  elements.railCharacterTags.textContent = experience.tags.join(" · ") || copy.interactiveStory;
  elements.railCharacterDescription.textContent = experience.description;
  elements.profileName.textContent = experience.title || copy.kicker;
  elements.profileAbout.textContent = experience.description;
  elements.taglineText.textContent = experience.description;
  elements.openingTagline.classList.toggle("is-hidden", !experience.description);
  elements.profileTags.replaceChildren(...experience.tags.map((tag) => {
    const chip = document.createElement("em");
    chip.textContent = tag;
    return chip;
  }));
  window.setTimeout(startConfiguredExperience, 0);
}

elements.continue.addEventListener("click", () => {
  if (replayingImage) {
    closeReplayedImage();
    return;
  }
  renderNext();
});
elements.closeReplayedImage.addEventListener("click", closeReplayedImage);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && replayingImage) closeReplayedImage();
});
elements.video.addEventListener("ended", renderNext);
elements.video.addEventListener("error", () => {
  if (activeVideo) renderNext();
});
elements.restart.addEventListener("click", restartEpisode);
elements.errorRetry.addEventListener("click", restartEpisode);
elements.continueForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const value = elements.continueReply.value;
  elements.continueReply.value = "";
  void submitReply(value);
});
elements.chatInput.addEventListener("input", () => {
  elements.chatSend.disabled = waitingForHost || !elements.chatInput.value.trim();
  elements.chatInput.style.height = "auto";
  elements.chatInput.style.height = `${Math.min(150, elements.chatInput.scrollHeight)}px`;
});
elements.chatInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    elements.chatForm.requestSubmit();
  }
});
elements.chatForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const value = elements.chatInput.value;
  elements.chatInput.value = "";
  elements.chatInput.style.height = "auto";
  void submitReply(value);
});
elements.suggest.addEventListener("click", () => {
  if (waitingForHost) return;
  void requestDialogueSuggestions();
});

elements.dialogueView.addEventListener("scroll", () => {
  const distance = elements.dialogueView.scrollHeight - elements.dialogueView.scrollTop - elements.dialogueView.clientHeight;
  elements.jumpLatest.classList.toggle("is-hidden", distance < 120);
});
elements.jumpLatest.addEventListener("click", () => {
  elements.dialogueView.scrollTo({ top: elements.dialogueView.scrollHeight, behavior: "smooth" });
});

elements.personaOpen.addEventListener("click", async () => {
  if (!experience?.characterId) return;
  elements.personaOpen.disabled = true;
  try {
    const selection = await persona.requestSelection(experience.characterId);
    playerPersona = selection.persona;
    elements.personaOpen.querySelector("span:last-child").textContent = playerPersona?.name || copy.chooseRole;
  } catch {
    elements.chatStatus.textContent = copy.tryAgain;
  } finally {
    elements.personaOpen.disabled = false;
  }
});
elements.personaClose.addEventListener("click", () => elements.personaDialog.close());
elements.personaClear.addEventListener("click", () => {
  playerPersona = null;
  elements.personaName.value = "";
  elements.personaDescription.value = "";
  elements.personaOpen.querySelector("span:last-child").textContent = copy.chooseRole;
  elements.personaDialog.close();
});
elements.personaForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = elements.personaName.value.trim();
  if (!name) return;
  playerPersona = {
    name,
    gender: elements.personaGender.value,
    age: Math.max(18, Math.min(120, Number(elements.personaAge.value) || 18)),
    description: elements.personaDescription.value.trim(),
  };
  elements.personaOpen.querySelector("span:last-child").textContent = name;
  elements.personaDialog.close();
});

async function waitForMediaJob(job) {
  let current = job;
  while (current.status === "pending" || current.status === "processing") {
    await new Promise((resolve) => window.setTimeout(resolve, 1500));
    current = await media.getJob(current.id);
  }
  return current;
}

async function requestGeneratedMedia(mediaType) {
  if (waitingForHost) return;
  elements.chatStatus.textContent = mediaType === "video" ? copy.generatingVideo : copy.generatingImage;
  elements.generateImage.disabled = true;
  elements.generateVideo.disabled = true;
  try {
    const request = {
      sessionId: dialogueSessionId,
      characterId: experience?.characterId || undefined,
      portraitUrl: experience?.portraitUrl || undefined,
      playerPersona,
    };
    const submitted = mediaType === "video"
      ? await media.generateVideo(request)
      : await media.generateImage({
          ...request,
          prompt: dialogueSessionId ? undefined : experience?.description || experience?.title,
        });
    const completed = await waitForMediaJob(submitted);
    const url = completed.urls?.[0];
    if (completed.status !== "done" || !url) throw new Error(completed.error || "Media generation failed");
    appendGeneratedMedia(mediaType, url);
    elements.chatStatus.textContent = "";
  } catch (error) {
    elements.chatStatus.textContent = error instanceof Error ? error.message : copy.tryAgain;
  } finally {
    elements.generateImage.disabled = false;
    elements.generateVideo.disabled = false;
  }
}
elements.generateImage.addEventListener("click", () => void requestGeneratedMedia("image"));
elements.generateVideo.addEventListener("click", () => void requestGeneratedMedia("video"));

elements.ttsToggle.addEventListener("click", () => {
  ttsEnabled = !ttsEnabled;
  elements.ttsToggle.setAttribute("aria-pressed", String(ttsEnabled));
  if (!ttsEnabled) {
    speechAudio?.pause();
    speechAudio = null;
  }
});
elements.textSize.addEventListener("click", () => {
  const scales = [0.9, 1, 1.16, 1.3];
  textScaleIndex = (textScaleIndex + 1) % scales.length;
  elements.shell.style.setProperty("--text-scale", String(scales[textScaleIndex]));
});
elements.skinToggle.addEventListener("click", () => {
  lightSkin = !lightSkin;
  elements.shell.dataset.skin = lightSkin ? "light" : "dark";
  elements.skinToggle.setAttribute("aria-pressed", String(lightSkin));
});
function setPortraitOpen(open) {
  elements.shell.dataset.portrait = open ? "open" : "hidden";
  elements.portraitToggle.setAttribute("aria-expanded", String(open));
  elements.portraitToggle.setAttribute("aria-label", open ? copy.hidePortrait : copy.showPortrait);
}
elements.hidePortrait.addEventListener("click", () => setPortraitOpen(false));
elements.portraitToggle.addEventListener("click", () => {
  setPortraitOpen(elements.shell.dataset.portrait === "hidden");
});
elements.closeApp.addEventListener("click", () => {
  if (localActionBeat) completeLocalConfiguredApp();
  else closeConfiguredApp(true);
});
elements.appDialog.addEventListener("cancel", (event) => {
  event.preventDefault();
  if (localActionBeat) completeLocalConfiguredApp();
  else closeConfiguredApp(true);
});
dokiworld.connect({
  onInit: async ({ locale: nextLocale, input }) => {
    const data = isRecord(input.data) ? input.data : {};
    const [checkpointResult, characterResult, personaResult, appsResult] = await Promise.allSettled([
      storage.loadCheckpoint(),
      character.getCurrent(),
      data.experience?.characterId
        ? persona.getSelected(data.experience.characterId)
        : Promise.resolve({ persona: null }),
      apps.list(),
    ]);
    const currentCharacter = characterResult.status === "fulfilled"
      ? characterResult.value.character
      : null;
    initialize({
      locale: nextLocale,
      ...data,
      ...(currentCharacter ? {
        experience: {
          ...(isRecord(data.experience) ? data.experience : {}),
          characterId: currentCharacter.id,
          title: currentCharacter.name,
          description: currentCharacter.description,
          portraitUrl: currentCharacter.portraitUrl,
          avatarUrl: currentCharacter.avatarUrl,
          tags: currentCharacter.tags,
        },
      } : {}),
    });
    if (checkpointResult.status === "fulfilled") {
      const checkpointData = checkpointResult.value.checkpoint?.data;
      if (isRecord(checkpointData) && Number.isInteger(checkpointData.dialogueSessionId)) {
        dialogueSessionId = checkpointData.dialogueSessionId;
      }
    }
    if (personaResult.status === "fulfilled") {
      playerPersona = personaResult.value.persona;
      elements.personaOpen.querySelector("span:last-child").textContent = playerPersona?.name || copy.chooseRole;
    }
    if (appsResult.status === "fulfilled") {
      appCatalog = appsResult.value.apps.map((app) => ({
        ...app,
        locales: {
          en: { name: app.name, description: app.description || "" },
          "zh-cn": { name: app.name, description: app.description || "" },
        },
      }));
    }
  },
  onMessage: (envelope) => {
  const message = episode.receive(envelope);
  if (!message) return;
  if (message.type === "episode.content") acceptEpisode(message.utterances);
  if (message.type === "chat.media") {
      elements.chatStatus.textContent = "";
      elements.generateImage.disabled = false;
      elements.generateVideo.disabled = false;
      if (typeof message.url === "string") appendGeneratedMedia(message.mediaType, message.url);
  }
  if (message.type === "chat.mediaError") {
      elements.chatStatus.textContent = typeof message.error === "string" ? message.error : copy.tryAgain;
      elements.generateImage.disabled = false;
      elements.generateVideo.disabled = false;
  }
  if (message.type === "episode.game" && pendingAction) void openConfiguredApp(message.gameConfig);
  if (message.type === "episode.fixedGameResult") completeHostedConfiguredApp(message.result);
  if (message.type === "episode.gameResolved") completeHostedConfiguredApp(message.result, message.utterances);
  if (message.type === "episode.error") showError();
  },
});
