#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
潛力股戰情室 - 情緒/資金面（融資融券）
======================================
補上第八維度「情緒與資金面」的可量化部分：融資融券。
定位為「風險警示層」——不加進正向評分，而是標出投機/籌碼風險與題材：
  - 融資今日餘額 vs 前日餘額 → 融資增減%。融資大增＝散戶追高(警訊)。
  - 融券今日餘額、券資比(融券/融資) → 高券資比＝潛在軋空題材。

資料來源：TWSE OpenAPI（免 token、一次全市場）
  https://openapi.twse.com.tw/v1/exchangeReport/MI_MARGN
  欄位(中文鍵)：股票代號/股票名稱/融資今日餘額/融資前日餘額/融券今日餘額/融券前日餘額…

設計原則：沿用專案防呆——抓不到資料優雅跳過，單檔失敗不中斷，只補進 result.json 既有的雷達股。
（當沖比因 OpenAPI 未提供乾淨的個股當沖量，暫未納入。）
"""

from __future__ import annotations

import json
import math
import re
import sys
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
MI_MARGN = "https://openapi.twse.com.tw/v1/exchangeReport/MI_MARGN"

# 警示門檻（可調）
MARGIN_SURGE_PCT = 15.0    # 融資單日增 ≥ 此值 → 散戶追高警訊
MARGIN_DROP_PCT = -10.0    # 融資單日減 ≤ 此值 → 籌碼換手/沉澱
SHORT_RATIO_HIGH = 30.0    # 券資比 ≥ 此值 → 軋空題材


def safe_float(value) -> Optional[float]:
    try:
        if isinstance(value, str):
            value = value.replace(",", "").strip()
            if value in ("", "--", "—", "N/A", "X"):
                return None
        f = float(value)
    except (TypeError, ValueError):
        return None
    if math.isnan(f) or math.isinf(f):
        return None
    return f


def fetch_margin() -> dict[str, dict]:
    """回傳 {代號: {margin_balance, margin_change_pct, short_balance, short_margin_ratio}}。"""
    try:
        resp = requests.get(MI_MARGN, timeout=30)
        resp.raise_for_status()
        rows = resp.json()
    except Exception as exc:  # noqa: BLE001
        print(f"[警告] 取得融資融券失敗：{exc}")
        return {}

    pat = re.compile(r"^[1-9]\d{3}$")
    out: dict[str, dict] = {}
    for row in rows if isinstance(rows, list) else []:
        try:
            code = str(row.get("股票代號", "")).strip()
            if not pat.match(code):
                continue
            m_now = safe_float(row.get("融資今日餘額"))
            m_prev = safe_float(row.get("融資前日餘額"))
            s_now = safe_float(row.get("融券今日餘額"))
            change = None
            if m_now is not None and m_prev not in (None, 0):
                change = round((m_now - m_prev) / m_prev * 100.0, 1)
            ratio = None
            if s_now is not None and m_now not in (None, 0):
                ratio = round(s_now / m_now * 100.0, 1)
            out[code] = {
                "margin_balance": int(m_now) if m_now is not None else None,
                "margin_change_pct": change,
                "short_balance": int(s_now) if s_now is not None else None,
                "short_margin_ratio": ratio,
            }
        except Exception:  # noqa: BLE001
            continue
    print(f"💰 取得 {len(out)} 檔融資融券")
    return out


def build_flags(m: dict) -> list[str]:
    flags = []
    chg = m.get("margin_change_pct")
    if chg is not None:
        if chg >= MARGIN_SURGE_PCT:
            flags.append("融資大增⚠")
        elif chg <= MARGIN_DROP_PCT:
            flags.append("融資減少")
    ratio = m.get("short_margin_ratio")
    if ratio is not None and ratio >= SHORT_RATIO_HIGH:
        flags.append("高券資比(軋空題材)")
    return flags


def main() -> int:
    print(f"🌡 情緒/資金面補強開始 … {datetime.now(TW_TZ):%Y-%m-%d %H:%M:%S}")

    try:
        with RESULT_FILE.open("r", encoding="utf-8") as f:
            result = json.load(f)
        stocks = result.get("stocks", []) if isinstance(result, dict) else []
    except Exception as exc:  # noqa: BLE001
        print(f"[錯誤] 讀取 result.json 失敗：{exc}")
        return 0

    if not stocks:
        print("雷達榜為空，無需補資金面")
        return 0

    margin = fetch_margin()
    if not margin:
        print("[略過] 無融資融券資料")
        return 0

    enriched = 0
    for s in stocks:
        m = margin.get(s.get("code"))
        if not m:
            continue
        m = dict(m)
        m["flags"] = build_flags(m)
        s["sentiment"] = m
        enriched += 1

    try:
        with RESULT_FILE.open("w", encoding="utf-8") as f:
            json.dump(result, f, ensure_ascii=False, indent=2)
        print(f"✅ 已把資金面併入 {enriched} 檔 → {RESULT_FILE}")
    except Exception as exc:  # noqa: BLE001
        print(f"[警告] 寫回 result.json 失敗：{exc}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
