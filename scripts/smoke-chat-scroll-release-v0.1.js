#!/usr/bin/env node
'use strict';
// v-chat-scroll-release-v0.1
// Local only. Playwright drives the Chrome already on this Mac.
var fs = require('fs');
var path = require('path');
var crypto = require('crypto');
var http = require('http');

var root = path.join(__dirname, '..');
var clayPin = '2da32883c514e4ad2a3cd8571e7a7b15';
var base = process.env.GC046_BASE || 'http://127.0.0.1:8826';

function md5(file) {
  return crypto.createHash('md5').update(fs.readFileSync(file)).digest('hex');
}
function fail(msg) {
  console.error('FAIL ' + msg);
  process.exit(1);
}

var clay = path.join(root, 'docs/modules/particle-clay.js');
if (md5(clay) !== clayPin) fail('particle-clay.js ' + md5(clay));
var treeClay = process.env.TREE_CLAY || '/tmp/tree-scroll-046/docs/modules/particle-clay.js';
if (fs.existsSync(treeClay) && md5(treeClay) !== clayPin) fail('tree particle-clay.js ' + md5(treeClay));

var app = fs.readFileSync(path.join(root, 'docs/app.html'));
var index = fs.readFileSync(path.join(root, 'index.html'));
if (!app.equals(index)) fail('index.html differs from docs/app.html');

var modPath = path.join(root, 'docs/modules/chat-scroll-release.js');
var mod = fs.readFileSync(modPath, 'utf8');
['preventDefault', 'scrollTop', 'scrollLeft', 'scrollTo', 'scrollBy', 'scrollIntoView', 'innerHTML', 'eval(', 'confirm(', 'new Function', '\u2014', '&mdash;'].forEach(function (tok) {
  if (mod.indexOf(tok) !== -1) fail('module has ' + tok);
});
if (mod.indexOf("version: 'v0.1'") === -1) fail('module version');
console.log('chat-scroll-release.js ' + md5(modPath));

var appText = app.toString('utf8');
if (appText.indexOf('modules/chat-scroll-release.js') === -1) fail('app missing module');
if (appText.indexOf('modules/chat-scroll-release.js') > appText.indexOf('modules/particle-clay.js')) fail('module loads after clay');
if (appText.indexOf('id="flChatUpdateCheck"') === -1) fail('update row missing');
if (appText.indexOf('id="flChatGetNewest"') === -1) fail('signal neighbor missing');
if (appText.indexOf('FlUpdater.check()') === -1) fail('row does not call FlUpdater.check');
if (appText.indexOf('FlUpdater.doUpdate()') === -1) fail('refresh does not call FlUpdater.doUpdate');
if (appText.indexOf('id="desktopUpdateBtn"') === -1) fail('desktop update button removed');

function harness() {
  return '<!DOCTYPE html><html><head><meta charset="utf-8">' +
    '<style>#chatMessages{height:420px;overflow:auto;scroll-behavior:smooth;border:1px solid #333}' +
    '.chat-message{font:16px/16px Georgia,serif;margin:0;padding:0;white-space:pre-wrap}</style></head><body>' +
    '<div id="chatMessages"></div><div id="chatPresenceRow"></div>' +
    '<script>try{localStorage.setItem("fl_clay","on");localStorage.setItem("fl_clay_offer","yes");}catch(e){}</script>' +
    '<script src="' + base + '/modules/chat-scroll-release.js" defer></script>' +
    '<script src="' + base + '/modules/clay-math.js" defer></script>' +
    '<script src="' + base + '/modules/clay-forms.js" defer></script>' +
    '<script src="' + base + '/modules/particle-clay.js" defer></script>' +
    '</body></html>';
}

function replyText(tag) {
  var rows = [];
  for (var i = 1; i <= 60; i++) rows.push(tag + ' line ' + i + ' of the clay reply.');
  return rows.join('\n');
}

