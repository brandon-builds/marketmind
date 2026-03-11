/**
 * ============================================================================
 * EVALUATION HARNESS — LOCKED MODULE
 * ============================================================================
 *
 * This file is the IMMUTABLE evaluation harness for MarketMind's
 * self-improving prediction loop. It is structurally separated from
 * the Improvement Agent (improvementAgent.ts) to prevent the agent
 * from modifying its own evaluation criteria.
 *
 * DESIGN PRINCIPLE (inspired by Karpathy's autoresearch):
 *   The evaluation harness is the equivalent of `prepare.py` in
 *   autoresearch — it defines HOW predictions are scored and WHAT
 *   metrics are computed. The improvement agent can only READ the
 *   results, never change the scoring logic.
 *
 * DO NOT MODIFY THIS FILE unless you are explicitly changing the
 * evaluation methodology. Any changes here should be reviewed and
 * documented as a fundamental metric change, not a routine update.
 *
 * Locked metrics:
 *   - Direction accuracy (binary: correct/incorrect)
 *   - Confidence-weighted accuracy
 *   - Sharpe ratio of prediction returns
 *   - Signal count normalization factor
 *   - Fixed 7-day lookback window for cycle comparability
 *
 * ============================================================================
 */

import { getDb } from "./db";
import { aiPredictions, ingestedSignals, modelVersions } from "../drizzle/schema";
import { desc, eq, sql, gte, and, lt, count } from "drizzle-orm";

// ============================================================================
// LOCKED CONSTANTS — Do not change without formal review
// ============================================================================

/** Fixed lookback window for evaluation cycles (7 days) */
export const EVALUATION_LOOKBACK_DAYS = 7;

/** Minimum predictions required for a valid evaluation */
export const MIN_PREDICTIONS_FOR_EVALUATION = 3;

/** Minimum predictions for weight adjustment */
export const MIN_PREDICTIONS_FOR_ADJUSTMENT = 5;

/** Price movement threshold for "neutral" classification (1%) */
export const NEUTRAL_THRESHOLD = 0.01;

// ============================================================================
// Core Evaluation: Score a Single Prediction
// ============================================================================

export interface PredictionEvaluation {
  predictionId: number;
  ticker: string;
  predictedDirection: string;
  actualDirection: string;
  isCorrect: boolean;
  confidence: number;
  priceAtPrediction: number;
  priceAtResolution: number;
  returnPercent: number;
  horizonDays: number;
}

/**
 * Evaluate a single prediction against actual price data.
 * This is the atomic scoring unit — it determines correctness
 * based on direction match only.
 *
 * LOCKED: Do not modify the scoring logic.
 */
export function scorePrediction(
  predictedDirection: string,
  priceAtPrediction: number,
  priceAtResolution: number,
  confidence: number,
): PredictionEvaluation {
  const returnPercent = (priceAtResolution - priceAtPrediction) / priceAtPrediction;

  let actualDirection: string;
  if (returnPercent > NEUTRAL_THRESHOLD) actualDirection = "up";
  else if (returnPercent < -NEUTRAL_THRESHOLD) actualDirection = "down";
  else actualDirection = "neutral";

  const isCorrect =
    predictedDirection === actualDirection ||
    (predictedDirection === "neutral" && Math.abs(returnPercent) < NEUTRAL_THRESHOLD);

  return {
    predictionId: 0, // Set by caller
    ticker: "", // Set by caller
    predictedDirection,
    actualDirection,
    isCorrect,
    confidence,
    priceAtPrediction,
    priceAtResolution,
    returnPercent,
    horizonDays: 0, // Set by caller
  };
}

// ============================================================================
// Cycle Evaluation: Evaluate All Resolved Predictions in a Window
// ============================================================================

export interface CycleEvaluationResult {
  /** Total predictions evaluated in this cycle */
  evaluated: number;
  /** Number of correct predictions */
  correct: number;
  /** Number of incorrect predictions */
  incorrect: number;
  /** Raw direction accuracy (correct / evaluated) */
  accuracy: number;
  /** Confidence-weighted accuracy */
  confidenceWeightedAccuracy: number;
  /** Number of signals ingested during this evaluation window */
  signalCount: number;
  /** Normalized accuracy (adjusted for signal count) */
  normalizedAccuracy: number;
  /** Sharpe ratio of prediction returns */
  sharpeRatio: number;
  /** Individual evaluations */
  evaluations: PredictionEvaluation[];
  /** Evaluation window */
  windowStart: Date;
  windowEnd: Date;
}

