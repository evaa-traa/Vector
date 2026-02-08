import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { stripMetadata } from "../utils/contentUtils.js";

// Global storage key for all Labs projects
const GLOBAL_STORAGE_KEY = "labs_projects_global";

/**
 * Load all projects from localStorage with validation
 */
function loadAllProjects() {
  try {
    const raw = localStorage.getItem(GLOBAL_STORAGE_KEY);
    if (!raw) {
      console.log("[Labs] No stored projects found");
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      console.warn("[Labs] Invalid stored data format, resetting");
      return [];
    }
    // Validate each project structure
    const validated = parsed
      .filter(p => p && typeof p === "object" && p.id)
      .map(project => ({
        id: project.id,
        sessionId: project.sessionId || crypto.randomUUID(),
        modelId: project.modelId || "",
        name: project.name || "Untitled Project",
        createdAt: project.createdAt || Date.now(),
        updatedAt: project.updatedAt || Date.now(),
        document: project.document || ""
      }));
    console.log(`[Labs] Loaded ${validated.length} projects from storage`);
    return validated;
  } catch (error) {
    console.error("[Labs] Failed to load projects:", error);
    return [];
  }
}

/**
 * Save all projects to localStorage
 */
function saveAllProjects(projects) {
  if (!projects || projects.length === 0) {
    console.log("[Labs] Skipping save - no projects");
    return false;
  }
  try {
    const serialized = JSON.stringify(projects);
    localStorage.setItem(GLOBAL_STORAGE_KEY, serialized);
    console.log(`[Labs] Saved ${projects.length} projects (${serialized.length} bytes)`);
    return true;
  } catch (error) {
    console.error("[Labs] Failed to save projects:", error);
    // Handle QuotaExceededError - try saving with trimmed documents
    if (error.name === "QuotaExceededError") {
      console.warn("[Labs] Storage quota exceeded, trying reduced save...");
      try {
        const reduced = projects.map(p => ({
          ...p,
          document: (p.document || "").slice(0, 50000) // Limit to 50KB per document
        }));
        localStorage.setItem(GLOBAL_STORAGE_KEY, JSON.stringify(reduced));
        console.log("[Labs] Reduced save successful");
        return true;
      } catch (innerError) {
        console.error("[Labs] Reduced save also failed, clearing storage");
        localStorage.removeItem(GLOBAL_STORAGE_KEY);
        return false;
      }
    }
    return false;
  }
}

/**
 * Create a new project with unique sessionId for Flowise
 */
function createProject(name = "Untitled Project", document = "", modelId = "") {
  const project = {
    id: crypto.randomUUID(),
    sessionId: crypto.randomUUID(), // Unique Flowise session per project
    modelId,
    name,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    document
  };
  console.log(`[Labs] Created project: ${project.id} with session: ${project.sessionId}`);
  return project;
}

/**
 * Hook for managing Labs projects with localStorage persistence.
 * Each project has its own sessionId for Flowise conversation memory.
 */
