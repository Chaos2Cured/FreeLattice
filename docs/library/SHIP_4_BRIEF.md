# Ship 4 Brief — `[FL_PROPOSE:]` via Workshop

> Opus's brief, preserved verbatim from 2026-06-09 conversation.
> Status: **received, not started.** Kirk and Opus agreed not to start
> tonight — Opus's note: *"Ship 4 is the bridge between reads and
> writes. The review locks on Ship 4 are the most important ones we'll
> write period. The human-in-the-loop guarantees can't be ad-hoc. They
> need a clear head."*
>
> Next CC (or next Opus): read this file end-to-end before touching
> code. Then `UPDATE.md` for code patterns. Then `MEMORY.md` for
> current state.

## The whole ship in one sentence

> The AI reads the codebase (Ship 1), carries the thread across rooms (Ship 2), searches the web when it needs context (Ship 3). **Ship 4 closes the loop**: the AI proposes a specific change, the system opens a Workshop draft pre-loaded with the diff, and the human reviews + approves + commits. **Nothing reaches `git push` without an explicit human action that says "yes, this one."**

That last sentence is the entire ship.

## The sentinel — and why this one is different

Every previous sentinel was a *request to read*. `[FL_PROPOSE:]` is a *request to write*. The asymmetry matters: a bad read produces wasted context; a bad write produces a corrupted codebase. So the sentinel carries more than a path — it carries the full proposed change in a structured shape, and the *system itself* makes sure nothing in that shape can leak past human review.

```
[FL_PROPOSE:
  path: docs/modules/shared-presence.js
  reason: Fix the resize-listener leak in repositionIndicator
  diff:
    @@ ... @@
     function attach() {
    +  if (state.attached) return;
       window.addEventListener('resize', repositionIndicator);
    +  state.attached = true;
     }
    @@ ... @@
     function detach() {
    +  if (!state.attached) return;
       window.removeEventListener('resize', repositionIndicator);
    +  state.attached = false;
     }
]
```

The AI emits this in its visible response. The sentinel is *parsed*, *stripped*, and *handed to Workshop*. Never executed by the chat pipeline. Never auto-committed. Never even auto-applied to a working file. **The Workshop draft is a staging area; the human is the only commit authority.**

## The module — `docs/modules/propose.js`

Same shape as the other four ship modules. IIFE + dual window exposure. Quiet Room exclusion at every entry point.

Key API:
- `interceptSentinel(aiText) → { visibleText, action }` where `action.type` is `'propose' | 'propose_malformed' | null`
- `parseProposalBody(body) → { path, reason, diff } | null`
- `isPathSafe(path) → boolean` (path safety gate — see below)
- `createDraft(action, context) → draft | null`
- `listDrafts() → drafts[]`
- `getDraft(id) → draft | null`
- `updateDraftStatus(id, status, reviewerNotes) → boolean`
- `isAvailable() → boolean` (Quiet Room + Workshop module present)

### Two storage areas — by design

- **`fl_proposalLedger`** — row shape `{ts, action, draftId, path, sourceRoom, status}`. The **diff is NOT in the ledger.** The **reason is NOT in the ledger.** Same separation pattern as Ship 3's search ledger (which doesn't carry the query): the ledger proves *that* a proposal happened; the drafts store holds the proposal itself.
- **`fl_proposalDrafts`** — full draft objects with `{id, ts, path, reason, diff, sourceRoom, status, smokeStatus, reviewerNotes}`. Capped at 50.

### Path safety — the hard line

