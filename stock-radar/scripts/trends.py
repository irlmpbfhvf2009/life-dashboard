#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
潛力股戰情室 - 注意力面向（Google Trends 搜尋熱度）【實驗層】
======================================================
驗證一個常見的「另類數據」假說：散戶/民眾的搜尋行為，往往領先官方統計
與法人報告。把每檔股票對應的關鍵字搜尋熱度抓進來，算成「注意力動能」，
當成雷達榜的一個*實驗性*訊號 —— 不直接加進評分，而是先凍結進 picks_history，
靠既有的命中率追蹤(track.py) + 失敗檢討(review-failures) 去實測它到底有沒有效。

為什麼放本機手動層、不進免費 CI：
  - Google Trends 沒有官方免費 API，pytrends 走非官方端點；GitHub Actions 的
    機房 IP 很容易被 Google 擋(HTTP 429)。本機住宅 IP 容忍度高很多。
  - 跟 analyze-stocks 一樣，這是「深度/實驗層」，每週手動跑幾次即可。

算法（每檔關鍵字，geo=TW，近 90 天日資料）：
  latest   = 最近 7 天熱度均值（排除 Google 標記 isPartial 的未完成當日）
  baseline = 之前 ~8 週（最多 56 天）熱度均值
  momentum_pct = (latest - baseline) / baseline × 100      ← 主訊號：升溫幅度
  z = (latest - prior_mean) / prior_std                     ← 爆量程度
  trend:  爆量關注🔥 / 升溫 / 持平 / 降溫
結果併入 result.json 每檔的 attention 欄；同時把時間序列存進 trends_history.json。

關鍵字對應：預設用股票中文名；可在 public/trends_keywords.json 覆寫
  （{"3035": "智原", "2330": "台積電"} 形式），讓搜尋詞更貼近真實民意。

誠實提醒（寫進註解，避免被故事浪漫化）：
  - 搜尋熱度只是*領先指標之一*。「搜尋→消費→營收→這檔上市公司」中間每一環都會漏。
  - pytrends 同一批(≤5字)內的數值才互相可比；本腳本只用各字自己的*時間序列相對變化*
    (momentum/z)，不跨檔比絕對值，故批次正規化不影響訊號。
  - 倖存者偏差：別憑單一漂亮案例下結論，要看 track.py 累積夠樣本後的命中率差異。

