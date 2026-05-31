
export const GhostEvents = (() => {
  const listeners = {};

  const on = (event, callback) => {
    if (!listeners[event]) {
      listeners[event] = [];
    }
    listeners[event].push(callback);
  };

  const off = (event, callback) => {
    if (!listeners[event]) return;
    listeners[event] = listeners[event].filter(cb => cb !== callback);
  };

  const emit = (event, data) => {
    if (!listeners[event]) return;
    listeners[event].forEach(callback => callback(data));
  };

  return {
    on,
    off,
    emit,
  };
})();
