/**
 * orientation.mjs — análise objetiva de orientação de um GLB via PCA
 *
 * Calcula os eixos principais da malha (PCA ponderada por ÁREA de triângulo,
 * usando centroides em coordenadas de mundo). Para um relógio:
 *   e1 (maior autovalor)  = eixo longo (pulseira, direção 12h–6h)
 *   e3 (menor autovalor)  = normal do mostrador (face de maior área)
 *
 * A partir disso, o ângulo Z por produto é o giro que alinha e1 (projetado no
 * plano XY, após a rotação de base do pipeline) com +Y — mostrador em 12:00.
 *
 * Limite honesto: PCA tem ambiguidade de sinal (±e1 → 12h vs 6h; ±e3 → frente
 * vs costas). O ângulo é normalizado para (−90°, +90°]; produtos de cabeça
 * para baixo precisam de flip manual de 180° (tabela FLIP_180 no normalize).
 */

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Multiplica mat4 column-major (gltf) por vec3 (ponto)
function xformPoint(m, [x, y, z]) {
  return [
    m[0] * x + m[4] * y + m[8]  * z + m[12],
    m[1] * x + m[5] * y + m[9]  * z + m[13],
    m[2] * x + m[6] * y + m[10] * z + m[14],
  ];
}

// Rotaciona vec3 por quaternion [x,y,z,w]
export function quatRotate([qx, qy, qz, qw], [vx, vy, vz]) {
  // t = 2q × v ; v' = v + w·t + q × t
  const tx = 2 * (qy * vz - qz * vy);
  const ty = 2 * (qz * vx - qx * vz);
  const tz = 2 * (qx * vy - qy * vx);
  return [
    vx + qw * tx + (qy * tz - qz * ty),
    vy + qw * ty + (qz * tx - qx * tz),
    vz + qw * tz + (qx * ty - qy * tx),
  ];
}

// Autovetores/valores de matriz 3x3 simétrica — Jacobi clássico
function jacobiEigen(A) {
  const a = A.map(r => [...r]);
  let V = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  for (let sweep = 0; sweep < 50; sweep++) {
    let off = Math.abs(a[0][1]) + Math.abs(a[0][2]) + Math.abs(a[1][2]);
    if (off < 1e-14) break;
    for (const [p, q] of [[0, 1], [0, 2], [1, 2]]) {
      if (Math.abs(a[p][q]) < 1e-15) continue;
      const theta = (a[q][q] - a[p][p]) / (2 * a[p][q]);
      const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
      const c = 1 / Math.sqrt(t * t + 1), s = t * c;
      for (let k = 0; k < 3; k++) {
        const akp = a[k][p], akq = a[k][q];
        a[k][p] = c * akp - s * akq;
        a[k][q] = s * akp + c * akq;
      }
      for (let k = 0; k < 3; k++) {
        const apk = a[p][k], aqk = a[q][k];
        a[p][k] = c * apk - s * aqk;
        a[q][k] = s * apk + c * aqk;
      }
      for (let k = 0; k < 3; k++) {
        const vkp = V[k][p], vkq = V[k][q];
        V[k][p] = c * vkp - s * vkq;
        V[k][q] = s * vkp + c * vkq;
      }
    }
  }
  // pares (autovalor, autovetor-coluna), ordenados desc
  const pairs = [0, 1, 2].map(i => ({ val: a[i][i], vec: [V[0][i], V[1][i], V[2][i]] }));
  pairs.sort((x, y) => y.val - x.val);
  return pairs;
}

const MAX_TRIS_PER_PRIM = 150000; // amostragem por stride acima disso

/**
 * PCA ponderada por área sobre todas as malhas da cena.
 * Retorna { axes: [e1,e2,e3], evals: [λ1,λ2,λ3] } em coords de mundo do GLB.
 */
