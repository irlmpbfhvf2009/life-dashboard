# API 文件（API Reference）

Base URL（本機）：`http://localhost:8080`
Base URL（正式）：你的 Cloud Run 服務網址。

## 通則

- **認證：** 每個 `/api/**` 端點都需要
  `Authorization: Bearer <firebase_id_token>`。
- **統一格式：** 所有回應都使用：

```jsonc
{ "success": true,  "data": <內容>, "message": null }      // 成功
{ "success": false, "data": null,   "message": "原因" }    // 失敗
```

- **狀態碼：** `200` 成功 · `400` 驗證／輸入錯誤 · `401` 缺少或無效 token ·
  `404` 找不到或不屬於呼叫者 · `500` 非預期錯誤。
- **日期：** `date` 欄位格式為 `YYYY-MM-DD`。時間戳（`createdAt`、`updatedAt`）
  為 ISO-8601 UTC 格式。

### 測試時如何取得 token

前端是透過 Firebase 取得 ID token。要手動用 `curl` 測試時，最簡單的方式是先登入
正在運行的 SPA，打開瀏覽器開發者工具（DevTools）的 console，執行：

```js
await firebase.auth().currentUser.getIdToken()   // 若 firebase compat 是全域變數
// 或者在這個專案的模組環境下：
// (await import('/src/firebase.ts')).auth.currentUser.getIdToken()
```

然後把它匯出成環境變數：

```bash
export TOKEN="貼上 firebase id token"
export API="http://localhost:8080"
```

以下所有範例都假設 `$TOKEN` 與 `$API` 已經設定好。

---

## 個人資料（Profile）

### `GET /api/me`
回傳目前使用者（第一次呼叫時會自動建立）。

```bash
curl -s "$API/api/me" -H "Authorization: Bearer $TOKEN"
```
```json
{ "success": true, "data": {
  "id": 1, "firebaseUid": "abc123", "email": "you@example.com",
  "displayName": "You", "photoUrl": "https://...",
  "createdAt": "2026-06-23T10:00:00Z", "updatedAt": "2026-06-23T10:00:00Z"
}, "message": null }
```

### `PATCH /api/me`
請求內容（皆可省略）：`displayName`、`photoUrl`。

```bash
curl -s -X PATCH "$API/api/me" -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"displayName":"新名字"}'
```

---

## 儀表板首頁（Dashboard）

### `GET /api/dashboard`

```bash
curl -s "$API/api/dashboard" -H "Authorization: Bearer $TOKEN"
```
```json
{ "success": true, "data": {
  "todayTodoCount": 2, "todayDoneCount": 1,
  "weekWeightTrend": [{ "id": 5, "date": "2026-06-22", "weight": 70.5, "note": null, "createdAt": "..." }],
  "monthExpenseTotal": 142.50,
  "recentFoods": [], "recentMoods": [], "recentNotes": []
}, "message": null }
```

回傳欄位：今日待辦數、今日完成數、本週體重趨勢、本月支出總額、最近飲食、
最近心情、最近筆記。

---

## 待辦（Todos）

| 方法 | 路徑 | 說明 |
| --- | --- | --- |
| GET | `/api/todos?status=TODO\|DONE` | `status` 可省略 |
| POST | `/api/todos` | 新增 |
| PATCH | `/api/todos/{id}` | 部分更新 |
| DELETE | `/api/todos/{id}` | 刪除 |

新增內容：`title*`、`description`、`priority`（`LOW\|MEDIUM\|HIGH`，預設 `MEDIUM`）、`dueDate`。
更新內容（任意子集）：`title`、`description`、`status`、`priority`、`dueDate`。
（標 `*` 為必填。）

```bash
# 新增
curl -s -X POST "$API/api/todos" -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"買菜","priority":"HIGH","dueDate":"2026-06-23"}'

# 列出進行中的
curl -s "$API/api/todos?status=TODO" -H "Authorization: Bearer $TOKEN"

# 標記為完成
curl -s -X PATCH "$API/api/todos/1" -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d '{"status":"DONE"}'

# 刪除
curl -s -X DELETE "$API/api/todos/1" -H "Authorization: Bearer $TOKEN"
```

