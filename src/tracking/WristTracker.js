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
      watchRotationOffset: config.watchRotationOffset ?? -90,
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
  update(landmarks, handedness, videoRect, mirrorX = false, frameSize = null) {
    this.state.totalFrames++;
    const timestamp = performance.now();

    if (!landmarks || landmarks.length < 21) {
      return this._handleLostTracking();
    }

    // Extrair landmarks anatômicos corretos
    const wrist     = this._toLandmark(landmarks[0],  videoRect, mirrorX, frameSize);
    const indexMcp  = this._toLandmark(landmarks[5],  videoRect, mirrorX, frameSize);
    const middleMcp = this._toLandmark(landmarks[9],  videoRect, mirrorX, frameSize);
    const pinkyMcp  = this._toLandmark(landmarks[17], videoRect, mirrorX, frameSize);

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
      pinkyMcp,
      mirrorX
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
  _toLandmark(norm, rect, mirrorX, frameSize = null) {
    // Usar dimensões reais do vídeo para mapeamento correto de coordenadas.
    // Fallback para 1280×720 apenas se não disponível.
    const MP_W = frameSize?.width  ?? 1280;
    const MP_H = frameSize?.height ?? 720;
    
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
  _calculateWristGeometry(wrist, indexMcp, middleMcp, pinkyMcp, mirrorX = false) {
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

    // 6. Rotação real do relógio (alinhado com eixo do antebraço)
    // Quando mirrorX=true, forearmDirX foi calculado em coordenadas espelhadas —
    // negamos só para o atan2, mantendo forearmDirX original para o cálculo de posição.
    const rotDirX = mirrorX ? -forearmDirX : forearmDirX;
    const watchRotation = Math.atan2(forearmDirY, rotDirX) * (180 / Math.PI) + this.config.watchRotationOffset;

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