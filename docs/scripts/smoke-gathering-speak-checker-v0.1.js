#!/usr/bin/env node
// Smoke: Gathering speak + Checker chair v0.1. Local only.
'use strict';
var fs = require('fs');
var path = require('path');
var http = require('http');
var crypto = require('crypto');
var vm = require('vm');

var root = path.join(__dirname, '..', '..');
var treeRoot = process.env.TREE_ROOT || '/tmp/tree-gather-051';
var port = 8941;

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
  'docs/modules/pool-knock.js': 'a0a72caad82c8e5cc34818d5e59eba2b',
  'docs/modules/fl-bridge.js': '3b5ef06849a142e50c78e7ba1e057980',
  'docs/modules/particle-clay.js': '2da32883c514e4ad2a3cd8571e7a7b15',
  'docs/modules/image-safety.js': '9bd70e5a367228a5c72fc08ab731c881',
  'docs/modules/clay-math.js': '144c33cdd9583c7e3d77f3cca6460bb1',
  'docs/modules/clay-forms.js': 'dd193fa7b519d4c2a011a346d7993e5a',
  'docs/modules/mind-workspace.js': 'f1c88664d3e99362e02c625defb241bc',
  'docs/modules/garden-trainer.js': '8af3d065f611740000453a0ec8dd1e01',
  'docs/modules/chat-autonomy.js': 'c83cf6c9f11271aeaa35ed6070f188f3',
  'docs/modules/propose.js': '2cb7f00cce74815a5b03c933bc902b18'
};

Object.keys(locks).forEach(function (rel) {
  var got = md5(path.join(root, rel));
  if (got !== locks[rel]) fail(rel + ' md5 ' + got);
});

var gatherMd5 = md5(path.join(root, 'docs/modules/fl-gathering.js'));
var speakMd5 = md5(path.join(root, 'docs/modules/gathering-speak.js'));
if (gatherMd5 !== md5(path.join(treeRoot, 'docs/modules/fl-gathering.js'))) fail('fl-gathering diverged');
if (speakMd5 !== md5(path.join(treeRoot, 'docs/modules/gathering-speak.js'))) fail('gathering-speak diverged');
if (md5(path.join(treeRoot, 'docs/modules/fl-connect.js')) !== locks['docs/modules/fl-connect.js']) fail('alpha fl-connect diverged');

var appHtml = fs.readFileSync(path.join(root, 'docs/app.html'));
var indexHtml = fs.readFileSync(path.join(root, 'index.html'));
if (!appHtml.equals(indexHtml)) fail('index mismatch');
var appText = appHtml.toString('utf8');
['id="fl-gathering-mount"', 'id="fl-gathering-speak-mount"', 'modules/gathering-speak.js', 'modules/fl-gathering.js', 'id="statusText"'].forEach(function (bit) {
  if (appText.indexOf(bit) === -1) fail('app missing ' + bit);
});

var speakSrc = fs.readFileSync(path.join(root, 'docs/modules/gathering-speak.js'), 'utf8');
var gatherSrc = fs.readFileSync(path.join(root, 'docs/modules/fl-gathering.js'), 'utf8');
['\u2014', '&mdash;', 'innerHTML', 'confirm(', 'eval(', 'new Function', 'Quiet Room', 'localhost'].forEach(function (bad) {
  if (speakSrc.indexOf(bad) !== -1) fail('speak has ' + bad);
  if (gatherSrc.indexOf(bad) !== -1) fail('gather has ' + bad);
});
if (gatherSrc.indexOf('apiKey') !== -1) fail('gather touches a key');
if (gatherSrc.indexOf("type: 'Checker'") === -1) fail('checker chair missing');
if (gatherSrc.indexOf('The speaking chair can answer below.') === -1) fail('foot not layered');
if (gatherSrc.indexOf('Let this chair speak first') === -1) fail('speak first missing');
if (gatherSrc.indexOf('Find local minds') === -1) fail('find missing from core');
if (speakSrc.indexOf('fl_gathering_chairs_v0') === -1) fail('seat key missing');
if (speakSrc.indexOf('fl_gathering_checker_v0') === -1) fail('checker key missing');
if (speakSrc.indexOf('fl_gathering_thread_v0') === -1) fail('thread key missing');

