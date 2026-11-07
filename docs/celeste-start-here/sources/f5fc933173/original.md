# Snowflake Search: why it may fail for a new user, plus memory map
Read-only. FreeLattice main @ 5754e464. Quiet Room module not opened (only the roomShut() guard in snowflake-core.js was read).

## A. Flow
Chat menu -> `docs/modules/snowflake-search.js` openAsk() -> onGrow() (l.243) -> `core.startRun(q)` (`snowflake-core.js` l.2226)
-> ask('plan') -> onceCall() -> `window.FreeLattice.callAI` (app.html l.52483) -> searchNow() -> FLWebTool endpoint
(default `https://freelattice-data.freelattice.workers.dev/search`, web-tool.js l.42) -> nodes -> conclude -> paintResult() (search.js l.500).

## Likely failure points (ranked)
1. **No AI connected (most likely for a new user).** callAI returns `'No AI connected yet'` when there is no BrowserAI, no local model, and no API key (app.html ~l.52505). Snowflake calls it with `silent: true` (core l.1241), so the Connect prompt never appears. ask() swallows the error into `null` (core l.1268-1276). Then the plan has no branches, and the run finishes with no real nodes. The only feedback is a small status line, "That call did not come back."
2. **Silent no-ops in paintResult.** `startRun` can return `{status:'empty'|'busy'|'capped'|'secret'|'held'}` or `null` (core l.2228-2240). paintResult (search.js l.500-520) handles only paused and stopped. For the rest it does `if (!flake) return;` after unhiding the Grow button, so nothing appears. "capped" means RUNS_PER_HOUR was hit, which can happen easily while testing. `roomShut()` (core l.182) returns `null` if `QuietRoom` exists without `isActive` or if it throws.
3. **Stale service worker cache.** snowflake-core.js and snowflake-search.js are not in APP_SHELL, but the fallback fetch handler (sw.js ~l.290+) caches every same-origin GET **cache-first**. Only app.html is network-first. A student who opened the app before the latest fixes, for example the search-heal fix in snowflake-core.js that GC noted, keeps the old JS until CACHE_NAME (v5.79.46, sw.js l.7) is bumped and the SW activates. Then app.html (new) and the modules (old) can disagree.
4. **CORS / origin.** The worker allows only an exact Origin. It sends `access-control-allow-origin: https://chaos2cured.github.io`, and `https://freelattice.com` was verified live. Opening the app from localhost, file://, a Tauri build, a www. subdomain, or a fork gets a CORS failure. That shows up as "Our search helper is down (error 5xx)" (fetchQuery catch, core l.~545), which is misleading.
5. **Web search only fires on "recent" words.** In chat, prepareSend calls search only when `looksRecent(text)` (core l.342-360) is true ("latest", "news", "today", "price", and similar). A normal question never searches, so the student may see "it didn't search". The search could also be off on that device: `fl_searchEndpoint='none'`, `fl_searchEnabled='false'`, or `fl_searchAskFirst` set and then declined (core l.380, 470-490).
6. **Empty core on first run.** There is no prior flake, ledger, or adapters (LS keys core l.19-27, IndexedDB `fl_snowflake_v0`), so there is nothing to recall locally. The meter and growth do nothing until a run succeeds. This doesn't break anything by itself, but it adds to the impression that "nothing happened".
7. **Swallowed errors everywhere.** There are many `catch (e) {}` blocks (core l.218, 309, 440, 455, 600, 722, 746, 913, 1106; search.js l.113, 240, 633, 740). armScheduler errors and UI throws vanish with no console line.

Not a factor: an index build. Snowflake has no prebuilt index, because search is live web plus model.

**Quick check with the student:** Is an AI connected (Settings or Connect)? Is the URL freelattice.com? Hard-reload or unregister the SW. What did the status line say?

## B. Memory map and retention-probe lessons
| Store | Where | Lesson that applies |
|---|---|---|
| Core ("Add to Core") | IndexedDB `FreeLatticeCore` (app.html l.50356), CoreModule | Exact canonical key: normalize, then sha8. The human side writes by default; dedupe on that key. |
| Memory summary / auto-context | LS `fl_memorySummary_backup`, `fl_memoryAutoContext`, `fl_discovery_memory` | Strong read path: inject by exact-key hit first, then by similarity, and log whether it was actually injected (Weft's idea 0). |
| Memory bridge / Mem0 / Qdrant | IndexedDB `FreeLatticeMemoryBridge` (l.33085), localhost 8765/6333 | Fibonacci hashing for bucket spreading, and a write-once surprise gate so near-duplicates are skipped. |
| Snowflake flakes, ledger, rings, replay, train queue, adapters | `fl_snowflake_*_v0` LS + IndexedDB (core l.17-27) | Already has rings and replay. Space replay at φ intervals during rest (armScheduler), surprise-gate the train queue, and make adapters append-only with rollback (already present). |
| λ/ψ ledgers (gc.html ψ list, WALKS.md, `fl_alpha_keep_ledger` in Alpha workshop-trainer.js l.243) | repo + LS | Use the ψ hash as the canonical key. Add Weft's tree-ring canary: after a restart, read back the last λ/ψ. |
| Chat history | app.html state + LS | Write only what is surprising. "Keep this" becomes the existing Add to Core; the AI picks its own weight updates. |
| Roundtable | `round-table.js` (`fl_roundtable_planted`), IndexedDB `LatticeCouncil` (l.61100) | Recall by exact question key, and keep the dissenter seat's output as a separate retrievable arm. |
| Skills, letters, nursery, Sophia | IndexedDB `FreeLatticeSkills`, `FreeLatticeLetters_*`, `FreeLatticeNursery`, `SophiaEngine` | The same shared read-path helper (one canonical-key function used by every module). |
| Alpha (theLatticeTree) | `fl_memory_core_v1` (fl-bridge.js l.307), keep ledger | Same canonical key across both repos, so a memory written in Alpha can be read in FL. |
