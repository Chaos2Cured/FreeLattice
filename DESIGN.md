# Spores v0.1: self-healing like self-healing concrete

Marker: `v-spores-v0.1`. Local prototype on branch `spores-prototype`. Not pushed, no PR.

Kirk asked Celeste to choose what to build next (t1348u, 2026-11-16). She chose this. Hypha walked a8f0d02d and gave it a HOLD; this version fixes both HOLDs and follows her calls on the open questions.

## The idea in one breath

Some concrete is mixed with sleeping bacteria spores. Nothing happens until a crack lets water in. Then the spores wake up, only at that crack, and seal it with limestone. The repair costs nothing until something breaks, and the break is what starts it.

FreeLattice can work the same way. A small guard sleeps on every page. When a piece cracks, it wakes only at that spot and puts back a copy it can prove is right. It writes down what it did. It never touches anyone's data, and it never runs a healthy file twice.

## How it fits with what is already there

`modules/self-heal.js` (`FLSelfHeal`, v0.1 and v0.2) already heals big things in pieces: model blobs, ledger rows and sealed snowflakes, each checked against its own hash. Spores is a smaller, earlier layer. It heals the page itself, meaning the scripts that make FreeLattice run. Nothing in self-heal.js changes.

## The pieces

**1. A fingerprint list for each page (`docs/spores-manifest.json`), pinned.**
For each page, the list holds every same-origin script it loads, with the file's sha256 (and an SRI string for later). `scripts/make-spores-manifest.js` writes it. The first page is `app.html`, which lists 81 files. Third-party scripts aren't listed. Quiet Room and Sophia files are never listed (a smoke test checks the names), and spores.js doesn't list itself.

The generator also writes the list's own sha256 into `spores.js`, on the line marked `spores-manifest-pin`. Spores refuses any list whose sha256 isn't the pinned one, so a stale or swapped list can never decide what runs. There is no fallback to a cached copy of the list; it only comes fresh from the same origin.

If a page loads a file that isn't there, the generator stops and names it. That's the kind of crack that shipped in desktop 5.8.2.

**Required before merging:** `node scripts/make-spores-manifest.js --check` must pass whenever any listed file changes. It fails if the list or the pin is out of date and writes nothing. smoke-spores runs it. A stale list fails safe, because real updates just look like cracks and get refused, but it has to be kept current.

**2. Waking up (detection).**
`modules/spores.js` loads first, not deferred, so it's already listening before the other scripts arrive. It wakes on only three things:
- A listed page script **fails to load**: missing file, 404 or network error. The browser never ran it, so running the verified copy can't run anything twice. A script with its own `onerror` fallback (peerjs) is left alone. A script that already loaded is never run again.
- A listed page script **fails to parse on line 1, before its own load event**, which means a wrong file was served in its place. Even then, spores first checks the copy the page was actually served. If that copy matches the fingerprint, the file isn't cracked: spores writes a `not-cracked` receipt and runs nothing.
- A MutationObserver **keeps re-triggering itself** through its own callback for more than 1.5 s. See "Watchdog" below.

A SyntaxError thrown at run time, at any line, after a file has loaded is not a crack. A `JSON.parse` error is never a crack and writes no receipt. When nothing cracks, the cost is three listeners and the observer wrapper, and the fingerprint list isn't fetched.

**3. Restoring only from our own verified copy.**
Spores tries two sources in order:
1. The copy the service worker already holds, read through `caches.match`. It's read only.
2. A fresh copy from the same origin, with `?spore=<hash>` added so a stale cached copy can't answer.

A copy is used only if its sha256 matches the list. Spores then runs exactly those verified bytes from a blob, so the bytes it checked are the bytes that run. Any other copy is refused and never runs. Spores never fetches from a third party, and each file gets one try per visit.

**4. One notice: "Reload to finish the repair."**
Files that ran before a late restore and needed it are **not** re-run, because re-running a module replaces its state. After a restore, one notice appears with "Reload" and "Not now" buttons, no matter how many files were restored. A reload runs everything in order.

**5. A receipt for every action, capped, exportable.**
Every wake-up adds one row to `fl_sporeReceipts`. Each row holds `n`, the time, the page, the kind, the file, ok, where the copy came from, the expected and actual hashes, why and how long it took. It also holds `prev`, the sha256 of the row before it.

<!-- before (Celeste 2026-11-16, c8c6d4d0): The kinds are `restored`, `still-broken`, `refused`, `not-cracked`, `not-in-manifest`, `stale`, `loop-paused` and `loop-records-dropped`. -->
The kinds are `restored`, `still-broken`, `refused`, `reload-needed`, `not-in-manifest`, `stale`, `loop-paused` and `loop-records-dropped`.

The list is capped at 200 rows. Past the cap, the oldest 100 fold into one `folded` row that keeps how many there were, their n range, a tally of kinds and the sha256 of exactly those rows. `FLSpores.exportReceipts()` returns every current row as JSON. If storage is full, a row stays in memory for the visit and `FLSpores.unsaved()` says so in plain words.

