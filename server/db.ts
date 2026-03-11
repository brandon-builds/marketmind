import { and, eq, sql, desc, gte, count } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, watchlist, portfolioHoldings, userSettings, sharedReports, savedFilters, analyticsEvents, userAlerts, predictionWeights, generatedReports, inAppNotifications, appSettings, userPreferences, reportSchedules, dashboardSnapshots } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ─── Watchlist ───

export async function getWatchlist(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(watchlist).where(eq(watchlist.userId, userId));
}

export async function addToWatchlist(userId: number, ticker: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Check if already exists
  const existing = await db.select().from(watchlist)
    .where(and(eq(watchlist.userId, userId), eq(watchlist.ticker, ticker)))
    .limit(1);
  if (existing.length > 0) return existing[0];
  await db.insert(watchlist).values({ userId, ticker });
  const result = await db.select().from(watchlist)
    .where(and(eq(watchlist.userId, userId), eq(watchlist.ticker, ticker)))
    .limit(1);
  return result[0];
}

export async function removeFromWatchlist(userId: number, ticker: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(watchlist)
    .where(and(eq(watchlist.userId, userId), eq(watchlist.ticker, ticker)));
}

// ─── Portfolio Holdings ───

export async function getPortfolioHoldings(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(portfolioHoldings).where(eq(portfolioHoldings.userId, userId));
}

export async function upsertPortfolioHolding(userId: number, ticker: string, shares: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await db.select().from(portfolioHoldings)
    .where(and(eq(portfolioHoldings.userId, userId), eq(portfolioHoldings.ticker, ticker)))
    .limit(1);
  if (existing.length > 0) {
    await db.update(portfolioHoldings)
      .set({ shares })
      .where(and(eq(portfolioHoldings.userId, userId), eq(portfolioHoldings.ticker, ticker)));
  } else {
    await db.insert(portfolioHoldings).values({ userId, ticker, shares });
  }
}

export async function removePortfolioHolding(userId: number, ticker: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(portfolioHoldings)
    .where(and(eq(portfolioHoldings.userId, userId), eq(portfolioHoldings.ticker, ticker)));
}

// ─── User Settings ───