async function wheels(page, n) {
  await page.evaluate(function () {
    var el = document.getElementById('chatMessages');
    window.__gc046 = { snaps: 0, last: el.scrollTop, down: false };
    el.addEventListener('wheel', function (ev) { window.__gc046.down = ev.deltaY > 0; }, { passive: true, capture: true });
    el.addEventListener('scroll', function () {
      var now = el.scrollTop;
      var bag = window.__gc046;
      if (bag.down && now < bag.last - 0.5) bag.snaps += 1;
      bag.last = now;
    }, { passive: true });
  });
  var box = page.locator('#chatMessages');
  var point = await box.boundingBox();
  await page.mouse.move(point.x + 30, point.y + point.height / 2);
  for (var i = 0; i < n; i++) {
    await page.mouse.wheel(0, 120);
    await page.waitForTimeout(16);
  }
  return page.evaluate(function () {
    var el = document.getElementById('chatMessages');
    var nodes = document.querySelectorAll('#chatMessages .chat-message.assistant');
    var reply = nodes[nodes.length - 1];
    var er = el.getBoundingClientRect();
    var rr = reply.getBoundingClientRect();
    return {
      top: Math.round(el.scrollTop),
      max: Math.round(el.scrollHeight - el.clientHeight),
      snaps: window.__gc046.snaps,
      replyTop: Math.round(rr.top - er.top),
      released: !!(window.FLChatScrollRelease && window.FLChatScrollRelease.released()),
      aiming: !!window.__flReplyAiming
    };
  });
}