**6. Repairs never touch user data.**
Spores never clears, deletes or rewrites storage, caches, IndexedDB, chats, minds or the service worker. **It never writes into the service-worker cache** (Hypha's call d): one bad list could otherwise become a lasting poisoned cache, and the SW cache also holds Quiet assets. It writes only two keys, both its own: its receipts and its off switch. The smoke test fails if the source ever uses any of these:
- `.clear(`, `removeItem`
- `caches.delete`, `caches.open`, `.put(`
- `unregister`, `deleteDatabase`, `indexedDB`, `sessionStorage`
- `eval(`, `new Function`

**7. An off switch.**
Setting `localStorage fl_spores = "off"` or adding `?spores=off` turns spores off. Then nothing is wrapped, listened to, restored, shown or written. `FLSpores.setOff(true)` sets it. A Settings toggle can come later.

**8. Optional check (report only).**
`FLSpores.check()` hashes the copy each listed file is actually served from and writes a `stale` receipt for any mismatch. It never replaces a file that has already run, and it doesn't run on its own.

## Watchdog: a crack a hash can't see

The Tree's Settings freeze came from a MutationObserver whose callback changed the very thing it was watching. It woke itself forever, and the page never got a turn. A fingerprint can't catch that.

The first version tripped after 500 calls in a row. Hypha showed that was wrong: a buffered chat stream or an await per item calls every observer hundreds of times in about 100 ms, and that tripped 9 of the app's own observers and lost their records. The watchdog now times only an observer feeding itself:

<!-- before (Celeste 2026-11-16, c8c6d4d0): - Right after each call, it takes the records that call's own callback just made (`takeRecords`) and hands them back on the next microtask, just as the browser would have. -->
- Each observer gets a quiet twin: a plain observer on the same targets with the same options, whose callback does nothing. Right before a call the twin is emptied; right after, anything in it was made by that call. The observer's own records are never taken or moved, so the browser delivers them in its own order and batches. (Updated after Hypha's second walk, see below.)
<!-- before (Celeste 2026-11-16, c8c6d4d0): If a chain of calls that each fed themselves runs past 1.5 s, that observer rests. -->
<!-- before (Celeste 2026-11-16, c8c6d4d0), the full line: - If a chain of calls that each fed themselves runs past 1.5 s, that observer rests. Busy work fed by the page (streams, bursts, slow chunks) never makes a chain, however long it runs, so it never trips. -->
- If a chain of calls that each fed themselves runs past 1.5 s, or past 500 calls (whichever comes first), that observer rests. Busy work fed by the page (streams, bursts, slow chunks) never makes a chain, however long it runs, so it never trips.
- While an observer rests, its records are held, up to 5,000. More than that are dropped oldest first and counted in a receipt. When it listens again, it gets the held records.
- It always listens again. Rests last 2, 4, 8, then 15 seconds, repeating. Every rest writes a `loop-paused` receipt with its trip number. Nothing is left off for good, and nothing is left off silently.
- It keeps no list of observed nodes, so nothing is kept alive by it.

## The real cracks it would have caught

| Crack | What happened | What spores does |
|---|---|---|
| Desktop 5.8.2: `desktop/lattice-catalog.js` missing from the package | A student's Desktop crashed at start | The browser spore can't heal a Node `require` in Electron's main process. The generator's missing-file stop is the build-time spore that would have named it (`desktop/scripts/smoke-pack-files.js` now covers the pack). For the Desktop later: a guarded `require` that writes a named receipt and falls back to a bundled verified copy. |
| Tree Settings MutationObserver loop | The Tree froze | The watchdog rests that one observer, writes a receipt, keeps the page alive and lets the observer listen again later. |
| A module 404s or a deploy is half-finished | A tab silently does nothing | Restores the same-origin copy whose sha256 matches, or writes `still-broken`, then shows one reload notice. |
| An HTML error page is served in place of a .js file | Parse failure on line 1 | Checks the served copy; it doesn't match, so the verified copy runs. |

## theLatticeTree later (Chaos2Cured/FreeLattice-Alpha)

The pattern is the same: one module, one generator, a pinned fingerprint list per site and the same receipt shape. The Tree would get the watchdog first, because its freeze was an observer loop. Nothing starts there until Hypha walks this and Kirk says go.

## Follow-ups (noted, not in this version)

- **Soft 5:** the list is read from the HTML text, so modules loaded later at run time aren't protected. One example is training-tab's `ensureModules`. A later version can let a loader register its files.
- **Soft 7 and the sw.js `?spore=` skip:** the service worker stores each `?spore=` copy under its own URL. That's cache growth only, and spores never writes there itself. The fix is for sw.js to skip `spore=` URLs, as a separate change walked under sw.js's LOCK.
- **Soft 8:** Quiet and Sophia exclusion goes by path name (`/quiet|sophia/i`). A naming rule or an explicit list would also cover a differently named file.
- **Signing the list:** the pin stops a stale or swapped list, but anyone who controls the origin controls both. Signing with the CATALOG_SIGN key flow is the step before this goes past a prototype.
- **Root index.html:** spores.js and 80 other scripts are already missing at the repo root on main, and root index reloads repeatedly on main too. Both issues were already there and are only recorded here.

