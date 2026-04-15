import { useEffect, useRef, useState, useCallback } from "react";

/**
 * PROTOCOLO GHOST PROJECT - VERSÃO FINAL UNIFICADA
 * Este código substitui todas as versões anteriores e corrige erros de:
 * 1. Nome (Trava em GHOST PROJECT)
 * 2. Logo (Carrega a URL oficial)
 * 3. Câmeras (Frontal e Traseira sincronizadas)
 * 4. 3D (Carrega Relógio Real via CDN)
 */

const CONFIG = {
  NAME: "GHOST PROJECT",
  LOGO_URL: "https://i.postimg.cc/RVQVdBx3/1776216880651.jpg",
  MODEL_URL: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Watch/glTF-Binary/Watch.glb",
  THEME_GOLD: "#d4af37"
};

export default function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  
  const [phase, setPhase] = useState("idle"); // idle, loading, ar
  const [cameraMode, setCameraMode] = useState("environment");

  // Injeção limpa de scripts para evitar conflitos de versões passadas
  const bootEngine = () => {
    return new Promise((resolve) => {
      if (window.THREE && window.THREE.GLTFLoader) return resolve();
      
      const threeScript = document.createElement("script");
      threeScript.src = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
      threeScript.onload = () => {
        const loaderScript = document.createElement("script");
        loaderScript.src = "https://cdn.jsdelivr.net/gh/mrdoob/three.js@r128/examples/js/loaders/GLTFLoader.js";
        loaderScript.onload = resolve;
        document.body.appendChild(loaderScript);
      };
      document.body.appendChild(threeScript);
    });
  };

  const startExperience = async () => {
    setPhase("loading");
    await bootEngine();
    
    try {
      // Limpa qualquer stream de câmera anterior para não travar
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: cameraMode, width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      
      // Pequeno delay para garantir que o vídeo carregou antes do 3D
      videoRef.current.onloadedmetadata = () => {
        setPhase("ar");
        setTimeout(() => initThreeScene(), 200);
      };
    } catch (err) {
      console.error("Erro de câmera:", err);
      alert("Por favor, ative a permissão de câmera para o GHOST PROJECT.");
      setPhase("idle");
    }
  };

  const initThreeScene = () => {
    if (!canvasRef.current || !window.THREE) return;

    const THREE = window.THREE;
    const renderer = new THREE.WebGLRenderer({ 
      canvas: canvasRef.current, 
      alpha: true, 
      antialias: true 
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 2.5;

    // Iluminação Profissional para Realçar o Dourado
    scene.add(new THREE.AmbientLight(0xffffff, 1.5));
    const pointLight = new THREE.PointLight(0xffffff, 1);
    pointLight.position.set(5, 5, 5);
    scene.add(pointLight);

    const loader = new THREE.GLTFLoader();
    loader.load(CONFIG.MODEL_URL, (gltf) => {
      const model = gltf.scene;
      model.scale.set(1.8, 1.8, 1.8);
      model.position.y = -0.3;
      scene.add(model);

      const animate = () => {
        requestAnimationFrame(animate);
        model.rotation.y += 0.01;
        renderer.render(scene, camera);
      };
      animate();
    }, undefined, (error) => console.error("Erro ao carregar modelo 3D:", error));
  };

  const handleCameraSwitch = () => {
    setCameraMode(prev => prev === "environment" ? "user" : "environment");
    if (phase === "ar") startExperience();
  };

  return (
    <div className="ghost-app">
      <video ref={videoRef} className="camera-feed" autoPlay playsInline muted />
      <canvas ref={canvasRef} className="ar-canvas" />

      <div className="ui-overlay">
        <img src={CONFIG.LOGO_URL} alt="Logo GHOST PROJECT" className="ui-logo" />

        {phase === "idle" && (
          <div className="ui-screen">
            <h1 className="ui-brand">{CONFIG.NAME}</h1>
            <p className="ui-tag">Luxury AR Experience</p>
            <button className="ui-btn-gold" onClick={startExperience}>INICIAR PROJETO</button>
            <button className="ui-btn-text" onClick={handleCameraSwitch}>
              USAR CÂMERA {cameraMode === "environment" ? "FRONTAL" : "TRASEIRA"}
            </button>
          </div>
        )}

        {phase === "loading" && (
          <div className="ui-screen">
            <div className="ui-spinner"></div>
            <p className="ui-loading-msg">CARREGANDO GHOST PROJECT...</p>
          </div>
        )}

        {phase === "ar" && (
          <button className="ui-btn-cam-switch" onClick={handleCameraSwitch}>🔄</button>
        )}
      </div>
    </div>
  );
}
