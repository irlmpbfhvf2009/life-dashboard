---
description: AI 檢討失敗的預測，找出共同模式、提改善建議，累積教訓提高命中率
---

從「失敗的預測」中學習，提高未來命中率。讀歷史選股的決策訊號 + 實際結果，由 AI 分析為什麼失敗、找共同模式、提具體改善，並把教訓寫進 `stock-radar/LESSONS.md` 供日後選股/分析參考。

## 0. 先更新資料
`git pull` 取得最新 `performance.json`、`picks_history.json`、`analysis_archive.json`。

## 1. 找出失敗與成功樣本
讀 `stock-radar/public/performance.json`（多視窗命中率，含 `detail` 每檔每視窗 status/max_return_pct）與 `stock-radar/public/picks_history.json`（每檔的 `signals` 決策訊號：composite/breakdown/rsi/foreign_lots/trust_lots/pe/fin_trend/val5y/inst20d/industry/margin_chg）。

- **失敗（落空）**：某視窗 `status=miss`（已到期且未達標），尤其 `last_return_pct` 為負的（不只沒漲、還跌）。
- **成功（命中）**：`status=hit`。
- 以 **20 日視窗**為主，5/10 日輔助。
- **樣本不足**（已到期樣本 < 20 筆）→ 直接回報「樣本累積中，暫無足夠資料檢討」，不要硬掰，結束。

## 2. 分析（AI 重點）
1. **逐檔失敗主因**：把每檔失敗的 `signals` 與結果對照，判斷最可能的失敗原因（例：追高乖離過大、PE 位於 5 年高位、外資其實在賣、財報趨勢惡化、籌碼混亂、題材退燒、產業弱勢…）。對有 `analysis_archive` AI 分析的，比對當初的偏多理由哪裡錯了。
2. **找共同模式（最重要）**：統計失敗樣本的訊號分布 vs 成功樣本，找出**哪些訊號的命中率明顯偏低**。例如：
   - 「PE val5y=偏高」的命中率 vs「偏低」
   - 「inst20d=偏空/混亂」 vs「偏多」
   - 「fin_trend=惡化」 vs「改善」
   - 「RSI>70 或乖離過大」追高
   - 各支柱分數（breakdown）高低與命中的關聯
   用實際數字講（命中率 X% vs Y%），不要憑印象。
3. **改善建議**：根據模式提**具體可執行**的調整：
   - 選股過濾：例如「避開 PE 5年位階 >80% 且財報惡化者」。
   - 評分權重：例如「估值支柱權重應提高 / 籌碼應改看 20 日連續性而非單日」。
   - AI 分析習慣：例如「特別警惕外資單日買但 20 日在賣的假突破」。

## 3. 輸出
**A. `stock-radar/public/review.json`**（給網頁/紀錄）：
```json
{
  "updated_at": "YYYY-MM-DD HH:MM",
  "matured_samples": 0,
  "hit_rate_pct": 0,
  "failure_patterns": [
    {"pattern": "PE 5年位階偏高的追高", "fail_rate": "失敗率 X%", "evidence": "..."}
  ],
  "recommendations": ["...具體調整..."],
  "summary": "一段話總結這批檢討的核心教訓"
}
```
**B. `stock-radar/LESSONS.md`**（累積教訓，選股/分析時的避坑清單）：把本次「已用數據驗證」的教訓**追加**進去（標日期與樣本數），與既有條目去重、矛盾時以較新較大樣本為準。格式：
```
- (YYYY-MM-DD, n=樣本數) <教訓一句話：什麼訊號/型態命中率低，應如何因應>
```

## 4. 收尾
`git add stock-radar/public/review.json stock-radar/LESSONS.md && git commit -m "失敗檢討 <日期>：<核心教訓>" && git push`（被拒則 `git pull --rebase` 再 push）。回報：檢討了幾筆失敗、找到哪些模式、新增哪些教訓。

## 重要原則
- **只用實際數據說話**，不杜撰失敗原因；樣本不足就老實說。
- 教訓要**具體可執行**（能變成過濾條件、權重或檢查清單），不要空泛。
- 目標是**系統性提高命中率**，不是事後諸葛單一個股。
