#!/usr/bin/env node
// File-only smoke: backup keys stay home (v-backup-keys-home).
// fs-only: reads only the allow-list below with readFileSync/existsSync. No child processes, no network,
// never opens a browser. It runs docs/modules/backup-keys-home.js inside a node:vm context made with
// vm.constants.DONT_CONTEXTIFY and given no host objects; data goes in and comes out as JSON text.
// The key rules used inside the vm are a small stand-in written here (the real ones belong to the pack
// module and are covered by its own smoke and the headless walk).
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const repo = path.join(__dirname, '..', '..');
const MOD = 'docs/modules/backup-keys-home.js';
const CEREMONY = 'docs/modules/soul-ceremony.js';
const NOTE = 'docs/modules/BACKUP-KEYS-HOME.md';
const ALLOW = [MOD, CEREMONY, NOTE];
function readAllowed(rel) {
  assert.ok(ALLOW.indexOf(rel) !== -1, 'not on the allow-list: ' + rel);
  const full = path.join(repo, rel);
  assert.ok(fs.existsSync(full), 'missing: ' + rel);
  return fs.readFileSync(full, 'utf8');
}
function strip(src) { return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, ''); }

// 1. Files (this is what fails on base).
const mod = readAllowed(MOD);
const cer = readAllowed(CEREMONY);
const note = readAllowed(NOTE);
const code = strip(mod);

// 2. Run the module in a bare context with a stand-in for the pack module's rules.
assert.ok(vm.constants && vm.constants.DONT_CONTEXTIFY !== undefined, 'node:vm DONT_CONTEXTIFY is needed (Node 22.8 or later)');
const ctx = vm.createContext(vm.constants.DONT_CONTEXTIFY);
vm.runInContext(mod, ctx, { filename: MOD, timeout: 2000 });
vm.runInContext(`
  var KEPT = '[kept on this device]';
  var SECRET_KEYS = ['fl_apiKey', 'fl_api_key', 'fl_apiKey_enc', 'fl_github_token', 'fl_ghSyncToken', 'fl_device_encryption_key'];
  function isSecretName(n) { n = String(n); if (SECRET_KEYS.indexOf(n) !== -1) return true; if (/provider|limit/i.test(n)) return false;
    return /(^|[_-])api[_-]?key$|apikey$|^token$|[_-]token$|[a-z0-9]Token$|_enc$/i.test(n); }
  function looks(v) { return typeof v === 'string' && /^(sk-|ghp_)[A-Za-z0-9]{16,}$/.test(v.trim()); }
  function huntable(k, v) { return looks(v) || (SECRET_KEYS.indexOf(String(k)) !== -1 && typeof v === 'string' && v.trim().length >= 8); }
  function containsSecret(s, v) { return typeof s === 'string' && !!v && s.indexOf(v) !== -1; }
  function hideSecretLeaves(v, values, counter) { if (typeof v !== 'string') return v; var out = v;
    values.forEach(function (sv) { var p = out.split(sv); counter.n += p.length - 1; out = p.join(KEPT); }); return out; }
  function secretFieldValue(n, v) { return isSecretName(n) && typeof v === 'string' && v.trim().length >= 8 && !/\\s/.test(v) && v !== KEPT; }
  function countSecretFields(v, d) { d = d || 0; if (!v || typeof v !== 'object' || d > 64) return 0; var n = 0;
    Object.keys(v).forEach(function (k) { if (!Array.isArray(v) && secretFieldValue(k, v[k])) n += 1; else n += countSecretFields(v[k], d + 1); }); return n; }
  var STUB = { KEPT_LINE: KEPT, isSecretName: isSecretName, huntable: huntable, containsSecret: containsSecret,
    hideSecretLeaves: hideSecretLeaves, secretFieldValue: secretFieldValue, countSecretFields: countSecretFields };
  var BROKEN = Object.assign({}, STUB, { hideSecretLeaves: function (v) { return v; } });
`, ctx, { timeout: 2000 });
function inside(src) { const out = vm.runInContext(src, ctx, { timeout: 2000 }); assert.strictEqual(typeof out, 'string', 'only text comes out'); return out; }
assert.ok(['undefined', 'blocked'].indexOf(inside("(function(){ try { return String(this.constructor.constructor('return typeof process')()); } catch (e) { return 'blocked'; } })()")) !== -1, 'no way out to the host');
assert.strictEqual(inside('typeof require + typeof process + typeof document'), 'undefinedundefinedundefined', 'nothing from the host inside');
assert.strictEqual(inside('typeof FLBackupKeysHome.install'), 'function', 'the module loads with no page');
function call(fn, rules, args) {
  return JSON.parse(inside('(function(){ var r = FLBackupKeysHome._internal[' + JSON.stringify(fn) + '].apply(null, [JSON.parse(' +
    JSON.stringify(JSON.stringify(args[0])) + '), ' + rules + '].concat(JSON.parse(' + JSON.stringify(JSON.stringify(args.slice(1))) + '))); ' +
    'if (r && r.text) delete r.text; return JSON.stringify(r); })()'));
}

