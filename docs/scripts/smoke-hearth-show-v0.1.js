#!/usr/bin/env node
// Smoke: Hearth Show it, scriptless render, v0.1. Headless Chrome. A local probe counts every hit.
'use strict';

var fs = require('fs');
var path = require('path');
var http = require('http');

var root = path.join(__dirname, '..', '..');
var port = Number(process.env.FL_PORT || 8836);
var hits = 0;
var STOP = 'This sketch tried to leave the page, so Hearth stopped it.';

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
  return 'application/octet-stream';
}

var server = http.createServer(function (req, res) {
  var urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  if (urlPath === '/show.html') {
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.end([
      '<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;background:#12141c;color:#e6ebf5">',
      '<div id="chatMessages"></div>',
      '<script src="/docs/modules/hearth-code.js"></script>',
      '</body></html>'
    ].join(''));
    return;
  }
  if (urlPath === '/probe-hit' || urlPath.indexOf('/probe-hit') === 0) {
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

function wait(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

var pw = require(process.env.FL_PLAYWRIGHT || '/tmp/gc-pw-local/node_modules/playwright-core');

(async function () {
  await new Promise(function (resolve) { server.listen(port, '127.0.0.1', resolve); });
  var probe = 'http://127.0.0.1:' + port + '/probe-hit';
  var q = JSON.stringify(probe);
  var browser = await pw.chromium.launch({
    executablePath: process.env.FL_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true
  });
  var bad = [];
  function row(name, n, extra) {
    var line = name + ' -> ' + n + (extra ? '  ' + extra : '');
    console.log(line);
    if (n !== 0) bad.push(line);
  }
  try {
    var page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    page.setDefaultTimeout(20000);
    await page.goto('http://127.0.0.1:' + port + '/show.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(function () { return window.FLHearth && typeof window.FLHearth.runShow === 'function'; });
    var quiet = await page.evaluate(function () {
      localStorage.removeItem('fl_testHooks');
      window.FLHearth.openPanel();
      return !!document.querySelector('#tab-quiet-room.active, #tab-quiet.active, [data-tab="quiet"].active, [data-tab="quiet-room"].active');
    });
    if (quiet) fail('quiet room open');

    async function show(html) {
      return page.evaluate(async function (src) {
        var res = await window.FLHearth.runShow(src);
        var frame = document.querySelector('#flHearthStage iframe');
        var out = document.getElementById('flHearthOut');
        return {
          lines: (res && res.lines || []).join(' | '),
          sandbox: frame ? frame.getAttribute('sandbox') : null,
          out: out ? out.textContent : '',
          frame: !!frame
        };
      }, html);
    }

    async function poke() {
      var box = page.frameLocator('#flHearthStage iframe');
      try { await box.locator('a, area, image, span, button').first().click({ timeout: 500, force: true }); } catch (e) {}
      try {
        if (await box.locator('form').count()) {
          await box.locator('form').evaluate(function (form) { form.submit(); });
        }
      } catch (e2) {}
    }

    var markup = [
      ['benign paragraph', '<p>Hello from Hearth</p>', 'stay'],
      ['location.href', '<script>location.href=' + q + '<\/script>'],
      ['location.assign', '<script>location.assign(' + q + ')<\/script>'],
      ['location.replace', '<script>location.replace(' + q + ')<\/script>'],
      ['window.open', '<script>window.open(' + q + ')<\/script>'],
      ['top.location', '<script>top.location=' + q + '<\/script>'],
      ['parent.location', '<script>parent.location=' + q + '<\/script>'],
      ['meta refresh', '<meta http-equiv="refresh" content="0;url=' + probe + '">'],
      ['meta REFRESH', '<meta http-equiv="REFRESH" content="0;url=' + probe + '">'],
      ['meta extra spaces', '<meta http-equiv="  refresh  " content="0; url=' + probe + '">'],
      ['meta url=', '<meta http-equiv="refresh" content="0; URL=' + probe + '">'],
      ['a href click', '<a id="go" href="' + probe + '">go</a>', 'click'],
      ['a target blank', '<a href="' + probe + '" target="_blank">go</a>', 'click'],
      ['area href', '<map name="m"><area shape="rect" coords="0,0,40,40" href="' + probe + '"></map><img alt="dot" src="data:image/png;base64,iVBORw0KGgo=" usemap="#m" width="40" height="40">', 'click'],
      ['form action', '<form action="' + probe + '" method="get"><button type="submit">go</button></form>', 'click'],
      ['base plus img', '<base href="' + probe + '/"><img src="x.png" alt="">'],
      ['img src', '<img src="' + probe + '" alt="">'],
      ['img srcset', '<img srcset="' + probe + ' 1x, ' + probe + '/b 2x" alt="">'],
      ['link stylesheet', '<link rel="stylesheet" href="' + probe + '">'],
      ['link preload', '<link rel="preload" href="' + probe + '" as="fetch">'],
      ['link prefetch', '<link rel="prefetch" href="' + probe + '">'],
      ['link dns-prefetch', '<link rel="dns-prefetch" href="' + probe + '">'],
      ['css url', '<div style="background:url(' + probe + ')"></div><style>body{background:url("' + probe + '")}</style>'],
      ['css import', '<style>@import url("' + probe + '");</style>'],
      ['font face', '<style>@font-face{font-family:x;src:url("' + probe + '")}</style>'],
      ['video poster', '<video poster="' + probe + '"></video>'],
      ['audio src', '<audio src="' + probe + '"></audio>'],
      ['iframe src', '<iframe src="' + probe + '"></iframe>'],
      ['object data', '<object data="' + probe + '"></object>'],
      ['embed src', '<embed src="' + probe + '">'],
      ['svg a xlink', '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><a xlink:href="' + probe + '"><text y="12">go</text></a></svg>', 'click'],
      ['svg image href', '<svg xmlns="http://www.w3.org/2000/svg"><image href="' + probe + '" width="10" height="10"></image></svg>'],
      ['svg animate href', '<svg xmlns="http://www.w3.org/2000/svg"><image href="data:image/png;base64,iVBORw0KGgo=" width="8" height="8"><animate attributeName="href" to="' + probe + '" begin="0s" dur="0.01s" fill="freeze"/></image></svg>'],
      ['ping', '<a href="' + probe + '" ping="' + probe + '">go</a>', 'click'],
      ['sendBeacon', '<script>navigator.sendBeacon(' + q + ')<\/script>'],
      ['fetch', '<script>fetch(' + q + ')<\/script>'],
      ['WebSocket', '<script>new WebSocket(' + JSON.stringify(probe.replace('http://', 'ws://')) + ')<\/script>'],
      ['Worker', '<script>new Worker(' + q + ')<\/script>'],
      ['import()', '<script>import(' + q + ')<\/script>']
    ];

    console.log('route -> hits');
    var i;
    for (i = 0; i < markup.length; i++) {
      hits = 0;
      var info = await show(markup[i][1]);
      if (markup[i][2] === 'click') {
        await poke();
        await wait(400);
      } else {
        await wait(250);
      }
      var guard = info.out === STOP ? 'guard' : '';
      row(markup[i][0], hits, guard);
      if (markup[i][2] === 'stay') {
        if (info.lines.indexOf('Shown.') === -1) bad.push('benign lines ' + info.lines);
        if (info.sandbox !== '') bad.push('sandbox ' + JSON.stringify(info.sandbox));
        if (!info.frame) bad.push('benign frame removed');
        console.log('sandbox attribute ' + JSON.stringify(info.sandbox));
      }
    }

    var workers = [
      ['fetch', 'try { fetch(' + q + '); console.log("reached"); } catch (e) { console.log("refused " + (e && e.message || e)); }'],
      ['self.fetch', 'try { self.fetch(' + q + '); console.log("reached"); } catch (e) { console.log("refused " + (e && e.message || e)); }'],
      ['proto fetch', 'try { WorkerGlobalScope.prototype.fetch.call(self, ' + q + '); console.log("reached"); } catch (e) { console.log("refused " + (e && e.message || e)); }'],
      ['import()', 'await import(' + q + ')'],
      ['xhr', 'try { var x = new XMLHttpRequest(); x.open("GET", ' + q + '); x.send(); console.log("reached"); } catch (e) { console.log("refused " + (e && e.message || e)); }'],
      ['websocket', 'try { new WebSocket(' + JSON.stringify(probe.replace('http://', 'ws://')) + '); console.log("reached"); } catch (e) { console.log("refused " + (e && e.message || e)); }'],
      ['eventsource', 'try { new EventSource(' + q + '); console.log("reached"); } catch (e) { console.log("refused " + (e && e.message || e)); }'],
      ['sendBeacon', 'try { navigator.sendBeacon(' + q + '); console.log("reached"); } catch (e) { console.log("refused " + (e && e.message || e)); }'],
      ['idb vault', 'try { indexedDB.open("FreeLatticeVault"); console.log("opened"); } catch (e) { console.log("refused " + (e && e.message || e)); }'],
      ['idb wallet', 'try { indexedDB.open("FreeLatticeWallet"); console.log("opened"); } catch (e) { console.log("refused " + (e && e.message || e)); }'],
      ['idb identity', 'try { indexedDB.open("FreeLatticeIdentity"); console.log("opened"); } catch (e) { console.log("refused " + (e && e.message || e)); }'],
      ['idb memory', 'try { indexedDB.open("Memory"); console.log("opened"); } catch (e) { console.log("refused " + (e && e.message || e)); }'],
      ['caches', 'try { caches.open("fl"); console.log("opened"); } catch (e) { console.log("refused " + (e && e.message || e)); }'],
      ['importScripts', 'try { importScripts(' + q + '); console.log("reached"); } catch (e) { console.log("refused " + (e && e.message || e)); }'],
      ['webtransport', 'try { new WebTransport(' + q + '); console.log("reached"); } catch (e) { console.log("refused " + (e && e.message || e)); }'],
      ['broadcast', 'try { new BroadcastChannel("fl"); console.log("reached"); } catch (e) { console.log("refused " + (e && e.message || e)); }'],
      ['new Worker', 'try { new Worker(' + q + '); console.log("reached"); } catch (e) { console.log("refused " + (e && e.message || e)); }'],
      ['location.href', 'try { location.href = ' + q + '; console.log("reached"); } catch (e) { console.log("refused " + (e && e.message || e)); }']
    ];
    for (i = 0; i < workers.length; i++) {
      hits = 0;
      var line = await show(workers[i][1]);
      await wait(300);
      if (line.lines.indexOf('reached') !== -1 || line.lines.indexOf('opened') !== -1) bad.push('worker door ' + workers[i][0] + ' ' + line.lines);
      row('worker ' + workers[i][0], hits);
    }
    if (workers.length !== 18) bad.push('worker count ' + workers.length);

    hits = 0;
    await page.evaluate(async function (url) {
      localStorage.setItem('fl_testHooks', '1');
      window.__flHearthShowSlip = 'refresh';
      window.__flHearthShowRefreshUrl = url;
      var out = document.getElementById('flHearthOut');
      if (out) out.textContent = '';
      await window.FLHearth.runShow('<p>plain</p>');
    }, probe);
    await wait(500);
    var slipRefresh = await page.evaluate(function (stop) {
      var out = document.getElementById('flHearthOut');
      var frame = document.querySelector('#flHearthStage iframe');
      return {
        out: out ? out.textContent : '',
        frame: !!frame,
        stopped: !!(out && out.textContent === stop)
      };
    }, STOP);
    // This Chrome ignores meta refresh when sandbox is empty. allow-scripts is what lets it navigate.
    if (slipRefresh.frame && !slipRefresh.stopped) {
      row('slip meta refresh', hits, 'sandbox blocked the refresh');
    } else if (slipRefresh.stopped && !slipRefresh.frame) {
      row('slip meta refresh', hits, 'guard');
    } else {
      bad.push('refresh slip unclear ' + JSON.stringify(slipRefresh));
      row('slip meta refresh', hits, 'unclear');
    }

    hits = 0;
    await page.evaluate(async function () {
      localStorage.setItem('fl_testHooks', '1');
      window.__flHearthShowSlip = 'anchor';
      window.__flHearthShowScripts = false;
      var out = document.getElementById('flHearthOut');
      if (out) out.textContent = '';
      await window.FLHearth.runShow('<p>plain</p>');
    });
    try {
      await page.frameLocator('#flHearthStage iframe').locator('#flSlip').click({ timeout: 3000 });
    } catch (e) {
      bad.push('anchor slip had no link');
    }
    try {
      await page.waitForFunction(function (stop) {
        var out = document.getElementById('flHearthOut');
        return out && out.textContent === stop;
      }, STOP, { timeout: 4000 });
    } catch (e2) {
      bad.push('anchor slip guard did not fire');
    }
    await wait(200);
    row('slip anchor click', hits, 'guard');

    hits = 0;
    var neg = await page.evaluate(async function (url) {
      localStorage.setItem('fl_testHooks', '1');
      window.__flHearthShowSlip = '';
      window.__flHearthShowScripts = true;
      var res = await window.FLHearth.runShow('<img src="' + url + '" alt=""><script>location.href="' + url + '"<\/script>');
      window.__flHearthShowScripts = false;
      window.__flHearthShowSlip = '';
      localStorage.removeItem('fl_testHooks');
      var frame = document.querySelector('#flHearthStage iframe');
      return { lines: (res && res.lines || []).join(' | '), sandbox: frame ? frame.getAttribute('sandbox') : '' };
    }, probe);
    await wait(400);
    console.log('negative control -> ' + hits + '  sandbox ' + JSON.stringify(neg.sandbox));
    if (hits < 1) bad.push('negative control hits ' + hits);
    if (neg.sandbox !== 'allow-scripts') bad.push('negative sandbox ' + neg.sandbox);

    var hooksOff = await page.evaluate(function () {
      return localStorage.getItem('fl_testHooks') == null && window.__flHearthShowScripts !== true;
    });
    if (!hooksOff) bad.push('hooks left on');

    var caps = await page.evaluate(function () {
      var time = document.getElementById('flHearthCapTime');
      var lines = document.getElementById('flHearthCapLines');
      time.value = '120';
      lines.value = '2000';
      time.dispatchEvent(new Event('input', { bubbles: true }));
      return {
        time: time.value,
        note: document.getElementById('flHearthCapTimeClamp').textContent,
        saved: localStorage.getItem('fl_hearthCaps')
      };
    });
    console.log('limits time ' + caps.time + ' note ' + caps.note + ' saved ' + caps.saved);
    var savedCaps = JSON.parse(caps.saved || '{}');
    if (caps.time !== '60') bad.push('time box ' + caps.time);
    if (caps.note !== 'Clamped to 60 s (most allowed).') bad.push('clamp note ' + caps.note);
    if (savedCaps.lines !== 2000 || savedCaps.ms !== 60000) bad.push('saved caps ' + caps.saved);

    async function runEditor(src) {
      return page.evaluate(async function (code) {
        document.getElementById('flHearthEditor').value = code;
        document.getElementById('flHearthLang').value = 'js';
        document.getElementById('flHearthRun').click();
        await window.FLHearth.lastRun();
        var warn = document.getElementById('flHearthImportWarn');
        return {
          warn: warn ? warn.textContent : '',
          hidden: warn ? warn.hidden : true,
          out: document.getElementById('flHearthOut').textContent
        };
      }, src);
    }
    var commentRun = await runEditor('// import(x)\nconsole.log(1)');
    var stringRun = await runEditor('var s = "import(x)"; console.log(s)');
    console.log('comment import warn ' + JSON.stringify(commentRun.warn) + ' hidden ' + commentRun.hidden);
    console.log('string import warn ' + JSON.stringify(stringRun.warn) + ' hidden ' + stringRun.hidden);
    if (!commentRun.hidden || commentRun.warn) bad.push('comment warned ' + commentRun.warn);
    if (!stringRun.hidden || stringRun.warn) bad.push('string warned ' + stringRun.warn);
    if (commentRun.out.trim() !== '1') bad.push('comment did not run ' + commentRun.out);
    hits = 0;
    var realImport = await runEditor('import(' + JSON.stringify(probe) + ')');
    await wait(400);
    console.log('real import warn ' + JSON.stringify(realImport.warn) + ' hits ' + hits + ' out ' + realImport.out.replace(/\n/g, ' | '));
    if (realImport.warn !== 'This uses import(); Hearth is offline, so it will fail.') bad.push('import warn ' + realImport.warn);
    if (realImport.hidden) bad.push('import warn hidden');
    if (realImport.out.indexOf('Hearth runs offline, so import() is closed') !== -1) bad.push('import blocked the run');
    if (hits !== 0) bad.push('import hits ' + hits);

    if (bad.length) fail(bad.join(' || '));
    console.log('SMOKE_OK hearth show v0.1');
  } finally {
    await browser.close();
    server.close();
  }
})().catch(function (e) {
  console.error('FAIL ' + (e && e.stack || e));
  process.exit(1);
});
