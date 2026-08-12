import {
  createAppClient,
  createAppHost,
} from "@dokiworld/app-sdk";
import { createEpisodeClientExtension } from "@dokiworld/app-sdk/episode";

const WORLD_ID = "banquet-contract";
const CHECKPOINT_CONTRACT = "doki.world.banquet-contract";
const CHECKPOINT_VERSION = 1;
const GAME_ID = "game-match3";
const SECOND_ACT_VIDEO_ONE_SCENE = 3;
const SECOND_ACT_VIDEO_TWO_SCENE = 4;
const SECOND_ACT_VIDEO_ONE_SUBTITLES = [
  [0, 7, 0],
  [7, 12, 1],
  [12, 18, 2],
  [18, 24, 3],
  [29, 36, 4],
  [36, 44, 5],
  [44, 51, 6],
  [51, 60, 7],
  [60, 69, 8],
  [69, 74, 9],
  [74, 81, 10],
  [81, 86, 11],
  [86, 93, 12],
  [93, 97, 13],
  [97, 105, 14],
  [105, 113, 15],
];
const SECOND_ACT_VIDEO_TWO_SUBTITLES = [
  [0, 6, 0],
  [6, 14, 1],
  [14, 19, 2],
  [19, 24, 3],
  [24, 32, 4],
  [32, 39, 5],
  [39, 47, 6],
  [47, 52, 7],
];
const WRITING_NOTE_REVEAL_START = 5;
const WRITING_NOTE_REVEAL_END = 7;
const WRITING_CHOICE_OPTION_IDS = new Set([
  "apologize-and-hide",
  "define-as-mistake",
]);
const COPY = {
  en: {
    coverEyebrow: "An original interactive romance",
    chapterTitle: "Female-Oriented Game Script, Act One: A Night Out of Control",
    coverIntro: "One wrong name. One dangerous stranger. One morning that turns an accident into a contract.",
    begin: "Begin the story",
    cardHover: "Click the card",
    coverCredit: "A Banquet Contract World",
    chapterLabel: "Act One: A Night Out of Control",
    secondActChapterLabel: "Act Two: Yesterday’s Memories",
    skip: "Skip ›",
    play: "Play video",
    pause: "Pause video",
    choiceEyebrow: "Your decision",
    choiceTitle: "But I can’t just disappear. I should leave him a note…",
    choiceNarration: "",
    choiceA: "Apologize and ask him to keep last night a secret.",
    choiceB: "Draw a firm line and define last night as an accident.",
    matchEyebrow: "",
    matchTitle: "Successfully steady Lily and keep her from discovering the “truth” about last night.",
    matchMoves: "10 moves",
    matchGoal: "Score as high as possible within 10 moves; Level 1 requires no specific match pattern.",
    secondActMatchTitle: "Complete the “perfect” speech Ryan will use tonight.",
    secondActMatchGoal: "Score as high as possible within 10 moves.",
    gameLoading: "Preparing the puzzle…",
    resultEyebrow: "Chapter result",
    secondActResultEyebrow: "Match-three result",
    points: "points",
    resultPerfectTitle: "Perfect",
    resultGoodTitle: "Good",
    resultPassTitle: "Pass",
    resultFailTitle: "Fail",
    resultLily: "Okay… get some rest. But call me later. I want the whole story.",
    secondActFeedbackPerfect: "Ryan reads it once, smiles, and says, “Perfect. I’ll use this tonight.”",
    secondActFeedbackGood: "Ryan nods. “This works. Give it one final polish before tonight.”",
    secondActFeedbackPass: "Ryan sets the draft down. “It will do, but the key lines still need tightening.”",
    secondActFeedbackFail: "Ryan shakes his head. “Not yet. The speech needs another rewrite.”",
    resultContinue: "Continue",
    resultRestart: "Restart",
    homeTitle: "Main interface",
    homeBackgroundNote: "Warm background scene (interior or exterior)",
    homeCharacterPlaceholder: "CHARACTER\nART",
    homePrimaryControlsLabel: "Companion controls",
    homeSecondaryControlsLabel: "Character and story controls",
    homeImmersiveCompanion: "IMMERSIVE\nCOMPANION",
    homeChangeBackground: "CHANGE\nBACKGROUND",
    homeChat: "CHAT",
    homePoke: "POKE",
    homeChangeOutfit: "CHANGE\nOUTFIT",
    homeContinueStory: "CONTINUE\nSTORY",
    secondActUnavailable: "Act Two video assets are not ready yet.",
    secondActChoiceA: "A complete stranger pretending to be my boyfriend? Absolutely not.",
    secondActChoiceB: "If it gets me through tonight… I’ll try it.",
    secondActVideo1: [
      "How did one stupid company event turn into all of this?",
      "Two weeks of overtime. Hundreds of guests. One final event.",
      "The project bonus will cover Dad’s next round of treatment.",
      "So no matter what happens tonight, I can’t afford to mess this up.",
      "Elena’s still working? God, hasn’t she been pulling crazy hours for almost two months now?",
      "Yeah. She looks exhausted. And apparently her ex, Ryan, is showing up tonight as the project lead and taking credit for the whole thing.",
      "Please. He only got that position because he hooked up with Vanessa—the CEO’s daughter. No way he would’ve gotten it otherwise.",
      "And I heard he was already chasing Vanessa while he was still with Elena. The second Vanessa took the bait, he dumped Elena and started telling everyone she was the one who’d been chasing him all along.",
      "Oh poor Elena, tonight’s going to be brutal for her. She has to watch her ex take credit for her work—and still smile at Vanessa because she needs that project bonus.",
      "At least Lily will be there.",
      "I can survive one night. Get the bonus, pay Dad’s medical bill, and move on.",
      "Elena, please don’t kill me.",
      "Something urgent came up. I can’t make it tonight. I’m so so sorry.",
      "But I have a backup plan!",
      "My cousin Alex just got back from London. He’s free tonight, and I asked him to accompany you.",
      "Just introduce him as your new boyfriend. I already told him to make sure you look damn good tonight.",
    ],
    secondActVideo2: [
      "Before you can even answer, Lily makes the decision for you.",
      "He’ll be waiting at the hotel entrance. Tall, dark hair, black suit. You can’t miss him.",
      "Love you! I’ve gotta go. Bye!",
      "Elena, one more thing before you leave.",
      "Vanessa has decided that Ryan will deliver the closing speech tonight on behalf of management.",
      "Since you know the project better than anyone, you’ll write the speech for him.",
      "Make it polished. Vanessa wants Ryan to sound like he led the project from the beginning.",
      "Send it to me before you leave for the hotel.",
    ],
    episodeEyebrow: "Interactive episode",
    episodeContinue: "Continue",
    episodeLoading: "Preparing the next episode…",
    episodeEnded: "This episode is complete.",
    episodeError: "The episode could not continue. Please try again.",
    episodeAuthenticationRequired: "Sign in to continue this episode.",
    episodeRetry: "Try again",
    writingChoicePrompt: "But I can’t just disappear. I should leave him a note…",
    characterPortrait: "Adrian character portrait",
    storyStage: "Interactive story",
    video1: [
      "Ugh... my head hurts. Where am I?",
      "Wait...is someone in the bathroom?",
      "Oh my God... Did I seriously sleep with Alex? Lily’s cousin? My best friend’s cousin?!",
      "How am I ever supposed to look Lily in the eye again? I’m officially the worst friend ever...",
      "I need to get the hell out of here before things get any more awkward.",
      "But I can’t just disappear. I should leave him a note…",
    ],
    video2Who: "Who's Alex?",
    video2Message: "Good morning, Mr. Sinclair. The three acquisition we discussed yesterday has been handled. Do you have any further instructions for today?",
    video2Order: "Pull every name from last night’s banquet, along with their full background. There’s someone I intend to find.",
    video2Final: "An accident? ...We'll see about that.",
    episodeText: {
      "episode-one-narration": "But I can’t just disappear. I should leave him a note…",
      "episode-one-a-line": "Alex: Last night was a huge mistake. I had way too much to drink. Please forget this ever happened, and absolutely do not tell Lily. I am so sorry!",
      "episode-one-b-line": "You clearly define last night as an accident, draw a firm boundary, and leave the note under the water glass.",
    },
    episodeChoices: {
      "apologize-and-hide": "Apologize and ask him to keep it a secret.",
      "define-as-mistake": "Draw a firm line and define last night as an accident.",
    },
    episodeChoiceNotes: {
      "apologize-and-hide": "Alex: Last night was a huge mistake. I had way too much to drink. Please forget this ever happened, and absolutely do not tell Lily. I am so sorry!",
      "define-as-mistake": "You clearly define last night as an accident, draw a firm boundary, and leave the note under the water glass.",
    },
  },
  "zh-cn": {
    coverEyebrow: "女性向沉浸式互动故事",
    chapterTitle: "女性向游戏剧本第一幕：一夜失控",
    coverIntro: "一个叫错的名字，一个危险的陌生人，一场被误认为意外的清晨。",
    begin: "开始故事",
    cardHover: "点击卡面",
    coverCredit: "Banquet Contract 原创 World",
    chapterLabel: "第一幕：一夜失控",
    secondActChapterLabel: "第二幕：昨日回忆",
    skip: "跳过 ›",
    play: "播放视频",
    pause: "暂停视频",
    choiceEyebrow: "你的选择",
    choiceTitle: "但我也不能就这么消失，至少该给他留张便条……",
    choiceNarration: "",
    choiceA: "表示抱歉，请他替你保密",
    choiceB: "划清界限，把昨晚定义为意外",
    matchEyebrow: "",
    matchTitle: "成功稳住Lily，不让Lily发现昨晚的“真相”",
    matchMoves: "限定10步",
    matchGoal: "限定10步，看最高获得几分（第一关不做特定的消除图案要求）",
    secondActMatchTitle: "完成Ryan今晚使用的“完美”演讲稿。",
    secondActMatchGoal: "限定10步，看最高获得多少分。",
    gameLoading: "正在准备三消关卡…",
    resultEyebrow: "第一章结果",
    secondActResultEyebrow: "三消结算画面",
    points: "分",
    resultPerfectTitle: "Perfect",
    resultGoodTitle: "良好",
    resultPassTitle: "合格",
    resultFailTitle: "未通过",
    resultLily: "好吧……你先休息。不过晚点一定要打给我，我要听完整经过。",
    secondActFeedbackPerfect: "Ryan读完后满意地点头：“很完美，今晚就用这一版。”",
    secondActFeedbackGood: "Ryan点点头：“这版能用，今晚之前再润色一下。”",
    secondActFeedbackPass: "Ryan放下演讲稿：“勉强能用，但关键句还需要再收紧。”",
    secondActFeedbackFail: "Ryan摇了摇头：“还不行，这份演讲稿需要重写。”",
    resultContinue: "继续",
    resultRestart: "重新开始",
    homeTitle: "主界面",
    homeBackgroundNote: "背景是温馨场景（室内室外都可）",
    homeCharacterPlaceholder: "这是立绘",
    homePrimaryControlsLabel: "陪伴功能",
    homeSecondaryControlsLabel: "角色与剧情功能",
    homeImmersiveCompanion: "沉浸\n陪伴",
    homeChangeBackground: "更换\n背景",
    homeChat: "闲\n聊",
    homePoke: "戳\n戳",
    homeChangeOutfit: "换\n装",
    homeContinueStory: "继续\n剧情",
    secondActUnavailable: "第二幕视频资源尚未就绪。",
    secondActChoiceA: "让一个完全不认识的人假装我男朋友？绝对不行。",
    secondActChoiceB: "如果这样能让我撑过今晚……我可以试试。",
    secondActVideo1: [
      "一场该死的公司活动，怎么会变成现在这样？",
      "连续加班两个星期，几百名嘉宾，最后这一场活动。",
      "这个项目的奖金，正好能够支付爸爸下一阶段的治疗费。",
      "所以无论今晚发生什么，我都绝不能把事情搞砸。",
      "Elena还在加班？天呐，她是不是已经疯狂加班快2个月了？",
      "是啊，我看她最近可憔悴了，但是我听说啊，她前男友Ryan要作为这个项目的负责人出席呢，还把功劳都揽到了自己身上！",
      "啧啧啧，他也就是傍上了总裁的女儿Vanessa，不然负责人的位置怎么会轮得到他。",
      "我还听说啊，他是还在和Elena谈的时候就费尽心思去勾搭Vanessa了，一傍上之后立马说之前都是Elena倒贴他呢！",
      "那今晚的活动，Elena岂不是很容易难堪？眼看着前男友要拿属于自己的荣誉和成果，但是为了项目奖金，还得对Vanessa笑脸相迎。",
      "至少Lily之前说会和我一起参加活动，陪我渡过今晚。",
      "我只需要撑过这一晚。拿到奖金，交上爸爸的治疗费，然后彻底向前走。",
      "Elena，你先答应不要杀了我。",
      "我临时遇到了一件急事，今晚去不了了。真的非常抱歉。",
      "但是我准备了一个补救方案！",
      "我表哥Alex刚从伦敦回来。他今晚正好有空，我已经拜托他陪你参加晚宴了。",
      "你就把他介绍成你的新男朋友。我已经告诉他要替你好好撑一撑今晚的场面！",
    ],
    secondActVideo2: [
      "还没等你回复，Lily已经最终拍板了。",
      "就这么定了！他会在酒店门口等你。个子很高，深色头发，穿黑色西装。你绝对不会认错。",
      "爱你哦！我有事先挂了！",
      "Elena，你离开前还有一件事。",
      "Vanessa临时决定，由Ryan代表管理层发表今晚的闭幕演讲。",
      "既然你比任何人都了解这个项目，他的演讲稿就由你来写。",
      "把稿子写得漂亮一点。Vanessa希望Ryan听起来像是从一开始就在领导这个项目。",
      "去酒店之前发给我。",
    ],
    episodeEyebrow: "互动剧集",
    episodeContinue: "继续",
    episodeLoading: "正在准备下一段剧情…",
    episodeEnded: "本集剧情已结束。",
    episodeError: "剧情暂时无法继续，请重试。",
    episodeAuthenticationRequired: "请先登录，再继续本集剧情。",
    episodeRetry: "重试",
    writingChoicePrompt: "但我也不能就这么消失，至少该给他留张便条……",
    characterPortrait: "Adrian 角色立绘",
    storyStage: "互动剧情",
    video1: [
      "嘶……头好痛，我这是在哪？",
      "等等……浴室怎么有人……？",
      "天哪……我居然真的和Alex睡了？Lily的表哥？我最好朋友的表哥？！",
      "我以后还怎么面对Lily啊？我简直是史上最差劲的朋友……",
      "我得在事情变得更尴尬前赶紧开溜。",
      "但我也不能就这么消失，至少该给他留张便条……",
    ],
    video2Who: "谁是Alex？",
    video2Message: "早上好，Sinclair 先生。昨天讨论的三项收购已经处理完毕。您今天还有其他指示吗？",
    video2Order: "把昨晚宴会所有人的名单和详细背景都调出来。有个人，我一定要找到。",
    video2Final: "只是一场意外？……我们后会有期。",
    episodeText: {
      "episode-one-narration": "但我也不能就这么消失，至少该给他留张便条……",
      "episode-one-a-line": "Alex：昨晚只是个意外，非常抱歉，我喝太多了。请你务必把这件事忘掉，千万不要告诉莉莉！真的很对不起！",
      "episode-one-b-line": "你把昨晚清楚地定义为一场意外，划下界限，然后把纸条压在水杯下。",
    },
    episodeChoices: {
      "apologize-and-hide": "表示抱歉，请他替你保密",
      "define-as-mistake": "划清界限，把昨晚定义为意外",
    },
    episodeChoiceNotes: {
      "apologize-and-hide": "Alex：昨晚只是个意外，非常抱歉，我喝太多了。请你务必把这件事忘掉，千万不要告诉莉莉！真的很对不起！",
      "define-as-mistake": "你把昨晚清楚地定义为一场意外，划下界限，然后把纸条压在水杯下。",
    },
  },
};

