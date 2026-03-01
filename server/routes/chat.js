"use strict";
/**
 * routes/chat.js
 * POST /chat     — streaming AI chat (SSE)
 * POST /predict  — non-streaming JSON prediction (Flowise template-compatible)
 */

const express = require("express");
const router = express.Router();
const { loadModelsFromEnvDetailed } = require("../models");
const {
    sendEvent,
    scheduleActivities,
    buildPrompt,
    getFlowiseHeaders,
    streamFlowise
} = require("../lib/flowise");

// POST /chat — authenticated SSE streaming to Flowise
router.post("/chat", async (req, res) => {
    const { message, modelId, mode, sessionId, uploads } = req.body || {};

    // Input validation
    if (
        !message || typeof message !== "string" || message.length > 10000 ||
        !modelId || typeof modelId !== "string" ||
        !mode || typeof mode !== "string" ||
        !["chat", "research"].includes(mode)
    ) {
        return res.status(400).json({ error: "Invalid message" });
    }

    const safeSessionId = typeof sessionId === "string" && sessionId.trim()
        ? sessionId.trim().slice(0, 128) : "";

    const safeUploads = Array.isArray(uploads)
        ? uploads.filter(
            (u) =>
                u && typeof u === "object" &&
                typeof u.name === "string" &&
                typeof u.data === "string" &&
                typeof u.mime === "string"
        )
        : [];

    // Resolve model
    const detailed = loadModelsFromEnvDetailed(process.env);
    const idx = Number(modelId);
    const model = detailed.models.find((item) => item.index === idx);
    if (!model) return res.status(404).json({ error: "Model not found" });

    // Start SSE stream
    res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no"
    });
    // Force-flush headers immediately — critical for SSE streaming
    res.flushHeaders();
    // Disable Nagle's algorithm so each write() goes out as its own TCP packet
    if (res.socket) res.socket.setNoDelay(true);

    sendEvent(res, "activity", { state: "writing" });
    const clearActivities = scheduleActivities(res);

    const controller = new AbortController();
    req.on("aborted", () => { controller.abort(); clearActivities(); });
    res.on("close", () => { if (!res.writableEnded) controller.abort(); clearActivities(); });

    if (controller.signal.aborted) {
        console.warn("[Chat] Request already aborted by client before starting.");
        return res.end();
    }

    try {
        await streamFlowise({
            res, model, message, mode,
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

        // Fallback to non-streaming
        try {
            const url = `${model.host}/api/v1/prediction/${model.id}`;
            const payload = {
                question: buildPrompt(message, mode),
                chatId: safeSessionId,
                overrideConfig: safeSessionId ? { sessionId: safeSessionId } : undefined
            };
            console.log(`[Flowise Fallback] Fetching URL: ${url}`);

            const fallbackRes = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json", ...getFlowiseHeaders(model) },
                body: JSON.stringify(payload)
            });

            if (!fallbackRes.ok) {
                const text = await fallbackRes.text().catch(() => "");
                throw new Error(`Flowise fallback error ${fallbackRes.status}: ${text}`);
            }

            const result = await fallbackRes.json();
            console.log("[Flowise Fallback] Success");
            const finalContent = result.text || result.answer || result.output || result.message || JSON.stringify(result);
            // Fallback response is already non-streaming upstream; send without synthetic delay.
            sendEvent(res, "token", { text: finalContent });
            sendEvent(res, "done", { ok: true });
        } catch (fallbackError) {
            const isFbAbort = fallbackError.name === "AbortError" || fallbackError.message?.includes("aborted");
            console.error(`[Chat] Fallback failed (Abort: ${isFbAbort}):`, fallbackError.message);
            if (!isFbAbort) sendEvent(res, "error", { message: fallbackError.message });
        }
    } finally {
        clearActivities();
        if (!res.writableEnded) res.end();
    }
});

// POST /predict — non-streaming JSON endpoint (Flowise template-compatible)
router.post("/predict", async (req, res) => {
    const { question, modelId, mode = "chat", sessionId } = req.body || {};

    if (
        !question || typeof question !== "string" || question.length > 10000 ||
        !["chat", "research"].includes(mode)
    ) {
        return res.status(400).json({ error: "Invalid request" });
    }

    const safeSessionId = typeof sessionId === "string" && sessionId.trim()
        ? sessionId.trim().slice(0, 128) : "";

    const detailed = loadModelsFromEnvDetailed(process.env);
    let model = null;
    if (typeof modelId === "string" && modelId.trim() !== "") {
        model = detailed.models.find((item) => item.index === Number(modelId)) || null;
    }
    if (!model) model = detailed.models[0] || null;
    if (!model) return res.status(404).json({ error: "Model not found" });

    const url = `${model.host}/api/v1/prediction/${model.id}`;
    const payload = {
        question: buildPrompt(question, mode),
        chatId: safeSessionId,
        overrideConfig: safeSessionId ? { sessionId: safeSessionId } : undefined
    };

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...getFlowiseHeaders(model) },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const text = await response.text().catch(() => "");
            return res.status(response.status).json({ error: `Upstream error: ${text || response.statusText}` });
        }

        return res.json(await response.json());
    } catch (err) {
        return res.status(500).json({ error: err.message || "Server error" });
    }
});

module.exports = router;
