const express = require("express");
const path = require("path");
const fs = require("fs");
const morgan = require("morgan");
const { createParser } = require("eventsource-parser");
const { loadModelsFromEnv, loadModelsFromEnvDetailed, loadPublicModels } = require("./models");

require("dotenv").config();

const app = express();
app.use(express.json({ limit: "2mb" }));
app.use(morgan("tiny"));

const publicDir = path.join(__dirname, "public");
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
}

const capabilityCache = new Map();
const CAPABILITY_TTL_MS = 60000;

function sendEvent(res, event, data) {
  if (res.writableEnded) return;
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function getFlowiseHeaders(model) {
  const extraHeaders = {};
  if (model?.authHeader && model?.authValue) {
    extraHeaders[model.authHeader] = model.authValue;
  } else if (model?.apiKey) {
    extraHeaders["Authorization"] = `Bearer ${model.apiKey}`;
  } else if (process.env.FLOWISE_AUTH_HEADER && process.env.FLOWISE_AUTH_VALUE) {
    extraHeaders[process.env.FLOWISE_AUTH_HEADER] = process.env.FLOWISE_AUTH_VALUE;
  } else if (process.env.FLOWISE_API_KEY) {
    extraHeaders["Authorization"] = `Bearer ${process.env.FLOWISE_API_KEY}`;
  }
  return extraHeaders;
}

function parseMaybeJson(value) {
  if (!value) return null;
  if (typeof value === "object") return value;
  if (typeof value !== "string") return null;
  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
  }
}

function findTruthyFlag(target, keys) {
  if (!target || typeof target !== "object") return false;
  const stack = [target];
  while (stack.length) {
    const current = stack.pop();
    if (!current || typeof current !== "object") continue;
    for (const [key, value] of Object.entries(current)) {
      if (keys.includes(key) && Boolean(value)) {
        return true;
      }
      if (value && typeof value === "object") {
        stack.push(value);
      }
    }
  }
  return false;
}

function deriveCapabilities(chatflow) {
  const chatbotConfig = parseMaybeJson(chatflow?.chatbotConfig);
  const apiConfig = parseMaybeJson(chatflow?.apiConfig);
  const speechToText = parseMaybeJson(chatflow?.speechToText);
  const flowData = typeof chatflow?.flowData === "string" ? chatflow.flowData : "";
  const uploadKeys = [
    "uploads",
    "upload",
    "fileUpload",
    "fileUploads",
    "enableUploads",
    "enableFileUploads",
    "allowUploads",
    "allowFileUploads",
    "isFileUploadEnabled",
    "uploadEnabled"
  ];
  const ttsKeys = [
    "tts",
    "textToSpeech",
    "speechSynthesis",
    "voice",
    "enableTTS",
    "enableTextToSpeech"
  ];
  const hasFlowUpload =
    flowData.includes("File Loader") ||
    flowData.includes("Document Loader") ||
    flowData.includes("FileLoader") ||
    flowData.includes("DocumentLoader") ||
    flowData.includes("Uploads") ||
    flowData.includes("upload") ||
    flowData.includes("Document") ||
    flowData.includes("PDF") ||
    flowData.includes("Image");
  const uploads =
    hasFlowUpload ||
    findTruthyFlag(chatflow, uploadKeys) ||
    findTruthyFlag(chatbotConfig, uploadKeys) ||
    findTruthyFlag(apiConfig, uploadKeys);
  const tts = findTruthyFlag(chatbotConfig, ttsKeys) || findTruthyFlag(apiConfig, ttsKeys);
  const stt = speechToText && Object.keys(speechToText).length > 0;
  return { uploads, tts, stt };
}

