#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
潛力股戰情室 - 美股大盤 / 隔夜國際盤收盤指數
======================================
抓各大盤『收盤指數＋漲跌%』，供盤前(08:00)與盤後(15:30)分析國際情勢、判斷台股開盤預期。
資料來源：yfinance(Yahoo Finance，免費、免 key)。

指數清單（皆取最近一日收盤 vs 前一日收盤）：
  ^DJI 道瓊、^GSPC S&P500、^IXIC 那斯達克、^SOX 費城半導體、^VIX 恐慌指數、
  TSM 台積電ADR(台股隔日開盤的代理指標)、^TWII 台股加權指數(前一交易日)。

註：台指期『夜盤』無穩定免費資料源，故以『美股收盤＋費半＋台積電ADR』作為夜盤/隔日預期的
   代理指標(市場盤前報告的標準做法)，不杜撰夜盤點數。

輸出 public/market.json，供前端國際盤 strip 與 AI 盤前/盤後解讀讀取。
"""

from __future__ import annotations

import json
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional

import yfinance as yf

try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:  # noqa: BLE001
    pass

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
MARKET_FILE = PROJECT_ROOT / "public" / "market.json"

TW_TZ = timezone(timedelta(hours=8))

# (yfinance 代號, 顯示名稱, 是否為台股隔日代理)
INDICES = [
    ("^DJI", "道瓊", False),
    ("^GSPC", "S&P 500", False),
    ("^IXIC", "那斯達克", False),
    ("^SOX", "費城半導體", False),
    ("^VIX", "VIX 恐慌指數", False),
    ("TSM", "台積電 ADR", True),
    ("^TWII", "台股加權(前日)", False),
]


def fetch_one(ticker: str) -> Optional[dict]:
    try:
        d = yf.download(ticker, period="7d", interval="1d",
                        auto_adjust=False, progress=False)
    except Exception as exc:  # noqa: BLE001
        print(f"[警告] {ticker} 下載失敗：{exc}")
        return None
    if d is None or d.empty:
        return None
    try:
        close = d["Close"]
        if hasattr(close, "columns"):
            close = close.iloc[:, 0]
        close = close.dropna()
        if len(close) < 1:
            return None
        last = float(close.iloc[-1])
        prev = float(close.iloc[-2]) if len(close) >= 2 else last
        chg = (last - prev) / prev * 100.0 if prev else 0.0
        d_idx = close.index[-1]
        return {"value": round(last, 2), "change_pct": round(chg, 2),
                "date": d_idx.strftime("%Y-%m-%d") if hasattr(d_idx, "strftime") else None}
    except Exception as exc:  # noqa: BLE001
        print(f"[警告] {ticker} 解析失敗：{exc}")
        return None


def main() -> int:
    print(f"🌍 國際盤收盤指數抓取開始 … {datetime.now(TW_TZ):%Y-%m-%d %H:%M:%S}")
    out = []
    for ticker, name, proxy in INDICES:
        r = fetch_one(ticker)
        if r is None:
            print(f"  {name}({ticker}) 無資料，略過")
            continue
        out.append({"code": ticker, "name": name, "value": r["value"],
                    "change_pct": r["change_pct"], "date": r["date"], "tw_proxy": proxy})
        print(f"  {name:14} {r['value']:>12.2f}  {r['change_pct']:+.2f}%  ({r['date']})")

    if not out:
        print("[警告] 全部指數抓取失敗，不覆寫 market.json")
        return 0

    payload = {"updated_at": datetime.now(TW_TZ).strftime("%Y-%m-%d %H:%M"), "indices": out}
    try:
        MARKET_FILE.parent.mkdir(parents=True, exist_ok=True)
        with MARKET_FILE.open("w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)
        print(f"✅ 已寫出 {MARKET_FILE}（{len(out)} 項指數）")
    except Exception as exc:  # noqa: BLE001
        print(f"[錯誤] 寫出 market.json 失敗：{exc}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
