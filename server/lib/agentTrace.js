"use strict";
/**
 * lib/agentTrace.js
 * Parses structured Flowise agent-trace events into UI-friendly SSE events.
 */

const { sendEvent } = require("./flowise");

/**
 * Safely parse a value that might already be an object or a JSON string.
 * @param {*} value
 * @returns {object|null}
 */
function parseMaybeJson(value) {
    if (!value) return null;
    if (typeof value === "object") return value;
    if (typeof value !== "string") return null;
    try {
        return JSON.parse(value);
    } catch {
        return null;
    }
}

/**
 * Interprets a single Flowise agent_trace step into one or more SSE events.
 * @param {import("http").ServerResponse} res
 * @param {object} traceData
 */
function processAgentTrace(res, traceData) {
    if (!traceData || typeof traceData !== "object") return;
    const step = traceData.step;

    if (step === "agent_action") {
        const actionObj = parseMaybeJson(traceData.action);
        if (!actionObj) return;
        const toolRaw = actionObj.tool || "";
        const toolInput = parseMaybeJson(actionObj.toolInput) || {};

        const isSearch = /tavily|search|serp|google/i.test(toolRaw);
        const isBrowser = /browser|scrape|crawl|fetch/i.test(toolRaw);

        if (isSearch) {
            const query = toolInput.input || toolInput.query || toolInput.q || "";
            sendEvent(res, "agentStep", { type: "search", query });
            sendEvent(res, "activity", { state: "searching" });
        } else if (isBrowser) {
            const url = toolInput.input || toolInput.url || "";
            sendEvent(res, "agentStep", { type: "browse", url });
            sendEvent(res, "activity", { state: "reading" });
        } else {
            sendEvent(res, "agentStep", { type: "tool", tool: toolRaw });
            sendEvent(res, "activity", { state: "tool", tool: toolRaw });
        }
        return;
    }

    if (step === "tool_end") {
        const output = parseMaybeJson(traceData.output);
        if (Array.isArray(output)) {
            const sources = output
                .filter((item) => item && item.url)
                .map((item) => ({ url: item.url, title: item.title || "" }))
                .slice(0, 8);
            if (sources.length > 0) {
                sendEvent(res, "agentStep", { type: "sources", items: sources });
            }
        }
        // tool_start is redundant with agent_action — silently consumed
    }
}

module.exports = { parseMaybeJson, processAgentTrace };
