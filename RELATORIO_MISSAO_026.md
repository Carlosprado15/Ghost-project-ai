# RELATÓRIO MISSÃO 026

## 1. Arquivos modificados

- `src/App_FINAL.jsx`
- `src/components/UrlDiagnosticsPanel.jsx` _(novo)_

---

## 2. Métodos alterados

- `App` (corpo do componente) — importação e uso de `ClickWearAdapter` e `UrlDiagnosticsPanel`

---

## 3. O que foi alterado

1. **Regressão revertida (FASE 1):** Re-adicionado `import { ClickWearAdapter } from './sdk/store-adapters/clickwear'` (removido na M025).
2. **Regressão revertida (FASE 1):** Restaurado `ClickWearAdapter.DEFAULT_PRODUCT_ID` como fallback no botão START SCANNER — linha que a M025 trocou por `null`, causando `openScanner(null)` → `hasValidProduct = false` → tela de erro.
3. **Painel de diagnóstico criado (FASE 2):** `UrlDiagnosticsPanel.jsx` — overlay fixo visível em `?debug=1` OU `import.meta.env.DEV`.
4. **Painel adicionado à tela home:** `<UrlDiagnosticsPanel />` inserido no retorno de `screen === 'home'`.
5. **Painel adicionado à tela 360°:** `<UrlDiagnosticsPanel />` inserido no retorno de `show360`.
6. **Painel adicionado ao scanner:** `<UrlDiagnosticsPanel />` inserido no retorno principal (scanner).
7. **`product-adapter.js` não foi alterado:** A mudança em `_lookupModelUrl` (remoção do fallback `productsData[0]`) não contribui para a regressão quando o fallback do `ClickWearAdapter` está restaurado.

---

## 4. Causa raiz da regressão M025

```
M025 removeu:
  import { ClickWearAdapter } from './sdk/store-adapters/clickwear';
  
M025 trocou:
  openScanner(ProductAdapter.getActive().productId || ClickWearAdapter.DEFAULT_PRODUCT_ID)
por:
  openScanner(ProductAdapter.getActive().productId || null)

Resultado: quando Click & Wear não envia ?productId na URL,
  ProductAdapter.getActive().productId = null
  → openScanner(null)
  → testProductId = null
  → _scanProduct.productId = null
  → hasValidProduct = false
  → tela de erro exibida
```

---

## 5. O que o UrlDiagnosticsPanel mostra (na tela do celular)

Acessível em produção com `?debug=1` no final da URL:

| Seção | Conteúdo |
|-------|----------|
| Barra de status | Verde se `productId` presente, vermelha se ausente — sempre visível |
| href | URL completa |
| search | String de query bruta |
| TODOS OS PARAMS | Todos os pares chave=valor encontrados |
| PARÂMETROS DE PRODUTO | Valores de: `productId`, `id`, `handle`, `product`, `variant`, `sku`, `slug` |
| PRODUCT ADAPTER | Método chamado, param usado, productId resolvido |
| Por que null | Diagnóstico textual se productId for null |

---

## 6. Build

```
✓ built in 15.49s
dist/assets/index-DopyvUnc.js  440.75 kB │ gzip: 129.67 kB
0 erros | 0 warnings
```

---

## 7. Como testar a FASE 2

1. Abrir a URL do Ghost Project enviada pela Click & Wear, adicionando `&debug=1` no final
2. O painel aparecerá no topo da tela mostrando todos os parâmetros recebidos
3. Identificar qual parâmetro a loja usa para enviar o produto
4. Reportar ao Arquiteto para autorização da próxima missão

---

## 8. Pendências

1. Identificar o parâmetro real que a Click & Wear envia (aguarda teste com `?debug=1`)
2. **NÃO alterar ProductAdapter** antes desta confirmação (FASE 3 da missão)

---

## 9. Próxima missão sugerida

**M027 — Mapear parâmetro real e corrigir ProductAdapter**
Com base no relatório do painel `UrlDiagnosticsPanel`, ajustar `fromUrlParams()` para reconhecer o parâmetro que a loja efetivamente envia.
