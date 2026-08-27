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