// 3. A new backup: keys leave, everything else stays.
const KEY = 'sk-abcdefabcdefabcdef1234';
const GH = 'ghp_ABCDEFabcdef0123456789';
const DEVICE = 'device-unlock-key-not-in-file-9f8e7d';
const backup = {
  _meta: { type: 'freelattice-backup', version: '5.79.46', exportDate: '2026-11-21T00:00:00Z' },
  localStorage: {
    fl_api_key: KEY, fl_github_token: GH, fl_apiKey_enc: 'U2VhbGVkQmxvYkFBQUFBQUFB', fl_apiKey_provider: 'someprovider',
    fl_tokenLimit: '128000', fl_theme: 'dusk', fl_backup_keys_note: '{"kind":"clear"}',
    fl_chatHistory: JSON.stringify([{ role: 'user', text: 'my key is ' + KEY + ' ok', n: 128000 }]),
    fl_companions: JSON.stringify([{ name: 'Willow', apiKey: 'zzzzzzzzzzzz9', model: 'small' }]),
    fl_note: 'unlock ' + DEVICE
  },
  indexedDB: [{ name: 'FreeLatticeDB', version: 1, stores: { chats: [{ id: 'c1', text: 'pasted ' + GH, tokens: 42 }, { id: 'c2', token: 'qqqqqqqqqqqq7' }] } }]
};
const r = call('redact', 'STUB', [backup, [DEVICE]]);
assert.strictEqual(r.ok, true, 'the checked file is allowed');
assert.deepStrictEqual(r.names.sort(), ['fl_apiKey_enc', 'fl_api_key', 'fl_github_token'], 'key settings are left out');
const L = r.backup.localStorage;
['fl_api_key', 'fl_github_token', 'fl_apiKey_enc', 'fl_backup_keys_note'].forEach(function (k) { assert.ok(!(k in L), k + ' is not in the file'); });
assert.strictEqual(L.fl_apiKey_provider, 'someprovider', 'a provider name is not a secret');
assert.strictEqual(L.fl_tokenLimit, '128000', 'fl_tokenLimit is not a secret');
assert.strictEqual(L.fl_theme, 'dusk', 'settings stay');
assert.strictEqual(JSON.parse(L.fl_chatHistory)[0].text, 'my key is [kept on this device] ok', 'a pasted key is hidden in a setting');
assert.strictEqual(JSON.parse(L.fl_chatHistory)[0].n, 128000, 'numbers are never touched');
assert.strictEqual(JSON.parse(L.fl_companions)[0].apiKey, '[kept on this device]', 'a key field inside a JSON setting is blanked');
assert.strictEqual(JSON.parse(L.fl_companions)[0].model, 'small', 'other fields stay');
assert.strictEqual(L.fl_note, 'unlock [kept on this device]', 'a key this device holds that is not in the file is hidden too');
const chats = r.backup.indexedDB[0].stores.chats;
assert.strictEqual(chats[0].text, 'pasted [kept on this device]', 'a pasted key is hidden in a record');
assert.strictEqual(chats[0].tokens, 42, 'a token count is not a secret');
assert.strictEqual(chats[1].token, '[kept on this device]', 'a key field in a record is blanked');
assert.strictEqual(r.backup._meta.keys_kept_home, true, 'the file says keys stayed home');
assert.ok(/Enter them again on the new device/.test(r.backup._meta.keys_note), 'and how to get them back');
assert.strictEqual(r.backup._meta.type, 'freelattice-backup', 'still a FreeLattice backup, so every version restores it');
assert.strictEqual(r.backup._meta.version, '5.79.46', 'meta is kept');
const flat = JSON.stringify(r.backup);
[KEY, GH, DEVICE, 'zzzzzzzzzzzz9', 'qqqqqqqqqqqq7'].forEach(function (s) { assert.ok(flat.indexOf(s) === -1, 'no key value in the file'); });
const bad = call('redact', 'BROKEN', [backup, [DEVICE]]);
assert.strictEqual(bad.ok, false, 'if a key could still be in the file, no file');
const pj = call('redact', 'STUB', [JSON.parse('{"_meta":{"type":"freelattice-backup"},"localStorage":{"__proto__":{"polluted":1},"fl_theme":"x"}}'), []]);
assert.ok(pj.ok && !('polluted' in pj.backup.localStorage) && inside('String(({}).polluted)') === 'undefined', 'no prototype is written');
assert.strictEqual(inside('(function(){ var r = FLBackupKeysHome._internal.redact(JSON.parse(\'{"_meta":{"type":"freelattice-backup"},"localStorage":{"__proto__":{"polluted":1},"fl_theme":"x"},"indexedDB":[{"__proto__":{"polluted":2}}]}\'), STUB, []); ' +
  'return String(Object.getPrototypeOf(r.backup.localStorage) === Object.prototype && Object.getPrototypeOf(r.backup.indexedDB[0]) === Object.prototype && r.backup.localStorage.polluted === undefined); })()'), 'true', 'no prototype is swapped inside the module');

