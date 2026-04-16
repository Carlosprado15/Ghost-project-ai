import React, { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [arActive, setArActive] = useState(false);
  const [time, setTime] = useState(new Date().toLocaleTimeString());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="app-container">
      <header className="app-header">
        <h1 className="brand-name">GHOST PROJECT</h1>
        <span className="edition">LUXURY AR EDITION</span>
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
            <div className="corner-tl"></div><div className="corner-tr"></div>
            <div className="corner-bl"></div><div className="corner-br"></div>
            
            <div className="ar-clock">
              <span className="digital-time">{time}</span>
              <span className="label">SCANNING...</span>
            </div>

            <button className="btn-close" onClick={() => setArActive(false)}>FECHAR</button>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
