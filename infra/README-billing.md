# 計費恢復 & 省錢 Runbook

> 2026-07：billing-guard 因 NT$1 預算被超過而關閉了整個專案計費（主因是 **81 個 Cloud Run
> revision 堆積的容器映像檔** 超過 Artifact Registry 0.5GB 免費額度，跟有沒有人玩無關）。
> 這份是「恢復 + 讓它真正回到免費層 + 不再被誤關」的步驟。

## 一次做完的順序

### 1. 恢復計費
GCP Console → Billing → 選專案 `life-dashboard-17faa` → **Link a billing account** → 選帳單帳戶
`01A177-7C2783-5741D6`。
或 CLI：
```powershell
& "C:\Users\ws794\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd" `
  billing projects link life-dashboard-17faa --billing-account=01A177-7C2783-5741D6
```

### 2. 清掉堆積的映像檔（把固定費用歸零）
```powershell
./infra/cleanup-gcp.ps1 -DryRun   # 先預覽會刪什麼
./infra/cleanup-gcp.ps1           # 確認後實際清理
```
會做兩件事：刪掉每個服務多餘的舊 revision（留最新 3 版）、給 Artifact Registry 裝自動清理政策
（`artifact-cleanup-policy.json`，只留最近 3 版映像檔），把好幾 GB 垃圾清回 0.5GB 免費內、之後也不再堆積。

### 3. 把預算門檻從 NT$1 調到 NT$30（避免零頭誤觸）
**Console（最簡單）**：Billing → **Budgets & alerts** → 開啟現有預算 → **Amount** 由 `1` 改成 `30`（TWD）→ 儲存。
（順便把 email 警示設在 50% / 90%，真的有花費會先收到信、而不是直接被關。）

CLI：
```powershell
$gc = "C:\Users\ws794\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"
& $gc billing budgets list --billing-account=01A177-7C2783-5741D6   # 找出 BUDGET_ID
& $gc billing budgets update BUDGET_ID --billing-account=01A177-7C2783-5741D6 --budget-amount=30TWD
```

## 為什麼這樣就不會再一直花錢
- **映像檔儲存**：清理後 < 0.5GB = 免費，且政策自動維持，不再累積。
- **運算**：兩個 Cloud Run 服務都是 min=0，沒人用就 0；主後端按請求計費、輕量，穩在免費層。
- **遊戲伺服器**：搬去 Render 免費層（見根目錄 `render.yaml`），把「將來有人玩時 WebSocket 常駐燒 vCPU」的風險也移出 Google。
- billing-guard **機制不變**（`index.js` 照舊），只是門檻 NT$1 → NT$30 當安全網，正常情況永遠不會觸發。

## billing-guard 運作備忘
`infra/billing-guard/index.js` 是 Cloud Function（gen2，entry `stopBilling`，region asia-southeast1，
吃 Pub/Sub topic `billing-alerts`）；收到 Cloud Billing 預算通知後，若 `花費 > max(通知的budget, GUARD_MIN_COST)`
就把專案 `billingAccountName` 設空字串＝停用計費。

**2026-07 改良（重要）**：舊版盲信「通知裡的 budgetAmount」，但 GCP 預算通知會延遲數小時、送出**過時的低 budget 值**
（實測改成 NT$30 後、通知仍送 `budget=1`），導致花費才 NT$1.27 也被當成「超支」把整個專案關掉。改良版加了
**絕對下限 `GUARD_MIN_COST`（env，預設 50）**：花費低於此金額一律不關，天生免疫這個延遲 bug。

重新部署 guard：
```powershell
$gc = "C:\Users\ws794\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"
& $gc functions deploy billing-guard --gen2 --region=asia-southeast1 --runtime=nodejs20 `
  --entry-point=stopBilling --trigger-topic=billing-alerts --source=infra/billing-guard `
  --update-env-vars=GUARD_MIN_COST=50 --project=life-dashboard-17faa
```

重新建立預算（接回 `billing-alerts` topic，餵通知給 guard）：
```powershell
& $gc billing budgets create --billing-account=01A177-7C2783-5741D6 --display-name=life-dashboard-guard `
  --budget-amount=100TWD --filter-projects=projects/463356502015 --calendar-period=month `
  --threshold-rule=percent=0.9 --threshold-rule=percent=1.0 `
  --all-updates-rule-pubsub-topic=projects/life-dashboard-17faa/topics/billing-alerts
```

**緊急止血（guard 誤殺整站時）**：billing 被關又一直被 guard 立刻關回去，是因為 Pub/Sub 有排隊的舊通知。
解法＝刪掉 guard 的訂閱丟掉排隊訊息，再重開計費：
`gcloud pubsub subscriptions delete <eventarc-...-billing-guard-...-sub-...>` → `gcloud billing projects link ...`。
