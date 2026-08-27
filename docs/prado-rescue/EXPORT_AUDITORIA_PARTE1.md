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
