import { useEffect, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { useTheme } from "@/contexts/ThemeContext";
import { motion, AnimatePresence } from "framer-motion";
import { Keyboard, X, Command } from "lucide-react";

const PAGE_SHORTCUTS: Record<string, string> = {
  "1": "/",
  "2": "/narratives",
  "3": "/predictions",
  "4": "/model-performance",
  "5": "/data-sources",
  "6": "/compare",
  "7": "/watchlist",
  "8": "/backtest",
  "9": "/portfolio",
};

const PAGE_LABELS: Record<string, string> = {
  "1": "Dashboard",
  "2": "Narratives",
  "3": "Predictions",
  "4": "Model Performance",
  "5": "Data Sources",
  "6": "Compare",
  "7": "Watchlist",
  "8": "Backtest",
  "9": "Portfolio",
};

interface ShortcutGroup {
  title: string;
  shortcuts: { keys: string[]; description: string }[];
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: "Navigation",
    shortcuts: [
      { keys: ["1"], description: "Go to Dashboard" },
      { keys: ["2"], description: "Go to Narratives" },
      { keys: ["3"], description: "Go to Predictions" },
      { keys: ["4"], description: "Go to Model Performance" },
      { keys: ["5"], description: "Go to Data Sources" },
      { keys: ["6"], description: "Go to Compare" },
      { keys: ["7"], description: "Go to Watchlist" },
      { keys: ["8"], description: "Go to Backtest" },
      { keys: ["9"], description: "Go to Portfolio" },
    ],
  },
  {
    title: "Actions",
    shortcuts: [
      { keys: ["/"], description: "Focus search" },
      { keys: ["⌘", "K"], description: "Focus search (alt)" },
      { keys: ["T"], description: "Toggle dark/light theme" },
      { keys: ["?"], description: "Show keyboard shortcuts" },
      { keys: ["Esc"], description: "Close modal / blur search" },
    ],
  },
];

export function useKeyboardShortcuts() {
  const [, navigate] = useLocation();
  const { toggleTheme } = useTheme();
  const [showHelp, setShowHelp] = useState(false);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable;

      if (isInput) return;

      // Don't trigger on modifier combos (except Cmd+K which is handled by GlobalSearch)
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      // `/` — Focus search
      if (e.key === "/") {
        e.preventDefault();
        const searchInput = document.querySelector(
          'input[placeholder="Search tickers..."]'
        ) as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
        }
        return;
      }

      // `?` — Show keyboard shortcuts help
      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        e.preventDefault();
        setShowHelp((prev) => !prev);
        return;
      }

      // `T` — Toggle theme
      if (e.key === "t" || e.key === "T") {
        e.preventDefault();
        toggleTheme?.();
        return;
      }

      // `Escape` — Close help modal
      if (e.key === "Escape") {
        setShowHelp(false);
        return;
      }

      // `1-9` — Navigate to pages
      if (PAGE_SHORTCUTS[e.key]) {
        e.preventDefault();
        navigate(PAGE_SHORTCUTS[e.key]);
        return;
      }
    },
    [navigate, toggleTheme]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Listen for custom event from AppHeader button
  useEffect(() => {
    const handler = () => setShowHelp((prev) => !prev);
    window.addEventListener("toggle-shortcuts-modal", handler);
    return () => window.removeEventListener("toggle-shortcuts-modal", handler);
  }, []);

  return { showHelp, setShowHelp };
}

interface KeyboardShortcutsModalProps {
  open: boolean;
  onClose: () => void;
}

export function KeyboardShortcutsModal({
  open,
  onClose,
}: KeyboardShortcutsModalProps) {
  // Close on escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[90vw] max-w-lg"
          >
            <div className="bg-card/95 backdrop-blur-2xl border border-border/30 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-border/20">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Keyboard className="w-4.5 h-4.5 text-primary" />
                  </div>
                  <div>
                    <h2 className="font-display text-base font-bold text-foreground">
                      Keyboard Shortcuts
                    </h2>
                    <p className="text-[11px] text-muted-foreground/60">
                      Navigate faster with your keyboard
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Content */}
              <div className="px-6 py-4 max-h-[60vh] overflow-y-auto space-y-5">
                {SHORTCUT_GROUPS.map((group) => (
                  <div key={group.title}>
                    <h3 className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/40 font-semibold mb-2.5">
                      {group.title}
                    </h3>
                    <div className="space-y-1">
                      {group.shortcuts.map((shortcut, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-muted/10 transition-colors"
                        >
                          <span className="text-xs text-foreground/80">
                            {shortcut.description}
                          </span>
                          <div className="flex items-center gap-1">
                            {shortcut.keys.map((key, j) => (
                              <span key={j}>
                                {j > 0 && (
                                  <span className="text-[9px] text-muted-foreground/30 mx-0.5">
                                    +
                                  </span>
                                )}
                                <kbd className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded-md bg-muted/20 border border-border/25 text-[11px] font-mono font-medium text-foreground/70 shadow-sm">
                                  {key}
                                </kbd>
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="px-6 py-3 border-t border-border/15 bg-muted/5">
                <p className="text-[10px] text-muted-foreground/40 text-center">
                  Press{" "}
                  <kbd className="px-1.5 py-0.5 rounded bg-muted/20 border border-border/20 font-mono text-[10px]">
                    ?
                  </kbd>{" "}
                  anytime to toggle this reference
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/** Drop-in button for the header that opens the shortcuts modal */
export function KeyboardShortcutHint({
  onClick,
}: {
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="hidden md:flex w-8 h-8 rounded-lg items-center justify-center text-muted-foreground/40 hover:text-foreground hover:bg-muted/20 transition-all"
      title="Keyboard shortcuts (?)"
    >
      <Command className="w-3.5 h-3.5" />
    </button>
  );
}
