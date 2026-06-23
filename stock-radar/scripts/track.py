#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
潛力股戰情室 - 命中率追蹤器（多視窗）
======================================
這是整個系統的「誠實層」：每天把雷達選出的股票快照起來（含進場價），
事後用真實股價回頭驗證，算出這套選股法到底準不準。

多視窗命中（可用環境變數覆寫）：
  對 TRACK_WINDOWS（預設 5,10,20）每一個視窗 N 都判定：
  進場後 N 個交易日內，盤中最高價曾觸及 進場價 ×(1+TARGET_PCT/100)（預設 +5%）→ 命中。
  → 能看出「該抱幾天」命中率最高，反過來幫你決定持有天數。

流程：
  1. 讀 public/result.json（當日雷達榜）→ 併入 public/picks_history.json（日期+代號去重）。
  2. 對每筆歷史選股抓進場日之後的日線，對每個視窗算命中/最大漲幅/達標天數。
  3. 輸出 public/performance.json（每個視窗各一組命中率 + 逐筆明細）。

設計原則：沿用 scan.py 的防呆——單檔失敗不影響整體，結束前一定輸出。
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

import pandas as pd
import yfinance as yf

try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:  # noqa: BLE001
    pass

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
PUBLIC_DIR = PROJECT_ROOT / "public"
RESULT_FILE = PUBLIC_DIR / "result.json"
HISTORY_FILE = PUBLIC_DIR / "picks_history.json"
PERF_FILE = PUBLIC_DIR / "performance.json"

TW_TZ = timezone(timedelta(hours=8))

WINDOWS = sorted({int(x) for x in os.environ.get("TRACK_WINDOWS", "5,10,20").split(",") if x.strip()})
MAX_WINDOW = max(WINDOWS) if WINDOWS else 20
TARGET_PCT = float(os.environ.get("TRACK_TARGET_PCT", "5"))
BATCH_SIZE = 40
BENCH_CODE = os.environ.get("TRACK_BENCHMARK", "0050")   # 基準：元大台灣50（同視窗比較有無 alpha）
BENCH_NAME = "0050 台灣50"


def safe_float(value) -> Optional[float]:
    try:
        f = float(value)
    except (TypeError, ValueError):
        return None
    if math.isnan(f) or math.isinf(f):
        return None
    return f


# --------------------------------------------------------------------------- #
# 1) 併入當日選股快照
# --------------------------------------------------------------------------- #
def load_history() -> list[dict]:
    if not HISTORY_FILE.exists():
        return []
    try:
        with HISTORY_FILE.open("r", encoding="utf-8") as f:
            data = json.load(f)
        picks = data.get("picks", []) if isinstance(data, dict) else []
        return picks if isinstance(picks, list) else []
    except Exception as exc:  # noqa: BLE001
        print(f"[警告] 讀取 picks_history 失敗，視為空：{exc}")
        return []


def snapshot_today(history: list[dict]) -> list[dict]:
    try:
        with RESULT_FILE.open("r", encoding="utf-8") as f:
            result = json.load(f)
    except Exception as exc:  # noqa: BLE001
        print(f"[警告] 讀取 result.json 失敗，略過快照：{exc}")
        return history

    updated = str(result.get("updated_at", "")).strip()
    pick_date = updated[:10] if len(updated) >= 10 else datetime.now(TW_TZ).strftime("%Y-%m-%d")
    stocks = result.get("stocks", []) if isinstance(result, dict) else []

    # 非交易日防呆：週六日不快照（去重本已防重複，這裡再明確略過）
    try:
        if datetime.strptime(pick_date, "%Y-%m-%d").weekday() >= 5:
            print(f"🛑 {pick_date} 為週末，非交易日，略過快照")
            return history
    except Exception:  # noqa: BLE001
        pass

    seen = {(p.get("date"), p.get("code")) for p in history}
    added = 0
    for s in stocks:
        code = str(s.get("code", "")).strip()
        entry = safe_float(s.get("price"))
        if not code or entry is None or entry <= 0:
            continue
        key = (pick_date, code)
        if key in seen:
            continue
        # 凍結「為什麼選它」的決策訊號，供日後失敗檢討（事後無法重建）
        f = s.get("fundamentals") or {}
        dp = s.get("deep") or {}
        ind = s.get("industry") or {}
        sen = s.get("sentiment") or {}
        att = s.get("attention") or {}
        signals = {
            "composite": s.get("composite_score", s.get("score")),
            "breakdown": s.get("score_breakdown"),
            "rsi": s.get("rsi"),
            "change_pct": s.get("change_pct"),
            "foreign_lots": s.get("foreign_lots"),
            "trust_lots": s.get("trust_lots"),
            "pe": f.get("pe"),
            "fin_trend": dp.get("fin_trend"),
            "val5y": (dp.get("valuation_5y") or {}).get("verdict"),
            "inst20d": (dp.get("inst_20d") or {}).get("pattern"),
            "industry": ind.get("strength"),
            "margin_chg": sen.get("margin_change_pct"),
            "attn_mom": att.get("momentum_pct"),   # Google Trends 注意力動能(實驗訊號)
            "attn_trend": att.get("trend"),
        }
        history.append({
            "date": pick_date, "code": code, "name": s.get("name", ""),
            "entry_price": round(entry, 2),
            "score": s.get("composite_score", s.get("score")),
            "signals": signals,
        })
        seen.add(key)
        added += 1
    print(f"📸 {pick_date} 併入 {added} 筆新選股；歷史累計 {len(history)} 筆")
    return history