export function computeMeshPCA(doc) {
  const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];

  let W = 0;
  const mean = [0, 0, 0];
  const m2 = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]; // Σ w·c·cᵀ

  scene.traverse((node) => {
    const mesh = node.getMesh();
    if (!mesh) return;
    const M = node.getWorldMatrix();

    for (const prim of mesh.listPrimitives()) {
      const posAcc = prim.getAttribute('POSITION');
      const idxAcc = prim.getIndices();
      if (!posAcc) continue;

      const vCount = posAcc.getCount();
      const pos = new Float64Array(vCount * 3);
      const tmp = [0, 0, 0];
      for (let i = 0; i < vCount; i++) {
        posAcc.getElement(i, tmp);          // denormaliza (KHR_mesh_quantization)
        const p = xformPoint(M, tmp);       // world matrix inclui dequant/escala
        pos[i * 3] = p[0]; pos[i * 3 + 1] = p[1]; pos[i * 3 + 2] = p[2];
      }

      const triCount = idxAcc ? idxAcc.getCount() / 3 : vCount / 3;
      const stride = Math.max(1, Math.floor(triCount / MAX_TRIS_PER_PRIM));
      const idx = (t, k) => idxAcc ? idxAcc.getScalar(t * 3 + k) : t * 3 + k;

      for (let t = 0; t < triCount; t += stride) {
        const i0 = idx(t, 0) * 3, i1 = idx(t, 1) * 3, i2 = idx(t, 2) * 3;
        const ax = pos[i1] - pos[i0], ay = pos[i1 + 1] - pos[i0 + 1], az = pos[i1 + 2] - pos[i0 + 2];
        const bx = pos[i2] - pos[i0], by = pos[i2 + 1] - pos[i0 + 1], bz = pos[i2 + 2] - pos[i0 + 2];
        const cx = ay * bz - az * by, cy = az * bx - ax * bz, cz = ax * by - ay * bx;
        const area = 0.5 * Math.hypot(cx, cy, cz);
        if (!(area > 0)) continue;

        const gx = (pos[i0] + pos[i1] + pos[i2]) / 3;
        const gy = (pos[i0 + 1] + pos[i1 + 1] + pos[i2 + 1]) / 3;
        const gz = (pos[i0 + 2] + pos[i1 + 2] + pos[i2 + 2]) / 3;

        W += area;
        mean[0] += area * gx; mean[1] += area * gy; mean[2] += area * gz;
        m2[0][0] += area * gx * gx; m2[0][1] += area * gx * gy; m2[0][2] += area * gx * gz;
        m2[1][1] += area * gy * gy; m2[1][2] += area * gy * gz;
        m2[2][2] += area * gz * gz;
      }
    }
  });

  if (W <= 0) throw new Error('nenhum triângulo com área > 0');
  for (let i = 0; i < 3; i++) mean[i] /= W;
  const C = [
    [m2[0][0] / W - mean[0] * mean[0], m2[0][1] / W - mean[0] * mean[1], m2[0][2] / W - mean[0] * mean[2]],
    [0, m2[1][1] / W - mean[1] * mean[1], m2[1][2] / W - mean[1] * mean[2]],
    [0, 0, m2[2][2] / W - mean[2] * mean[2]],
  ];
  C[1][0] = C[0][1]; C[2][0] = C[0][2]; C[2][1] = C[1][2];

  const pairs = jacobiEigen(C);
  return { axes: pairs.map(p => p.vec), evals: pairs.map(p => p.val) };
}

// ── M070C: alinhamento COMPLETO da base PCA ─────────────────────────────────
// e1 (eixo longo) → +Y  E  e3 (normal do mostrador) → +Z, numa única rotação.
// Alinhar só e1→Y deixa o modelo livre para girar em torno de Y — era por isso
// que os produtos ficavam de lado/costas. Sinais de e1/e3 são ambíguos na PCA
// (12h/6h, frente/costas): escolha canônica determinística + flips por produto.

const _norm  = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const _dot   = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const _cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

// Determinístico: o maior componente em módulo fica positivo
const _canonicalSign = (v) => {
  const i = [0, 1, 2].reduce((m, k) => (Math.abs(v[k]) > Math.abs(v[m]) ? k : m), 0);
  return v[i] < 0 ? [-v[0], -v[1], -v[2]] : v;
};

