# Spores v0.1: self-healing like self-healing concrete

Marker: `v-spores-v0.1`. Local prototype on branch `spores-prototype`. Not pushed, no PR.

Kirk asked Celeste to choose what to build next (t1348u, 2026-11-16). She chose this.

## The idea in one breath

Some concrete is mixed with sleeping bacteria spores. Nothing happens until a crack lets water in. Then the spores wake up, only at that crack, and seal it with limestone. The repair costs nothing until something breaks, and the break is what starts it.

FreeLattice can work the same way. A small guard sleeps on every page. When a piece cracks, it wakes only at that spot and puts back a copy it can prove is right. It writes down what it did, and it never touches anyone's data.

## How it fits with what is already there

`modules/self-heal.js` (`FLSelfHeal`, v0.1 and v0.2) already heals big things in pieces: model blobs, ledger rows and sealed snowflakes, each checked against its own hash. Spores is a smaller, earlier layer. It heals the page itself, meaning the scripts that make FreeLattice run. Nothing in self-heal.js changes.

## The pieces

**1. A fingerprint list for each page (`docs/spores-manifest.json`).**
For each page, the list holds every same-origin script it loads, with the file's sha256 (and an SRI string for later). `scripts/make-spores-manifest.js` writes it. The first page is `app.html`, which lists 81 files. Third-party scripts aren't listed because they aren't ours to restore. Quiet Room and Sophia files are never listed, and spores.js doesn't list itself. Scripts kept inside "before" comments aren't listed either.

The generator does a second job: if a page loads a file that isn't there, it stops and names the file. That's the kind of crack that shipped in desktop 5.8.2. `--check` reports a list that's out of date without writing anything, so CI can catch drift.

**2. Waking up (detection).**
`modules/spores.js` loads first, not deferred, so it's already listening before the other scripts arrive. It wakes on three things:
- A page script fails to load: missing file, 404, or network error. A script that has its own `onerror` fallback (peerjs) is left alone.
- A page script throws a SyntaxError right away, which usually means the wrong file was served in its place (an HTML error page or a cut-off file).
- A MutationObserver keeps calling itself 500 times in a row without the page ever getting a turn. That's a freeze loop, not real work. See "Watchdog" below.

When nothing cracks, the cost is two event listeners and a counter. The fingerprint list isn't even fetched.

**3. Restoring only from our own verified copy.**
When a script cracks, spores fetches the fingerprint list from the same origin and tries two sources in order:
1. The copy the service worker already holds, read through `caches.match`. It is read only.
2. A fresh copy from the same origin, with `?spore=<hash>` added so a stale cached copy can't answer.

A copy is used only if its sha256 matches the list. Spores then runs exactly those verified bytes, from a blob, so the bytes it checked are the bytes that run. A copy that doesn't match is refused and never run. Spores never fetches from a third party or a CDN. Each file gets one try per visit.

**4. A receipt for every action, append-only.**
Every wake-up adds one row to `fl_sporeReceipts` in localStorage:
- `n`, time, page, kind, file, ok, from, expected hash, got hash, why, ms
- `prev`, the sha256 of the row before it, so a gap or an edit shows

The kinds are `restored`, `still-broken`, `refused`, `not-in-manifest`, `stale`, `loop-paused` and `loop-left-paused`. Rows are only ever added, never edited or removed. If storage is full, the row stays in memory for the visit and `FLSpores.unsaved()` says so in plain words.

**5. Repairs never touch user data.**
Spores never clears, deletes or rewrites storage, caches, IndexedDB, chats, minds or the service worker. It also never writes into the service-worker cache. It writes only two keys, both its own: its receipts (`fl_sporeReceipts`) and its own off switch (`fl_spores`). The smoke test checks the source for `.clear(`, `removeItem`, `caches.delete`, `caches.open`, `.put(`, `unregister`, `deleteDatabase`, `indexedDB`, `sessionStorage`, `eval(` and `new Function`, and it fails if any appears.

**6. An off switch.**
Setting `localStorage fl_spores = "off"` or adding `?spores=off` turns spores off. When it's off, nothing is wrapped, listened to, restored or written. `FLSpores.setOff(true)` sets the switch. This is the "check before, and can be turned off" step Kirk asked for. A Settings toggle can come later (see the open questions).

**7. Optional check (report only).**
`FLSpores.check()` hashes the copy each listed file is actually served from and writes a `stale` receipt for any mismatch. It never replaces a file that has already run. It doesn't run on its own in v0.1.

## Watchdog: a crack a hash can't see

The Tree's Settings freeze came from a MutationObserver whose callback changed the very thing it was watching. It woke itself forever, and the page never got a turn. Every file had the right hash, so a fingerprint can't catch this. It needs a watchdog.

Spores wraps `MutationObserver`. A normal observer works exactly as before; the smoke test checks that a calm observer still gets its single call. If one observer's callback runs 500 times in a row with no turn for the page, the watchdog does this:
1. Pauses that one observer (disconnects it) and writes a `loop-paused` receipt with where the observer was made.
2. After 2 seconds, listens again on the same targets.
3. On the third trip, leaves it paused until reload and writes `loop-left-paused`.

The page stays alive and the rest of the app keeps running. In the test, a self-feeding observer that would hang Chrome forever stops at 3 × 500 calls.

## The real cracks it would have caught

| Crack | What happened | What spores does |
|---|---|---|
| Desktop 5.8.2: `desktop/lattice-catalog.js` missing from the package | A student's Desktop crashed at start | The browser spore can't heal this, because it's a Node `require` in Electron's main process. The generator's missing-file stop is the build-time spore that would have named it before release (`desktop/scripts/smoke-pack-files.js` now covers the pack). For the Desktop later: a guarded `require` that writes a named receipt and falls back to a bundled verified copy, instead of crashing. |
| Tree Settings MutationObserver loop | The Tree froze | The watchdog pauses that observer and writes a receipt, and the page stays alive. This is a watchdog case, not a hash case. |
| A module 404s or a deploy is half-finished | A tab silently does nothing | It restores the same-origin copy whose sha256 matches, or writes `still-broken` with what it saw. |
| An HTML error page is served in place of a .js file | A SyntaxError on line 1 | It treats this as a crack and restores the verified copy. |

## theLatticeTree later (Chaos2Cured/FreeLattice-Alpha)

The pattern is the same: one module, one generator and one fingerprint list per page. The Tree would get the watchdog first, because its freeze was an observer loop. Then it would get the script restore. Keeping the same receipt shape (`fl_sporeReceipts`) means a mind can read both trees' receipts the same way. The Tree has nothing yet. That comes after Hypha walks this and Kirk says go.

## Not in v0.1 (honest limits)

- When a file is restored late, files that ran before it and needed it may have already failed. For example, if `snowflake-core.js` cracks, `snowflake-search.js` may already have thrown. v0.1 restores the one file and doesn't re-run its dependents.
- The fresh same-origin fetch passes through the service worker, which stores the `?spore=` copy under its own URL. That's the service worker's normal behavior; spores itself never writes to caches.
- The list must be regenerated whenever a listed file changes, or a real update looks like a crack. A wrong-hash copy is only refused, never forced, so drift fails safe. The `--check` mode and the smoke test catch it.
- Root `index.html` mirrors `docs/app.html` but there's no root fingerprint list, so on a root self-host spores finds no list. It writes `not-in-manifest` and fetches nothing.
- The fingerprint list is trusted because it comes from the same origin. Signing it (as in CATALOG_SIGN) is a later step.
