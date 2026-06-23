#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
潛力股戰情室 - 基本面 / 估值補強（FinMind）
======================================
為雷達榜的股票補上「基本面(一)」與「估值面(三)」資料，補掉純技術+籌碼選股的最大盲點。

資料來源：FinMind v4（免費 token，需設環境變數 FINMIND_TOKEN）
  端點：https://api.finmindtrade.com/api/v4/data
  認證：Authorization: Bearer {token}
  ※ 免費 token 不能「無 data_id 一次抓全市場」，故只逐檔抓雷達榜（約 20 檔），省額度。

抓三個 dataset，併入 public/result.json 的每一檔：
  1. TaiwanStockPER            → PER(本益比)、PBR(股價淨值比)、dividend_yield(殖利率)
  2. TaiwanStockFinancialStatements → EPS、毛利率、營益率、淨利率
  3. TaiwanStockBalanceSheet   → 負債比、ROE(近似，單期淨利/權益)

另輸出 public/fundamentals.json 當快取（之後可跨日累積成全市場）。

設計原則：沿用專案防呆——沒 token 優雅跳過、單檔/單欄失敗不中斷、結束前一定輸出。
所有比率為「同期分子/分母」相除，對季報累計與否不敏感；ROE 標記為近似值。
"""

from __future__ import annotations

import json
import math
import os
import sys
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional

import requests

try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:  # noqa: BLE001
    pass

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
PUBLIC_DIR = PROJECT_ROOT / "public"
RESULT_FILE = PUBLIC_DIR / "result.json"
FUND_FILE = PUBLIC_DIR / "fundamentals.json"

TW_TZ = timezone(timedelta(hours=8))
API = "https://api.finmindtrade.com/api/v4/data"

# 也可額外補抓的代號（環境變數逗號分隔），預設只抓雷達榜
EXTRA_CODES = [c.strip() for c in os.environ.get("FUND_EXTRA_CODES", "").split(",") if c.strip()]

# 基本面健康門檻（可用環境變數覆寫）
MIN_EPS = float(os.environ.get("FUND_MIN_EPS", "0"))        # EPS 須為正
MAX_DEBT_RATIO = float(os.environ.get("FUND_MAX_DEBT", "70"))   # 負債比上限 %
MAX_PE = float(os.environ.get("FUND_MAX_PE", "40"))            # 本益比上限（避免過貴）

# FinMind 欄位名稱在不同公司/年度略有差異，用候選清單容錯比對
EPS_KEYS = ["EPS", "BasicEarningsPerShare", "BasicEPS"]
REVENUE_KEYS = ["Revenue", "OperatingRevenue", "TotalOperatingRevenue", "NetSales", "Income"]
GROSS_KEYS = ["GrossProfit", "GrossProfitLoss"]
OPINCOME_KEYS = ["OperatingIncome", "OperatingProfit", "OperatingIncomeLoss"]
NETINCOME_KEYS = ["IncomeAfterTaxes", "ProfitAfterTax", "NetIncome",
                  "IncomeFromContinuingOperations", "ProfitLoss"]
LIAB_KEYS = ["Liabilities", "TotalLiabilities"]
EQUITY_KEYS = ["Equity", "TotalEquity", "EquityAttributableToOwnersOfParent",
               "TotalStockholdersEquity"]
ASSET_KEYS = ["TotalAssets", "Assets"]


def safe_float(value) -> Optional[float]:
    try:
        f = float(value)
    except (TypeError, ValueError):
        return None
    if math.isnan(f) or math.isinf(f):
        return None
    return f


def pct(num: Optional[float], den: Optional[float]) -> Optional[float]:
    if num is None or den is None or den == 0:
        return None
    return round(num / den * 100.0, 2)


# --------------------------------------------------------------------------- #
# FinMind 請求
# --------------------------------------------------------------------------- #
def finmind_get(dataset: str, data_id: str, start_date: str, token: str) -> list[dict]:
    try:
        resp = requests.get(
            API,
            params={"dataset": dataset, "data_id": data_id, "start_date": start_date},
            headers={"Authorization": f"Bearer {token}"},
            timeout=20,
        )
        resp.raise_for_status()
        body = resp.json()
    except Exception as exc:  # noqa: BLE001
        print(f"[警告] {dataset} {data_id} 請求失敗：{exc}")
        return []
    if not isinstance(body, dict) or body.get("status") != 200:
        print(f"[警告] {dataset} {data_id} 回應異常：{body.get('msg') if isinstance(body, dict) else body}")
        return []
    data = body.get("data", [])
    return data if isinstance(data, list) else []


def latest_type_map(rows: list[dict]) -> dict[str, float]:
    """長格式財報→取『最新一期』的 {type: value}。"""
    if not rows:
        return {}
    dates = [str(r.get("date", "")) for r in rows if r.get("date")]
    if not dates:
        return {}
    latest = max(dates)
    out: dict[str, float] = {}
    for r in rows:
        if str(r.get("date")) != latest:
            continue
        t = str(r.get("type", "")).strip()
        v = safe_float(r.get("value"))
        if t and v is not None:
            out[t] = v
    out["_report_date"] = latest  # type: ignore[assignment]
    return out


def pick_first(m: dict, keys: list[str]) -> Optional[float]:
    for k in keys:
        if k in m and isinstance(m[k], (int, float)):
            return float(m[k])
    return None


# --------------------------------------------------------------------------- #
# 單檔基本面
# --------------------------------------------------------------------------- #
def fetch_fundamentals(code: str, token: str) -> dict:
    out: dict = {"code": code}

    fs_start = (datetime.now(TW_TZ) - timedelta(days=420)).strftime("%Y-%m-%d")
    per_start = (datetime.now(TW_TZ) - timedelta(days=14)).strftime("%Y-%m-%d")

    # 1) 估值 PER/PBR/殖利率（取最新一日）
    per_rows = finmind_get("TaiwanStockPER", code, per_start, token)
    if per_rows:
        last = max(per_rows, key=lambda r: str(r.get("date", "")))
        out["pe"] = safe_float(last.get("PER"))
        out["pb"] = safe_float(last.get("PBR"))
        out["dividend_yield"] = safe_float(last.get("dividend_yield"))
        out["valuation_date"] = last.get("date")
    time.sleep(0.4)

    # 2) 綜合損益表 → EPS、三率
    fs = latest_type_map(finmind_get("TaiwanStockFinancialStatements", code, fs_start, token))
    revenue = pick_first(fs, REVENUE_KEYS)
    gross = pick_first(fs, GROSS_KEYS)
    opinc = pick_first(fs, OPINCOME_KEYS)
    netinc = pick_first(fs, NETINCOME_KEYS)
    out["eps"] = pick_first(fs, EPS_KEYS)
    out["gross_margin"] = pct(gross, revenue)
    out["op_margin"] = pct(opinc, revenue)
    out["net_margin"] = pct(netinc, revenue)
    out["report_date"] = fs.get("_report_date")
    time.sleep(0.4)

    # 3) 資產負債表 → 負債比、ROE(近似)
    bs = latest_type_map(finmind_get("TaiwanStockBalanceSheet", code, fs_start, token))
    liab = pick_first(bs, LIAB_KEYS)
    equity = pick_first(bs, EQUITY_KEYS)
    assets = pick_first(bs, ASSET_KEYS)
    if assets is None and liab is not None and equity is not None:
        assets = liab + equity
    out["debt_ratio"] = pct(liab, assets)
    out["roe_approx"] = pct(netinc, equity)  # 單期淨利/權益，近似值
    time.sleep(0.4)

    out["tags"] = build_tags(out)
    out["fund_pass"] = is_healthy(out)
    return out


def build_tags(f: dict) -> list[str]:
    tags = []
    eps = f.get("eps")
    if eps is not None and eps > 0:
        tags.append("獲利")
    roe = f.get("roe_approx")
    if roe is not None and roe >= 5:
        tags.append("高ROE" if roe >= 5 else "")
    gm = f.get("gross_margin")
    if gm is not None and gm >= 30:
        tags.append("高毛利")
    debt = f.get("debt_ratio")
    if debt is not None and debt <= 40:
        tags.append("低負債")
    dy = f.get("dividend_yield")
    if dy is not None and dy >= 4:
        tags.append("殖利率>4%")
    pe = f.get("pe")
    if pe is not None and 0 < pe <= 15:
        tags.append("本益比偏低")
    return [t for t in tags if t]


def is_healthy(f: dict) -> bool:
    """基本面健康門檻：有獲利、負債不過高、估值不過貴。資料缺漏不擋（從寬）。"""
    eps = f.get("eps")
    if eps is not None and eps <= MIN_EPS:
        return False
    debt = f.get("debt_ratio")
    if debt is not None and debt > MAX_DEBT_RATIO:
        return False
    pe = f.get("pe")
    if pe is not None and pe > MAX_PE:
        return False
    return True


# --------------------------------------------------------------------------- #
# 主流程
# --------------------------------------------------------------------------- #
def main() -> int:
    print(f"📚 基本面補強開始 … {datetime.now(TW_TZ):%Y-%m-%d %H:%M:%S}")

    token = os.environ.get("FINMIND_TOKEN", "").strip()
    if not token:
        print("[略過] 未設定 FINMIND_TOKEN，不補基本面")
        return 0

    try:
        with RESULT_FILE.open("r", encoding="utf-8") as f:
            result = json.load(f)
        stocks = result.get("stocks", []) if isinstance(result, dict) else []
    except Exception as exc:  # noqa: BLE001
        print(f"[錯誤] 讀取 result.json 失敗：{exc}")
        return 0

    codes = [s.get("code") for s in stocks if s.get("code")]
    for c in EXTRA_CODES:
        if c not in codes:
            codes.append(c)
    if not codes:
        print("雷達榜為空，無需補基本面")
        return 0

    print(f"🎯 為 {len(codes)} 檔抓基本面/估值（FinMind 逐檔）…")
    fund_map: dict[str, dict] = {}
    for i, code in enumerate(codes, 1):
        try:
            f = fetch_fundamentals(code, token)
            fund_map[code] = f
            print(f"  [{i}/{len(codes)}] {code} EPS={f.get('eps')} PE={f.get('pe')} "
                  f"毛利={f.get('gross_margin')}% 負債={f.get('debt_ratio')}% 健康={f.get('fund_pass')}")
        except Exception as exc:  # noqa: BLE001
            print(f"  [錯誤] {code}：{exc}")
            continue

    # 併入 result.json 的每一檔
    for s in stocks:
        f = fund_map.get(s.get("code"))
        if f:
            s["fundamentals"] = {k: v for k, v in f.items() if k != "code"}

    try:
        with RESULT_FILE.open("w", encoding="utf-8") as fp:
            json.dump(result, fp, ensure_ascii=False, indent=2)
        print(f"✅ 已把基本面併入 {RESULT_FILE}")
    except Exception as exc:  # noqa: BLE001
        print(f"[警告] 寫回 result.json 失敗：{exc}")

    # 另存快取
    try:
        PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
        with FUND_FILE.open("w", encoding="utf-8") as fp:
            json.dump({"updated_at": datetime.now(TW_TZ).strftime("%Y-%m-%d %H:%M"),
                       "stocks": fund_map}, fp, ensure_ascii=False, indent=2)
        print(f"✅ 已寫出 {FUND_FILE}（{len(fund_map)} 檔）")
    except Exception as exc:  # noqa: BLE001
        print(f"[警告] 寫出 fundamentals.json 失敗：{exc}")

    healthy = sum(1 for f in fund_map.values() if f.get("fund_pass"))
    print(f"\n📊 {len(fund_map)} 檔中，基本面健康 {healthy} 檔（有獲利、負債<{MAX_DEBT_RATIO:.0f}%、PE<{MAX_PE:.0f}）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
