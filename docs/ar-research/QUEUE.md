# QUEUE — Fila de Pesquisa AR-KB

**PESQUISA P0 REATIVADA em 28/08, sob demanda.** Carlos autorizou
explicitamente (conversa de 28/08): sempre que for necessário pesquisar pra
resolver um problema real do motor AR, não precisa pedir de novo a cada
vez — o bloqueio anterior era um limite que o Claude Code tinha colocado
sozinho por precaução de custo, não uma restrição do Carlos. Continua valendo
o hábito de registrar custo/duração em `CUSTOS.md` pra manter isso visível,
e de rodar pesquisa ligada a um problema concreto, não só pra "esgotar a
fila" sem necessidade. P1/P2 continuam `CONGELADA-POS-LANCAMENTO` — essa
parte não mudou, é expansão (corpo/ambiente), não resolução de problema
atual.

Formato por linha: `QR-NNN [PRIORIDADE][CAMADA][STATUS] pergunta`

Status possíveis: `ABERTA` → `RESPONDIDA` (virou um `AR-KB-XXX` em topics/)
ou `COBERTA` (já respondida por um tópico existente, sem gastar pesquisa
nova — o ciclo aponta pra qual `AR-KB-XXX` cobre).

Prioridade: **P0** = desbloqueia o lançamento com pulso · **P1** = camada
transversal, serve para qualquer alvo · **P2** = expansão corpo e ambiente.

Cada ciclo (`scripts/ar-research/cycle.sh`/`.bat`) pega a pergunta ABERTA de
maior prioridade (P0 antes de P1 antes de P2; dentro da mesma prioridade,
ordem de listagem), responde, e marca o status aqui.

## CONGELAMENTO P1/P2 (2026-08-27) — motivo: custo real ~$1/ciclo, orçamento apertado até o lançamento

Todas as perguntas P1 e P2 estão marcadas `CONGELADA-POS-LANCAMENTO` — os
ciclos não pegam nenhuma delas até serem reabertas manualmente. Só P0 roda
por enquanto (ver prompt de `cycle.sh`/`cycle.bat`, que já reforça isso).

**Custo médio medido por ciclo:** $0,99 (média de 2 ciclos reais medidos sob
o sistema de custo: $0,8870 e $1,0831 — a amostra é pequena, revisar depois
de mais ciclos).

**P0 abertas hoje: 14.** Estimativa pra terminar essas 14: **~$12 a ~$15**
(14 × custo médio, faixa cobrindo os dois valores medidos). **Ressalva
importante:** essa conta cobre só as 14 perguntas que já existem agora —
cada tópico respondido até agora gerou 2 a 3 perguntas P0 novas (AR-KB-001
gerou 2, AR-KB-002 gerou 2, AR-KB-003 gerou 3), então o número real de
ciclos pra "esgotar" P0 tende a ser maior que 14, não um teto fixo.

---

## P0 — desbloqueia o lançamento com pulso

