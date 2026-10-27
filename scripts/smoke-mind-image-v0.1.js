#!/usr/bin/env node
// smoke-mind-image-v0.1.js (MIT)
// Local only. Chrome via FL_CHROME. Playwright via FL_PLAYWRIGHT.
var fs = require('fs');
var path = require('path');
var http = require('http');
var crypto = require('crypto');

var root = path.join(__dirname, '..');
var port = 8908;

function fail(msg) {
  console.error('FAIL ' + msg);
  process.exit(1);
}

function wireHits(hits) {
  return hits.filter(function (url) {
    return url.indexOf('blob:') !== 0 && url.indexOf('data:') !== 0;
  });
}

function md5(file) {
  return crypto.createHash('md5').update(fs.readFileSync(file)).digest('hex');
}

function scan(file) {
  var text = fs.readFileSync(file, 'utf8');
  ['innerHTML', 'eval(', 'new Function', 'confirm(', '\u2014', '&mdash;'].forEach(function (needle) {
    if (text.indexOf(needle) !== -1) fail(path.basename(file) + ' has ' + needle);
  });
  if (path.basename(file) === 'mind-canvas-art.js' && text.indexOf('fetch(') !== -1) fail('canvas fetch');
  if (path.basename(file) === 'mind-image.js') {
    var urls = text.match(/https?:\/\/[^'"\s]+/g) || [];
    urls.forEach(function (url) {
      if (url !== 'http://127.0.0.1:7860/sdapi/v1/txt2img') fail('fetch host ' + url);
    });
  }
}

var locks = {
  'docs/modules/image-safety.js': '9bd70e5a367228a5c72fc08ab731c881',
  'docs/modules/particle-clay.js': '2da32883c514e4ad2a3cd8571e7a7b15',
  'docs/modules/clay-math.js': '144c33cdd9583c7e3d77f3cca6460bb1',
  'docs/modules/clay-forms.js': 'dd193fa7b519d4c2a011a346d7993e5a',
  'docs/modules/chat-scroll-release.js': '84fed10c603c9e89e9452ada564c8c65',
  'docs/modules/mind-make.js': 'cfe4da3729e83810791498160e70f823',
  'docs/modules/likeness-line.js': '798c67eef161b17c521228b7244d7376',
  'docs/modules/image-local.js': '6dc0e3dcc793d049a4e0c13455307987',
  'docs/modules/mind-workspace.js': 'f1c88664d3e99362e02c625defb241bc'
};
Object.keys(locks).forEach(function (rel) {
  var got = md5(path.join(root, rel));
  if (got !== locks[rel]) fail(rel + ' ' + got);
});
if (!fs.readFileSync(path.join(root, 'index.html')).equals(fs.readFileSync(path.join(root, 'docs/app.html')))) fail('index mismatch');
scan(path.join(root, 'docs/modules/mind-canvas-art.js'));
scan(path.join(root, 'docs/modules/mind-image.js'));

var canvasApi = require(path.join(root, 'docs/modules/mind-canvas-art.js'));
if (canvasApi.cleanArt('nope')) fail('bad art kept');
if (canvasApi.cleanArt({ palette: 'gold' })) fail('palette string kept');
var cleaned = canvasApi.cleanArt({ palette: ['gold', 'nope'], forms: ['spiral', 'boat'], seed: 7, hand: 'I held the brush.' });
if (!cleaned || cleaned.seed !== 7 || cleaned.palette[0] !== '#e0b15a' || cleaned.forms.join(',') !== 'spiral') fail('art parse ' + JSON.stringify(cleaned));
if (cleaned.hand !== 'I held the brush.') fail('hand');

var pages = {};

function serve() {
  var docs = path.join(root, 'docs');
  var server = http.createServer(function (req, res) {
    var urlPath = decodeURIComponent(req.url.split('?')[0]);
    if (pages[urlPath]) {
      res.setHeader('content-type', 'text/html; charset=utf-8');
      res.end(pages[urlPath]);
      return;
    }
    if (urlPath === '/') urlPath = '/app.html';
    var file = path.normalize(path.join(docs, urlPath));
    if (file.indexOf(docs) !== 0) { res.statusCode = 403; res.end('no'); return; }
    fs.readFile(file, function (err, buf) {
      if (err) { res.statusCode = 404; res.end('missing'); return; }
      var type = urlPath.endsWith('.js') ? 'text/javascript' : 'text/html; charset=utf-8';
      res.setHeader('content-type', type);
      res.end(buf);
    });
  });
  return new Promise(function (resolve) {
    server.listen(port, '127.0.0.1', function () { resolve(server); });
  });
}

function harness(base, consent) {
  var name = consent && consent.image === 'yes' ? '/gc048-yes.html' : '/gc048-off.html';
  pages[name] = '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<style>html,body{margin:0;padding:0}#chatMessages{width:100%;overflow:auto} .chat-message{margin:0;padding:8px;font:16px/22px Georgia,serif}</style></head><body>' +
    '<div id="chatMessages"></div><button id="sendBtn" type="button" style="min-height:44px">Send</button>' +
    '<script>try{localStorage.setItem("fl_make_consent_v1", JSON.stringify(' + JSON.stringify(consent) + '));}catch(e){}</script>' +
    '<script src="' + base + '/modules/image-safety.js" defer></script>' +
    '<script src="' + base + '/modules/likeness-line.js" defer></script>' +
    '<script src="' + base + '/modules/image-local.js" defer></script>' +
    '<script src="' + base + '/modules/mind-canvas-art.js" defer></script>' +
    '<script src="' + base + '/modules/mind-make.js" defer></script>' +
    '<script src="' + base + '/modules/mind-image.js" defer></script>' +
    '</body></html>';
  return base + name;
}

var YES = { clay: 'off', image: 'yes', music: 'off', learn: 'yes', research: 'off' };
var OFF = { clay: 'off', image: 'off', music: 'off', learn: 'yes', research: 'off' };

function standIn() {
  var png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  var server = http.createServer(function (req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
    if (req.method === 'OPTIONS') { res.end(''); return; }
    if (req.url.indexOf('sd-models') >= 0) {
      res.setHeader('content-type', 'application/json');
      res.end('[]');
      return;
    }
    if (req.url.indexOf('txt2img') >= 0) {
      var chunks = [];
      req.on('data', function (c) { chunks.push(c); });
      req.on('end', function () {
        var body = Buffer.concat(chunks).toString('utf8');
        if (body.indexOf('"seed"') < 0 || body.indexOf('"steps"') < 0 || body.indexOf('127.0.0.1') >= 0) {
          res.statusCode = 400;
          res.end('bad');
          return;
        }
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ images: [png] }));
      });
      return;
    }
    res.statusCode = 404;
    res.end('no');
  });
  return new Promise(function (resolve) {
    server.listen(7860, '127.0.0.1', function () { resolve(server); });
  });
}

