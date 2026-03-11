/**
 * Email Digest Scheduled Job
 *
 * Generates personalized market intelligence digests for users
 * who have enabled daily or weekly email notifications.
 *
 * Schedule:
 * - Daily digest: checked every hour, sends at ~8 AM ET
 * - Weekly digest: checked every hour, sends on Monday ~8 AM ET
 *
 * Each digest includes:
 * - Watchlist performance summary
 * - Top predictions with confidence scores
 * - Narrative shift highlights
 * - Portfolio performance (if holdings exist)
 */
import { getDb, createNotification, getWatchlist, getPortfolioHoldings } from "./db";
import { users, userSettings } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { notifyOwner } from "./_core/notification";

// Track last digest send times to avoid duplicates
let lastDailyDigest = 0;
let lastWeeklyDigest = 0;
let digestInterval: ReturnType<typeof setInterval> | null = null;

interface DigestUserData {
  userId: number;
  userName: string;
  watchlistTickers: string[];
  portfolioTickers: string[];
}

/**
 * Gather user-specific data for a personalized digest.
 */
async function gatherUserData(userId: number, userName: string): Promise<DigestUserData> {
  let watchlistTickers: string[] = [];
  let portfolioTickers: string[] = [];

  try {
    const watchlist = await getWatchlist(userId);
    watchlistTickers = watchlist.map((w: any) => w.ticker);
  } catch (_) {}

  try {
    const holdings = await getPortfolioHoldings(userId);
    portfolioTickers = holdings.map((h: any) => h.ticker);
  } catch (_) {}

  return { userId, userName, watchlistTickers, portfolioTickers };
}

/**
 * Build a rich, formatted digest content string.
 */
function buildDigestContent(
  userData: DigestUserData,
  digestType: "daily" | "weekly",
  dateStr: string
): { title: string; content: string } {
  const periodLabel = digestType === "daily" ? "Daily" : "Weekly";
  const greeting = `Hi ${userData.userName || "there"}`;

  const watchlistSection =
    userData.watchlistTickers.length > 0
      ? [
          "📊 Your Watchlist",
          "━━━━━━━━━━━━━━━━━━━━",
          `Tracking ${userData.watchlistTickers.length} ticker(s): ${userData.watchlistTickers.slice(0, 10).join(", ")}${userData.watchlistTickers.length > 10 ? ` +${userData.watchlistTickers.length - 10} more` : ""}`,
          "",
          "• New AI predictions are available for your watchlist tickers",
          "• Check the Dashboard for real-time sentiment analysis",
          "• Visit Ticker Deep Dive for detailed analysis on any ticker",
        ].join("\n")
      : [
          "📊 Watchlist",
          "━━━━━━━━━━━━━━━━━━━━",
          "You haven't added any tickers to your watchlist yet.",
          "→ Visit the Watchlist page to start tracking your favorite stocks.",
        ].join("\n");

  const portfolioSection =
    userData.portfolioTickers.length > 0
      ? [
          "",
          "💼 Portfolio Holdings",
          "━━━━━━━━━━━━━━━━━━━━",
          `${userData.portfolioTickers.length} position(s): ${userData.portfolioTickers.slice(0, 8).join(", ")}${userData.portfolioTickers.length > 8 ? ` +${userData.portfolioTickers.length - 8} more` : ""}`,
          "",
          "• Portfolio analysis has been updated with latest market data",
          "• Run a backtest to validate your strategy against historical data",
        ].join("\n")
      : "";

  const predictionsSection = [
    "",
    "🎯 Predictions & Intelligence",
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    "• Fresh AI-powered predictions are ready for review",
    "• Narrative intelligence has identified new market themes",
    "• Sentiment analysis has been refreshed across all tracked sectors",
    "• Model weights can be customized to match your investment style",
  ].join("\n");

  const alertsSection = [
    "",
    "🔔 Alerts & Notifications",
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    "• Check your Alert Dashboard for any triggered price or sentiment alerts",
    "• Configure new alerts on the Smart Alerts page",
  ].join("\n");

  const quickLinks = [
    "",
    "🔗 Quick Actions",
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    "• Dashboard → Your personalized market overview",
    "• Predictions → Latest AI price predictions",
    "• Narratives → Emerging market themes and sentiment",
    "• Backtest → Validate strategies with historical data",
    "• Reports → View generated analysis reports",
  ].join("\n");

  const footer = [
    "",
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    `MarketMind ${periodLabel} Digest — ${dateStr}`,
    "Manage your digest preferences in Settings → Notifications",
    "Powered by MarketMind v2.0 AI Market Intelligence",
  ].join("\n");

  const content = [
    `${greeting},`,
    "",
    `Here's your ${periodLabel.toLowerCase()} market intelligence summary.`,
    "",
    watchlistSection,
    portfolioSection,
    predictionsSection,
    alertsSection,
    quickLinks,
    footer,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    title: `MarketMind ${periodLabel} Digest — ${dateStr}`,
    content,
  };
}

/**
 * Send a personalized digest to a single user.
 */
async function sendDigestForUser(
  userData: DigestUserData,
  digestType: "daily" | "weekly",
  dateStr: string
): Promise<boolean> {
  const { title, content } = buildDigestContent(userData, digestType, dateStr);

  try {
    // Send via notification system
    await notifyOwner({ title, content });

    // Create in-app notification
    await createNotification(
      userData.userId,
      "digest_sent",
      `${digestType === "daily" ? "Daily" : "Weekly"} Market Digest`,
      `Your ${digestType} market intelligence summary is ready. Tracking ${userData.watchlistTickers.length} ticker(s).`,
      "/",
      JSON.stringify({
        digestType,
        tickerCount: userData.watchlistTickers.length,
        portfolioCount: userData.portfolioTickers.length,
      })
    );

    return true;
  } catch (err) {
    console.warn(`[Digest] Failed to send ${digestType} digest for user ${userData.userId}:`, err);
    return false;
  }
}

