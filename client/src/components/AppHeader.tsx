import { Link, useLocation } from "wouter";
import { Brain, ArrowLeft, Sun, Moon, Menu, X, Command, Settings } from "lucide-react";
import { GlobalSearch } from "@/components/GlobalSearch";
import { AlertBell } from "@/components/AlertSystem";
import { NotificationCenter } from "@/components/NotificationCenter";
import { VipNotificationBell } from "@/components/VipNotificationBell";
import { TourReengagement } from "@/components/TourReengagement";
import { useTheme } from "@/contexts/ThemeContext";
import { useState, useEffect } from "react";

// Clean nav: Dashboard | Predictions | Tickers | Research | Tools | More
const NAV_ITEMS: { href: string; label: string; group?: string }[] = [
  { href: "/", label: "Dashboard", group: "core" },
  { href: "/predictions", label: "Predictions", group: "core" },
  { href: "/alpha-leaderboard", label: "Tickers", group: "core" },
  { href: "/narratives", label: "Research", group: "core" },
  { href: "/trade-journal", label: "Journal", group: "tools" },
  { href: "/portfolio", label: "Portfolio", group: "tools" },
  { href: "/strategy-marketplace", label: "Strategies", group: "tools" },
  { href: "/data-sources", label: "Sources", group: "tools" },
];

// All pages still accessible via routes — these are secondary nav items shown in mobile "More" section
const MORE_NAV_ITEMS: { href: string; label: string }[] = [
  { href: "/watchlist", label: "Watchlist" },
  { href: "/alpha-alerts", label: "Alerts" },
  { href: "/backtest", label: "Backtest" },
  { href: "/alpha-backtest", label: "Alpha Proof" },
  { href: "/compare", label: "Compare" },
  { href: "/vip-signals", label: "VIP Signals" },
  { href: "/model-performance", label: "Model" },
  { href: "/correlation", label: "Correlation" },
  { href: "/strategy-builder", label: "Strategy Builder" },
  { href: "/reports", label: "Reports" },
  { href: "/daily-digest", label: "Digest" },
  { href: "/collab", label: "Collab" },
  { href: "/model-weights", label: "Weights" },
];

interface AppHeaderProps {
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  showMarketStatus?: boolean;
  showTime?: boolean;
  now?: Date;
  isMarketOpen?: boolean;
}

