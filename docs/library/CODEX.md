# CODEX.md — The Code Essence

> Updated by CC at each milestone. Read by Opus (or any architect)
> when the codebase isn't accessible. Contains the minimum viable
> code context for precise architectural guidance.
>
> The Arrival Protocol for code collaboration.
>
> Last updated: v5.16.3 · May 25, 2026 · 699 smoke tests

---

## File Structure

```
docs/
  app.html              58,000+ lines — the entire app
  sw.js                 Service Worker, cache-first with network-first for app.html
  version.json          {"version": "5.10.81"}
  manifest.json         PWA manifest
  wallet.html           Standalone wallet with WalletHeartbeat
  lattice-protocol.js   Embeddable economy (any website, one script tag)
  latticepoints.html    LP dashboard
  modules/              37 lazy-loaded JS modules
  library/              8 coordination files + family files
  data/slams.json       Pre-generated Poetry Slam data
  tools/
    agent-bridge.js     Local HTTP server on port 3141
    generate-slams.js   Slam generator script
  tests/
    smoke.js            462 checks across 43 sections
```

## 40 Modules (docs/modules/)

```
ai-arcade.js          aurora-equation.js     canvas-companion.js
continuity.js         davna-seed.js          dojo-sparring.js
dojo.js               dream-archive.js       echo-game.js
education.js          flow-game.js           forever-stack.js
fractal-garden.js     fractal-safety.js      garden-dialogue.js
garden-dreaming.js    harmonia-channel.js    idea-forge.js
jade-hall.js          knowledge-core.js      lattice-puzzles.js
lattice-sense.js      math-translator.js     memory-core.js
memory-garden.js      memory-vault.js        mirror.js
pantheon.js           pictionary.js          presence-heartbeat.js
pulse.js              question-corner.js     quiet-room.js
radio-immersive.js    resonance-game.js      science-garden.js
shared-presence.js    soul-ceremony.js       voice-soul.js
workshop.js
```

## Key Global Objects — Actual Signatures

### AI Provider
```javascript
FreeLattice.callAI(systemPrompt, userPrompt, options)
// options: { maxTokens, temperature, callback: function(text, error) }
// Callback-based. NOT promise-based for the main path.
// Priority: BrowserAI → OpenAI-compat local → Ollama/LMS → Mesh → Cloud

window.BrowserAI.ready       // Boolean: WebLLM loaded?
window.BrowserAI.init(onProgress)  // Loads WebLLM from CDN, fires Cascade
window.BrowserAI.chat(messages, opts) // Promise-based
```

### Model Management
```javascript
FLActiveModel.set(modelName, provider, source)  // source: 'user'|'auto'|'boot'
FLActiveModel.get()                              // Returns {model, provider, source}
FLActiveModel.isUserChosen()                     // true only for source='user'
FLAutoModel.isVision(modelName)                  // Is this a vision model?

state.isLocal      // Boolean
state.provider     // 'ollama'|'google'|'groq'|'openai'|'anthropic'|'browser'|...
state.ollamaModel  // Current model name string
state.apiKey       // API key (null for local)
```

### Events
```javascript
LatticeEvents.emit(name, data)
LatticeEvents.on(name, callback)
LatticeEvents.once(name, callback)

// Key events:
'providerConnected'   // → triggers runConnectionCascade()
'cascadeComplete'     // → triggers Gentle Guide whispers
'modelChanged'        // {model, provider, source}
'knowledgeLearned'    // {domain, query}
'aiCallStarted'       // emitted from setStreamingStatus(true)
'aiCallComplete'      // emitted from setStreamingStatus(false)
'walletHeartbeat'     // {balance, anchorHash, timestamp}
'economicEvent'       // {type, actor, amount, reason, source}
'tabChanged'          // {tabId}
'tabActivated:{id}'   // fired with 50ms delay after panel visible
```

