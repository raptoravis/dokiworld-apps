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
  const post2 = (message) => postToParent(scope, message, targetOrigin);
  const identity = () => {
    if (!runId) throw new Error("The app has not received init");
    return { appId, instanceId, runId };
  };
  const sendSession = (type, payload) => {
    const message = createSessionEnvelope(type, { ...identity(), messageId: createId("message") }, payload);
    post2(message);
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
        const state = await handlers.onPrepareExit?.(message.payload.reason) ?? { isDirty: false, canSuspend: false };
        const output = state.output;
        if (output !== void 0 && (!isContract(output) || !("data" in output) || !isBoundedJson(output.data))) {
          throw new Error("Invalid app exit output");
        }
        sendSession("dokiworld-app-exit-state", {
          isDirty: Boolean(state.isDirty),
          canSuspend: Boolean(state.canSuspend),
          ...output === void 0 ? {} : { output }
        });
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
      post2(createReadyMessage(appId, instanceId));
      readyTimer = setInterval(() => {
        if (!runId) post2(createReadyMessage(appId, instanceId));
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

// node_modules/@dokiworld/app-sdk/src/game-result.js
var GAME_RESULT_CONTRACT = "doki.game.result";
var GAME_RESULT_VERSION = 1;
var GAME_SCORE_MAX = 100;
var GAME_RESULT_OUTPUT = Object.freeze({
  contract: GAME_RESULT_CONTRACT,
  version: GAME_RESULT_VERSION
});
var MAX_METRIC_COUNT = 12;
var MAX_METRIC_KEY_LENGTH = 48;
var MAX_METRIC_STRING_LENGTH = 160;
var MAX_METRIC_NUMBER = 1e12;
var OUTCOMES = /* @__PURE__ */ new Set(["win", "loss", "draw", "completed", "exited"]);
var isRecord2 = (value) => Boolean(value && typeof value === "object" && !Array.isArray(value));
function sanitizeMetrics(value) {
  if (!isRecord2(value)) return Object.freeze({});
  const metrics = {};
  for (const [rawKey, rawValue] of Object.entries(value)) {
    if (Object.keys(metrics).length >= MAX_METRIC_COUNT) break;
    const key = rawKey.trim();
    if (!key || key.length > MAX_METRIC_KEY_LENGTH) continue;
    if (typeof rawValue === "boolean") metrics[key] = rawValue;
    else if (typeof rawValue === "number" && Number.isFinite(rawValue) && Math.abs(rawValue) <= MAX_METRIC_NUMBER) metrics[key] = rawValue;
    else if (typeof rawValue === "string") metrics[key] = rawValue.replace(/\s+/g, " ").trim().slice(0, MAX_METRIC_STRING_LENGTH);
  }
  return Object.freeze(metrics);
}
function parseData(value, strictOutcome) {
  if (!isRecord2(value)) return null;
  const normalizedScore = value.normalizedScore;
  if (!Number.isInteger(normalizedScore) || normalizedScore < 0 || normalizedScore > GAME_SCORE_MAX) return null;
  const outcome = value.outcome === void 0 ? "completed" : OUTCOMES.has(value.outcome) ? value.outcome : strictOutcome ? null : "completed";
  if (!outcome) return null;
  return Object.freeze({
    normalizedScore,
    outcome,
    metrics: sanitizeMetrics(value.metrics)
  });
}
function parseGameResult(output) {
  if (!isRecord2(output) || output.contract !== GAME_RESULT_CONTRACT || output.version !== GAME_RESULT_VERSION) return null;
  return parseData(output.data, false);
}

// node_modules/@dokiworld/app-sdk/src/episode.js
var CLIENT_WIRE_TYPES = Object.freeze({
  "episode.start": "dokiworld-app-episode-start",
  "episode.restart": "dokiworld-app-episode-restart",
  "episode.choice": "dokiworld-app-episode-choice",
  "episode.reply": "dokiworld-app-episode-reply",
  "episode.action": "dokiworld-app-episode-action",
  "episode.gameResult": "dokiworld-app-episode-game-result",
  "episode.gameCompleted": "dokiworld-app-episode-game-completed",
  "chat.regenerate": "dokiworld-app-chat-regenerate",
  "chat.suggest": "dokiworld-app-chat-suggest",
  "chat.generateMedia": "dokiworld-app-chat-generate-media"
});
var HOST_WIRE_TYPES = Object.freeze({
  "episode.content": "dokiworld-app-episode",
  "episode.resuming": "dokiworld-app-episode-resuming",
  "episode.error": "dokiworld-app-episode-error",
  "episode.game": "dokiworld-app-episode-game",
  "episode.fixedGameResult": "dokiworld-app-episode-fixed-game-result",
  "episode.gameResolved": "dokiworld-app-episode-game-resolved",
  "chat.regenerated": "dokiworld-app-chat-regenerated",
  "chat.suggestions": "dokiworld-app-chat-suggestions",
  "chat.media": "dokiworld-app-chat-media",
  "chat.mediaError": "dokiworld-app-chat-media-error"
});
var isRecord3 = (value) => Boolean(value && typeof value === "object" && !Array.isArray(value));
var isString = (value) => typeof value === "string";
var isOptionalRecord = (value) => value === void 0 || value === null || isRecord3(value);
var noPayload = (payload) => Object.keys(payload).length === 0;
var CLIENT_VALIDATORS = Object.freeze({
  "episode.start": noPayload,
  "episode.restart": noPayload,
  "episode.choice": (payload) => isString(payload.beatId) && isString(payload.optionId),
  "episode.reply": (payload) => isString(payload.playerInput) && isOptionalRecord(payload.playerPersona),
  "episode.action": (payload) => isString(payload.beatId),
  "episode.gameResult": (payload) => (payload.configId === void 0 || isString(payload.configId)) && isRecord3(payload.result),
  "episode.gameCompleted": (payload) => (payload.configId === void 0 || isString(payload.configId)) && parseGameResult(payload.output) !== null,
  "chat.regenerate": (payload) => isOptionalRecord(payload.playerPersona),
  "chat.suggest": (payload) => isOptionalRecord(payload.playerPersona),
  "chat.generateMedia": (payload) => ["image", "video"].includes(payload.mediaType) && isOptionalRecord(payload.playerPersona)
});
var HOST_VALIDATORS = Object.freeze({
  "episode.content": (payload) => Array.isArray(payload.utterances),
  "episode.resuming": noPayload,
  "episode.error": (payload) => isString(payload.code),
  "episode.game": (payload) => isRecord3(payload.gameConfig),
  "episode.fixedGameResult": (payload) => isRecord3(payload.result),
  "episode.gameResolved": (payload) => isRecord3(payload.result) && Array.isArray(payload.utterances),
  "chat.regenerated": (payload) => Array.isArray(payload.utterances),
  "chat.suggestions": (payload) => Array.isArray(payload.suggestions) && payload.suggestions.every(isString),
  "chat.media": (payload) => ["image", "video"].includes(payload.mediaType) && isString(payload.url),
  "chat.mediaError": (payload) => isString(payload.error)
});
function reverseTypes(types) {
  return Object.freeze(Object.fromEntries(Object.entries(types).map(([semantic, wire]) => [wire, semantic])));
}
var CLIENT_SEMANTIC_TYPES = reverseTypes(CLIENT_WIRE_TYPES);
var HOST_SEMANTIC_TYPES = reverseTypes(HOST_WIRE_TYPES);
function splitEvent(event) {
  if (!isRecord3(event) || !isString(event.type)) return null;
  const { type, ...payload } = event;
  return { type, payload };
}
function createDirectionalExtension(channel, outgoingTypes, outgoingValidators, incomingTypes, incomingValidators) {
  if (!channel || typeof channel.send !== "function") throw new Error("Invalid episode extension channel");
  return Object.freeze({
    send(event) {
      const parsed = splitEvent(event);
      const wireType = parsed && outgoingTypes[parsed.type];
      const validate = parsed && outgoingValidators[parsed.type];
      if (!wireType || !validate?.(parsed.payload)) throw new Error("Invalid episode extension event");
      return channel.send(wireType, parsed.payload);
    },
    receive(message) {
      if (!isRecord3(message) || !isString(message.type) || !isRecord3(message.payload)) return null;
      const semanticType = incomingTypes[message.type];
      const validate = semanticType && incomingValidators[semanticType];
      if (!semanticType || !validate?.(message.payload)) return null;
      return Object.freeze({ type: semanticType, ...message.payload });
    }
  });
}
function createEpisodeClientExtension(client) {
  return createDirectionalExtension(
    client,
    CLIENT_WIRE_TYPES,
    CLIENT_VALIDATORS,
    HOST_SEMANTIC_TYPES,
    HOST_VALIDATORS
  );
}

// node_modules/@dokiworld/app-sdk/src/dialogue.js
var REQUEST_TYPE = "dokiworld-app-dialogue-request";
var RESPONSE_TYPE = "dokiworld-app-dialogue-response";
var OPERATIONS = /* @__PURE__ */ new Set([
  "generateDialogue",
  "regenerateDialogue",
  "generateOpening",
  "generateSuggestions",
  "generateTagline"
]);
var INPUT_MODES = /* @__PURE__ */ new Set(["speech", "behavior", "plot"]);
var MAX_ID_LENGTH2 = 200;
var MAX_PAYLOAD_BYTES = 64 * 1024;
var MAX_PAYLOAD_DEPTH = 12;
var MAX_PAYLOAD_NODES = 2e3;
var isRecord4 = (value) => Boolean(value && typeof value === "object" && !Array.isArray(value));
var isString2 = (value) => typeof value === "string" && value.length > 0;
var isPositiveInteger = (value) => Number.isInteger(value) && value > 0;
var isOptionalPositiveInteger = (value) => value === void 0 || value === null || isPositiveInteger(value);
var isRequestId = (value) => isString2(value) && value.length <= MAX_ID_LENGTH2;
function isBoundedJson2(value) {
  let encoded;
  try {
    encoded = JSON.stringify(value);
  } catch {
    return false;
  }
  if (encoded === void 0 || new TextEncoder().encode(encoded).byteLength > MAX_PAYLOAD_BYTES) return false;
  let nodes = 0;
  const visit = (current, depth) => {
    nodes += 1;
    if (nodes > MAX_PAYLOAD_NODES || depth > MAX_PAYLOAD_DEPTH) return false;
    if (current === null || typeof current === "string" || typeof current === "boolean") return true;
    if (typeof current === "number") return Number.isFinite(current);
    if (Array.isArray(current)) return current.every((item) => visit(item, depth + 1));
    if (!isRecord4(current)) return false;
    return Object.entries(current).every(([key, item]) => key.length <= MAX_ID_LENGTH2 && visit(item, depth + 1));
  };
  return visit(value, 0);
}
var INPUT_VALIDATORS = Object.freeze({
  generateDialogue: (input) => isString2(input.characterId) && isString2(input.playerInput) && isOptionalPositiveInteger(input.sessionId) && (input.inputMode === void 0 || INPUT_MODES.has(input.inputMode)),
  regenerateDialogue: (input) => isString2(input.characterId) && isOptionalPositiveInteger(input.sessionId),
  generateOpening: (input) => isString2(input.characterId) && (input.originalOpeningLine === void 0 || typeof input.originalOpeningLine === "string"),
  generateSuggestions: (input) => isOptionalPositiveInteger(input.sessionId) && (input.characterId === void 0 || isString2(input.characterId)) && (isPositiveInteger(input.sessionId) || isString2(input.characterId)),
  generateTagline: (input) => isString2(input.characterId) && isOptionalPositiveInteger(input.sessionId)
});
var RESULT_VALIDATORS = Object.freeze({
  generateDialogue: (result2) => isRecord4(result2) && isPositiveInteger(result2.sessionId) && Array.isArray(result2.utterances),
  regenerateDialogue: (result2) => isRecord4(result2) && isPositiveInteger(result2.sessionId) && Array.isArray(result2.utterances),
  generateOpening: (result2) => isRecord4(result2) && typeof result2.openingLine === "string" && Array.isArray(result2.segments),
  generateSuggestions: (result2) => isRecord4(result2) && Array.isArray(result2.suggestions) && result2.suggestions.every((item) => typeof item === "string"),
  generateTagline: (result2) => isRecord4(result2) && typeof result2.tagline === "string"
});
function defaultId2() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}
function parseResponse(message) {
  if (!isRecord4(message) || message.type !== RESPONSE_TYPE || !isRecord4(message.payload)) return null;
  const { requestId, operation, status } = message.payload;
  if (!isRequestId(requestId) || !OPERATIONS.has(operation)) return null;
  if (status === "fulfilled" && isBoundedJson2(message.payload.result) && RESULT_VALIDATORS[operation](message.payload.result)) {
    return { requestId, operation, status, result: message.payload.result };
  }
  const error = message.payload.error;
  if (status === "rejected" && isRecord4(error) && isString2(error.code) && isString2(error.message)) {
    return { requestId, operation, status, error: { code: error.code, message: error.message } };
  }
  return null;
}
var DialogueCapabilityError = class extends Error {
  constructor(code, message, operation) {
    super(message);
    this.name = "DialogueCapabilityError";
    this.code = code;
    this.operation = operation;
  }
};
var DialogueCapabilityTimeoutError = class extends DialogueCapabilityError {
  constructor(operation) {
    super("timeout", `DokiWorld dialogue operation ${operation} timed out`, operation);
    this.name = "DialogueCapabilityTimeoutError";
  }
};
function createDialogueClientExtension(client, {
  createId = defaultId2,
  timeoutMs = 3e4
} = {}) {
  if (!client || typeof client.send !== "function" || typeof client.onMessage !== "function") {
    throw new Error("Invalid dialogue client channel");
  }
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error("Invalid dialogue operation timeout");
  const pending = /* @__PURE__ */ new Map();
  let disposed = false;
  const finish = (requestId, outcome) => {
    const request = pending.get(requestId);
    if (!request) return;
    clearTimeout(request.timer);
    pending.delete(requestId);
    outcome instanceof Error ? request.reject(outcome) : request.resolve(outcome);
  };
  const unsubscribe = client.onMessage((message) => {
    const response = parseResponse(message);
    const request = response && pending.get(response.requestId);
    if (!response || !request || request.operation !== response.operation) return;
    if (response.status === "fulfilled") finish(response.requestId, response.result);
    else finish(response.requestId, new DialogueCapabilityError(response.error.code, response.error.message, response.operation));
  });
  const invoke = (operation, input) => {
    if (disposed) return Promise.reject(new DialogueCapabilityError("disposed", "The dialogue client was disposed", operation));
    if (!OPERATIONS.has(operation) || !isRecord4(input) || !isBoundedJson2(input) || !INPUT_VALIDATORS[operation](input)) {
      return Promise.reject(new DialogueCapabilityError("invalid-request", `Invalid ${operation} request`, operation));
    }
    const requestId = createId("dialogue-request");
    if (!isRequestId(requestId) || pending.has(requestId)) {
      return Promise.reject(new DialogueCapabilityError("invalid-request-id", "The dialogue request id is invalid or already in use", operation));
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => finish(requestId, new DialogueCapabilityTimeoutError(operation)), timeoutMs);
      pending.set(requestId, { operation, resolve, reject, timer });
      try {
        client.send(REQUEST_TYPE, { requestId, operation, input });
      } catch (error) {
        finish(requestId, error instanceof Error ? error : new Error(String(error)));
      }
    });
  };
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    unsubscribe();
    for (const [requestId, request] of pending) {
      finish(requestId, new DialogueCapabilityError("disposed", "The dialogue client was disposed", request.operation));
    }
  };
  return Object.freeze({
    generateDialogue: (input) => invoke("generateDialogue", input),
    regenerateDialogue: (input) => invoke("regenerateDialogue", input),
    generateOpening: (input) => invoke("generateOpening", input),
    generateSuggestions: (input) => invoke("generateSuggestions", input),
    generateTagline: (input) => invoke("generateTagline", input),
    dispose
  });
}

