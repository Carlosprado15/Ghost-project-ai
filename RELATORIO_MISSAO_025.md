# RELATORIO_MISSAO_025

## 1. Arquivos modificados

- `src/sdk/product-adapter.js`
- `src/App_FINAL.jsx`

## 2. Métodos alterados

- `_lookupModelUrl` (product-adapter.js)
- `watchContainerStyle.transition` (App_FINAL.jsx)
- `<model-viewer orientation>` (App_FINAL.jsx)
- `openScanner` button onClick (App_FINAL.jsx)
- Camera init useEffect (App_FINAL.jsx)

## 3. O que foi alterado

**BUG 1 — Produto errado (CW001 fixo):**
- `_lookupModelUrl`: removido duplo fallback para `productsData[0]` (= CW001). Agora retorna `null` se não encontrar. Adicionado match por `p.handle` além de `p.id`, para cobrir stores que passam o handle do Shopify.
- Botão START SCANNER: removido `|| ClickWearAdapter.DEFAULT_PRODUCT_ID`. Passa `null` quando não há produto ativo.
- Import de `ClickWearAdapter` removido (não mais necessário).

**BUG 2 — Relógio de cabeça para baixo:**
- `model-viewer orientation` era `0deg 0deg ${finalWatch.rotation - 90}deg` (dinâmico). O CSS `rotateZ(finalWatch.rotation)` no div container já aplica a rotação de tracking; o `orientation` duplicava essa rotação.
- Corrigido para `orientation="0deg 0deg -90deg"` (estático). A rotação de tracking fica exclusivamente no CSS rotateZ do container.

**BUG 3 — Delay artificial:**
- Transição CSS de opacidade do `watchContainerStyle`: reduzida de `0.55s` para `0.10s` (aparecimento 5x mais rápido).
- `await new Promise((resolve) => setTimeout(resolve, 400))` na inicialização da câmera: removido (delay artificial de 400ms antes de montar a Camera).

## 4. Build

```
✓ 45 modules transformed
dist/assets/index-a1M7XSVA.js  436.05 kB │ gzip: 128.18 kB
✓ built in 14.97s
```
Sem erros. Sem warnings de código.

## 5. Pendências

- Confirmar em dispositivo físico se `orientation="0deg 0deg -90deg"` é o offset correto para os GLBs existentes (pode precisar de ajuste para `0deg` ou `90deg` dependendo da exportação de cada modelo).
- Confirmar que a remoção do fallback CW001 não quebrou nenhum fluxo de produto válido no ambiente Click & Wear.
- Verificar se o `?debug=1` pode ser re-ativado no futuro de forma isolada se necessário.

## 6. Próxima missão sugerida

**M026 — Validação AR em Dispositivo Físico**: confirmar os três fixes em celular real, ajustar offset estático do `orientation` se o relógio ainda aparecer rotacionado, e validar que cada produto abre seu próprio GLB corretamente.
