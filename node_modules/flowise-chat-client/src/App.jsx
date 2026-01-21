import { useEffect, useRef, useState } from "react";
import ChatSidebar from "./components/ChatSidebar.jsx";
import ChatArea from "./components/ChatArea.jsx";
import { useChatSession } from "./hooks/useChatSession.js";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [theme, setTheme] = useState(
    () => {
      const stored = localStorage.getItem("flowise_theme");
      if (stored === "light" || stored === "dark") return stored;
      const prefersLight =
        typeof window !== "undefined" &&
        window.matchMedia?.("(prefers-color-scheme: light)")?.matches;
      return prefersLight ? "light" : "dark";
    }
  );
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const {
    models,
    selectedModelId,
    setSelectedModelId,
    selectedModel,
    modelsIssues,
    isModelsLoading,
    modelsError,
    reloadModels,
    mode,
    activeSession,
    activeSessionId,
    setActiveSessionId,
    message,
    setMessage,
    isStreaming,
    handleNewChat,
    handleClearHistory,
    handleModeChange,
    handleSend,
    historyList,
    MODES,
    ACTIVITY_LABELS
  } = useChatSession();

  const handleNewChatRef = useRef(handleNewChat);
  useEffect(() => {
    handleNewChatRef.current = handleNewChat;
  }, [handleNewChat]);

  useEffect(() => {
    document.documentElement.classList.toggle("light", theme === "light");
    localStorage.setItem("flowise_theme", theme);
  }, [theme]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        handleNewChatRef.current?.();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Handle responsive sidebar
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setSidebarOpen(false);
      } else {
        setSidebarOpen(true);
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="relative flex h-screen w-full overflow-hidden bg-background">
      {/* Background Layer - Pure Neutral */}
      <div className="pointer-events-none absolute inset-0 bg-background" />

      <ChatSidebar
        open={sidebarOpen}
        setOpen={setSidebarOpen}
        models={models}
        selectedModelId={selectedModelId}
        onSelectModel={setSelectedModelId}
        isModelsLoading={isModelsLoading}
        modelsError={modelsError}
        modelsIssues={modelsIssues}
        onReloadModels={reloadModels}
        mode={mode}
        modes={MODES}
        onModeChange={handleModeChange}
        onNewChat={handleNewChat}
        onClearHistory={handleClearHistory}
        historyList={historyList}
        activeSessionId={activeSessionId}
        onSelectSession={setActiveSessionId}
        theme={theme}
        onToggleTheme={() =>
          setTheme((prev) => (prev === "dark" ? "light" : "dark"))
        }
      />

      <main className={cn(
        "relative flex-1 flex flex-col transition-all duration-300 ease-in-out h-full",
        sidebarOpen ? "md:ml-[280px]" : "ml-0"
      )}>
        <ChatArea
          activeSession={activeSession}
          isStreaming={isStreaming}
          message={message}
          onMessageChange={setMessage}
          onSend={handleSend}
          onSelectFollowUp={setMessage}
          activityLabels={ACTIVITY_LABELS}
          toggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          sidebarOpen={sidebarOpen}
          features={selectedModel?.features || { uploads: false, stt: false }}
        />
      </main>
    </div>
  );
}
