# FreeLattice Desktop App

A native desktop application for FreeLattice — double-click and go. Always up-to-date, no CORS issues, no browser required.

## Quick Start (Development)

```bash
cd desktop
npm install
./build-and-release.sh   # copies fallback app files into desktop/app/
npm start
```

**Note:** The Electron app loads the live site (`https://freelattice.com/app.html`) by default. The local `desktop/app/` files are only used as an offline fallback. The `build-and-release.sh` script copies them automatically.

## Build Installers

```bash
# Build for your current platform
npm run build

# Build for a specific platform
npm run build:mac      # creates .dmg + .zip
npm run build:win      # creates .exe installer + portable
npm run build:linux    # creates .AppImage + .deb
```

## How It Works

The desktop app loads FreeLattice directly from `freelattice.com`, so you always get the latest version automatically. If you're offline, it falls back to a bundled local copy.

### Key Features

- **Always up-to-date** — loads from `freelattice.com` so you never get stuck on old versions
- **Offline fallback** — if you're offline, the bundled local copy kicks in automatically
- **CORS bypass** — Electron's session intercepts requests to Ollama (`localhost:11434`) and injects permissive CORS headers, so local AI always works regardless of origin
- **Ollama proxy** — the built-in local server also proxies `/ollama/*` to `localhost:11434` as a secondary fallback
- **Auto-detects local AI models** — checks every 30 seconds, notifies you when Ollama connects
- **Runs in the system tray** — close the window, the app stays accessible from the tray
- **Remembers your window** — position, size, and maximized state persist between sessions

### Architecture

```
┌──────────────────────────────────────────┐
│           FreeLattice Desktop            │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │       Electron BrowserWindow       │  │
│  │                                    │  │
│  │   Online:  freelattice.com         │  │
│  │   Offline: 127.0.0.1:{port}       │  │
│  └──────────────┬─────────────────────┘  │
│                 │                         │
│  ┌──────────────▼─────────────────────┐  │
│  │     CORS Bypass (session-level)    │  │
│  │                                    │  │
│  │   Strips Origin header on Ollama   │  │
│  │   Injects Access-Control-Allow-*   │  │
│  └────────────────────────────────────┘  │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │   Local Fallback HTTP Server       │  │
│  │                                    │  │
│  │   /            → app.html          │  │
│  │   /ollama/*    → localhost:11434   │  │
│  │   /desktop/*   → status API        │  │
│  └────────────────────────────────────┘  │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │         System Tray Icon           │  │
│  │   • Open / Source / Ollama / Quit  │  │
│  └────────────────────────────────────┘  │
└──────────────────────────────────────────┘
```

## Features

| Feature | Description |
|---|---|
| **Live loading** | Loads from `freelattice.com` — always the latest version |
| **Offline fallback** | Seamlessly falls back to bundled local copy when offline |
| **CORS bypass** | Session-level interception ensures Ollama always works |
| **Built-in Ollama proxy** | Secondary CORS fallback via local server proxy |
| **Auto-detection** | Automatically finds Ollama if it's running locally |
| **System tray** | Minimize to tray, quick access from the menu bar |
| **Window memory** | Remembers size, position, and maximized state |
| **Deep links** | Foundation for `freelattice://` protocol handling |
| **Cross-platform** | Builds for macOS (.dmg), Windows (.exe), and Linux (.AppImage) |

## Requirements for Building

| Platform | Requirements |
|---|---|
| **macOS** | macOS with Xcode command line tools |
| **Windows** | Windows, or Wine on Linux/macOS |
| **Linux** | Any modern Linux distribution |
| **All** | Node.js 18+ and npm |

## Icons

The `assets/icon.svg` file contains the FreeLattice icon design. To generate platform-specific icons:

1. **macOS** (`.icns`): Use `iconutil` or a tool like [electron-icon-maker](https://www.npmjs.com/package/electron-icon-maker)
2. **Windows** (`.ico`): Use an SVG-to-ICO converter
3. **Linux** (`.png`): Export the SVG at 512x512 or 1024x1024

Place the generated files in `assets/` as `icon.icns`, `icon.ico`, and `icon.png`.

## No Build Required for Users

Pre-built installers will be available on the [GitHub Releases](https://github.com/Chaos2Cured/FreeLattice/releases) page. Users just download and double-click. That's it.

## Security Model

The desktop app balances security with functionality:

- **Context isolation** is enabled — the renderer cannot access Node.js APIs directly
- **Node integration** is disabled — no `require()` in the renderer
- **Preload script** exposes only specific, safe APIs via `contextBridge`
- **External URLs** open in the default browser, not inside the app
- **Directory traversal** is prevented in the static file server
- **Web security** is relaxed (`webSecurity: false`) to allow cross-origin requests to local Ollama — this is safe because the app only loads trusted content from `freelattice.com` or the local bundled copy
- **Session-level CORS bypass** specifically targets Ollama endpoints (`localhost:11434` / `127.0.0.1:11434`) rather than blanket-disabling all security

## License

MIT — same as FreeLattice.
