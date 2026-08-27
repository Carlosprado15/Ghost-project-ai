#!/usr/bin/env bash
# _adb-common.sh — resolve o caminho do adb.exe e funções compartilhadas.
# Usado (source) por device-check.sh, capture-log.sh, capture-screen.sh, capture-video.sh.
# Não é um script standalone.

set -euo pipefail

# Git Bash (MSYS) reescreve automaticamente qualquer argumento que pareça um caminho absoluto
# (ex: "/sdcard/foo.mp4") como se fosse um caminho do Windows, quebrando comandos "adb shell ... /sdcard/...".
# Isso desliga essa conversão para todo comando adb chamado a partir daqui.
export MSYS_NO_PATHCONV=1

WINGET_ADB="/c/Users/Bi/AppData/Local/Microsoft/WinGet/Packages/Google.PlatformTools_Microsoft.Winget.Source_8wekyb3d8bbwe/platform-tools/adb.exe"
LOCAL_BIN_ADB="/c/Users/Bi/bin/platform-tools/adb.exe"

resolve_adb() {
  if command -v adb >/dev/null 2>&1; then
    command -v adb
    return 0
  fi
  if [ -x "$WINGET_ADB" ]; then
    echo "$WINGET_ADB"
    return 0
  fi
  if [ -x "$LOCAL_BIN_ADB" ]; then
    echo "$LOCAL_BIN_ADB"
    return 0
  fi
  echo "" # não encontrado
  return 1
}

ADB="$(resolve_adb || true)"

if [ -z "$ADB" ]; then
  echo "[ERRO] adb.exe não encontrado. Locais verificados:" >&2
  echo "  - PATH (which adb)" >&2
  echo "  - $WINGET_ADB" >&2
  echo "  - $LOCAL_BIN_ADB" >&2
  echo "Instale platform-tools (ex: winget install Google.PlatformTools) ou informe o caminho manualmente." >&2
  exit 1
fi

# Garante que o daemon está de pé (idempotente, não altera nada se já estiver rodando).
"$ADB" start-server >/dev/null 2>&1 || true

# Retorna a lista de dispositivos com status "device" (autorizado e pronto), um serial por linha.
list_authorized_devices() {
  "$ADB" devices | awk 'NR>1 && $2=="device" {print $1}'
}

# Retorna a lista de dispositivos vistos (qualquer status), formatada "serial\tstatus".
list_all_devices() {
  "$ADB" devices -l | awk 'NR>1 && NF>0 {print $1"\t"$2}'
}

# Serial a usar: 1) $DEVICE_SERIAL se setado no ambiente, 2) único dispositivo autorizado, 3) erro se ambíguo/nenhum.
pick_device_serial() {
  if [ -n "${DEVICE_SERIAL:-}" ]; then
    echo "$DEVICE_SERIAL"
    return 0
  fi
  local devices
  devices="$(list_authorized_devices)"
  local count
  count=$(echo "$devices" | grep -c . || true)
  if [ "$count" -eq 0 ]; then
    echo ""
    return 1
  elif [ "$count" -eq 1 ]; then
    echo "$devices"
    return 0
  else
    echo "[ERRO] Mais de um dispositivo Android autorizado conectado. Defina DEVICE_SERIAL=<serial>." >&2
    echo "$devices" >&2
    echo ""
    return 1
  fi
}

# Alguns aparelhos (ex: celulares dobráveis/flip como o Motorola Razr) têm mais de um display físico
# (tela interna + tela externa). Nesses casos "adb shell screenrecord" sem --display-id explícito
# falha com "ERROR: INVALID_LAYER_STACK, please check your display state." (confirmado em teste real).
# Esta função pega o primeiro display físico listado por SurfaceFlinger e o usa como padrão.
# Se só existir um display, o comportamento é equivalente a não passar --display-id.
# Converte um caminho estilo Git Bash (/c/Users/...) para estilo Windows (C:\Users\...).
# Necessário para argumentos LOCAIS passados a "adb pull", já que MSYS_NO_PATHCONV=1 (acima)
# desliga a conversão automática que o adb.exe (binário nativo) precisaria para entender o caminho.
to_win_path() {
  cygpath -w "$1"
}

get_primary_display_id() {
  local serial="$1"
  "$ADB" -s "$serial" shell dumpsys SurfaceFlinger --display-id 2>/dev/null \
    | grep -oE 'Display [0-9]+' | head -1 | awk '{print $2}'
}
