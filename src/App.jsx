import { useEffect, useRef, useState } from "react";

// VERSAO_CONTROLE: 2.0_GHOST_FINAL
const GHOST_CONFIG = {
  BRAND: "GHOST PROJECT",
  LOGO: "https://i.postimg.cc/RVQVdBx3/1776216880651.jpg",
  MODEL: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Watch/glTF-Binary/Watch.glb"
};

export default function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [status, setStatus] = useState("init"); 
  const [isFront, setIsFront] = useState(false);

  const engineBoot = () => {
    return new Promise((res) => {
      if (window.THREE) return res();
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
      s.onload = () => {
        const l = document.createElement("script");
        l.src = "https://cdn.jsdelivr.net/gh/mrdoob/three.js@r128/examples/js/loaders/GLTFLoader.js";
        l.onload = res;
        document.body.appendChild(l);
      };
      document.body.appendChild(s);
    });
  };

  const runAR = async () => {
    setStatus("loading");
    await engineBoot();
    try {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: isFront ? "user" : "environment" }
      });
      streamRef.current = s;
      videoRef.current.srcObject = s;
      setStatus("active");
      setTimeout(() => start3D(), 200);
    } catch (e) {
      alert("Câmera bloqueada.");
      setStatus("init");
    }
  };

  const start3D = () => {
    const T = window.THREE;
    const r = new T.WebGLRenderer({ canvas: canvasRef.current, alpha: true, antialias: true });
    r.setSize(window.innerWidth, window.innerHeight);
    const scene = new T.Scene();
    const cam = new T.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    cam.position.z = 2;
    scene.add(new T.AmbientLight(0xffffff, 1.5));
    new T.GLTFLoader().load(GHOST_CONFIG.MODEL, (gltf) => {
      const m = gltf.scene;
      m.scale.set(1.5, 1.5, 1.5);
      scene.add(m);
      const anim = () => { requestAnimationFrame(anim); m.rotation.y += 0.01; r.render(scene, cam); };
      anim();
    });
  };

  return (
    <div className="ghost-main">
      <video ref={videoRef} className="layer-v" autoPlay playsInline muted />
      <canvas ref={canvasRef} className="layer-c" />
      <div className="layer-ui">
        <img src={GHOST_CONFIG.LOGO} className="logo-fixed" alt="GHOST" />
        {status === "init" && (
          <div className="center-box">
            <h1 className="gold-t">{GHOST_CONFIG.BRAND}</h1>
            <button className="gold-b" onClick={runAR}>INICIAR AR</button>
            <button className="link-b" onClick={() => setIsFront(!isFront)}>
               {isFront ? "CÂMERA TRASEIRA" : "CÂMERA FRONTAL"}
            </button>
          </div>
        )}
        {status === "loading" && <div className="loader">SINCRONIZANDO...</div>}
        {status === "active" && <button className="sw-b" onClick={runAR}>🔄</button>}
      </div>
    </div>
  );
}
