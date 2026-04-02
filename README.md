# Portfolio Viewer

A personal investment portfolio dashboard. Pulls live prices for all your holdings, visualizes your current vs. target allocation, simulates historical performance, and includes an AI chat advisor powered by Google Gemini.

Built with FastAPI (Python) + React + Vite + TypeScript.

---

## Features

- **Portfolio tab** — live prices for all holdings grouped by account, with per-account subtotals and total portfolio value
- **Allocation tab** — interactive pie charts comparing current vs. target allocation; click any slice to see the holdings that make it up; expand to fullscreen modal
- **Performance tab** — simulated historical portfolio value vs. S&P 500 (SPY) and Dow Jones (DIA) across 1M / 6M / 1Y / 2Y / 5Y / 10Y periods
- **AI Analysis tab** — chat interface powered by Google Gemini with your full portfolio data and investment strategy injected as context
- **Record Trade tab** — log buys and sells; previews impact before writing to your CSV; automatically refreshes prices

---

## Prerequisites

- Python 3.11+
- Node.js 18+
- A [Google AI Studio](https://aistudio.google.com) API key (free tier)

---

## Setup

### 1. Clone the repo

```bash
git clone https://github.com/your-username/portfolio-viewer.git
cd portfolio-viewer
```

### 2. Add your portfolio CSV

Copy the example and fill it in with your real holdings:

```bash
cp portfolio.example.csv "portfolio - Sheet1.csv"
```

The CSV format:

| Column | Description |
|--------|-------------|
| `Asset` | Ticker symbol (e.g. `VEA`, `BTC`, `SWPPX`) or `CASH` |
| `Quantity` | Number of shares/units (leave blank for cash rows) |
| `Value` | Dollar value — only needed for `CASH` rows |
| `Class` | Optional. Set to `Crypto` for crypto assets |
| `Account` | Account name (e.g. `Etrade Brokerage`, `Roth IRA`, `Kraken`) |

### 3. Configure your API key

```bash
cp .env.example .env
```

Edit `.env` and add your Gemini API key:

```
GEMINI_API_KEY=AIza...
```

Get a key at [aistudio.google.com](https://aistudio.google.com) → **Get API key** → **Create API key in new project**.

### 4. Add your investment strategy context (optional)

This file is fed to the AI advisor so it understands your goals. It stays local and is never committed.

```bash
cp backend/investment_context.example.txt backend/investment_context.txt
```

Edit `backend/investment_context.txt` with your target allocation, financial goals, and any other context you want the AI to know about.

### 5. Install dependencies

```bash
# Backend
cd backend
pip3 install -r requirements.txt
cd ..

# Frontend
cd frontend
npm install
cd ..
```

---

## Running

From the project root:

```bash
./start.sh
```

This starts both the backend (port 8000) and frontend (port 5173) and opens the app at **http://localhost:5173**. Press `Ctrl+C` once to stop both.

Alternatively, run them separately:

```bash
# Terminal 1 — backend
cd backend
uvicorn main:app --reload --port 8000

# Terminal 2 — frontend
cd frontend
npm run dev
```

> The first load takes 10–15 seconds while prices are fetched from Yahoo Finance. Prices are cached for 15 minutes; click **Refresh Prices** in the Portfolio tab to force a refresh.

---

## Asset classification

Tickers are automatically classified into allocation categories (US Large Cap, Crypto, Gold, etc.) via a lookup table in `backend/portfolio.py`. If you add new tickers, add them to the `CLASSIFICATION` dict there. Target allocation percentages live in the `TARGETS` dict in the same file.

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Backend API | Python · FastAPI · uvicorn |
| Price data | yfinance (Yahoo Finance) |
| AI chat | Google Gemini (`google-genai` SDK) |
| Frontend | React 18 · Vite · TypeScript |
| Charts | Recharts |
| Styling | Tailwind CSS |

---

## Project structure

```
portfolio-viewer/
├── backend/
│   ├── main.py                        # FastAPI routes
│   ├── portfolio.py                   # CSV parsing, price fetching, classification
│   ├── trades.py                      # Trade recording logic
│   ├── ai_analysis.py                 # Gemini chat integration
│   ├── investment_context.example.txt # Template for your strategy context
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── App.tsx
│       ├── components/
│       │   ├── PortfolioTable.tsx
│       │   ├── AllocationView.tsx
│       │   ├── PerformanceView.tsx
│       │   ├── AnalysisView.tsx
│       │   └── TradeView.tsx
│       ├── api.ts
│       └── types.ts
├── portfolio.example.csv              # Example CSV format
├── .env.example                       # Environment variable template
├── start.sh                           # One-command launcher
└── README.md
```

---

## Privacy note

The following files are gitignored and never committed:

- `*.csv` — your real portfolio holdings
- `*.pdf` — any documents
- `.env` — your API key
- `backend/investment_context.txt` — your personal strategy notes

Only share your fork if you're comfortable with the target allocations and ticker classifications visible in `backend/portfolio.py`.
