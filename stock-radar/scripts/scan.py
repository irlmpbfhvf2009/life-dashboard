#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
潛力股波段雷達 - 每日選股掃描器
======================================
適合「抱 3-7 天波段、看錯可轉中長線」的選股邏輯：
1. 從證交所(TWSE)動態取得活躍上市股清單與中文名稱。
2. 取得三大法人（外資/投信）買賣超（你最看重外資買超）。
3. 用 yfinance 批次抓 ~1 年日線，計算 MA5/20/60/240、RSI、量比。
4. 篩出「長期多頭趨勢、站上年線/季線、強勢但不過熱」的潛力股。
5. 算「潛力分數」（外資買超 25% / 投信 20% / 量能 15% / 趨勢 20% / 相對強弱 20%）排序。
   相對強弱(RS)＝個股近20/60日報酬減大盤(加權指數)同期報酬，過濾「只是被大盤抬轎」的股。
6. 輸出 public/result.json（含 K 線用的近 60 日 OHLC）。

設計原則：
- 單股失敗不影響整體；法人 API 失敗則該股法人資料留空（不中斷）。
- 程式結束前一定輸出 result.json。
- 所有數值強制轉 float，轉換失敗跳過。
"""

from __future__ import annotations

import json
import math
import os
import re
import sys
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd
import requests
import yfinance as yf
from tqdm import tqdm

try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:  # noqa: BLE001
    pass

# --------------------------------------------------------------------------- #
# 路徑
# --------------------------------------------------------------------------- #
SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
OUTPUT_DIR = PROJECT_ROOT / "public"
OUTPUT_FILE = OUTPUT_DIR / "result.json"
UNIVERSE_FILE = OUTPUT_DIR / "universe.json"  # 全市場資料，供「我的追蹤」查詢任何股票

TW_TZ = timezone(timedelta(hours=8))

# --------------------------------------------------------------------------- #
# 參數（可用環境變數覆寫）
# --------------------------------------------------------------------------- #
SCAN_TOP_N = int(os.environ.get("SCAN_TOP_N", "600"))   # 依成交金額取前 N 檔為掃描池
DISPLAY_TOP_N = int(os.environ.get("DISPLAY_TOP_N", "20"))  # 網站最多顯示前 N 檔（依潛力分數）
BATCH_SIZE = 40
HISTORY_PERIOD = "400d"   # 需 >=240 交易日算年線
OHLC_BARS = 60            # K 線輸出近 N 根

MA_PERIODS = (5, 20, 60, 240)
RSI_PERIOD = 14
MIN_HISTORY = 240         # 不足年線天數則跳過

RSI_LOWER, RSI_UPPER = 50.0, 70.0      # 強勢但不過熱
MAX_BIAS_MA20 = 18.0                    # 收盤距月線乖離上限%（避免追高）
MIN_VOLUME_RATIO = 1.2                  # 量增
MIN_VOLUME_LOTS = 1000                  # 成交量 > 1000 張

RS_PERIODS = (20, 60)                   # 相對強弱比較天數（近20/60日 vs 大盤）

# 潛力分數權重（外資買超權重最高，再納入相對強弱 RS；總和=1.0）
W_FOREIGN, W_TRUST, W_VOLUME, W_TREND, W_RS = 0.25, 0.20, 0.15, 0.20, 0.20

TWSE_STOCK_DAY_ALL = "https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL"
TWII_TICKER = "^TWII"                   # 加權指數（大盤），算相對強弱用
TWSE_T86 = "https://www.twse.com.tw/rwd/zh/fund/T86?date={date}&selectType=ALL&response=json"

FALLBACK_STOCKS: dict[str, str] = {
    "2330": "台積電", "2317": "鴻海", "2454": "聯發科", "2308": "台達電",
    "2881": "富邦金", "2882": "國泰金", "2891": "中信金", "1513": "中興電",
    "1519": "華城", "1503": "士電", "2412": "中華電", "3045": "台灣大",
    "2603": "長榮", "2615": "萬海", "2002": "中鋼", "1301": "台塑",
    "2345": "智邦", "3231": "緯創", "2382": "廣達", "3711": "日月光投控",
}


# --------------------------------------------------------------------------- #
# 工具
# --------------------------------------------------------------------------- #
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


def compute_rsi(close: pd.Series, period: int = RSI_PERIOD) -> pd.Series:
    delta = close.diff()
    gain = delta.clip(lower=0.0)
    loss = -delta.clip(upper=0.0)
    avg_gain = gain.ewm(alpha=1.0 / period, min_periods=period, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1.0 / period, min_periods=period, adjust=False).mean()
    rs = avg_gain / avg_loss.replace(0.0, np.nan)
    rsi = 100.0 - (100.0 / (1.0 + rs))
    return rsi.where(avg_loss != 0.0, 100.0)


# --------------------------------------------------------------------------- #
# 取得掃描池 + 交易日期
# --------------------------------------------------------------------------- #
def fetch_universe_and_date() -> tuple[dict[str, str], Optional[str]]:
    """回傳 ({代號:名稱}, 交易日期yyyymmdd)。失敗回 ({}, None)。"""
    try:
        resp = requests.get(TWSE_STOCK_DAY_ALL, timeout=30)
        resp.raise_for_status()
        rows = resp.json()
    except Exception as exc:  # noqa: BLE001
        print(f"[警告] 取得證交所清單失敗：{exc}")
        return {}, None

    trade_date = None
    if rows and isinstance(rows[0], dict):
        roc = str(rows[0].get("Date", "")).strip()  # 例 1150609
        if len(roc) == 7 and roc.isdigit():
            year = int(roc[:3]) + 1911
            trade_date = f"{year}{roc[3:5]}{roc[5:7]}"

    pat = re.compile(r"^[1-9]\d{3}$")
    cands: list[tuple[str, str, float]] = []
    for row in rows:
        try:
            code = str(row.get("Code", "")).strip()
            name = str(row.get("Name", "")).strip()
            if not pat.match(code) or not name:
                continue
            vol = safe_float(row.get("TradeVolume"))
            val = safe_float(row.get("TradeValue"))
            close = safe_float(row.get("ClosingPrice"))
            if vol is None or val is None or close is None or close <= 0:
                continue
            if vol < MIN_VOLUME_LOTS * 1000:
                continue
            cands.append((code, name, val))
        except Exception:  # noqa: BLE001
            continue

    cands.sort(key=lambda x: x[2], reverse=True)
    universe = {c: n for c, n, _ in cands[:SCAN_TOP_N]}
    print(f"📋 活躍股 {len(cands)} 檔，取成交金額前 {len(universe)} 檔；交易日 {trade_date}")
    return universe, trade_date


# --------------------------------------------------------------------------- #
# 三大法人買賣超（外資/投信）
# --------------------------------------------------------------------------- #
def fetch_institutional(trade_date: Optional[str]) -> dict[str, dict]:
    """回傳 {代號: {foreign_lots, trust_lots}}（張）。失敗回 {}。"""
    if not trade_date:
        return {}
    try:
        resp = requests.get(
            TWSE_T86.format(date=trade_date),
            headers={"User-Agent": "Mozilla/5.0"},
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()
    except Exception as exc:  # noqa: BLE001
        print(f"[警告] 取得三大法人買賣超失敗：{exc}")
        return {}

    if data.get("stat") != "OK":
        print(f"[警告] 法人資料未就緒（stat={data.get('stat')}）")
        return {}

    pat = re.compile(r"^[1-9]\d{3}$")
    result: dict[str, dict] = {}
    for row in data.get("data", []):
        try:
            code = str(row[0]).strip()
            if not pat.match(code):
                continue
            foreign_main = safe_float(row[4]) or 0.0      # 外陸資買賣超(不含外資自營商)
            foreign_dealer = safe_float(row[7]) or 0.0    # 外資自營商買賣超
            trust = safe_float(row[10]) or 0.0            # 投信買賣超
            result[code] = {
                "foreign_lots": round((foreign_main + foreign_dealer) / 1000),
                "trust_lots": round(trust / 1000),
            }
        except Exception:  # noqa: BLE001
            continue
    print(f"🏦 取得 {len(result)} 檔法人買賣超")
    return result


# --------------------------------------------------------------------------- #
# 批次下載歷史
# --------------------------------------------------------------------------- #
def download_history_batch(codes: list[str]) -> dict[str, pd.DataFrame]:
    frames: dict[str, pd.DataFrame] = {}
    tickers = [f"{c}.TW" for c in codes]
    for i in tqdm(range(0, len(tickers), BATCH_SIZE), desc="下載資料", unit="批"):
        chunk_codes = codes[i:i + BATCH_SIZE]
        chunk_tickers = tickers[i:i + BATCH_SIZE]
        try:
            data = yf.download(
                chunk_tickers, period=HISTORY_PERIOD, interval="1d",
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
                if is_multi:
                    if ticker not in data.columns.get_level_values(0):
                        continue
                    sub = data[ticker].copy()
                else:
                    sub = data.copy()
                sub = sub.dropna(subset=["Close", "Volume"])
                if not sub.empty:
                    frames[code] = sub
            except Exception:  # noqa: BLE001
                continue
        time.sleep(1.0)
    return frames


# --------------------------------------------------------------------------- #
# 大盤（加權指數）近 N 日報酬 → 算相對強弱基準
# --------------------------------------------------------------------------- #
def fetch_index_returns() -> dict[int, float]:
    """回傳 {天數: 大盤近 N 日報酬%}。失敗回 {}（RS 將整批留空，不影響其他計算）。"""
    try:
        data = yf.download(TWII_TICKER, period=HISTORY_PERIOD, interval="1d",
                           auto_adjust=False, progress=False)
    except Exception as exc:  # noqa: BLE001
        print(f"[警告] 下載大盤指數失敗：{exc}")
        return {}
    if data is None or data.empty:
        print("[警告] 大盤指數無資料")
        return {}
    try:
        close = data["Close"]
        if isinstance(close, pd.DataFrame):
            close = close.iloc[:, 0]
        close = close.dropna()
    except Exception:  # noqa: BLE001
        return {}
    out: dict[int, float] = {}
    for w in RS_PERIODS:
        if len(close) > w:
            base = safe_float(close.iloc[-1 - w])
            last = safe_float(close.iloc[-1])
            if base and last and base > 0:
                out[w] = (last / base - 1.0) * 100.0
    if out:
        print(f"📈 大盤報酬 → 近20日 {out.get(20):+.2f}%、近60日 {out.get(60):+.2f}%"
              if 20 in out and 60 in out else f"📈 大盤報酬 {out}")
    return out


def period_return(close: pd.Series, window: int, last_close: float) -> Optional[float]:
    """個股近 window 日報酬%。資料不足回 None。"""
    if len(close) > window:
        base = safe_float(close.iloc[-1 - window])
        if base and base > 0:
            return (last_close / base - 1.0) * 100.0
    return None


# --------------------------------------------------------------------------- #
# 單股分析（潛力股條件）
# --------------------------------------------------------------------------- #
def build_stock(code: str, name: str, df: pd.DataFrame, inst: dict,
                index_ret: Optional[dict[int, float]] = None) -> Optional[dict]:
    """計算單股完整資料（價量、均線、法人、K線），並標記是否為合格潛力股。
    需 >=60 個交易日（算季線）；年線需 >=240 天，不足則 ma240=None、qualified=False。"""
    if len(df) < 60:
        return None

    close = df["Close"].astype(float)
    volume = df["Volume"].astype(float)

    ma5s = close.rolling(window=5).mean()
    ma20s = close.rolling(window=20).mean()
    ma60s = close.rolling(window=60).mean()
    ma240s = close.rolling(window=240).mean() if len(df) >= 240 else None
    rsi_series = compute_rsi(close, RSI_PERIOD)
    vol_ma5 = volume.rolling(window=5).mean()

    last_close = safe_float(close.iloc[-1])
    prev_close = safe_float(close.iloc[-2]) if len(close) >= 2 else None
    last_ma5 = safe_float(ma5s.iloc[-1])
    last_ma20 = safe_float(ma20s.iloc[-1])
    last_ma60 = safe_float(ma60s.iloc[-1])
    last_ma240 = safe_float(ma240s.iloc[-1]) if ma240s is not None else None
    last_rsi = safe_float(rsi_series.iloc[-1])
    last_volume = safe_float(volume.iloc[-1])
    last_vol_ma5 = safe_float(vol_ma5.iloc[-1])

    required = [last_close, prev_close, last_ma5, last_ma20, last_ma60,
                last_rsi, last_volume, last_vol_ma5]
    if any(v is None for v in required):
        return None
    if last_vol_ma5 <= 0 or prev_close <= 0 or last_ma20 <= 0:
        return None

    volume_ratio = last_volume / last_vol_ma5
    change_pct = (last_close - prev_close) / prev_close * 100.0
    bias_ma20 = (last_close - last_ma20) / last_ma20 * 100.0

    foreign_lots = int(inst.get("foreign_lots", 0)) if inst else 0
    trust_lots = int(inst.get("trust_lots", 0)) if inst else 0

    # --- 相對強弱 RS：個股報酬 - 大盤報酬（超額報酬%）---
    index_ret = index_ret or {}
    ret_20 = period_return(close, 20, last_close)
    ret_60 = period_return(close, 60, last_close)
    rs_20 = (round(ret_20 - index_ret[20], 2)
             if ret_20 is not None and index_ret.get(20) is not None else None)
    rs_60 = (round(ret_60 - index_ret[60], 2)
             if ret_60 is not None and index_ret.get(60) is not None else None)

    # --- 合格潛力股條件（需有年線）---
    qualified = False
    if last_ma240 is not None and last_ma240 > 0:
        qualified = (
            last_close > last_ma240 and last_ma60 > last_ma240
            and last_close > last_ma60 and last_ma5 > last_ma20
            and RSI_LOWER <= last_rsi <= RSI_UPPER and bias_ma20 <= MAX_BIAS_MA20
            and volume_ratio > MIN_VOLUME_RATIO and last_volume > MIN_VOLUME_LOTS * 1000
        )

    # 趨勢分數（多頭排列程度）
    comps = [last_close > last_ma5, last_ma5 > last_ma20, last_ma20 > last_ma60]
    if last_ma240 is not None:
        comps.append(last_ma60 > last_ma240)
    trend = sum(comps) / len(comps)

    matched: list[str] = []
    if last_ma240 is not None and last_close > last_ma240:
        matched.append("站上年線")
    if last_ma240 is not None and last_ma60 > last_ma240:
        matched.append("中長多排列")
    if last_close > last_ma60:
        matched.append("站上季線")
    if foreign_lots > 0:
        matched.append("外資買超")
    if trust_lots > 0:
        matched.append("投信買超")
    if rs_60 is not None and rs_60 > 0:
        matched.append("強於大盤")

    tail = df.tail(OHLC_BARS)
    ohlc = []
    for idx, row in tail.iterrows():
        o = safe_float(row["Open"]); h = safe_float(row["High"])
        lo = safe_float(row["Low"]); c = safe_float(row["Close"])
        if None in (o, h, lo, c):
            continue
        try:
            ds = idx.strftime("%m/%d")
        except Exception:  # noqa: BLE001
            ds = ""
        ohlc.append([ds, round(o, 2), round(h, 2), round(lo, 2), round(c, 2)])

    return {
        "code": code,
        "name": name,
        "price": round(last_close, 2),
        "change_pct": round(change_pct, 2),
        "volume_ratio": round(volume_ratio, 2),
        "rsi": round(last_rsi, 1),
        "ma5": round(last_ma5, 2),
        "ma20": round(last_ma20, 2),
        "ma60": round(last_ma60, 2),
        "ma240": (round(last_ma240, 2) if last_ma240 is not None else None),
        "foreign_lots": foreign_lots,
        "trust_lots": trust_lots,
        "ret_20d": (round(ret_20, 2) if ret_20 is not None else None),
        "ret_60d": (round(ret_60, 2) if ret_60 is not None else None),
        "rs_20d": rs_20,
        "rs_60d": rs_60,
        "qualified": qualified,
        "_trend": trend,
        "matched": matched,
        "ohlc": ohlc,
    }


# --------------------------------------------------------------------------- #
# 潛力分數（外資買超權重最高，候選池內 min-max 正規化）
# --------------------------------------------------------------------------- #
def assign_scores(results: list[dict]) -> None:
    if not results:
        return

    def norm(vals: list[float]) -> list[float]:
        lo, hi = min(vals), max(vals)
        if hi - lo < 1e-9:
            return [0.5 for _ in vals]
        return [(v - lo) / (hi - lo) for v in vals]

    f = norm([r["foreign_lots"] for r in results])
    t = norm([r["trust_lots"] for r in results])
    v = norm([r["volume_ratio"] for r in results])
    tr = norm([r["_trend"] for r in results])
    # RS 缺值（大盤抓取失敗）→ 視為 0（與大盤同步），不偏袒亦不懲罰
    rs = norm([(r.get("rs_60d") if r.get("rs_60d") is not None else 0.0) for r in results])

    for i, r in enumerate(results):
        score = (W_FOREIGN * f[i] + W_TRUST * t[i] + W_VOLUME * v[i]
                 + W_TREND * tr[i] + W_RS * rs[i]) * 100.0
        r["score"] = round(score, 1)


# --------------------------------------------------------------------------- #
# 輸出
# --------------------------------------------------------------------------- #
def write_result(stocks: list[dict]) -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    payload = {
        "updated_at": datetime.now(TW_TZ).strftime("%Y-%m-%d %H:%M"),
        "total": len(stocks),
        "stocks": stocks,
    }
    with OUTPUT_FILE.open("w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    print(f"\n✅ 已寫出 {OUTPUT_FILE}（共 {len(stocks)} 檔潛力股）")


def write_universe(stocks: list[dict]) -> None:
    """寫出全市場資料（供「我的追蹤」查詢任何股票）。"""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    by_code = {s["code"]: s for s in stocks}
    payload = {
        "updated_at": datetime.now(TW_TZ).strftime("%Y-%m-%d %H:%M"),
        "stocks": by_code,
    }
    with UNIVERSE_FILE.open("w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False)
    print(f"✅ 已寫出 {UNIVERSE_FILE}（全市場 {len(by_code)} 檔，供追蹤查詢）")


# --------------------------------------------------------------------------- #
# 主流程
# --------------------------------------------------------------------------- #
def main() -> int:
    print(f"🚀 潛力股掃描開始 … {datetime.now(TW_TZ):%Y-%m-%d %H:%M:%S}")

    universe, trade_date = fetch_universe_and_date()
    if not universe:
        universe = dict(FALLBACK_STOCKS)
        print(f"⚠️ 使用內建備援清單 {len(universe)} 檔")

    inst_map = fetch_institutional(trade_date)
    index_ret = fetch_index_returns()

    codes = list(universe.keys())
    print(f"🎯 掃描池：{len(codes)} 檔")
    frames = download_history_batch(codes)
    print(f"📥 取得 {len(frames)} 檔歷史資料")

    universe_results: list[dict] = []
    for code in tqdm(codes, desc="分析計算", unit="檔"):
        df = frames.get(code)
        if df is None:
            continue
        try:
            r = build_stock(code, universe[code], df, inst_map.get(code, {}), index_ret)
            if r is not None:
                universe_results.append(r)
        except Exception as exc:  # noqa: BLE001
            print(f"[錯誤] {code} {universe.get(code, '')}：{exc}")
            continue

    # 合格潛力股 → 算分數、排序、取前 N 檔做為雷達榜
    qualified = [r for r in universe_results if r.get("qualified")]
    assign_scores(qualified)
    qualified.sort(key=lambda x: x.get("score", 0), reverse=True)
    radar = qualified[:DISPLAY_TOP_N]

    # 移除內部欄位
    for r in universe_results:
        r.pop("_trend", None)

    print(f"📊 全市場 {len(universe_results)} 檔；合格潛力股 {len(qualified)} 檔，雷達顯示前 {len(radar)} 檔")

    try:
        write_result(radar)
        write_universe(universe_results)
    except Exception as exc:  # noqa: BLE001
        print(f"[嚴重] 寫出失敗：{exc}")
        try:
            OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
            with OUTPUT_FILE.open("w", encoding="utf-8") as f:
                json.dump({"updated_at": "寫出失敗", "total": 0, "stocks": []},
                          f, ensure_ascii=False, indent=2)
        except Exception as exc2:  # noqa: BLE001
            print(f"[致命] {exc2}")
            return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
