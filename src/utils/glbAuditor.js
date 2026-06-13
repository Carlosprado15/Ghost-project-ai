/**
 * GLB AUDITOR - GHOST PROJECT AI
 * 
 * Sistema de auditoria para modelos GLB
 * Identifica problemas estruturais antes da calibração individual
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export class GLBAuditor {
  constructor() {
    this.loader = new GLTFLoader();
    this.results = [];
  }

  /**
   * Audita um único modelo GLB
   * @param {string} modelPath - Caminho para o modelo GLB
   * @param {string} modelName - Nome do modelo (ex: CW001)
   * @returns {Promise<Object>} Dados da auditoria
   */
  async auditModel(modelPath, modelName) {
    return new Promise((resolve, reject) => {
      this.loader.load(
        modelPath,
        (gltf) => {
          try {
            const auditData = this.analyzeGLTF(gltf, modelName);
            resolve(auditData);
          } catch (error) {
            reject(new Error(`Erro ao analisar ${modelName}: ${error.message}`));
          }
        },
        (progress) => {
          // Progress callback - opcional
        },
        (error) => {
          reject(new Error(`Erro ao carregar ${modelName}: ${error.message}`));
        }
      );
    });
  }

  /**
   * Analisa um modelo GLTF carregado
   * @param {Object} gltf - Objeto GLTF carregado
   * @param {string} modelName - Nome do modelo
   * @returns {Object} Dados da análise
   */
  analyzeGLTF(gltf, modelName) {
    const scene = gltf.scene;
    const animations = gltf.animations || [];
    
    // 1. Calcular Bounding Box
    const boundingBox = new THREE.Box3().setFromObject(scene);
    const size = boundingBox.getSize(new THREE.Vector3());
    
    // 2. Centro geométrico
    const center = boundingBox.getCenter(new THREE.Vector3());
    
    // 3. Contar elementos
    const meshCount = this.countMeshes(scene);
    const materialCount = this.countMaterials(scene);
    const vertexCount = this.countVertices(scene);
    const triangleCount = this.countTriangles(scene);
    
    // 4. Escala do nó raiz
    const rootScale = scene.scale;
    
    // 5. Verificações estruturais
    const structuralIssues = this.detectStructuralIssues(scene, boundingBox);
    
    // 6. Análise de anomalias
    const anomalies = this.detectAnomalies({
      size,
      meshCount,
      materialCount,
      vertexCount,
      triangleCount,
      rootScale,
      structuralIssues
    });

    return {
      modelName,
      timestamp: new Date().toISOString(),
      boundingBox: {
        width: parseFloat(size.x.toFixed(4)),
        height: parseFloat(size.y.toFixed(4)),
        depth: parseFloat(size.z.toFixed(4)),
        volume: parseFloat((size.x * size.y * size.z).toFixed(4))
      },
      geometricCenter: {
        x: parseFloat(center.x.toFixed(4)),
        y: parseFloat(center.y.toFixed(4)),
        z: parseFloat(center.z.toFixed(4))
      },
      counts: {
        meshes: meshCount,
        materials: materialCount,
        vertices: vertexCount,
        triangles: triangleCount,
        animations: animations.length
      },
      rootScale: {
        x: parseFloat(rootScale.x.toFixed(4)),
        y: parseFloat(rootScale.y.toFixed(4)),
        z: parseFloat(rootScale.z.toFixed(4)),
        uniform: this.isUniformScale(rootScale)
      },
      structuralIssues,
      anomalies,
      overallHealth: this.calculateHealthScore(structuralIssues, anomalies)
    };
  }

  /**
   * Conta o número de meshes na cena
   */
  countMeshes(object) {
    let count = 0;
    object.traverse((child) => {
      if (child.isMesh) count++;
    });
    return count;
  }

  /**
   * Conta o número de materiais únicos
   */
  countMaterials(object) {
    const materials = new Set();
    object.traverse((child) => {
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(mat => materials.add(mat.uuid));
        } else {
          materials.add(child.material.uuid);
        }
      }
    });
    return materials.size;
  }

  /**
   * Conta o número total de vértices
   */
  countVertices(object) {
    let count = 0;
    object.traverse((child) => {
      if (child.isMesh && child.geometry) {
        const positions = child.geometry.attributes.position;
        if (positions) {
          count += positions.count;
        }
      }
    });
    return count;
  }

  /**
   * Conta o número total de triângulos
   */
  countTriangles(object) {
    let count = 0;
    object.traverse((child) => {
      if (child.isMesh && child.geometry) {
        const geometry = child.geometry;
        if (geometry.index) {
          count += geometry.index.count / 3;
        } else {
          const positions = geometry.attributes.position;
          if (positions) {
            count += positions.count / 3;
          }
        }
      }
    });
    return Math.floor(count);
  }

  /**
   * Verifica se a escala é uniforme
   */
  isUniformScale(scale) {
    const tolerance = 0.001;
    return Math.abs(scale.x - scale.y) < tolerance && 
           Math.abs(scale.y - scale.z) < tolerance;
  }

  /**
   * Detecta problemas estruturais
   */
  detectStructuralIssues(scene, mainBoundingBox) {
    const issues = [];
    const meshes = [];
    const meshBounds = [];

    // Coletar todas as meshes e suas bounding boxes
    scene.traverse((child) => {
      if (child.isMesh) {
        meshes.push(child);
        const meshBox = new THREE.Box3().setFromObject(child);
        meshBounds.push(meshBox);
      }
    });

    // 1. Verificar meshes desconectadas (muito distantes do centro)
    const mainCenter = mainBoundingBox.getCenter(new THREE.Vector3());
    const mainSize = mainBoundingBox.getSize(new THREE.Vector3());
    const maxDistance = Math.max(mainSize.x, mainSize.y, mainSize.z) * 2;

    meshes.forEach((mesh, index) => {
      const meshCenter = meshBounds[index].getCenter(new THREE.Vector3());
      const distance = mainCenter.distanceTo(meshCenter);
      
      if (distance > maxDistance) {
        issues.push({
          type: 'DISCONNECTED_MESH',
          severity: 'HIGH',
          description: `Mesh '${mesh.name || 'unnamed'}' está muito distante do centro principal`,
          distance: parseFloat(distance.toFixed(4)),
          meshName: mesh.name || 'unnamed'
        });
      }
    });

    // 2. Verificar geometria fora da bounding box principal
    meshBounds.forEach((meshBox, index) => {
      if (!mainBoundingBox.containsBox(meshBox)) {
        const mesh = meshes[index];
        issues.push({
          type: 'GEOMETRY_OUTSIDE_BOUNDS',
          severity: 'MEDIUM',
          description: `Mesh '${mesh.name || 'unnamed'}' possui geometria fora da bounding box principal`,
          meshName: mesh.name || 'unnamed'
        });
      }
    });

    // 3. Verificar pivô deslocado (centro geométrico muito longe da origem)
    const centerDistance = mainCenter.length();
    if (centerDistance > 1.0) {
      issues.push({
        type: 'DISPLACED_PIVOT',
        severity: 'MEDIUM',
        description: `Centro geométrico está deslocado da origem`,
        distance: parseFloat(centerDistance.toFixed(4))
      });
    }

    // 4. Verificar escalas diferentes entre partes
    const scales = [];
    scene.traverse((child) => {
      if (child.isMesh) {
        scales.push({
          name: child.name || 'unnamed',
          scale: child.scale.clone()
        });
      }
    });

    if (scales.length > 1) {
      const firstScale = scales[0].scale;
      scales.slice(1).forEach(scaleData => {
        const diff = firstScale.clone().sub(scaleData.scale).length();
        if (diff > 0.1) {
          issues.push({
            type: 'INCONSISTENT_SCALE',
            severity: 'LOW',
            description: `Mesh '${scaleData.name}' possui escala diferente das outras partes`,
            scaleDifference: parseFloat(diff.toFixed(4))
          });
        }
      });
    }

    return issues;
  }

  /**
   * Detecta anomalias baseadas em padrões esperados
   */
  detectAnomalies(data) {
    const anomalies = [];

    // Padrões esperados para relógios (baseado em experiência)
    const expectedRanges = {
      width: { min: 0.5, max: 5.0 },
      height: { min: 0.5, max: 5.0 },
      depth: { min: 0.1, max: 2.0 },
      meshes: { min: 1, max: 50 },
      materials: { min: 1, max: 20 },
      vertices: { min: 100, max: 50000 },
      triangles: { min: 50, max: 25000 }
    };

    // Verificar dimensões
    if (data.size.x < expectedRanges.width.min || data.size.x > expectedRanges.width.max) {
      anomalies.push({
        type: 'UNUSUAL_WIDTH',
        severity: 'MEDIUM',
        value: data.size.x,
        expected: expectedRanges.width,
        description: `Largura fora do padrão esperado para relógios`
      });
    }

    if (data.size.y < expectedRanges.height.min || data.size.y > expectedRanges.height.max) {
      anomalies.push({
        type: 'UNUSUAL_HEIGHT',
        severity: 'MEDIUM',
        value: data.size.y,
        expected: expectedRanges.height,
        description: `Altura fora do padrão esperado para relógios`
      });
    }

    if (data.size.z < expectedRanges.depth.min || data.size.z > expectedRanges.depth.max) {
      anomalies.push({
        type: 'UNUSUAL_DEPTH',
        severity: 'MEDIUM',
        value: data.size.z,
        expected: expectedRanges.depth,
        description: `Profundidade fora do padrão esperado para relógios`
      });
    }

    // Verificar contagens
    if (data.meshCount > expectedRanges.meshes.max) {
      anomalies.push({
        type: 'TOO_MANY_MESHES',
        severity: 'HIGH',
        value: data.meshCount,
        expected: expectedRanges.meshes,
        description: `Número excessivo de meshes pode impactar performance`
      });
    }

    if (data.vertexCount > expectedRanges.vertices.max) {
      anomalies.push({
        type: 'TOO_MANY_VERTICES',
        severity: 'HIGH',
        value: data.vertexCount,
        expected: expectedRanges.vertices,
        description: `Número excessivo de vértices pode impactar performance`
      });
    }

    // Verificar escala não uniforme
    if (!data.rootScale.uniform) {
      anomalies.push({
        type: 'NON_UNIFORM_SCALE',
        severity: 'LOW',
        description: `Escala não uniforme pode causar distorções`,
        scale: data.rootScale
      });
    }

    return anomalies;
  }

  /**
   * Calcula um score de saúde geral do modelo
   */
  calculateHealthScore(structuralIssues, anomalies) {
    let score = 100;

    // Penalizar por problemas estruturais
    structuralIssues.forEach(issue => {
      switch (issue.severity) {
        case 'HIGH': score -= 20; break;
        case 'MEDIUM': score -= 10; break;
        case 'LOW': score -= 5; break;
      }
    });

    // Penalizar por anomalias
    anomalies.forEach(anomaly => {
      switch (anomaly.severity) {
        case 'HIGH': score -= 15; break;
        case 'MEDIUM': score -= 8; break;
        case 'LOW': score -= 3; break;
      }
    });

    return Math.max(0, score);
  }

  /**
   * Audita todos os modelos CW001-CW015
   * @returns {Promise<Array>} Array com resultados de todos os modelos
   */
  async auditAllModels() {
    const models = [];
    for (let i = 1; i <= 15; i++) {
      const modelName = `CW${i.toString().padStart(3, '0')}`;
      const modelPath = `/models/${modelName}.glb`;
      models.push({ name: modelName, path: modelPath });
    }

    const results = [];
    const errors = [];

    for (const model of models) {
      try {
        console.log(`Auditando ${model.name}...`);
        const result = await this.auditModel(model.path, model.name);
        results.push(result);
      } catch (error) {
        console.error(`Erro ao auditar ${model.name}:`, error);
        errors.push({
          modelName: model.name,
          error: error.message
        });
      }
    }

    return {
      results,
      errors,
      summary: this.generateSummary(results)
    };
  }

  /**
   * Gera um resumo comparativo dos resultados
   */
  generateSummary(results) {
    if (results.length === 0) return null;

    const summary = {
      totalModels: results.length,
      averageHealth: 0,
      anomalousModels: [],
      commonIssues: {},
      statistics: {
        boundingBox: { min: {}, max: {}, avg: {} },
        counts: { min: {}, max: {}, avg: {} }
      }
    };

    // Calcular estatísticas
    let totalHealth = 0;
    const dimensions = { width: [], height: [], depth: [] };
    const counts = { meshes: [], materials: [], vertices: [], triangles: [] };

    results.forEach(result => {
      totalHealth += result.overallHealth;
      
      dimensions.width.push(result.boundingBox.width);
      dimensions.height.push(result.boundingBox.height);
      dimensions.depth.push(result.boundingBox.depth);
      
      counts.meshes.push(result.counts.meshes);
      counts.materials.push(result.counts.materials);
      counts.vertices.push(result.counts.vertices);
      counts.triangles.push(result.counts.triangles);

      // Identificar modelos anômalos (health < 70)
      if (result.overallHealth < 70) {
        summary.anomalousModels.push({
          name: result.modelName,
          health: result.overallHealth,
          issues: result.structuralIssues.length + result.anomalies.length
        });
      }

      // Contar problemas comuns
      [...result.structuralIssues, ...result.anomalies].forEach(issue => {
        summary.commonIssues[issue.type] = (summary.commonIssues[issue.type] || 0) + 1;
      });
    });

    summary.averageHealth = parseFloat((totalHealth / results.length).toFixed(2));

    // Estatísticas de dimensões
    Object.keys(dimensions).forEach(key => {
      const values = dimensions[key];
      summary.statistics.boundingBox.min[key] = Math.min(...values);
      summary.statistics.boundingBox.max[key] = Math.max(...values);
      summary.statistics.boundingBox.avg[key] = parseFloat((values.reduce((a, b) => a + b, 0) / values.length).toFixed(4));
    });

    // Estatísticas de contagens
    Object.keys(counts).forEach(key => {
      const values = counts[key];
      summary.statistics.counts.min[key] = Math.min(...values);
      summary.statistics.counts.max[key] = Math.max(...values);
      summary.statistics.counts.avg[key] = parseFloat((values.reduce((a, b) => a + b, 0) / values.length).toFixed(0));
    });

    return summary;
  }
}

export default GLBAuditor;