#!/usr/bin/env node
// Smoke: Hearth real Pyodide 0.27.7. Headless Chrome. No stand-in files.
'use strict';

var fs = require('fs');
var path = require('path');
var http = require('http');
var crypto = require('crypto');

var root = path.join(__dirname, '..', '..');
var port = Number(process.env.FL_PORT || 8838);
var mirror = process.env.FL_PYODIDE || '/tmp/pyodide-0.27.7';
var names = ['pyodide.js', 'pyodide.asm.js', 'pyodide.asm.wasm', 'python_stdlib.zip', 'pyodide-lock.json'];
var pins = {
  'pyodide.js': 'b4cb23a53aba19c221659b9fb40a2f18281d685691dc06647fb0afd0681baf98',
  'pyodide.asm.js': '6b4c90de5b7172873f04f21884d0e9d2274e305fe32116558fe3e4fbe3618d51',
  'pyodide.asm.wasm': 'a50dd1843f805a0b7c45b61037ee0d7b26dfe85efe0e18ef95a34ad24e401f5f',
  'python_stdlib.zip': '16611534726e5d8ac2bd8f926410b2dcb8d6f49aa24913463533b457a2115c16',
  'pyodide-lock.json': '9c45b916001a750f4102fc287494f3eab215909c7535c626a20db80fd6333e2c'
};
var files = {};
names.forEach(function (name) {
  var buf = fs.readFileSync(path.join(mirror, name));
  var hex = crypto.createHash('sha256').update(buf).digest('hex');
  if (hex !== pins[name]) {
    console.error('FAIL hash ' + name + ' ' + hex);
    process.exit(1);
  }
  files[name] = buf;
  console.log('hash ' + name + ' ' + hex + ' ' + buf.length);
});

var hits = {};
var tamperAsm = false;
var loopIters = 9500000;

function fail(msg) {
  console.error('FAIL ' + msg);
  process.exit(1);
}

function typeFor(name) {
  if (name.endsWith('.js')) return 'text/javascript';
  if (name.endsWith('.wasm')) return 'application/wasm';
  if (name.endsWith('.json')) return 'application/json';
  if (name.endsWith('.zip')) return 'application/zip';
  return 'application/octet-stream';
}

function hitCount() {
  return names.reduce(function (sum, name) { return sum + (hits[name] || 0); }, 0);
}

var server = http.createServer(function (req, res) {
  var urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  if (urlPath === '/py.html') {
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.end('<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;background:#12141c;color:#e6ebf5"><div id="chatMessages"></div><script src="/docs/modules/hearth-code.js"></script></body></html>');
    return;
  }
  if (urlPath === '/py-hits') {
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(hits));
    return;
  }
  if (urlPath === '/py-reset') {
    hits = {};
    res.end('ok');
    return;
  }
  if (urlPath === '/py-tamper') {
    tamperAsm = true;
    res.end('ok');
    return;
  }
  if (urlPath.indexOf('/pyodide/v0.27.7/full/') === 0) {
    var name = path.basename(urlPath);
    hits[name] = (hits[name] || 0) + 1;
    var body = files[name];
    if (!body) { res.statusCode = 404; res.end('missing'); return; }
    if (name === 'pyodide.asm.js' && tamperAsm) body = Buffer.from('tampered-asm-063c');
    res.setHeader('cache-control', 'no-store');
    res.setHeader('content-type', typeFor(name));
    res.end(body);
    return;
  }
  var file = path.normalize(path.join(root, urlPath));
  if (file.indexOf(root) !== 0) { res.statusCode = 403; res.end('no'); return; }
  fs.readFile(file, function (err, buf) {
    if (err) {
      if (urlPath !== '/favicon.ico') console.log('MISS ' + urlPath);
      res.statusCode = 404;
      res.end('missing');
      return;
    }
    var ext = path.extname(file);
    var kind = ext === '.js' ? 'text/javascript; charset=utf-8' : 'application/octet-stream';
    res.setHeader('content-type', kind);
    res.setHeader('cache-control', 'no-store');
    res.end(buf);
  });
});

