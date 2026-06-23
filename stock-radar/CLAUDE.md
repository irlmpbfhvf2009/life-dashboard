# 潛力股戰情室 — 專案交接

台股量化選股 + AI 八面向深度分析 + 命中率追蹤的網站。全程免費資源：GitHub Actions 排程、Vercel 靜態託管、TWSE/Yahoo/FinMind 取數，AI 分析用 Claude 訂閱（不走付費 API）。

線上：Vercel（push 到 main 自動部署）。Repo：irlmpbfhvf2009/stock-radar。

## 目前進度（2026-06-16 交接）

**全部功能已上線、跑通、驗證過**：選股 → 基本面/估值 → 深度數據(8季/5年/20日) → 多因子評分 → 資金面 → 產業 → 命中率(多視窗+期望值+0050基準) → AI 八面向分析 → 失敗檢討學習迴圈。前端：戰績儀表板(可展開看正在統計的個股)、今日精選、預判追蹤紀錄、完整清單、K線(懸停看價+圖例切換月/季/年線)。

**已驗證**：FinMind(fundamentals+deep)正常、AI 分析跑過一次(6/16：宏璟/南亞科/宏碁/臻鼎)、前端各功能 preview 過。

**待觀察/辦（多數是等資料累積）**：
- 命中率/期望值/0050基準/「正在統計」清單：要等 Actions 每日跑 + **樣本到期**才有真實數字（5日約一週、20日約一個月，現顯示「累積中」屬正常）。
- `deepdata.py` 順序剛修正（移到評分後）→ 確認**下次 Actions** 跑完，綜合分前 10 檔都有 `deep`（之前因順序錯，前10名有些缺）。
- `/review-failures`：要等已到期失敗樣本 ≥20 筆（約 2026-07 月底）才有料，現在跑會回「樣本累積中」。

**新 session 的主要工作**：平日 16:00 後（Actions 跑完）`/analyze-stocks` 更新分析；每月一次 `/review-failures` 累積教訓。

## 兩速架構（核心觀念）

| 層級 | 頻率 | 內容 | 成本 |
|------|------|------|------|
| **快速層**（GitHub Actions，全免費）| 每平日 15:40 自動 | 選股/基本面/估值/深度數據/評分/資金面/產業/命中率 | 0 |
| **深度層**（本機手動，吃 Max 訂閱）| 每檔約 1-2 週一次 | AI 八面向分析+評分 | 低 |

深度分析**不適合每天**（財報每季、產業以週月計）；快速變動的籌碼/技術已由快速層每天更新在卡片。

## 免費日更管線（7 步，scripts/）

```
market_overview.py（美股/費半/VIX/台積電ADR/台股加權收盤指數 → market.json，盤前盤後國際盤）
scan.py（選股·技術+籌碼+相對強弱RS）→ fundamentals.py（基本面/估值·FinMind）
→ composite_score.py（四支柱加權評分+基本面軟門檻）→ sentiment.py（融資融券）
→ industry.py（產業族群強弱）→ deepdata.py（8季財報/5年估值/20日法人·前10檔）
→ chip_dispersion.py（集保大戶籌碼：千張大戶持股%＋週趨勢，TDCC 官方免費，併入 result.json 各檔 chip 欄）
→ track.py（量化雷達命中率多視窗 5/10/20 日 + 期望值 + 0050 基準）
→ ai_track.py（只追『AI 看好標的』total_score≥28 的命中率 → ai_performance.json）
```
集保大戶資料來自 TDCC opendata(id=1-5)，每週更新，趨勢需累積週歷史(chip_history.json)；用 verify=False(TDCC 憑證鏈問題、僅公開資料)。AI 籌碼面已納入大戶趨勢判斷，前端卡片顯示千張大戶%/散戶%/集中分散。
輸出 `public/*.json`：result.json（雷達榜含全部數據）、performance.json（量化命中率）、ai_performance.json（AI 選股命中率）、universe.json、fundamentals.json、picks_history.json。

**前端目前以「AI 玩股票」為主軸**：首頁戰績/預判追蹤紀錄讀 `ai_performance.json`（只顯示 AI 看好標的＋AI評分＋進場/目前/命中）；量化全榜的 performance.json 仍每日產出、暫未在頁面主秀。

## 這個 session 的主要工作：手動跑 AI 分析

**一個指令搞定**（已含 git pull → 分析 → commit/push）：
```
/analyze-stocks          # 前 5 檔（自動跳過 14 天內已分析）
/analyze-stocks 8        # 前 8 檔
/analyze-stocks 2330 2454  # 指定代號
/analyze-stocks 3 force  # 前 3 檔強制重分析
```
指令定義在 `.claude/commands/analyze-stocks.md`（八面向框架+評分模板+schema）。產出 `public/analysis.json`、併入 `public/analysis_archive.json`。

**何時跑**：平日收盤後、Actions 跑完（約 16:00 後）。**頻率**：每週 1-2 次，或雷達榜出現新面孔、財報季時。14 天 freshness 自動跳過已分析的，額度不吃緊。

