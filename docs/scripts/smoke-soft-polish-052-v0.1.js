#!/usr/bin/env node
// Smoke: soft polish 052 v0.1. Local only. Seven softs, one brick.
'use strict';
var fs = require('fs');
var path = require('path');
var http = require('http');
var crypto = require('crypto');

var root = path.join(__dirname, '..', '..');
var treeRoot = process.env.TREE_ROOT || '/tmp/tree-soft-052';
var port = 8952;
var treePort = 8953;

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
  'docs/modules/fl-bridge.js': '3b5ef06849a142e50c78e7ba1e057980',
  'docs/modules/propose.js': '2cb7f00cce74815a5b03c933bc902b18',
  'docs/modules/chat-autonomy.js': 'c83cf6c9f11271aeaa35ed6070f188f3',
  'docs/modules/gathering-speak.js': '0460fdc777a21f7a1744f401dda82cb2'
};

Object.keys(locks).forEach(function (rel) {
  var got = md5(path.join(root, rel));
  if (got !== locks[rel]) fail(rel + ' md5 ' + got);
});
if (md5(path.join(treeRoot, 'docs/modules/fl-connect.js')) !== locks['docs/modules/fl-connect.js']) fail('alpha fl-connect');
if (md5(path.join(treeRoot, 'docs/modules/fl-gathering.js')) !== locks['docs/modules/fl-gathering.js']) fail('alpha fl-gathering');
if (md5(path.join(treeRoot, 'docs/modules/gathering-speak.js')) !== locks['docs/modules/gathering-speak.js']) fail('alpha gathering-speak');
if (md5(path.join(treeRoot, 'docs/modules/fl-bridge.js')) !== locks['docs/modules/fl-bridge.js']) fail('alpha fl-bridge');
if (md5(path.join(root, 'docs/modules/tree-love-connect.css')) !== md5(path.join(treeRoot, 'docs/modules/tree-love-connect.css'))) {
  fail('glow sheet diverged');
}
var appHtml = fs.readFileSync(path.join(root, 'docs/app.html'));
var indexHtml = fs.readFileSync(path.join(root, 'index.html'));
if (!appHtml.equals(indexHtml)) fail('index mismatch');
var appText = appHtml.toString('utf8');
['flMoreTap', 'data-active-tab', 'flSoft052AlsoFollows', 'v-soft-polish-052-v0.1', 'id="statusText"'].forEach(function (bit) {
  if (appText.indexOf(bit) === -1) fail('app missing ' + bit);
});
var speak = fs.readFileSync(path.join(root, 'docs/modules/gathering-speak.js'), 'utf8');
if (speak.indexOf('Nothing in flight.') === -1) fail('pause no-op missing');
if (speak.indexOf('if (!inflight)') === -1) fail('pause guard missing');
var auto = fs.readFileSync(path.join(root, 'docs/modules/chat-autonomy.js'), 'utf8');
if (auto.indexOf('I review each one myself') === -1) fail('review wording missing');
if (auto.indexOf('openBuildSettings') === -1) fail('settings jump missing');
['\u2014', '&mdash;', 'innerHTML', 'confirm(', 'eval(', 'new Function'].forEach(function (bad) {
  if (auto.indexOf(bad) !== -1) fail('autonomy has ' + bad);
  if (speak.indexOf(bad) !== -1) fail('speak has ' + bad);
});
var treePages = fs.readdirSync(path.join(treeRoot, 'docs')).filter(function (f) { return f.slice(-5) === '.html'; });
treePages.forEach(function (f) {
  var text = fs.readFileSync(path.join(treeRoot, 'docs', f), 'utf8');
  if (text.indexOf('fl-gathering-speak-mount') !== -1) fail('tree page mounts speak ' + f);
  if (text.indexOf('fl-gathering.js') !== -1) fail('tree page mounts chairs ' + f);
});

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
  var treeServer = await serve(path.join(treeRoot, 'docs'), treePort);
  var base = 'http://127.0.0.1:' + port;
  var treeBase = 'http://127.0.0.1:' + treePort;
  var pwPath = process.env.FL_PLAYWRIGHT || '/tmp/gc-pw-local/node_modules/playwright-core';
  var pw = require(pwPath);
  var chromePath = process.env.FL_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  var browser = await pw.chromium.launch({ executablePath: chromePath, headless: true });
  var version = browser.version();

  async function openApp(width, height, scale, hash) {
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
    await page.goto(base + '/app.html' + (hash || ''), { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(function () {
      return window.FLChatAutonomy && document.getElementById('flChatSearchToggle') && document.getElementById('sendBtn') && document.getElementById('flMoreBtn');
    }, null, { timeout: 20000 });
    return { page: page, context: context, errors: errors };
  }

  var wide = await openApp(1280, 800, 1);
  await wide.page.evaluate(function () { window.switchTab('chat'); });
  await wide.page.evaluate(function () { window.FLChatAutonomy.ensureAsked(); });
  await wide.page.waitForFunction(function () {
    return document.querySelector('[data-fl-autonomy="ask"]');
  }, null, { timeout: 5000 });
  var ask = await wide.page.evaluate(function () {
    var row = document.querySelector('[data-fl-autonomy="ask"]');
    var jump = document.querySelector('.fl-chat-autonomy-settings-jump');
    var buttons = row ? row.querySelectorAll('button') : [];
    var heights = [];
    var i;
    for (i = 0; i < buttons.length; i++) heights.push(Math.round(buttons[i].getBoundingClientRect().height));
    return {
      text: row ? row.textContent : '',
      buttons: buttons.length,
      heights: heights,
      jump: jump ? Math.round(jump.getBoundingClientRect().height) : 0,
      jumpTag: jump ? jump.tagName : ''
    };
  });
  if (ask.text.indexOf('I review each one myself') === -1) fail('review wording ' + ask.text);
  if (ask.text.indexOf('You look before anything applies.') === -1) fail('look line');
  if (ask.text.indexOf('You can change this later in Settings.') === -1) fail('settings hint');
  if (ask.buttons !== 3) fail('choice buttons ' + ask.buttons);
  ask.heights.forEach(function (h) { if (h < 44) fail('choice height ' + h); });
  if (ask.jumpTag !== 'A' || ask.jump < 44) fail('jump ' + JSON.stringify(ask));
  await wide.page.click('.fl-chat-autonomy-settings-jump');
  await wide.page.waitForFunction(function () {
    var sec = document.getElementById('flChatBuildTrustSection');
    if (!sec) return false;
    var r = sec.getBoundingClientRect();
    var radios = sec.textContent || '';
    return r.top < window.innerHeight && r.bottom > 0 && radios.indexOf('I review each one myself') !== -1 && document.getElementById('tab-settings').classList.contains('active');
  }, null, { timeout: 8000 });
  var settingsPlace = await wide.page.evaluate(function () {
    var web = document.getElementById('webSearchToggleSection');
    var sec = document.getElementById('flChatBuildTrustSection');
    return { next: !!(web && web.nextElementSibling === sec) };
  });
  if (!settingsPlace.next) fail('build is not under web search');

  await wide.page.keyboard.press('Escape');
  await wide.page.evaluate(function () { window.switchTab('chat'); });
  var still = await wide.page.evaluate(function () {
    return {
      asked: localStorage.getItem('fl_chatBuildTrustAsked'),
      trust: localStorage.getItem('fl_chatBuildTrust'),
      dismissed: window.FLChatAutonomy.sessionDismissed(),
      ask: document.querySelectorAll('[data-fl-autonomy="ask"]').length
    };
  });
  if (still.asked !== null || still.trust !== null || !still.dismissed || still.ask !== 0) fail('escape ' + JSON.stringify(still));
  if (wide.errors.length) fail('wide error ' + wide.errors[0]);

  async function seat(page) {
    await page.evaluate(function () {
      var send = document.getElementById('sendBtn');
      var sr = send.getBoundingClientRect();
      var goal = Math.max(96, (window.innerHeight - sr.height) / 2);
      document.documentElement.scrollTop += sr.top - goal;
    });
    await page.waitForTimeout(350);
  }
  var dense = await openApp(640, 400, 2);
  await dense.page.evaluate(function () { window.switchTab('chat'); });
  await dense.page.waitForTimeout(400);
  await seat(dense.page);
  await seat(dense.page);
  var z200 = await dense.page.evaluate(function () {
    function box(el) {
      if (!el) return null;
      var r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height, t: (el.textContent || '').slice(0, 40) };
    }
    function overlap(a, b) {
      if (!a || !b) return false;
      return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    }
    var send = document.getElementById('sendBtn');
    var search = document.getElementById('flChatSearchToggle');
    var status = document.getElementById('statusText');
    var sr = send.getBoundingClientRect();
    var cx = Math.min(window.innerWidth - 2, Math.max(0, sr.left + sr.width / 2));
    var cy = Math.min(window.innerHeight - 2, Math.max(0, sr.top + sr.height / 2));
    var hit = document.elementFromPoint(cx, cy);
    var sb = box(search);
    var sendBox = box(send);
    var st = status ? status.getBoundingClientRect() : null;
    var msg = document.querySelector('#tab-chat .chat-messages');
    var between = [];
    var node = document.getElementById('flChatSearchRow');
    while (node && node !== send && between.length < 8) {
      var br = node.getBoundingClientRect();
      between.push((node.id || node.className || node.tagName) + ':' + Math.round(br.height));
      node = node.nextElementSibling;
    }
    return {
      status: status ? status.textContent : '',
      statusY: st ? Math.round(st.top) : null,
      statusSeen: !!(st && st.width > 0 && st.bottom > 0 && st.top < window.innerHeight),
      searchY: sb ? Math.round(sb.y) : null,
      searchH: sb ? Math.round(sb.h) : null,
      searchSeen: !!(sb && sb.h >= 44 && sb.y + sb.h > 0 && sb.y < window.innerHeight),
      searchText: sb ? sb.t : '',
      sendY: sendBox ? Math.round(sendBox.y) : null,
      msgH: msg ? Math.round(msg.getBoundingClientRect().height) : null,
      between: between,
      overlap: overlap(sb, sendBox),
      sendHit: !!(hit && (hit === send || send.contains(hit))),
      hit: hit ? String(hit.id || hit.className || hit.tagName).slice(0, 40) : 'none',
      sideways: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  });
  if (!z200.status || z200.status.indexOf('Ready') !== 0) fail('z200 status ' + z200.status);
  if (!z200.statusSeen) fail('z200 strip not in view ' + JSON.stringify(z200));
  if (!z200.searchSeen) fail('z200 search ' + JSON.stringify(z200));
  if (z200.searchText.indexOf('Search') !== 0) fail('z200 search text');
  if (z200.overlap) fail('z200 search covers send');
  if (!z200.sendHit) fail('z200 send hit ' + z200.hit);
  if (z200.sideways) fail('z200 sideways');
  if (dense.errors.length) fail('dense error ' + dense.errors[0]);

  await wide.page.evaluate(function () { window.switchTab('chat'); });
  await wide.page.setViewportSize({ width: 1280, height: 800 });
  var drop = await wide.page.evaluate(function () {
    var el = document.getElementById('flMoreDropdown');
    return getComputedStyle(el).display;
  });
  if (drop !== 'none') fail('dropdown started open ' + drop);
  await wide.page.click('#flMoreBtn');
  await wide.page.waitForFunction(function () {
    var el = document.getElementById('flMoreDropdown');
    var cs = getComputedStyle(el);
    return cs.display !== 'none' && el.getClientRects().length > 0 && (el.textContent || '').indexOf('Connect') !== -1;
  }, null, { timeout: 5000 });
  await wide.page.evaluate(function () {
    var items = document.querySelectorAll('#flMoreDropdown button');
    var i;
    for (i = 0; i < items.length; i++) {
      var text = items[i].textContent || '';
      if (text.indexOf('Connect') !== -1 && text.indexOf('Every room') === -1 && text.indexOf('Get Connected') === -1) {
        items[i].click();
        return;
      }
    }
  });
  await wide.page.waitForFunction(function () {
    var tab = document.getElementById('tab-connect');
    return tab && tab.classList.contains('active');
  }, null, { timeout: 5000 });

  var phone = await openApp(390, 800, 1);
  await phone.page.waitForTimeout(700);
  await phone.page.click('#mnav-more');
  await phone.page.waitForFunction(function () {
    var sheet = document.getElementById('flMobileMoreSheet');
    var cs = sheet ? getComputedStyle(sheet) : null;
    return sheet && sheet.classList.contains('open') && cs && cs.display !== 'none' && (sheet.textContent || '').indexOf('Connect') !== -1;
  }, null, { timeout: 5000 });
  var phoneBox = await phone.page.evaluate(function () {
    return document.documentElement.scrollWidth > window.innerWidth + 1;
  });
  if (phoneBox) fail('390 sideways');
  if (phone.errors.length) fail('phone error ' + phone.errors[0]);

  async function readConnect(hash) {
    var opened = await openApp(1280, 800, 1, hash);
    await opened.page.waitForFunction(function () {
      var tab = document.getElementById('tab-connect');
      var nav = document.getElementById('flTabNav');
      var label = document.querySelector('#flMoreBtn .tab-label');
      var first = document.querySelector('[data-tab].active');
      return tab && tab.classList.contains('active') && nav && nav.getAttribute('data-active-tab') === 'connect' && label && label.textContent === 'Connect' && first && first.getAttribute('data-tab') === 'connect';
    }, null, { timeout: 8000 });
    var got = await opened.page.evaluate(function () {
      var mount = document.getElementById('fl-connect-mount');
      var also = document.getElementById('fl-also-connect');
      var first = document.querySelector('[data-tab].active');
      return {
        active: first ? first.getAttribute('data-tab') : '',
        label: (document.querySelector('#flMoreBtn .tab-label') || {}).textContent || '',
        nav: document.getElementById('flTabNav').getAttribute('data-active-tab'),
        shelf: !!(mount && also && mount.nextElementSibling === also),
        content: !!document.getElementById('fl-connect-mount')
      };
    });
    if (got.active !== 'connect' || got.label !== 'Connect' || got.nav !== 'connect') fail(hash + ' label ' + JSON.stringify(got));
    if (!got.shelf || !got.content) fail(hash + ' shelf ' + JSON.stringify(got));
    if (opened.errors.length) fail(hash + ' error ' + opened.errors[0]);
    await opened.context.close();
  }
  await readConnect('#connect');
  await readConnect('?tab=connect');

  await wide.page.evaluate(function () { window.switchTab('gathering'); });
  await wide.page.waitForFunction(function () {
    return document.getElementById('flgs-pause-btn');
  }, null, { timeout: 8000 });
  await wide.page.click('#flgs-pause-btn');
  var idle = await wide.page.textContent('#flgs-receipt');
  if (idle !== 'Nothing in flight.') fail('idle pause ' + idle);
  await wide.page.evaluate(function () {
    localStorage.setItem('fl_gathering_chairs_v0', JSON.stringify({
      v: 1,
      seats: { cortex: { kind: 'local', model: 'quiet-stand-in', base: 'http://127.0.0.1:9', label: 'Quiet stand-in' } },
      speaking: 'cortex'
    }));
    localStorage.removeItem('fl_gathering_thread_v0');
    window.__mode = 'hang';
    window.fetch = function (url, opts) {
      if (window.__mode === 'now') {
        return Promise.resolve({
          ok: true,
          json: function () { return Promise.resolve({ message: { content: 'kept hello' } }); }
        });
      }
      return new Promise(function (resolve, reject) {
        if (opts && opts.signal) {
          opts.signal.addEventListener('abort', function () {
            reject(new DOMException('aborted', 'AbortError'));
          });
        }
        window.__late = function () {
          resolve({
            ok: true,
            json: function () { return Promise.resolve({ message: { content: 'invented late' } }); }
          });
        };
      });
    };
    if (window.FLGatheringSpeak) window.FLGatheringSpeak.refresh();
  });
  await wide.page.fill('#flgs-ask', 'Say a word');
  await wide.page.click('#flgs-ask-btn');
  await wide.page.waitForFunction(function () {
    return (document.getElementById('flgs-receipt') || {}).textContent === 'Listening...';
  }, null, { timeout: 5000 });
  await wide.page.click('#flgs-pause-btn');
  var paused = await wide.page.evaluate(function () {
    if (typeof window.__late === 'function') window.__late();
    return {
      receipt: document.getElementById('flgs-receipt').textContent,
      thread: document.getElementById('flgs-thread').textContent
    };
  });
  await wide.page.waitForTimeout(200);
  paused = await wide.page.evaluate(function () {
    return {
      receipt: document.getElementById('flgs-receipt').textContent,
      thread: document.getElementById('flgs-thread').textContent
    };
  });
  if (paused.receipt.indexOf('Paused') === -1) fail('inflight pause ' + paused.receipt);
  if (paused.thread && paused.thread.indexOf('invented late') !== -1) fail('landed after pause ' + paused.thread);
  await wide.page.evaluate(function () { window.__mode = 'now'; });
  await wide.page.fill('#flgs-ask', 'Keep this');
  await wide.page.click('#flgs-ask-btn');
  await wide.page.waitForFunction(function () {
    return (document.getElementById('flgs-receipt') || {}).textContent.indexOf('A turn was kept') !== -1;
  }, null, { timeout: 5000 });
  await wide.page.click('#flgs-pause-btn');
  var kept = await wide.page.evaluate(function () {
    return {
      receipt: document.getElementById('flgs-receipt').textContent,
      thread: document.getElementById('flgs-thread').textContent
    };
  });
  if (kept.receipt.indexOf('A turn was kept') === -1) fail('pause clobbered keep ' + kept.receipt);
  if (kept.thread.indexOf('kept hello') === -1) fail('kept turn dropped');
  if (kept.receipt.indexOf('Paused') !== -1) fail('false pause ' + kept.receipt);

  var tree = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  var treePage = await tree.newPage();
  var treeErrors = [];
  treePage.on('pageerror', function (err) { treeErrors.push(String(err)); });
  await treePage.emulateMedia({ reducedMotion: 'reduce' });
  await treePage.goto(treeBase + '/settings.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await treePage.waitForFunction(function () {
    var mount = document.getElementById('fl-connect-mount');
    var also = document.getElementById('fl-also-connect');
    var bridge = document.getElementById('fl-bridge-card');
    return mount && also && bridge && mount.nextElementSibling === also && (document.body.textContent || '').indexOf('Help me wake a mind') !== -1;
  }, null, { timeout: 8000 });
  var order = await treePage.evaluate(function () {
    var mount = document.getElementById('fl-connect-mount');
    var also = document.getElementById('fl-also-connect');
    var bridge = document.getElementById('fl-bridge-card');
    var ids = [];
    var n = mount;
    while (n && ids.length < 4) { ids.push(n.id || n.tagName); n = n.nextElementSibling; }
    var buttons = document.querySelectorAll('#fl-also-connect .fl-also-btn, #settings-grandmother button, #tree-door-host button');
    var short = false;
    var i;
    for (i = 0; i < buttons.length; i++) {
      if (buttons[i].getBoundingClientRect().height > 0 && buttons[i].getBoundingClientRect().height < 44) short = true;
    }
    return {
      ids: ids,
      bridgeAfter: !!(also.compareDocumentPosition(bridge) & Node.DOCUMENT_POSITION_FOLLOWING),
      sideways: document.documentElement.scrollWidth > window.innerWidth + 1,
      short: short
    };
  });
  if (order.ids[0] !== 'fl-connect-mount' || order.ids[1] !== 'fl-also-connect') fail('tree order ' + JSON.stringify(order));
  if (!order.bridgeAfter) fail('bridge missing after shelf');
  if (order.sideways) fail('tree sideways');
  if (order.short) fail('tree button short');
  if (treeErrors.length) fail('tree error ' + treeErrors[0]);

  await browser.close();
  server.close();
  treeServer.close();
  console.log(JSON.stringify({ chrome: version, z200: 'send-clear', pause: 'kept', tree: order.ids.slice(0, 3) }));
  console.log('SMOKE_OK soft polish 052 v0.1');
})().catch(function (err) {
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
