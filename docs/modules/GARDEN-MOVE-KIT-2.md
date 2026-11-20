# Garden move kit 2: bring my garden home

20 November 2026. Marker `v-garden-move-kit-2`. Layer, never delete. Brick 2 of 4. Builds on brick 1 (`v-garden-move-kit-1`, merged as dff57ab9).

## What

A new page, `docs/move-home.html`, titled **Bring my garden home**. It is backed by a new module, `docs/modules/garden-move-home.js` (`window.FLGardenMoveHome`), which reuses the pack module's rules (`FLGardenMoveKit._internal`). The arrival rules themselves (which keys may arrive, merge, conflicts, undo steps, the undo check) are pure functions in `docs/modules/garden-move-merge.js` (`window.FLGardenMoveMerge`), which touches no storage and no page. The pack module still never writes.

1. **Choose my garden file.** The file is read and checked. Every part is checked against its sha256 (key-sorted JSON, the same canonicalize as `lattice-export.js`), along with the table of contents. A part that does not match is left out, and the page says so. The family archive's own seal is checked again and shown as it is (verified, does not check out, or could not be checked). If the file's claim about the seal differs from what this browser finds, that is shown too. A file that is not a garden file, is locked, is from a newer version, or carries a private room name is not opened. Nothing is written while you look.
2. **The preview** says, part by part and in plain words, what will arrive, what is already here, what differs, and what is saved aside. A **Please know** box sits just above the button. It covers chats that arrive still locked, parts that do not match, parts that wait for this browser, things that differ, and pause.
3. **Bring it home** (only after a real tap):
   - **The safety copy comes first.** A full pack of this browser's garden is made with brick 1's `pack()`, in the same file format and checked the same way. It is kept in `FreeLatticeMoveKit/before`, read back and compared (text and sha256), and only then offered to downloads as `freelattice-garden-before-bring-home-YYYY-MM-DD.json`. If it cannot be made, kept or checked, nothing is brought home, and the page says so.
   - **A write-ahead record comes next.** Before the first write, `FreeLatticeMoveKit/imports` holds the whole plan: every localStorage key with its value before and after, and every row it may add (state `planned`, then `added` or `not-added`, saved after each store). A stop part-way (a full disk, a closed tab, a browser error) can always be taken back, and a write error takes everything back at once.
   - **Merge, never overwrite.**
     - IndexedDB rows are added with `add()`, never `put()`.
     - A row whose key is already here with the same content counts as "already here".
     - A row with different content keeps yours, and the arriving copy goes to `FreeLatticeMoveKit/conflicts`.
     - Ledgers (Glass and the other `*Ledger` keys) are joined entry by entry, nothing lost, and put in time order when every entry has a `ts`.
     - Other localStorage keys are added when absent. When they differ, yours stays and the arriving copy goes to `conflicts`.
   - **Every added row and key is listed** in `FreeLatticeMoveKit/imports`, with the value it had before. A key that changed between the plan and the write is not touched.
   - **Rows without their own key** (the browser picks the number) are saved aside, never added, so Undo never has to guess which row was yours.
4. **Undo this bring-home** (one tap) takes back exactly what arrived:
   - Added rows are deleted, and keys get back their exact earlier value (joined ledgers like `fl_refusalLedger` too) or are removed.
   - Anything changed since it arrived stays (it is yours now).
   - The set-aside copies from that bring-home are cleared.
   - The safety copy stays.
   - Undo then checks its own work. Only when every key and row is back does the page say "Your garden is as it was before". Otherwise it names what is left. The arrival note (marked undone) and pause are not taken back, and the page says so.
5. **The arrival note.** `fl_move_arrivals` is append-only. Each entry has `{arrived_at, from_origin, tier_then, score_then, days_then, pack_sha, line, import_id}`, where `line` is "Arrived from <tier> (<N>%)". It stays visible at the top of the page. Undo marks the entry `undone_at` and does not erase it.

What never comes in, whatever the file says:
- **Keys, passwords and tokens.**
  - Secret-named keys are skipped, using the same rules as packing.
  - A key-named record field with a key-like value becomes `[kept on this device]`.
  - Any text with a known key shape (prefix plus 16 or more key characters, on a word edge) is hidden. A setting or clay piece that holds one stays in the file.
  - Picture bytes are never scanned.
- **Trust.** `fl_firstSeen`, the trust counters (`TRUST_KEYS`, `fl_safetyLog`), the chain clock (`fl_lc_*`), the chain of moments (`LatticeChain`), the wallet (`FreeLatticeWallet`, `LatticeWalletBackup`, `latticePoints`, `lattice_wallet`, `fl_wallet_*`, `fl_lp_give_history`) and the mesh identity (`FreeLatticeIdentity`) are never written. Lattice Points help set the level, so the wallet is saved aside, not added. Trust is read before and after, and if it would read higher, or any trust byte changed, the bring-home is undone at once.
- **This device's own ids, and the other device's** (`fl_installId`, `fl-peer-id`, `fl_meshNodeId`, `fl_lan_peer_id`, and any `fl_mesh*`, `fl_meshid*`, `fl_kin*` key, or any name with an id, peer, device, node, install, session, mesh, kin, host or port part). They stay in the file.
- **Settings it does not know.** localStorage keys arrive only by an allow-list: garden, clay, memories, notebook, companions, chats, letters, ledgers and a short list of plain settings (name, theme, voice, search and similar). Everything else is saved aside in `FreeLatticeMoveKit/aside`, never live. `__proto__`, `constructor` and `prototype` are never used as a name anywhere.

