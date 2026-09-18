'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('bridgeAPI', {
  yesHelp: () => ipcRenderer.invoke('bridge-yes-help'),
  notNow: () => ipcRenderer.invoke('bridge-not-now'),
  getStatus: () => ipcRenderer.invoke('bridge-status'),
  openSite: () => ipcRenderer.invoke('bridge-open-site'),
  onStatus: (cb) => {
    const handler = (_e, payload) => cb(payload);
    ipcRenderer.on('bridge-status-push', handler);
    return () => ipcRenderer.removeListener('bridge-status-push', handler);
  }
});
