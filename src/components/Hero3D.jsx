import { useRef, useCallback, useEffect, useState } from 'react';
import './Hero3D.css';

/*
 * Hero3D — Product Preview 360°
 *
 * Props:
 *   modelSrc      {string}  — URL do arquivo GLB. Padrão: '/relogio.glb'
 *   productImage  {string}  — URL de imagem fallback quando não há GLB
 *   productName   {string}  — Nome do produto (acessibilidade + futuro catálogo)
 *
 * Extensões futuras (sem alterar a interface atual):
 *   productId, catalogProvider ('meshy' | 'tripo' | 'local'), onProductChange
 */
export default function Hero3D({
  modelSrc = '/relogio.glb',
  productImage,
  productName,
}) {
  const mvRef = useRef(null);
  const isPaused = useRef(false);
  const resumeTimer = useRef(null);
  const [modelLoaded, setModelLoaded] = useState(false);

  /* ── Pause auto-rotate ─────────────────────────────────────────────────── */
  const pauseRotation = useCallback(() => {
    if (mvRef.current && !isPaused.current) {
      mvRef.current.removeAttribute('auto-rotate');
      isPaused.current = true;
    }
  }, []);

  /* ── Resume auto-rotate ────────────────────────────────────────────────── */
  const resumeRotation = useCallback(() => {
    if (mvRef.current && isPaused.current) {
      mvRef.current.setAttribute('auto-rotate', '');
      isPaused.current = false;
    }
  }, []);

  /* ── Touch: pause then auto-resume after 1.5s ─────────────────────────── */
  const handleTouchStart = useCallback(() => {
    clearTimeout(resumeTimer.current);
    pauseRotation();
  }, [pauseRotation]);

  const handleTouchEnd = useCallback(() => {
    resumeTimer.current = setTimeout(resumeRotation, 1500);
  }, [resumeRotation]);

  /* ── Cleanup timer on unmount ──────────────────────────────────────────── */
  useEffect(() => () => clearTimeout(resumeTimer.current), []);

  /* ── Fade in model after GLB finishes loading ──────────────────────────── */
  useEffect(() => {
    const mv = mvRef.current;
    if (!mv) return;
    const onLoad = () => setModelLoaded(true);
    mv.addEventListener('load', onLoad);
    return () => mv.removeEventListener('load', onLoad);
  }, []);

  const hasModel = Boolean(modelSrc);

  return (
    <div className="hero3d-wrapper">
      <p className="hero3d-label">VISUALIZE PRODUCT IN 3D</p>

      <div
        className="hero3d-stage"
        onMouseEnter={pauseRotation}
        onMouseLeave={resumeRotation}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        role="img"
        aria-label={productName ? `Preview 3D: ${productName}` : 'Preview 3D do produto'}
      >
        {/* Rotating circular arrow ring */}
        <div className="hero3d-ring-orbit" aria-hidden="true">
          <svg
            className="hero3d-svg"
            viewBox="0 0 200 200"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <marker
                id="hero3dArrowHead"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#d4af37" />
              </marker>
            </defs>

            {/* Glow layer */}
            <path
              d="M 183.7,114.8 A 85,85 0 1,1 183.7,85.2"
              fill="none"
              stroke="#d4af37"
              strokeWidth="7"
              opacity="0.08"
              strokeLinecap="round"
            />

            {/* Main arc with arrowhead */}
            <path
              d="M 183.7,114.8 A 85,85 0 1,1 183.7,85.2"
              fill="none"
              stroke="#d4af37"
              strokeWidth="1.5"
              opacity="0.80"
              strokeLinecap="round"
              markerEnd="url(#hero3dArrowHead)"
            />
          </svg>
        </div>

        {/* Product preview ─────────────────────────────────────────────── */}
        <div className="hero3d-model-wrap">
          {hasModel && !modelLoaded && (
            <div className="hero3d-loader" aria-hidden="true">
              <div className="hero3d-loader-ring" />
            </div>
          )}
          {hasModel ? (
            /* GLB via model-viewer — premium product visualizer */
            <model-viewer
              ref={mvRef}
              src={modelSrc}
              auto-rotate
              auto-rotate-delay="1800"
              camera-controls
              rotation-per-second="9deg"
              interaction-prompt="none"
              disable-zoom
              environment-image="neutral"
              shadow-intensity="0.9"
              shadow-softness="1"
              exposure="1.2"
              camera-orbit="12deg 72deg auto"
              field-of-view="28deg"
              min-camera-orbit="auto 25deg auto"
              max-camera-orbit="auto 155deg auto"
              style={{
                width: '100%',
                height: '100%',
                background: 'transparent',
                opacity: modelLoaded ? 1 : 0,
                transition: 'opacity 0.9s cubic-bezier(0.4,0,0.2,1)',
              }}
            />
          ) : productImage ? (
            /* Fallback: product image with simulated 3D rotation */
            <div className="hero3d-img-fallback">
              <img
                src={productImage}
                alt={productName || 'Produto'}
                className="hero3d-product-img"
              />
            </div>
          ) : (
            /* Last resort: animated placeholder */
            <div className="hero3d-placeholder" aria-hidden="true" />
          )}
        </div>

        {/* 3D golden badge */}
        <div className="hero3d-badge" aria-hidden="true">3D</div>
      </div>
    </div>
  );
}