// node_modules/@dokiworld/app-sdk/src/capability.js
var MAX_ID_LENGTH3 = 200;
var MAX_PAYLOAD_BYTES2 = 64 * 1024;
var MAX_PAYLOAD_DEPTH2 = 12;
var MAX_PAYLOAD_NODES2 = 2e3;
var isRecord5 = (value) => Boolean(value && typeof value === "object" && !Array.isArray(value));
var isId = (value) => typeof value === "string" && value.length > 0 && value.length <= MAX_ID_LENGTH3;
function isBoundedCapabilityValue(value) {
  let encoded;
  try {
    encoded = JSON.stringify(value);
  } catch {
    return false;
  }
  if (encoded === void 0 || new TextEncoder().encode(encoded).byteLength > MAX_PAYLOAD_BYTES2) return false;
  let nodes = 0;
  const visit = (current, depth) => {
    nodes += 1;
    if (nodes > MAX_PAYLOAD_NODES2 || depth > MAX_PAYLOAD_DEPTH2) return false;
    if (current === null || typeof current === "string" || typeof current === "boolean") return true;
    if (typeof current === "number") return Number.isFinite(current);
    if (Array.isArray(current)) return current.every((item) => visit(item, depth + 1));
    if (!isRecord5(current)) return false;
    return Object.entries(current).every(([key, item]) => key.length <= MAX_ID_LENGTH3 && visit(item, depth + 1));
  };
  return visit(value, 0);
}
function defaultId3() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}
var AppCapabilityError = class extends Error {
  constructor(code, message, capability, operation) {
    super(message);
    this.name = "AppCapabilityError";
    this.code = code;
    this.capability = capability;
    this.operation = operation;
  }
};
var AppCapabilityTimeoutError = class extends AppCapabilityError {
  constructor(capability, operation) {
    super("timeout", `DokiWorld ${capability} operation ${operation} timed out`, capability, operation);
    this.name = "AppCapabilityTimeoutError";
  }
};
function createCapabilityClient(client, definition7, { createId = defaultId3, timeoutMs = 3e4 } = {}) {
  if (!client || typeof client.send !== "function" || typeof client.onMessage !== "function") throw new Error("Invalid capability client channel");
  if (!isRecord5(definition7) || !isId(definition7.name) || !isRecord5(definition7.operations)) throw new Error("Invalid capability definition");
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error("Invalid capability timeout");
  const requestType = `dokiworld-app-${definition7.name}-request`;
  const responseType = `dokiworld-app-${definition7.name}-response`;
  const pending = /* @__PURE__ */ new Map();
  let disposed = false;
  const finish = (requestId, outcome) => {
    const request = pending.get(requestId);
    if (!request) return;
    clearTimeout(request.timer);
    pending.delete(requestId);
    outcome instanceof Error ? request.reject(outcome) : request.resolve(outcome);
  };
  const unsubscribe = client.onMessage((message) => {
    if (!isRecord5(message) || message.type !== responseType || !isRecord5(message.payload)) return;
    const { requestId, operation, status } = message.payload;
    const request = isId(requestId) ? pending.get(requestId) : null;
    if (!request || request.operation !== operation) return;
    const operationDefinition = definition7.operations[operation];
    if (status === "fulfilled" && isBoundedCapabilityValue(message.payload.result) && operationDefinition.output(message.payload.result)) {
      finish(requestId, message.payload.result);
    } else if (status === "rejected" && isRecord5(message.payload.error) && isId(message.payload.error.code) && typeof message.payload.error.message === "string") {
      finish(requestId, new AppCapabilityError(message.payload.error.code, message.payload.error.message, definition7.name, operation));
    }
  });
  const invoke = (operation, input = {}, invokeOptions = {}) => {
    if (disposed) return Promise.reject(new AppCapabilityError("disposed", `The ${definition7.name} capability was disposed`, definition7.name, operation));
    const operationDefinition = definition7.operations[operation];
    if (!operationDefinition || !isBoundedCapabilityValue(input) || !operationDefinition.input(input)) {
      return Promise.reject(new AppCapabilityError("invalid-request", `Invalid ${definition7.name}.${operation} request`, definition7.name, operation));
    }
    const operationTimeoutMs = invokeOptions?.timeoutMs ?? timeoutMs;
    if (!Number.isFinite(operationTimeoutMs) || operationTimeoutMs <= 0) {
      return Promise.reject(new AppCapabilityError("invalid-timeout", `Invalid ${definition7.name}.${operation} timeout`, definition7.name, operation));
    }
    const requestId = createId(`${definition7.name}-request`);
    if (!isId(requestId) || pending.has(requestId)) return Promise.reject(new AppCapabilityError("invalid-request-id", "The capability request id is invalid or already in use", definition7.name, operation));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => finish(requestId, new AppCapabilityTimeoutError(definition7.name, operation)), operationTimeoutMs);
      pending.set(requestId, { operation, resolve, reject, timer });
      try {
        client.send(requestType, { requestId, operation, input });
      } catch (error) {
        finish(requestId, error instanceof Error ? error : new Error(String(error)));
      }
    });
  };
  return Object.freeze({
    invoke,
    dispose() {
      if (disposed) return;
      disposed = true;
      unsubscribe();
      for (const [requestId, request] of pending) finish(requestId, new AppCapabilityError("disposed", `The ${definition7.name} capability was disposed`, definition7.name, request.operation));
    }
  });
}

