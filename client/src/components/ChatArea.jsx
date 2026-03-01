import React, { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import { motion, AnimatePresence } from "framer-motion";
import "katex/dist/katex.min.css";
import {
  SendHorizontal,
  Sparkles,
  Globe,
  ArrowRight,
  ArrowUp,
  Plus,
  Menu,
  Copy,
  RefreshCw,
  Paperclip,
  Mic,
  X,
  Check,
  ChevronDown,
  Search,
  BookOpen,
  Wrench,
  Brain,
  PenLine,
  ClipboardList,
  Zap,
  CheckCircle2,
  Square
} from "lucide-react";
import { cn } from "../utils/cn.js";
import ErrorBoundary from "./ErrorBoundary.jsx";
import AudioVisualizer from "./AudioVisualizer.jsx";

const allowedLinkProtocols = new Set(["http:", "https:", "mailto:", "tel:"]);

function sanitizeLinkUrl(url) {
  if (typeof url !== "string" || !url) return "";
  const trimmed = url.trim();
  if (trimmed.startsWith("#")) return trimmed;
  try {
    const parsed = new URL(trimmed, "https://local.invalid");
    if (allowedLinkProtocols.has(parsed.protocol)) return trimmed;
    return "";
  } catch (error) {
    return "";
  }
}

const markdownSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    a: [
      ...(defaultSchema.attributes?.a || []),
      ["target", "_blank"],
      ["rel", "noopener noreferrer"]
    ],
    code: [...(defaultSchema.attributes?.code || []), "className"],
    // Allow KaTeX elements and attributes
    span: [
      ...(defaultSchema.attributes?.span || []),
      "className",
      "style",
      "aria-hidden"
    ],
    annotation: ["encoding"],
    semantics: []
  },
  tagNames: [
    ...(defaultSchema.tagNames || []),
    "math",
    "annotation",
    "semantics",
    "mtext",
    "mn",
    "mo",
    "mi",
    "mspace",
    "mover",
    "munder",
    "munderover",
    "msup",
    "msub",
    "msubsup",
    "mfrac",
    "mroot",
    "msqrt",
    "mtable",
    "mtr",
    "mtd",
    "mlabeledtr",
    "mrow",
    "menclose",
    "mstyle",
    "mpadded",
    "mphantom"
  ]
};

