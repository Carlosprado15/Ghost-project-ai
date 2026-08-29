# SOURCES — Log de Fontes Citadas

Toda fonte usada em qualquer `topics/AR-KB-XXX.md` é registrada aqui também,
numa lista única, pra permitir busca rápida por "onde eu já vi isso" antes
de pesquisar de novo, e pra detectar quando uma mesma fonte responde mais de
uma pergunta da fila (sinal de que talvez devesse ser um tópico só).

Formato por linha:

`| AR-KB-XXX | Título curto da fonte | URL completa | rótulo | data de acesso |`

Rótulos possíveis (critério completo em `INDEX.md`, seção "Critério de
fonte"): `[OFICIAL]` (domínio controlado pelo criador/mantenedor da
tecnologia, ou repo oficial do próprio mantenedor — estar no GitHub NÃO
basta), `[PAPER]` (artigo acadêmico revisado ou preprint sério),
`[COMUNIDADE]` (port/wrapper/fork/reimplementação de terceiro — mesmo que
seja bom, nunca é oficial), `[BLOG]` (post técnico sem revisão formal).
Nenhuma alegação COMPROVADO pode se apoiar só em `[COMUNIDADE]`/`[BLOG]`.

---

| ID | Título | URL | Rótulo | Data |
|---|---|---|---|---|
| AR-KB-001 | 1€ Filter: A Simple Speed-based Low-pass Filter (Casiez et al.) | https://gery.casiez.net/publications/CHI2012-casiez.pdf | [PAPER] | 2026-08-27 |
| AR-KB-001 | 1€ Filter — ACM DL (CHI 2012) | https://dl.acm.org/doi/10.1145/2207676.2208639 | [PAPER] | 2026-08-27 |
| AR-KB-001 | MediaPipe OneEuroFilter class — doxygen 0.10.26 | https://fossies.org/dox/mediapipe-0.10.26/classmediapipe_1_1landmarks__smoothing_1_1OneEuroFilter.html | [COMUNIDADE] (mirror de terceiro, não é domínio do mantenedor) | 2026-08-27 |
| AR-KB-001 | LandmarksSmoothingCalculatorOptions — Google AI Edge API | https://developers.google.com/mediapipe/api/solutions/python/mp/calculators/util/landmarks_smoothing_calculator_pb2/LandmarksSmoothingCalculatorOptions | [OFICIAL] | 2026-08-27 |
| AR-KB-001 | Página oficial 1€ Filter (Géry Casiez) | https://gery.casiez.net/1euro/ | [OFICIAL] | 2026-08-27 |
| AR-KB-002 | Unrolling Rotations (Daniel Holden / theorangeduck) | https://theorangeduck.com/page/unrolling-rotations | [BLOG] | 2026-08-27 |
| AR-KB-002 | Lowpass Filter Orientation Using Quaternion SLERP (MathWorks Nav Toolbox) | https://www.mathworks.com/help/nav/ug/lowpass-filter-orientation-using-quaternion-slerp.html | [OFICIAL] | 2026-08-27 |
| AR-KB-002 | OneEuroFilterUnity — quaternion filtering for non-continuous input | https://github.com/DarioMazzanti/OneEuroFilterUnity | [COMUNIDADE] (port de terceiro, não é o autor do 1€ nem da Unity) | 2026-08-27 |
| AR-KB-003 | Issue #4711: GPU delegate resolve mas usa XNNPACK (CPU) silenciosamente | https://github.com/google-ai-edge/mediapipe/issues/4711 | [OFICIAL] (repo do mantenedor, google-ai-edge) | 2026-08-27 |
| AR-KB-003 | Issue #5826: WebGPU support request — confirma WebGL+OffScreenCanvas em tasks-vision | https://github.com/google-ai-edge/mediapipe/issues/5826 | [OFICIAL] | 2026-08-27 |
| AR-KB-003 | Issue #5652: Memory leak no GPU delegate corrigido em 0.10.31 | https://github.com/google-ai-edge/mediapipe/issues/5652 | [OFICIAL] | 2026-08-27 |
| AR-KB-003 | Hand landmarks detection guide for Web JS (Google AI Edge) | https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker/web_js | [OFICIAL] | 2026-08-27 |
| AR-KB-003 | MediaPipe Hands: On-device Real-time Hand Tracking (arXiv 2006.10214) | https://arxiv.org/abs/2006.10214 | [PAPER] | 2026-08-27 |
| AR-KB-005 | MediaPipe Hands: On-device Real-time Hand Tracking (arXiv 2006.10214) | https://arxiv.org/abs/2006.10214 | [PAPER] | 2026-08-28 |
| AR-KB-005 | Multi-Rigid-Body Approximation of Human Hands with Application to Digital Twin (arXiv 2512.07359) | https://arxiv.org/pdf/2512.07359 | [PAPER] | 2026-08-28 |
| AR-KB-005 | The Carpometacarpal Joint of the Thumb: Stability, Deformity, and Therapeutic Intervention (JOSPT 2003) | https://www.jospt.org/doi/pdf/10.2519/jospt.2003.33.7.386 | [PAPER] | 2026-08-28 |
| AR-KB-005 | WatchHand: Enabling Continuous Hand Pose Tracking On Off-the-Shelf Smartwatches (arXiv 2602.21610) | https://arxiv.org/abs/2602.21610 | [PAPER] | 2026-08-28 |
| AR-KB-006 | HandLandmarker class — MediaPipe JS API (factory pattern, detectForVideo timestamp monotônico) | https://developers.google.com/mediapipe/api/solutions/js/tasks-vision.handlandmarker | [OFICIAL] | 2026-08-28 |
| AR-KB-006 | Hand landmarks detection guide for Web (VIDEO_STREAM mode, tracking inter-frame) | https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker/web_js | [OFICIAL] | 2026-08-28 |
| AR-KB-006 | MediaPipe Hands: On-device Real-time Hand Tracking (arXiv 2006.10214) | https://arxiv.org/abs/2006.10214 | [PAPER] | 2026-08-28 |
| AR-KB-006 | Easy Unit Testing with Pure Functions (Jeremy D. Miller, 2024) | https://jeremydmiller.com/2024/01/10/building-a-critter-stack-application-easy-unit-testing-with-pure-functions/ | [BLOG] | 2026-08-28 |
| AR-KB-006 | Pure functions helped simplify unit testing (Medium / Caffeine and Testing) | https://medium.com/caffeine-and-testing/javascript-pure-functions-helped-simplify-unit-testing-for-me-baf8baf08a7f | [BLOG] | 2026-08-28 |
| AR-KB-007 | Casper DPM: Cascaded Perceptual Dynamic Projection Mapping onto Hands (SIGGRAPH Asia 2024) | https://dl.acm.org/doi/full/10.1145/3680528.3687624 | [PAPER] | 2026-08-28 |
| AR-KB-007 | Casper DPM preprint (arxiv 2409.04397) | https://arxiv.org/abs/2409.04397 | [PAPER] | 2026-08-28 |
| AR-KB-007 | Penner et al. 2026 — Perceptual Requirements for Low-Latency Head-Mounted Displays (arxiv 2603.15796) | https://arxiv.org/abs/2603.15796 | [PAPER] | 2026-08-28 |
| AR-KB-007 | Mania et al. 2004 — Perceptual sensitivity to head tracking latency (ACM APGV) | https://dl.acm.org/doi/10.1145/1012551.1012559 | [PAPER] | 2026-08-28 |
| AR-KB-007 | Edge-Centric Augmented Reality Framework for Realtime Wristwatch Try-On (IJIMAI 2022) | https://www.ijimai.org/index.php/ijimai/article/view/2227 | [PAPER] | 2026-08-28 |
| AR-KB-007 | ARZARA: Augmented reality app to try watch on your wrist (2021) | https://www.researchgate.net/publication/356210529_ARZARA_Augmented_reality_app_to_try_watch_on_your_wrist | [PAPER] | 2026-08-28 |
| AR-KB-007 | DAQRI — Motion to Photon Latency in Mobile AR and VR | https://medium.com/@DAQRI/motion-to-photon-latency-in-mobile-ar-and-vr-99f82c480926 | [BLOG] | 2026-08-28 |
| AR-KB-007 | VRARWiki — Motion-to-photon latency | https://vrarwiki.com/wiki/Motion-to-photon_latency | [BLOG] | 2026-08-28 |
| AR-KB-008 | Hand landmarks detection guide (re-detection on tracking loss) | https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker | [OFICIAL] | 2026-08-28 |
| AR-KB-008 | ARCore TrackingState — PAUSED / STOPPED pattern | https://developers.google.com/ar/reference/java/com/google/ar/core/TrackingState | [OFICIAL] | 2026-08-28 |
| AR-KB-008 | ARCore AugmentedImage — pose preservation on PAUSED vs TRACKING | https://developers.google.com/ar/reference/java/com/google/ar/core/AugmentedImage | [OFICIAL] | 2026-08-28 |
| AR-KB-009 | Cheong & Safonov — Bumpless Transfer for Adaptive Switching Controls (IFAC 2008) | https://skoge.folk.ntnu.no/prost/proceedings/ifac2008/data/papers/2555.pdf | [PAPER] | 2026-08-28 |
| AR-KB-009 | Cheong & Safonov — entrada Semantic Scholar (confirmação de autoria e publicação) | https://www.semanticscholar.org/paper/Bumpless-Transfer-for-Adaptive-Switching-Controls-Cheong-Safonov/09b3781dedcfbfb4f87f5d3129a76ec92faa0854 | [PAPER] | 2026-08-28 |
| AR-KB-009 | MATLAB/Simulink — Bumpless Control Transfer (documentação oficial MathWorks) | https://www.mathworks.com/help/simulink/slref/bumpless-control-transfer.html | [OFICIAL] | 2026-08-28 |
| AR-KB-009 | Åström & Hägglund — Advanced PID Control cap.1 (ISA, bumpless transfer por bias) | https://www.isa.org/getmedia/fb0e41bc-e4f3-422a-9f67-b9bd31340e16/Advanced-PID-Control_AstromHagglund_Chapter1-Introduction.pdf | [PAPER] | 2026-08-28 |