async function fetchCapabilities(model) {
  const cacheKey = String(model.index);
  const cached = capabilityCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const baseHost = String(model.host || "").trim().replace(/\/$/, "");
  const urls = [
    {
      url: `${baseHost}/api/v1/chatflows/${model.id}`,
      headers: { "Content-Type": "application/json", ...getFlowiseHeaders(model) }
    },
    {
      url: `${baseHost}/api/v1/public-chatflows/${model.id}`,
      headers: { "Content-Type": "application/json" }
    },
    {
      url: `${baseHost}/api/v1/public-chatbotConfig/${model.id}`,
      headers: { "Content-Type": "application/json" }
    }
  ];
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);
  let value = { uploads: false, tts: false, stt: false, status: "unknown" };
  try {
    let sawUnauthorized = false;
    let httpStatus = null;
    for (const candidate of urls) {
      const response = await fetch(candidate.url, {
        headers: candidate.headers,
        signal: controller.signal
      });

      if (response.ok) {
        const data = await response.json().catch(() => null);
        if (data) {
          value = { ...deriveCapabilities(data), status: "ok" };
          break;
        }
      } else {
        if (response.status === 401 || response.status === 403) {
          sawUnauthorized = true;
        } else if (!httpStatus) {
          httpStatus = response.status;
        }
      }
    }
    if (value.status !== "ok") {
      value = {
        uploads: false,
        tts: false,
        stt: false,
        status: sawUnauthorized ? "unauthorized" : httpStatus ? `http_${httpStatus}` : "unknown"
      };
    }
  } catch (error) {
    value = { uploads: false, tts: false, stt: false, status: "unknown" };
  } finally {
    clearTimeout(timeout);
  }
  capabilityCache.set(cacheKey, { value, expiresAt: Date.now() + CAPABILITY_TTL_MS });
  return value;
}

function buildPrompt(message, mode) {
  // Return raw user message only - all prompts/formatting are configured in Flowise
  // The mode parameter is kept for future use but not used to modify the message
  return message;
}

async function streamFlowise({
  res,
  model,
  message,
  mode,
  sessionId,
  uploads = [],
  signal
}) {
  const url = `${model.host}/api/v1/prediction/${model.id}`;
  const payload = {
    question: buildPrompt(message, mode),
    streaming: true,
    chatId: sessionId,
    overrideConfig: sessionId ? { sessionId } : undefined,
    uploads: uploads.length > 0 ? uploads : undefined
  };

  console.log(`[Flowise] Fetching URL: ${url}`);
  console.log(`[Flowise] Payload:`, JSON.stringify(payload));

  const extraHeaders = getFlowiseHeaders(model);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...extraHeaders
    },
    body: JSON.stringify(payload),
    signal,
    // Add a longer timeout for Hugging Face cold starts
    duplex: 'half'
  }).catch((err) => {
    console.error("[Flowise] Fetch error:", err);
    const wrapped = new Error(`Failed to connect to Flowise: ${err.message}`);
    wrapped.name = err?.name || wrapped.name;
    wrapped.cause = err;
    throw wrapped;
  });

  const contentType = response.headers.get("content-type") || "";
  console.log(`[Flowise] Status: ${response.status}, Content-Type: ${contentType}`);
  console.log(`[Flowise] Headers:`, JSON.stringify(Object.fromEntries(response.headers.entries())));

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    console.error(`[Flowise] API error (${response.status}):`, text);
    throw new Error(`Flowise error ${response.status}: ${text}`);
  }

  if (!response.body) {
    throw new Error("Flowise returned an empty response body.");
  }

  // If the content type is not a stream, it might be a JSON error hidden in a 200 OK 
  // or just a non-streaming response that we should handle.
  if (!contentType.includes("text/event-stream")) {
    console.warn(`[Flowise] Warning: Expected event-stream but got ${contentType}`);
    // If it's JSON, we can try to parse it
    if (contentType.includes("application/json")) {
      const json = await response.json().catch(() => null);
      if (json) {
        console.log(`[Flowise] Parsed JSON instead of stream:`, JSON.stringify(json).slice(0, 50));
        const text = json.text || json.answer || json.output || json.message || JSON.stringify(json);
        sendEvent(res, "token", { text });
        return; // We're done
      }
    }
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let ended = false;
  const parser = createParser((event) => {
    if (event.type !== "event") return;
    const upstreamEventName = event.event || "";
    const raw = event.data || "";
    if (!raw) return;

    if (upstreamEventName) {
      if (upstreamEventName === "token") {
        sendEvent(res, "token", { text: raw });
        return;
      }

      if (upstreamEventName === "metadata") {
        let meta = null;
        try {
          meta = JSON.parse(raw);
        } catch (error) {
          meta = { value: raw };
        }
        sendEvent(res, "metadata", meta);
        return;
      }

      if (upstreamEventName === "start") {
        sendEvent(res, "activity", { state: "writing" });
        return;
      }

      if (upstreamEventName === "end") {
        ended = true;
        return;
      }

      if (upstreamEventName === "error") {
        sendEvent(res, "error", { message: raw });
        ended = true;
        return;
      }

      if (upstreamEventName === "usedTools" || upstreamEventName === "agentFlowEvent") {
        return;
      }
    }

    let parsed = null;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      parsed = null;
    }

    if (parsed && typeof parsed === "object") {
      if (typeof parsed.event === "string" && Object.prototype.hasOwnProperty.call(parsed, "data")) {
        const innerEvent = parsed.event;
        const innerData = parsed.data;

        if (innerEvent === "token") {
          sendEvent(res, "token", { text: typeof innerData === "string" ? innerData : String(innerData || "") });
          return;
        }

        if (innerEvent === "metadata") {
          sendEvent(res, "metadata", innerData && typeof innerData === "object" ? innerData : { value: innerData });
          return;
        }

        if (innerEvent === "start") {
          sendEvent(res, "activity", { state: "writing" });
          return;
        }

        if (innerEvent === "end") {
          ended = true;
          return;
        }

        if (innerEvent === "error") {
          const message =
            typeof innerData === "string"
              ? innerData
              : (innerData && typeof innerData === "object" && (innerData.message || innerData.error)) || "Unknown error";
          sendEvent(res, "error", { message });
          ended = true;
          return;
        }

        if (innerEvent === "usedTools" || innerEvent === "agentFlowEvent") {
          return;
        }
      }

      const errorText = parsed.error || parsed.message?.error;
      if (errorText) {
        sendEvent(res, "error", { message: errorText });
        ended = true;
        return;
      }
    }

    const payloadText =
      (parsed &&
        (parsed.token || parsed.text || parsed.answer || parsed.message)) ||
      raw;
    if (payloadText) {
      sendEvent(res, "token", { text: payloadText });
    }
  });

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }
    parser.feed(decoder.decode(value, { stream: true }));
    if (ended) {
      await reader.cancel().catch(() => undefined);
      break;
    }
  }
  return ended;
}

