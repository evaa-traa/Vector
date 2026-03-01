import { useEffect, useMemo, useRef, useState } from "react";
import { createParser } from "eventsource-parser";

const MAX_MESSAGES = 20;
const REQUEST_TIMEOUT_MS = 60000; // 60 second timeout
const STREAM_FLUSH_INTERVAL_MS = 16;
const TRACE_BATCH_INTERVAL_MS = 40;
const GLOBAL_HISTORY_KEY = "flowise_history_global";

const MODES = [
  { id: "chat", label: "Chat Mode" }
];

const ACTIVITY_LABELS = {
  searching: "Searching",
  reading: "Reading sources",
  reasoning: "Reasoning",
  writing: "Writing answer",
  tool: "Using tool",
  thinking: "Thinking",
  planning: "Planning",
  executing: "Executing"
};

// Global history - all sessions stored together with their modelId
function loadAllSessions() {
  const raw = localStorage.getItem(GLOBAL_HISTORY_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function trimMessages(messages) {
  if (messages.length <= MAX_MESSAGES) return messages;
  return messages.slice(-MAX_MESSAGES);
}

function normalizeSessionsForStorage(sessions) {
  return sessions.map((session) => ({
    ...session,
    messages: trimMessages(session.messages || [])
  }));
}

function saveAllSessions(sessions) {
  const normalized = normalizeSessionsForStorage(sessions);
  try {
    localStorage.setItem(GLOBAL_HISTORY_KEY, JSON.stringify(normalized));
  } catch (error) {
    const reduced = normalized.map((session) => ({
      ...session,
      messages: session.messages.slice(-10)
    }));
    try {
      localStorage.setItem(GLOBAL_HISTORY_KEY, JSON.stringify(reduced));
    } catch (innerError) {
      localStorage.removeItem(GLOBAL_HISTORY_KEY);
    }
  }
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

function extractToolEventsFromText(text) {
  if (typeof text !== "string" || !text.trim()) return [];

  const names = [];
  const seenNames = new Set();
  const nameRegex = /(?:toolName|tool|name)\s*["']?\s*[:=]\s*["']([^"'\n\r,}]+)["']/gi;
  let match = null;
  while ((match = nameRegex.exec(text)) !== null) {
    const name = (match[1] || "").trim();
    if (!name || seenNames.has(name)) continue;
    seenNames.add(name);
    names.push(name);
  }

  // Common case from Flowise logs where the tool key might not be quoted cleanly.
  if (names.length === 0 && /tavily_search_results_json/i.test(text)) {
    names.push("tavily_search_results_json");
  }

  if (names.length === 0) return [];

  const queryMatch =
    text.match(/(?:query|searchTerm|input|q)\s*["']?\s*[:=]\s*["']([^"'\n\r]+)["']/i) ||
    text.match(/(?:query|searchTerm|input|q)\s*["']?\s*[:=]\s*([^,\n\r}]+)/i);
  const urlMatch =
    text.match(/(?:url|link|href|website|target)\s*["']?\s*[:=]\s*["']([^"'\n\r]+)["']/i) ||
    text.match(/(?:url|link|href|website|target)\s*["']?\s*[:=]\s*([^,\n\r}]+)/i);
  const query = queryMatch?.[1]?.trim() || "";
  const url = urlMatch?.[1]?.trim() || "";

  const sources = [];
  const urlRegex = /https?:\/\/[^\s)"']+/g;
  const seenUrls = new Set();
  let urlEntry = null;
  while ((urlEntry = urlRegex.exec(text)) !== null) {
    const cleaned = urlEntry[0].replace(/[.,)\]]$/, "");
    if (!cleaned || seenUrls.has(cleaned)) continue;
    seenUrls.add(cleaned);
    sources.push({ url: cleaned, title: "" });
    if (sources.length >= 8) break;
  }

  return names.map((toolName) => ({
    toolName,
    input: { query, url },
    output: sources.length > 0 ? { results: sources } : ""
  }));
}

function extractToolEventsFromMetadata(meta) {
  const normalized =
    typeof meta === "string" ? (parseMaybeJson(meta) || { value: meta }) : meta;
  if (!normalized || typeof normalized !== "object") return [];

  const events = [];
  const queue = [normalized];
  const seen = new Set();
  const maxNodes = 400;
  let scanned = 0;

  while (queue.length > 0 && scanned < maxNodes) {
    scanned += 1;
    const node = queue.shift();
    if (!node) continue;

    if (typeof node === "string") {
      const parsed = parseMaybeJson(node);
      if (parsed) {
        queue.push(parsed);
      } else {
        const textEvents = extractToolEventsFromText(node);
        for (const event of textEvents) {
          const signature = JSON.stringify(event);
          if (seen.has(signature)) continue;
          seen.add(signature);
          events.push(event);
        }
      }
      continue;
    }

    if (Array.isArray(node)) {
      for (const item of node) queue.push(item);
      continue;
    }

    if (typeof node !== "object") continue;

    if (Array.isArray(node.usedTools)) queue.push(node.usedTools);
    if (Array.isArray(node.tools)) queue.push(node.tools);
    if (node.metadata && typeof node.metadata === "object") queue.push(node.metadata);

    const toolName =
      node.tool ||
      node.toolName ||
      node.name ||
      node?.function?.name ||
      node?.action?.tool;

    if (typeof toolName === "string" && toolName.trim()) {
      const inputRaw =
        node.toolInput ??
        node.input ??
        node.args ??
        node.arguments ??
        node?.function?.arguments ??
        node?.action?.toolInput ??
        "";
      const outputRaw =
        node.toolOutput ??
        node.output ??
        node.result ??
        node.observation ??
        "";

      const input = parseMaybeJson(inputRaw) || inputRaw;
      const output = parseMaybeJson(outputRaw) || outputRaw;
      const signature = JSON.stringify({ toolName, input, output });
      if (!seen.has(signature)) {
        seen.add(signature);
        events.push({ toolName, input, output });
      }
    }

    for (const value of Object.values(node)) {
      if (!value) continue;
      if (typeof value === "object") queue.push(value);
      if (typeof value === "string") {
        const parsed = parseMaybeJson(value);
        if (parsed) queue.push(parsed);
      }
    }
  }

  return events;
}

function deriveStepsFromToolEvent(event) {
  const toolName = String(event?.toolName || "Tool");
  const input = event?.input;
  const output = event?.output;
  const steps = [];
  const activities = [];

  const pickString = (candidates) => {
    for (const candidate of candidates) {
      if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
    }
    return "";
  };

  const query = pickString([
    input?.query,
    input?.q,
    input?.search,
    input?.searchTerm,
    input?.keyword,
    input?.question,
    input?.input,
    typeof input === "string" ? input : ""
  ]);

  const url = pickString([
    input?.url,
    input?.link,
    input?.href,
    input?.website,
    input?.target,
    input?.uri,
    input?.input
  ]);

  const isSearchTool = /tavily|search|serp|google|duckduckgo|bing/i.test(toolName);
  const isBrowseTool = /browser|scrape|scraper|crawl|fetch|web|navigate|url|site|page|playwright|puppeteer|firecrawl|extract/i.test(toolName);

  if (isSearchTool || (query && !url)) {
    steps.push({ type: "search", query: query || toolName });
    activities.push("searching");
  } else if (url && (isBrowseTool || !query)) {
    steps.push({ type: "browse", url });
    activities.push("reading");
  } else {
    steps.push({ type: "tool", tool: toolName });
    activities.push(`tool:${toolName}`);
  }

  const sourceMap = new Map();
  const outputsToScan = [];
  if (Array.isArray(output)) outputsToScan.push(output);
  if (output && typeof output === "object") {
    if (Array.isArray(output.results)) outputsToScan.push(output.results);
    if (Array.isArray(output.data)) outputsToScan.push(output.data);
    if (output.data && Array.isArray(output.data.results)) outputsToScan.push(output.data.results);
    if (Array.isArray(output.output)) outputsToScan.push(output.output);
  }

  for (const list of outputsToScan) {
    for (const item of list) {
      if (!item || typeof item !== "object" || !item.url) continue;
      const itemUrl = String(item.url);
      if (!sourceMap.has(itemUrl)) {
        sourceMap.set(itemUrl, { url: itemUrl, title: String(item.title || "") });
      }
    }
  }

  if (sourceMap.size === 0 && typeof output === "string") {
    const matches = output.match(/https?:\/\/[^\s)"']+/g) || [];
    for (const itemUrl of matches) {
      const cleaned = itemUrl.replace(/[.,)\]]$/, "");
      if (!sourceMap.has(cleaned)) {
        sourceMap.set(cleaned, { url: cleaned, title: "" });
      }
    }
  }

  const sources = [...sourceMap.values()].slice(0, 8);
  if (sources.length > 0) {
    steps.push({ type: "sources", items: sources });
  }

  return { steps, activities };
}

// Session now includes modelId to lock it to that model
function createSession(mode, modelId) {
  return {
    id: crypto.randomUUID(),
    title: "New chat",
    mode,
    modelId, // Lock session to this model
    createdAt: Date.now(),
    messages: []
  };
}

// Convert File object to Flowise upload format (base64 data URI)
async function fileToFlowise(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({
      type: "file",
      name: file.name,
      data: reader.result, // data:mime;base64,...
      mime: file.type || "application/octet-stream"
    });
    reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
    reader.readAsDataURL(file);
  });
}

// Convert array of File objects to Flowise uploads array
async function filesToFlowise(files) {
  if (!files || files.length === 0) return [];
  const results = await Promise.all(
    files.map(file => fileToFlowise(file).catch(err => {
      console.warn(`Skipping file ${file.name}:`, err.message);
      return null;
    }))
  );
  return results.filter(Boolean);
}

export function useChatSession() {
  const [models, setModels] = useState([]);
  const [modelsIssues, setModelsIssues] = useState([]);
  const [isModelsLoading, setIsModelsLoading] = useState(true);
  const [modelsError, setModelsError] = useState("");
  const [modelsReloadToken, setModelsReloadToken] = useState(0);
  const [mode, setMode] = useState("chat");
  const [message, setMessage] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const isStreamingRef = useRef(false); // ref copy to avoid stale closure in timeouts
  const abortRef = useRef(null);
  const timeoutRef = useRef(null);
  const initialLoadDone = useRef(false);
  const tokenBufferRef = useRef("");
  const tokenFlushTimerRef = useRef(null);

  // Load sessions synchronously from localStorage on first render
  // to avoid race conditions with model loading
  const initialSessions = useRef(null);
  if (initialSessions.current === null) {
    initialSessions.current = loadAllSessions();
    initialLoadDone.current = true;
  }

  const [sessions, setSessions] = useState(() => {
    return initialSessions.current.length > 0 ? initialSessions.current : [];
  });

  const [activeSessionId, setActiveSessionId] = useState(() => {
    return initialSessions.current.length > 0 ? initialSessions.current[0].id : "";
  });

  // Initialize selectedModelId from the stored session's modelId (if any)
  const [selectedModelId, setSelectedModelId] = useState(() => {
    const first = initialSessions.current[0];
    return first?.modelId || "";
  });

  const activeSession = sessions.find((item) => item.id === activeSessionId);

  // Session is locked when it has messages - disables model switching
  // IMPORTANT: This is computed, not stored, so it updates instantly
  const isSessionLocked = useMemo(() => {
    if (!activeSession) return false;
    return (activeSession.messages?.length ?? 0) > 0;
  }, [activeSession]);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    async function loadModels() {
      setIsModelsLoading(true);
      setModelsError("");
      try {
        const res = await fetch("/models", { signal: controller.signal });
        const raw = await res.json().catch(() => null);
        if (!res.ok) {
          const message =
            (raw && (raw.error || raw.message)) ||
            `Failed to load models (${res.status})`;
          throw new Error(message);
        }

        const nextModels = Array.isArray(raw) ? raw : raw?.models;
        const issues = Array.isArray(raw?.issues) ? raw.issues : [];

        if (!Array.isArray(nextModels)) {
          throw new Error("Invalid models response");
        }

        const normalized = nextModels
          .filter((item) => item && typeof item === "object")
          .map((item) => ({
            id: String(item.id || ""),
            name: String(item.name || ""),
            features: {
              uploads: Boolean(item?.features?.uploads),
              tts: Boolean(item?.features?.tts),
              stt: Boolean(item?.features?.stt),
              status: String(item?.features?.status || "unknown")
            }
          }))
          .filter((item) => item.id && item.name);

        if (!isMounted) return;
        setModels(normalized);
        setModelsIssues(issues);

        setSelectedModelId((prev) => {
          // If there's already a valid model selected (e.g. restored from session), keep it
          if (prev && normalized.some((m) => m.id === prev)) return prev;
          return normalized[0]?.id || "";
        });
      } catch (error) {
        if (!isMounted) return;
        if (error?.name === "AbortError") return;
        setModels([]);
        setModelsIssues([]);
        setModelsError(error?.message || "Failed to load models");
        setSelectedModelId("");
      } finally {
        if (!isMounted) return;
        setIsModelsLoading(false);
      }
    }

    loadModels();
    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [modelsReloadToken]);

  // When no sessions exist and we have a model, create a fresh session
  useEffect(() => {
    if (sessions.length === 0 && selectedModelId && initialLoadDone.current) {
      const fresh = createSession(mode, selectedModelId);
      setSessions([fresh]);
      setActiveSessionId(fresh.id);
    }
  }, [sessions.length, selectedModelId, mode]);

  useEffect(() => {
    if (activeSession?.mode) {
      setMode(activeSession.mode);
    }
  }, [activeSession?.mode]);

  // Sync selectedModelId onto the active session while it's still empty
  // This ensures that if the user changes the model dropdown before typing,
  // the session remembers this correct new model when it gets locked.
  useEffect(() => {
    if (activeSession && selectedModelId && !isSessionLocked) {
      if (activeSession.modelId !== selectedModelId) {
        updateSession(activeSession.id, (session) => ({
          ...session,
          modelId: selectedModelId
        }));
      }
    }
  }, [activeSession, selectedModelId, isSessionLocked]);

  // Save sessions globally whenever they change
  useEffect(() => {
    if (sessions.length > 0) {
      saveAllSessions(sessions);
    }
  }, [sessions]);

  const historyList = useMemo(() => {
    return [...sessions].sort((a, b) => b.createdAt - a.createdAt);
  }, [sessions]);

  const selectedModel = useMemo(() => {
    return models.find((m) => m.id === selectedModelId) || null;
  }, [models, selectedModelId]);

  // Handle session selection - auto-switch model to match session
  function handleSelectSession(sessionId) {
    const session = sessions.find(s => s.id === sessionId);
    if (session) {
      setActiveSessionId(sessionId);
      // If the session has a modelId, switch to it
      if (session.modelId) {
        setSelectedModelId(session.modelId);
      }
    }
  }

  function updateSession(sessionId, updater) {
    setSessions((prev) =>
      prev.map((item) =>
        item.id === sessionId ? updater(item) : item
      )
    );
  }

  function handleNewChat() {
    const fresh = createSession(mode, selectedModelId);
    setSessions((prev) => [fresh, ...prev]);
    setActiveSessionId(fresh.id);
    setMessage("");
  }

  function handleClearHistory() {
    const fresh = createSession(mode, selectedModelId);
    setSessions([fresh]);
    setActiveSessionId(fresh.id);
    setMessage("");
  }

  function handleModeChange(nextMode) {
    setMode(nextMode);
    if (activeSession) {
      updateSession(activeSession.id, (session) => ({
        ...session,
        mode: nextMode
      }));
    }
  }

  async function handleSend(files = []) {
    if (!message.trim() || !activeSession || isStreaming) return;
    if (message.trim().length > 10000) return;

    // Convert files to Flowise format
    const uploads = await filesToFlowise(files);

    const userMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: message.trim(),
      attachments: uploads.length > 0 ? uploads.map(u => u.name) : undefined
    };
    const assistantMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      activities: [],
      hasAnswerStarted: false,
      createdAt: Date.now()
    };

    if (!selectedModelId) {
      updateSession(activeSession.id, (session) => ({
        ...session,
        mode,
        messages: trimMessages([
          ...session.messages,
          userMessage,
          {
            ...assistantMessage,
            content: "No AI model selected or configured. Please check your .env configuration in the server folder."
          }
        ])
      }));
      setMessage("");
      return;
    }

    updateSession(activeSession.id, (session) => {
      const updated = {
        ...session,
        mode,
        messages: trimMessages([
          ...session.messages,
          userMessage,
          assistantMessage
        ])
      };
      if (session.title === "New chat") {
        updated.title = userMessage.content.slice(0, 36);
      }
      return updated;
    });
    setMessage("");
    setIsStreaming(true);
    isStreamingRef.current = true;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set up timeout for the request (uses ref to avoid stale closure)
    timeoutRef.current = setTimeout(() => {
      if (isStreamingRef.current) {
        controller.abort();
        updateSession(activeSession.id, (session) => ({
          ...session,
          messages: session.messages.map((msg) =>
            msg.id === assistantMessage.id && !msg.content
              ? {
                ...msg,
                content: "Request timed out. The AI server may be slow or unavailable. Please check your connection and try again."
              }
              : msg
          )
        }));
        setIsStreaming(false);
        isStreamingRef.current = false;
      }
    }, REQUEST_TIMEOUT_MS);

    let hasReceivedData = false;

    try {
      const response = await fetch("/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage.content,
          modelId: selectedModelId,
          mode,
          sessionId: activeSession.id,
          uploads: uploads.length > 0 ? uploads : undefined
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(errorText || `Request failed (${response.status})`);
      }

      if (!response.body) {
        throw new Error("No response received from server");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      const pendingToolEvents = [];
      const pendingAgentSteps = [];
      let traceFlushTimer = null;
      const applyTraceUpdates = (toolEvents, agentSteps) => {
        if ((toolEvents?.length || 0) === 0 && (agentSteps?.length || 0) === 0) return;

        updateSession(activeSession.id, (session) => {
          let changed = false;
          const nextMessages = session.messages.map((msg) => {
            if (msg.id !== assistantMessage.id) return msg;

            const existingSteps = msg.agentSteps || [];
            const existingActivities = msg.activities || [];
            const stepSignatures = new Set(existingSteps.map((step) => JSON.stringify(step)));
            const activitySet = new Set(existingActivities);

            let nextSteps = existingSteps;
            let nextActivities = existingActivities;

            for (const toolEvent of toolEvents) {
              const derived = deriveStepsFromToolEvent(toolEvent);
              for (const step of derived.steps) {
                const signature = JSON.stringify(step);
                if (stepSignatures.has(signature)) continue;
                stepSignatures.add(signature);
                if (nextSteps === existingSteps) nextSteps = [...existingSteps];
                nextSteps.push(step);
              }
              for (const activityKey of derived.activities) {
                if (!activityKey || activitySet.has(activityKey)) continue;
                activitySet.add(activityKey);
                if (nextActivities === existingActivities) nextActivities = [...existingActivities];
                nextActivities.push(activityKey);
              }
            }

            for (const step of agentSteps) {
              const signature = JSON.stringify(step);
              if (stepSignatures.has(signature)) continue;
              stepSignatures.add(signature);
              if (nextSteps === existingSteps) nextSteps = [...existingSteps];
              nextSteps.push(step);
            }

            if (nextSteps.length > 60) {
              nextSteps = nextSteps.slice(-60);
            }

            if (nextSteps !== existingSteps || nextActivities !== existingActivities) {
              changed = true;
              return {
                ...msg,
                agentSteps: nextSteps,
                activities: nextActivities
              };
            }

            return msg;
          });

          return changed ? { ...session, messages: nextMessages } : session;
        });
      };

      const flushTraceUpdates = () => {
        if (traceFlushTimer) {
          clearTimeout(traceFlushTimer);
          traceFlushTimer = null;
        }
        if (pendingToolEvents.length === 0 && pendingAgentSteps.length === 0) return;
        const toolBatch = pendingToolEvents.splice(0, pendingToolEvents.length);
        const stepBatch = pendingAgentSteps.splice(0, pendingAgentSteps.length);
        applyTraceUpdates(toolBatch, stepBatch);
      };

      const appendToolEvents = (toolEvents) => {
        if (!Array.isArray(toolEvents) || toolEvents.length === 0) return;
        pendingToolEvents.push(...toolEvents);
        if (!traceFlushTimer) {
          traceFlushTimer = setTimeout(flushTraceUpdates, TRACE_BATCH_INTERVAL_MS);
        }
      };

      const appendAgentStep = (agentStep) => {
        if (!agentStep || typeof agentStep !== "object") return;
        pendingAgentSteps.push(agentStep);
        if (!traceFlushTimer) {
          traceFlushTimer = setTimeout(flushTraceUpdates, TRACE_BATCH_INTERVAL_MS);
        }
      };

      const extractToolEvents = (data, rawPayload) => {
        let toolEvents = extractToolEventsFromMetadata(data);
        if (toolEvents.length === 0) {
          toolEvents = extractToolEventsFromText(rawPayload);
        }
        if (toolEvents.length === 0 && typeof data?.value === "string") {
          toolEvents = extractToolEventsFromText(data.value);
        }
        return toolEvents;
      };

      let firstTokenFlushed = false;
      const flushBufferedTokens = () => {
        if (tokenFlushTimerRef.current) {
          clearTimeout(tokenFlushTimerRef.current);
          tokenFlushTimerRef.current = null;
        }
        const buffered = tokenBufferRef.current;
        tokenBufferRef.current = "";
        if (!buffered) return;
        updateSession(activeSession.id, (session) => ({
          ...session,
          messages: session.messages.map((msg) =>
            msg.id === assistantMessage.id
              ? {
                ...msg,
                content: msg.content + buffered,
                hasAnswerStarted: true
              }
              : msg
          )
        }));
      };

      const parser = createParser((event) => {
        if (event.type !== "event") return;
        const eventName = event.event || "";
        const payload = event.data || "";
        let parsed = null;
        try {
          parsed = JSON.parse(payload);
        } catch (error) {
          parsed = { text: payload };
        }

        if (eventName === "token") {
          hasReceivedData = true;
          // Reset timeout on receiving data
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = setTimeout(() => {
              controller.abort();
            }, REQUEST_TIMEOUT_MS);
          }
          // Flush the first visible token immediately, then batch at a tight cadence.
          tokenBufferRef.current += (parsed.text || "");
          if (!firstTokenFlushed && tokenBufferRef.current.length > 0) {
            firstTokenFlushed = true;
            flushBufferedTokens();
            return;
          }
          if (!tokenFlushTimerRef.current) {
            tokenFlushTimerRef.current = setTimeout(() => {
              flushBufferedTokens();
            }, STREAM_FLUSH_INTERVAL_MS);
          }
        }

        if (eventName === "activity") {
          const activityKey = parsed.tool
            ? `tool:${parsed.tool}`
            : parsed.state;
          if (!activityKey) return;
          updateSession(activeSession.id, (session) => {
            let changed = false;
            const nextMessages = session.messages.map((msg) => {
              if (msg.id !== assistantMessage.id) return msg;
              const current = msg.activities || [];
              if (current.includes(activityKey)) return msg;
              changed = true;
              return { ...msg, activities: [...current, activityKey] };
            });
            return changed ? { ...session, messages: nextMessages } : session;
          });
        }

        if (eventName === "metadata") {
          appendToolEvents(extractToolEvents(parsed, payload));
        }

        if (eventName === "usedTools" || eventName === "agent_trace") {
          appendToolEvents(extractToolEvents(parsed, payload));
        }

        if (eventName === "agentStep") {
          appendAgentStep(parsed);
        }

        if (eventName === "error") {
          updateSession(activeSession.id, (session) => ({
            ...session,
            messages: session.messages.map((msg) =>
              msg.id === assistantMessage.id
                ? {
                  ...msg,
                  content:
                    parsed.message || "Something went wrong. Please try again."
                }
                : msg
            )
          }));
        }
      });

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        parser.feed(chunk);
      }

      // Final flush of any remaining buffered tokens
      flushBufferedTokens();
      flushTraceUpdates();

      // Final save
      setSessions(prev => [...prev]);
    } catch (error) {
      // Clear timeout on error
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      if (error?.name === "AbortError") {
        updateSession(activeSession.id, (session) => ({
          ...session,
          messages: session.messages.map((msg) =>
            msg.id === assistantMessage.id && !msg.content
              ? {
                ...msg,
                content: hasReceivedData
                  ? "Response was interrupted. The partial response has been saved."
                  : "Connection was interrupted. Please check your internet connection and try again."
              }
              : msg
          )
        }));
        setIsStreaming(false);
        return;
      }

      // Network error handling
      const isNetworkError = error?.message?.includes("fetch") ||
        error?.message?.includes("network") ||
        error?.message?.includes("Failed to fetch") ||
        !navigator.onLine;

      updateSession(activeSession.id, (session) => ({
        ...session,
        messages: session.messages.map((msg) =>
          msg.id === assistantMessage.id
            ? {
              ...msg,
              content: isNetworkError
                ? "Unable to connect to the server. Please check your internet connection and try again."
                : error?.message || "Something went wrong. Please try again."
            }
            : msg
        )
      }));
    } finally {
      // Clear timeout on completion
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (tokenFlushTimerRef.current) {
        clearTimeout(tokenFlushTimerRef.current);
        tokenFlushTimerRef.current = null;
      }
      if (traceFlushTimer) {
        clearTimeout(traceFlushTimer);
        traceFlushTimer = null;
      }
      tokenBufferRef.current = "";
      setIsStreaming(false);
      isStreamingRef.current = false;
    }
  }

  function handleStop() {
    if (abortRef.current) {
      abortRef.current.abort();
    }
  }

  return {
    models,
    selectedModelId,
    setSelectedModelId,
    modelsIssues,
    isModelsLoading,
    modelsError,
    reloadModels: () => setModelsReloadToken((prev) => prev + 1),
    selectedModel,
    mode,
    setMode,
    sessions,
    activeSession,
    activeSessionId,
    setActiveSessionId,
    handleSelectSession,
    isSessionLocked,
    message,
    setMessage,
    isStreaming,
    handleNewChat,
    handleClearHistory,
    handleModeChange,
    handleSend,
    handleStop,
    historyList,
    MODES,
    ACTIVITY_LABELS
  };
}

export async function query(data) {
  const response = await fetch("/predict", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data || {})
  });
  const isJson = (response.headers.get("content-type") || "").includes("application/json");
  if (!response.ok) {
    const text = isJson ? await response.json().catch(() => null) : await response.text().catch(() => "");
    const message = (text && (text.error || text.message)) || (typeof text === "string" ? text : "");
    throw new Error(message || `Request failed (${response.status})`);
  }
  return isJson ? await response.json() : {};
}