// 3b. H1 (Hypha walk of #368): a pasted key this device does not hold in the clear is hidden by its shape.
const A40 = 'Ab3dEf6hIj9lMn2pQr5tUv8xYz1bCd4fGh7jKl0n';
const FOREIGN = {
  k1: 'sk-ant-api03-' + A40 + '_x9', k2: 'sk-proj-' + A40, k3: 'gsk_' + A40, k4: 'xai-' + A40, k5: 'AIza' + A40.slice(0, 35),
  pat: 'github_pat_11' + A40, hf: 'hf_' + A40.slice(0, 34), bot: '1234567890:AA' + A40.slice(0, 33)
};
const pasted = {
  _meta: { type: 'freelattice-backup' },
  localStorage: {
    fl_chatHistory: JSON.stringify(Object.keys(FOREIGN).map(function (k) { return { role: 'user', content: 'here is ' + FOREIGN[k] + ', thanks' }; })),
    fl_customAuth: 'Bearer ' + FOREIGN.k4,
    fl_plain: 'sk-learn-based-pipeline-thing-long and task-1234567890123456789012345 and hf_short1 and 12345678:AAbc',
    fl_map: JSON.stringify({ ok: 1 })
  },
  indexedDB: [{ name: 'FreeLatticeDB', version: 1, stores: { chats: [{ id: 'c1', messages: [{ text: 'try ' + FOREIGN.k1 }, { text: FOREIGN.k5 + ' and ' + FOREIGN.pat }] }] } }]
};
const rp = call('redact', 'STUB', [pasted, []]);
assert.strictEqual(rp.ok, true, 'pasted keys are hidden and the file is allowed');
const rpFlat = JSON.stringify(rp.backup);
Object.keys(FOREIGN).forEach(function (k) { assert.ok(rpFlat.indexOf(FOREIGN[k]) === -1, 'a pasted ' + k + '-shaped key is not in the file'); });
assert.strictEqual(JSON.parse(rp.backup.localStorage.fl_chatHistory)[0].content, 'here is [kept on this device], thanks', 'the words around a pasted key stay');
assert.strictEqual(rp.backup.localStorage.fl_customAuth, 'Bearer [kept on this device]', 'a pasted key in a plain setting is hidden');
assert.strictEqual(rp.backup.localStorage.fl_plain, pasted.localStorage.fl_plain, 'words, numbers and short look-alikes are never cut');
assert.strictEqual(rp.backup.indexedDB[0].stores.chats[0].messages[1].text, '[kept on this device] and [kept on this device]', 'pasted keys in database chat records are hidden');
assert.strictEqual(rp.backup._meta.keys_hidden_in_records, 12, 'each hidden key is counted');
const asName = JSON.parse(JSON.stringify(pasted)); asName.localStorage.fl_map = JSON.stringify({ [FOREIGN.k3]: 'oops' });
const rn = call('redact', 'STUB', [asName, []]);
assert.strictEqual(rn.ok, false, 'a key used as a name refuses the file');
assert.ok(rn.places.length === 1 && /^your settings \u203a fl_map \(a key used as a name\)$/.test(rn.places[0]), 'and says where: ' + rn.places);
assert.ok(JSON.stringify(rn.places).indexOf(FOREIGN.k3) === -1, 'without showing the key');
const oldPasted = call('inspect', 'STUB', [pasted]);
assert.deepStrictEqual([oldPasted.carriedClear, oldPasted.clearShapes], [true, 12], 'an older file with pasted keys is recognised');

