import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";

export default function App() {
const videoRef = useRef(null);
const canvasRef = useRef(null);

const [screen, setScreen] = useState("splash");
const [cameraMode, setCameraMode] = useState("environment");

useEffect(() => {
const t = setTimeout(() => setScreen("home"), 1800);
return () => clearTimeout(t);
}, []);

useEffect(() => {
if (screen !== "ar") return;

```
let scene, camera, renderer, watch;
let animationId;

const init = async () => {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: cameraMode },
    audio: false,
  });

  videoRef.current.srcObject = stream;
  await videoRef.current.play();

  scene = new THREE.Scene();

  const videoTexture = new THREE.VideoTexture(videoRef.current);
  videoTexture.colorSpace = THREE.SRGBColorSpace;
  scene.background = videoTexture;

  camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.01,
    100
  );
  camera.position.set(0, 0, 1.5);

  renderer = new THREE.WebGLRenderer({
    canvas: canvasRef.current,
    alpha: true,
    antialias: true,
  });

  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;

  const light = new THREE.DirectionalLight(0xffffff, 2);
  light.position.set(2, 4, 2);
  light.castShadow = true;
  scene.add(light);

  const shadowMat = new THREE.ShadowMaterial({ opacity: 0.25 });
  const shadowGeo = new THREE.PlaneGeometry(2, 2);
  const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
  shadowMesh.rotation.x = -Math.PI / 2;
  shadowMesh.position.y = -0.3;
  shadowMesh.receiveShadow = true;
  scene.add(shadowMesh);

  const loader = new THREE.ObjectLoader();

  const gltfLoaderScript = document.createElement("script");
  gltfLoaderScript.src =
    "https://cdn.jsdelivr.net/npm/three@0.158.0/examples/js/loaders/GLTFLoader.js";

  gltfLoaderScript.onload = () => {
    const loader = new window.THREE.GLTFLoader();

    loader.load("/relogio.glb", (gltf) => {
      watch = gltf.scene;

      watch.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      watch.scale.set(0.4, 0.4, 0.4);
      watch.position.set(0, -0.1, 0);

      scene.add(watch);
    });
  };

  document.body.appendChild(gltfLoaderScript);

  const animate = () => {
    animationId = requestAnimationFrame(animate);

    if (watch) {
      watch.rotation.y += 0.003;
      watch.position.y =
        Math.sin(Date.now() * 0.001) * 0.01 - 0.1;
    }

    renderer.render(scene, camera);
  };

  animate();
};

init();

return () => cancelAnimationFrame(animationId);
```

}, [screen, cameraMode]);

if (screen === "splash") {
return ( <div style={styles.splash}> <img src="/logo.png" style={styles.logo} /> </div>
);
}

if (screen === "home") {
return ( <div style={styles.home}> <img src="/logo.png" style={styles.logoTop} /> <h1 style={styles.title}>Try Before You Buy</h1> <p style={styles.subtitle}>
Visualize produtos em escala real usando sua câmera </p>

```
    <div style={styles.cameraSelector}>
      <button
        style={styles.button}
        onClick={() => setCameraMode("environment")}
      >
        📷 Traseira
      </button>
      <button
        style={styles.button}
        onClick={() => setCameraMode("user")}
      >
        🤳 Frontal
      </button>
    </div>

    <button
      style={styles.mainButton}
      onClick={() => setScreen("ar")}
    >
      Iniciar Scanner AR
    </button>
  </div>
);
```

}

if (screen === "ar") {
return ( <div style={styles.arContainer}> <video ref={videoRef} style={styles.video} /> <canvas ref={canvasRef} style={styles.canvas} /> </div>
);
}
}

const styles = {
splash: {
background: "#07090D",
height: "100vh",
display: "flex",
justifyContent: "center",
alignItems: "center",
},
logo: {
width: 120,
},
home: {
background: "#07090D",
color: "#F0EDE8",
height: "100vh",
display: "flex",
flexDirection: "column",
alignItems: "center",
justifyContent: "center",
},
logoTop: {
width: 90,
marginBottom: 20,
},
title: {
fontSize: 28,
},
subtitle: {
fontSize: 14,
opacity: 0.7,
marginBottom: 20,
},
cameraSelector: {
display: "flex",
gap: 10,
marginBottom: 20,
},
button: {
padding: "10px 16px",
borderRadius: 20,
border: "1px solid #C9A84C",
background: "transparent",
color: "#F0EDE8",
},
mainButton: {
padding: "14px 24px",
borderRadius: 30,
background: "#C9A84C",
border: "none",
color: "#07090D",
fontWeight: "bold",
},
arContainer: {
position: "relative",
width: "100vw",
height: "100vh",
},
video: {
position: "absolute",
width: "100%",
height: "100%",
objectFit: "cover",
},
canvas: {
position: "absolute",
width: "100%",
height: "100%",
},
};
