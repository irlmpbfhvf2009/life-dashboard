#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
潛力股戰情室 - 產業前景 / 族群強弱（維度二）
======================================
補上第二維度「產業前景」的可量化部分：產業分類 + 產業相對強弱。
（真正的「未來前景」是質化判斷，交給本機 AI 分析；這裡提供它需要的客觀族群數據。）

做兩件事：
  1. 產業分類：TWSE OpenAPI 上市公司基本資料（免 token、一次全市場）取每檔「產業別」。
     https://openapi.twse.com.tw/v1/opendata/t187ap03_L  欄位：公司代號/公司名稱/產業別
     ※ 產業別為代碼（如 01=水泥）；分組計算一律用代碼（永遠正確），名稱僅供顯示。
  2. 產業相對強弱：用 universe.json（全掃描池每檔當日漲幅）依產業分組算平均漲幅，
     與大盤平均比較 → 標「強勢族群／隨大盤／弱勢族群」，並給族群內排名。

把結果併入 result.json 每一檔，供前端顯示與本機 AI（/analyze-stocks）判讀產業前景。

設計原則：沿用專案防呆——抓不到資料優雅跳過，只補進雷達股。
"""

from __future__ import annotations

import json
import math
import sys
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
PUBLIC_DIR = PROJECT_ROOT / "public"
RESULT_FILE = PUBLIC_DIR / "result.json"
UNIVERSE_FILE = PUBLIC_DIR / "universe.json"

TW_TZ = timezone(timedelta(hours=8))
TWSE_COMPANY = "https://openapi.twse.com.tw/v1/opendata/t187ap03_L"

STRONG_GAP = 0.5   # 產業平均漲幅 - 大盤平均 ≥ 此值(%) → 強勢族群
WEAK_GAP = -0.5    # ≤ 此值 → 弱勢族群

# TWSE 上市產業別代碼 → 名稱（分組用代碼，名稱僅顯示；未知代碼回退顯示代碼）
INDUSTRY_NAMES = {
    "01": "水泥", "02": "食品", "03": "塑膠", "04": "紡織纖維", "05": "電機機械",
    "06": "電器電纜", "08": "玻璃陶瓷", "09": "造紙", "10": "鋼鐵", "11": "橡膠",
    "12": "汽車", "14": "建材營造", "15": "航運", "16": "觀光餐旅", "17": "金融保險",
    "18": "貿易百貨", "19": "綜合", "20": "其他", "21": "化學", "22": "生技醫療",
    "23": "油電燃氣", "24": "半導體", "25": "電腦及週邊", "26": "光電", "27": "通信網路",
    "28": "電子零組件", "29": "電子通路", "30": "資訊服務", "31": "其他電子",
    "32": "文化創意", "33": "農業科技", "34": "電子商務", "35": "綠能環保",
    "36": "數位雲端", "37": "運動休閒", "38": "居家生活", "80": "管理股票",
}


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


def industry_name(code: str) -> str:
    code = str(code).strip()
    if not code:
        return "未分類"
    if code.isdigit():
        return INDUSTRY_NAMES.get(code.zfill(2), f"產業{code}")
    return code  # 若資料源已是中文名稱，直接用


def fetch_industry_map() -> dict[str, str]:
    """回傳 {股票代號: 產業別(原始值，代碼或名稱)}。"""
    try:
        resp = requests.get(TWSE_COMPANY, timeout=30)
        resp.raise_for_status()
        rows = resp.json()
    except Exception as exc:  # noqa: BLE001
        print(f"[警告] 取得上市公司基本資料失敗：{exc}")
        return {}
    out: dict[str, str] = {}
    for row in rows if isinstance(rows, list) else []:
        try:
            code = str(row.get("公司代號", "")).strip()
            ind = str(row.get("產業別", "")).strip()
            if code and ind:
                out[code] = ind
        except Exception:  # noqa: BLE001
            continue
    print(f"🏭 取得 {len(out)} 檔產業別")
    return out


def load_universe() -> dict[str, dict]:
    try:
        with UNIVERSE_FILE.open("r", encoding="utf-8") as f:
            data = json.load(f)
        stocks = data.get("stocks", {}) if isinstance(data, dict) else {}
        return stocks if isinstance(stocks, dict) else {}
    except Exception as exc:  # noqa: BLE001
        print(f"[警告] 讀取 universe.json 失敗：{exc}")
        return {}


def compute_industry_strength(ind_map: dict[str, str], universe: dict[str, dict]) -> tuple[dict, float]:
    """依產業分組算平均漲幅；回傳 ({產業代碼: {avg, count}}, 大盤平均)。"""
    buckets: dict[str, list[float]] = defaultdict(list)
    all_changes: list[float] = []
    for code, s in universe.items():
        chg = safe_float(s.get("change_pct"))
        if chg is None:
            continue
        all_changes.append(chg)
        ind = ind_map.get(code)
        if ind:
            buckets[ind].append(chg)
    market_avg = round(sum(all_changes) / len(all_changes), 2) if all_changes else 0.0

    stats = {}
    for ind, vals in buckets.items():
        if not vals:
            continue
        stats[ind] = {"avg": round(sum(vals) / len(vals), 2), "count": len(vals)}
    return stats, market_avg


def main() -> int:
    print(f"🏭 產業前景補強開始 … {datetime.now(TW_TZ):%Y-%m-%d %H:%M:%S}")

    try:
        with RESULT_FILE.open("r", encoding="utf-8") as f:
            result = json.load(f)
        stocks = result.get("stocks", []) if isinstance(result, dict) else []
    except Exception as exc:  # noqa: BLE001
        print(f"[錯誤] 讀取 result.json 失敗：{exc}")
        return 0
    if not stocks:
        print("雷達榜為空，無需補產業")
        return 0

    ind_map = fetch_industry_map()
    if not ind_map:
        print("[略過] 無產業資料")
        return 0

    universe = load_universe()
    stats, market_avg = compute_industry_strength(ind_map, universe)

    # 產業排名（依平均漲幅由高到低）
    ranked = sorted(stats.items(), key=lambda kv: kv[1]["avg"], reverse=True)
    rank_of = {ind: i + 1 for i, (ind, _) in enumerate(ranked)}
    total_inds = len(ranked)

    enriched = 0
    for s in stocks:
        code = s.get("code")
        ind = ind_map.get(code)
        if not ind:
            continue
        st = stats.get(ind, {})
        avg = st.get("avg")
        gap = (avg - market_avg) if avg is not None else None
        if gap is None:
            strength = "未知"
        elif gap >= STRONG_GAP:
            strength = "強勢族群"
        elif gap <= WEAK_GAP:
            strength = "弱勢族群"
        else:
            strength = "隨大盤"
        s["industry"] = {
            "name": industry_name(ind),
            "avg_change_pct": avg,
            "market_avg_pct": market_avg,
            "rank": rank_of.get(ind),
            "total": total_inds,
            "peers": st.get("count"),
            "strength": strength,
        }
        enriched += 1

    try:
        with RESULT_FILE.open("w", encoding="utf-8") as f:
            json.dump(result, f, ensure_ascii=False, indent=2)
        print(f"✅ 已把產業資料併入 {enriched} 檔（大盤均漲 {market_avg}%）→ {RESULT_FILE}")
    except Exception as exc:  # noqa: BLE001
        print(f"[警告] 寫回 result.json 失敗：{exc}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