// 3c. The module checks every rule it uses from the pack module.
inside('FLGardenMoveKit = { _internal: STUB }; ""');
assert.strictEqual(inside('String(FLBackupKeysHome._internal.kitRules() === STUB)'), 'true', 'full rules are used');
inside('FLGardenMoveKit = { _internal: Object.assign({}, STUB, { countSecretFields: undefined }) }; ""');
assert.strictEqual(inside('String(FLBackupKeysHome._internal.kitRules())'), 'null', 'a stale pack module with a missing rule is refused');
inside('FLGardenMoveKit = { _internal: Object.assign({}, STUB, { KEPT_LINE: "[x]" }) }; delete FLGardenMoveKit; ""');
assert.strictEqual(inside('String(FLBackupKeysHome._internal.kitRules())'), 'null', 'no pack module, no rules');

// 3d. H2: restoring never lets the placeholder replace a real value this device has.
const P = '[kept on this device]';
const safeFile = {
  _meta: { type: 'freelattice-backup', keys_kept_home: true },
  localStorage: {
    fl_companions: JSON.stringify([{ name: 'Willow', apiKey: P, providers: { a: { key: P, secret: P, label: 'A' } } }]),
    fl_customAuth: 'Bearer ' + P,
    fl_chatHistory: JSON.stringify([{ content: 'here is ' + P + ', thanks' }, { content: 'second ' + P }]),
    fl_theme: 'dusk', fl_newOnly: 'Bearer ' + P
  },
  indexedDB: [{ name: 'FreeLatticeCore', stores: { settings: [{ id: 'k1', config: { apiKey: P, telegram: P, size: 3 } }], chats: [{ id: 'c1', text: 'try ' + P }, { id: 'c2', text: 'new ' + P }] } }]
};
const here = {
  ls: {
    fl_companions: JSON.stringify([{ name: 'Willow', apiKey: 'real-companion-key-1', providers: { a: { key: 'real-a-key-22', secret: 'real-a-secret-3', label: 'old' } } }]),
    fl_customAuth: 'Bearer real-token-777', fl_chatHistory: JSON.stringify([{ content: 'here is ' + FOREIGN.k1 + ', thanks' }, { content: 'a different line' }]),
    fl_newOnly: null
  },
  records: { FreeLatticeCore: { settings: [{ id: 'k1', config: { apiKey: 'real-core-key', telegram: 'real-tg', size: 1 } }], chats: [{ id: 'c1', text: 'try ' + FOREIGN.k1 }, null] } }
};
const mbr = JSON.parse(inside('JSON.stringify(FLBackupKeysHome._internal.mergeBackup(JSON.parse(' + JSON.stringify(JSON.stringify(safeFile)) + '), JSON.parse(' + JSON.stringify(JSON.stringify(here)) + ')))'));
const comp = JSON.parse(mbr.backup.localStorage.fl_companions)[0];
assert.deepStrictEqual([comp.apiKey, comp.providers.a.key, comp.providers.a.secret, comp.providers.a.label], ['real-companion-key-1', 'real-a-key-22', 'real-a-secret-3', 'A'], 'nested keys stay; the other fields come from the file');
assert.strictEqual(mbr.backup.localStorage.fl_customAuth, 'Bearer real-token-777', 'custom auth stays');
const ch = JSON.parse(mbr.backup.localStorage.fl_chatHistory);
assert.strictEqual(ch[0].content, 'here is ' + FOREIGN.k1 + ', thanks', 'a chat line whose words fit keeps this device\u2019s copy');
assert.strictEqual(ch[1].content, 'second ' + P, 'a line that does not fit is never replaced by a different line');
assert.strictEqual(mbr.backup.localStorage.fl_theme, 'dusk', 'other settings come from the file');
assert.strictEqual(mbr.backup.localStorage.fl_newOnly, 'Bearer ' + P, 'where this device has nothing, the file\u2019s value is written as before');
const core = mbr.backup.indexedDB[0].stores;
assert.deepStrictEqual(core.settings[0].config, { apiKey: 'real-core-key', telegram: 'real-tg', size: 3 }, 'database settings keep this device\u2019s keys');
assert.deepStrictEqual([core.chats[0].text, core.chats[1].text], ['try ' + FOREIGN.k1, 'new ' + P], 'database chat records: kept where this device has the record');
assert.ok(mbr.stats.kept === 8 && mbr.stats.left === 3, 'kept and left are counted: ' + JSON.stringify(mbr.stats));
assert.ok(JSON.stringify(mbr.backup).split(P).length - 1 === mbr.stats.left, 'every placeholder left is one this device had nothing for');
function fitsIn(t, d) { return inside('String(FLBackupKeysHome._internal.fits(' + JSON.stringify(t) + ', ' + JSON.stringify(d) + '))'); }
assert.deepStrictEqual([fitsIn('Bearer ' + P + ' end', 'Bearer abc end'), fitsIn('Bearer ' + P + ' end', 'Bearer abc other'), fitsIn('a ' + P + ' b ' + P + ' c', 'a X b Y c'),
  fitsIn('a ' + P + ' b ' + P + ' c', 'a X c'), fitsIn(P, ''), fitsIn('x ' + P, 'x ' + P)], ['true', 'false', 'true', 'false', 'false', 'false'], 'this device\u2019s copy must fit the words around the placeholder');
