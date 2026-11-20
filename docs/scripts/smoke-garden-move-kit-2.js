#!/usr/bin/env node
// File-only smoke: Garden move kit 2 (bring my garden home).
// fs-only: reads only the files on the allow-list below with readFileSync/existsSync. No child processes,
// no network, never opens a browser. It runs ONE file, docs/modules/garden-move-merge.js (the pure arrival
// rules), inside a fresh node:vm context made with vm.constants.DONT_CONTEXTIFY: no host objects are given
// to it, data goes in as JSON text and comes out as JSON text. Every other file is only read as text.
// The pack module and the pages pinned by smoke 1 are not read here (smoke 1 covers them).
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const vm = require('vm');

const repo = path.join(__dirname, '..', '..');
const MERGE = 'docs/modules/garden-move-merge.js';
const HOME = 'docs/modules/garden-move-home.js';
const HOME_PAGE = 'docs/move-home.html';
const PAGE = 'docs/move.html';
const NOTE = 'docs/modules/GARDEN-MOVE-KIT-2.md';
const SAFETY = 'docs/modules/fractal-safety.js';
const ALLOW = [MERGE, HOME, HOME_PAGE, PAGE, NOTE, SAFETY];

function readAllowed(rel) {
  assert.ok(ALLOW.indexOf(rel) !== -1, 'not on the allow-list: ' + rel);
  const full = path.join(repo, rel);
  assert.ok(fs.existsSync(full), 'missing: ' + rel);
  return fs.readFileSync(full, 'utf8');
}
function strip(src) { return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, ''); }

// 1. The new files exist (this is what fails on base).
const merge = readAllowed(MERGE);
const home = readAllowed(HOME);
const homePage = readAllowed(HOME_PAGE);
const page = readAllowed(PAGE);
const note = readAllowed(NOTE);
assert.strictEqual(crypto.createHash('md5').update(readAllowed(SAFETY)).digest('hex'), 'c1b7acb9d2e2cee94e52fffba5aec758', 'fractal-safety.js changed');
const mcode = strip(merge);
const code = strip(home);

