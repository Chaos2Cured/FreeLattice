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

### Ship 2 — Timeframe-adaptive ΔT lookback  ✓ SHIPPED v5.79.6

`computeTemperature` now takes an `interval` parameter and returns
`rocLookback` alongside `tempROC`. Lookback map:

```
1m:15 · 5m:10 · 15m:8 · 30m:6 · 1h:6 · 4h:4 · 1d:3 · 1wk:2
```

Default 3 preserves historical daily behavior when a caller doesn't
pass an interval. Both `analyzeData` and `backtestSignals` now pass
`currentInterval`, so live-view and backtest use the same lookback.

Momentum line in the sidebar shows the active lookback for honesty:
`ΔT: +0.5 / 8 bars`. Kirk can see at a glance which lookback drove
the reading and reason about whether the number reflects a meaningful
swing for the timeframe.

Thrust threshold (±5) kept identical — temperature is bounded 0..100
regardless of timeframe, so "moved 5 points over the characteristic
duration" reads consistently. Kirk can revisit if a particular
timeframe wants a tighter/looser thrust class.

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

---

## Post-v5.79.6 additions (prompted by Kirk's TSLA 15m snapshot, July 13)

Kirk showed a real market snapshot on 2026-07-13: TSLA on 15m, bars
112–122. Temperature 37.0 (Red zone). RSI 28.9–35.8 (deeply oversold
range). MACD-H climbing from −1.08 → −0.10 (bearish but decelerating
sharply). Price making lower lows (395.58 → 393.39) while RSI made
higher lows (28.9 → 30.6). Classic textbook **bullish divergence**
setup. Zero signals fired — because the classic rule engine only
counts components as bullish/bearish/neutral around 55/45 midpoints
and doesn't recognize pattern-of-oscillator-vs-price extremes.

Three new ships added by this observation. Kirk's eye sees these
patterns; the tool should catch them too.

### Ship 7 — RSI-extremes triggers (oversold/overbought exits)

Currently RSI is bullish above 55, bearish below 45. The 30/70 lines
of classic RSI trading get no special treatment.

Add three lightweight triggers to the reasons array and to a new
`extremes` field on the signal state:

- **RSI < 30** → "deeply oversold; watch for reversal" reason, and
  `extremes.rsiOversold = true`.
- **RSI < 30 for last N bars, now crossing back above 30** →
  "RSI exiting oversold" reason, and `extremes.rsiOversoldExit = true`.
- Mirror for the > 70 overbought side.

New signal-badge modifier: when `extremes.rsiOversoldExit` and
`components.thrust !== 'bearish'`, promote from HOLD/SELL to
"WATCH — oversold reversal beginning" state. Same for overbought.

Files: `analyzeData` in `temperature-gauge.html` around lines
1817–1825 (reasons) and the signal-branch block above it.

### Ship 8 — MACD-H turnaround (histogram bottoming/topping)

Currently `histMom` is a binary: histogram rising or falling. Doesn't
distinguish "MACD-H rising strongly from deep negative" (a classic
turnaround) from "MACD-H drifting slightly up around zero."

Add a "MACD-H turnaround" trigger:

- If last 5 histogram values are strictly monotonic AND the earlier
  values were deeply negative (< −0.5 · ATR-normalized), flag
  `extremes.macdBottoming = true` and push reason
  "MACD histogram turning up from deep negative — momentum bottoming."
- Mirror for topping.

Combined with Ship 7's RSI triggers, this is the "reversal watch"
architecture Kirk's eye already uses.

### Ship 9 — Divergence detector (Ship 6 promoted from ribbon-only to signal)  ✓ SHIPPED v5.79.7

Standard textbook divergence:
- Find swing pivots with K=2 lookback each side (bar's low <= all
  neighbors within 2 bars → pivot low; mirror for pivot high).
- For each consecutive pair of same-type pivots within `lookback` bars
  of each other, compare against RSI at those bars:
  - `close[curr] < close[prev]` AND `rsi[curr] > rsi[prev]` → bullish
    divergence, marked at the confirming pivot.
  - `close[curr] > close[prev]` AND `rsi[curr] < rsi[prev]` → bearish.
- Bars where a divergence pivot was confirmed within the last 10 bars
  become `latestBullDiv` / `latestBearDiv` summaries with an `agoBar`
  field so the sidebar can show "5 bars ago" instead of waiting for the
  next pivot to form.

New `Divergence` row in the classic Signal card:
- `—` when nothing recent
- `◆ Bullish (5 bars ago)` in emerald
- `◆ Bearish (5 bars ago)` in gold (matches the amber alert luminos)
- Rare both-directions case shows the more recent + "other"

Ribbon diamonds finally have a source:
- Fable's original ribbon spec had a `divergence` field; v5.79.0 planted
  the field with `null` values; v5.79.7 feeds it from the same detector.
  Bullish diamonds render emerald, bearish gold.

Reasons array gains the same information as text:
- "Bullish divergence: price lower low, RSI higher low N bars ago —
  watch for reversal"

Kirk's TSLA snapshot (bars 116/118/121) is exactly the case this catches:
price sets lower low at bar 121, RSI at 30.6 vs 28.9 at bar 118 →
bullish divergence flagged at pivot 121 → row shows
"◆ Bullish (X bars ago)" → ribbon shows an emerald diamond in the
last frame.

Not in this ship (kept for Ships 7 & 8):
- RSI-30/70 extremes as first-class signals (Ship 7).
- MACD histogram deep-negative turnaround (Ship 8).
- MACD-line divergence (uses RSI only for now; can layer MACD-based
  divergence later — same function, different oscillator).

### Ship 10 — Custom Rule Builder

Kirk on 2026-07-13: *"I can't adjust the buy/sell signals to match
specific indicator crosses or patterns I see."*

Add a user-defined rule DSL (small, safe, expression-only, no eval):

```
rule "RSI cross from oversold" {
  when: rsi < 30 in last 3 bars, rsi > 30 now
  action: WATCH BUY
}

rule "Golden cross" {
  when: ema12 crosses above ema24
  action: BUY
}
```

Ship shape: a Settings drawer with a text area (or button-driven builder),
localStorage-persisted rules, evaluated in analyzeData after the built-in
rules. Rule matches show up in a new "Custom" section of the reasons
array with the rule name.

Load-bearing: this is what turns Kirk's three decades of pattern
recognition into codified signals the tool can fire without him
watching. It's the biggest surface area of the six-ship arc originally
planned — but it's the ship that unlocks Kirk's own edge, so it's
probably worth ordering after Ships 7–9 land the low-hanging pattern
signals.

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
