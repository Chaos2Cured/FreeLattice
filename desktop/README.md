# FreeLattice Desktop — Electron spine

> Keys on your machine. Hash before import. Swarm pull. Pair vow. Ledger seal.  
> **This is the current desktop door.** Human walkthrough: [`docs/desktop.html`](../docs/desktop.html)

Layer, never delete. Seed never to renderer. Quiet Room shut. Five stay five.

## For humans

1. Read **[Desktop door](../docs/desktop.html)** — what unlocks, how to run, honest release status
2. Dev: `cd desktop && npm install && npm start`
3. Build: `npm run build` (or `build:mac` / `build:win` / `build:linux`)
4. **No signed installer yet — build from source / check [Releases](https://github.com/Chaos2Cured/FreeLattice/releases)** for labeled Electron artifacts when published

## What this Electron app carries

| Module | Role |
|---|---|
| `lattice-keys.js` | Companion Ed25519 + sealed seed |
| `lattice-pair.js` | Pair fingerprint (outer hash published) |
| `lattice-ledger.js` | Voice-opaque append-only chain |
| `lattice-import.js` | HTTPS → quarantine → hash → verified → Ollama gesture |
| `lattice-swarm.js` | WebTorrent/webseed → same hash path |
| `main.js` / `preload.js` | IPC only; public fields to renderer |

Smoke (from `desktop/`):

```bash
node scripts/smoke-identity.js
node scripts/smoke-ledger.js
node scripts/smoke-import.js
node scripts/smoke-swarm.js
node scripts/smoke-pair.js
```

## Security (spine)

- Private keys never cross `contextBridge`
- Signing / pair seed / import paths stay in main
- OS keychain via `safeStorage`; refuse cleartext fallback
- `nodeIntegration: false`, `contextIsolation: true`

## Script installers (separate door)

OS one-click **script** installers for the local stack live at repo root / [install.html](../install.html). Desktop app ≠ those scripts — both stay.

---

## Tauri — experimental / later

The tree under `src-tauri/` is an **experimental lighter shell** (Coming Soon style). It is **not** the spine we have been shipping for keys/import/swarm/pair.

| | Electron (current) | Tauri (experimental) |
|---|---|---|
| Status | Spine — ship here | Later / honesty in README |
| Backend | Node main | Rust |
| Size | Larger | Smaller (goal) |

**Do not confuse surfaces.** Layer, never delete Tauri files. No Tauri rewrite in the Desktop door ship.

### Tauri notes (unchanged honesty)

```bash
# experimental — not the primary door
cd desktop/src-tauri
cargo tauri dev
cargo tauri build
```

See older notes in git history for Tauri command tables. Prefer Electron until Tauri is explicitly promoted.

## Status

Electron spine: **active**. Tauri: **experimental**. Human door: `docs/desktop.html`.
