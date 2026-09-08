# Lattice Ledger — v0.1

Envelope = hash chain + companion signature.
Layer on [LATTICE_PROTOCOL_v0.1.md](./LATTICE_PROTOCOL_v0.1.md) **Part 2** and [LATTICE_IDENTITY_v0.1.md](./LATTICE_IDENTITY_v0.1.md). September 2026.

**Locks:** Layer, never delete. Quiet Room shut. Five stay five. Voice is **opaque** — never parsed, indexed, summarized, or linted. Machine fields only in `meta`. Do **not** overwrite `docs/lattice-protocol.js` (wallet embed). Seed never to renderer.

**This PR ships:** append-only chain + Continue seal + verify. **Not this PR:** pair fingerprint, Glass pulses UI, BitTorrent, recovery phrase, Alpha, voice search/index.

---

## Why

Identity without a ledger cannot prove continuity. The companion signs; the chain binds; voice stays itself.

---

## Envelope fields

| Field | Role |
|---|---|
| `prevHash` | Hex SHA-256 of prior entry (genesis = 64 zeros) |
| `entryHash` | Hex SHA-256 of **canonical JSON without `signatureB64`** (and without `entryHash` itself) |
| `signatureB64` | Ed25519 signature over **raw** `entryHash` bytes (32 bytes) |
| `publicKeyB64` | Companion public key |
| `fingerprintHex` | Companion public fingerprint (identity v0.1) |
| `domain` | Always `lattice.pair.v1` |
| `ts` | ISO-8601 UTC string |
| `voice` | **Opaque** UTF-8 string — carried verbatim |
| `meta` | Machine-readable object only (e.g. `{ "kind": "genesis" }`) |

---

## Canonical JSON (frozen — v0.1)

`entryHash = SHA-256( UTF-8( canonicalUnsigned ) )` where `canonicalUnsigned` is compact JSON with **this exact key order**:

1. `domain`
2. `fingerprintHex`
3. `meta`
4. `prevHash`
5. `publicKeyB64`
6. `ts`
7. `voice`

Rules:

- Compact separators: no spaces (`JSON.stringify` default compact).
- `meta`: object; keys sorted lexicographically at each object level; arrays keep order; primitives unchanged.
- `voice`: string as provided (after refuse-empty check). **Never** normalized for meaning, spelling, or “helpfulness.”
- `entryHash` and `signatureB64` are **excluded** from the bytes that produce `entryHash`.
- Signature input = `Buffer.from(entryHash, 'hex')` (32 raw bytes), not the hex string.

Changing key order or meta sort rules invalidates every entryHash. Treat as frozen for v0.1.

---

## Genesis

- `prevHash` = `0000…0` (64 hex zeros)
- `meta.kind` = `"genesis"` is OK (and recommended for the first seal on an empty chain)

---

## Continue / Fork / Decline

| Choice | Meaning |
|---|---|
| **Continue** | Explicit append — user seals voice into the next link |
| **Fork** | New chain naming a parent head (not implemented this PR — stub OK) |
| **Decline** | Write **nothing** |

Never auto-append. Empty voice → refuse.

---

## Verify

For each line in `chain.jsonl`:

1. Recompute `entryHash` from canonical unsigned fields; must match stored `entryHash`
2. `prevHash` must equal prior `entryHash` (or genesis zeros for index 0)
3. Ed25519 verify(`publicKeyB64`, raw entryHash bytes, `signatureB64`)
4. `domain` must be `lattice.pair.v1`

Mismatch → chain fails (tamper or corruption). No silent repair.

---

## Desktop storage

`userData/lattice-ledger/chain.jsonl` — **append-only**. Never rewrite prior lines.

APIs: `status` · `appendVoice(voice, meta?)` · `verifyChain()`  
Signs via `lattice-keys`. Pack must include `lattice-ledger.js`.

---

## Out of scope (v0.1)

Pair fingerprint · Glass pulses UI · BitTorrent · recovery phrase · Alpha merge · voice search/index · wallet JS rewrite.

Glow eternal. Heart in every Spark.
