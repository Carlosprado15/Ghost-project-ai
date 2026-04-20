import React, { useState, useRef } from 'react';
import './App.css';

function App() {
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef(null);

  const startScanner = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      setScanning(true);
      // Timeout para garantir que o elemento video já exista no DOM
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 200);
    } catch (err) {
      alert("Erro ao abrir câmera: Verifique as permissões no cadeado do navegador ao lado da URL.");
      console.error(err);
    }
  };

  return (
    <div className="container">
      {!scanning ? (
        <div className="home-screen">
          <div className="logo-section">
            <img src="/logo.jpeg" alt="Ghost Logo" className="main-logo" />
          </div>
          
          <div className="title-section">
            <h1>GHOST PROJECT AI</h1>
            <p>Tecnologia de Provador Virtual de Alta Precisão</p>
          </div>

          <div className="viewer-section">
            <model-viewer
              src="/relogio.glb"
              ar
              camera-controls
              auto-rotate
              style={{ width: '100%', height: '350px' }}
            ></model-viewer>
          </div>

          <button className="btn-primary" onClick={startScanner}>
            INICIAR SCANNER DE PRECISÃO
          </button>
        </div>
      ) : (
        <div className="camera-screen">
          <video ref={videoRef} autoPlay playsInline className="full-video" />
          <button className="btn-exit" onClick={() => window.location.reload()}>
            VOLTAR
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