function scheduleActivities(res, mode) {
  const steps =
    mode === "research"
      ? ["searching", "reading", "reasoning", "writing"]
      : ["writing"];
  const baseDelay = mode === "research" ? 800 : 500;
  const timers = steps.map((step, index) =>
    setTimeout(() => {
      sendEvent(res, "activity", { state: step });
    }, (index + 1) * baseDelay)
  );
  return () => {
    timers.forEach((timer) => clearTimeout(timer));
  };
}

app.get("/models", async (req, res) => {
  const detailed = loadModelsFromEnvDetailed(process.env).models;
  const { models, issues } = loadPublicModels(process.env);
  const capabilityPairs = await Promise.all(
    detailed.map(async (model) => ({
      id: String(model.index),
      features: await fetchCapabilities(model)
    }))
  );
  const capabilityMap = new Map(capabilityPairs.map((item) => [item.id, item.features]));
  const enriched = models.map((model) => ({
    ...model,
    features: capabilityMap.get(model.id) || { uploads: false, tts: false, stt: false, status: "unknown" }
  }));
  res.json({ models: enriched, issues });
});

app.post("/chat", async (req, res) => {
  const { message, modelId, mode, sessionId, uploads } = req.body || {};
  if (
    !message ||
    typeof message !== "string" ||
    message.length > 10000 ||
    !modelId ||
    typeof modelId !== "string" ||
    !mode ||
    typeof mode !== "string" ||
    !["chat", "research"].includes(mode)
  ) {
    return res.status(400).json({ error: "Invalid message" });
  }
  const safeSessionId = typeof sessionId === "string" && sessionId.trim() ? sessionId.trim().slice(0, 128) : "";

  // Validate uploads if provided
  const safeUploads = Array.isArray(uploads) ? uploads.filter(u =>
    u && typeof u === "object" &&
    typeof u.name === "string" &&
    typeof u.data === "string" &&
    typeof u.mime === "string"
  ) : [];

  // Resolve safe modelId (index-based) to actual model config
  const detailed = loadModelsFromEnvDetailed(process.env);
  const idx = Number(modelId);
  const model = detailed.models.find((item) => item.index === idx);
  if (!model) {
    return res.status(404).json({ error: "Model not found" });
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no"
  });

  sendEvent(res, "activity", { state: "writing" });

  const clearActivities = scheduleActivities(res, mode);

  const controller = new AbortController();
  req.on("aborted", () => {
    controller.abort();
    clearActivities();
  });
  res.on("close", () => {
    if (!res.writableEnded) {
      controller.abort();
    }
    clearActivities();
  });

  if (controller.signal.aborted) {
    console.warn("[Chat] Request already aborted by client before starting.");
    return res.end();
  }

  try {
    // Attempt streaming first
    await streamFlowise({
      res,
      model,
      message,
      mode,
      sessionId: safeSessionId,
      uploads: safeUploads,
      signal: controller.signal
    });
    sendEvent(res, "done", { ok: true });
  } catch (error) {
    const clientAborted = req.aborted || controller.signal.aborted;
    const isAbortError = error?.name === "AbortError";
    console.error(
      `[Chat] Streaming failed (ClientAborted: ${clientAborted}, AbortError: ${isAbortError}):`,
      error?.message
    );

    if (clientAborted) {
      sendEvent(res, "error", { message: "Request was cancelled before completion." });
      sendEvent(res, "done", { ok: false, cancelled: true });
      return;
    }

    try {
      // Fallback to non-streaming (user's working snippet format)
      const url = `${model.host}/api/v1/prediction/${model.id}`;
      const payload = {
        question: buildPrompt(message, mode),
        chatId: safeSessionId,
        overrideConfig: safeSessionId ? { sessionId: safeSessionId } : undefined
      };

      console.log(`[Flowise Fallback] Fetching URL: ${url}`);

      const extraHeaders = getFlowiseHeaders(model);
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...extraHeaders
        },
        body: JSON.stringify(payload),
        // For fallback, we'll use a fresh fetch without the same abort signal 
        // to ensure it reaches Flowise even if the streaming connection had a glitch.
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(`Flowise fallback error ${response.status}: ${text}`);
      }

      const result = await response.json();
      console.log("[Flowise Fallback] Success");

      const finalContent = result.text || result.answer || result.output || result.message || JSON.stringify(result);

      sendEvent(res, "token", { text: finalContent });
      sendEvent(res, "done", { ok: true });
    } catch (fallbackError) {
      const isFbAbort = fallbackError.name === "AbortError" || fallbackError.message?.includes("aborted");
      console.error(`[Chat] Fallback failed (Abort: ${isFbAbort}):`, fallbackError.message);
      if (!isFbAbort) {
        sendEvent(res, "error", { message: fallbackError.message });
      }
    }
  } finally {
    clearActivities();
    if (!res.writableEnded) res.end();
  }
});

