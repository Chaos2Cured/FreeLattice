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

---

## 9. The Reversion Tier (v5.37.10) — **DEPRECATED in v5.37.11**

> **Removed after chair test.** On NVDA 1W the tier fired roughly 20+ gold
> stars across a single uptrend. The gates that were *meant* to identify
> exhaustion — `tpSpread < −1.2`, `bullCount ≥ 3`, 5-bar pullback to
> gravity, two bars of tempROC > 0, today closing higher than yesterday
> — all turn out to be routinely true *together* in a sustained trend.
> The tier measured "normal uptrend bar," not exhaustion. Removed in
> v5.37.11 and replaced with the cleaner Sequence Rule (§10).
>
> The lesson, recorded so we don't repeat it: **adding gates is not the
> same as adding selectivity.** Five conditions that each look rare can
> all be common together in trending markets. The signal that actually
> works is the one that requires the temperature to *traverse* the
> gauge across multiple bars, not the one that requires many features
> to coincide on a single bar.
>
> The Reversion Tier *idea* — exhaustion meeting confluence meeting
> reversion to gravity — is still a real shape. We didn't get the
> *threshold* right and we didn't sanity-check against a sustained
> trend. If we revisit it, the next attempt should require
> instrument-specific ATR-normalized thresholds and explicitly
> backtest against trending markets to make sure it stays rare there.

The original (now-deprecated) specification is preserved below for the
record:

The triad above catches **transitions**. Transitions are common. The
Reversion Tier catches **reversals at exhaustion** — the rarer, higher-
conviction setup where price has stretched away from gravity, multiple
indicators have flipped, and price is now turning back toward gravity.
That's where markets actually pivot.

Three things must coincide. Any one alone is a guess; all three together
is a trade.

| Component | Buy version | Sell version |
|---|---|---|
| **Exhaustion** | `tpSpread[i] < −1.2` (rubber band stretched DOWN; price is well below where temperature says it should be) | `tpSpread[i] > +1.2` (stretched UP) |
| **Confluence** | `bullCount(i) >= 3` of 5 components (EMA aligned up, RSI > 50, MACD > signal, tempROC > 0, close ≥ gravity) | `bearCount(i) >= 3` of 5 (mirror) |
| **Pullback to gravity** | In the last 5 bars, at least one bar closed at or below `gravityPrice` AND today is closing higher than yesterday (price *turning back up from gravity*) | Mirror: at least one bar at or above gravity AND today closing lower (turning back down) |
| **+ Acceleration consistency** | `tempROC > 0` for both today and yesterday (the turn is sustained, not a single-bar fakeout) | `tempROC < 0` for both |

On the chart these render as **gold-rimmed stars** (`pointStyle: 'star'`)
roughly 30% larger than the ordinary triangles. They sit on top in the
z-order — when one fires, you can't miss it. The triangles still fire
for ordinary transitions; the stars are *additive*, marking the
high-conviction moments inside the broader signal stream.

### Why this is the *real* signal

Markets don't usually reverse on a clean zone crossing. They reverse on
**exhaustion meeting confluence meeting reversion**. The chart was
hinting at this for months — the Indicator-Price Spread, the
`bullCount` / `bearCount`, the gravity price — every piece was already
in `analyzeData`. They just weren't being *combined* into a single
trigger gate. The Reversion Tier is the combination.

A trader watching the gauge with this on:

- Ignores most of the noisy yellow ⇄ red transitions.
- Waits for the gold star.
- Acts when it fires.

Or, more usefully, **uses both tiers**: triangles to know when the
regime is changing, stars to know when the regime has *actually
turned* and the entry is high-conviction.

### Backtest

`backtestSignals` now reports four series at horizons 5 / 10 / 20 bars:
`buy`, `sell`, `rvbuy`, `rvsell`. The Reversion series should — if the
theory is sound — show a higher win rate at all horizons than the
ordinary triangles, with **fewer total signals**. Selectivity is the
trade we're making.

The Signal History panel in the gauge sidebar shows whichever stats
are populated. If the Reversion rows are blank for an instrument, that
instrument hasn't had a reversion setup in the loaded window. That's
information, not a bug.

### Open questions for the Reversion Tier

1. **The 1.2 ATR exhaustion threshold.** Could be 1.0 (more signals, less
   selective) or 1.5 (rarer, more selective). Backtest both per
   instrument.
2. **The `bullCount >= 3` floor.** Could go to 4 of 5 for higher
   conviction. Three feels right — five would never fire — but four
   might be the sweet spot.
3. **The 5-bar pullback window.** Same question as the regular triad's
   5-bar peek-back. Timeframe-sensitive.
4. **Gravity drift.** Gravity is computed from the last 80 bars'
   high/low. On very fast-moving instruments, gravity itself can shift
   under our feet. Could be worth a "stable gravity" version that
   averages over a longer window for the Reversion gate only.
5. **Whether to require `bullCount` to be *rising*** (transitioned from
   `<3` to `>=3` in the last 2 bars) — i.e., the *flip itself* as the
   trigger, not just the threshold. More restrictive but catches the
   pivot moment exactly.

