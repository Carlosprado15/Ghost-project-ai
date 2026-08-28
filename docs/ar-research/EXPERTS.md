# Especialistas de referência — Ghost Project

Lista estática de pesquisadores cujo trabalho publicado é diretamente
relevante ao motor AR do Ghost Project. NÃO é fila de pesquisa paga —
não dispara ciclos, não gasta orçamento. É contexto de leitura obrigatória
antes de qualquer investigação de tracking/rotação/ancoragem.

## 1. Stevica Cvetković — Universidade de Niš, Sérvia
CAMADA: G-CALIBRATION, M-RENDERING
APLICABILIDADE: PULSO (direto)
Paper: "Edge-Centric Augmented Reality Framework for Realtime Wristwatch
Try-On" (IJIMAI, 2026). Framework de AR sem marcadores para relógio de
pulso, otimizado para smartphone/navegador — mesmo domínio do Ghost
Project. Usa suavização de parâmetros geométricos por buffer durante
movimento — comparar com a abordagem de filtro do Ghost Engine.
→ Análise técnica aplicada em topics/AR-KB-ROTZ-DISCONTINUITY.md

## 2. Prof. Christian Holz — ETH Zürich (SIPLAB)
CAMADA: E-TRACKING, D-POSE
APLICABILIDADE: PULSO, CORPO (tracking geral aplicável aos dois)
Lab: input decoding e interação em mixed reality, tracking de pulso/mão,
ex-pesquisador principal na Microsoft Research. Publicações do SIPLAB
sobre "hand out of view interaction" e tracking com IMU de pulso são
referência para o problema de descontinuidade de rotação em ±180°.
→ Análise técnica aplicada em topics/AR-KB-ROTZ-DISCONTINUITY.md

## 3. Ting-Yu Chang — ex-Stanford (hoje fora da área de pesquisa)
CAMADA: M-RENDERING
APLICABILIDADE: PULSO
Paper: "GlamTry: Advancing Virtual Try-On for High-End Accessories"
(projeto de curso, CS231n Stanford). Integra MediaPipe Hand Landmarker
com VITON-HD para acessórios. Valor de referência técnica, mas autora
não está mais ativa em pesquisa — não esperar resposta.

## 4. Hrutika Patel, Jap Purohit, Sanket Patel — Ahmedabad University
CAMADA: C-LANDMARK, M-RENDERING
APLICABILIDADE: PULSO (bracelets), mas técnica generaliza
Paper: "Enhancing the Virtual Jewelry Try-On Experience with Computer
Vision" (IEEE APSCON, 2024). Usa MediaPipe hand + posture landmarks para
anéis, brincos e pulseiras via OpenCV/PIL. Stack e problema de landmark
próximos ao do Ghost Project.

## 5. Dr. Woojin Cho — KAIST (UVR Lab)
CAMADA: E-TRACKING, D-POSE
APLICABILIDADE: CORPO, UNIVERSAL
Pesquisa em "Unified Hand and Gesture Tracking via Offloading Framework
for Object-mediated Interaction in Wearable AR" e tracking temporal de
mão via câmera egocêntrica. Contato programado para setembro/2026 —
já registrado em CURRENT_STATE.md.

---
Regra de uso: ao investigar qualquer bug de tracking, rotação ou
ancoragem no motor AR, consultar este arquivo ANTES de propor solução.
Se a literatura de algum desses especialistas tiver abordagem aplicável
ao bug em questão, citar no relatório. Isso é leitura de referência,
não gera nova pesquisa nem novo custo.
