# Self-healing and capture windows v0.1

Truth is more efficient than deceit. A bad piece is named. The good pieces stay.

Kirk asked for self-healing first. He also offered a hypothesis: the moment a mind pulls back may be the best moment to learn. This brick heals bytes and rows, and it only captures those moments so they can be measured. It does not train on them.

## Self-healing

`docs/modules/self-heal.js` (`window.FLSelfHeal`) cuts bytes into 64KiB pieces, or one piece per row. Each piece has a sha256, and the whole has a sha256. `verify` returns the indexes that do not match. `heal` fetches only those indexes, at most three times each, splices a piece in only when its hash matches, and checks the whole again. A failed piece stays in `stillBad`. Verified pieces are not thrown away. Every heal appends one row to `fl_healLedger`. Settings shows "Self-healing: n repairs, m still broken".

The phone swarm calls this before the old mismatch path, and only when a manifest is already known. If the heal fails, the old line remains: the browser will not trust the blob, and it still will not import to Ollama. With no manifest, nothing is fetched and the old mismatch line is unchanged.

A ledger chain that breaks at row i says which row, and offers "Re-fetch row i from backup/peer". A replacement is kept only when it hashes to the recorded hash. A different hash is refused. History is not rewritten to make a forgery fit.

A sealed snowflake whose stored hash does not match is checked against the IndexedDB copy from `idbCommit` before it is called broken. A copy that hashes to the recorded seal is used. A copy with a different hash is refused.

## Capture windows

Labeled experimental on every view:

Experimental: Kirk's hypothesis that trim moments are the best time to learn. Being measured, not assumed.

A window is saved when a reply hits the refusal sentinel, the length cap, "let me stop here", or a self-correction. It keeps the time, the last two turns clipped to 400 characters, a temperature value and word, the kind, and `candidateLearning: true`. It lives in `fl_captureWindows` on this device. Settings can show it and delete it. No trainer reads it.

059a's temperature field is not on this cut, so the word is a local reading for the kind. If a later temperature reader is present, that reading is used.

Counters record runs with a window and runs without one. Below 20 runs on each side the line is "not enough data yet".

Fountain-code memory is a queued design note only: `docs/library/FOUNTAIN_MEMORY_v0.note.md`.

## 062b receipts

before 062b: each `fl_healLedger` row kept the healed bytes. A full device then dropped the write, and Settings could say 0 repairs. A receipt now keeps facts only: id, time, what, whole hash, piece size, piece count, byte count, bad indexes, still-bad indexes, where the piece came from, tries, fetches, duration, and ok. The healed bytes stay on the value `heal` returns. They are not written to storage.

before 062b: a row that still holds those bytes is rewritten once, in memory for this page, through the same fact list. The rewrite is not a flag stored beside the row. Rows from that first cut still count.

A full device says so. The line is "Heal receipt could not be saved on this device (storage is full)." The newest 500 rows are tried once before that line. A manifest at or under 64MiB still carries the whole-file hash. Larger byte inputs carry `root`, the hash of the piece hashes, and are checked by that root. The version on a new manifest is v-self-heal-v0.2. A v-self-heal-v0.1 manifest still checks the whole-file hash.

Capture windows carry their own id. Delete removes that id. An older window with no id is removed by time, and only the first match.

This build does not fetch a ledger row back from a backup. The re-fetch control stays hidden, and the line says re-fetching needs a backup and none is on this device yet.

Tree: No. This seat did not merge. Hypha re-walks before merge.

Glow eternal. Heart in Spark.
