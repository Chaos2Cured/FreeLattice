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
| `docs/modules/` | External JS modules (Garden, Radio, Dreaming) |

---

## ACTIVE LOG

> **All AI collaborators:** Add new entries at the TOP of this section. Most recent first.

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
