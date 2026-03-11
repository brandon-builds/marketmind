import { useState, useMemo } from "react";
import { AppHeader } from "@/components/AppHeader";
import { trpc } from "@/lib/trpc";
import {
  Shield, Plus, Trash2, Edit2, Star, TrendingUp, TrendingDown,
  Minus, AlertTriangle, Users, MessageSquare, Eye, EyeOff, Crown,
  Zap, Target, BarChart3, RefreshCw, ChevronDown, ChevronUp, X, Bell, BellOff,
} from "lucide-react";

// ============================================================================
// Types
// ============================================================================

type Category = "investor_trader" | "economist_fed" | "politician_policy" | "tech_leader" | "financial_media" | "custom";

const CATEGORY_LABELS: Record<Category, string> = {
  investor_trader: "Investor / Trader",
  economist_fed: "Economist / Fed",
  politician_policy: "Politician / Policy",
  tech_leader: "Tech Leader",
  financial_media: "Financial Media",
  custom: "Custom",
};

const CATEGORY_COLORS: Record<Category, string> = {
  investor_trader: "text-emerald-400",
  economist_fed: "text-blue-400",
  politician_policy: "text-amber-400",
  tech_leader: "text-purple-400",
  financial_media: "text-cyan-400",
  custom: "text-gray-400",
};

const CATEGORY_BG: Record<Category, string> = {
  investor_trader: "bg-emerald-500/10 border-emerald-500/20",
  economist_fed: "bg-blue-500/10 border-blue-500/20",
  politician_policy: "bg-amber-500/10 border-amber-500/20",
  tech_leader: "bg-purple-500/10 border-purple-500/20",
  financial_media: "bg-cyan-500/10 border-cyan-500/20",
  custom: "bg-gray-500/10 border-gray-500/20",
};

// ============================================================================
// Component
// ============================================================================

