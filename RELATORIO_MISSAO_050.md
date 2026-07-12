# RELATORIO_MISSAO_050

## 1. Arquivos modificados
- `public/models/CW001.glb` … `CW011.glb` (11 arquivos — regerados via Tripo3D)
- `public/models/normalized/CW001.glb` … `CW011.glb`
- `scripts/normalize-glb/product-calibration-overrides.json`
- `scripts/normalize-glb/generate-from-tripo.mjs`
- `scripts/normalize-glb/VALIDATION_REPORT.md`

**Novos:**
- `scripts/normalize-glb/clean_bg.py` — limpeza de fundo (rembg/u2net + maior blob conectado)
- `scripts/normalize-glb/compute-pca-rotation.mjs` — calculadora de rotação inicial via PCA
- `scripts/normalize-glb/fotos-limpas/` — fotos de fornecedor enviadas por você + versão mapeada por CW-código (`fotos-limpas/mapped/`)

## 2. Métodos alterados
- `generate-from-tripo.mjs`: `generateOne()` (suporte a foto local pré-mapeada), `GEN_OPTIONS` (+ `enable_image_autofix`), novas funções `cleanImage()`, `uploadFile()`
- `product-calibration-overrides.json`: `type` corrigido (CW009, CW011), `rotationDeg` recalculado (11 produtos), `status` de `calibrated`→`needs_calibration` (11 produtos — dado antigo estava mentindo)

## 3. O que foi alterado
1. Descoberta: fotos de vitrine (produto no pulso) geravam "braço fantasma" no 3D — Tripo3D reconstrói a cena inteira, não só o produto
2. `clean_bg.py` criado — remove fundo/pulso/selos de propaganda antes de gerar (testado, funciona bem em fundo de estúdio; falha quando produto encosta em outro objeto — pedra, mão)
3. 11 de 15 produtos (CW001–CW011) regerados do zero via Tripo3D com fotos limpas + qualidade máxima (créditos acabaram no CW012)
4. Bug achado e corrigido: CW009 e CW011 tinham `type` errado no arquivo de calibração (dado sobrado de antes desta missão) — isso sozinho corrigiu boa parte da orientação
5. Reativada (só como calculadora offline, não como etapa escondida do pipeline) a matemática de PCA que já existia em `orientation.mjs` — calcula a rotação correta a partir da geometria, sem precisar de olho humano
6. Resultado da calculadora: **7 de 11 produtos saíram com orientação correta automaticamente** (CW001, CW002, CW003, CW004, CW005, CW008, CW011)
7. **4 produtos resistiram** (CW006, CW007, CW009, CW010) — diagnóstico: são relógios grandes/redondos onde o mostrador é quase do mesmo tamanho que a pulseira, então a PCA não consegue decidir sozinha qual eixo é "pulseira" e qual é "mostrador" (matematicamente ambíguo, não é bug)
8. Pesquisa concluída sobre Tripo3D: não existe parâmetro de API que garanta posição de saída — só ajuste manual no Studio deles. Confirma que calibração manual continua necessária para casos difíceis, mesmo em ferramentas profissionais

## 4. Build
`npm run build` — ✅ sem erros, sem warnings novos (só o aviso padrão de chunk size, pré-existente)

## 5. Pendências
1. **CW012, CW013, CW014, CW015** — não regerados (créditos Tripo3D acabaram). Modelo antigo continua no ar pra esses 4, loja não quebrou
2. **CW006, CW007, CW009, CW010** — precisam de calibração manual visual em `?lab=calibrate-product` (a matemática não resolveu sozinha nesses 4)
3. **CW001–CW011** — mesmo os 7 "corretos" estão marcados `needs_calibration`, não `calibrated` — recomendo conferir visualmente antes de publicar (nunca testados no pulso real)
4. Nada foi commitado nem publicado na loja — tudo está no working tree local, esperando sua revisão
5. Pipeline de limpeza (`clean_bg.py`) ainda depende de Python instalado localmente — não roda num servidor de produção ainda

## 6. Próxima missão sugerida
**Calibração visual dos 11 + fechar os 4 que faltam** — conferir CW001-CW011 no lab, corrigir CW006/007/009/010 na mão, e regenerar CW012-015 quando houver crédito novo.