const screens = new Map(
  [...document.querySelectorAll(".screen")].map((screen) => [screen.id, screen]),
);
const world = document.querySelector("#world");
const storyVideos = [...document.querySelectorAll(".story-video")];
let storyVideo = document.querySelector("#story-video");
const storyOverlay = document.querySelector("#story-overlay");
const progressFill = document.querySelector("#cinema-progress-fill");
const videoBackdrop = document.querySelector(".video-backdrop");
const videoToggle = document.querySelector("#video-toggle");
const videoControlLabel = document.querySelector("[data-video-control-label]");
const chapterLabel = document.querySelector(".cinema-topline [data-copy='chapterLabel']");
const skipVideo = document.querySelector("#skip-video");
const matchFrame = document.querySelector("#match-game");
const gameLoading = document.querySelector("#game-loading");
const matchTitle = document.querySelector("#match-title");
const matchGoal = document.querySelector(".match-objective b");
const episodeTitle = document.querySelector("#episode-title");
const episodeContent = document.querySelector("#episode-content");
const episodeContinue = document.querySelector("#episode-continue");
const episodeRetry = document.querySelector("#episode-retry");
const homeCanvas = document.querySelector(".home-canvas");
const homeContinueStory = document.querySelector("#home-continue-story");
const resultEyebrow = document.querySelector("#result-screen .eyebrow");
const resultMessage = document.querySelector("#result-screen .result-message");
const resultFeedbackAvatar = resultMessage.querySelector(".result-avatar");
const resultFeedbackText = resultMessage.querySelector("p");
const resultActionButton = document.querySelector("#result-continue");
const resultActionLabel = resultActionButton.querySelector("[data-copy]");
const resultActionIcon = resultActionButton.querySelector("i");
const homePrimaryControls = document.querySelector(".home-controls-left");
const homeSecondaryControls = document.querySelector(".home-controls-right");
const worldCharacterArt = document.querySelector("#world-character-art");
const worldCharacterPanel = document.querySelector("#world-character-panel");
const worldStoryStage = document.querySelector("#world-story-stage");
const videoChoiceOverlay = document.querySelector("#video-choice-overlay");
const videoChoicePrompt = document.querySelector("#video-choice-prompt");
const videoChoiceList = document.querySelector("#video-choice-list");
const videoNoteOverlay = document.querySelector("#video-note-overlay");
const videoNoteCopy = document.querySelector("#video-note-copy");