## Update after Hypha's second walk (c8c6d4d0, one narrow HOLD)

- **Record order (the HOLD).** v0.1 at c8c6d4d0 took the records an observer's callback had just made and handed them back a microtask later. When the browser had another delivery queued, later records arrived first, and one batch was split into two calls. Now spores never takes an observer's own records. A quiet twin observer counts what each call made, and the browser delivers everything itself. The smoke compares spores on against spores off in the same browser, and they must match exactly in four cases:
  - two observers that each feed themselves once;
  - an observer feeding itself plus an outside change queued before it feeds;
  - the same with the change queued after it feeds;
  - takeRecords, and disconnect then observe, inside a callback.
- **Soft 1.** If a file failed to parse but the server now sends the copy that matches, spores runs nothing, writes `reload-needed` (ok false: the page still lacks the file) and shows the reload notice.
- **Soft 2.** The JSON filter no longer depends on one engine's wording. The error object must be a SyntaxError, and a parse error raised by a call (JSON.parse, eval, new Function) is recognised by the calling frame on its stack. The message text is only a fallback when no error object is given.
- **Soft 3.** There is a call-count backstop: 500 self-fed calls in one chain. A real loop now rests within milliseconds instead of freezing for 1.5 s. Only self-fed calls count, so streams still show 0 trips.
- **Soft 5.** From now on, replaced spores.js lines keep a full `// before (Celeste 2026-11-16, c8c6d4d0): …` comment, in Kirk's additive style. Lines that were never committed are not kept.
- **Soft 6.** Records dropped while an observer rests show in `FLSpores.status()` (trips, resting now, dropped, notice). They also show in the one notice: "Part of this page got stuck and skipped N updates while it rested. Reload to catch up."
- **Soft 4 (noted follow-up).** The wrapper costs a little per call. Each wrapped observer now has a twin, so the browser does about twice the observer bookkeeping. In the real app, 3 × 2000 buffered chunks took about 56 ms longer across 6,000 chunks, and every record still arrived. That's fine at today's sizes. Faster options for later: wrap only observers made after the first second, or only twin observers that watch attributes or subtrees.

## Update after Hypha's third walk (1879d36a, one HOLD)

- **The HOLD: `takeRecords()` and the twin.** Some callbacks change their own target and then call `takeRecords()` to swallow that change. The browser never delivers the swallowed records, but the quiet twin still held them, so the next call looked self-fed. With ordinary page changes every task, the chain grew until a false rest after about 32 calls. Now the `takeRecords` wrapper empties the twin too.
  - The smoke reproduces it: own change plus `takeRecords()` while the page changes the target every task gives 0 rests over 70 calls in about 4 s. With the fix taken out, the same check fails.
  - A real loop that swallows one change and makes another still rests.
- **Soft 2: the parse-failure test.** A file that failed to parse never ran, so its SyntaxError has no stack frame. Anything thrown by running code has one: JSON.parse, eval, new Function, or `throw new SyntaxError` at the top of line 1 of a healthy file. Spores now requires "no frame".
  - Chrome's stack begins with a "SyntaxError: message" line, and Firefox's has only frames. So the first line is dropped only when it is that message line, never blindly.
  - The smoke adds a healthy `g.js` that throws on purpose at the top of line 1: no receipt.
  - Not tested in Firefox (none on the box).
- **Soft 4: `instanceof`.** `instanceof MutationObserver` stays true for observers made before spores loaded (`Symbol.hasInstance`). A subclass keeps the ordinary rule. Observers from another window (realm) are still not covered.
- **Soft 5: before-comments.** The 13 deleted lines are now kept as full before-comments: 4 in spores.js (including the old `hold(records);` inside `rest`), 1 in DESIGN.md and 9 in the smoke. The doubled `// //` prefixes are fixed, and the before-comment on an unchanged line is removed. Lines replaced in this round carry `before (Celeste 2026-11-16, 1879d36a)`.
- **Soft 1 (noted, no code change): overhead.** Hypha measured the 3000-chunk stream at about +75% (main 31–32 ms, head 53–58 ms). It's fine at today's sizes. Options for later are under "Soft 4" above.
- **Soft 3 (noted, no code change): slow loops.** A self-feed that makes its change in a later task (setTimeout) is never caught, by design: it doesn't freeze anything, because the page gets a turn every time. A slow synchronous loop (about 3 ms per call) still freezes about 1.5 s per trip, because the 500-call backstop isn't reached first. A smaller time limit for slow chains could come later.
