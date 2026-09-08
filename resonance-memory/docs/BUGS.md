# Known bugs and defects

Found defects, what they cost, and whether they're fixed. Numbered in the order found, grouped
so related ones read together — check the status line on each rather than the position. A bug
leaves this list only when it is *fixed*, not when it is understood; if it's understood but
unfixed, it stays here with an owner in the backlog.

**Current:** 6 fixed (`BUG-001`, `002`, `003`, `006`, `007`, `008`) · 2 open (`BUG-004`, `005`) ·
2 on the watch list (`W-03`, `W-04`; `W-01` was dismissed, `W-02` was fixed).

**Severity:** `critical` data loss / corruption · `high` user-visible breakage ·
`medium` degradation at scale · `low` cosmetic

---

## `BUG-001` — Non-atomic store writes could truncate the entire memory file
**Severity:** critical · **Status:** ✅ **fixed** (this branch) · **Found:** July 2026

### What
`JsonlStore._writeAll()` replaced the live store with `fs.writeFileSync(this.file, data)`.
That is **not atomic**. `writeFileSync` opens with `O_TRUNC` — the file is emptied first, then
rewritten. A crash, power loss, OOM kill, or full disk between those two steps leaves a
truncated or empty store. **The user's entire memory, gone**, with no backup on that path.

The same pattern was in `Ledger.save()` (the Hebbian sidecar), where the cost was lower — a
corrupt ledger fails to parse and silently resets learned associations.

### Why it mattered
The exposure window opened on **every recall**, not just on writes — see `BUG-002`. A read
operation could destroy the store.

### Fix
`record.js: writeFileDurable()` — write to a temp file in the *same directory*, `fsync`, then
`rename()` over the target. Rename within a filesystem is atomic on POSIX and on Windows, so a
reader observes either the complete old file or the complete new one, never a partial write.

Same-directory placement is deliberate: `os.tmpdir()` is frequently a different mount, and
`rename()` across filesystems is not atomic (and fails outright on some platforms).

`fsync` is wrapped in a try/catch — some filesystems and network shares refuse it, and the
rename is still atomic without it. Failing the whole write because `fsync` is unsupported
would be worse than the durability gap it closes.

**Tests:** `test.js` → "durable writes" (6 tests), incl. a 5,000-record write verified
complete and parseable line-by-line.

---

## `BUG-002` — Every recall rewrote the entire store file
**Severity:** critical (with `BUG-001`) / high alone · **Status:** ✅ **fixed** (this branch)

### What
`applyRecall()` was called on **every** `recall_memory`, and it:

1. parsed the whole store into memory,
2. bumped `access_count` on the ~5 returned rows,
3. **rewrote the entire file.**

So a read did `O(store)` work and — combined with `BUG-001` — opened a whole-store data-loss
window. At 50k memories with 768-dim vectors that's tens of MB re-serialized per recall, plus
proportional SSD wear.

### Root cause
`access_count` / `last_access` are **retention** signals. The project's own ranking invariant
says they never influence retrieval order. Metadata that cannot affect the answer had been
placed on the critical path of producing the answer.

### Fix
Moved to a sidecar: `record.js: AccessLog`, persisted at `<store>.access.json`, folded onto
records at read time. Same pattern `ledger.js` already used for Hebbian weights.

**Recall now performs zero writes to the memory store in steady state.** The only remaining
store write on a read path is embedding backfill, which fires only for legacy rows or after an
embedder outage, and is now durable.

Losing the tail of the sidecar to a crash costs a few access counts — which govern nothing
that affects an answer. That is the correct thing to make cheap.

**Tests:** `test.js` → "recall does NOT rewrite the store" asserts the store bytes *and*
mtime are unchanged across `applyRecall`, while the access bump still lands.
**SQLite (RM-07):** the analogue is not "file mtime unchanged" — a bounded in-table
`UPDATE` of the returned ids is the I5-permitted retention write. The test is:
after recall, only retention columns changed on those rows, row count unchanged,
no other column touched.

### Still open (tracked, not a bandaid)
`all()` still parses the full store on every call, and mutations (`save`/`edit`/`delete`)
still rewrite the whole file. That is inherent to a flat JSONL backend. **`RM-07` slice 1**
ships `SqliteStore` (`store-sqlite.js`, `node:sqlite`, BLOB + JS cosine, no sqlite-vec —
see [`proposed/0010`](proposed/0010-sqlite-backend.md)) as the default backend (slice 4);
`RESONANCE_STORE=jsonl` pins JSONL. Conformance + golden parity are green
(`eval/run.js` sqlite default and `--store jsonl` both 27/31 case-for-case). JSONL's load wall
(50k cannot `readFileSync`) is the reason it exists.

---

## `BUG-003` — `HISTORICAL_RE` missed "previous"
**Severity:** low · **Status:** ✅ **fixed** (this branch) · **Found:** by its own test

