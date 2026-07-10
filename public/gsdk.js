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

  // Modelos do preview 360°. Padrão = arquivo calibrado (normalized), que é o
  // que assenta certo no pulso e, com a câmera padrão, também mostra bem a peça.
  // Exceções CW008/CW011: no arquivo calibrado o mostrador fica virado pro lado
  // do pulso e não aparece em nenhum ângulo do 360° — usamos o bruto nesses dois.
  const MODEL_MAP = {
    'CW001': '/models/normalized/CW001.glb',
    'CW002': '/models/normalized/CW002.glb',
    'CW003': '/models/normalized/CW003.glb',
    'CW004': '/models/normalized/CW004.glb',
    'CW005': '/models/normalized/CW005.glb',
    'CW006': '/models/normalized/CW006.glb',
    'CW007': '/models/normalized/CW007.glb',
    'CW008': '/models/CW008.glb',
    'CW009': '/models/normalized/CW009.glb',
    'CW010': '/models/normalized/CW010.glb',
    'CW011': '/models/CW011.glb',
    'CW012': '/models/normalized/CW012.glb',
    'CW013': '/models/normalized/CW013.glb',
    'CW014': '/models/normalized/CW014.glb',
    'CW015': '/models/normalized/CW015.glb',
  };

  // Ângulo inicial da câmera do 360°. Padrão para todos; CW006/CW009 precisam de
  // um giro pra câmera pegar o mostrador do arquivo calibrado de frente.
  const DEFAULT_ORBIT = '12deg 72deg auto';
  const DISPLAY_ORBIT = {
    'CW006': '300deg 72deg auto',
    'CW009': '190deg 72deg auto',
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

  // URL do vídeo de giro (pré-renderizado) de um produto
  function spinUrl(productId) {
    return GHOST_BASE_URL + '/spins/' + productId + '.mp4';
  }

  // Bloco de giro automático (vídeo) para a página do produto.
  // Substitui o antigo girador manual (model-viewer) — o produto gira sozinho.
  function create360Viewer(productId) {
    if (!MODEL_MAP[productId]) return null;

    const wrap = document.createElement('div');
    wrap.className = 'ghost-360-wrap';

    const vid = document.createElement('video');
    vid.src = spinUrl(productId);
    vid.autoplay = true;
    vid.loop = true;
    vid.muted = true;
    vid.setAttribute('muted', '');
    vid.setAttribute('playsinline', '');
    vid.setAttribute('preload', 'metadata');
    vid.style.cssText = 'width:100%;height:100%;object-fit:contain;background:#fff;display:block;';
    vid.play && vid.play().catch(function () {});

    wrap.appendChild(vid);
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

    // Viewer 360° — visível diretamente na vitrine da loja
    const viewer360 = create360Viewer(productId);

    const label360 = document.createElement('p');
    label360.className = 'ghost-360-label';
    label360.textContent = 'Preview 3D · 360°';

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

  // ── Vitrine viva: giro automático (vídeo) nos cards ──
  // Marcação `.cw-spin[data-cw-handle]` vem de snippets/card-gallery.liquid.
  // O vídeo só é baixado quando o card está perto de aparecer na tela.
  function loadSpinInto(el, productId) {
    if (el.__cwLoaded) return;
    el.__cwLoaded = true;
    var v = document.createElement('video');
    v.src = spinUrl(productId);
    v.autoplay = true; v.loop = true; v.muted = true;
    v.setAttribute('muted', '');
    v.setAttribute('playsinline', '');
    v.setAttribute('preload', 'none');
    v.addEventListener('loadeddata', function () { el.classList.add('cw-spin--ready'); });
    el.appendChild(v);
    if (v.play) v.play().catch(function () {});
  }

  var spinObserver = ('IntersectionObserver' in window) ? new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      var el = en.target;
      var code = PRODUCT_MAP[el.getAttribute('data-cw-handle')];
      if (code) loadSpinInto(el, code);
      spinObserver.unobserve(el);
    });
  }, { rootMargin: '250px' }) : null;

  function initVitrineSpins() {
    document.querySelectorAll('.cw-spin[data-cw-handle]:not([data-cw-seen])').forEach(function (el) {
      el.setAttribute('data-cw-seen', '1');
      var code = PRODUCT_MAP[el.getAttribute('data-cw-handle')];
      if (!code) { el.remove(); return; } // produto sem giro: some e mostra a foto normal
      if (spinObserver) spinObserver.observe(el); else loadSpinInto(el, code);
    });
  }

  let lastHandle = null;

  function init() {
    pruneUnmappedARHints();

    const currentHandle = getProductHandle();
    if (!currentHandle || currentHandle === lastHandle) return;

    const productId = getProductId();
    if (!productId) return;

    lastHandle = currentHandle;

    document.querySelectorAll('.ghost-360-wrap, .ghost-360-label, .ghost-ar-btn, .ghost-powered, .ghost-badge, .ghost-scanner-line, .ghost-ar-container, .ghost-ar-button').forEach(el => el.remove());

    injectStyles();
    injectARButton(productId);
  }

  // Roda em toda página: cuida da vitrine (giro nos cards) e da página de produto.
  function tick() {
    initVitrineSpins();
    init();
  }

  setInterval(tick, 800);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tick);
  } else {
    tick();
  }

})();
