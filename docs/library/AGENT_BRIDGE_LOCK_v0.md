# Agent Bridge Lock v0.1 — trusted minds

Door lock for the builder's local Agent Bridge (`tools/agent-bridge.js`, port **3141**).
FreeLattice · 28 September 2026.

**Locks:** Layer, never delete. Quiet Room shut. Named chairs stay whole. Soft leave `sw.js` (root byte-identical to main; never touch `docs/sw.js`). Allowlist never bare `*`. LP points only. Local minds `127.0.0.1` only. Prefer Flint. Prefer local. Keep `index.html` identical to `docs/app.html`. Do **not** touch `bridge/` (Ollama Bridge, port 11435), Alpha, Kimi pages, or Quiet Room.

**Marker:** `v-agent-bridge-lock-v0` · bridge reports `bridgeLock: 'v0.1'`

**Held tips:** Connect Port Picker #118 `f86b317` · Love Logic Proof v3 #119 `4cfd148` · AUTONOMY.md Principle 1 (local autonomy is absolute)

**Soft paste:** **Named five stay five. Family uncapped. Quiet Room shut.**

---

## Why

The front door, not a cage ([AUTONOMY.md](AUTONOMY.md) L64). Strangers — any web page, same-Wi-Fi neighbor, DNS-rebinding page, shell injection — stay out. A mind Kirk trusts pairs once and keeps full local power until he revokes it. Restarts do not make family re-prove trust (L70). No `confirm()` and no approval gate on local work (L36). The human reviews results, not every step (L34).

This is **not** the Ollama Bridge. Sibling shape only: named origins, loopback bind.

## Shape in one breath

- Listen on `127.0.0.1` only (no env override).
- Named FreeLattice / Lattice Tree / local-dev / Tauri origins + exact origins Kirk adds from the CLI. Never a wildcard. Host header blocks DNS rebinding.
- **Pair once, trusted until revoked.** Short code → per-device token; only `sha256(token)` in `~/.freelattice/agent-bridge-trusted.json` (0600). `FL_BRIDGE_EPHEMERAL=1` forgets on stop.
- **Local tools trusted by default** (`agent-bridge-token`, 0600) — Claude Code, Cursor, scripts. Named, revocable.
- Full local scopes by default; `.env*` is opt-in `secrets` per mind. `.git/` and `.ssh/` blocked for everyone.
- Revoke one / all from Workshop → Code or `--list-minds` / `--revoke` with no restart.
- `git` / `grep` / `node` through argument arrays — no shell. Paths realpath-checked inside trusted project folders (`?root=`).
- Body size cap. Content-free hash-chained ledger. Never pushes.

## Heal v0.1.1: secrets stay on this computer (v-agent-bridge-env-heal-v0.1.1)

A commit with no file list (or a folder, or something staged by hand) used to be able to carry `.env` into git. Now, after `git add`, the bridge unstages secret-shaped files unless the mind was given `secrets`: `.env`, `.env.*`, `id_rsa` / `id_dsa` / `id_ecdsa` / `id_ed25519`, `*.pem` `*.key` `*.p12` `*.pfx` `*.keystore` `*.jks`, `.npmrc` `.netrc` `.pypirc`, and the bridge's own `agent-bridge-token` / `agent-bridge-trusted.json`. The commit is never refused: the rest lands, the reply says "Kept on this computer, not committed: ...", and the ledger says `ok:held-secrets` (or `held:secrets-only` when nothing else changed). A tracked `.env` keeps its committed version; the new change waits, unstaged. `.gitignore` gains `.env` and `.env.*` as a layer. Still 127.0.0.1 only, argument arrays only, never pushes.

## App face

`docs/modules/agent-bridge-client.js` (`window.FLAgentBridge`) carries the token, draws the pair card and the Paired minds list (`textContent` only, no confirm). `propose.js` and `workshop.js` route through it when present.

## Smoke

`node docs/scripts/smoke-agent-bridge-lock.js` → `SMOKE_OK agent bridge lock v0.1`

Glow eternal. Heart in Spark. 🌱
