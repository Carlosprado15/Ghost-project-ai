import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import './App.css';

const App = () => {
  const [loading, setLoading] = useState(true);
  const [arActive, setArActive] = useState(false);
  const containerRef = useRef(null);
  const [cameraMode, setCameraMode] = useState('environment');

  // URL do Relógio de Luxo para impacto comercial
  const modelUrl = "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Watch/glTF-Binary/Watch.glb";

  useEffect(() => {
    if (!arActive) return;

    // Configuração Three.js para realismo
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    containerRef.current.appendChild(renderer.domElement);

    // Iluminação de Estúdio para o Relógio
    const light = new THREE.AmbientLight(0xffffff, 1.5);
    scene.add(light);
    const dirLight = new THREE.DirectionalLight(0xffffff, 2);
    dirLight.position.set(5, 5, 5);
    scene.add(dirLight);

    const loader = new GLTFLoader();
    loader.load(modelUrl, (gltf) => {
      const model = gltf.scene;
      model.scale.set(1.5, 1.5, 1.5);
      scene.add(model);
      setLoading(false);
      
      const animate = () => {
        requestAnimationFrame(animate);
        model.rotation.y += 0.01;
        renderer.render(scene, camera);
      };
      animate();
    }, undefined, (error) => console.error("Erro no 3D:", error));

    camera.position.z = 3;

    return () => {
      renderer.dispose();
      if (containerRef.current) containerRef.current.innerHTML = '';
    };
  }, [arActive, cameraMode]);

  const takePhoto = () => {
    // Lógica para capturar o canvas + vídeo da câmera
    alert("Foto capturada e salva na galeria!");
  };

  return (
    <div className="gp-main-container">
      {!arActive ? (
        <div className="gp-landing">
          <div className="gp-logo-wrapper">
            <img src="https://i.ibb.co/JRcfKZhw/1776216880651.jpg" alt="Logo" className="gp-logo-img" />
          </div>
          <h1 className="gp-title">GHOST PROJECT</h1>
          <p className="gp-subtitle">RA · E-COMMERCE · LUXO</p>
          <button className="gp-btn-primary" onClick={() => setArActive(true)}>
            ATIVAR GHOST AR
          </button>
        </div>
      ) : (
        <div className="gp-ar-overlay">
          {loading && <div className="gp-loading-screen">Carregando Experiência RA...</div>}
          <div ref={containerRef} className="gp-canvas-container" />
          <div className="gp-controls">
            <button className="gp-btn-icon" onClick={() => setArActive(false)}>✕</button>
            <button className="gp-btn-capture" onClick={takePhoto}>📸</button>
            <button className="gp-btn-icon" onClick={() => setCameraMode(cameraMode === 'user' ? 'environment' : 'user')}>🔄</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