let locale = "en";
let copy = COPY.en;
const dokiworld = createAppClient({
  appId: WORLD_ID,
  extensions: ["world", "episode", "checkpoint"],
});
const episode = createEpisodeClientExtension(dokiworld);
let phase = "cover";
let sceneNumber = 0;
let choice = "A";
let gameRunId = "";
let acceptedGameResult = false;
let secondActActive = false;
let initialized = false;
let media = null;
let experience = null;
let episodeMode = false;
let episodeStarted = false;
let episodeWaiting = false;
let episodeQueue = [];
let activeGameId = GAME_ID;
let activeGameConfig = null;
let preparedGameId = "";
let preparedGameRunId = "";
let gameFrameReady = false;
let activeGameHost = null;
let writingChoiceItem = null;
let writingChoiceAwaitingContinuation = false;
let playWritingVideoAfterChoice = false;
let selectedWritingNote = "";
let hasSelectedWritingNote = false;
let latestResult = null;

function setPhase(nextPhase) {
  const nextScreenId = `${nextPhase}-screen`;
  const activeElement = document.activeElement;
  const focusedScreen = activeElement instanceof HTMLElement
    ? activeElement.closest(".screen")
    : null;
  const shouldMoveFocus = focusedScreen && focusedScreen.id !== nextScreenId;

  if (shouldMoveFocus && activeElement instanceof HTMLElement) {
    activeElement.blur();
  }

  phase = nextPhase;
  world.dataset.phase = nextPhase;
  for (const [id, screen] of screens) {
    const isActive = id === nextScreenId;
    screen.classList.toggle("is-active", isActive);
    screen.inert = !isActive;
    screen.setAttribute("aria-hidden", isActive ? "false" : "true");
  }

  if (shouldMoveFocus) {
    const nextScreen = screens.get(nextScreenId);
    nextScreen
      ?.querySelector("button:not([disabled]):not([hidden]), input:not([disabled]):not([hidden]), iframe")
      ?.focus();
  }
}

function applyCopy() {
  document.documentElement.lang = locale;
  document.title = locale === "zh-cn" ? "Banquet Contract · 一夜失控" : "Banquet Contract · A Night Out of Control";
  document.querySelectorAll("[data-copy]").forEach((element) => {
    const key = element.dataset.copy;
    if (typeof copy[key] === "string") element.textContent = copy[key];
  });
  worldCharacterPanel.setAttribute("aria-label", copy.characterPortrait);
  worldStoryStage.setAttribute("aria-label", copy.storyStage);
  homePrimaryControls.setAttribute("aria-label", copy.homePrimaryControlsLabel);
  homeSecondaryControls.setAttribute("aria-label", copy.homeSecondaryControlsLabel);
  syncResultAction();
  syncSecondActAvailability();
  syncVideoControl();
}

function syncResultAction() {
  const restartsStory = phase === "result" && secondActActive;
  resultActionLabel.textContent = restartsStory
    ? copy.resultRestart
    : copy.resultContinue;
  resultActionIcon.textContent = restartsStory ? "↻" : "›";
}

function syncVideoControl() {
  const isPlaying = !storyVideo.paused && !storyVideo.ended;
  videoToggle.dataset.playing = String(isPlaying);
  videoToggle.setAttribute("aria-pressed", String(isPlaying));
  videoControlLabel.textContent = isPlaying ? copy.pause : copy.play;
}

function prepareStoryVideo(src, preferredVideo = null) {
  if (typeof src !== "string" || !src) return null;
  const preparedVideo = storyVideos.find(
    (video) => video.getAttribute("src") === src,
  );
  if (preparedVideo) {
    preparedVideo.preload = "auto";
    return preparedVideo;
  }
  const targetVideo = storyVideos.includes(preferredVideo)
    ? preferredVideo
    : storyVideos.find((video) => video !== storyVideo) || storyVideo;
  targetVideo.pause();
  targetVideo.preload = "auto";
  targetVideo.removeAttribute("poster");
  targetVideo.src = src;
  targetVideo.load();
  return targetVideo;
}

function waitForStoryVideoFrame(video) {
  if (
    video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
    && video.videoWidth > 0
  ) {
    return Promise.resolve(true);
  }
  return new Promise((resolve) => {
    let timeoutId = 0;
    const finish = (ready) => {
      window.clearTimeout(timeoutId);
      video.removeEventListener("loadeddata", onReady);
      video.removeEventListener("canplay", onReady);
      video.removeEventListener("error", onError);
      resolve(ready);
    };
    const onReady = () => finish(true);
    const onError = () => finish(false);
    video.addEventListener("loadeddata", onReady, { once: true });
    video.addEventListener("canplay", onReady, { once: true });
    video.addEventListener("error", onError, { once: true });
    timeoutId = window.setTimeout(() => {
      finish(
        video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
        && video.videoWidth > 0,
      );
    }, 12_000);
  });
}

function seekStoryVideo(video, currentTime) {
  const targetTime = Number.isFinite(currentTime) ? Math.max(0, currentTime) : 0;
  if (Math.abs(video.currentTime - targetTime) < 0.05) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    let timeoutId = 0;
    const finish = () => {
      window.clearTimeout(timeoutId);
      video.removeEventListener("seeked", finish);
      resolve();
    };
    video.addEventListener("seeked", finish, { once: true });
    try {
      video.currentTime = targetTime;
    } catch {
      finish();
      return;
    }
    timeoutId = window.setTimeout(finish, 2_000);
  });
}

async function activateStoryVideo(
  src,
  { currentTime = 0, poster = "" } = {},
) {
  const previousVideo = storyVideo;
  const nextVideo = prepareStoryVideo(src);
  if (!nextVideo) return false;
  if (poster) nextVideo.poster = poster;
  else nextVideo.removeAttribute("poster");
  const hasFrame = await waitForStoryVideoFrame(nextVideo);
  if (!hasFrame) return false;
  await seekStoryVideo(nextVideo, currentTime);
  if (previousVideo !== nextVideo) {
    nextVideo.classList.add("is-active");
    nextVideo.setAttribute("aria-hidden", "false");
    previousVideo.classList.remove("is-active");
    previousVideo.setAttribute("aria-hidden", "true");
    storyVideo = nextVideo;
    previousVideo.pause();
  }
  return true;
}

function preloadConfiguredStoryVideos() {
  if (!media) return;
  prepareStoryVideo(media.video1, storyVideos[0]);
  prepareStoryVideo(media.video2, storyVideos[1]);
}

async function playStoryVideoWithSound() {
  storyVideo.muted = false;
  try {
    await storyVideo.play();
    return true;
  } catch {
    storyVideo.pause();
    syncVideoControl();
    return false;
  }
}

function readMedia(candidate) {
  if (!candidate || typeof candidate !== "object") return null;
  const video1 = candidate.video1;
  const video2 = candidate.video2;
  const secondActVideo1 = typeof candidate.secondActVideo1 === "string"
    ? candidate.secondActVideo1.trim()
    : "";
  const secondActVideo2 = typeof candidate.secondActVideo2 === "string"
    ? candidate.secondActVideo2.trim()
    : "";
  if (
    typeof video1 !== "string"
    || typeof video2 !== "string"
    || !video1.trim()
    || !video2.trim()
  ) return null;
  return {
    video1,
    video2,
    ...(secondActVideo1 ? { secondActVideo1 } : {}),
    ...(secondActVideo2 ? { secondActVideo2 } : {}),
  };
}

