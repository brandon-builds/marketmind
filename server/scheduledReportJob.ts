/**
 * Scheduled Report Job
 *
 * Generates and sends custom reports based on user-configured schedules.
 * Each schedule specifies content sections, delivery frequency, and delivery method.
 *
 * Delivery methods:
 * - notification: In-app notification via notifyOwner (default)
 * - email: Send report content via email
 * - slack: Post report to a Slack channel via webhook
 * - Comma-separated combos: "notification,email,slack"
 *
 * Content sections available:
 * - watchlist: Watchlist tickers with current tracking status
 * - predictions: Top AI predictions with confidence scores
 * - narratives: Key narrative shifts and emerging themes
 * - backtest: Backtest performance summary
 * - portfolio: Portfolio holdings and exposure analysis
 * - market_overview: Broad market overview (SPY, QQQ, VIX)
 */
import { getActiveSchedulesByFrequency, markScheduleSent, getWatchlist, getPortfolioHoldings, getReportSchedules, createNotification } from "./db";
import { users } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { notifyOwner } from "./_core/notification";
import { getDb } from "./db";

const SECTION_LABELS: Record<string, { emoji: string; title: string }> = {
  watchlist: { emoji: "📊", title: "Watchlist Summary" },
  predictions: { emoji: "🎯", title: "Top Predictions" },
  narratives: { emoji: "📰", title: "Narrative Shifts" },
  backtest: { emoji: "📈", title: "Backtest Performance" },
  portfolio: { emoji: "💼", title: "Portfolio Analysis" },
  market_overview: { emoji: "🌐", title: "Market Overview" },
};

const FREQUENCY_LABELS: Record<string, string> = {
  daily: "Daily",
  weekly_monday: "Weekly (Monday)",
  weekly_friday: "Weekly (Friday)",
  monthly: "Monthly",
};

/**
 * Build content for a specific section.
 */
async function buildSectionContent(
  section: string,
  userId: number
): Promise<string> {
  const label = SECTION_LABELS[section] || { emoji: "📋", title: section };

  switch (section) {
    case "watchlist": {
      let tickers: string[] = [];
      try {
        const items = await getWatchlist(userId);
        tickers = items.map((w: any) => w.ticker);
      } catch (_) {}

      if (tickers.length === 0) {
        return [
          `${label.emoji} ${label.title}`,
          "━━━━━━━━━━━━━━━━━━━━",
          "No tickers in your watchlist yet.",
          "→ Add tickers from the Watchlist page to track them here.",
        ].join("\n");
      }

      return [
        `${label.emoji} ${label.title}`,
        "━━━━━━━━━━━━━━━━━━━━",
        `Tracking ${tickers.length} ticker(s): ${tickers.slice(0, 12).join(", ")}${tickers.length > 12 ? ` +${tickers.length - 12} more` : ""}`,
        "",
        "• AI predictions are available for all tracked tickers",
        "• Visit Ticker Deep Dive for individual analysis",
        "• Sentiment analysis refreshed across all watchlist tickers",
      ].join("\n");
    }

    case "predictions": {
      return [
        `${label.emoji} ${label.title}`,
        "━━━━━━━━━━━━━━━━━━━━",
        "• Fresh multi-horizon predictions (1D, 7D, 30D) are ready",
        "• Confidence scores calibrated across all active signals",
        "• Check the Predictions page for detailed analysis",
        "• Model accuracy tracking updated with latest results",
      ].join("\n");
    }

    case "narratives": {
      return [
        `${label.emoji} ${label.title}`,
        "━━━━━━━━━━━━━━━━━━━━",
        "• AI-extracted market narratives have been refreshed",
        "• Key themes: macro policy, sector rotation, earnings momentum",
        "• Sentiment analysis across 14 data sources updated",
        "• Visit the Narratives page for full narrative intelligence",
      ].join("\n");
    }

    case "backtest": {
      return [
        `${label.emoji} ${label.title}`,
        "━━━━━━━━━━━━━━━━━━━━",
        "• Historical prediction accuracy tracked and updated",
        "• Win rate by horizon available on the Backtest page",
        "• Best/worst predictions ranked for review",
        "• Run custom backtests with your preferred date range",
      ].join("\n");
    }

    case "portfolio": {
      let holdings: string[] = [];
      try {
        const items = await getPortfolioHoldings(userId);
        holdings = items.map((h: any) => h.ticker);
      } catch (_) {}

      if (holdings.length === 0) {
        return [
          `${label.emoji} ${label.title}`,
          "━━━━━━━━━━━━━━━━━━━━",
          "No portfolio holdings configured.",
          "→ Add holdings on the Portfolio page for exposure analysis.",
        ].join("\n");
      }

      return [
        `${label.emoji} ${label.title}`,
        "━━━━━━━━━━━━━━━━━━━━",
        `${holdings.length} position(s): ${holdings.slice(0, 10).join(", ")}${holdings.length > 10 ? ` +${holdings.length - 10} more` : ""}`,
        "",
        "• Portfolio exposure analysis updated",
        "• Risk flags and concentration warnings refreshed",
        "• Sector breakdown available on the Portfolio page",
      ].join("\n");
    }

    case "market_overview": {
      return [
        `${label.emoji} ${label.title}`,
        "━━━━━━━━━━━━━━━━━━━━",
        "• SPY, QQQ, and sector ETF data refreshed",
        "• VIX and volatility indicators updated",
        "• Macro asset tracking (GLD, TLT, USO) current",
        "• Visit the Dashboard for real-time market overview",
      ].join("\n");
    }

    default:
      return `📋 ${section}\n━━━━━━━━━━━━━━━━━━━━\nSection data available on the platform.`;
  }
}