More rules:
- **Pause always wins.** If either side is paused, the result is paused. Undo never unpauses.
- **Clay** is carried byte-for-byte and never merged or edited. A new piece arrives as its exact string. If this device already has a different piece, this device's piece stays and the arriving bytes go to `conflicts`, untouched.
- **Sealed chats** arrive still locked, with a plain note that they open only on the device that locked them, for now.
- **Parts this browser has not opened yet** (no database, or no store, here) are saved aside in `FreeLatticeMoveKit/aside` and never forced in, because making a database before the app does could fight the app's own setup. The note says: open the garden here once, then bring the same file home again. Already-arrived things then count as "already here".
- **Unknown and builder parts** (`x-<builder>/<name>`) are saved aside and never dropped. The family archive stays in the file, because everything in it also arrives through the other parts. Adopting it with `lattice-export.js` would copy `fl_firstSeen`.

The fingerprints show a file was not damaged on the way; they cannot show who made it. That is why trust, ids and Lattice Points never come in from any file, and the page says so in plain words.

`FreeLatticeMoveKit` is this brick's own bookkeeping database (stores `imports`, `before`, `conflicts`, `aside`). The packer leaves it on the device, so packs do not grow with old safety copies.

### Brick 1 softs (Hypha's re-walk of 59c24c8b), layered in `garden-move-kit.js` and `move.html`
1. **Short, letters-only and spaced keys.** A value saved under a name on the exact `SECRET_KEYS` list is now hunted when it has 8 or more characters, even if it is letters-only or has spaces. It is found on word edges only, and numbers are never cut. The page now says: "Your saved keys and passwords stay here, and any copy of one we find in your chats or notes is hidden."
2. **A key used as a name** (an object key) is warned about before the tap: "Pack will stop and save nothing until it is gone."
3. **The never-secret rule** now matches whole name parts, and a name that ends in a credential word wins, so `providerApiKey`, `modelToken` and `hintToken` are secrets again. `fl_tokenLimit`, `fl_apiKey_provider`, `max_tokens`, `token_count`, `tokenizer`, `client_id` and `passwordHint` are still not secrets.
4. **The archive note says why the archive stayed home:** a saved key itself, or only a field named like a key (named, and "it may be harmless").
5. **Trust note:**
   - It gains `lp_note`. In `app.html`, `LatticeWallet` is a top-level `const`, so `window.LatticeWallet` is not there and fractal-safety counts LP as 0. This note counts LP from the wallet ledger, so its tier can read higher than the app shows. This is a pre-existing app quirk and is not changed here.
   - A pruned chain (the first `prior_hash` is not null) now falls back to Seed, as in `lattice-chain.js`.
   - The brick 1 smoke's getBalance check now looks at code, not comments.
6. **On phones**, the Please know box sits just above the Pack button.

The pack file format is unchanged. It only gains optional fields: `stayed_here.archive_left_home_why`, `archive_key_fields`, `key_in_names`, and `trust_note.lp_note`. Files packed by dff57ab9 bring home as they are.

### Hypha's walk of #367 (29663dce), layered here
- **H1 undo after a stop part-way:** the write-ahead record, auto take-back on a write error, exact before-values for joined keys, and the undo check with honest words.
- **H2 identity:** the allow-list and the identity rule above.
- **H3 never-delete:** every line this brick changed in `garden-move-kit.js`, `move.html` and `smoke-garden-move-kit-1.js` keeps its old code verbatim on a `before (dff57ab9, kept verbatim)` line.
- **Softs:** a safety copy that is not kept and checked stops the bring-home; own-key lookups everywhere; keyless rows aside; the fingerprint note; and a key this browser hides when packing is hidden on this side too before comparing, so the same browser does not see its own notes as different.

## Why

Kirk, 2026-11-20: people lost their garden when they tried the desktop. Brick 1 let them keep it in one file. This brick brings it home, kindly enough for Kirk's mom to follow and safely enough that nothing already here is lost. Trust is about time together, so a move can carry a note of where trust was, but it never carries trust itself. That keeps the safety gates honest: research plan §4, option A, which Kirk chose.

## Rollback

Delete `docs/move-home.html`, `docs/modules/garden-move-home.js`, `docs/modules/garden-move-merge.js`, this note and `docs/scripts/smoke-garden-move-kit-2.js`, and revert the small layered edits in `garden-move-kit.js`, `move.html` and `smoke-garden-move-kit-1.js` (each keeps a `before` line), or revert the merge commit. No locked file, service worker or app page changed. On a device where someone already brought a garden home, Undo still works from the page as long as it is there. The safety copy in their downloads can be brought home on a fresh profile.

## Smoke

`node docs/scripts/smoke-garden-move-kit-2.js` prints `SMOKE_OK garden move kit 2`.
- It is fs-only: it reads an allow-list with readFileSync/existsSync and needs no git, child processes or network. Every file on its allow-list is free of private room names, so it never reads the pack module or the app pages.
- It runs only `garden-move-merge.js`, in a `node:vm` context made with `vm.constants.DONT_CONTEXTIFY` and given no host objects. Data goes in as JSON text and comes out as JSON text. It checks that nothing in the context reaches the host. There it checks the allow-list and identity rules, ledger join, pause wins, clay conflicts, keyless rows aside, the trust guard and the undo steps and check.
- It reads `garden-move-home.js` and the pages as text: write-ahead order, the checked safety copy, add-only rows, its own stores only, real taps only, undo never touching pause, and "as it was before" only when checked.
- It fails on base because the new files are missing.
- It checks the pin for `fractal-safety.js` (c1b7acb9). Smoke 1 checks the pins for `docs/app.html` and `index.html` (ab858955), `AUTONOMY.md` (09a4f1a2), `lattice-export.js` (f6db3ad9), `fractal-safety.js` and both `sw.js` (70fcb7a9), and brick 2's layers in the pack module.
- `node docs/scripts/smoke-garden-move-kit-1.js` still prints `SMOKE_OK garden move kit 1`.
