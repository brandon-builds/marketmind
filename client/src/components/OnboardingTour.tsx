import { useState, useEffect, useCallback } from "react";
import { useOnboardingAnalytics } from "@/hooks/useOnboardingAnalytics";
import { useOnboardingVariant, type OnboardingVariant } from "@/hooks/useOnboardingVariant";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain,
  BarChart3,
  Zap,
  Target,
  FlaskConical,
  Briefcase,
  History,
  Database,
  ArrowRight,
  X,
  Sparkles,
  ChevronRight,
  Bell,
  Users,
  FileText,
  SlidersHorizontal,
  TrendingUp,
  Activity,
} from "lucide-react";

const ONBOARDING_KEY = "marketmind_onboarded_v2";

interface Feature {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  description: string;
  gradient: string;
  bgGlow: string;
  category: "core" | "new";
}

// Full 12-step feature list
const allFeatures: Feature[] = [
  {
    icon: <Activity className="w-7 h-7" />,
    title: "Intelligence Stream",
    subtitle: "Your Live Command Center",
    description:
      "The dashboard opens with a real-time activity feed — predictions, narrative shifts, alert triggers, and portfolio changes flow in chronologically. It's your market pulse at a glance.",
    gradient: "from-blue-500 to-indigo-500",
    bgGlow: "oklch(0.65 0.19 260 / 8%)",
    category: "new",
  },
  {
    icon: <Zap className="w-7 h-7" />,
    title: "Narrative Intelligence",
    subtitle: "AI-Extracted Market Themes",
    description:
      "AI extracts emerging market narratives from news, filings, and social signals — identifying themes like AI capex cycles, Fed policy shifts, and sector rotations before they hit mainstream.",
    gradient: "from-amber-500 to-orange-500",
    bgGlow: "oklch(0.82 0.171 83 / 8%)",
    category: "core",
  },
  {
    icon: <Target className="w-7 h-7" />,
    title: "Prediction Engine",
    subtitle: "Multi-Horizon Forecasts",
    description:
      "Multi-horizon predictions (1D, 7D, 30D) with calibrated confidence scores, specific price targets, and full reasoning chains. Every prediction is tracked and scored.",
    gradient: "from-purple-500 to-violet-500",
    bgGlow: "oklch(0.65 0.19 300 / 8%)",
    category: "core",
  },
  {
    icon: <SlidersHorizontal className="w-7 h-7" />,
    title: "Custom Model Weights",
    subtitle: "Personalize Your Predictions",
    description:
      "Adjust signal source weights — social sentiment, technical indicators, fundamental data, news volume — to create personalized prediction profiles. Watch predictions update in real time as you tune.",
    gradient: "from-fuchsia-500 to-pink-500",
    bgGlow: "oklch(0.65 0.20 330 / 8%)",
    category: "new",
  },
  {
    icon: <History className="w-7 h-7" />,
    title: "Backtesting Engine",
    subtitle: "Full Transparency",
    description:
      "See how predictions would have performed historically. Cumulative P&L charts, win rates by horizon, and per-ticker breakdowns — full transparency into model accuracy.",
    gradient: "from-cyan-500 to-blue-500",
    bgGlow: "oklch(0.65 0.19 240 / 8%)",
    category: "core",
  },
  {
    icon: <Briefcase className="w-7 h-7" />,
    title: "Portfolio Analysis",
    subtitle: "Holdings Intelligence",
    description:
      "Input your holdings and get aggregated prediction exposure, narrative sentiment, sector breakdown, and risk flags. Export to Schwab, Fidelity, or Interactive Brokers format.",
    gradient: "from-emerald-500 to-teal-500",
    bgGlow: "oklch(0.765 0.177 163 / 8%)",
    category: "core",
  },
  {
    icon: <Users className="w-7 h-7" />,
    title: "Collaborative Watchlists",
    subtitle: "Social Intelligence Layer",
    description:
      "Create shared watchlists, invite collaborators via link, and annotate tickers with bullish/bearish/neutral sentiment. See who's viewing in real time with live presence indicators.",
    gradient: "from-sky-500 to-cyan-500",
    bgGlow: "oklch(0.70 0.15 220 / 8%)",
    category: "new",
  },
  {
    icon: <TrendingUp className="w-7 h-7" />,
    title: "Watchlist Sparklines",
    subtitle: "Visual Price Trends",
    description:
      "Your watchlist now shows 7-day and 30-day sparkline charts alongside each ticker — instantly see price trends, live prices, and day changes in a beautiful card grid.",
    gradient: "from-green-500 to-emerald-500",
    bgGlow: "oklch(0.75 0.16 150 / 8%)",
    category: "new",
  },
  {
    icon: <Bell className="w-7 h-7" />,
    title: "Smart Alerts & Notifications",
    subtitle: "Never Miss a Signal",
    description:
      "Set price threshold alerts and narrative-based triggers (e.g., 'notify me when bearish sentiment mentions NVDA'). All alerts aggregate in the notification center with unread badges.",
    gradient: "from-rose-500 to-red-500",
    bgGlow: "oklch(0.645 0.246 16 / 8%)",
    category: "new",
  },
  {
    icon: <FileText className="w-7 h-7" />,
    title: "Automated Reports",
    subtitle: "Weekly Intelligence Briefs",
    description:
      "Weekly reports are auto-generated with portfolio performance, prediction accuracy, and market highlights. Download anytime from the Reports page, or generate on demand.",
    gradient: "from-violet-500 to-purple-500",
    bgGlow: "oklch(0.60 0.20 290 / 8%)",
    category: "new",
  },
  {
    icon: <Database className="w-7 h-7" />,
    title: "14 Data Sources",
    subtitle: "Comprehensive Coverage",
    description:
      "From Bloomberg Terminal feeds to Reddit sentiment, SEC filings to options flow — every source is monitored for quality and ranked by signal accuracy.",
    gradient: "from-orange-500 to-red-500",
    bgGlow: "oklch(0.70 0.20 40 / 8%)",
    category: "core",
  },
  {
    icon: <FlaskConical className="w-7 h-7" />,
    title: "Autoresearch Loop",
    subtitle: "Self-Improving AI",
    description:
      "The system continuously improves itself. Experiments run, accuracy is measured, and the model evolves — you can watch the improvement in real time on the Model Performance page.",
    gradient: "from-teal-400 to-cyan-500",
    bgGlow: "oklch(0.70 0.15 180 / 8%)",
    category: "core",
  },
];

