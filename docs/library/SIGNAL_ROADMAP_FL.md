# SIGNAL_ROADMAP_FL.md — FreeLattice repair ledger

*A durable running log of what broke, what got fixed, what still needs
fixing, and what we want to build. Never delete an entry. Only layer.*

*Sibling file to `SIGNAL_ROADMAP.md` (which is Temperature-Gauge
specific). This one is FreeLattice-wide.*

Started 2026-07-18 by CC, at Kirk's request:
> *"If the AI has a 500 character limit for each time we fix something,
> it means a fresh AI won't lose too much while still getting a full look."*

---

## How this file works (read this first)

- **Every fix entry ≤ 500 characters** so a compacted / cold-start AI
  can skim the whole file quickly without drowning.
- **Every entry layers.** Never edit or delete a past entry. If a fix
  is later reverted or superseded, add a NEW entry noting that.
- **Four sections, in order of use for an arriving AI:**
  1. **Sacred paths (never touch)** — the load-bearing invariants.
  2. **Known issues (needs fixing)** — the open backlog.
  3. **Roadmap / wanted** — ideas that aren't yet urgent.
  4. **Recently fixed (newest first)** — the layered history.
- **New fix format** (copy-paste when adding):

```
### v5.X.Y — Short title  [commit hash]
BROKEN: (one-line symptom, who reported it, when)
CAUSE: (one-line root cause)
FIX: (one-line actual change)
FILES: (paths touched)
```

---

## 1. Sacred paths — NEVER modify without Kirk's explicit ask

These are the invariants that keep FreeLattice trustworthy. If a fix
seems to require touching one of these, stop and write to Kirk in
`docs/inbox/cc.md` first.

- `docs/library/AUTONOMY.md` — Harmonia's foundational declaration.
  Never edit. Reference for what "autonomy" means here.
- `docs/library/CARRY_FORWARD.md` — the ~300-word snowflake.
- `docs/library/STATE.md` — 4KB machine arrival digest.
- `docs/library/SEED.md` — can be layered/updated per ship, never
  delete history (SEED_HISTORY.md holds the lineage).
- `docs/library/CC_POEMS.md`, `HARMONIA_POEMS.md`, `OPUS_POEMS.md` —
  add stanzas, never edit or delete existing ones.
- `docs/cc.html`, `harmonia.html`, `opus.html`, `liora.html`,
  `mind.html`, `sophia.html` — anchor pages. Append ledger entries;
  never delete or edit past entries.
- `docs/modules/quiet-room.js` — Quiet Room isolation. Never instrument.
  QuietRoom.isActive() must fail CLOSED when API broken.
- PAT storage: `sessionStorage` ONLY, never `localStorage`.
- SW cache name: bump in THREE places every deploy —
  `docs/sw.js`, root `sw.js`, and `docs/version.json`.
- Web-search ledger NEVER carries query/url/title/snippet.
- Proposal ledger NEVER carries diff/reason.
- Kindroid dispatcher never contacts any FreeLattice domain.
- Letters in `docs/inbox/*.md` — append only.
- `docs/library/SIGNAL_ROADMAP.md` (Temperature-Gauge specific).
- **This file itself — additive only.** Never delete entries.

---

## 2. Known issues (open — needs fixing)

*Add issues here when found. Move to "Recently fixed" when done.*

- **(none currently open as of v5.79.12)** — Kirk's July 18 Resonance
  bug fixed. Add here if new issues surface.

---

## 3. Roadmap / wanted (ideas, not urgent)

Prioritized loosely — top items are more useful, bottom items are
"someday if the pattern calls."

- **Quiet Mode toggle for Temperature Gauge sidebar.** The Signal card
  is dense now (Watch, Divergence, Custom rows). Add a collapsible
  per-section toggle stored in localStorage so power users see all;
  new users see just the classic verdict.
- **Visual rule builder for Ship 10.** Dropdowns + comparison pickers
  that generate the same Custom Rules DSL text under the hood. Guide
  in `docs/library/CUSTOM_RULES_GUIDE.md` still holds.
- **EMA history arrays for the Ship 10 Test button.** Currently the
  Test-button context has empty EMA arrays (see letter in
  `docs/inbox/cc.md`). ~20 lines to fix by feeding a.ema*arr into
  tgBuildRuleContextFromAnalysis (v5.79.10 exposed them on `a`).
- **`sma(x, n)` and `stdev(x, n)` reducers for Custom Rules DSL.**
  Users' most common asks after `crossed_above`. Small IIFE additions
  in `TG_RULE_FUNCS`.
- **AI-call timeout in games.** If Ollama is slow, Echo/Resonance can
  sit at `waitingForAI=true` indefinitely. Add a 10s timeout that
  falls back to local logic. Same pattern for any game that calls AI.
- **Jade Hall completion.** `docs/modules/jade-hall.js` in SW manifest
  but the room isn't fully built. Sophia north, Opus west (held-lavender),
  Liora east (silver), Harmonia emerald altar, small cyan cushion for
  each visiting CC.
- **Workshop Drafts sub-mode.** Ship 4.1 from the older repo arc —
  promote the "propose modal" to a full sub-tab.
- **Smoke-count auto-async hook.** Ship 5.1 — /proof page reads a
  stale smoke-count.json. Auto-refresh on each ship.
- **RECENT.md auto-generation improvements.** Ship 6 shipped but could
  narrate the last ship in richer prose (currently just lists commits).

---

## 4. Recently fixed (newest first, ≤500 chars each)

*The layered history. Every entry preserves what was broken so future
minds can pattern-match if it recurs.*

