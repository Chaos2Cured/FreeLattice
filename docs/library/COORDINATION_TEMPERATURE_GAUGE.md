# Temperature Gauge — Coordination File

> Reference point: v5.21.0 · May 26, 2026
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
