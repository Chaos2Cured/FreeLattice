#!/usr/bin/env node
// Real Chrome timing harness v0.1. Speed claims in PRs come from this, not Node.
// Serves the repo locally. Non-local network is aborted. The Quiet Room is never opened.
'use strict';

var fs = require('fs');
var http = require('http');
var path = require('path');

var root = path.join(__dirname, '..', '..');
var port = Number(process.env.FL_PORT || 8862);
var pageArg = '';
var expr = '';
var reps = 5;

function fail(msg) {
  console.error('FAIL ' + msg);
  process.exit(1);
}

function usage() {
  console.error('Usage: node docs/scripts/real-chrome-timing.js --page docs/app.html --eval "<expression returning a promise>" --reps 5');
  process.exit(1);
}

var i;
for (i = 2; i < process.argv.length; i++) {
  var arg = process.argv[i];
  if (arg === '--page') pageArg = process.argv[++i] || '';
  else if (arg === '--eval') expr = process.argv[++i] || '';
  else if (arg === '--reps') reps = Number(process.argv[++i] || '5');
  else usage();
}

if (!pageArg || !expr) usage();
if (!Number.isFinite(reps) || reps < 1) fail('reps');
if (/quiet/i.test(expr) || /quiet/i.test(pageArg)) {
  console.error('REFUSE quiet');
  process.exit(2);
}

function typeFor(file) {
  var ext = path.extname(file);
  if (ext === '.js') return 'text/javascript; charset=utf-8';
  if (ext === '.css') return 'text/css; charset=utf-8';
  if (ext === '.html') return 'text/html; charset=utf-8';
  if (ext === '.json') return 'application/json; charset=utf-8';
  if (ext === '.svg') return 'image/svg+xml';
  if (ext === '.md') return 'text/plain; charset=utf-8';
  return 'application/octet-stream';
}

var server = http.createServer(function (req, res) {
  var urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  if (urlPath === '/') urlPath = '/' + pageArg.replace(/^\/+/, '');
  var file = path.normalize(path.join(root, urlPath));
  if (file.indexOf(root) !== 0) {
    res.statusCode = 403;
    res.end('no');
    return;
  }
  fs.readFile(file, function (err, buf) {
    if (err) {
      res.statusCode = 404;
      res.end('missing');
      return;
    }
    res.setHeader('content-type', typeFor(file));
    res.setHeader('cache-control', 'no-store');
    res.end(buf);
  });
});

function median(xs) {
  var a = xs.slice().sort(function (x, y) { return x - y; });
  var n = a.length;
  var mid = Math.floor(n / 2);
  if (n % 2) return a[mid];
  return (a[mid - 1] + a[mid]) / 2;
}

function num(n) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return 'n/a';
  return String(Math.round(n * 10) / 10);
}

function row(name, xs) {
  return '| ' + name + ' | ' + num(Math.min.apply(null, xs)) + ' | ' + num(median(xs)) + ' | ' + num(Math.max.apply(null, xs)) + ' |';
}

var pw = require(process.env.FL_PLAYWRIGHT || '/tmp/gc-pw-local/node_modules/playwright-core');

// The expression is a promise body. Playwright runs this source in the page.
// The source is built as a function string. Node does not evaluate it.
var pageSource = [
  '(async () => {',
  '  var t0 = performance.now();',
  '  var mem0 = performance.memory ? performance.memory.usedJSHeapSize : null;',
  '  var tasks = [];',
  '  var obs = null;',
  '  try {',
  '    obs = new PerformanceObserver(function (list) {',
  '      list.getEntries().forEach(function (entry) { tasks.push(entry.duration); });',
  '    });',
  '    obs.observe({ type: "longtask", buffered: true });',
  '  } catch (e) {}',
  '  var value = await (async () => (' + expr + '))();',
  '  if (obs) obs.disconnect();',
  '  var wall = performance.now() - t0;',
  '  var mem1 = performance.memory ? performance.memory.usedJSHeapSize : null;',
  '  var max = 0;',
  '  for (var k = 0; k < tasks.length; k++) if (tasks[k] > max) max = tasks[k];',
  '  return {',
  '    wall: wall,',
  '    longMax: max,',
  '    longCount: tasks.length,',
  '    memDelta: (mem0 === null || mem1 === null) ? null : (mem1 - mem0),',
  '    value: value === undefined ? "" : String(value)',
  '  };',
  '})()'
].join('\n');

(async function () {
  await new Promise(function (resolve) { server.listen(port, '127.0.0.1', resolve); });
  var browser = await pw.chromium.launch({
    executablePath: process.env.FL_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--enable-precise-memory-info']
  });
  try {
    var version = browser.version();
    var walls = [];
    var longs = [];
    var counts = [];
    var mems = [];
    var memKnown = true;
    var r;
    for (r = 0; r < reps; r++) {
      var page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
      page.setDefaultTimeout(20000);
      await page.route('**/*', function (route) {
        var u = route.request().url();
        var local = u.indexOf('http://127.0.0.1:') === 0 || u.indexOf('http://localhost:') === 0;
        var safe = local || u.indexOf('data:') === 0 || u.indexOf('blob:') === 0 || u.indexOf('about:') === 0;
        if (safe) route.continue();
        else route.abort();
      });
      var url = 'http://127.0.0.1:' + port + '/' + pageArg.replace(/^\/+/, '');
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      var quiet = await page.evaluate(function () {
        return !!document.querySelector('#tab-quiet-room.active, #tab-quiet.active, [data-tab="quiet"].active, [data-tab="quiet-room"].active');
      });
      if (quiet) throw new Error('REFUSE quiet room is open');
      var sample = await page.evaluate(pageSource);
      walls.push(sample.wall);
      longs.push(sample.longMax);
      counts.push(sample.longCount);
      if (r === reps - 1) console.log('last value ' + sample.value);
      if (sample.memDelta === null) memKnown = false;
      else mems.push(sample.memDelta);
      await page.close();
    }
    console.log('Chrome ' + version);
    console.log('page ' + pageArg);
    console.log('reps ' + reps);
    console.log('');
    console.log('| metric | min | median | max |');
    console.log('| --- | --- | --- | --- |');
    console.log(row('wall ms', walls));
    console.log(row('longtask max ms', longs));
    console.log(row('longtask count', counts));
    if (memKnown && mems.length === reps) console.log(row('memory delta bytes', mems));
    else console.log('| memory delta bytes | n/a | n/a | n/a |');
  } finally {
    await browser.close();
    server.close();
  }
})().catch(function (err) {
  var msg = err && err.message || String(err);
  if (msg.indexOf('REFUSE') !== -1) {
    console.error(msg);
    process.exit(2);
  }
  console.error('FAIL ' + (err && err.stack || err));
  process.exit(1);
});
