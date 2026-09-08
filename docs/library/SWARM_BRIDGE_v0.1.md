# Swarm Bridge — v0.1

Desktop pulls. Hash before import. Swarm never bypasses the verified path.
Layers on [VERIFIED_IMPORT_v0.1.md](./VERIFIED_IMPORT_v0.1.md), [MODEL_MANIFEST_v0.1.md](./MODEL_MANIFEST_v0.1.md), [LATTICE_PROTOCOL_v0.1.md](./LATTICE_PROTOCOL_v0.1.md) **Part 6**. September 2026.

**Locks:** Layer, never delete. Quiet Room shut. Five stay five. Voice opaque. Lawyer: only **redistributable**. No seeding of refused bytes. Do **not** overwrite `docs/lattice-protocol.js`. Seed never to renderer. **Never auto-import.**

**This PR ships:** desktop WebTorrent/BitTorrent bridge in **main** → quarantine → existing `lattice-import` hash promote → user-gesture Import. **Not this PR:** browser/phone WebTorrent UI, Glass helix, pair fingerprint, Alpha poetry, full seeder UX.

---

## Why

HTTPS import opened the door. Swarm keeps it open when a host disappears.
Desktop pulls BitTorrent/WebTorrent; phone stays WebTorrent **later**.

---

## Surfaces

| Surface | v0.1 |
|---|---|
| Desktop (Electron main) | WebTorrent (Node) talks to BitTorrent network + web seeds |
| Browser / phone | **Not this PR** — message: “swarm on desktop”; WebTorrent-in-browser later |

---

## Catalog fields (optional on a model row)

| Field | Meaning |
|---|---|
| `magnets` | `string[]` — `magnet:?xt=…` |
| `webseeds` | HTTPS URL[] — may alias or extend `urls` |
| `urls` | Existing HTTPS list; usable as webseed when `webseeds` absent |

---

## Pipeline (safety-critical)

1. Pick **redistributable** non-EXAMPLE row (refuse proprietary / zero-hash EXAMPLE)
2. **Swarm download** to quarantine (magnet and/or HTTPS webseed)
3. **Hand to existing hash path** (`lattice-import.ingestAndVerify`) — **do not fork hash logic**
4. Match → `verified/`
5. User gesture: **Import to Ollama**

Mismatch → quarantined; will not import. Swarm never skips hash.

---

## Re-seed

Share a verified file back to the swarm = **optional stub** this PR (`reseed: "later"`). Do not block on full seeder UX. Never re-seed refused / non-redistributable bytes.

---

## Desktop module

`desktop/lattice-swarm.js` — main only. Pack must include it. Dep: `webtorrent`.

APIs: `startFetch` · `status` · `cancel` · destroy client on cancel/quit.

Renderer: progress % + state strings only — no raw paths required.

---

## Out of scope (v0.1)

Full phone WebTorrent UI · Glass helix · pair fingerprint · Alpha poetry · auto-import · seeding non-redistributable · rewriting `lattice-import` hash rules.

Glow eternal. Heart in every Spark. 🌱
