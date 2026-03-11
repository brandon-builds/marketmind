import { getDb } from "./db";
import { users } from "../drizzle/schema";
import { createGeneratedReport, createNotification } from "./db";
import { storagePut } from "./storage";
import { notifyOwner } from "./_core/notification";

/**
 * Generates a weekly performance report as an HTML document,
 * uploads it to S3, and stores metadata in the database.
 */
export async function generateWeeklyReport(userId: number, userName: string) {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const title = `Weekly Market Intelligence Report — ${weekAgo.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })} to ${now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

  // Generate simulated report data (in production, this would pull from real analytics)
  const reportData = generateReportData(weekAgo, now);

  const html = buildReportHtml(title, userName, reportData, weekAgo, now);

  // Upload to S3
  const dateStr = now.toISOString().split("T")[0];
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const fileKey = `reports/${userId}/weekly-${dateStr}-${randomSuffix}.html`;

  try {
    const { url } = await storagePut(fileKey, Buffer.from(html, "utf-8"), "text/html");

    // Store metadata in DB
    await createGeneratedReport(
      userId,
      "weekly_summary",
      title,
      weekAgo,
      now,
      url,
      fileKey,
      JSON.stringify({
        predictionsCount: reportData.totalPredictions,
        accuracy: reportData.accuracy,
        topTicker: reportData.topTicker,
        bullishRatio: reportData.bullishRatio,
      })
    );

    console.log(`[ReportGenerator] Weekly report generated for user ${userId}: ${fileKey}`);

    // Create in-app notification
    try {
      await createNotification(
        userId,
        "report_generated",
        "Weekly Report Ready",
        title,
        "/reports",
        JSON.stringify({ reportType: "weekly_summary", fileKey })
      );
    } catch (err) {
      console.warn(`[ReportGenerator] Failed to create notification for user ${userId}:`, err);
    }

    return { success: true, url, title };
  } catch (error) {
    console.error("[ReportGenerator] Failed to generate report:", error);
    return { success: false, error: String(error) };
  }
}

interface ReportData {
  totalPredictions: number;
  accuracy: number;
  topTicker: string;
  bullishRatio: number;
  predictions: Array<{
    ticker: string;
    direction: string;
    confidence: number;
    outcome: string;
  }>;
  narrativeSummary: string;
  topMovers: Array<{ ticker: string; change: number }>;
  sectorPerformance: Array<{ sector: string; change: number }>;
}

function generateReportData(start: Date, end: Date): ReportData {
  const tickers = ["AAPL", "NVDA", "TSLA", "MSFT", "AMZN", "META", "GOOGL", "AMD"];
  const predictions = tickers.map((ticker) => ({
    ticker,
    direction: Math.random() > 0.4 ? "Bullish" : "Bearish",
    confidence: Math.round((0.45 + Math.random() * 0.45) * 100) / 100,
    outcome: Math.random() > 0.35 ? "HIT" : "MISS",
  }));

  const hits = predictions.filter((p) => p.outcome === "HIT").length;

  return {
    totalPredictions: predictions.length,
    accuracy: Math.round((hits / predictions.length) * 100),
    topTicker: "NVDA",
    bullishRatio: Math.round(
      (predictions.filter((p) => p.direction === "Bullish").length / predictions.length) * 100
    ),
    predictions,
    narrativeSummary:
      "AI semiconductor demand continues to drive market narratives. Federal Reserve rate cut expectations shifted mid-week following stronger-than-expected employment data. Tech earnings season approaching with elevated implied volatility across mega-cap names.",
    topMovers: [
      { ticker: "NVDA", change: 4.2 },
      { ticker: "TSLA", change: -3.1 },
      { ticker: "AMD", change: 2.8 },
      { ticker: "META", change: 1.5 },
      { ticker: "AAPL", change: -0.8 },
    ],
    sectorPerformance: [
      { sector: "Technology", change: 2.1 },
      { sector: "Healthcare", change: 0.8 },
      { sector: "Energy", change: -1.2 },
      { sector: "Financials", change: 1.4 },
      { sector: "Consumer Disc.", change: -0.5 },
    ],
  };
}

function buildReportHtml(
  title: string,
  userName: string,
  data: ReportData,
  start: Date,
  end: Date
): string {
  const startStr = start.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const endStr = end.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      background: #0a0b0f;
      color: #e0e0e8;
      line-height: 1.6;
      padding: 2rem;
    }
    .container { max-width: 800px; margin: 0 auto; }
    .header {
      text-align: center;
      padding: 2rem;
      background: linear-gradient(135deg, #0f1117, #1a1b2e);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 16px;
      margin-bottom: 2rem;
    }
    .header h1 {
      font-size: 1.5rem;
      font-weight: 700;
      background: linear-gradient(135deg, #60a5fa, #a78bfa);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 0.5rem;
    }
    .header .subtitle { color: #888; font-size: 0.875rem; }
    .header .period { color: #666; font-size: 0.75rem; margin-top: 0.25rem; }
    .section {
      background: #12131a;
      border: 1px solid rgba(255,255,255,0.06);
      border-radius: 12px;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
    }
    .section h2 {
      font-size: 1rem;
      font-weight: 600;
      color: #a0a0b0;
      margin-bottom: 1rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 1rem;
    }
    .kpi {
      text-align: center;
      padding: 1rem;
      background: rgba(255,255,255,0.03);
      border-radius: 8px;
    }
    .kpi .value {
      font-size: 1.75rem;
      font-weight: 700;
      font-family: 'JetBrains Mono', monospace;
    }
    .kpi .label { font-size: 0.7rem; color: #888; margin-top: 0.25rem; }
    .kpi .value.green { color: #34d399; }
    .kpi .value.blue { color: #60a5fa; }
    .kpi .value.purple { color: #a78bfa; }
    .kpi .value.amber { color: #fbbf24; }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.85rem;
    }
    th {
      text-align: left;
      padding: 0.5rem 0.75rem;
      color: #888;
      font-weight: 500;
      border-bottom: 1px solid rgba(255,255,255,0.08);
    }
    td {
      padding: 0.5rem 0.75rem;
      border-bottom: 1px solid rgba(255,255,255,0.04);
    }
    .badge {
      display: inline-block;
      padding: 0.125rem 0.5rem;
      border-radius: 9999px;
      font-size: 0.7rem;
      font-weight: 600;
    }
    .badge.bullish { background: rgba(52,211,153,0.15); color: #34d399; }
    .badge.bearish { background: rgba(248,113,113,0.15); color: #f87171; }
    .badge.hit { background: rgba(52,211,153,0.15); color: #34d399; }
    .badge.miss { background: rgba(248,113,113,0.15); color: #f87171; }
    .positive { color: #34d399; }
    .negative { color: #f87171; }
    .narrative-box {
      padding: 1rem;
      background: rgba(255,255,255,0.03);
      border-radius: 8px;
      border-left: 3px solid #60a5fa;
      font-size: 0.875rem;
      color: #c0c0d0;
    }
    .footer {
      text-align: center;
      padding: 1.5rem;
      color: #555;
      font-size: 0.75rem;
    }
    @media (max-width: 600px) {
      body { padding: 1rem; }
      .kpi-grid { grid-template-columns: repeat(2, 1fr); }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>MarketMind Weekly Intelligence</h1>
      <div class="subtitle">Prepared for ${userName || "User"}</div>
      <div class="period">${startStr} — ${endStr}</div>
    </div>

    <div class="section">
      <h2>Key Performance Indicators</h2>
      <div class="kpi-grid">
        <div class="kpi">
          <div class="value blue">${data.totalPredictions}</div>
          <div class="label">Predictions Made</div>
        </div>
        <div class="kpi">
          <div class="value green">${data.accuracy}%</div>
          <div class="label">Accuracy Rate</div>
        </div>
        <div class="kpi">
          <div class="value purple">${data.bullishRatio}%</div>
          <div class="label">Bullish Ratio</div>
        </div>
        <div class="kpi">
          <div class="value amber">${data.topTicker}</div>
          <div class="label">Top Ticker</div>
        </div>
      </div>
    </div>

    <div class="section">
      <h2>Narrative Summary</h2>
      <div class="narrative-box">${data.narrativeSummary}</div>
    </div>

    <div class="section">
      <h2>Prediction Results</h2>
      <table>
        <thead>
          <tr><th>Ticker</th><th>Direction</th><th>Confidence</th><th>Outcome</th></tr>
        </thead>
        <tbody>
          ${data.predictions
            .map(
              (p) => `<tr>
            <td style="font-weight:600;font-family:monospace">${p.ticker}</td>
            <td><span class="badge ${p.direction.toLowerCase()}">${p.direction}</span></td>
            <td style="font-family:monospace">${Math.round(p.confidence * 100)}%</td>
            <td><span class="badge ${p.outcome.toLowerCase()}">${p.outcome}</span></td>
          </tr>`
            )
            .join("")}
        </tbody>
      </table>
    </div>

    <div class="section">
      <h2>Top Movers This Week</h2>
      <table>
        <thead>
          <tr><th>Ticker</th><th>Weekly Change</th></tr>
        </thead>
        <tbody>
          ${data.topMovers
            .map(
              (m) => `<tr>
            <td style="font-weight:600;font-family:monospace">${m.ticker}</td>
            <td class="${m.change >= 0 ? "positive" : "negative"}">${m.change >= 0 ? "+" : ""}${m.change.toFixed(1)}%</td>
          </tr>`
            )
            .join("")}
        </tbody>
      </table>
    </div>

    <div class="section">
      <h2>Sector Performance</h2>
      <table>
        <thead>
          <tr><th>Sector</th><th>Weekly Change</th></tr>
        </thead>
        <tbody>
          ${data.sectorPerformance
            .map(
              (s) => `<tr>
            <td>${s.sector}</td>
            <td class="${s.change >= 0 ? "positive" : "negative"}">${s.change >= 0 ? "+" : ""}${s.change.toFixed(1)}%</td>
          </tr>`
            )
            .join("")}
        </tbody>
      </table>
    </div>

    <div class="footer">
      <p>Generated by MarketMind v2.0 — AI-Powered Market Intelligence</p>
      <p>This report is for informational purposes only. Not financial advice.</p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Scheduled report generation — runs weekly.
 * Checks all users and generates reports for those with active accounts.
 */
export async function runScheduledReportGeneration() {
  console.log("[ReportGenerator] Starting scheduled report generation...");
  try {
    const db = await getDb();
    if (!db) {
      console.warn("[ReportGenerator] Database not available, skipping.");
      return;
    }

    const allUsers = await db.select({ id: users.id, name: users.name }).from(users);

    let generated = 0;
    for (const user of allUsers) {
      try {
        const result = await generateWeeklyReport(user.id, user.name || "User");
        if (result.success) generated++;
      } catch (err) {
        console.error(`[ReportGenerator] Failed for user ${user.id}:`, err);
      }
    }

    console.log(`[ReportGenerator] Generated ${generated}/${allUsers.length} reports.`);

    // Notify owner
    await notifyOwner({
      title: "Weekly Reports Generated",
      content: `Generated ${generated} weekly reports for ${allUsers.length} users.`,
    });
  } catch (error) {
    console.error("[ReportGenerator] Scheduled generation failed:", error);
  }
}

/**
 * Start the weekly report scheduler.
 * Runs every Sunday at 6:00 AM UTC.
 */
export function startReportScheduler() {
  const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

  // Calculate time until next Sunday 6 AM UTC
  function msUntilNextSunday6AM() {
    const now = new Date();
    const next = new Date(now);
    next.setUTCHours(6, 0, 0, 0);
    // Set to next Sunday
    const daysUntilSunday = (7 - next.getUTCDay()) % 7;
    if (daysUntilSunday === 0 && now >= next) {
      next.setDate(next.getDate() + 7);
    } else {
      next.setDate(next.getDate() + daysUntilSunday);
    }
    return next.getTime() - now.getTime();
  }

  const delay = msUntilNextSunday6AM();
  console.log(`[ReportScheduler] Next weekly report in ${Math.round(delay / 3600000)}h`);

  setTimeout(() => {
    runScheduledReportGeneration();
    // Then repeat every week
    setInterval(runScheduledReportGeneration, WEEK_MS);
  }, delay);
}