- QR-049 [P0][D][RESPONDIDA → AR-KB-005] Troca de par de landmarks de referência (ex.: lm5–lm17 → lm1–lm17, "modo degradado") pra calcular o ângulo de orientação de um objeto rastreado por câmera: como a literatura evita ou compensa o salto/erro que essa troca de referência introduz no ângulo calculado — achado real em teste físico do Ghost Engine (28/08): rotações registradas em ~93°/293° sem o pulso real estar nessa posição, `wristAnchor.js` tem uma constante de compensação (`FALLBACK_ROT_TRIM_DEG`) zerada pra esse caso
- QR-001 [P0][F][RESPONDIDA → AR-KB-001] One Euro Filter vs Kalman vs filtro ponderado por confiança para landmark de pulso em navegador mobile: relação estabilidade versus latência, com números
- QR-002 [P0][F][RESPONDIDA → AR-KB-002] Wrap-around de rotação ±180 graus em filtro temporal: formulação matemática correta com quaternion e com ângulo desembrulhado
- QR-003 [P0][B][RESPONDIDA → AR-KB-003] MediaPipe HandLandmarker em GPU Adreno via WebGL: FPS documentado, uso de memória, modos de falha conhecidos
- QR-050 [P0][D][RESPONDIDA → AR-KB-006] Como estruturar o estado de crossoverOffset entre frames em wristAnchor.js — parâmetro no chamador vs. closure — sem quebrar testabilidade do módulo? (promovida — completa o fix do AR-KB-005, problema real ativo)
- QR-051 [P0][F][RESPONDIDA → AR-KB-007] Quantos frames de interpolação na transição de par de landmarks são perceptíveis como lag em AR de pulso a 30 fps? Existe limiar documentado de latência perceptível para movimento de jóia no pulso? (promovida — mesma razão)
- QR-052 [P0][E][RESPONDIDA → AR-KB-008] Quando tracking é perdido (holdLastPose ativa) e depois recuperado, anchorState deve ser zerado, preservado ou congelado até próxima transição primário→fallback? (promovida — completa o fix do AR-KB-005)
- QR-053 [P0][F][RESPONDIDA → AR-KB-009] crossoverOffset deve ser aplicado como step function (valor fixo enquanto degraded=true) ou interpolado → 0 nos primeiros N frames do fallback? Lag de interpolação perceptível em AR de pulso a 30 fps? (promovida — última peça do fix)
- QR-004 [P0][H][ABERTA] Mapeamento de coordenadas normalizadas para elemento com object-fit cover: formulação canônica e armadilhas
- QR-005 [P0][E][ABERTA] Recuperação após perda de tracking: re-detecção, predição, hold-last-pose — trade-offs e valores de timeout usados na prática
- QR-006 [P0][G][ABERTA] Estimativa de escala sem sensor de profundidade: quais referências anatômicas a literatura usa e qual erro típico
- QR-007 [P0][D][ABERTA] Landmark de pulso isolado versus pose completa da mão para derivar orientação do antebraço: qual é mais estável
- QR-008 [P0][N][ABERTA] Medir latência real entrada-para-saída em pipeline de AR web mobile: metodologia aceita, não só FPS
- QR-009 [P0][A][ABERTA] Erros de driver de estabilização óptica interferindo em pipeline de câmera web: existe caso documentado
- QR-010 [P0][M][ABERTA] model-viewer versus Three.js puro para AR de precisão: limites reais de controle de transformação e desempenho

## P1 — camada transversal, serve para qualquer alvo

- QR-011 [P1][C][CONGELADA-POS-LANCAMENTO] Detection versus tracking: por que detectores por frame geram jitter e quais arquiteturas resolvem isso
- QR-012 [P1][D][CONGELADA-POS-LANCAMENTO] Pose estimation a partir de landmarks 2D mais profundidade relativa: PnP, algoritmos e requisitos de calibração
- QR-013 [P1][G][CONGELADA-POS-LANCAMENTO] Calibração intrínseca de câmera em navegador: o que dá para obter sem calibração manual e qual erro isso introduz
- QR-014 [P1][H][CONGELADA-POS-LANCAMENTO] Sistemas de coordenadas em AR web: handedness, espelhamento de câmera frontal, viewport, e as inversões que mais causam bug
- QR-015 [P1][F][CONGELADA-POS-LANCAMENTO] Filtragem adaptativa por velocidade: como evitar arrasto em movimento rápido sem perder estabilidade em repouso
- QR-016 [P1][J][CONGELADA-POS-LANCAMENTO] Spatial anchoring: o que diferencia âncora real de simples reposicionamento por frame
- QR-017 [P1][E][CONGELADA-POS-LANCAMENTO] Métricas objetivas de tracking: detection rate, continuity, loss rate, recovery time, jitter — definições e como medir
- QR-018 [P1][N][CONGELADA-POS-LANCAMENTO] Orçamento de desempenho para AR web mobile: divisão típica entre inferência, render e composição
- QR-019 [P1][O][CONGELADA-POS-LANCAMENTO] Variação entre aparelhos Android: FOV, resolução, rolling shutter, capacidade de ML — o que quebra um motor que só foi testado em um aparelho
- QR-020 [P1][M][CONGELADA-POS-LANCAMENTO] Composição de vídeo de câmera com WebGL sem perda de sincronia entre frame e pose
- QR-021 [P1][I][CONGELADA-POS-LANCAMENTO] Ordem correta de transformações translação, rotação, escala em anexo de objeto a um alvo em movimento
- QR-022 [P1][N][CONGELADA-POS-LANCAMENTO] WebGPU em navegador Android e iOS em 2026: cobertura real e ganho medido versus WebGL para inferência de visão
- QR-023 [P1][B][CONGELADA-POS-LANCAMENTO] Alternativas ao MediaPipe para inferência de visão em web mobile: ONNX Runtime Web, TensorFlow.js, WebNN — maturidade e custo
- QR-024 [P1][G][CONGELADA-POS-LANCAMENTO] Calibração automática de orientação de modelo 3D: existe método robusto para GLB de origem arbitrária
- QR-025 [P1][P][CONGELADA-POS-LANCAMENTO] Sinais de UX que fazem um AR parecer estável mesmo com erro residual: sombra, contato, resposta a movimento

