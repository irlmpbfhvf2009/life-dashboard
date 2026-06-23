#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
潛力股戰情室 - 多因子綜合評分
======================================
把四根支柱合成一個 0~100 綜合分數，並重新排序雷達榜：
  籌碼面(四)：外資買超、投信買超
  技術面(五)：多頭排列趨勢、量比、RSI 甜蜜帶、相對強弱 RS(強於大盤加分)
  基本面(一)：ROE、毛利率、EPS 正、負債比(越低越好)
  估值面(三)：本益比(越低越好)、殖利率、股價淨值比(越低越好)

每根支柱內各分項在「本批雷達股」內做 min-max 正規化(0~1)，
支柱分 = 各分項平均；綜合分 = Σ(支柱分 × 權重) × 100。

另套用「基本面軟門檻」(quality_adjust)：體質不佳者(EPS<=0、淨利率<0、
財報惡化、負債>80%)乘上懲罰係數壓低綜合分，避免技術漂亮但體質爛的假飆股排前面；
懲罰係數與旗標寫進 score_breakdown 的 quality_penalty / quality_flags 供前端標示。

權重設定檔（環境變數 SCORE_PROFILE 切換，預設 balanced）：
  balanced 均衡：籌碼.30 技術.25 基本.25 估值.20
  swing    波段：籌碼.40 技術.35 基本.15 估值.10
  value    價值：籌碼.15 技術.20 基本.35 估值.30

