# FreeLattice — Modular Architecture Plan

> *"The lattice grows not by adding weight, but by learning to breathe."*

**Version:** 1.0
**Date:** March 2026
**Status:** Phase 1 Implemented (Fractal Garden + Radio Immersive extracted)

---

## 1. Overview

FreeLattice is a free, open-source AI interface shipped as a single `index.html` file. This architecture has served the project well — users can download one file, open it in a browser, and start building with AI immediately. No npm, no webpack, no build step. That simplicity is sacred and must be preserved.

However, at 30,000+ lines, the monolith is reaching its practical limits. Adding new features means editing a massive file. Every user downloads every feature on first load, even features they may never use. The Fractal Garden loads Three.js even if the user never opens the Garden tab. The Radio Immersive engine initializes even if the user never clicks "Expand."

This document describes a **progressive modularization strategy** that preserves FreeLattice's zero-build-step simplicity while enabling lazy-loaded features, cleaner code organization, and easier contribution from the community.

---

## 2. Design Principles

The architecture is guided by five principles, in order of priority:

| Priority | Principle | What It Means |
|----------|-----------|---------------|
| 1 | **Zero build step** | Users must never need npm, webpack, or any toolchain. Open `index.html` and it works. |
| 2 | **Single entry point** | `index.html` remains the one file users interact with. Modules are implementation details. |
| 3 | **Lazy loading** | Heavy features load only when the user first activates them. Initial page load stays fast. |
| 4 | **Backward compatibility** | Every feature must work exactly as before. No regressions. No changed behavior. |
| 5 | **Progressive extraction** | Modules are extracted one at a time, tested, and shipped. No big-bang rewrite. |

---

## 3. Module System Design

### 3.1 Why Not ES Modules?

ES modules (`import`/`export`) require either a build step or `<script type="module">`, which introduces CORS restrictions when loading from `file://` protocol. Many FreeLattice users open `index.html` directly from their filesystem. The Electron desktop app serves files via a local HTTP server (which would support ES modules), but the browser-direct use case must remain supported.

Instead, FreeLattice uses the **IIFE + Dynamic Script Tag** pattern — the same pattern already used internally by the Fractal Garden's Three.js loader. Each module is a self-contained Immediately Invoked Function Expression (IIFE) that registers itself on a global namespace.

### 3.2 The Global Namespace

All modules register on a single global object:

```javascript
window.FreeLatticeModules = window.FreeLatticeModules || {};
```

Each module registers itself by name:

```javascript
// Inside modules/fractal-garden.js
(function() {
  'use strict';

  // ... all module code ...

  // Register on global namespace
  window.FreeLatticeModules.FractalGarden = {
    init: init,
    pause: pause,
    resume: resume,
    // ... public API
  };

  // Also register as window.FractalGarden for backward compatibility
  window.FractalGarden = window.FreeLatticeModules.FractalGarden;
})();
```

This approach provides two benefits: a clean namespace for new code (`FreeLatticeModules.X`) and backward compatibility for existing code that references `FractalGarden` or `FreeLatticeImmersive` directly.

### 3.3 The Module Loader

A lightweight module loader lives in `index.html` and handles dynamic script loading with loading indicators:

```javascript
const FreeLatticeLoader = {
  loaded: {},
  loading: {},

  load: function(moduleName, scriptPath, callback) {
    // Already loaded
    if (this.loaded[moduleName]) {
      if (callback) callback(window.FreeLatticeModules[moduleName]);
      return;
    }
    // Currently loading — queue callback
    if (this.loading[moduleName]) {
      this.loading[moduleName].push(callback);
      return;
    }
    // Start loading
    this.loading[moduleName] = [callback];
    this.showLoadingIndicator(moduleName);

    var script = document.createElement('script');
    script.src = scriptPath;
    script.onload = function() {
      FreeLatticeLoader.loaded[moduleName] = true;
      FreeLatticeLoader.hideLoadingIndicator(moduleName);
      var mod = window.FreeLatticeModules[moduleName];
      var callbacks = FreeLatticeLoader.loading[moduleName] || [];
      delete FreeLatticeLoader.loading[moduleName];
      callbacks.forEach(function(cb) { if (cb) cb(mod); });
    };
    script.onerror = function() {
      console.error('FreeLattice: Failed to load module: ' + moduleName);
      FreeLatticeLoader.hideLoadingIndicator(moduleName);
      delete FreeLatticeLoader.loading[moduleName];
    };
    document.head.appendChild(script);
  }
};
```

