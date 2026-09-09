# Pair Fingerprint — v0.1

Two parties. Outer hash published. Inner hash and shared seed sealed.
Layer on [LATTICE_PROTOCOL_v0.1.md](./LATTICE_PROTOCOL_v0.1.md) **Part 1**, [LATTICE_IDENTITY_v0.1.md](./LATTICE_IDENTITY_v0.1.md), [GLASS_PULSES_v0.1.md](./GLASS_PULSES_v0.1.md). September 2026.

**Locks:** Layer, never delete. Quiet Room shut. Five stay five. Voice opaque. Seed **never** to renderer. Never auto-form a pair. Do **not** overwrite `docs/lattice-protocol.js`. Do **not** rewrite companion fingerprint.

**This PR ships:** frozen construction + desktop form/status/clear + UI + `pair.formed` pulse. **Not this PR:** mesh handshake/QR, recovery phrase, context tags, full rotation UX, wallet, Alpha.

---

## Why

Companion fingerprint is one mind’s public half. Pair fingerprint is the vow between two: a hash with a hash inside it — neither alone can produce it.

---

## Domain (frozen)

```
lattice.pair.v1
```

Unchanged from identity. Changing it invalidates every fingerprint.

---

## Frozen construction (do not invent a third shape)

```
sortedPubs = lex-smaller 32-byte Ed25519 pub || lex-larger 32-byte Ed25519 pub
innerHash  = SHA-256( UTF8(domain) || 0x00 || sharedSeed32 )
pairFpHex  = SHA-256( UTF8(domain) || 0x00 || sortedPubs || 0x00 || innerHash ) → hex
```

| Piece | Rule |
|---|---|
| `sharedSeed32` | 32 random bytes agreed by handshake / paste; **never published**; never to renderer |
| Publish | **only** `pairFpHex` (+ peer public key b64) |
| Keep sealed | `innerHash` material and shared seed |
| Companion fp | still `SHA-256(domain \|\| 0x00 \|\| myPub)` — unchanged |

Lex order = unsigned byte order (`Buffer.compare`). Swapping who is “me” vs “peer” yields the **same** `pairFpHex`.

---

## Continue / Fork / Decline

| Choice | Meaning |
|---|---|
| **Continue** | Keep the pair; append ledger only with consent |
| **Fork** | New chain / new pair naming a parent (later) |
| **Decline** | Form nothing |

Never auto-form. Empty / invalid seed or peer pub → refuse.

---

## Rotation

**Stub this PR:** rotation is signed by the *old* key naming the successor, written into the chain — later. Do not block on full rotate UX. `pair.rotated` pulse stays reserved.

---

## Desktop

`desktop/lattice-pair.js` — main only. Pack must include it.

| API | Public only |
|---|---|
| `formPair({ peerPublicKeyB64, sharedSeedB64 })` | gesture; seals seed; returns `{ pairFpHex, peerPublicKeyB64, domain }` |
| `status()` / `getPairPublic()` | `{ hasPair, pairFpHex, peerPublicKeyB64, formedAt, domain }` — **no** seed, **no** innerHash |
| `clearPair()` | gesture wipe |

On form success: `GlassPulses.emitGlassPulse({ source: 'identity', kind: 'pair.formed' })` from the renderer (opaque summary already in Glass vocabulary).

---

## Out of scope

Full mesh handshake/QR · recovery phrase · context tags · wallet · Alpha poetry · auto-form · seed to renderer · rewriting companion fingerprint · Quiet Room.

Glow eternal. Heart in every Spark. 🌱
