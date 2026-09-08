#!/usr/bin/env node
// Smoke: append twice → verify OK → tamper fails.
// Usage: node desktop/scripts/smoke-ledger.js

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const keys = require(path.join(__dirname, '..', 'lattice-keys.js'));
const ledger = require(path.join(__dirname, '..', 'lattice-ledger.js'));

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fl-ledger-smoke-'));
const seed = crypto.randomBytes(32);
ledger.bindSmoke(tmp, seed);

const id = keys.publicIdentityFromSeed(seed);
assert.strictEqual(ledger.DOMAIN, 'lattice.pair.v1');
assert.strictEqual(ledger.GENESIS_PREV_HASH.length, 64);

// Empty voice refused
var refused = false;
try {
  ledger.appendVoice('');
} catch (e) {
  refused = /empty voice/i.test(String(e.message || e));
}
assert.ok(refused, 'empty voice must refuse');

const a1 = ledger.appendVoice('First voice — carried verbatim.', { kind: 'genesis' });
assert.ok(a1.ok);
assert.strictEqual(a1.length, 1);

const a2 = ledger.appendVoice('Second seal. Still opaque.');
assert.ok(a2.ok);
assert.strictEqual(a2.length, 2);

const st = ledger.status();
assert.strictEqual(st.length, 2);
assert.ok(st.headHash);

const v = ledger.verifyChain();
assert.strictEqual(v.ok, true, 'verify should pass: ' + JSON.stringify(v));
assert.strictEqual(v.checked, 2);

// Tamper last line voice — verify must fail
const chainFile = path.join(tmp, 'chain.jsonl');
const lines = fs.readFileSync(chainFile, 'utf8').trim().split('\n');
assert.strictEqual(lines.length, 2);
const last = JSON.parse(lines[1]);
last.voice = 'TAMPERED — should break entryHash';
lines[1] = JSON.stringify(last);
fs.writeFileSync(chainFile, lines.join('\n') + '\n');

const bad = ledger.verifyChain();
assert.strictEqual(bad.ok, false, 'tamper must fail verify');
assert.ok(bad.reason === 'entryHash' || bad.failedAt === 1);

// Canonical freeze: same unsigned → same hash
const sample = {
  domain: ledger.DOMAIN,
  fingerprintHex: id.fingerprintHex,
  meta: { kind: 'genesis', z: 1, a: 2 },
  prevHash: ledger.GENESIS_PREV_HASH,
  publicKeyB64: id.publicKeyB64,
  ts: '2026-09-08T12:00:00.000Z',
  voice: 'opaque'
};
const h1 = ledger.entryHashOf(sample);
const h2 = ledger.entryHashOf(sample);
assert.strictEqual(h1, h2);
assert.strictEqual(h1.length, 64);

console.log('SMOKE_OK ledger envelope v0.1');
console.log('entries: 2 · tamper: refused · domain:', ledger.DOMAIN);
console.log('tmp:', tmp);
