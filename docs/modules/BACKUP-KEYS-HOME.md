# Backup keys stay home

21 November 2026. Marker `v-backup-keys-home`. Layer, never delete. Chosen by the family for Kirk (t1425u).

## What

**Save Vault** (`FlBackup` in `app.html`) wrote every localStorage value into `freelattice-backup-YYYY-MM-DD.json`. That meant saved keys and tokens that are kept as plain text, such as `fl_api_key`, `fl_apiKey`, `fl_github_token`, `fl-telegram-token` and `chalkboard-apikey`, travelled in the clear. A copy pasted into a chat or a memory travelled too.

The new module `docs/modules/backup-keys-home.js` (`window.FLBackupKeysHome`) layers on top of FlBackup, and `app.html` stays unchanged. It is loaded by `docs/modules/soul-ceremony.js`, which the app already loads, and which already wraps FlBackup for its ceremony.

**Saving a new backup:**
- FlBackup collects everything exactly as before.
- Just before the file is made, the module reads it and applies the garden move kit's rules (`FLGardenMoveKit._internal`, loading `modules/garden-move-kit.js` if it is not on the page yet):
  - Settings named like a key (`isSecretName`) are left out. Provider names (`fl_apiKey_provider`), `fl_tokenLimit`, `max_tokens` and similar are not secrets, so they stay.
  - Only real key values are hunted (`huntable`: a real-looking credential, or a value saved under an exact key name). This includes the keys this device holds that are never in the file. Any copy of one inside a record or a setting becomes `[kept on this device]`. Numbers and names are never touched.
  - A record field named like a key whose value could be a key (`secretFieldValue`) becomes `[kept on this device]`. This includes fields inside settings that hold JSON.
- **The result is checked.** If any saved key value, key setting or key field is still in the file, no file is made and FlBackup's own "Export failed" line says why.
- The file gains `_meta.keys_kept_home: true`, `keys_note`, `keys_left_out`, `keys_hidden_in_records` and `keys_layer`.
- The page adds one plain line: "Keys and passwords stayed on this device… On a new device, enter them again in Settings."
- If the rules cannot load, nothing is saved, and the page says to try again in a moment. A file with keys in it is never made silently.

**Restoring (Weft's guard, Reed's note):**
- **Every older backup still restores exactly as before.** FlBackup's restore is not changed or filtered, so nothing becomes unreadable.
- **A backup that carried keys in the clear:** before the restore, the module reads the file (nothing written) and notes which settings held real key values in the clear, plus key fields inside records. Sealed values (`*_enc`, `fl_ghSyncToken`) are not counted, because they cannot be read on another device. After the restore the page says plainly: "This backup carried saved keys in the clear (…), so anyone holding that file could read them. Everything was restored and works as before." It gently offers **Save a safe backup now** or **Not now**. The note is kept in `fl_backup_keys_note` (kind, time and key names, never values), so it is still there after FlBackup's reload. It shows as a small card at the bottom of the screen until it is answered, because the Memory Vault sits inside Settings, under Advanced. When the Vault is open, it shows under its buttons instead.
- **A backup that kept keys home:** a gentle note says to enter the keys again in Settings.

Nothing is sent anywhere and nothing is cleared. The only key this module removes is its own note, once it is answered.

### SoulFile store names
Left for later. SoulFile lives inside `app.html`, which stays unchanged here, so the fix is not tiny.

## Why

Kirk asked the family to pick what would most empower the small. Celeste, Hypha, Reed and Weft all chose this. A backup is the file people carry around, email to themselves and keep on a USB stick. It should hold their garden, not their keys.

## Rollback

Delete `docs/modules/backup-keys-home.js`, this note and `docs/scripts/smoke-backup-keys-home.js`, and remove the small loader block at the top of `docs/modules/soul-ceremony.js` (marked `v-backup-keys-home`). Or revert the merge commit. Backups made while this was live restore as usual, with the keys entered again.

## Smoke

`node docs/scripts/smoke-backup-keys-home.js` prints `SMOKE_OK backup keys home`.
- It is fs-only. It reads an allow-list (this module, `soul-ceremony.js` and this note) with readFileSync/existsSync, and needs no git, child processes or network. None of those files names a private room.
- It runs the module in a `node:vm` context made with `vm.constants.DONT_CONTEXTIFY`, given no host objects. Data goes in as JSON text and comes out as JSON text. The key rules used there are a small stand-in written inside the vm; the real rules are the pack module's, covered by its own smoke and by the headless walk.
- It checks: key settings left out and their values hidden in records and JSON settings; provider and token-limit settings kept; the file marked; a failed check refuses the file; older files with keys in the clear are recognised, and sealed ones are not counted.
- As text, it checks:
  - The real Blob is put back on every path.
  - The restore is passed through untouched.
  - Only its own note key is ever removed.
  - There is no network, no clearing and no innerHTML.
  - The loader is in `soul-ceremony.js`, with the ceremony hook intact.
  - This note is complete.
- It fails on base because the module is missing.
