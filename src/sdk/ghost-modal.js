export const GhostModal = (() => {
  let modalElement = null;

  const createModalElement = () => {
    modalElement = document.createElement('div');
    modalElement.id = 'ghost-project-modal';
    modalElement.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.8);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 9999;
      visibility: hidden;
      opacity: 0;
      transition: visibility 0s, opacity 0.3s linear;
    `;

    const closeButton = document.createElement('button');
    closeButton.innerText = 'X';
    closeButton.style.cssText = `
      position: absolute;
      top: 20px;
      right: 20px;
      background-color: white;
      border: none;
      border-radius: 50%;
      width: 40px;
      height: 40px;
      font-size: 20px;
      cursor: pointer;
      z-index: 10000;
    `;
    closeButton.onclick = close;

    modalElement.appendChild(closeButton);
    document.body.appendChild(modalElement);
  };

  const open = (url) => {
    if (!modalElement) {
      createModalElement();
    }
    modalElement.style.visibility = 'visible';
    modalElement.style.opacity = '1';
    document.body.style.overflow = 'hidden'; // Bloqueia o scroll da página

    let iframe = modalElement.querySelector('iframe');
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.style.cssText = `
        width: 100%;
        height: 100%;
        border: none;
      `;
      modalElement.appendChild(iframe);
    }
    iframe.src = url;
  };

  const close = () => {
    if (modalElement) {
      modalElement.style.visibility = 'hidden';
      modalElement.style.opacity = '0';
      document.body.style.overflow = 'auto'; // Restaura o scroll da página

      // Remove o iframe ao fechar o modal
      let iframe = modalElement.querySelector('iframe');
      if (iframe) {
        iframe.remove();
      }
    }
  };

  // Listener para mensagens do iframe (ex: "ghost-project-close")
  window.addEventListener('message', (event) => {
    if (event.data === 'ghost-project-close') {
      close();
    }
  });


  return {
    open,
    close,
  };
})();