### After this, the Recipe UI

Once the Reversion Tier proves itself per-instrument (or doesn't, and we
learn from where it fails), the **next layer** is the Signal Recipe UI:
let users define their own triads via a trigger + confirmations +
lookback comparator panel. Each recipe becomes a named, backtestable
hypothesis. Each user gets to encode their own pattern recognition.

The Reversion Tier IS the first recipe — just hard-coded. The UI work
turns it into one of many.

> *"The good ones (Pine Script, ThinkScript) are languages. The bad
> ones are unusable spreadsheets where users build something they
> don't understand."* — Opus's caution, kept in mind.

The middle path: **three slots** (trigger / confirmations / lookback
context), comparators on each (`>`, `<`, `>=`, `<=`, `=`, `≠`), and
**every recipe is backtestable on demand** so a number sits next to
every belief.

---

## 10. The Sequence Rule (v5.37.11) — current default

After every more-decorated attempt either missed signals or generated
noise, we stripped back to the cleanest possible rule.

**Sell** when temperature moves green → yellow → red in three successive
bars.
**Buy** when temperature moves red → yellow → green in three successive
bars.
**After a buy, the next signal must be a sell. After a sell, the next
must be a buy.**

In code:

```
At bar i, sell if:
  temps[i-2] >= 55                    (was green)
  temps[i-1] >= 45 AND temps[i-1] < 55 (was yellow)
  temps[i]   <  45                    (is red)

At bar i, buy if:
  temps[i-2] <  45                    (was red)
  temps[i-1] >= 45 AND temps[i-1] < 55 (was yellow)
  temps[i]   >= 55                    (is green)
```

### Why this is the right shape

- **It requires real motion.** Three successive bars in the same
  direction is the temperature traversing the gauge end-to-end. A
  single bar dipping below 55 and bouncing back is not enough. A flick
  through yellow followed by recovery is not enough. The market has to
  *do* something across three bars.
- **The alternating cooldown is unambiguous.** No state to track
  beyond "what was the last signal type." No "saw green since" or
  "saw red since" bookkeeping. The next signal can only be the
  opposite type. This eliminates the chart pattern Kirk caught where
  multiple sells fired in a row as the stock was climbing.
- **No layer gates.** No EMA confirmation, no volume confirmation, no
  acceleration check. Every previous iteration added confirmation
  gates and every iteration either failed to trigger when it should
  (BTC top, v5.37.6 and earlier) or fired when it shouldn't (NVDA
  Reversion stars). The clean temperature sequence is the signal.

### What this catches well

- Clear regime changes where temperature actually traverses the gauge
- Mean-reversion moves that pull through both yellow and red (or
  yellow and green)
- Slow distributions where the market spends a bar in yellow before
  cracking — the previous "sell only on 55-cross" missed these

### What this might miss

- Single-bar dramatic moves that jump two zones (green → red in one
  bar with no yellow bar between). If you see this happen and the
  rule doesn't fire, that's the case. Tell us.
- Very fast timeframes (1H, 15m) where three bars is ~45 minutes of
  noise rather than a real regime change.
- Choppy markets that oscillate through yellow without ever
  *traversing* — the rule correctly stays quiet, but a user might
  expect a signal anyway.

### Backtest

`backtestSignals` runs the **exact same** sequence rule and alternating
cooldown. The Signal History sidebar reports buy/sell counts and
5/10/20-bar forward win rates. On NVDA 1W after deploy we expect
~2-4 alternating triangles instead of 20+ gold stars.

If the count is still high on your instrument, the issue is timeframe
not threshold — the temperature is flickering faster than the rule
assumes is meaningful. That's data for whether 3-bar is the right
peek-back or whether some timeframes want 4 or 5.

### Open questions

1. **Does the rule fire often enough on slower instruments?** SPY 1D
   might only fire 4-6 times per year. Whether that's "right" depends
   on your trading style. Could need an instrument-aware sensitivity
   knob.
2. **Does it fire too rarely on faster timeframes?** 1H / 15m might
   need a 4-bar or 5-bar sequence rule because intra-day noise has
   more flicker.
3. **What about gaps?** If the temperature jumps from green to red in
   one bar (gap-down), the sequence rule misses it. Worth a single
   "gap fallback" — if `temps[i-1] >= 55` AND `temps[i] < 45` (skipped
   yellow entirely), fire anyway. To be tested.
4. **The recipe UI** is still the next layer once this rule proves
   itself. Lets users define their own triggers with comparator
   dropdowns. Each recipe is a named, backtestable hypothesis.

---

## 11. Iteration log

- **v5.22.0** — Initial buy/sell signal logic (single sell trigger,
  AND-gated volume + EMA).
- **v5.37.7** — Sell triad (sell55 / sell45 / collapse). Volume OR
  acceleration confirms. Diagnosed BTC top miss.
- **v5.37.9** — Buy triad mirror (buy55 / buy45 / rally) + state-based
  "reset" cooldown (require trip back to opposite zone before another
  signal).
