```jsx
import React, { useState, useRef, useEffect } from 'react';
import * as THREE from 'three';
import './App.css';

// Logo SVG
const LogoFantasma = () => (
  <svg width="80" height="80" viewBox="0 0 100 100">
    <path d="M50 10L15 85H85L50 10Z" stroke="#d4af37" strokeWidth="2" fill="none"/>
    <circle cx="50" cy="55" r="15" stroke="#d4af37" strokeWidth="1" fill="none"/>
  </svg>
);

function App() {
  const [started, setStarted] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const rendererRef = useRef(null);
  const animationRef = useRef(null);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }
      });

      videoRef.current.srcObject = stream;
      setStarted(true);
      initThree();
    } catch (err) {
      console.error("Erro câmera:", err);
    }
  };

  const initThree = () => {
    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(
      70,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.z = 2;

    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      alpha: true
    });

    renderer.setSize(window.innerWidth, window.innerHeight);
    rendererRef.current = renderer;

    // Luz
    const light = new THREE.AmbientLight(0xffffff, 1);
    scene.add(light);

    const goldLight = new THREE.PointLight(0xd4af37, 1);
    goldLight.position.set(2, 2, 2);
    scene.add(goldLight);

    // 🔥 OBJETO SIMPLES (estável pra MVP)
    const geometry = new THREE.BoxGeometry();
    const material = new THREE.MeshStandardMaterial({
      color: 0xd4af37,
      metalness: 0.8,
      roughness: 0.2
    });

    const cube = new THREE.Mesh(geometry, material);
    scene.add(cube);

    const animate = () => {
      animationRef.current = requestAnimationFrame(animate);

      cube.rotation.y += 0.01;
      cube.rotation.x += 0.005;

      renderer.render(scene, camera);
    };

    animate();

    // Resize
    window.addEventListener('resize', () => {
      renderer.setSize(window.innerWidth, window.innerHeight);
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
    });
  };

  // Cleanup
  useEffect(() => {
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);

      if (rendererRef.current) {
        rendererRef.current.dispose();
      }

      if (videoRef.current && videoRef.current.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return (
    <div className="app-container">
      {!started ? (
        <div className="idle-screen">
          <LogoFantasma />
          <h1 className="gold-text">GHOST PROJECT</h1>
          <p className="subtitle">High-End Augmented Reality</p>
          <button className="start-btn" onClick={startCamera}>
            INICIAR EXPERIÊNCIA
          </button>
        </div>
      ) : (
        <div className="ar-viewport">
          <video ref={videoRef} autoPlay playsInline className="camera-feed" />
          <canvas ref={canvasRef} className="three-canvas" />
          <div className="ui-overlay">
            <LogoFantasma />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
```
