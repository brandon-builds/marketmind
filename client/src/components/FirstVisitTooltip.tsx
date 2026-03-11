import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Lightbulb } from "lucide-react";
import { useOnboardingAnalytics } from "@/hooks/useOnboardingAnalytics";

interface FirstVisitTooltipProps {
  /** Unique key for localStorage persistence */
  storageKey: string;
  /** Main title */
  title: string;
  /** Description of what the page/tool does */
  description: string;
  /** Bullet points for how to use it */
  tips: string[];
  /** Optional accent color class */
  accentColor?: string;
  /** Optional icon override */
  icon?: React.ReactNode;
  /** Delay before showing (ms) */
  delay?: number;
}

export function FirstVisitTooltip({
  storageKey,
  title,
  description,
  tips,
  accentColor = "primary",
  icon,
  delay = 600,
}: FirstVisitTooltipProps) {
  const fullKey = `fvt_${storageKey}`;
  const [visible, setVisible] = useState(false);
  const analytics = useOnboardingAnalytics();

  useEffect(() => {
    const dismissed = localStorage.getItem(fullKey);
    if (!dismissed) {
      const timer = setTimeout(() => setVisible(true), delay);
      return () => clearTimeout(timer);
    }
  }, [fullKey, delay]);

  const dismiss = () => {
    setVisible(false);
    localStorage.setItem(fullKey, "true");
    analytics.trackTooltipDismiss(storageKey);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.98 }}
          transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="mb-4"
        >
          <div
            className="relative rounded-xl border border-border/30 overflow-hidden"
            style={{
              background: "var(--card)",
              boxShadow: "0 4px 24px oklch(0 0 0 / 6%), 0 0 0 1px var(--border)",
            }}
          >
            {/* Top accent line */}
            <div
              className={`h-[2px] bg-gradient-to-r ${
                accentColor === "primary"
                  ? "from-primary to-purple-500"
                  : accentColor === "emerald"
                    ? "from-emerald-500 to-teal-500"
                    : accentColor === "amber"
                      ? "from-amber-500 to-orange-500"
                      : accentColor === "cyan"
                        ? "from-cyan-500 to-blue-500"
                        : "from-primary to-purple-500"
              } opacity-60`}
            />

            <div className="p-4 sm:p-5">
              <div className="flex items-start gap-3">
                {/* Icon */}
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                    accentColor === "primary"
                      ? "bg-primary/10"
                      : accentColor === "emerald"
                        ? "bg-emerald-500/10"
                        : accentColor === "amber"
                          ? "bg-amber-500/10"
                          : accentColor === "cyan"
                            ? "bg-cyan-500/10"
                            : "bg-primary/10"
                  }`}
                >
                  {icon || (
                    <Lightbulb
                      className={`w-4.5 h-4.5 ${
                        accentColor === "primary"
                          ? "text-primary"
                          : accentColor === "emerald"
                            ? "text-emerald-400"
                            : accentColor === "amber"
                              ? "text-amber-400"
                              : accentColor === "cyan"
                                ? "text-cyan-400"
                                : "text-primary"
                      }`}
                    />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[9px] uppercase tracking-widest font-semibold text-primary/60">
                      First time here?
                    </span>
                  </div>
                  <h4 className="font-display text-sm font-bold text-foreground mb-1">
                    {title}
                  </h4>
                  <p className="text-xs text-muted-foreground/70 leading-relaxed mb-3">
                    {description}
                  </p>

                  {/* Tips */}
                  {tips.length > 0 && (
                    <div className="space-y-1.5">
                      {tips.map((tip, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <span className="text-[10px] font-mono font-bold text-primary/50 mt-0.5 shrink-0">
                            {i + 1}.
                          </span>
                          <span className="text-[11px] text-muted-foreground/60 leading-relaxed">
                            {tip}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Dismiss button */}
                <button
                  onClick={dismiss}
                  className="p-1.5 rounded-lg text-muted-foreground/30 hover:text-foreground hover:bg-muted/30 transition-all shrink-0"
                  title="Dismiss"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Got it button */}
              <div className="mt-4 flex justify-end">
                <button
                  onClick={dismiss}
                  className="px-4 py-1.5 rounded-lg text-[11px] font-display font-semibold bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                >
                  Got it
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
