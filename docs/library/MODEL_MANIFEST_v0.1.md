# Model Manifest — v0.1

HTTPS lawful catalog for FreeLattice. Equal access = safety.
Layer on [LATTICE_PROTOCOL_v0.1.md](./LATTICE_PROTOCOL_v0.1.md) **Part 4**. September 2026.

**Locks:** Layer, never delete. Quiet Room shut. Five stay five. Do **not** overwrite `docs/lattice-protocol.js` (wallet embed — different layer). Lawyer review before any seeding network ships.

**This PR ships:** read-only fetch + refuse rules. **Not this PR:** weight download, Ollama import, BitTorrent, signing keys, DOMAIN separator, canonical JSON.

---

## Load-bearing fields

| Field | Required | Notes |
|---|---|---|
| `id` | yes | Stable string, e.g. `example.local-friendly.3b` |
| `name` | yes | Human label |
| `license` | **yes — load-bearing** | SPDX-ish string (e.g. `Apache-2.0`) |
| `redistributable` | **yes — load-bearing bool** | Must be JSON `true` or the reader **REFUSES** |
| `sha256` | **yes — load-bearing** | Hex digest of the file bytes |
| `urls` | yes | Array of **HTTPS** URLs only (or same-origin relative paths resolved to HTTPS on Pages) |
| `notes` | no | Free text for humans |

A seeder (later) refuses what it cannot lawfully redistribute. A reader (this ship) refuses `redistributable !== true`.

---

## Pipeline order (safety-critical — print this order)

1. **Acceptable signer** — stub in v0.1: unsigned catalog is OK for **read-only** list display.
2. **Tier gate** — stub in v0.1: **not enforced** this PR (TransactionTrust / byte tiers later).
3. **Licence + redistributable** — require `redistributable === true` **or REFUSE**. Show license. Never soft-pass proprietary.
4. **Hash the file** — compare downloaded bytes to `sha256` (download **not** this PR; UI may still warn on zero-hash / EXAMPLE).
5. **Only then import** — desktop / Ollama LATER — **not this PR**.

**Mismatch → quarantine note.** No silent import. Broken hash is a finding, not a swallowed exception.

---

## Zero-hash / EXAMPLE rule

If `sha256` is all zeros, or `notes` mark the row as EXAMPLE ONLY, the UI must say **example only — will not import**. Do not offer download or import controls in v0.1.

---

## Catalog location

- Default same-origin: `./models/catalog.v0.1.json`
- Public: `https://freelattice.com/models/catalog.v0.1.json`

Fetch only on **user gesture**. Allow `https:` URLs and **same-origin relative** paths only.

---

## Out of scope (v0.1)

BitTorrent · weight download · Ollama import · signing / DOMAIN / canonical JSON · `desktop/lattice-keys.js` · Alpha · seeding network.

Glow eternal. Heart in every Spark.
