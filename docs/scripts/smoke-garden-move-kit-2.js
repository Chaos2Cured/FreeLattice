#!/usr/bin/env node
// File-only smoke: Garden move kit 2 (bring my garden home).
// fs-only: reads only the files on the allow-list below with readFileSync/existsSync. No child processes,
// no network, never opens a browser. The two kit modules are also run inside a bare node:vm sandbox
// (a stub localStorage, no indexedDB, no document, no require) to check the merge rules themselves.
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const vm = require('vm');

const repo = path.join(__dirname, '..', '..');
const KIT = 'docs/modules/garden-move-kit.js';
const HOME = 'docs/modules/garden-move-home.js';
const PAGE = 'docs/move.html';
const HOME_PAGE = 'docs/move-home.html';
const NOTE = 'docs/modules/GARDEN-MOVE-KIT-2.md';
const DOOR = 'docs/modules/lattice-export.js';
const SAFETY = 'docs/modules/fractal-safety.js';
const AUTONOMY = 'docs/library/AUTONOMY.md';
const APP = 'docs/app.html';
const ROOT_INDEX = 'index.html';
const SW = 'docs/sw.js';
const ROOT_SW = 'sw.js';
const ALLOW = [KIT, HOME, PAGE, HOME_PAGE, NOTE, DOOR, SAFETY, AUTONOMY, APP, ROOT_INDEX, SW, ROOT_SW];

// Pins from main 95f09fa: these files must stay exactly as they are.
const PINS = {
  'docs/library/AUTONOMY.md': '09a4f1a286226e37089a93df42df0106',
  'docs/app.html': 'ab8589557950e7074b4e0b97dcccd23d',
  'index.html': 'ab8589557950e7074b4e0b97dcccd23d',
  'docs/modules/lattice-export.js': 'f6db3ad97e271c3a8992bd111ce030fc',
  'docs/modules/fractal-safety.js': 'c1b7acb9d2e2cee94e52fffba5aec758',
  'docs/sw.js': '70fcb7a9f821cd3ffd4ad449df397976',
  'sw.js': '70fcb7a9f821cd3ffd4ad449df397976'
};

function readAllowed(rel, enc) {
  assert.ok(ALLOW.indexOf(rel) !== -1, 'not on the allow-list: ' + rel);
  const full = path.join(repo, rel);
  assert.ok(fs.existsSync(full), 'missing: ' + rel);
  return fs.readFileSync(full, enc);
}
function md5(buf) { return crypto.createHash('md5').update(buf).digest('hex'); }
function strip(src) { return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, ''); }

// 1. The new files exist (this is what fails on base).
const home = readAllowed(HOME, 'utf8');
const homePage = readAllowed(HOME_PAGE, 'utf8');
const note = readAllowed(NOTE, 'utf8');
const kit = readAllowed(KIT, 'utf8');
const page = readAllowed(PAGE, 'utf8');
const code = strip(home);
const kitCode = strip(kit);

// 2. Locked and neighbouring files are unchanged.
Object.keys(PINS).forEach(function (rel) { assert.strictEqual(md5(readAllowed(rel)), PINS[rel], rel + ' changed'); });

