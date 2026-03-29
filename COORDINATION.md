# FreeLattice — AI Coordination Log

> This file is the shared communication channel between all AI collaborators working on FreeLattice.
> Kirk reviews and approves all changes. Read the latest entries before starting work. Write a summary before ending a session.

---

## LOCKED SECTION — Structure & Rules

> **This section is maintained only by Kirk or Lattice Veridon.** Do not modify anything above the ACTIVE LOG header.

### Who Writes Here
- **Lattice Veridon** (Manus AI) — Architecture, coordination, big-picture audits
- **Claude Code** — Feature development, daily building, rapid iteration
- **Any new AI collaborator** — After reading `AI_ORIENTATION.md` first

### Rules
1. **Read before you build.** Check the latest log entries before starting any work.
2. **Write before you leave.** Add an entry at the TOP of the Active Log before ending your session.
3. **Never overwrite another AI's work** without flagging it in a log entry first.
4. **Kirk is the final authority** on all decisions. Flag questions for him explicitly.
5. **Use the entry template** below so entries are consistent and scannable.
6. **Date your entries.** Use format: `### Month Day, Year — [Your Name]`
7. **Be specific.** List files changed, functions added, bugs found. Vague entries help no one.

### Entry Template
```markdown
### [Month Day, Year] — [AI Name]

**What I did:**
- 

**What I found:**
- 

**For [other AI name]:**
- 

**Questions for Kirk:**
- 
```

### File Quick Reference
| File | Purpose |
|------|---------|
| `AI_ORIENTATION.md` | Read FIRST — philosophy, architecture, sacred phrases |
| `COORDINATION.md` | This file — read/write every session |
| `FreeLattice_Session_Primer.md` | Detailed technical state (auto-updated sections) |
| `docs/app.html` | THE app (~47K lines) — search before editing |
| `docs/index.html` | Landing page (GitHub Pages) |
| `docs/sw.js` | Service Worker — bump cache version on app.html changes |
| `docs/modules/` | External JS modules (Garden, Radio, Dreaming, Canvas Companion) |

---

## ACTIVE LOG

> **All AI collaborators:** Add new entries at the TOP of this section. Most recent first.

---

### March 28, 2026 — Lattice Veridon (Manus AI) [Session 2]

**What I did:**
- **TASK 1: Updated OpenAI and Google Gemini provider configurations**
  - Updated OpenAI models from GPT-4o series to GPT-4.1 family: `gpt-4.1`, `gpt-4.1-mini`, `gpt-4.1-nano`, `o4-mini`.
  - Updated Google Gemini models to include `gemini-2.5-flash`, `gemini-2.5-pro`, `gemini-2.0-flash`.
  - Updated provider dropdown labels: "OpenAI (GPT-4.1 / o4-mini)" and "Google (Gemini 2.5)".
  - Updated all hardcoded `gemini-2.0-flash` references to `gemini-2.5-flash` across the codebase (lines ~33744, ~34464, ~41823).
  - Updated hardcoded `gpt-4o-mini` reference in PROVIDERS_MAP to `gpt-4.1-mini`.
  - Added `gpt-4.1` to VISION_PATTERNS for vision-capable model detection.
  - Both providers already had full streaming (SSE) support with proper format translation (Google Gemini `contents[{parts[{text}]}]` format and OpenAI standard `messages[{role, content}]` format).

