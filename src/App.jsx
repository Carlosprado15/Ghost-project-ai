import { useEffect, useRef, useState } from "react";

// Mudança de nomes de classes para forçar a limpeza de cache do navegador
const CSS_V3 = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body, html, #root { 
    width: 100vw; height: 100vh; 
    overflow: hidden; 
    background-color: #000 !important; 
    font-family: 'Montserrat', sans-serif;
  }
  
  .ghost-main-wrapper {
    position: relative;
    width: 100%;
    height: 100%;
    background: #000;
  }

  .ghost-interface-v3 {
    position: absolute;
    inset: 0;
    background: url('/ghost.jpeg') no-repeat center top;
    background-size: cover;
    z-index: 999; 
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-end;
    padding-bottom: 100px;
  }

  .btn-ar-v3 {
    width: 80%;
    max-width: 300px;
    height: 65px;
    background: linear-gradient(135deg, #C9A84C 0%, #A07020 100%);
    border: none;
    border-radius: 50px;
    color: #07090D;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 2px;
    cursor: pointer;
    box-shadow: 0 15px 35px rgba(201, 168, 76, 0.5);
    transition: transform 0.2s;
  }
  
  .btn-ar-v3:active { transform: scale(0.95); }

  .ar-screen-v3 {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 10;
    display: none;
  }
`;

export default function App() {
  const [isReady, setIsReady] = useState(false);
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!isReady) return;

    const startARSession = async () => {
      const THREE = await import('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.js');
      const { GLTFLoader } = await import('https://cdn.skypack.dev/three@0.128.0/examples/jsm/loaders/GLTFLoader.js');

      const scene = new THREE.Scene();
      
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: "environment" }, 
          audio: false 
        });
        
        const vid = document.createElement('video');
        vid.srcObject = stream;
        vid.setAttribute('playsinline', 'true');
        vid.play();
        
        scene.background = new THREE.VideoTexture(vid);

        const cam = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 1000);
        const renderer = new THREE.WebGLRenderer({ canvas: canvasRef.current, antialias: true, alpha: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(window.devicePixelRatio);

        scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.8));
        const l = new THREE.DirectionalLight(0xffffff, 1);
        l.position.set(5, 5, 5);
        scene.add(l);

        new GLTFLoader().load('/relogio.glb', (gltf) => {
          const model = gltf.scene;
          model.traverse(n => {
            if(n.isMesh) {
              n.material = new THREE.MeshStandardMaterial({
                color: 0xffffff, metalness: 1.0, roughness: 0.15
              });
            }
          });

          // Escala de Pulso Realista
          model.scale.set(0.3, 0.3, 0.3); 
          model.position.set(0, -0.2, -1); 
          scene.add(model);

          const loop = () => {
            requestAnimationFrame(loop);
            model.rotation.y += 0.01;
            renderer.render(scene, cam);
          };
          loop();
        });

        cam.position.z = 0.5;
      } catch (e) {
        alert("Erro na câmera: " + e);
      }
    };

    startARSession();
  }, [isReady]);

  return (
    <div className="ghost-main-wrapper">
      <style>{CSS_V3}</style>
      
      {!isReady && (
        <div className="ghost-interface-v3">
          <button className="btn-ar-v3" onClick={() => setIsReady(true)}>
            Iniciar Scanner AR
          </button>
        </div>
      )}

      <canvas 
        ref={canvasRef} 
        className="ar-screen-v3" 
        style={{ display: isReady ? 'block' : 'none' }} 
      />
    </div>
  );
}