export function useLabsProjects(currentModelId, onModelChange = null, models = []) {
  const [projects, setProjects] = useState([]);
  const [activeProjectId, setActiveProjectId] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const initialLoadDone = useRef(false);
  const saveTimeoutRef = useRef(null);

  // Get active project
  const activeProject = useMemo(() => {
    return projects.find(p => p.id === activeProjectId) || null;
  }, [projects, activeProjectId]);

  // Project is locked when it has content
  const isProjectLocked = useMemo(() => {
    if (!activeProject) return false;
    return (activeProject.document?.trim().length ?? 0) > 0;
  }, [activeProject]);

  // Load projects on mount - ONCE
  useEffect(() => {
    if (initialLoadDone.current) return;
    initialLoadDone.current = true;

    console.log("[Labs] Initial load starting...");
    const loaded = loadAllProjects();

    if (loaded.length > 0) {
      setProjects(loaded);
      setActiveProjectId(loaded[0].id);
      console.log(`[Labs] Set active project: ${loaded[0].id}`);

      // Switch to project's model if it has content
      if (loaded[0].modelId && loaded[0].document?.trim() && onModelChange) {
        onModelChange(loaded[0].modelId);
      }
    }
  }, [onModelChange]);

  // Create fresh project when we have a model but no projects
  useEffect(() => {
    if (projects.length === 0 && currentModelId && initialLoadDone.current) {
      console.log("[Labs] No projects, creating fresh one...");
      const fresh = createProject("Untitled Project", "", currentModelId);
      setProjects([fresh]);
      setActiveProjectId(fresh.id);
    }
  }, [projects.length, currentModelId]);

  // Save projects whenever they change (debounced)
  useEffect(() => {
    if (!initialLoadDone.current) return;
    if (projects.length === 0) return;

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Debounce save by 200ms
    saveTimeoutRef.current = setTimeout(() => {
      saveAllProjects(projects);
    }, 200);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [projects]);

  // Force save on page unload to prevent data loss from debounce delay
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (projects.length > 0) {
        // Cancel pending debounced save and save immediately
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
        }
        saveAllProjects(projects);
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
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
   * Select a project
   */
  const handleSelectProject = useCallback((projectId) => {
    const project = projects.find(p => p.id === projectId);
    if (project) {
      setActiveProjectId(projectId);
      console.log(`[Labs] Selected project: ${projectId}, session: ${project.sessionId}`);
      if (project.modelId && project.document?.trim() && onModelChange) {
        onModelChange(project.modelId);
      }
    }
  }, [projects, onModelChange]);

  /**
   * Create a new project
   */
  const handleNewProject = useCallback((name = "Untitled Project", document = "") => {
    const fresh = createProject(name, document, currentModelId);
    setProjects(prev => [fresh, ...prev]);
    setActiveProjectId(fresh.id);
    return fresh;
  }, [currentModelId]);

  /**
   * Import a document file
   */
  const handleImportDocument = useCallback(async (file) => {
    if (!file) return null;

    const name = file.name.replace(/\.(txt|md|docx)$/i, "") || "Imported Document";
    let document = "";

    try {
      if (file.name.endsWith(".docx")) {
        const mammoth = await import("mammoth");
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        document = result.value || "";
      } else {
        document = await file.text();
      }

      return handleNewProject(name, document);
    } catch (error) {
      console.error("[Labs] Failed to import document:", error);
      throw error;
    }
  }, [handleNewProject]);

  /**
   * Delete a project
   */
  const handleDeleteProject = useCallback((projectId) => {
    setProjects(prev => {
      const filtered = prev.filter(p => p.id !== projectId);
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
   * Update document content
   */
  const handleUpdateDocument = useCallback((newDocument) => {
    if (!activeProjectId) return;
    setProjects(prev => prev.map(p =>
      p.id === activeProjectId
        ? {
          ...p,
          document: newDocument,
          updatedAt: Date.now(),
          modelId: p.modelId || currentModelId
        }
        : p
    ));
  }, [activeProjectId, currentModelId]);

  /**
   * AI edit - uses project's sessionId for Flowise memory
   */
  const handleAIEdit = useCallback(async (instruction, modelIdForAI) => {
    if (!activeProject) return null;

    setIsProcessing(true);
    console.log(`[Labs] AI Edit - Project: ${activeProject.id}, Session: ${activeProject.sessionId}`);

    try {
      const response = await fetch("/labs-edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          document: activeProject.document,
          instruction,
          modelId: modelIdForAI,
          sessionId: activeProject.sessionId // Uses unique session per project
        })
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(errorText || `Request failed (${response.status})`);
      }

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
   * Force save to localStorage
   */
  const forceSync = useCallback(() => {
    saveAllProjects(projects);
  }, [projects]);

  return {
    projects: projectList,
    activeProject,
    activeProjectId,
    setActiveProjectId: handleSelectProject,
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
