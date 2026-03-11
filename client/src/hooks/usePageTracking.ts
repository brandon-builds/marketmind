import { useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";

const STORAGE_PREFIX = "mm_page_visited_";

/**
 * Generates or retrieves a persistent session ID for page tracking.
 */
function getSessionId(): string {
  const KEY = "mm_onboarding_session";
  try {
    let id = sessionStorage.getItem(KEY);
    if (!id) {
      id = `s_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      sessionStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return `s_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }
}

/**
 * Hook that tracks the first time a user visits a specific page.
 * Fires a "page_visit" event to the onboarding analytics backend
 * only on the first visit (persisted via localStorage).
 *
 * @param pageName - Unique identifier for the page (e.g., "home", "backtest", "model-weights")
 */
export function usePageTracking(pageName: string) {
  const trackMutation = trpc.onboarding.track.useMutation();
  const tracked = useRef(false);

  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;

    const storageKey = `${STORAGE_PREFIX}${pageName}`;
    try {
      const alreadyVisited = localStorage.getItem(storageKey);
      if (alreadyVisited) return;

      localStorage.setItem(storageKey, new Date().toISOString());

      trackMutation.mutate({
        sessionId: getSessionId(),
        eventType: "feature_first_use",
        featureName: `page:${pageName}`,
        metadata: JSON.stringify({ type: "page_discovery", timestamp: Date.now() }),
      });
    } catch {
      // Silently fail
    }
  }, [pageName]);
}
