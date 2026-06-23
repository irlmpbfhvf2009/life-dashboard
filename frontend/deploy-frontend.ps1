# 前端一鍵部署到 Vercel（正式環境）。
#
# 為什麼用這種方式：在 Windows PowerShell 5.1 用 `vercel env add` 經由管線設定
# 環境變數時，主控台編碼會在值開頭黏上一個隱形 BOM 字元，導致 Firebase API key
# 失效（auth/network-request-failed）。為了避免這個坑，我們改用「本機建置 + 預先
# 建置部署（--prebuilt）」：環境變數由本機 .env.production.local 在建置時烤入，
# 完全不依賴 Vercel 雲端的環境變數。
#
# 前置：
#   1. 已安裝 Node、已 `vercel login`、已 `vercel link`（專案 life-dashboard）
#   2. 已建立 frontend/.env.production.local（參考 .env.example，填入正式值）
#
# 用法（在 frontend 資料夾）：
#   powershell -ExecutionPolicy Bypass -File .\deploy-frontend.ps1

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
Set-Location $root

if (-not (Test-Path ".env.production.local")) {
  throw "找不到 .env.production.local —— 請先依 .env.example 建立並填入正式環境的值。"
}

Write-Host "==> 本機建置（值由 .env.production.local 烤入）"
npm run build

Write-Host "==> 組裝 Vercel 預先建置輸出 (.vercel/output)"
$out = Join-Path $root ".vercel\output"
New-Item -ItemType Directory -Force -Path (Join-Path $out "static") | Out-Null
Copy-Item -Path "dist\*" -Destination (Join-Path $out "static") -Recurse -Force
$config = '{ "version": 3, "routes": [ { "handle": "filesystem" }, { "src": "/(.*)", "dest": "/index.html" } ] }'
[System.IO.File]::WriteAllText((Join-Path $out "config.json"), $config, (New-Object System.Text.UTF8Encoding $false))

Write-Host "==> 部署到 Vercel 正式環境"
vercel deploy --prebuilt --prod --yes

Write-Host "完成。正式網址：https://life-dashboard-blue-omega.vercel.app"
