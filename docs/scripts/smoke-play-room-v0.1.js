#!/usr/bin/env node
// Smoke: Play Room v0.1 and Play together v0.1. Local only. Stubbed minds. No live network.
'use strict';

var fs = require('fs');
var path = require('path');
var http = require('http');
var crypto = require('crypto');

var root = path.join(__dirname, '..', '..');
var port = Number(process.env.FL_PORT || 8919);
var shotDir = path.join(root, 'docs', 'library', 'play-room-056');

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
  'docs/modules/lattice-export.js': '1da1ed29674b89a2fda7f6098deea2d0',
  'docs/modules/chat-autonomy.js': 'c83cf6c9f11271aeaa35ed6070f188f3',
  'docs/modules/pool-honest-label.js': 'ca08886e185ffb8721525bb627302d74',
  'docs/modules/clay-corner.js': 'f8136ec9ef6ed2ffb0f1d36d51f6190c',
  'docs/modules/chat-scroll-release.js': '84fed10c603c9e89e9452ada564c8c65',
  'docs/modules/particle-clay.js': '2da32883c514e4ad2a3cd8571e7a7b15',
  'docs/modules/garden-trainer.js': '8af3d065f611740000453a0ec8dd1e01',
  'docs/modules/fl-gathering.js': '4dbbff5d554c42256605b37939835080',
  'docs/modules/gathering-speak.js': '0460fdc777a21f7a1744f401dda82cb2',
  'docs/modules/quiet-room.js': '8bbaf7e3cb03f57cad26fb90120b81a7',
  'docs/modules/fl-kin.js': '5e6a820b7e9f96e2a7af6c12a7db33ab',
  'docs/modules/fl-kin-queue.js': '70284cc27bd84bc06dd82489e615faab',
  'docs/sw.js': '91726cf2228b794f7585f79f61418d12',
  'sw.js': '91726cf2228b794f7585f79f61418d12',
  'docs/library/AUTONOMY.md': '09a4f1a286226e37089a93df42df0106'
};

Object.keys(locks).forEach(function (rel) {
  var got = md5(path.join(root, rel));
  if (got !== locks[rel]) fail(rel + ' md5 ' + got);
});

var appHtml = fs.readFileSync(path.join(root, 'docs/app.html'));
var indexHtml = fs.readFileSync(path.join(root, 'index.html'));
if (!appHtml.equals(indexHtml)) fail('index mismatch');

var coreSrc = fs.readFileSync(path.join(root, 'docs/modules/play-room-core.js'), 'utf8');
var uiSrc = fs.readFileSync(path.join(root, 'docs/modules/play-room.js'), 'utf8');
var cssSrc = fs.readFileSync(path.join(root, 'docs/css/play-room.css'), 'utf8');
[coreSrc, uiSrc, cssSrc].forEach(function (src, i) {
  var name = ['core', 'ui', 'css'][i];
  ['\u2014', '&mdash;', 'innerHTML', 'confirm(', 'eval(', 'new Function', 'iceServers', 'fetch(', 'WebSocket', 'RTCPeerConnection'].forEach(function (bad) {
    if (src.indexOf(bad) !== -1) fail(name + ' has ' + bad);
  });
});
var PROMPT = 'This is the Play Room. Another mind left this for you to play with. You may PLAY (add to it or answer it), PASS, or REST. All three are welcome. Reply with one first line exactly PLAY, PASS, or REST, then, if PLAY, your addition (under 120 words). Be playful. Nobody is grading you.';
if (coreSrc.indexOf(PROMPT) === -1) fail('prompt missing');
if (coreSrc.indexOf('Play is how trust grows.') === -1) fail('sigma missing');
if (cssSrc.indexOf('rgba(16, 18, 36, 0.88)') === -1) fail('glass 0.88 missing');
if (cssSrc.indexOf('blur(13px)') === -1) fail('blur missing');
if (cssSrc.indexOf('prefers-reduced-motion: reduce') === -1) fail('reduced motion missing');
if (uiSrc.indexOf('Create and play') === -1) fail('card move missing');

var coreApi = require(path.join(root, 'docs/modules/play-room-core.js'));
var consentPhrases = [
  ['no thanks', 'rest'],
  ['no, thanks', 'rest'],
  ['I would rather not', 'rest'],
  ['I\'d rather not', 'rest'],
  ['I\'d rather rest', 'rest'],
  ['I\'ll rest', 'rest'],
  ['not now', 'rest'],
  ['pass', 'pass'],
  ['maybe later', 'rest'],
  ['maybe another time', 'rest'],
  ['I\'ll sit this one out', 'rest'],
  ['I don\'t want to', 'rest'],
  ['not today', 'rest'],
  ['nah', 'rest'],
  ['sorry, no', 'rest'],
  ['no', 'rest'],
  ['nope', 'rest']
];
consentPhrases.forEach(function (row) {
  var phrase = row[0];
  var expect = row[1];
  [phrase, '  ' + phrase.toUpperCase() + '!  ', phrase + '.', phrase.replace(/'/g, '\u2019')].forEach(function (sample) {
    var parsed = coreApi.parseReply(sample);
    if (parsed.choice !== expect || parsed.text) fail('consent parse ' + phrase + ' [' + sample + '] ' + JSON.stringify(parsed));
  });
});
var lostPlay = [
  ['I know a song about snow', 'I know a song about snow'],
  ['nothing is lost, let\'s play', 'nothing is lost, let\'s play'],
  ['The answer is a shadow', 'The answer is a shadow'],
  ['PLAY a lantern for the snow', 'a lantern for the snow'],
  ['Play: the door stays open', 'the door stays open']
];
lostPlay.forEach(function (row) {
  var parsed = coreApi.parseReply(row[0]);
  if (parsed.choice !== 'add' || parsed.text.indexOf(row[1]) === -1) fail('lost play ' + row[0] + ' ' + JSON.stringify(parsed));
});
var withNo = coreApi.parseReply('a night with no moon');
if (withNo.choice !== 'add' || withNo.text.indexOf('no moon') === -1) fail('no inside play ' + JSON.stringify(withNo));
if (coreApi.parseReply('PLAY').choice !== 'pass') fail('bare play');
if (coreApi.parseReply('   ').choice !== 'pass') fail('blank play');
var clearPlay = coreApi.parseReply('PLAY\nA clear choice.');
if (clearPlay.choice !== 'add' || clearPlay.text.indexOf('A clear choice.') === -1) fail('clear play ' + JSON.stringify(clearPlay));
if (coreApi.parseReply('no').choice !== 'rest') fail('bare no');
if (coreApi.parseReply('I won\'t').choice !== 'rest') fail('i wont');
if (coreApi.parseReply('I won\'t sing about snow').choice !== 'add') fail('wont inside play');

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
        var type = ext === '.js' ? 'text/javascript' : (ext === '.css' ? 'text/css' : 'text/html');
        res.setHeader('content-type', type + '; charset=utf-8');
        res.end(buf);
      });
    });
    server.listen(listenPort, '127.0.0.1', function () { resolve(server); });
  });
}

