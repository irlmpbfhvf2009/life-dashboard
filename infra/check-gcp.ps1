# =============================================================================
# GCP 健檢 —— 開發前先跑一下，抓「計費異常 / 映像檔又在堆積」的早期訊號。
# 專盯 2026-07 咬到我們的那幾個訊號：計費被關、revision 暴增、AR 逼近免費上限、預算被改回過低。
# 用法（PowerShell）：  ./infra/check-gcp.ps1
# 唯讀，不改任何東西；billing 被關時也能跑（會直接紅字警告）。
# =============================================================================
$gcloud  = "C:\Users\ws794\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"
$project = "life-dashboard-17faa"
$region  = "asia-southeast1"
$acct    = "01A177-7C2783-5741D6"
$services = @("life-dashboard-backend", "veggie-game-server")
$revWarn = 5          # 單一服務 revision 超過這數 = 該清了
$arWarnGB = 0.4       # AR 超過 0.4GB = 逼近 0.5GB 免費上限
$budgetMin = 10       # 預算門檻低於這數(TWD) = 太敏感、容易誤關

$issues = @()
function Note($msg){ Write-Host "  $msg" }
function Warn($msg){ $script:issues += $msg; Write-Host "  ⚠ $msg" -ForegroundColor Yellow }
function Bad($msg){ $script:issues += $msg; Write-Host "  ✗ $msg" -ForegroundColor Red }

Write-Host "== GCP 健檢：$project ==" -ForegroundColor Cyan

# 1) 計費是否啟用（最重要）
Write-Host "`n[1] 計費狀態" -ForegroundColor Green
$be = (& $gcloud billing projects describe $project --format="value(billingEnabled)" 2>$null)
if ($be -eq "True") { Note "billingEnabled = True（正常）" }
else { Bad "billingEnabled = False —— 計費被關了！主站/遊戲都會 503。照 infra/README-billing.md 恢復。" }

# 2) 每個服務的 revision 數（堆積 = AR 映像檔膨脹的元兇）
Write-Host "`n[2] Cloud Run revision 堆積" -ForegroundColor Green
foreach ($svc in $services) {
  $n = (& $gcloud run revisions list --service $svc --region $region --project $project --format="value(metadata.name)" 2>$null | Measure-Object).Count
  if ($n -eq 0) { Note "$svc：查無（服務可能不存在或已移走）" }
  elseif ($n -gt $revWarn) { Warn "$svc：$n 個 revision（>$revWarn）——跑 ./infra/cleanup-gcp.ps1 清一清" }
  else { Note "$svc：$n 個 revision（正常）" }
}

# 3) Artifact Registry 大小 & 4) 預算門檻（都需計費啟用才讀得到）
if ($be -eq "True") {
  Write-Host "`n[3] Artifact Registry 大小" -ForegroundColor Green
  $bytes = (& $gcloud artifacts repositories describe cloud-run-source-deploy --location=$region --project=$project --format="value(sizeBytes)" 2>$null)
  if ($bytes) {
    $gb = [math]::Round($bytes/1GB, 3)
    if ($gb -gt $arWarnGB) { Warn "cloud-run-source-deploy = ${gb}GB（>${arWarnGB}GB，逼近 0.5GB 免費上限）——跑 cleanup-gcp.ps1" }
    else { Note "cloud-run-source-deploy = ${gb}GB（免費層內）" }
  } else { Note "（讀不到大小，可能無此儲存庫）" }

  Write-Host "`n[4] 預算門檻" -ForegroundColor Green
  $amt = (& $gcloud billing budgets list --billing-account=$acct --format="value(amount.specifiedAmount.units)" 2>$null | Select-Object -First 1)
  if ($amt) {
    if ([int]$amt -lt $budgetMin) { Warn "預算門檻 = NT`$$amt（<NT`$$budgetMin，太敏感易誤關）——建議調到 NT`$30" }
    else { Note "預算門檻 = NT`$$amt（正常）" }
  } else { Note "（讀不到預算，確認 Budgets 有設）" }
} else {
  Write-Host "`n[3][4] 略過（計費關閉時 Artifact Registry / Budget API 讀不到）" -ForegroundColor DarkGray
}

# 總結
Write-Host "`n== 結論 ==" -ForegroundColor Cyan
if ($issues.Count -eq 0) { Write-Host "✓ 一切正常，沒有異常訊號。" -ForegroundColor Green }
else { Write-Host ("發現 {0} 個要注意的項目（見上方 ⚠/✗）。" -f $issues.Count) -ForegroundColor Yellow }
