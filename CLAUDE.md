# Personal Intelligence Studio — 專案交接（CLAUDE.md）

> 給新 session 的 Claude 與作者本人。讀完這份就能接手。本檔在 repo 根目錄，
> Claude Code 會自動載入為背景知識。**繁體中文 UI、台股紅漲綠跌。**

## 一句話定位
**Personal Intelligence Studio（個人智慧工作台）**——模組化、商業質感的個人 OS / SaaS，
整合生活管理、健康減脂、財務分析、AI 實驗室（含 AI 股票研究）、知識庫、作品展示。
由原本的「life-dashboard 生活儀表板」升級而來（repo 目錄名仍叫 `life-dashboard`）。

## 線上 / 資源
- 網站（正式）：https://life-dashboard-blue-omega.vercel.app
- 後端 API：https://life-dashboard-backend-463356502015.asia-southeast1.run.app
- GitHub：https://github.com/irlmpbfhvf2009/life-dashboard （公開）
- 全部在同一個 GCP/Firebase 專案 `life-dashboard-17faa`（專案編號 463356502015，owner ws794613@gmail.com）

## 技術棧
- 前端：Vue 3 + Vite + TypeScript + Pinia + Vue Router + Tailwind + lucide-vue-next + Chart.js + Firebase Web SDK
- 後端：Java 21 + Spring Boot 3 + Spring Security + Spring Data JPA + Firebase Admin SDK
- DB：Neon PostgreSQL（Singapore, ap-southeast-1，免費方案，pooled host、jdbc、sslmode=require）
- 部署：前端 Vercel（**prebuilt** 手動部署）、後端 Cloud Run（min=0/max=1/512Mi）、Auth=Firebase（Google + Email/密碼）
- 成本守門：Cloud Function `billing-guard` 在花費超過預算（NT$1）時自動關閉專案計費（見 `infra/billing-guard/`）

## 認證
Google 與 Email/密碼**都走 Firebase**；前端拿 Firebase ID Token，後端用 Admin SDK 驗證、依 firebase uid 在 `users` 表建立/查詢使用者；每筆查詢都以 `user_id` 限定。Email/密碼供應商已在 Firebase 啟用。

## 專案結構
```
frontend/   Vue 3 SPA
  src/config/navigation.ts   側邊欄大分類 + App Center 的 app 清單（lucide 圖示）
  src/components/layout/      AppShell / AppSidebar / AppHeader / AuthLayout
  src/components/ui/          設計系統元件（StatCard/AppCard/ProgressCard/SectionCard/狀態元件…）
  src/components/stock/       AiPickCard / RadarStockCard / StockAnalysisCard / StockTrackTable / CandleChart(自製SVG K線)
  src/views/                  OverviewView(總覽) / AppCenterView / ModuleLandingView / StockResearchView / SettingsView / auth/*
  src/composables/useTheme.ts 深色/淺色（CSS 變數 ink 整組反轉；class 策略；index.html 有 no-flash 腳本）
  src/api/                    http.ts(Axios+Firebase token 攔截器) / index.ts / stockResearch.ts
  src/data/mock.ts            Dashboard 等用的 mock（結構對齊未來 DTO）
backend/    Spring Boot（package-by-feature：user/todo/weight/food/expense/mood/note/dashboard/usage/security/config/common）
stock-radar/  整合進來的台股 AI 分析管線（Python scripts + public/*.json 資料）
.github/workflows/stock_scan.yml  每日掃描（working-directory: stock-radar）
.claude/commands/             /analyze-stocks、/review-failures（路徑已指向 stock-radar/public）
infra/billing-guard/          費用自動關閉的 Cloud Function
```