export async function getUserSettings(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(userSettings).where(eq(userSettings.userId, userId)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function upsertUserSettings(userId: number, settings: {
  defaultTickers?: string | null;
  preferredHorizon?: string;
  themePreference?: string;
  notificationsEnabled?: number;
  emailDigest?: string;
  showOnboarding?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await db.select().from(userSettings).where(eq(userSettings.userId, userId)).limit(1);
  if (existing.length > 0) {
    await db.update(userSettings).set(settings).where(eq(userSettings.userId, userId));
  } else {
    await db.insert(userSettings).values({ userId, ...settings });
  }
}

// ─── Shared Reports ───

export async function createSharedReport(userId: number, reportType: "backtest" | "portfolio", title: string, data: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Generate a random 16-char share ID
  const shareId = Array.from({ length: 16 }, () => "abcdefghijklmnopqrstuvwxyz0123456789"[Math.floor(Math.random() * 36)]).join("");
  // Set expiry to 30 days from now
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await db.insert(sharedReports).values({ shareId, userId, reportType, title, data, expiresAt });
  return shareId;
}

export async function getSharedReport(shareId: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(sharedReports).where(eq(sharedReports.shareId, shareId)).limit(1);
  if (result.length === 0) return null;
  // Increment view count
  await db.update(sharedReports).set({ views: sql`${sharedReports.views} + 1` }).where(eq(sharedReports.shareId, shareId));
  return result[0];
}

export async function getUserSharedReports(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(sharedReports).where(eq(sharedReports.userId, userId));
}

export async function deleteSharedReport(userId: number, shareId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(sharedReports).where(and(eq(sharedReports.userId, userId), eq(sharedReports.shareId, shareId)));
}

// ─── Saved Filters ───

export async function getSavedFilters(userId: number, page: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(savedFilters)
    .where(and(eq(savedFilters.userId, userId), eq(savedFilters.page, page)))
    .orderBy(desc(savedFilters.createdAt));
}

export async function createSavedFilter(userId: number, page: string, name: string, filters: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(savedFilters).values({ userId, page, name, filters });
}

export async function deleteSavedFilter(userId: number, filterId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(savedFilters).where(and(eq(savedFilters.id, filterId), eq(savedFilters.userId, userId)));
}

// ─── Analytics Events ───

export async function trackEvent(userId: number | null, event: string, page?: string, ticker?: string, metadata?: string) {
  const db = await getDb();
  if (!db) return;
  try {
    await db.insert(analyticsEvents).values({ userId, event, page, ticker, metadata });
  } catch (e) {
    // Non-critical, don't throw
    console.warn("[Analytics] Failed to track event:", e);
  }
}

export async function getAnalyticsSummary(days: number = 30) {
  const db = await getDb();
  if (!db) return null;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // Active users (distinct userIds with events)
  const activeUsersResult = await db
    .select({ cnt: sql<number>`COUNT(DISTINCT ${analyticsEvents.userId})` })
    .from(analyticsEvents)
    .where(gte(analyticsEvents.createdAt, since));
  const activeUsers = activeUsersResult[0]?.cnt ?? 0;

  // Total events
  const totalEventsResult = await db
    .select({ cnt: count() })
    .from(analyticsEvents)
    .where(gte(analyticsEvents.createdAt, since));
  const totalEvents = totalEventsResult[0]?.cnt ?? 0;

  // Top pages
  const topPages = await db
    .select({ page: analyticsEvents.page, cnt: count() })
    .from(analyticsEvents)
    .where(and(gte(analyticsEvents.createdAt, since), sql`${analyticsEvents.page} IS NOT NULL`))
    .groupBy(analyticsEvents.page)
    .orderBy(desc(count()))
    .limit(10);

  // Top tickers
  const topTickers = await db
    .select({ ticker: analyticsEvents.ticker, cnt: count() })
    .from(analyticsEvents)
    .where(and(gte(analyticsEvents.createdAt, since), sql`${analyticsEvents.ticker} IS NOT NULL`))
    .groupBy(analyticsEvents.ticker)
    .orderBy(desc(count()))
    .limit(10);

  // Event type breakdown
  const eventBreakdown = await db
    .select({ event: analyticsEvents.event, cnt: count() })
    .from(analyticsEvents)
    .where(gte(analyticsEvents.createdAt, since))
    .groupBy(analyticsEvents.event)
    .orderBy(desc(count()))
    .limit(15);

  // Daily active users (last 14 days)
  const dailyActiveRaw = await db.execute(
    sql`SELECT DATE(createdAt) as day, COUNT(DISTINCT userId) as cnt FROM analytics_events WHERE createdAt >= ${new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)} GROUP BY DATE(createdAt) ORDER BY DATE(createdAt)`
  );
  const dailyActive = (Array.isArray(dailyActiveRaw) ? dailyActiveRaw[0] ?? [] : []) as Array<{ day: string; cnt: number }>;

  // Total registered users
  const totalUsersResult = await db.select({ cnt: count() }).from(users);
  const totalUsers = totalUsersResult[0]?.cnt ?? 0;

  return {
    activeUsers,
    totalEvents,
    totalUsers,
    topPages: topPages.map(r => ({ page: r.page ?? "unknown", count: r.cnt })),
    topTickers: topTickers.map(r => ({ ticker: r.ticker ?? "unknown", count: r.cnt })),
    eventBreakdown: eventBreakdown.map(r => ({ event: r.event, count: r.cnt })),
    dailyActive: dailyActive.map(r => ({ day: String(r.day), users: r.cnt })),
  };
}

// ─── Alerts ───

export async function getUserAlerts(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(userAlerts).where(eq(userAlerts.userId, userId)).orderBy(desc(userAlerts.createdAt));
}

export async function createUserAlert(
  userId: number,
  ticker: string,
  type: string,
  threshold: number,
  sentimentFilter?: string,
  keyword?: string
) {
  const db = await getDb();
  if (!db) return;
  await db.insert(userAlerts).values({
    userId,
    ticker,
    type,
    threshold,
    sentimentFilter: sentimentFilter ?? null,
    keyword: keyword ?? null,
  });
}

export async function deleteUserAlert(userId: number, alertId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(userAlerts).where(and(eq(userAlerts.id, alertId), eq(userAlerts.userId, userId)));
}

export async function getActiveAlerts() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(userAlerts).where(eq(userAlerts.triggered, 0));
}

export async function triggerAlert(alertId: number, triggerContext?: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(userAlerts).set({
    triggered: 1,
    triggeredAt: new Date(),
    notified: 1,
    triggerContext: triggerContext ?? null,
  }).where(eq(userAlerts.id, alertId));
}

// ─── Collaborative Watchlists ───

import { sharedWatchlists, sharedWatchlistMembers, sharedWatchlistTickers, watchlistAnnotations } from "../drizzle/schema";

function generateInviteCode(): string {
  return Array.from({ length: 12 }, () => "abcdefghijklmnopqrstuvwxyz0123456789"[Math.floor(Math.random() * 36)]).join("");
}

export async function createSharedWatchlist(ownerId: number, name: string, description?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const inviteCode = generateInviteCode();
  await db.insert(sharedWatchlists).values({ ownerId, name, description: description ?? null, inviteCode });
  // Add owner as member with "owner" role
  const created = await db.select().from(sharedWatchlists).where(eq(sharedWatchlists.inviteCode, inviteCode)).limit(1);
  if (created[0]) {
    await db.insert(sharedWatchlistMembers).values({ watchlistId: created[0].id, userId: ownerId, role: "owner" });
  }
  return created[0];
}

export async function getMySharedWatchlists(userId: number) {
  const db = await getDb();
  if (!db) return [];
  // Get all watchlists where user is a member
  const memberships = await db.select().from(sharedWatchlistMembers).where(eq(sharedWatchlistMembers.userId, userId));
  if (memberships.length === 0) return [];
  const watchlistIds = memberships.map(m => m.watchlistId);
  const lists = await db.select().from(sharedWatchlists).where(sql`${sharedWatchlists.id} IN (${sql.join(watchlistIds.map(id => sql`${id}`), sql`, `)})`);
  return lists.map(l => ({
    ...l,
    role: memberships.find(m => m.watchlistId === l.id)?.role ?? "viewer",
  }));
}

export async function getSharedWatchlistById(watchlistId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(sharedWatchlists).where(eq(sharedWatchlists.id, watchlistId)).limit(1);
  return result[0] ?? null;
}

export async function getSharedWatchlistByInvite(inviteCode: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(sharedWatchlists).where(eq(sharedWatchlists.inviteCode, inviteCode)).limit(1);
  return result[0] ?? null;
}

export async function joinSharedWatchlist(userId: number, inviteCode: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const wl = await getSharedWatchlistByInvite(inviteCode);
  if (!wl) throw new Error("Watchlist not found");
  // Check if already a member
  const existing = await db.select().from(sharedWatchlistMembers)
    .where(and(eq(sharedWatchlistMembers.watchlistId, wl.id), eq(sharedWatchlistMembers.userId, userId)))
    .limit(1);
  if (existing.length > 0) return wl;
  await db.insert(sharedWatchlistMembers).values({ watchlistId: wl.id, userId, role: "editor" });
  return wl;
}

export async function getSharedWatchlistMembers(watchlistId: number) {
  const db = await getDb();
  if (!db) return [];
  const members = await db.select({
    id: sharedWatchlistMembers.id,
    userId: sharedWatchlistMembers.userId,
    role: sharedWatchlistMembers.role,
    joinedAt: sharedWatchlistMembers.joinedAt,
    userName: users.name,
  })
    .from(sharedWatchlistMembers)
    .leftJoin(users, eq(sharedWatchlistMembers.userId, users.id))
    .where(eq(sharedWatchlistMembers.watchlistId, watchlistId));
  return members;
}

export async function isWatchlistMember(userId: number, watchlistId: number) {
  const db = await getDb();
  if (!db) return false;
  const result = await db.select().from(sharedWatchlistMembers)
    .where(and(eq(sharedWatchlistMembers.watchlistId, watchlistId), eq(sharedWatchlistMembers.userId, userId)))
    .limit(1);
  return result.length > 0;
}

export async function getSharedWatchlistTickers(watchlistId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: sharedWatchlistTickers.id,
    ticker: sharedWatchlistTickers.ticker,
    addedBy: sharedWatchlistTickers.addedBy,
    addedAt: sharedWatchlistTickers.addedAt,
    addedByName: users.name,
  })
    .from(sharedWatchlistTickers)
    .leftJoin(users, eq(sharedWatchlistTickers.addedBy, users.id))
    .where(eq(sharedWatchlistTickers.watchlistId, watchlistId));
}

