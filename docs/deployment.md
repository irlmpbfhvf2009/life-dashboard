# 部署指南（Deployment Guide）

順序很重要：**Neon → Firebase → 後端（Cloud Run）→ 前端（Vercel）**。
因為前端需要後端網址，而前後端都需要 Firebase 設定。

---

## 1. Neon PostgreSQL

1. 到 <https://neon.tech> 註冊（免費，Free 方案不需要信用卡）。
2. **建立專案（Create project）** → 選一個離你的 Cloud Run 區域比較近的 region。
3. 在專案儀表板打開 **Connection Details**。
4. Neon 會給你一段連線字串，類似：
   ```
   postgresql://<user>:<password>@ep-xxx-pooler.<region>.aws.neon.tech/neondb?sslmode=require
   ```
5. 把它轉換成這個專案使用的環境變數（注意 URL 要加 **`jdbc:`** 前綴，
   帳號／密碼要分開放）：
   ```
   DATABASE_URL=jdbc:postgresql://ep-xxx-pooler.<region>.aws.neon.tech/neondb?sslmode=require
   DATABASE_USERNAME=<user>
   DATABASE_PASSWORD=<password>
   ```
   - 請使用**連線池（pooled）**的主機（網址含有 `-pooler`）— 適合 serverless／Cloud Run。
   - 保留 `sslmode=require`；Neon 會拒絕非 SSL 的連線。

> Hibernate 會在第一次啟動時自動建立資料表（`ddl-auto: update`）。

---

## 2. Firebase 專案

1. 到 <https://console.firebase.google.com> → **新增專案**（可以沿用你等一下要用來
   跑 Cloud Run 的 GCP 專案，也可以另開一個）。
2. 不需要啟用帳單 — **Spark（免費）**方案就涵蓋了 Authentication。

---

## 3. Firebase Authentication

1. **建構 → Authentication → 開始使用**。
2. **登入方式 → Google → 啟用**，設定一個支援用 email，**儲存**。
3. **專案設定 → 一般 → 你的應用程式 → 網頁應用程式（`</>`）** → 註冊一個 app。
   複製設定 — 這些就是前端的環境變數：
   ```
   VITE_FIREBASE_API_KEY=...
   VITE_FIREBASE_AUTH_DOMAIN=<project>.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=<project-id>
   VITE_FIREBASE_APP_ID=...
   ```
4. **Authentication → 設定 → 已授權的網域（Authorized domains）**：加入你的 Vercel
   網域（例如 `your-app.vercel.app`），並保留 `localhost` 給本機開發用。
5. **專案設定 → 服務帳戶 → 產生新的私密金鑰**。這會下載一個 JSON 檔。它的內容就是
   後端的 `FIREBASE_SERVICE_ACCOUNT_JSON`，而檔案裡的 `project_id` 欄位就是
   `FIREBASE_PROJECT_ID`。
   - **絕對不要把這個檔案 commit 進去。** `.gitignore` 裡已經有對應的忽略規則。

---

## 4. Backend → Google Cloud Run

### 事前準備
```bash
gcloud auth login
gcloud config set project 你的GCP專案ID
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com
```

### 方式 A — 從原始碼部署（使用內附的 Dockerfile）

```bash
cd backend
gcloud run deploy life-dashboard-backend \
  --source . \
  --region asia-east1 \
  --allow-unauthenticated \
  --min-instances 0 \
  --max-instances 1 \
  --memory 512Mi \
  --cpu 1 \
  --concurrency 40 \
  --timeout 60
```

接著設定環境變數（設定一次即可；除非你之後修改，否則會跨部署保留）：

```bash
gcloud run services update life-dashboard-backend --region asia-east1 \
  --set-env-vars DATABASE_URL='jdbc:postgresql://ep-xxx-pooler.<region>.aws.neon.tech/neondb?sslmode=require' \
  --set-env-vars DATABASE_USERNAME='<user>' \
  --set-env-vars DATABASE_PASSWORD='<password>' \
  --set-env-vars FIREBASE_PROJECT_ID='<project-id>' \
  --set-env-vars CORS_ALLOWED_ORIGINS='https://your-app.vercel.app'
```

至於**服務帳戶 JSON**（內容含逗號 → 建議用 Secret Manager）：

