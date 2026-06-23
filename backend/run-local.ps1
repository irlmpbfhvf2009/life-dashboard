# 本機啟動後端：載入 backend/.env 的環境變數後執行 Spring Boot。
# 用法（在 backend 資料夾）： powershell -ExecutionPolicy Bypass -File .\run-local.ps1
$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

# 指向 JDK 21（若你的路徑不同請修改）
$jdk21 = "C:\Program Files\Eclipse Adoptium\jdk-21.0.11.10-hotspot"
if (Test-Path $jdk21) { $env:JAVA_HOME = $jdk21 }

# 載入 .env（以「第一個 =」分隔 key/value，因為值裡可能含 = ）
$envFile = Join-Path $root ".env"
if (-not (Test-Path $envFile)) { throw "找不到 .env，請先依 .env.example 建立並填值" }
foreach ($line in Get-Content $envFile) {
  if ($line -match '^\s*#' -or $line -notmatch '=') { continue }
  $i = $line.IndexOf('=')
  Set-Item -Path "Env:$($line.Substring(0, $i).Trim())" -Value $line.Substring($i + 1)
}

# 優先用系統 mvn，否則用本機解壓的 Maven
$mvn = "mvn"
if (-not (Get-Command mvn -ErrorAction SilentlyContinue)) {
  $mvn = "C:\Users\ws794\tools\apache-maven-3.9.9\bin\mvn.cmd"
}
Write-Host "啟動後端中… (Ctrl+C 可停止)"
& $mvn spring-boot:run