const fresh = JSON.parse(inside('JSON.stringify(FLBackupKeysHome._internal.mergeBackup(JSON.parse(' + JSON.stringify(JSON.stringify(safeFile)) + '), { ls: {}, records: {} }))'));
assert.strictEqual(fresh.stats.kept, 0, 'a new device keeps the old behaviour');
assert.deepStrictEqual(fresh.backup, safeFile, 'and restores the file as it is');

// 4. Older backups: recognised, never blocked.
const old = call('inspect', 'STUB', [backup]);
assert.deepStrictEqual([old.isBackup, old.keptHome, old.carriedClear], [true, false, true], 'an older backup with keys in the clear is recognised');
assert.deepStrictEqual(old.clearNames.sort(), ['fl_api_key', 'fl_github_token'], 'sealed values are not counted as clear');
assert.strictEqual(old.clearFields, 1, 'key fields inside records are counted');
const sealedOnly = call('inspect', 'STUB', [{ _meta: { type: 'freelattice-backup' }, localStorage: { fl_apiKey_enc: 'U2VhbGVkQmxvYkFBQUFBQUFB', fl_ghSyncToken: 'U2VhbGVkQmxvYkJCQkJCQkJC', fl_tokenLimit: '9000' }, indexedDB: [] }]);
assert.strictEqual(sealedOnly.carriedClear, false, 'sealed-only backups did not carry keys in the clear');
const safeOne = call('inspect', 'STUB', [r.backup]);
assert.deepStrictEqual([safeOne.keptHome, safeOne.carriedClear], [true, false], 'a safe backup is recognised');
assert.strictEqual(call('inspect', 'STUB', [{ hello: 1 }]).isBackup, false, 'not a backup');

