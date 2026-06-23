# RELATORIO_MISSAO_037 — Atualizar o Tema Shopify Real

**Status:** Concluída parcialmente — API bloqueia escrita no tema publicado  
**Data:** 2026-06-22

---

## 1. Arquivo identificado

**`sections/product-information.liquid`** — tema Horizon (MAIN, ID: `gid://shopify/OnlineStoreTheme/156625699034`)

---

## 2. Linha com o problema

Dentro do bloco `{% capture details %}`, aproximadamente na linha 52 do arquivo:

```liquid
{% comment %} GHOST PROJECT AI — BOTÃO DE REALIDADE AUMENTADA {% endcomment %}
<div class="ghost-ar-container">
  <a
    href="https://ghost-project-ai-bbvc.vercel.app/?productId={{ closest.product.metafields.custom.ghost_id }}"
    target="_blank"
    class="ghost-ar-button"
  >
    👁 Ver em AR — Experimente no Pulso
  </a>
</div>
```

**Dois problemas nessa linha:**
- Domínio `-bbvc` errado
- `closest.product.metafields.custom.ghost_id` — metafield não configurado em nenhum produto → chega vazio → `?productId=`

---

## 3. Por que a variável chega vazia

O metafield `custom.ghost_id` nunca foi preenchido no Shopify Admin para os produtos da loja. A lógica de resolução via `case/when` foi aplicada no arquivo do repositório (`ghost-ar-button-shopify.html`) mas **nunca foi copiada para o tema publicado**. O tema ainda usa a versão antiga com metafields.

---

## 4. API bloqueou a alteração automática

A Shopify Admin API (via MCP) bloqueia escrita em arquivos do tema ativo/publicado (MAIN). A mutação `themeFilesUpsert` só é permitida em temas não publicados.

Conforme instrução da missão: **nenhum outro arquivo foi modificado como alternativa**.

---

## 5. Edição manual obrigatória no Shopify Admin

### Onde editar
**Shopify Admin → Online Store → Themes → Horizon (atual) → Edit code**  
Arquivo: `sections/product-information.liquid`

### Trecho a localizar (buscar por esta string)
```
ghost-project-ai-bbvc.vercel.app
```

### Substituir o bloco inteiro

**DE (remover):**
```liquid
{% comment %} GHOST PROJECT AI — BOTÃO DE REALIDADE AUMENTADA {% endcomment %}
<div class="ghost-ar-container">
  <a
    href="https://ghost-project-ai-bbvc.vercel.app/?productId={{ closest.product.metafields.custom.ghost_id }}"
    target="_blank"
    class="ghost-ar-button"
  >
    👁 Ver em AR — Experimente no Pulso
  </a>
</div>
```

**PARA (colar no lugar):**
```liquid
{% comment %} GHOST PROJECT AI — BOTÃO DE REALIDADE AUMENTADA {% endcomment %}
{% assign ghost_product_id = "" %}
{% case closest.product.handle %}
  {% when "relogio-casio-para-neutro-2023-novos-estilos-definir-marca-superior-de-luxo-a-pr" %}{% assign ghost_product_id = "CW001" %}
  {% when "nidin-moda-banhado-a-ouro-corrente-mistura-pulseira-para-mulheres-colorido-crist" %}{% assign ghost_product_id = "CW002" %}
  {% when "vinterly-pulseiras-magneticas-de-cobre-puro-para-mulheres-joias-de-terapia-vint" %}{% assign ghost_product_id = "CW003" %}
  {% when "pulseiras-de-cobre-puro-vinterly-estilo-viking-yggdrasil-15mm-ajustaveis-joi" %}{% assign ghost_product_id = "CW004" %}
  {% when "pulseira-magnetico-bioquantico-de-equilibrio-original" %}{% assign ghost_product_id = "CW005" %}
  {% when "bluetooth-conectado-telefone-relogio-inteligente-das-mulheres-dos-homens-musica" %}{% assign ghost_product_id = "CW006" %}
  {% when "amoled-relogio-inteligente-banda-smartwatch-feminino-masculino-frequencia-cardia" %}{% assign ghost_product_id = "CW007" %}
  {% when "curren-relogio-de-ouro-feminino-relogios-senhoras-criativo-aco-pulseira-relogios" %}{% assign ghost_product_id = "CW008" %}
  {% when "diamante-relogio-feminino-marca-de-luxo-2025-strass-elegante-senhoras-relogios-r" %}{% assign ghost_product_id = "CW009" %}
  {% when "novo-relogio-inteligente-masculino-de-2-01-polegadas-para-atividades-ao-ar-livre" %}{% assign ghost_product_id = "CW010" %}
  {% when "gps-ecg-ppg-bluetooth-chamada-smartwatch-pulseira-esportiva-relogio-inteligent" %}{% assign ghost_product_id = "CW011" %}
  {% when "curren-relogios-masculinos-marca-superior-de-luxo-moda-amp-casual-negocios-rel" %}{% assign ghost_product_id = "CW012" %}
  {% when "reloj-hombre-2023-relogio-masculino-minimalista-ultra-fino-relogios-moda-masculi" %}{% assign ghost_product_id = "CW013" %}
  {% when "curren-relogio-de-pulso-masculino-cronografo-a-prova-d-39-agua-militar-do-exe" %}{% assign ghost_product_id = "CW014" %}
  {% when "relogio-masculino-2023-moda-masculino-relogios-de-luxo-aco-inoxidavel-quartzo-re" %}{% assign ghost_product_id = "CW015" %}
{% endcase %}
{% if ghost_product_id != "" %}
<div class="ghost-ar-container">
  <a
    href="https://ghost-project-ai.vercel.app/?productId={{ ghost_product_id }}&embedded=true"
    target="_blank"
    class="ghost-ar-button"
  >
    👁 Ver em AR — Experimente no Pulso
  </a>
</div>
{% endif %}
```

---

## 6. Confirmações pós-edição

| Verificação | Esperado |
|-------------|----------|
| Domínio `-bbvc` | Não deve mais existir em nenhuma linha do arquivo |
| URL para CW005 | `https://ghost-project-ai.vercel.app/?productId=CW005&embedded=true` |
| URL para produto sem mapeamento | Botão não aparece (bloco `{% if %}` protege) |
| `?productId=` vazio | Impossível — `ghost_product_id` nunca é vazio quando o `{% if %}` é verdadeiro |

---

## 7. Observação sobre gsdk.js

O `layout/theme.liquid` do tema carrega:
```html
<script src="https://ghost-project-ai.vercel.app/gsdk.js" defer></script>
```
Este script já usa o domínio correto e também injeta o botão AR dinamicamente. Porém, o bloco Liquid em `sections/product-information.liquid` renderiza um botão estático separado que aparece primeiro — e é esse que gera a URL errada.
