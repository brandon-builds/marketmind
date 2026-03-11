import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  getWatchlist,
  addToWatchlist,
  removeFromWatchlist,
  getPortfolioHoldings,
  upsertPortfolioHolding,
  removePortfolioHolding,
  getUserSettings,
  upsertUserSettings,
  createSharedReport,
  getSharedReport,
  getUserSharedReports,
  deleteSharedReport,
  getSavedFilters,
  createSavedFilter,
  deleteSavedFilter,
  trackEvent,
  getAnalyticsSummary,
  getUserAlerts,
  createUserAlert,
  deleteUserAlert,
  createSharedWatchlist,
  getMySharedWatchlists,
  getSharedWatchlistById,
  joinSharedWatchlist,
  getSharedWatchlistMembers,
  isWatchlistMember,
  getSharedWatchlistTickers,
  addTickerToSharedWatchlist,
  removeTickerFromSharedWatchlist,
  getAnnotations,
  createAnnotation,
  deleteAnnotation,
  deleteSharedWatchlist,
  leaveSharedWatchlist,
  getUserWeightProfile,
  getAllWeightProfiles,
  saveWeightProfile,
  activateWeightProfile,
  deleteWeightProfile,
  getUserReports,
  deleteGeneratedReport,
  getUserNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
  getReportSchedules,
  createReportSchedule,
  updateReportSchedule,
  deleteReportSchedule,
  createDashboardSnapshot,
  getDashboardSnapshot,
  listDashboardSnapshots,
  deleteDashboardSnapshot,
} from "./db";
import { TRPCError } from "@trpc/server";
import { broadcastAnnotation, broadcastAnnotationDeleted } from "./websocket";
import { generateWeeklyReport } from "./reportGenerator";

