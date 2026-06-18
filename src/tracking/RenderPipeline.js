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
