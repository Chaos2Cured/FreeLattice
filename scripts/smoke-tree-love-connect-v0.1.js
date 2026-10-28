#!/usr/bin/env node
// smoke-tree-love-connect-v0.1.js (MIT)
// Local only. Chrome via FL_CHROME. Playwright via FL_PLAYWRIGHT.
var fs = require('fs');
var path = require('path');
var http = require('http');
var crypto = require('crypto');

var root = path.join(__dirname, '..');
var treeRoot = process.env.TREE_ROOT || '/tmp/tree-love-050';
var port = 8931;
var treePort = 8932;

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
  'docs/modules/chat-autonomy.js': '67f590105c82ea6de1445d91fc82860d',
  'docs/modules/propose.js': '2cb7f00cce74815a5b03c933bc902b18'
};

Object.keys(locks).forEach(function (rel) {
  var got = md5(path.join(root, rel));
  if (got !== locks[rel]) fail(rel + ' md5 ' + got);
});

var treeConnect = path.join(treeRoot, 'docs/modules/fl-connect.js');
if (md5(treeConnect) !== locks['docs/modules/fl-connect.js']) fail('alpha fl-connect diverged');
if (md5(path.join(root, 'docs/modules/tree-love-connect.css')) !== md5(path.join(treeRoot, 'docs/modules/tree-love-connect.css'))) {
  fail('glow sheet diverged');
}

var indexHtml = fs.readFileSync(path.join(root, 'index.html'));
var appHtml = fs.readFileSync(path.join(root, 'docs/app.html'));
if (!indexHtml.equals(appHtml)) fail('index mismatch');
var appText = appHtml.toString('utf8');
['id="fl-also-connect"', 'id="fl-chat-connect-porch"', 'id="fl-more-connect-porch"', 'flAlsoConnectGitHub', 'flAlsoConnectOther', 'id="fl-connect-play"', 'id="fl-connect-card"', 'id="statusText"', 'id="ghToken"', 'app.html#connect'].forEach(function (bit) {
  if (appText.indexOf(bit) === -1) fail('app missing ' + bit);
});
var shelf = appText.slice(appText.indexOf('<!-- v-tree-love-connect-v0.1: Also connect'), appText.indexOf('function flAlsoConnectOther'));
['\u2014', '&mdash;', 'innerHTML', 'confirm(', 'eval(', 'new Function', 'Quiet Room'].forEach(function (bad) {
  if (shelf.indexOf(bad) !== -1) fail('shelf has ' + bad);
});
var connectSrc = fs.readFileSync(path.join(root, 'docs/modules/fl-connect.js'), 'utf8');
if (connectSrc.indexOf('Yes, help') === -1) fail('helped bridge line missing');

var install = fs.readFileSync(path.join(root, 'docs/install.html'), 'utf8');
['id="bridge-download"', 'id="desktop-download-ease"', 'id="grandmother-path-start"'].forEach(function (id) {
  if (install.indexOf(id) === -1) fail('install missing ' + id);
});

var settings = fs.readFileSync(path.join(treeRoot, 'docs/settings.html'), 'utf8');
['id="fl-also-connect"', 'id="fl-connect-mount"', 'id="settings-grandmother"', 'id="tree-door-host"', 'id="fl-tree-connect-porch"', 'https://freelattice.com/install.html#bridge-download'].forEach(function (bit) {
  if (settings.indexOf(bit) === -1) fail('alpha missing ' + bit);
});
if (settings.indexOf('ghToken') !== -1) fail('alpha invented a token box');
if (settings.indexOf('lumino-menu') !== -1) fail('alpha lumino menu');
if (settings.indexOf('fl_alpha_local_mind') !== -1) fail('settings collapsed storage');

