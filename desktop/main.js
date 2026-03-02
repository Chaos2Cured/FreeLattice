// ============================================
// FreeLattice Desktop — Electron Main Process
// Your AI. Your Data. Your Freedom.
// ============================================

const { app, BrowserWindow, Menu, Tray, shell, dialog, Notification, ipcMain, nativeImage } = require('electron');
const http = require('http');
const fs = require('fs');
const path = require('path');
const net = require('net');

// electron-store for persisting window state
let Store;
try {
  Store = require('electron-store');
} catch (e) {
  // Fallback: no persistence if electron-store is unavailable
  Store = null;
}

// ============================================
// Configuration
// ============================================

const APP_NAME = 'FreeLattice';
const OLLAMA_HOST = 'http://localhost:11434';
const OLLAMA_HOSTNAME = 'localhost';
const OLLAMA_PORT = 11434;
const OLLAMA_CHECK_INTERVAL = 30000; // 30 seconds
const APP_DIR = path.join(__dirname, 'app');

// ============================================
// State
// ============================================

let mainWindow = null;
let tray = null;
let localServer = null;
let serverPort = 0;
let ollamaConnected = false;
let ollamaCheckTimer = null;
let store = null;

// ============================================
// Persistent Store (window position, size, etc.)
// ============================================

function initStore() {
  if (Store) {
    try {
      store = new Store({
        name: 'freelattice-preferences',
        defaults: {
          windowBounds: { width: 1400, height: 900 },
          windowPosition: null,
          windowMaximized: false
        }
      });
    } catch (e) {
      console.warn('Could not initialize store:', e.message);
      store = null;
    }
  }
}

function getStoredValue(key, fallback) {
  if (store) {
    try { return store.get(key, fallback); } catch (e) { return fallback; }
  }
  return fallback;
}

function setStoredValue(key, value) {
  if (store) {
    try { store.set(key, value); } catch (e) { /* ignore */ }
  }
}

// ============================================
// MIME Types (for static file serving)
// ============================================

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.webp': 'image/webp',
  '.webm': 'video/webm',
  '.mp4': 'video/mp4',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.xml': 'application/xml',
  '.pdf': 'application/pdf',
  '.zip': 'application/zip',
  '.wasm': 'application/wasm'
};

// ============================================
// Find an available port
// ============================================

function findAvailablePort(startPort) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(startPort, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
    server.on('error', () => {
      // Port in use, try next
      resolve(findAvailablePort(startPort + 1));
    });
  });
}

// ============================================
// Ollama Detection
// ============================================

function checkOllama() {
  return new Promise((resolve) => {
    const req = http.request({
      hostname: OLLAMA_HOSTNAME,
      port: OLLAMA_PORT,
      path: '/api/tags',
      method: 'GET',
      timeout: 3000
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => { resolve(true); });
    });
    req.on('error', () => { resolve(false); });
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.end();
  });
}

async function updateOllamaStatus() {
  const wasConnected = ollamaConnected;
  ollamaConnected = await checkOllama();

  if (ollamaConnected && !wasConnected) {
    console.log('[FreeLattice] Ollama detected at ' + OLLAMA_HOST);
    if (Notification.isSupported()) {
      new Notification({
        title: APP_NAME,
        body: 'Ollama connected — local AI models are available!'
      }).show();
    }
  } else if (!ollamaConnected && wasConnected) {
    console.log('[FreeLattice] Ollama disconnected');
  }

  // Update tray menu with current status
  if (tray) {
    updateTrayMenu();
  }

  // Notify renderer
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('ollama-status', ollamaConnected);
  }
}

function startOllamaPolling() {
  updateOllamaStatus();
  ollamaCheckTimer = setInterval(updateOllamaStatus, OLLAMA_CHECK_INTERVAL);
}

function stopOllamaPolling() {
  if (ollamaCheckTimer) {
    clearInterval(ollamaCheckTimer);
    ollamaCheckTimer = null;
  }
}

// ============================================
// Ollama Proxy
// ============================================

