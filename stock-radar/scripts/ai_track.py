#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
潛力股戰情室 - AI 選股命中率追蹤器
======================================
這是「看 AI 玩股票」的核心：只追蹤『AI 看好的股』，算 AI 自己的命中率。

定義：
  AI 看好 = analysis_archive.json 中 total_score >= AI_PICK_MIN（預設 28/40）的個股。
  進場價 = AI 分析當天(analyzed_at)的收盤價；往後用真實股價，依多視窗(5/10/20日)
           判定是否曾漲達 +TARGET_PCT%（命中），並算目前實際報酬。

與量化版 track.py 的差異：
  track.py     → 追蹤「量化模型選的整個雷達榜」(picks_history) → 量化命中率
  ai_track.py  → 只追蹤「AI 評分看好的標的」(analysis_archive) → AI 命中率
重用 track.py 的抓價/評估/彙總邏輯，全程免費(yfinance)、不走付費 API。

輸出 public/ai_performance.json（結構同 performance.json，detail 另含 total_score）。
"""

from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional

import pandas as pd

# 重用量化追蹤器的抓價/評估/彙總（同資料夾）
SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))
import track  # noqa: E402

try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:  # noqa: BLE001
    pass

PROJECT_ROOT = SCRIPT_DIR.parent
PUBLIC_DIR = PROJECT_ROOT / "public"
ARCHIVE_FILE = PUBLIC_DIR / "analysis_archive.json"
AI_PERF_FILE = PUBLIC_DIR / "ai_performance.json"

TW_TZ = timezone(timedelta(hours=8))
# total_score 門檻（滿分40）。回測顯示 28-30 分區平均為負、≥31 才明顯轉正 → 由 28 提高到 30。
AI_PICK_MIN = float(os.environ.get("AI_PICK_MIN", "30"))
# 否決規則（過往回測中這些訊號組合的期末報酬明顯偏負）。設 AI_VETO=0 可關閉。
AI_VETO = os.environ.get("AI_VETO", "1") != "0"


def vetoed(scores: dict) -> Optional[str]:
    """回傳否決原因；None＝通過。scores 為各面向的 verdict 字串。"""
    if not AI_VETO:
        return None
    chips = scores.get("chips")
    tech = scores.get("technical")
    risk = scores.get("risk")
    val = scores.get("valuation")
    if chips == "偏空":
        return "籌碼偏空"          # 例：今國光 收 -16%
    if tech in ("盤整", "空頭"):
        return "技術非多頭"        # 盤整組回測平均 -2.3%
    if risk == "高" and val in ("偏貴", "偏高"):
        return "高風險且估值偏貴"  # 例：力積電/上銀 大幅回檔
    return None


def entry_on(df: Optional[pd.DataFrame], date: str) -> Optional[float]:
    """取 analyzed_at 當天收盤；非交易日則取之後第一個交易日。"""
    if df is None or df.empty:
        return None
    try:
        dt = pd.Timestamp(date).normalize()
    except Exception:  # noqa: BLE001
        return None
    same = df[df.index.normalize() == dt]
    px = None
    if not same.empty:
        px = track.safe_float(same["Close"].iloc[0])
    else:
        after = df[df.index.normalize() >= dt]
        if not after.empty:
            px = track.safe_float(after["Close"].iloc[0])
    return round(px, 2) if px is not None else None


def load_ai_picks() -> list[dict]:
    """從 analysis_archive 取出 AI 看好(total_score>=門檻)的標的。"""
    if not ARCHIVE_FILE.exists():
        return []
    try:
        with ARCHIVE_FILE.open("r", encoding="utf-8") as f:
            arch = json.load(f)
    except Exception as exc:  # noqa: BLE001
        print(f"[警告] 讀取 analysis_archive 失敗：{exc}")
        return []
    stocks = arch.get("stocks", {}) if isinstance(arch, dict) else {}
    picks = []
    vetoed_n = 0
    for code, s in stocks.items():
        ts = track.safe_float(s.get("total_score"))
        date = s.get("analyzed_at")
        if ts is None or not date or ts < AI_PICK_MIN:
            continue
        scores = {k: (v or {}).get("verdict") for k, v in (s.get("scores") or {}).items()}
        reason = vetoed(scores)
        if reason:
            vetoed_n += 1
            print(f"   ⛔ 否決 {code} {s.get('name','')}（{reason}）")
            continue
        picks.append({
            "date": date, "code": str(code), "name": s.get("name", ""),
            "total_score": ts, "scores": scores,
        })
    if vetoed_n:
        print(f"   否決規則濾掉 {vetoed_n} 檔")
    return picks


def write_ai_performance(summary: dict, details: list[dict], benchmark: Optional[dict]) -> None:
    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
    payload = {
        "updated_at": datetime.now(TW_TZ).strftime("%Y-%m-%d %H:%M"),
        "windows": track.WINDOWS,
        "target_pct": track.TARGET_PCT,
        "ai_pick_min": AI_PICK_MIN,
        "ai_veto": AI_VETO,
        "note": (
            f"只計 AI 評分 total_score>={AI_PICK_MIN:.0f}/40 且通過否決規則(籌碼偏空/技術非多頭/高風險且估值偏貴)的『AI 看好標的』。"
            f"命中率(hit_rate_pct)＝盤中曾漲≥{track.TARGET_PCT:.0f}%(會高估)；"
            f"建議看 win_rate_end_pct(期末收紅)、end_expectancy_pct(期末平均報酬)、realized_expectancy_pct(停利停損模擬)。只計已到期樣本。"
        ),
        "benchmark_name": track.BENCH_NAME,
        "summary": summary,
        "benchmark": benchmark,
        "detail": sorted(details, key=lambda d: (d.get("date", ""), d.get("code", "")), reverse=True),
    }
    with AI_PERF_FILE.open("w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    print(f"✅ 已寫出 {AI_PERF_FILE}")


def main() -> int:
    print(f"🤖 AI 選股命中率追蹤開始 … {datetime.now(TW_TZ):%Y-%m-%d %H:%M:%S}")
    print(f"   門檻 total_score>={AI_PICK_MIN:.0f}/40，視窗 {track.WINDOWS} 日，命中 +{track.TARGET_PCT:.0f}%")

    picks = load_ai_picks()
    if not picks:
        print("尚無 AI 看好標的，輸出空報表")
        write_ai_performance(track.summarize([]), [], None)
        return 0

    codes = sorted({p["code"] for p in picks} | {track.BENCH_CODE})
    try:
        earliest = min(datetime.strptime(p["date"], "%Y-%m-%d") for p in picks)
    except Exception:  # noqa: BLE001
        earliest = datetime.now(TW_TZ) - timedelta(days=120)
    print(f"📥 抓 {len(codes)} 檔股價（含基準，自 {earliest:%Y-%m-%d}）評估 {len(picks)} 檔 AI 看好標的 …")
    frames = track.fetch_price_history(codes, earliest)

    details = []
    for p in picks:
        df = frames.get(p["code"])
        p["entry_price"] = entry_on(df, p["date"])
        if p["entry_price"] is None:
            details.append({**p, "windows": {}, "last_return_pct": None, "status_overall": "no_data"})
            continue
        try:
            d = track.evaluate_pick(p, df)
            d["total_score"] = p.get("total_score")
            d["scores"] = p.get("scores")
            details.append(d)
        except Exception as exc:  # noqa: BLE001
            print(f"[錯誤] 評估 {p.get('code')} 失敗：{exc}")
            details.append({**p, "windows": {}, "status_overall": "error"})

    summary = track.summarize(details)

    # 基準：把 0050 當「每個 AI 選股日都買進」同視窗比較
    benchmark = None
    bench_frame = frames.get(track.BENCH_CODE)
    if bench_frame is not None:
        bench_details = []
        for d in sorted({p["date"] for p in picks}):
            try:
                dt = pd.Timestamp(d)
                row = bench_frame[bench_frame.index.normalize() == dt.normalize()]
                if row.empty:
                    continue
                bp = {"date": d, "code": track.BENCH_CODE, "name": track.BENCH_NAME,
                      "entry_price": round(float(row["Close"].iloc[0]), 2)}
                bench_details.append(track.evaluate_pick(bp, bench_frame))
            except Exception:  # noqa: BLE001
                continue
        benchmark = track.summarize(bench_details)

    write_ai_performance(summary, details, benchmark)

    print("\n🤖 AI 選股多視窗命中率 / 期望值（vs 基準）：")
    for w in track.WINDOWS:
        s = summary[str(w)]
        b = (benchmark or {}).get(str(w), {})
        line = f"   {w:>2} 日：到期 {s['matured']:>3} 筆"
        if s["hit_rate_pct"] is not None:
            line += f"，命中率 {s['hit_rate_pct']}%"
            if b.get("hit_rate_pct") is not None:
                line += f"(基準 {b['hit_rate_pct']}%)"
        if s.get("win_rate_end_pct") is not None:
            line += f"，期末收紅 {s['win_rate_end_pct']}%"
        if s.get("end_expectancy_pct") is not None:
            line += f"，期末期望 {s['end_expectancy_pct']:+}%"
        if s.get("realized_expectancy_pct") is not None:
            line += f"，停利停損期望 {s['realized_expectancy_pct']:+}%"
        line += f"；進行中 {s['in_progress']}"
        print(line)
    return 0


if __name__ == "__main__":
    sys.exit(main())
