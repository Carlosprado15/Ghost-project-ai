# RELATÓRIO — MISSÃO 033

## 1. Arquivo que montava a URL

`ghost-ar-button-shopify.html`

---

## 2. Função responsável

Não era uma função JS — era um atributo `href` construído diretamente em Liquid:

```liquid
href="{{ ghost_base_url }}?productId={% raw %}{{ product.metafields.ghost.product_id }}{% endraw %}&..."
```

---

## 3. Variável que estava vazia

`product.metafields.ghost.product_id`

---

## 4. Por que estava vazia

Duas causas combinadas:

- O metafield `ghost.product_id` **nunca foi configurado** no Shopify admin da Click & Wear — nenhum produto tinha esse metafield definido.
- O bloco `{% raw %}` no arquivo do repositório impedia a avaliação do metafield pelo Liquid. Mas quando o snippet é copiado para o Shopify sem o `{% raw %}`, o Liquid avalia a expressão e retorna string vazia (metafield inexistente = `""`).

Resultado: `?productId=` em branco para qualquer produto.

---

## 5. Como foi corrigido

Substituído o metafield por um mapeamento Liquid `case/when` usando `product.handle` — o mesmo mapeamento de handles já presente no `PRODUCT_MAP` do `gsdk.js`:

```liquid
{% case product.handle %}
  {% when "pulseira-magnetico-bioquantico-de-equilibrio-original" %}{% assign ghost_product_id = "CW005" %}
  {% when "relogio-masculino-2023-moda-masculino-relogios-de-luxo-aco-inoxidavel-quartzo-re" %}{% assign ghost_product_id = "CW015" %}
  ...
{% endcase %}
```

O `href` agora usa `ghost_product_id` (variável local Liquid) em vez do metafield:

```liquid
href="{{ ghost_base_url }}?productId={{ ghost_product_id }}&..."
```

O botão só é renderizado quando `ghost_product_id != ""` (produto reconhecido).

---

## 6. Exemplo da URL

**ANTES**
```
https://ghost-project-ai-bbvc.vercel.app/?productId=
```

**DEPOIS**
```
https://ghost-project-ai-bbvc.vercel.app/?productId=CW005
https://ghost-project-ai-bbvc.vercel.app/?productId=CW010
https://ghost-project-ai-bbvc.vercel.app/?productId=CW015
```

---

## Entrega

| Item | Status |
|------|--------|
| Arquivo alterado | `ghost-ar-button-shopify.html` |
| Commit | `8a6fb1f` |
| Push | ✓ `main` |
| Deploy Vercel | QUEUED → `dpl_35MJM46QZW5hNXkCjGQ1rDKJdEgb` |
| Arquivos não tocados | Ghost Project, ProductAdapter, WristTracker, Scanner, MediaPipe, Pipeline, RenderPipeline, model-viewer, PrecisionFit, Layout, CSS, Tracking, Hero360, Fluxo AR |
