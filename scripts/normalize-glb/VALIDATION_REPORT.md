# VALIDATION_REPORT — GLBs Normalizados
Gerado por `node scripts/normalize-glb/validate.mjs` em 2026-07-10

Critérios por tipo — **watch**: Y maior ou 2ª maior (em pé), alvo 0.08 · **bracelet**: Y é a MENOR dimensão (loop ⊥ Y), alvo 0.07 · **Centralizado**: centro do bbox a < 0.01 da origem · escala ±10%

| Produto | Tipo | Dim X | Dim Y | Dim Z | Orientação? | Centralizado? | Status |
|---------|------|-------|-------|-------|-------------|---------------|--------|
| CW001 | watch | 0.0429 | 0.0776 | 0.0800 | Sim | Sim | ✅ OK |
| CW002 | bracelet | 0.0700 | 0.0640 | 0.0510 | Sim | Sim | ✅ OK |
| CW003 | bracelet | 0.0381 | 0.0630 | 0.0700 | Sim | Sim | ✅ OK |
| CW004 | bracelet | 0.0694 | 0.0700 | 0.0451 | Sim | Sim | ✅ OK |
| CW005 | bracelet | 0.0700 | 0.0491 | 0.0626 | Sim | Sim | ✅ OK |
| CW006 | watch | 0.0546 | 0.0800 | 0.0767 | Sim | Sim | ✅ OK |
| CW007 | watch | 0.0800 | 0.0792 | 0.0521 | Sim | Sim | ✅ OK |
| CW008 | watch | 0.0559 | 0.0741 | 0.0800 | Sim | Sim | ✅ OK |
| CW009 | bracelet | 0.0700 | 0.0448 | 0.0419 | Sim | Sim | ✅ OK |
| CW010 | watch | 0.0477 | 0.0800 | 0.0502 | Sim | Sim | ✅ OK |
| CW011 | bracelet | 0.0700 | 0.0691 | 0.0459 | Sim | Sim | ✅ OK |
| CW012 | watch | 0.0790 | 0.0800 | 0.0387 | Sim | Sim | ✅ OK |
| CW013 | watch | 0.0800 | 0.0790 | 0.0342 | Sim | Sim | ✅ OK |
| CW014 | watch | 0.0378 | 0.0789 | 0.0800 | Sim | Sim | ✅ OK |
| CW015 | watch | 0.0420 | 0.0800 | 0.0772 | Sim | Sim | ✅ OK |

**Resultado: 15/15 ✅ OK · 0 ⚠️ REVISAR**

> Nota de método: o bounding box é calculado transformando os cantos do AABB
> local pelo wrapper AR_NORMALIZED (método padrão do gltf-transform). Rotações
> de 45° inflam o AABB medido em relação à malha real — dimensões X/Y até ~41%
> maiores que o objeto de fato. Use os números como comparativo entre produtos.
