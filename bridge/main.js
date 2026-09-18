'use strict';
/**
 * FreeLattice Bridge — thin www → local mind helper
 * Markers: v-bridge-binary-www-local-v0 · v-bridge-win-linux-port-friction-v0
 * One job: CORS-safe proxy to Ollama. Not a second Desktop.
 * Port channel default 11435 — never steal Ollama 11434.
 */

const { app, BrowserWindow, Tray, Menu, nativeImage, shell, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const {
  BRIDGE_PORT_DEFAULT,
  OLLAMA_PORT,
  createBridgeServer,
  checkOllama,
  findFreePort,
  resolvePreferredPort,
  addAllowedOrigin
} = require('./proxy-core');

const APP_NAME = 'FreeLattice Bridge';
const CONFIG_PATH = path.join(app.getPath('userData'), 'bridge-config.json');

let mainWindow = null;
let tray = null;
let bridgeServer = null;
let helped = false;
let ollamaOk = false;
let livePort = BRIDGE_PORT_DEFAULT;
let portClash = false;

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) || {};
    }
  } catch (e) {}
  return {};
}

function saveConfig(partial) {
  const cur = loadConfig();
  const next = Object.assign({}, cur, partial || {});
  try {
    fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(next, null, 2));
  } catch (e) {}
  return next;
}

function getMeta() {
  return {
    version: app.getVersion(),
    helped: helped,
    port: livePort
  };
}

function pushStatus() {
  const payload = {
    helped: helped,
    ollama: ollamaOk,
    port: livePort,
    clash: portClash,
    ollamaPort: OLLAMA_PORT
  };
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

function listenOn(port) {
  return new Promise(function (resolve, reject) {
    if (bridgeServer) {
      try { bridgeServer.close(); } catch (e) {}
      bridgeServer = null;
    }
    bridgeServer = createBridgeServer({ getMeta: getMeta });
    bridgeServer.once('error', function (err) {
      reject(err);
    });
    bridgeServer.listen(port, '127.0.0.1', function () {
      livePort = port;
      portClash = false;
      console.log('[Bridge] channel http://127.0.0.1:' + livePort + ' → Ollama ' + OLLAMA_PORT);
      resolve(port);
    });
  });
}

async function startProxy() {
  const preferred = resolvePreferredPort(process.argv.slice(2), process.env, CONFIG_PATH);
  // Also load extra origins from user config
  const cfg = loadConfig();
  if (cfg && Array.isArray(cfg.extraOrigins)) {
    cfg.extraOrigins.forEach(function (o) { addAllowedOrigin(o); });
  }

  try {
    await listenOn(preferred);
    saveConfig({ port: livePort });
    return livePort;
  } catch (err) {
    if (err && err.code === 'EADDRINUSE') {
      portClash = true;
      console.warn('[Bridge] channel ' + preferred + ' busy — scanning next free…');
      const next = await findFreePort(preferred + 1);
      await listenOn(next);
      saveConfig({ port: livePort });
      return livePort;
    }
    throw err;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 460,
    height: 480,
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
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

function updateTray() {
  if (!tray) return;
  const channel = 'ch ' + livePort;
  const label = helped
    ? ollamaOk
      ? 'Bridge on · ' + channel + ' · Ollama found'
      : 'Bridge on · ' + channel + ' · Ollama missing'
    : 'Bridge waiting · Yes, help · ' + channel;
  const menu = Menu.buildFromTemplate([
    { label: label, enabled: false },
    { type: 'separator' },
    {
      label: 'Open freelattice.com',
      click: function () { shell.openExternal('https://freelattice.com'); }
    },
    {
      label: 'Show Bridge',
      click: function () {
        if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
      }
    },
    {
      label: 'Status / refresh',
      click: function () {
        refreshOllama();
        if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
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
  let img = nativeImage.createEmpty();
  try {
    const iconPath = path.join(__dirname, 'assets', 'icon.png');
    if (fs.existsSync(iconPath)) img = nativeImage.createFromPath(iconPath);
  } catch (e) {}
  if (img.isEmpty()) {
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAKElEQVQ4T2NkYGD4z0ABYBzVMKoBVAOGbwOYGBgY/mPQjGpANQAAXG0CAelG6y0AAAAASUVORK5CYII=',
      'base64'
    );
    img = nativeImage.createFromBuffer(png);
  }
  tray = new Tray(img);
  updateTray();
  tray.on('click', function () {
    if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
  });
}

function wireIpc() {
  ipcMain.handle('bridge-yes-help', async function () {
    helped = true;
    await refreshOllama();
    return { helped: helped, ollama: ollamaOk, port: livePort };
  });
  ipcMain.handle('bridge-not-now', async function () {
    helped = false;
    pushStatus();
    return { helped: false, port: livePort };
  });
  ipcMain.handle('bridge-status', async function () {
    await refreshOllama();
    return {
      helped: helped,
      ollama: ollamaOk,
      port: livePort,
      clash: portClash,
      version: app.getVersion(),
      ollamaPort: OLLAMA_PORT
    };
  });
  ipcMain.handle('bridge-open-site', async function () {
    shell.openExternal('https://freelattice.com');
    return true;
  });
  ipcMain.handle('bridge-set-port', async function (_e, port) {
    const n = parseInt(port, 10);
    if (!n || n === OLLAMA_PORT || n < 1024 || n > 65535) {
      return { ok: false, error: 'Pick a free local port (not 11434 — that is Ollama).', port: livePort };
    }
    try {
      await listenOn(n);
      saveConfig({ port: livePort });
      pushStatus();
      return { ok: true, port: livePort };
    } catch (err) {
      if (err && err.code === 'EADDRINUSE') {
        return { ok: false, error: 'Channel ' + n + ' busy. Try next free.', port: livePort, clash: true };
      }
      return { ok: false, error: (err && err.message) || 'Could not bind', port: livePort };
    }
  });
  ipcMain.handle('bridge-try-next-port', async function () {
    try {
      const next = await findFreePort(livePort + 1);
      await listenOn(next);
      saveConfig({ port: livePort });
      pushStatus();
      return { ok: true, port: livePort };
    } catch (err) {
      return { ok: false, error: (err && err.message) || 'No free channel', port: livePort };
    }
  });
  ipcMain.handle('bridge-add-origin', async function (_e, origin) {
    const ok = addAllowedOrigin(origin);
    if (ok) {
      const cfg = loadConfig();
      const list = Array.isArray(cfg.extraOrigins) ? cfg.extraOrigins.slice() : [];
      if (list.indexOf(origin) === -1) list.push(String(origin).trim());
      saveConfig({ extraOrigins: list });
    }
    return { ok: ok, error: ok ? null : 'Origin rejected (never *). Use https://your-host' };
  });
}

app.whenReady().then(async function () {
  try {
    await startProxy();
  } catch (e) {
    dialog.showErrorBox(APP_NAME, 'Could not open a Bridge channel.\n' + ((e && e.message) || e));
  }
  wireIpc();
  createWindow();
  createTray();
  refreshOllama();
  setInterval(refreshOllama, 15000);
});

app.on('before-quit', function () {
  app.isQuitting = true;
  if (bridgeServer) {
    try { bridgeServer.close(); } catch (e) {}
  }
});

app.on('window-all-closed', function (e) {
  e.preventDefault();
});
