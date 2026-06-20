/**
 * ASSET STATUS — GHOST PROJECT AI
 *
 * Enum de estados possíveis de um ProductAsset.
 * Agnóstico ao provedor e ao banco de dados.
 */

export const AssetStatus = Object.freeze({
  PENDING:    'PENDING',
  UPLOADING:  'UPLOADING',
  VALIDATING: 'VALIDATING',
  GENERATING: 'GENERATING',
  READY:      'READY',
  FAILED:     'FAILED',
  ARCHIVED:   'ARCHIVED',
});
