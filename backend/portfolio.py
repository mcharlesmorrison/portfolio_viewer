import time
import re
from pathlib import Path
from typing import Optional
import pandas as pd
import yfinance as yf

CSV_PATH = Path(__file__).parent.parent / "portfolio - Sheet1.csv"

CRYPTO_MAP = {"SOL": "SOL-USD", "BTC": "BTC-USD", "ETH": "ETH-USD"}

CLASSIFICATION: dict[str, str] = {
    # US Large / Total Market
    "SWPPX": "US Large/Total Market",
    "VTI": "US Large/Total Market",
    "VINIX": "US Large/Total Market",
    "AMZN": "US Large/Total Market",
    "GOOG": "US Large/Total Market",
    "AAPL": "US Large/Total Market",
    "META": "US Large/Total Market",
    "TSLA": "US Large/Total Market",
    "NLY": "US Large/Total Market",
    "UNH": "US Large/Total Market",
    # US Small Cap
    "VB": "US Small Cap",
    "VTWO": "US Small Cap",
    # Intl Developed
    "VEA": "Intl Developed",
    "VXUS": "Intl Developed",
    "VTIAX": "Intl Developed",
    # Emerging Markets
    "VWO": "Emerging Markets",
    "BABA": "Emerging Markets",
    # Target-Date / Blends
    "VFFVX": "Target-Date/Blends",
    # Commodities — Gold
    "PHYS": "Commodities—Gold",
    # Commodities — Silver
    "PSLV": "Commodities—Silver",
    "PAAS": "Commodities—Silver",
    "SII": "Commodities—Silver",
    # Crypto
    "SOL": "Crypto",
    "BTC": "Crypto",
    "ETH": "Crypto",
    # Cash / Fixed Income
    "VUSXX": "Cash/Fixed Income",
    "BOXX": "Cash/Fixed Income",
    "CASH": "Cash/Fixed Income",
    # Energy
    "PXJ": "Energy",
}

ASSET_NAMES: dict[str, str] = {
    "SWPPX": "Schwab S&P 500 Index",
    "VTI": "Vanguard Total Stock Market ETF",
    "VINIX": "Vanguard Institutional Index",
    "AMZN": "Amazon",
    "GOOG": "Alphabet (Google)",
    "AAPL": "Apple",
    "META": "Meta Platforms",
    "TSLA": "Tesla",
    "NLY": "Annaly Capital Management",
    "UNH": "UnitedHealth Group",
    "VB": "Vanguard Small-Cap ETF",
    "VTWO": "Vanguard Russell 2000 ETF",
    "VEA": "Vanguard FTSE Developed Markets ETF",
    "VXUS": "Vanguard Total Intl Stock ETF",
    "VTIAX": "Vanguard Total Intl Stock Index",
    "VWO": "Vanguard Emerging Markets ETF",
    "BABA": "Alibaba Group",
    "VFFVX": "Vanguard Target Retirement 2055",
    "PHYS": "Sprott Physical Gold Trust",
    "PSLV": "Sprott Physical Silver Trust",
    "PAAS": "Pan American Silver Corp",
    "SII": "Sprott Inc.",
    "SOL": "Solana",
    "BTC": "Bitcoin",
    "ETH": "Ethereum",
    "VUSXX": "Vanguard Treasury Money Market",
    "BOXX": "Alpha Architect 1-3 Month Box ETF",
    "CASH": "Cash",
    "PXJ": "Invesco Dynamic Oil & Gas Services ETF",
}

TARGETS: dict[str, float] = {
    "US Large/Total Market": 30.0,
    "US Small Cap": 8.0,
    "Intl Developed": 15.0,
    "Emerging Markets": 7.0,
    "Target-Date/Blends": 5.0,
    "Commodities—Gold": 5.0,
    "Commodities—Silver": 3.0,
    "Crypto": 6.0,
    "Cash/Fixed Income": 11.0,
    "Energy": 0.0,
}

# ── price cache ────────────────────────────────────────────────────────────────
_price_cache: dict[str, float] = {}
_prev_close_cache: dict[str, float] = {}
_cache_ts: float = 0.0
CACHE_TTL = 15 * 60  # 15 minutes


def _parse_value(v) -> Optional[float]:
    """Parse a potentially comma-formatted number string to float."""
    if pd.isna(v):
        return None
    s = str(v).replace(",", "").strip()
    try:
        return float(s)
    except ValueError:
        return None


