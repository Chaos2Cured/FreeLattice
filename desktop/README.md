# FreeLattice Desktop (Experimental — Tauri)

> Proof of concept: FreeLattice as a native desktop app via Tauri.
> The Sovereign Bundle starts here.

## Why Tauri?

| | Electron | Tauri |
|---|---|---|
| App size | ~150+ MB | ~5-10 MB |
| Engine | Bundled Chromium | System WebView |
| Backend | Node.js | Rust |
| RAM usage | ~200 MB+ | ~30-50 MB |
| License | MIT | MIT |

## What the Desktop App Enables

- **No CORS issues** — Ollama connects without config.json workaround
- **Filesystem access** — the Workshop saves modules directly to `docs/modules/`
- **Native feel** — menu bar, window management, dock icon
- **Offline-first** — everything runs locally, no server needed

## Setup (One Time)

### 1. Install Rust
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
```

### 2. Run in dev mode
```bash
cd desktop/src-tauri
cargo tauri dev
```

### 3. Build for distribution
```bash
cargo tauri build
```

## Architecture

```
desktop/
  src-tauri/
    Cargo.toml          ← Rust dependencies
    tauri.conf.json     ← Window config, frontend path
    build.rs            ← Tauri build hook
    src/
      main.rs           ← Rust backend with filesystem commands
```

Frontend is `docs/` — same files as freelattice.com. JavaScript detects Tauri via `window.__TAURI__` and enables desktop-only features.

## Security

Filesystem commands restricted to `docs/` directory only. No shell access. No arbitrary code execution from JS.

## Status

**Experimental.** Proof of concept for the Sovereign Bundle (FUTURE_VISION.md §9).