// node_modules/@dokiworld/app-sdk/src/media.js
var isRecord6 = (value) => Boolean(value && typeof value === "object" && !Array.isArray(value));
var isString3 = (value) => typeof value === "string" && value.length > 0;
var isJob = (value) => isRecord6(value) && isString3(value.id) && ["image", "video"].includes(value.mediaType) && ["pending", "processing", "done", "failed", "cancelled"].includes(value.status) && (value.urls === void 0 || Array.isArray(value.urls) && value.urls.every(isString3));
var generationInput = (mediaType) => (value) => isRecord6(value) && (value.mediaType === void 0 || value.mediaType === mediaType) && (isString3(value.prompt) || Number.isInteger(value.sessionId)) && (value.characterId === void 0 || isString3(value.characterId));
var definition = Object.freeze({ name: "media", operations: Object.freeze({
  generateImage: { input: generationInput("image"), output: isJob },
  generateVideo: { input: generationInput("video"), output: isJob },
  getJob: { input: (value) => isRecord6(value) && isString3(value.jobId), output: isJob },
  cancelJob: { input: (value) => isRecord6(value) && isString3(value.jobId), output: (value) => isRecord6(value) && typeof value.cancelled === "boolean" }
}) });
function createMediaClientExtension(client, options) {
  const capability = createCapabilityClient(client, definition, options);
  return Object.freeze({
    generateImage: (input) => capability.invoke("generateImage", input),
    generateVideo: (input) => capability.invoke("generateVideo", input),
    getJob: (jobId) => capability.invoke("getJob", { jobId }),
    cancelJob: (jobId) => capability.invoke("cancelJob", { jobId }),
    dispose: capability.dispose
  });
}