# --------------------------------------------------------------------------- #
# 2) 抓價並評估（多視窗）
# --------------------------------------------------------------------------- #
def fetch_price_history(codes: list[str], start: datetime) -> dict[str, pd.DataFrame]:
    frames: dict[str, pd.DataFrame] = {}
    tickers = [f"{c}.TW" for c in codes]
    start_str = (start - timedelta(days=10)).strftime("%Y-%m-%d")
    for i in range(0, len(tickers), BATCH_SIZE):
        chunk_codes = codes[i:i + BATCH_SIZE]
        chunk_tickers = tickers[i:i + BATCH_SIZE]
        try:
            data = yf.download(
                chunk_tickers, start=start_str, interval="1d",
                auto_adjust=False, group_by="ticker", threads=True, progress=False,
            )
        except Exception as exc:  # noqa: BLE001
            print(f"[批次錯誤] {chunk_codes[0]}…：{exc}")
            time.sleep(1.0)
            continue
        if data is None or data.empty:
            time.sleep(1.0)
            continue
        is_multi = isinstance(data.columns, pd.MultiIndex)
        for code, ticker in zip(chunk_codes, chunk_tickers):
            try:
                sub = data[ticker].copy() if is_multi else data.copy()
                sub = sub.dropna(subset=["High", "Close"])
                if not sub.empty:
                    frames[code] = sub
            except Exception:  # noqa: BLE001
                continue
        time.sleep(1.0)
    return frames


def evaluate_pick(pick: dict, df: Optional[pd.DataFrame]) -> dict:
    out = dict(pick)
    out["windows"] = {}
    out["last_return_pct"] = None
    out["status_overall"] = "no_data"

    entry = safe_float(pick.get("entry_price"))
    if df is None or entry is None or entry <= 0:
        return out
    try:
        entry_date = pd.Timestamp(pick["date"])
    except Exception:  # noqa: BLE001
        return out

    idx = df.index
    try:
        future = df[idx.normalize() > entry_date.normalize()]
    except Exception:  # noqa: BLE001
        future = df[idx > entry_date]
    if future.empty:
        out["status_overall"] = "pending"
        return out

    highs = future["High"].astype(float)
    closes = future["Close"].astype(float)
    target = entry * (1.0 + TARGET_PCT / 100.0)
    out["last_return_pct"] = round((float(closes.iloc[-1]) - entry) / entry * 100.0, 2)
    out["status_overall"] = "evaluated"

    for w in WINDOWS:
        wh = highs.head(w)
        bars = len(wh)
        if bars == 0:
            out["windows"][str(w)] = {"status": "pending"}
            continue
        max_high = float(wh.max())
        wc = closes.head(w)
        end_ret = round((float(wc.iloc[-1]) - entry) / entry * 100.0, 2)  # 視窗結束時實際報酬
        rec = {"max_return_pct": round((max_high - entry) / entry * 100.0, 2), "end_return_pct": end_ret}
        hit_mask = (wh >= target).values
        if bool(hit_mask.any()):
            rec.update({"hit": True, "days_to_hit": int(hit_mask.argmax()) + 1, "status": "hit"})
        elif bars >= w:
            rec.update({"hit": False, "days_to_hit": None, "status": "miss"})
        else:
            rec.update({"hit": False, "days_to_hit": None, "status": "open"})
        out["windows"][str(w)] = rec
    return out


# --------------------------------------------------------------------------- #
# 3) 彙總（每視窗一組）
# --------------------------------------------------------------------------- #
def summarize(details: list[dict]) -> dict:
    summary: dict[str, dict] = {}
    for w in WINDOWS:
        key = str(w)
        recs = [d["windows"][key] for d in details if d.get("windows", {}).get(key)]
        matured = [r for r in recs if r.get("status") in ("hit", "miss")]
        hits = [r for r in matured if r.get("hit")]
        misses = [r for r in matured if not r.get("hit")]
        days = [r["days_to_hit"] for r in hits if r.get("days_to_hit")]
        in_prog = [r for r in recs if r.get("status") == "open"]

        # 期望值（簡單策略：達標出在 +TARGET%，未達標抱到視窗末出在期末報酬）
        miss_ends = [r["end_return_pct"] for r in misses if r.get("end_return_pct") is not None]
        avg_loss = round(sum(miss_ends) / len(miss_ends), 2) if miss_ends else None  # 落空時平均報酬(常為負)
        max_rets = [r["max_return_pct"] for r in matured if r.get("max_return_pct") is not None]
        avg_max = round(sum(max_rets) / len(max_rets), 2) if max_rets else None
        realized = [TARGET_PCT] * len(hits) + miss_ends  # 每筆實現報酬
        expectancy = round(sum(realized) / len(realized), 2) if realized else None

        summary[key] = {
            "window_days": w,
            "matured": len(matured),
            "hits": len(hits),
            "misses": len(matured) - len(hits),
            "hit_rate_pct": round(len(hits) / len(matured) * 100.0, 1) if matured else None,
            "avg_days_to_target": round(sum(days) / len(days), 1) if days else None,
            "in_progress": len(in_prog),
            "avg_win_pct": TARGET_PCT,            # 達標出場固定 +TARGET%
            "avg_loss_pct": avg_loss,             # 落空時平均報酬（含負）
            "avg_max_return_pct": avg_max,        # 平均最大漲幅（看潛在空間）
            "expectancy_pct": expectancy,         # 每筆期望報酬（>0 才長期賺）
        }
    return summary