function readExperience(candidate) {
  if (!candidate || typeof candidate !== "object") return null;
  const characterId = typeof candidate.characterId === "string"
    ? candidate.characterId.trim()
    : "";
  const title = typeof candidate.title === "string" ? candidate.title.trim() : "";
  const description = typeof candidate.description === "string"
    ? candidate.description.trim()
    : "";
  const portraitUrl = readSafeMediaUrl(candidate.portraitUrl);
  if (!characterId || !title) return null;
  return { characterId, title, description, portraitUrl };
}

function readSafeMediaUrl(value) {
  if (typeof value !== "string" || !value.trim()) return "";
  try {
    const resolved = new URL(value, document.baseURI);
    const documentOrigin = new URL(document.baseURI).origin;
    return resolved.protocol === "https:" || resolved.origin === documentOrigin
      ? resolved.href
      : "";
  } catch {
    return "";
  }
}

function postEpisodeEvent(event) {
  if (!dokiworld.runId || !episodeMode) return;
  episode.send(event);
}

function postWorldEvent(type, payload = {}) {
  if (!dokiworld.runId) return;
  dokiworld.send(type, payload);
}

function publishCheckpoint(checkpoint) {
  postWorldEvent("dokiworld-app-checkpoint", { checkpoint });
}

function checkpointText(value, maxLength = 4_000) {
  return typeof value === "string" ? value.slice(0, maxLength) : "";
}

function checkpointNumber(value, minimum, maximum) {
  return Number.isFinite(value)
    ? Math.min(maximum, Math.max(minimum, Math.floor(value)))
    : undefined;
}

function checkpointGameConfig(value) {
  if (!value || typeof value !== "object") return null;
  const gameType = ["external", "builtin", "match3"].includes(value.gameType)
    ? value.gameType
    : "external";
  const gameId = typeof value.gameId === "string"
    && /^[a-z0-9][a-z0-9-]{0,127}$/.test(value.gameId)
    ? value.gameId
    : "";
  const configId = checkpointText(value.configId, 128);
  const presentation = value.presentation === "modal" || value.presentation === "inline"
    ? value.presentation
    : undefined;
  const numericFields = [
    "maxScore",
    "rows",
    "columns",
    "cols",
    "moves",
    "targetScore",
    "target",
    "seed",
    "rounds",
    "timeLimit",
  ];
  const config = {
    gameType,
    ...(gameId ? { gameId } : {}),
    ...(configId ? { configId } : {}),
    ...(presentation ? { presentation } : {}),
  };
  for (const field of numericFields) {
    const number = checkpointNumber(value[field], 0, 10_000_000);
    if (number !== undefined) config[field] = number;
  }
  return config;
}

function checkpointEpisodeItem(value) {
  if (!value || typeof value !== "object" || !value.segment || typeof value.segment !== "object") {
    return null;
  }
  const segment = value.segment;
  const type = [
    "dialogue",
    "action",
    "thought",
    "narration",
    "image",
    "video",
    "choice",
    "choices",
    "game",
    "unknown",
  ].includes(segment.type) ? segment.type : "unknown";
  const options = Array.isArray(segment.options)
    ? segment.options.slice(0, 20).flatMap((option) => {
        if (!option || typeof option !== "object") return [];
        const id = checkpointText(option.id, 128);
        const label = checkpointText(option.label, 1_000);
        if (!id || !label) return [];
        const nextBeatId = checkpointText(option.nextBeatId, 128);
        return [{ id, label, ...(nextBeatId ? { nextBeatId } : {}) }];
      })
    : undefined;
  const assetId = checkpointText(segment.assetId, 128);
  const rawMediaUrl = assetId === "video-night-one" || assetId === "video-who-is-alex"
    ? ""
    : readSafeMediaUrl(segment.mediaUrl);
  const gameConfig = checkpointGameConfig(segment.gameConfig);
  return {
    speakerName: checkpointText(value.speakerName, 200),
    segment: {
      type,
      text: checkpointText(segment.text),
      ...(checkpointText(segment.id, 128) ? { id: checkpointText(segment.id, 128) } : {}),
      ...(checkpointText(segment.beatId, 128) ? { beatId: checkpointText(segment.beatId, 128) } : {}),
      ...(assetId ? { assetId } : {}),
      ...(rawMediaUrl ? { mediaUrl: rawMediaUrl } : {}),
      ...(checkpointText(segment.caption, 2_000) ? { caption: checkpointText(segment.caption, 2_000) } : {}),
      ...(checkpointText(segment.completion, 64) ? { completion: checkpointText(segment.completion, 64) } : {}),
      ...(options ? { options } : {}),
      ...(segment.allowFreeText === true ? { allowFreeText: true } : {}),
      ...(gameConfig ? { gameConfig } : {}),
    },
  };
}

function checkpointEpisodeItems(value) {
  return Array.isArray(value)
    ? value.slice(0, 200).flatMap((item) => {
        const checkpointItem = checkpointEpisodeItem(item);
        return checkpointItem ? [checkpointItem] : [];
      })
    : [];
}

function hydrateCheckpointItem(item) {
  const hydrated = checkpointEpisodeItem(item);
  if (!hydrated) return null;
  if (hydrated.segment.assetId === "video-night-one" && media?.video1) {
    hydrated.segment.mediaUrl = media.video1;
  } else if (hydrated.segment.assetId === "video-who-is-alex" && media?.video2) {
    hydrated.segment.mediaUrl = media.video2;
  }
  return hydrated;
}

function checkpointEnvelope(screen, current = undefined) {
  return {
    contract: CHECKPOINT_CONTRACT,
    version: CHECKPOINT_VERSION,
    data: {
      screen,
      queue: checkpointEpisodeItems(episodeQueue),
      ...(current !== undefined ? { current } : {}),
    },
  };
}

function clearCheckpoint() {
  world.dataset.checkpointState = "clearing";
  postWorldEvent("dokiworld-app-checkpoint-clear");
}

function checkpointResult(value) {
  if (
    !value
    || typeof value !== "object"
    || !Number.isFinite(value.points)
    || !Number.isFinite(value.gradePoints)
    || value.points < 0
    || value.gradePoints < 0
  ) return null;
  return {
    points: Math.floor(value.points),
    gradePoints: Math.floor(value.gradePoints),
    secondAct: value.secondAct === true,
  };
}

function restoreCheckpoint(candidate) {
  if (!candidate || typeof candidate !== "object") return false;
  if (
    candidate.contract === CHECKPOINT_CONTRACT
    && candidate.version === CHECKPOINT_VERSION
    && candidate.data
    && typeof candidate.data === "object"
  ) {
    const checkpointData = candidate.data;
    episodeQueue = checkpointEpisodeItems(checkpointData.queue)
      .map(hydrateCheckpointItem)
      .filter(Boolean);
    episodeStarted = episodeMode;
    preloadNextEpisodeVideo();
    preloadNextEpisodeGame();
    if (checkpointData.screen === "lily-transition" && episodeMode) {
      renderNextEpisodeSegment();
      return true;
    }
    if (checkpointData.screen === "episode-text" && episodeMode) {
      const lines = checkpointEpisodeItems(checkpointData.current)
        .map(hydrateCheckpointItem)
        .filter(Boolean);
      if (lines.length > 0) {
        showEpisodeText(lines, { persist: false });
        return true;
      }
    }
    if (checkpointData.screen === "episode-image" && episodeMode) {
      const item = hydrateCheckpointItem(checkpointData.current);
      if (item?.segment.type === "image" && item.segment.mediaUrl) {
        renderEpisodeImage(item, { persist: false });
        return true;
      }
    }
    if (checkpointData.screen === "result" || checkpointData.screen === "home") {
      const result = checkpointResult(checkpointData.current);
      if (result) {
        acceptedGameResult = true;
        secondActActive = result.secondAct;
        if (checkpointData.screen === "home") showHome(result, { persist: false });
        else showResult({ metrics: result }, { persist: false });
        return true;
      }
    }
    clearCheckpoint();
    return false;
  }
  if (candidate.kind === "episode-complete" && episodeMode) {
    // Banquet Contract only completes after its configured game result.
    // Older broken continuations persisted this generic terminal state and
    // would otherwise trap the player here on every refresh.
    clearCheckpoint();
    return false;
  }
  if (candidate.kind === "lily-transition") {
    startGame();
    return true;
  }
  if (
    candidate.kind === "result"
    && Number.isFinite(candidate.points)
    && Number.isFinite(candidate.gradePoints)
    && candidate.points >= 0
    && candidate.gradePoints >= 0
  ) {
    acceptedGameResult = true;
    episodeStarted = episodeMode;
    showResult({
      metrics: {
        points: Math.floor(candidate.points),
        gradePoints: Math.floor(candidate.gradePoints),
      },
    }, { persist: false });
    return true;
  }
  return false;
}

