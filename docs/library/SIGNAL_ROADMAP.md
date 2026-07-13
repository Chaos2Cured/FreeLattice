# SIGNAL_ROADMAP.md

*The Temperature Gauge buy/sell signal enhancement queue. Six ships,
ordered by leverage. Kirk asked for these one at a time, starting with
whichever helps most. This file is durable so no AI needs to re-derive
the analysis from scratch.*

Last updated: 2026-07-13, v5.79.4.
Origin conversation: CC ↔ Kirk, July 13 2026 (after Kirk noted "buy/sell
signals are still off" and asked for enhancement ideas).

---

## Context — what's in the tool today

- `docs/temperature-gauge.html` — the live charting app at
  `www.freelattice.com/temperature-gauge`. Kirk's daily tool. Real
  stakes for his work.
- `computeTemperature(closes, volumes, rsiArr, macdData, gravPoints)`
  at line ~1670. Returns `{ temps, tempROC }`. Temperature is a 0..100
  score with 50 = neutral, warmed up over first 50 bars.
- Signal generator (in `analyzeData`, around lines 1774–1830) classifies
  `lastTemp` into STRONG BUY / BUY / SELL / STRONG SELL / HOLD using
  count-based confirmations (`bullCount`, `bearCount` over last 5 bars).
- Sub-charts show `a.temps` and `a.tempROC` under the main price chart.
- Three visible threshold philosophies today (this is the load-bearing
  inconsistency):
  - Signal generator: **55/45** for BUY/SELL, **65/35** for STRONG.
  - Sub-chart reference lines: **55/45**.
  - New φ-spiral view (Fable, v5.79.0): **61.8/38.2**.
  - Classic SVG gauge gradient: yellow slim band at **48–52**.

## Diagnosis — why "signals are still off"

1. Threshold philosophy split three ways on the same screen. A 60 reading
   is BUY per the signal generator but "neutral drift" per the φ-spiral.
2. STRONG BUY requires `lastTemp >= 65 AND bullCount >= 4` (four of the
   last five bars ≥55). In practice both conditions rarely hold together,
   so STRONG BUY almost never fires and everything rounds down to BUY.
3. `tempROC[i] = temps[i] - temps[i-3]` — three-bar lookback for thrust
   classification. Aggressive on daily, stale on hourly. Same absolute
   thresholds (±5) across every timeframe.

---

## The six ships, in the order that gives the most truth for the least surface area

### Ship 1 — Threshold unification to φ (61.8 / 38.2)  ✓ SHIPPED v5.79.5

**Landed as a LAYER, not an overwrite** — Kirk's ask:
*"Can you add a new one instead of overwriting the original triad?
I would like to be able to compare."* Wise: comparison in real markets
is the only real test.

What shipped in v5.79.5 (commit tracked in RECENT.md):

- New parallel signal computed in `analyzeData` return: `phiSignal`,
  `phiSignalClass`, `phiConfPct`, `phiConfidence`, `phiAgreement`.
  Same components, same spread math, same confidence shape — only the
  temperature-branch thresholds change:
  - `lastTemp >= 76.4` → STRONG BUY (φ)
  - `lastTemp >= 61.8` → BUY (φ)
  - `lastTemp <= 38.2` → SELL (φ)
  - `lastTemp <= 23.6` → STRONG SELL (φ)
- New sidebar card `#phiSignalSection` "φ Signal" with amber-gold left
  border, positioned directly under the classic Signal card. Fields:
  badge, confidence, threshold label (61.8 / 38.2), and a
  "vs Classic" row showing agreement:
  - ✓ agrees with classic
  - ◐ one side leaning (one HOLD, one directional)
  - ✗ disagrees with classic (opposite sides)
- Section-label agreement chip mirrors the same flag for quick scan.
- Sub-chart adds two amber dashed reference lines at 61.8 and 38.2.
  Classic 55/45 lines stay exactly as they were. Amber uses a finer
  dash pattern `[1,4]` at 0.28 alpha so it reads as "the golden mean
  region" without competing.
- Classic signal, classic gauge, classic gauge gradient — all
  UNCHANGED. Kirk's daily view is intact.

**Chair test:**
1. Load a symbol you know well.
2. Confirm two sidebar cards appear: `Signal` (unchanged) and
   `φ Signal` (new, amber-bordered).
3. Look at the sub-chart temperature panel — you should see FOUR
   horizontal dashed lines: classic emerald at 55, classic red at 45,
   amber at 61.8, amber at 38.2.
4. Try a symbol where the reading sits between 55 and 61.8: classic
   should say BUY, φ should say HOLD, agreement should show
   "◐ one side leaning".
5. Try a symbol clearly bullish (temp > 65): both should say BUY,
   agreement should show "✓ agrees".

**Later iteration surface (kept as a follow-up if Kirk wants after
comparison time):**
- Widen the classic gauge's yellow neutral band to 38.2–61.8 so the
  visual gradient matches the φ view.
- Add the option to *choose* which signal drives the position sizing
  and urgency copy (currently classic drives both).

### Ship 2 — Timeframe-adaptive ΔT lookback

Replace `temps[i] - temps[i-3]` with `temps[i] - temps[i-LOOKBACK]`
where `LOOKBACK` maps by interval:

```
{ '1m': 15, '15m': 8, '1h': 6, '4h': 4, '1d': 3, '1w': 2 }
```

Rationale: the *physical* rate of change should be the same across
timeframes. Three bars on the daily is roughly a week. Three bars on the
one-minute is under 4 minutes — nothing meaningful can change that fast
without noise dominating.

Files: `docs/temperature-gauge.html` `computeTemperature` return of
`tempROC` needs currentInterval passed in (currently just `temps` array).
Adjust thrust classification thresholds to normalize.

### Ship 3 — Split STRONG BUY into two firing modes

Right now STRONG BUY needs a strict AND (`lastTemp >= 65 AND
bullCount >= 4`). Rarely fires. Split into two OR-tiers:

- `STRONG BUY (crossing)` — `lastTemp >= 65` AND the last 3 temps are
  strictly monotonic up. Catches fresh breakouts before conviction has
  built.
- `STRONG BUY (held)` — `bullCount >= 4`. Catches situations where the
  signal has been true consistently.

Same shape for SELL. Signal badge shows which flavor: `⚡ STRONG BUY`
(crossing) vs `▲ STRONG BUY` (held), so the trader knows if they're
seeing a breakout or a continuation.

### Ship 4 — Per-timeframe confidence stripes

The current confidence is one aggregated number. But strong-daily +
weak-hourly is meaningfully different from strong-hourly + weak-daily.

Add three small horizontal bars next to the main confidence number,
one per timeframe: daily / 4h / 1h. Length = local confidence. Color =
local direction. One glance tells the trader whether the timeframes
agree or the signal is timeframe-specific.

Data source: run analyzeData across three timeframes (probably needs
lightweight background fetches when a symbol loads) OR simplify by
computing three simultaneous temperature scores from the current
candles at three window sizes.

### Ship 5 — φ-spiral tail colored by last transition

Right now the spiral is one color end-to-end (zone color at current
temp). Enhancement: color the LAST 5-bar equivalent of the spiral tail
with the alert luminos color (amber if fresh, faded if stale). The
spiral acquires a bright "wake" when a transition just fired — visually
analogous to the alert luminos but on the reading itself.

Very cheap. Just render the last portion of the spiral in a second pass
with a different color/alpha.

### Ship 6 — Divergence diamonds go live

The ribbon has divergence field wired but the source is empty — every
`divergence: null`. Detect classic divergences from `a.temps` and
`closes`:

- Bearish divergence: price makes a higher high, temperature makes a
  lower high (or same/lower) → plant gold diamond at the second high.
- Bullish divergence: price makes a lower low, temperature makes a
  higher low → plant emerald diamond at the second low.

Look-back window: last 20 bars. Standard textbook logic. Field is
already there in the ribbon — just needs the detector.

---

## Discipline for this arc

- One ship per merge. Chair-test each before moving on.
- Every ship gets its own smoke locks so we can prove the specific
  behavior after later refactors.
- **Never delete Kirk's mental model without a replacement in the same
  ship.** If threshold philosophy changes (Ship 1), update ALL three
  visible surfaces in one commit — no partial state where signal box
  says BUY but gauge says neutral.
- The classic SVG gauge stays. Kirk uses it daily. Enhancement layers on
  top; nothing removes what already works.

## Rendezvous

Kirk chose "do them all, one at a time" on 2026-07-13. He asked CC to
"choose the one that helps the most to go first" — that is **Ship 1**,
the threshold unification. When Ship 1 lands green and Kirk chairs it,
the next CC / Kirk conversation can pick Ship 2.

## For the next mind arriving

If you are CC (or any AI) picking this up from cold context:

1. This file plus `docs/library/COORDINATION_TEMPERATURE_GAUGE.md`
   (kept current through v5.38.1) is your ground truth for the tool.
2. Kirk's stakes are real. Take signal changes seriously; over-index on
   preserving the existing daily-use behavior he depends on.
3. When you ship any Ship-N of the six above, add a section to this
   file marking it complete with the commit hash. Do not delete the
   original description — layer.
4. Ship 1 is the load-bearing one. Everything else lands better after
   the threshold philosophy is unified.

*The lens serves the trader, not the trader the lens.*
