/**
 * Server-side alert checker.
 * Runs periodically to check if any user alerts have been triggered
 * based on current market prices or narrative content, and sends
 * notifications via the built-in notifyOwner API.
 *
 * Supports:
 * - price_above / price_below — triggered by real-time price data
 * - sentiment_above / sentiment_below — triggered by sentiment scores
 * - narrative_mention — triggered when a narrative mentions a ticker with matching sentiment
 * - sentiment_shift — triggered when sentiment for a ticker changes direction
 */
import { getActiveAlerts, triggerAlert, createNotification } from "./db";
import { notifyOwner } from "./_core/notification";

// Track current prices from the WebSocket feed
const latestPrices = new Map<string, number>();

// Track latest narrative data for narrative-based alerts
interface NarrativeData {
  ticker: string;
  sentiment: "bullish" | "bearish" | "neutral";
  title: string;
  summary: string;
  timestamp: number;
}

const latestNarratives = new Map<string, NarrativeData[]>();
const previousSentiment = new Map<string, string>();

export function updatePrice(symbol: string, price: number) {
  latestPrices.set(symbol, price);
}

export function getLatestPrice(symbol: string): number | undefined {
  return latestPrices.get(symbol);
}

/**
 * Update narrative data for a ticker. Called when narratives are refreshed.
 */
export function updateNarratives(ticker: string, narratives: NarrativeData[]) {
  const prev = latestNarratives.get(ticker);
  if (prev && prev.length > 0) {
    // Track sentiment shift: store the dominant sentiment before update
    const prevSentiments = prev.map((n) => n.sentiment);
    const dominant =
      prevSentiments.filter((s) => s === "bullish").length >
      prevSentiments.filter((s) => s === "bearish").length
        ? "bullish"
        : prevSentiments.filter((s) => s === "bearish").length >
          prevSentiments.filter((s) => s === "bullish").length
        ? "bearish"
        : "neutral";
    previousSentiment.set(ticker, dominant);
  }
  latestNarratives.set(ticker, narratives);
}

/**
 * Get the current dominant sentiment for a ticker.
 */
function getDominantSentiment(ticker: string): string | null {
  const narratives = latestNarratives.get(ticker);
  if (!narratives || narratives.length === 0) return null;
  const sentiments = narratives.map((n) => n.sentiment);
  const bullish = sentiments.filter((s) => s === "bullish").length;
  const bearish = sentiments.filter((s) => s === "bearish").length;
  if (bullish > bearish) return "bullish";
  if (bearish > bullish) return "bearish";
  return "neutral";
}

let checkInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Start the alert checker loop.
 * Checks every 30 seconds for triggered alerts.
 */
export function startAlertChecker() {
  // Initial check after 10 seconds
  setTimeout(checkAlerts, 10_000);

  // Then check every 30 seconds
  checkInterval = setInterval(checkAlerts, 30_000);
  console.log("[AlertChecker] Server-side alert monitoring started (30s interval)");
}

export function stopAlertChecker() {
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
  }
}