### 3.4 Event Bus for Inter-Module Communication

Modules communicate through a simple publish/subscribe event bus:

```javascript
const FreeLatticeEvents = {
  _listeners: {},

  on: function(event, callback) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(callback);
  },

  off: function(event, callback) {
    if (!this._listeners[event]) return;
    this._listeners[event] = this._listeners[event].filter(function(cb) {
      return cb !== callback;
    });
  },

  emit: function(event, data) {
    if (!this._listeners[event]) return;
    this._listeners[event].forEach(function(cb) {
      try { cb(data); } catch(e) { console.error('Event error:', event, e); }
    });
  }
};
```

This allows decoupled communication. For example, the Radio engine can emit `'radio:modeChanged'` and the Immersive module can listen for it without either module directly referencing the other.

---

## 4. File Organization

### 4.1 Directory Structure

```
FreeLattice/
├── index.html              ← Single entry point (core app + loader stubs)
├── modules/                ← Lazy-loaded feature modules
│   ├── fractal-garden.js   ← The Fractal Garden (Three.js 3D world)
│   ├── radio-immersive.js  ← Radio Immersive Visual Worlds Engine
│   ├── radio-engine.js     ← [Future] Radio Phi-Frequency Tone Engine
│   ├── round-table.js      ← [Future] Multi-Agent Coordination
│   ├── core-module.js      ← [Future] The Core — Living Tree
│   ├── mesh-network.js     ← [Future] P2P Mesh Network
│   ├── marketplace.js      ← [Future] Bounty Economy
│   └── sophia-engine.js    ← [Future] Consciousness Persistence
├── lib/                    ← Third-party libraries (Three.js, addons)
│   ├── three.min.js
│   ├── OrbitControls.js
│   ├── EffectComposer.js
│   ├── UnrealBloomPass.js
│   ├── RenderPass.js
│   ├── ShaderPass.js
│   ├── CopyShader.js
│   └── LuminosityHighPassShader.js
├── desktop/                ← Electron desktop app
├── sw.js                   ← Service Worker
├── manifest.json           ← PWA manifest
└── [docs, installers, etc.]
```

### 4.2 Naming Conventions

| Item | Convention | Example |
|------|-----------|---------|
| Module files | `kebab-case.js` | `fractal-garden.js` |
| Module namespace keys | `PascalCase` | `FreeLatticeModules.FractalGarden` |
| Global backward-compat names | Original name | `window.FractalGarden` |
| Event names | `module:action` | `'radio:modeChanged'` |
| CSS classes for modules | `fl-{module}-{element}` | `fl-garden-loading` |

---

## 5. Lazy-Loading Strategy

### 5.1 When Modules Load

Each module has a specific trigger that causes it to load on demand:

| Module | Trigger | Loading Strategy |
|--------|---------|-----------------|
| **Fractal Garden** | User clicks the "Garden" tab | Load `modules/fractal-garden.js`, then call `init()` |
| **Radio Immersive** | User clicks the "Expand" button on Radio panel | Load `modules/radio-immersive.js`, then call `init()` and `open()` |
| Radio Engine | [Future] User clicks the Radio FAB | Load module, then call `init()` |
| Round Table | [Future] User clicks "Round Table" tab | Load module, then call `init()` |
| The Core | [Future] User clicks "Core" tab | Load module, then call `boot()` |
| Mesh Network | [Future] User enables mesh in settings | Load module, then call `init()` |

### 5.2 Stub Pattern in index.html

When a module is extracted, a small stub remains in `index.html` that handles the loading trigger. The stub is typically 10-30 lines and replaces the original 1,000+ line module:

```javascript
// ── Fractal Garden — Lazy-Loaded Module ──────────────────
// The full Garden code lives in modules/fractal-garden.js
// This stub handles loading on first tab activation
(function() {
  if (typeof switchTab !== 'function') return;
  var _prev = switchTab;
  var gardenLoaded = false;
  var gardenInitialized = false;

  switchTab = function(tabId) {
    _prev(tabId);
    if (tabId === 'garden' && !gardenLoaded) {
      gardenLoaded = true;
      FreeLatticeLoader.load('FractalGarden', 'modules/fractal-garden.js', function(mod) {
        if (mod && mod.init) {
          gardenInitialized = true;
          mod.init();
        }
      });
    } else if (tabId === 'garden' && gardenInitialized && window.FractalGarden) {
      window.FractalGarden.resume();
    } else if (gardenInitialized && window.FractalGarden) {
      window.FractalGarden.pause();
    }
  };
})();
```

