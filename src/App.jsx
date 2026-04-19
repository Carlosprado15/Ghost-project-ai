import { useEffect, useRef, useState } from "react";

/* ─────────────────────────────────────────────────────────────────────────
   GHOST PROJECT AI — ARQUITETURA TÉCNICA (MODO ARQUITETO)
   Foco: WebAR + Material Override (Aço Escovado) + Background UI
───────────────────────────────────────────────────────────────────────── */

const CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body, html, #root { 
    width: 100%; height: 100%; 
    overflow: hidden; 
    background-color: #07090D;
    font-family: 'Montserrat', sans-serif;
  }
  .ghost-ui {
    position: fixed;
    inset: 0;
    background-image: url('/ghost.jpeg');
    background-size: cover;
    background-position: center top;
    z-index: 10;
    pointer-events: none; /* Deixa os cliques passarem para os botões abaixo */
  }
  .controls-container {
    position: absolute;
    bottom: 10%;
    left: 50%;
    transform: translateX(-50%);
    width: 90%;
    max-width: 320px;
    z-index: 20;
    display: flex;
    flex-direction: column;
    gap: 15px;
  }
  .btn-ar {
    padding: 18px;
    border-radius: 12px;
    border: 1px solid rgba(201, 168, 76, 0.5);
    background: linear-gradient(135deg, #C9A84C 0%, #A07020 100%);
    color: #07090D;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 2px;
    cursor: pointer;
    box-shadow: 0 0 20px rgba(201, 168, 76, 0.3);
  }
`;

export default function App() {
  const [arActive, setArActive] = useState(false);
  const canvasRef = useRef(null);
  const modelRef = useRef(null);

  useEffect(() => {
    if (!arActive) return;

    // Injeção dinâmica do Three.js e GLTFLoader
    const initThree = async () => {
      const THREE = await import('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.js');
      const { GLTFLoader } = await import('https://cdn.skypack.dev/three@0.128.0/examples/jsm/loaders/GLTFLoader.js');

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
      const renderer = new THREE.WebGLRenderer({ canvas: canvasRef.current, alpha: true, antialias: true });
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.2;

      // Iluminação de Estúdio para Metal (Aço reage a isso)
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
      scene.add(ambientLight);

      const spotLight = new THREE.SpotLight(0xffffff, 2);
      spotLight.position.set(5, 10, 5);
      scene.add(spotLight);

      // Material de AÇO ESCOVADO (Lógica solicitada)
      const steelMaterial = new THREE.MeshStandardMaterial({
        color: 0xcccccc,      // Prata Metálico Vibrante
        metalness: 1.0,       // Metal Total
        roughness: 0.2,       // Brilho Acetinado/Escovado
      });

      // Carregamento do Modelo com Override
      const loader = new GLTFLoader();
      loader.load('/relogio.glb', (gltf) => {
        const model = gltf.scene;
        
        model.traverse((child) => {
          if (child.isMesh) {
            // Aplica o material de aço em todas as partes do relógio
            child.material = steelMaterial;
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        model.scale.set(1.5, 1.5, 1.5);
        scene.add(model);
        modelRef.current = model;
      });

      camera.position.z = 3;

      const animate = () => {
        requestAnimationFrame(animate);
        if (modelRef.current) modelRef.current.rotation.y += 0.01;
        renderer.render(scene, camera);
      };
      animate();
    };

    initThree();
  }, [arActive]);

  return (
    <>
      <style>{CSS}</style>
      
      {/* Interface baseada na ghost.jpeg */}
      <div className="ghost-ui" />

      {!arActive ? (
        <div className="controls-container">
          <button className="btn-ar" onClick={() => setArActive(true)}>
            Iniciar Scanner AR
          </button>
        </div>
      ) : (
        <canvas ref={canvasRef} style={{ position: 'fixed', top: 0, left: 0, zIndex: 5 }} />
      )}
    </>
  );
}
