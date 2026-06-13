import { useState, useEffect } from 'react';
import { getProductId, getModelUrl } from './utils/urlParams';

export default function DiagnosticPage({ onBack }) {
  const [diagnosticData, setDiagnosticData] = useState({
    productId: null,
    modelUrl: null,
    loadedFile: null,
    timestamp: null
  });

  useEffect(() => {
    // Capturar dados de diagnóstico
    const productId = getProductId();
    const modelUrl = getModelUrl();
    
    setDiagnosticData({
      productId: productId,
      modelUrl: modelUrl,
      loadedFile: modelUrl ? modelUrl.split('/').pop() : 'N/A',
      timestamp: new Date().toLocaleString()
    });
  }, []);

  const diagnosticStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
    color: '#00ff00',
    fontFamily: 'monospace',
    fontSize: '14px',
    padding: '20px',
    boxSizing: 'border-box',
    zIndex: 9999,
    overflow: 'auto'
  };

  const headerStyle = {
    borderBottom: '2px solid #00ff00',
    paddingBottom: '10px',
    marginBottom: '20px',
    fontSize: '18px',
    fontWeight: 'bold'
  };

  const sectionStyle = {
    margin: '15px 0',
    padding: '10px',
    border: '1px solid #333',
    borderRadius: '5px',
    backgroundColor: '#111'
  };

  const labelStyle = {
    color: '#ffff00',
    fontWeight: 'bold',
    display: 'inline-block',
    width: '200px'
  };

  const valueStyle = {
    color: '#00ffff',
    fontWeight: 'normal'
  };

  const buttonStyle = {
    backgroundColor: '#333',
    color: '#00ff00',
    border: '2px solid #00ff00',
    padding: '10px 20px',
    borderRadius: '5px',
    cursor: 'pointer',
    fontSize: '14px',
    fontFamily: 'monospace',
    marginTop: '20px'
  };

  return (
    <div style={diagnosticStyle}>
      <div style={headerStyle}>
        🔍 GHOST PROJECT - DIAGNÓSTICO DE CARREGAMENTO
      </div>
      
      <div style={sectionStyle}>
        <div style={labelStyle}>URL ATUAL:</div>
        <div style={valueStyle}>{window.location.href}</div>
      </div>

      <div style={sectionStyle}>
        <div style={labelStyle}>PRODUCT ID DETECTADO:</div>
        <div style={valueStyle}>
          {diagnosticData.productId || 'null'}
          {diagnosticData.productId ? ' ✅' : ' ❌'}
        </div>
      </div>

      <div style={sectionStyle}>
        <div style={labelStyle}>MODEL URL RETORNADO:</div>
        <div style={valueStyle}>
          {diagnosticData.modelUrl || 'null'}
          {diagnosticData.modelUrl ? ' ✅' : ' ❌'}
        </div>
      </div>

      <div style={sectionStyle}>
        <div style={labelStyle}>ARQUIVO GLB CARREGADO:</div>
        <div style={valueStyle}>
          {diagnosticData.loadedFile}
          {diagnosticData.loadedFile !== 'N/A' ? ' ✅' : ' ❌'}
        </div>
      </div>

      <div style={sectionStyle}>
        <div style={labelStyle}>TIMESTAMP:</div>
        <div style={valueStyle}>{diagnosticData.timestamp}</div>
      </div>

      <div style={sectionStyle}>
        <div style={labelStyle}>STATUS GERAL:</div>
        <div style={valueStyle}>
          {diagnosticData.productId && diagnosticData.modelUrl ? 
            '🟢 FUNCIONANDO CORRETAMENTE' : 
            '🔴 PROBLEMA DETECTADO'
          }
        </div>
      </div>

      <div style={sectionStyle}>
        <div style={labelStyle}>FLUXO DE DADOS:</div>
        <div style={valueStyle}>
          URL → getProductId() → products.json → getModelUrl() → model-viewer
        </div>
      </div>

      <button 
        style={buttonStyle}
        onClick={onBack}
        onMouseOver={(e) => e.target.style.backgroundColor = '#00ff00'}
        onMouseOut={(e) => e.target.style.backgroundColor = '#333'}
      >
        ← VOLTAR PARA APLICAÇÃO
      </button>
    </div>
  );
}