function MarkdownContent({ content }) {
  const [copiedCode, setCopiedCode] = React.useState(null);

  const handleCopyCode = useCallback((code, index) => {
    navigator.clipboard?.writeText(code);
    setCopiedCode(index);
    setTimeout(() => setCopiedCode(null), 2000);
  }, []);

  const components = useMemo(() => ({
    a: (props) => (
      <a
        {...props}
        target="_blank"
        rel="noopener noreferrer"
        href={sanitizeLinkUrl(props.href)}
        className="text-white underline decoration-border hover:text-white/90 hover:decoration-muted-foreground/40 transition-colors"
      />
    ),
    pre: ({ children, ...props }) => {
      const codeContent = React.Children.toArray(children)
        .map(child => {
          if (React.isValidElement(child) && child.props?.children) {
            return typeof child.props.children === 'string'
              ? child.props.children
              : '';
          }
          return '';
        })
        .join('');
      // Stable ID from content to avoid re-render on every paint.
      const index = codeContent.split("").reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0).toString(36);

      return (
        <div className="relative group my-4 overflow-hidden">
          <pre
            {...props}
            className="bg-popover border border-border rounded-lg p-4 overflow-x-auto text-sm max-w-full"
          >
            {children}
          </pre>
          <button
            onClick={() => handleCopyCode(codeContent, index)}
            className="absolute top-2 right-2 p-1.5 rounded-md bg-foreground/10 hover:bg-foreground/20 text-muted-foreground hover:text-white opacity-0 group-hover:opacity-100 transition-all"
            aria-label="Copy code"
          >
            {copiedCode === index ? (
              <Check size={14} className="text-green-400" />
            ) : (
              <Copy size={14} />
            )}
          </button>
        </div>
      );
    },
    code: ({ inline, className, children, ...props }) => {
      if (inline) {
        return (
          <code
            className="px-1.5 py-0.5 rounded-md bg-foreground/10 text-white text-sm font-mono"
            {...props}
          >
            {children}
          </code>
        );
      }
      return (
        <code className={cn("text-white/90 font-mono text-sm", className)} {...props}>
          {children}
        </code>
      );
    },
    table: ({ children, ...props }) => (
      <div className="my-4 overflow-x-auto rounded-lg border border-border max-w-full">
        <table className="min-w-full divide-y divide-border" {...props}>
          {children}
        </table>
      </div>
    ),
    thead: ({ children, ...props }) => (
      <thead className="bg-foreground/5" {...props}>
        {children}
      </thead>
    ),
    th: ({ children, ...props }) => (
      <th
        className="px-3 py-2 md:px-4 md:py-3 text-left text-xs font-semibold text-white uppercase tracking-wider border-r border-border last:border-r-0"
        {...props}
      >
        {children}
      </th>
    ),
    td: ({ children, ...props }) => (
      <td
        className="px-3 py-2 md:px-4 md:py-3 text-sm text-white/80 border-r border-border last:border-r-0"
        {...props}
      >
        {children}
      </td>
    ),
    tr: ({ children, ...props }) => (
      <tr
        className="border-b border-border last:border-b-0 hover:bg-foreground/5 transition-colors"
        {...props}
      >
        {children}
      </tr>
    ),
    ul: ({ children, ...props }) => (
      <ul className="my-3 ml-1 space-y-2 list-none" {...props}>
        {children}
      </ul>
    ),
    ol: ({ children, ...props }) => (
      <ol className="my-3 ml-1 space-y-2 list-none counter-reset-item" {...props}>
        {children}
      </ol>
    ),
    li: ({ children, ordered, ...props }) => (
      <li className="relative pl-6 text-white/90" {...props}>
        <span className="absolute left-0 text-muted-foreground">*</span>
        {children}
      </li>
    ),
    h1: ({ children, ...props }) => (
      <h1 className="text-xl md:text-2xl font-bold text-white mt-6 mb-4 pb-2 border-b border-border" {...props}>
        {children}
      </h1>
    ),
    h2: ({ children, ...props }) => (
      <h2 className="text-lg md:text-xl font-semibold text-white mt-5 mb-3" {...props}>
        {children}
      </h2>
    ),
    h3: ({ children, ...props }) => (
      <h3 className="text-base md:text-lg font-semibold text-white mt-4 mb-2" {...props}>
        {children}
      </h3>
    ),
    p: ({ children, ...props }) => (
      <p className="my-[0.7em] text-white/90 leading-[1.65]" {...props}>
        {children}
      </p>
    ),
    strong: ({ children, ...props }) => (
      <strong className="font-bold text-white" {...props}>
        {children}
      </strong>
    ),
    em: ({ children, ...props }) => (
      <em className="italic text-white/90" {...props}>
        {children}
      </em>
    ),
    blockquote: ({ children, ...props }) => (
      <blockquote
        className="my-4 pl-4 border-l-4 border-border bg-foreground/5 py-2 pr-4 rounded-r-lg italic text-white/80"
        {...props}
      >
        {children}
      </blockquote>
    ),
    hr: (props) => (
      <hr className="my-6 border-t border-border" {...props} />
    )
  }), [copiedCode, handleCopyCode]);

  return (
    <div className="markdown-content prose prose-invert max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex, [rehypeSanitize, markdownSchema]]}
        transformLinkUri={sanitizeLinkUrl}
        transformImageUri={sanitizeLinkUrl}
        components={components}
      >
        {content || ""}
      </ReactMarkdown>
    </div>
  );
}

function extractSources(text) {
  const urls = Array.from(
    new Set(
      (text.match(/https?:\/\/[^\s)]+/g) || []).map((item) =>
        item.replace(/[.,)\]]$/, "")
      )
    )
  );
  return urls;
}

