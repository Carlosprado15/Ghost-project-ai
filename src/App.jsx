import React, { useState } from "react";
import "./App.css";

function App() {
  const [arActive, setArActive] = useState(false);

  return (
    <div className="ghost-root">
      {!arActive ? (
        <div className="ghost-idle">
          <div className="ghost-logo-wrapper">
            <img 
              src="https://raw.githubusercontent.com/Carlosprado15/Ghost-project-ai/main/src/assets/1776216880651.jpg" 
              alt="Logo Ghost" 
              className="ghost-logo-img" 
            />
            <h1 className="ghost-title">GHOST PROJECT</h1>
            <span className="ghost-logo-sub">REALIDADE AUMENTADA</span>
          </div>
          <button className="ghost-cta" onClick={() => setArActive(true)}>
            INICIAR EXPERIÊNCIA
          </button>
        </div>
      ) : (
        <div className="ghost-ar-container">
          <div className="ghost-status-text">CARREGANDO CÂMERA...</div>
          <button className="ghost-scan-btn" onClick={() => setArActive(false)}>VOLTAR</button>
        </div>
      )}
    </div>
  );
}

export default App;
