import React, { useState, useEffect } from 'react';

const ReportPanel = ({
  productId,
  modelUrl,
  firstDetectionTime,
  scannerStartTime,
  stabilizationStartTime,
  isStabilized,
  offsetX,
  offsetY,
  sizeError,
  fps,
  modelLoadingStartTime,
  modelViewerLoadedTime,
  firstDisplayTime,
}) => {
  const [reportText, setReportText] = useState('');
  const [visualInspection, setVisualInspection] = useState({
    small: false,
    large: false,
    flat: false,
    sticker: false,
    correct: false,
    missingParts: false,
    brokenStrap: false,
    incorrectRotation: false,
    incorrectCentering: false,
  });

  const generateReport = () => {
    let report = `---

## ${productId || 'N/A'}

### 1. IDENTIFICAÇÃO
- PRODUCT ID: ${productId || 'N/A'}
- MODEL URL: ${modelUrl || 'N/A'}
- NOME DO GLB: ${modelUrl ? modelUrl.split('/').pop() : 'N/A'}

### 2. CARREGAMENTO
- Tempo até iniciar carregamento: ${modelLoadingStartTime && scannerStartTime ? ((modelLoadingStartTime - scannerStartTime) / 1000).toFixed(2) + 's' : 'N/A'}
- Tempo até model-viewer concluir carregamento: ${modelViewerLoadedTime && modelLoadingStartTime ? ((modelViewerLoadedTime - modelLoadingStartTime) / 1000).toFixed(2) + 's' : 'N/A'}
- Tempo total até primeira exibição: ${firstDisplayTime && modelLoadingStartTime ? ((firstDisplayTime - modelLoadingStartTime) / 1000).toFixed(2) + 's' : 'N/A'}

### 3. TRACKING
- FIRST DETECTION: ${firstDetectionTime && scannerStartTime ? ((firstDetectionTime - scannerStartTime) / 1000).toFixed(2) + 's' : 'N/A'}
- STABILIZATION: ${isStabilized && stabilizationStartTime ? ((performance.now() - stabilizationStartTime) / 1000).toFixed(2) + 's' : 'N/A'}
- TRACK FPS médio: ${fps || 'N/A'}

### 4. POSICIONAMENTO
- OFFSET X médio: ${offsetX.toFixed(2)} px
- OFFSET Y médio: ${offsetY.toFixed(2)} px
- OFFSET X máximo: N/A (a ser implementado)
- OFFSET Y máximo: N/A (a ser implementado)

### 5. ESCALA
- SIZE ERROR médio: ${sizeError.toFixed(2)} px
- SIZE ERROR máximo: N/A (a ser implementado)

### 6. MODELO 3D
- Bounding Box:
  - largura: N/A (a ser implementado)
  - altura: N/A (a ser implementado)
  - profundidade: N/A (a ser implementado)
- Quantidade de meshes: N/A (a ser implementado)
- Quantidade de materiais: N/A (a ser implementado)
- Quantidade de vértices: N/A (a ser implementado)
- Quantidade de triângulos: N/A (a ser implementado)

### 7. INSPEÇÃO VISUAL
${Object.entries(visualInspection)
      .filter(([, checked]) => checked)
      .map(([key]) => `- [x] ${key.replace(/([A-Z])/g, ' $1').toLowerCase()}`)
      .join('\n')}
${Object.entries(visualInspection)
      .filter(([, checked]) => !checked)
      .map(([key]) => `- [ ] ${key.replace(/([A-Z])/g, ' $1').toLowerCase()}`)
      .join('\n')}

---`;
    setReportText(report);
  };

  const handleCheckboxChange = (event) => {
    setVisualInspection({
      ...visualInspection,
      [event.target.name]: event.target.checked,
    });
  };

  return (
    <div style={{
      position: 'fixed',
      top: '10px',
      right: '10px',
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      color: 'white',
      padding: '15px',
      borderRadius: '8px',
      fontSize: '12px',
      fontFamily: 'monospace',
      zIndex: 20,
      width: '350px',
      maxHeight: '90vh',
      overflowY: 'auto',
      boxShadow: '0 4px 8px rgba(0,0,0,0.3)'
    }}>
      <h3>GERAR RELATÓRIO DO PRODUTO</h3>
      <hr style={{ borderColor: '#333', margin: '10px 0' }} />

      <h4>INSPEÇÃO VISUAL</h4>
      <div style={{ marginBottom: '10px' }}>
        {Object.keys(visualInspection).map((key) => (
          <div key={key}>
            <input
              type="checkbox"
              id={key}
              name={key}
              checked={visualInspection[key]}
              onChange={handleCheckboxChange}
              style={{ marginRight: '5px' }}
            />
            <label htmlFor={key}>{key.replace(/([A-Z])/g, ' $1').toLowerCase()}</label>
          </div>
        ))}
      </div>

      <button
        onClick={generateReport}
        style={{
          backgroundColor: '#007bff',
          color: 'white',
          border: 'none',
          padding: '8px 12px',
          borderRadius: '5px',
          cursor: 'pointer',
          width: '100%',
          marginBottom: '10px'
        }}
      >
        GERAR RELATÓRIO
      </button>

      {reportText && (
        <div>
          <h4>RELATÓRIO GERADO</h4>
          <textarea
            value={reportText}
            readOnly
            rows="20"
            style={{
              width: '100%',
              backgroundColor: '#222',
              color: '#eee',
              border: '1px solid #555',
              padding: '10px',
              borderRadius: '5px',
              resize: 'vertical'
            }}
          />
          <button
            onClick={() => navigator.clipboard.writeText(reportText)}
            style={{
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              padding: '8px 12px',
              borderRadius: '5px',
              cursor: 'pointer',
              width: '100%',
              marginTop: '5px'
            }}
          >
            Copiar para Área de Transferência
          </button>
        </div>
      )}
    </div>
  );
};

export default ReportPanel;
