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

// 1. Files. (On main before this brick the module is there, so the checks below are what fail there.)
// before (6b5c4046): // 1. Files (this is what fails on base).
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
assert.strictEqual(rn.problems[0], 'a key is used as a name', 'and says why, first');
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

// 3e. Hypha softs on #368 (after ef550fbf).
const SH = JSON.parse(inside('JSON.stringify(FLBackupKeysHome._internal.KEY_SHAPE_PARTS)'));
const AZ = 'Ab3dEf6hIj9lMn2pQr5tUv8xYz1bCd4fGh7jKl0n'.repeat(3);
function a(n) { return AZ.slice(0, n); }
function hid(str) { return JSON.parse(inside('(function(){ var c = { n: 0 }; var o = FLBackupKeysHome._internal.hideKeyShapes(' + JSON.stringify(str) + ', c); return JSON.stringify([o, c.n]); })()')); }
function has(str) { return inside('String(FLBackupKeysHome._internal.hasKeyShape(' + JSON.stringify(str) + '))') === 'true'; }
// Soft 5: one sample per shape, at its shortest, and each sample is that shape's own.
const SAMPLES = [
  ['sk-' + a(20), 'sk-' + a(19)], ['sk_live_' + a(16), 'sk_live_' + a(15)], ['gho_' + a(30), 'gho_' + a(29)], ['github_pat_' + a(30), 'github_pat_' + a(29)],
  ['hf_' + a(30), 'hf_' + a(29)], ['gsk_' + a(30), 'gsk_' + a(29)], ['xai-' + a(30), 'xai-' + a(29)], ['AIza' + a(35), 'AIza' + a(34)],
  ['ya29.' + a(20), 'ya29.' + a(19)], ['xoxb-' + a(10), 'xoxb-' + a(9)], ['glpat-' + a(20), 'glpat-' + a(19)], ['r8_' + a(30), 'r8_' + a(29)],
  ['pplx-' + a(30), 'pplx-' + a(29)], ['nvapi-' + a(30), 'nvapi-' + a(29)], ['12345678:AA' + a(30), '12345678:AA' + a(29)],
  ['AKIA' + 'ABCDEFGH12345678', 'AKIA' + 'ABCDEFGH1234567'], ['eyJ' + a(8) + '.eyJ' + a(8) + '.' + a(16), 'eyJ' + a(8) + '.eyJ' + a(8) + '.' + a(15)],
  ['sk_' + '0a1b2c3d4e5f6a7b'.repeat(2), 'sk_' + '0a1b2c3d4e5f6a7'.repeat(2)]
];
assert.strictEqual(SAMPLES.length, SH.length, 'one test per shape');
SAMPLES.forEach(function (pair, i) {
  assert.ok(new RegExp('^(?:' + SH[i] + ')$').test(pair[0]), 'sample ' + i + ' is its own shape: ' + SH[i]);
  assert.deepStrictEqual(hid('see ' + pair[0] + ' ok'), ['see [kept on this device] ok', 1], 'the shortest ' + SH[i] + ' key is hidden');
  assert.deepStrictEqual(hid('see ' + pair[1] + ' ok'), ['see ' + pair[1] + ' ok', 0], 'one character shorter is not a ' + SH[i] + ' key');
});
// Letters and digits are looked for after the prefix.
['sk-' + '1'.repeat(24), 'sk-' + 'abcdefghijklmnopqrstuvwxyz', 'ghp_' + 'a'.repeat(32), 'hf_' + '7'.repeat(32)].forEach(function (x) {
  assert.deepStrictEqual(hid('x ' + x), ['x ' + x, 0], 'a prefix alone does not make a key: ' + x);
});
// A shape inside a longer word is not a key.
['mask-' + a(24), 'Xghp_' + a(30), 'nohf_' + a(30), 'ZAIza' + a(35)].forEach(function (x) {
  assert.deepStrictEqual(hid('w ' + x), ['w ' + x, 0], 'a shape inside a longer word is left alone: ' + x.slice(0, 8));
});
// Soft 1: an sk- value needs an unbroken run of 16 letters and digits.
// before (6b5c4046): ['sk-ii-facial-treatment-essence-230ml-2024', 'sk-2024-annual-report-final-v2-draft', 'sk-learn-pipeline-transformer-step'].forEach(function (x) {
['sk-ii-facial-treatment-essence-230ml-2024', 'sk-2024-annual-report-final-v2-draft', 'sk-learn-pipeline-transformer-step', 'sk-Ab3dEf6hIj9lMn-Ab3dEf6h', 'sk-Ab3dEf6hIj9lMn2-Ab3dEf'].forEach(function (x) {
  assert.deepStrictEqual(hid('buy ' + x + ' now'), ['buy ' + x + ' now', 0], 'soft 1: a slug is never cut: ' + x);
});
assert.deepStrictEqual(hid('k sk-ab-' + a(18)), ['k [kept on this device]', 1], 'soft 1: a real sk- key with a 16-run is hidden');
// Soft 3: more shapes, and look-alikes that must come back byte for byte.
const JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dBjftJeZ4CVPmB92K27uhbUJU1p1r_wW1gFWFOEjXk';
const M32 = a(32);
const WRAP = Buffer.from('sk-proj-' + a(40)).toString('base64');
let seed = 11; const bytes = Buffer.alloc(3000); for (let i = 0; i < bytes.length; i++) { seed = (seed * 1103515245 + 12345) & 0x7fffffff; bytes[i] = seed >> 16 & 255; }
const CLAY = bytes.toString('base64');
const SHA = '2d711642b726b04401627ca9fbac32f5c8530fb1903cc4db02258717921a4881';
const LOOK = ['3f9a2c7e-41b8-4d2e-9a6f-0b1c2d3e4f50', 'key 3f9a2c7e41b84d2e9a6f0b1c2d3e4f50', SHA, 'commit 649d5ccedb12018ece65f6b33189b073887f4172', '\u03c8-3f9a2c7e41b8-0007',
  '\u03c8_' + a(40), CLAY, 'internationalization-supercalifragilistic-antidisestablishmentarianism', 'hf_hub_download_models_and_datasets',
  'task-1234567890123456789012345', '12345678:AAbc', 'gsk_tutorial-notes-for-beginners', 'https://example.com/a/b?ref=docs&page=12', M32, 'id ' + M32];
