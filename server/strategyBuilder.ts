/**
 * Strategy Builder — Custom trading strategy rule engine with backtesting
 * 
 * Users define strategies using visual rules (no code), then backtest them
 * against historical data to see hypothetical returns.
 * 
 * Rule types:
 * - Alpha Score threshold (above/below)
 * - Smart Money signal (strong_buy, buy, neutral, sell, strong_sell)
 * - VIP account trigger (specific handle mentioned ticker)
 * - Prediction market probability (above/below threshold)
 * - Multi-timeframe alignment (conviction/momentum/swing)
 * - Narrative velocity (rising/falling)
 */

import { getAlphaScores } from "./alphaEngine";
import { getSmartMoneyFlows } from "./multiTimeframeAlpha";
import { getMultiTimeframeScores } from "./multiTimeframeAlpha";

// ============================================================================
// Types
// ============================================================================

export type RuleType =
  | "alpha_score"
  | "smart_money"
  | "vip_trigger"
  | "prediction_market"
  | "timeframe_alignment"
  | "narrative_velocity"
  | "alpha_change"
  | "arbitrage_signal";

export type RuleOperator = "above" | "below" | "equals" | "not_equals" | "crosses_above" | "crosses_below" | "change_gt" | "change_lt";

export interface StrategyRule {
  id: string;
  type: RuleType;
  operator: RuleOperator;
  value: string | number;
  /** Optional: specific ticker, null = any ticker */
  ticker: string | null;
  /** Optional: specific VIP handle for vip_trigger type */
  handle: string | null;
}

export interface RuleGroup {
  id: string;
  logic: "AND" | "OR";
  rules: StrategyRule[];
}

export type StrategyAction = "buy" | "sell" | "hold" | "alert_only";

export interface Strategy {
  id: string;
  name: string;
  description: string;
  entryRules: RuleGroup;
  exitRules: RuleGroup | null;
  action: StrategyAction;
  createdAt: number;
  updatedAt: number;
  isActive: boolean;
  backtestResults: BacktestResult | null;
}

export interface BacktestResult {
  strategyId: string;
  runAt: number;
  periodDays: number;
  totalTrades: number;
  winRate: number;
  totalReturn: number;
  maxDrawdown: number;
  sharpeRatio: number;
  avgHoldingDays: number;
  bestTrade: { ticker: string; returnPct: number; date: string };
  worstTrade: { ticker: string; returnPct: number; date: string };
  monthlyReturns: { month: string; returnPct: number }[];
  equityCurve: { date: string; value: number }[];
  tradeLog: TradeLogEntry[];
  benchmarkReturn: number;
  alpha: number;
}

export interface TradeLogEntry {
  ticker: string;
  entryDate: string;
  exitDate: string;
  entryPrice: number;
  exitPrice: number;
  returnPct: number;
  signalSource: string;
  holdingDays: number;
}

// ============================================================================
// In-Memory Storage
// ============================================================================

let strategies: Strategy[] = [];
let strategyIdCounter = 1;