export async function addTickerToSharedWatchlist(watchlistId: number, ticker: string, addedBy: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await db.select().from(sharedWatchlistTickers)
    .where(and(eq(sharedWatchlistTickers.watchlistId, watchlistId), eq(sharedWatchlistTickers.ticker, ticker)))
    .limit(1);
  if (existing.length > 0) return;
  await db.insert(sharedWatchlistTickers).values({ watchlistId, ticker, addedBy });
}

export async function removeTickerFromSharedWatchlist(watchlistId: number, ticker: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(sharedWatchlistTickers)
    .where(and(eq(sharedWatchlistTickers.watchlistId, watchlistId), eq(sharedWatchlistTickers.ticker, ticker)));
}

// ─── Annotations ───

export async function getAnnotations(watchlistId: number, ticker?: string) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(watchlistAnnotations.watchlistId, watchlistId)];
  if (ticker) conditions.push(eq(watchlistAnnotations.ticker, ticker));
  return db.select({
    id: watchlistAnnotations.id,
    watchlistId: watchlistAnnotations.watchlistId,
    ticker: watchlistAnnotations.ticker,
    userId: watchlistAnnotations.userId,
    content: watchlistAnnotations.content,
    sentiment: watchlistAnnotations.sentiment,
    createdAt: watchlistAnnotations.createdAt,
    updatedAt: watchlistAnnotations.updatedAt,
    userName: users.name,
  })
    .from(watchlistAnnotations)
    .leftJoin(users, eq(watchlistAnnotations.userId, users.id))
    .where(and(...conditions))
    .orderBy(desc(watchlistAnnotations.createdAt));
}

