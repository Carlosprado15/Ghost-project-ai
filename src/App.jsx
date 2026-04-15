import React, { useEffect, useRef, useState, useCallback } from "react";

// --- Constantes de sistema ---
const SYSTEM = {
  SCAN_DURATION_MS: 2800,
  GOLD_COLOR: 0xd4af37,
  BG_COLOR: 0x000000,
};

function App() {
  const [loading, setLoading] = useState(false);
  const [arActive, setArActive] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // Iniciar Câmera
  const startCamera = async () => {
    setLoading(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setArActive(true);
      }
    } catch (err) {
      alert("Por favor, permita o acesso à câmera para a experiência AR.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ghost-root">
      {!arActive ? (
        <div className="ghost-idle">
          <div className="ghost-logo-wrapper">
             <img 
              src="https://raw.githubusercontent.com/Carlosprado15/Ghost-project-ai/main/src/assets/1776216880651.jpg" 
              alt="Ghost Logo" 
              className="ghost-logo-img" 
            />
            <span className="ghost-logo-sub">Augmented Reality</span>
          </div>
          <button className="ghost-cta" onClick={startCamera}>
            INICIAR EXPERIÊNCIA AR
          </button>
        </div>
      ) : (
        <div className="ghost-ar-container">
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            className="ghost-video"
          />
          <div className="ghost-status-text">AMBIENTE IDENTIFICADO</div>
          <button className="ghost-scan-btn" onClick={() => window.location.reload()}>
            SAIR
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
