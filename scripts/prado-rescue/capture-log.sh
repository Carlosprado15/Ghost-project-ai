#!/usr/bin/env bash
# capture-log.sh — captura logcat do Android conectado via ADB e salva em arquivo.
# Parte da FASE 2 (USB/ADB Bridge) do protocolo AR LAB v1 (Ghost Project).
#
# Uso:
#   ./scripts/prado-rescue/capture-log.sh                              # streaming até Ctrl+C, salva em local padrão
#   ./scripts/prado-rescue/capture-log.sh 10                           # captura por 10s (limpa o buffer antes) e para sozinho
#   ./scripts/prado-rescue/capture-log.sh 10 caminho/para/logcat.txt   # captura por 10s, salva em caminho customizado
#
# DEVICE_SERIAL=<serial> ./capture-log.sh   → força um dispositivo específico se houver mais de um.
#
# Não filtra por padrão (logcat completo) — quem consome o arquivo depois (ex: Fase 4/evidence pack)
# decide o que é relevante. Não altera nada no aparelho; não precisa de root.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=_adb-common.sh
source "$SCRIPT_DIR/_adb-common.sh"

DURATION="${1:-0}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
DEFAULT_DIR="$SCRIPT_DIR/../../docs/prado-rescue/evidence/_manual-captures"
OUTPUT="${2:-$DEFAULT_DIR/logcat_${TIMESTAMP}.txt}"

SERIAL="$(pick_device_serial || true)"
if [ -z "$SERIAL" ]; then
  echo "[ERRO] Nenhum dispositivo Android autorizado encontrado. Rode device-check.sh primeiro." >&2
  exit 1
fi

mkdir -p "$(dirname "$OUTPUT")"

echo "Dispositivo: $SERIAL"
echo "Saída: $OUTPUT"

if [ "$DURATION" -gt 0 ] 2>/dev/null; then
  echo "Limpando buffer de log e capturando por ${DURATION}s..."
  "$ADB" -s "$SERIAL" logcat -c
  "$ADB" -s "$SERIAL" logcat -v threadtime > "$OUTPUT" 2>&1 &
  LOGPID=$!
  sleep "$DURATION"
  kill "$LOGPID" 2>/dev/null || true
  wait "$LOGPID" 2>/dev/null || true
  echo "Captura de ${DURATION}s concluída."
else
  echo "Streaming contínuo (Ctrl+C para parar)..."
  "$ADB" -s "$SERIAL" logcat -v threadtime | tee "$OUTPUT"
fi

echo "Logcat salvo em: $OUTPUT"
wc -l < "$OUTPUT" | xargs echo "Linhas capturadas:"
