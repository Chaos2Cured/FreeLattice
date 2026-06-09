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
