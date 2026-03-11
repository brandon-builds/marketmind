/**
 * Self-Improving Model Loop
 *
 * This agent adjusts signal source weights based on prediction accuracy.
 * It delegates ALL evaluation logic to the locked evaluationHarness.ts module.
 * This file may only modify weights — it cannot change how predictions are scored.
 *
 * SIMPLICITY BIAS: Prefer smaller, more targeted weight changes over complex ones
 * when accuracy improvement is equivalent.
 */
import { getDb } from "./db";
import { modelVersions, agentRuns, aiPredictions } from "../drizzle/schema";
import { desc, eq, sql } from "drizzle-orm";
import {
  evaluateCycle,
  recordBaseline,
  getBaseline,
  getImprovementDelta,
  MIN_PREDICTIONS_FOR_EVALUATION,
  MIN_PREDICTIONS_FOR_ADJUSTMENT,
  type CycleEvaluationResult,
} from "./evaluationHarness";

// ============================================================================
// Improvement Agent State
// ============================================================================

interface ImprovementStatus {
  lastTrainingRun: Date | null;
  nextTrainingRun: Date | null;
  isTraining: boolean;
  currentModelVersion: string;
  currentAccuracy: number;
  predictionsEvaluated: number;
  versionsPublished: number;
  lastError: string | null;
  weights: Record<string, number>;
  baselineRecorded: boolean;
}

let improvementStatus: ImprovementStatus = {
  lastTrainingRun: null,
  nextTrainingRun: null,
  isTraining: false,
  currentModelVersion: "v1.0.0",
  currentAccuracy: 0.50, // Start at 50% (random baseline)
  predictionsEvaluated: 0,
  versionsPublished: 1,
  lastError: null,
  weights: {
    reddit_sentiment: 0.15,
    yahoo_price: 0.25,
    rss_news: 0.15,
    technical_pattern: 0.10,
    twitter_vip: 0.10,
    sec_edgar: 0.05,
    fred_macro: 0.05,
    polymarket: 0.05,
    stocktwits: 0.05,
    podcast_youtube: 0.03,
    google_trends: 0.02,
  },
  baselineRecorded: false,
};

export function getImprovementStatus(): ImprovementStatus {
  return { ...improvementStatus };
}

// ============================================================================
// Weight Adjustment (with simplicity bias)
// ============================================================================

/**
 * Adjust signal weights based on evaluation results.
 *
 * SIMPLICITY BIAS (Karpathy-inspired):
 *   Prefer smaller, more targeted changes over complex multi-weight adjustments.
 *   Only adjust the minimum number of weights needed to improve accuracy.
 *   Smaller changes are preferred when accuracy improvement is equivalent.
 */
function adjustWeights(
  currentWeights: Record<string, number>,
  evalResult: CycleEvaluationResult,
): { newWeights: Record<string, number>; changes: string[]; complexityScore: number } {
  const changes: string[] = [];
  const newWeights = { ...currentWeights };

  if (evalResult.evaluated < MIN_PREDICTIONS_FOR_ADJUSTMENT) {
    changes.push(`Insufficient data for weight adjustment (need ${MIN_PREDICTIONS_FOR_ADJUSTMENT}+ evaluated predictions, have ${evalResult.evaluated})`);
    return { newWeights, changes, complexityScore: 0 };
  }

  // SIMPLICITY BIAS: Use a small, conservative learning rate
  // Scale learning rate with data volume but cap it low
  const learningRate = Math.min(0.03, 0.01 + (evalResult.evaluated / 200) * 0.02);

  // Track how many weights we actually change (simplicity metric)
  let weightsChanged = 0;

  if (evalResult.accuracy >= 0.70) {
    // Good accuracy — make minimal changes. Only slightly reinforce the strongest signal.
    newWeights.yahoo_price = Math.min(0.35, newWeights.yahoo_price + learningRate);
    weightsChanged = 1;
    changes.push(`High accuracy (${(evalResult.accuracy * 100).toFixed(1)}%) — minimal change: reinforced price data weight to ${(newWeights.yahoo_price * 100).toFixed(1)}%`);
  } else if (evalResult.accuracy < 0.45) {
    // Poor accuracy — boost social signals (may capture regime changes)
    // But only change 2 weights maximum (simplicity bias)
    newWeights.reddit_sentiment = Math.min(0.25, newWeights.reddit_sentiment + learningRate);
    newWeights.rss_news = Math.min(0.25, newWeights.rss_news + learningRate * 0.5);
    weightsChanged = 2;
    changes.push(`Low accuracy (${(evalResult.accuracy * 100).toFixed(1)}%) — boosted social/news signals (simplicity: 2 weights changed)`);
  } else {
    // Moderate accuracy — fine-tune one weight only
    newWeights.technical_pattern = Math.min(0.20, newWeights.technical_pattern + learningRate * 0.5);
    weightsChanged = 1;
    changes.push(`Moderate accuracy (${(evalResult.accuracy * 100).toFixed(1)}%) — fine-tuned technical pattern weight (simplicity: 1 weight changed)`);
  }

  // Factor in Sharpe ratio — if predictions are directionally correct but returns are poor,
  // slightly boost price data (better entry/exit timing)
  if (evalResult.sharpeRatio < 0 && evalResult.accuracy > 0.50) {
    newWeights.yahoo_price = Math.min(0.35, newWeights.yahoo_price + learningRate * 0.5);
    weightsChanged++;
    changes.push(`Negative Sharpe (${evalResult.sharpeRatio.toFixed(2)}) despite decent accuracy — boosted price data for timing`);
  }

  // Normalize weights to sum to 1.0
  const total = Object.values(newWeights).reduce((a, b) => a + b, 0);
  for (const key of Object.keys(newWeights)) {
    newWeights[key] = newWeights[key] / total;
  }

  // Complexity score: lower is better (simplicity bias metric)
  const complexityScore = weightsChanged;

  return { newWeights, changes, complexityScore };
}