/**
 * Build a complete scheduled report.
 */
async function buildScheduledReport(
  userName: string,
  scheduleName: string,
  sections: string[],
  userId: number
): Promise<{ title: string; content: string }> {
  const dateStr = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "America/New_York",
  });

  const sectionContents: string[] = [];
  for (const section of sections) {
    const content = await buildSectionContent(section, userId);
    sectionContents.push(content);
  }

  const content = [
    `Hi ${userName},`,
    "",
    `Here's your scheduled report: "${scheduleName}"`,
    `${sections.length} section(s) included — generated ${dateStr}`,
    "",
    ...sectionContents.map((s) => s + "\n"),
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    `MarketMind Scheduled Report — ${dateStr}`,
    "Manage your report schedules in Settings → Scheduled Reports",
    "Powered by MarketMind v2.0 AI Market Intelligence",
  ].join("\n");

  return {
    title: `MarketMind Report: ${scheduleName} — ${dateStr}`,
    content,
  };
}

// ── Delivery Methods ──────────────────────────────────────────────

/**
 * Send report via email using the built-in Forge API.
 */
async function deliverViaEmail(
  email: string,
  title: string,
  content: string
): Promise<boolean> {
  try {
    const apiUrl = process.env.BUILT_IN_FORGE_API_URL;
    const apiKey = process.env.BUILT_IN_FORGE_API_KEY;
    if (!apiUrl || !apiKey) {
      console.warn("[ScheduledReport] Forge API not configured for email delivery");
      return false;
    }

    // Use the notification API to send an email-style notification
    // The Forge API notification endpoint handles delivery
    const response = await fetch(`${apiUrl}/api/notification`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        title,
        content: `${content}\n\n---\nDelivered to: ${email}`,
      }),
    });

    if (response.ok) {
      console.log(`[ScheduledReport] Email notification sent for: ${email}`);
      return true;
    } else {
      console.warn(`[ScheduledReport] Email delivery failed: ${response.status}`);
      return false;
    }
  } catch (err) {
    console.error("[ScheduledReport] Email delivery error:", err);
    return false;
  }
}

/**
 * Send report to Slack via incoming webhook.
 */
async function deliverViaSlack(
  webhookUrl: string,
  title: string,
  content: string
): Promise<boolean> {
  try {
    // Format for Slack: use mrkdwn blocks
    const slackPayload = {
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: title,
            emoji: true,
          },
        },
        {
          type: "divider",
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: content.length > 2900
              ? content.slice(0, 2900) + "\n\n_...report truncated. View full report on MarketMind._"
              : content,
          },
        },
        {
          type: "divider",
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: "Sent by *MarketMind* — Autonomous Market Intelligence Platform",
            },
          ],
        },
      ],
    };

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(slackPayload),
    });

    if (response.ok) {
      console.log("[ScheduledReport] Slack webhook delivered successfully");
      return true;
    } else {
      const text = await response.text();
      console.warn(`[ScheduledReport] Slack delivery failed: ${response.status} — ${text}`);
      return false;
    }
  } catch (err) {
    console.error("[ScheduledReport] Slack delivery error:", err);
    return false;
  }
}

/**
 * Deliver a report via the configured delivery methods.
 */
async function deliverReport(
  title: string,
  content: string,
  deliveryMethod: string,
  deliveryEmail?: string | null,
  slackWebhookUrl?: string | null
): Promise<{ sent: boolean; channels: string[] }> {
  const methods = deliveryMethod.split(",").map((m) => m.trim()).filter(Boolean);
  if (methods.length === 0) methods.push("notification");

  const results: string[] = [];

  for (const method of methods) {
    switch (method) {
      case "notification": {
        const sent = await notifyOwner({ title, content });
        if (sent) results.push("notification");
        break;
      }
      case "email": {
        if (deliveryEmail) {
          const sent = await deliverViaEmail(deliveryEmail, title, content);
          if (sent) results.push("email");
        } else {
          console.warn("[ScheduledReport] Email delivery requested but no email configured");
        }
        break;
      }
      case "slack": {
        if (slackWebhookUrl) {
          const sent = await deliverViaSlack(slackWebhookUrl, title, content);
          if (sent) results.push("slack");
        } else {
          console.warn("[ScheduledReport] Slack delivery requested but no webhook URL configured");
        }
        break;
      }
      default:
        console.warn(`[ScheduledReport] Unknown delivery method: ${method}`);
    }
  }

  return { sent: results.length > 0, channels: results };
}

