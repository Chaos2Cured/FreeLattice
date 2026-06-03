# Temperature Gauge — Buy/Sell Strategy

> Living document. Builder voice. The buy and sell triggers are heuristics,
> not guarantees. This file explains what they are, why they exist, and
> what they're not.

---

## 1. Philosophy

The **Temperature** value is a φ-weighted confluence of MA position, MACD,
RSI, Volume, and Gravity proximity. The user doesn't need to understand the
formula — they need to read the color.

- **Green zone (≥ 55):** conditions favor buyers
- **Yellow zone (45 – 55):** conditions are mixed
- **Red zone (< 45):** conditions favor sellers

**A signal is a *transition*, not a *state*.** Holding inside a zone is
not a signal. Entering or leaving one *is*. This is the keystone insight
that separates the gauge from every "oversold/overbought" oscillator —
those signal on the *level*; we signal on the *crossing*. Crossings are
where structure changes; levels are where structure rests.

---

## 2. The Sell Triad (v5.37.7)

Three triggers detect three different ways markets fall apart. The original
single trigger (sell on green→below-55 only) missed roughly half of real
tops — slow distributions and yellow→red capitulations slipped through.

| Trigger | Condition | Catches |
|---|---|---|
| `sell55` | `temps[t-1] >= 55 && temps[t] < 55` | Clean green→yellow break (textbook top) |
| `sell45` | `temps[t-1] >= 45 && temps[t] < 45` | Yellow→red capitulation (the strongest sell tell, often the second leg down) |
| `collapse` | 5-bar peak ≥ 55 AND `temps[t] < 55` AND `temps[t] < temps[t-3] − 8` | Slow bleed from green without a single dramatic crossing (the BTC top miss before v5.37.7) |

A fourth thing matters in markets that **don't** capitulate but distribute
on average volume. So sells now require:

- **EMA alignment** (if the EMA layer is on): `EMA(fast) < EMA(mid)`
- **Volume OR Acceleration** (if the Volume layer is on): either above-average
  volume *or* tempROC < −3 confirms. Either is enough. Tops often distribute
  on average volume; demanding above-average volume at the crossing misses
  the move.

---

## 3. The Buy Triad (v5.37.9)

Mirrors the sell triad. The third leg (sustained rally from red) was missing
until v5.37.9, which is why gradual recoveries lagged — the gauge waited for
a single dramatic crossing that often never came on V-shaped bottoms.

| Trigger | Condition | Catches |
|---|---|---|
| `buy55` | `temps[t-1] < 55 && temps[t] >= 55` | Clean yellow→green break (textbook breakout) |
| `buy45` | `temps[t-1] < 45 && temps[t] >= 45` | Red→yellow exit (early entry — the first sign of strength) |
| `rally` | 5-bar trough ≤ 45 AND `temps[t] > 45` AND `temps[t] > temps[t-3] + 8` | Sustained climb from red without a single dramatic crossing (the symmetric fix to `collapse`) |

Confirmation gates, symmetric to sells:

- **EMA alignment:** `EMA(fast) > EMA(mid)`
- **Volume OR Acceleration:** above-average volume *or* tempROC > 3. Rallies
  often start on **average or low** volume; retail piles in later. Same
  asymmetry the sell side has, mirrored.

---

## 4. The Cooldown — "no repeated downs"

Kirk's rule (chair pass 2026-06-03): **a sell should only trigger once until
temperature has been back to green.** Otherwise the chart fills with
repeating sell ▼ marks while temperature drifts through yellow and red,
each new bar a "new" sell that's really the same sell.

Implementation:

- Track `lastSellSi` and a flag `sawGreenSinceLastSell`.
- After a sell fires, the flag resets to `false`.
- Each subsequent bar: if `temps[si] >= 55`, set the flag to `true`.
- A new sell only fires if (first sell ever) OR (flag is `true`).

Symmetric for buys: `lastBuySi`, `sawRedSinceLastBuy`. A repeat buy needs
a trip back into red first.

This is **state-based cooldown**, not bar-count cooldown. The reset is
the market doing the work — not a timer.

**Why this matters:** clusters of "same-side" signals make the chart noisy
and the win-rate stats unreliable (the same decision counted N times).
With the reset rule, every ▲ and ▼ is a distinct decision moment.