## P2 — expansão corpo e ambiente

- QR-026 [P2][C][CONGELADA-POS-LANCAMENTO] Body tracking em web mobile: MediaPipe Pose, BlazePose e concorrentes — precisão e custo
- QR-027 [P2][C][CONGELADA-POS-LANCAMENTO] Face e head tracking para óculos: requisitos diferentes de precisão em relação a pulso
- QR-028 [P2][D][CONGELADA-POS-LANCAMENTO] Anéis e dedos: por que tracking de dedo é mais difícil que pulso e o que a literatura propõe
- QR-029 [P2][K][CONGELADA-POS-LANCAMENTO] Depth estimation monocular em mobile: modelos disponíveis, latência e qualidade suficiente para oclusão
- QR-030 [P2][L][CONGELADA-POS-LANCAMENTO] Oclusão em web mobile sem LiDAR: o que é possível hoje de fato, com segmentação de pessoa e mapa de profundidade
- QR-031 [P2][J][CONGELADA-POS-LANCAMENTO] SLAM e odometria visual-inercial no navegador: WebXR, o que existe e o que não existe
- QR-032 [P2][J][CONGELADA-POS-LANCAMENTO] Colocação de móveis em ambiente via WebXR hit-test: cobertura por plataforma e limitações no iOS
- QR-033 [P2][G][CONGELADA-POS-LANCAMENTO] Medição corporal a partir de câmera única: precisão alcançável, para viabilizar o conceito de passaporte espacial
- QR-034 [P2][I][CONGELADA-POS-LANCAMENTO] Escala física real em ambiente: como obter metro verdadeiro sem marcador e sem LiDAR
- QR-035 [P2][A][CONGELADA-POS-LANCAMENTO] ARKit e ARCore acessíveis via navegador: o que realmente passa para a web e o que exige app nativo
- QR-036 [P2][L][CONGELADA-POS-LANCAMENTO] Segmentação de pessoa em tempo real na web: modelos, latência e qualidade de borda
- QR-037 [P2][M][CONGELADA-POS-LANCAMENTO] Iluminação estimada e sombra de contato: quanto isso aumenta a percepção de realismo, com evidência
- QR-038 [P2][N][CONGELADA-POS-LANCAMENTO] Arquitetura modular de motor AR: como projetar para trocar detector, tracker, filtro e renderizador sem quebrar o resto
- QR-039 [P2][O][CONGELADA-POS-LANCAMENTO] Motores comerciais de AR try-on: quais camadas eles resolvem e onde estão os limites públicos deles
- QR-040 [P2][K][CONGELADA-POS-LANCAMENTO] Fusão de sensores inerciais do aparelho com tracking visual no navegador: DeviceMotion é utilizável na prática