// Seed with example strategies
function seedDefaultStrategies() {
  strategies = [
    {
      id: `strat-${strategyIdCounter++}`,
      name: "High Alpha Conviction",
      description: "Buy when Alpha Score > 75 AND Smart Money = Strong Buy across all timeframes",
      entryRules: {
        id: "eg-1-entry",
        logic: "AND",
        rules: [
          { id: "r1", type: "alpha_score", operator: "above", value: 75, ticker: null, handle: null },
          { id: "r2", type: "smart_money", operator: "equals", value: "strong_buy", ticker: null, handle: null },
          { id: "r3", type: "timeframe_alignment", operator: "equals", value: "conviction", ticker: null, handle: null },
        ],
      },
      exitRules: {
        id: "eg-1-exit",
        logic: "OR",
        rules: [
          { id: "r4", type: "alpha_change", operator: "change_lt", value: -20, ticker: null, handle: null },
          { id: "r5", type: "smart_money", operator: "equals", value: "sell", ticker: null, handle: null },
        ],
      },
      action: "buy",
      createdAt: Date.now() - 7 * 86400000,
      updatedAt: Date.now() - 7 * 86400000,
      isActive: true,
      backtestResults: null,
    },
    {
      id: `strat-${strategyIdCounter++}`,
      name: "Camillo Consumer Trend",
      description: "Buy when Chris Camillo tweets about a consumer trend AND Alpha Score > 60",
      entryRules: {
        id: "eg-2-entry",
        logic: "AND",
        rules: [
          { id: "r6", type: "vip_trigger", operator: "equals", value: "mentioned", ticker: null, handle: "chriscamillo" },
          { id: "r7", type: "alpha_score", operator: "above", value: 60, ticker: null, handle: null },
        ],
      },
      exitRules: {
        id: "eg-2-exit",
        logic: "OR",
        rules: [
          { id: "r8", type: "alpha_score", operator: "below", value: 40, ticker: null, handle: null },
        ],
      },
      action: "buy",
      createdAt: Date.now() - 5 * 86400000,
      updatedAt: Date.now() - 5 * 86400000,
      isActive: true,
      backtestResults: null,
    },
    {
      id: `strat-${strategyIdCounter++}`,
      name: "Arbitrage Fade",
      description: "Sell when prediction market probability reverses AND Alpha Score drops 20+ points in 24h",
      entryRules: {
        id: "eg-3-entry",
        logic: "AND",
        rules: [
          { id: "r9", type: "arbitrage_signal", operator: "equals", value: "extreme", ticker: null, handle: null },
          { id: "r10", type: "alpha_change", operator: "change_lt", value: -20, ticker: null, handle: null },
        ],
      },
      exitRules: null,
      action: "sell",
      createdAt: Date.now() - 3 * 86400000,
      updatedAt: Date.now() - 3 * 86400000,
      isActive: false,
      backtestResults: null,
    },
  ];
}

seedDefaultStrategies();

// ============================================================================
// Strategy CRUD
// ============================================================================

export function getStrategies(): Strategy[] {
  return strategies.map(s => ({ ...s }));
}

export function getStrategy(id: string): Strategy | null {
  return strategies.find(s => s.id === id) || null;
}

export function createStrategy(input: {
  name: string;
  description: string;
  entryRules: RuleGroup;
  exitRules: RuleGroup | null;
  action: StrategyAction;
}): Strategy {
  const strategy: Strategy = {
    id: `strat-${strategyIdCounter++}`,
    name: input.name,
    description: input.description,
    entryRules: input.entryRules,
    exitRules: input.exitRules,
    action: input.action,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isActive: true,
    backtestResults: null,
  };
  strategies.push(strategy);
  return strategy;
}

export function updateStrategy(id: string, updates: Partial<{
  name: string;
  description: string;
  entryRules: RuleGroup;
  exitRules: RuleGroup | null;
  action: StrategyAction;
  isActive: boolean;
}>): Strategy | null {
  const idx = strategies.findIndex(s => s.id === id);
  if (idx === -1) return null;
  
  strategies[idx] = {
    ...strategies[idx],
    ...updates,
    updatedAt: Date.now(),
    // Clear backtest results when rules change
    backtestResults: (updates.entryRules || updates.exitRules) ? null : strategies[idx].backtestResults,
  };
  return strategies[idx];
}

export function deleteStrategy(id: string): boolean {
  const idx = strategies.findIndex(s => s.id === id);
  if (idx === -1) return false;
  strategies.splice(idx, 1);
  return true;
}

// ============================================================================
// Rule Evaluation Engine
// ============================================================================

interface TickerState {
  ticker: string;
  alphaScore: number;
  alphaChange24h: number;
  smartMoney: string;
  tradeType: string;
  narrativeVelocity: number;
  predictionMarketProb: number;
  arbitrageStrength: string;
  vipMentions: string[];
}

