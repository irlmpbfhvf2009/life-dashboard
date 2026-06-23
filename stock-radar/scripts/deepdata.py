#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
潛力股戰情室 - 深度數據管線（為 AI 分析預抓精確數字）
======================================
把 AI 八面向分析最耗時的「上網挖數字」交給免費管線預先算好，AI 只做判讀+評分，
每檔成本大降、能分析更多檔。為雷達榜前 N 檔（預設 10）補三組深度數據：

1. 8 季財報趨勢（TaiwanStockFinancialStatements）
   每季 EPS / 毛利率 / 營益率 / 淨利率 / 營收，並算趨勢：改善 / 持平 / 惡化（以毛利、淨利率、營收年增為據）。
2. 5 年估值區間（TaiwanStockPER）
   本益比/股價淨值比/殖利率的 5 年區間與目前位階百分位 → 偏低 / 合理 / 偏高。
3. 20 日三大法人（TaiwanStockInstitutionalInvestorsBuySell）
   外資/投信/自營近 20 日累計買賣超(張)、外資連續買超天數、籌碼型態：偏多 / 偏空 / 混亂。

資料來源：FinMind v4（需 FINMIND_TOKEN）。沒 token 優雅跳過；單檔/單組失敗不中斷。
把結果寫進 result.json 每檔的 `deep` 欄位，供 /analyze-stocks 讀取。
"""

from __future__ import annotations

import json
import math
import os
import sys
import time
from collections import defaultdict
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
RESULT_FILE = PROJECT_ROOT / "public" / "result.json"

TW_TZ = timezone(timedelta(hours=8))
API = "https://api.finmindtrade.com/api/v4/data"

DEEP_TOP_N = int(os.environ.get("DEEP_TOP_N", "10"))  # 只為前 N 檔抓深度數據，省額度

REVENUE_KEYS = ["Revenue", "OperatingRevenue", "TotalOperatingRevenue", "NetSales", "Income"]
GROSS_KEYS = ["GrossProfit", "GrossProfitLoss"]
OPINCOME_KEYS = ["OperatingIncome", "OperatingProfit", "OperatingIncomeLoss"]
NETINCOME_KEYS = ["IncomeAfterTaxes", "ProfitAfterTax", "NetIncome", "IncomeFromContinuingOperations", "ProfitLoss"]
EPS_KEYS = ["EPS", "BasicEarningsPerShare", "BasicEPS"]


def safe_float(value) -> Optional[float]:
    try:
        if isinstance(value, str):
            value = value.replace(",", "").strip()
        f = float(value)
    except (TypeError, ValueError):
        return None
    if math.isnan(f) or math.isinf(f):
        return None
    return f


def finmind_get(dataset: str, data_id: str, start_date: str, token: str) -> list[dict]:
    try:
        resp = requests.get(
            API, params={"dataset": dataset, "data_id": data_id, "start_date": start_date},
            headers={"Authorization": f"Bearer {token}"}, timeout=25,
        )
        resp.raise_for_status()
        body = resp.json()
    except Exception as exc:  # noqa: BLE001
        print(f"[警告] {dataset} {data_id} 失敗：{exc}")
        return []
    if not isinstance(body, dict) or body.get("status") != 200:
        return []
    data = body.get("data", [])
    return data if isinstance(data, list) else []


def pick_first(m: dict, keys: list[str]) -> Optional[float]:
    for k in keys:
        v = m.get(k)
        if isinstance(v, (int, float)):
            return float(v)
    return None


def pct(num: Optional[float], den: Optional[float]) -> Optional[float]:
    if num is None or den is None or den == 0:
        return None
    return round(num / den * 100.0, 2)


# --------------------------------------------------------------------------- #
# 1) 8 季財報趨勢
# --------------------------------------------------------------------------- #
def fetch_financials_8q(code: str, token: str) -> tuple[list[dict], str]:
    start = (datetime.now(TW_TZ) - timedelta(days=900)).strftime("%Y-%m-%d")
    rows = finmind_get("TaiwanStockFinancialStatements", code, start, token)
    if not rows:
        return [], "資料不足"

    by_date: dict[str, dict] = defaultdict(dict)
    for r in rows:
        d = str(r.get("date", "")).strip()
        t = str(r.get("type", "")).strip()
        v = safe_float(r.get("value"))
        if d and t and v is not None:
            by_date[d][t] = v

    quarters = []
    for d in sorted(by_date.keys())[-8:]:
        m = by_date[d]
        rev = pick_first(m, REVENUE_KEYS)
        quarters.append({
            "q": d,
            "eps": pick_first(m, EPS_KEYS),
            "revenue": rev,
            "gross_margin": pct(pick_first(m, GROSS_KEYS), rev),
            "op_margin": pct(pick_first(m, OPINCOME_KEYS), rev),
            "net_margin": pct(pick_first(m, NETINCOME_KEYS), rev),
        })

    trend = compute_fin_trend(quarters)
    return quarters, trend


def compute_fin_trend(q: list[dict]) -> str:
    """以淨利率方向 + 營收年增（YoY，間隔4季）綜合判斷。"""
    if len(q) < 2:
        return "資料不足"
    signals = 0
    n = len(q)
    # 淨利率：最新 vs 前一季
    nm_new, nm_prev = q[-1].get("net_margin"), q[-2].get("net_margin")
    if nm_new is not None and nm_prev is not None:
        signals += 1 if nm_new > nm_prev + 0.3 else (-1 if nm_new < nm_prev - 0.3 else 0)
    # 營收年增（最新 vs 4 季前，需累計同基期；近似）
    if n >= 5:
        rv_new, rv_yoy = q[-1].get("revenue"), q[-5].get("revenue")
        if rv_new is not None and rv_yoy not in (None, 0):
            chg = (rv_new - rv_yoy) / abs(rv_yoy) * 100
            signals += 1 if chg > 3 else (-1 if chg < -3 else 0)
    # EPS：最新 vs 前一季
    eps_new, eps_prev = q[-1].get("eps"), q[-2].get("eps")
    if eps_new is not None and eps_prev is not None:
        signals += 1 if eps_new > eps_prev else (-1 if eps_new < eps_prev else 0)
    return "改善" if signals >= 1 else ("惡化" if signals <= -1 else "持平")


# --------------------------------------------------------------------------- #
# 2) 5 年估值區間
# --------------------------------------------------------------------------- #
def fetch_valuation_5y(code: str, token: str) -> dict:
    start = (datetime.now(TW_TZ) - timedelta(days=365 * 5 + 10)).strftime("%Y-%m-%d")
    rows = finmind_get("TaiwanStockPER", code, start, token)
    if not rows:
        return {}
    pes = [safe_float(r.get("PER")) for r in rows]
    pes = [p for p in pes if p is not None and p > 0]
    last = max(rows, key=lambda r: str(r.get("date", "")))
    pe_now = safe_float(last.get("PER"))
    pb_now = safe_float(last.get("PBR"))
    yield_now = safe_float(last.get("dividend_yield"))
    out = {"pe_now": pe_now, "pb_now": pb_now, "yield_now": yield_now}
    if pes and pe_now and pe_now > 0:
        lo, hi = min(pes), max(pes)
        out["pe_low"] = round(lo, 1)
        out["pe_high"] = round(hi, 1)
        pctile = (pe_now - lo) / (hi - lo) if hi > lo else 0.5
        out["pe_pctile"] = round(pctile * 100, 0)
        out["verdict"] = "偏低" if pctile < 0.33 else ("偏高" if pctile > 0.67 else "合理")
    else:
        out["verdict"] = "資料不足"
    return out


# --------------------------------------------------------------------------- #
# 3) 20 日三大法人
# --------------------------------------------------------------------------- #
def fetch_inst_20d(code: str, token: str) -> dict:
    start = (datetime.now(TW_TZ) - timedelta(days=40)).strftime("%Y-%m-%d")
    rows = finmind_get("TaiwanStockInstitutionalInvestorsBuySell", code, start, token)
    if not rows:
        return {}

    # 依日期彙整每類法人淨買賣超（股）
    by_day: dict[str, dict] = defaultdict(lambda: defaultdict(float))
    for r in rows:
        d = str(r.get("date", "")).strip()
        name = str(r.get("name", "")).strip()
        net = (safe_float(r.get("buy")) or 0) - (safe_float(r.get("sell")) or 0)
        by_day[d][name] += net

    days = sorted(by_day.keys())[-20:]
    if not days:
        return {}

    def net_sum(keys: list[str]) -> int:
        total = sum(by_day[d].get(k, 0) for d in days for k in keys)
        return round(total / 1000)  # 股 → 張

    foreign_keys = ["Foreign_Investor", "Foreign_Dealer_Self"]
    trust_keys = ["Investment_Trust"]
    dealer_keys = ["Dealer_self", "Dealer_Hedging", "Dealer"]

    foreign = net_sum(foreign_keys)
    trust = net_sum(trust_keys)
    dealer = net_sum(dealer_keys)

    # 外資由最新日往回連續買超天數
    streak = 0
    for d in reversed(days):
        day_net = sum(by_day[d].get(k, 0) for k in foreign_keys)
        if day_net > 0:
            streak += 1
        else:
            break

    if foreign > 0 and trust > 0:
        pattern = "偏多"
    elif foreign < 0 and trust < 0:
        pattern = "偏空"
    else:
        pattern = "混亂"

    return {"foreign_net": foreign, "trust_net": trust, "dealer_net": dealer,
            "foreign_streak": streak, "days": len(days), "pattern": pattern}


# --------------------------------------------------------------------------- #
# 主流程
# --------------------------------------------------------------------------- #
def main() -> int:
    print(f"🔬 深度數據管線開始 … {datetime.now(TW_TZ):%Y-%m-%d %H:%M:%S}")

    token = os.environ.get("FINMIND_TOKEN", "").strip()
    if not token:
        print("[略過] 未設定 FINMIND_TOKEN，不抓深度數據")
        return 0

    try:
        with RESULT_FILE.open("r", encoding="utf-8") as f:
            result = json.load(f)
        stocks = result.get("stocks", []) if isinstance(result, dict) else []
    except Exception as exc:  # noqa: BLE001
        print(f"[錯誤] 讀取 result.json 失敗：{exc}")
        return 0
    if not stocks:
        print("雷達榜為空")
        return 0

    targets = stocks[:DEEP_TOP_N]
    print(f"🎯 為前 {len(targets)} 檔抓深度數據（8季財報/5年估值/20日法人）…")
    for i, s in enumerate(targets, 1):
        code = s.get("code")
        if not code:
            continue
        try:
            q8, trend = fetch_financials_8q(code, token)
            time.sleep(0.4)
            val5 = fetch_valuation_5y(code, token)
            time.sleep(0.4)
            inst = fetch_inst_20d(code, token)
            time.sleep(0.4)
            s["deep"] = {
                "financials_8q": q8, "fin_trend": trend,
                "valuation_5y": val5, "inst_20d": inst,
            }
            print(f"  [{i}/{len(targets)}] {code} 財報趨勢={trend} "
                  f"估值={val5.get('verdict')} 法人={inst.get('pattern')}(外資{inst.get('foreign_net')}張)")
        except Exception as exc:  # noqa: BLE001
            print(f"  [錯誤] {code}：{exc}")
            continue

    try:
        with RESULT_FILE.open("w", encoding="utf-8") as f:
            json.dump(result, f, ensure_ascii=False, indent=2)
        print(f"✅ 已把深度數據併入前 {len(targets)} 檔 → {RESULT_FILE}")
    except Exception as exc:  # noqa: BLE001
        print(f"[錯誤] 寫回 result.json 失敗：{exc}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
