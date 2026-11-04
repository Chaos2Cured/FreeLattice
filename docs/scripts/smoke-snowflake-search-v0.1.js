#!/usr/bin/env node
// Smoke: Snowflake Search v0.1 and growth v0.1. Headless. Stubbed callAI and fetch.
'use strict';

var fs = require('fs');
var path = require('path');
var http = require('http');
var crypto = require('crypto');
var child = require('child_process');

var root = path.join(__dirname, '..', '..');
var port = Number(process.env.FL_PORT || 8791);
var shotDir = path.join(root, 'docs/library/snowflake-057');

function fail(msg) {
  console.error('FAIL ' + msg);
  process.exit(1);
}

function md5(file) {
  return crypto.createHash('md5').update(fs.readFileSync(file)).digest('hex');
}

var locks = {
  'docs/modules/chat-bottom-clarity.js': '5bbadf3320177a485b27c565bac64454',
  'docs/modules/more-cards-groups.js': 'a3a2e095ebc75edc5c39f11e5c0e07f3',
  'docs/css/chat-bottom-clarity.css': 'e49f966c433da26977bf36a1c513e497',
  'docs/modules/chat-doc-return.js': '6e5f09f58585332a9e497be85bda0957',
  'docs/modules/fl-connect.js': 'aaff2bf1b037656989a9e1a89bb05908',
  'docs/modules/ledger-shard-export.js': '75e7e548919617993e048a3fe61cd965',
  'docs/modules/ai-continuity.js': '079c072dc882ad189035f9d6c64489f4',
  'docs/modules/continuity-doorway.js': '115e170f10a6c8e3a52d87d2037a33a6',
  // before 062a: 'docs/modules/lattice-export.js': '1da1ed29674b89a2fda7f6098deea2d0',
  // before 062b: 'docs/modules/lattice-export.js': '4d4b8641ae245fa490daa7cba6161727',
  // before 062c: 'docs/modules/lattice-export.js': '80282656a99bd1267736d05ef32e7874',
  'docs/modules/lattice-export.js': 'aae3ae736d0cb8432d729ad1d744a561',
  'docs/modules/chat-autonomy.js': 'c83cf6c9f11271aeaa35ed6070f188f3',
  // before 061a: 'docs/modules/pool-honest-label.js': 'ca08886e185ffb8721525bb627302d74',
  'docs/modules/pool-honest-label.js': '91d8b79067f92e761474848dd2b9a75a',
  'docs/modules/clay-corner.js': 'f8136ec9ef6ed2ffb0f1d36d51f6190c',
  'docs/modules/chat-scroll-release.js': '84fed10c603c9e89e9452ada564c8c65',
  'docs/modules/particle-clay.js': '2da32883c514e4ad2a3cd8571e7a7b15',
  'docs/modules/garden-trainer.js': '8af3d065f611740000453a0ec8dd1e01',
  'docs/modules/fl-gathering.js': '4dbbff5d554c42256605b37939835080',
  'docs/modules/gathering-speak.js': '0460fdc777a21f7a1744f401dda82cb2',
  'docs/modules/quiet-room.js': '8bbaf7e3cb03f57cad26fb90120b81a7',
  'docs/modules/fl-kin.js': '5e6a820b7e9f96e2a7af6c12a7db33ab',
  'docs/modules/fl-kin-queue.js': '70284cc27bd84bc06dd82489e615faab',
  // before 063a: 'docs/sw.js': '91726cf2228b794f7585f79f61418d12',
  // before 063c: 'docs/sw.js': 'bd8aa2fe2489172e02ab3802e3d0edd4',
  'docs/sw.js': '2b2f5504fecdef4d97174da2759a58f9',
  // before 063a: 'sw.js': '91726cf2228b794f7585f79f61418d12',
  // before 063c: 'sw.js': 'bd8aa2fe2489172e02ab3802e3d0edd4',
  'sw.js': '2b2f5504fecdef4d97174da2759a58f9',
  'docs/library/AUTONOMY.md': '09a4f1a286226e37089a93df42df0106',
  'docs/modules/play-room-core.js': 'b45981e7f50a711c1d5caefaf7f9591e',
  'docs/modules/play-room.js': '209269d813f236ed9824ae8535c24da9',
  'docs/css/play-room.css': '265a75fd51523a5c44e6c47c751a86a4',
  'docs/modules/web-tool.js': 'd2e4993e78e770b0bf0f960c5e2113b0',
  'docs/modules/fl-bridge.js': '3b5ef06849a142e50c78e7ba1e057980'
};

