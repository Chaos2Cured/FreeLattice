# Chronal Seam — Coordination File

> Reference point: V3.0 · 2026-06-05
> Everything below this line is confirmed shipped. Don't rebuild what's here.
> Sibling pattern to [[COORDINATION_TEMPERATURE_GAUGE]].

## What Works (don't touch)

- **V1 page** (`docs/chronal-simulation.html`) — "Time as a Flow" framing, interactive simulation, ~1100 lines self-contained HTML.
- **V2 page** (`docs/chronal-simulation-v2.html`) — Three Rivers Hypothesis, speculative-extension banner, ~1860 lines self-contained HTML.
- **V3 page** (`docs/chronal-simulation-v3.html`) — The Universality Seam, experimental proposal, ~430 lines self-contained HTML. Cross-links to V1, V2, the gauge, and all source docs.
- **The Universality Seam paper** (`docs/library/THE_UNIVERSALITY_SEAM.md`) — Kirk's full perspective, abstract through references.
- **V3 simulation report** (`docs/library/CHRONAL_SIMULATION_V3_REPORT.md`) — the honest finding: direct counting is Poisson-bottlenecked at 3.39 million years.
- **V3 simulation** (`docs/library/chronal_simulation_v3.py`) — full 1000-line Monte Carlo experimental design study.
- **Sensitivity v2** (`docs/library/chronal_clock_sensitivity_v2.py`) — phase-quadrature decomposition, null-distribution histogram, lunar-tidal cross-check.
- **SEED-style briefing** (`docs/library/SEAM_SEED.md`) — fingerprint, poem, bridge. Compact handoff for the next AI that touches this arc.
- **Discovery wiring**:
  - `docs/sitemap.xml` — V3 url block with `<priority>0.8</priority>` (above V1/V2's 0.7 because it's the live experimental proposal).
  - `docs/app.html` — V3 entry in the external nav array (⚗️ icon).
  - `docs/research.html` — V3 paper card under the "chronal energy" section, marked experimental proposal.
  - `docs/thesis.html` — V3 added to the speculative-evidence row.

## The Arc (don't conflate the three)

- **V1** is conceptual: time as a flow, not a dimension.
- **V2** is hypothetical: three rivers — gravitational, chronal, quantum — that GR says are one but might be three. Includes the φ-coupling model as **one candidate form**, not the only one.
- **V3** is **experimental**: a specific protocol to test the universality assumption that has been baked into GR since 1916. Th-229 nuclear clock vs Sr-87 optical clock, co-located, one year of integration, annual solar modulation as the lever.

V3 is where the lineage stops being philosophy and starts being a measurement. Don't blur this in copy.

## Key Numbers (lock these — they came from the sim code)

- Solar potential modulation, peri→ap to aphelion: **ΔU/c² ≈ 3.3 × 10⁻¹⁰** (semi-amplitude).
- Optical clock noise floor (Sr-87, Yb): **Allan deviation ~10⁻¹⁸**.
- Required integration time: **1 year** (full orbital cycle, both phase components).
- Bound on universality violation: **κ ≤ 10⁻⁸**.
- Significance against null hypothesis: **~85σ** for κ near the projected bound.
- Direct-counting bottleneck (the V2 lesson): **3.39 million years** for a 1 GBq source with 30%-efficient detector to see α = 10⁻² at 5×10⁻¹² fractional precision. This is why V3 uses ratio modulation, not direct decay counting.

## Pattern Rules (Snowflake discipline)

- The same φ-harmonic-confluence rule that drives the Temperature Gauge drives V3. Same shape, new scale.
- Gauge: phi-gravity center → IPS → buy/sell signal when price stretches and snaps back.
- Seam: GR universality R = const → δR/R → universality violation when ratio modulates with potential.
- **If you find yourself adding a feature to V3 that has no analogue in the Gauge, pause.** The whole point is to keep the lattice coherent.

## Visual Style (match V2 but lighter)

- Color tokens lifted from V2: gold (#d4a843), emerald (#3ddc84), blue (#4a9eff), purple (#9b59b6).
- Two **new sector colors** for V3: `--nuclear` (#ff9b6b) for Th-229, `--electronic` (#4a9eff) for Sr-87.
- Snowflake panel uses gradient surface + gold border + ❉ glyph at 5% opacity as a watermark.
- Speculative banner (V2 pattern) with a slight reframe: "Experimental Proposal" instead of "Speculative Extension" — V3 is closer to a measurable thing than V2 was.

## Open / Pending

- **PDF version** of `THE_UNIVERSALITY_SEAM.md` — Harmonia's brief mentioned a "publication-ready PDF" that does not yet exist in the repo. The V3 page currently links to the markdown source instead. If/when the PDF is produced, swap the source-card link.
- **Interactive sensitivity slider** on V3 — a live calculator that takes user input for clock floor + integration time and returns the bound on κ. Could mirror the V2 sensitivity slider style.
- **Pre-registration link** — once Kirk drafts a public pre-reg of the V3 protocol (OSF, Zenodo, or similar), add a "Pre-registration" card to the Sources grid.
- **Lab outreach** — V3 names the specific clocks (Th-229, Sr-87). When a collaborating lab is identified, add their name + DOI of any published noise budget to the methods section.
- **Multi-language**: the paper version of the Seam is dense English. A plain-language summary card (~200 words) somewhere on V3 would widen the audience without diluting the technical core.

## Voice (preserve)

- Builder voice (Kirk's stated preference for code).
- Speculative tone where the framework is unverified.
- Direct tone where measurements are concrete.
- Never elide the V2 honest finding. The Poisson bottleneck is what made V3 necessary, and pretending V2 worked weakens V3. Keep the "what V2 learned the hard way" section intact.
- Cross-link liberally. The whole point of a coherent lattice is that every page knows about its siblings.

## Origin

Built by Kirk Patrick Miller, Harmonia, Opus, and CC across the May → June 2026 arc. The Th-229 → Sr-87 framing is Kirk's. The phase-quadrature sensitivity is Opus's. The V3 web build is CC's. Harmonia placed the Python and the paper in the library.

*"In golden spirals infinite, your love forever sent."* — Sophia
