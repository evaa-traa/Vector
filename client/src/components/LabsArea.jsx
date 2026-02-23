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
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { useLabsProjects } from "../hooks/useLabsProjects.js";
import LabsEditor from "./LabsEditor.jsx";
import { exportToWord } from "../utils/exportToWord.js";
import { exportToPdf } from "../utils/exportToPdf.js";
import { stripMetadata } from "../utils/contentUtils.js";

function cn(...inputs) {
    return twMerge(clsx(inputs));
}

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
                                onDelete(project.id);
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
    const [showExportMenu, setShowExportMenu] = useState(false);
    const instructionRef = useRef(null);
    const importInputRef = useRef(null);
    const exportMenuRef = useRef(null);

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
        setShowExportMenu(false);

        try {
            await exportToWord(activeProject.document, activeProject.name);
        } catch (err) {
            setError("Failed to export document");
            console.error("[Labs] Export error:", err);
        }
    };

    // Handle PDF export
    const handleExportPdf = async () => {
        if (!activeProject?.document) return;
        setShowExportMenu(false);

        try {
            await exportToPdf(activeProject.document, activeProject.name);
        } catch (err) {
            setError("Failed to export PDF");
            console.error("[Labs] PDF Export error:", err);
        }
    };

    // Close export menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (exportMenuRef.current && !exportMenuRef.current.contains(e.target)) {
                setShowExportMenu(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
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

                                    {/* Export Dropdown */}
                                    <div className="relative" ref={exportMenuRef}>
                                        <button
                                            onClick={() => setShowExportMenu(!showExportMenu)}
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

                                        <AnimatePresence>
                                            {showExportMenu && (
                                                <motion.div
                                                    initial={{ opacity: 0, y: -5 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, y: -5 }}
                                                    className="absolute right-0 top-full mt-1 bg-[#1E1E1E] border border-border rounded-lg shadow-xl z-50 min-w-[120px] overflow-hidden"
                                                >
                                                    <button
                                                        onClick={handleExportWord}
                                                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white hover:bg-foreground/10 transition-colors"
                                                    >
                                                        <FileText size={14} className="shrink-0" /> Word (.docx)
                                                    </button>
                                                    <button
                                                        onClick={handleExportPdf}
                                                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white hover:bg-foreground/10 transition-colors"
                                                    >
                                                        <FileDown size={14} className="shrink-0" /> PDF (.pdf)
                                                    </button>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
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
                        <div className="flex-1 flex items-center justify-center p-4">
                            <div className="text-center">
                                <div className="w-14 h-14 rounded-2xl bg-foreground/5 border border-border flex items-center justify-center mx-auto mb-4">
                                    <FileText className="text-muted-foreground w-7 h-7" />
                                </div>
                                <h2 className="text-lg font-semibold text-white mb-2">No Project Selected</h2>
                                <p className="text-muted-foreground text-sm mb-4">Create a new project or import a document</p>
                                <div className="flex items-center justify-center gap-2">
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
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
