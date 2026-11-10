#!/usr/bin/env node
// smoke-ledger-pinned.js (MIT) v-ai-chosen-learning-v0.1, Weft re-check 2026-11-09
// Node only, temp folders only. The desktop's ledger check (main.js lattice-ledger-verify) is pinned to this
// companion's own key: a chain re-signed wholesale under another key fails; a key a person listed passes.
var fs = require('fs');
var os = require('os');
var path = require('path');
var crypto = require('crypto');
var assert = require('assert');
var ledger = require('../lattice-ledger');

var passed = 0;
function ok(cond, name) { assert.ok(cond, name); passed += 1; console.log('ok   ' + name); }

var A = fs.mkdtempSync(path.join(os.tmpdir(), 'fl-ledger-pin-a-'));
var B = fs.mkdtempSync(path.join(os.tmpdir(), 'fl-ledger-pin-b-'));
var seedA = crypto.randomBytes(32), seedB = crypto.randomBytes(32);

ledger.bindSmoke(B, seedB);
ledger.appendVoice('one'); ledger.appendVoice('two');
var keysB = ledger.ownPinnedKeys();
ledger.bindSmoke(A, seedA);
ledger.appendVoice('one'); ledger.appendVoice('two');
var keysA = ledger.ownPinnedKeys();
ok(keysA.length === 1 && keysB.length === 1 && keysA[0] !== keysB[0], 'each companion pins its own key');
ok(ledger.verifyChain({ pinnedKeys: keysA }).ok === true, 'its own chain verifies under its own key');

fs.copyFileSync(path.join(B, 'chain.jsonl'), path.join(A, 'chain.jsonl'));          // a whole chain, re-signed by another key
ok(ledger.verifyChain().ok === true, 'unpinned, a wholesale re-signed chain would pass (why main.js pins)');
var v = ledger.verifyChain({ pinnedKeys: ledger.ownPinnedKeys() });
ok(v.ok === false && v.reason === 'key-not-pinned' && v.failedAt === 0, 'pinned, the re-signed chain fails: key-not-pinned');

fs.writeFileSync(path.join(A, 'pinned-keys.json'), JSON.stringify({ keys: keysB }));
ok(ledger.verifyChain({ pinnedKeys: ledger.ownPinnedKeys() }).ok === true, 'a key a person listed in pinned-keys.json is trusted');

var main = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
ok(main.indexOf('latticeLedger.verifyChain({ pinnedKeys: latticeLedger.ownPinnedKeys() })') !== -1, 'main.js lattice-ledger-verify passes pinnedKeys');

console.log('checks ' + passed);
console.log('SMOKE_OK desktop ledger pinned v0.1');
