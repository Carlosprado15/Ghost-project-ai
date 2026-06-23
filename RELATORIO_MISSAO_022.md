# RELATORIO_MISSAO_022

## 1. Arquivos modificados
- `src/tracking/WristTracker.js`

## 2. Métodos alterados
- `_calculateConfidence`

## 3. O que foi alterado
1. `palmWidth` passou a usar `landmarks[5].x/y - landmarks[17].x/y` (coords normalizadas 0-1) em vez de `indexMcp.x/y - pinkyMcp.x/y` (pixels de tela)
2. Threshold de palmWidth alterado de `< 30 || > 300` (pixels) para `< 0.04 || > 0.5` (normalizado)
3. `wristToPalm` passou a usar `landmarks[5] - landmarks[0]` normalizados em vez de `indexMcp - wrist` em pixels
4. `zVariance` passou a usar `landmarks[0].z || 0` e `landmarks[5].z || 0` explicitamente
5. Adicionado guard `palmWidth || 0.001` na divisão do ratio para evitar division-by-zero
6. Parâmetros `wrist`, `indexMcp`, `pinkyMcp` da assinatura preservados (unused — mudança apenas no corpo)

## 4. Build
```
✓ 46 modules transformed.
dist/assets/index-DvZ0R0Q9.js   436.09 kB │ gzip: 128.52 kB
✓ built in 16.20s
```
Sem erros, sem warnings críticos.

## 5. Pendências
1. Testar em celular físico (câmera traseira e frontal) para confirmar que tracking ativa
2. Testar Fluxo 1 (Vercel → Start Scanner → QR) e Fluxo 2 (Click & Wear → Ver em AR)
3. Avaliar se `_toLandmark` precisa corrigir a resolução assumida (1280×720 → 640×480) para melhorar precisão de posição

## 6. Próxima missão sugerida
**M023 — Calibração da posição do relógio no pulso**: `_toLandmark` ainda assume câmera 1280×720 quando a real é 640×480, causando leve offset horizontal do modelo em posições fora do centro do frame.
