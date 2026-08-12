// engine.js
var MATCH3_KINDS = ["performance", "intelligence", "charm", "physique", "heart"];
var TILE_SCORE = 10;
var MAX_GENERATION_ATTEMPTS = 80;
function pickKind(random2) {
  return MATCH3_KINDS[Math.floor(random2() * MATCH3_KINDS.length) % MATCH3_KINDS.length];
}
function createSeededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value += 1831565813;
    let next = value;
    next = Math.imul(next ^ next >>> 15, next | 1);
    next ^= next + Math.imul(next ^ next >>> 7, next | 61);
    return ((next ^ next >>> 14) >>> 0) / 4294967296;
  };
}
function createMatch3State(config2, random2 = Math.random) {
  let board = makeBoard(config2.rows, config2.columns, random2);
  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS && !hasValidMove(board); attempt += 1) {
    board = makeBoard(config2.rows, config2.columns, random2);
  }
  return { board, score: 0, movesUsed: 0, cleared: 0, bestCascade: 0 };
}
function areAdjacent(first, second) {
  return Math.abs(first.row - second.row) + Math.abs(first.column - second.column) === 1;
}
function findMatches(board) {
  const rows = board.length;
  const columns = board[0]?.length ?? 0;
  const matches = /* @__PURE__ */ new Map();
  const add = (row, column) => matches.set(`${row}:${column}`, { row, column });
  for (let row = 0; row < rows; row += 1) {
    let runStart = 0;
    for (let column = 1; column <= columns; column += 1) {
      if (column < columns && board[row][column] === board[row][runStart]) continue;
      if (column - runStart >= 3) for (let current = runStart; current < column; current += 1) add(row, current);
      runStart = column;
    }
  }
  for (let column = 0; column < columns; column += 1) {
    let runStart = 0;
    for (let row = 1; row <= rows; row += 1) {
      if (row < rows && board[row][column] === board[runStart][column]) continue;
      if (row - runStart >= 3) for (let current = runStart; current < row; current += 1) add(current, column);
      runStart = row;
    }
  }
  return [...matches.values()];
}
function swapMatch3Cells(board, first, second) {
  const next = board.map((row) => [...row]);
  const firstKind = next[first.row][first.column];
  next[first.row][first.column] = next[second.row][second.column];
  next[second.row][second.column] = firstKind;
  return next;
}
function applyMatch3Move(current, first, second, random2 = Math.random) {
  if (!areAdjacent(first, second) || !isInBounds(current.board, first) || !isInBounds(current.board, second)) return unchangedMove(current);
  let board = swapMatch3Cells(current.board, first, second);
  if (findMatches(board).length === 0) return unchangedMove(current);
  let cascades = 0;
  let scoreGained = 0;
  let cleared = 0;
  const steps = [];
  for (let guard = 0; guard < 100; guard += 1) {
    const matches = findMatches(board);
    if (matches.length === 0) break;
    cascades += 1;
    cleared += matches.length;
    const stepScore = matches.length * TILE_SCORE * cascades;
    scoreGained += stepScore;
    board = collapseBoard(board, matches, random2);
    steps.push({
      matched: matches,
      scoreGained: stepScore,
      cascadeIndex: cascades,
      boardAfter: board
    });
  }
  if (!hasValidMove(board)) board = makePlayableBoard(board.length, board[0]?.length ?? 0, random2);
  if (steps.length > 0) steps[steps.length - 1].boardAfter = board;
  return {
    valid: true,
    cascades,
    scoreGained,
    cleared,
    steps,
    state: {
      board,
      score: current.score + scoreGained,
      movesUsed: current.movesUsed + 1,
      cleared: current.cleared + cleared,
      bestCascade: Math.max(current.bestCascade, cascades)
    }
  };
}
function hasValidMove(board) {
  const rows = board.length;
  const columns = board[0]?.length ?? 0;
  for (let row = 0; row < rows; row += 1) for (let column = 0; column < columns; column += 1) {
    const current = { row, column };
    if (column + 1 < columns && findMatches(swapMatch3Cells(board, current, { row, column: column + 1 })).length > 0) return true;
    if (row + 1 < rows && findMatches(swapMatch3Cells(board, current, { row: row + 1, column })).length > 0) return true;
  }
  return false;
}
function makeBoard(rows, columns, random2) {
  const board = [];
  for (let row = 0; row < rows; row += 1) {
    const nextRow = [];
    for (let column = 0; column < columns; column += 1) {
      let kind = pickKind(random2);
      for (let guard = 0; guard < 30; guard += 1) {
        const horizontal = column >= 2 && nextRow[column - 1] === kind && nextRow[column - 2] === kind;
        const vertical = row >= 2 && board[row - 1][column] === kind && board[row - 2][column] === kind;
        if (!horizontal && !vertical) break;
        kind = pickKind(random2);
      }
      nextRow.push(kind);
    }
    board.push(nextRow);
  }
  return board;
}
function makePlayableBoard(rows, columns, random2) {
  let board = makeBoard(rows, columns, random2);
  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS && !hasValidMove(board); attempt += 1) board = makeBoard(rows, columns, random2);
  return board;
}
function collapseBoard(board, matches, random2) {
  const rows = board.length;
  const columns = board[0]?.length ?? 0;
  const removed = new Set(matches.map(({ row, column }) => `${row}:${column}`));
  const next = Array.from({ length: rows }, () => Array(columns));
  for (let column = 0; column < columns; column += 1) {
    const survivors = [];
    for (let row = rows - 1; row >= 0; row -= 1) if (!removed.has(`${row}:${column}`)) survivors.push(board[row][column]);
    for (let row = rows - 1, index = 0; row >= 0; row -= 1, index += 1) next[row][column] = survivors[index] ?? pickKind(random2);
  }
  return next;
}
function isInBounds(board, position) {
  return position.row >= 0 && position.row < board.length && position.column >= 0 && position.column < (board[0]?.length ?? 0);
}
function unchangedMove(state2) {
  return { state: state2, valid: false, cascades: 0, scoreGained: 0, cleared: 0, steps: [] };
}