// Quick tour: 6 essential features (indices 0, 1, 2, 7, 8, 11)
const quickTourIndices = [0, 1, 2, 7, 8, 11]; // Intelligence Stream, Narratives, Predictions, Sparklines, Alerts, Autoresearch
const quickFeatures: Feature[] = quickTourIndices.map((i) => allFeatures[i]);

export function OnboardingTour() {
  const [isVisible, setIsVisible] = useState(false);
  const [step, setStep] = useState(0); // 0 = welcome, 1-N = features, N+1 = ready
  const analytics = useOnboardingAnalytics();
  const variant = useOnboardingVariant();

  const features = variant === "quick_tour" ? quickFeatures : allFeatures;

  useEffect(() => {
    const seen = localStorage.getItem(ONBOARDING_KEY);
    if (!seen) {
      const timer = setTimeout(() => {
        setIsVisible(true);
        analytics.trackTourStart();
      }, 800);
      return () => clearTimeout(timer);
    }
  }, []);

  const dismiss = useCallback(() => {
    setIsVisible(false);
    localStorage.setItem(ONBOARDING_KEY, "true");
    localStorage.setItem("onboarding-complete", "true");
    if (step === features.length + 1) {
      analytics.trackTourComplete();
    }
  }, [step, analytics, features.length]);

  const next = useCallback(() => {
    if (step >= features.length + 1) {
      dismiss();
    } else {
      const nextStep = step + 1;
      if (nextStep >= 1 && nextStep <= features.length) {
        analytics.trackTourStep(nextStep, features[nextStep - 1].title);
      }
      setStep((s) => s + 1);
    }
  }, [step, dismiss, analytics, features]);

  const prev = useCallback(() => {
    if (step > 0) setStep((s) => s - 1);
  }, [step]);

  const skip = useCallback(() => {
    analytics.trackTourSkip(step);
    // Mark as skipped for re-engagement prompt
    try { localStorage.setItem("mm_onboarding_skipped", "true"); } catch {}
    dismiss();
  }, [dismiss, step, analytics]);

  if (!isVisible) return null;

  const totalSteps = features.length + 2; // welcome + features + ready
  const progress = ((step + 1) / totalSteps) * 100;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={skip}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          />

          {/* Modal */}
          <motion.div
            className="relative w-full max-w-lg mx-4 rounded-2xl overflow-hidden"
            style={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              boxShadow:
                "0 0 0 1px var(--border), 0 25px 50px oklch(0 0 0 / 15%), 0 0 80px oklch(0.55 0.22 260 / 8%)",
            }}
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            key={step}
          >
            {/* Progress bar */}
            <div className="h-[2px] bg-border/20">
              <motion.div
                className="h-full bg-gradient-to-r from-primary via-purple-500 to-emerald-400"
                initial={{ width: `${((step) / totalSteps) * 100}%` }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              />
            </div>

            {/* Close button */}
            <button
              onClick={skip}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-muted-foreground/50 hover:text-foreground hover:bg-accent/50 transition-colors z-10"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Step counter */}
            {step > 0 && step <= features.length && (
              <div className="absolute top-4 left-6 flex items-center gap-2">
                <span className="text-[10px] font-mono text-muted-foreground/40 tracking-wider">
                  {step} / {features.length}
                </span>
                {variant === "quick_tour" && (
                  <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary/60 uppercase tracking-wider">
                    Quick Tour
                  </span>
                )}
              </div>
            )}

            {/* Content */}
            <div className="p-8">
              <AnimatePresence mode="wait">
                {step === 0 && (
                  <WelcomeStep key="welcome" onNext={next} onSkip={skip} variant={variant} />
                )}
                {step >= 1 && step <= features.length && (
                  <FeatureStep
                    key={`feature-${step}`}
                    feature={features[step - 1]}
                    index={step}
                    total={features.length}
                    onNext={next}
                    onPrev={prev}
                    onSkip={skip}
                  />
                )}
                {step === features.length + 1 && (
                  <ReadyStep key="ready" onFinish={dismiss} variant={variant} />
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function WelcomeStep({ onNext, onSkip, variant }: { onNext: () => void; onSkip: () => void; variant: OnboardingVariant }) {
  return (
    <motion.div
      className="text-center"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.25 }}
    >
      {/* Logo */}
      <div className="flex justify-center mb-6">
        <div className="relative">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center border border-primary/20">
            <Brain className="w-10 h-10 text-primary" />
          </div>
          <motion.div
            className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center"
            animate={{ scale: [1, 1.15, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
          >
            <Sparkles className="w-3.5 h-3.5 text-white" />
          </motion.div>
        </div>
      </div>

      <h2 className="font-display text-2xl font-bold tracking-tight mb-2">
        Welcome to MarketMind
      </h2>
      <p className="text-sm text-muted-foreground/80 mb-1 font-display tracking-wide uppercase text-[11px]">
        Autonomous Market Intelligence v2.0
      </p>
      <p className="text-sm text-muted-foreground mt-4 mb-6 max-w-sm mx-auto leading-relaxed">
        An AI-powered platform that extracts market narratives, generates calibrated predictions,
        and continuously improves through an autoresearch loop.
      </p>

      {/* Feature count badges */}
      <div className="flex justify-center gap-3 mb-8">
        <div className="px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20">
          <span className="text-[11px] font-mono font-bold text-primary">12</span>
          <span className="text-[10px] text-muted-foreground ml-1.5">Features</span>
        </div>
        <div className="px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
          <span className="text-[11px] font-mono font-bold text-emerald-400">6</span>
          <span className="text-[10px] text-muted-foreground ml-1.5">New in v2</span>
        </div>
        <div className="px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <span className="text-[11px] font-mono font-bold text-amber-400">14</span>
          <span className="text-[10px] text-muted-foreground ml-1.5">Data Sources</span>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <button
          onClick={onNext}
          className="w-full py-3 px-6 rounded-xl bg-gradient-to-r from-primary to-purple-500 text-white font-display font-semibold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
        >
          {variant === "quick_tour" ? "Quick Tour (6 highlights)" : "Take the Product Tour"}
          <ArrowRight className="w-4 h-4" />
        </button>
        <button
          onClick={onSkip}
          className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors py-2"
        >
          Skip — I'll explore on my own
        </button>
      </div>
    </motion.div>
  );
}

function FeatureStep({
  feature,
  index,
  total,
  onNext,
  onPrev,
  onSkip,
}: {
  feature: Feature;
  index: number;
  total: number;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      transition={{ duration: 0.25 }}
    >
      {/* Feature icon with glow */}
      <div className="flex justify-center mb-5">
        <div
          className="relative w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{ background: feature.bgGlow }}
        >
          <div
            className={`w-14 h-14 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center text-white shadow-lg`}
          >
            {feature.icon}
          </div>
          {feature.category === "new" && (
            <motion.div
              className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 rounded-full bg-emerald-500 text-[8px] font-bold text-white uppercase tracking-wider"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring" }}
            >
              New
            </motion.div>
          )}
        </div>
      </div>

      {/* Subtitle */}
      <div className="text-center mb-2">
        <span className="text-[10px] font-mono text-muted-foreground/40 uppercase tracking-widest">
          {feature.subtitle}
        </span>
      </div>

      {/* Title & Description */}
      <h3 className="font-display text-xl font-bold tracking-tight text-center mb-3">
        {feature.title}
      </h3>
      <p className="text-sm text-muted-foreground text-center leading-relaxed mb-8 max-w-md mx-auto">
        {feature.description}
      </p>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {index > 1 && (
            <button
              onClick={onPrev}
              className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors py-2 px-3 rounded-lg hover:bg-accent/30"
            >
              Back
            </button>
          )}
          <button
            onClick={onSkip}
            className="text-xs text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors py-2 px-3"
          >
            Skip tour
          </button>
        </div>
        <button
          onClick={onNext}
          className="py-2.5 px-6 rounded-xl bg-gradient-to-r from-primary to-purple-500 text-white font-display font-semibold text-sm flex items-center gap-2 hover:opacity-90 transition-opacity"
        >
          {index === total ? "Almost done" : "Next"}
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Dot indicators */}
      <div className="flex justify-center gap-1 mt-6">
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i + 1 === index
                ? "w-5 bg-primary"
                : i + 1 < index
                  ? "w-1.5 bg-primary/40"
                  : "w-1.5 bg-border/40"
            }`}
          />
        ))}
      </div>
    </motion.div>
  );
}

function ReadyStep({ onFinish, variant }: { onFinish: () => void; variant: OnboardingVariant }) {
  return (
    <motion.div
      className="text-center"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Success icon */}
      <div className="flex justify-center mb-6">
        <motion.div
          className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center border border-emerald-500/20"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", damping: 15, delay: 0.1 }}
        >
          <BarChart3 className="w-10 h-10 text-emerald-400" />
        </motion.div>
      </div>

      <h3 className="font-display text-2xl font-bold tracking-tight mb-2">
        You're All Set
      </h3>
      <p className="text-sm text-muted-foreground mb-4 max-w-sm mx-auto leading-relaxed">
        {variant === "quick_tour"
          ? "That was the highlights — there's much more to explore. The dashboard is live and ready."
          : "The dashboard is live. Narratives are being extracted, predictions are being generated, and the autoresearch loop is running."}
      </p>

      {/* Suggested first action */}
      <div className="mb-5 p-3 rounded-lg bg-primary/5 border border-primary/10 text-left">
        <p className="text-[10px] uppercase tracking-wider text-primary/70 font-semibold mb-1">Suggested first step</p>
        <p className="text-xs text-muted-foreground/80 leading-relaxed">
          Add a few tickers to your <span className="font-semibold text-foreground/90">Watchlist</span> to start tracking prices and receiving personalized signals. Then check <span className="font-semibold text-foreground/90">Predictions</span> for AI-generated forecasts.
        </p>
      </div>

      {/* Quick links */}
      <p className="text-[9px] uppercase tracking-wider text-muted-foreground/40 font-medium mb-2">Jump to any section</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-6">
        {[
          { label: "Narratives", href: "/narratives" },
          { label: "Predictions", href: "/predictions" },
          { label: "Backtest", href: "/backtest" },
          { label: "Watchlist", href: "/watchlist" },
          { label: "Model Weights", href: "/model-weights" },
          { label: "Reports", href: "/reports" },
        ].map((link) => (
          <a
            key={link.href}
            href={link.href}
            className="py-2 px-3 rounded-lg bg-accent/50 hover:bg-accent text-xs font-display font-medium text-foreground/80 hover:text-foreground transition-colors text-center"
            onClick={() => {
              localStorage.setItem(ONBOARDING_KEY, "true");
              localStorage.setItem("onboarding-complete", "true");
            }}
          >
            {link.label}
          </a>
        ))}
      </div>

      <button
        onClick={onFinish}
        className="w-full py-3 px-6 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-display font-semibold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
      >
        Start Exploring
        <ArrowRight className="w-4 h-4" />
      </button>
    </motion.div>
  );
}