---

## Perguntas geradas por tópicos já respondidos

Geradas por AR-KB-001:

- QR-041 [P0][F][ABERTA] O @mediapipe/tasks-vision WASM aplica OneEuroFilter internamente antes de exportar worldLandmarks? Se sim, com quais parâmetros?
- QR-042 [P0][F][ABERTA] Com dupla suavização (WASM interno + OneEuroFilter.js), qual é o lag real medido no aparelho de teste vs. sem o filtro JS?
- QR-043 [P1][E][CONGELADA-POS-LANCAMENTO] Como integrar o score de confiança do HandLandmarker ao holdLastPose de forma gradual (não binária) sem introduzir drift?

  **2026-08-30:** QR-041/042 deixam de ser só do motor novo — auditoria do
  motor ANTIGO achou que `src/tracking/PoseWristTracker.js` (reforço de
  braço, em produção via App_FINAL.jsx) também usa `@mediapipe/tasks-vision`
  (`PoseLandmarker`), sem nenhuma opção de suavização configurada. Mesma
  pergunta, agora também sobre código que já está na loja, não só no
  laboratório — ver AR-KB-001.md, seção "Aplicação ao Ghost".

Geradas por AR-KB-003:

- QR-046 [P0][B][ABERTA] O delegate "GPU" em @mediapipe/tasks-vision 0.10.35 realmente usa WebGL no Chrome Android ou ainda cai em XNNPACK silenciosamente? Como detectar sem devtools?
- QR-047 [P0][N][ABERTA] Mover detectForVideo() para Web Worker: custo de postMessage de frame de vídeo (SharedArrayBuffer vs Transferable vs ImageData) — latência e complexidade de implementação?
- QR-048 [P0][N][ABERTA] Web Worker com SharedArrayBuffer exige COOP/COEP headers; Vercel/Shopify permitem esses headers no deploy estático do Ghost?

Geradas por AR-KB-005: QR-050 e QR-051 promovidas pro topo da fila P0
principal (logo após QR-003) em 28/08 — completam o fix de um problema
real ativo, prioridade maior que o resto da lista genérica.

Geradas por AR-KB-006: QR-052 e QR-053 promovidas pro topo da fila P0
principal em 28/08, mesma razão das anteriores.

Geradas por AR-KB-008:

- QR-055 [P0][E][ABERTA] Ao implementar reset de crossoverOffset em GhostEngine.js,
  como testar a corretude do estado sem UI? Existe padrão para teste unitário de
  máquinas de estado de tracking com sequência landmarks/null/landmarks?

Geradas por AR-KB-009:

- QR-056 [P0][D][ABERTA] Na transição de RETORNO (fallback→primário, quando lm5 reaparece),
  o crossoverOffset precisa de compensação simétrica, ou o par primário já retorna ao
  ângulo correto sem correção adicional? Existe risco de jump no retorno?

Geradas por AR-KB-007:

- QR-054 [P1][P][CONGELADA-POS-LANCAMENTO] Motion masking: durante movimento rápido de mão, artifacts de tracking são menos detectáveis em AR? Existe limiar de velocidade angular documentado para mão/pulso acima do qual step function se torna preferível à rampa (artifact mascarado pelo próprio movimento)?

Geradas por AR-KB-002:

- QR-044 [P0][F][ABERTA] O hold-last-pose e o reset de tracking reiniciam os campos de estado do unwrap em GhostEngine? Se não, re-detecção começará com ângulo acumulado errado e o filtro divergirá.
- QR-045 [P0][F][ABERTA] Com unwrapping ativo e rotação de pulso contínua (>1 volta), o ângulo acumulado crescerá indefinidamente — existe um protocolo de re-normalização periódica sem causar descontinuidade visível?