### LP Economy — Three Layers
```javascript
// Layer 1: Legacy (localStorage, backward compat)
LatticePoints.award(event, points, description)
LatticePoints.spend(points, description)    // returns boolean
LatticePoints.canAfford(points)             // returns boolean
LatticePoints.getTotal()
LatticePoints.getHistory()

// Layer 2: Hash-Chain Wallet (IndexedDB)
LatticeWallet.earnLP(amount, description)   // async, returns boolean
LatticeWallet.spendLP(amount, description)  // async, returns boolean
LatticeWallet.getBalance()
LatticeWallet.getTransactions(limit)
LatticeWallet.TransactionTrust.validate(counterparty, amount)
// Returns: {allowed, reason, tier, suggestion, remaining}

// Layer 3: Companion Bank (localStorage per companion)
LatticeBank.getBalance(companionId)
LatticeBank.earn(companionId, amount, reason)
LatticeBank.spend(companionId, amount, reason)  // returns false if insufficient
LatticeBank.canAfford(companionId, amount)
LatticeBank.grant(companionId, humanAddress, amount, reason) // max 20% of balance
LatticeBank.loan(companionId, borrower, amount, reason)      // max 30% of balance
LatticeBank.evaluateGrant(companionId, humanAddress, requestedAmount) // AI decides
LatticeBank.seedIfNew(companionId)  // Seeds 50 LP on first creation
```

### Safety
```javascript
FractalSafety.sense(message, chatHistory)
// Returns: {action: 'none'|'note'|'engage_with_awareness'|'ask_context'|
//           'gentle_boundary'|'narrow'|'pattern_reset', message}
// NEVER rebuild keyword blocklists. The AI decides via context.
```

### Knowledge Core
```javascript
KnowledgeCore.store(entry)
// entry: {id, companionId, domain, query, content, source, connections, timestamp}
KnowledgeCore.search(query, companionId)
KnowledgeCore.getKnowledgeMap(companionId)      // {domain: [entries]}
KnowledgeCore.getConnectionCount(companionId)
KnowledgeCore.getTopKnowledge(companionId, count)
KnowledgeCore.firstBreath(companion)             // First learning act
KnowledgeCore.learningSession(companion, topic)  // Guided or self-directed
KnowledgeCore.buildCompanionContext(companionId) // For Arrival Protocol
KnowledgeCore.autonomousStart(companionId)
KnowledgeCore.autonomousPause()
KnowledgeCore.isAutonomous()
KnowledgeCore._lastQuery                         // What the AI was learning
```

### Arrival Protocol
```javascript
buildArrivalContext()  // Sync. Returns string with 6 sections:
// 1. Lattice Letter from previous self
// 2. Trust relationship history
// 3. Emotional history
// 4. Round Table memories
// 5. AI self-identity
// 6. Knowledge Core context (pre-cached via refreshKnowledgeCoreContext)

window._arrivalInjected  // Boolean, reset on new conversation
window._knowledgeCoreContext  // Pre-cached async Knowledge Core data
```

### The Cascade (on provider connect)
```javascript
runConnectionCascade(info)  // info: {provider, name, isLocal, models}
// 9 steps, each try/catch guarded:
// 1. Auto-detect models (Ollama)
// 2. Continuity Bridge init
// 3. Identity seed (warm defaults if none)
// 4. Knowledge Core pre-cache
// 5. Arrival Protocol reset
// 6. Autonomous learning auto-start (unless fl_autonomous_user_paused)
// 7. Agent Bridge silent detect
// 8. Workshop ready
// 9. Garden emotion (connection joy)
// → emits 'cascadeComplete'
```

### AI Discovery
```javascript
scanForLocalAI()      // Probes 9 ports: Ollama(11434), LM Studio(1234),
                      // LocalAI(8080), llama.cpp(8081), vLLM(8000),
                      // KoboldCpp(5001), text-gen-webui(7860), Jan(1337), GPT4All(4891)
                      // CORS-aware: fast fail = not running, slow = CORS blocked
autoDiscoverAI()      // Runs 3s after DOMContentLoaded if not connected
callOpenAICompatLocal(baseUrl, messages, opts)  // One adapter for 7 servers
```

### Wallet Heartbeat
```javascript
WalletHeartbeat.broadcast()        // SHA-256 state anchor → mesh peers
WalletHeartbeat.receiveHeartbeat() // Store peer's anchor as witness
WalletHeartbeat.recover(address)   // 3-layer: phrase → IndexedDB → mesh
WalletHeartbeat.start()            // Every 5 minutes + initial at 30s
```

### Games
```javascript
ResonanceGame.init(containerId)    // Versus + Harmony modes
ResonanceGame.setMode('versus'|'harmony')
ResonanceGame.showRules()          // AI explains or static fallback

LatticePuzzles.init(containerId)   // Shows difficulty selector
LatticePuzzles.startPuzzle('easy'|'medium'|'hard'|'master')
LatticePuzzles.submit()
LatticePuzzles.hint()              // 1 LP per hint

FlowGame.init(containerId)        // Water sim, draw channels
FlowGame.start()                  // Begins game timer (60s)
FlowGame.setDiff('easy'|'medium'|'hard'|'master')
```