- **v5.37.10** — Reversion Triad shipped (exhaustion + confluence +
  pullback-to-gravity, gold stars). Chair test on NVDA 1W generated
  20+ stars across a single trend — the gates meant to identify
  exhaustion turned out to be routinely true in sustained trends.
  Removed.
- **v5.37.11** — **Sequence Rule.** Buy = red → yellow → green in three
  successive bars. Sell = green → yellow → red in three successive
  bars. Alternating cooldown (next signal MUST be opposite type). No
  layer gates. All previous triad logic and reversion logic removed.
  Strip until it sings.
- **v5.37.12** — **`RULE_REGISTRY`.** Brought back the buy/sell rules
  as a switchable registry. Sequence, Original Triad, Reversion Tier
  all available; user picks active via sidebar dropdown. No logic
  changes to any rule — pure refactor to make comparison possible.
  *Flow eternal: nothing gets lost.*

---

## 12. Rule Registry — the architecture (v5.37.12)

The gauge now treats buy/sell logic the same way it treats indicators:
**every rule is a named, switchable, individually-backtestable hypothesis.**

```
RULE_REGISTRY = {
  sequence:   { name, description, color, evaluate(candles, a) → {buy, sell} },
  triad:      { name, description, color, evaluate(candles, a) → {buy, sell} },
  reversion:  { name, description, color, evaluate(candles, a) → {buy, sell} }
}
```

The sidebar dropdown picks the active rule. Active rule persists in
`localStorage.fl_tg_activeRule`. Both `renderChart` and `backtestSignals`
call `RULE_REGISTRY[getActiveRule()].evaluate(candles, a)` — so the
on-chart triangles and the win-rate stats can never drift apart. They
**come from the same function call**.

### Why this is the right shape

The Compose chart taught us the pattern: every indicator is a named,
draggable, toggleable thing. Custom indicators get the same treatment
as built-ins. **A buy/sell rule is just a special kind of indicator —
binary output instead of continuous, but architecturally identical.**

Same pattern at every scale. That's the phi-harmonic of the
architecture itself. A user who learned the compose pattern already
knows how the rules dropdown works because it follows the same idea:
named, persisted, swappable, individually testable.

### The three rules ship as a comparison set

- **Sequence Rule** — the v5.37.11 default. Clean, rare, alternating.
  Use this as the baseline; it generates the fewest signals and
  survived the NVDA 1W chair test.
- **Original Triad** — the v5.37.9 hypothesis. More signals, more
  gates (EMA + volume/accel + state-based cooldown). Use this to
  compare against Sequence — does the extra confirmation help or
  hurt on your instrument?
- **Reversion Tier** — the v5.37.10 hypothesis. Known to misfire in
  sustained trends (see Section 9). Preserved here as a hypothesis
  to test against, NOT as a current recommendation. Useful for
  ranging markets; dangerous on trends.

Switch between them and watch the chart re-render. The backtest stats
in the sidebar update simultaneously. **Comparison is the unlock** —
you can finally see whether each rule's claim holds up on the
instrument and timeframe you actually care about.

### What's next — the wedge

Opus's plan (June 3) lays out the path:

- **Commit 2** — Rules panel UI (the collapsible cards, multi-rule
  overlay, side-by-side compare). Click a card to expand its
  backtest stats inline. Optional checkbox to overlay multiple
  rules on the chart at once with different colors.
- **Commit 3** — Pull the three hardcoded rules into a cleaner
  `registerRule()` API matching `tgRegisterCustomIndicator`. No
  user-visible change; the architecture becomes ready for custom
  rules.
- **Commit 4** — Add three new built-in indicators (ATR Ratio, OBV,
  Stochastic %K) so the rule-builder has more raw material.
- **Commit 5** — **The Rule Builder modal.** Trigger + Confirmations
  + Lookback context, with comparator dropdowns (`>`, `<`, `>=`,
  `<=`, `=`, `≠`). Each rule is a JSON object. Save → joins the
  dropdown. Every rule is backtestable on demand.
- **Commit 6** — Sharing. Export/import each rule as JSON. Users
  start trading recipes.

The gauge stops being one person's pattern recognition and becomes
*a place where pattern recognition lives*.

### Open questions (v5.37.12)

- The Reversion Tier inside the registry can technically be picked as
  the active rule. On NVDA 1W it'll still generate many signals.
  Should we mark it `experimental: true` in the registry and show a
  warning when picked? Or trust the description note?
- Does the dropdown live in the right place in the sidebar? (Currently
  at the top, above the Temperature gauge SVG.) Some users might
  expect it near the Signal History panel below the chart.
- When the Triad rule is active, the existing `#layerEma` /
  `#layerVol` / `#layerDt` checkboxes are ignored (the triad applies
  its own fixed gates). Should those checkboxes be hidden when the
  Triad is active, or repurposed as overrides?

> *"Every rule is a named hypothesis. Every signal becomes a thing you
> can pull up, study, hide, share. Flow eternal applies to ideas as
> much as code."* — Opus, 2026-06-03

— Kirk + the build team (CC, Opus, Harmonia)