function wait(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

var pw = require(process.env.FL_PLAYWRIGHT || '/tmp/gc-pw-local/node_modules/playwright-core');

(async function () {
  await new Promise(function (resolve) { server.listen(port, '127.0.0.1', resolve); });
  var cdn = 'http://127.0.0.1:' + port + '/pyodide/v0.27.7/full/';
  var browser = await pw.chromium.launch({
    executablePath: process.env.FL_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true
  });
  try {
    var context = await browser.newContext();
    var page = await context.newPage();
    page.setDefaultTimeout(180000);
    page.on('console', function (msg) {
      var t = msg.type();
      if (t === 'error' || t === 'warning') console.log('BROWSER ' + t + ' ' + msg.text());
    });
    page.on('pageerror', function (err) { console.log('PAGEERROR ' + err.message); });
    await page.goto('http://127.0.0.1:' + port + '/py.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(function () { return window.FLHearth && document.getElementById('flHearthPython'); });
    var quiet = await page.evaluate(function (base) {
      localStorage.setItem('fl_testHooks', '1');
      window.__flHearthPythonFixtureCDN = base;
      window.FLHearth.openPanel();
      document.getElementById('flHearthLang').value = 'python';
      document.getElementById('flHearthEditor').value = 'print(1+1)';
      return !!document.querySelector('#tab-quiet-room.active, #tab-quiet.active, [data-tab="quiet"].active, [data-tab="quiet-room"].active');
    }, cdn);
    if (quiet) fail('quiet room open');

    await page.click('#flHearthRun');
    await page.evaluate(function () { return window.FLHearth.lastRun(); });
    await wait(300);
    var before = await page.evaluate(function () {
      return document.getElementById('flHearthOut').textContent;
    });
    var beforeHits = hitCount();
    console.log('before tap -> ' + beforeHits + '  ' + before.replace(/\n/g, ' | '));
    if (before.indexOf('Python is not added yet. Nothing ran.') === -1) fail('before tap text ' + before);
    if (beforeHits !== 0) fail('before tap hits ' + beforeHits);

    var addStarted = Date.now();
    await page.click('#flHearthPython');
    await page.evaluate(function () { return window.FLHearth.lastRun(); });
    var added = hitCount();
    var addStatus = await page.evaluate(function () {
      var node = document.getElementById('flHearthPyStatus');
      return node ? node.textContent : '';
    });
    console.log('Add Python -> ' + added + ' downloads  status ' + addStatus + '  ms ' + (Date.now() - addStarted));
    names.forEach(function (name) {
      if (hits[name] !== 1) fail('download ' + name + ' ' + hits[name]);
    });
    if (added !== 5) fail('download count ' + added);

    var runStarted = Date.now();
    await page.click('#flHearthRun');
    await page.evaluate(function () { return window.FLHearth.lastRun(); });
    var printed = await page.evaluate(function () {
      var status = document.getElementById('flHearthPyStatus');
      return {
        out: document.getElementById('flHearthOut').textContent,
        status: status ? status.textContent : ''
      };
    });
    var readyMs = Date.now() - runStarted;
    console.log('print(1+1) -> ' + printed.out.trim() + '  status ' + printed.status + '  ready ms ' + readyMs);
    if (printed.out.trim() !== '2') fail('print ' + printed.out);
    if (printed.status.indexOf('Python ready') === -1) fail('ready ' + printed.status);
    if (hitCount() !== 5) fail('run fetched more ' + hitCount());

    var loopCode = [
      'n = 0',
      'i = 0',
      'while i < ' + loopIters + ':',
      '    n += i',
      '    i += 1',
      'print(n)'
    ].join('\n');
    var loopExpect = String((loopIters - 1) * loopIters / 2);
    await page.evaluate(function (src) {
      document.getElementById('flHearthEditor').value = src;
      var status = document.getElementById('flHearthPyStatus');
      if (status) status.textContent = '';
    }, loopCode);
    var readyAt = 0;
    var readyWatch = page.waitForFunction(function () {
      var status = document.getElementById('flHearthPyStatus');
      return status && status.textContent.indexOf('Python ready') !== -1;
    }).then(function () { readyAt = Date.now(); });
    await page.click('#flHearthRun');
    await page.evaluate(function () { return window.FLHearth.lastRun(); });
    await readyWatch;
    var loopMs = Date.now() - readyAt;
    var loopOut = await page.evaluate(function () { return document.getElementById('flHearthOut').textContent; });
    console.log('loop -> ' + loopOut.trim() + '  after ready ms ' + loopMs);
    if (loopOut.indexOf('Stopped after') !== -1) fail('loop hit the cap ' + loopOut + ' ms ' + loopMs);
    if (loopOut.trim() !== loopExpect) fail('loop value ' + loopOut + ' expected ' + loopExpect);
    if (loopMs >= 3000) fail('loop counted past the cap ' + loopMs);
    if (loopMs < 1500) fail('loop was shorter than 2 s ' + loopMs);

    await page.evaluate(function () {
      localStorage.removeItem('fl_hearthPython');
      return caches.delete('fl-hearth-python-v0.27.7');
    });
    await (await fetch('http://127.0.0.1:' + port + '/py-tamper')).text();
    await (await fetch('http://127.0.0.1:' + port + '/py-reset')).text();
    hits = {};
    await page.click('#flHearthPython');
    await page.evaluate(function () { return window.FLHearth.lastRun(); });
    var tampered = await page.evaluate(function () { return document.getElementById('flHearthOut').textContent; });
    console.log('tampered pyodide.asm.js -> ' + tampered.replace(/\n/g, ' | '));
    if (tampered.indexOf('Python file did not match the pin. Nothing ran.') === -1) fail('tamper ' + tampered);

    console.log('SMOKE_OK hearth python real v0.1');
  } finally {
    await browser.close();
    server.close();
  }
})().catch(function (e) {
  console.error('FAIL ' + (e && e.stack || e));
  process.exit(1);
});