/**
 * Evaluate all predictions that have been resolved within the
 * fixed lookback window. This ensures cycle comparability —
 * every evaluation uses the same time window.
 *
 * LOCKED: The lookback window and normalization logic must not
 * be changed without formal review.
 */
export async function evaluateCycle(): Promise<CycleEvaluationResult> {
  const db = await getDb();
  const windowEnd = new Date();
  const windowStart = new Date(Date.now() - EVALUATION_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

  const emptyResult: CycleEvaluationResult = {
    evaluated: 0, correct: 0, incorrect: 0,
    accuracy: 0, confidenceWeightedAccuracy: 0,
    signalCount: 0, normalizedAccuracy: 0, sharpeRatio: 0,
    evaluations: [], windowStart, windowEnd,
  };

  if (!db) return emptyResult;

  // 1. Get all pending predictions whose horizon has passed
  const pendingPredictions = await db.select()
    .from(aiPredictions)
    .where(eq(aiPredictions.outcome, "pending"))
    .orderBy(desc(aiPredictions.generatedAt));

  const evaluations: PredictionEvaluation[] = [];
  const now = new Date();

  for (const pred of pendingPredictions) {
    const generatedAt = new Date(pred.generatedAt);
    // LOCKED: Time window mapping — predictions MUST stay Active until
    // the FULL time window expires. No early resolution under any circumstances.
    const HORIZON_MS: Record<string, number> = {
      "1D": 1 * 24 * 3600000,   // 24 hours
      "7D": 7 * 24 * 3600000,   // 7 days
      "30D": 30 * 24 * 3600000,  // 30 days
      "60D": 60 * 24 * 3600000,  // 60 days
    };
    const horizonMs = HORIZON_MS[pred.horizon || "7D"] || 7 * 24 * 3600000;

    // STRICT: Only evaluate if the FULL horizon has passed since creation
    const elapsed = now.getTime() - generatedAt.getTime();
    if (elapsed < horizonMs) continue;

    // Get latest price for this ticker
    const latestPriceSignals = await db.select()
      .from(ingestedSignals)
      .where(and(
        eq(ingestedSignals.ticker, pred.ticker),
        eq(ingestedSignals.source, "yahoo_finance"),
      ))
      .orderBy(desc(ingestedSignals.ingestedAt))
      .limit(1);

    if (latestPriceSignals.length === 0) continue;

    let currentPrice: number | null = null;
    try {
      const meta = JSON.parse(latestPriceSignals[0].metadata || "{}");
      currentPrice = meta.price;
    } catch { continue; }

    if (!currentPrice || !pred.priceAtPrediction) continue;

    const predictionPrice = pred.priceAtPrediction / 100; // Stored in cents
    const confidence = pred.confidence || 50;

    const evaluation = scorePrediction(
      pred.direction,
      predictionPrice,
      currentPrice,
      confidence,
    );

    evaluation.predictionId = pred.id;
    evaluation.ticker = pred.ticker;
    evaluation.horizonDays = horizonMs / (24 * 3600000);

    // Update prediction in database
    await db.update(aiPredictions)
      .set({
        outcome: evaluation.isCorrect ? "correct" : "incorrect",
        priceAtResolution: Math.round(currentPrice * 100),
        resolvedAt: now,
      })
      .where(eq(aiPredictions.id, pred.id));

    evaluations.push(evaluation);
  }

  // 2. Count signals in the evaluation window (for normalization)
  const signalCountResult = await db.select({
    count: sql<number>`count(*)`,
  })
    .from(ingestedSignals)
    .where(and(
      gte(ingestedSignals.ingestedAt, windowStart),
      lt(ingestedSignals.ingestedAt, windowEnd),
    ));

  const signalCount = signalCountResult[0]?.count || 0;

  // 3. Compute metrics
  const evaluated = evaluations.length;
  const correct = evaluations.filter(e => e.isCorrect).length;
  const incorrect = evaluated - correct;
  const accuracy = evaluated > 0 ? correct / evaluated : 0;

  // Confidence-weighted accuracy
  const totalConfidence = evaluations.reduce((sum, e) => sum + e.confidence, 0);
  const confidenceWeightedAccuracy = totalConfidence > 0
    ? evaluations.reduce((sum, e) => sum + (e.isCorrect ? e.confidence : 0), 0) / totalConfidence
    : 0;

  // Signal count normalization: adjust accuracy based on signal density
  // Baseline: 100 signals per evaluation window
  const BASELINE_SIGNAL_COUNT = 100;
  const signalNormFactor = signalCount > 0
    ? Math.sqrt(BASELINE_SIGNAL_COUNT / signalCount)
    : 1;
  const normalizedAccuracy = accuracy * signalNormFactor;

  // Sharpe ratio of prediction returns
  const returns = evaluations.map(e => e.returnPercent);
  const meanReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
  const stdReturn = returns.length > 1
    ? Math.sqrt(returns.reduce((sum, r) => sum + (r - meanReturn) ** 2, 0) / (returns.length - 1))
    : 0;
  const sharpeRatio = stdReturn > 0 ? (meanReturn / stdReturn) * Math.sqrt(252) : 0; // Annualized

  return {
    evaluated, correct, incorrect,
    accuracy, confidenceWeightedAccuracy,
    signalCount, normalizedAccuracy, sharpeRatio,
    evaluations, windowStart, windowEnd,
  };
}

// ============================================================================
// Baseline Recording
// ============================================================================

/**
 * Record a formal baseline snapshot of initial weights and accuracy.
 * This should be called on first boot if no baseline exists.
 * All future improvements are measured against this baseline.
 *
 * LOCKED: The baseline format must not change.
 */
export async function recordBaseline(weights: Record<string, number>): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  // Check if baseline already exists
  const existing = await db.select()
    .from(modelVersions)
    .where(eq(modelVersions.version, "v0.0.0-baseline"))
    .limit(1);

  if (existing.length > 0) return false; // Baseline already recorded

  await db.insert(modelVersions).values({
    version: "v0.0.0-baseline",
    accuracy: 50, // 50% = random baseline
    weights: JSON.stringify(weights),
    changelog: JSON.stringify(["Initial baseline recorded. All future improvements measured against this."]),
    totalPredictions: 0,
    correctPredictions: 0,
  });

  console.log("[EvaluationHarness] Formal baseline recorded with initial weights");
  return true;
}

