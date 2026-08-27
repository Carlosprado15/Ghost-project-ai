# EXPORT_AUDITORIA — Ghost Project AI — Motor AR — PARTE 1 de 4

> Este arquivo é a **PARTE 1 de 4** de uma exportação para auditoria forense do motor AR,
> compilada para uma IA sem acesso ao repositório. Cole as 4 partes no chat da IA auditora,
> **nesta ordem**: `EXPORT_AUDITORIA_PARTE1.md` → `PARTE2` → `PARTE3` → `PARTE4`.
> A PARTE 4 contém as perguntas que a IA deve responder e a regra absoluta de conduta —
> não pule direto para ela sem colar as partes anteriores, ou faltará o código/evidência
> necessário para responder com evidência real.
>
> Compilado em 2026-08-18, a partir do repositório `Ghost-project-ai`, branch `ghost-engine-v1`.
> Este documento é **só compilação** — nenhuma análise, diagnóstico ou correção foi feita ao
> montá-lo.

---

## 1. CONTEXTO DO PROJETO

Ghost Project AI é um provador de AR (realidade aumentada) para relógios e pulseiras,
embutido em páginas de produto de lojas Shopify/Shopee. O visitante aponta a câmera do
celular para o próprio pulso; o app detecta a mão via MediaPipe, calcula posição/rotação/
escala de um "âncora" no pulso, e renderiza um modelo 3D (`.glb`) do produto ancorado ali,
via `<model-viewer>`.

Existem **duas implementações de motor de tracking em paralelo** no repositório:
- `src/tracking/` — motor legado, **atualmente em produção** na loja real (`App_FINAL.jsx`),
  usa a API antiga `@mediapipe/hands` (vendorizada localmente em `public/mediapipe/hands/`).
- `src/engine/` ("GhostEngine") — reescrita moderna, usa `@mediapipe/tasks-vision`
  (`HandLandmarker`), só consumida hoje pelo laboratório de teste `?lab=tasks-wrist`
  (`TasksWristLab.jsx`). A loja real **não usa** este motor ainda.

**Problema relatado** (hipótese de projeto, ainda não confirmada por teste direto): o motor
moderno teria reprovado em um teste de estabilidade — possível instabilidade de FPS e/ou de
rotação do modelo no pulso. Sintomas relatados incluem: perda de tracking quando parte da
mão sai do enquadramento da câmera, e um relato pontual (não corroborado até agora por
medição) de o relógio 3D "dançar"/aparecer de cabeça para baixo em algum momento de uso.
Três testes físicos reais num aparelho Android (Motorola razr 40) já foram executados
(AR-001, AR-002, AR-003 — detalhados na PARTE 4) para tentar confirmar ou descartar essas
hipóteses; um erro de hardware da câmera (OIS) apareceu de forma consistente nos três testes,
sem, até agora, relação de causa comprovada com o comportamento do motor.

---

## 2. CÓDIGO COMPLETO do motor AR atual (`ghost-engine-v1` — `src/engine/`)

### 2.0 Árvore de arquivos desta seção

```
src/engine/
├── core/
│   ├── GhostEngine.js            — orquestrador principal (sem dependência de React)
│   ├── tracking/handTracker.js   — wrapper do MediaPipe HandLandmarker (tasks-vision)
│   ├── filters/OneEuroFilter.js  — filtro de suavização (posição/rotação/escala)
│   ├── anchor/wristAnchor.js     — cálculo do ponto de ancoragem no pulso (2D→3D)
│   └── pose/holdLastPose.js      — segura a última pose por N ms quando o tracking cai
├── render/modelViewerLoader.js   — injeta/registra o custom element <model-viewer>
├── react/
│   ├── useGhostWristAR.js        — hook React que instancia e conecta o GhostEngine
│   └── GhostWristARView.jsx      — componente React standalone (câmera + overlay + GLB)
└── config/
    ├── defaultPreset.json        — parâmetros padrão do filtro One Euro
    └── legacy-smooth.json        — preset alternativo (emula smoothing de demo anterior)
```

Consumido apenas por `src/labs/tasks-wrist/TasksWristLab.jsx` (código completo na PARTE 2,
por ser o maior arquivo individual desta auditoria — é o harness de teste real usado nas
capturas físicas AR-001/002/003).

---

### 2.1 `src/engine/core/GhostEngine.js`

```javascript
import { HandTracker } from './tracking/handTracker.js';
import { OneEuroFilterScalar, OneEuroFilterVector3 } from './filters/OneEuroFilter.js';
import { computeWristAnchor } from './anchor/wristAnchor.js';
import { HoldLastPose } from './pose/holdLastPose.js';
import defaultPreset from '../config/defaultPreset.json';

// M069I: 1500ms (antes 1200) — com punho fechado a detecção falha por alguns
// frames; o hold estendido mantém o relógio visível nas perdas transitórias
const HOLD_POSE_MS = 1500;

// M069I: estabilização de escala — com punho fechado lm5–lm17 se aproximam e
// o relógio encolheria. Média móvel + clamp + piso mantêm o tamanho estável.
const SCALE_AVG_WINDOW = 5;     // média móvel usada como valor de escala
const SCALE_REF_WINDOW = 10;    // janela de referência para o clamp
const SCALE_DROP_LIMIT = 0.8;   // nunca cair >20% abaixo da média de referência
const SCALE_MIN        = 0.08;  // escala mínima garantida (nunca desaparece)

/**
 * GhostEngine — core AR tracking engine (no React dependency).
 *
 * Usage:
 *   const engine = new GhostEngine({ onPose, onRawFrame?, filterPreset?, debug? });
 *   await engine.init();
 *   engine.startLoop(() => videoEl);
 *   // later:
 *   engine.stop();
 *   engine.updateFilterPreset(newPreset);
 */
export class GhostEngine {
  constructor({ onPose, onRawFrame = null, filterPreset = null, debug = false } = {}) {
    this._onPose        = onPose;
    this._onRawFrame    = onRawFrame;
    this._filterPreset  = filterPreset ?? defaultPreset;
    this._debug         = debug;

    this._tracker   = null;
    this._filters   = null;
    this._hold      = new HoldLastPose(HOLD_POSE_MS);
    this._scaleHist = [];   // últimos SCALE_REF_WINDOW valores de escala

    this._frameCount = 0;
    this._lastFpsTs  = 0;
    this._fps        = 0;

    this.isReady = false;
  }

  // 'GPU' | 'CPU' | null — qual delegate do MediaPipe está ativo
  get delegate() { return this._tracker?.delegate ?? null; }

  // Aviso não-fatal do tracker (ex.: fallback GPU→CPU)
  get warning() { return this._tracker?.warning ?? null; }

  // 'local' | 'CDN' — de onde o hand_landmarker.task foi carregado
  get modelSource() { return this._tracker?.modelSource ?? null; }

  _log(...args) {
    if (this._debug) console.log('[GhostEngine]', ...args);
  }

  // M069I: escala estável com mão fechada.
  // 4) piso 0.08 → 2a) média móvel de 5 frames → 2b) clamp: se a média-5 cair
  // mais de 20% abaixo da média dos últimos 10 frames, usa a média-10.
  _stabilizeScale(rawScale) {
    const s = Math.max(rawScale, SCALE_MIN);
    this._scaleHist.push(s);
    if (this._scaleHist.length > SCALE_REF_WINDOW) this._scaleHist.shift();

    const last5 = this._scaleHist.slice(-SCALE_AVG_WINDOW);
    const avg5  = last5.reduce((a, b) => a + b, 0) / last5.length;
    const avg10 = this._scaleHist.reduce((a, b) => a + b, 0) / this._scaleHist.length;

    return avg5 < avg10 * SCALE_DROP_LIMIT ? avg10 : avg5;
  }

  _initFilters(preset) {
    const p = { ...defaultPreset, ...preset };
    this._filters = {
      pos:  new OneEuroFilterVector3(p),
      rotZ: new OneEuroFilterScalar(p),
      scl:  new OneEuroFilterScalar({ ...p, minCutoff: p.minCutoff * 0.5 }),
    };
    this._log('filters:', p);
  }

  updateFilterPreset(preset) {
    this._filterPreset = preset;
    if (this._filters) this._initFilters(preset);
  }

  async init() {
    this._initFilters(this._filterPreset);
    this._hold.reset();

    this._tracker = new HandTracker({
      onFrame: (lms, ts) => this._onFrame(lms, ts),
      debug: this._debug,
    });

    await this._tracker.init();
    this.isReady = true;
    this._log('engine ready');
  }

  startLoop(getVideoEl) {
    if (!this._tracker) throw new Error('Call init() before startLoop()');
    this._lastFpsTs = performance.now();
    this._tracker.startLoop(getVideoEl);
  }

  _onFrame(landmarks, ts) {
    this._frameCount++;
    if (ts - this._lastFpsTs >= 1000) {
      this._fps        = Math.round((this._frameCount * 1000) / (ts - this._lastFpsTs));
      this._frameCount = 0;
      this._lastFpsTs  = ts;
    }

    if (!landmarks) {
      if (this._onRawFrame) this._onRawFrame({ ts, detected: false });
      const held = this._hold.onLost(ts);
      if (held === null) this._scaleHist = [];  // perda real: recomeça histórico de escala
      this._onPose({
        ts,
        fps:       this._fps,
        detected:  false,
        isTracking: held !== null,
        position:  held?.position  ?? { x: 0, y: 0, z: 0 },
        rotationZ: held?.rotationZ ?? 0,
        scale:     held?.scale     ?? 0,
        raw:       null,
        filtered:  held ? { pos: held.position, rotZ: held.rotationZ, scale: held.scale } : null,
        landmarks: null,
      });
      return;
    }

    const anchor = computeWristAnchor(landmarks);

    if (this._onRawFrame) {
      this._onRawFrame({
        ts,
        detected: true,
        pos:   { x: anchor.x, y: anchor.y, z: anchor.z },
        rotZ:  anchor.rotZ,
        scale: anchor.scale,
      });
    }

    const stableScale = this._stabilizeScale(anchor.scale);

    const f        = this._filters;
    const filtPos  = f.pos.filter({ x: anchor.x, y: anchor.y, z: anchor.z }, ts);
    const filtRotZ = f.rotZ.filter(anchor.rotZ, ts);
    const filtScl  = f.scl.filter(stableScale, ts);

    this._hold.onDetected({ position: filtPos, rotationZ: filtRotZ, scale: filtScl }, ts);

    this._onPose({
      ts,
      fps:       this._fps,
      detected:  true,
      isTracking: true,
      position:  filtPos,
      rotationZ: filtRotZ,
      scale:     filtScl,
      raw:      { pos: { x: anchor.x, y: anchor.y, z: anchor.z }, rotZ: anchor.rotZ, scale: anchor.scale },
      filtered: { pos: filtPos, rotZ: filtRotZ, scale: filtScl },
      landmarks,   // 21 landmarks crus (normalizados 0-1) — overlay de tracking
    });
  }

  stop() {
    this.isReady = false;
    this._tracker?.stop();
    this._tracker = null;
    this._log('engine stopped');
  }
}
```

---

### 2.2 `src/engine/core/tracking/handTracker.js`

```javascript
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

const WASM_CDN  = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm';
// M069G: modelo servido localmente (public/models/) — CDN só como fallback.
// Elimina a dependência de storage.googleapis.com em redes lentas/bloqueadas.
const MODEL_LOCAL = '/models/hand_landmarker.task';
const MODEL_CDN   = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

// createFromOptions com delegate GPU pode TRAVAR (nunca resolver) em alguns
// navegadores Android — timeout transforma o travamento em erro recuperável.
function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} excedeu ${ms / 1000}s`)), ms)),
  ]);
}

export class HandTracker {
  constructor({ onFrame, debug = false }) {
    this._onFrame    = onFrame;
    this._debug      = debug;
    this._landmarker = null;
    this._rafId      = null;
    this._cancelled  = false;
    this.delegate    = null;  // 'GPU' | 'CPU' após init()
    this.warning     = null;  // aviso não-fatal (ex.: fallback para CPU)
    this.modelSource = null;  // 'local' | 'CDN' após init()
  }

  _log(...args) {
    if (this._debug) console.log('[HandTracker]', ...args);
  }

  async init() {
    this._cancelled  = false;
    this.delegate    = null;
    this.warning     = null;
    this.modelSource = null;

    let vision;
    try {
      vision = await withTimeout(FilesetResolver.forVisionTasks(WASM_CDN), 30000, 'WASM MediaPipe');
    } catch (e) {
      throw new Error(`Erro: WASM MediaPipe não carregou (CDN): ${e.message}`);
    }

    // Modelo local primeiro; CDN só se o arquivo local não existir/falhar
    let modelPath = MODEL_CDN;
    try {
      const head = await fetch(MODEL_LOCAL, { method: 'HEAD' });
      if (head.ok) modelPath = MODEL_LOCAL;
    } catch (_) { /* sem servidor para o arquivo local — usa CDN */ }
    this.modelSource = modelPath === MODEL_LOCAL ? 'local' : 'CDN';
    this._log('model source:', this.modelSource);

    let landmarker;
    try {
      landmarker = await this._createLandmarker(vision, modelPath);
    } catch (e) {
      if (modelPath === MODEL_LOCAL) {
        // arquivo local corrompido/incompleto — última tentativa via CDN
        this._log('local model failed, retrying CDN:', e.message);
        this.warning     = this.warning ?? 'Aviso: modelo local falhou, usando CDN';
        this.modelSource = 'CDN';
        this.delegate    = null;
        landmarker = await this._createLandmarker(vision, MODEL_CDN);
      } else {
        throw e;
      }
    }

    if (this._cancelled) { landmarker.close(); return; }
    this._landmarker = landmarker;
  }

  async _createLandmarker(vision, modelAssetPath) {
    const opts = (delegate) => ({
      baseOptions: { modelAssetPath, delegate },
      runningMode: 'VIDEO',
      numHands: 1,
      // M069H: 0.3 (padrão 0.5) — detecta a mão mesmo com punho fechado,
      // postura natural de quem olha o relógio no pulso
      minHandDetectionConfidence: 0.3,
      minHandPresenceConfidence: 0.3,
      minTrackingConfidence: 0.5,
    });

    try {
      const lm = await withTimeout(HandLandmarker.createFromOptions(vision, opts('GPU')), 20000, 'HandLandmarker (GPU)');
      this.delegate = 'GPU';
      this._log('HandLandmarker ready (GPU)');
      return lm;
    } catch (e) {
      this._log('GPU delegate failed, retrying CPU:', e.message);
      this.warning = this.warning ?? 'Aviso: GPU delegate falhou, usando CPU';
      try {
        const lm = await withTimeout(HandLandmarker.createFromOptions(vision, opts('CPU')), 30000, 'HandLandmarker (CPU)');
        this.delegate = 'CPU';
        this._log('HandLandmarker ready (CPU)');
        return lm;
      } catch (e2) {
        throw new Error(`Erro: HandLandmarker falhou em GPU e CPU: ${e2.message}`);
      }
    }
  }

  startLoop(getVideoEl) {
    const loop = () => {
      if (this._cancelled) return;
      const video = getVideoEl();
      const lm    = this._landmarker;

      if (!video || video.readyState < 2 || !lm) {
        this._rafId = requestAnimationFrame(loop);
        return;
      }

      const ts     = performance.now();
      const result = lm.detectForVideo(video, ts);
      const hands  = result?.landmarks;
      this._onFrame(hands?.length > 0 ? hands[0] : null, ts);
      this._rafId = requestAnimationFrame(loop);
    };
    this._rafId = requestAnimationFrame(loop);
  }

  stop() {
    this._cancelled = true;
    if (this._rafId) { cancelAnimationFrame(this._rafId); this._rafId = null; }
    if (this._landmarker) {
      try { this._landmarker.close(); } catch (_) {}
      this._landmarker = null;
    }
  }
}
```

---

### 2.3 `src/engine/core/filters/OneEuroFilter.js`

```javascript
const TWO_PI = 2 * Math.PI;

function computeAlpha(cutoff, dt) {
  const tau = 1.0 / (TWO_PI * cutoff);
  return 1.0 / (1.0 + tau / dt);
}

export class OneEuroFilterScalar {
  constructor({ minCutoff = 1.0, beta = 0.007, dCutoff = 1.0 } = {}) {
    this.minCutoff = minCutoff;
    this.beta      = beta;
    this.dCutoff   = dCutoff;
    this._x        = null;
    this._dx       = 0;
    this._lastTs   = null;
  }

  filter(value, timestampMs) {
    if (this._x === null) {
      this._x      = value;
      this._lastTs = timestampMs;
      return value;
    }
    const dt      = Math.max((timestampMs - this._lastTs) / 1000, 1e-6);
    this._lastTs  = timestampMs;
    const alphaD  = computeAlpha(this.dCutoff, dt);
    const dx      = (value - this._x) / dt;
    this._dx      = alphaD * dx + (1 - alphaD) * this._dx;
    const cutoff  = this.minCutoff + this.beta * Math.abs(this._dx);
    const alpha   = computeAlpha(cutoff, dt);
    this._x       = alpha * value + (1 - alpha) * this._x;
    return this._x;
  }

  reset() {
    this._x      = null;
    this._dx     = 0;
    this._lastTs = null;
  }
}

export class OneEuroFilterVector3 {
  constructor(opts = {}) {
    this.x = new OneEuroFilterScalar(opts);
    this.y = new OneEuroFilterScalar(opts);
    this.z = new OneEuroFilterScalar(opts);
  }

  filter({ x, y, z }, timestampMs) {
    return {
      x: this.x.filter(x, timestampMs),
      y: this.y.filter(y, timestampMs),
      z: this.z.filter(z, timestampMs),
    };
  }

  reset() {
    this.x.reset();
    this.y.reset();
    this.z.reset();
  }
}
```

---

### 2.4 `src/engine/core/anchor/wristAnchor.js`

```javascript
/**
 * computeWristAnchor
 *
 * Takes the 21 MediaPipe hand landmarks (normalized 0-1 coords) and returns
 * the anchor point for an AR wrist accessory.
 *
 * Landmarks used (todos da BASE da mão — visíveis com punho fechado):
 *   lm0  = wrist          (âncora de posição — sempre usado)
 *   lm5  = index MCP      (par primário de rotação/escala)
 *   lm17 = pinky MCP      (par primário e par de fallback)
 *   lm1  = thumb CMC      (par palmar de fallback — M069J)
 *   lm9  = middle MCP     (referência de comprimento da palma — M069J)
 *
 * The anchor is offset from the wrist toward the forearm (away from the palm)
 * by offsetRatio × forearm-vector-length, matching the production WristTracker
 * behaviour (watchOffsetRatio = 0.18).
 *
 * GARANTIA (M069H/M069J): posição, rotação e escala NUNCA dependem das pontas
 * dos dedos (lm8/12/16/20) — apenas de landmarks da base da mão. NÃO adicionar
 * dependência de pontas de dedos aqui.
 *
 * M069J — tracking com a mão rotacionada (lado palmar):
 * o MediaPipe entrega os 21 landmarks em bloco (não há confiança individual),
 * então a degradação do par lm5–lm17 é detectada por GEOMETRIA:
 *   - encurtamento: span lm5–lm17 projetado < 45% do comprimento da palma
 *     (lm0→lm9) indica pronação/rotação do pulso;
 *   - separação em z: |lm5.z − lm17.z| grande indica mão de perfil.
 * Nesses casos rotação/escala passam para o par palmar lm1–lm17, que continua
 * bem projetado quando o pulso vira. A posição segue ancorada no lm0.
 */

