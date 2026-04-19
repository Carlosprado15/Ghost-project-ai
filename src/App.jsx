import { useEffect, useRef, useState } from "react";

const CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body, html, #root { 
    width: 100%; height: 100%; 
    overflow: hidden; 
    background-color: #07090D;
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
    z-index: 100; /* Garante que fique acima de tudo no início */
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-end;
    padding-bottom: 80px;
  }

  .btn-ar {
    width: 85%;
    max-width: 320px;
    height: 65px;
    background: linear-gradient(135deg, #C9A84C 0%, #A07020 100%);
    border: none;
    border-radius: 15px;
    color: #07090D;
    font-size: 14px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 2px;
    cursor: pointer;
    box-shadow: 0 10px 30px rgba(201, 168, 76, 0.4);
    pointer-events: auto;
  }

  .ar-canvas {
    position: fixed;
    inset: 0;
    z-index: 10; /* Fica abaixo da interface inicial, mas acima do fundo */
  }
`;

export default function App() {
  const [arActive, setArActive] = useState(false);
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!arActive) return;

    const startAR = async () => {
      // Importações dinâmicas
      const THREE = await import('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.js');
      const { GLTFLoader } = await import('https://cdn.skypack.dev/three@0.128.0/examples/jsm/loaders/GLTFLoader.js');

      const scene = new THREE.Scene();
      
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: "environment" }, 
          audio: false 
        });
        
        const video = document.createElement('video');
        video.srcObject = stream;
        video.setAttribute('playsinline', 'true'); // Necessário para iOS
        video.play();
        
        const videoTexture = new THREE.VideoTexture(video);
        scene.background = videoTexture;

        const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 1000);
        const renderer = new THREE.WebGLRenderer({ canvas: canvasRef.current, antialias: true, alpha: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        // Luzes para o efeito Cromado/Aço
        scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.5));
        const light = new THREE.DirectionalLight(0xffffff, 1);
        light.position.set(5, 5, 5);
        scene.add(light);

        const loader = new GLTFLoader();
        loader.load('/relogio.glb', (gltf) => {
          const model = gltf.scene;
          
          model.traverse(n => {
            if(n.isMesh) {
              n.material = new THREE.MeshStandardMaterial({
                color: 0xffffff,
                metalness: 1.0,
                roughness: 0.18
              });
            }
          });

          // Escala corrigida para ser proporcional ao braço
          model.scale.set(0.35, 0.35, 0.35); 
          model.position.set(0, -0.3, -1.2); 
          scene.add(model);

          const animate = () => {
            requestAnimationFrame(animate);
            model.rotation.y += 0.008;
            renderer.render(scene, camera);
          };
          animate();
        });

        camera.position.z = 0.5;
      } catch (err) {
        console.error("Erro ao acessar câmera:", err);
        alert("Por favor, permita o acesso à câmera.");
      }
    };

    startAR();
  }, [arActive]);

  return (
    <div className="app-container">
      <style>{CSS}</style>
      
      {/* Interface inicial: some quando o AR é ativado */}
      {!arActive && (
        <div className="ghost-ui-overlay">
          <button className="btn-ar" onClick={() => setArActive(true)}>
            Iniciar Scanner AR
          </button>
        </div>
      )}

      {/* Canvas do Three.js: só renderiza se ativo */}
      <canvas 
        ref={canvasRef} 
        className="ar-canvas" 
        style={{ display: arActive ? 'block' : 'none' }} 
      />
    </div>
  );
}
