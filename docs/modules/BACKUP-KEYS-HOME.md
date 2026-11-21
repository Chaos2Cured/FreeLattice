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
  - **Pasted keys this device never held (heal 1).** A key pasted into a chat, a memory or a record may come from somewhere else, so this device does not know its value. The module also looks for the common shapes of keys and tokens (a short known prefix followed by a long run of letters and digits, within sensible lengths, holding at least one letter and one digit). Each one found anywhere in the file becomes `[kept on this device]`. Ordinary words, short codes, ids and numbers do not match. **Save a safe backup now** goes through the same path, so it drops them too.
- **The result is checked.** If any saved key value, key setting or key field is still in the file, no file is made and FlBackup's own "Export failed" line says why.
- The file gains `_meta.keys_kept_home: true`, `keys_note`, `keys_left_out`, `keys_hidden_in_records` and `keys_layer`.
- The page adds one plain line: "Keys and passwords stayed on this device… On a new device, enter them again in Settings." (Since the softs brick it reads "Saved keys and passwords stayed on this device… A key pasted in an unusual form may not be recognised, so look before you share the file.")
- If the rules cannot load, nothing is saved, and the page says to try again in a moment. A file with keys in it is never made silently.
  - (heal) The module checks every rule it uses from the kit, not only one. If the page holds an older copy of the kit, nothing is saved and the page says plainly: "Please reload the page once and try again."
  - (heal) When a key is used as the name of a field or an id, it cannot be hidden without changing the record, so the file is refused. The message now says where it sits (for example "your settings › fl_map", or a database › store › item), without showing the key.

**Restoring (Weft's guard, Reed's note):**
- **Every older backup still restores exactly as before.** FlBackup's restore is not changed or filtered, so nothing becomes unreadable.
- **`[kept on this device]` never overwrites a real value (heal 2).** A safe backup restored on the same device used to write the placeholder over keys the device still held inside settings and records (nested companion keys, `fl_customAuth`, core settings, chat records). Now, before FlBackup writes, the module reads what this device already has (read only; it never creates a database) and, for each field holding the placeholder at any depth, keeps this device's value when its words around the placeholder match. FlBackup then restores that merged copy. On a new device there is nothing to keep, so the file restores as it did before, and the page says which keys to enter again.
- **A backup that carried keys in the clear:** before the restore, the module reads the file (nothing written) and notes which settings held real key values in the clear, plus key fields inside records. Sealed values (`*_enc`, `fl_ghSyncToken`) are not counted, because they cannot be read on another device. After the restore the page says plainly: "This backup carried saved keys in the clear (…), so anyone holding that file could read them. Everything was restored and works as before." It gently offers **Save a safe backup now** or **Not now**. The note is kept in `fl_backup_keys_note` (kind, time and key names, never values), so it is still there after FlBackup's reload. It shows as a small card at the bottom of the screen until it is answered, because the Memory Vault sits inside Settings, under Advanced. When the Vault is open, it shows under its buttons instead.
- **A backup that kept keys home:** a gentle note says to enter the keys again in Settings.

Nothing is sent anywhere and nothing is cleared. The only key this module removes is its own note, once it is answered.

### SoulFile store names
Left for later. SoulFile lives inside `app.html`, which stays unchanged here, so the fix is not tiny.

### Softs after #368 (Hypha's re-walk at 34b0db36)
1. **Slugs are not keys.** An `sk-` value is hidden only when it holds an unbroken run of 16 or more letters and digits, so names such as `sk-2024-annual-report-final-v2-draft` come back as they are.
2. **Record ids are never rewritten.** Before saving, the module reads which field is each store's id on this device (read only; it never creates a database). If it cannot tell, both `id` and `key` count as ids. An id that looks like a key is never hidden, because two such records would become one on a new device. Instead, nothing is saved and the page names each place, for example "FreeLatticeDB › chats › item 1 (a key used as a record id)", without showing the key.
3. **More shapes.** These are now caught as well:
   - access key ids (`AKIA…`)
   - three-part tokens that start with `eyJ`
   - `sk_` followed by hex
   - a key wrapped in base64. The base64 is read on the device, and only a run whose text holds a key shape is hidden, so base64 clay, hashes and ids stay.
   - a long key that mixes capitals, small letters and digits, when it comes right after words such as "key", "token", "secret", "password" or "Bearer"
   - a field named plainly `key` that holds one long word with letters and digits (not when it is the record's id)
4. **Honest words.** The page no longer says keys "never go in the file". It says that saved keys, and pasted keys in the shapes Save Vault knows, are left out, and it asks you to look before you share the file.
5. **A stronger smoke.** There is one sample per shape at its shortest length, with a one-character-shorter twin that must stay. Look-alikes must come back byte for byte. Every kit rule is checked one at a time, and the placeholder words are compared. A stand-in database inside the vm shows that this device's records are read, opened with no version, read only and closed. Hypha's 21 mutations from her re-walk are all caught (3 of them adapted, where the line they target was replaced).

### Screen readers
The lines and the card are `role="status"` with `aria-live="polite"`, so they are read out, and the card sits early in the page so it comes early in the focus order.

### Not covered yet
This layer covers Save Vault (`FlBackup`) only. These exports are not covered yet and are left for their own bricks: the memory vault export (MemoryIndex vault export), `.lattice` files, the wallet export, `lattice-export`, and SoulFile. Settings whose names do not look like keys and whose values have no known key shape are also not caught.
Since the softs brick, these are still not caught, on purpose, because catching them would also cut hashes, ids or clay:
- a long key with no prefix and no naming words near it (for example a bare 32-character key on its own)
- a base64 run longer than 8192 characters
- a key split across lines or hidden inside other encodings

### Follow-up (waiting on Kirk's OK for lock moves)
The service worker serves `soul-ceremony.js` cache-first, so installed gardens only get this after a `CACHE_NAME` bump in `sw.js`. That bump is paired with a guard for the short window before this layer loads. Both need lock moves, so they are not in this brick. Pins to update with them: the LOCK rows for `sw.js` and `docs/sw.js`; `smoke-garden-move-kit-1`, `smoke-chat-bottom-clarity-v0.1`, `smoke-snowflake-cache-strategy-v0.1` (cache name) and `smoke-menu-contrast-more-cards` (edit the pin only); the HEARTH_CODE doc; and `GARDEN-MOVE-KIT-2.md`.

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
- (heal) It also checks: pasted keys of many shapes in chats, JSON settings and records are hidden while plain words stay; a key used as a name is refused and its place is named; an older kit is refused with the plain reload message; a same-device restore keeps nested, auth, core-setting and chat-record values and never writes the placeholder over a real one; a line that does not fit is not replaced; a new device restores as before; the device read never creates a database; the merged copy is what FlBackup restores; and the lines are announced.
- It fails on base because the module is missing.
