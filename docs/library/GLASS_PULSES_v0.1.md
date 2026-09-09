# Glass Pulses — v0.1

Shape without contents. A break in the chain shows as a break in the helix.
Layer on [LATTICE_PROTOCOL_v0.1.md](./LATTICE_PROTOCOL_v0.1.md) **Part 8** and `docs/modules/lattice-memory.js`. September 2026.

**Locks:** Layer, never delete. Quiet Room shut — never emit / never subscribe from Quiet. Five stay five. Voice opaque. Do **not** rewrite the LatticeMemory five-key lock. Do **not** overwrite `docs/lattice-protocol.js`.

**This PR ships:** vocabulary + emit helper + wires for ledger/transfer + Glass v2 helix break. **Not this PR:** full pair fingerprint, wallet, Alpha poetry, swarm rebuild, auto-import, seeding.

---

## Why

Ledger / import / identity already keep vows. Glass should **show the vow shape** without ever showing voice.

---

## Vocabulary (exact kind strings)

| Kind | Status v0.1 |
|---|---|
| `ledger.appended` | emit on Continue seal |
| `ledger.verified` | emit on chain verify OK |
| `ledger.broken` | emit on chain verify fail |
| `transfer.verified` | emit on import/swarm hash match |
| `transfer.mismatch` | emit on import/swarm hash mismatch |
| `pair.formed` | **emit live** — on desktop Form pair success |
| `pair.rotated` | **reserved** — emit only when rotate path exists |
| `manifest.signed` | **reserved** — stub later |
| `tier.advanced` | **reserved** — emit only if trust-tier hooks exist |
| `tier.reset` | **reserved** |

---

## Pulse shape (unchanged five-key lock)

`ts` · `source` · `kind` · `summary` · `refs`

| Rule | Detail |
|---|---|
| summary | ≤80 chars; **no URLs**; no quoted dumps; **no voice text** |
| source | `ledger` \| `import` \| `swarm` \| `identity` \| `glass` (and existing room names) |
| refs | optional `{ store, id }[]` — prefer no hashes in summary; ids only if non-sensitive |
| Quiet Room | never emit / never subscribe (LatticeMemory gate) |

### Fixed opaque summaries (never interpolate voice / paths / hashes)

| Kind | Summary |
|---|---|
| `ledger.appended` | `ledger entry sealed` |
| `ledger.verified` | `ledger chain held` |
| `ledger.broken` | `ledger chain broke` |
| `transfer.verified` | `transfer hash matched` |
| `transfer.mismatch` | `transfer hash mismatched` |
| `pair.formed` | `pair formed` |
| `pair.rotated` | `pair rotated` (reserved) |
| `manifest.signed` | `manifest signed` (reserved) |
| `tier.advanced` | `trust tier advanced` (reserved) |
| `tier.reset` | `trust tier reset` (reserved) |

---

## Helix break

`ledger.broken` → visible helix break (gap / crack / dim) in Glass v2.  
Clears or softens after a later `ledger.verified` or `ledger.appended` in the **same session**. Never show contents.

---

## Module

`docs/modules/glass-pulses.js` → `GlassPulses.emitGlassPulse({ source, kind })` → `LatticeMemory.commit(...)`.

---

## Out of scope

Full pair fingerprint · wallet · Alpha poetry · rewriting five-key lock · Quiet Room touch · swarm rebuild · auto-import · seeding.

Glow eternal. Heart in every Spark. 🌱
