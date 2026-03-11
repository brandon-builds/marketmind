import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";

export type OnboardingVariant = "full_tour" | "quick_tour";

const VARIANT_KEY = "mm_onboarding_variant";

/**
 * Assigns and persists an A/B test variant for the onboarding tour.
 * First checks for an admin-set override from the server.
 * If no override, uses localStorage for persistence.
 * New users are randomly assigned 50/50 to either "full_tour" (12 steps)
 * or "quick_tour" (6 steps).
 */
export function useOnboardingVariant(): OnboardingVariant {
  const { data: overrideData } = trpc.onboarding.getVariantOverride.useQuery(undefined, {
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: 1,
  });

  const [variant, setVariant] = useState<OnboardingVariant>(() => {
    try {
      const stored = localStorage.getItem(VARIANT_KEY);
      if (stored === "full_tour" || stored === "quick_tour") {
        return stored;
      }
      // Random 50/50 assignment
      const assigned: OnboardingVariant = Math.random() < 0.5 ? "full_tour" : "quick_tour";
      localStorage.setItem(VARIANT_KEY, assigned);
      return assigned;
    } catch {
      return "full_tour";
    }
  });

  // If admin has set an override, use it (overrides localStorage)
  useEffect(() => {
    if (overrideData?.override && (overrideData.override === "full_tour" || overrideData.override === "quick_tour")) {
      setVariant(overrideData.override);
      try {
        localStorage.setItem(VARIANT_KEY, overrideData.override);
      } catch {
        // Ignore
      }
    }
  }, [overrideData]);

  return variant;
}