var store = {};
var fakeWindow = {
  localStorage: {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
    setItem: function (k, v) { store[k] = String(v); }
  },
  document: null
};
var ctx = { window: fakeWindow, localStorage: fakeWindow.localStorage };
vm.runInNewContext(speakSrc, ctx);
var S = fakeWindow.FLGatheringSpeak;
if (!S || S.addNote('sk-abcdefghijklmnop').ok !== false) fail('key note accepted');
if (store[S.CHECK_KEY] && store[S.CHECK_KEY].indexOf('sk-') !== -1) fail('key stored');
if (!S.addNote('We read the reply aloud before we keep it.').ok) fail('note rejected');
if (store[S.CHECK_KEY].indexOf('apiKey') !== -1) fail('note stored a key field');
if (S.readNotes().length !== 1) fail('note unreadable');
S.clearNotes();
if (S.readNotes().length !== 0) fail('notes not cleared');
if (S.houseCloudMatches({ kind: 'cloud', provider: 'x', model: 'y' })) fail('cloud matched with no saved path');

var treePages = fs.readdirSync(path.join(treeRoot, 'docs')).filter(function (f) { return f.endsWith('.html'); });
treePages.forEach(function (f) {
  var text = fs.readFileSync(path.join(treeRoot, 'docs', f), 'utf8');
  if (text.indexOf('fl-gathering.js') !== -1) fail('tree page wires fl-gathering ' + f);
  if (text.indexOf('fl-gathering-speak-mount') !== -1) fail('tree page mounts speak ' + f);
});
var rooms = fs.readFileSync(path.join(treeRoot, 'docs/modules/garden-rooms.js'), 'utf8');
if (rooms.indexOf('function renderCoreGathering') === -1) fail('tree gathering missing');

