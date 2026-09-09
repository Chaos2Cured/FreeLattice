#!/usr/bin/env node
// Smoke: re-seed start/stop with fixture verified file.
// Usage: node desktop/scripts/smoke-reseed.js

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const latticeImport = require(path.join(__dirname, '..', 'lattice-import.js'));
const swarm = require(path.join(__dirname, '..', 'lattice-swarm.js'));

async function main() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fl-reseed-smoke-'));
  swarm.bindSmoke(tmp);

  const fixturePath = path.join(__dirname, '..', '..', 'docs', 'models', 'fixture-verify-only.txt');
  const buf = fs.readFileSync(fixturePath);
  const expected = latticeImport.sha256Buffer(buf);

  // Must verify first
  const ingested = latticeImport.ingestAndVerify(buf, expected, 'fixture.verify-only');
  assert.strictEqual(ingested.matched, true);

  // Refuse EXAMPLE / zero-hash
  var zeroRefused = false;
  try {
    await swarm.startReseed({
      id: 'fixture.verify-only',
      redistributable: true,
      expectedSha256: '0'.repeat(64),
      notes: 'EXAMPLE ONLY'
    });
  } catch (e) {
    zeroRefused = /EXAMPLE|zero-hash|refuse/i.test(String(e.message || e));
  }
  assert.ok(zeroRefused);

  // Refuse non-redistributable
  var propRefused = false;
  try {
    await swarm.startReseed({
      id: 'fixture.verify-only',
      redistributable: false,
      expectedSha256: expected
    });
  } catch (e) {
    propRefused = /non-redistributable|refuse/i.test(String(e.message || e));
  }
  assert.ok(propRefused);

  const wt = await swarm.ensureWebTorrent();
  assert.ok(wt, 'webtorrent required for reseed smoke');

  const started = await swarm.startReseed({
    id: 'fixture.verify-only',
    name: 'fixture-verify-only',
    redistributable: true,
    expectedSha256: expected,
    notes: 'FIXTURE'
  });
  assert.strictEqual(started.ok, true, JSON.stringify(started));
  assert.ok(started.reseed);
  assert.strictEqual(started.reseed.state, 'seeding');
  assert.ok(started.reseed.infoHash || started.reseed.magnetURI);

  // No private paths in public status
  const st = swarm.status('fixture.verify-only');
  const dump = JSON.stringify(st);
  assert.ok(dump.indexOf(tmp) === -1, 'tmp path must not leak');
  assert.ok(!/verified\//.test(dump) || dump.indexOf(path.join(tmp, 'verified')) === -1);

  const stopped = await swarm.stopReseed('fixture.verify-only');
  assert.strictEqual(stopped.ok, true);
  assert.strictEqual(stopped.stopped, true);
  assert.strictEqual(swarm.reseeds.has('fixture.verify-only'), false);

  swarm.destroyClient();
  console.log('SMOKE_OK swarm re-seed v0.1');
  console.log('start→seeding→stop · refuse EXAMPLE/non-redistributable · no path leak');
}

main().catch(function (e) {
  console.error('SMOKE_FAIL', e);
  process.exit(1);
});