// ============================================================================
// Main Improvement Cycle
// ============================================================================

async function runImprovementCycle(): Promise<void> {
  improvementStatus.isTraining = true;
  const startTime = Date.now();

  const db = await getDb();
  if (!db) {
    improvementStatus.isTraining = false;
    improvementStatus.lastError = "Database unavailable";
    return;
  }

  // Record formal baseline on first run (if not already recorded)
  if (!improvementStatus.baselineRecorded) {
    const recorded = await recordBaseline(improvementStatus.weights);
    if (recorded) {
      console.log("[ImprovementAgent] Formal baseline recorded");
    }
    improvementStatus.baselineRecorded = true;
  }

  // Record agent run
  const [runRecord] = await db.insert(agentRuns).values({
    agentType: "improvement",
    status: "running",
    signalsProcessed: 0,
  }).$returningId();

  try {
    // 1. Delegate evaluation to the LOCKED evaluation harness
    const evalResult = await evaluateCycle();
    console.log(`[ImprovementAgent] Evaluation: ${evalResult.evaluated} predictions scored (${evalResult.correct} correct, accuracy: ${(evalResult.accuracy * 100).toFixed(1)}%, normalized: ${(evalResult.normalizedAccuracy * 100).toFixed(1)}%, Sharpe: ${evalResult.sharpeRatio.toFixed(2)}, signals: ${evalResult.signalCount})`);

    // 2. Adjust weights based on evaluation (with simplicity bias)
    const { newWeights, changes, complexityScore } = adjustWeights(
      improvementStatus.weights,
      evalResult,
    );

    // 3. Calculate overall accuracy from all evaluated predictions
    const allEvaluated = await db.select({
      total: sql<number>`count(*)`,
      correct: sql<number>`sum(case when ${aiPredictions.outcome} = 'correct' then 1 else 0 end)`,
    })
      .from(aiPredictions)
      .where(sql`${aiPredictions.outcome} != 'pending'`);

    const overallAccuracy = allEvaluated[0]?.total > 0
      ? (allEvaluated[0].correct || 0) / allEvaluated[0].total
      : improvementStatus.currentAccuracy;

    // 4. Get improvement delta vs baseline
    const delta = await getImprovementDelta(overallAccuracy);

    // 5. Publish new model version if weights changed
    const weightsChanged = JSON.stringify(newWeights) !== JSON.stringify(improvementStatus.weights);
    let newVersion = improvementStatus.currentModelVersion;

    if (weightsChanged && evalResult.evaluated >= MIN_PREDICTIONS_FOR_ADJUSTMENT) {
      const versionNum = improvementStatus.versionsPublished + 1;
      newVersion = `v1.${versionNum}.0`;

      await db.insert(modelVersions).values({
        version: newVersion,
        accuracy: Math.round(overallAccuracy * 100),
        weights: JSON.stringify(newWeights),
        changelog: JSON.stringify({
          changes,
          complexityScore,
          normalizedAccuracy: evalResult.normalizedAccuracy,
          sharpeRatio: evalResult.sharpeRatio,
          signalCount: evalResult.signalCount,
          deltaVsBaseline: delta.delta,
          improvementVsBaseline: delta.improvementPercent,
        }),
        totalPredictions: evalResult.evaluated,
        correctPredictions: evalResult.correct,
      });

      improvementStatus.versionsPublished = versionNum;
      improvementStatus.currentModelVersion = newVersion;
      improvementStatus.weights = newWeights;
      console.log(`[ImprovementAgent] Published model ${newVersion} (accuracy: ${(overallAccuracy * 100).toFixed(1)}%, complexity: ${complexityScore}, vs baseline: ${delta.delta > 0 ? "+" : ""}${(delta.delta * 100).toFixed(1)}%)`);
    }

    // 6. Update status
    improvementStatus.lastTrainingRun = new Date();
    improvementStatus.currentAccuracy = overallAccuracy;
    improvementStatus.predictionsEvaluated += evalResult.evaluated;
    improvementStatus.lastError = null;

    // 7. Update agent run record
    await db.update(agentRuns)
      .set({
        status: "completed",
        signalsProcessed: evalResult.evaluated,
        completedAt: new Date(),
        metadata: JSON.stringify({
          durationMs: Date.now() - startTime,
          evaluated: evalResult.evaluated,
          correct: evalResult.correct,
          incorrect: evalResult.incorrect,
          accuracy: overallAccuracy,
          normalizedAccuracy: evalResult.normalizedAccuracy,
          sharpeRatio: evalResult.sharpeRatio,
          signalCount: evalResult.signalCount,
          modelVersion: newVersion,
          weightsChanged,
          complexityScore,
          changes,
          deltaVsBaseline: delta,
        }),
      })
      .where(eq(agentRuns.id, runRecord.id));

    console.log(`[ImprovementAgent] Cycle complete in ${Date.now() - startTime}ms`);
  } catch (err: any) {
    console.error("[ImprovementAgent] Cycle failed:", err.message);
    improvementStatus.lastError = err.message;

    await db.update(agentRuns)
      .set({ status: "failed", errorMessage: err.message, completedAt: new Date() })
      .where(eq(agentRuns.id, runRecord.id));
  } finally {
    improvementStatus.isTraining = false;
  }
}