// Non-streaming JSON endpoint compatible with Flowise template usage
app.post("/predict", async (req, res) => {
  const { question, modelId, mode = "chat", sessionId } = req.body || {};
  if (
    !question ||
    typeof question !== "string" ||
    question.length > 10000 ||
    !["chat", "research"].includes(mode)
  ) {
    return res.status(400).json({ error: "Invalid request" });
  }
  const safeSessionId = typeof sessionId === "string" && sessionId.trim() ? sessionId.trim().slice(0, 128) : "";

  // Resolve safe modelId (index-based) to actual model config
  const detailed = loadModelsFromEnvDetailed(process.env);
  let model = null;
  if (typeof modelId === "string" && modelId.trim() !== "") {
    const idx = Number(modelId);
    model = detailed.models.find((item) => item.index === idx) || null;
  }
  // Fallback to first configured model if none provided
  if (!model) {
    model = detailed.models[0] || null;
  }
  if (!model) {
    return res.status(404).json({ error: "Model not found" });
  }

  const url = `${model.host}/api/v1/prediction/${model.id}`;
  const payload = {
    question: buildPrompt(question, mode),
    chatId: safeSessionId,
    overrideConfig: safeSessionId ? { sessionId: safeSessionId } : undefined
  };

  const extraHeaders = getFlowiseHeaders(model);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...extraHeaders },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return res
        .status(response.status)
        .json({ error: `Upstream error: ${text || response.statusText}` });
    }

    const result = await response.json();
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message || "Server error" });
  }
});

app.get("*", (req, res, next) => {
  if (fs.existsSync(publicDir)) {
    const indexPath = path.join(publicDir, "index.html");
    if (fs.existsSync(indexPath)) {
      return res.sendFile(indexPath);
    }
  }
  next();
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
  const { models } = loadModelsFromEnvDetailed(process.env);
  console.log(`Loaded models:`, JSON.stringify(models, null, 2));
});
