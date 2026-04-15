import { useEffect, useRef, useState } from "react";

const SETTINGS = {
  BRAND: "GHOST PROJECT",
  LOGO: "https://i.postimg.cc/RVQVdBx3/1776216880651.jpg",
  // Relógio de Ouro Profissional via CDN estável
  MODEL: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Watch/glTF-Binary/Watch.glb"
};

export default function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [phase, setPhase] = useState("idle"); 
  const [cameraMode, setCameraMode] = useState("environment");

  const loadEngine = () => {
    return new Promise((resolve) => {
      if (window.THREE && window.THREE.GLTFLoader) return resolve();
      const s1 = document.createElement("script");
      s1.src = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
      s1.onload = () => {
        const s2 = document.createElement("script");
        s2.src = "https://cdn.jsdelivr.net/gh/mrdoob/three.js@r128/examples/js/loaders/GLTFLoader.js";
        s2.onload = resolve;
        document.body.appendChild(s2);
      };
      document.body.appendChild(s1);
    });
  };

  const initAR = async () => {
    setPhase("loading");
    await loadEngine();
    try {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: cameraMode }
      });
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      setPhase("ar");
      setTimeout(() => start3D(), 150);
    } catch (e) {
      alert("Erro na câmera. Verifique as permissões.");
      setPhase("idle");
    }
  };

  const start3D = () => {
    const THREE = window.THREE;
    const renderer = new THREE.WebGLRenderer({ canvas: canvasRef.current, alpha: true, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 2;

    scene.add(new THREE.AmbientLight(0xffffff, 1.5));
    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(5, 5, 5);
    scene.add(light);

    new THREE.GLTFLoader().load(SETTINGS.MODEL, (gltf) => {
      const model = gltf.scene;
      model.scale.set(1.5, 1.5, 1.5);
      scene.add(model);
      const animate = () => {
        requestAnimationFrame(animate);
        model.rotation.y += 0.01;
        renderer.render(scene, camera);
      };
      animate();
    });
  };

  return (
    <div className="main-wrapper">
      <video ref={videoRef} className="camera-layer" autoPlay playsInline muted />
      <canvas ref={canvasRef} className="ar-layer" />

      <div className="ui-layer">
        <div className="header">
          <img src={SETTINGS.LOGO} alt="Logo" className="logo-img" />
        </div>

        {phase === "idle" && (
          <div className="hero">
            <h1 className="title">{SETTINGS.BRAND}</h1>
            <p className="subtitle">Luxury Retail Experience</p>
            <button className="gold-button" onClick={initAR}>INICIAR EXPERIÊNCIA</button>
            <button className="text-link" onClick={() => setCameraMode(c => c === "environment" ? "user" : "environment")}>
              ALTERNAR PARA CÂMERA {cameraMode === "environment" ? "FRONTAL" : "TRASEIRA"}
            </button>
          </div>
        )}

        {phase === "loading" && (
          <div className="hero">
            <div className="loader-ring"></div>
            <p>CONECTANDO AO GHOST PROJECT...</p>
          </div>
        )}

        {phase === "ar" && (
          <button className="cam-toggle" onClick={initAR}>🔄</button>
        )}
      </div>
    </div>
  );
}
