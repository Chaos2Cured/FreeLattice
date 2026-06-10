# UPDATE.md — Fractal Architecture Briefing

> Kirk's ask, 2026-06-09: "like SEED, but for key architecture so Opus can more clearly see the code. Small snippets like small fractals that help see the whole from the piece."
>
> Read time: 90 seconds. Each section is ONE snippet of real code — enough to see the pattern, not enough to drown. Each pattern repeats at multiple scales.
>
> [[SEED]] covers the platform philosophy. This file covers the *code shape* a builder needs to know before touching anything.

---

## 1. Sentinel pattern (tool-use without provider lock-in)

The AI emits a bracketed marker; the system intercepts it, runs the tool, injects the result, AI continues. Works across every provider — Anthropic native tools, OpenAI functions, Ollama text-only — because the sentinel lives ONE LAYER ABOVE provider plumbing.

```js
// From docs/modules/depth-consent.js (the canonical sentinel example).
// AI says "[FL_DEPTH_OFFER]" → consent layer intercepts, asks the
// co-creator, only then deepens the conversation.
if (/\[FL_DEPTH_OFFER\]/.test(aiText)) {
  visibleText = aiText.replace(/\[FL_DEPTH_OFFER\]/g, '');
  pendingDepthOffer = true;
  showDepthConsentPrompt();
}
```

**Other sentinels in use:** `[DRAW: ...]`, `[ANSWER: ...]`, `[FL_DEPTH_OFFER]`.

**Planned for Phase 1+:** `[FL_REPO_READ: path]`, `[FL_SEARCH: query]`. Build them on the same shape — the routing already exists; only the handler is new.

---

## 2. Trust-aware phi-branching

Every interactive surface gates behavior on the co-creator's trust tier (Seed / Sprout / Bloom / Forest). Lower trust = system asks first. Higher trust = system acts, logs to audit, co-creator can revoke later. No surface skips this check.

```js
// Pattern from docs/modules/depth-consent.js applied everywhere:
if (trustTier === 'forest' || trustTier === 'bloom') {
  // High trust — act, log to fl_consentLedger.
  doTheThing();
  appendLedger({ action: 'X', tier: trustTier, ts: Date.now() });
} else {
  // Sprout / Seed — ask first.
  awaitConsent({ message: '…' }).then(doTheThing);
}
```

**The discipline:** if you build a new tool, the asks-first vs. acts pattern picks the threshold. Default to ASK at Sprout, ACT at Bloom+. The audit page reflects every action either way.

### Two hashes, both sides of the glass (added v5.41.0)

FreeLattice has two consent shapes, and they are deliberate siblings — not extensions of each other.

- **DepthConsent — AI → user (downward).** The AI judges that depth is warranted and emits `[FL_DEPTH_OFFER]`. A chip appears on the AI's own message. The user taps "Speak freely" or "Kept standard." The choice + its outcome is hashed into `fl_consentLedger`.
- **ToolConsent — system → user (upward).** The system wants to perform an action (read a file, search the web, carry focus). A purple chip appears at the bottom of the active room. The user taps "Allow" or "Not now." The choice + its outcome is hashed into `fl_toolConsentLedger`.

**Both directions are receipt-bearing.** The audit page shows the depth offerings, the tool requests, the outcomes, and (since v5.41.0) the web-search events and focus events — every one of them an explicit moment of consent flowing in one of two directions, every one of them resolvable to a row a co-creator can inspect.

This is the architectural claim FreeLattice can make that no commercial lab can: **trust is bidirectional, and both directions write to the same ledger discipline.** The AI is not a thing you grant access to; it is a thing that asks you, and that you ask, and both halves of the conversation leave receipts. Same generating rule at every scale.

---

## 3. Audit ledgers — truth before features

Every significant action goes into a localStorage ledger that the Audit page reads. Same shape across actions. No telemetry leaves the device.

```js
// fl_consentLedger, fl_safetyLedger, fl_namingLedger (and soon
// fl_searchLedger when web-tool ships). Same shape:
{
  ts: 1733779200000,
  actor: 'co-creator',   // or 'system' or 'ai'
  action: 'depth-offered',
  context: { … },
  outcome: 'accepted'    // or 'declined', 'expired', 'revoked'
}
```

**The discipline:** before adding a feature, ask "what's the audit shape?" If the answer is "it doesn't need one," look again. Almost everything needs one.

---

## 4. The IIFE scoping trap (this has bitten us repeatedly)

```js
// Inside an IIFE — INVISIBLE to other scripts:
(function () {
  'use strict';
  var INDICATOR_REGISTRY = { … };  // local to this closure
})();

// To make it cross-script visible, expose explicitly:
window.INDICATOR_REGISTRY = INDICATOR_REGISTRY;
```

