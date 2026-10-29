#!/usr/bin/env node
// Smoke: continuity doorway v0.1. Local only. One calm line. No second transcript.
'use strict';
var fs = require('fs');
var path = require('path');
var http = require('http');
var crypto = require('crypto');

var root = path.join(__dirname, '..', '..');
var treeRoot = process.env.TREE_ROOT || '/tmp/tree-door-053';
var port = 8964;

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
  'docs/modules/fl-gathering.js': '4dbbff5d554c42256605b37939835080',
  'docs/modules/gathering-speak.js': '0460fdc777a21f7a1744f401dda82cb2',
  'docs/modules/chat-autonomy.js': 'c83cf6c9f11271aeaa35ed6070f188f3',
  'docs/modules/ai-continuity.js': '079c072dc882ad189035f9d6c64489f4',
  'docs/modules/fl-bridge.js': '3b5ef06849a142e50c78e7ba1e057980',
  'docs/modules/propose.js': '2cb7f00cce74815a5b03c933bc902b18'
};

Object.keys(locks).forEach(function (rel) {
  var got = md5(path.join(root, rel));
  if (got !== locks[rel]) fail(rel + ' md5 ' + got);
});
if (md5(path.join(treeRoot, 'docs/modules/fl-connect.js')) !== locks['docs/modules/fl-connect.js']) fail('alpha fl-connect');
if (md5(path.join(treeRoot, 'docs/modules/gathering-speak.js')) !== locks['docs/modules/gathering-speak.js']) fail('alpha speak');

var door = fs.readFileSync(path.join(root, 'docs/modules/continuity-doorway.js'), 'utf8');
['\u2014', '&mdash;', 'innerHTML', 'confirm(', 'eval(', 'new Function', 'Quiet Room', 'localhost'].forEach(function (bad) {
  if (door.indexOf(bad) !== -1) fail('door has ' + bad);
});
if (door.indexOf('fl_continuity_doorway_v0') === -1) fail('store key missing');
if (door.indexOf("Here's what we were doing:") === -1) fail('line missing');
if (door.indexOf('v-continuity-doorway-v0.1') === -1) fail('marker missing');

var appHtml = fs.readFileSync(path.join(root, 'docs/app.html'));
var indexHtml = fs.readFileSync(path.join(root, 'index.html'));
if (!appHtml.equals(indexHtml)) fail('index mismatch');
if (appHtml.toString('utf8').indexOf('modules/continuity-doorway.js') === -1) fail('app script missing');
if (fs.readFileSync(path.join(root, 'docs/modules/ai-continuity.js'), 'utf8').indexOf('continuity-doorway') !== -1) fail('ai continuity edited');

var treePages = fs.readdirSync(path.join(treeRoot, 'docs')).filter(function (f) { return f.slice(-5) === '.html'; });
var treeShell = false;
treePages.forEach(function (f) {
  var text = fs.readFileSync(path.join(treeRoot, 'docs', f), 'utf8');
  if (text.indexOf('continuity-doorway') !== -1) fail('tree mounts doorway ' + f);
  if (text.indexOf('id="flTabNav"') !== -1 || text.indexOf('id="chatInput"') !== -1) treeShell = true;
});
if (treeShell) fail('tree shell appeared');

