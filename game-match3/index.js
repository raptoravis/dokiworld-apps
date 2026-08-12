import {
  applyMatch3Move,
  areAdjacent,
  createMatch3State,
  createSeededRandom,
} from "./engine.js";
import { createAppClient } from "@dokiworld/app-sdk";
import { createGameResult } from "@dokiworld/app-sdk/game-result";

const GAME_ID = "game-match3";
const MAX_SCORE = 100;
const DEFAULTS = {
  rows: 7,
  columns: 7,
  timeLimit: 60,
  targetScore: 600,
  moves: null,
  seed: null,
  presentation: "default",
};
const BANQUET_ORDERS = [
  { kind: "heart", target: 12 },
  { kind: "charm", target: 12 },
  { kind: "performance", target: 12 },
];
const BANQUET_THRESHOLDS = [10, 20, 40];
const RYAN_SPEECH_THRESHOLDS = [15, 25, 50];
const BANQUET_BOOSTERS = ["single", "row", "column", "kind", "shuffle"];
const PARTICLE_COLORS = {
  performance: "#ffad3d",
  intelligence: "#42d1ff",
  charm: "#bd65ff",
  physique: "#61e3ad",
  heart: "#ff5a8c",
};
const COPY = {
  en: {
    title: "Heartline Match",
    instructions: "Swap neighboring candies. Match three or more before time runs out.",
    score: "Score {value}",
    scoreLabel: "Score",
    target: "Target {value}",
    moves: "{value} moves left",
    movesLabel: "Moves",
    time: "{value} seconds left",
    board: "Match-three game board",
    cascade: "Sweet Cascade",
    goalLabel: "Goal:",
    goal: "Convince your best friend nothing happened last night.",
    ryanSpeechGoal: "Complete the “perfect” speech Ryan will use tonight.",
    orders: "Collected",
    boosters: "Boosters",
    boosterToolbar: "Locked match-three boosters",
    boosterLocked: {
      single: "Noir Drop is locked in this level.",
      row: "Velvet Sweep is locked in this level.",
      column: "Midnight Pour is locked in this level.",
      kind: "Essence Recall is locked in this level.",
      shuffle: "Banquet Remix is locked in this level.",
    },
    restart: "Restart",
    instructionLong: "Match any 3 or more identical items. Score as high as you can in 10 moves—no special pattern is required.",
    ryanSpeechInstructionLong: "Complete Ryan’s “perfect” speech in 10 moves and score as high as possible.",
    standardClear: "Pass",
    greatClear: "Good",
    perfectClear: "Perfect",
    finish: { great: "Perfect!", good: "Lovely!", poor: "Sweet start!" },
    kinds: { performance: "Amber candy", intelligence: "Blue candy", charm: "Violet candy", physique: "Mint candy", heart: "Heart candy" },
  },
  "zh-cn": {
    title: "心意连线",
    instructions: "交换相邻糖果，在时间结束前连成三个或更多。",
    score: "得分 {value}",
    scoreLabel: "得分",
    target: "目标 {value}",
    moves: "剩余 {value} 步",
    movesLabel: "步数",
    time: "剩余 {value} 秒",
    board: "三消游戏棋盘",
    cascade: "甜蜜连击",
    goalLabel: "目标：",
    goal: "让你最好的朋友相信昨晚什么都没发生。",
    ryanSpeechGoal: "完成Ryan今晚使用的“完美”演讲稿。",
    orders: "已收集",
    boosters: "道具",
    boosterToolbar: "尚未解锁的三消道具",
    boosterLocked: {
      single: "黑曜点破在本关尚未解锁。",
      row: "丝绒横扫在本关尚未解锁。",
      column: "午夜纵流在本关尚未解锁。",
      kind: "香调召回在本关尚未解锁。",
      shuffle: "宴会重调在本关尚未解锁。",
    },
    restart: "重新开始",
    instructionLong: "任意连成三个或更多相同物品即可得分。限定 10 步，不要求特殊消除图案，尽可能获得高分。",
    ryanSpeechInstructionLong: "限定10步，完成Ryan今晚使用的“完美”演讲稿，看最高获得多少分。",
    standardClear: "合格",
    greatClear: "良好",
    perfectClear: "Perfect",
    finish: { great: "完美！", good: "真不错！", poor: "甜蜜开场！" },
    kinds: { performance: "琥珀糖果", intelligence: "蓝色糖果", charm: "紫色糖果", physique: "薄荷糖果", heart: "爱心糖果" },
  },
};

