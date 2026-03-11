/**
 * Client-side report export utility.
 * Generates a clean HTML report and opens it in a new window for print-to-PDF.
 */

interface ReportSection {
  title: string;
  content: string; // HTML content
}

interface ReportConfig {
  title: string;
  subtitle?: string;
  date: string;
  sections: ReportSection[];
}

export function exportReport(config: ReportConfig) {
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${config.title} — MarketMind Report</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
    
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      font-family: 'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif;
      color: #1a1a2e;
      background: #fff;
      padding: 40px;
      max-width: 900px;
      margin: 0 auto;
      line-height: 1.6;
    }
    
    .header {
      border-bottom: 2px solid #1a1a2e;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    
    .header h1 {
      font-size: 28px;
      font-weight: 700;
      letter-spacing: -0.5px;
    }
    
    .header .subtitle {
      font-size: 14px;
      color: #666;
      margin-top: 4px;
    }
    
    .header .date {
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      color: #999;
      margin-top: 8px;
    }
    
    .header .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 12px;
    }
    
    .header .brand-icon {
      width: 32px;
      height: 32px;
      background: linear-gradient(135deg, #3b82f6, #8b5cf6);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: 700;
      font-size: 16px;
    }
    
    .header .brand-name {
      font-size: 14px;
      font-weight: 600;
      color: #666;
      letter-spacing: 0.1em;
      text-transform: uppercase;
    }
    
    .section {
      margin-bottom: 28px;
      page-break-inside: avoid;
    }
    
    .section h2 {
      font-size: 16px;
      font-weight: 600;
      color: #1a1a2e;
      margin-bottom: 12px;
      padding-bottom: 6px;
      border-bottom: 1px solid #e5e7eb;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
      margin-top: 8px;
    }
    
    th {
      text-align: left;
      padding: 8px 10px;
      background: #f8f9fa;
      font-weight: 600;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #666;
      border-bottom: 2px solid #e5e7eb;
    }
    
    td {
      padding: 8px 10px;
      border-bottom: 1px solid #f0f0f0;
    }
    
    .mono { font-family: 'JetBrains Mono', monospace; }
    .green { color: #059669; }
    .red { color: #dc2626; }
    .amber { color: #d97706; }
    .bold { font-weight: 600; }
    .right { text-align: right; }
    .center { text-align: center; }
    
    .stat-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin-top: 8px;
    }
    
    .stat-card {
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 12px;
      text-align: center;
    }
    
    .stat-card .label {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #999;
      margin-bottom: 4px;
    }
    
    .stat-card .value {
      font-family: 'JetBrains Mono', monospace;
      font-size: 20px;
      font-weight: 700;
    }
    
    .footer {
      margin-top: 40px;
      padding-top: 16px;
      border-top: 1px solid #e5e7eb;
      font-size: 11px;
      color: #999;
      display: flex;
      justify-content: space-between;
    }
    
    .print-btn {
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 10px 20px;
      background: #3b82f6;
      color: white;
      border: none;
      border-radius: 8px;
      font-family: 'Space Grotesk', sans-serif;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      z-index: 1000;
      box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
    }
    
    .print-btn:hover { background: #2563eb; }
    
    @media print {
      body { padding: 20px; }
      .print-btn { display: none; }
      .section { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <button class="print-btn" onclick="window.print()">⬇ Save as PDF</button>
  
  <div class="header">
    <div class="brand">
      <div class="brand-icon">M</div>
      <span class="brand-name">MarketMind</span>
    </div>
    <h1>${config.title}</h1>
    ${config.subtitle ? `<p class="subtitle">${config.subtitle}</p>` : ""}
    <p class="date">Generated: ${config.date}</p>
  </div>
  
  ${config.sections.map(s => `
    <div class="section">
      <h2>${s.title}</h2>
      ${s.content}
    </div>
  `).join("")}
  
  <div class="footer">
    <span>MarketMind — Autonomous Market Intelligence</span>
    <span>${config.date}</span>
  </div>
</body>
</html>`;

  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "_blank");
  if (win) {
    win.onload = () => URL.revokeObjectURL(url);
  }
}

// Helper to build backtest report
export function buildBacktestReport(data: any) {
  const summary = data.summary;
  const isPositive = summary.totalPnl >= 0;

  return {
    title: "Backtesting Report",
    subtitle: `${summary.startDate} — ${summary.endDate} | ${summary.totalPredictions} predictions analyzed`,
    date: new Date().toLocaleString(),
    sections: [
      {
        title: "Performance Summary",
        content: `
          <div class="stat-grid">
            <div class="stat-card">
              <div class="label">Total P&L</div>
              <div class="value ${isPositive ? "green" : "red"}">${isPositive ? "+" : ""}${summary.totalPnl.toFixed(1)}%</div>
            </div>
            <div class="stat-card">
              <div class="label">Win Rate</div>
              <div class="value ${summary.winRate > 55 ? "green" : summary.winRate > 50 ? "amber" : "red"}">${summary.winRate}%</div>
            </div>
            <div class="stat-card">
              <div class="label">Total Trades</div>
              <div class="value">${summary.totalPredictions}</div>
            </div>
            <div class="stat-card">
              <div class="label">Hits</div>
              <div class="value green">${summary.hits}</div>
            </div>
            <div class="stat-card">
              <div class="label">Misses</div>
              <div class="value red">${summary.misses}</div>
            </div>
            <div class="stat-card">
              <div class="label">Avg P&L/Trade</div>
              <div class="value ${summary.avgPnlPerTrade >= 0 ? "green" : "red"}">${summary.avgPnlPerTrade >= 0 ? "+" : ""}${summary.avgPnlPerTrade.toFixed(2)}%</div>
            </div>
          </div>
        `,
      },
      {
        title: "Win Rate by Horizon",
        content: `
          <div class="stat-grid">
            ${(["1D", "7D", "30D"] as const).map(h => `
              <div class="stat-card">
                <div class="label">${h} Horizon</div>
                <div class="value ${data.winRateByHorizon[h] > 55 ? "green" : data.winRateByHorizon[h] > 50 ? "amber" : "red"}">${data.winRateByHorizon[h]}%</div>
              </div>
            `).join("")}
          </div>
        `,
      },
      {
        title: "Best Predictions",
        content: `
          <table>
            <thead><tr><th>#</th><th>Ticker</th><th>Direction</th><th>Horizon</th><th>Date</th><th class="right">P&L</th></tr></thead>
            <tbody>
              ${data.bestPredictions.map((p: any, i: number) => `
                <tr>
                  <td>${i + 1}</td>
                  <td class="mono bold">${p.ticker}</td>
                  <td class="${p.direction === "up" ? "green" : "red"}">${p.direction === "up" ? "↑ Long" : "↓ Short"}</td>
                  <td class="mono">${p.horizon}</td>
                  <td>${p.date}</td>
                  <td class="right mono bold green">+${p.pnlPercent.toFixed(2)}%</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        `,
      },
      {
        title: "Worst Predictions",
        content: `
          <table>
            <thead><tr><th>#</th><th>Ticker</th><th>Direction</th><th>Horizon</th><th>Date</th><th class="right">P&L</th></tr></thead>
            <tbody>
              ${data.worstPredictions.map((p: any, i: number) => `
                <tr>
                  <td>${i + 1}</td>
                  <td class="mono bold">${p.ticker}</td>
                  <td class="${p.direction === "up" ? "green" : "red"}">${p.direction === "up" ? "↑ Long" : "↓ Short"}</td>
                  <td class="mono">${p.horizon}</td>
                  <td>${p.date}</td>
                  <td class="right mono bold red">${p.pnlPercent.toFixed(2)}%</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        `,
      },
      {
        title: "Performance by Ticker",
        content: `
          <table>
            <thead><tr><th>Ticker</th><th class="right">Trades</th><th class="right">Win Rate</th><th class="right">Total P&L</th></tr></thead>
            <tbody>
              ${data.byTicker.map((t: any) => `
                <tr>
                  <td class="mono bold">${t.ticker}</td>
                  <td class="right mono">${t.totalPredictions}</td>
                  <td class="right mono ${t.winRate > 55 ? "green" : t.winRate > 50 ? "amber" : "red"}">${t.winRate}%</td>
                  <td class="right mono bold ${t.totalPnl >= 0 ? "green" : "red"}">${t.totalPnl >= 0 ? "+" : ""}${t.totalPnl.toFixed(1)}%</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        `,
      },
    ],
  };
}

// Helper to build portfolio report
export function buildPortfolioReport(data: any) {
  return {
    title: "Portfolio Analysis Report",
    subtitle: `${data.holdings.length} holdings | Total value: $${data.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    date: new Date().toLocaleString(),
    sections: [
      {
        title: "Portfolio Overview",
        content: `
          <div class="stat-grid">
            <div class="stat-card">
              <div class="label">Total Value</div>
              <div class="value">$${(data.totalValue / 1000).toFixed(1)}K</div>
            </div>
            <div class="stat-card">
              <div class="label">Day Change</div>
              <div class="value ${data.totalChange >= 0 ? "green" : "red"}">${data.totalChange >= 0 ? "+" : ""}${data.totalChangePercent}%</div>
            </div>
            <div class="stat-card">
              <div class="label">Holdings</div>
              <div class="value">${data.holdings.length}</div>
            </div>
          </div>
        `,
      },
      {
        title: "Holdings Detail",
        content: `
          <table>
            <thead><tr><th>Ticker</th><th class="right">Shares</th><th class="right">Price</th><th class="right">Value</th><th class="right">Day Change</th><th class="right">Weight</th></tr></thead>
            <tbody>
              ${data.holdings.map((h: any) => `
                <tr>
                  <td class="mono bold">${h.ticker}</td>
                  <td class="right mono">${h.shares}</td>
                  <td class="right mono">$${h.price.toFixed(2)}</td>
                  <td class="right mono bold">$${h.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td class="right mono ${h.changePercent >= 0 ? "green" : "red"}">${h.changePercent >= 0 ? "+" : ""}${h.changePercent.toFixed(2)}%</td>
                  <td class="right mono">${((h.value / data.totalValue) * 100).toFixed(1)}%</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        `,
      },
      {
        title: "Prediction Exposure",
        content: `
          <div class="stat-grid">
            <div class="stat-card">
              <div class="label">Bullish Exposure</div>
              <div class="value green">${data.predictionExposure.bullish.toFixed(1)}%</div>
            </div>
            <div class="stat-card">
              <div class="label">Bearish Exposure</div>
              <div class="value red">${data.predictionExposure.bearish.toFixed(1)}%</div>
            </div>
            <div class="stat-card">
              <div class="label">Neutral</div>
              <div class="value">${data.predictionExposure.neutral.toFixed(1)}%</div>
            </div>
          </div>
        `,
      },
      {
        title: "Narrative Sentiment",
        content: `
          <div class="stat-grid">
            <div class="stat-card">
              <div class="label">Sentiment Score</div>
              <div class="value ${data.narrativeSentiment.score > 0 ? "green" : data.narrativeSentiment.score < 0 ? "red" : ""}">${data.narrativeSentiment.score > 0 ? "+" : ""}${data.narrativeSentiment.score.toFixed(1)}</div>
            </div>
            <div class="stat-card">
              <div class="label">Outlook</div>
              <div class="value ${data.narrativeSentiment.label === "Bullish" ? "green" : data.narrativeSentiment.label === "Bearish" ? "red" : "amber"}">${data.narrativeSentiment.label}</div>
            </div>
            <div class="stat-card">
              <div class="label">Holdings</div>
              <div class="value">${data.holdings.length}</div>
            </div>
          </div>
        `,
      },
      {
        title: "Risk Flags",
        content: data.riskFlags.length > 0 ? `
          <table>
            <thead><tr><th>Risk</th><th>Severity</th><th>Description</th></tr></thead>
            <tbody>
              ${data.riskFlags.map((f: any) => `
                <tr>
                  <td class="bold">${f.type}</td>
                  <td class="${f.severity === "high" ? "red bold" : f.severity === "medium" ? "amber" : ""}">${f.severity.toUpperCase()}</td>
                  <td>${f.message}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        ` : `<p style="color: #059669; font-weight: 600;">✓ No significant risk flags detected</p>`,
      },
    ],
  };
}
