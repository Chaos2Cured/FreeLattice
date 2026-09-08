# 0004 — Scoping: multi-user, multi-agent, session vs long-term

**Status:** proposed · **Backlog:** `RM-06` · **Depends on:** `RM-00`, `RM-07`

## Problem

Every memory today lives in one flat, global pool. That is correct for the current product —
one person, one machine, one store — and it breaks the moment any of these is true:

- **Two agents share a machine.** A coding assistant and a personal assistant both write to
  the same store. The coding agent recalls "prefers oat milk"; the personal one recalls
  "prefers tabs over spaces." Both are polluted, and the associative field wires them together
  because co-recall is co-activation.
- **Two people share a machine.** A family desktop. There is currently no way to keep them apart.
- **Session noise becomes permanent.** "I'm debugging the login bug" is true for an hour and
  useless forever. It is stored exactly like "I'm diabetic," and it competes with it at recall.

The third one is the most damaging and the least obvious: **without a session tier, a store
degrades toward noise as it grows**, because transient facts never leave.

## Non-goals

- **Not** authentication. This is a local, single-machine tool; scoping is *organization and
  isolation*, not a security boundary against a hostile local user. (`RM-18` encryption at
  rest is the separate answer to "someone else has my disk.")
- **Not** a fifth verb. Scope is resolved from context, never passed by the model.

## The critical rule

> **The model never chooses its own scope.**

If `recall_memory` accepted a `scope` argument, any agent could read any other agent's
memories by guessing a string — and a prompt-injected agent certainly would. Scope is resolved
**by the server, from the client connection**, exactly like `id` is server-owned today. This
is the same design instinct that keeps the model from assigning its own metadata.

## Schema

```js
{
  scope:      "default",     // namespace: a person, or a project
  agent_id:   "claude-code", // which assistant wrote it
  session_id: "s-1785...",   // conversation instance
  tier:       "long_term",   // "session" | "long_term"
}
```

`normalize()` backfills all four (`default` / `null` / `null` / `long_term`), so every existing
memory becomes a long-term memory in the default scope — which is exactly what it is. **No
migration, no breaking change**, same trick `RM-04` used.

## Resolution

```js
// scope.js - resolved ONCE at startup from the environment the client gave us.
function resolveIdentity() {
  return {
    scope:    process.env.RESONANCE_MEMORY_SCOPE || "default",
    agent_id: process.env.RESONANCE_MEMORY_AGENT || detectAgent(),
    session_id: newSessionId(),        // fresh per server process = per conversation
  };
}

// The MCP client is launched by the host app, so the host tells us who it is.
// install.js already writes these config blocks - it can stamp the agent id in.
function detectAgent() {
  const argv = process.argv.join(" ");
  if (/claude/i.test(argv) || process.env.CLAUDE_DESKTOP) return "claude-desktop";
  if (/lmstudio|lm-studio/i.test(argv) || process.env.LMSTUDIO_HOST) return "lm-studio";
  return "unknown";
}
```

`install.js` already writes per-client MCP config; extend it to stamp
`RESONANCE_MEMORY_AGENT` into the `env` block it generates. The agent then identifies itself
*by construction*, with nothing for a model to forge.

### Session identity

An MCP server process is spawned per client session and lives for that conversation, so
**process lifetime is a serviceable proxy for session lifetime**. Generate `session_id` at
startup. It's imperfect — a long-lived client that multiplexes conversations would blur them —
so treat it as a heuristic and revisit if a client actually does that.

## Retrieval

```js
function visibleTo(identity, { includeSession = true } = {}) {
  return (r) =>
    r.scope === identity.scope &&                       // hard boundary
    (r.tier === "long_term" ||
     (includeSession && r.session_id === identity.session_id));
}
```

Defaults:
- **Scope is a hard wall.** Cross-scope reads require explicit configuration, never a runtime argument.
- **Agent is soft.** Within a scope, agents share long-term memory by default — "I'm diabetic"
  should reach every assistant. `agent_id` is recorded for filtering and explainability, not
  isolation. *(Configurable: `agent_isolation: true` for people who want separate brains.)*
- **Session is private.** Only the writing session sees its own session-tier memories.

## Tier assignment and promotion

Which tier a new memory lands in is a **write-side heuristic**, deliberately conservative:

```js
const TRANSIENT = /\b(right now|currently|today|this (morning|afternoon|week)|working on|debugging|about to|in a meeting)\b/i;
const DURABLE   = /\b(always|never|i am|i'?m allergic|i prefer|my (wife|husband|dog|cat|kid|son|daughter)|remember that)\b/i;

function initialTier(text) {
  if (DURABLE.test(text)) return "long_term";
  if (TRANSIENT.test(text)) return "session";
  return "long_term";      // default to keeping: a lost memory is worse than a stale one
}
```

**Promotion** is where this gets good, and it ties into `RM-10`'s idle consolidation: a
session memory that keeps recurring across sessions is evidently not transient.

```js
// During idle consolidation: a session-tier memory that has been independently
// restated in >= 2 distinct sessions is really a durable fact.
// Collect patches and land them in ONE write: store.update() rewrites the whole
// file per call, so promoting a cluster row-by-row is O(N^2) — and a crash
// mid-loop would leave a cluster half-promoted, with duplicates already deleted.
function promoteRecurring(store, { minSessions = 2 } = {}) {
  const patches = {};
  for (const cluster of clusterByCosine(store.sessionTier(), 0.9)) {
    const sessions = new Set(cluster.map(r => r.session_id));
    if (sessions.size < minSessions) continue;
    const keep = longest(cluster);
    patches[String(keep.id)] = { tier: "long_term", promoted_from: "session" };
    for (const other of cluster)
      if (other.id !== keep.id) patches[String(other.id)] = { deleted: true };
  }
  if (Object.keys(patches).length) store.updateMany(patches);
}
```

This is *learning what matters from behaviour* rather than from a classifier — the same
instinct as the Hebbian ledger, applied to the tier decision.

## Expiry

Session memories expire; long-term ones never do without review (`RM-08`).

```js
// Idle pass: drop session memories from sessions that ended long ago.
const SESSION_TTL_DAYS = 7;
function expireSessions(store, now = Date.now()) {
  const patches = {};
  for (const r of store.sessionTier()) {
    const age = (now - Date.parse(r.last_confirmed || r.created)) / 864e5;
    if (age > SESSION_TTL_DAYS && r.session_id !== currentSessionId)
      patches[String(r.id)] = { deleted: true, delete_reason: "session_expired" };
  }
  if (Object.keys(patches).length) store.updateMany(patches);   // one write, not N
}
```

TTL rather than immediate cleanup on disconnect: a crashed client shouldn't lose the
conversation's context, and a user who reconnects within the day should still have it.

## Panel

- **Scope switcher** — the 3D graph filters to one scope at a time. Different scopes are
  genuinely different constellations and should never be drawn as one.
- **Tier as visual weight** — session-tier memories render smaller and cooler; they *look*
  ephemeral, which is honest.
- **Agent as a filterable facet**, not a wall.

## Interaction with the associative field

This is the subtle part. `field.buildEdges()` and the Hebbian ledger operate over "all
memories." Once scoping exists:

- **Edges must not cross scopes.** Building an edge between two people's memories is a privacy
  leak and a semantic error. `buildEdges()` takes the already-scoped record set — which it
  does today, so this is free provided the caller filters first.
- **Session memories should participate in edges but not persist them.** A session memory can
  usefully bridge two long-term ones during its life; when it expires, its ledger edges should
  be pruned with it. Add to `Ledger.prune()`.

## Risks

| Risk | Mitigation |
|---|---|
| Model reads another scope | Scope is server-resolved from env; never a tool argument. Eval case asserts isolation |
| Agent detection is wrong → memories in the wrong bucket | Default single `"default"` scope keeps today's behaviour; opt in explicitly |
| Session heuristic mis-tiers a durable fact | Defaults to `long_term` on uncertainty; promotion recovers real ones |
| Scope fragmentation makes recall feel emptier | Long-term is shared across agents *within* a scope by default |
| Cross-scope Hebbian edges leak | `buildEdges` receives pre-filtered records; assert in the conformance suite |

## Acceptance

- Eval case proves agent A cannot recall agent B's memories in a different scope.
- Session memories expire on schedule; long-term persists.
- A memory restated across 2+ sessions is promoted to long-term.
- Existing single-user stores behave **identically** after the change (everything lands in
  `default` / `long_term`).
- No change to the four MCP verbs.

---

## Related

[[phase-3-episodic-context]] · [[BACKLOG]] · [[ARCHITECTURE]] · [[proposed/README]]