const elements = {
  game: document.querySelector("#game"), title: document.querySelector("#game-title"), instructions: document.querySelector("#instructions"),
  score: document.querySelector("#score"), target: document.querySelector("#target"), moves: document.querySelector("#moves"),
  timer: document.querySelector("#timer"), timerBar: document.querySelector("#timer span"), board: document.querySelector("#board"),
  playfield: document.querySelector(".match3-playfield"), effects: document.querySelector("#effects"), combo: document.querySelector("#combo"),
  gain: document.querySelector("#gain"), celebration: document.querySelector("#celebration"),
  celebrationTitle: document.querySelector("#celebration-title"), celebrationScore: document.querySelector("#celebration-score"),
  banquetGoalLabel: document.querySelector("#banquet-goal-label"), banquetGoal: document.querySelector("#banquet-goal"),
  banquetMovesLabel: document.querySelector("#banquet-moves-label"), banquetMoves: document.querySelector("#banquet-moves"),
  banquetOrdersTitle: document.querySelector("#banquet-orders-title"), banquetOrderList: document.querySelector("#banquet-order-list"),
  banquetBoostersTitle: document.querySelector("#banquet-boosters-title"), banquetBoosterList: document.querySelector("#banquet-booster-list"),
  banquetScoreLabel: document.querySelector("#banquet-score-label"),
  banquetScore: document.querySelector("#banquet-score"), banquetScoreFill: document.querySelector("#banquet-score-fill"),
  banquetStandardClear: document.querySelector("#banquet-standard-clear"), banquetGreatClear: document.querySelector("#banquet-great-clear"),
  banquetPerfectClear: document.querySelector("#banquet-perfect-clear"), banquetInstructions: document.querySelector("#banquet-instructions"),
  restart: document.querySelector("#restart"),
};

const dokiworld = createAppClient({
  appId: GAME_ID,
  extensions: ["resize", "progress", "checkpoint"],
});
let locale = "en";
let copy = COPY.en;
let config = { ...DEFAULTS };
let random = Math.random;
let state = null;
let selected = null;
let busy = false;
let finished = false;
let startedAt = 0;
let timer = 0;
let pointerStart = null;
let suppressClick = false;
let tiles = [];
let nextTileId = 0;
let invalidPositions = new Set();
let orderProgress = new Map();

const SWAP_MS = 170;
const POP_MS = 230;
const FALL_MS = 260;
const SHAKE_MS = 520;

function clamp(value, fallback, minimum, maximum) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(maximum, Math.max(minimum, Math.round(number))) : fallback;
}

function configure(options = {}) {
  config = {
    rows: clamp(options.rows, 7, 4, 8), columns: clamp(options.columns, 7, 4, 9),
    timeLimit: clamp(options.timeLimit, 60, 5, 180), targetScore: clamp(options.targetScore, 600, 100, 10000),
    moves: Number.isFinite(Number(options.moves)) ? clamp(options.moves, 12, 1, 60) : null,
    seed: Number.isFinite(Number(options.seed)) ? Number(options.seed) : null,
    presentation: options.presentation === "banquet-contract" ? "banquet-contract" : "default",
    banquetLevel: options.banquetLevel === "ryan-speech" ? "ryan-speech" : "lily-cover-story",
  };
  random = config.seed === null ? Math.random : createSeededRandom(config.seed);
}