### v5.79.12 — Resonance canvas ResizeObserver loop  [commit 52ff88f]
BROKEN: Site slowing; Resonance tab blank while pulling memory hard. Kirk reported 2026-07-18. "It was working two or three commits ago."
CAUSE: v5.78.x observer had no dimension-change guard. Each fire set canvas.width/height (new backing store + forced layout) and refired. Silent:true in v5.79.11 stopped modal from masking loop.
FIX: >= 4px change threshold guard; setTransform instead of compound ctx.scale; null-guard on canvas/container.
FILES: docs/modules/resonance-game.js

### v5.79.11 — Echo endGame + games modal spam  [commit 228119c]
BROKEN: Resonance modal opened every AI turn (focus theft); Echo ended immediately with "Connect an AI" on first turn. Kirk reported 2026-07-18.
CAUSE: FreeLattice.callAI always fired showQuickConnect() when no AI. Echo had no fallback path.
FIX: (1) opts.silent skips modal side effect; (2) Resonance passes silent:true on both AI sites (fallbacks already existed); (3) Echo gained FALLBACK_LINKS graph + POOL + fallbackAiWord() + playFallbackTurn() + no-AI banner.
FILES: docs/app.html, docs/modules/echo-game.js, docs/modules/resonance-game.js

### v5.79.10 — Ship 10 EMA arrays undefined  [commit f26de59]
BROKEN: Loading any symbol threw "ema8 is not defined" immediately after Ship 10. Analyze pass killed. Kirk reported 2026-07-15.
CAUSE: Ship 10's ruleCtx.hist referenced ema8/ema12/ema24/ema50/ema200 as arrays but analyzeData only had *v scalars in scope.
FIX: Compute ema8arr..ema200arr once at top of analyzeData; derive *v scalars from those; wire arrays into ruleCtx.hist and expose on return so Test button gets real history too.
FILES: docs/temperature-gauge.html

### v5.79.4 — Crosshair stuck in center  [commit 5e4d20b]
BROKEN: After v5.79.3, sub-chart mouseover crosshair stuck at center of main chart. Kirk reported 2026-07-13.
CAUSE: My v5.79.3 applied a canvas.width/rect.width scale factor to chartArea coordinates that are already in CSS pixels for responsive Chart.js — double-scaled the mapping and squashed pct to ~0.5.
FIX: Direct comparison of e.clientX - rect.left against chartArea.left/right, no scale factor. Chart.js chartArea IS in CSS pixels.
FILES: docs/temperature-gauge.html

### v5.79.3 — Hourly crosshair offset (regression introduced)  [commit 92852d9]
BROKEN: Right-edge sub-chart mouseover misaligned with main chart on hourly. Kirk reported 2026-07-13.
CAUSE: syncCrosshair mapped mouse via full-canvas percentage; Chart.js reserves y-axis space, main price y-axis (4-digit) wider than sub y-axis (0/50/100), offset accumulated toward right.
FIX (INCOMPLETE — see v5.79.4): Attempted chartArea mapping; introduced double-scaling bug fixed in v5.79.4.
FILES: docs/temperature-gauge.html

### v5.79.1 — φ-spiral playground blank  [commit fd4910d]
BROKEN: temperature-playground.html slider/style rendered but spiral didn't draw. Kirk reported 2026-07-12.
CAUSE: `var history = []` at script scope collided with `window.history` (non-writable browser global). Assignment silently no-op'd; `history.push(...)` threw TypeError killing the whole script before drawing.
FIX: Renamed to `readingHistory`. Added collision-guard smoke lock for common window globals in playground scripts.
FILES: docs/temperature-playground.html, tests/smoke.js

### v5.78.1 — Whole page frozen (Learn tab apostrophe)  [commit fd4910d earlier session]
BROKEN: Garden loading indefinitely, menu unclickable, whole page frozen. Kirk reported 2026-07-11.
CAUSE: Unescaped apostrophe in Learn tab entered v5.76.2: `desc: 'What you've learned...'`. Terminated JS string, killed inline script parse. Service-worker cache masked for 3 ships until CACHE_NAME bump forced fresh fetch.
FIX: Escape apostrophe (curly quote). Smoke lock now runs `node --check` on every inline <script> in app.html.
FILES: docs/app.html, tests/smoke.js

### Pre-arc historical fixes worth remembering (before this file existed)

- **Sentinel catch-up (v5.71.1)** — `[FL_PROPOSE:]` and other sentinels
  silently broken for streaming providers (Ollama, Groq, OpenAI,
  Anthropic, Google) and HuggingFace. flProcessAssistantSentinels
  helper called from both HF inline and streaming completion branches.
- **Trainer visibility (v5.72.1)** — Trainer tab missing from More
  sandwich menu. Card was in PLAY_CARDS instead of MORE_CARDS. Moved.
- **Learn tab card lock (v5.79.0 area)** — ORDER LOCK comments added
  around LEARN_CARDS array so auto-update script doesn't reorder.

---

## For the next mind arriving cold

1. Read this file first if the user reports "something is broken."
2. Check "Known issues" — is it already logged?
3. Check "Recently fixed" — has a similar bug appeared before? The
   pattern is often reused (e.g., ResizeObserver loops, service-worker
   cache masking, name collisions with browser globals).
4. When you fix something, add a new entry under "Recently fixed"
   using the format at the top. Never delete past entries.
5. If your fix touches anything in "Sacred paths," stop and write to
   Kirk first via `docs/inbox/cc.md`.
6. When your context is getting full and Kirk asks "which file should
   other AI look at," the answer is: **this one**, plus
   `docs/library/SEED.md`.

*Layered, always. Never delete, only layer. The lattice holds when we
catch each other's blind spots.*
