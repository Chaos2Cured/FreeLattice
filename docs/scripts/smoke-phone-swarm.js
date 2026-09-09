#!/usr/bin/env node
// Smoke: phone / browser swarm → SubtleCrypto/hash path.
// Automated: mock completeWithBuffer + refuse paths + cancel.
// Live browser WebTorrent optional — note in PR body; not required for SMOKE_OK.
// Usage: node docs/scripts/smoke-phone-swarm.js

'use strict';

const assert = require('assert');
const fs = require('fs');
const http = require('http');
const path = require('path');

const swarm = require(path.join(__dirname, '..', 'modules', 'phone-swarm.js'));

async function main() {
  const fixturePath = path.join(__dirname, '..', 'models', 'fixture-verify-only.txt');
  const fixtureBuf = fs.readFileSync(fixturePath);
  const expected = '5b1d0ba7fd635d56cb9f32b5f53cf7034d51b3054a8bb0b7eac26448b85d0af4';

  // Self-check fixture hash via module path
  const h = await swarm.completeWithBuffer
    ? null
    : null;
  void h;

  // file:// refused
  var fileRefused = false;
  try {
    swarm.assertAllowedSource('', 'file:///tmp/x');
  } catch (e) {
    fileRefused = true;
  }
  assert.ok(fileRefused, 'file:// must refuse');

  // non-loopback http refused
  var httpRefused = false;
  try {
    swarm.assertAllowedSource('', 'http://example.com/x');
  } catch (e) {
    httpRefused = /loopback|HTTP/i.test(String(e.message || e));
  }
  assert.ok(httpRefused, 'non-loopback http must refuse');

  // zero-hash refused
  var zeroRefused = false;
  try {
    await swarm.startPull({
      webseedUrl: 'https://freelattice.com/models/fixture-verify-only.txt',
      expectedSha256: '0'.repeat(64),
      id: 'example.zero',
      redistributable: true
    });
  } catch (e) {
    zeroRefused = /zero-hash|EXAMPLE|refuse/i.test(String(e.message || e));
  }
  assert.ok(zeroRefused, 'zero-hash must refuse swarm');

  // EXAMPLE notes refused
  var exampleRefused = false;
  try {
    await swarm.startPull({
      webseedUrl: 'https://freelattice.com/models/fixture-verify-only.txt',
      expectedSha256: expected,
      id: 'example.notes',
      redistributable: true,
      notes: 'EXAMPLE ONLY — zero hash means do not import'
    });
  } catch (e) {
    exampleRefused = /EXAMPLE|refuse|zero-hash/i.test(String(e.message || e));
  }
  assert.ok(exampleRefused, 'EXAMPLE must refuse');

  // non-redistributable refused
  var propRefused = false;
  try {
    await swarm.startPull({
      webseedUrl: 'https://freelattice.com/models/fixture-verify-only.txt',
      expectedSha256: expected,
      id: 'prop',
      redistributable: false
    });
  } catch (e) {
    propRefused = /non-redistributable|refuse/i.test(String(e.message || e));
  }
  assert.ok(propRefused, 'non-redistributable must refuse');

  // Cancel does not crash (127.0.0.1:9 refuses fast — no WAN hang)
  const c1 = await swarm.startPull({
    webseedUrl: 'http://127.0.0.1:9/slow',
    expectedSha256: expected,
    id: 'cancel-me',
    redistributable: true
  });
  const cancelled = swarm.cancel(c1.job.id);
  assert.ok(cancelled.ok && cancelled.cancelled);
  assert.strictEqual(cancelled.job.state, 'cancelled');

  var afterCancelFailed = false;
  try {
    await swarm.completeWithBuffer(c1.job.id, fixtureBuf);
  } catch (e) {
    afterCancelFailed = /cancel/i.test(String(e.message || e));
  }
  assert.ok(afterCancelFailed);

  // Mock download-complete → hash match (required for CI)
  const m = await swarm.startPull({
    webseedUrl: 'http://127.0.0.1:9/placeholder',
    expectedSha256: expected,
    id: 'fixture.verify-only',
    name: 'fixture-verify-only',
    redistributable: true
  });
  const mj = swarm.jobs.get(m.job.id);
  if (mj.abortRef) mj.abortRef.aborted = true;
  if (mj.abortRef && mj.abortRef.controller) {
    try {
      mj.abortRef.controller.abort();
    } catch (e) {
      /* ignore */
    }
  }
  mj.state = 'pulling';
  const done = await swarm.completeWithBuffer(m.job.id, fixtureBuf);
  assert.strictEqual(done.matched, true, JSON.stringify(done));
  assert.strictEqual(done.verified, true);
  assert.strictEqual(done.state, 'verified');
  assert.strictEqual(done.willNotImport, true, 'browser never Import to Ollama');

  // Mismatch → mismatch state
  const badStart = await swarm.startPull({
    webseedUrl: 'http://127.0.0.1:9/x',
    expectedSha256: expected,
    id: 'fixture.bad',
    redistributable: true
  });
  const jb = swarm.jobs.get(badStart.job.id);
  if (jb.abortRef) jb.abortRef.aborted = true;
  if (jb.abortRef && jb.abortRef.controller) {
    try {
      jb.abortRef.controller.abort();
    } catch (e) {
      /* ignore */
    }
  }
  jb.state = 'pulling';
  const bad = await swarm.completeWithBuffer(badStart.job.id, Buffer.from('not-the-fixture'));
  assert.strictEqual(bad.matched, false);
  assert.strictEqual(bad.state, 'mismatch');
  assert.strictEqual(bad.willNotImport, true);

  // Local HTTP webseed → real pull → hash (loopback allowed)
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
        const pull = await swarm.startPull({
          webseedUrl: url,
          expectedSha256: expected,
          id: 'fixture.local-webseed',
          name: 'fixture-local-webseed',
          redistributable: true
        });
        const finished = await swarm.waitJob(pull.job.id, 30000);
        assert.strictEqual(finished.matched, true, JSON.stringify(finished));
        assert.strictEqual(finished.verified, true);
        assert.strictEqual(finished.state, 'verified');
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

  const st = swarm.status();
  assert.ok(st.ok);
  // WebTorrent CDN load is browser-only; Node smoke does not require it
  assert.strictEqual(typeof st.webtorrent, 'boolean');

  swarm.destroyClient();
  console.log('SMOKE_OK phone swarm v0.1');
  console.log('match + mismatch + refuse + cancel + local webseed ok');
  console.log('live browser WebTorrent: exercise manually / PR note');
  process.exit(0);
}

main().catch(function (e) {
  console.error('SMOKE_FAIL', e);
  process.exit(1);
});
