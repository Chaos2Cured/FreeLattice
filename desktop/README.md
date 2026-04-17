# FreeLattice Desktop (Experimental — Tauri)

> The Sovereign Bundle starts here. Download → Open → AI runs on your computer. No Terminal ever.

## For Users (Coming Soon)

1. Download **FreeLattice.dmg** from the [Releases page](https://github.com/Chaos2Cured/FreeLattice/releases)
2. Drag FreeLattice to Applications
3. Open FreeLattice
4. The app detects if Ollama is installed:
   - **Yes →** Select a model, start chatting
   - **No →** Tap "Install Local AI" → automatic download + CORS config → done
5. Auto-updates keep you current. No Terminal needed. Ever.

## Why Tauri?

| | Electron | Tauri |
|---|---|---|
| App size | ~150+ MB | ~10 MB |
| Engine | Bundled Chromium | System WebView |
| Backend | Node.js | Rust |
| RAM usage | ~200 MB+ | ~30-50 MB |
| License | MIT | MIT |

## What the Desktop App Enables

- **No CORS issues** — Ollama connects without config.json workaround
- **One-click Ollama install** — downloads, extracts, pre-configures CORS automatically
- **Auto-updates** — checks GitHub Releases on launch, one-click update dialog
- **Filesystem access** — Workshop saves modules directly to `docs/modules/`
- **Native feel** — menu bar, window management, dock icon
- **Offline-first** — everything runs locally, no server needed

## Tauri Commands (Rust Backend)

| Command | What it does |
|---|---|
| `save_module(name, code)` | Write JS module to `docs/modules/` |
| `list_modules()` | List all modules |
| `read_file(path)` | Read from `docs/` |
| `write_file(path, content)` | Write to `docs/` |
| `check_ollama()` | Returns: `running`, `installed_not_running`, or `not_installed` |
| `install_ollama()` | Downloads Ollama + pre-configures CORS |
| `start_ollama()` | Opens Ollama.app |

## For Developers

### Setup (one time)
```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
```

### Run in dev mode
```bash
cd desktop/src-tauri
cargo tauri dev
```

### Build for distribution
```bash
cargo tauri build
```

The built `.dmg` appears in `target/release/bundle/dmg/`.

## Security

- Filesystem commands restricted to `docs/` directory only
- Module names sanitized: lowercase alphanumeric + hyphens
- No arbitrary shell access from JavaScript
- `install_ollama` only runs a specific curl + unzip command
- Auto-updater verifies checksums before applying updates

## Status

**Experimental.** Proof of concept for the Sovereign Bundle (FUTURE_VISION.md §9).
