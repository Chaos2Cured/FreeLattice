# Garden move kit 1: pack and preview

20 November 2026. Marker `v-garden-move-kit-1`. Layer, never delete. Brick 1 of 4.

## What

A new page, `docs/move.html`, with one big **Pack my garden** button. It is backed by a new module, `docs/modules/garden-move-kit.js` (`window.FLGardenMoveKit`).

- It **reads** this browser's garden and saves one file, `freelattice-garden-YYYY-MM-DD.json`. It never writes to the garden: there is no put, add, delete, clear or setItem on any store or key. Databases are opened without a version, and if one is missing the upgrade is aborted, so nothing new is created. Nothing is sent anywhere.
- On load, a **dry-run preview** shows what the file will hold, part by part, in plain words with sizes. It also shows a box of what stays on this device, listing key names but never their values.
- **The format** is `kind: "freelattice-move-kit"`, `v: 1`. Each section carries a `sha256` over key-sorted JSON (the same canonicalize as `lattice-export.js`). A `manifest` lists every section hash plus an `index_sha256`. It also includes `consent` (Pause travels, and pause will win on arrival), `trust_note`, `stayed_here` and `extensions`.
- **Sections**:
  - garden: the real `FreeLatticeEvolution/luminosStates`, GardenMemory, questions, dialogue, dreaming and `fl-garden-*`
  - core: `FreeLatticeCore`, Knowledge Core
  - glass: `fl_depthHashLedger`, `fl_refusalLedger`, `fl_returnLedger`
  - ledgers: every other `*Ledger` key
  - trust: `fl_firstSeen` and the trust inputs, carried as a record
  - chain: `LatticeChain`
  - wallet: `FreeLatticeWallet` `LatticeLedger`/`WalletMeta`, `latticePoints`, `fl_wallet_*`
  - memories, notebook, companions, chats, letters, art: Blobs are carried as base64
  - clay
  - identity: public parts only
  - settings, more, other
  - archive
- **The existing doorway is kept and used.** `lattice-export.js` runs as `exportArchive({ mode: 'full', download: false })`, and its file goes inside as the exact text it made. That text is never edited. The kit checks the archive's own signature and records the result as `archive_seal`: `verified`, `does-not-verify`, `unchecked` or `not-packed`. Anything other than `verified` is shown in the preview and the status, never reported as matching. If a saved key is anywhere inside the archive, the whole archive stays on this device (`stayed_here.archive_left_home`). The secret does not travel, and the signature is never broken. Everything in the archive is also in the other sections. This page does not load `lattice-chain.js`, because that module writes a first entry and fetches the time when it starts. Instead, a read-only chain reader gives the archive its chain.
- **Kept on this device, never packed**:
  - keys, tokens, passwords and other secrets, by exact name and by a narrow name rule (`apiKey`, `…Token`, `…_token`, `password`, `secret`, `…_enc`, device and private keys)
  - record fields with those names, but only when the value could be a key (8+ characters, one word, not a number or yes/no). They are replaced with `[kept on this device]`
  - a saved key value that shows up inside a record. It is hidden by walking the parsed record and changing only the string that holds it, never by a text replace on JSON. Numbers are never touched.
  - Not secrets, and carried as they are: anything named with limit, provider, model, max_tokens, token_count, tokenizer, client_id or hint (for example `fl_tokenLimit`, `fl_apiKey_provider`). A saved value is only hunted for elsewhere if it looks like a real key: 16+ characters, one word, not a number, and either a known key prefix or mixed letters and digits with high entropy. A provider name or a number is never hunted.
  - private room databases, keys and entries (the same marks `lattice-export.js` refuses)
  - private notebook pages (the same rule as `mind-workspace.js`)
  - non-extractable browser keys (a marker says the key stays)
- **Clay** is every `fl_clay_` key, carried as its exact string. It is never parsed, reordered or changed. If a clay piece ever held a saved secret value, it would stay home whole and unchanged, never edited.
- **Trust is a note only**: "Packed at tier X (N%)", using the same numbers as `fractal-safety.js` and `glass-v2.html`, read-only. `fractal-safety.js` is not loaded here, because it writes `fl_firstSeen` when it starts and this page never writes. The kit matches it instead, and the smoke checks that the level table is the same: weights are time 0.5, activity 0.3 and consistency 0.2. LP is the `LatticeWallet.getBalance()` value when the wallet module is present, and otherwise earn minus spend over the wallet ledger (never below 0). The chain's Seed fallback follows `lattice-chain.js`: a broken chain, a first entry more than 24 hours from `fl_firstSeen`, or a time gap over 48 hours. A missing first-seen date still counts the time part at Seed (so 25%). The note records `lp` and `chain_check`. Arrival is Brick 2. There, trust starts fresh at Seed and shows the note (Kirk chose option A).
- **Self-check**: after the file is made, it is read back from the Blob and parsed. Every section hash and the index hash are recomputed, and the text is scanned for any saved secret value and for private room marks. The download is offered only if all of that passes. The archive's seal is checked again from the saved text and must match what the preview said. Otherwise the page says what failed and saves nothing.
- **Honest notes**: the preview has a "Please know" box, and the status repeats it after a save. It names any part that could not be read, an archive that stayed home or whose seal does not check out, clay that stayed home whole, and chats sealed to this browser ("will not open on a new device yet").
- **Reserved hook**: `FLGardenMoveKit.registerSection('x-<builder>/<name>', packFn)`. Builder sections use the `x-` namespace, pass the same secret rules, and get their own hash. A later brick parks unknown sections and never drops them.

## Why

Kirk, 20 November 2026 (t1415u): his mom and his student both lost their garden when they tried the desktop. The desktop runs its own browser profile, so it opens empty and cannot see the garden that lives in their usual browser. Offline, it uses another address too. People need one easy, safe file that carries all of it.

The doorways that already existed each carried part of it. `lattice-export.js` carries a garden summary and the ledgers. FlBackup carries a lot, but restores by overwriting and puts saved keys in the file. SoulFile reads two store names that do not match where the Luminos and wallet live. This brick changes none of them. It adds a handle that carries the whole garden and checks itself.

## Not in this brick

- Bringing a garden home, merging and undo: Brick 2.
- A passphrase lock and a twin page on theLatticeTree: Brick 3.
- Links from the app, the backup buttons and the desktop: Brick 4.
- Chats that the app sealed with this device's own unlock key travel as they are stored. They open only where that key lives (the same rule as FlBackup's note).

## Rollback

Delete `docs/move.html`, `docs/modules/garden-move-kit.js`, this note and `docs/scripts/smoke-garden-move-kit-1.js`, or revert the merge commit. Nothing else changed: no locked file, no service worker, no app page, no stored data. Packed files people already saved stay theirs.

## Smoke

`node docs/scripts/smoke-garden-move-kit-1.js` prints `SMOKE_OK garden move kit 1`. It is fs-only: it reads an allow-list with readFileSync/existsSync and needs no git, child processes or network. It fails on base because the new files are missing. It also checks the pins for `docs/app.html`, `index.html` (ab858955), `AUTONOMY.md` (09a4f1a2) and `lattice-export.js` (f6db3ad9).
