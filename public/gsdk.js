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
      .ghost-ar-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 11px;
        width: 100%;
        padding: 16px 20px;
        margin: 26px 0 0 0;
        background: linear-gradient(100deg,#0a0a0a,#1c1c1c);
        color: #fff;
        border: 1px solid rgba(212,175,55,0.6);
        border-radius: 12px;
        font-size: 15px;
        font-weight: 700;
        letter-spacing: 0.02em;
        text-decoration: none;
        cursor: pointer;
        font-family: -apple-system, BlinkMacSystemFont, sans-serif;
        animation: ghostCtaGlow 2.8s ease-in-out infinite;
      }
      .ghost-ar-btn:hover { background: #141414; }
      .ghost-ar-btn svg { color: #ecc96b; flex-shrink: 0; }
      .ghost-ar-btn__ar { color: #ecc96b; }
      @keyframes ghostCtaGlow {
        0%,100% { box-shadow: 0 8px 22px rgba(0,0,0,0.22), 0 0 0 0 rgba(212,175,55,0.5); }
        50%     { box-shadow: 0 8px 22px rgba(0,0,0,0.22), 0 0 0 10px rgba(212,175,55,0); }
      }
      @media (prefers-reduced-motion: reduce) { .ghost-ar-btn { animation: none; } }
      .ghost-ar-sub {
        text-align: center;
        font-size: 12px;
        color: #8a8a8a;
        margin: 9px 0 0 0;
        font-family: -apple-system, BlinkMacSystemFont, sans-serif;
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

  function buildArUrl(productId, productUrl) {
    const cartUrl = window.location.origin + '/cart';
    const arUrl = GHOST_BASE_URL +
      '/?productId=' + productId +
      '&productUrl=' + encodeURIComponent(productUrl) +
      '&cartUrl=' + encodeURIComponent(cartUrl) +
      '&embedded=true' +
      '&mode=embedded' +
      '&host=clickwear';

    return isDesktop() ? arUrl + '&desktop=1' : arUrl;
  }

  function injectARButton(productId) {
    const embeddedUrl = buildArUrl(productId, window.location.href);
    console.log('[M056C][gsdk] embeddedUrl:', embeddedUrl);

    // Prévia 3D removida da página do produto: o modelo ainda não tem qualidade
    // de foto. A página mostra as fotos reais (galeria nativa) + botão de AR.

    // Botão AR — abre overlay embedded (não navega para fora da loja)
    const btn = document.createElement('button');
    btn.className = 'ghost-ar-btn';
    btn.type = 'button';
    btn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
        <path d="M12 2L2 7l10 5 10-5-10-5z"/>
        <path d="M2 17l10 5 10-5"/>
        <path d="M2 12l10 5 10-5"/>
      </svg>
      Ver no meu pulso — <span class="ghost-ar-btn__ar">AR</span>
    `;
    btn.addEventListener('click', function () { openGhostOverlay(embeddedUrl); });

    const sub = document.createElement('p');
    sub.className = 'ghost-ar-sub';
    sub.textContent = 'Use a câmera do celular · não precisa instalar nada';

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
      form.parentNode.insertBefore(btn, form);
      form.parentNode.insertBefore(sub, form);
      form.parentNode.insertBefore(powered, form);
    }
  }

  // Botão AR nos cards da vitrine (marcação em snippets/card-gallery.liquid).
  // Fase de captura + stopPropagation para vencer o <a> que cobre o card inteiro.
  document.addEventListener('click', function (e) {
    const btn = e.target.closest && e.target.closest('.cw-ar-hint[data-cw-handle]');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    const handle = btn.getAttribute('data-cw-handle');
    const productId = PRODUCT_MAP[handle];
    if (!productId) return;
    openGhostOverlay(buildArUrl(productId, window.location.origin + '/products/' + handle));
  }, true);

  // Produtos sem modelo 3D não devem exibir um botão que não faz nada
  function pruneUnmappedARHints() {
    document.querySelectorAll('.cw-ar-hint[data-cw-handle]').forEach(function (btn) {
      if (!PRODUCT_MAP[btn.getAttribute('data-cw-handle')]) btn.remove();
    });
  }

  // ── Vitrine viva: as fotos reais do produto passam sozinhas no card ──
  // Marcação `.cw-live` (com várias <img>) vem de snippets/card-gallery.liquid.
  // Usa só as fotos que o produto já tem na loja — nada de 3D. A cada intervalo
  // avançamos a foto "ativa" de cada card com um crossfade suave (CSS).
  var LIVE_INTERVAL = 2800; // ms por foto
  function driveLiveVitrine() {
    var groups = document.querySelectorAll('.cw-live');
    for (var i = 0; i < groups.length; i++) {
      var g = groups[i];
      var imgs = g.querySelectorAll('.cw-live__img');
      if (imgs.length < 2) continue;
      var cur = g.__cwIdx || 0;
      var next = (cur + 1) % imgs.length;
      imgs[cur].classList.remove('on');
      imgs[next].classList.add('on');
      g.__cwIdx = next;
    }
  }
  setInterval(driveLiveVitrine, LIVE_INTERVAL);

  let lastHandle = null;

  function init() {
    pruneUnmappedARHints();

    const currentHandle = getProductHandle();
    if (!currentHandle || currentHandle === lastHandle) return;

    const productId = getProductId();
    if (!productId) return;

    lastHandle = currentHandle;

    document.querySelectorAll('.ghost-ar-btn, .ghost-ar-sub, .ghost-powered, .ghost-badge, .ghost-scanner-line, .ghost-ar-container, .ghost-ar-button').forEach(el => el.remove());

    injectStyles();
    injectARButton(productId);
  }

  // Roda em toda página: cuida da página de produto (botão AR).
  // A vitrine viva (fotos passando) roda no próprio setInterval acima.
  function tick() {
    init();
  }

  setInterval(tick, 800);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tick);
  } else {
    tick();
  }

})();