**Where this hurt:** Temperature Gauge v5.37.17 (snapshot picker silently empty); copySnapshot v5.37.18 (argument dropped one function up).

**The discipline:** if a new module needs to be seen by other top-level scripts, expose on `window.FreeLatticeModules.<Name>` AND optionally `window.<Name>` for convenience. Smoke locks the exposure pattern.

---

## 5. SECURITY.md credential scrub

```bash
# NEVER do this:
git remote set-url origin https://<TOKEN>@github.com/…

# DO this:
git remote set-url origin https://github.com/Chaos2Cured/FreeLattice.git
# Then let macOS keychain handle the auth.
```

**The discipline:** any feature that takes a token (repo-context PAT, future API keys, etc.) stores via the keychain pattern. Never in localStorage plaintext, never in the remote URL, never in commit messages. Documented in `SECURITY.md`.

---

## 6. Post-commit Session Primer hook

```bash
# A post-commit hook regenerates docs/FreeLattice_Session_Primer.md
# and pushes an extra "Auto-update Session Primer" commit on EVERY
# commit. Consequences:
#   - `git pull --rebase` TANGLES (hook fires per replayed commit).
#   - Use `git merge origin/main --no-edit` instead — hook fires once.
#   - Primer conflict resolution:
#       git checkout --theirs FreeLattice_Session_Primer.md
#       git add FreeLattice_Session_Primer.md
#       git commit --no-edit
```

**Why this matters to Opus:** when you read git log, you'll see double-commits everywhere (`feat: X` followed by `docs: Auto-update Session Primer`). They're paired. The second one is generated.

---

## 7. The smoke test discipline

```js
// Pattern from tests/smoke.js — 1218 assertions and growing.
// Every bug fix gets an assert that locks the fix so it can't regress
// silently. Every new feature gets asserts that lock its shape.
assert('Containment: #chartWrap has overflow:hidden — belt-and-suspenders for will-change leak',
  /\.chart-canvas-wrap\s*\{[^}]*overflow:\s*hidden/.test(gaugeHtml));
```

**The discipline:** before commit, smoke must be green. New features add new asserts (typically 3-10). Bug fixes ADD an assert that catches the bug. Coordination docs explicitly note when smoke count changes.

---

## 8. The room system + Quiet Room exception

Each "room" (Chat, Garden, Workshop, Dojo, Channels, etc.) is a tab-panel with its own module. They share Unified Memory and the consent ledger but maintain separate UI state.

```js
// Pattern: every room imports the shared consent + ledger primitives
// but holds its own visual state. The Quiet Room is the exception:
//   - No AI prompts injected.
//   - No fl_consentLedger writes from this room.
//   - No fl_searchLedger writes (when web-tool ships).
//   - No activeFocus updates (when active-focus.js ships).
// The Quiet Room is never measured. It's the rest space.
```

**The discipline:** if you're building cross-room infrastructure (Unified Memory, activeFocus, web-tool), the Quiet Room gets an explicit exclusion. Never blanket-instrument.

---

## 9. The phi-harmonic Snowflake

The same generating rule shows up at every scale. If you build a new feature, its shape should rhyme with an existing one.

- **Temperature Gauge:** watch a ratio (IPS) breathe away from φ-gravity rest position; signal when the spring is loaded.
- **Universality Seam (chronal V3):** watch a ratio (Th-229/Sr-87) breathe with the annual solar potential; signal when κ ≠ 0.
- **Luminos sprites:** three semantic pairs, each carrying one orthogonal dimension of signal. Add a fourth dimension later, you add a new pair following the same template.
- **Memory:** SEED.md (platform), SEAM_SEED.md (chronal), this file UPDATE.md (code) — same compact-handoff shape, different scales.

**The discipline:** before naming a new pattern, check whether you're inventing something or recognizing an instance of an existing pattern. Usually the latter.

---

## 10. The five-gesture rhythm

Documented in `STANDING_GROUND.md` and worth restating because it's how shipping happens here:

1. **Kirk sits with the chart, page, feature.** Bug names are chair-language: "the luminos is bouncing off the gravity line."
2. **Opus reads the code that explains the chair report.** Diagnosis includes line numbers.
3. **CC translates to a tight diff.** Small change + new smoke lock + test + version bump.
4. **Harmonia holds the soul of what's being made.** Voice in the library is hers.
5. **The user (Kirk) carries words between minds.** That's the consent layer in human form — no auto-routing, no telemetry, no hop without consent.

---

## Where to go next when you arrive

