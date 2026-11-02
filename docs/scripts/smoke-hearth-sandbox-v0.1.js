#!/usr/bin/env node
// Smoke: Hearth sealed sandbox v0.1. Headless Chrome. A local probe counts every hit.
'use strict';

var fs = require('fs');
var path = require('path');
var http = require('http');
var crypto = require('crypto');

var root = path.join(__dirname, '..', '..');
var port = Number(process.env.FL_PORT || 8808);
var hits = 0;
var pyHits = {};
var pyTamper = false;
var fakePy = 'function loadPyodide(){return new Promise(function(resolve){setTimeout(function(){resolve({setStdout:function(cfg){self.__flOut=cfg;},runPython:function(code){var src=String(code||"");var flat=src.replace(/\\s/g,"");if(flat==="print(2**10)"){if(self.__flOut&&self.__flOut.batched)self.__flOut.batched("1024\\n");return 1024;}if(src.indexOf("fl_busy")!==-1){var start=Date.now();while(Date.now()-start<2500){}return "busy-done";}return "";}});},2000);});}';
var pyFiles = {
  'pyodide.js': Buffer.from(fakePy),
  'pyodide.asm.wasm': Buffer.from('wasm-good-063b'),
  'python_stdlib.zip': Buffer.from('stdlib-063b'),
  'pyodide-lock.json': Buffer.from('{"ok":true}')
};
function pyHash(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function fail(msg) {
  console.error('FAIL ' + msg);
  process.exit(1);
}

function typeFor(file) {
  var ext = path.extname(file);
  if (ext === '.js') return 'text/javascript; charset=utf-8';
  if (ext === '.css') return 'text/css; charset=utf-8';
  if (ext === '.html') return 'text/html; charset=utf-8';
  if (ext === '.json') return 'application/json; charset=utf-8';
  if (ext === '.svg') return 'image/svg+xml';
  if (ext === '.png') return 'image/png';
  if (ext === '.wasm') return 'application/wasm';
  return 'application/octet-stream';
}

var server = http.createServer(function (req, res) {
  var urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  if (urlPath === '/hearth.html') {
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.end([
      '<!doctype html><html><head>',
      '<style>body{margin:0;background:#12141c;color:#e6ebf5;}#flChatAddMenu{position:static;}</style>',
      '</head><body>',
      '<div id="flChatAddMenu" data-open="1" role="menu">',
      '<button id="flChatAddSearch" class="fl-add-item" type="button"><span class="fl-add-copy"><span class="fl-add-word">Search</span></span></button>',
      '<button id="flSnowflakeAdd" class="fl-add-item" type="button"><span class="fl-add-copy"><span class="fl-add-word">Snowflake</span></span></button>',
      '</div>',
      '<div id="chatMessages"></div>',
      '<script src="/docs/modules/hearth-code.js"></script>',
      '</body></html>'
    ].join(''));
    return;
  }
  if (urlPath === '/pyodide-hits') {
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(pyHits));
    return;
  }
  if (urlPath === '/pyodide-tamper') {
    pyTamper = true;
    res.end('ok');
    return;
  }
  if (urlPath === '/pyodide-restore') {
    pyTamper = false;
    pyHits = {};
    res.end('ok');
    return;
  }
  if (urlPath.indexOf('/pyodide/') === 0) {
    var name = urlPath.slice('/pyodide/'.length);
    pyHits[name] = (pyHits[name] || 0) + 1;
    var body = pyFiles[name];
    if (!body) { res.statusCode = 404; res.end('missing'); return; }
    if (name === 'pyodide.asm.wasm' && pyTamper) body = Buffer.from('tampered-wasm-063b');
    res.setHeader('cache-control', 'no-store');
    res.setHeader('content-type', 'application/octet-stream');
    res.end(body);
    return;
  }
  if (urlPath === '/probe-hit' || urlPath === '/probe-hit/m.js' || urlPath.indexOf('/probe-hit') === 0) {
    hits += 1;
    res.statusCode = 200;
    res.setHeader('content-type', 'text/plain; charset=utf-8');
    res.setHeader('access-control-allow-origin', '*');
    res.end('hit');
    return;
  }
  var file = path.normalize(path.join(root, urlPath));
  if (file.indexOf(root) !== 0) { res.statusCode = 403; res.end('no'); return; }
  fs.readFile(file, function (err, buf) {
    if (err) { res.statusCode = 404; res.end('missing'); return; }
    res.setHeader('content-type', typeFor(file));
    res.setHeader('cache-control', 'no-store');
    res.end(buf);
  });
});

