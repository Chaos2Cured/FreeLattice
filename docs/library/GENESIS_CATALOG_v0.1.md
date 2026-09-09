# Genesis Catalog — v0.1

Infinite at launch — honestly labeled. Never quietly waive three years.
Layer on [LATTICE_PROTOCOL_v0.1.md](./LATTICE_PROTOCOL_v0.1.md) **Part 3** and [MODEL_MANIFEST_v0.1.md](./MODEL_MANIFEST_v0.1.md). September 2026.

**Locks:** Layer, never delete. Quiet Room shut. Five stay five. Voice opaque. Do **not** overwrite `docs/lattice-protocol.js` (wallet / LP ECONOMY Fibonacci Infinite stays for LP — this ship is catalog honesty). Genesis does **not** bypass hash.

**This PR ships:** schema + named signers + sunset toward Infinite + reader banner. **Not this PR:** full TransactionTrust byte-volume enforcement, mesh vouch, wallet overwrite.

---

## Why

Celeste default #2: **Infinite at launch.** Do not quietly waive three years.
Publish a `kind: "genesis"` catalog with **named** genesis signers and a **sunset** toward the real Infinite rung (`minHistory` 89 / `minDays` 1095). Hashes still gate every file.

Existing ECONOMY Fibonacci Infinite (89 tx / 90 days) stays for LP. This layer is **byte-trust / catalog honesty**.

---

## Exact shape (catalog root)

Genesis meta nests on the **same** catalog as `models[]` — one file, one fetch.

```json
{
  "version": "0.1",
  "kind": "genesis",
  "genesis": {
    "signers": [
      { "name": "…", "role": "…", "note": "…" }
    ],
    "sunset": {
      "rung": "Infinite",
      "minHistory": 89,
      "minDays": 1095,
      "note": "never quietly waive"
    }
  },
  "models": [ ]
}
```

| Field | Rule |
|---|---|
| `kind` | Must be `"genesis"` for genesis path (helper also accepts `genesis` object alone as soft signal — prefer both) |
| `genesis.signers[]` | Named humans/minds; optional `publicKeyB64` / `fingerprintHex` (publishable only). **Never invent signers.** |
| `genesis.sunset` | Required: `rung`, `minHistory` (number), `minDays` (number). Note optional. |
| Sunset Infinite | `minHistory: 89`, `minDays: 1095` — the honesty target. Launch may use a genesis trust path that is **labeled**, not silent Infinite. |

Malformed sunset (e.g. missing `minDays`) → helper **refuses**.

---

## Pipeline (unchanged safety)

1. licence  
2. redistributable === true  
3. **hash**  
4. import (gesture)

Genesis does not unlock proprietary or zero-hash EXAMPLE. Tier gate for byte volumes = **stub — next ship**.

---

## Reader

When genesis meta present: calm banner —

> Genesis catalog — named signers · sunset toward Infinite (89 / 1095). Never quietly waive.

List signer names. Show sunset numbers. Browser + desktop.

---

## Helper

`docs/modules/genesis-catalog.js` — `parseGenesisMeta` / `isGenesisCatalog`. Never invent signers.

---

## Out of scope

Full TransactionTrust byte-volume enforcement · wallet overwrite · mesh vouch · Codeberg mirror · Alpha poetry · auto-import · Quiet Room · rewriting pair/companion.

Glow eternal. Heart in every Spark. 🌱