// ============================================================================
// Query Helpers
// ============================================================================

export async function getModelVersionHistory(limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db.select()
    .from(modelVersions)
    .orderBy(desc(modelVersions.trainedAt))
    .limit(limit);
}

export async function getPredictionAccuracyOverTime() {
  const db = await getDb();
  if (!db) return [];

  return db.select({
    date: sql<string>`DATE(${aiPredictions.resolvedAt})`,
    total: sql<number>`count(*)`,
    correct: sql<number>`sum(case when ${aiPredictions.outcome} = 'correct' then 1 else 0 end)`,
    accuracy: sql<number>`sum(case when ${aiPredictions.outcome} = 'correct' then 1 else 0 end) / count(*)`,
  })
    .from(aiPredictions)
    .where(sql`${aiPredictions.outcome} != 'pending' AND ${aiPredictions.resolvedAt} IS NOT NULL`)
    .groupBy(sql`DATE(${aiPredictions.resolvedAt})`)
    .orderBy(sql`DATE(${aiPredictions.resolvedAt})`);
}

export async function getOverallPredictionStats() {
  const db = await getDb();
  if (!db) return { total: 0, correct: 0, incorrect: 0, pending: 0, accuracy: 0 };

  const stats = await db.select({
    total: sql<number>`count(*)`,
    correct: sql<number>`sum(case when ${aiPredictions.outcome} = 'correct' then 1 else 0 end)`,
    incorrect: sql<number>`sum(case when ${aiPredictions.outcome} = 'incorrect' then 1 else 0 end)`,
    pending: sql<number>`sum(case when ${aiPredictions.outcome} = 'pending' then 1 else 0 end)`,
  })
    .from(aiPredictions);

  const s = stats[0];
  return {
    total: s?.total || 0,
    correct: s?.correct || 0,
    incorrect: s?.incorrect || 0,
    pending: s?.pending || 0,
    accuracy: s?.total && s.total > 0 && (s.total - (s.pending || 0)) > 0
      ? (s.correct || 0) / (s.total - (s.pending || 0))
      : 0,
  };
}

// ============================================================================
// Scheduler
// ============================================================================

const IMPROVEMENT_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
let improvementTimer: ReturnType<typeof setInterval> | null = null;

export function startImprovementAgent() {
  console.log("[ImprovementAgent] Starting self-improving model loop (every 1 hour)...");
  console.log("[ImprovementAgent] Using LOCKED evaluation harness (evaluationHarness.ts)");
  console.log("[ImprovementAgent] Simplicity bias enabled — minimal weight changes preferred");

  // Run first cycle after 2 minutes (let research agent populate predictions first)
  setTimeout(async () => {
    await runImprovementCycle();
    improvementStatus.nextTrainingRun = new Date(Date.now() + IMPROVEMENT_INTERVAL_MS);
  }, 120_000);

  // Schedule recurring
  improvementTimer = setInterval(async () => {
    await runImprovementCycle();
    improvementStatus.nextTrainingRun = new Date(Date.now() + IMPROVEMENT_INTERVAL_MS);
  }, IMPROVEMENT_INTERVAL_MS);

  return improvementTimer;
}

export function stopImprovementAgent() {
  if (improvementTimer) {
    clearInterval(improvementTimer);
    improvementTimer = null;
  }
}

// Manual trigger for testing
export async function triggerImprovementCycle() {
  if (improvementStatus.isTraining) {
    return { success: false, message: "Improvement agent is already training" };
  }
  await runImprovementCycle();
  return { success: true, message: "Improvement cycle completed" };
}
