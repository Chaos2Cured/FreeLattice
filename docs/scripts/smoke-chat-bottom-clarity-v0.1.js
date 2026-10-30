#!/usr/bin/env node
// Smoke: chat bottom clarity v0.1 and chat doc return v0.1. Local only.
'use strict';
var fs = require('fs');
var path = require('path');
var http = require('http');
var crypto = require('crypto');

var root = path.join(__dirname, '..', '..');
var port = 8972;
var shotDir = '/tmp/fl-bottom-shots';

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
  'docs/modules/ledger-shard-export.js': '75e7e548919617993e048a3fe61cd965',
  'docs/modules/ai-continuity.js': '079c072dc882ad189035f9d6c64489f4',
  'docs/modules/continuity-doorway.js': '115e170f10a6c8e3a52d87d2037a33a6',
  'docs/modules/lattice-export.js': '1da1ed29674b89a2fda7f6098deea2d0',
  'docs/modules/chat-autonomy.js': 'c83cf6c9f11271aeaa35ed6070f188f3',
  'docs/modules/pool-honest-label.js': 'ca08886e185ffb8721525bb627302d74',
  'docs/modules/clay-corner.js': 'f8136ec9ef6ed2ffb0f1d36d51f6190c',
  'docs/modules/chat-scroll-release.js': '84fed10c603c9e89e9452ada564c8c65',
  'docs/modules/particle-clay.js': '2da32883c514e4ad2a3cd8571e7a7b15'
};

Object.keys(locks).forEach(function (rel) {
  var got = md5(path.join(root, rel));
  if (got !== locks[rel]) fail(rel + ' md5 ' + got);
});

var appHtml = fs.readFileSync(path.join(root, 'docs/app.html'));
var indexHtml = fs.readFileSync(path.join(root, 'index.html'));
if (!appHtml.equals(indexHtml)) fail('index mismatch');

var added = [
  'docs/modules/chat-bottom-clarity.js',
  'docs/modules/chat-doc-return.js',
  'docs/css/chat-bottom-clarity.css',
  'docs/library/CHAT_BOTTOM_CLARITY_v0.1.md'
];
['\u2014', '&mdash;', 'innerHTML', 'confirm(', 'eval(', 'new Function'].forEach(function (bad) {
  added.forEach(function (rel) {
    var text = fs.readFileSync(path.join(root, rel), 'utf8');
    if (text.indexOf(bad) !== -1) fail(rel + ' has ' + bad);
  });
});

var clarity = fs.readFileSync(path.join(root, 'docs/modules/chat-bottom-clarity.js'), 'utf8');
var docReturn = fs.readFileSync(path.join(root, 'docs/modules/chat-doc-return.js'), 'utf8');
var sheet = fs.readFileSync(path.join(root, 'docs/css/chat-bottom-clarity.css'), 'utf8');
if (sheet.indexOf('max-height: calc(100dvh - 24px)') === -1) fail('menu max height');
if (sheet.indexOf('rgba(200, 210, 230, 0.04)') === -1) fail('glass');
if (sheet.indexOf('rgba(200, 210, 230, 0.08)') === -1) fail('silver border');
if (/#[0-9a-fA-F]{3,8}/.test(sheet)) fail('new hex in clarity css');
if (clarity.indexOf('v-chat-bottom-clarity-v0.1') === -1) fail('clarity marker');
if (docReturn.indexOf('v-chat-doc-return-v0.1') === -1) fail('doc marker');
if (docReturn.indexOf('[FL_FILE:') === -1) fail('file trigger');
if (appHtml.toString('utf8').indexOf('modules/chat-bottom-clarity.js') === -1) fail('app hook missing');
if (appHtml.toString('utf8').indexOf('modules/chat-doc-return.js') === -1) fail('doc hook missing');

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
        var type = ext === '.js' ? 'text/javascript' : (ext === '.css' ? 'text/css' : (ext === '.png' ? 'image/png' : 'text/html'));
        res.setHeader('content-type', type + '; charset=utf-8');
        res.end(buf);
      });
    });
    server.listen(listenPort, '127.0.0.1', function () { resolve(server); });
  });
}

