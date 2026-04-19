import React, { useEffect, useRef, useState } from "react";

export default function App() {
  const [session, setSession] = useState(false);
  const canvasRef = useRef(null);

  const styles = {
    wrapper: { 
      width: '100vw', height: '100vh', backgroundColor: '#07090D', 
      margin: 0, padding: 0, overflow: 'hidden', position: 'relative' 
    },
    overlay: {
      position: 'absolute', inset: 0, zIndex: 100,
      // CORREÇÃO AQUI: Alterado para logo.jpeg conforme você indicou
      backgroundImage: "linear-gradient(to bottom, rgba(0,0,0,0.4), #000), url('/logo.jpeg')",
      backgroundSize: 'cover', backgroundPosition: 'center',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px'
    },
    // Se você tiver um arquivo de marca (ícone), pode manter aqui. 
    // Se não tiver, o título abaixo já resolve.
    brandIcon: { width: '120px', marginBottom: '20px', opacity: 1 },
    title: { 
      fontSize: '32px', color: '#FFF', textAlign: 'center', 
      textTransform: 'uppercase', letterSpacing: '4px', fontWeight: '800' 
    },
    subtitle: { 
      fontSize: '12px', color: '#C9A84C', letterSpacing: '2px', 
      marginTop: '10px', marginBottom: '40px' 
    },
    btn: {
      width: '280px', height: '65px', 
      background: 'linear-gradient(135deg, #C9A84C 0%, #A07020 100%)',
      border: 'none', borderRadius: '15px', color: '#000', 
      fontWeight: 'bold', cursor: 'pointer', textTransform: 'uppercase', 
      letterSpacing: '2px', boxShadow: '0 10px 25px rgba(201,168,76,0.5)'
    },
    canvas: { position: 'fixed', inset: 0, zIndex: 50, display: 'block' }
  };

  useEffect(() => {
    if (!session) return;

    const startAR = async () => {
      try {
        const THREE = await import('https://cdn.skypack.dev/three@0.128.0');
        const { GLTFLoader } = await import('https://cdn.skypack.dev/three@0.128.0/examples/jsm/loaders/GLTFLoader.js');

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 1000);
        const renderer = new THREE.WebGLRenderer({ canvas: canvasRef.current, antialias: true, alpha: true });
        renderer.setSize(window.innerWidth, window.innerHeight);

        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        const video = document.createElement('video');
        video.srcObject = stream;
        video.setAttribute('playsinline', 'true');
        video.play();
        scene.background = new THREE.VideoTexture(video);

        scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 2));

        new GLTFLoader().load('/relogio.glb', (gltf) => {
          const model = gltf.scene;
          model.scale.set(0.3, 0.3, 0.3);
          model.position.set(0, -0.2, -1);
          scene.add(model);
          
          const animate = () => {
            requestAnimationFrame(animate);
            model.rotation.y += 0.01;
            renderer.render(scene, camera);
          };
          animate();
        });
        camera.position.z = 0.5;
      } catch (e) { alert("Erro ao acessar câmera."); }
    };
    startAR();
  }, [session]);

  return (
    <div style={styles.wrapper}>
      {!session ? (
        <div style={styles.overlay}>
          <h1 style={styles.title}>Ghost Project</h1>
          <p style={styles.subtitle}>Try Before You Buy</p>
          <button style={styles.btn} onClick={() => setSession(true)}>
            Iniciar Scanner AR
          </button>
        </div>
      ) : (
        <canvas ref={canvasRef} style={styles.canvas} />
      )}
    </div>
  );
}
