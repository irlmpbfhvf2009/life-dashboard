# =============================================================================
# GCP 省錢清理腳本 —— 一恢復計費就跑這支。
#
# 目的：把「跟有沒有人玩無關的固定費用」歸零，讓專案真正回到免費層。
#   1) 刪掉每個 Cloud Run 服務的舊 revision（只留最新 3 版）
#   2) 給 Artifact Registry 裝「自動清理政策」（只留最近 3 版映像檔，其餘刪掉）
#      —— 這步會把堆積的好幾 GB 映像檔清掉，之後也不會再堆積。
#
# 前提：先在 GCP Console 恢復計費（Billing → 重新連結專案），否則 API 會擋。
# 用法（PowerShell）：  ./infra/cleanup-gcp.ps1
# 先預覽不刪：          ./infra/cleanup-gcp.ps1 -DryRun
# =============================================================================
param(
  [switch]$DryRun = $false
)

$ErrorActionPreference = 'Stop'
$gcloud  = "C:\Users\ws794\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"
$project = "life-dashboard-17faa"
$region  = "asia-southeast1"
$keep    = 3                                   # 每個服務 / 映像檔要保留的最新版本數
$services = @("life-dashboard-backend", "veggie-game-server")
$repo    = "cloud-run-source-deploy"           # gcloud run deploy --source 用的預設 AR 儲存庫

Write-Host "== 專案 $project / 區域 $region ==" -ForegroundColor Cyan
if ($DryRun) { Write-Host "(DryRun：只列出、不刪除)" -ForegroundColor Yellow }

# ---------------------------------------------------------------- 1) 清 Cloud Run 舊 revision
foreach ($svc in $services) {
  Write-Host "`n--- Cloud Run: $svc ---" -ForegroundColor Green
  # 依建立時間新到舊排序，跳過最新 $keep 個，其餘刪掉
  $revs = & $gcloud run revisions list --service $svc --region $region --project $project `
            --sort-by="~metadata.creationTimestamp" --format="value(metadata.name)"
  if (-not $revs) { Write-Host "  (查不到 revision，服務可能不存在)"; continue }
  $revs = @($revs)
  $old  = if ($revs.Count -gt $keep) { $revs[$keep..($revs.Count-1)] } else { @() }
  Write-Host ("  共 {0} 版，保留最新 {1} 版，刪除 {2} 版" -f $revs.Count, $keep, $old.Count)
  foreach ($r in $old) {
    if ($DryRun) { Write-Host "  [would delete] $r" }
    else {
      try { & $gcloud run revisions delete $r --region $region --project $project --quiet; Write-Host "  deleted $r" }
      catch { Write-Host "  跳過 $r（可能仍在服務流量中）: $_" -ForegroundColor DarkYellow }
    }
  }
}

# ---------------------------------------------------------------- 2) Artifact Registry 自動清理政策
Write-Host "`n--- Artifact Registry 清理政策：$repo ---" -ForegroundColor Green
$policy = Join-Path $PSScriptRoot "artifact-cleanup-policy.json"
if ($DryRun) {
  # 預覽這政策會刪哪些（不實際刪）
  & $gcloud artifacts repositories set-cleanup-policies $repo --location=$region --project=$project `
      --policy=$policy --dry-run
} else {
  # 套用政策（保留最新 3 版、其餘刪除），並實際執行一次清理
  & $gcloud artifacts repositories set-cleanup-policies $repo --location=$region --project=$project `
      --policy=$policy --no-dry-run
  Write-Host "  已套用清理政策（只留最近 $keep 版映像檔，之後自動維持）"
}

Write-Host "`n== 完成 ==" -ForegroundColor Cyan
Write-Host "接著建議：到 Billing → Budgets 把預算 NT`$1 改成 NT`$30（見 infra/README-billing.md）"
