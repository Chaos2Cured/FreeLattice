#!/usr/bin/env node
// Smoke: derive → sign → verify companion identity v0.1 (no Electron, no seed export).
// Usage: node desktop/scripts/smoke-identity.js

const assert = require('assert');
const crypto = require('crypto');
const path = require('path');

const keys = require(path.join(__dirname, '..', 'lattice-keys.js'));

const seed = crypto.randomBytes(32);
const identity = keys.publicIdentityFromSeed(seed);

assert.strictEqual(keys.DOMAIN, 'lattice.pair.v1');
assert.strictEqual(identity.publicKeyBytes.length, 32);
assert.strictEqual(identity.fingerprintHex.length, 64);
assert.strictEqual(
  identity.fingerprintHex,
  keys.companionFingerprint(identity.publicKeyBytes)
);

// Domain binding: different domain bytes must not match frozen fingerprint
const wrongDomainFp = crypto
  .createHash('sha256')
  .update(Buffer.from('lattice.pair.v0', 'utf8'))
  .update(Buffer.from([0x00]))
  .update(identity.publicKeyBytes)
  .digest('hex');
assert.notStrictEqual(wrongDomainFp, identity.fingerprintHex);

const payload = Buffer.from('FreeLattice companion identity smoke', 'utf8');
const signed = keys.signWithSeed(seed, payload);
assert.ok(signed.signatureB64);
assert.strictEqual(signed.publicKeyB64, identity.publicKeyB64);
assert.strictEqual(signed.fingerprintHex, identity.fingerprintHex);
assert.strictEqual(signed.signature.length, 64);

assert.strictEqual(
  keys.verifySignature(signed.publicKeyB64, payload, signed.signatureB64),
  true
);
assert.strictEqual(
  keys.verifySignature(signed.publicKeyB64, Buffer.from('tampered'), signed.signatureB64),
  false
);

// Deterministic: same seed → same public + fingerprint
const again = keys.publicIdentityFromSeed(seed);
assert.strictEqual(again.fingerprintHex, identity.fingerprintHex);
assert.strictEqual(again.publicKeyB64, identity.publicKeyB64);

console.log('SMOKE_OK companion identity v0.1');
console.log('domain:', keys.DOMAIN);
console.log('fingerprint:', identity.fingerprintHex.slice(0, 8) + '…' + identity.fingerprintHex.slice(-6));
console.log('publicKeyB64 length:', identity.publicKeyB64.length);
