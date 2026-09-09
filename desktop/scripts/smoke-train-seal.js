#!/usr/bin/env node
// Smoke: hash Modelfile/JSONL → training_seal → ledger verify.
// Usage: node desktop/scripts/smoke-train-seal.js

'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const keys = require(path.join(__dirname, '..', 'lattice-keys.js'));
const ledger = require(path.join(__dirname, '..', 'lattice-ledger.js'));
const trainSeal = require(path.join(__dirname, '..', 'lattice-train-seal.js'));

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fl-train-seal-smoke-'));
const seed = crypto.randomBytes(32);
const ledgerRoot = path.join(tmp, 'ledger');
fs.mkdirSync(ledgerRoot, { recursive: true });

ledger.bindSmoke(ledgerRoot, seed);
trainSeal.bindSmoke(tmp);

const id = keys.publicIdentityFromSeed(seed);
assert.ok(id.fingerprintHex);

const modelfile = [
  'FROM llama3.2',
  '',
  'SYSTEM """',
  'Garden personality — smoke fixture.',
  '"""',
  ''
].join('\n');

// Empty artifact refused
var emptyRefused = false;
try {
  trainSeal.sealTraining({
    artifactBytesOrPath: '',
    baseModel: 'llama3.2',
    outName: 'Modelfile',
    companionFpHex: id.fingerprintHex
  });
} catch (e) {
  emptyRefused = /empty artifact|refuse/i.test(String(e.message || e));
}
assert.ok(emptyRefused, 'empty artifact must refuse');

// Missing companion refused
var noKeyRefused = false;
try {
  trainSeal.sealTraining({
    artifactBytesOrPath: modelfile,
    baseModel: 'llama3.2',
    outName: 'Modelfile'
  });
} catch (e) {
  noKeyRefused = /companion key|refuse/i.test(String(e.message || e));
}
assert.ok(noKeyRefused, 'no companion key must refuse');

const expectedHash = trainSeal.sha256Bytes(Buffer.from(modelfile, 'utf8'));

const sealed = trainSeal.sealTraining({
  voice: 'Why I trained — smoke.',
  baseModel: 'llama3.2',
  outName: 'Modelfile',
  artifactBytesOrPath: modelfile,
  companionFpHex: id.fingerprintHex
});
assert.ok(sealed.ok);
assert.strictEqual(sealed.metaKind, 'training_seal');
assert.strictEqual(sealed.artifactSha256, expectedHash);
assert.strictEqual(sealed.companionFpHex, id.fingerprintHex.toLowerCase());
assert.ok(sealed.entryHash);

const verified = ledger.verifyChain();
assert.strictEqual(verified.ok, true, JSON.stringify(verified));
assert.ok(verified.length >= 1);

// Path-based JSONL
const jsonlPath = path.join(tmp, 'fixture.jsonl');
const jsonl = JSON.stringify({ instruction: 'hi', output: 'hello' }) + '\n';
fs.writeFileSync(jsonlPath, jsonl);
const sealed2 = trainSeal.sealTraining({
  baseModel: 'llama3.2',
  outName: 'fixture.jsonl',
  artifactBytesOrPath: jsonlPath,
  companionFpHex: id.fingerprintHex,
  pairOuterHex: 'a'.repeat(64)
});
assert.ok(sealed2.ok);
assert.strictEqual(sealed2.pairOuterHex, 'a'.repeat(64));
assert.strictEqual(sealed2.artifactSha256, trainSeal.sha256Bytes(Buffer.from(jsonl, 'utf8')));

const verified2 = ledger.verifyChain();
assert.strictEqual(verified2.ok, true);
assert.strictEqual(verified2.length, 2);

// Default voice when omitted
const sealed3 = trainSeal.sealTraining({
  baseModel: 'llama3.2',
  outName: 'Modelfile-2',
  artifactBytesOrPath: modelfile + '\n# again\n',
  companionFpHex: id.fingerprintHex
});
assert.ok(sealed3.ok);

console.log('SMOKE_OK trainer seal v0.1');
console.log('hash Modelfile/JSONL → training_seal → ledger verify · refuse empty');
console.log('tmp:', tmp);
