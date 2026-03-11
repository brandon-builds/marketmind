import { useState, useEffect } from "react";
import { GraduationCap, X } from "lucide-react";

const SKIPPED_KEY = "mm_onboarding_skipped";
const SESSION_COUNT_KEY = "mm_reengagement_sessions";
const DISMISSED_KEY = "mm_reengagement_dismissed";
const MAX_SESSIONS = 3;

/**
 * Shows a subtle "Resume Tour" button in the header for users who skipped
 * the onboarding tour. Auto-dismisses after 3 sessions or when manually closed.
 */
export function TourReengagement() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      // Only show if user skipped the tour
      const skipped = localStorage.getItem(SKIPPED_KEY);
      const completed = localStorage.getItem("mm_onboarding_complete");
      const dismissed = localStorage.getItem(DISMISSED_KEY);

      if (!skipped || completed || dismissed) return;

      // Track session count
      const sessionCount = parseInt(localStorage.getItem(SESSION_COUNT_KEY) || "0", 10) + 1;
      localStorage.setItem(SESSION_COUNT_KEY, String(sessionCount));

      // Auto-dismiss after MAX_SESSIONS
      if (sessionCount > MAX_SESSIONS) {
        localStorage.setItem(DISMISSED_KEY, "true");
        return;
      }

      setShow(true);
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  const handleResume = () => {
    // Clear the skipped flag and onboarding-seen flag to restart the tour
    try {
      localStorage.removeItem(SKIPPED_KEY);
      localStorage.removeItem("mm_onboarding_seen");
      localStorage.removeItem("mm_onboarding_complete");
    } catch {
      // Ignore
    }
    // Reload to trigger the onboarding tour
    window.location.reload();
  };

  const handleDismiss = () => {
    setShow(false);
    try {
      localStorage.setItem(DISMISSED_KEY, "true");
    } catch {
      // Ignore
    }
  };

  if (!show) return null;

  return (
    <button
      onClick={handleResume}
      className="group relative flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-primary/30 bg-primary/5 hover:bg-primary/15 text-primary/70 hover:text-primary transition-all animate-in fade-in slide-in-from-top-2 duration-500"
      title="Resume the product tour"
    >
      <GraduationCap className="w-3.5 h-3.5" />
      <span className="text-[10px] font-medium hidden sm:inline">Resume Tour</span>
      <span
        onClick={(e) => {
          e.stopPropagation();
          handleDismiss();
        }}
        className="ml-0.5 w-4 h-4 rounded-full flex items-center justify-center hover:bg-primary/20 transition-colors opacity-0 group-hover:opacity-100"
        title="Dismiss"
      >
        <X className="w-2.5 h-2.5" />
      </span>
    </button>
  );
}
