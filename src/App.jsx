import React, { useEffect, useRef, useState } from "react";

export default function App() {
  const [session, setSession] = useState(false);
  const canvasRef = useRef(null);

  // 1. FIX: Estilos com Opacidade 1 por padrão para evitar que fiquem invisíveis
  const UI_STYLES = {
    overlay: {
      position: 'fixed',
      inset: 0,
      backgroundColor: '#07090D',
      backgroundImage: "linear-gradient(to bottom, rgba(0,0,0,0.3), rgba(0,0,0,0.9)), url('/ghost.jpeg')",
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100,
      padding: '20px'
    },
    logo: {
      width: 'min(50vw, 180px)',
      marginBottom: '20px',
      opacity: 1, // Garantindo visibilidade
      filter: 'drop-shadow(0 0 15px rgba(201,168,76,0.3))',
      animation: 'fadeUp 0.8s ease forwards'
    },
    title: {
      fontSize: 'clamp(24px, 8vw, 42px)',
      fontWeight: '300',
      fontFamily: "'Cormorant Garamond', serif",
      color: '#FFFFFF',
      textAlign: 'center',
      textTransform: 'uppercase',
      letterSpacing: '6px',
      margin: '0',
      opacity: 1, // Garantindo visibilidade
      animation: 'fadeUp 0.8s ease 0.1s both'
    },
    subtitle: {
      fontSize: '10px',
      color: '#C9A84C',
      textAlign: 'center',
      letterSpacing: '4px',
      textTransform: 'uppercase',
      marginTop: '15px',
      marginBottom: '45px',
      opacity: 1, // Garantindo visibilidade
      animation: 'fadeUp 0.8s ease 0.2s both'
    },
    button: {
      width: '100%',
      max_width: '300px',
      height: '65px',
      background: 'linear-gradient(135deg, #C9A84C 0%, #A07020 100%)',
      border: 'none',
      borderRadius: '15px',
      color: '#07090D',
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: '2px',
      cursor: 'pointer',
      boxShadow: '0 10px 30px rgba(201, 168, 76, 0.4)',
      opacity: 1
    }
  };

  useEffect(() => {
    if (!session) return;

    const initAR = async () => {
      const THREE = await import('https://cdn.skypack.dev/three@0.128.0');
      const { GLTFLoader } = await import('https://cdn.skypack.dev/three@0.128.0/examples/jsm/loaders/GLTFLoader.js');

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 1000);
      const renderer = new THREE.WebGLRenderer({ canvas: canvasRef.current, antialias: true, alpha: true });
      renderer.setSize(window.innerWidth, window.innerHeight);

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        const video = document.createElement('video');
        video.srcObject = stream;
        video.play();
        scene.background = new THREE.VideoTexture(video);
      } catch (e) { console.error("Erro na câmera"); }

      scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 2));
      
      new GLTFLoader().load('/relogio.glb', (gltf) => {
        const model = gltf.scene;
        model.traverse(n => {
          if(n.isMesh) n.material = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0.2 });
        });
        model.scale.set(0.3, 0.3, 0.3);
        model.position.set(0, -0.2, -1);
        scene.add(model);
        const anim = () => { requestAnimationFrame(anim); model.rotation.y += 0.01; renderer.render(scene, camera); };
        anim();
      });
      camera.position.z = 0.5;
    };
    initAR();
  }, [session]);

  return (
    <div style={{ width: '100vw', height: '100vh', backgroundColor: '#000', overflow: 'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300&family=Montserrat:wght@400;800&display=swap');
        @keyframes fadeUp {
          from { transform: translateY(25px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>

      {!session ? (
        <div style={UI_STYLES.overlay}>
          {/* Logo - Certifique-se que o arquivo existe em /public/logo.png */}
          <img src="/logo.png" style={UI_STYLES.logo} alt="Logo" />
          
          <h1 style={UI_STYLES.title}>Try Before<br/>You Buy</h1>
          <p style={UI_STYLES.subtitle}>Augmented Reality Experience</p>
          
          <button style={UI_STYLES.button} onClick={() => setSession(true)}>
            Iniciar Scanner AR
          </button>
        </div>
      ) : (
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
      )}
    </div>
  );
}