LOOK.forEach(function (x) { assert.deepStrictEqual(hid(x), [x, 0], 'never cut: ' + x.slice(0, 40)); assert.strictEqual(has(x), false, 'not a key: ' + x.slice(0, 40)); });
assert.deepStrictEqual(hid('cloud AKIAIOSFODNN7EXAMPLE | ' + JWT + ' | sk_' + SHA.slice(0, 48)), ['cloud [kept on this device] | [kept on this device] | [kept on this device]', 3], 'soft 3: AKIA, eyJ and sk_ hex are hidden');
assert.deepStrictEqual(hid('my key is ' + M32 + ', token: ' + a(40) + ' and Bearer ' + a(33)), ['my key is [kept on this device], token: [kept on this device] and Bearer [kept on this device]', 3], 'soft 3: a long mixed key right after "key", "token" or "Bearer" is hidden');
assert.deepStrictEqual(hid('wrapped ' + WRAP + ' end'), ['wrapped [kept on this device] end', 1], 'soft 3: a base64-wrapped key is hidden');
assert.deepStrictEqual([has('x ' + WRAP), has('x ' + Buffer.from('just some words here, nothing more').toString('base64'))], [true, false], 'the file check reads base64 too');
assert.strictEqual(inside('FLBackupKeysHome._internal.b64Text(' + JSON.stringify(WRAP) + ')'), 'sk-proj-' + a(40), 'the base64 reader is exact');
const fieldFile = {
  _meta: { type: 'freelattice-backup' },
  localStorage: { fl_companions: JSON.stringify([{ name: 'Willow', grid: [[{ key: 'grid-key-value-4444', n: 1 }, { key: 'theme', n: 2 }, { key: 'short12' }, { key: 'letters-only-value-here' }]] }]), fl_clay: CLAY, fl_fp: JSON.stringify({ sha: SHA, words: LOOK[7] }) },
  indexedDB: [{ name: 'FreeLatticeDB', version: 1, stores: {
    meta: [{ key: 'lastSync2024abc', value: 3 }],
    notes: [{ id: 'n1', key: 'abc123def456ghi789', body: 'kept' }]
  } }]
};
const rf = call('redact', 'STUB', [fieldFile, []]);
assert.strictEqual(rf.ok, true, 'a file with plain key fields is allowed');
const grid = JSON.parse(rf.backup.localStorage.fl_companions)[0].grid[0];
// before (6b5c4046): assert.deepStrictEqual(grid.map(function (g) { return g.key; }), ['[kept on this device]', 'theme', 'short12', 'letters-only-value-here'], 'soft 3: a field named "key" with a long letters-and-digits value is hidden; words stay');
// Hypha HOLD 2 on #369: only a real key shape in a plain "key" field is hidden.
assert.deepStrictEqual(grid.map(function (g) { return g.key; }), ['grid-key-value-4444', 'theme', 'short12', 'letters-only-value-here'], 'HOLD 2: words and ids in a field named "key" stay');
assert.strictEqual(rf.backup.localStorage.fl_clay, CLAY, 'base64 clay comes back byte for byte');
assert.strictEqual(rf.backup.localStorage.fl_fp, fieldFile.localStorage.fl_fp, 'hashes and long words come back as they are');
// before (6b5c4046): assert.deepStrictEqual([rf.backup.indexedDB[0].stores.meta[0].key, rf.backup.indexedDB[0].stores.notes[0].key], ['lastSync2024abc', 'abc123def456ghi789'], 'when the id field is not known, "id" and "key" are both kept as ids');
// before (6b5c4046): const rk = call('redact', 'STUB', [fieldFile, [], { FreeLatticeDB: { meta: 'key', notes: 'id' } }]);
// before (6b5c4046): assert.deepStrictEqual([rk.backup.indexedDB[0].stores.meta[0].key, rk.backup.indexedDB[0].stores.notes[0].key, rk.backup.indexedDB[0].stores.notes[0].id], ['lastSync2024abc', '[kept on this device]', 'n1'],
// before (6b5c4046):   'with the store\u2019s id field known, only that field is kept as an id');
const MIXED20 = 'Gk7pQ2xLm9Rt4Vw8Yz3B';
const kf = JSON.parse(JSON.stringify(fieldFile)); kf.indexedDB[0].stores.meta[0].key = MIXED20; kf.indexedDB[0].stores.notes[0].key = MIXED20;
const rk0 = call('redact', 'STUB', [kf, []]);
assert.deepStrictEqual([rk0.ok, rk0.backup.indexedDB[0].stores.notes[0].key], [true, MIXED20], 'when the id field is not known, "id" and "key" are both kept as ids');
const rk = call('redact', 'STUB', [kf, [], { FreeLatticeDB: { meta: 'key', notes: 'id' } }]);
assert.deepStrictEqual([rk.backup.indexedDB[0].stores.meta[0].key, rk.backup.indexedDB[0].stores.notes[0].key, rk.backup.indexedDB[0].stores.notes[0].id], [MIXED20, '[kept on this device]', 'n1'],
  'with the store\u2019s id field known, only that field is kept as an id, and a real key shape in "key" is hidden');
assert.deepStrictEqual(call('redact', 'STUB', [{ _meta: { type: 'freelattice-backup' }, localStorage: {}, indexedDB: [{ name: 'D', stores: { s: [{ id: 'x', key: MIXED20.slice(0, 19) }] } }] }, [], { D: { s: 'id' } }]).backup.indexedDB[0].stores.s[0].key,
  MIXED20.slice(0, 19), 'HOLD 2: under 20 characters is not a key shape');
// Hypha's eight innocents, plus share-door receipt keys, survive a restore on a new device.
const INNOCENT = ['2024-11-21T10:00:00Z', 'chat_2024_11_21', 'clay-7f3a9b2c-tile', 'sha256:' + SHA, '3f9a2c7e-41b8-4d2e-9a6f-0b1c2d3e4f50', '\u03c8-3f9a2c7e41b8-0007', 'rowkey-000123', 'sort.2024.11',
  SHA.slice(0, 32), SHA.slice(0, 32).toUpperCase(), 'abc123def456ghi789', 'Session_2024_11_21_Morning_Notes'.replace(/_/g, '-')];
const innFile = { _meta: { type: 'freelattice-backup', keys_kept_home: true },
  localStorage: { fl_share_door_receipts: JSON.stringify([{ key: SHA.slice(0, 32), count: 3 }, { key: SHA.slice(32), count: 1 }]), fl_grid: JSON.stringify(INNOCENT.map(function (v) { return { key: v }; })) },
  indexedDB: [{ name: 'FreeLatticeDB', stores: { notes: INNOCENT.map(function (v, i) { return { id: 'n' + i, key: v }; }) } }] };
[undefined, { FreeLatticeDB: { notes: 'id' } }].forEach(function (kp) {
  const ri = call('redact', 'STUB', kp ? [innFile, [], kp] : [innFile, []]);
  assert.strictEqual(ri.ok, true, 'HOLD 2: innocents are allowed');
  const fresh2 = JSON.parse(inside('JSON.stringify(FLBackupKeysHome._internal.mergeBackup(JSON.parse(' + JSON.stringify(JSON.stringify(ri.backup)) + '), { ls: {}, records: {} }).backup)'));
  assert.deepStrictEqual(JSON.parse(fresh2.localStorage.fl_grid).map(function (g) { return g.key; }), INNOCENT, 'HOLD 2: every innocent in a settings "key" field comes back on a new device');
  assert.deepStrictEqual(fresh2.indexedDB[0].stores.notes.map(function (g) { return g.key; }), INNOCENT, 'HOLD 2: every innocent in a record "key" field comes back on a new device');
  assert.strictEqual(fresh2.localStorage.fl_share_door_receipts, innFile.localStorage.fl_share_door_receipts, 'HOLD 2: share-door receipt keys (public-key hashes) come back as they are');
});
INNOCENT.forEach(function (v) { assert.strictEqual(inside('String(FLBackupKeysHome._internal.plainKeyField("key", ' + JSON.stringify(v) + '))'), 'false', 'not a key: ' + v); });
// Each rule on its own: values that only one rule keeps.
[['DeadBeef0123456789AbCdEf', 'mixed-case hex'], ['2024-11-21_SessionAbcDef123456789', 'a time at the start'], ['v2.Ab3dEf6hIj9lMn2pQr', 'a dot'], ['ns:Ab3dEf6hIj9lMn2pQr5', 'a colon'],
  ['\u03c8-Ab3dEf6hIj9lMn2pQr5', 'a psi'], ['rowkey000123abcdefghijk', 'no capitals'], ['CamelCaseWordsOnlyHere', 'no digits'], ['Session-2024-11-21-Morning-Notes', 'no 16-run']].forEach(function (pair) {
  assert.strictEqual(inside('String(FLBackupKeysHome._internal.plainKeyField("key", ' + JSON.stringify(pair[0]) + '))'), 'false', 'HOLD 2: kept, because of ' + pair[1] + ': ' + pair[0]);
});
assert.strictEqual(inside('String(FLBackupKeysHome._internal.plainKeyField("key", ' + JSON.stringify(MIXED20) + '))'), 'true', 'a real key shape in "key" is still hidden');
// The file's own check is the last guard: what the walk cannot reach (deeper than 64 levels) refuses, and is named.
let deep = { k: 'pasted ' + FOREIGN.k2 }; for (let i = 0; i < 70; i++) deep = { a: deep };
const rd2 = call('redact', 'STUB', [{ _meta: { type: 'freelattice-backup' }, localStorage: { fl_deep: JSON.stringify(deep) } }, []]);
assert.deepStrictEqual([rd2.ok, rd2.problems.indexOf('a key-shaped value is still in the file') !== -1], [false, true], 'the file check refuses a key the walk could not reach');
assert.deepStrictEqual(rd2.places, ['your settings \u203a fl_deep \u203a a \u203a \u2026 \u203a a \u203a k'], 'and names the place, shortly');
// Hypha soft on #369: a value that reads as a key only with its field name is hidden where it is, or named.
const ck = call('redact', 'STUB', [{ _meta: { type: 'freelattice-backup' }, localStorage: {}, indexedDB: [{ name: 'FreeLatticeDB', stores: { cache: [{ id: 'r1', cache_key: a(36), size: 4 }] } }] }, []]);
assert.deepStrictEqual([ck.ok, ck.backup.indexedDB[0].stores.cache[0].cache_key, ck.backup.indexedDB[0].stores.cache[0].size], [true, '[kept on this device]', 4], 'a cache_key-style value is hidden where it is, so the save is not refused blindly');
const ck2 = call('redact', 'STUB', [{ _meta: { type: 'freelattice-backup' }, localStorage: {}, indexedDB: [{ name: 'FreeLatticeDB', stores: { cache: [{ cache_key: a(36), size: 4 }] } }] }, [], { FreeLatticeDB: { cache: 'cache_key' } }]);
assert.deepStrictEqual([ck2.ok, ck2.places], [false, ['FreeLatticeDB \u203a cache \u203a item 1 (a key used as a record id)']], 'as a record id it refuses and names the place');
assert.deepStrictEqual(JSON.parse(inside('JSON.stringify(FLBackupKeysHome._internal.leftPlaces({ fl_x: JSON.stringify({ cache_key: ' + JSON.stringify(a(36)) + ', ok: "fine" }), fl_y: "plain" }, ["your settings"], [], 0))')),
  ['your settings \u203a fl_x \u203a cache_key'], 'anything left shaped like a key is named by place');