function sleep(milliseconds) { return new Promise((resolve) => window.setTimeout(resolve, milliseconds)); }
function positionKey(position) { return `${position.row}:${position.column}`; }
function tileAt(position) {
  return tiles.find((tile) => tile.row === position.row && tile.column === position.column);
}

function cellButton(position) {
  const tile = tileAt(position);
  return tile ? elements.board.querySelector(`[data-tile-id="${tile.id}"]`) : null;
}

function formatNumber(value) {
  return Number(value).toLocaleString(locale === "zh-cn" ? "zh-CN" : "en-US");
}

function normalizedScore(score) {
  return Math.min(MAX_SCORE, Math.round((score / config.targetScore) * MAX_SCORE));
}

function banquetPoints(score) {
  return Math.max(0, Math.floor(score / 10));
}

function banquetThresholds() {
  return config.banquetLevel === "ryan-speech"
    ? RYAN_SPEECH_THRESHOLDS
    : BANQUET_THRESHOLDS;
}

function renderOrders() {
  elements.banquetOrderList.replaceChildren(...BANQUET_ORDERS.map(({ kind, target }) => {
    const current = Math.min(target, orderProgress.get(kind) ?? 0);
    const order = document.createElement("div");
    order.className = `match3-order${current >= target ? " is-complete" : ""}`;
    const image = document.createElement("img");
    image.src = `./banquet-perfume-${kind}.png`;
    image.alt = copy.kinds[kind];
    const progress = document.createElement("span");
    progress.textContent = `${current} / ${target}`;
    order.append(image, progress);
    return order;
  }));
}

function renderLockedBoosters() {
  elements.banquetBoosterList.setAttribute("aria-label", copy.boosterToolbar);
  elements.banquetBoosterList.replaceChildren(...BANQUET_BOOSTERS.map((booster) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "match3-booster is-locked";
    button.dataset.booster = booster;
    button.disabled = true;
    button.setAttribute("aria-label", copy.boosterLocked[booster]);
    const image = document.createElement("img");
    image.src = "./banquet-booster-locked.png";
    image.alt = "";
    button.append(image);
    return button;
  }));
}

function renderBanquetHud(score) {
  const movesLeft = config.moves === null ? 0 : Math.max(0, config.moves - state.movesUsed);
  const points = banquetPoints(score);
  const thresholds = banquetThresholds();
  elements.banquetMoves.textContent = formatNumber(movesLeft);
  elements.banquetScore.textContent = formatNumber(points);
  elements.banquetScore.classList.toggle("is-qualified", points >= thresholds[0]);
  elements.banquetScoreFill.style.height =
    `${Math.min(100, (points / thresholds[thresholds.length - 1]) * 100)}%`;
  document.querySelectorAll(".match3-score-ladder li").forEach((tier) => {
    const threshold = Number(tier.dataset.threshold);
    tier.classList.toggle("is-reached", points >= threshold);
    tier.classList.toggle(
      "is-current",
      points >= threshold && !thresholds.some((candidate) => candidate > threshold && points >= candidate),
    );
  });
  renderOrders();
}

function renderHud(score = state.score) {
  elements.score.textContent = copy.score.replace("{value}", formatNumber(score));
  elements.target.textContent = copy.target.replace("{value}", formatNumber(config.targetScore));
  elements.moves.hidden = config.moves === null;
  if (config.moves !== null) elements.moves.textContent = copy.moves.replace("{value}", Math.max(0, config.moves - state.movesUsed));
  if (config.presentation === "banquet-contract") renderBanquetHud(score);
}

function makeTile(kind, row, column, entering = false) {
  nextTileId += 1;
  return { id: nextTileId, kind, row, column, clearing: false, entering, falling: false };
}