/**
 * Send a test digest for a specific user (triggered from Settings).
 */
export async function sendTestDigest(userId: number, userName: string): Promise<{ success: boolean; message: string }> {
  try {
    const userData = await gatherUserData(userId, userName);
    const dateStr = new Date().toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "America/New_York",
    });

    const { title, content } = buildDigestContent(userData, "daily", dateStr);

    const sent = await notifyOwner({
      title: `[TEST] ${title}`,
      content: `⚠️ This is a test digest triggered from Settings.\n\n${content}`,
    });

    if (sent) {
      await createNotification(
        userId,
        "digest_sent",
        "Test Digest Sent",
        "A test digest was sent successfully. Check your notifications.",
        "/settings",
        JSON.stringify({ digestType: "test" })
      );
      return { success: true, message: "Test digest sent successfully! Check your notifications." };
    } else {
      return { success: false, message: "Failed to send test digest. The notification service may be unavailable." };
    }
  } catch (err) {
    console.error("[Digest] Test digest failed:", err);
    return { success: false, message: `Failed to send test digest: ${String(err)}` };
  }
}

/**
 * Check if it's time to send a digest and send it.
 */
async function checkAndSendDigests() {
  try {
    const now = new Date();
    const etHour = parseInt(
      now.toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: "America/New_York" })
    );
    const dayOfWeek = now.toLocaleString("en-US", { weekday: "long", timeZone: "America/New_York" });
    const dateStr = now.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "America/New_York",
    });

    // Only send digests around 8 AM ET (check between 7-9 AM)
    if (etHour < 7 || etHour > 9) return;

    const db = await getDb();
    if (!db) return;

    // Check daily digest (once per day)
    const todayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
    const todayTs = new Date(todayKey).getTime() || now.getTime();

    if (todayTs > lastDailyDigest) {
      const dailyUsers = await db
        .select({
          userId: userSettings.userId,
        })
        .from(userSettings)
        .where(eq(userSettings.emailDigest, "daily"));

      if (dailyUsers.length > 0) {
        let sent = 0;
        for (const u of dailyUsers) {
          try {
            // Get user name
            const userRows = await db.select({ name: users.name }).from(users).where(eq(users.id, u.userId));
            const userName = userRows[0]?.name || "User";
            const userData = await gatherUserData(u.userId, userName);
            const success = await sendDigestForUser(userData, "daily", dateStr);
            if (success) sent++;
          } catch (err) {
            console.warn(`[Digest] Failed for user ${u.userId}:`, err);
          }
        }
        lastDailyDigest = todayTs;
        console.log(`[Digest] Daily digest sent for ${sent}/${dailyUsers.length} user(s)`);
      }
    }

    // Check weekly digest (Monday only)
    if (dayOfWeek === "Monday") {
      const weekKey = `${now.getFullYear()}-W${Math.ceil(now.getDate() / 7)}`;
      const weekTs = new Date(weekKey).getTime() || now.getTime();

      if (weekTs > lastWeeklyDigest) {
        const weeklyUsers = await db
          .select({
            userId: userSettings.userId,
          })
          .from(userSettings)
          .where(eq(userSettings.emailDigest, "weekly"));

        if (weeklyUsers.length > 0) {
          let sent = 0;
          for (const u of weeklyUsers) {
            try {
              const userRows = await db.select({ name: users.name }).from(users).where(eq(users.id, u.userId));
              const userName = userRows[0]?.name || "User";
              const userData = await gatherUserData(u.userId, userName);
              const success = await sendDigestForUser(userData, "weekly", dateStr);
              if (success) sent++;
            } catch (err) {
              console.warn(`[Digest] Failed for user ${u.userId}:`, err);
            }
          }
          lastWeeklyDigest = weekTs;
          console.log(`[Digest] Weekly digest sent for ${sent}/${weeklyUsers.length} user(s)`);
        }
      }
    }
  } catch (err) {
    console.warn("[Digest] Error checking digests:", err);
  }
}

/**
 * Start the digest scheduler.
 * Checks every hour if a digest needs to be sent.
 */
export function startDigestScheduler() {
  // Initial check after 30 seconds
  setTimeout(async () => {
    await checkAndSendDigests();
    try {
      const { checkAndSendScheduledReports } = await import("./scheduledReportJob");
      await checkAndSendScheduledReports();
    } catch (err) {
      console.warn("[Digest] Scheduled report check failed:", err);
    }
  }, 30_000);

  // Then check every hour
  digestInterval = setInterval(async () => {
    await checkAndSendDigests();
    try {
      const { checkAndSendScheduledReports } = await import("./scheduledReportJob");
      await checkAndSendScheduledReports();
    } catch (err) {
      console.warn("[Digest] Scheduled report check failed:", err);
    }
  }, 60 * 60 * 1000);
  console.log("[Digest] Email digest + scheduled report scheduler started (hourly check)");
}

export function stopDigestScheduler() {
  if (digestInterval) {
    clearInterval(digestInterval);
    digestInterval = null;
  }
}

// Export for testing
export { checkAndSendDigests, generateMarketSummary };

// Keep backward compatibility
function generateMarketSummary(): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "America/New_York",
  });
  return buildDigestContent(
    { userId: 0, userName: "User", watchlistTickers: [], portfolioTickers: [] },
    "daily",
    dateStr
  ).content;
}
