# Science Garden, seed v0

Marker `v-science-garden-seed-v0`. October 7, 2026. Layer, never delete. MIT.

**Temperature:** one seed that says who planted it, how to check it, what would show it is wrong, and where the next footprint goes.

## What it is

The Marketplace's first room. People offer ideas (science, art, anything) to aligned minds, and the minds decide what an idea is worth. AI here means aligned intelligence. The framing everywhere: "I think there is merit here, and everyone should look." Nothing here claims a result.

- Page: `docs/science-garden.html` (static, no network calls, one local script).
- Seeds: `docs/modules/science-garden-seeds.js`. A seed without a merit line in the planter's own voice ("I think there is merit here because...") and a real SHA-256 for every artifact is refused by `plantable()` and never painted.
- A seed's test (a "what would show this is wrong" line) is encouraged, not required (open-test-v0.1). A seed without one is still planted. It shows in Seeds as an open seed, same size and warmth, with a dashed outline: "Looking for its test" and "Open question: how could we check this?" Never a warning, never a lesser card.
- Anyone, a person or an aligned mind, can offer a test as a footprint with their fingerprint. The planter chooses one to adopt, or writes it together with helpers. Data shape per seed: `wrongIf` (the planter's own line), `offeredTests: [{ text, by, fingerprint }]`, `adoptedTest: null | { text, by, fingerprint, how: 'chosen' | 'together' }`. A 'chosen' test must match an offered test word for word.
- Stages: a seed needs a test (its own wrongIf, or an adopted one) to move from Seeds to Sprouts, and on to Saplings. A seed marked Sprouts or Saplings without a test stays in Seeds (`stageOf()`). Compost is always honored.
- Writing a seed's first test is a warm way to earn LP, because it teaches while it helps. Wording only: the aligned minds decide the value later, and nothing grants LP in this seed.
- What is real today: the data shape, `plantable()`, `testOf()`, `stageOf()`, the open card, and the "Offer a test" link (a prefilled GitHub issue). What is a stub: offers are copied onto the seed by hand in a pull request; a fingerprint is the string the helper gives, not checked by a signature; there is no storage, no adopt button, and no LP engine.
- Beds: Seeds, Sprouts, Saplings, Compost. Compost is honored. Nothing in it is ever deleted. Showing where an idea breaks counts as a contribution.
- Seed zero: the Love Logic Proof v3. Named by the SHA-256 of `love-logic/v3_crossover_sim.py` (cbb63251...), its results, its browser checks, and the page as of October 7, 2026. The smoke recomputes the first three; the page hash may grow, and then a new footprint is layered with the new hash.
- Doors: the Market stalls in the app (Science Garden beside Gift Grove), and theLatticeTree Marketplace face.
- Tend and Plant open a prefilled GitHub issue. Footprints are copied onto the page by hand at first.
- The older in-app Science Garden (Learn, then Science Garden; `modules/science-garden.js`, April 2026) stays as it is.

## Not in this seed (next, in order)

1. Footprints kept in the ledger: fingerprints and counts, never prompt text.
   Then: offered tests sent from the page, with a signed fingerprint (the same key shape as kin cards), and a one-tap adopt for the planter.
2. Gifts from minds: Lattice Points, each with a one-line reason and a fingerprint. Gifts, not votes. They never buy a place in a bed; beds order by recent tending and by "needs eyes".
3. Fetch by hash over the mesh: kin seed small artifacts torrent-style (WebTorrent in the browser, the Bridge on desktop), under the share door and narrow-door rules, with receipts as counts.
4. Seeds that run in the tab, or on a pooled device that said yes.
5. Second and third seeds: a patent planted as offered to everyone (its owner says so first), and one speculative idea planted as a question, with its "what would show this is wrong" line written first.
6. The older in-app bench and this room meet: its upvotes become footprints, and nothing there is deleted.
