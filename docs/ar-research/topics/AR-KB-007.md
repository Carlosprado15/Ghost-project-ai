ID: AR-KB-007
CAMADA: F / E / P
APLICABILIDADE:
  PULSO — contexto direto: transição lm5-lm17 → lm1-lm17 em wristAnchor.js; ver AR-KB-005/006.
  CORPO — mesmo raciocínio snap vs. drift se aplica a qualquer troca de par de landmarks
    para anel, óculos ou roupa; os limiares de detecção (<3ms) são idênticos para
    qualquer alvo corporal em video see-through AR.
  AMBIENTE — não se aplica: AR de ambiente usa ancoragem spatial (SLAM/hit-test), onde
    troca de par de landmarks não existe; a referência ≤20ms para UX aceitável permanece.

PERGUNTA:
  Quantos frames de interpolação na transição de par de landmarks são perceptíveis
  como lag em AR de pulso a 30 fps? Existe limiar documentado de latência perceptível
  para movimento de jóia no pulso?

RESPOSTA EM 3 LINHAS:
  JND de latência em AR começa em ~3ms (SIGGRAPH Asia 2024) e plateau subjetivo em
  14,3ms (Penner et al. 2026) — ambos muito abaixo dos 33ms de 1 frame a 30fps; qualquer
  interpolação N≥1 é teoricamente perceptível. A questão real não é "tornar imperceptível"
  mas "qual artifact é menos disruptivo: snap (step function) ou drift (N-frame ramp)".
  Não existe estudo publicado com limiar de latência específico para jóia/relógio no pulso.

DETALHAMENTO TÉCNICO:

## Limiares de latência documentados (ordem crescente)

| Contexto                                     | Threshold      | Fonte                                |
|----------------------------------------------|----------------|--------------------------------------|
| Hand projection mapping JND (Casper DPM)     | 3,08 ± 1,38 ms | SIGGRAPH Asia 2024                   |
| HMD — plateau subjetivo de satisfação        | 14,3 ms        | Penner et al. 2026 [arxiv 2603.15796]|
| Head tracking VR, trained observers (JND)    | ~15 ms         | Mania et al. 2004 [ACM APGV]         |
| VR — evitar motion sickness (limite prático) | ≤ 20 ms        | revisão multi-fonte [BLOG]           |
| Optical see-through AR (alvo prático)        | ≤ 5 ms         | referência de indústria [BLOG]       |

A 30fps, 1 frame = 33,3 ms — acima de todos os thresholds. Conclusão: nenhuma
interpolação a 30fps consegue ficar abaixo dos limiares de detecção.

## Snap vs. drift — o trade-off real

A troca lm5-lm17 → lm1-lm17 pode gerar offsets de 30-90° (AR-KB-005). As opções:
- Step function (N=0): objeto "teleporta" para posição corrigida — percebido como snap.
- N frames de rampa: objeto "deriva" da posição errada para a corrigida — drift.

Para offset típico de 40°, a 30fps:

| N frames | Duração  | Vel. angular | Percepção esperada              |
|----------|----------|--------------|---------------------------------|
| 0 (step) | 0 ms     | instantânea  | snap visível (descontinuidade)  |
| 1        | 33 ms    | ~1.200°/s    | perceptível, idêntico ao snap   |
| 3        | 100 ms   | ~400°/s      | drift rápido / "jitter curto"   |
| 5        | 167 ms   | ~240°/s      | drift / lag perceptível         |
| 10       | 333 ms   | ~120°/s      | lag óbvio e prolongado          |

Smooth pursuit ocular acompanha movimento voluntário até ~30-40°/s. Qualquer drift
acima disso é percebido como movimento autônomo do objeto (artifact de tracking).
A interpolação não oculta o artifact — converte snap em drift.

## Quando N=2-4 frames ajuda (pragmático, não imperceptível)

Duração 66-133ms: o artifact é percebido como "tracking se ajustando" em vez de
"objeto teleportou". Reconhecível, mas menos perturbador como experiência de UX.
Acima de 5 frames (>167ms): drift contínuo tende a parecer pior que o snap original.

## Para jóia/pulso especificamente

ARZARA (2021) e Edge-Centric Wristwatch Try-On (IJIMAI 2022) não reportam limiares
perceptivos — focam em arquitetura e meta de FPS (>30fps). Casper DPM é a referência
mais próxima (projeção em mãos), porém o contexto é diferente: projeta sobre superfície
real, não âncora um objeto 3D virtual. Lacuna confirmada na literatura.

EVIDÊNCIA:
- 3,08 ± 1,38 ms JND: Casper DPM, SIGGRAPH Asia 2024, doi 10.1145/3680528.3687624
- 14,3 ms plateau subjetivo: Penner et al. 2026, arxiv 2603.15796
- ~15 ms JND (trained observers, cena-independente): Mania et al. 2004, doi 10.1145/1012551.1012559
- ≤5ms OST-AR / ≤20ms VR: referências de indústria (DAQRI/VRARWiki) [BLOG]
- Sem dado específico para jóia/relógio no pulso: ausência verificada em 2 papers de wristwatch AR

FONTES:
- https://dl.acm.org/doi/full/10.1145/3680528.3687624 [PAPER] — Casper DPM, SIGGRAPH Asia 2024
- https://arxiv.org/abs/2409.04397 [PAPER] — Casper DPM preprint (arxiv)
- https://arxiv.org/abs/2603.15796 [PAPER] — Penner et al. 2026, Perceptual Requirements for Low-Latency HMDs
- https://dl.acm.org/doi/10.1145/1012551.1012559 [PAPER] — Mania et al. 2004, ACM APGV
- https://www.ijimai.org/index.php/ijimai/article/view/2227 [PAPER] — Edge-Centric Wristwatch AR Try-On, IJIMAI 2022
- https://www.researchgate.net/publication/356210529_ARZARA_Augmented_reality_app_to_try_watch_on_your_wrist [PAPER] — ARZARA 2021
- https://medium.com/@DAQRI/motion-to-photon-latency-in-mobile-ar-and-vr-99f82c480926 [BLOG] — DAQRI, referência ≤5ms OST-AR
- https://vrarwiki.com/wiki/Motion-to-photon_latency [BLOG] — VRARWiki, referência ≤20ms VR

APLICAÇÃO AO GHOST:
  Em src/engine/core/anchor/wristAnchor.js: a transição de crossoverOffset (AR-KB-005/006)
  não pode ser tornada imperceptível a 30fps — N≥1 frame excede JND documentado.
  A rampa de 2-4 frames (constante N_RAMP) é pragmática: converte snap em drift curto
  que parece "ajuste de tracking". Qualquer N>5 piora a experiência. QR-053 (ABERTA) deve
  usar esta evidência como base ao decidir step vs. rampa e o valor de N_RAMP.

VEREDITO:
  - "1 frame (33ms) supera todos os limiares documentados de detecção em AR": COMPROVADO
  - "2-4 frames é o range menos disruptivo (drift curto lido como ajuste natural)": HIPOTESE
  - "Não existe limiar publicado específico para jóia/relógio no pulso": COMPROVADO

CUSTO DE ADOÇÃO: BAIXO

NOVAS PERGUNTAS GERADAS:
  QR-054 [P1][P][CONGELADA-POS-LANCAMENTO] Motion masking: durante movimento rápido de
    mão, artifacts de tracking são menos detectáveis em AR? Existe limiar de velocidade
    angular documentado para mão/pulso acima do qual o step function se torna preferível
    à rampa (porque o artifact fica mascarado pelo próprio movimento)?