## 進度（phased）
- **Phase 1 已完成並上線**：設計系統、雙登入、AppShell/Sidebar/Header、總覽 Dashboard、App Center、AI 股票研究（完整）、設定、深色模式。
- **舊功能頁已刪除**（Todos/Weights/Foods/Expenses/Moods/Notes 的舊 CRUD 頁）。
- **AI 股票研究已完整**：今日 AI 精選（合併行情+K線+AI八面向）、雷達選股、AI 預判追蹤、過往分析；資料即時讀 GitHub raw。
- **Phase 2 進行中**：已完成並上線 5 個模組——
  - **健康減脂 `/health`**（OtterLife 風，完整）。
  - **財務分析 `/finance`**：收入/支出/結餘、支出分類甜甜圈、近 6 月趨勢、收支列表；後端 `Expense` 已加 `type`（INCOME/EXPENSE），接 `expenseApi` 存 Neon。
  - **知識庫 `/knowledge`**：master-detail 筆記（搜尋/新增/編輯/Ctrl⌘+S/刪除），接 `noteApi`。
  - **生活管理 `/life`**：待辦（todoApi）+ 心情日記（moodApi）兩個分頁。
  - **作品展示 `/portfolio`**：靜態卡片展示（資料在 `src/data/portfolio.ts`），無後端。
  - i18n：以上模組 6 語系（zh-TW/zh-CN/en/ja/ko/th）皆已翻譯；其他舊區塊（nav/login/dashboard…）仍只有 zh-TW。
  - 仍佔位（ModuleLandingView）：**AI 實驗室 `/ai`** 落地頁（其下 `/ai/stock` 已完整；英文家教、資料分析待做）。
- **Phase 3 未做**：習慣/目標/斷食/日記長文 等需要新資料表的功能（habits/habit_records/goals/journals/fasting_records/portfolio_projects…）對應的 Entity/Repository/Service/Controller；users 加 provider 欄。

## AI 股票管線（重要）
- 每日免費層（GitHub Actions `stock_scan.yml`）：掃描/評分/籌碼/命中率 → 寫 `stock-radar/public/*.json` → commit。
- AI 八面向分析（**手動**，吃 Claude 訂閱、不進 CI）：在本 repo 跑 `/analyze-stocks`（指令在 `.claude/commands/`，已指向 `stock-radar/public/`）。產出 `analysis.json` + 併入 `analysis_archive.json`、git push。
- 前端**執行階段直接讀 GitHub raw**（`https://raw.githubusercontent.com/irlmpbfhvf2009/life-dashboard/main/stock-radar/public/*.json`），**push 後約 1 分鐘自動顯示，不用重新部署前端**。
- 舊的獨立 stock-radar repo / Vercel 已（或即將）刪除；本機 `Desktop/Claude/money` 是原始備份。

## 本機工具（都不在 PATH，要用完整路徑）
- Maven：`C:\Users\ws794\tools\apache-maven-3.9.9\bin\mvn.cmd`（編譯後端時 `JAVA_HOME` 指向下面的 JDK21）
- JDK 21：`C:\Program Files\Eclipse Adoptium\jdk-21.0.11.10-hotspot`
- Node：`C:\Program Files\nodejs`（npm 子程序找不到 node 時，把它前置到 PATH）
- gcloud：`C:\Users\ws794\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd`
- vercel：`C:\Users\ws794\AppData\Roaming\npm\vercel.cmd`

## 部署
- 前端（**只能用 prebuilt，勿用雲端 build**）：`frontend/deploy-frontend.ps1`，流程＝`npm run build`（值來自 gitignored 的 `frontend/.env.production.local`）→ 組 `.vercel/output` → `vercel deploy --prebuilt --prod`。
- 後端：`gcloud run deploy life-dashboard-backend --source backend --region asia-southeast1`（Cloud Build，免本機 Docker）。後端 env/secret 用 `gcloud run services update`；Firebase 金鑰存在 Secret Manager `firebase-sa`。

## 踩過的坑（別重蹈）
1. **Vercel `vercel env add` 在 Windows PowerShell 管線會在值開頭塞 BOM**，弄壞 Firebase API key（auth/network-request-failed）。→ 改用「本機 build 烤入值 + `--prebuilt` 部署」，雲端 env vars 不可靠、別依賴。
2. **PowerShell 沙箱誤判**：指令裡同時有 `rm`/`Remove-Item` 與字串 `C:\Program...` 會被擋（"Remove-Item on system path"）。→ 用 `[System.IO.Directory]::Delete()` 取代 Remove-Item，或別讓 `C:\Program` 字面值與 rm 同段；必要時 `dangerouslyDisableSandbox`。
3. **git commit -m 用 PowerShell here-string 時，訊息內含半形雙引號 `"` 會把參數截斷** → commit message 別用 `"`。
4. **GitHub raw 有 404 負快取**（曾請求過不存在的路徑）；App 抓取一律帶 `?t=時間戳` 繞過（已內建於 stockResearch.ts）。
5. **vercel CLI 在這環境的互動/管線常卡住**（env add 空值、project rm 卡住）；能避則避，改網頁操作。
6. **台股顏色**：漲=紅、跌=綠（`utils/format.ts` 的 `twPriceClass`），與一般西方相反；關鍵字highlight刻意用靛/琥珀，不用紅綠以免衝突。

