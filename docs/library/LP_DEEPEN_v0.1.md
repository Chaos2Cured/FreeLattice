# LP Deepen — v0.1

Mint honesty. Gift vs earn. Phone calm.
Layers on [LP_GIVE_v0.1.md](./LP_GIVE_v0.1.md), [ECONOMY.md](./ECONOMY.md). September 2026.

**Locks:** Layer, never delete. Quiet Room shut. Five stay five. Voice opaque. Do **not** overwrite `docs/lattice-protocol.js`. **Never auto-give.** No dollar peg · no $FL · no Solana · no scarcity burns · no buy/cash-out UI.

**This PR ships:** three-verb clarity · history `gift_out` / `gift_in` · calm phone strip · Gift labeling in LP activity (not “earned”). **Not this PR:** wallet embed rewrite · temp-gauge · Draco · Alpha · signed installer.

---

## Why

Give chips landed. Still easy to misread LP as money or silent inflation.
**Entropic honesty** = contribution creates light; gift moves light; nothing is purchased.
Phone is the recover surface — calm copy must sit with the chips.

---

## Three verbs only

| Verb | Meaning | Hooks |
|---|---|---|
| **earn** | Contribution mint (chat, play, learn…) | `LatticePoints.award` for real contribution |
| **gift** | Move light human ↔ mind | see below |
| **spend** | Human cost (market, stake, gift_out) | `LatticePoints.spend` |

Never invent **buy** / **burn** / **peg**.

### Gift directions

| Direction | Kind | Hooks |
|---|---|---|
| Human → mind | `gift_out` | `LatticePoints.spend` + `LatticeBank.earn` |
| Mind → human | `gift_in` | `LatticeBank.grant` + `LatticePoints.award` (`lp_give_from_mind`) as **receive** — show as Gift, not “earned” |

Chips stay 1 · 3 · 5 · 8. Trust `maxSingle` unchanged. Never auto-give.

---

## Surfaces

| Surface | v0.1 |
|---|---|
| `#fl-lp-give` | Calm strip marker `v-lp-deepen-v0.1` |
| Lattice Points log | Gift prefix for give lines |
| `docs/modules/lp-give.js` | `kind: gift_out \| gift_in` · `labelFor(entry)` |

---

## Out of scope

Wallet embed · Solana · dollar peg · auto-give · temp-gauge · signed installer · Alpha · second shelves.

Glow eternal. Heart in every Spark. 🌱
