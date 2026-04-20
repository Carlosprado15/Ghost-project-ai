import React, { useState, useEffect, useRef } from 'react';
import './App.css';

function App() {
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState(null);
  const videoRef = useRef(null);

  // Função para iniciar a câmera com tratamento rigoroso de permissões
  const startScanner = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      });
      
      setScanning(true);
      
      // Aguarda o estado atualizar para garantir que o elemento video exista no DOM
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 100);
    } catch (err) {
      console.error("Erro ao acessar a câmera:", err);
      setError("Câmera não disponível ou permissão negada. Verifique as configurações do navegador.");
    }
  };

  const stopScanner = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(track => track.stop());
    }
    setScanning(false);
    window.location.reload(); // Limpa o cache de execução
  };

  return (
    <div className="App">
      {/* Header com Logo - Caminho exato para logo.jpeg */}
      <header className="App-header">
        <img 
          src="/logo.jpeg" 
          className="App-logo" 
          alt="Ghost Project AI" 
          onError={(e) => {
            console.error("Erro ao carregar logo.jpeg. Verifique se o arquivo está na pasta public.");
            e.target.style.display = 'none';
          }}
        />
      </header>

      <main className="App-main">
        {!scanning ? (
          <div className="landing-container">
            <section className="hero-text">
              <h1>GHOST PROJECT AI</h1>
              <p>Tecnologia de Provador Virtual de Alta Precisão</p>
            </section>

            {/* Visualizador 3D do Relógio Tag Heuer de 13MB */}
            <div className="viewer-wrapper">
              <model-viewer
                src="/relogio.glb"
                ar
                ar-modes="webxr scene-viewer quick-look"
                camera-controls
                poster="poster.webp"
                shadow-intensity="1"
                auto-rotate
                rotation-per-second="30deg"
                interaction-prompt="auto"
                style={{ width: '100%', height: '400px', backgroundColor: 'transparent' }}
              >
                <button slot="ar-button" className="ar-button">
                  VER NO SEU PULSO (AR)
                </button>
              </model-viewer>
            </div>

            {error && <div className="error-message">{error}</div>}

            <button className="cta-button" onClick={startScanner}>
              INICIAR SCANNER DE PRECISÃO
            </button>
          </div>
        ) : (
          <div className="scanner-active">
            <div className="scanner-overlay">
              <div className="scan-guide-box"></div>
              <p className="scan-instruction">Posicione o pulso dentro da área demarcada</p>
            </div>
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted 
              className="full-video-feed"
            />
            <button className="exit-button" onClick={stopScanner}>
              ENCERRAR
            </button>
          </div>
        )}
      </main>

      <footer className="App-footer">
        <p>&copy; 2026 GHOST PROJECT AI - Strategic Intelligence</p>
      </footer>
    </div>
  );
}

export default App;
