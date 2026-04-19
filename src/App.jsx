import { useEffect, useRef, useState } from "react";

const CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body, html, #root { 
    width: 100%; height: 100%; 
    overflow: hidden; 
    background-color: #000; 
    font-family: 'Montserrat', sans-serif;
  }
  
  .app-container {
    position: relative;
    width: 100%;
    height: 100%;
  }

  .ghost-ui-overlay {
    position: absolute;
    inset: 0;
    background: url('/ghost.jpeg') no-repeat center top;
    background-size: cover;
    z-index: 10;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-end;
    padding-bottom: 80px;
  }

  .btn-ar {
    width: 85%;
    max-width: 320px;
    height: 60px;
    background: linear-gradient(135deg, #C9A84C 0%, #A07020 100%);
    border: none;
    border-radius: 12px;
    color: #07090D;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 2px;
    cursor: pointer;
    box-shadow: 0 8px 25px rgba(201, 168, 76, 0.4);
  }

  .ar-canvas {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 5;
  }
`;

export default function App() {
  const [arActive, setArActive] = useState(false);
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!arActive) return;

    const startAR = async () => {
      const THREE = await import('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.js');
      const { GLTFLoader } = await import('https://cdn.skypack.dev/three@0.128.0/examples/jsm/loaders/GLTFLoader.js');

      const scene = new THREE.Scene();
      
      // Ativação da Câmera
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "environment" }, 
        audio: false 
      });
      const video = document.createElement('video');
      video.srcObject = stream;
      video.play();
      
      const videoTexture = new THREE.VideoTexture(video);
      scene.background = videoTexture;

      const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 1000);
      const renderer = new THREE.WebGLRenderer({ canvas: canvasRef.current, antialias: true, alpha: true });
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(window.devicePixelRatio);

      // Iluminação para o Aço Escovado
      const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.2);
      scene.add(hemiLight);
      const light = new THREE.DirectionalLight(0xffffff, 0.8);
      light.position.set(0, 5, 5);
      scene.add(light);

      const loader = new GLTFLoader();
      loader.load('/relogio.glb', (gltf) => {
        const model = gltf.scene;
        
        model.traverse(n => {
          if(n.isMesh) {
            n.material = new THREE.MeshStandardMaterial({
              color: 0xffffff,
              metalness: 1.0,
              roughness: 0.2
            });
          }
        });

        // AJUSTE DE ESCALA: Reduzi para 0.4 para não ficar enorme
        model.scale.set(0.4, 0.4, 0.4); 
        model.position.set(0, -0.2, -1); // Um pouco abaixo e à frente
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

    startAR();
  }, [arActive]);

  return (
    <div className="app-container">
      <style>{CSS}</style>
      
      {!arActive && (
        <div className="ghost-ui-overlay">
          {/* A imagem ghost.jpeg agora é o fundo aqui */}
          <button className="btn-ar" onClick={() => setArActive(true)}>
            Iniciar Scanner AR
          </button>
        </div>
      )}

      <canvas ref={canvasRef} className="ar-canvas" style={{ display: arActive ? 'block' : 'none' }} />
    </div>
  );
}
