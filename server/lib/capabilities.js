"use strict";
/**
 * lib/capabilities.js
 * Detects Flowise chatflow capabilities (uploads, TTS, STT) via API introspection.
 * Results are cached for CAPABILITY_TTL_MS milliseconds.
 */

const { getFlowiseHeaders } = require("./flowise");
const { parseMaybeJson } = require("./agentTrace");

const capabilityCache = new Map();
const CAPABILITY_TTL_MS = 60_000; // 1 minute

/**
 * Recursively searches an object for any key in `keys` that has a truthy value.
 * @param {object} target
 * @param {string[]} keys
 * @returns {boolean}
 */
function findTruthyFlag(target, keys) {
    if (!target || typeof target !== "object") return false;
    const stack = [target];
    while (stack.length) {
        const current = stack.pop();
        if (!current || typeof current !== "object") continue;
        for (const [key, value] of Object.entries(current)) {
            if (keys.includes(key) && Boolean(value)) return true;
            if (value && typeof value === "object") stack.push(value);
        }
    }
    return false;
}

/**
 * Derive upload/TTS/STT capabilities from a raw Flowise chatflow API response.
 * @param {object} chatflow
 * @returns {{ uploads: boolean, tts: boolean, stt: boolean }}
 */
function deriveCapabilities(chatflow) {
    const chatbotConfig = parseMaybeJson(chatflow?.chatbotConfig);
    const apiConfig = parseMaybeJson(chatflow?.apiConfig);
    const speechToText = parseMaybeJson(chatflow?.speechToText);
    const flowData = typeof chatflow?.flowData === "string" ? chatflow.flowData : "";

    const uploadKeys = [
        "uploads", "upload", "fileUpload", "fileUploads",
        "enableUploads", "enableFileUploads", "allowUploads",
        "allowFileUploads", "isFileUploadEnabled", "uploadEnabled"
    ];
    const ttsKeys = ["tts", "textToSpeech", "speechSynthesis", "voice", "enableTTS", "enableTextToSpeech"];

    const hasFlowUpload =
        ["File Loader", "Document Loader", "FileLoader", "DocumentLoader",
            "Uploads", "upload", "Document", "PDF", "Image"]
            .some((kw) => flowData.includes(kw));

    const uploads =
        hasFlowUpload ||
        findTruthyFlag(chatflow, uploadKeys) ||
        findTruthyFlag(chatbotConfig, uploadKeys) ||
        findTruthyFlag(apiConfig, uploadKeys);

    const tts = findTruthyFlag(chatbotConfig, ttsKeys) || findTruthyFlag(apiConfig, ttsKeys);
    const stt = speechToText && Object.keys(speechToText).length > 0;

    return { uploads, tts, stt };
}

/**
 * Fetch and cache capabilities for a given model.
 * Tries the authenticated endpoint first, then the public endpoints.
 * @param {object} model
 * @returns {Promise<{ uploads: boolean, tts: boolean, stt: boolean, status: string }>}
 */
async function fetchCapabilities(model) {
    const cacheKey = String(model.index);
    const cached = capabilityCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    const baseHost = String(model.host || "").trim().replace(/\/$/, "");
    const candidates = [
        { url: `${baseHost}/api/v1/chatflows/${model.id}`, headers: { "Content-Type": "application/json", ...getFlowiseHeaders(model) } },
        { url: `${baseHost}/api/v1/public-chatflows/${model.id}`, headers: { "Content-Type": "application/json" } },
        { url: `${baseHost}/api/v1/public-chatbotConfig/${model.id}`, headers: { "Content-Type": "application/json" } }
    ];

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    let value = { uploads: false, tts: false, stt: false, status: "unknown" };

    try {
        let sawUnauthorized = false;
        let httpStatus = null;
        for (const candidate of candidates) {
            const response = await fetch(candidate.url, { headers: candidate.headers, signal: controller.signal });
            if (response.ok) {
                const data = await response.json().catch(() => null);
                if (data) { value = { ...deriveCapabilities(data), status: "ok" }; break; }
            } else {
                if (response.status === 401 || response.status === 403) sawUnauthorized = true;
                else if (!httpStatus) httpStatus = response.status;
            }
        }
        if (value.status !== "ok") {
            value = {
                uploads: false, tts: false, stt: false,
                status: sawUnauthorized ? "unauthorized" : httpStatus ? `http_${httpStatus}` : "unknown"
            };
        }
    } catch {
        value = { uploads: false, tts: false, stt: false, status: "unknown" };
    } finally {
        clearTimeout(timeout);
    }

    capabilityCache.set(cacheKey, { value, expiresAt: Date.now() + CAPABILITY_TTL_MS });
    return value;
}

module.exports = { fetchCapabilities, deriveCapabilities, findTruthyFlag };
