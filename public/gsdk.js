(function() {
  'use strict';

  // Oculta imediatamente o botão Liquid legado para evitar flash antes do SDK injetar o correto
  (function() {
    var s = document.createElement('style');
    s.textContent = '.ghost-ar-container,.ghost-ar-button{display:none!important}';
    document.head.appendChild(s);
  })();

  const GHOST_BASE_URL = 'https://ghost-project-ai.vercel.app';

  // SAAPS Foundation 1.0 - Build 5
  const PRODUCT_MAP = {
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

  // GLB paths served from Vercel
  const MODEL_MAP = {
    'CW001': '/models/CW001.glb',
    'CW002': '/models/CW002.glb',
    'CW003': '/models/CW003.glb',
    'CW004': '/models/CW004.glb',
    'CW005': '/models/CW005.glb',
    'CW006': '/models/CW006.glb',
    'CW007': '/models/CW007.glb',
    'CW008': '/models/CW008.glb',
    'CW009': '/models/CW009.glb',
    'CW010': '/models/CW010.glb',
    'CW011': '/models/CW011.glb',
    'CW012': '/models/CW012.glb',
    'CW013': '/models/CW013.glb',
    'CW014': '/models/CW014.glb',
    'CW015': '/models/CW015.glb',
  };

  function isDesktop() {
    return !/Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  function getProductHandle() {
    if (typeof window.__ghostHandle === 'string' && window.__ghostHandle !== '') {
      return window.__ghostHandle;
    }
    const match = window.location.pathname.match(/\/products\/([^/?]+)/);
    return match ? match[1] : null;
  }

  function getProductId() {
    const handle = getProductHandle();
    const productId = handle ? (PRODUCT_MAP[handle] || null) : null;
    console.log('[M045][gsdk] handle:', handle, '| productId:', productId);
    return productId;
  }

  // Carrega model-viewer web component (uma vez por página)
  function loadModelViewer() {
    if (document.querySelector('script[data-ghost-mv]')) return;
    const s = document.createElement('script');
    s.type = 'module';
    s.setAttribute('data-ghost-mv', '1');
    s.src = 'https://ajax.googleapis.com/ajax/libs/model-viewer/3.4.0/model-viewer.min.js';
    document.head.appendChild(s);
  }

  // Cria bloco de preview 360° para injetar diretamente na vitrine
  function create360Viewer(productId) {
    const glbPath = MODEL_MAP[productId];
    if (!glbPath) return null;

    const glbUrl = GHOST_BASE_URL + glbPath;

    const wrap = document.createElement('div');
    wrap.className = 'ghost-360-wrap';

    const mv = document.createElement('model-viewer');
    mv.setAttribute('src', glbUrl);
    mv.setAttribute('auto-rotate', '');
    mv.setAttribute('auto-rotate-delay', '800');
    mv.setAttribute('rotation-per-second', '9deg');
    mv.setAttribute('camera-controls', '');
    mv.setAttribute('disable-zoom', '');
    mv.setAttribute('interaction-prompt', 'none');
    mv.setAttribute('shadow-intensity', '0.8');
    mv.setAttribute('shadow-softness', '1');
    mv.setAttribute('exposure', '1.2');
    mv.setAttribute('environment-image', 'neutral');
    mv.setAttribute('camera-orbit', '12deg 72deg auto');
    mv.setAttribute('field-of-view', '28deg');
    mv.setAttribute('min-camera-orbit', 'auto 25deg auto');
    mv.setAttribute('max-camera-orbit', 'auto 155deg auto');
    mv.style.cssText = 'width:100%;height:100%;background:transparent;display:block;';

    wrap.appendChild(mv);
    return wrap;
  }

  function injectOverlayStyles() {
    if (document.getElementById('ghost-overlay-styles')) return;
    const style = document.createElement('style');
    style.id = 'ghost-overlay-styles';
    style.textContent = `
      #ghost-ar-overlay {
        position: fixed; inset: 0; z-index: 999999;
        background: #000; display: flex; flex-direction: column;
        font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      }
      #ghost-ar-overlay-bar {
        display: flex; align-items: center; padding: 10px 16px;
        background: rgba(0,0,0,0.95); border-bottom: 1px solid rgba(255,255,255,0.08);
        flex-shrink: 0;
      }
      #ghost-ar-overlay-back {
        background: none; border: none; color: rgba(255,255,255,0.75);
        font-size: 14px; letter-spacing: 0.02em; cursor: pointer;
        padding: 6px 0; display: flex; align-items: center; gap: 6px;
      }
      #ghost-ar-overlay-back:hover { color: #fff; }
      #ghost-ar-overlay-frame {
        flex: 1; width: 100%; border: none; display: block;
      }
    `;
    document.head.appendChild(style);
  }

  function openGhostOverlay(url) {
    if (document.getElementById('ghost-ar-overlay')) return;
    injectOverlayStyles();

    function onMessage(e) {
      if (e.data && e.data.type === 'ghost-close') {
        closeGhostOverlay();
        window.removeEventListener('message', onMessage);
      }
    }
    window.addEventListener('message', onMessage);

    const overlay = document.createElement('div');
    overlay.id = 'ghost-ar-overlay';

    const bar = document.createElement('div');
    bar.id = 'ghost-ar-overlay-bar';

    const backBtn = document.createElement('button');
    backBtn.id = 'ghost-ar-overlay-back';
    backBtn.type = 'button';
    backBtn.textContent = '← Voltar para Click & Wear';
    backBtn.addEventListener('click', function () {
      closeGhostOverlay();
      window.removeEventListener('message', onMessage);
    });

    const iframe = document.createElement('iframe');
    iframe.id = 'ghost-ar-overlay-frame';
    iframe.src = url;
    iframe.setAttribute('allow', 'camera; microphone; accelerometer; gyroscope; xr-spatial-tracking; display-capture');
    iframe.allowFullscreen = true;

    bar.appendChild(backBtn);
    overlay.appendChild(bar);
    overlay.appendChild(iframe);
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';
  }

  function closeGhostOverlay() {
    const overlay = document.getElementById('ghost-ar-overlay');
    if (overlay) overlay.remove();
    document.body.style.overflow = '';
  }

  function injectStyles() {
    if (document.querySelector('style[data-ghost-styles]')) return;
    const style = document.createElement('style');
    style.setAttribute('data-ghost-styles', '1');
    style.textContent = `
      .ghost-360-wrap {
        width: 100%;
        height: 300px;
        background: #f8f8f8;
        border-radius: 12px;
        overflow: hidden;
        margin: 16px 0 4px 0;
        cursor: grab;
        display: block;
      }
      .ghost-360-wrap:active {
        cursor: grabbing;
      }
      .ghost-360-label {
        text-align: center;
        font-size: 10px;
        letter-spacing: 0.18em;
        color: rgba(0,0,0,0.30);
        text-transform: uppercase;
        margin: 0 0 10px 0;
        font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      }
      .ghost-ar-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        width: 100%;
        padding: 14px 20px;
        margin: 8px 0;
        background: #0a0a0a;
        color: #fff;
        border: none;
        border-radius: 8px;
        font-size: 13px;
        font-weight: 600;
        letter-spacing: 0.06em;
        text-decoration: none;
        cursor: pointer;
        box-shadow: 0 4px 16px rgba(0,0,0,0.14);
        transition: background 0.25s ease, box-shadow 0.25s ease;
        font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      }
      .ghost-ar-btn:hover {
        background: #1a1a1a;
        box-shadow: 0 8px 24px rgba(0,0,0,0.22);
      }
      .ghost-ar-btn svg {
        opacity: 0.85;
        flex-shrink: 0;
      }
      .ghost-powered {
        text-align: center;
        font-size: 10px;
        color: #bbb;
        letter-spacing: 0.04em;
        margin-top: 4px;
        font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      }
    `;
    document.head.appendChild(style);
  }

  function injectARButton(productId) {
    const productUrl = window.location.href;
    const cartUrl = window.location.origin + '/cart';
    const arUrl = GHOST_BASE_URL +
      '/?productId=' + productId +
      '&productUrl=' + encodeURIComponent(productUrl) +
      '&cartUrl=' + encodeURIComponent(cartUrl) +
      '&embedded=true' +
      '&mode=embedded' +
      '&host=clickwear';

    const embeddedUrl = isDesktop() ? arUrl + '&desktop=1' : arUrl;
    console.log('[M056C][gsdk] embeddedUrl:', embeddedUrl);

    // Viewer 360° — visível diretamente na vitrine da loja
    const viewer360 = create360Viewer(productId);

    const label360 = document.createElement('p');
    label360.className = 'ghost-360-label';
    label360.textContent = 'Preview 3D · Arraste para girar';

    // Botão AR — abre overlay embedded (não navega para fora da loja)
    const btn = document.createElement('button');
    btn.className = 'ghost-ar-btn';
    btn.type = 'button';
    btn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M12 2L2 7l10 5 10-5-10-5z"/>
        <path d="M2 17l10 5 10-5"/>
        <path d="M2 12l10 5 10-5"/>
      </svg>
      Ver em Realidade Aumentada
    `;
    btn.addEventListener('click', function () { openGhostOverlay(embeddedUrl); });

    const powered = document.createElement('p');
    powered.className = 'ghost-powered';
    powered.textContent = 'Powered by Ghost Project AI';

    const selectors = [
      'form[action="/cart/add"]',
      '.product-form',
      '.product__form',
      '[data-product-form]',
      '.shopify-product-form'
    ];

    let form = null;
    for (const sel of selectors) {
      form = document.querySelector(sel);
      if (form) break;
    }

    if (form) {
      if (viewer360) {
        form.parentNode.insertBefore(viewer360, form);
        form.parentNode.insertBefore(label360, form);
      }
      form.parentNode.insertBefore(btn, form);
      form.parentNode.insertBefore(powered, form);
    }
  }

  let lastHandle = null;

  function init() {
    const currentHandle = getProductHandle();
    if (!currentHandle || currentHandle === lastHandle) return;

    const productId = getProductId();
    if (!productId) return;

    lastHandle = currentHandle;

    document.querySelectorAll('.ghost-360-wrap, .ghost-360-label, .ghost-ar-btn, .ghost-powered, .ghost-badge, .ghost-scanner-line, .ghost-ar-container, .ghost-ar-button').forEach(el => el.remove());

    loadModelViewer();
    injectStyles();
    injectARButton(productId);
  }

  setInterval(init, 800);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
