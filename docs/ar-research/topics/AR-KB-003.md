ID: AR-KB-003
CAMADA: B / N / O
APLICABILIDADE:
  PULSO — layer direta: HandLandmarker alimenta toda a cadeia de wrist tracking.
    Delegate GPU vs CPU determina se a inferência cabe no budget de frame do pulso.
  CORPO — PoseLandmarker usa a mesma infraestrutura de delegate e WASM; os mesmos
    modos de falha e o mesmo overhead de bloqueio de thread se aplicam. A diferença
    é que PoseLandmarker processa um bounding box maior → inferência ~2–3× mais lenta
    que HandLandmarker → o custo de rodar síncrono no main thread é proporcionalmente
    maior ainda; Web Worker fica ainda mais urgente.
  AMBIENTE — MediaPipe Tasks Vision não é usado para rastreamento de ambiente
    (SLAM/hit-test é WebXR). Esta camada não se aplica a ambiente.
PERGUNTA:
  MediaPipe HandLandmarker em GPU Adreno via WebGL: FPS documentado, uso de
  memória, modos de falha conhecidos.

RESPOSTA EM 3 LINHAS:
  O delegate "GPU" em @mediapipe/tasks-vision usa WebGL + OffScreenCanvas (não WebGPU).
  Nas versões ≤ 0.10.2 o delegate "GPU" resolvia silenciosamente mas rodava XNNPACK
  (CPU) — bug documentado; status em 0.10.35 não confirmado. O gargalo mais crítico
  e documentado é detectForVideo() rodar síncronamente no main thread, bloqueando o
  render a cada frame.

DETALHAMENTO TÉCNICO:
  ### Arquitetura do delegate web
  - @mediapipe/tasks-vision empacota modelos TFLite em WASM.
  - delegate: "GPU" enfileira a inferência via WebGL com OffScreenCanvas
    (confirmado em issue #5826 — pedido de suporte a WebGPU, que ainda não existe).
  - WebGPU não está implementado na tasks-vision até jan/2025 (issue #5826, aberto).

  ### Performance documentada
  - CPU-only WASM: ~10–15 FPS em mobile (fonte: blog técnico; veredito PROVAVEL).
  - GPU WebGL desktop (integrado): ~60 FPS relatado por usuários (veredito HIPOTESE
    para mobile/Adreno — sem benchmark oficial por chip).
  - Pixel 6 nativo Android SDK: ~16,76 ms/frame citado em resultado de busca, mas
    a fonte primária não foi localizada para confirmação (HIPOTESE).
  - Paper original (2020, arXiv 2006.10214): "real-time on mobile GPU" sem números
    específicos no abstract.

  ### Modo de falha 1 — XNNPACK silencioso (issue #4711, v0.10.2, ago/2023)
  - createFromOptions(vision, opts('GPU')) resolvia normalmente.
  - Console mostrava "Created TensorFlow Lite XNNPACK delegate for CPU".
  - Código acreditava rodar GPU; na prática rodava CPU.
  - Status em v0.10.35: NÃO confirmado corrigido nem presente — HIPOTESE.
  - GhostEngine handTracker.js usa 0.10.35; se o bug persistir,
    this.delegate='GPU' seria falso positivo.

  ### Modo de falha 2 — GPU init trava (never resolves)
  - createFromOptions com GPU pode nunca resolver em alguns Android Chrome.
  - COMPROVADO: o próprio handTracker.js (linha 9–10) documenta isso e implementa
    withTimeout(20 000 ms) → fallback automático para CPU. Já mitigado no Ghost.

  ### Modo de falha 3 — main thread bloqueado por detectForVideo()
  - A API é SÍNCRONA: detectForVideo() bloqueia o JS thread até terminar.
  - A documentação oficial recomenda Web Workers para evitar que o render trave.
  - GhostEngine.startLoop() chama detectForVideo() a cada requestAnimationFrame
    (handTracker.js:119) no main thread.
  - Se a inferência demorar 30–60 ms (CPU WASM), o loop de 16,7 ms (60 fps) é
    sempre excedido → FPS efetivo cai para 15–30 fps no melhor caso.
  - Isso é compatível com o resultado de 3–7 FPS observado no aparelho de teste
    (Razr 40) durante os testes do motor novo em jul/2026.

  ### Memória
  - Memory leak no GPU delegate (Python) existia até 0.10.30; corrigido em 0.10.31
    (issue #5652). Risco em web/JS não documentado com a mesma especificidade.
  - Uso combinado HandLandmarker + detector customizado causou "extensive memory
    usage" (issue #5626) — sem número exato.

  ### Falhas adicionais documentadas
  - Browser crash ao combinar com OpenCV.js (issue #5442).
  - close() pode travar o browser em algumas versões (issue #5718).

EVIDÊNCIA:
  - Issue #4711 (ago/2023, v0.10.2): GPU delegate resolve mas console mostra XNNPACK.
  - Issue #5826 (jan/2025): "TaskRunners currently appear to be running WebGL with
    OffScreenCanvas" — confirma implementação atual do delegate GPU.
  - Documentação oficial web_js: "detectForVideo() runs synchronously and blocks the
    user interface thread. Recommend web workers."
  - handTracker.js linha 9–10: comentário direto sobre GPU travando em Android.
  - Issue #5652: memory leak corrigido em 0.10.31.

FONTES:
  - https://github.com/google-ai-edge/mediapipe/issues/4711
  - https://github.com/google-ai-edge/mediapipe/issues/5826
  - https://github.com/google-ai-edge/mediapipe/issues/5652
  - https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker/web_js
  - https://arxiv.org/abs/2006.10214

APLICAÇÃO AO GHOST:
  - src/engine/core/tracking/handTracker.js: o startLoop() já está no main thread
    e chama detectForVideo() de forma síncrona — candidato prioritário para mover
    para Web Worker.
  - Verificar em runtime se this.delegate==='GPU' mas console mostra XNNPACK
    (logar o aviso ao usuário via this.warning) para diagnosticar falha 1.
  - O timeout de 20s já cobre falha 2 — nenhuma mudança necessária aí.

VEREDITO:
  - GPU delegate usa WebGL + OffScreenCanvas: COMPROVADO
  - GPU init trava em Android: COMPROVADO (e já mitigado)
  - XNNPACK silencioso em v0.10.35: HIPOTESE
  - detectForVideo() síncrono bloqueia main thread → FPS cai: COMPROVADO
  - ~10–15 FPS em CPU WASM mobile: PROVAVEL
  - 60+ FPS GPU mobile Adreno: DESCONHECIDO

CUSTO DE ADOÇÃO: MÉDIO (Web Worker exige refactor do loop + transferência de frame)

NOVAS PERGUNTAS GERADAS:
  - QR-046 [P0][B][ABERTA] O delegate "GPU" em tasks-vision 0.10.35 realmente usa
    WebGL no Chrome Android ou ainda cai em XNNPACK? Como detectar sem devtools?
  - QR-047 [P0][N][ABERTA] Mover detectForVideo() para Web Worker: custo de
    postMessage de frame de vídeo (SharedArrayBuffer vs Transferable vs ImageData)?
  - QR-048 [P0][N][ABERTA] Web Worker com SharedArrayBuffer exige COOP/COEP headers;
    Vercel/Shopify permitem esses headers no deploy do Ghost?