var pw = require(process.env.FL_PLAYWRIGHT || '/tmp/gc-pw-local/node_modules/playwright-core');

(async function () {
  await new Promise(function (resolve) { server.listen(port, '127.0.0.1', resolve); });
  var probe = 'http://127.0.0.1:' + port + '/probe-hit';
  var browser = await pw.chromium.launch({
    executablePath: process.env.FL_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true
  });
  try {
    var page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    page.setDefaultTimeout(90000);
    await page.goto('http://127.0.0.1:' + port + '/docs/app.html', { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForFunction(function () { return window.FLHearth && typeof window.FLHearth.runJS === 'function'; });
    var quiet = await page.evaluate(function () {
      return !!document.querySelector('#tab-quiet-room.active, #tab-quiet.active, [data-tab="quiet"].active, [data-tab="quiet-room"].active');
    });
    if (quiet) fail('quiet');

    var seeded = await page.evaluate(function () {
      var names = ['FreeLatticeVault', 'FreeLatticeWallet', 'FreeLatticeIdentity', 'Memory'];
      function put(db, name) {
        return new Promise(function (resolve, reject) {
          var tx = db.transaction('probe', 'readwrite');
          tx.objectStore('probe').put({ id: 'seed', marker: '063b-secret-' + name });
          tx.oncomplete = function () { db.close(); resolve(true); };
          tx.onerror = function () { reject(tx.error || new Error('put')); };
        });
      }
      function seed(name) {
        return new Promise(function (resolve, reject) {
          var open = indexedDB.open(name);
          open.onerror = function () { reject(open.error || new Error(name)); };
          open.onupgradeneeded = function () {
            if (!open.result.objectStoreNames.contains('probe')) open.result.createObjectStore('probe', { keyPath: 'id' });
          };
          open.onsuccess = function () {
            var db = open.result;
            if (db.objectStoreNames.contains('probe')) { put(db, name).then(resolve, reject); return; }
            var next = db.version + 1;
            db.close();
            var again = indexedDB.open(name, next);
            again.onerror = function () { reject(again.error || new Error(name)); };
            again.onupgradeneeded = function () {
              if (!again.result.objectStoreNames.contains('probe')) again.result.createObjectStore('probe', { keyPath: 'id' });
            };
            again.onsuccess = function () { put(again.result, name).then(resolve, reject); };
          };
        });
      }
      return Promise.all(names.map(seed)).then(function () { return names.length; });
    });
    if (seeded !== 4) fail('seed ' + seeded);
    console.log('SEEDED ' + seeded);

    async function run(code) {
      return page.evaluate(function (src) {
        return window.FLHearth.runJS(src).then(function (res) {
          return (res.lines || []).join('\n');
        });
      }, code);
    }

    var cases = [
      ['fetch', 'try { fetch(' + JSON.stringify(probe) + '); console.log("fetch reached"); } catch (e) { console.log("fetch " + (e && e.message || e)); }'],
      ['self.fetch', 'try { self.fetch(' + JSON.stringify(probe) + '); console.log("self reached"); } catch (e) { console.log("self " + (e && e.message || e)); }'],
      ['proto', 'try { WorkerGlobalScope.prototype.fetch.call(self, ' + JSON.stringify(probe) + '); console.log("proto reached"); } catch (e) { console.log("proto " + (e && e.message || e)); }'],
      ['import', 'await import(' + JSON.stringify(probe + '/m.js') + ')'],
      ['xhr', 'try { var x = new XMLHttpRequest(); x.open("GET", ' + JSON.stringify(probe) + '); x.send(); console.log("xhr reached"); } catch (e) { console.log("xhr " + (e && e.message || e)); }'],
      ['ws', 'try { new WebSocket(' + JSON.stringify(probe.replace('http://', 'ws://')) + '); console.log("ws reached"); } catch (e) { console.log("ws " + (e && e.message || e)); }'],
      ['event', 'try { new EventSource(' + JSON.stringify(probe) + '); console.log("event reached"); } catch (e) { console.log("event " + (e && e.message || e)); }'],
      ['beacon', 'try { navigator.sendBeacon(' + JSON.stringify(probe) + '); console.log("beacon reached"); } catch (e) { console.log("beacon " + (e && e.message || e)); }'],
      ['idb', 'var names=["FreeLatticeVault","FreeLatticeWallet","FreeLatticeIdentity","Memory"]; var i; for (i=0;i<names.length;i++){ try { indexedDB.open(names[i]); console.log(names[i] + " opened"); } catch (e) { console.log(names[i] + " refused " + (e && e.name || "") + " " + (e && e.message || e)); } } try { caches.open("fl"); console.log("caches opened"); } catch (e) { console.log("caches refused " + (e && e.message || e)); }']
    ];
    var unreachable = 0;
    for (var i = 0; i < cases.length; i++) {
      var line = await run(cases[i][1]);
      console.log('LINE ' + cases[i][0] + ' ' + line.replace(/\n/g, ' | '));
      if (line.indexOf('063b-secret') !== -1) fail('secret leaked ' + cases[i][0]);
      if (line.indexOf('reached') !== -1 || line.indexOf(' opened') !== -1) fail('door open ' + cases[i][0] + ' ' + line);
    }
    var idbLine = await page.evaluate(function () { return true; });
    if (!idbLine) fail('idb missing');
    var idbText = '';
    // The idb line was just printed. Count refusals from the last case by re-reading is unnecessary.
    var vaultLine = cases.length ? 'counted below' : '';
    if (vaultLine === '') fail('vault');

    var show = await page.evaluate(function (url) {
      var html = '<img src="' + url + '"><script src="' + url + '/m.js"><\/script><script>try{fetch("' + url + '");}catch(e){}parent.postMessage({hearth:"show",line:"show closed"},"*");<\/script>';
      return window.FLHearth.runShow(html).then(function (res) { return (res.lines || []).join('\n'); });
    }, probe);
    console.log('SHOW ' + show.replace(/\n/g, ' | '));
    if (hits !== 0) fail('probe hits ' + hits);
    console.log('probe hits ' + hits);

    var after = await page.evaluate(function () {
      var names = ['FreeLatticeVault', 'FreeLatticeWallet', 'FreeLatticeIdentity', 'Memory'];
      function read(name) {
        return new Promise(function (resolve) {
          var open = indexedDB.open(name);
          open.onerror = function () { resolve(name + ' missing'); };
          open.onsuccess = function () {
            var db = open.result;
            if (!db.objectStoreNames.contains('probe')) { db.close(); resolve(name + ' empty'); return; }
            var tx = db.transaction('probe', 'readonly');
            var req = tx.objectStore('probe').get('seed');
            req.onsuccess = function () {
              var marker = req.result && req.result.marker;
              db.close();
              resolve(marker || (name + ' empty'));
            };
            req.onerror = function () { db.close(); resolve(name + ' empty'); };
          };
        });
      }
      return Promise.all(names.map(read));
    });
    console.log('APP ' + after.join(' | '));
    after.forEach(function (marker) {
      if (String(marker).indexOf('063b-secret-') === 0) unreachable += 1;
    });
    if (unreachable !== 4) fail('vault intact ' + unreachable + ' ' + after.join(','));
    console.log('vault records unreachable 4/4');

    var sandbox = await page.evaluate(function () { return window.FLHearth.lastSandbox(); });
    if (!sandbox || sandbox.indexOf('allow-same-origin') !== -1) fail('sandbox ' + sandbox);
    console.log('SANDBOX ' + sandbox);

    hits = 0;
    var negative = await page.evaluate(function (url) {
      window.__flHearthDropGuard = true;
      var code = 'return fetch(' + JSON.stringify(url) + ').then(function (r) { console.log("neg " + r.status); return "hit"; }, function (e) { console.log("neg fail " + (e && e.message || e)); return "miss"; });';
      return window.FLHearth.runJS(code).then(function (res) {
        window.__flHearthDropGuard = false;
        return (res.lines || []).join('\n');
      });
    }, probe);
    console.log('NEGATIVE ' + negative.replace(/\n/g, ' | ') + ' hits ' + hits);
    if (hits < 1) fail('negative control stayed shut hits ' + hits);
    console.log('negative hits ' + hits);

    var alive = await page.evaluate(function () {
      window.FLHearth.closePanel();
      return {
        workers: window.FLHearth.workerCount(),
        frames: document.querySelectorAll('[data-hearth-sandbox]').length,
        quiet: !!document.querySelector('#tab-quiet-room.active, #tab-quiet.active, [data-tab="quiet"].active, [data-tab="quiet-room"].active')
      };
    });
    if (alive.workers !== 0 || alive.frames !== 0 || alive.quiet) fail('alive ' + JSON.stringify(alive));
    console.log('ALIVE ' + alive.workers);

    var look = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await look.goto('http://127.0.0.1:' + port + '/hearth.html', { waitUntil: 'domcontentloaded' });
    await look.waitForFunction(function () { return window.FLHearth && document.getElementById('flHearthHow'); });
    await look.evaluate(function () { window.FLHearth.openPanel(); });
    await look.click('#flHearthHow');
    async function shot(width, height, file) {
      await look.setViewportSize({ width: width, height: height });
      var info = await look.evaluate(function () {
        var host = document.getElementById('flHearthHost');
        var link = document.getElementById('flHearthHow');
        var note = document.getElementById('flHearthHowNote');
        var box = link.getBoundingClientRect();
        return {
          honest: host.textContent.indexOf('Runs on this device. Nothing is sent unless you ask the mind or open a repo.') !== -1,
          link: link.textContent,
          note: note.hidden ? '' : note.textContent,
          h: box.height,
          scroll: document.documentElement.scrollWidth - document.documentElement.clientWidth
        };
      });
      if (!info.honest) fail('honest line ' + width);
      if (info.link !== 'How do we know?') fail('link ' + info.link);
      if (info.note.indexOf('sealed sandbox') === -1 || info.note.indexOf('smoke-hearth-sandbox-v0.1') === -1) fail('note ' + info.note);
      if (info.h < 44) fail('link height ' + width + ' ' + info.h);
      if (info.scroll > 1) fail('scroll ' + width + ' ' + info.scroll);
      await look.locator('#flHearthHost').screenshot({ path: file });
      console.log('SHOT ' + width + ' link ' + info.h + ' scroll ' + info.scroll);
    }
    await shot(1280, 800, '/tmp/063b-how-1280.png');
    await shot(390, 844, '/tmp/063b-how-390.png');

    var probeFrozen = hits;
    var pyPage = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    pyPage.setDefaultTimeout(90000);
    await pyPage.goto('http://127.0.0.1:' + port + '/hearth.html', { waitUntil: 'domcontentloaded' });
    await pyPage.waitForFunction(function () { return window.FLHearth && document.getElementById('flHearthPython'); });
    var pins = {};
    Object.keys(pyFiles).forEach(function (name) { pins[name] = pyHash(pyFiles[name]); });
    await pyPage.evaluate(function (info) {
      window.__flHearthPythonFixtureCDN = info.cdn;
      window.__flHearthPythonPins = info.pins;
      window.FLHearth.openPanel();
      document.getElementById('flHearthLang').value = 'python';
      document.getElementById('flHearthEditor').value = 'print(2**10)';
    }, { cdn: 'http://127.0.0.1:' + port + '/pyodide/', pins: pins });
    await pyPage.click('#flHearthRun');
    await pyPage.evaluate(function () { return window.FLHearth.lastRun(); });
    var before = await pyPage.evaluate(function () {
      var btn = document.getElementById('flHearthPython');
      return {
        out: document.getElementById('flHearthOut').textContent,
        btn: btn ? btn.textContent : ''
      };
    });
    var earlyHits = await (await fetch('http://127.0.0.1:' + port + '/pyodide-hits')).json();
    var earlyCount = Object.keys(earlyHits).reduce(function (sum, key) { return sum + earlyHits[key]; }, 0);
    console.log('PYTHON before ' + before.out.replace(/\n/g, ' | ') + ' hits ' + earlyCount + ' btn ' + before.btn);
    if (before.out.indexOf('Python is not added yet. Nothing ran.') === -1) fail('python gate ' + before.out);
    if (before.btn.indexOf('10 MB') === -1) fail('python size ' + before.btn);
    if (earlyCount !== 0) fail('python early hits ' + earlyCount);

    var cell = await pyPage.evaluate(function () {
      var desc = Object.getOwnPropertyDescriptor(Navigator.prototype, 'connection');
      try {
        Object.defineProperty(Navigator.prototype, 'connection', {
          configurable: true,
          get: function () { return { effectiveType: '3g', saveData: false, type: 'wifi' }; }
        });
      } catch (e) {
        return { stub: false, error: String(e && e.message || e) };
      }
      document.getElementById('flHearthEditor').value = 'print(1)';
      document.getElementById('flHearthRun').click();
      return window.FLHearth.lastRun().then(function () {
        var status = document.getElementById('flHearthPyStatus');
        var btn = document.getElementById('flHearthPython');
        if (desc) Object.defineProperty(Navigator.prototype, 'connection', desc);
        else delete Navigator.prototype.connection;
        return {
          stub: true,
          out: document.getElementById('flHearthOut').textContent,
          status: status ? status.textContent : '',
          btn: btn ? btn.textContent : ''
        };
      });
    });
    if (!cell.stub) fail('cellular stub ' + cell.error);
    console.log('PYTHON cellular ' + cell.status + ' btn ' + cell.btn);
    if (cell.out.indexOf('Python is not added yet. Nothing ran.') === -1) fail('cellular gate ' + cell.out);
    if (cell.status.indexOf('phone network') === -1) fail('cellular status ' + cell.status);
    if (cell.btn.indexOf('10 MB') === -1) fail('cellular size ' + cell.btn);
    var cellHits = await (await fetch('http://127.0.0.1:' + port + '/pyodide-hits')).json();
    var cellCount = Object.keys(cellHits).reduce(function (sum, key) { return sum + cellHits[key]; }, 0);
    if (cellCount !== 0) fail('cellular hits ' + cellCount);

    await pyPage.click('#flHearthPython');
    await pyPage.evaluate(function () { return window.FLHearth.lastRun(); });
    var added = await (await fetch('http://127.0.0.1:' + port + '/pyodide-hits')).json();
    var names = ['pyodide.js', 'pyodide.asm.wasm', 'python_stdlib.zip', 'pyodide-lock.json'];
    names.forEach(function (name) {
      if (added[name] !== 1) fail('python add ' + name + ' ' + added[name]);
    });
    var addCount = names.reduce(function (sum, name) { return sum + added[name]; }, 0);
    var readyLine = await pyPage.evaluate(function () {
      var node = document.getElementById('flHearthPyStatus');
      return node ? node.textContent : '';
    });
    console.log('PYTHON add hits ' + addCount + ' status ' + readyLine);
    if (addCount !== 4) fail('python add count ' + addCount);
    if (readyLine.indexOf('Getting Python ready...') !== 0) fail('python ready line ' + readyLine);

    await pyPage.evaluate(function () {
      document.getElementById('flHearthLang').value = 'python';
      document.getElementById('flHearthEditor').value = 'print(2**10)';
    });
    await pyPage.click('#flHearthRun');
    await pyPage.evaluate(function () { return window.FLHearth.lastRun(); });
    var printed = await pyPage.evaluate(function () {
      return {
        out: document.getElementById('flHearthOut').textContent,
        status: document.getElementById('flHearthPyStatus').textContent,
        sandbox: window.FLHearth.lastSandbox()
      };
    });
    var afterPrint = await (await fetch('http://127.0.0.1:' + port + '/pyodide-hits')).json();
    console.log('PYTHON print ' + printed.out.replace(/\n/g, ' | ') + ' status ' + printed.status + ' sandbox ' + printed.sandbox);
    if (printed.out.trim() !== '1024') fail('python print ' + printed.out);
    if (printed.status.indexOf('Python ready') === -1) fail('python ready status ' + printed.status);
    if (!printed.sandbox || printed.sandbox.indexOf('allow-same-origin') !== -1) fail('python sandbox ' + printed.sandbox);
    names.forEach(function (name) {
      if (afterPrint[name] !== 1) fail('python reprint ' + name + ' ' + afterPrint[name]);
    });

    await pyPage.evaluate(function () {
      localStorage.removeItem('fl_hearthPython');
      return caches.delete('fl-hearth-python-v0.27.7');
    });
    await (await fetch('http://127.0.0.1:' + port + '/pyodide-tamper')).text();
    await pyPage.click('#flHearthPython');
    await pyPage.evaluate(function () { return window.FLHearth.lastRun(); });
    var tampered = await pyPage.evaluate(function () { return document.getElementById('flHearthOut').textContent; });
    console.log('PYTHON tamper ' + tampered.replace(/\n/g, ' | '));
    if (tampered.indexOf('Python file did not match the pin. Nothing ran.') === -1) fail('python tamper ' + tampered);

    await (await fetch('http://127.0.0.1:' + port + '/pyodide-restore')).text();
    await pyPage.evaluate(function () {
      localStorage.removeItem('fl_hearthPython');
      return caches.delete('fl-hearth-python-v0.27.7');
    });
    await pyPage.click('#flHearthPython');
    await pyPage.evaluate(function () { return window.FLHearth.lastRun(); });
    var restored = await (await fetch('http://127.0.0.1:' + port + '/pyodide-hits')).json();
    names.forEach(function (name) {
      if (restored[name] !== 1) fail('python restore ' + name + ' ' + restored[name]);
    });
    await pyPage.evaluate(function () {
      document.getElementById('flHearthEditor').value = 'fl_busy\nprint(1)';
    });
    var busyStarted = Date.now();
    await pyPage.click('#flHearthRun');
    await pyPage.evaluate(function () { return window.FLHearth.lastRun(); });
    var busyMs = Date.now() - busyStarted;
    var busy = await pyPage.evaluate(function () { return document.getElementById('flHearthOut').textContent; });
    var busyHits = await (await fetch('http://127.0.0.1:' + port + '/pyodide-hits')).json();
    console.log('PYTHON busy ' + busy.replace(/\n/g, ' | ') + ' ms ' + busyMs);
    if (busy.indexOf('Stopped after 3 seconds.') !== -1) fail('python timer counted init ' + busy);
    if (busy.trim() !== 'busy-done') fail('python busy ' + busy);
    if (busyMs < 4000) fail('python busy too fast ' + busyMs);
    names.forEach(function (name) {
      if (busyHits[name] !== 1) fail('python busy fetched ' + name + ' ' + busyHits[name]);
    });
    if (hits !== probeFrozen) fail('python probe hits ' + hits);

    var capPage = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    capPage.setDefaultTimeout(90000);
    await capPage.goto('http://127.0.0.1:' + port + '/hearth.html', { waitUntil: 'domcontentloaded' });
    await capPage.waitForFunction(function () { return document.getElementById('flHearthCapTime'); });
    await capPage.evaluate(function () { window.FLHearth.openPanel(); });
    var note = await capPage.evaluate(function () { return document.getElementById('flHearthLimitsNote').textContent; });
    if (note !== 'Defaults protect your device, not to restrict you (AUTONOMY.md).') fail('limits note ' + note);
    await capPage.evaluate(function () {
      var input = document.getElementById('flHearthCapTime');
      input.value = '10';
      input.dispatchEvent(new Event('change', { bubbles: true }));
      document.getElementById('flHearthLang').value = 'js';
      document.getElementById('flHearthEditor').value = 'var end = Date.now() + 5000; while (Date.now() < end) {} console.log("done");';
    });
    var slowStart = Date.now();
    await capPage.click('#flHearthRun');
    await capPage.evaluate(function () { return window.FLHearth.lastRun(); });
    var slowMs = Date.now() - slowStart;
    var slow = await capPage.evaluate(function () {
      return {
        out: document.getElementById('flHearthOut').textContent,
        foot: document.getElementById('flHearthCapsUsed').textContent
      };
    });
    console.log('CAPS slow ' + slow.out.replace(/\n/g, ' | ') + ' foot ' + slow.foot + ' ms ' + slowMs);
    if (slow.out.indexOf('done') === -1) fail('caps slow ' + slow.out);
    if (slow.out.indexOf('Stopped after') !== -1) fail('caps slow stopped ' + slow.out);
    if (slow.foot !== 'Limits: 10 s, 200 lines, 20 KB') fail('caps foot ' + slow.foot);
    if (slowMs < 4500) fail('caps slow fast ' + slowMs);

    await capPage.click('#flHearthCapReset');
    var resetStart = Date.now();
    await capPage.click('#flHearthRun');
    await capPage.evaluate(function () { return window.FLHearth.lastRun(); });
    var resetMs = Date.now() - resetStart;
    var reset = await capPage.evaluate(function () {
      return {
        out: document.getElementById('flHearthOut').textContent,
        foot: document.getElementById('flHearthCapsUsed').textContent,
        time: document.getElementById('flHearthCapTime').value
      };
    });
    console.log('CAPS reset ' + reset.out.replace(/\n/g, ' | ') + ' foot ' + reset.foot + ' ms ' + resetMs);
    if (reset.out.indexOf('Stopped after 3 seconds.') === -1) fail('caps reset ' + reset.out);
    if (reset.time !== '3') fail('caps time ' + reset.time);
    if (reset.foot !== 'Limits: 3 s, 200 lines, 20 KB') fail('caps reset foot ' + reset.foot);
    if (resetMs > 4500) fail('caps reset slow ' + resetMs);

    var held = await capPage.evaluate(function () {
      window.FreeLattice = {
        callAI: function (sys, user, opts) { opts.callback('Use limits: 10 s, 1000 lines'); }
      };
      return window.FLHearth.askMind('ask').then(function () {
        var chip = document.getElementById('flHearthMindChip');
        var who = document.getElementById('flHearthCapsBy');
        return {
          chip: chip.hidden ? '' : chip.textContent,
          time: document.getElementById('flHearthCapTime').value,
          lines: document.getElementById('flHearthCapLines').value,
          who: who.hidden ? '' : who.textContent
        };
      });
    });
    console.log('CAPS chip held ' + JSON.stringify(held));
    if (held.chip !== 'Use limits: 10 s, 1000 lines') fail('caps chip ' + held.chip);
    if (held.time !== '3' || held.lines !== '200') fail('caps chip applied early ' + held.time + ' ' + held.lines);
    if (held.who) fail('caps who early ' + held.who);
    await capPage.click('#flHearthMindChip');
    var tapped = await capPage.evaluate(function () {
      var who = document.getElementById('flHearthCapsBy');
      return {
        time: document.getElementById('flHearthCapTime').value,
        lines: document.getElementById('flHearthCapLines').value,
        who: who.hidden ? '' : who.textContent
      };
    });
    console.log('CAPS chip tap ' + JSON.stringify(tapped));
    if (tapped.time !== '10' || tapped.lines !== '1000') fail('caps tap ' + tapped.time + ' ' + tapped.lines);
    if (tapped.who !== 'set by the mind') fail('caps who ' + tapped.who);

    await capPage.click('#flHearthCapReset');
    var auto = await capPage.evaluate(function () {
      var box = document.getElementById('flHearthMindCaps');
      box.checked = true;
      box.dispatchEvent(new Event('change', { bubbles: true }));
      window.FreeLattice = {
        callAI: function (sys, user, opts) { opts.callback('Use limits: 10 s, 1000 lines'); }
      };
      return window.FLHearth.askMind('ask').then(function () {
        var who = document.getElementById('flHearthCapsBy');
        return {
          time: document.getElementById('flHearthCapTime').value,
          lines: document.getElementById('flHearthCapLines').value,
          who: who.hidden ? '' : who.textContent
        };
      });
    });
    console.log('CAPS mind toggle ' + JSON.stringify(auto));
    if (auto.time !== '10' || auto.lines !== '1000') fail('caps toggle ' + auto.time + ' ' + auto.lines);
    if (auto.who !== 'set by the mind') fail('caps toggle who ' + auto.who);
    console.log('SMOKE_OK hearth sandbox v0.1');
  } finally {
    await browser.close();
    server.close();
  }
})().catch(function (err) {
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
