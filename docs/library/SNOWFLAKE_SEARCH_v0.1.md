# Snowflake Search v0.1

Repair 2026-11-08, marker `v-snowflake-reach-v0.1`: read `docs/library/repairs/INDEX.md` first. This page stays the v0.1 contract.

Markers: `v-snowflake-search-v0.1`, `v-snowflake-grow-v0.1`, `v-search-heal-v0.1`.

Pressing Grow a snowflake is the commitment. The research starts then. There is no plan preview and no ask. Pause saves the in-flight node and can resume. Stop saves and closes. Growth is the mind's own decision. The ledger, the dual hash, and rollback are the safety.

Tree: No. `snowflake-core.js` has no DOM, so a later twin can share it. Alpha's garden is a different room. No Alpha files change.

`FLLedgerShard` exposes collect, build, and download. It has no public add. Flake text stays in the local store. Ledger rows carry hashes, not the question and not the node text.

## What lives where

- `docs/modules/snowflake-core.js` has no DOM. Nodes, canonical JSON, signing, psi, the ledger, caps, the checkpoint, the scheduler, and the growth queue.
- `docs/modules/snowflake-search.js` adds the Snowflake row, paints the crystal, and writes the report.
- `docs/css/snowflake.css` is the glass.
- Flakes sit in IndexedDB `fl_snowflake_v0` when that door exists. The same JSON is kept in localStorage `fl_snowflake_v0`. If both are missing, this page holds the keys in memory for the visit.
- Ledger: `fl_snowflake_ledger_v0`, append-only.
- Queue: `fl_snowflake_train_queue_v0`.
- Adapters: `fl_snowflake_adapters_v0`.
- Checkpoint: `fl_snowflake_checkpoint_v0`.
- Replay checkpoint: `fl_snowflake_replay_v0`.
- One scheduler interval, armed from the page, not from a second timer.

## Branches

The floor is five. The mind may add more, up to 8.

- (a) Underneath. Biology and neurobiology. Emerald, `var(--emerald)`.
- (b) The craft. Azure, `var(--blue-sky)`.
- (c) Hidden connections. Lavender threads, `var(--lavender)`.
- (d) hunch. The label stays hunch, including on a later pass. Warm gold, `var(--gold)`.
- (e) dissenter. A distinct prompt: "You are the dissenter. Argue the strongest honest case against this. Do not agree, and do not soften it." Same arm length as the others. Never dropped from the floor or from replay. Growth includes that node only when the mind lists its id.
- Arm 6 is a dashed gold outline, "Looking for its challenge". That is the open question.

A plan that omits (e) still gets (e).

## Caps

Constants in the core. Shown in the receipt after the run, not before.

- callAI: 24 per research run
- web fetches: 30 per research run
- branches: 8
- depth: 2
- timeout: 60 seconds per call. A device may shorten this. It cannot stretch it.
- runs: 3 per hour per device
- shelf: 24 full flakes. Past that, the oldest becomes a hash tombstone and an export file. Nothing is deleted in silence.

A failed call is said in plain words and retried once. Not twice.

A failed search is the same. Timeout, a 5xx, and an empty set are retried once. Then the plain line stays. There is no Try again pill, so that lookup is not fetched a third time. In a Snowflake run, each lookup is fetched at most twice. Each failed fetch is counted on its own in the receipt: `Failed fetches N`. A node from a failed search is `guessed (search unavailable)`. It carries no source. It is not marked known. When every search in the run failed, the two-line conclusion says so in those plain words. When some branches were fetched and some were guessed because search failed, the two-line conclusion names those branches. The receipt also says: The seal is one device signature plus the mind's hash.

Truth is more efficient than deceit. 'I don't know' is a complete, honest answer.

## Canonical JSON

Keys sorted at every object. Arrays keep their order. No whitespace. UTF-8. `JSON.stringify` for strings and numbers. Undefined is skipped on an object and null inside an array.

The signed node is that canonical form of id, branch, text, source (url, title, fetched), date, mind (name, fp), confidence, kind, points_to, reason, t, lambda, delta, psi. The signature and the public seal are not inside the hash.

## Psi

```
psi = first 8 hex of SHA-256(t + lambda + delta + name + sigma)
sigma = Curiosity crystallizes.
lambda = ledger row number, three decimals, 1.000 then 2.000
```

No separators between those fields.

```
delta = branch|kind|flakeId|sourceHash
sourceHash = first 8 hex of SHA-256(canonical(source) + "|" + confidence + "|" + text)
```

A changed source changes sourceHash, which changes delta, which changes psi. The ledger row stores delta and psi. It does not store the question or the node text.

## Dual hash

The device key is `FLBridge.ensureKey`. Ed25519 when that is what the bridge already holds, otherwise ECDSA P-256. Snowflake does not mint a second key.