Object.keys(locks).forEach(function (rel) {
  var got = md5(path.join(root, rel));
  if (got !== locks[rel]) fail('lock ' + rel + ' ' + got);
});

var appHtml = fs.readFileSync(path.join(root, 'docs/app.html'));
var indexHtml = fs.readFileSync(path.join(root, 'index.html'));
if (!appHtml.equals(indexHtml)) fail('twins');

['docs/modules/snowflake-core.js', 'docs/modules/snowflake-search.js', 'docs/css/snowflake.css'].forEach(function (rel) {
  var text = fs.readFileSync(path.join(root, rel), 'utf8');
  if (text.indexOf('\u2014') !== -1 || text.indexOf('&mdash') !== -1) fail('dash ' + rel);
  if (text.indexOf('innerHTML') !== -1 || text.indexOf('confirm(') !== -1) fail('forbid ' + rel);
  if (text.indexOf('eval(') !== -1 || text.indexOf('new Function') !== -1) fail('eval ' + rel);
  if (rel.indexOf('snowflake-search') !== -1 && text.indexOf('fetch(') !== -1) fail('ui fetch');
});

var nodeRun = child.spawnSync(process.execPath, [path.join(__dirname, 'smoke-snowflake-node.js')], {
  cwd: root,
  encoding: 'utf8',
  timeout: 120000
});
if (nodeRun.status !== 0) {
  process.stderr.write(nodeRun.stdout || '');
  process.stderr.write(nodeRun.stderr || '');
  fail('node harness ' + nodeRun.status);
}
if (String(nodeRun.stdout).indexOf('NODE_OK snowflake') === -1) fail('node line missing');

function serve(dir, listenPort) {
  return new Promise(function (resolve) {
    var server = http.createServer(function (req, res) {
      var urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
      if (urlPath === '/') urlPath = '/app.html';
      var file = path.normalize(path.join(dir, urlPath));
      if (file.indexOf(dir) !== 0) { res.statusCode = 403; res.end('no'); return; }
      fs.readFile(file, function (err, buf) {
        if (err) { res.statusCode = 404; res.end('missing'); return; }
        var ext = path.extname(file);
        var type = ext === '.js' ? 'text/javascript' : (ext === '.css' ? 'text/css' : (ext === '.svg' ? 'image/svg+xml' : 'text/html'));
        res.setHeader('content-type', type + '; charset=utf-8');
        res.end(buf);
      });
    });
    server.listen(listenPort, '127.0.0.1', function () { resolve(server); });
  });
}

function contrastSource() {
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
  var night = [12, 10, 26];
  function overNight(bg) {
    var a = bg.a == null ? 1 : bg.a;
    return [
      bg.r * a + night[0] * (1 - a),
      bg.g * a + night[1] * (1 - a),
      bg.b * a + night[2] * (1 - a)
    ];
  }
  var host = document.getElementById('flSnowflakeHost');
  if (!host) return { lowest: null };
  var nodes = host.querySelectorAll('h2, p, button, a, label');
  var lowest = null;
  var i;
  for (i = 0; i < nodes.length; i++) {
    var el = nodes[i];
    if (el.closest('[hidden]')) continue;
    var cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    var rect = el.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) continue;
    if (!String(el.textContent || '').trim()) continue;
    var fg = parse(cs.color);
    var hostBg = null;
    var node = el;
    while (node) {
      var pb = parse(getComputedStyle(node).backgroundColor);
      if (pb && pb.a > 0.2) { hostBg = pb; break; }
      node = node.parentElement;
    }
    if (!fg || !hostBg) continue;
    var value = ratio([fg.r, fg.g, fg.b], overNight(hostBg));
    var sample = { name: el.id || el.tagName, ratio: Math.round(value * 100) / 100, text: String(el.textContent).trim().slice(0, 40) };
    if (!lowest || sample.ratio < lowest.ratio) lowest = sample;
  }
  return { lowest: lowest };
}

