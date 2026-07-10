console.log("M051 carregado");
(function () {
  'use strict';

  var PRODUCT_MAP = {
    'relogio-casio-para-neutro-2023-novos-estilos-definir-marca-superior-de-luxo-a-pr': 'CW001',
    'nidin-moda-banhado-a-ouro-corrente-mistura-pulseira-para-mulheres-colorido-crist': 'CW002',
    'vinterly-pulseiras-magneticas-de-cobre-puro-para-mulheres-joias-de-terapia-vint': 'CW003',
    'pulseiras-de-cobre-puro-vinterly-estilo-viking-yggdrasil-15mm-ajustaveis-joi': 'CW004',
    'pulseira-magnetico-bioquantico-de-equilibrio-original': 'CW005',
    'bluetooth-conectado-telefone-relogio-inteligente-das-mulheres-dos-homens-musica': 'CW006',
    'amoled-relogio-inteligente-banda-smartwatch-feminino-masculino-frequencia-cardia': 'CW007',
    'curren-relogio-de-ouro-feminino-relogios-senhoras-criativo-aco-pulseira-relogios': 'CW008',
    'diamante-relogio-feminino-marca-de-luxo-2025-strass-elegante-senhoras-relogios-r': 'CW009',
    'novo-relogio-inteligente-masculino-de-2-01-polegadas-para-atividades-ao-ar-livre': 'CW010',
    'gps-ecg-ppg-bluetooth-chamada-smartwatch-pulseira-esportiva-relogio-inteligent': 'CW011',
    'curren-relogios-masculinos-marca-superior-de-luxo-moda-amp-casual-negocios-rel': 'CW012',
    'reloj-hombre-2023-relogio-masculino-minimalista-ultra-fino-relogios-moda-masculi': 'CW013',
    'curren-relogio-de-pulso-masculino-cronografo-a-prova-d-39-agua-militar-do-exe': 'CW014',
    'relogio-masculino-2023-moda-masculino-relogios-de-luxo-aco-inoxidavel-quartzo-re': 'CW015'
  };

  // Caminho do modelo por produto. Padrão = arquivo calibrado (normalized).
  // CW008/CW011 ficam no bruto: no calibrado o mostrador deles vira pro lado do
  // pulso e não aparece em nenhum ângulo do 360°.
  var HOST = 'https://ghost-project-ai.vercel.app';
  var MODEL_PATH = {
    'CW008': '/models/CW008.glb',
    'CW011': '/models/CW011.glb'
  };
  function modelUrlFor(code) {
    return HOST + (MODEL_PATH[code] || ('/models/normalized/' + code + '.glb'));
  }

  // Ângulo inicial da câmera; CW006/CW009 precisam girar pra pegar o mostrador.
  var DEFAULT_ORBIT = '12deg 72deg auto';
  var DISPLAY_ORBIT = {
    'CW006': '300deg 72deg auto',
    'CW009': '190deg 72deg auto'
  };
  var mvReady = false;
  var mvCallbacks = [];
  var modal, backdrop, mount, closeBtn, productName, loadingEl;
  var closeTimer;
  var initialized = false;

  function loadMV(cb) {
    if (mvReady) { cb(); return; }
    if (customElements.get('model-viewer')) { mvReady = true; cb(); return; }
    mvCallbacks.push(cb);
    if (mvCallbacks.length > 1) return;
    var s = document.createElement('script');
    s.type = 'module';
    s.src = 'https://ajax.googleapis.com/ajax/libs/model-viewer/3.4.0/model-viewer.min.js';
    s.onload = function () {
      mvReady = true;
      mvCallbacks.forEach(function (fn) { fn(); });
      mvCallbacks = [];
    };
    document.head.appendChild(s);
  }

  function getProductTitle(btn) {
    return btn.getAttribute('data-product-title') || '';
  }

  function showLoading() {
    if (loadingEl) loadingEl.classList.remove('cw-360-hidden');
  }

  function hideLoading() {
    if (loadingEl) loadingEl.classList.add('cw-360-hidden');
  }

  function destroyViewer() {
    if (!mount) return;
    while (mount.firstChild) {
      mount.removeChild(mount.firstChild);
    }
  }

  function buildViewer(code) {
    var mv = document.createElement('model-viewer');
    mv.setAttribute('src', modelUrlFor(code));
    mv.setAttribute('camera-orbit', DISPLAY_ORBIT[code] || DEFAULT_ORBIT);
    mv.setAttribute('camera-controls', '');
    mv.setAttribute('auto-rotate', '');
    mv.setAttribute('auto-rotate-delay', '3000');
    mv.setAttribute('rotation-per-second', '14deg');
    mv.setAttribute('shadow-intensity', '0.8');
    mv.setAttribute('exposure', '0.9');
    mv.setAttribute('touch-action', 'pan-y');
    mv.style.cssText = 'width:100%;height:100%;display:block;';
    mv.addEventListener('load', hideLoading);
    mv.addEventListener('error', hideLoading);
    return mv;
  }

  function openModal(code, title) {
    clearTimeout(closeTimer);
    loadMV(function () {
      if (productName) productName.textContent = title || '';
      showLoading();
      destroyViewer();
      mount.appendChild(buildViewer(code));
      modal.removeAttribute('aria-hidden');
      modal.style.display = 'flex';
      document.body.style.overflow = 'hidden';
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          modal.classList.add('cw-360-open');
        });
      });
    });
  }

  function closeModal() {
    modal.classList.remove('cw-360-open');
    document.body.style.overflow = '';
    modal.setAttribute('aria-hidden', 'true');
    clearTimeout(closeTimer);
    closeTimer = setTimeout(function () {
      modal.style.display = 'none';
      destroyViewer();
      hideLoading();
    }, 260);
  }

  function init() {
    if (initialized) return;
    initialized = true;

    modal = document.getElementById('cw-360-modal');
    if (!modal) return;
    backdrop = document.getElementById('cw-360-backdrop');
    mount = document.getElementById('cw-360-viewer-mount');
    closeBtn = document.getElementById('cw-360-close');
    productName = document.getElementById('cw-360-product-name');
    loadingEl = document.getElementById('cw-360-loading');

    closeBtn.addEventListener('click', closeModal);
    backdrop.addEventListener('click', closeModal);

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !modal.hasAttribute('aria-hidden')) closeModal();
    });

    document.addEventListener('click', function (e) {
      var btn = e.target.closest('.cw-360-hint[data-cw-handle]');
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      var handle = btn.getAttribute('data-cw-handle');
      var code = PRODUCT_MAP[handle];
      var title = getProductTitle(btn);
      console.log('Produto clicado:', title, '\nHandle:', handle, '\nCW:', code, '\nGLB:', code ? modelUrlFor(code) : 'N/A');
      if (code) openModal(code, title);
    }, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
