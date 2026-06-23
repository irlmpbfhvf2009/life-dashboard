#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
潛力股波段雷達 - AI 金融分析師
======================================
讀取 scan.py 產生的 public/result.json（已依潛力分數排序的潛力股），
取「分數最高的前 N 檔」交給 Claude 做波段分析，蒐集：
  1. 國際盤氛圍與重大事件（指標 + 個股新聞）
  2. 個股法人買賣超（外資/投信，已在 result.json 內）
  3. 個股分析師目標價（若公開資料有）
產出每檔：潛力評分、短/中/長期、參考買進區間、參考停利、參考停損、
事件影響、法人動向、風險。輸出 public/analysis.json。

設計原則：
- 沒有 ANTHROPIC_API_KEY 優雅跳過；沒有潛力股也輸出空分析。
- 任何資料蒐集失敗都不中斷主流程。
- 措辭誠實：給「參考區間」與「觀察訊號」，不假裝預測最佳買賣點；
  分析師目標價只在有資料時引用，不杜撰來源。
"""

from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional

import yfinance as yf
from pydantic import BaseModel, Field

try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:  # noqa: BLE001
    pass

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
PUBLIC_DIR = PROJECT_ROOT / "public"
RESULT_FILE = PUBLIC_DIR / "result.json"
ANALYSIS_FILE = PUBLIC_DIR / "analysis.json"
ARCHIVE_FILE = PUBLIC_DIR / "analysis_archive.json"  # AI 分析存檔（分析過的股票不消失）

TW_TZ = timezone(timedelta(hours=8))

MODEL = "claude-opus-4-8"
AI_MAX_STOCKS = int(os.environ.get("AI_MAX_STOCKS", "3"))

DISCLAIMER = "本分析由 AI 自動產生，僅供參考，不構成投資建議。買進/停利/停損為技術面觀察參考，非保證進出場點；投資請自行評估風險、設好停損、只用閒錢。"

MACRO_TICKERS: dict[str, str] = {
    "^TWII": "台股加權指數",
    "^GSPC": "美股標普500",
    "^IXIC": "那斯達克",
    "^SOX": "費城半導體",
    "^DJI": "道瓊工業",
    "^VIX": "VIX恐慌指數",
    "^TNX": "美債10年殖利率",
    "TWD=X": "美元兌台幣",
    "CL=F": "西德州原油",
    "GC=F": "黃金",
}


# --------------------------------------------------------------------------- #
# 結構化輸出 Schema
# --------------------------------------------------------------------------- #
class StockAnalysis(BaseModel):
    code: str = Field(description="股票代號")
    name: str = Field(description="股票名稱")
    potential_score: int = Field(description="AI 綜合潛力評分，0~10 整數（趨勢+籌碼+題材綜合）")
    short_term: str = Field(description="短期（約 1 個月波段）看法與動能判讀")
    mid_term: str = Field(description="中期（1~3 個月）看法")
    long_term: str = Field(description="長期看法與產業面（看錯時可否中長期持有的安全網判斷）")
    buy_zone: str = Field(description="參考買進區間，以季線/前波支撐/均線推估，給區間，並註明非保證最佳點")
    take_profit: str = Field(description="參考停利區間，以前波高點/壓力區推估")
    stop_loss: str = Field(description="參考停損，明確價位或跌破哪條均線，用於控制風險")
    event_impact: str = Field(description="近期國際/重大事件對此股的影響（受惠或受壓）")
    institutional_view: str = Field(description="法人動向解讀（外資/投信買賣超意涵），以提供的數據為準")
    expectation_gap: str = Field(description="預期差判讀：股價反映的是預期而非事實。判斷近期利多/題材是否已被市場 price in、法說或財報展望有無上修、利空是否出盡；點出是『買在預期、順勢』還是『利多出盡、搶反彈』的風險")
    risks: str = Field(description="主要風險與下檔觀察點")


class MarketOverview(BaseModel):
    international_summary: str = Field(description="影響台股的國際情勢與重大事件摘要（升降息、地緣政治、科技財報、原物料等），結合提供的國際指標")
    market_sentiment: str = Field(description="今日台股氛圍：偏多/偏空/中性，並說明理由")
    short_term: str = Field(description="大盤短期看法")
    mid_term: str = Field(description="大盤中期看法")
    long_term: str = Field(description="大盤長期看法")


class AnalysisResult(BaseModel):
    overview: MarketOverview
    stocks: list[StockAnalysis]


# --------------------------------------------------------------------------- #
# 資料蒐集
# --------------------------------------------------------------------------- #
def fetch_macro_snapshot() -> list[dict]:
    snapshot: list[dict] = []
    try:
        data = yf.download(
            list(MACRO_TICKERS.keys()), period="5d", interval="1d",
            auto_adjust=False, group_by="ticker", threads=True, progress=False,
        )
    except Exception as exc:  # noqa: BLE001
        print(f"[警告] 國際指標下載失敗：{exc}")
        return snapshot

    is_multi = hasattr(data, "columns") and hasattr(data.columns, "levels")
    for ticker, name in MACRO_TICKERS.items():
        try:
            sub = data[ticker] if is_multi else data
            closes = sub["Close"].dropna()
            if len(closes) < 2:
                continue
            last = float(closes.iloc[-1]); prev = float(closes.iloc[-2])
            if prev == 0:
                continue
            snapshot.append({
                "name": name,
                "value": round(last, 2),
                "change_pct": round((last - prev) / prev * 100.0, 2),
            })
        except Exception:  # noqa: BLE001
            continue
    return snapshot


def fetch_stock_news(code: str, limit: int = 5) -> list[str]:
    titles: list[str] = []
    try:
        raw = yf.Ticker(f"{code}.TW").news or []
    except Exception:  # noqa: BLE001
        return titles
    for item in raw[: limit * 2]:
        try:
            title = None
            content = item.get("content") if isinstance(item, dict) else None
            if isinstance(content, dict):
                title = content.get("title")
            if not title and isinstance(item, dict):
                title = item.get("title")
            if title:
                title = str(title).strip()
                if title and title not in titles:
                    titles.append(title)
            if len(titles) >= limit:
                break
        except Exception:  # noqa: BLE001
            continue
    return titles


def fetch_analyst_target(code: str) -> Optional[dict]:
    try:
        ticker = yf.Ticker(f"{code}.TW")
        try:
            tp = ticker.analyst_price_targets
        except Exception:  # noqa: BLE001
            tp = None
        if isinstance(tp, dict) and tp.get("mean"):
            return {"mean": tp.get("mean"), "low": tp.get("low"),
                    "high": tp.get("high"), "current": tp.get("current")}
        info = ticker.info if hasattr(ticker, "info") else {}
        mean = info.get("targetMeanPrice")
        if mean:
            return {"mean": mean, "low": info.get("targetLowPrice"),
                    "high": info.get("targetHighPrice"), "current": info.get("currentPrice")}
    except Exception:  # noqa: BLE001
        return None
    return None


# --------------------------------------------------------------------------- #
# Claude 分析
# --------------------------------------------------------------------------- #
SYSTEM_PROMPT = """你是一位資深台股金融分析師，專長技術分析、籌碼面（三大法人）與國際總經連動，服務對象是「想抱約 1 個月波段、看錯時若公司體質好可轉中長期持有」的投資人。

