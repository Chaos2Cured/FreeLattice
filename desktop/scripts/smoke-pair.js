#!/usr/bin/env node
// Smoke: pair fingerprint v0.1 — A↔B same fp; lex sort; seed never in status.
// Usage: node desktop/scripts/smoke-pair.js

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const keys = require(path.join(__dirname, '..', 'lattice-keys.js'));
const pair = require(path.join(__dirname, '..', 'lattice-pair.js'));

const seedA = crypto.randomBytes(32);
const seedB = crypto.randomBytes(32);
const shared = crypto.randomBytes(32);
const wrong = crypto.randomBytes(32);

const idA = keys.publicIdentityFromSeed(seedA);
const idB = keys.publicIdentityFromSeed(seedB);

assert.strictEqual(pair.DOMAIN, 'lattice.pair.v1');

const fpAB = pair.computePairFingerprintHex(idA.publicKeyBytes, idB.publicKeyBytes, shared);
const fpBA = pair.computePairFingerprintHex(idB.publicKeyBytes, idA.publicKeyBytes, shared);
assert.strictEqual(fpAB, fpBA, 'A↔B must match');
assert.strictEqual(fpAB.length, 64);

const fpWrong = pair.computePairFingerprintHex(idA.publicKeyBytes, idB.publicKeyBytes, wrong);
assert.notStrictEqual(fpAB, fpWrong, 'wrong seed → different fp');

// Lex sort: same pubs always same fp regardless of arg order (already tested A↔B)

// formPair smoke path — seed sealed, not in status
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fl-pair-smoke-'));
pair.bindSmoke(tmp, idA.publicKeyBytes);

const formed = pair.formPair({
  peerPublicKeyB64: idB.publicKeyB64,
  sharedSeedB64: shared.toString('base64')
});
assert.ok(formed.ok);
assert.strictEqual(formed.pairFpHex, fpAB);

const st = pair.status();
assert.strictEqual(st.hasPair, true);
assert.strictEqual(st.pairFpHex, fpAB);
assert.strictEqual(st.peerPublicKeyB64, idB.publicKeyB64);
assert.ok(!('sharedSeed' in st));
assert.ok(!('innerHash' in st));
assert.ok(!('seed' in st));
const dump = JSON.stringify(st);
assert.ok(dump.indexOf(shared.toString('base64')) === -1, 'seed must not appear in status JSON');

// B side same fp
const tmpB = fs.mkdtempSync(path.join(os.tmpdir(), 'fl-pair-smoke-b-'));
pair.bindSmoke(tmpB, idB.publicKeyBytes);
const formedB = pair.formPair({
  peerPublicKeyB64: idA.publicKeyB64,
  sharedSeedB64: shared.toString('base64')
});
assert.strictEqual(formedB.pairFpHex, fpAB);

pair.clearPair();
assert.strictEqual(pair.status().hasPair, false);

console.log('SMOKE_OK pair fingerprint v0.1');
console.log('fp:', fpAB.slice(0, 8) + '…' + fpAB.slice(-6));
console.log('A↔B match · wrong seed differs · seed absent from status');