def _fetch_prices(tickers: list[str]) -> dict[str, tuple[float, Optional[float]]]:
    """Fetch latest and previous close prices for a list of Yahoo Finance tickers.

    Returns a dict of ticker → (current_price, prev_close_or_None).
    """
    if not tickers:
        return {}
    joined = " ".join(tickers)
    try:
        data = yf.download(joined, period="5d", auto_adjust=True, progress=False)
        if data.empty:
            return {}
        # De-duplicate index (e.g. partial intraday rows) keeping the last entry
        data = data[~data.index.duplicated(keep="last")]
        # multi-ticker download returns MultiIndex columns: (field, ticker)
        if isinstance(data.columns, pd.MultiIndex):
            closes = data["Close"].ffill()
            latest = closes.iloc[-1]
            prev = closes.iloc[-2] if len(closes) >= 2 else None
            result: dict[str, tuple[float, Optional[float]]] = {}
            for t in latest.index:
                if pd.isna(latest[t]):
                    continue
                prev_val: Optional[float] = None
                if prev is not None and not pd.isna(prev[t]):
                    prev_val = float(prev[t])
                result[str(t)] = (float(latest[t]), prev_val)
            return result
        else:
            # single ticker
            closes = data["Close"].ffill()
            current = float(closes.iloc[-1])
            prev_val = float(closes.iloc[-2]) if len(closes) >= 2 else None
            return {tickers[0]: (current, prev_val)}
    except Exception:
        return {}


def get_prices(tickers: list[str], force_refresh: bool = False) -> dict[str, float]:
    global _price_cache, _prev_close_cache, _cache_ts
    now = time.time()
    if not force_refresh and _price_cache and (now - _cache_ts) < CACHE_TTL:
        return _price_cache

    # Map tickers that need Yahoo Finance aliases
    yf_map: dict[str, str] = {}  # original → yf ticker
    for t in tickers:
        yf_map[t] = CRYPTO_MAP.get(t, t)

    yf_tickers = list(set(yf_map.values()))
    raw = _fetch_prices(yf_tickers)

    prices: dict[str, float] = {}
    prev_closes: dict[str, float] = {}
    for original, yf_ticker in yf_map.items():
        if yf_ticker in raw:
            current, prev = raw[yf_ticker]
            prices[original] = current
            if prev is not None:
                prev_closes[original] = prev

    _price_cache = prices
    _prev_close_cache = prev_closes
    _cache_ts = now
    return prices


def invalidate_cache():
    global _price_cache, _prev_close_cache, _cache_ts
    _price_cache = {}
    _prev_close_cache = {}
    _cache_ts = 0.0


def _write_prices_to_csv(prices: dict[str, float]) -> None:
    """Write fetched prices and computed values back to the CSV."""
    df = pd.read_csv(CSV_PATH)
    df.columns = [c.strip() for c in df.columns]

    for idx, row in df.iterrows():
        asset = str(row["Asset"]).strip()
        if asset == "CASH":
            continue  # never overwrite user-maintained cash balances
        if asset in prices:
            price = prices[asset]
            qty = _parse_value(row["Quantity"])
            df.at[idx, "Price"] = price
            if qty is not None:
                df.at[idx, "Value"] = round(qty * price, 2)

    df.to_csv(CSV_PATH, index=False)


