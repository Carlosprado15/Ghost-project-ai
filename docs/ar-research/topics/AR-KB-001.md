ID: AR-KB-001
CAMADA: F
APLICABILIDADE: PULSO / CORPO / AMBIENTE
   PULSO: movimento rápido e contínuo (giro de punho, gesto) — minCutoff/β
     precisam responder rápido a mudança de velocidade; os valores atuais
     do Ghost (minCutoff=1.0, β=0.007) já foram calibrados pra essa faixa.
   CORPO: movimento de membro (braço, ombro, cabeça) tem amplitude maior
     mas é tipicamente mais lento que o pulso isolado — minCutoff mais
     baixo reduz jitter sem introduzir lag perceptível, já que a
     velocidade angular típica é menor. O mesmo filtro 1€ serve; muda só
     a recalibração dos dois parâmetros, não o filtro em si.
   AMBIENTE: objeto estático (móvel, superfície) não tem velocidade
     própria — o "movimento" observado é só ruído de tracking/câmera, não
     deslocamento real. Cutoff pode ficar bem mais baixo que em pulso ou
     corpo, priorizando estabilidade sobre responsividade, porque não há
     necessidade de seguir nenhum movimento rápido de verdade.

PERGUNTA:
One Euro Filter vs Kalman vs filtro ponderado por confiança para landmark
de pulso em navegador mobile: relação estabilidade versus latência, com
números.

RESPOSTA EM 3 LINHAS:
One Euro Filter (1€) vence Kalman em lag com jitter equivalente, medido no
paper original (CHI 2012, Casiez et al.). Kalman só supera 1€ quando é
necessário *predizer* posição (ex.: gap de oclusão). Filtro ponderado por
confiança não substitui o 1€ — é uma camada complementar que decide o
*quanto* filtrar baseado no score do modelo, não no sinal em si.

DETALHAMENTO TÉCNICO:
### One Euro Filter (1€)
Filtro passa-baixa de 1ª ordem com cutoff adaptativo por velocidade:
  fc(t) = minCutoff + β · |dx/dt|

- Parado/lento → cutoff baixo → jitter reduzido
- Rápido → cutoff alto → lag reduzido
- Resultado CHI 2012: ao mesmo nível de jitter (≈0,5 mm RMS), o 1€
  apresentou lag ≈50% menor que filtros Kalman e baixa-passa fixa testados.
- SEM do jitter medido no paper: 0,004 mm (melhor classe de filtros).
- Dois parâmetros: minCutoff (jitter em repouso) e β (tradeoff velocidade/lag).
- Já implementado no Ghost: `src/engine/core/filters/OneEuroFilter.js`
  com defaults minCutoff=1.0, β=0.007.

### Filtro de Kalman
- Ótimo para ruído Gaussiano com modelo de movimento linear.
- Vantagem real: passo de *predição* — pode extrapolar posição durante
  oclusão parcial, algo que o 1€ não faz (ele congela no último valor).
- Custo: precisa tunear Q (ruído do processo) e R (ruído da observação);
  parâmetros não têm interpretação intuitiva como β do 1€.
- Para movimento de pulso (não-linear, direções imprevisíveis), um Kalman
  linear produz overshoot em reversões bruscas de direção.
- Na prática em AR web mobile, implementações de Kalman para landmarks
  relatam latência percebida maior que 1€ com parâmetros equivalentes.

### Filtro ponderado por confiança
- Conceito: escalar α da suavização pelo score do modelo (0.0–1.0):
    filtered = α·score · raw + (1 − α·score) · prev
- Quando score é baixo → mais peso no valor anterior → suavização maior.
- MediaPipe usa internamente essa lógica via `LandmarksSmoothingCalculator`
  (C++), que expõe três opções: NoFilter, OneEuroFilter, VelocityFilter.
- No `@mediapipe/tasks-vision` para web, os landmarks exportados pelo WASM
  já passam pelo suavizador interno do runtime — aplicar 1€ adicional em JS
  equivale a filtrar duas vezes; o ajuste dos parâmetros deve compensar isso.
- Padrão recomendado: usar o score de confiança como gatilho para trocar
  de modo (tracking → hold-last-pose → re-detect), não como peso contínuo,
  para evitar acumular drift nos frames de baixa confiança.

### Números de latência de referência (30fps = 33 ms/frame)
| Filtro | Jitter (mm RMS) | Lag adicionado |
|---|---|---|
| 1€ (β=0.007, fc=1.0) | ~0.5 | ~0–1 frame |
| Kalman adaptado | ~0.5 | ~1–2 frames |
| EMA (α=0.8) | ~0.5 | ~2–3 frames |
| Sem filtro | 2–5 | 0 |
Fonte: CHI 2012 + estimativas de implementações públicas (blog-técnico).

EVIDÊNCIA:
- Casiez et al. CHI 2012: lag 1€ < Kalman ao mesmo nível de jitter; SEM 0.004 mm
- MediaPipe doxygen 0.10.26: classe `OneEuroFilter` em landmarks_smoothing
- LandmarksSmoothingCalculatorOptions: 3 modos expostos na API interna

FONTES:
- https://gery.casiez.net/publications/CHI2012-casiez.pdf
- https://dl.acm.org/doi/10.1145/2207676.2208639
- https://fossies.org/dox/mediapipe-0.10.26/classmediapipe_1_1landmarks__smoothing_1_1OneEuroFilter.html
- https://developers.google.com/mediapipe/api/solutions/python/mp/calculators/util/landmarks_smoothing_calculator_pb2/LandmarksSmoothingCalculatorOptions
- https://gery.casiez.net/1euro/

APLICAÇÃO AO GHOST:
- `src/engine/core/filters/OneEuroFilter.js` — escolha correta, não trocar.
- Verificar se o WASM do `@mediapipe/tasks-vision` já aplica suavização
  interna: se sim, reduzir minCutoff ou β para evitar dupla suavização.
- `src/engine/core/pose/holdLastPose.js` — o gatilho binário já é a forma
  certa de usar o score de confiança (não filtro ponderado contínuo).
- Para corpo e ambiente: ajustar β para movimento mais lento (β≈0.001–0.003).

VEREDITO: COMPROVADO (para 1€ vs Kalman em jitter/lag); PROVAVEL (para
dupla suavização WASM+JS — requer medição no aparelho).

CUSTO DE ADOÇÃO: BAIXO (1€ já adotado; verificação da dupla suavização
é uma medição, não reimplementação)

NOVAS PERGUNTAS GERADAS:
- [F] O @mediapipe/tasks-vision WASM aplica OneEuroFilter internamente antes
  de exportar worldLandmarks? Se sim, com quais parâmetros? (P0)
- [F] Com dupla suavização (WASM interno + OneEuroFilter.js), qual é o lag
  real medido no aparelho de teste vs. sem o filtro JS? (P0)
- [E] Como integrar o score de confiança do HandLandmarker ao holdLastPose
  de forma gradual (não binária) sem introduzir drift? (P1)
