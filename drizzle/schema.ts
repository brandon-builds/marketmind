import { boolean, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Watchlist — users save tickers they want to track.
 * Each row is one ticker for one user.
 */
export const watchlist = mysqlTable("watchlist", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  ticker: varchar("ticker", { length: 16 }).notNull(),
  addedAt: timestamp("addedAt").defaultNow().notNull(),
});

export type Watchlist = typeof watchlist.$inferSelect;
export type InsertWatchlist = typeof watchlist.$inferInsert;

/**
 * Portfolio holdings — users save their stock positions.
 * Each row is one holding (ticker + shares) for one user.
 */
export const portfolioHoldings = mysqlTable("portfolio_holdings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  ticker: varchar("ticker", { length: 16 }).notNull(),
  shares: int("shares").notNull(),
  addedAt: timestamp("addedAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PortfolioHolding = typeof portfolioHoldings.$inferSelect;
export type InsertPortfolioHolding = typeof portfolioHoldings.$inferInsert;

/**
 * User settings — personalized preferences per user.
 * Stores JSON-serializable settings like default tickers, theme, notification prefs.
 */
export const userSettings = mysqlTable("user_settings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  /** Comma-separated default tickers for the dashboard */
  defaultTickers: text("defaultTickers"),
  /** Preferred prediction horizon: 1d, 7d, 30d */
  preferredHorizon: varchar("preferredHorizon", { length: 8 }).default("7d"),
  /** Theme preference: dark, light, system */
  themePreference: varchar("themePreference", { length: 16 }).default("dark"),
  /** Enable browser notifications */
  notificationsEnabled: int("notificationsEnabled").default(1),
  /** Email digest frequency: none, daily, weekly */
  emailDigest: varchar("emailDigest", { length: 16 }).default("none"),
  /** Show onboarding tour */
  showOnboarding: int("showOnboarding").default(1),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserSettings = typeof userSettings.$inferSelect;
export type InsertUserSettings = typeof userSettings.$inferInsert;

/**
 * Shared reports — shareable links for backtesting reports and portfolio snapshots.
 * Each row stores a snapshot of report data that can be accessed via a unique shareId.
 */
export const sharedReports = mysqlTable("shared_reports", {
  id: int("id").autoincrement().primaryKey(),
  /** Unique share identifier used in the URL */
  shareId: varchar("shareId", { length: 32 }).notNull().unique(),
  /** User who created the share */
  userId: int("userId").notNull(),
  /** Report type: backtest or portfolio */
  reportType: mysqlEnum("reportType", ["backtest", "portfolio"]).notNull(),
  /** Report title */
  title: varchar("title", { length: 256 }).notNull(),
  /** JSON-serialized report data snapshot */
  data: text("data").notNull(),
  /** Number of times the link has been viewed */
  views: int("views").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt"),
});

export type SharedReport = typeof sharedReports.$inferSelect;
export type InsertSharedReport = typeof sharedReports.$inferInsert;

/**
 * Saved filters — users save their preferred filter combinations
 * for quick access on Narratives and Predictions pages.
 */
export const savedFilters = mysqlTable("saved_filters", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  /** Which page this filter belongs to: "narratives" or "predictions" */
  page: varchar("page", { length: 32 }).notNull(),
  /** User-defined name for this filter preset */
  name: varchar("name", { length: 128 }).notNull(),
  /** JSON-serialized filter state */
  filters: text("filters").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SavedFilter = typeof savedFilters.$inferSelect;
export type InsertSavedFilter = typeof savedFilters.$inferInsert;

/**
 * Analytics events — lightweight event tracking for admin analytics.
 * Tracks page views, feature usage, and ticker interactions.
 */
export const analyticsEvents = mysqlTable("analytics_events", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  /** Event type: page_view, ticker_view, feature_use, etc. */
  event: varchar("event", { length: 64 }).notNull(),
  /** Page where the event occurred */
  page: varchar("page", { length: 64 }),
  /** Ticker symbol if applicable */
  ticker: varchar("ticker", { length: 16 }),
  /** Optional JSON metadata */
  metadata: text("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AnalyticsEvent = typeof analyticsEvents.$inferSelect;
export type InsertAnalyticsEvent = typeof analyticsEvents.$inferInsert;

/**
 * User alerts — server-side price and sentiment alerts.
 * Persisted in DB so they can be checked server-side on each data refresh.
 */
export const userAlerts = mysqlTable("user_alerts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  ticker: varchar("ticker", { length: 16 }).notNull(),
  /** Alert type: price_above, price_below, sentiment_above, sentiment_below, narrative_mention, sentiment_shift */
  type: varchar("type", { length: 32 }).notNull(),
  /** Threshold value — price in dollars or sentiment score (stored as cents) */
  threshold: int("threshold").notNull(),
  /** For narrative alerts: required sentiment filter (bullish/bearish/any) */
  sentimentFilter: varchar("sentimentFilter", { length: 16 }),
  /** For narrative alerts: keyword to match in narrative text */
  keyword: varchar("keyword", { length: 128 }),
  /** Whether this alert has been triggered */
  triggered: int("triggered").default(0).notNull(),
  /** When the alert was triggered */
  triggeredAt: timestamp("triggeredAt"),
  /** Whether the owner has been notified */
  notified: int("notified").default(0).notNull(),
  /** Trigger context — what caused the alert to fire (e.g., narrative text snippet) */
  triggerContext: text("triggerContext"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type UserAlert = typeof userAlerts.$inferSelect;
export type InsertUserAlert = typeof userAlerts.$inferInsert;

/**
 * Shared watchlists — collaborative watchlists that can be shared between users.
 * Each shared watchlist has an owner and can have multiple members.
 */
export const sharedWatchlists = mysqlTable("shared_watchlists", {
  id: int("id").autoincrement().primaryKey(),
  /** Owner user ID */
  ownerId: int("ownerId").notNull(),
  /** Display name for the shared watchlist */
  name: varchar("name", { length: 128 }).notNull(),
  /** Description of the watchlist */
  description: text("description"),
  /** Unique invite code for joining */
  inviteCode: varchar("inviteCode", { length: 32 }).notNull().unique(),
  /** Whether the watchlist is public (anyone with link can view) */
  isPublic: int("isPublic").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SharedWatchlist = typeof sharedWatchlists.$inferSelect;
export type InsertSharedWatchlist = typeof sharedWatchlists.$inferInsert;

/**
 * Shared watchlist members — tracks who has access to a shared watchlist.
 */
export const sharedWatchlistMembers = mysqlTable("shared_watchlist_members", {
  id: int("id").autoincrement().primaryKey(),
  watchlistId: int("watchlistId").notNull(),
  userId: int("userId").notNull(),
  /** Role: owner, editor, viewer */
  role: varchar("role", { length: 16 }).default("viewer").notNull(),
  joinedAt: timestamp("joinedAt").defaultNow().notNull(),
});

export type SharedWatchlistMember = typeof sharedWatchlistMembers.$inferSelect;

/**
 * Shared watchlist tickers — tickers in a shared watchlist.
 */
export const sharedWatchlistTickers = mysqlTable("shared_watchlist_tickers", {
  id: int("id").autoincrement().primaryKey(),
  watchlistId: int("watchlistId").notNull(),
  ticker: varchar("ticker", { length: 16 }).notNull(),
  addedBy: int("addedBy").notNull(),
  addedAt: timestamp("addedAt").defaultNow().notNull(),
});

export type SharedWatchlistTicker = typeof sharedWatchlistTickers.$inferSelect;

/**
 * Watchlist annotations — notes/comments on tickers within shared watchlists.
 * This is the social layer that lets users annotate tickers with their analysis.
 */
export const watchlistAnnotations = mysqlTable("watchlist_annotations", {
  id: int("id").autoincrement().primaryKey(),
  watchlistId: int("watchlistId").notNull(),
  ticker: varchar("ticker", { length: 16 }).notNull(),
  userId: int("userId").notNull(),
  /** The annotation text (supports markdown) */
  content: text("content").notNull(),
  /** Sentiment tag: bullish, bearish, neutral */
  sentiment: varchar("sentiment", { length: 16 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type WatchlistAnnotation = typeof watchlistAnnotations.$inferSelect;

/**
 * Prediction weight profiles — users customize signal source weights
 * to create personalized prediction profiles.
 */
export const predictionWeights = mysqlTable("prediction_weights", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 100 }).notNull().default("Default"),
  socialWeight: int("socialWeight").notNull().default(25),
  technicalWeight: int("technicalWeight").notNull().default(25),
  fundamentalWeight: int("fundamentalWeight").notNull().default(25),
  newsWeight: int("newsWeight").notNull().default(25),
  isActive: int("isActive").notNull().default(1),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/**
 * Generated reports — weekly performance and accuracy reports stored in S3.
 */
export const generatedReports = mysqlTable("generated_reports", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  reportType: varchar("reportType", { length: 50 }).notNull().default("weekly_summary"),
  title: varchar("title", { length: 255 }).notNull(),
  periodStart: timestamp("periodStart").notNull(),
  periodEnd: timestamp("periodEnd").notNull(),
  fileUrl: text("fileUrl").notNull(),
  fileKey: text("fileKey").notNull(),
  metadata: text("metadata"), // JSON string with summary stats
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/**
 * In-app notifications — aggregates alerts, digests, reports, and collab events.
 */
export const inAppNotifications = mysqlTable("in_app_notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  type: varchar("type", { length: 50 }).notNull(), // alert_triggered, digest_sent, report_generated, collab_annotation, collab_joined
  title: varchar("title", { length: 255 }).notNull(),
  body: text("body"),
  link: varchar("link", { length: 512 }), // optional deep link within the app
  isRead: boolean("isRead").notNull().default(false),
  metadata: text("metadata"), // JSON string for extra context
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/**
 * Onboarding analytics — tracks tour step completions, skips, and first feature usage.
 * Used by admin to understand user onboarding patterns and optimize the experience.
 */
export const onboardingAnalytics = mysqlTable("onboarding_analytics", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  /** Session identifier for anonymous tracking */
  sessionId: varchar("sessionId", { length: 64 }).notNull(),
  /** Event type: tour_start, tour_step, tour_skip, tour_complete, feature_first_use, tooltip_dismiss */
  eventType: varchar("eventType", { length: 64 }).notNull(),
  /** Step number for tour events (0 = welcome, 1-12 = features, 13 = ready) */
  stepNumber: int("stepNumber"),
  /** Feature name for feature_first_use events */
  featureName: varchar("featureName", { length: 64 }),
  /** Optional JSON metadata (e.g., time spent on step, which tooltip was dismissed) */
  metadata: text("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type OnboardingAnalytic = typeof onboardingAnalytics.$inferSelect;
export type InsertOnboardingAnalytic = typeof onboardingAnalytics.$inferInsert;

/**
 * App settings — key-value store for admin-configurable settings.
 * Used for variant override, feature flags, etc.
 */
export const appSettings = mysqlTable("app_settings", {
  id: int("id").autoincrement().primaryKey(),
  key: varchar("key", { length: 128 }).notNull().unique(),
  value: text("value").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AppSetting = typeof appSettings.$inferSelect;
export type InsertAppSetting = typeof appSettings.$inferInsert;

/**
 * User preferences — stores per-user settings like dashboard layout.
 * Uses a key-value pattern so we can add more preferences without schema changes.
 */
export const userPreferences = mysqlTable("user_preferences", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  /** Preference key, e.g., 'dashboard_layout' */
  key: varchar("key", { length: 128 }).notNull(),
  /** JSON-encoded preference value */
  value: text("value").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type UserPreference = typeof userPreferences.$inferSelect;
export type InsertUserPreference = typeof userPreferences.$inferInsert;

/**
 * Scheduled reports — users configure recurring custom reports.
 * Each schedule defines what content sections to include and when to send.
 */
export const reportSchedules = mysqlTable("report_schedules", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  /** User-defined name for this schedule */
  name: varchar("name", { length: 200 }).notNull(),
  /** Frequency: daily, weekly_monday, weekly_friday, monthly */
  frequency: varchar("frequency", { length: 32 }).notNull(),
  /** JSON array of content section IDs to include */
  sections: text("sections").notNull(),
  /** Whether this schedule is active */
  enabled: int("enabled").default(1).notNull(),
  /** Delivery method: notification (default), email, slack, or comma-separated combo */
  deliveryMethod: varchar("deliveryMethod", { length: 64 }).default("notification").notNull(),
  /** Email address for email delivery */
  deliveryEmail: varchar("deliveryEmail", { length: 320 }),
  /** Slack webhook URL for slack delivery */
  slackWebhookUrl: text("slackWebhookUrl"),
  /** Last time this schedule was executed */
  lastSentAt: timestamp("lastSentAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ReportSchedule = typeof reportSchedules.$inferSelect;
export type InsertReportSchedule = typeof reportSchedules.$inferInsert;

/**
 * Dashboard snapshots — shareable read-only snapshots of a user's dashboard state.
 * Captures widget layout, market data, portfolio summary, and watchlist at a point in time.
 */
export const dashboardSnapshots = mysqlTable("dashboard_snapshots", {
  id: int("id").autoincrement().primaryKey(),
  /** Unique share identifier used in the URL */
  shareId: varchar("shareId", { length: 32 }).notNull().unique(),
  /** User who created the snapshot */
  userId: int("userId").notNull(),
  /** User display name at time of snapshot */
  userName: varchar("userName", { length: 255 }),
  /** Optional title for the snapshot */
  title: varchar("title", { length: 255 }),
  /** JSON-serialized dashboard data (layout, market quotes, portfolio, watchlist, sentiment) */
  data: text("data").notNull(),
  /** Number of times the snapshot has been viewed */
  views: int("views").default(0).notNull(),
  /** Optional expiration date */
  expiresAt: timestamp("expiresAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type DashboardSnapshot = typeof dashboardSnapshots.$inferSelect;
export type InsertDashboardSnapshot = typeof dashboardSnapshots.$inferInsert;

// ============================================================================
// Real Signal Ingestion
// ============================================================================

export const ingestedSignals = mysqlTable("ingested_signals", {
  id: int("id").autoincrement().primaryKey(),
  source: mysqlEnum("source", ["reddit", "yahoo_finance", "rss_news", "twitter", "twitter_vip", "sec_edgar", "fred_macro", "polymarket", "stocktwits", "cboe_vix", "google_trends", "podcast_youtube", "congressional"]).notNull(),
  sourceDetail: varchar("sourceDetail", { length: 255 }), // e.g. "r/wallstreetbets", "Reuters RSS"
  ticker: varchar("ticker", { length: 20 }),
  title: text("title"),
  content: text("content"),
  url: varchar("url", { length: 500 }),
  author: varchar("author", { length: 255 }),
  sentiment: mysqlEnum("sentiment", ["bullish", "bearish", "neutral"]),
  sentimentScore: int("sentimentScore"), // -100 to 100
  signalType: mysqlEnum("signalType", ["price_data", "social_mention", "news_headline", "volume_spike", "fundamental", "insider_trade", "macro_indicator", "prediction_market", "volatility", "trend_signal", "podcast_episode", "congressional_trade"]),
  metadata: text("metadata"), // JSON blob for source-specific data
  ingestedAt: timestamp("ingestedAt").defaultNow().notNull(),
});
export type IngestedSignal = typeof ingestedSignals.$inferSelect;
export type InsertIngestedSignal = typeof ingestedSignals.$inferInsert;

// ============================================================================
// AI-Generated Intelligence (persisted)
// ============================================================================

export const aiNarratives = mysqlTable("ai_narratives", {
  id: int("id").autoincrement().primaryKey(),
  narrativeId: varchar("narrativeId", { length: 100 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  summary: text("summary").notNull(),
  sentiment: mysqlEnum("sentiment", ["bullish", "bearish", "neutral"]).notNull(),
  confidence: int("confidence").notNull(), // 0-100
  sources: text("sources").notNull(), // JSON array
  relatedTickers: text("relatedTickers").notNull(), // JSON array
  category: varchar("category", { length: 100 }).notNull(),
  generatedAt: timestamp("generatedAt").defaultNow().notNull(),
  agentVersion: varchar("agentVersion", { length: 50 }),
  signalCount: int("signalCount").default(0), // how many signals contributed
});
export type AiNarrative = typeof aiNarratives.$inferSelect;
export type InsertAiNarrative = typeof aiNarratives.$inferInsert;

export const aiPredictions = mysqlTable("ai_predictions", {
  id: int("id").autoincrement().primaryKey(),
  predictionId: varchar("predictionId", { length: 100 }).notNull(),
  ticker: varchar("ticker", { length: 20 }).notNull(),
  direction: mysqlEnum("direction", ["up", "down", "neutral"]).notNull(),
  horizon: mysqlEnum("horizon", ["1D", "7D", "30D", "60D"]).notNull(),
  confidence: int("confidence").notNull(), // 0-100
  reasoning: text("reasoning").notNull(),
  priceTarget: int("priceTarget"), // in cents
  priceAtPrediction: int("priceAtPrediction"), // in cents
  category: varchar("category", { length: 100 }),
  generatedAt: timestamp("generatedAt").defaultNow().notNull(),
  agentVersion: varchar("agentVersion", { length: 50 }),
  // Outcome tracking
  outcome: mysqlEnum("outcome", ["correct", "incorrect", "pending"]).default("pending"),
  priceAtResolution: int("priceAtResolution"), // in cents
  resolvedAt: timestamp("resolvedAt"),
  accuracyScore: int("accuracyScore"), // 0-100 how close was the prediction
});
export type AiPrediction = typeof aiPredictions.$inferSelect;
export type InsertAiPrediction = typeof aiPredictions.$inferInsert;

// ============================================================================
// Model Versions & Training Loop
// ============================================================================

export const modelVersions = mysqlTable("model_versions", {
  id: int("id").autoincrement().primaryKey(),
  version: varchar("version", { length: 50 }).notNull(),
  accuracy: int("accuracy"), // 0-100
  totalPredictions: int("totalPredictions").default(0),
  correctPredictions: int("correctPredictions").default(0),
  weights: text("weights").notNull(), // JSON: signal source weights
  changelog: text("changelog"), // What changed in this version
  trainedAt: timestamp("trainedAt").defaultNow().notNull(),
});
export type ModelVersion = typeof modelVersions.$inferSelect;
export type InsertModelVersion = typeof modelVersions.$inferInsert;

// ============================================================================
// Agent Status Tracking
// ============================================================================

export const agentRuns = mysqlTable("agent_runs", {
  id: int("id").autoincrement().primaryKey(),
  agentType: mysqlEnum("agentType", ["research", "improvement", "ingestion"]).notNull(),
  status: mysqlEnum("status", ["running", "completed", "failed"]).notNull(),
  signalsProcessed: int("signalsProcessed").default(0),
  narrativesGenerated: int("narrativesGenerated").default(0),
  predictionsGenerated: int("predictionsGenerated").default(0),
  errorMessage: text("errorMessage"),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
  metadata: text("metadata"), // JSON blob for run-specific data
});
export type AgentRun = typeof agentRuns.$inferSelect;
export type InsertAgentRun = typeof agentRuns.$inferInsert;

// ============================================================================
// High-Signal Account Monitoring (VIP Twitter/X Accounts)
// ============================================================================

export const signalSources = mysqlTable("signal_sources", {
  id: int("id").autoincrement().primaryKey(),
  /** Twitter/X handle (without @) */
  handle: varchar("handle", { length: 100 }).notNull().unique(),
  /** Display name */
  displayName: varchar("displayName", { length: 255 }).notNull(),
  /** Category of the account */
  category: mysqlEnum("category", [
    "investor_trader",
    "economist_fed",
    "politician_policy",
    "tech_leader",
    "financial_media",
    "custom",
  ]).notNull(),
  /** Signal weight multiplier (1-5, default 3 for VIP accounts) */
  weightMultiplier: int("weightMultiplier").default(3).notNull(),
  /** Brief description of why this account matters */
  description: text("description"),
  /** Whether this is a contrarian indicator (e.g., Jim Cramer) */
  isContrarian: int("isContrarian").default(0).notNull(),
  /** Whether this account is actively monitored */
  isActive: int("isActive").default(1).notNull(),
  /** Whether this was added by a user (vs. system default) */
  addedByUserId: int("addedByUserId"),
  /** Followers count (for display) */
  followersCount: int("followersCount"),
  /** Profile image URL */
  avatarUrl: text("avatarUrl"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type SignalSource = typeof signalSources.$inferSelect;
export type InsertSignalSource = typeof signalSources.$inferInsert;

/** VIP tweets — tweets from monitored high-signal accounts */
export const vipTweets = mysqlTable("vip_tweets", {
  id: int("id").autoincrement().primaryKey(),
  /** Reference to signal_sources */
  sourceId: int("sourceId").notNull(),
  /** Twitter/X handle */
  handle: varchar("handle", { length: 100 }).notNull(),
  /** Tweet content */
  content: text("content").notNull(),
  /** Extracted tickers mentioned */
  tickers: text("tickers"), // JSON array
  /** Sentiment analysis result */
  sentiment: mysqlEnum("sentiment", ["bullish", "bearish", "neutral"]),
  sentimentScore: int("sentimentScore"), // -100 to 100
  /** Whether this tweet triggered a prediction */
  triggeredPrediction: int("triggeredPrediction").default(0).notNull(),
  /** Market relevance score 0-100 */
  relevanceScore: int("relevanceScore"),
  /** Engagement metrics */
  likes: int("likes").default(0),
  retweets: int("retweets").default(0),
  /** Whether this is a "Chris Camillo Signal" type consumer trend */
  isConsumerTrend: int("isConsumerTrend").default(0).notNull(),
  /** JSON metadata (extracted companies, trend analysis, etc.) */
  metadata: text("metadata"),
  tweetedAt: timestamp("tweetedAt").defaultNow().notNull(),
  ingestedAt: timestamp("ingestedAt").defaultNow().notNull(),
});
export type VipTweet = typeof vipTweets.$inferSelect;
export type InsertVipTweet = typeof vipTweets.$inferInsert;

// ============================================================================
// X/Twitter Trending Topics
// ============================================================================

export const trendingTopics = mysqlTable("trending_topics", {
  id: int("id").autoincrement().primaryKey(),
  /** Topic name or hashtag */
  topic: varchar("topic", { length: 255 }).notNull(),
  /** Tweet volume */
  tweetVolume: int("tweetVolume").default(0),
  /** Velocity: rising, stable, falling */
  velocity: mysqlEnum("velocity", ["rising", "stable", "falling"]).default("stable"),
  /** Sentiment */
  sentiment: mysqlEnum("sentiment", ["bullish", "bearish", "neutral"]).default("neutral"),
  sentimentScore: int("sentimentScore"), // -100 to 100
  /** Related tickers (JSON array) */
  relatedTickers: text("relatedTickers"),
  /** Whether this is a BREAKING trend (spiked in last 15 min) */
  isBreaking: int("isBreaking").default(0).notNull(),
  /** Category: macro, earnings, sector, crypto, geopolitical, etc. */
  category: varchar("category", { length: 64 }),
  /** Rank position (1 = top trending) */
  rank: int("rank"),
  /** When this trend was first detected */
  firstSeenAt: timestamp("firstSeenAt").defaultNow().notNull(),
  /** Last time this trend was updated */
  lastUpdatedAt: timestamp("lastUpdatedAt").defaultNow().notNull(),
});
export type TrendingTopic = typeof trendingTopics.$inferSelect;
export type InsertTrendingTopic = typeof trendingTopics.$inferInsert;

// ============================================================================
// Prediction Markets (Polymarket / Kalshi)
// ============================================================================

export const predictionMarkets = mysqlTable("prediction_markets", {
  id: int("id").autoincrement().primaryKey(),
  /** Source platform */
  platform: mysqlEnum("platform", ["polymarket", "kalshi"]).notNull(),
  /** External market/contract ID */
  externalId: varchar("externalId", { length: 255 }).notNull(),
  /** Market question/title */
  title: text("title").notNull(),
  /** Current YES probability (0-100) */
  yesProbability: int("yesProbability").notNull(),
  /** Previous probability for calculating change */
  previousProbability: int("previousProbability"),
  /** 24h probability change (basis points) */
  probabilityChange24h: int("probabilityChange24h").default(0),
  /** Trading volume (in dollars) */
  volume: int("volume").default(0),
  /** Volume in last 24h */
  volume24h: int("volume24h").default(0),
  /** Liquidity */
  liquidity: int("liquidity").default(0),
  /** Related tickers (JSON array) */
  relatedTickers: text("relatedTickers"),
  /** Category: earnings, fed, macro, crypto, geopolitical, etc. */
  category: varchar("category", { length: 64 }),
  /** Whether this market has unusual volume (HOT badge) */
  isHot: int("isHot").default(0).notNull(),
  /** Market end date */
  endDate: timestamp("endDate"),
  /** Market status */
  status: mysqlEnum("status", ["active", "resolved", "closed"]).default("active"),
  /** Resolution outcome if resolved */
  resolution: varchar("resolution", { length: 50 }),
  lastFetchedAt: timestamp("lastFetchedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type PredictionMarket = typeof predictionMarkets.$inferSelect;
export type InsertPredictionMarket = typeof predictionMarkets.$inferInsert;
