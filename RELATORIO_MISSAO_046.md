# RELATÓRIO MISSÃO 046 — Redesign Premium Click & Wear (Shopify)

## 1. Arquivos Modificados

Todos os arquivos alterados são do **tema Shopify Horizon** exclusivamente, via API GraphQL no tema de desenvolvimento `"Cópia de Horizon"` (ID: `161916649690`).

| Arquivo | Ação |
|---|---|
| `layout/theme.liquid` | Adicionado `window.__ghostHandle`, preload do `model-viewer.min.js`, gsdk.js atualizado para `v=046` |
| `sections/product-information.liquid` | Removido botão Liquid legado quebrado (`ghost-ar-container`) |
| `snippets/product-card.liquid` | Adicionado badge AR em todos os cards de produto |
| `snippets/stylesheets.liquid` | Adicionado `ghost-premium.css` |
| `assets/ghost-premium.css` | **Novo** — CSS premium: badge AR, banner home, override de estilos gsdk.js |
| `sections/cw-ar-banner.liquid` | **Novo** — Seção narrativa AR para a home page |
| `templates/index.json` | Adicionada seção `cw_ar_banner_m046` entre hero e vitrine |

**Ghost Project — zero alterações:**
- `gsdk.js` — não tocado
- `App_FINAL.jsx` — não tocado
- `App.css` — não tocado
- `Hero3D.css` — não tocado
- `products.json`, GLBs, fluxo AR — não tocados

---

## 2. Por que o 360° não aparecia

**Causa raiz: dupla falha de timing + handle detection**

O `gsdk.js` usa dois mecanismos para detectar o produto:

```js
function getProductHandle() {
  if (typeof window.__ghostHandle === 'string' && window.__ghostHandle !== '') {
    return window.__ghostHandle;  // prioridade 1
  }
  const match = window.location.pathname.match(/\/products\/([^/?]+)/);
  return match ? match[1] : null;  // fallback regex
}
```

**Problema 1 — `window.__ghostHandle` não estava definido.** O tema Horizon não definia essa variável, então o gsdk.js dependia da regex de pathname. O pathname é confiável, mas se o script rodasse antes de qualquer ciclo de microtask, podia retornar null em contextos de view transition.

**Problema 2 — `model-viewer.min.js` carregado tarde.** O gsdk.js carrega o script do model-viewer dinamicamente DENTRO de `init()`. O elemento `<model-viewer>` era criado antes que o Custom Element fosse registrado pelo browser. Em alguns browsers (especialmente mobile), isso resulta em um elemento HTML genérico que não renderiza o 3D.

**Fixes aplicados:**

```liquid
{%- if template.name == 'product' -%}
  <script>window.__ghostHandle = "{{ product.handle }}";</script>
  <script type="module"
    src="https://ajax.googleapis.com/ajax/libs/model-viewer/3.4.0/model-viewer.min.js">
  </script>
{%- endif -%}
```

- `window.__ghostHandle` é definido **server-side** antes do gsdk.js carregar
- `model-viewer.min.js` é pré-carregado no `<head>` como módulo — Custom Element já registrado quando o gsdk.js chama `create360Viewer()`

---

## 3. Por que as mudanças da M045 não apareceram na loja

**As mudanças da M045 foram feitas nos arquivos errados.**

| O que foi alterado em M045 | O que deveria ter sido alterado |
|---|---|
| `src/App.css` | `assets/ghost-premium.css` (tema Shopify) |
| `src/components/Hero3D.css` | `assets/base.css` (tema Shopify) |
| `src/App_FINAL.jsx` | `sections/product-information.liquid` (tema Shopify) |

Os arquivos `src/` pertencem ao **Ghost Project AI** (app React/Vite em `ghost-project-ai.vercel.app`). Eles afetam a experiência AR interna (a tela do scanner), não a vitrine da loja Shopify.

A **loja Shopify Click & Wear** (`hgqvif-ne.myshopify.com`) usa o tema Horizon. Suas alterações de apresentação precisam ser feitas nos arquivos Liquid/CSS do tema, não no projeto React.

Adicionalmente, as mudanças de M045 estão **não commitadas** na working tree local. Podem ser revertidas com `git checkout -- src/` se desejado.

---

## 4. O que foi entregue nesta missão

### Home Page
- Nova seção escura (`#0a0a0a`) com narrativa AR: título minimalista, pills de benefícios, CTA "Explorar a Vitrine", e 3 passos explicando o fluxo AR
- Posicionada entre o hero e a vitrine de produtos

### Vitrine (Product Cards)
- Badge `AR` discreto em todos os cards, posicionado no canto superior direito da imagem
- Ícone SVG + texto "AR" em preto translúcido com glass-morphism

### Página do Produto
- Botão legado quebrado (`ghost-ar-container` com domínio morto) **removido definitivamente** do Liquid
- `window.__ghostHandle` definido server-side — gsdk.js detecta produto sem regex
- `model-viewer.min.js` pré-carregado no `<head>` — 360° renderiza corretamente
- CSS premium sobrepõe estilos gsdk.js: viewer com `border-radius: 16px`, `box-shadow`, label refinado

---

## 5. Tema de Desenvolvimento

As mudanças estão no tema **"Cópia de Horizon"** (UNPUBLISHED).

**URL de preview:**
```
https://hgqvif-ne.myshopify.com/?preview_theme_id=161916649690
```

Para publicar: Shopify Admin → Online Store → Themes → "Cópia de Horizon" → **Publish**.

A API bloqueia publicação automática do tema MAIN por segurança — ação manual obrigatória.

---

## 6. Verificação — Ghost Project intacto

Arquivos locais não tocados nesta sessão:
- `public/gsdk.js` ← version v=046 referenciada no tema, mas o arquivo não foi editado
- `src/App_FINAL.jsx`
- `src/App.css`
- `src/components/Hero3D.css`
- `src/data/products.json`
- `public/models/*.glb`
- Toda a pipeline AR (WristTracker, RenderPipeline, PrecisionFit, Scanner, Hero360, MediaPipe)
