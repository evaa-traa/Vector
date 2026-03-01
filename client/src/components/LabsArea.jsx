import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Plus,
    Trash2,
    FileText,
    Pencil,
    Download,
    Sparkles,
    Send,
    Loader2,
    Check,
    X,
    Menu,
    ChevronLeft,
    Save,
    Upload,
    FileDown
} from "lucide-react";
import { cn } from "../utils/cn.js";
import { useLabsProjects } from "../hooks/useLabsProjects.js";
import LabsEditor from "./LabsEditor.jsx";
import { exportToWord } from "../utils/exportToWord.js";
import { exportToPdf } from "../utils/exportToPdf.js";
import { stripMetadata } from "../utils/contentUtils.js";

/**
 * Project item in the sidebar
 */
function ProjectItem({ project, isActive, onSelect, onRename, onDelete, modelName }) {
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState(project.name);
    const inputRef = useRef(null);

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isEditing]);

    const handleSave = () => {
        if (editName.trim()) {
            onRename(project.id, editName.trim());
        } else {
            setEditName(project.name);
        }
        setIsEditing(false);
    };

    const handleKeyDown = (e) => {
        if (e.key === "Enter") {
            handleSave();
        } else if (e.key === "Escape") {
            setEditName(project.name);
            setIsEditing(false);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className={cn(
                "group flex items-start gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-colors",
                isActive
                    ? "bg-foreground/10 text-white"
                    : "hover:bg-foreground/5 text-muted-foreground hover:text-white"
            )}
            onClick={() => !isEditing && onSelect(project.id)}
        >
            <FileText size={16} className="shrink-0 mt-0.5" />

            <div className="flex-1 min-w-0">
                {isEditing ? (
                    <input
                        ref={inputRef}
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onBlur={handleSave}
                        onKeyDown={handleKeyDown}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full bg-transparent border-b border-foreground/30 outline-none text-sm py-0.5 text-white"
                    />
                ) : (
                    <>
                        <span className="block truncate text-sm">{project.name}</span>
                        {modelName && (
                            <span className="block text-[10px] text-muted-foreground/60 truncate mt-0.5">
                                {modelName}
                            </span>
                        )}
                    </>
                )}
            </div>

            <div className={cn(
                "flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0",
                isEditing && "opacity-100"
            )}>
                {!isEditing && (
                    <>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsEditing(true);
                            }}
                            className="p-1 hover:bg-foreground/10 rounded"
                            title="Rename"
                        >
                            <Pencil size={12} />
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                if (window.confirm(`Delete "${project.name}"? This cannot be undone.`)) {
                                    onDelete(project.id);
                                }
                            }}
                            className="p-1 hover:bg-destructive/20 hover:text-destructive rounded"
                            title="Delete"
                        >
                            <Trash2 size={12} />
                        </button>
                    </>
                )}
            </div>
        </motion.div>
    );
}

/**
 * Main Labs workspace component
 */