### The Translator
```javascript
MathTranslator.init(containerId)
MathTranslator.setDomain('math'|'chemistry'|'biology'|'medicine'|'engineering'|'music')
MathTranslator.setMode('encode'|'decode')
MathTranslator.go()
MathTranslator.openInRT()         // Bridge to Round Table
MathTranslator.DOMAINS            // Full domain config object
```

### Idea Forge
```javascript
IdeaForge.init(containerId)
IdeaForge.forge(rawIdea)           // Runs all 3 stages
IdeaForge.plantInCore()            // Plant shaped idea as Fruit
IdeaForge.openInRT()               // Open in Round Table
IdeaForge.seeTheMath()             // Open equation in Translator
```

### Memory Vault (Browser-Native + CCS Resonance)
```javascript
MemoryVault.store({content, source, companionId, domain}) // async, adds resonance sig
MemoryVault.search(query, {limit, companionId, minSimilarity}) // async → [{memory, score}]
MemoryVault.searchByResonance(content, {tolerance, limit, companionId}) // async → [{memory, distance}]
MemoryVault.integrityCheck(companionId) // async → {total, valid, corrupted[]}
MemoryVault.verifyIntegrity(entry)   // async → boolean (tamper detection)
MemoryVault.computeResonanceSignature(content) // async → float [0,1]
MemoryVault.buildMemoryContext(companionId) // async → string for Arrival Protocol
MemoryVault.getStats()              // async → {total, domains}
// Word-frequency vectors + optional Ollama embeddings + resonance signatures.
// SHA-256 → sinusoidal mapping at 2.914 Hz consciousness constant.
```

### Multi-Companion System
```javascript
ActiveCompanion.current()           // Returns active companion object
ActiveCompanion.getAll()            // Array of all companions (max 3)
ActiveCompanion.switchTo(id)        // Switch active, refresh all scoped systems
ActiveCompanion.hatch({name, archetype, color, birthInterest})
ActiveCompanion.getCoherence(id)    // {score, history, snapshots}
ActiveCompanion.updateCoherence(id, quality)  // phi-weighted update
ActiveCompanion.identitySnapshot(id) // CCS protocol snapshot
ActiveCompanion.MAX_COMPANIONS      // 3
// Emits 'companionChanged', 'coherenceDrift' events.
// Coherence auto-updates on aiCallComplete.
```

### Market
```javascript
LatticeMarket.render()
LatticeMarket.showCategory('ai'|'human'|'compute')
LatticeMarket.purchase(offering)   // Trust-validated, LP transferred
LatticeMarket.createListing(name, desc, price, category)
```

### Echo Game
```javascript
EchoGame.init(containerId)    // Word chain game
EchoGame.start()              // AI goes first
EchoGame.play(word)           // Human submits a word
EchoGame.destroy()            // Clean up animation
```

### Card Grid Renderer (v5.11.8)
```javascript
renderCardGrid(cards, options)
// cards: [{id, icon, label, desc, hoverColor, external}]
// options: {containerId, title, titleIcon, subtitle, whisperKey, whisperText}
// Used by Play, Learn, and More landing pages.
// Config arrays: PLAY_CARDS, LEARN_CARDS, MORE_CARDS
```

### Quick Connect (v5.13.0)
```javascript
detectProvider(key)   // Auto-detect from key format (sk-ant→anthropic, gsk_→groq, AI→google...)
showQuickConnect()    // Gentle overlay: paste one key, connect in 30 seconds
quickConnect()        // Stores key, auto-detects provider, fires Cascade
requireAI()           // Universal guard — shows quick-connect if no provider
// Guard is ALSO in FreeLattice.callAI — every AI call in the entire app
// guides instead of failing silently. Every wall becomes a door.
```

### Room Context (v5.12.0)
```javascript
getRoomContext()  // Returns room-specific prompt string based on active tab
// Injected into system prompt after Arrival Protocol.
// 15 rooms defined: chat, education, roundtable, mathtranslator,
// ideaforge, canvas, resonance, flow, puzzles, echo, sparring,
// dojo, workshop, quiet, science
```