function near(n, want) {
  return Math.abs(n - want) <= 2;
}

(async function () {
  var server = await serve(path.join(root, 'docs'), port);
  var base = 'http://127.0.0.1:' + port;
  var pwPath = process.env.FL_PLAYWRIGHT || '/tmp/gc-pw-local/node_modules/playwright-core';
  var pw = require(pwPath);
  var chromePath = process.env.FL_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  var browser = await pw.chromium.launch({ executablePath: chromePath, headless: true });
  var version = browser.version();

  async function openApp(width, height, scale, touch) {
    var context = await browser.newContext({
      viewport: { width: width, height: height },
      deviceScaleFactor: scale || 1,
      hasTouch: !!touch,
      acceptDownloads: true
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
        localStorage.setItem('fl_clay_offer', '');
        localStorage.removeItem('fl_clay_offer');
      } catch (e) {}
    });
    await page.goto(base + '/app.html', { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForFunction(function () {
      return window.FLChatBottom && window.FLChatDocReturn && document.getElementById('flChatAddBtn') && document.getElementById('sendBtn') && document.getElementById('flChatSearchToggle');
    }, null, { timeout: 30000 });
    await page.evaluate(function () { if (typeof window.switchTab === 'function') window.switchTab('chat'); });
    await page.waitForTimeout(400);
    return { page: page, context: context, errors: errors };
  }

  var desk = await openApp(1280, 800, 1, false);
  var page = desk.page;

  var bare = await page.evaluate(function () {
    var ids = ['chatAttachBtn', 'chatScanFolderBtn', 'chatDriveBtn', 'micBtn', 'imgGenBtn', 'chatOverflowBtn', 'flBoxPointerInput', 'flChatSearchToggle'];
    var missing = [];
    var i;
    for (i = 0; i < ids.length; i++) if (!document.getElementById(ids[i])) missing.push(ids[i]);
    var homes = ['#tab-chat .chat-input-row', '#flChatPillRow', '#fl-clay-dock', '#flChatCalmLine', '#chatInputSecondary', '#flChatAddMenu'];
    var nodes = [];
    var h;
    for (h = 0; h < homes.length; h++) {
      var home = document.querySelector(homes[h]);
      if (!home) continue;
      nodes.push(home);
      var inner = home.querySelectorAll('button, a, input, textarea');
      var n;
      for (n = 0; n < inner.length; n++) nodes.push(inner[n]);
    }
    var corners = ['flRadioFab', 'quickHelpBtn', 'musicToggle'];
    var bad = [];
    function look(el) {
      if (!el || !el.getClientRects || !el.getClientRects().length) return;
      var r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return;
      var cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none') return;
      var word = (el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent || '').replace(/\s+/g, ' ').trim();
      if (!word) bad.push((el.id || el.className || el.tagName) + ' bare');
      if (el.tagName === 'BUTTON' && r.height < 44) bad.push((el.id || el.className || 'button') + ' h ' + Math.round(r.height));
      if (el.tagName === 'BUTTON') {
        var op = parseFloat(cs.opacity || '1');
        if (op < 0.75) bad.push((el.id || el.className || 'button') + ' opacity ' + op);
      }
    }
    for (i = 0; i < nodes.length; i++) look(nodes[i]);
    for (i = 0; i < corners.length; i++) look(document.getElementById(corners[i]));
    var status = document.getElementById('statusText');
    var search = document.getElementById('flChatSearchToggle');
    var quiet = document.querySelector('[data-quiet="true"]');
    return {
      missing: missing,
      bad: bad.slice(0, 12),
      status: status ? status.textContent : '',
      statusH: status ? status.getBoundingClientRect().height : 0,
      search: search ? search.textContent : '',
      searchH: search ? search.getBoundingClientRect().height : 0,
      quiet: !!quiet,
      marker: document.getElementById('flChatAddBtn').getAttribute('data-marker'),
      pill: document.getElementById('flChatPillRow') ? document.getElementById('flChatPillRow').getAttribute('data-marker') : '',
      order: (function () {
        var row = document.getElementById('flChatPillRow');
        if (!row) return '';
        return Array.prototype.map.call(row.children, function (el) { return el.id; }).join(',');
      })()
    };
  });
  if (bare.missing.length) fail('missing ids ' + bare.missing.join(','));
  if (bare.bad.length) fail('bare or short ' + bare.bad.join(' | '));
  if (!bare.status || bare.statusH < 1) fail('status strip ' + JSON.stringify(bare));
  if (bare.search.indexOf('Search') !== 0 || bare.searchH < 44) fail('search ' + JSON.stringify(bare));
  if (bare.quiet) fail('quiet room open');
  if (bare.marker !== 'v-chat-bottom-clarity-v0.1' || bare.pill !== 'v-chat-bottom-clarity-v0.1') fail('markers');
  if (bare.order !== 'fl-connect-play-toggle,chatPresenceToggle,chatMarketToggle,fl-clay-pill') fail('pill order ' + bare.order);

  await page.evaluate(function () {
    window.__calls = [];
    window.flOpenDrivePicker = function () { window.__calls.push('drive'); };
    window.flAttachFile = function () { window.__calls.push('attach'); };
    window.flScanFolder = function () { window.__calls.push('scan'); };
    window.toggleVoiceInput = function () { window.__calls.push('speak'); };
    window.handleImageGenClick = function () { window.__calls.push('picture'); };
  });

  var add = page.locator('#flChatAddBtn');
  await add.click();
  await page.waitForFunction(function () {
    var menu = document.getElementById('flChatAddMenu');
    return menu && menu.getAttribute('data-open') === '1';
  }, null, { timeout: 5000 });
  var menuState = await page.evaluate(function () {
    var menu = document.getElementById('flChatAddMenu');
    var items = menu.querySelectorAll('.fl-add-item:not([hidden])');
    var words = [];
    var i;
    for (i = 0; i < items.length; i++) words.push((items[i].textContent || '').replace(/\s+/g, ' ').trim());
    var drive = document.getElementById('chatDriveBtn');
    return {
      first: words[0] || '',
      words: words,
      driveFirst: items[0] === drive,
      expanded: document.getElementById('flChatAddBtn').getAttribute('aria-expanded'),
      camera: !!document.getElementById('flChatAddCamera'),
      research: words.join(' ').toLowerCase().indexOf('deep research') !== -1,
      marker: menu.getAttribute('data-marker')
    };
  });
  if (menuState.first.indexOf('Bring from Google Drive') !== 0) fail('drive not first ' + menuState.first);
  if (!menuState.driveFirst) fail('drive button is not the first item');
  if (menuState.expanded !== 'true') fail('aria-expanded');
  if (menuState.camera) fail('camera shown without touch');
  if (menuState.research) fail('deep research invented');
  if (menuState.marker !== 'v-chat-bottom-clarity-v0.1') fail('menu marker');
  if (menuState.words.join(' ').indexOf('Give the mind a document from your Drive') === -1) fail('drive subline');

  await page.locator('#chatDriveBtn').click();
  await page.locator('#flChatAddBtn').click();
  await page.locator('#chatAttachBtn').click();
  await page.locator('#flChatAddBtn').click();
  await page.locator('#chatScanFolderBtn').click();
  await page.locator('#flChatAddBtn').click();
  await page.locator('#flChatAddPicture').click();
  var calls = await page.evaluate(function () { return window.__calls.slice(); });
  if (calls.join(',') !== 'drive,attach,scan,picture') fail('handlers ' + calls.join(','));

  var searchBefore = await page.evaluate(function () {
    return document.getElementById('flChatSearchToggle').textContent;
  });
  await page.locator('#flChatAddBtn').click();
  await page.locator('#flChatAddSearch').click();
  var searchAfter = await page.evaluate(function () {
    var toggle = document.getElementById('flChatSearchToggle');
    var live = document.getElementById('flChatSearchLive');
    return { text: toggle.textContent, pressed: toggle.getAttribute('aria-pressed'), hidden: live.hasAttribute('hidden') };
  });
  if (searchBefore.indexOf('on') === -1) fail('search did not start on');
  if (searchAfter.text.indexOf('off') === -1 || searchAfter.pressed !== 'false' || !searchAfter.hidden) fail('search mirror ' + JSON.stringify(searchAfter));
  await page.evaluate(function () { document.getElementById('flChatSearchToggle').click(); });

  await page.locator('#flChatAddBtn').click();
  await page.keyboard.press('Escape');
  var focusBack = await page.evaluate(function () {
    var menu = document.getElementById('flChatAddMenu');
    return {
      open: menu.getAttribute('data-open'),
      focus: document.activeElement && document.activeElement.id
    };
  });
  if (focusBack.open !== '0') fail('escape left menu open');
  if (focusBack.focus !== 'flChatAddBtn') fail('focus ' + focusBack.focus);

  var speak = await page.evaluate(function () {
    var mic = document.getElementById('micBtn');
    var item = document.getElementById('flChatAddSpeak');
    var micHidden = mic.style.display === 'none';
    var itemHidden = item.hasAttribute('hidden');
    if (micHidden !== itemHidden) return { ok: false, why: 'out of step' };
    mic.style.display = '';
    window.FLChatBottom.arrange();
    window.__calls = [];
    return { ok: true, hiddenAfter: item.hasAttribute('hidden') };
  });
  if (!speak.ok) fail('speak rule');
  if (speak.hiddenAfter) fail('speak stayed hidden after mic shown');
  await page.locator('#flChatAddBtn').click();
  await page.locator('#flChatAddSpeak').click();
  var spoke = await page.evaluate(function () { return window.__calls.indexOf('speak') !== -1; });
  if (!spoke) fail('speak handler');

  var clay = await page.evaluate(function () {
    var yes = document.querySelector('#fl-clay-dock .fl-bottom-yes');
    var later = null;
    var buttons = document.querySelectorAll('#fl-clay-dock button');
    var i;
    for (i = 0; i < buttons.length; i++) {
      if ((buttons[i].textContent || '').trim() === 'Not now') later = buttons[i];
    }
    if (!yes || !later) return { missing: true };
    var yb = getComputedStyle(yes).backgroundColor;
    var lb = getComputedStyle(later).backgroundColor;
    return { yb: yb, lb: lb };
  });
  if (clay.missing) fail('clay buttons missing');
  if (clay.yb.indexOf('232') === -1 && clay.yb.indexOf('176') === -1) fail('yes still grey ' + clay.yb);
  if (clay.lb === 'rgb(239, 239, 239)' || clay.lb === 'rgba(239, 239, 239, 1)') fail('not now grey ' + clay.lb);
  await page.evaluate(function () {
    document.querySelector('#fl-clay-dock .fl-bottom-yes').click();
  });
  var clayOn = await page.evaluate(function () { return localStorage.getItem('fl_clay'); });
  if (clayOn !== 'on') fail('yes handler ' + clayOn);

  var fileText = 'Hello from the mind.\nLine two.';
  var cardInfo = await page.evaluate(function (body) {
    var span = document.createElement('span');
    var bubble = document.createElement('div');
    bubble.className = 'chat-message assistant';
    bubble.appendChild(span);
    document.getElementById('chatMessages').appendChild(bubble);
    var raw = '[FL_FILE: note.md]\n' + body + '\n[/FL_FILE]';
    window.flProcessAssistantSentinels(raw, span);
    var cards = document.querySelectorAll('.fl-doc-card');
    var card = cards[cards.length - 1];
    var plain = document.createElement('div');
    plain.className = 'chat-message assistant';
    var plainSpan = document.createElement('span');
    plain.appendChild(plainSpan);
    document.getElementById('chatMessages').appendChild(plain);
    window.flProcessAssistantSentinels('No document here.', plainSpan);
    return {
      count: document.querySelectorAll('.fl-doc-card').length,
      marker: card ? card.getAttribute('data-marker') : '',
      name: card ? card.querySelector('.fl-doc-name').textContent : '',
      meta: card ? card.querySelector('.fl-doc-meta').textContent : '',
      drive: card ? (card.textContent.indexOf('Save to my Drive') !== -1) : true,
      scripts: card ? card.querySelectorAll('script').length : 1,
      heights: card ? Array.prototype.map.call(card.querySelectorAll('button'), function (b) {
        return Math.round(b.getBoundingClientRect().height);
      }) : [],
      edge: card ? getComputedStyle(card).borderTopColor : '',
      icon: card && card.querySelector('svg') ? getComputedStyle(card.querySelector('svg')).color : '',
      glass: card ? getComputedStyle(card).backgroundColor : ''
    };
  }, fileText);
  if (cardInfo.count !== 1) fail('card count ' + cardInfo.count);
  if (cardInfo.marker !== 'v-chat-doc-return-v0.1') fail('card marker');
  if (cardInfo.edge.indexOf('52') === -1 || cardInfo.icon.indexOf('52') === -1) fail('emerald ' + cardInfo.edge + ' ' + cardInfo.icon);
  if (cardInfo.glass.indexOf('16, 18, 36') === -1 && cardInfo.glass.indexOf('16,18,36') === -1) fail('card glass ' + cardInfo.glass);
  if (cardInfo.name !== 'note.md') fail('card name ' + cardInfo.name);
  if (cardInfo.drive) fail('drive offered while signed out');
  if (cardInfo.scripts !== 0) fail('card ran markup');
  cardInfo.heights.forEach(function (h) { if (h < 44) fail('card button ' + h); });

  async function saveText(label) {
    var downloadPromise = page.waitForEvent('download');
    await page.locator('.fl-doc-card button', { hasText: label }).click();
    var download = await downloadPromise;
    var dest = path.join(shotDir, 'save-' + label.replace(/\s+/g, '-') + (label.indexOf('PDF') !== -1 ? '.pdf' : '.txt'));
    await download.saveAs(dest);
    return fs.readFileSync(dest);
  }
  try { fs.mkdirSync(shotDir); } catch (e) {}
  var mdBuf = await saveText('Save as MD');
  var txtBuf = await saveText('Save as TXT');
  var pdfBuf = await saveText('Save as PDF');
  if (mdBuf.toString('utf8') !== fileText) fail('md text ' + mdBuf.toString('utf8'));
  if (txtBuf.toString('utf8') !== fileText) fail('txt text ' + txtBuf.toString('utf8'));
  if (pdfBuf.toString('utf8').indexOf('%PDF') !== 0) fail('pdf header');
  if (pdfBuf.toString('utf8').indexOf('Hello from the mind.') === -1) fail('pdf words');

  var drive = await page.evaluate(function () {
    window.__fetches = [];
    window.fetch = function (url) {
      window.__fetches.push(String(url));
      return Promise.resolve({ ok: true, json: function () { return Promise.resolve({}); } });
    };
    var before = window.__fetches.length;
    window.gapi = {
      auth2: {
        getAuthInstance: function () {
          return {
            isSignedIn: { get: function () { return true; } },
            currentUser: { get: function () { return { getAuthResponse: function () { return { access_token: 'local-token' }; } }; } }
          };
        }
      }
    };
    var span = document.createElement('span');
    var bubble = document.createElement('div');
    bubble.className = 'chat-message assistant';
    bubble.id = 'flDocDriveBubble';
    bubble.appendChild(span);
    document.getElementById('chatMessages').appendChild(bubble);
    window.FLChatDocReturn.consumeReply('[FL_FILE: drive-note.md]\nDrive body\n[/FL_FILE]', span);
    var cards = document.querySelectorAll('.fl-doc-card');
    var card = cards[cards.length - 1];
    return {
      before: before,
      has: card.textContent.indexOf('Save to my Drive') !== -1,
      fetches: window.__fetches.length,
      id: card.getAttribute('data-fl-file-key')
    };
  });
  if (drive.before !== 0 || drive.fetches !== 0) fail('fetch before yes');
  if (!drive.has) fail('drive button missing when signed in');
  var driveCard = page.locator('.fl-doc-card').last();
  await driveCard.locator('button', { hasText: 'Save to my Drive' }).click();
  var asked = await page.evaluate(function () { return window.__fetches.length; });
  if (asked !== 0) fail('fetch on ask ' + asked);
  await driveCard.locator('button', { hasText: 'Not now' }).click();
  var afterNo = await page.evaluate(function () { return window.__fetches.length; });
  if (afterNo !== 0) fail('fetch on not now');
  await driveCard.locator('button', { hasText: 'Save to my Drive' }).click();
  await driveCard.locator('button.fl-doc-yes').click();
  await page.waitForFunction(function () { return window.__fetches.length === 1; }, null, { timeout: 5000 });
  var sent = await page.evaluate(function () {
    return { n: window.__fetches.length, url: window.__fetches[0] || '' };
  });
  if (sent.n !== 1 || sent.url.indexOf('upload') === -1) fail('yes send ' + JSON.stringify(sent));

  async function measure(width, height, scale) {
    var opened = await openApp(width, height, scale, false);
    var box = await opened.page.evaluate(function () {
      var send = document.getElementById('sendBtn');
      var input = document.getElementById('chatInput');
      var nav = document.querySelector('.fl-mobile-nav');
      var sr = send.getBoundingClientRect();
      var ir = input.getBoundingClientRect();
      var navTop = window.innerHeight;
      if (nav && getComputedStyle(nav).display !== 'none') navTop = nav.getBoundingClientRect().top;
      var search = document.getElementById('flChatSearchToggle');
      var status = document.getElementById('statusText');
      return {
        send: { w: Math.round(sr.width), h: Math.round(sr.height), x: Math.round(sr.x), y: Math.round(sr.y) },
        inputTop: Math.round(ir.top),
        inputBottom: Math.round(ir.bottom),
        sendTop: Math.round(sr.top),
        sendBottom: Math.round(sr.bottom),
        navTop: Math.round(navTop),
        vh: window.innerHeight,
        side: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        search: search ? search.textContent : '',
        statusH: status ? status.getBoundingClientRect().height : 0
      };
    });
    var own = opened.errors.filter(function (err) {
      return err.indexOf('chat-bottom') !== -1 || err.indexOf('chat-doc') !== -1 || err.indexOf('FLChat') !== -1;
    });
    if (own.length) fail(width + ' error ' + own[0]);
    await opened.context.close();
    return box;
  }

  await page.evaluate(function () {
    var send = document.getElementById('sendBtn');
    if (send && send.scrollIntoView) send.scrollIntoView({ block: 'center', inline: 'nearest' });
  });
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(shotDir, 'after-1280.png') });
  var wide = await page.evaluate(function () {
    var send = document.getElementById('sendBtn');
    var sr = send.getBoundingClientRect();
    return {
      send: { w: Math.round(sr.width), h: Math.round(sr.height), x: Math.round(sr.x), y: Math.round(sr.y) },
      side: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
    };
  });
  if (desk.errors.filter(function (err) { return err.indexOf('FLChat') !== -1 || err.indexOf('chat-bottom') !== -1 || err.indexOf('chat-doc') !== -1; }).length) {
    fail('desk error ' + desk.errors[0]);
  }
  await desk.context.close();

  var phone = await measure(390, 800, 1);
  var phoneShot = await openApp(390, 800, 1, false);
  await phoneShot.page.screenshot({ path: path.join(shotDir, 'after-390.png') });
  await phoneShot.context.close();
  var dense = await measure(640, 400, 2);

  if (!near(wide.send.w, 102) || !near(wide.send.h, 52)) fail('send 1280 ' + JSON.stringify(wide.send));
  if (!near(phone.send.w, 95) || !near(phone.send.h, 50)) fail('send 390 ' + JSON.stringify(phone.send));
  if (!near(dense.send.w, 102) || !near(dense.send.h, 52)) fail('send dense ' + JSON.stringify(dense.send));
  if (wide.side) fail('sideways 1280');
  if (phone.side) fail('sideways 390');
  if (dense.side) fail('sideways dense');
  if (phone.inputTop < 0 || phone.inputBottom > phone.vh || phone.sendTop < 0 || phone.sendBottom > phone.vh) fail('composer offscreen ' + JSON.stringify(phone));
  if (phone.sendBottom > phone.navTop + 1 || phone.inputBottom > phone.navTop + 1) fail('composer under tab bar ' + JSON.stringify(phone));
  if (phone.search.indexOf('Search') !== 0) fail('phone search');
  if (phone.statusH < 1) fail('phone status');

  var touch = await openApp(390, 800, 1, true);
  var cam = await touch.page.evaluate(function () {
    var input = document.createElement('input');
    return {
      ok: window.FLChatBottom.cameraOk(),
      item: !!document.getElementById('flChatAddCamera'),
      capture: 'capture' in input,
      touch: (navigator.maxTouchPoints > 0) || ('ontouchstart' in window)
    };
  });
  if (cam.ok !== cam.item) fail('camera mismatch ' + JSON.stringify(cam));
  if (!cam.capture && cam.item) fail('camera without capture ' + JSON.stringify(cam));
  if (cam.touch && cam.capture && !cam.item) fail('camera missing on touch ' + JSON.stringify(cam));
  await touch.context.close();

  async function proveDrive(width, height, scale) {
    var opened = await openApp(width, height, scale, false);
    var seen = opened.page;
    await seen.evaluate(function () {
      window.__driveOpens = 0;
      window.flOpenDrivePicker = function () { window.__driveOpens += 1; };
      var send = document.getElementById('sendBtn');
      if (send && send.scrollIntoView) send.scrollIntoView({ block: 'center', inline: 'nearest' });
    });
    await seen.waitForTimeout(450);
    await seen.evaluate(function () {
      var send = document.getElementById('sendBtn');
      if (send && send.scrollIntoView) send.scrollIntoView({ block: 'center', inline: 'nearest' });
    });
    await seen.waitForTimeout(450);
    await seen.locator('#flChatAddBtn').click();
    await seen.waitForFunction(function () {
      var menu = document.getElementById('flChatAddMenu');
      return menu && menu.getAttribute('data-open') === '1';
    }, null, { timeout: 5000 });
    var box = await seen.evaluate(function () {
      var menu = document.getElementById('flChatAddMenu');
      var drive = document.getElementById('chatDriveBtn');
      var mr = menu.getBoundingClientRect();
      var dr = drive.getBoundingClientRect();
      var cx = Math.round(dr.left + dr.width / 2);
      var cy = Math.round(dr.top + dr.height / 2);
      var hit = document.elementFromPoint(cx, cy);
      return {
        top: Math.round(mr.top),
        bottom: Math.round(mr.bottom),
        height: Math.round(mr.height),
        vh: window.innerHeight,
        driveTop: Math.round(dr.top),
        hit: hit ? (hit.id || hit.tagName) : 'none',
        hitDrive: !!(hit && (hit === drive || drive.contains(hit))),
        z: getComputedStyle(menu).zIndex
      };
    });
    if (box.top < 0 || box.bottom > box.vh) fail(width + ' menu outside ' + JSON.stringify(box));
    if (box.height > box.vh - 24 + 2) fail(width + ' menu tall ' + JSON.stringify(box));
    if (!box.hitDrive) fail(width + ' drive covered ' + JSON.stringify(box));
    if (!(Number(box.z) > 2)) fail(width + ' menu z ' + box.z);
    await seen.locator('#chatDriveBtn').click();
    var n = await seen.evaluate(function () { return window.__driveOpens; });
    if (n !== 1) fail(width + ' drive clicks ' + n + ' ' + JSON.stringify(box));
    await opened.context.close();
    return n;
  }

  var drive1280 = await proveDrive(1280, 800, 1);
  var drive390 = await proveDrive(390, 800, 1);
  var driveDense = await proveDrive(640, 400, 2);

  await browser.close();
  server.close();
  console.log(JSON.stringify({
    chrome: version,
    send1280: wide.send,
    send390: phone.send,
    sendDense: dense.send,
    driveClicks: { w1280: drive1280, w390: drive390, w640: driveDense },
    clarity: md5(path.join(root, 'docs/modules/chat-bottom-clarity.js')),
    docReturn: md5(path.join(root, 'docs/modules/chat-doc-return.js'))
  }));
  console.log('SMOKE_OK chat bottom clarity v0.1');
  console.log('SMOKE_OK chat doc return v0.1');
})().catch(function (err) {
  console.error('FAIL ' + (err && err.stack ? err.stack : err));
  process.exit(1);
});