// Matriz de rotação com LINHAS (r0,r1,r2) ortonormais → quaternion [x,y,z,w]
function mat3RowsToQuat(r0, r1, r2) {
  const m00 = r0[0], m01 = r0[1], m02 = r0[2];
  const m10 = r1[0], m11 = r1[1], m12 = r1[2];
  const m20 = r2[0], m21 = r2[1], m22 = r2[2];
  const tr = m00 + m11 + m22;
  let x, y, z, w;
  if (tr > 0) {
    const s = Math.sqrt(tr + 1) * 2;
    w = s / 4; x = (m21 - m12) / s; y = (m02 - m20) / s; z = (m10 - m01) / s;
  } else if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1 + m00 - m11 - m22) * 2;
    w = (m21 - m12) / s; x = s / 4; y = (m01 + m10) / s; z = (m02 + m20) / s;
  } else if (m11 > m22) {
    const s = Math.sqrt(1 + m11 - m00 - m22) * 2;
    w = (m02 - m20) / s; x = (m01 + m10) / s; y = s / 4; z = (m12 + m21) / s;
  } else {
    const s = Math.sqrt(1 + m22 - m00 - m11) * 2;
    w = (m10 - m01) / s; x = (m02 + m20) / s; y = (m12 + m21) / s; z = s / 4;
  }
  return [x, y, z, w];
}

/**
 * Quaternion de alinhamento por tipo de produto (M070D):
 *
 *  'watch'    → e1 (eixo longo) → +Y  e  e3 (normal do mostrador) → +Z
 *               (relógio em pé, mostrador de frente)
 *  'bracelet' → e3 (eixo do loop/arco) → +Y — o plano do loop fica
 *               PERPENDICULAR a Y, como a pulseira envolve o antebraço.
 *               Sem regra de "mostrador de frente"; e1 → +Z determinístico
 *               só para estabilidade entre execuções.
 *
 * Base ortonormal direita garantida: y, z ortogonalizado, x = y×z.
 */
export function computeAlignmentQuat(pca, mode = 'watch') {
  const primary   = mode === 'bracelet' ? pca.axes[2] : pca.axes[0]; // → +Y
  const secondary = mode === 'bracelet' ? pca.axes[0] : pca.axes[2]; // → +Z
  const y = _norm(_canonicalSign(primary));
  let z   = _canonicalSign(secondary);
  z = _norm([z[0] - _dot(z, y) * y[0], z[1] - _dot(z, y) * y[1], z[2] - _dot(z, y) * y[2]]);
  const x = _cross(y, z);
  return mat3RowsToQuat(x, y, z); // linhas x,y,z ⇒ leva x→X, y→Y, z→Z
}

/**
 * Ângulo Z (graus) que alinha o eixo longo e1 (após rotação de base) com +Y.
 * Normalizado para (−90°, +90°] — ambiguidade 12h/6h fica para flip manual.
 * Retorna também diagnósticos: confiança (√(λ1/λ2)) e facing (|e3.z| pós-giro).
 */
export function computeDialZAngle(pca, basisQuat) {
  const e1 = quatRotate(basisQuat, pca.axes[0]);
  const e3 = quatRotate(basisQuat, pca.axes[2]);

  const planar = Math.hypot(e1[0], e1[1]);
  let zDeg = 0, planarOk = planar > 0.15; // eixo longo quase paralelo a Z → giro Z irrelevante
  if (planarOk) {
    const beta = Math.atan2(e1[1], e1[0]) * 180 / Math.PI; // ângulo vs +X
    zDeg = 90 - beta;                                       // leva e1 a +Y
    while (zDeg > 90)   zDeg -= 180;                        // (−90, 90]
    while (zDeg <= -90) zDeg += 180;
  }

  // facing: |z| da normal do mostrador após base + giro Z
  const rad = zDeg * Math.PI / 180;
  const qz = [0, 0, Math.sin(rad / 2), Math.cos(rad / 2)];
  const e3f = quatRotate(qz, e3);
  const facing = clamp(Math.abs(e3f[2]), 0, 1);

  const confidence = Math.sqrt(pca.evals[0] / Math.max(pca.evals[1], 1e-12));
  return { zDeg, confidence, facing, planarOk };
}
