import math
import pandas as pd
from portfolio import CSV_PATH, CLASSIFICATION


def _load_df() -> pd.DataFrame:
    df = pd.read_csv(CSV_PATH)
    df.columns = [c.strip() for c in df.columns]
    # Normalise blank accounts to match portfolio.py
    df["Account"] = df["Account"].fillna("401k / Employer Plan")
    df["Account"] = df["Account"].astype(str).str.strip()
    return df


def get_accounts() -> list[str]:
    df = _load_df()
    return sorted(df["Account"].dropna().unique().tolist())


def preview_trade(ticker: str, quantity: float, account: str) -> dict:
    ticker = ticker.upper().strip()
    account = account.strip()
    df = _load_df()

    mask = (df["Asset"].str.upper() == ticker) & (df["Account"] == account)
    existing = df[mask]

    if not existing.empty:
        row = existing.iloc[0]
        current_qty = float(row["Quantity"]) if pd.notna(row["Quantity"]) else 0.0
        new_qty = current_qty + quantity
        return {
            "exists": True,
            "ticker": ticker,
            "account": account,
            "category": CLASSIFICATION.get(ticker, "Other"),
            "current_quantity": current_qty,
            "delta_quantity": quantity,
            "new_quantity": new_qty,
            "would_go_negative": new_qty < 0,
            "would_clear": math.isclose(new_qty, 0, abs_tol=1e-9),
        }
    else:
        return {
            "exists": False,
            "ticker": ticker,
            "account": account,
            "category": CLASSIFICATION.get(ticker, "Other"),
            "current_quantity": None,
            "delta_quantity": quantity,
            "new_quantity": quantity,
            "would_go_negative": quantity < 0,
            "would_clear": False,
        }


def record_trade(ticker: str, quantity: float, account: str) -> dict:
    ticker = ticker.upper().strip()
    account = account.strip()
    df = _load_df()

    mask = (df["Asset"].str.upper() == ticker) & (df["Account"] == account)

    if mask.any():
        current_qty = float(df.loc[mask, "Quantity"].iloc[0])
        new_qty = current_qty + quantity
        if math.isclose(new_qty, 0, abs_tol=1e-9) or new_qty < 0:
            # Drop the row entirely if zeroed/sold out
            df = df[~mask]
            msg = f"Removed {ticker} from {account} (position closed)"
        else:
            df.loc[mask, "Quantity"] = new_qty
            df.loc[mask, "Value"] = None   # stale — will be recalculated from live price
            sign = "+" if quantity >= 0 else ""
            msg = f"{sign}{quantity:g} {ticker} in {account} → new total {new_qty:g}"
    else:
        # Determine class for known crypto tickers
        asset_class = "Crypto" if ticker in {"BTC", "ETH", "SOL"} else ""
        new_row = pd.DataFrame([{
            "Asset": ticker,
            "Quantity": quantity,
            "Value": None,
            "Class": asset_class,
            "Account": account,
        }])
        df = pd.concat([df, new_row], ignore_index=True)
        msg = f"Added new position: {quantity:g} {ticker} in {account}"

    df.to_csv(CSV_PATH, index=False)
    return {"success": True, "message": msg}