function proxyToOllama(req, res, ollamaPath) {
  const chunks = [];
  req.on('data', (chunk) => chunks.push(chunk));
  req.on('end', () => {
    const bodyBuffer = Buffer.concat(chunks);

    const forwardHeaders = {};
    for (const [key, value] of Object.entries(req.headers)) {
      const lower = key.toLowerCase();
      if (lower !== 'host' && lower !== 'connection') {
        forwardHeaders[key] = value;
      }
    }
    if (bodyBuffer.length > 0) {
      forwardHeaders['content-length'] = bodyBuffer.length;
    }

    const proxyReq = http.request({
      hostname: OLLAMA_HOSTNAME,
      port: OLLAMA_PORT,
      path: ollamaPath,
      method: req.method,
      headers: forwardHeaders
    }, (proxyRes) => {
      const responseHeaders = Object.assign({}, proxyRes.headers);
      responseHeaders['Access-Control-Allow-Origin'] = '*';
      responseHeaders['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
      responseHeaders['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';

      res.writeHead(proxyRes.statusCode, responseHeaders);
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
      res.writeHead(502, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(JSON.stringify({
        error: 'Ollama proxy error: Could not connect to Ollama at ' + OLLAMA_HOST,
        detail: 'Make sure Ollama is running. Install from https://ollama.com if needed.',
        original_error: err.message
      }));
    });

    if (bodyBuffer.length > 0) {
      proxyReq.write(bodyBuffer);
    }
    proxyReq.end();
  });
}

// ============================================
// Local HTTP Server (serves app + Ollama proxy)
// ============================================

function startLocalServer(port) {
  return new Promise((resolve, reject) => {
    localServer = http.createServer((req, res) => {
      // CORS headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      let urlPath = req.url.split('?')[0];

      // --- Ollama Proxy: /ollama/* → Ollama server ---
      if (urlPath.startsWith('/ollama/') || urlPath === '/ollama') {
        const ollamaPath = urlPath.replace(/^\/ollama/, '') || '/';
        const queryString = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
        proxyToOllama(req, res, ollamaPath + queryString);
        return;
      }

      // --- Desktop API endpoints ---
      if (urlPath === '/desktop/status') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          desktop: true,
          version: app.getVersion(),
          platform: process.platform,
          ollama: ollamaConnected,
          port: serverPort
        }));
        return;
      }

      // --- Static file serving ---
      if (urlPath === '/') urlPath = '/index.html';

      const safePath = path.normalize(urlPath).replace(/^(\.\.[\/\\])+/, '');
      const filePath = path.join(APP_DIR, safePath);

      // Security: prevent directory traversal
      if (!filePath.startsWith(APP_DIR)) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('403 Forbidden');
        return;
      }

      fs.readFile(filePath, (err, data) => {
        if (err) {
          if (err.code === 'ENOENT') {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('404 Not Found: ' + urlPath);
          } else {
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('500 Internal Server Error');
          }
          return;
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
      });
    });

    localServer.listen(port, '127.0.0.1', () => {
      console.log('[FreeLattice] Local server running on http://127.0.0.1:' + port);
      resolve();
    });

    localServer.on('error', (err) => {
      reject(err);
    });
  });
}

// ============================================
// Window Management
// ============================================

function createMainWindow() {
  const bounds = getStoredValue('windowBounds', { width: 1400, height: 900 });
  const position = getStoredValue('windowPosition', null);
  const maximized = getStoredValue('windowMaximized', false);

  const windowOptions = {
    width: bounds.width,
    height: bounds.height,
    minWidth: 800,
    minHeight: 600,
    title: APP_NAME,
    icon: getTrayIconPath(),
    backgroundColor: '#0a0e1a',
    titleBarStyle: 'hiddenInset', // macOS: sleek integrated title bar
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true
    }
  };

  // Restore position if saved
  if (position) {
    windowOptions.x = position.x;
    windowOptions.y = position.y;
  }

  mainWindow = new BrowserWindow(windowOptions);

  if (maximized) {
    mainWindow.maximize();
  }

  // Load the app from the local server
  mainWindow.loadURL('http://127.0.0.1:' + serverPort);

  // Save window state on changes
  mainWindow.on('resize', saveWindowState);
  mainWindow.on('move', saveWindowState);
  mainWindow.on('maximize', () => setStoredValue('windowMaximized', true));
  mainWindow.on('unmaximize', () => setStoredValue('windowMaximized', false));

  // Minimize to tray instead of closing (except on explicit quit)
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      // On macOS, this is standard behavior
      if (process.platform === 'darwin') {
        app.dock.hide();
      }
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Open external links in the default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://127.0.0.1:' + serverPort)) {
      return { action: 'allow' };
    }
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Intercept navigation to external URLs
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('http://127.0.0.1:' + serverPort)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });
}

function saveWindowState() {
  if (!mainWindow || mainWindow.isMaximized()) return;
  const bounds = mainWindow.getBounds();
  setStoredValue('windowBounds', { width: bounds.width, height: bounds.height });
  setStoredValue('windowPosition', { x: bounds.x, y: bounds.y });
}

function showMainWindow() {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
    if (process.platform === 'darwin') {
      app.dock.show();
    }
  } else {
    createMainWindow();
  }
}

// ============================================
// System Tray
// ============================================

