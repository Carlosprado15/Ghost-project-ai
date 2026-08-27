# QUEUE — Fila de Pesquisa AR-KB

Formato por linha: `QR-NNN [PRIORIDADE][CAMADA][STATUS] pergunta`

Status possíveis: `ABERTA` → `RESPONDIDA` (virou um `AR-KB-XXX` em topics/)
ou `COBERTA` (já respondida por um tópico existente, sem gastar pesquisa
nova — o ciclo aponta pra qual `AR-KB-XXX` cobre).

Prioridade: **P0** = desbloqueia o lançamento com pulso · **P1** = camada
transversal, serve para qualquer alvo · **P2** = expansão corpo e ambiente.

Cada ciclo (`scripts/ar-research/cycle.sh`/`.bat`) pega a pergunta ABERTA de
maior prioridade (P0 antes de P1 antes de P2; dentro da mesma prioridade,
ordem de listagem), responde, e marca o status aqui.

---

## P0 — desbloqueia o lançamento com pulso

- QR-001 [P0][F][RESPONDIDA → AR-KB-001] One Euro Filter vs Kalman vs filtro ponderado por confiança para landmark de pulso em navegador mobile: relação estabilidade versus latência, com números
- QR-002 [P0][F][RESPONDIDA → AR-KB-002] Wrap-around de rotação ±180 graus em filtro temporal: formulação matemática correta com quaternion e com ângulo desembrulhado
- QR-003 [P0][B][RESPONDIDA → AR-KB-003] MediaPipe HandLandmarker em GPU Adreno via WebGL: FPS documentado, uso de memória, modos de falha conhecidos
- QR-004 [P0][H][ABERTA] Mapeamento de coordenadas normalizadas para elemento com object-fit cover: formulação canônica e armadilhas
- QR-005 [P0][E][ABERTA] Recuperação após perda de tracking: re-detecção, predição, hold-last-pose — trade-offs e valores de timeout usados na prática
- QR-006 [P0][G][ABERTA] Estimativa de escala sem sensor de profundidade: quais referências anatômicas a literatura usa e qual erro típico
- QR-007 [P0][D][ABERTA] Landmark de pulso isolado versus pose completa da mão para derivar orientação do antebraço: qual é mais estável
- QR-008 [P0][N][ABERTA] Medir latência real entrada-para-saída em pipeline de AR web mobile: metodologia aceita, não só FPS
- QR-009 [P0][A][ABERTA] Erros de driver de estabilização óptica interferindo em pipeline de câmera web: existe caso documentado
- QR-010 [P0][M][ABERTA] model-viewer versus Three.js puro para AR de precisão: limites reais de controle de transformação e desempenho

## P1 — camada transversal, serve para qualquer alvo

- QR-011 [P1][C][ABERTA] Detection versus tracking: por que detectores por frame geram jitter e quais arquiteturas resolvem isso
- QR-012 [P1][D][ABERTA] Pose estimation a partir de landmarks 2D mais profundidade relativa: PnP, algoritmos e requisitos de calibração
- QR-013 [P1][G][ABERTA] Calibração intrínseca de câmera em navegador: o que dá para obter sem calibração manual e qual erro isso introduz
- QR-014 [P1][H][ABERTA] Sistemas de coordenadas em AR web: handedness, espelhamento de câmera frontal, viewport, e as inversões que mais causam bug
- QR-015 [P1][F][ABERTA] Filtragem adaptativa por velocidade: como evitar arrasto em movimento rápido sem perder estabilidade em repouso
- QR-016 [P1][J][ABERTA] Spatial anchoring: o que diferencia âncora real de simples reposicionamento por frame
- QR-017 [P1][E][ABERTA] Métricas objetivas de tracking: detection rate, continuity, loss rate, recovery time, jitter — definições e como medir
- QR-018 [P1][N][ABERTA] Orçamento de desempenho para AR web mobile: divisão típica entre inferência, render e composição
- QR-019 [P1][O][ABERTA] Variação entre aparelhos Android: FOV, resolução, rolling shutter, capacidade de ML — o que quebra um motor que só foi testado em um aparelho
- QR-020 [P1][M][ABERTA] Composição de vídeo de câmera com WebGL sem perda de sincronia entre frame e pose
- QR-021 [P1][I][ABERTA] Ordem correta de transformações translação, rotação, escala em anexo de objeto a um alvo em movimento
- QR-022 [P1][N][ABERTA] WebGPU em navegador Android e iOS em 2026: cobertura real e ganho medido versus WebGL para inferência de visão
- QR-023 [P1][B][ABERTA] Alternativas ao MediaPipe para inferência de visão em web mobile: ONNX Runtime Web, TensorFlow.js, WebNN — maturidade e custo
- QR-024 [P1][G][ABERTA] Calibração automática de orientação de modelo 3D: existe método robusto para GLB de origem arbitrária
- QR-025 [P1][P][ABERTA] Sinais de UX que fazem um AR parecer estável mesmo com erro residual: sombra, contato, resposta a movimento

