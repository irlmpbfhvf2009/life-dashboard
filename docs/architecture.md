# 架構說明（Architecture）

## 1. 總覽

Life Dashboard 是一個典型的 **SPA + 無狀態 REST API + 託管 Postgres** 系統，
刻意保持簡單，讓它能跑在免費方案上，並且可以縮放到 0 個實例。

```
┌──────────────────────────┐        ┌───────────────────────────┐
│  Vue 3 SPA（Vercel）     │        │  Firebase Authentication  │
│  - Pinia 認證 store      │ Google │ （Google 登入）           │
│  - Axios + 攔截器        │◀──────▶│  發出 Firebase ID Token   │
└─────────────┬────────────┘        └───────────────────────────┘
              │ Authorization: Bearer <idToken>
              ▼
┌──────────────────────────┐        ┌───────────────────────────┐
│ Spring Boot API          │  驗證  │  Firebase Admin SDK       │
│ （Cloud Run, min=0 max=1）│◀──────▶│  verifyIdToken()          │
│  Filter → Service → Repo │        └───────────────────────────┘
└─────────────┬────────────┘
              │ JDBC（SSL）
              ▼
┌──────────────────────────┐
│ Neon PostgreSQL          │
└──────────────────────────┘
```

## 2. 認證與授權流程

1. 使用者點「**Continue with Google**」。Firebase Web SDK 會跳出 Google 登入視窗，
   並回傳已登入的使用者。
2. 前端**不會**儲存任何原始帳密。每次呼叫 API 時，Axios 的**請求攔截器**會呼叫
   `user.getIdToken()`（會自動更新即將過期的 token），並設定
   `Authorization: Bearer <token>`。
3. 後端的 `FirebaseAuthenticationFilter`（一個 `OncePerRequestFilter`）會：
   - 取出 bearer token，
   - 呼叫 `FirebaseAuth.verifyIdToken(token)`（Firebase Admin SDK）驗證，
   - 建立 `FirebaseUserPrincipal(uid, email, name, picture)`，並把已驗證的
     `Authentication` 放進 `SecurityContext`。
4. `SecurityConfig` 是**無狀態的**（`SessionCreationPolicy.STATELESS`）；所有
   `/api/**` 路徑都需要登入。未登入的請求會收到統一 JSON 格式的 `401`。
5. `CurrentUserService.getCurrentUser()` 會把 principal 對應到資料庫的 `User`，
   並在**第一次登入時自動建立該筆資料**（`UserService.provisionFromFirebase`）。

### 為什麼用 token、為什麼無狀態？
- Cloud Run 的實例是短暫的、而且會縮放到 0，沒辦法放伺服器端 session。
- Firebase 免費幫我們處理密碼 / OAuth、MFA、帳號復原等等。

## 3. 資料擁有權 / 多租戶隔離

每個業務資料表都有 `user_id` 欄位。隔離規則是在 **Service 層**強制執行的，
而不是交給呼叫端自己處理：

- 列表查詢使用 `findByUserId...`。
- 單筆讀取／更新／刪除使用 `findByIdAndUserId(id, userId)`，當資料不存在
  **或**屬於別人時，丟出 `ResourceNotFoundException`（→ `404`）。我們刻意不去區分
  這兩種情況，這樣就不會洩漏「別人是否有這筆資料」。

`CurrentUserService` 是「目前是誰在呼叫」的唯一來源，所以不會有任何 controller 或
service 自己亂讀 security context。

## 4. 後端分層

```
Controller   – 只處理 HTTP：對應請求、驗證（@Valid）、回傳 ApiResponse。
Service      – 商業邏輯 + 擁有權過濾 + 交易（transaction）。
Repository   – Spring Data JPA，以 user 為範圍的查詢方法。
Entity       – JPA @Entity，並在 (user_id, date) 等欄位建立索引。
DTO          – 請求／回傳用的 record；絕不直接回傳 Entity。
```

