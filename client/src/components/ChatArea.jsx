import React, { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import { motion, AnimatePresence } from "framer-motion";
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
  Check
} from "lucide-react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

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
    code: [...(defaultSchema.attributes?.code || []), "className"]
  }
};

function MarkdownContent({ content }) {
  const [copiedCode, setCopiedCode] = React.useState(null);

  const handleCopyCode = (code, index) => {
    navigator.clipboard?.writeText(code);
    setCopiedCode(index);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <div className="markdown-content prose prose-invert max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeSanitize, markdownSchema]]}
        transformLinkUri={sanitizeLinkUrl}
        transformImageUri={sanitizeLinkUrl}
        components={{
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
            const index = Math.random().toString(36).substr(2, 9);

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
              <span className="absolute left-0 text-muted-foreground">•</span>
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
        }}
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
  activityLabels,
  onMessageChange,
  onSend,
  activeSession,
  onCopy
}) => {
  const sources = msg.content ? extractSources(msg.content) : [];
  const hasActivities = Array.isArray(msg.activities) && msg.activities.length > 0;
  const [copied, setCopied] = React.useState(false);

  // Only show phase animation for the LAST assistant message AND when streaming
  let phase = null;
  if (isStreaming && isLastAssistant && msg.role === "assistant") {
    if (!hasActivities) {
      phase = showSearching ? "searching" : "thinking";
    } else if (msg.activities.includes("reasoning")) {
      phase = "reasoning";
    } else if (msg.activities.includes("searching")) {
      phase = "searching";
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
        "flex w-full group",
        msg.role === "user" ? "justify-end" : "justify-start"
      )}
    >
      <div className={cn(
        "flex flex-col gap-2.5 min-w-0",
        msg.role === "user"
          ? "items-end max-w-[85%] md:max-w-[75%]"
          : "items-start max-w-full"
      )}>
        <div className="font-semibold text-[13px] text-white/90 mb-0.5 px-0.5">
          {msg.role === "user" ? "You" : "Vector"}
        </div>

        {phase && (
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <StreamingStatus phase={phase} />
            {hasActivities && msg.activities
              .filter(a => a !== 'writing')
              .slice(-4).map((state) => (
                <span
                  key={state}
                  className="inline-flex items-center rounded-full border border-border bg-foreground/5 px-2.5 py-1 text-[11px] font-medium text-muted-foreground"
                >
                  {activityLabels?.[state] || state}
                </span>
              ))}
          </div>
        )}

        <div className={cn("text-[15px] leading-[1.6] w-full", msg.role === "user" && "text-right")}>
          {msg.role === "assistant" ? (
            <div className="text-white/95">
              <MarkdownContent content={msg.content} />
            </div>
          ) : (
            <div className="bg-[#2F2F2F] rounded-2xl px-4 py-3 text-white inline-block max-w-full break-words">
              {msg.content}
            </div>
          )}
          {isStreaming && isLastAssistant && msg.role === "assistant" && (
            <span className="inline-block w-1.5 h-5 bg-white/70 animate-pulse ml-0.5 align-middle rounded-sm" />
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

            <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
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
                  const lastUserMsg = [...(activeSession?.messages || [])]
                    .slice(0, index)
                    .reverse()
                    .find(m => m.role === "user");
                  if (lastUserMsg) {
                    onMessageChange(lastUserMsg.content);
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
});

export default function ChatArea({
  activeSession,
  isStreaming,
  message,
  onMessageChange,
  onSend,
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

    // Smooth scroll to bottom
    const scrollToBottom = () => {
      el.scrollTo({
        top: el.scrollHeight,
        behavior: 'smooth'
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
          /* Empty State / Hero Section */
          <div className="flex flex-col items-center justify-center min-h-[80vh] px-4">
            <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-foreground/5 border border-border flex items-center justify-center mb-6">
              <Sparkles className="text-muted-foreground w-7 h-7 md:w-8 md:h-8" />
            </div>
            <h1 className="text-2xl md:text-4xl font-display font-medium text-center mb-8 md:mb-12 text-white">
              Where knowledge begins
            </h1>

            <div className="w-full max-w-xl px-4">
              <SearchInput
                value={message}
                onChange={onMessageChange}
                onSend={onSend}
                disabled={isStreaming}
                isHero={true}
                features={features}
              />

              <div className="mt-6 md:mt-8 flex flex-wrap justify-center gap-2">
                {[
                  "How does AI work?",
                  "Write a Python script",
                  "Latest tech news"
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => {
                      onMessageChange(suggestion);
                      setTimeout(() => onSend(), 100);
                    }}
                    className="px-3 py-2 md:px-4 rounded-full border border-border bg-foreground/5 text-xs md:text-sm text-muted-foreground hover:bg-foreground/8 hover:text-white transition-colors font-medium focus-visible:outline-none"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Chat Messages */
          <div className="mx-auto max-w-3xl w-full px-3 md:px-6 py-8 md:py-12 space-y-8 md:space-y-10">
            {activeSession?.messages.map((msg, index) => {
              const isLastAssistant =
                msg.role === "assistant" &&
                index === (activeSession?.messages?.length || 0) - 1;

              return (
                <MessageRow
                  key={msg.id || index}
                  msg={msg}
                  index={index}
                  isLastAssistant={isLastAssistant}
                  isStreaming={isStreaming}
                  showSearching={showSearching}
                  activityLabels={activityLabels}
                  activeSession={activeSession}
                  onMessageChange={onMessageChange}
                  onSend={onSend}
                />
              );
            })}

            <div ref={messagesEndRef} className="h-4" />
          </div>
        )}
      </div>

      {/* Footer Input Area */}
      {!isEmpty && (
        <div className="p-3 md:p-4 bg-card/80 backdrop-blur-sm z-20">
          <div className="mx-auto max-w-xl">
            <SearchInput
              value={message}
              onChange={onMessageChange}
              onSend={onSend}
              disabled={isStreaming}
              features={features}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function SearchInput({ value, onChange, onSend, disabled, isHero = false, features = {} }) {
  const fileInputRef = React.useRef(null);
  const textareaRef = React.useRef(null);
  const textareaScrollTimeoutRef = React.useRef(null);
  const [isRecording, setIsRecording] = React.useState(false);
  const [selectedFiles, setSelectedFiles] = React.useState([]);
  const mediaRecorderRef = React.useRef(null);
  const audioChunksRef = React.useRef([]);
  const maxTextareaHeight = isHero ? 100 : 120;
  const minTextareaHeight = 44;

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
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const audioFile = new File([audioBlob], 'voice-recording.webm', { type: 'audio/webm' });
          setSelectedFiles(prev => [...prev, audioFile]);
          stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start();
        setIsRecording(true);
      } catch (err) {
        console.error('Microphone access denied:', err);
      }
    }
  };

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

        {/* Text input */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onScroll={handleTextareaScroll}
          placeholder="Ask anything"
          aria-label="Ask anything"
          className="flex-1 bg-transparent border-none focus:ring-0 focus:outline-none text-white resize-none custom-scrollbar py-2.5 px-1 text-[15px] leading-6"
          rows={1}
          style={{ minHeight: `${minTextareaHeight}px`, maxHeight: `${maxTextareaHeight}px` }}
        />

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

          {/* Send button */}
          <button
            onClick={handleSend}
            disabled={(!value.trim() && selectedFiles.length === 0) || disabled}
            className={cn(
              "w-9 h-9 rounded-full flex items-center justify-center transition-colors",
              (value.trim() || selectedFiles.length > 0) && !disabled
                ? "bg-[#4A4A4A] text-white hover:bg-[#5A5A5A]"
                : "bg-[#3A3A3A] text-muted-foreground/40 cursor-not-allowed"
            )}
            aria-label="Send"
            title="Send message"
          >
            {disabled ? (
              <div className="w-4 h-4 border-2 border-muted-foreground/20 border-t-muted-foreground/60 rounded-full animate-spin" />
            ) : (
              <ArrowUp size={18} strokeWidth={2} />
            )}
          </button>
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

function StreamingStatus({ phase }) {
  let label = "Thinking";
  if (phase === "searching") {
    label = "Searching";
  } else if (phase === "reasoning") {
    label = "Analyzing";
  }

  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-border bg-foreground/5 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
      <span className="flex items-center gap-1">
        <span className="thinking-dot w-1 h-1 rounded-full bg-muted-foreground/80" style={{ animationDelay: "0ms" }} />
        <span className="thinking-dot w-1 h-1 rounded-full bg-muted-foreground/80" style={{ animationDelay: "140ms" }} />
        <span className="thinking-dot w-1 h-1 rounded-full bg-muted-foreground/80" style={{ animationDelay: "280ms" }} />
      </span>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={label}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
        >
          {label}…
        </motion.span>
      </AnimatePresence>
    </div>
  );
}
