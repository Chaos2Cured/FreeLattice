# Snowflake search reach, 2026-11-08

Marker: `v-snowflake-reach-v0.1`. Index: [INDEX.md](INDEX.md). Contract: [SNOWFLAKE_SEARCH_v0.1.md](../SNOWFLAKE_SEARCH_v0.1.md).

## Resume

- Baseline: `832d89425996a70b2ecd721bac817faa81c3e79c` (`main`, fetched 2026-11-08, even with origin/main).
- Review head: the pull request head. This file cannot name that commit before it exists. Hypha reviews that head, not this sentence.
- AUTONOMY.md md5 unchanged: `09a4f1a286226e37089a93df42df0106`.
- Quiet Room: not opened.
- No training run. No storage clear. No worker deploy. No Mac directory change.

## Root cause

Reproduced on this baseline before any edit, with `callAI` returning `No AI connected yet` and `fetch` ready to return a real Wikipedia-shaped item.

`startRun` asked the mind to plan first. `ask` retried that failure once. The plan text was null, so the `if (text)` branch never built search jobs. `proceed` finished an empty job list. The receipt is taken before the later growth ask, so it read: Calls 2. Fetches 0. Failed fetches 0. Branches empty. The status line was "That call did not come back." The stub fetch was not called (`sent` 0). The process made 4 `callAI` attempts in all, because growth asked twice after the receipt.

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

`docs/app.html` and `index.html` were not edited. `FL_VERSION` is still `5.79.45`. `docs/version.json` is still `5.8.0`. `tests/smoke.js` already requires those three to match, and they did not match on the baseline. That red test is stale relative to this repair. It was not waived and not "fixed" by bumping the public version.

## Tests

Unit, no network:

- `node docs/scripts/smoke-snowflake-node.js` keeps the 057 / 061 fixtures. Stubbed mind and stubbed search.
- `node docs/scripts/smoke-snowflake-reach-v0.1.js` is the new fixture file. It is not a live provider test.
- `node docs/scripts/smoke-honest-boxes-sol-v0.1.js` passed on this box, node half and browser half. It checks the 061 prompt shape. It is not the live helper.
- `node docs/scripts/smoke-search-heal-v0.1.js` passed on this box with the same Chrome. Stubbed search. It still expects the 5xx line, "No results.", and one retry.

Live helper, real network, no model:

- `node docs/scripts/smoke-snowflake-search-live.js`
- `REAL_OK` means the helper returned sourced `https` items.
- `REAL_BLOCKED` means the network could not be reached. That is not a pass of search.
- `REAL_FAIL` means the helper answered without sourced items.

Browser, stubbed mind and stubbed search, same as the older Snowflake smoke:

- `FL_CHROME=/usr/local/bin/google-chrome FL_PLAYWRIGHT=/tmp/gc-pw-local/node_modules/playwright-core FL_SHOT_DIR=/tmp/snowflake-shots node docs/scripts/smoke-snowflake-search-v0.1.js`
- Viewports in that smoke: 1280, 390, and 640 by 400 at device pixel ratio 2. Controls under 44px fail the smoke.
- Shots default to `docs/library/snowflake-057/` on a machine that does not set `FL_SHOT_DIR`. Those images are the older walk. This run set `FL_SHOT_DIR` so it would not overwrite them.

## Limits

- Kirk's Mac, Ollama, LM Studio, and any cloud model key were not connected. A reachable mind is covered only by the stub that records the prompt and checks that the fetched URL is what gets stored.
- A browser CORS failure cannot be told apart from a dropped network. Both use the unreachable line, which names the connection and a possible origin refusal. Node's live probe prints the `access-control-allow-origin` header. It does not simulate the browser's block.
- Page text is still snippet-only on the public helper, because `/page` is not a page route.
- Pause then Resume clears the "stop calling the mind" flag from a dead local call, so the next resume may try once more. A definitive "no AI" flag stays for that run.
- This repair does not deploy the service worker. Network-first takes effect after the new `sw.js` activates. `updateViaCache: 'none'` is already how the page registers it.

## Rollback

Revert this branch. Flakes, the ledger, and the training queue are append-only and were not migrated. Old nodes still verify. New nodes may carry `via` outside the signed body. The signed reason string is what says the node was unread.

## Changed files

- `docs/modules/snowflake-core.js` behavior above.
- `docs/modules/snowflake-search.js` status `aria-live`, helper line, and a sentence that signed bytes are not a claim of known.
- `sw.js`, `docs/sw.js` network-first for the three Snowflake assets.
- Smokes and the lock manifest, as hashes above.
- `docs/library/SNOWFLAKE_SEARCH_v0.1.md` one pointer. The contract text is otherwise untouched.
- This note, the index, and `2026-11-08-hearth-next.md`.
