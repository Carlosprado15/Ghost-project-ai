import React, { useEffect, useRef, useState } from "react";

export default function App() {
  const [arAtivo, setArAtivo] = useState(false);
  const canvasRef = useRef(null);

  // ESTILOS EM OBJETOS (Evita erros de sintaxe em strings)
  const estilos = {
    container: {
      width: '100vw',
      height: '100vh',
      margin: 0,
      padding: 0,
      overflow: 'hidden',
      backgroundColor: '#000'
    },
    uiOverlay: {
      position: 'fixed',
      inset: 0,
      backgroundColor: '#07090D',
      backgroundImage: "linear-gradient(to bottom, rgba(0,0,0,0.4), #000), url('/ghost.jpeg')",
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'flex-end',
      paddingBottom: '80px',
      zIndex: 100
    },
    botao: {
      width: '280px',
      height: '65px',
      fontSize: '14px',
      fontWeight: '800',
      color: '#07090D',
      background: 'linear-gradient(135deg, #C9A84C 0%, #A07020 100%)',
      border: 'none',
      borderRadius: '15px',
      cursor: 'pointer',
      textTransform: 'uppercase',
      letterSpacing: '2px',
      boxShadow: '0 10px 30px rgba(201, 168, 76, 0.4)'
    }
  };

  useEffect(() => {
    if (!arAtivo) return;

    const iniciarAR = async () => {
      const THREE = await import('https://cdn.skypack.dev/three@0.128.0');
      const { GLTFLoader } = await import('https://cdn.skypack.dev/three@0.128.0/examples/jsm/loaders/GLTFLoader.js');

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 1000);
      const renderer = new THREE.WebGLRenderer({ canvas: canvasRef.current, antialias: true, alpha: true });
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(window.devicePixelRatio);

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        const video = document.createElement('video');
        video.srcObject = stream;
        video.play();
        scene.background = new THREE.VideoTexture(video);
      } catch (e) {
        console.error("Câmera não permitida.");
      }

      scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.5));
      const light = new THREE.DirectionalLight(0xffffff, 1);
      light.position.set(5, 10, 7);
      scene.add(light);

      new GLTFLoader().load('/relogio.glb', (gltf) => {
        const model = gltf.scene;
        model.traverse(n => {
          if (n.isMesh) {
            n.material = new THREE.MeshStandardMaterial({
              color: 0xffffff, metalness: 1.0, roughness: 0.15
            });
          }
        });

        model.scale.set(0.28, 0.28, 0.28); // Escala refinada para o pulso
        model.position.set(0, -0.25, -1);
        scene.add(model);

        const animate = () => {
          requestAnimationFrame(animate);
          model.rotation.y += 0.01;
          renderer.render(scene, camera);
        };
        animate();
      });

      camera.position.z = 0.5;
    };

    iniciarAR();
  }, [arAtivo]);

  return (
    <div style={estilos.container}>
      {!arAtivo ? (
        <div style={estilos.uiOverlay}>
          <button style={estilos.botao} onClick={() => setArAtivo(true)}>
            Iniciar Scanner AR
          </button>
        </div>
      ) : (
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
      )}
    </div>
  );
}
