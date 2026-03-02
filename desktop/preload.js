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
