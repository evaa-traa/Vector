import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { stripMetadata } from "../utils/contentUtils.js";

// Storage key
const STORAGE_KEY = "labs_projects_global";

/**
 * Load projects from localStorage
 */
function loadProjects() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      console.log("[Labs] No saved projects");
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      console.warn("[Labs] Invalid data format");
      return [];
    }
    console.log(`[Labs] Loaded ${parsed.length} projects`);
    return parsed;
  } catch (e) {
    console.error("[Labs] Load error:", e);
    return [];
  }
}

/**
 * Save projects to localStorage
 */
function saveProjects(projects) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
    console.log(`[Labs] Saved ${projects.length} projects`);
  } catch (e) {
    console.error("[Labs] Save error:", e);
  }
}

/**
 * Hook for managing Labs projects with localStorage persistence.
 */
export function useLabsProjects(selectedModelId, onModelChange = null, models = []) {
  // Initialize state from localStorage immediately
  const [projects, setProjects] = useState(() => {
    const loaded = loadProjects();
    return loaded;
  });

  const [activeProjectId, setActiveProjectIdState] = useState(() => {
    const loaded = loadProjects();
    return loaded.length > 0 ? loaded[0].id : "";
  });

  const [isProcessing, setIsProcessing] = useState(false);

  // Get active project
  const activeProject = useMemo(() => {
    return projects.find(p => p.id === activeProjectId) || null;
  }, [projects, activeProjectId]);

  // Project is locked when it has content
  const isProjectLocked = useMemo(() => {
    if (!activeProject) return false;
    return (activeProject.document?.trim().length ?? 0) > 0;
  }, [activeProject]);

  // Save to localStorage whenever projects change
  useEffect(() => {
    if (projects.length > 0) {
      saveProjects(projects);
    }
  }, [projects]);

  // Create a fresh project if none exist
  useEffect(() => {
    if (projects.length === 0 && selectedModelId) {
      console.log("[Labs] Creating initial project");
      const newProject = {
        id: crypto.randomUUID(),
        sessionId: crypto.randomUUID(),
        modelId: selectedModelId,
        name: "Untitled Project",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        document: ""
      };
      setProjects([newProject]);
      setActiveProjectIdState(newProject.id);
    }
  }, [projects.length, selectedModelId]);

  // Switch model when selecting a project with content
  useEffect(() => {
    if (activeProject?.modelId && activeProject.document?.trim() && onModelChange) {
      onModelChange(activeProject.modelId);
    }
  }, [activeProjectId]); // Only on project switch

  // Sorted list (newest first)
  const projectList = useMemo(() => {
    return [...projects].sort((a, b) => b.updatedAt - a.updatedAt);
  }, [projects]);

  // Get model name
  const getModelName = useCallback((modelId) => {
    const model = models.find(m => m.id === modelId);
    return model?.name || `Model ${modelId}`;
  }, [models]);

  /**
   * Set active project
   */
  const setActiveProjectId = useCallback((projectId) => {
    const project = projects.find(p => p.id === projectId);
    if (project) {
      setActiveProjectIdState(projectId);
      console.log(`[Labs] Activated: ${project.name}`);
    }
  }, [projects]);

  /**
   * Create new project
   */
  const handleNewProject = useCallback((name = "Untitled Project", document = "") => {
    const newProject = {
      id: crypto.randomUUID(),
      sessionId: crypto.randomUUID(),
      modelId: selectedModelId,
      name,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      document
    };
    setProjects(prev => [newProject, ...prev]);
    setActiveProjectIdState(newProject.id);
    console.log(`[Labs] Created: ${name}`);
    return newProject;
  }, [selectedModelId]);

  /**
   * Import document
   */
  const handleImportDocument = useCallback(async (file) => {
    if (!file) return null;
    const name = file.name.replace(/\.(txt|md|docx)$/i, "") || "Imported";
    let content = "";
    try {
      if (file.name.endsWith(".docx")) {
        const mammoth = await import("mammoth");
        const buffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer: buffer });
        content = result.value || "";
      } else {
        content = await file.text();
      }
      return handleNewProject(name, content);
    } catch (e) {
      console.error("[Labs] Import error:", e);
      throw e;
    }
  }, [handleNewProject]);

  /**
   * Delete project
   */
  const handleDeleteProject = useCallback((projectId) => {
    setProjects(prev => {
      const filtered = prev.filter(p => p.id !== projectId);
      // Switch to another project if we deleted the active one
      if (projectId === activeProjectId && filtered.length > 0) {
        setActiveProjectIdState(filtered[0].id);
      }
      // If no projects left, clear storage
      if (filtered.length === 0) {
        localStorage.removeItem(STORAGE_KEY);
      }
      return filtered;
    });
  }, [activeProjectId]);

  /**
   * Rename project
   */
  const handleRenameProject = useCallback((projectId, newName) => {
    setProjects(prev => prev.map(p =>
      p.id === projectId ? { ...p, name: newName, updatedAt: Date.now() } : p
    ));
  }, []);

  /**
   * Update document
   */
  const handleUpdateDocument = useCallback((newDocument) => {
    if (!activeProjectId) return;
    setProjects(prev => prev.map(p =>
      p.id === activeProjectId
        ? { ...p, document: newDocument, updatedAt: Date.now(), modelId: p.modelId || selectedModelId }
        : p
    ));
  }, [activeProjectId, selectedModelId]);

  /**
   * AI Edit
   */
  const handleAIEdit = useCallback(async (instruction, modelId) => {
    if (!activeProject) return null;
    setIsProcessing(true);
    console.log(`[Labs] AI Edit with session: ${activeProject.sessionId}`);

    try {
      const response = await fetch("/labs-edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          document: activeProject.document,
          instruction,
          modelId,
          sessionId: activeProject.sessionId
        })
      });

      if (!response.ok) {
        const err = await response.text().catch(() => "");
        throw new Error(err || `Request failed (${response.status})`);
      }

      if (!response.body) throw new Error("No response body");

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
              if (data.text) fullContent += data.text;
            } catch {
              fullContent += line.slice(6);
            }
          }
        }
      }

      if (fullContent) {
        const cleaned = stripMetadata(fullContent);
        handleUpdateDocument(cleaned);
      }
      return fullContent;
    } catch (e) {
      console.error("[Labs] AI edit error:", e);
      throw e;
    } finally {
      setIsProcessing(false);
    }
  }, [activeProject, handleUpdateDocument]);

  /**
   * Force sync to storage
   */
  const forceSync = useCallback(() => {
    saveProjects(projects);
  }, [projects]);

  return {
    projects: projectList,
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
  };
}