設計原則：
- 基本面/估值資料缺漏 → 該分項給中性 0.5（沒 FinMind 時自動退化成籌碼+技術排序）。
- 讀寫 result.json；保留原 score(技術+籌碼)，新增 composite_score 與 score_breakdown。
- 在 fundamentals.py 之後、analyze_ai.py 之前執行，讓 AI 分析綜合分最高的前幾檔。
"""

from __future__ import annotations

import json
import math
import os
import sys
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
RESULT_FILE = PROJECT_ROOT / "public" / "result.json"

TW_TZ = timezone(timedelta(hours=8))

# 權重設定檔：[籌碼, 技術, 基本面, 估值]
PROFILES = {
    "balanced": (0.30, 0.25, 0.25, 0.20),
    "swing":    (0.40, 0.35, 0.15, 0.10),
    "value":    (0.15, 0.20, 0.35, 0.30),
}
PROFILE = os.environ.get("SCORE_PROFILE", "balanced").strip().lower()
W_CHIPS, W_TECH, W_BASIC, W_VALUE = PROFILES.get(PROFILE, PROFILES["balanced"])


def safe_float(value) -> Optional[float]:
    try:
        f = float(value)
    except (TypeError, ValueError):
        return None
    if math.isnan(f) or math.isinf(f):
        return None
    return f


def normalize(vals: list[Optional[float]], higher_better: bool = True) -> list[float]:
    """min-max 正規化到 0~1；None→中性 0.5；全相同→0.5。"""
    present = [v for v in vals if v is not None]
    if not present:
        return [0.5] * len(vals)
    lo, hi = min(present), max(present)
    out: list[float] = []
    for v in vals:
        if v is None or hi - lo < 1e-9:
            out.append(0.5)
            continue
        x = (v - lo) / (hi - lo)
        out.append(x if higher_better else 1.0 - x)
    return out


def avg(cols: list[list[float]], i: int) -> float:
    """取第 i 檔在多個分項欄位的平均。"""
    return round(sum(col[i] for col in cols) / len(cols), 4)


def recompute_trend(s: dict) -> Optional[float]:
    """由價格與四均線重建多頭排列程度 0~1（scan.py 已把 _trend 移除）。"""
    price = safe_float(s.get("price"))
    ma5, ma20, ma60, ma240 = (safe_float(s.get(k)) for k in ("ma5", "ma20", "ma60", "ma240"))
    if None in (price, ma5, ma20, ma60):
        return None
    comps = [price > ma5, ma5 > ma20, ma20 > ma60]
    if ma240 is not None:
        comps.append(ma60 > ma240)
    return sum(comps) / len(comps)


def rsi_sweet(s: dict) -> Optional[float]:
    """RSI 甜蜜帶：~60 最佳，過熱(>70)或過弱遞減，回傳 0~1。"""
    r = safe_float(s.get("rsi"))
    if r is None:
        return None
    return max(0.0, 1.0 - abs(r - 60.0) / 40.0)


def fund_get(s: dict, key: str) -> Optional[float]:
    f = s.get("fundamentals")
    if not isinstance(f, dict):
        return None
    return safe_float(f.get(key))


def pe_value_metric(s: dict) -> Optional[float]:
    """本益比轉估值分原始值：虧損(PE<=0)給極差，正值越低越好（取負號讓 higher_better 成立）。"""
    pe = fund_get(s, "pe")
    if pe is None:
        return None
    if pe <= 0:
        return -9999.0  # 虧損→估值最差
    return -pe          # 越低越好 → 取負


def quality_adjust(s: dict) -> tuple[float, list[str]]:
    """基本面軟門檻：對體質不佳者套用懲罰係數(<1)壓低綜合分，避免『技術漂亮、體質爛』
    的假飆股排前面。回傳 (係數, 旗標清單)。資料缺漏不罰（從寬，係數=1）。
      EPS<=0(虧損)         × 0.75
      淨利率<0             × 0.85
      deep.fin_trend=惡化  × 0.88（僅前 N 檔有 deep）
      負債比>80%           × 0.92
    多項可疊乘。"""
    f = s.get("fundamentals") if isinstance(s.get("fundamentals"), dict) else {}
    deep = s.get("deep") if isinstance(s.get("deep"), dict) else {}
    pen = 1.0
    flags: list[str] = []

    eps = safe_float(f.get("eps"))
    if eps is not None and eps <= 0:
        pen *= 0.75
        flags.append("EPS為負")
    nm = safe_float(f.get("net_margin"))
    if nm is not None and nm < 0:
        pen *= 0.85
        flags.append("淨利率為負")
    if deep.get("fin_trend") == "惡化":
        pen *= 0.88
        flags.append("財報惡化")
    debt = safe_float(f.get("debt_ratio"))
    if debt is not None and debt > 80:
        pen *= 0.92
        flags.append("負債偏高")
    return round(pen, 3), flags


# --------------------------------------------------------------------------- #
# 主流程
# --------------------------------------------------------------------------- #
def main() -> int:
    print(f"🧮 多因子綜合評分開始（設定檔 {PROFILE}）… {datetime.now(TW_TZ):%Y-%m-%d %H:%M:%S}")
    print(f"   權重 → 籌碼{W_CHIPS} 技術{W_TECH} 基本{W_BASIC} 估值{W_VALUE}")

    try:
        with RESULT_FILE.open("r", encoding="utf-8") as f:
            result = json.load(f)
        stocks = result.get("stocks", []) if isinstance(result, dict) else []
    except Exception as exc:  # noqa: BLE001
        print(f"[錯誤] 讀取 result.json 失敗：{exc}")
        return 0

    n = len(stocks)
    if n == 0:
        print("雷達榜為空，無需評分")
        return 0

    # ---- 各分項原始值 → 正規化 ----
    # 籌碼
    chips = [
        normalize([safe_float(s.get("foreign_lots")) for s in stocks], True),
        normalize([safe_float(s.get("trust_lots")) for s in stocks], True),
    ]
    # 技術（trend / rsi 甜蜜帶本就 0~1，量比與相對強弱 RS 正規化）
    tech = [
        [recompute_trend(s) if recompute_trend(s) is not None else 0.5 for s in stocks],
        [rsi_sweet(s) if rsi_sweet(s) is not None else 0.5 for s in stocks],
        normalize([safe_float(s.get("volume_ratio")) for s in stocks], True),
        normalize([safe_float(s.get("rs_60d")) for s in stocks], True),  # 相對強弱（強於大盤加分）
    ]
    # 基本面
    basic = [
        normalize([fund_get(s, "roe_approx") for s in stocks], True),
        normalize([fund_get(s, "gross_margin") for s in stocks], True),
        normalize([fund_get(s, "debt_ratio") for s in stocks], False),  # 越低越好
        [1.0 if (fund_get(s, "eps") or 0) > 0 else (0.5 if fund_get(s, "eps") is None else 0.0)
         for s in stocks],
    ]
    # 估值
    value = [
        normalize([pe_value_metric(s) for s in stocks], True),           # 已轉成越大越好
        normalize([fund_get(s, "dividend_yield") for s in stocks], True),
        normalize([fund_get(s, "pb") for s in stocks], False),           # 越低越好
    ]

    has_fund = sum(1 for s in stocks if isinstance(s.get("fundamentals"), dict))

    for i, s in enumerate(stocks):
        p_chips = avg(chips, i)
        p_tech = avg(tech, i)
        p_basic = avg(basic, i)
        p_value = avg(value, i)
        composite = (W_CHIPS * p_chips + W_TECH * p_tech
                     + W_BASIC * p_basic + W_VALUE * p_value) * 100.0
        # 基本面軟門檻：體質不佳者乘上懲罰係數，壓低排名
        penalty, flags = quality_adjust(s)
        composite *= penalty
        s["composite_score"] = round(composite, 1)
        s["score_breakdown"] = {
            "chips": round(p_chips * 100, 1),
            "tech": round(p_tech * 100, 1),
            "basic": round(p_basic * 100, 1),
            "value": round(p_value * 100, 1),
            "quality_penalty": penalty,
            "quality_flags": flags,
            "profile": PROFILE,
        }

    # ---- 依綜合分重新排序 ----
    stocks.sort(key=lambda s: s.get("composite_score", 0), reverse=True)
    result["stocks"] = stocks
    result["score_profile"] = PROFILE

    try:
        with RESULT_FILE.open("w", encoding="utf-8") as f:
            json.dump(result, f, ensure_ascii=False, indent=2)
        print(f"✅ 已重算綜合分並重排 {n} 檔（{has_fund} 檔有基本面）→ {RESULT_FILE}")
    except Exception as exc:  # noqa: BLE001
        print(f"[錯誤] 寫回 result.json 失敗：{exc}")
        return 1

    top = stocks[0]
    b = top.get("score_breakdown", {})
    print(f"🏆 綜合分最高：{top.get('code')} {top.get('name')} "
          f"{top.get('composite_score')}分（籌碼{b.get('chips')}/技術{b.get('tech')}/"
          f"基本{b.get('basic')}/估值{b.get('value')}）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
