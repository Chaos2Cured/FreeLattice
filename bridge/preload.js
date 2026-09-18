'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('bridgeAPI', {
  yesHelp: () => ipcRenderer.invoke('bridge-yes-help'),
  notNow: () => ipcRenderer.invoke('bridge-not-now'),
  getStatus: () => ipcRenderer.invoke('bridge-status'),
  openSite: () => ipcRenderer.invoke('bridge-open-site'),
  setPort: (port) => ipcRenderer.invoke('bridge-set-port', port),
  tryNextPort: () => ipcRenderer.invoke('bridge-try-next-port'),
  addOrigin: (origin) => ipcRenderer.invoke('bridge-add-origin', origin),
  onStatus: (cb) => {
    const handler = (_e, payload) => cb(payload);
    ipcRenderer.on('bridge-status-push', handler);
    return () => ipcRenderer.removeListener('bridge-status-push', handler);
  }
});
