# MarketMind

**Autonomous AI Market Intelligence & Prediction Platform**

MarketMind is a self-improving, Bloomberg-inspired dashboard for U.S. equity markets. It ingests real-time signals from 12 independent data sources, synthesizes them through a GPT-4o research agent, generates directional predictions across four time horizons (1D / 7D / 30D / 60D), and continuously improves its own signal weights through a Karpathy-inspired evaluation harness — all without human intervention.

---

## Key Features

- **12 Real Data Sources** — Yahoo Finance, Reddit (r/wallstreetbets, r/stocks, r/investing), Reuters/Bloomberg/CNBC RSS feeds, SEC EDGAR Form 4 insider filings, Polymarket prediction markets, StockTwits social sentiment, Google Trends, CBOE VIX, Wikipedia current events, Congressional Trading (STOCK Act), Nitter VIP tweet monitoring (17 tracked accounts), and YouTube podcast RSS transcripts (All-In, Odd Lots, etc.)
- **Autonomous Research Agent** — A GPT-4o-powered agent runs every 30 minutes, ingests the latest signals, synthesizes market narratives, and generates high-confidence predictions with reasoning and price targets.
- **Prediction Tracking** — Every prediction is stored with its full time horizon. Predictions are only resolved (HIT / MISS) after the **full** time window expires — no early resolution. Countdown timers show time remaining on each active prediction.
- **Alpha Score Engine** — A composite 0–100 score per ticker combining AI confidence, social sentiment, narrative velocity, anomaly flags, and market divergence signals.
- **Karpathy-Inspired Self-Improvement Loop** — A locked evaluation harness (structurally separated from the improvement agent) scores resolved predictions using direction accuracy, confidence-weighted accuracy, and Sharpe ratio. The improvement agent reads these results and adjusts signal weights — it can never modify its own evaluation criteria.
- **VIP Signal Monitoring** — 17 high-signal accounts (Cathie Wood, Michael Burry, Bill Ackman, Chris Camillo, etc.) are monitored via Nitter with 3–5× signal weighting.
- **Dark Bloomberg-Style UI** — Dense, data-rich dashboard built with React 19, Tailwind CSS 4, and shadcn/ui. Includes Alpha Leaderboard, Trade Journal, Strategy Marketplace, Correlation Matrix, Earnings Calendar, and more.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Tailwind CSS 4, shadcn/ui, Vite |
| Backend | Node.js, Express 4, tRPC 11 |
| Database | MySQL (TiDB Cloud) via Drizzle ORM |
| AI / LLM | OpenAI GPT-4o (research agent, deep analysis), GPT-4o-mini (fast tasks) |
| Auth | Manus OAuth (optional — app is fully public-facing) |
| Real-time | WebSocket push for live Alpha Score updates |
| Testing | Vitest — 220+ tests across 21 test files |

---

## Data Sources

| # | Source | Type | Signals |
|---|---|---|---|
| 1 | Yahoo Finance | Price & fundamentals | Real-time quotes, P/E, volume, 52-week range |
| 2 | Reddit | Social sentiment | r/wallstreetbets, r/stocks, r/investing post analysis |
| 3 | RSS Feeds | News | Reuters, Bloomberg, CNBC, Financial Times |
| 4 | SEC EDGAR | Insider activity | Form 4 filings — insider buys/sells |
| 5 | Polymarket | Prediction markets | Contract probabilities for macro/equity events |
| 6 | StockTwits | Social sentiment | Cashtag sentiment and volume |
| 7 | Google Trends | Search interest | Ticker and topic search velocity |
| 8 | CBOE VIX | Volatility | VIX spot, term structure, contango/backwardation |
| 9 | Wikipedia | Current events | Breaking news via recent changes API |
| 10 | Congressional Trading | Insider activity | STOCK Act disclosures — senator/rep trades |
| 11 | Nitter (VIP) | Elite social | 17 tracked high-signal accounts |
| 12 | YouTube RSS | Podcast transcripts | All-In, Odd Lots, We Study Billionaires, etc. |

---

## Project Structure

