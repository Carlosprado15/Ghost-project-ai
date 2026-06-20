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
