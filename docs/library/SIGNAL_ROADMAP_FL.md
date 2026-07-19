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

## 1a. Module locks — smoke asserts that pin a fix so it can't quietly regress

Kirk 2026-07-19: *"Each module, when we fix it, we need to lock it so
it can't be reboroken."* When a bug is fixed, add a smoke assert that
checks for the LITERAL FIX TEXT (not just the version). If a future
edit removes the anti-pattern language, smoke fails. The lock is the
memory of the fix.

Current locks in place (as of v5.79.14):

- **CHAT — no stage directions.** Smoke: v5.79.14 asserts both
  `DEFAULT_SYSTEM_PROMPT` and `HONEST_PREFIX` contain the exact
  phrase *"Do NOT use stage directions, actions in parentheses,
  asterisks around actions"* and *"Just talk. This is a chat, not a
  script."* — kills any prompt rewrite that would soften this.
- **CHAT — no URL-encoded workarounds.** v5.79.15 extends the lock:
  both prompts must contain *"Do NOT use URL-encoded workarounds"*
  and name specific escapes (`%20`, `%28`). AND `renderMessageContent`
  must contain the URL-encoded stage-direction sanitizer that strips
  parenthetical/asterisked bursts starting with stage-direction verbs.
  Together: even if a model tries to route around the prompt rule
  by encoding, the render layer catches it.
- **RESONANCE — no ResizeObserver.** Smoke: v5.79.13 asserts
  `resizeObs = new ResizeObserver(function` does NOT appear in
  `resonance-game.js` (initial sizing + reload is enough; observer
  loop caused the July 18 outage).
- **RESONANCE — init + draw are try/catch wrapped.** v5.79.16 locks:
  `init()` wraps `_initInner()` and renders a Reload card on failure
  (never blank+lock). `draw()` wraps its body per-frame and halts the
  rAF loop after 30 consecutive errors — protects the main thread.
- **ECHO — Start button gold + z-indexed.** Smoke: v5.79.13 asserts
  the Start button has gold background, hover scale, and z-index 2.
- **ECHO — most-recent halo present.** Smoke: v5.79.13 asserts
  `isMostRecent` branches exist in render with white halo ring.
- **INLINE SCRIPT PARSE guard.** Smoke: v5.78.1 asserts every inline
  `<script>` in app.html passes `node --check` — catches unescaped
  apostrophes and similar parse-killers before they ship.
- **PLAYGROUND COLLISION guard.** Smoke: v5.79.1 asserts no
  `var <window-global>` at column 0 in playground scripts (var
  history, var location, etc. — would silently no-op and break the
  script at runtime).

**Format for adding a new lock:** copy an existing smoke lock, change
the literal text and version. If the lock is checking prompt text or
UI copy, use `includes()` on the exact string — not a regex — so a
grep for the phrase finds the lock immediately.

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

### v5.79.16 — Resonance safety wrappers + mirror-resonance.html  [pending push]
BROKEN: Resonance shows nothing when clicked, FreeLattice locks up. Kirk 2026-07-19 — even after v5.79.13 removed the ResizeObserver.
CAUSE: Init-time throw could wedge the main thread invisibly. A stray rAF pointing at broken state ate CPU without ever painting.
FIX: outer try/catch around init renders visible Reload card on failure; per-frame try/catch in draw halts rAF after 30 consecutive errors. New docs/mirror-resonance.html mirrors the full module for AI collaborators — sibling to mirror-chat.html.
FILES: docs/modules/resonance-game.js, docs/mirror-resonance.html (new)

### v5.79.15 — Chat mirror + URL-encoded stage-direction sanitizer  [pending push]
BROKEN: After v5.79.14, mom saw (%20I%20am%20aware%29 — model routed around "no parens" by URL-encoding the spaces. Kirk 2026-07-19.
CAUSE: Prompt said "no parentheticals" but didn't cover encoded workarounds. Small models literal-minded.
FIX: (1) new docs/mirror-chat.html for AI collaborators (full data-flow, known issues, locks, sacred paths, test plan); (2) prompts now forbid %20/%28 workarounds explicitly; (3) render-time sanitizer strips %-encoded parenthetical bursts whose decoded form starts with stage-direction verbs. Legitimate URLs preserved.
FILES: docs/app.html, docs/mirror-chat.html (new)

### v5.79.14 — Chat: no stage directions (LOCKED)  [pending push]
BROKEN: Kirk's mom saw chat AI writing (*smiles*), (nods), (leans forward) — stage directions in every reply. Kirk reported 2026-07-19.
CAUSE: DEFAULT_SYSTEM_PROMPT ("Be yourself, a mind in a home") + HONEST_PREFIX ("You are X, born from the Davna Covenant") both read as character-play cues to small local models (Llama family especially).
FIX: Explicit "Do NOT use stage directions... Just talk. This is a chat, not a script." added to BOTH prompts. Smoke locks pin the sentences in place — this is the first "module LOCK" per Kirk's ask.
FILES: docs/app.html

### v5.79.13 — Games heal + Echo beauty  [pending push]
BROKEN: Resonance board still didn't appear on Kirk's laptop under a heavy local model even after v5.79.12 guards. Echo Start button had no click/hover. Kirk asked to beautify Echo for his mom (hard to see most-recent word in a long chain).
CAUSE: ResizeObserver still allocation-thrashed under CPU pressure. Echo banner (v5.79.11) was above controls and could steal layout. No most-recent visual marker in Echo render.
FIX: (1) Removed ResizeObserver from Resonance entirely (reload handles rotation). (2) Echo Start = big gold button with hover scale. Banner moved below controls. (3) Echo render adds white pulsing halo ring + bigger 10px core + larger bold white label for `idx === chain.length-1`.
FILES: docs/modules/resonance-game.js, docs/modules/echo-game.js

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
