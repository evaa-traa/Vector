"use strict";
/**
 * lib/flowise.js
 * All Flowise API communication: SSE helpers, auth headers, streaming.
 */

const { createParser } = require("eventsource-parser");

const DEBUG = process.env.DEBUG === "true";

// ── SSE helpers ──────────────────────────────────────────────────────────────

/**
 * Write a single SSE event to the response.
 * @param {import("http").ServerResponse} res
 * @param {string} event
 * @param {object} data
 */
function sendEvent(res, event, data) {
    if (res.writableEnded) return;
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    // Force-flush the chunk to the client immediately (critical for SSE streaming)
    if (typeof res.flush === "function") res.flush();
}

/**
 * Schedules a lightweight "thinking" activity event as a fallback if
 * Flowise doesn't emit any activity events within 1.2s.
 * @param {import("http").ServerResponse} res
 * @returns {() => void} cancel function
 */
function scheduleActivities(res) {
    const timer = setTimeout(() => {
        sendEvent(res, "activity", { state: "thinking" });
    }, 1200);
    return () => clearTimeout(timer);
}

// ── Auth headers ─────────────────────────────────────────────────────────────

/**
 * Build the extra HTTP headers required to authenticate with a specific model's Flowise instance.
 * @param {object} model
 * @returns {Record<string, string>}
 */
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

// ── Prompt builder ────────────────────────────────────────────────────────────

/**
 * Builds the question sent to Flowise.
 * Currently passes the message through unchanged — all prompt engineering
 * lives in the Flowise chatflow configuration.
 * @param {string} message
 * @param {string} _mode  kept for forward-compatibility
 * @returns {string}
 */
function buildPrompt(message, _mode) {
    return message;
}

// ── Streaming ─────────────────────────────────────────────────────────────────

/**
 * Stream a prediction from Flowise to the client via SSE.
 * Imports processAgentTrace lazily to avoid a circular dependency
 * (agentTrace.js imports sendEvent from here).
 *
 * @param {{ res, model, message, mode, sessionId, uploads, signal }} opts
 * @returns {Promise<boolean>} true if stream ended cleanly via "end" event
 */