設計原則：沿用專案防呆——抓不到/被擋(429)優雅跳過，單檔失敗不中斷，結束前一定寫回。
"""

from __future__ import annotations

import json
import math
import os
import random
import sys
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional

try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:  # noqa: BLE001
    pass

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
PUBLIC_DIR = PROJECT_ROOT / "public"
RESULT_FILE = PUBLIC_DIR / "result.json"
KEYWORDS_FILE = PUBLIC_DIR / "trends_keywords.json"
HISTORY_FILE = PUBLIC_DIR / "trends_history.json"
PICKS_FILE = PUBLIC_DIR / "picks_history.json"

TW_TZ = timezone(timedelta(hours=8))

GEO = os.environ.get("TRENDS_GEO", "TW")
TIMEFRAME = os.environ.get("TRENDS_TIMEFRAME", "today 3-m")   # 近 90 天日資料
RECENT_DAYS = 7          # 「最近」視窗
BASELINE_DAYS = 56       # 基準視窗（約 8 週）
BATCH = 5                # pytrends 單次最多 5 個關鍵字
KEEP_POINTS = 90         # 每檔歷史保留點數

# 判斷門檻（可調）
SURGE_MOM = 50.0         # 升溫 ≥ 50% 且 z≥2 → 爆量關注
SURGE_Z = 2.0
WARM_MOM = 20.0          # 升溫 ≥ 20% → 升溫
COOL_MOM = -20.0         # 降溫 ≤ -20% → 降溫


def safe_float(value) -> Optional[float]:
    try:
        f = float(value)
    except (TypeError, ValueError):
        return None
    if math.isnan(f) or math.isinf(f):
        return None
    return f


def load_keyword_overrides() -> dict[str, str]:
    if not KEYWORDS_FILE.exists():
        return {}
    try:
        with KEYWORDS_FILE.open("r", encoding="utf-8") as f:
            d = json.load(f)
        return {str(k): str(v) for k, v in d.items()} if isinstance(d, dict) else {}
    except Exception:  # noqa: BLE001
        return {}


def load_history() -> dict:
    if not HISTORY_FILE.exists():
        return {}
    try:
        with HISTORY_FILE.open("r", encoding="utf-8") as f:
            d = json.load(f)
        return d.get("series", {}) if isinstance(d, dict) else {}
    except Exception:  # noqa: BLE001
        return {}


# --------------------------------------------------------------------------- #
# pytrends 連線（容忍版本差異 + 防呆）
# --------------------------------------------------------------------------- #
def make_client():
    try:
        from pytrends.request import TrendReq  # type: ignore
    except Exception:  # noqa: BLE001
        print("[錯誤] 未安裝 pytrends。請先： pip install pytrends")
        return None
    try:
        # tz=-480 = UTC+8（台灣）；hl 介面語言
        return TrendReq(hl="zh-TW", tz=-480)
    except Exception as exc:  # noqa: BLE001
        print(f"[錯誤] 建立 pytrends 連線失敗：{exc}")
        return None


def fetch_interest(client, keywords: list[str]):
    """回傳 {keyword: [(date_str, value), ...]}；被擋或失敗回 {}。"""
    import pandas as pd  # pytrends 已依賴 pandas
    try:
        client.build_payload(keywords, timeframe=TIMEFRAME, geo=GEO)
        df = client.interest_over_time()
    except Exception as exc:  # noqa: BLE001
        msg = str(exc)
        if "429" in msg or "rate" in msg.lower():
            print(f"   ⚠ 被 Google 限流(429)：{keywords} → 稍候重試")
        else:
            print(f"   ⚠ 取得失敗 {keywords}：{exc}")
        return {}
    if df is None or df.empty:
        return {}
    # 丟掉 Google 標記為「當日未完成」的列，避免最後一天被低估
    if "isPartial" in df.columns:
        df = df[~df["isPartial"].astype(bool)]
    out: dict[str, list] = {}
    for kw in keywords:
        if kw not in df.columns:
            continue
        series = []
        for ts, val in df[kw].items():
            v = safe_float(val)
            if v is None:
                continue
            series.append((pd.Timestamp(ts).strftime("%Y-%m-%d"), v))
        if series:
            out[kw] = series
    return out


# --------------------------------------------------------------------------- #
# 由時間序列算注意力動能
# --------------------------------------------------------------------------- #
def compute_attention(series: list[tuple[str, float]], keyword: str) -> Optional[dict]:
    if not series or len(series) < RECENT_DAYS + 5:
        return None
    vals = [v for _, v in series]
    last_date = series[-1][0]

    recent = vals[-RECENT_DAYS:]
    prior = vals[:-RECENT_DAYS]
    baseline_pool = prior[-BASELINE_DAYS:] if len(prior) > BASELINE_DAYS else prior
    if not baseline_pool:
        return None

    latest = sum(recent) / len(recent)
    baseline = sum(baseline_pool) / len(baseline_pool)

    momentum = None
    if baseline > 0:
        momentum = round((latest - baseline) / baseline * 100.0, 1)

    # z 分數（最近均值相對於前期分布）
    mean_p = sum(baseline_pool) / len(baseline_pool)
    var_p = sum((x - mean_p) ** 2 for x in baseline_pool) / len(baseline_pool)
    std_p = math.sqrt(var_p)
    z = round((latest - mean_p) / std_p, 2) if std_p > 0 else None

    if momentum is None:
        trend = "資料不足"
    elif momentum >= SURGE_MOM and (z is not None and z >= SURGE_Z):
        trend = "爆量關注🔥"
    elif momentum >= WARM_MOM:
        trend = "升溫"
    elif momentum <= COOL_MOM:
        trend = "降溫"
    else:
        trend = "持平"

    return {
        "keyword": keyword,
        "geo": GEO,
        "latest": round(latest, 1),       # 近 7 天熱度均值（0~100，僅同批可比）
        "baseline": round(baseline, 1),   # 前 ~8 週熱度均值
        "momentum_pct": momentum,         # 主訊號：升溫幅度%
        "z": z,                           # 爆量程度
        "trend": trend,
        "peak": round(max(vals), 1),
        "date": last_date,
    }


# --------------------------------------------------------------------------- #
# 回填：把注意力訊號補進今天的 picks_history（讓命中率追蹤能事後驗證）
# --------------------------------------------------------------------------- #
def backfill_picks(result: dict, attn_by_code: dict[str, dict]) -> None:
    """CI 的 track.py 凍結選股時還沒有 attention，這裡按 date+code 回填，
    讓「注意力升溫」訊號能被 track.py / review-failures 事後關聯到命中與否。"""
    if not attn_by_code or not PICKS_FILE.exists():
        return
    updated = str(result.get("updated_at", "")).strip()
    pick_date = updated[:10] if len(updated) >= 10 else datetime.now(TW_TZ).strftime("%Y-%m-%d")
    try:
        with PICKS_FILE.open("r", encoding="utf-8") as f:
            data = json.load(f)
        picks = data.get("picks", []) if isinstance(data, dict) else []
    except Exception as exc:  # noqa: BLE001
        print(f"[警告] 讀取 picks_history 回填失敗：{exc}")
        return

    patched = 0
    for p in picks:
        if p.get("date") != pick_date:
            continue
        att = attn_by_code.get(str(p.get("code", "")).strip())
        if not att:
            continue
        sig = p.setdefault("signals", {})
        sig["attn_mom"] = att.get("momentum_pct")
        sig["attn_trend"] = att.get("trend")
        patched += 1
    if patched == 0:
        print(f"   （{pick_date} picks_history 尚無對應選股可回填；track.py 跑過後再執行即可）")
        return
    try:
        data["picks"] = picks
        with PICKS_FILE.open("w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"🧊 已把注意力訊號回填 {patched} 筆 {pick_date} 選股 → picks_history.json")
    except Exception as exc:  # noqa: BLE001
        print(f"[警告] 寫回 picks_history 失敗：{exc}")


# --------------------------------------------------------------------------- #
# 主流程
# --------------------------------------------------------------------------- #
def main() -> int:
    print(f"🔎 注意力面向(Google Trends)補強開始 … {datetime.now(TW_TZ):%Y-%m-%d %H:%M:%S}")
    print(f"   geo={GEO} timeframe='{TIMEFRAME}'（實驗層，本機手動）")

    try:
        with RESULT_FILE.open("r", encoding="utf-8") as f:
            result = json.load(f)
        stocks = result.get("stocks", []) if isinstance(result, dict) else []
    except Exception as exc:  # noqa: BLE001
        print(f"[錯誤] 讀取 result.json 失敗：{exc}")
        return 0
    if not stocks:
        print("雷達榜為空，無需補注意力面")
        return 0

    # 可選擇只跑前 N 檔： python scripts/trends.py 8
    limit = None
    for arg in sys.argv[1:]:
        if arg.isdigit():
            limit = int(arg)
    targets = stocks[:limit] if limit else stocks

    overrides = load_keyword_overrides()
    # 建立 (code, keyword) 清單
    pairs = []
    for s in targets:
        code = str(s.get("code", "")).strip()
        name = str(s.get("name", "")).strip()
        kw = overrides.get(code) or name
        if code and kw:
            pairs.append((code, kw, s))
    if not pairs:
        print("[略過] 無可用關鍵字")
        return 0

    client = make_client()
    if client is None:
        return 1

    history = load_history()
    attn_by_code: dict[str, dict] = {}
    enriched = 0
    # 分批（≤5）抓，批間隨機 sleep 降低被限流機率
    for i in range(0, len(pairs), BATCH):
        chunk = pairs[i:i + BATCH]
        keywords = [kw for _, kw, _ in chunk]
        print(f"   批次 {i // BATCH + 1}：{keywords}")
        fetched = {}
        for attempt in range(3):
            fetched = fetch_interest(client, keywords)
            if fetched:
                break
            time.sleep(8.0 + attempt * 12.0 + random.uniform(0, 5))
        if not fetched:
            print(f"   ⚠ 此批全數取不到，跳過：{keywords}")
            continue

        for code, kw, s in chunk:
            series = fetched.get(kw)
            if not series:
                continue
            att = compute_attention(series, kw)
            if att is None:
                continue
            s["attention"] = att
            attn_by_code[code] = att
            history[code] = [{"date": d, "v": v} for d, v in series][-KEEP_POINTS:]
            enriched += 1
            mom = att["momentum_pct"]
            print(f"      {code} {kw}: {att['trend']}"
                  f"（動能 {mom:+}%，z={att['z']}）" if mom is not None
                  else f"      {code} {kw}: {att['trend']}")
        time.sleep(3.0 + random.uniform(0, 4))

    if enriched == 0:
        print("⚠ 一檔都沒抓到（可能整段被 Google 限流）。稍後再跑即可，未更動 result.json。")
        return 0

    try:
        with RESULT_FILE.open("w", encoding="utf-8") as f:
            json.dump(result, f, ensure_ascii=False, indent=2)
        with HISTORY_FILE.open("w", encoding="utf-8") as f:
            json.dump({"updated_at": datetime.now(TW_TZ).strftime("%Y-%m-%d %H:%M"),
                       "geo": GEO, "series": history}, f, ensure_ascii=False)
        print(f"✅ 已為 {enriched} 檔補上注意力面 → result.json；歷史累計 {len(history)} 檔")
    except Exception as exc:  # noqa: BLE001
        print(f"[錯誤] 寫回失敗：{exc}")
        return 1

    backfill_picks(result, attn_by_code)
    return 0


if __name__ == "__main__":
    sys.exit(main())
