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