function postWorldError(code) {
  if (!dokiworld.runId) return;
  dokiworld.send("dokiworld-app-world-error", { code });
}

function initialize(
  nextLocale,
  nextMedia = null,
  nextExperience = null,
  nextCheckpoint = null,
) {
  if (initialized) return;
  const resolvedMedia = readMedia(nextMedia);
  const resolvedExperience = readExperience(nextExperience);
  if (dokiworld.runId && !resolvedMedia && !resolvedExperience) {
    postWorldError("world_media_unavailable");
    return;
  }
  initialized = true;
  media = resolvedMedia;
  experience = resolvedExperience;
  episodeMode = Boolean(resolvedExperience);
  world.dataset.mode = episodeMode ? "episode" : "legacy";
  if (experience) {
    world.dataset.worldCardId = experience.characterId;
  } else {
    delete world.dataset.worldCardId;
  }
  locale = String(nextLocale).toLowerCase().startsWith("zh") ? "zh-cn" : "en";
  copy = COPY[locale];
  applyCopy();
  if (experience) {
    document.title = `${experience.title} · Banquet Contract`;
  }
  preloadConfiguredStoryVideos();
  if (!restoreCheckpoint(nextCheckpoint)) setPhase("cover");
}

function overlayMarkup(text) {
  if (!text) return "";
  return `<p class="subtitle">${text}</p>`;
}

function episodeItemsFrom(utterances) {
  if (!Array.isArray(utterances)) return [];
  return utterances.flatMap((utterance) => {
    if (!utterance || typeof utterance !== "object" || !Array.isArray(utterance.segments)) {
      return [];
    }
    const speakerName = typeof utterance.speakerName === "string"
      ? utterance.speakerName.trim()
      : "";
    return utterance.segments
      .filter((segment) => segment && typeof segment === "object")
      .map((segment) => ({ segment: localizeEpisodeSegment(segment), speakerName }));
  });
}

function localizeEpisodeSegment(segment) {
  const localizedText = typeof segment.id === "string"
    ? copy.episodeText?.[segment.id]
    : "";
  const options = Array.isArray(segment.options)
    ? segment.options.map((option) => ({
        ...option,
        label: typeof option?.id === "string"
          ? copy.episodeChoices?.[option.id] || option.label
          : option?.label,
      }))
    : segment.options;
  return {
    ...segment,
    ...(localizedText ? { text: localizedText } : {}),
    ...(Array.isArray(options) ? { options } : {}),
  };
}

function setWritingChoiceState(active) {
  world.dataset.writingChoice = String(active);
}

function showEpisodeWaiting() {
  world.dataset.episodeState = "waiting";
  setWritingChoiceState(false);
  episodeTitle.textContent = experience?.title || copy.episodeEyebrow;
  episodeContent.replaceChildren();
  const status = document.createElement("p");
  status.className = "episode-line narration";
  status.textContent = copy.episodeLoading;
  episodeContent.append(status);
  episodeContinue.classList.add("is-hidden");
  episodeRetry.classList.add("is-hidden");
  setPhase("episode");
}

function showEpisodeEnd() {
  world.dataset.episodeState = "complete";
  setWritingChoiceState(false);
  episodeTitle.textContent = experience?.title || copy.episodeEyebrow;
  episodeContent.replaceChildren();
  const message = document.createElement("p");
  message.className = "episode-line narration";
  message.textContent = copy.episodeEnded;
  episodeContent.append(message);
  episodeContinue.classList.add("is-hidden");
  episodeRetry.classList.add("is-hidden");
  setPhase("episode");
  // Do not persist this generic fallback. The authored Banquet flow ends at
  // the result screen; an empty queue before that indicates an incomplete
  // continuation response and must remain recoverable after refresh.
}

function showEpisodeText(lines, { persist = true } = {}) {
  world.dataset.episodeState = "active";
  const firstSpeaker = lines.find((item) => item.speakerName)?.speakerName;
  episodeTitle.textContent = firstSpeaker || experience?.title || copy.episodeEyebrow;
  episodeContent.replaceChildren();
  for (const { segment } of lines) {
    const line = document.createElement("p");
    line.className = `episode-line ${segment.type}`;
    line.textContent = typeof segment.text === "string" ? segment.text : "";
    episodeContent.append(line);
  }
  episodeContinue.classList.remove("is-hidden");
  episodeRetry.classList.add("is-hidden");
  setPhase("episode");
  if (persist) {
    publishCheckpoint(checkpointEnvelope(
      "episode-text",
      checkpointEpisodeItems(lines),
    ));
  }
}

function renderEpisodeText() {
  const lines = [];
  while (episodeQueue.length > 0) {
    const next = episodeQueue[0];
    if (!["dialogue", "action", "thought", "narration"].includes(next.segment.type)) break;
    lines.push(episodeQueue.shift());
  }
  const visibleLines = lines.filter(
    (item) => item.segment.id !== "episode-two-lily-narration",
  );
  if (visibleLines.length === 0) {
    renderNextEpisodeSegment();
    return;
  }
  showEpisodeText(visibleLines);
}

function renderEpisodeImage(item, { persist = true } = {}) {
  world.dataset.episodeState = "active";
  episodeTitle.textContent = item.speakerName || experience?.title || copy.episodeEyebrow;
  episodeContent.replaceChildren();
  const image = document.createElement("img");
  image.className = "episode-image";
  image.src = item.segment.mediaUrl;
  image.alt = typeof item.segment.caption === "string" ? item.segment.caption : "";
  episodeContent.append(image);
  if (image.alt) {
    const caption = document.createElement("p");
    caption.className = "episode-line narration";
    caption.textContent = image.alt;
    episodeContent.append(caption);
  }
  episodeContinue.classList.remove("is-hidden");
  episodeRetry.classList.add("is-hidden");
  setPhase("episode");
  if (persist) {
    publishCheckpoint(checkpointEnvelope(
      "episode-image",
      checkpointEpisodeItem(item),
    ));
  }
}

function isWritingChoiceSegment(segment) {
  const options = Array.isArray(segment?.options) ? segment.options : [];
  return options.length === WRITING_CHOICE_OPTION_IDS.size
    && options.every((option) => WRITING_CHOICE_OPTION_IDS.has(option?.id));
}

function showWritingChoiceOverlay() {
  if (!writingChoiceItem) return;
  storyVideo.pause();
  storyOverlay.replaceChildren();
  skipVideo.disabled = true;
  setPhase("video");
  setWritingChoiceState(true);
  videoChoiceOverlay.classList.remove("is-hidden");
  videoChoiceList.querySelector("button")?.focus();
}