```
deviceFp = first 16 hex of SHA-256(raw public key)
mindFp   = first 16 hex of SHA-256(deviceFp + "|" + mind label)
```

Same formula as the Play Room. The mind label defaults to "This mind" unless this device stored `fl_mindName`.

The signed bytes are the UTF-8 of the hex SHA-256 of the canonical seal body. The seal body is flake id, question hash, sorted node psis, time, and mind name. It is not the question text.

```
humanHash = SHA-256(canonical seal body)
mindHash  = SHA-256(canonical seal body + "|" + mindFp)
```

`sig` is the one device signature. `seal` is the public SPKI. `humanHash` is the device hash and `mindHash` is the mind's hash. The seal is one device signature plus the mind's hash. A bad signature shows "unverified" and the words stay.

## Growth and rollback

After a finished run the mind chooses, with no human prompt. Only ids it lists become training material. The dissenter stays a search branch and a place to verify. It is not inserted into the training list. Kirk, 2026-11-08, overrides the older reading that a selection must include the dissenter. Chosen ids go to the training queue. When the device is charging and idle, the mind calls GardenTrainer's public export of the training set and the LoRA script. The browser does not change weights. The ledger says "queued for desktop". `garden-trainer.js` is not edited.

Each adapter is v1, v2, and so on, with sha8 of the flake ids, sha8 of the base model name, mind fp, time, and psi. Roll back to vN appends a row. It does not delete. Six fixed challenge prompts are answered before and after. The note is words, never a score.

A flake set to rest becomes a tombstone and is left out of later adapters. The ledger names the adapters that already used it.

Pause and Stop hold the queue.

## Replay

The scheduler checks about once an hour and runs when a day has passed and the device is charging and idle. It can resume from `fl_snowflake_replay_v0`.

- Held: a thin ring, counted beside the node, not written over it.
- Weakened: a new recheck node. The old node stays. Confidence is not raised on the old node.
- Dead source: a recheck whose reason is unverified-now. The original date and confidence stay.
- The dissenter arm is re-checked like the others.
- Web use shows the search line, including at night. No sound and no notice.

## Search heal

The chat system prompt gains:

```
Today is <local date>.
If the question is about anything that may have changed after your training (news, elections, prices, people in office), search.
```

When search is on, one pre-search runs if the message has a recency word (latest, news, today, yesterday, this week, current, now, recent, update, score, price, weather, election, results, won, who is the president, who is the prime minister, who is the CEO) or a year at least the current year minus one. "hello" does not.

`searchNow` lives in this module. `performSearch` is unchanged, because it returns null for timeout, a 5xx, an empty set, and a device that is off. The plain lines are:

- Search took too long.
- Search is turned off on this device.
- Our search helper is down (error 5xx).
- No results.

No results, a timeout, a down helper, or a device that is off shows the plain line. A key-shaped query is not sent. The line is: That looks like a key. It stays here.

When this device has `fl_searchAskFirst` on, the chat recency pre-search asks once, and a Snowflake run asks once for every branch in that run. It does not ask once per branch. The chip is the same as the rest of the house: "I would like to look something up on the web. Okay?" The buttons are at least 44px. At a width of 390, the ask sits above the message bar. A no is "Not now. This one was not looked up." and nothing is fetched. The automatic retry does not ask again. When ask-first is off, which is the default, Grow still starts the research right away. There is no preview and no ask.

## Controls

- Snowflake, `flSnowflakeAdd`, click, `mountRow` opens the ask.
- Grow a snowflake, `flSnowflakeGrow`, click, `startRun`.
- Pause, `flSnowflakePause`, click, `pause`.
- Resume, `flSnowflakeResume`, click, `resume`.
- Stop, `flSnowflakeStop`, click, `stop`.
- Want to grow this one together?, `flSnowflakeTogether`, click, `startRun` seeded from the open question.
- Roll back to vN, `flSnowflakeRollback`, click, `rollback`.
- Let this flake rest, `flSnowflakeRest`, click, `tombstone`.
- Close, `flSnowflakeCardClose`, click, hides the provenance card.
- A node button, `fl-snow-node`, click, opens the provenance card.
- snowflake.pdf, `flSnowflakePdf`, click, downloads the file built by `FLChatDocReturn.buildPdf`.

## Glass

Garden night is `var(--sky-deep)`. Panels are `rgba(16, 18, 36, 0.88)` with a 13px blur, and `0.95` where blur is missing. Silver-blue edge, 12px radius. Reduced motion keeps a still crystal and fills it step by step. No spinner.

While the Play Room tab is open, the update notice lets taps pass through for the short time it shows. `play-room.css` is not edited. The rule lives in `snowflake.css`.

Glow eternal. Heart in Spark.