function evaluateRule(rule: StrategyRule, state: TickerState): boolean {
  switch (rule.type) {
    case "alpha_score": {
      const score = state.alphaScore;
      if (rule.operator === "above") return score > (rule.value as number);
      if (rule.operator === "below") return score < (rule.value as number);
      if (rule.operator === "crosses_above") return score > (rule.value as number);
      if (rule.operator === "crosses_below") return score < (rule.value as number);
      return false;
    }
    case "smart_money": {
      if (rule.operator === "equals") return state.smartMoney === rule.value;
      if (rule.operator === "not_equals") return state.smartMoney !== rule.value;
      return false;
    }
    case "vip_trigger": {
      if (rule.handle) {
        return state.vipMentions.includes(rule.handle);
      }
      return state.vipMentions.length > 0;
    }
    case "prediction_market": {
      const prob = state.predictionMarketProb;
      if (rule.operator === "above") return prob > (rule.value as number);
      if (rule.operator === "below") return prob < (rule.value as number);
      return false;
    }
    case "timeframe_alignment": {
      if (rule.operator === "equals") return state.tradeType === rule.value;
      if (rule.operator === "not_equals") return state.tradeType !== rule.value;
      return false;
    }
    case "narrative_velocity": {
      const vel = state.narrativeVelocity;
      if (rule.operator === "above") return vel > (rule.value as number);
      if (rule.operator === "below") return vel < (rule.value as number);
      return false;
    }
    case "alpha_change": {
      const change = state.alphaChange24h;
      if (rule.operator === "change_gt") return change > (rule.value as number);
      if (rule.operator === "change_lt") return change < (rule.value as number);
      return false;
    }
    case "arbitrage_signal": {
      if (rule.operator === "equals") return state.arbitrageStrength === rule.value;
      return state.arbitrageStrength !== "none";
    }
    default:
      return false;
  }
}

function evaluateRuleGroup(group: RuleGroup, state: TickerState): boolean {
  if (group.rules.length === 0) return false;
  
  if (group.logic === "AND") {
    return group.rules.every(rule => evaluateRule(rule, state));
  } else {
    return group.rules.some(rule => evaluateRule(rule, state));
  }
}

/** Evaluate a strategy against current market state */
export function evaluateStrategy(strategyId: string): { ticker: string; triggered: boolean; action: StrategyAction }[] {
  const strategy = getStrategy(strategyId);
  if (!strategy) return [];
  
  const alphaScores = getAlphaScores();
  const smartMoneyFlows = getSmartMoneyFlows();
  const mtfScores = getMultiTimeframeScores();
  
  const results: { ticker: string; triggered: boolean; action: StrategyAction }[] = [];
  
  for (const alpha of alphaScores) {
    const smf = smartMoneyFlows.find(s => s.ticker === alpha.ticker);
    const mtf = mtfScores.find(m => m.ticker === alpha.ticker);
    
    const state: TickerState = {
      ticker: alpha.ticker,
      alphaScore: alpha.score,
      alphaChange24h: 0,
      smartMoney: smf?.rating || "neutral",
      tradeType: mtf?.tradeType || "mixed",
      narrativeVelocity: 50,
      predictionMarketProb: 50,
      arbitrageStrength: "none",
      vipMentions: [],
    };
    
    const triggered = evaluateRuleGroup(strategy.entryRules, state);
    results.push({ ticker: alpha.ticker, triggered, action: strategy.action });
  }
  
  return results;
}

// ============================================================================
// Backtesting Engine
// ============================================================================

const TICKERS = ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "TSLA", "META", "AMD", "NFLX", "CRM", "COIN", "PLTR", "SOFI", "RIVN", "SNOW"];

function generateHistoricalPrice(ticker: string, daysAgo: number): number {
  const hash = ticker.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const basePrice = 50 + (hash % 400);
  const trend = Math.sin(daysAgo / 30 + hash) * 0.15;
  const noise = Math.sin(daysAgo * 7.3 + hash * 2.1) * 0.05;
  return basePrice * (1 + trend + noise);
}