// node_modules/@dokiworld/app-sdk/src/index.js
var APP_PROTOCOL = "dokiworld.app";
var APP_PROTOCOL_VERSION = 2;
var MAX_ID_LENGTH = 200;
var MAX_RESULT_BYTES = 64 * 1024;
var MAX_RESULT_DEPTH = 12;
var MAX_RESULT_NODES = 2e3;
var SEMANTIC_ID_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
var APP_EXIT_REASONS = /* @__PURE__ */ new Set(["user-requested", "app-requested", "blocked"]);
var RESERVED_CLIENT_MESSAGE_TYPES = /* @__PURE__ */ new Set([
  "dokiworld-app-ready",
  "dokiworld-app-initialized",
  "dokiworld-app-complete",
  "dokiworld-app-request-exit",
  "dokiworld-app-exit-state"
]);
var RESERVED_HOST_MESSAGE_TYPES = /* @__PURE__ */ new Set([
  "dokiworld-app-init",
  "dokiworld-app-complete-ack",
  "dokiworld-app-prepare-exit",
  "dokiworld-app-exit-decision"
]);
var AppAcknowledgementTimeoutError = class extends Error {
  constructor(resultId) {
    super(`DokiWorld did not acknowledge result ${resultId}`);
    this.name = "AppAcknowledgementTimeoutError";
    this.code = "ack-timeout";
    this.resultId = resultId;
  }
};
function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
function isBoundedId(value) {
  return typeof value === "string" && value.length > 0 && value.length <= MAX_ID_LENGTH;
}
function isContract(value) {
  return isRecord(value) && typeof value.contract === "string" && SEMANTIC_ID_PATTERN.test(value.contract) && Number.isInteger(value.version) && Number(value.version) >= 1;
}
function defaultId(kind) {
  const suffix = globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `${kind}-${suffix}`;
}
function postToParent(scope, message, targetOrigin) {
  if (scope.ReactNativeWebView?.postMessage) {
    scope.ReactNativeWebView.postMessage(JSON.stringify(message));
    return;
  }
  scope.parent.postMessage(message, targetOrigin);
}
function createExtensionSet(extensions) {
  if (!Array.isArray(extensions) || !extensions.every((value) => typeof value === "string" && /^[a-z][a-z0-9-]*$/.test(value))) {
    throw new Error("Invalid app extensions");
  }
  return new Set(extensions);
}
function isDeclaredExtensionMessage(type, extensions) {
  if (typeof type !== "string" || !type.startsWith("dokiworld-app-")) return false;
  const suffix = type.slice("dokiworld-app-".length);
  for (const extension of extensions) {
    if (suffix === extension || suffix.startsWith(`${extension}-`)) return true;
  }
  return false;
}
function isBoundedJson(value) {
  let encoded;
  try {
    encoded = JSON.stringify(value);
  } catch {
    return false;
  }
  if (encoded === void 0 || new TextEncoder().encode(encoded).byteLength > MAX_RESULT_BYTES) return false;
  let nodes = 0;
  const visit = (current, depth) => {
    nodes += 1;
    if (nodes > MAX_RESULT_NODES || depth > MAX_RESULT_DEPTH) return false;
    if (current === null || typeof current === "string" || typeof current === "boolean") return true;
    if (typeof current === "number") return Number.isFinite(current);
    if (Array.isArray(current)) return current.every((item) => visit(item, depth + 1));
    if (!isRecord(current)) return false;
    return Object.entries(current).every(([key, item]) => key.length <= MAX_ID_LENGTH && visit(item, depth + 1));
  };
  return visit(value, 0);
}
function parseExternalAppInitMessage(value, expected) {
  if (!isRecord(value) || !isRecord(value.payload)) return null;
  if (value.type !== "dokiworld-app-init" || value.protocol !== APP_PROTOCOL || value.protocolVersion !== APP_PROTOCOL_VERSION || value.appId !== expected.appId || value.instanceId !== expected.instanceId || !isBoundedId(value.runId) || !isBoundedId(value.messageId)) return null;
  const { locale: locale2, grantedScopes, context, input } = value.payload;
  if (typeof locale2 !== "string" || !Array.isArray(grantedScopes) || !grantedScopes.every((scope) => typeof scope === "string") || !isRecord(context) || !isRecord(input) || !isContract(input) || !("data" in input) || !isBoundedJson(input.data)) return null;
  return {
    type: "dokiworld-app-init",
    protocol: APP_PROTOCOL,
    protocolVersion: APP_PROTOCOL_VERSION,
    appId: expected.appId,
    instanceId: expected.instanceId,
    runId: value.runId,
    messageId: value.messageId,
    payload: {
      locale: locale2,
      grantedScopes: [...grantedScopes],
      context,
      input: { contract: input.contract, version: input.version, data: input.data }
    }
  };
}
function parseExternalAppSessionMessage(value, expected) {
  if (!isRecord(value) || !isRecord(value.payload)) return null;
  if (typeof value.type !== "string" || !value.type.startsWith("dokiworld-app-") || value.protocol !== APP_PROTOCOL || value.protocolVersion !== APP_PROTOCOL_VERSION || value.appId !== expected.appId || value.instanceId !== expected.instanceId || value.runId !== expected.runId || !isBoundedId(value.messageId)) return null;
  return { type: value.type, protocol: APP_PROTOCOL, protocolVersion: APP_PROTOCOL_VERSION, appId: expected.appId, instanceId: expected.instanceId, runId: expected.runId, messageId: value.messageId, payload: value.payload };
}
function createSessionEnvelope(type, identity, payload) {
  if (!isBoundedId(identity.appId) || !isBoundedId(identity.instanceId) || !isBoundedId(identity.runId) || !isBoundedId(identity.messageId)) throw new Error("Invalid external app session identity");
  return { type, protocol: APP_PROTOCOL, protocolVersion: APP_PROTOCOL_VERSION, appId: identity.appId, instanceId: identity.instanceId, runId: identity.runId, messageId: identity.messageId, payload };
}
function createReadyMessage(appId, instanceId) {
  if (!isBoundedId(appId) || !isBoundedId(instanceId)) throw new Error("Invalid external app bootstrap identity");
  return { type: "dokiworld-app-ready", protocol: APP_PROTOCOL, protocolVersion: APP_PROTOCOL_VERSION, appId, instanceId };
}
function createAppClient({
  appId,
  scope = window,
  targetOrigin = "*",
  instanceId = defaultId("instance"),
  createId = defaultId,
  extensions = [],
  readyRetryMs = 500,
  acknowledgementTimeoutMs = 3e3,
  acknowledgementAttempts = 3
} = {}) {
  if (!isBoundedId(appId) || !isBoundedId(instanceId)) throw new Error("Invalid app client identity");
  if (!Number.isInteger(acknowledgementAttempts) || acknowledgementAttempts < 1) throw new Error("Invalid acknowledgement attempt count");
  if (!Number.isFinite(readyRetryMs) || readyRetryMs <= 0 || !Number.isFinite(acknowledgementTimeoutMs) || acknowledgementTimeoutMs <= 0) throw new Error("Invalid app client retry timing");
  const extensionTypes = createExtensionSet(extensions);
  let runId = null;
  let connected = false;
  let disposed = false;
  let handlers = {};
  let readyTimer = null;
  const initializedMessageIds = /* @__PURE__ */ new Set();
  const initializingMessageIds = /* @__PURE__ */ new Map();
  const pendingCompletions = /* @__PURE__ */ new Map();
  const messageListeners = /* @__PURE__ */ new Set();
  const post = (message) => postToParent(scope, message, targetOrigin);
  const identity = () => {
    if (!runId) throw new Error("The app has not received init");
    return { appId, instanceId, runId };
  };
  const sendSession = (type, payload) => {
    const message = createSessionEnvelope(type, { ...identity(), messageId: createId("message") }, payload);
    post(message);
    return message;
  };
  const finishCompletion = (resultId, outcome) => {
    const pending = pendingCompletions.get(resultId);
    if (!pending) return;
    clearTimeout(pending.timer);
    pendingCompletions.delete(resultId);
    outcome instanceof Error ? pending.reject(outcome) : pending.resolve(outcome);
  };
  const sendCompletionAttempt = (pending) => {
    pending.attempts += 1;
    sendSession("dokiworld-app-complete", { resultId: pending.resultId, output: pending.output });
    pending.timer = setTimeout(() => {
      if (pending.attempts < acknowledgementAttempts) sendCompletionAttempt(pending);
      else finishCompletion(pending.resultId, new AppAcknowledgementTimeoutError(pending.resultId));
    }, acknowledgementTimeoutMs);
  };
  const resendInitialized = () => sendSession("dokiworld-app-initialized", {});
  const handleMessage = async (event) => {
    if (disposed || !connected || event.source !== scope.parent) return;
    const init = parseExternalAppInitMessage(event.data, { appId, instanceId });
    if (init) {
      if (runId && init.runId !== runId) return;
      runId = init.runId;
      if (readyTimer !== null) {
        clearInterval(readyTimer);
        readyTimer = null;
      }
      if (initializedMessageIds.has(init.messageId)) {
        resendInitialized();
        return;
      }
      const existingInitialization = initializingMessageIds.get(init.messageId);
      if (existingInitialization) {
        await existingInitialization;
        if (initializedMessageIds.has(init.messageId)) resendInitialized();
        return;
      }
      const initialization = Promise.resolve().then(() => handlers.onInit?.(init.payload));
      initializingMessageIds.set(init.messageId, initialization);
      try {
        await initialization;
        initializedMessageIds.add(init.messageId);
        resendInitialized();
      } catch (error) {
        handlers.onError?.(error);
      } finally {
        initializingMessageIds.delete(init.messageId);
      }
      return;
    }
    if (!runId) return;
    const message = parseExternalAppSessionMessage(event.data, identity());
    if (!message) return;
    if (message.type === "dokiworld-app-complete-ack") {
      const { resultId, status, error } = message.payload;
      if (isBoundedId(resultId) && (status === "accepted" || status === "rejected")) {
        finishCompletion(resultId, { resultId, status, ...isRecord(error) ? { error } : {} });
      }
      return;
    }
    if (message.type === "dokiworld-app-prepare-exit") {
      try {
        const state2 = await handlers.onPrepareExit?.(message.payload.reason) ?? { isDirty: false, canSuspend: false };
        sendSession("dokiworld-app-exit-state", { isDirty: Boolean(state2.isDirty), canSuspend: Boolean(state2.canSuspend) });
      } catch (error) {
        handlers.onError?.(error);
        sendSession("dokiworld-app-exit-state", { isDirty: true, canSuspend: false });
      }
      return;
    }
    if (message.type === "dokiworld-app-exit-decision") {
      await handlers.onExitDecision?.(message.payload.decision);
      return;
    }
    if (isDeclaredExtensionMessage(message.type, extensionTypes)) {
      for (const listener of messageListeners) await listener(message);
      await handlers.onMessage?.(message);
    }
  };
  scope.addEventListener("message", handleMessage);
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    scope.removeEventListener("message", handleMessage);
    if (readyTimer !== null) clearInterval(readyTimer);
    for (const resultId of pendingCompletions.keys()) finishCompletion(resultId, new Error("The app client was disposed"));
    messageListeners.clear();
  };
  return Object.freeze({
    appId,
    instanceId,
    get runId() {
      return runId;
    },
    connect(nextHandlers = {}) {
      if (disposed) throw new Error("The app client is disposed");
      if (connected) throw new Error("The app client is already connected");
      connected = true;
      handlers = nextHandlers;
      post(createReadyMessage(appId, instanceId));
      readyTimer = setInterval(() => {
        if (!runId) post(createReadyMessage(appId, instanceId));
      }, readyRetryMs);
      return dispose;
    },
    complete(output, options = {}) {
      if (!isContract(output) || !("data" in output) || !isBoundedJson(output.data)) throw new Error("Invalid app output");
      identity();
      const resultId = options.resultId ?? createId("result");
      if (!isBoundedId(resultId)) throw new Error("Invalid app result id");
      if (pendingCompletions.has(resultId)) return pendingCompletions.get(resultId).promise;
      let resolve;
      let reject;
      const promise = new Promise((resolvePromise, rejectPromise) => {
        resolve = resolvePromise;
        reject = rejectPromise;
      });
      const pending = { resultId, output, attempts: 0, timer: null, promise, resolve, reject };
      pendingCompletions.set(resultId, pending);
      sendCompletionAttempt(pending);
      return promise;
    },
    requestExit(reason = "app-requested") {
      if (!APP_EXIT_REASONS.has(reason)) throw new Error("Invalid app exit reason");
      return sendSession("dokiworld-app-request-exit", { reason });
    },
    send(type, payload = {}) {
      if (!isDeclaredExtensionMessage(type, extensionTypes) || RESERVED_CLIENT_MESSAGE_TYPES.has(type) || RESERVED_HOST_MESSAGE_TYPES.has(type)) throw new Error("Invalid or undeclared app extension message type");
      return sendSession(type, payload);
    },
    onMessage(listener) {
      if (disposed || typeof listener !== "function") throw new Error("Invalid app client message listener");
      messageListeners.add(listener);
      return () => messageListeners.delete(listener);
    },
    dispose
  });
}

