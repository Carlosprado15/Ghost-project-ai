# Fixtures de calibração — agente `ghost-catalog-identity`

Reconstroem os **dois erros reais de identidade já vividos no projeto**, para
provar que o agente (e o `check-identity.mjs` por baixo dele) detecta os dois
**sozinho, sem dica**, antes de confiarmos nele para produto novo.

Nenhum destes arquivos é catálogo real — são cópias/recortes de estado antigo.

## Caso 1 — CW006/CW007: dois `ghostId`, um produto só

`products.cw006-cw007-dup.json` — snapshot mínimo onde CW006 e CW007 apontam
para a **mesma `imageUrl`** e a **mesma `platformRef`** (`gid://…/9278949916890`,
o LIGE Chronos). É o estado de antes da resolução de 01/09/2026
(ver `docs/CATALOG_IDENTITY_NOTES.md`).

Esperado: `check-identity.mjs` marca **FALHA** por colisão de `platformRef` **e**
por colisão de `imageUrl`, nomeando o outro id.

Rodar:
```
node scripts/normalize-glb/check-identity.mjs --products scripts/normalize-glb/fixtures/identity-test/products.cw006-cw007-dup.json
```

## Caso 2 — CW017: foto de referência de outro produto desde julho

- `CW017.badphoto.png` — a foto que estava em `fotos-limpas/CW017.png` de
  13/07 a 02/09/2026: um relógio-astronauta genérico de pulseira de metal,
  **não** o Smartwatch T9 preto de silicone que o produto é. Extraída de
  `git show 6a4bc41^`.
- `products.cw017-badphoto.json` — a entrada do CW017 como estava então
  (título "Smartwatch T9 – Monitor Cardíaco & Assistente de Voz", handle sobre
  "heart-rate-monitoring … ai-intelligent-voice").
- `photos-cw017/` — pool de fotos com `CW017.png`, `CW006.png` e `CW007.png`
  **todas** = a mesma imagem de demo do astronauta (era assim que estava),
  mais `CW001.png` e `CW008.png` reais para provar que não dá falso positivo.

Esperado:
1. `check-identity.mjs` marca **FALHA** — a foto do CW017 é o mesmo arquivo da
   do CW006 e da do CW007 (MAD ≈ 0): imagem de demo reaproveitada.
2. O agente, na camada semântica, marca **FALHA/ATENÇÃO** — o produto é um
   smartwatch digital de silicone com voz/IA, a foto é um relógio analógico de
   pulseira de metal com tema astronauta. Formato físico não bate com o título.

Rodar:
```
node scripts/normalize-glb/check-identity.mjs --products scripts/normalize-glb/fixtures/identity-test/products.cw017-badphoto.json --photos scripts/normalize-glb/fixtures/identity-test/photos-cw017
```