```bash
# 把下載的 JSON 存成一個 secret
gcloud secrets create firebase-sa --data-file=serviceAccount.json

# 授權 Cloud Run 的執行階段服務帳戶可以讀取
PROJECT_NUMBER=$(gcloud projects describe 你的GCP專案ID --format='value(projectNumber)')
gcloud secrets add-iam-policy-binding firebase-sa \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role=roles/secretmanager.secretAccessor

# 把它掛載成 app 會讀取的環境變數
gcloud run services update life-dashboard-backend --region asia-east1 \
  --set-secrets FIREBASE_SERVICE_ACCOUNT_JSON=firebase-sa:latest
```

> 另外，輔助腳本 `backend/deploy.sh` 會用 `--set-env-vars` 一次設定所有變數
> （它用 `^@@^` 分隔符號來跳脫 JSON 裡的逗號）。但對任何機密資料，還是建議用
> Secret Manager。

Cloud Run 會自動注入 `PORT`；app 已經綁定 `server.port=${PORT:8080}`。

### 取得服務網址
```bash
gcloud run services describe life-dashboard-backend --region asia-east1 \
  --format 'value(status.url)'
```
把這個網址當作前端的 `VITE_API_BASE_URL`。

### 健康檢查
Cloud Run 會使用容器的 port；app 提供 `GET /actuator/health`（公開）。
可以這樣驗證：`curl https://<service-url>/actuator/health`。

### min / max 實例數（成本控制）
- `--min-instances 0` → **縮放到 0**，閒置不計費（閒置後第一次請求會冷啟動）。
- `--max-instances 1` → 限制最大並行數／費用，並保護 Neon 的連線上限。
- 之後可以這樣修改：
  ```bash
  gcloud run services update life-dashboard-backend --region asia-east1 \
    --min-instances 0 --max-instances 1
  ```

---

## 5. Frontend → Vercel

1. 把 repo 推上 GitHub。
2. 到 <https://vercel.com> → **Add New → Project** → 匯入這個 repo。
3. **Root Directory（根目錄）：** 設成 `frontend`。
4. 框架預設：**Vite**（會自動偵測；已內附 `vercel.json`）。
   - Build 指令：`npm run build` · 輸出目錄：`dist`。
   - SPA 改寫（rewrite）到 `index.html` 已經在 `frontend/vercel.json` 設定好了。
5. **環境變數**（Project Settings → Environment Variables）：
   ```
   VITE_API_BASE_URL      = https://<cloud-run-service-url>
   VITE_FIREBASE_API_KEY  = ...
   VITE_FIREBASE_AUTH_DOMAIN = <project>.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID  = <project-id>
   VITE_FIREBASE_APP_ID      = ...
   ```
6. **部署（Deploy）。** 複製正式網域（例如 `https://your-app.vercel.app`）。

### 把前後端串接起來
- 把 Vercel 網域加進 **Firebase → Authentication → 已授權的網域**。
- 把後端的 `CORS_ALLOWED_ORIGINS` 設成包含 Vercel 網域（多個用逗號分隔），
  然後重新部署／更新 Cloud Run 服務。

---

## 6. 端對端煙霧測試（Smoke test）

1. 打開 Vercel 網址 → 按 **Continue with Google** → 應該會進到儀表板。
2. 新增一筆待辦／體重 → 資料會保存（重新整理確認）。
3. 用另一個 Google 帳號打開 app → 應該看到一個**空的**儀表板
   （代表資料隔離正常運作）。
4. `curl https://<service-url>/actuator/health` → 應回傳 `{"status":"UP"}`。

---

## 7. 常見問題（踩雷排查）

| 症狀 | 原因／解法 |
| --- | --- |
| 每次呼叫 API 都 `401` | token 沒送出（檢查攔截器／登入），或後端 `FIREBASE_PROJECT_ID` 不一致。 |
| 瀏覽器出現 CORS 錯誤 | `CORS_ALLOWED_ORIGINS` 沒包含前端的完整來源（scheme + host，結尾不要斜線）。 |
| 登入視窗被擋／`auth/unauthorized-domain` | 把網域加進 Firebase 的「已授權的網域」。 |
| 後端啟動失敗：credentials 相關 | `FIREBASE_SERVICE_ACCOUNT_JSON` 是空的或格式錯誤；檢查 secret。 |
| 資料庫連線錯誤 | 要用 **JDBC** 格式、帶 `sslmode=require`、並使用 pooled 主機。 |
| 第一次請求很慢 | 這是 `min-instances=0` 的冷啟動 — 屬正常；之後的請求就很快。 |
```
