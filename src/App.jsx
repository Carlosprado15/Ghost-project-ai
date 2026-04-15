import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import './App.css';

const App = () => {
  const [loading, setLoading] = useState(true);
  const [arActive, setArActive] = useState(false);
  const containerRef = useRef(null);
  const videoRef = useRef(null);

  const modelUrl = "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Watch/glTF-Binary/Watch.glb";

  // Iniciar Câmera do Celular
  const startCamera = async () => {
    setArActive(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "environment" } 
      });
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      console.error("Erro ao acessar câmera:", err);
      alert("Por favor, permita o acesso à câmera.");
    }
  };

  useEffect(() => {
    if (!arActive) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    containerRef.current.appendChild(renderer.domElement);

    const light = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(light);
    const spotLight = new THREE.PointLight(0xffffff, 2);
    spotLight.position.set(5, 5, 5);
    scene.add(spotLight);

    const loader = new GLTFLoader();
    loader.load(modelUrl, (gltf) => {
      const model = gltf.scene;
      model.position.set(0, -0.5, 0);
      model.scale.set(1.8, 1.8, 1.8);
      scene.add(model);
      setLoading(false);
      
      const animate = () => {
        requestAnimationFrame(animate);
        model.rotation.y += 0.01;
        renderer.render(scene, camera);
      };
      animate();
    });

    camera.position.z = 2;

    return () => {
      renderer.dispose();
      if (containerRef.current) containerRef.current.innerHTML = '';
    };
  }, [arActive]);

  return (
    <div className="gp-main-container">
      {!arActive ? (
        <div className="gp-landing">
          <img src="https://i.ibb.co/JRcfKZhw/1776216880651.jpg" alt="Logo" className="gp-logo-img" />
          <h1 className="gp-title">GHOST PROJECT</h1>
          <p className="gp-subtitle">V 1.0.2 • LUXO AUTOMOTIVO & ACESSÓRIOS</p>
          <button className="gp-btn-primary" onClick={startCamera}>ATIVAR EXPERIÊNCIA</button>
        </div>
      ) : (
        <div className="gp-ar-overlay">
          {loading && <div className="gp-loading">Carregando Relógio...</div>}
          <video ref={videoRef} autoPlay playsInline className="gp-video-feed" />
          <div ref={containerRef} className="gp-canvas-container" />
          <div className="gp-controls">
            <button className="gp-btn-capture" onClick={() => alert("Foto salva!")}>📸</button>
            <button className="gp-btn-exit" onClick={() => window.location.reload()}>SAIR</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