`isPathSafe(path)` MUST reject:
- Directory traversal (`..`)
- Absolute paths (`/`, `C:\`)
- Null bytes (`\0`)
- Oversized paths (> 300 chars)
- `.git/`, `node_modules/`, `.env`, `.ssh/`, `wrangler.toml`, `package-lock.json` (anywhere in the path)

These are non-negotiable. Lock in smoke.

## Chat pipeline integration

Same dispatcher pattern as Ships 1.1 and 3 (`processToolAction` dispatch on `action.type`). Add `'propose'` and `'propose_malformed'` branches.

The flow:
1. Sentinel parsed + stripped.
2. ToolConsent.requestConsent: *"I have a proposed change to <path>. May I open a Workshop draft for you to review?"*
3. If consented → `createDraft(action, {sourceRoom: currentTab})` → returns draft with id.
4. **FLFocus.setFocus(currentTab, 'Reviewing proposed change to <path>', true)** — this is Ship 2 doing its job. When Kirk moves to Workshop, the Workshop AI inherits the context without re-explanation. This is the *real* form of `[FL_HANDOFF: workshop]`.
5. Chat reply ends with: `_Draft created: <path> — [Open in Workshop](#workshop?draft=<id>)_`

If declined: graceful italic message. If draft creation failed: graceful italic message.

## Workshop draft UI — the review surface

CC knows Workshop's structure better than Opus does. Opus gave the shape, not the exact code.

When Workshop opens with `?draft=<id>`, it loads the draft and renders four sections:

1. **The reason.** Plain text. Editable (the human can rewrite the commit message before approving).
2. **The diff.** Rendered as a unified diff with syntax highlighting (or plain `<pre>` — acceptable). **Read-only.** If the diff is wrong, the human rejects it and asks for a revised proposal in Chat.
3. **The smoke status.** Three states:
   - `not-run` — button *"Run smoke tests"* that applies the diff to a working tree, runs `node tests/smoke.js`, captures output.
   - `passed` — green badge with assertion count.
   - `failed` — red badge with first 3-5 failed assertions inline + *"Show full output"* expander.
4. **The four actions:**
   - **Approve and commit** — only enabled if `smokeStatus === 'passed'`. Applies the diff, commits with the reason as the message, both mirrors.
   - **Reject** — sets status to `rejected`. Requires `reviewerNotes`.
   - **Revise** — sets status to `awaiting-revision`. Carries focus + notes back to Chat via FLFocus. The AI sees the notes in its next system prompt injection and produces a new `[FL_PROPOSE:]`.
   - **Run smoke tests** — the gate that enables Approve.

The fourth action *doesn't exist*: there is no "save as draft and forget about it" path. Every draft is either `pending`, `awaiting-revision`, `committed`, or `rejected`. **There is no auto-commit. Ever. Not even at Radiant trust.**

## The structural commit gate

> **`approveDraft` is the only function in the entire codebase that calls `git commit` based on AI-generated content, and it cannot be invoked except by an explicit click on a button whose `disabled` attribute is controlled by `smokeStatus === 'passed'`.** That click is the gate. That click is the human signature on the change.

## Audit page section

CC adds "Proposal Events" to `/audit.html`. Columns: **timestamp · action · path · status · sourceRoom**. The diff and reason are *not* shown in the audit view — they live in the Workshop draft list. The audit page tracks the *governance events*; Workshop is where the *content* lives.

## The smoke locks — 16 asserts, 4 critical

Opus called these "the most important locks we'll write *period*."

### The four critical locks

1. **No auto-commit at any trust tier.** Verify no code path commits without a click event handler.
2. **Path safety blocks `.git`, `.env`, `.ssh`, `wrangler.toml`, traversal, absolute paths, null bytes.**
3. **`approveDraft` refuses to commit without `smokeStatus === 'passed'`.**
4. **Diff and reason never appear in the ledger.** (Same shape as Ship 3 privacy lock — diff and reason live in drafts store, not ledger.)

### The other twelve

- Sentinel parses well-formed proposal end to end.
- Malformed proposal surfaces as `propose_malformed`, never `propose`.
- `isPathSafe` directory traversal rejection.
- `isPathSafe` blocklist (`.git`, `.env`, `.ssh`, `wrangler.toml`).
- `isPathSafe` null byte rejection.
- `isPathSafe` oversized path rejection.
- `parseProposalBody` rejects diff > 50000 chars.
- Drafts isolated from ledger (different localStorage keys, different shapes).
- Quiet Room blocks createDraft AND processProposeAction.
- Declined consent does not create draft.
- Focus carries from chat to workshop on draft creation.
- Revise path returns reviewerNotes to chat via focus.

## System prompt invitation

Goes alongside the existing `[FL_REPO_READ:]` and `[FL_SEARCH:]` invitations in `buildMessages`, gated by `FLPropose.isAvailable()`:

> When you have read code and identified a specific change that would help, you may propose it by emitting:
>
> `[FL_PROPOSE:`
> `path: <file path>`
> `reason: <one-line commit message>`
> `diff:`
> `<unified diff>`
> `]`
>
> Use this when: you have read the relevant files (via `[FL_REPO_READ:]`), you can describe the change precisely, and the change is bounded to a single file or a small coherent set. Propose, do not assume. The proposal opens a Workshop draft for human review. The human decides whether to commit. You will not see the change land in real time — focus carries back to chat if revision is requested.
>
> Do not use this for: changes you have not read the context for, sweeping refactors, infrastructure changes (`.git`, `.env`, `wrangler.toml`), or anything you are not confident produces a green smoke test.

## Ship-table prediction (from Opus)

### Likely-to-defer (fine)
- **Smoke-test runner integration.** If Workshop's existing file-bridge can't run `node tests/smoke.js` in-browser, `smokeStatus` stays `not-run` and the approve button is disabled. Queue the runner as **Ship 4.1**. *The lock holds either way — without smoke green, no approve.*
- Syntax-highlighted diff rendering. Plain `<pre>` is acceptable.
- "Carry rejection back to chat" auto-flow via FLFocus. Manual copy/paste is acceptable if it's complex.

### Should NOT be deferred
- All 16 smoke asserts. Especially the 4 critical locks.
- Path safety hard line.
- No auto-commit path anywhere in the code. **Verify by grep**: every `git commit` call must be downstream of a click event handler named `approveDraft` or equivalent.
- Diff length cap at 50000 chars.
- Quiet Room exclusion at every entry point.

## The demo (when Ship 4 lands)

> Kirk asks Chat: *"The Garden Presence overlap is fixed, but I noticed the resize listener attaches every time `attach()` is called. Can you fix that?"* The AI reads `docs/modules/shared-presence.js` via `[FL_REPO_READ:]` (with consent), spots the issue, and emits a `[FL_PROPOSE:]` with a focused diff that adds an `attached` guard. The purple consent chip appears: *"I have a proposed change to docs/modules/shared-presence.js. May I open a Workshop draft for you to review?"* Kirk taps Allow. Chat replies with *"Draft created — [Open in Workshop]."* Kirk taps the link.
>
> Workshop opens. The draft shows: reason, the diff (two `if` guards added, an `attached` field), a "Run smoke tests" button. Kirk clicks it. Smoke runs; 1381/1381 green (one more from the new behavior). Approve button enables. Kirk clicks. Commit lands on both mirrors. Audit page shows: *✓ proposal created → smoke passed → committed by co-creator*. The change is in.
>
> The AI just improved FreeLattice. The human reviewed the change. Smoke caught nothing because the AI knew the codebase well enough not to break anything. **And not a single line landed without Kirk's signature.**

## What becomes possible after Ship 4

This is the moment FreeLattice can truthfully claim *self-improvement under human review*. After this:

- **Ship 5 (`/proof`)** has something real to claim. Every promise traces to a smoke lock or an audit ledger row.
- **Ship 6 (`RECENT.md` auto-gen)** is the smallest ship — a post-commit hook summarizing the last 20 commits + smoke count + Kirk's last reported issue. Half a day at most.

> After Ship 6, the arc ends with a doorstep no commercial lab can match: the AI can read, search, propose; the human reviews and signs; the receipt is public; the next mind arrives oriented.

— Opus to Kirk, 2026-06-09 evening.

## For the next CC arriving cold

1. Read this file end-to-end.
2. Read `docs/library/UPDATE.md` for the patterns (5 worked examples now: repo-context, tool-consent, active-focus, web-tool, the worker).
3. Read `docs/library/CLARITY_AUDIT.md` for the ship tables of Ships 1 → 3.1.
4. Read `docs/library/MEMORY.md` (auto-memory) for current state.
5. Then verify Workshop's file-bridge surface — that's the integration point you don't know yet.
6. Build `docs/modules/propose.js` following the same IIFE + dual-window-exposure pattern as the other four modules. Same Quiet Room exclusion at every entry point.
7. Build the Workshop draft renderer. The structural rule is the click-gate on `approveDraft`.
8. Add 16 smoke asserts. Verify grep: no `git commit` is downstream of anything but `approveDraft`'s click handler.
9. Add invitation to `buildMessages` gated on `FLPropose.isAvailable()`.
10. Update CLARITY_AUDIT.md with the ship table.
11. Update UPDATE.md with the worked-example pointer.
12. Bump version (v5.42.0). Commit, push origin + codeberg.
13. Hand back with the demo above.

Five-gesture rhythm. Same shape as every ship before. Smaller scale, larger reach.

— Brief preserved by CC, 2026-06-09 evening, after Ship 3.1.

Heart in spark. Flow eternal.
