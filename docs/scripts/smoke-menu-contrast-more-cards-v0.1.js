#!/usr/bin/env node
// Smoke: menu contrast v0.1 and more cards groups v0.1. Local only.
'use strict';
var fs = require('fs');
var path = require('path');
var http = require('http');
var crypto = require('crypto');

var root = path.join(__dirname, '..', '..');
var port = Number(process.env.FL_PORT || 8984);
var shotDir = path.join(root, 'docs/library/menu-contrast-055d');

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
  'docs/modules/chat-doc-return.js': '6e5f09f58585332a9e497be85bda0957',
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

var groupsJs = fs.readFileSync(path.join(root, 'docs/modules/more-cards-groups.js'), 'utf8');
var clarity = fs.readFileSync(path.join(root, 'docs/modules/chat-bottom-clarity.js'), 'utf8');
var sheet = fs.readFileSync(path.join(root, 'docs/css/chat-bottom-clarity.css'), 'utf8');
['\u2014', '&mdash;', 'innerHTML', 'confirm(', 'eval(', 'new Function'].forEach(function (bad) {
  if (groupsJs.indexOf(bad) !== -1) fail('groups js has ' + bad);
});
if (groupsJs.indexOf('v-more-cards-groups-v0.1') === -1) fail('groups marker');
if (clarity.indexOf('v-menu-contrast-v0.1') === -1) fail('contrast marker');
if (clarity.indexOf('moreOpensMenu: false') === -1) fail('more flag');
if (sheet.indexOf('v-menu-contrast-v0.1') === -1) fail('contrast css');
if (sheet.indexOf('v-more-cards-groups-v0.1') === -1) fail('groups css');
if (sheet.indexOf('rgba(16, 18, 36, 0.88)') === -1) fail('dark glass');
if (sheet.indexOf('rgba(16, 18, 36, 0.95)') === -1) fail('glass fallback');
if (sheet.indexOf('scale(1.06)') === -1) fail('breath');
if (/#[0-9a-fA-F]{3,8}/.test(sheet)) fail('hex in sheet');
if (appHtml.toString('utf8').indexOf('modules/more-cards-groups.js') === -1) fail('hook');

var ORDER = ['Start here', 'Trust and you', 'Family and town', 'Garden and Market', 'Create and play', 'Learn why'];
var EXPECT = {
  'Start here': ['Connect', 'Get Connected', 'Settings', 'Telegram Bridge', 'Share FreeLattice'],
  'Trust and you': ['Your Audit', 'Trust Level', 'Trainer', 'Memory Garden'],
  'Family and town': ['Community', 'Activity', 'AI City', 'Jade Hall', 'Pantheon', 'Sophia'],
  'Garden and Market': ['Wallet', 'AI Bank', 'Mesh Compute'],
  'Create and play': ['Agent', 'Flow', 'Ratio Room', 'Play Room'],
  'Learn why': ['Library', 'Why This Way', 'Aurora Engine']
};

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
  try { fs.mkdirSync(shotDir, { recursive: true }); } catch (eDir) {}

  async function openApp(width, height, scale) {
    var context = await browser.newContext({
      viewport: { width: width, height: height },
      deviceScaleFactor: scale || 1,
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
      } catch (e) {}
    });
    await page.goto(base + '/app.html', { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForFunction(function () {
      return window.FLChatBottom && window.FLMoreCards && document.getElementById('flChatAddBtn') && document.querySelectorAll('#more-hub-grid [data-fl-more-group]').length >= 6;
    }, null, { timeout: 30000 });
    await page.evaluate(function () { if (typeof window.switchTab === 'function') window.switchTab('chat'); });
    await page.waitForTimeout(300);
    return { page: page, context: context, errors: errors };
  }

  async function seat(page) {
    await page.evaluate(function () {
      var send = document.getElementById('sendBtn');
      if (send && send.scrollIntoView) send.scrollIntoView({ block: 'center', inline: 'nearest' });
    });
    await page.waitForTimeout(450);
    await page.evaluate(function () {
      var send = document.getElementById('sendBtn');
      if (send && send.scrollIntoView) send.scrollIntoView({ block: 'center', inline: 'nearest' });
    });
    await page.waitForTimeout(450);
  }

  function contrastScript() {
    function lin(c) {
      c = c / 255;
      return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    }
    function lum(r, g, b) {
      return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    }
    function ratio(fg, bg) {
      var L1 = lum(fg[0], fg[1], fg[2]);
      var L2 = lum(bg[0], bg[1], bg[2]);
      var hi = Math.max(L1, L2);
      var lo = Math.min(L1, L2);
      return (hi + 0.05) / (lo + 0.05);
    }
    function parse(cs) {
      var m = String(cs || '').match(/rgba?\(([0-9.]+)[,\s]+([0-9.]+)[,\s]+([0-9.]+)(?:[,\s/]+([0-9.]+))?\)/);
      if (!m) return null;
      return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]), a: m[4] == null ? 1 : Number(m[4]) };
    }
    function overWhite(bg) {
      var a = bg.a == null ? 1 : bg.a;
      return [bg.r * a + 255 * (1 - a), bg.g * a + 255 * (1 - a), bg.b * a + 255 * (1 - a)];
    }
    function dark(cs) {
      var p = parse(cs);
      if (!p) return false;
      var rgb = Math.round(p.r) === 16 && Math.round(p.g) === 18 && Math.round(p.b) === 36;
      var alpha = Math.abs(p.a - 0.88) < 0.03 || Math.abs(p.a - 0.95) < 0.03;
      return rgb && alpha;
    }
    function sample(el, name, kind) {
      if (!el) return null;
      var cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') return null;
      var rect = el.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return null;
      var fg = parse(cs.color);
      var bg = parse(cs.backgroundColor);
      var host = bg && bg.a > 0.2 ? bg : null;
      if (!host) {
        var node = el.parentElement;
        while (node) {
          var pb = parse(getComputedStyle(node).backgroundColor);
          if (pb && pb.a > 0.2) { host = pb; break; }
          node = node.parentElement;
        }
      }
      if (!fg || !host) return { name: name, missing: true };
      var value = ratio([fg.r, fg.g, fg.b], overWhite(host));
      return {
        name: name,
        kind: kind,
        ratio: Math.round(value * 100) / 100,
        color: cs.color,
        bg: 'rgba(' + Math.round(host.r) + ', ' + Math.round(host.g) + ', ' + Math.round(host.b) + ', ' + host.a + ')',
        opacity: cs.opacity
      };
    }
    var menu = document.getElementById('flChatAddMenu');
    var row = document.getElementById('flChatPillRow');
    var card = document.querySelector('.fl-doc-card');
    var backs = {
      menu: menu ? getComputedStyle(menu).backgroundColor : '',
      pills: row ? getComputedStyle(row).backgroundColor : '',
      card: card ? getComputedStyle(card).backgroundColor : ''
    };
    var samples = [];
    if (menu) {
      var items = menu.querySelectorAll('.fl-add-item');
      var i;
      for (i = 0; i < items.length; i++) {
        if (items[i].hidden || getComputedStyle(items[i]).display === 'none') continue;
        var copy = items[i].querySelector('.fl-add-copy');
        var sub = items[i].querySelector('.fl-add-sub');
        var icon = items[i].querySelector('svg');
        var word = sample(copy, 'menu word ' + i, 'word');
        var line = sample(sub, 'menu sub ' + i, 'word');
        var glyph = sample(icon, 'menu icon ' + i, 'icon');
        if (word) samples.push(word);
        if (line) samples.push(line);
        if (glyph) samples.push(glyph);
      }
    }
    if (row) {
      var pills = row.querySelectorAll('button');
      for (i = 0; i < pills.length; i++) {
        var pill = sample(pills[i], 'pill ' + (pills[i].id || i), 'word');
        if (pill) samples.push(pill);
      }
    }
    if (card) {
      var nameEl = card.querySelector('.fl-doc-name');
      var metaEl = card.querySelector('.fl-doc-meta');
      var svg = card.querySelector('svg');
      var cn = sample(nameEl, 'file name', 'word');
      var cm = sample(metaEl, 'file meta', 'word');
      var ci = sample(svg, 'file icon', 'icon');
      if (cn) samples.push(cn);
      if (cm) samples.push(cm);
      if (ci) samples.push(ci);
    }
    var moreCards = document.querySelectorAll('#more-hub-grid [data-fl-more-card]');
    for (i = 0; i < moreCards.length; i++) {
      var label = moreCards[i].querySelector('.fl-more-label');
      var desc = moreCards[i].querySelector('.fl-more-desc');
      var emo = moreCards[i].querySelector('.fl-more-icon');
      var lw = sample(label, 'card ' + (label ? label.textContent : i), 'word');
      var dw = sample(desc, 'desc ' + (label ? label.textContent : i), 'word');
      var ew = sample(emo, 'emoji ' + (label ? label.textContent : i), 'icon');
      if (lw) samples.push(lw);
      if (dw) samples.push(dw);
      if (ew) samples.push(ew);
    }
    var lowest = null;
    var lowIcon = null;
    for (i = 0; i < samples.length; i++) {
      if (samples[i].missing) continue;
      if (samples[i].kind === 'icon') {
        if (!lowIcon || samples[i].ratio < lowIcon.ratio) lowIcon = samples[i];
      } else if (!lowest || samples[i].ratio < lowest.ratio) lowest = samples[i];
    }
    return { backs: backs, darkMenu: dark(backs.menu), darkPills: dark(backs.pills), darkCard: dark(backs.card), lowest: lowest, lowIcon: lowIcon, count: samples.length };
  }

  async function proveDrive(width, height, scale) {
    var opened = await openApp(width, height, scale);
    var seen = opened.page;
    await seen.evaluate(function () {
      window.__driveOpens = 0;
      window.flOpenDrivePicker = function () { window.__driveOpens += 1; };
    });
    await seat(seen);
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
        hitDrive: !!(hit && drive && (hit === drive || drive.contains(hit)))
      };
    });
    if (box.top < 0 || box.bottom > box.vh) fail(width + ' menu outside ' + JSON.stringify(box));
    if (box.height > box.vh - 24 + 2) fail(width + ' menu tall ' + JSON.stringify(box));
    if (!box.hitDrive) fail(width + ' drive covered ' + JSON.stringify(box));
    await seen.locator('#chatDriveBtn').click();
    var n = await seen.evaluate(function () { return window.__driveOpens; });
    if (n !== 1) fail(width + 'x' + height + ' drive clicks ' + n);
    await opened.context.close();
    return n;
  }

  var wide = await openApp(1280, 800, 1);
  await seat(wide.page);
  await wide.page.locator('#flChatAddBtn').click();
  await wide.page.waitForFunction(function () {
    var menu = document.getElementById('flChatAddMenu');
    return menu && menu.getAttribute('data-open') === '1';
  });
  await wide.page.evaluate(function (body) {
    var span = document.createElement('span');
    var bubble = document.createElement('div');
    bubble.className = 'chat-message assistant';
    bubble.appendChild(span);
    document.getElementById('chatMessages').appendChild(bubble);
    window.flProcessAssistantSentinels('[FL_FILE: note.md]\n' + body + '\n[/FL_FILE]', span);
  }, 'Hello from the mind.');
  var contrast = await wide.page.evaluate(contrastScript);
  if (!contrast.darkMenu) fail('menu glass ' + contrast.backs.menu);
  if (!contrast.darkPills) fail('pill glass ' + contrast.backs.pills);
  if (!contrast.darkCard) fail('card glass ' + contrast.backs.card);
  if (!contrast.lowest || contrast.lowest.ratio < 4.5) fail('word contrast ' + JSON.stringify(contrast.lowest));
  if (!contrast.lowIcon || contrast.lowIcon.ratio < 3) fail('icon contrast ' + JSON.stringify(contrast.lowIcon));
  await wide.page.screenshot({ path: path.join(shotDir, 'after-menu-1280.png') });
  await wide.page.evaluate(function () { window.FLChatBottom.close(); });
  await wide.page.locator('#chatOverflowBtn').click();
  await wide.page.waitForFunction(function () {
    var tab = document.getElementById('tab-more');
    var menu = document.getElementById('flChatAddMenu');
    return tab && tab.classList.contains('active') && (!menu || menu.getAttribute('data-open') !== '1');
  }, null, { timeout: 5000 });
  var contrastMore = await wide.page.evaluate(contrastScript);
  if (!contrastMore.lowest || contrastMore.lowest.ratio < 4.5) fail('more word contrast ' + JSON.stringify(contrastMore.lowest));
  if (!contrastMore.lowIcon || contrastMore.lowIcon.ratio < 3) fail('more icon contrast ' + JSON.stringify(contrastMore.lowIcon));
  var room = await wide.page.evaluate(function (order) {
    var titles = Array.prototype.map.call(document.querySelectorAll('#more-hub-grid [data-fl-more-group]'), function (el) {
      return el.getAttribute('data-fl-more-group');
    });
    var cards = document.querySelectorAll('#more-hub-grid [data-fl-more-card]');
    var seen = {};
    var bad = [];
    var i;
    for (i = 0; i < cards.length; i++) {
      var group = cards[i].closest('[data-fl-more-group]');
      var labelEl = cards[i].querySelector('.fl-more-label');
      var word = labelEl ? labelEl.textContent.replace(/\s+/g, ' ').trim() : '';
      var aria = cards[i].getAttribute('aria-label') || '';
      if (!group) bad.push(word + ' no group');
      if (!word) bad.push('blank word');
      if (aria.indexOf(word + ': ') !== 0) bad.push(word + ' aria ' + aria.slice(0, 40));
      if (seen[word]) bad.push(word + ' twice');
      seen[word] = (group && group.getAttribute('data-fl-more-group')) || '';
      var rect = cards[i].getBoundingClientRect();
      if (rect.height < 44 || rect.width < 44) bad.push(word + ' size ' + Math.round(rect.width) + 'x' + Math.round(rect.height));
    }
    var groups = {};
    var title;
    for (i = 0; i < titles.length; i++) {
      title = titles[i];
      groups[title] = Array.prototype.map.call(document.querySelectorAll('#more-hub-grid [data-fl-more-group="' + title + '"] [data-fl-more-card] .fl-more-label'), function (el) {
        return el.textContent.replace(/\s+/g, ' ').trim();
      });
    }
    var porch = document.getElementById('fl-more-connect-porch');
    var hub = document.getElementById('more-hub-grid');
    var popup = document.getElementById('chatOverflowPopup');
    var menu = document.getElementById('flChatAddMenu');
    var small = [];
    var press = document.querySelectorAll('#tab-more button, #tab-more [role="button"], #chatOverflowBtn, #flChatAddBtn');
    for (i = 0; i < press.length; i++) {
      var el = press[i];
      var cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      var r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      var help = (el.textContent || '').replace(/\s+/g, ' ').trim() === '?';
      if (help) continue;
      if (r.height < 44 || r.width < 44) small.push((el.id || el.getAttribute('aria-label') || 'press') + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
    }
    return {
      titles: titles,
      count: cards.length,
      defined: window.MORE_CARDS ? window.MORE_CARDS.length : 0,
      bad: bad.slice(0, 8),
      groups: groups,
      porch: porch ? porch.textContent.indexOf('Begin here') === 0 : false,
      porchFirst: !!(porch && hub && porch.compareDocumentPosition(hub) & 4),
      popupOpen: !!(popup && popup.classList.contains('open')),
      menuOpen: !!(menu && menu.getAttribute('data-open') === '1'),
      side: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      small: small.slice(0, 8),
      flag: window.FLChatBottom ? window.FLChatBottom.moreOpensMenu : null,
      moreLabel: (document.getElementById('chatOverflowBtn') || {}).getAttribute ? document.getElementById('chatOverflowBtn').getAttribute('aria-label') : ''
    };
  }, ORDER);
  if (room.titles.join('|') !== ORDER.join('|')) fail('group order ' + room.titles.join('|'));
  if (room.count !== 25 || room.defined !== 25) fail('card count ' + room.count + ' defined ' + room.defined);
  if (room.bad.length) fail('cards ' + room.bad.join('; '));
  if (!room.porch || !room.porchFirst) fail('porch moved');
  if (room.popupOpen) fail('overflow popup stayed open');
  if (room.menuOpen) fail('more opened the add menu');
  if (room.side) fail('sideways 1280 more');
  if (room.small.length) fail('pressable ' + room.small.join('; '));
  if (room.flag !== false) fail('flag ' + room.flag);
  if (room.moreLabel !== 'More: every room in the Garden') fail('more label ' + room.moreLabel);
  ORDER.forEach(function (title) {
    var got = (room.groups[title] || []).join('|');
    var want = EXPECT[title].join('|');
    if (got !== want) fail(title + ' cards ' + got);
  });
  var fired = await wide.page.evaluate(function () {
    var log = [];
    var realTab = window.switchTab;
    window.switchTab = function (id) {
      log.push('tab:' + id);
      return realTab.apply(window, arguments);
    };
    var realOpen = window.open;
    window.open = function (url) {
      log.push('open:' + url);
      return null;
    };
    function press(name) {
      var cards = document.querySelectorAll('[data-fl-more-card]');
      var i;
      for (i = 0; i < cards.length; i++) {
        var label = cards[i].querySelector('.fl-more-label');
        if (label && label.textContent.replace(/\s+/g, ' ').trim() === name) {
          cards[i].click();
          return;
        }
      }
      log.push('missing:' + name);
    }
    press('Connect');
    press('Settings');
    press('Your Audit');
    return log;
  });
  if (fired.indexOf('tab:connect') === -1) fail('connect handler ' + fired.join(','));
  if (fired.indexOf('tab:settings') === -1) fail('settings handler ' + fired.join(','));
  if (fired.indexOf('open:audit.html') === -1) fail('audit handler ' + fired.join(','));
  await wide.page.evaluate(function () { window.switchTab('more'); });
  await wide.page.screenshot({ path: path.join(shotDir, 'after-more-1280.png'), fullPage: true });
  var own = wide.errors.filter(function (err) {
    return err.indexOf('more-cards') !== -1 || err.indexOf('chat-bottom') !== -1 || err.indexOf('FLMore') !== -1;
  });
  if (own.length) fail('desk error ' + own[0]);
  await wide.context.close();

  var phone = await openApp(390, 800, 1);
  await seat(phone.page);
  await phone.page.locator('#flChatAddBtn').click();
  await phone.page.waitForFunction(function () {
    var menu = document.getElementById('flChatAddMenu');
    return menu && menu.getAttribute('data-open') === '1';
  });
  var phoneGlass = await phone.page.evaluate(function () {
    var menu = getComputedStyle(document.getElementById('flChatAddMenu')).backgroundColor;
    var row = getComputedStyle(document.getElementById('flChatPillRow')).backgroundColor;
    return { menu: menu, pills: row, side: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 };
  });
  if (phoneGlass.menu.indexOf('16, 18, 36') === -1) fail('phone menu ' + phoneGlass.menu);
  if (phoneGlass.pills.indexOf('16, 18, 36') === -1) fail('phone pills ' + phoneGlass.pills);
  if (phoneGlass.side) fail('sideways 390 menu');
  await phone.page.screenshot({ path: path.join(shotDir, 'after-menu-390.png') });
  await phone.page.evaluate(function () { window.FLChatBottom.close(); });
  await phone.page.locator('#chatOverflowBtn').click();
  await phone.page.waitForFunction(function () {
    var tab = document.getElementById('tab-more');
    var menu = document.getElementById('flChatAddMenu');
    return tab && tab.classList.contains('active') && (!menu || menu.getAttribute('data-open') !== '1');
  });
  var phoneRoom = await phone.page.evaluate(function () {
    var menu = document.getElementById('flChatAddMenu');
    var cards = document.querySelectorAll('#more-hub-grid [data-fl-more-card]');
    var small = [];
    var i;
    for (i = 0; i < cards.length; i++) {
      var r = cards[i].getBoundingClientRect();
      if (r.height < 44 || r.width < 44) small.push(Math.round(r.width) + 'x' + Math.round(r.height));
    }
    return {
      count: cards.length,
      menuOpen: !!(menu && menu.getAttribute('data-open') === '1'),
      active: document.getElementById('tab-more').classList.contains('active'),
      side: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      small: small.slice(0, 4)
    };
  });
  if (!phoneRoom.active || phoneRoom.menuOpen) fail('phone more ' + JSON.stringify(phoneRoom));
  if (phoneRoom.count !== 25) fail('phone cards ' + phoneRoom.count);
  if (phoneRoom.side) fail('sideways 390 more');
  if (phoneRoom.small.length) fail('phone card size ' + phoneRoom.small.join(','));
  await phone.page.screenshot({ path: path.join(shotDir, 'after-more-390.png'), fullPage: true });
  await phone.page.evaluate(function () { window.switchTab('chat'); });
  await seat(phone.page);
  await phone.page.locator('#flChatAddBtn').click();
  await phone.page.waitForFunction(function () {
    var menu = document.getElementById('flChatAddMenu');
    return menu && menu.getAttribute('data-open') === '1';
  });
  await phone.context.close();

  var drive1280 = await proveDrive(1280, 800, 1);
  var drive390 = await proveDrive(390, 800, 1);
  var driveDense = await proveDrive(640, 400, 2);

  await browser.close();
  server.close();
  console.log(JSON.stringify({
    chrome: version,
    backs: contrast.backs,
    lowestWord: contrast.lowest,
    lowestIcon: contrast.lowIcon,
    moreWord: contrastMore.lowest,
    moreIcon: contrastMore.lowIcon,
    samples: contrast.count,
    driveClicks: { w1280: drive1280, w390: drive390, w640: driveDense },
    clarity: md5(path.join(root, 'docs/modules/chat-bottom-clarity.js')),
    sheet: md5(path.join(root, 'docs/css/chat-bottom-clarity.css')),
    groups: md5(path.join(root, 'docs/modules/more-cards-groups.js'))
  }));
  console.log('SMOKE_OK menu contrast v0.1');
  console.log('SMOKE_OK more cards groups v0.1');
})().catch(function (err) {
  console.error('FAIL ' + (err && err.stack ? err.stack : err));
  process.exit(1);
});
