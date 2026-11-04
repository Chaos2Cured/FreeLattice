#!/usr/bin/env node
// Smoke: a manifest must not skip the expected whole-file hash. Quiet Room stays shut.
'use strict';

var fs = require('fs');
var path = require('path');
var http = require('http');

var root = path.join(__dirname, '..', '..');
var port = Number(process.env.FL_PORT || 8817);
var chromePath = process.env.FL_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
var HONEST = 'Verified, but not kept on this device (too large for now).';
var MISMATCH = 'hash mismatch \u2014 will not trust on this device';

function fail(msg) {
  console.error('FAIL ' + msg);
  process.exit(1);
}

function serve() {
  return new Promise(function (resolve) {
    var server = http.createServer(function (req, res) {
      var urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
      if (urlPath === '/') urlPath = '/app.html';
      var file = path.join(root, 'docs', urlPath);
      if (!file.startsWith(path.join(root, 'docs'))) {
        res.writeHead(404);
        res.end();
        return;
      }
      fs.readFile(file, function (err, buf) {
        if (err) { res.writeHead(404); res.end(); return; }
        var type = 'application/octet-stream';
        if (/\.html$/.test(file)) type = 'text/html; charset=utf-8';
        else if (/\.js$/.test(file)) type = 'text/javascript; charset=utf-8';
        else if (/\.css$/.test(file)) type = 'text/css; charset=utf-8';
        res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
        res.end(buf);
      });
    });
    server.listen(port, '127.0.0.1', function () { resolve(server); });
  });
}

