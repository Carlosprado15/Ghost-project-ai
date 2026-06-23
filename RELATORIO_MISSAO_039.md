# RELATÓRIO MISSÃO 039 — Auditoria definitiva do fluxo Produto → Ghost Project

## 1. Fluxo completo rastreado (CW005 como exemplo)

```
Shopify (ghost-ar-button-shopify.html)
  ↓  handle "pulseira-magnetico-bioquantico-de-equilibrio-original"
  ↓  case/when → ghost_product_id = "CW005"
  ↓  URL gerada: https://ghost-project-ai.vercel.app/?productId=CW005&productUrl=...&cartUrl=...&embedded=true

Ghost Project (App_FINAL.jsx : useEffect linha 248)
  ↓  params.get('productId') = "CW005"
  ↓  params.get('embedded') = "true"
  ↓  isDesktopDevice() = false (mobile)
  ↓  → openScanner("CW005")   [linha 255]

openScanner("CW005")  [App_FINAL.jsx : linha 289]
  ↓  setTestProductId("CW005")
  ↓  ProductAdapter.fromParams({ productId: "CW005" })  [linha 302]
  ↓  → _lookupModelUrl("CW005")  [product-adapter.js : linha 12]
  ↓  → productsData.find(p => p.id === "CW005")  → encontrado
  ↓  → modelUrl = "/models/CW005.glb"
  ↓  → retorna "/models/CW005.glb?v029"
  ↓  setGeneratedModelUrl("/models/CW005.glb?v029")  [linha 307]

Scanner render  [App_FINAL.jsx : linha 1125]
  ↓  testProductId = "CW005" → ProductAdapter.fromParams({ productId: "CW005" })
  ↓  modelUrl = "/models/CW005.glb?v029"
  ↓  model-viewer src = generatedModelUrl || modelUrl = "/models/CW005.glb?v029"  [linha 1469]
  ↓  → GLB CW005 entregue ao model-viewer  ✓
```

---

## 2. Onde ocorria a substituição por CW001

### Causa raiz primária (REMOVIDA em M032)

**Arquivo**: `src/sdk/store-adapters/clickwear.js`
**Linha removida** (commit `d39c178`):
```js
DEFAULT_PRODUCT_ID: 'CW001',
DEFAULT_MODEL_PATH: '/models/CW001.glb',
```

**Arquivo**: `src/App_FINAL.jsx` — botão START SCANNER
**Linha que continha o bug** (commit `d39c178`):
```js
// ANTES (com bug):
openScanner(ProductAdapter.getActive().productId || ClickWearAdapter.DEFAULT_PRODUCT_ID);
//                                                   ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
//                                                   == "CW001" quando productId era null

// DEPOIS (corrigido):
openScanner(ProductAdapter.getActive().productId);
```

**Condição de disparo**: Ghost Project aberto sem `productId` na URL
→ `ProductAdapter.getActive().productId = null`
→ `null || "CW001"` = `"CW001"`
→ `openScanner("CW001")` → scanner carregava CW001 independente do produto real

---

### Causa raiz secundária (REMOVIDA em M033)

**Arquivo**: `ghost-ar-button-shopify.html`
**Código antigo** (antes de M033):
```liquid
href="{{ ghost_base_url }}?productId={% raw %}{{ product.metafields.ghost.product_id }}{% endraw %}&..."
```

**Problema**: quando o metafield `ghost.product_id` não estava configurado no produto, gerava
`?productId=` (string vazia). Ghost Project recebia productId vazio → caia no fallback CW001 (Bug primário acima).

**Correção (M033)**: substituído por `case/when` com guard `{% if ghost_product_id != "" %}`.

---

### Causa terciária (REMOVIDA em M036)

`ghost_base_url` apontava para `ghost-project-ai-bbvc.vercel.app` (URL antiga).
Corrigido para `ghost-project-ai.vercel.app` com barra antes do query string.

---

## 3. Estado atual do código (após M036)

| Ponto do fluxo | Status |
|---|---|
| `ghost-ar-button-shopify.html` — mapeamento handle→productId | ✓ Correto (case/when, sem fallback CW001) |
| `ghost-ar-button-shopify.html` — ghost_base_url | ✓ Correto (`ghost-project-ai.vercel.app`) |
| `App_FINAL.jsx:255` — embedded=true → openScanner(productId) | ✓ Correto |
| `product-adapter.js:12` — _lookupModelUrl busca por id ou handle | ✓ Correto |
| `App_FINAL.jsx:1063` — START SCANNER sem fallback CW001 | ✓ Corrigido (M032) |
| `clickwear.js` — DEFAULT_PRODUCT_ID removido | ✓ Removido (M032) |

**No código atual, não existe nenhuma linha que substitua um produto por CW001.**

---

## 4. Risco residual em produção

Se o **tema Shopify instalado na Click & Wear** ainda contém o snippet **anterior a M033**
(com `product.metafields.ghost.product_id`), o fluxo ainda pode quebrar:

- Metafield não configurado → `productId=` vazio → Ghost Project mostra "PRODUTO NÃO IDENTIFICADO"
- Nesse cenário CW001 NÃO carrega mais (M032 removeu o fallback), mas o AR não funciona

**Verificação obrigatória antes da demo**: confirmar que o snippet `ghost-ar-button-shopify.html`
com `case/when` (versão M033/M036) está instalado no tema Shopify no admin da Click & Wear.

---

## 5. Proposta mínima de correção

Nenhuma correção de código necessária no Ghost Project — o bug foi corrigido em M032/M033/M036.

**Ação única restante (fora do repositório)**:
Verificar no Shopify Admin da Click & Wear se o snippet de produto contém `case/when` (versão atual)
ou `product.metafields.ghost.product_id` (versão antiga). Se for a versão antiga, substituir pelo
conteúdo atual de `ghost-ar-button-shopify.html`.

**Não aplicar nenhuma alteração de código nesta missão.**
