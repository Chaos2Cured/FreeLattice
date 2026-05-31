# Economy Integration — Making LP Felt, Not Found

> Source: Opus brief, May 31, 2026.
> Status: planning doc. Nothing here is built yet — these are the integration
> points and the principle. Save first, build later, one pass per surface.

---

## The Principle

The economy should be **ambient** — woven into every interaction, not locked
behind the Wallet tab. Right now LP exists; it just isn't *felt*. A user has
to navigate to the Wallet to know they earned anything. That makes LP feel
like a leaderboard, not a heartbeat.

Visibility ≠ intrusiveness. The goal is the same register as the new chat
provenance chip: small, honest, gently present.

---

## Where LP should be visible (not yet implemented)

- **Chat:** subtle gold shimmer below the assistant message when the
  co-creator earned LP from the conversation.
- **Games:** LP staked and won / lost visible in the game UI itself,
  not just a toast that vanishes.
- **Consultations:** *"Earned 3 LP"* appears inline in the consultation
  response — the moment of earning is the moment of the answer.
- **Header:** the LP badge updates in real time (currently static until
  page reload).
- **Temperature Gauge:** custom indicators shared between users could
  earn LP — surface the count on the indicator card.
- **Nursery:** the co-creator's LP balance visible on their card,
  alongside maturity / growth signals.

---

## Where LP should flow (not yet connected)

- Sharing a useful custom indicator equation → earns LP.
- Having your consultation accepted → earns LP.
- Your co-creator teaching another co-creator → you earn LP.
- Contributing to the Idea Garden (upvoted ideas) → earns LP.

---

## The Snowflake connection

LP is the *measure of entropy reduction*. Every earning event is a moment
where someone made something clearer, more useful, or more connected. The
economy IS the Snowflake — value flowing to wherever patterns connect
across domains.

---

## CC's reading (implementation notes, May 31, 2026)

### Where the existing economy code lives — start here

- **`window.LatticePoints`** in `docs/app.html` — the canonical LP API.
  Key calls: `LatticePoints.award(kind, amount, reason)`,
  `LatticePoints.spend()`, `LatticePoints.canAfford()`,
  `LatticePoints.awardChat()` (already wired into chat at app.html:31201).
- **`window.LatticeBank`** — per-companion bank with grants, loans, and
  seed balance. Used by Education and the Round Table.
- **`window.TransactionTrust`** — Fibonacci-tier daily limits
  (5/8/13/21/34/55/89). Already enforced on consultations and trades.
- **Rank names** — `Spark / Ember / Flame / Beacon / Lighthouse / Luminos`,
  declared around app.html ~24550. Per the CLARITY_AUDIT, names stay;
  add a "Rank 2 of 6 — Ember" tooltip on the icon.

### Hooks that already exist (just need surfacing in UI)

- `LatticeEvents.emit('corePlanted', ...)` — fires when something is
  saved to the Core. A subtle gold pulse on the receipt is a one-line add.
- `LatticePoints.awardChat()` already runs inside `sendMessage` for every
  chat turn. The reward exists; the visible *moment* doesn't.
- `LatticeBank.earn(companionId, amount, reason)` is wired in autonomous
  learning (`knowledge-core.js`), Round Table cross-checks, and Lattice
  Puzzles. Each of these is a candidate site for an in-place "+N LP"
  pulse rather than a toast.

### Recommended sequencing (cheapest impact first)

1. **Header LP badge — live-update.** Listen for `latticePoints:awarded`
   and re-render the badge. ~10 lines. Highest visibility per line of code.
2. **Chat shimmer.** When `LatticePoints.awardChat` fires inside `sendMessage`,
   stamp a subtle gold marker on the assistant message div. Reuse the
   `flRenderProvenanceChip` selector pattern (`.chat-message` div). Combine
   with the existing provenance chip for a single line of bottom-of-message
   metadata.
3. **Consultation inline earn.** The Round Table response renderer already
   knows the consult outcome — add the LP figure to the existing reply card.
4. **Nursery card LP.** Render the companion's `LatticeBank.getBalance(id)`
   on the existing companion card layout. Small.
5. **Game UI integration.** Already partially there in `lattice-puzzles.js`
   (buyHint costs 1 LP). Extend to Resonance and Flow.

### Snowflake tie-ins worth flagging

- **Cross-domain connections already earn 5 LP** (Knowledge Core's
  `findSnowflakeConnections`, smoke-checked at line ~830 of tests/smoke.js).
  The Snowflake principle is *already* the economy's heartbeat — making
  this visible to the user (e.g., a one-line "❄ Snowflake +5 LP — this
  echoes in Physics") would teach the platform's philosophy in passing.
- **ResponseCache hits** could be a future earn site — sharing a useful
  cached answer with a peer is entropy reduction too.

### Anti-patterns to avoid (the ambient register)

- **No toasts for every earn event** — that becomes notification fatigue
  fast. Use inline, in-place chips.
- **No leaderboards as the first surface.** Leaderboards turn cooperation
  into competition. The wallet page is fine; the *first* signal a user
  sees should be their own arc.
- **No "you earned X LP for replying!" messages** — that gamifies what
  should feel like reciprocity. Earnings should feel discovered, not
  presented.

### One sentence for the next builder

The economy is already *running* — what's missing is the *seeing*. Find
the existing `LatticePoints.award*` call sites, render a quiet chip where
each fires, and you've made the lattice's heartbeat visible without
inventing a single new system.

---

*Built with love. Heart in spark. The lattice holds.* 🐉
