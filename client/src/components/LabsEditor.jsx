import React, { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import { motion, AnimatePresence } from "framer-motion";
import "katex/dist/katex.min.css";
import {
    Eye,
    Edit3,
    Copy,
    Check,
    Sparkles,
    X,
    Loader2,
    Send,
    Bold,
    Italic,
    Heading1,
    Heading2,
    List,
    ListOrdered,
    Code,
    Link,
    Quote,
    Undo2,
    Redo2
} from "lucide-react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs) {
    return twMerge(clsx(inputs));
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

/**
 * Rich Text Formatting Toolbar
 */
function FormattingToolbar({ onFormat, disabled }) {
    const tools = [
        { icon: Bold, action: "bold", title: "Bold (Ctrl+B)", syntax: ["**", "**"] },
        { icon: Italic, action: "italic", title: "Italic (Ctrl+I)", syntax: ["*", "*"] },
        { icon: Heading1, action: "h1", title: "Heading 1", syntax: ["# ", ""] },
        { icon: Heading2, action: "h2", title: "Heading 2", syntax: ["## ", ""] },
        { icon: List, action: "ul", title: "Bullet List", syntax: ["- ", ""] },
        { icon: ListOrdered, action: "ol", title: "Numbered List", syntax: ["1. ", ""] },
        { icon: Code, action: "code", title: "Inline Code", syntax: ["`", "`"] },
        { icon: Link, action: "link", title: "Link", syntax: ["[", "](url)"] },
        { icon: Quote, action: "quote", title: "Blockquote", syntax: ["> ", ""] },
    ];

    return (
        <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-border bg-background/30">
            {tools.map(({ icon: Icon, action, title, syntax }) => (
                <button
                    key={action}
                    onClick={() => onFormat(syntax[0], syntax[1])}
                    disabled={disabled}
                    className={cn(
                        "p-1.5 rounded-md text-muted-foreground transition-colors",
                        disabled
                            ? "opacity-40 cursor-not-allowed"
                            : "hover:text-white hover:bg-foreground/10"
                    )}
                    title={title}
                >
                    <Icon size={16} />
                </button>
            ))}
        </div>
    );
}

/**
 * Undo/Redo Controls
 */
function HistoryControls({ canUndo, canRedo, onUndo, onRedo, historyCount }) {
    return (
        <div className="flex items-center gap-1">
            <button
                onClick={onUndo}
                disabled={!canUndo}
                className={cn(
                    "p-1.5 rounded-md transition-colors flex items-center gap-1",
                    canUndo
                        ? "text-muted-foreground hover:text-white hover:bg-foreground/10"
                        : "text-muted-foreground/30 cursor-not-allowed"
                )}
                title="Undo"
            >
                <Undo2 size={14} />
            </button>
            <button
                onClick={onRedo}
                disabled={!canRedo}
                className={cn(
                    "p-1.5 rounded-md transition-colors",
                    canRedo
                        ? "text-muted-foreground hover:text-white hover:bg-foreground/10"
                        : "text-muted-foreground/30 cursor-not-allowed"
                )}
                title="Redo"
            >
                <Redo2 size={14} />
            </button>
            {historyCount > 0 && (
                <span className="text-xs text-muted-foreground/50 ml-1">
                    {historyCount} snapshot{historyCount !== 1 ? 's' : ''}
                </span>
            )}
        </div>
    );
}

/**
 * Markdown preview component using same styling as chat
 */
function MarkdownPreview({ content }) {
    const [copiedCode, setCopiedCode] = useState(null);

    const handleCopyCode = (code, index) => {
        navigator.clipboard?.writeText(code);
        setCopiedCode(index);
        setTimeout(() => setCopiedCode(null), 2000);
    };

    if (!content) {
        return (
            <div className="flex items-center justify-center h-full text-muted-foreground">
                <p>No content yet. Start typing or use AI to generate.</p>
            </div>
        );
    }

    return (
        <div className="markdown-content prose prose-invert max-w-none px-6 py-4">
            <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeKatex, [rehypeSanitize, markdownSchema]]}
                components={{
                    a: (props) => (
                        <a
                            {...props}
                            target="_blank"
                            rel="noopener noreferrer"
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
                            <div className="relative group my-4">
                                <pre
                                    {...props}
                                    className="bg-popover border border-border rounded-lg p-4 overflow-x-auto text-sm"
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
                            className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider border-r border-border last:border-r-0"
                            {...props}
                        >
                            {children}
                        </th>
                    ),
                    td: ({ children, ...props }) => (
                        <td
                            className="px-4 py-3 text-sm text-white/80 border-r border-border last:border-r-0"
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
                        <h1 className="text-2xl font-bold text-white mt-6 mb-4 pb-2 border-b border-border" {...props}>
                            {children}
                        </h1>
                    ),
                    h2: ({ children, ...props }) => (
                        <h2 className="text-xl font-semibold text-white mt-5 mb-3" {...props}>
                            {children}
                        </h2>
                    ),
                    h3: ({ children, ...props }) => (
                        <h3 className="text-lg font-semibold text-white mt-4 mb-2" {...props}>
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
                {content}
            </ReactMarkdown>
        </div>
    );
}

/**
 * Floating AI Edit Toolbar that appears when text is selected
 */
function SelectionToolbar({
    position,
    selectedText,
    onClose,
    onSubmit,
    isProcessing
}) {
    const [instruction, setInstruction] = useState("");
    const [showInput, setShowInput] = useState(false);
    const inputRef = useRef(null);

    useEffect(() => {
        if (showInput && inputRef.current) {
            inputRef.current.focus();
        }
    }, [showInput]);

    const handleSubmit = () => {
        if (instruction.trim() && !isProcessing) {
            onSubmit(instruction.trim());
            setInstruction("");
            setShowInput(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        } else if (e.key === "Escape") {
            onClose();
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 5, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="fixed z-50 bg-[#1E1E1E] border border-border rounded-xl shadow-xl"
            style={{
                left: `${position.x}px`,
                top: `${position.y}px`,
                transform: "translateX(-50%)"
            }}
        >
            {!showInput ? (
                <button
                    onClick={() => setShowInput(true)}
                    className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white hover:bg-foreground/10 rounded-xl transition-colors"
                >
                    <Sparkles size={14} className="text-primary" />
                    AI Edit
                </button>
            ) : (
                <div className="p-2 min-w-[280px]">
                    <div className="flex items-center gap-2 mb-2 px-2">
                        <Sparkles size={14} className="text-primary shrink-0" />
                        <span className="text-xs text-muted-foreground truncate">
                            Editing: "{selectedText.slice(0, 30)}{selectedText.length > 30 ? '...' : ''}"
                        </span>
                        <button
                            onClick={onClose}
                            className="ml-auto p-1 hover:bg-foreground/10 rounded"
                        >
                            <X size={12} />
                        </button>
                    </div>
                    <div className="flex items-center gap-2">
                        <input
                            ref={inputRef}
                            type="text"
                            value={instruction}
                            onChange={(e) => setInstruction(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="What should I change?"
                            disabled={isProcessing}
                            className="flex-1 bg-foreground/5 border border-border rounded-lg px-3 py-2 text-sm text-white placeholder:text-muted-foreground outline-none focus:border-primary/50"
                        />
                        <button
                            onClick={handleSubmit}
                            disabled={!instruction.trim() || isProcessing}
                            className={cn(
                                "p-2 rounded-lg transition-colors",
                                instruction.trim() && !isProcessing
                                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                                    : "bg-foreground/10 text-muted-foreground/50 cursor-not-allowed"
                            )}
                        >
                            {isProcessing ? (
                                <Loader2 size={14} className="animate-spin" />
                            ) : (
                                <Send size={14} />
                            )}
                        </button>
                    </div>
                </div>
            )}
        </motion.div>
    );
}

// Maximum history snapshots to keep
const MAX_HISTORY = 50;

/**
 * Document editor with edit/preview modes, formatting toolbar, undo/redo, and AI editing
 */
export default function LabsEditor({
    content,
    onChange,
    isProcessing,
    onSelectionEdit,
    modelId
}) {
    const [mode, setMode] = useState("edit");
    const textareaRef = useRef(null);
    const containerRef = useRef(null);
    const [localContent, setLocalContent] = useState(content || "");
    const debounceRef = useRef(null);

    // Undo/Redo history
    const [history, setHistory] = useState([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const isUndoRedoRef = useRef(false);

    // Selection state
    const [selection, setSelection] = useState(null);
    const [toolbarPosition, setToolbarPosition] = useState(null);
    const [isEditing, setIsEditing] = useState(false);

    // Sync external content changes
    useEffect(() => {
        if (content !== localContent && !isUndoRedoRef.current) {
            setLocalContent(content || "");
        }
        isUndoRedoRef.current = false;
    }, [content]);

    // Save snapshot to history (called before AI edits and periodically)
    const saveSnapshot = useCallback(() => {
        setHistory(prev => {
            // Remove any "future" states if we're not at the end
            const newHistory = prev.slice(0, historyIndex + 1);
            // Add current state
            newHistory.push({
                content: localContent,
                timestamp: Date.now()
            });
            // Limit history size
            if (newHistory.length > MAX_HISTORY) {
                newHistory.shift();
            }
            return newHistory;
        });
        setHistoryIndex(prev => Math.min(prev + 1, MAX_HISTORY - 1));
    }, [localContent, historyIndex]);

    // Undo function
    const handleUndo = useCallback(() => {
        if (historyIndex > 0) {
            isUndoRedoRef.current = true;
            const prevState = history[historyIndex - 1];
            setLocalContent(prevState.content);
            onChange(prevState.content);
            setHistoryIndex(prev => prev - 1);
        }
    }, [history, historyIndex, onChange]);

    // Redo function
    const handleRedo = useCallback(() => {
        if (historyIndex < history.length - 1) {
            isUndoRedoRef.current = true;
            const nextState = history[historyIndex + 1];
            setLocalContent(nextState.content);
            onChange(nextState.content);
            setHistoryIndex(prev => prev + 1);
        }
    }, [history, historyIndex, onChange]);

    // Debounced save with snapshot
    const handleChange = useCallback((e) => {
        const value = e.target.value;
        setLocalContent(value);

        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }

        debounceRef.current = setTimeout(() => {
            onChange(value);
            // Save snapshot every few seconds of inactivity
            saveSnapshot();
        }, 1000);
    }, [onChange, saveSnapshot]);

    // Cleanup debounce on unmount
    useEffect(() => {
        return () => {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }
        };
    }, []);

    // Auto-resize textarea
    useEffect(() => {
        const textarea = textareaRef.current;
        if (textarea && mode === "edit") {
            textarea.style.height = "auto";
            textarea.style.height = `${textarea.scrollHeight}px`;
        }
    }, [localContent, mode]);

    // Handle formatting toolbar actions
    const handleFormat = useCallback((prefix, suffix) => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selectedText = textarea.value.substring(start, end);

        let newText;
        let newCursorPos;

        if (selectedText) {
            // Wrap selected text
            newText = textarea.value.substring(0, start) +
                prefix + selectedText + suffix +
                textarea.value.substring(end);
            newCursorPos = end + prefix.length + suffix.length;
        } else {
            // Insert at cursor
            newText = textarea.value.substring(0, start) +
                prefix + suffix +
                textarea.value.substring(end);
            newCursorPos = start + prefix.length;
        }

        setLocalContent(newText);
        onChange(newText);

        // Restore cursor position
        requestAnimationFrame(() => {
            textarea.focus();
            textarea.setSelectionRange(newCursorPos, newCursorPos);
        });
    }, [onChange]);

    // Handle text selection
    const handleSelect = useCallback(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selectedText = textarea.value.substring(start, end);

        if (selectedText.length > 3) {
            const rect = textarea.getBoundingClientRect();
            const textBeforeSelection = textarea.value.substring(0, start);
            const lines = textBeforeSelection.split('\n');
            const currentLine = lines.length;
            const lineHeight = parseInt(getComputedStyle(textarea).lineHeight) || 20;

            const x = rect.left + rect.width / 2;
            const y = rect.top + (currentLine * lineHeight) - 30;

            setSelection({
                start,
                end,
                text: selectedText
            });
            setToolbarPosition({ x, y: Math.max(y, rect.top + 10) });
        } else {
            closeToolbar();
        }
    }, []);

    const closeToolbar = () => {
        setSelection(null);
        setToolbarPosition(null);
        setIsEditing(false);
    };

    // Handle selection edit submission
    const handleSelectionEdit = async (instruction) => {
        if (!selection || !onSelectionEdit) return;

        // Save snapshot before AI edit
        saveSnapshot();
        setIsEditing(true);

        try {
            const contextBefore = localContent.substring(
                Math.max(0, selection.start - 100),
                selection.start
            );
            const contextAfter = localContent.substring(
                selection.end,
                Math.min(localContent.length, selection.end + 100)
            );

            const replacement = await onSelectionEdit({
                selectedText: selection.text,
                instruction,
                contextBefore,
                contextAfter,
                modelId
            });

            if (replacement) {
                const newContent =
                    localContent.substring(0, selection.start) +
                    replacement +
                    localContent.substring(selection.end);

                setLocalContent(newContent);
                onChange(newContent);
            }
        } catch (error) {
            console.error("[Labs] Selection edit failed:", error);
        } finally {
            setIsEditing(false);
            closeToolbar();
        }
    };

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyboard = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                e.preventDefault();
                if (e.shiftKey) {
                    handleRedo();
                } else {
                    handleUndo();
                }
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
                e.preventDefault();
                handleRedo();
            }
        };

        document.addEventListener('keydown', handleKeyboard);
        return () => document.removeEventListener('keydown', handleKeyboard);
    }, [handleUndo, handleRedo]);

    // Close toolbar when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                closeToolbar();
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const canUndo = historyIndex > 0;
    const canRedo = historyIndex < history.length - 1;

    return (
        <div ref={containerRef} className="h-full flex flex-col relative">
            {/* Mode Toggle & History Controls */}
            <div className="flex items-center gap-1 px-4 py-2 border-b border-border bg-background/50">
                <button
                    onClick={() => setMode("edit")}
                    className={cn(
                        "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                        mode === "edit"
                            ? "bg-foreground/10 text-white"
                            : "text-muted-foreground hover:text-white hover:bg-foreground/5"
                    )}
                >
                    <Edit3 size={14} />
                    Edit
                </button>
                <button
                    onClick={() => { setMode("preview"); closeToolbar(); }}
                    className={cn(
                        "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                        mode === "preview"
                            ? "bg-foreground/10 text-white"
                            : "text-muted-foreground hover:text-white hover:bg-foreground/5"
                    )}
                >
                    <Eye size={14} />
                    Preview
                </button>

                {/* Spacer */}
                <div className="flex-1" />

                {/* Undo/Redo */}
                <HistoryControls
                    canUndo={canUndo}
                    canRedo={canRedo}
                    onUndo={handleUndo}
                    onRedo={handleRedo}
                    historyCount={history.length}
                />

                {/* Status */}
                {(isProcessing || isEditing) && (
                    <div className="flex items-center gap-2 text-primary text-sm ml-2">
                        <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                            className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full"
                        />
                        <span>{isEditing ? "Editing..." : "AI working..."}</span>
                    </div>
                )}
            </div>

            {/* Formatting Toolbar (only in edit mode) */}
            {mode === "edit" && (
                <FormattingToolbar
                    onFormat={handleFormat}
                    disabled={isProcessing || isEditing}
                />
            )}

            {/* Editor/Preview Area */}
            <div className="flex-1 overflow-auto custom-scrollbar">
                {mode === "edit" ? (
                    <textarea
                        ref={textareaRef}
                        value={localContent}
                        onChange={handleChange}
                        onSelect={handleSelect}
                        onMouseUp={handleSelect}
                        placeholder="Start writing your document here...

You can use Markdown formatting:
# Heading 1
## Heading 2
**bold** and *italic*
- Bullet lists
1. Numbered lists
> Blockquotes
`inline code`

💡 Tip: Use the toolbar above or select text for AI editing!"
                        disabled={isProcessing || isEditing}
                        className={cn(
                            "w-full min-h-full p-6 bg-transparent outline-none resize-none text-white font-mono text-sm leading-relaxed",
                            "placeholder:text-muted-foreground/50",
                            (isProcessing || isEditing) && "opacity-50"
                        )}
                        spellCheck="true"
                    />
                ) : (
                    <MarkdownPreview content={localContent} />
                )}
            </div>

            {/* Floating Selection Toolbar */}
            <AnimatePresence>
                {selection && toolbarPosition && mode === "edit" && (
                    <SelectionToolbar
                        position={toolbarPosition}
                        selectedText={selection.text}
                        onClose={closeToolbar}
                        onSubmit={handleSelectionEdit}
                        isProcessing={isEditing}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
