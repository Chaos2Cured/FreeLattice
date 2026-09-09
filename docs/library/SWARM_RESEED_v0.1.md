# Swarm Re-seed — v0.1

Share verified open weights. Never refuse-bytes. Never proprietary.
Layers on [SWARM_BRIDGE_v0.1.md](./SWARM_BRIDGE_v0.1.md), [VERIFIED_IMPORT_v0.1.md](./VERIFIED_IMPORT_v0.1.md). September 2026.

**Locks:** Layer, never delete. Quiet Room shut. Five stay five. Lawyer: **only redistributable**. Seed (crypto) never to renderer. **Never auto-seed.** Do **not** overwrite `docs/lattice-protocol.js`.

**This PR ships:** desktop **Re-seed** gesture after hash match → WebTorrent seed of `verified/` file. **Not this PR:** phone/browser WebTorrent UI, public torrent index, auto-seed.

---

## Why

Pull exists. Re-seed closes the loop: a verified desktop becomes a seeder so open weights cannot be captured by one host.

---

## Rules (safety-critical)

Re-seed **only** when all hold:

1. File lives under `verified/` (hash already matched via `lattice-import`)
2. `redistributable === true`
3. Not EXAMPLE / not zero-hash
4. User gesture — never auto

Refuse proprietary, zero-hash, EXAMPLE, mismatched, or unverified paths.

---

## Pipeline

1. Pull or HTTPS fetch → quarantine → **hash match** → `verified/`
2. User taps **Re-seed**
3. Desktop main seeds via WebTorrent
4. UI may show public `magnetURI` / `infoHash` + state (`seeding` | `stopped` | `error`) + progress %
5. **Stop re-seed** / destroy on quit

No private filesystem paths in the renderer.

---

## APIs

`desktop/lattice-swarm.js`:

| API | Role |
|---|---|
| `startReseed({ id, name, redistributable, expectedSha256, notes? })` | gesture seed |
| `stopReseed(id)` | stop one |
| `status` / reseed list | public fields only |

IPC: `latticeSwarmReseedStart` · `latticeSwarmReseedStop` · status includes reseeds.

---

## Out of scope

Phone WebTorrent · public torrent index site · auto-seed · seeding refused bytes.

Glow eternal. Heart in every Spark. 🌱