export default function VipSignals() {
  const [activeTab, setActiveTab] = useState<"accounts" | "feed" | "stats">("feed");
  const [showAddForm, setShowAddForm] = useState(false);
  const [filterCategory, setFilterCategory] = useState<Category | "all">("all");
  const [expandedTweet, setExpandedTweet] = useState<number | null>(null);

  // Data fetching
  const accountsQuery = trpc.intelligence.getWatchedAccounts.useQuery();
  const tweetsQuery = trpc.intelligence.getVipTweets.useQuery({ limit: 100 });
  const statsQuery = trpc.intelligence.getVipStats.useQuery();

  const accounts = accountsQuery.data || [];
  const tweets = tweetsQuery.data || [];
  const stats = statsQuery.data;

  const filteredAccounts = useMemo(() => {
    if (filterCategory === "all") return accounts;
    return accounts.filter((a: any) => a.category === filterCategory);
  }, [accounts, filterCategory]);

  const now = new Date();

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
      <AppHeader
        title="VIP Signal Intelligence"
        subtitle="High-signal account monitoring with weighted influence scoring"
      />

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Stats Banner */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard
            label="Watched Accounts"
            value={stats?.totalAccounts || accounts.length}
            icon={<Users className="w-4 h-4" />}
            color="text-blue-400"
          />
          <StatCard
            label="Active Accounts"
            value={stats?.activeAccounts || 0}
            icon={<Eye className="w-4 h-4" />}
            color="text-emerald-400"
          />
          <StatCard
            label="Tweets (24h)"
            value={stats?.tweetsLast24h || 0}
            icon={<MessageSquare className="w-4 h-4" />}
            color="text-cyan-400"
          />
          <StatCard
            label="Total Signals"
            value={stats?.totalTweets || tweets.length}
            icon={<Zap className="w-4 h-4" />}
            color="text-amber-400"
          />
          <StatCard
            label="Avg Sentiment"
            value={stats?.avgSentiment || 0}
            icon={stats?.avgSentiment && stats.avgSentiment > 0
              ? <TrendingUp className="w-4 h-4" />
              : <TrendingDown className="w-4 h-4" />}
            color={stats?.avgSentiment && stats.avgSentiment > 0 ? "text-emerald-400" : "text-red-400"}
            suffix=""
          />
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 p-1 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)] w-fit">
          {(["feed", "accounts", "stats"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === tab
                  ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)]"
              }`}
            >
              {tab === "feed" ? "Live Feed" : tab === "accounts" ? "Watched Accounts" : "Analytics"}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === "feed" && (
          <VipFeed
            tweets={tweets}
            accounts={accounts}
            expandedTweet={expandedTweet}
            setExpandedTweet={setExpandedTweet}
          />
        )}

        {activeTab === "accounts" && (
          <AccountsManager
            accounts={filteredAccounts}
            filterCategory={filterCategory}
            setFilterCategory={setFilterCategory}
            showAddForm={showAddForm}
            setShowAddForm={setShowAddForm}
            refetch={accountsQuery.refetch}
          />
        )}

        {activeTab === "stats" && (
          <VipAnalytics stats={stats} tweets={tweets} accounts={accounts} />
        )}
      </main>
    </div>
  );
}

// ============================================================================
// Sub-Components
// ============================================================================

function StatCard({ label, value, icon, color, suffix }: {
  label: string; value: number | string; icon: React.ReactNode;
  color: string; suffix?: string;
}) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-3">
      <div className="flex items-center gap-2 mb-1">
        <span className={color}>{icon}</span>
        <span className="text-xs text-[var(--color-text-tertiary)]">{label}</span>
      </div>
      <div className={`text-xl font-bold font-mono ${color}`}>
        {typeof value === "number" ? value.toLocaleString() : value}
        {suffix !== undefined ? suffix : ""}
      </div>
    </div>
  );
}

function VipFeed({ tweets, accounts, expandedTweet, setExpandedTweet }: {
  tweets: any[]; accounts: any[];
  expandedTweet: number | null; setExpandedTweet: (id: number | null) => void;
}) {
  const accountMap = useMemo(() => {
    const map: Record<string, any> = {};
    for (const a of accounts) map[a.handle] = a;
    return map;
  }, [accounts]);

  if (tweets.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-12 text-center">
        <Shield className="w-12 h-12 text-blue-400/40 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">VIP Signal Feed Initializing</h3>
        <p className="text-sm text-[var(--color-text-tertiary)]">
          The VIP account monitor is starting up. Tweets from watched accounts will appear here shortly.
        </p>
        <div className="mt-4 flex items-center justify-center gap-2 text-blue-400">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span className="text-sm">Monitoring {accounts.length} accounts...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
          Live VIP Signal Feed
        </h3>
        <span className="text-xs text-[var(--color-text-tertiary)]">
          {tweets.length} signals
        </span>
      </div>

      <div className="space-y-2">
        {tweets.slice(0, 30).map((tweet: any) => {
          const account = accountMap[tweet.handle];
          const isExpanded = expandedTweet === tweet.id;
          const tickers = (() => { try { return JSON.parse(tweet.tickers || "[]"); } catch { return []; } })();
          const meta = (() => { try { return JSON.parse(tweet.metadata || "{}"); } catch { return {}; } })();
          const timeDiff = Date.now() - new Date(tweet.ingestedAt).getTime();
          const timeAgo = timeDiff < 60000 ? "just now"
            : timeDiff < 3600000 ? `${Math.floor(timeDiff / 60000)}m ago`
            : timeDiff < 86400000 ? `${Math.floor(timeDiff / 3600000)}h ago`
            : `${Math.floor(timeDiff / 86400000)}d ago`;

          return (
            <div
              key={tweet.id}
              className={`rounded-lg border transition-all cursor-pointer ${
                tweet.isConsumerTrend
                  ? "border-amber-500/30 bg-amber-500/5"
                  : "border-[var(--color-border)] bg-[var(--color-bg-secondary)]"
              } hover:border-blue-500/30`}
              onClick={() => setExpandedTweet(isExpanded ? null : tweet.id)}
            >
              <div className="p-4">
                {/* Header */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold">
                      {(account?.displayName || tweet.handle)?.[0]?.toUpperCase() || "?"}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                          {account?.displayName || tweet.handle}
                        </span>
                        {account && (
                          <VipBadge weight={account.weightMultiplier} />
                        )}
                        {tweet.isConsumerTrend ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                            CONSUMER TREND
                          </span>
                        ) : null}
                        {account?.isContrarian ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30">
                            CONTRARIAN
                          </span>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-[var(--color-text-tertiary)]">
                        <span>@{tweet.handle}</span>
                        <span>·</span>
                        <span>{timeAgo}</span>
                        {account && (
                          <>
                            <span>·</span>
                            <span className={CATEGORY_COLORS[account.category as Category] || "text-gray-400"}>
                              {CATEGORY_LABELS[account.category as Category] || account.category}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <SentimentBadge sentiment={tweet.sentiment} score={tweet.sentimentScore} />
                </div>

                {/* Content */}
                <p className="text-sm text-[var(--color-text-primary)] leading-relaxed mb-3">
                  {tweet.content}
                </p>

                {/* Tickers & Engagement */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {tickers.map((t: string) => (
                      <a
                        key={t}
                        href={`/ticker/${t}`}
                        onClick={(e) => e.stopPropagation()}
                        className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-colors"
                      >
                        ${t}
                      </a>
                    ))}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-[var(--color-text-tertiary)]">
                    <span>♥ {(tweet.likes || 0).toLocaleString()}</span>
                    <span>↻ {(tweet.retweets || 0).toLocaleString()}</span>
                    {tweet.relevanceScore && (
                      <span className="text-blue-400">
                        Relevance: {tweet.relevanceScore}%
                      </span>
                    )}
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-[var(--color-border)] space-y-2">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                      <div className="p-2 rounded bg-[var(--color-bg-tertiary)]">
                        <span className="text-[var(--color-text-tertiary)]">Weight Multiplier</span>
                        <div className="font-bold text-amber-400">{meta.weightMultiplier || 1}x</div>
                      </div>
                      <div className="p-2 rounded bg-[var(--color-bg-tertiary)]">
                        <span className="text-[var(--color-text-tertiary)]">Sentiment Score</span>
                        <div className={`font-bold ${(tweet.sentimentScore || 0) > 0 ? "text-emerald-400" : (tweet.sentimentScore || 0) < 0 ? "text-red-400" : "text-gray-400"}`}>
                          {tweet.sentimentScore > 0 ? "+" : ""}{tweet.sentimentScore || 0}
                        </div>
                      </div>
                      <div className="p-2 rounded bg-[var(--color-bg-tertiary)]">
                        <span className="text-[var(--color-text-tertiary)]">Triggered Prediction</span>
                        <div className={`font-bold ${tweet.triggeredPrediction ? "text-emerald-400" : "text-gray-500"}`}>
                          {tweet.triggeredPrediction ? "Yes" : "No"}
                        </div>
                      </div>
                      <div className="p-2 rounded bg-[var(--color-bg-tertiary)]">
                        <span className="text-[var(--color-text-tertiary)]">Category</span>
                        <div className="font-bold text-[var(--color-text-primary)]">
                          {meta.accountCategory || "unknown"}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AccountsManager({ accounts, filterCategory, setFilterCategory, showAddForm, setShowAddForm, refetch }: {
  accounts: any[];
  filterCategory: Category | "all";
  setFilterCategory: (c: Category | "all") => void;
  showAddForm: boolean;
  setShowAddForm: (v: boolean) => void;
  refetch: () => void;
}) {
  const addMutation = trpc.intelligence.addWatchedAccount.useMutation({
    onSuccess: () => { refetch(); setShowAddForm(false); },
  });
  const removeMutation = trpc.intelligence.removeWatchedAccount.useMutation({
    onSuccess: () => refetch(),
  });
  const updateMutation = trpc.intelligence.updateWatchedAccount.useMutation({
    onSuccess: () => refetch(),
  });

  const [newHandle, setNewHandle] = useState("");
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState<Category>("custom");
  const [newWeight, setNewWeight] = useState(3);
  const [newDescription, setNewDescription] = useState("");

  return (
    <div className="space-y-4">
      {/* Filter + Add */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setFilterCategory("all")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              filterCategory === "all"
                ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                : "text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] border border-transparent"
            }`}
          >
            All ({accounts.length})
          </button>
          {(Object.keys(CATEGORY_LABELS) as Category[]).map(cat => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                filterCategory === cat
                  ? `${CATEGORY_BG[cat]} ${CATEGORY_COLORS[cat]} border`
                  : "text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] border border-transparent"
              }`}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30 transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Account
        </button>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-4 space-y-3">
          <h4 className="text-sm font-semibold text-blue-400">Add New VIP Account</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              value={newHandle}
              onChange={e => setNewHandle(e.target.value)}
              placeholder="Twitter handle (e.g. elonmusk)"
              className="px-3 py-2 rounded-md bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)]"
            />
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Display name"
              className="px-3 py-2 rounded-md bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)]"
            />
            <select
              value={newCategory}
              onChange={e => setNewCategory(e.target.value as Category)}
              className="px-3 py-2 rounded-md bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)]"
            >
              {(Object.keys(CATEGORY_LABELS) as Category[]).map(cat => (
                <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
              ))}
            </select>
            <div className="flex items-center gap-2">
              <label className="text-xs text-[var(--color-text-tertiary)]">Weight:</label>
              <input
                type="range"
                min={1}
                max={5}
                value={newWeight}
                onChange={e => setNewWeight(Number(e.target.value))}
                className="flex-1"
              />
              <span className="text-sm font-bold text-amber-400">{newWeight}x</span>
            </div>
          </div>
          <textarea
            value={newDescription}
            onChange={e => setNewDescription(e.target.value)}
            placeholder="Why is this account high-signal? (optional)"
            className="w-full px-3 py-2 rounded-md bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] resize-none"
            rows={2}
          />
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (newHandle && newName) {
                  addMutation.mutate({
                    handle: newHandle,
                    displayName: newName,
                    category: newCategory,
                    weightMultiplier: newWeight,
                    description: newDescription || undefined,
                  });
                }
              }}
              disabled={!newHandle || !newName || addMutation.isPending}
              className="px-4 py-2 rounded-md text-sm font-medium bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 transition-all"
            >
              {addMutation.isPending ? "Adding..." : "Add Account"}
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 rounded-md text-sm text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Accounts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {accounts.map((account: any) => (
          <div
            key={account.id}
            className={`rounded-lg border p-4 transition-all hover:shadow-lg ${
              CATEGORY_BG[account.category as Category] || "bg-[var(--color-bg-secondary)] border-[var(--color-border)]"
            }`}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-sm font-bold">
                  {account.displayName?.[0]?.toUpperCase() || "?"}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                      {account.displayName}
                    </span>
                    <VipBadge weight={account.weightMultiplier} />
                  </div>
                  <span className="text-xs text-[var(--color-text-tertiary)]">@{account.handle}</span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <NotificationToggle handle={account.handle} />
                <button
                  onClick={() => updateMutation.mutate({
                    id: account.id,
                    isActive: !account.isActive,
                  })}
                  className="p-1 rounded hover:bg-[var(--color-bg-tertiary)] transition-colors"
                  title={account.isActive ? "Pause monitoring" : "Resume monitoring"}
                >
                  {account.isActive
                    ? <Eye className="w-3.5 h-3.5 text-emerald-400" />
                    : <EyeOff className="w-3.5 h-3.5 text-gray-500" />}
                </button>
                <button
                  onClick={() => removeMutation.mutate({ id: account.id })}
                  className="p-1 rounded hover:bg-red-500/10 transition-colors"
                  title="Remove account"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-400" />
                </button>
              </div>
            </div>

            <p className="text-xs text-[var(--color-text-secondary)] mb-3 line-clamp-2">
              {account.description || "No description"}
            </p>

            <div className="flex items-center justify-between text-xs">
              <span className={CATEGORY_COLORS[account.category as Category] || "text-gray-400"}>
                {CATEGORY_LABELS[account.category as Category] || account.category}
              </span>
              <div className="flex items-center gap-2">
                {account.isContrarian ? (
                  <span className="text-red-400 font-medium">Contrarian</span>
                ) : null}
                <span className="text-amber-400 font-bold">{account.weightMultiplier}x weight</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function VipAnalytics({ stats, tweets, accounts }: { stats: any; tweets: any[]; accounts: any[] }) {
  // Category breakdown
  const categoryBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const a of accounts) {
      const cat = a.category || "unknown";
      counts[cat] = (counts[cat] || 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [accounts]);

  // Sentiment distribution
  const sentimentDist = useMemo(() => {
    let bullish = 0, bearish = 0, neutral = 0;
    for (const t of tweets) {
      if (t.sentiment === "bullish") bullish++;
      else if (t.sentiment === "bearish") bearish++;
      else neutral++;
    }
    const total = tweets.length || 1;
    return { bullish, bearish, neutral, total };
  }, [tweets]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Top Mentioned Tickers */}
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4">
        <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3 flex items-center gap-2">
          <Target className="w-4 h-4 text-blue-400" />
          Top Mentioned Tickers (24h)
        </h4>
        <div className="space-y-2">
          {(stats?.topMentionedTickers || []).slice(0, 8).map((t: any, i: number) => (
            <div key={t.ticker} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--color-text-tertiary)] w-4">{i + 1}</span>
                <a href={`/ticker/${t.ticker}`} className="text-sm font-mono font-bold text-blue-400 hover:underline">
                  ${t.ticker}
                </a>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-24 h-1.5 rounded-full bg-[var(--color-bg-tertiary)] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-blue-500"
                    style={{ width: `${Math.min(100, (t.count / ((stats?.topMentionedTickers?.[0]?.count) || 1)) * 100)}%` }}
                  />
                </div>
                <span className="text-xs text-[var(--color-text-tertiary)] font-mono w-8 text-right">{t.count}</span>
              </div>
            </div>
          ))}
          {(!stats?.topMentionedTickers || stats.topMentionedTickers.length === 0) && (
            <p className="text-xs text-[var(--color-text-tertiary)]">No ticker mentions yet</p>
          )}
        </div>
      </div>

      {/* Category Breakdown */}
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4">
        <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-purple-400" />
          Account Categories
        </h4>
        <div className="space-y-2">
          {categoryBreakdown.map(([cat, count]) => (
            <div key={cat} className="flex items-center justify-between">
              <span className={`text-sm ${CATEGORY_COLORS[cat as Category] || "text-gray-400"}`}>
                {CATEGORY_LABELS[cat as Category] || cat}
              </span>
              <span className="text-sm font-bold text-[var(--color-text-primary)]">{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Sentiment Distribution */}
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4">
        <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-emerald-400" />
          Sentiment Distribution
        </h4>
        <div className="space-y-3">
          <SentimentBar label="Bullish" count={sentimentDist.bullish} total={sentimentDist.total} color="bg-emerald-500" />
          <SentimentBar label="Neutral" count={sentimentDist.neutral} total={sentimentDist.total} color="bg-gray-500" />
          <SentimentBar label="Bearish" count={sentimentDist.bearish} total={sentimentDist.total} color="bg-red-500" />
        </div>
      </div>

      {/* Consumer Trend Signals */}
      <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
        <h4 className="text-sm font-semibold text-amber-400 mb-3 flex items-center gap-2">
          <Crown className="w-4 h-4" />
          Chris Camillo Signals
        </h4>
        <p className="text-xs text-[var(--color-text-secondary)] mb-3">
          Consumer trend signals that map social arbitrage patterns to ticker opportunities.
        </p>
        <div className="space-y-2">
          {tweets.filter(t => t.isConsumerTrend).slice(0, 5).map((t: any) => (
            <div key={t.id} className="p-2 rounded bg-[var(--color-bg-tertiary)] text-xs text-[var(--color-text-primary)]">
              {t.content?.slice(0, 120)}...
            </div>
          ))}
          {tweets.filter(t => t.isConsumerTrend).length === 0 && (
            <p className="text-xs text-[var(--color-text-tertiary)]">No consumer trend signals detected yet</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Shared Components
// ============================================================================

function VipBadge({ weight }: { weight: number }) {
  const stars = Math.min(5, Math.max(1, weight));
  return (
    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
      <Shield className="w-2.5 h-2.5" />
      {stars}x
    </span>
  );
}

function SentimentBadge({ sentiment, score }: { sentiment: string; score: number }) {
  const config = sentiment === "bullish"
    ? { icon: <TrendingUp className="w-3 h-3" />, color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" }
    : sentiment === "bearish"
    ? { icon: <TrendingDown className="w-3 h-3" />, color: "text-red-400 bg-red-500/10 border-red-500/20" }
    : { icon: <Minus className="w-3 h-3" />, color: "text-gray-400 bg-gray-500/10 border-gray-500/20" };

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border ${config.color}`}>
      {config.icon}
      {sentiment}
    </span>
  );
}