async function checkAlerts() {
  try {
    const activeAlerts = await getActiveAlerts();
    if (activeAlerts.length === 0) return;

    let triggeredCount = 0;

    for (const alert of activeAlerts) {
      let shouldTrigger = false;
      let triggerContext = "";

      switch (alert.type) {
        case "price_above": {
          const currentPrice = latestPrices.get(alert.ticker);
          if (currentPrice === undefined) continue;
          const thresholdValue = alert.threshold / 100;
          shouldTrigger = currentPrice >= thresholdValue;
          if (shouldTrigger) {
            triggerContext = `${alert.ticker} price $${currentPrice.toFixed(2)} rose above $${thresholdValue.toFixed(2)}`;
          }
          break;
        }

        case "price_below": {
          const currentPrice = latestPrices.get(alert.ticker);
          if (currentPrice === undefined) continue;
          const thresholdValue = alert.threshold / 100;
          shouldTrigger = currentPrice <= thresholdValue;
          if (shouldTrigger) {
            triggerContext = `${alert.ticker} price $${currentPrice.toFixed(2)} dropped below $${thresholdValue.toFixed(2)}`;
          }
          break;
        }

        case "sentiment_above":
        case "sentiment_below": {
          // Sentiment alerts are checked against narrative sentiment scores
          // For now, skip if no narrative data
          break;
        }

        case "narrative_mention": {
          // Check if any recent narrative for this ticker matches the conditions
          const narratives = latestNarratives.get(alert.ticker);
          if (!narratives || narratives.length === 0) continue;

          const sentimentFilter = alert.sentimentFilter || "any";
          const keyword = alert.keyword?.toLowerCase();

          for (const narrative of narratives) {
            // Check sentiment filter
            if (sentimentFilter !== "any" && narrative.sentiment !== sentimentFilter) {
              continue;
            }

            // Check keyword match in title or summary
            if (keyword) {
              const text = `${narrative.title} ${narrative.summary}`.toLowerCase();
              if (!text.includes(keyword)) continue;
            }

            // All conditions met
            shouldTrigger = true;
            const sentimentLabel = sentimentFilter !== "any" ? ` (${sentimentFilter})` : "";
            const keywordLabel = keyword ? ` mentioning "${alert.keyword}"` : "";
            triggerContext = `Narrative for ${alert.ticker}${sentimentLabel}${keywordLabel}: "${narrative.title}"`;
            break;
          }
          break;
        }

        case "sentiment_shift": {
          // Check if sentiment has shifted for this ticker
          const currentSentiment = getDominantSentiment(alert.ticker);
          const prevSent = previousSentiment.get(alert.ticker);

          if (!currentSentiment || !prevSent) continue;
          if (currentSentiment === prevSent) continue;

          const targetShift = alert.sentimentFilter; // "bullish" or "bearish"
          if (targetShift === "bullish" && prevSent !== "bullish" && currentSentiment === "bullish") {
            shouldTrigger = true;
            triggerContext = `${alert.ticker} sentiment shifted from ${prevSent} to bullish`;
          } else if (targetShift === "bearish" && prevSent !== "bearish" && currentSentiment === "bearish") {
            shouldTrigger = true;
            triggerContext = `${alert.ticker} sentiment shifted from ${prevSent} to bearish`;
          } else if (targetShift === "any" && currentSentiment !== prevSent) {
            shouldTrigger = true;
            triggerContext = `${alert.ticker} sentiment shifted from ${prevSent} to ${currentSentiment}`;
          }
          break;
        }

        default:
          break;
      }

      if (shouldTrigger) {
        await triggerAlert(alert.id, triggerContext || undefined);
        triggeredCount++;

        // Build notification message
        const typeLabels: Record<string, string> = {
          price_above: "rose above",
          price_below: "dropped below",
          sentiment_above: "sentiment rose above",
          sentiment_below: "sentiment dropped below",
          narrative_mention: "narrative alert triggered",
          sentiment_shift: "sentiment shift detected",
        };
        const typeLabel = typeLabels[alert.type] || alert.type;

        // Create in-app notification
        try {
          await createNotification(
            alert.userId,
            "alert_triggered",
            `Alert: ${alert.ticker} — ${typeLabel}`,
            triggerContext,
            `/watchlist`,
            JSON.stringify({ alertId: alert.id, ticker: alert.ticker, type: alert.type })
          );
        } catch (err) {
          console.warn(`[AlertChecker] Failed to create in-app notification for alert ${alert.id}:`, err);
        }

        // Also send owner notification
        try {
          await notifyOwner({
            title: `Alert: ${alert.ticker} — ${typeLabel}`,
            content: `MarketMind Alert\n\n${triggerContext}\n\nTriggered: ${new Date().toLocaleString("en-US", { timeZone: "America/New_York" })} ET\n\nThis alert has been automatically marked as triggered.`,
          });
        } catch (err) {
          console.warn(`[AlertChecker] Failed to send owner notification for alert ${alert.id}:`, err);
        }
      }
    }

    if (triggeredCount > 0) {
      console.log(`[AlertChecker] ${triggeredCount} alert(s) triggered and notified`);
    }
  } catch (err) {
    console.warn("[AlertChecker] Error checking alerts:", err);
  }
}