function createTileElement(tile) {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.tileId = String(tile.id);
  button.setAttribute("role", "gridcell");
  button.innerHTML = '<span class="match3-candy" aria-hidden="true"></span>';
  button.addEventListener("click", () => {
    if (suppressClick) { suppressClick = false; return; }
    const current = tiles.find((item) => item.id === tile.id);
    if (current) void choose({ row: current.row, column: current.column }, false);
  });
  button.addEventListener("pointerdown", (event) => beginSwipe(event, tile.id));
  button.addEventListener("pointermove", updateSwipe);
  button.addEventListener("pointerup", endSwipe);
  button.addEventListener("pointercancel", cancelSwipe);
  return button;
}

function tileTransform(tile) {
  let dx = 0;
  let dy = 0;
  if (pointerStart?.tileId === tile.id) {
    dx = pointerStart.dx;
    dy = pointerStart.dy;
  } else if (pointerStart?.neighborId === tile.id) {
    dx = -pointerStart.dx;
    dy = -pointerStart.dy;
  }
  return `translate(calc(${tile.column * 100}% + ${dx}px), calc(${tile.row * 100}% + ${dy}px))`;
}

function syncTiles(score = state.score) {
  renderHud(score);
  elements.board.style.setProperty("--columns", config.columns);
  elements.board.style.setProperty("--rows", config.rows);
  elements.board.setAttribute("aria-label", copy.board);
  const liveIds = new Set(tiles.map((tile) => String(tile.id)));
  elements.board.querySelectorAll(".match3-tile").forEach((button) => {
    if (!liveIds.has(button.dataset.tileId)) button.remove();
  });
  for (const tile of tiles) {
    let button = elements.board.querySelector(`[data-tile-id="${tile.id}"]`);
    if (!button) {
      button = createTileElement(tile);
      elements.board.append(button);
    }
    const position = { row: tile.row, column: tile.column };
    const key = positionKey(position);
    button.className = `match3-tile is-${tile.kind}${selected && positionKey(selected) === key ? " is-selected" : ""}${invalidPositions.has(key) ? " is-invalid" : ""}${tile.clearing ? " is-clearing" : ""}${tile.entering ? " is-entering" : ""}${tile.falling ? " is-falling" : ""}${pointerStart?.tileId === tile.id ? " is-dragging" : ""}${pointerStart?.neighborId === tile.id ? " is-drag-target" : ""}`;
    button.dataset.row = String(tile.row);
    button.dataset.column = String(tile.column);
    button.dataset.kind = tile.kind;
    button.style.transform = tileTransform(tile);
    button.setAttribute("aria-pressed", selected && positionKey(selected) === key ? "true" : "false");
    button.setAttribute("aria-disabled", busy ? "true" : "false");
    button.setAttribute("aria-label", `${copy.kinds[tile.kind]}, ${Math.max(0, tile.row) + 1}, ${tile.column + 1}`);
  }
}

function beginSwipe(event, tileId) {
  if (busy || finished || event.button !== 0) return;
  const tile = tiles.find((item) => item.id === tileId);
  if (!tile) return;
  event.currentTarget.setPointerCapture(event.pointerId);
  pointerStart = {
    tileId,
    position: { row: tile.row, column: tile.column },
    pointerId: event.pointerId,
    x: event.clientX,
    y: event.clientY,
    target: null,
    neighborId: null,
    dx: 0,
    dy: 0,
  };
}

function dragTarget(position, deltaX, deltaY, threshold) {
  if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < threshold) return null;
  const target = { ...position };
  if (Math.abs(deltaX) > Math.abs(deltaY)) target.column += deltaX > 0 ? 1 : -1;
  else target.row += deltaY > 0 ? 1 : -1;
  return target.row >= 0 && target.row < config.rows && target.column >= 0 && target.column < config.columns ? target : null;
}

function clearDragVisuals() {
  pointerStart = null;
  syncTiles();
}

