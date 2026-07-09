# VALIDATION_REPORT — GLBs Normalizados
Gerado por `node scripts/normalize-glb/validate.mjs` em 2026-07-05

Critérios por tipo — **watch**: Y maior ou 2ª maior (em pé), alvo 0.08 · **bracelet**: Y é a MENOR dimensão (loop ⊥ Y), alvo 0.07 · **Centralizado**: centro do bbox a < 0.01 da origem · escala ±10%

| Produto | Tipo | Dim X | Dim Y | Dim Z | Orientação? | Centralizado? | Status |
|---------|------|-------|-------|-------|-------------|---------------|--------|
| CW001 | watch | 0.0425 | 0.0800 | 0.0684 | Sim | Sim | ✅ OK |
| CW002 | watch | 0.0293 | 0.0758 | 0.0800 | Sim | Sim | ✅ OK |
| CW003 | watch | 0.0205 | 0.0755 | 0.0800 | Sim | Sim | ✅ OK |
| CW004 | watch | 0.0382 | 0.0797 | 0.0800 | Sim | Sim | ✅ OK |
| CW005 | watch | 0.0411 | 0.0800 | 0.0705 | Sim | Sim | ✅ OK |
| CW006 | watch | 0.0486 | 0.0800 | 0.0597 | Sim | Sim | ✅ OK |
| CW007 | watch | 0.0513 | 0.0800 | 0.0723 | Sim | Sim | ✅ OK |
| CW008 | watch | 0.0561 | 0.0800 | 0.0739 | Sim | Sim | ✅ OK |
| CW009 | bracelet | 0.0445 | 0.0700 | 0.0500 | Sim | Sim | ✅ OK |
| CW010 | watch | 0.0543 | 0.0800 | 0.0271 | Sim | Sim | ✅ OK |
| CW011 | bracelet | 0.0700 | 0.0381 | 0.0603 | Sim | Sim | ✅ OK |
| CW012 | bracelet | 0.0700 | 0.0305 | 0.0642 | Sim | Sim | ✅ OK |
| CW013 | bracelet | 0.0700 | 0.0652 | 0.0311 | Sim | Sim | ✅ OK |
| CW014 | bracelet | 0.0690 | 0.0388 | 0.0700 | Sim | Sim | ✅ OK |
| CW015 | bracelet | 0.0700 | 0.0633 | 0.0209 | Sim | Sim | ✅ OK |

**Resultado: 15/15 ✅ OK · 0 ⚠️ REVISAR**

> Nota de método: o bounding box é calculado transformando os cantos do AABB
> local pelo wrapper AR_NORMALIZED (método padrão do gltf-transform). Rotações
> de 45° inflam o AABB medido em relação à malha real — dimensões X/Y até ~41%
> maiores que o objeto de fato. Use os números como comparativo entre produtos.