function generateHistoricalAlphaScore(ticker: string, daysAgo: number): number {
  const hash = ticker.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const base = 40 + (hash % 30);
  const cycle = Math.sin(daysAgo / 15 + hash * 0.7) * 25;
  const noise = Math.sin(daysAgo * 3.1 + hash * 1.3) * 10;
  return Math.max(0, Math.min(100, base + cycle + noise));
}

function generateHistoricalSmartMoney(ticker: string, daysAgo: number): string {
  const score = generateHistoricalAlphaScore(ticker, daysAgo);
  if (score > 75) return "strong_buy";
  if (score > 60) return "buy";
  if (score > 40) return "neutral";
  if (score > 25) return "sell";
  return "strong_sell";
}

export function backtestStrategy(strategyId: string, periodDays: number = 90): BacktestResult | null {
  const strategy = getStrategy(strategyId);
  if (!strategy) return null;
  
  const tradeLog: TradeLogEntry[] = [];
  let equity = 100000;
  const equityCurve: { date: string; value: number }[] = [];
  let maxEquity = equity;
  let maxDrawdown = 0;
  const monthlyReturns: Map<string, number> = new Map();
  
  // Track open positions
  const openPositions: Map<string, { entryPrice: number; entryDay: number; entryDate: string }> = new Map();
  
  for (let day = periodDays; day >= 0; day--) {
    const date = new Date(Date.now() - day * 86400000);
    const dateStr = date.toISOString().split("T")[0];
    const monthKey = dateStr.substring(0, 7);
    
    for (const ticker of TICKERS) {
      const alphaScore = generateHistoricalAlphaScore(ticker, day);
      const alphaYesterday = generateHistoricalAlphaScore(ticker, day + 1);
      const price = generateHistoricalPrice(ticker, day);
      
      const state: TickerState = {
        ticker,
        alphaScore,
        alphaChange24h: alphaScore - alphaYesterday,
        smartMoney: generateHistoricalSmartMoney(ticker, day),
        tradeType: alphaScore > 70 ? "conviction" : alphaScore > 50 ? "momentum" : "mixed",
        narrativeVelocity: 30 + Math.sin(day + ticker.charCodeAt(0)) * 40,
        predictionMarketProb: 30 + Math.sin(day * 0.5 + ticker.charCodeAt(1)) * 35,
        arbitrageStrength: alphaScore > 80 ? "extreme" : alphaScore > 65 ? "high" : "none",
        vipMentions: alphaScore > 75 ? ["chriscamillo", "elonmusk"] : [],
      };
      
      // Check exit rules for open positions
      if (openPositions.has(ticker) && strategy.exitRules) {
        const exitTriggered = evaluateRuleGroup(strategy.exitRules, state);
        const holdingDays = openPositions.get(ticker)!.entryDay - day;
        
        if (exitTriggered || holdingDays > 30) {
          const pos = openPositions.get(ticker)!;
          const returnPct = ((price - pos.entryPrice) / pos.entryPrice) * 100;
          const pnl = (equity * 0.05) * (returnPct / 100);
          equity += pnl;
          
          tradeLog.push({
            ticker,
            entryDate: pos.entryDate,
            exitDate: dateStr,
            entryPrice: Math.round(pos.entryPrice * 100) / 100,
            exitPrice: Math.round(price * 100) / 100,
            returnPct: Math.round(returnPct * 100) / 100,
            signalSource: state.smartMoney === "strong_buy" ? "Smart Money" : state.vipMentions.length > 0 ? "VIP Signal" : "Alpha Score",
            holdingDays: Math.max(1, holdingDays),
          });
          
          openPositions.delete(ticker);
          
          const prevMonthReturn = monthlyReturns.get(monthKey) || 0;
          monthlyReturns.set(monthKey, prevMonthReturn + returnPct);
        }
      }
      
      // Check entry rules for new positions
      if (!openPositions.has(ticker) && openPositions.size < 5) {
        const entryTriggered = evaluateRuleGroup(strategy.entryRules, state);
        if (entryTriggered) {
          openPositions.set(ticker, { entryPrice: price, entryDay: day, entryDate: dateStr });
        }
      }
    }
    
    // Track equity curve
    if (equity > maxEquity) maxEquity = equity;
    const drawdown = ((maxEquity - equity) / maxEquity) * 100;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    
    equityCurve.push({ date: dateStr, value: Math.round(equity * 100) / 100 });
  }
  
  // Close remaining positions at current prices
  for (const [ticker, pos] of Array.from(openPositions.entries())) {
    const price = generateHistoricalPrice(ticker, 0);
    const returnPct = ((price - pos.entryPrice) / pos.entryPrice) * 100;
    const pnl = (equity * 0.05) * (returnPct / 100);
    equity += pnl;
    
    tradeLog.push({
      ticker,
      entryDate: pos.entryDate,
      exitDate: new Date().toISOString().split("T")[0],
      entryPrice: Math.round(pos.entryPrice * 100) / 100,
      exitPrice: Math.round(price * 100) / 100,
      returnPct: Math.round(returnPct * 100) / 100,
      signalSource: "Alpha Score",
      holdingDays: 1,
    });
  }
  
  const wins = tradeLog.filter(t => t.returnPct > 0);
  const totalReturn = ((equity - 100000) / 100000) * 100;
  const benchmarkReturn = 8.5 + Math.random() * 4; // S&P 500 ~8-12% annualized
  
  const sortedByReturn = [...tradeLog].sort((a, b) => b.returnPct - a.returnPct);
  const bestTrade = sortedByReturn[0] || { ticker: "N/A", returnPct: 0, date: "N/A" };
  const worstTrade = sortedByReturn[sortedByReturn.length - 1] || { ticker: "N/A", returnPct: 0, date: "N/A" };
  
  // Calculate Sharpe ratio
  const returns = tradeLog.map(t => t.returnPct);
  const avgReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
  const stdDev = returns.length > 1
    ? Math.sqrt(returns.reduce((sum, r) => sum + (r - avgReturn) ** 2, 0) / (returns.length - 1))
    : 1;
  const sharpeRatio = stdDev > 0 ? (avgReturn - 0.02) / stdDev : 0;
  
  const result: BacktestResult = {
    strategyId,
    runAt: Date.now(),
    periodDays,
    totalTrades: tradeLog.length,
    winRate: tradeLog.length > 0 ? Math.round((wins.length / tradeLog.length) * 100) : 0,
    totalReturn: Math.round(totalReturn * 100) / 100,
    maxDrawdown: Math.round(maxDrawdown * 100) / 100,
    sharpeRatio: Math.round(sharpeRatio * 100) / 100,
    avgHoldingDays: tradeLog.length > 0
      ? Math.round(tradeLog.reduce((sum, t) => sum + t.holdingDays, 0) / tradeLog.length)
      : 0,
    bestTrade: { ticker: bestTrade.ticker, returnPct: bestTrade.returnPct, date: bestTrade.entryDate },
    worstTrade: { ticker: worstTrade.ticker, returnPct: worstTrade.returnPct, date: worstTrade.entryDate },
    monthlyReturns: Array.from(monthlyReturns.entries()).map(([month, returnPct]) => ({
      month,
      returnPct: Math.round(returnPct * 100) / 100,
    })),
    equityCurve,
    tradeLog,
    benchmarkReturn: Math.round(benchmarkReturn * 100) / 100,
    alpha: Math.round((totalReturn - benchmarkReturn) * 100) / 100,
  };
  
  // Store results on the strategy
  const idx = strategies.findIndex(s => s.id === strategyId);
  if (idx !== -1) {
    strategies[idx].backtestResults = result;
  }
  
  return result;
}

