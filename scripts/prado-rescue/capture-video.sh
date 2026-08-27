#!/usr/bin/env bash
# capture-video.sh — grava a tela do Android continuamente via ADB (screenrecord) e traz o vídeo pro PC.
# Parte da FASE 2 (USB/ADB Bridge) do protocolo AR LAB v1 (Ghost Project).
#
# Necessário para qualquer métrica real de FPS/frames perdidos — uma screenshot isolada não basta
# (ver Fase 4 do protocolo: regra de confiabilidade de métricas).
#
# Uso:
#   ./scripts/prado-rescue/capture-video.sh                          # 10s, salva em local padrão
#   ./scripts/prado-rescue/capture-video.sh 15                       # 15s
#   ./scripts/prado-rescue/capture-video.sh 15 caminho/para/video.mp4
#
# DEVICE_SERIAL=<serial> ./capture-video.sh   → força um dispositivo específico se houver mais de um.
#
# Limitação conhecida do Android: `screenrecord` tem limite de 180s (3 minutos) por gravação.
# Para capturas mais longas seria necessário encadear múltiplas chamadas — fora do escopo desta fase.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=_adb-common.sh
source "$SCRIPT_DIR/_adb-common.sh"

DURATION="${1:-10}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
DEFAULT_DIR="$SCRIPT_DIR/../../docs/prado-rescue/evidence/_manual-captures"
OUTPUT="${2:-$DEFAULT_DIR/video_${TIMESTAMP}.mp4}"
REMOTE_FILE="/sdcard/prado_rescue_capture_${TIMESTAMP}.mp4"

if [ "$DURATION" -gt 180 ] 2>/dev/null; then
  echo "[AVISO] Duração pedida (${DURATION}s) excede o limite do screenrecord (180s). Ajustando para 180s." >&2
  DURATION=180
fi

SERIAL="$(pick_device_serial || true)"
if [ -z "$SERIAL" ]; then
  echo "[ERRO] Nenhum dispositivo Android autorizado encontrado. Rode device-check.sh primeiro." >&2
  exit 1
fi

mkdir -p "$(dirname "$OUTPUT")"

echo "Dispositivo: $SERIAL"

DISPLAY_ARGS=()
DISPLAY_ID="$(get_primary_display_id "$SERIAL" || true)"
if [ -n "$DISPLAY_ID" ]; then
  DISPLAY_ARGS=(--display-id "$DISPLAY_ID")
  echo "Display detectado: $DISPLAY_ID (necessário em aparelhos com mais de uma tela física, ex: flip phones)"
fi

echo "Gravando ${DURATION}s de tela (arquivo remoto: $REMOTE_FILE)..."
echo "[SINALIZE AO OPERADOR: pode iniciar/interagir com a experiência AR agora]"

"$ADB" -s "$SERIAL" shell screenrecord "${DISPLAY_ARGS[@]}" --time-limit "$DURATION" "$REMOTE_FILE"

echo "Gravação finalizada. Puxando arquivo para o PC..."
"$ADB" -s "$SERIAL" pull "$REMOTE_FILE" "$(to_win_path "$OUTPUT")"
"$ADB" -s "$SERIAL" shell rm -f "$REMOTE_FILE"

if [ -s "$OUTPUT" ]; then
  echo "Vídeo salvo em: $OUTPUT"
  ls -la "$OUTPUT"
else
  echo "[ERRO] Vídeo falhou ou arquivo veio vazio." >&2
  exit 1
fi