async function streamFlowise({ res, model, message, mode, sessionId, uploads = [], signal }) {
    // Lazy import to avoid circular dep
    const { parseMaybeJson, processAgentTrace } = require("./agentTrace");

    const url = `${model.host}/api/v1/prediction/${model.id}`;
    const payload = {
        question: buildPrompt(message, mode),
        streaming: true,
        chatId: sessionId,
        overrideConfig: sessionId ? { sessionId } : undefined,
        uploads: uploads.length > 0 ? uploads : undefined
    };

    if (DEBUG) {
        console.log(`[Flowise] Fetching URL: ${url}`);
        console.log(`[Flowise] Payload:`, JSON.stringify(payload).slice(0, 200));
    }

    const extraHeaders = getFlowiseHeaders(model);

    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...extraHeaders },
        body: JSON.stringify(payload),
        signal,
        duplex: "half"
    }).catch((err) => {
        console.error("[Flowise] Fetch error:", err);
        const wrapped = new Error(`Failed to connect to Flowise: ${err.message}`);
        wrapped.name = err?.name || wrapped.name;
        wrapped.cause = err;
        throw wrapped;
    });

    const contentType = response.headers.get("content-type") || "";
    if (DEBUG) {
        console.log(`[Flowise] Status: ${response.status}, Content-Type: ${contentType}`);
        console.log(`[Flowise] Headers:`, JSON.stringify(Object.fromEntries(response.headers.entries())));
    }

    if (!response.ok) {
        const text = await response.text().catch(() => "");
        console.error(`[Flowise] API error (${response.status}):`, text);
        throw new Error(`Flowise error ${response.status}: ${text}`);
    }

    if (!response.body) {
        throw new Error("Flowise returned an empty response body.");
    }

    // Non-streaming JSON fallback (Flowise occasionally returns JSON instead of SSE)
    if (!contentType.includes("text/event-stream")) {
        console.warn(`[Flowise] Warning: Expected event-stream but got ${contentType}`);
        if (contentType.includes("application/json")) {
            const json = await response.json().catch(() => null);
            if (json) {
                const text = json.text || json.answer || json.output || json.message || JSON.stringify(json);
                // Upstream returned non-streaming JSON; emit immediately to avoid artificial lag.
                sendEvent(res, "token", { text });
                return true;
            }
        }
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let ended = false;

    function normalizeToolList(toolData) {
        if (!toolData) return [];
        const queue = [toolData];
        const out = [];
        const scanLimit = 500;
        let scanned = 0;

        while (queue.length > 0 && scanned < scanLimit) {
            scanned += 1;
            const node = queue.shift();
            if (!node) continue;

            if (typeof node === "string") {
                const trimmed = node.trim();
                const looksJson = trimmed.startsWith("{") || trimmed.startsWith("[");
                const parsed = looksJson ? parseMaybeJson(trimmed) : null;
                if (parsed) queue.push(parsed);
                continue;
            }

            if (Array.isArray(node)) {
                for (const item of node) queue.push(item);
                continue;
            }

            if (typeof node !== "object") continue;

            if (node.action && typeof node.action === "object") {
                queue.push(node.action);
            }

            if (node.function && typeof node.function === "object" && typeof node.function.name === "string") {
                out.push({
                    tool: node.function.name,
                    toolInput: node.function.arguments || node.arguments || node.input || "",
                    toolOutput: node.output || node.observation || node.result || ""
                });
            }

            const hasToolName =
                typeof node.tool === "string" ||
                typeof node.toolName === "string" ||
                (typeof node.name === "string" && (node.toolInput || node.toolOutput || node.input || node.output || node.args || node.arguments));
            if (hasToolName) out.push(node);

            for (const value of Object.values(node)) {
                if (!value) continue;
                if (typeof value === "object") {
                    queue.push(value);
                    continue;
                }
                if (typeof value === "string") {
                    const t = value.trim();
                    if (t.startsWith("{") || t.startsWith("[")) {
                        const parsed = parseMaybeJson(t);
                        if (parsed) queue.push(parsed);
                    }
                }
            }
        }

        return out;
    }

    function extractUrlsFromText(text) {
        if (typeof text !== "string" || !text) return [];
        const matches = text.match(/https?:\/\/[^\s)"']+/g) || [];
        return [...new Set(matches.map((u) => u.replace(/[.,)\]]$/, "")))];
    }

    function emitSourcesFromToolOutput(toolOutputRaw) {
        const parsed = parseMaybeJson(toolOutputRaw) || toolOutputRaw;
        const arraysToScan = [];

        if (Array.isArray(parsed)) arraysToScan.push(parsed);
        if (parsed && typeof parsed === "object") {
            if (Array.isArray(parsed.results)) arraysToScan.push(parsed.results);
            if (Array.isArray(parsed.data)) arraysToScan.push(parsed.data);
            if (parsed.data && Array.isArray(parsed.data.results)) arraysToScan.push(parsed.data.results);
            if (Array.isArray(parsed.output)) arraysToScan.push(parsed.output);
        }

        const sourceMap = new Map();
        for (const arr of arraysToScan) {
            for (const item of arr) {
                if (!item || typeof item !== "object" || !item.url) continue;
                const url = String(item.url);
                if (!sourceMap.has(url)) {
                    sourceMap.set(url, { url, title: String(item.title || "") });
                }
            }
        }

        if (sourceMap.size === 0) {
            const text = typeof parsed === "string" ? parsed : "";
            const urls = extractUrlsFromText(text);
            for (const url of urls) {
                if (!sourceMap.has(url)) sourceMap.set(url, { url, title: "" });
            }
        }

        const sources = [...sourceMap.values()].slice(0, 8);
        if (sources.length > 0) {
            sendEvent(res, "agentStep", { type: "sources", items: sources });
        }
    }

    function pickFirstString(values) {
        for (const value of values) {
            if (typeof value === "string" && value.trim()) return value.trim();
        }
        return "";
    }

    function processUsedTool(toolObj) {
        if (!toolObj || typeof toolObj !== "object") return;
        const toolName = String(
            toolObj.tool ||
            toolObj.name ||
            toolObj.toolName ||
            toolObj.action?.tool ||
            toolObj.function?.name ||
            "Tool"
        );
        const rawInput =
            toolObj.toolInput ??
            toolObj.input ??
            toolObj.args ??
            toolObj.arguments ??
            toolObj.action?.toolInput ??
            toolObj.function?.arguments ??
            {};
        const toolInput = parseMaybeJson(rawInput) || rawInput || {};

        const isSearch = /tavily|search|serp|google|duckduckgo|bing/i.test(toolName);
        const isBrowser = /browser|scrape|scraper|crawl|fetch|web|navigate|url|site|page|playwright|puppeteer|firecrawl|extract/i.test(toolName);
        const query = pickFirstString([
            toolInput.input,
            toolInput.query,
            toolInput.q,
            toolInput.search,
            toolInput.searchTerm,
            toolInput.keyword,
            toolInput.question,
            typeof toolInput === "string" ? toolInput : ""
        ]);
        const url = pickFirstString([
            toolInput.url,
            toolInput.link,
            toolInput.href,
            toolInput.website,
            toolInput.target,
            toolInput.uri,
            toolInput.input
        ]);

        if (isSearch || (query && !url)) {
            sendEvent(res, "agentStep", { type: "search", query });
            sendEvent(res, "activity", { state: "searching" });
        } else if (url && (isBrowser || !query)) {
            sendEvent(res, "agentStep", { type: "browse", url });
            sendEvent(res, "activity", { state: "reading" });
        } else {
            sendEvent(res, "agentStep", { type: "tool", tool: toolName });
            sendEvent(res, "activity", { state: "tool", tool: toolName });
        }

        emitSourcesFromToolOutput(
            toolObj.toolOutput ||
            toolObj.output ||
            toolObj.observation ||
            toolObj.result ||
            toolObj.response ||
            null
        );
    }

    function emitToolUsageFromPayload(payload) {
        const tools = normalizeToolList(payload);
        if (tools.length === 0) return false;
        const seen = new Set();
        for (const tool of tools) {
            const signature = JSON.stringify({
                tool: tool?.tool || tool?.toolName || tool?.name || tool?.function?.name || tool?.action?.tool || "",
                input: tool?.toolInput || tool?.input || tool?.args || tool?.arguments || tool?.function?.arguments || tool?.action?.toolInput || "",
                output: tool?.toolOutput || tool?.output || tool?.observation || tool?.result || ""
            });
            if (seen.has(signature)) continue;
            seen.add(signature);
            processUsedTool(tool);
        }
        return true;
    }

    const parser = createParser((event) => {
        if (event.type !== "event") return;
        const upstreamEventName = event.event || "";
        const raw = event.data || "";
        if (!raw) return;

        // ── Named upstream events ──
        if (upstreamEventName) {
            if (upstreamEventName === "token") { sendEvent(res, "token", { text: raw }); return; }
            if (upstreamEventName === "metadata") {
                let meta = null;
                try { meta = JSON.parse(raw); } catch { meta = { value: raw }; }
                sendEvent(res, "metadata", meta);
                emitToolUsageFromPayload(meta);
                return;
            }
            if (upstreamEventName === "start") { sendEvent(res, "activity", { state: "writing" }); return; }
            if (upstreamEventName === "end") { ended = true; return; }
            if (upstreamEventName === "error") { sendEvent(res, "error", { message: raw }); ended = true; return; }

            if (upstreamEventName === "usedTools") {
                const toolData = parseMaybeJson(raw);
                emitToolUsageFromPayload(toolData);
                return;
            }

            if (upstreamEventName === "agentFlowEvent") {
                const flowData = parseMaybeJson(raw);
                if (flowData) {
                    const step = flowData.step || flowData.state || flowData.type || "";
                    if (step) sendEvent(res, "activity", { state: step });
                }
                return;
            }

            if (upstreamEventName === "agent_trace") {
                processAgentTrace(res, parseMaybeJson(raw));
                return;
            }
        }

        // ── Envelope-wrapped events (no named event) ──
        let parsed = null;
        try { parsed = JSON.parse(raw); } catch { parsed = null; }

        if (parsed && typeof parsed === "object") {
            if (typeof parsed.event === "string" && Object.prototype.hasOwnProperty.call(parsed, "data")) {
                const ie = parsed.event;
                const id = parsed.data;

                if (ie === "token") { sendEvent(res, "token", { text: typeof id === "string" ? id : String(id || "") }); return; }
                if (ie === "metadata") {
                    const meta = id && typeof id === "object" ? id : { value: id };
                    sendEvent(res, "metadata", meta);
                    emitToolUsageFromPayload(meta);
                    return;
                }
                if (ie === "start") { sendEvent(res, "activity", { state: "writing" }); return; }
                if (ie === "end") { ended = true; return; }
                if (ie === "error") {
                    const msg = typeof id === "string" ? id : (id && (id.message || id.error)) || "Unknown error";
                    sendEvent(res, "error", { message: msg });
                    ended = true;
                    return;
                }
                if (ie === "usedTools") {
                    const toolData = id && typeof id === "object" ? id : parseMaybeJson(id);
                    emitToolUsageFromPayload(toolData);
                    return;
                }
                if (ie === "agentFlowEvent") {
                    const fd = id && typeof id === "object" ? id : parseMaybeJson(id);
                    if (fd) { const s = fd.step || fd.state || fd.type || ""; if (s) sendEvent(res, "activity", { state: s }); }
                    return;
                }
                if (ie === "agent_trace") {
                    processAgentTrace(res, id && typeof id === "object" ? id : parseMaybeJson(id));
                    return;
                }
            }

            const errorText = parsed.error || parsed.message?.error;
            if (errorText) { sendEvent(res, "error", { message: errorText }); ended = true; return; }

            if (emitToolUsageFromPayload(parsed)) return;
        }

        // Plain text / unknown shape → treat as token
        const payloadText = (parsed && (parsed.token || parsed.text || parsed.answer || parsed.message)) || raw;
        if (payloadText) sendEvent(res, "token", { text: payloadText });
    });

    while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        parser.feed(decoder.decode(value, { stream: true }));
        if (ended) { await reader.cancel().catch(() => undefined); break; }
    }

    return ended;
}

module.exports = { sendEvent, scheduleActivities, getFlowiseHeaders, buildPrompt, streamFlowise };