export async function createAnnotation(watchlistId: number, ticker: string, userId: number, content: string, sentiment?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(watchlistAnnotations).values({
    watchlistId,
    ticker,
    userId,
    content,
    sentiment: sentiment ?? null,
  }).$returningId();
  return { id: result.id };
}

export async function deleteAnnotation(userId: number, annotationId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(watchlistAnnotations)
    .where(and(eq(watchlistAnnotations.id, annotationId), eq(watchlistAnnotations.userId, userId)));
}

export async function deleteSharedWatchlist(ownerId: number, watchlistId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Verify ownership
  const wl = await db.select().from(sharedWatchlists)
    .where(and(eq(sharedWatchlists.id, watchlistId), eq(sharedWatchlists.ownerId, ownerId)))
    .limit(1);
  if (wl.length === 0) throw new Error("Not authorized");
  // Delete all related data
  await db.delete(watchlistAnnotations).where(eq(watchlistAnnotations.watchlistId, watchlistId));
  await db.delete(sharedWatchlistTickers).where(eq(sharedWatchlistTickers.watchlistId, watchlistId));
  await db.delete(sharedWatchlistMembers).where(eq(sharedWatchlistMembers.watchlistId, watchlistId));
  await db.delete(sharedWatchlists).where(eq(sharedWatchlists.id, watchlistId));
}

export async function leaveSharedWatchlist(userId: number, watchlistId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(sharedWatchlistMembers)
    .where(and(eq(sharedWatchlistMembers.watchlistId, watchlistId), eq(sharedWatchlistMembers.userId, userId)));
}

// ─── Prediction Weight Profiles ───

export async function getUserWeightProfile(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(predictionWeights)
    .where(and(eq(predictionWeights.userId, userId), eq(predictionWeights.isActive, 1)))
    .limit(1);
  return result[0] ?? null;
}

export async function getAllWeightProfiles(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(predictionWeights)
    .where(eq(predictionWeights.userId, userId))
    .orderBy(desc(predictionWeights.updatedAt));
}

export async function saveWeightProfile(
  userId: number,
  name: string,
  socialWeight: number,
  technicalWeight: number,
  fundamentalWeight: number,
  newsWeight: number
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Deactivate all existing profiles
  await db.update(predictionWeights)
    .set({ isActive: 0 })
    .where(eq(predictionWeights.userId, userId));
  // Create new active profile
  await db.insert(predictionWeights).values({
    userId,
    name,
    socialWeight,
    technicalWeight,
    fundamentalWeight,
    newsWeight,
    isActive: 1,
  });
}

export async function activateWeightProfile(userId: number, profileId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Deactivate all
  await db.update(predictionWeights)
    .set({ isActive: 0 })
    .where(eq(predictionWeights.userId, userId));
  // Activate the selected one
  await db.update(predictionWeights)
    .set({ isActive: 1 })
    .where(and(eq(predictionWeights.id, profileId), eq(predictionWeights.userId, userId)));
}

export async function deleteWeightProfile(userId: number, profileId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(predictionWeights)
    .where(and(eq(predictionWeights.id, profileId), eq(predictionWeights.userId, userId)));
}

// ─── Generated Reports ───

export async function createGeneratedReport(
  userId: number,
  reportType: string,
  title: string,
  periodStart: Date,
  periodEnd: Date,
  fileUrl: string,
  fileKey: string,
  metadata?: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(generatedReports).values({
    userId,
    reportType,
    title,
    periodStart,
    periodEnd,
    fileUrl,
    fileKey,
    metadata,
  });
}

export async function getUserReports(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(generatedReports)
    .where(eq(generatedReports.userId, userId))
    .orderBy(desc(generatedReports.createdAt))
    .limit(50);
}

export async function deleteGeneratedReport(userId: number, reportId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(generatedReports)
    .where(and(eq(generatedReports.id, reportId), eq(generatedReports.userId, userId)));
}

// ─── In-App Notifications ───

export async function createNotification(
  userId: number,
  type: string,
  title: string,
  body?: string,
  link?: string,
  metadata?: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(inAppNotifications).values({
    userId,
    type,
    title,
    body: body || null,
    link: link || null,
    metadata: metadata || null,
  });
}

