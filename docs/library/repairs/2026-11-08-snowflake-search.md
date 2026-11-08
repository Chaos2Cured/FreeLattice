# Snowflake search reach, 2026-11-08

Marker: `v-snowflake-reach-v0.1`. Index: [INDEX.md](INDEX.md). Contract: [SNOWFLAKE_SEARCH_v0.1.md](../SNOWFLAKE_SEARCH_v0.1.md).

## Resume

- Baseline: `832d89425996a70b2ecd721bac817faa81c3e79c` (`main`, fetched 2026-11-08, even with origin/main).
- Narrow retrieval head Hypha scoped PASS: `3d46ae090b9c8da30e54c3d224d727f4eaf28eaa`. That PASS is not model, browser, or Mac readiness.
- This correction is a later commit on the same branch. The pull request body names its head.
- AUTONOMY.md md5 unchanged: `09a4f1a286226e37089a93df42df0106`.
- Quiet Room: not opened. This correction does not read `quiet-room.js` and does not load `app.html`.
- No training run. No storage clear. No worker deploy. No Mac directory change.

## Root cause

Reproduced on this baseline before any edit, with `callAI` returning `No AI connected yet` and `fetch` ready to return a real Wikipedia-shaped item.

`startRun` asked the mind to plan first. `ask` retried that failure once. The plan text was null, so the `if (text)` branch never built search jobs. `proceed` finished an empty job list. The status line was "That call did not come back." No search fetch was sent.

Receipt scope: `receipt.calls` is `active.calls` at the start of `finish()`, before the growth ask and before the six drift prompts. It is not the number of `callAI` entries.

Recounted on the baseline file and on this worktree, with `GardenTrainer.exportJSONL` and `exportPythonHelper` present, battery charging, and `requestIdleCallback` firing. `callAI` returned `No AI connected yet`. Fetch was ready to return one Wikipedia URL.

| Tree | receipt calls | receipt fetches | `callAI` entries | fetch calls sent |
|---|---|---|---|---|
| baseline `832d8942` | 2 | 0 | 24 | 0 |
| this worktree before the correction commit | 1 | 5 | 1 | 5 |

The baseline 24 is the call cap. The receipt stays at 2. Growth still runs, then drift keeps calling until `active.calls` hits 24. An earlier note said 4 `callAI` entries. That count was a harness that did not enter drift. It was too small. Hypha's 24 and 1/5 match this recount.

On this worktree the absent-mind path does not enter growth, so `callAI` stays at 1 and the five arm lookups are the 5 fetches. That stub is not a reachable model.

The sixth arm title "Looking for its challenge" is drawn on every crystal. It staying on screen is not evidence that search hung.

The live helper was checked the same day, separately from that fixture:

`GET https://freelattice-data.freelattice.workers.dev/search?q=solar%20energy` with `Origin: https://freelattice.com` returned HTTP 200, `items` with Wikipedia `https://` URLs, `source` `duckduckgo+wikipedia`, `cache-control: no-store`, and `access-control-allow-origin: https://freelattice.com`. The worker root and `/page` still return the chart usage error. Snowflake page depth therefore stays snippet unless a device has its own page route. That was already true. It is not the Calls 2 / Fetches 0 failure.

So the search algorithm and the helper were not what stopped the run. A missed plan skipped retrieval, and the miss was reported as a generic call failure.

The November 7 site audit is context only. It saw the same Calls 2 / Fetches 0 shape on a Linux desktop with no mind. That observation matches this gate. It is not evidence about Kirk's Mac Ollama, and it was not used as the diagnosis.

## What changed

Still in `docs/modules/snowflake-core.js`. No new runtime module.