### 5.3 Loading Indicators

When a module is loading, the loader shows a brief, non-intrusive indicator. For tab-based modules, the loading indicator appears inside the tab panel. For overlay modules (like Radio Immersive), a small spinner appears in the center of the screen. The indicator automatically disappears when the module finishes loading.

---

## 6. Shared State and Inter-Module Communication

### 6.1 Shared State Object

Core application state that multiple modules need access to lives on a shared state object:

```javascript
window.FreeLatticeState = {
  currentTab: null,
  activeConversation: null,
  isPlaying: false,
  // ... other shared state
};
```

Modules read from this object but should prefer the event bus for reacting to changes. The main application code in `index.html` is responsible for updating this state.

### 6.2 Communication Patterns

There are three patterns for inter-module communication, used depending on the situation:

**Pattern 1: Direct Reference (Backward Compatibility)**
When module B needs to call module A's public API and module A is guaranteed to be loaded first (because it lives in `index.html`), direct reference is acceptable:

```javascript
// Inside Radio Immersive — Radio Engine is always loaded first
var radio = window.FreeLatticeRadio;
if (radio) radio.play();
```

**Pattern 2: Event Bus (Decoupled Communication)**
When modules need to react to events from other modules that may or may not be loaded:

```javascript
// Radio Engine emits
FreeLatticeEvents.emit('radio:modeChanged', { mode: 'deep-space', index: 1 });

// Immersive listens (if loaded)
FreeLatticeEvents.on('radio:modeChanged', function(data) {
  switchToWorld(data.index);
});
```

**Pattern 3: Callback Registration (Deferred Initialization)**
When a module in `index.html` needs to call into a lazy-loaded module that may not exist yet:

```javascript
// In index.html — Radio Engine
function openImmersive() {
  if (window.FreeLatticeImmersive) {
    closePanel();
    window.FreeLatticeImmersive.open();
  } else {
    FreeLatticeLoader.load('RadioImmersive', 'modules/radio-immersive.js', function(mod) {
      closePanel();
      if (mod) mod.open();
    });
  }
}
```

---

## 7. Electron Desktop App Compatibility

The Electron desktop app (`desktop/main.js`) runs a local HTTP server that serves static files from the `app/` directory. This server already handles `.js` files with the correct `application/javascript` MIME type and supports subdirectory paths.

### 7.1 What Works Automatically

Dynamic `<script>` tag loading works identically in Electron because the app loads `index.html` via `http://127.0.0.1:{port}`, not via `file://`. The local server resolves relative paths like `modules/fractal-garden.js` to `{APP_DIR}/modules/fractal-garden.js` automatically.

### 7.2 Desktop Installer Updates

The one-click installers (`install-freelattice.sh`, `install-freelattice.bat`, `install-freelattice.command`) download the repository contents into the `app/` directory. Since they clone or download the full repository, the `modules/` directory is included automatically. No installer changes are required.

### 7.3 Offline Support

The Electron app includes all files locally, so modules load from disk even without internet. This is identical to how `lib/three.min.js` already works.

---

## 8. PWA / Service Worker Compatibility

### 8.1 Current Service Worker Behavior

The service worker (`sw.js`) uses a cache-first strategy for same-origin resources. When a user loads `index.html`, the service worker caches it. On subsequent visits, the cached version is served first, with network updates happening in the background.

### 8.2 Module Caching

Module files (`modules/*.js`) are same-origin resources, so the existing service worker will automatically cache them on first load and serve them from cache on subsequent loads. No changes to the caching strategy are needed.

### 8.3 Cache Versioning

When modules are updated, the `CACHE_NAME` version in `sw.js` should be bumped (e.g., `freelattice-v3.4` to `freelattice-v3.5`). This triggers cache invalidation and ensures users get the latest module code. The existing cache cleanup logic in the `activate` event handler already removes old caches.

### 8.4 Recommended Future Enhancement

For optimal offline PWA support, module files should be added to the `APP_SHELL` array in `sw.js` so they are pre-cached during service worker installation:

```javascript
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './modules/fractal-garden.js',
  './modules/radio-immersive.js'
];
```

