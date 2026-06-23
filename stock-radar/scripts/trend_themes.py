#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
潛力股戰情室 - 題材搜尋掃描器（由下而上找飆升題材）【實驗層】
======================================================
trends.py 是「給定雷達股 → 看它的搜尋熱度」(由上而下)。
這支相反：「先看民眾最近在搜什麼投資題材 → 哪個在升溫 → 推哪些台股受惠」(由下而上)，
也就是冰雹故事的真正用法（搜尋領先 → 卡位產業）。

Google 的每日/即時熱搜端點已被廢(pytrends 取回 404)，故改用穩定的兩條路：
  1. 對一批*策展的投資題材關鍵字*算搜尋動能(近7天 vs 前8週) + z 爆量分數 → 排名。
  2. 抓各題材的「飆升關聯查詢(rising related queries)」→ 看細節題材在燒什麼。

輸出 public/trend_themes.json（題材熱度排名 + 各題材飆升字）。
個股對應留給人/AI 判讀（搜尋熱 ≠ 直接買，要確認有對應的上市受惠股、且市場還沒反應）。

種子題材可由 public/trend_themes_seed.json 覆寫（{"主題": "關鍵字"} 或 {"主題":["字1","字2"]}）。
"""

from __future__ import annotations

import json
import sys
import time
import random
from datetime import datetime, timezone, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from trends import compute_attention  # 復用動能算法  # noqa: E402

try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:  # noqa: BLE001
    pass

PROJECT_ROOT = Path(__file__).resolve().parent.parent
PUBLIC_DIR = PROJECT_ROOT / "public"
SEED_FILE = PUBLIC_DIR / "trend_themes_seed.json"
OUT_FILE = PUBLIC_DIR / "trend_themes.json"

TW_TZ = timezone(timedelta(hours=8))
GEO = "TW"
TIMEFRAME = "today 3-m"
BATCH = 5

# 策展的台股投資題材種子（關鍵字＝民眾真的會搜的口語詞）
DEFAULT_SEEDS: dict[str, str] = {
    "AI伺服器": "AI伺服器",
    "人形機器人": "人形機器人",
    "機器人": "機器人",
    "散熱液冷": "液冷",
    "先進封裝": "CoWoS",
    "矽光子": "矽光子",
    "重電電網": "重電",
    "綠能太陽能": "太陽能",
    "風電": "離岸風電",
    "低軌衛星": "低軌衛星",
    "軍工國防": "軍工",
    "記憶體HBM": "HBM",
    "電動車": "電動車",
    "充電樁": "充電樁",
    "缺水乾旱": "缺水",
    "高溫空調": "冷氣",
    "颱風": "颱風",
    "流感疫情": "流感",
    "減肥藥": "減肥藥",
    "黃金": "黃金價格",
    "比特幣": "比特幣",
    "輝達NVIDIA": "輝達",
    "台積電": "台積電",
    "蘋果iPhone": "iPhone",
    "ETF高股息": "高股息ETF",
    "旅遊航空": "出國旅遊",
}


def load_seeds() -> dict[str, str]:
    if not SEED_FILE.exists():
        return DEFAULT_SEEDS
    try:
        with SEED_FILE.open("r", encoding="utf-8") as f:
            d = json.load(f)
        out = {}
        for k, v in (d or {}).items():
            out[str(k)] = v[0] if isinstance(v, list) and v else str(v)
        return out or DEFAULT_SEEDS
    except Exception:  # noqa: BLE001
        return DEFAULT_SEEDS


def main() -> int:
    print(f"🔭 投資題材搜尋掃描開始 … {datetime.now(TW_TZ):%Y-%m-%d %H:%M:%S}")
    try:
        from pytrends.request import TrendReq
        import pandas as pd
    except Exception:  # noqa: BLE001
        print("[錯誤] 需要 pytrends：pip install pytrends")
        return 1

    seeds = load_seeds()
    items = list(seeds.items())  # [(theme, keyword), ...]
    client = TrendReq(hl="zh-TW", tz=-480)

    results: list[dict] = []
    for i in range(0, len(items), BATCH):
        chunk = items[i:i + BATCH]
        kws = [kw for _, kw in chunk]
        print(f"   批次 {i // BATCH + 1}：{kws}")
        iot = None
        rq = {}
        for attempt in range(3):
            try:
                client.build_payload(kws, timeframe=TIMEFRAME, geo=GEO)
                iot = client.interest_over_time()
                try:
                    rq = client.related_queries()
                except Exception:  # noqa: BLE001
                    rq = {}
                break
            except Exception as exc:  # noqa: BLE001
                print(f"      ⚠ 取得失敗(試 {attempt+1})：{exc}")
                time.sleep(8 + attempt * 12 + random.uniform(0, 5))
        if iot is None or iot.empty:
            print(f"      ⚠ 此批跳過：{kws}")
            continue
        if "isPartial" in iot.columns:
            iot = iot[~iot["isPartial"].astype(bool)]

        for theme, kw in chunk:
            if kw not in iot.columns:
                continue
            series = [(pd.Timestamp(ts).strftime("%Y-%m-%d"), float(v))
                      for ts, v in iot[kw].items()]
            att = compute_attention(series, kw)
            if att is None:
                continue
            rising = []
            r = (rq.get(kw) or {}).get("rising")
            if r is not None:
                for _, row in r.head(8).iterrows():
                    rising.append({"q": str(row["query"]), "v": int(row["value"])})
            results.append({
                "theme": theme,
                "keyword": kw,
                "latest": att["latest"],
                "baseline": att["baseline"],
                "momentum_pct": att["momentum_pct"],
                "z": att["z"],
                "trend": att["trend"],
                "peak": att["peak"],
                "rising": rising,
            })
            mom = att["momentum_pct"]
            print(f"      {theme:<10} {att['trend']:<8}"
                  + (f" 動能 {mom:+}%  z={att['z']}" if mom is not None else ""))
        time.sleep(3 + random.uniform(0, 4))

    if not results:
        print("⚠ 一個題材都沒抓到（可能整段被限流），稍後再跑。")
        return 0

    # 排序：先看 z（爆量可信度），再看動能
    results.sort(key=lambda r: ((r["z"] if r["z"] is not None else -9),
                                (r["momentum_pct"] if r["momentum_pct"] is not None else -999)),
                 reverse=True)

    payload = {
        "updated_at": datetime.now(TW_TZ).strftime("%Y-%m-%d %H:%M"),
        "geo": GEO, "timeframe": TIMEFRAME,
        "note": "由搜尋動能排的投資題材熱度。z高=爆量可信；動能=近7天vs前8週升溫幅度。搜尋熱≠買進，要確認有對應上市受惠股且市場未反應。",
        "themes": results,
    }
    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
    with OUT_FILE.open("w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    print(f"\n✅ 已寫出題材熱度排名 → {OUT_FILE}（{len(results)} 個題材）")

    print("\n🔥 升溫題材 TOP（依 z / 動能）：")
    for r in results[:10]:
        line = f"   {r['theme']:<10} {r['trend']:<8}"
        if r["momentum_pct"] is not None:
            line += f" 動能 {r['momentum_pct']:+}%  z={r['z']}"
        if r["rising"]:
            line += "  飆升字: " + "、".join(x["q"] for x in r["rising"][:3])
        print(line)
    return 0


if __name__ == "__main__":
    sys.exit(main())