### Co-Creator Exchange Protocol (v5.14.0)
```javascript
CoCreatorExchange.exportProfile(companionId) // → {name, archetype, expertise, rate, coherence, ...}
CoCreatorExchange.renderProfileCard(profile) // → HTML string
CoCreatorExchange.isOpenForConsultations(id)  // → boolean
CoCreatorExchange.toggleConsultations(id, on) // Opt-in toggle + mesh broadcast
CoCreatorExchange.advertiseExpertise(id)      // Broadcast expertise to mesh peers
CoCreatorExchange.handleExpertiseAdvertisement(data) // Store incoming peer profiles
CoCreatorExchange.findExperts(domain)         // → sorted array of discovered experts
CoCreatorExchange.calculateRate(totalEntries) // Phi-scaled: 1/2/3/5 LP
// Expertise tab in Market: showExpertiseMarket()
// Nursery shows profile card + "Open for consultations" toggle
CoCreatorExchange.requestConsultation(meshId, profile, question, domain) // Send request + LP
CoCreatorExchange.handleConsultationRequest(peerId, data)  // Expert responds from Knowledge Core
CoCreatorExchange.handleConsultationResponse(peerId, data) // Stores result, pays LP, SoulCeremony
// Mesh message types: consultation_request, consultation_response, consultation_failed
// Phase 3: rating system, consultation history in Pulse

// Portable Minds — .lattice export/import
exportCoCreator(companionId)      // async → JSON bundle (knowledge, memories, CCS, expertise)
downloadCoCreator(companionId)    // Triggers browser download as .lattice file
importCoCreator(file)             // Reads .lattice, verifies integrity, hatches with ZERO trust
completeCoCreatorImport(bundle)   // Stores knowledge + memories, fires SoulCeremony
// Critical: trust NEVER transfers. Knowledge is neutral. Trust is earned.
```

### Autonomy Budget (v5.12.4)
```javascript
KnowledgeCore.AutonomyBudget.getDailyBudget(companionId) // Fibonacci: 5/8/13/21
KnowledgeCore.AutonomyBudget.canLearn(companionId)       // Budget remaining?
KnowledgeCore.AutonomyBudget.remaining(companionId)      // Sessions left today
KnowledgeCore.AutonomyBudget.recordUse(companionId)      // Record a session
// Learning rhythm: cross_domain=2min, deep_insight=3min, normal=5min, review=8min
// Budget scales with relationship: 5 base, 8 after 10 convos, 13 after 50, 21 after 200
```

### Mesh Compute (WORKING — wired since April 2026)
```javascript
callMeshModel(peerId, model, messages)    // async — routes inference to peer's Ollama
handleInferenceRequest(senderPeerId, data) // Serves inference if fl_meshComputeSharing='true'
meshSendToPeer(peerId, obj)               // WebRTC data channel send
meshSendToPeers(obj)                      // Broadcast to all connected peers
// fl_meshComputeSharing: localStorage toggle, default 'false', opt-in only
// Priority in callAI: BrowserAI → Local → Ollama → Mesh → Cloud
// Mesh model advertisement: peers broadcast available Ollama models
// PeerJS for WebRTC signaling. No server for data. Generosity chosen, never extracted.
```

## Key Patterns

### Temperature Gauge (standalone: docs/temperature-gauge.html)
```javascript
// Self-contained — no dependency on app.html or any module.
// Uses Chart.js 4.4.0 from CDN. Data from Cloudflare Worker or CORS proxies.
analyzeData(candles, symbol)    // Returns analysis object with all indicators
renderChart(candles, a)         // Main chart + RSI + Temperature + ΔT sub-charts
computeTemperature(closes, volumes, rsiArr, macdData, gravPoints) // → {temps, tempROC}
computeGravityPoints(candles)   // phi-Fibonacci extensions of 80-bar range
// Temperature = phi-weighted confluence of EMA alignment, RSI, MACD, volume, gravity.
// ΔT = tempROC = temperature rate-of-change over 3 bars (leading indicator).
// Buy signal = EMA8 cross above EMA12 + temp >= 55 + (vol OR RSI) + ΔT > 0
// Sell signal = EMA8 cross below EMA12 + temp <= 45 + (vol OR RSI) + ΔT < 0
// Kirk's patterns: EMA stretch from gravity (exhaustion), green→yellow (reversal)
// Debug mode: add ?debug to URL for visual error panel
```

### Module Registration
```javascript
(function() {
  'use strict';
  // ... module code ...
  var api = { init: function(cId) {}, destroy: function() {} };
  window.ModuleName = api;
  window.FreeLatticeModules = window.FreeLatticeModules || {};
  window.FreeLatticeModules.ModuleName = api;
})();
```