/**
 * Get the baseline for comparison.
 */
export async function getBaseline(): Promise<{
  weights: Record<string, number>;
  accuracy: number;
  recordedAt: Date;
} | null> {
  const db = await getDb();
  if (!db) return null;

  const baseline = await db!.select()
    .from(modelVersions)
    .where(eq(modelVersions.version, "v0.0.0-baseline"))
    .limit(1);

  if (baseline.length === 0) return null;

  return {
    weights: JSON.parse(baseline[0].weights || "{}"),
    accuracy: (baseline[0].accuracy ?? 50) / 100,
    recordedAt: baseline[0].trainedAt,
  };
}

// ============================================================================
// Improvement Delta (compare current vs baseline)
// ============================================================================

export interface ImprovementDelta {
  baselineAccuracy: number;
  currentAccuracy: number;
  delta: number;
  improvementPercent: number;
  versionsPublished: number;
  hasBaseline: boolean;
}

export async function getImprovementDelta(currentAccuracy: number): Promise<ImprovementDelta> {
  const baseline = await getBaseline();

  if (!baseline) {
    return {
      baselineAccuracy: 0.5,
      currentAccuracy,
      delta: currentAccuracy - 0.5,
      improvementPercent: ((currentAccuracy - 0.5) / 0.5) * 100,
      versionsPublished: 0,
      hasBaseline: false,
    };
  }

  const db = await getDb();
  const versionRows = db ? await db.select({ count: sql<number>`count(*)` }).from(modelVersions) : [{ count: 0 }];

  return {
    baselineAccuracy: baseline.accuracy,
    currentAccuracy,
    delta: currentAccuracy - baseline.accuracy,
    improvementPercent: baseline.accuracy > 0 ? ((currentAccuracy - baseline.accuracy) / baseline.accuracy) * 100 : 0,
    versionsPublished: versionRows[0]?.count || 0,
    hasBaseline: true,
  };
}
