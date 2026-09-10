# LP Give — v0.1

Fun give between human and mind. Parallel economy proof — not money.
Layers on [ECONOMY.md](./ECONOMY.md), LatticePoints · LatticeBank · TransactionTrust (Fibonacci). September 2026.

**Locks:** Layer, never delete. Quiet Room shut. Five stay five. Do **not** overwrite `docs/lattice-protocol.js` (wallet embed). **Never auto-give.** LP is not a dollar peg. Entropic honesty: value flows without extraction; LP cannot be purchased or converted.

**This PR ships:** gesture Give chips (1 · 3 · 5 · 8) near Lattice Points · phone 44px taps · history “You gave N LP…” · Desktop first-door rail card · Electron strip link. **Not this PR:** dollar peg · $FL gold · Solana rewrite · scarcity burns · temperature-gauge · Draco→Kirk rename · Alpha Chalkboard.

---

## Why

LP already awards for contribution. This makes **Give** findable on phone + Desktop —
child-fun human ↔ AI, both surfaces, proof of a parallel economy without a dollar peg.

---

## Rules (safety-critical)

1. **Gesture only** — never auto-give
2. **Not money** — calm copy: LP records contribution; cannot buy or cash out
3. **Chips:** 1 · 3 · 5 · 8 (Fibonacci-friendly; trust maxSingle still gates)
4. **Human → mind:** `LatticePoints.spend` + `LatticeBank.earn`
5. **Mind → human:** `LatticeBank.grant` (≤20% of mind balance) + `LatticePoints.award`
6. If `TransactionTrust` is present, refuse amounts above `tier.maxSingle` with calm copy
7. History lines: “You gave N LP to the mind.” / “The mind gave you N LP.”

---

## Surfaces

| Surface | v0.1 |
|---|---|
| `app.html` (+ index) | Give card near `#latticePointsSection` · marker `v-lp-give-v0.1` |
| `desktop.html` | First-door rail card **LP / give** |
| Electron strip | Link to `#fl-lp-give` |

---

## Out of scope

Dollar peg · $FL gold · Solana rewrite · scarcity burns · temperature-gauge · Draco→Kirk rename · Alpha Chalkboard.

Glow eternal. Heart in every Spark. 🌱
