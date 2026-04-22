import { useState, useRef, useEffect } from 'react';
import './App.css';

function useModelViewer() {
  useEffect(() => {
    if (document.querySelector('script[data-mv]')) return;
    const s = document.createElement('script');
    s.type = 'module';
    s.setAttribute('data-mv', '1');
    s.src = 'https://ajax.googleapis.com/ajax/libs/model-viewer/3.4.0/model-viewer.min.js';
    document.head.appendChild(s);
  }, []);
}

/* Three.js watch renderer — replaces model-viewer in scanner */
function useThreeWatch(canvasRef, active) {
  useEffect(() => {
    if (!active || !canvasRef.current) return;

    let raf;
    const canvas = canvasRef.current;

    function loadScript(src) {
      return new Promise((res, rej) => {
        if (document.querySelector('script[src="' + src + '"]')) { res(); return; }
        const s = document.createElement('script');
        s.src = src;
        s.onload = res;
        s.onerror = rej;
        document.head.appendChild(s);
      });
    }

    async function init() {
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js');
      await loadScript('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js');

      const T = window.THREE;

      const w = canvas.clientWidth  || window.innerWidth;
      const h = canvas.clientHeight || window.innerHeight;

      const renderer = new T.WebGLRenderer({ canvas, alpha: true, antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(w, h);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = T.PCFSoftShadowMap;
      renderer.toneMapping = T.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.1;

      const scene  = new T.Scene();
      const camera = new T.PerspectiveCamera(45, w / h, 0.01, 100);
      camera.position.set(0, 0, 1.4);

      /* Lighting — unchanged from reference */
      scene.add(new T.AmbientLight(0xffffff, 0.6));
      const dir = new T.DirectionalLight(0xffffff, 1.2);
      dir.position.set(2, 4, 3);
      dir.castShadow = true;
      scene.add(dir);
      const fill = new T.DirectionalLight(0xffffff, 0.4);
      fill.position.set(-2, -1, 2);
      scene.add(fill);

      /* Load model */
      const loader = new T.GLTFLoader();
      loader.load('/relogio.glb', (gltf) => {
        const wg = gltf.scene;

        /* ── REFERENCE IMAGE VALUES ────────────────────────────
           scale:      0.28  (range 0.25–0.35, proportional)
           position.x: 0     (centered)
           position.y: -0.22 (slightly down on wrist)
           position.z: 0
           rotation.x: -0.2  (natural slight tilt)
           rotation.y: 0
        ─────────────────────────────────────────────────────── */
        wg.scale.setScalar(0.28);
        wg.position.set(0, -0.22, 0);
        wg.rotation.x = -0.2;
        wg.rotation.y = 0;

        wg.traverse(c => {
          if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; }
        });

        scene.add(wg);

        /* Stable render loop — NO floating/oscillation animation */
        function loop() {
          raf = requestAnimationFrame(loop);
          renderer.render(scene, camera);
        }
        loop();
      });

      /* Resize */
      function onResize() {
        const nw = canvas.clientWidth  || window.innerWidth;
        const nh = canvas.clientHeight || window.innerHeight;
        camera.aspect = nw / nh;
        camera.updateProjectionMatrix();
        renderer.setSize(nw, nh);
      }
      window.addEventListener('resize', onResize);
      return () => window.removeEventListener('resize', onResize);
    }

    let cleanup;
    init().then(fn => { cleanup = fn; });

    return () => {
      cancelAnimationFrame(raf);
      if (cleanup) cleanup();
    };
  }, [active, canvasRef]);
}

export default function App() {
  const [screen, setScreen]     = useState('home');
  const [camMode, setCamMode]   = useState('environment');
  const [camError, setCamError] = useState('');
  const [showBuy, setShowBuy]   = useState(false);
  const videoRef  = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const buyTimer  = useRef(null);

  useModelViewer();
  useThreeWatch(canvasRef, screen === 'scanner');

  const openScanner = () => {
    setCamError('');
    setShowBuy(false);
    setScreen('scanner');
  };

  useEffect(() => {
    if (screen !== 'scanner') return;

    let active = true;

    navigator.mediaDevices.getUserMedia({
      video: { facingMode: camMode, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    }).then(stream => {
      if (!active) { stream.getTracks().forEach(t => t.stop()); return; }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
      buyTimer.current = setTimeout(() => { if (active) setShowBuy(true); }, 5000);
    }).catch(() => {
      if (active) {
        setCamError('Camera unavailable.');
        setScreen('home');
      }
    });

    return () => {
      active = false;
      clearTimeout(buyTimer.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [screen, camMode]);

  const closeScanner = () => {
    clearTimeout(buyTimer.current);
    setShowBuy(false);
    setScreen('home');
  };

  if (screen === 'home') {
    return (
      <div className="home">
        <div className="home-tagline">
          <p>Try Before You Buy</p>
        </div>
        <div className="home-buttons">
          <div className="cam-selector">
            <button
              className={camMode === 'environment' ? 'cam-btn active' : 'cam-btn'}
              onClick={() => setCamMode('environment')}
            >
              📷 Câmera Traseira
            </button>
            <button
              className={camMode === 'user' ? 'cam-btn active' : 'cam-btn'}
              onClick={() => setCamMode('user')}
            >
              🤳 Câmera Frontal
            </button>
          </div>
          {camError && <p className="cam-error">{camError}</p>}
          <button className="scan-btn" onClick={openScanner}>
            INICIAR LEITOR DE RA
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="scanner">
      <video ref={videoRef} autoPlay playsInline muted className="video-feed" />

      {/* Three.js canvas — watch rendered with exact wg values */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          zIndex: 4,
          pointerEvents: 'none',
        }}
      />

      <div className="scan-line-overlay">
        <div className="scan-line-bar" />
      </div>

      <div className="scan-corners">
        <div className="sc tl" />
        <div className="sc tr" />
        <div className="sc bl" />
        <div className="sc br" />
      </div>

      {showBuy && (
        <div className="watch-overlay" style={{ pointerEvents: 'all' }}>
          <div className="action-buttons">
            <button className="action-btn">Buy Now</button>
            <button className="action-btn">View Details</button>
          </div>
        </div>
      )}

      <div className="hud-top">
        <button className="back-btn" onClick={closeScanner}>← Back</button>
        <div className="ar-badge">
          <span className="ar-dot" />
          AR ACTIVE
        </div>
      </div>
    </div>
  );
}
