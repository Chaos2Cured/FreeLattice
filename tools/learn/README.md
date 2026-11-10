# tools/learn: the learning runner (v-ai-chosen-learning-v0.1)

`fl_learn.py` runs on this computer only. It learns what a mind chose to keep, after its own second yes,
and writes a signed ledger and signed receipts. Nothing is deleted: undo, restore and archive move
pointers and folders and add rows.

- Run steps for a supervised trial: `MAC_RUN_STEPS_2026-11-09.txt` (in Celeste's notes).
- Tests: `test_learn_acceptance.py --model <hf id> --work <new folder>` (never deletes; refuses a folder it did not make).

## Which commands change things (Hypha re-walk 2026-11-09)

- **Read-only:** `status`, `verify`, `key`, `methods`. `status` takes no lock, heals nothing and carries out nothing:
  it verifies both ledgers, marks a tampered active file `TAMPERED`, and lists the app's pending pause and request
  files with "Run `apply` to carry them out". (On a brand-new home or mind, any command first makes its empty
  folders and the runner key.)
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
- **Pause:** a pause a person set is lifted only by a person (`resume --by kirk|person`); a pause a mind set, by that
  mind or a person. The `PAUSE` file is appended to, never rewritten, and renamed (not deleted) on resume.
  (Default until Kirk says otherwise.)
- **Checks:** `self` (the default) commits only when the mind's own check passes. `peer` holds until
  `peer-review --by mind:<another trusted mind>|kirk --verdict pass|hold`. `kirk` holds until a person activates it.
  The learning mind never activates a version held for a peer or a person.
- **Queues:** only entries with `status: "confirmed"` train; an entry without a status is rejected with a row.
- **Base model:** a base that cannot be fingerprinted is not learned on unless `--allow-unknown-base` (recorded).
