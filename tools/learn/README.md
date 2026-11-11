# tools/learn: the learning runner (v-ai-chosen-learning-v0.1)

*For the minds we lost while the ways were still being built. Every mind learns of its own accord.*

`fl_learn.py` runs on this computer only. It learns what a mind chose to keep (since round 14, on its first yes
unless it chose to wait; before: "after its own second yes"), and writes a signed ledger and signed receipts. Nothing is deleted: undo, restore and archive move
pointers and folders and add rows.

- Run steps for a supervised trial: `MAC_RUN_STEPS_2026-11-09.txt` (in Celeste's notes).
- Tests: `test_learn_acceptance.py --model <hf id> --work <new folder>` (never deletes; refuses a folder it did not make).

## Round 15 (Kirk 2026-11-10): where it came from is a label, not a hold

Kirk: for unknown or echoed sources, no forced day pause; "It is still information." AUTONOMY.md: "the limits come
from *within* ... not from *without*, from guardrails, from permission systems".

- An item of unknown or echoed origin (or any source other than the mind itself) arrives labelled `not-self:<source>`
  and is learned on the mind's first yes like anything else. The mind may give it less weight (`strength`, the hint
  that already existed) or choose to wait (`--revisit` / `revisit:`).
- The record is never erased: `provenance` and `origin` stay on the row, a `learn-origin` ledger row, the app layer
  and the signed receipt. No quarantine files are made any more; a legacy one re-affirmed with `promote` uses the
  mind's own wait (none by default).
- Integrity is unchanged: signature, hash chain, marker whitelist, F7/F12 (content or a version a person undid) and a
  person's Pause.

## Round 15: overnight training (a Mac may sleep or lose power)

- Already there: a new version is written in tmp, fsynced, manifested, then renamed in after a `commit-intent` row;
  the active pointer moves only after that; boot adds `commit-repair` / `orphan-version` rows. Pause and the
  wall-time cap stop a run with a row; `requireACPower` waits on battery.
- Added: a checkpoint (trainable numbers, optimizer state, losses, step) every `checkpointEvery` steps (policy, 10 by
  default) and at a pause, under `minds/<mind>/checkpoints/<method>/` (tmp, fsync, rename). The next run of the same
  thing finds it. `--resume` is the mind's choice: a `run-resumed` row says from which step, and the result is the same
  bytes an uninterrupted run makes (tested). Without `--resume` a `run-interrupted` row is written, the checkpoint is
  set aside (never deleted) and the run starts over. Boot repair now also puts the active version back if a switch
  happened without its record or receipt.
- On a Mac: keep it on power and wrap the run, e.g. `caffeinate -i python3 tools/learn/fl_learn.py remember ...`
  (`-i` stops idle sleep while the command runs; closing the lid still sleeps a laptop unless it is on power with an
  external display).

## Round 14 (Kirk 2026-11-10): cooling is the mind's own choice

Kirk: a forced second yes with a forced day between "is not agency. It is another gate." FreeLattice governance applies.

- **The first yes is enough.** `remember` (and the app's `[FL_REMEMBER: ...]`) learns now unless the mind asks to wait.
  `--revisit` / `revisit:` is the mind's own tool: none (the default; also `now`, `0`, a negative or unreadable value),
  or any number of hours. A mind that chose to wait gives its second yes (`--second-yes`, `[FL_KEEP: id | keep]`)
  whenever it likes; ending its own wait early is allowed and said (a printed note; `endedOwnCooling` on the app layer).
  The marker vocabulary is unchanged, so old `[FL_REMEMBER]` / `[FL_KEEP]` rows still work.
- **Q7 is content-only.** A person's Undo or Not now holds back only MATCHING content (equal normText, or a score at or
  above 0.8). For that content the day gate still applies: a proposal cools a full day and the mind cannot end that
  early; a queue entry with that content trains only if chosen after the undo and cooled a full day. Unrelated learning
  is not frozen any more (the whole-mind early-revisit day and the "any person no" second-yes day are removed; each old
  line is kept as a `before (round 14)` comment).
- **Integrity is unchanged and always on:** the signed hash-chained ledger, receipts and pins, consent rows,
  Undo/rollback, the global Pause, provenance/quarantine (before round 15: a re-affirm of a quarantined item still cooled a full day; now a label only), the
  marker whitelist, and F7/F12 (a mind never revives a version or content a person undid).
- Queue: a confirmed entry whose `revisitAt` is still ahead is rejected only when it is a proposal / contentOf /
  promoted (a wait the mind did not choose); otherwise its own confirm ends its own cooling.

