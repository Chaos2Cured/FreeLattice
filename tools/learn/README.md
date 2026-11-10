# tools/learn: the learning runner (v-ai-chosen-learning-v0.1)

`fl_learn.py` runs on this computer only. It learns what a mind chose to keep, after its own second yes,
and writes a signed ledger and signed receipts. Nothing is deleted: undo, restore and archive move
pointers and folders and add rows.

- Run steps for a supervised trial: `MAC_RUN_STEPS_2026-11-09.txt` (in Celeste's notes).
- Tests: `test_learn_acceptance.py --model <hf id> --work <new folder>` (never deletes; refuses a folder it did not make).

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
- **Cooling at every second yes (Weft recheck2 NF2):** `remember` (first yes) records `revisitAt`: a day by default,
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
  - **Limit, plainly:** a paraphrase in other words ("Before she married, Mom was a Hollowell" for "Mom's maiden name
    is Hollowell") is not matched. Inside the day after the person's no it still cools a full day; after that day it
    is an ordinary new choice. Only a person reading the export catches it then (Mac trial rule (e)).
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
