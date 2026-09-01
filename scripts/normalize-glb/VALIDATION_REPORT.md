# VALIDATION_REPORT — GLBs Normalizados
Gerado por `node scripts/normalize-glb/validate.mjs` em 2026-09-01

Critérios por tipo — **watch**: Y maior ou 2ª maior (em pé), alvo 0.08 · **bracelet**: Y é a MENOR dimensão (loop ⊥ Y), alvo 0.07 · **Centralizado**: centro do bbox a < 0.01 da origem · escala ±10%

| Produto | Tipo | Dim X | Dim Y | Dim Z | Orientação? | Centralizado? | Status |
|---------|------|-------|-------|-------|-------------|---------------|--------|
| CW001 | watch | 0.0241 | 0.0800 | 0.0246 | Sim | Sim | ✅ OK |
| CW002 | bracelet | 0.0222 | 0.0697 | 0.0700 | NÃO | Sim | ⚠️ REVISAR (loop não ⊥ Y (Y=0.0697 é a 2ª dimensão, deveria ser a menor)) |
| CW003 | bracelet | 0.0700 | 0.0351 | 0.0646 | Sim | Sim | ✅ OK |
| CW004 | bracelet | 0.0689 | 0.0700 | 0.0315 | Sim | Sim | ✅ OK |
| CW005 | bracelet | 0.0700 | 0.0699 | 0.0317 | Sim | Sim | ✅ OK |
| CW006 | watch | 0.0359 | 0.0800 | 0.0704 | Sim | Sim | ✅ OK |
| CW007 | watch | 0.0488 | 0.0800 | 0.0464 | Sim | Sim | ✅ OK |
| CW008 | watch | 0.0401 | 0.0800 | 0.0257 | Sim | Sim | ✅ OK |
| CW009 | watch | 0.0289 | 0.0800 | 0.0306 | Sim | Sim | ✅ OK |
| CW013 | watch | 0.0216 | 0.0800 | 0.0288 | Sim | Sim | ✅ OK |
| CW014 | watch | 0.0501 | 0.0800 | 0.0192 | Sim | Sim | ✅ OK |
| CW016 | watch | 0.0418 | 0.0800 | 0.0183 | Sim | Sim | ✅ OK |
| CW017 | watch | 0.0538 | 0.0800 | 0.0204 | Sim | Sim | ✅ OK |
| CW018 | watch | 0.0262 | 0.0800 | 0.0393 | Sim | Sim | ✅ OK |
| CW019 | watch | 0.0590 | 0.0800 | 0.0761 | Sim | Sim | ✅ OK |
| CW020 | watch | 0.0432 | 0.0800 | 0.0651 | Sim | Sim | ✅ OK |
| CW021 | watch | 0.0536 | 0.0800 | 0.0296 | Sim | Sim | ✅ OK |
| CW022 | watch | 0.0468 | 0.0800 | 0.0244 | Sim | Sim | ✅ OK |
| CW023 | watch | 0.0503 | 0.0800 | 0.0286 | Sim | Sim | ✅ OK |
| CW024 | watch | 0.0432 | 0.0800 | 0.0319 | Sim | Sim | ✅ OK |
| CW025 | watch | 0.0445 | 0.0800 | 0.0452 | Sim | Sim | ✅ OK |
| CW026 | watch | 0.0577 | 0.0800 | 0.0551 | Sim | Sim | ✅ OK |
| CW027 | watch | 0.0570 | 0.0800 | 0.0289 | Sim | Sim | ✅ OK |
| CW028 | watch | 0.0323 | 0.0800 | 0.0592 | Sim | Sim | ✅ OK |
| CW029 | watch | 0.0469 | 0.0800 | 0.0298 | Sim | Sim | ✅ OK |
| CW030 | watch | 0.0498 | 0.0800 | 0.0347 | Sim | Sim | ✅ OK |
| CW031 | watch | 0.0490 | 0.0800 | 0.0200 | Sim | Sim | ✅ OK |
| CW032 | watch | 0.0251 | 0.0800 | 0.0315 | Sim | Sim | ✅ OK |
| CW033 | watch | 0.0484 | 0.0800 | 0.0190 | Sim | Sim | ✅ OK |
| CW034 | watch | 0.0506 | 0.0800 | 0.0267 | Sim | Sim | ✅ OK |
| CW035 | watch | 0.0336 | 0.0800 | 0.0657 | Sim | Sim | ✅ OK |
| CW036 | watch | 0.0449 | 0.0800 | 0.0189 | Sim | Sim | ✅ OK |
| CW037 | watch | 0.0444 | 0.0800 | 0.0478 | Sim | Sim | ✅ OK |
| CW038 | watch | 0.0444 | 0.0800 | 0.0494 | Sim | Sim | ✅ OK |
| CW039 | watch | 0.0490 | 0.0800 | 0.0703 | Sim | Sim | ✅ OK |

**Resultado: 34/35 ✅ OK · 1 ⚠️ REVISAR**

## Sugestões de correção

### CW002
- ajustar rotationDeg no overrides.json até o eixo do loop ficar em Y (usar ?lab=calibrate-product&productId=CW002)

> Nota de método: o bounding box é calculado transformando os cantos do AABB
> local pelo wrapper AR_NORMALIZED (método padrão do gltf-transform). Rotações
> de 45° inflam o AABB medido em relação à malha real — dimensões X/Y até ~41%
> maiores que o objeto de fato. Use os números como comparativo entre produtos.
