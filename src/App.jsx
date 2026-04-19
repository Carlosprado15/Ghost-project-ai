import { useEffect, useRef, useState } from "react";

const CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body, html, #root { width: 100%; height: 100%; overflow: hidden; background: #000; }
  
  .ghost-container {
    position: fixed; inset: 0;
    background: url('/ghost.jpeg') no-repeat center top;
    background-size: cover;
    display: flex; flex-direction: column; align-items: center; justify-content: flex-end;
    padding-bottom: 60px; z-index: 10;
  }

  .btn-ar {
    width: 320px; height: 65px;
    background: linear-gradient(135deg, #C9A84C 0%, #A07020 100%);
    border: none; border-radius: 15px;
    color: #07090D; font-family: 'Montserrat', sans-serif;
    font-weight: 700; text-transform: uppercase; letter-spacing: 2px;
    box-shadow: 0 10px 30px rgba(201, 168, 76, 0.3); cursor: pointer;
  }

  .ar-canvas { position: fixed; inset: 0; z-index: 5; }
`;

export default function App() {
  const [arActive, setArActive] = useState(false);
  const canvasRef = useRef(null);
  const videoRef = useRef(null);

  useEffect(() => {
    if (!arActive) return;

    const startScene = async () => {
      const THREE = await import('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.js');
      const { GLTFLoader } = await import('https://cdn.skypack.dev/three@0.128.0/examples/jsm/loaders/GLTFLoader.js');

      // 1. ACESSAR CÂMERA DO CELULAR
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "environment" }, 
        audio: false 
      });
      
      const video = document.createElement('video');
      video.srcObject = stream;
      video.play();

      const scene = new THREE.Scene();
      
      // 2. COLOCAR VÍDEO NO FUNDO DO THREE.JS
      const videoTexture = new THREE.VideoTexture(video);
      scene.background = videoTexture;

      const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
      const renderer = new THREE.WebGLRenderer({ canvas: canvasRef.current, antialias: true });
      renderer.setSize(window.innerWidth, window.innerHeight);

      // Iluminação para o Aço Brilhar
      scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.5));
      const light = new THREE.DirectionalLight(0xffffff, 1);
      light.position.set(0, 1, 1);
      scene.add(light);

      const loader = new GLTFLoader();
      loader.load('/relogio.glb', (gltf) => {
        const model = gltf.scene;
        model.traverse(n => {
          if(n.isMesh) {
            n.material = new THREE.MeshStandardMaterial({
              color: 0xffffff, metalness: 1.0, roughness: 0.2
            });
          }
        });
        model.position.set(0, 0, -2); // Posiciona à frente da câmera
        scene.add(model);

        const anim = () => {
          requestAnimationFrame(anim);
          model.rotation.y += 0.01;
          renderer.render(scene, camera);
        };
        anim();
      });
      
      camera.position.z = 1;
    };

    startScene();
  }, [arActive]);

  return (
    <>
      <style>{CSS}</style>
      
      {!arActive && (
        <div className="ghost-container">
          <button className="btn-ar" onClick={() => setArActive(true)}>
            Iniciar Scanner AR
          </button>
        </div>
      )}
      
      <canvas ref={canvasRef} className="ar-canvas" />
    </>
  );
}
