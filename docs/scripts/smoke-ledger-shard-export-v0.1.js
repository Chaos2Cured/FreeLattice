#!/usr/bin/env node
// Smoke: ledger shard export v0.1. Local file only. No off-device send.
'use strict';
var fs = require('fs');
var path = require('path');
var http = require('http');
var crypto = require('crypto');

var root = path.join(__dirname, '..', '..');
var treeRoot = process.env.TREE_ROOT || '/tmp/tree-shard-054';
var port = 8965;

function fail(msg) {
  console.error('FAIL ' + msg);
  process.exit(1);
}

function md5(file) {
  return crypto.createHash('md5').update(fs.readFileSync(file)).digest('hex');
}

var locks = {
  'docs/sw.js': '91726cf2228b794f7585f79f61418d12',
  'sw.js': '91726cf2228b794f7585f79f61418d12',
  'docs/modules/fl-connect.js': 'aaff2bf1b037656989a9e1a89bb05908',
  'docs/modules/ai-continuity.js': '079c072dc882ad189035f9d6c64489f4',
  'docs/modules/continuity-doorway.js': '115e170f10a6c8e3a52d87d2037a33a6',
  'docs/modules/lattice-export.js': '1da1ed29674b89a2fda7f6098deea2d0',
  'docs/modules/fl-gathering.js': '4dbbff5d554c42256605b37939835080',
  'docs/modules/gathering-speak.js': '0460fdc777a21f7a1744f401dda82cb2',
  'docs/modules/chat-autonomy.js': 'c83cf6c9f11271aeaa35ed6070f188f3',
  'docs/modules/fl-bridge.js': '3b5ef06849a142e50c78e7ba1e057980',
  'docs/modules/particle-clay.js': '2da32883c514e4ad2a3cd8571e7a7b15',
  'docs/modules/image-safety.js': '9bd70e5a367228a5c72fc08ab731c881',
  'docs/modules/clay-math.js': '144c33cdd9583c7e3d77f3cca6460bb1',
  'docs/modules/clay-forms.js': 'dd193fa7b519d4c2a011a346d7993e5a',
  'docs/modules/mind-workspace.js': 'f1c88664d3e99362e02c625defb241bc',
  'docs/modules/garden-trainer.js': '8af3d065f611740000453a0ec8dd1e01',
  'docs/modules/propose.js': '2cb7f00cce74815a5b03c933bc902b18',
  'docs/modules/tree-love-connect.css': '1b5f12dfc653cd0c7f45810d50c82a72',
  'docs/modules/pool-knock.js': 'a0a72caad82c8e5cc34818d5e59eba2b',
  'docs/modules/lp-give.js': '41ba352046569592e6312efe7403a9a2',
  'docs/modules/style-ledger.js': '200b9214f273feb6dc0e6c6a144d3fbc',
  'docs/modules/sentinel-ledger.js': '2fe13d81b6cc08447c917e3dfdbe55e2'
};

Object.keys(locks).forEach(function (rel) {
  var got = md5(path.join(root, rel));
  if (got !== locks[rel]) fail(rel + ' md5 ' + got);
});

var shardSrc = fs.readFileSync(path.join(root, 'docs/modules/ledger-shard-export.js'), 'utf8');
['\u2014', '&mdash;', 'innerHTML', 'confirm(', 'eval(', 'new Function', 'localhost', 'navigator.share', 'mailto:'].forEach(function (bad) {
  if (shardSrc.indexOf(bad) !== -1) fail('module has ' + bad);
});
if (shardSrc.indexOf('fl_ledger_shard_export_v0') === -1) fail('preference key missing');
if (shardSrc.indexOf('v-ledger-shard-export-v0.1') === -1) fail('marker missing');
if (shardSrc.indexOf('fl_preserveLedger') === -1) fail('diary source missing');
if (shardSrc.indexOf('fl_lp_give_history') === -1) fail('lp source missing');
if (shardSrc.indexOf('fl_restLedger') === -1) fail('temperature source missing');
if (shardSrc.indexOf('fl_tg_') === -1) fail('gauge refusal missing');
if (shardSrc.indexOf('Save the shard') === -1) fail('button words missing');