export async function getUserNotifications(userId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(inAppNotifications)
    .where(eq(inAppNotifications.userId, userId))
    .orderBy(desc(inAppNotifications.createdAt))
    .limit(limit);
}

export async function getUnreadNotificationCount(userId: number) {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ cnt: count() }).from(inAppNotifications)
    .where(and(eq(inAppNotifications.userId, userId), eq(inAppNotifications.isRead, false)));
  return result[0]?.cnt ?? 0;
}

export async function markNotificationRead(userId: number, notificationId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(inAppNotifications)
    .set({ isRead: true })
    .where(and(eq(inAppNotifications.id, notificationId), eq(inAppNotifications.userId, userId)));
}

export async function markAllNotificationsRead(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(inAppNotifications)
    .set({ isRead: true })
    .where(and(eq(inAppNotifications.userId, userId), eq(inAppNotifications.isRead, false)));
}

// ─── Onboarding Analytics ───

import { onboardingAnalytics } from "../drizzle/schema";

export async function trackOnboardingEvent(
  sessionId: string,
  eventType: string,
  userId?: number | null,
  stepNumber?: number | null,
  featureName?: string | null,
  metadata?: string | null
) {
  const db = await getDb();
  if (!db) return;
  try {
    await db.insert(onboardingAnalytics).values({
      sessionId,
      eventType,
      userId: userId ?? null,
      stepNumber: stepNumber ?? null,
      featureName: featureName ?? null,
      metadata: metadata ?? null,
    });
  } catch (e) {
    console.warn("[Onboarding Analytics] Failed to track:", e);
  }
}

