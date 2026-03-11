import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { trackOnboardingEvent, getOnboardingAnalyticsSummary, getAppSetting, setAppSetting, getCohortRetention } from "./db";
import { TRPCError } from "@trpc/server";

const VARIANT_OVERRIDE_KEY = "onboarding_variant_override";

export const onboardingRouter = router({
  /**
   * Track an onboarding event (public — works for anonymous users too)
   */
  track: publicProcedure
    .input(
      z.object({
        sessionId: z.string().min(1).max(64),
        eventType: z.enum([
          "tour_start",
          "tour_step",
          "tour_skip",
          "tour_complete",
          "feature_first_use",
          "tooltip_dismiss",
        ]),
        stepNumber: z.number().int().min(0).max(20).optional(),
        featureName: z.string().max(64).optional(),
        metadata: z.string().max(1024).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await trackOnboardingEvent(
        input.sessionId,
        input.eventType,
        ctx.user?.id ?? null,
        input.stepNumber ?? null,
        input.featureName ?? null,
        input.metadata ?? null
      );
      return { success: true };
    }),

  /**
   * Get the current variant override setting (public — frontend needs this before tour starts)
   */
  getVariantOverride: publicProcedure.query(async () => {
    const override = await getAppSetting(VARIANT_OVERRIDE_KEY);
    return { override: override as "quick_tour" | "full_tour" | null };
  }),

  /**
   * Set the variant override (admin only)
   * null = random assignment, "quick_tour" or "full_tour" = force that variant
   */
  setVariantOverride: protectedProcedure
    .input(
      z.object({
        variant: z.enum(["quick_tour", "full_tour"]).nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      }
      if (input.variant === null) {
        // Clear the override — set to empty string to indicate "random"
        await setAppSetting(VARIANT_OVERRIDE_KEY, "");
      } else {
        await setAppSetting(VARIANT_OVERRIDE_KEY, input.variant);
      }
      return { success: true, variant: input.variant };
    }),

  /**
   * Get onboarding analytics summary (admin only)
   */
  summary: protectedProcedure
    .input(
      z.object({
        days: z.number().int().min(1).max(365).default(30),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      }
      const days = input?.days ?? 30;
      const summary = await getOnboardingAnalyticsSummary(days);
      return summary;
    }),

  /**
   * Get cohort retention data (admin only)
   */
  cohortRetention: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
    }
    return getCohortRetention();
  }),

  /**
   * Export onboarding analytics as CSV (admin only)
   */
  exportCsv: protectedProcedure
    .input(
      z.object({
        days: z.number().int().min(1).max(365).default(30),
        type: z.enum(["funnel", "features", "pages", "tooltips", "variants", "velocity", "all"]),
      })
    )
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      }
      const summary = await getOnboardingAnalyticsSummary(input.days);
      if (!summary) {
        return { csv: "No data available", filename: `marketmind-analytics-${input.type}-${new Date().toISOString().split("T")[0]}.csv` };
      }
      const sections: string[] = [];

      if (input.type === "funnel" || input.type === "all") {
        sections.push("=== Onboarding Funnel ===");
        sections.push("Metric,Value");
        sections.push(`Tour Starts,${summary.tourStarts}`);
        sections.push(`Tour Completes,${summary.tourCompletes}`);
        sections.push(`Tour Skips,${summary.tourSkips}`);
        sections.push(`Completion Rate,${summary.completionRate}%`);
        sections.push(`Avg Skip Step,${summary.avgSkipStep}`);
        sections.push("");
        sections.push("Step,Sessions");
        for (const s of summary.stepFunnel) {
          sections.push(`Step ${s.step},${s.sessions}`);
        }
        sections.push("");
      }

      if (input.type === "features" || input.type === "all") {
        sections.push("=== Feature First Use ===");
        sections.push("Feature,Sessions");
        for (const f of summary.featureUsage) {
          sections.push(`"${f.feature}",${f.sessions}`);
        }
        sections.push("");
      }

      if (input.type === "pages" || input.type === "all") {
        sections.push("=== Page Discovery ===");
        sections.push("Page,Sessions");
        for (const p of summary.pageDiscovery) {
          sections.push(`"${p.page}",${p.sessions}`);
        }
        sections.push("");
      }

      if (input.type === "tooltips" || input.type === "all") {
        sections.push("=== Tooltip Dismissals ===");
        sections.push("Tooltip,Count");
        for (const t of summary.tooltipDismissals) {
          sections.push(`"${t.tooltip}",${t.count}`);
        }
        sections.push("");
      }

      if (input.type === "variants" || input.type === "all") {
        sections.push("=== A/B Test Variant Comparison ===");
        sections.push("Variant,Starts,Completes,Skips,Completion Rate");
        for (const v of summary.variantComparison) {
          sections.push(`"${v.variant}",${v.starts},${v.completes},${v.skips},${v.completionRate}%`);
        }
        sections.push("");
      }

      if (input.type === "velocity" || input.type === "all") {
        const cv = summary.conversionVelocity;
        sections.push("=== Conversion Velocity ===");
        sections.push("Metric,Value");
        sections.push(`Avg Seconds to First Action,${cv.avgSeconds}`);
        sections.push(`Median Seconds to First Action,${cv.medianSeconds}`);
        sections.push(`Total Converted Users,${cv.totalConverted}`);
        sections.push("");
        sections.push("First Action,Count,Avg Seconds");
        for (const a of cv.actions) {
          sections.push(`"${a.action}",${a.count},${a.avgSeconds}`);
        }
        sections.push("");
      }

      if (input.type === "all") {
        sections.push("=== Daily Events (Last 14 Days) ===");
        sections.push("Date,Event Type,Count");
        for (const d of summary.daily) {
          sections.push(`${d.day},"${d.eventType}",${d.count}`);
        }
      }

      return { csv: sections.join("\n"), filename: `marketmind-analytics-${input.type}-${new Date().toISOString().split("T")[0]}.csv` };
    }),
});
