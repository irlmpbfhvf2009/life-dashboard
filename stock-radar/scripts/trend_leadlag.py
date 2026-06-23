#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
潛力股戰情室 - 搜尋 vs 股價 領先/落後檢定【實驗層】
======================================================
回答另類數據策略最致命的問題：到底是「搜尋領先股價」(有 alpha，值得卡位)，
還是「股價先漲→上新聞→大家才搜」(果，照著追就是追高)？

做法：抓某代號近 90 天 Google Trends 搜尋熱度 + Yahoo 股價，
日頻對齊後算互相關(cross-correlation)：
  lag > 0 且該處相關最高 → 搜尋『領先』股價 lag 天（理想：搜尋是因）
  lag = 0 或 lag < 0 最高 → 搜尋同步或落後股價（多半是追高訊號）
並列出各自高峰日、近 30 日搜尋/股價漲幅背離與否。

用法：
  python scripts/trend_leadlag.py 2359 所羅門
  python scripts/trend_leadlag.py 2049 上銀
（第二個參數是搜尋關鍵字，省略則用代號當關鍵字——但中文名通常更準）
誠實提醒：單檔樣本、單一事件，結論僅供判讀方向，非統計顯著證明。
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:  # noqa: BLE001
    pass


def main() -> int:
    if len(sys.argv) < 2:
        print("用法：python scripts/trend_leadlag.py <代號> [搜尋關鍵字]")
        return 1
    code = sys.argv[1].strip()
    keyword = sys.argv[2].strip() if len(sys.argv) > 2 else code

    import pandas as pd
    import yfinance as yf
    from pytrends.request import TrendReq

    p = TrendReq(hl="zh-TW", tz=-480)
    try:
        p.build_payload([keyword], timeframe="today 3-m", geo="TW")
        iot = p.interest_over_time()
    except Exception as exc:  # noqa: BLE001
        print(f"[錯誤] Google Trends 取得失敗（可能被限流）：{exc}")
        return 1
    if iot is None or iot.empty or keyword not in iot.columns:
        print(f"[錯誤] 查無『{keyword}』搜尋資料")
        return 1
    if "isPartial" in iot.columns:
        iot = iot[~iot["isPartial"].astype(bool)]

    se = iot[keyword].astype(float)
    se.index = pd.to_datetime(se.index)

    px = yf.download(f"{code}.TW", period="3mo", interval="1d",
                     auto_adjust=False, progress=False)
    if px is None or px.empty:
        print(f"[錯誤] 查無 {code}.TW 股價")
        return 1
    cl = px["Close"]
    if hasattr(cl, "columns"):
        cl = cl.iloc[:, 0]
    cl.index = pd.to_datetime(cl.index).tz_localize(None)

    s = se.resample("D").mean().interpolate()
    c = cl.resample("D").mean().interpolate()
    df = pd.concat([s.rename("search"), c.rename("price")], axis=1, sort=True).dropna().tail(75)
    if len(df) < 35:
        print("[錯誤] 對齊後資料太少，無法檢定")
        return 1

    sr = (df["search"] - df["search"].mean()) / df["search"].std()
    pr = (df["price"] - df["price"].mean()) / df["price"].std()

    print(f"🔬 {code} {keyword}：搜尋 vs 股價 領先/落後檢定")
    print(f"   期間 {df.index.min().date()} → {df.index.max().date()}")
    print(f"   搜尋高峰日 {df['search'].idxmax().date()}｜股價高峰日 {df['price'].idxmax().date()}")
    s30 = round((df['search'].iloc[-1] - df['search'].iloc[-30]) / max(df['search'].iloc[-30], 1) * 100, 1)
    p30 = round((df['price'].iloc[-1] - df['price'].iloc[-30]) / df['price'].iloc[-30] * 100, 1)
    print(f"   近30日：搜尋 {s30:+}%｜股價 {p30:+}%" + ("（背離⚠）" if (s30 > 0) != (p30 > 0) else ""))

    best_lag, best_cc = 0, -9.0
    print("   互相關(正lag=搜尋領先股價)：")
    for lag in range(-10, 11):
        cc = sr.corr(pr.shift(-lag))
        if cc is not None and cc > best_cc:
            best_cc, best_lag = cc, lag
        if lag % 2 == 0:
            print(f"      lag {lag:+3d} 天：corr={cc:.2f}")

    print(f"\n   ➤ 相關最高在 lag {best_lag:+d} 天（corr={best_cc:.2f}）")
    if best_lag >= 2:
        print(f"   ✅ 搜尋『領先』股價約 {best_lag} 天 → 搜尋暴衝較可能是先行訊號（仍須其他面向佐證）")
    elif best_lag <= -2:
        print("   ⚠ 搜尋『落後』股價 → 多半是『股價先漲→才被搜』，追搜尋熱＝追高")
    else:
        print("   ⚠ 搜尋與股價幾乎同步 → 看不出領先性，搜尋暴衝難當獨立進場依據")
    return 0


if __name__ == "__main__":
    sys.exit(main())