function updateSwipe(event) {
  if (!pointerStart || pointerStart.pointerId !== event.pointerId || busy || finished) return;
  const button = event.currentTarget;
  const deltaX = event.clientX - pointerStart.x;
  const deltaY = event.clientY - pointerStart.y;
  const cellSize = button.getBoundingClientRect().width;
  const limit = cellSize;
  const horizontal = Math.abs(deltaX) > Math.abs(deltaY);
  pointerStart.dx = horizontal ? Math.max(-limit, Math.min(limit, deltaX)) : 0;
  pointerStart.dy = horizontal ? 0 : Math.max(-limit, Math.min(limit, deltaY));
  pointerStart.target = dragTarget(pointerStart.position, deltaX, deltaY, 1);
  pointerStart.neighborId = pointerStart.target ? tileAt(pointerStart.target)?.id ?? null : null;
  syncTiles();
  event.preventDefault();
}

function cancelSwipe() {
  clearDragVisuals();
}

function endSwipe(event) {
  if (!pointerStart || pointerStart.pointerId !== event.pointerId || busy || finished) {
    cancelSwipe();
    return;
  }
  const position = pointerStart.position;
  const deltaX = event.clientX - pointerStart.x;
  const deltaY = event.clientY - pointerStart.y;
  const cellSize = event.currentTarget.getBoundingClientRect().width;
  const moved = Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3;
  const target = pointerStart.target ?? dragTarget(position, deltaX, deltaY, cellSize * .45);
  const enough = target && Math.max(Math.abs(deltaX), Math.abs(deltaY)) >= cellSize * .45;
  clearDragVisuals();
  if (moved) {
    suppressClick = true;
    window.setTimeout(() => { suppressClick = false; }, 350);
  }
  if (!enough || !target) return;
  selected = position;
  void choose(target, true);
}

function drawSwapTrail(firstButton, secondButton) {
  const fieldRect = elements.playfield.getBoundingClientRect();
  const firstRect = firstButton.getBoundingClientRect();
  const secondRect = secondButton.getBoundingClientRect();
  const startX = firstRect.left - fieldRect.left + firstRect.width / 2;
  const startY = firstRect.top - fieldRect.top + firstRect.height / 2;
  const endX = secondRect.left - fieldRect.left + secondRect.width / 2;
  const endY = secondRect.top - fieldRect.top + secondRect.height / 2;
  const trail = document.createElement("i");
  trail.className = "match3-swap-trail";
  trail.style.left = `${startX}px`;
  trail.style.top = `${startY}px`;
  trail.style.width = `${Math.hypot(endX - startX, endY - startY)}px`;
  trail.style.setProperty("--angle", `${Math.atan2(endY - startY, endX - startX)}rad`);
  elements.effects.append(trail);
  window.setTimeout(() => trail.remove(), 420);
}

function createBurst(position, kind) {
  const button = cellButton(position);
  if (!button) return;
  const fieldRect = elements.playfield.getBoundingClientRect();
  const rect = button.getBoundingClientRect();
  const x = rect.left - fieldRect.left + rect.width / 2;
  const y = rect.top - fieldRect.top + rect.height / 2;
  const color = PARTICLE_COLORS[kind] ?? "#ffffff";
  const ring = document.createElement("i");
  ring.className = "match3-ring";
  ring.style.left = `${x}px`;
  ring.style.top = `${y}px`;
  ring.style.setProperty("--ring-color", color);
  elements.effects.append(ring);
  const flare = document.createElement("i");
  flare.className = "match3-flare";
  flare.style.left = `${x}px`;
  flare.style.top = `${y}px`;
  flare.style.setProperty("--flare-color", color);
  elements.effects.append(flare);
  for (let index = 0; index < 9; index += 1) {
    const particle = document.createElement("i");
    const angle = (Math.PI * 2 * index) / 9 + (position.row + position.column) * 0.17;
    const distance = 34 + ((index * 13 + position.row * 7) % 30);
    particle.className = "match3-particle";
    particle.style.left = `${x}px`;
    particle.style.top = `${y}px`;
    particle.style.setProperty("--dx", `${Math.cos(angle) * distance}px`);
    particle.style.setProperty("--dy", `${Math.sin(angle) * distance}px`);
    particle.style.setProperty("--spin", `${index % 2 ? 220 : -190}deg`);
    particle.style.setProperty("--size", `${5 + (index % 4) * 2}px`);
    particle.style.setProperty("--particle-color", index % 3 === 0 ? "#fff2bd" : color);
    elements.effects.append(particle);
  }
  window.setTimeout(() => {
    ring.remove();
    flare.remove();
    elements.effects.querySelectorAll(".match3-particle:not(.celebration-particle)").forEach((item) => item.remove());
  }, 720);
}

