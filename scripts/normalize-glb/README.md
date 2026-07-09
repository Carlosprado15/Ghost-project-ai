# Pipeline de Normalização de GLBs para AR

## O que o script faz

Os GLBs dos produtos (CW001–CW015) vêm da conversão via **Tripo 3D** com três
defeitos que quebram o ancoramento AR: orientação arbitrária, escala incorreta
e origem descentrada. O `normalize.mjs` corrige os três, produto por produto:

| Etapa | Correção |
|---|---|
| **Centralizar** | origem movida para o centro geométrico do bounding box |
| **Orientar** | rotação X=−90° — converte Y-up (Tripo 3D) para Z-up (WebGL/AR), face do relógio para +Z |
| **Escalar** | maior dimensão normalizada para **0.08 unidades** (~8 cm — tamanho real de relógio no pulso em coordenadas AR) |

A normalização é feita por um **nó-pai `AR_NORMALIZED` com TRS** envolvendo a
cena — nenhuma malha é reescrita, então a compressão existente
(`KHR_mesh_quantization`, texturas webp) passa intacta e o tamanho do arquivo
não muda.

Os arquivos normalizados vão para **`public/models/normalized/`** com o mesmo
nome. **Os originais em `public/models/` nunca são tocados.**

## Como rodar

```
node scripts/normalize-glb/normalize.mjs
```

Requer as devDependencies `@gltf-transform/core`, `@gltf-transform/extensions`
e `@gltf-transform/functions` (já em `package.json`). O script imprime uma
tabela com tamanho antes/depois, dimensões originais e fator de escala de cada
produto — as dimensões impressas são também um diagnóstico rápido de quais
GLBs estavam deitados (ex.: CW012–CW014 têm Y ≈ 0.1).

## Como testar os modelos normalizados no lab (A/B seguro)

Adicionar `?useNormalized=1` à URL do lab tasks-wrist:

```
# original (produção — sem mudança de comportamento)
https://192.168.0.140:5173/?lab=tasks-wrist

# normalizado (A/B)
https://192.168.0.140:5173/?lab=tasks-wrist&useNormalized=1

# outro produto normalizado
https://192.168.0.140:5173/?lab=tasks-wrist&useNormalized=1&productId=CW012
```

Sem o parâmetro, o lab usa os GLBs originais — zero risco para o que já
funciona. O caminho ativo aparece no ▼ HUD (`modelUrl:`), então dá para
confirmar na tela qual versão está carregada.

Nota: os normalizados já ficam "em pé" por construção; se o ajuste
`orientation="0deg 0deg -90deg"` do model-viewer (feito para os originais)
sobrar ou faltar no A/B, esse atributo no `TasksWristLab.jsx` é o primeiro
lugar para ajustar.