def load_portfolio(force_refresh: bool = False) -> dict:
    df = pd.read_csv(CSV_PATH)
    df.columns = [c.strip() for c in df.columns]

    # Normalise account labels
    df["Account"] = df["Account"].fillna("401k / Employer Plan")
    df["Account"] = df["Account"].apply(lambda x: x.strip() if isinstance(x, str) else x)
    df.loc[df["Asset"].isin(["VINIX", "VFFVX", "VTIAX"]) & (df["Account"] == ""), "Account"] = "401k / Employer Plan"

    # Parse quantity and pre-filled value
    df["Quantity"] = pd.to_numeric(df["Quantity"], errors="coerce")
    df["PreValue"] = df["Value"].apply(_parse_value)

    # Separate cash rows (no price needed) from priced rows
    cash_mask = df["Asset"] == "CASH"
    priced_tickers = df.loc[~cash_mask, "Asset"].dropna().unique().tolist()

    prices = get_prices(priced_tickers, force_refresh=force_refresh)
    _write_prices_to_csv(prices)

    holdings = []
    for _, row in df.iterrows():
        asset = str(row["Asset"]).strip()
        qty = row["Quantity"]
        raw_pre = row["PreValue"]
        pre_val = None if pd.isna(raw_pre) else raw_pre
        account = str(row["Account"]).strip()

        if asset == "CASH":
            price = 1.0
            value = pre_val if pre_val is not None else 0.0
            display_qty = value
            day_change_pct = None
            day_change_dollar = None
        else:
            price = prices.get(asset)
            if price is None:
                value = pre_val  # fallback to CSV value if price unavailable
            else:
                value = float(qty) * price if not pd.isna(qty) else None

            display_qty = float(qty) if not pd.isna(qty) else None

            prev_close = _prev_close_cache.get(asset)
            if price is not None and prev_close is not None and prev_close != 0:
                day_change_pct = round((price - prev_close) / prev_close * 100, 3)
                day_change_dollar = round((price - prev_close) * display_qty, 2) if display_qty is not None else None
            else:
                day_change_pct = None
                day_change_dollar = None

        fund_class_raw = row.get("Class", "")
        fund_class = "" if pd.isna(fund_class_raw) else str(fund_class_raw).strip()

        holdings.append({
            "ticker": asset,
            "name": ASSET_NAMES.get(asset, asset),
            "quantity": display_qty,
            "price": price,
            "value": value,
            "category": CLASSIFICATION.get(asset, "Other"),
            "account": account,
            "fund_class": fund_class,
            "day_change_pct": day_change_pct,
            "day_change_dollar": day_change_dollar,
        })

    # Total
    import math

    def _valid(v):
        return v is not None and not (isinstance(v, float) and math.isnan(v))

    total = sum(h["value"] for h in holdings if _valid(h["value"]))

    # Add pct_of_total; sanitize any remaining nan to None for JSON safety
    for h in holdings:
        if not _valid(h["value"]):
            h["value"] = None
        if not _valid(h["price"]):
            h["price"] = None
        h["pct_of_total"] = round(h["value"] / total * 100, 2) if (h["value"] and total) else 0.0

    total_day_gain_dollar = sum(
        h["day_change_dollar"] for h in holdings if h["day_change_dollar"] is not None
    )
    yesterday_total = total - total_day_gain_dollar
    total_day_gain_pct = (
        round(total_day_gain_dollar / yesterday_total * 100, 3) if yesterday_total > 0 else None
    )

    return {
        "holdings": holdings,
        "total_value": total,
        "total_day_gain_dollar": round(total_day_gain_dollar, 2),
        "total_day_gain_pct": total_day_gain_pct,
        "last_updated": time.time(),
    }


def get_allocation(force_refresh: bool = False) -> dict:
    portfolio = load_portfolio(force_refresh=force_refresh)
    holdings = portfolio["holdings"]

    # Separate HOUSE-earmarked holdings from investable holdings
    invest_holdings = [h for h in holdings if h.get("fund_class", "") != "HOUSE"]
    house_holdings = [h for h in holdings if h.get("fund_class", "") == "HOUSE"]

    invest_total = sum(h["value"] for h in invest_holdings if h["value"] is not None)

    category_values: dict[str, float] = {}
    for h in invest_holdings:
        cat = h["category"]
        val = h["value"] or 0.0
        category_values[cat] = category_values.get(cat, 0.0) + val

    # Build all categories (union of what we hold + targets)
    all_cats = sorted(set(list(TARGETS.keys()) + list(category_values.keys())))

    rows = []
    for cat in all_cats:
        current_val = category_values.get(cat, 0.0)
        current_pct = round(current_val / invest_total * 100, 2) if invest_total else 0.0
        target_pct = TARGETS.get(cat, 0.0)
        delta_pct = round(current_pct - target_pct, 2)
        delta_val = round((delta_pct / 100) * invest_total, 2)
        rows.append({
            "category": cat,
            "current_value": round(current_val, 2),
            "current_pct": current_pct,
            "target_pct": target_pct,
            "delta_pct": delta_pct,
            "delta_value": delta_val,
        })

    house_fund = [
        {"ticker": h["ticker"], "name": h["name"], "value": h["value"], "account": h["account"]}
        for h in house_holdings if h["value"] is not None
    ]
    house_fund_total = round(sum(item["value"] for item in house_fund), 2)

    return {
        "total_value": invest_total,
        "rows": rows,
        "targets": TARGETS,
        "house_fund": house_fund,
        "house_fund_total": house_fund_total,
    }
