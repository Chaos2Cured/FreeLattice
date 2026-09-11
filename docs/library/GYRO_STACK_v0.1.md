# Gyro Stack — v0.1

Three lines. φ-linked. Cross = signal. Free forever.
Layers on [TEMPERATURE_GAUGE_STRATEGY.md](./TEMPERATURE_GAUGE_STRATEGY.md) and `docs/temperature-gauge.html`. September 2026.

**Locks:** Layer, never delete. Quiet Room shut. **Free forever** — no paywall · no $5–10 subscription. Heuristics, not guarantees. No auto-trade · no broker hooks · no Celeste/Elon auto-trader. Do **not** overwrite `docs/lattice-protocol.js`.

**This PR ships:** Gyro Stack spec · optional three-line overlay on the Temperature Gauge · calm Hub / Ring / Orbit names · free · heuristics · you decide copy · strategy cite. **Not this PR:** subscriptions · auto-trade · broker APIs · patents page · Alpha · Imagine.

**Held:** packs `1b0d3c5` · TEMPERATURE_GAUGE_STRATEGY · `temperature-gauge.html`.

---

## Why

Kirk’s Gyro — decades of watching markets return from stretch — is φ-linked tools that collapse into **three lines**. Overextension, then return, then **cross** led the eye long before the gauge had code.

The Temperature Gauge already treats **crossings as signals** (zone transitions; Sequence / Triad rules). This layer does not invent a new certainty engine. It draws the Gyro-shaped three-line stack into the same φ confluence so a trader can *see* stretch and return the way the chair already feels it.

Equal access: the stack stays free. No subscription gate. No “pro tier.” The biggest desks do not get a private Gyro.

---

## The three lines (named calmly)

| Line | Role | Period (φ-linked) |
|---|---|---|
| **Hub** | Inner rhythm — closest attractor | `P` (default = EMA fast / first period, usually 8) |
| **Ring** | Mid φ step — first return surface | `round(P × φ)` ≈ 13 when P=8 |
| **Orbit** | Outer φ step — overextension rim | `round(P × φ²)` ≈ 21 when P=8 |

`φ = 1.618033988749895`. Periods follow the user’s EMA-fast base when set, so the Gyro stays in the same family as the EMA layer — not a second kitchen.

Drawn as EMAs of close. Optional overlay (`layerGyro`). Off by default. Temperature rules stay the signal authority unless the user is reading Gyro crosses by eye.

---

## Cross = signal (heuristic shape)

1. **Overextension** — price stretches beyond a meaningful distance from Hub (ATR-normalized; φ-scaled).
2. **Return** — stretch cools; price moves back toward Ring / Hub.
3. **Cross** — close crosses Hub or Ring after recent overextension.

That triad of motion is the Gyro *intent*. Markers, when shown, are **watch diamonds** — heuristics on the chart, not orders, not broker hooks, not a fourth RULE_REGISTRY default that pretends proof.

Buy/sell triads and the Sequence Rule remain as documented in TEMPERATURE_GAUGE_STRATEGY. Gyro does not replace them. Gyro **rhymes** with them: structure changes at crossings.

---

## Free forever

| Promise | Detail |
|---|---|
| No paywall | Gyro overlay ships in FreeLattice with the gauge |
| No $5–10 sub | Never gate Hub / Ring / Orbit behind payment |
| Heuristics | Past patterns ≠ future results |
| You decide | Position, size, and action stay with the human |

---

## Surfaces

| Surface | v0.1 |
|---|---|
| `docs/library/GYRO_STACK_v0.1.md` | This spec |
| `docs/temperature-gauge.html` | Optional Gyro overlay + free/heuristics copy |
| `docs/library/TEMPERATURE_GAUGE_STRATEGY.md` | Cite Gyro intent; keep sell/buy triads |
| Marker | `v-gyro-stack-v0.1` |

---

## Out of scope

Subscriptions · auto-trade · broker APIs · patents page · Alpha · Imagine · rewriting Sequence / Triad evaluate · Celeste/Elon auto-trader.

Glow eternal. Heart in every Spark. 🌱