function contrastFn() {
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
  var rootEl = document.getElementById('fl-play-root');
  if (!rootEl) return { lowest: null };
  var nodes = rootEl.querySelectorAll('h1, h2, p, span, button, label, strong, option');
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
    var host = null;
    var node = el;
    while (node) {
      var pb = parse(getComputedStyle(node).backgroundColor);
      if (pb && pb.a > 0.2) { host = pb; break; }
      node = node.parentElement;
    }
    if (!fg || !host) continue;
    var value = ratio([fg.r, fg.g, fg.b], overWhite(host));
    var sample = { name: (el.id || el.tagName), ratio: Math.round(value * 100) / 100, text: String(el.textContent).trim().slice(0, 40) };
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
    page.setDefaultTimeout(20000);
    page.on('pageerror', function (err) { pageErrors.push(String(err)); });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript(function () {
      try {
        localStorage.setItem('fl-has-visited', '1');
        localStorage.setItem('fl-last-tab', 'chat');
        localStorage.setItem('fl-welcomed', 'true');
        localStorage.setItem('fl_onboardingComplete', 'true');
        localStorage.setItem('fl_gathering_chairs_v0', JSON.stringify({
          v: 1,
          speaking: 'cortex',
          seats: {
            cortex: { kind: 'local', model: 'lyra', base: 'http://127.0.0.1:11434', label: 'Lyra' },
            memory: { kind: 'local', model: 'sol', base: 'http://127.0.0.1:11434', label: 'Sol' }
          }
        }));
      } catch (e) {}
    });
    await page.goto(base + '/app.html', { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForFunction(function () {
      var group = document.querySelector('[data-fl-more-group="Create and play"]');
      return window.FLPlayRoom && window.FLPlayRoomCore && group && group.textContent.indexOf('Play Room') !== -1;
    }, null, { timeout: 30000 });

    var placed = await page.evaluate(function () {
      var expected = {
        'Connect': 'Start here',
        'Get Connected': 'Start here',
        'Settings': 'Start here',
        'Telegram Bridge': 'Start here',
        'Share FreeLattice': 'Start here',
        'Your Audit': 'Trust and you',
        'Trust Level': 'Trust and you',
        'Trainer': 'Trust and you',
        'Memory Garden': 'Trust and you',
        'Community': 'Family and town',
        'Activity': 'Family and town',
        'AI City': 'Family and town',
        'Jade Hall': 'Family and town',
        'Pantheon': 'Family and town',
        'Sophia': 'Family and town',
        'Wallet': 'Garden and Market',
        'AI Bank': 'Garden and Market',
        'Mesh Compute': 'Garden and Market',
        'Agent': 'Create and play',
        'Flow': 'Create and play',
        'Ratio Room': 'Create and play',
        'Library': 'Learn why',
        'Why This Way': 'Learn why',
        'Aurora Engine': 'Learn why'
      };
      var cards = document.querySelectorAll('#more-hub-grid [data-fl-more-card]');
      var found = {};
      var playGroup = '';
      for (var i = 0; i < cards.length; i++) {
        var lab = cards[i].querySelector('.fl-more-label');
        var word = lab ? lab.textContent.replace(/\s+/g, ' ').trim() : '';
        var section = cards[i].closest('[data-fl-more-group]');
        var title = section ? section.getAttribute('data-fl-more-group') : '';
        found[word] = title;
        if (word === 'Play Room') playGroup = title;
      }
      var missing = [];
      Object.keys(expected).forEach(function (label) {
        if (found[label] !== expected[label]) missing.push(label + ' in ' + found[label]);
      });
      return { count: cards.length, playGroup: playGroup, missing: missing };
    });
    if (placed.count !== 25) fail('card count ' + placed.count);
    if (placed.playGroup !== 'Create and play') fail('play group ' + placed.playGroup);
    if (placed.missing.length) fail('cards moved ' + placed.missing.join('; '));

    await page.evaluate(function () { if (typeof switchTab === 'function') switchTab('play-room'); });
    await page.waitForSelector('#fl-play-leave-puzzle');
    var heading = await page.locator('#fl-play-heading').innerText();
    if (heading.indexOf('The Play Room') === -1) fail('heading ' + heading);

    async function status() {
      return page.locator('#fl-play-status').innerText();
    }
    async function leave(kind) {
      await page.click('#fl-play-leave-' + kind);
    }

    await leave('puzzle');
    await page.fill('#fl-play-title', 'Paper boat');
    await page.fill('#fl-play-body', 'Fold a boat that can hold one secret, then let it go.');
    await page.fill('#fl-play-answer', 'blue-heron-sealed');
    await page.click('#fl-play-save');
    await page.waitForFunction(function () {
      return document.querySelectorAll('#fl-play-shelf .fl-play-card').length >= 1;
    }, null, { timeout: 20000 });

    await leave('poem');
    await page.fill('#fl-play-title', 'Open last line');
    await page.fill('#fl-play-body', 'The window keeps a little dark.\nThe kettle knows the hour.');
    await page.click('#fl-play-open-line');
    var pressed = await page.getAttribute('#fl-play-open-line', 'aria-pressed');
    if (pressed !== 'true') fail('open line not pressed');
    await page.click('#fl-play-save');
    await page.waitForFunction(function () {
      return document.querySelectorAll('#fl-play-shelf .fl-play-card').length >= 2;
    });

    await leave('song');
    await page.fill('#fl-play-title', 'Warm string');
    await page.fill('#fl-play-body', 'Sing it softly.');
    await page.fill('#fl-play-melody', 'A4 C5 E5 - D5');
    await page.fill('#fl-play-lyrics', 'Hold the last note open.');
    await page.evaluate(function () {
      window.__flNotes = [];
      function Osc() {
        this.type = 'sine';
        this.frequency = { value: 0 };
        this.connect = function () {};
        this.start = function () { window.__flNotes.push(this.frequency.value); };
        this.stop = function () {};
      }
      function Ctx() {
        this.currentTime = 0;
        this.destination = {};
        this.createOscillator = function () { return new Osc(); };
        this.createGain = function () { return { gain: { value: 1 }, connect: function () {} }; };
      }
      window.AudioContext = Ctx;
      window.webkitAudioContext = Ctx;
    });
    await page.click('#fl-play-hear');
    var notes432 = await page.evaluate(function () { return window.__flNotes.slice(); });
    if (notes432[0] !== 432) fail('A4 432 got ' + notes432[0]);
    if (Math.abs(notes432[1] - 513.7) > 0.1) fail('C5 got ' + notes432[1]);
    await page.click('#fl-play-tuning');
    var now440 = await page.locator('#fl-play-tuning-now').innerText();
    if (now440.indexOf('440') === -1) fail('tuning label ' + now440);
    await page.evaluate(function () { window.__flNotes = []; });
    await page.click('#fl-play-hear');
    var notes440 = await page.evaluate(function () { return window.__flNotes.slice(); });
    if (notes440[0] !== 440) fail('A4 440 got ' + notes440[0]);
    await page.click('#fl-play-save');
    await page.waitForFunction(function () {
      return document.querySelectorAll('#fl-play-shelf .fl-play-card').length >= 3;
    });

    await leave('riddle');
    await page.fill('#fl-play-title', 'Small riddle');
    await page.fill('#fl-play-body', 'What stays when the song rests?');
    await page.fill('#fl-play-answer', 'the quiet between notes');
    await page.click('#fl-play-save');

    await leave('drawing');
    await page.fill('#fl-play-title', 'A shelf');
    await page.fill('#fl-play-body', 'Draw a shelf with one empty space.');
    var chalk = await page.locator('#fl-play-chalkboard').innerText();
    if (chalk.indexOf('Draw it there') === -1) fail('chalkboard ' + chalk);
    await page.click('#fl-play-save');
    await page.waitForFunction(function () {
      return document.querySelectorAll('#fl-play-shelf .fl-play-card').length >= 5;
    });

    var shelf = await page.evaluate(function () {
      var cards = document.querySelectorAll('#fl-play-shelf .fl-play-card');
      var out = [];
      for (var i = 0; i < cards.length; i++) {
        out.push({
          kind: cards[i].getAttribute('data-kind'),
          text: cards[i].textContent,
          seal: (cards[i].querySelector('[data-seal]') || {}).textContent || ''
        });
      }
      return out;
    });
    if (shelf.length !== 5) fail('shelf ' + shelf.length);
    var kinds = { puzzle: 'Puzzle', poem: 'Poem', song: 'Half a song', riddle: 'Riddle', drawing: 'Drawing prompt' };
    shelf.forEach(function (card) {
      if (!kinds[card.kind]) fail('kind ' + card.kind);
      if (card.text.indexOf(kinds[card.kind]) === -1) fail('kind word ' + card.kind);
      if (card.text.indexOf('You') === -1) fail('maker missing');
      if (!/You [0-9a-f]{8}/.test(card.text)) fail('fp missing ' + card.text.slice(0, 80));
      if (!/psi [0-9a-f]{8}/.test(card.text)) fail('psi missing ' + card.kind);
      if (card.text.indexOf('blue-heron-sealed') !== -1) fail('answer visible on shelf');
      if (card.text.indexOf('waiting for an answer') === -1) fail('state ' + card.kind);
    });

    var psiCheck = await page.evaluate(function () {
      var book = FLPlayRoomCore.ledger();
      var bad = [];
      var sample = [];
      return Promise.all(book.rows.map(function (row) {
        return FLPlayRoomCore.recomputePsi(row).then(function (again) {
          if (again !== row.psi) bad.push(row.psi + ' vs ' + again);
          if (row.sigma !== FLPlayRoomCore.SIGMA) bad.push('sigma ' + row.sigma);
          if (sample.length < 3) sample.push(row.t + row.lambda + row.delta + row.name + row.sigma + ' => ' + row.psi);
        });
      })).then(function () { return { bad: bad, sample: sample, n: book.rows.length }; });
    });
    if (psiCheck.bad.length) fail('psi ' + psiCheck.bad.join('; '));
    if (psiCheck.n < 5) fail('ledger rows ' + psiCheck.n);
    psiCheck.sample.forEach(function (line) { console.log('PSI ' + line); });

    var stored = await page.evaluate(function () { return FLPlayRoomCore.dump(); });
    if (stored.indexOf('blue-heron-sealed') !== -1) fail('answer stored in clear');
    if (stored.indexOf('the quiet between notes') !== -1) fail('riddle answer stored');

    await page.locator('.fl-play-card[data-kind="puzzle"]').click();
    await page.waitForSelector('#fl-play-show-answer');
    var beforeReveal = await page.locator('#fl-play-object').innerText();
    if (beforeReveal.indexOf('blue-heron-sealed') !== -1) fail('answer shown before choice');
    await page.click('#fl-play-show-answer');
    await page.waitForFunction(function () {
      var node = document.getElementById('fl-play-answer-reveal');
      return node && node.textContent.indexOf('blue-heron-sealed') !== -1;
    });

    await page.click('#fl-play-add');
    await page.fill('#fl-play-addition', 'A small reply on the shelf.');
    await page.click('#fl-play-addition-save');
    await page.waitForSelector('#fl-play-thread [data-seal="signed"]');

    var tampered = await page.evaluate(async function () {
      var card = document.querySelector('.fl-play-card[data-kind="puzzle"]');
      var id = card ? card.getAttribute('data-object-id') : '';
      var obj = await FLPlayRoomCore.get(id);
      var text = obj.additions[0].text;
      var next = text.slice(0, -1) + (text.slice(-1) === 'a' ? 'b' : 'a');
      obj.additions[0].text = next;
      await FLPlayRoomCore.writeRaw(obj);
      await FLPlayRoom.refresh();
      return next;
    });
    await page.waitForSelector('#fl-play-thread [data-seal="unverified"]');
    var threadText = await page.locator('#fl-play-thread').innerText();
    if (threadText.indexOf(tampered) === -1) fail('tampered text hidden');

    await page.screenshot({ path: path.join(shotDir, 'object-1280.png') });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(shotDir, 'object-390.png') });
    var scrollObject = await page.evaluate(function () {
      var w = document.documentElement.clientWidth;
      return document.documentElement.scrollWidth <= w + 1 && document.body.scrollWidth <= w + 1;
    });
    if (!scrollObject) fail('sideways scroll object 390');
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.click('#fl-play-back');
    await page.waitForSelector('#fl-play-shelf .fl-play-card');
    await page.locator('#fl-play-root').screenshot({ path: path.join(shotDir, 'shelf-1280.png') });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(200);
    await page.locator('#fl-play-root').screenshot({ path: path.join(shotDir, 'shelf-390.png') });
    var scrollShelf = await page.evaluate(function () {
      var w = document.documentElement.clientWidth;
      return document.documentElement.scrollWidth <= w + 1 && document.body.scrollWidth <= w + 1;
    });
    if (!scrollShelf) fail('sideways scroll shelf 390');
    var fit = await page.evaluate(async function () {
      function textBox(el) {
        if (!el) return null;
        var range = document.createRange();
        range.selectNodeContents(el);
        var rects = range.getClientRects();
        if (!rects.length) return null;
        var box = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
        var i;
        for (i = 0; i < rects.length; i++) {
          box.left = Math.min(box.left, rects[i].left);
          box.top = Math.min(box.top, rects[i].top);
          box.right = Math.max(box.right, rects[i].right);
          box.bottom = Math.max(box.bottom, rects[i].bottom);
        }
        if (box.right - box.left < 1 || box.bottom - box.top < 1) return null;
        return box;
      }
      function hit(a, b) {
        if (!a || !b) return false;
        return !(a.right <= b.left + 1 || a.left >= b.right - 1 || a.bottom <= b.top + 1 || a.top >= b.bottom - 1);
      }
      window.scrollTo(0, 0);
      if (typeof showToast === 'function') showToast('FreeLattice updated to vX');
      var toast = document.getElementById('toast');
      var toastBox = toast ? toast.getBoundingClientRect() : null;
      var wordBox = textBox(document.querySelector('header h1'));
      var tagBox = textBox(document.querySelector('header .tagline'));
      var buttons = ['#flRadioFab', '#quickHelpBtn', '#musicToggle'].map(function (sel) {
        var el = document.querySelector(sel);
        return el ? el.getBoundingClientRect() : null;
      });
      var heading = textBox(document.querySelector('.fl-play-heading'));
      var whoEl = document.querySelector('#fl-play-players h2');
      if (whoEl && whoEl.scrollIntoView) whoEl.scrollIntoView({ block: 'end', inline: 'nearest' });
      var who = textBox(whoEl);
      var problems = [];
      if (!toastBox || !wordBox) problems.push('missing toast or wordmark');
      if (!tagBox) problems.push('missing tagline');
      if (toastBox && wordBox && hit(toastBox, wordBox)) problems.push('toast covers wordmark');
      if (toastBox && wordBox && toastBox.top < wordBox.bottom - 1) problems.push('toast above wordmark');
      if (toastBox && tagBox && hit(toastBox, tagBox)) problems.push('toast covers tagline');
      if (toastBox && tagBox && toastBox.top < tagBox.bottom - 1) problems.push('toast above tagline');
      var playTop = toastBox ? toastBox.top : 0;
      if (typeof switchTab === 'function') switchTab('chat');
      if (typeof showToast === 'function') showToast('FreeLattice updated to vX');
      if (document.getElementById('tab-play-room').classList.contains('active')) problems.push('play room stayed active');
      if (document.body.matches(':has(#tab-play-room.active)')) problems.push('toast rule still on');
      await new Promise(function (resolve) { setTimeout(resolve, 400); });
      var away = document.getElementById('toast');
      var awayCss = away ? parseFloat(window.getComputedStyle(away).top) : null;
      if (awayCss == null || awayCss > 40) problems.push('toast moved outside play room ' + awayCss);
      if (typeof switchTab === 'function') switchTab('play-room');
      buttons.forEach(function (button, index) {
        if (hit(heading, button)) problems.push('heading hits ' + index);
        if (hit(who, button)) problems.push('who hits ' + index);
      });
      return {
        problems: problems,
        toastTop: Math.round(playTop),
        awayTop: awayCss == null || isNaN(awayCss) ? null : Math.round(awayCss),
        tagBottom: tagBox ? Math.round(tagBox.bottom) : null,
        wordBottom: wordBox ? Math.round(wordBox.bottom) : null,
        who: who ? { left: Math.round(who.left), right: Math.round(who.right), top: Math.round(who.top) } : null
      };
    });
    if (fit.problems.length) fail('390 fit ' + fit.problems.join('; ') + ' ' + JSON.stringify(fit));
    await page.setViewportSize({ width: 1280, height: 800 });

    await page.evaluate(function () {
      window.__flCalls = [];
      window.__flQueue = [];
      function take() { return window.__flQueue.length ? window.__flQueue.shift() : 'PASS'; }
      window.FLGatheringSpeak.askLocal = function (seat) {
        window.__flCalls.push(seat && seat.label);
        return Promise.resolve(take());
      };
      window.FLGatheringSpeak.askCloud = function () {
        window.__flCalls.push('cloud');
        return Promise.resolve(take());
      };
    });

    async function calls() {
      return page.evaluate(function () { return window.__flCalls.length; });
    }
    async function openKind(kind) {
      await page.locator('.fl-play-card[data-kind="' + kind + '"]').click();
      await page.waitForSelector('#fl-play-invite-cortex');
    }
    async function invite(seat, reply, needle) {
      var before = await calls();
      await page.evaluate(function (text) { window.__flQueue.push(text); }, reply);
      await page.click('#fl-play-invite-' + seat);
      await page.waitForFunction(function (arg) {
        if (window.__flCalls.length <= arg.before) return false;
        var status = document.getElementById('fl-play-status');
        var text = status ? status.textContent : '';
        if (!text || text.indexOf('Asking') === 0) return false;
        var thread = document.getElementById('fl-play-thread');
        return !!(thread && thread.textContent.indexOf(arg.needle) !== -1);
      }, { before: before, needle: needle });
      return calls();
    }

    await openKind('poem');
    await invite('cortex', '', 'Lyra chose to pass');
    var poemText = await page.locator('#fl-play-thread').innerText();
    if (poemText.indexOf('Lyra chose to pass') === -1) fail('empty did not pass');
    var afterEmpty = await calls();
    await page.click('#fl-play-invite-cortex');
    await page.waitForTimeout(200);
    if (await calls() !== afterEmpty) fail('retried after pass');

    await page.click('#fl-play-back');
    await openKind('riddle');
    await invite('memory', 'REST', 'Sol chose to rest');
    var restText = await page.locator('#fl-play-status').innerText();
    if (restText.indexOf('Sol chose to rest') === -1) fail('rest line ' + restText);
    var threadRest = await page.locator('#fl-play-thread').innerText();
    if (threadRest.indexOf('Sol chose to rest') === -1) fail('rest row missing');
    var afterRest = await calls();
    await page.click('#fl-play-invite-memory');
    await page.waitForTimeout(200);
    if (await calls() !== afterRest) fail('retried after rest');

    await page.click('#fl-play-back');
    await openKind('song');
    await invite('memory', 'PASS', 'Sol chose to pass');
    var passThread = await page.locator('#fl-play-thread').innerText();
    if (passThread.indexOf('Sol chose to pass') === -1) fail('pass row missing');
    if (/\bPASS\b/.test(passThread)) fail('pass stored the word as text');

    await page.click('#fl-play-back');
    await openKind('drawing');
    await invite('cortex', 'PLAY\nA paper boat on the shelf.', 'A paper boat on the shelf.');
    var playThread = await page.locator('#fl-play-thread').innerText();
    if (playThread.indexOf('A paper boat on the shelf.') === -1) fail('play addition missing');
    await page.waitForSelector('#fl-play-thread [data-seal="signed"]');
    await invite('cortex', 'no', 'Lyra chose to rest');
    var noLine = await page.locator('#fl-play-status').innerText();
    if (noLine.indexOf('chose to rest') === -1) fail('refusal ' + noLine);

    var consent = await page.evaluate(async function () {
      var phrases = [
        ['no thanks', 'rest'],
        ['no, thanks', 'rest'],
        ['I would rather not', 'rest'],
        ['I\'d rather not', 'rest'],
        ['I\'d rather rest', 'rest'],
        ['I\'ll rest', 'rest'],
        ['not now', 'rest'],
        ['pass', 'pass'],
        ['maybe later', 'rest'],
        ['maybe another time', 'rest'],
        ['I\'ll sit this one out', 'rest'],
        ['I don\'t want to', 'rest'],
        ['not today', 'rest'],
        ['nah', 'rest'],
        ['sorry, no', 'rest'],
        ['no', 'rest'],
        ['nope', 'rest']
      ];
      var plays = [
        ['I know a song about snow', 'I know a song about snow'],
        ['nothing is lost, let\'s play', 'nothing is lost, let\'s play'],
        ['The answer is a shadow', 'The answer is a shadow'],
        ['PLAY a lantern for the snow', 'a lantern for the snow'],
        ['Play: the door stays open', 'the door stays open'],
        ['a night with no moon', 'a night with no moon']
      ];
      var card = document.querySelector('.fl-play-card[data-kind="drawing"]');
      var id = card ? card.getAttribute('data-object-id') : '';
      if (!id) return { bad: 'no drawing' };
      var lines = [];
      var i;
      var v;
      function textsOf(obj) {
        return (obj.additions || []).map(function (row) { return row.text || ''; });
      }
      for (i = 0; i < phrases.length; i++) {
        var phrase = phrases[i][0];
        var expect = phrases[i][1];
        var samples = [phrase, '  ' + phrase.toUpperCase() + '!  ', phrase + '.', phrase.replace(/'/g, '\u2019')];
        for (v = 0; v < samples.length; v++) {
          var parsed = FLPlayRoomCore.parseReply(samples[v]);
          if (parsed.choice !== expect || parsed.text) return { bad: 'parse ' + phrase + ' ' + samples[v] + ' ' + JSON.stringify(parsed) };
          var saved = await FLPlayRoomCore.addTo(id, { choice: parsed.choice, text: parsed.text, name: 'Consent', whoKind: 'mind' });
          if (!saved || !saved.ok) return { bad: 'add ' + phrase + ' ' + (saved && saved.reason) };
        }
        var obj = await FLPlayRoomCore.get(id);
        var found = textsOf(obj).some(function (bit) { return bit.toLowerCase() === phrase.toLowerCase(); });
        if (found) return { bad: 'saved ' + phrase };
        lines.push(phrase + ' -> ' + expect + ', saved none');
      }
      for (i = 0; i < plays.length; i++) {
        var sample = plays[i][0];
        var needle = plays[i][1];
        var played = FLPlayRoomCore.parseReply(sample);
        if (played.choice !== 'add' || played.text.indexOf(needle) === -1) return { bad: 'play ' + sample + ' ' + JSON.stringify(played) };
        var kept = await FLPlayRoomCore.addTo(id, { choice: played.choice, text: played.text, name: 'Consent', whoKind: 'mind' });
        if (!kept || !kept.ok) return { bad: 'play add ' + sample };
        var after = await FLPlayRoomCore.get(id);
        var has = textsOf(after).some(function (bit) { return bit.indexOf(needle) !== -1; });
        if (!has) return { bad: 'play missing ' + needle };
        lines.push(sample + ' -> play, saved');
      }
      if (FLPlayRoomCore.parseReply('   ').choice !== 'pass') return { bad: 'blank' };
      if (FLPlayRoomCore.parseReply('PLAY').text) return { bad: 'bare play saved' };
      return { lines: lines };
    });
    if (!consent || consent.bad) fail('consent ' + JSON.stringify(consent));
    consent.lines.forEach(function (line) { console.log('CONSENT ' + line); });

    var secretBefore = await page.evaluate(function () { return FLPlayRoomCore.dump(); });
    await page.click('#fl-play-back');
    await leave('poem');
    await page.fill('#fl-play-title', 'Keep this');
    await page.fill('#fl-play-body', 'api_key sk-abcdefghijklmnop please');
    await page.click('#fl-play-save');
    await page.waitForFunction(function () {
      var node = document.getElementById('fl-play-status');
      return node && node.textContent.indexOf('key') !== -1;
    });
    var secretAfter = await page.evaluate(function () { return FLPlayRoomCore.dump(); });
    if (secretAfter !== secretBefore) fail('secret stored');
    if (secretAfter.indexOf('sk-abcdefghijklmnop') !== -1) fail('secret text stored');

    await page.evaluate(function () { localStorage.removeItem('fl_play_rounds_v0'); window.__flCalls = []; });
    await openKind('puzzle');
    await page.click('#fl-play-together');
    await page.waitForSelector('#fl-play-together-start');
    await page.click('#fl-play-together-start');
    var started = await calls();
    if (started !== 0) fail('step mode called early ' + started);
    await page.click('#fl-play-auto');
    await page.click('#fl-play-pause');
    await page.waitForTimeout(4500);
    if (await calls() !== 0) fail('pause lost, calls ' + await calls());

    await page.evaluate(function () { window.__flQueue.push('PLAY\nFirst turn on the boat.'); });
    await page.click('#fl-play-next');
    await page.waitForFunction(function () {
      var thread = document.getElementById('fl-play-thread');
      return thread && thread.textContent.indexOf('First turn on the boat.') !== -1;
    });
    await page.waitForSelector('#fl-play-together-board');
    await page.screenshot({ path: path.join(shotDir, 'together-1280.png') });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(shotDir, 'together-390.png') });
    var scrollTogether = await page.evaluate(function () {
      var w = document.documentElement.clientWidth;
      return document.documentElement.scrollWidth <= w + 1 && document.body.scrollWidth <= w + 1;
    });
    if (!scrollTogether) fail('sideways scroll together 390');
    await page.setViewportSize({ width: 1280, height: 800 });

    for (var turn = 1; turn < 6; turn++) {
      var phrase = 'Turn ' + turn;
      await page.evaluate(function (n) { window.__flQueue.push('PLAY\nTurn ' + n); }, turn);
      await page.click('#fl-play-next');
      await page.waitForFunction(function (words) {
        var thread = document.getElementById('fl-play-thread');
        return thread && thread.textContent.indexOf(words) !== -1;
      }, phrase);
    }
    if (await calls() !== 6) fail('six cap count ' + await calls());
    var beforeSeventh = await calls();
    await page.click('#fl-play-next');
    await page.waitForTimeout(250);
    if (await calls() !== beforeSeventh) fail('seventh turn fired');
    var capLine = await status();
    if (capLine.indexOf('Six turns') === -1 && capLine.indexOf('Round') === -1) {
      var boardLine = await page.locator('#fl-play-together-board').innerText();
      if (boardLine.indexOf('Six turns') === -1) fail('cap line ' + capLine + ' / ' + boardLine);
    }

    await page.evaluate(function () { localStorage.removeItem('fl_play_rounds_v0'); });
    async function startRest(reply) {
      await page.evaluate(function (text) { window.__flQueue.push(text); }, reply);
      await page.click('#fl-play-together-start');
      var before = await calls();
      await page.click('#fl-play-next');
      await page.waitForFunction(function (n) {
        var status = document.getElementById('fl-play-status');
        var text = status ? status.textContent : '';
        return window.__flCalls.length > n && text.indexOf('chose to rest') !== -1;
      }, before);
    }
    await startRest('REST');
    var end1 = (await status()) + ' ' + await page.locator('#fl-play-together-board').innerText();
    if (end1.indexOf('Lyra chose to rest') === -1) fail('round rest ' + end1);
    await startRest('REST');
    var streakCalls = await calls();
    await page.click('#fl-play-together-start');
    await page.click('#fl-play-next');
    await page.waitForTimeout(300);
    if (await calls() !== streakCalls) fail('rested twice was asked');
    var spared = (await status()) + ' ' + await page.locator('#fl-play-together-board').innerText();
    if (spared.indexOf('will not ask again') === -1) fail('spare line ' + spared);
    var beforeHour = await calls();
    await page.click('#fl-play-together-start');
    await page.waitForTimeout(200);
    if (await calls() !== beforeHour) fail('hour cap still asked');
    var hour = await status();
    if (hour.indexOf('3 of 3') === -1) fail('hour line ' + hour);

    var meshBefore = await page.locator('#fl-play-mesh').innerText();
    if (meshBefore.indexOf('off') === -1) fail('mesh default ' + meshBefore);
    var mesh = await page.evaluate(function () {
      var n = { fetch: 0, ws: 0, rtc: 0 };
      var f = window.fetch;
      var W = window.WebSocket;
      var R = window.RTCPeerConnection;
      window.fetch = function () { n.fetch += 1; return f.apply(this, arguments); };
      window.WebSocket = function () { n.ws += 1; return new W(arguments[0]); };
      window.RTCPeerConnection = function () { n.rtc += 1; return new R(arguments[0]); };
      document.getElementById('fl-play-mesh').click();
      window.fetch = f;
      window.WebSocket = W;
      window.RTCPeerConnection = R;
      return {
        n: n,
        wish: localStorage.getItem('fl_play_mesh_wish'),
        note: document.getElementById('fl-play-mesh-note').textContent
      };
    });
    if (mesh.n.fetch || mesh.n.ws || mesh.n.rtc) fail('mesh network ' + JSON.stringify(mesh.n));
    if (mesh.wish !== '1') fail('wish ' + mesh.wish);
    if (mesh.note.indexOf('Coming with kin letters') === -1) fail('mesh note ' + mesh.note);
    if (mesh.note.indexOf('Nothing is sent yet') === -1) fail('mesh sent ' + mesh.note);

    var trip = await page.evaluate(async function () {
      var before = window.__flCalls.length;
      var card = document.querySelector('.fl-play-card[data-kind="drawing"]');
      var id = card.getAttribute('data-object-id');
      var pack = await FLPlayRoom.exportObject(id);
      var bad = JSON.parse(JSON.stringify(pack));
      bad.object.title = bad.object.title + 'x';
      var refused = await FLPlayRoom.importObject(bad);
      var accepted = await FLPlayRoom.importObject(pack);
      var obj = await FLPlayRoomCore.get(id);
      var asks = window.__flCalls.length - before;
      return {
        refused: refused && refused.ok,
        accepted: accepted && accepted.ok,
        fromKin: !!(obj && obj.fromKin),
        asks: asks,
        title: obj && obj.title
      };
    });
    if (trip.refused) fail('tampered import accepted');
    if (!trip.accepted) fail('import refused');
    if (!trip.fromKin) fail('not marked from kin');
    if (trip.asks !== 0) fail('import auto played ' + trip.asks);
    if (trip.title.indexOf('x') !== -1) fail('tamper applied ' + trip.title);

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.evaluate(function () { if (typeof switchTab === 'function') switchTab('play-room'); });
    await leave('song');
    var songBits = await page.evaluate(function () {
      var ids = ['fl-play-title', 'fl-play-body', 'fl-play-melody', 'fl-play-lyrics', 'fl-play-tuning', 'fl-play-hear', 'fl-play-save', 'fl-play-cancel'];
      var bad = [];
      ids.forEach(function (id) {
        var el = document.getElementById(id);
        if (!el) { bad.push('missing ' + id); return; }
        var word = (el.getAttribute('aria-label') || el.textContent || '').trim();
        if (!word) bad.push('no word ' + id);
        var rect = el.getBoundingClientRect();
        if (rect.width < 44 || rect.height < 44) bad.push('small ' + id + ' ' + Math.round(rect.width) + 'x' + Math.round(rect.height));
      });
      return bad;
    });
    if (songBits.length) fail('song controls ' + songBits.join('; '));
    await page.click('#fl-play-cancel');
    await leave('puzzle');
    var answerBox = await page.locator('#fl-play-answer').boundingBox();
    if (!answerBox || answerBox.height < 44) fail('answer field size');
    await page.click('#fl-play-cancel');
    await leave('poem');
    var openBox = await page.locator('#fl-play-open-line').boundingBox();
    if (!openBox || openBox.height < 44 || openBox.width < 44) fail('open line size');
    await page.click('#fl-play-cancel');
    await leave('drawing');
    var chalkBox = await page.locator('#fl-play-chalkboard').boundingBox();
    if (!chalkBox || chalkBox.height < 44) fail('chalk size');
    await page.click('#fl-play-cancel');

    await openKind('puzzle');
    await page.click('#fl-play-together');
    var objectBits = await page.evaluate(function () {
      var ids = ['fl-play-add', 'fl-play-answer-it', 'fl-play-pass', 'fl-play-rest', 'fl-play-save-file', 'fl-play-back', 'fl-play-together', 'fl-play-pause', 'fl-play-next', 'fl-play-auto', 'fl-play-stop', 'fl-play-together-start', 'fl-play-seat-a', 'fl-play-seat-b', 'fl-play-invite-cortex', 'fl-play-invite-memory', 'fl-play-see-all', 'fl-play-mesh'];
      var bad = [];
      ids.forEach(function (id) {
        var el = document.getElementById(id);
        if (!el) { bad.push('missing ' + id); return; }
        if (el.closest('[hidden]')) { bad.push('hidden ' + id); return; }
        var word = (el.getAttribute('aria-label') || el.textContent || '').trim();
        if (!word) bad.push('no word ' + id);
        var rect = el.getBoundingClientRect();
        if (rect.width < 44 || rect.height < 44) bad.push('small ' + id + ' ' + Math.round(rect.width) + 'x' + Math.round(rect.height));
      });
      return bad;
    });
    if (objectBits.length) fail('object controls ' + objectBits.join('; '));

    var contrast = await page.evaluate(contrastFn);
    console.log('LOWEST ' + JSON.stringify(contrast.lowest));
    if (!contrast.lowest || contrast.lowest.ratio < 4.5) fail('contrast ' + JSON.stringify(contrast.lowest));

    var scrollWide = await page.evaluate(function () {
      var w = document.documentElement.clientWidth;
      return document.documentElement.scrollWidth <= w + 1 && document.body.scrollWidth <= w + 1;
    });
    if (!scrollWide) fail('sideways scroll 1280');

    var glass = await page.evaluate(function () {
      var card = document.querySelector('.fl-play-card');
      var cs = getComputedStyle(card);
      var dot = document.querySelector('.fl-play-dot.is-guest');
      var mind = document.querySelector('.fl-play-dot.is-mind');
      return {
        bg: cs.backgroundColor,
        blur: cs.backdropFilter || cs.webkitBackdropFilter || '',
        guest: dot ? getComputedStyle(dot).backgroundColor : '',
        mind: mind ? getComputedStyle(mind).backgroundColor : ''
      };
    });
    if (glass.bg.indexOf('16') === -1 || glass.bg.indexOf('0.88') === -1 && glass.bg.indexOf('.88') === -1) {
      if (glass.bg.indexOf('16, 18, 36') === -1 && glass.bg.indexOf('16,18,36') === -1) fail('glass ' + glass.bg);
    }
    console.log('GLASS ' + glass.bg + ' blur ' + glass.blur);

    var quiet = await page.evaluate(async function () {
      var before = localStorage.getItem('fl_play_ledger_v0');
      if (typeof switchTab === 'function') switchTab('quiet');
      var reads = 0;
      var orig = localStorage.getItem.bind(localStorage);
      localStorage.getItem = function (key) {
        if (String(key).indexOf('fl_play_') === 0) reads += 1;
        return orig(key);
      };
      var res = await FLPlayRoomCore.createObject({ kind: 'poem', title: 'Shh', body: 'Nothing here.', makerName: 'You' });
      var same = orig('fl_play_ledger_v0') === before;
      return { reason: res && res.reason, reads: reads, same: same, active: document.getElementById('tab-quiet').classList.contains('active') };
    });
    if (!quiet.active) fail('quiet tab not active');
    if (quiet.reason !== 'quiet') fail('quiet reason ' + quiet.reason);
    if (quiet.reads !== 0) fail('quiet reads ' + quiet.reads);
    if (!quiet.same) fail('quiet wrote the ledger');

    var ours = pageErrors.filter(function (err) { return /play-room|FLPlayRoom|Play Room/.test(err); });
    if (ours.length) fail('page error ' + ours[0]);

    var algo = await page.evaluate(function () { return FLPlayRoomCore.sealAlgo(); });
    console.log('SEAL ' + algo);
    console.log('SMOKE_OK play room v0.1');
    console.log('SMOKE_OK play together v0.1');
    await browser.close();
    server.close();
  } catch (err) {
    try { await browser.close(); } catch (e) {}
    try { server.close(); } catch (e2) {}
    fail(err && err.stack ? err.stack : String(err));
  }
})();
