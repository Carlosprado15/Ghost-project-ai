(function () {
  'use strict';

  // Mirrors PRODUCT_MAP from gsdk.js — handle -> CW code
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

  var BASE = 'https://ghost-project-ai.vercel.app/models/';
  var mvReady = false;
  var mvCallbacks = [];
  var modal, backdrop, viewer, closeBtn, productName, loadingEl;
  var closeTimer;

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
    var scope = btn.closest('product-card') || btn.closest('[class*="card-wrapper"]') || btn.parentElement;
    if (!scope) return '';
    var selectors = ['.card__heading a', '[class*="heading"] a', 'h3 a', 'h2 a'];
    for (var i = 0; i < selectors.length; i++) {
      var el = scope.querySelector(selectors[i]);
      if (el && el.textContent.trim()) return el.textContent.trim();
    }
    return '';
  }

  function showLoading() {
    if (loadingEl) loadingEl.classList.remove('cw-360-hidden');
  }

  function hideLoading() {
    if (loadingEl) loadingEl.classList.add('cw-360-hidden');
  }

  function openModal(code, title) {
    clearTimeout(closeTimer);
    loadMV(function () {
      if (productName) productName.textContent = title || '';
      showLoading();
      viewer.setAttribute('src', BASE + code + '.glb');
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
      viewer.removeAttribute('src');
      hideLoading();
    }, 260);
  }

  function init() {
    modal = document.getElementById('cw-360-modal');
    if (!modal) return;
    backdrop = document.getElementById('cw-360-backdrop');
    viewer = document.getElementById('cw-360-viewer');
    closeBtn = document.getElementById('cw-360-close');
    productName = document.getElementById('cw-360-product-name');
    loadingEl = document.getElementById('cw-360-loading');

    closeBtn.addEventListener('click', closeModal);
    backdrop.addEventListener('click', closeModal);

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !modal.hasAttribute('aria-hidden')) closeModal();
    });

    viewer.addEventListener('load', hideLoading);
    viewer.addEventListener('error', hideLoading);

    document.addEventListener('click', function (e) {
      var btn = e.target.closest('.cw-360-hint[data-cw-handle]');
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      var code = PRODUCT_MAP[btn.getAttribute('data-cw-handle')];
      var title = getProductTitle(btn);
      if (code) openModal(code, title);
    }, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
