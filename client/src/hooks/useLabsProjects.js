import { useEffect, useMemo, useState, useCallback } from "react";

const STORAGE_KEY = "labs_projects";

/**
 * Load projects from localStorage
 */
function loadProjects() {
  const raw = localStorage.getItem(STORAGE_KEY);
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
 * Save projects to localStorage
 */
function saveProjects(projects) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  } catch (error) {
    console.error("[Labs] Failed to save projects:", error);
  }
}

/**
 * Create a new project with empty document
 */
function createProject(name = "Untitled Project") {
  return {
    id: crypto.randomUUID(),
    name,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    document: ""
  };
}

/**
 * Hook for managing Labs projects with localStorage persistence.
 * Provides CRUD operations and auto-save functionality.
 */
export function useLabsProjects() {
  const [projects, setProjects] = useState(() => loadProjects());
  const [activeProjectId, setActiveProjectId] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // Persist projects to localStorage on change
  useEffect(() => {
    saveProjects(projects);
  }, [projects]);

  // Auto-select first project or create one if none exist
  useEffect(() => {
    if (projects.length === 0) {
      const fresh = createProject();
      setProjects([fresh]);
      setActiveProjectId(fresh.id);
    } else if (!activeProjectId || !projects.find(p => p.id === activeProjectId)) {
      setActiveProjectId(projects[0].id);
    }
  }, [projects, activeProjectId]);

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
  const handleNewProject = useCallback((name = "Untitled Project") => {
    const fresh = createProject(name);
    setProjects(prev => [fresh, ...prev]);
    setActiveProjectId(fresh.id);
    return fresh;
  }, []);

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
  const handleAIEdit = useCallback(async (instruction, modelId) => {
    if (!activeProject) return null;

    setIsProcessing(true);

    try {
      const response = await fetch("/labs-edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          document: activeProject.document,
          instruction,
          modelId
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

      // Update project with new document
      if (fullContent) {
        handleUpdateDocument(fullContent);
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
    saveProjects(projects);
  }, [projects]);

  return {
    projects: projectList,
    activeProject,
    activeProjectId,
    setActiveProjectId,
    isProcessing,
    handleNewProject,
    handleDeleteProject,
    handleRenameProject,
    handleUpdateDocument,
    handleAIEdit,
    forceSync
  };
}
