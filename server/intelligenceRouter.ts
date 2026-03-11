/**
 * Intelligence Router — tRPC endpoints for the agentic intelligence engine
 * 
 * Provides endpoints for:
 * - VIP account monitoring (CRUD + tweet feed)
 * - X/Twitter trending topics
 * - Prediction markets (Polymarket/Kalshi)
 * - Alpha Score computation
 * - Arbitrage signal detection
 * - VIP notification preferences
 * - Agent status dashboard
 */

import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import {
  getWatchedAccounts, addWatchedAccount, updateWatchedAccount,
  removeWatchedAccount, getRecentVipTweets, getVipTweetsForAccount,
  getVipStats, getVipMonitorStatus,
} from "./vipAccountMonitor";
import {
  getCurrentTrending, getTrendingHistory, getTrendingStats,
  getTrendingIngestionStatus,
} from "./trendingTopics";
import {
  getActiveMarkets, getHotMarkets, getMarketsForTicker,
  getMarketStats, getPredictionMarketIngestionStatus,
} from "./predictionMarkets";
import {
  getAlphaScores, getAlphaScoreForTicker, getArbitrageSignals,
  getTopArbitrageSignals, getAlphaEngineStatus,
} from "./alphaEngine";
import { getResearchAgentStatus } from "./researchAgent";
import { getImprovementStatus } from "./improvementAgent";
import { getIngestionStatus } from "./realIngestion";
import {
  getJournalEntries, getJournalEntriesForTicker, getJournalStats,
  getTradeJournalStatus,
} from "./tradeJournal";
import {
  createAlphaAlert, getAlphaAlerts, deleteAlphaAlert,
  toggleAlphaAlert, resetAlphaAlert, getLeaderboard,
  getTopOpportunities, getScoreHistory, getAvailableSectors,
  getAlphaAlertStatus,
} from "./alphaAlerts";
import {
  getSectorHeatmap, getSectorDrilldown, getBacktestResults,
  getSectorHeatmapStatus,
} from "./sectorHeatmap";
import {
  getDigestConfig, updateDigestConfig, getDigestHistory,
  getLatestDigest, previewDigest, triggerDigestNow,
  getDailyDigestStatus,
} from "./dailyDigest";
import {
  getMultiTimeframeScores, getMultiTimeframeForTicker,
  getSmartMoneyFlows, getSmartMoneyForTicker,
  getMultiTimeframeStatus,
} from "./multiTimeframeAlpha";
import {
  getRebalanceSuggestions, getRebalanceSuggestionsByPriority,
  dismissSuggestion, getRebalanceStatus,
} from "./rebalanceSuggestions";
import {
  getStrategies, getStrategy, createStrategy, updateStrategy,
  deleteStrategy, backtestStrategy, evaluateStrategy, getRuleTypes,
  getStrategyBuilderStatus,
} from "./strategyBuilder";
import {
  computeCorrelationMatrix, getCorrelationForTicker,
  getMostCorrelatedPairs, getLeastCorrelatedPairs,
  getCorrelationMatrixStatus,
} from "./correlationMatrix";
import {
  getUpcomingEarnings, getEarningsForTicker, getEarningsBadges,
  getEarningsAlphaPatterns, getRecentEarnings, getEarningsCalendarStatus,
} from "./earningsCalendar";
import {
  getMarketplaceStrategies, getMarketplaceStrategy, getFeaturedStrategies,
  cloneStrategy, publishStrategy, rateStrategy, getMarketplaceTags,
  getMarketplaceStats,
} from "./strategyMarketplace";
import {
  exportTradeJournalCsv, exportTradeJournalJson,
  exportLeaderboardCsv, exportLeaderboardJson,
  exportBacktestCsv, exportBacktestJson,
} from "./exportService";
import { getFullDataSourceStatus } from "./realIngestion";
import { getImprovementDelta, getBaseline } from "./evaluationHarness";

// ============================================================================
// VIP Notification Preferences (in-memory for now)
// ============================================================================

interface NotificationPref {
  handle: string;
  enabled: boolean;
}

let notificationPrefs: Map<string, boolean> = new Map([
  ["elonmusk", true],
  ["chriscamillo", true],
  ["michaeljburry", true],
  ["BillAckman", true],
]);

