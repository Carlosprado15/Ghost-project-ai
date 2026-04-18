import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader";

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

    let scene, camera, renderer, watch;
    let animationId;
    let stream;

    const init = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: cameraMode },
          audio: false,
        });

        videoRef.current.srcObject = stream;
        await videoRef.current.play();

        // Scene
        scene = new THREE.Scene();

        // Camera
        camera = new THREE.PerspectiveCamera(
          60,
          window.innerWidth / window.innerHeight,
          0.01,
          100
        );
        camera.position.set(0, 0, 1.5);

        // Renderer
        renderer = new THREE.WebGLRenderer({
          canvas: canvasRef.current,
          alpha: true,
          antialias: true,
        });

        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.physicallyCorrectLights = true;
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        // Light
        const light = new THREE.DirectionalLight(0xffffff, 2);
        light.position.set(2, 4, 2);
        light.castShadow = true;
        scene.add(light);

        // HDR Environment
        const pmrem = new THREE.PMREMGenerator(renderer);
        new RGBELoader()
          .setPath("/")
          .load("estudio.hdr", (hdr) => {
            const envMap = pmrem.fromEquirectangular(hdr).texture;
            scene.environment = envMap;
            hdr.dispose();
            pmrem.dispose();
          });

        // Shadow plane
        const shadowMat = new THREE.ShadowMaterial({ opacity: 0.25 });
        const shadowGeo = new THREE.PlaneGeometry(5, 5);
        const shadow = new THREE.Mesh(shadowGeo, shadowMat);
        shadow.rotation.x = -Math.PI / 2;
        shadow.position.y = -0.25;
        shadow.receiveShadow = true;
        scene.add(shadow);

        // Load GLB
        const loader = new GLTFLoader();
        loader.load("/relogio.glb", (gltf) => {
          watch = gltf.scene;

          watch.traverse((child) => {
            if (child.isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;

              if (child.material) {
                child.material.metalness = 1;
                child.material.roughness = 0.25;
                child.material.envMapIntensity = 1.5;
              }
            }
          });

          watch.scale.set(0.5, 0.5, 0.5);
          watch.position.set(0, -0.1, 0);

          scene.add(watch);
        });

        // Animate
        const animate = () => {
          animationId = requestAnimationFrame(animate);

          if (watch) {
            watch.rotation.y += 0.003;
            watch.position.y = Math.sin(Date.now() * 0.001) * 0.01 - 0.1;
          }

          renderer.render(scene, camera);
        };

        animate();
      } catch (err) {
        console.error("AR init error:", err);
      }
    };

    init();

    return () => {
      if (animationId) cancelAnimationFrame(animationId);
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, [screen, cameraMode]);

  // SPLASH
  if (screen === "splash") {
    return (
      <div style={styles.splash}>
        <img src="/logo.png" style={styles.logo} />
      </div>
    );
  }

  // HOME
  if (screen === "home") {
    return (
      <div style={styles.home}>
        <img src="/logo.png" style={styles.logoTop} />

        <h1 style={styles.title}>Try Before You Buy</h1>
        <p style={styles.subtitle}>
          Visualize produtos em escala real usando sua câmera
        </p>

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

        <button style={styles.mainButton} onClick={() => setScreen("ar")}>
          Iniciar Scanner AR
        </button>
      </div>
    );
  }

  // AR
  if (screen === "ar") {
    return (
      <div style={styles.arContainer}>
        <video ref={videoRef} style={styles.video} playsInline muted />
        <canvas ref={canvasRef} style={styles.canvas} />
      </div>
    );
  }

  return null;
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
    padding: 20,
  },
  logoTop: {
    width: 90,
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 30,
    textAlign: "center",
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
    overflow: "hidden",
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