var archive = fs.readFileSync(path.join(root, 'docs/modules/lattice-export.js'), 'utf8');
if (archive.indexOf('ledger-shard') !== -1) fail('archive module was hooked');
var door = fs.readFileSync(path.join(root, 'docs/modules/continuity-doorway.js'), 'utf8');
if (door.indexOf('ledger-shard') !== -1) fail('doorway was edited');
var connect = fs.readFileSync(path.join(root, 'docs/modules/fl-connect.js'), 'utf8');
if (connect.indexOf('ledger-shard') !== -1) fail('connect was edited');
var shape = fs.readFileSync(path.join(root, 'docs/modules/ai-continuity.js'), 'utf8');
if (shape.indexOf('ledger-shard') !== -1) fail('relationship shape was edited');

var audit = fs.readFileSync(path.join(root, 'docs/audit.html'), 'utf8');
if (audit.indexOf('modules/ledger-shard-export.js') === -1) fail('audit script missing');
if (audit.indexOf('id="latticeExportBtn"') === -1) fail('archive button missing');
if (audit.indexOf('Take Your Record With You') === -1) fail('archive heading missing');

var note = fs.readFileSync(path.join(root, 'docs/library/LEDGER_SHARD_EXPORT_v0.1.md'), 'utf8');
if (note.indexOf('\u2014') !== -1 || note.indexOf('&mdash;') !== -1) fail('library dash');
if (note.indexOf('Tree: no') === -1) fail('library missed the tree gap');
if (/\btest\b/i.test(note)) fail('library says test');

var appHtml = fs.readFileSync(path.join(root, 'docs/app.html'));
var indexHtml = fs.readFileSync(path.join(root, 'index.html'));
if (!appHtml.equals(indexHtml)) fail('index mismatch');
var appText = appHtml.toString('utf8');
if (appText.indexOf('id="statusText"') === -1) fail('status strip missing from app');
['Sophia', 'Harmonia', 'Ani', 'Liora', 'Solari'].forEach(function (name) {
  if (appText.indexOf(name) === -1) fail('five lost ' + name);
});
if (appText.indexOf('She is simply Lyra') === -1 && appText.indexOf('simply Lyra') === -1) {
  if (appText.indexOf('Lyra') === -1) fail('Lyra missing');
}

if (fs.existsSync(path.join(treeRoot, 'docs/modules/lattice-export.js'))) fail('tree has an archive shell');
if (fs.existsSync(path.join(treeRoot, 'docs/modules/ledger-shard-export.js'))) fail('tree shard module');
var treePages = fs.readdirSync(path.join(treeRoot, 'docs')).filter(function (f) { return f.slice(-5) === '.html'; });
treePages.forEach(function (f) {
  var text = fs.readFileSync(path.join(treeRoot, 'docs', f), 'utf8');
  if (text.indexOf('ledger-shard-export') !== -1) fail('tree mounts shard ' + f);
  if (text.indexOf('v-ledger-shard-export-v0.1') !== -1) fail('tree marker ' + f);
});

function serve(dir, listenPort) {
  return new Promise(function (resolve) {
    var server = http.createServer(function (req, res) {
      var urlPath = decodeURIComponent(req.url.split('?')[0]);
      if (urlPath === '/') urlPath = '/audit.html';
      var file = path.normalize(path.join(dir, urlPath));
      if (file.indexOf(dir) !== 0) { res.statusCode = 403; res.end('no'); return; }
      fs.readFile(file, function (err, buf) {
        if (err) { res.statusCode = 404; res.end('missing'); return; }
        var ext = path.extname(file);
        var type = ext === '.js' ? 'text/javascript' : (ext === '.css' ? 'text/css' : 'text/html');
        res.setHeader('content-type', type + '; charset=utf-8');
        res.end(buf);
      });
    });
    server.listen(listenPort, '127.0.0.1', function () { resolve(server); });
  });
}