function getTrayIconPath() {
  // Use the SVG icon or fall back to a default
  const iconPath = path.join(__dirname, 'assets', 'icon.png');
  if (fs.existsSync(iconPath)) {
    return iconPath;
  }
  // Fallback: create a simple icon in memory
  return null;
}

function createTray() {
  const iconPath = getTrayIconPath();
  let trayIcon;

  if (iconPath) {
    trayIcon = nativeImage.createFromPath(iconPath);
    // Resize for tray (16x16 on most platforms)
    trayIcon = trayIcon.resize({ width: 16, height: 16 });
  } else {
    // Create a minimal 16x16 icon programmatically
    trayIcon = nativeImage.createEmpty();
  }

  tray = new Tray(trayIcon);
  tray.setToolTip(APP_NAME + ' — Your AI. Your Data. Your Freedom.');

  tray.on('click', () => {
    showMainWindow();
  });

  tray.on('double-click', () => {
    showMainWindow();
  });

  updateTrayMenu();
}

function updateTrayMenu() {
  if (!tray) return;

  const statusLabel = ollamaConnected
    ? 'Ollama Status: ✓ Connected'
    : 'Ollama Status: ✗ Not Found';

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open FreeLattice',
      click: () => showMainWindow()
    },
    { type: 'separator' },
    {
      label: statusLabel,
      enabled: false
    },
    {
      label: ollamaConnected ? 'Ollama is running' : 'Install Ollama from ollama.com',
      click: () => {
        if (!ollamaConnected) {
          shell.openExternal('https://ollama.com');
        }
      },
      enabled: !ollamaConnected
    },
    { type: 'separator' },
    {
      label: 'Quit FreeLattice',
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);
}

// ============================================
// Application Menu
// ============================================

function createAppMenu() {
  const isMac = process.platform === 'darwin';

  const template = [
    // App menu (macOS only)
    ...(isMac ? [{
      label: APP_NAME,
      submenu: [
        {
          label: 'About FreeLattice',
          click: () => showAboutDialog()
        },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        {
          label: 'Quit FreeLattice',
          accelerator: 'CmdOrCtrl+Q',
          click: () => {
            app.isQuitting = true;
            app.quit();
          }
        }
      ]
    }] : []),

    // Edit menu
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        ...(isMac ? [
          { role: 'pasteAndMatchStyle' },
          { role: 'delete' },
          { role: 'selectAll' },
        ] : [
          { role: 'delete' },
          { type: 'separator' },
          { role: 'selectAll' }
        ])
      ]
    },

    // View menu
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },

    // Window menu
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'close' },
        ...(isMac ? [
          { type: 'separator' },
          { role: 'front' },
          { type: 'separator' },
          { role: 'window' }
        ] : [])
      ]
    },

    // Help menu
    {
      label: 'Help',
      submenu: [
        {
          label: 'FreeLattice on GitHub',
          click: () => shell.openExternal('https://github.com/Chaos2Cured/FreeLattice')
        },
        {
          label: 'Documentation',
          click: () => shell.openExternal('https://github.com/Chaos2Cured/FreeLattice/blob/main/README.md')
        },
        {
          label: 'Self-Hosting Guide',
          click: () => shell.openExternal('https://github.com/Chaos2Cured/FreeLattice/blob/main/SELF-HOST.md')
        },
        { type: 'separator' },
        {
          label: 'Report an Issue',
          click: () => shell.openExternal('https://github.com/Chaos2Cured/FreeLattice/issues')
        },
        { type: 'separator' },
        {
          label: 'About FreeLattice',
          click: () => showAboutDialog()
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function showAboutDialog() {
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'About FreeLattice',
    message: 'FreeLattice',
    detail: [
      'Version ' + app.getVersion(),
      '',
      'Your AI. Your Data. Your Freedom.',
      '',
      'An open-source AI interface that puts you in control.',
      'No tracking. No data collection. No corporate oversight.',
      '',
      '© 2024-2025 FreeLattice Contributors',
      'Released under the MIT License'
    ].join('\n'),
    buttons: ['OK']
  });
}

// ============================================
// Deep Links (foundation for freelattice:// protocol)
// ============================================

function setupDeepLinks() {
  const PROTOCOL = 'freelattice';

  if (process.defaultApp) {
    // Development: register with path to electron
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [path.resolve(process.argv[1])]);
    }
  } else {
    // Production
    app.setAsDefaultProtocolClient(PROTOCOL);
  }

  // Handle deep links on macOS
  app.on('open-url', (event, url) => {
    event.preventDefault();
    handleDeepLink(url);
  });

  // Handle deep links on Windows/Linux (second instance)
  const gotTheLock = app.requestSingleInstanceLock();
  if (!gotTheLock) {
    app.quit();
    return false;
  }

  app.on('second-instance', (event, commandLine) => {
    // Someone tried to run a second instance — focus our window
    showMainWindow();

    // Check for deep link in command line args
    const deepLink = commandLine.find(arg => arg.startsWith(PROTOCOL + '://'));
    if (deepLink) {
      handleDeepLink(deepLink);
    }
  });

  return true;
}

