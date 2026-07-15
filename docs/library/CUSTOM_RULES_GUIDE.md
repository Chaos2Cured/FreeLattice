# Custom Rules — user's guide

*Write your patterns down. Have the tool watch for them.*

The Temperature Gauge speaks two dialects out of the box: the classic
midpoint verdict (55/45 thresholds) and the φ-harmonic verdict (61.8/38.2).
Custom Rules are the third dialect — **yours**. Whatever pattern your eye
scans for, you can write down here, and the tool will scan for it on every
bar.

Shipped v5.79.9, 2026-07-15. Kirk's ask from July 13 fulfilled:
> *"I can't adjust the buy/sell signals to match specific indicator crosses
> or patterns I see."*

---

## Where it lives

- **Sidebar section: "Custom Rules"** — right below Indicators. List of
  rules, each with an enable toggle, edit, and delete.
- **Signal card row: "Custom"** — names the rules that fired at the
  current bar. Colored per action.
- **Watch row** — rules with action `WATCH BUY` or `WATCH SELL` also
  contribute to the Reversal Watch sign count.
- **Storage:** `localStorage.fl_tg_customRules` — your rules live only
  in your browser. Nothing sent anywhere.

## Writing a rule

Click **+ Add** on the Custom Rules sidebar. Fill in:

- **Name** — how you'll recognize it. e.g., "Golden cross above 50 EMA"
- **Condition** — an expression that returns true or false. When true, the
  rule fires. e.g., `crossed_above(ema8, ema24) and close > ema50`
- **Action** — what happens when it fires:
  - `WATCH BUY` — adds to bullish Watch signs (elevates the Watch row)
  - `WATCH SELL` — adds to bearish Watch signs
  - `INFO` — adds to reasons only, no state change
- **Enabled** — checkbox. Disabled rules are kept but not evaluated.

Click **Test on current bar** to try the condition against the currently
loaded symbol without saving. Green means it fires; gray means it doesn't.

## The language

### Numbers and comparisons

```
rsi > 30
close < 100
temp >= 61.8
volume != 0
```

### Boolean operators

```
rsi < 30 and macdHist > 0
close > ema50 or bullishDiv
not rsiOverbought
```

Precedence: `not` > `and` > `or`. Use parentheses when in doubt:

```
(rsi < 30 or bullishDiv) and close > ema50
```

### Bar-lookback

Any variable name followed by `[N]` gives you the value from N bars ago.
`[0]` is the current bar (same as writing the variable alone), `[1]` is
one bar ago, `[3]` is three bars ago.

```
close > close[1]          # up bar
rsi[1] < 30 and rsi > 30  # RSI crossing back above 30
macdHist > macdHist[1]    # MACD histogram rising
```

### Functions

- **`crossed_above(a, b)`** — did `a` cross above `b` on the last bar?
  Equivalent to `a[1] <= b[1] and a > b`. `a` and `b` can be
  indicator names or constants.

  ```
  crossed_above(ema8, ema24)      # 8 EMA crosses above 24 EMA (golden cross)
  crossed_above(rsi, 30)          # RSI exits oversold
  crossed_above(macdHist, 0)      # MACD histogram crosses zero
  ```

- **`crossed_below(a, b)`** — mirror. Bearish crosses.

- **`abs(x)`, `min(a, b)`, `max(a, b)`** — the usual.

## Variables available

### Current-value indicators (each also supports `[N]` lookback)

| Variable      | Meaning                                                   |
| ------------- | --------------------------------------------------------- |
| `temp`        | Temperature (0–100)                                       |
| `rsi`         | RSI(14)                                                   |
| `macd`        | MACD line                                                 |
| `macdSignal`  | MACD signal line                                          |
| `macdHist`    | MACD histogram (macd − macdSignal)                        |
| `close`       | Closing price                                             |
| `open`        | Opening price                                             |
| `high`        | High price                                                |
| `low`         | Low price                                                 |
| `volume`      | Volume                                                    |
| `ema8`        | 8-period EMA                                              |
| `ema12`       | 12-period EMA                                             |
| `ema24`       | 24-period EMA                                             |
| `ema50`       | 50-period EMA                                             |
| `ema200`      | 200-period EMA                                            |