- A missed plan still installs arms a through e and looks them up.
- `No AI connected yet`, `No AI provider configured.`, and `Provider not configured.` are not retried. The status line says to connect a mind in Settings, and says sources can still be looked up.
- `Could not reach local AI.` is retried once, then later mind calls stop, and the lookups still run. The receipt keeps that sentence instead of "That call did not come back."
- When the mind does not answer, a node keeps the fetched `https` URL, the source's own words, confidence `guessed`, and a reason that says no mind read it. Reference helpers are named as reference answers, not live news. A model URL is not allowed to replace the fetched URL. `known` is refused when there is no fetched `https` URL or no mind text.
- A concluded line is not invented when the mind did not write one. "I learned something, and I am still looking." remains only for a real mind reply that omitted the two lines.
- Network failure and a missing HTTP status are `unreachable`, not "error 5xx". HTTP 404 is "not with results (error 404)", not "No results." HTTP 503 stays the 5xx line. An empty 200 stays "No results." HTTP 429 says the helper is busy and is not auto-retried. Timeout stays "Search took too long." A lookup is still fetched at most twice. `snowflake-search.js` has no Try again control.
- Ask-first is unchanged: one ask for the run, a no fetches nothing, and off does not ask.
- The receipt always says `Memory in context: no.` unless a prompt actually received memory text. This repair does not copy memory into the Snowflake prompt. `rememberFlake` still stores the flake id and psi, not the question.
- Empty, already-growing, hourly cap, and replay-held each emit a visible line.
- `sw.js` and `docs/sw.js` fetch `snowflake-core.js`, `snowflake-search.js`, and `snowflake.css` network-first, then cache. `CACHE_NAME` stays `freelattice-v5.79.46`.

## Hashes

| File | md5 |
|---|---|
| `docs/modules/snowflake-core.js` | `b432c9b26a4c67e24ed5791a8831c7a9` |
| `docs/modules/snowflake-search.js` | `83ada822df056805644b97d45240fcb2` |
| `sw.js` and `docs/sw.js` | `b648edbaf62997edd6efbdaf7f80ba47` (was `2b2f5504fecdef4d97174da2759a58f9`) |

Lock rows were appended in `docs/library/LOCK_MANIFEST_v0.1.json`. Older rows stay. The four smokes that pin the service worker md5 keep the old hash in a `before` comment.

`docs/app.html` and `index.html` were not edited.

Version files, read directly, not from `tests/smoke.js`:

- `docs/app.html` has `const FL_VERSION = '5.79.45'`.
- `docs/version.json` has `"version": "5.79.45"`.
- The repo-root `version.json` has `"version": "5.8.0"`. That is a different file. The earlier note called it `docs/version.json`. That was wrong.
- The live assignment in `docs/sw.js` is `const CACHE_NAME = 'freelattice-v5.79.46'`. A comment above it still contains `freelattice-v5.79.45`. Both lines were already on the baseline. This repair did not change either constant.

`tests/smoke.js` was not run. It reads `docs/modules/quiet-room.js`, so it was left unrun on purpose. Its cache check is `sw.match(/const CACHE_NAME\s*=\s*['"]freelattice-v([^'"]+)['"]/)`, and `String.match` without `/g` returns the first hit. On `docs/sw.js` that first hit is the comment, `5.79.45`, and the second hit is the live constant `5.79.46`. No pass or fail of `tests/smoke.js` is claimed.

## Tests

Run on the worktree that became `3d46ae09`, before this correction. Stubbed mind and stubbed search unless noted. Not re-run in the correction pass if they load `app.html`.

- `node docs/scripts/smoke-snowflake-node.js` printed `NODE_OK snowflake`. Stubbed mind and stubbed search.
- `node docs/scripts/smoke-snowflake-reach-v0.1.js` printed `REACH_OK snowflake v0.1 unit`. No network. The absent-mind case is one `callAI` and five fetches. A separate case stubs a mind that returns JSON, records that the prompt contains the fetched URL, and checks the stored URL is the fetched one. That is still a stub. It is not a reachable model.
- `node docs/scripts/smoke-snowflake-search-live.js` printed `REAL_OK`. Real helper, no model. Five Wikipedia items, source `duckduckgo+wikipedia`.
- `node docs/scripts/smoke-honest-boxes-sol-v0.1.js` printed `SMOKE_OK honest boxes sol v0.1`. Its browser half loads two in-memory fixtures, `honest-fixture.html` (pool-honest-label only) and `snow-fixture.html` (snowflake css and js only). It does not navigate to `app.html`. It checks that no quiet tab is marked active. It is not a visual matrix.
- `node docs/scripts/smoke-search-heal-v0.1.js` printed `SMOKE_OK search heal v0.1`. It loads `docs/app.html`. That page registers `sw.js`. This correction does not run it again.
- `node docs/scripts/smoke-snowflake-search-v0.1.js` with `FL_CHROME=/usr/local/bin/google-chrome`, `FL_PLAYWRIGHT=/tmp/gc-pw-local/node_modules/playwright-core`, and `FL_SHOT_DIR=/tmp/snowflake-shots` printed `SMOKE_OK snowflake search v0.1` and `SMOKE_OK snowflake grow v0.1`. It also loads `docs/app.html`. This correction does not run it again.