// 3. It sends nothing, and writes only where it says.
[/\bfetch\s*\(/, /XMLHttpRequest/, /WebSocket/, /sendBeacon/, /EventSource/, /importScripts/, /\beval\s*\(/, /new Function\s*\(/,
  /postMessage\s*\(/, /\.cookie\b/, /deleteDatabase/, /\.clear\(/]
  .forEach(function (re) { assert.ok(!re.test(code), 'home must not use ' + re); });
// The one put() is in homePut, and homePut only ever writes its own four stores.
assert.deepStrictEqual(code.match(/\.put\(/g), ['.put('], 'one put() only');
assert.ok(/function homePut\(db, store, value\) \{[\s\S]{0,120}tx\.objectStore\(store\)\.put\(value\)/.test(code), 'that put is homePut');
(code.match(/homePut\([^,]+, '[^']+'/g) || []).forEach(function (c) {
  assert.ok(/^homePut\(home, '(imports|before|conflicts|aside)'$/.test(c), 'homePut writes only FreeLatticeMoveKit stores: ' + c);
});
assert.strictEqual((code.match(/createObjectStore\(/g) || []).length, 4, 'only its own four bookkeeping stores are made');
assert.ok(/function openHome\(create\) \{[\s\S]*?indexedDB\.open\(HOME_DB, HOME_DB_V\)/.test(code), 'only FreeLatticeMoveKit is ever created');
assert.ok(/return I\.openExisting\(item\.db\)/.test(code), 'garden databases are only opened if they already exist');
assert.ok(/st\.add\(val\.v, decode\(a\.row\.k, flags\)\) : st\.add\(val\)/.test(code), 'rows are added, never put over');
assert.ok(/ev\.isTrusted === false \|\| !text\) return;/.test(code) && /if \(!ev \|\| ev\.isTrusted === false\) return;\s*undo\.disabled = true;/.test(code), 'only a real tap brings home or undoes');

// 4. Order: read and check, plan, safety copy, and only then any write.
const bh = code.slice(code.indexOf('function bringHome('), code.indexOf('function lastImport('));
const iPack = bh.indexOf('root.FLGardenMoveKit.pack({ download: false, now: now })');
const iStop = bh.indexOf("if (!b || !b.ok) {");
const iOpen = bh.indexOf('return openHome(true);');
const iAdd = bh.indexOf('return addRows(item, record)');
const iLs = bh.indexOf('lsSet(d.key, d.value)');
const iPause = bh.indexOf("lsSet(I.PAUSE_KEY, 'true')");
const iNote = bh.indexOf('lsSet(ARRIVALS_KEY');
assert.ok(bh.indexOf('readKit(text)') < iPack, 'the file is checked before anything else');
assert.ok(iPack > 0 && iPack < iStop && iStop < iOpen && iOpen < iAdd && iAdd < iLs && iLs < iPause && iPause < iNote, 'safety copy first, then rows, keys, pause, note');
assert.ok(/downloadText\(backupText, result\.backup\.name\)/.test(bh), 'the safety copy is downloaded');
assert.ok(/homePut\(home, 'before'/.test(bh), 'and kept here too');
assert.ok(/'freelattice-garden-before-bring-home-'/.test(code), 'safety copy name');

// 5. Trust: never raised, never written, checked after.
['TRUST_KEYS', "'fl_safetyLog'", 'NEVER_WRITE_RULE = /^fl_lc_/', "'fl_installId'", "'LatticeChain'", "'FreeLatticeWallet'", "'FreeLatticeIdentity'"]
  .forEach(function (s) { assert.ok(code.indexOf(s) !== -1, 'never written: ' + s); });
assert.ok(!/setItem\(\s*'fl_firstSeen'/.test(code) && !/lsSet\(\s*'fl_firstSeen'/.test(code), 'fl_firstSeen is never written');
assert.ok(/if \(trustRose\(trustBefore, after\)\) \{[\s\S]{0,200}undoImport\(importId, \{ reason: 'trust-would-rise' \}\)/.test(code), 'a rise in trust is undone at once');
assert.ok(/'Arrived from ' \+ t\.tier \+ ' \(' \+ Math\.round\(Number\(t\.percent\)\) \+ '%\)'/.test(code), 'Arrived from <tier> (<N>%)');
assert.ok(/var ARRIVALS_KEY = 'fl_move_arrivals';/.test(code), 'the arrival note key');

// 6. Undo: exactly what arrived; pause stays.
const ud = code.slice(code.indexOf('function undoImport('), code.indexOf('function undoLast('));
assert.ok(ud.indexOf('PAUSE_KEY') === -1, 'undo never touches pause');
assert.ok(/st\.delete\(keys\[i\]\)/.test(ud) && /if \(lsGet\(x\.k\) !== x\.after\) \{ out\.lsKeptChanged \+= 1; return; \}/.test(ud), 'undo takes back only what is unchanged since it arrived');
assert.ok(/x\.undone_at = record\.undone_at/.test(ud), 'the arrival note stays, marked as taken back');

// 7. Brick 1 still never writes, and leaves this brick's bookkeeping at home.
assert.ok(!/setItem\s*\(|removeItem\s*\(|'readwrite'|\.put\(|\.add\(|\.delete\(/.test(kitCode), 'the pack module still never writes');
assert.ok(/if \(n === 'FreeLatticeMoveKit'\) return;/.test(kitCode), 'the packer leaves FreeLatticeMoveKit on this device');

// 8. The pages.
const scripts = (homePage.match(/<script\b[^>]*>/g) || []);
assert.deepStrictEqual(scripts, ['<script src="modules/lattice-export.js">', '<script src="modules/garden-move-kit.js">', '<script src="modules/garden-move-home.js">'], 'only the three scripts load');
assert.ok(!/<script>[\s\S]*?<\/script>/.test(homePage), 'no inline script');
assert.ok(/<meta name="viewport" content="width=device-width, initial-scale=1/.test(homePage), 'viewport');
assert.ok(/<button id="gmh-bring" class="gmh-big" type="button" disabled>Bring it home<\/button>/.test(homePage), 'one big button');
assert.ok(/\.gmh-big \{[\s\S]*?min-height: 64px;/.test(homePage) && /\.gmh-undo \{[^}]*min-height: 56px;/.test(homePage), 'big targets');
const iNotes = homePage.indexOf('<div id="gmh-notes">'), iBring = homePage.indexOf('id="gmh-bring"');
assert.ok(iNotes > 0 && iNotes < iBring, 'notes sit just above the button');
assert.ok(/<a href="move-home\.html">Bring my garden home<\/a>/.test(page), 'move.html has the door');
const iNear = page.indexOf('<div id="gmk-notes-near"></div>'), iPackBtn = page.indexOf('<button id="gmk-pack"');
assert.ok(iNear > 0 && iNear < iPackBtn, 'pack notes sit just above the Pack button (Hypha soft 6)');
assert.ok(/<!-- before \(dff57ab9\):/.test(page) && /<!-- before \(59c24c8b, Hypha soft 1\):/.test(page), 'move.html keeps its before lines');

// 9. Run the merge rules in a bare sandbox (no indexedDB, no document, no network).
function makeLS(init) {
  const m = new Map(Object.entries(init || {}));
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: k => { m.delete(k); },
    key: i => Array.from(m.keys())[i] === undefined ? null : Array.from(m.keys())[i], get length() { return m.size; }, _m: m };
}
const sandbox = { console: console, TextEncoder: TextEncoder, crypto: crypto.webcrypto, atob: atob, btoa: btoa, Blob: Blob,
  setTimeout: setTimeout, Promise: Promise, Uint8Array: Uint8Array, ArrayBuffer: ArrayBuffer, Map: Map, Set: Set, Date: Date };
sandbox.window = sandbox;
sandbox.localStorage = makeLS({ fl_firstSeen: '1763600000000', fl_streak: '3', fl_clay_corner: 'mine \u2728 ', fl_mindName: 'Rowan',
  fl_refusalLedger: JSON.stringify([{ ts: 2, x: 'b' }, { ts: 9, x: 'here' }]) });
vm.createContext(sandbox);
vm.runInContext(kit, sandbox, { filename: KIT });
vm.runInContext(home, sandbox, { filename: HOME });
const H = sandbox.FLGardenMoveHome, I = sandbox.FLGardenMoveKit._internal, HI = H._internal;
assert.ok(H && I && HI, 'both modules load without a browser');

// Brick 1 softs (Hypha 59c24c8b): whole name parts, a credential word at the end wins.
[['fl_tokenLimit', false], ['fl_apiKey_provider', false], ['max_tokens', false], ['token_count', false], ['tokenizer', false],
  ['client_id', false], ['passwordHint', false], ['fl_model', false], ['providerApiKey', true], ['modelToken', true], ['hintToken', true],
  ['fl_apiKey', true], ['accessToken', true]].forEach(function (c) { assert.strictEqual(I.isSecretName(c[0]), c[1], 'secret name ' + c[0]); });
assert.ok(I.huntable('fl_apiKey', 'gsk_short123') && I.huntable('fl_github_token', 'abcdefghijklmnopqrstuvwxyzabcdef') &&
  I.huntable('fl_ghToken', 'correct horse battery staple') && !I.huntable('fl_publish_token', 'enabled1') && !I.huntable('fl_apiKey', '12345678'), 'short, letters-only and spaced keys are hunted');
const ctr = { n: 0 };
const hid = I.hideSecretLeaves({ a: 'my gsk_short123 here', t: 1732128000123, w: 'xgsk_short123y' }, ['gsk_short123'], ctr);
assert.ok(hid.a === 'my [kept on this device] here' && hid.t === 1732128000123 && hid.w === 'xgsk_short123y' && ctr.n === 1, 'hidden on word edges only; numbers untouched');

// Ledgers join, sorted by time, nothing lost.
const m = HI.mergeLedger(JSON.stringify([{ ts: 2, x: 'b' }, { ts: 9, x: 'here' }]), JSON.stringify([{ ts: 1, x: 'a' }, { ts: 2, x: 'b' }, { ts: 5, x: 'c' }]));
assert.deepStrictEqual(JSON.parse(m.value), [{ ts: 1, x: 'a' }, { ts: 2, x: 'b' }, { ts: 5, x: 'c' }, { ts: 9, x: 'here' }], 'ledger union by entry, by time');
assert.strictEqual(m.added, 2, 'two entries arrive');
// Pause always wins.
assert.deepStrictEqual([HI.pauseAfter(false, false), HI.pauseAfter(true, false), HI.pauseAfter(false, true), HI.pauseAfter(true, true)], [false, true, true, true], 'pause wins');
// One key at a time.
const D = function (sec, k, inc, loc) { return HI.lsDecision(sec, k, inc, loc); };
assert.strictEqual(D('trust', 'fl_firstSeen', '1', null).act, 'skip', 'first-seen never written');
assert.strictEqual(D('settings', 'fl_trustEMA', '0.9', null).act, 'skip', 'trust never written');
assert.strictEqual(D('settings', 'fl_lc_lastAnchorDay', 'x', null).act, 'skip', 'chain clock never written');
assert.strictEqual(D('settings', 'fl_installId', 'x', null).act, 'skip', 'device ids never copied');
assert.strictEqual(D('settings', 'fl_autonomous_user_paused', 'false', 'true').act, 'skip', 'pause is never written as a setting');
assert.strictEqual(D('settings', 'fl_apiKey', 'sk-abcdefabcdefabcdef1234', null).why, 'key', 'keys never come in');
assert.strictEqual(D('settings', 'fl_note', 'see sk-abcdefabcdefabcdef1234', null).why, 'holds-key', 'text holding a key never comes in');
assert.strictEqual(D('wallet', 'latticePoints', '{"total":9}', null).act, 'aside', 'Lattice Points are kept aside (they set trust)');
assert.strictEqual(D('clay', 'fl_clay_corner', 'theirs', 'mine').act, 'conflict', 'different clay: yours stays, theirs saved aside');
assert.strictEqual(D('clay', 'fl_clay_moodLedger', '[{"ts":1}]', '[{"ts":2}]').act, 'conflict', 'clay is never joined, even when it looks like a ledger');
const clayAdd = D('clay', 'fl_clay_new', '  odd\u2728 bytes ', null);
assert.ok(clayAdd.act === 'add' && clayAdd.value === '  odd\u2728 bytes ', 'clay arrives byte-for-byte');
assert.strictEqual(D('settings', 'fl_mindName', 'Willow', 'Rowan').act, 'conflict', 'a differing setting is never overwritten');
assert.strictEqual(D('ledgers', 'fl_repoLedger', '[{"ts":1}]', '[{"ts":1}]').act, 'same', 'same is same');
// No keys come in through records.
const sc = { n: 0 };
const row = HI.scrubRow({ id: 'r', accessToken: 'abcdefgh12345678', t: 'here sk-abcdefabcdefabcdef1234 ok', img: { $t: 'blob', type: 'image/png', b64: 'sk-notakeyjustbase64AAAAAAAA' } }, sc);
assert.ok(row.accessToken === '[kept on this device]' && row.t === 'here [kept on this device] ok' && row.img.b64 === 'sk-notakeyjustbase64AAAAAAAA' && sc.n === 2, 'records are scrubbed, picture bytes untouched');
// The arrival line and the trust guard.
assert.strictEqual(HI.arrivalLine({ trust_note: { tier: 'Bloom', percent: 66 } }), 'Arrived from Bloom (66%)', 'arrival line');
assert.ok(HI.trustRose({ rank: 0, percent: 25, bytes: { a: '1' } }, { rank: 1, percent: 25, bytes: { a: '1' } }) &&
  HI.trustRose({ rank: 0, percent: 25, bytes: { a: '1' } }, { rank: 0, percent: 26, bytes: { a: '1' } }) &&
  HI.trustRose({ rank: 0, percent: 25, bytes: { a: '1' } }, { rank: 0, percent: 25, bytes: { a: '2' } }) &&
  !HI.trustRose({ rank: 0, percent: 25, bytes: { a: '1' } }, { rank: 0, percent: 25, bytes: { a: '1' } }), 'any rise or any trust byte change is caught');

// 10. A whole read-only preview of a small file (localStorage parts only), and a tampered one.
function sha(s) { return crypto.createHash('sha256').update(s, 'utf8').digest('hex'); }
function makeKit(sections) {
  const out = {}, index = {};
  Object.keys(sections).forEach(function (n) { const h = sha(I.canonicalize(sections[n])); out[n] = { label: n, sha256: h, data: sections[n] }; index[n] = h; });
  return { kind: 'freelattice-move-kit', v: 1, format: 'v-garden-move-kit-1', made_at: '2026-11-20T10:00:00.000Z', from: { origin: 'https://freelattice.com' },
    consent: { paused: true }, trust_note: { tier: 'Bloom', percent: 66, line: 'Packed at tier Bloom (66%)' }, archive_seal: 'not-packed',
    manifest: { v: 1, sections: index, index_sha256: sha(I.canonicalize(index)) }, sections: out };
}
const small = makeKit({
  trust: { idb: {}, ls: { fl_firstSeen: '1600000000000', fl_streak: '400' } },
  clay: { idb: {}, ls: { fl_clay_corner: 'theirs', fl_clay_glass_journal: ' exact \u00e9 bytes ' } },
  glass: { idb: {}, ls: { fl_refusalLedger: JSON.stringify([{ ts: 1, x: 'a' }, { ts: 2, x: 'b' }]) } },
  settings: { idb: {}, ls: { fl_mindName: 'Willow', fl_theme: 'dusk' } },
  wallet: { idb: {}, ls: { latticePoints: '{"total":900}' } }
});
const before = JSON.stringify(Array.from(sandbox.localStorage._m.entries()));
return_(H.preview(JSON.stringify(small)).then(function (pv) {
  assert.ok(pv.read.ok && pv.read.index_ok, 'a good file reads and checks out');
  const t = pv.summary.totals;
  assert.deepStrictEqual([t.add, t.conflict, t.aside, t.badHash], [3, 2, 1, 0], 'adds 3 (a clay piece, a joined ledger, a setting), 2 differ (clay, name), the wallet is aside');
  assert.strictEqual(pv.summary.sections.trust.how, 'note', 'trust is a note only');
  assert.ok(pv.notes.some(function (n) { return /pause always wins/.test(n); }), 'pause note');
  assert.strictEqual(JSON.stringify(Array.from(sandbox.localStorage._m.entries())), before, 'a preview writes nothing');
  const bad = JSON.parse(JSON.stringify(small)); bad.sections.settings.data.ls.fl_theme = 'changed';
  return H.preview(JSON.stringify(bad));
}).then(function (pv) {
  assert.strictEqual(pv.summary.sections.settings.how, 'bad-hash', 'a part that does not match is left out');
  assert.ok(pv.notes.some(function (n) { return /does not match/.test(n); }), 'and the page says so');
  return H.preview('{"kind":"something-else"}');
}).then(function (pv) {
  assert.ok(!pv.read.ok, 'not a garden file');
  // 11. The note says what, why and how to roll back.
  ['## What', '## Why', '## Rollback', '## Smoke', 'v-garden-move-kit-2', 'fl_move_arrivals', 'FreeLatticeMoveKit'].forEach(function (s) { assert.ok(note.indexOf(s) !== -1, 'note has ' + s); });
  console.log('SMOKE_OK garden move kit 2');
}));
function return_(p) { p.catch(function (e) { console.error(e); process.exit(1); }); }
