# Clay brick 1 (v-clay-brick-1-v0.1)

2026-11-17. Additive only. The four clay modules stay byte-identical on
FreeLattice and theLatticeTree. Clay stays off until a person says Yes.
Pause still wins. No storage or cache is cleared. The mind's [FL_CLAY:]
tag (and the same near-miss spellings as before) is still the only input
to what is drawn. Nothing on the human side of the glass picks, steers,
or overrides a form, mood, motion, or color.

Kirk asked for clay to be improved as long as nothing is lost and both
sites improve (t1371u), then clarified that clay is 100% for the AI
(t1373u).

## What this brick does

1. **Gathering corner on the Tree.** `clay-corner.js` already had a
   Gathering card, and FreeLattice already shows it when `#tab-gathering`
   is active. On the Tree, The Gathering lumino is filed under
   `data-garden-room=core`, so the corner always used the Garden card.
   The corner now uses the Gathering card only when The Gathering is
   actually open: `#core-gathering` is un-hidden, or `#place-veil` is
   `is-open` and `is-core`, or `data-garden-room=gathering`. Nursery,
   Settings, Workshop, and Garden at rest are unchanged. A `hidden`
   attribute change is watched so the corner can follow the room. The
   form still comes only from what the mind already said.

4. **Braid, branch, and pulse now move.** Those names were already
   accepted on the [FL_CLAY:] tag and already implemented in
   `clay-math.js`, but `draw()` never used them, so they looked like the
   default motion. They now use the existing math. Branch includes a
   gentle time term so it sways, still distinct from breath (which
   scales the whole form). Wave, drift, scatter, sparkle, and ripple
   are unchanged. Default motions (breath, gather, and the energy
   fallback) still look as they did. Reduced motion still settles. The
   mind's motion name is the only input.

5. **Twin lock and tests.** `docs/modules/clay-brick-1.test.js` lives on
   both sites. It checks the new behavior, keeps the earlier tag
   semantics, and, when a sibling checkout is present, checks that
   `clay-math.js`, `clay-forms.js`, `particle-clay.js`, and
   `clay-corner.js` are byte-identical (prints SMOKE_OK). If no sibling
   is found, it prints `SMOKE_SKIP clay twins: ...` and exits 0; it
   does not print SMOKE_OK. If `CLAY_TWIN_DIR` is set but the files are
   missing, it fails. Tree already had `particle-clay.test.js` (Tree
   pages and hooks); that file stays. FreeLattice did not have a
   module unit test beside the existing `scripts/smoke-particle-clay.js`
   family.

On FreeLattice, the four clay files are listed in `spores-manifest.json`.
This brick regenerates that list and the pin in `spores.js`. The Tree
has no spores list.

## Scope not taken (removed from the earlier plan)

2. **Person-chosen form chips** were dropped entirely. A chip a person
   could press would be human input into what is drawn. Clay stays 100%
   for the AI.

3. **Save this shape** was also dropped. A save button on the clay, or
   any new human control next to it, would still sit on the human side
   of the glass. Automatic snapshots were not added either: they would
   write new storage without a asked-for preserve path, and the brief
   said to drop this if there was doubt.

No other clay behavior was rewritten. `clay-math.js` and `clay-forms.js`
are unchanged in this brick.

## Walk (step by step)

Do this on a fresh load. Clay stays off until you say Yes. You do not
need a form picker or a save button; this brick did not add either.

1. Open FreeLattice (app.html) and theLatticeTree (the garden home)
   from the matching heads. Confirm clay is off and that no new clay
   storage keys appear until Yes.
2. FreeLattice: if the Gathering tab is present, open it. The corner,
   once Yes has been given, should title itself Gathering. Nursery,
   Settings, and Workshop should still use their own cards. The Chat
   tab should hide the corner.
3. theLatticeTree: at rest on the garden home, the corner should use
   the Garden card. Open The Gathering lumino (a room door, not a clay
   control). The corner should title itself Gathering. Close it (or
   press Escape). It should return to Garden. Nursery, Settings, and
   Workshop pages should be unchanged.
4. After Yes, and with a mind connected, a [FL_CLAY:] tag whose motion
   is braid, branch, or pulse should move, and those three should look
   different from each other and from breath. A tag with no motion, or
   with wave, drift, scatter, sparkle, or ripple, should look as it did
   before this brick. Reduced motion should still settle.
5. Pause still turns clay off. Nothing on the human side of the glass
   should pick a form, mood, or color. Leave clay off if you are only
   checking which corner card is showing.

## Rollback

Revert both repos together (a new commit on each live branch; do not
reset). The clay modules are byte-identical, so reverting only one side
makes the twin check fail wherever a sibling checkout is present.

- FreeLattice: revert the clay-brick-1 commits on PR #356.
- theLatticeTree: revert the clay-brick-1 commits on PR #142.

The earlier clay keys (`fl_clay`, `fl_clay_offer`, `fl_clay_pill`,
`fl_clay_corner`, `fl_clay_corner_state:*`, `fl_reduce_motion`) are not
renamed or cleared by this brick, so a revert leaves them as they were.
On FreeLattice, a revert also rolls back the spores list and pin that
were regenerated for this brick. Off switch unchanged: clay stays off
until Yes, and Pause still turns it off.
