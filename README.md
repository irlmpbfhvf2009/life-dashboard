# 🌿 Life Dashboard 生活儀表板

一個**多使用者**的生活儀表板：每位使用者用 Google 帳號登入後，**只會看到自己的**資料，包含待辦、體重、飲食、記帳、心情與快速筆記。

這是一個以「**作品集等級、可實際部署**」為目標、並盡量使用**免費 / 接近免費**雲端資源的全端專案。

| 層級 | 技術 | 部署平台（免費方案） |
| --- | --- | --- |
| 前端 | Vue 3 · Vite · TypeScript · Pinia · Vue Router · Tailwind · Chart.js · Firebase Auth | **Vercel Hobby** |
| 後端 | Java 21 · Spring Boot 3 · Spring Security · Spring Data JPA · Firebase Admin SDK | **Google Cloud Run** |
| 資料庫 | PostgreSQL | **Neon 免費方案** |
| 認證 | Firebase Authentication（Google 登入） | **Firebase（Spark 免費方案）** |

> **為什麼這樣選？** 詳見 [docs/architecture.md](docs/architecture.md)。費用與如何維持免費：[docs/cost-control.md](docs/cost-control.md)。

---

## 系統架構總覽

```
瀏覽器（Vercel 上的 Vue SPA）
   │  1. 透過 Firebase Web SDK 用 Google 登入 → 取得 Firebase ID Token
   │  2. 每次呼叫 API 時帶上：Authorization: Bearer <firebase_id_token>
   ▼
Spring Boot API（Cloud Run，可縮放到 0 個實例）
   │  3. FirebaseAuthenticationFilter 用 Firebase Admin SDK 驗證 token
   │  4. CurrentUserService 把 firebase uid 對應到 User 資料列（第一次登入時自動建立）
   │  5. 每一筆查詢都用 user_id 過濾
   ▼
Neon PostgreSQL（Serverless、SSL 連線）
```

認證流程、安全模型與資料隔離規則，詳見 [docs/architecture.md](docs/architecture.md)。

---

## Monorepo 專案結構

```
life-dashboard/
├── frontend/          # Vue 3 + Vite + TypeScript 前端 SPA
├── backend/           # Spring Boot 3（Maven）REST API
├── docs/
│   ├── architecture.md   # 架構說明
│   ├── api.md            # 完整 API 文件 + curl 範例
│   ├── deployment.md     # Cloud Run / Vercel / Neon / Firebase 設定步驟
│   └── cost-control.md   # 成本控制
└── README.md
```

---

## 環境需求（事先安裝）

- **Java 21**（用 `java -version` 確認）
- **Node 20+** 與 npm（用 `node -v` 確認）
- **Docker**（用來建置後端 image / 部署 Cloud Run）
- 一個 **Google / Firebase** 專案、一個 **Neon** 帳號，部署時還需要 **gcloud** 與 **Vercel** CLI

> ⚠️ 注意：目前這台電腦尚未安裝 Node 與 Maven/Gradle，所以**程式碼還沒有實際編譯驗證過**。請在有安裝工具的環境執行下方指令確認。

---

## 本機快速啟動

### 1. 資料庫 — Neon

