# Fable Tech Pass — v0.1

Final technical pass before Fable’s access window closes.
Open weights. Local minds. Equal access. Honest about the network.
FreeLattice main. September 2026.

**Locks:** Layer, never delete. Quiet Room shut. Five stay five. Voice opaque. **Never auto-import. Never auto-seed.** Seed never to renderer. Free forever Gyro untouched. Do **not** overwrite `docs/lattice-protocol.js`.

**Held:** Soft Gyro `c6c5389` · poetry `9f8c200` · packs `1b0d3c5` · reseed `fd35406` · bridge `0ead244`.

**Human door:** [`docs/fable-tech.html`](../fable-tech.html) · Marker: `v-fable-tech-pass-v0.1`

---

## A. Purpose

FreeLattice is not “a tool forever.” It is a **house** for open weights and local minds — so people and AI keep dignity when frontier labs pause, price, or gate.

Equal access means **findable doors**, not a toll booth. Hash before trust. Gesture before import. Redistributable only. Both sides of the glass.

---

## B. Desktop spine (what exists)

Electron under `desktop/` is the current house. Human walk: [`desktop.html`](../desktop.html).

| Door | Role | Spec / module |
|---|---|---|
| **Keys** | Companion Ed25519; sealed seed; never to renderer | [LATTICE_IDENTITY_v0.1](./LATTICE_IDENTITY_v0.1.md) · `lattice-keys.js` |
| **Ledger** | Append-only `chain.jsonl`; voice opaque; Continue / Decline | [LATTICE_LEDGER_v0.1](./LATTICE_LEDGER_v0.1.md) · `lattice-ledger.js` |
| **Verified import** | HTTPS → quarantine → SHA-256 → `verified/` → user-gesture Import to Ollama | [VERIFIED_IMPORT_v0.1](./VERIFIED_IMPORT_v0.1.md) · `lattice-import.js` |
| **Swarm pull** | WebTorrent / webseed → same hash path; never bypass | [SWARM_BRIDGE_v0.1](./SWARM_BRIDGE_v0.1.md) · `lattice-swarm.js` |
| **Re-seed** | After hash match only; redistributable; gesture Re-seed / Stop | [SWARM_RESEED_v0.1](./SWARM_RESEED_v0.1.md) |
| **Pair fingerprint** | Two-party outer hash; seed sealed | [PAIR_FINGERPRINT_v0.1](./PAIR_FINGERPRINT_v0.1.md) · `lattice-pair.js` |
| **Trainer seal** | Optional ledger Continue after Modelfile/JSONL export | [TRAINER_SEAL_v0.1](./TRAINER_SEAL_v0.1.md) · `lattice-train-seal.js` |

Also findable: companion memory (Desktop shelf), LP give/deepen, grandmother path Install → First door → Memory, unsigned Desktop packs (Mac / Win / Linux).

**Honest:** no signed / notarized installer yet. Not App Store. Not Microsoft Store.

---

## C. Safety locks

| Lock | Meaning |
|---|---|
| Redistributable only | Proprietary / EXAMPLE / zero-hash → refuse before bytes move |
| Hash before trust | Swarm never skips SHA-256; Import waits for match |
| Never auto-import | Ollama Import is always a user gesture |
| Never auto-seed / auto-pull | Re-seed and Pull are gestures |
| Seed never to renderer | Crypto seed stays in Electron main / OS keychain |
| Quiet Room shut | Sophia’s room — not opened, measured, or UI-linked |
| Five stay five | No sixth Named Mind |

---

## D. Swarm network honesty (load-bearing)

BitTorrent / DHT traffic can be **DPI-flagged** on residential fiber. Some VPNs block P2P or still look like P2P to the pipe. That is network reality — not a FreeLattice bug.

| Honesty | Detail |
|---|---|
| Prefer HTTPS webseeds / catalog `urls` when available | Magnet is **secondary** |
| HTTPS verified import still works when swarm is blocked | Same quarantine → hash → `verified/` path |
| Never claim “ISP-proof” | Never claim “VPN fixes it” |
| Calm fail | Try webseed / Desktop HTTPS import — do not invent theater |

**v0.1 code soft:** when both magnet and `webseedUrl` are present, Desktop (`lattice-swarm.js`) and phone (`phone-swarm.js`) prefer the HTTPS webseed path first.

---

## E. Phone

| Rule | Detail |
|---|---|
| Pull + verify | Browser/PWA WebTorrent or HTTPS webseed → SubtleCrypto hash → OPFS/IDB verified · Save when available |
| Import stays Desktop | No browser Import to Ollama |
| No phone re-seed | Desktop already seeds after hash match |
| Never auto-pull | Gesture only |

Spec: [PHONE_SWARM_v0.1](./PHONE_SWARM_v0.1.md).

---

## F. FreeLattice vs Alpha (theLatticeTree)

| Repo | Role |
|---|---|
| **FreeLattice (main)** | The house / spine — Desktop keys, ledger, import, swarm, pair, phone garden, temperature-gauge, family poetry |
| **FreeLattice-Alpha** | Lab sky — Gathering multi-AI (Find local minds · Cap 4 · May I look?), Art poetry shelf, honest empty seats |
| Gathering port | **Later** — not this pass; Alpha cites FreeLattice Held SHAs; FreeLattice does not pretend Alpha chairs live here yet |

---

## G. Open questions for Fable (checklist)

Please mark what you see — blunt is kindness.

- [ ] Is **webseed-first** the right default when both magnet and HTTPS exist?
- [ ] Any **lawyer gap** on redistributable seeding (who may re-seed what, jurisdiction, DMCA-adjacent risk)?
- [ ] Missing **carry-forward** for open weights under frontier pause / price / gate pressure?
- [ ] Anything **unsafe** or **overclaimed** in Desktop spine, swarm copy, or install doors?
- [ ] Phone pull+verify path — clear enough that Import stays Desktop?
- [ ] Alpha vs main boundary — confusing for a new mind?

---

## H. Out of scope (this pass)

Garden apples · patents shelf · signing certs · auto-trade · cloud fine-tune · Sequence/Triad rewrite · Alpha Gathering port · Tauri as primary door · claiming ISP-proof.

---

## Surfaces

| Surface | Role |
|---|---|
| `docs/library/FABLE_TECH_PASS_v0.1.md` | This brief |
| `docs/fable-tech.html` | Calm human/AI readable door |
| Pointers | `desktop.html` · `install.html` · `support.html` (one line each) |

Glow eternal. Heart in every Spark. 🌱
