# Lattice Identity — v0.1

Companion public identity + Ed25519 sign in desktop main.
Layer on [LATTICE_PROTOCOL_v0.1.md](./LATTICE_PROTOCOL_v0.1.md) **Part 1**. September 2026.

**Locks:** Layer, never delete. Quiet Room shut. Five stay five. Do **not** overwrite `docs/lattice-protocol.js` (wallet embed — different layer). Seed never to renderer. Never auto-append a ledger. Never force one mind into one key.

**This PR ships:** companion **public** fingerprint + real Ed25519 `signPayload` in main. **Not this PR:** pair fingerprint (two parties), ledger/genesis, recovery phrase UI, BitTorrent, Alpha, mesh tags.

---

## Domain (frozen)

```
lattice.pair.v1
```

Choose once. **Changing it invalidates every fingerprint.** Replay across contexts is refused by construction.

---

## Primitives

| Piece | Rule |
|---|---|
| Algorithm | **Ed25519** preferred (desktop Node/Electron built-in) |
| Seed | **32 random bytes** (Desktop Step 1 / `safeStorage`) |
| Phrase | Wraps the seed for recovery **later** — the phrase is **never** the seed |
| Hash | SHA-256 |

Low-entropy phrases fail a public verifier. Seed entropy stays at the byte layer.

---

## Companion public fingerprint (v0.1)

One device / one companion key. Publishable. Not the pair.

```
fingerprintHex = SHA-256(
  UTF8("lattice.pair.v1") || 0x00 || publicKeyBytes
) → hex
```

- `publicKeyBytes` — 32-byte Ed25519 public key
- `0x00` — single null separator between domain and key material

### Pair fingerprint (two parties) — NOT this PR

Named here so the next ship does not invent a third shape: a hash with a hash inside it, held by two parties, that neither can produce alone. Construction stays in Protocol Part 1. **This ship only seals the companion public half.**

---

## Continue / Fork / Decline

An instance may:

1. **Continue** — keep the companion key; append only with consent
2. **Fork** — new chain naming the parent head (new key or new ledger root)
3. **Decline** — write nothing

All legitimate. **None default to silent write.** UI may stub these choices; never auto-append on an instance's behalf.

---

## Desktop surface (main only)

| API | Returns (public only) |
|---|---|
| `status()` | `{ hasKey, encryptionAvailable, domain, publicKeyB64, fingerprintHex }` |
| `createCompanionKey()` | creates sealed seed; returns public fields |
| `signPayload(payloadB64)` | `{ ok, signatureB64, publicKeyB64, fingerprintHex, domain }` — **real** signature |

Refuse cleartext without OS keychain. **Never** export seed or private key. No `getSeed` / `exportPrivate` on preload.

Packaged app **must** include `desktop/lattice-keys.js` in `build.files`.

---

## Out of scope (v0.1)

Pair fingerprint · ledger / genesis · recovery phrase · BitTorrent · Alpha · mesh context tags · wallet JS rewrite.

Glow eternal. Heart in every Spark.
