// bridge-preload.js (MIT) v-bridge-knock-v0.1
// Settings window only. The app preload does not expose these calls.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('bridgeSettings', {
  view: () => ipcRenderer.invoke('fl-bridge-settings-view'),
  saveUrl: (url) => ipcRenderer.invoke('fl-bridge-save-url', url),
  saveKey: (key) => ipcRenderer.invoke('fl-bridge-save-key', key),
  forgetKey: () => ipcRenderer.invoke('fl-bridge-forget-key')
});