function serve(dir, listenPort) {
  return new Promise(function (resolve) {
    var server = http.createServer(function (req, res) {
      var urlPath = decodeURIComponent(req.url.split('?')[0]);
      if (urlPath === '/') urlPath = '/app.html';
      var file = path.normalize(path.join(dir, urlPath));
      if (file.indexOf(dir) !== 0) {
        res.statusCode = 403;
        res.end('no');
        return;
      }
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

function probeTags(base) {
  return new Promise(function (resolve) {
    var req = http.get(base + '/api/tags', { timeout: 1200 }, function (res) {
      var buf = '';
      res.on('data', function (c) { buf += c; });
      res.on('end', function () {
        try {
          var data = JSON.parse(buf);
          var name = data && data.models && data.models[0] && (data.models[0].name || data.models[0].model);
          resolve(name ? { base: base, model: String(name) } : null);
        } catch (e) { resolve(null); }
      });
    });
    req.on('error', function () { resolve(null); });
    req.on('timeout', function () { req.destroy(); resolve(null); });
  });
}

(async function () {
  var localMind = await probeTags('http://127.0.0.1:11435');
  if (!localMind) localMind = await probeTags('http://127.0.0.1:11434');
  var server = await serve(path.join(root, 'docs'), port);
  var base = 'http://127.0.0.1:' + port;
  var pwPath = process.env.FL_PLAYWRIGHT || '/tmp/gc-pw-local/node_modules/playwright-core';
  var pw;
  try { pw = require(pwPath); }
  catch (e) { fail('local playwright-core missing'); }
  var chromePath = process.env.FL_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  var browser = await pw.chromium.launch({ executablePath: chromePath, headless: true });
  var version = browser.version();

  async function openApp(width, height, scale, reduced) {
    var context = await browser.newContext({
      viewport: { width: width, height: height },
      deviceScaleFactor: scale || 1,
      reducedMotion: reduced ? 'reduce' : 'no-preference'
    });
    var page = await context.newPage();
    var errors = [];
    page.on('pageerror', function (err) { errors.push(String(err)); });
    await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
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
      return typeof window.switchTab === 'function' && document.getElementById('sendBtn') && document.getElementById('fl-gathering-speak-mount');
    }, null, { timeout: 20000 });
    return { page: page, context: context, errors: errors };
  }

  async function seatSend(page) {
    await page.evaluate(function () {
      var send = document.getElementById('sendBtn');
      var nav = document.getElementById('flMobileNav');
      var navH = 0;
      if (nav) {
        var cs = getComputedStyle(nav);
        if (cs.display !== 'none') navH = Math.round(nav.getBoundingClientRect().height) || 0;
      }
      var sr = send.getBoundingClientRect();
      var goal = Math.max(96, (window.innerHeight - navH - sr.height) / 2);
      document.documentElement.scrollTop += sr.top - goal;
    });
    await page.waitForTimeout(350);
  }

  async function readChat(page) {
    await page.evaluate(function () { window.switchTab('chat'); });
    await page.waitForTimeout(400);
    await seatSend(page);
    await seatSend(page);
    return page.evaluate(function () {
      var send = document.getElementById('sendBtn');
      var sr = send.getBoundingClientRect();
      var cy = Math.min(window.innerHeight - 2, Math.max(0, sr.top + sr.height / 2));
      var cx = Math.min(window.innerWidth - 2, Math.max(0, sr.left + sr.width / 2));
      var hit = document.elementFromPoint(cx, cy);
      var status = document.getElementById('statusText');
      return {
        status: status ? (status.textContent || '').slice(0, 24) : '',
        statusShown: !!(status && status.getClientRects().length),
        send: { x: Math.round(sr.x), y: Math.round(sr.y), w: Math.round(sr.width), h: Math.round(sr.height), t: (send.textContent || '').slice(0, 20) },
        sendHit: !!(hit && (hit === send || send.contains(hit))),
        sideways: document.documentElement.scrollWidth > window.innerWidth + 1
      };
    });
  }

  var wide = await openApp(1280, 800, 1, false);
  var page = wide.page;
  await page.evaluate(function () { window.switchTab('gathering'); });
  await page.waitForFunction(function () {
    var mount = document.getElementById('fl-gathering-mount');
    return mount && mount.querySelector('[data-chair="seat-5"]') && document.getElementById('flgs-ask-btn');
  }, null, { timeout: 15000 });

  var face = await page.evaluate(function () {
    var checker = document.querySelector('[data-chair="seat-5"]');
    var buttons = document.querySelectorAll('#fl-gathering-speak-mount .flgs-btn');
    var heights = [];
    for (var i = 0; i < buttons.length; i++) heights.push(Math.round(buttons[i].getBoundingClientRect().height));
    var card = document.querySelector('#fl-gathering-speak-mount .flgs-card');
    var cs = card ? getComputedStyle(card) : null;
    return {
      checker: checker ? checker.textContent : '',
      find: !!Array.prototype.some.call(document.querySelectorAll('button'), function (b) { return (b.textContent || '').indexOf('Find local minds') !== -1; }),
      later: !!document.querySelector('[data-chair="seat-6"].is-later') && !!document.querySelector('[data-chair="seat-7"].is-later'),
      heights: heights,
      glow: cs ? cs.boxShadow : '',
      duration: cs ? cs.transitionDuration : '',
      sideways: document.documentElement.scrollWidth > window.innerWidth + 1,
      who: (document.getElementById('flgs-who') || {}).textContent || ''
    };
  });
  if (face.checker.indexOf('Checker') === -1) fail('checker label');
  if (!face.find) fail('find missing');
  if (!face.later) fail('later seats missing');
  if (face.heights.length < 4) fail('speak buttons ' + face.heights.length);
  face.heights.forEach(function (h) { if (h < 44) fail('button height ' + h); });
  if (!face.glow || face.glow === 'none') fail('glow missing');
  if (!(parseFloat(face.duration) > 0)) fail('motion ' + face.duration);
  if (face.sideways) fail('gathering sideways 1280');
  if (face.who.indexOf('More, then Connect') === -1) fail('empty who');

  await page.fill('#flgs-ask', 'Hello from the circle');
  await page.click('#flgs-ask-btn');
  var emptyAsk = await page.textContent('#flgs-receipt');
  if (!emptyAsk || emptyAsk.indexOf('No chair is speaking yet') === -1) fail('empty honesty ' + emptyAsk);
  var threadAfterEmpty = await page.textContent('#flgs-thread');
  if (threadAfterEmpty && threadAfterEmpty.trim()) fail('fake reply ' + threadAfterEmpty);

  await page.evaluate(function () {
    localStorage.setItem('fl_gathering_chairs_v0', JSON.stringify({
      v: 1,
      seats: { cortex: { kind: 'local', model: 'quiet-stand-in', base: 'http://127.0.0.1:9', label: 'Quiet stand-in' } },
      speaking: 'cortex'
    }));
    if (window.FLGatheringSpeak) window.FLGatheringSpeak.refresh();
  });
  await page.fill('#flgs-ask', 'Are you there');
  await page.click('#flgs-ask-btn');
  await page.waitForFunction(function () {
    var t = (document.getElementById('flgs-receipt') || {}).textContent || '';
    return t.indexOf('did not answer') !== -1 || t.indexOf('Paused') !== -1;
  }, null, { timeout: 8000 });
  var quiet = await page.textContent('#flgs-receipt');
  if (quiet.indexOf('Nothing was invented') === -1) fail('quiet honesty ' + quiet);
  var quietThread = await page.textContent('#flgs-thread');
  if (quietThread && quietThread.indexOf('Quiet stand-in:') !== -1) fail('invented quiet answer');

  await page.fill('#flgs-note', 'We read the reply aloud before we keep it.');
  await page.click('#flgs-add-note');
  var noted = await page.evaluate(function () {
    var raw = localStorage.getItem('fl_gathering_checker_v0') || '';
    var list = document.getElementById('flgs-notes');
    return { raw: raw, shown: list ? list.textContent : '' };
  });
  if (noted.shown.indexOf('We read the reply aloud') === -1) fail('note not shown');
  if (noted.raw.indexOf('apiKey') !== -1 || noted.raw.indexOf('sk-') !== -1) fail('note raw key');
  await page.fill('#flgs-note', 'sk-abcdefghijklmnop');
  await page.click('#flgs-add-note');
  var refused = await page.textContent('#flgs-note-msg');
  if (!refused || refused.indexOf('never a key') === -1) fail('key note ' + refused);
  var still = await page.evaluate(function () { return localStorage.getItem('fl_gathering_checker_v0') || ''; });
  if (still.indexOf('sk-') !== -1) fail('key stored in page');
  await page.click('#flgs-clear-notes');
  var cleared = await page.evaluate(function () {
    return { raw: localStorage.getItem('fl_gathering_checker_v0') || '', shown: (document.getElementById('flgs-notes') || {}).textContent || '' };
  });
  if (cleared.shown.trim()) fail('notes still shown');
  if (cleared.raw.indexOf('aloud') !== -1) fail('notes not cleared');

  var localWalk = 'skipped';
  if (localMind) {
    await page.evaluate(function (mind) {
      localStorage.setItem('fl_gathering_chairs_v0', JSON.stringify({
        v: 1,
        seats: { cortex: { kind: 'local', model: mind.model, base: mind.base, label: mind.model } },
        speaking: 'cortex'
      }));
      localStorage.removeItem('fl_gathering_thread_v0');
      if (window.FLGatheringSpeak) window.FLGatheringSpeak.refresh();
    }, localMind);
    await page.fill('#flgs-ask', 'Say hi in three words.');
    await page.click('#flgs-ask-btn');
    try {
      await page.waitForFunction(function () {
        var t = (document.getElementById('flgs-receipt') || {}).textContent || '';
        return t.indexOf('A turn was kept') !== -1 || t.indexOf('did not answer') !== -1;
      }, null, { timeout: 20000 });
      var walked = await page.textContent('#flgs-receipt');
      localWalk = walked && walked.indexOf('A turn was kept') !== -1 ? 'round-trip' : 'skipped-quiet';
    } catch (e) {
      localWalk = 'skipped-quiet';
      await page.click('#flgs-pause-btn');
    }
  }

  var chatWide = await readChat(page);
  if (!chatWide.sendHit) fail('send miss 1280 ' + JSON.stringify(chatWide));
  if (chatWide.sideways) fail('chat sideways 1280');
  if (!chatWide.statusShown) fail('status hidden');
  if (wide.errors.length) fail('pageerror ' + wide.errors[0]);

  var phone = await openApp(390, 800, 1, false);
  await phone.page.evaluate(function () { window.switchTab('gathering'); });
  await phone.page.waitForTimeout(300);
  var phoneSide = await phone.page.evaluate(function () {
    var buttons = document.querySelectorAll('#fl-gathering-speak-mount .flgs-btn');
    var short = false;
    for (var i = 0; i < buttons.length; i++) {
      if (buttons[i].getBoundingClientRect().height < 44) short = true;
    }
    return {
      sideways: document.documentElement.scrollWidth > window.innerWidth + 1,
      short: short,
      checker: !!document.querySelector('[data-chair="seat-5"]')
    };
  });
  if (phoneSide.sideways) fail('sideways 390');
  if (phoneSide.short) fail('short button 390');
  if (!phoneSide.checker) fail('checker missing 390');
  var chatPhone = await readChat(phone.page);
  if (!chatPhone.sendHit) fail('send miss 390');
  if (phone.errors.length) fail('phone pageerror ' + phone.errors[0]);

  var dense = await openApp(640, 400, 2, false);
  var chatDense = await readChat(dense.page);
  if (!chatDense.sendHit) fail('send miss dense');
  if (dense.errors.length) fail('dense pageerror ' + dense.errors[0]);

  var reduced = await openApp(1280, 800, 1, true);
  await reduced.page.evaluate(function () { window.switchTab('gathering'); });
  await reduced.page.waitForTimeout(200);
  var calm = await reduced.page.evaluate(function () {
    var card = document.querySelector('#fl-gathering-speak-mount .flgs-card');
    var cs = card ? getComputedStyle(card) : null;
    return {
      transition: cs ? cs.transitionProperty : '',
      duration: cs ? cs.transitionDuration : '',
      transform: cs ? cs.transform : '',
      glow: cs ? cs.boxShadow : ''
    };
  });
  if (calm.transition !== 'none') fail('reduced transition ' + calm.transition);
  if (parseFloat(calm.duration) > 0) fail('reduced duration ' + calm.duration);
  if (calm.transform && calm.transform !== 'none') fail('reduced transform ' + calm.transform);
  if (!calm.glow || calm.glow === 'none') fail('reduced glow dropped');

  console.log(JSON.stringify({
    chrome: version,
    wide: chatWide.send,
    phone: chatPhone.send,
    dense: chatDense.send,
    local: localWalk,
    checker: 'seat-5',
    gather: gatherMd5.slice(0, 8),
    speak: speakMd5.slice(0, 8)
  }));
  console.log('SMOKE_OK gathering speak checker v0.1');
  await browser.close();
  server.close();
})().catch(function (err) {
  console.error('FAIL ' + (err && err.stack ? err.stack : err));
  process.exit(1);
});
