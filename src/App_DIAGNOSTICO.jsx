import { useState, useRef, useEffect, useCallback } from 'react';
import './App.css';

// ─── CDN loaders ──────────────────────────────────────────────────────────────
function loadScript(src, id) {
  return new Promise((resolve, reject) => {
    if (document.getElementById(id)) {
      resolve();
      return;
    }
    const s = document.createElement('script');
    s.src = src;
    s.id = id;
    s.crossOrigin = 'anonymous';
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

async function loadMediaPipe() {
  await loadScript(
    'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js',
    'mp-cu'
  );
  await loadScript(
    'https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js',
    'mp-du'
  );
  await loadScript(
    'https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js',
    'mp-h'
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DIAGNÓSTICO VISUAL CONTROLADO
// Objetivo: validar se o tracking do pulso existe
// ═══════════════════════════════════════════════════════════════════════════════

// Conversão de coordenadas MediaPipe → viewport
function landmarkToViewport(norm, videoEl, mirrorX) {
  const iW = videoEl.videoWidth || 1280;
  const iH = videoEl.videoHeight || 720;
  const r = videoEl.getBoundingClientRect();

  const scale = Math.max(r.width / iW, r.height / iH);
  const dW = iW * scale;
  const dH = iH * scale;
  const ox = (r.width - dW) / 2;
  const oy = (r.height - dH) / 2;

  let x = norm.x * dW + ox + r.left;
  const y = norm.y * dH + oy + r.top;

  if (mirrorX) {
    x = r.right - (norm.x * dW + ox);
  }

  return { x, y };
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState('home');
  const [camMode, setCamMode] = useState('environment');
  const [camError, setCamError] = useState('');
  const [tracking, setTracking] = useState(false);

  // Estado do círculo verde - SEM SMOOTHING
  const [wristCircle, setWristCircle] = useState({ x: 0, y: 0, visible: false });

  // Debug info EXTENSIVO
  const [debugInfo, setDebugInfo] = useState({
    callbackCount: 0,
    hasLandmarks: false,
    landmarkCount: 0,
    wristX: 0,
    wristY: 0,
    wristNormX: 0,
    wristNormY: 0,
  });

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const handsRef = useRef(null);
  const cameraRef = useRef(null);
  const activeRef = useRef(false);
  const callbackCountRef = useRef(0);

  const openScanner = () => {
    console.log('[DEBUG] Abrindo scanner');
    setCamError('');
    setTracking(false);
    setScreen('scanner');
  };

  // ── MediaPipe callback COM DIAGNÓSTICO ────────────────────────────────────
  const onHandsResults = useCallback(
    (results) => {
      callbackCountRef.current += 1;
      
      // Log detalhado a cada 30 frames
      if (callbackCountRef.current % 30 === 0) {
        console.log('[DIAGNÓSTICO] Callback #', callbackCountRef.current, {
          hasResults: !!results,
          hasMultiHandLandmarks: !!results?.multiHandLandmarks,
          landmarksLength: results?.multiHandLandmarks?.length || 0,
          videoElement: {
            readyState: videoRef.current?.readyState,
            videoWidth: videoRef.current?.videoWidth,
            videoHeight: videoRef.current?.videoHeight,
          }
        });
      }

      if (!activeRef.current || !videoRef.current) {
        console.log('[DIAGNÓSTICO] activeRef ou videoRef inválido');
        return;
      }

      if (!results.multiHandLandmarks?.length) {
        setTracking(false);
        setWristCircle({ x: 0, y: 0, visible: false });
        setDebugInfo({
          callbackCount: callbackCountRef.current,
          hasLandmarks: false,
          landmarkCount: 0,
          wristX: 0,
          wristY: 0,
          wristNormX: 0,
          wristNormY: 0,
        });
        return;
      }

      const lm = results.multiHandLandmarks[0];
      const mirror = camMode === 'user';
      const vid = videoRef.current;

      console.log('[DIAGNÓSTICO] LANDMARKS DETECTADOS:', {
        count: lm.length,
        wristNorm: { x: lm[0].x, y: lm[0].y, z: lm[0].z },
      });

      // Converter landmark 0 (wrist) para coordenadas de tela
      const wristPx = landmarkToViewport(lm[0], vid, mirror);

      console.log('[DIAGNÓSTICO] Wrist convertido:', {
        px: wristPx,
        videoRect: vid.getBoundingClientRect(),
      });

      // ATUALIZAÇÃO DIRETA - SEM SMOOTHING
      setWristCircle({
        x: wristPx.x,
        y: wristPx.y,
        visible: true,
      });

      setDebugInfo({
        callbackCount: callbackCountRef.current,
        hasLandmarks: true,
        landmarkCount: lm.length,
        wristX: Math.round(wristPx.x),
        wristY: Math.round(wristPx.y),
        wristNormX: lm[0].x.toFixed(3),
        wristNormY: lm[0].y.toFixed(3),
      });

      setTracking(true);
    },
    [camMode]
  );

  // ── Camera + MediaPipe start ──────────────────────────────────────────────
  useEffect(() => {
    if (screen !== 'scanner') return;
    activeRef.current = true;
    callbackCountRef.current = 0;

    (async () => {
      try {
        console.log('[DEBUG] Carregando MediaPipe...');
        await loadMediaPipe();
        if (!activeRef.current) return;

        console.log('[DEBUG] Criando detector Hands...');
        const hands = new window.Hands({
          locateFile: (f) =>
            `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`,
        });
        
        console.log('[DEBUG] Configurando opções do Hands...');
        hands.setOptions({
          maxNumHands: 1,
          modelComplexity: 0, // REDUZIDO: 0 = mais rápido, menos preciso
          minDetectionConfidence: 0.3, // REDUZIDO: mais sensível
          minTrackingConfidence: 0.3, // REDUZIDO: mais sensível
        });
        
        console.log('[DEBUG] Conectando callback onResults...');
        hands.onResults(onHandsResults);
        handsRef.current = hands;

        // AGUARDAR modelo carregar
        console.log('[DEBUG] Aguardando modelo MediaPipe carregar...');
        await new Promise(resolve => setTimeout(resolve, 1000));

        console.log('[DEBUG] Iniciando câmera...');
        const camera = new window.Camera(videoRef.current, {
          onFrame: async () => {
            if (handsRef.current && videoRef.current) {
              // Validar vídeo antes de enviar
              const vid = videoRef.current;
              if (vid.readyState === vid.HAVE_ENOUGH_DATA) {
                await handsRef.current.send({ image: vid });
              }
            }
          },
          facingMode: camMode,
          width: 640, // REDUZIDO: melhor performance
          height: 480, // REDUZIDO: melhor performance
        });
        await camera.start();
        cameraRef.current = camera;
        console.log('[DEBUG] Câmera iniciada - readyState:', videoRef.current?.readyState);

        if (videoRef.current?.srcObject) {
          streamRef.current = videoRef.current.srcObject;
        }
      } catch (err) {
        console.error('[DEBUG] ERRO:', err);
        if (activeRef.current) {
          const msg = err?.message ?? String(err);
          setCamError(`Câmera indisponível: ${msg}`);
          setScreen('home');
        }
      }
    })();

    return () => {
      console.log('[DEBUG] Cleanup');
      activeRef.current = false;
      cameraRef.current?.stop();
      cameraRef.current = null;
      handsRef.current?.close();
      handsRef.current = null;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [screen, camMode, onHandsResults]);

  const closeScanner = () => {
    activeRef.current = false;
    setTracking(false);
    setScreen('home');
  };

  // ── HOME ──────────────────────────────────────────────────────────────────
  if (screen === 'home') {
    return (
      <div className="home">
        <div
          className="home-background"
          style={{ backgroundImage: 'url("/logo.jpeg")' }}
        />
        <div className="home-content">
          <div className="home-tagline">
            <p>Diagnóstico Visual Controlado</p>
          </div>
          <div className="home-buttons">
            <div className="cam-selector">
              <button
                className={
                  camMode === 'environment' ? 'cam-btn active' : 'cam-btn'
                }
                onClick={() => setCamMode('environment')}
              >
                Câmera Traseira
              </button>
              <button
                className={camMode === 'user' ? 'cam-btn active' : 'cam-btn'}
                onClick={() => setCamMode('user')}
              >
                Câmera Frontal
              </button>
            </div>
            {camError && <p className="cam-error">{camError}</p>}
            <button className="scan-btn" onClick={openScanner}>
              INICIAR DIAGNÓSTICO
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── SCANNER - DIAGNÓSTICO VISUAL ──────────────────────────────────────────
  
  // Estilo do círculo verde - SIMPLES, SEM SMOOTHING
  const wristCircleStyle = {
    position: 'fixed',
    left: `${wristCircle.x}px`,
    top: `${wristCircle.y}px`,
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    backgroundColor: '#00ff00',
    border: '3px solid #ffffff',
    transform: 'translate(-50%, -50%)',
    pointerEvents: 'none',
    zIndex: 20,
    display: wristCircle.visible ? 'block' : 'none',
    boxShadow: '0 0 20px rgba(0, 255, 0, 0.8)',
  };

  return (
    <div className="scanner">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="video-feed"
        style={camMode === 'user' ? { transform: 'scaleX(-1)' } : {}}
      />

      {/* Círculo verde de diagnóstico - APENAS LANDMARK 0 */}
      <div style={wristCircleStyle} />

      {/* Painel de diagnóstico EXTENSIVO */}
      <div
        style={{
          position: 'fixed',
          top: 60,
          left: 10,
          right: 10,
          background: 'rgba(0,0,0,0.95)',
          color: '#00ff00',
          padding: '16px',
          fontFamily: 'monospace',
          fontSize: 12,
          zIndex: 100,
          borderRadius: 8,
          border: '3px solid #00ff00',
          maxWidth: 450,
        }}
      >
        <div
          style={{
            fontWeight: 'bold',
            color: '#ffff00',
            marginBottom: 10,
            fontSize: 14,
          }}
        >
          🔬 DIAGNÓSTICO VISUAL CONTROLADO
        </div>
        
        <div style={{ color: '#0ff', marginBottom: 8 }}>
          Callbacks MediaPipe: <span style={{ color: '#fff' }}>{debugInfo.callbackCount}</span>
        </div>
        
        <div style={{ color: debugInfo.hasLandmarks ? '#0f0' : '#f00', fontWeight: 'bold' }}>
          Landmarks Detectados: {debugInfo.hasLandmarks ? 'SIM ✓' : 'NÃO ✗'}
        </div>
        
        {debugInfo.hasLandmarks && (
          <>
            <div style={{ color: '#0ff' }}>
              Total Landmarks: <span style={{ color: '#fff' }}>{debugInfo.landmarkCount}</span>
            </div>
            
            <div
              style={{ marginTop: 8, borderTop: '1px solid #333', paddingTop: 8 }}
            >
              <div style={{ color: '#0f0', fontWeight: 'bold', marginBottom: 4 }}>
                🟢 WRIST (Landmark 0):
              </div>
              <div>
                Normalizado X: <span style={{ color: '#fff' }}>{debugInfo.wristNormX}</span>
              </div>
              <div>
                Normalizado Y: <span style={{ color: '#fff' }}>{debugInfo.wristNormY}</span>
              </div>
              <div style={{ marginTop: 4 }}>
                Tela X: <span style={{ color: '#fff' }}>{debugInfo.wristX}px</span>
              </div>
              <div>
                Tela Y: <span style={{ color: '#fff' }}>{debugInfo.wristY}px</span>
              </div>
            </div>
          </>
        )}
        
        <div style={{ marginTop: 10, fontSize: 10, color: '#888' }}>
          🟢 Círculo Verde: {wristCircle.visible ? 'VISÍVEL' : 'OCULTO'}
        </div>
        
        <div style={{ marginTop: 8, fontSize: 10, color: '#888', borderTop: '1px solid #333', paddingTop: 8 }}>
          ⚠️ Relógio DESABILITADO para diagnóstico<br/>
          ⚠️ SEM smoothing - tracking puro<br/>
          ⚠️ Abra o console (F12) para logs detalhados
        </div>
      </div>

      {/* Overlay amarelo - PRESERVADO */}
      <div className="scan-overlay">
        <div className="scan-line-bar" />
        <div className="scan-corners">
          <div className="corner tl" />
          <div className="corner tr" />
          <div className="corner bl" />
          <div className="corner br" />
        </div>
      </div>

      <div className="hud-top">
        <button className="back-btn" onClick={closeScanner}>
          ← Voltar
        </button>
        <div className="ar-badge">
          <span className={`ar-dot ${tracking ? 'active' : ''}`} />
          {tracking ? 'TRACKING DETECTADO' : 'AGUARDANDO MÃO'}
        </div>
      </div>

      {!tracking && (
        <div className="tracking-hint">
          <p>APONTE PARA O SEU PULSO</p>
          <p style={{ fontSize: '14px', marginTop: '8px' }}>
            (Modo diagnóstico - apenas círculo verde)
          </p>
        </div>
      )}
    </div>
  );
}