// 2. The rules file is pure: nothing that touches storage, the page, the network, time or the host.
[/indexedDB/, /localStorage/, /\bdocument\b/, /\bfetch\b/, /XMLHttpRequest/, /WebSocket/, /sendBeacon/, /setTimeout/, /setInterval/,
  /Promise/, /\beval\b/, /Function\s*\(/, /\brequire\b/, /\bprocess\b/, /\bimport\b/, /_internal/, /LatticeExport/]
  .forEach(function (re) { assert.ok(!re.test(mcode), 'the rules file must not use ' + re); });
// The bring-home module never asks lattice-export.js directly; the pack module answers for it.
assert.ok(!/LatticeExport/.test(code) && /I\.noPrivateRoomMarks\(text\)/.test(code), 'private rooms are checked through the pack module');

// 3. Run the rules in a bare context.
assert.ok(vm.constants && vm.constants.DONT_CONTEXTIFY !== undefined, 'node:vm DONT_CONTEXTIFY is needed (Node 22.8 or later)');
const ctx = vm.createContext(vm.constants.DONT_CONTEXTIFY);
vm.runInContext(merge, ctx, { filename: MERGE, timeout: 2000 });
function inside(src) {
  const out = vm.runInContext(src, ctx, { timeout: 2000 });
  assert.strictEqual(typeof out, 'string', 'only text comes out');
  return out;
}
assert.ok(['undefined', 'blocked'].indexOf(inside("(function(){ try { return String(this.constructor.constructor('return typeof process')()); } catch (e) { return 'blocked'; } })()")) !== -1, 'no way out to the host');
assert.strictEqual(inside("typeof require + typeof process + typeof setTimeout"), 'undefinedundefinedundefined', 'nothing from the host inside');
function call(fn) {
  const args = Array.prototype.slice.call(arguments, 1);
  const out = inside('(function(){ var r = FLGardenMoveMerge[' + JSON.stringify(fn) + '].apply(null, JSON.parse(' +
    JSON.stringify(JSON.stringify(args)) + ')); return r === undefined ? "null" : JSON.stringify(r); })()');
  return JSON.parse(out);
}

// 4. Keys: the arrival allow-list (Hypha HOLD H2).
const K = function (k, flags) { return call('classifyKey', k, flags || {}); };
['fl_mesh_id', 'fl_meshid_display', 'fl_meshid_exists', 'fl_kin_passes', 'fl_meshNodeId', 'fl_installId', 'fl-peer-id', 'fl_lan_peer_id',
  'meshFriendlyName', 'fl_meshnet', 'fl-meshbook', 'fl_mesh_known_peers', 'fl_agentBlockedPeers', 'fl_localHost', 'fl_bridgePort', 'fl_deviceLabel', 'fl_sessionId', 'fl_kinship']
  .forEach(function (k) { assert.deepStrictEqual(K(k), { act: 'skip', why: 'identity' }, k + ' never comes in'); });
['fl_firstSeen', 'fl_streak', 'fl_trustEMA', 'fl_safetyLog', 'fl_lc_lastAnchorDay', 'fl_autonomous_user_paused', 'fl_move_arrivals', 'fl_corePlantCount']
  .forEach(function (k) { assert.deepStrictEqual(K(k), { act: 'skip', why: 'trust-or-device' }, k + ' is never written'); });
['latticePoints', 'lattice_wallet', 'fl_wallet_anchors', 'fl_lp_give_history'].forEach(function (k) { assert.deepStrictEqual(K(k), { act: 'aside', why: 'wallet' }, k + ' is saved aside'); });
['FL_FIRSTSEEN', 'fl_firstSeen ', 'fl_somethingNew', 'fl_provider', 'fl_model', 'wop-carved'].forEach(function (k) { assert.deepStrictEqual(K(k), { act: 'aside', why: 'not-known-here' }, k + ' is unknown, so aside'); });
['__proto__', 'constructor', 'prototype'].forEach(function (k) { assert.deepStrictEqual(K(k), { act: 'skip', why: 'unsafe-name' }, k + ' is never a key'); });
assert.deepStrictEqual(K('fl_apiKey', { secret: true }), { act: 'skip', why: 'key' }, 'keys never come in');
assert.deepStrictEqual(K('fl_x', { private: true }), { act: 'skip', why: 'private' }, 'private things never come in');
[['fl_theme', 'settings'], ['fl_mindName', 'settings'], ['fl_tokenLimit', 'settings'], ['fl_achievement_first_seed', 'settings'],
  ['fl_refusalLedger', 'glass'], ['fl_repoLedger', 'ledgers'], ['fl_clay_mind1', 'clay'], ['fl_clay_corner_state:node-1', 'clay'],
  ['fl-garden-quality', 'garden'], ['fl_memory_core_v1', 'memories'], ['fl_chatHistory', 'chats'], ['fl_latticeLetters', 'letters'], ['fl_companions', 'companions']]
  .forEach(function (c) { assert.deepStrictEqual(K(c[0]), { act: 'live', section: c[1] }, c[0] + ' may arrive'); });

// 5. One key at a time.
const D = function (key, incoming, local, extra) { return call('lsDecision', Object.assign({ key: key, incoming: incoming, local: local, flags: {} }, extra || {})); };
assert.deepStrictEqual(D('fl_clay_mind1', '  exact \u00e9 bytes  ', null), { act: 'add', value: '  exact \u00e9 bytes  ', clay: true, section: 'clay' }, 'clay arrives byte-for-byte');
assert.deepStrictEqual(D('fl_clay_mind1', 'theirs', 'mine'), { act: 'conflict', clay: true, section: 'clay' }, 'different clay: yours stays');
assert.strictEqual(D('fl_clay_moodLedger', '[{"ts":1}]', '[{"ts":2}]').act, 'conflict', 'clay is never joined');
assert.strictEqual(D('fl_theme', 'dusk', 'dawn').act, 'conflict', 'a differing setting is never overwritten');
assert.strictEqual(D('fl_theme', 'dusk', 'dusk').act, 'same', 'same is same');
assert.strictEqual(D('fl_theme', 'note [kept on this device]', 'note gsk_short123', { localHidden: 'note [kept on this device]' }).act, 'same', 'a key hidden by packing is not a difference (soft S-f)');
assert.strictEqual(D('fl_theme', 'see sk-abcdefabcdefabcdef1234', null).why, 'holds-key', 'text holding a key never comes in');
assert.deepStrictEqual(D('fl_clay_x', 'ghp_abcdefabcdefabcdef1234', null), { act: 'skip', why: 'clay-holds-key' }, 'clay holding a key stays in the file');
const led = D('fl_refusalLedger', JSON.stringify([{ ts: 1, x: 'a' }, { ts: 2, x: 'b' }, { ts: 5, x: 'c' }]), JSON.stringify([{ ts: 2, x: 'b' }, { ts: 9, x: 'here' }]));
assert.strictEqual(led.act, 'ledger', 'ledgers join');
assert.deepStrictEqual(JSON.parse(led.value), [{ ts: 1, x: 'a' }, { ts: 2, x: 'b' }, { ts: 5, x: 'c' }, { ts: 9, x: 'here' }], 'by entry, in time order');
assert.strictEqual(led.added, 2, 'two entries arrive');
assert.strictEqual(D('fl_meshid_display', 'OldDesk', null).act, 'skip', 'no mesh name from the other device');

// 6. Parts, databases and rows.
const known = ['FreeLatticeEvolution', 'FreeLatticeCore', 'FreeLatticeIdentity', 'FreeLatticeWallet', 'LatticeChain', 'fl_kin_queue', 'LatticeHandshakes', 'WallOfPresence'];
[['garden', 'merge'], ['clay', 'merge'], ['trust', 'note'], ['archive', 'stays-in-file'], ['chain', 'aside'], ['wallet', 'aside'], ['identity', 'aside'],
  ['other', 'aside'], ['x-weft/loom', 'aside'], ['__proto__', 'refuse'], ['constructor', 'refuse']]
  .forEach(function (c) { assert.strictEqual(call('sectionDisposition', c[0], false), c[1], 'part ' + c[0]); });
assert.strictEqual(call('sectionDisposition', 'garden', true), 'aside', 'a builder part is aside');
[['FreeLatticeEvolution', 'merge'], ['FreeLatticeCore', 'merge'], ['FreeLatticeLetters_willow', 'merge'], ['FreeLatticeIdentity', 'aside'], ['FreeLatticeWallet', 'aside'],
  ['LatticeChain', 'aside'], ['fl_kin_queue', 'aside'], ['LatticeHandshakes', 'aside'], ['WallOfPresence', 'aside'], ['FreeLatticeMoveKit', 'aside'], ['SomethingNew', 'aside'], ['__proto__', 'refuse']]
  .forEach(function (c) { assert.strictEqual(call('dbDisposition', c[0], known), c[1], 'database ' + c[0]); });
assert.strictEqual(call('dbDisposition', 'FreeLatticeMoveKit', known.concat(['FreeLatticeMoveKit'])), 'aside', 'its own bookkeeping never arrives, even when listed');
assert.strictEqual(call('rowDecision', { hasKey: false, rowCanon: 'a', localCanon: null }), 'aside', 'a row without its own key is saved aside (soft S-c)');
assert.strictEqual(call('rowDecision', { hasKey: true, rowCanon: 'a', localCanon: null }), 'add', 'a new row is added');
assert.strictEqual(call('rowDecision', { hasKey: true, rowCanon: 'a', localCanon: 'a' }), 'same', 'same row');
assert.strictEqual(call('rowDecision', { hasKey: true, rowCanon: 'a', localCanon: 'b', localHiddenCanon: 'a' }), 'same', 'same once this device\u2019s key is hidden');
assert.strictEqual(call('rowDecision', { hasKey: true, rowCanon: 'a', localCanon: 'b' }), 'conflict', 'a differing row keeps yours');

// 7. Pause, the arrival line and the trust guard.
assert.deepStrictEqual([call('pauseAfter', false, false), call('pauseAfter', true, false), call('pauseAfter', false, true), call('pauseAfter', true, true)], [false, true, true, true], 'pause wins');
assert.strictEqual(call('arrivalLine', { tier: 'Bloom', percent: 66 }), 'Arrived from Bloom (66%)', 'arrival line');
assert.strictEqual(call('arrivalLine', { tier: '<img src=x>', percent: 5 }), 'Arrived from an earlier garden', 'a strange tier is not shown');
assert.strictEqual(call('arrivalLine', { tier: 'Eternal', percent: 900 }), 'Arrived from Eternal (100%)', 'percent stays in 0..100');
const T = function (b, a) { return call('trustRose', b, a); };
assert.ok(T({ rank: 0, percent: 25, bytes: { a: '1' } }, { rank: 1, percent: 25, bytes: { a: '1' } }) && T({ rank: 0, percent: 25, bytes: { a: '1' } }, { rank: 0, percent: 26, bytes: { a: '1' } }) &&
  T({ rank: 0, percent: 25, bytes: { a: '1' } }, { rank: 0, percent: 25, bytes: { a: '2' } }) && !T({ rank: 0, percent: 25, bytes: { a: '1' } }, { rank: 0, percent: 25, bytes: { a: '1' } }), 'any rise or trust byte change is caught');

// 8. Undo from a write-ahead record (Hypha HOLD H1).
const U = function (e, now) { return call('undoLsStep', e, now); };
assert.strictEqual(U({ k: 'a', before: null, after: 'new' }, 'new'), 'remove', 'an added key is removed');
assert.strictEqual(U({ k: 'fl_refusalLedger', before: '[1]', after: '[1,2]' }, '[1,2]'), 'restore', 'a joined ledger gets its old value back');
assert.strictEqual(U({ k: 'a', before: null, after: 'new' }, null), 'already', 'a write that never happened needs nothing');
assert.strictEqual(U({ k: 'a', before: 'old', after: 'new' }, 'old'), 'already', 'a write that never happened needs nothing');
assert.strictEqual(U({ k: 'a', before: null, after: 'new' }, 'mine-now'), 'keep-changed', 'a key you changed stays');
const W = function (e, now) { return call('undoRowStep', e, now); };
assert.strictEqual(W({ state: 'added', canon: 'x' }, 'x'), 'delete', 'an arrived row goes');
assert.strictEqual(W({ state: 'planned', canon: 'x' }, 'x'), 'delete', 'a row written before a stop goes too');
assert.strictEqual(W({ state: 'added', canon: 'x' }, 'y'), 'keep-changed', 'a row you changed stays');
assert.strictEqual(W({ state: 'not-added', canon: 'x' }, 'x'), 'already', 'a row that was not added is never touched');
assert.strictEqual(W({ state: 'added', canon: 'x' }, null), 'already', 'gone already');
const V = call('verifyUndo', [{ k: 'a', before: null, now: null }, { k: 'b', before: 'old', now: 'old' }], [{ where: 'db / s', key: 1, there: false }]);
assert.deepStrictEqual(V, { clean: true, left: [] }, 'clean only when everything is back');
const V2 = call('verifyUndo', [{ k: 'fl_theme', before: null, now: 'mine-now', kept: true }, { k: 'fl_clay_mind1', before: null, now: 'x' }], [{ where: 'db / s', key: 'lum-2', there: true, kept: true }]);
assert.strictEqual(V2.clean, false, 'not clean when anything is left');
assert.deepStrictEqual(V2.left.map(function (x) { return [x.where, x.changed]; }), [['fl_theme', true], ['fl_clay_mind1', false], ['db / s', true]], 'and each thing left is named');

// 9. Key shapes.
assert.ok(call('hasKnownKey', 'see sk-abcdefabcdefabcdef1234') && !call('hasKnownKey', 'desk-abcdefabcdefabcdef1234') && !call('hasKnownKey', 'sk-short'), 'key shapes on a word edge');
assert.deepStrictEqual(call('hideKnownKeys', 'a ghp_abcdefabcdefabcdef1234 b', '[kept on this device]'), { text: 'a [kept on this device] b', n: 1 }, 'hidden and counted');
assert.strictEqual(call('canonicalize', { b: 1, a: [2, { d: 3, c: 4 }] }), '{"a":[2,{"c":4,"d":3}],"b":1}', 'key-sorted JSON');

// 10. The bring-home module: what it may write, and in what order (read as text).
[/\bfetch\s*\(/, /XMLHttpRequest/, /WebSocket/, /sendBeacon/, /EventSource/, /importScripts/, /\beval\s*\(/, /new Function\s*\(/,
  /postMessage\s*\(/, /\.cookie\b/, /deleteDatabase/, /\.clear\(/].forEach(function (re) { assert.ok(!re.test(code), 'home must not use ' + re); });
assert.deepStrictEqual(code.match(/\.put\(/g), ['.put('], 'one put() only');
assert.ok(/function homePut\(db, store, value\) \{[\s\S]{0,260}tx\.objectStore\(store\)\.put\(value\)/.test(code), 'that put is homePut');
(code.match(/homePut\([^,]+, '[^']+'/g) || []).forEach(function (c) { assert.ok(/^homePut\(home, '(imports|before|conflicts|aside)'$/.test(c), 'homePut writes only its own stores: ' + c); });
assert.strictEqual((code.match(/createObjectStore\(/g) || []).length, 4, 'only its own four stores are made');
assert.ok(/var req = root\.indexedDB\.open\(HOME_DB, HOME_DB_V\);/.test(code) && (code.match(/indexedDB\.open\(/g) || []).length === 1, 'only FreeLatticeMoveKit is ever created');
assert.ok(/st\.add\(val\.v, decode\(a\.row\.k, flags\)\) : st\.add\(val\)/.test(code), 'rows are added, never put over');
assert.ok(/failure = e; try \{ tx\.abort\(\); \} catch \(_\) \{\} return;/.test(code) && /reject\(failure \|\| tx\.error/.test(code), 'a row the store refuses stops and takes back the bring-home');
assert.ok(/out\.canRetry = v\.left\.some\(function \(x\) \{ return !x\.changed; \}\);/.test(code) && /if \(out\.canRetry\) \{/.test(code), 'Undo stays open while something it can fix is left');
assert.ok(/ev\.isTrusted === false \|\| !text\) return;/.test(code) && /if \(!ev \|\| ev\.isTrusted === false\) return;\s*undo\.disabled = true;/.test(code), 'only a real tap brings home or undoes');
['R.lsDecision(', 'R.rowDecision(', 'R.dbDisposition(', 'R.sectionDisposition(', 'R.undoLsStep(', 'R.undoRowStep(', 'R.verifyUndo(', 'R.trustRose(', 'R.pauseAfter(', 'R.arrivalLine(']
  .forEach(function (s) { assert.ok(code.indexOf(s) !== -1, 'home uses the rules file: ' + s); });
const bh = code.slice(code.indexOf('function bringHome('), code.indexOf('function lastImport('));
const order = ["readKit(text)", "root.FLGardenMoveKit.pack({ download: false, now: now })", "return openHome(true);", "homePut(home, 'before'",
  "homeGet(home, 'before', importId)", "if (h[0] !== h[1]) throw new Error('read back differs');", "downloadText(backupText, result.backup.name)",
  "return homePut(home, 'imports', record).then(function () { writing = true;", "return addRows(item)", "lsSet(e.k, e.after);",
  "lsSet(R.PAUSE_KEY, 'true')", "lsSet(R.ARRIVALS_KEY"].map(function (s) { const i = bh.indexOf(s); assert.ok(i !== -1, 'bring home has: ' + s); return i; });
order.forEach(function (i, n) { if (n) assert.ok(order[n - 1] < i, 'bring home order, step ' + n); });
assert.ok(/result\.problems = \['A safety copy could not be kept and checked on this device, so nothing was brought home/.test(bh), 'no checked safety copy, no bring-home (soft S-a)');
assert.ok(/if \(lsGet\(e\.k\) !== e\.before\) \{ e\.skipped = 'changed-before-write'; return; \}/.test(bh), 'a key changed since the plan is not touched');
assert.ok(/record\.pause_set = true;\s*return homePut\(home, 'imports', record\)\.then\(function \(\) \{ lsSet\(R\.PAUSE_KEY, 'true'\); \}\);/.test(bh), 'pause is recorded before it is written');
assert.ok(/if \(!writing\) \{[\s\S]{0,200}\}\s*return undoImport\(importId, \{ reason: 'write-failed' \}\)/.test(bh), 'a stop part-way takes everything back at once');
assert.ok(/if \(R\.trustRose\(trustBefore, after\)\) \{[\s\S]{0,200}undoImport\(importId, \{ reason: 'trust-would-rise' \}\)/.test(bh), 'a rise in trust is taken back at once');
const ud = code.slice(code.indexOf('function undoImport('), code.indexOf('function undoLast('));
assert.ok(ud.indexOf('PAUSE_KEY') === -1 && (code.match(/PAUSE_KEY/g) || []).length === 2 && (code.match(/lsSet\(R\.PAUSE_KEY, 'true'\)/g) || []).length === 1, 'pause is only ever set, never cleared, and undo never touches it');
assert.ok(/if \(e\.state === 'auto'\) return 'keep-changed';/.test(ud), 'a row whose key this browser chose is never deleted on a guess');
assert.ok(/out\.verified = v\.clean; out\.left = v\.left;/.test(ud), 'undo checks its own work');
assert.ok(/\(u\.verified \? 'Taken back\. Your garden is as it was before\.' : 'Taken back, except for this\. ' \+ leftWords\(u\)\)/.test(code), '"as it was before" only when it is true');
assert.ok(/\(u\.verified \? ' Your garden is as it was before\.' : ' ' \+ leftWords\(u\)\)/.test(bh), 'the same after a stop part-way');
assert.ok(/A checked safety copy is kept on this device' \+ \(r\.backup\.offered \?/.test(code), 'the safety copy words say only what was checked');
assert.ok(/function setOwn\(o, k, v\) \{/.test(code) && (code.match(/setOwn\(o, k,/g) || []).length >= 4, 'no prototype is ever written (soft S-b)');
assert.ok((code.match(/sections: Object\.create\(null\)/g) || []).length === 2 && /var have = Object\.create\(null\), haveHidden = Object\.create\(null\);/.test(code), 'lookups have no prototype');
assert.ok(/They cannot show who made it/.test(code), 'fingerprints are said to check damage, not who made the file (soft S-e)');

// 11. The pages.
const scripts = (homePage.match(/<script\b[^>]*>/g) || []);
assert.deepStrictEqual(scripts, ['<script src="modules/lattice-export.js">', '<script src="modules/garden-move-kit.js">', '<script src="modules/garden-move-merge.js">', '<script src="modules/garden-move-home.js">'], 'only the four scripts load');
assert.ok(!/<script>[\s\S]*?<\/script>/.test(homePage), 'no inline script');
assert.ok(/<meta name="viewport" content="width=device-width, initial-scale=1/.test(homePage), 'viewport');
assert.ok(/<button id="gmh-bring" class="gmh-big" type="button" disabled>Bring it home<\/button>/.test(homePage), 'one big button');
assert.ok(/\.gmh-big \{[\s\S]*?min-height: 64px;/.test(homePage) && /\.gmh-undo \{[^}]*min-height: 56px;/.test(homePage), 'big targets');
assert.ok(homePage.indexOf('<div id="gmh-notes">') > 0 && homePage.indexOf('<div id="gmh-notes">') < homePage.indexOf('id="gmh-bring"'), 'notes sit just above the button');
assert.ok(/neither do the other device&rsquo;s ids/.test(homePage) && /made, checked, kept here and offered to your downloads/.test(homePage), 'the page says only what is true (H2, S-a)');
assert.ok(/<a href="move-home\.html">Bring my garden home<\/a>/.test(page), 'move.html has the door');

// 12. The note.
['## What', '## Why', '## Rollback', '## Smoke', 'v-garden-move-kit-2', 'fl_move_arrivals', 'FreeLatticeMoveKit', 'garden-move-merge.js', 'write-ahead', 'allow-list']
  .forEach(function (s) { assert.ok(note.indexOf(s) !== -1, 'note has ' + s); });

console.log('SMOKE_OK garden move kit 2');
