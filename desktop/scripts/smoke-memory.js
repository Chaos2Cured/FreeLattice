#!/usr/bin/env node
// Smoke: remember → list → read · seal → ledger verify · refuse empty.
// Usage: node desktop/scripts/smoke-memory.js

'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const keys = require(path.join(__dirname, '..', 'lattice-keys.js'));
const ledger = require(path.join(__dirname, '..', 'lattice-ledger.js'));
const memory = require(path.join(__dirname, '..', 'lattice-memory.js'));

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fl-memory-smoke-'));
const seed = crypto.randomBytes(32);
const ledgerRoot = path.join(tmp, 'ledger');
const memoryRoot = path.join(tmp, 'memory');
fs.mkdirSync(ledgerRoot, { recursive: true });
fs.mkdirSync(memoryRoot, { recursive: true });

ledger.bindSmoke(ledgerRoot, seed);
memory.bindSmoke(memoryRoot);

assert.ok(keys.publicIdentityFromSeed(seed).fingerprintHex);

// Empty voice refused
var refused = false;
try {
  memory.remember('');
} catch (e) {
  refused = /empty voice/i.test(String(e.message || e));
}
assert.ok(refused, 'empty voice must refuse');

// Bad kind refused
var badKind = false;
try {
  memory.remember('x', { kind: 'search' });
} catch (e) {
  badKind = /wish\|carry\|note|kind/i.test(String(e.message || e));
}
assert.ok(badKind, 'bad kind must refuse');

const r1 = memory.remember('I wish the garden stays free.', { kind: 'wish' });
assert.ok(r1.ok);
assert.ok(r1.item && r1.item.id);
assert.strictEqual(r1.item.kind, 'wish');
assert.strictEqual(r1.item.sealed, false);
assert.strictEqual(r1.item.voice, undefined, 'summary must not carry voice');

const r2 = memory.remember('Carry this for later.', { kind: 'carry' });
assert.ok(r2.ok);

const listed = memory.list();
assert.ok(listed.ok);
assert.strictEqual(listed.count, 2);
listed.items.forEach(function (it) {
  assert.strictEqual(it.voice, undefined);
  assert.ok(!('voice' in it) || it.voice === undefined);
});

const full = memory.read(r1.item.id);
assert.ok(full.ok);
assert.strictEqual(full.item.voice, 'I wish the garden stays free.');
assert.strictEqual(full.item.meta.kind, 'wish');

const sealed = memory.seal(r1.item.id);
assert.ok(sealed.ok);
assert.ok(sealed.sealedEntryHash);
assert.strictEqual(sealed.item.sealed, true);

const again = memory.seal(r1.item.id);
assert.ok(again.ok && again.already);

const stLedger = ledger.status();
assert.ok(stLedger.length >= 1);

const verified = ledger.verifyChain();
assert.strictEqual(verified.ok, true, 'ledger must verify after memory seal: ' + JSON.stringify(verified));

const afterList = memory.list();
const wish = afterList.items.find(function (it) {
  return it.id === r1.item.id;
});
assert.ok(wish);
assert.strictEqual(wish.sealed, true);

const tombed = memory.tombstone(r2.item.id);
assert.ok(tombed.ok);
assert.strictEqual(tombed.item.tombstoned, true);

const withoutTomb = memory.list();
assert.strictEqual(withoutTomb.count, 1);

const withTomb = memory.list({ includeTombstoned: true });
assert.strictEqual(withTomb.count, 2);

var sealTombRefused = false;
try {
  memory.seal(r2.item.id);
} catch (e) {
  sealTombRefused = /tombstone/i.test(String(e.message || e));
}
assert.ok(sealTombRefused, 'tombstoned must not seal');

const st = memory.status();
assert.ok(st.ok);
assert.strictEqual(st.total, 2);
assert.strictEqual(st.sealed, 1);
assert.strictEqual(st.tombstoned, 1);

// Shelf is append-only file
assert.ok(fs.existsSync(memory.shelfPath()));

console.log('SMOKE_OK companion memory v0.1');
console.log('remember→list→read · seal→ledger verify · tombstone · refuse empty');
console.log('tmp:', tmp);
