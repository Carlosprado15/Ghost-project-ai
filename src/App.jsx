import { useState, useRef, useEffect } from "react";
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
const GOLD = "#d4af37";
const DARK = "#06090f";

// LOGO (já preparado pra fundo transparente depois)
const LOGO = "https://i.postimg.cc/RVQVdBx3/1776216880651.jpg";

// RELÓGIO 3D (modelo premium público confiável)
const MODEL = "https://modelviewer.dev/shared-assets/models/Astronaut.glb"; 
// (vamos trocar por relógio real depois — esse é estável pra demo)

export default function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [active, setActive] = useState(false);
  const [facing, setFacing] = useState("environment");

  // CAMERA
  async function startCamera(mode) {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: mode },
      audio: false
    });

    videoRef.current.srcObject = stream;
    videoRef.current.play();
  }

  function stopCamera() {
    const tracks = videoRef.current?.srcObject?.getTracks();
    tracks?.forEach(t => t.stop());
  }

  async function activate() {
    setActive(true);
    await startCamera("environment");
    start3D();
  }

  function deactivate() {
    stopCamera();
    setActive(false);
  }

  async function flipCamera() {
    const newMode = facing === "environment" ? "user" : "environment";
    setFacing(newMode);
    stopCamera();
    await startCamera(newMode);
  }

  // THREE.JS
  function start3D() {
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
    script.onload = () => initScene();
    document.body.appendChild(script);
  }

  function initScene() {
    const THREE = window.THREE;
const loader = new GLTFloader();
   loader.load('/model.glb', function (gltf) {
  console.log('MODEL LOADED');

  const model = gltf.scene;

  model.scale.set(1, 1, 1);
  model.position.set(0, 0, 0);

  scene.add(model);
}, undefined, function (error) {
  console.log('ERROR LOADING MODEL:', error);
});
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.z = 2.5;

    const renderer = new THREE.WebGLRenderer({ canvas: canvasRef.current, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);

    const light = new THREE.PointLight(0xffffff, 1);
    light.position.set(5, 5, 5);
    scene.add(light);

    // const geometry = new THREE.TorusKnotGeometry(0.6, 0.2, 100, 16);
    // const material = new THREE.MeshStandardMaterial({
      // color: 0xd4af37,
      // metalness: 1,
      // roughness: 0.2
    });

     const mesh = new THREE.Mesh(geometry, material);
     scene.add(mesh);

    function animate() {
      requestAnimationFrame(animate);
      mesh.rotation.y += 0.01;
      renderer.render(scene, camera);
    }

    animate();
  }

  return (
    <div className="app">

      {!active && (
        <div className="home">
          <img src={LOGO} className="logo" />
          <h1>GHOST PROJECT</h1>
          <button onClick={activate}>ATIVAR AR</button>
        </div>
      )}

      {active && (
        <div className="ar">
          <video ref={videoRef} className="video" playsInline />
          <canvas ref={canvasRef} className="canvas" />

          <div className="controls">
            <button onClick={deactivate}>✕</button>
            <button onClick={flipCamera}>↺</button>
          </div>
        </div>
      )}

    </div>
  );
}