(async function () {
  var pw;
  // before 047: pw = require('/tmp/gc043h-pw/node_modules/playwright-core');
  var pwPath = process.env.FL_PLAYWRIGHT || '/tmp/gc043h-pw/node_modules/playwright-core';
  try { pw = require(pwPath); }
  catch (e) { fail('local playwright-core missing'); }
  // before 047: executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  var chromePath = process.env.FL_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  var browser = await pw.chromium.launch({
    executablePath: chromePath,
    headless: true
  });
  var html = harness();
  async function scenario(width, height) {
    var context = await browser.newContext({ viewport: { width: width, height: height }, deviceScaleFactor: 1 });
    var page = await context.newPage();
    await page.route('**/gc046-harness.html', function (route) {
      route.fulfill({ status: 200, contentType: 'text/html', body: html });
    });
    await page.goto(base + '/gc046-harness.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(function () {
      return window.FLClay && window.FLChatScrollRelease && document.getElementById('chatMessages');
    }, null, { timeout: 15000 });
    await page.evaluate(function (text) {
      var box = document.getElementById('chatMessages');
      var i;
      for (i = 0; i < 300; i++) {
        var div = document.createElement('div');
        div.className = 'chat-message user';
        div.textContent = 'Note ' + (i + 1);
        box.appendChild(div);
      }
      var reply = document.createElement('div');
      reply.className = 'chat-message assistant';
      reply.textContent = text;
      box.appendChild(reply);
      void box.offsetHeight;
      box.scrollTop = box.scrollHeight;
      window.FLClay.setOn(true);
      window.FLClay.onReply(text, []);
      box.scrollTop = box.scrollHeight;
    }, replyText('First'));
    await page.waitForTimeout(500);
    var before = await page.evaluate(function () {
      var el = document.getElementById('chatMessages');
      var nodes = document.querySelectorAll('#chatMessages .chat-message.assistant');
      var reply = nodes[nodes.length - 1];
      var er = el.getBoundingClientRect();
      var rr = reply ? reply.getBoundingClientRect() : null;
      return {
        kids: el ? el.childElementCount : 0,
        last: el && el.lastElementChild ? el.lastElementChild.className : '',
        scrollTop: el ? Math.round(el.scrollTop) : null,
        max: el ? Math.round(el.scrollHeight - el.clientHeight) : null,
        replyTop: rr ? Math.round(rr.top - er.top) : null,
        released: window.FLChatScrollRelease.released(),
        guard: !!window.__flReplyGuardOn,
        canvas: !!document.getElementById('fl-clay-canvas')
      };
    });
    if (before.replyTop < -2 || before.replyTop > 12) fail(width + ' reply top before input ' + before.replyTop);
    if (before.released) fail(width + ' released before input');
    if (!before.guard) fail(width + ' guard did not arm');
    if (!before.canvas) fail(width + ' canvas missing');
    var after = await wheels(page, 60);
    if (after.snaps !== 0) fail(width + ' snap-backs ' + after.snaps);
    if (after.top !== after.max) fail(width + ' scroll ' + after.top + '/' + after.max);
    if (!after.released) fail(width + ' not released after wheel');
    await page.evaluate(function (text) {
      var box = document.getElementById('chatMessages');
      var reply = document.createElement('div');
      reply.className = 'chat-message assistant';
      reply.id = 'gc046-next';
      reply.textContent = text;
      box.appendChild(reply);
    }, replyText('Next'));
    await page.waitForFunction(function () { return window.FLChatScrollRelease.released() === false && window.__flUserScrolled === false; }, null, { timeout: 3000 });
    await page.evaluate(function () {
      var box = document.getElementById('chatMessages');
      var reply = document.getElementById('gc046-next');
      box.scrollTop = box.scrollHeight;
      var n = 0;
      function again() {
        window.FLClay.keepReplyTop(reply);
        n += 1;
        if (n < 4) requestAnimationFrame(again);
      }
      again();
    });
    await page.waitForTimeout(400);
    var again = await page.evaluate(function () {
      var el = document.getElementById('chatMessages');
      var reply = document.getElementById('gc046-next');
      var er = el.getBoundingClientRect();
      var rr = reply.getBoundingClientRect();
      return { replyTop: Math.round(rr.top - er.top), released: window.FLChatScrollRelease.released() };
    });
    if (again.released) fail(width + ' still released after the next reply');
    if (again.replyTop < -2 || again.replyTop > 12) fail(width + ' next reply top ' + again.replyTop);
    var second = await wheels(page, 40);
    if (second.snaps !== 0) fail(width + ' second snaps ' + second.snaps);
    if (!second.released) fail(width + ' second release missed');
    if (second.top !== second.max) fail(width + ' second scroll ' + second.top + '/' + second.max);
    await context.close();
    return { before: before, after: after, again: again, second: second };
  }
  var a = await scenario(1280, 800);
  var b = await scenario(1440, 900);

  var context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  var page = await context.newPage();
  await page.addInitScript(function () {
    try {
      localStorage.setItem('fl-welcomed', 'true');
      localStorage.setItem('fl_onboardingComplete', 'true');
    } catch (e) {}
  });
  await page.goto(base + '/app.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(function () { return typeof window.flChatAskNewest === 'function' && document.getElementById('flChatUpdateCheck'); }, null, { timeout: 20000 });
  await page.evaluate(function () { window.switchTab('chat'); });
  await page.evaluate(function () {
    var s = document.createElement('script');
    s.textContent = 'FlUpdater.check = function () { window.__gc046Checked = true; };';
    document.body.appendChild(s);
  });
  var row = await page.evaluate(function () {
    var btn = document.getElementById('flChatUpdateCheck');
    var link = document.getElementById('flChatGetNewest');
    btn.click();
    var br = btn.getBoundingClientRect();
    var lr = link.getBoundingClientRect();
    return {
      text: btn.textContent,
      h: Math.round(br.height),
      linkH: Math.round(lr.height),
      linkText: link.textContent,
      checked: !!window.__gc046Checked,
      scroll: document.documentElement.scrollWidth <= window.innerWidth + 1
    };
  });
  if (row.text.indexOf('Version v') !== 0 || row.text.indexOf('Get the newest') === -1) fail('version row text ' + row.text);
  if (row.h < 44 || row.linkH < 44) fail('button height ' + row.h + '/' + row.linkH);
  if (row.linkText !== 'Get the newest FreeLattice') fail('link text');
  if (!row.checked) fail('click did not call FlUpdater.check');
  if (!row.scroll) fail('sideways scroll at 1280');
  await browser.close();
  console.log(JSON.stringify({ a1280: a.after, b1440: b.after }));
  console.log('SMOKE_OK chat scroll release v0.1');
})().catch(function (err) {
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
