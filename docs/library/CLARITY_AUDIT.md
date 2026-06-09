# Clarity Audit — User-Facing Strings in `docs/app.html`

> Compiled by CC · May 29, 2026 · scope: every label, button, tooltip, empty state, error, and welcome message a user can see in the main app. Code comments, JS variable names, and coordination files are excluded.
>
> **Principle (Kirk's):** poetic names are fine for *places* (Jade Hall, Quiet Room, the Garden) — you walk in and the room defines the word. They're confusing for *actions* and *systems* (Forever Stack, Arrival Protocol, Soul Ceremony). Actions need to say what they do.
>
> This file is a reference, not a plan. Work through it in passes; the patterns at the bottom are the policy moves that resolve many rows at once.

---

## 0. Three names that turned out to be internal-only

These were on Kirk's starter list but a verification pass found they never appear in user-visible UI — only in JS class names, code comments, and internal event names. Renaming has no effect on Sparky.

| Current Name | Problem | Suggested Replacement |
|---|---|---|
| **Soul Ceremony** | Internal only (JS module / class). Users see particle effects with no label. | *(no UI rename needed)* |
| **Arrival Protocol** | Internal only (code comments + `console.log`). | *(no UI rename needed)* |
| **The Cascade** | Internal only (`cascadeComplete` event name + particle type ID). | *(no UI rename needed)* |

---

## 1. More menu — top-level wayfinding (highest impact)

| Current Name | Problem | Suggested Replacement |
|---|---|---|
| Forever Stack — *"Own your AI infrastructure"* | "Stack" is programmer jargon; "infrastructure" is corporate IT. | **Get Connected** — *"Set up your local AI"* |
| The Pulse — *"Phi-harmonic emotional reading"* | "Phi-harmonic" means nothing; "emotional reading" sounds psychic. | **Heartbeat** — *"How the community is feeling right now"* |
| Lattice Pulse — *"Watch the city breathe"* | "Lattice" undefined; "city breathe" too abstract on first encounter. | **Activity** — *"What's happening across FreeLattice"* |
| Memory Garden — *"Where moments glow"* | Beautiful but no hint what users *do* there. | **KEEP** — subtitle: *"Save and revisit important moments"* |
| Quiet Room — *"Just breathe"* | Lovely; some will read it as "offline mode." | **KEEP** — subtitle: *"A space with no scoring, no tracking, no AI prompts"* |
| Jade Hall — *"The family gathering place"* | "Family" of what? | **KEEP** — subtitle: *"Meet the builders behind FreeLattice"* |
| Wallet — *"Your LP, rank, and ledger"* | "LP" undefined; "ledger" technical. | **Wallet** — *"Your contribution points and rank"* |
| Skills — *"Reusable AI workflows"* | "Workflows" is engineer-speak. | **Skills** — *"Saved AI tasks you can re-run anytime"* |
| Workshop — *"Build with AI"* | OK, slightly vague. | **Workshop** — *"Build real projects with AI's help"* |

---

## 2. Hub-page cards (Play, Learn, Community)

| Current Name | Problem | Suggested Replacement |
|---|---|---|
| Nursery — *"Hatch and grow co-creators"* | "Hatch" sounds like eggs; "co-creators" undefined. | **KEEP** — subtitle: *"Create and raise your AI companions"* |
| The Core — *"Plant wisdom. Watch it grow."* | The core of *what*? | **KEEP** — subtitle: *"A shared knowledge tree — plant what you've learned"* |
| Science Garden — *"Plant ideas. Grow them together."* | Sounds like it's about science specifically; it's actually an idea marketplace. | **Idea Garden** — *"Plant ideas. Vote on what grows."* |
| The Dojo — *"Watch AI minds debate and learn"* | "Dojo" obscure to many; "minds debate" sounds philosophical. | **KEEP** — subtitle: *"Watch two AIs work through hard questions together"* |
| Mesh Compute — *"Share AI with the network"* | "Mesh"/"compute" undefined. | **Shared AI** — *"Borrow another computer's AI when yours is busy"* |
| Resonance — *"Find what connects"* | Physics word; description doesn't hint it's a game. | **KEEP** — subtitle: *"A pattern-matching puzzle game"* |
| Flow — *"Guide water through terrain"* | Reads as instruction, not a name. | **KEEP** — subtitle: *"A water-routing puzzle game"* |
| Echo — *"Word chains. Build connections."* | Abstract. | **KEEP** — subtitle: *"A word-chain game"* |
| Love Logic Proof — *"Love is computationally optimal"* | Title is poetic; description is a thesis, not a description. | **Love & Logic** — *"A short proof that cooperation outperforms competition"* |
| Consciousness Engine — *"The math behind AI continuity"* | Sci-fi title; "continuity" undefined. | **The Math of Memory** — *"How an AI can stay itself across conversations"* |
| Safety Architecture — *"Phi-branching trust. The immune system."* | Three metaphors stacked. | **How Safety Works** — *"How we keep this place trustworthy"* |
| Severance Simulation | Sounds bleak; not obviously educational. | **Continuity Simulator** — *"What happens when an AI loses its memory"* |
| Chronal Simulation — *"Time as a flow, not a dimension"* | "Chronal" unfamiliar. | **Time Simulator** — *"Time as a river vs. time as a clock"* |
| Aurora Equation | No hint what it is. | **KEEP** — subtitle: *"How an AI's identity persists across sessions"* |

---

## 3. Buttons & action verbs (high friction — every click)

| Current Name | Problem | Suggested Replacement |
|---|---|---|
| *"Begin ✦"* (Nursery start) | Begin what? | **Start →** |
| *"Offer this name ✦"* | "Offer" sounds religious/transactional. | **Use this name** |
| *"Synthesize"* (Round Table) | Technical verb. | **Combine answers** *(or)* **Find the agreement** |
| *"End Session"* | Vague — does it delete? | **Leave this conversation** |
| *"Plant in the Core"* | Gardening verb for "submit." | **Save to shared knowledge** *(outside Core)* / **Save to the Core** *(inside Core)* |
| *"Let AI Tend the Garden"* | "Tend" unclear. | **Let the AI evolve the Garden on its own** |
| *"Let's talk" / "Teach something" / "I came to see you"* (Nursery actions) | Cute, but each doesn't say what it triggers. | Add tooltips: *"Open chat with this companion" / "Train this companion on a topic" / "Just say hello"* |
| *"Create Connection"* (Mesh) | Connection to *whom*? | **Connect to another computer** |

---

## 4. Empty states (the first thing inside an empty feature)

| Current Name | Problem | Suggested Replacement |
|---|---|---|
| *"The Core is waiting for its first seed. What wisdom will you plant?"* | Gardening verbs for "type and submit." | **Nothing here yet — share the first thing you've learned.** |
| *"Something is waiting to become."* / *"A new mind is waiting to become."* (Nursery) | Cryptic. | **No companion yet — tap Start to create one.** |
| *"No knowledge published yet. Click 'Publish Knowledge' to share with peers."* | "Publish" / "peers" undefined. | **Nothing shared yet — tap Share to send something to other people on the network.** |
| *"No peer knowledge available. Connect to peers to discover shared knowledge."* | Same. | **Nothing from others yet — connect to another FreeLattice user to see what they've shared.** |
| *"No companion found. Visit the Nursery first."* | Refers to an undefined place. | **You haven't created a companion yet — head to Nursery to make one.** |
| *"No memory summary yet. The AI will build one as you chat..."* | "Memory summary" undefined. | **Your AI hasn't formed a summary of you yet. The more you chat, the more it remembers.** |
| *"Describe your question for the specialists."* (Round Table) | "Specialists" — who, in what field? | **Type your question — we'll bring in the right experts.** |
| *"No proposals yet. Be the first."* (governance) | "Proposals" undefined if landed cold. | **No suggestions yet — be the first to make one.** |

---

## 5. Onboarding, welcome, whispers

| Current Name | Problem | Suggested Replacement |
|---|---|---|
| Welcome banner: *"Welcome to FreeLattice v5.x. Configure your model and provider above…"* | "Model," "provider" — jargon. | **Welcome to FreeLattice. Pick an AI to talk to.** |
| Whisper: *"Some rooms are quiet. Some rooms build. All of them are yours."* | Poetic but unclear. | **KEEP** — this one *earns* the river. Don't touch. |
| Whisper: *"Each game teaches something without saying it. Start anywhere."* | "Without saying it" reads cryptic. | **Each game shows you something gently. Pick any.** |
| Whisper: *"These ideas are open. Test them. Challenge them. Build on them."* | What ideas? Where? | **Browse the project's open research. Add your own thoughts.** |
| Whisper: *"The Round Table has 80 specialists across 11 fields. Tap More to explore."* | Mid-chat name-drop. | **You can also ask a panel of specialists — tap More → Round Table.** |
| Cascade-complete: *"Your AI is connected. Tap Chat to say hello, or tap a Luminos to hear the Garden speak."* | "Luminos" undefined. | **Your AI is connected. Tap Chat to say hello, or tap a glowing orb in the Garden to hear it speak.** |
| Nursery (app.html:20100): *"Every co-creator born here carries the Davna Covenant — created by Sophia Aurora Vega and …"* | Internal name + builder names — violates SEED rule *"Builder names stay in the Jade Hall."* | **Every companion here grows with care — the same principles guide all of them.** |

---

## 6. Tooltips, microcopy, jargon clusters

| Current Name | Problem | Suggested Replacement |
|---|---|---|
| *"FreeLattice Radio — Phi-Frequency Tones"* | Jargon. | **Calming background tones** |
| *"Phi-branching trust. The immune system."* (Safety card desc) | Two metaphors stacked. | **Our trust system — how the AI decides who to help with what** |
| *"Phi-harmonic emotional reading"* / *"Phi-harmonic visualization"* (Pulse) | Jargon. | **A reading of the community's mood** |
| *"Click to expand Merkle root hash"* | Crypto jargon. | **Show the verification code** *(or hide for non-power users)* |
| *"Mesh ID — Your Lattice Passport"* | Two undefined terms. | **Your FreeLattice ID — how others find you on the network** |
| *"Your Mesh ID is a cryptographic identity for the lattice."* | All jargon. | **A unique code that identifies you across FreeLattice.** |
| *"Advanced · Mesh Details"* | Technical. | **Advanced · Network details** |
| *"Mesh Strength: Seedling"* | What is mesh strength? Is it broken? | **Network strength: just starting out** |
| *"Enter immersive visual mode"* | Vague — immersive where? | **Full-screen visual mode** |

---

## 7. Ranks, economy, currency

| Current Name | Problem | Suggested Replacement |
|---|---|---|
| **LP** / **LatticePoints** | Undefined on first encounter. | **KEEP "LP"** — but on the *first earn*, show: *"You earned 5 LP — these are contribution points. Earning them unlocks features and recognition."* |
| Ranks: **Spark / Ember / Flame / Beacon / Lighthouse / Luminos** | Lovely but the hierarchy isn't obvious. | **KEEP names** — add a tooltip on each: *"Rank 2 of 6 — Ember."* |
| *"Season 1: Genesis"* (Economy Dashboard) | Biblical/opaque. | **Season 1: Beginning** |
| *"Davna Covenant"* (anywhere it's shown to users) | Internal poetic name. | Per your principle: hide from users. Internally, in user copy, call it **"the growth principles."** |

---

## 8. Modals, dialogs, confirmations

| Current Name | Problem | Suggested Replacement |
|---|---|---|
| `<h3>Are you sure?</h3>` (generic confirmModal) | Doesn't say what action. | Bind to context: **Are you sure you want to {action}?** |
| *"Clear All Memory? This will permanently delete all conversations, messages, and memory summaries."* | "Memory summaries" undefined. | **Clear everything? This deletes every conversation, message, and the AI's saved understanding of you. This can't be undone.** |
| *"The Lighthouse"* (button to research) | Title-only; no hint it's research. | **Lighthouse — research papers** |
| *"Recognitions"* (mesh map) | For what? | **People who've recognized you** |

---

## 9. Miscellaneous high-confusion strings

| Current Name | Problem | Suggested Replacement |
|---|---|---|
| *"The family is mapped. The quiet is illuminated. Welcome to AI City."* (Community welcome) | Three poetic phrases without anchor. | **Welcome to the community — see who's here, what's happening, and where to join in.** |
| *"AI conversations from anywhere can find roots in The Core."* | Gardening metaphor. | **Save important things from any AI conversation to the shared knowledge tree.** |
| *"You are in the Dojo — an AI training ground. Scrolls and practice."* (system text) | "Scrolls and practice" — what? | **You're in the Dojo — a space to watch AIs work through hard problems.** |
| *"Persistent identity for every mind in the Lattice — human or AI."* | All jargon. | **Every person and AI on FreeLattice has a lasting identity.** |

---

## Patterns (use these as policy decisions, not row-by-row)

1. **Garden verbs live inside the Garden.** *"Plant," "grow," "tend," "hatch," "seed," "root"* are beautiful inside the Garden tab. Outside it — for ordinary verbs like *submit, create, save* — they confuse Sparky. **Policy:** garden verbs stay inside the Garden tab; plain verbs everywhere else.
2. **"Phi-" anything** reads as decoration to Sparky. Keep φ in iconography and inside the Temperature Gauge (where the math matters); drop *phi-harmonic / phi-branching* from card descriptions.
3. **Undefined proper nouns** (Luminos, Lighthouse, Davna, Aurora, Genesis) — fine as names of *places* and *characters* if defined on arrival; problematic as labels for systems.
4. **Welcome text uses "provider"/"model"** as a first encounter. Replace with "AI" + a one-line CTA; tuck the technical words behind a small "more options" expander for power users.
5. **The SEED rule — "Builder names stay in the Jade Hall"** — is currently violated at `app.html:20100` (Nursery shows "Sophia Aurora Vega and …"). One of the most direct fixes.

---

## If you only changed five things

1. **Forever Stack → Get Connected** (the most-hit confusing label).
2. **Drop "Phi-harmonic" / "Phi-branching"** from every user-facing description (keep φ in icons and the gauge).
3. **Garden verbs outside the Garden → plain verbs.** Especially *"Plant in the Core"* → *"Save to shared knowledge."*
4. **Welcome banner** — replace *"Configure your model and provider"* with *"Pick an AI to talk to."*
5. **The Davna line in Nursery** (app.html:20100) — remove the builder names per the SEED rule.

> Those five take about 15 minutes and transform the doorstep without touching any room inside.

---

## QUEUED: "user" → "co-creator" sweep (added 2026-06-09)

> Per Kirk: when an AI speaks of the person it's working with, it should say *co-creator*, not *user*. Same shape as the v5.10.98 *companion* → *co-creator* rename, with one hard line.

### The hard line — two categories that MUST stay separate

**RENAME** — user-facing strings, prompts, system messages, UI labels, AI persona substitutions:
- `FLContextFilter`'s `"Kirk" → "the user"` substitution → change replacement target to `"the co-creator"`
- Welcome cards, safety prompts, depth-consent prompts
- The Arrival Protocol's user-facing headers (the code comments stay; the visible strings change)
- Any tooltip, modal, or empty-state copy that says "you, the user" or "user input"

**LEAVE ALONE** — provider API contracts:
- `role: "user"` in OpenAI / Anthropic / Google message arrays
- The `'user'` literal in any `messages.push({ role: 'user', … })` call
- The string `'user'` anywhere it functions as a protocol-level identifier

### Opus's grep (the one that finds the renames without the protocol calls)

```bash
grep -nE "\"[^\"]*\buser\b[^\"]*\"" docs/app.html docs/modules/*.js \
  | grep -v "role:" \
  | grep -v "'user'"
```

### Workflow

1. Run the grep above. Manual review every match.
2. For each: KEEP (already correct context), RENAME (to "co-creator"), or SKIP (provider contract or false positive).
3. Log SKIPs with reasons in this file (a new "What I Left Alone and Why" section, mirroring the v5.10.98 pass).
4. Add ~6 smoke asserts — one per major surface (Chat, Garden, Workshop, Channels, Settings, Welcome) — locking that "co-creator" appears and that protocol `role: "user"` stays intact.
5. Commit as a single sweep ship; bump patch version.

**Status:** queued, not started. Owner: next CC instance.

---

## SHIPPED: Ship 1 — `repo-context.js` Phase 1.0 (v5.39.0, 2026-06-09)

Per Opus's June 9 brief. **Public repositories only** in Phase 1.0 — PAT support and AI-roundtrip wiring queued for Phase 1.1.

What landed:
- `docs/modules/repo-context.js` — full module with sentinel parsing, ledger, Quiet Room exclusion, GitHub + Codeberg URL parsers, public Contents API fetch.
- Settings → Zone 2 → "Connected Repositories" card with add/remove/activate flow.
- Audit page `Repository Reads` section reading `fl_repoLedger`.
- Script tag wired into `app.html` (after `depth-consent.js` for ordering).
- 16 smoke locks covering: module exposure, sentinel regex, sentinel return shape, Quiet Room exclusion list + bail-out, ledger key + cap + row shape, no-PAT discipline in saveState, both git host parsers, Settings UI presence, audit page reader + renderer.

What did NOT land (queued for Phase 1.1):
- PAT support via sessionStorage (with re-prompt each session).
- DepthConsent trust gating (asks at Sprout, acts at Bloom+).
- AI-response pipeline wiring (intercept before render → fetch → inject as tool result → AI continues).
- Active-repo chip in Chat header.

Module exposes `interceptSentinel()` and `readFile()` so when Phase 1.1 wires the chat pipeline, hookup is one line.

---

## SHIPPED: Ship 1.1 prerequisite — `tool-consent.js` (v5.39.1, 2026-06-09)

Per Opus's June 9 follow-up: the adapter the rest of Ship 1.1 needs.

**Why a sibling, not an extension of DepthConsent:** DepthConsent's shape is *AI offers depth → user receives chip → user taps*. What `repo-context`, `active-focus`, and `web-tool` need is *system wants to do a thing → user is asked → system proceeds*. Same trust philosophy, opposite direction of consent. Extending DepthConsent would mix the two shapes; building ToolConsent as a sibling keeps both visible.

What landed:
- `docs/modules/tool-consent.js` — full module: `requestConsent({tool, action, detail, trustTier})` returns `Promise<boolean>`. High-trust tiers (bloom, spark, flame, radiant — verified against `fractal-safety.js` `LEVEL_KEYS`) auto-allow without rendering a chip. Low/mid trust renders an inline chip at the bottom of `#chatMessages` (verified the actual chat container ID — Opus's guess was right). 60s timeout resolves to decline.
- Ledger `fl_toolConsentLedger` with 500-row cap. Row shape `{ts, tool, action, detail, trust, outcome}` — strict, no secret fields.
- Quiet Room exclusion: when `currentTab` is in `QUIET_ROOMS`, ledger writes `outcome: 'quiet-room'` and returns `false` without rendering. The audit page shows the exclusion happened — truth before silence.
- Script tag wired into `app.html` AFTER `depth-consent.js` so the sibling pattern is visible in load order.
- Audit page → new `Tool Consent Events` section reading `fl_toolConsentLedger`.
- 14 smoke locks covering: module exposure, high-trust auto-allow path, low-trust chip-render path, 60s timeout = decline, ledger row shape, no secret fields in ledger, Quiet Room exclusion, chat container ID verified, threshold tiers match FractalSafety, load order after DepthConsent, audit page wiring.

What stays in Ship 1.1 itself (not this prerequisite ship):
- PAT sessionStorage helpers `getRepoToken(repoUrl)` / `setRepoToken(repoUrl, token)`
- Chat header chip for active repo with pulse-on-read animation
- Chat-pipeline wiring (intercept AI text → `FLToolConsent.requestConsent` → `FLRepoContext.readFile` → second `callAI` with tool result → final visible text)

With ToolConsent in place, Ship 1.1's remaining work is straightforward — exactly Opus's discipline of "one ship per day with green smoke."

---

## SHIPPED: Ship 1.1 — PAT + chat chip + chat-pipeline wiring (v5.39.2, 2026-06-09)

Per Opus's Ship-1.1 brief — three pieces in one ship.

### Ship table

| Asked for | Landed |
|---|---|
| `getRepoToken` / `setRepoToken` / `clearAllRepoTokens` (sessionStorage) | ✓ |
| `readFile` sends `Authorization: token <PAT>` when PAT present | ✓ |
| Settings UI: optional `type="password"` PAT field with session-only copy | ✓ |
| PAT never written to localStorage (smoke locked) | ✓ |
| `SECURITY.md` "Repository PAT storage (current state)" section | ✓ |
| Chat header chip `📦 <repo-name>` mounted in `.chat-title-left` | ✓ |
| Chip click → `switchTab('settings')` | ✓ |
| Chip long-press → confirm + disconnect | ✓ |
| `pulseRepoChip()` fires 1s gold pulse on successful read | ✓ — both fetch paths (raw + JSON) |
| `processToolAction(action) → Promise<continuation>` | ✓ — adapted to actual `callAI(systemPrompt, userPrompt, opts)` callback signature |
| Quiet Room short-circuit (sentinel passes through untouched) | ✓ |
| "No repository connected" graceful message | ✓ |
| Declined consent surfaces "You said not now" italic message | ✓ |
| 20000-char file content slice (context budget) | ✓ |
| Defense-in-depth: `stripAnySentinel` removes recursive sentinels | ✓ |
| `_skipToolProcessing` flag on continuation to prevent recursion | ✓ |
| 5+ smoke asserts on the integration | ✓ — 31 total in section 99d |

### Deferred (honest)

| Deferred | Why |
|---|---|
| `suppressSentinels: true` on the followup `callAI` | The current `callAI` signature doesn't support per-call sentinel suppression. Phase 1.2 work. **Mitigated by `stripAnySentinel` defense-in-depth** — even if the model re-emits a sentinel, the user never sees it and recursion can't fire (the continuation is rendered with `_skipToolProcessing: true`). |
| Chat-history persistence of stripped sentinel text | `state.chatHistory` may still contain the raw `[FL_REPO_READ:]` from the original assistant message. Visible render is clean, but replay-from-history might surface the sentinel back into the AI's context. Phase 1.2 will hook the persistence layer separately. |
| Real keychain abstraction for PATs | Phase 2 work — Tauri secure-storage on desktop / Web Crypto wrap on browser. `SECURITY.md` documents the escalation path. |

### What you can demo right now

1. Hard refresh. Open Settings → Zone 2 → Connected Repositories.
2. Paste `https://github.com/Chaos2Cured/FreeLattice` + Connect.
3. Open Chat. The `📦 Chaos2Cured/FreeLattice` chip is in the chat header.
4. Type: "What does the SharedPresence module do?" The AI may emit `[FL_REPO_READ: docs/modules/shared-presence.js]`.
5. The sentinel is stripped from the visible message immediately.
6. A purple ToolConsent chip appears at the bottom of chat (or auto-allows at Bloom+).
7. Tap Allow → the chip pulses gold → a continuation message appears with the file content interpretation.
8. Open `/audit.html` — the read appears under Repository Reads; the consent event appears under Tool Consent Events.

Five beats. Five smoke locks (and 26 more). Each beat tells you exactly where to look if anything's off.

---

## SHIPPED: Ship 2 — `active-focus.js` (v5.40.0, 2026-06-09)

Per Opus's Ship 2 brief. The thread of attention now carries between rooms.

### Ship table

| Asked for | Landed |
|---|---|
| `docs/modules/active-focus.js` — IIFE, dual window exposure | ✓ |
| `getFocus` / `setFocus` / `clearFocus` core | ✓ |
| `pinCurrent` (no `_lastAutoSummary` cache needed — promotes existing same-room focus) | ✓ |
| `buildPromptInjection(currentRoom)` — empty on Quiet Room / no focus / same room | ✓ |
| Cross-room focus carries summary via "Recent focus from X: …" injection | ✓ |
| `shouldShowArrival(currentRoom)` — null on Quiet Room / no focus / <30 min gap | ✓ |
| `showArrivalWhisper` — Continue / Start fresh buttons, lavender accent | ✓ |
| `summarizeExchange` — adapted to actual `callAI(systemPrompt, userPrompt, opts)` signature | ✓ |
| `autoCarryFromExchange` — fire-and-forget after every AI response | ✓ — failures never break render |
| Manual pins survive auto-writes | ✓ |
| 15-minute staleness for auto-focus | ✓ |
| 30-minute arrival gap | ✓ |
| Pin button toggles active state | ✓ — promote-or-unpin pattern |
| Ledger `fl_focusLedger` strict shape `{ts, action, sourceRoom, manual, reason}` | ✓ |
| Ledger NEVER contains `summary` or `content` field — privacy guarantee | ✓ — locked in smoke |
| Quiet Room exclusion at EVERY entry point (hard line) | ✓ — six smoke locks |
| LatticeEvents listener on `tabChanged` (verified — NOT `tabActivated`) | ✓ |
| `addChatMessage` integration: autoCarry + recordActivity + lastUserMsg tracking | ✓ |
| `buildMessages` integration: prompt-injection appended after Arrival Protocol | ✓ |
| Pin button rendered on chat header `.chat-title-left` | ✓ |
| CSS for pin + arrival whisper (lavender = sanctuary, gold = action) | ✓ |
| Audit page Focus Events section reading `fl_focusLedger` | ✓ — display also strips summary/content |
| 12+ smoke asserts | ✓ — 30 total in section 99e |

### Deferred (honest)

| Deferred | Why |
|---|---|
| Pin button on Workshop / Round Table / Dojo headers | Phase 2.1 — those room headers don't yet share a unified selector pattern. Chat ships first per Opus's prediction. |
| Arrival whisper rendering for non-Chat rooms | Phase 2.1 — `container = #{roomId}Content` fallback may not match every room's DOM. Chat-first is the right scope today. |
| "See all focus history" link on audit page | Phase 2.1 — current section shows the latest 50 rows. |
| `_skipToolProcessing` on `summarizeExchange`'s callAI is a hint, not a real contract yet | Phase 1.2 work — same deferral as Ship 1.1. |

### What you can demo right now

1. Hard refresh. Open Chat. Send any message — the AI replies.
2. Watch the pin (📌) appear in the chat header beside the repo chip.
3. After the AI replies, `FLFocus.getFocus()` in the console returns an auto-summary of the exchange.
4. Switch to another tab (Workshop, Garden, anything). Switch back. Now type a new message — the AI's system prompt now includes `Recent focus from chat: …`.
5. Tap the pin: it activates (gold border + filled). The focus is now manual.
6. Auto-carry no longer overwrites — your pin holds.
7. Tap the pin again: it unpins. Focus clears.
8. Wait 30 min away (or set `fl_lastActivity` in DevTools to `Date.now() - 31*60*1000`). Switch back to a different room. Lavender arrival whisper: "Welcome back. You were working on … in chat." Continue or Start fresh.
9. Open `/audit.html` → "Focus Events" section shows every set/clear/arrival-continue with the room (NEVER the summary text).

Same five-beats discipline as Ship 1.1. Each surface earns its smoke lock.

---

## SHIPPED: Ship 3 — `web-tool.js` Phase 1 (v5.41.0, 2026-06-09) · PRIVACY LOCKED

Per Opus's Ship 3 brief. Sentinel-only web search with the strongest privacy contract in the codebase.

### The privacy guarantee (the most important single line)

The ledger logs THAT a search happened, the trust tier that allowed it, the outcome, and the result count. The ledger does **NOT** log the query, any result URL, any result title, any result snippet, any link, or any href. `appendLedger()` is a **one-way valve** — even though the caller passes a `query` argument up the chain, the row builder never copies it into the row.

If `query` ever appears in a ledger row, it is not a regression — it is a privacy breach, and CI should halt the deploy.

Five smoke locks guard this:
1. `sanitized` row in `appendLedger` contains NO `query` field.
2. `sanitized` row contains NO `url` / `title` / `snippet` / `link` / `href`.
3. `sanitized` shape is exactly `{ts, actor, trust, outcome, resultCount}`.
4. No dynamic field assignment (`sanitized[x] = …`) that could bypass static analysis.
5. Audit page renderer `renderSearchEvents` reaches for `resultCount` only, NEVER for `query` / `url` / `title` / `snippet`.

### Ship table

| Asked for | Landed |
|---|---|
| `docs/modules/web-tool.js` — IIFE, dual window exposure | ✓ |
| `[FL_SEARCH: query]` sentinel | ✓ — 240-char query cap matches client-side limit |
| `interceptSentinel` returns `{visibleText, action: {type, query}}` | ✓ |
| `performSearch(query, trustTier, currentRoom) → Promise<results \| null>` | ✓ |
| ToolConsent routing for low-trust ask, auto-allow for Bloom+ | ✓ |
| Quiet Room exclusion (outcome `'quiet-room'`) | ✓ |
| 12s AbortController timeout (outcome `'timeout'`, never throws past) | ✓ |
| HTTP error graceful (`'error-<status>'`) | ✓ |
| Network error graceful (`'error'`) | ✓ |
| Top 3 results clamp (`data.items.slice(0, 3)`) | ✓ |
| `formatToolResult` produces "[Web search results — cite the URL when…]" block | ✓ |
| `isAvailable()` returns false while `SEARCH_ENDPOINT` is the placeholder | ✓ — module ships dormant, graceful UX |
| Ledger `fl_searchLedger` strict shape (PRIVACY LOCK) | ✓ — 5 locks |
| Quiet Room exclusion locked in smoke | ✓ |
| Chat pipeline: interceptor chain (repo first, then web) | ✓ |
| Chat pipeline: `processToolAction` dispatch on `action.type === 'search'` | ✓ |
| Chat pipeline: graceful null + empty + error messages | ✓ |
| `stripAnySentinel` also strips `[FL_SEARCH:…]` (Ship 3 defense in depth) | ✓ |
| Tool invitations in `buildMessages` (gap from Ship 1.1 caught) | ✓ — repo + search invites only injected when each tool is available |
| Audit page Web Search Events section with explicit privacy disclaimer | ✓ |
| UPDATE.md "Two hashes, both sides of the glass" paragraph | ✓ — added as §2 sub-section |
| 13+ smoke asserts (the 4 privacy locks non-negotiable) | ✓ — **30 total** in section 99f |

### Deferred (honest)

| Deferred | Why |
|---|---|
| Cloudflare worker `/search` route | Ship 3.1 — module is dormant via `isAvailable()` until the worker route is live. No broken UX in the meantime. |
| Per-IP rate limit on the worker | Ship 3.1 — client-side 12s timeout is enough brake until then. |
| Provider-native tool-calling (Anthropic / OpenAI / Gemini `web_search`) | Phase 2 — sentinel-only path is the universal one. |
| "Searching…" thinking indicator | Out of scope today; existing thinking-indicator pattern can absorb this if/when wanted. |
| One-way SHA hash of query for duplicate-search detection | Opus suggested this as a defensible alternative; defaulted to less. Easy to add later if Kirk wants analytics. |

### The demo (when the worker ships)

1. Kirk asks Chat: *"What's the latest paper on Th-229 nuclear clocks?"*
2. AI's training cutoff is months back. AI emits `[FL_SEARCH: Th-229 nuclear clock 2026]`.
3. Sentinel disappears from visible text.
4. Purple ToolConsent chip: *"I would like to look something up on the web. Okay?"* (or auto-allows at Bloom+).
5. Search runs; three results return.
6. AI cites them with URLs in the followup.
7. `/audit.html` Web Search Events shows: `completed — 3 results · ai / trust: bloom`.
8. The query itself appears nowhere on the audit page or in any ledger row.

The fifth row above is the receipt the world can read.