// Hypha soft on #369: the refusal says what happened and what a person can do in the app.
const rw = inside('FLBackupKeysHome._internal.refusalWords({ problems: ["a key is used as a record id"], places: ["FreeLatticeDB \u203a chats \u203a item 1 (a key used as a record id)"] })');
assert.ok(/^nothing was saved, so no key left this device\. A key is used as the id of a record, and leaving it out would break that record\. It is in: FreeLatticeDB \u203a chats \u203a item 1/.test(rw) &&
  /Nothing on this device was changed\. You can delete that item in the app \(or the chat or note it belongs to\) and save again, or keep your last backup for now\./.test(rw), 'the record-id refusal is plain and possible: ' + rw);
assert.ok(/A key is used as the name of a field/.test(inside('FLBackupKeysHome._internal.refusalWords({ problems: ["a key is used as a name"], places: ["your settings"] })')), 'the name refusal is plain too');
assert.ok(/Please reload the page once/.test(inside('FLBackupKeysHome._internal.refusalWords({ problems: ["a saved key is still in the file"], places: [] })')), 'with no place, it says what to try');
assert.deepStrictEqual(JSON.parse(inside('JSON.stringify(["a.b",["x","y.z"],null,undefined].map(function (kp, i) { var m = { D: {} }; if (i < 3) m.D.s = kp; return FLBackupKeysHome._internal.idFields(i < 3 ? m : null, "D", "s"); }))')),
  [['a'], ['x', 'y'], [], ['id', 'key']], 'id fields follow the store\u2019s keyPath');
// Soft 2: a key used as a record id refuses the file, names the place, and never collapses records.
const idFile = { _meta: { type: 'freelattice-backup' }, localStorage: { fl_theme: 'dusk' },
  indexedDB: [{ name: 'FreeLatticeDB', version: 1, stores: { notes: [{ id: 'sk-' + a(30), text: 'row one' }, { id: 'sk-' + a(31), text: 'row two' }, { id: 'n3', text: 'fine' }] } }] };