## 失敗檢討學習迴圈（提高命中率）

- **存證**：track.py 每次選股把決策訊號（composite/breakdown/rsi/法人/pe/fin_trend/估值位階/籌碼型態/產業）凍結進 `picks_history.json` 的 `signals`。
- **檢討**：`/review-failures` 指令——AI 讀「失敗預測 + 當初訊號 + 實際結果」，找命中率偏低的訊號模式，提改善建議，寫 `public/review.json` + 累積教訓到 `LESSONS.md`。需已到期樣本 ≥20 筆才有料（約 2-4 週後）。
- **回饋**：`/analyze-stocks` 每次先讀 `LESSONS.md` 套用避坑原則。嚴重模式可調 composite_score 權重（env `SCORE_PROFILE` 或改權重）或加選股過濾。

## 注意力面向實驗（Google Trends，本機手動層）

驗證「搜尋熱度領先官方統計/法人報告」的另類數據假說。**刻意不進免費 CI**（Google Trends 無官方免費 API，Actions 機房 IP 易被限流 429；本機住宅 IP 容忍度高）。

```
python scripts/trends.py        # 全榜抓注意力動能
python scripts/trends.py 8      # 只跑前 8 檔
```
- 算法：近 7 天搜尋熱度 vs 前 ~8 週基準 → `momentum_pct`(升溫幅度) + `z`(爆量程度)；判 爆量關注🔥/升溫/持平/降溫。需 `pip install pytrends`。
- 關鍵字預設用股票中文名，可在 `public/trends_keywords.json`（`{"3035":"智原"}`）覆寫。
- **產出**：併入 result.json 各檔 `attention` 欄、時間序列存 `trends_history.json`，並**回填**當日 picks_history 的 `signals.attn_mom/attn_trend`（因 CI 的 track.py 凍結選股時還沒 attention，故 trends.py 算完主動回填，讓命中率追蹤能事後驗證）。
- **何時跑**：平日 Actions 跑完後（result.json 已更新），跟 analyze-stocks 一起手動跑。**這是實驗訊號，不加進 composite 評分**——先靠 track.py/review-failures 累積樣本，看「升溫/爆量」到底有沒有預測力，有效再考慮納入。
- 注意 z 分數會壓掉「低基期假動能」（如 momentum +200% 但 z<0.5 多是雜訊）；同批(≤5字)內絕對值才可比，本腳本只用各字自身時序變化，不跨檔比。

**由下而上找題材（兩支配套工具）**：
- `python scripts/trend_themes.py`：掃一批策展投資題材關鍵字（AI/機器人/風電/矽光子/缺水/颱風/洪水…）的搜尋動能+z，排出「最近在升溫的題材」+各題材飆升關聯字，寫 `public/trend_themes.json`。種子可由 `public/trend_themes_seed.json` 覆寫。用來找「搜尋先燒、還沒反映到股價」的題材，再人工對應台股受惠股。
- `python scripts/trend_leadlag.py <代號> [關鍵字]`：對單一個股做「搜尋 vs 股價」互相關檢定，判斷是『搜尋領先股價』(有 alpha) 還是『股價先漲才被搜』(追高)。lag>0 且相關最高=搜尋領先。實測經驗：多數個股搜尋同步或落後股價，務必先驗證再進場。
- ⚠ Google 每日/即時熱搜端點已被廢(pytrends 取回 404)，故 trend_themes 改用「策展種子詞動能 + rising related queries」，非真正的全網熱搜榜。

## 前端 index.html（戰情室版面）

戰績（多視窗命中率）→ AI 國際總覽 → 今日精選（已分析股，完整卡+K線+八面向）→ 預判追蹤紀錄（表格）→ 完整雷達清單（收合）→ 我的追蹤。K 線支援懸停看價、圖例點擊切換月/季/年線。

## 注意事項（重要）

- **AI 分析吃 Max 訂閱、不需要 API key**；深度數據 Actions 已抓進 result.json，本機只 pull 來判讀。
- **不要把 `analyze_ai.py` 加回 GitHub Actions**——那會需要付費 ANTHROPIC_API_KEY。CI 維持全免費。
- `FINMIND_TOKEN` 是 GitHub Secret（CI 用，免費註冊）；本機不需要。
- 改任何程式碼後要 `git push` 才會上線（Vercel 自動部署）；資料 JSON 同理。
- **命中率**：需樣本到期才有數字（5 日視窗約一週、20 日約一個月），未到期顯示「累積中」屬正常，勿誤判為壞掉。
- AI 分析**只給判斷、不直接叫買賣**（偏多/偏空理由、操作參考、看法轉弱條件）；措辭誠實、不杜撰財報與法人數字。
- 推送若被拒（Actions 剛推過）：`git pull --rebase` 後再 push；result.json 衝突取遠端（較新）。

## 九維度覆蓋

一基本面/三估值（fundamentals+deep）、二產業（industry）、四籌碼（scan+deep+sentiment）、五技術（scan）、六總經（AI）、七事件+九預期差（AI）、八情緒資金（sentiment）。