(async function main() {
  var server = await serve();
  var pw = require(process.env.FL_PLAYWRIGHT || '/tmp/gc-pw-local/node_modules/playwright-core');
  var browser = await pw.chromium.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--enable-precise-memory-info']
  });
  try {
    var page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    page.setDefaultTimeout(180000);
    page.on('pageerror', function (err) {
      console.log('PAGEERROR ' + (err && err.message ? err.message : err));
    });
    await page.goto('http://127.0.0.1:' + port + '/app.html', { waitUntil: 'domcontentloaded', timeout: 180000 });
    await page.waitForFunction(function () {
      return window.PhoneSwarm && window.FLSelfHeal && typeof window.FLSelfHeal.manifest === 'function';
    }, { timeout: 180000 });
    var quiet = await page.evaluate(function () {
      return !!document.querySelector('#tab-quiet-room.active, #tab-quiet.active, [data-tab="quiet"].active, [data-tab="quiet-room"].active');
    });
    if (quiet) fail('quiet room active');
    var out = await page.evaluate(async function () {
      function hexOf(buf) {
        var bytes = new Uint8Array(buf);
        var parts = [];
        var i;
        for (i = 0; i < bytes.length; i++) parts.push(('0' + bytes[i].toString(16)).slice(-2));
        return parts.join('');
      }
      function sha(bytes) {
        return crypto.subtle.digest('SHA-256', bytes).then(hexOf);
      }
      function idbIds() {
        return new Promise(function (resolve) {
          if (typeof indexedDB === 'undefined') { resolve([]); return; }
          var req = indexedDB.open('freelattice-phone-swarm', 1);
          req.onupgradeneeded = function () {
            var db = req.result;
            if (!db.objectStoreNames.contains('verified')) db.createObjectStore('verified', { keyPath: 'id' });
          };
          req.onerror = function () { resolve([]); };
          req.onsuccess = function () {
            try {
              var db = req.result;
              if (!db.objectStoreNames.contains('verified')) { resolve([]); return; }
              var tx = db.transaction('verified', 'readonly');
              var all = tx.objectStore('verified').getAll();
              all.onsuccess = function () {
                var rows = all.result || [];
                resolve(rows.map(function (row) {
                  return { id: row && row.id, hasBytes: !!(row && row.bytes) };
                }));
              };
              all.onerror = function () { resolve([]); };
            } catch (e) { resolve([]); }
          };
        });
      }
      function jobOf(id, expected, manifest) {
        return {
          id: id,
          modelId: id,
          state: 'pulling',
          expectedSha256: expected,
          manifest: manifest || null,
          willNotImport: true,
          matched: false,
          verified: false,
          blob: null,
          stored: null
        };
      }
      var h = new Uint8Array(256);
      var g = new Uint8Array(256);
      h.fill(1);
      g.fill(2);
      var shaH = await sha(h);
      var shaG = await sha(g);
      var manH = await window.FLSelfHeal.manifest(h);
      var manG = await window.FLSelfHeal.manifest(g);
      var heal = window.FLSelfHeal;
      var beforeBytes = typeof heal.byteDigestCount === 'function' ? heal.byteDigestCount() : null;
      var beforeWhole = typeof heal.wholeDigestCount === 'function' ? heal.wholeDigestCount() : null;

      window.PhoneSwarm.jobs.set('case-a', jobOf('case-a', shaG, manH));
      var pubA = await window.PhoneSwarm.completeWithBuffer('case-a', h);
      var liveA = window.PhoneSwarm.jobs.get('case-a');
      var afterBytes = typeof heal.byteDigestCount === 'function' ? heal.byteDigestCount() : null;
      var rowsA = await idbIds();

      window.PhoneSwarm.jobs.set('case-b', jobOf('case-b', shaH, manH));
      var pubB = await window.PhoneSwarm.completeWithBuffer('case-b', h);
      var liveB = window.PhoneSwarm.jobs.get('case-b');

      window.PhoneSwarm.jobs.set('case-c', jobOf('case-c', shaG, manG));
      var pubC = await window.PhoneSwarm.completeWithBuffer('case-c', h);
      var liveC = window.PhoneSwarm.jobs.get('case-c');

      window.PhoneSwarm.jobs.set('case-d', jobOf('case-d', shaH, null));
      var pubD = await window.PhoneSwarm.completeWithBuffer('case-d', g);
      var liveD = window.PhoneSwarm.jobs.get('case-d');

      var big = new Uint8Array(9 * 1024 * 1024);
      big[0] = 9;
      var shaBig = await sha(big);
      window.PhoneSwarm.jobs.set('case-e', jobOf('case-e', shaBig, null));
      var pubE = await window.PhoneSwarm.completeWithBuffer('case-e', big);
      var liveE = window.PhoneSwarm.jobs.get('case-e');
      var rowsE = await idbIds();
      big = null;

      return {
        manH: manH && manH.whole,
        manG: manG && manG.whole,
        shaH: shaH,
        shaG: shaG,
        digests: { beforeBytes: beforeBytes, afterBytes: afterBytes, beforeWhole: beforeWhole },
        a: {
          state: pubA && pubA.state,
          verified: pubA && pubA.verified,
          blob: liveA ? liveA.blob : 'missing',
          willNotImport: pubA && pubA.willNotImport,
          error: pubA && pubA.error,
          stored: liveA && liveA.stored,
          idb: rowsA.some(function (row) { return row.id === 'case-a'; })
        },
        b: {
          state: pubB && pubB.state,
          verified: pubB && pubB.verified,
          willNotImport: pubB && pubB.willNotImport
        },
        c: {
          state: pubC && pubC.state,
          verified: pubC && pubC.verified,
          blob: liveC ? liveC.blob : 'missing',
          willNotImport: pubC && pubC.willNotImport
        },
        d: {
          state: pubD && pubD.state,
          verified: pubD && pubD.verified,
          blob: liveD ? liveD.blob : 'missing',
          willNotImport: pubD && pubD.willNotImport,
          error: pubD && pubD.error
        },
        e: {
          state: pubE && pubE.state,
          verified: pubE && pubE.verified,
          stored: pubE && pubE.stored,
          storedLine: pubE && pubE.storedLine,
          liveStored: liveE && liveE.stored,
          idb: rowsE.some(function (row) { return row.id === 'case-e'; }),
          hollow: rowsE.some(function (row) { return row.id === 'case-e' && !row.hasBytes; })
        },
        quiet: !!document.querySelector('#tab-quiet-room.active, #tab-quiet.active, [data-tab="quiet"].active, [data-tab="quiet-room"].active')
      };
    });
    if (out.quiet) fail('quiet room active');
    if (out.manH !== out.shaH || out.manG !== out.shaG) fail('fixture whole ' + JSON.stringify(out));
    if (out.digests.afterBytes !== out.digests.beforeBytes) fail('case a did piece work ' + JSON.stringify(out.digests));
    if (out.a.state === 'verified' || out.a.verified || out.a.blob !== null || out.a.willNotImport !== true || out.a.idb) {
      fail('case a ' + JSON.stringify(out.a));
    }
    if (out.a.error !== MISMATCH) fail('case a error ' + out.a.error);
    if (out.a.stored === 'idb' || out.a.stored === 'opfs') fail('case a stored ' + out.a.stored);
    if (!out.b.verified || out.b.state !== 'verified' || out.b.willNotImport !== true) fail('case b ' + JSON.stringify(out.b));
    if (out.c.state === 'verified' || out.c.verified || out.c.blob !== null || out.c.willNotImport !== true) {
      fail('case c ' + JSON.stringify(out.c));
    }
    if (out.d.state !== 'mismatch' || out.d.verified || out.d.blob !== null || out.d.willNotImport !== true || out.d.error !== MISMATCH) {
      fail('case d ' + JSON.stringify(out.d));
    }
    if (!out.e.verified || out.e.state !== 'verified' || out.e.stored !== 'not-stored' || out.e.liveStored !== 'not-stored') {
      fail('case e ' + JSON.stringify(out.e));
    }
    if (out.e.storedLine !== HONEST || out.e.idb || out.e.hollow) fail('case e kept ' + JSON.stringify(out.e));
    console.log('CASES a mismatch, b verified, c pieces, d no manifest, e not-stored');
    console.log('SMOKE_OK self heal manifest truth v0.1');
  } finally {
    await browser.close();
    server.close();
  }
})().catch(function (err) {
  console.error('FAIL ' + (err && err.stack ? err.stack : err));
  process.exit(1);
});