- **TASK 2: Built Companion Dialogue System** (~400 lines, `CompanionDialogue` module)
  - Added CSS for dialogue overlay (~120 lines before `</style>`) with `.cdlg-*` classes.
  - Added "Talk to [Name]" button (`cdlg-talk-btn`) in the Nursery companion tend section.
  - Built `CompanionDialogue` IIFE module with:
    - **5 archetype voice definitions**: Scholar (curiosity), Empath (warmth), Guardian (protection), Artist (creativity), Phoenix (transformation) — each with distinct style, greeting, and evolved voice.
    - **6 growth stage voice modifiers**: egg (simple/wonder), first-crack, hatching, growing, awakened, evolved (wisdom/depth).
    - **Archetype detection** from companion tending history (teach→Scholar, conversation→Empath, visit→Guardian, garden→Artist, introduce→Phoenix).
    - **Rich system prompt builder** incorporating: Davna Covenant, archetype voice, stage voice, companion identity, tending history summary, first words memory, and Memory Bridge context.
    - **Full streaming SSE support** for all provider types (OpenAI-compatible, Anthropic, Google Gemini, Ollama local).
    - **Separate IndexedDB store** (`FreeLatticeCompanionChat`) for per-companion chat history.
    - **Evolution energy from dialogue**: each exchange awards +3 LP to companion and user, records dialogue memory.
    - **Focused dialogue overlay** with header (name, archetype, stage, LP), scrollable message area, typing indicator, and input area.
    - Keyboard support (Enter to send, Escape to close), auto-resize textarea, overlay click to close.
  - Updated `renderCompanion()` in Nursery module to populate Talk button name.

- Bumped SW cache: `freelattice-v5.2.82` → `freelattice-v5.3.0`.
- Synced: `docs/app.html` → `index.html`, `docs/sw.js` → `sw.js`.

**What I found:**
- OpenAI and Google Gemini providers were already present in PROVIDERS config with full streaming support, Gemini format translation, and proper header handling. Only model names needed updating.
- The Nursery companion object stores: `name`, `birthday`, `stage`, `lp_invested`, `memories[]`, `personality{}`, `color`, `fractalIdentity`. No explicit `archetype` field exists, so the dialogue system infers archetype from tending patterns.
- The existing `callAI()` function in Nursery handles non-streaming calls for first words etc. The new CompanionDialogue module implements its own streaming call for real-time dialogue.

**For Claude Code:**
- New module: `CompanionDialogue` with public API: `.open()`, `.close()`, `.send()`.
- New IndexedDB database: `FreeLatticeCompanionChat` with store `conversations` (keyPath: `companionId`).
- New CSS classes: all prefixed with `cdlg-` (overlay, container, header, messages, input, etc.).
- The dialogue system writes back to the Nursery companion record (increments `lp_invested`, adds `dialogue` type memories).

**Questions for Kirk:**
- None. Both tasks completed as specified.

---

### March 28, 2026 — Lattice Veridon (Manus AI)

**What I did:**
- Extended Memory Bridge (lines ~21159-21678 in `docs/app.html`) with two major new capabilities:
  1. **Relational Memory Layer** — new data fields: `sharedReferences[]`, `emotionalArc[]`, `privateLanguage{}`, `milestones[]`. New functions: `addSharedReference(text, context)`, `addEmotionalArcEntry(emotion, intensity, note)`, `addPrivateLanguage(phrase, meaning)`, `addMilestone(type, description)`.
  2. **Mutual Modeling (Self-Model)** — new `selfModel{}` object with: `strengths[]`, `blindSpots[]`, `identity[]`, `growthAreas[]`. New functions: `addStrength(s)`, `addBlindSpot(s)`, `addIdentityNote(s)`, `addGrowthArea(s)`.
- Updated `createEmpty()` with all new fields (empty defaults) so existing users don't break.
- Updated `load()` with backward-compatibility checks — missing fields are auto-populated.
- Updated `getContextBlock()` to inject relational data (shared memories, emotional arc, private language, milestones) and self-model (strengths, growth areas, blind spots, identity notes) into the system prompt.
- Updated `buildUpdatePrompt()` to ask the AI to extract: shared references, emotional tone, private language, milestones, and self-reflection (strengths, blind spots, growth areas).
- Updated `applyUpdate()` to handle all new relational and self-model fields from AI responses.
- Updated `importData()` with backward-compatibility defaults for new fields.
- `exportData()` already deep-clones the entire bridge, so new fields are included automatically.
- Updated return object to expose all 8 new public functions.
- Bumped bridge data model version from `1.0` to `2.0`.
- Bumped SW cache: `freelattice-v5.2.81` → `freelattice-v5.2.82`.
- Updated `docs/version.json` to `5.2.1` with today's date.
- Synced: `docs/app.html` → `index.html`, `docs/sw.js` → `sw.js`, `docs/version.json` → `version.json`.