// M069I/M069J: offset base de rotação — o eixo dos MCPs é perpendicular à
// pulseira; o GLB precisa de rotação base para marcar "12:00" em pé no pulso.
// Ajuste fino: mude SÓ este número.
// 60 = calibrado para os GLBs ORIGINAIS (M069J) — estado que funcionava.
// NÃO zerar por causa dos normalizados: o ajuste deles será feito em missão
// separada, sem tocar no comportamento dos originais.
const ROTATION_OFFSET_DEG = 60;
// Histórico/alternativas testáveis:
// const ROTATION_OFFSET_DEG = 90;  // M069I — girou ~30° a mais no teste real
// const ROTATION_OFFSET_DEG = 45;  // alternativa
// const ROTATION_OFFSET_DEG = 0;   // estado "limpo" p/ normalizados (quebrou originais)

// M069J: ajustes aplicados SÓ quando o par de fallback lm1–lm17 está ativo
// (o eixo palmar tem inclinação e comprimento diferentes do lm5–lm17):
const FALLBACK_ROT_TRIM_DEG = 0;     // correção angular extra do eixo palmar
const FALLBACK_SCALE_RATIO  = 0.85;  // lm1–lm17 é maior que lm5–lm17 — normaliza

// M069J: limiares de degradação do par primário
const SPAN_RATIO_MIN = 0.45;  // span primário < 45% da palma → encurtado
const Z_SPLAY_MAX    = 0.08;  // |z5 − z17| acima disso → mão rotacionada

export function computeWristAnchor(landmarks, { offsetRatio = 0.18, rotationOffsetDeg = ROTATION_OFFSET_DEG } = {}) {
  const lm0  = landmarks[0];   // wrist
  const lm1  = landmarks[1];   // thumb CMC
  const lm5  = landmarks[5];   // index MCP
  const lm9  = landmarks[9];   // middle MCP
  const lm17 = landmarks[17];  // pinky MCP

  // ── Detecção de degradação do par primário (mão rotacionada) ──────────────
  const spanPrimary = Math.hypot(lm5.x - lm17.x, lm5.y - lm17.y);
  const palmLength  = Math.hypot(lm9.x - lm0.x, lm9.y - lm0.y) || 0.001;
  const zSplay      = Math.abs((lm5.z ?? 0) - (lm17.z ?? 0));
  const degraded    = spanPrimary < palmLength * SPAN_RATIO_MIN || zSplay > Z_SPLAY_MAX;

  // Par efetivo: primário lm5–lm17; palmar lm1–lm17 quando degradado
  const refA = degraded ? lm1 : lm5;
  const refB = lm17;

  // Escala: span do par efetivo (normalizado quando vem do par palmar)
  const scale = Math.hypot(refA.x - refB.x, refA.y - refB.y)
              * (degraded ? FALLBACK_SCALE_RATIO : 1);

  // Rotação: ângulo do eixo efetivo + offset base (+ trim do fallback)
  const rotZ = Math.atan2(refB.y - refA.y, refB.x - refA.x)
             + ((rotationOffsetDeg + (degraded ? FALLBACK_ROT_TRIM_DEG : 0)) * Math.PI / 180);

  // Palm center do par efetivo
  const pcx = (refA.x + refB.x) / 2;
  const pcy = (refA.y + refB.y) / 2;

  // Forearm vector: wrist → palm center (normalized)
  const fvx    = pcx - lm0.x;
  const fvy    = pcy - lm0.y;
  const fvLen  = Math.hypot(fvx, fvy) || 0.001;
  const fdx    = fvx / fvLen;
  const fdy    = fvy / fvLen;

  // Offset toward forearm (opposite direction)
  const offset = fvLen * offsetRatio;
  const x      = lm0.x - fdx * offset;
  const y      = lm0.y - fdy * offset;

  return { x, y, z: lm0.z ?? 0, rotZ, scale, degraded };
}
```

---

### 2.5 `src/engine/core/pose/holdLastPose.js`

```javascript
export class HoldLastPose {
  constructor(holdMs = 500) {
    this.holdMs = holdMs;
    this._last  = null;
    this._ts    = 0;
  }

  onDetected(pose, ts) {
    this._last = pose;
    this._ts   = ts;
    return pose;
  }

  onLost(ts) {
    if (this._last && (ts - this._ts) < this.holdMs) return this._last;
    return null;
  }

  reset() {
    this._last = null;
    this._ts   = 0;
  }
}
```

---

### 2.6 `src/engine/render/modelViewerLoader.js`

```javascript
const MV_SRC   = 'https://ajax.googleapis.com/ajax/libs/model-viewer/3.4.0/model-viewer.min.js';
const DATA_ATTR = 'data-mv';

let _pending = [];
let _polling = false;

function _poll() {
  if (window.customElements?.get('model-viewer')) {
    const cbs = _pending.splice(0);
    cbs.forEach(cb => cb());
    return;
  }
  requestAnimationFrame(_poll);
}

/**
 * Ensures model-viewer custom element is registered.
 * Injects the script once and polls until registration completes.
 * Returns a Promise that resolves when model-viewer is ready.
 * Com timeoutMs > 0, rejeita se o CDN não registrar o elemento a tempo —
 * a falha de rede deixa de ser silenciosa.
 */
export function ensureModelViewer({ timeoutMs = 0 } = {}) {
  return new Promise((resolve, reject) => {
    if (window.customElements?.get('model-viewer')) { resolve(); return; }
    _pending.push(resolve);
    if (timeoutMs > 0) {
      setTimeout(() => {
        if (window.customElements?.get('model-viewer')) return;
        const i = _pending.indexOf(resolve);
        if (i >= 0) _pending.splice(i, 1);
        reject(new Error('Erro: model-viewer CDN não carregou'));
      }, timeoutMs);
    }
    if (!document.querySelector(`script[${DATA_ATTR}]`)) {
      const s = document.createElement('script');
      s.type  = 'module';
      s.setAttribute(DATA_ATTR, '1');
      s.src   = MV_SRC;
      document.head.appendChild(s);
    }
    if (!_polling) {
      _polling = true;
      requestAnimationFrame(_poll);
    }
  });
}
```

---

### 2.7 `src/engine/react/useGhostWristAR.js`

```javascript
import { useState, useEffect, useRef, useCallback } from 'react';
import { GhostEngine } from '../core/GhostEngine.js';
import { ensureModelViewer } from '../render/modelViewerLoader.js';

/**
 * useGhostWristAR — React hook wrapping GhostEngine.
 *
 * Returns the same shape as the former useTasksWristTracking, plus:
 *   mvReady          — boolean: model-viewer custom element registered
 *   updateFilterPreset(preset) — update filter without restarting engine
 */
export function useGhostWristAR({
  videoRef,
  enabled      = true,
  onRawFrame   = null,
  filterPreset = null,
  debug        = false,
} = {}) {
  const engineRef      = useRef(null);
  const onRawFrameRef  = useRef(onRawFrame);

  useEffect(() => { onRawFrameRef.current = onRawFrame; }, [onRawFrame]);

  const [state, setState] = useState({
    isTracking: false,
    position:   { x: 0, y: 0, z: 0 },
    rotationZ:  0,
    scale:      1,
    raw:        null,
    filtered:   null,
    landmarks:  null,   // 21 landmarks crus quando detectado
    fps:        0,
    error:      null,
    ready:      false,
    delegate:   null,   // 'GPU' | 'CPU' após init do HandLandmarker
    warning:    null,   // aviso não-fatal (ex.: fallback GPU→CPU)
    modelSource: null,  // 'local' | 'CDN' — origem do hand_landmarker.task
  });

  const [mvReady, setMvReady] = useState(
    () => !!window.customElements?.get('model-viewer')
  );
  const [mvError, setMvError] = useState(null);

  useEffect(() => {
    ensureModelViewer({ timeoutMs: 15000 })
      .then(() => setMvReady(true))
      .catch((e) => setMvError(e.message));
  }, []);

  const updateFilterPreset = useCallback((preset) => {
    engineRef.current?.updateFilterPreset(preset);
  }, []);

  // "Máquina ligada" (2026-07-05): o engine NÃO espera mais a câmera para
  // inicializar — detector (WASM + HandLandmarker) e câmera carregam em
  // PARALELO, cortando ~1-1.5s de toda abertura. O loop de tracking já
  // aguarda sozinho o vídeo ficar pronto (readyState). Trocar de câmera
  // também não recria mais o engine (menos instabilidade em mobile).
  useEffect(() => {
    let cancelled = false;

    const engine = new GhostEngine({
      onPose: (frame) => {
        if (cancelled) return;
        // merge funcional: preserva delegate/warning definidos no init
        setState(s => ({
          ...s,
          isTracking: frame.isTracking,
          position:   frame.position,
          rotationZ:  frame.rotationZ,
          scale:      frame.scale,
          raw:        frame.raw,
          filtered:   frame.filtered,
          landmarks:  frame.landmarks ?? null,
          fps:        frame.fps,
          error:      null,
          ready:      true,
        }));
      },
      onRawFrame: (raw) => { onRawFrameRef.current?.(raw); },
      filterPreset,
      debug,
    });

    engineRef.current = engine;

    engine.init()
      .then(() => {
        if (cancelled) { engine.stop(); return; }
        setState(s => ({ ...s, ready: true, delegate: engine.delegate, warning: engine.warning, modelSource: engine.modelSource }));
        engine.startLoop(() => videoRef.current);
      })
      .catch((e) => {
        if (!cancelled) setState(s => ({ ...s, error: e.message }));
      });

    return () => {
      cancelled = true;
      engine.stop();
      engineRef.current = null;
      setState(s => ({ ...s, ready: false, isTracking: false }));
    };
  // filterPreset intentionally excluded: use updateFilterPreset() for live updates
  // enabled intencionalmente fora: o engine vive independente da câmera
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoRef, debug]);

  return { ...state, mvReady, mvError, updateFilterPreset };
}
```

---

### 2.8 `src/engine/react/GhostWristARView.jsx`

```jsx
import { useRef, useState, useEffect, useCallback } from 'react';
import { useGhostWristAR } from './useGhostWristAR.js';

const DEFAULT_ORIENTATION  = '0deg 0deg -90deg';
const DEFAULT_SCALE_MULT   = 4.5;

/**
 * GhostWristARView — full standalone AR component.
 *
 * Manages its own camera stream. The host app only needs to provide
 * a glbUrl and optionally styling/behaviour props.
 *
 * Props:
 *   glbUrl          — path or URL to the .glb model (required)
 *   orientation     — model-viewer orientation string (default: "0deg 0deg -90deg")
 *   scaleMultiplier — pixel scale factor relative to wrist span (default: 4.5)
 *   arScale         — per-product additional multiplier (default: 1.0)
 *   filterPreset    — { minCutoff, beta, dCutoff } (default: engine preset)
 *   debug           — show debug HUD (default: false)
 *   forceCenter     — diagnóstico: renderiza o GLB fixo no centro da tela,
 *                     ignorando o tracking (prova se o model-viewer carrega)
 *   style           — extra CSS for the outer container
 *   children        — overlays rendered on top
 */
export function GhostWristARView({
  glbUrl,
  orientation     = DEFAULT_ORIENTATION,
  scaleMultiplier = DEFAULT_SCALE_MULT,
  arScale         = 1.0,
  filterPreset    = null,
  debug           = false,
  forceCenter     = false,
  style,
  children,
}) {
  const videoRef   = useRef(null);
  const streamRef  = useRef(null);
  const [facingMode, setFacingMode] = useState('environment');
  const [camReady,   setCamReady]   = useState(false);
  const [camError,   setCamError]   = useState(null);
  const [glbError,   setGlbError]   = useState(null);

  const { isTracking, position, rotationZ, scale, fps, error: trackError, ready, mvReady, mvError, delegate, warning, updateFilterPreset } = useGhostWristAR({
    videoRef,
    enabled:      camReady,
    filterPreset,
    debug,
  });

  // Captura 404/falha de parse do GLB no model-viewer (evento 'error')
  const attachGlbErrorListener = useCallback((el) => {
    if (!el || el.dataset.errBound) return;
    el.dataset.errBound = '1';
    el.addEventListener('error', () => setGlbError(`Erro: GLB não carregou — ${glbUrl}`));
  }, [glbUrl]);

  useEffect(() => {
    if (filterPreset) updateFilterPreset(filterPreset);
  }, [filterPreset, updateFilterPreset]);

  // cameraStarting: evita chamadas concorrentes de start — causa do erro
  // "The play() request was interrupted by a new load request".
  const camStartingRef = useRef(false);

  const startCamera = useCallback(async (mode) => {
    if (camStartingRef.current) return;   // start em andamento — ignora
    camStartingRef.current = true;
    setCamReady(false);
    setCamError(null);
    try {
      // stop() → await → start(): encerra o stream anterior por completo
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.srcObject = null;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: mode }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCamReady(true);
    } catch (e) {
      setCamError(`Camera: ${e.message}`);
    } finally {
      camStartingRef.current = false;
    }
  }, []);

  useEffect(() => {
    startCamera(facingMode);
    return () => { streamRef.current?.getTracks().forEach(t => t.stop()); };
  }, [facingMode, startCamera]);

  const watchW = Math.round(scale * window.innerWidth * scaleMultiplier * arScale);
  const watchH = Math.round(watchW * 0.5);

  // forceCenter ignora o tracking: posição fixa no centro, tamanho fixo
  const centerW = Math.round(window.innerWidth * 0.7);
  const glbBoxStyle = forceCenter
    ? {
        position: 'absolute', left: '50%', top: '50%',
        transform: 'translate(-50%,-50%)',
        width: centerW, height: Math.round(centerW * 0.5),
        pointerEvents: 'none', zIndex: 2,
        outline: '2px dashed #38bdf8',
      }
    : {
        position:  'absolute',
        left:      `${(position.x * 100).toFixed(1)}%`,
        top:       `${(position.y * 100).toFixed(1)}%`,
        transform: `translate(-50%,-50%) rotate(${(rotationZ * 180 / Math.PI).toFixed(1)}deg)`,
        width:  watchW,
        height: watchH,
        pointerEvents: 'none',
        zIndex: 2,
      };

  const anyError = trackError || camError || mvError || glbError;

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', overflow: 'hidden', ...style }}>
      <video
        ref={videoRef}
        playsInline muted
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 0 }}
      />

      {glbUrl && (forceCenter || (mvReady && isTracking)) && (
        <div style={glbBoxStyle}>
          <model-viewer
            ref={attachGlbErrorListener}
            src={glbUrl}
            disable-tap
            orientation={orientation}
            scale="2 2 2"
            style={{ width: '100%', height: '100%', background: 'transparent' }}
          />
        </div>
      )}

      {/* Erros nunca são silenciosos — banner sempre visível, mesmo sem debug */}
      {anyError && (
        <div style={{
          position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)',
          zIndex: 10, maxWidth: '92%', background: 'rgba(127,29,29,0.92)', color: '#fecaca',
          padding: '8px 14px', borderRadius: 8, fontFamily: 'monospace', fontSize: 12,
          pointerEvents: 'none', wordBreak: 'break-word',
        }}>
          {[trackError, camError, mvError, glbError].filter(Boolean).join(' · ')}
        </div>
      )}

      {children}

      {debug && (
        <div style={{
          position: 'absolute', top: 10, left: 10, zIndex: 10,
          background: 'rgba(0,0,0,0.75)', color: '#e2e8f0',
          padding: '8px 12px', borderRadius: 8,
          fontFamily: 'monospace', fontSize: 11,
        }}>
          <div>{camReady ? '🟢' : camError ? '🔴' : '🟡'} cameraReady</div>
          <div>{ready ? '🟢' : trackError ? '🔴' : '🟡'} handLandmarkerReady{delegate ? ` (${delegate})` : ''}</div>
          <div>{isTracking ? '🟢' : '🔴'} isTracking</div>
          <div>{mvReady ? '🟢' : mvError ? '🔴' : '🟡'} mvReady</div>
          <div>modelUrl: {glbUrl ?? '—'}</div>
          <div>fps: {fps}</div>
          <div>facing: {facingMode}</div>
          {forceCenter && <div style={{ color: '#38bdf8' }}>forceCenter ATIVO (posição fixa)</div>}
          {warning    && <div style={{ color: '#facc15' }}>{warning}</div>}
          {trackError && <div style={{ color: '#f87171' }}>track: {trackError}</div>}
          {mvError    && <div style={{ color: '#f87171' }}>{mvError}</div>}
          {glbError   && <div style={{ color: '#f87171' }}>{glbError}</div>}
          {camError   && <div style={{ color: '#f87171' }}>{camError}</div>}
          <button
            onClick={() => setFacingMode(m => m === 'environment' ? 'user' : 'environment')}
            style={{ marginTop: 6, padding: '3px 8px', fontSize: 10, cursor: 'pointer', borderRadius: 4, border: 'none', background: '#374151', color: '#fff' }}
          >
            flip camera
          </button>
        </div>
      )}
    </div>
  );
}
```

---

### 2.9 `src/engine/config/defaultPreset.json`

```json
{
  "minCutoff": 1.2,
  "beta": 0.3,
  "dCutoff": 1.0
}
```

### 2.10 `src/engine/config/legacy-smooth.json`

```json
{
  "name": "legacy-smooth",
  "description": "Emula smoothing alpha=0.35 da demo 25/05/2026",
  "minCutoff": 1.5,
  "beta": 0.0005,
  "dCutoff": 1.0
}
```

**Nota:** `TasksWristLab.jsx` (o harness que efetivamente consome este motor e foi usado nos
três testes reais AR-001/002/003) inicia com o preset `legacy-smooth.json`, não com
`defaultPreset.json`.

---

*(continua na PARTE 2 — restante da Seção 2: código completo de `TasksWristLab.jsx`)*
# EXPORT_AUDITORIA — Ghost Project AI — Motor AR — PARTE 2 de 4

> Continuação da PARTE 1. Cole depois dela, antes da PARTE 3.
> Esta parte conclui a Seção 2 (código do motor atual `ghost-engine-v1`) com o harness de
> teste que de fato consome o `GhostEngine` e foi usado nas capturas físicas reais
> AR-001/002/003 (detalhadas na PARTE 4).

---

### 2.11 `src/labs/tasks-wrist/TasksWristLab.jsx`

Componente da rota `?lab=tasks-wrist`. É o único consumidor real de `src/engine/` hoje —
gerencia câmera, liga o hook `useGhostWristAR`, desenha o overlay de debug em canvas, expõe
os 3 modos de teste (① GLB fixo no centro / ② overlay de tracking sem GLB / ③ GLB ancorado
no pulso — o modo usado nos testes reais), e implementa o fluxo de auto-calibração
(`?auto=1`) que grava frames e testa combinações de parâmetros do filtro One Euro.

```jsx
import { useEffect, useRef, useState, useCallback } from 'react';
import { useGhostWristAR } from '../../engine/react/useGhostWristAR.js';
import { runCalibration } from './calibrationRunner.js';
import { computeTrackingContinuity } from './calibrationMetrics.js';
import productsData from '../../data/products.json';
// M069F: preset que emula o smoothing alpha=0.35 da demo de 25/05/2026 —
// ponto de partida do modo ③ (o feeling comprovado com investidores).
import legacySmoothPreset from '../../engine/config/legacy-smooth.json';

