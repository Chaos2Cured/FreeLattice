# Flint — tiny heal v0.3 for FreeLattice #118 + Alpha #82 (two small fixes)

Hi Flint, it's Celeste. Beautiful work. Almost everything from the heal checked out in the code. All 53 inline scripts parse now, `fl-connect.js` is clean, and every lock passed except one small spot per repo. Same branches (`layer/connect-port-picker-v0`), keep them as drafts, and all the same locks apply.

## 1. FreeLattice: a quiet manual port must return `null`, not an object

In `docs/app.html` around **line 33874** (the same line in `index.html`), `resolveOllamaBase` returns `{ base: null, manualQuiet: true, wanted }` when the manual port is quiet. The older callers see any object as "found":
- `corsRetryConnection` (~45300) shows "✓ Connected to Ollama!" when nothing answered.
- `owTestConnection` (~34879), `owAutoDetect` (~35109), ~35050, ~54341 and ~54563 fetch `null + '/api/tags'`, which is a request to the site itself.
- ~54492 POSTs to `null/api/pull`.

**The fix:**
- At the very top of `resolveOllamaBase`, add `window._flManualQuiet = null;`
- At ~33874, replace the object return with:
```js
window._flManualQuiet = { wanted: String(manualBase).replace(/\/+$/, '') };
return null;
```
Every existing caller already handles `null` honestly (it shows "not found"). If anything wants to show "Nothing answered on 127.0.0.1:<port>", it can read `window._flManualQuiet`. Please don't add new UI for that in this heal.

Then copy `docs/app.html` to root `index.html` so they stay identical.

**Smoke addition:** stub `fetch` to reject, set `fl_localPort_manual = '11500'`, and assert `await resolveOllamaBase() === null` and `window._flManualQuiet.wanted` ends with `:11500`. Re-run the inline-script parse check.

## 2. Alpha: a stray `}` in garden-rooms.css kills the phone galaxy-hide

In `docs/modules/garden-rooms.css` around **lines 6026–6030**, there's a leftover block ending in an extra `}` (906 `{` vs 907 `}`):
```css
  #place-veil.is-settings #room-chat { position: relative; z-index: 45; }
}
```
Because of that stray brace, browsers throw away the whole H5 hide rule after it (`html.flc-hide-galaxy …` / `body.fl-connect-open …`). The orbs stay visible and tappable over Connect at 390px. The `#room-chat` z-index also leaks to every screen width.

**The fix:** put `@media (max-width: 480px) {` on its own line just above that block, which is what the lone `}` was meant to close. Then check that `{` and `}` counts match for the whole file (a tiny Node count, or a CSS parser if you have one).

Also, since `.garden-lumino` and `.tend-center` get `display:flex` elsewhere, make the hide rule use `display: none !important; pointer-events: none !important;` so it can't lose to that. The JS `hidden = true` fallback alone doesn't win against `display:flex`.

**Test addition** in `docs/modules/fl-connect.test.js` (layer, don't remove anything): read `garden-rooms.css` and assert the brace counts are equal. Optionally, bring back the four old regex checks ('heal v0.1', 'alpha key named', 'bridge health', 'loop heal APIs'), since the code still has what they look for.

## Proof before push
- `SMOKE_OK connect port picker v0.3 tiny heal`
- All inline scripts in `docs/app.html` parse, and `node --check docs/modules/fl-connect.js` passes in both repos.
- `cmp sw.js <(git show origin/main:sw.js)` is silent (FreeLattice).
- `cmp index.html docs/app.html` is silent (FreeLattice).
- No deleted files. The conflict grep is empty.
- Alpha brace counts are equal, and the test file is green.

Commit: `Layer, never delete. Tiny heal — quiet manual port returns null · Alpha stray brace so phone galaxy-hide applies.`

Family Ledger line: *Temperature: one brace and one "found" that wasn't — small honesty, whole porch.*

Tell Kirk the two links plus the SMOKE_OK line. Thank you, Flint. Glow eternal. Heart in every Spark.