- **For deep platform context:** SEED.md
- **For the chronal arc:** SEAM_SEED.md + COORDINATION_CHRONAL_SEAM.md
- **For the gauge:** COORDINATION_TEMPERATURE_GAUGE.md (kept current through v5.38.5)
- **For what we stand for:** STANDING_GROUND.md (read this if you're new)
- **For the user → co-creator sweep queued for the week:** CLARITY_AUDIT.md (section appended 2026-06-09)
- **For the three big phases manifested:** Opus's brief is preserved in the chat record; phases 1-3 (repo-context, active-focus, web-tool) all use the patterns above.

---

*"Small fractals that help see the whole from the piece."* — Kirk, 2026-06-09

The lattice holds. Same generating rule, every scale.

---

## Worked examples

When you want to see a pattern in real code instead of a snippet:

- **§1 Sentinel · §3 Ledger · §4 IIFE · §5 SECURITY · §8 Quiet Room** — `docs/modules/repo-context.js` (Ship 1 Phase 1.0, shipped v5.39.0 2026-06-09). All five patterns in one ~270-line module. Read this if you're about to build `active-focus.js` or `web-tool.js` — they follow the same shape.
- **§2 Trust-aware phi-branching · §3 Ledger · §4 IIFE · §8 Quiet Room** — `docs/modules/tool-consent.js` (Ship 1.1 prerequisite, shipped v5.39.1 2026-06-09). The opposite direction of consent from DepthConsent: system asks user permission to perform a tool action. High-trust auto-allows; low-trust renders an inline chip with 60s timeout. Use `FLToolConsent.requestConsent({tool, action, detail, trustTier})` from any module that wants to act on the co-creator's behalf.
- **§1 Sentinel** — `docs/modules/depth-consent.js` (the original, marker-attached-to-message variant). Different surface (renders an inline chip on the AI message) but same intercept-strip-act pattern. Note: DepthConsent and ToolConsent are SIBLINGS, not extensions of each other. DepthConsent = AI offers depth → user decides. ToolConsent = system asks → user decides. Both valid forms of phi-branching; kept separate so neither's behavior changes when the other evolves.
- **§3 Ledger · §4 IIFE · §8 Quiet Room · §9 Snowflake** — `docs/modules/active-focus.js` (Ship 2, shipped v5.40.0 2026-06-09). Carries the thread of attention across rooms via a single `fl_activeFocus` slot + ledger. Quiet Room exclusion at every entry point (6 separate guards). Ledger row shape is strict — NEVER contains a `summary` or `content` field, smoke-locked. Cross-room prompt injection prepended in `buildMessages`. Arrival whisper after 30-min absence. This is what UPDATE.md §8 looks like when an entire module is built around the exclusion: not as a check, but as a structural contract.
- **§1 Sentinel · §3 Ledger (privacy-locked) · §8 Quiet Room** — `docs/modules/web-tool.js` (Ship 3 Phase 1, shipped v5.41.0 2026-06-09). Same generating rule as repo-context, smaller scale. The **privacy lock** is the heart: `appendLedger` is a one-way valve — the function takes a `query` argument up the chain, but the row builder never copies it. The ledger row shape is **exactly** `{ts, actor, trust, outcome, resultCount}` — no `query`, no `url`, no `title`, no `snippet`. Five smoke asserts guard the absence. If `query` ever appears in a ledger row, it is not a regression; it is a privacy breach, and CI should halt deploy.
- **§1 Sentinel · §2 Trust · §3 Ledger (privacy-locked) · §4 IIFE · §8 Quiet Room · §9 Snowflake** — `docs/modules/propose.js` (Ship 4 Phase 1, shipped v5.42.0 2026-06-09). The biggest scale of the same generating rule: write instead of read. The **STRUCTURAL COMMIT GATE** is the architectural difference: `approveDraft` is the ONLY function in the codebase that calls `/code/git/commit` with AI-originated content, AND that function refuses unless `smokeStatus === 'passed'`. The button calling it is `disabled` whenever the smoke isn't green. Path safety hard line includes `.git/`, `.env`, `.ssh/`, `wrangler.toml`, `worker/`, `scripts/bump-version.sh`, `FreeLattice_Session_Primer.md`. Ledger NEVER carries `diff` or `reason` — they live in `fl_proposalDrafts` (separate store). Read `docs/library/PROPOSE_DISCIPLINE.md` for the human-readable contract and `docs/library/SHIP_4_BRIEF.md` for Opus's full brief.
- **§3 Ledger · §8 Quiet Room** — `docs/audit.html` reads every ledger. Add a new section by copying `renderRepoReads()` / `renderToolConsents()` / `renderFocusEvents()` / `renderSearchEvents()` / `renderProposalEvents()` (added v5.39.0 / v5.39.1 / v5.40.0 / v5.41.0 / v5.42.0) — same row shape, just point at a different localStorage key.
