import React, { useEffect, useMemo, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import { motion, AnimatePresence } from "framer-motion";
import {
  SendHorizontal,
  Sparkles,
  Globe,
  ArrowRight,
  Menu,
  Copy,
  ThumbsUp,
  ThumbsDown,
  RefreshCw,
  Paperclip,
  Mic,
  X
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
          // Enhanced link rendering
          a: (props) => (
            <a
              {...props}
              target="_blank"
              rel="noopener noreferrer"
              href={sanitizeLinkUrl(props.href)}
              className="text-cyan-400 hover:text-cyan-300 underline decoration-cyan-400/30 hover:decoration-cyan-400 transition-colors"
            />
          ),
          // Enhanced code block with copy button
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
              <div className="relative group my-4">
                <pre
                  {...props}
                  className="bg-zinc-900/50 border border-border rounded-lg p-4 overflow-x-auto text-sm"
                >
                  {children}
                </pre>
                <button
                  onClick={() => handleCopyCode(codeContent, index)}
                  className="absolute top-2 right-2 p-1.5 rounded-md bg-foreground/10 hover:bg-foreground/20 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-all"
                  aria-label="Copy code"
                >
                  {copiedCode === index ? (
                    <span className="text-xs text-green-400">Copied!</span>
                  ) : (
                    <Copy size={14} />
                  )}
                </button>
              </div>
            );
          },
          // Inline code styling
          code: ({ inline, className, children, ...props }) => {
            if (inline) {
              return (
                <code
                  className="px-1.5 py-0.5 rounded-md bg-foreground/10 text-cyan-300 text-sm font-mono"
                  {...props}
                >
                  {children}
                </code>
              );
            }
            return (
              <code className={cn("text-foreground/90 font-mono text-sm", className)} {...props}>
                {children}
              </code>
            );
          },
          // Enhanced table styling
          table: ({ children, ...props }) => (
            <div className="my-4 overflow-x-auto rounded-lg border border-border">
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
              className="px-4 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider border-r border-border last:border-r-0"
              {...props}
            >
              {children}
            </th>
          ),
          td: ({ children, ...props }) => (
            <td
              className="px-4 py-3 text-sm text-foreground/80 border-r border-border last:border-r-0"
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
          // Enhanced list styling
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
            <li
              className="relative pl-6 text-foreground/90 before:absolute before:left-0 before:text-cyan-400 before:font-medium"
              style={{
                '--bullet': ordered ? 'counter(item) "."' : '"•"'
              }}
              {...props}
            >
              <span className="absolute left-0 text-cyan-400">•</span>
              {children}
            </li>
          ),
          // Enhanced heading styling
          h1: ({ children, ...props }) => (
            <h1 className="text-2xl font-bold text-foreground mt-6 mb-4 pb-2 border-b border-border" {...props}>
              {children}
            </h1>
          ),
          h2: ({ children, ...props }) => (
            <h2 className="text-xl font-semibold text-foreground mt-5 mb-3" {...props}>
              {children}
            </h2>
          ),
          h3: ({ children, ...props }) => (
            <h3 className="text-lg font-semibold text-foreground mt-4 mb-2" {...props}>
              {children}
            </h3>
          ),
          // Paragraph styling
          p: ({ children, ...props }) => (
            <p className="my-3 text-foreground/90 leading-relaxed" {...props}>
              {children}
            </p>
          ),
          // Bold and italic
          strong: ({ children, ...props }) => (
            <strong className="font-bold text-foreground" {...props}>
              {children}
            </strong>
          ),
          em: ({ children, ...props }) => (
            <em className="italic text-foreground/90" {...props}>
              {children}
            </em>
          ),
          // Blockquote styling
          blockquote: ({ children, ...props }) => (
            <blockquote
              className="my-4 pl-4 border-l-4 border-cyan-500 bg-cyan-500/5 py-2 pr-4 rounded-r-lg italic text-foreground/80"
              {...props}
            >
              {children}
            </blockquote>
          ),
          // Horizontal rule
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

