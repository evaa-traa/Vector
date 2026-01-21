import React, { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import { motion } from "framer-motion";
import { Eye, Edit3, Copy, Check } from "lucide-react";
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
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[[rehypeSanitize, markdownSchema]]}
                components={{
                    a: (props) => (
                        <a
                            {...props}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-foreground underline decoration-border hover:text-foreground/90 hover:decoration-muted-foreground/40 transition-colors"
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
                                    className="absolute top-2 right-2 p-1.5 rounded-md bg-foreground/10 hover:bg-foreground/20 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-all"
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
                                    className="px-1.5 py-0.5 rounded-md bg-foreground/10 text-foreground text-sm font-mono"
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
                        <li className="relative pl-6 text-foreground/90" {...props}>
                            <span className="absolute left-0 text-muted-foreground">•</span>
                            {children}
                        </li>
                    ),
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
                    p: ({ children, ...props }) => (
                        <p className="my-[0.7em] text-foreground/90 leading-[1.65]" {...props}>
                            {children}
                        </p>
                    ),
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
                    blockquote: ({ children, ...props }) => (
                        <blockquote
                            className="my-4 pl-4 border-l-4 border-border bg-foreground/5 py-2 pr-4 rounded-r-lg italic text-foreground/80"
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
 * Document editor with edit/preview modes
 */
export default function LabsEditor({ content, onChange, isProcessing }) {
    const [mode, setMode] = useState("edit"); // "edit" | "preview"
    const textareaRef = useRef(null);
    const [localContent, setLocalContent] = useState(content);
    const debounceRef = useRef(null);

    // Sync external content changes
    useEffect(() => {
        setLocalContent(content);
    }, [content]);

    // Debounced save
    const handleChange = useCallback((e) => {
        const value = e.target.value;
        setLocalContent(value);

        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }

        debounceRef.current = setTimeout(() => {
            onChange(value);
        }, 300);
    }, [onChange]);

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

    return (
        <div className="h-full flex flex-col">
            {/* Mode Toggle */}
            <div className="flex items-center gap-1 px-4 py-2 border-b border-border bg-background/50">
                <button
                    onClick={() => setMode("edit")}
                    className={cn(
                        "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                        mode === "edit"
                            ? "bg-foreground/10 text-foreground"
                            : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
                    )}
                >
                    <Edit3 size={14} />
                    Edit
                </button>
                <button
                    onClick={() => setMode("preview")}
                    className={cn(
                        "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                        mode === "preview"
                            ? "bg-foreground/10 text-foreground"
                            : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
                    )}
                >
                    <Eye size={14} />
                    Preview
                </button>

                {isProcessing && (
                    <div className="ml-auto flex items-center gap-2 text-primary text-sm">
                        <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                            className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full"
                        />
                        <span>AI is working...</span>
                    </div>
                )}
            </div>

            {/* Editor/Preview Area */}
            <div className="flex-1 overflow-auto custom-scrollbar">
                {mode === "edit" ? (
                    <textarea
                        ref={textareaRef}
                        value={localContent}
                        onChange={handleChange}
                        placeholder="Start writing your document here...

You can use Markdown formatting:
# Heading 1
## Heading 2
**bold** and *italic*
- Bullet lists
1. Numbered lists
> Blockquotes
`inline code`

Or use the AI instruction bar below to generate content."
                        disabled={isProcessing}
                        className={cn(
                            "w-full min-h-full p-6 bg-transparent outline-none resize-none text-foreground font-mono text-sm leading-relaxed",
                            "placeholder:text-muted-foreground/50",
                            isProcessing && "opacity-50"
                        )}
                        spellCheck="true"
                    />
                ) : (
                    <MarkdownPreview content={localContent} />
                )}
            </div>
        </div>
    );
}
