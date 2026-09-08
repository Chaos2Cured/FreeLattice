#!/usr/bin/env node
// Smoke: swarm → existing hash path.
// Automated: mock completeWithBuffer + local HTTP webseed + cancel.
// Live DHT/magnet optional — not required for SMOKE_OK.
// Usage: node desktop/scripts/smoke-swarm.js

const assert = require('assert');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

const swarm = require(path.join(__dirname, '..', 'lattice-swarm.js'));
const latticeImport = require(path.join(__dirname, '..', 'lattice-import.js'));

async function main() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fl-swarm-smoke-'));
  swarm.bindSmoke(tmp);

  const fixturePath = path.join(__dirname, '..', '..', 'docs', 'models', 'fixture-verify-only.txt');
  const fixtureBuf = fs.readFileSync(fixturePath);
  const expected = latticeImport.sha256Buffer(fixtureBuf);
  assert.strictEqual(expected, '5b1d0ba7fd635d56cb9f32b5f53cf7034d51b3054a8bb0b7eac26448b85d0af4');

  // file:// refused
  var fileRefused = false;
  try {
    swarm.assertAllowedSource('', 'file:///tmp/x');
  } catch (e) {
    fileRefused = true;
  }
  assert.ok(fileRefused, 'file:// must refuse');

  // zero-hash refused
  var zeroRefused = false;
  try {
    await swarm.startFetch({
      webseedUrl: 'https://freelattice.com/models/fixture-verify-only.txt',
      expectedSha256: '0'.repeat(64),
      id: 'example.zero'
    });
  } catch (e) {
    zeroRefused = /zero-hash|EXAMPLE|refuse/i.test(String(e.message || e));
  }
  assert.ok(zeroRefused, 'zero-hash must refuse swarm');

  // Cancel does not crash
  const c1 = await swarm.startFetch({
    webseedUrl: 'https://example.com/slow',
    expectedSha256: expected,
    id: 'cancel-me'
  });
  const cancelled = swarm.cancel(c1.job.id);
  assert.ok(cancelled.ok && cancelled.cancelled);

  // complete after cancel fails cleanly
  var afterCancelFailed = false;
  try {
    swarm.completeWithBuffer(c1.job.id, fixtureBuf);
  } catch (e) {
    afterCancelFailed = /cancel/i.test(String(e.message || e));
  }
  assert.ok(afterCancelFailed);

  // Mock download-complete → hash handoff (required)
  const h = await swarm.startFetch({
    webseedUrl: 'https://example.com/placeholder',
    expectedSha256: expected,
    id: 'fixture.verify-only',
    name: 'fixture-verify-only'
  });
  const hj = swarm.jobs.get(h.job.id);
  if (hj.abortRef) hj.abortRef.aborted = true;
  if (hj.abortRef && hj.abortRef.req) {
    try {
      hj.abortRef.req.destroy();
    } catch (e) {
      /* ignore */
    }
  }
  hj.state = 'downloading';
  const done = swarm.completeWithBuffer(h.job.id, fixtureBuf);
  assert.strictEqual(done.matched, true);
  assert.strictEqual(done.verified, true);
  assert.strictEqual(done.state, 'verified');

  // Local HTTP webseed → real pull → hash
  await new Promise(function (resolve, reject) {
    const server = http.createServer(function (req, res) {
      res.writeHead(200, {
        'Content-Type': 'text/plain',
        'Content-Length': fixtureBuf.length
      });
      res.end(fixtureBuf);
    });
    server.listen(0, '127.0.0.1', async function () {
      try {
        const port = server.address().port;
        const url = 'http://127.0.0.1:' + port + '/fixture-verify-only.txt';
        const pull = await swarm.startFetch({
          webseedUrl: url,
          expectedSha256: expected,
          id: 'fixture.local-webseed',
          name: 'fixture-local-webseed'
        });
        const finished = await swarm.waitJob(pull.job.id, 30000);
        assert.strictEqual(finished.matched, true, JSON.stringify(finished));
        assert.strictEqual(finished.verified, true);
        server.close();
        resolve();
      } catch (e) {
        try {
          server.close();
        } catch (e2) {
          /* ignore */
        }
        reject(e);
      }
    });
  });

  // Mismatch → quarantined
  const badStart = await swarm.startFetch({
    webseedUrl: 'https://example.com/x',
    expectedSha256: expected,
    id: 'fixture.bad'
  });
  const jb = swarm.jobs.get(badStart.job.id);
  if (jb.abortRef) jb.abortRef.aborted = true;
  if (jb.abortRef && jb.abortRef.req) {
    try {
      jb.abortRef.req.destroy();
    } catch (e) {
      /* ignore */
    }
  }
  jb.state = 'downloading';
  const bad = swarm.completeWithBuffer(badStart.job.id, Buffer.from('not-the-fixture'));
  assert.strictEqual(bad.matched, false);
  assert.strictEqual(bad.willNotImport, true);

  const wtOk = await swarm.ensureWebTorrent();
  const st = swarm.status();
  assert.strictEqual(st.reseed, 'later');
  // webtorrent may be ESM-loaded; webseed path does not require it for SMOKE_OK
  assert.strictEqual(st.webtorrent, wtOk);

  swarm.destroyClient();
  console.log('SMOKE_OK swarm bridge v0.1');
  console.log('handoff→hash + local webseed→hash + cancel ok · reseed: later');
  console.log('webtorrent loaded:', wtOk);
  console.log('tmp:', tmp);
}

main().catch(function (e) {
  console.error('SMOKE_FAIL', e);
  process.exit(1);
});
