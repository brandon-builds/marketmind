import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { AppHeader } from "@/components/AppHeader";
import {
  Brain, Plus, Trash2, Play, BarChart3, Zap, ChevronDown, ChevronUp,
  ToggleLeft, ToggleRight, TrendingUp, TrendingDown, Target, AlertTriangle,
  CheckCircle2, XCircle, ArrowRight, Loader2,
} from "lucide-react";

type RuleType = "alpha_score" | "smart_money" | "vip_trigger" | "prediction_market" | "timeframe_alignment" | "narrative_velocity" | "alpha_change" | "arbitrage_signal";
type RuleOperator = "above" | "below" | "equals" | "not_equals" | "crosses_above" | "crosses_below" | "change_gt" | "change_lt";

interface Rule {
  id: string;
  type: RuleType;
  operator: RuleOperator;
  value: string | number;
  ticker: string | null;
  handle: string | null;
}

interface RuleGroup {
  id: string;
  logic: "AND" | "OR";
  rules: Rule[];
}

export default function StrategyBuilder() {
  const { data: strategies, refetch } = trpc.intelligence.getStrategies.useQuery();
  const { data: ruleTypes } = trpc.intelligence.getRuleTypes.useQuery();
  const createMutation = trpc.intelligence.createStrategy.useMutation({ onSuccess: () => refetch() });
  const deleteMutation = trpc.intelligence.deleteStrategy.useMutation({ onSuccess: () => refetch() });
  const backtestMutation = trpc.intelligence.backtestStrategy.useMutation({ onSuccess: () => refetch() });

  const [showBuilder, setShowBuilder] = useState(false);
  const [expandedStrategy, setExpandedStrategy] = useState<string | null>(null);
  const [backtestingId, setBacktestingId] = useState<string | null>(null);

  // New strategy form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [action, setAction] = useState<"buy" | "sell" | "hold" | "alert_only">("buy");
  const [entryLogic, setEntryLogic] = useState<"AND" | "OR">("AND");
  const [entryRules, setEntryRules] = useState<Rule[]>([]);
  const [exitLogic, setExitLogic] = useState<"AND" | "OR">("OR");
  const [exitRules, setExitRules] = useState<Rule[]>([]);

  function addRule(target: "entry" | "exit") {
    const newRule: Rule = {
      id: `r-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      type: "alpha_score",
      operator: "above",
      value: 70,
      ticker: null,
      handle: null,
    };
    if (target === "entry") setEntryRules([...entryRules, newRule]);
    else setExitRules([...exitRules, newRule]);
  }

  function removeRule(target: "entry" | "exit", ruleId: string) {
    if (target === "entry") setEntryRules(entryRules.filter(r => r.id !== ruleId));
    else setExitRules(exitRules.filter(r => r.id !== ruleId));
  }

  function updateRule(target: "entry" | "exit", ruleId: string, updates: Partial<Rule>) {
    const setter = target === "entry" ? setEntryRules : setExitRules;
    const rules = target === "entry" ? entryRules : exitRules;
    setter(rules.map(r => r.id === ruleId ? { ...r, ...updates } : r));
  }

  function handleCreate() {
    if (!name.trim() || entryRules.length === 0) return;
    createMutation.mutate({
      name,
      description,
      action,
      entryRules: { id: `eg-${Date.now()}`, logic: entryLogic, rules: entryRules },
      exitRules: exitRules.length > 0 ? { id: `ex-${Date.now()}`, logic: exitLogic, rules: exitRules } : null,
    });
    setShowBuilder(false);
    setName("");
    setDescription("");
    setEntryRules([]);
    setExitRules([]);
  }

  function handleBacktest(strategyId: string) {
    setBacktestingId(strategyId);
    backtestMutation.mutate({ id: strategyId, periodDays: 90 }, {
      onSettled: () => setBacktestingId(null),
    });
  }

  const ruleTypeMap = useMemo(() => {
    if (!ruleTypes) return new Map();
    return new Map(ruleTypes.map((rt: any) => [rt.type, rt]));
  }, [ruleTypes]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader />
      <main className="container max-w-7xl py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Brain className="w-8 h-8 text-violet-500" />
              Strategy Builder
            </h1>
            <p className="text-muted-foreground mt-1">
              Define custom trading strategies with visual rules, then backtest against historical data
            </p>
          </div>
          <button
            onClick={() => setShowBuilder(!showBuilder)}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Strategy
          </button>
        </div>

        {/* Strategy Builder Form */}
        {showBuilder && (
          <div className="bg-card border border-border rounded-xl p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4">Create New Strategy</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">Strategy Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g., High Alpha Conviction"
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">Action</label>
                <select
                  value={action}
                  onChange={e => setAction(e.target.value as any)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground"
                >
                  <option value="buy">Buy</option>
                  <option value="sell">Sell</option>
                  <option value="hold">Hold</option>
                  <option value="alert_only">Alert Only</option>
                </select>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-muted-foreground mb-1">Description</label>
              <input
                type="text"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Describe what this strategy does..."
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground"
              />
            </div>

            {/* Entry Rules */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-medium flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-emerald-500" />
                  Entry Rules
                </h3>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Logic:</span>
                  <button
                    onClick={() => setEntryLogic(entryLogic === "AND" ? "OR" : "AND")}
                    className={`px-3 py-1 rounded text-xs font-bold ${entryLogic === "AND" ? "bg-blue-600 text-white" : "bg-amber-600 text-white"}`}
                  >
                    {entryLogic}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                {entryRules.map((rule, idx) => (
                  <RuleRow
                    key={rule.id}
                    rule={rule}
                    ruleTypes={ruleTypeMap}
                    onChange={(updates) => updateRule("entry", rule.id, updates)}
                    onRemove={() => removeRule("entry", rule.id)}
                    showLogic={idx > 0}
                    logic={entryLogic}
                  />
                ))}
                <button
                  onClick={() => addRule("entry")}
                  className="flex items-center gap-1 text-sm text-violet-400 hover:text-violet-300 transition-colors"
                >
                  <Plus className="w-3 h-3" /> Add entry condition
                </button>
              </div>
            </div>

            {/* Exit Rules */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-medium flex items-center gap-2">
                  <TrendingDown className="w-5 h-5 text-red-500" />
                  Exit Rules <span className="text-xs text-muted-foreground">(optional)</span>
                </h3>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Logic:</span>
                  <button
                    onClick={() => setExitLogic(exitLogic === "AND" ? "OR" : "AND")}
                    className={`px-3 py-1 rounded text-xs font-bold ${exitLogic === "AND" ? "bg-blue-600 text-white" : "bg-amber-600 text-white"}`}
                  >
                    {exitLogic}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                {exitRules.map((rule, idx) => (
                  <RuleRow
                    key={rule.id}
                    rule={rule}
                    ruleTypes={ruleTypeMap}
                    onChange={(updates) => updateRule("exit", rule.id, updates)}
                    onRemove={() => removeRule("exit", rule.id)}
                    showLogic={idx > 0}
                    logic={exitLogic}
                  />
                ))}
                <button
                  onClick={() => addRule("exit")}
                  className="flex items-center gap-1 text-sm text-red-400 hover:text-red-300 transition-colors"
                >
                  <Plus className="w-3 h-3" /> Add exit condition
                </button>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleCreate}
                disabled={!name.trim() || entryRules.length === 0}
                className="px-6 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white rounded-lg transition-colors"
              >
                Create Strategy
              </button>
              <button
                onClick={() => setShowBuilder(false)}
                className="px-6 py-2 bg-muted hover:bg-muted/80 text-foreground rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Strategy List */}
        <div className="space-y-4">
          {strategies?.map((strategy: any) => (
            <div key={strategy.id} className="bg-card border border-border rounded-xl overflow-hidden">
              {/* Strategy Header */}
              <div
                className="p-5 cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => setExpandedStrategy(expandedStrategy === strategy.id ? null : strategy.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      strategy.action === "buy" ? "bg-emerald-500/20 text-emerald-400" :
                      strategy.action === "sell" ? "bg-red-500/20 text-red-400" :
                      "bg-blue-500/20 text-blue-400"
                    }`}>
                      {strategy.action === "buy" ? <TrendingUp className="w-5 h-5" /> :
                       strategy.action === "sell" ? <TrendingDown className="w-5 h-5" /> :
                       <Target className="w-5 h-5" />}
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">{strategy.name}</h3>
                      <p className="text-sm text-muted-foreground">{strategy.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      strategy.isActive ? "bg-emerald-500/20 text-emerald-400" : "bg-muted text-muted-foreground"
                    }`}>
                      {strategy.isActive ? "Active" : "Inactive"}
                    </span>
                    <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                      strategy.action === "buy" ? "bg-emerald-500/20 text-emerald-400" :
                      strategy.action === "sell" ? "bg-red-500/20 text-red-400" :
                      strategy.action === "alert_only" ? "bg-amber-500/20 text-amber-400" :
                      "bg-blue-500/20 text-blue-400"
                    }`}>
                      {strategy.action.replace("_", " ")}
                    </span>
                    {strategy.backtestResults && (
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        strategy.backtestResults.totalReturn > 0 ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
                      }`}>
                        {strategy.backtestResults.totalReturn > 0 ? "+" : ""}{strategy.backtestResults.totalReturn}%
                      </span>
                    )}
                    {expandedStrategy === strategy.id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </div>
                </div>
              </div>

              {/* Expanded Details */}
              {expandedStrategy === strategy.id && (
                <div className="border-t border-border p-5">
                  {/* Rules Display */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div>
                      <h4 className="text-sm font-semibold text-emerald-400 mb-2 flex items-center gap-1">
                        <TrendingUp className="w-4 h-4" /> Entry Rules ({strategy.entryRules.logic})
                      </h4>
                      <div className="space-y-1">
                        {strategy.entryRules.rules.map((rule: any, idx: number) => (
                          <div key={rule.id} className="text-sm">
                            {idx > 0 && <span className="text-xs font-bold text-blue-400 mr-1">{strategy.entryRules.logic}</span>}
                            <span className="text-muted-foreground">
                              {getRuleLabel(rule)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                    {strategy.exitRules && (
                      <div>
                        <h4 className="text-sm font-semibold text-red-400 mb-2 flex items-center gap-1">
                          <TrendingDown className="w-4 h-4" /> Exit Rules ({strategy.exitRules.logic})
                        </h4>
                        <div className="space-y-1">
                          {strategy.exitRules.rules.map((rule: any, idx: number) => (
                            <div key={rule.id} className="text-sm">
                              {idx > 0 && <span className="text-xs font-bold text-amber-400 mr-1">{strategy.exitRules.logic}</span>}
                              <span className="text-muted-foreground">
                                {getRuleLabel(rule)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Backtest Results */}
                  {strategy.backtestResults && (
                    <div className="bg-muted/30 rounded-lg p-4 mb-4">
                      <h4 className="text-sm font-semibold mb-3 flex items-center gap-1">
                        <BarChart3 className="w-4 h-4 text-violet-400" /> Backtest Results ({strategy.backtestResults.periodDays} days)
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        <StatBox label="Total Return" value={`${strategy.backtestResults.totalReturn > 0 ? "+" : ""}${strategy.backtestResults.totalReturn}%`} positive={strategy.backtestResults.totalReturn > 0} />
                        <StatBox label="Win Rate" value={`${strategy.backtestResults.winRate}%`} positive={strategy.backtestResults.winRate > 50} />
                        <StatBox label="Sharpe Ratio" value={strategy.backtestResults.sharpeRatio.toFixed(2)} positive={strategy.backtestResults.sharpeRatio > 1} />
                        <StatBox label="Max Drawdown" value={`-${strategy.backtestResults.maxDrawdown}%`} positive={strategy.backtestResults.maxDrawdown < 10} />
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        <StatBox label="Total Trades" value={String(strategy.backtestResults.totalTrades)} />
                        <StatBox label="Avg Holding" value={`${strategy.backtestResults.avgHoldingDays}d`} />
                        <StatBox label="vs S&P 500" value={`${strategy.backtestResults.alpha > 0 ? "+" : ""}${strategy.backtestResults.alpha}%`} positive={strategy.backtestResults.alpha > 0} />
                        <StatBox label="Benchmark" value={`+${strategy.backtestResults.benchmarkReturn}%`} />
                      </div>

                      {/* Equity Curve (simple sparkline) */}
                      <div className="h-24 flex items-end gap-px">
                        {strategy.backtestResults.equityCurve.slice(-60).map((point: any, idx: number) => {
                          const min = Math.min(...strategy.backtestResults.equityCurve.slice(-60).map((p: any) => p.value));
                          const max = Math.max(...strategy.backtestResults.equityCurve.slice(-60).map((p: any) => p.value));
                          const range = max - min || 1;
                          const height = ((point.value - min) / range) * 100;
                          return (
                            <div
                              key={idx}
                              className={`flex-1 rounded-t-sm ${point.value >= 100000 ? "bg-emerald-500/60" : "bg-red-500/60"}`}
                              style={{ height: `${Math.max(2, height)}%` }}
                            />
                          );
                        })}
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground mt-1">
                        <span>Start: $100,000</span>
                        <span>End: ${strategy.backtestResults.equityCurve[strategy.backtestResults.equityCurve.length - 1]?.value.toLocaleString()}</span>
                      </div>

                      {/* Best/Worst Trades */}
                      <div className="grid grid-cols-2 gap-4 mt-4">
                        <div className="bg-emerald-500/10 rounded-lg p-3">
                          <div className="text-xs text-emerald-400 font-medium">Best Trade</div>
                          <div className="text-lg font-bold text-emerald-400">
                            {strategy.backtestResults.bestTrade.ticker} +{strategy.backtestResults.bestTrade.returnPct}%
                          </div>
                        </div>
                        <div className="bg-red-500/10 rounded-lg p-3">
                          <div className="text-xs text-red-400 font-medium">Worst Trade</div>
                          <div className="text-lg font-bold text-red-400">
                            {strategy.backtestResults.worstTrade.ticker} {strategy.backtestResults.worstTrade.returnPct}%
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleBacktest(strategy.id)}
                      disabled={backtestingId === strategy.id}
                      className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-lg text-sm transition-colors"
                    >
                      {backtestingId === strategy.id ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Running Backtest...</>
                      ) : (
                        <><Play className="w-4 h-4" /> Run Backtest (90d)</>
                      )}
                    </button>
                    <button
                      onClick={() => {
                        if (confirm("Delete this strategy?")) {
                          deleteMutation.mutate({ id: strategy.id });
                        }
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg text-sm transition-colors"
                    >
                      <Trash2 className="w-4 h-4" /> Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {(!strategies || strategies.length === 0) && (
            <div className="text-center py-16 text-muted-foreground">
              <Brain className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p className="text-lg">No strategies yet</p>
              <p className="text-sm">Create your first strategy to start backtesting</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

function RuleRow({ rule, ruleTypes, onChange, onRemove, showLogic, logic }: {
  rule: Rule;
  ruleTypes: Map<string, any>;
  onChange: (updates: Partial<Rule>) => void;
  onRemove: () => void;
  showLogic: boolean;
  logic: string;
}) {
  const ruleType = ruleTypes.get(rule.type);

  return (
    <div className="flex items-center gap-2 bg-muted/30 rounded-lg p-2">
      {showLogic && (
        <span className={`px-2 py-0.5 rounded text-xs font-bold ${logic === "AND" ? "bg-blue-600/30 text-blue-400" : "bg-amber-600/30 text-amber-400"}`}>
          {logic}
        </span>
      )}
      <select
        value={rule.type}
        onChange={e => {
          const newType = e.target.value as RuleType;
          const newRuleType = ruleTypes.get(newType);
          onChange({
            type: newType,
            operator: newRuleType?.operators[0]?.value || "above",
            value: newRuleType?.valueType === "number" ? 70 : newRuleType?.valueOptions?.[0]?.value || "",
          });
        }}
        className="px-2 py-1 bg-background border border-border rounded text-sm text-foreground"
      >
        {Array.from(ruleTypes.values()).map((rt: any) => (
          <option key={rt.type} value={rt.type}>{rt.label}</option>
        ))}
      </select>

      <select
        value={rule.operator}
        onChange={e => onChange({ operator: e.target.value as RuleOperator })}
        className="px-2 py-1 bg-background border border-border rounded text-sm text-foreground"
      >
        {ruleType?.operators?.map((op: any) => (
          <option key={op.value} value={op.value}>{op.label}</option>
        )) || <option value={rule.operator}>{rule.operator}</option>}
      </select>

      {ruleType?.valueType === "select" ? (
        <select
          value={String(rule.value)}
          onChange={e => onChange({ value: e.target.value })}
          className="px-2 py-1 bg-background border border-border rounded text-sm text-foreground"
        >
          {ruleType.valueOptions?.map((opt: any) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      ) : (
        <input
          type={ruleType?.valueType === "number" ? "number" : "text"}
          value={rule.value}
          onChange={e => onChange({ value: ruleType?.valueType === "number" ? Number(e.target.value) : e.target.value })}
          className="w-20 px-2 py-1 bg-background border border-border rounded text-sm text-foreground"
        />
      )}

      {ruleType?.hasHandleFilter && (
        <input
          type="text"
          value={rule.handle || ""}
          onChange={e => onChange({ handle: e.target.value || null })}
          placeholder="@handle"
          className="w-28 px-2 py-1 bg-background border border-border rounded text-sm text-foreground"
        />
      )}

      <button onClick={onRemove} className="p-1 text-red-400 hover:text-red-300">
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

function StatBox({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return (
    <div className="text-center">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-lg font-bold ${positive === true ? "text-emerald-400" : positive === false ? "text-red-400" : "text-foreground"}`}>
        {value}
      </div>
    </div>
  );
}

function getRuleLabel(rule: any): string {
  const typeLabels: Record<string, string> = {
    alpha_score: "Alpha Score",
    smart_money: "Smart Money",
    vip_trigger: "VIP Account",
    prediction_market: "Prediction Market",
    timeframe_alignment: "Timeframe",
    narrative_velocity: "Narrative Velocity",
    alpha_change: "Alpha Change (24h)",
    arbitrage_signal: "Arbitrage Signal",
  };
  const opLabels: Record<string, string> = {
    above: ">", below: "<", equals: "=", not_equals: "≠",
    crosses_above: "crosses ↑", crosses_below: "crosses ↓",
    change_gt: "Δ >", change_lt: "Δ <",
  };
  const handle = rule.handle ? ` @${rule.handle}` : "";
  return `${typeLabels[rule.type] || rule.type} ${opLabels[rule.operator] || rule.operator} ${rule.value}${handle}`;
}
