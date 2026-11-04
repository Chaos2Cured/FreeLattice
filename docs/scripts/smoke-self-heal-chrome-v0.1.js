#!/usr/bin/env node
// Smoke: self-heal streams in real Chrome. Quiet Room stays shut.
'use strict';

var fs = require('fs');
var path = require('path');
var http = require('http');

var root = path.join(__dirname, '..', '..');
var port = Number(process.env.FL_PORT || 8803);
var chromePath = process.env.FL_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
var piece = 64 * 1024;
var reps = 3;

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
        else if (/\.css$/.test(file)) type = 'text/css; charset=utf-8';
        else if (/\.js$/.test(file)) type = 'text/javascript; charset=utf-8';
        else if (/\.json$/.test(file)) type = 'application/json';
        else if (/\.svg$/.test(file)) type = 'image/svg+xml';
        res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
        res.end(buf);
      });
    });
    server.listen(port, '127.0.0.1', function () { resolve(server); });
  });
}

function stats(nums) {
  var s = nums.slice().sort(function (a, b) { return a - b; });
  return { min: s[0], median: s[Math.floor(s.length / 2)], max: s[s.length - 1] };
}

function cell(st) {
  return st.min + '/' + st.median + '/' + st.max;
}

(async function main() {
  var server = await serve();
  var pw = require(process.env.FL_PLAYWRIGHT || '/tmp/gc-pw-local/node_modules/playwright-core');
  var browser = await pw.chromium.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--enable-precise-memory-info', '--js-flags=--expose-gc']
  });
  var table = [];
  var out = { at: new Date().toISOString(), chrome: browser.version(), page: 'docs/app.html', rows: table };
  try {
    var page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    page.setDefaultTimeout(600000);
    page.on('pageerror', function (err) {
      console.log('PAGEERROR ' + (err && err.message ? err.message : err));
    });
    await page.goto('http://127.0.0.1:' + port + '/app.html', { waitUntil: 'domcontentloaded', timeout: 180000 });
    await page.waitForFunction(function () {
      return window.PhoneSwarm && window.FLSelfHeal && typeof window.FLSelfHeal.heal === 'function';
    }, { timeout: 180000 });
    var quiet = await page.evaluate(function () {
      return !!document.querySelector('#tab-quiet-room.active, #tab-quiet.active, [data-tab="quiet"].active, [data-tab="quiet-room"].active');
    });
    if (quiet) fail('quiet room active');
    await page.evaluate(function () {
      window.__lt = [];
      window.__obs = new PerformanceObserver(function (list) {
        var entries = list.getEntries();
        var i;
        for (i = 0; i < entries.length; i++) {
          window.__lt.push({ dur: entries[i].duration, start: entries[i].startTime });
        }
      });
      window.__obs.observe({ type: 'longtask', buffered: true });
      window.__flChrome = {
        piece: 64 * 1024,
        gc: function () { if (typeof window.gc === 'function') window.gc(); },
        heap: function () {
          var m = performance.memory;
          return m ? m.usedJSHeapSize : null;
        },
        longs: function (t) {
          return (window.__lt || []).filter(function (e) { return e.start >= t; });
        },
        maxDur: function (list) {
          var m = 0;
          var i;
          for (i = 0; i < list.length; i++) if (list[i].dur > m) m = list[i].dur;
          return m;
        },
        browserHeal: async function (mib) {
          var n = mib * 1024 * 1024;
          var bytes = new Uint8Array(n);
          bytes.fill(6);
          var api = window.FLSelfHeal;
          await new Promise(function (resolve) { setTimeout(resolve, 0); });
          this.gc();
          var manMark = performance.now();
          api.resetWorkGap();
          var man = await api.manifest(bytes);
          var manMs = performance.now() - manMark;
          var manLong = this.maxDur(this.longs(manMark));
          var manGap = api.maxWorkGap();
          bytes[7 * this.piece] ^= 1;
          await new Promise(function (resolve) { setTimeout(resolve, 0); });
          this.gc();
          var before = this.heap();
          var peak = before || 0;
          var self = this;
          var timer = setInterval(function () {
            var h = self.heap();
            if (h != null && h > peak) peak = h;
          }, 0);
          api.resetWorkGap();
          var mark = performance.now();
          var fetches = 0;
          var result = await api.heal(man, bytes, function () {
            fetches += 1;
            var chunk = new Uint8Array(self.piece);
            chunk.fill(6);
            return { bytes: chunk, from: 'source' };
          }, { what: 'chrome-browser-' + mib, inPlace: true });
          clearInterval(timer);
          var healMs = performance.now() - mark;
          var after = this.heap();
          if (after != null && after > peak) peak = after;
          var longs = this.longs(mark);
          var gap = api.maxWorkGap();
          var ok = !!result.ok;
          bytes = null;
          result = null;
          this.gc();
          return {
            mib: mib,
            kind: 'browser',
            ok: ok,
            fetches: fetches,
            pieces: man.pieces.length,
            healMs: Math.round(healMs),
            maxLongTask: Math.round(this.maxDur(longs) * 1000) / 1000,
            longTaskCount: longs.length,
            maxWorkGap: gap,
            manMs: Math.round(manMs),
            manLong: Math.round(manLong * 1000) / 1000,
            manGap: manGap,
            heapGrowth: before == null ? null : peak - before,
            yields: api.yieldCount()
          };
        },
        swarmHeal: async function (mib) {
          var n = mib * 1024 * 1024;
          var bytes = new Uint8Array(n);
          bytes.fill(7);
          var api = window.FLSelfHeal;
          var man = await api.manifest(bytes);
          bytes[7 * this.piece] ^= 1;
          await new Promise(function (resolve) { setTimeout(resolve, 0); });
          this.gc();
          var before = this.heap();
          var peak = before || 0;
          var self = this;
          var timer = setInterval(function () {
            var h = self.heap();
            if (h != null && h > peak) peak = h;
          }, 0);
          var fetches = 0;
          var job = {
            id: 'chrome-swarm-' + mib + '-' + Date.now(),
            state: 'pulling',
            expectedSha256: man.whole,
            manifest: man,
            willNotImport: true,
            matched: false,
            verified: false,
            blob: null,
            fetchPiece: function () {
              fetches += 1;
              var h = self.heap();
              if (h != null && h > peak) peak = h;
              var chunk = new Uint8Array(self.piece);
              chunk.fill(7);
              return { bytes: chunk, from: 'peer' };
            }
          };
          window.PhoneSwarm.jobs.set(job.id, job);
          var mark = performance.now();
          var pub = await window.PhoneSwarm.completeWithBuffer(job.id, bytes);
          clearInterval(timer);
          var healMs = performance.now() - mark;
          var after = this.heap();
          if (after != null && after > peak) peak = after;
          var live = window.PhoneSwarm.jobs.get(job.id);
          var longs = this.longs(mark);
          var same = !!(live && live.blob === bytes);
          bytes = null;
          if (live) live.blob = null;
          this.gc();
          return {
            mib: mib,
            kind: 'swarm',
            ok: !!(pub && pub.state === 'verified' && pub.verified),
            state: pub && pub.state,
            fetches: fetches,
            pieces: man.pieces.length,
            healMs: Math.round(healMs),
            maxLongTask: Math.round(this.maxDur(longs) * 1000) / 1000,
            longTaskCount: longs.length,
            digestCount: live ? live.digestCount : null,
            wholeDigestCount: live ? live.wholeDigestCount : null,
            same: same,
            heapGrowth: before == null ? null : peak - before,
            piecesInFlight: window.PhoneSwarm.piecesInFlight()
          };
        },
        forged: async function () {
          var n = 8 * this.piece;
          var bytes = new Uint8Array(n);
          bytes.fill(4);
          var api = window.FLSelfHeal;
          var man = await api.manifest(bytes);
          bytes[7 * this.piece] ^= 1;
          localStorage.removeItem('fl_healLedger');
          var result = await api.heal(man, bytes, function () {
            var chunk = new Uint8Array(64 * 1024);
            chunk.fill(9);
            return { bytes: chunk, from: 'source' };
          }, { what: 'chrome-forged' });
          var raw = localStorage.getItem('fl_healLedger') || '';
          var rows = raw ? JSON.parse(raw) : [];
          var row = rows.length ? rows[rows.length - 1] : null;
          bytes = null;
          return {
            mib: 0.5,
            kind: 'forged',
            ok: !result.ok && result.stillBad && result.stillBad[0] === 7,
            stillBad: result.stillBad || [],
            healMs: result.ms || 0,
            maxLongTask: 0,
            longTaskCount: 0,
            heapGrowth: 0,
            receipt: !!row,
            dataKey: raw.indexOf('"data"') !== -1,
            storedStill: row ? row.stillBad : null
          };
        }
      };
    });

    await page.evaluate(async function () {
      var warm = new Uint8Array(64 * 1024);
      warm.fill(1);
      var man = await window.FLSelfHeal.manifest(warm);
      warm[0] ^= 1;
      await window.FLSelfHeal.heal(man, warm, function () {
        var chunk = new Uint8Array(64 * 1024);
        chunk.fill(1);
        return { bytes: chunk, from: 'source' };
      }, { what: 'warmup', inPlace: true });
      window.FLSelfHeal.resetWorkGap();
    });
    console.log('WARM chrome ' + browser.version());

    var sizes = [8, 32, 64];
    var s;
    var r;
    for (s = 0; s < sizes.length; s++) {
      var browserReps = [];
      for (r = 0; r < reps; r++) {
        var row = await page.evaluate(async function (mib) {
          return window.__flChrome.browserHeal(mib);
        }, sizes[s]);
        browserReps.push(row);
        console.log('BROWSER ' + sizes[s] + ' rep ' + (r + 1) + ' ' + JSON.stringify(row));
        if (!row.ok || row.fetches !== 1) fail('browser heal ' + sizes[s] + ' ' + JSON.stringify(row));
        if (row.maxLongTask > 50) fail('browser long task ' + sizes[s] + ' ' + row.maxLongTask);
        if (row.maxWorkGap > 50) fail('browser gap ' + sizes[s] + ' ' + row.maxWorkGap);
      }
      table.push({
        mib: sizes[s],
        kind: 'browser',
        healMs: stats(browserReps.map(function (row) { return row.healMs; })),
        maxLongTask: stats(browserReps.map(function (row) { return row.maxLongTask; })),
        maxWorkGap: stats(browserReps.map(function (row) { return row.maxWorkGap; })),
        heapGrowth: stats(browserReps.map(function (row) { return row.heapGrowth; })),
        manLong: stats(browserReps.map(function (row) { return row.manLong; })),
        manGap: stats(browserReps.map(function (row) { return row.manGap; }))
      });
    }

    var swarm64 = [];
    for (r = 0; r < reps; r++) {
      var srow = await page.evaluate(async function () { return window.__flChrome.swarmHeal(64); });
      swarm64.push(srow);
      console.log('SWARM 64 rep ' + (r + 1) + ' ' + JSON.stringify(srow));
      var budget = 2 * piece * srow.piecesInFlight + (8 * 1024 * 1024);
      var ceiling = 68 * 1024 * 1024;
      if (!srow.ok || srow.fetches !== 1 || !srow.same) fail('swarm 64 ' + JSON.stringify(srow));
      if (srow.digestCount !== srow.pieces + 1 || srow.wholeDigestCount !== 0) fail('swarm digests ' + JSON.stringify(srow));
      if (srow.maxLongTask > 50) fail('swarm 64 long task ' + srow.maxLongTask);
      if (srow.heapGrowth >= budget || srow.heapGrowth >= ceiling) {
        fail('swarm 64 heap ' + srow.heapGrowth + ' budget ' + budget);
      }
    }
    table.push({
      mib: 64,
      kind: 'swarm',
      healMs: stats(swarm64.map(function (row) { return row.healMs; })),
      maxLongTask: stats(swarm64.map(function (row) { return row.maxLongTask; })),
      heapGrowth: stats(swarm64.map(function (row) { return row.heapGrowth; }))
    });

    var swarm96 = [];
    for (r = 0; r < reps; r++) {
      var grow = await page.evaluate(async function () { return window.__flChrome.swarmHeal(96); });
      swarm96.push(grow);
      console.log('SWARM 96 rep ' + (r + 1) + ' ' + JSON.stringify(grow));
      if (!grow.ok || grow.fetches !== 1 || !grow.same) fail('swarm 96 ' + JSON.stringify(grow));
      if (grow.digestCount !== grow.pieces + 1 || grow.wholeDigestCount !== 0) fail('swarm 96 digests ' + JSON.stringify(grow));
      if (grow.maxLongTask > 50) fail('swarm 96 long task ' + grow.maxLongTask);
    }
    table.push({
      mib: 96,
      kind: 'swarm',
      healMs: stats(swarm96.map(function (row) { return row.healMs; })),
      maxLongTask: stats(swarm96.map(function (row) { return row.maxLongTask; })),
      heapGrowth: stats(swarm96.map(function (row) { return row.heapGrowth; }))
    });

    var forgedReps = [];
    for (r = 0; r < reps; r++) {
      var forged = await page.evaluate(async function () { return window.__flChrome.forged(); });
      forgedReps.push(forged);
      console.log('FORGED rep ' + (r + 1) + ' ' + JSON.stringify(forged));
      if (!forged.ok || !forged.receipt || forged.dataKey) fail('forged ' + JSON.stringify(forged));
      if (!forged.storedStill || forged.storedStill[0] !== 7) fail('forged stored ' + JSON.stringify(forged));
    }
    table.push({
      mib: 0.5,
      kind: 'forged',
      healMs: stats(forgedReps.map(function (row) { return row.healMs; })),
      maxLongTask: { min: 0, median: 0, max: 0 },
      heapGrowth: { min: 0, median: 0, max: 0 },
      stillBad: '[7]'
    });

    var quietAfter = await page.evaluate(function () {
      return !!document.querySelector('#tab-quiet-room.active, #tab-quiet.active, [data-tab="quiet"].active, [data-tab="quiet-room"].active');
    });
    if (quietAfter) fail('quiet room active after');

    console.log('size kind healMs maxLongTask heapGrowth');
    var i;
    for (i = 0; i < table.length; i++) {
      var line = table[i];
      console.log(
        line.mib + 'MiB ' + line.kind +
        ' healMs ' + cell(line.healMs) +
        ' maxLongTask ' + cell(line.maxLongTask) +
        ' heapGrowth ' + cell(line.heapGrowth)
      );
    }
    fs.writeFileSync('/tmp/062c-chrome.json', JSON.stringify(out, null, 2));
    console.log('SMOKE_OK self heal chrome v0.1');
  } finally {
    await browser.close();
    server.close();
  }
})().catch(function (err) {
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
