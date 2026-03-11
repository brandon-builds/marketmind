import { useCallback, useRef } from "react";
import { trpc } from "@/lib/trpc";

/**
 * Generate a random session ID for anonymous tracking.
 * Persisted in sessionStorage so it survives page reloads within the same tab.
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
 * Get the stored onboarding variant for metadata tagging.
 */
function getVariant(): string {
  try {
    return localStorage.getItem("mm_onboarding_variant") || "unknown";
  } catch {
    return "unknown";
  }
}

type EventType =
  | "tour_start"
  | "tour_step"
  | "tour_skip"
  | "tour_complete"
  | "feature_first_use"
  | "tooltip_dismiss";

/**
 * Hook that provides onboarding analytics tracking functions.
 * All tracking is fire-and-forget — errors are silently swallowed.
 * Automatically includes the A/B test variant in all event metadata.
 */
export function useOnboardingAnalytics() {
  const trackMutation = trpc.onboarding.track.useMutation();
  const trackedFeatures = useRef<Set<string>>(new Set());

  const track = useCallback(
    (
      eventType: EventType,
      opts?: {
        stepNumber?: number;
        featureName?: string;
        metadata?: Record<string, unknown>;
      }
    ) => {
      try {
        const variant = getVariant();
        const metadataWithVariant = {
          ...(opts?.metadata || {}),
          variant,
        };
        trackMutation.mutate({
          sessionId: getSessionId(),
          eventType,
          stepNumber: opts?.stepNumber,
          featureName: opts?.featureName,
          metadata: JSON.stringify(metadataWithVariant),
        });
      } catch {
        // Fire and forget
      }
    },
    [trackMutation]
  );

  const trackTourStart = useCallback(() => {
    track("tour_start");
  }, [track]);

  const trackTourStep = useCallback(
    (stepNumber: number, featureName?: string) => {
      track("tour_step", { stepNumber, featureName });
    },
    [track]
  );

  const trackTourSkip = useCallback(
    (stepNumber: number) => {
      track("tour_skip", { stepNumber });
    },
    [track]
  );

  const trackTourComplete = useCallback(() => {
    track("tour_complete");
  }, [track]);

  const trackFeatureFirstUse = useCallback(
    (featureName: string) => {
      // Only track each feature once per session
      if (trackedFeatures.current.has(featureName)) return;
      trackedFeatures.current.add(featureName);

      const storageKey = `mm_ffu_${featureName}`;
      try {
        if (localStorage.getItem(storageKey)) return;
        localStorage.setItem(storageKey, "true");
      } catch {
        // Continue tracking even if localStorage fails
      }

      track("feature_first_use", { featureName });
    },
    [track]
  );

  const trackTooltipDismiss = useCallback(
    (tooltipName: string) => {
      track("tooltip_dismiss", { featureName: tooltipName });
    },
    [track]
  );

  return {
    trackTourStart,
    trackTourStep,
    trackTourSkip,
    trackTourComplete,
    trackFeatureFirstUse,
    trackTooltipDismiss,
  };
}