function renderEpisodeChoices(item) {
  const { segment } = item;
  const writingChoice = isWritingChoiceSegment(segment);
  videoChoicePrompt.hidden = false;
  setWritingChoiceState(false);
  writingChoiceItem = writingChoice ? item : null;
  videoChoicePrompt.textContent = writingChoice
    ? copy.writingChoicePrompt
    : typeof segment.text === "string"
      ? segment.text
      : copy.choiceTitle;
  videoChoiceList.replaceChildren();
  const options = Array.isArray(segment.options) ? segment.options : [];
  options.forEach((option, index) => {
    if (!option || typeof option.id !== "string" || typeof option.label !== "string") return;
    const button = document.createElement("button");
    button.className = "video-story-choice";
    button.type = "button";
    const marker = document.createElement("span");
    marker.className = "video-story-choice-marker";
    marker.textContent = String.fromCharCode(65 + index);
    const label = document.createElement("b");
    label.textContent = option.label;
    const optionCopy = document.createElement("span");
    optionCopy.className = "video-story-choice-copy";
    optionCopy.append(label);
    button.append(marker, optionCopy);
    button.addEventListener("click", () => {
      if (episodeWaiting) return;
      episodeWaiting = true;
      if (writingChoice) {
        writingChoiceAwaitingContinuation = true;
        selectedWritingNote = copy.episodeChoiceNotes?.[option.id] || "";
        hasSelectedWritingNote = true;
        videoNoteOverlay.dataset.noteMode = selectedWritingNote ? "text" : "unreadable";
        videoNoteCopy.textContent = selectedWritingNote;
      }
      button.classList.add("is-selected");
      videoChoiceList.querySelectorAll("button").forEach((choiceButton) => {
        choiceButton.disabled = true;
      });
      if (!episodeMode) {
        choice = index === 0 ? "A" : "B";
        episodeWaiting = false;
        writingChoiceAwaitingContinuation = false;
        writingChoiceItem = null;
        videoChoiceOverlay.classList.add("is-hidden");
        skipVideo.disabled = false;
        setWritingChoiceState(false);
        void playScene(2);
        return;
      }
      postEpisodeEvent({
        type: "episode.choice",
        beatId: segment.beatId,
        optionId: option.id,
      });
      if (writingChoice) return;
      window.setTimeout(() => {
        if (!episodeWaiting) return;
        videoChoiceOverlay.classList.add("is-hidden");
        showEpisodeWaiting();
      }, 140);
    });
    videoChoiceList.append(button);
  });
  if (writingChoice) {
    showWritingChoiceOverlay();
  } else {
    storyVideo.pause();
    storyOverlay.replaceChildren();
    skipVideo.disabled = true;
    setPhase("video");
    videoChoiceOverlay.classList.remove("is-hidden");
    videoChoiceList.querySelector("button")?.focus();
  }
}

function preloadNextEpisodeVideo() {
  const nextVideo = episodeQueue.find((item) => item.segment.type === "video");
  const src = typeof nextVideo?.segment.mediaUrl === "string"
    ? nextVideo.segment.mediaUrl
    : "";
  if (!src) return;
  prepareStoryVideo(src);
}

function preloadNextEpisodeGame() {
  const nextGame = episodeQueue.find((item) => item.segment.type === "game");
  const gameId = typeof nextGame?.segment.gameConfig?.gameId === "string"
    ? nextGame.segment.gameConfig.gameId.trim()
    : "";
  if (
    !/^[a-z0-9][a-z0-9-]{0,127}$/.test(gameId)
    || (
      preparedGameId === gameId
      && matchFrame.getAttribute("src")
    )
  ) return;
  preparedGameId = gameId;
  preparedGameRunId =
    `${WORLD_ID}:preload:${Date.now()}:${Math.random().toString(36).slice(2)}`;
  gameFrameReady = false;
  matchFrame.src =
    `/games/${gameId}/index.html?run=${encodeURIComponent(preparedGameRunId)}`;
}

function resetPreparedGame() {
  activeGameHost?.dispose();
  activeGameHost = null;
  preparedGameId = "";
  preparedGameRunId = "";
  gameFrameReady = false;
  matchFrame.removeAttribute("src");
}

async function playEpisodeVideo(item) {
  const segmentSrc = typeof item.segment.mediaUrl === "string" ? item.segment.mediaUrl : "";
  const src = playWritingVideoAfterChoice && typeof media?.video2 === "string"
    ? media.video2
    : segmentSrc;
  if (!src) {
    renderNextEpisodeSegment();
    return;
  }
  sceneNumber = item.segment.assetId === "video-night-one"
    ? 1
    : item.segment.assetId === "video-who-is-alex"
      ? 2
      : 0;
  chapterLabel.textContent = copy.chapterLabel;
  playWritingVideoAfterChoice = false;
  setPhase("video");
  setWritingChoiceState(false);
  skipVideo.disabled = false;
  videoChoiceOverlay.classList.add("is-hidden");
  const poster = sceneNumber > 0 ? `./ui/scene-${sceneNumber}.jpg` : "";
  videoBackdrop.style.backgroundImage = poster ? `url("${poster}")` : "";
  progressFill.style.width = "0";
  storyOverlay.replaceChildren();
  const activated = await activateStoryVideo(src, { currentTime: 0, poster });
  if (!activated) {
    storyVideo.pause();
    syncVideoControl();
    return;
  }
  storyVideo.muted = false;
  if (sceneNumber === 0 && item.segment.caption) {
    const caption = document.createElement("p");
    caption.className = "subtitle";
    caption.textContent = item.segment.caption;
    storyOverlay.append(caption);
  }
  await playStoryVideoWithSound();
}

function renderNextEpisodeSegment() {
  episodeWaiting = false;
  if (episodeQueue.length === 0) {
    showEpisodeEnd();
    return;
  }
  const item = episodeQueue.shift();
  const type = item.segment.type;
  if (["dialogue", "action", "thought", "narration"].includes(type)) {
    episodeQueue.unshift(item);
    renderEpisodeText();
  } else if (
    type === "image"
    && typeof item.segment.mediaUrl === "string"
  ) {
    renderEpisodeImage(item);
  } else if (type === "video") {
    void playEpisodeVideo(item);
  } else if (type === "choices") {
    renderEpisodeChoices(item);
  } else if (type === "game" && typeof item.segment.beatId === "string") {
    episodeWaiting = true;
    episodeContinue.classList.add("is-hidden");
    episodeRetry.classList.add("is-hidden");
    postEpisodeEvent({
      type: "episode.action",
      beatId: item.segment.beatId,
    });
  } else {
    renderNextEpisodeSegment();
  }
}

function acceptEpisodeUtterances(utterances) {
  let nextItems = episodeItemsFrom(utterances);
  const containsWritingChoice = nextItems.some(
    (item) => item.segment.type === "choices" && isWritingChoiceSegment(item.segment),
  );
  if (containsWritingChoice) {
    nextItems = nextItems.filter(
      (item) => item.segment.id !== "episode-one-narration",
    );
  }
  if (writingChoiceAwaitingContinuation) {
    nextItems = nextItems.filter(
      (item) => !["episode-one-a-line", "episode-one-b-line"].includes(item.segment.id),
    );
    writingChoiceAwaitingContinuation = false;
    playWritingVideoAfterChoice = true;
    writingChoiceItem = null;
    videoChoiceOverlay.classList.add("is-hidden");
    skipVideo.disabled = false;
    setWritingChoiceState(false);
  }
  episodeQueue = nextItems;
  episodeWaiting = false;
  preloadNextEpisodeVideo();
  preloadNextEpisodeGame();
  if (episodeStarted) renderNextEpisodeSegment();
}

function videoOverlayAt(time) {
  if (sceneNumber === 1) {
    const index = time < 3.1 ? 0 : time < 6 ? 1 : time < 10 ? 2 : time < 13.8 ? 3 : time < 17 ? 4 : 5;
    return overlayMarkup(copy.video1[index]);
  }

  if (sceneNumber === 2 && time >= 9 && time < 12.5) return overlayMarkup(copy.video2Who);
  if (sceneNumber === 2 && time >= 17 && time < 21.2) return overlayMarkup(copy.video2Message);
  if (sceneNumber === 2 && time >= 21.2 && time < 24.3) return overlayMarkup(copy.video2Order);
  if (sceneNumber === 2 && time >= 24.3) return overlayMarkup(copy.video2Final);
  if (sceneNumber === SECOND_ACT_VIDEO_ONE_SCENE) {
    const segment = SECOND_ACT_VIDEO_ONE_SUBTITLES.find(([start, end]) => time >= start && time < end);
    return segment ? overlayMarkup(copy.secondActVideo1[segment[2]]) : "";
  }
  if (sceneNumber === SECOND_ACT_VIDEO_TWO_SCENE) {
    const segment = SECOND_ACT_VIDEO_TWO_SUBTITLES.find(([start, end]) => time >= start && time < end);
    return segment ? overlayMarkup(copy.secondActVideo2[segment[2]]) : "";
  }
  return "";
}

function renderVideoFrame() {
  const duration = Number.isFinite(storyVideo.duration) ? storyVideo.duration : 15;
  progressFill.style.width = `${Math.min(100, (storyVideo.currentTime / duration) * 100)}%`;
  if (!videoChoiceOverlay.classList.contains("is-hidden")) {
    storyOverlay.replaceChildren();
    videoNoteOverlay.classList.add("is-hidden");
    return;
  }
  const showSelectedNote = (
    sceneNumber === 2
    && hasSelectedWritingNote
    && storyVideo.currentTime >= WRITING_NOTE_REVEAL_START
    && storyVideo.currentTime < WRITING_NOTE_REVEAL_END
  );
  videoNoteOverlay.classList.toggle("is-hidden", !showSelectedNote);
  if (episodeMode && sceneNumber === 0) return;
  storyOverlay.innerHTML = videoOverlayAt(storyVideo.currentTime);
}

