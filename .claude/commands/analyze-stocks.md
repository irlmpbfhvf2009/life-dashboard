---
description: 用台股投資角度對雷達榜做八面向深度分析+評分，寫出 stock-radar/public/analysis.json
---

用**台股投資角度**分析指定股票，從基本面、估值面、籌碼面、技術面、產業趨勢、事件面、預期差與風險面分析。
**不要直接叫使用者買或賣**，而是列出偏多理由、偏空理由、關鍵觀察指標，以及什麼情況下看法會轉弱。
產出格式固定（見下方 JSON schema），寫入 `stock-radar/public/analysis.json` 供網頁顯示。

## 0. 開始前：先更新資料 + 讀教訓
1. 先執行 `git pull`，取得 GitHub Actions 當天最新的 `stock-radar/public/result.json`（含 deep 深度數據）。
2. **若有 `stock-radar/LESSONS.md`（由 `/review-failures` 累積的失敗教訓）就讀它**，分析時套用這些避坑原則（例如某些訊號型態命中率低就降評、提醒風險），讓系統從過去失敗中學習、逐步提高命中率。
3. `macro`（費半/台積電ADR/那斯達克/S&P500/VIX/台股加權）數值直接讀 `stock-radar/public/market.json`（由 `market_overview.py` 每日產生）填入 schema 的 `macro` 陣列。

> 註：本流程已從獨立的 stock-radar 專案整合進此 monorepo，所有資料/腳本在 `stock-radar/` 子資料夾，每日掃描由 `.github/workflows/stock_scan.yml` 自動執行。AI 八面向分析（本指令）仍由 Claude 訂閱手動跑、不進 CI（避免付費 API）。

## 分析哪些檔（重點：跳過近期已分析，省額度）
讀 `stock-radar/public/result.json` 的 `stocks`（已依 `composite_score` 排序）。預設取**前 5 檔**為候選；
可在指令參數指定，例如 `/analyze-stocks 8` 取前 8 檔、`/analyze-stocks 2330 2454` 指定代號。

**深度分析不適合每天重做**（財報每季更新、產業趨勢以週/月計）。因此：
1. 先讀 `stock-radar/public/analysis_archive.json`，看每個候選的 `analyzed_at`。
2. **新鮮度門檻 14 天**（可在指令說「freshness 7」改天數）：
   - 距今 **< 14 天**＝仍新鮮 → **跳過，不重新分析**，直接沿用存檔內容。
   - 距今 **≥ 14 天**、或**該檔剛公布財報**、或**存檔沒有**＝ 重新分析。
3. 強制重做：指令加 `force`（例如 `/analyze-stocks 2330 force`）忽略新鮮度一律重分析。
4. 開頭先回報：「候選 N 檔，跳過 X 檔（14 天內已分析），新分析 Y 檔」。
5. `stock-radar/public/analysis.json` 的 `stocks` 要**涵蓋全部候選**（新分析的用新結果，跳過的沿用存檔），每檔都帶 `analyzed_at`，網頁才能完整顯示並標示日期/過期。

每檔 result.json 已含：技術面（價/RSI/四均線）、籌碼（外資/投信張數）、fundamentals（EPS/PE/PB/殖利率/三率/負債）、sentiment（融資增減/券資比）、industry（產業別/族群強弱/排名）。
**前 10 檔另有 `deep` 精確數據（深度數據管線預抓）**——優先用它，不用再上網挖數字：
- `deep.financials_8q`（近8季 EPS/三率/營收）+ `deep.fin_trend`（改善/持平/惡化）→ 直接餵基本面判斷
- `deep.valuation_5y`（PE 現值/5年高低/百分位 + verdict 偏低/合理/偏高）→ 直接餵估值判斷
- `deep.inst_20d`（外資/投信/自營 20日累計張數、外資連買天數、pattern 偏多/偏空/混亂）→ 直接餵籌碼判斷

優先用 `deep` 與既有數字；只有 `deep` 缺漏（非前10檔或當日抓取失敗）時，才 WebSearch/WebFetch 補，並誠實標「資料有限」。

> 建議頻率：同一檔約 **每 1～2 週**或**財報公布後**重做一次即可；快速變動的籌碼/技術/估值，免費日更管線每天已更新在卡片上。

## 每檔要做的八項分析（寫進 detail，並各給 1~5 分與判斷）

1. **基本面**：最近 8 季財報，重點看營收、EPS、毛利率、營益率、淨利率、ROE、負債比、營業現金流，判斷**改善／持平／惡化**。
2. **估值面**：目前 PE、PB、殖利率，和近 5 年歷史區間及同產業相比，判斷**偏低／合理／偏高**。
3. **籌碼面**：最近 20 日外資、投信、自營商買賣超，是否連續買超或轉賣；**搭配集保大戶籌碼（`chip` 欄：千張大戶持股比例 big1000_pct、≥400張大戶 big400_pct、小散戶 retail_pct、千張大戶週變化 big1000_chg_1w 與趨勢 trend）**——大戶持股高且週增＝籌碼集中(偏多)、散戶比例高且大戶減＝分散(偏空)。綜合判斷**偏多／偏空／混亂**。
4. **技術面**：最近 6 個月價量，趨勢、支撐壓力、均線型態、是否量價配合，列偏多與偏空訊號，判斷**多頭／盤整／空頭**。
5. **產業趨勢**：所屬產業未來 1~3 年趨勢、成長動能、競爭對手、風險，以及這家公司在產業中的位置，判斷**成長／持平／衰退**。
6. **事件面**：最近 3 個月重大新聞，分利多／利空／中性，並判斷哪些已反映在股價，判斷**有利多／無明顯催化／有風險**。
7. **預期差**：目前市場預期是什麼，最近財報/新聞有沒有超出或低於預期，股價漲跌是否預期差造成，判斷**超預期／符合預期／低於預期**。
8. **風險**：逐項檢視—客戶集中度、毛利下滑、匯率、景氣循環、庫存、競爭加劇、高估值、法人倒貨、籌碼過熱、財報不如預期、題材退燒，綜合判斷風險**低／中／高**（風險越低分數越高）。