export async function getOnboardingAnalyticsSummary(days: number = 30) {
  const db = await getDb();
  if (!db) return null;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // Total tour starts
  const tourStartsResult = await db
    .select({ cnt: count() })
    .from(onboardingAnalytics)
    .where(and(eq(onboardingAnalytics.eventType, "tour_start"), gte(onboardingAnalytics.createdAt, since)));
  const tourStarts = tourStartsResult[0]?.cnt ?? 0;

  // Total tour completions
  const tourCompletesResult = await db
    .select({ cnt: count() })
    .from(onboardingAnalytics)
    .where(and(eq(onboardingAnalytics.eventType, "tour_complete"), gte(onboardingAnalytics.createdAt, since)));
  const tourCompletes = tourCompletesResult[0]?.cnt ?? 0;

  // Tour skips
  const tourSkipsResult = await db
    .select({ cnt: count() })
    .from(onboardingAnalytics)
    .where(and(eq(onboardingAnalytics.eventType, "tour_skip"), gte(onboardingAnalytics.createdAt, since)));
  const tourSkips = tourSkipsResult[0]?.cnt ?? 0;

  // Step completion funnel (how many users reached each step)
  const stepFunnelRaw = await db.execute(
    sql`SELECT stepNumber, COUNT(DISTINCT sessionId) as cnt FROM onboarding_analytics WHERE eventType = 'tour_step' AND createdAt >= ${since} AND stepNumber IS NOT NULL GROUP BY stepNumber ORDER BY stepNumber`
  );
  const stepFunnel = (Array.isArray(stepFunnelRaw) ? stepFunnelRaw[0] ?? [] : []) as Array<{ stepNumber: number; cnt: number }>;

  // First feature usage breakdown (non-page features only)
  const featureUsageRaw = await db.execute(
    sql`SELECT featureName, COUNT(DISTINCT sessionId) as cnt FROM onboarding_analytics WHERE eventType = 'feature_first_use' AND createdAt >= ${since} AND featureName IS NOT NULL AND featureName NOT LIKE 'page:%' GROUP BY featureName ORDER BY cnt DESC`
  );
  const featureUsage = (Array.isArray(featureUsageRaw) ? featureUsageRaw[0] ?? [] : []) as Array<{ featureName: string; cnt: number }>;

  // Page discovery funnel (page:* features)
  const pageDiscoveryRaw = await db.execute(
    sql`SELECT featureName, COUNT(DISTINCT sessionId) as cnt FROM onboarding_analytics WHERE eventType = 'feature_first_use' AND createdAt >= ${since} AND featureName LIKE 'page:%' GROUP BY featureName ORDER BY cnt DESC`
  );
  const pageDiscovery = (Array.isArray(pageDiscoveryRaw) ? pageDiscoveryRaw[0] ?? [] : []) as Array<{ featureName: string; cnt: number }>;

  // Tooltip dismissals
  const tooltipDismissalsRaw = await db.execute(
    sql`SELECT featureName, COUNT(*) as cnt FROM onboarding_analytics WHERE eventType = 'tooltip_dismiss' AND createdAt >= ${since} AND featureName IS NOT NULL GROUP BY featureName ORDER BY cnt DESC`
  );
  const tooltipDismissals = (Array.isArray(tooltipDismissalsRaw) ? tooltipDismissalsRaw[0] ?? [] : []) as Array<{ featureName: string; cnt: number }>;

  // Daily onboarding events (last 14 days)
  const dailyRaw = await db.execute(
    sql`SELECT DATE(createdAt) as day, eventType, COUNT(*) as cnt FROM onboarding_analytics WHERE createdAt >= ${new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)} GROUP BY DATE(createdAt), eventType ORDER BY DATE(createdAt)`
  );
  const daily = (Array.isArray(dailyRaw) ? dailyRaw[0] ?? [] : []) as Array<{ day: string; eventType: string; cnt: number }>;

  // A/B test variant comparison
  const variantStatsRaw = await db.execute(
    sql`SELECT 
      JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.variant')) as variant,
      eventType,
      COUNT(DISTINCT sessionId) as sessions
    FROM onboarding_analytics 
    WHERE createdAt >= ${since} 
      AND metadata IS NOT NULL 
      AND JSON_EXTRACT(metadata, '$.variant') IS NOT NULL
    GROUP BY JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.variant')), eventType
    ORDER BY variant, eventType`
  );
  const variantStatsArr = (Array.isArray(variantStatsRaw) ? variantStatsRaw[0] ?? [] : []) as Array<{ variant: string; eventType: string; sessions: number }>;

  // Aggregate variant stats into a comparison object
  const variantMap: Record<string, { starts: number; completes: number; skips: number; completionRate: number }> = {};
  for (const row of variantStatsArr) {
    const v = row.variant;
    if (!v || v === 'unknown') continue;
    if (!variantMap[v]) variantMap[v] = { starts: 0, completes: 0, skips: 0, completionRate: 0 };
    if (row.eventType === 'tour_start') variantMap[v].starts = Number(row.sessions);
    if (row.eventType === 'tour_complete') variantMap[v].completes = Number(row.sessions);
    if (row.eventType === 'tour_skip') variantMap[v].skips = Number(row.sessions);
  }
  for (const v of Object.values(variantMap)) {
    v.completionRate = v.starts > 0 ? Math.round((v.completes / v.starts) * 100) : 0;
  }
  const variantComparison = Object.entries(variantMap).map(([variant, stats]) => ({
    variant,
    ...stats,
  }));

  // Completion rate
  const completionRate = tourStarts > 0 ? Math.round((tourCompletes / tourStarts) * 100) : 0;

  // Average step reached before skip
  const avgStepRaw = await db.execute(
    sql`SELECT AVG(stepNumber) as avg_step FROM onboarding_analytics WHERE eventType = 'tour_skip' AND createdAt >= ${since} AND stepNumber IS NOT NULL`
  );
  const avgSkipStep = (Array.isArray(avgStepRaw) && Array.isArray(avgStepRaw[0]) && avgStepRaw[0][0]) 
    ? Math.round(Number((avgStepRaw[0][0] as any).avg_step) || 0) 
    : 0;

  return {
    tourStarts,
    tourCompletes,
    tourSkips,
    completionRate,
    avgSkipStep,
    stepFunnel: stepFunnel.map(r => ({ step: r.stepNumber, sessions: Number(r.cnt) })),
    featureUsage: featureUsage.map(r => ({ feature: r.featureName, sessions: Number(r.cnt) })),
    pageDiscovery: pageDiscovery.map(r => ({ page: r.featureName.replace('page:', ''), sessions: Number(r.cnt) })),
    tooltipDismissals: tooltipDismissals.map(r => ({ tooltip: r.featureName, count: Number(r.cnt) })),
    daily: daily.map(r => ({ day: String(r.day), eventType: r.eventType, count: Number(r.cnt) })),
    variantComparison,
    conversionVelocity: await getConversionVelocity(db, since),
  };
}

/**
 * Conversion velocity: time from tour_complete to first meaningful action.
 * Meaningful actions: watchlist add (feature_first_use with 'watchlist-add'),
 * view prediction (page:predictions), run backtest (page:backtest).
 */
