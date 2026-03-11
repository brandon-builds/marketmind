import { usePageTracking } from "@/hooks/usePageTracking";
import { useState, useEffect } from "react";
import { AppHeader } from "@/components/AppHeader";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Settings as SettingsIcon,
  Save,
  Bell,
  Palette,
  BarChart3,
  Star,
  Mail,
  Eye,
  Check,
  Loader2,
  LogIn,
  Shield,
  ChevronRight,
} from "lucide-react";
import { Link } from "wouter";
import { ScheduledReports } from "@/components/ScheduledReports";

const HORIZON_OPTIONS = [
  { value: "1d", label: "1 Day", description: "Short-term predictions" },
  { value: "7d", label: "7 Days", description: "Medium-term outlook" },
  { value: "30d", label: "30 Days", description: "Long-term forecasts" },
];

const THEME_OPTIONS = [
  { value: "dark", label: "Dark", description: "Easier on the eyes" },
  { value: "light", label: "Light", description: "Classic bright theme" },
  { value: "system", label: "System", description: "Match your OS setting" },
];

const DIGEST_OPTIONS = [
  { value: "none", label: "None", description: "No email digests" },
  { value: "daily", label: "Daily", description: "Every morning at 8 AM ET" },
  { value: "weekly", label: "Weekly", description: "Every Monday morning" },
];

const POPULAR_TICKERS = [
  "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "TSLA", "META", "BRK-B",
  "SPY", "QQQ", "GLD", "TLT", "USO",
];

