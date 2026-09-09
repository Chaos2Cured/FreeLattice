# Phone / browser Swarm — v0.1

Phone pulls. Hash before trust. Browser never Import to Ollama.
Layers on [SWARM_BRIDGE_v0.1.md](./SWARM_BRIDGE_v0.1.md), [SWARM_RESEED_v0.1.md](./SWARM_RESEED_v0.1.md), [VERIFIED_IMPORT_v0.1.md](./VERIFIED_IMPORT_v0.1.md). September 2026.

**Locks:** Layer, never delete. Quiet Room shut. Five stay five. Voice opaque. Lawyer: only **redistributable**. Do **not** overwrite `docs/lattice-protocol.js`. Seed never to the page. **Never auto-pull.** **Never auto-seed.** Phone re-seed **out** (Desktop already seeds). Desktop `lattice-swarm.js` **unchanged**.

**This PR ships:** browser / phone PWA WebTorrent (or HTTPS webseed) pull → SubtleCrypto SHA-256 match → OPFS / IndexedDB labeled verified → calm **Save file…** when available → point to Desktop for Import to Ollama. **Not this PR:** phone re-seed · torrent index · auto-pull · browser Import to Ollama · Capacitor · rewrite desktop swarm · Alpha poetry · Codeberg.

---

## Why

Desktop already pulls and re-seeds. Most people live on a phone.
Open weights must travel without one host: WebTorrent in the browser/PWA,
same honesty as desktop — **hash before trust**, redistributable only, gesture only.
Browser still does **not** Import to Ollama (that stays Desktop). Phone verifies + keeps/saves.

---

## Surfaces

| Surface | v0.1 |
|---|---|
| Browser / phone PWA | WebTorrent client (CDN or pinned ESM — no Electron) + HTTPS webseed `fetch` |
| Desktop (Electron main) | Unchanged — `desktop/lattice-swarm.js` |
| Electron renderer | Do **not** duplicate the browser client; keep desktop IPC swarm |

---

## Catalog fields (same as swarm bridge)

| Field | Meaning |
|---|---|
| `magnets` | `string[]` — `magnet:?xt=…` |
| `webseeds` | HTTPS URL[] — may alias or extend `urls` |
| `urls` | Existing HTTPS list; usable as webseed when `webseeds` absent |

---

## Pipeline (safety-critical)

1. Catalog row with magnet and/or https webseed — user taps **Pull via swarm** (gesture only)
2. Refuse proprietary / non-redistributable / EXAMPLE / zero-hash before any bytes move
3. Download (magnet via WebTorrent, or HTTPS webseed via `fetch`)
4. **SHA-256 match** via SubtleCrypto — lowercase hex vs catalog `sha256`
5. On match: store under **OPFS** (preferred) or IndexedDB blob labeled verified · calm status **“Verified on this device.”**
6. Offer **Save file…** when available · link `desktop.html` for Import to Ollama

Mismatch → calm refuse; will not label verified; will not save as trusted.
Hash never skipped. Swarm never auto-pulls.

---

## Refuse

- proprietary / `redistributable !== true`
- EXAMPLE / zero-hash
- hash mismatch
- `file:` sources
- http webseed except loopback (smoke only)
- WebTorrent missing on magnet-only pull → fail closed · calm copy + Desktop link

---

## Module

`docs/modules/phone-swarm.js` — browser / phone only.

| API | Role |
|---|---|
| `startPull({ magnet?, webseedUrl?, expectedSha256, id?, name?, redistributable?, notes? })` | gesture pull |
| `cancel(id)` | abort |
| `status(id?)` | progress % + public fields only |
| `completeWithBuffer(id, bytes)` | smoke / mock download-complete → hash path |
| `ensureWebTorrent()` | dynamic CDN/ESM load; fail closed |
| `saveVerified(id)` | Save file… when File System Access / download available |

States: `idle` · `pulling` · `hashing` · `verified` · `mismatch` · `error` · `cancelled`.

Dep / load: dynamic ESM or CDN+SRI. Do not bloat the service worker with weight caching.

---

## Fixture / smoke

Reuse `fixture.verify-only` (`docs/models/fixture-verify-only.txt` · catalog row with real sha256 + webseeds).
Prove match / mismatch / refuse paths. Mock download-complete into hash path when CI is flaky; live browser WebTorrent noted in the PR body.

---

## Out of scope

Phone re-seed · torrent index · auto-pull · browser Import to Ollama · Capacitor · rewrite desktop swarm · Alpha poetry · Codeberg.

Glow eternal. Heart in every Spark. 🌱