What that app.html smoke actually covered: a stubbed `callAI`, a stubbed `fetch` for `?q=`, and the snowflake host. It measured 1280 by 800, then 390 by 844, and printed contrast lowest 7.31 on `#flSnowflakeCardUrl`. A second browser context at 640 by 400, device pixel ratio 2, opened the add menu and the snowflake panel and checked visible buttons were at least 44px. It did not grow a flake in that second context. Shots written only under `/tmp/snowflake-shots`: `mid-1280.png`, `mid-390.png`, `report-1280.png`, `report-390.png`, `card-1280.png`, `card-390.png`. `docs/css/snowflake.css` was not edited. Those shots and the contrast number are not a visual-matrix PASS. Loading `app.html` is not a Quiet-free run.

Correction pass, this worktree, no `app.html`:

- The baseline versus worktree `callAI` recount above.
- `node docs/scripts/smoke-snowflake-cache-strategy-v0.1.js` with the same Chrome and Playwright printed `STRATEGY_OK isolated worker. Not an installed app. Quiet was not requested.` The page is a one-line fixture. The worker is embedded in the script. It is not `docs/sw.js` running, and it does not precache the app shell. Observed: a cache-first worker kept `OLD` after the server body changed; after the controller switched to the network-first worker the body was `NEW`; HTTP 503 returned status 503 and body `unavailable`; a dropped connection then returned the cached `NEW`. The fixture awaits its cache write so that last step is stable. The product worker does not await `cache.put`. This is the same strategy Hypha scratched, not an installed-app proof.

## Limits

- Kirk's Mac, Ollama, LM Studio, and any cloud model key were not connected. A reachable mind is covered only by the stub that records the prompt and checks that the fetched URL is what gets stored.
- A browser CORS failure cannot be told apart from a dropped network. Both use the unreachable line, which names the connection and a possible origin refusal. Node's live probe prints the `access-control-allow-origin` header. It does not simulate the browser's block.
- Page text is still snippet-only on the public helper, because `/page` is not a page route.
- Pause then Resume clears the "stop calling the mind" flag from a dead local call, so the next resume may try once more. A definitive "no AI" flag stays for that run.
- This repair does not deploy the service worker. An already-controlled page keeps the previous worker until that worker updates and the controller changes. Network-first applies only after that. A network failure in the new worker can still return the last cached 200. An HTTP 503 is returned as 503. None of that was proved on an installed FreeLattice app.

## Rollback

Revert this branch. Flakes, the ledger, and the training queue are append-only and were not migrated. Old nodes still verify. New nodes may carry `via` outside the signed body. The signed reason string is what says the node was unread.

## Changed files

- `docs/modules/snowflake-core.js` behavior above.
- `docs/modules/snowflake-search.js` status `aria-live`, helper line, and a sentence that signed bytes are not a claim of known.
- `sw.js`, `docs/sw.js` network-first for the three Snowflake assets.
- Smokes and the lock manifest, as hashes above.
- `docs/library/SNOWFLAKE_SEARCH_v0.1.md` one pointer. The contract text is otherwise untouched.
- This note, the index, and `2026-11-08-hearth-next.md`.
- `docs/scripts/smoke-snowflake-cache-strategy-v0.1.js` in the correction. It does not change the service worker.
