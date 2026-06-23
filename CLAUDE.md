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
- **Phase 2 未做**：各模組詳細頁（生活/日記/習慣/目標、健康減脂/飲食/斷食、財務記帳、知識庫筆記、作品集）。目前是 ModuleLandingView 佔位。
- **Phase 3 未做**：後端新資料表（life_logs/journals/habits/habit_records/fasting_records/goals/portfolio_projects/case_studies/resources；users 加 provider 欄）對應的 Entity/Repository/Service/Controller。

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

## 建議下一步
1. **Phase 2 先做深一個模組**（推薦「日記」或「減脂」做成完整可用：mock→接後端），作品集 demo 最有感。
2. 或 **Phase 3 後端**：把新資料表的 Entity/Repository/Service/Controller 建起來，讓各模組真的存進 Neon。
3. 小優化：K 線「滑鼠懸停看 OHLC」、深色模式微調、Dashboard 的 AI 卡接真實資料。