你會收到「國際指標」、以及「一批已通過長多趨勢篩選的潛力股」（含技術指標、四條均線、外資/投信買賣超、最新新聞、若有的分析師目標價）。

請以繁體中文，務實、誠實地分析：
1. 先判斷影響台股的國際情勢與重大事件（升降息、地緣政治/戰爭、科技財報、原物料、匯率），結合國際指標數據，給大盤短/中/長期看法與今日氛圍。
2. 針對每一檔，給：
   - potential_score：0~10 綜合潛力評分（趨勢+籌碼+題材）
   - 短期(約1個月)/中期/長期看法
   - 參考買進區間、參考停利區間、參考停損
   - 事件影響、法人動向解讀、預期差、風險
3. 「預期差」是專業重點：股價反映的是「預期」不是「事實」。請依我提供的新聞與題材，判讀利多是否已被 price in、展望有無上修、利空是否出盡，明白點出是「買在預期（順勢）」還是「利多出盡（搶反彈）」——沒有足夠新聞時就說明資訊有限、保守看待，不杜撰事件。

嚴格要求（專業底線）：
- 買進/停利/停損都用技術面（季線、前波支撐/壓力、均線）推估，給合理區間或明確價位，並強調是「參考」，不要假裝能精準預測最佳買賣點。
- 法人動向只依我提供的外資/投信買賣超數字解讀（正值=買超、負值=賣超），不要編造。
- 分析師目標價只在我提供時引用，標明「市場分析師彙整目標價」；沒提供就寫「無公開分析師資料」，絕不杜撰任何法人（如大摩）報告。
- 每檔都要點出風險，不要一面倒看多。
- 語氣專業精簡，每個欄位 1~3 句。
"""


def run_ai_analysis(client, macro, ai_stocks, enriched) -> Optional[AnalysisResult]:
    stocks_payload = []
    for s in ai_stocks:
        code = s.get("code", "")
        stocks_payload.append({
            "code": code, "name": s.get("name"), "price": s.get("price"),
            "change_pct": s.get("change_pct"), "rsi": s.get("rsi"),
            "ma5": s.get("ma5"), "ma20": s.get("ma20"),
            "ma60_季線": s.get("ma60"), "ma240_年線": s.get("ma240"),
            "外資買賣超_張": s.get("foreign_lots"),
            "投信買賣超_張": s.get("trust_lots"),
            "綜合分": s.get("composite_score"),
            "融資增減_pct": (s.get("sentiment") or {}).get("margin_change_pct"),
            "券資比_pct": (s.get("sentiment") or {}).get("short_margin_ratio"),
            "news": enriched.get(code, {}).get("news", []),
            "analyst_target": enriched.get(code, {}).get("analyst_target"),
        })

    user_payload = {
        "date": datetime.now(TW_TZ).strftime("%Y-%m-%d"),
        "international_indicators": macro,
        "candidate_stocks": stocks_payload,
    }
    user_text = (
        "以下為今日資料（JSON）。請依系統指示產出結構化波段分析，"
        "stocks 需涵蓋且只涵蓋我提供的每一檔：\n\n"
        + json.dumps(user_payload, ensure_ascii=False, indent=2)
    )

    try:
        response = client.messages.parse(
            model=MODEL, max_tokens=16000,
            thinking={"type": "adaptive"},
            output_config={"effort": "high"},
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_text}],
            output_format=AnalysisResult,
        )
    except Exception as exc:  # noqa: BLE001
        print(f"[錯誤] Claude 分析失敗：{exc}")
        return None

    if response.parsed_output is None:
        print(f"[錯誤] 結構化輸出解析失敗，stop_reason={response.stop_reason}")
        return None
    return response.parsed_output


# --------------------------------------------------------------------------- #
# 輸出
# --------------------------------------------------------------------------- #
def write_analysis(payload: dict) -> None:
    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
    with ANALYSIS_FILE.open("w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    print(f"✅ 已寫出 {ANALYSIS_FILE}")


def update_archive(stocks: list[dict]) -> None:
    """把本次 AI 分析併入存檔（每檔保留最新一次，標註分析日期），讓分析過的股票不消失。"""
    archive = {"stocks": {}}
    if ARCHIVE_FILE.exists():
        try:
            with ARCHIVE_FILE.open("r", encoding="utf-8") as f:
                old = json.load(f)
            if isinstance(old, dict) and isinstance(old.get("stocks"), dict):
                archive = old
        except Exception:  # noqa: BLE001
            pass
    today = datetime.now(TW_TZ).strftime("%Y-%m-%d")
    for s in stocks:
        code = s.get("code")
        if not code:
            continue
        entry = dict(s)
        entry["analyzed_at"] = today
        archive["stocks"][code] = entry
    archive["updated_at"] = datetime.now(TW_TZ).strftime("%Y-%m-%d %H:%M")
    try:
        with ARCHIVE_FILE.open("w", encoding="utf-8") as f:
            json.dump(archive, f, ensure_ascii=False, indent=2)
        print(f"🗄 已更新 AI 分析存檔，累計 {len(archive['stocks'])} 檔")
    except Exception as exc:  # noqa: BLE001
        print(f"[警告] 更新分析存檔失敗：{exc}")


def write_disabled(reason: str) -> None:
    write_analysis({
        "updated_at": datetime.now(TW_TZ).strftime("%Y-%m-%d %H:%M"),
        "ai_enabled": False, "reason": reason,
        "overview": None, "stocks": [], "disclaimer": DISCLAIMER,
    })


# --------------------------------------------------------------------------- #
# 主流程
# --------------------------------------------------------------------------- #
def main() -> int:
    print(f"🤖 AI 波段分析開始 … {datetime.now(TW_TZ):%Y-%m-%d %H:%M:%S}")

    if not os.environ.get("ANTHROPIC_API_KEY"):
        print("[略過] 未設定 ANTHROPIC_API_KEY")
        write_disabled("未設定 ANTHROPIC_API_KEY")
        return 0

    try:
        with RESULT_FILE.open("r", encoding="utf-8") as f:
            result = json.load(f)
        stocks = result.get("stocks", []) if isinstance(result, dict) else []
    except Exception as exc:  # noqa: BLE001
        print(f"[錯誤] 讀取 result.json 失敗：{exc}")
        write_disabled("讀取 result.json 失敗")
        return 0

    if not stocks:
        print("今日無潛力股，輸出空分析")
        write_disabled("今日無符合條件的潛力股")
        return 0

    # result.json 已依潛力分數排序，直接取前 N 檔
    ai_stocks = stocks[:AI_MAX_STOCKS]
    print(f"🎯 全部潛力股 {len(stocks)} 檔，AI 深入分析分數最高的前 {len(ai_stocks)} 檔")

    print("📡 蒐集國際指標 …")
    macro = fetch_macro_snapshot()

    print("📰 蒐集個股新聞與分析師目標價 …")
    enriched: dict[str, dict] = {}
    for s in ai_stocks:
        code = s.get("code", "")
        if not code:
            continue
        enriched[code] = {
            "news": fetch_stock_news(code),
            "analyst_target": fetch_analyst_target(code),
        }

    print("🧠 呼叫 Claude 進行波段分析 …")
    try:
        import anthropic
        client = anthropic.Anthropic()
    except Exception as exc:  # noqa: BLE001
        print(f"[錯誤] 初始化 anthropic 失敗：{exc}")
        write_disabled("anthropic SDK 初始化失敗")
        return 0

    analysis = run_ai_analysis(client, macro, ai_stocks, enriched)
    if analysis is None:
        write_disabled("AI 分析失敗")
        return 0

    analyzed = [s.model_dump() for s in analysis.stocks]
    payload = {
        "updated_at": datetime.now(TW_TZ).strftime("%Y-%m-%d %H:%M"),
        "ai_enabled": True, "model": MODEL,
        "macro": macro,
        "overview": analysis.overview.model_dump(),
        "stocks": analyzed,
        "disclaimer": DISCLAIMER,
    }
    write_analysis(payload)
    update_archive(analyzed)  # 併入存檔，讓分析過的股票不消失
    print(f"✅ 完成，共分析 {len(analyzed)} 檔")
    return 0


if __name__ == "__main__":
    sys.exit(main())
