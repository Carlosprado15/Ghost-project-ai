import React, { useState } from 'react';
import './App.css';

function App() {
  const [status, setStatus] = useState('Pronto para iniciar');

  return (
    <div className="container">
      <header className="header">
        <h1 className="title">GHOST PROJECT</h1>
        <p className="subtitle">Virtual AR Try-On</p>
      </header>

      <main className="app-content">
        <div className="viewfinder">
          <p>{status}</p>
        </div>

        <div className="controls">
          <button className="ar-button" onClick={() => setStatus('Ativando Câmera AR...')}>
            ATIVAR PROVADOR VIRTUAL
          </button>
          <button className="ar-button secondary" onClick={() => setStatus('Carregando catálogo...')}>
            VER CATÁLOGO
          </button>
        </div>
      </main>

      <footer className="footer">
        <p>© 2026 Ghost Project AI - Carlos Prado</p>
      </footer>
    </div>
  );
}

export default App;
