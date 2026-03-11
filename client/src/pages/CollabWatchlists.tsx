import { usePageTracking } from "@/hooks/usePageTracking";
import { useState, useMemo } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { AppHeader } from "@/components/AppHeader";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, Plus, Link2, Copy, Check, Trash2, LogOut, MessageSquare,
  TrendingUp, TrendingDown, Minus, Send, ChevronRight, ArrowLeft, X, Eye, Wifi
} from "lucide-react";
import { toast } from "sonner";
import { useCollabSocket } from "@/hooks/useCollabSocket";
import { FirstVisitTooltip } from "@/components/FirstVisitTooltip";

export default function CollabWatchlists() {
  usePageTracking("collab-watchlists");
  const { user } = useAuth();
  const [selectedWatchlist, setSelectedWatchlist] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [newTicker, setNewTicker] = useState("");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Annotation state
  const [annotationTicker, setAnnotationTicker] = useState<string | null>(null);
  const [annotationText, setAnnotationText] = useState("");
  const [annotationSentiment, setAnnotationSentiment] = useState<"bullish" | "bearish" | "neutral">("neutral");

  const utils = trpc.useUtils();
  const { data: lists, isLoading } = trpc.watchlist.collabList.useQuery();

  const detail = trpc.watchlist.collabDetail.useQuery(
    { watchlistId: selectedWatchlist! },
    { enabled: !!selectedWatchlist }
  );

  const annotations = trpc.watchlist.collabAnnotations.useQuery(
    { watchlistId: selectedWatchlist!, ticker: annotationTicker ?? undefined },
    { enabled: !!selectedWatchlist && !!annotationTicker }
  );

  // Real-time collab socket
  const { viewers, liveAnnotations, deletedAnnotationIds } = useCollabSocket(
    selectedWatchlist,
    user?.id,
    user?.name ?? undefined
  );

  // Merge server annotations with live ones, filtering out deleted
  const mergedAnnotations = useMemo(() => {
    const serverAnns = (annotations.data ?? []).filter(
      (a) => !deletedAnnotationIds.has(a.id)
    );
    // Add live annotations that aren't already in server data
    const serverIds = new Set(serverAnns.map((a) => a.id));
    const newLive = liveAnnotations.filter(
      (a) => !serverIds.has(a.id) && !deletedAnnotationIds.has(a.id) &&
        (!annotationTicker || a.ticker === annotationTicker)
    );
    return [
      ...newLive.map((a) => ({
        id: a.id,
        watchlistId: selectedWatchlist!,
        ticker: a.ticker,
        userId: Number(a.userId),
        content: a.content,
        sentiment: a.sentiment,
        createdAt: new Date(a.createdAt),
        updatedAt: new Date(a.createdAt),
        userName: a.userName,
        isLive: true,
      })),
      ...serverAnns.map((a) => ({ ...a, isLive: false })),
    ];
  }, [annotations.data, liveAnnotations, deletedAnnotationIds, annotationTicker, selectedWatchlist]);

  const createMutation = trpc.watchlist.collabCreate.useMutation({
    onSuccess: () => {
      utils.watchlist.collabList.invalidate();
      setShowCreate(false);
      setNewName("");
      setNewDesc("");
      toast.success("Watchlist created!");
    },
  });

  const joinMutation = trpc.watchlist.collabJoin.useMutation({
    onSuccess: (data) => {
      utils.watchlist.collabList.invalidate();
      setShowJoin(false);
      setJoinCode("");
      toast.success(`Joined "${data.name}"!`);
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.watchlist.collabDelete.useMutation({
    onSuccess: () => {
      utils.watchlist.collabList.invalidate();
      setSelectedWatchlist(null);
      toast.success("Watchlist deleted");
    },
  });

  const leaveMutation = trpc.watchlist.collabLeave.useMutation({
    onSuccess: () => {
      utils.watchlist.collabList.invalidate();
      setSelectedWatchlist(null);
      toast.success("Left watchlist");
    },
  });

  const addTickerMutation = trpc.watchlist.collabAddTicker.useMutation({
    onSuccess: () => {
      utils.watchlist.collabDetail.invalidate({ watchlistId: selectedWatchlist! });
      setNewTicker("");
      toast.success("Ticker added!");
    },
  });

  const removeTickerMutation = trpc.watchlist.collabRemoveTicker.useMutation({
    onSuccess: () => {
      utils.watchlist.collabDetail.invalidate({ watchlistId: selectedWatchlist! });
      toast.success("Ticker removed");
    },
  });

  const addAnnotationMutation = trpc.watchlist.collabAddAnnotation.useMutation({
    onSuccess: () => {
      utils.watchlist.collabAnnotations.invalidate({ watchlistId: selectedWatchlist!, ticker: annotationTicker ?? undefined });
      setAnnotationText("");
      toast.success("Note added!");
    },
  });

  const deleteAnnotationMutation = trpc.watchlist.collabDeleteAnnotation.useMutation({
    onSuccess: () => {
      utils.watchlist.collabAnnotations.invalidate({ watchlistId: selectedWatchlist!, ticker: annotationTicker ?? undefined });
    },
  });

  const copyInviteCode = (code: string) => {
    const url = `${window.location.origin}/collab?join=${code}`;
    navigator.clipboard.writeText(url);
    setCopiedCode(code);
    toast.success("Invite link copied!");
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const sentimentIcon = (s: string | null) => {
    if (s === "bullish") return <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />;
    if (s === "bearish") return <TrendingDown className="w-3.5 h-3.5 text-red-400" />;
    return <Minus className="w-3.5 h-3.5 text-muted-foreground" />;
  };

  const sentimentColor = (s: string) => {
    if (s === "bullish") return "bg-emerald-500/15 text-emerald-400 border-emerald-500/20";
    if (s === "bearish") return "bg-red-500/15 text-red-400 border-red-500/20";
    return "bg-muted/30 text-muted-foreground border-border/50";
  };

  // Check for join code in URL
  const urlParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const joinFromUrl = urlParams.get("join");

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="container max-w-6xl py-8">
        <FirstVisitTooltip
          storageKey="collab-watchlists"
          title="Collaborative Watchlists"
          description="Create shared watchlists and track tickers together with your team. Add annotations, share insights in real time, and see who's watching what — all with live WebSocket sync."
          tips={[
            "Create a new watchlist and share the invite link with collaborators",
            "Click any ticker to add annotations and discuss with your team",
            "Live presence indicators show who's viewing the same watchlist",
          ]}
          accentColor="emerald"
          icon={<Users className="w-4.5 h-4.5 text-emerald-400" />}
        />

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            {selectedWatchlist && (
              <button
                onClick={() => { setSelectedWatchlist(null); setAnnotationTicker(null); }}
                className="p-2 rounded-lg hover:bg-accent/30 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div>
              <h1 className="text-2xl font-display font-bold tracking-tight">
                {selectedWatchlist ? (detail.data?.name ?? "Loading...") : "Collaborative Watchlists"}
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {selectedWatchlist
                  ? `${detail.data?.members.length ?? 0} members · ${detail.data?.tickers.length ?? 0} tickers`
                  : "Share watchlists and annotate tickers with your team"
                }
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Live Presence Indicator */}
            {selectedWatchlist && viewers.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                <div className="relative">
                  <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                </div>
                <div className="flex -space-x-1.5">
                  {viewers.slice(0, 4).map((v) => (
                    <div
                      key={v.userId}
                      className="w-5 h-5 rounded-full bg-primary/20 border border-emerald-500/30 flex items-center justify-center text-[9px] font-bold text-primary"
                      title={v.userName}
                    >
                      {v.userName[0]?.toUpperCase() ?? "?"}
                    </div>
                  ))}
                  {viewers.length > 4 && (
                    <div className="w-5 h-5 rounded-full bg-muted/40 border border-border/30 flex items-center justify-center text-[9px] font-bold text-muted-foreground">
                      +{viewers.length - 4}
                    </div>
                  )}
                </div>
                <span className="text-[10px] font-medium text-emerald-400">
                  {viewers.length} live
                </span>
              </div>
            )}
            {!selectedWatchlist && (
              <>
                <button
                  onClick={() => {
                    if (joinFromUrl) {
                      setJoinCode(joinFromUrl);
                    }
                    setShowJoin(true);
                  }}
                  className="px-4 py-2 rounded-lg border border-border/50 text-sm font-medium hover:bg-accent/30 transition-colors flex items-center gap-2"
                >
                  <Link2 className="w-4 h-4" />
                  Join
                </button>
                <button
                  onClick={() => setShowCreate(true)}
                  className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Create
                </button>
              </>
            )}
          </div>
        </div>

        {/* Watchlist List View */}
        {!selectedWatchlist && (
          <div className="space-y-3">
            {isLoading && (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-20 rounded-xl bg-card/50 animate-pulse" />
                ))}
              </div>
            )}

            {!isLoading && (!lists || lists.length === 0) && (
              <div className="text-center py-16">
                <Users className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                <h3 className="text-lg font-display font-semibold mb-2">No collaborative watchlists yet</h3>
                <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
                  Create a shared watchlist to collaborate with your team on ticker analysis, or join one with an invite link.
                </p>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={() => setShowJoin(true)}
                    className="px-4 py-2 rounded-lg border border-border/50 text-sm font-medium hover:bg-accent/30 transition-colors"
                  >
                    Join with invite
                  </button>
                  <button
                    onClick={() => setShowCreate(true)}
                    className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
                  >
                    Create watchlist
                  </button>
                </div>
              </div>
            )}

            {lists?.map((wl) => (
              <motion.div
                key={wl.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl p-4 cursor-pointer hover:bg-card/80 transition-colors group"
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                }}
                onClick={() => setSelectedWatchlist(wl.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Users className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-display font-semibold">{wl.name}</h3>
                      {wl.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{wl.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-accent/30 text-muted-foreground capitalize">
                      {wl.role}
                    </span>
                    <ChevronRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors" />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Watchlist Detail View */}
        {selectedWatchlist && detail.data && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Tickers + Annotations */}
            <div className="lg:col-span-2 space-y-6">
              {/* Add Ticker */}
              <div
                className="rounded-xl p-4"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
              >
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newTicker}
                    onChange={(e) => setNewTicker(e.target.value.toUpperCase())}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newTicker.trim()) {
                        addTickerMutation.mutate({ watchlistId: selectedWatchlist, ticker: newTicker.trim() });
                      }
                    }}
                    placeholder="Add ticker (e.g., AAPL)"
                    className="flex-1 px-3 py-2 rounded-lg bg-background/50 border border-border/30 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                  />
                  <button
                    onClick={() => {
                      if (newTicker.trim()) {
                        addTickerMutation.mutate({ watchlistId: selectedWatchlist, ticker: newTicker.trim() });
                      }
                    }}
                    disabled={!newTicker.trim() || addTickerMutation.isPending}
                    className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Tickers Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {detail.data.tickers.map((t) => (
                  <div
                    key={t.id}
                    className={`rounded-xl p-4 cursor-pointer transition-all ${
                      annotationTicker === t.ticker ? "ring-1 ring-primary/50" : ""
                    }`}
                    style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                    onClick={() => setAnnotationTicker(annotationTicker === t.ticker ? null : t.ticker)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-mono font-semibold text-lg">{t.ticker}</span>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Added by {t.addedBy} · {new Date(t.addedAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setAnnotationTicker(t.ticker);
                          }}
                          className="p-1.5 rounded-lg hover:bg-accent/30 transition-colors"
                          title="View annotations"
                        >
                          <MessageSquare className="w-4 h-4 text-muted-foreground" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeTickerMutation.mutate({ watchlistId: selectedWatchlist, ticker: t.ticker });
                          }}
                          className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
                          title="Remove ticker"
                        >
                          <X className="w-4 h-4 text-muted-foreground hover:text-red-400" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {detail.data.tickers.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <p className="text-sm">No tickers yet. Add one above to get started.</p>
                </div>
              )}

              {/* Annotations Panel */}
              <AnimatePresence>
                {annotationTicker && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div
                      className="rounded-xl p-5"
                      style={{ background: "var(--card)", border: "1px solid var(--border)" }}
                    >
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-display font-semibold flex items-center gap-2">
                          <MessageSquare className="w-4 h-4 text-primary" />
                          Notes on {annotationTicker}
                          {liveAnnotations.length > 0 && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-[10px] font-medium text-emerald-400 border border-emerald-500/20">
                              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                              Live
                            </span>
                          )}
                        </h3>
                        <button
                          onClick={() => setAnnotationTicker(null)}
                          className="p-1 rounded hover:bg-accent/30 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Add Annotation */}
                      <div className="mb-4 space-y-2">
                        <textarea
                          value={annotationText}
                          onChange={(e) => setAnnotationText(e.target.value)}
                          placeholder={`Share your analysis on ${annotationTicker}...`}
                          className="w-full px-3 py-2 rounded-lg bg-background/40 border border-border/30 text-sm resize-none h-20 focus:outline-none focus:ring-1 focus:ring-primary/50"
                        />
                        <div className="flex items-center justify-between">
                          <div className="flex gap-1.5">
                            {(["bullish", "bearish", "neutral"] as const).map((s) => (
                              <button
                                key={s}
                                onClick={() => setAnnotationSentiment(s)}
                                className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                                  annotationSentiment === s
                                    ? sentimentColor(s)
                                    : "border-border/30 text-muted-foreground hover:bg-accent/20"
                                }`}
                              >
                                {s.charAt(0).toUpperCase() + s.slice(1)}
                              </button>
                            ))}
                          </div>
                          <button
                            onClick={() => {
                              if (annotationText.trim()) {
                                addAnnotationMutation.mutate({
                                  watchlistId: selectedWatchlist,
                                  ticker: annotationTicker,
                                  content: annotationText.trim(),
                                  sentiment: annotationSentiment,
                                });
                              }
                            }}
                            disabled={!annotationText.trim() || addAnnotationMutation.isPending}
                            className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-1.5"
                          >
                            <Send className="w-3.5 h-3.5" />
                            Post
                          </button>
                        </div>
                      </div>

                      {/* Annotations List — merged server + live */}
                      <div className="space-y-3 max-h-96 overflow-y-auto">
                        {annotations.isLoading && (
                          <div className="text-center py-4 text-sm text-muted-foreground">Loading notes...</div>
                        )}
                        {mergedAnnotations.length === 0 && !annotations.isLoading && (
                          <div className="text-center py-4 text-sm text-muted-foreground">
                            No notes yet. Be the first to share your analysis.
                          </div>
                        )}
                        {mergedAnnotations.map((a) => (
                          <motion.div
                            key={a.id}
                            initial={a.isLive ? { opacity: 0, y: -8, scale: 0.98 } : false}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            className={`rounded-lg p-3 ${a.isLive ? "ring-1 ring-emerald-500/20" : ""}`}
                            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                          >
                            <div className="flex items-start justify-between mb-1.5">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium">{a.userName}</span>
                                {a.sentiment && (
                                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border ${sentimentColor(a.sentiment)}`}>
                                    {sentimentIcon(a.sentiment)}
                                    {a.sentiment}
                                  </span>
                                )}
                                {a.isLive && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-[9px] font-medium text-emerald-400">
                                    new
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] text-muted-foreground/50">
                                  {new Date(a.createdAt).toLocaleDateString()}
                                </span>
                                {a.userId === user?.id && (
                                  <button
                                    onClick={() => deleteAnnotationMutation.mutate({ annotationId: a.id, watchlistId: selectedWatchlist ?? undefined })}
                                    className="p-0.5 rounded hover:bg-red-500/10 transition-colors"
                                  >
                                    <Trash2 className="w-3 h-3 text-muted-foreground/30 hover:text-red-400" />
                                  </button>
                                )}
                              </div>
                            </div>
                            <p className="text-sm text-foreground/80 leading-relaxed">{a.content}</p>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Right Sidebar: Presence + Members + Actions */}
            <div className="space-y-4">
              {/* Live Viewers */}
              {viewers.length > 0 && (
                <div
                  className="rounded-xl p-4"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                >
                  <h4 className="text-sm font-display font-semibold mb-3 flex items-center gap-2">
                    <Eye className="w-4 h-4 text-emerald-400" />
                    Viewing Now
                    <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                  </h4>
                  <div className="space-y-1.5">
                    {viewers.map((v) => (
                      <div key={v.userId} className="flex items-center gap-2">
                        <div className="relative">
                          <div className="w-6 h-6 rounded-full bg-emerald-500/15 flex items-center justify-center text-[10px] font-bold text-emerald-400">
                            {v.userName[0]?.toUpperCase() ?? "?"}
                          </div>
                          <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full border border-background" />
                        </div>
                        <span className="text-xs text-foreground/80">{v.userName}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Invite */}
              <div
                className="rounded-xl p-4"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
              >
                <h4 className="text-sm font-display font-semibold mb-3">Invite Link</h4>
                <div className="flex gap-2">
                  <code className="flex-1 px-2 py-1.5 rounded-lg bg-background/40 text-xs font-mono truncate border border-border/20">
                    {detail.data.inviteCode}
                  </code>
                  <button
                    onClick={() => copyInviteCode(detail.data!.inviteCode)}
                    className="p-1.5 rounded-lg hover:bg-accent/30 transition-colors"
                  >
                    {copiedCode === detail.data.inviteCode ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Copy className="w-4 h-4 text-muted-foreground" />
                    )}
                  </button>
                </div>
              </div>

              {/* Members */}
              <div
                className="rounded-xl p-4"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
              >
                <h4 className="text-sm font-display font-semibold mb-3">
                  Members ({detail.data.members.length})
                </h4>
                <div className="space-y-2">
                  {detail.data.members.map((m) => (
                    <div key={m.userId} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center text-xs font-semibold text-primary">
                            {(m.name ?? "?")[0].toUpperCase()}
                          </div>
                          {/* Show online indicator if viewer is live */}
                          {viewers.some((v) => v.userId === String(m.userId)) && (
                            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-background" />
                          )}
                        </div>
                        <span className="text-sm">{m.name}</span>
                      </div>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/20 text-muted-foreground capitalize">
                        {m.role}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-2">
                {detail.data.ownerId === user?.id ? (
                  <button
                    onClick={() => {
                      if (confirm("Delete this watchlist? This cannot be undone.")) {
                        deleteMutation.mutate({ watchlistId: selectedWatchlist });
                      }
                    }}
                    className="w-full px-4 py-2 rounded-lg border border-red-500/20 text-red-400 text-sm font-medium hover:bg-red-500/10 transition-colors flex items-center justify-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete Watchlist
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      if (confirm("Leave this watchlist?")) {
                        leaveMutation.mutate({ watchlistId: selectedWatchlist });
                      }
                    }}
                    className="w-full px-4 py-2 rounded-lg border border-border/50 text-muted-foreground text-sm font-medium hover:bg-accent/30 transition-colors flex items-center justify-center gap-2"
                  >
                    <LogOut className="w-4 h-4" />
                    Leave Watchlist
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Create Modal */}
        <AnimatePresence>
          {showCreate && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
              onClick={() => setShowCreate(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="w-full max-w-md rounded-2xl p-6"
                style={{ background: "var(--card)", border: "1px solid var(--border)" }}
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="text-lg font-display font-bold mb-4">Create Shared Watchlist</h3>
                <div className="space-y-3">
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Watchlist name"
                    className="w-full px-3 py-2 rounded-lg bg-background/40 border border-border/30 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                    autoFocus
                  />
                  <textarea
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    placeholder="Description (optional)"
                    className="w-full px-3 py-2 rounded-lg bg-background/40 border border-border/30 text-sm resize-none h-20 focus:outline-none focus:ring-1 focus:ring-primary/50"
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => setShowCreate(false)}
                      className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-accent/30 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        if (newName.trim()) {
                          createMutation.mutate({ name: newName.trim(), description: newDesc.trim() || undefined });
                        }
                      }}
                      disabled={!newName.trim() || createMutation.isPending}
                      className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      {createMutation.isPending ? "Creating..." : "Create"}
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Join Modal */}
        <AnimatePresence>
          {showJoin && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
              onClick={() => setShowJoin(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="w-full max-w-md rounded-2xl p-6"
                style={{ background: "var(--card)", border: "1px solid var(--border)" }}
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="text-lg font-display font-bold mb-4">Join Shared Watchlist</h3>
                <div className="space-y-3">
                  <input
                    type="text"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value)}
                    placeholder="Paste invite code or link"
                    className="w-full px-3 py-2 rounded-lg bg-background/40 border border-border/30 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                    autoFocus
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => setShowJoin(false)}
                      className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-accent/30 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        // Extract invite code from URL or use raw code
                        let code = joinCode.trim();
                        const match = code.match(/join=([a-z0-9]+)/);
                        if (match) code = match[1];
                        if (code) {
                          joinMutation.mutate({ inviteCode: code });
                        }
                      }}
                      disabled={!joinCode.trim() || joinMutation.isPending}
                      className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      {joinMutation.isPending ? "Joining..." : "Join"}
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
