import { usePageTracking } from "@/hooks/usePageTracking";
import { trpc } from "@/lib/trpc";
import { motion } from "framer-motion";
import { useSearch } from "wouter";
import {
  TrendingUp, TrendingDown, Minus, BarChart3,
  Plus, X, ArrowRight, Search,
} from "lucide-react";
import { useState, useMemo } from "react";
import { AppHeader } from "@/components/AppHeader";
import { Link } from "wouter";
import { TICKER_UNIVERSE } from "@shared/tickers";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

const CHART_COLORS = ["#3b82f6", "#10b981", "#f59e0b"];

function TickerSelector({ selected, onSelect, onRemove }: {
  selected: string[];
  onSelect: (symbol: string) => void;
  onRemove: (symbol: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    if (!search) return TICKER_UNIVERSE.slice(0, 20);
    const q = search.toLowerCase();
    return TICKER_UNIVERSE.filter(
      t => t.symbol.toLowerCase().includes(q) || t.name.toLowerCase().includes(q)
    ).slice(0, 20);
  }, [search]);

  return (
    <div className="section-card">
      <h3 className="text-sm font-semibold text-foreground mb-3">Select Tickers to Compare (2-3)</h3>

      {/* Selected Tickers */}
      <div className="flex flex-wrap gap-2 mb-3">
        {selected.map((sym, i) => (
          <div
            key={sym}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border"
            style={{ borderColor: CHART_COLORS[i] + "60" }}
          >
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: CHART_COLORS[i] }} />
            <span className="text-sm font-mono font-semibold text-foreground">{sym}</span>
            <button onClick={() => onRemove(sym)} className="ml-1 hover:text-red-400 transition-colors">
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
        {selected.length < 3 && (
          <button
            onClick={() => setOpen(!open)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-blue-500/50 transition-all text-sm"
          >
            <Plus className="w-3 h-3" />
            Add Ticker
          </button>
        )}
      </div>

      {/* Search Dropdown */}
      {open && selected.length < 3 && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="border border-border rounded-lg overflow-hidden"
        >
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
            <Search className="w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search ticker or company..."
              className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              autoFocus
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtered.map(t => (
              <button
                key={t.symbol}
                disabled={selected.includes(t.symbol)}
                onClick={() => {
                  onSelect(t.symbol);
                  setSearch("");
                  setOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 text-left hover:bg-accent/50 transition-colors ${
                  selected.includes(t.symbol) ? "opacity-30 cursor-not-allowed" : ""
                }`}
              >
                <div>
                  <span className="text-sm font-mono font-semibold text-foreground">{t.symbol}</span>
                  <span className="text-xs text-muted-foreground ml-2">{t.name}</span>
                </div>
                <span className="text-[10px] text-muted-foreground px-1.5 py-0.5 rounded bg-muted/50">{t.type}</span>
              </button>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}

function ComparisonChart({ data }: { data: any }) {
  if (!data || !data.tickers || data.tickers.length < 2) return null;

  // Normalize prices to percentage change from first day
  const chartData = data.tickers[0].chartData.map((_: any, i: number) => {
    const point: any = { date: data.tickers[0].chartData[i].date };
    data.tickers.forEach((ticker: any, j: number) => {
      const basePrice = ticker.chartData[0]?.price || 1;
      const currentPrice = ticker.chartData[i]?.price || basePrice;
      point[ticker.symbol] = Math.round(((currentPrice - basePrice) / basePrice) * 10000) / 100;
    });
    return point;
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="section-card"
    >
      <h3 className="text-sm font-semibold text-foreground mb-1">30-Day Relative Performance (%)</h3>
      <p className="text-xs text-muted-foreground mb-4">Normalized to first day = 0%</p>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
              tickFormatter={(v: string) => {
                const d = new Date(v);
                return `${d.getMonth() + 1}/${d.getDate()}`;
              }}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
              tickFormatter={(v: number) => `${v > 0 ? "+" : ""}${v}%`}
              width={50}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--popover))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                fontSize: "12px",
                color: "hsl(var(--popover-foreground))",
              }}
              formatter={(value: number, name: string) => [`${value > 0 ? "+" : ""}${value}%`, name]}
            />
            <Legend />
            {data.tickers.map((ticker: any, i: number) => (
              <Line
                key={ticker.symbol}
                type="monotone"
                dataKey={ticker.symbol}
                stroke={CHART_COLORS[i]}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}

function ComparisonTable({ data }: { data: any }) {
  if (!data || !data.tickers || data.tickers.length < 2) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="section-card overflow-x-auto"
    >
      <h3 className="text-sm font-semibold text-foreground mb-4">Side-by-Side Comparison</h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-2 text-xs text-muted-foreground font-medium">Metric</th>
            {data.tickers.map((t: any, i: number) => (
              <th key={t.symbol} className="text-center py-2">
                <div className="flex items-center justify-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: CHART_COLORS[i] }} />
                  <span className="font-mono font-bold text-foreground">{t.symbol}</span>
                </div>
                <span className="text-[10px] text-muted-foreground font-normal">{t.name}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {/* Price */}
          <tr className="border-b border-border/50">
            <td className="py-3 text-muted-foreground">Current Price</td>
            {data.tickers.map((t: any) => (
              <td key={t.symbol} className="py-3 text-center font-mono font-semibold text-foreground">
                ${t.price.toFixed(2)}
              </td>
            ))}
          </tr>
          {/* Change */}
          <tr className="border-b border-border/50">
            <td className="py-3 text-muted-foreground">Daily Change</td>
            {data.tickers.map((t: any) => (
              <td key={t.symbol} className={`py-3 text-center font-mono font-semibold ${t.changePercent >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {t.changePercent >= 0 ? "+" : ""}{t.changePercent.toFixed(2)}%
              </td>
            ))}
          </tr>
          {/* 1D Prediction */}
          <tr className="border-b border-border/50">
            <td className="py-3 text-muted-foreground">1D Prediction</td>
            {data.tickers.map((t: any) => (
              <td key={t.symbol} className="py-3 text-center">
                <div className="flex items-center justify-center gap-1">
                  {t.prediction.direction === "up" ? (
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                  ) : t.prediction.direction === "down" ? (
                    <TrendingDown className="w-3.5 h-3.5 text-red-400" />
                  ) : (
                    <Minus className="w-3.5 h-3.5 text-zinc-400" />
                  )}
                  <span className={`font-mono text-xs ${
                    t.prediction.direction === "up" ? "text-emerald-400" : t.prediction.direction === "down" ? "text-red-400" : "text-muted-foreground"
                  }`}>
                    {(t.prediction.confidence * 100).toFixed(0)}%
                  </span>
                </div>
              </td>
            ))}
          </tr>
          {/* 7D Prediction */}
          <tr className="border-b border-border/50">
            <td className="py-3 text-muted-foreground">7D Prediction</td>
            {data.tickers.map((t: any) => (
              <td key={t.symbol} className="py-3 text-center">
                <div className="flex items-center justify-center gap-1">
                  {t.prediction.horizon7d === "up" ? (
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                  ) : t.prediction.horizon7d === "down" ? (
                    <TrendingDown className="w-3.5 h-3.5 text-red-400" />
                  ) : (
                    <Minus className="w-3.5 h-3.5 text-zinc-400" />
                  )}
                  <span className={`font-mono text-xs ${
                    t.prediction.horizon7d === "up" ? "text-emerald-400" : t.prediction.horizon7d === "down" ? "text-red-400" : "text-muted-foreground"
                  }`}>
                    {(t.prediction.confidence7d * 100).toFixed(0)}%
                  </span>
                </div>
              </td>
            ))}
          </tr>
          {/* 30D Prediction */}
          <tr className="border-b border-border/50">
            <td className="py-3 text-muted-foreground">30D Prediction</td>
            {data.tickers.map((t: any) => (
              <td key={t.symbol} className="py-3 text-center">
                <div className="flex items-center justify-center gap-1">
                  {t.prediction.horizon30d === "up" ? (
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                  ) : t.prediction.horizon30d === "down" ? (
                    <TrendingDown className="w-3.5 h-3.5 text-red-400" />
                  ) : (
                    <Minus className="w-3.5 h-3.5 text-zinc-400" />
                  )}
                  <span className={`font-mono text-xs ${
                    t.prediction.horizon30d === "up" ? "text-emerald-400" : t.prediction.horizon30d === "down" ? "text-red-400" : "text-muted-foreground"
                  }`}>
                    {(t.prediction.confidence30d * 100).toFixed(0)}%
                  </span>
                </div>
              </td>
            ))}
          </tr>
          {/* Narrative Sentiment */}
          <tr className="border-b border-border/50">
            <td className="py-3 text-muted-foreground">Narrative Sentiment</td>
            {data.tickers.map((t: any) => (
              <td key={t.symbol} className="py-3 text-center">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  t.narrativeSentiment.label === "Bullish" ? "bg-emerald-500/10 text-emerald-400" :
                  t.narrativeSentiment.label === "Bearish" ? "bg-red-500/10 text-red-400" :
                  "bg-zinc-500/10 text-zinc-400"
                }`}>
                  {t.narrativeSentiment.label} ({t.narrativeSentiment.score > 0 ? "+" : ""}{t.narrativeSentiment.score.toFixed(1)})
                </span>
              </td>
            ))}
          </tr>
          {/* Narrative Count */}
          <tr className="border-b border-border/50">
            <td className="py-3 text-muted-foreground">Active Narratives</td>
            {data.tickers.map((t: any) => (
              <td key={t.symbol} className="py-3 text-center font-mono text-foreground">
                {t.narrativeSentiment.narrativeCount}
              </td>
            ))}
          </tr>
          {/* Top Narrative */}
          <tr>
            <td className="py-3 text-muted-foreground">Top Narrative</td>
            {data.tickers.map((t: any) => (
              <td key={t.symbol} className="py-3 text-center text-xs text-muted-foreground">
                {t.narrativeSentiment.topNarrative}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </motion.div>
  );
}

export default function Compare() {
  usePageTracking("compare");
  const [selected, setSelected] = useState<string[]>(["SPY", "QQQ"]);

  const { data, isLoading } = trpc.market.comparison.useQuery(
    { symbols: selected },
    { enabled: selected.length >= 2 }
  );

  const handleSelect = (symbol: string) => {
    if (selected.length < 3 && !selected.includes(symbol)) {
      setSelected([...selected, symbol]);
    }
  };

  const handleRemove = (symbol: string) => {
    setSelected(selected.filter(s => s !== symbol));
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader title="Ticker Comparison" subtitle="Side-by-Side Analysis" showBack />

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6">
        {/* Page Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500/20 to-cyan-500/20">
              <BarChart3 className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                Ticker Comparison
              </h1>
              <p className="text-sm text-muted-foreground">Compare price performance, predictions, and narrative sentiment side-by-side</p>
            </div>
          </div>
        </div>

        {/* Ticker Selector */}
        <TickerSelector
          selected={selected}
          onSelect={handleSelect}
          onRemove={handleRemove}
        />

        {selected.length < 2 && (
          <div className="mt-6 section-card text-center py-12">
            <BarChart3 className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">Select at least 2 tickers to compare</p>
          </div>
        )}

        {selected.length >= 2 && isLoading && (
          <div className="mt-6 space-y-4">
            <div className="section-card h-80 animate-pulse bg-muted/20" />
            <div className="section-card h-96 animate-pulse bg-muted/20" />
          </div>
        )}

        {selected.length >= 2 && data && (
          <div className="mt-6 space-y-4">
            <ComparisonChart data={data} />
            <ComparisonTable data={data} />

            {/* Quick Actions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {data.tickers.map((t: any, i: number) => (
                <Link key={t.symbol} href={`/ticker/${t.symbol}`}>
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="section-card group cursor-pointer hover:border-blue-500/30 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CHART_COLORS[i] }} />
                        <span className="font-mono font-bold text-foreground">{t.symbol}</span>
                      </div>
                      <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-blue-400 transition-colors" />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">View full Deep Dive analysis</p>
                  </motion.div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