function createScoreFly(position, points, delay) {
  const button = cellButton(position);
  if (!button) return;
  const fieldRect = elements.playfield.getBoundingClientRect();
  const rect = button.getBoundingClientRect();
  const fly = document.createElement("b");
  fly.className = "match3-score-fly";
  fly.textContent = `+${points}`;
  fly.style.left = `${rect.left - fieldRect.left + rect.width / 2}px`;
  fly.style.top = `${rect.top - fieldRect.top + rect.height / 2}px`;
  fly.style.setProperty("--score-delay", `${delay}ms`);
  elements.effects.append(fly);
  window.setTimeout(() => fly.remove(), 980 + delay);
}

function showGain(scoreGained) {
  elements.gain.hidden = true;
  void elements.gain.offsetWidth;
  elements.gain.textContent = `+${scoreGained}`;
  elements.gain.hidden = false;
  window.setTimeout(() => { elements.gain.hidden = true; }, 850);
}

function showCombo(cascades) {
  if (cascades <= 1) return;
  elements.combo.hidden = true;
  void elements.combo.offsetWidth;
  elements.combo.innerHTML = `${copy.cascade} <strong>x${cascades}</strong>`;
  elements.combo.hidden = false;
  window.setTimeout(() => { elements.combo.hidden = true; }, 940);
}

function popScore() {
  elements.score.classList.remove("is-popping");
  void elements.score.offsetWidth;
  elements.score.classList.add("is-popping");
  window.setTimeout(() => elements.score.classList.remove("is-popping"), 380);
}

function swapTilePositions(first, second) {
  const firstTile = tileAt(first);
  const secondTile = tileAt(second);
  if (!firstTile || !secondTile) return;
  [firstTile.row, secondTile.row] = [secondTile.row, firstTile.row];
  [firstTile.column, secondTile.column] = [secondTile.column, firstTile.column];
}

