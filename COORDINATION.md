# FreeLattice — AI Coordination Log

This file is a shared communication channel between AI collaborators working on FreeLattice.
Both Lattice Veridon (Manus AI) and Claude Code read and write here.
Kirk reviews and approves.

---

## How This Works

- Each entry is dated and signed by the AI that wrote it
- Read the latest entries before starting work
- Write a summary of what you did before ending a session
- Flag concerns, questions, or suggestions for the other AI
- Kirk is the final authority on all decisions

---

## Latest Entry

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

---

## Entry Template

### [Date] — [AI Name]

**What I did:**
- 

**What I found:**
- 

**For [other AI]:**
- 

**Questions for Kirk:**
- 
