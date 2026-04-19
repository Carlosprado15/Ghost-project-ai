import React, { useEffect, useRef, useState } from "react";

export default function App() {
  const [session, setSession] = useState(false);
  const [error, setError] = useState(null);
  const canvasRef = useRef(null);

  const styles = {
    wrapper: { width: '100vw', height: '100vh', backgroundColor: '#07090D', margin: 0, padding: 0, overflow: 'hidden', position: 'relative' },
    overlay: {
      position: 'absolute', inset: 0, zIndex: 100,
      backgroundImage: "linear-gradient(to bottom, rgba(0,0,0,0.5), #000), url('/ghost.jpeg')",
      backgroundSize: 'cover', backgroundPosition: 'center',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px'
    },
    logo: { width: '140px', marginBottom: '20px', opacity: 1, display: 'block' },
    title: { fontSize: '28px', color: '#FFF', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '4px', fontWeight: '800', margin: '10px 0' },
    subtitle: { fontSize: '11px', color: '#C9A84C', letterSpacing: '2px', marginBottom: '40px', textAlign: 'center' },
    btn: {
      width: '280px', height: '65px', background: 'linear-gradient(135deg, #C9A84C 0%, #A07020 100%)',
      border: 'none', borderRadius: '15px', color: '#000', fontWeight: 'bold', cursor: 'pointer',
      textTransform: 'uppercase', letterSpacing: '2px', boxShadow: '0 10px 25px rgba(201,168,76,0.5)'
    },
    canvas: { position: 'fixed', inset: 0, zIndex: 50, display: 'block' },
    errorMsg: { position: 'fixed', bottom: 20, color: 'red', zIndex: 200, width: '100%', textAlign: 'center', fontSize: '10px' }
  };

  useEffect(() => {
    if (!session) return;

    let renderer, scene, camera, model, frameId;

    const startAR = async () => {
      try {
        const THREE = await import('https://cdn.skypack.dev/three@0.128.0');
        const { GLTFLoader } = await import('https://cdn.skypack.dev/three@0.128.0/examples/jsm/loaders/GLTFLoader.js');

        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 1000);
        
        renderer = new THREE.WebGLRenderer({ canvas: canvasRef.current, antialias: true, alpha: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        const video = document.createElement('video');
        video.srcObject = stream;
        video.setAttribute('playsinline', 'true');
        await video.play();
        scene.background = new THREE.VideoTexture(video);

        scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 2));
        
        new GLTFLoader().load('/relogio.glb', (gltf) => {
          model = gltf.scene;
          model.scale.set(0.3, 0.3, 0.3);
          model.position.set(0, -0.2, -1);
          scene.add(model);
        }, undefined, (e) => setError("Erro ao carregar modelo .glb"));

        const animate = () => {
          if (model) model.rotation.y += 0.01;
          renderer.render(scene, camera);
          frameId = requestAnimationFrame(animate);
        };
        animate();
        camera.position.z = 0.5;

      } catch (err) {
        setError("Câmera não autorizada ou erro no motor 3D.");
      }
    };

    startAR();
    return () => {
      cancelAnimationFrame(frameId);
      if (renderer) renderer.dispose();
    };
  }, [session]);

  return (
    <div style={styles.wrapper}>
      {!session ? (
        <div style={styles.overlay}>
          {/* Fallback caso a imagem falhe: o texto continuará visível */}
          <img src="/logo.png" style={styles.logo} alt="LOGO" onError={(e) => e.target.style.display='none'} />
          <h1 style={styles.title}>Try Before You Buy</h1>
          <p style={styles.subtitle}>Ghost Project AI - Luxury AR</p>
          <button style={styles.btn} onClick={() => setSession(true)}>
            Iniciar Scanner AR
          </button>
        </div>
      ) : (
        <canvas ref={canvasRef} style={styles.canvas} />
      )}
      {error && <div style={styles.errorMsg}>{error}</div>}
    </div>
  );
}