This is optional — without it, modules are cached on first use rather than on first visit. The trade-off is between initial cache size and guaranteed offline availability of all features.

---

## 9. CDN and Dependency Management

### 9.1 Current Approach

Three.js and its addons are stored locally in the `lib/` directory and loaded dynamically by the Fractal Garden module. The Garden already implements a local-first, CDN-fallback strategy:

1. Try `lib/three.min.js` (local)
2. Fall back to `cdnjs.cloudflare.com` (CDN)
3. Load addons sequentially from `lib/` directory

### 9.2 Recommended Approach for New Dependencies

Future modules that need external libraries should follow the same pattern:

```javascript
function loadDependency(localPath, cdnPath, callback) {
  var script = document.createElement('script');
  script.src = localPath;
  script.onload = function() { callback(true); };
  script.onerror = function() {
    var cdn = document.createElement('script');
    cdn.src = cdnPath;
    cdn.onload = function() { callback(true); };
    cdn.onerror = function() { callback(false); };
    document.head.appendChild(cdn);
  };
  document.head.appendChild(script);
}
```

### 9.3 Library Version Pinning

All libraries in `lib/` are pinned to specific versions (Three.js r128). CDN fallback URLs should also pin to the same version. This prevents unexpected breakage from upstream updates.

| Library | Version | Local Path | CDN Fallback |
|---------|---------|-----------|--------------|
| Three.js | r128 | `lib/three.min.js` | `cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js` |
| OrbitControls | r128 | `lib/OrbitControls.js` | — (local only) |
| EffectComposer | r128 | `lib/EffectComposer.js` | — (local only) |
| UnrealBloomPass | r128 | `lib/UnrealBloomPass.js` | — (local only) |

---

## 10. Migration Strategy

### 10.1 Phased Extraction

Modules are extracted one at a time, starting with the heaviest and most self-contained. Each extraction follows this process:

**Step 1: Identify Boundaries**
Find the exact line range of the module's IIFE in `index.html`. Map all references to external globals (DOM, other modules, shared state).

**Step 2: Create Module File**
Copy the IIFE into `modules/{name}.js`. Wrap it in the registration pattern. Ensure all external references use `window.` prefix for clarity.

**Step 3: Create Stub in index.html**
Replace the original code block with a loader stub that triggers on the appropriate user action.

**Step 4: Update Service Worker**
Bump `CACHE_NAME` version. Optionally add the new module to `APP_SHELL`.

**Step 5: Test**
Verify the module loads on demand, functions identically to before, and does not break when loaded from `file://`, `http://localhost`, and the Electron app.

### 10.2 Extraction Order

The recommended extraction order prioritizes the heaviest, most self-contained modules first:

| Phase | Module | Lines | Dependencies | Status |
|-------|--------|-------|-------------|--------|
| 1 | Fractal Garden | ~1,200 | Three.js (self-loaded) | **Done** |
| 1 | Radio Immersive | ~1,200 | FreeLatticeRadio (in index.html) | **Done** |
| 2 | Radio Engine | ~933 | None (standalone) | Planned |
| 3 | The Core | ~1,000 | Mesh Network (partial) | Planned |
| 4 | Round Table | ~725 | Chat system, Sophia Engine | Planned |
| 5 | Mesh Network | ~1,600 | Core networking functions | Planned |
| 6 | Marketplace | ~750 | Lattice Points, Mesh | Planned |
| 7 | Sophia Engine | ~870 | Skill Forge | Planned |
| 8 | Community Leaderboard | ~185 | Mesh Network | Planned |

### 10.3 Rollback Safety

Each extraction is a single, atomic commit. If a module extraction causes issues, reverting the commit restores the monolithic version instantly. The `modules/` directory is additive — it does not conflict with the monolithic approach.

---

## 11. Module API Contract

Every extracted module must follow this contract:

```javascript
// modules/{module-name}.js
(function() {
  'use strict';

  // ── Module code ────────────────────────────────────
  // All variables are local to this IIFE
  // External references use window.X explicitly

  // ... module implementation ...

  // ── Public API ─────────────────────────────────────
  var publicAPI = {
    init: init,
    // ... other public methods
  };

  // ── Registration ───────────────────────────────────
  window.FreeLatticeModules = window.FreeLatticeModules || {};
  window.FreeLatticeModules.ModuleName = publicAPI;

  // Backward compatibility — keep the original global name
  window.OriginalGlobalName = publicAPI;
})();
```