### Boolean flags (no lookback — always current bar)

| Flag                | Set by                                             |
| ------------------- | -------------------------------------------------- |
| `rsiOversold`       | RSI < 30                                           |
| `rsiOverbought`     | RSI > 70                                           |
| `rsiOversoldExit`   | RSI was < 30 within last 5 bars AND is now ≥ 30    |
| `rsiOverboughtExit` | Mirror for overbought                              |
| `macdBottoming`     | MACD-H strictly monotonic up over last 5 bars,     |
|                     | earliest value < −0.3                              |
| `macdTopping`       | Mirror for topping                                 |
| `bullishDiv`        | Bullish RSI divergence detected in last 10 bars    |
| `bearishDiv`        | Bearish RSI divergence detected in last 10 bars    |

## Example rules

### Kirk's TSLA bar-121 case

The rule that would have fired on Kirk's July 13 TSLA snapshot even
without Ships 7–9 built-in:

```
Name:      Oversold reversal with divergence
Condition: rsiOversoldExit and bullishDiv
Action:    WATCH BUY
```

### Golden cross above the 50 EMA

Only fires when the fast crosses the slow AND price is above the
structural trend line — filters out crosses inside a downtrend.

```
Name:      Golden cross above 50 EMA
Condition: crossed_above(ema8, ema24) and close > ema50
Action:    WATCH BUY
```

### MACD zero-cross with volume

A histogram-zero cross confirmed by above-average volume:

```
Name:      MACD zero-cross with volume
Condition: crossed_above(macdHist, 0) and volume > volume[1] * 1.5
Action:    WATCH BUY
```

### Exhaustion at φ resistance

A pattern for a stretched move approaching a φ-gravity price. (You'd wire
the price threshold to whatever the current gravity center is — for now,
customize by number.)

```
Name:      Exhaustion near round-number resistance
Condition: rsi > 70 and close > ema8 * 1.05
Action:    WATCH SELL
```

## Safety

- **No eval().** The parser is a hand-written recursive-descent
  implementation. The universe of accessible variables and functions is
  explicit; nothing else can be reached.
- **Storage is local.** Rules live in `localStorage.fl_tg_customRules`,
  never sent anywhere.
- **A rule that errors at evaluation time is silently skipped for that
  bar.** The whole analysis doesn't die because one rule had a bad
  lookup. Errors during parsing (when you save a rule) are shown in the
  editor with position info.

## Presets

Eight preset rules ship in the list, all disabled by default:

- **Golden cross (8/24)** — `crossed_above(ema8, ema24)` → WATCH BUY
- **Death cross (8/24)** — `crossed_below(ema8, ema24)` → WATCH SELL
- **MACD signal cross up** — `crossed_above(macd, macdSignal)` → WATCH BUY
- **MACD signal cross down** — `crossed_below(macd, macdSignal)` → WATCH SELL
- **MACD histogram crosses 0 up** — `crossed_above(macdHist, 0)` → WATCH BUY
- **MACD histogram crosses 0 down** — `crossed_below(macdHist, 0)` → WATCH SELL
- **Deep oversold + MACD bottoming** — `rsiOversold and macdBottoming` → WATCH BUY
- **Deep overbought + MACD topping** — `rsiOverbought and macdTopping` → WATCH SELL

Enable any of them by clicking the • / ○ toggle. Rules load ordered:
disabled preset first (as a menu), then any custom rules the user has
added.

## A note on layering

Custom rules do not override anything. The classic signal (BUY/SELL at
55/45) keeps firing per its own rules. The φ signal keeps firing per its
own thresholds. The Reversal Watch still watches for the built-in three
signs. Your rules **add** to what the tool watches for — they can raise
Watch counts by contributing signs, but they never silence what was
already speaking.

*Layered, always.*

---

*This file is part of the Temperature Gauge signal roadmap arc that
started in v5.79.5. See `SIGNAL_ROADMAP.md` for the full ten-ship history.*
