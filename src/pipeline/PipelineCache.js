/**
 * PipelineCache — cache em três camadas para resultados de geração 3D.
 *
 * Camada 1: Map em memória (imediato, por sessão)
 * Camada 2: localStorage (persiste entre sessões, síncrono)
 * Camada 3: IndexedDB (persiste entre sessões, assíncrono, maior capacidade)
 *
 * Índice localStorage: ghost_pipeline_index → [hash1, hash2, ...]
 * Entradas localStorage: ghost_pipeline_{hash} → { model, savedAt }
 * IndexedDB: db "ghost_pipeline", store "models", key = hash
 */

const LS_PREFIX    = 'ghost_pipeline_';
const LS_INDEX_KEY = 'ghost_pipeline_index';
const IDB_DB_NAME  = 'ghost_pipeline';
const IDB_STORE    = 'models';
const IDB_VERSION  = 1;

export class PipelineCache {
  constructor() {
    /** @type {Map<string, { model: string, savedAt: number }>} */
    this._store = new Map();
    this._idb   = null;

    this._loadFromLocalStorage();
    this._openIndexedDB();
  }

  has(imageHash) {
    return this._store.has(imageHash);
  }

  get(imageHash) {
    return this._store.get(imageHash) ?? null;
  }

  save(imageHash, model) {
    const entry = { model, savedAt: Date.now() };
    this._store.set(imageHash, entry);
    this._saveToLocalStorage(imageHash, entry);
    this._saveToIndexedDB(imageHash, entry);
    console.log(`[PipelineCache] Saved — hash: ${imageHash.slice(0, 16)}...`);
  }

  remove(imageHash) {
    const existed = this._store.delete(imageHash);
    if (existed) {
      this._removeFromLocalStorage(imageHash);
      this._removeFromIndexedDB(imageHash);
    }
    return existed;
  }

  clear() {
    this._store.clear();
    this._clearLocalStorage();
    this._clearIndexedDB();
    console.log('[PipelineCache] Cache cleared');
  }

  size() {
    return this._store.size;
  }

  // ─── localStorage ──────────────────────────────────────────────────────────

  _loadFromLocalStorage() {
    try {
      const raw = localStorage.getItem(LS_INDEX_KEY);
      if (!raw) return;
      const index = JSON.parse(raw);
      for (const hash of index) {
        const entry = this._readLS(hash);
        if (entry) this._store.set(hash, entry);
      }
      console.log(`[PipelineCache] Restaurados ${this._store.size} itens do localStorage`);
    } catch (_) {}
  }

  _saveToLocalStorage(hash, entry) {
    try {
      localStorage.setItem(LS_PREFIX + hash, JSON.stringify(entry));
      const index = this._readIndex();
      if (!index.includes(hash)) {
        index.push(hash);
        localStorage.setItem(LS_INDEX_KEY, JSON.stringify(index));
      }
    } catch (_) {}
  }

  _removeFromLocalStorage(hash) {
    try {
      localStorage.removeItem(LS_PREFIX + hash);
      const index = this._readIndex().filter(h => h !== hash);
      localStorage.setItem(LS_INDEX_KEY, JSON.stringify(index));
    } catch (_) {}
  }

  _clearLocalStorage() {
    try {
      const index = this._readIndex();
      for (const hash of index) localStorage.removeItem(LS_PREFIX + hash);
      localStorage.removeItem(LS_INDEX_KEY);
    } catch (_) {}
  }

  _readLS(hash) {
    try {
      const raw = localStorage.getItem(LS_PREFIX + hash);
      return raw ? JSON.parse(raw) : null;
    } catch (_) { return null; }
  }

  _readIndex() {
    try {
      return JSON.parse(localStorage.getItem(LS_INDEX_KEY) || '[]');
    } catch (_) { return []; }
  }

  // ─── IndexedDB ─────────────────────────────────────────────────────────────

  _openIndexedDB() {
    if (typeof indexedDB === 'undefined') return;
    try {
      const req = indexedDB.open(IDB_DB_NAME, IDB_VERSION);

      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE, { keyPath: 'hash' });
        }
      };

      req.onsuccess = (e) => {
        this._idb = e.target.result;
        this._syncFromIndexedDB();
      };

      req.onerror = () => {};
    } catch (_) {}
  }

  _syncFromIndexedDB() {
    if (!this._idb) return;
    try {
      const tx    = this._idb.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req   = store.getAll();
      req.onsuccess = () => {
        let added = 0;
        for (const item of req.result ?? []) {
          if (!this._store.has(item.hash)) {
            this._store.set(item.hash, { model: item.model, savedAt: item.savedAt });
            added++;
          }
        }
        if (added > 0) console.log(`[PipelineCache] +${added} itens do IndexedDB`);
      };
    } catch (_) {}
  }

  _saveToIndexedDB(hash, entry) {
    if (!this._idb) return;
    try {
      const tx    = this._idb.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      store.put({ hash, ...entry });
    } catch (_) {}
  }

  _removeFromIndexedDB(hash) {
    if (!this._idb) return;
    try {
      const tx    = this._idb.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      store.delete(hash);
    } catch (_) {}
  }

  _clearIndexedDB() {
    if (!this._idb) return;
    try {
      const tx    = this._idb.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      store.clear();
    } catch (_) {}
  }
}
