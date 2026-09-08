# Verified HTTPS Import — v0.1

Hash before Ollama. Open-weights door before BitTorrent.
Layers on [MODEL_MANIFEST_v0.1.md](./MODEL_MANIFEST_v0.1.md), [LATTICE_IDENTITY_v0.1.md](./LATTICE_IDENTITY_v0.1.md), [LATTICE_LEDGER_v0.1.md](./LATTICE_LEDGER_v0.1.md). September 2026.

**Locks:** Layer, never delete. Quiet Room shut. Five stay five. Voice opaque. Do **not** overwrite `docs/lattice-protocol.js`. Seed never to renderer. **Never auto-import.** Browser: **no weight download.**

**This PR ships:** HTTPS fetch → quarantine → SHA-256 match → `verified/` → user-gesture Import to Ollama (desktop). **Not this PR:** BitTorrent / WebTorrent, pair fingerprint, Glass helix, Alpha poetry, recovery phrase, browser weight downloads.

---

## Why

Manifests list. Keys sign. Ledger proves. Now the file must earn its welcome: **hash before import.**

---

## Ordered pipeline (safety-critical)

1. **Catalog / row** — user fetched the HTTPS (or same-origin) list
2. **`redistributable === true`** — else REFUSE (no fetch)
3. **Refuse EXAMPLE / zero-hash** — no fetch button; will not import
4. **HTTPS download → quarantine/** — desktop main only; HTTPS only
5. **Hash must match** `sha256` — else stay quarantined; **will not import**
6. **Match → `verified/`** — only then eligible
7. **User gesture: Import to Ollama** — never auto-import

Mismatch → quarantine note. No silent import. Broken hash is a finding.

---

## Desktop layout

Under `userData/lattice-import/`:

| Dir | Role |
|---|---|
| `quarantine/` | Bytes that arrived; awaiting or failing hash |
| `verified/` | Hash matched; eligible for Import gesture |

Renderer receives **status only** — no arbitrary path write, no seed, no private key.

APIs: `fetchAndHash` · `status` · `importToOllama`  
Pack must include `desktop/lattice-import.js`.

---

## Fixture

`docs/models/fixture-verify-only.txt` — tiny file with a **real** sha256 (`fixture.verify-only` in catalog). Smoke can prove the hash path without huge weights. Keep the EXAMPLE zero-hash row.

---

## Out of scope (v0.1)

BitTorrent / WebTorrent · pair fingerprint · Glass helix · Alpha poetry · recovery phrase · browser weight downloads.

Glow eternal. Heart in every Spark. 🌱