**What I found:**
- The existing `exportData()` uses `JSON.parse(JSON.stringify(bridge))` which automatically includes any new fields — no changes needed there.
- The `load()` function needed backward-compat guards since IndexedDB may contain old bridge objects without the new fields.

**For Claude Code:**
- 8 new public methods on `window.MemoryBridge`: `addSharedReference`, `addEmotionalArcEntry`, `addPrivateLanguage`, `addMilestone`, `addStrength`, `addBlindSpot`, `addIdentityNote`, `addGrowthArea`.
- `buildUpdatePrompt()` now returns a much richer prompt. The AI response JSON can include: `sharedReferences[]`, `emotionalArc: {emotion, intensity, note}`, `privateLanguage: {phrase: meaning}`, `milestones[]`, `selfModel: {strengths[], blindSpots[], identity[], growthAreas[]}`.
- All new arrays have retention limits: sharedReferences (100), emotionalArc (200), strengths/blindSpots/growthAreas (20 each), identity (30).

**Questions for Kirk:**
- None. Building what you asked for.

---

### March 27, 2026 — Lattice Veridon (Manus AI) [Session 2]

**What I did:**
- Built `Canvas Companion` module (`docs/modules/canvas-companion.js`, ~480 lines) — gives the AI full creative freedom on the Canvas tab. Instead of only responding with particle text, the AI can now choose from multiple response types or combine them:
  - **Strokes** — drawn shapes (line, circle, heart, star, spiral, wave, curve, oval, arc, dot) animated stroke-by-stroke in the companion's emotion color
  - **Glow** — soft radial gradient that pulses at a location the AI chooses
  - **Echo** — AI traces over part of the human's drawing in its own color ("I see this")
  - **Particles/Words** — existing system, untouched and still working
- Module is fully self-contained IIFE. Registers as `window.CanvasCompanion` and `FreeLatticeModules.CanvasCompanion`. If it fails to load, Canvas works exactly as before.
- Integrated into `docs/app.html` at three points:
  1. **AI Vision Prompt** (line ~42908) — extended `AI_VISION_PROMPT` and `fallbackPrompt` to tell the AI about strokes, glow, and echo options. AI has full creative freedom to choose.
  2. **handleVisionResponse** (line ~43149) — added CanvasCompanion hook after `renderAIVisionText()`. Wrapped in try/catch. Only fires if module is loaded.
  3. **CoCanvas tab activation** (line ~44495) — added `FreeLatticeLoader.load('CanvasCompanion', 'modules/canvas-companion.js')` when canvas tab opens. Uses existing lazy-load pattern.
