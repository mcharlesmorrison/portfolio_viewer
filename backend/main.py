import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import yfinance as yf
import pandas as pd

from portfolio import load_portfolio, get_allocation, invalidate_cache

app = FastAPI(title="Portfolio Viewer API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/portfolio")
def portfolio(refresh: bool = Query(False)):
    if refresh:
        invalidate_cache()
    return load_portfolio(force_refresh=refresh)


@app.get("/api/allocation")
def allocation(refresh: bool = Query(False)):
    if refresh:
        invalidate_cache()
    return get_allocation(force_refresh=refresh)


@app.get("/api/performance")
def performance(period: str = Query("1y")):
    """
    Return weekly portfolio value (current holdings × historical prices)
    alongside SPY and DIA normalized to the same starting value.
    """
    from portfolio import load_portfolio, CRYPTO_MAP

    yf_period = {"1m": "1mo", "6m": "6mo", "1y": "1y", "2y": "2y", "5y": "5y", "10y": "10y"}.get(period, "1y")

    port = load_portfolio()
    holdings = port["holdings"]

    # Build ticker → qty map (skip CASH)
    ticker_qty: dict[str, float] = {}
    for h in holdings:
        if h["ticker"] == "CASH" or h["quantity"] is None:
            continue
        yf_ticker = CRYPTO_MAP.get(h["ticker"], h["ticker"])
        ticker_qty[yf_ticker] = ticker_qty.get(yf_ticker, 0.0) + h["quantity"]

    all_tickers = list(ticker_qty.keys()) + ["SPY", "DIA"]
    joined = " ".join(all_tickers)

    # Build account → {yf_ticker: qty} map (skip CASH)
    acct_ticker_qty: dict[str, dict[str, float]] = {}
    for h in holdings:
        if h["ticker"] == "CASH" or h["quantity"] is None:
            continue
        acct = h["account"]
        yf_tick = CRYPTO_MAP.get(h["ticker"], h["ticker"])
        acct_ticker_qty.setdefault(acct, {})
        acct_ticker_qty[acct][yf_tick] = acct_ticker_qty[acct].get(yf_tick, 0.0) + h["quantity"]

    try:
        data = yf.download(joined, period=yf_period, interval="1wk", auto_adjust=True, progress=False)
        if data.empty:
            return {"data": [], "disclaimer": "No historical data available.", "stats": {}, "account_breakdown": []}

        if isinstance(data.columns, pd.MultiIndex):
            closes = data["Close"]
        else:
            closes = data[["Close"]].rename(columns={"Close": all_tickers[0]})

        closes = closes.dropna(how="all")

        # Portfolio value per date
        port_series = pd.Series(0.0, index=closes.index)
        for yf_tick, qty in ticker_qty.items():
            if yf_tick in closes.columns:
                col = closes[yf_tick].ffill()
                port_series += col * qty

        spy = closes["SPY"].ffill() if "SPY" in closes.columns else pd.Series(dtype=float)
        dia = closes["DIA"].ffill() if "DIA" in closes.columns else pd.Series(dtype=float)

        # Find the first date where the portfolio has a real value (>1% of current total)
        # so SPY/DIA are anchored to the same starting point — not date[0] which may be $0
        # when newer assets (SOL, ETH) didn't exist yet.
        threshold = port_series.max() * 0.01
        valid_dates = port_series[port_series >= threshold].index
        if len(valid_dates) == 0:
            ref_date = port_series.index[0]
        else:
            ref_date = valid_dates[0]

        port_ref = float(port_series[ref_date])
        spy_ref = float(spy[ref_date]) if ref_date in spy.index and pd.notna(spy[ref_date]) else None
        dia_ref = float(dia[ref_date]) if ref_date in dia.index and pd.notna(dia[ref_date]) else None

        records = []
        for date in closes.index:
            pv = port_series.get(date)
            sv = spy.get(date) if spy_ref else None
            dv = dia.get(date) if dia_ref else None
            records.append({
                "date": date.strftime("%Y-%m-%d"),
                "portfolioValue": round(float(pv), 2) if pd.notna(pv) and pv > 0 else None,
                # Scale SPY/DIA so they start at the same dollar value as the portfolio at ref_date
                "spyValue": round(float(sv) / spy_ref * port_ref, 2) if sv is not None and pd.notna(sv) else None,
                "diaValue": round(float(dv) / dia_ref * port_ref, 2) if dv is not None and pd.notna(dv) else None,
            })

        # ── Summary stats ────────────────────────────────────────────────────────
        stats: dict = {}
        valid_port = port_series[port_series > 0].dropna()
        if len(valid_port) >= 2:
            start_val = float(valid_port.iloc[0])
            end_val = float(valid_port.iloc[-1])
            total_return_dollar = round(end_val - start_val, 2)
            total_return_pct = round((end_val - start_val) / start_val * 100, 3)
            n_years = (valid_port.index[-1] - valid_port.index[0]).days / 365.25
            annualized_return = (
                round(((end_val / start_val) ** (1 / n_years) - 1) * 100, 3) if n_years >= 1.0 else None
            )
            rolling_max = valid_port.cummax()
            drawdowns = (valid_port - rolling_max) / rolling_max
            max_drawdown = round(float(drawdowns.min()) * 100, 3)

            spy_return_pct: float | None = None
            if spy_ref and len(spy) > 0 and pd.notna(spy.iloc[-1]):
                spy_return_pct = (float(spy.iloc[-1]) - spy_ref) / spy_ref * 100

            dia_return_pct: float | None = None
            if dia_ref and len(dia) > 0 and pd.notna(dia.iloc[-1]):
                dia_return_pct = (float(dia.iloc[-1]) - dia_ref) / dia_ref * 100

            stats = {
                "total_return_dollar": total_return_dollar,
                "total_return_pct": total_return_pct,
                "annualized_return": annualized_return,
                "max_drawdown": max_drawdown,
                "alpha_vs_spy": round(total_return_pct - spy_return_pct, 3) if spy_return_pct is not None else None,
                "alpha_vs_dia": round(total_return_pct - dia_return_pct, 3) if dia_return_pct is not None else None,
            }

        # ── Per-account breakdown ─────────────────────────────────────────────────
        acct_breakdown = []
        for acct, tq in acct_ticker_qty.items():
            s = pd.Series(0.0, index=closes.index)
            for yf_tick, qty in tq.items():
                if yf_tick in closes.columns:
                    s += closes[yf_tick].ffill() * qty
            valid = s[s > 0].dropna()
            if len(valid) < 2:
                acct_breakdown.append({"account": acct, "return_pct": None, "return_dollar": None})
            else:
                sv, ev = float(valid.iloc[0]), float(valid.iloc[-1])
                acct_breakdown.append({
                    "account": acct,
                    "return_pct": round((ev - sv) / sv * 100, 3),
                    "return_dollar": round(ev - sv, 2),
                })
        acct_breakdown.sort(key=lambda x: (x["return_pct"] is None, -(x["return_pct"] or 0)))

        return {
            "data": records,
            "disclaimer": "Simulated using current holdings held since the start date — not actual historical positions.",
            "stats": stats,
            "account_breakdown": acct_breakdown,
        }
    except Exception as e:
        return {"data": [], "disclaimer": f"Error fetching performance data: {e}", "stats": {}, "account_breakdown": []}


@app.get("/api/accounts")
def accounts():
    from trades import get_accounts
    return {"accounts": get_accounts()}


class TradeRequest(BaseModel):
    ticker: str
    quantity: float
    account: str


@app.post("/api/trades/preview")
def trade_preview(req: TradeRequest):
    from trades import preview_trade
    return preview_trade(req.ticker, req.quantity, req.account)


@app.post("/api/trades/record")
def trade_record(req: TradeRequest):
    from trades import record_trade
    invalidate_cache()
    return record_trade(req.ticker, req.quantity, req.account)


class ChatMessage(BaseModel):
    role: str   # "user" or "assistant"
    content: str

class ChatRequest(BaseModel):
    messages: list[ChatMessage]


@app.post("/api/chat")
def chat(req: ChatRequest):
    import json
    from ai_analysis import stream_chat
    allocation = get_allocation()

    def event_stream():
        try:
            for chunk in stream_chat([m.model_dump() for m in req.messages], allocation):
                yield f"data: {json.dumps(chunk)}\n\n"
        except Exception as e:
            yield f"data: {json.dumps('[ERROR] ' + str(e))}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