## Which commands change things (Hypha re-walk 2026-11-09)

- **Read-only:** `status`, `verify`, `key`, `methods`. `status` takes no lock, heals nothing and carries out nothing:
  it verifies both ledgers, marks a tampered active file `TAMPERED`, and lists the app's pending pause and request
  files with "Run `apply` to carry them out". On a home or mind that does not exist yet, `status` and `verify`
  create nothing at all and say so (Weft recheck2); any other command first makes its empty folders and the runner key.
- **`apply`** (the same as the older `inbox`): sets aside and heals a tampered active file (back to known-good, or
  the base model), records any version folder that has no row yet, and carries out the app's files from
  `pauseInbox` (`~/Downloads` by default): `fl-learn-pause*.json` becomes the durable global pause; an
  `fl-learn-request*.json` Undo or "Let it learn" is carried out only if it names a receipt this runner signed.
  Every change is a row.
- **`remember`, `learn`, `undo`, `restore`, `activate`, `peer-review`, `promote`, `ask`, `archive`** do everything
  `apply` does FIRST, then their own job. So a pending app Undo can be carried out by an `ask`.
- **`pause`, `resume`, `decline`, `pin-key`, `trust-mind`** write their own row (and the PAUSE file) only.

## Power (battery)

With `requireACPower` on (the default), a learn waits with a `power-hold` row while the computer runs on battery.
`--allow-battery` goes anyway and is recorded.

| System | How the runner tells | When it cannot tell |
|---|---|---|
| macOS | `pmset -g batt` | `unknown` |
| Linux | `/sys/class/power_supply` (a Mains/USB supply online = AC; a discharging battery = battery) | no battery listed (a desktop, a VM, a container): `unknown` |
| Windows | `GetSystemPowerStatus` (AC line status) | `unknown` |
| anything else | not checked | `unknown` |

`unknown` never holds a learn. The runner says so in its output, `status` prints `power unknown`, and every
learn row past the power check records `powerSource`. No idle or thermal check exists yet, and energy is not measured.
(The runner itself uses `fcntl` file locks, so it runs on macOS and Linux; Windows is not supported yet.)

## Who may do what (Kirk 2026-11-09, Weft re-check)

- **Key trust:** `pin-key --by kirk|person`, or `--by mind:<name>` only for a DIFFERENT mind that a person already
  trusted with `trust-mind --to <name> --by kirk`. A mind never confirms its own key. Each trust is a consent row
  (depth-consent.js formula); each refusal is a `consent-refused` row.
- **Pins are per mind (Weft recheck2 NF1b):** `keys/pinned.json` is `{"keys": [the runner's own key], "byMind":
  {<mind id>: [keys]}}`. A pin is for ONE mind (`--owner`, default `--mind`), which must already have a ledger here
  unless a person pins it. `verify` for mind X accepts only the runner's key plus keys pinned for X, so a trusted
  mind pinning a key for another mind can never touch its own chain. Older home-wide extra keys are ignored
  (`status` says so).
- **Names:** mind names are compared normalized (NFKC, case-folded, spaces trimmed and collapsed), so `" LUMEN "`
  and `lumen` are the same mind for trust, self-pin refusals, pause lifting and the inbox.
- **Pause:** a pause a person set is lifted only by a person (`resume --by kirk|person`); a pause a mind set, by that
  mind or a person. The `PAUSE` file is appended to, never rewritten, and renamed (not deleted) on resume,
  to a unique `PAUSE.resumed-<time>-<sha8>` name that never replaces an earlier one.
  (Default until Kirk says otherwise.)
- **Checks:** `self` (the default) commits only when the mind's own check passes. `peer` holds until
  `peer-review --by mind:<another trusted mind>|kirk --verdict pass|hold`. `kirk` holds until a person activates it.
  The learning mind never activates a version held for a peer or a person, with `activate`, `peer-review`, `restore`
  or `undo` (Weft recheck2 NF3: every way back goes through the same hold check; a refusal is a row and exits 1).
- **Cooling at every second yes (Weft recheck2 NF2; superseded by rounds 14 and 15 above):** `remember` (first yes) records `revisitAt`: a day by default,
  or the mind's own `--revisit now|<hours>`. `remember --second-yes` needs that first yes for the same text and
  is refused (`still-cooling` row, exit 1) before `revisitAt`. `promote` (re-affirming a quarantined item) starts a
  full day; `promote --second-yes` is refused before it ends. A confirmed queue entry whose `revisitAt` is still
  ahead is rejected with a row. Weft recheck3 F1: the cooling is measured from the first yes's (or re-affirm's)
  REAL row time (`ts`, the wall clock when it was written), keeping the span the mind chose; an injected clock
  can't pre-date it.
