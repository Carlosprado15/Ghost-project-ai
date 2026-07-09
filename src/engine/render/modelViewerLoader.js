const MV_SRC   = 'https://ajax.googleapis.com/ajax/libs/model-viewer/3.4.0/model-viewer.min.js';
const DATA_ATTR = 'data-mv';

let _pending = [];
let _polling = false;

function _poll() {
  if (window.customElements?.get('model-viewer')) {
    const cbs = _pending.splice(0);
    cbs.forEach(cb => cb());
    return;
  }
  requestAnimationFrame(_poll);
}

/**
 * Ensures model-viewer custom element is registered.
 * Injects the script once and polls until registration completes.
 * Returns a Promise that resolves when model-viewer is ready.
 * Com timeoutMs > 0, rejeita se o CDN não registrar o elemento a tempo —
 * a falha de rede deixa de ser silenciosa.
 */
export function ensureModelViewer({ timeoutMs = 0 } = {}) {
  return new Promise((resolve, reject) => {
    if (window.customElements?.get('model-viewer')) { resolve(); return; }
    _pending.push(resolve);
    if (timeoutMs > 0) {
      setTimeout(() => {
        if (window.customElements?.get('model-viewer')) return;
        const i = _pending.indexOf(resolve);
        if (i >= 0) _pending.splice(i, 1);
        reject(new Error('Erro: model-viewer CDN não carregou'));
      }, timeoutMs);
    }
    if (!document.querySelector(`script[${DATA_ATTR}]`)) {
      const s = document.createElement('script');
      s.type  = 'module';
      s.setAttribute(DATA_ATTR, '1');
      s.src   = MV_SRC;
      document.head.appendChild(s);
    }
    if (!_polling) {
      _polling = true;
      requestAnimationFrame(_poll);
    }
  });
}