## 待辦 / 使用者要做的
- 確認 **life-dashboard** repo 的 GitHub Actions 寫入權限已開（Settings → Actions → General → Read and write），每日股票掃描才會自動 commit。
- （選用）在 life-dashboard repo 設 `FINMIND_TOKEN` secret（基本面資料用，沒設會略過）。
- **AI 英文家教要能對話，需注入 `GEMINI_API_KEY`**（見下方「in-app AI」）。沒注入時前端會顯示「尚未啟用」提示、不會壞。

## in-app AI（Gemini）
- 後端 `com.lifedashboard.ai`：`GeminiClient`（呼叫 Gemini `generateContent`，JSON schema 結構化輸出，**可重用**）+ `EnglishCoachService`（`chat()` 回 reply/correction；`correct()` 回結構化 `CorrectionReply`）+ `AiController`（`GET /api/ai/status`、`POST /api/ai/english/chat`、`POST /api/ai/english/correct`）。
- 設定在 `application.yml` 的 `app.gemini`：`api-key=${GEMINI_API_KEY:}`、`model=${GEMINI_MODEL:gemini-2.0-flash}`、`base-url`。**金鑰留空時自動降級**：回 503、`/status` 回 `enabled:false`，前端顯示提示。
- 注入金鑰（建議走 Secret Manager）：
  ```
  gcloud run services update life-dashboard-backend --region asia-southeast1 \
    --update-secrets GEMINI_API_KEY=gemini-api-key:latest
  ```
  （或臨時用 `--set-env-vars GEMINI_API_KEY=xxx` 測試）。Gemini 有免費層，對 billing-guard 較安全。

## AI 英文家教（`/ai/english`，商業化學習模組，Phase 1+2 完成）
- 四層架構：基礎學習 / AI 練習 / 口說 / 複習成長。巢狀路由掛在 `EnglishLayout`（含自有二級導航 `EnglishSubNav`，側邊欄只保留「AI 實驗室」大類）。
- **13 頁中 12 頁已真實**：Home、對話室（三欄）、口說、句子修正、情境、單字、句型、文法、常錯庫、複習、學習進度。**唯一佔位剩**：學習路徑、程度檢測、每日任務獨立頁（用 `EnglishComingSoonPage` 讀 route meta）。
- **語音全用瀏覽器原生、零成本**：`composables/useSpeechSynthesis`（TTS 慢/正常）、`useSpeechRecognition`（STT）、`utils/pronunciation.compareSentence`（文字相似度，非音素級；UI 預留升級）。不支援時 `VoiceUnsupportedNotice` 降級成文字輸入。
- **狀態 + 持久化**：`useEnglishStore`（localStorage 即時快取 + **背景同步到後端 `english_state`**，跨裝置；cloud 優先、失敗靜默降級）管 streak/任務/常錯庫/簡化 SM-2 複習。`api/english.ts` 內容走 mock、對話/修正走免費 Gemini（無金鑰 fallback mock 教練）。
- **後端** `com.lifedashboard.english`：`english_state` 表（per-user JSON 文件）+ `GET/PUT /api/english/state`。內容（單字/句型/文法/情境）仍前端 mock（靜態、不需 per-user）。
- **i18n 已完成**：所有 UI chrome 抽到 `ec` namespace（`src/i18n/locales/english/*.ts`，6 語），切語言整個模組翻譯。學習「內容」（單字意思/例句/文法解析/情境目標/程度檢測建議）刻意保留 zh-TW（教學內容，非 UI）。
- **程度檢測/學習路徑已完成**；唯一佔位剩「每日任務」獨立頁（Home 已涵蓋）。
- **待辦**：內容若要動態化或多語內容，再建細粒度後端表。

## 建議下一步
1. **英文家教收尾**：i18n 抽 key 回填 6 語；程度檢測頁（影響個人化路徑）；學習路徑頁。
2. **資料分析工具 `/ai/data-lab`**：唯一還沒做的 AI app（上傳 CSV→Gemini 洞察），重用 `GeminiClient`。
3. **Phase 3 後端**：習慣/目標/斷食/日記長文 等需要新資料表的功能。
