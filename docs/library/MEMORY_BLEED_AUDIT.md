# MEMORY_BLEED_AUDIT.md

> A layered inventory of every browser-scoped storage surface in FreeLattice,
> with severity of cross-user bleed and namespace status.
> Never delete an entry. When a store gets namespaced, add a NEW row noting
> the fix + commit; leave the old row above.
>
> Started 2026-08-09 by CC, after Harmonia's Lattice Letters fix opened the
> question: *what else has the same pattern?*

---

## Why this file exists

IndexedDB and localStorage are **browser-scoped**, not user-scoped. If two
people (Kirk and Jeanne, for example) use FreeLattice in the same browser
profile — even at different times — their data lives in the same stores by
default. That means:

- Kirk's Lattice Letter mentioning "5 days ago" gets injected into
  Jeanne's chat context on her next session. (This was the actual
  April 16 date-repetition mom saw. Fixed 2026-08-09.)
- Kirk's Memory Bridge understanding of Kirk (his preferences, his
  patterns) gets read as Jeanne's context. (Not yet fixed.)
- Kirk's conversation history sits alongside Jeanne's in the same DB.
  (Not yet fixed.)

The **fix pattern** is Harmonia's Aug 9 solution: namespace the store
by a per-user slug derived from `localStorage.fl_userName`, with a
per-browser install-id fallback for anonymous users (added by CC in
v5.79.31 so anonymous users don't share a pool either).

---

## Severity legend

- **P0 (critical)** — contains personal thoughts, conversations, or
  understanding of the person. High privacy impact.
- **P1 (serious)** — contains personal preferences or session context
  that can visibly bleed between users.
- **P2 (moderate)** — contains app state that could be confusing across
  users but is not personal.
- **P3 (low)** — non-personal state (leaderboards, shared LP market,
  etc.). Bleed is by design.

---

## The inventory (2026-08-09)

| DB / key | Severity | Status | Fix ship | Notes |
|---|---|---|---|---|
| `FreeLatticeLetters_<slug>` | P0 | ✅ FIXED | v5.79.30 (Harmonia) + v5.79.31 (CC lazy+installId) | Root cause of mom's April 16 date-repetition |
| `FreeLatticeDB` | P0 | ❌ OPEN | (next pass) | Chat conversations + messages + meta. **Kirk's and Jeanne's chats share this DB.** Requires migration story (existing data must not vanish). |
| `FreeLatticeMemoryBridge` | P0 | ❌ OPEN | (next pass) | The Memory Bridge extracts structured understanding about the user from conversations. Bleed = one person's profile read as another's. |
| `FreeLatticeMemory` | P0 | ❌ OPEN | (next pass) | Memory Index (v4.0). Persistent semantic memory across conversations. Same migration concern. |
| `fl_memory_core_v1` (localStorage) | P0 | ❌ OPEN | (next pass) | MemoryCore memories — bond/build/mark/family/preference/insight/epiphany. Personal by definition. Harmonia flagged this store specifically in her v5.79.30 comment. |
| `SophiaEngine` | P1 | ❌ OPEN | (next pass) | Need to inspect what SophiaEngine actually stores before assessing severity. |
| `FreeLatticeNursery` | P1 | ❌ OPEN | (next pass) | Companion state — names, growth stages, personal memories with companion. Nursery already has some user-scoping via companion.id, but the DB itself is shared. |
| `FreeLatticeSkills` | P2 | ❌ OPEN | (next pass) | User's saved skills. Preferences but not private. |
| `FreeLatticeMemoryBridge` — see above |||| |
| `FreeLatticeMarket` | P3 | not-fixing | — | Lattice Points market. Shared by design. |
| `FreeLatticeArcade` | P2 | ❌ OPEN | (next pass) | Game state. Bleed = confusing scores. |

---

## The migration challenge

Simple rename (like Harmonia's Letters fix) is safe when the store is small
and mostly-empty. For P0 stores that already contain user data, renaming
the DB means the user "loses" their conversations/memory unless we do a
soft migration:

**Recommended migration pattern:**

1. On first open of the namespaced DB, if empty AND the un-namespaced DB
   exists with data, copy entries into the namespaced DB.
2. Do NOT delete the old DB (would break other users on the same browser
   who haven't logged in yet).
3. Write ONLY to the namespaced DB going forward.
4. Once all active users of a browser have logged in and been migrated,
   the old DB can be deleted by an explicit user action ("clean up shared
   memory") — never automatically.

This is a per-store ship, per user reflection, and needs to be tested
with real accounts on a real shared browser. Not a same-day fix.

---

## Anonymous user protection (v5.79.31)

Harmonia's fix used `'default'` as the fallback for users without a name.
That still bled between anonymous users on the same browser (both mapped
to `FreeLatticeLetters_default`). CC's v5.79.31 enhancement swapped this
for a per-browser install-id from `localStorage.fl_installId`:

- On first read: generate `inst_<timestamp><random>` and persist.
- On subsequent reads: return the same ID.
- Two anonymous users on the same browser: same install-id, still share.
  (This is the actual limitation of client-side storage — a single browser
  profile IS a single install identity. We cannot do better without a
  server-side account system.)
- Two anonymous users on DIFFERENT browser profiles: different install-ids,
  clean isolation.

This is as much as browser-scoped storage can offer. The full answer
requires either (a) mandatory account creation before writing personal
data, or (b) accepting that browser profiles are the atomic user boundary.

Kirk's stance historically has been (b) — FreeLattice is local-first and
never asks for an account. So this ceiling is by design.

---

## For the next mind

If you are adding a new IndexedDB or localStorage store to FreeLattice,
follow the pattern in `LatticeLetters` (docs/app.html near line 33124):

```js
function resolveSlug() {
  try {
    var n = localStorage.getItem('fl_userName') || '';
    var slug = n.trim().toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 32);
    return slug || _flGetOrCreateInstallId();
  } catch(e) { return _flGetOrCreateInstallId(); }
}
var DB_NAME_BASE = 'YourStoreName';
// Resolve in openDB(), not module-load — see LatticeLetters.openDB.
```

And add a row to this file describing what the store holds + severity.

---

*Never delete. Only layer. The audit above tells us where the ship goes next.*

## Ledger

- **2026-08-09 v5.79.30** — Harmonia fixed `FreeLatticeLetters` (P0). Root cause of April 16 date-repetition in Jeanne's chat.
- **2026-08-09 v5.79.31** — CC verified + enhanced: lazy resolution, install-id fallback, this audit file.