// Track recent VIP notifications for the frontend to poll
interface VipNotification {
  id: string;
  handle: string;
  displayName: string;
  ticker: string;
  content: string;
  sentiment: string;
  timestamp: number;
  read: boolean;
}

let vipNotifications: VipNotification[] = [];

export function pushVipNotification(notification: Omit<VipNotification, "id" | "read">) {
  if (!notificationPrefs.get(notification.handle)) return;
  
  vipNotifications.unshift({
    ...notification,
    id: `vipn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    read: false,
  });
  
  // Keep only last 50
  if (vipNotifications.length > 50) {
    vipNotifications = vipNotifications.slice(0, 50);
  }
}

export function isNotificationEnabled(handle: string): boolean {
  return notificationPrefs.get(handle) ?? false;
}

export const intelligenceRouter = router({
  // ============================================================================
  // VIP Account Monitoring
  // ============================================================================

  /** Get all watched VIP accounts */
  getWatchedAccounts: publicProcedure.query(async () => {
    return getWatchedAccounts();
  }),

  /** Add a new VIP account to watch */
  addWatchedAccount: publicProcedure
    .input(z.object({
      handle: z.string().min(1).max(100),
      displayName: z.string().min(1).max(255),
      category: z.enum(["investor_trader", "economist_fed", "politician_policy", "tech_leader", "financial_media", "custom"]),
      weightMultiplier: z.number().min(1).max(5).default(3),
      description: z.string().optional(),
      isContrarian: z.boolean().default(false),
    }))
    .mutation(async ({ input }) => {
      const result = await addWatchedAccount({
        handle: input.handle.replace("@", ""),
        displayName: input.displayName,
        category: input.category,
        weightMultiplier: input.weightMultiplier,
        description: input.description || null,
        isContrarian: input.isContrarian ? 1 : 0,
        isActive: 1,
        followersCount: null,
        avatarUrl: null,
      });
      return result;
    }),

  /** Update a VIP account */
  updateWatchedAccount: publicProcedure
    .input(z.object({
      id: z.number(),
      weightMultiplier: z.number().min(1).max(5).optional(),
      isActive: z.boolean().optional(),
      isContrarian: z.boolean().optional(),
      description: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const updates: Record<string, any> = {};
      if (input.weightMultiplier !== undefined) updates.weightMultiplier = input.weightMultiplier;
      if (input.isActive !== undefined) updates.isActive = input.isActive ? 1 : 0;
      if (input.isContrarian !== undefined) updates.isContrarian = input.isContrarian ? 1 : 0;
      if (input.description !== undefined) updates.description = input.description;
      await updateWatchedAccount(input.id, updates);
      return { success: true };
    }),

  /** Remove a VIP account */
  removeWatchedAccount: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await removeWatchedAccount(input.id);
      return { success: true };
    }),

  /** Get recent VIP tweets */
  getVipTweets: publicProcedure
    .input(z.object({ limit: z.number().default(50) }).optional())
    .query(async ({ input }) => {
      return getRecentVipTweets(input?.limit || 50);
    }),

  /** Get VIP tweets for a specific account */
  getVipTweetsForAccount: publicProcedure
    .input(z.object({ handle: z.string(), limit: z.number().default(20) }))
    .query(async ({ input }) => {
      return getVipTweetsForAccount(input.handle, input.limit);
    }),

  /** Get VIP monitoring stats */
  getVipStats: publicProcedure.query(async () => {
    return getVipStats();
  }),

  // ============================================================================
  // VIP Notification Preferences
  // ============================================================================

  /** Get notification preferences for all VIP accounts */
  getNotificationPrefs: publicProcedure.query(async () => {
    const prefs: NotificationPref[] = [];
    notificationPrefs.forEach((enabled, handle) => {
      prefs.push({ handle, enabled });
    });
    return prefs;
  }),

  /** Toggle notification for a VIP account */
  toggleNotification: publicProcedure
    .input(z.object({
      handle: z.string(),
      enabled: z.boolean(),
    }))
    .mutation(async ({ input }) => {
      notificationPrefs.set(input.handle, input.enabled);
      return { success: true, handle: input.handle, enabled: input.enabled };
    }),

  /** Get pending VIP notifications */
  getVipNotifications: publicProcedure
    .input(z.object({ limit: z.number().default(20) }).optional())
    .query(async ({ input }) => {
      const limit = input?.limit || 20;
      return {
        notifications: vipNotifications.slice(0, limit),
        unreadCount: vipNotifications.filter(n => !n.read).length,
      };
    }),

  /** Mark VIP notifications as read */
  markVipNotificationsRead: publicProcedure.mutation(async () => {
    for (const n of vipNotifications) {
      n.read = true;
    }
    return { success: true };
  }),

  // ============================================================================
  // X/Twitter Trending Topics
  // ============================================================================

  /** Get current trending topics */
  getTrending: publicProcedure
    .input(z.object({ limit: z.number().default(10) }).optional())
    .query(async ({ input }) => {
      return getCurrentTrending(input?.limit || 10);
    }),

  /** Get trending history */
  getTrendingHistory: publicProcedure
    .input(z.object({ hours: z.number().default(24) }).optional())
    .query(async ({ input }) => {
      return getTrendingHistory(input?.hours || 24);
    }),

  /** Get trending stats */
  getTrendingStats: publicProcedure.query(async () => {
    return getTrendingStats();
  }),

  // ============================================================================
  // Prediction Markets
  // ============================================================================

  /** Get active prediction markets */
  getMarkets: publicProcedure
    .input(z.object({ limit: z.number().default(20) }).optional())
    .query(async ({ input }) => {
      return getActiveMarkets(input?.limit || 20);
    }),

  /** Get hot prediction markets */
  getHotMarkets: publicProcedure.query(async () => {
    return getHotMarkets();
  }),

  /** Get markets related to a ticker */
  getMarketsForTicker: publicProcedure
    .input(z.object({ ticker: z.string() }))
    .query(async ({ input }) => {
      return getMarketsForTicker(input.ticker);
    }),

  /** Get prediction market stats */
  getMarketStats: publicProcedure.query(async () => {
    return getMarketStats();
  }),

  // ============================================================================
  // Alpha Score
  // ============================================================================

  /** Get all alpha scores sorted by score descending */
  getAlphaScores: publicProcedure.query(async () => {
    return getAlphaScores();
  }),

  /** Get alpha score for a specific ticker */
  getAlphaScore: publicProcedure
    .input(z.object({ ticker: z.string() }))
    .query(async ({ input }) => {
      return getAlphaScoreForTicker(input.ticker);
    }),

  // ============================================================================
  // Arbitrage Signals
  // ============================================================================

  /** Get all arbitrage signals */
  getArbitrageSignals: publicProcedure.query(async () => {
    return getArbitrageSignals();
  }),

  /** Get top arbitrage signals for dashboard */
  getTopArbitrageSignals: publicProcedure
    .input(z.object({ limit: z.number().default(5) }).optional())
    .query(async ({ input }) => {
      return getTopArbitrageSignals(input?.limit || 5);
    }),

  // ============================================================================
  // Trade Journal
  // ============================================================================

  /** Get trade journal entries */
  getJournalEntries: publicProcedure
    .input(z.object({ limit: z.number().default(50), offset: z.number().default(0) }).optional())
    .query(async ({ input }) => {
      return getJournalEntries(input?.limit || 50, input?.offset || 0);
    }),

  /** Get journal entries for a specific ticker */
  getJournalForTicker: publicProcedure
    .input(z.object({ ticker: z.string() }))
    .query(async ({ input }) => {
      return getJournalEntriesForTicker(input.ticker);
    }),

  /** Get journal stats (win rate, avg return, etc.) */
  getJournalStats: publicProcedure.query(async () => {
    return getJournalStats();
  }),

  // ============================================================================
  // Alpha Score Leaderboard
  // ============================================================================

  /** Get leaderboard with optional filters */
  getLeaderboard: publicProcedure
    .input(z.object({
      sector: z.string().optional(),
      minScore: z.number().optional(),
      signalType: z.string().optional(),
      limit: z.number().default(50),
    }).optional())
    .query(async ({ input }) => {
      return getLeaderboard({
        sector: input?.sector,
        minScore: input?.minScore,
        signalType: input?.signalType,
        limit: input?.limit || 50,
      });
    }),

  /** Get top opportunities (score > 75) */
  getTopOpportunities: publicProcedure
    .input(z.object({ limit: z.number().default(10) }).optional())
    .query(async ({ input }) => {
      return getTopOpportunities(input?.limit || 10);
    }),

  /** Get score history for a ticker (sparkline data) */
  getScoreHistory: publicProcedure
    .input(z.object({ ticker: z.string() }))
    .query(async ({ input }) => {
      return getScoreHistory(input.ticker);
    }),

  /** Get available sectors for filtering */
  getAvailableSectors: publicProcedure.query(async () => {
    return getAvailableSectors();
  }),

  // ============================================================================
  // Alpha Score Alerts
  // ============================================================================

  /** Get all alpha alerts */
  getAlphaAlerts: publicProcedure.query(async () => {
    return getAlphaAlerts();
  }),

  /** Create a new alpha alert */
  createAlphaAlert: publicProcedure
    .input(z.object({
      ticker: z.string().nullable(),
      condition: z.enum(["above", "below", "crosses_above", "crosses_below"]),
      threshold: z.number().min(0).max(100),
      label: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      return createAlphaAlert(input);
    }),

  /** Delete an alpha alert */
  deleteAlphaAlert: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      return deleteAlphaAlert(input.id);
    }),

  /** Toggle an alpha alert on/off */
  toggleAlphaAlert: publicProcedure
    .input(z.object({ id: z.string(), isActive: z.boolean() }))
    .mutation(async ({ input }) => {
      return toggleAlphaAlert(input.id, input.isActive);
    }),

  /** Reset a triggered alpha alert */
  resetAlphaAlert: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      return resetAlphaAlert(input.id);
    }),

  // ============================================================================
  // Sector Heatmap
  // ============================================================================

  /** Get sector heatmap data */
  getSectorHeatmap: publicProcedure.query(async () => {
    return getSectorHeatmap();
  }),

  /** Get sector drilldown for a specific sector */
  getSectorDrilldown: publicProcedure
    .input(z.object({ sector: z.string() }))
    .query(async ({ input }) => {
      return getSectorDrilldown(input.sector);
    }),

  // ============================================================================
  // Alpha Score Backtesting
  // ============================================================================

  /** Get backtest results */
  getBacktestResults: publicProcedure.query(async () => {
    return getBacktestResults();
  }),

  // ============================================================================
  // Daily Digest
  // ============================================================================

  /** Get digest configuration */
  getDigestConfig: publicProcedure.query(async () => {
    return getDigestConfig();
  }),

  /** Update digest configuration */
  updateDigestConfig: publicProcedure
    .input(z.object({
      enabled: z.boolean().optional(),
      sendHour: z.number().min(0).max(23).optional(),
      includeTopMovers: z.boolean().optional(),
      includeArbitrageSignals: z.boolean().optional(),
      includeJournalResults: z.boolean().optional(),
      includeSectorSummary: z.boolean().optional(),
      includeTopOpportunities: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      return updateDigestConfig(input);
    }),

  /** Get digest history */
  getDigestHistory: publicProcedure
    .input(z.object({ limit: z.number().default(10) }).optional())
    .query(async ({ input }) => {
      return getDigestHistory(input?.limit || 10);
    }),

  /** Get latest digest */
  getLatestDigest: publicProcedure.query(async () => {
    return getLatestDigest();
  }),

  /** Preview what the next digest would look like */
  previewDigest: publicProcedure.query(async () => {
    return previewDigest();
  }),

  /** Trigger sending a digest now */
  sendDigestNow: publicProcedure.mutation(async () => {
    await triggerDigestNow();
    return { success: true };
  }),

  // ============================================================================
  // Agent Status Dashboard
  // ============================================================================

  /** Get comprehensive agent status */
  getAgentStatus: publicProcedure.query(async () => {
    const researchAgent = getResearchAgentStatus();
    const improvementAgent = getImprovementStatus();
    const ingestionAgent = getIngestionStatus();
    const vipMonitor = getVipMonitorStatus();
    const trendingAgent = getTrendingIngestionStatus();
    const marketAgent = getPredictionMarketIngestionStatus();
    const alphaEngine = getAlphaEngineStatus();
    const tradeJournalStatus = getTradeJournalStatus();
    const alphaAlertStatus = getAlphaAlertStatus();

    return {
      researchAgent: {
        name: "Research Agent",
        description: "LLM-powered narrative and prediction generation",
        status: researchAgent.isRunning ? "running" : researchAgent.lastRun ? "idle" : "starting",
        lastRun: researchAgent.lastRun,
        nextRun: researchAgent.nextRun,
        signalsProcessed: researchAgent.signalsProcessed,
        narrativesGenerated: researchAgent.narrativesGenerated,
        predictionsGenerated: researchAgent.predictionsGenerated,
        currentVersion: researchAgent.currentVersion,
        lastError: researchAgent.lastError,
      },
      improvementAgent: {
        name: "Improvement Agent",
        description: "Self-improving model that learns from prediction outcomes",
        status: improvementAgent.isTraining ? "running" : improvementAgent.lastTrainingRun ? "idle" : "starting",
        lastRun: improvementAgent.lastTrainingRun,
        nextRun: improvementAgent.nextTrainingRun,
        currentVersion: improvementAgent.currentModelVersion,
        accuracy: improvementAgent.currentAccuracy,
        predictionsEvaluated: improvementAgent.predictionsEvaluated,
        versionsPublished: improvementAgent.versionsPublished,
        lastError: improvementAgent.lastError,
      },
      ingestionAgent: {
        name: "Data Ingestion",
        description: "Real-time data from Reddit, Yahoo Finance, RSS feeds",
        status: ingestionAgent.isRunning ? "running" : ingestionAgent.lastRun ? "idle" : "starting",
        lastRun: ingestionAgent.lastRun,
        nextRun: ingestionAgent.nextRun,
        sourcesActive: ingestionAgent.sourcesActive,
        signalsPerHour: ingestionAgent.signalsPerHour,
        totalSignalsToday: ingestionAgent.totalSignalsToday,
        sourceBreakdown: ingestionAgent.sourceBreakdown,
        lastError: ingestionAgent.lastError,
      },
      vipMonitor: {
        name: "VIP Account Monitor",
        description: "High-signal Twitter/X account tracking with 3-5x weighting",
        status: vipMonitor.intervalActive ? "running" : "stopped",
        totalGenerated: vipMonitor.totalGenerated,
        lastGenerated: vipMonitor.lastGenerated,
      },
      trendingAgent: {
        name: "Trending Topics",
        description: "X/Twitter finance trending topics tracker",
        status: trendingAgent.isActive ? "running" : "stopped",
        lastRefresh: trendingAgent.lastRefresh,
        cycleCount: trendingAgent.cycleCount,
      },
      predictionMarkets: {
        name: "Prediction Markets",
        description: "Polymarket & Kalshi prediction market data",
        status: marketAgent.isActive ? "running" : "stopped",
        lastFetch: marketAgent.lastFetch,
        fetchCycleCount: marketAgent.fetchCycleCount,
        realDataAvailable: marketAgent.realDataAvailable,
      },
      alphaEngine: {
        name: "Alpha Engine",
        description: "Composite alpha scoring + arbitrage signal detection",
        status: alphaEngine.status,
        tickersScored: alphaEngine.tickersScored,
        arbitrageSignals: alphaEngine.arbitrageSignals,
        lastCompute: alphaEngine.lastCompute,
        computeCount: alphaEngine.computeCount,
      },
      tradeJournal: {
        ...tradeJournalStatus,
      },
      alphaAlerts: {
        ...alphaAlertStatus,
      },
      sectorHeatmap: getSectorHeatmapStatus(),
      dailyDigest: getDailyDigestStatus(),
      multiTimeframe: getMultiTimeframeStatus(),
      rebalancer: getRebalanceStatus(),
    };
  }),

  // ============================================================================
  // Multi-Timeframe Alpha Score
  // ============================================================================

  /** Get multi-timeframe alpha scores for all tickers */
  getMultiTimeframeScores: publicProcedure.query(async () => {
    return getMultiTimeframeScores();
  }),

  /** Get multi-timeframe alpha score for a specific ticker */
  getMultiTimeframeForTicker: publicProcedure
    .input(z.object({ ticker: z.string() }))
    .query(async ({ input }) => {
      return getMultiTimeframeForTicker(input.ticker);
    }),

  // ============================================================================
  // Smart Money Flow
  // ============================================================================

  /** Get smart money flow indicators for all tickers */
  getSmartMoneyFlows: publicProcedure.query(async () => {
    return getSmartMoneyFlows();
  }),

  /** Get smart money flow for a specific ticker */
  getSmartMoneyForTicker: publicProcedure
    .input(z.object({ ticker: z.string() }))
    .query(async ({ input }) => {
      return getSmartMoneyForTicker(input.ticker);
    }),

  // ============================================================================
  // Portfolio Rebalancing Suggestions
  // ============================================================================

  /** Get all active rebalancing suggestions */
  getRebalanceSuggestions: publicProcedure
    .input(z.object({ priority: z.enum(["critical", "high", "medium", "low"]).optional() }).optional())
    .query(async ({ input }) => {
      return getRebalanceSuggestionsByPriority(input?.priority);
    }),

  /** Dismiss a rebalancing suggestion */
  dismissSuggestion: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const dismissed = dismissSuggestion(input.id);
      return { success: dismissed };
    }),

  // ============================================================================
  // Strategy Builder
  // ============================================================================

  /** Get all strategies */
  getStrategies: publicProcedure.query(async () => {
    return getStrategies();
  }),

  /** Get a single strategy by ID */
  getStrategy: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      return getStrategy(input.id);
    }),

  /** Get available rule types for the visual builder */
  getRuleTypes: publicProcedure.query(async () => {
    return getRuleTypes();
  }),

  /** Create a new strategy */
  createStrategy: publicProcedure
    .input(z.object({
      name: z.string().min(1).max(100),
      description: z.string().max(500).default(""),
      entryRules: z.any(),
      exitRules: z.any().nullable(),
      action: z.enum(["buy", "sell", "hold", "alert_only"]),
    }))
    .mutation(async ({ input }) => {
      return createStrategy(input);
    }),

  /** Update a strategy */
  updateStrategy: publicProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().optional(),
      description: z.string().optional(),
      entryRules: z.any().optional(),
      exitRules: z.any().nullable().optional(),
      action: z.enum(["buy", "sell", "hold", "alert_only"]).optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...updates } = input;
      return updateStrategy(id, updates);
    }),

  /** Delete a strategy */
  deleteStrategy: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      return deleteStrategy(input.id);
    }),

  /** Backtest a strategy */
  backtestStrategy: publicProcedure
    .input(z.object({
      id: z.string(),
      periodDays: z.number().min(7).max(365).default(90),
    }))
    .mutation(async ({ input }) => {
      return backtestStrategy(input.id, input.periodDays);
    }),

  /** Evaluate a strategy against current market state */
  evaluateStrategy: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      return evaluateStrategy(input.id);
    }),

  // ============================================================================
  // Correlation Matrix
  // ============================================================================

  /** Get full correlation matrix */
  getCorrelationMatrix: publicProcedure
    .input(z.object({ lookbackDays: z.number().min(7).max(90).default(30) }).optional())
    .query(async ({ input }) => {
      return computeCorrelationMatrix(input?.lookbackDays || 30);
    }),

  /** Get correlations for a specific ticker */
  getCorrelationForTicker: publicProcedure
    .input(z.object({ ticker: z.string() }))
    .query(async ({ input }) => {
      return getCorrelationForTicker(input.ticker);
    }),

  /** Get most correlated pairs */
  getMostCorrelatedPairs: publicProcedure
    .input(z.object({ limit: z.number().default(10) }).optional())
    .query(async ({ input }) => {
      return getMostCorrelatedPairs(input?.limit || 10);
    }),

  /** Get least correlated pairs (diversification opportunities) */
  getLeastCorrelatedPairs: publicProcedure
    .input(z.object({ limit: z.number().default(10) }).optional())
    .query(async ({ input }) => {
      return getLeastCorrelatedPairs(input?.limit || 10);
    }),

  // ============================================================================
  // Earnings Calendar
  // ============================================================================
  /** Get upcoming earnings for next N days */
  getUpcomingEarnings: publicProcedure
    .input(z.object({ days: z.number().min(1).max(30).default(7) }).optional())
    .query(async ({ input }) => {
      return getUpcomingEarnings(input?.days || 7);
    }),
  /** Get earnings for a specific ticker */
  getEarningsForTicker: publicProcedure
    .input(z.object({ ticker: z.string() }))
    .query(async ({ input }) => {
      return getEarningsForTicker(input.ticker);
    }),
  /** Get earnings badges for tickers near earnings */
  getEarningsBadges: publicProcedure
    .query(async () => {
      return getEarningsBadges();
    }),
  /** Get alpha score patterns around earnings for a ticker */
  getEarningsAlphaPatterns: publicProcedure
    .input(z.object({ ticker: z.string() }))
    .query(async ({ input }) => {
      return getEarningsAlphaPatterns(input.ticker);
    }),
  /** Get recent earnings events */
  getRecentEarnings: publicProcedure
    .input(z.object({ limit: z.number().default(10) }).optional())
    .query(async ({ input }) => {
      return getRecentEarnings(input?.limit || 10);
    }),

  // ============================================================================
  // Strategy Marketplace
  // ============================================================================
  /** Get marketplace strategies with filters */
  getMarketplaceStrategies: publicProcedure
    .input(z.object({
      sortBy: z.enum(["performance", "popular", "newest", "rating"]).default("performance"),
      tag: z.string().optional(),
      minWinRate: z.number().optional(),
      minSharpe: z.number().optional(),
      featured: z.boolean().optional(),
    }).optional())
    .query(async ({ input }) => {
      return getMarketplaceStrategies(input || undefined);
    }),
  /** Get a single marketplace strategy */
  getMarketplaceStrategy: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      return getMarketplaceStrategy(input.id);
    }),
  /** Get featured strategies */
  getFeaturedStrategies: publicProcedure
    .query(async () => {
      return getFeaturedStrategies();
    }),
  /** Clone a marketplace strategy */
  cloneStrategy: publicProcedure
    .input(z.object({ marketplaceId: z.string() }))
    .mutation(async ({ input }) => {
      return cloneStrategy(input.marketplaceId, "current-user");
    }),
  /** Publish a strategy to marketplace */
  publishStrategy: publicProcedure
    .input(z.object({
      strategyId: z.string(),
      tags: z.array(z.string()).default([]),
    }))
    .mutation(async ({ input }) => {
      return publishStrategy(input.strategyId, "current-user", "You", input.tags);
    }),
  /** Rate a marketplace strategy */
  rateMarketplaceStrategy: publicProcedure
    .input(z.object({ marketplaceId: z.string(), rating: z.number().min(1).max(5) }))
    .mutation(async ({ input }) => {
      return rateStrategy(input.marketplaceId, input.rating);
    }),
  /** Get available marketplace tags */
  getMarketplaceTags: publicProcedure
    .query(async () => {
      return getMarketplaceTags();
    }),
  /** Get marketplace stats */
  getMarketplaceStats: publicProcedure
    .query(async () => {
      return getMarketplaceStats();
    }),

  // ============================================================================
  // Export Service
  // ============================================================================
  /** Export trade journal as CSV */
  exportTradeJournalCsv: publicProcedure
    .query(async () => {
      return exportTradeJournalCsv();
    }),
  /** Export trade journal as JSON */
  exportTradeJournalJson: publicProcedure
    .query(async () => {
      return exportTradeJournalJson();
    }),
  /** Export alpha leaderboard as CSV */
  exportLeaderboardCsv: publicProcedure
    .query(async () => {
      return exportLeaderboardCsv();
    }),
  /** Export alpha leaderboard as JSON */
  exportLeaderboardJson: publicProcedure
    .query(async () => {
      return exportLeaderboardJson();
    }),
  /** Export backtest results as CSV */
  exportBacktestCsv: publicProcedure
    .input(z.object({ strategyId: z.string() }))
    .query(async ({ input }) => {
      const strategy = getStrategy(input.strategyId);
      return exportBacktestCsv(strategy?.backtestResults);
    }),
  /** Export backtest results as JSON */
  exportBacktestJson: publicProcedure
    .input(z.object({ strategyId: z.string() }))
    .query(async ({ input }) => {
      const strategy = getStrategy(input.strategyId);
      return exportBacktestJson(strategy?.backtestResults);
    }),

  // ============================================================================
  // Data Source Status Dashboard
  // ============================================================================

  /** Get comprehensive status of all data sources */
  getDataSourceStatus: publicProcedure.query(async () => {
    return getFullDataSourceStatus();
  }),

  // ============================================================================
  // Evaluation Harness & Baseline
  // ============================================================================

  /** Get the formal baseline for comparison */
  getBaseline: publicProcedure.query(async () => {
    return getBaseline();
  }),

  /** Get improvement delta vs baseline */
  getImprovementDelta: publicProcedure.query(async () => {
    const status = getImprovementStatus();
    return getImprovementDelta(status.currentAccuracy);
  }),
});
