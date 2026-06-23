#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
潛力股戰情室 - 集保股權分散表（大戶籌碼）補強
======================================
補強籌碼面最被低估的訊號：『大戶持股趨勢』。
資料來源：台灣集保中心(TDCC)官方 opendata（免費、免 token、全市場、每週更新）
  https://opendata.tdcc.com.tw/getOD.ashx?id=1-5

集保把每檔股票的持股人依張數分 15 級距(級距 = 股數，1張=1000股)：
  級距 1   = 1~999 股        (零股/小散戶)
  級距 2~3 = 1,000~10,000 股 (1~10 張，散戶)
  ...
  級距 12~14 = 400,001~1,000,000 股 (400~1000 張，中實戶)
  級距 15  = 1,000,001 股以上 (≥1000 張，千張大戶)

計算每檔：
  big1000_pct  千張大戶(≥1000張)持股比例        ← 最關鍵
  big400_pct   ≥400張大戶持股比例 (級距12~15)
  retail_pct   小散戶(<10張)持股比例 (級距1~3)
並用歷史(public/chip_history.json)算『千張大戶週變化』→ 籌碼集中/分散/持平。
大戶增、散戶減 = 籌碼集中(偏多)；反之偏空。結果併入 result.json 每檔的 chip 欄。

設計原則：沿用專案防呆——抓取失敗不中斷、結束前一定寫回；TDCC 憑證鏈不完整故 verify=False
(僅公開非敏感的集保 CSV，無隱私資料)。
"""

from __future__ import annotations

import csv
import io
import json
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional

import requests
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:  # noqa: BLE001
    pass

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
PUBLIC_DIR = PROJECT_ROOT / "public"
RESULT_FILE = PUBLIC_DIR / "result.json"
HISTORY_FILE = PUBLIC_DIR / "chip_history.json"

TW_TZ = timezone(timedelta(hours=8))
TDCC_URL = "https://opendata.tdcc.com.tw/getOD.ashx?id=1-5"
KEEP_WEEKS = 8            # 每檔保留最近幾週歷史
CONC_THRESHOLD = 0.3      # 千張大戶週變化達 ±0.3 個百分點才判集中/分散


def safe_float(value) -> Optional[float]:
    try:
        return float(str(value).replace(",", "").strip())
    except (TypeError, ValueError):
        return None


# --------------------------------------------------------------------------- #
# 抓 TDCC 集保分散表（全市場最新一週）
# --------------------------------------------------------------------------- #
def fetch_tdcc() -> tuple[dict[str, dict[int, float]], Optional[str]]:
    """回傳 ({代號: {級距: 持股%}}, 資料日期yyyymmdd)。失敗回 ({}, None)。"""
    try:
        resp = requests.get(TDCC_URL, headers={"User-Agent": "Mozilla/5.0"},
                            timeout=90, verify=False)
        resp.raise_for_status()
    except Exception as exc:  # noqa: BLE001
        print(f"[警告] 取得 TDCC 集保資料失敗：{exc}")
        return {}, None

    resp.encoding = "utf-8-sig"
    by_code: dict[str, dict[int, float]] = {}
    data_date: Optional[str] = None
    reader = csv.reader(io.StringIO(resp.text))
    header = next(reader, None)  # 資料日期,證券代號,持股分級,人數,股數,占集保庫存數比例%
    for row in reader:
        if len(row) < 6:
            continue
        date = row[0].strip()
        code = row[1].strip()
        try:
            level = int(row[2].strip())
        except (ValueError, IndexError):
            continue
        pct = safe_float(row[5])
        if not code or pct is None or level < 1 or level > 15:
            continue
        data_date = data_date or date
        by_code.setdefault(code, {})[level] = pct
    print(f"📦 TDCC 集保分散表 {data_date}：{len(by_code)} 檔")
    return by_code, data_date


def compute_metrics(levels: dict[int, float]) -> dict:
    """由級距持股% 算大戶/散戶指標。"""
    big1000 = levels.get(15)                                   # ≥1000 張千張大戶
    big400 = sum(levels.get(l, 0.0) for l in (12, 13, 14, 15)) # ≥400 張大戶
    retail = sum(levels.get(l, 0.0) for l in (1, 2, 3))        # <10 張小散戶
    return {
        "big1000_pct": round(big1000, 2) if big1000 is not None else None,
        "big400_pct": round(big400, 2),
        "retail_pct": round(retail, 2),
    }


# --------------------------------------------------------------------------- #
# 歷史累積 + 週趨勢
# --------------------------------------------------------------------------- #
def load_history() -> dict:
    if not HISTORY_FILE.exists():
        return {}
    try:
        with HISTORY_FILE.open("r", encoding="utf-8") as f:
            d = json.load(f)
        return d.get("weeks", {}) if isinstance(d, dict) else {}
    except Exception:  # noqa: BLE001
        return {}


def trend_from(prev_big1000: Optional[float], cur_big1000: Optional[float]) -> tuple[Optional[float], str]:
    """回傳 (週變化百分點, 判斷)。"""
    if prev_big1000 is None or cur_big1000 is None:
        return None, "資料累積中"
    chg = round(cur_big1000 - prev_big1000, 2)
    if chg >= CONC_THRESHOLD:
        return chg, "集中"      # 大戶增 → 籌碼集中(偏多)
    if chg <= -CONC_THRESHOLD:
        return chg, "分散"      # 大戶減 → 籌碼分散(偏空)
    return chg, "持平"


# --------------------------------------------------------------------------- #
# 主流程
# --------------------------------------------------------------------------- #
def main() -> int:
    print(f"🧩 集保大戶籌碼補強開始 … {datetime.now(TW_TZ):%Y-%m-%d %H:%M:%S}")

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

    by_code, data_date = fetch_tdcc()
    if not by_code or not data_date:
        print("[略過] 無集保資料，不補大戶籌碼")
        return 0

    history = load_history()
    enriched = 0
    for s in stocks:
        code = str(s.get("code", "")).strip()
        levels = by_code.get(code)
        if not levels:
            continue
        m = compute_metrics(levels)

        # 取歷史上「比本週舊」的最近一筆，算千張大戶週變化
        hist = history.get(code, [])
        prev = next((h for h in reversed(hist) if h.get("date") != data_date), None)
        chg, verdict = trend_from(prev.get("big1000") if prev else None, m["big1000_pct"])

        s["chip"] = {
            "date": data_date,
            "big1000_pct": m["big1000_pct"],
            "big400_pct": m["big400_pct"],
            "retail_pct": m["retail_pct"],
            "big1000_chg_1w": chg,
            "trend": verdict,
        }
        enriched += 1

        # 累積歷史（以週為單位去重，保留最近 KEEP_WEEKS 週）
        if not hist or hist[-1].get("date") != data_date:
            hist.append({"date": data_date, "big1000": m["big1000_pct"],
                         "big400": m["big400_pct"], "retail": m["retail_pct"]})
            history[code] = hist[-KEEP_WEEKS:]

    try:
        with RESULT_FILE.open("w", encoding="utf-8") as f:
            json.dump(result, f, ensure_ascii=False, indent=2)
        with HISTORY_FILE.open("w", encoding="utf-8") as f:
            json.dump({"updated_at": datetime.now(TW_TZ).strftime("%Y-%m-%d %H:%M"),
                       "data_date": data_date, "weeks": history}, f, ensure_ascii=False)
        print(f"✅ 已為 {enriched} 檔補上集保大戶籌碼 → result.json；歷史累計 {len(history)} 檔")
    except Exception as exc:  # noqa: BLE001
        print(f"[錯誤] 寫回失敗：{exc}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