async function getConversionVelocity(db: ReturnType<typeof drizzle>, since: Date) {
  const meaningfulActions = ['watchlist-add', 'page:predictions', 'page:backtest', 'page:ticker-deep-dive'];
  const actionList = meaningfulActions.map(a => `'${a}'`).join(',');

  const velocityRaw = await db.execute(
    sql.raw(`
      SELECT 
        c.sessionId,
        c.createdAt as completedAt,
        MIN(a.createdAt) as firstActionAt,
        TIMESTAMPDIFF(SECOND, c.createdAt, MIN(a.createdAt)) as secondsToAction,
        (
          SELECT featureName FROM onboarding_analytics 
          WHERE sessionId = c.sessionId 
            AND eventType = 'feature_first_use' 
            AND featureName IN (${actionList})
          ORDER BY createdAt ASC LIMIT 1
        ) as firstAction
      FROM onboarding_analytics c
      JOIN onboarding_analytics a ON a.sessionId = c.sessionId 
        AND a.eventType = 'feature_first_use' 
        AND a.featureName IN (${actionList})
        AND a.createdAt >= c.createdAt
      WHERE c.eventType = 'tour_complete'
        AND c.createdAt >= '${since.toISOString().slice(0, 19).replace('T', ' ')}'
      GROUP BY c.sessionId, c.createdAt
      ORDER BY c.createdAt DESC
      LIMIT 100
    `)
  );
  const velocityArr = (Array.isArray(velocityRaw) ? velocityRaw[0] ?? [] : []) as Array<{
    sessionId: string; completedAt: Date; firstActionAt: Date; secondsToAction: number; firstAction: string;
  }>;

  if (velocityArr.length === 0) {
    return { avgSeconds: 0, medianSeconds: 0, totalConverted: 0, actions: [] as Array<{ action: string; count: number; avgSeconds: number }> };
  }

  const seconds = velocityArr.map(r => Number(r.secondsToAction)).filter(s => s >= 0);
  const avgSeconds = seconds.length > 0 ? Math.round(seconds.reduce((a, b) => a + b, 0) / seconds.length) : 0;
  const sorted = [...seconds].sort((a, b) => a - b);
  const medianSeconds = sorted.length > 0 ? sorted[Math.floor(sorted.length / 2)] : 0;

  // Group by first action type
  const actionMap: Record<string, { count: number; totalSeconds: number }> = {};
  for (const r of velocityArr) {
    const action = r.firstAction || 'unknown';
    if (!actionMap[action]) actionMap[action] = { count: 0, totalSeconds: 0 };
    actionMap[action].count++;
    actionMap[action].totalSeconds += Number(r.secondsToAction);
  }
  const actions = Object.entries(actionMap).map(([action, stats]) => ({
    action: action.replace('page:', ''),
    count: stats.count,
    avgSeconds: Math.round(stats.totalSeconds / stats.count),
  })).sort((a, b) => b.count - a.count);

  return { avgSeconds, medianSeconds, totalConverted: velocityArr.length, actions };
}

// ─── App Settings ─────────────────────────────────────────────

export async function getAppSetting(key: string): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(appSettings).where(eq(appSettings.key, key)).limit(1);
  return result[0]?.value ?? null;
}

export async function setAppSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(appSettings).values({ key, value })
    .onDuplicateKeyUpdate({ set: { value } });
}


// ============================================================================
// User Preferences
// ============================================================================

export async function getUserPreference(userId: number, key: string): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(userPreferences)
    .where(and(eq(userPreferences.userId, userId), eq(userPreferences.key, key)))
    .limit(1);
  return rows[0]?.value ?? null;
}

export async function setUserPreference(userId: number, key: string, value: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const existing = await db.select({ id: userPreferences.id }).from(userPreferences)
    .where(and(eq(userPreferences.userId, userId), eq(userPreferences.key, key)))
    .limit(1);
  if (existing.length > 0) {
    await db.update(userPreferences)
      .set({ value })
      .where(eq(userPreferences.id, existing[0].id));
  } else {
    await db.insert(userPreferences).values({ userId, key, value });
  }
}

export async function deleteUserPreference(userId: number, key: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(userPreferences)
    .where(and(eq(userPreferences.userId, userId), eq(userPreferences.key, key)));
}

// ============================================================================
// Cohort Retention
// ============================================================================

export async function getCohortRetention(): Promise<{
  cohorts: Array<{
    week: string;
    signups: number;
    day1: number;
    day7: number;
    day30: number;
  }>;
}> {
  const db = await getDb();
  if (!db) return { cohorts: [] };

  // Get users grouped by signup week, with return counts at day 1, 7, 30
  const rows = await db.execute(sql`
    SELECT
      DATE_FORMAT(DATE_SUB(u.createdAt, INTERVAL WEEKDAY(u.createdAt) DAY), '%Y-%m-%d') as week_start,
      COUNT(DISTINCT u.id) as signups,
      COUNT(DISTINCT CASE WHEN DATEDIFF(u.lastSignedIn, u.createdAt) >= 1 THEN u.id END) as day1,
      COUNT(DISTINCT CASE WHEN DATEDIFF(u.lastSignedIn, u.createdAt) >= 7 THEN u.id END) as day7,
      COUNT(DISTINCT CASE WHEN DATEDIFF(u.lastSignedIn, u.createdAt) >= 30 THEN u.id END) as day30
    FROM users u
    GROUP BY week_start
    ORDER BY week_start DESC
    LIMIT 12
  `);

  const cohorts = (rows as any)[0]?.map((r: any) => ({
    week: r.week_start,
    signups: Number(r.signups),
    day1: Number(r.day1),
    day7: Number(r.day7),
    day30: Number(r.day30),
  })) || [];

  return { cohorts: cohorts.reverse() };
}