function SentimentBar({ label, count, total, color }: {
  label: string; count: number; total: number; color: string;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-[var(--color-text-secondary)]">{label}</span>
        <span className="text-[var(--color-text-primary)] font-mono">{count} ({pct}%)</span>
      </div>
      <div className="w-full h-2 rounded-full bg-[var(--color-bg-tertiary)] overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function NotificationToggle({ handle }: { handle: string }) {
  const prefsQuery = trpc.intelligence.getNotificationPrefs.useQuery();
  const toggleMutation = trpc.intelligence.toggleNotification.useMutation({
    onSuccess: () => {
      prefsQuery.refetch();
    },
  });

  const prefs = prefsQuery.data || [];
  const currentPref = prefs.find((p: any) => p.handle === handle);
  const isEnabled = currentPref?.enabled ?? false;

  return (
    <button
      onClick={() => toggleMutation.mutate({ handle, enabled: !isEnabled })}
      className={`p-1 rounded transition-colors ${
        isEnabled
          ? "hover:bg-violet-500/20 text-violet-400"
          : "hover:bg-[var(--color-bg-tertiary)] text-gray-500"
      }`}
      title={isEnabled ? "Notifications ON — click to disable" : "Notifications OFF — click to enable"}
    >
      {isEnabled ? (
        <Bell className="w-3.5 h-3.5" />
      ) : (
        <BellOff className="w-3.5 h-3.5" />
      )}
    </button>
  );
}