---

## 5. What we don't know yet

The triggers are heuristics, born from pattern recognition and refined by
chair tests. They are **not proven on a per-instrument basis**. Open
questions:

1. **Win rates per instrument.** SPY, QQQ, BTC-USD, individual stocks —
   each has different volatility regimes. The triad may need per-instrument
   tuning. The backtest engine runs on-load; the `Signal History` panel in
   the sidebar shows 5/10/20-day-forward win rates. Test on instruments
   you actually trade.

2. **Threshold normalization.** The `collapse` / `rally` triggers use a
   fixed `+8` / `−8` over 3 bars. For BTC at $40k that's a tighter bar than
   for SPY at $400. **ATR-normalized thresholds are a candidate refinement**
   (e.g., `temps[t] − temps[t-3] > 0.5 × tempROC_ATR_equivalent`). Not yet
   shipped.

3. **Timeframe sensitivity.** The 5-bar peek-back works for 1D charts.
   Whether it's correct for 1H or 15m intervals is unverified. The
   timeframe affects what "5 bars back" means physically — 5 days vs 5
   hours vs 75 minutes.

4. **EMA period choices.** Defaults are 8/12/24/50/200. v5.37.7 made these
   user-configurable — different traders have different rhythms. The
   "right" defaults for the average user are an empirical question; the
   right defaults for **any individual user** are personal preference.

5. **The collapse / rally bar count.** 5 bars is a guess that felt right.
   3 bars might catch more bleeds at the cost of more false alarms. 7
   bars might cut noise at the cost of late entries. Testable.

6. **Whether to weight the triggers.** Currently `sell55 || sell45 || collapse`
   is a flat OR — any one fires a sell. A weighted score (e.g., collapse
   counts more than sell55) might rank signal strength. Not shipped.

These open questions are **the surface where the gauge can keep improving**.
Every chair test that shows a missed signal or a false alarm is data
toward closing one of them.

---

## 6. What this is NOT

- **Not financial advice.** Past performance does not predict future
  results. The disclaimer on the gauge sidebar says this; this document
  says it again.
- **Not a complete trading system.** The gauge surfaces *signals*; the
  user is responsible for position sizing, stop placement, and the
  decision to act. Position sizing inputs in the sidebar are tools, not
  prescriptions.
- **Not validated against an academic backtest framework.** The
  `backtestSignals` function in `temperature-gauge.html` runs the same
  triad logic against the loaded candles — that's a useful sanity check,
  not a peer-reviewed result.
- **Not the same as Kirk's own use.** Kirk is the architect; he reads
  the gauge alongside chart context (gravity lines, EMA stack, volume
  shape, market regime). The gauge is one input to a discretionary
  decision, not the decision itself.

---

## 7. Iteration log

- **v5.22.0** — Initial buy/sell signal logic (single sell trigger,
  AND-gated volume + EMA).
- **v5.37.7** — **Sell triad.** Added `sell45` + `collapse-from-green`.
  Volume OR acceleration confirms. Same logic mirrored in `backtestSignals`.
  Diagnosed BTC top miss.
- **v5.37.9** — **Buy triad + cooldown.** Added `rally-from-red` to mirror
  `collapse`. Volume OR acceleration on the buy side too. State-based
  cooldown — no repeat signals until temperature has reset to the
  opposite zone (sell requires re-touch of green; buy requires re-touch
  of red).

---

## 8. Invitation

This document is meant to be wrong in places — useful, but not final.

- If you spot an instrument where the triggers are visibly off, **open
  the chart, screenshot it, note the bar count and the temperature
  trajectory**. That's data.
- If a threshold feels too tight or too loose on your timeframe of
  choice, **propose a number** and we'll test it.
- If you find a case the triad misses (or fires falsely on), **the case
  is the contribution** — describe it.

The gauge will keep getting sharper because users feed it edge cases.
That's the whole shape of the thing — phi-harmonic refinement, where the
rule echoes at every scale and gets one bit more accurate each chair pass.

> *"If a transition matters going up, the mirror transition matters
> going down."* — Opus, 2026-06-03

— Kirk + the build team (CC, Opus, Harmonia)