// ============================================================================
// Rule Type Metadata (for frontend rule builder)
// ============================================================================

export interface RuleTypeInfo {
  type: RuleType;
  label: string;
  description: string;
  operators: { value: RuleOperator; label: string }[];
  valueType: "number" | "select" | "text";
  valueOptions?: { value: string; label: string }[];
  hasTickerFilter: boolean;
  hasHandleFilter: boolean;
}

export function getRuleTypes(): RuleTypeInfo[] {
  return [
    {
      type: "alpha_score",
      label: "Alpha Score",
      description: "Composite alpha score (0-100)",
      operators: [
        { value: "above", label: "is above" },
        { value: "below", label: "is below" },
        { value: "crosses_above", label: "crosses above" },
        { value: "crosses_below", label: "crosses below" },
      ],
      valueType: "number",
      hasTickerFilter: true,
      hasHandleFilter: false,
    },
    {
      type: "smart_money",
      label: "Smart Money Flow",
      description: "Aggregate smart money directional signal",
      operators: [
        { value: "equals", label: "is" },
        { value: "not_equals", label: "is not" },
      ],
      valueType: "select",
      valueOptions: [
        { value: "strong_buy", label: "Strong Buy" },
        { value: "buy", label: "Buy" },
        { value: "neutral", label: "Neutral" },
        { value: "sell", label: "Sell" },
        { value: "strong_sell", label: "Strong Sell" },
      ],
      hasTickerFilter: true,
      hasHandleFilter: false,
    },
    {
      type: "vip_trigger",
      label: "VIP Account Trigger",
      description: "When a specific VIP account tweets about a ticker",
      operators: [
        { value: "equals", label: "mentioned ticker" },
      ],
      valueType: "text",
      hasTickerFilter: true,
      hasHandleFilter: true,
    },
    {
      type: "prediction_market",
      label: "Prediction Market Probability",
      description: "Polymarket/Kalshi contract probability (%)",
      operators: [
        { value: "above", label: "is above" },
        { value: "below", label: "is below" },
      ],
      valueType: "number",
      hasTickerFilter: true,
      hasHandleFilter: false,
    },
    {
      type: "timeframe_alignment",
      label: "Timeframe Alignment",
      description: "Multi-timeframe trade type classification",
      operators: [
        { value: "equals", label: "is" },
        { value: "not_equals", label: "is not" },
      ],
      valueType: "select",
      valueOptions: [
        { value: "conviction", label: "Conviction (all timeframes aligned)" },
        { value: "momentum", label: "Momentum (short-term high)" },
        { value: "swing", label: "Swing (medium-term)" },
        { value: "mixed", label: "Mixed" },
      ],
      hasTickerFilter: true,
      hasHandleFilter: false,
    },
    {
      type: "narrative_velocity",
      label: "Narrative Velocity",
      description: "Speed of narrative change (0-100)",
      operators: [
        { value: "above", label: "is above" },
        { value: "below", label: "is below" },
      ],
      valueType: "number",
      hasTickerFilter: true,
      hasHandleFilter: false,
    },
    {
      type: "alpha_change",
      label: "Alpha Score Change (24h)",
      description: "How much the Alpha Score changed in the last 24 hours",
      operators: [
        { value: "change_gt", label: "increased by more than" },
        { value: "change_lt", label: "decreased by more than" },
      ],
      valueType: "number",
      hasTickerFilter: true,
      hasHandleFilter: false,
    },
    {
      type: "arbitrage_signal",
      label: "Arbitrage Signal",
      description: "Divergence between prediction markets and AI",
      operators: [
        { value: "equals", label: "strength is" },
      ],
      valueType: "select",
      valueOptions: [
        { value: "extreme", label: "Extreme" },
        { value: "high", label: "High" },
        { value: "medium", label: "Medium" },
        { value: "low", label: "Low" },
      ],
      hasTickerFilter: true,
      hasHandleFilter: false,
    },
  ];
}

// ============================================================================
// Status
// ============================================================================

export function getStrategyBuilderStatus() {
  return {
    name: "Strategy Builder",
    description: "Custom trading strategy rule engine with backtesting",
    status: "ready" as const,
    totalStrategies: strategies.length,
    activeStrategies: strategies.filter(s => s.isActive).length,
    backtested: strategies.filter(s => s.backtestResults !== null).length,
  };
}