The historical-query regex matched `previously` but not `previous`, so "what was my previous
address" was treated as a present-tense question and superseded memories were filtered out of
a query explicitly asking for them. Caught by `test.js` on first run — which is the argument
for `RM-00` in miniature.

---

## `BUG-004` — Store path defaults to `~/.lmstudio/` even for Claude-only users
**Severity:** low · **Status:** 🔲 open · **Owner:** `RM-11`

A user who only runs Claude Desktop gets their memories in a directory named for a product
they don't have installed. Cosmetic, but confusing, and awkward to change later without a
migration. Already noted under "Known limitations" in the changelog.

---

## `BUG-005` — Unsigned binary trips SmartScreen / Gatekeeper
**Severity:** medium (adoption, not correctness) · **Status:** 🔲 open · **Owner:** `RM-11`

First launch shows a scary OS warning. For a product whose core pitch is "trust this with your
private memories," an "unknown publisher" dialog is a real adoption tax. The RM-11 release
matrix now *ships* the unsigned binaries (plus Gatekeeper/SmartScreen guidance in the
Release body and `docs/BUILDING.md`); it cannot silence the OS. Signing / notarization
is the remainder of `RM-11`.

---

## `BUG-007` — Access counts doubled on every store mutation
**Severity:** high (silent data corruption) · **Status:** ✅ **fixed** · **Introduced by:** the
`BUG-002` fix in this same branch

### What
`all()` folds sidecar counts onto records. `_writeAll()` then persisted those *folded* values
into the store — while the sidecar kept its own copy. The next read added them again.

```
2 recalls        -> access_count 2   ✓
   ...one edit   -> access_count 4   ✗
   ...another    -> access_count 6   ✗
```

It compounds without bound, and every `update()` / `delete()` / `vacuum()` triggers it.

### Why it mattered
`importance = access_count` is the retention signal. Nothing consumes it *yet*, so the damage
was latent — but `RM-08` pruning decides what to **delete** based on it. A frequently-edited
memory would have looked far more important than it was, and the corruption is invisible
until something acts on it.

### Fix
`AccessLog.consolidate()` — after a full rewrite persists the folded totals, clear the
sidecar. A rewrite is the natural checkpoint: the store file becomes the authority, the
sidecar restarts from zero. Four regression tests, each failing without the fix.

### How it was found
**Adversarial audit prompted by the reviewer**, not by the tests. The original test suite
covered "recall does not rewrite the store" and "sidecar round-trips" — but never *recall
followed by a mutation*. The bug lived exactly in the seam between two things that were each
tested in isolation.

> **Lesson worth keeping:** a fix for a real bug can introduce a worse one. `BUG-002` was
> genuine and the sidecar is still the right design — but "the old code was wrong" does not
> establish that the new code is right, and my tests were written to confirm the fix rather
> than to attack it.

---

## `BUG-008` — `edit()` destroyed the embedding whenever the embedder was down
**Severity:** critical (silent data loss; recoverable only by re-editing, which nothing prompts) · **Status:** ✅ **fixed** · **Found by:**
roadmap consolidation review, reading `edit()` to answer a schema question

### What
`edit()` set `embedding = null` when the embedder threw, then passed that straight into
`store.update()` — which does `Object.assign(record, patch)`. The null overwrote a perfectly
good vector.

```
good vector -> embedder down -> edit() -> embedding: null -> Object.assign -> vector gone
```

The memory silently dropped to keyword-fallback ranking until someone happened to edit it again, `edit()`
returned `"Edited memory N."` as though nothing had happened, and nothing anywhere surfaced the
degradation. An embedder outage lasts minutes; the damage outlived it indefinitely.

### Why it mattered more than it looked
Same shape as `BUG-007`: a patch path silently overwriting good state through `Object.assign`, with no error raised and nothing checking afterward.
It also breaks a rule the design depends on — a *failed* embed was indistinguishable from a
legitimate embedding change. `ROADMAP.md` Phase 0.0 keys semantic-cache validity on
`embedding_version`, so under that scheme this bug would have had a failed embed masquerading as
a real mutation and silently invalidating every incident edge.

### Fix
Omit `embedding` from the patch entirely when embedding fails, so the null can never reach
`Object.assign`, and report the degraded state to the caller. The edit still applies in full;
only the vector is left behind. A stale vector beats no vector: the record still ranks
semantically, and the next successful edit repairs it.

Guarded by four tests in `test.js` (`edit() embedding safety`), including one asserting a
*successful* re-embed still replaces the vector — so the fix can't regress into never updating
embeddings at all. Verified failing before the fix, passing after.

---

## `BUG-001` addendum — the durability fix has a measured cost

Not a defect, but it was claimed as a strict improvement without measurement, so:

```
20 × rewrite of a 5.9 MB store:  plain 138ms | durable 494ms  (3.58×)
```

`fsync` is the expensive part, and that is the point of it — the guarantee is that the bytes
are on disk before anything references them. The cost lands only on **mutations** (save / edit
/ delete / vacuum), never on recall, and ~25ms for a save that cannot corrupt the user's entire
memory is the right trade. But it is a real cost and it was previously unstated. If it ever
matters, the answer is `RM-07` (incremental writes), not dropping the fsync.