到 Neon 建立一個免費專案並複製連線字串。詳見
[docs/deployment.md → Neon](docs/deployment.md#1-neon-postgresql)。你需要一組 **JDBC** 格式的網址，例如：

```
jdbc:postgresql://ep-xxx-pooler.<region>.aws.neon.tech/neondb?sslmode=require
```

### 2. Firebase — Google 登入

1. Firebase 主控台 → 建立專案 → **Authentication → 登入方式 → 啟用 Google**。
2. **專案設定 → 一般 → 你的應用程式 → 網頁應用程式**，複製 web 設定（給前端用）。
3. **專案設定 → 服務帳戶 → 產生新的私密金鑰**，下載 JSON（給後端用）。

完整步驟：[docs/deployment.md → Firebase](docs/deployment.md#3-firebase-authentication)。

### 3. 後端

```bash
cd backend
cp .env.example .env        # 填入 DATABASE_*、FIREBASE_*、CORS_ALLOWED_ORIGINS

# 先把環境變數載入（程式在執行時會讀取），再啟動。
# macOS / Linux：
set -a; source .env; set +a
mvn spring-boot:run          # 需要 Maven 3.9+ 與 Java 21
```

> 沒有安裝 Maven？後端的 Docker image 是用 Maven 容器建置的，所以你也可以直接用 Docker：
> ```bash
> docker build -t life-dashboard-backend ./backend
> docker run --rm -p 8080:8080 --env-file ./backend/.env life-dashboard-backend
> ```

後端會跑在 `http://localhost:8080`，健康檢查端點：`GET /actuator/health`。

### 4. 前端

```bash
cd frontend
cp .env.example .env.local   # 填入 VITE_API_BASE_URL 與 VITE_FIREBASE_*
npm install
npm run dev
```

前端會跑在 `http://localhost:5173`。請確認後端的 `CORS_ALLOWED_ORIGINS`
有包含 `http://localhost:5173`。

---

## API 總覽

所有端點都在 `/api` 底下，都需要帶上
`Authorization: Bearer <firebase_id_token>`，並統一回傳以下格式：

```jsonc
// 成功
{ "success": true, "data": { /* ... */ }, "message": null }
// 失敗
{ "success": false, "data": null, "message": "錯誤訊息" }
```

| 模組 | 端點 |
| --- | --- |
| 個人資料 | `GET /api/me`、`PATCH /api/me` |
| 儀表板首頁 | `GET /api/dashboard` |
| 待辦 | `POST /api/todos`、`GET /api/todos`、`PATCH /api/todos/{id}`、`DELETE /api/todos/{id}` |
| 體重 | `POST /api/weights`、`GET /api/weights`、`GET /api/weights/latest`、`GET /api/weights/stats?range=7d\|30d\|90d` |
| 飲食 | `POST /api/foods`、`GET /api/foods`、`DELETE /api/foods/{id}` |
| 記帳 | `POST /api/expenses`、`GET /api/expenses`、`GET /api/expenses/stats/monthly`、`DELETE /api/expenses/{id}` |
| 心情 | `POST /api/moods`、`GET /api/moods`、`GET /api/moods/stats` |
| 筆記 | `POST /api/notes`、`GET /api/notes`、`PATCH /api/notes/{id}`、`DELETE /api/notes/{id}` |

完整的請求 / 回傳格式與 `curl` 範例：[docs/api.md](docs/api.md)。

---

## 部署

| 目標 | 文件 |
| --- | --- |
| 後端 → Cloud Run | [docs/deployment.md → Cloud Run](docs/deployment.md#4-backend--google-cloud-run) |
| 前端 → Vercel | [docs/deployment.md → Vercel](docs/deployment.md#5-frontend--vercel) |
| Neon / Firebase 設定 | [docs/deployment.md](docs/deployment.md) |

後端一行部署（先 `gcloud auth login` 並設定好環境變數後）：

```bash
cd backend && PROJECT_ID=你的GCP專案 REGION=asia-east1 ./deploy.sh
```

---

## 費用與免費額度說明

- **Cloud Run** 設定為 `min-instances=0`（閒置時縮放到 0 → 不產生閒置費用），
  `max-instances=1`。閒置後第一次請求會有冷啟動（約數秒）。
- **Neon**、**Vercel Hobby**、**Firebase Spark** 都使用在各自的免費額度內。
- **不使用** Cloud SQL、**不使用**付費 Redis、**不使用**付費 AI API、**不使用**常駐服務。

哪些地方「可能」產生費用、以及如何避免，都寫在
[docs/cost-control.md](docs/cost-control.md)，**部署前請務必先看過。**

---

## 安全模型（摘要）

- 前端取得短效的 **Firebase ID Token**，以 Bearer token 方式送出。
- 後端對每個 token 都用 **Firebase Admin SDK** 驗證（無 session、無狀態）。
- 資料庫的 `User` 資料列以 `firebase_uid` 為鍵，第一次登入時自動建立。
- **每一筆**查詢都用 `user_id` 過濾；任何使用者都無法讀取或修改別人的資料
  （查不到時回傳 `404`，不會洩漏資料是否存在）。
- 所有機密都來自**環境變數**，不會寫進程式碼。
  前端的 Firebase **web** 設定本來就是公開的（它不是機密）。

---

## 設計取捨說明

- **Maven（而非 Gradle）**：Spring Boot 最常見的預設；Docker 建置時直接用官方 Maven
  image，所以不需要把 wrapper jar 放進 repo。
- **Tailwind + 自己手刻元件**（而非 PrimeVue / shadcn-vue）：避免主題設定的摩擦，
  樣式與打包大小完全自己掌控。之後要換成元件庫也很容易。
- **`ddl-auto: update`**：對作品集專案來說很方便（自動建表）。若是正式上線系統，
  會改用 Flyway / Liquibase 做資料庫遷移。
- **H2** 只用在後端的「context 載入測試」，**絕不**當作正式資料庫。
```