function renderSecondActChoices() {
  storyVideo.pause();
  storyOverlay.replaceChildren();
  videoChoicePrompt.textContent = "";
  videoChoicePrompt.hidden = true;
  videoChoiceList.replaceChildren();
  [copy.secondActChoiceA, copy.secondActChoiceB].forEach((label, index) => {
    const button = document.createElement("button");
    button.className = "video-story-choice";
    button.type = "button";
    const marker = document.createElement("span");
    marker.className = "video-story-choice-marker";
    marker.textContent = String.fromCharCode(65 + index);
    const optionCopy = document.createElement("span");
    optionCopy.className = "video-story-choice-copy";
    const optionLabel = document.createElement("b");
    optionLabel.textContent = label;
    optionCopy.append(optionLabel);
    button.append(marker, optionCopy);
    button.addEventListener("click", () => {
      choice = index === 0 ? "A" : "B";
      videoChoiceList.querySelectorAll("button").forEach((choiceButton) => {
        choiceButton.disabled = true;
      });
      button.classList.add("is-selected");
      videoChoiceOverlay.classList.add("is-hidden");
      skipVideo.disabled = false;
      void playScene(SECOND_ACT_VIDEO_TWO_SCENE);
    });
    videoChoiceList.append(button);
  });
  skipVideo.disabled = true;
  setPhase("video");
  videoChoiceOverlay.classList.remove("is-hidden");
  videoChoiceList.querySelector("button")?.focus();
  syncVideoControl();
}

function finishScene() {
  if (writingChoiceAwaitingContinuation) return;
  storyVideo.pause();
  storyOverlay.replaceChildren();
  videoNoteOverlay.classList.add("is-hidden");
  if (sceneNumber === SECOND_ACT_VIDEO_ONE_SCENE) {
    renderSecondActChoices();
    return;
  }
  if (sceneNumber === SECOND_ACT_VIDEO_TWO_SCENE) {
    startSecondActGame();
    return;
  }
  if (episodeMode) {
    if (sceneNumber === 2) {
      selectedWritingNote = "";
      hasSelectedWritingNote = false;
    }
    renderNextEpisodeSegment();
    return;
  }
  if (sceneNumber === 1) {
    renderEpisodeChoices({
      segment: {
        type: "choices",
        beatId: "legacy-writing-choice",
        options: [
          { id: "apologize-and-hide", label: copy.choiceA },
          { id: "define-as-mistake", label: copy.choiceB },
        ],
      },
    });
  } else {
    startGame();
  }
}

async function playScene(number) {
  const src = number === SECOND_ACT_VIDEO_ONE_SCENE
    ? media?.secondActVideo1
    : number === SECOND_ACT_VIDEO_TWO_SCENE
      ? media?.secondActVideo2
      : media?.[`video${number}`];
  if (!src) {
    postWorldError("world_media_unavailable");
    return;
  }
  sceneNumber = number;
  chapterLabel.textContent = number === SECOND_ACT_VIDEO_ONE_SCENE
    || number === SECOND_ACT_VIDEO_TWO_SCENE
    ? copy.secondActChapterLabel
    : copy.chapterLabel;
  setPhase("video");
  const poster = `./ui/scene-${number}.jpg`;
  videoBackdrop.style.backgroundImage = `url("${poster}")`;
  progressFill.style.width = "0";
  storyOverlay.innerHTML = videoOverlayAt(0);
  const activated = await activateStoryVideo(src, { poster });
  if (!activated) {
    storyVideo.pause();
    syncVideoControl();
    return;
  }
  if (number === SECOND_ACT_VIDEO_ONE_SCENE && media?.secondActVideo2) {
    prepareStoryVideo(media.secondActVideo2);
  }
  storyVideo.muted = false;
  await playStoryVideoWithSound();
}

function banquetMatch3Config(config = {}) {
  return {
    ...config,
    presentation: "banquet-contract",
    rows: 8,
    columns: 9,
    moves: 10,
    timeLimit: 180,
    targetScore: 400,
    boostersUnlocked: false,
  };
}

function startGame() {
  matchTitle.textContent = copy.matchTitle;
  matchGoal.textContent = copy.matchGoal;
  activeGameId = GAME_ID;
  activeGameConfig = banquetMatch3Config();
  setPhase("match");
  acceptedGameResult = false;
  gameRunId = `${WORLD_ID}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
  gameLoading.classList.remove("is-hidden");
  matchFrame.src = `/games/${activeGameId}/index.html?run=${encodeURIComponent(gameRunId)}`;
}

function startSecondActGame() {
  matchTitle.textContent = copy.secondActMatchTitle;
  matchGoal.textContent = copy.secondActMatchGoal;
  activeGameId = GAME_ID;
  activeGameConfig = banquetMatch3Config({ banquetLevel: "ryan-speech" });
  setPhase("match");
  acceptedGameResult = false;
  gameRunId = `${WORLD_ID}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
  gameLoading.classList.remove("is-hidden");
  matchFrame.src = `/games/${activeGameId}/index.html?run=${encodeURIComponent(gameRunId)}`;
}