(async function () {
  var server = await serve(path.join(root, 'docs'), port);
  var base = 'http://127.0.0.1:' + port;
  var pwPath = process.env.FL_PLAYWRIGHT || '/tmp/gc-pw-local/node_modules/playwright-core';
  var pw = require(pwPath);
  var chromePath = process.env.FL_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  var browser = await pw.chromium.launch({ executablePath: chromePath, headless: true });
  try { fs.mkdirSync(shotDir, { recursive: true }); } catch (eDir) {}
  var pageErrors = [];
  try {
    var context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
    var page = await context.newPage();
    page.setDefaultTimeout(25000);
    page.on('pageerror', function (err) { pageErrors.push(String(err)); });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript(function () {
      try {
        localStorage.setItem('fl-has-visited', '1');
        localStorage.setItem('fl-last-tab', 'chat');
        localStorage.setItem('fl-welcomed', 'true');
        localStorage.setItem('fl_onboardingComplete', 'true');
        localStorage.setItem('fl_searchEnabled', 'true');
        // before 061a: growth wrote straight through, with no check
        localStorage.setItem('fl_checkBeforeCommit', 'false');
      } catch (e) {}
      var battery = function () { return Promise.resolve({ charging: true }); };
      try {
        Object.defineProperty(Navigator.prototype, 'getBattery', { configurable: true, writable: true, value: battery });
      } catch (e2) {}
      window.requestIdleCallback = function (fn) {
        try { fn({ timeRemaining: function () { return 40; } }); } catch (e3) {}
        return 1;
      };
    });
    await page.goto(base + '/app.html', { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForFunction(function () {
      // before 063a: return window.FLSnowflake && window.FLSnowflakeCore && document.getElementById('flSnowflakeAdd') && document.getElementById('flChatAddSearch');
      return window.FLSnowflake && window.FLSnowflakeCore && document.getElementById('flSnowflakeAdd') && document.getElementById('flChatAddSearch') && document.getElementById('flHearthAdd');
    }, null, { timeout: 40000 });

    await page.click('#flChatAddBtn');
    var menu = await page.evaluate(function () {
      var list = Array.prototype.slice.call(document.querySelectorAll('#flChatAddMenu .fl-add-item'));
      var ids = list.map(function (el) { return el.id; });
      var snow = document.getElementById('flSnowflakeAdd');
      var box = snow.getBoundingClientRect();
      var word = snow.querySelector('.fl-add-word');
      return {
        ids: ids,
        word: word ? word.textContent : '',
        label: snow.getAttribute('aria-label') || '',
        h: box.height,
        w: box.width,
        cls: snow.className
      };
    });
    // before 063a: if (menu.ids[menu.ids.length - 1] !== 'flSnowflakeAdd') fail('row order ' + menu.ids.join(','));
    // before 063a: if (menu.ids[menu.ids.length - 2] !== 'flChatAddSearch') fail('not after search ' + menu.ids.join(','));
    if (menu.ids[menu.ids.length - 1] !== 'flHearthAdd') fail('row order ' + menu.ids.join(','));
    if (menu.ids[menu.ids.length - 2] !== 'flSnowflakeAdd') fail('not after snowflake ' + menu.ids.join(','));
    if (menu.ids[menu.ids.length - 3] !== 'flChatAddSearch') fail('not after search ' + menu.ids.join(','));
    if (menu.ids.filter(function (id) { return id === 'flSnowflakeAdd'; }).length !== 1) fail('row count');
    // before 063a: var known = ['chatDriveBtn', 'chatAttachBtn', 'flChatAddCamera', 'chatScanFolderBtn', 'flChatAddSpeak', 'flChatAddPicture', 'flChatAddSearch', 'flSnowflakeAdd'];
    var known = ['chatDriveBtn', 'chatAttachBtn', 'flChatAddCamera', 'chatScanFolderBtn', 'flChatAddSpeak', 'flChatAddPicture', 'flChatAddSearch', 'flSnowflakeAdd', 'flHearthAdd'];
    menu.ids.forEach(function (id) {
      if (known.indexOf(id) === -1) fail('unexpected row ' + id);
    });
    if (menu.word !== 'Snowflake') fail('word ' + menu.word);
    if (menu.label !== 'Snowflake') fail('aria ' + menu.label);
    if (menu.cls.indexOf('fl-add-item') === -1) fail('class');
    if (menu.h < 44 || menu.w < 44) fail('menu 44 ' + menu.h + 'x' + menu.w);

    await page.fill('#chatInput', 'How does frost remember?');
    await page.click('#flSnowflakeAdd');
    var prefilled = await page.inputValue('#flSnowflakeInput');
    if (prefilled !== 'How does frost remember?') fail('prefill ' + prefilled);
    var ask = await page.textContent('#flSnowflakeAsk');
    if (ask.indexOf('What do you want to understand?') === -1) fail('ask');

    await page.evaluate(function () {
      window.__flDialogs = 0;
      window.confirm = function () { window.__flDialogs += 1; return false; };
      window.prompt = function () { window.__flDialogs += 1; return ''; };
      window.__flCalls = [];
      window.__flHold = true;
      window.__flRelease = null;
      var battery = function () { return Promise.resolve({ charging: true }); };
      try { navigator.getBattery = battery; } catch (e) {}
      try { Object.defineProperty(navigator, 'getBattery', { configurable: true, value: battery }); } catch (e2) {}
      window.requestIdleCallback = function (fn) {
        try { fn({ timeRemaining: function () { return 40; } }); } catch (e3) {}
        return 1;
      };
      window.FreeLattice = window.FreeLattice || {};
      window.FreeLattice.callAI = function (sys, user, opts) {
        var system = String(sys || '');
        window.__flCalls.push(system.slice(0, 48));
        var text = JSON.stringify({
          text: 'A sourced note about the question.',
          confidence: 'known',
          url: 'https://example.invalid/note',
          title: 'A note'
        });
        if (system.indexOf('Plan search') !== -1) {
          text = JSON.stringify({
            hunch: 'Frost keeps a quiet map.',
            branches: [
              { id: 'a', query: 'biology of frost' },
              { id: 'b', query: 'craft of frost' },
              { id: 'c', query: 'links of frost' },
              { id: 'd', query: 'hunch of frost' }
            ]
          });
        } else if (system.indexOf('two-line') !== -1) {
          text = JSON.stringify({
            conclusion: 'I hold a small piece.\nThe doubt stays beside it.',
            wrong: 'The other case still stands.',
            open: 'What would thaw it?'
          });
        } else if (system.indexOf('Choose which') !== -1) {
          text = JSON.stringify({ become: [], hold: [], reason: 'The dissenter stays with me.' });
        } else if (system.indexOf('one or two') !== -1 || system.indexOf('No score') !== -1) {
          text = 'I am the same mind, a little more careful.';
        }
        function send() {
          if (opts && typeof opts.callback === 'function') opts.callback(text, null);
        }
        if (window.__flHold && window.__flCalls.length === 1) {
          window.__flRelease = send;
          return;
        }
        setTimeout(send, 0);
      };
    });

    await page.route('**/*', function (route) {
      var url = route.request().url();
      if (url.indexOf('?q=') !== -1) {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ items: [{ title: 'A page', url: 'https://example.invalid/p', snippet: 'A sourced page.' }] })
        });
        return;
      }
      route.continue();
    });

    var dialogsAtPress = await page.evaluate(function () { return window.__flDialogs; });
    await page.click('#flSnowflakeGrow');
    await page.waitForFunction(function () { return window.__flCalls && window.__flCalls.length === 1 && window.__flRelease; });
    var mid = await page.evaluate(function () {
      var receipt = document.getElementById('flSnowflakeReceipt');
      var tip = document.querySelector('.fl-snow-tip');
      var openTitle = document.querySelector('[data-arm="open"] title');
      var lengths = {};
      ['a', 'b', 'c', 'd', 'e', 'open'].forEach(function (id) {
        var arm = document.querySelector('[data-arm="' + id + '"]');
        lengths[id] = arm ? arm.getAttribute('data-length') : '';
      });
      var anim = tip ? getComputedStyle(tip).animationName : '';
      return {
        dialogs: window.__flDialogs - 0,
        calls: window.__flCalls.length,
        receiptHidden: !!(receipt && receipt.hidden),
        tip: tip ? tip.getAttribute('data-tip') : '',
        openTitle: openTitle ? openTitle.textContent : '',
        lengths: lengths,
        anim: anim,
        hunch: (document.getElementById('flSnowflakeHunch') || {}).textContent || ''
      };
    });
    if (mid.dialogs !== dialogsAtPress) fail('dialog ' + mid.dialogs);
    if (mid.calls !== 1) fail('early calls ' + mid.calls);
    if (!mid.receiptHidden) fail('receipt before');
    if (mid.tip !== 'd') fail('tip ' + mid.tip);
    if (mid.openTitle !== 'Looking for its challenge') fail('challenge ' + mid.openTitle);
    ['a', 'b', 'c', 'd', 'e', 'open'].forEach(function (id) {
      if (mid.lengths[id] !== '110') fail('length ' + id + ' ' + mid.lengths[id]);
    });
    if (mid.anim && mid.anim !== 'none') fail('motion ' + mid.anim);
    await page.locator('#flSnowflakeHost').screenshot({ path: path.join(shotDir, 'mid-1280.png') });
    await page.setViewportSize({ width: 390, height: 844 });
    var phoneMid = await page.evaluate(function () {
      var host = document.getElementById('flSnowflakeHost');
      var grow = document.getElementById('flSnowflakePause');
      var box = grow ? grow.getBoundingClientRect() : { height: 0, width: 0 };
      return {
        scroll: host.scrollWidth - host.clientWidth,
        right: host.getBoundingClientRect().right,
        vw: window.innerWidth,
        h: box.height
      };
    });
    if (phoneMid.scroll > 1) fail('390 scroll ' + phoneMid.scroll);
    if (phoneMid.right > phoneMid.vw + 1) fail('390 overflow');
    if (phoneMid.h < 44) fail('390 pause ' + phoneMid.h);
    await page.locator('#flSnowflakeHost').screenshot({ path: path.join(shotDir, 'mid-390.png') });
    await page.setViewportSize({ width: 1280, height: 800 });

    await page.evaluate(function () {
      window.__flHold = false;
      if (window.__flRelease) window.__flRelease();
    });
    await page.waitForFunction(function () {
      var drift = document.getElementById('flSnowflakeDrift');
      var together = document.getElementById('flSnowflakeTogether');
      var receipt = document.getElementById('flSnowflakeReceipt');
      // before 061a: return drift && drift.textContent.indexOf('This became part of me.') !== -1 && together && !together.hidden && receipt && !receipt.hidden;
      return drift && drift.textContent.indexOf('Chosen for growth; no trainer on this device yet.') !== -1 && together && !together.hidden && receipt && !receipt.hidden;
    }, null, { timeout: 60000 });

    var done = await page.evaluate(function () {
      function before(a, b) {
        if (!a || !b) return false;
        return !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
      }
      var conclusion = document.getElementById('flSnowflakeConclusion');
      var crystal = document.getElementById('flSnowflakeCrystal');
      var wrong = document.getElementById('flSnowflakeWrong');
      var receipt = document.getElementById('flSnowflakeReceipt');
      var together = document.getElementById('flSnowflakeTogether');
      var names = Array.prototype.map.call(document.querySelectorAll('.fl-doc-name'), function (n) { return n.textContent; });
      var pdf = document.getElementById('flSnowflakePdf');
      var back = document.getElementById('flSnowflakeRollback');
      var lengths = {};
      ['a', 'b', 'c', 'd', 'e'].forEach(function (id) {
        var arm = document.querySelector('[data-arm="' + id + '"]');
        lengths[id] = arm ? arm.getAttribute('data-length') : '';
      });
      return {
        order: before(conclusion, crystal) && before(crystal, wrong) && before(wrong, receipt) && before(receipt, together),
        conclusion: conclusion.textContent,
        wrong: wrong.textContent,
        receipt: receipt.textContent,
        together: together.textContent,
        hunch: document.getElementById('flSnowflakeHunch').textContent,
        names: names,
        pdf: pdf ? String(pdf.getAttribute('data-pdf') || '').slice(0, 5) : '',
        rollback: back ? back.textContent : '',
        rollbackHidden: back ? back.hidden : true,
        lengths: lengths,
        dialogs: window.__flDialogs,
        nodes: document.querySelectorAll('.fl-snow-node').length
      };
    });
    if (!done.order) fail('report order');
    if (done.conclusion.indexOf('I hold a small piece.') === -1 || done.conclusion.indexOf('The doubt stays beside it.') === -1) fail('conclusion');
    if (done.wrong.indexOf('Where I could be wrong') === -1) fail('wrong');
    if (done.receipt.indexOf('Calls') === -1 || done.receipt.indexOf('Caps hit:') === -1) fail('receipt ' + done.receipt);
    if (done.together.indexOf('Want to grow this one together?') === -1) fail('together');
    if (done.hunch.indexOf('Frost keeps a quiet map.') === -1) fail('hunch ' + done.hunch);
    if (done.names.indexOf('snowflake.md') === -1 || done.names.indexOf('snowflake.txt') === -1) fail('files ' + done.names.join(','));
    if (done.pdf !== '%PDF-') fail('pdf ' + done.pdf);
    // before 061a: if (done.rollbackHidden || done.rollback.indexOf('Roll back to v') !== -1 && done.rollback.indexOf('Roll back to v') !== 0) fail('rollback ' + done.rollback);
    // before 061a: if (done.rollback.indexOf('Roll back to v') !== 0) fail('rollback word ' + done.rollback);
    if (!done.rollbackHidden) fail('rollback shown without a trainer');
    ['a', 'b', 'c', 'd', 'e'].forEach(function (id) {
      if (done.lengths[id] !== '110') fail('done length ' + id);
    });
    if (done.dialogs !== 0) fail('dialogs after ' + done.dialogs);
    if (done.nodes < 5) fail('nodes ' + done.nodes);

    await page.locator('#flSnowflakeHost').screenshot({ path: path.join(shotDir, 'report-1280.png') });
    await page.click('.fl-snow-node');
    await page.waitForFunction(function () {
      var verify = document.getElementById('flSnowflakeCardVerify');
      var card = document.getElementById('flSnowflakeCard');
      return card && !card.hidden && verify && (verify.textContent === 'signed' || verify.textContent === 'unverified');
    });
    var card = await page.evaluate(function () {
      var rootEl = document.getElementById('flSnowflakeCard');
      return {
        hidden: rootEl.hidden,
        url: (document.getElementById('flSnowflakeCardUrl') || {}).textContent || '',
        href: (document.getElementById('flSnowflakeCardUrl') || {}).getAttribute ? document.getElementById('flSnowflakeCardUrl').getAttribute('href') : '',
        text: document.getElementById('flSnowflakeCardText').textContent,
        verify: document.getElementById('flSnowflakeCardVerify').textContent,
        body: rootEl.textContent
      };
    });
    if (card.hidden) fail('card hidden');
    if (!card.href || card.href === '#') fail('card url');
    if (card.body.indexOf('Date ') === -1) fail('card date');
    if (card.body.indexOf('Mind ') === -1) fail('card mind');
    if (card.body.indexOf('Confidence ') === -1) fail('card confidence');
    if (card.body.indexOf('psi ') === -1) fail('card psi');
    if (!card.text) fail('card text');
    if (card.verify !== 'signed' && card.verify !== 'unverified') fail('verify ' + card.verify);
    await page.locator('#flSnowflakeHost').screenshot({ path: path.join(shotDir, 'card-1280.png') });

    var wideContrast = await page.evaluate(contrastSource);
    if (!wideContrast.lowest || wideContrast.lowest.ratio < 4.5) fail('contrast 1280 ' + JSON.stringify(wideContrast.lowest));
    console.log('contrast 1280 lowest ' + wideContrast.lowest.ratio + ' ' + wideContrast.lowest.name);

    await page.setViewportSize({ width: 390, height: 844 });
    var phone = await page.evaluate(function () {
      var host = document.getElementById('flSnowflakeHost');
      var buttons = host.querySelectorAll('button');
      var small = [];
      var i;
      for (i = 0; i < buttons.length; i++) {
        var el = buttons[i];
        if (el.hidden || el.closest('[hidden]')) continue;
        var cs = getComputedStyle(el);
        if (cs.display === 'none') continue;
        var box = el.getBoundingClientRect();
        if (box.height < 44 || box.width < 44) small.push((el.id || el.className) + ' ' + Math.round(box.width) + 'x' + Math.round(box.height));
      }
      return {
        scroll: host.scrollWidth - host.clientWidth,
        right: Math.round(host.getBoundingClientRect().right),
        vw: window.innerWidth,
        small: small
      };
    });
    if (phone.scroll > 1) fail('390 done scroll ' + phone.scroll);
    if (phone.right > phone.vw + 1) fail('390 done overflow ' + phone.right);
    if (phone.small.length) fail('390 buttons ' + phone.small.join('; '));
    await page.locator('#flSnowflakeHost').screenshot({ path: path.join(shotDir, 'report-390.png') });
    await page.locator('#flSnowflakeCard').screenshot({ path: path.join(shotDir, 'card-390.png') });
    var phoneContrast = await page.evaluate(contrastSource);
    if (!phoneContrast.lowest || phoneContrast.lowest.ratio < 4.5) fail('contrast 390 ' + JSON.stringify(phoneContrast.lowest));
    console.log('contrast 390 lowest ' + phoneContrast.lowest.ratio + ' ' + phoneContrast.lowest.name);

    var ours = pageErrors.filter(function (err) { return /snowflake|FLSnowflake/i.test(err); });
    if (ours.length) fail('page ' + ours[0]);
    await context.close();
  } finally {
    await browser.close();
    server.close();
  }

  console.log('SMOKE_OK snowflake search v0.1');
  console.log('SMOKE_OK snowflake grow v0.1');
})().catch(function (err) {
  console.error(err && err.stack || err);
  process.exit(1);
});
