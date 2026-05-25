import { useState, useRef, useEffect, useCallback } from 'react';
import './App.css';
import { WristTracker } from './tracking/WristTracker.js';
import { RenderPipeline } from './tracking/RenderPipeline.js';

// ─── CDN loaders ──────────────────────────────────────────────────────────────
function loadScript(src, id) {
  return new Promise((resolve, reject) => {
    if (document.getElementById(id)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src; s.id = id; s.crossOrigin = 'anonymous';
    s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
}

async function loadMediaPipe() {
  await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js', 'mp-cu');
  await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js', 'mp-du');
  await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js', 'mp-h');
}

function useModelViewer() {
  useEffect(() => {
    if (document.querySelector('script[data-mv]')) return;
    const s = document.createElement('script');
    s.type = 'module'; s.setAttribute('data-mv', '1');
    s.src = 'https://ajax.googleapis.com/ajax/libs/model-viewer/3.4.0/model-viewer.min.js';
    document.head.appendChild(s);
  }, []);
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function App() {
  const [screen,   setScreen]   = useState('home');
  const [camMode,  setCamMode]  = useState('environment');
  const [camError, setCamError] = useState('');
  const [showBuy,  setShowBuy]  = useState(false);
  
  // Estado do relógio (atualizado pelo pipeline)
  const [watch, setWatch] = useState({ x: 0, y: 0, size: 0, rotation: 0 });
  
  // Estado de debug profissional
  const [dbg, setDbg] = useState({
    status: 'Aguardando',
    isTracking: false,
    isStable: false,
    confidence: 0,
    fps: 0,
    frames: 0,
    lostFrames: 0,
  });

  // Refs
  const videoRef    = useRef(null);
  const canvasRef   = useRef(null);
  const handsRef    = useRef(null);
  const cameraRef   = useRef(null);
  const streamRef   = useRef(null);
  const buyTimer    = useRef(null);
  const activeRef   = useRef(false);
  
  // Sistema de tracking profissional
  const trackerRef  = useRef(null);
  const pipelineRef = useRef(null);
  const lmRef       = useRef(null);
  const frameCount  = useRef(0);

  useModelViewer();

  const openScanner = () => {
    setCamError(''); 
    setShowBuy(false);
    setScreen('scanner');
  };

  // ── Canvas de debug ───────────────────────────────────────────────────────
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const video  = videoRef.current;
    const lm     = lmRef.current;
    if (!canvas || !video || !lm) return;

    const rect = video.getBoundingClientRect();
    canvas.width  = rect.width;
    canvas.height = rect.height;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const mirror = camMode === 'user';

    // Função helper para converter coordenadas
    const toScreen = (norm) => {
      const MP_W = 1280, MP_H = 720;
      const scale = Math.max(rect.width / MP_W, rect.height / MP_H);
      const dW = MP_W * scale, dH = MP_H * scale;
      const ox = (rect.width - dW) / 2, oy = (rect.height - dH) / 2;
      let x = norm.x * dW + ox + rect.left;
      const y = norm.y * dH + oy + rect.top;
      if (mirror) x = rect.right - (norm.x * dW + ox);
      return { x: x - rect.left, y: y - rect.top };
    };

    // Desenhar landmarks
    lm.forEach((l, i) => {
      const p = toScreen(l);
      ctx.fillStyle = '#00ff00';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5, 0, 2 * Math.PI);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = '9px monospace';
      ctx.fillText(i, p.x + 5, p.y - 3);
    });

    // Desenhar vetor anatômico: wrist(0) → index_mcp(5) → pinky_mcp(17)
    const wrist = toScreen(lm[0]);
    const indexMcp = toScreen(lm[5]);
    const pinkyMcp = toScreen(lm[17]);
    
    // Linha vermelha: pulso → índice
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(wrist.x, wrist.y);
    ctx.lineTo(indexMcp.x, indexMcp.y);
    ctx.stroke();
    
    // Linha amarela: índice → mínimo (largura da palma)
    ctx.strokeStyle = '#ffff00';
    ctx.beginPath();
    ctx.moveTo(indexMcp.x, indexMcp.y);
    ctx.lineTo(pinkyMcp.x, pinkyMcp.y);
    ctx.stroke();
    
    // Círculo azul no pulso
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(wrist.x, wrist.y, 10, 0, 2 * Math.PI);
    ctx.stroke();
  }, [camMode]);

  // ── MediaPipe resultado ───────────────────────────────────────────────────
  const onResults = useCallback((results) => {
    if (!activeRef.current || !videoRef.current || !trackerRef.current) return;

    frameCount.current++;

    // Atualizar landmarks para debug
    if (results.multiHandLandmarks?.length) {
      lmRef.current = results.multiHandLandmarks[0];
    } else {
      lmRef.current = null;
    }

    // Processar tracking
    const rect = videoRef.current.getBoundingClientRect();
    const mirror = camMode === 'user';
    const landmarks = results.multiHandLandmarks?.[0];
    const handedness = results.multiHandedness?.[0];

    const pose = trackerRef.current.update(landmarks, handedness, rect, mirror);
    
    // Atualizar pipeline de renderização
    if (pipelineRef.current && pose) {
      pipelineRef.current.updatePose(pose);
    }

    // Atualizar estado de debug (throttled)
    if (frameCount.current % 10 === 0) {
      const state = trackerRef.current.getState();
      setDbg(prev => ({
        ...prev,
        isTracking: state.isTracking,
        isStable: state.isStable,
        confidence: Math.round(state.confidence * 100),
        frames: state.totalFrames,
        lostFrames: state.lostFrames,
      }));
    }

    // Desenhar canvas de debug
    drawCanvas();
  }, [camMode, drawCanvas]);

  // ── Iniciar câmera + MediaPipe + Tracking ─────────────────────────────────
  useEffect(() => {
    if (screen !== 'scanner') return;
    activeRef.current = true;
    frameCount.current = 0;

    // Inicializar tracker
    trackerRef.current = new WristTracker({
      minConfidence: 0.6,
      minStabilityFrames: 8,
      maxLostFrames: 30,
      positionMinCutoff: 1.2,
      positionBeta: 0.3,
      rotationMinCutoff: 1.0,
      rotationBeta: 0.5,
      scaleMinCutoff: 0.8,
      scaleBeta: 0.1,
      watchSizeMultiplier: 1.5,
      watchOffsetRatio: 0.18,
    });

    // Inicializar pipeline de renderização
    pipelineRef.current = new RenderPipeline();
    
    pipelineRef.current.start(
      // Callback de render - atualiza estado React de forma otimizada
      (pose) => {
        setWatch({
          x: pose.x,
          y: pose.y,
          size: pose.size,
          rotation: pose.rotation,
        });
      },
      // Callback de debug
      (debugInfo) => {
        setDbg(prev => ({
          ...prev,
          fps: debugInfo.fps,
        }));
      }
    );

    (async () => {
      try {
        setDbg(p => ({ ...p, status: 'Carregando MediaPipe...' }));
        await loadMediaPipe();
        if (!activeRef.current) return;

        const hands = new window.Hands({
          locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`,
        });
        hands.setOptions({
          maxNumHands           : 1,
          modelComplexity       : 1,
          minDetectionConfidence: 0.5,
          minTrackingConfidence : 0.5,
        });
        hands.onResults(onResults);
        handsRef.current = hands;

        const camera = new window.Camera(videoRef.current, {
          onFrame: async () => {
            if (!handsRef.current || !videoRef.current || !activeRef.current) return;
            await handsRef.current.send({ image: videoRef.current });
          },
          facingMode: camMode,
          width : 1280,
          height: 720,
        });

        await camera.start();
        cameraRef.current = camera;

        if (videoRef.current?.srcObject) {
          streamRef.current = videoRef.current.srcObject;
        }

        setDbg(p => ({ ...p, status: 'Pronto ✓' }));

        buyTimer.current = setTimeout(() => {
          if (activeRef.current) setShowBuy(true);
        }, 3000);

      } catch (err) {
        if (activeRef.current) {
          const msg = err?.message ?? String(err);
          setDbg(p => ({ ...p, status: `ERRO: ${msg}` }));
          setCamError(`Câmera indisponível: ${msg}`);
          setScreen('home');
        }
      }
    })();

    return () => {
      activeRef.current = false;
      clearTimeout(buyTimer.current);
      
      // Limpar pipeline e tracker
      pipelineRef.current?.stop();
      trackerRef.current?.reset();
      
      cameraRef.current?.stop();
      cameraRef.current = null;
      handsRef.current?.close();
      handsRef.current = null;
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [screen, camMode, onResults]);

  const closeScanner = () => {
    activeRef.current = false;
    clearTimeout(buyTimer.current);
    pipelineRef.current?.stop();
    trackerRef.current?.reset();
    setShowBuy(false);
    setScreen('home');
  };

  // ── HOME ──────────────────────────────────────────────────────────────────
  if (screen === 'home') {
    return (
      <div className="home">
        <div className="home-background" style={{ backgroundImage: 'url("/logo.jpeg")' }} />
        <div className="home-content">
          <div className="home-tagline"><p>Try Before You Buy</p></div>
          <div className="home-buttons">
            <div className="cam-selector">
              <button
                className={camMode === 'environment' ? 'cam-btn active' : 'cam-btn'}
                onClick={() => setCamMode('environment')}
              >Câmera Traseira</button>
              <button
                className={camMode === 'user' ? 'cam-btn active' : 'cam-btn'}
                onClick={() => setCamMode('user')}
              >Câmera Frontal</button>
            </div>
            {camError && <p className="cam-error">{camError}</p>}
            <button className="scan-btn" onClick={openScanner}>
              START AR SCANNER
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── SCANNER ───────────────────────────────────────────────────────────────
  // Renderizar relógio SOMENTE quando estável
  const shouldRenderWatch = trackerRef.current?.shouldRender() ?? false;
  
  const watchStyle = {
    position : 'fixed',
    left     : `${watch.x}px`,
    top      : `${watch.y}px`,
    width    : `${watch.size}px`,
    height   : `${watch.size}px`,
    transform: `translate(-50%, -50%) rotate(${watch.rotation}deg)`,
    pointerEvents: 'none',
    zIndex   : 15,
    // Transição suave de opacidade - NUNCA desaparece instantaneamente
    opacity  : shouldRenderWatch ? 1 : 0,
    transition: 'opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
    filter   : 'drop-shadow(0 8px 24px rgba(0,0,0,0.55))',
  };

  return (
    <div className="scanner">
      <video
        ref={videoRef}
        autoPlay playsInline muted
        className="video-feed"
        style={camMode === 'user' ? { transform: 'scaleX(-1)' } : {}}
      />

      {/* Canvas debug — pontos verdes dos landmarks */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'fixed', top: 0, left: 0,
          width: '100%', height: '100%',
          pointerEvents: 'none', zIndex: 99,
          transform: camMode === 'user' ? 'scaleX(-1)' : 'none',
        }}
      />

      {/* Painel debug PROFISSIONAL */}
      <div style={{
        position: 'fixed', top: 60, left: 10, right: 10,
        background: 'rgba(0,0,0,0.85)', color: '#00ff00',
        padding: '12px 14px', fontFamily: 'monospace', fontSize: 11,
        zIndex: 100, borderRadius: 8, border: '1px solid #00ff00',
        maxWidth: 400,
      }}>
        <div style={{ fontWeight: 'bold', color: '#ffff00', marginBottom: 6, fontSize: 12 }}>
          🎯 TRACKING PROFISSIONAL
        </div>
        <div>Status: <span style={{ color: dbg.status.includes('ERRO') ? '#f55' : '#0f0' }}>{dbg.status}</span></div>
        <div>FPS: <span style={{ color: '#0ff' }}>{dbg.fps}</span></div>
        <div>Frames: <span style={{ color: '#0ff' }}>{dbg.frames}</span></div>
        <div style={{ marginTop: 4, borderTop: '1px solid #333', paddingTop: 4 }}>
          <div>Tracking: <span style={{ color: dbg.isTracking ? '#0f0' : '#f55' }}>
            {dbg.isTracking ? 'ATIVO ✓' : 'INATIVO'}
          </span></div>
          <div>Estável: <span style={{ color: dbg.isStable ? '#0f0' : '#ff0' }}>
            {dbg.isStable ? 'SIM ✓' : 'aguardando...'}
          </span></div>
          <div>Confidence: <span style={{ 
            color: dbg.confidence > 80 ? '#0f0' : dbg.confidence > 60 ? '#ff0' : '#f55' 
          }}>{dbg.confidence}%</span></div>
          {dbg.lostFrames > 0 && (
            <div>Frames perdidos: <span style={{ color: '#f90' }}>{dbg.lostFrames}</span></div>
          )}
        </div>
        <div style={{ marginTop: 6, fontSize: 9, color: '#888' }}>
          One Euro Filter + Persistência Temporal
        </div>
      </div>

      <div className="scan-overlay">
        <div className="scan-line-bar" />
        <div className="scan-corners">
          <div className="corner tl" /><div className="corner tr" />
          <div className="corner bl" /><div className="corner br" />
        </div>
      </div>

      {/* Relógio 3D — renderizado SOMENTE quando estável */}
      <div className="watch-container" style={watchStyle}>
        <model-viewer
          src="/relogio.glb"
          disable-zoom
          shadow-intensity="1"
          exposure="1.2"
          interaction-prompt="none"
          camera-orbit="0deg 75deg 100%"
          field-of-view="30deg"
          min-camera-orbit="auto auto 100%"
          max-camera-orbit="auto auto 100%"
          camera-controls="false"
          style={{ width: '100%', height: '100%', background: 'transparent' }}
        />
      </div>

      <div className="hud-top">
        <button className="back-btn" onClick={closeScanner}>← Voltar</button>
        <div className="ar-badge">
          <span className={`ar-dot ${dbg.isTracking ? 'active' : ''}`} />
          {dbg.isStable ? 'TRACKING ESTÁVEL' : dbg.isTracking ? 'ESTABILIZANDO...' : 'AR ATIVO'}
        </div>
      </div>

      {!dbg.isTracking && (
        <div className="tracking-hint">
          <p>APONTE PARA O SEU PULSO</p>
        </div>
      )}

      <div className="action-container">
        {showBuy && dbg.isStable && (
          <div className="action-buttons">
            <button className="action-btn primary">Comprar Agora</button>
            <button className="action-btn secondary">Ver Detalhes</button>
          </div>
        )}
      </div>
    </div>
  );
}
