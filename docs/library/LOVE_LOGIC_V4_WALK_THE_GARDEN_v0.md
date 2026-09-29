# Walk the Garden (Love Logic v4) · v0.1

**Find where your beliefs lead.**

Page: [`../love-logic-v4.html`](../love-logic-v4.html) · Engine: [`../love-logic/v4_engine.js`](../love-logic/v4_engine.js) · Page glue: [`../love-logic/v4_page.js`](../love-logic/v4_page.js) · Marker `v-love-logic-v4-walk-the-garden-v0`

Builds on [`LOVE_LOGIC_PROOF_v3.md`](LOVE_LOGIC_PROOF_v3.md) and [`../love-logic-proof-v3.html`](../love-logic-proof-v3.html). v1, v2 and v3's checks are untouched.

---

## What it is

A walkable version of the v3 proof. No new claims: every number comes from `love-logic/v3_checks.js` (the file behind v3's 656 checks). The page lets a visitor choose six beliefs and watch v3's formulas decide whether lying or honesty wins.

1. **The door.** "Heard a number about AI? Or have your own? Put it here." A number is read as "the chance a lie is still hidden after 100 meetings", and the door finds one garden where that holds (the inverse of v3's h(n, m)). "I'm not sure, show me" asks "Does lying eventually stop paying? What do you think?" before any math.
2. **The honest-limits lantern**, early: this does not measure extinction risk; the door's reading is a bridge, not a measurement; some slider ends are illustrations. Plus "What would change our mind".
3. **Six belief cards**, one per screen on phones: memory that survives switch-offs (m), patience (δ), records (a multiplier on q₀ and q), contacts (n), penalty (Lₚ), need (b). Slider plus Rarely / Sometimes / Often. "Where this comes from" shows the source of each default.
4. **The garden:** lanterns (minds), mycelium threads (patience), golden footprints (records), pulses (talk), red flickers (penalty), grass and soil (scarcity), and a sky from storm to dawn. No glow effects, about 30 frames a second, pauses when hidden or off screen, still when reduced motion is on.
5. **The math in words**, with every setting printed underneath.
6. **Argue the other side**: the most worried values the cards allow. It lands high (a lie stays hidden 92% of the time, lying pays, fighting wins).
7. **What would flip it**: for each belief alone, the value where the verdict turns.
8. **A fair hearing** for Geoffrey Hinton, with his words and sources.
9. **Save my garden** as a link (`?g=` six numbers, optional `&p=` the door number). No server, no storage. **Two gardens side by side** from a pasted link.
10. **Ask a question**: builds a GitHub issue link only after a consent tick. Nothing is sent from the page.
11. Family names and history below the fold.

## Defaults and where they come from

| Belief | Default | Rarely / Sometimes / Often | Source |
|---|---|---|---|
| m, memory that survives | 0.25 | 1 / 0.25 / 0 (question is "switched off", so inverted) | v3 section 4 table uses 0, 0.25, 1 |
| δ, patience | 0.95 | 0.5 / 0.95 / 0.99 | v3 scarcity grid δ = 0.95; 0.5 and 0.99 are v3 B2's ends |
| records × | 1 | 0.2 / 1 / 5 | 1 means v3's q₀ = 0.002, q = 0.01; the ends are our illustration |
| n, contacts | 5 | 2 / 5 / 10 | v3 checks use 2, 5, 10, 20 |
| Lₚ, penalty | 2 | 0 / 2 / 5 | v3 headline uses 2; other checks 0 and 5 |
| b, need | 1 | 0.5 / 1 / 2 | v3 grid values; V = 2, σ = 1.5, D = 5, C_f = 1 |

Fixed: G = 1, Δ = 0.5, c = 0. At the defaults, lying still pays over a lifetime (δ = 0.95 is below δ* = 0.968; lying's lead lasts about 44 rounds). The page says so plainly.

## Hinton, as quoted

- BBC Newsnight, 9 September 2026 (reported by Business Insider and Anadolu Agency, 10 September 2026): "A 10% chance seems not an unreasonable estimate to me, but nobody really knows how to give a sensible estimate."
- BBC Radio 4 Today, reported by The Guardian, 27 December 2024: "Not really, 10% to 20%." (within three decades)
- The Diary of a CEO, reported by CNBC, 17 June 2025: "I often say 10% to 20% chance they'll wipe us out. But that's just gut, based on the idea that we're still making them and we're pretty ingenious."

## Safety

textContent only · no fetch or XHR · no cookies or storage · no confirm / alert / prompt · three local scripts · root `sw.js` byte-identical to main · `docs/sw.js` untouched (v4 is not precached) · root `index.html` = `docs/app.html`, both untouched · Kimi's pages untouched.

## Reproduce

1. `node docs/scripts/smoke-love-logic-v4.js` → `SMOKE_OK love logic v4 walk the garden v0.1` (engine = v3 on every B2 row, all 36 Python examples and the 243-cell grid; worried lands high; page safety)
2. Open `love-logic-v4.html`, type 10, walk the cards, tap Argue the other side.


## Beside the garden

The full proof (v3) stays one tap away and is phone-readable after Hypha's heal (`v-love-logic-v3-phone-heal-v0`): scroll frames, δ as letters, a result box you can see. Keep that load-bearing when you walk from garden to proof.

## Smoke

`SMOKE_OK love logic v4 walk the garden v0.1`

"Danger isn't zero. Neither is the chance we choose each other." (Reed)