function startConfiguredGame(config) {
  const gameId = typeof config?.gameId === "string" ? config.gameId.trim() : "";
  if (!/^[a-z0-9][a-z0-9-]{0,127}$/.test(gameId)) {
    postWorldError("world_game_unavailable");
    return;
  }
  activeGameId = gameId;
  matchTitle.textContent = copy.matchTitle;
  matchGoal.textContent = copy.matchGoal;
  activeGameConfig = banquetMatch3Config(config);
  acceptedGameResult = false;
  const canReusePreparedFrame = (
    preparedGameId === gameId
    && preparedGameRunId
    && matchFrame.getAttribute("src")
  );
  gameRunId = canReusePreparedFrame
    ? preparedGameRunId
    : `${WORLD_ID}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
  gameLoading.classList.remove("is-hidden");
  setPhase("match");
  if (canReusePreparedFrame) {
    connectGameHost();
  } else {
    preparedGameId = gameId;
    preparedGameRunId = gameRunId;
    gameFrameReady = false;
    matchFrame.src =
      `/games/${activeGameId}/index.html?run=${encodeURIComponent(gameRunId)}`;
  }
}

function connectGameHost() {
  const target = matchFrame.contentWindow;
  if (!target || !activeGameId || !gameRunId) return;
  activeGameHost?.dispose();
  activeGameHost = createAppHost({
    appId: activeGameId,
    runId: gameRunId,
    target,
    targetOrigin: "*",
    expectedOrigin: "null",
    extensions: ["resize", "progress", "checkpoint"],
    init: {
      locale,
      grantedScopes: [],
      context: { schemaVersion: 1 },
      input: {
        contract: "doki.game.match3-input",
        version: 1,
        data: {
          options: activeGameConfig || banquetMatch3Config(),
        },
      },
    },
    outputs: [{ contract: "doki.game.result", version: 1 }],
  });
  activeGameHost.connect({
    onInitialized: () => {
      gameFrameReady = true;
      gameLoading.classList.add("is-hidden");
    },
    onComplete: async (output) => {
      if (acceptedGameResult || output.contract !== "doki.game.result") {
        return { status: "rejected", reason: "duplicate_or_invalid_result" };
      }
      acceptedGameResult = true;
      const result = output.data;
      if (episodeMode && !secondActActive) {
        showResult(result, { persist: false });
        postEpisodeEvent({
          type: "episode.gameResult",
          result,
          configId: activeGameConfig?.configId,
        });
      } else {
        showResult(result);
      }
      return { status: "accepted" };
    },
  });
}

matchFrame.addEventListener("load", () => {
  if (phase === "match") connectGameHost();
});

function resultPresentation(gradePoints) {
  const [passThreshold, goodThreshold, perfectThreshold] = secondActActive
    ? [15, 25, 50]
    : [10, 20, 40];
  if (gradePoints >= perfectThreshold) {
    return { gradeKey: "perfect", title: copy.resultPerfectTitle };
  }
  if (gradePoints >= goodThreshold) {
    return { gradeKey: "good", title: copy.resultGoodTitle };
  }
  if (gradePoints >= passThreshold) {
    return { gradeKey: "pass", title: copy.resultPassTitle };
  }
  return { gradeKey: "fail", title: copy.resultFailTitle };
}

function syncResultFeedback(gradeKey) {
  if (!secondActActive) {
    resultMessage.dataset.speaker = "lily";
    resultFeedbackAvatar.textContent = "L";
    resultFeedbackText.textContent = copy.resultLily;
    return;
  }

  const feedbackKey = {
    perfect: "secondActFeedbackPerfect",
    good: "secondActFeedbackGood",
    pass: "secondActFeedbackPass",
    fail: "secondActFeedbackFail",
  }[gradeKey];
  resultMessage.dataset.speaker = "ryan";
  resultFeedbackAvatar.textContent = "R";
  resultFeedbackText.textContent = copy[feedbackKey];
}

function showResult(result, { persist = true } = {}) {
  const rawPoints = Number(result?.metrics?.points);
  const rawGradePoints = Number(result?.metrics?.gradePoints);
  const displayedScore = Number.isFinite(rawPoints)
    ? rawPoints
    : 0;
  const points = Math.max(
    0,
    Math.floor(displayedScore),
  );
  const gradePoints = Number.isFinite(rawGradePoints)
    ? rawGradePoints
    : points;
  const normalizedGradePoints = Math.max(0, Math.floor(gradePoints));
  const { gradeKey, title } = resultPresentation(normalizedGradePoints);
  latestResult = { points, gradePoints: normalizedGradePoints, secondAct: secondActActive };

  document.querySelector("#result-score").textContent = String(points);
  document.querySelector("#result-title").textContent = title;
  document.querySelector("#result-seal").dataset.grade = gradeKey;
  resultEyebrow.textContent = secondActActive
    ? copy.secondActResultEyebrow
    : copy.resultEyebrow;
  resultMessage.classList.remove("is-hidden");
  syncResultFeedback(gradeKey);
  setPhase("result");
  syncResultAction();
  if (persist) {
    publishCheckpoint(checkpointEnvelope("result", {
      points,
      gradePoints: normalizedGradePoints,
      secondAct: secondActActive,
    }));
  }
}

function showHome(result = latestResult, { persist = true } = {}) {
  const normalized = checkpointResult(result);
  if (!normalized) return;
  latestResult = normalized;
  const { title } = resultPresentation(normalized.gradePoints);
  homeCanvas.dataset.score = String(normalized.points);
  homeCanvas.dataset.grade = title;
  setPhase("home");
  syncSecondActAvailability();
  if (media?.secondActVideo1) prepareStoryVideo(media.secondActVideo1);
  if (persist) publishCheckpoint(checkpointEnvelope("home", normalized));
}

function syncSecondActAvailability() {
  if (!homeContinueStory) return;
  const ready = Boolean(media?.secondActVideo1 && media?.secondActVideo2);
  homeContinueStory.disabled = !ready;
  homeContinueStory.dataset.mediaReady = String(ready);
  if (ready) {
    homeContinueStory.removeAttribute("title");
    homeContinueStory.removeAttribute("aria-description");
  } else {
    homeContinueStory.title = copy.secondActUnavailable;
    homeContinueStory.setAttribute("aria-description", copy.secondActUnavailable);
  }
}

function continueStory() {
  if (!media?.secondActVideo1 || !media?.secondActVideo2) {
    syncSecondActAvailability();
    return;
  }
  secondActActive = true;
  void playScene(SECOND_ACT_VIDEO_ONE_SCENE);
}

function beginStory() {
  clearCheckpoint();
  secondActActive = false;
  resultMessage.classList.remove("is-hidden");
  if (!episodeMode) {
    void playScene(1);
    return;
  }
  episodeStarted = true;
  postEpisodeEvent({ type: "episode.start" });
  if (episodeQueue.length > 0) renderNextEpisodeSegment();
  else showEpisodeWaiting();
}

function restartStory() {
  clearCheckpoint();
  choice = "A";
  secondActActive = false;
  latestResult = null;
  playWritingVideoAfterChoice = false;
  storyVideos.forEach((video, index) => {
    video.pause();
    video.removeAttribute("src");
    video.removeAttribute("poster");
    video.load();
    video.classList.toggle("is-active", index === 0);
    video.setAttribute("aria-hidden", index === 0 ? "false" : "true");
  });
  storyVideo = storyVideos[0];
  preloadConfiguredStoryVideos();
  sceneNumber = 0;
  gameRunId = "";
  episodeStarted = false;
  episodeWaiting = false;
  episodeQueue = [];
  activeGameId = GAME_ID;
  activeGameConfig = null;
  acceptedGameResult = false;
  writingChoiceItem = null;
  writingChoiceAwaitingContinuation = false;
  selectedWritingNote = "";
  hasSelectedWritingNote = false;
  setWritingChoiceState(false);
  delete world.dataset.episodeState;
  videoChoiceOverlay.classList.add("is-hidden");
  videoNoteOverlay.classList.add("is-hidden");
  storyOverlay.replaceChildren();
  progressFill.style.width = "0";
  resultMessage.classList.remove("is-hidden");
  resultEyebrow.textContent = copy.resultEyebrow;
  resetPreparedGame();
  if (episodeMode) postEpisodeEvent({ type: "episode.restart" });
  setPhase("cover");
  syncResultAction();
}

function handleResultAction() {
  if (secondActActive) {
    restartStory();
    return;
  }
  showHome();
}

document.querySelector("#begin-story").addEventListener("click", beginStory);
document.querySelector("#character-card-action").addEventListener("click", beginStory);
skipVideo.addEventListener("click", finishScene);
resultActionButton.addEventListener("click", handleResultAction);
homeContinueStory.addEventListener("click", continueStory);
episodeContinue.addEventListener("click", () => {
  renderNextEpisodeSegment();
});
episodeRetry.addEventListener("click", () => {
  if (episodeWaiting) return;
  episodeWaiting = true;
  showEpisodeWaiting();
  postEpisodeEvent({ type: "episode.start" });
});
videoToggle.addEventListener("click", async () => {
  if (storyVideo.paused || storyVideo.ended) {
    await playStoryVideoWithSound();
  } else {
    storyVideo.pause();
  }
});
storyVideos.forEach((video) => {
  video.addEventListener("play", () => {
    if (video !== storyVideo) return;
    if (world.dataset.writingChoice === "true") {
      video.pause();
      return;
    }
    syncVideoControl();
  });
  video.addEventListener("pause", () => {
    if (video === storyVideo) syncVideoControl();
  });
  video.addEventListener("timeupdate", () => {
    if (video === storyVideo) renderVideoFrame();
  });
  video.addEventListener("ended", () => {
    if (video === storyVideo) finishScene();
  });
  video.addEventListener("error", () => {
    if (phase === "video" && video === storyVideo) {
      video.pause();
      syncVideoControl();
    }
  });
});

document.querySelectorAll("[data-home-action]").forEach((button) => {
  button.addEventListener("click", () => {
    world.dispatchEvent(new CustomEvent("banquet:home-action", {
      detail: { action: button.dataset.homeAction },
    }));
  });
});

if (window.parent !== window) {
  dokiworld.connect({
    onInit: ({ locale: nextLocale, input }) => {
      const data = input.data && typeof input.data === "object" ? input.data : {};
      initialize(nextLocale, data.media, data.experience, data.checkpoint);
    },
    onMessage: (envelope) => {
      if (envelope.type === "dokiworld-app-checkpoint-cleared") {
        world.dataset.checkpointState = "cleared";
        return;
      }
      if (!episodeMode) return;
      const message = episode.receive(envelope);
      if (!message) return;
      if (message.type === "episode.resuming") {
        showEpisodeWaiting();
      } else if (message.type === "episode.content") {
        acceptEpisodeUtterances(message.utterances);
      } else if (message.type === "episode.game") {
        startConfiguredGame(message.gameConfig);
      } else if (message.type === "episode.fixedGameResult") {
        episodeWaiting = false;
        showResult(message.result);
      } else if (message.type === "episode.gameResolved") {
        acceptEpisodeUtterances(message.utterances);
      } else if (message.type === "episode.error") {
        episodeWaiting = false;
        world.dataset.episodeState = "error";
        episodeTitle.textContent = experience?.title || copy.episodeEyebrow;
        episodeContent.replaceChildren();
        const error = document.createElement("p");
        error.className = "episode-line narration";
        error.textContent = message.code === "authentication_required"
          ? copy.episodeAuthenticationRequired
          : copy.episodeError;
        episodeContent.append(error);
        episodeContinue.classList.add("is-hidden");
        episodeRetry.classList.remove("is-hidden");
        setPhase("episode");
      }
    },
  });
}

if (window.parent === window) {
  const requestedLocale = new URLSearchParams(window.location.search).get("locale") || navigator.language;
  initialize(requestedLocale);
} else {
  // createAppClient owns ready/init retries for embedded runs.
}