export default function LabsArea({
    toggleSidebar,
    sidebarOpen,
    onProjectLockChange
}) {
    const {
        projects,
        activeProject,
        activeProjectId,
        setActiveProjectId,
        isProjectLocked,
        isProcessing,
        handleNewProject,
        handleImportDocument,
        handleDeleteProject,
        handleRenameProject,
        handleUpdateDocument,
        handleAIEdit,
        forceSync,
        getModelName
    } = useLabsProjects();

    const [instruction, setInstruction] = useState("");
    const [error, setError] = useState("");
    const [showProjectList, setShowProjectList] = useState(true);
    const [saveStatus, setSaveStatus] = useState("saved");
    const [isImporting, setIsImporting] = useState(false);
    const [showExportDialog, setShowExportDialog] = useState(false);
    const [exportStatus, setExportStatus] = useState(null); // null | 'preparing-word' | 'preparing-pdf'
    const instructionRef = useRef(null);
    const importInputRef = useRef(null);

    // Notify parent when project lock state changes
    useEffect(() => {
        if (onProjectLockChange) {
            onProjectLockChange(isProjectLocked);
        }
    }, [isProjectLocked, onProjectLockChange]);

    // Handle document changes with save status
    const handleDocumentChange = useCallback((newContent) => {
        setSaveStatus("unsaved");
        handleUpdateDocument(newContent);

        setTimeout(() => {
            setSaveStatus("saved");
        }, 500);
    }, [handleUpdateDocument]);

    // Manual save function
    const handleManualSave = () => {
        setSaveStatus("saving");
        forceSync?.();
        setTimeout(() => {
            setSaveStatus("saved");
        }, 300);
    };

    // Handle file import
    const handleFileImport = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsImporting(true);
        setError("");

        try {
            await handleImportDocument(file);
        } catch (err) {
            setError("Failed to import document: " + (err.message || "Unknown error"));
        } finally {
            setIsImporting(false);
            if (importInputRef.current) {
                importInputRef.current.value = "";
            }
        }
    };

    // Handle AI instruction submission
    const handleSubmitInstruction = async () => {
        if (!instruction.trim() || isProcessing) return;

        setError("");

        try {
            await handleAIEdit(instruction.trim());
            setInstruction("");
        } catch (err) {
            setError(err.message || "Failed to process instruction");
        }
    };

    // Handle selection-based AI editing
    const handleSelectionEdit = async ({ selectedText, instruction, contextBefore, contextAfter }) => {
        try {
            const response = await fetch("/labs-edit-selection", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    selectedText,
                    instruction,
                    contextBefore,
                    contextAfter,
                    sessionId: activeProject?.sessionId
                })
            });

            if (!response.ok) {
                const errorText = await response.text().catch(() => "");
                throw new Error(errorText || `Request failed (${response.status})`);
            }

            // Parse SSE response
            if (!response.body) {
                throw new Error("No response body");
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let fullContent = "";
            let buffer = "";

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });

                const lines = buffer.split("\n");
                buffer = lines.pop() || "";

                for (const line of lines) {
                    if (line.startsWith("data: ")) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            if (data.text) {
                                fullContent += data.text;
                            }
                        } catch {
                            fullContent += line.slice(6);
                        }
                    }
                }
            }

            return stripMetadata(fullContent);
        } catch (error) {
            console.error("[Labs] Selection edit failed:", error);
            setError(error.message || "Failed to edit selection");
            throw error;
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSubmitInstruction();
        }
    };

    // Handle Word export
    const handleExportWord = async () => {
        if (!activeProject?.document) return;
        setExportStatus('preparing-word');
        try {
            await exportToWord(activeProject.document, activeProject.name);
        } catch (err) {
            setError("Failed to export document");
            console.error("[Labs] Export error:", err);
        } finally {
            setExportStatus(null);
            setShowExportDialog(false);
        }
    };

    // Handle PDF export
    const handleExportPdf = async () => {
        if (!activeProject?.document) return;
        setExportStatus('preparing-pdf');
        try {
            await exportToPdf(activeProject.document, activeProject.name);
        } catch (err) {
            setError("Failed to export PDF");
            console.error("[Labs] PDF Export error:", err);
        } finally {
            setExportStatus(null);
            setShowExportDialog(false);
        }
    };

    // Close export dialog on ESC
    useEffect(() => {
        const handleEsc = (e) => {
            if (e.key === 'Escape' && showExportDialog && !exportStatus) setShowExportDialog(false);
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, []);

    // Hide project list on mobile by default
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth < 768) {
                setShowProjectList(false);
            }
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return (
        <div className="flex-1 flex flex-col h-full bg-card">
            {/* Mobile Header */}
            <div className="md:hidden flex items-center p-3 border-b border-border/30 bg-card sticky top-0 z-10">
                <button
                    onClick={toggleSidebar}
                    className="p-2 -ml-2 text-muted-foreground hover:text-white rounded-lg"
                    aria-label="Open sidebar"
                >
                    <Menu size={20} />
                </button>
                <span className="font-semibold text-sm ml-2 text-white">Labs</span>

                <button
                    onClick={() => setShowProjectList(!showProjectList)}
                    className="ml-auto p-2 text-muted-foreground hover:text-white rounded-lg md:hidden"
                >
                    <FileText size={18} />
                </button>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Project Sidebar */}
                <AnimatePresence>
                    {showProjectList && (
                        <motion.div
                            initial={{ width: 0, opacity: 0 }}
                            animate={{ width: 240, opacity: 1 }}
                            exit={{ width: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="h-full border-r border-border bg-background flex flex-col overflow-hidden"
                        >
                            {/* Sidebar Header */}
                            <div className="p-3 border-b border-border flex items-center justify-between gap-2">
                                <h2 className="font-semibold text-white text-sm">Projects</h2>
                                <div className="flex items-center gap-1">
                                    {/* Import Button */}
                                    <input
                                        type="file"
                                        ref={importInputRef}
                                        onChange={handleFileImport}
                                        accept=".txt,.md,.docx"
                                        className="hidden"
                                    />
                                    <button
                                        onClick={() => importInputRef.current?.click()}
                                        disabled={isImporting}
                                        className="p-1.5 hover:bg-foreground/10 rounded-lg text-muted-foreground hover:text-white transition-colors"
                                        title="Import Document"
                                    >
                                        {isImporting ? (
                                            <Loader2 size={16} className="animate-spin" />
                                        ) : (
                                            <Upload size={16} />
                                        )}
                                    </button>
                                    <button
                                        onClick={() => handleNewProject()}
                                        className="p-1.5 hover:bg-foreground/10 rounded-lg text-muted-foreground hover:text-white transition-colors"
                                        title="New Project"
                                    >
                                        <Plus size={16} />
                                    </button>
                                </div>
                            </div>

                            {/* Project List */}
                            <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                                <AnimatePresence>
                                    {projects.map((project) => (
                                        <ProjectItem
                                            key={project.id}
                                            project={project}
                                            isActive={project.id === activeProjectId}
                                            onSelect={(id) => {
                                                setActiveProjectId(id);
                                                if (window.innerWidth < 768) {
                                                    setShowProjectList(false);
                                                }
                                            }}
                                            onRename={handleRenameProject}
                                            onDelete={handleDeleteProject}
                                            modelName={getModelName()}
                                        />
                                    ))}
                                </AnimatePresence>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Main Editor Area */}
                <div className="flex-1 flex flex-col min-w-0">
                    {activeProject ? (
                        <>
                            {/* Editor Header */}
                            <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-card gap-2">
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                    <button
                                        onClick={() => setShowProjectList(!showProjectList)}
                                        className="p-1.5 hover:bg-foreground/10 rounded-lg text-muted-foreground hover:text-white hidden md:flex shrink-0"
                                        title={showProjectList ? "Hide projects" : "Show projects"}
                                    >
                                        <ChevronLeft size={16} className={cn(
                                            "transition-transform",
                                            !showProjectList && "rotate-180"
                                        )} />
                                    </button>
                                    <h1 className="font-medium text-white truncate text-sm">
                                        {activeProject.name}
                                    </h1>

                                    <span className={cn(
                                        "text-xs px-2 py-0.5 rounded-full shrink-0",
                                        saveStatus === "saved" && "text-green-400/70 bg-green-400/10",
                                        saveStatus === "saving" && "text-yellow-400/70 bg-yellow-400/10",
                                        saveStatus === "unsaved" && "text-muted-foreground bg-foreground/5"
                                    )}>
                                        {saveStatus === "saved" && "Saved"}
                                        {saveStatus === "saving" && "Saving..."}
                                        {saveStatus === "unsaved" && "Unsaved"}
                                    </span>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                    <button
                                        onClick={handleManualSave}
                                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-foreground/5 text-muted-foreground hover:text-white hover:bg-foreground/10 transition-colors"
                                        title="Save (auto-saves)"
                                    >
                                        <Save size={14} />
                                        <span className="hidden sm:inline">Save</span>
                                    </button>

                                    {/* Export Button — opens dialog */}
                                    <button
                                        onClick={() => setShowExportDialog(true)}
                                        disabled={!activeProject.document}
                                        className={cn(
                                            "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors",
                                            activeProject.document
                                                ? "bg-primary/10 text-primary hover:bg-primary/20"
                                                : "bg-foreground/5 text-muted-foreground/50 cursor-not-allowed"
                                        )}
                                    >
                                        <Download size={14} />
                                        <span className="hidden sm:inline">Export</span>
                                    </button>

                                    {/* ── Export Dialog Modal ── */}
                                    <AnimatePresence>
                                        {showExportDialog && (
                                            <>
                                                {/* Backdrop */}
                                                <motion.div
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    exit={{ opacity: 0 }}
                                                    className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm"
                                                    onClick={() => !exportStatus && setShowExportDialog(false)}
                                                />
                                                {/* Dialog */}
                                                <motion.div
                                                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                                                    transition={{ duration: 0.2, ease: 'easeOut' }}
                                                    className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[61] bg-popover border border-border rounded-2xl shadow-2xl w-[380px] max-w-[90vw] overflow-hidden"
                                                >
                                                    {/* Header */}
                                                    <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                                                        <div className="flex items-center gap-2.5">
                                                            <Download size={16} className="text-primary" />
                                                            <span className="font-semibold text-sm text-foreground">Export Document</span>
                                                        </div>
                                                        <button
                                                            onClick={() => !exportStatus && setShowExportDialog(false)}
                                                            className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors"
                                                            disabled={!!exportStatus}
                                                        >
                                                            <X size={14} />
                                                        </button>
                                                    </div>

                                                    {/* Body */}
                                                    <div className="p-5">
                                                        {exportStatus ? (
                                                            /* Preparing state */
                                                            <div className="flex flex-col items-center justify-center py-6 gap-3">
                                                                <Loader2 size={28} className="animate-spin text-primary" />
                                                                <span className="text-sm text-muted-foreground font-medium">
                                                                    Preparing your {exportStatus === 'preparing-word' ? '.docx' : '.pdf'} file…
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            /* Format selection */
                                                            <div className="space-y-2">
                                                                <p className="text-xs text-muted-foreground mb-3">Choose a format to download your document.</p>
                                                                <button
                                                                    onClick={handleExportWord}
                                                                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-foreground/3 hover:bg-foreground/6 hover:border-border/80 transition-all text-left group"
                                                                >
                                                                    <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                                                                        <FileText size={18} className="text-blue-400" />
                                                                    </div>
                                                                    <div>
                                                                        <div className="text-sm font-medium text-foreground">Word Document</div>
                                                                        <div className="text-xs text-muted-foreground">.docx — Microsoft Word & Google Docs</div>
                                                                    </div>
                                                                </button>
                                                                <button
                                                                    onClick={handleExportPdf}
                                                                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-foreground/3 hover:bg-foreground/6 hover:border-border/80 transition-all text-left group"
                                                                >
                                                                    <div className="w-9 h-9 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
                                                                        <FileDown size={18} className="text-red-400" />
                                                                    </div>
                                                                    <div>
                                                                        <div className="text-sm font-medium text-foreground">PDF Document</div>
                                                                        <div className="text-xs text-muted-foreground">.pdf — Universal printable format</div>
                                                                    </div>
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </motion.div>
                                            </>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </div>

                            {/* Document Editor */}
                            <div className="flex-1 overflow-hidden">
                                <LabsEditor
                                    content={activeProject.document}
                                    onChange={handleDocumentChange}
                                    isProcessing={isProcessing}
                                    onSelectionEdit={handleSelectionEdit}
                                />
                            </div>

                            {/* AI Instruction Bar */}
                            <div className="p-3 border-t border-border bg-card">
                                <div className="max-w-3xl mx-auto">
                                    {error && (
                                        <div className="mb-2 px-3 py-2 rounded-lg bg-destructive/10 text-destructive text-xs flex items-center gap-2">
                                            <X size={12} />
                                            {error}
                                        </div>
                                    )}

                                    <div className="relative bg-[var(--input-surface)] border border-[var(--input-border)] rounded-xl transition-all focus-within:border-[var(--input-border-focus)]">
                                        <div className="flex items-center gap-2 px-3 py-2.5">
                                            <Sparkles size={16} className="text-primary shrink-0" />
                                            <input
                                                ref={instructionRef}
                                                type="text"
                                                value={instruction}
                                                onChange={(e) => setInstruction(e.target.value)}
                                                onKeyDown={handleKeyDown}
                                                placeholder={activeProject.document
                                                    ? "Give an instruction to edit..."
                                                    : "Describe what to create..."
                                                }
                                                disabled={isProcessing}
                                                className="flex-1 bg-transparent outline-none text-white placeholder:text-muted-foreground text-sm"
                                            />
                                            <button
                                                onClick={handleSubmitInstruction}
                                                disabled={!instruction.trim() || isProcessing}
                                                className={cn(
                                                    "p-1.5 rounded-lg transition-colors",
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
                                </div>
                            </div>
                        </>
                    ) : (
                        /* Empty State */
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 24 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                            className="flex-1 flex items-center justify-center p-4"
                        >
                            <div className="text-center">
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: 0.1, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                                    className="relative w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-4"
                                >
                                    <FileText className="text-primary w-7 h-7" />
                                    <div className="absolute inset-0 rounded-2xl bg-primary/5 animate-pulse" />
                                </motion.div>
                                <motion.h2
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.18, duration: 0.35 }}
                                    className="text-lg font-semibold text-white mb-2"
                                >
                                    No Project Selected
                                </motion.h2>
                                <motion.p
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.24, duration: 0.35 }}
                                    className="text-muted-foreground text-sm mb-5"
                                >
                                    Create a new project or import a document
                                </motion.p>
                                <motion.div
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.3, duration: 0.35 }}
                                    className="flex items-center justify-center gap-2"
                                >
                                    <button
                                        onClick={() => handleNewProject()}
                                        className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
                                    >
                                        Create Project
                                    </button>
                                    <button
                                        onClick={() => importInputRef.current?.click()}
                                        className="px-4 py-2 bg-foreground/10 text-white rounded-lg text-sm font-medium hover:bg-foreground/15 transition-colors"
                                    >
                                        <Upload size={14} className="inline mr-1.5" />
                                        Import
                                    </button>
                                </motion.div>
                            </div>
                        </motion.div>
                    )}
                </div>
            </div>
        </div>
    );
}
