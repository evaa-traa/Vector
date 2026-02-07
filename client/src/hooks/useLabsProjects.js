import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { stripMetadata } from "../utils/contentUtils.js";

// Global storage - all projects stored together with their modelId
const GLOBAL_STORAGE_KEY = "labs_projects_global";

/**
 * Load all projects from localStorage (global)
 */
function loadAllProjects() {
  const raw = localStorage.getItem(GLOBAL_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn("[Labs] Failed to parse projects:", error);
    return [];
  }
}

/**
 * Save all projects to localStorage (global)
 */
function saveAllProjects(projects) {
  try {
    localStorage.setItem(GLOBAL_STORAGE_KEY, JSON.stringify(projects));
  } catch (error) {
    console.error("[Labs] Failed to save projects:", error);
  }
}

/**
 * Create a new project with empty document
 * @param {string} modelId - The model this project is created with
 */
function createProject(name = "Untitled Project", document = "", modelId = "") {
  return {
    id: crypto.randomUUID(),
    sessionId: crypto.randomUUID(), // Unique Flowise session per project
    modelId, // Lock project to this model
    name,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    document
  };
}

/**
 * Hook for managing Labs projects with localStorage persistence.
 * Projects are now stored globally with modelId per project.
 * When a project with content is selected, the model auto-switches and locks.
 * 
 * @param {string} currentModelId - The currently selected model ID
 * @param {function} onModelChange - Callback to switch model when project is selected
 * @param {Array} models - Available models list (for displaying model names)
 */
export function useLabsProjects(currentModelId, onModelChange = null, models = []) {
  const [projects, setProjects] = useState([]);
  const [activeProjectId, setActiveProjectId] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const initialLoadDone = useRef(false);

  // Get active project
  const activeProject = useMemo(() => {
    return projects.find(p => p.id === activeProjectId) || null;
  }, [projects, activeProjectId]);

  // Project is locked when it has content - disables model switching
  // IMPORTANT: This is computed, not stored, so it updates instantly
  const isProjectLocked = useMemo(() => {
    if (!activeProject) return false;
    return (activeProject.document?.trim().length ?? 0) > 0;
  }, [activeProject]);

  // Load ALL projects once on mount (global)
  useEffect(() => {
    if (initialLoadDone.current) return;
    initialLoadDone.current = true;

    const loaded = loadAllProjects();
    setProjects(loaded);
    if (loaded.length > 0) {
      setActiveProjectId(loaded[0].id);
      // If the stored project has a modelId and content, switch to it
      if (loaded[0].modelId && loaded[0].document?.trim() && onModelChange) {
        onModelChange(loaded[0].modelId);
      }
    }
  }, [onModelChange]);

  // When no projects exist and we have a model, create a fresh project
  useEffect(() => {
    if (projects.length === 0 && currentModelId && initialLoadDone.current) {
      const fresh = createProject("Untitled Project", "", currentModelId);
      setProjects([fresh]);
      setActiveProjectId(fresh.id);
    }
  }, [projects.length, currentModelId]);

  // Save projects globally whenever they change
  useEffect(() => {
    if (projects.length > 0) {
      saveAllProjects(projects);
    }
  }, [projects]);

  // Sorted projects list (newest first)
  const projectList = useMemo(() => {
    return [...projects].sort((a, b) => b.updatedAt - a.updatedAt);
  }, [projects]);

  // Get model name by ID
  const getModelName = useCallback((modelId) => {
    const model = models.find(m => m.id === modelId);
    return model?.name || `Model ${modelId}`;
  }, [models]);

  /**
   * Select a project - auto-switches model if project has content
   */
  const handleSelectProject = useCallback((projectId) => {
    const project = projects.find(p => p.id === projectId);
    if (project) {
      setActiveProjectId(projectId);
      // If project has content and a modelId, switch to that model
      if (project.modelId && project.document?.trim() && onModelChange) {
        onModelChange(project.modelId);
      }
    }
  }, [projects, onModelChange]);

  /**
   * Create a new project and make it active
   */
  const handleNewProject = useCallback((name = "Untitled Project", document = "") => {
    const fresh = createProject(name, document, currentModelId);
    setProjects(prev => [fresh, ...prev]);
    setActiveProjectId(fresh.id);
    return fresh;
  }, [currentModelId]);

  /**
   * Import a document file and create a project from it
   */
  const handleImportDocument = useCallback(async (file) => {
    if (!file) return null;

    const name = file.name.replace(/\.(txt|md|docx)$/i, "") || "Imported Document";
    let document = "";

    try {
      if (file.name.endsWith(".docx")) {
        // Use mammoth for .docx files
        const mammoth = await import("mammoth");
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        document = result.value || "";
      } else {
        // Plain text for .txt and .md files
        document = await file.text();
      }

      return handleNewProject(name, document);
    } catch (error) {
      console.error("[Labs] Failed to import document:", error);
      throw error;
    }
  }, [handleNewProject]);

  /**
   * Delete a project by ID
   */
  const handleDeleteProject = useCallback((projectId) => {
    setProjects(prev => {
      const filtered = prev.filter(p => p.id !== projectId);
      // If deleting active project, switch to first remaining
      if (projectId === activeProjectId && filtered.length > 0) {
        setActiveProjectId(filtered[0].id);
      }
      return filtered;
    });
  }, [activeProjectId]);

  /**
   * Rename a project
   */
  const handleRenameProject = useCallback((projectId, newName) => {
    setProjects(prev => prev.map(p =>
      p.id === projectId
        ? { ...p, name: newName, updatedAt: Date.now() }
        : p
    ));
  }, []);

  /**
   * Update the document content for the active project
   */
  const handleUpdateDocument = useCallback((newDocument) => {
    if (!activeProjectId) return;
    setProjects(prev => prev.map(p =>
      p.id === activeProjectId
        ? {
          ...p,
          document: newDocument,
          updatedAt: Date.now(),
          // Lock to current model when content is added
          modelId: p.modelId || currentModelId
        }
        : p
    ));
  }, [activeProjectId, currentModelId]);

  /**
   * Send instruction to AI to generate or edit document
   * Returns the updated document content
   */
  const handleAIEdit = useCallback(async (instruction, modelIdForAI) => {
    if (!activeProject) return null;

    setIsProcessing(true);

    try {
      const response = await fetch("/labs-edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          document: activeProject.document,
          instruction,
          modelId: modelIdForAI,
          sessionId: activeProject.sessionId
        })
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(errorText || `Request failed (${response.status})`);
      }

      // Handle streaming response
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

        // Parse SSE events
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
              // Non-JSON data, treat as raw text
              fullContent += line.slice(6);
            }
          }
        }
      }

      // Update project with new document (filtered of metadata)
      if (fullContent) {
        const cleanedContent = stripMetadata(fullContent);
        handleUpdateDocument(cleanedContent);
      }

      return fullContent;
    } catch (error) {
      console.error("[Labs] AI edit failed:", error);
      throw error;
    } finally {
      setIsProcessing(false);
    }
  }, [activeProject, handleUpdateDocument]);

  /**
   * Force sync projects to localStorage (manual save)
   */
  const forceSync = useCallback(() => {
    saveAllProjects(projects);
  }, [projects]);

  return {
    projects: projectList,
    activeProject,
    activeProjectId,
    setActiveProjectId: handleSelectProject, // Use our handler that does model switching
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
  };
}
