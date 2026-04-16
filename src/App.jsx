import React, { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [arActive, setArActive] = useState(false);
  const [cameraMode, setCameraMode] = useState('user'); // frontal ou traseira
  const [time, setTime] = useState(new Date().toLocaleTimeString());

  // Atualiza o relógio 3D/Digital do Scanner
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="app-container">
      <div className="overlay-lux"></div>
      
      <header className="app-header">
        <div className="logo-section">
          <h1 className="brand-name">GHOST PROJECT</h1>
          <span className="edition">LUXURY EDITION</span>
        </div>
      </header>

      <main className="viewport">
        {!arActive ? (
          <div className="welcome-screen">
            <button className="btn-main" onClick={() => setArActive(true)}>
              ATIVAR SCANNER AR
            </button>
          </div>
        ) : (
          <div className="ar-scanner-mode">
            <div className="scanner-line"></div>
            <div className="corner-tl"></div>
            <div className="corner-tr"></div>
            <div className="corner-bl"></div>
            <div className="corner-br"></div>
            
            <div className="ar-clock">
              <span className="digital-time">{time}</span>
              <span className="label">SCANNING ASSETS...</span>
            </div>

            <div className="camera-controls">
              <button onClick={() => setCameraMode(cameraMode === 'user' ? 'environment' : 'user')}>
                {cameraMode === 'user' ? 'CÂMERA TRASEIRA' : 'CÂMERA FRONTAL'}
              </button>
            </div>
          </div>
        )}
      </main>

      <nav className="bottom-nav">
        <button className="nav-item">CATÁLOGO</button>
        <button className="nav-item active">HOME</button>
        <button className="nav-item">PERFIL</button>
      </nav>
    </div>
  );
}

export default App;