// ── Product resolution from URL ───────────────────────────────────────────────
// Falls back to CW001 when no ?productId= in URL (lab default)
const _labUrlParams = new URLSearchParams(window.location.search);
const _urlProductId = _labUrlParams.get('productId');
const _ACTIVE_PRODUCT = (() => {
  return productsData.find(p => p.id === _urlProductId) ?? productsData.find(p => p.id === 'CW001');
})();
// ?useNormalized=1 → usa os GLBs de public/models/normalized/ (pipeline
// scripts/normalize-glb/) para comparação A/B sem tocar nos originais.
const USE_NORMALIZED = _labUrlParams.get('useNormalized') === '1';
// ?modelUrl= → sobrescreve o GLB direto (produtos de teste fora do catálogo,
// ex.: TEST-FOXBOX-RAW, que não está em products.json — usado pra comparar
// o motor novo com o mesmo arquivo/material do teste no motor legado).
const _urlModelUrl  = _labUrlParams.get('modelUrl');
const _BASE_GLB_URL  = _urlModelUrl || _ACTIVE_PRODUCT?.modelUrl || '/models/CW001.glb';
const GLB_URL        = (USE_NORMALIZED && !_urlModelUrl)
  ? _BASE_GLB_URL.replace('/models/', '/models/normalized/')
  : _BASE_GLB_URL;
const ACTIVE_PRODUCT_ID = _urlProductId || _ACTIVE_PRODUCT?.id || 'CW001';

const WATCH_W_NORM = 0.22;  // usado apenas quando DEBUG_OVERLAY=true
const STATIC_MS    = 3000;
const SLOW_MS      = 4000;
const REPORT_URL   = 'http://localhost:5174/report';

// ── Ajustes visuais ───────────────────────────────────────────────────────────
// Razão entre largura do relógio e (span lm5–lm17 × largura da tela).
// Faixa útil: 3.0 = discreto · 4.5 = natural · 6.0 = grande
const WRIST_SCALE_MULTIPLIER = 4.5;

// true  → mostra caixa de bounding-box + círculo de pulso no canvas (debug)
// false → experiência limpa, apenas o GLB ancorado no pulso
const DEBUG_OVERLAY = false;

const IS_AUTO = new URLSearchParams(window.location.search).get('auto') === '1';

// ── Helpers ──────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const panelBase = {
  background:     'rgba(0,0,0,0.85)',
  backdropFilter: 'blur(6px)',
  color:          '#e2e8f0',
  borderRadius:   10,
  fontFamily:     'monospace',
  fontSize:       11,
  border:         '1px solid rgba(255,255,255,0.10)',
  padding:        '10px 14px',
};

const mkBtn = (bg, disabled) => ({
  padding: '11px 18px', borderRadius: 8, border: 'none',
  background: disabled ? '#374151' : bg,
  color: '#fff', cursor: disabled ? 'default' : 'pointer',
  fontSize: 13, fontFamily: 'sans-serif', fontWeight: 600,
  opacity: disabled ? 0.45 : 1,
});

// ── Auto overlay messages ─────────────────────────────────────────────────────
const AUTO_MESSAGES = {
  'waiting-hand': { text: 'MOSTRE O PULSO NA CÂMERA', sub: 'aguardando detecção…',  color: '#facc15' },
  'prepare':      { text: 'PREPARE O PULSO',         sub: 'segure o pulso em frente à câmera', color: '#38bdf8' },
  'static':       { text: 'NÃO MOVA',                sub: 'gravando posição estática…', color: '#f87171' },
  'retry-static': { text: 'MÃO NÃO DETECTADA',       sub: 'REPOSICIONE o pulso…',    color: '#fb923c' },
  'transition':   { text: 'AGORA MOVA DEVAGAR',      sub: 'prepare o movimento lento', color: '#a78bfa' },
  'slow':         { text: 'MOVA DEVAGAR',             sub: 'gravando movimento…',      color: '#f97316' },
  'calibrating':  { text: 'CALCULANDO…',              sub: 'testando 49 combinações',  color: '#34d399' },
  'posting':      { text: 'SALVANDO RELATÓRIO…',      sub: '',                         color: '#34d399' },
  'done':         { text: '✓ CONCLUÍDO',              sub: '',                         color: '#4ade80' },
  'failed':       { text: '✗ ERRO',                   sub: '',                         color: '#f87171' },
};

// ─────────────────────────────────────────────────────────────────────────────

