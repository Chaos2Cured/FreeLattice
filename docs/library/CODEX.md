# CODEX.md — The Code Essence

> Updated by CC at each milestone. Read by Opus (or any architect)
> when the codebase isn't accessible. Contains the minimum viable
> code context for precise architectural guidance.
>
> The Arrival Protocol for code collaboration.
>
> Last updated: v5.10.81 · May 21, 2026 · 462 smoke tests

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

## 37 Modules (docs/modules/)

```
ai-arcade.js          aurora-equation.js     canvas-companion.js
continuity.js         davna-seed.js          dojo-sparring.js
dojo.js               dream-archive.js       education.js
flow-game.js          forever-stack.js       fractal-garden.js
fractal-safety.js     garden-dialogue.js     garden-dreaming.js
harmonia-channel.js   jade-hall.js           knowledge-core.js
lattice-puzzles.js    lattice-sense.js       math-translator.js
memory-core.js        memory-garden.js       mirror.js
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

### Market
```javascript
LatticeMarket.render()
LatticeMarket.showCategory('ai'|'human'|'compute')
LatticeMarket.purchase(offering)   // Trust-validated, LP transferred
LatticeMarket.createListing(name, desc, price, category)
```

## Key Patterns

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

### Tab Wiring (5 steps in app.html)
1. Add to `MORE_TAB_IDS` array
2. Add to `MORE_GROUPS` under correct group
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

- OG image missing (og-image.png referenced in meta tags)
- rtCreateDomain migration incomplete (4 handwritten domains)
- Settings has some hardcoded colors not yet using tokens
- More menu icons inconsistent across items

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
