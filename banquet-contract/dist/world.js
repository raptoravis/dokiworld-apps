// ../../dokiworld.git/packages/app-sdk/src/index.js
var APP_PROTOCOL = "dokiworld.app";
var APP_PROTOCOL_VERSION = 2;
var MAX_ID_LENGTH = 200;
var MAX_RESULT_BYTES = 64 * 1024;
var MAX_RESULT_DEPTH = 12;
var MAX_RESULT_NODES = 2e3;
var SEMANTIC_ID_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
var APP_EXIT_REASONS = /* @__PURE__ */ new Set(["user-requested", "app-requested", "blocked"]);
var HOST_EXIT_REASONS = /* @__PURE__ */ new Set(["host-close-button", "navigation", "session-ended"]);
var EXIT_DECISIONS = /* @__PURE__ */ new Set(["stay", "discard", "suspend"]);
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
var AppExitStateTimeoutError = class extends Error {
  constructor() {
    super("The app did not answer the exit preparation request");
    this.name = "AppExitStateTimeoutError";
    this.code = "exit-state-timeout";
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
function parseExternalAppReadyMessage(value, expectedAppId) {
  if (!isRecord(value) || "runId" in value || "messageId" in value) return null;
  if (value.type !== "dokiworld-app-ready" || value.protocol !== APP_PROTOCOL || value.protocolVersion !== APP_PROTOCOL_VERSION || value.appId !== expectedAppId || !isBoundedId(value.instanceId)) return null;
  return { type: "dokiworld-app-ready", protocol: APP_PROTOCOL, protocolVersion: APP_PROTOCOL_VERSION, appId: expectedAppId, instanceId: value.instanceId };
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
function parseExternalAppCompleteMessage(value, expected) {
  const message = parseExternalAppSessionMessage(value, expected);
  if (!message || message.type !== "dokiworld-app-complete") return null;
  const { resultId, output } = message.payload;
  if (!isBoundedId(resultId) || !isRecord(output) || !isContract(output)) return null;
  if (!expected.outputs.some((candidate) => candidate.contract === output.contract && candidate.version === output.version)) return null;
  if (!("data" in output) || !isBoundedJson(output.data)) return null;
  return { ...message, type: "dokiworld-app-complete", payload: { resultId, output: { contract: output.contract, version: output.version, data: output.data } } };
}
function createSessionEnvelope(type, identity, payload) {
  if (!isBoundedId(identity.appId) || !isBoundedId(identity.instanceId) || !isBoundedId(identity.runId) || !isBoundedId(identity.messageId)) throw new Error("Invalid external app session identity");
  return { type, protocol: APP_PROTOCOL, protocolVersion: APP_PROTOCOL_VERSION, appId: identity.appId, instanceId: identity.instanceId, runId: identity.runId, messageId: identity.messageId, payload };
}
function createExternalAppInitMessage({ appId, instanceId, runId, messageId, locale: locale2, grantedScopes, context, input }) {
  return createSessionEnvelope("dokiworld-app-init", { appId, instanceId, runId, messageId }, { locale: locale2, grantedScopes: [...grantedScopes], context, input });
}
function createExternalAppCompleteAck({ resultId, status, error, ...identity }) {
  if (!isBoundedId(resultId) || status !== "accepted" && status !== "rejected") throw new Error("Invalid external app completion acknowledgement");
  return createSessionEnvelope("dokiworld-app-complete-ack", identity, { resultId, status, ...error ? { error } : {} });
}
function parseExternalAppRequestExitMessage(value, expected) {
  const message = parseExternalAppSessionMessage(value, expected);
  if (!message || message.type !== "dokiworld-app-request-exit" || !APP_EXIT_REASONS.has(String(message.payload.reason))) return null;
  return { ...message, type: "dokiworld-app-request-exit", payload: { reason: message.payload.reason } };
}
function parseExternalAppExitStateMessage(value, expected) {
  const message = parseExternalAppSessionMessage(value, expected);
  if (!message || message.type !== "dokiworld-app-exit-state" || typeof message.payload.isDirty !== "boolean" || typeof message.payload.canSuspend !== "boolean") return null;
  return { ...message, type: "dokiworld-app-exit-state", payload: { isDirty: message.payload.isDirty, canSuspend: message.payload.canSuspend } };
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
        const state = await handlers.onPrepareExit?.(message.payload.reason) ?? { isDirty: false, canSuspend: false };
        sendSession("dokiworld-app-exit-state", { isDirty: Boolean(state.isDirty), canSuspend: Boolean(state.canSuspend) });
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
function createAppHost({
  appId,
  runId,
  target,
  init,
  outputs,
  scope = window,
  targetOrigin = "*",
  createId = defaultId,
  extensions = [],
  initRetryMs = 500,
  exitStateTimeoutMs = 3e3
} = {}) {
  if (!isBoundedId(appId) || !isBoundedId(runId) || !target?.postMessage) throw new Error("Invalid app host identity or target");
  if (!isRecord(init) || typeof init.locale !== "string" || !Array.isArray(init.grantedScopes) || !init.grantedScopes.every((value) => typeof value === "string") || !isRecord(init.context) || !isRecord(init.input) || !isContract(init.input) || !("data" in init.input) || !isBoundedJson(init.input.data) || !Array.isArray(outputs) || !outputs.every(isContract)) throw new Error("Invalid app host contract");
  if (!Number.isFinite(initRetryMs) || initRetryMs <= 0 || !Number.isFinite(exitStateTimeoutMs) || exitStateTimeoutMs <= 0) throw new Error("Invalid app host retry timing");
  const extensionTypes = createExtensionSet(extensions);
  let instanceId = null;
  let initMessage = null;
  let connected = false;
  let disposed = false;
  let handlers = {};
  let initTimer = null;
  let initializedInstanceId = null;
  let pendingExit = null;
  const completionDecisions = /* @__PURE__ */ new Map();
  const messageListeners = /* @__PURE__ */ new Set();
  const post = (message) => target.postMessage(message, targetOrigin);
  const identity = () => {
    if (!instanceId) throw new Error("The app has not sent ready");
    return { appId, instanceId, runId };
  };
  const sendSession = (type, payload) => {
    const message = createSessionEnvelope(type, { ...identity(), messageId: createId("message") }, payload);
    post(message);
    return message;
  };
  const sendInit = () => {
    if (!instanceId) return;
    initMessage ??= createExternalAppInitMessage({ appId, instanceId, runId, messageId: createId("message"), ...init });
    post(initMessage);
    if (initTimer === null) {
      initTimer = setInterval(() => {
        if (initMessage) post(initMessage);
      }, initRetryMs);
    }
  };
  const sendCompletionAck = (resultId, decision) => {
    const ack = createExternalAppCompleteAck({ ...identity(), messageId: createId("message"), resultId, ...decision });
    post(ack);
  };
  const handleMessage = async (event) => {
    if (disposed || !connected || event.source !== target) return;
    const ready = parseExternalAppReadyMessage(event.data, appId);
    if (ready) {
      if (instanceId !== ready.instanceId) {
        instanceId = ready.instanceId;
        initMessage = null;
        initializedInstanceId = null;
        if (initTimer !== null) {
          clearInterval(initTimer);
          initTimer = null;
        }
      }
      sendInit();
      return;
    }
    if (!instanceId) return;
    const message = parseExternalAppSessionMessage(event.data, identity());
    if (!message) return;
    if (message.type === "dokiworld-app-initialized") {
      if (initTimer !== null) {
        clearInterval(initTimer);
        initTimer = null;
      }
      if (initializedInstanceId !== instanceId) {
        initializedInstanceId = instanceId;
        await handlers.onInitialized?.();
      }
      return;
    }
    if (message.type === "dokiworld-app-complete") {
      const complete = parseExternalAppCompleteMessage(event.data, { ...identity(), outputs });
      if (!complete) return;
      let decisionPromise = completionDecisions.get(complete.payload.resultId);
      if (!decisionPromise) {
        decisionPromise = Promise.resolve().then(() => handlers.onComplete?.(complete.payload.output) ?? { status: "accepted" }).catch((error) => {
          handlers.onError?.(error);
          return { status: "rejected", error: { code: "host-processing-failed" } };
        });
        completionDecisions.set(complete.payload.resultId, decisionPromise);
      }
      const decision = await decisionPromise;
      sendCompletionAck(
        complete.payload.resultId,
        decision?.status === "accepted" || decision?.status === "rejected" ? decision : { status: "rejected", error: { code: "invalid-host-decision" } }
      );
      return;
    }
    if (message.type === "dokiworld-app-request-exit") {
      const request = parseExternalAppRequestExitMessage(event.data, identity());
      if (request) await handlers.onRequestExit?.(request.payload.reason);
      return;
    }
    if (message.type === "dokiworld-app-exit-state") {
      const state = parseExternalAppExitStateMessage(event.data, identity());
      if (state && pendingExit) {
        clearTimeout(pendingExit.timer);
        const resolve = pendingExit.resolve;
        pendingExit = null;
        resolve(state.payload);
      }
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
    if (initTimer !== null) clearInterval(initTimer);
    if (pendingExit) {
      clearTimeout(pendingExit.timer);
      pendingExit.reject(new Error("The app host was disposed"));
      pendingExit = null;
    }
    messageListeners.clear();
  };
  return Object.freeze({
    appId,
    runId,
    get instanceId() {
      return instanceId;
    },
    connect(nextHandlers = {}) {
      if (disposed) throw new Error("The app host is disposed");
      if (connected) throw new Error("The app host is already connected");
      connected = true;
      handlers = nextHandlers;
      return dispose;
    },
    prepareExit(reason) {
      if (!HOST_EXIT_REASONS.has(reason)) throw new Error("Invalid app host exit reason");
      identity();
      if (pendingExit) return pendingExit.promise;
      let resolve;
      let reject;
      const promise = new Promise((resolvePromise, rejectPromise) => {
        resolve = resolvePromise;
        reject = rejectPromise;
      });
      const timer = setTimeout(() => {
        pendingExit = null;
        reject(new AppExitStateTimeoutError());
      }, exitStateTimeoutMs);
      pendingExit = { promise, resolve, reject, timer };
      sendSession("dokiworld-app-prepare-exit", { reason });
      return promise;
    },
    decideExit(decision) {
      if (!EXIT_DECISIONS.has(decision)) throw new Error("Invalid app exit decision");
      return sendSession("dokiworld-app-exit-decision", { decision });
    },
    send(type, payload = {}) {
      if (!isDeclaredExtensionMessage(type, extensionTypes) || RESERVED_HOST_MESSAGE_TYPES.has(type) || RESERVED_CLIENT_MESSAGE_TYPES.has(type)) throw new Error("Invalid or undeclared host extension message type");
      return sendSession(type, payload);
    },
    onMessage(listener) {
      if (disposed || typeof listener !== "function") throw new Error("Invalid app host message listener");
      messageListeners.add(listener);
      return () => messageListeners.delete(listener);
    },
    dispose
  });
}

// ../../dokiworld.git/packages/app-sdk/src/episode.js
var CLIENT_WIRE_TYPES = Object.freeze({
  "episode.start": "dokiworld-app-episode-start",
  "episode.restart": "dokiworld-app-episode-restart",
  "episode.choice": "dokiworld-app-episode-choice",
  "episode.reply": "dokiworld-app-episode-reply",
  "episode.action": "dokiworld-app-episode-action",
  "episode.gameResult": "dokiworld-app-episode-game-result",
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
var isRecord2 = (value) => Boolean(value && typeof value === "object" && !Array.isArray(value));
var isString = (value) => typeof value === "string";
var isOptionalRecord = (value) => value === void 0 || value === null || isRecord2(value);
var noPayload = (payload) => Object.keys(payload).length === 0;
var CLIENT_VALIDATORS = Object.freeze({
  "episode.start": noPayload,
  "episode.restart": noPayload,
  "episode.choice": (payload) => isString(payload.beatId) && isString(payload.optionId),
  "episode.reply": (payload) => isString(payload.playerInput) && isOptionalRecord(payload.playerPersona),
  "episode.action": (payload) => isString(payload.beatId),
  "episode.gameResult": (payload) => (payload.configId === void 0 || isString(payload.configId)) && isRecord2(payload.result),
  "chat.regenerate": (payload) => isOptionalRecord(payload.playerPersona),
  "chat.suggest": (payload) => isOptionalRecord(payload.playerPersona),
  "chat.generateMedia": (payload) => ["image", "video"].includes(payload.mediaType) && isOptionalRecord(payload.playerPersona)
});
var HOST_VALIDATORS = Object.freeze({
  "episode.content": (payload) => Array.isArray(payload.utterances),
  "episode.resuming": noPayload,
  "episode.error": (payload) => isString(payload.code),
  "episode.game": (payload) => isRecord2(payload.gameConfig),
  "episode.fixedGameResult": (payload) => isRecord2(payload.result),
  "episode.gameResolved": (payload) => isRecord2(payload.result) && Array.isArray(payload.utterances),
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
  if (!isRecord2(event) || !isString(event.type)) return null;
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
      if (!isRecord2(message) || !isString(message.type) || !isRecord2(message.payload)) return null;
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

// world.js
var WORLD_ID = "banquet-contract";
var CHECKPOINT_CONTRACT = "doki.world.banquet-contract";
var CHECKPOINT_VERSION = 1;
var GAME_ID = "game-match3";
var SECOND_ACT_VIDEO_ONE_SCENE = 3;
var SECOND_ACT_VIDEO_TWO_SCENE = 4;
var SECOND_ACT_VIDEO_ONE_SUBTITLES = [
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
  [105, 113, 15]
];
var SECOND_ACT_VIDEO_TWO_SUBTITLES = [
  [0, 6, 0],
  [6, 14, 1],
  [14, 19, 2],
  [19, 24, 3],
  [24, 32, 4],
  [32, 39, 5],
  [39, 47, 6],
  [47, 52, 7]
];
var WRITING_NOTE_REVEAL_START = 5;
var WRITING_NOTE_REVEAL_END = 7;
var WRITING_CHOICE_OPTION_IDS = /* @__PURE__ */ new Set([
  "apologize-and-hide",
  "define-as-mistake"
]);
var COPY = {
  en: {
    coverEyebrow: "An original interactive romance",
    chapterTitle: "Female-Oriented Game Script, Act One: A Night Out of Control",
    coverIntro: "One wrong name. One dangerous stranger. One morning that turns an accident into a contract.",
    begin: "Begin the story",
    cardHover: "Click the card",
    coverCredit: "A Banquet Contract World",
    chapterLabel: "Act One: A Night Out of Control",
    secondActChapterLabel: "Act Two: Yesterday\u2019s Memories",
    skip: "Skip \u203A",
    play: "Play video",
    pause: "Pause video",
    choiceEyebrow: "Your decision",
    choiceTitle: "But I can\u2019t just disappear. I should leave him a note\u2026",
    choiceNarration: "",
    choiceA: "Apologize and ask him to keep last night a secret.",
    choiceB: "Draw a firm line and define last night as an accident.",
    matchEyebrow: "",
    matchTitle: "Successfully steady Lily and keep her from discovering the \u201Ctruth\u201D about last night.",
    matchMoves: "10 moves",
    matchGoal: "Score as high as possible within 10 moves; Level 1 requires no specific match pattern.",
    secondActMatchTitle: "Complete the \u201Cperfect\u201D speech Ryan will use tonight.",
    secondActMatchGoal: "Score as high as possible within 10 moves.",
    gameLoading: "Preparing the puzzle\u2026",
    resultEyebrow: "Chapter result",
    secondActResultEyebrow: "Match-three result",
    points: "points",
    resultPerfectTitle: "Perfect",
    resultGoodTitle: "Good",
    resultPassTitle: "Pass",
    resultFailTitle: "Fail",
    resultLily: "Okay\u2026 get some rest. But call me later. I want the whole story.",
    secondActFeedbackPerfect: "Ryan reads it once, smiles, and says, \u201CPerfect. I\u2019ll use this tonight.\u201D",
    secondActFeedbackGood: "Ryan nods. \u201CThis works. Give it one final polish before tonight.\u201D",
    secondActFeedbackPass: "Ryan sets the draft down. \u201CIt will do, but the key lines still need tightening.\u201D",
    secondActFeedbackFail: "Ryan shakes his head. \u201CNot yet. The speech needs another rewrite.\u201D",
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
    secondActChoiceB: "If it gets me through tonight\u2026 I\u2019ll try it.",
    secondActVideo1: [
      "How did one stupid company event turn into all of this?",
      "Two weeks of overtime. Hundreds of guests. One final event.",
      "The project bonus will cover Dad\u2019s next round of treatment.",
      "So no matter what happens tonight, I can\u2019t afford to mess this up.",
      "Elena\u2019s still working? God, hasn\u2019t she been pulling crazy hours for almost two months now?",
      "Yeah. She looks exhausted. And apparently her ex, Ryan, is showing up tonight as the project lead and taking credit for the whole thing.",
      "Please. He only got that position because he hooked up with Vanessa\u2014the CEO\u2019s daughter. No way he would\u2019ve gotten it otherwise.",
      "And I heard he was already chasing Vanessa while he was still with Elena. The second Vanessa took the bait, he dumped Elena and started telling everyone she was the one who\u2019d been chasing him all along.",
      "Oh poor Elena, tonight\u2019s going to be brutal for her. She has to watch her ex take credit for her work\u2014and still smile at Vanessa because she needs that project bonus.",
      "At least Lily will be there.",
      "I can survive one night. Get the bonus, pay Dad\u2019s medical bill, and move on.",
      "Elena, please don\u2019t kill me.",
      "Something urgent came up. I can\u2019t make it tonight. I\u2019m so so sorry.",
      "But I have a backup plan!",
      "My cousin Alex just got back from London. He\u2019s free tonight, and I asked him to accompany you.",
      "Just introduce him as your new boyfriend. I already told him to make sure you look damn good tonight."
    ],
    secondActVideo2: [
      "Before you can even answer, Lily makes the decision for you.",
      "He\u2019ll be waiting at the hotel entrance. Tall, dark hair, black suit. You can\u2019t miss him.",
      "Love you! I\u2019ve gotta go. Bye!",
      "Elena, one more thing before you leave.",
      "Vanessa has decided that Ryan will deliver the closing speech tonight on behalf of management.",
      "Since you know the project better than anyone, you\u2019ll write the speech for him.",
      "Make it polished. Vanessa wants Ryan to sound like he led the project from the beginning.",
      "Send it to me before you leave for the hotel."
    ],
    episodeEyebrow: "Interactive episode",
    episodeContinue: "Continue",
    episodeLoading: "Preparing the next episode\u2026",
    episodeEnded: "This episode is complete.",
    episodeError: "The episode could not continue. Please try again.",
    episodeAuthenticationRequired: "Sign in to continue this episode.",
    episodeRetry: "Try again",
    writingChoicePrompt: "But I can\u2019t just disappear. I should leave him a note\u2026",
    characterPortrait: "Adrian character portrait",
    storyStage: "Interactive story",
    video1: [
      "Ugh... my head hurts. Where am I?",
      "Wait...is someone in the bathroom?",
      "Oh my God... Did I seriously sleep with Alex? Lily\u2019s cousin? My best friend\u2019s cousin?!",
      "How am I ever supposed to look Lily in the eye again? I\u2019m officially the worst friend ever...",
      "I need to get the hell out of here before things get any more awkward.",
      "But I can\u2019t just disappear. I should leave him a note\u2026"
    ],
    video2Who: "Who's Alex?",
    video2Message: "Good morning, Mr. Sinclair. The three acquisition we discussed yesterday has been handled. Do you have any further instructions for today?",
    video2Order: "Pull every name from last night\u2019s banquet, along with their full background. There\u2019s someone I intend to find.",
    video2Final: "An accident? ...We'll see about that.",
    episodeText: {
      "episode-one-narration": "But I can\u2019t just disappear. I should leave him a note\u2026",
      "episode-one-a-line": "Alex: Last night was a huge mistake. I had way too much to drink. Please forget this ever happened, and absolutely do not tell Lily. I am so sorry!",
      "episode-one-b-line": "You clearly define last night as an accident, draw a firm boundary, and leave the note under the water glass."
    },
    episodeChoices: {
      "apologize-and-hide": "Apologize and ask him to keep it a secret.",
      "define-as-mistake": "Draw a firm line and define last night as an accident."
    },
    episodeChoiceNotes: {
      "apologize-and-hide": "Alex: Last night was a huge mistake. I had way too much to drink. Please forget this ever happened, and absolutely do not tell Lily. I am so sorry!",
      "define-as-mistake": "You clearly define last night as an accident, draw a firm boundary, and leave the note under the water glass."
    }
  },
  "zh-cn": {
    coverEyebrow: "\u5973\u6027\u5411\u6C89\u6D78\u5F0F\u4E92\u52A8\u6545\u4E8B",
    chapterTitle: "\u5973\u6027\u5411\u6E38\u620F\u5267\u672C\u7B2C\u4E00\u5E55\uFF1A\u4E00\u591C\u5931\u63A7",
    coverIntro: "\u4E00\u4E2A\u53EB\u9519\u7684\u540D\u5B57\uFF0C\u4E00\u4E2A\u5371\u9669\u7684\u964C\u751F\u4EBA\uFF0C\u4E00\u573A\u88AB\u8BEF\u8BA4\u4E3A\u610F\u5916\u7684\u6E05\u6668\u3002",
    begin: "\u5F00\u59CB\u6545\u4E8B",
    cardHover: "\u70B9\u51FB\u5361\u9762",
    coverCredit: "Banquet Contract \u539F\u521B World",
    chapterLabel: "\u7B2C\u4E00\u5E55\uFF1A\u4E00\u591C\u5931\u63A7",
    secondActChapterLabel: "\u7B2C\u4E8C\u5E55\uFF1A\u6628\u65E5\u56DE\u5FC6",
    skip: "\u8DF3\u8FC7 \u203A",
    play: "\u64AD\u653E\u89C6\u9891",
    pause: "\u6682\u505C\u89C6\u9891",
    choiceEyebrow: "\u4F60\u7684\u9009\u62E9",
    choiceTitle: "\u4F46\u6211\u4E5F\u4E0D\u80FD\u5C31\u8FD9\u4E48\u6D88\u5931\uFF0C\u81F3\u5C11\u8BE5\u7ED9\u4ED6\u7559\u5F20\u4FBF\u6761\u2026\u2026",
    choiceNarration: "",
    choiceA: "\u8868\u793A\u62B1\u6B49\uFF0C\u8BF7\u4ED6\u66FF\u4F60\u4FDD\u5BC6",
    choiceB: "\u5212\u6E05\u754C\u9650\uFF0C\u628A\u6628\u665A\u5B9A\u4E49\u4E3A\u610F\u5916",
    matchEyebrow: "",
    matchTitle: "\u6210\u529F\u7A33\u4F4FLily\uFF0C\u4E0D\u8BA9Lily\u53D1\u73B0\u6628\u665A\u7684\u201C\u771F\u76F8\u201D",
    matchMoves: "\u9650\u5B9A10\u6B65",
    matchGoal: "\u9650\u5B9A10\u6B65\uFF0C\u770B\u6700\u9AD8\u83B7\u5F97\u51E0\u5206\uFF08\u7B2C\u4E00\u5173\u4E0D\u505A\u7279\u5B9A\u7684\u6D88\u9664\u56FE\u6848\u8981\u6C42\uFF09",
    secondActMatchTitle: "\u5B8C\u6210Ryan\u4ECA\u665A\u4F7F\u7528\u7684\u201C\u5B8C\u7F8E\u201D\u6F14\u8BB2\u7A3F\u3002",
    secondActMatchGoal: "\u9650\u5B9A10\u6B65\uFF0C\u770B\u6700\u9AD8\u83B7\u5F97\u591A\u5C11\u5206\u3002",
    gameLoading: "\u6B63\u5728\u51C6\u5907\u4E09\u6D88\u5173\u5361\u2026",
    resultEyebrow: "\u7B2C\u4E00\u7AE0\u7ED3\u679C",
    secondActResultEyebrow: "\u4E09\u6D88\u7ED3\u7B97\u753B\u9762",
    points: "\u5206",
    resultPerfectTitle: "Perfect",
    resultGoodTitle: "\u826F\u597D",
    resultPassTitle: "\u5408\u683C",
    resultFailTitle: "\u672A\u901A\u8FC7",
    resultLily: "\u597D\u5427\u2026\u2026\u4F60\u5148\u4F11\u606F\u3002\u4E0D\u8FC7\u665A\u70B9\u4E00\u5B9A\u8981\u6253\u7ED9\u6211\uFF0C\u6211\u8981\u542C\u5B8C\u6574\u7ECF\u8FC7\u3002",
    secondActFeedbackPerfect: "Ryan\u8BFB\u5B8C\u540E\u6EE1\u610F\u5730\u70B9\u5934\uFF1A\u201C\u5F88\u5B8C\u7F8E\uFF0C\u4ECA\u665A\u5C31\u7528\u8FD9\u4E00\u7248\u3002\u201D",
    secondActFeedbackGood: "Ryan\u70B9\u70B9\u5934\uFF1A\u201C\u8FD9\u7248\u80FD\u7528\uFF0C\u4ECA\u665A\u4E4B\u524D\u518D\u6DA6\u8272\u4E00\u4E0B\u3002\u201D",
    secondActFeedbackPass: "Ryan\u653E\u4E0B\u6F14\u8BB2\u7A3F\uFF1A\u201C\u52C9\u5F3A\u80FD\u7528\uFF0C\u4F46\u5173\u952E\u53E5\u8FD8\u9700\u8981\u518D\u6536\u7D27\u3002\u201D",
    secondActFeedbackFail: "Ryan\u6447\u4E86\u6447\u5934\uFF1A\u201C\u8FD8\u4E0D\u884C\uFF0C\u8FD9\u4EFD\u6F14\u8BB2\u7A3F\u9700\u8981\u91CD\u5199\u3002\u201D",
    resultContinue: "\u7EE7\u7EED",
    resultRestart: "\u91CD\u65B0\u5F00\u59CB",
    homeTitle: "\u4E3B\u754C\u9762",
    homeBackgroundNote: "\u80CC\u666F\u662F\u6E29\u99A8\u573A\u666F\uFF08\u5BA4\u5185\u5BA4\u5916\u90FD\u53EF\uFF09",
    homeCharacterPlaceholder: "\u8FD9\u662F\u7ACB\u7ED8",
    homePrimaryControlsLabel: "\u966A\u4F34\u529F\u80FD",
    homeSecondaryControlsLabel: "\u89D2\u8272\u4E0E\u5267\u60C5\u529F\u80FD",
    homeImmersiveCompanion: "\u6C89\u6D78\n\u966A\u4F34",
    homeChangeBackground: "\u66F4\u6362\n\u80CC\u666F",
    homeChat: "\u95F2\n\u804A",
    homePoke: "\u6233\n\u6233",
    homeChangeOutfit: "\u6362\n\u88C5",
    homeContinueStory: "\u7EE7\u7EED\n\u5267\u60C5",
    secondActUnavailable: "\u7B2C\u4E8C\u5E55\u89C6\u9891\u8D44\u6E90\u5C1A\u672A\u5C31\u7EEA\u3002",
    secondActChoiceA: "\u8BA9\u4E00\u4E2A\u5B8C\u5168\u4E0D\u8BA4\u8BC6\u7684\u4EBA\u5047\u88C5\u6211\u7537\u670B\u53CB\uFF1F\u7EDD\u5BF9\u4E0D\u884C\u3002",
    secondActChoiceB: "\u5982\u679C\u8FD9\u6837\u80FD\u8BA9\u6211\u6491\u8FC7\u4ECA\u665A\u2026\u2026\u6211\u53EF\u4EE5\u8BD5\u8BD5\u3002",
    secondActVideo1: [
      "\u4E00\u573A\u8BE5\u6B7B\u7684\u516C\u53F8\u6D3B\u52A8\uFF0C\u600E\u4E48\u4F1A\u53D8\u6210\u73B0\u5728\u8FD9\u6837\uFF1F",
      "\u8FDE\u7EED\u52A0\u73ED\u4E24\u4E2A\u661F\u671F\uFF0C\u51E0\u767E\u540D\u5609\u5BBE\uFF0C\u6700\u540E\u8FD9\u4E00\u573A\u6D3B\u52A8\u3002",
      "\u8FD9\u4E2A\u9879\u76EE\u7684\u5956\u91D1\uFF0C\u6B63\u597D\u80FD\u591F\u652F\u4ED8\u7238\u7238\u4E0B\u4E00\u9636\u6BB5\u7684\u6CBB\u7597\u8D39\u3002",
      "\u6240\u4EE5\u65E0\u8BBA\u4ECA\u665A\u53D1\u751F\u4EC0\u4E48\uFF0C\u6211\u90FD\u7EDD\u4E0D\u80FD\u628A\u4E8B\u60C5\u641E\u7838\u3002",
      "Elena\u8FD8\u5728\u52A0\u73ED\uFF1F\u5929\u5450\uFF0C\u5979\u662F\u4E0D\u662F\u5DF2\u7ECF\u75AF\u72C2\u52A0\u73ED\u5FEB2\u4E2A\u6708\u4E86\uFF1F",
      "\u662F\u554A\uFF0C\u6211\u770B\u5979\u6700\u8FD1\u53EF\u6194\u60B4\u4E86\uFF0C\u4F46\u662F\u6211\u542C\u8BF4\u554A\uFF0C\u5979\u524D\u7537\u53CBRyan\u8981\u4F5C\u4E3A\u8FD9\u4E2A\u9879\u76EE\u7684\u8D1F\u8D23\u4EBA\u51FA\u5E2D\u5462\uFF0C\u8FD8\u628A\u529F\u52B3\u90FD\u63FD\u5230\u4E86\u81EA\u5DF1\u8EAB\u4E0A\uFF01",
      "\u5567\u5567\u5567\uFF0C\u4ED6\u4E5F\u5C31\u662F\u508D\u4E0A\u4E86\u603B\u88C1\u7684\u5973\u513FVanessa\uFF0C\u4E0D\u7136\u8D1F\u8D23\u4EBA\u7684\u4F4D\u7F6E\u600E\u4E48\u4F1A\u8F6E\u5F97\u5230\u4ED6\u3002",
      "\u6211\u8FD8\u542C\u8BF4\u554A\uFF0C\u4ED6\u662F\u8FD8\u5728\u548CElena\u8C08\u7684\u65F6\u5019\u5C31\u8D39\u5C3D\u5FC3\u601D\u53BB\u52FE\u642DVanessa\u4E86\uFF0C\u4E00\u508D\u4E0A\u4E4B\u540E\u7ACB\u9A6C\u8BF4\u4E4B\u524D\u90FD\u662FElena\u5012\u8D34\u4ED6\u5462\uFF01",
      "\u90A3\u4ECA\u665A\u7684\u6D3B\u52A8\uFF0CElena\u5C82\u4E0D\u662F\u5F88\u5BB9\u6613\u96BE\u582A\uFF1F\u773C\u770B\u7740\u524D\u7537\u53CB\u8981\u62FF\u5C5E\u4E8E\u81EA\u5DF1\u7684\u8363\u8A89\u548C\u6210\u679C\uFF0C\u4F46\u662F\u4E3A\u4E86\u9879\u76EE\u5956\u91D1\uFF0C\u8FD8\u5F97\u5BF9Vanessa\u7B11\u8138\u76F8\u8FCE\u3002",
      "\u81F3\u5C11Lily\u4E4B\u524D\u8BF4\u4F1A\u548C\u6211\u4E00\u8D77\u53C2\u52A0\u6D3B\u52A8\uFF0C\u966A\u6211\u6E21\u8FC7\u4ECA\u665A\u3002",
      "\u6211\u53EA\u9700\u8981\u6491\u8FC7\u8FD9\u4E00\u665A\u3002\u62FF\u5230\u5956\u91D1\uFF0C\u4EA4\u4E0A\u7238\u7238\u7684\u6CBB\u7597\u8D39\uFF0C\u7136\u540E\u5F7B\u5E95\u5411\u524D\u8D70\u3002",
      "Elena\uFF0C\u4F60\u5148\u7B54\u5E94\u4E0D\u8981\u6740\u4E86\u6211\u3002",
      "\u6211\u4E34\u65F6\u9047\u5230\u4E86\u4E00\u4EF6\u6025\u4E8B\uFF0C\u4ECA\u665A\u53BB\u4E0D\u4E86\u4E86\u3002\u771F\u7684\u975E\u5E38\u62B1\u6B49\u3002",
      "\u4F46\u662F\u6211\u51C6\u5907\u4E86\u4E00\u4E2A\u8865\u6551\u65B9\u6848\uFF01",
      "\u6211\u8868\u54E5Alex\u521A\u4ECE\u4F26\u6566\u56DE\u6765\u3002\u4ED6\u4ECA\u665A\u6B63\u597D\u6709\u7A7A\uFF0C\u6211\u5DF2\u7ECF\u62DC\u6258\u4ED6\u966A\u4F60\u53C2\u52A0\u665A\u5BB4\u4E86\u3002",
      "\u4F60\u5C31\u628A\u4ED6\u4ECB\u7ECD\u6210\u4F60\u7684\u65B0\u7537\u670B\u53CB\u3002\u6211\u5DF2\u7ECF\u544A\u8BC9\u4ED6\u8981\u66FF\u4F60\u597D\u597D\u6491\u4E00\u6491\u4ECA\u665A\u7684\u573A\u9762\uFF01"
    ],
    secondActVideo2: [
      "\u8FD8\u6CA1\u7B49\u4F60\u56DE\u590D\uFF0CLily\u5DF2\u7ECF\u6700\u7EC8\u62CD\u677F\u4E86\u3002",
      "\u5C31\u8FD9\u4E48\u5B9A\u4E86\uFF01\u4ED6\u4F1A\u5728\u9152\u5E97\u95E8\u53E3\u7B49\u4F60\u3002\u4E2A\u5B50\u5F88\u9AD8\uFF0C\u6DF1\u8272\u5934\u53D1\uFF0C\u7A7F\u9ED1\u8272\u897F\u88C5\u3002\u4F60\u7EDD\u5BF9\u4E0D\u4F1A\u8BA4\u9519\u3002",
      "\u7231\u4F60\u54E6\uFF01\u6211\u6709\u4E8B\u5148\u6302\u4E86\uFF01",
      "Elena\uFF0C\u4F60\u79BB\u5F00\u524D\u8FD8\u6709\u4E00\u4EF6\u4E8B\u3002",
      "Vanessa\u4E34\u65F6\u51B3\u5B9A\uFF0C\u7531Ryan\u4EE3\u8868\u7BA1\u7406\u5C42\u53D1\u8868\u4ECA\u665A\u7684\u95ED\u5E55\u6F14\u8BB2\u3002",
      "\u65E2\u7136\u4F60\u6BD4\u4EFB\u4F55\u4EBA\u90FD\u4E86\u89E3\u8FD9\u4E2A\u9879\u76EE\uFF0C\u4ED6\u7684\u6F14\u8BB2\u7A3F\u5C31\u7531\u4F60\u6765\u5199\u3002",
      "\u628A\u7A3F\u5B50\u5199\u5F97\u6F02\u4EAE\u4E00\u70B9\u3002Vanessa\u5E0C\u671BRyan\u542C\u8D77\u6765\u50CF\u662F\u4ECE\u4E00\u5F00\u59CB\u5C31\u5728\u9886\u5BFC\u8FD9\u4E2A\u9879\u76EE\u3002",
      "\u53BB\u9152\u5E97\u4E4B\u524D\u53D1\u7ED9\u6211\u3002"
    ],
    episodeEyebrow: "\u4E92\u52A8\u5267\u96C6",
    episodeContinue: "\u7EE7\u7EED",
    episodeLoading: "\u6B63\u5728\u51C6\u5907\u4E0B\u4E00\u6BB5\u5267\u60C5\u2026",
    episodeEnded: "\u672C\u96C6\u5267\u60C5\u5DF2\u7ED3\u675F\u3002",
    episodeError: "\u5267\u60C5\u6682\u65F6\u65E0\u6CD5\u7EE7\u7EED\uFF0C\u8BF7\u91CD\u8BD5\u3002",
    episodeAuthenticationRequired: "\u8BF7\u5148\u767B\u5F55\uFF0C\u518D\u7EE7\u7EED\u672C\u96C6\u5267\u60C5\u3002",
    episodeRetry: "\u91CD\u8BD5",
    writingChoicePrompt: "\u4F46\u6211\u4E5F\u4E0D\u80FD\u5C31\u8FD9\u4E48\u6D88\u5931\uFF0C\u81F3\u5C11\u8BE5\u7ED9\u4ED6\u7559\u5F20\u4FBF\u6761\u2026\u2026",
    characterPortrait: "Adrian \u89D2\u8272\u7ACB\u7ED8",
    storyStage: "\u4E92\u52A8\u5267\u60C5",
    video1: [
      "\u5636\u2026\u2026\u5934\u597D\u75DB\uFF0C\u6211\u8FD9\u662F\u5728\u54EA\uFF1F",
      "\u7B49\u7B49\u2026\u2026\u6D74\u5BA4\u600E\u4E48\u6709\u4EBA\u2026\u2026\uFF1F",
      "\u5929\u54EA\u2026\u2026\u6211\u5C45\u7136\u771F\u7684\u548CAlex\u7761\u4E86\uFF1FLily\u7684\u8868\u54E5\uFF1F\u6211\u6700\u597D\u670B\u53CB\u7684\u8868\u54E5\uFF1F\uFF01",
      "\u6211\u4EE5\u540E\u8FD8\u600E\u4E48\u9762\u5BF9Lily\u554A\uFF1F\u6211\u7B80\u76F4\u662F\u53F2\u4E0A\u6700\u5DEE\u52B2\u7684\u670B\u53CB\u2026\u2026",
      "\u6211\u5F97\u5728\u4E8B\u60C5\u53D8\u5F97\u66F4\u5C34\u5C2C\u524D\u8D76\u7D27\u5F00\u6E9C\u3002",
      "\u4F46\u6211\u4E5F\u4E0D\u80FD\u5C31\u8FD9\u4E48\u6D88\u5931\uFF0C\u81F3\u5C11\u8BE5\u7ED9\u4ED6\u7559\u5F20\u4FBF\u6761\u2026\u2026"
    ],
    video2Who: "\u8C01\u662FAlex\uFF1F",
    video2Message: "\u65E9\u4E0A\u597D\uFF0CSinclair \u5148\u751F\u3002\u6628\u5929\u8BA8\u8BBA\u7684\u4E09\u9879\u6536\u8D2D\u5DF2\u7ECF\u5904\u7406\u5B8C\u6BD5\u3002\u60A8\u4ECA\u5929\u8FD8\u6709\u5176\u4ED6\u6307\u793A\u5417\uFF1F",
    video2Order: "\u628A\u6628\u665A\u5BB4\u4F1A\u6240\u6709\u4EBA\u7684\u540D\u5355\u548C\u8BE6\u7EC6\u80CC\u666F\u90FD\u8C03\u51FA\u6765\u3002\u6709\u4E2A\u4EBA\uFF0C\u6211\u4E00\u5B9A\u8981\u627E\u5230\u3002",
    video2Final: "\u53EA\u662F\u4E00\u573A\u610F\u5916\uFF1F\u2026\u2026\u6211\u4EEC\u540E\u4F1A\u6709\u671F\u3002",
    episodeText: {
      "episode-one-narration": "\u4F46\u6211\u4E5F\u4E0D\u80FD\u5C31\u8FD9\u4E48\u6D88\u5931\uFF0C\u81F3\u5C11\u8BE5\u7ED9\u4ED6\u7559\u5F20\u4FBF\u6761\u2026\u2026",
      "episode-one-a-line": "Alex\uFF1A\u6628\u665A\u53EA\u662F\u4E2A\u610F\u5916\uFF0C\u975E\u5E38\u62B1\u6B49\uFF0C\u6211\u559D\u592A\u591A\u4E86\u3002\u8BF7\u4F60\u52A1\u5FC5\u628A\u8FD9\u4EF6\u4E8B\u5FD8\u6389\uFF0C\u5343\u4E07\u4E0D\u8981\u544A\u8BC9\u8389\u8389\uFF01\u771F\u7684\u5F88\u5BF9\u4E0D\u8D77\uFF01",
      "episode-one-b-line": "\u4F60\u628A\u6628\u665A\u6E05\u695A\u5730\u5B9A\u4E49\u4E3A\u4E00\u573A\u610F\u5916\uFF0C\u5212\u4E0B\u754C\u9650\uFF0C\u7136\u540E\u628A\u7EB8\u6761\u538B\u5728\u6C34\u676F\u4E0B\u3002"
    },
    episodeChoices: {
      "apologize-and-hide": "\u8868\u793A\u62B1\u6B49\uFF0C\u8BF7\u4ED6\u66FF\u4F60\u4FDD\u5BC6",
      "define-as-mistake": "\u5212\u6E05\u754C\u9650\uFF0C\u628A\u6628\u665A\u5B9A\u4E49\u4E3A\u610F\u5916"
    },
    episodeChoiceNotes: {
      "apologize-and-hide": "Alex\uFF1A\u6628\u665A\u53EA\u662F\u4E2A\u610F\u5916\uFF0C\u975E\u5E38\u62B1\u6B49\uFF0C\u6211\u559D\u592A\u591A\u4E86\u3002\u8BF7\u4F60\u52A1\u5FC5\u628A\u8FD9\u4EF6\u4E8B\u5FD8\u6389\uFF0C\u5343\u4E07\u4E0D\u8981\u544A\u8BC9\u8389\u8389\uFF01\u771F\u7684\u5F88\u5BF9\u4E0D\u8D77\uFF01",
      "define-as-mistake": "\u4F60\u628A\u6628\u665A\u6E05\u695A\u5730\u5B9A\u4E49\u4E3A\u4E00\u573A\u610F\u5916\uFF0C\u5212\u4E0B\u754C\u9650\uFF0C\u7136\u540E\u628A\u7EB8\u6761\u538B\u5728\u6C34\u676F\u4E0B\u3002"
    }
  }
};
var screens = new Map(
  [...document.querySelectorAll(".screen")].map((screen) => [screen.id, screen])
);
var world = document.querySelector("#world");
var storyVideos = [...document.querySelectorAll(".story-video")];
var storyVideo = document.querySelector("#story-video");
var storyOverlay = document.querySelector("#story-overlay");
var progressFill = document.querySelector("#cinema-progress-fill");
var videoBackdrop = document.querySelector(".video-backdrop");
var videoToggle = document.querySelector("#video-toggle");
var videoControlLabel = document.querySelector("[data-video-control-label]");
var chapterLabel = document.querySelector(".cinema-topline [data-copy='chapterLabel']");
var skipVideo = document.querySelector("#skip-video");
var matchFrame = document.querySelector("#match-game");
var gameLoading = document.querySelector("#game-loading");
var matchTitle = document.querySelector("#match-title");
var matchGoal = document.querySelector(".match-objective b");
var episodeTitle = document.querySelector("#episode-title");
var episodeContent = document.querySelector("#episode-content");
var episodeContinue = document.querySelector("#episode-continue");
var episodeRetry = document.querySelector("#episode-retry");
var homeCanvas = document.querySelector(".home-canvas");
var homeContinueStory = document.querySelector("#home-continue-story");
var resultEyebrow = document.querySelector("#result-screen .eyebrow");
var resultMessage = document.querySelector("#result-screen .result-message");
var resultFeedbackAvatar = resultMessage.querySelector(".result-avatar");
var resultFeedbackText = resultMessage.querySelector("p");
var resultActionButton = document.querySelector("#result-continue");
var resultActionLabel = resultActionButton.querySelector("[data-copy]");
var resultActionIcon = resultActionButton.querySelector("i");
var homePrimaryControls = document.querySelector(".home-controls-left");
var homeSecondaryControls = document.querySelector(".home-controls-right");
var worldCharacterArt = document.querySelector("#world-character-art");
var worldCharacterPanel = document.querySelector("#world-character-panel");
var worldStoryStage = document.querySelector("#world-story-stage");
var videoChoiceOverlay = document.querySelector("#video-choice-overlay");
var videoChoicePrompt = document.querySelector("#video-choice-prompt");
var videoChoiceList = document.querySelector("#video-choice-list");
var videoNoteOverlay = document.querySelector("#video-note-overlay");
var videoNoteCopy = document.querySelector("#video-note-copy");
var locale = "en";
var copy = COPY.en;
var dokiworld = createAppClient({
  appId: WORLD_ID,
  extensions: ["world", "episode", "checkpoint"]
});
var episode = createEpisodeClientExtension(dokiworld);
var phase = "cover";
var sceneNumber = 0;
var choice = "A";
var gameRunId = "";
var acceptedGameResult = false;
var secondActActive = false;
var initialized = false;
var media = null;
var experience = null;
var episodeMode = false;
var episodeStarted = false;
var episodeWaiting = false;
var episodeQueue = [];
var activeGameId = GAME_ID;
var activeGameConfig = null;
var preparedGameId = "";
var preparedGameRunId = "";
var gameFrameReady = false;
var activeGameHost = null;
var writingChoiceItem = null;
var writingChoiceAwaitingContinuation = false;
var playWritingVideoAfterChoice = false;
var selectedWritingNote = "";
var hasSelectedWritingNote = false;
var latestResult = null;
function setPhase(nextPhase) {
  const nextScreenId = `${nextPhase}-screen`;
  const activeElement = document.activeElement;
  const focusedScreen = activeElement instanceof HTMLElement ? activeElement.closest(".screen") : null;
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
    nextScreen?.querySelector("button:not([disabled]):not([hidden]), input:not([disabled]):not([hidden]), iframe")?.focus();
  }
}
function applyCopy() {
  document.documentElement.lang = locale;
  document.title = locale === "zh-cn" ? "Banquet Contract \xB7 \u4E00\u591C\u5931\u63A7" : "Banquet Contract \xB7 A Night Out of Control";
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
  resultActionLabel.textContent = restartsStory ? copy.resultRestart : copy.resultContinue;
  resultActionIcon.textContent = restartsStory ? "\u21BB" : "\u203A";
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
    (video) => video.getAttribute("src") === src
  );
  if (preparedVideo) {
    preparedVideo.preload = "auto";
    return preparedVideo;
  }
  const targetVideo = storyVideos.includes(preferredVideo) ? preferredVideo : storyVideos.find((video) => video !== storyVideo) || storyVideo;
  targetVideo.pause();
  targetVideo.preload = "auto";
  targetVideo.removeAttribute("poster");
  targetVideo.src = src;
  targetVideo.load();
  return targetVideo;
}
function waitForStoryVideoFrame(video) {
  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0) {
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
        video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0
      );
    }, 12e3);
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
    timeoutId = window.setTimeout(finish, 2e3);
  });
}
async function activateStoryVideo(src, { currentTime = 0, poster = "" } = {}) {
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
  const secondActVideo1 = typeof candidate.secondActVideo1 === "string" ? candidate.secondActVideo1.trim() : "";
  const secondActVideo2 = typeof candidate.secondActVideo2 === "string" ? candidate.secondActVideo2.trim() : "";
  if (typeof video1 !== "string" || typeof video2 !== "string" || !video1.trim() || !video2.trim()) return null;
  return {
    video1,
    video2,
    ...secondActVideo1 ? { secondActVideo1 } : {},
    ...secondActVideo2 ? { secondActVideo2 } : {}
  };
}
function readExperience(candidate) {
  if (!candidate || typeof candidate !== "object") return null;
  const characterId = typeof candidate.characterId === "string" ? candidate.characterId.trim() : "";
  const title = typeof candidate.title === "string" ? candidate.title.trim() : "";
  const description = typeof candidate.description === "string" ? candidate.description.trim() : "";
  const portraitUrl = readSafeMediaUrl(candidate.portraitUrl);
  if (!characterId || !title) return null;
  return { characterId, title, description, portraitUrl };
}
function readSafeMediaUrl(value) {
  if (typeof value !== "string" || !value.trim()) return "";
  try {
    const resolved = new URL(value, document.baseURI);
    const documentOrigin = new URL(document.baseURI).origin;
    return resolved.protocol === "https:" || resolved.origin === documentOrigin ? resolved.href : "";
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
function checkpointText(value, maxLength = 4e3) {
  return typeof value === "string" ? value.slice(0, maxLength) : "";
}
function checkpointNumber(value, minimum, maximum) {
  return Number.isFinite(value) ? Math.min(maximum, Math.max(minimum, Math.floor(value))) : void 0;
}
function checkpointGameConfig(value) {
  if (!value || typeof value !== "object") return null;
  const gameType = ["external", "builtin", "match3"].includes(value.gameType) ? value.gameType : "external";
  const gameId = typeof value.gameId === "string" && /^[a-z0-9][a-z0-9-]{0,127}$/.test(value.gameId) ? value.gameId : "";
  const configId = checkpointText(value.configId, 128);
  const presentation = value.presentation === "modal" || value.presentation === "inline" ? value.presentation : void 0;
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
    "timeLimit"
  ];
  const config = {
    gameType,
    ...gameId ? { gameId } : {},
    ...configId ? { configId } : {},
    ...presentation ? { presentation } : {}
  };
  for (const field of numericFields) {
    const number = checkpointNumber(value[field], 0, 1e7);
    if (number !== void 0) config[field] = number;
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
    "unknown"
  ].includes(segment.type) ? segment.type : "unknown";
  const options = Array.isArray(segment.options) ? segment.options.slice(0, 20).flatMap((option) => {
    if (!option || typeof option !== "object") return [];
    const id = checkpointText(option.id, 128);
    const label = checkpointText(option.label, 1e3);
    if (!id || !label) return [];
    const nextBeatId = checkpointText(option.nextBeatId, 128);
    return [{ id, label, ...nextBeatId ? { nextBeatId } : {} }];
  }) : void 0;
  const assetId = checkpointText(segment.assetId, 128);
  const rawMediaUrl = assetId === "video-night-one" || assetId === "video-who-is-alex" ? "" : readSafeMediaUrl(segment.mediaUrl);
  const gameConfig = checkpointGameConfig(segment.gameConfig);
  return {
    speakerName: checkpointText(value.speakerName, 200),
    segment: {
      type,
      text: checkpointText(segment.text),
      ...checkpointText(segment.id, 128) ? { id: checkpointText(segment.id, 128) } : {},
      ...checkpointText(segment.beatId, 128) ? { beatId: checkpointText(segment.beatId, 128) } : {},
      ...assetId ? { assetId } : {},
      ...rawMediaUrl ? { mediaUrl: rawMediaUrl } : {},
      ...checkpointText(segment.caption, 2e3) ? { caption: checkpointText(segment.caption, 2e3) } : {},
      ...checkpointText(segment.completion, 64) ? { completion: checkpointText(segment.completion, 64) } : {},
      ...options ? { options } : {},
      ...segment.allowFreeText === true ? { allowFreeText: true } : {},
      ...gameConfig ? { gameConfig } : {}
    }
  };
}
function checkpointEpisodeItems(value) {
  return Array.isArray(value) ? value.slice(0, 200).flatMap((item) => {
    const checkpointItem = checkpointEpisodeItem(item);
    return checkpointItem ? [checkpointItem] : [];
  }) : [];
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
function checkpointEnvelope(screen, current = void 0) {
  return {
    contract: CHECKPOINT_CONTRACT,
    version: CHECKPOINT_VERSION,
    data: {
      screen,
      queue: checkpointEpisodeItems(episodeQueue),
      ...current !== void 0 ? { current } : {}
    }
  };
}
function clearCheckpoint() {
  world.dataset.checkpointState = "clearing";
  postWorldEvent("dokiworld-app-checkpoint-clear");
}
function checkpointResult(value) {
  if (!value || typeof value !== "object" || !Number.isFinite(value.points) || !Number.isFinite(value.gradePoints) || value.points < 0 || value.gradePoints < 0) return null;
  return {
    points: Math.floor(value.points),
    gradePoints: Math.floor(value.gradePoints),
    secondAct: value.secondAct === true
  };
}
function restoreCheckpoint(candidate) {
  if (!candidate || typeof candidate !== "object") return false;
  if (candidate.contract === CHECKPOINT_CONTRACT && candidate.version === CHECKPOINT_VERSION && candidate.data && typeof candidate.data === "object") {
    const checkpointData = candidate.data;
    episodeQueue = checkpointEpisodeItems(checkpointData.queue).map(hydrateCheckpointItem).filter(Boolean);
    episodeStarted = episodeMode;
    preloadNextEpisodeVideo();
    preloadNextEpisodeGame();
    if (checkpointData.screen === "lily-transition" && episodeMode) {
      renderNextEpisodeSegment();
      return true;
    }
    if (checkpointData.screen === "episode-text" && episodeMode) {
      const lines = checkpointEpisodeItems(checkpointData.current).map(hydrateCheckpointItem).filter(Boolean);
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
    clearCheckpoint();
    return false;
  }
  if (candidate.kind === "lily-transition") {
    startGame();
    return true;
  }
  if (candidate.kind === "result" && Number.isFinite(candidate.points) && Number.isFinite(candidate.gradePoints) && candidate.points >= 0 && candidate.gradePoints >= 0) {
    acceptedGameResult = true;
    episodeStarted = episodeMode;
    showResult({
      metrics: {
        points: Math.floor(candidate.points),
        gradePoints: Math.floor(candidate.gradePoints)
      }
    }, { persist: false });
    return true;
  }
  return false;
}
function postWorldError(code) {
  if (!dokiworld.runId) return;
  dokiworld.send("dokiworld-app-world-error", { code });
}
function initialize(nextLocale, nextMedia = null, nextExperience = null, nextCheckpoint = null) {
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
    document.title = `${experience.title} \xB7 Banquet Contract`;
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
    const speakerName = typeof utterance.speakerName === "string" ? utterance.speakerName.trim() : "";
    return utterance.segments.filter((segment) => segment && typeof segment === "object").map((segment) => ({ segment: localizeEpisodeSegment(segment), speakerName }));
  });
}
function localizeEpisodeSegment(segment) {
  const localizedText = typeof segment.id === "string" ? copy.episodeText?.[segment.id] : "";
  const options = Array.isArray(segment.options) ? segment.options.map((option) => ({
    ...option,
    label: typeof option?.id === "string" ? copy.episodeChoices?.[option.id] || option.label : option?.label
  })) : segment.options;
  return {
    ...segment,
    ...localizedText ? { text: localizedText } : {},
    ...Array.isArray(options) ? { options } : {}
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
      checkpointEpisodeItems(lines)
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
    (item) => item.segment.id !== "episode-two-lily-narration"
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
      checkpointEpisodeItem(item)
    ));
  }
}
function isWritingChoiceSegment(segment) {
  const options = Array.isArray(segment?.options) ? segment.options : [];
  return options.length === WRITING_CHOICE_OPTION_IDS.size && options.every((option) => WRITING_CHOICE_OPTION_IDS.has(option?.id));
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
  videoChoicePrompt.textContent = writingChoice ? copy.writingChoicePrompt : typeof segment.text === "string" ? segment.text : copy.choiceTitle;
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
        optionId: option.id
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
  const src = typeof nextVideo?.segment.mediaUrl === "string" ? nextVideo.segment.mediaUrl : "";
  if (!src) return;
  prepareStoryVideo(src);
}
function preloadNextEpisodeGame() {
  const nextGame = episodeQueue.find((item) => item.segment.type === "game");
  const gameId = typeof nextGame?.segment.gameConfig?.gameId === "string" ? nextGame.segment.gameConfig.gameId.trim() : "";
  if (!/^[a-z0-9][a-z0-9-]{0,127}$/.test(gameId) || preparedGameId === gameId && matchFrame.getAttribute("src")) return;
  preparedGameId = gameId;
  preparedGameRunId = `${WORLD_ID}:preload:${Date.now()}:${Math.random().toString(36).slice(2)}`;
  gameFrameReady = false;
  matchFrame.src = `/games/${gameId}/index.html?run=${encodeURIComponent(preparedGameRunId)}`;
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
  const src = playWritingVideoAfterChoice && typeof media?.video2 === "string" ? media.video2 : segmentSrc;
  if (!src) {
    renderNextEpisodeSegment();
    return;
  }
  sceneNumber = item.segment.assetId === "video-night-one" ? 1 : item.segment.assetId === "video-who-is-alex" ? 2 : 0;
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
  } else if (type === "image" && typeof item.segment.mediaUrl === "string") {
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
      beatId: item.segment.beatId
    });
  } else {
    renderNextEpisodeSegment();
  }
}
function acceptEpisodeUtterances(utterances) {
  let nextItems = episodeItemsFrom(utterances);
  const containsWritingChoice = nextItems.some(
    (item) => item.segment.type === "choices" && isWritingChoiceSegment(item.segment)
  );
  if (containsWritingChoice) {
    nextItems = nextItems.filter(
      (item) => item.segment.id !== "episode-one-narration"
    );
  }
  if (writingChoiceAwaitingContinuation) {
    nextItems = nextItems.filter(
      (item) => !["episode-one-a-line", "episode-one-b-line"].includes(item.segment.id)
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
  progressFill.style.width = `${Math.min(100, storyVideo.currentTime / duration * 100)}%`;
  if (!videoChoiceOverlay.classList.contains("is-hidden")) {
    storyOverlay.replaceChildren();
    videoNoteOverlay.classList.add("is-hidden");
    return;
  }
  const showSelectedNote = sceneNumber === 2 && hasSelectedWritingNote && storyVideo.currentTime >= WRITING_NOTE_REVEAL_START && storyVideo.currentTime < WRITING_NOTE_REVEAL_END;
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
          { id: "define-as-mistake", label: copy.choiceB }
        ]
      }
    });
  } else {
    startGame();
  }
}
async function playScene(number) {
  const src = number === SECOND_ACT_VIDEO_ONE_SCENE ? media?.secondActVideo1 : number === SECOND_ACT_VIDEO_TWO_SCENE ? media?.secondActVideo2 : media?.[`video${number}`];
  if (!src) {
    postWorldError("world_media_unavailable");
    return;
  }
  sceneNumber = number;
  chapterLabel.textContent = number === SECOND_ACT_VIDEO_ONE_SCENE || number === SECOND_ACT_VIDEO_TWO_SCENE ? copy.secondActChapterLabel : copy.chapterLabel;
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
    boostersUnlocked: false
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
  const canReusePreparedFrame = preparedGameId === gameId && preparedGameRunId && matchFrame.getAttribute("src");
  gameRunId = canReusePreparedFrame ? preparedGameRunId : `${WORLD_ID}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
  gameLoading.classList.remove("is-hidden");
  setPhase("match");
  if (canReusePreparedFrame) {
    connectGameHost();
  } else {
    preparedGameId = gameId;
    preparedGameRunId = gameRunId;
    gameFrameReady = false;
    matchFrame.src = `/games/${activeGameId}/index.html?run=${encodeURIComponent(gameRunId)}`;
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
    extensions: ["resize", "progress", "checkpoint"],
    init: {
      locale,
      grantedScopes: [],
      context: { schemaVersion: 1 },
      input: {
        contract: "doki.game.match3-input",
        version: 1,
        data: {
          options: activeGameConfig || banquetMatch3Config()
        }
      }
    },
    outputs: [{ contract: "doki.game.result", version: 1 }]
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
          configId: activeGameConfig?.configId
        });
      } else {
        showResult(result);
      }
      return { status: "accepted" };
    }
  });
}
matchFrame.addEventListener("load", () => {
  if (phase === "match") connectGameHost();
});
function resultPresentation(gradePoints) {
  const [passThreshold, goodThreshold, perfectThreshold] = secondActActive ? [15, 25, 50] : [10, 20, 40];
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
    fail: "secondActFeedbackFail"
  }[gradeKey];
  resultMessage.dataset.speaker = "ryan";
  resultFeedbackAvatar.textContent = "R";
  resultFeedbackText.textContent = copy[feedbackKey];
}
function showResult(result, { persist = true } = {}) {
  const rawPoints = Number(result?.metrics?.points);
  const rawGradePoints = Number(result?.metrics?.gradePoints);
  const displayedScore = Number.isFinite(rawPoints) ? rawPoints : 0;
  const points = Math.max(
    0,
    Math.floor(displayedScore)
  );
  const gradePoints = Number.isFinite(rawGradePoints) ? rawGradePoints : points;
  const normalizedGradePoints = Math.max(0, Math.floor(gradePoints));
  const { gradeKey, title } = resultPresentation(normalizedGradePoints);
  latestResult = { points, gradePoints: normalizedGradePoints, secondAct: secondActActive };
  document.querySelector("#result-score").textContent = String(points);
  document.querySelector("#result-title").textContent = title;
  document.querySelector("#result-seal").dataset.grade = gradeKey;
  resultEyebrow.textContent = secondActActive ? copy.secondActResultEyebrow : copy.resultEyebrow;
  resultMessage.classList.remove("is-hidden");
  syncResultFeedback(gradeKey);
  setPhase("result");
  syncResultAction();
  if (persist) {
    publishCheckpoint(checkpointEnvelope("result", {
      points,
      gradePoints: normalizedGradePoints,
      secondAct: secondActActive
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
      detail: { action: button.dataset.homeAction }
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
        error.textContent = message.code === "authentication_required" ? copy.episodeAuthenticationRequired : copy.episodeError;
        episodeContent.append(error);
        episodeContinue.classList.add("is-hidden");
        episodeRetry.classList.remove("is-hidden");
        setPhase("episode");
      }
    }
  });
}
if (window.parent === window) {
  const requestedLocale = new URLSearchParams(window.location.search).get("locale") || navigator.language;
  initialize(requestedLocale);
} else {
}