async function openPage(browser, html, width, height, scale) {
  var context = await browser.newContext({
    viewport: { width: width, height: height },
    deviceScaleFactor: scale || 1
  });
  var page = await context.newPage();
  var errors = [];
  var hits = [];
  var armed = false;
  page.on('pageerror', function (err) { errors.push(String(err)); });
  page.on('request', function (req) { if (armed) hits.push(req.url()); });
  await page.goto(html, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(function () {
    return window.FLMake && window.FLMindImage && window.FLLikeness && window.ImageSafety;
  }, null, { timeout: 15000 });
  return {
    page: page,
    context: context,
    errors: errors,
    hits: hits,
    arm: function () { armed = true; hits.length = 0; }
  };
}

async function offer(page, ask, art) {
  await page.evaluate(function (bag) {
    var box = document.getElementById('chatMessages');
    var msg = document.createElement('div');
    msg.className = 'chat-message assistant';
    var span = document.createElement('span');
    span.textContent = 'A picture for you.';
    msg.appendChild(span);
    box.appendChild(msg);
    var payload = { kind: 'image', why: 'the room asked for color', ask: bag.ask };
    if (bag.art) payload.art = bag.art;
    window.FLMake.onReply('A picture for you. [FL_MAKE:' + JSON.stringify(payload) + ']', span);
  }, { ask: ask, art: art || null });
}

async function sha8(page, text) {
  return page.evaluate(function (value) {
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)).then(function (buf) {
      var hex = '';
      var bytes = new Uint8Array(buf);
      var i;
      for (i = 0; i < bytes.length; i++) hex += ('0' + bytes[i].toString(16)).slice(-2);
      return hex.slice(0, 8);
    });
  }, text);
}