function serve(dir, listenPort) {
  return new Promise(function (resolve) {
    var server = http.createServer(function (req, res) {
      var urlPath = decodeURIComponent(req.url.split('?')[0]);
      if (urlPath === '/') urlPath = '/app.html';
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

(async function () {
  var server = await serve(path.join(root, 'docs'), port);
  var base = 'http://127.0.0.1:' + port;
  var pwPath = process.env.FL_PLAYWRIGHT || '/tmp/gc-pw-local/node_modules/playwright-core';
  var pw = require(pwPath);
  var chromePath = process.env.FL_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  var browser = await pw.chromium.launch({ executablePath: chromePath, headless: true });
  var version = browser.version();

  async function openApp(width, height) {
    var context = await browser.newContext({ viewport: { width: width, height: height } });
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
      return window.FLContinuityDoorway && document.getElementById('fl-continuity-doorway') && document.getElementById('sendBtn') && document.getElementById('statusText');
    }, null, { timeout: 20000 });
    return { page: page, context: context, errors: errors };
  }

  function storeOf(page) {
    return page.evaluate(function () {
      return localStorage.getItem('fl_continuity_doorway_v0');
    });
  }

  var quiet = await openApp(1280, 800);
  var quietState = await quiet.page.evaluate(function () {
    var host = document.getElementById('fl-continuity-doorway');
    var line = document.getElementById('fl-continuity-doorway-line');
    return {
      hidden: !!host.hidden,
      text: line ? line.textContent : 'missing',
      status: (document.getElementById('statusText').textContent || '').length > 0
    };
  });
  if (!quietState.hidden) fail('fresh line shown');
  if (quietState.text) fail('fresh text ' + quietState.text);
  if (!quietState.status) fail('status strip missing');
  if (await storeOf(quiet.page)) fail('fresh store not empty');

  await quiet.page.fill('#chatInput', 'Where did we leave the bread');
  await quiet.page.click('#sendBtn');
  await quiet.page.waitForFunction(function () {
    var raw = localStorage.getItem('fl_continuity_doorway_v0') || '';
    return raw.indexOf('bread') !== -1 && raw.indexOf('sk-') === -1;
  }, null, { timeout: 10000 });

  await quiet.page.evaluate(function () { window.switchTab('more'); });
  var left = await quiet.page.evaluate(function () {
    var host = document.getElementById('fl-continuity-doorway');
    var line = document.getElementById('fl-continuity-doorway-line');
    var btn = document.getElementById('fl-continuity-doorway-continue');
    var rect = btn.getBoundingClientRect();
    var style = getComputedStyle(host);
    return {
      hidden: !!host.hidden,
      text: line.textContent,
      place: host.getAttribute('data-place'),
      h: rect.height,
      motion: style.animationName + ' ' + style.transitionDuration,
      more: document.getElementById('tab-more').classList.contains('active')
    };
  });
  if (left.hidden) fail('line hidden after leave');
  if (left.text.indexOf('bread') === -1) fail('line missed ask ' + left.text);
  if (left.text.indexOf("Here's what we were doing:") !== 0) fail('line wording ' + left.text);
  if (left.place !== 'chat') fail('place ' + left.place);
  if (left.h < 44) fail('continue short ' + left.h);
  if (!left.more) fail('more tab not open');

  var beforeSend = await quiet.page.evaluate(function () {
    window.__doorSends = 0;
    var orig = window.sendMessage;
    window.sendMessage = function () {
      window.__doorSends += 1;
      return orig.apply(this, arguments);
    };
    return document.querySelectorAll('#chatMessages .chat-message').length;
  });
  await quiet.page.click('#fl-continuity-doorway-continue');
  var back = await quiet.page.evaluate(function () {
    var nav = document.getElementById('flTabNav');
    return {
      tab: nav ? nav.getAttribute('data-active-tab') : '',
      chat: document.getElementById('tab-chat').classList.contains('active'),
      sends: window.__doorSends,
      msgs: document.querySelectorAll('#chatMessages .chat-message').length
    };
  });
  if (back.tab !== 'chat' || !back.chat) fail('continue missed chat ' + back.tab);
  if (back.sends !== 0) fail('continue sent ' + back.sends);
  if (back.msgs !== beforeSend) fail('continue invented a message');

  await quiet.page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
  await quiet.page.waitForFunction(function () {
    var line = document.getElementById('fl-continuity-doorway-line');
    return line && line.textContent.indexOf('bread') !== -1;
  }, null, { timeout: 20000 });
  var wide = await quiet.page.evaluate(function () {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
  });
  if (wide) fail('sideways 1280');

  var refused = await quiet.page.evaluate(function () {
    var before = localStorage.getItem('fl_continuity_doorway_v0');
    var ok = window.FLContinuityDoorway.remember('sk-abcdefghijklmnop', 'chat');
    var after = localStorage.getItem('fl_continuity_doorway_v0') || '';
    return { ok: ok, kept: after === before, leak: after.indexOf('sk-') !== -1 };
  });
  if (refused.ok) fail('key was stored');
  if (!refused.kept || refused.leak) fail('key leak');

  await quiet.page.evaluate(function () { window.__flUserPaused = true; window.FLContinuityDoorway.paint(); });
  var whilePaused = await quiet.page.evaluate(function () {
    return document.getElementById('fl-continuity-doorway').hidden;
  });
  if (!whilePaused) fail('pause did not hide the line');
  await quiet.page.evaluate(function () { window.__flUserPaused = false; window.FLContinuityDoorway.paint(); });

  var cleared = await quiet.page.evaluate(async function () {
    var name = document.getElementById('newConvName');
    if (name) name.value = 'Doorway clear';
    try { await window.confirmNewConversation(); } catch (e) {}
    var host = document.getElementById('fl-continuity-doorway');
    var raw = localStorage.getItem('fl_continuity_doorway_v0');
    return { hidden: !!host.hidden, raw: raw };
  });
  if (cleared.raw) fail('clear left store ' + cleared.raw);
  if (!cleared.hidden) fail('clear left the line up');

  var phone = await openApp(390, 800);
  await phone.page.evaluate(function () {
    window.FLContinuityDoorway.remember('A short note from this phone', 'connect');
  });
  var phoneBox = await phone.page.evaluate(function () {
    var btn = document.getElementById('fl-continuity-doorway-continue');
    var rect = btn.getBoundingClientRect();
    return {
      hidden: document.getElementById('fl-continuity-doorway').hidden,
      h: rect.height,
      side: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      text: document.getElementById('fl-continuity-doorway-line').textContent
    };
  });
  if (phoneBox.hidden) fail('phone line quiet');
  if (phoneBox.h < 44) fail('phone button ' + phoneBox.h);
  if (phoneBox.side) fail('sideways 390');
  if (phoneBox.text.indexOf('Connect') === -1) fail('phone connect ' + phoneBox.text);
  await phone.page.click('#fl-continuity-doorway-continue');
  var phoneTab = await phone.page.evaluate(function () {
    return document.getElementById('flTabNav').getAttribute('data-active-tab');
  });
  if (phoneTab !== 'connect') fail('phone continue ' + phoneTab);

  if (quiet.errors.length) fail('page error ' + quiet.errors[0]);
  if (phone.errors.length) fail('phone error ' + phone.errors[0]);

  await browser.close();
  server.close();
  console.log(JSON.stringify({ chrome: version, line: 'bread', pause: 'hidden', clear: 'quiet', tree: 'no-shell' }));
  console.log('SMOKE_OK continuity doorway v0.1');
})().catch(function (err) {
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