// index.js
var GAME_ID = "game-match3";
var MAX_SCORE = 100;
var DEFAULTS = {
  rows: 7,
  columns: 7,
  timeLimit: 60,
  targetScore: 600,
  moves: null,
  seed: null,
  presentation: "default"
};
var BANQUET_ORDERS = [
  { kind: "heart", target: 12 },
  { kind: "charm", target: 12 },
  { kind: "performance", target: 12 }
];
var BANQUET_THRESHOLDS = [10, 20, 40];
var RYAN_SPEECH_THRESHOLDS = [15, 25, 50];
var BANQUET_BOOSTERS = ["single", "row", "column", "kind", "shuffle"];
var PARTICLE_COLORS = {
  performance: "#ffad3d",
  intelligence: "#42d1ff",
  charm: "#bd65ff",
  physique: "#61e3ad",
  heart: "#ff5a8c"
};
var COPY = {
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
    ryanSpeechGoal: "Complete the \u201Cperfect\u201D speech Ryan will use tonight.",
    orders: "Collected",
    boosters: "Boosters",
    boosterToolbar: "Locked match-three boosters",
    boosterLocked: {
      single: "Noir Drop is locked in this level.",
      row: "Velvet Sweep is locked in this level.",
      column: "Midnight Pour is locked in this level.",
      kind: "Essence Recall is locked in this level.",
      shuffle: "Banquet Remix is locked in this level."
    },
    restart: "Restart",
    instructionLong: "Match any 3 or more identical items. Score as high as you can in 10 moves\u2014no special pattern is required.",
    ryanSpeechInstructionLong: "Complete Ryan\u2019s \u201Cperfect\u201D speech in 10 moves and score as high as possible.",
    standardClear: "Pass",
    greatClear: "Good",
    perfectClear: "Perfect",
    finish: { great: "Perfect!", good: "Lovely!", poor: "Sweet start!" },
    kinds: { performance: "Amber candy", intelligence: "Blue candy", charm: "Violet candy", physique: "Mint candy", heart: "Heart candy" }
  },
  "zh-cn": {
    title: "\u5FC3\u610F\u8FDE\u7EBF",
    instructions: "\u4EA4\u6362\u76F8\u90BB\u7CD6\u679C\uFF0C\u5728\u65F6\u95F4\u7ED3\u675F\u524D\u8FDE\u6210\u4E09\u4E2A\u6216\u66F4\u591A\u3002",
    score: "\u5F97\u5206 {value}",
    scoreLabel: "\u5F97\u5206",
    target: "\u76EE\u6807 {value}",
    moves: "\u5269\u4F59 {value} \u6B65",
    movesLabel: "\u6B65\u6570",
    time: "\u5269\u4F59 {value} \u79D2",
    board: "\u4E09\u6D88\u6E38\u620F\u68CB\u76D8",
    cascade: "\u751C\u871C\u8FDE\u51FB",
    goalLabel: "\u76EE\u6807\uFF1A",
    goal: "\u8BA9\u4F60\u6700\u597D\u7684\u670B\u53CB\u76F8\u4FE1\u6628\u665A\u4EC0\u4E48\u90FD\u6CA1\u53D1\u751F\u3002",
    ryanSpeechGoal: "\u5B8C\u6210Ryan\u4ECA\u665A\u4F7F\u7528\u7684\u201C\u5B8C\u7F8E\u201D\u6F14\u8BB2\u7A3F\u3002",
    orders: "\u5DF2\u6536\u96C6",
    boosters: "\u9053\u5177",
    boosterToolbar: "\u5C1A\u672A\u89E3\u9501\u7684\u4E09\u6D88\u9053\u5177",
    boosterLocked: {
      single: "\u9ED1\u66DC\u70B9\u7834\u5728\u672C\u5173\u5C1A\u672A\u89E3\u9501\u3002",
      row: "\u4E1D\u7ED2\u6A2A\u626B\u5728\u672C\u5173\u5C1A\u672A\u89E3\u9501\u3002",
      column: "\u5348\u591C\u7EB5\u6D41\u5728\u672C\u5173\u5C1A\u672A\u89E3\u9501\u3002",
      kind: "\u9999\u8C03\u53EC\u56DE\u5728\u672C\u5173\u5C1A\u672A\u89E3\u9501\u3002",
      shuffle: "\u5BB4\u4F1A\u91CD\u8C03\u5728\u672C\u5173\u5C1A\u672A\u89E3\u9501\u3002"
    },
    restart: "\u91CD\u65B0\u5F00\u59CB",
    instructionLong: "\u4EFB\u610F\u8FDE\u6210\u4E09\u4E2A\u6216\u66F4\u591A\u76F8\u540C\u7269\u54C1\u5373\u53EF\u5F97\u5206\u3002\u9650\u5B9A 10 \u6B65\uFF0C\u4E0D\u8981\u6C42\u7279\u6B8A\u6D88\u9664\u56FE\u6848\uFF0C\u5C3D\u53EF\u80FD\u83B7\u5F97\u9AD8\u5206\u3002",
    ryanSpeechInstructionLong: "\u9650\u5B9A10\u6B65\uFF0C\u5B8C\u6210Ryan\u4ECA\u665A\u4F7F\u7528\u7684\u201C\u5B8C\u7F8E\u201D\u6F14\u8BB2\u7A3F\uFF0C\u770B\u6700\u9AD8\u83B7\u5F97\u591A\u5C11\u5206\u3002",
    standardClear: "\u5408\u683C",
    greatClear: "\u826F\u597D",
    perfectClear: "Perfect",
    finish: { great: "\u5B8C\u7F8E\uFF01", good: "\u771F\u4E0D\u9519\uFF01", poor: "\u751C\u871C\u5F00\u573A\uFF01" },
    kinds: { performance: "\u7425\u73C0\u7CD6\u679C", intelligence: "\u84DD\u8272\u7CD6\u679C", charm: "\u7D2B\u8272\u7CD6\u679C", physique: "\u8584\u8377\u7CD6\u679C", heart: "\u7231\u5FC3\u7CD6\u679C" }
  }
};
var elements = {
  game: document.querySelector("#game"),
  title: document.querySelector("#game-title"),
  instructions: document.querySelector("#instructions"),
  score: document.querySelector("#score"),
  target: document.querySelector("#target"),
  moves: document.querySelector("#moves"),
  timer: document.querySelector("#timer"),
  timerBar: document.querySelector("#timer span"),
  board: document.querySelector("#board"),
  playfield: document.querySelector(".match3-playfield"),
  effects: document.querySelector("#effects"),
  combo: document.querySelector("#combo"),
  gain: document.querySelector("#gain"),
  celebration: document.querySelector("#celebration"),
  celebrationTitle: document.querySelector("#celebration-title"),
  celebrationScore: document.querySelector("#celebration-score"),
  banquetGoalLabel: document.querySelector("#banquet-goal-label"),
  banquetGoal: document.querySelector("#banquet-goal"),
  banquetMovesLabel: document.querySelector("#banquet-moves-label"),
  banquetMoves: document.querySelector("#banquet-moves"),
  banquetOrdersTitle: document.querySelector("#banquet-orders-title"),
  banquetOrderList: document.querySelector("#banquet-order-list"),
  banquetBoostersTitle: document.querySelector("#banquet-boosters-title"),
  banquetBoosterList: document.querySelector("#banquet-booster-list"),
  banquetScoreLabel: document.querySelector("#banquet-score-label"),
  banquetScore: document.querySelector("#banquet-score"),
  banquetScoreFill: document.querySelector("#banquet-score-fill"),
  banquetStandardClear: document.querySelector("#banquet-standard-clear"),
  banquetGreatClear: document.querySelector("#banquet-great-clear"),
  banquetPerfectClear: document.querySelector("#banquet-perfect-clear"),
  banquetInstructions: document.querySelector("#banquet-instructions"),
  restart: document.querySelector("#restart")
};
var dokiworld = createAppClient({
  appId: GAME_ID,
  extensions: ["resize", "progress", "checkpoint"]
});
var locale = "en";
var copy = COPY.en;
var config = { ...DEFAULTS };
var random = Math.random;
var state = null;
var selected = null;
var busy = false;
var finished = false;
var startedAt = 0;
var timer = 0;
var pointerStart = null;
var suppressClick = false;
var tiles = [];
var nextTileId = 0;
var invalidPositions = /* @__PURE__ */ new Set();
var orderProgress = /* @__PURE__ */ new Map();
var SWAP_MS = 170;
var POP_MS = 230;
var FALL_MS = 260;
var SHAKE_MS = 520;
function clamp(value, fallback, minimum, maximum) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(maximum, Math.max(minimum, Math.round(number))) : fallback;
}
function configure(options = {}) {
  config = {
    rows: clamp(options.rows, 7, 4, 8),
    columns: clamp(options.columns, 7, 4, 9),
    timeLimit: clamp(options.timeLimit, 60, 5, 180),
    targetScore: clamp(options.targetScore, 600, 100, 1e4),
    moves: Number.isFinite(Number(options.moves)) ? clamp(options.moves, 12, 1, 60) : null,
    seed: Number.isFinite(Number(options.seed)) ? Number(options.seed) : null,
    presentation: options.presentation === "banquet-contract" ? "banquet-contract" : "default",
    banquetLevel: options.banquetLevel === "ryan-speech" ? "ryan-speech" : "lily-cover-story"
  };
  random = config.seed === null ? Math.random : createSeededRandom(config.seed);
}
function sleep(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}
function positionKey(position) {
  return `${position.row}:${position.column}`;
}
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
  return Math.min(MAX_SCORE, Math.round(score / config.targetScore * MAX_SCORE));
}
function banquetPoints(score) {
  return Math.max(0, Math.floor(score / 10));
}
function banquetThresholds() {
  return config.banquetLevel === "ryan-speech" ? RYAN_SPEECH_THRESHOLDS : BANQUET_THRESHOLDS;
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
  elements.banquetScoreFill.style.height = `${Math.min(100, points / thresholds[thresholds.length - 1] * 100)}%`;
  document.querySelectorAll(".match3-score-ladder li").forEach((tier) => {
    const threshold = Number(tier.dataset.threshold);
    tier.classList.toggle("is-reached", points >= threshold);
    tier.classList.toggle(
      "is-current",
      points >= threshold && !thresholds.some((candidate) => candidate > threshold && points >= candidate)
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
    if (suppressClick) {
      suppressClick = false;
      return;
    }
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
    dy: 0
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
  const target = pointerStart.target ?? dragTarget(position, deltaX, deltaY, cellSize * 0.45);
  const enough = target && Math.max(Math.abs(deltaX), Math.abs(deltaY)) >= cellSize * 0.45;
  clearDragVisuals();
  if (moved) {
    suppressClick = true;
    window.setTimeout(() => {
      suppressClick = false;
    }, 350);
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
    const angle = Math.PI * 2 * index / 9 + (position.row + position.column) * 0.17;
    const distance = 34 + (index * 13 + position.row * 7) % 30;
    particle.className = "match3-particle";
    particle.style.left = `${x}px`;
    particle.style.top = `${y}px`;
    particle.style.setProperty("--dx", `${Math.cos(angle) * distance}px`);
    particle.style.setProperty("--dy", `${Math.sin(angle) * distance}px`);
    particle.style.setProperty("--spin", `${index % 2 ? 220 : -190}deg`);
    particle.style.setProperty("--size", `${5 + index % 4 * 2}px`);
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
  window.setTimeout(() => {
    elements.gain.hidden = true;
  }, 850);
}
function showCombo(cascades) {
  if (cascades <= 1) return;
  elements.combo.hidden = true;
  void elements.combo.offsetWidth;
  elements.combo.innerHTML = `${copy.cascade} <strong>x${cascades}</strong>`;
  elements.combo.hidden = false;
  window.setTimeout(() => {
    elements.combo.hidden = true;
  }, 940);
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
  if (!selected) {
    selected = position;
    syncTiles();
    return;
  }
  if (positionKey(selected) === positionKey(position)) {
    selected = null;
    syncTiles();
    return;
  }
  if (!areAdjacent(selected, position)) {
    selected = position;
    syncTiles();
    return;
  }
  const previous = selected;
  const move = applyMatch3Move(state, previous, position, random);
  const firstButton = cellButton(previous);
  const secondButton = cellButton(position);
  if (firstButton && secondButton) drawSwapTrail(firstButton, secondButton);
  selected = null;
  busy = true;
  invalidPositions = /* @__PURE__ */ new Set();
  if (!move.valid) {
    if (!fromDrag) {
      swapTilePositions(previous, position);
      syncTiles();
      await sleep(SWAP_MS);
      swapTilePositions(previous, position);
      syncTiles();
    }
    invalidPositions = /* @__PURE__ */ new Set([positionKey(previous), positionKey(position)]);
    syncTiles();
    await sleep(SHAKE_MS);
    invalidPositions = /* @__PURE__ */ new Set();
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
      const columnSurvivors = survivors.filter((tile) => tile.column === column).sort((first, second) => first.row - second.row);
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
      entering.filter((tile) => tile.column === column).forEach((tile, index) => {
        tile.row = index;
      });
    }
    syncTiles(shownScore);
    await sleep(FALL_MS);
    tiles.forEach((tile) => {
      tile.entering = false;
      tile.falling = false;
    });
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
    const angle = Math.PI * 2 * index / 42;
    const distance = 110 + index % 7 * 24;
    particle.className = "match3-particle celebration-particle";
    particle.style.left = `${rect.width / 2}px`;
    particle.style.top = `${rect.height / 2}px`;
    particle.style.setProperty("--dx", `${Math.cos(angle) * distance}px`);
    particle.style.setProperty("--dy", `${Math.sin(angle) * distance}px`);
    particle.style.setProperty("--spin", `${index % 2 ? 440 : -390}deg`);
    particle.style.setProperty("--size", `${6 + index % 5 * 2}px`);
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
  const displayedPoints = config.presentation === "banquet-contract" ? banquetPoints(state.score) : state.score;
  elements.board.classList.add("is-complete");
  elements.celebrationTitle.textContent = copy.finish[verdict];
  elements.celebrationScore.textContent = copy.score.replace("{value}", formatNumber(displayedPoints));
  elements.celebration.hidden = false;
  scatterCelebration();
  await sleep(1250);
  await dokiworld.complete({
    contract: "doki.game.result",
    version: 1,
    data: {
      normalizedScore: normalized,
      outcome: "completed",
      metrics: { points: displayedPoints, cleared: state.cleared, moves: state.movesUsed, bestCascade: state.bestCascade }
    }
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
  elements.banquetInstructions.textContent = isRyanSpeech ? copy.ryanSpeechInstructionLong : copy.instructionLong;
  document.querySelectorAll(".match3-score-ladder li").forEach((tier, index) => {
    const threshold = thresholds[index];
    tier.dataset.threshold = String(threshold);
    tier.querySelector("strong").textContent = String(threshold);
  });
  elements.restart.setAttribute("aria-label", copy.restart);
}
function start() {
  finished = false;
  busy = false;
  selected = null;
  pointerStart = null;
  suppressClick = false;
  state = createMatch3State({ rows: config.rows, columns: config.columns }, random);
  orderProgress = new Map(BANQUET_ORDERS.map(({ kind }) => [kind, 0]));
  nextTileId = 0;
  invalidPositions = /* @__PURE__ */ new Set();
  tiles = state.board.flatMap((row, rowIndex) => row.map((kind, columnIndex) => makeTile(kind, rowIndex, columnIndex)));
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
    const left = Math.max(0, config.timeLimit * 1e3 - (performance.now() - startedAt));
    elements.timerBar.style.width = `${left / (config.timeLimit * 10)}%`;
    elements.timer.classList.toggle("is-urgent", left <= config.timeLimit * 200);
    elements.timer.setAttribute("aria-label", copy.time.replace("{value}", Math.ceil(left / 1e3)));
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
  }
});