## 評分規則（固定模板，每項 1~5 分；5＝最有利）
| 項目 | 判斷字（verdict）|
|------|------|
| 基本面 fundamental | 改善 / 持平 / 惡化 |
| 估值面 valuation | 便宜 / 合理 / 偏貴 |
| 籌碼面 chips | 偏多 / 中性 / 偏空 |
| 技術面 technical | 多頭 / 盤整 / 空頭 |
| 產業趨勢 industry | 成長 / 持平 / 衰退 |
| 事件催化 catalyst | 有利多 / 無明顯催化 / 有風險 |
| 預期差 expectation | 超預期 / 符合預期 / 低於預期 |
| 風險 risk | 低 / 中 / 高（低風險＝高分）|

`total_score` ＝ 八項加總（滿分 40）。並給：偏多理由(bull_case)、偏空理由(bear_case)、關鍵觀察指標(key_metrics)、看法轉弱條件(turn_bearish_if)。
另給 `trade_plan` 操作參考：參考買進區間(buy_zone)、參考停利(take_profit)、參考停損(stop_loss)、出場訊號(exit_signals：發生哪些狀況就考慮出場)。全部用技術面（季線/前波支撐壓力/均線）推估，明確標示「參考、非保證進出場點」。

## 專業底線
- 數字以 result.json 既有資料與你查到的公開資料為準，**不杜撰財報數字、不杜撰法人報告**；查不到就寫「資料有限」。
- 不直接建議買賣；用偏多/偏空理由與觀察指標讓使用者自行判斷。
- 每欄位務實精簡；detail 各段 2~4 句。

## 寫出 `stock-radar/public/analysis.json`（schema）
```json
{
  "updated_at": "YYYY-MM-DD HH:MM",
  "ai_enabled": true,
  "model": "<你使用的模型，例如 claude-opus-4-8（訂閱）>",
  "macro": [ {"name": "費城半導體", "value": 0, "change_pct": 0} ],
  "overview": { "international_summary": "...", "market_sentiment": "...", "short_term": "...", "mid_term": "...", "long_term": "..." },
  "stocks": [
    {
      "code": "2330", "name": "台積電",
      "analyzed_at": "2026-06-16",
      "total_score": 31,
      "scores": {
        "fundamental": {"score": 4, "verdict": "改善", "note": "EPS 連3季成長、毛利率回升"},
        "valuation":   {"score": 3, "verdict": "合理", "note": "PE 位於5年區間中段"},
        "chips":       {"score": 4, "verdict": "偏多", "note": "外資近20日連續買超"},
        "technical":   {"score": 4, "verdict": "多頭", "note": "站上所有均線、量價配合"},
        "industry":    {"score": 5, "verdict": "成長", "note": "AI 需求帶動，產業龍頭"},
        "catalyst":    {"score": 3, "verdict": "無明顯催化", "note": "利多多已反映"},
        "expectation": {"score": 3, "verdict": "符合預期", "note": "上季財報符合市場共識"},
        "risk":        {"score": 3, "verdict": "中", "note": "高估值與匯率為主要風險"}
      },
      "bull_case": ["...", "..."],
      "bear_case": ["...", "..."],
      "key_metrics": ["下季毛利率能否站穩60%", "外資是否續買"],
      "turn_bearish_if": ["跌破季線且外資轉賣", "毛利率連2季下滑"],
      "trade_plan": {
        "buy_zone": "參考買進區間，以季線/前波支撐/均線推估，標明非保證最佳點",
        "take_profit": "參考停利，以前波高點/壓力區推估",
        "stop_loss": "參考停損，明確價位或跌破哪條均線",
        "exit_signals": ["跌破季線且爆量", "外資由買轉賣連3日", "財報不如預期"]
      },
      "detail": {
        "financials": "8季財報判讀…", "valuation": "估值判讀…", "chips": "籌碼判讀…",
        "technical": "技術判讀…", "industry": "產業判讀…", "news": "新聞利多利空…",
        "expectation": "預期差判讀…", "risks": "風險逐項…"
      }
    }
  ],
  "disclaimer": "本分析由 AI 自動產生，僅供參考，不構成投資建議。請自行評估風險、設好停損、只用閒錢。"
}
```

## 收尾（自動更新網站）
1. 把本次每檔（加 `analyzed_at`＝今日）合併進 `stock-radar/public/analysis_archive.json` 的 `stocks`（以 code 為鍵，保留最新）。
2. **自動推上線**：執行 `git add stock-radar/public/analysis.json stock-radar/public/analysis_archive.json && git commit -m "AI 八面向分析 <日期>：<代號清單>" && git push`。若 push 被拒（遠端有更新），先 `git pull --rebase` 再 push。
3. 完成後回報：分析了哪幾檔、跳過哪幾檔、總評分數。

> 📌 此專案的前端（Personal Intelligence Studio）在執行階段直接從 GitHub raw 讀取
> `stock-radar/public/*.json`，所以**只要 push 成功，網站約 1 分鐘內自動顯示新分析，
> 不需要重新部署前端**（前端是 prebuilt 部署，資料更新與前端部署解耦）。
> 線上頁面：AI 實驗室 → AI 股票研究 → 今日 AI 精選。
