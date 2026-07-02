# start-m069b.ps1 — Sessão M069B completa (Tasks Wrist Lab)
# Executar na raiz do projeto: powershell -File src\labs\tasks-wrist\start-m069b.ps1

$ProjectRoot = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))
Set-Location $ProjectRoot

# ── Localizar adb.exe ─────────────────────────────────────────────────────────
$AdbCandidates = @(
  "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe",
  "$env:ProgramFiles\Android\android-sdk\platform-tools\adb.exe",
  "C:\Android\platform-tools\adb.exe",
  "C:\adb\adb.exe"
)
$Adb = (Get-Command adb -ErrorAction SilentlyContinue)?.Source
foreach ($c in $AdbCandidates) { if (-not $Adb -and (Test-Path $c)) { $Adb = $c } }

if (-not $Adb) {
  Write-Host @"
[ERRO] adb.exe não encontrado.

Para instalar:
  1. Acesse: https://developer.android.com/tools/releases/platform-tools
  2. Baixe "SDK Platform-Tools for Windows"
  3. Extraia em C:\Android\platform-tools\
  4. Habilite "Depuração USB" no celular (Configurações → Sobre → tap 7x no Número de build)
  5. Conecte o USB e rode este script novamente.
"@ -ForegroundColor Red
  exit 1
}

Write-Host "[adb] Usando: $Adb" -ForegroundColor Cyan

# ── Verificar device conectado ─────────────────────────────────────────────────
$Devices = & $Adb devices 2>&1 | Select-String "device$"
if (-not $Devices) {
  Write-Host "[ERRO] Nenhum dispositivo Android detectado. Conecte o celular via USB e ative a Depuração USB." -ForegroundColor Red
  exit 1
}
Write-Host "[adb] Device detectado." -ForegroundColor Green

# ── adb reverse ───────────────────────────────────────────────────────────────
Write-Host "[adb] Configurando reverse tunnels..."
& $Adb reverse tcp:5173 tcp:5173
& $Adb reverse tcp:5174 tcp:5174

# ── Iniciar report server em background ───────────────────────────────────────
Write-Host "[server] Iniciando reportServer em porta 5174..."
$rsJob = Start-Job -ScriptBlock {
  param($root)
  Set-Location $root
  node src/labs/tasks-wrist/reportServer.mjs
} -ArgumentList $ProjectRoot

# ── Aguardar report server subir ──────────────────────────────────────────────
$maxWait = 10; $waited = 0
do {
  Start-Sleep 1; $waited++
  try { $h = Invoke-WebRequest "http://localhost:5174/health" -UseBasicParsing -TimeoutSec 1 -ErrorAction Stop } catch { $h = $null }
} while (-not $h -and $waited -lt $maxWait)
if ($h) { Write-Host "[server] reportServer OK." -ForegroundColor Green }
else     { Write-Host "[server] reportServer não respondeu — POST do relatório pode falhar." -ForegroundColor Yellow }

# ── Iniciar Vite dev server em background ─────────────────────────────────────
Write-Host "[vite] Iniciando dev server..."
$viteJob = Start-Job -ScriptBlock {
  param($root)
  Set-Location $root
  npm run dev -- --host 0.0.0.0
} -ArgumentList $ProjectRoot

Start-Sleep 4
Write-Host "[vite] Dev server iniciado (porta 5173)." -ForegroundColor Green

# ── Abrir URL no celular ───────────────────────────────────────────────────────
$Url = "http://localhost:5173/?lab=tasks-wrist&auto=1"
Write-Host "[adb] Abrindo: $Url"
# Aspas simples dentro de duplas para proteger o & no shell Android
& $Adb shell "am start -a android.intent.action.VIEW -d '$Url'"

Write-Host @"

─────────────────────────────────────────────
  M069B em execução.
  URL no celular: $Url
  Quando a câmera detectar o pulso, o fluxo
  automático de calibração inicia sozinho.
  Relatório será salvo em:
    src/labs/tasks-wrist/M069B_FILTER_CALIBRATION_REPORT.md
─────────────────────────────────────────────
"@ -ForegroundColor Cyan

Write-Host "Pressione Ctrl+C para parar os servidores."
try { Wait-Job $rsJob, $viteJob | Receive-Job }
finally { Stop-Job $rsJob, $viteJob; Remove-Job $rsJob, $viteJob -Force }