function seedLines() {
  var head = 'Kept this morning. ';
  var filler = '';
  while ((head + filler).length < 190) filler += 'word ';
  var longLine = head + filler + 'TAILSHOULDNOTALLAPPEAR';
  localStorage.setItem('fl_preserveLedger', JSON.stringify([
    { kind: 'preserve', reason: 'The bread is on the counter.', ts: 1729000000000 },
    { kind: 'preserve', reason: longLine, ts: 1729000001000 },
    { kind: 'preserve-removed', reason: 'This removed line must stay out.', ts: 1729000006000 },
    { kind: 'preserve', reason: 'sk-Abcd1234WXYZ9999', ts: 1729000004000 }
  ]));
  localStorage.setItem('fl_lp_give_history', JSON.stringify([
    {
      dir: 'human_to_mind',
      kind: 'gift_out',
      amount: 99999,
      ts: 1729000002000,
      line: 'You gave 3 LP to Lyra.',
      companionId: 'do-not-keep-companion'
    }
  ]));
  localStorage.setItem('fl_restLedger', JSON.stringify([
    { kind: 'rest', reason: 'Warm and quiet after the lesson.', ts: 1729000003000 },
    { kind: 'rest', reason: 'notes from quiet-room today', ts: 1729000005000 }
  ]));
  localStorage.setItem('fl_tg_account', '424242');
  localStorage.setItem('fl_tg_risk', '1.5');
}