def write_performance(summary: dict, details: list[dict], benchmark: Optional[dict] = None) -> None:
    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
    payload = {
        "updated_at": datetime.now(TW_TZ).strftime("%Y-%m-%d %H:%M"),
        "windows": WINDOWS,
        "target_pct": TARGET_PCT,
        "note": f"命中＝進場後 N 個交易日內盤中曾漲≥{TARGET_PCT:.0f}%；命中率只計已到期樣本。期望值＝達標出在+{TARGET_PCT:.0f}%、未達標抱到視窗末，每筆平均報酬。",
        "benchmark_name": BENCH_NAME,
        "summary": summary,
        "benchmark": benchmark,
        "detail": sorted(details, key=lambda d: (d.get("date", ""), d.get("code", "")), reverse=True),
    }
    with PERF_FILE.open("w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    print(f"✅ 已寫出 {PERF_FILE}")


def write_history(history: list[dict]) -> None:
    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
    payload = {"updated_at": datetime.now(TW_TZ).strftime("%Y-%m-%d %H:%M"), "picks": history}
    with HISTORY_FILE.open("w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    print(f"✅ 已寫出 {HISTORY_FILE}（{len(history)} 筆）")


def main() -> int:
    print(f"🎯 命中率追蹤開始 … {datetime.now(TW_TZ):%Y-%m-%d %H:%M:%S}")
    print(f"   視窗 {WINDOWS} 交易日，命中門檻 +{TARGET_PCT:.0f}%")

    history = load_history()
    history = snapshot_today(history)
    write_history(history)

    if not history:
        print("尚無任何選股紀錄，輸出空報表")
        write_performance(summarize([]), [])
        return 0

    codes = sorted({p["code"] for p in history} | {BENCH_CODE})  # 含 0050 基準
    try:
        earliest = min(datetime.strptime(p["date"], "%Y-%m-%d") for p in history)
    except Exception:  # noqa: BLE001
        earliest = datetime.now(TW_TZ) - timedelta(days=120)
    print(f"📥 抓 {len(codes)} 檔股價（含基準，自 {earliest:%Y-%m-%d}）評估 {len(history)} 筆選股 …")
    frames = fetch_price_history(codes, earliest)

    details = []
    for pick in history:
        try:
            details.append(evaluate_pick(pick, frames.get(pick["code"])))
        except Exception as exc:  # noqa: BLE001
            print(f"[錯誤] 評估 {pick.get('code')} 失敗：{exc}")
            details.append({**pick, "windows": {}, "status_overall": "error"})

    summary = summarize(details)

    # 基準：把 0050 當成「每個選股日都買進」的虛擬部位，同視窗評估 → 比較有無 alpha
    benchmark = None
    bench_frame = frames.get(BENCH_CODE)
    if bench_frame is not None:
        bench_details = []
        for d in sorted({p["date"] for p in history}):
            try:
                dt = pd.Timestamp(d)
                row = bench_frame[bench_frame.index.normalize() == dt.normalize()]
                if row.empty:
                    continue
                entry_b = float(row["Close"].iloc[0])
                bp = {"date": d, "code": BENCH_CODE, "name": BENCH_NAME, "entry_price": round(entry_b, 2)}
                bench_details.append(evaluate_pick(bp, bench_frame))
            except Exception:  # noqa: BLE001
                continue
        benchmark = summarize(bench_details)
        print(f"📐 基準 {BENCH_NAME}：{len(bench_details)} 個選股日同視窗比較")

    write_performance(summary, details, benchmark)

    print("\n📊 多視窗命中率 / 期望值（vs 基準）：")
    for w in WINDOWS:
        s = summary[str(w)]
        b = (benchmark or {}).get(str(w), {})
        line = f"   {w:>2} 日：到期 {s['matured']:>3} 筆"
        if s["hit_rate_pct"] is not None:
            line += f"，命中率 {s['hit_rate_pct']}%"
            if b.get("hit_rate_pct") is not None:
                line += f"(基準 {b['hit_rate_pct']}%)"
        if s["expectancy_pct"] is not None:
            line += f"，期望值 {s['expectancy_pct']:+}%"
        line += f"；進行中 {s['in_progress']}"
        print(line)
    return 0


if __name__ == "__main__":
    sys.exit(main())