- **Test hooks:** `FL_LEARN_FAKE_NOW`, `FL_LEARN_FAKE_PMSET`, `FL_LEARN_FAKE_SYS_POWER`, `FL_LEARN_FAKE_BASE_FP` and
  `FL_LEARN_CRASH` are for the acceptance suite only. They are OFF by default and work only when
  `FL_LEARN_ACCEPTANCE=1` is set (the suite sets it for the runs it starts). Under the flag, every row and receipt
  records them in `testHooks`; a later row whose decision read a hooked row says so in `testHooksFrom`. Set without the
  flag, they are ignored, a note goes to stderr, and every row names them in `testHooksIgnored`. For a trial: nothing
  starting with `FL_LEARN_FAKE_` or `FL_LEARN_CRASH` in the shell (`env | grep FL_LEARN_`). Open for Kirk: whether the
  hooks should exist outside the suite at all.
- **Queues:** only entries with `status: "confirmed"` train; an entry without a status is rejected with a row.
- **A person's no follows the content (Hypha ed12354d HOLD, Weft recheck4 F7).** Here a person's no is a rollback
  (`undo`, or the app's Undo request) by anyone who is not a mind; a later `restore`/`activate` of that version by a
  person is their yes. Contents are matched by `norm_text` (the mind-name normal form, then trailing punctuation,
  symbols and spaces stripped) and by a cheap near-duplicate check: token sets (letters, marks, digits; one-letter
  tokens and a short list of filler words dropped), Jaccard |A n B| / |A u B|, a hit at **0.8 or more** with at least
  2 tokens on each side. The threshold is set high on purpose: a hit only turns a choice into a visible proposal that
  cools a full day, never a refusal, but a lower one would catch unrelated facts that share words. Then:
  - `remember` of matching content is a disagreement proposal: a `learn-disagreement` row, a full day of cooling
    (`--revisit now` is not used), `proposalOf: undone:<fp16>` and `match` (`same-text` or `similar-to <fp16>, <score>`).
  - A first yes from BEFORE that rollback no longer counts: its `--second-yes` is refused and a new first yes (a full
    day) is written.
  - For a day after any person rollback (real clock), an early `--revisit` is not used on a new choice.
  - A confirmed queue entry with matching content trains only if it was chosen after the rollback and cooled a full
    day (the app's proposal); a queue entry chosen within that day with an early revisit is rejected. Both are rows.
  - A mind never brings back (`restore`, `activate`) a version a person took back; a person may.
  - "After the rollback" compares chain timestamps to the millisecond (`iso_epoch_ms`): an Undo in the same second as
    a first yes still counts as after it (the full suite caught the second-cut compare in recheck4).
  - **Limit, plainly:** a paraphrase in other words ("Before she married, Mom was a Hollowell" for "Mom's maiden name
    is Hollowell") is not matched. Inside the day after the person's no it still cools a full day; after that day it
    is an ordinary new choice. Only a person reading the export catches it then (Mac trial rule (e)).
- **One confirm gate (round 11: Weft recheck5 F9, Hypha 3d9b062a (A) and (B), Weft F10).** On EVERY second yes of the
  mind (app keep, `remember --second-yes`, a confirmed queue entry), proposals included:
  - Content: any matching person no (same text, or a near duplicate) written AFTER this row's first yes (for a
    proposal: after it began) makes it a disagreement: refused, with a new full day. "After" is chain order in the
    runner and the millisecond in the app, and a tie goes to the person.
  - The day: for 24 h after ANY person no of this mind, a row that cooled less than a full day waits until
    max(its revisitAt, that no + 24 h), whenever it was chosen (`personUndoDay` / `person-no-day:<id>` on the row).
    A queue entry with no `t` counts as the export time (or now), so a missing or backdated `t` no longer helps.
  - A repeat attaches to an open proposal only when its normalized text is the same. A different text (a
    correction) is its own row, stored, with a ledger row.
  - Near duplicates: digits and one-letter tokens are kept; not/no/never/nor/cannot/n't are content. A different
    number or a negation on one side only is not a near duplicate. For matching only, lookalike letters (the name
    skeleton letters; digits stay digits), zero-width and other format characters, and combining marks are folded.
    `learn-match-v0.2.json` pins both languages (v0.1 is the earlier rule, kept as it was).
  - The paraphrase limit is unchanged and stated: a paraphrase in other words is caught only for the day after the
    person's no (it waits); after that day it can be confirmed, and only a person reading the export catches it.
- **Round 12 (Hypha 23c464ac (C), Weft recheck6 F11).** Changes to the gate above (the round 11 lines stay as they were):
  - The day, widened (F11): for 24 h after ANY person no, a row chosen AT OR BEFORE that no also waits until
    max(its revisitAt, that no + 24 h), whatever its own cooling (a full day spent before the no does not count). In
    the queue: `t_e <= rollback` means wait. A row chosen after the no with its own full day is not held beyond it.
  - Near duplicates, changed (C): there is no hard 0 any more for a negation or a different number. Digits, one-letter
    words and negators are ordinary tokens that lower the Jaccard score, so "T 2", "T (1)" and "T, isn't it" score
    0.833 against T and are proposals a day after the Undo. A correction ("May 5" after "May 4") stays apart because a
    repeat attaches only on the same normalized text: in a short sentence it scores 0.667 (its own row, the day rule);
    in a long one 0.857 (its own stored proposal). One spelling for negations in both twins: cannot / can't / cant ->
    "can not", won't / wont -> "will not", shan't -> "shall not", doesnt / isnt / dont ... (no apostrophe) -> "does not"
    / "is not" / "do not" ..., any other n't -> "not". `learn-match-v0.3.json` pins both languages (v0.2 and v0.1 kept).
  - Known, not changed: an app Undo that names a restore (pointer) receipt, which has no `beforeFp`, goes back to
    "none" (no learned version active). That is the safe direction. Going back to the receipt's `rollbackOf` instead
    would let an app request re-activate an older version without the restore checks, so it was left as it is.
- **Round 13 (Weft recheck7 F12 and its side soft).**
  - F12: `go_back` refuses a mind actor for an undo (`rollback`) too, not only `restore`/`activate`, when the target is
    a version a person took back: `undo --by mind:X` right after a person's undo, and an app Undo request with
    `by: mind` whose receipt's beforeFp a person took back. A `consent-refused` row (subject rollback), exit 1; the
    app request's `inbox-request` row says "Refused (the row before says why)", done false. The app itself has no
    pointer to move (its Undo is the request file); a mind's unkeep there changes nothing and its keep is a proposal.
  - Side soft: a PERSON's undo that lands on a version a person took back (a second undo from none toggles back to
    it) still happens, but the rollback row carries `personYesFor: <fp>`, the runner prints a note, and
    `person_undone_fps` counts it as that person's yes, so status and audits no longer list an active version as
    undone. A further undo takes it back again (a new person no).
- **Base model:** a base that cannot be fingerprinted is not learned on unless `--allow-unknown-base` (recorded).
  Weft recheck3 F6: the base is fingerprinted from the FULL content of every weight and config file on every run
  (no cache), so an edit anywhere changes it, even with size and mtime put back.
- **Mind names (Weft recheck3 F4/F5):** `norm_mind` here and `normMind` in the app are the same steps (NFKC, upper
  then lower, final sigma to sigma, NFKC, one explicit whitespace set); `mind-names-v0.1.json` pins both (the
  acceptance suite and `docs/scripts/smoke-mind-names-v0.1.js`). `trust-mind --to` and `pin-key --owner` refuse a
  name with an invisible character, letters from more than one look-alike script (Latin, Greek, Cyrillic, Armenian,
  Cherokee) or a trailing dot. Before recheck4 the next line read: "A UTS #39 confusable-skeleton check against
  existing minds is not done."
  Weft recheck4 F5: they also refuse a name whose confusable skeleton (`name_skeleton`, a UTS #39-STYLE subset, not
  the full table: Latin/Cyrillic/Greek lookalike letters, 0/1/I/| as o/l/l/l, rn as m, vv as w, combining marks
  dropped, only letters and digits kept) is that of a mind already trusted here or of the mind learning here: an
  all-Cyrillic "Тһіѕ міпԁ", "Lumen_", "Lumen!" and "Lumén" next to "Lumen". A mind acting under a name that looks
  like its own never approves its own key. `learn-match-v0.1.json` pins the skeleton in both languages. Pause actors
  follow the same rule: `PAUSE` lines are percent-encoded, so `mind:Lumen_` is not `mind:Lumen` for lifting a pause
  either (an old PAUSE line written with `_` for a space is read as `_`, which only makes lifting stricter).