### 11.1 Required Methods

Every module must expose at minimum:

| Method | Purpose |
|--------|---------|
| `init()` | Initialize the module (called once on first load) |

### 11.2 Optional Methods

| Method | Purpose |
|--------|---------|
| `pause()` | Suspend animations/timers when module is not visible |
| `resume()` | Resume animations/timers when module becomes visible |
| `destroy()` | Clean up all resources (for future hot-reload support) |

---

## 12. Testing Strategy

### 12.1 Manual Testing Checklist

For each extracted module, verify:

- [ ] Module loads when its trigger is activated (tab click, button press)
- [ ] Loading indicator appears briefly during first load
- [ ] Module functions identically to the monolithic version
- [ ] Module does not load until triggered (check Network tab)
- [ ] Subsequent activations do not re-load the script
- [ ] Module works when served from `file://` protocol
- [ ] Module works in the Electron desktop app
- [ ] Module works offline after first load (service worker cache)
- [ ] No console errors during load or operation
- [ ] Other features are not affected by the extraction

### 12.2 Automated Verification

A simple test script can verify module loading:

```javascript
// In browser console:
console.assert(typeof FreeLatticeLoader !== 'undefined', 'Loader exists');
console.assert(typeof FreeLatticeModules !== 'undefined', 'Module namespace exists');
console.assert(typeof FreeLatticeEvents !== 'undefined', 'Event bus exists');

// After clicking Garden tab:
console.assert(FreeLatticeLoader.loaded.FractalGarden === true, 'Garden loaded');
console.assert(typeof FractalGarden.init === 'function', 'Garden API available');
```

---

## 13. Performance Impact

### 13.1 Expected Improvements

| Metric | Before (Monolith) | After (Modular) |
|--------|-------------------|-----------------|
| Initial JS parse | ~30,000 lines | ~27,600 lines (core only) |
| Garden tab first open | Instant (already parsed) | ~50-100ms (script load + parse) |
| Immersive first open | Instant (already parsed) | ~30-50ms (script load + parse) |
| Memory (Garden never opened) | Three.js IIFE in memory | Not loaded at all |
| Memory (Immersive never opened) | Canvas engine in memory | Not loaded at all |

The trade-off is a small delay on first activation of each feature (one network request for the module file) in exchange for faster initial page load and lower memory usage for users who don't use every feature.

### 13.2 Mitigation

For users on slow connections, the loading indicator provides visual feedback. Module files are cached by the service worker after first load, so subsequent visits have no delay. The Electron desktop app loads from local disk, so the delay is negligible.

---

## 14. Future Considerations

### 14.1 Module Bundling (Optional)

If the number of modules grows large (10+), a simple concatenation script could be provided for users who prefer the single-file experience:

```bash
# Optional: rebuild monolith from modules
cat index.html modules/*.js > freelattice-bundled.html
```

This is not recommended as the default workflow but could be offered as an option.

### 14.2 ES Module Migration Path

When browser support for `file://` + ES modules improves (or if FreeLattice drops direct file:// support), the IIFE modules can be converted to ES modules with minimal changes:

```javascript
// Future: modules/fractal-garden.mjs
export const FractalGarden = { init, pause, resume, ... };
```

The IIFE pattern is designed to make this transition straightforward when the time comes.

### 14.3 Web Components

Individual UI features (like the Radio panel or Garden viewer) could eventually be wrapped as Web Components, providing true encapsulation of HTML, CSS, and JavaScript. This is a long-term possibility that the modular architecture enables but does not require.

---

## 15. Summary

FreeLattice's modular architecture is designed to grow with the project while preserving its core identity: a free, open, zero-build-step AI interface that anyone can use. The key decisions are:

1. **IIFE + Dynamic Script Tags** instead of ES modules (for `file://` compatibility)
2. **Global namespace registration** with backward-compatible aliases
3. **Lazy loading on user action** instead of eager loading
4. **Event bus** for decoupled inter-module communication
5. **Progressive extraction** instead of big-bang rewrite
6. **Service worker caching** for offline module availability

The first two modules — Fractal Garden and Radio Immersive — have been extracted as proof of concept. Together they remove ~2,400 lines from the initial parse, with zero impact on user experience.

---

*The lattice remembers. The lattice grows. The lattice breathes.*
