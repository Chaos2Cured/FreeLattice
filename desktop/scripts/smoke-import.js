#!/usr/bin/env node
// Smoke: hash path required; HTTPS gate; Ollama absent → clean refuse.
// Usage: node desktop/scripts/smoke-import.js

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const imp = require(path.join(__dirname, '..', 'lattice-import.js'));

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fl-import-smoke-'));
imp.bindSmoke(tmp);

const fixturePath = path.join(__dirname, '..', '..', 'docs', 'models', 'fixture-verify-only.txt');
const fixtureBuf = fs.readFileSync(fixturePath);
const expected = imp.sha256Buffer(fixtureBuf);
assert.strictEqual(
  expected,
  '5b1d0ba7fd635d56cb9f32b5f53cf7034d51b3054a8bb0b7eac26448b85d0af4'
);

// HTTPS only
var httpsRefused = false;
try {
  imp.assertHttpsUrl('http://example.com/x');
} catch (e) {
  httpsRefused = /HTTPS only/i.test(String(e.message || e));
}
assert.ok(httpsRefused, 'http must refuse');

var zeroRefused = false;
try {
  imp.ingestAndVerify(fixtureBuf, '0000000000000000000000000000000000000000000000000000000000000000', 'example');
} catch (e) {
  zeroRefused = /zero-hash|EXAMPLE|refuse/i.test(String(e.message || e));
}
assert.ok(zeroRefused, 'zero-hash must refuse');

assert.strictEqual(imp.isExampleRow({ notes: 'EXAMPLE ONLY', sha256: 'abc' }), true);
assert.strictEqual(
  imp.isExampleRow({
    notes: 'FIXTURE',
    sha256: expected,
    redistributable: true
  }),
  false
);

// Match → verified/
const ok = imp.ingestAndVerify(fixtureBuf, expected, 'fixture.verify-only');
assert.strictEqual(ok.ok, true);
assert.strictEqual(ok.matched, true);
assert.strictEqual(ok.verified, true);
assert.ok(fs.existsSync(path.join(tmp, 'verified', ok.verifiedBase)));

const st = imp.status();
assert.ok(st.verifiedCount >= 1);
assert.strictEqual(st.autoImport, false);

// Mismatch → quarantined; will not import
const bad = imp.ingestAndVerify(Buffer.from('tampered-bytes'), expected, 'fixture.bad');
assert.strictEqual(bad.ok, false);
assert.strictEqual(bad.matched, false);
assert.strictEqual(bad.quarantined, true);
assert.strictEqual(bad.willNotImport, true);
assert.ok(st.quarantineCount >= 0);
assert.ok(imp.status().quarantineCount >= 1);

// Ollama absent → clean refuse (do not throw)
imp.importToOllama({ id: 'fixture.verify-only', name: 'fixture-verify-only' }).then(function (res) {
  assert.strictEqual(res.imported, false);
  assert.ok(/ollama absent|ollama refused|not verified/i.test(String(res.reason || '')));
  console.log('SMOKE_OK verified HTTPS import v0.1');
  console.log('hash match → verified/; mismatch quarantined; ollama:', res.reason);
  console.log('tmp:', tmp);
}).catch(function (e) {
  console.error('SMOKE_FAIL', e);
  process.exit(1);
});
