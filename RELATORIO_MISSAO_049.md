# RELATÓRIO MISSÃO 049 — 360° Premium Experience

## 1. Arquivos Modificados

| Arquivo | Ação | Delta |
|---|---|---|
| `snippets/cw-360-modal.liquid` | Atualizado | Estrutura redesenhada: header só com X, nova seção `#cw-360-info`, wrapper do viewer com overlay de loading |
| `assets/ghost-360-modal.js` | Atualizado | +`getProductTitle()`, +`showLoading()`/`hideLoading()`, listeners `load`/`error` no viewer, `openModal(code, title)` |
| `assets/ghost-premium.css` | Atualizado | Seção M048 substituída por M049: backdrop animado, panel flex, spinner, product-name, responsivo `dvh` |

---

## 2. Métodos Criados / Alterados

### `ghost-360-modal.js`

| Função | Delta |
|---|---|
| `getProductTitle(btn)` | **Nova.** Sobe o DOM via `.closest('product-card')` → `.card__heading a` → fallback h3/h2. Retorna string ou `''`. |
| `showLoading()` | **Nova.** Remove `cw-360-hidden` do `#cw-360-loading`. |
| `hideLoading()` | **Nova.** Adiciona `cw-360-hidden`. Chamada em `viewer.load`, `viewer.error`, e no timeout do `closeModal`. |
| `openModal(code, title)` | **Alterada.** Aceita `title`, atualiza `#cw-360-product-name`, chama `showLoading()` antes de setar `src`. |
| `init()` | **Alterada.** Inicializa `productName` + `loadingEl`; adiciona listeners `load`/`error` no viewer. |
| Click delegate | **Alterada.** Chama `getProductTitle(btn)` e passa para `openModal`. |

---

## 3. Estrutura HTML Nova (`cw-360-modal.liquid`)

```
#cw-360-modal
  #cw-360-backdrop
  #cw-360-panel
    #cw-360-header          ← apenas o botão X
    #cw-360-info
      #cw-360-product-name  ← preenchido via JS
      #cw-360-subtitle      ← "Gire o produto em 360°" (estático)
    #cw-360-viewer-wrap     ← flex:1, position:relative
      #cw-360-loading       ← overlay absoluto, .cw-360-hidden para sumir
        .cw-360-spinner
        .cw-360-loading-text
      model-viewer#cw-360-viewer
    #cw-360-footer
```

`auto-rotate-delay` alterado de `0` → `3000ms`. `rotation-per-second` de `28deg` → `14deg`.

---

## 4. CSS — Decisões Principais

| Elemento | Decisão |
|---|---|
| Backdrop | `rgba(10,10,10,.72)` + `blur(12px)`. Agora anima: `opacity 0→1` em `0.24s` junto com abertura do panel. |
| Panel | `flex-direction: column` + `max-height: calc(100vh - 40px)`. Inner glow: `inset 0 1px 0 rgba(255,255,255,0.07)`. |
| Animação panel | `scale(0.94) translateY(10px) → scale(1) translateY(0)` + `opacity 0→1`, `cubic-bezier(0.34,1.56,0.64,1)`, 240ms. |
| Botão X | `30×30px`, `border-radius:50%`, hover: `background 0.18s ease`. |
| `#cw-360-product-name` | `font-size:16px`, `font-weight:500`, `color:#fff`, `text-overflow:ellipsis`. |
| `#cw-360-subtitle` | `font-size:11px`, `color:rgba(255,255,255,0.28)`. |
| Spinner | `26×26px`, `border:1.5px`, `border-top-color:rgba(255,255,255,0.45)`, `0.75s linear infinite`. |
| Mobile `<480px` | Panel `height:90dvh`, viewer-wrap `flex:1`, viewer `height:100%` → viewer ocupa ~70% da altura útil. |

---

## 5. Ghost Project — Intacto

| Arquivo | Status |
|---|---|
| `public/gsdk.js` | ✅ Não tocado |
| `src/App_FINAL.jsx` | ✅ Não tocado |
| Pipeline AR / Click & Wear | ✅ Não tocado |
| Botão "Ver em Realidade Aumentada" | ✅ Não interferido |
| `snippets/product-card.liquid` | ✅ Não tocado |

---

## 6. Preview

```
https://hgqvif-ne.myshopify.com/?preview_theme_id=161916649690
```
