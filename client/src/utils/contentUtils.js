/**
 * Utility functions for cleaning and processing AI response content
 */

/**
 * Strips JSON metadata blocks that AI agents sometimes output.
 * These are internal traces that shouldn't be displayed to users.
 * 
 * Patterns removed:
 * - {"event":"agent_trace",...} blocks with nested content
 * - Long JSON objects containing runId, parentRunId, toolInput, etc.
 * 
 * @param {string} text - The raw text content
 * @returns {string} - Cleaned text without metadata
 */
export function stripMetadata(text) {
    if (!text || typeof text !== "string") return text;

    // Pattern to match agent_trace JSON blocks
    // These can be quite long and contain nested objects
    let cleaned = text;

    // Remove {"event":"agent_trace",...} patterns
    // This regex matches from {"event":"agent_trace" to the closing }
    // accounting for nested braces
    cleaned = cleaned.replace(
        /\{"event"\s*:\s*"agent_trace"[^]*?"runId"\s*:\s*"[a-f0-9-]+"\s*,\s*"parentRunId"\s*:\s*"[a-f0-9-]+"\s*\}\s*\}/g,
        ""
    );

    // Fallback simpler pattern for variations
    cleaned = cleaned.replace(
        /\{"event"\s*:\s*"agent_trace"[^}]*\}(?:\s*\})?/g,
        ""
    );

    // Remove JSON blocks that look like tool metadata
    cleaned = cleaned.replace(
        /\{"tool"\s*:\s*"[^"]+"\s*,\s*"toolInput"\s*:[^}]+\}[^{]*/g,
        ""
    );

    // Remove any remaining runId/parentRunId JSON fragments
    cleaned = cleaned.replace(
        /\{"runId"\s*:\s*"[a-f0-9-]+"\s*,\s*"parentRunId"\s*:\s*"[a-f0-9-]+"\s*\}/g,
        ""
    );

    // Clean up multiple consecutive newlines that may result from removals
    cleaned = cleaned.replace(/\n{3,}/g, "\n\n");

    return cleaned.trim();
}