export const watchlistRouter = router({
  // ─── Watchlist ───

  list: protectedProcedure.query(async ({ ctx }) => {
    const items = await getWatchlist(ctx.user.id);
    return items.map((item) => ({
      ticker: item.ticker,
      addedAt: item.addedAt.getTime(),
    }));
  }),

  add: protectedProcedure
    .input(z.object({ ticker: z.string().min(1).max(16) }))
    .mutation(async ({ ctx, input }) => {
      const ticker = input.ticker.toUpperCase();
      await addToWatchlist(ctx.user.id, ticker);
      return { success: true, ticker };
    }),

  remove: protectedProcedure
    .input(z.object({ ticker: z.string().min(1).max(16) }))
    .mutation(async ({ ctx, input }) => {
      const ticker = input.ticker.toUpperCase();
      await removeFromWatchlist(ctx.user.id, ticker);
      return { success: true, ticker };
    }),

  // ─── Portfolio Holdings (persistent) ───

  portfolioList: protectedProcedure.query(async ({ ctx }) => {
    const items = await getPortfolioHoldings(ctx.user.id);
    return items.map((item) => ({
      ticker: item.ticker,
      shares: item.shares,
      addedAt: item.addedAt.getTime(),
      updatedAt: item.updatedAt.getTime(),
    }));
  }),

  portfolioUpsert: protectedProcedure
    .input(
      z.object({
        ticker: z.string().min(1).max(16),
        shares: z.number().int().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const ticker = input.ticker.toUpperCase();
      await upsertPortfolioHolding(ctx.user.id, ticker, input.shares);
      return { success: true, ticker, shares: input.shares };
    }),

  portfolioRemove: protectedProcedure
    .input(z.object({ ticker: z.string().min(1).max(16) }))
    .mutation(async ({ ctx, input }) => {
      const ticker = input.ticker.toUpperCase();
      await removePortfolioHolding(ctx.user.id, ticker);
      return { success: true, ticker };
    }),

  // ─── User Settings ───

  settingsGet: protectedProcedure.query(async ({ ctx }) => {
    const settings = await getUserSettings(ctx.user.id);
    if (!settings) {
      return {
        defaultTickers: "AAPL,MSFT,GOOGL,NVDA,TSLA",
        preferredHorizon: "7d",
        themePreference: "dark",
        notificationsEnabled: true,
        emailDigest: "none",
        showOnboarding: true,
      };
    }
    return {
      defaultTickers: settings.defaultTickers || "AAPL,MSFT,GOOGL,NVDA,TSLA",
      preferredHorizon: settings.preferredHorizon || "7d",
      themePreference: settings.themePreference || "dark",
      notificationsEnabled: settings.notificationsEnabled === 1,
      emailDigest: settings.emailDigest || "none",
      showOnboarding: settings.showOnboarding === 1,
    };
  }),

  settingsUpdate: protectedProcedure
    .input(
      z.object({
        defaultTickers: z.string().optional(),
        preferredHorizon: z.enum(["1d", "7d", "30d"]).optional(),
        themePreference: z.enum(["dark", "light", "system"]).optional(),
        notificationsEnabled: z.boolean().optional(),
        emailDigest: z.enum(["none", "daily", "weekly"]).optional(),
        showOnboarding: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const dbSettings: Record<string, unknown> = {};
      if (input.defaultTickers !== undefined) dbSettings.defaultTickers = input.defaultTickers;
      if (input.preferredHorizon !== undefined) dbSettings.preferredHorizon = input.preferredHorizon;
      if (input.themePreference !== undefined) dbSettings.themePreference = input.themePreference;
      if (input.notificationsEnabled !== undefined) dbSettings.notificationsEnabled = input.notificationsEnabled ? 1 : 0;
      if (input.emailDigest !== undefined) dbSettings.emailDigest = input.emailDigest;
      if (input.showOnboarding !== undefined) dbSettings.showOnboarding = input.showOnboarding ? 1 : 0;
      await upsertUserSettings(ctx.user.id, dbSettings as any);
      return { success: true };
    }),

  // ─── Digest ───
  sendTestDigest: protectedProcedure.mutation(async ({ ctx }) => {
    const { sendTestDigest } = await import("./digestJob");
    return sendTestDigest(ctx.user.id, ctx.user.name || "User");
  }),

  // ─── Shared Reports ───

  shareCreate: protectedProcedure
    .input(
      z.object({
        reportType: z.enum(["backtest", "portfolio"]),
        title: z.string().min(1).max(256),
        data: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const shareId = await createSharedReport(
        ctx.user.id,
        input.reportType,
        input.title,
        input.data
      );
      return { shareId };
    }),

  shareGet: publicProcedure
    .input(z.object({ shareId: z.string().min(1).max(32) }))
    .query(async ({ input }) => {
      const report = await getSharedReport(input.shareId);
      if (!report) return null;
      return {
        shareId: report.shareId,
        reportType: report.reportType,
        title: report.title,
        data: report.data,
        views: report.views,
        createdAt: report.createdAt.getTime(),
        expiresAt: report.expiresAt?.getTime() ?? null,
      };
    }),

  shareList: protectedProcedure.query(async ({ ctx }) => {
    const reports = await getUserSharedReports(ctx.user.id);
    return reports.map((r) => ({
      shareId: r.shareId,
      reportType: r.reportType,
      title: r.title,
      views: r.views,
      createdAt: r.createdAt.getTime(),
      expiresAt: r.expiresAt?.getTime() ?? null,
    }));
  }),

  shareDelete: protectedProcedure
    .input(z.object({ shareId: z.string().min(1).max(32) }))
    .mutation(async ({ ctx, input }) => {
      await deleteSharedReport(ctx.user.id, input.shareId);
      return { success: true };
    }),

  // ─── Saved Filters ───

  filtersList: protectedProcedure
    .input(z.object({ page: z.string().min(1).max(32) }))
    .query(async ({ ctx, input }) => {
      const filters = await getSavedFilters(ctx.user.id, input.page);
      return filters.map((f) => ({
        id: f.id,
        name: f.name,
        filters: f.filters,
        createdAt: f.createdAt.getTime(),
      }));
    }),

  filtersCreate: protectedProcedure
    .input(
      z.object({
        page: z.string().min(1).max(32),
        name: z.string().min(1).max(128),
        filters: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await createSavedFilter(ctx.user.id, input.page, input.name, input.filters);
      return { success: true };
    }),

  filtersDelete: protectedProcedure
    .input(z.object({ filterId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      await deleteSavedFilter(ctx.user.id, input.filterId);
      return { success: true };
    }),

  // ─── Analytics Tracking ───

  trackEvent: protectedProcedure
    .input(
      z.object({
        event: z.string().min(1).max(64),
        page: z.string().max(64).optional(),
        ticker: z.string().max(16).optional(),
        metadata: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await trackEvent(ctx.user.id, input.event, input.page, input.ticker, input.metadata);
      return { success: true };
    }),

  // ─── Alerts (Server-side) ───

  alertsList: protectedProcedure.query(async ({ ctx }) => {
    const alerts = await getUserAlerts(ctx.user.id);
    return alerts.map((a) => ({
      id: a.id,
      ticker: a.ticker,
      type: a.type,
      threshold: a.threshold,
      sentimentFilter: a.sentimentFilter ?? null,
      keyword: a.keyword ?? null,
      triggerContext: a.triggerContext ?? null,
      triggered: a.triggered === 1,
      triggeredAt: a.triggeredAt ? a.triggeredAt.getTime() : null,
      createdAt: a.createdAt.getTime(),
    }));
  }),

  alertsCreate: protectedProcedure
    .input(
      z.object({
        ticker: z.string().min(1).max(16),
        type: z.enum(["price_above", "price_below", "sentiment_above", "sentiment_below", "narrative_mention", "sentiment_shift"]),
        threshold: z.number().min(0).default(0),
        sentimentFilter: z.enum(["bullish", "bearish", "any"]).optional(),
        keyword: z.string().max(128).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await createUserAlert(
        ctx.user.id,
        input.ticker,
        input.type,
        Math.round(input.threshold * 100),
        input.sentimentFilter,
        input.keyword
      );
      return { success: true };
    }),

  alertsDelete: protectedProcedure
    .input(z.object({ alertId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      await deleteUserAlert(ctx.user.id, input.alertId);
      return { success: true };
    }),

  // ─── Collaborative Watchlists ───

  collabList: protectedProcedure.query(async ({ ctx }) => {
    const lists = await getMySharedWatchlists(ctx.user.id);
    return lists.map(l => ({
      id: l.id,
      name: l.name,
      description: l.description,
      inviteCode: l.inviteCode,
      isPublic: l.isPublic === 1,
      role: l.role,
      ownerId: l.ownerId,
      createdAt: l.createdAt.getTime(),
    }));
  }),

  collabCreate: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(128),
      description: z.string().max(500).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const wl = await createSharedWatchlist(ctx.user.id, input.name, input.description);
      return wl ? { id: wl.id, inviteCode: wl.inviteCode } : null;
    }),

  collabJoin: protectedProcedure
    .input(z.object({ inviteCode: z.string().min(1).max(32) }))
    .mutation(async ({ ctx, input }) => {
      const wl = await joinSharedWatchlist(ctx.user.id, input.inviteCode);
      return { id: wl.id, name: wl.name };
    }),

  collabDelete: protectedProcedure
    .input(z.object({ watchlistId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await deleteSharedWatchlist(ctx.user.id, input.watchlistId);
      return { success: true };
    }),

  collabLeave: protectedProcedure
    .input(z.object({ watchlistId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await leaveSharedWatchlist(ctx.user.id, input.watchlistId);
      return { success: true };
    }),

  collabDetail: protectedProcedure
    .input(z.object({ watchlistId: z.number() }))
    .query(async ({ ctx, input }) => {
      const isMember = await isWatchlistMember(ctx.user.id, input.watchlistId);
      if (!isMember) throw new TRPCError({ code: "FORBIDDEN", message: "Not a member" });
      const wl = await getSharedWatchlistById(input.watchlistId);
      if (!wl) throw new TRPCError({ code: "NOT_FOUND" });
      const members = await getSharedWatchlistMembers(input.watchlistId);
      const tickers = await getSharedWatchlistTickers(input.watchlistId);
      return {
        id: wl.id,
        name: wl.name,
        description: wl.description,
        inviteCode: wl.inviteCode,
        isPublic: wl.isPublic === 1,
        ownerId: wl.ownerId,
        members: members.map(m => ({
          userId: m.userId,
          name: m.userName ?? "Anonymous",
          role: m.role,
          joinedAt: m.joinedAt.getTime(),
        })),
        tickers: tickers.map(t => ({
          id: t.id,
          ticker: t.ticker,
          addedBy: t.addedByName ?? "Unknown",
          addedAt: t.addedAt.getTime(),
        })),
      };
    }),

  collabAddTicker: protectedProcedure
    .input(z.object({ watchlistId: z.number(), ticker: z.string().min(1).max(16) }))
    .mutation(async ({ ctx, input }) => {
      const isMember = await isWatchlistMember(ctx.user.id, input.watchlistId);
      if (!isMember) throw new TRPCError({ code: "FORBIDDEN", message: "Not a member" });
      await addTickerToSharedWatchlist(input.watchlistId, input.ticker.toUpperCase(), ctx.user.id);
      return { success: true };
    }),

  collabRemoveTicker: protectedProcedure
    .input(z.object({ watchlistId: z.number(), ticker: z.string().min(1).max(16) }))
    .mutation(async ({ ctx, input }) => {
      const isMember = await isWatchlistMember(ctx.user.id, input.watchlistId);
      if (!isMember) throw new TRPCError({ code: "FORBIDDEN", message: "Not a member" });
      await removeTickerFromSharedWatchlist(input.watchlistId, input.ticker.toUpperCase());
      return { success: true };
    }),

  collabAnnotations: protectedProcedure
    .input(z.object({ watchlistId: z.number(), ticker: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const isMember = await isWatchlistMember(ctx.user.id, input.watchlistId);
      if (!isMember) throw new TRPCError({ code: "FORBIDDEN", message: "Not a member" });
      const annotations = await getAnnotations(input.watchlistId, input.ticker);
      return annotations.map(a => ({
        id: a.id,
        ticker: a.ticker,
        content: a.content,
        sentiment: a.sentiment,
        userName: a.userName ?? "Anonymous",
        userId: a.userId,
        createdAt: a.createdAt.getTime(),
      }));
    }),

  collabAddAnnotation: protectedProcedure
    .input(z.object({
      watchlistId: z.number(),
      ticker: z.string().min(1).max(16),
      content: z.string().min(1).max(2000),
      sentiment: z.enum(["bullish", "bearish", "neutral"]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const isMember = await isWatchlistMember(ctx.user.id, input.watchlistId);
      if (!isMember) throw new TRPCError({ code: "FORBIDDEN", message: "Not a member" });
      const result = await createAnnotation(input.watchlistId, input.ticker.toUpperCase(), ctx.user.id, input.content, input.sentiment);
      // Broadcast to all viewers of this watchlist
      broadcastAnnotation(input.watchlistId, {
        id: result.id,
        ticker: input.ticker.toUpperCase(),
        content: input.content,
        sentiment: input.sentiment ?? null,
        userName: ctx.user.name ?? "Anonymous",
        userId: String(ctx.user.id),
        createdAt: Date.now(),
      });
      return { success: true };
    }),

  collabDeleteAnnotation: protectedProcedure
    .input(z.object({ annotationId: z.number(), watchlistId: z.number().optional() }))
    .mutation(async ({ ctx, input }) => {
      await deleteAnnotation(ctx.user.id, input.annotationId);
      // Broadcast deletion to all viewers
      if (input.watchlistId) {
        broadcastAnnotationDeleted(input.watchlistId, input.annotationId);
      }
      return { success: true };
    }),

  // ─── Admin Analytics ───

  adminAnalytics: protectedProcedure
    .input(z.object({ days: z.number().int().min(1).max(365).default(30) }).optional())
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      }
      const days = input?.days ?? 30;
      const summary = await getAnalyticsSummary(days);
      return summary;
    }),

  // ─── Prediction Weight Profiles ───

  weightProfileActive: protectedProcedure.query(async ({ ctx }) => {
    const profile = await getUserWeightProfile(ctx.user.id);
    if (!profile) {
      return { id: 0, name: "Default", socialWeight: 25, technicalWeight: 25, fundamentalWeight: 25, newsWeight: 25 };
    }
    return {
      id: profile.id,
      name: profile.name,
      socialWeight: profile.socialWeight,
      technicalWeight: profile.technicalWeight,
      fundamentalWeight: profile.fundamentalWeight,
      newsWeight: profile.newsWeight,
    };
  }),

  weightProfileList: protectedProcedure.query(async ({ ctx }) => {
    const profiles = await getAllWeightProfiles(ctx.user.id);
    return profiles.map(p => ({
      id: p.id,
      name: p.name,
      socialWeight: p.socialWeight,
      technicalWeight: p.technicalWeight,
      fundamentalWeight: p.fundamentalWeight,
      newsWeight: p.newsWeight,
      isActive: p.isActive === 1,
      createdAt: p.createdAt.getTime(),
    }));
  }),

  weightProfileSave: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(100),
      socialWeight: z.number().int().min(0).max(100),
      technicalWeight: z.number().int().min(0).max(100),
      fundamentalWeight: z.number().int().min(0).max(100),
      newsWeight: z.number().int().min(0).max(100),
    }))
    .mutation(async ({ ctx, input }) => {
      await saveWeightProfile(
        ctx.user.id,
        input.name,
        input.socialWeight,
        input.technicalWeight,
        input.fundamentalWeight,
        input.newsWeight
      );
      return { success: true };
    }),

  weightProfileActivate: protectedProcedure
    .input(z.object({ profileId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await activateWeightProfile(ctx.user.id, input.profileId);
      return { success: true };
    }),

  weightProfileDelete: protectedProcedure
    .input(z.object({ profileId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await deleteWeightProfile(ctx.user.id, input.profileId);
      return { success: true };
    }),

  // ─── Generated Reports ───

  reportsList: protectedProcedure.query(async ({ ctx }) => {
    const reports = await getUserReports(ctx.user.id);
    return reports.map(r => ({
      id: r.id,
      reportType: r.reportType,
      title: r.title,
      periodStart: r.periodStart.getTime(),
      periodEnd: r.periodEnd.getTime(),
      fileUrl: r.fileUrl,
      metadata: r.metadata ? JSON.parse(r.metadata) : null,
      createdAt: r.createdAt.getTime(),
    }));
  }),

  reportsGenerate: protectedProcedure.mutation(async ({ ctx }) => {
    const result = await generateWeeklyReport(ctx.user.id, ctx.user.name || "User");
    if (!result.success) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to generate report" });
    }
    return { success: true, url: result.url, title: result.title };
  }),

  reportsDelete: protectedProcedure
    .input(z.object({ reportId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await deleteGeneratedReport(ctx.user.id, input.reportId);
      return { success: true };
    }),

  // ─── In-App Notifications ───

  notificationsList: protectedProcedure.query(async ({ ctx }) => {
    const notifications = await getUserNotifications(ctx.user.id);
    return notifications.map(n => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      link: n.link,
      isRead: n.isRead,
      metadata: n.metadata ? JSON.parse(n.metadata) : null,
      createdAt: n.createdAt.getTime(),
    }));
  }),

  notificationsUnreadCount: protectedProcedure.query(async ({ ctx }) => {
    const count = await getUnreadNotificationCount(ctx.user.id);
    return { count };
  }),

  notificationsMarkRead: protectedProcedure
    .input(z.object({ notificationId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await markNotificationRead(ctx.user.id, input.notificationId);
      return { success: true };
    }),

  notificationsMarkAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    await markAllNotificationsRead(ctx.user.id);
    return { success: true };
  }),

  // ─── Scheduled Reports ───

  schedulesList: protectedProcedure.query(async ({ ctx }) => {
    const schedules = await getReportSchedules(ctx.user.id);
    return schedules.map((s) => ({
      id: s.id,
      name: s.name,
      frequency: s.frequency,
      sections: JSON.parse(s.sections) as string[],
      enabled: s.enabled === 1,
      deliveryMethod: s.deliveryMethod || "notification",
      deliveryEmail: s.deliveryEmail || null,
      slackWebhookUrl: s.slackWebhookUrl || null,
      lastSentAt: s.lastSentAt ? s.lastSentAt.getTime() : null,
      createdAt: s.createdAt.getTime(),
    }));
  }),

  schedulesCreate: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(200),
        frequency: z.enum(["daily", "weekly_monday", "weekly_friday", "monthly"]),
        sections: z.array(z.string()).min(1),
        deliveryMethod: z.string().default("notification"),
        deliveryEmail: z.string().email().optional(),
        slackWebhookUrl: z.string().url().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await createReportSchedule(
        ctx.user.id,
        input.name,
        input.frequency,
        input.sections,
        input.deliveryMethod,
        input.deliveryEmail,
        input.slackWebhookUrl,
      );
      return { success: true };
    }),

  schedulesUpdate: protectedProcedure
    .input(
      z.object({
        scheduleId: z.number(),
        name: z.string().min(1).max(200).optional(),
        frequency: z.enum(["daily", "weekly_monday", "weekly_friday", "monthly"]).optional(),
        sections: z.array(z.string()).min(1).optional(),
        enabled: z.boolean().optional(),
        deliveryMethod: z.string().optional(),
        deliveryEmail: z.string().email().optional().or(z.literal("")),
        slackWebhookUrl: z.string().url().optional().or(z.literal("")),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await updateReportSchedule(ctx.user.id, input.scheduleId, {
        name: input.name,
        frequency: input.frequency,
        sections: input.sections,
        enabled: input.enabled !== undefined ? (input.enabled ? 1 : 0) : undefined,
        deliveryMethod: input.deliveryMethod,
        deliveryEmail: input.deliveryEmail,
        slackWebhookUrl: input.slackWebhookUrl,
      });
      return { success: true };
    }),

  schedulesDelete: protectedProcedure
    .input(z.object({ scheduleId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await deleteReportSchedule(ctx.user.id, input.scheduleId);
      return { success: true };
    }),

  schedulesSendNow: protectedProcedure
    .input(z.object({ scheduleId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const { sendScheduledReport } = await import("./scheduledReportJob");
      return sendScheduledReport(ctx.user.id, ctx.user.name || "User", input.scheduleId);
    }),

  testSlackWebhook: protectedProcedure
    .input(z.object({ webhookUrl: z.string().url() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const userName = ctx.user.name || "User";
        const payload = {
          blocks: [
            {
              type: "header",
              text: {
                type: "plain_text",
                text: "\u2705 MarketMind Webhook Test",
                emoji: true,
              },
            },
            { type: "divider" },
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `This is a test message from *MarketMind*.\n\nIf you can see this, your Slack webhook is configured correctly!\n\n*Sent by:* ${userName}\n*Time:* ${new Date().toLocaleString("en-US", { timeZone: "America/New_York" })} ET`,
              },
            },
            { type: "divider" },
            {
              type: "context",
              elements: [
                {
                  type: "mrkdwn",
                  text: "Sent by *MarketMind* \u2014 Autonomous Market Intelligence Platform",
                },
              ],
            },
          ],
        };

        const response = await fetch(input.webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          return { success: true, message: "Test message sent successfully! Check your Slack channel." };
        } else {
          const text = await response.text();
          return { success: false, message: `Webhook returned ${response.status}: ${text}` };
        }
      } catch (err) {
        return { success: false, message: `Connection failed: ${String(err)}` };
      }
    }),

  // ─── Dashboard Snapshots ───

  snapshotCreate: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1).max(200),
        snapshotData: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const shareId = `snap_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      const result = await createDashboardSnapshot({
        shareId,
        userId: ctx.user.id,
        userName: ctx.user.name || undefined,
        title: input.title,
        snapshotData: input.snapshotData,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      });
      return { shareId: result?.shareId || shareId };
    }),

  snapshotGet: publicProcedure
    .input(z.object({ shareId: z.string() }))
    .query(async ({ input }) => {
      const snapshot = await getDashboardSnapshot(input.shareId);
      if (!snapshot) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Snapshot not found" });
      }
      return snapshot;
    }),

  snapshotList: protectedProcedure.query(async ({ ctx }) => {
    return listDashboardSnapshots(ctx.user.id);
  }),

  snapshotDelete: protectedProcedure
    .input(z.object({ shareId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await deleteDashboardSnapshot(input.shareId, ctx.user.id);
      return { success: true };
    }),
});