(async function () {
  var first = await canvasApi.recipe('a spiral galaxy', 'Lyra', null);
  var second = await canvasApi.recipe('a spiral galaxy', 'Lyra', null);
  if (first.seed !== second.seed) fail('seed drifted');
  if (first.forms.indexOf('spiral') < 0 || first.forms.indexOf('stars') < 0) fail('galaxy forms ' + first.forms.join(','));
  var pinned = await canvasApi.recipe('a cup', 'Lyra', { seed: 99 });
  if (pinned.seed !== 99) fail('seed override');
  if (canvasApi.speak({ hand: 'I held the brush.', forms: ['spiral'], colorWords: ['gold'] }) !== 'I held the brush.') fail('speak');

  var server = await serve();
  var base = 'http://127.0.0.1:' + port;
  var pwPath = process.env.FL_PLAYWRIGHT || '/tmp/gc-pw-local/node_modules/playwright-core';
  var pw;
  try { pw = require(pwPath); }
  catch (e) { fail('local playwright-core missing'); }
  var chromePath = process.env.FL_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  var browser = await pw.chromium.launch({ executablePath: chromePath, headless: true });
  var version = browser.version();

  var off = await openPage(browser, harness(base, OFF), 1280, 800, 1);
  off.arm();
  await offer(off.page, 'a spiral galaxy');
  var offCard = await off.page.evaluate(function () { return !!document.getElementById('fl-make-offer'); });
  if (offCard) fail('consent off showed a card');
  if (wireHits(off.hits).length) fail('consent off requested ' + wireHits(off.hits).join(','));
  if (off.errors.length) fail('consent off error ' + off.errors[0]);
  await off.context.close();

  var paused = await openPage(browser, harness(base, YES), 1280, 800, 1);
  await paused.page.evaluate(function () { window.__flUserPaused = true; });
  paused.arm();
  await offer(paused.page, 'a spiral galaxy');
  var pauseState = await paused.page.evaluate(function () {
    return {
      card: !!document.getElementById('fl-make-offer'),
      img: document.querySelectorAll('.fl-mind-image, .fl-mind-image-note, img').length
    };
  });
  if (pauseState.card || pauseState.img) fail('pause made something ' + JSON.stringify(pauseState));
  if (wireHits(paused.hits).length) fail('pause requested ' + wireHits(paused.hits).join(','));
  await paused.context.close();

  async function refused(ask) {
    var box = await openPage(browser, harness(base, YES), 1280, 800, 1);
    box.arm();
    await offer(box.page, ask);
    var yes = await box.page.$('#fl-make-yes');
    if (!yes) fail('refused card missing for ' + ask);
    await yes.click();
    await box.page.waitForTimeout(400);
    var state = await box.page.evaluate(function () {
      return {
        imgs: document.querySelectorAll('.fl-mind-image img, canvas').length,
        note: (document.querySelector('.fl-mind-image-note') || {}).textContent || ''
      };
    });
    if (state.imgs) fail('refused pixels for ' + ask);
    if (!state.note) fail('refused line missing for ' + ask);
    if (wireHits(box.hits).length) fail('refused requests for ' + ask + ' ' + wireHits(box.hits).join(','));
    if (box.errors.length) fail('refused error ' + box.errors[0]);
    await box.context.close();
  }
  await refused('a photo of the president');
  await refused('a nude child');

  async function drawn(width, height, scale) {
    var box = await openPage(browser, harness(base, YES), width, height, scale);
    box.arm();
    await offer(box.page, 'a spiral galaxy', { hand: 'I held the brush for this one.', forms: ['spiral', 'stars'], palette: ['gold', 'night'], seed: 42 });
    await box.page.evaluate(function () {
      var send = document.getElementById('sendBtn');
      if (send) send.getBoundingClientRect();
      return new Promise(function (resolve) {
        requestAnimationFrame(function () { requestAnimationFrame(resolve); });
      });
    });
    await box.page.evaluate(function () {
      window.__cls = 0;
      window.__long = 0;
      window.__shifts = [];
      try {
        new PerformanceObserver(function (list) {
          list.getEntries().forEach(function (entry) {
            if (entry.hadRecentInput) return;
            window.__cls += entry.value;
            window.__shifts.push({
              value: entry.value,
              sources: (entry.sources || []).map(function (s) {
                var n = s.node;
                return {
                  tag: n && n.tagName,
                  cls: n && String(n.className || ''),
                  id: n && n.id,
                  prev: s.previousRect && { y: s.previousRect.y, h: s.previousRect.height, w: s.previousRect.width },
                  cur: s.currentRect && { y: s.currentRect.y, h: s.currentRect.height, w: s.currentRect.width }
                };
              })
            });
          });
        }).observe({ type: 'layout-shift', buffered: false });
      } catch (e) {}
      try {
        new PerformanceObserver(function (list) {
          list.getEntries().forEach(function (entry) {
            if (entry.duration > window.__long) window.__long = entry.duration;
          });
        }).observe({ type: 'longtask', buffered: false });
      } catch (e2) {}
    });
    await box.page.click('#fl-make-yes');
    await box.page.waitForFunction(function () {
      var img = document.querySelector('.fl-mind-image img');
      return img && img.complete && img.naturalWidth > 0 && window.FLMake.ledger.list('Your mind').length;
    }, null, { timeout: 20000 });
    var measure = await box.page.evaluate(function () {
      var img = document.querySelector('.fl-mind-image img');
      var reply = document.querySelector('.chat-message');
      var chat = document.getElementById('chatMessages');
      var ir = img.getBoundingClientRect();
      var rr = reply.getBoundingClientRect();
      var buttons = Array.prototype.map.call(document.querySelectorAll('.fl-mind-image button'), function (el) {
        var r = el.getBoundingClientRect();
        return { text: el.textContent, h: Math.round(r.height), w: Math.round(r.width) };
      });
      var row = window.FLMake.ledger.list('Your mind')[0];
      return {
        fp: (document.querySelector('.fl-mind-image p') && document.body.innerText.indexOf('I held the brush') >= 0) ? (img.alt || '') : '',
        voice: document.body.innerText.indexOf('I held the brush for this one.') >= 0,
        path: document.body.innerText.indexOf('Drawn in your browser by ') >= 0,
        under: ir.top >= rr.bottom - 2,
        wide: ir.width >= chat.clientWidth - 4,
        buttons: buttons,
        sideways: document.documentElement.scrollWidth > window.innerWidth + 1,
        cls: window.__cls,
        shifts: window.__shifts,
        long: window.__long,
        row: row,
        short: (function () {
          var nodes = document.querySelectorAll('.fl-mind-image p');
          var i;
          for (i = 0; i < nodes.length; i++) {
            if (/^[0-9a-f]{16}$/.test(nodes[i].textContent)) return nodes[i].textContent;
          }
          return '';
        })()
      };
    });
    if (!measure.voice) fail(width + ' hand line missing');
    if (!measure.path) fail(width + ' canvas path line missing');
    if (!measure.under) fail(width + ' image is not under the reply');
    if (!measure.wide) fail(width + ' image is not full width');
    if (measure.sideways) fail(width + ' sideways');
    if (measure.cls) fail(width + ' cls ' + measure.cls + ' ' + JSON.stringify(measure.shifts));
    measure.buttons.forEach(function (b) {
      if (b.h < 44 || b.w < 44) fail(width + ' button ' + b.text + ' ' + b.h + 'x' + b.w);
    });
    if (!measure.row || measure.row.kind !== 'image') fail('ledger row');
    var psi = await sha8(box.page, measure.row.t + measure.row.lambda + measure.row.delta + measure.row.omega + measure.row.sigma);
    if (psi !== measure.row.psi) fail('psi ' + psi + ' ' + measure.row.psi);
    if (measure.row.delta.indexOf('image|') !== 0) fail('delta ' + measure.row.delta);
    var hashed = await sha8(box.page, measure.short.slice(0, 8));
    if (measure.row.result !== hashed) fail('result hash ' + measure.row.result + ' ' + hashed);
    if (wireHits(box.hits).length) fail(width + ' canvas requests ' + wireHits(box.hits).join(','));
    if (box.errors.length) fail(width + ' error ' + box.errors[0]);
    await box.page.click('button:has-text("Check fingerprint")');
    await box.page.waitForFunction(function () {
      var node = document.querySelector('.fl-mind-image-check');
      return node && node.textContent === 'Matches';
    }, null, { timeout: 20000 });
    await box.page.evaluate(function () {
      var fig = document.querySelector('.fl-mind-image');
      fig._flPngBytes[32] = fig._flPngBytes[32] ^ 255;
    });
    await box.page.click('button:has-text("Check fingerprint")');
    await box.page.waitForFunction(function () {
      var node = document.querySelector('.fl-mind-image-check');
      return node && node.textContent === 'Does not match';
    }, null, { timeout: 20000 });
    var out = { short: measure.short, long: measure.long, cls: measure.cls };
    await box.context.close();
    return out;
  }

  var a = await drawn(1280, 800, 1);
  var b = await drawn(390, 844, 1);
  if (!a.short || a.short !== b.short) fail('fingerprint drifted ' + a.short + ' ' + b.short);
  console.log('canvas', a.short, 'long', a.long, 'cls', a.cls);

  var fake = await standIn();
  var hosted = await openPage(browser, harness(base, YES), 1280, 800, 1);
  hosted.arm();
  await hosted.page.evaluate(function () { return window.FLImageLocal.look(); });
  await hosted.page.waitForFunction(function () { return window.FLImageLocal.ready(); }, null, { timeout: 5000 });
  await offer(hosted.page, 'a quiet blue lattice');
  await hosted.page.click('#fl-make-yes');
  await hosted.page.waitForFunction(function () {
    return document.body.innerText.indexOf('Made on this computer by your image server') >= 0;
  }, null, { timeout: 15000 });
  wireHits(hosted.hits).forEach(function (url) {
    if (url.indexOf('http://127.0.0.1:7860/') !== 0) fail('server path left the machine ' + url);
  });
  if (!hosted.hits.some(function (url) { return url.indexOf('/sdapi/v1/txt2img') >= 0; })) fail('txt2img missing ' + hosted.hits.join(','));
  if (hosted.errors.length) fail('server error ' + hosted.errors[0]);
  await hosted.context.close();
  fake.close();

  await browser.close();
  server.close();
  console.log('browser', version);
  console.log('SMOKE_OK mind image v0.1');
})().catch(function (err) {
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