export default function Settings() {
  usePageTracking("settings");
  const { user, isAuthenticated, loading: authLoading } = useAuth();

  const { data: settings, isLoading } = trpc.watchlist.settingsGet.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );

  const updateSettings = trpc.watchlist.settingsUpdate.useMutation({
    onSuccess: () => {
      toast.success("Settings saved successfully");
    },
    onError: () => {
      toast.error("Failed to save settings");
    },
  });

  const sendTestDigest = trpc.watchlist.sendTestDigest.useMutation();

  const [defaultTickers, setDefaultTickers] = useState("AAPL,MSFT,GOOGL,NVDA,TSLA");
  const [preferredHorizon, setPreferredHorizon] = useState("7d");
  const [themePreference, setThemePreference] = useState("dark");
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [emailDigest, setEmailDigest] = useState("none");
  const [showOnboarding, setShowOnboarding] = useState(true);

  // Sync from server
  useEffect(() => {
    if (settings) {
      setDefaultTickers(settings.defaultTickers);
      setPreferredHorizon(settings.preferredHorizon);
      setThemePreference(settings.themePreference);
      setNotificationsEnabled(settings.notificationsEnabled);
      setEmailDigest(settings.emailDigest);
      setShowOnboarding(settings.showOnboarding);
    }
  }, [settings]);

  const handleSave = () => {
    updateSettings.mutate({
      defaultTickers,
      preferredHorizon: preferredHorizon as "1d" | "7d" | "30d",
      themePreference: themePreference as "dark" | "light" | "system",
      notificationsEnabled,
      emailDigest: emailDigest as "none" | "daily" | "weekly",
      showOnboarding,
    });
  };

  const toggleTicker = (ticker: string) => {
    const tickers = defaultTickers.split(",").map(t => t.trim()).filter(Boolean);
    if (tickers.includes(ticker)) {
      setDefaultTickers(tickers.filter(t => t !== ticker).join(","));
    } else {
      setDefaultTickers([...tickers, ticker].join(","));
    }
  };

  const selectedTickers = defaultTickers.split(",").map(t => t.trim()).filter(Boolean);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <AppHeader title="Settings" subtitle="Preferences" showBack />
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <AppHeader title="Settings" subtitle="Preferences" showBack />
        <div className="max-w-2xl mx-auto px-4 py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <SettingsIcon className="w-8 h-8 text-primary" />
          </div>
          <h2 className="font-display text-2xl font-bold mb-3">Sign in to access Settings</h2>
          <p className="text-muted-foreground mb-8">
            Customize your MarketMind experience — default tickers, prediction horizons, notifications, and more.
          </p>
          <a
            href={getLoginUrl()}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity"
          >
            <LogIn className="w-4 h-4" />
            Sign In
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader title="Settings" subtitle="Preferences" showBack />

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold">Settings</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Customize your MarketMind experience
            </p>
          </div>
          <button
            onClick={handleSave}
            disabled={updateSettings.isPending}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {updateSettings.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save Changes
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Default Tickers */}
            <section className="rounded-2xl border border-border/20 bg-card/30 overflow-hidden">
              <div className="px-6 py-4 border-b border-border/15 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Star className="w-4.5 h-4.5 text-blue-400" />
                </div>
                <div>
                  <h3 className="font-display text-sm font-bold">Default Tickers</h3>
                  <p className="text-[11px] text-muted-foreground/60">
                    Tickers shown on your dashboard by default
                  </p>
                </div>
              </div>
              <div className="px-6 py-4 space-y-3">
                <div className="flex flex-wrap gap-2">
                  {POPULAR_TICKERS.map((ticker) => (
                    <button
                      key={ticker}
                      onClick={() => toggleTicker(ticker)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all border ${
                        selectedTickers.includes(ticker)
                          ? "bg-primary/15 border-primary/30 text-primary"
                          : "bg-muted/10 border-border/20 text-muted-foreground hover:border-border/40"
                      }`}
                    >
                      {selectedTickers.includes(ticker) && (
                        <Check className="w-3 h-3 inline mr-1" />
                      )}
                      {ticker}
                    </button>
                  ))}
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground/50 block mb-1">
                    Custom tickers (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={defaultTickers}
                    onChange={(e) => setDefaultTickers(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-muted/10 border border-border/20 text-sm font-mono text-foreground placeholder:text-muted-foreground/30 outline-none focus:border-primary/30 transition-colors"
                    placeholder="AAPL,MSFT,GOOGL"
                  />
                </div>
              </div>
            </section>

            {/* Prediction Horizon */}
            <section className="rounded-2xl border border-border/20 bg-card/30 overflow-hidden">
              <div className="px-6 py-4 border-b border-border/15 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <BarChart3 className="w-4.5 h-4.5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-display text-sm font-bold">Preferred Prediction Horizon</h3>
                  <p className="text-[11px] text-muted-foreground/60">
                    Default time horizon for predictions and backtesting
                  </p>
                </div>
              </div>
              <div className="px-6 py-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {HORIZON_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setPreferredHorizon(option.value)}
                      className={`p-4 rounded-xl border text-left transition-all ${
                        preferredHorizon === option.value
                          ? "bg-primary/10 border-primary/30"
                          : "bg-muted/5 border-border/20 hover:border-border/40"
                      }`}
                    >
                      <div className="text-sm font-bold">{option.label}</div>
                      <div className="text-[11px] text-muted-foreground/60 mt-0.5">
                        {option.description}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </section>

            {/* Theme */}
            <section className="rounded-2xl border border-border/20 bg-card/30 overflow-hidden">
              <div className="px-6 py-4 border-b border-border/15 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <Palette className="w-4.5 h-4.5 text-purple-400" />
                </div>
                <div>
                  <h3 className="font-display text-sm font-bold">Theme</h3>
                  <p className="text-[11px] text-muted-foreground/60">
                    Choose your preferred color scheme
                  </p>
                </div>
              </div>
              <div className="px-6 py-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {THEME_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setThemePreference(option.value)}
                      className={`p-4 rounded-xl border text-left transition-all ${
                        themePreference === option.value
                          ? "bg-primary/10 border-primary/30"
                          : "bg-muted/5 border-border/20 hover:border-border/40"
                      }`}
                    >
                      <div className="text-sm font-bold">{option.label}</div>
                      <div className="text-[11px] text-muted-foreground/60 mt-0.5">
                        {option.description}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </section>

            {/* Notifications */}
            <section className="rounded-2xl border border-border/20 bg-card/30 overflow-hidden">
              <div className="px-6 py-4 border-b border-border/15 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <Bell className="w-4.5 h-4.5 text-amber-400" />
                </div>
                <div>
                  <h3 className="font-display text-sm font-bold">Notifications</h3>
                  <p className="text-[11px] text-muted-foreground/60">
                    Control how you receive alerts and updates
                  </p>
                </div>
              </div>
              <div className="px-6 py-4 space-y-4">
                {/* Browser Notifications Toggle */}
                <div className="flex items-center justify-between py-2">
                  <div>
                    <div className="text-sm font-medium">Browser Notifications</div>
                    <div className="text-[11px] text-muted-foreground/60">
                      Get alerts when your price/sentiment thresholds are triggered
                    </div>
                  </div>
                  <button
                    onClick={() => setNotificationsEnabled(!notificationsEnabled)}
                    className={`relative w-11 h-6 rounded-full transition-colors ${
                      notificationsEnabled ? "bg-primary" : "bg-muted/30"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                        notificationsEnabled ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                {/* Email Digest */}
                <div className="border-t border-border/15 pt-4">
                  <div className="text-sm font-medium mb-1">Email Digest</div>
                  <div className="text-[11px] text-muted-foreground/60 mb-3">
                    Receive a summary of top predictions and narrative shifts
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {DIGEST_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => setEmailDigest(option.value)}
                        className={`px-3 py-2.5 rounded-lg border text-left transition-all text-xs ${
                          emailDigest === option.value
                            ? "bg-primary/10 border-primary/30"
                            : "bg-muted/5 border-border/20 hover:border-border/40"
                        }`}
                      >
                        <div className="font-medium">{option.label}</div>
                        <div className="text-[10px] text-muted-foreground/50 mt-0.5">
                          {option.description}
                        </div>
                      </button>
                    ))}
                  </div>
                  {emailDigest !== "none" && (
                    <div className="mt-3 pt-3 border-t border-border/10">
                      <button
                        onClick={() => {
                          sendTestDigest.mutate(undefined, {
                            onSuccess: (data) => {
                              if (data.success) toast.success(data.message);
                              else toast.error(data.message);
                            },
                            onError: () => toast.error("Failed to send test digest"),
                          });
                        }}
                        disabled={sendTestDigest.isPending}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/20 text-xs font-medium text-primary hover:bg-primary/15 transition-colors disabled:opacity-50"
                      >
                        {sendTestDigest.isPending ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Mail className="w-3.5 h-3.5" />
                        )}
                        Send Test Digest
                      </button>
                      <p className="text-[10px] text-muted-foreground/40 mt-1.5">
                        Sends a preview digest with your current watchlist and portfolio data
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* Onboarding */}
            <section className="rounded-2xl border border-border/20 bg-card/30 overflow-hidden">
              <div className="px-6 py-4 border-b border-border/15 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                  <Eye className="w-4.5 h-4.5 text-cyan-400" />
                </div>
                <div>
                  <h3 className="font-display text-sm font-bold">Onboarding</h3>
                  <p className="text-[11px] text-muted-foreground/60">
                    Control the welcome tour experience
                  </p>
                </div>
              </div>
              <div className="px-6 py-4">
                <div className="flex items-center justify-between py-2">
                  <div>
                    <div className="text-sm font-medium">Show Welcome Tour</div>
                    <div className="text-[11px] text-muted-foreground/60">
                      Display the guided tour on your next visit
                    </div>
                  </div>
                  <button
                    onClick={() => setShowOnboarding(!showOnboarding)}
                    className={`relative w-11 h-6 rounded-full transition-colors ${
                      showOnboarding ? "bg-primary" : "bg-muted/30"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                        showOnboarding ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              </div>
            </section>

            {/* Scheduled Reports */}
            <ScheduledReports />

            {/* Account Info */}
            <section className="rounded-2xl border border-border/20 bg-card/30 overflow-hidden">
              <div className="px-6 py-4 border-b border-border/15 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-rose-500/10 flex items-center justify-center">
                  <Mail className="w-4.5 h-4.5 text-rose-400" />
                </div>
                <div>
                  <h3 className="font-display text-sm font-bold">Account</h3>
                  <p className="text-[11px] text-muted-foreground/60">
                    Your account information
                  </p>
                </div>
              </div>
              <div className="px-6 py-4 space-y-3">
                <div className="flex items-center justify-between py-1">
                  <span className="text-xs text-muted-foreground">Name</span>
                  <span className="text-sm font-medium">{user?.name || "—"}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-t border-border/10">
                  <span className="text-xs text-muted-foreground">Email</span>
                  <span className="text-sm font-medium">{user?.email || "—"}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-t border-border/10">
                  <span className="text-xs text-muted-foreground">Role</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    user?.role === "admin"
                      ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                      : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                  }`}>
                    {user?.role || "user"}
                  </span>
                </div>
              </div>
            </section>

            {/* Admin Panel Link */}
            {user?.role === "admin" && (
              <Link href="/admin">
                <section className="rounded-2xl border border-amber-500/20 bg-amber-500/5 overflow-hidden cursor-pointer hover:bg-amber-500/10 transition-colors group">
                  <div className="px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                        <Shield className="w-4 h-4 text-amber-400" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-foreground">Admin Analytics</div>
                        <div className="text-[10px] text-muted-foreground/50">User engagement, top tickers, feature usage</div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-foreground/50 transition-colors" />
                  </div>
                </section>
              </Link>
            )}

            {/* Keyboard Shortcuts Info */}
            <section className="rounded-2xl border border-border/20 bg-card/30 overflow-hidden">
              <div className="px-6 py-4">
                <p className="text-xs text-muted-foreground/60 text-center">
                  Press <kbd className="px-1.5 py-0.5 rounded bg-muted/20 border border-border/20 font-mono text-[10px]">?</kbd> anywhere to view keyboard shortcuts
                </p>
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
