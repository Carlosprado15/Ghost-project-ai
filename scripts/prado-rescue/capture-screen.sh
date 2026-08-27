#!/usr/bin/env bash
# capture-screen.sh — tira um screenshot do Android conectado via ADB, com timestamp.
# Parte da FASE 2 (USB/ADB Bridge) do protocolo AR LAB v1 (Ghost Project).
#
# Uso:
#   ./scripts/prado-rescue/capture-screen.sh                         # salva em local padrão com timestamp
#   ./scripts/prado-rescue/capture-screen.sh caminho/para/foto.png   # salva em caminho customizado
#
# DEVICE_SERIAL=<serial> ./capture-screen.sh   → força um dispositivo específico se houver mais de um.
#
# Lembrete do protocolo: uma screenshot isolada NÃO é evidência válida para métricas de FPS/frames
# perdidos (ver Fase 4 do protocolo) — serve só para inspeção visual pontual (ex: conferir se o
# modelo 3D carregou, se a UI está no estado esperado). Para métrica de performance, usar capture-video.sh.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=_adb-common.sh
source "$SCRIPT_DIR/_adb-common.sh"

TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
DEFAULT_DIR="$SCRIPT_DIR/../../docs/prado-rescue/evidence/_manual-captures"
OUTPUT="${1:-$DEFAULT_DIR/screenshot_${TIMESTAMP}.png}"

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
  DISPLAY_ARGS=(-d "$DISPLAY_ID")
fi

"$ADB" -s "$SERIAL" exec-out screencap -p "${DISPLAY_ARGS[@]}" > "$OUTPUT"

# Aparelhos com mais de uma tela física (ex: flip phones) às vezes respondem com um aviso de texto
# em vez da imagem, mesmo com -d informado (comportamento inconsistente observado em teste real).
# Detecta esse caso lendo os primeiros bytes do arquivo em vez de assumir que deu certo.
if [ -s "$OUTPUT" ] && head -c 8 "$OUTPUT" | grep -q "PNG"; then
  echo "Screenshot salvo em: $OUTPUT"
  ls -la "$OUTPUT"
else
  echo "[ERRO] Screenshot falhou, veio vazio, ou o dispositivo devolveu um aviso de texto em vez de imagem (ver conteúdo abaixo)." >&2
  head -c 300 "$OUTPUT" >&2 2>/dev/null || true
  rm -f "$OUTPUT"
  exit 1
fi
