'use strict';
/**
 * FreeLattice Bridge — thin www → local mind helper
 * Marker: v-bridge-binary-www-local-v0
 * One job: CORS-safe proxy to Ollama. Not a second Desktop.
 */

const { app, BrowserWindow, Tray, Menu, nativeImage, shell, ipcMain } = require('electron');
const path = require('path');
const {
  BRIDGE_PORT,
  createBridgeServer,
  checkOllama
} = require('./proxy-core');

const APP_NAME = 'FreeLattice Bridge';
let mainWindow = null;
let tray = null;
let bridgeServer = null;
let helped = false;
let ollamaOk = false;

function getMeta() {
  return {
    version: app.getVersion(),
    helped: helped
  };
}

function pushStatus() {
  const payload = { helped: helped, ollama: ollamaOk, port: BRIDGE_PORT };
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('bridge-status-push', payload);
  }
  if (tray) updateTray();
}

async function refreshOllama() {
  ollamaOk = await checkOllama();
  pushStatus();
  return ollamaOk;
}

function startProxy() {
  if (bridgeServer) return;
  bridgeServer = createBridgeServer({ getMeta: getMeta });
  bridgeServer.listen(BRIDGE_PORT, '127.0.0.1', function () {
    console.log('[Bridge] listening on http://127.0.0.1:' + BRIDGE_PORT);
  });
  bridgeServer.on('error', function (err) {
    console.error('[Bridge] server error', err && err.message);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 440,
    height: 420,
    title: APP_NAME,
    backgroundColor: '#0c0a1a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  mainWindow.loadFile(path.join(__dirname, 'ui', 'first-door.html'));
  mainWindow.on('close', function (e) {
    // Keep Bridge running in tray — hide instead of quit
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

function updateTray() {
  if (!tray) return;
  const label = helped
    ? ollamaOk
      ? 'Bridge on · Ollama found'
      : 'Bridge on · Ollama missing'
    : 'Bridge waiting · Yes, help';
  const menu = Menu.buildFromTemplate([
    { label: label, enabled: false },
    { type: 'separator' },
    {
      label: 'Open freelattice.com',
      click: function () {
        shell.openExternal('https://freelattice.com');
      }
    },
    {
      label: 'Show Bridge',
      click: function () {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    {
      label: 'Status / refresh',
      click: function () {
        refreshOllama();
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Quit Bridge',
      click: function () {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);
  tray.setContextMenu(menu);
  tray.setToolTip(APP_NAME + ' — ' + label);
}

function createTray() {
  // Minimal tray icon — 16x16 emerald square if no asset
  let img = nativeImage.createEmpty();
  try {
    const iconPath = path.join(__dirname, 'assets', 'icon.png');
    const fs = require('fs');
    if (fs.existsSync(iconPath)) {
      img = nativeImage.createFromPath(iconPath);
    }
  } catch (e) {}
  if (img.isEmpty()) {
    // 16x16 gold-ish PNG data URL fallback via nativeImage from buffer
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAKElEQVQ4T2NkYGD4z0ABYBzVMKoBVAOGbwOYGBgY/mPQjGpANQAAXG0CAelG6y0AAAAASUVORK5CYII=',
      'base64'
    );
    img = nativeImage.createFromBuffer(png);
  }
  tray = new Tray(img);
  updateTray();
  tray.on('click', function () {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

function wireIpc() {
  ipcMain.handle('bridge-yes-help', async function () {
    helped = true;
    await refreshOllama();
    return { helped: helped, ollama: ollamaOk, port: BRIDGE_PORT };
  });
  ipcMain.handle('bridge-not-now', async function () {
    // Stay running but do not proxy until Yes
    helped = false;
    pushStatus();
    return { helped: false };
  });
  ipcMain.handle('bridge-status', async function () {
    await refreshOllama();
    return { helped: helped, ollama: ollamaOk, port: BRIDGE_PORT, version: app.getVersion() };
  });
  ipcMain.handle('bridge-open-site', async function () {
    shell.openExternal('https://freelattice.com');
    return true;
  });
}

app.whenReady().then(function () {
  startProxy();
  wireIpc();
  createWindow();
  createTray();
  refreshOllama();
  setInterval(refreshOllama, 15000);
});

app.on('before-quit', function () {
  app.isQuitting = true;
  if (bridgeServer) {
    try {
      bridgeServer.close();
    } catch (e) {}
  }
});

app.on('window-all-closed', function (e) {
  // Stay alive for tray + proxy on all platforms
  e.preventDefault();
});