---

## 體重（Weight）

| 方法 | 路徑 |
| --- | --- |
| GET | `/api/weights` |
| GET | `/api/weights/latest` |
| GET | `/api/weights/stats?range=7d\|30d\|90d` |
| POST | `/api/weights` |
| DELETE | `/api/weights/{id}` |

新增內容：`date*`、`weight*`（公斤，需為正數）、`note`。

```bash
curl -s -X POST "$API/api/weights" -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"date":"2026-06-23","weight":70.4,"note":"早上量的"}'

curl -s "$API/api/weights/stats?range=30d" -H "Authorization: Bearer $TOKEN"
```
統計回傳：`{ range, count, min, max, average, change, points[] }`。

---

## 飲食（Food）

| 方法 | 路徑 |
| --- | --- |
| GET | `/api/foods` |
| POST | `/api/foods` |
| DELETE | `/api/foods/{id}` |

新增內容：`date*`、`mealType*`（`BREAKFAST\|LUNCH\|DINNER\|SNACK`）、`foodText*`、`note`。

```bash
curl -s -X POST "$API/api/foods" -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"date":"2026-06-23","mealType":"LUNCH","foodText":"雞肉沙拉"}'
```

---

## 記帳（Expenses）

| 方法 | 路徑 |
| --- | --- |
| GET | `/api/expenses` |
| GET | `/api/expenses/stats/monthly?month=YYYY-MM` |
| POST | `/api/expenses` |
| DELETE | `/api/expenses/{id}` |

新增內容：`date*`、`amount*`（需為正數）、`category*`、`description`。
`month` 省略時預設為當月。

```bash
curl -s -X POST "$API/api/expenses" -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"date":"2026-06-23","amount":12.50,"category":"餐飲","description":"午餐"}'

curl -s "$API/api/expenses/stats/monthly?month=2026-06" -H "Authorization: Bearer $TOKEN"
```
統計回傳：`{ month, total, byCategory: [{ category, total }] }`。

---

## 心情（Mood）

| 方法 | 路徑 |
| --- | --- |
| GET | `/api/moods` |
| GET | `/api/moods/stats?days=30` |
| POST | `/api/moods` |
| DELETE | `/api/moods/{id}` |

新增內容：`date*`、`moodScore*`（整數 1～5）、`note`。

```bash
curl -s -X POST "$API/api/moods" -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"date":"2026-06-23","moodScore":4,"note":"今天很不錯"}'

curl -s "$API/api/moods/stats?days=30" -H "Authorization: Bearer $TOKEN"
```
統計回傳：`{ count, average, distribution: {"1":n,...,"5":n}, points[] }`。

---

## 筆記（Notes）

| 方法 | 路徑 |
| --- | --- |
| GET | `/api/notes` |
| POST | `/api/notes` |
| PATCH | `/api/notes/{id}` |
| DELETE | `/api/notes/{id}` |

新增內容：`title*`、`content`。更新內容（任意子集）：`title`、`content`。

```bash
curl -s -X POST "$API/api/notes" -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"靈感","content":"做一個生活儀表板"}'
```

---

## 錯誤範例

```jsonc
// 401 — 沒有 / 無效的 token
{ "success": false, "data": null, "message": "Unauthorized: missing or invalid token" }

// 400 — 驗證失敗
{ "success": false, "data": null, "message": "title: title is required" }

// 404 — 找不到或不屬於你
{ "success": false, "data": null, "message": "Todo not found: 99" }
```

---

## Postman

要匯入成 collection，可以照上面每一列各建立一個 request。設定一個 collection 變數
`token`，並在 collection 層級加一個 header `Authorization: Bearer {{token}}`，
再加一個變數 `baseUrl`。這樣每個 request 都會自動帶上認證。
```