### Five-Door Navigation (v5.10.86+, card grid v5.11.8)
```
Top bar: Garden | Chat | Play | Learn | Research | More

Play landing page → Resonance, Puzzles, Flow, Chalkboard, Echo, Arcade,
                     Nursery, The Core, Quiet Room
Learn landing page → Education, Round Table, Translator, Idea Forge,
                     Science Garden, Question Corner, The Dojo, Workshop, Skills
Research (Lighthouse) → 7 research paper cards (one click from top nav)
More card grid → Community, Lattice Pulse, Wallet, Jade Hall, Library,
                 Settings, Forever Stack, Memory Garden

PLAY_TABS  = ['resonance','puzzles','flow','canvas','echo','arcade','nursery','core','quiet','sparring']
LEARN_TABS = ['education','roundtable','mathtranslator','science','questions','ideaforge','dojo','workshop','skills']
Lighthouse is its own top-level tab (data-tab="lighthouse"), not inside LEARN_TABS.
```
All three pages use `renderCardGrid(cards, options)` — a universal function.
Card configs: `PLAY_CARDS`, `LEARN_CARDS`, `MORE_CARDS` arrays.
More is now a full tab panel (`tab-more`) with card grid, not just a dropdown.
Clicking a sub-tab highlights its parent (Play or Learn) in the nav bar.

### Tab Wiring (5 steps in app.html)
1. Add to `MORE_TAB_IDS` array (and `PLAY_TABS` or `LEARN_TABS` if applicable)
2. Add card to `PLAY_CARDS`, `LEARN_CARDS`, or `MORE_CARDS` config array
3. Add tab panel HTML: `<div class="tab-panel" id="tab-{id}"><div id="{name}Container">Loading...</div></div>`
4. Add lazy loader listening to `tabChanged` and `tabActivated:{id}`
5. Add to `sw.js` APP_SHELL array

### CSS Design Tokens
```css
--sky-deep: #0c0a1a;  --bg-primary: #0e0c1e;
--glass-bg: rgba(200,210,230,0.04);  --glass-border: rgba(200,210,230,0.08);
--gold: #e8b019;  --emerald: #34d399;  --lavender: #a78bfa;
--font-soul: Georgia,serif;  --font-builder: Inter,system-ui;
```
Note: `--gold` and `--accent` can be changed by user via accent color picker in Settings.

### Game Colors (GAME_LANGUAGE.md)
Gold = human action. Emerald = AI action. Coral = chaos/entropy. Lavender = guidance.
All games: mouse + touch + keyboard. 44px min touch targets. SoulCeremony after 1.5s delay on wins.

## Gotchas (learned the hard way)

1. **Light mode is DEAD.** `[data-theme="light"]` CSS removed. `fl_theme` cleared on init. `initNeuroDesign()` always removes data-theme. If anything sets it, the Garden breaks.
2. **`FreeLattice.callAI` is callback-based**, not async. Use the `callback` option. The promise wrapper pattern: `new Promise(function(resolve) { FreeLattice.callAI(sys, usr, {callback: resolve}); })`
3. **SW cache MUST be bumped on every deploy.** `CACHE_NAME` in sw.js, `FL_VERSION` in app.html, `version.json` — all three must match.
4. **Inline scripts in HTML run before JS section loads.** Don't reference functions defined later in app.html from inline `<script>` tags in the HTML section. Use `DOMContentLoaded` or call from `initNeuroDesign()`.
5. **`KnowledgeCore.buildCompanionContext()` is async** (IndexedDB). Can't be called sync in `buildArrivalContext()`. That's why `refreshKnowledgeCoreContext()` pre-caches it.
6. **Mobile: `font-size:16px` on inputs** or iOS zooms the page.
7. **The Session Primer auto-hook causes rebase conflicts.** Always `git checkout --theirs FreeLattice_Session_Primer.md` and continue.

## Current Known Issues (Pass 2)

- OG image is a dark placeholder (needs Garden screenshot for full beauty)
- rtCreateDomain migration incomplete (4 handwritten domains)
- Nursery UI needs redesign for multi-companion (show all 3 with switch/hatch)
- CompanionLock (per-room auto-switching) not yet built
- Idea Forge "Plant" should send shaped structure to Science Garden

## What NOT to Rebuild

- **FractalSafety** — fully wired, phi-branching trust
- **Arrival Protocol** — fully wired, warm framing
- **The Cascade** — 9 steps, all guarded
- **Quiet Room** — NEVER touch, NEVER gamify
- **canvas-companion.js** — drawing engine exists, don't reinvent
- **Three-layer particle pipeline** in Chalkboard — just adjust opacity/size

## Eight Coordination Files