// Memoized Message Row Component
const MessageRow = React.memo(({
  msg,
  index,
  isLastAssistant,
  isStreaming,
  showSearching,
  onMessageChange,
  onSend,
  retryUserMessage
}) => {
  const sources = msg.content ? extractSources(msg.content) : [];
  const hasActivities = Array.isArray(msg.activities) && msg.activities.length > 0;
  const [copied, setCopied] = React.useState(false);

  // Only show phase animation for the LAST assistant message AND when streaming
  let phase = null;
  let activeToolName = null;
  const toolActivities = hasActivities
    ? msg.activities.filter(a => a.startsWith("tool:")).map(a => a.slice(5))
    : [];

  if (isStreaming && isLastAssistant && msg.role === "assistant") {
    if (toolActivities.length > 0) {
      phase = "tool";
      activeToolName = toolActivities[toolActivities.length - 1];
    } else if (!hasActivities) {
      phase = showSearching ? "searching" : "thinking";
    } else if (msg.activities.includes("reasoning")) {
      phase = "reasoning";
    } else if (msg.activities.includes("searching")) {
      phase = "searching";
    } else if (msg.activities.includes("reading")) {
      phase = "reading";
    } else if (msg.activities.includes("planning")) {
      phase = "planning";
    } else if (msg.activities.includes("executing")) {
      phase = "executing";
    } else if (msg.activities.includes("writing")) {
      phase = "writing";
    } else {
      phase = "thinking";
    }
  }

  const handleCopy = () => {
    navigator.clipboard?.writeText(msg.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "flex w-full group message-row",
        msg.role === "user" ? "justify-end" : "justify-start"
      )}
    >
      <div className={cn(
        "flex flex-col gap-2.5 min-w-0",
        msg.role === "user"
          ? "items-end max-w-[85%] md:max-w-[75%]"
          : "items-start w-full max-w-full"
      )}>
        <div className="font-semibold text-[13px] text-white/90 mb-0.5 px-0.5">
          {msg.role === "user" ? "You" : "Vector"}
        </div>

        {/* Activity panel: shows while streaming, persists for completed steps */}
        {msg.role === "assistant" && ((msg.agentSteps?.length > 0) || (msg.activities?.length > 0) || phase) && (
          <ActivityPanel
            steps={msg.agentSteps || []}
            activities={msg.activities || []}
            phase={phase}
            toolName={activeToolName}
            isStreaming={isStreaming && isLastAssistant}
          />
        )}

        <div className={cn("text-[15px] leading-[1.6] w-full", msg.role === "user" && "text-right")}>
          {msg.role === "assistant" ? (
            <div className="text-white/95">
              {isStreaming && isLastAssistant ? (
                <div className="streaming-plain-text">{msg.content}</div>
              ) : (
                <MarkdownContent content={msg.content} />
              )}
            </div>
          ) : (
            <div className="bg-[#2F2F2F] rounded-2xl px-4 py-3 text-white inline-block max-w-full break-words">
              {msg.content}
            </div>
          )}
          {isStreaming && isLastAssistant && msg.role === "assistant" && (
            <span className="inline-block w-1.5 h-5 bg-white/70 stream-caret ml-0.5 align-middle rounded-sm" />
          )}
        </div>

        {msg.role === "assistant" && msg.content && !isStreaming && (
          <div className="mt-2 w-full">
            {sources.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-2 mb-3 custom-scrollbar">
                {sources.map((item, idx) => (
                  <a
                    key={idx}
                    href={item}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg bg-[#2A2A2A] border border-border/40 text-xs text-muted-foreground hover:text-white hover:border-border/60 transition-all"
                  >
                    <Globe size={13} />
                    <span className="truncate max-w-[120px]">{new URL(item).hostname.replace('www.', '')}</span>
                  </a>
                ))}
              </div>
            )}

            <div className="flex items-center gap-1.5">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-white hover:bg-white/5 transition-all"
                aria-label={copied ? "Copied" : "Copy"}
              >
                {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                <span className="hidden sm:inline">{copied ? "Copied" : "Copy"}</span>
              </button>
              <button
                onClick={() => {
                  if (retryUserMessage) {
                    onMessageChange(retryUserMessage);
                    setTimeout(() => onSend(), 50);
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-white hover:bg-white/5 transition-all"
                aria-label="Retry"
              >
                <RefreshCw size={14} />
                <span className="hidden sm:inline">Retry</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}, (prev, next) =>
  prev.msg === next.msg &&
  prev.index === next.index &&
  prev.isLastAssistant === next.isLastAssistant &&
  prev.isStreaming === next.isStreaming &&
  prev.showSearching === next.showSearching &&
  prev.retryUserMessage === next.retryUserMessage
);

export default function ChatArea({
  activeSession,
  isStreaming,
  message,
  onMessageChange,
  onSend,
  onStop,
  onSelectFollowUp,
  activityLabels,
  toggleSidebar,
  sidebarOpen,
  features = { uploads: false, stt: false }
}) {
  const scrollRef = useRef(null);
  const messagesEndRef = useRef(null);
  const userScrolledRef = useRef(false);
  const lastScrollTopRef = useRef(0);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    let timeoutId = null;
    const onScroll = () => {
      el.classList.add("scrolling");
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => el.classList.remove("scrolling"), 150);

      // Detect if user manually scrolled up
      const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
      const scrolledUp = el.scrollTop < lastScrollTopRef.current;

      if (scrolledUp && !isAtBottom) {
        userScrolledRef.current = true;
      } else if (isAtBottom) {
        userScrolledRef.current = false;
      }

      lastScrollTopRef.current = el.scrollTop;
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  // Track streaming time for "Searching..." status
  const [showSearching, setShowSearching] = React.useState(false);
  const statusTimerRef = React.useRef(null);

  useEffect(() => {
    if (isStreaming) {
      setShowSearching(false);
      if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
      statusTimerRef.current = setTimeout(() => setShowSearching(true), 2000);
      return () => {
        if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
      };
    } else {
      setShowSearching(false);
    }
  }, [isStreaming]);

  // Smart auto-scroll: only scroll if user hasn't manually scrolled up
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    // Don't auto-scroll if user has scrolled up
    if (userScrolledRef.current) return;

    // Auto-scroll without smoothing during streaming; smooth only when idle.
    const scrollToBottom = () => {
      el.scrollTo({
        top: el.scrollHeight,
        behavior: isStreaming ? "auto" : "smooth"
      });
    };

    // Use requestAnimationFrame for smoother scrolling during streaming
    const rafId = requestAnimationFrame(scrollToBottom);

    return () => cancelAnimationFrame(rafId);
  }, [activeSession?.messages, isStreaming]);

  // Reset user scroll flag when new message starts
  useEffect(() => {
    if (isStreaming) {
      userScrolledRef.current = false;
    }
  }, [isStreaming]);

  const isEmpty = !activeSession?.messages || activeSession.messages.length === 0;
  const retryMessageByAssistantId = useMemo(() => {
    const map = new Map();
    const messages = activeSession?.messages || [];
    let lastUserMessage = "";
    for (const msg of messages) {
      if (msg.role === "user") {
        lastUserMessage = msg.content || "";
      } else if (msg.role === "assistant") {
        map.set(msg.id, lastUserMessage);
      }
    }
    return map;
  }, [activeSession?.messages]);

  return (
    <div className="flex-1 flex flex-col h-full relative bg-card">
      {/* Mobile Header */}
      <div className="md:hidden flex items-center p-3 border-b border-border/30 bg-card sticky top-0 z-10">
        <button
          onClick={toggleSidebar}
          className="p-2 -ml-2 text-muted-foreground hover:text-white focus-visible:outline-none rounded-lg"
          aria-label="Open sidebar"
        >
          <Menu size={20} />
        </button>
        <span className="font-semibold text-sm ml-2 text-white">
          Vector
        </span>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar bg-card" ref={scrollRef}>
        {isEmpty ? (
          /* Minimal hero (ChatGPT-style) */
          <div className="flex flex-col items-center justify-center min-h-[80vh] px-4">

            {/* Single clean fade-in without continuous animations */}
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="text-2xl md:text-[2.15rem] font-semibold text-center mb-8 md:mb-10 text-foreground tracking-tight"
            >
              What are you working on?
            </motion.h1>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.38, delay: 0.08, ease: "easeOut" }}
              className="w-full max-w-2xl px-2"
            >
              <SearchInput
                value={message}
                onChange={onMessageChange}
                onSend={onSend}
                onStop={onStop}
                disabled={isStreaming}
                isHero={true}
                features={features}
              />

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.22, duration: 0.3 }}
                className="mt-5 flex flex-wrap justify-center gap-2"
              >
                {[
                  "How does AI work?",
                  "Write a Python script",
                  "Latest tech news"
                ].map((suggestion, i) => (
                  <button
                    key={suggestion}
                    onClick={() => {
                      onMessageChange(suggestion);
                      setTimeout(() => onSend(), 100);
                    }}
                    className="px-3.5 py-1.5 rounded-full border border-border/60 bg-transparent text-xs text-muted-foreground hover:bg-foreground/5 hover:text-foreground hover:border-border transition-colors font-medium focus-visible:outline-none"
                  >
                    {suggestion}
                  </button>
                ))}
              </motion.div>
            </motion.div>
          </div>
        ) : (
          /* Chat Messages */
          <div className="mx-auto max-w-3xl w-full px-3 md:px-6 py-8 md:py-12 space-y-8 md:space-y-10">
            {activeSession?.messages.map((msg, index) => {
              const isLastAssistant =
                msg.role === "assistant" &&
                index === (activeSession?.messages?.length || 0) - 1;

              return (
                <ErrorBoundary key={msg.id || index} minimal>
                  <MessageRow
                    msg={msg}
                    index={index}
                    isLastAssistant={isLastAssistant}
                    isStreaming={isStreaming}
                    showSearching={showSearching}
                    retryUserMessage={retryMessageByAssistantId.get(msg.id) || ""}
                    onMessageChange={onMessageChange}
                    onSend={onSend}
                  />
                </ErrorBoundary>
              );
            })}

            <div ref={messagesEndRef} className="h-4" />
          </div>
        )}
      </div>

      {/* Footer Input Area */}
      {!isEmpty && (
        <div
          className="p-3 md:p-4 bg-card/80 backdrop-blur-sm z-20"
          style={{
            paddingBottom: 'max(12px, env(safe-area-inset-bottom, 12px))'
          }}
        >
          <div className="mx-auto max-w-xl">
            <SearchInput
              value={message}
              onChange={onMessageChange}
              onSend={onSend}
              onStop={onStop}
              disabled={isStreaming}
              features={features}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function SearchInput({ value, onChange, onSend, onStop, disabled, isHero = false, features = {} }) {
  const fileInputRef = React.useRef(null);
  const textareaRef = React.useRef(null);
  const textareaScrollTimeoutRef = React.useRef(null);
  const [isRecording, setIsRecording] = React.useState(false);
  const [selectedFiles, setSelectedFiles] = React.useState([]);
  const [audioStream, setAudioStream] = React.useState(null);
  const [interimTranscript, setInterimTranscript] = React.useState("");
  const recognitionRef = React.useRef(null);
  const isRecordingRef = React.useRef(false); // Ref to avoid stale closure in onend
  const finalTranscriptRef = React.useRef(""); // Ref to track accumulated transcript
  const maxTextareaHeight = isHero ? 100 : 120;
  const minTextareaHeight = 44;

  // Check for Speech Recognition support
  const SpeechRecognition = typeof window !== 'undefined'
    ? (window.SpeechRecognition || window.webkitSpeechRecognition)
    : null;

  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;

    el.style.height = "0px";
    const unclamped = el.scrollHeight;
    const next = Math.max(minTextareaHeight, Math.min(unclamped, maxTextareaHeight));
    el.style.height = `${next}px`;
    el.style.overflowY = unclamped > maxTextareaHeight ? "auto" : "hidden";
  }, [value, isHero, maxTextareaHeight, minTextareaHeight]);

  const handleSend = () => {
    if ((value.trim() || selectedFiles.length > 0) && !disabled) {
      onSend(selectedFiles);
      setSelectedFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTextareaScroll = (e) => {
    const el = e.currentTarget;
    el.classList.add("scrolling");
    if (textareaScrollTimeoutRef.current) clearTimeout(textareaScrollTimeoutRef.current);
    textareaScrollTimeoutRef.current = setTimeout(() => {
      el.classList.remove("scrolling");
    }, 150);
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setSelectedFiles(prev => [...prev, ...files]);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleMicClick = async () => {
    if (isRecording) {
      // Stop recording
      isRecordingRef.current = false;
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (audioStream) {
        audioStream.getTracks().forEach(track => track.stop());
        setAudioStream(null);
      }
      setIsRecording(false);
      setInterimTranscript("");
    } else {
      // Check browser support
      if (!SpeechRecognition) {
        console.error('Speech Recognition not supported in this browser');
        alert('Speech-to-text is not supported in this browser. Please use Chrome, Edge, or Safari.');
        return;
      }

      try {
        // Get audio stream for visualizer
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setAudioStream(stream);

        // Set up Speech Recognition
        const recognition = new SpeechRecognition();
        recognitionRef.current = recognition;

        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        // Use ref to track accumulated text (avoids stale closure issues)
        finalTranscriptRef.current = value;

        recognition.onresult = (event) => {
          let interim = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalTranscriptRef.current = (finalTranscriptRef.current ? finalTranscriptRef.current + ' ' : '') + transcript;
              onChange(finalTranscriptRef.current);
            } else {
              interim += transcript;
            }
          }
          setInterimTranscript(interim);
        };

        recognition.onerror = (event) => {
          console.error('Speech recognition error:', event.error);
          isRecordingRef.current = false;
          if (audioStream) {
            audioStream.getTracks().forEach(track => track.stop());
            setAudioStream(null);
          }
          setIsRecording(false);
          setInterimTranscript("");
        };

        recognition.onend = () => {
          // Restart if still in recording mode; use ref to get current value.
          if (recognitionRef.current && isRecordingRef.current) {
            try {
              recognitionRef.current.start();
            } catch (e) {
              // Ignore; may fail if already started.
            }
          }
        };

        recognition.start();
        isRecordingRef.current = true;
        setIsRecording(true);
      } catch (err) {
        console.error('Microphone access denied:', err);
      }
    }
  };

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) { }
      }
      if (audioStream) {
        audioStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [audioStream]);


  return (
    <div className="flex flex-col w-full">
      {/* File attachments preview */}
      {selectedFiles.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {selectedFiles.map((file, index) => (
            <div
              key={index}
              className="flex items-center gap-2 bg-[#3A3A3A] rounded-full px-3 py-1 text-xs text-white/80"
            >
              <span className="truncate max-w-[100px] md:max-w-[150px]">{file.name}</span>
              <button
                onClick={() => removeFile(index)}
                className="p-0.5 hover:bg-white/10 rounded-full"
                aria-label={`Remove ${file.name}`}
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Main floating input bar */}
      <div className="floating-input-bar">
        {/* Plus/Attach button */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          className="hidden"
          multiple
          accept="image/*,.pdf,.doc,.docx,.txt,.csv,.json"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          className={cn(
            "w-9 h-9 rounded-full flex items-center justify-center transition-colors shrink-0",
            disabled
              ? "text-muted-foreground/40 cursor-not-allowed"
              : "text-muted-foreground hover:text-white hover:bg-white/5"
          )}
          aria-label="Attach"
          title="Attach file"
        >
          <Plus size={20} strokeWidth={1.5} />
        </button>

        {/* Audio Visualizer or Text input */}
        {isRecording && audioStream ? (
          <div className="flex-1 flex flex-col items-center justify-center px-2 min-h-[44px]">
            <AudioVisualizer stream={audioStream} isActive={isRecording} />
            {/* Show interim transcript as user speaks */}
            {interimTranscript && (
              <div className="text-xs text-muted-foreground/70 italic mt-1 truncate max-w-full">
                {interimTranscript}...
              </div>
            )}
            {!interimTranscript && value && (
              <div className="text-xs text-green-400/70 mt-1 truncate max-w-full flex items-center gap-1">
                <Check size={10} className="shrink-0" /> "{value.slice(-50)}{value.length > 50 ? '...' : ''}"
              </div>
            )}
            {!interimTranscript && !value && (
              <div className="text-xs text-muted-foreground/50 mt-1">
                Listening... speak now
              </div>
            )}
            {/* Cancel and Done buttons */}
            <div className="flex items-center gap-3 mt-2">
              <button
                onClick={() => {
                  // Cancel: stop recording and clear text
                  isRecordingRef.current = false;
                  if (recognitionRef.current) {
                    recognitionRef.current.stop();
                    recognitionRef.current = null;
                  }
                  if (audioStream) {
                    audioStream.getTracks().forEach(track => track.stop());
                    setAudioStream(null);
                  }
                  setIsRecording(false);
                  setInterimTranscript("");
                  finalTranscriptRef.current = "";
                  onChange(""); // Clear transcribed text
                }}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-colors"
                aria-label="Cancel recording"
              >
                <X size={14} />
                <span>Cancel</span>
              </button>
              <button
                onClick={() => {
                  // Done: stop recording but keep the text
                  isRecordingRef.current = false;
                  // Save any pending interim transcript before stopping
                  if (interimTranscript) {
                    const updated = (finalTranscriptRef.current ? finalTranscriptRef.current + ' ' : '') + interimTranscript;
                    finalTranscriptRef.current = updated;
                    onChange(updated);
                  }
                  if (recognitionRef.current) {
                    recognitionRef.current.stop();
                    recognitionRef.current = null;
                  }
                  if (audioStream) {
                    audioStream.getTracks().forEach(track => track.stop());
                    setAudioStream(null);
                  }
                  setIsRecording(false);
                  setInterimTranscript("");
                  // Focus textarea after a brief delay
                  setTimeout(() => textareaRef.current?.focus(), 100);
                }}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium text-green-400 bg-green-500/10 hover:bg-green-500/20 transition-colors"
                aria-label="Done recording"
              >
                <Check size={14} />
                <span>Done</span>
              </button>
            </div>
          </div>
        ) : (
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onScroll={handleTextareaScroll}
            placeholder="Ask anything"
            aria-label="Ask anything"
            inputMode="text"
            autoComplete="off"
            autoCorrect="off"
            className="flex-1 bg-transparent border-none focus:ring-0 focus:outline-none text-white resize-none custom-scrollbar py-2.5 px-1 text-[15px] leading-6"
            rows={1}
            style={{ minHeight: `${minTextareaHeight}px`, maxHeight: `${maxTextareaHeight}px` }}
          />
        )}

        {/* Right side buttons */}
        <div className="flex items-center gap-0.5 shrink-0">
          {/* Mic button */}
          <button
            onClick={handleMicClick}
            disabled={disabled}
            className={cn(
              "w-9 h-9 rounded-full flex items-center justify-center transition-colors",
              isRecording
                ? "text-red-500 bg-red-500/10 animate-pulse"
                : disabled
                  ? "text-muted-foreground/40 cursor-not-allowed"
                  : "text-muted-foreground hover:text-white hover:bg-white/5"
            )}
            aria-label={isRecording ? "Stop recording" : "Voice input"}
            title={isRecording ? "Stop recording" : "Voice input"}
          >
            <Mic size={18} />
          </button>

          {/* Send / Stop button */}
          <motion.button
            onClick={disabled ? onStop : handleSend}
            disabled={!disabled && (!value.trim() && selectedFiles.length === 0)}
            whileHover={
              disabled
                ? { scale: 1.05 }
                : (value.trim() || selectedFiles.length > 0)
                  ? { scale: 1.08, boxShadow: "0 0 0 3px rgba(34,211,238,0.25), 0 0 14px rgba(34,211,238,0.15)" }
                  : {}
            }
            whileTap={{ scale: 0.92 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
            className={cn(
              "w-9 h-9 rounded-full flex items-center justify-center transition-colors",
              disabled
                ? "bg-foreground/10 text-foreground/70 hover:bg-foreground/15 cursor-pointer"
                : (value.trim() || selectedFiles.length > 0)
                  ? "bg-[#4A4A4A] text-white hover:bg-[#5A5A5A]"
                  : "bg-[#3A3A3A] text-muted-foreground/40 cursor-not-allowed"
            )}
            aria-label={disabled ? "Stop generation" : "Send"}
            title={disabled ? "Stop generation" : "Send message"}
          >
            {disabled ? (
              <Square size={14} fill="currentColor" />
            ) : (
              <ArrowUp size={18} strokeWidth={2} />
            )}
          </motion.button>
        </div>
      </div>
    </div>
  );
}


function ActionBtn({ icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:text-white hover:bg-foreground/5 transition-colors focus-visible:outline-none"
      aria-label={label}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}

/* Collapsible Activity Panel (Gemini/Perplexity-style) */
function ActivityPanel({ steps, activities, phase, toolName, isStreaming }) {
  const [expanded, setExpanded] = React.useState(false);

  const fallbackSteps = React.useMemo(() => {
    if (steps.length > 0) return steps;
    if (!Array.isArray(activities) || activities.length === 0) return [];

    const generated = [];
    const seen = new Set();
    for (const activity of activities) {
      if (!activity || activity === "thinking" || activity === "writing") continue;
      if (activity.startsWith("tool:")) {
        const tool = activity.slice(5) || "tool";
        const signature = `tool:${tool}`;
        if (seen.has(signature)) continue;
        seen.add(signature);
        generated.push({ type: "tool", tool });
        continue;
      }
      if (activity === "searching") {
        const signature = "search:fallback";
        if (seen.has(signature)) continue;
        seen.add(signature);
        generated.push({ type: "search", query: "web query" });
        continue;
      }
      if (activity === "reading") {
        const signature = "browse:fallback";
        if (seen.has(signature)) continue;
        seen.add(signature);
        generated.push({ type: "browse", url: "https://example.com" });
      }
    }
    return generated;
  }, [steps, activities]);

  const displaySteps = fallbackSteps;
  const searchCount = displaySteps.filter((s) => s.type === "search").length;
  const sourceCount = displaySteps
    .filter((s) => s.type === "sources")
    .reduce((count, s) => count + (s.items?.length || 0), 0);
  const browseCount = displaySteps.filter((s) => s.type === "browse").length;

  // Auto-expand when first step arrives during streaming.
  React.useEffect(() => {
    if (displaySteps.length === 1 && isStreaming) setExpanded(true);
  }, [displaySteps.length, isStreaming]);

  const summaryParts = [];
  if (searchCount > 0) summaryParts.push(`Searched ${searchCount} ${searchCount === 1 ? "query" : "queries"}`);
  if (sourceCount > 0) summaryParts.push(`Found ${sourceCount} ${sourceCount === 1 ? "source" : "sources"}`);
  if (browseCount > 0) summaryParts.push(`Read ${browseCount} ${browseCount === 1 ? "page" : "pages"}`);
  const summaryText = summaryParts.join(" · ") || "Working...";

  return (
    <div className="activity-panel mb-2 w-full max-w-[540px]">
      {/* Header / toggle */}
      <button
        onClick={() => setExpanded((prev) => !prev)}
        className="activity-panel-header"
        aria-expanded={expanded}
      >
        <span className="flex items-center gap-2 min-w-0">
          {isStreaming && phase ? (
            <span className="flex items-center gap-1">
              <span className="thinking-dot w-1 h-1 rounded-full bg-muted-foreground/80" style={{ animationDelay: "0ms" }} />
              <span className="thinking-dot w-1 h-1 rounded-full bg-muted-foreground/80" style={{ animationDelay: "140ms" }} />
              <span className="thinking-dot w-1 h-1 rounded-full bg-muted-foreground/80" style={{ animationDelay: "280ms" }} />
            </span>
          ) : (
            <CheckCircle2 size={12} className="text-green-400 shrink-0" />
          )}
          <span className="truncate">{summaryText}</span>
        </span>
        <ChevronDown
          size={14}
          className={cn(
            "shrink-0 transition-transform duration-200",
            expanded ? "rotate-180" : ""
          )}
        />
      </button>

      {/* Expanded step list */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="activity-panel-body">
              {displaySteps.map((step, i) => (
                <ActivityStepRow key={i} step={step} />
              ))}
              {isStreaming && phase && (
                <div className="activity-step-row">
                  <span className="activity-step-icon">
                    {phase === "searching" ? <Search size={12} /> : phase === "reading" ? <BookOpen size={12} /> : phase === "tool" ? <Wrench size={12} /> : <Brain size={12} />}
                  </span>
                  <span className="text-muted-foreground/70 italic">
                    {phase === "searching" ? "Searching..." : phase === "reading" ? "Reading..." : phase === "tool" ? `Using ${toolName || "tool"}...` : "Thinking..."}
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ActivityStepRow({ step }) {
  if (step.type === "search") {
    return (
      <div className="activity-step-row">
        <span className="activity-step-icon"><Search size={12} /></span>
        <span>Searched: <span className="text-foreground/80 font-medium">"{step.query}"</span></span>
      </div>
    );
  }
  if (step.type === "browse") {
    let displayUrl = step.url;
    try { displayUrl = new URL(step.url).hostname; } catch { }
    return (
      <div className="activity-step-row">
        <span className="activity-step-icon"><Globe size={12} /></span>
        <span>Reading: <a href={step.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{displayUrl}</a></span>
      </div>
    );
  }
  if (step.type === "sources") {
    return (
      <div className="activity-step-sources">
        {step.items?.map((src, j) => {
          let domain = src.url;
          try { domain = new URL(src.url).hostname.replace("www.", ""); } catch { }
          return (
            <a
              key={j}
              href={src.url}
              target="_blank"
              rel="noopener noreferrer"
              className="activity-source-chip"
              title={src.title}
            >
              <img
                src={`https://www.google.com/s2/favicons?domain=${domain}&sz=16`}
                alt=""
                className="w-3.5 h-3.5 rounded-sm"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
              <span className="truncate">{src.title || domain}</span>
            </a>
          );
        })}
      </div>
    );
  }
  if (step.type === "tool") {
    return (
      <div className="activity-step-row">
        <span className="activity-step-icon"><Wrench size={12} /></span>
        <span>Used tool: <span className="font-medium">{step.tool}</span></span>
      </div>
    );
  }
  return null;
}

function StreamingStatus({ phase, toolName }) {
  const config = {
    thinking: { icon: <Brain size={11} />, label: "Thinking" },
    searching: { icon: <Search size={11} />, label: "Searching" },
    reasoning: { icon: <Brain size={11} />, label: "Analyzing" },
    tool: { icon: <Wrench size={11} />, label: toolName ? `Using ${toolName}` : "Using tool" },
    reading: { icon: <BookOpen size={11} />, label: "Reading sources" },
    writing: { icon: <PenLine size={11} />, label: "Writing" },
    planning: { icon: <ClipboardList size={11} />, label: "Planning" },
    executing: { icon: <Zap size={11} />, label: "Executing" },
  };
  const { icon, label } = config[phase] || config.thinking;

  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-border bg-foreground/5 px-3 py-1.5 text-[12px] font-medium text-muted-foreground">
      <span className="flex items-center gap-1">
        <span className="thinking-dot w-1 h-1 rounded-full bg-muted-foreground/80" style={{ animationDelay: "0ms" }} />
        <span className="thinking-dot w-1 h-1 rounded-full bg-muted-foreground/80" style={{ animationDelay: "140ms" }} />
        <span className="thinking-dot w-1 h-1 rounded-full bg-muted-foreground/80" style={{ animationDelay: "280ms" }} />
      </span>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={label}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="inline-flex items-center gap-1.5"
        >
          <span className="flex items-center">{icon}</span>
          {label}...
        </motion.span>
      </AnimatePresence>
    </div>
  );
}