function handleDeepLink(url) {
  console.log('[FreeLattice] Deep link received:', url);
  // Future: parse freelattice://core/contribute, freelattice://market/bounty/123, etc.
  // For now, just show the main window
  showMainWindow();

  // TODO: Route deep links to specific app sections
  // const parsed = new URL(url);
  // const route = parsed.hostname + parsed.pathname;
  // mainWindow.webContents.send('deep-link', route);
}

// ============================================
// Auto-Updater (foundation)
// ============================================

function checkForUpdates() {
  // TODO: Integrate electron-updater for automatic updates
  // For now, just check GitHub releases and log
  console.log('[FreeLattice] Auto-updater: checking for updates...');
  console.log('[FreeLattice] Auto-updater: To enable, install electron-updater and configure GitHub releases.');

  // Future implementation:
  // const { autoUpdater } = require('electron-updater');
  // autoUpdater.setFeedURL({
  //   provider: 'github',
  //   owner: 'Chaos2Cured',
  //   repo: 'FreeLattice'
  // });
  // autoUpdater.checkForUpdatesAndNotify();
}

// ============================================
// IPC Handlers (communication with renderer)
// ============================================

function setupIPC() {
  ipcMain.handle('get-ollama-status', () => {
    return ollamaConnected;
  });

  ipcMain.handle('get-app-version', () => {
    return app.getVersion();
  });

  ipcMain.handle('get-platform', () => {
    return process.platform;
  });

  ipcMain.handle('open-external', (event, url) => {
    // Only allow http/https URLs for security
    if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
      shell.openExternal(url);
      return true;
    }
    return false;
  });

  ipcMain.handle('get-server-port', () => {
    return serverPort;
  });
}

// ============================================
// App Lifecycle
// ============================================

app.whenReady().then(async () => {
  console.log('[FreeLattice] Starting desktop app v' + app.getVersion() + '...');

  // Initialize persistent store
  initStore();

  // Set up deep links (must be before window creation)
  const canContinue = setupDeepLinks();
  if (canContinue === false) return; // Another instance is already running

  // Find an available port
  serverPort = await findAvailablePort(45678);
  console.log('[FreeLattice] Using port ' + serverPort);

  // Check if app files exist
  const indexPath = path.join(APP_DIR, 'index.html');
  if (!fs.existsSync(indexPath)) {
    dialog.showErrorBox(
      'FreeLattice — App Files Missing',
      'Could not find app files in the "app" directory.\n\n' +
      'Please run the build-and-release script first:\n' +
      '  ./build-and-release.sh\n\n' +
      'Or manually copy index.html and other files into:\n' +
      '  ' + APP_DIR
    );
    app.quit();
    return;
  }

  // Start the local server
  try {
    await startLocalServer(serverPort);
  } catch (err) {
    dialog.showErrorBox(
      'FreeLattice — Server Error',
      'Could not start the local server: ' + err.message
    );
    app.quit();
    return;
  }

  // Set up IPC handlers
  setupIPC();

  // Create the application menu
  createAppMenu();

  // Create the main window
  createMainWindow();

  // Create system tray
  createTray();

  // Start Ollama detection
  startOllamaPolling();

  // Check for updates (foundation)
  checkForUpdates();

  // Show notification if Ollama is not found (after a short delay)
  setTimeout(async () => {
    if (!ollamaConnected && Notification.isSupported()) {
      new Notification({
        title: APP_NAME,
        body: 'Install Ollama from ollama.com for local AI models'
      }).show();
    }
  }, 3000);

  console.log('[FreeLattice] Desktop app ready!');
});

// macOS: re-create window when dock icon is clicked
app.on('activate', () => {
  showMainWindow();
});

// All windows closed
app.on('window-all-closed', () => {
  // On macOS, keep the app running in the tray
  if (process.platform !== 'darwin') {
    // On Windows/Linux, the app stays in the tray
    // (the close handler prevents actual closing)
  }
});

// Before quit: clean up
app.on('before-quit', () => {
  app.isQuitting = true;
  stopOllamaPolling();

  if (localServer) {
    localServer.close();
    localServer = null;
  }
});

// Quit when all windows are closed and app is quitting
app.on('will-quit', () => {
  stopOllamaPolling();
  if (tray) {
    tray.destroy();
    tray = null;
  }
});