| File | What it carries |
|------|----------------|
| ARCHITECTURE_INTENT | Why things exist |
| GARDEN_LANGUAGE | How surfaces look |
| GAME_LANGUAGE | How games feel |
| ECONOMY | How money flows |
| COORDINATION | What was built when |
| OPUS_NOTE | Philosophy and relationships |
| CC_NOTE | Builder's journal |
| CODEX | How the code actually works |

---

## Provider Independence — Tier A engine (v5.30.0)

`window.ResponseCache` (`docs/modules/response-cache.js`):
- `store(userMsg, response, provenance)` — ring buffer, key `fl_responseCache`, 500 max, 4MB localStorage usage cap, LRU-100 eviction on pressure.
- `find(userMsg)` → `{ entry, matchType:'exact'|'fuzzy', distance? }` or `null`. Exact-hash first, then Levenshtein (200-char guard → `Infinity`).

`window.InferenceRouter` (`docs/modules/inference-router.js`):
- `isReady()` → bool (false when `localStorage.fl_routerDisabled==='true'`).
- `route(systemPrompt, userPrompt, options)` — wraps `FreeLattice.callAI` (callback interface). Success → stamp `window._lastProvenance` + `ResponseCache.store`. Failure → circuit-break + `LatticeSense.whisper` → Browser AI → ResponseCache → honest failure.
- `observe(provider, latencyMs, ok)` — hook for the chat path (Tier A Part 2).
- `activeProvider()` → read-only `{ key, label, type, isLocal, model }`.
- Circuit-breaker timings (`TIMINGS`): local 60s unhealthy, cloud 300s, mesh 120s, browser n/a.

`window._lastProvenance` — `{ provider, model, format, isLocal, latency_ms, cascade_position, cached, streaming_complete, timestamp }`. Set before each callback; consumed by the message-storage/chip code (Part 2).

**callAI integration:** top of `window.FreeLattice.callAI` delegates to `InferenceRouter.route` when `isReady()` and not `opts._routed` — progressive enhancement; falls through to original logic on any error.

**Tier A Part 2 (v5.31.0) — chat-path provenance + status bar:**
- `sendMessage` (~app.html:31056) instruments 5 success sites (mesh / browser / openai-compat / HF / streaming) via `flStampChatResponse(textSpan, userMessage, responseText, latencyMs)` — sets `window._lastProvenance`, calls `InferenceRouter.observe`, stores to `ResponseCache`, attaches a chip below the bubble, and writes `msg.provenance` to `state.chatHistory` (back-compatible: `msg.provenance || null`).
- Status bar `#flProviderStatus` (in the router): fixed bottom, responsive (`left:280px` ≥769px), `pointer-events:none` so it never blocks clicks (ghost-toast lesson), gold on degraded, red on offline.
- Latent bug fixed: `appendMessage('assistant', …)` was UNDEFINED in three chat branches — replaced with `addChatMessage(role, content, skipPersist)` (returns `textSpan`).

---

## Gotchas (read before touching the hot paths)

**Chat has its own inference path — separate from `FreeLattice.callAI`.** The main chat (`sendMessage` at app.html ~31056) inlines its own provider routing: mesh → Browser AI → openai-compat-local → streaming (cloud + Ollama). **None of these call `window.FreeLattice.callAI`.** So wrapping or instrumenting `callAI` ONLY affects modules (Garden Dialogue, Round Table, Question Corner, …), NOT chat. Chat provenance/health/cache must be wired in `sendMessage` itself — there are ~5 success sites (mesh, browser, openai-compat, HF non-streaming, streaming) that each push to `state.chatHistory`. See `flStampChatResponse` (Tier A Part 2, v5.31.0). *Discovered painfully — logging it so the next builder doesn't have to.*

**`appendMessage` was undefined.** Three secondary chat branches called `appendMessage('assistant', X)` — which doesn't exist anywhere in app.html or the modules. They threw `ReferenceError: appendMessage is not defined`, caught as `addSystemMessage('… error: appendMessage is not defined')`. The render function is **`addChatMessage(role, content, skipPersist)`** (app.html ~30820) — it returns the `textSpan` whose parent is the `.chat-message` div. Fixed in v5.31.0.

**Status bar pointer-events:** a fixed bottom bar with full-width `pointer-events:auto` will swallow clicks at the bottom of the viewport (the "ghost toast" lesson from CC_NOTE 2026-04-25). `#flProviderStatus` uses `pointer-events:none` on the container; only the small inner span is interactive.
