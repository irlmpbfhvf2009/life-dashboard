# 🧭 Personal Intelligence Studio · 個人智慧工作台

一個**模組化、商業質感**的個人數位工作台——把生活管理、健康減脂、財務分析、AI 工具、知識庫與作品展示整合在一個介面。多使用者、各自的資料完全隔離，並以 **AI 股票研究模型**為旗艦功能。

> 由「生活儀表板」升級而來，目標是**可當作品集展示、也能真的天天用、未來可商業化**的全端產品。以**免費 / 接近免費**雲端資源運作。

### 🔗 線上 Demo
- **網站**：https://life-dashboard-blue-omega.vercel.app
- **後端 API**：https://life-dashboard-backend-463356502015.asia-southeast1.run.app
- 用 Google 或 Email/密碼註冊即可登入，資料只屬於你自己。

---

## ✨ 功能

| 模組 | 內容 |
| --- | --- |
| **總覽 Dashboard** | Hero 歡迎區、快速操作、今日狀態、減脂/習慣/財務/AI 摘要卡、本週趨勢、最近日記 |
| **工具中心 App Center** | 所有模組以 App Card 呈現，依分類整理、可搜尋 |
| **生活管理** | 生活紀錄、日記、習慣追蹤、目標管理 |
| **健康減脂** | 體重趨勢、目標體重、飲食、斷食 |
| **財務分析** | 記帳、分類統計、財務摘要 |
| **AI 實驗室** | **AI 股票研究模型**、AI 英文教練、資料分析工具 |
| **知識庫** | 筆記、資源庫、學習紀錄 |
| **作品展示** | 專案作品、案例研究、技術文章 |

> 介面為**繁體中文**，支援**深色 / 淺色模式**（跟隨系統、可手動切換、記住偏好）。

### 🤖 AI 股票研究模型（旗艦）
整合自獨立的「潛力股戰情室」管線（已併入本 repo `stock-radar/`）：
- **今日 AI 精選**：合併行情（K 線蠟燭圖、技術、籌碼、基本面、資金）＋ AI 八面向深度分析（基本面/估值/籌碼/技術/產業/事件/預期差/風險）於同一張卡
- **雷達選股**：每日量化選股榜（多因子綜合評分）
- **AI 預判追蹤**：AI 看好標的的事後命中率（5/10/20 日）
- **過往分析**：歷史分析存檔
- 台股慣例 **紅漲綠跌**

> ⚠️ **免責聲明**：AI 股票研究模型僅供**研究與模擬分析**，不構成投資建議，亦**不提供任何下單或交易功能**。資料來自公開來源、可能有誤差，盈虧請自行負責。

---

## 🧱 技術棧

| 層級 | 技術 | 部署（免費方案） |
| --- | --- | --- |
| 前端 | Vue 3 · Vite · TypeScript · Pinia · Vue Router · Tailwind · lucide · Chart.js · Firebase Web SDK | **Vercel Hobby** |
| 後端 | Java 21 · Spring Boot 3 · Spring Security · Spring Data JPA · Firebase Admin SDK | **Google Cloud Run**（min=0/max=1） |
| 資料庫 | PostgreSQL | **Neon 免費方案** |
| 認證 | Firebase Authentication（**Google + Email/密碼**） | **Firebase Spark** |
| 資料管線 | Python（每日掃描台股）+ GitHub Actions 排程 | **GitHub Actions（免費）** |

---

## 🏗 系統架構

```
瀏覽器（Vercel 上的 Vue SPA）
   │  Google / Email 登入（Firebase）→ 取得 Firebase ID Token
   │  每次呼叫 API：Authorization: Bearer <id_token>
   ▼
Spring Boot API（Cloud Run，可縮放到 0）
   │  FirebaseAuthenticationFilter 驗證 token（Admin SDK）
   │  CurrentUserService 把 firebase uid → users 列（首次登入自動建立）
   │  每筆查詢都以 user_id 限定
   ▼
Neon PostgreSQL（Serverless、SSL）

AI 股票資料：GitHub Actions 每日掃描 → stock-radar/public/*.json
            → 前端執行階段直接讀 GitHub raw（push 後約 1 分鐘自動顯示）
```

## 🔐 認證
Google 與 Email/密碼**都走 Firebase**（不在後端手刻密碼邏輯）。前端取得 Firebase ID Token，後端用 Admin SDK 驗證、依 firebase uid 建立/查詢使用者。**所有資料綁定 `user_id`，使用者只能存取自己的資料**。含登入 / 註冊 / 忘記密碼頁與初始載入狀態。

## 📁 專案結構

```
frontend/                 Vue 3 SPA（設計系統、AppShell、雙登入、各模組頁、AI 股票頁）
backend/                  Spring Boot 3（package-by-feature，統一 ApiResponse 格式）
stock-radar/              台股 AI 分析管線（Python scripts + public/*.json 資料）
infra/billing-guard/      費用守門員：超過預算自動關閉計費的 Cloud Function
.github/workflows/        每日股票掃描排程
.claude/commands/         /analyze-stocks、/review-failures（手動 AI 分析指令）
docs/                     architecture / api / deployment / cost-control
CLAUDE.md                 專案交接（給作者與 AI 接手者）
```

---

## 🚀 部署

| 目標 | 方式 |
| --- | --- |
| 前端 → Vercel | 本機 `frontend/deploy-frontend.ps1`（build 烤入值 + `vercel deploy --prebuilt`） |
| 後端 → Cloud Run | `gcloud run deploy life-dashboard-backend --source backend --region asia-southeast1` |
| 資料庫 | Neon（JDBC、pooled host、`sslmode=require`） |
| 認證 | Firebase（啟用 Google 與 Email/密碼；授權網域加入 Vercel domain） |

完整步驟見 [docs/deployment.md](docs/deployment.md)。所有 secret 都用環境變數 / Secret Manager，**不寫死在程式碼**。

## 💰 成本控制（以免費為前提）
- Cloud Run `min-instances=0`（閒置縮到 0、不計費）、`max=1`、512Mi
- 不用 Cloud SQL、不用付費 Redis、不用付費 AI API、不做真實下單
- **費用守門員**：Cloud Function 監看預算，超過門檻自動關閉專案計費（`infra/billing-guard/`）
- 設定頁有免費額度用量條（擁有者限定）

詳見 [docs/cost-control.md](docs/cost-control.md)。

---

## 🗺 進度（Roadmap）
- ✅ **Phase 1（已上線）**：設計系統、雙登入、AppShell/Sidebar/Header、總覽 Dashboard、App Center、**AI 股票研究（完整）**、設定、深色模式
- 🔜 **Phase 2**：各模組詳細頁（日記/習慣/目標、減脂/飲食/斷食、記帳、筆記、作品集）的完整 CRUD 與圖表
- 🔜 **Phase 3**：後端新資料表（journals / habits / goals / portfolio_projects … ）的 Entity/Repository/Service/Controller，讓各模組真的存進 Neon

## 📄 文件
- [docs/architecture.md](docs/architecture.md) · [docs/api.md](docs/api.md) · [docs/deployment.md](docs/deployment.md) · [docs/cost-control.md](docs/cost-control.md)

---

> 本專案為個人作品集，僅供學習與研究。AI 股票研究模型不構成投資建議。