## P2 — expansão corpo e ambiente

- QR-026 [P2][C][ABERTA] Body tracking em web mobile: MediaPipe Pose, BlazePose e concorrentes — precisão e custo
- QR-027 [P2][C][ABERTA] Face e head tracking para óculos: requisitos diferentes de precisão em relação a pulso
- QR-028 [P2][D][ABERTA] Anéis e dedos: por que tracking de dedo é mais difícil que pulso e o que a literatura propõe
- QR-029 [P2][K][ABERTA] Depth estimation monocular em mobile: modelos disponíveis, latência e qualidade suficiente para oclusão
- QR-030 [P2][L][ABERTA] Oclusão em web mobile sem LiDAR: o que é possível hoje de fato, com segmentação de pessoa e mapa de profundidade
- QR-031 [P2][J][ABERTA] SLAM e odometria visual-inercial no navegador: WebXR, o que existe e o que não existe
- QR-032 [P2][J][ABERTA] Colocação de móveis em ambiente via WebXR hit-test: cobertura por plataforma e limitações no iOS
- QR-033 [P2][G][ABERTA] Medição corporal a partir de câmera única: precisão alcançável, para viabilizar o conceito de passaporte espacial
- QR-034 [P2][I][ABERTA] Escala física real em ambiente: como obter metro verdadeiro sem marcador e sem LiDAR
- QR-035 [P2][A][ABERTA] ARKit e ARCore acessíveis via navegador: o que realmente passa para a web e o que exige app nativo
- QR-036 [P2][L][ABERTA] Segmentação de pessoa em tempo real na web: modelos, latência e qualidade de borda
- QR-037 [P2][M][ABERTA] Iluminação estimada e sombra de contato: quanto isso aumenta a percepção de realismo, com evidência
- QR-038 [P2][N][ABERTA] Arquitetura modular de motor AR: como projetar para trocar detector, tracker, filtro e renderizador sem quebrar o resto
- QR-039 [P2][O][ABERTA] Motores comerciais de AR try-on: quais camadas eles resolvem e onde estão os limites públicos deles
- QR-040 [P2][K][ABERTA] Fusão de sensores inerciais do aparelho com tracking visual no navegador: DeviceMotion é utilizável na prática

---

## Perguntas geradas por tópicos já respondidos

Geradas por AR-KB-001:

- QR-041 [P0][F][ABERTA] O @mediapipe/tasks-vision WASM aplica OneEuroFilter internamente antes de exportar worldLandmarks? Se sim, com quais parâmetros?
- QR-042 [P0][F][ABERTA] Com dupla suavização (WASM interno + OneEuroFilter.js), qual é o lag real medido no aparelho de teste vs. sem o filtro JS?
- QR-043 [P1][E][ABERTA] Como integrar o score de confiança do HandLandmarker ao holdLastPose de forma gradual (não binária) sem introduzir drift?

Geradas por AR-KB-003:

- QR-046 [P0][B][ABERTA] O delegate "GPU" em @mediapipe/tasks-vision 0.10.35 realmente usa WebGL no Chrome Android ou ainda cai em XNNPACK silenciosamente? Como detectar sem devtools?
- QR-047 [P0][N][ABERTA] Mover detectForVideo() para Web Worker: custo de postMessage de frame de vídeo (SharedArrayBuffer vs Transferable vs ImageData) — latência e complexidade de implementação?
- QR-048 [P0][N][ABERTA] Web Worker com SharedArrayBuffer exige COOP/COEP headers; Vercel/Shopify permitem esses headers no deploy estático do Ghost?

Geradas por AR-KB-002:

- QR-044 [P0][F][ABERTA] O hold-last-pose e o reset de tracking reiniciam os campos de estado do unwrap em GhostEngine? Se não, re-detecção começará com ângulo acumulado errado e o filtro divergirá.
- QR-045 [P0][F][ABERTA] Com unwrapping ativo e rotação de pulso contínua (>1 volta), o ângulo acumulado crescerá indefinidamente — existe um protocolo de re-normalização periódica sem causar descontinuidade visível?
