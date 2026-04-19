import React, { useEffect, useRef, useState } from "react";

export default function App() {
  const [arAtivo, setArAtivo] = useState(false);
  const canvasRef = useRef(null);

  // Interface Limpa e Direta
  const uiOverlay = {
    position: 'fixed',
    inset: 0,
    backgroundColor: '#000',
    backgroundImage: "url('/ghost.jpeg')",
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    display: 'flex',
    flexDirection: 'column',
    align-items: 'center',
    justifyContent: 'flex-end',
    paddingBottom: '100px',
    zIndex: 10
  };

  const botaoEstilo = {
    padding: '20px 40px',
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#000',
    background: 'linear-gradient(to right, #C9A84C, #A07020)',
    border: 'none',
    borderRadius: '50px',
    cursor: 'pointer',
    textTransform: 'uppercase'
  };

  useEffect(() => {
    if (!arAtivo) return;

    let scene, camera, renderer, model;

    const carregarAR = async () => {
      const THREE = await import('https://cdn.skypack.dev/three@0.128.0');
      const { GLTFLoader } = await import('https://cdn.skypack.dev/three@0.128.0/examples/jsm/loaders/GLTFLoader.js');

      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
      renderer = new THREE.WebGLRenderer({ canvas: canvasRef.current, antialias: true, alpha: true });
      renderer.setSize(window.innerWidth, window.innerHeight);

      // Ativar Câmera
      const video = document.createElement('video');
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      video.srcObject = stream;
      video.play();
      scene.background = new THREE.VideoTexture(video);

      // Luzes
      scene.add(new THREE.AmbientLight(0xffffff, 1));
      const light = new THREE.DirectionalLight(0xffffff, 1);
      light.position.set(0, 1, 1);
      scene.add(light);

      // Carregar Relógio
      const loader = new GLTFLoader();
      loader.load('/relogio.glb', (gltf) => {
        model = gltf.scene;
        model.scale.set(0.4, 0.4, 0.4);
        model.position.set(0, -0.5, -1.5);
        scene.add(model);
      });

      camera.position.z = 2;

      const animate = () => {
        requestAnimationFrame(animate);
        if (model) model.rotation.y += 0.01;
        renderer.render(scene, camera);
      };
      animate();
    };

    carregarAR();
  }, [arAtivo]);

  return (
    <div style={{ width: '100vw', height: '100vh', margin: 0, padding: 0, overflow: 'hidden' }}>
      {!arAtivo ? (
        <div style={uiOverlay}>
          <button style={botaoEstilo} onClick={() => setArAtivo(true)}>
            Iniciar Scanner AR
          </button>
        </div>
      ) : (
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
      )}
    </div>
  );
}