橫切關注點（Cross-cutting）：
- `common/ApiResponse` — 統一回傳格式。
- `common/GlobalExceptionHandler` — `@RestControllerAdvice`，把例外對應成錯誤格式
  （驗證錯誤 → 400、找不到 → 404、未授權 → 401）。
- `security/` — Firebase filter、principal、current-user service。
- `config/` — `SecurityConfig`（CORS + filter chain）與 `FirebaseConfig`
  （從環境變數初始化 Admin SDK）。

### 以功能分包（Package-by-feature）
每個領域（`todo`、`weight`、`food`、`expense`、`mood`、`note`、`user`、
`dashboard`）都是一個獨立的 package，各自有 controller／service／repository／
entity／dto。相關的程式碼放在一起，每個模組都能單獨閱讀。

## 5. 前端結構

```
src/
├── api/            # axios 實例 + 攔截器（http.ts）與型別化的 API 模組（index.ts）
├── components/
│   ├── charts/     # Chart.js 包裝元件（Line/Bar/Doughnut）+ 一次性註冊
│   ├── layout/     # AppLayout（側邊欄 + 頂部列，響應式）
│   └── ui/         # StatCard、EmptyState、ErrorState、LoadingSpinner、BaseModal、PageHeader
├── composables/    # useAsync（loading／error／data 模式）
├── router/         # 路由 + 全域認證守衛（受保護路由）
├── stores/         # Pinia 認證 store（Firebase 狀態 + profile）
├── types/          # 對應後端 DTO 的 API 型別
├── utils/          # 格式化工具
└── views/          # 每個功能一個頁面 + Login + Settings
```

- **Pinia `auth` store** 負責管理 Firebase 認證狀態。`init()` 只訂閱一次
  `onAuthStateChanged`，並在第一次觸發後 resolve，這樣路由守衛就能在第一次導航前
  等到「已知的登入狀態」（避免重新整理時畫面閃爍／跳轉）。
- **路由守衛**會把未登入的使用者導到 `/login`，並把已登入的使用者從 `/login` 導開。
- **`useAsync`** 統一了每個頁面的 loading／error／empty 處理方式。

## 6. 狀態與儲存規則

- 客戶端唯一的持久化儲存是 **Firebase 自己的認證狀態**（由 SDK 管理的
  IndexedDB／localStorage）。沒有任何應用程式資料被快取在 localStorage。
- 所有業務資料都存在 Postgres，並由各頁面個別取得。

## 7. 資料庫結構

各資料表（全部都有 `user_id`，並針對常見的存取模式建立索引）：

| 資料表 | 主要欄位 | 索引 |
| --- | --- | --- |
| `users` | `firebase_uid`（唯一） | `idx_users_firebase_uid` |
| `todos` | `status`、`priority`、`due_date` | `(user_id,status)`、`(user_id,due_date)` |
| `weight_records` | `date`、`weight` | `(user_id,date)` |
| `food_records` | `date`、`meal_type` | `(user_id,date)` |
| `expenses` | `date`、`amount`、`category` | `(user_id,date)` |
| `mood_records` | `date`、`mood_score` | `(user_id,date)` |
| `notes` | `title`、`content`、`updated_at` | `(user_id,updated_at)` |

資料表由 Hibernate 自動建立（`ddl-auto: update`）。若是正式上線，建議改用
Flyway／Liquibase 做遷移。

## 8. 擴展特性（Scaling）

- Cloud Run `min=0` → 閒置一段時間後，第一次請求會有冷啟動（JVM 約 2～5 秒）。
- `max=1` 加上很小的 Hikari 連線池（`maximum-pool-size: 3`）可保護 Neon 免費方案
  有限的連線數。
- 應用程式是無狀態的，之後若要水平擴展，唯一要改的就是調高 `max-instances`
  （但要注意 Neon 的連線數上限）。
```