// node_modules/@dokiworld/app-sdk/src/speech.js
var isRecord7 = (value) => Boolean(value && typeof value === "object" && !Array.isArray(value));
var isString4 = (value) => typeof value === "string" && value.length > 0;
var definition2 = Object.freeze({ name: "speech", operations: Object.freeze({
  synthesize: {
    input: (value) => isRecord7(value) && isString4(value.text) && isString4(value.characterId) && (value.speakerId === void 0 || isString4(value.speakerId)) && (value.locale === void 0 || isString4(value.locale)),
    output: (value) => isRecord7(value) && isString4(value.audioUrl) && typeof value.cached === "boolean"
  }
}) });
function createSpeechClientExtension(client, options) {
  const capability = createCapabilityClient(client, definition2, options);
  return Object.freeze({ synthesize: (input) => capability.invoke("synthesize", input), dispose: capability.dispose });
}

// node_modules/@dokiworld/app-sdk/src/storage.js
var isRecord8 = (value) => Boolean(value && typeof value === "object" && !Array.isArray(value));
var isString5 = (value) => typeof value === "string" && value.length > 0;
var isCheckpoint = (value) => isRecord8(value) && isString5(value.contract) && Number.isInteger(value.version) && value.version > 0 && "data" in value && isBoundedCapabilityValue(value.data);
var definition3 = Object.freeze({ name: "storage", operations: Object.freeze({
  loadCheckpoint: { input: (value) => isRecord8(value) && Object.keys(value).length === 0, output: (value) => isRecord8(value) && (value.checkpoint === null || isCheckpoint(value.checkpoint)) },
  saveCheckpoint: { input: (value) => isRecord8(value) && isCheckpoint(value.checkpoint), output: (value) => isRecord8(value) && value.saved === true },
  clearCheckpoint: { input: (value) => isRecord8(value) && Object.keys(value).length === 0, output: (value) => isRecord8(value) && value.cleared === true }
}) });
function createStorageClientExtension(client, options) {
  const capability = createCapabilityClient(client, definition3, options);
  return Object.freeze({
    loadCheckpoint: () => capability.invoke("loadCheckpoint", {}),
    saveCheckpoint: (checkpoint) => capability.invoke("saveCheckpoint", { checkpoint }),
    clearCheckpoint: () => capability.invoke("clearCheckpoint", {}),
    dispose: capability.dispose
  });
}

// node_modules/@dokiworld/app-sdk/src/character.js
var isRecord9 = (value) => Boolean(value && typeof value === "object" && !Array.isArray(value));
var isString6 = (value) => typeof value === "string" && value.length > 0;
var empty = (value) => isRecord9(value) && Object.keys(value).length === 0;
var isCharacter = (value) => isRecord9(value) && isString6(value.id) && isString6(value.name) && isBoundedCapabilityValue(value);
var result = (value) => isRecord9(value) && (value.character === null || isCharacter(value.character));
var definition4 = Object.freeze({ name: "character", operations: Object.freeze({
  getCurrent: { input: empty, output: result },
  getPublicProfile: { input: (value) => isRecord9(value) && isString6(value.characterId), output: result }
}) });
function createCharacterClientExtension(client, options) {
  const capability = createCapabilityClient(client, definition4, options);
  return Object.freeze({
    getCurrent: () => capability.invoke("getCurrent", {}),
    getPublicProfile: (characterId) => capability.invoke("getPublicProfile", { characterId }),
    dispose: capability.dispose
  });
}

// node_modules/@dokiworld/app-sdk/src/persona.js
var isRecord10 = (value) => Boolean(value && typeof value === "object" && !Array.isArray(value));
var isString7 = (value) => typeof value === "string" && value.length > 0;
var isPersona = (value) => isRecord10(value) && isString7(value.id) && isString7(value.name) && isBoundedCapabilityValue(value);
var selectionInput = (value) => isRecord10(value) && isString7(value.characterId);
var selectionOutput = (value) => isRecord10(value) && (value.persona === null || isPersona(value.persona));
var definition5 = Object.freeze({ name: "persona", operations: Object.freeze({
  list: { input: (value) => isRecord10(value) && Object.keys(value).length === 0, output: (value) => isRecord10(value) && Array.isArray(value.personas) && value.personas.every(isPersona) },
  getSelected: { input: selectionInput, output: selectionOutput },
  requestSelection: { input: selectionInput, output: selectionOutput }
}) });
function createPersonaClientExtension(client, options) {
  const capability = createCapabilityClient(client, definition5, options);
  return Object.freeze({
    list: () => capability.invoke("list", {}),
    getSelected: (characterId) => capability.invoke("getSelected", { characterId }),
    requestSelection: (characterId) => capability.invoke("requestSelection", { characterId }),
    dispose: capability.dispose
  });
}

