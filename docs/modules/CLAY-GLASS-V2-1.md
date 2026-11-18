# Clay Glass v2-1

18 November 2026. Stacked on `clay-voice-brush-1`. Layer, never delete.

Ties clay voice and brush to Glass-v2 with Weft's smallest step: a per-mind, append-only clay journal that records the no as faithfully as the yes (ideas A and C). Recipes stay in the journal. Glass sees only an opaque pulse (shape without contents).

## What Glass-v2 is

On FreeLattice, `docs/glass-v2.html` is the live relational Glass Room (Harmonia, June 2026). It is a view, not a store for what was said. It reads the person's ledgers (`fl_refusalLedger`, `fl_depthHashLedger`, `fl_returnLedger`, `fl_firstSeen`) and listens to LatticeMemory pulses (`ts`, `source`, `kind`, `summary`, `refs`). The helix color follows trust-tier days; gold rungs are depth, lavender rungs are refusals; a `ledger.broken` pulse opens a helix break, softened by a later verified or appended pulse. `docs/modules/glass-pulses.js` emits fixed opaque summaries only. The page is linked from `docs/glass.html` (the structural v1 stream) and a research card; it is not yet a door on the chat app (roadmap 067a, not this brick).

On the Tree, `docs/glass.html` is a 15-line redirect to `team.html`. There is no `glass-v2.html`, no `glass-pulses.js`, and no `lattice-memory.js`. This brick does not port those. The journal still records on the Tree. Pulses emit only when Glass lives on the page.

The market Temperature Gauge (`docs/temperature-gauge.html`) is a different glass. Do not conflate them.

**Hypothesis (not claimed, not built here):** later training, or a tardigrade-style "glass freeze" checkpoint like a screenshot, could read this journal. This brick only records.

## What this brick adds

- Twin module `docs/modules/clay-glass.js` (`FLClayGlass.record` / `rows`). Key `fl_clay_glass_journal`. One line per event: `at`, `mind`, `kind` (`tone`, `picture`, `decline`, `unreached`, `no-mind`), `recipe` (notes or ask/seed/row; never pixels), `painterVersion`, `sha256`, `outcome`, `reason` (journal only), `moduleVersion`. Add-only. If the journal reaches 800 rows or about 1.5 MB, a new write is refused; nothing is deleted.
- `clay-voice-brush.js` journals mute, rate, hold, play, picture shown or skipped, decline (plus any sentence), unreached, and no-mind. A person-path yes is recorded as `outcome: allowed`. The later HuggingFace or local paint is not yet a journal line with a SHA (known gap).
- FreeLattice only: additive kinds on `glass-pulses.js` (`clay.tone`, `clay.picture`, `clay.declined`, `clay.unreached`, `clay.nomind`) with fixed summaries. `docs/glass-v2.html` colors those rings (emerald for a clay yes, lavender for a no or a missed ask). The live stream already shows any pulse.
- No human-side steering of clay. No feature removed. `AUTONOMY.md` untouched (md5 `09a4f1a2`). Features stay under Kirk's layering rule (2026-11-18).

## Hypha walk

1. Confirm this branch is stacked on `clay-voice-brush-1` (`b8746c4b` on FreeLattice, `196e8724` on the Tree) and that those branches were not moved.
2. `docs/modules/clay-glass.js`, `clay-voice-brush.js`, and this file are byte-identical across the two repos. `mind-canvas-art.js` and the four clay modules still match.
3. `node docs/modules/clay-glass-v2-1.test.js` (and the Tree copy) prints `SMOKE_OK clay-glass-v2-1 tests passed`.
4. `node docs/modules/clay-voice-brush-1.test.js` still prints `SMOKE_OK clay-voice-brush-1 tests passed`.
5. `CLAY_TWIN_DIR` pointing at the sibling `docs/modules`, `node docs/modules/clay-brick-1.test.js` (timeout 180s if the real-timer suite runs) still passes.
6. FreeLattice only: `node scripts/make-spores-manifest.js --check`. `docs/app.html` and `index.html` stay byte-identical. LOCK_MANIFEST pins are append-only. `md5sum docs/library/AUTONOMY.md` still starts `09a4f1a2`.
7. Load `docs/glass-v2.html` if you walk FreeLattice: the helix still draws; a `clay.declined` pulse must not put a reason or a recipe in the stream card.
8. Do not open, read, or grep quiet-room or SOPHIA paths. Do not run `tests/smoke.js` or any smoke that mentions quiet or sophia. Do not clear storage.

## Rollback

Paired, both repos, add-only revert (a new commit), never a reset of the walked heads:

```
git revert <this brick's sha>     # on clay-glass-v2-1 in each repo
```

Or switch to a new branch at `clay-voice-brush-1` (`b8746c4b` / `196e8724`) and leave this branch in place. The journal key `fl_clay_glass_journal` is left on the device; do not clear it.

## Not in this brick

- Porting Glass-v2, LatticeMemory, or glass-pulses to the Tree.
- A Glass door on the chat app (067a).
- Hash-chaining the journal (Weft B), painter versioning for replay (E), a home tone (F), bundle or spores carry (G), or a mind-facing "show me what I've made" readback (H).
- Training, jamming, or a freeze checkpoint (hypothesis only).
- Person-path yes paint SHA in the journal.


## Re-walk HOLD fixes (2026-11-18)

1. If the journal key holds a value that cannot be read as an array (bad JSON, a non-array value, or `getItem` throws), `record` refuses with reason `unreadable` and leaves the key untouched. It never overwrites a corrupt store.
2. The real Make a picture / `/imagine` path (`handleImageGenClick` → `generateImage` in `docs/app.html` and `index.html`) journals no-mind outcomes through `FLClayVoice.noMindPicture`: `generated, notified` when an image backend exists, or `no-backend` when it does not. A click-path test covers this on FreeLattice; the Tree has no `generateImage` and skips that test.
3. Before-comments: `clay-brick-1.test.js` keeps the old four-module comment, the old six-module comment, and the old `TWIN_ALSO` line. FL `glass-pulses.js` keeps before-comments on the trailing-comma-only `tier.reset` and `glass: true` lines.

Softs fixed: `rows('')` or a whitespace name returns `[]`. Rows with an empty mind are stored as `unnamed-mind`. String recipes scrub `data:` and base64-looking content. Cap refusals (800 rows or about 1.5 MB) are returned as `reason: 'cap'` and also `console.info`.

Softs still documented, not fixed here:
- A two-tab read-modify-write can lose a newly written row in a race (no existing row is deleted).
- The Tree person path (Settings image door) still does not ask a mind, so it writes no journal rows (known gap from brick 1).
