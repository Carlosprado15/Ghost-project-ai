# RELATORIO_MISSAO_040 — Sprint 1: Auditoria e Correção do Fluxo Click & Wear → Ghost Project

**Status:** Concluída — build limpo, deploy pendente de `git push`
**Data:** 2026-06-23

---

## 1. Arquivos modificados

- `public/gsdk.js`

---

## 2. Métodos alterados

- IIFE principal — adicionado bloco de hide imediato
- `init()` — seletor de cleanup expandido

---

## 3. O que foi alterado

### Auditoria de estado (pré-alteração)

| Componente | Estado |
|---|---|
| Ghost Project App (vercel.app) | ✅ Correto — sem fallback CW001, parsing de URL correto |
| `product-adapter.js` | ✅ Correto — busca por id ou handle, versão de cache |
| `products.json` | ✅ 15 produtos mapeados (CW001–CW015) |
| `public/models/*.glb` | ✅ 15 GLBs presentes |
| `gsdk.js` — PRODUCT_MAP | ✅ 15 handles mapeados |
| `gsdk.js` — URL base | ✅ `ghost-project-ai.vercel.app` |
| `layout/theme.liquid` | ✅ Carrega `gsdk.js` (1 include, URL correta) |
| `vercel.json` — CORS | ✅ `/gsdk.js` e `/ghost-sdk.js` com CORS e no-cache |
| `sections/product-information.liquid` | ❌ Botão antigo com URL `-bbvc` + metafield vazio |
| `gsdk.js` — cleanup seletor | ❌ Não removia `.ghost-ar-container` nem `.ghost-ar-button` |
| `ghost-sdk.js` | ⚠️ Versão antiga sem polling/cleanup — não está em uso ativo |

### Problema raiz identificado

O `sections/product-information.liquid` renderiza server-side um botão antigo com:
- URL: `ghost-project-ai-bbvc.vercel.app` (domínio errado, inativo)
- ProductId: `{{ closest.product.metafields.custom.ghost_id }}` (metafield nunca configurado → string vazia)

O `gsdk.js` injetava o botão correto DEPOIS, mas o seletor de cleanup na função `init()` era:
```js
document.querySelectorAll('.ghost-badge, .ghost-ar-btn, .ghost-powered, .ghost-scanner-line')
```

As classes do botão antigo (`.ghost-ar-container`, `.ghost-ar-button`) **não estavam no seletor** → ambos os botões coexistiam na página.

### Correção aplicada — dois layers de proteção

**Layer 1 — Hide imediato via CSS (elimina flash)**

Adicionado ao topo do IIFE, executa sincronamente quando o script carrega (`defer` = após parse do HTML, antes de DOMContentLoaded):

```js
(function() {
  var s = document.createElement('style');
  s.textContent = '.ghost-ar-container,.ghost-ar-button{display:none!important}';
  document.head.appendChild(s);
})();
```

**Layer 2 — Remoção do DOM no cleanup**

Seletor expandido na função `init()`:

```js
// ANTES
document.querySelectorAll('.ghost-badge, .ghost-ar-btn, .ghost-powered, .ghost-scanner-line').forEach(el => el.remove());

// DEPOIS
document.querySelectorAll('.ghost-badge, .ghost-ar-btn, .ghost-powered, .ghost-scanner-line, .ghost-ar-container, .ghost-ar-button').forEach(el => el.remove());
```

**Resultado:** O botão Liquid antigo é oculto via CSS antes mesmo da primeira renderização visível ao usuário. Em seguida, é removido do DOM pelo cleanup do `init()`. O botão correto (com URL e productId válidos) é o único visível para o cliente.

---

## 4. Build

```
✓ 46 modules transformed
dist/index.html                   0.83 kB
dist/assets/index-Cf-V5ABJ.css   26.54 kB
dist/assets/index-B6tHK-jm.js   440.71 kB
gsdk.js (dist)                    9.64 kB  ← atualizado
✓ built in 15.99s
```

Zero erros. Zero warnings críticos.

---

## 5. Pendências

1. **`git push origin main`** — necessário para Vercel deploy automático pegar o `gsdk.js` atualizado
2. **Ação manual no Shopify Admin** — remover bloco `ghost-ar-container` de `sections/product-information.liquid` (API bloqueia escrita em tema MAIN publicado). Após remoção, não haverá nem o elemento ocultado no HTML — comportamento mais limpo
3. **Validação end-to-end por produto** — testar CW001–CW015 individualmente na loja Click & Wear após deploy

---

## 6. Próxima missão sugerida

**MISSÃO 041 — Validação end-to-end: CW001–CW015**
Após `git push`, verificar no celular real que cada um dos 15 produtos carrega o GLB correto sem erros.