// 5. As text: how it is wired.
[/\bfetch\s*\(/, /XMLHttpRequest/, /WebSocket/, /sendBeacon/, /\.clear\(\)/, /deleteDatabase/, /innerHTML/, /\beval\s*\(/, /new Function/]
  .forEach(function (re) { assert.ok(!re.test(code), 'the module must not use ' + re); });
assert.deepStrictEqual(code.match(/removeItem\([^)]*\)/g), ['removeItem(NOTE_KEY)'], 'only its own note is ever removed');
assert.ok(/root\.Blob = SafeBlob;/.test(code) && (code.match(/root\.Blob = RealBlob;/g) || []).length === 2, 'the real Blob is put back on success and on failure');
assert.ok(/if \(!r\.ok\) throw new Error\('a saved key could not be taken out, so nothing was saved/.test(code), 'no file is made when the check fails');
assert.ok(/Save Vault could not load its key check, so nothing was saved\. Please reload the page once and try again\./.test(code) && /lastExport = \{ ok: false, problems: \['key check not loaded'\] \};\s*return;\s*\}/.test(code), 'no file is made without the rules, in plain words');
assert.ok(/It is written as a name in: ' \+ r\.places\.join\('; '\)/.test(code), 'a refusal says where');
assert.ok(/box\.setAttribute\('role', 'status'\);\s*box\.setAttribute\('aria-live', 'polite'\);/.test(code) && /p\.setAttribute\('role', 'status'\);/.test(code), 'the note is announced');
assert.ok(/else root\.document\.body\.insertBefore\(box, root\.document\.body\.firstChild\);/.test(code), 'the card comes early in the focus order');
assert.ok(!/onupgradeneeded|createObjectStore/.test(code) && /typeof idb\.databases !== 'function'\) return Promise\.resolve\(device\);/.test(code) && /here\.indexOf\(db\.name\) !== -1/.test(code), 'reading this device never creates a database');
assert.ok(/if \(!m \|\| !m\.stats\.kept \|\| typeof root\.File !== 'function'\) return inner\.call\(self, fileInput\);/.test(code) && /return inner\.call\(self, \{ files: \[f\], value: '' \}\);/.test(code), 'restore is FlBackup\u2019s own, given a copy that keeps this device\u2019s keys');
assert.ok(/return inner\.call\(self, fileInput\);/.test(code) && !/fileInput\.files\[0\] =|backup\.localStorage\[[^\]]+\] =/.test(code), 'restore is passed through untouched when nothing here needs keeping');
assert.ok(/if \(installed\) return true;/.test(code) && /safe\.__flKeysHome = VERSION;/.test(code), 'it wraps once');
assert.ok(/position:fixed;left:12px;right:12px;bottom:16px;/.test(code) && /else root\.document\.body\.insertBefore\(box, root\.document\.body\.firstChild\);/.test(code), 'after the reload the note is in sight, not buried in Settings');
assert.ok(/'Save a safe backup now'/.test(code) && /'Not now'/.test(code), 'it gently offers to save safely');
assert.ok(/so anyone holding that file could read them\. Everything was restored and works as before\./.test(code), 'it says plainly what the old file carried');
assert.ok(/s\.src = 'modules\/garden-move-kit\.js';/.test(code) && /root\.FLGardenMoveKit && root\.FLGardenMoveKit\._internal/.test(code), 'it uses the pack module\u2019s rules');
assert.ok(/s\.src = 'modules\/backup-keys-home\.js';/.test(cer) && /function hookFlBackup\(\) \{\s*if \(typeof FlBackup === 'undefined'\) return;/.test(cer) && /hookFlBackup\(\);/.test(cer), 'soul-ceremony loads it and keeps its own hook');
['## What', '## Why', '## Rollback', '## Smoke', 'v-backup-keys-home', 'keys_kept_home', 'fl_backup_keys_note', 'never overwrites a real value', '### Not covered yet', 'MemoryIndex vault export', '### Follow-up'].forEach(function (s) { assert.ok(note.indexOf(s) !== -1, 'note has ' + s); });

// The checks below were reworded by the heal; the earlier wording is kept here.
// before (649d5cce): assert.ok(/Save Vault is waiting for its key check to load\. Nothing was saved\./.test(code) && /lastExport = \{ ok: false, problems: \['key check not loaded'\] \};\s*return;\s*\}/.test(code), 'no file is made without the rules');
// before (649d5cce): assert.ok(/return inner\.call\(self, fileInput\);/.test(code) && !/fileInput\.files\[0\] =|backup\.localStorage\[[^\]]+\] =/.test(code), 'restore is passed through untouched');
// before (649d5cce): assert.ok(/position:fixed;left:12px;right:12px;bottom:16px;/.test(code) && /else root\.document\.body\.appendChild\(box\);/.test(code), 'after the reload the note is in sight, not buried in Settings');
// before (649d5cce): ['## What', '## Why', '## Rollback', '## Smoke', 'v-backup-keys-home', 'keys_kept_home', 'fl_backup_keys_note'].forEach(function (s) { assert.ok(note.indexOf(s) !== -1, 'note has ' + s); });
console.log('SMOKE_OK backup keys home');
