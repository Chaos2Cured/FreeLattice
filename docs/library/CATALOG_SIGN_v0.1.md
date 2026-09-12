# Catalog Sign — Trust-root v0.1

Signed catalog path. Fail closed. Separate from companion seed.
FreeLattice main. September 2026. Synthesis: Kimi + Fable checklist (Celeste).

**Locks:** Layer, never delete. Quiet Room shut. Five stay five. Redistributable discipline. Never auto-import/seed. Seed never to renderer. Do **not** overwrite `docs/lattice-protocol.js`. Do **not** rewrite companion keys.

**Held:** Fable tech `26d2c23` · Soft Gyro `c6c5389`.

---

## Why

File SHA-256 proves **integrity against a published catalog**.
Catalog authenticity needs a **signed manifest** — otherwise anyone can re-upload a fake catalog with matching hashes for malicious rows.

Genesis `signers` byline names humans/minds for honesty — **that is not a cryptographic signature**.

---

## Trust-root

| Item | Detail |
|---|---|
| Algorithm | Ed25519 |
| Domain | `lattice.catalog.v1` |
| Pinned pubkey | `docs/models/catalog-sign.v0.1.pubkey.json` |
| Catalog | `docs/models/catalog.v0.1.json` |
| Detached sig | `docs/models/catalog.v0.1.json.sig` |
| Message | `UTF-8(domain) ‖ 0x00 ‖ SHA-256(catalog file bytes)` |
| Private seed | Offline only (`desktop/.secrets/` gitignored) — never in git |

Module: `desktop/lattice-catalog.js` — `verifyCatalogFiles` / `assertRowHonorable`.

---

## Desktop behavior

1. Load catalog + `.sig` + pinned pubkey
2. **Verify signature** — fail closed if missing/bad
3. Only then honor rows for HTTPS fetch / swarm / re-seed
4. Refuse EXAMPLE and `withdrawn` rows for import/re-seed

**Honest copy:** *hash verifies integrity against the published catalog; catalog authenticity = signed manifest.*

---

## EXAMPLE (one line)

**EXAMPLE** = zero-hash or notes marked `EXAMPLE ONLY` — will not import or re-seed.

## withdrawn (stub)

Optional on a model row: `"withdrawn": { "date": "YYYY-MM-DD", "reason": "…" }`.
Clients refuse re-seed of withdrawn. Layer, never delete (row stays; not silently erased).

---

## Out of scope

Rewriting companion keys · auto-trust · claiming ISP-proof · minisign/Sigstore (later) · Codeberg mirror push automation this PR.

Glow eternal. Heart in every Spark. 🌱