function suggestFollowUps(prompt) {
  if (!prompt) return [];
  const base = prompt.split("?")[0].trim();
  // Simple heuristic for demo purposes
  return [
    `Tell me more about ${base.split(' ').slice(-3).join(' ')}`,
    `What are the alternatives?`,
    `Explain it like I'm 5`
  ];
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
  activeSession
}) => {
  const sources = msg.content ? extractSources(msg.content) : [];
  const hasActivities = Array.isArray(msg.activities) && msg.activities.length > 0;

  // Determine phase for streaming messages
  let phase = null;
  if (isStreaming && isLastAssistant && msg.role === "assistant") {
    // Show "thinking" immediately as the default starting state
    if (!hasActivities) {
      phase = showSearching ? "searching" : "thinking";
    } else if (msg.activities.includes("reasoning")) {
      phase = "reasoning";
    } else if (msg.activities.includes("searching")) {
      phase = "searching";
    } else {
      // Fallback to thinking if activities are present but none matches above
      phase = "thinking";
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        "flex gap-3 md:gap-4",
        msg.role === "user" ? "flex-row-reverse" : "flex-row"
      )}
    >
      {/* Avatar */}
      <div className={cn(
        "w-8 h-8 rounded-full flex items-center justify-center shrink-0 border",
        msg.role === "user"
          ? "bg-foreground/5 border-border text-foreground"
          : "bg-cyan-500/10 border-cyan-500/20 text-cyan-600"
      )}>
        {msg.role === "user" ? <div className="text-xs font-bold">You</div> : <Sparkles size={16} />}
      </div>

      {/* Message Content */}
      <div className={cn(
        "flex flex-col gap-2 max-w-[88%] md:max-w-[85%]",
        msg.role === "user" ? "items-end" : "items-start"
      )}>
        <div className="font-medium text-sm text-muted-foreground mb-1">
          {msg.role === "user" ? "You" : "Vector"}
        </div>

        {/* Status at TOP of message (Only visible during streaming) */}
        {phase && (
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <StreamingStatus phase={phase} />
            {hasActivities && msg.activities
              .filter(a => a !== 'writing')
              .slice(-4).map((state) => (
                <span
                  key={state}
                  className="inline-flex items-center rounded-full border border-border bg-foreground/5 px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                >
                  {activityLabels?.[state] || state}
                </span>
              ))}
          </div>
        )}

        <div className={cn(
          "text-base leading-relaxed text-foreground", // Removed fade-in-text to fix blinking
          msg.role === "user" && "text-right"
        )}>
          {msg.role === "assistant" ? (
            <MarkdownContent content={msg.content} />
          ) : (
            msg.content
          )}
          {isStreaming && isLastAssistant && (
            <span className="inline-block w-2 h-4 bg-cyan-400 animate-pulse ml-1 align-bottom rounded-sm" />
          )}
        </div>

        {/* Assistant Extras: Sources, Related */}
        {msg.role === "assistant" && msg.content && !isStreaming && (
          <div className="mt-4 space-y-4 w-full">
            {/* Sources */}
            {sources.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0 custom-scrollbar">
                {sources.map((item, idx) => (
                  <a
                    key={idx}
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-shrink-0 flex flex-col justify-between w-32 h-20 p-2 rounded-lg border border-border bg-foreground/5 hover:bg-foreground/10 hover:border-cyan-500/30 transition-all text-xs group"
                  >
                    <div className="font-medium truncate text-foreground/90 group-hover:text-cyan-500 transition-colors">
                      {item.title}
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground/70">
                      <Globe size={10} />
                      <span className="truncate">{new URL(item.url).hostname.replace('www.', '')}</span>
                    </div>
                  </a>
                ))}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-2 pt-2 border-t border-border/50">
              <ActionBtn
                icon={<Copy size={14} />}
                label="Copy"
                onClick={() => navigator.clipboard.writeText(msg.content)}
              />
              <ActionBtn
                icon={<RefreshCw size={14} />}
                label="Regenerate"
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
              />
              <div className="flex-1" />
              <ActionBtn icon={<ThumbsUp size={14} />} label="Like" />
              <ActionBtn icon={<ThumbsDown size={14} />} label="Dislike" />
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

  // Track streaming time for "Searching..." status
  const [streamStartTime, setStreamStartTime] = React.useState(null);
  const [showSearching, setShowSearching] = React.useState(false);

  useEffect(() => {
    if (isStreaming) {
      setStreamStartTime(Date.now());
      const timer = setInterval(() => {
        if (Date.now() - streamStartTime > 4000) {
          setShowSearching(true);
        }
      }, 1000);
      return () => clearInterval(timer);
    } else {
      setStreamStartTime(null);
      setShowSearching(false);
    }
  }, [isStreaming]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeSession?.messages?.length, isStreaming, showSearching]);

  const followUps = useMemo(() => {
    const lastUserMsg = activeSession?.messages
      .filter((entry) => entry.role === "user")
      .pop();

    return suggestFollowUps(lastUserMsg?.content || "");
  }, [activeSession?.messages]);

  const isEmpty = !activeSession?.messages || activeSession.messages.length === 0;

  return (
    <div className="flex-1 flex flex-col h-full relative">
      {/* Mobile Header */}
      <div className="md:hidden flex items-center p-4 border-b border-border bg-background sticky top-0 z-10">
        <button
          onClick={toggleSidebar}
          className="p-2 -ml-2 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 rounded-lg"
          aria-label="Open sidebar"
        >
          <Menu size={20} />
        </button>
        <span className="font-semibold text-sm ml-2 text-foreground">
          Vector
        </span>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar scroll-smooth" ref={scrollRef}>
        {isEmpty ? (
          /* Empty State / Hero Section */
          <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 animate-in fade-in zoom-in duration-500">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center mb-6 shadow-xl shadow-cyan-500/20">
              <Sparkles className="text-white w-8 h-8" />
            </div>
            <h1 className="text-3xl md:text-4xl font-display font-medium text-center mb-12 text-foreground">
              Where knowledge begins
            </h1>

            {/* Fake search bar for hero aesthetic - functionality is in the footer input though */}
            <div className="w-full max-w-2xl transform transition-all hover:scale-[1.01]">
              <div className="relative group">
                <div className="relative bg-zinc-800/80 border border-border rounded-2xl p-4 flex items-center gap-4 shadow-2xl">
                  <SearchInput
                    value={message}
                    onChange={onMessageChange}
                    onSend={onSend}
                    disabled={isStreaming}
                    isHero={true}
                    features={features}
                  />
                </div>
              </div>

              <div className="mt-8 flex flex-wrap justify-center gap-2">
                {[
                  "How does AI work?",
                  "Write a Python script",
                  "Latest tech news",
                  "Explain quantum physics"
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => {
                      onMessageChange(suggestion);
                      setTimeout(() => onSend(), 100);
                    }}
                    className="px-4 py-2 rounded-full border border-border bg-foreground/5 text-sm text-muted-foreground hover:bg-foreground/8 hover:text-cyan-600 hover:border-cyan-500/30 transition-all font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Chat Messages */
          <div className="mx-auto max-w-3xl w-full px-4 md:px-0 py-8 space-y-8">
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

            {/* Follow-ups */}
            {!isStreaming && followUps.length > 0 && (
              <div className="pl-12 space-y-3 animate-in fade-in duration-500">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Sparkles size={14} className="text-cyan-600" />
                  <span>Related</span>
                </div>
                <div className="flex flex-col gap-2 w-full">
                  {followUps.map((item, i) => (
                    <button
                      key={i}
                      onClick={() => onSelectFollowUp(item)}
                      className="text-left flex items-center justify-between p-3 rounded-lg border border-border bg-foreground/5 hover:bg-foreground/8 hover:border-cyan-500/30 transition-all group w-full md:w-fit md:min-w-[300px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                    >
                      <span className="text-sm text-foreground/90 group-hover:text-foreground">{item}</span>
                      <ArrowRight size={14} className="text-muted-foreground opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} className="h-4" />
          </div>
        )}
      </div>

      {/* Footer Input Area */}
      {!isEmpty && (
        <div className="p-4 md:p-6 bg-background z-20">
          <div className="mx-auto max-w-3xl relative">
            <div className="relative bg-zinc-800/80 border border-border rounded-2xl p-2 shadow-2xl flex items-center gap-2">
              <SearchInput
                value={message}
                onChange={onMessageChange}
                onSend={onSend}
                disabled={isStreaming}
                features={features}
              />
            </div>
            <p className="text-center text-xs text-muted-foreground/70 mt-3">
              Powered by AR-47
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function SearchInput({ value, onChange, onSend, disabled, isHero = false, features = {} }) {
  const fileInputRef = React.useRef(null);
  const [isRecording, setIsRecording] = React.useState(false);
  const [selectedFiles, setSelectedFiles] = React.useState([]);
  const mediaRecorderRef = React.useRef(null);
  const audioChunksRef = React.useRef([]);

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

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setSelectedFiles(prev => [...prev, ...files]);
    }
    // Reset input so same file can be selected again
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
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
    } else {
      // Start recording
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
        alert('Microphone access was denied. Please enable it in your browser settings.');
      }
    }
  };

  return (
    <div className="flex flex-col w-full gap-2">
      {/* Selected files preview */}
      {selectedFiles.length > 0 && (
        <div className="flex flex-wrap gap-2 px-3 pt-2">
          {selectedFiles.map((file, index) => (
            <div
              key={index}
              className="flex items-center gap-2 bg-foreground/10 rounded-lg px-2 py-1 text-xs text-foreground/80"
            >
              <span className="truncate max-w-[150px]">{file.name}</span>
              <button
                onClick={() => removeFile(index)}
                className="p-0.5 hover:bg-foreground/10 rounded"
                aria-label={`Remove ${file.name}`}
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center w-full">
        {/* File upload button */}
        {features.uploads && (
          <>
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
                "p-2 rounded-xl transition-all duration-200 flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ml-1",
                disabled
                  ? "text-muted-foreground/50 cursor-not-allowed"
                  : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
              )}
              aria-label="Attach file"
              title="Attach file"
            >
              <Paperclip size={18} />
            </button>
          </>
        )}

        {/* Speech-to-text button */}
        {features.stt && (
          <button
            onClick={handleMicClick}
            disabled={disabled}
            className={cn(
              "p-2 rounded-xl transition-all duration-200 flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              isRecording
                ? "text-red-500 bg-red-500/10 animate-pulse"
                : disabled
                  ? "text-muted-foreground/50 cursor-not-allowed"
                  : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
            )}
            aria-label={isRecording ? "Stop recording" : "Start voice input"}
            title={isRecording ? "Stop recording" : "Voice input"}
          >
            <Mic size={18} />
          </button>
        )}

        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isHero ? "Ask anything..." : "Ask follow-up..."}
          aria-label={isHero ? "Ask anything" : "Message"}
          className={cn(
            "flex-1 bg-transparent border-none focus:ring-0 text-foreground placeholder:text-muted-foreground resize-none py-3 px-3 custom-scrollbar",
            isHero ? "text-lg md:text-xl font-medium" : "text-sm md:text-base"
          )}
          rows={isHero ? 1 : 1}
          style={{ minHeight: isHero ? '52px' : '44px' }}
        />
        <div className="flex items-center gap-2 pr-2">
          <button
            onClick={handleSend}
            disabled={(!value.trim() && selectedFiles.length === 0) || disabled}
            className={cn(
              "p-2 rounded-xl transition-all duration-200 flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              value.trim() && !disabled
                ? "bg-cyan-500 text-white shadow-lg shadow-cyan-500/30 hover:bg-cyan-400"
                : "bg-foreground/5 text-muted-foreground cursor-not-allowed"
            )}
          >
            {disabled ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <ArrowRight size={20} />
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
      className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      aria-label={label}
    >
      {icon}
      {label && <span>{label}</span>}
    </button>
  )
}

function StreamingStatus({ phase }) {
  let label = "Thinking";
  let dotColor = "bg-cyan-400";
  if (phase === "searching") {
    label = "Searching";
    dotColor = "bg-emerald-400";
  } else if (phase === "reasoning") {
    label = "Reasoning";
    dotColor = "bg-amber-400";
  }

  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-border bg-foreground/5 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
      <span className={`flex w-1.5 h-1.5 rounded-full ${dotColor} animate-pulse`} />
      <span>{label}…</span>
    </div>
  );
}
