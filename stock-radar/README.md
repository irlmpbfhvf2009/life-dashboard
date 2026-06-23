# 潛力股戰情室 🎯

每日自動掃描 60 檔台股，依技術指標（MA 多頭排列、RSI、量比、漲幅）篩選出當日強勢飆股。
全程使用免費資源：GitHub Actions 排程選股、Vercel 託管靜態網站，資料來自 Yahoo Finance（免 API key）。

---

## 🚀 部署步驟（5 步搞定）

1. **建立 GitHub Repo** — 在 GitHub 新增一個 repo，把本專案所有檔案上傳上去。
   > 📸 截圖提示：repo 根目錄應能看到 `index.html`、`scripts/`、`public/`、`.github/` 四個項目。

2. **確認 Actions 權限** — 進入 `Settings → Actions → General → Workflow permissions`，勾選 **Read and write permissions** 後存檔。
   > 📸 截圖提示：找到 "Workflow permissions" 區塊，選 Read and write。

3. **匯入到 Vercel** — 到 [vercel.com](https://vercel.com) 用 GitHub 登入，按 **Add New → Project** 匯入此 repo。
   > 📸 截圖提示：Framework Preset 選 **Other**，其餘保持預設直接 Deploy。

4. **設定輸出目錄** — Vercel 部署設定中，**Root Directory 留空**、**Output / 不需 build**，直接以靜態網站發佈即可。
   > 📸 截圖提示：Build & Output Settings 全部留空（純靜態 HTML 無需 build 指令）。

5. **完成** — Vercel 給你一個網址（如 `your-app.vercel.app`），打開即可看到雷達頁面。
   > 📸 截圖提示：首次因尚未跑過選股，會顯示「今日無符合條件的股票」屬正常。

---

## 🖐 如何手動觸發選股

不想等到下午 15:40？可以手動跑：

1. 進入 GitHub repo 的 **Actions** 分頁。
2. 左側點選 **每日台股飆股掃描** 這個 workflow。
3. 右側點 **Run workflow → Run workflow** 綠色按鈕。
4. 等待約 1～3 分鐘，跑完後 `public/result.json` 會被自動更新並 commit。
5. Vercel 偵測到新 commit 會自動重新部署，重新整理網頁即可看到最新結果。

> ⏰ 排程說明：自動執行時間為「週一到週五，台灣時間 15:40」(UTC 07:40)。
> GitHub 免費排程在尖峰時可能延遲數分鐘到數十分鐘觸發，屬正常現象。

---

## ❓ 常見問題（FAQ）

### Q1：GitHub Actions 沒有自動執行？
- 確認 repo **不是 fork**（fork 的排程預設停用）。
- 確認 `Settings → Actions` 沒有被停用 workflow。
- repo 若連續 60 天無任何活動，GitHub 會自動暫停排程，進 Actions 頁面手動 Run 一次即可恢復。
- 排程觸發本來就會延遲，請耐心等待或改用手動觸發測試。

### Q2：跑完了但網頁資料沒更新？
- 到 **Actions** 看該次執行是否成功（綠勾）。若紅叉，點進去看錯誤日誌。
- 確認步驟 2 的 **Read and write permissions** 有開，否則 workflow 無法 push 結果。
- 確認 `public/result.json` 在最新 commit 中有被更新（若當日無符合股票，`stocks` 會是空陣列，屬正常）。
- 瀏覽器可能有快取，請強制重新整理（Ctrl/Cmd + Shift + R）。

### Q3：Vercel 顯示 404？
- 確認 `index.html` 位於 **repo 根目錄**（不是放在子資料夾）。
- Vercel 專案設定中 **Root Directory 應留空**；若先前誤填，請到 Settings 改回空白並重新部署。
- 確認 `public/result.json` 存在（本專案已附佔位檔，請勿刪除）。
- 重新部署：Vercel → Deployments → 最新一筆 → Redeploy。

---

## 📁 專案結構

```
stock-radar/
├── .github/
│   └── workflows/
│       └── daily_scan.yml   # GitHub Actions 排程（多步驟管線）
├── scripts/
│   ├── scan.py              # ① 選股（技術面+籌碼面）
│   ├── fundamentals.py      # ② 基本面/估值（FinMind，需 token）
│   ├── deepdata.py          # ② 深度數據：8季財報/5年估值/20日法人（供 AI 分析）
│   ├── composite_score.py   # ③ 多因子綜合評分（籌碼/技術/基本/估值加權）
│   ├── sentiment.py         # ④ 情緒/資金面（融資融券）
│   ├── industry.py          # ⑤ 產業前景（族群分類+相對強弱，TWSE 免 token）
│   ├── track.py             # ⑥ 命中率追蹤（多視窗 5/10/20 日）
│   ├── analyze_ai.py        # （選用）API 版 AI 分析；預設改本機手動跑
│   └── requirements.txt     # Python 依賴
├── public/                  # 以下皆自動產生
│   ├── result.json          # 雷達榜（含基本面/資金面/綜合分）
│   ├── universe.json        # 全市場資料（供「我的追蹤」）
│   ├── analysis.json        # AI 分析
│   ├── fundamentals.json    # 基本面快取
│   ├── picks_history.json   # 每日選股快照（命中率用）
│   └── performance.json     # 命中率統計
├── index.html               # 前端網頁
└── README.md
```

## 🔑 環境變數（GitHub Secrets）

到 `Settings → Secrets and variables → Actions` 設定：

| Secret | 用途 | 沒設定的話 |
|--------|------|-----------|
| `FINMIND_TOKEN` | 基本面/估值（FinMind 免費註冊取得） | 基本面欄位留空，綜合分用中性值 |

> CI 只跑**免費**的選股與資料層（技術/籌碼/基本面/評分/資金面/命中率），不需要付費 API key。

## 🤖 AI 分析（本機手動，使用 Claude 訂閱）

AI 波段分析（含預期差判讀）**不放進自動排程**，改在本機手動執行，避免付費 API 成本——
直接用 Claude 訂閱額度（Claude Code 互動式）即可：

1. Actions 跑完、`public/result.json` 更新後，在本機 `git pull`。
2. 用 Claude Code 開啟本專案，執行 `/analyze-stocks`（或直接說「更新 AI 分析」）。
3. Claude 會讀 `result.json` 的綜合分前幾檔、蒐集國際盤與個股事件，
   寫出 `public/analysis.json`（並併入 `analysis_archive.json`）。
4. `git push`，Vercel 重新部署後網頁即顯示 AI 分析。

> 若改用付費 API：設 `ANTHROPIC_API_KEY` 後執行 `python scripts/analyze_ai.py` 即可（沒設則優雅跳過）。

---

## ⚠️ 免責聲明

本專案僅供技術研究與學習使用，所有資料來自 Yahoo Finance，可能有延遲或誤差。
**所有內容僅供參考，不構成任何投資建議**，依此操作之盈虧請自行負責。
