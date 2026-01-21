import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare,
  Plus,
  Trash2,
  Moon,
  Sun,
  Bot,
  History
} from "lucide-react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export default function ChatSidebar({
  open,
  setOpen,
  models,
  selectedModelId,
  onSelectModel,
  isModelsLoading,
  modelsError,
  modelsIssues,
  onReloadModels,
  mode,
  modes,
  onModeChange,
  onNewChat,
  onClearHistory,
  historyList,
  activeSessionId,
  onSelectSession,
  theme,
  onToggleTheme,
}) {
  const selectedModel = models?.find((item) => item.id === selectedModelId);
  const uploadsStatus = selectedModel?.features?.status || "unknown";
  const uploadsEnabled = Boolean(selectedModel?.features?.uploads);

  return (
    <AnimatePresence mode="wait">
      {open && (
        <>
          <motion.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/40 md:hidden"
            onClick={() => setOpen?.(false)}
            aria-label="Close sidebar overlay"
          />
          <motion.aside
            initial={{ x: -300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -300, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="fixed left-0 top-0 bottom-0 z-50 w-[280px] border-r border-border bg-background flex flex-col p-4 shadow-2xl"
          >
            {/* Header & Logo */}
            <div className="flex items-center justify-between mb-6 px-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-cyan-500 flex items-center justify-center text-white font-bold">
                  <Bot size={20} />
                </div>
                <h1 className="text-xl font-display font-bold bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/60">
                  Vector
                </h1>
              </div>
              <button
                onClick={() => setOpen?.(false)}
                className="md:hidden p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                aria-label="Close sidebar"
              >
                <span className="text-lg leading-none">×</span>
              </button>
            </div>

            {/* New Chat Button */}
            <button
              onClick={onNewChat}
              className="group flex items-center gap-3 w-full px-4 py-3 rounded-xl bg-foreground/5 hover:bg-foreground/8 border border-border transition-all mb-6 text-sm font-medium hover:shadow-lg hover:shadow-cyan-500/10 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <div className="bg-cyan-500/20 p-1.5 rounded-lg text-cyan-400 group-hover:text-white group-hover:bg-cyan-500 transition-colors">
                <Plus size={18} />
              </div>
              <span>New Thread</span>
              <div className="ml-auto text-xs text-muted-foreground border border-border rounded px-1.5 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                Ctrl+N
              </div>
            </button>

            {/* Modes */}
            <div className="space-y-4 mb-6">
              <div className="px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                <span>Mode</span>
              </div>
              <div className="grid grid-cols-2 gap-2 p-1 bg-foreground/5 rounded-lg border border-border">
                {modes.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => onModeChange(item.id)}
                    className={cn(
                      "flex items-center justify-center px-3 py-2 rounded-md text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                      mode === item.id
                        ? "bg-foreground/10 text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Models Selection */}
            <div className="mb-6 space-y-2">
              <div className="px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                <span>Model</span>
                <button
                  type="button"
                  onClick={onReloadModels}
                  className="text-[11px] font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 rounded px-1"
                >
                  Refresh
                </button>
              </div>
              <div className="relative">
                <select
                  className="w-full appearance-none bg-foreground/5 text-foreground text-sm rounded-lg pl-3 pr-8 py-2.5 border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 transition-all hover:bg-foreground/8 disabled:opacity-60"
                  value={selectedModelId}
                  onChange={(e) => onSelectModel(e.target.value)}
                  disabled={isModelsLoading || !models?.length}
                >
                  {isModelsLoading && (
                    <option value="" className="bg-background">
                      Loading models…
                    </option>
                  )}
                  {!isModelsLoading && models?.length > 0 && (
                    <>
                      <option value="" disabled className="bg-background">
                        Select a model
                      </option>
                      {models.map((m) => (
                        <option key={m.id} value={m.id} className="bg-background">
                          {m.name}
                        </option>
                      ))}
                    </>
                  )}
                  {!isModelsLoading && !models?.length && (
                    <option value="" className="bg-background">
                      No models configured
                    </option>
                  )}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
                  <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>
              {selectedModel && (
                <div className="px-2 flex items-center gap-2 text-[11px]">
                  <span className={cn(
                    "inline-flex items-center rounded-full border px-2 py-0.5 font-medium",
                    uploadsStatus === "ok"
                      ? uploadsEnabled
                        ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
                        : "border-border text-muted-foreground bg-foreground/5"
                      : "border-amber-500/40 text-amber-400 bg-amber-500/10"
                  )}>
                    {uploadsStatus === "ok"
                      ? uploadsEnabled
                        ? "Uploads enabled"
                        : "Uploads off"
                      : "Uploads unknown"}
                  </span>
                </div>
              )}
              {(modelsError || (modelsIssues && modelsIssues.length > 0) || (!isModelsLoading && !models?.length)) && (
                <div className="px-2 text-xs text-muted-foreground space-y-1">
                  {modelsError && <div className="text-destructive">{modelsError}</div>}
                  {!modelsError && !isModelsLoading && !models?.length && (
                    <div>
                      Add MODEL_1_NAME / MODEL_1_ID / MODEL_1_HOST to your environment.
                    </div>
                  )}
                  {modelsIssues?.slice(0, 3).map((issue) => (
                    <div key={issue}>{issue}</div>
                  ))}
                </div>
              )}
            </div>

            {/* History List */}
            <div className="flex-1 overflow-y-auto -mx-2 px-2 custom-scrollbar">
              <div className="mb-2 px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <History size={12} />
                Recent
              </div>
              <div className="space-y-1">
                {historyList.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground/70 gap-2">
                    <MessageSquare size={24} className="opacity-20" />
                    <span className="text-xs">No history yet</span>
                  </div>
                ) : (
                  historyList.map((session) => (
                    <button
                      key={session.id}
                      onClick={() => onSelectSession(session.id)}
                      className={cn(
                        "w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all group flex items-center gap-3 relative overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                        activeSessionId === session.id
                          ? "bg-foreground/10 text-foreground shadow-sm border border-border"
                          : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                      )}
                    >
                      <MessageSquare size={16} className={cn(
                        "shrink-0 transition-colors",
                        activeSessionId === session.id ? "text-cyan-500" : "text-muted-foreground/70 group-hover:text-muted-foreground"
                      )} />
                      <span className="truncate flex-1 z-10 relative">{session.title || "New Thread"}</span>
                      {activeSessionId === session.id && (
                        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 to-transparent pointer-events-none" />
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Footer Actions */}
            <div className="pt-4 mt-4 border-t border-border space-y-2">
              <button
                onClick={onClearHistory}
                className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <Trash2 size={16} className="group-hover:animate-bounce" />
                <span>Clear History</span>
              </button>
              <button
                onClick={onToggleTheme}
                className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-foreground/5 hover:text-foreground transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
                <span>{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>
              </button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