// ============================================================================
// Report Schedules
// ============================================================================

export async function getReportSchedules(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(reportSchedules)
    .where(eq(reportSchedules.userId, userId))
    .orderBy(desc(reportSchedules.createdAt));
}

export async function createReportSchedule(
  userId: number,
  name: string,
  frequency: string,
  sections: string[],
  deliveryMethod?: string,
  deliveryEmail?: string,
  slackWebhookUrl?: string,
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(reportSchedules).values({
    userId,
    name,
    frequency,
    sections: JSON.stringify(sections),
    deliveryMethod: deliveryMethod || "notification",
    deliveryEmail: deliveryEmail || null,
    slackWebhookUrl: slackWebhookUrl || null,
  });
}

export async function updateReportSchedule(
  userId: number,
  scheduleId: number,
  updates: { name?: string; frequency?: string; sections?: string[]; enabled?: number; deliveryMethod?: string; deliveryEmail?: string; slackWebhookUrl?: string }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const set: Record<string, unknown> = {};
  if (updates.name !== undefined) set.name = updates.name;
  if (updates.frequency !== undefined) set.frequency = updates.frequency;
  if (updates.sections !== undefined) set.sections = JSON.stringify(updates.sections);
  if (updates.enabled !== undefined) set.enabled = updates.enabled;
  if (updates.deliveryMethod !== undefined) set.deliveryMethod = updates.deliveryMethod;
  if (updates.deliveryEmail !== undefined) set.deliveryEmail = updates.deliveryEmail || null;
  if (updates.slackWebhookUrl !== undefined) set.slackWebhookUrl = updates.slackWebhookUrl || null;
  await db.update(reportSchedules)
    .set(set)
    .where(and(eq(reportSchedules.id, scheduleId), eq(reportSchedules.userId, userId)));
}

export async function deleteReportSchedule(userId: number, scheduleId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(reportSchedules)
    .where(and(eq(reportSchedules.id, scheduleId), eq(reportSchedules.userId, userId)));
}

export async function getActiveSchedulesByFrequency(frequency: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: reportSchedules.id,
    userId: reportSchedules.userId,
    name: reportSchedules.name,
    sections: reportSchedules.sections,
    lastSentAt: reportSchedules.lastSentAt,
    deliveryMethod: reportSchedules.deliveryMethod,
    deliveryEmail: reportSchedules.deliveryEmail,
    slackWebhookUrl: reportSchedules.slackWebhookUrl,
  }).from(reportSchedules)
    .where(and(eq(reportSchedules.frequency, frequency), eq(reportSchedules.enabled, 1)));
}

export async function markScheduleSent(scheduleId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(reportSchedules)
    .set({ lastSentAt: new Date() })
    .where(eq(reportSchedules.id, scheduleId));
}

// ── Dashboard Snapshots ──────────────────────────────────────────────

export async function createDashboardSnapshot(data: {
  shareId: string;
  userId: number;
  userName?: string;
  title?: string;
  snapshotData: string;
  expiresAt?: Date;
}) {
  const db = await getDb();
  if (!db) return null;
  await db.insert(dashboardSnapshots).values({
    shareId: data.shareId,
    userId: data.userId,
    userName: data.userName,
    title: data.title,
    data: data.snapshotData,
    expiresAt: data.expiresAt,
  });
  return { shareId: data.shareId };
}

export async function getDashboardSnapshot(shareId: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(dashboardSnapshots).where(eq(dashboardSnapshots.shareId, shareId)).limit(1);
  if (rows.length === 0) return null;
  // Increment view count
  await db.update(dashboardSnapshots).set({ views: sql`${dashboardSnapshots.views} + 1` }).where(eq(dashboardSnapshots.shareId, shareId));
  return rows[0];
}

export async function listDashboardSnapshots(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(dashboardSnapshots).where(eq(dashboardSnapshots.userId, userId)).orderBy(desc(dashboardSnapshots.createdAt)).limit(20);
}

export async function deleteDashboardSnapshot(shareId: string, userId: number) {
  const db = await getDb();
  if (!db) return false;
  const result = await db.delete(dashboardSnapshots).where(and(eq(dashboardSnapshots.shareId, shareId), eq(dashboardSnapshots.userId, userId)));
  return (result as any)[0]?.affectedRows > 0;
}
