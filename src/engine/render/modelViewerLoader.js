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
 */
export function ensureModelViewer() {
  return new Promise((resolve) => {
    if (window.customElements?.get('model-viewer')) { resolve(); return; }
    _pending.push(resolve);
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