// node_modules/@dokiworld/app-sdk/src/apps.js
var isRecord11 = (value) => Boolean(value && typeof value === "object" && !Array.isArray(value));
var isString8 = (value) => typeof value === "string" && value.length > 0;
var isApp = (value) => isRecord11(value) && isString8(value.id) && isString8(value.name) && Number.isInteger(value.protocolVersion) && isBoundedCapabilityValue(value);
var isContract2 = (value) => isRecord11(value) && isString8(value.contract) && Number.isInteger(value.version) && value.version > 0 && "data" in value && isBoundedCapabilityValue(value.data);
var isLaunchResult = (value) => isRecord11(value) && (value.status === "completed" && isContract2(value.output) || value.status === "cancelled" && value.output === void 0);
var definition6 = Object.freeze({ name: "apps", operations: Object.freeze({
  list: { input: (value) => isRecord11(value) && (value.capability === void 0 || isString8(value.capability)), output: (value) => isRecord11(value) && Array.isArray(value.apps) && value.apps.every(isApp) },
  launch: { input: (value) => isRecord11(value) && isString8(value.appId) && isContract2(value.input), output: isLaunchResult }
}) });
var DEFAULT_APP_LAUNCH_TIMEOUT_MS = 60 * 60 * 1e3;
function createAppsClientExtension(client, { launchTimeoutMs = DEFAULT_APP_LAUNCH_TIMEOUT_MS, ...options } = {}) {
  if (!Number.isFinite(launchTimeoutMs) || launchTimeoutMs <= 0) throw new Error("Invalid App launch timeout");
  const capability = createCapabilityClient(client, definition6, options);
  return Object.freeze({
    list: (filter = {}) => capability.invoke("list", filter),
    launch: (input) => capability.invoke("launch", input, { timeoutMs: launchTimeoutMs }),
    dispose: capability.dispose
  });
}

// src/game-options.js
function createGameOptions(config) {
  return Object.fromEntries(Object.entries({
    configId: config.configId,
    rows: config.rows,
    columns: config.columns ?? config.cols,
    moves: config.moves,
    timeLimit: config.timeLimit,
    targetScore: config.targetScore ?? config.target,
    seed: config.seed
  }).filter(([, value]) => value !== void 0 && value !== null));
}

// src/episode-game-result.js
var APP_RESULT_TEMPLATE = /\{\{app\.(outcome|score|maxScore|metrics\.([A-Za-z0-9_.:-]+))\}\}/g;
function interpolateAppResultTemplate(value, result2) {
  if (typeof value !== "string" || !result2 || typeof result2 !== "object") return value;
  return value.replace(APP_RESULT_TEMPLATE, (token, field, metricKey) => {
    let resolved;
    if (field === "outcome") resolved = result2.outcome;
    else if (field === "score") resolved = result2.normalizedScore;
    else if (field === "maxScore") resolved = 100;
    else resolved = result2.metrics?.[metricKey];
    return ["string", "number", "boolean"].includes(typeof resolved) ? String(resolved) : token;
  });
}
function interpolateAppResultUtterances(utterances, result2) {
  if (!Array.isArray(utterances)) return utterances;
  return utterances.map((utterance) => {
    if (!utterance || typeof utterance !== "object" || Array.isArray(utterance)) {
      return utterance;
    }
    const segments = Array.isArray(utterance.segments) ? utterance.segments.map((segment) => {
      if (!segment || typeof segment !== "object" || Array.isArray(segment)) {
        return segment;
      }
      const options = Array.isArray(segment.options) ? segment.options.map((option) => option && typeof option === "object" && !Array.isArray(option) ? {
        ...option,
        label: interpolateAppResultTemplate(option.label, result2)
      } : option) : segment.options;
      return {
        ...segment,
        text: interpolateAppResultTemplate(segment.text, result2),
        ...Array.isArray(segment.options) ? { options } : {}
      };
    }) : utterance.segments;
    return {
      ...utterance,
      ...Array.isArray(utterance.segments) ? { segments } : {}
    };
  });
}
function resolveConfiguredAppResult(output, nextBeatId = null) {
  const result2 = parseGameResult(output);
  return result2 ? { result: result2, nextBeatId } : null;
}

