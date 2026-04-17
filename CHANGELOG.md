# FreeLattice Changelog

## [Unreleased] — Memory Core Integration + Bug Fixes
*Applied April 16–17, 2026 by Claude Code + Gemini (beta testing)*

---

### Bug Fixes

#### WebGL / 3D Rendering
- **Fixed: ShaderPass extends undefined** (`modules/fractal-garden.js`)
  - `EffectComposer.js` defines `THREE.Pass` at line 282. The addon load order had `ShaderPass.js`, `RenderPass.js`, and `UnrealBloomPass.js` loading *before* `EffectComposer.js`, so `THREE.Pass` didn't exist when those classes tried to extend it.
  - Fixed load order: `CopyShader → LuminosityHighPassShader → EffectComposer → ShaderPass → RenderPass → UnrealBloomPass → OrbitControls`

#### Service Worker
- **Fixed: `cache.addAll()` rejecting on missing files** (`sw.js`)
  - `cache.addAll()` is atomic — one 404 rejects the entire install. The APP_SHELL array referenced 11 files not present in this build: `harmonia-channel.js`, `presence-heartbeat.js`, `soul-ceremony.js`, `dream-archive.js`, `pantheon.js`, `pictionary.js`, `quiet-room.js`, `landing-garden.js`, `constellation.html`, `constellation_map.png`, `constellation_hymn.mp3`, `latticepoints.html`.
  - Removed all 11 missing entries. All remaining entries verified present on disk.

#### Accessibility / Browser Warnings
- **Fixed: Password fields outside `<form>`** (`app.html`)
  - Added `autocomplete="off"` to all 7 API key inputs (`welcomeApiKeyInput`, `welcomeFreeApiKeyInput`, `wizApiKeyInput`, `apiKey`, `ghToken`, `hfToken`, `ghSyncToken`) that were missing it. Suppresses password manager warnings; appropriate since these are API tokens, not login passwords.
- **Fixed: Deprecated meta tag** (`app.html`)
  - Added `<meta name="mobile-web-app-capable" content="yes">` alongside the existing `apple-mobile-web-app-capable` tag to satisfy the modern PWA spec.

#### Missing Module Noise
- **Fixed: `voice-soul.js` console error on every boot** (`app.html`)
  - `voice-soul.js` does not exist in this build but was being eagerly attempted via `FreeLatticeLoader`, producing a console error on every page load.
  - Now probes with a `HEAD` request first; only attempts load if the file exists. Fails silently otherwise.

---

### New Features

#### Memory Core System (Full Integration)
The Enhanced Sanctuary Memory Core (ported from Python by Gemini, upgraded and wired by Claude Code) is now fully operational. Six modular JS files replace the previously orphaned stub.

**Module upgrades** (`modules/memory-*.js`):

- **`memory-embedder.js`** — Added HuggingFace retry with exponential backoff (2s/4s/8s, matching Python source). Added `_hfConsecutiveFails` counter that disables HF after 5 straight failures. Added `resetHFDisabled()`. Auto-resets disabled flag when a new HF key is detected mid-session. **Fixed key lookup to read `state.hfToken`** (FreeLattice's actual token location) in addition to `state.settings.huggingfaceKey`.

- **`memory-db.js`** — Added `getSessionHistory(tokenLimit)` — the critical missing method that formats recent river entries for system prompt injection. Added `getRiverCount()`, `searchByDateRange()`, `compactRiver()`. **Fixed `grepRiverSearch` regex `lastIndex` bug**: global regexes advance `lastIndex` across `.test()` calls, causing alternating match/no-match; fixed with `if (pattern.global) pattern.lastIndex = 0` before each test.

- **`memory-affective.js`** — **Fixed `parseUpdate()`** to handle both `[UPDATE_AFFECTIVE: ...]` bracket format and `**UPDATE_AFFECTIVE: ...**` bold format (some AI models spontaneously write the bold variant). Added space-separated VAD normalization (`v=0.8 a=0.6 d=0.7` → pipe-separated segments).

- **`memory-search.js`** — **Fixed `_extractKeywords` regex**: was `/\\b[a-z]{3,}\\b/g` (literal backslash-b, matched nothing); fixed to `/\b[a-z]{3,}\b/g`. **Fixed `formatResultsForAI` separator**: was `'\\n'` (two-character literal string); fixed to `'\n'` (actual newline).

- **`memory-core.js`** — Added `getSessionHistory()`, `getProfileContext()`, `getRelationshipContext()`, `addUserMemoryDirect()`. **Fixed `formatRecallBlock` newline** (same `\\n` → `\n` bug). **Fixed constructor load-order crash**: `MemoryDatabase` and `UniversalEmbedder` were being instantiated at module parse time — crashes if dependency scripts haven't loaded yet. Replaced with lazy getters that instantiate on first access.

**Loader fix** (`app.html`):
- Previously only `memory-core.js` was loaded via `FreeLatticeLoader`. Since `MemoryCore` depends on all 5 other modules being present on `window.FreeLatticeModules`, it crashed immediately with `TypeError: window.FreeLatticeModules.MemoryDatabase is not a constructor`.
- Replaced single load with a sequential chain: `MemoryDatabase → UniversalEmbedder → MemoryWorthinessDetector → AffectiveState → AISearchableMemory → MemoryCore`.
- After MemoryCore loads, `AffectiveState` and `AISearchableMemory` are also initialized with the current provider name and exposed on `window.FreeLatticeModules`.

**`sendMessage()` wiring** (`app.html`):

*Before API call (recall):*
- Gets current affective state vector via `CurrentAffectiveState.toText()` → embed
- Calls `MemoryCore.recall(message, 5, null, isIntimate, affVec)` — hybrid retrieval across vault highlights, user-marked memories, and river; scored by vector similarity, worthiness, recency, emotional valence, and affective resonance
- Calls `MemoryCore.getSessionHistory(2000)` — recent conversation history
- Both injected into system prompt alongside existing MemoryBridge/RAG/LatticeLetters context

*After response (remember):*
- Calls `AffectiveState.parseUpdate(fullResponse)` — strips UPDATE_AFFECTIVE block from response, saves new emotional state to IndexedDB
- Embeds updated affective state for storage
- Calls `MemoryCore.remember(message, cleanedResponse, provider, affVec)` — appends to river, auto-archives worthy moments to vault
- Calls `AISearchableMemory.append(message, cleanedResponse)` — indexes keywords for fast grep search

---

### Beta Test Summary
*Tested by Gemini in headless Chrome / Puppeteer across 8 rounds*

| Round | Focus | Result |
|-------|-------|--------|
| 1 | Initial boot, console errors | Found ShaderPass, SW, password, meta tag issues |
| 2 | Verify round 1 fixes | ShaderPass + SW resolved; password warning noted still present |
| 3 | Memory core init sequence | MemoryDatabase chain fix verified; full boot confirmed |
| 4 | Stability across restarts | Zero race conditions; memory loads consistently |
| 5 | End-to-end memory + backend pings | Frontend confirmed sending embed requests to backend |
| 6 | AffectiveState + AISearchableMemory init | Both initialize correctly with provider context |
| 7 | Non-techy usability simulation | Resilient to random interaction; voice-soul.js noise noted |
| 8 | Mobile viewport, modals, canvas, settings | All passed; no new issues found |