```
marketmind/
├── client/                  # React frontend (Vite)
│   └── src/
│       ├── pages/           # Dashboard, Predictions, Tickers, Research, etc.
│       ├── components/      # Reusable UI components
│       └── _core/hooks/     # useAuth and other core hooks
├── server/                  # Express + tRPC backend
│   ├── _core/               # Auth, LLM, DB context, OAuth
│   ├── evaluationHarness.ts # LOCKED — Karpathy-style evaluation module
│   ├── improvementAgent.ts  # Self-improvement loop (reads harness, never modifies it)
│   ├── researchAgent.ts     # GPT-4o research agent (runs every 30 min)
│   ├── realIngestion.ts     # Orchestrates all 12 data source ingestion jobs
│   └── market.ts            # Main tRPC router
├── drizzle/                 # Database schema and migrations
│   └── schema.ts            # 30+ tables: predictions, signals, alpha scores, etc.
├── shared/                  # Shared types and constants
├── .env.example             # Required environment variables (see below)
└── README.md
```

---

## Setup Instructions

### Prerequisites

- Node.js 22+
- pnpm (`npm install -g pnpm`)
- A MySQL-compatible database (TiDB Cloud free tier works perfectly)
- An OpenAI API key (GPT-4o access required)

### 1. Clone the repository

```bash
git clone https://github.com/brandon-builds/marketmind.git
cd marketmind
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Configure environment variables

Copy the example file and fill in your values:

```bash
cp .env.example .env
```

Open `.env` and set each variable — see the [Environment Variables](#environment-variables) section below for details. **Never commit your `.env` file.** It is already listed in `.gitignore`.

### 4. Push the database schema

```bash
pnpm db:push
```

This runs `drizzle-kit generate && drizzle-kit migrate` to create all 30+ tables in your database.

### 5. Start the development server

```bash
pnpm dev
```

The app will be available at `http://localhost:3000`.

---

## Environment Variables

All secrets are managed through environment variables. Copy `.env.example` to `.env` and fill in your values. **No API keys or secrets are ever committed to this repository.**

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | MySQL connection string (e.g., TiDB Cloud) |
| `OPENAI_API_KEY` | ✅ | OpenAI API key — GPT-4o used for research agent |
| `JWT_SECRET` | ✅ | Secret for signing session cookies (any long random string) |
| `VITE_APP_ID` | Optional | Manus OAuth app ID (only needed if using Manus auth) |
| `OAUTH_SERVER_URL` | Optional | Manus OAuth backend URL |
| `VITE_OAUTH_PORTAL_URL` | Optional | Manus login portal URL |
| `OWNER_OPEN_ID` | Optional | Manus owner Open ID |
| `FRED_API_KEY` | Optional | FRED (Federal Reserve) API key for macro data — free at [fred.stlouisfed.org](https://fred.stlouisfed.org/docs/api/api_key.html) |
| `BUILT_IN_FORGE_API_URL` | Optional | Manus Forge API base URL (fallback LLM proxy) |
| `BUILT_IN_FORGE_API_KEY` | Optional | Manus Forge API key (fallback LLM proxy) |
| `VITE_FRONTEND_FORGE_API_URL` | Optional | Forge API URL for frontend |
| `VITE_FRONTEND_FORGE_API_KEY` | Optional | Forge API key for frontend |

---

## Architecture: The Self-Improvement Loop

MarketMind's prediction engine is inspired by Andrej Karpathy's autoresearch framework:

```
Real Data Sources (12x)
        │
        ▼
 Ingestion Pipeline (every 30 min)
        │
        ▼
 Research Agent (GPT-4o)
   → Synthesizes signals into narratives
   → Generates predictions with confidence scores
        │
        ▼
 Prediction Store (MySQL)
   → Tracks every prediction with full horizon window
   → Only resolves after FULL time window expires
        │
        ▼
 Evaluation Harness (LOCKED MODULE)
   → Direction accuracy, confidence-weighted accuracy, Sharpe ratio
   → Cannot be modified by the improvement agent
        │
        ▼
 Improvement Agent
   → Reads evaluation results
   → Adjusts signal weights for next cycle
   → Records model version with changelog
```

The key design principle: the evaluation harness is structurally separated from the improvement agent. The agent can adjust how it generates predictions, but it can never change how those predictions are scored — preventing Goodhart's Law violations.

---

## Running Tests

```bash
pnpm test
```

220+ tests across 21 test files covering the evaluation harness, alpha engine, data ingestion, prediction resolution timing, and all major API endpoints.

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes (`git commit -m 'Add my feature'`)
4. Push to your branch (`git push origin feature/my-feature`)
5. Open a Pull Request against `main`

The `main` branch is protected — direct pushes are not permitted. All changes must go through a pull request review.

---

## License

MIT License — see [LICENSE](LICENSE) for details.