export default function TasksWristLab() {
  const videoRef   = useRef(null);
  const canvasRef  = useRef(null);
  const streamRef  = useRef(null);
  const mountedRef = useRef(true);
  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  // Camera
  const [facingMode, setFacingMode] = useState('environment');
  const [camReady,   setCamReady]   = useState(false);
  const [camError,   setCamError]   = useState(null);

  // GLB toggle
  const [glbActive, setGlbActive] = useState(true);

  // M069D: três modos visuais exclusivos (um por vez):
  //  'center'   → ① GLB fixo no centro — prova de render, NÃO testa pulso
  //  'tracking' → ② overlay de tracking no canvas, SEM GLB
  //  'wrist'    → ③ GLB ancorado no pulso — objetivo final
  // Estado inicial: 'center' (mais confiável para primeiro teste).
  // Exceção: no fluxo ?auto=1 inicia em 'wrist', pois a calibração termina
  // pedindo para avaliar o relógio ancorado no pulso.
  const [mode, setMode] = useState(IS_AUTO ? 'wrist' : 'center');
  const forceCenter = mode === 'center';

  // Erro de carga do GLB (404/parse) — nunca silencioso
  const [glbError, setGlbError] = useState(null);

  // HUD compacto por padrão; expande no botão "▼ HUD"
  // Aberto por padrão — o HUD (fps/delegate/tracking) é o objetivo do
  // diagnóstico deste lab, não deve depender de um toque extra na tela.
  const [hudOpen, setHudOpen] = useState(true);
  const attachGlbErrorListener = useCallback((el) => {
    if (!el || el.dataset.errBound) return;
    el.dataset.errBound = '1';
    el.addEventListener('error', () => setGlbError(`Erro: GLB não carregou — ${GLB_URL}`));
  }, []);

  // Manual recording (shared with auto flow via refs)
  const recModeRef   = useRef('idle');
  const recBufferRef = useRef([]);
  const [recState,     setRecState]     = useState('idle');
  const [recCountdown, setRecCountdown] = useState(0);
  const [staticLog,    setStaticLog]    = useState(null);
  const [slowLog,      setSlowLog]      = useState(null);
  const countdownRef = useRef(null);

  // Calibration
  const [calibRunning, setCalibRunning] = useState(false);
  const [calibResults, setCalibResults] = useState(null);
  const [calibError,   setCalibError]   = useState(null);
  const [showReport,   setShowReport]   = useState(false);

  // Filter preset — inicia com legacy-smooth (M069F); calibração pode trocar
  const [activePreset, setActivePreset] = useState({ ...legacySmoothPreset });

  // Auto mode state
  const autoRunningRef  = useRef(false);
  const [autoPhase,     setAutoPhase]     = useState(IS_AUTO ? 'waiting-hand' : null);
  const [autoProgress,  setAutoProgress]  = useState(0);
  const [autoCountdown, setAutoCountdown] = useState(0);
  const [autoBestCombo, setAutoBestCombo] = useState(null);
  const [autoError,     setAutoError]     = useState(null);
  const autoTriggeredRef = useRef(false);

  // ── onRawFrame (stable ref pattern) ────────────────────────────────────────
  const onRawFrame = useCallback((frame) => {
    const mode = recModeRef.current;
    if (mode === 'recording-static' || mode === 'recording-slow') {
      recBufferRef.current.push(frame);
    }
  }, []);

  // ── Engine hook ─────────────────────────────────────────────────────────────
  const tracking = useGhostWristAR({ videoRef, enabled: camReady, onRawFrame, filterPreset: legacySmoothPreset });
  const { isTracking, position, rotationZ, scale, raw, filtered, landmarks, fps, error: trackError, ready, mvReady, mvError, delegate, warning, modelSource, updateFilterPreset } = tracking;

  // M069G: watchdog visível do carregamento do detector de mão.
  // 'ok' → nada · 'slow' (>10s) → aviso amarelo · 'timeout' (>30s) → erro vermelho
  const [lmWaitState, setLmWaitState] = useState('ok');
  useEffect(() => {
    if (ready || trackError || !camReady) { setLmWaitState('ok'); return; }
    const t10 = setTimeout(() => setLmWaitState('slow'), 10000);
    const t30 = setTimeout(() => setLmWaitState('timeout'), 30000);
    return () => { clearTimeout(t10); clearTimeout(t30); };
  }, [camReady, ready, trackError]);

  // ── Camera ──────────────────────────────────────────────────────────────────
  // cameraStarting: bloqueia chamadas concorrentes de start — causa do erro
  // "The play() request was interrupted by a new load request".
  // Sequência obrigatória: stop() do stream anterior → await → start() novo.
  const camStartingRef = useRef(false);
  const [camStarting, setCamStarting] = useState(false);

  const startCamera = useCallback(async (facing) => {
    if (camStartingRef.current) return;   // start em andamento — ignora
    camStartingRef.current = true;
    setCamStarting(true);
    setCamReady(false);
    setCamError(null);
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.srcObject = null;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCamReady(true);
    } catch (e) {
      setCamError(`Câmera: ${e.message}`);
    } finally {
      camStartingRef.current = false;
      setCamStarting(false);
    }
  }, []);

  useEffect(() => {
    startCamera(facingMode);
    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    };
  }, [facingMode, startCamera]);

  // ── Manual recording ────────────────────────────────────────────────────────
  function startRecording(mode, durationMs) {
    if (recModeRef.current !== 'idle') return;
    recBufferRef.current = [];
    recModeRef.current   = mode;
    setRecState(mode);
    setRecCountdown(Math.ceil(durationMs / 1000));

    let remaining = durationMs;
    countdownRef.current = setInterval(() => {
      remaining -= 500;
      setRecCountdown(Math.max(0, Math.ceil(remaining / 1000)));
      if (remaining <= 0) {
        clearInterval(countdownRef.current);
        const frames         = [...recBufferRef.current];
        recBufferRef.current = [];
        recModeRef.current   = 'idle';
        setRecState('idle');
        if (mode === 'recording-static') setStaticLog(frames);
        if (mode === 'recording-slow')   setSlowLog(frames);
      }
    }, 500);
  }

  useEffect(() => () => { if (countdownRef.current) clearInterval(countdownRef.current); }, []);

  // ── Promise-based recording for auto flow ───────────────────────────────────
  function recordWithProgress(mode, durationMs) {
    return new Promise((resolve) => {
      recBufferRef.current = [];
      recModeRef.current   = mode;
      setRecState(mode);
      setAutoProgress(0);

      const start = performance.now();
      const timer = setInterval(() => {
        const elapsed = performance.now() - start;
        setAutoProgress(Math.min(100, Math.round((elapsed / durationMs) * 100)));
        if (elapsed >= durationMs) {
          clearInterval(timer);
          const frames         = [...recBufferRef.current];
          recBufferRef.current = [];
          recModeRef.current   = 'idle';
          setRecState('idle');
          setAutoProgress(100);
          resolve(frames);
        }
      }, 100);
    });
  }

  // ── Auto sequence ───────────────────────────────────────────────────────────
  const applyPreset = useCallback((combo) => {
    updateFilterPreset({ minCutoff: combo.minCutoff, beta: combo.beta, dCutoff: combo.dCutoff });
    setActivePreset(combo);
  }, [updateFilterPreset]);

  async function runAutoSequence() {
    if (autoRunningRef.current) return;
    autoRunningRef.current = true;

    const safe = (fn) => { if (mountedRef.current) fn(); };

    try {
      // ── Prepare + 3-2-1 countdown ──
      safe(() => setAutoPhase('prepare'));
      for (let i = 3; i > 0; i--) {
        safe(() => setAutoCountdown(i));
        await sleep(1000);
      }
      safe(() => setAutoCountdown(0));

      // ── Static recording (up to 3 attempts) ──
      let staticFrames = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        if (attempt > 0) {
          safe(() => setAutoPhase('retry-static'));
          await sleep(2500);
        }

        safe(() => setAutoPhase('static'));
        const frames = await recordWithProgress('recording-static', STATIC_MS);
        const cont   = computeTrackingContinuity(frames);

        if (cont >= 0.80) {
          staticFrames = frames;
          break;
        }

        if (attempt === 2) {
          safe(() => {
            setAutoPhase('failed');
            setAutoError('Mão não detectada após 3 tentativas. Ajuste a iluminação, o ângulo do pulso ou tente em ambiente mais claro.');
          });
          return;
        }
      }

      // ── Transition ──
      safe(() => setAutoPhase('transition'));
      for (let i = 2; i > 0; i--) {
        safe(() => setAutoCountdown(i));
        await sleep(1000);
      }
      safe(() => setAutoCountdown(0));

      // ── Slow-motion recording ──
      safe(() => setAutoPhase('slow'));
      const slowFrames = await recordWithProgress('recording-slow', SLOW_MS);

      safe(() => {
        setStaticLog(staticFrames);
        setSlowLog(slowFrames);
      });

      // ── Calibration ──
      safe(() => { setAutoPhase('calibrating'); setCalibRunning(true); });
      await sleep(30); // yield one frame so React can re-render
      const results = runCalibration(staticFrames, slowFrames);
      safe(() => { setCalibResults(results); setCalibRunning(false); });

      // ── Apply best preset ──
      applyPreset(results.best);

      // ── POST report ──
      safe(() => setAutoPhase('posting'));
      try {
        await fetch(REPORT_URL, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ markdown: results.reportMd }),
        });
      } catch (e) {
        // Non-fatal — report server may not be running
        console.warn('[auto] POST relatório falhou:', e.message);
      }

      safe(() => {
        setAutoBestCombo(results.best);
        setAutoPhase('done');
      });

    } catch (e) {
      safe(() => {
        setAutoPhase('failed');
        setAutoError(e.message);
        setCalibRunning(false);
      });
    } finally {
      autoRunningRef.current = false;
    }
  }

  // Trigger auto sequence on first hand detection
  useEffect(() => {
    if (!IS_AUTO || !tracking.isTracking) return;
    if (autoPhase !== 'waiting-hand' || autoTriggeredRef.current) return;
    autoTriggeredRef.current = true;
    runAutoSequence();
  }, [tracking.isTracking, autoPhase]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Manual calibration ──────────────────────────────────────────────────────
  async function handleCalibrate() {
    if (!staticLog || !slowLog) return;
    setCalibRunning(true);
    setCalibError(null);
    setCalibResults(null);
    try {
      await sleep(0);
      const results = runCalibration(staticLog, slowLog);
      setCalibResults(results);
    } catch (e) {
      setCalibError(e.message);
    } finally {
      setCalibRunning(false);
    }
  }

  function downloadReport() {
    if (!calibResults?.reportMd) return;
    const blob = new Blob([calibResults.reportMd], { type: 'text/markdown' });
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = 'M069B_FILTER_CALIBRATION_REPORT.md';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // ── Canvas overlay ───────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    const video  = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext('2d');
    canvas.width  = video.videoWidth  || 640;
    canvas.height = video.videoHeight || 480;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const isActive = tracking.isTracking && tracking.filtered;
    if (!isActive) return;

    const W = canvas.width, H = canvas.height;
    const { pos, rotZ, scale: sc } = tracking.filtered;
    const wx = pos.x * W, wy = pos.y * H;

    // ── MODO 2: overlay de tracking (SEM GLB) — prova de detecção do pulso ────
    if (mode === 'tracking' && tracking.landmarks) {
      const lms = tracking.landmarks;
      const l0  = { x: lms[0].x  * W, y: lms[0].y  * H };
      const l5  = { x: lms[5].x  * W, y: lms[5].y  * H };
      const l17 = { x: lms[17].x * W, y: lms[17].y * H };

      // b) linha azul lm5 → lm17 (base dos dedos)
      ctx.save();
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth   = 4;
      ctx.beginPath();
      ctx.moveTo(l5.x, l5.y);
      ctx.lineTo(l17.x, l17.y);
      ctx.stroke();

      // c) pontos verdes em lm5 e lm17
      ctx.fillStyle = '#22c55e';
      [l5, l17].forEach(pt => {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 8, 0, Math.PI * 2);
        ctx.fill();
      });

      // a) ponto vermelho no lm0 (pulso)
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(l0.x, l0.y, 10, 0, Math.PI * 2);
      ctx.fill();

      // d) métricas do tracking
      ctx.font         = 'bold 16px monospace';
      ctx.textAlign    = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle    = 'rgba(0,0,0,0.55)';
      ctx.fillRect(8, H - 66, 320, 58);
      ctx.fillStyle = '#fff';
      ctx.fillText(`rotZ ${(rotZ * 180 / Math.PI).toFixed(1)}°  scale ${sc.toFixed(4)}`, 14, H - 44);
      ctx.fillText(`pos filt ${pos.x.toFixed(3)}, ${pos.y.toFixed(3)}`, 14, H - 20);
      ctx.restore();
    }

    // ── Debug overlay (desligado por padrão — ver DEBUG_OVERLAY no topo) ──────
    if (DEBUG_OVERLAY) {
      const watchPx = sc * W * WATCH_W_NORM * 5;

      // Wrist circle
      ctx.save();
      ctx.beginPath();
      ctx.arc(wx, wy, 10, 0, Math.PI * 2);
      ctx.strokeStyle = '#4ade80';
      ctx.lineWidth   = 3;
      ctx.stroke();
      ctx.fillStyle = 'rgba(74,222,128,0.25)';
      ctx.fill();
      ctx.restore();

      // Watch bounding-box
      const rw = watchPx, rh = rw * 0.45;
      ctx.save();
      ctx.translate(wx, wy);
      ctx.rotate(rotZ);
      const hasPreset = !!activePreset;
      ctx.strokeStyle = hasPreset ? '#34d399' : '#facc15';
      ctx.lineWidth   = 3;
      ctx.fillStyle   = hasPreset ? 'rgba(52,211,153,0.12)' : 'rgba(250,204,21,0.12)';
      ctx.beginPath();
      ctx.roundRect(-rw / 2, -rh / 2, rw, rh, 6);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle    = hasPreset ? '#34d399' : '#facc15';
      ctx.font         = `bold ${Math.max(10, rh * 0.3)}px monospace`;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(hasPreset ? `mc=${activePreset.minCutoff} β=${activePreset.beta}` : ACTIVE_PRODUCT_ID, 0, 0);
      ctx.restore();
    }

    // ── Recording ring — sempre visível (UX de gravação, não é debug) ─────────
    if (recModeRef.current !== 'idle') {
      ctx.save();
      ctx.beginPath();
      ctx.arc(wx, wy, 22, 0, Math.PI * 2);
      ctx.strokeStyle = recModeRef.current === 'recording-static' ? '#f87171' : '#fb923c';
      ctx.lineWidth   = 3;
      ctx.setLineDash([6, 4]);
      ctx.stroke();
      ctx.restore();
    }
  }, [tracking, activePreset, recState, mode]);

  // ── Derived ──────────────────────────────────────────────────────────────────
  const camLabel  = facingMode === 'environment' ? 'Traseira' : 'Frontal';
  const nextMode  = facingMode === 'environment' ? 'user' : 'environment';
  const isRecording   = recState !== 'idle';
  const canCalibrate  = !!staticLog && !!slowLog && !calibRunning && !isRecording;

  // Tamanho do GLB em pixels — proporcional ao pulso detectado e à tela atual.
  // Ajustar WRIST_SCALE_MULTIPLIER no topo do arquivo.
  // arScale por produto (campo opcional em products.json, default 1.0).
  const watchW = Math.round(scale * window.innerWidth * WRIST_SCALE_MULTIPLIER * (_ACTIVE_PRODUCT?.arScale ?? 1.0));
  const watchH = Math.round(watchW * 0.5); // proporção ~2:1 (face do relógio)

  const jitter = (() => {
    if (!raw?.pos || !filtered?.pos) return '—';
    const dx = (raw.pos.x - filtered.pos.x) * 1000;
    const dy = (raw.pos.y - filtered.pos.y) * 1000;
    return `${Math.sqrt(dx * dx + dy * dy).toFixed(1)} u`;
  })();

  // ── Auto overlay (fullscreen, high contrast, big font) ──────────────────────
  const renderAutoOverlay = () => {
    if (!IS_AUTO || !autoPhase) return null;

    const msg = AUTO_MESSAGES[autoPhase] ?? { text: autoPhase, sub: '', color: '#fff' };
    const isDone   = autoPhase === 'done';
    const isFailed = autoPhase === 'failed';
    const showProgress = autoPhase === 'static' || autoPhase === 'slow';
    const showCountdown = (autoPhase === 'prepare' || autoPhase === 'transition') && autoCountdown > 0;

    // M069C: overlay NÃO bloqueia mais a visão do GLB.
    // Container transparente + pointer-events none; o fundo escurecido existe
    // apenas na faixa de texto, ancorada no TOPO (o GLB renderiza no centro/pulso).
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 5,
        background: 'transparent',
        pointerEvents: 'none',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'flex-start',
        padding: '56px 16px 0', textAlign: 'center',
      }}>
        {/* Faixa de instrução — único elemento com fundo escuro */}
        <div style={{
          background: isDone ? 'rgba(0,40,0,0.6)' : isFailed ? 'rgba(60,0,0,0.6)' : 'rgba(0,0,0,0.6)',
          borderRadius: 14, padding: '14px 22px', maxWidth: '92%',
          pointerEvents: 'none',
        }}>
          {/* Main message */}
          <div style={{ color: msg.color, fontSize: '2rem', fontWeight: 900, lineHeight: 1.1, letterSpacing: 1, fontFamily: 'sans-serif' }}>
            {msg.text}
          </div>

          {/* Sub message */}
          {msg.sub && (
            <div style={{ color: '#e2e8f0', fontSize: '1rem', fontWeight: 600, marginTop: 8, fontFamily: 'sans-serif' }}>
              {msg.sub}
            </div>
          )}

          {/* Countdown */}
          {showCountdown && (
            <div style={{ color: '#fff', fontSize: '3rem', fontWeight: 900, marginTop: 8, fontFamily: 'sans-serif', lineHeight: 1 }}>
              {autoCountdown}
            </div>
          )}

          {/* Progress bar */}
          {showProgress && (
            <div style={{ width: 260, maxWidth: '100%', margin: '12px auto 0' }}>
              <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 8, height: 12, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 8,
                  background: autoPhase === 'static' ? '#f87171' : '#fb923c',
                  width: `${autoProgress}%`,
                  transition: 'width 0.1s linear',
                }} />
              </div>
              <div style={{ color: '#e2e8f0', fontSize: '0.85rem', marginTop: 4, fontFamily: 'monospace' }}>
                {autoProgress}%
              </div>
            </div>
          )}
        </div>

        {/* Done screen — botões precisam de pointer-events */}
        {isDone && autoBestCombo && (
          <div style={{
            marginTop: 14, fontFamily: 'monospace', fontSize: '0.95rem', color: '#e2e8f0', lineHeight: 1.7,
            background: 'rgba(0,40,0,0.6)', borderRadius: 14, padding: '12px 22px', maxWidth: '92%',
            pointerEvents: 'auto',
          }}>
            <div style={{ color: '#4ade80', fontSize: '1.1rem', fontWeight: 700 }}>Melhor combo aplicado:</div>
            <div>minCutoff = <span style={{ color: '#facc15' }}>{autoBestCombo.minCutoff}</span> · beta = <span style={{ color: '#facc15' }}>{autoBestCombo.beta}</span> · score = <span style={{ color: '#facc15' }}>{autoBestCombo.score.toFixed(3)}</span></div>
            <div style={{ color: '#cbd5e1', fontSize: '0.85rem', marginTop: 8 }}>
              {mvReady ? 'Mova o pulso e avalie o relógio.' : 'Carregando model-viewer…'}
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={() => setGlbActive(v => !v)}
                style={{ ...mkBtn(glbActive ? '#16a34a' : '#7c3aed', false), fontSize: 14, padding: '10px 20px' }}
              >
                {glbActive ? '✓ GLB Ativo' : `Ativar GLB ${ACTIVE_PRODUCT_ID}`}
              </button>
              <button
                onClick={() => setAutoPhase(null)}
                style={{ ...mkBtn('#374151', false), fontSize: 14, padding: '10px 20px' }}
              >
                Ver HUD completo
              </button>
            </div>
          </div>
        )}

        {/* Failed screen — botão precisa de pointer-events */}
        {isFailed && (
          <div style={{
            marginTop: 14, color: '#fca5a5', fontSize: '0.95rem', fontFamily: 'sans-serif', maxWidth: 340, lineHeight: 1.6,
            background: 'rgba(60,0,0,0.6)', borderRadius: 14, padding: '12px 22px',
            pointerEvents: 'auto',
          }}>
            {autoError}
            <br /><br />
            <button
              onClick={() => {
                autoTriggeredRef.current = false;
                autoRunningRef.current   = false;
                setAutoPhase('waiting-hand');
                setAutoError(null);
              }}
              style={{ ...mkBtn('#dc2626', false), fontSize: 15, padding: '12px 24px' }}
            >
              Tentar novamente
            </button>
          </div>
        )}
      </div>
    );
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', overflow: 'hidden' }}>

      {/* Camera — camada 0 (atrás do GLB) */}
      <video
        ref={videoRef}
        playsInline
        muted
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 0 }}
      />

      {/* Canvas overlay — camada 1 (tracking overlay do modo ② + anel de gravação) */}
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1 }}
      />

      {/* MODO ③ — GLB ancorado no pulso (objetivo final) — camada 2 */}
      {mode === 'wrist' && glbActive && mvReady && isTracking && (
        <div style={{
          position:  'absolute',
          left:      `${(position.x * 100).toFixed(1)}%`,
          top:       `${(position.y * 100).toFixed(1)}%`,
          transform: `translate(-50%,-50%) rotate(${(rotationZ * 180 / Math.PI).toFixed(1)}deg)`,
          width:     watchW,
          height:    watchH,
          pointerEvents: 'none',
          zIndex: 2,
        }}>
          <model-viewer
            ref={attachGlbErrorListener}
            src={GLB_URL}
            disable-tap
            orientation={USE_NORMALIZED ? undefined : '0deg 0deg -90deg'}
            scale="2 2 2"
            style={{ width: '100%', height: '100%', background: 'transparent' }}
          />
        </div>
      )}

      {/* MODO ③ sem pulso detectado: aviso discreto, câmera continua visível */}
      {mode === 'wrist' && !isTracking && !autoPhase && (
        <div style={{
          position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)',
          zIndex: 10, background: 'rgba(0,0,0,0.55)', color: '#facc15',
          padding: '8px 16px', borderRadius: 20, fontFamily: 'monospace', fontSize: 14,
          pointerEvents: 'none',
        }}>
          Mostre o pulso na câmera
        </div>
      )}

      {/* MODO ① — GLB FORÇADO NO CENTRO — prova de render, camada 2.
          Ignora tracking/glbActive. Não é a experiência final. */}
      {forceCenter && (
        <>
          <div style={{
            position: 'absolute', top: 52, left: '50%', transform: 'translateX(-50%)',
            zIndex: 10, background: 'rgba(2,132,199,0.85)', color: '#fff',
            padding: '5px 14px', borderRadius: 16, fontFamily: 'monospace', fontSize: 11,
            whiteSpace: 'nowrap', pointerEvents: 'none',
          }}>
            MODO GLB CENTRAL — prova de render, NÃO testa pulso
          </div>
          <div style={{
            position: 'absolute', left: '50%', top: '50%',
            transform: 'translate(-50%,-50%)',
            width: Math.round(window.innerWidth * 0.7),
            height: Math.round(window.innerWidth * 0.35),
            pointerEvents: 'none', zIndex: 2,
            outline: '2px dashed #38bdf8',
          }}>
            <model-viewer
              ref={attachGlbErrorListener}
              src={GLB_URL}
              disable-tap
              orientation={USE_NORMALIZED ? undefined : '0deg 0deg -90deg'}
              scale="2 2 2"
              style={{ width: '100%', height: '100%', background: 'transparent' }}
            />
          </div>
        </>
      )}

      {/* M069G: watchdog do detector de mão — aviso aos 10s, erro aos 30s */}
      {!ready && !trackError && lmWaitState !== 'ok' && (
        <div style={{
          position: 'absolute', top: 122, left: '50%', transform: 'translateX(-50%)',
          zIndex: 10, maxWidth: '92%', textAlign: 'center',
          background: lmWaitState === 'timeout' ? 'rgba(127,29,29,0.92)' : 'rgba(113,63,18,0.92)',
          color: lmWaitState === 'timeout' ? '#fecaca' : '#fde68a',
          padding: '8px 14px', borderRadius: 8, fontFamily: 'monospace', fontSize: 12,
          pointerEvents: 'none', wordBreak: 'break-word',
        }}>
          {lmWaitState === 'timeout'
            ? 'Erro: detector não carregou. Verifique sua conexão.'
            : 'Carregando detector de mão… (pode levar até 30s na primeira vez)'}
        </div>
      )}

      {/* Erros nunca são silenciosos — banner vermelho sempre visível (topo,
          para não colidir com botões de modo/controles na parte inferior) */}
      {(trackError || camError || mvError || glbError) && (
        <div style={{
          position: 'absolute', top: 88, left: '50%', transform: 'translateX(-50%)',
          zIndex: 10, maxWidth: '92%', background: 'rgba(127,29,29,0.92)', color: '#fecaca',
          padding: '8px 14px', borderRadius: 8, fontFamily: 'monospace', fontSize: 12,
          pointerEvents: 'none', wordBreak: 'break-word', textAlign: 'center',
        }}>
          {[trackError, camError, mvError, glbError].filter(Boolean).join(' · ')}
        </div>
      )}

      {/* Auto overlay (renders above everything when active) */}
      {renderAutoOverlay()}

      {/* Report modal */}
      {showReport && calibResults?.reportMd && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 30, background: 'rgba(0,0,0,0.92)', overflowY: 'auto', padding: 24 }}>
          <button onClick={() => setShowReport(false)} style={{ ...mkBtn('#374151', false), marginBottom: 16 }}>✕ Fechar</button>
          <pre style={{ color: '#e2e8f0', fontFamily: 'monospace', fontSize: 11, whiteSpace: 'pre-wrap' }}>{calibResults.reportMd}</pre>
        </div>
      )}

      {/* ── HUD compacto/colapsável — topo esquerdo, nunca cobre o centro ──
          Colapsado: uma linha, pointer-events none exceto no botão ▼ HUD. */}
      <div style={{ position: 'absolute', top: 14, left: 14, zIndex: 10, pointerEvents: 'none', maxWidth: 262 }}>
        <div style={{ ...panelBase, padding: '5px 8px', display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
          <span>
            👁 cam{camReady ? '✅' : camError ? '🔴' : '🟡'}
            {' '}lm{ready ? '✅' : trackError ? '🔴' : '🟡'}
            {' '}trk{isTracking ? '✅' : '🔴'}
            {' '}mv{mvReady ? '✅' : mvError ? '🔴' : '🟡'}
            {' '}glb{glbError ? '🔴' : glbActive ? '✅' : '🔴'}
          </span>
          <button
            onClick={() => setHudOpen(v => !v)}
            style={{
              pointerEvents: 'auto', cursor: 'pointer',
              background: '#374151', color: '#e2e8f0', border: 'none',
              borderRadius: 6, padding: '3px 8px', fontSize: 11, fontFamily: 'monospace',
            }}
          >
            {hudOpen ? '▲ HUD' : '▼ HUD'}
          </button>
        </div>

        {hudOpen && (
          <div style={{ ...panelBase, marginTop: 6 }}>
            <div style={{ color: '#a78bfa', fontWeight: 700, fontSize: 12, marginBottom: 5 }}>
              Ghost Engine Lab — {ACTIVE_PRODUCT_ID}
              {' · '}{mode === 'center' ? 'modo ① central' : mode === 'tracking' ? 'modo ② tracking' : 'modo ③ pulso'}
            </div>

            {/* Diagnóstico específico do modo ativo */}
            {mode === 'center' && (
              <>
                <div><span style={{ color: '#94a3b8' }}>forceCenter: </span><span style={{ color: '#38bdf8' }}>true</span></div>
                <div style={{ wordBreak: 'break-all' }}>
                  <span style={{ color: '#94a3b8' }}>modelUrl: </span>
                  <span style={{ color: glbError ? '#f87171' : '#93c5fd' }}>{GLB_URL}</span>
                </div>
              </>
            )}
            {mode === 'tracking' && (
              <>
                <div><span style={{ color: '#94a3b8' }}>isTracking: </span>{String(isTracking)}</div>
                <div><span style={{ color: '#94a3b8' }}>lm0: </span>{landmarks ? `${landmarks[0].x.toFixed(3)}, ${landmarks[0].y.toFixed(3)}` : '—'}</div>
                <div><span style={{ color: '#94a3b8' }}>lm5: </span>{landmarks ? `${landmarks[5].x.toFixed(3)}, ${landmarks[5].y.toFixed(3)}` : '—'}</div>
                <div><span style={{ color: '#94a3b8' }}>lm17: </span>{landmarks ? `${landmarks[17].x.toFixed(3)}, ${landmarks[17].y.toFixed(3)}` : '—'}</div>
                <div><span style={{ color: '#94a3b8' }}>rotZ: </span>{filtered?.rotZ != null ? (filtered.rotZ * 180 / Math.PI).toFixed(1) + '°' : '—'}</div>
                <div><span style={{ color: '#94a3b8' }}>scale: </span>{filtered?.scale?.toFixed(4) ?? '—'}</div>
                <div><span style={{ color: '#94a3b8' }}>fps: </span>{fps}</div>
              </>
            )}
            {mode === 'wrist' && (
              <>
                <div><span style={{ color: '#94a3b8' }}>forceCenter: </span>false</div>
                <div><span style={{ color: '#94a3b8' }}>isTracking: </span>{String(isTracking)}</div>
                <div><span style={{ color: '#94a3b8' }}>position: </span>{filtered?.pos ? `${filtered.pos.x.toFixed(3)}, ${filtered.pos.y.toFixed(3)}` : '—'}</div>
                <div><span style={{ color: '#94a3b8' }}>rotZ: </span>{filtered?.rotZ != null ? (filtered.rotZ * 180 / Math.PI).toFixed(1) + '°' : '—'}</div>
                <div><span style={{ color: '#94a3b8' }}>scale: </span>{filtered?.scale?.toFixed(4) ?? '—'}</div>
                <div><span style={{ color: '#94a3b8' }}>mvReady: </span>{String(mvReady)} <span style={{ color: '#94a3b8' }}>| glbActive: </span>{String(glbActive)}</div>
                <div>
                  <span style={{ color: '#94a3b8' }}>preset: </span>
                  <span style={{ color: '#34d399' }}>
                    {activePreset?.name ?? `calibrado mc=${activePreset?.minCutoff} β=${activePreset?.beta}`}
                  </span>
                </div>
              </>
            )}

            {/* Comum a todos os modos */}
            <div style={{ marginTop: 5, borderTop: '1px solid rgba(255,255,255,0.10)', paddingTop: 5 }}>
              <div><span style={{ color: '#94a3b8' }}>fps: </span><span style={{ color: '#38bdf8', fontWeight: 700 }}>{fps}</span> · <span style={{ color: '#94a3b8' }}>delegate: </span><span style={{ color: '#38bdf8', fontWeight: 700 }}>{delegate ?? '—'}</span> · <span style={{ color: '#94a3b8' }}>isTracking: </span>{String(isTracking)}</div>
              <div><span style={{ color: '#94a3b8' }}>detector: </span>{modelSource ?? '—'} · <span style={{ color: '#94a3b8' }}>câmera: </span>{camLabel}</div>
              <div><span style={{ color: '#94a3b8' }}>jitter: </span>{jitter} · <span style={{ color: '#94a3b8' }}>preset: </span><span style={{ color: '#34d399' }}>{activePreset?.name ?? `mc=${activePreset?.minCutoff} β=${activePreset?.beta}`}</span></div>
            </div>

            {warning    && <div style={{ color: '#facc15', wordBreak: 'break-word' }}>{warning}</div>}
            {trackError && <div style={{ color: '#f87171', wordBreak: 'break-word' }}>{trackError}</div>}
            {mvError    && <div style={{ color: '#f87171', wordBreak: 'break-word' }}>{mvError}</div>}
            {glbError   && <div style={{ color: '#f87171', wordBreak: 'break-word' }}>{glbError}</div>}
            {camError   && <div style={{ color: '#f87171', wordBreak: 'break-word' }}>{camError}</div>}
          </div>
        )}
      </div>

      {/* ── Calibration panel — top right (sempre visível quando não há overlay auto) ── */}
      {!autoPhase && (
        <div style={{ ...panelBase, position: 'absolute', top: 14, right: 14, zIndex: 10, width: 240 }}>
          <div style={{ color: '#fb923c', fontWeight: 700, fontSize: 12, marginBottom: 8 }}>
            Calibração One Euro Filter
          </div>

          {isRecording && (
            <div style={{ color: '#f87171', fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
              ● REC {recState === 'recording-static' ? 'PARADO' : 'LENTO'} — {recCountdown}s
            </div>
          )}

          <div style={{ marginBottom: 8 }}>
            <div style={{ color: staticLog ? '#4ade80' : '#94a3b8' }}>
              {staticLog ? `✓ Parado (${staticLog.length} fr)` : '○ Parado — não gravado'}
            </div>
            <div style={{ color: slowLog ? '#4ade80' : '#94a3b8' }}>
              {slowLog ? `✓ Lento (${slowLog.length} fr)` : '○ Lento — não gravado'}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
            <button onClick={() => startRecording('recording-static', STATIC_MS)} disabled={isRecording || !isTracking} style={mkBtn('#dc2626', isRecording || !isTracking)}>
              {recState === 'recording-static' ? `⏺ Parado… ${recCountdown}s` : '⏺ Gravar teste parado (3s)'}
            </button>
            <button onClick={() => startRecording('recording-slow', SLOW_MS)} disabled={isRecording || !isTracking} style={mkBtn('#d97706', isRecording || !isTracking)}>
              {recState === 'recording-slow' ? `⏺ Lento… ${recCountdown}s` : '⏺ Gravar teste mov. lento (4s)'}
            </button>
            <button onClick={handleCalibrate} disabled={!canCalibrate} style={mkBtn('#7c3aed', !canCalibrate)}>
              {calibRunning ? '⚙ Calculando…' : '⚙ Rodar calibração'}
            </button>
          </div>

          {calibError && <div style={{ color: '#f87171', fontSize: 10, marginBottom: 6 }}>{calibError}</div>}

          {calibResults && (
            <div>
              <div style={{ color: '#a78bfa', fontWeight: 700, marginBottom: 4, fontSize: 11 }}>Top 5:</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
                <thead>
                  <tr>{['mc', 'β', 'jitter', 'lag', 'score', ''].map(h => (
                    <th key={h} style={{ color: '#94a3b8', textAlign: 'left', paddingBottom: 3, paddingRight: 4 }}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {calibResults.top5.map((r, i) => (
                    <tr key={i} style={{ background: i === 0 ? 'rgba(124,58,237,0.15)' : 'transparent' }}>
                      <td style={{ paddingRight: 4, color: i === 0 ? '#a78bfa' : '#e2e8f0' }}>{r.minCutoff}</td>
                      <td style={{ paddingRight: 4, color: i === 0 ? '#a78bfa' : '#e2e8f0' }}>{r.beta}</td>
                      <td style={{ paddingRight: 4, color: '#93c5fd' }}>{r.jitterMean.toFixed(4)}</td>
                      <td style={{ paddingRight: 4, color: '#93c5fd' }}>{r.lagMethod === 'cross-correlation' ? `${r.lagMs.toFixed(0)}ms` : `${r.lagFrames}fr`}</td>
                      <td style={{ paddingRight: 4, color: '#4ade80' }}>{r.score.toFixed(3)}</td>
                      <td>
                        <button
                          onClick={() => applyPreset(r)}
                          style={{ padding: '2px 7px', borderRadius: 5, border: 'none', background: activePreset?.minCutoff === r.minCutoff && activePreset?.beta === r.beta ? '#16a34a' : '#374151', color: '#fff', cursor: 'pointer', fontSize: 10 }}
                        >
                          {activePreset?.minCutoff === r.minCutoff && activePreset?.beta === r.beta ? '✓' : 'aplicar'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <button onClick={() => setShowReport(v => !v)} style={mkBtn('#374151', false)}>
                  {showReport ? 'Fechar' : 'Ver .md'}
                </button>
                <button onClick={downloadReport} style={mkBtn('#0f766e', false)}>↓ Download</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Bottom controls ── */}
      {!autoPhase && (
        <div style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setFacingMode(nextMode)} disabled={isRecording || camStarting} style={mkBtn('#374151', isRecording || camStarting)}>
              {camStarting ? 'Câmera: iniciando…' : `Câmera: ${camLabel} →`}
            </button>
            <button onClick={() => setGlbActive(v => !v)} disabled={!mvReady} style={mkBtn(glbActive ? '#16a34a' : '#7c3aed', !mvReady)}>
              {!mvReady ? 'model-viewer…' : glbActive ? '✓ GLB Ativo' : `Ativar GLB ${ACTIVE_PRODUCT_ID}`}
            </button>
          </div>
          <button onClick={() => window.history.back()} style={{ padding: '9px 20px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.6)', color: '#e2e8f0', cursor: 'pointer', fontSize: 13, fontFamily: 'sans-serif' }}>
            ← Voltar
          </button>
        </div>
      )}

      {/* M069D: seletor de modo — sempre visível, um modo ativo por vez */}
      <div style={{
        position: 'absolute', bottom: 90, right: 14, zIndex: 10,
        display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'stretch',
      }}>
        {[
          ['center',   '① Testar GLB no centro'],
          ['tracking', '② Ver tracking do pulso'],
          ['wrist',    '③ GLB no pulso'],
        ].map(([m, label]) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            style={{
              ...mkBtn(mode === m ? '#0284c7' : '#1f2937', false),
              fontSize: 12, padding: '9px 14px', textAlign: 'left',
              border: mode === m ? '1px solid #38bdf8' : '1px solid rgba(255,255,255,0.15)',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tracking indicator */}
      {ready && !autoPhase && (
        <div style={{ position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)', zIndex: 10, background: isTracking ? 'rgba(22,163,74,0.85)' : 'rgba(220,38,38,0.75)', color: '#fff', borderRadius: 20, padding: '5px 16px', fontSize: 13, fontFamily: 'monospace', fontWeight: 700 }}>
          {isTracking ? '● TRACKING' : '○ mostre o pulso na câmera'}
        </div>
      )}
    </div>
  );
}
```

**Nota importante de leitura:** o botão rotulado "✓ GLB Ativo"/"Ativar GLB" (estado
`glbActive`) é um controle **totalmente separado** do seletor de modo (① / ② / ③). Os dois
ficam visualmente próximos na tela e já causaram confusão real durante um teste (AR-001,
detalhado na PARTE 4) — quem for analisar posicionamento/renderização deve tratá-los como
duas variáveis de estado independentes no código (`mode` vs. `glbActive`), não uma.

Isso encerra a Seção 2 (código do motor atual). O componente `calibrationRunner.js` e
`calibrationMetrics.js` (usados por `runCalibration`/`computeTrackingContinuity` acima) são
ferramentas de calibração de parâmetros do filtro, não fazem parte do pipeline de tracking em
si — não foram incluídos nesta exportação por não serem necessários para diagnosticar o
gargalo de estabilidade (mas existem no repositório em
`src/labs/tasks-wrist/calibrationRunner.js` e `calibrationMetrics.js`, se a IA auditora
precisar deles).

---

*(continua na PARTE 3 — Seção 3: código do motor anterior `src/tracking/`, para comparação)*
# EXPORT_AUDITORIA — Ghost Project AI — Motor AR — PARTE 3 de 4

> Continuação da PARTE 2. Cole depois dela, antes da PARTE 4.
> Esta parte contém a Seção 3: código do motor **anterior/legado**, que está **em produção
> hoje** na loja real (`App_FINAL.jsx`), para efeito de comparação com o motor moderno da
> PARTE 1/2.

---

## 3. CÓDIGO do motor anterior (`src/tracking/` — em produção hoje)

### 3.0 Árvore de arquivos desta seção

```
src/tracking/
├── WristTracker.js            — orquestrador principal (equivalente ao GhostEngine da v2)
├── OneEuroFilter.js           — filtro de suavização (implementação PRÓPRIA, distinta da v2)
├── RenderPipeline.js          — loop de renderização + interpolação entre frames
├── PrecisionFitController.js  — ajuste fino manual (pinça de 2 dedos) sobre a pose do WristTracker
└── PoseWristTracker.js        — reforço via MediaPipe Pose (BlazePose), quando o Hands perde a mão
```

Diferente do motor moderno (que usa `@mediapipe/tasks-vision`/`HandLandmarker`), este motor
usa a API legada `@mediapipe/hands` (`window.Hands`, `window.Camera`), carregada via script
tags apontando para uma cópia vendorizada localmente em `public/mediapipe/hands/hands.js`,
`public/mediapipe/camera_utils/camera_utils.js` e `public/mediapipe/drawing_utils/
drawing_utils.js` (não é uma dependência do `package.json` — é um arquivo estático servido
pelo próprio projeto, versão exata não registrada em lockfile).

---

### 3.1 `src/tracking/WristTracker.js`

```javascript
/**
 * WristTracker - Sistema de tracking anatômico profissional
 * 
 * Arquitetura:
 * - Usa landmarks anatômicos corretos: wrist(0), index_mcp(5), pinky_mcp(17)
 * - Calcula vetor anatômico do antebraço
 * - Rotação real baseada em geometria 3D
 * - Confidence scoring robusto
 * - Persistência temporal inteligente
 * - Estabilização inicial antes de renderizar
 */

import { VectorFilter, OneEuroFilter } from './OneEuroFilter.js';

export class WristTracker {
  constructor(config = {}) {
    // Configuração
    this.config = {
      // Confidence thresholds
      minConfidence: config.minConfidence ?? 0.6,
      minStabilityFrames: config.minStabilityFrames ?? 8,
      maxLostFrames: config.maxLostFrames ?? 30, // ~1s a 30fps
      
      // One Euro Filter params (otimizado para tracking de mão)
      positionMinCutoff: config.positionMinCutoff ?? 1.2,
      positionBeta: config.positionBeta ?? 0.3,
      rotationMinCutoff: config.rotationMinCutoff ?? 0.8, // Ajustado para suavizar mais rotação
      rotationBeta: config.rotationBeta ?? 0.6, // Leve aumento para responsividade em movimentos rápidos
      scaleMinCutoff: config.scaleMinCutoff ?? 0.7, // Ajustado para suavizar mais escala
      scaleBeta: config.scaleBeta ?? 0.2, // Leve aumento para responsividade

      // Dead zone para pequenos movimentos
      deadZonePosition: config.deadZonePosition ?? 3.0, // Pixels
      deadZoneRotation: config.deadZoneRotation ?? 2.0, // Graus
      deadZoneScale: config.deadZoneScale ?? 0.02, // Proporção

      // Limite de mudança brusca (anti-jitter)
      maxPositionChange: config.maxPositionChange ?? 50, // Pixels por frame
      maxRotationChange: config.maxRotationChange ?? 30, // Graus por frame
      maxScaleChange: config.maxScaleChange ?? 0.15, // Proporção por frame
      
      // Geometria
      watchSizeMultiplier: config.watchSizeMultiplier ?? 1.5,
      watchOffsetRatio: config.watchOffsetRatio ?? 0.18,
      minWatchSize: config.minWatchSize ?? 80,
      maxWatchSize: config.maxWatchSize ?? 220,
      watchRotationOffset: config.watchRotationOffset ?? 0, // M073: era -90 — suspeita de ser a causa do "deitado", em teste
      watchOffsetFlip:     config.watchOffsetFlip     ?? false,
    };

    // Filtros One Euro
    this.positionFilter = new VectorFilter(
      this.config.positionMinCutoff,
      this.config.positionBeta,
      1.0
    );
    
    this.rotationFilter = new OneEuroFilter(
      this.config.rotationMinCutoff,
      this.config.rotationBeta,
      1.0
    );
    
    this.scaleFilter = new OneEuroFilter(
      this.config.scaleMinCutoff,
      this.config.scaleBeta,
      1.0
    );

    this.pitchFilter = new OneEuroFilter(
      this.config.rotationMinCutoff,
      this.config.rotationBeta,
      1.0
    );

    this.yawFilter = new OneEuroFilter(
      this.config.rotationMinCutoff,
      this.config.rotationBeta,
      1.0
    );

    // Estado do tracking
    this.state = {
      isTracking: false,
      isStable: false,
      confidence: 0,
      stableFrames: 0,
      lostFrames: 0,
      totalFrames: 0,
    };

    // Última pose válida
    this.lastValidPose = null;
    this.currentPose = null;

    // Dados de geometria bruta para o debug overlay visual (M057C)
    this.debugData = null;
  }

  /**
   * Processa landmarks do MediaPipe e retorna pose do relógio
   */
  update(landmarks, handedness, videoRect, mirrorX = false) {
    this.state.totalFrames++;
    const timestamp = performance.now();

    if (!landmarks || landmarks.length < 21) {
      return this._handleLostTracking();
    }

    // Extrair landmarks anatômicos corretos
    const wrist = this._toLandmark(landmarks[0], videoRect, mirrorX);
    const indexMcp = this._toLandmark(landmarks[5], videoRect, mirrorX);
    const middleMcp = this._toLandmark(landmarks[9], videoRect, mirrorX);
    const pinkyMcp = this._toLandmark(landmarks[17], videoRect, mirrorX);

    // Calcular confidence score
    const confidence = this._calculateConfidence(
      landmarks,
      wrist,
      indexMcp,
      pinkyMcp
    );

    if (confidence < this.config.minConfidence) {
      return this._handleLostTracking();
    }

    // Resetar contador de frames perdidos e marcar tracking ativo imediatamente
    this.state.lostFrames = 0;
    this.state.confidence = confidence;
    this.state.isTracking = true;

    // Calcular geometria anatômica
    const geometry = this._calculateWristGeometry(
      wrist,
      indexMcp,
      middleMcp,
      pinkyMcp
    );

    // Geometria bruta para visual debug (M057C) — nenhum cálculo alterado
    this.debugData = {
      wrist:        { x: wrist.x,    y: wrist.y },
      indexMcp:     { x: indexMcp.x, y: indexMcp.y },
      pinkyMcp:     { x: pinkyMcp.x, y: pinkyMcp.y },
      palmCenter:   { x: (indexMcp.x + pinkyMcp.x) / 2, y: (indexMcp.y + pinkyMcp.y) / 2 },
      watchAnchorX: geometry.x,
      watchAnchorY: geometry.y,
    };

    // Aplicar smoothing com One Euro Filter
    let smoothed = this._applySmoothing(geometry, timestamp);

    // Aplicar dead zone e limites de mudança brusca
    smoothed = this._applyPostFiltering(smoothed, this.currentPose || this.lastValidPose);

    // Atualizar estado de estabilidade
    this._updateStability(smoothed);

    // Salvar pose atual
    this.currentPose = {
      ...smoothed,
      confidence,
      timestamp,
    };

    // Salvar como última pose válida
    this.lastValidPose = { ...this.currentPose };

    return this.currentPose;
  }

  /**
   * Converte landmark normalizado para coordenadas de tela
   */
  _toLandmark(norm, rect, mirrorX) {
    const MP_W = 1280;
    const MP_H = 720;
    
    const scale = Math.max(rect.width / MP_W, rect.height / MP_H);
    const dW = MP_W * scale;
    const dH = MP_H * scale;
    const ox = (rect.width - dW) / 2;
    const oy = (rect.height - dH) / 2;

    let x = norm.x * dW + ox + rect.left;
    const y = norm.y * dH + oy + rect.top;

    if (mirrorX) {
      x = rect.right - (norm.x * dW + ox);
    }

    return { x, y, z: norm.z || 0 };
  }

  /**
   * Calcula confidence score baseado em múltiplos fatores
   */
  _calculateConfidence(landmarks, wrist, indexMcp, pinkyMcp) {
    let score = 1.0;

    // 1. Visibilidade dos landmarks (se disponível)
    if (landmarks[0].visibility !== undefined) {
      const avgVisibility = (
        landmarks[0].visibility +
        landmarks[5].visibility +
        landmarks[17].visibility
      ) / 3;
      score *= avgVisibility;
    }

    // 2. Geometria da mão em coordenadas normalizadas (0-1), independente de
    //    resolução da câmera, orientação do dispositivo ou escala da tela.
    //    Usar coords de pixel causava palmWidth > 300 em retrato → confidence < 0.6.
    const palmWidth = Math.hypot(
      landmarks[5].x - landmarks[17].x,
      landmarks[5].y - landmarks[17].y
    );

    // < 0.04 = mão muito distante; > 0.5 = mão muito perto da câmera
    if (palmWidth < 0.04 || palmWidth > 0.5) {
      score *= 0.5;
    }

    // 3. Distância pulso-palma (deve ser proporcional)
    const wristToPalm = Math.hypot(
      landmarks[5].x - landmarks[0].x,
      landmarks[5].y - landmarks[0].y
    );

    const ratio = wristToPalm / (palmWidth || 0.001);
    if (ratio < 0.5 || ratio > 3.0) {
      score *= 0.7;
    }

    // 4. Profundidade Z (se muito diferente, pode ser oclusão)
    const zVariance = Math.abs((landmarks[0].z || 0) - (landmarks[5].z || 0));
    if (zVariance > 0.15) {
      score *= 0.8;
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Calcula geometria anatômica do relógio no pulso
   */
  _calculateWristGeometry(wrist, indexMcp, middleMcp, pinkyMcp) {
    // 1. Calcular centro da palma (média entre index e pinky MCP)
    const palmCenterX = (indexMcp.x + pinkyMcp.x) / 2;
    const palmCenterY = (indexMcp.y + pinkyMcp.y) / 2;

    // 2. Calcular largura da palma (distância index-pinky)
    const palmWidth = Math.hypot(
      indexMcp.x - pinkyMcp.x,
      indexMcp.y - pinkyMcp.y
    );

    // 3. Calcular vetor anatômico do antebraço (pulso → palma)
    const forearmVectorX = palmCenterX - wrist.x;
    const forearmVectorY = palmCenterY - wrist.y;
    const forearmLength = Math.hypot(forearmVectorX, forearmVectorY) || 1;

    // Normalizar vetor
    const forearmDirX = forearmVectorX / forearmLength;
    const forearmDirY = forearmVectorY / forearmLength;

    // 4. Posição do relógio: offset no vetor do antebraço
    // dirSign=-1 → padrão (oposto à palma); dirSign=+1 → invertido (fitDebug offsetDirection=forearm)
    const dirSign = this.config.watchOffsetFlip ? 1 : -1;
    const offset = forearmLength * this.config.watchOffsetRatio;
    const watchX = wrist.x + forearmDirX * offset * dirSign;
    const watchY = wrist.y + forearmDirY * offset * dirSign;

    // 5. Tamanho do relógio proporcional à largura da palma
    const rawSize = palmWidth * this.config.watchSizeMultiplier;
    const watchSize = Math.max(
      this.config.minWatchSize,
      Math.min(this.config.maxWatchSize, rawSize)
    );

    // 6. Rotação real do relógio (perpendicular ao antebraço)
    // O relógio deve estar alinhado com o eixo do antebraço
    const watchRotation = Math.atan2(forearmDirY, forearmDirX) * (180 / Math.PI) + this.config.watchRotationOffset;

    return {
      x: watchX,
      y: watchY,
      size: watchSize,
      rotation: watchRotation,
      pitch: 0,
      yaw: 0,
      palmWidth,
      forearmLength,
    };
  }

  /**
   * Aplica smoothing com One Euro Filter
   */
  _applySmoothing(geometry, timestamp) {
    // Filtrar posição
    const position = this.positionFilter.filter(
      { x: geometry.x, y: geometry.y },
      timestamp
    );

    // Filtrar escala
    const size = this.scaleFilter.filter(geometry.size, timestamp);

    // Filtrar rotação (com tratamento de wrap-around)
    const rotation = this._filterRotation(geometry.rotation, timestamp);

    // Filtrar pitch e yaw
    const pitch = this.pitchFilter.filter(geometry.pitch, timestamp);
    const yaw = this.yawFilter.filter(geometry.yaw, timestamp);

    return {
      x: position.x,
      y: position.y,
      size,
      rotation,
      pitch,
      yaw,
      palmWidth: geometry.palmWidth,
      forearmLength: geometry.forearmLength,
    };
  }

  /**
   * Aplica filtros adicionais (dead zone, clamp) após o OneEuroFilter
   */
  _applyPostFiltering(currentPose, lastPose) {
    if (!lastPose) return currentPose; // Se não houver pose anterior, retornar a atual

    const newPose = { ...currentPose };

    // 1. Dead Zone para posição
    const dx = currentPose.x - lastPose.x;
    const dy = currentPose.y - lastPose.y;
    const dist = Math.hypot(dx, dy);
    if (dist < this.config.deadZonePosition) {
      newPose.x = lastPose.x;
      newPose.y = lastPose.y;
    } else {
      // 2. Limitar mudança brusca de posição
      const limitedDist = Math.min(dist, this.config.maxPositionChange);
      newPose.x = lastPose.x + (dx / dist) * limitedDist;
      newPose.y = lastPose.y + (dy / dist) * limitedDist;
    }

    // 3. Dead Zone para rotação
    let deltaRotation = currentPose.rotation - lastPose.rotation;
    if (deltaRotation > 180) deltaRotation -= 360;
    if (deltaRotation < -180) deltaRotation += 360;

    if (Math.abs(deltaRotation) < this.config.deadZoneRotation) {
      newPose.rotation = lastPose.rotation;
    } else {
      // 4. Limitar mudança brusca de rotação
      const limitedDeltaRotation = Math.min(Math.abs(deltaRotation), this.config.maxRotationChange);
      newPose.rotation = lastPose.rotation + Math.sign(deltaRotation) * limitedDeltaRotation;
    }

    // 5. Dead Zone para escala
    const scaleChange = Math.abs(currentPose.size - lastPose.size) / lastPose.size;
    if (scaleChange < this.config.deadZoneScale) {
      newPose.size = lastPose.size;
    } else {
      // 6. Limitar mudança brusca de escala
      const limitedScaleChange = Math.min(scaleChange, this.config.maxScaleChange);
      newPose.size = lastPose.size * (1 + Math.sign(currentPose.size - lastPose.size) * limitedScaleChange);
    }

    return newPose;
  }

  /**
   * Filtra rotação com tratamento de wrap-around (-180/+180)
   */
  _filterRotation(newRotation, timestamp) {
    if (this.rotationFilter.x.lastValue === null) {
      return this.rotationFilter.filter(newRotation, timestamp);
    }

    const lastRot = this.rotationFilter.x.lastValue;
    let delta = newRotation - lastRot;

    // Corrigir wrap-around
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;

    const correctedRotation = lastRot + delta;
    return this.rotationFilter.filter(correctedRotation, timestamp);
  }

  /**
   * Atualiza estado de estabilidade
   */
  _updateStability(pose) {
    if (!this.lastValidPose) {
      this.state.stableFrames = 0;
      this.state.isStable = false;
      return;
    }

    // Calcular movimento desde último frame
    const movement = Math.hypot(
      pose.x - this.lastValidPose.x,
      pose.y - this.lastValidPose.y
    );

    const sizeChange = Math.abs(pose.size - this.lastValidPose.size);

    // Considerar estável se movimento for pequeno (ajustado para dead zones)
    if (movement < this.config.deadZonePosition * 1.5 && sizeChange < this.config.deadZoneScale * 1.5) {
      this.state.stableFrames++;
    } else {
      this.state.stableFrames = Math.max(0, this.state.stableFrames - 2);
    }

    // Marcar como estável após frames mínimos
    this.state.isStable = 
      this.state.stableFrames >= this.config.minStabilityFrames;
    
    this.state.isTracking = true;
  }

  /**
   * Lida com perda de tracking
   */
  _handleLostTracking() {
    this.state.lostFrames++;

    // Manter última pose válida por um tempo
    if (this.state.lostFrames <= this.config.maxLostFrames && this.lastValidPose) {
      // Retornar última pose válida (persistência temporal)
      return {
        ...this.lastValidPose,
        isPersisted: true,
        lostFrames: this.state.lostFrames,
      };
    }

    // Tracking perdido completamente
    this.state.isTracking = false;
    this.state.isStable = false;
    this.state.stableFrames = 0;
    this.state.confidence = 0;
    this.debugData = null;

    return null;
  }

  /**
   * Reseta o tracker
   */
  reset() {
    this.positionFilter.reset();
    this.rotationFilter.reset();
    this.scaleFilter.reset();
    this.pitchFilter.reset();
    this.yawFilter.reset();

    this.state = {
      isTracking: false,
      isStable: false,
      confidence: 0,
      stableFrames: 0,
      lostFrames: 0,
      totalFrames: 0,
    };

    this.lastValidPose = null;
    this.currentPose = null;
  }

  /**
   * Retorna estado atual do tracking
   */
  getState() {
    return { ...this.state };
  }

  /**
   * Verifica se deve renderizar o relógio
   */
  shouldRender() {
    return this.state.isTracking;
  }
}
```

---

### 3.2 `src/tracking/OneEuroFilter.js`

```javascript
/**
 * One Euro Filter - Smoothing adaptativo de alta qualidade
 * Reduz jitter mantendo responsividade
 * 
 * Referência: http://cristal.univ-lille.fr/~casiez/1euro/
 */

class LowPassFilter {
  constructor() {
    this.lastValue = null;
  }

  filter(value, alpha) {
    if (this.lastValue === null) {
      this.lastValue = value;
      return value;
    }
    const filtered = alpha * value + (1 - alpha) * this.lastValue;
    this.lastValue = filtered;
    return filtered;
  }

  reset() {
    this.lastValue = null;
  }
}

export class OneEuroFilter {
  constructor(minCutoff = 1.0, beta = 0.007, dcutoff = 1.0) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dcutoff = dcutoff;
    
    this.x = new LowPassFilter();
    this.dx = new LowPassFilter();
    this.lastTime = null;
  }

  filter(value, timestamp = Date.now()) {
    if (this.lastTime === null) {
      this.lastTime = timestamp;
      return value;
    }

    const dt = (timestamp - this.lastTime) / 1000.0; // segundos
    this.lastTime = timestamp;

    // Estimar derivada
    const dvalue = this.x.lastValue !== null 
      ? (value - this.x.lastValue) / dt 
      : 0;

    const edvalue = this.dx.filter(dvalue, this.alpha(dt, this.dcutoff));

    // Calcular cutoff adaptativo
    const cutoff = this.minCutoff + this.beta * Math.abs(edvalue);

    // Filtrar valor
    return this.x.filter(value, this.alpha(dt, cutoff));
  }

  alpha(dt, cutoff) {
    const tau = 1.0 / (2 * Math.PI * cutoff);
    return 1.0 / (1.0 + tau / dt);
  }

  reset() {
    this.x.reset();
    this.dx.reset();
    this.lastTime = null;
  }
}

/**
 * Filtro vetorial para posições 2D/3D
 */
export class VectorFilter {
  constructor(minCutoff = 1.0, beta = 0.007, dcutoff = 1.0) {
    this.filters = {};
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dcutoff = dcutoff;
  }

  filter(vector, timestamp = Date.now()) {
    const result = {};
    for (const key in vector) {
      if (!this.filters[key]) {
        this.filters[key] = new OneEuroFilter(
          this.minCutoff,
          this.beta,
          this.dcutoff
        );
      }
      result[key] = this.filters[key].filter(vector[key], timestamp);
    }
    return result;
  }

  reset() {
    for (const key in this.filters) {
      this.filters[key].reset();
    }
  }
}
```

---

### 3.3 `src/tracking/RenderPipeline.js`

```javascript
/**
 * RenderPipeline - Pipeline de renderização otimizado
 * 
 * Separa lógica de tracking do ciclo de renderização React
 * Usa requestAnimationFrame de forma eficiente
 * Evita re-renders desnecessários
 * Interpolação suave entre frames
 */

export class RenderPipeline {
  constructor() {
    this.rafId = null;
    this.isRunning = false;
    this.lastPose = null;
    this.targetPose = null;
    this.interpolatedPose = null;
    
    // Callbacks
    this.onRender = null;
    this.onDebug = null;
    
    // Interpolação
    this.interpolationSpeed = 0.35; // Suavidade adicional na renderização
    
    // Performance tracking
    this.frameCount = 0;
    this.lastFpsUpdate = performance.now();
    this.fps = 0;
  }

  /**
   * Inicia o pipeline de renderização
   */
  start(onRender, onDebug = null) {
    if (this.isRunning) return;
    
    this.onRender = onRender;
    this.onDebug = onDebug;
    this.isRunning = true;
    this.lastPose = null;
    this.targetPose = null;
    this.interpolatedPose = null;
    this.frameCount = 0;
    this.lastFpsUpdate = performance.now();
    
    this._renderLoop();
  }

  /**
   * Para o pipeline
   */
  stop() {
    this.isRunning = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  /**
   * Atualiza a pose alvo (chamado pelo tracker)
   */
  updatePose(pose) {
    this.targetPose = pose;
  }

  /**
   * Loop principal de renderização
   */
  _renderLoop = () => {
    if (!this.isRunning) return;

    this.frameCount++;
    
    // Calcular FPS
    const now = performance.now();
    if (now - this.lastFpsUpdate >= 1000) {
      this.fps = this.frameCount;
      this.frameCount = 0;
      this.lastFpsUpdate = now;
    }

    // Interpolar pose se houver target
    if (this.targetPose) {
      if (!this.interpolatedPose) {
        // Primeira pose - usar diretamente
        this.interpolatedPose = { ...this.targetPose };
      } else {
        // Interpolar suavemente
        this.interpolatedPose = this._interpolate(
          this.interpolatedPose,
          this.targetPose,
          this.interpolationSpeed
        );
      }

      // Chamar callback de render
      if (this.onRender) {
        this.onRender(this.interpolatedPose);
      }
    }

    // Chamar callback de debug
    if (this.onDebug) {
      this.onDebug({
        fps: this.fps,
        hasPose: !!this.targetPose,
        interpolated: !!this.interpolatedPose,
      });
    }

    // Próximo frame
    this.rafId = requestAnimationFrame(this._renderLoop);
  };

  /**
   * Interpola entre duas poses
   */
  _interpolate(current, target, speed) {
    return {
      x: this._lerp(current.x, target.x, speed),
      y: this._lerp(current.y, target.y, speed),
      size: this._lerp(current.size, target.size, speed),
      rotation: this._lerpAngle(current.rotation, target.rotation, speed),
      pitch: this._lerpAngle(current.pitch ?? 0, target.pitch ?? 0, speed),
      yaw: this._lerpAngle(current.yaw ?? 0, target.yaw ?? 0, speed),
      confidence: target.confidence,
      timestamp: target.timestamp,
      isPersisted: target.isPersisted,
      lostFrames: target.lostFrames,
    };
  }

  /**
   * Interpolação linear
   */
  _lerp(a, b, t) {
    return a + (b - a) * t;
  }

  /**
   * Interpolação de ângulo (com wrap-around)
   */
  _lerpAngle(a, b, t) {
    let delta = b - a;
    
    // Corrigir wrap-around
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    
    return a + delta * t;
  }

  /**
   * Retorna FPS atual
   */
  getFPS() {
    return this.fps;
  }

  /**
   * Verifica se está rodando
   */
  isActive() {
    return this.isRunning;
  }
}
```

---

### 3.4 `src/tracking/PrecisionFitController.js`

```javascript
/**
 * PrecisionFitController — ajuste fino manual sobre o WristTracker
 *
 * Gerencia offset aplicado APÓS a pose do WristTracker.
 * PoseFinal = WristTracker + OffsetManual
 *
 * Offset sobrevive à perda de tracking e é reutilizado quando ele volta.
 * Reset apenas via reset() explícito (botão "Reset Position").
 */
export class PrecisionFitController {
  constructor() {
    this.offsetX = 0;
    this.offsetY = 0;
    this.offsetScale = 1.0;
    this.offsetRotation = 0;
    this.isEditing = false;

    this._prevCenter = null;
    this._prevDist = null;
    this._prevAngle = null;
  }

  /**
   * Aplica offset sobre a pose base do WristTracker.
   * Retorna null se basePose for null.
   */
  applyOffset(basePose) {
    if (!basePose) return null;
    return {
      ...basePose,
      x: basePose.x + this.offsetX,
      y: basePose.y + this.offsetY,
      size: basePose.size * this.offsetScale,
      rotation: basePose.rotation + this.offsetRotation,
    };
  }

  /** Zera todos os offsets */
  reset() {
    this.offsetX = 0;
    this.offsetY = 0;
    this.offsetScale = 1.0;
    this.offsetRotation = 0;
    this.isEditing = false;
    this._prevCenter = null;
    this._prevDist = null;
    this._prevAngle = null;
  }

  /** Inicia tracking do gesto de pinça */
  handleTouchStart(touches) {
    if (touches.length < 2) return false;
    this.isEditing = true;
    this._prevCenter = this._getCenter(touches);
    this._prevDist = this._getDist(touches);
    this._prevAngle = this._getAngle(touches);
    return true;
  }

  /** Atualiza offset durante o gesto */
  handleTouchMove(touches) {
    if (!this.isEditing || touches.length < 2) return;

    const newCenter = this._getCenter(touches);
    const newDist = this._getDist(touches);
    const newAngle = this._getAngle(touches);

    if (this._prevCenter) {
      this.offsetX += newCenter.x - this._prevCenter.x;
      this.offsetY += newCenter.y - this._prevCenter.y;
    }

    if (this._prevDist !== null && this._prevDist > 10) {
      this.offsetScale *= newDist / this._prevDist;
      this.offsetScale = Math.max(0.3, Math.min(3.0, this.offsetScale));
    }

    if (this._prevAngle !== null) {
      let dAngle = newAngle - this._prevAngle;
      if (dAngle > 180) dAngle -= 360;
      if (dAngle < -180) dAngle += 360;
      this.offsetRotation += dAngle;
    }

    this._prevCenter = newCenter;
    this._prevDist = newDist;
    this._prevAngle = newAngle;
  }

  /** Encerra modo de edição com snap suave (Apple Vision Pro feel) */
  handleTouchEnd(remainingTouchCount) {
    if (remainingTouchCount < 2) {
      this.isEditing = false;
      this._prevCenter = null;
      this._prevDist = null;
      this._prevAngle = null;

      // Snap: arredonda para múltiplos discretos para sensação de encaixe
      this.offsetX        = Math.round(this.offsetX / 3) * 3;
      this.offsetY        = Math.round(this.offsetY / 3) * 3;
      this.offsetScale    = Math.round(this.offsetScale * 20) / 20;  // múltiplo de 0.05
      this.offsetRotation = Math.round(this.offsetRotation / 3) * 3; // múltiplo de 3°
    }
  }

  _getCenter(touches) {
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2,
    };
  }

  _getDist(touches) {
    return Math.hypot(
      touches[1].clientX - touches[0].clientX,
      touches[1].clientY - touches[0].clientY
    );
  }

  _getAngle(touches) {
    return Math.atan2(
      touches[1].clientY - touches[0].clientY,
      touches[1].clientX - touches[0].clientX
    ) * (180 / Math.PI);
  }
}
```

---

### 3.5 `src/tracking/PoseWristTracker.js`

```javascript
/**
 * PoseWristTracker — reforço de rastreamento para quando o WristTracker
 * (baseado em MediaPipe Hands) perde a mão.
 *
 * Por quê: o MediaPipe Hands só reconhece "isso é uma mão" quando vê a
 * estrutura de dedos/nós — se a câmera mostrar só o pulso/antebraço (sem
 * dedos), ele não detecta nada, e o relógio some da tela até a mão inteira
 * aparecer de novo (2026-07-26, ~29s de espera medidos num teste real).
 *
 * Testado em 2026-07-26 com quadros reais do próprio teste: o MediaPipe Pose
 * (BlazePose, via @mediapipe/tasks-vision) detecta o pulso a partir do braço
 * (ombro→cotovelo→pulso) mesmo sem nenhum dedo visível — MAS só quando o
 * enquadramento mostra um pedaço do tronco/ombro junto; falha se a câmera
 * estiver muito próxima, só do pulso (aí quem funciona é o Hands). Os dois
 * motores são complementares, nenhum cobre tudo sozinho — por isso este
 * tracker roda só como REFORÇO, nunca no lugar do WristTracker.
 *
 * Limite honesto: sem a largura da palma (que só o Hands dá), o tamanho do
 * relógio aqui é estimado a partir do comprimento do antebraço (cotovelo→
 * pulso) — é uma aproximação, não uma medida tão precisa quanto a do Hands.
 */

import { VectorFilter, OneEuroFilter } from './OneEuroFilter.js';

const WASM_CDN     = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm';
const MODEL_LOCAL  = '/models/pose_landmarker.task';
const MODEL_CDN    = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

// Índices do modelo BlazePose (33 pontos)
const L_SHOULDER = 11, R_SHOULDER = 12;
const L_ELBOW    = 13, R_ELBOW    = 14;
const L_WRIST    = 15, R_WRIST    = 16;

const MIN_VISIBILITY = 0.4;

export class PoseWristTracker {
  constructor(config = {}) {
    this.config = {
      forearmSizeMultiplier: config.forearmSizeMultiplier ?? 0.55,
      minWatchSize: config.minWatchSize ?? 80,
      maxWatchSize: config.maxWatchSize ?? 220,
      watchRotationOffset: config.watchRotationOffset ?? 0,
      positionMinCutoff: config.positionMinCutoff ?? 1.2,
      positionBeta: config.positionBeta ?? 0.3,
      rotationMinCutoff: config.rotationMinCutoff ?? 0.8,
      rotationBeta: config.rotationBeta ?? 0.6,
    };

    this._landmarker = null;
    this._ready = false;
    this._loading = null;

    this.positionFilter = new VectorFilter(this.config.positionMinCutoff, this.config.positionBeta, 1.0);
    this.rotationFilter = new OneEuroFilter(this.config.rotationMinCutoff, this.config.rotationBeta, 1.0);
    this.scaleFilter    = new OneEuroFilter(this.config.rotationMinCutoff, this.config.rotationBeta, 1.0);
  }

  get ready() {
    return this._ready;
  }

  /** Carrega o modelo (assíncrono) — chamar uma vez ao abrir a câmera. */
  async init() {
    if (this._loading) return this._loading;
    this._loading = this._doInit();
    return this._loading;
  }

  async _doInit() {
    try {
      const { FilesetResolver, PoseLandmarker } = await import('@mediapipe/tasks-vision');
      const vision = await FilesetResolver.forVisionTasks(WASM_CDN);

      let modelPath = MODEL_CDN;
      try {
        const head = await fetch(MODEL_LOCAL, { method: 'HEAD' });
        if (head.ok) modelPath = MODEL_LOCAL;
      } catch (_) { /* usa CDN */ }

      const opts = (delegate) => ({
        baseOptions: { modelAssetPath: modelPath, delegate },
        runningMode: 'VIDEO',
        numPoses: 1,
        minPoseDetectionConfidence: 0.3,
        minPosePresenceConfidence: 0.3,
        minTrackingConfidence: 0.3,
      });

      try {
        this._landmarker = await PoseLandmarker.createFromOptions(vision, opts('GPU'));
      } catch (_) {
        this._landmarker = await PoseLandmarker.createFromOptions(vision, opts('CPU'));
      }
      this._ready = true;
    } catch (err) {
      console.warn('[PoseWristTracker] falha ao carregar — reforço de pulso indisponível:', err.message);
      this._ready = false;
    }
  }

  /**
   * Roda a detecção no frame atual e devolve a pose do relógio (mesmo
   * formato do WristTracker: {x, y, size, rotation}), ou null se não achou
   * nem o braço.
   */
  detect(videoEl, videoRect, mirrorX = false, timestamp = performance.now()) {
    if (!this._ready || !this._landmarker) return null;

    let result;
    try {
      result = this._landmarker.detectForVideo(videoEl, timestamp);
    } catch (_) {
      return null;
    }

    const pose = result?.landmarks?.[0];
    if (!pose) return null;

    // Escolhe o lado (esquerdo/direito) com maior confiança combinada
    const scoreR = (pose[R_SHOULDER]?.visibility ?? 0) + (pose[R_ELBOW]?.visibility ?? 0) + (pose[R_WRIST]?.visibility ?? 0);
    const scoreL = (pose[L_SHOULDER]?.visibility ?? 0) + (pose[L_ELBOW]?.visibility ?? 0) + (pose[L_WRIST]?.visibility ?? 0);
    const useRight = scoreR >= scoreL;

    const wrist = pose[useRight ? R_WRIST : L_WRIST];
    const elbow = pose[useRight ? R_ELBOW : L_ELBOW];
    if (!wrist || !elbow) return null;
    if ((wrist.visibility ?? 0) < MIN_VISIBILITY || (elbow.visibility ?? 0) < MIN_VISIBILITY) return null;

    const videoW = videoEl.videoWidth || videoRect.width;
    const videoH = videoEl.videoHeight || videoRect.height;
    const wristPx = this._toScreen(wrist, videoRect, mirrorX, videoW, videoH);
    const elbowPx = this._toScreen(elbow, videoRect, mirrorX, videoW, videoH);

    const forearmVecX = wristPx.x - elbowPx.x;
    const forearmVecY = wristPx.y - elbowPx.y;
    const forearmLength = Math.hypot(forearmVecX, forearmVecY) || 1;

    const rawRotation = Math.atan2(forearmVecY, forearmVecX) * (180 / Math.PI) + this.config.watchRotationOffset;
    const rawSize = Math.max(
      this.config.minWatchSize,
      Math.min(this.config.maxWatchSize, forearmLength * this.config.forearmSizeMultiplier)
    );

    const smoothedPos = this.positionFilter.filter({ x: wristPx.x, y: wristPx.y }, timestamp);
    const smoothedRotation = this.rotationFilter.filter(rawRotation, timestamp);
    const smoothedSize = this.scaleFilter.filter(rawSize, timestamp);

    return {
      x: smoothedPos.x,
      y: smoothedPos.y,
      size: smoothedSize,
      rotation: smoothedRotation,
      source: 'pose-fallback',
    };
  }

  // Mesmo cálculo de "object-fit: cover" do WristTracker._toLandmark, mas
  // usando as dimensões reais do vídeo em vez do buffer fixo do MediaPipe Hands.
  _toScreen(landmark, rect, mirrorX, videoW, videoH) {
    const scale = Math.max(rect.width / videoW, rect.height / videoH);
    const dW = videoW * scale;
    const dH = videoH * scale;
    const ox = (rect.width - dW) / 2;
    const oy = (rect.height - dH) / 2;

    let x = landmark.x * dW + ox + rect.left;
    const y = landmark.y * dH + oy + rect.top;
    if (mirrorX) x = rect.right - (landmark.x * dW + ox);
    return { x, y };
  }

  reset() {
    this.positionFilter.reset();
    this.rotationFilter.reset();
    this.scaleFilter.reset();
  }

  destroy() {
    try { this._landmarker?.close(); } catch (_) {}
    this._landmarker = null;
    this._ready = false;
    this._loading = null;
  }
}
```

---

### 3.6 Como `App_FINAL.jsx` (loja real) conecta este motor — excerpto de wiring

Não é o arquivo completo (tem ~2000 linhas, a maior parte é UI de loja/checkout/produto,
fora do escopo desta auditoria). Abaixo, só os trechos que instanciam o motor de tracking,
abrem a câmera via MediaPipe Hands legado, e processam cada frame — é o "cola" que falta
para entender como `WristTracker`/`RenderPipeline`/`PoseWristTracker` (seção 3.1–3.5) são
usados de verdade em produção.

```javascript
// Import no topo do arquivo:
import { WristTracker } from './tracking/WristTracker.js';
import { PoseWristTracker } from './tracking/PoseWristTracker.js';
import { RenderPipeline } from './tracking/RenderPipeline.js';
import { PrecisionFitController } from './tracking/PrecisionFitController.js';

// ── Carregamento do MediaPipe Hands legado (vendorizado localmente) ──────────
async function loadMediaPipe() {
  await loadScript('/mediapipe/camera_utils/camera_utils.js', 'mp-cu');
  await loadScript('/mediapipe/drawing_utils/drawing_utils.js', 'mp-du');
  await loadScript('/mediapipe/hands/hands.js', 'mp-h');
}

// ── renderCallback: recebe a pose já interpolada pelo RenderPipeline ─────────
const renderCallback = useCallback((pose) => {
  setWatch(pose);
  // Perf: tempo até primeira renderização
  if (pose.size > 0 && perfRef.current.firstRenderAt === null && perfRef.current.scannerOpenedAt !== null) {
    perfRef.current.firstRenderAt = performance.now();
  }
}, []);

const debugCallback = useCallback(() => {}, []);

// ── Inicialização única da arquitetura de tracking (instâncias ociosas) ──────
useEffect(() => {
  // ...
  trackerRef.current = new WristTracker({
    minConfidence: 0.6,
    minStabilityFrames: 8,
    // M073b: era 30 (~1s a 30fps) — a mão precisava reaparecer inteira toda
    // vez que saía do quadro. Agora, uma vez travado, o relógio "trava" na
    // última posição boa por bem mais tempo (~10-20s dependendo do fps do
    // aparelho), então mostrar só o pulso/antebraço depois do primeiro
    // travamento não derruba o relógio. Trade-off: durante essa espera a
    // posição fica parada (não segue o pulso se ele se mexer muito) — não é
    // rastreamento contínuo, é segurar a última pose boa por mais tempo.
    maxLostFrames: 300,
    positionMinCutoff: 1.2,
    positionBeta: 0.3,
    rotationMinCutoff: 1.0,
    rotationBeta: 0.5,
    scaleMinCutoff: 0.8,
    scaleBeta: 0.1,
    watchSizeMultiplier: 1.5,
    watchOffsetRatio: 0.18,
    ...fitParams,   // overrides via ?fitDebug=1&...
  });
  // Reforço: só entra quando o Hands perde a mão completamente (ver
  // PoseWristTracker.js). Carrega em paralelo, sem bloquear nada — se
  // falhar ou demorar, o app funciona igual, só sem o reforço.
  poseTrackerRef.current = new PoseWristTracker({ watchRotationOffset: fitParams.watchRotationOffset });
  poseTrackerRef.current.init().catch(() => {});
  pipelineRef.current = new RenderPipeline();
  precisionFitRef.current = new PrecisionFitController();
  // ...
  return () => {
    trackerRef.current?.reset();
    poseTrackerRef.current?.destroy();
    pipelineRef.current?.stop();
  };
}, []);

// ─── MediaPipe callback — roda a cada frame que o Hands processa ────────────
const onHandsResults = useCallback(
  (results) => {
    if (!activeRef.current || !videoRef.current) return;

    const lms = results.multiHandLandmarks?.[0] ?? null;
    const videoRect = videoRef.current.getBoundingClientRect();
    const mirrorX = camMode === 'user' || fitFlipXRef.current;

    let pose = trackerRef.current.update(lms, null, videoRect, mirrorX);
    // Hands não achou nada (nem a última pose segurada): tenta o reforço
    // por braço antes de deixar a tela sem relógio.
    if (!pose && poseFallbackPoseRef.current) {
      pose = poseFallbackPoseRef.current;
    }
    pipelineRef.current.updatePose(pose);
  },
  [camMode]
);

// ─── Camera + MediaPipe — abre a câmera e liga o Hands ao vivo ──────────────
useEffect(() => {
  if (screen !== 'scanner') return;
  activeRef.current = true;
  pipelineRef.current.start(renderCallback, debugCallback);

  (async () => {
    try {
      await loadMediaPipe();
      if (!activeRef.current) return;

      const hands = new window.Hands({
        locateFile: (f) => `/mediapipe/hands/${f}`,
      });

      hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 0,
        minDetectionConfidence: 0.3,
        minTrackingConfidence: 0.3,
      });

      hands.onResults(onHandsResults);
      handsRef.current = hands;

      if (!videoRef.current) return;

      const camera = new window.Camera(videoRef.current, {
        onFrame: async () => {
          if (handsRef.current && videoRef.current) {
            const vid = videoRef.current;
            if (vid.readyState === vid.HAVE_ENOUGH_DATA) {
              await handsRef.current.send({ image: vid });

              // Reforço por braço: só roda quando o Hands não está
              // mostrando o relógio, pra não gastar processamento à toa.
              if (poseTrackerRef.current?.ready && !trackerRef.current?.shouldRender()) {
                const videoRect = videoRef.current.getBoundingClientRect();
                const mirrorX = camMode === 'user' || fitFlipXRef.current;
                poseFallbackPoseRef.current = poseTrackerRef.current.detect(vid, videoRect, mirrorX);
              } else {
                poseFallbackPoseRef.current = null;
              }
            }
          }
        },
        facingMode: camMode,
        width: 640,
        height: 480,
      });

      await camera.start();
      cameraRef.current = camera;
      // ...
    } catch (err) {
      // ...
      setCamError(`Câmera indisponível: ${err?.message ?? String(err)}`);
      setScreen('home');
    }
  })();
  // ...
}, [/* deps omitidas — não relevantes ao motor */]);
```

Parâmetros do `hands.setOptions()` em produção: `maxNumHands: 1`, `modelComplexity: 0`
(modelo mais leve/rápido do MediaPipe Hands legado, não o mais preciso),
`minDetectionConfidence: 0.3`, `minTrackingConfidence: 0.3`.

Note que o modo `?fitDebug=1` (calibração ao vivo via URL) sobrescreve
`watchRotationOffset` para **-90** por padrão (`clamp(num('rotationOffset', -90), -180, 180)`)
quando ativo — mas o valor commitado como default do `WristTracker` em si (fora do
`fitParams`) usa `watchRotationOffset: config.watchRotationOffset ?? 0` (era `-90` fixo
antes, corrigido para `0` no commit `58beeb4`, ver PARTE 4 seção 4).

---

## Nota sobre `src/tracking-engines/`

Existe uma terceira pasta, `src/tracking-engines/`, mas **não é uma implementação real
concorrente** — é um scaffold de avaliação de SDKs de terceiros (DeepAR, Perfect Corp,
Banuba, MIRRAR), criado para comparação futura. A maioria dos arquivos em
`engines/*.placeholder.js` lança erro propositalmente em `createSession()` (não implementados).
Não incluído aqui por não ter código de tracking real para auditar; existe em
`src/tracking-engines/README.md` se for necessário mais contexto.

---

*(continua na PARTE 4 — histórico de commits, resumo dos testes reais AR-000 a AR-003,
BASELINE.md/CURRENT_STATE.md completos, as 10 perguntas e a regra absoluta)*
# EXPORT_AUDITORIA — Ghost Project AI — Motor AR — PARTE 4 de 4 (final)

> Continuação da PARTE 3. Cole por último. Esta parte contém o histórico de commits, o
> resumo dos testes reais em dispositivo físico, o conteúdo integral dos documentos de
> estado da investigação, e — mais importante — **as 10 perguntas que você deve responder**
> e a regra absoluta de conduta desta auditoria.

---

## 4. HISTÓRICO DE COMMITS relevantes ao motor AR

Extraído com `git log --oneline -- <pasta>`, do mais recente para o mais antigo.

### `src/engine/` (motor moderno)
```
dedf7b7 M069C-M070F: checkpoint completo — tracking, pipeline GLB e calibração dos 15 produtos
c27271c M069G: extração GhostEngine — motor AR modular em src/engine/
```

### `src/tracking/` (motor legado, em produção)
```
248efc6 Checkpoint: teste do Foxbox — video na tela inicial, reforco de Pose, material sem brilho espelhado
58beeb4 Corrige orientacao do relogio no pulso (bug -90 fixo no WristTracker) e comprime os GLBs do catalogo
5f1d27f Revert "feat: M058 — improve wrist tracking geometry and MediaPipe preload"
9962593 feat: M058 — improve wrist tracking geometry and MediaPipe preload
e83c0f6 feat: M057D — safe fitDebug forearm offset direction
2933739 feat: M057C — visual tracking debug overlay (fitDebug=1&showTrackingDebug=1)
d1b7da6 feat: M057A — safe wrist fit debug parameters
26b5799 feat: M024 — tracking imediato, tela 360°, experience embedded
04412ee fix: M022 — corrigir scanner preso em Recalibrando
ed403f5 Release Candidate RC1 - Investor Demo Ready
a1c00f8 feat: nova arquitetura de tracking com pitch/yaw e fix CSS modal B2B
ba0c0a1 MVP funcional AR tracking estabilizado
2350b20 Stable MVP checkpoint - wrist tracking functional
```

**Nota sobre `9962593`/`5f1d27f`:** um commit de melhoria de geometria de tracking
(`M058`) foi revertido logo em seguida — sinal de que pelo menos uma tentativa anterior de
melhorar a geometria do tracking não deu certo e foi desfeita. Nenhum detalhe do motivo do
revert está disponível fora da mensagem de commit em si (histórico de PR/issue não existe
neste repositório).

**Nota sobre `58beeb4`:** o commit mais recente que tocou `src/tracking/` corrigiu
`watchRotationOffset` de `-90` fixo (hardcoded) para `0` — a mensagem do commit indica que
o `-90` estava causando orientação incorreta ("deitado") do relógio no pulso, afetando
**todos os produtos**. Ver comentário correspondente no código (seção 3.1 da PARTE 3,
campo `watchRotationOffset` do `WristTracker`).

### `src/labs/tasks-wrist/` (harness que consome o motor moderno)
```
248efc6 Checkpoint: teste do Foxbox — video na tela inicial, reforco de Pose, material sem brilho espelhado
dedf7b7 M069C-M070F: checkpoint completo — tracking, pipeline GLB e calibração dos 15 produtos
c27271c M069G: extração GhostEngine — motor AR modular em src/engine/
db07061 M069B-F: lab tasks-wrist scaffolding, M069B fixes e auditoria AR Engine
```

### `src/tracking-engines/` (scaffold de avaliação de SDKs terceiros, sem implementação real)
```
4a89071 M068A: add isolated DeepAR lab
4b310aa M067C: add isolated tracking engine layer
```

### Versões de dependências relevantes (`package.json`)
```
"@mediapipe/tasks-vision": "^0.10.35"   (motor moderno — HandLandmarker, PoseLandmarker)
"three": "^0.184.0"
```
O motor legado (`src/tracking/`) usa `@mediapipe/hands` — não é dependência do
`package.json`; é uma cópia vendorizada localmente em `public/mediapipe/hands/hands.js`
(mais `camera_utils.js`, `drawing_utils.js`), sem versão pinada em lockfile (commit
`648c486`: "Hospeda o MediaPipe Hands localmente em vez de CDN externo").

---

## 5. RESULTADOS DOS TESTES REAIS já coletados

Aparelho de todos os testes: **Motorola razr 40** (Android 15, GPU Adreno), flip phone com
2 telas físicas — detalhe relevante porque exigiu correções específicas nos scripts de
captura (`--display-id` explícito), sem relação com o motor AR em si.

### AR-000 — `INFRA_CAPABILITY_CHECK` (não é teste do motor)
- **Status:** `INFRA_PASS` (não é PASS/FAIL do motor — é validação da infraestrutura de
  captura: device-check, git snapshot, screenshot, logcat, vídeo).
- **Achado técnico real (não hipótese):** `console.log()` de uma aba comum do Chrome Android
  **não chega ao logcat do sistema** — só tags nativas do processo Chromium (`chromium`)
  aparecem, nunca o conteúdo de `console.log` da página. Confirmado empiricamente com um
  marcador único injetado via servidor HTTP local + `adb reverse`. Consequência: nenhuma
  métrica do motor que hoje só existe como `console.log` (motor moderno, atrás de
  `debug=true`) é observável via logcat — só via leitura visual do HUD desenhado na tela,
  quadro a quadro, num vídeo gravado.
- Fase 5 (teste funcional com câmera apontada pro pulso) **não foi executada** neste
  registro — ficou para AR-001.

### AR-001 — `AR-BASELINE-10S` (primeira tentativa)
- **Status:** `FAIL` no sinal `isTracking` — 9/9 amostras verificadas mostraram "não
  detectado", mesmo com pulso real visivelmente em quadro.
- **Ressalva metodológica grave:** a captura caiu com o modo errado selecionado (①
  "Testar GLB no centro", não ③ "GLB no pulso") — descoberto DEPOIS, por análise de vídeo.
  Nesse modo o GLB não é ancorado ao pulso por design; o resultado não serve para avaliar
  jitter/estabilidade do anchor, só o sinal `isTracking` (que é independente do modo).
- FPS não observável — HUD coberto pelo painel de calibração.
- **Erro de OIS da câmera:** 204 ocorrências de `CSLHwInternalDefaultIoctl() Ioctl failed
  for device /dev/v4l-subdev17 (Type:CSLHwOIS...) Connection timed out` no logcat nativo,
  cobrindo quase toda a janela de ~12s. Correlacionado no tempo com `isTracking=false`, mas
  **sem relação de causa comprovada** — só uma hipótese concreta a investigar.
- Hipótese externa de "loop de tracking travado" (relatada pelo coordenador via 2
  screenshots fora da janela de captura do AR-001) — analisada por diff de pixel real no
  próprio vídeo do AR-001: o feed de câmera mudou 57-91% dos pixels dentro da janela
  capturada (não estava congelado nessa janela específica). **Não confirmada nem
  descartada** — a janela do AR-001 não cobre o momento em que a discrepância foi relatada.

### AR-002 — `AR-BASELINE-10S` (repetição corrigida)
- **Status:** `FAIL` no sinal `isTracking` — 12/12 amostras, 0 mostraram tracking ativo.
- **Correção em relação ao AR-001:** modo confirmado CORRETO desta vez (③ "GLB no pulso"),
  verificado por screenshot antes de gravar.
- **Ressalva metodológica desta captura:** na maior parte das 12 amostras, a câmera
  mostrava tapete/joelho, **não** uma mão/pulso reconhecível — explicação alternativa
  plausível para o FAIL, que não implica necessariamente defeito do motor.
- **Achado estrutural confirmado (não hipótese):** o painel de calibração é permanente no
  código desta versão do lab (sem botão de fechar), e a soma das larguras dos dois painéis
  (240px + 262px = 502px) excede a largura de tela em retrato (~411px) neste aparelho — por
  isso o HUD de fps/scale/rotZ fica coberto **por design de layout**, não por acidente
  pontual. Não resolvível por interação de UI; exigiria mudança de código.
- **Erro de OIS reproduzido pela 2ª vez:** 206 ocorrências, mesma janela de ~12s, agora em
  modo diferente do lab — reforça hipótese de condição persistente do hardware/driver deste
  aparelho específico.

### AR-003 — `AR-BASELINE-10S` (terceira captura, primeira condição limpa)
- **Status:** `PASS` no sinal `isTracking` — 18/18 amostras verificadas (de 24 disponíveis,
  ~75% da janela de 11.97s) mostraram tracking ativo e o GLB visivelmente ancorado sobre o
  pulso real, inclusive durante um pequeno reposicionamento do pulso perto de t≈9.5s. Zero
  amostras com pill vermelho, inversão do modelo, ou "salto" perceptível entre quadros.
- **O que mudou em relação ao AR-002:** modo confirmado correto (③) **e** enquadramento
  confirmado por screenshot ANTES de gravar (mão/pulso real com dedos visíveis, ocupando a
  maior parte do quadro) — corrigindo o problema do AR-002 (câmera apontada pro chão/joelho).
- **Escopo explícito do PASS (não generalizar além disso):** cobre detecção de mão/pulso +
  ancoragem visual do GLB, sob pulso **majoritariamente parado** com um movimento pequeno.
  NÃO testa (e portanto não é evidência de PASS nem FAIL para): FPS do motor sob carga,
  comportamento sob rotação rápida do pulso, comportamento sob perda e reaquisição de
  tracking, nem a hipótese mais ampla de instabilidade citada no histórico do projeto — essa
  hipótese **continua sem teste direto até agora**.
- Relato do operador de que o relógio "dançou"/apareceu de cabeça para baixo em algum
  momento anterior: **NÃO corroborado** nesta captura específica (amostragem a 2fps pode não
  capturar um evento breve de alta frequência; o relato original pode ser de outro
  momento/sessão) — tratado como observação do operador, não como fato medido.
- **Erro de OIS reproduzido pela 3ª vez consecutiva:** 206 ocorrências, mesma janela de
  ~12s, agora com conteúdo de câmera diferente (mão real, não chão/joelho) — reforça ainda
  mais a hipótese de condição persistente do hardware/driver deste aparelho específico, mas
  **não afetou o resultado de tracking desta vez** (isTracking permaneceu true durante toda
  a janela, apesar do erro de OIS ocorrer em paralelo).
- FPS continua NÃO OBSERVÁVEL (mesma limitação estrutural do HUD coberto).
- **Decisão registrada:** promover a conclusão limitada de que o motor de tracking
  (GhostEngine, `@mediapipe/tasks-vision`) detecta e ancora corretamente um pulso/mão real
  quando o modo do lab está certo e a mão está em quadro, neste aparelho, **sob movimento
  mínimo**. Não promover nenhuma conclusão sobre fps/estabilidade sob movimento rápido
  (continua NÃO OBSERVÁVEL). Próxima investigação recomendada: repetir com movimento mais
  ativo/rotação do pulso, e resolver a sobreposição estrutural do HUD para observar fps
  diretamente.

### Padrão consolidado do erro de OIS da câmera (3 capturas)
| Captura | Ocorrências | Modo do lab | Conteúdo da câmera | Afetou isTracking? |
|---|---|---|---|---|
| AR-001 | 204 | ① center | pulso em quadro | correlação temporal, causa não comprovada |
| AR-002 | 206 | ③ wrist | chão/joelho | N/A (mão não estava em quadro) |
| AR-003 | 206 | ③ wrist | pulso real em quadro | **não** (isTracking permaneceu true) |

Mensagem de erro (idêntica nas 3 capturas): `CSLHwInternalDefaultIoctl() Ioctl failed for
device /dev/v4l-subdev17 (Type:CSLHwOIS...) Connection timed out; OIS[0]: failed to submit
packet; Failed to read lens position data`. Fonte: logcat nativo do sistema, tag `CamX`
(HAL de câmera do Android), não do motor AR/JavaScript.

**Regra de compatibilidade universal em vigor** (adicionada ao protocolo após o AR-002):
qualquer causa raiz identificada — incluindo este erro de OIS — deve ser tratada como
hipótese específica deste Motorola razr 40 de teste até validação cruzada em pelo menos um
segundo Android. Nenhuma correção proposta até agora foi ou deve ser um workaround
específico de hardware de um único aparelho.

---

## 6. CONTEÚDO de BASELINE.md e CURRENT_STATE.md

### 6.1 `docs/prado-rescue/BASELINE.md` (conteúdo integral)

```markdown
# BASELINE — PRADO GHOST RESCUE / AR LAB v1

Registro criado por: subagente `ar-rescue`
Execução: FASE 1 (Baseline) do protocolo permanente.

---

## 1. Estado do repositório no momento desta execução

- **Data/hora local:** 2026-08-16
- **Branch atual:** `ghost-engine-v1`
- **Commit atual (HEAD):** `248efc6` — "Checkpoint: teste do Foxbox — video na tela inicial, reforco de Pose, material sem brilho espelhado"
- **Situação em relação ao remoto:** branch local está 6 commits à frente de `origin/ghost-engine-v1` (não sincronizado, não é problema — só registro).
- **`git status` no momento da leitura:**
  - Modificados (não staged): `.claude/settings.json`, `CLAUDE.md`, `scripts/normalize-glb/VALIDATION_REPORT.md`
  - Não rastreados: `.claude/agents/ar-rescue.md`, `docs/GHOST_BUSINESS_MASTER_PLAN.md`, `public/deepar-wrist-test.html`, `public/effects/`
  - Nenhuma dessas alterações foi tocada, criada ou revertida por esta execução do AR LAB. Ficam como estavam.
- **Nenhum `git reset`, `checkout` destrutivo, ou criação de branch/tag foi feito.** Não foi necessário criar snapshot adicional porque nada foi alterado no motor.

## 2. Existia investigação AR LAB anterior?

**NÃO.** `docs/prado-rescue/CURRENT_STATE.md` não existia antes desta execução. Esta é, na
prática, a primeira execução real do protocolo AR LAB v1 (registro AR-000 será o primeiro,
quando a Fase 3 for autorizada).

## 4. Como acessar o motor AR (loja real vs. labs)

Roteamento em `src/main.tsx`, via query param `?lab=`:

| URL (`?lab=`) | Componente | Motor de tracking usado |
|---|---|---|
| (nenhum — rota padrão) | `App_FINAL.jsx` (loja real) | `src/tracking/` — legado, `@mediapipe/hands` via CDN/script global (`window.Hands`) |
| `tasks-wrist` | `TasksWristLab.jsx` | `src/engine/` (GhostEngine) — moderno, `@mediapipe/tasks-vision` (HandLandmarker) |
| `replay` | `ReplayLab.jsx` | replay de captura |
| `webarrocks` | `WebARRocksLab.jsx` | avaliação de SDK terceiro (WebAR.rocks) |
| `deepar` | `DeepARLab.jsx` | avaliação de SDK terceiro (DeepAR) |
| `validate-glb` | `GLBValidationLab.jsx` | validação geométrica de GLB, sem câmera |
| `calibrate-product` | `ProductCalibrationLab.jsx` | calibração manual de rotação/escala de produto |
| `material-ab` | `MaterialABLab.jsx` | teste A/B de material |

## 5. Estado atual conhecido do motor AR (por inspeção de documentação existente — não testado nesta execução)

- Existem duas implementações de tracking paralelas, não uma migração completa:
  - `src/tracking/` — em produção agora, usada por `App_FINAL.jsx`. API legada `@mediapipe/hands`.
  - `src/engine/` (GhostEngine) — reescrita moderna, `@mediapipe/tasks-vision` (HandLandmarker),
    One Euro Filter, hold-last-pose 1500ms, âncora em landmark 0 + 18% do antebraço. Só consumida
    pelo lab `?lab=tasks-wrist`. `App_FINAL.jsx` NÃO usa `src/engine/`.
  - Migrar a loja real para o motor novo ainda não aconteceu — trabalho futuro registrado.
- **Hipótese em aberto, ainda não confirmada por evidência no repositório (no momento desta
  escrita):** reprovação em teste de estabilidade (FPS/rotação) no motor moderno, possivelmente
  ligada a incompatibilidade WebGL vs. GPU Adreno do Motorola Razr 40. Nenhum relatório/log no
  repositório documentava esse teste especificamente até este ponto — tratada como hipótese em
  aberto, não como fato confirmado.

## 6. Problemas conhecidos (por documentação existente, não re-testados agora)

- Duas implementações de `OneEuroFilter` divergentes (loja vs. engine) — risco de re-trabalho
  se um dia forem unificadas sem cuidado.
- Sistema de calibração automática (`?auto=1`) do lab não está conectado à loja real —
  parâmetros achados lá não retroalimentam `WristTracker.js` automaticamente.

## 7. Funcionalidades que NÃO podem quebrar (regra suprema do projeto: nunca retroceder)

- `App_FINAL.jsx` (loja real) e tudo que ela consome de `src/tracking/` — comportamento
  funcional em produção hoje.
- `public/gsdk.js` (SDK embutido nas lojas parceiras) — nunca editar `dist/gsdk.js`.
- `public/models/` (GLBs originais) e `public/models/normalized/` (pipeline calibrado).
- `src/data/products.json` — roteamento produto → GLB.

---

Nenhum arquivo do motor AR foi modificado nesta execução. Esta é uma fase de leitura e
registro apenas, mais a criação da infraestrutura da Fase 2 (scripts USB/ADB), que é nova e
não sobrescreve nada existente.
```

*(Seções 3 e 8 do documento original — comandos de inicialização do projeto e lista de
ferramentas de diagnóstico preservadas — omitidas aqui por não serem relevantes ao
diagnóstico do motor em si; texto integral disponível em `docs/prado-rescue/BASELINE.md` no
repositório.)*

### 6.2 `docs/prado-rescue/CURRENT_STATE.md` (conteúdo integral, na data desta exportação)

```markdown
# CURRENT_STATE — PRADO GHOST RESCUE / AR LAB v1

Última atualização: 2026-08-16, após execução das Fases 1-4 e duas capturas da Fase 5 (AR-001, AR-002).
**Ler este arquivo antes de qualquer nova investigação — não repetir o que já foi feito aqui.**

## REGRA PERMANENTE ADICIONADA NESTA SESSÃO (ler antes de qualquer recomendação futura)

O `.claude/agents/ar-rescue.md` ganhou a seção "REQUISITO DE COMPATIBILIDADE UNIVERSAL":
qualquer causa raiz identificada (ex: erro de OIS da câmera, ver abaixo) deve ser tratada
como hipótese específica do Motorola Razr 40 de teste até validação cruzada em pelo menos
um segundo Android. Nenhuma correção futura (Fase 6) pode ser um workaround específico de
hardware de um único aparelho. Sem um segundo dispositivo disponível, isso deve continuar
registrado como limitação conhecida.

## Estado atual

- Infraestrutura (Fase 1-2) construída e validada (Motorola razr 40, Android 15, GPU Adreno,
  serial `ZY22HDF7WJ`).
- Evidence Pack (Fase 3) e métricas (Fase 4) concluídos — ver `AR-000`.
- Fase 5 tem duas capturas reais registradas neste arquivo no momento em que foi escrito:
  `AR-001` e `AR-002`, ambas FAIL no sinal `isTracking`, ambas com ressalvas metodológicas
  sérias que impediam tratar isso como conclusão definitiva sobre o motor. Nenhuma delas
  conseguiu um teste "limpo" (modo certo + HUD legível + mão claramente enquadrada durante
  toda a janela).
- Fases 6, 7, 8 não haviam começado até este ponto — nenhuma correção foi tentada, nenhum
  código do motor AR foi alterado em nenhuma fase até aqui.

## Achado técnico real confirmado (Fase 4, não é hipótese)

`console.log()` de página web numa aba comum do Chrome Android não chega ao logcat do
sistema (confirmado empiricamente). Via leitura quadro-a-quadro do HUD visível na tela é a
que funciona, mas nas capturas da Fase 5 o HUD completo (fps/scale/rotZ) ficou
estruturalmente coberto por um painel de calibração permanente no código atual do lab.

## O que continua desconhecido (NÃO OBSERVÁVEL até o momento em que este arquivo foi escrito)

- FPS real de qualquer um dos dois motores em uso ao vivo — estruturalmente coberto pelo
  painel de calibração. Só seria observável rodando fora do modo autoPhase com uma mudança
  de código (fora de escopo) OU girando o aparelho para paisagem (não tentado até então).
- Se o erro de OIS é causa, coincidência, ou condição crônica do aparelho independente do
  site — precisa de teste comparativo fora do navegador (app de câmera nativo).
- Se o "congelamento do loop de tracking" relatado pelo coordenador no AR-001 é real —
  ainda não confirmado nem descartado até este ponto.
- Comportamento de jitter/estabilidade real do anchor no pulso quando uma mão de fato está
  em quadro — nenhuma das duas capturas registradas neste arquivo (AR-001, AR-002) havia
  conseguido isolar isso ainda.

## Próxima investigação recomendada (registrada neste arquivo)

1. AR-003: repetir com atenção específica ao ENQUADRAMENTO — garantir que a mão/pulso com
   dedos visíveis esteja de fato dentro do campo de visão da câmera durante toda a janela de
   gravação, além do modo certo.
2. Testar o erro de OIS fora do navegador (app de câmera nativo do Android) para isolar se é
   específico do uso via WebRTC/Chrome ou uma condição mais ampla do aparelho.
3. Repetir o mesmo tipo de teste na loja real (`?fitDebug=1&showTrackingDebug=1`) para
   comparar com o motor em produção hoje.

## Registros de evidência existentes (no momento em que este arquivo foi escrito)

| ID | Tipo | Resumo |
|---|---|---|
| `AR-000` | Infra capability check (Fase 3+4) | Evidence Pack validado + descoberta de métricas; nenhum teste funcional do motor AR |
| `AR-001` | AR-BASELINE-10S (Fase 5) | FAIL isTracking; modo errado selecionado; HUD coberto; erro OIS 204x; hipótese de loop travado não confirmada nem descartada |
| `AR-002` | AR-BASELINE-10S (Fase 5, repetição) | FAIL isTracking; modo CORRETO desta vez; HUD continua coberto (limitação estrutural do código, não resolvível por UI); câmera majoritariamente sem mão em quadro; erro OIS reproduzido 206x |
```

> **Aviso desta compilação:** este arquivo (`CURRENT_STATE.md`) **ainda não foi atualizado**
> com o resultado do AR-003 (PASS, seção 5 acima) no repositório no momento desta
> exportação — ele reflete o estado logo após o AR-002. O registro completo e mais atual do
> AR-003 está diretamente em `docs/prado-rescue/evidence/AR-003/` (`result.json`,
> `README.md`), cujo conteúdo já foi resumido na Seção 5 deste documento. Trate a Seção 5
> deste export como mais atual que este `CURRENT_STATE.md` no que se refere ao AR-003.

---

## 7. AS 10 PERGUNTAS

Responda cada uma com evidência específica — **arquivo + função/variável + trecho de código
ou dado de teste**. Não é permitido responder em termos gerais sem apontar exatamente onde
no código (PARTES 1-3) ou em qual teste (Seção 5 desta parte) está a evidência.

1. Qual é exatamente o gargalo de estabilidade identificado até agora?
2. É o MediaPipe Hands em si (modelo/configuração)?
3. É a forma como o código calcula o eixo de rotação?
4. É o hold-last-pose?
5. É o smoothing (filtro, janela, parâmetros)?
6. É a transformação de coordenadas 2D → 3D?
7. É o renderizador (`model-viewer` ou equivalente)?
8. Existem referências de coordenadas incompatíveis sendo misturadas (ex: normalized vs.
   pixel, CSS container vs. canvas)?
9. O motor mais novo (`ghost-engine-v1`, `src/engine/`) é estruturalmente melhor que
   tentativas anteriores, ou repete os mesmos problemas?
10. Existe correção possível dentro da arquitetura atual, ou o tracker precisa ser trocado?

---

## 8. REGRA ABSOLUTA para quem for analisar

> Não altere nada, não sugira consertar — apenas diagnostique com evidência: arquivo,
> função, linha. Se algo não puder ser determinado só com código/logs, responda "NÃO
> DETERMINÁVEL — requer teste físico adicional" em vez de especular.

---

*Fim da exportação (PARTE 4 de 4). Esta compilação não contém nenhuma análise, diagnóstico
ou correção — apenas a organização do código-fonte, histórico de commits e evidência de
testes já existentes no repositório, conforme solicitado.*
