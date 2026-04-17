import { useEffect, useRef } from "react";

export default function App() {
  const canvasRef = useRef(null);

  useEffect(() => {
    function start3D() {
      const script = document.createElement("script");
      script.src =
        "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";

      script.onload = () => {
        const loaderScript = document.createElement("script");
        loaderScript.src =
          "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js";

        loaderScript.onload = () => {
          initScene();
        };

        document.body.appendChild(loaderScript);
      };

      document.body.appendChild(script);
    }

    function initScene() {
      const THREE = window.THREE;

      const scene = new THREE.Scene();

      const camera = new THREE.PerspectiveCamera(
        60,
        window.innerWidth / window.innerHeight,
        0.1,
        100
      );
      camera.position.z = 2.5;

      const renderer = new THREE.WebGLRenderer({
        canvas: canvasRef.current,
        alpha: true,
      });
      renderer.setSize(window.innerWidth, window.innerHeight);

      const light = new THREE.PointLight(0xffffff, 1);
      light.position.set(5, 5, 5);
      scene.add(light);
      const geometry = new THREE.BoxGeometry();
const materialTest = new THREE.MeshBasicMaterial({ color: 0xff0000 });
const cube = new THREE.Mesh(geometry, materialTest);
scene.add(cube);
const ambientLight = new THREE.AmbientLight(0xffffff, 1);
scene.add(ambientLight);
      const loader = new THREE.GLTFLoader();

      loader.load(
       "https://modelviewer.dev/shared-assets/models/Astronaut.glb",
        (gltf) => {
          const model = gltf.scene;
          model.scale.set(1, 1, 1);
          model.position.set(0, 0, 0);
          scene.add(model);
        },
        undefined,
        (error) => {
  console.log("ERRO REAL:", error);
  alert("Erro ao carregar modelo");
}
      );

      function animate() {
        requestAnimationFrame(animate);
        renderer.render(scene, camera);
      }

      animate();
    }

    start3D();
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: "100vw",
        height: "100vh",
        display: "block",
      }}
    />
  );
}