function serve(dir, listenPort) {
  return new Promise(function (resolve) {
    var server = http.createServer(function (req, res) {
      var urlPath = decodeURIComponent(req.url.split('?')[0]);
      if (urlPath === '/') urlPath = '/app.html';
      var file = path.join(dir, urlPath);
      if (!file.startsWith(dir)) {
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
  var treeServer = await serve(path.join(treeRoot, 'docs'), treePort);
  var base = 'http://127.0.0.1:' + port;
  var treeBase = 'http://127.0.0.1:' + treePort;
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
      return typeof window.switchTab === 'function' && document.getElementById('sendBtn') && document.getElementById('fl-also-connect');
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
      function box(el) {
        if (!el) return null;
        var r = el.getBoundingClientRect();
        return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), t: (el.textContent || '').slice(0, 40) };
      }
      var send = document.getElementById('sendBtn');
      var sr = send.getBoundingClientRect();
      var cy = Math.min(window.innerHeight - 2, Math.max(0, sr.top + sr.height / 2));
      var cx = Math.min(window.innerWidth - 2, Math.max(0, sr.left + sr.width / 2));
      var hit = document.elementFromPoint(cx, cy);
      var status = document.getElementById('statusText');
      var yes = null;
      var seal = null;
      var buttons = document.querySelectorAll('button');
      var i;
      for (i = 0; i < buttons.length; i++) {
        var label = (buttons[i].textContent || '').replace(/\s+/g, ' ').trim();
        if (!yes && label === 'Yes') yes = buttons[i];
        if (!seal && label === 'Seal it') seal = buttons[i];
      }
      return {
        status: status ? status.textContent : '',
        statusShown: !!(status && status.getClientRects().length),
        send: box(send),
        sendHit: !!(hit && (hit === send || send.contains(hit))),
        hit: hit ? ((hit.id || hit.tagName) + '').slice(0, 40) : 'none',
        yes: box(yes),
        seal: box(seal),
        porch: (document.getElementById('fl-chat-connect-porch') || {}).textContent || '',
        play: !!document.getElementById('fl-connect-play'),
        sideways: document.documentElement.scrollWidth > window.innerWidth + 1
      };
    });
  }

  var wide = await openApp(1280, 800, 1, false);
  var page = wide.page;
  await page.evaluate(function () { window.switchTab('connect'); });
  await page.waitForFunction(function () {
    var mount = document.getElementById('fl-connect-mount');
    return mount && mount.childNodes.length > 0 && document.getElementById('fl-also-github');
  }, null, { timeout: 15000 });
  var shelf = await page.evaluate(function () {
    var buttons = document.querySelectorAll('#fl-also-connect .fl-also-btn');
    var heights = [];
    var hrefs = [];
    for (var i = 0; i < buttons.length; i++) {
      heights.push(Math.round(buttons[i].getBoundingClientRect().height));
      if (buttons[i].getAttribute('href')) hrefs.push(buttons[i].getAttribute('href'));
    }
    var card = document.querySelector('#fl-also-connect .fl-also-card');
    var glow = card ? getComputedStyle(card).boxShadow : '';
    return {
      text: document.getElementById('fl-also-connect').textContent,
      heights: heights,
      hrefs: hrefs,
      glow: glow,
      motion: card ? getComputedStyle(card).transitionProperty : '',
      duration: card ? getComputedStyle(card).transitionDuration : '',
      sideways: document.documentElement.scrollWidth > window.innerWidth + 1,
      card: !!document.getElementById('fl-connect-card')
    };
  });
  if (shelf.text.indexOf('Also connect') === -1 || shelf.text.indexOf('Begin here: Install, then Bridge, then Yes, help, then pick a mind.') === -1) {
    fail('shelf copy');
  }
  if (shelf.heights.length < 5) fail('shelf buttons ' + shelf.heights.length);
  shelf.heights.forEach(function (h) { if (h < 44) fail('shelf height ' + h); });
  ['install.html#bridge-download', 'install.html#desktop-download-ease', 'install.html#grandmother-path-start'].forEach(function (href) {
    if (shelf.hrefs.indexOf(href) === -1) fail('missing href ' + href);
  });
  if (!shelf.glow || shelf.glow === 'none') fail('glow missing');
  if (!(parseFloat(shelf.duration) > 0)) fail('motion ' + shelf.motion + ' ' + shelf.duration);
  if (shelf.sideways) fail('connect sideways');
  if (!shelf.card) fail('settings connect card missing from the page');

  await page.evaluate(function () {
    window.__otherOpened = 0;
    if (window.AiSetup && typeof window.AiSetup.openModal === 'function') {
      var orig = window.AiSetup.openModal;
      window.AiSetup.openModal = function () {
        window.__otherOpened += 1;
        return orig.apply(this, arguments);
      };
    }
  });
  await page.click('#fl-also-other');
  await page.waitForTimeout(250);
  var gated = await page.evaluate(function () {
    var tab = document.getElementById('tab-connect');
    return { opened: window.__otherOpened || 0, connect: !!(tab && tab.classList.contains('active')) };
  });
  if (gated.opened !== 0 || !gated.connect) fail('other ways gate ' + JSON.stringify(gated));

  await page.click('#fl-also-github');
  await page.waitForFunction(function () {
    var tab = document.getElementById('tab-workspace');
    var box = document.getElementById('ghToken');
    if (!tab || !box || !tab.classList.contains('active')) return false;
    var r = box.getBoundingClientRect();
    return r.width > 10 && r.height > 10;
  }, null, { timeout: 8000 });

  await page.evaluate(function () { window.switchTab('more'); });
  var more = await page.evaluate(function () {
    var line = document.getElementById('fl-more-connect-porch');
    return line ? line.textContent : '';
  });
  if (more.indexOf('Connect is the first card') === -1) fail('more porch');

  await page.evaluate(function () { window.switchTab('settings'); });
  var start = await page.evaluate(function () {
    var card = document.getElementById('fl-grandmother-path-start');
    return {
      here: !!(card && card.className.indexOf('v-tree-love-connect-v0.1') !== -1),
      connectCard: !!document.getElementById('fl-connect-card')
    };
  });
  if (!start.here || !start.connectCard) fail('start card');

  var chat = await readChat(page);
  if (!chat.play || chat.porch.indexOf('Begin here:') !== 0) fail('chat porch');
  if (!chat.statusShown || chat.status.indexOf('Ready') !== 0) fail('status ' + chat.status);
  if (!chat.send || chat.send.h < 44 || !chat.sendHit) fail('1280 send ' + JSON.stringify(chat));
  if (chat.yes && chat.yes.h > 0 && chat.yes.h < 44) fail('yes short');
  if (chat.seal && chat.seal.h > 0 && chat.seal.h < 44) fail('seal short');
  if (chat.sideways) fail('chat sideways');
  if (wide.errors.length) fail('1280 error ' + wide.errors[0]);
  var wideSend = chat.send;
  await wide.context.close();

  var phone = await openApp(390, 800, 1, false);
  var phoneChat = await readChat(phone.page);
  if (!phoneChat.sendHit || phoneChat.send.h < 44) fail('390 send ' + JSON.stringify(phoneChat));
  if (phoneChat.sideways) fail('390 chat sideways');
  await phone.page.evaluate(function () { window.switchTab('connect'); });
  var phoneShelf = await phone.page.evaluate(function () {
    var buttons = document.querySelectorAll('#fl-also-connect .fl-also-btn');
    var heights = [];
    for (var i = 0; i < buttons.length; i++) heights.push(Math.round(buttons[i].getBoundingClientRect().height));
    return { heights: heights, sideways: document.documentElement.scrollWidth > window.innerWidth + 1 };
  });
  phoneShelf.heights.forEach(function (h) { if (h < 44) fail('390 shelf ' + h); });
  if (phoneShelf.sideways) fail('390 connect sideways');
  if (phone.errors.length) fail('390 error ' + phone.errors[0]);
  var phoneSend = phoneChat.send;
  await phone.context.close();

  var dense = await openApp(640, 400, 2, false);
  var denseChat = await readChat(dense.page);
  if (!denseChat.sendHit || denseChat.send.h < 44) fail('dense send ' + JSON.stringify(denseChat));
  if (denseChat.sideways) fail('dense sideways');
  if (dense.errors.length) fail('dense error ' + dense.errors[0]);
  var denseSend = denseChat.send;
  await dense.context.close();

  var calm = await openApp(1280, 800, 1, true);
  await calm.page.evaluate(function () { window.switchTab('connect'); });
  await calm.page.waitForFunction(function () {
    return document.querySelector('#fl-also-connect .fl-also-card');
  }, null, { timeout: 8000 });
  var reduced = await calm.page.evaluate(function () {
    var card = document.querySelector('#fl-also-connect .fl-also-card');
    var cs = getComputedStyle(card);
    return { transition: cs.transitionProperty, duration: cs.transitionDuration, transform: cs.transform, shadow: cs.boxShadow };
  });
  if (reduced.transition !== 'none' || parseFloat(reduced.duration) > 0) fail('reduced motion ' + reduced.transition + ' ' + reduced.duration);
  if (reduced.transform !== 'none') fail('reduced transform ' + reduced.transform);
  if (!reduced.shadow || reduced.shadow === 'none') fail('reduced lost the resting light');
  if (calm.errors.length) fail('reduced error ' + calm.errors[0]);
  await calm.context.close();

  async function openTree(width) {
    var context = await browser.newContext({
      viewport: { width: width, height: 800 },
      deviceScaleFactor: 1
    });
    var treePage = await context.newPage();
    var errors = [];
    treePage.on('pageerror', function (err) { errors.push(String(err)); });
    await treePage.goto(treeBase + '/settings.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await treePage.waitForFunction(function () {
      var mount = document.getElementById('fl-connect-mount');
      return mount && mount.childNodes.length > 0 && document.getElementById('fl-also-connect');
    }, null, { timeout: 15000 });
    return { page: treePage, context: context, errors: errors };
  }

  var alpha = await openTree(1280);
  var alphaBox = await alpha.page.evaluate(function () {
    var buttons = document.querySelectorAll('#fl-also-connect .fl-also-btn');
    var heights = [];
    var hrefs = [];
    for (var i = 0; i < buttons.length; i++) {
      heights.push(Math.round(buttons[i].getBoundingClientRect().height));
      hrefs.push(buttons[i].getAttribute('href') || '');
    }
    return {
      porch: document.getElementById('fl-tree-connect-porch').textContent,
      later: document.getElementById('fl-also-other-line').textContent,
      grandmother: !!document.getElementById('settings-grandmother'),
      door: !!document.getElementById('tree-door-host'),
      token: !!document.getElementById('ghToken'),
      heights: heights,
      hrefs: hrefs,
      sideways: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  });
  if (alphaBox.porch.indexOf('You are on Connect') !== 0) fail('alpha porch');
  if (alphaBox.later.indexOf('A cloud key is not on this page') === -1) fail('alpha later');
  if (!alphaBox.grandmother || !alphaBox.door) fail('grandmother door');
  if (alphaBox.token) fail('alpha token field');
  alphaBox.heights.forEach(function (h) { if (h < 44) fail('alpha height ' + h); });
  if (alphaBox.hrefs.join(' ').indexOf('freelattice.com/install.html#bridge-download') === -1) fail('alpha bridge');
  if (alphaBox.hrefs.join(' ').indexOf('freelattice.com/app.html') === -1) fail('alpha github link');
  if (alphaBox.sideways) fail('alpha sideways');
  if (alpha.errors.length) fail('alpha error ' + alpha.errors[0]);
  await alpha.context.close();

  var alphaPhone = await openTree(390);
  var alphaNarrow = await alphaPhone.page.evaluate(function () {
    return document.documentElement.scrollWidth > window.innerWidth + 1;
  });
  if (alphaNarrow) fail('alpha 390 sideways');
  if (alphaPhone.errors.length) fail('alpha 390 error ' + alphaPhone.errors[0]);
  await alphaPhone.context.close();

  await browser.close();
  server.close();
  treeServer.close();
  console.log(JSON.stringify({
    chrome: version,
    wide: wideSend,
    phone: phoneSend,
    dense: denseSend,
    alpha: 'settings.html',
    github: 'workspace-ghToken',
    other: 'gated'
  }));
  console.log('SMOKE_OK tree love connect v0.1');
})().catch(function (err) {
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
