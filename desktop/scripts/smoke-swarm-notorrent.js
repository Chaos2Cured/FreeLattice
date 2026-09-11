#!/usr/bin/env node
// Smoke: swarm v0.2 — HTTPS-first, torrent opt-in fallback, Metronet-safe.
// - Default mode is https+torrent-fallback, webseed never touches torrent stack
// - FL_NO_TORRENT=1 hard-disables torrent (no import, magnet-only refuses cleanly)
// - Multi-mirror webseedUrls tried in order
// - Hash path unchanged (verified/quarantined)
// Usage: node desktop/scripts/smoke-swarm-notorrent.js

const assert = require('assert');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

function clearRequireCache() {
  const p = path.join(__dirname, '..', 'lattice-swarm.js');
  try { delete require.cache[require.resolve(p)]; } catch (e) { /* ignore */ }
  const q = path.join(__dirname, '..', 'lattice-import.js');
  try { delete require.cache[require.resolve(q)]; } catch (e) { /* ignore */ }
}

async function main() {
  // ---- Default mode: HTTPS first, torrent fallback allowed but untouched ----
  clearRequireCache();
  delete process.env.FL_NO_TORRENT;
  delete process.env.FL_TRANSPORT;
  const swarm = require(path.join(__dirname, '..', 'lattice-swarm.js'));
  const latticeImport = require(path.join(__dirname, '..', 'lattice-import.js'));

  assert.strictEqual(swarm.getTransportMode(), 'https+torrent-fallback');
  assert.strictEqual(swarm.isTorrentDisabled(), false);
  assert.strictEqual(swarm.isTorrentAllowed(), true);

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fl-swarm-notorrent-'));
  swarm.bindSmoke(tmp);

  const fixturePath = path.join(__dirname, '..', '..', 'docs', 'models', 'fixture-verify-only.txt');
  const fixtureBuf = fs.readFileSync(fixturePath);
  const expected = latticeImport.sha256Buffer(fixtureBuf);

  // webseedUrls normalization
  assert.deepStrictEqual(
    swarm.normalizeWebseeds('https://a.example/x', ['https://b.example/y', 'https://a.example/x']),
    ['https://a.example/x', 'https://b.example/y']
  );

  // Local HTTPS-mirror test: first URL 404, second serves fixture → must verify via 2nd
  await new Promise(function (resolve, reject) {
    const server = http.createServer(function (req, res) {
      if (req.url === '/bad.txt') {
        res.writeHead(404, { 'Connection': 'close' }); res.end('nope'); return;
      }
      res.writeHead(200, { 'Content-Type': 'text/plain', 'Content-Length': fixtureBuf.length, 'Connection': 'close' });
      res.end(fixtureBuf);
    });
    server.listen(0, '127.0.0.1', async function () {
      try {
        const port = server.address().port;
        const pull = await swarm.startFetch({
          webseedUrls: [
            'http://127.0.0.1:' + port + '/bad.txt',
            'http://127.0.0.1:' + port + '/good.txt'
          ],
          expectedSha256: expected,
          id: 'fixture.multi-mirror'
        });
        const finished = await swarm.waitJob(pull.job.id, 15000);
        assert.strictEqual(finished.verified, true, JSON.stringify(finished));
        assert.strictEqual(finished.source, 'webseed');
        assert.ok((finished.tried || []).length >= 2, 'should try both mirrors');
        try { server.closeAllConnections(); } catch (e) { /* ignore */ }
        server.close(function () { resolve(); });
        setTimeout(resolve, 500); // fail-safe: don't hang on keep-alive
      } catch (e) {
        try { server.closeAllConnections(); } catch (e2) { /* ignore */ }
        try { server.close(); } catch (e2) { /* ignore */ }
        reject(e);
      }
    });
  });

  // Webseed must NOT load WebTorrent
  const st1 = swarm.status();
  assert.strictEqual(st1.webtorrent, false, 'webseed path must not load torrent stack');
  assert.strictEqual(st1.transport, 'https+torrent-fallback');

  // ---- Hard-disabled mode: FL_NO_TORRENT=1 ----
  clearRequireCache();
  process.env.FL_NO_TORRENT = '1';
  const swarm2 = require(path.join(__dirname, '..', 'lattice-swarm.js'));
  const imp2 = require(path.join(__dirname, '..', 'lattice-import.js'));
  assert.strictEqual(swarm2.getTransportMode(), 'https-only');
  assert.strictEqual(swarm2.isTorrentDisabled(), true);
  assert.strictEqual(await swarm2.ensureWebTorrent(), false);

  const tmp2 = fs.mkdtempSync(path.join(os.tmpdir(), 'fl-swarm-httpsonly-'));
  swarm2.bindSmoke(tmp2);
  const expected2 = imp2.sha256Buffer(fixtureBuf);

  // magnet-only must refuse cleanly (no crash, no torrent traffic)
  const mOnly = await swarm2.startFetch({
    magnet: 'magnet:?xt=urn:btih:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa&dn=test',
    expectedSha256: expected2,
    id: 'magnet.only.blocked'
  });
  const mFinished = await swarm2.waitJob(mOnly.job.id, 15000);
  assert.strictEqual(mFinished.state, 'error');
  assert.ok(/torrent disabled|HTTPS webseed/i.test(mFinished.error || ''));

  // webseed still works when torrent disabled
  await new Promise(function (resolve, reject) {
    const server = http.createServer(function (req, res) {
      res.writeHead(200, { 'Content-Type': 'text/plain', 'Content-Length': fixtureBuf.length, 'Connection': 'close' });
      res.end(fixtureBuf);
    });
    server.listen(0, '127.0.0.1', async function () {
      try {
        const port = server.address().port;
        const pull = await swarm2.startFetch({
          webseedUrl: 'http://127.0.0.1:' + port + '/fixture.txt',
          expectedSha256: expected2,
          id: 'fixture.httpsonly'
        });
        const finished = await swarm2.waitJob(pull.job.id, 15000);
        assert.strictEqual(finished.verified, true, JSON.stringify(finished));
        try { server.closeAllConnections(); } catch (e) { /* ignore */ }
        server.close(function () { resolve(); });
        setTimeout(resolve, 500);
      } catch (e) {
        try { server.closeAllConnections(); } catch (e2) { /* ignore */ }
        try { server.close(); } catch (e2) { /* ignore */ }
        reject(e);
      }
    });
  });

  // reseed must refuse when disabled
  var reseedRefused = false;
  try {
    await swarm2.startReseed({ id: 'x', redistributable: true, expectedSha256: expected2, notes: 'ok' });
  } catch (e) {
    reseedRefused = /torrent disabled/i.test(String(e.message || e));
  }
  assert.ok(reseedRefused, 'reseed must refuse in https-only mode');

  delete process.env.FL_NO_TORRENT;
  swarm.destroyClient();
  try { swarm2.destroyClient(); } catch (e) { /* ignore */ }
  console.log('SMOKE_OK swarm v0.2 https-first torrent-fallback');
  console.log('multi-mirror + https-only hard-disable + magnet refuse ok');
  process.exit(0);
}

main().catch(function (e) {
  console.error('SMOKE_FAIL', e);
  process.exit(1);
});