// src/app.js
var WORLD_ID = "storyteller";
var APP_LAUNCH_TIMEOUT_MS = 60 * 60 * 1e3;
var COPY = {
  en: {
    waiting: "Preparing your story\u2026",
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
    loadingApp: "Opening app\u2026",
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
    chatPlaceholder: "Write a message\u2026",
    composerHint: "Enter to send \xB7 Shift + Enter for a new line",
    suggest: "Suggest a reply",
    tts: "Read dialogue aloud",
    textSize: "Change text size",
    skin: "Change appearance",
    regenerate: "Regenerate",
    you: "You",
    thinking: "Thinking\u2026",
    hidePortrait: "Hide portrait",
    showPortrait: "Show portrait",
    characterProfile: "Character profile",
    personality: "Personality",
    about: "About",
    hotComments: "Hot comments",
    commentsEmpty: "Comments will appear here when community replies are available.",
    jumpLatest: "Jump to latest",
    conversationStatus: "Interactive story \xB7 Encrypted conversation",
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
    generatingImage: "Generating image\u2026",
    generatingVideo: "Generating video\u2026",
    aiGenerated: "All replies are AI-generated. All characters are portrayed as adults (18 or older).",
    encrypted: "Your chats and account are encrypted.",
    gameResult: "Game result",
    resultComplete: "Challenge complete",
    resultScore: "Score",
    resultPoints: "Points",
    resultMoves: "Moves",
    resultCleared: "Cleared",
    resultBestCascade: "Best cascade",
    continueAfterGame: "Continue story"
  },
  "zh-cn": {
    waiting: "\u6B63\u5728\u51C6\u5907\u4F60\u7684\u6545\u4E8B\u2026",
    yourChoice: "\u4F60\u7684\u9009\u62E9",
    replyLabel: "\u6216\u8005\u5199\u4E0B\u4F60\u81EA\u5DF1\u7684\u56DE\u5E94",
    send: "\u53D1\u9001",
    episodeComplete: "\u672C\u96C6\u7ED3\u675F",
    continueStory: "\u6545\u4E8B\u8FD8\u53EF\u4EE5\u4ECE\u8FD9\u91CC\u7EE7\u7EED\u3002",
    continueLabel: "\u63A5\u4E0B\u6765\u4F60\u8981\u600E\u4E48\u505A\uFF1F",
    continue: "\u7EE7\u7EED",
    unable: "\u6682\u65F6\u65E0\u6CD5\u7EE7\u7EED",
    tryAgain: "\u5267\u96C6\u610F\u5916\u6682\u505C\u4E86\u3002",
    retry: "\u91CD\u8BD5",
    next: "\u4E0B\u4E00\u6BB5",
    interactiveApp: "\u4E92\u52A8\u5E94\u7528",
    loadingApp: "\u6B63\u5728\u6253\u5F00\u5E94\u7528\u2026",
    closeApp: "\u5173\u95ED\u5E94\u7528",
    replay: "\u91CD\u65B0\u4F53\u9A8C",
    replayVideo: "\u91CD\u64AD\u89C6\u9891",
    replayImage: "\u518D\u6B21\u67E5\u770B\u56FE\u7247",
    closeImage: "\u5173\u95ED\u56FE\u7247",
    kicker: "\u4E92\u52A8\u5267\u96C6",
    interactiveStory: "\u4E92\u52A8\u6545\u4E8B",
    appUnavailable: "\u914D\u7F6E\u7684\u5E94\u7528\u5F53\u524D\u4E0D\u53EF\u7528\u3002",
    appResultInvalid: "\u5E94\u7528\u5DF2\u7ED3\u675F\uFF0C\u4F46\u6CA1\u6709\u8FD4\u56DE\u6709\u6548\u7684\u6E38\u620F\u7ED3\u7B97\u3002",
    characterLabel: "\u89D2\u8272",
    chatPlaceholder: "\u5199\u4E0B\u4F60\u60F3\u8BF4\u7684\u8BDD\u2026",
    composerHint: "Enter \u53D1\u9001 \xB7 Shift + Enter \u6362\u884C",
    suggest: "\u63A8\u8350\u56DE\u590D",
    tts: "\u6717\u8BFB\u5BF9\u8BDD",
    textSize: "\u8C03\u6574\u6587\u5B57\u5927\u5C0F",
    skin: "\u5207\u6362\u5916\u89C2",
    regenerate: "\u91CD\u65B0\u751F\u6210",
    you: "\u4F60",
    thinking: "\u6B63\u5728\u601D\u8003\u2026",
    hidePortrait: "\u9690\u85CF\u7ACB\u7ED8",
    showPortrait: "\u663E\u793A\u7ACB\u7ED8",
    characterProfile: "\u89D2\u8272\u8D44\u6599",
    personality: "\u6027\u683C",
    about: "\u5173\u4E8E",
    hotComments: "\u70ED\u95E8\u8BC4\u8BBA",
    commentsEmpty: "\u793E\u533A\u56DE\u590D\u5F00\u653E\u540E\uFF0C\u8BC4\u8BBA\u4F1A\u663E\u793A\u5728\u8FD9\u91CC\u3002",
    jumpLatest: "\u56DE\u5230\u6700\u65B0\u6D88\u606F",
    conversationStatus: "\u4E92\u52A8\u6545\u4E8B \xB7 \u5BF9\u8BDD\u5DF2\u52A0\u5BC6",
    chooseRole: "\u9009\u62E9\u89D2\u8272\u5361",
    generateImage: "\u751F\u6210\u56FE\u7247",
    generateVideo: "\u751F\u6210\u89C6\u9891",
    roleCard: "\u89D2\u8272\u5361",
    roleCardHelp: "\u9009\u62E9\u4F60\u5728\u8FD9\u4E2A\u6545\u4E8B\u4E2D\u7684\u8EAB\u4EFD\u3002",
    roleName: "\u59D3\u540D",
    roleGender: "\u6027\u522B",
    roleAge: "\u5E74\u9F84",
    roleDescription: "\u89D2\u8272\u63CF\u8FF0",
    genderNeutral: "\u975E\u4E8C\u5143",
    genderFemale: "\u5973\u6027",
    genderMale: "\u7537\u6027",
    clearRole: "\u6E05\u9664",
    saveRole: "\u4FDD\u5B58\u5E76\u4F7F\u7528",
    playMessage: "\u64AD\u653E\u6D88\u606F",
    generatingImage: "\u6B63\u5728\u751F\u6210\u56FE\u7247\u2026",
    generatingVideo: "\u6B63\u5728\u751F\u6210\u89C6\u9891\u2026",
    aiGenerated: "\u6240\u6709\u56DE\u590D\u5747\u7531 AI \u751F\u6210\u3002\u6240\u6709\u89D2\u8272\u5747\u6309\u6210\u5E74\u4EBA\uFF0818 \u5C81\u6216\u4EE5\u4E0A\uFF09\u5448\u73B0\u3002",
    encrypted: "\u4F60\u7684\u5BF9\u8BDD\u548C\u8D26\u6237\u5747\u5DF2\u52A0\u5BC6\u3002",
    gameResult: "\u6E38\u620F\u7ED3\u7B97",
    resultComplete: "\u6311\u6218\u5B8C\u6210",
    resultScore: "\u8BC4\u5206",
    resultPoints: "\u5F97\u5206",
    resultMoves: "\u6B65\u6570",
    resultCleared: "\u6D88\u9664\u6570\u91CF",
    resultBestCascade: "\u6700\u9AD8\u8FDE\u51FB",
    continueAfterGame: "\u7EE7\u7EED\u5267\u60C5"
  }
};
var elements = {
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
  generateVideo: document.querySelector("#generate-video")
};
var dokiworld = createAppClient({
  appId: WORLD_ID,
  extensions: ["world", "episode", "chat", "dialogue", "media", "speech", "storage", "character", "persona", "apps", "checkpoint"]
});
var episode = createEpisodeClientExtension(dokiworld);
var dialogue = createDialogueClientExtension(dokiworld);
var media = createMediaClientExtension(dokiworld);
var speech = createSpeechClientExtension(dokiworld);
var storage = createStorageClientExtension(dokiworld);
var character = createCharacterClientExtension(dokiworld);
var persona = createPersonaClientExtension(dokiworld);
var apps = createAppsClientExtension(dokiworld, { timeoutMs: APP_LAUNCH_TIMEOUT_MS });
var locale = "en";
var copy = COPY.en;
var experience = null;
var queue = [];
var totalSegments = 0;
var presentedSegments = 0;
var waitingForHost = true;
var pendingAction = null;
var activeApp = null;
var appCatalog = [];
var ttsEnabled = false;
var textScaleIndex = 1;
var lightSkin = false;
var runtimeConfig = null;
var beatsById = /* @__PURE__ */ new Map();
var assetsById = /* @__PURE__ */ new Map();
var linkedBeatIds = /* @__PURE__ */ new Set();
var localActionBeat = null;
var localAppResultContext = null;
var hostedResultPending = false;
var playerPersona = null;
var activeVideo = null;
var activeImage = null;
var videoWatchdog = null;
var dialogueSessionId = null;
var speechAudio = null;
var VIDEO_LOAD_TIMEOUT_MS = 2e4;
var VIDEO_PLAYBACK_GRACE_MS = 1e4;
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
var replayingImage = false;
function isRecord12(value) {
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
    elements.controls
  ].forEach((node) => node.classList.add("is-hidden"));
  elements.video.pause();
}
function setComposerEnabled(enabled) {
  elements.chatInput.disabled = !enabled;
  elements.chatSend.disabled = !enabled || !elements.chatInput.value.trim();
  elements.suggest.disabled = !enabled;
}
async function speak(text, force = false) {
  if (!ttsEnabled && !force || !text.trim() || !experience?.characterId) return;
  speechAudio?.pause();
  try {
    const result2 = await speech.synthesize({
      text,
      characterId: experience.characterId,
      locale
    });
    speechAudio = new Audio(result2.audioUrl);
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
      playerPersonaId: playerPersona?.id || null
    }
  }).catch(() => void 0);
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
  elements.progress.style.width = `${Math.min(100, presentedSegments / Math.max(1, totalSegments) * 100)}%`;
}
function showControls() {
  updateProgress();
  if (elements.shell.dataset.phase === "dialogue") {
    const content = elements.lines.querySelector(".message-group.is-ai:last-of-type .message-content");
    if (content && !content.querySelector(".inline-next")) {
      const next = document.createElement("button");
      next.className = "inline-next";
      next.type = "button";
      next.textContent = `${copy.next}  \u2192`;
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
    if (!isRecord12(utterance) || !Array.isArray(utterance.segments)) return [];
    const speakerName = typeof utterance.speakerName === "string" ? utterance.speakerName.trim() : "";
    return utterance.segments.filter(isRecord12).map((segment) => ({ segment, speakerName }));
  });
}
function orderedBeats() {
  return Array.isArray(runtimeConfig?.beats) ? [...runtimeConfig.beats].filter(isRecord12).sort((a, b) => Number(a.position || 0) - Number(b.position || 0) || String(a.id).localeCompare(String(b.id))) : [];
}
function nextConfiguredBeat(beat) {
  if (typeof beat?.nextBeatId === "string") return beatsById.get(beat.nextBeatId) || null;
  if (typeof beat?.id === "string") {
    const inferredTargetIds = /* @__PURE__ */ new Set();
    beatsById.forEach((candidate) => {
      const options = Array.isArray(candidate?.choices?.options) ? candidate.choices.options : [];
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
  const visited = /* @__PURE__ */ new Set();
  while (beat && !visited.has(beat.id)) {
    visited.add(beat.id);
    if (Array.isArray(beat.utterances) && beat.utterances.some((utterance) => isRecord12(utterance) && utterance.source === "llm")) return true;
    if (beat.choices || beat.action) return false;
    beat = nextConfiguredBeat(beat);
  }
  return false;
}
function localPathItems(startBeatId) {
  const items = [];
  let beat = beatsById.get(startBeatId) || null;
  const visited = /* @__PURE__ */ new Set();
  while (beat && !visited.has(beat.id)) {
    visited.add(beat.id);
    const assetRefs = Array.isArray(beat.assets) ? [...beat.assets].filter(isRecord12).sort((a, b) => Number(a.position || 0) - Number(b.position || 0)) : [];
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
          localAuthored: true
        }
      });
    });
    (Array.isArray(beat.utterances) ? beat.utterances : []).forEach((utterance) => {
      if (!isRecord12(utterance) || utterance.source === "llm") return;
      (Array.isArray(utterance.segments) ? utterance.segments : []).forEach((segment) => {
        if (!isRecord12(segment)) return;
        items.push({
          speakerName: experience?.title || "",
          segment: {
            ...segment,
            text: interpolateAppResultTemplate(segment.text, localAppResultContext),
            beatId: beat.id,
            localAuthored: true
          }
        });
      });
    });
    if (isRecord12(beat.choices)) {
      const options = Array.isArray(beat.choices.options) ? beat.choices.options.map((option) => isRecord12(option) ? {
        ...option,
        label: interpolateAppResultTemplate(option.label, localAppResultContext)
      } : option) : [];
      items.push({
        speakerName: experience?.title || "",
        segment: {
          type: "choices",
          beatId: beat.id,
          text: interpolateAppResultTemplate(
            typeof beat.choices.description === "string" ? beat.choices.description : beat.goal,
            localAppResultContext
          ),
          options,
          allowFreeText: true,
          localAuthored: true
        }
      });
      break;
    }
    if (isRecord12(beat.action)) {
      items.push({
        speakerName: experience?.title || "",
        segment: {
          type: "game",
          beatId: beat.id,
          gameConfig: {
            gameType: "external",
            gameId: beat.action.appId,
            configId: beat.action.configId
          },
          localAuthored: true
        }
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
  while (queue.length && ["dialogue", "action", "thought", "narration"].includes(queue[0].segment.type)) {
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
    play.textContent = "\u25B6";
    play.setAttribute("aria-label", copy.playMessage);
    const bubble = document.createElement("div");
    bubble.className = "message-bubble";
    entry.items.forEach(({ segment }) => {
      const line = document.createElement("p");
      const type = ["dialogue", "action", "thought", "narration"].includes(segment.type) ? segment.type : "narration";
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
    if (groupIndex === groups.length - 1 && !entry.items.some(({ segment }) => segment.localAuthored === true)) {
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
        elements.video.duration * 1e3 + VIDEO_PLAYBACK_GRACE_MS
      )
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
  const media2 = document.createElement("video");
  media2.className = "completed-video-media";
  media2.src = src;
  media2.controls = true;
  media2.playsInline = true;
  media2.preload = "metadata";
  media2.setAttribute("aria-label", copy.replayVideo);
  const frame = document.createElement("div");
  frame.className = "completed-video-frame";
  const replay = document.createElement("button");
  replay.className = "completed-video-replay";
  replay.type = "button";
  replay.textContent = "\u25B6";
  replay.setAttribute("aria-label", copy.replayVideo);
  replay.addEventListener("click", () => void media2.play().catch(() => void 0));
  media2.addEventListener("play", () => replay.classList.add("is-hidden"));
  media2.addEventListener("pause", () => replay.classList.remove("is-hidden"));
  media2.addEventListener("ended", () => replay.classList.remove("is-hidden"));
  frame.append(media2, replay);
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
      playerPersona
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
      playerPersona
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
  const suggestions = Array.isArray(items) ? items.filter((item) => typeof item === "string" && item.trim()).slice(0, 3) : [];
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
      playerPersona
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
  const media2 = document.createElement(type === "video" ? "video" : "img");
  media2.className = "generated-chat-media";
  media2.src = src;
  if (type === "video") {
    media2.controls = true;
    media2.playsInline = true;
  } else media2.alt = "";
  bubble.append(media2);
  bubble.prepend(heading);
  content.append(bubble);
  group.append(content);
  elements.lines.append(group);
  elements.dialogueView.scrollTo({ top: elements.dialogueView.scrollHeight, behavior: "smooth" });
}
function renderChoices(item) {
  const options = Array.isArray(item.segment.options) ? item.segment.options.filter((option) => isRecord12(option) && typeof option.id === "string") : [];
  if (!options.length) return renderNext();
  presentedSegments += 1;
  hideViews();
  elements.shell.dataset.phase = "choice";
  elements.choicePrompt.textContent = typeof item.segment.text === "string" && item.segment.text.trim() ? item.segment.text : copy.yourChoice;
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
      const hasDeterministicProgress = deterministicItems.some(({ segment }) => ["image", "video", "game", "choices"].includes(segment.type));
      if (item.segment.localAuthored === true && targetBeatId && (!pathNeedsLlm(targetBeatId) || hasDeterministicProgress)) {
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
        optionId: option.id
      });
    });
    elements.choices.append(button);
  });
  elements.choiceView.classList.remove("is-hidden");
  window.setTimeout(() => elements.choices.querySelector("button")?.focus(), 80);
}
async function findConfiguredApp(gameId) {
  const app = appCatalog.find((entry) => isRecord12(entry) && entry.id === gameId && entry.protocolVersion === 2);
  if (!app) throw new Error("app unavailable");
  return app;
}
async function openConfiguredApp(config) {
  const gameId = typeof config?.gameId === "string" && config.gameId.trim() ? config.gameId.trim() : config?.gameType === "match3" || config?.gameType === "builtin" ? "game-match3" : "";
  if (!gameId) {
    showError(copy.appUnavailable);
    return;
  }
  try {
    hostedResultPending = false;
    elements.shell.dataset.phase = "app";
    const app = await findConfiguredApp(gameId);
    const runtime = isRecord12(app.runtime) ? app.runtime : {};
    const launch = await apps.launch({
      appId: gameId,
      input: {
        contract: runtime.input?.contract || "doki.game.match3-input",
        version: runtime.input?.version || 1,
        data: { options: createGameOptions(config) }
      }
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
function renderGameResult(result2, nextBeatId, config, onContinue = null) {
  showDialogueHistory();
  const card = document.createElement("article");
  card.className = "game-result-panel";
  const kicker = document.createElement("span");
  kicker.className = "game-result-kicker";
  kicker.textContent = `\u2726  ${copy.gameResult}`;
  const title = document.createElement("h2");
  title.textContent = typeof config?.title === "string" && config.title.trim() ? config.title : copy.resultComplete;
  const summary = document.createElement("div");
  summary.className = "game-result-summary";
  const scoreLabel = document.createElement("span");
  scoreLabel.textContent = copy.resultScore;
  const score = document.createElement("strong");
  const normalizedScore = Number(result2.normalizedScore);
  score.textContent = Number.isFinite(normalizedScore) ? `${Math.round(Math.max(0, Math.min(100, normalizedScore)))} / 100` : copy.resultComplete;
  summary.append(scoreLabel, score);
  const metrics = isRecord12(result2.metrics) ? result2.metrics : {};
  const metricDefinitions = [
    ["points", copy.resultPoints],
    ["moves", copy.resultMoves],
    ["cleared", copy.resultCleared],
    ["bestCascade", copy.resultBestCascade]
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
    next.textContent = `${copy.continueAfterGame}  \u2192`;
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
  const media2 = document.createElement("img");
  media2.className = "completed-image-media";
  media2.src = src;
  media2.alt = typeof item.segment.caption === "string" ? item.segment.caption : "";
  media2.loading = "lazy";
  preview.append(media2);
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
  const result2 = parseGameResult(output);
  if (!result2) {
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
    output
  });
  closeConfiguredApp(false);
  renderGameResult(result2, null, config);
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
  if (isRecord12(output)) {
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
function completeHostedConfiguredApp(result2, utterances = null) {
  const interpolatedUtterances = Array.isArray(utterances) ? interpolateAppResultUtterances(utterances, result2) : null;
  if (hostedResultPending) {
    hostedResultPending = false;
    if (interpolatedUtterances) acceptEpisode(interpolatedUtterances);
    else showDialogueHistory();
    return;
  }
  const config = activeApp?.config || pendingAction?.gameConfig || {};
  const continueWithNarrative = interpolatedUtterances ? () => acceptEpisode(interpolatedUtterances) : null;
  closeConfiguredApp(false);
  renderGameResult(result2, null, config, continueWithNarrative);
}
function requestAction(item) {
  const beatId = typeof item.segment.beatId === "string" ? item.segment.beatId : "";
  if (!beatId) return renderNext();
  presentedSegments += 1;
  pendingAction = item.segment;
  const configuredBeat = beatsById.get(beatId) || null;
  const target = nextConfiguredBeat(configuredBeat);
  if (item.segment.localAuthored === true && (!target || !pathNeedsLlm(target.id))) {
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
  void storage.clearCheckpoint().catch(() => void 0);
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
  const candidate = isRecord12(message.experience) ? message.experience : {};
  experience = {
    characterId: typeof candidate.characterId === "string" ? candidate.characterId : "",
    title: typeof candidate.title === "string" ? candidate.title : "",
    description: typeof candidate.description === "string" ? candidate.description : "",
    portraitUrl: safeUrl(candidate.portraitUrl),
    avatarUrl: safeUrl(candidate.avatarUrl) || safeUrl(candidate.portraitUrl),
    tags: Array.isArray(candidate.tags) ? candidate.tags.filter((tag) => typeof tag === "string" && tag.trim()).slice(0, 2) : []
  };
  runtimeConfig = isRecord12(candidate.config) ? candidate.config : null;
  const beats = Array.isArray(runtimeConfig?.beats) ? runtimeConfig.beats.filter(isRecord12) : [];
  const assets = Array.isArray(runtimeConfig?.assets) ? runtimeConfig.assets.filter(isRecord12) : [];
  beatsById = new Map(beats.map((beat) => [beat.id, beat]));
  assetsById = new Map(assets.map((asset) => [asset.id, asset]));
  linkedBeatIds = new Set(beats.flatMap((beat) => [
    ...typeof beat.nextBeatId === "string" ? [beat.nextBeatId] : [],
    ...Array.isArray(beat.choices?.options) ? beat.choices.options.flatMap((option) => typeof option?.nextBeatId === "string" ? [option.nextBeatId] : []) : []
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
  elements.railCharacterTags.textContent = experience.tags.join(" \xB7 ") || copy.interactiveStory;
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
    description: elements.personaDescription.value.trim()
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
      characterId: experience?.characterId || void 0,
      portraitUrl: experience?.portraitUrl || void 0,
      playerPersona
    };
    const submitted = mediaType === "video" ? await media.generateVideo(request) : await media.generateImage({
      ...request,
      prompt: dialogueSessionId ? void 0 : experience?.description || experience?.title
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
    const data = isRecord12(input.data) ? input.data : {};
    const [checkpointResult, characterResult, personaResult, appsResult] = await Promise.allSettled([
      storage.loadCheckpoint(),
      character.getCurrent(),
      data.experience?.characterId ? persona.getSelected(data.experience.characterId) : Promise.resolve({ persona: null }),
      apps.list()
    ]);
    const currentCharacter = characterResult.status === "fulfilled" ? characterResult.value.character : null;
    initialize({
      locale: nextLocale,
      ...data,
      ...currentCharacter ? {
        experience: {
          ...isRecord12(data.experience) ? data.experience : {},
          characterId: currentCharacter.id,
          title: currentCharacter.name,
          description: currentCharacter.description,
          portraitUrl: currentCharacter.portraitUrl,
          avatarUrl: currentCharacter.avatarUrl,
          tags: currentCharacter.tags
        }
      } : {}
    });
    if (checkpointResult.status === "fulfilled") {
      const checkpointData = checkpointResult.value.checkpoint?.data;
      if (isRecord12(checkpointData) && Number.isInteger(checkpointData.dialogueSessionId)) {
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
          "zh-cn": { name: app.name, description: app.description || "" }
        }
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
  }
});
