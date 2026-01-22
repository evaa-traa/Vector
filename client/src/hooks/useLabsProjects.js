import { useEffect, useMemo, useState, useCallback } from "react";
import { stripMetadata } from "../utils/contentUtils.js";

const STORAGE_KEY_PREFIX = "labs_projects_";

/**
 * Load projects from localStorage for a specific model
 */
function loadProjects(modelId) {
  if (!modelId) return [];
  const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${modelId}`);
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
 * Save projects to localStorage for a specific model
 */
function saveProjects(modelId, projects) {
  if (!modelId) return;
  try {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${modelId}`, JSON.stringify(projects));
  } catch (error) {
    console.error("[Labs] Failed to save projects:", error);
  }
}

/**
 * Create a new project with empty document
 */
function createProject(name = "Untitled Project", document = "") {
  return {
    id: crypto.randomUUID(),
    sessionId: crypto.randomUUID(), // Unique Flowise session per project
    name,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    document
  };
}

/**
 * Hook for managing Labs projects with localStorage persistence.
 * Projects are stored per-model, just like chat history.
 * @param {string} modelId - The currently selected model ID
 */
export function useLabsProjects(modelId) {
  const [projects, setProjects] = useState([]);
  const [activeProjectId, setActiveProjectId] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false); // Track if localStorage was loaded

  // Load projects when modelId changes
  useEffect(() => {
    if (!modelId) {
      setProjects([]);
      setActiveProjectId("");
      setIsLoaded(false);
      return;
    }
    const loaded = loadProjects(modelId);
    setProjects(loaded);
    if (loaded.length > 0) {
      setActiveProjectId(loaded[0].id);
    } else {
      setActiveProjectId("");
    }
    setIsLoaded(true); // Mark as loaded AFTER setting projects
  }, [modelId]);

  // Persist projects to localStorage on change (only after initial load)
  useEffect(() => {
    if (!modelId || !isLoaded) return;
    saveProjects(modelId, projects);
  }, [modelId, projects, isLoaded]);

  // Auto-select first project or create one if none exist (only after load)
  useEffect(() => {
    if (!modelId || !isLoaded) return; // Wait for load to complete
    if (projects.length === 0) {
      const fresh = createProject();
      setProjects([fresh]);
      setActiveProjectId(fresh.id);
    } else if (!activeProjectId || !projects.find(p => p.id === activeProjectId)) {
      setActiveProjectId(projects[0].id);
    }
  }, [projects, activeProjectId, modelId, isLoaded]);

  // Get active project
  const activeProject = useMemo(() => {
    return projects.find(p => p.id === activeProjectId) || null;
  }, [projects, activeProjectId]);

  // Sorted projects list (newest first)
  const projectList = useMemo(() => {
    return [...projects].sort((a, b) => b.updatedAt - a.updatedAt);
  }, [projects]);

  /**
   * Create a new project and make it active
   */
  const handleNewProject = useCallback((name = "Untitled Project", document = "") => {
    const fresh = createProject(name, document);
    setProjects(prev => [fresh, ...prev]);
    setActiveProjectId(fresh.id);
    return fresh;
  }, []);

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
        ? { ...p, document: newDocument, updatedAt: Date.now() }
        : p
    ));
  }, [activeProjectId]);

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
    if (modelId) {
      saveProjects(modelId, projects);
    }
  }, [modelId, projects]);

  return {
    projects: projectList,
    activeProject,
    activeProjectId,
    setActiveProjectId,
    isProcessing,
    handleNewProject,
    handleImportDocument,
    handleDeleteProject,
    handleRenameProject,
    handleUpdateDocument,
    handleAIEdit,
    forceSync
  };
}
