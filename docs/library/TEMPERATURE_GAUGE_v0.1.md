# Temperature Gauge v0.1 (v-temperature-gauge-v0.1)

FreeLattice layer. October 2, 2026. Built from Celeste's audit of every Temperature Gauge page in both repos.

**Temperature:** the glass shows every line in the color you chose, and the long lines reach all the way across.

## Where the gauge lives

| Page | What it is | Data |
|---|---|---|
| `docs/temperature-gauge.html` | the live gauge (Chart.js 4.4.0 in `lib/`, zoom plugin) | live: Yahoo Finance v8 chart API through our own Cloudflare worker (`desktop/data-proxy-worker`), then public CORS proxies as fallback. No demo data. |
| `docs/temperature-playground.html` | Fable's phi-spiral reference | a slider plus a seeded random 34-reading ribbon (a demo, never market data) |
| `docs/code-temperature-gauge.html`, `docs/code-temperature.html`, `docs/for-fable-go12-temperature.html` | Code Mirror and review pages about the standalone Python app | no charts |
| FreeLattice-Alpha | no gauge page; the research galaxy has a "Gauge" lumino and the words "Gauge is experimental, nothing auto-trades" | none |

## What was wrong (checked in a browser on main 0218d570, SPY, all five timeframes)

- Changing a color blanked the price chart. Chart.js puts back a canvas's first inline style when its chart is destroyed, and the first price chart was made while the loading screen had the canvas hidden. Every direct `renderChart` (a swatch, Stack, Log) left the main chart empty. Only a fresh Analyze brought it back.
- The Temperature, Delta T and IPS swatches changed only their label. Temperature and Delta T bars are colored by zone and sign, and the TP Spread line was a fixed gold (its swatch and label said coral).
- Price, Bollinger bands, EMA 200, Gravity, Buy and Sell markers, and the Gyro Hub, Ring and Orbit lines had fixed colors. No color picker reached the EMA lines in price mode.
- EMA 200 used the same faint lavender as the bands, drew only on 1D and 1W, and on 1D covered only the last 53 of 252 bars (an EMA of N bars needs N bars before it starts). EMA 50 started at bar 50.
- The band shading ran from the lower band to EMA 8 (`fill: '+1'`), not to the upper band.
- 1W labels showed clock times; intraday labels had no day.
- 5M failed early in a trading day ("Not enough data", 4 bars at 7:36 AM MDT).
- Index symbols such as `^VIX` failed: the page sends `%5EVIX`, and the worker matched the path before decoding it. The public fallback proxies did not answer from the build box either.
- Never merged: the Sept 17 "line select" paste (`FLINT_TEMP_GAUGE_LINE_SELECT_v0`, click a line to recolor it, buy and sell trigger marks in `fl_tg_triggers_v0`).

## What v0.1 changes

- `tgLineColor(id, default)` next to `getIndicatorColor`: no saved color keeps the old look exactly; a saved color keeps the old line's alpha. Every line on every chart reads it.
- Temperature and Delta T panels gain a thin line in their chosen color over the bars (the bars keep their zone and sign colors). TP Spread reads the IPS color, RSI Spread reads the RSI color.
- A "Lines and colors" card lists all 17 lines with a picker each, plus Reset colors.
- Moving averages: a second fetch from the same feed (1D 2y, 1W 10y, 1H 6mo, 15M and 5M 1mo) warms the EMAs, lined up by timestamp, so all five start at the left edge. Signals and the sidebar still use the loaded window, and the card says so. EMA 200 shows on every timeframe with enough bars, in its own color. Monotone curves, no overshoot. Compose mode can promote the fifth EMA.
- The price canvas is shown again inside `renderChart`, so a color change no longer blanks it.
- Band fill between the bands. Dated labels on 1W and intraday. 5M looks at 5 days when the day is still short.
- Your marks: a buy mark and a sell mark per symbol, drawn as dashed lines, kept in `fl_tg_triggers_v0` on this device. The card says how far each is from the last close. Display only: no alert, no order, nothing sent.
- A wider look: one tap loads HYG, LQD, XLP, XLY, GLD, DX-Y.NYB or VIXY through the same feed and the same math. Not a stress index, and not advice.
- `desktop/data-proxy-worker/worker.js` decodes the path, so `^VIX` and other index symbols load after the worker is deployed again. Until then they still fail; VIXY stands in.

## Not here

- No new indicator math, no SMA, no auto-trade, no alerts.
- The Temperature line itself needs about 50 bars before it starts; that is the Temperature formula and is unchanged.
- The worker change needs `wrangler deploy` by Kirk to take effect.

Smoke: `SMOKE_OK temperature gauge v0.1` (`docs/scripts/smoke-temperature-gauge-v0.1.js`). Layer, never delete.