---

## `BUG-006` — Design docs asserted system behaviour without re-checking the code
**Severity:** high (misleads every future decision) · **Status:** ✅ **audited and fixed**

### What
Several design documents made confident claims about how the system currently behaves that
were either **never verified against the source**, or were **true when written and silently
falsified by later commits in the same session**. Found by audit after a reviewer challenged
one of them and it collapsed.

Two distinct failure modes, both worth naming:

**(a) Reasoned from a mental model instead of the code.** `0006`'s problem statement was
rewritten three times, each draft arguing that constraints can't surface — while
`server.js: recallMemory()` already implements a `Related:` channel (four extra slots reached
by association, not competing with the ranked five), applies the Hebbian bonus *before* the
`minSim` gate, and reinforces the edge on every co-recall so the path strengthens with use.
The mechanism the document proposed building was already built, and the built version learns.
The files had been read earlier in the same session; reading is not checking.

**(b) Shipped a change, left the docs describing the old state.** Six claims went stale this
way, every one of them from work in this same branch:

| Doc | Claim | Reality |
|---|---|---|
| `0001` | "`saveMemory()` today is: trim → embed → append" | also confirms exact restatements (`RM-04`) |
| `0002` | "the store has no concept of when a fact was true" | temporal schema shipped |
| `0005` | "every recall rewrites the entire store" | fixed — sidecar, zero writes on read |
| `0005` | "kill-9 leaves an unreadable store" | fixed — atomic writes |
| `COMPETITIVE-ANALYSIS` | temporal metadata ❌ | ✅ shipped |
| `COMPETITIVE-ANALYSIS` | deduplication ❌ | ✅ cosine-banded at save (RM-02.b) + `--dedup-existing` backfill (RM-02.c) |

### Why it matters more than a typo
Every one of these feeds a build decision. `0006` alone would have had someone implement a
static domain model to replace a dynamic one that already exists and is better. A stale
capability matrix distorts the roadmap it was written to justify.

### Rules going forward
1. **Any sentence describing current behaviour must cite the file and be re-read at the time
   of writing.** Not "I read this earlier" — open it.
2. **A behaviour change is not done until the docs describing that behaviour are updated in
   the same commit.** Grep for the thing you changed before pushing.
3. **Where a doc describes a pre-change state deliberately, say so in a status banner** (see
   the ones now at the top of `0002` and in `0005`'s "urgent part") rather than leaving the
   reader to guess.
4. **Prefer "unverified" to a confident guess.** Every claim in this repo that turned out
   wrong was stated confidently; none was hedged.

---

## Watch list — suspected, not yet confirmed

| | Concern | Next step |
|---|---|---|
| ~~`W-01`~~ | ~~`nextId()` collisions within a millisecond~~ | ✅ **dismissed** — `nextId()` returns `max + 1` when the clock hasn't advanced, so it is correct by construction and monotonic even if the clock jumps backwards. Verified by two tests (200 rapid saves, all distinct) |
| ~~`W-02`~~ | ~~Panel binds `127.0.0.1` with no CSRF token — any local process, or a malicious web page via DNS rebinding, could drive the API~~ | ✅ **fixed** — Host must be loopback (DNS rebinding arrives as `Host: evil.example`); Origin, when present, must be this panel; mutating POSTs require a per-process `X-Resonance-Token` baked into the page (a form from another origin cannot set a custom header). Residual: a local process that GETs the page can steal the token — same class as binding `127.0.0.1` at all. No `Access-Control-Allow-Origin`. Tests in `test.js` "W-02". `RM-12` SDKs still wait on documenting the surface. |
| `W-03` | `field.buildEdges()` is O(n²) per recall when the field is on | ✅ **confirmed (S1)** — field-on `recall()` p95 **90.8 s at N=10k**, 724 ms at N=1k. ANN rides with `RM-07`. Curve in [`eval/RESULTS.md`](../eval/RESULTS.md) "S1". |
| `W-04` | A concurrent panel + MCP server write could interleave (last-writer-wins) | Real risk once the panel gains write features; needs a lock or single-writer discipline. Phase 0.3's MCP request-ID dedup is **orthogonal**: it makes one JSON-RPC retry one mutation *inside a single process*, it does not serialize two writers. Last-writer-wins on the sidecar remains. |

---

## Conventions

- **Encode the bug as a test.** Every fix above ships with a test that fails without it, so no
  future backend reintroduces it (see the conformance suite planned in `proposed/0005`).
- **No bandaids.** If the correct fix is a rewrite, do the rewrite or write the bug down
  honestly with its real owner — don't wrap it in a mitigation that adds a layer without
  removing the failure.

---

## Related

[[ARCHITECTURE]] · [[BACKLOG]] · [[ROADMAP]] · [[phase-0-edge-substrate]] · [[DEVELOPERS]]
