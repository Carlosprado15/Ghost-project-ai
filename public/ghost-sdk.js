
(function() {
  'use strict';

const GHOST_BASE_URL = 'https://ghost-project-ai-bbvc.vercel.app';

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

  function getProductHandle() {
    const match = window.location.pathname.match(/\/products\/([^/?]+)/);
    return match ? match[1] : null;
  }

  function getProductId() {
    const handle = getProductHandle();
    return handle ? PRODUCT_MAP[handle] : null;
  }

  function injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .ghost-scanner-wrapper {
        position: relative;
        overflow: hidden;
      }
      .ghost-scanner-line {
        position: absolute;
        top: 0;
        left: -100%;
        width: 40%;
        height: 100%;
        background: linear-gradient(
          90deg,
          transparent 0%,
          rgba(212, 175, 55, 0.08) 40%,
          rgba(212, 175, 55, 0.18) 50%,
          rgba(255, 255, 255, 0.12) 52%,
          rgba(212, 175, 55, 0.08) 60%,
          transparent 100%
        );
        animation: ghostScan 4s ease-in-out infinite;
        pointer-events: none;
        z-index: 10;
      }
      @keyframes ghostScan {
        0% { left: -40%; }
        100% { left: 140%; }
      }
      .ghost-badge {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 14px;
        margin: 16px 0 10px 0;
        background: rgba(0,0,0,0.04);
        border: 1px solid rgba(212,175,55,0.25);
        border-radius: 6px;
        font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      }
      .ghost-badge-icon {
        width: 18px;
        height: 18px;
        opacity: 0.75;
      }
      .ghost-badge-text {
        display: flex;
        flex-direction: column;
      }
      .ghost-badge-title {
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.08em;
        color: #1a1a1a;
        text-transform: uppercase;
      }
      .ghost-badge-subtitle {
        font-size: 10px;
        color: #888;
        letter-spacing: 0.02em;
      }
      .ghost-ar-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        width: 100%;
        padding: 14px 20px;
        margin: 8px 0;
        background: rgba(10,10,10,0.92);
        color: #fff;
        border: 1px solid rgba(212,175,55,0.3);
        border-radius: 8px;
        font-size: 13px;
        font-weight: 600;
        letter-spacing: 0.06em;
        text-decoration: none;
        cursor: pointer;
        position: relative;
        overflow: hidden;
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        box-shadow:
          0 0 0 0 rgba(212,175,55,0),
          inset 0 0 20px rgba(212,175,55,0.03);
        animation: ghostBreathe 4s ease-in-out infinite;
        font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      }
      @keyframes ghostBreathe {
        0%, 100% {
          box-shadow:
            0 0 8px rgba(212,175,55,0.08),
            inset 0 0 20px rgba(212,175,55,0.03);
          border-color: rgba(212,175,55,0.25);
        }
        50% {
          box-shadow:
            0 0 20px rgba(212,175,55,0.18),
            inset 0 0 30px rgba(212,175,55,0.07);
          border-color: rgba(212,175,55,0.5);
        }
      }
      .ghost-ar-btn svg {
        opacity: 0.85;
        flex-shrink: 0;
      }
      .ghost-powered {
        text-align: center;
        font-size: 10px;
        color: #aaa;
        letter-spacing: 0.04em;
        margin-top: 4px;
        font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      }
    `;
    document.head.appendChild(style);
  }

  function injectScannerOnImage() {
    const selectors = [
      '.product__media-item img',
      '.product-media-container img',
      '.product__photo img',
      '.featured-image img',
      '[data-product-featured-image]',
      '.product-image img'
    ];

    let productImg = null;
    for (const sel of selectors) {
      productImg = document.querySelector(sel);
      if (productImg) break;
    }

    if (!productImg) return;

    const wrapper = productImg.closest('div') || productImg.parentElement;
    if (!wrapper) return;

    wrapper.style.position = 'relative';
    wrapper.style.overflow = 'hidden';

    const scanLine = document.createElement('div');
    scanLine.className = 'ghost-scanner-line';
    wrapper.appendChild(scanLine);
  }

  function injectARButton(productId) {
    const productUrl = window.location.href;
    const cartUrl = new URLSearchParams(window.location.search).get('cartUrl');
    const productUrl = window.location.href;

    const arButton = document.createElement('button');
    arButton.className = 'ghost-ar-btn';
    arButton.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 3C10.3431 3 9 4.34315 9 6C9 7.65685 10.3431 9 12 9C13.6569 9 15 7.65685 15 6C15 4.34315 13.6569 3 12 3Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M12 12C10.3431 12 9 13.3431 9 15C9 16.6569 10.3431 18 12 18C13.6569 18 15 16.6569 15 15C15 13.3431 13.6569 12 12 12Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M12 21C10.3431 21 9 22.3431 9 24C9 25.6569 10.3431 27 12 27C13.6569 27 15 25.6569 15 24C15 22.3431 13.6569 21 12 21Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M12 9V12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M12 18V21" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M6 12H9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M15 12H18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M3 12H6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M18 12H21" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      EXPERIMENTE EM REALIDADE AUMENTADA
    `;
    arButton.onclick = () => {
      window.open(`${GHOST_BASE_URL}?productId=${productId}&productUrl=${encodeURIComponent(productUrl)}&cartUrl=${encodeURIComponent(cartUrl)}`, '_blank');
    };

    const targetElement = document.querySelector('.product-form__buttons') || document.querySelector('.product-form__controls-group');
    if (targetElement) {
      targetElement.parentNode.insertBefore(arButton, targetElement.nextSibling);
    }
  }

  function init() {
    const productId = getProductId();
    if (productId) {
      injectStyles();
      injectScannerOnImage();
      injectARButton(productId);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
