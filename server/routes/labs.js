"use strict";
/**
 * routes/labs.js
 * POST /labs-edit            — generate or fully edit a document
 * POST /labs-edit-selection  — surgically edit only a selected text range
 */

const express = require("express");
const router = express.Router();
const { sendEvent, streamFlowise } = require("../lib/flowise");
const { loadLabsModel } = require("./models");

// POST /labs-edit — full document generation or editing
router.post("/labs-edit", async (req, res) => {
    const { document, instruction, sessionId } = req.body || {};
    const safeSessionId = typeof sessionId === "string" && sessionId.trim()
        ? sessionId.trim().slice(0, 128) : "";

    if (!instruction || typeof instruction !== "string" || instruction.length > 10000) {
        return res.status(400).json({ error: "Invalid instruction" });
    }

    const model = loadLabsModel();
    if (!model) return res.status(404).json({ error: "No Labs model configured" });

    const isGeneration = !document || document.trim() === "";
    const editPrompt = isGeneration
        ? instruction
        : `CURRENT DOCUMENT:\n${document}\n\nUSER INSTRUCTION:\n${instruction}\n\nApply the instruction to edit the document. Return ONLY the updated document content, no explanations.`;

    res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no"
    });

    const controller = new AbortController();
    req.on("aborted", () => controller.abort());
    res.on("close", () => { if (!res.writableEnded) controller.abort(); });

    try {
        await streamFlowise({
            res, model,
            message: editPrompt,
            mode: "chat",
            sessionId: safeSessionId,
            uploads: [],
            signal: controller.signal
        });
        sendEvent(res, "done", { ok: true });
    } catch (error) {
        console.error("[Labs] AI edit failed:", error.message);
        if (!controller.signal.aborted) sendEvent(res, "error", { message: error.message });
    } finally {
        if (!res.writableEnded) res.end();
    }
});

// POST /labs-edit-selection — surgical replacement of a text selection
router.post("/labs-edit-selection", async (req, res) => {
    const { selectedText, instruction, contextBefore, contextAfter, sessionId } = req.body || {};
    const safeSessionId = typeof sessionId === "string" && sessionId.trim()
        ? sessionId.trim().slice(0, 128) : "";

    if (!selectedText || typeof selectedText !== "string") {
        return res.status(400).json({ error: "No text selected" });
    }
    if (!instruction || typeof instruction !== "string" || instruction.length > 2000) {
        return res.status(400).json({ error: "Invalid instruction" });
    }

    const model = loadLabsModel();
    if (!model) return res.status(404).json({ error: "No Labs model configured" });

    const editPrompt = `You are editing a specific text selection within a larger document.

CONTEXT BEFORE THE SELECTION:
${contextBefore || "(start of document)"}

SELECTED TEXT TO EDIT:
${selectedText}

CONTEXT AFTER THE SELECTION:
${contextAfter || "(end of document)"}

USER INSTRUCTION: ${instruction}

CRITICAL: Return ONLY the replacement text for the selection. Do not include context, explanations, or markdown code blocks. Just the edited text that will replace the selection.`;

    res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no"
    });

    const controller = new AbortController();
    req.on("aborted", () => controller.abort());
    res.on("close", () => { if (!res.writableEnded) controller.abort(); });

    try {
        await streamFlowise({
            res, model,
            message: editPrompt,
            mode: "chat",
            sessionId: safeSessionId,
            uploads: [],
            signal: controller.signal
        });
        sendEvent(res, "done", { ok: true });
    } catch (error) {
        console.error("[Labs] Selection edit failed:", error.message);
        if (!controller.signal.aborted) sendEvent(res, "error", { message: error.message });
    } finally {
        if (!res.writableEnded) res.end();
    }
});

module.exports = router;