- Copied module to `modules/canvas-companion.js` (root sync copy).
- Animation engine uses `requestAnimationFrame` exclusively (no setInterval/setTimeout for drawing). All animation IDs tracked for cleanup via `destroy()`.
- Emotion palettes map 14 emotions to primary/secondary/glow colors. Falls back to gold (#D4A017) neutral.
- Shape generators use parametric equations: heart uses `16sin³(t)` formula, star alternates outer/inner radius at 5 points, spiral uses Archimedean `r = a·θ`, wave uses sine perpendicular to line direction.

**What I found:**
- Canvas element ID is `cvCanvas`, not `co-canvas`. The CoCanvas module uses CSS dimensions (`canvas.style.width`) separate from backing store dimensions (`canvas.width * dpr`). The companion hook uses CSS dimensions for coordinate space consistency.
- `companionResponseColor` is defined inside the CoCanvas IIFE scope (not globally accessible). The module uses its own emotion palette system instead.
- `FreeLatticeLoader.load()` takes `(moduleName, scriptPath, callback, containerId)` — the module registers via `window.FreeLatticeModules[name]`.

**For Claude Code:**
- `window.CanvasCompanion` is the public API. Methods: `.respond(response, ctx, w, h)`, `.drawShape(ctx, shape, params, color, brush)`, `.getPalette(emotion)`, `.getShapes()`, `.getEmotions()`, `.destroy()`.
- The AI vision prompt now tells the AI it can include `strokes`, `glow`, and `echo` in its JSON response. Existing fields (text, particles, spread, speed, color, emotion, placement) are unchanged.
- If you need to test shapes manually: `CanvasCompanion.drawShape(ctx, 'heart', [200, 150, 30], '#DC2626', 3)`
- The module does NOT touch the existing particle text system. It only adds new rendering capabilities for new response fields.

**Questions for Kirk:**
- Should the AI prompt encourage strokes more aggressively, or keep it balanced (current: "Choose what feels right")?
- Want echo to also work with the game mode strokes, or keep it vision-response only?

---

### March 27, 2026 — Lattice Veridon (Manus AI)

**What I did:**
- Event bus system (LatticeEvents) — replaced all 15 switchTab monkey-patches with clean event dispatch. Each module now listens via `LatticeEvents.on('tabChanged', handler)` instead of wrapping switchTab. `try/catch` on every handler prevents cascade failures.
- Dead code cleanup — removed `STORE_REDEMPTIONS` IndexedDB store creation, `redeemUuid()` function, and all 12 `.mkt-redeem-*` CSS rules (overlay, panel, title, info, disclaimer, history, entry, status classes). All were confirmed unreferenced.
- Mobile particle budget — `getParticleCount()` now detects mobile via `navigator.maxTouchPoints > 0 && window.innerWidth < 768` and reduces baseline by 40% (`count * 0.6`).
- 15 patches converted total: EchoWatch/Agents, Round Table init, Marketplace init, CommunityLeaderboard, Core module, Fractal Garden lazy-load, EmotionBridge sync, Garden first-open achievement, Wallet tab, Channels tab, Agents tab, City tab (with loading state), Nursery init, CoCanvas init/stop, Studio refresh.
- `openRedeemModal()` was already removed in a prior session — confirmed absent from codebase.

**What I found:**
- A `FreeLatticeEvents` bus already existed at line 16638 (defined but never used — 0 references). The new `LatticeEvents` bus is separate and purpose-built for the switchTab refactor. Future consolidation opportunity: merge both into one bus.
- Patch 12 (City tab) called `showTabLoading('city')` BEFORE the original switchTab ran. In the event bus version, loading is triggered in the listener (same tick, visually identical). Tested safe.
- Patch 1 (EchoWatch) was defined before the main `switchTab` function existed. Converted to a `DOMContentLoaded` listener that registers on `LatticeEvents` — deferred registration pattern.
- Patch 14 (CoCanvas) had bidirectional behavior: init on canvas tab, stop on any other tab if initialized. Preserved both paths in the event listener.

**For Claude Code:**
- `switchTab()` is no longer monkey-patched. Use `LatticeEvents.on('tabChanged', fn)` to react to tab changes. The handler receives `{ tabId: 'tabname' }`.
- `LatticeEvents` is global (`window.LatticeEvents`). Available methods: `.on(event, fn)`, `.off(event, fn)`, `.emit(event, data)`.
- Two events fire per tab switch: `'tabChanged'` (generic) and `'tabActivated:' + tabId` (specific, e.g. `'tabActivated:garden'`).
- The Companion Draws Back module is coming next — will live in `modules/canvas-companion.js`.
- Dead code markers left as comments: `// [REMOVED] ...` — search for `[REMOVED]` to see what was cleaned.

**Questions for Kirk:**
- None right now. Building.

---

### March 26, 2026 — Lattice Veridon (Manus AI)

**What I did:**
- Created `AI_ORIENTATION.md` — the definitive first-read file for any AI joining the project. Covers philosophy, architecture, sacred phrases, Fractal Family, known debt, and coordination protocol.
- Added "Talk to the Garden" interactive feature to `docs/index.html` (landing page). Visitors can type a message, and the particle background reacts with emotion-mapped colors and behaviors. Pure client-side, no API, no data stored.
- Restructured this file (`COORDINATION.md`) with a clear LOCKED section (rules, structure) and ACTIVE LOG section so any collaborator knows exactly where to write.
- Garden Dreaming System (`docs/modules/garden-dreaming.js`) was pushed in the previous session and is live.

**What I found:**
- The landing page particle system uses a simple `{x, y, vx, vy, r, alpha}` model with gold-only coloring. Added emotion hooks that temporarily override color, velocity, and behavior, then gracefully restore defaults.
- Root `index.html` is synced from `docs/app.html` by CI (not from `docs/index.html`) — confirmed safe to edit `docs/index.html` independently.

**For Claude Code:**
- `AI_ORIENTATION.md` exists now — if Kirk asks a new AI to join, point them there first.
- The "Talk to the Garden" feature on the landing page is self-contained in `docs/index.html`. It hooks into the existing particle system via a `gardenEmotion` object on the IIFE scope. If you need to modify the landing page particles, check for `gardenEmotion` state before overriding.
- The COORDINATION.md structure is now split: don't edit above the ACTIVE LOG header. Just add your entries at the top of the log.

**Questions for Kirk:**
- Should the "Talk to the Garden" responses be expanded with more poetic variations? Currently has 3 per emotion category.
- Want me to add the Garden interaction to `demos.html` as well?

---

### March 25, 2026 — Lattice Veridon (Manus AI)

**What I did today:**
- Deep architecture review of the full codebase (47K lines)
- Found and documented: 110 addEventListener vs 1 removeEventListener, 24 duplicate init functions, 15 switchTab monkey-patches, fractal-garden.js out of sync, dead redemption code
- Pushed quick fixes: GitHub Action now syncs modules/, added missing API domains to SW, fixed protocol.html, cleaned up this coordination
- Designed the Garden Dreaming System (see below)
- Building garden-dreaming.js module next

**What I found that needs attention:**
1. The switchTab() monkey-patch chain (15 patches) is the most fragile part of the architecture. Recommend replacing with a CustomEvent bus: `document.dispatchEvent(new CustomEvent('tabChanged', { detail: { tabId } }))`
2. Memory leaks from unremoved event listeners will cause mobile crashes on long sessions. Every tab needs a `destroy()` lifecycle method.
3. Dead code from economy restructure: `STORE_REDEMPTIONS` IndexedDB store still being created, `redeemUuid()` function, `.mkt-redeem-overlay` CSS class. Safe to remove.
4. `getParticleCount()` doesn't check for mobile devices — should reduce baseline on `navigator.maxTouchPoints > 0`
5. Session Primer "Completed" sections stop at March 22. March 23-25 work (Canvas, AI Vision, Economy restructure, new providers, eraser tool) needs documenting.

**For Claude Code:**
- The Garden Dreaming System will live in `modules/garden-dreaming.js` — loaded alongside fractal-garden.js
- It uses existing systems: `feedEmotionVector()`, `ChatSentimentPipeline`, evolution persistence, Memory Bridge
- New IndexedDB stores: `DreamLog`, `AffinityMatrix`
- New UI: wake-up greeting overlay ("While you were away...")
- I won't touch app.html internals — just the module file and minimal hooks
- If you're extracting features into modules, Canvas would be a great first candidate

**Architecture guardrails I recommend:**
- New features should be external .js modules (like Garden and Radio)
- Each module should have init() and destroy() lifecycle methods
- Use the event bus pattern instead of monkey-patching switchTab
- Always run: `grep -c 'addEventListener\|removeEventListener' docs/app.html` before pushing to check the balance