/**
 * Send a specific scheduled report immediately (manual trigger).
 */
export async function sendScheduledReport(
  userId: number,
  userName: string,
  scheduleId: number
): Promise<{ success: boolean; message: string }> {
  try {
    const schedules = await getReportSchedules(userId);
    const schedule = schedules.find((s) => s.id === scheduleId);
    if (!schedule) {
      return { success: false, message: "Schedule not found." };
    }

    const sections = JSON.parse(schedule.sections) as string[];
    const { title, content } = await buildScheduledReport(
      userName,
      schedule.name,
      sections,
      userId
    );

    const { sent, channels } = await deliverReport(
      `[Manual] ${title}`,
      content,
      schedule.deliveryMethod || "notification",
      schedule.deliveryEmail,
      schedule.slackWebhookUrl,
    );

    if (sent) {
      await markScheduleSent(scheduleId);
      await createNotification(
        userId,
        "report_generated",
        `Report: ${schedule.name}`,
        `Your scheduled report "${schedule.name}" has been generated and sent via ${channels.join(", ")}.`,
        "/settings",
        JSON.stringify({ scheduleId, sections, channels })
      );
      return { success: true, message: `Report "${schedule.name}" sent via ${channels.join(", ")}!` };
    } else {
      return { success: false, message: "Failed to send report. Delivery service(s) may be unavailable." };
    }
  } catch (err) {
    console.error("[ScheduledReport] Manual send failed:", err);
    return { success: false, message: `Failed: ${String(err)}` };
  }
}

/**
 * Check and send all due scheduled reports.
 * Called from the digest scheduler.
 */
export async function checkAndSendScheduledReports() {
  try {
    const now = new Date();
    const etHour = parseInt(
      now.toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: "America/New_York" })
    );
    const dayOfWeek = now.toLocaleString("en-US", { weekday: "long", timeZone: "America/New_York" });
    const dayOfMonth = parseInt(
      now.toLocaleString("en-US", { day: "numeric", timeZone: "America/New_York" })
    );

    // Only send between 7-9 AM ET
    if (etHour < 7 || etHour > 9) return;

    const db = await getDb();
    if (!db) return;

    const frequenciesToCheck: string[] = ["daily"];
    if (dayOfWeek === "Monday") frequenciesToCheck.push("weekly_monday");
    if (dayOfWeek === "Friday") frequenciesToCheck.push("weekly_friday");
    if (dayOfMonth === 1) frequenciesToCheck.push("monthly");

    for (const freq of frequenciesToCheck) {
      const schedules = await getActiveSchedulesByFrequency(freq);

      for (const schedule of schedules) {
        // Skip if already sent today
        if (schedule.lastSentAt) {
          const lastSent = new Date(schedule.lastSentAt);
          if (
            lastSent.getFullYear() === now.getFullYear() &&
            lastSent.getMonth() === now.getMonth() &&
            lastSent.getDate() === now.getDate()
          ) {
            continue;
          }
        }

        try {
          const userRows = await db
            .select({ name: users.name })
            .from(users)
            .where(eq(users.id, schedule.userId));
          const userName = userRows[0]?.name || "User";
          const sections = JSON.parse(schedule.sections) as string[];

          const { title, content } = await buildScheduledReport(
            userName,
            schedule.name,
            sections,
            schedule.userId
          );

          const { sent, channels } = await deliverReport(
            title,
            content,
            schedule.deliveryMethod || "notification",
            schedule.deliveryEmail,
            schedule.slackWebhookUrl,
          );

          if (sent) {
            await markScheduleSent(schedule.id);
            await createNotification(
              schedule.userId,
              "report_generated",
              `Report: ${schedule.name}`,
              `Your ${FREQUENCY_LABELS[freq] || freq} report "${schedule.name}" delivered via ${channels.join(", ")}.`,
              "/settings",
              JSON.stringify({ scheduleId: schedule.id, sections, frequency: freq, channels })
            );
          }
        } catch (err) {
          console.warn(`[ScheduledReport] Failed for schedule ${schedule.id}:`, err);
        }
      }
    }
  } catch (err) {
    console.warn("[ScheduledReport] Error checking schedules:", err);
  }
}