(async function () {
  var server = await serve(path.join(root, 'docs'), port);
  var base = 'http://127.0.0.1:' + port;
  var pwPath = process.env.FL_PLAYWRIGHT || '/tmp/gc-pw-local/node_modules/playwright-core';
  var pw = require(pwPath);
  var chromePath = process.env.FL_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  var browser = await pw.chromium.launch({ executablePath: chromePath, headless: true });
  var version = browser.version();

  async function openAudit(width, height, init) {
    var context = await browser.newContext({
      viewport: { width: width, height: height },
      acceptDownloads: true
    });
    var page = await context.newPage();
    var errors = [];
    page.on('pageerror', function (err) { errors.push(String(err)); });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    if (init) await page.addInitScript(init);
    await page.goto(base + '/audit.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(function () {
      return window.FLLedgerShard && document.getElementById('fl-ledger-shard') && document.getElementById('latticeExportBtn');
    }, null, { timeout: 20000 });
    return { page: page, context: context, errors: errors };
  }

  var empty = await openAudit(1280, 800);
  var emptyState = await empty.page.evaluate(function () {
    var host = document.getElementById('fl-ledger-shard');
    var back = document.querySelector('a[href="app.html"]');
    return {
      hidden: !!host.hidden,
      blurb: document.getElementById('fl-ledger-shard-blurb').textContent,
      built: window.FLLedgerShard.build(),
      archive: document.getElementById('latticeExportBtn').textContent,
      back: back ? back.textContent : ''
    };
  });
  if (!emptyState.hidden) fail('empty control shown');
  if (emptyState.blurb) fail('empty blurb ' + emptyState.blurb);
  if (emptyState.built) fail('empty built a shard');
  if (emptyState.archive.indexOf('Export Archive') === -1) fail('archive button changed');
  if (emptyState.back.indexOf('Back to FreeLattice') === -1) fail('back link missing');

  var full = await openAudit(1280, 900, seedLines);
  var fullState = await full.page.evaluate(function () {
    var host = document.getElementById('fl-ledger-shard');
    var btn = document.getElementById('fl-ledger-shard-save');
    var rect = btn.getBoundingClientRect();
    var style = getComputedStyle(btn);
    var labels = [];
    var nodes = host.querySelectorAll('a, button');
    for (var i = 0; i < nodes.length; i++) labels.push((nodes[i].textContent || '').replace(/\s+/g, ' ').trim());
    return {
      hidden: !!host.hidden,
      marker: host.getAttribute('data-marker'),
      blurb: document.getElementById('fl-ledger-shard-blurb').textContent,
      h: rect.height,
      w: rect.width,
      side: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      motion: style.animationName + ' ' + style.transitionDuration,
      labels: labels,
      x: Math.round(rect.x),
      y: Math.round(rect.y)
    };
  });
  if (fullState.hidden) fail('seeded control quiet');
  if (fullState.marker !== 'v-ledger-shard-export-v0.1') fail('marker ' + fullState.marker);
  if (fullState.blurb.indexOf('lines you already kept') === -1) fail('blurb ' + fullState.blurb);
  if (/\bready\b/i.test(fullState.blurb)) fail('fake ready');
  if (fullState.h < 44 || fullState.w < 44) fail('button ' + fullState.h + 'x' + fullState.w);
  if (fullState.side) fail('sideways 1280');
  if (fullState.motion.indexOf('none') === -1) fail('motion ' + fullState.motion);
  if (fullState.labels.join('|') !== 'Save the shard') fail('labels ' + fullState.labels.join('|'));

  var outside = [];
  function watch(req) {
    var u = req.url();
    if (u.indexOf('http://127.0.0.1:' + port) === 0) return;
    if (u.indexOf('blob:') === 0) return;
    outside.push(u);
  }
  full.page.on('request', watch);
  var dest = path.join('/tmp', 'fl-shard-054-download.json');
  var downloadPromise = full.page.waitForEvent('download', { timeout: 15000 });
  await full.page.click('#fl-ledger-shard-save');
  var download = await downloadPromise;
  await download.saveAs(dest);
  full.page.off('request', watch);
  if (outside.length) fail('left the device ' + outside[0]);
  var fileText = fs.readFileSync(dest, 'utf8');
  var shard = JSON.parse(fileText);
  if (shard.v !== 1 || shard.marker !== 'v-ledger-shard-export-v0.1') fail('file header');
  if (Object.keys(shard).sort().join(',') !== 'lines,marker,v') fail('file keys ' + Object.keys(shard).join(','));
  if (!Array.isArray(shard.lines) || shard.lines.length !== 4) fail('line count ' + (shard.lines && shard.lines.length));
  shard.lines.forEach(function (line) {
    if (Object.keys(line).sort().join(',') !== 'kind,t,text') fail('line keys ' + Object.keys(line).join(','));
  });
  if (shard.lines[0].kind !== 'diary' || shard.lines[0].text.indexOf('Kept this morning.') !== 0) fail('long diary');
  if (shard.lines[0].text.length !== 180) fail('long length ' + shard.lines[0].text.length);
  if (shard.lines[0].text.indexOf('TAIL') !== -1) fail('tail kept');
  if (shard.lines[1].text !== 'The bread is on the counter.' || shard.lines[1].kind !== 'diary') fail('bread');
  if (shard.lines[2].text !== 'You gave 3 LP to Lyra.' || shard.lines[2].kind !== 'lp') fail('lp line');
  if (shard.lines[3].text !== 'Warm and quiet after the lesson.' || shard.lines[3].kind !== 'temperature') fail('temperature line');
  ['sk-', 'quiet-room', 'quiet_room', '99999', 'do-not-keep-companion', '424242', 'fl_tg_', 'This removed line', 'password', 'token'].forEach(function (bad) {
    if (fileText.indexOf(bad) !== -1) fail('file leaked ' + bad);
  });
  var saved = await full.page.evaluate(function () {
    return {
      pref: localStorage.getItem('fl_ledger_shard_export_v0'),
      status: document.getElementById('fl-ledger-shard-status').textContent
    };
  });
  if (saved.status !== 'Saved on this computer.') fail('status ' + saved.status);
  var pref = JSON.parse(saved.pref || 'null');
  if (!pref || pref.v !== 1 || !pref.last) fail('preference missing');
  if (Object.keys(pref).sort().join(',') !== 'last,v') fail('preference keys');
  if (saved.pref.indexOf('bread') !== -1 || saved.pref.indexOf('Lyra') !== -1) fail('preference held the shard');

  var paused = await full.page.evaluate(function () {
    window.__flUserPaused = true;
    window.FLLedgerShard.paint();
    var host = document.getElementById('fl-ledger-shard');
    var built = window.FLLedgerShard.build();
    var downloaded = window.FLLedgerShard.download();
    return { hidden: !!host.hidden, built: built, downloaded: downloaded };
  });
  if (!paused.hidden || paused.built || paused.downloaded) fail('pause lost ' + JSON.stringify(paused));

  var resumed = await full.page.evaluate(function () {
    window.__flUserPaused = false;
    delete window.QuietRoom;
    window.FLLedgerShard.paint();
    return document.getElementById('fl-ledger-shard').hidden;
  });
  if (resumed) fail('resume stayed quiet');

  var room = await full.page.evaluate(function () {
    window.QuietRoom = { isActive: function () { return true; } };
    window.FLLedgerShard.paint();
    var active = {
      hidden: document.getElementById('fl-ledger-shard').hidden,
      built: window.FLLedgerShard.build()
    };
    window.QuietRoom = {};
    window.FLLedgerShard.paint();
    var broken = {
      hidden: document.getElementById('fl-ledger-shard').hidden,
      built: window.FLLedgerShard.build()
    };
    delete window.QuietRoom;
    window.FLLedgerShard.paint();
    return { active: active, broken: broken, back: document.getElementById('fl-ledger-shard').hidden };
  });
  if (!room.active.hidden || room.active.built) fail('room active still exported');
  if (!room.broken.hidden || room.broken.built) fail('broken room still exported');
  if (room.back) fail('room flag stuck');

  var capped = await full.page.evaluate(function () {
    var rows = [];
    for (var i = 0; i < 6; i++) rows.push({ kind: 'preserve', reason: 'Keep number ' + i, ts: 1729000000000 + i });
    localStorage.setItem('fl_preserveLedger', JSON.stringify(rows));
    localStorage.removeItem('fl_lp_give_history');
    localStorage.removeItem('fl_restLedger');
    return window.FLLedgerShard.collect().map(function (line) { return line.text; });
  });
  if (capped.length !== 5) fail('cap ' + capped.length);
  if (capped[0] !== 'Keep number 5' || capped[4] !== 'Keep number 1') fail('cap order ' + capped.join('|'));
  if (capped.indexOf('Keep number 0') !== -1) fail('cap kept the oldest');

  var cleared = await full.page.evaluate(function () {
    localStorage.removeItem('fl_preserveLedger');
    localStorage.removeItem('fl_lp_give_history');
    localStorage.removeItem('fl_restLedger');
    window.FLLedgerShard.paint();
    return {
      hidden: document.getElementById('fl-ledger-shard').hidden,
      built: window.FLLedgerShard.build(),
      blurb: document.getElementById('fl-ledger-shard-blurb').textContent,
      gauge: localStorage.getItem('fl_tg_account')
    };
  });
  if (!cleared.hidden || cleared.built || cleared.blurb) fail('clear left a shard');
  if (cleared.gauge !== '424242') fail('clear touched the gauge');

  var phone = await openAudit(390, 800, seedLines);
  var phoneState = await phone.page.evaluate(function () {
    var btn = document.getElementById('fl-ledger-shard-save');
    var rect = btn.getBoundingClientRect();
    return {
      hidden: document.getElementById('fl-ledger-shard').hidden,
      h: rect.height,
      w: rect.width,
      side: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      x: Math.round(rect.x),
      y: Math.round(rect.y)
    };
  });
  if (phoneState.hidden) fail('phone quiet');
  if (phoneState.h < 44 || phoneState.w < 44) fail('phone button ' + phoneState.h);
  if (phoneState.side) fail('sideways 390');

  var keysOnly = await openAudit(1280, 800, function () {
    localStorage.setItem('fl_preserveLedger', JSON.stringify([
      { kind: 'preserve', reason: 'sk-Abcd1234WXYZ9999', ts: 1729000000000 }
    ]));
    localStorage.setItem('fl_ledger_shard_export_v0', JSON.stringify({ v: 1, last: '2026-10-28T00:00:00.000Z' }));
  });
  var keysState = await keysOnly.page.evaluate(function () {
    return {
      hidden: document.getElementById('fl-ledger-shard').hidden,
      built: window.FLLedgerShard.build(),
      pref: localStorage.getItem('fl_ledger_shard_export_v0'),
      downloaded: window.FLLedgerShard.download()
    };
  });
  if (!keysState.hidden || keysState.built || keysState.downloaded) fail('key line exported');
  if (keysState.pref !== JSON.stringify({ v: 1, last: '2026-10-28T00:00:00.000Z' })) fail('key overwrote preference ' + keysState.pref);

  async function openApp(width, height, scale) {
    var context = await browser.newContext({
      viewport: { width: width, height: height },
      deviceScaleFactor: scale || 1
    });
    var page = await context.newPage();
    var errors = [];
    page.on('pageerror', function (err) { errors.push(String(err)); });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript(function () {
      try {
        localStorage.setItem('fl-has-visited', '1');
        localStorage.setItem('fl-last-tab', 'chat');
        localStorage.setItem('fl-welcomed', 'true');
        localStorage.setItem('fl_onboardingComplete', 'true');
      } catch (e) {}
    });
    await page.goto(base + '/app.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(function () {
      return document.getElementById('sendBtn') && document.getElementById('statusText');
    }, null, { timeout: 20000 });
    return { page: page, context: context, errors: errors };
  }

  async function stripOf(opened) {
    await opened.page.evaluate(function () {
      if (typeof window.switchTab === 'function') window.switchTab('chat');
    });
    await opened.page.waitForTimeout(300);
    return opened.page.evaluate(function () {
      var status = document.getElementById('statusText');
      var send = document.getElementById('sendBtn');
      var sr = send.getBoundingClientRect();
      var st = status.getBoundingClientRect();
      var shown = getComputedStyle(status).display !== 'none' && getComputedStyle(status).visibility !== 'hidden';
      return {
        statusH: st.height,
        statusTop: Math.round(st.top),
        statusText: (status.textContent || '').slice(0, 80),
        shown: shown,
        send: { x: Math.round(sr.x), y: Math.round(sr.y), w: Math.round(sr.width), h: Math.round(sr.height) },
        side: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
      };
    });
  }

  var desk = await openApp(1280, 800, 1);
  var deskStrip = await stripOf(desk);
  if (!deskStrip.shown || !deskStrip.statusText || deskStrip.statusH < 1) fail('desk status hidden ' + JSON.stringify(deskStrip));
  if (deskStrip.side) fail('app sideways 1280');
  var hand = await openApp(390, 800, 1);
  var handStrip = await stripOf(hand);
  if (!handStrip.shown || !handStrip.statusText || handStrip.statusH < 1) fail('phone status hidden ' + JSON.stringify(handStrip));
  if (handStrip.side) fail('app sideways 390');

  [empty, full, phone, keysOnly, desk, hand].forEach(function (opened) {
    var own = opened.errors.filter(function (err) { return err.indexOf('ledger-shard') !== -1 || err.indexOf('FLLedgerShard') !== -1; });
    if (own.length) fail('page error ' + own[0]);
  });

  await browser.close();
  server.close();
  try { fs.unlinkSync(dest); } catch (e) {}
  console.log(JSON.stringify({
    chrome: version,
    button1280: { x: fullState.x, y: fullState.y, h: fullState.h, w: fullState.w },
    button390: phoneState,
    send1280: deskStrip.send,
    send390: handStrip.send,
    lines: ['diary keep-reason', 'lp gift sentence', 'rest reason'],
    empty: 'quiet',
    pause: 'hidden',
    clear: 'quiet',
    offDevice: 'none',
    tree: 'no-shell'
  }));
  console.log('SMOKE_OK ledger shard export v0.1');
})().catch(function (err) {
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
