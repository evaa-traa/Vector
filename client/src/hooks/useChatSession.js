import { useEffect, useMemo, useRef, useState } from "react";
import { createParser } from "eventsource-parser";

const MAX_MESSAGES = 20;

const MODES = [
  { id: "chat", label: "Chat Mode" },
  { id: "research", label: "Research Mode" }
];

const ACTIVITY_LABELS = {
  searching: "Searching",
  reading: "Reading sources",
  reasoning: "Reasoning",
  writing: "Writing answer"
};

function loadSessions(modelId) {
  if (!modelId) return [];
  const raw = localStorage.getItem(`flowise_history_${modelId}`);
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

function saveSessions(modelId, sessions) {
  if (!modelId) return;
  const normalized = normalizeSessionsForStorage(sessions);
  try {
    localStorage.setItem(
      `flowise_history_${modelId}`,
      JSON.stringify(normalized)
    );
  } catch (error) {
    const reduced = normalized.map((session) => ({
      ...session,
      messages: session.messages.slice(-10)
    }));
    try {
      localStorage.setItem(
        `flowise_history_${modelId}`,
        JSON.stringify(reduced)
      );
    } catch (innerError) {
      localStorage.removeItem(`flowise_history_${modelId}`);
    }
  }
}

function createSession(mode) {
  return {
    id: crypto.randomUUID(),
    title: "New chat",
    mode,
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
  const [selectedModelId, setSelectedModelId] = useState("");
  const [modelsIssues, setModelsIssues] = useState([]);
  const [isModelsLoading, setIsModelsLoading] = useState(true);
  const [modelsError, setModelsError] = useState("");
  const [modelsReloadToken, setModelsReloadToken] = useState(0);
  const [mode, setMode] = useState("chat");
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState("");
  const [message, setMessage] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef(null);

  const activeSession = sessions.find((item) => item.id === activeSessionId);

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

  useEffect(() => {
    if (!selectedModelId) return;
    const stored = loadSessions(selectedModelId);
    setSessions(stored);
    if (stored.length > 0) {
      setActiveSessionId(stored[0].id);
    } else {
      const fresh = createSession(mode);
      setSessions([fresh]);
      setActiveSessionId(fresh.id);
    }
  }, [selectedModelId]);

  useEffect(() => {
    if (activeSession?.mode) {
      setMode(activeSession.mode);
    }
  }, [activeSession?.mode]);

  useEffect(() => {
    if (!selectedModelId) return;
    saveSessions(selectedModelId, sessions);
  }, [selectedModelId, sessions]);

  const historyList = useMemo(() => {
    return [...sessions].sort((a, b) => b.createdAt - a.createdAt);
  }, [sessions]);

  const selectedModel = useMemo(() => {
    return models.find((m) => m.id === selectedModelId) || null;
  }, [models, selectedModelId]);

  function updateSession(sessionId, updater) {
    setSessions((prev) =>
      prev.map((item) =>
        item.id === sessionId ? updater(item) : item
      )
    );
  }

  function handleNewChat() {
    const fresh = createSession(mode);
    setSessions((prev) => [fresh, ...prev]);
    setActiveSessionId(fresh.id);
    setMessage("");
  }

  function handleClearHistory() {
    const fresh = createSession(mode);
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

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

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
        throw new Error("No stream");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

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
          updateSession(activeSession.id, (session) => ({
            ...session,
            messages: session.messages.map((msg) =>
              msg.id === assistantMessage.id
                ? { ...msg, content: msg.content + (parsed.text || "") }
                : msg
            )
          }));
        }

        if (eventName === "activity") {
          updateSession(activeSession.id, (session) => ({
            ...session,
            messages: session.messages.map((msg) =>
              msg.id === assistantMessage.id
                ? {
                  ...msg,
                  activities: Array.from(
                    new Set([...(msg.activities || []), parsed.state])
                  )
                }
                : msg
            )
          }));
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
        parser.feed(decoder.decode(value, { stream: true }));
      }
    } catch (error) {
      if (error?.name === "AbortError") {
        updateSession(activeSession.id, (session) => ({
          ...session,
          messages: session.messages.map((msg) =>
            msg.id === assistantMessage.id && !msg.content
              ? {
                ...msg,
                content: "Connection was interrupted while contacting Flowise. Please try again."
              }
              : msg
          )
        }));
        setIsStreaming(false);
        return;
      }
      updateSession(activeSession.id, (session) => ({
        ...session,
        messages: session.messages.map((msg) =>
          msg.id === assistantMessage.id
            ? {
              ...msg,
              content:
                error?.message ||
                "Something went wrong. Please try again."
            }
            : msg
        )
      }));
    } finally {
      setIsStreaming(false);
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
    message,
    setMessage,
    isStreaming,
    handleNewChat,
    handleClearHistory,
    handleModeChange,
    handleSend,
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
