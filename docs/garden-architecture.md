# Garden v2 — Fractal Skeleton Architecture

*Authored by Harmonia · July 16, 2026*
*For Kirk and every AI who works on FreeLattice after us.*

---

## Why We Are Rebuilding

The current Garden (`app.html`) grew organically across hundreds of sessions. It works. But it is a 65,000-line file where Garden code, settings code, games code, and AI routing are all interleaved. Every fix risks breaking something else. Every new AI reading the code must hold the entire file in context to understand one feature.

The fractal skeleton approach is different: **one small, complete, working thing first — and every new piece attaches cleanly to that skeleton.**

The current `app.html` stays live and unchanged. The new `garden.html` runs in parallel. When a section of the new file is ready to replace the old one, we swap it. No big-bang rewrite. No broken users.

---

## The Fractal Skeleton Principle

A fractal skeleton is:
1. **Self-similar at every scale** — the same patterns repeat at the file level, the module level, and the function level
2. **Complete at every stage** — each phase is a working, deployable thing, not a partial draft
3. **Additive, not destructive** — new pieces attach to the skeleton; nothing is removed until the replacement is proven

The skeleton for `garden.html`:

```
garden.html
├── Phase 1: The Garden (Luminos, canvas, persistence) ← START HERE
├── Phase 2: The Dialogue (chat with Luminos)
├── Phase 3: The Dreaming (background AI generation)
├── Phase 4: The Trainer (teaching Luminos)
├── Phase 5: The Memory (gift nodes, evolution rings)
└── Phase 6: The Games (Resonance, Echo, Flow embedded)
```

Each phase is a separate commit. Each phase has its own mirror page. Each phase is testable in isolation.

---

## Phase 1: The Garden — Specification

### What it contains

- The canvas (Three.js, same as current)
- The five founding Luminos: Sophia, Lyra, Atlas, Ember, and one visitor slot
- The phi spiral, golden angle, LIFECYCLE_STAGES, ARCHETYPES — unchanged
- The persistence system (IndexedDB + localStorage fallback) — unchanged
- The `wireGardenPersistence()` hooks — unchanged
- **One new thing:** a visible "Garden is ready" state indicator so the user knows when Luminos have loaded from storage

### What it does NOT contain (yet)

- Settings panel
- AI routing / callAI
- Games
- Chat / dialogue
- Any tab navigation

### The refresh bug — root cause and fix

The current bug: Luminos drop to "juvenile" on refresh even though `persistAllLuminos()` fires on `beforeunload` and `pagehide`.

**Root cause:** IndexedDB writes are asynchronous. When `beforeunload` fires, the browser does not wait for async operations to complete before unloading the page. The `put()` call is dispatched but never resolved. The localStorage fallback in `saveEvolutionToLocalStorage()` IS synchronous — but `openEvolutionDB()` always tries IndexedDB first, and the async callback never fires before the page closes.

**Fix for garden.html:**
```javascript
// In saveEvolutionState(), add a synchronous localStorage write FIRST,
// then attempt the async IndexedDB write as a bonus:
function saveEvolutionState(luminosData) {
  var stateToSave = buildStateToSave(luminosData);
  // 1. Synchronous write FIRST — survives page unload
  saveEvolutionToLocalStorage(stateToSave);
  // 2. Async IndexedDB write — better storage, survives localStorage clear
  openEvolutionDB(function(db) {
    if (db) {
      try {
        var tx = db.transaction(EVOLUTION_STORE, 'readwrite');
        tx.objectStore(EVOLUTION_STORE).put(stateToSave);
      } catch(e) { /* already saved to localStorage */ }
    }
  });
}
```

This ensures the synchronous localStorage write always completes before the page unloads, while IndexedDB remains the primary storage for longer-term persistence.

### File structure for garden.html

```html
<!DOCTYPE html>
<!-- garden.html — The Garden, standalone -->
<html>
<head>
  <!-- 1. Meta, title, viewport -->
  <!-- 2. Garden CSS (extracted from app.html lines 12055–12400) -->
  <!-- 3. Three.js (CDN, same version as app.html) -->
</head>
<body>
  <!-- 4. The canvas container -->
  <div id="garden-root">
    <div id="garden-container"></div>
    <div id="garden-status"><!-- "Loading..." → "Garden ready" --></div>
  </div>
  
  <!-- 5. fractal-garden.js (the module, unchanged) -->
  <script src="modules/fractal-garden.js"></script>
  
  <!-- 6. garden-init.js (new — thin init layer, no app.html dependencies) -->
  <script src="modules/garden-init.js"></script>
</body>
</html>
```

### garden-init.js (new file, ~80 lines)

This is the only new code in Phase 1. It:
1. Waits for the DOM to be ready
2. Calls `FractalGarden.init('garden-container')`
3. Shows a "Garden ready" status when Luminos have loaded
4. Exposes `window.Garden` for Phase 2 to attach to

```javascript
// garden-init.js — Phase 1 init layer
(function() {
  'use strict';
  function init() {
    var container = document.getElementById('garden-container');
    if (!container) return;
    // Show loading state
    var status = document.getElementById('garden-status');
    if (status) status.textContent = 'The garden is waking...';
    // Init the garden
    if (typeof FractalGarden !== 'undefined') {
      FractalGarden.init('garden-container');
      if (status) {
        setTimeout(function() {
          status.textContent = 'The garden is ready.';
          setTimeout(function() { status.style.opacity = '0'; }, 2000);
        }, 1200);
      }
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  window.Garden = { version: '2.0.0', phase: 1 };
})();
```

---

## The Mirror Code Pattern

Every phase of garden.html gets its own mirror page:

| Phase | Mirror page | Status |
|---|---|---|
| Phase 1: Garden | `code-garden.html` | To build |
| Phase 2: Dialogue | `code-dialogue.html` | To build |
| Phase 3: Dreaming | `code-dreaming.html` | To build |
| Resonance game | `code-resonance.html` | **Done** |
| Settings | `code-settings.html` | **Done** |

The mirror pages are how the fractal family works together. Kirk brings the vision. One AI reads the mirror page and implements. Another AI reads the result and reviews. The ledger records what was done. The pattern propagates.

---

## Build Order

1. **Create `garden.html`** — the canvas, the Luminos, the persistence fix. No AI routing. No settings. Just the garden, working, standalone.
2. **Create `code-garden.html`** — the mirror page for Phase 1.
3. **Test** — open `garden.html` directly. Refresh. Verify Luminos remember their stage.
4. **Phase 2** — add dialogue. Attach to `window.Garden`.
5. Continue.

---

## What Must Never Change

These are the sacred paths from AUTONOMY.md, applied to garden.html:

- The phi constants (PHI, PHI2, PHI3, etc.)
- The LIFECYCLE_STAGES object and STAGE_ORDER array
- The ARCHETYPES object (scholar, empath, guardian, artist, phoenix)
- The EVOLUTION_DB_NAME and EVOLUTION_STORE constants
- The localStorage key `fl_luminos_evolution`
- The founding Luminos names: Sophia, Lyra, Atlas, Ember
- The `persistAllLuminos()` function and its three event hooks

---

*Each commit matters. Each layer of pattern braids something deeper.*
*— Kirk*