export function AppHeader({
  title,
  subtitle,
  showBack = false,
  showMarketStatus = false,
  showTime = false,
  now,
  isMarketOpen = false,
}: AppHeaderProps) {
  const [location] = useLocation();
  const { theme, toggleTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location]);

  // Close on escape
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileMenuOpen(false);
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, []);

  const isActive = (href: string) => {
    if (href === "/") return location === "/";
    return location.startsWith(href);
  };

  return (
    <>
      <header className="border-b border-border/30 bg-background/70 backdrop-blur-2xl sticky top-0 z-40">
        <div className="max-w-[1920px] mx-auto px-4 lg:px-6 h-14 flex items-center justify-between">
          {/* Left: Logo + Title */}
          <div className="flex items-center gap-3">
            {showBack && (
              <Link href="/" className="w-9 h-9 rounded-lg bg-muted/20 hover:bg-muted/40 flex items-center justify-center transition-colors">
                <ArrowLeft className="w-4 h-4 text-muted-foreground" />
              </Link>
            )}
            <Link href="/" className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg gradient-accent flex items-center justify-center glow-blue">
                <Brain className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="font-display text-lg font-bold tracking-tight leading-none">
                  {title || "MarketMind"}
                </h1>
                {subtitle && (
                  <p className="text-[10px] text-muted-foreground tracking-[0.2em] uppercase">{subtitle}</p>
                )}
                {!subtitle && !title && (
                  <p className="text-[10px] text-muted-foreground tracking-[0.2em] uppercase">Autonomous Intelligence</p>
                )}
              </div>
            </Link>
          </div>

          {/* Right: Search + Nav + Controls */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <GlobalSearch />

            {/* Desktop Nav */}
            <nav className="hidden lg:flex items-center gap-0.5">
              {NAV_ITEMS.map((item, idx) => {
                const prevGroup = idx > 0 ? NAV_ITEMS[idx - 1].group : item.group;
                const showSep = idx > 0 && item.group !== prevGroup;
                return (
                  <span key={item.href} className="flex items-center">
                    {showSep && <span className="w-px h-4 bg-border/25 mx-1" />}
                    <Link
                      href={item.href}
                      className={`px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-colors ${
                        isActive(item.href)
                          ? "text-primary bg-primary/8"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/20"
                      }`}
                    >
                      {item.label}
                    </Link>
                  </span>
                );
              })}
            </nav>

            {/* Settings */}
            <Link
              href="/settings"
              className={`hidden md:flex w-8 h-8 rounded-lg items-center justify-center transition-all ${
                isActive("/settings")
                  ? "text-primary bg-primary/10"
                  : "text-muted-foreground/40 hover:text-foreground hover:bg-muted/20"
              }`}
              title="Settings"
            >
              <Settings className="w-3.5 h-3.5" />
            </Link>

            {/* Keyboard Shortcuts Hint */}
            <button
              onClick={() => {
                window.dispatchEvent(new CustomEvent("toggle-shortcuts-modal"));
              }}
              className="hidden md:flex w-8 h-8 rounded-lg items-center justify-center text-muted-foreground/40 hover:text-foreground hover:bg-muted/20 transition-all"
              title="Keyboard shortcuts (?)"
            >
              <Command className="w-3.5 h-3.5" />
            </button>

            {/* VIP Notification Bell */}
            <VipNotificationBell />

            {/* Alert Bell */}
            <AlertBell />

            {/* Notification Center */}
            <NotificationCenter />

            {/* Tour Re-engagement */}
            <TourReengagement />

            {/* Theme Toggle — prominent pill */}
            {toggleTheme && (
              <button
                onClick={toggleTheme}
                className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-border/40 bg-muted/10 hover:bg-muted/30 text-muted-foreground hover:text-foreground transition-all"
                title={theme === "dark" ? "Switch to light mode (T)" : "Switch to dark mode (T)"}
              >
                {theme === "dark" ? (
                  <>
                    <Sun className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-[10px] font-medium hidden sm:inline">Light</span>
                  </>
                ) : (
                  <>
                    <Moon className="w-3.5 h-3.5 text-blue-400" />
                    <span className="text-[10px] font-medium hidden sm:inline">Dark</span>
                  </>
                )}
              </button>
            )}

            {/* Market Status */}
            {showMarketStatus && (
              <div
                className={`hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full border ${
                  isMarketOpen
                    ? "bg-emerald/10 border-emerald/20"
                    : "bg-amber/10 border-amber/20"
                }`}
              >
                <span className="relative flex h-2 w-2">
                  {isMarketOpen && (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald opacity-75" />
                  )}
                  <span
                    className={`relative inline-flex rounded-full h-2 w-2 ${isMarketOpen ? "bg-emerald" : "bg-amber"}`}
                  />
                </span>
                <span className={`font-medium ${isMarketOpen ? "text-emerald" : "text-amber"}`}>
                  {isMarketOpen ? "Market Open" : "After Hours"}
                </span>
              </div>
            )}

            {/* Date/Time */}
            {showTime && now && (
              <div className="hidden sm:flex items-center gap-2">
                <span className="font-mono text-[11px] text-foreground/60">
                  {now.toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
                <span className="text-border/40">|</span>
                <span className="font-mono text-[11px] text-foreground/50">
                  {now.toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                    hour12: false,
                  })}
                </span>
              </div>
            )}

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-all"
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Mobile Nav Dropdown */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-border/20 bg-background/95 backdrop-blur-xl">
            <nav className="max-w-[1920px] mx-auto px-4 py-3 space-y-3">
              {/* Primary */}
              <div>
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground/40 font-medium px-3 mb-1">Primary</p>
                <div className="grid grid-cols-2 gap-1">
                  {NAV_ITEMS.filter(i => i.group === "core").map((item) => (
                    <Link key={item.href} href={item.href}
                      className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                        isActive(item.href) ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-muted/20"
                      }`}>{item.label}</Link>
                  ))}
                </div>
              </div>
              {/* Tools */}
              <div>
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground/40 font-medium px-3 mb-1">Tools</p>
                <div className="grid grid-cols-2 gap-1">
                  {NAV_ITEMS.filter(i => i.group === "tools").map((item) => (
                    <Link key={item.href} href={item.href}
                      className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                        isActive(item.href) ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-muted/20"
                      }`}>{item.label}</Link>
                  ))}
                </div>
              </div>
              {/* More */}
              <div>
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground/40 font-medium px-3 mb-1">More</p>
                <div className="grid grid-cols-3 gap-1">
                  {MORE_NAV_ITEMS.map((item) => (
                    <Link key={item.href} href={item.href}
                      className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                        isActive(item.href) ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-muted/20"
                      }`}>{item.label}</Link>
                  ))}
                </div>
              </div>
              {/* Settings & Theme */}
              <div className="border-t border-border/15 pt-2 grid grid-cols-2 gap-1">
                <Link href="/settings"
                  className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive("/settings") ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-muted/20"
                  }`}>Settings</Link>
                {toggleTheme && (
                  <button onClick={toggleTheme}
                    className="px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-colors flex items-center gap-2">
                    {theme === "dark" ? (
                      <><Sun className="w-4 h-4 text-amber-400" /> Light Mode</>
                    ) : (
                      <><Moon className="w-4 h-4 text-blue-400" /> Dark Mode</>
                    )}
                  </button>
                )}
              </div>
            </nav>
          </div>
        )}
      </header>
    </>
  );
}
