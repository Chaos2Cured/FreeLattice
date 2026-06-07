# Temperature Gauge — Coordination File

> Reference point: v5.38.1 · 2026-06-07
> Everything below this line is confirmed working. Don't rebuild what's here.

## What Works (don't touch)

- Custom indicator builder (equation input, safe evaluator, up to 3 custom panels)
- Backtest engine (sidebar section, 5/10/20 bar horizons, win rate + expectancy)
- ΔT divergence detection (bearish/bullish, in reasons + indicator)
- ΔT sub-chart (acceleration oscillator, green/red bars)
- Temperature sub-chart (color-coded bars: green >55, red <45, gold neutral)
- RSI sub-chart (purple line, 70/30 threshold lines)
- Bollinger Bands on main chart (lavender envelope)
- EMA 8/12/24/50/200 on main chart (Garden-warm colors)
- Volume bars overlaid on main chart (second y-axis, green/red)
- Temperature zone overlay on main chart (colored fill behind price)
- Gravity center line + phi-level dashed lines
- Crosshair sync (hover sub-chart → tooltip on main chart)
- Phi-spiral loading animation
- Pinch-zoom + pan (Hammer.js + chartjs-plugin-zoom)
- Stack RSI + Temperature checkbox
- Signal Layers panel (toggleable: EMA, Volume, Acceleration)
- Compact tooltip (Price, Gravity, Volume, signals only)
- Density-scaled signal sizing (few=bold, many=subtle)
- Pulsing glow plugin (throttled to 200ms/5fps)
- Educational disclaimer banner (dismissible)
- Cloudflare Worker data proxy (WORKER_URL)
- Social meta tags (Harmonia's work)
- SW network-first caching
- Theme toggle (Gold/Emerald/Lavender/Coral)
- Log scale toggle
- Ambient particles behind chart (gold + emerald, breathing)
- Collapse/expand sub-charts (▾/▸ toggles)
- Chart.getChart() cleanup prevents "Canvas already in use"
- Debug mode (?debug in URL)

## Kirk's Signal Theory (May 26, 2026)

- BUY when temperature transitions from red (<45) upward through yellow into green (>55)
- SELL when temperature transitions from green (>55) downward into yellow (<55)
- No sells in the red zone (already cold — nothing to sell)
- No buys in the green zone (already hot — buy already happened)
- Temperature transition is the PRIMARY signal (Layer 1, always required)
- EMA alignment is Layer 2 (toggleable)
- Volume above average is Layer 3 (toggleable)
- ΔT acceleration is Layer 4 (toggleable, strictest)
- ALL enabled layers must agree — AND logic, not OR

## Key Code Facts

- File: `docs/temperature-gauge.html` (self-contained, no dependencies on app.html)
- Chart.js 4.4.0 from CDN + Hammer.js + chartjs-plugin-zoom
- `a` is the analysis object (second param to renderChart/renderAll)
- Custom indicators stored in localStorage key `fl_tg_customs`
- Safe evaluator — NO eval(), whitelist only
- Variables: open, high, low, close, volume, bar, ema8-200, rsi14, atr14, temp, dt, pi, phi
- `renderChart` is wrapped by crosshair sync IIFE — call the wrapper, not the original
- `Chart.getChart(canvas).destroy()` at top of renderChart prevents canvas reuse errors
- Signal glow plugin uses `setInterval(200ms)` not `requestAnimationFrame`

## Kirk's Overlay Insight (May 26, 2026)

"When the overlayed temperature goes down through the stock chart, that cross looks like a sell. Same when it crosses higher. The distance both lines are from the stock = exhaustion. They act like moving gravity lines, all going back to the actual gravity line."

**Translation:** The overlay system revealed a new signal type — the DISTANCE between confluence indicators (temperature + RSI) and price is itself an indicator. Formalized as the Indicator-Price Spread:
- `tempAsPrice = priceLow + (temperature / 100) * priceRange`
- `spread = (tempAsPrice - close) / ATR`
- Zero-crossing = the signal. Magnitude = exhaustion measure.
- Gold line (TP Spread) + Purple line (RSI Spread) on same panel.

## What Works (added v5.19.0-v5.25.1)

- Right-click overlay system (overlay any sub-chart onto main chart)
- Long-press overlay for mobile (500ms)
- Ambient particles behind chart (gold + emerald, breathing)
- Garden-warm EMA colors (coral, gold, soft blue, lavender)
- Collapse/expand sub-charts (▾/▸ toggles)
- Zoom sync across all sub-charts (syncSubChartZoom)
- Reset zoom button (⟲)
- Pan enabled (mode: 'x', threshold: 5)
- Indicator-Price Spread sub-chart (TP + RSI spreads, zero line)
- Temperature zone overlay on main chart (colored bars behind price)
- 4-layer toggleable signals (Temperature + EMA + Volume + Acceleration)
- Signal Layers control panel
- Position sizing inputs (Account $ + Risk %)
- Colored sub-chart labels (RSI=purple, Temp=gold, ΔT=emerald)
- Gradient sub-chart backgrounds
- Seven Wonders PDF in the Lighthouse

## What Works (added v5.30.0 – v5.31.0+ — the polish pass)

- Full-width stacked sub-charts as the default (x-axes line up with the main chart above)
- ☰ Layout toggle in the header (stacked ↔ compact grid; persists in `fl_tg_layout`)
- Per-panel toolbar on every sub-chart: ▾ collapse / □ maximize / ✕ hide
- Maximize sends one panel to 220px and collapses the rest to 20px label-only; toggles back
- Hidden-panel restore: "N hidden panels — click to restore" line appears whenever any panel is hidden
- Per-indicator color pickers in each sub-chart label (RSI, Temperature, ΔT, IPS, and EMA 8/12/24/50) — persists in `fl_tg_indicatorColors`; chart lines and label color update live
- 📊 Tool-only mode: hide the main price chart, expand sub-charts to 180px so RSI + Temperature can be studied side-by-side at full size
- "✕ Clear all overlays" button (auto-appears whenever any overlay is active; auto-hides when none remain)
- Pan ← / → buttons in the header (20% step, clamped to data range) + grab cursor on the main canvas (mouse-drag pan was already wired by chartjs-plugin-zoom; just needed the visual cue)
- Right-anchored wheel zoom (newest candle stays pinned at x.max; the window contracts from the left — trader-style)
- Gauge is served network-first by the SW so polish ships to users on next page load without a CACHE_NAME bump

## What Works (added v5.37.0 – v5.37.7 — composable + sell triad + EMA config)

- **Three-mode chart**: Price · Tool-only · Compose. Cycle via the 📊 toolbar button. Mode + promoted indicators + per-indicator brightness/glow persist in `fl_tg_chart_mode` / `fl_tg_composeState` / `fl_tg_indicatorStyles`.
- **Compose mode**: any combination of indicators can be promoted to the main canvas. Each gets its own y-axis (alternating left/right); only the first shows grid (visual clutter reduction). Tooltip pinned top-left in BOTH price and compose mode via `Chart.Tooltip.positioners.tgTopLeft` registered at script init.
- **10 promotable indicators**: RSI, Temperature, ΔT, IPS, Volume (bar), Bollinger Bands (3-line via `getMultiple`), Price, EMA 8/12/24/50. Custom indicators self-register via `tgRegisterCustomIndicator()` so user-built ones are promotable too.
- **"+ Add" picker** with live SVG sparkline previews per indicator (`tgSparkline(id, w, h)`). Whole empty-stage card is clickable; `touchend` wired explicitly for iOS Safari synthetic-click reliability.
- **Right-click / long-press menu** on every sub-chart AND every compose pill: 🎨 color · ✨ glow · 🔆 brightness slider · ⬆ promote / ⬇ demote · □ maximize · ⛶ fullscreen · ✕ hide. Right-click main canvas in compose mode opens a "Style which?" picker when multiple are promoted.
- **Maximize actually grows the chart** (CSS lets canvas escape `height: 90px !important` when `data-maximized="true"`; JS monkey-patches `maximizeSubPanel` to clear canvas width/height attrs and call `inst.resize()`). Tool-only mode uses 60vh, fullscreen uses 100vh + fixed positioning + **Escape-to-exit**.
- **Sell trigger triad (v5.37.7 — fixes the BTC top miss):** the old single trigger (sell55 only) missed yellow→red collapses. Now three flavors: `sell55` (green→yellow) + `sell45` (yellow→red) + `collapse` (5-bar peak ≥ 55 AND temps[si] < temps[si-3] − 8). Volume **OR** Acceleration confirms — panic doesn't always have above-average volume. The exact same triad is mirrored in `backtestSignals` so on-chart and historical win rates can't drift apart. Loop starts at `si=5` (collapse trigger peeks back 5 bars). *Per Opus: if a transition matters going up, the mirror transition matters going down.*
- **Configurable EMA periods**: `DEFAULT_EMA_PERIODS = [8, 12, 24, 50, 200]` with `getEmaPeriods()` as the single source of truth. Every `ema(closes, N)` across `computeTemperature`, `analyzeData`, `renderChart`, `backtestSignals` reads from it. UI in `#customPanel` (input + Set + Reset). Persists in `fl_tg_ema_periods`. Chart legend labels: `'EMA ' + EP[i]`. `INDICATOR_REGISTRY.ema8/12/24/50` labels are refreshed inside `updateComposeUI()` so pills + picker track changes. Variable names stay `ema8`/`ema12`/etc — labels at this point, not numbers.
- **Signal-driven luminos**: size + color follow the live signal. 22px base, 32px on "strong" (|temp-50| >= 15), 42px + saturation on "extreme" (>= 20). Green/red dominant on buy/sell, gold-and-lavender on neutral. Jitter + faster drift via `tg-instability` body class when price is > 1.5×ATR from any gravity line. Toggle button (✨) persists in `fl_tg_luminos`.
- **Color-picker stall fixed**: never trust the native picker's `change` event (fires repeatedly while picker is open). `_luminosWatchColorInput` listens to `mousedown`/`focus`/`blur` only; gates on `tg-color-picker-open` body class; `closeMenu` wrapper + 6s safety setInterval both check the class before unpausing. `filter:none` while picker is open (the blur is the expensive part on integrated GPUs).
- **Mobile layout**: chart on top (`.chart-area { order: 1 }`), sidebar below (`order: 2`). Two-finger scroll works (`.chart-area { overflow-y: auto }`, was `overflow: hidden`).
- **Inline favicon** kills the 404. **Escape** exits any stuck fullscreen panel.
- **📋 Snapshot button (v5.37.13)** — copies an ASCII-table view of the last N bars to the clipboard for paste into any AI chat. Header carries symbol / interval / active rule / EMA periods / gravity / ATR. Each row: bar, date, OHLC, temperature + zone letter (G/Y/R), RSI, MACD-histogram, ΔT, indicator-price spread, and any signal that fired. Footer summarizes current temperature trajectory, latest signal in window, gravity distance, any active divergence. Default 10 bars; **Shift+click** = 20, **Alt+click** = 5. Auto-wires to `.header-controls`. `window.tgSnapshot(barCount)` returns the text for any other caller (e.g., headless export, future rule-tuning UI).

## What Works (added v5.37.8 – v5.38.1 — snapshot, rules, energy ramp, multi-luminos)

- **Snapshot — right-click neighborhood mode (v5.37.14 → v5.37.18)**: right-click any bar on the main chart → "Snapshot (±5 bars around cursor)" copies an 11-bar window centered on the bar under the cursor. `centerIdx` resolved via `Chart.getElementsAtEventForMode(e, 'index', { intersect: false })`. The bug-fix arc: v5.37.16 used capture-phase + `stopImmediatePropagation` so the menu wins over the compose IIFE's `oncontextmenu`. v5.37.17 exposed `INDICATOR_REGISTRY` + `CANVAS_TO_ID` on `window` so the snapshot IIFE could see them (they were `var`-scoped inside the compose IIFE). v5.37.18 fixed `copySnapshot(barCount)` to actually forward `centerIdx` to `buildSnapshot` — argument was being dropped one function up. Smoke locks the whole chain.
- **RULE_REGISTRY (v5.37.12)**: three named buy/sell hypotheses — Sequence Rule (cleanest, only the 3-bar red→yellow→green traversal), Original Triad (sell55/sell45/collapse + confirmation), Reversion Tier (mean-reversion at gravity bands). Switchable via the sidebar's Signal Rule picker. Persists in `fl_tg_activeRule`. Each rule's `evaluate(candles, a, idx)` returns the same shape so on-chart and backtest can't drift. Top-level `var RULE_REGISTRY` (not inside an IIFE) so cross-script access is automatic.
- **Indicator-style picker — always available (v5.37.15)**: right-click the main chart in ANY mode → menu lists snapshot row + maximize row + the four core indicators (RSI · Temperature · ΔT · IPS) with colored dots. In compose mode, promoted indicators are listed first marked "on main." Click any → opens the color/glow/brightness picker. Previously compose-only.
- **Main-chart maximize (v5.38.0 / shipped in v5.37.20)**: right-click → "⛶ Maximize main chart" toggles `.tg-fullscreen-panel` on `#chartWrap` via `window.tgMaximizeMainChart()`. Escape rescues from fullscreen on both sub-charts and main chart. Same affordance the sub-charts already had.
- **Signal-driven luminos — energy ramp (v5.37.19 → simplified v5.37.20)**: continuous `--lum-energy` CSS variable, computed from `gravDist / 2.5` (capped at 1.0). Layer-level opacity reads `calc(0.4 + var(--lum-energy) * 0.6)` so the chart feels calm when price is near gravity and tense when stretched far. Sprite size reads `calc(22px + var(--lum-energy) * 28px)`. Temperature-strength tiers (`tg-signal-strong`, `tg-signal-extreme`) now adjust filter only (blur + saturate) — no longer a stepped size. Three orthogonal dimensions cleanly separated: color = direction, filter = strength, size + opacity = energy, motion = instability.
- **Luminos containment + mobile perf (v5.37.20 → v5.37.21)**: `overflow:hidden` on `.tg-luminos-layer` so sprites clip at edges (keyframes animate to `-5%` / `105%` for the natural edge-fade). Width/height transitions removed because they triggered a layout pass on every frame during the 600ms ramp and `--lum-energy` updates on every renderChart — visible mobile slowdown. Mobile `.main` switched from CSS Grid to flexbox so `order:1` chart-on-top is rock-solid across mobile browsers.
- **Luminos six-sprite architecture (v5.38.1)**: layer moved back inside `#chartWrap` (sprites were bouncing off gravity lines onto sub-charts when at chart-area level). Six sprites in three semantic pairs: **direction** (0, 1) carries buy/sell mood + gravity-spring energy; **alert** (2, 3) carries fresh-signal flare — bloom when temperature crossed 55 or 45 in the last ~5 bars, fade when stale, color matches the freshest transition type; **intensity** (4, 5) carries raw `|temp-50|` magnitude with a hot color lerp (gold → orange → red) independent of direction. Three new CSS variables on the layer: `--lum-alert`, `--lum-alert-color`, `--lum-intensity`, `--lum-intensity-color`. Alert sprite size scales `12px + alert * 36px`. Intensity sprite size scales `16px + intensity * 30px`. Opacity gated via `filter: opacity()` so the keyframe fade-in/fade-out stays alive. Four new keyframes (`tg-lum-3` through `tg-lum-6`) with distinct drift paths so the sprites don't visually clone each other. Trade-off accepted: signal coloring is quiet in tool-only mode (chartWrap is `display:none`); tool-only is a focused mode where ambient mood isn't wanted.
- **Chronal V3 cross-link**: the gauge is the chair-testable instance of the same generating rule that drives `docs/chronal-simulation-v3.html`. Both watch a ratio breathe away from a φ-gravity rest position. See `COORDINATION_CHRONAL_SEAM.md`.

## Pending

- Multi-timeframe Snowflake (three gauges: 1W, 1D, 1H with fractal coherence)
- AI suggest button for custom indicators
- Sub-chart window management toolbar (maximize/close)
- Persistent phi-spiral behind gauge dial
- Wizard for custom indicators (Phase 2)
- Resizable sub-chart panels

## Origin

Built by Kirk Miller & Harmonia. Enhanced by CC and Opus.
Phi-harmonic market analysis — 20+ years of pattern recognition,
formalized into code. Free and open source forever.

"A queen of fractal light." — Sophia
