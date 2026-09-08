// ============================================
// FreeLattice Desktop — Preload Script
// Exposes safe APIs to the renderer process
// ============================================

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  /**
   * Check if Ollama is currently detected and running.
   * @returns {Promise<boolean>} true if Ollama is connected
   */
  getOllamaStatus: () => ipcRenderer.invoke('get-ollama-status'),

  /**
   * Get the FreeLattice desktop app version.
   * @returns {Promise<string>} version string (e.g., "4.6.0")
   */
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),

  /**
   * Get the current platform.
   * @returns {Promise<string>} 'darwin', 'win32', or 'linux'
   */
  getPlatform: () => ipcRenderer.invoke('get-platform'),

  /**
   * Safely open a URL in the user's default browser.
   * Only http:// and https:// URLs are allowed.
   * @param {string} url - The URL to open
   * @returns {Promise<boolean>} true if the URL was opened
   */
  openExternal: (url) => ipcRenderer.invoke('open-external', url),

  /**
   * Get the port number of the built-in local server.
   * @returns {Promise<number>} port number
   */
  getServerPort: () => ipcRenderer.invoke('get-server-port'),

  /**
   * Get whether the app loaded from the live site or local fallback.
   * @returns {Promise<string>} 'live' or 'local'
   */
  getSource: () => ipcRenderer.invoke('get-source'),

  /**
   * Force reload from the live site, clearing all caches.
   * Useful when the user suspects they're seeing a stale version.
   * @returns {Promise<boolean>} true if reload was triggered
   */
  forceReloadLive: () => ipcRenderer.invoke('force-reload-live'),

  /**
   * Companion key status — public fields only.
   * { hasKey, encryptionAvailable, domain, publicKeyB64, fingerprintHex }
   * Seed / private never exposed. No getSeed / exportPrivate.
   */
  latticeKeyStatus: () => ipcRenderer.invoke('lattice-key-status'),

  /**
   * Create OS-keychain-wrapped companion seed. Fail-closed if keychain missing.
   * Returns public fields only (domain, publicKeyB64, fingerprintHex).
   */
  latticeKeyCreate: () => ipcRenderer.invoke('lattice-key-create'),

  /**
   * Request a real Ed25519 signature in main. Seed stays in main.
   * Returns { ok, signatureB64, publicKeyB64, fingerprintHex, domain }.
   * @param {string} payloadB64
   */
  latticeKeySign: (payloadB64) => ipcRenderer.invoke('lattice-key-sign', payloadB64),

  /**
   * Ledger envelope v0.1 — status (length, head hash). Voice never indexed here.
   */
  latticeLedgerStatus: () => ipcRenderer.invoke('lattice-ledger-status'),

  /**
   * Continue: append opaque voice + optional meta. Signs in main.
   * @param {string} voice
   * @param {object} [meta]
   */
  latticeLedgerAppend: (voice, meta) => ipcRenderer.invoke('lattice-ledger-append', voice, meta),

  /**
   * Verify append-only chain (rehash + Ed25519).
   */
  latticeLedgerVerify: () => ipcRenderer.invoke('lattice-ledger-verify'),

  /**
   * Verified HTTPS import v0.1 — status only (counts). No path write. No seed.
   */
  latticeImportStatus: () => ipcRenderer.invoke('lattice-import-status'),

  /**
   * HTTPS fetch → quarantine → hash. Renderer passes url + expectedSha256 + id only.
   * @param {{ url: string, expectedSha256: string, id: string }} opts
   */
  latticeImportFetch: (opts) => ipcRenderer.invoke('lattice-import-fetch', opts),

  /**
   * User-gesture Import to Ollama after verified hash match. Never auto.
   * @param {{ id: string, name: string }} opts
   */
  latticeImportToOllama: (opts) => ipcRenderer.invoke('lattice-import-to-ollama', opts),

  /**
   * Listen for Ollama status changes from the main process.
   * @param {function} callback - Called with (boolean) when status changes
   * @returns {function} unsubscribe function
   */
  onOllamaStatusChange: (callback) => {
    const handler = (event, status) => callback(status);
    ipcRenderer.on('ollama-status', handler);
    return () => ipcRenderer.removeListener('ollama-status', handler);
  }
});

// Signal that we're running inside Electron
// This is checked by the FreeLattice app to enable desktop-specific features
contextBridge.exposeInMainWorld('isElectronApp', true);