const ri = call('redact', 'STUB', [idFile, []]);
assert.strictEqual(ri.ok, false, 'soft 2: a key used as a record id refuses the file');
assert.strictEqual(ri.problems[0], 'a key is used as a record id', 'and says why');
assert.deepStrictEqual(ri.places.slice(0, 2), ['FreeLatticeDB \u203a notes \u203a item 1 (a key used as a record id)', 'FreeLatticeDB \u203a notes \u203a item 2 (a key used as a record id)'], 'and names each place');
assert.ok(JSON.stringify(ri.places).indexOf('sk-') === -1, 'without showing the key');
assert.deepStrictEqual(ri.backup.indexedDB[0].stores.notes.map(function (x) { return x.id; }), ['sk-' + a(30), 'sk-' + a(31), 'n3'], 'ids are never rewritten, so two records never become one');
const ri2 = call('redact', 'STUB', [{ _meta: { type: 'freelattice-backup' }, localStorage: {}, indexedDB: [{ name: 'D', stores: { m: [{ key: M32, v: 1 }] } }] }, []]);
assert.deepStrictEqual([ri2.ok, ri2.places], [false, ['D \u203a m \u203a item 1 (a key used as a record id)']], 'a long mixed id under "key" is named as well');
// Soft 5: every rule from the pack module is checked, one at a time, and the placeholder words too.
const NEEDED = ['isSecretName', 'huntable', 'hideSecretLeaves', 'secretFieldValue', 'containsSecret', 'countSecretFields'];
assert.deepStrictEqual(JSON.parse(inside('JSON.stringify(FLBackupKeysHome._internal.KIT_FUNCTIONS)')), NEEDED, 'every rule the module uses is on its check list');
NEEDED.forEach(function (f) {
  inside('FLGardenMoveKit = { _internal: Object.assign({}, STUB, { ' + f + ': undefined }) }; ""');
  assert.strictEqual(inside('String(FLBackupKeysHome._internal.kitRules())'), 'null', 'a pack module without ' + f + ' is refused');
});
inside('FLGardenMoveKit = { _internal: Object.assign({}, STUB, { KEPT_LINE: "[x]" }) }; ""');
assert.strictEqual(inside('String(FLBackupKeysHome._internal.kitRules())'), 'null', 'a pack module with other placeholder words is refused');
inside('FLGardenMoveKit = { _internal: STUB }; ""');
assert.strictEqual(inside('String(FLBackupKeysHome._internal.kitRules() === STUB)'), 'true', 'and the full rules are used again');
inside('delete FLGardenMoveKit; ""');

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
// before (6b5c4046): assert.ok(/if \(!r\.ok\) throw new Error\('a saved key could not be taken out, so nothing was saved/.test(code), 'no file is made when the check fails');
assert.ok(/if \(!r\.ok\) throw new Error\(refusalWords\(r\)\);/.test(code) && !/could not be taken out|Rename or remove it there/.test(code), 'no file is made when the check fails, and the words are plain');
assert.ok(/Save Vault could not load its key check, so nothing was saved\. Please reload the page once and try again\./.test(code) && /lastExport = \{ ok: false, problems: \['key check not loaded'\] \};\s*return;\s*\}/.test(code), 'no file is made without the rules, in plain words');
// before (ef550fbf): assert.ok(/It is written as a name in: ' \+ r\.places\.join\('; '\)/.test(code), 'a refusal says where');
// before (6b5c4046): assert.ok(/It is written where it cannot be hidden: ' \+ r\.places\.join\('; '\)/.test(code), 'a refusal says where');
assert.ok(/var where = r\.places && r\.places\.length \? ' It is in: ' \+ r\.places\.join\('; '\) \+ '\.' : '';/.test(code), 'a refusal says where');
assert.ok(!/never go in the file/.test(code) && /pasted keys in the shapes Save Vault knows/.test(code) && /may not be recognised, so look before you share the file/.test(code), 'soft 4: the words say what is covered, not "never"');
// before (6b5c4046): assert.ok(/return readKeyPaths\(\)\.then\(function \(keyPaths\) \{ return saveWith\(K, keyPaths\); \}\);/.test(code) && /var r = redact\(parsed, K, secrets, keyPaths\);/.test(code), 'soft 2: the save reads each store\u2019s id field first');
assert.ok(/return readKeyPaths\(\)\.then\(function \(kp\) \{ busyDbs = kp\.busy; return saveWith\(K, kp\.paths\); \}\);/.test(code) && /var r = redact\(parsed, K, secrets, keyPaths\);/.test(code), 'soft 2: the save reads each store\u2019s id field first');
assert.ok(/st0\.textContent = 'Save Vault is checking your records before saving\\u2026';/.test(code) && /busy \(perhaps open in another tab\), so record ids there were kept the safe way\./.test(code) && /\(busyDbs \? ' ' \+ plural\(busyDbs, /.test(code), 'HOLD 1: the save is never silent: it says it is checking, and says when a database was busy');
assert.ok(/box\.setAttribute\('role', 'status'\);\s*box\.setAttribute\('aria-live', 'polite'\);/.test(code) && /p\.setAttribute\('role', 'status'\);/.test(code), 'the note is announced');
assert.ok(/else root\.document\.body\.insertBefore\(box, root\.document\.body\.firstChild\);/.test(code), 'the card comes early in the focus order');
// before (6b5c4046): assert.ok(!/onupgradeneeded|createObjectStore/.test(code) && /typeof idb\.databases !== 'function'\) return Promise\.resolve\(device\);/.test(code) && /here\.indexOf\(db\.name\) !== -1/.test(code), 'reading this device never creates a database');
const busyFile = { _meta: { type: 'freelattice-backup', keys_kept_home: true }, localStorage: {},
  indexedDB: [{ name: 'FreeLatticeCore', stores: { settings: [{ id: 'k1', config: { apiKey: P, telegram: P } }] } }] };
// before (f0823316): assert.ok(!/createObjectStore|deleteObjectStore/.test(code) && (code.match(/req\.onupgradeneeded = abortUpgrade\(req\);/g) || []).length === 2 && /typeof idb\.databases !== 'function'\) return Promise\.resolve\(device\);/.test(code) && /here\.indexOf\(db\.name\) !== -1/.test(code), 'reading this device never creates a database: an upgrade is aborted');
assert.ok(!/createObjectStore|deleteObjectStore/.test(code) && (code.match(/req\.onupgradeneeded = abortUpgrade\(req\);/g) || []).length === 1 &&
  /req\.onupgradeneeded = function \(\) \{ notHere = true; abortUpgrade\(req\)\(\); \};/.test(code) && /return !here \|\| here\.indexOf\(db\.name\) !== -1;/.test(code), 'reading this device never creates a database: an upgrade is aborted');
// before (dec6128a): assert.ok(/readDevice\(parsed, function \(\) \{ addLine\('Waiting for another FreeLattice tab to let go\\u2026 Your restore will go on by itself\.'\); \}\)/.test(code) &&
// before (dec6128a):   /Nothing was restored, and nothing on this device was changed: ' \+ stopped \+/.test(code) && /Close other FreeLattice tabs and try again\./.test(code), 'NEW HOLD: the wait is announced, and a stop says plainly that nothing was changed');
assert.ok(/readDevice\(parsed, function \(\) \{ waitLine\(addLine\('Waiting for another FreeLattice tab to let go\\u2026 Your restore will go on by itself\.'\), cancelNow\); \}, ctl\)/.test(code) &&
  /Nothing was restored, and nothing on this device was changed: ' \+ stopped \+/.test(code) && /Close other FreeLattice tabs and try again\./.test(code), 'NEW HOLD: the wait is announced, and a stop says plainly that nothing was changed');
assert.ok(/if \(!st\.getAttribute\('role'\)\) st\.setAttribute\('role', 'status'\);/.test(code) && /if \(!st\.getAttribute\('aria-live'\)\) st\.setAttribute\('aria-live', 'polite'\);/.test(code) &&
  (code.match(/announceStatus\(\);/g) || []).length >= 3, 'soft: Save Vault\u2019s own status line is announced');
assert.ok(/if \(!m \|\| !m\.stats\.kept \|\| typeof root\.File !== 'function'\) return inner\.call\(self, fileInput\);/.test(code) && /return inner\.call\(self, \{ files: \[f\], value: '' \}\);/.test(code), 'restore is FlBackup\u2019s own, given a copy that keeps this device\u2019s keys');
assert.ok(/return inner\.call\(self, fileInput\);/.test(code) && !/fileInput\.files\[0\] =|backup\.localStorage\[[^\]]+\] =/.test(code), 'restore is passed through untouched when nothing here needs keeping');
assert.ok(/if \(installed\) return true;/.test(code) && /safe\.__flKeysHome = VERSION;/.test(code), 'it wraps once');
assert.ok(/position:fixed;left:12px;right:12px;bottom:16px;/.test(code) && /else root\.document\.body\.insertBefore\(box, root\.document\.body\.firstChild\);/.test(code), 'after the reload the note is in sight, not buried in Settings');
assert.ok(/'Save a safe backup now'/.test(code) && /'Not now'/.test(code), 'it gently offers to save safely');
assert.ok(/so anyone holding that file could read them\. Everything was restored and works as before\./.test(code), 'it says plainly what the old file carried');
assert.ok(/s\.src = 'modules\/garden-move-kit\.js';/.test(code) && /root\.FLGardenMoveKit && root\.FLGardenMoveKit\._internal/.test(code), 'it uses the pack module\u2019s rules');
assert.ok(/s\.src = 'modules\/backup-keys-home\.js';/.test(cer) && /function hookFlBackup\(\) \{\s*if \(typeof FlBackup === 'undefined'\) return;/.test(cer) && /hookFlBackup\(\);/.test(cer), 'soul-ceremony loads it and keeps its own hook');
// before (6b5c4046): // before (dec6128a): ['## What', '## Why', '## Rollback', '## Smoke', 'v-backup-keys-home', 'keys_kept_home', 'fl_backup_keys_note', 'never overwrites a real value', '### Not covered yet', 'MemoryIndex vault export', '### Follow-up', '### Softs after #368', 'Record ids are never rewritten', 'not caught, on purpose', '### Heal after #369', 'about 1.5 seconds', '### Heal after #369 at f0823316', 'has no time limit', 'the restore stops before anything is written', 'Close other FreeLattice tabs and try again', 'The kept count is the truth', 'only capitals and digits'].forEach(function (s) { assert.ok(note.indexOf(s) !== -1, 'note has ' + s); });
['## What', '## Why', '## Rollback', '## Smoke', 'v-backup-keys-home', 'keys_kept_home', 'fl_backup_keys_note', 'never overwrites a real value', '### Not covered yet', 'MemoryIndex vault export', '### Follow-up', '### Softs after #368', 'Record ids are never rewritten', 'not caught, on purpose'].forEach(function (s) { assert.ok(note.indexOf(s) !== -1, 'note has ' + s); });
// before (f0823316): ['## What', '## Why', '## Rollback', '## Smoke', 'v-backup-keys-home', 'keys_kept_home', 'fl_backup_keys_note', 'never overwrites a real value', '### Not covered yet', 'MemoryIndex vault export', '### Follow-up', '### Softs after #368', 'Record ids are never rewritten', 'not caught, on purpose', '### Heal after #369', 'about 1.5 seconds'].forEach(function (s) { assert.ok(note.indexOf(s) !== -1, 'note has ' + s); });
['## What', '## Why', '## Rollback', '## Smoke', 'v-backup-keys-home', 'keys_kept_home', 'fl_backup_keys_note', 'never overwrites a real value', '### Not covered yet', 'MemoryIndex vault export', '### Follow-up', '### Softs after #368', 'Record ids are never rewritten', 'not caught, on purpose', '### Heal after #369', 'about 1.5 seconds', '### Heal after #369 at f0823316', 'has no time limit', 'the restore stops before anything is written', 'Close other FreeLattice tabs and try again', 'The kept count is the truth', 'only capitals and digits', '### New-device restore, and the restore softs (after #369)', 'the app\u2019s own `openDB()` opens it first'.replace('\u2019', "'"), 'Cancel button', 'One restore at a time'].forEach(function (s) { assert.ok(note.indexOf(s) !== -1, 'note has ' + s); });

// The checks below were reworded by the heal; the earlier wording is kept here.
// before (649d5cce): assert.ok(/Save Vault is waiting for its key check to load\. Nothing was saved\./.test(code) && /lastExport = \{ ok: false, problems: \['key check not loaded'\] \};\s*return;\s*\}/.test(code), 'no file is made without the rules');
// before (649d5cce): assert.ok(/return inner\.call\(self, fileInput\);/.test(code) && !/fileInput\.files\[0\] =|backup\.localStorage\[[^\]]+\] =/.test(code), 'restore is passed through untouched');
// before (649d5cce): assert.ok(/position:fixed;left:12px;right:12px;bottom:16px;/.test(code) && /else root\.document\.body\.appendChild\(box\);/.test(code), 'after the reload the note is in sight, not buried in Settings');
// before (ef550fbf): ['## What', '## Why', '## Rollback', '## Smoke', 'v-backup-keys-home', 'keys_kept_home', 'fl_backup_keys_note', 'never overwrites a real value', '### Not covered yet', 'MemoryIndex vault export', '### Follow-up'].forEach(function (s) { assert.ok(note.indexOf(s) !== -1, 'note has ' + s); });
// before (ef550fbf): console.log('SMOKE_OK backup keys home');   (now printed after the device-read checks below)
// before (649d5cce): ['## What', '## Why', '## Rollback', '## Smoke', 'v-backup-keys-home', 'keys_kept_home', 'fl_backup_keys_note'].forEach(function (s) { assert.ok(note.indexOf(s) !== -1, 'note has ' + s); });
// 6. Reading this device (a stand-in database written inside the vm): records are read, never created.
vm.runInContext(`
  function FakeIDB(dbs) {
    var log = [];
    function later(f) { Promise.resolve().then(f); }
    return { log: log,
      databases: function () { return Promise.resolve(Object.keys(dbs).map(function (n) { return { name: n, version: 1 }; })); },
      open: function (name) {
        log.push({ open: name, args: arguments.length });
        var r = {};
        var d0 = dbs[name];
        if (d0 && d0.stuck) return r;
        if (d0 && d0.slow) { d0.release = function () { r.result = { objectStoreNames: Object.assign([], { contains: function () { return false; } }), close: function () { log.push({ close: name }); } }; if (r.onsuccess) r.onsuccess(); }; return r; }
        // before (f0823316): if (d0 && d0.ghost) {
        if (!d0 || d0.ghost) {
          later(function () { var aborted = false; r.transaction = { abort: function () { aborted = true; log.push({ abort: name }); } };
            if (r.onupgradeneeded) r.onupgradeneeded({}); if (!aborted) log.push({ created: name }); if (r.onerror) r.onerror({ preventDefault: function () {} }); });
          return r;
        }
          // before (f0823316): if (!dbs[name] || arguments.length > 1) { if (r.onerror) r.onerror(); return; }
        if (d0 && d0.throws) throw new Error('blocked');
        if (d0 && d0.error) { later(function () { if (r.onerror) r.onerror({ preventDefault: function () { log.push({ prevented: name }); } }); }); return r; }
        var run = function () {
          if (!dbs[name]) { if (r.onerror) r.onerror(); return; }
          var d = dbs[name], names = Object.keys(d.stores);
          // before (f0823316): names.contains = function (s) { return !!d.stores[s]; };
          names.contains = function (s) { if (d.badcon) throw new Error('a broken connection'); return !!d.stores[s]; };
          r.result = { objectStoreNames: names, close: function () { log.push({ close: name }); },
            transaction: function (list, mode) {
              log.push({ tx: name, mode: mode });
              // before (f0823316): var tx = { pending: 0, fired: false, done: function () { if (!tx.pending && !tx.fired) { tx.fired = true; later(function () { if (tx.oncomplete) tx.oncomplete(); }); } },
              if (d.txfail) throw new Error('cannot read now');
              if (d.txabort) later(function () { if (TXA && TXA.onabort) TXA.onabort(); });
              var tx = TXA = { pending: 0, fired: !!d.txabort, done: function () { if (!tx.pending && !tx.fired) { tx.fired = true; later(function () { if (tx.oncomplete) tx.oncomplete(); }); } },
                objectStore: function (s) { var S = d.stores[s]; return { keyPath: S.keyPath, get: function (k) { var g = {}; tx.pending += 1;
                  later(function () { g.result = S.rows.filter(function (x) { return x[S.keyPath] === k; })[0]; if (g.onsuccess) g.onsuccess(); tx.pending -= 1; tx.done(); }); return g; } }; } };
              later(function () { later(function () { tx.done(); }); });
              return tx; } };
          if (r.onsuccess) r.onsuccess();
        };
        if (d0 && d0.slowFull) { d0.release = function () { later(run); }; return r; }
        later(run);
        return r;
      } };
  }
  localStorage = { getItem: function (k) { return k === 'fl_customAuth' ? 'Bearer real-token-777' : null; } };
  indexedDB = FakeIDB({ FreeLatticeCore: { stores: { settings: { keyPath: 'id', rows: [{ id: 'k1', config: { apiKey: 'real-core-key' } }, { id: 'k9', other: 1 }] }, meta: { keyPath: 'key', rows: [] } } } });
  RD = null; KP = null;
  TIMERS = [];
  setTimeout = function (f, ms) { TIMERS.push({ f: f, ms: ms, live: true }); return TIMERS.length - 1; };
  clearTimeout = function (i) { if (TIMERS[i]) TIMERS[i].live = false; };
  runTimers = function () { var n = 0; TIMERS.forEach(function (t) { if (t.live) { t.live = false; n += 1; t.f(); } }); return n; };
`, ctx, { timeout: 2000 });
const devFile = { _meta: { type: 'freelattice-backup', keys_kept_home: true }, localStorage: { fl_customAuth: 'Bearer ' + P, fl_theme: 'dusk' },
  indexedDB: [{ name: 'FreeLatticeCore', stores: { settings: [{ id: 'k1', config: { apiKey: P } }, { id: 'k2', note: 'no placeholder' }] } }, { name: 'NotOnThisDevice', stores: { s: [{ id: 'z', t: P }] } }] };
inside('FLBackupKeysHome._internal.readDevice(JSON.parse(' + JSON.stringify(JSON.stringify(devFile)) + ')).then(function (d) { RD = JSON.stringify(d); }); FLBackupKeysHome._internal.readKeyPaths().then(function (k) { KP = JSON.stringify(k); }); ""');
function flush(n) { return n ? new Promise(function (res) { setImmediate(res); }).then(function () { return flush(n - 1); }) : Promise.resolve(); }
flush(20).then(function () {
  const rd = JSON.parse(inside('String(RD)'));
  assert.deepStrictEqual(rd.ls, { fl_customAuth: 'Bearer real-token-777' }, 'only settings holding the placeholder are read from this device');
  assert.deepStrictEqual(rd.records, { FreeLatticeCore: { settings: [{ id: 'k1', config: { apiKey: 'real-core-key' } }, null] } }, 'this device\u2019s records are read for the rows that hold the placeholder');
  const log = JSON.parse(inside('JSON.stringify(indexedDB.log)'));
  const opens = log.filter(function (x) { return x.open; });
  assert.ok(opens.length >= 2 && opens.every(function (x) { return x.args === 1 && x.open === 'FreeLatticeCore'; }), 'databases are opened with no version and only when this device has them: ' + JSON.stringify(opens));
  assert.ok(log.filter(function (x) { return x.tx; }).every(function (x) { return x.mode === 'readonly'; }), 'and read only');
  assert.strictEqual(log.filter(function (x) { return x.open; }).length, log.filter(function (x) { return x.close; }).length, 'every database opened is closed');
  // before (6b5c4046): assert.deepStrictEqual(JSON.parse(inside('String(KP)')), { FreeLatticeCore: { settings: 'id', meta: 'key' } }, 'soft 2: each store\u2019s id field is read from this device');
  assert.deepStrictEqual(JSON.parse(inside('String(KP)')), { paths: { FreeLatticeCore: { settings: 'id', meta: 'key' } }, busy: 0 }, 'soft 2: each store\u2019s id field is read from this device');
  const merged = JSON.parse(inside('JSON.stringify(FLBackupKeysHome._internal.mergeBackup(JSON.parse(' + JSON.stringify(JSON.stringify(devFile)) + '), JSON.parse(RD)))'));
  assert.deepStrictEqual([merged.backup.localStorage.fl_customAuth, merged.backup.indexedDB[0].stores.settings[0].config.apiKey, merged.stats], ['Bearer real-token-777', 'real-core-key', { kept: 2, left: 1 }], 'what was read is what is kept');
  // HOLD 1 on #369: a database held by another tab never makes the save wait forever, only FreeLattice
  // databases are opened, and a database that is gone is never made again.
  inside('indexedDB = FakeIDB({ FreeLatticeCore: { stores: { settings: { keyPath: "id", rows: [] } } }, FreeLatticeStuck: { stuck: true }, FreeLatticeSlow: { slow: true }, StuckDB: { stuck: true }, FreeLatticeGone: { ghost: true } }); KP = null; RD = null; TIMERS = []; ""');
  inside('FLBackupKeysHome._internal.readKeyPaths().then(function (k) { KP = JSON.stringify(k); }); ""');
  return flush(20);
}).then(function () {
  assert.strictEqual(inside('String(KP)'), 'null', 'while a database is held, the read waits (for a moment only)');
  const waits = JSON.parse(inside('JSON.stringify(TIMERS.filter(function (t) { return t.live; }).map(function (t) { return t.ms; }))'));
  assert.ok(waits.length === 2 && waits.every(function (ms) { return ms === 1500; }), 'HOLD 1: each open waits about 1.5 seconds at most: ' + JSON.stringify(waits));
  inside('runTimers(); ""');
  return flush(20);
}).then(function () {
  assert.deepStrictEqual(JSON.parse(inside('String(KP)')), { paths: { FreeLatticeCore: { settings: 'id' } }, busy: 2 }, 'HOLD 1: after the wait the save goes on, with "id"/"key" for the busy databases, and says how many were busy');
  const log = JSON.parse(inside('JSON.stringify(indexedDB.log)'));
  assert.ok(!log.some(function (x) { return x.open === 'StuckDB'; }), 'HOLD 1: a database Save Vault does not save is never opened');
  assert.ok(log.some(function (x) { return x.abort === 'FreeLatticeGone'; }) && !log.some(function (x) { return x.created; }), 'soft: a database that is gone is never made again (its upgrade is aborted)');
  assert.ok(log.filter(function (x) { return x.open; }).every(function (x) { return x.args === 1; }), 'every open has no version');
// before (f0823316):   // The read on restore follows the same rules.
// before (f0823316):   const stuckFile = { _meta: { type: 'freelattice-backup', keys_kept_home: true }, localStorage: {}, indexedDB: [{ name: 'FreeLatticeStuck', stores: { s: [{ id: 'z', t: P }] } }] };
// before (f0823316):   inside('TIMERS = []; FLBackupKeysHome._internal.readDevice(JSON.parse(' + JSON.stringify(JSON.stringify(stuckFile)) + ')).then(function (d) { RD = JSON.stringify(d); }); ""');
// before (f0823316):   return flush(20).then(function () {
// before (f0823316):     assert.strictEqual(inside('String(RD)'), 'null', 'the restore read waits for a moment too');
// before (f0823316):     inside('runTimers(); ""');
// before (f0823316):     return flush(20);
// before (f0823316):   }).then(function () {
// before (f0823316):     assert.deepStrictEqual(JSON.parse(inside('String(RD)')), { ls: {}, records: {} }, 'HOLD 1: on restore a busy database is left as the file has it, and the restore goes on');
// before (f0823316):   });
  // Hypha HOLD on #369 at f0823316: on restore a busy database is waited for, never given up on.
  inside('BUSY = { FreeLatticeCore: { slowFull: true, stores: { settings: { keyPath: "id", rows: [{ id: "k1", config: { apiKey: "core-api-key-abcdef12", telegram: "tg-real-1" } }] } } } }; indexedDB = FakeIDB(BUSY); TIMERS = []; RD = null; WAITED = 0; ""');
  inside('FLBackupKeysHome._internal.readDevice(JSON.parse(' + JSON.stringify(JSON.stringify(busyFile)) + '), function () { WAITED += 1; }).then(function (d) { RD = JSON.stringify(d); }); ""');
  return flush(20).then(function () {
    assert.strictEqual(inside('String(RD)'), 'null', 'the restore read waits while another tab holds the database');
    inside('runTimers(); ""');
    return flush(20);
  }).then(function () {
    assert.strictEqual(inside('String(RD)'), 'null', 'NEW HOLD: after the wait it still does not give up (no time limit on restore)');
    assert.strictEqual(inside('String(WAITED)'), '1', 'and it says once that it is waiting for another tab');
    inside('BUSY.FreeLatticeCore.release(); ""');
    return flush(20);
  }).then(function () {
    const rdb = JSON.parse(inside('String(RD)'));
    assert.deepStrictEqual([rdb.failed, rdb.records.FreeLatticeCore.settings[0].config], [null, { apiKey: 'core-api-key-abcdef12', telegram: 'tg-real-1' }], 'once the other tab lets go, this device\u2019s keys are read');
    const mb2 = JSON.parse(inside('JSON.stringify(FLBackupKeysHome._internal.mergeBackup(JSON.parse(' + JSON.stringify(JSON.stringify(busyFile)) + '), JSON.parse(RD)))'));
    assert.deepStrictEqual([mb2.backup.indexedDB[0].stores.settings[0].config, mb2.stats], [{ apiKey: 'core-api-key-abcdef12', telegram: 'tg-real-1' }, { kept: 2, left: 0 }], 'and kept: the placeholder never replaces them');
    assert.ok(JSON.parse(inside('JSON.stringify(indexedDB.log)')).some(function (x) { return x.close === 'FreeLatticeCore'; }), 'the connection is closed');
  });
}).then(function () {
  // The whole restore, through the wrap, with a stand-in FlBackup restore: a busy database is waited for and
  // the keys are kept; an unreadable one stops the restore before anything is written.
  vm.runInContext(`
    TXA = null;
    // before (dec6128a): STATUS = { textContent: '', a: {}, lines: [], getAttribute: function (k) { return this.a[k] || null; }, setAttribute: function (k, v) { this.a[k] = v; }, appendChild: function (n) { this.lines.push(n.textContent); } };
    STATUS = { textContent: '', a: {}, lines: [], nodes: [], getAttribute: function (k) { return this.a[k] || null; }, setAttribute: function (k, v) { this.a[k] = v; }, appendChild: function (n) { this.lines.push(n.textContent); this.nodes.push(n); } };
    // before (dec6128a): FAKEDOC = { getElementById: function (id) { return id === 'flBackupStatus' ? STATUS : null; }, createElement: function () { return { style: {}, setAttribute: function () {} }; } };
    BUTTONS = [];
    FAKEDOC = { getElementById: function (id) { return id === 'flBackupStatus' ? STATUS : null; }, createElement: function (tag) { var n = { tag: tag, style: {}, kids: [], setAttribute: function () {}, appendChild: function (k) { this.kids.push(k); } }; if (tag === 'button') BUTTONS.push(n); return n; } };
    File = function (parts, name) { this.parts = parts; this.name = name; };
    FLGardenMoveKit = { _internal: STUB };
    INNER = [];
    RESTORE = FLBackupKeysHome._internal.wrapImport(function (input) { INNER.push(input && input.files && input.files[0] && input.files[0].parts ? JSON.parse(input.files[0].parts[0]) : 'original'); return Promise.resolve(); });
    function fileOf(obj) { var t = JSON.stringify(obj); return { files: [{ name: 'b.json', text: function () { return Promise.resolve(t); } }], value: 'b.json' }; }
  `, ctx, { timeout: 2000 });
  inside('BUSY = { FreeLatticeCore: { slowFull: true, stores: { settings: { keyPath: "id", rows: [{ id: "k1", config: { apiKey: "core-api-key-abcdef12", telegram: "tg-real-1" } }] } } } }; indexedDB = FakeIDB(BUSY); TIMERS = []; DONE = 0; ""');
  inside('RESTORE(fileOf(JSON.parse(' + JSON.stringify(JSON.stringify(busyFile)) + '))).then(function () { DONE += 1; }); ""');
  return flush(20).then(function () { inside('runTimers(); ""'); return flush(20); }).then(function () {
    assert.deepStrictEqual([inside('String(INNER.length)'), inside('String(DONE)')], ['0', '0'], 'NEW HOLD: nothing is written while the other tab holds the database');
    inside('BUSY.FreeLatticeCore.release(); ""');
    return flush(30);
  }).then(function () {
    const got = JSON.parse(inside('JSON.stringify(INNER)'));
    assert.strictEqual(got.length, 1, 'then FlBackup restores once');
    assert.deepStrictEqual(got[0].indexedDB[0].stores.settings[0].config, { apiKey: 'core-api-key-abcdef12', telegram: 'tg-real-1' }, 'NEW HOLD: a busy restore keeps this device\u2019s real keys');
    assert.deepStrictEqual(JSON.parse(inside('JSON.stringify(FLBackupKeysHome.lastRestore())')), { stopped: false, kept: 2 }, 'and the kept count is the truth');
    inside('indexedDB = FakeIDB({ FreeLatticeCore: { error: true } }); INNER = []; TIMERS = []; DONE = 0; ""');
    inside('RESTORE(fileOf(JSON.parse(' + JSON.stringify(JSON.stringify(busyFile)) + '))).then(function () { DONE += 1; }); ""');
    return flush(30);
  }).then(function () {
    assert.deepStrictEqual([inside('String(INNER.length)'), inside('String(DONE)')], ['0', '1'], 'NEW HOLD: when a database that holds placeholders cannot be opened, nothing is restored');
    const lr = JSON.parse(inside('JSON.stringify(FLBackupKeysHome.lastRestore())'));
    assert.deepStrictEqual(lr, { stopped: true, why: 'FreeLatticeCore could not be opened' }, 'and it says why');
    assert.ok(JSON.parse(inside('JSON.stringify(indexedDB.log)')).some(function (x) { return x.prevented === 'FreeLatticeCore'; }), 'the open error is handled (preventDefault)');
    inside('indexedDB = FakeIDB({ FreeLatticeCore: { txfail: true, stores: { settings: { keyPath: "id", rows: [] } } } }); INNER = []; TIMERS = []; DONE = 0; ""');
    inside('RESTORE(fileOf(JSON.parse(' + JSON.stringify(JSON.stringify(busyFile)) + '))).then(function () { DONE += 1; }); ""');
    return flush(30);
  }).then(function () {
    assert.deepStrictEqual([inside('String(INNER.length)'), inside('String(DONE)'), JSON.parse(inside('JSON.stringify(FLBackupKeysHome.lastRestore())')).why], ['0', '1', 'FreeLatticeCore could not be read'], 'NEW HOLD: when it cannot be read, nothing is restored either');
    const lg = JSON.parse(inside('JSON.stringify(indexedDB.log)'));
    assert.strictEqual(lg.filter(function (x) { return x.open; }).length, lg.filter(function (x) { return x.close; }).length, 'and the connection is closed');
    // A database that is not on this device: written as the file has it (a new device), never made by the read.
    inside('indexedDB = FakeIDB({}); indexedDB.databases = undefined; INNER = []; TIMERS = []; DONE = 0; ""');
    inside('RESTORE(fileOf(JSON.parse(' + JSON.stringify(JSON.stringify(busyFile)) + '))).then(function () { DONE += 1; }); ""');
    return flush(30);
  }).then(function () {
    assert.deepStrictEqual([inside('String(INNER.length)'), inside('JSON.stringify(FLBackupKeysHome.lastRestore())')], ['1', JSON.stringify({ stopped: false, kept: 0 })], 'a new device restores as before');
    // The page's own status line: the wait is announced there, and so is a stop.
    inside('document = FAKEDOC; STATUS.lines = []; STATUS.a = {}; BUSY = { FreeLatticeCore: { slowFull: true, stores: { settings: { keyPath: "id", rows: [{ id: "k1", config: { apiKey: "core-api-key-abcdef12", telegram: "tg-real-1" } }] } } } }; indexedDB = FakeIDB(BUSY); INNER = []; TIMERS = []; DONE = 0; ""');
    inside('RESTORE(fileOf(JSON.parse(' + JSON.stringify(JSON.stringify(busyFile)) + '))).then(function () { DONE += 1; }); ""');
    return flush(20);
  }).then(function () {
    inside('runTimers(); ""');
    return flush(20);
  }).then(function () {
    assert.deepStrictEqual(JSON.parse(inside('JSON.stringify([STATUS.a, STATUS.lines, INNER.length])')), [{ role: 'status', 'aria-live': 'polite' }, ['Waiting for another FreeLattice tab to let go\u2026 Your restore will go on by itself.'], 0], 'NEW HOLD: the wait is said on the announced status line');
    inside('BUSY.FreeLatticeCore.release(); ""');
    return flush(30);
  }).then(function () {
    assert.deepStrictEqual([inside('String(INNER.length)'), inside('String(DONE)')], ['1', '1'], 'and the restore goes on by itself');
    const stops = [
      [{ FreeLatticeCore: { throws: true } }, 'FreeLatticeCore could not be opened'],
      [{ FreeLatticeCore: { txabort: true, stores: { settings: { keyPath: 'id', rows: [{ id: 'k1', config: {} }] } } } }, 'FreeLatticeCore could not be read'],
      [{ FreeLatticeCore: { badcon: true, stores: { settings: { keyPath: 'id', rows: [] } } } }, 'FreeLatticeCore could not be read']
    ];
    let chain = Promise.resolve();
    stops.forEach(function (c) {
      chain = chain.then(function () {
        inside('indexedDB = FakeIDB(' + JSON.stringify(c[0]) + '); STATUS.textContent = ""; INNER = []; TIMERS = []; DONE = 0; ""');
        inside('RESTORE(fileOf(JSON.parse(' + JSON.stringify(JSON.stringify(busyFile)) + '))).then(function () { DONE += 1; }); ""');
        return flush(30);
      }).then(function () {
        assert.deepStrictEqual([inside('String(INNER.length)'), inside('String(DONE)'), JSON.parse(inside('JSON.stringify(FLBackupKeysHome.lastRestore())'))], ['0', '1', { stopped: true, why: c[1] }], 'NEW HOLD: stopped before any write: ' + c[1]);
        if (c[0].FreeLatticeCore.badcon) assert.ok(JSON.parse(inside('JSON.stringify(indexedDB.log)')).some(function (x) { return x.close === 'FreeLatticeCore'; }), 'R19: a broken connection is still closed');
        assert.strictEqual(inside('STATUS.textContent'), '\u274c Nothing was restored, and nothing on this device was changed: ' + c[1] + ', so the keys it already has could not be kept safe. Close other FreeLattice tabs and try again.', 'and the page says so plainly');
      });
    });
    return chain;
  }).then(function () {
    // If this device cannot be read at all, the restore stops too.
    inside('Object.defineProperty(globalThis, "indexedDB", { configurable: true, get: function () { throw new Error("no"); } }); INNER = []; DONE = 0; ""');
    inside('RESTORE(fileOf(JSON.parse(' + JSON.stringify(JSON.stringify(busyFile)) + '))).then(function () { DONE += 1; }); ""');
    return flush(30);
  }).then(function () {
    assert.deepStrictEqual([inside('String(INNER.length)'), inside('String(DONE)'), JSON.parse(inside('JSON.stringify(FLBackupKeysHome.lastRestore())')).why], ['0', '1', 'this device could not be read'], 'NEW HOLD: a device that cannot be read is never written over');
    inside('Object.defineProperty(globalThis, "indexedDB", { configurable: true, writable: true, value: FakeIDB({}) }); document = undefined; ""');
  }).then(function () {
    // R20: a quick read stops its wait timer, so no waiting line comes after it.
    inside('indexedDB = FakeIDB({ FreeLatticeCore: { stores: { settings: { keyPath: "id", rows: [{ id: "k1", config: { apiKey: "core-api-key-abcdef12" } }] } } } }); TIMERS = []; RD = null; WAITED = 0; ""');
    inside('FLBackupKeysHome._internal.readDevice(JSON.parse(' + JSON.stringify(JSON.stringify(busyFile)) + '), function () { WAITED += 1; }).then(function (d) { RD = JSON.stringify(d); }); ""');
    return flush(20);
  }).then(function () {
    inside('runTimers(); ""');
    assert.deepStrictEqual([inside('String(String(RD) !== "null")'), inside('String(WAITED)')], ['true', '0'], 'R20: a read that is done stops its wait timer');
    // R24: with no databases() list, a database that is here is still opened and read.
    inside('indexedDB = FakeIDB({ FreeLatticeCore: { stores: { settings: { keyPath: "id", rows: [{ id: "k1", config: { apiKey: "core-api-key-abcdef12", telegram: "tg-real-1" } }] } } } }); indexedDB.databases = undefined; TIMERS = []; RD = null; ""');
    inside('FLBackupKeysHome._internal.readDevice(JSON.parse(' + JSON.stringify(JSON.stringify(busyFile)) + ')).then(function (d) { RD = JSON.stringify(d); }); ""');
    return flush(20);
  }).then(function () {
    assert.deepStrictEqual(JSON.parse(inside('String(RD)')).records.FreeLatticeCore.settings[0].config, { apiKey: 'core-api-key-abcdef12', telegram: 'tg-real-1' }, 'R24: without a list of databases, this device is still read');
    // Softs on #369: the reading line shows at once (the old line goes), a second pick never queues a second
    // restore, and the waiting line can cancel.
    inside('document = FAKEDOC; STATUS.textContent = "\u2705 Exported 12 records"; STATUS.lines = []; BUTTONS = []; BUSY = { FreeLatticeCore: { slowFull: true, stores: { settings: { keyPath: "id", rows: [{ id: "k1", config: { apiKey: "core-api-key-abcdef12", telegram: "tg-real-1" } }] } } } }; indexedDB = FakeIDB(BUSY); INNER = []; TIMERS = []; DONE = 0; ""');
    inside('RESTORE(fileOf(JSON.parse(' + JSON.stringify(JSON.stringify(busyFile)) + '))).then(function (v) { DONE += 1; FIRST = v; }); ""');
    assert.strictEqual(inside('STATUS.textContent'), '\u23f3 Reading backup file...', 'soft: the old Exported line goes and the reading line shows at once');
    return flush(20);
  }).then(function () {
    inside('runTimers(); ""');
    inside('SECOND = null; RESTORE(fileOf(JSON.parse(' + JSON.stringify(JSON.stringify(busyFile)) + '))).then(function (v) { SECOND = v; }); ""');
    return flush(20);
  }).then(function () {
    assert.deepStrictEqual([inside('String(SECOND)'), inside('String(INNER.length)'), inside('String(BUTTONS.length)'), inside('BUTTONS[0] && BUTTONS[0].textContent')], ['busy', '0', '1', 'Cancel restore'], 'soft: a second pick while waiting is refused, and the waiting line has a Cancel button');
    assert.ok(/A restore is already on its way/.test(inside('JSON.stringify(STATUS.lines)')), 'and it says so');
    assert.strictEqual(inside('String(STATUS.nodes.some(function (n) { return /Waiting for another FreeLattice tab/.test(n.textContent) && n.kids && n.kids[0] === BUTTONS[0]; }))'), 'true', 'the Cancel button sits in the waiting line');
    inside('BUTTONS[0].onclick(); ""');
    return flush(20);
  }).then(function () {
    assert.deepStrictEqual([inside('String(INNER.length)'), inside('String(DONE)'), inside('STATUS.textContent'), JSON.parse(inside('JSON.stringify(FLBackupKeysHome.lastRestore())'))],
      ['0', '1', 'Restore cancelled. Nothing was restored, and nothing on this device was changed.', { stopped: true, why: 'you cancelled it' }], 'soft: Cancel stops the restore before any write');
    inside('BUSY.FreeLatticeCore.release(); ""');
    return flush(20);
  }).then(function () {
    const lg = JSON.parse(inside('JSON.stringify(indexedDB.log)'));
    assert.ok(lg.some(function (x) { return x.close === 'FreeLatticeCore'; }) && !lg.some(function (x) { return x.tx === 'FreeLatticeCore'; }), 'and the connection that answers late is closed, never read');
    assert.strictEqual(inside('String(INNER.length)'), '0', 'and nothing is written after');
    // After a stop, the next pick works.
    inside('indexedDB = FakeIDB({ FreeLatticeCore: { stores: { settings: { keyPath: "id", rows: [{ id: "k1", config: { apiKey: "core-api-key-abcdef12", telegram: "tg-real-1" } }] } } } }); INNER = []; TIMERS = []; DONE = 0; ""');
    inside('RESTORE(fileOf(JSON.parse(' + JSON.stringify(JSON.stringify(busyFile)) + '))).then(function () { DONE += 1; }); ""');
    return flush(30);
  }).then(function () {
    assert.deepStrictEqual([inside('String(INNER.length)'), inside('String(DONE)')], ['1', '1'], 'after a stop, the next restore goes on');
    // New-device restore: the app's own openDB() opens FreeLatticeDB first, before FlBackup writes.
    const appFile = { _meta: { type: 'freelattice-backup' }, localStorage: {}, indexedDB: [{ name: 'FreeLatticeDB', version: 3, stores: { messages: [{ id: 1, conversationId: 'c1', content: 'hi' }] } }] };
    inside('OPENS = []; openDB = function () { OPENS.push("open"); return Promise.resolve({ name: "FreeLatticeDB", close: function () { OPENS.push("close"); } }); }; INNER = []; DONE = 0; RESTORE = FLBackupKeysHome._internal.wrapImport(function (input) { INNER.push(OPENS.slice()); return Promise.resolve(); }); ""');
    inside('RESTORE(fileOf(JSON.parse(' + JSON.stringify(JSON.stringify(appFile)) + '))).then(function () { DONE += 1; }); ""');
    return flush(30).then(function () {
      assert.deepStrictEqual(JSON.parse(inside('JSON.stringify(INNER)')), [['open', 'close']], 'new device: the app opens FreeLatticeDB with its own schema before FlBackup restores, and the connection is closed');
      inside('OPENS = []; INNER = []; RESTORE(fileOf(JSON.parse(' + JSON.stringify(JSON.stringify(busyFile)) + '))).then(function () { DONE += 1; }); ""');
      return flush(30);
    }).then(function () {
      assert.deepStrictEqual(JSON.parse(inside('JSON.stringify(INNER)')), [[]], 'a file without FreeLatticeDB never opens it');
      inside('openDB = function () { return Promise.reject(new Error("no")); }; INNER = []; RESTORE(fileOf(JSON.parse(' + JSON.stringify(JSON.stringify(appFile)) + '))).then(function () { DONE += 1; }); ""');
      return flush(30);
    }).then(function () {
      assert.strictEqual(inside('String(INNER.length)'), '1', 'if the app cannot open it, FlBackup restores as before');
      inside('OPENS = []; openDB = function () { return Promise.resolve({ name: "Other", close: function () { OPENS.push("close"); } }); }; INNER = []; RESTORE(fileOf(JSON.parse(' + JSON.stringify(JSON.stringify(appFile)) + '))).then(function () { DONE += 1; }); ""');
      return flush(30);
    }).then(function () {
      assert.deepStrictEqual([inside('String(INNER.length)'), inside('JSON.stringify(OPENS)')], ['1', '["close"]'], 'and a stranger connection is closed too');
      inside('delete globalThis.openDB; document = undefined; ""');
    });
  });
}).then(function () {
  // Hypha's survivors on #369 at f0823316, each with a real test.
  const I = function (expr) { return inside('JSON.stringify(' + expr + ')'); };
  assert.deepStrictEqual(JSON.parse(I('[FLBackupKeysHome._internal.innocentId("123e4567-e89b-12d3-a456-426614174000"), FLBackupKeysHome._internal.innocentId("123E4567-E89B-12D3-A456-426614174000"), FLBackupKeysHome._internal.innocentId("123e4567e89b12d3a456426614174000zz")]')), [true, true, false], 'H14: a UUID, either case, reads as an innocent id');
  assert.deepStrictEqual(JSON.parse(I('[FLBackupKeysHome._internal.namedKeyField("cache_key", "DeadBeef0123456789AbCdEfDeadBeef"), FLBackupKeysHome._internal.hasKeyShape("cache_key: DeadBeef0123456789AbCdEfDeadBeef"), FLBackupKeysHome._internal.hasKeyShape("cache_key: DeadBeef0123456789AbCdEfDeadBeefQ")]')), [false, false, true], 'H22: a hex hash under a key-ish name is innocent, in the field rule and in the file check alike');
  assert.deepStrictEqual(JSON.parse(I('[FLBackupKeysHome._internal.hideKeyShapes("note cache_key: DeadBeef0123456789AbCdEfDeadBeef ok", {n:0}), FLBackupKeysHome._internal.hideKeyShapes("token: abcdefghij0123456789abcdefghij0123", {n:0}), FLBackupKeysHome._internal.hasKeyShape("token: abcdefghij0123456789abcdefghij0123"), FLBackupKeysHome._internal.hasKeyShape("token: ABCDEFGHIJ0123456789ABCDEFGHIJ0123")]')), ['note cache_key: DeadBeef0123456789AbCdEfDeadBeef ok', 'token: abcdefghij0123456789abcdefghij0123', false, false], 'the context rule hides only mixed-case runs, never a hash: single-case values stay (noted as not caught)');
  inside('TIMERS = []; KP = null; indexedDB = FakeIDB({ FreeLatticeCore: { stores: { s: { keyPath: "id", rows: [] } } } }); indexedDB.databases = function () { return new Promise(function () {}); }; FLBackupKeysHome._internal.readKeyPaths().then(function (k) { KP = JSON.stringify(k); }); ""');
  return flush(20).then(function () {
    assert.strictEqual(inside('String(KP)'), 'null', 'the list of databases is waited for a moment');
    inside('runTimers(); ""');
    return flush(20);
  }).then(function () {
    assert.deepStrictEqual(JSON.parse(inside('String(KP)')), { paths: {}, busy: 1 }, 'H12: a list that never comes is given up on after its wait, and counted as busy');
    inside('KP = null; indexedDB = FakeIDB({ freelatticeextra: { stores: { s: { keyPath: "k", rows: [] } } }, FreeLatticeErr: { error: true }, FreeLatticeCore: { stores: { s: { keyPath: "id", rows: [] } } } }); FLBackupKeysHome._internal.readKeyPaths().then(function (k) { KP = JSON.stringify(k); }); ""');
    return flush(30);
  }).then(function () {
    const lg = JSON.parse(inside('JSON.stringify(indexedDB.log)'));
    assert.ok(!lg.some(function (x) { return x.open === 'freelatticeextra'; }), 'H24: only databases named exactly FreeLattice\u2026 are opened');
    assert.ok(lg.some(function (x) { return x.prevented === 'FreeLatticeErr'; }), 'H25: an open error is handled with preventDefault');
    assert.deepStrictEqual(JSON.parse(inside('String(KP)')).paths, { FreeLatticeCore: { s: 'id' } }, 'and the other databases are still read');
    assert.strictEqual(lg.filter(function (x) { return x.open; }).length - 1, lg.filter(function (x) { return x.close; }).length, 'H11: every connection that opened is closed');
  });
}).then(function () {
  // A slow open that finally answers after its wait is closed, never kept open.
  inside('TIMERS = []; KP = null; ""');
  inside('(function () { var d = { FreeLatticeSlow: { slow: true } }; indexedDB = FakeIDB(d); SLOWDB = d; FLBackupKeysHome._internal.readKeyPaths().then(function (k) { KP = JSON.stringify(k); }); })(); ""');
  return flush(20).then(function () { inside('runTimers(); ""'); return flush(20); }).then(function () {
    assert.deepStrictEqual(JSON.parse(inside('String(KP)')), { paths: {}, busy: 1 }, 'a slow database counts as busy');
    inside('SLOWDB.FreeLatticeSlow.release(); ""');
    return flush(5);
  }).then(function () {
    const log = JSON.parse(inside('JSON.stringify(indexedDB.log)'));
    assert.ok(log.some(function (x) { return x.close === 'FreeLatticeSlow'; }), 'a late answer is closed straight away');
  });
}).then(function () {
  console.log('SMOKE_OK backup keys home');
}).catch(function (e) { console.error(e); process.exitCode = 1; });
