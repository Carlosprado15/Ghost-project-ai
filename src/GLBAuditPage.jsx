/**
 * GLB AUDIT PAGE - GHOST PROJECT AI
 * 
 * Interface para auditoria de modelos GLB
 * Exibe resultados em tabela com métricas detalhadas
 */

import React, { useState, useEffect } from 'react';
import GLBAuditor from './utils/glbAuditor.js';
import './App.css';

const GLBAuditPage = () => {
  const [auditResults, setAuditResults] = useState([]);
  const [auditSummary, setAuditSummary] = useState(null);
  const [auditErrors, setAuditErrors] = useState([]);
  const [isAuditing, setIsAuditing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [selectedModel, setSelectedModel] = useState(null);

  const auditor = new GLBAuditor();

  /**
   * Executa auditoria completa de todos os modelos
   */
  const runFullAudit = async () => {
    setIsAuditing(true);
    setProgress(0);
    setAuditResults([]);
    setAuditErrors([]);
    setAuditSummary(null);

    try {
      console.log('Iniciando auditoria completa...');
      
      // Simular progresso durante a auditoria
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 5, 90));
      }, 200);

      const result = await auditor.auditAllModels();
      
      clearInterval(progressInterval);
      setProgress(100);
      
      setAuditResults(result.results);
      setAuditErrors(result.errors);
      setAuditSummary(result.summary);
      
      console.log('Auditoria concluída:', result);
      
    } catch (error) {
      console.error('Erro durante auditoria:', error);
      setAuditErrors([{ modelName: 'SYSTEM', error: error.message }]);
    } finally {
      setIsAuditing(false);
      setTimeout(() => setProgress(0), 2000);
    }
  };

  /**
   * Audita um modelo específico
   */
  const auditSingleModel = async (modelName) => {
    setIsAuditing(true);
    try {
      const modelPath = `/models/${modelName}.glb`;
      const result = await auditor.auditModel(modelPath, modelName);
      
      // Atualizar ou adicionar resultado
      setAuditResults(prev => {
        const filtered = prev.filter(r => r.modelName !== modelName);
        return [...filtered, result].sort((a, b) => a.modelName.localeCompare(b.modelName));
      });
      
      console.log(`Auditoria de ${modelName} concluída:`, result);
      
    } catch (error) {
      console.error(`Erro ao auditar ${modelName}:`, error);
      setAuditErrors(prev => [...prev, { modelName, error: error.message }]);
    } finally {
      setIsAuditing(false);
    }
  };

  /**
   * Formata números para exibição
   */
  const formatNumber = (num) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  /**
   * Formata dimensões da bounding box
   */
  const formatDimensions = (boundingBox) => {
    return `${boundingBox.width.toFixed(2)} × ${boundingBox.height.toFixed(2)} × ${boundingBox.depth.toFixed(2)}`;
  };

  /**
   * Formata centro geométrico
   */
  const formatCenter = (center) => {
    return `(${center.x.toFixed(2)}, ${center.y.toFixed(2)}, ${center.z.toFixed(2)})`;
  };

  /**
   * Retorna cor baseada no health score
   */
  const getHealthColor = (health) => {
    if (health >= 80) return '#4CAF50'; // Verde
    if (health >= 60) return '#FF9800'; // Laranja
    return '#F44336'; // Vermelho
  };

  /**
   * Mostra detalhes de um modelo
   */
  const showModelDetails = (model) => {
    setSelectedModel(model);
  };

  return (
    <div className="glb-audit-page">
      <div className="audit-header">
        <h1>🔍 Auditoria de Modelos GLB</h1>
        <p>Análise estrutural e métricas dos modelos CW001-CW015</p>
        
        <div className="audit-controls">
          <button 
            onClick={runFullAudit} 
            disabled={isAuditing}
            className="audit-btn primary"
          >
            {isAuditing ? 'Auditando...' : 'Auditar Todos os Modelos'}
          </button>
          
          {isAuditing && (
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${progress}%` }}
              ></div>
              <span className="progress-text">{progress}%</span>
            </div>
          )}
        </div>
      </div>

      {/* Resumo da Auditoria */}
      {auditSummary && (
        <div className="audit-summary">
          <h2>📊 Resumo da Auditoria</h2>
          <div className="summary-stats">
            <div className="stat-card">
              <h3>Modelos Analisados</h3>
              <span className="stat-value">{auditSummary.totalModels}</span>
            </div>
            <div className="stat-card">
              <h3>Saúde Média</h3>
              <span 
                className="stat-value"
                style={{ color: getHealthColor(auditSummary.averageHealth) }}
              >
                {auditSummary.averageHealth}%
              </span>
            </div>
            <div className="stat-card">
              <h3>Modelos Anômalos</h3>
              <span className="stat-value">{auditSummary.anomalousModels.length}</span>
            </div>
          </div>
        </div>
      )}

      {/* Erros */}
      {auditErrors.length > 0 && (
        <div className="audit-errors">
          <h3>⚠️ Erros Encontrados</h3>
          {auditErrors.map((error, index) => (
            <div key={index} className="error-item">
              <strong>{error.modelName}:</strong> {error.error}
            </div>
          ))}
        </div>
      )}

      {/* Tabela de Resultados */}
      {auditResults.length > 0 && (
        <div className="audit-results">
          <h2>📋 Resultados da Auditoria</h2>
          
          <div className="results-table-container">
            <table className="results-table">
              <thead>
                <tr>
                  <th>Modelo</th>
                  <th>Dimensões (W×H×D)</th>
                  <th>Meshes</th>
                  <th>Materiais</th>
                  <th>Vértices</th>
                  <th>Triângulos</th>
                  <th>Centro Geométrico</th>
                  <th>Saúde</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {auditResults.map((result, index) => (
                  <tr key={index} className="result-row">
                    <td className="model-name">
                      <strong>{result.modelName}</strong>
                    </td>
                    <td className="dimensions">
                      {formatDimensions(result.boundingBox)}
                    </td>
                    <td className="count-cell">
                      {result.counts.meshes}
                    </td>
                    <td className="count-cell">
                      {result.counts.materials}
                    </td>
                    <td className="count-cell">
                      {formatNumber(result.counts.vertices)}
                    </td>
                    <td className="count-cell">
                      {formatNumber(result.counts.triangles)}
                    </td>
                    <td className="center-cell">
                      {formatCenter(result.geometricCenter)}
                    </td>
                    <td className="health-cell">
                      <span 
                        className="health-score"
                        style={{ 
                          color: getHealthColor(result.overallHealth),
                          fontWeight: 'bold'
                        }}
                      >
                        {result.overallHealth}%
                      </span>
                    </td>
                    <td className="actions-cell">
                      <button 
                        onClick={() => showModelDetails(result)}
                        className="detail-btn"
                      >
                        Detalhes
                      </button>
                      <button 
                        onClick={() => auditSingleModel(result.modelName)}
                        disabled={isAuditing}
                        className="reaudit-btn"
                      >
                        Re-auditar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal de Detalhes */}
      {selectedModel && (
        <div className="modal-overlay" onClick={() => setSelectedModel(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>🔍 Detalhes - {selectedModel.modelName}</h2>
              <button 
                className="close-btn"
                onClick={() => setSelectedModel(null)}
              >
                ×
              </button>
            </div>
            
            <div className="modal-body">
              <div className="detail-section">
                <h3>📐 Dimensões</h3>
                <div className="detail-grid">
                  <div>Largura: <strong>{selectedModel.boundingBox.width.toFixed(4)}</strong></div>
                  <div>Altura: <strong>{selectedModel.boundingBox.height.toFixed(4)}</strong></div>
                  <div>Profundidade: <strong>{selectedModel.boundingBox.depth.toFixed(4)}</strong></div>
                  <div>Volume: <strong>{selectedModel.boundingBox.volume.toFixed(4)}</strong></div>
                </div>
              </div>

              <div className="detail-section">
                <h3>🎯 Centro Geométrico</h3>
                <div className="detail-grid">
                  <div>X: <strong>{selectedModel.geometricCenter.x.toFixed(4)}</strong></div>
                  <div>Y: <strong>{selectedModel.geometricCenter.y.toFixed(4)}</strong></div>
                  <div>Z: <strong>{selectedModel.geometricCenter.z.toFixed(4)}</strong></div>
                </div>
              </div>

              <div className="detail-section">
                <h3>📊 Contadores</h3>
                <div className="detail-grid">
                  <div>Meshes: <strong>{selectedModel.counts.meshes}</strong></div>
                  <div>Materiais: <strong>{selectedModel.counts.materials}</strong></div>
                  <div>Vértices: <strong>{selectedModel.counts.vertices.toLocaleString()}</strong></div>
                  <div>Triângulos: <strong>{selectedModel.counts.triangles.toLocaleString()}</strong></div>
                </div>
              </div>

              <div className="detail-section">
                <h3>⚖️ Escala</h3>
                <div className="detail-grid">
                  <div>X: <strong>{selectedModel.rootScale.x.toFixed(4)}</strong></div>
                  <div>Y: <strong>{selectedModel.rootScale.y.toFixed(4)}</strong></div>
                  <div>Z: <strong>{selectedModel.rootScale.z.toFixed(4)}</strong></div>
                  <div>Uniforme: <strong>{selectedModel.rootScale.uniform ? 'Sim' : 'Não'}</strong></div>
                </div>
              </div>

              {selectedModel.structuralIssues.length > 0 && (
                <div className="detail-section">
                  <h3>🚨 Problemas Estruturais</h3>
                  {selectedModel.structuralIssues.map((issue, index) => (
                    <div key={index} className={`issue-item ${issue.severity.toLowerCase()}`}>
                      <strong>{issue.type}:</strong> {issue.description}
                    </div>
                  ))}
                </div>
              )}

              {selectedModel.anomalies.length > 0 && (
                <div className="detail-section">
                  <h3>⚠️ Anomalias</h3>
                  {selectedModel.anomalies.map((anomaly, index) => (
                    <div key={index} className={`anomaly-item ${anomaly.severity.toLowerCase()}`}>
                      <strong>{anomaly.type}:</strong> {anomaly.description}
                    </div>
                  ))}
                </div>
              )}

              <div className="detail-section">
                <h3>💚 Score de Saúde</h3>
                <div className="health-display">
                  <span 
                    className="health-score-large"
                    style={{ color: getHealthColor(selectedModel.overallHealth) }}
                  >
                    {selectedModel.overallHealth}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Instruções */}
      {auditResults.length === 0 && !isAuditing && (
        <div className="instructions">
          <h2>🚀 Como usar</h2>
          <ol>
            <li>Clique em "Auditar Todos os Modelos" para analisar CW001-CW015</li>
            <li>Aguarde o processamento (pode levar alguns minutos)</li>
            <li>Visualize os resultados na tabela</li>
            <li>Clique em "Detalhes" para ver informações completas</li>
            <li>Use "Re-auditar" para atualizar um modelo específico</li>
          </ol>
        </div>
      )}
    </div>
  );
};

export default GLBAuditPage;