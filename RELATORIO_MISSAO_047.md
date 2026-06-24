# RELATÓRIO MISSÃO 047 — Validação Visual Tema "Cópia de Horizon"

## 1. Bloqueador: Loja com Senha Ativa

**Causa raiz dos screenshots:** A loja Click & Wear está com proteção por senha ativa ("Opening soon" / "Password protected"). O Playwright headless não possui sessão autenticada do Shopify Admin, então captura apenas a página de senha — não o layout real da loja.

Screenshots tirados: `01–10 (desktop + mobile)` — todos mostram a mesma página de senha.

**O que os screenshots confirmam:**
- Tema "Cópia de Horizon" ativo no modo preview (barra inferior: "Cópia de Horizon | Draft | Password protected")
- `ghost-premium.css` **carregando corretamente** — verificado via `document.styleSheets` durante o script Playwright

---

## 2. Validação via API — Todos os Arquivos Confirmados

Verificação feita lendo o conteúdo real de cada arquivo via Shopify GraphQL.

| Arquivo | Status | Prova |
|---|---|---|
| `templates/index.json` | ✅ CORRETO | `order: [hero_jVaWmY, cw_ar_banner_m046, product_list_fa6P9H]` |
| `layout/theme.liquid` | ✅ CORRETO | `window.__ghostHandle` + preload model-viewer + gsdk.js v=046 |
| `sections/cw-ar-banner.liquid` | ✅ CORRETO | Banner completo: eyebrow, título, subtitle, 4 pills, CTA, 3 steps |
| `snippets/product-card.liquid` | ✅ CORRETO | `<span class="cw-ar-badge">` dentro de `{%- unless onboarding -%}` |
| `sections/product-information.liquid` | ✅ CORRETO | Botão legado removido, `ghost-back-button` presente |
| `assets/ghost-premium.css` | ✅ CORRETO | 4738 bytes — badge, banner, overrides 360°, responsive |
| `snippets/stylesheets.liquid` | ✅ CORRETO | `ghost-premium.css` carregado via `stylesheet_tag` |

---

## 3. Status de Cada Elemento por Código

| Elemento | Status Código | Observação |
|---|---|---|
| Banner AR preto (home) | ✅ IMPLEMENTADO | `sections/cw-ar-banner.liquid` + `templates/index.json` |
| Eyebrow "Tecnologia Exclusiva" | ✅ IMPLEMENTADO | `.cw-ar-banner__eyebrow` |
| Título "Experimente antes de comprar" | ✅ IMPLEMENTADO | `.cw-ar-banner__title` com `<strong>` |
| Pills de benefícios (4 itens) | ✅ IMPLEMENTADO | `.cw-ar-banner__pill` × 4 |
| CTA "Explorar a Vitrine" | ✅ IMPLEMENTADO | `routes.all_products_collection_url` |
| 3 passos (01/02/03) | ✅ IMPLEMENTADO | `.cw-ar-banner__step` × 3 |
| Badge AR nos cards | ✅ IMPLEMENTADO | `<span class="cw-ar-badge">` em `product-card.liquid` |
| CSS premium (`ghost-premium.css`) | ✅ CARREGANDO | Confirmado por Playwright + API |
| `window.__ghostHandle` | ✅ IMPLEMENTADO | Definido server-side antes do `<main>` |
| model-viewer preload | ✅ IMPLEMENTADO | `<script type="module">` no `<head>` para páginas de produto |
| gsdk.js v=046 | ✅ IMPLEMENTADO | `defer` antes de `</body>` |
| Botão legado removido | ✅ REMOVIDO | Sem `ghost-ar-container` em `product-information.liquid` |
| Back button | ✅ IMPLEMENTADO | `← Voltar para a loja` via `javascript:history.back()` |

---

## 4. Para Visualizar o Tema

**Opção A — Desativar senha temporariamente:**

1. Shopify Admin → **Settings → Online store (Storefront password)**
2. Desmarcar "Restrict access to your online store"
3. Acessar `https://hgqvif-ne.myshopify.com/?preview_theme_id=161916649690`
4. Reativar após validação

**Opção B — Preview via Shopify Admin:**

1. Shopify Admin → Online Store → Themes
2. "Cópia de Horizon" → ação → **Preview**
3. Isso gera uma sessão autenticada e abre o tema sem precisar desativar a senha

---

## 5. Confirmação — Ghost Project Intacto

Nenhum dos seguintes arquivos foi tocado nesta missão:

- `public/gsdk.js`
- `src/App_FINAL.jsx`
- `src/App.css`
- `src/components/Hero3D.css`
- `src/data/products.json`
- `public/models/*.glb`
- Toda a pipeline AR

---

## 6. Conclusão

**Tema "Cópia de Horizon" está tecnicamente pronto para publicação.** Todos os 7 arquivos modificados foram verificados via API com conteúdo correto. O único item que impede validação visual por screenshot automatizado é a senha da loja.

Para publicar: Shopify Admin → Online Store → Themes → "Cópia de Horizon" → **Publish**.
