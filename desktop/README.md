# FreeLattice Desktop App

A native desktop application for FreeLattice — double-click and go. No browser, no terminal, no CORS issues.

## Quick Start (Development)

```bash
cd desktop
npm install
./build-and-release.sh   # copies app files into desktop/app/
npm start
```

**Note:** Before running `npm start`, the FreeLattice app files (index.html, etc.) must be present in the `desktop/app/` directory. The `build-and-release.sh` script handles this automatically.

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

The desktop app bundles FreeLattice with a built-in local server that:

- **Serves the app locally** — no browser needed, no CORS issues, ever
- **Proxies Ollama requests** — `/ollama/*` routes to `localhost:11434` automatically
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
│  │   Loads http://127.0.0.1:{port}    │  │
│  └──────────────┬─────────────────────┘  │
│                 │                         │
│  ┌──────────────▼─────────────────────┐  │
│  │       Built-in HTTP Server         │  │
│  │                                    │  │
│  │   /            → index.html        │  │
│  │   /ollama/*    → localhost:11434   │  │
│  │   /desktop/*   → status API        │  │
│  └────────────────────────────────────┘  │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │         System Tray Icon           │  │
│  │   • Open / Ollama Status / Quit    │  │
│  └────────────────────────────────────┘  │
└──────────────────────────────────────────┘
```

## Features

| Feature | Description |
|---|---|
| **One-click launch** | Double-click the app — FreeLattice opens instantly |
| **Built-in Ollama proxy** | No CORS configuration needed, ever |
| **Auto-detection** | Automatically finds Ollama if it's running locally |
| **System tray** | Minimize to tray, quick access from the menu bar |
| **Window memory** | Remembers size, position, and maximized state |
| **Deep links** | Foundation for `freelattice://` protocol handling |
| **Cross-platform** | Builds for macOS (.dmg), Windows (.exe), and Linux (.AppImage) |
| **Secure** | Context isolation, sandboxed renderer, no node integration |

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

The desktop app follows Electron security best practices:

- **Context isolation** is enabled — the renderer cannot access Node.js APIs directly
- **Node integration** is disabled — no `require()` in the renderer
- **Sandbox mode** is enabled — the renderer runs in a restricted environment
- **Preload script** exposes only specific, safe APIs via `contextBridge`
- **External URLs** open in the default browser, not inside the app
- **Directory traversal** is prevented in the static file server

## License

MIT — same as FreeLattice.