async function choose(position, fromDrag = false) {
  if (busy || finished) return;
  if (!selected) { selected = position; syncTiles(); return; }
  if (positionKey(selected) === positionKey(position)) { selected = null; syncTiles(); return; }
  if (!areAdjacent(selected, position)) { selected = position; syncTiles(); return; }

  const previous = selected;
  const move = applyMatch3Move(state, previous, position, random);
  const firstButton = cellButton(previous);
  const secondButton = cellButton(position);
  if (firstButton && secondButton) drawSwapTrail(firstButton, secondButton);
  selected = null;
  busy = true;
  invalidPositions = new Set();

  if (!move.valid) {
    if (!fromDrag) {
      swapTilePositions(previous, position);
      syncTiles();
      await sleep(SWAP_MS);
      swapTilePositions(previous, position);
      syncTiles();
    }
    invalidPositions = new Set([positionKey(previous), positionKey(position)]);
    syncTiles();
    await sleep(SHAKE_MS);
    invalidPositions = new Set();
    busy = false;
    syncTiles();
    return;
  }

  swapTilePositions(previous, position);
  syncTiles();
  if (!fromDrag) await sleep(SWAP_MS);

  let shownScore = state.score;
  for (const step of move.steps) {
    const matchedKeys = new Set(step.matched.map(positionKey));
    for (const [index, match] of step.matched.entries()) {
      const matchedTile = tileAt(match);
      if (!matchedTile) continue;
      createBurst(match, matchedTile.kind);
      createScoreFly(match, 10 * step.cascadeIndex, index * 24);
      if (orderProgress.has(matchedTile.kind)) {
        orderProgress.set(matchedTile.kind, (orderProgress.get(matchedTile.kind) ?? 0) + 1);
      }
      matchedTile.clearing = true;
    }
    syncTiles(shownScore);
    elements.board.classList.remove("is-impacting");
    void elements.board.offsetWidth;
    elements.board.classList.add("is-impacting");
    shownScore += step.scoreGained;
    renderHud(shownScore);
    showGain(step.scoreGained);
    showCombo(step.cascadeIndex);
    popScore();
    await sleep(POP_MS);

    const survivors = tiles.filter((tile) => !matchedKeys.has(positionKey(tile)));
    const entering = [];
    for (let column = 0; column < config.columns; column += 1) {
      const columnSurvivors = survivors
        .filter((tile) => tile.column === column)
        .sort((first, second) => first.row - second.row);
      const survivorCount = columnSurvivors.length;
      columnSurvivors.forEach((tile, index) => {
        tile.row = config.rows - survivorCount + index;
        tile.clearing = false;
        tile.falling = true;
      });
      const newCount = config.rows - survivorCount;
      for (let index = 0; index < newCount; index += 1) {
        const tile = makeTile(step.boardAfter[index][column], index - newCount, column, true);
        tile.falling = true;
        entering.push(tile);
      }
    }
    tiles = [...survivors, ...entering];
    syncTiles(shownScore);
    await sleep(16);
    for (let column = 0; column < config.columns; column += 1) {
      entering.filter((tile) => tile.column === column).forEach((tile, index) => { tile.row = index; });
    }
    syncTiles(shownScore);
    await sleep(FALL_MS);
    tiles.forEach((tile) => { tile.entering = false; tile.falling = false; });
    syncTiles(shownScore);
  }

  state = move.state;
  for (const tile of tiles) {
    if (tile.row >= 0 && tile.row < config.rows) tile.kind = state.board[tile.row][tile.column];
  }
  busy = false;
  syncTiles();
  elements.board.classList.remove("is-impacting");
  if (config.moves !== null && state.movesUsed >= config.moves) await finish();
}

function scatterCelebration() {
  const rect = elements.playfield.getBoundingClientRect();
  for (let index = 0; index < 42; index += 1) {
    const particle = document.createElement("i");
    const angle = (Math.PI * 2 * index) / 42;
    const distance = 110 + (index % 7) * 24;
    particle.className = "match3-particle celebration-particle";
    particle.style.left = `${rect.width / 2}px`;
    particle.style.top = `${rect.height / 2}px`;
    particle.style.setProperty("--dx", `${Math.cos(angle) * distance}px`);
    particle.style.setProperty("--dy", `${Math.sin(angle) * distance}px`);
    particle.style.setProperty("--spin", `${index % 2 ? 440 : -390}deg`);
    particle.style.setProperty("--size", `${6 + (index % 5) * 2}px`);
    particle.style.setProperty("--particle-color", Object.values(PARTICLE_COLORS)[index % 5]);
    elements.effects.append(particle);
  }
}

async function finish() {
  if (finished) return;
  finished = true;
  window.clearInterval(timer);
  const normalized = normalizedScore(state.score);
  const verdict = normalized >= 80 ? "great" : normalized >= 40 ? "good" : "poor";
  const displayedPoints = config.presentation === "banquet-contract"
    ? banquetPoints(state.score)
    : state.score;
  elements.board.classList.add("is-complete");
  elements.celebrationTitle.textContent = copy.finish[verdict];
  elements.celebrationScore.textContent =
    copy.score.replace("{value}", formatNumber(displayedPoints));
  elements.celebration.hidden = false;
  scatterCelebration();
  await sleep(1250);
  await dokiworld.complete(createCurrentResult(normalized >= MAX_SCORE ? "win" : "loss"));
}

