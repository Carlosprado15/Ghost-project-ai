#!/usr/bin/env bash
# device-check.sh — detecta um Android real conectado por USB via ADB.
# Parte da FASE 2 (USB/ADB Bridge) do protocolo AR LAB v1 (Ghost Project).
#
# Uso:
#   ./scripts/prado-rescue/device-check.sh
#
# Não instala nada, não pede root, não altera configuração do aparelho.
# Só lê o estado do que já está conectado.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=_adb-common.sh
source "$SCRIPT_DIR/_adb-common.sh"

echo "=== ADB ==="
echo "binário: $ADB"
"$ADB" version | head -1

echo ""
echo "=== Dispositivos vistos (adb devices -l) ==="
"$ADB" devices -l | sed '1d'

ALL="$(list_all_devices || true)"
if [ -z "$ALL" ]; then
  echo ""
  echo "[INFO] Nenhum dispositivo Android detectado no momento."
  echo "Verifique: cabo USB conectado, 'Depuração USB' ativada no celular,"
  echo "e a caixa de diálogo de autorização ADB aceita na tela do aparelho."
  exit 0
fi

echo ""
echo "=== Status por dispositivo ==="
while IFS=$'\t' read -r serial status; do
  [ -z "$serial" ] && continue
  case "$status" in
    device)
      echo "[OK] $serial — autorizado e pronto"
      ;;
    unauthorized)
      echo "[AÇÃO NECESSÁRIA] $serial — conectado mas NÃO autorizado. Aceite o prompt 'Permitir depuração USB?' na tela do celular."
      ;;
    offline)
      echo "[AVISO] $serial — offline (reconecte o cabo ou reinicie o adb: adb kill-server && adb start-server)."
      ;;
    *)
      echo "[AVISO] $serial — status desconhecido: $status"
      ;;
  esac
done <<< "$ALL"

echo ""
echo "=== Detalhes dos dispositivos autorizados ==="
AUTHORIZED="$(list_authorized_devices || true)"
if [ -z "$AUTHORIZED" ]; then
  echo "[INFO] Nenhum dispositivo autorizado para consultar detalhes."
  exit 0
fi

while read -r serial; do
  [ -z "$serial" ] && continue
  echo "--- $serial ---"
  MODEL=$("$ADB" -s "$serial" shell getprop ro.product.model 2>/dev/null | tr -d '\r')
  MANUF=$("$ADB" -s "$serial" shell getprop ro.product.manufacturer 2>/dev/null | tr -d '\r')
  ANDROID=$("$ADB" -s "$serial" shell getprop ro.build.version.release 2>/dev/null | tr -d '\r')
  SDK=$("$ADB" -s "$serial" shell getprop ro.build.version.sdk 2>/dev/null | tr -d '\r')
  EGL=$("$ADB" -s "$serial" shell getprop ro.hardware.egl 2>/dev/null | tr -d '\r')
  SIZE=$("$ADB" -s "$serial" shell wm size 2>/dev/null | tr -d '\r')
  DENSITY=$("$ADB" -s "$serial" shell wm density 2>/dev/null | tr -d '\r')
  echo "  Fabricante:      $MANUF"
  echo "  Modelo:          $MODEL"
  echo "  Android:         $ANDROID (SDK $SDK)"
  echo "  GPU (egl hint):  $EGL"
  echo "  Tela:            $SIZE"
  echo "  Densidade:       $DENSITY"
done <<< "$AUTHORIZED"

echo ""
echo "Concluído."