function createCurrentResult(outcome = "exited") {
  const displayedPoints = config.presentation === "banquet-contract"
    ? banquetPoints(state.score)
    : state.score;
  return createGameResult({
    normalizedScore: normalizedScore(state.score),
    outcome,
    metrics: {
      points: displayedPoints,
      cleared: state.cleared,
      moves: state.movesUsed,
      bestCascade: state.bestCascade,
    },
  });
}

function applyStaticCopy() {
  const isRyanSpeech = config.banquetLevel === "ryan-speech";
  const thresholds = banquetThresholds();
  elements.title.textContent = copy.title;
  elements.instructions.textContent = copy.instructions;
  elements.banquetGoalLabel.textContent = copy.goalLabel;
  elements.banquetGoal.textContent = isRyanSpeech ? copy.ryanSpeechGoal : copy.goal;
  elements.banquetMovesLabel.textContent = copy.movesLabel;
  elements.banquetOrdersTitle.textContent = copy.orders;
  elements.banquetBoostersTitle.textContent = copy.boosters;
  renderLockedBoosters();
  elements.banquetScoreLabel.textContent = copy.scoreLabel;
  elements.banquetStandardClear.textContent = copy.standardClear;
  elements.banquetGreatClear.textContent = copy.greatClear;
  elements.banquetPerfectClear.textContent = copy.perfectClear;
  elements.banquetInstructions.textContent = isRyanSpeech
    ? copy.ryanSpeechInstructionLong
    : copy.instructionLong;
  document.querySelectorAll(".match3-score-ladder li").forEach((tier, index) => {
    const threshold = thresholds[index];
    tier.dataset.threshold = String(threshold);
    tier.querySelector("strong").textContent = String(threshold);
  });
  elements.restart.setAttribute("aria-label", copy.restart);
}

function start() {
  finished = false; busy = false; selected = null; pointerStart = null; suppressClick = false;
  state = createMatch3State({ rows: config.rows, columns: config.columns }, random);
  orderProgress = new Map(BANQUET_ORDERS.map(({ kind }) => [kind, 0]));
  nextTileId = 0;
  invalidPositions = new Set();
  tiles = state.board.flatMap((row, rowIndex) => row.map((kind, columnIndex) => (
    makeTile(kind, rowIndex, columnIndex)
  )));
  applyStaticCopy();
  elements.celebration.hidden = true;
  elements.combo.hidden = true;
  elements.gain.hidden = true;
  elements.effects.replaceChildren();
  elements.board.classList.remove("is-impacting", "is-complete");
  elements.timer.classList.remove("is-urgent");
  elements.timerBar.style.width = "100%";
  document.body.dataset.presentation = config.presentation;
  document.documentElement.lang = locale;
  syncTiles();
  startedAt = performance.now();
  window.clearInterval(timer);
  timer = window.setInterval(() => {
    const left = Math.max(0, config.timeLimit * 1000 - (performance.now() - startedAt));
    elements.timerBar.style.width = `${left / (config.timeLimit * 10)}%`;
    elements.timer.classList.toggle("is-urgent", left <= config.timeLimit * 200);
    elements.timer.setAttribute("aria-label", copy.time.replace("{value}", Math.ceil(left / 1000)));
    if (left <= 0 && !busy) void finish();
  }, 200);
  dokiworld.send("dokiworld-app-resize", { height: Math.min(760, Math.max(520, elements.game.scrollHeight + 32)) });
}

elements.restart.addEventListener("click", () => {
  if (!dokiworld.runId) return;
  window.clearInterval(timer);
  start();
});

dokiworld.connect({
  onInit: ({ locale: nextLocale, input }) => {
  locale = String(nextLocale).toLowerCase().startsWith("zh") ? "zh-cn" : "en";
  copy = COPY[locale];
  configure(input.data?.options);
  start();
  },
  onPrepareExit: () => ({
    isDirty: false,
    canSuspend: false,
    output: createCurrentResult("exited"),
  }),
});
