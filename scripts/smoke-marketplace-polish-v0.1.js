#!/usr/bin/env node
// smoke-marketplace-polish-v0.1.js (MIT)
// Local node, plus Playwright with a local Chrome.
// Prints SMOKE_OK marketplace polish v0.1.
'use strict';

var fs = require('fs');
var path = require('path');
var crypto = require('crypto');
var http = require('http');
var vm = require('vm');

var repo = path.resolve(__dirname, '..');
var failed = 0;
var isFL = fs.existsSync(path.join(repo, 'docs/app.html'));

function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.log('FAIL ' + msg);
  }
}
function md5(buf) { return crypto.createHash('md5').update(buf).digest('hex'); }
function pin(rel, expect) {
  var file = path.join(repo, rel);
  if (!fs.existsSync(file)) {
    console.log('absent ' + rel);
    return;
  }
  var got = md5(fs.readFileSync(file));
  assert(got === expect, rel + ' md5 ' + got);
}

pin('docs/modules/image-safety.js', '9bd70e5a367228a5c72fc08ab731c881');
pin('docs/modules/particle-clay.js', '2da32883c514e4ad2a3cd8571e7a7b15');
pin('docs/modules/clay-math.js', '144c33cdd9583c7e3d77f3cca6460bb1');
pin('docs/modules/clay-forms.js', 'dd193fa7b519d4c2a011a346d7993e5a');
pin('docs/modules/mind-workspace.js', 'f1c88664d3e99362e02c625defb241bc');
pin('docs/modules/science-garden.js', '1a39db357b382dd78aae3d6fe1d65df2');
pin('docs/modules/science-garden-seeds.js', '16ec68f1dda16dd61364d821a346f01b');
if (isFL) {
  pin('docs/modules/chat-scroll-release.js', '84fed10c603c9e89e9452ada564c8c65');
  pin('docs/modules/mind-make.js', 'cfe4da3729e83810791498160e70f823');
  var appBuf = fs.readFileSync(path.join(repo, 'docs/app.html'));
  var indexBuf = fs.readFileSync(path.join(repo, 'index.html'));
  assert(appBuf.equals(indexBuf), 'index.html == docs/app.html');
}

var css = fs.readFileSync(path.join(repo, 'docs/modules/card-glow.css'));
var js = fs.readFileSync(path.join(repo, 'docs/modules/market-attach.js'));
console.log('card-glow.css md5 ' + md5(css));
console.log('market-attach.js md5 ' + md5(js));

function twin(rel) {
  var self = path.resolve(repo, rel);
  var roots = [process.env.FL_TWIN_ROOT, '/tmp/tree-market-048m', '/tmp/fl-market-048m', '/Users/kirkmiller/FreeLattice-fresh', '/Users/kirkmiller/FreeLattice-Alpha'];
  var i;
  for (i = 0; i < roots.length; i++) {
    if (!roots[i]) continue;
    var p = path.resolve(roots[i], rel);
    if (p !== self && fs.existsSync(p)) return p;
  }
  return '';
}
['docs/modules/card-glow.css', 'docs/modules/market-attach.js'].forEach(function (rel) {
  var other = twin(rel);
  if (!other) {
    console.log('NOTE twin missing for ' + rel);
    return;
  }
  assert(fs.readFileSync(other).equals(fs.readFileSync(path.join(repo, rel))), rel + ' FL == Tree');
  console.log('twin match ' + rel);
});

['innerHTML', 'eval(', 'new Function', 'confirm(', '\u2014', '&mdash;', 'fetch(', 'WebSocket', 'XMLHttpRequest'].forEach(function (bad) {
  assert(js.indexOf(bad) === -1 && css.indexOf(bad) === -1, 'added file contains ' + bad);
});
assert(css.indexOf('prefers-reduced-motion: reduce') !== -1, 'reduced motion');
assert(css.indexOf('translateY(-2px)') !== -1, 'lift is 2px');
assert(css.indexOf('200ms ease-out') !== -1, 'motion timing');
assert(js.indexOf('Add a picture this mind made') !== -1, 'button words');
assert(js.indexOf('This mind has not made a picture yet.') !== -1, 'empty line');
assert(js.indexOf('http://') === -1 && js.indexOf('https://') === -1, 'no url in market-attach');

var store = {};
var sandbox = {
  console: console,
  atob: atob,
  btoa: btoa,
  crypto: crypto.webcrypto || globalThis.crypto,
  Uint8Array: Uint8Array,
  Promise: Promise,
  Blob: typeof Blob !== 'undefined' ? Blob : function () {},
  URL: { createObjectURL: function () { return ''; }, revokeObjectURL: function () {} },
  document: null,
  localStorage: {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
    setItem: function (k, v) { store[k] = String(v); }
  }
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(js.toString('utf8'), sandbox, { filename: 'market-attach.js' });
var M = sandbox.FLMarketAttach;
assert(M && M.version === 'v0.1', 'version');

function b64(bytes) {
  var s = '';
  var i;
  for (i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}
function makeRec(bytes, hash, extra) {
  var rec = { madeBy: 'mind', mindFp: 'mind-lyra', bytes: b64(bytes), byteHash: hash };
  if (extra) Object.keys(extra).forEach(function (k) { rec[k] = extra[k]; });
  return rec;
}

(async function () {
  var samples = [
    new Uint8Array([1, 2, 3, 4]),
    new Uint8Array([5, 6, 7, 8]),
    new Uint8Array([9, 10, 11, 12]),
    new Uint8Array([13, 14, 15, 16])
  ];
  var hashes = [];
  var i;
  for (i = 0; i < samples.length; i++) {
    var buf = await crypto.webcrypto.subtle.digest('SHA-256', samples[i]);
    var hex = '';
    var arr = new Uint8Array(buf);
    var j;
    for (j = 0; j < arr.length; j++) hex += ('0' + arr[j].toString(16)).slice(-2);
    hashes.push(hex);
  }
  var records = samples.map(function (bytes, n) { return makeRec(bytes, hashes[n]); });
  records.push(makeRec(samples[0], 'deadbeef', { madeBy: 'mind' }));
  records.push({ madeBy: 'person', personFp: 'person-1', bytes: b64(samples[0]), byteHash: hashes[0] });
  store.fl_image_records = JSON.stringify(records);
  var shown = M.forMind('mind-lyra');
  assert(shown.length === 5, 'picker lists mind records including a tampered one, not a person picture (' + shown.length + ')');
  assert(M.forMind('mind-lyra').every(function (rec) { return rec.madeBy !== 'person'; }), 'person pictures stay out');

  var bad = await M.attach('local', records[4], 'Lyra');
  assert(bad && bad.ok === false && bad.line === M.LINE_BAD, 'tampered record refused');
  var n;
  for (n = 0; n < 3; n++) {
    var ok = await M.attach('local', records[n], 'Lyra');
    assert(ok && ok.ok === true, 'attach ' + n);
    assert(ok.fp16 === hashes[n].slice(0, 16), 'fingerprint ' + n);
  }
  var cap = await M.attach('local', records[3], 'Lyra');
  assert(cap && cap.ok === false && cap.line === M.LINE_CAP, 'cap at 3');
  var payload = M.sharePayload('local');
  assert(payload.length === 3, 'share count');
  payload.forEach(function (row) {
    assert(Object.keys(row).sort().join(',') === 'fp,thumb', 'share carries only fp and thumb');
    assert(row.fp.length === 16, 'fp16');
  });
  var kept = store.fl_image_records;
  M.remove('local', hashes[0].slice(0, 16));
  assert(store.fl_image_records === kept, 'remove does not delete the record');
  assert(M.offerList('local').length === 2, 'one attachment removed');
  var rawOffer = store.fl_market_attach_v1 || '';
  assert(rawOffer.indexOf('prompt') === -1, 'offer store has no prompt');
  console.log('node attach ok');

  var pwPath = process.env.FL_PLAYWRIGHT || '/tmp/gc-pw-local/node_modules/playwright-core';
  var chrome = process.env.FL_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  var pw;
  try { pw = require(pwPath); }
  catch (e) { assert(false, 'local playwright-core missing'); finish(); return; }

  var docs = path.join(repo, 'docs');
  var port = Number(process.env.FL_PORT || (isFL ? 8894 : 8895));
  var server = http.createServer(function (req, res) {
    var u = decodeURIComponent((req.url || '/').split('?')[0]);
    if (u === '/') u = isFL ? '/science-garden.html' : '/marketplace.html';
    var file = path.normalize(path.join(docs, u));
    if (file.indexOf(docs) !== 0) { res.writeHead(403); res.end('no'); return; }
    fs.readFile(file, function (err, buf) {
      if (err) { res.writeHead(404); res.end('missing'); return; }
      var ext = path.extname(file);
      var type = ext === '.css' ? 'text/css' : (ext === '.js' ? 'text/javascript' : (ext === '.png' ? 'image/png' : 'text/html; charset=utf-8'));
      res.writeHead(200, { 'content-type': type, 'cache-control': 'no-store' });
      res.end(buf);
    });
  });
  await new Promise(function (resolve) { server.listen(port, '127.0.0.1', resolve); });
  var base = 'http://127.0.0.1:' + port;
  var shotDir = '/tmp/gc048m-shots';
  fs.mkdirSync(shotDir, { recursive: true });
  var browser = await pw.chromium.launch({ executablePath: chrome, headless: true });

  async function openPage(reduced, size, url) {
    var context = await browser.newContext({
      viewport: { width: size.w, height: size.h },
      deviceScaleFactor: size.dpr || 1,
      reducedMotion: reduced ? 'reduce' : 'no-preference',
      serviceWorkers: 'block'
    });
    var page = await context.newPage();
    var errors = [];
    page.on('pageerror', function (err) { errors.push(String(err && err.message || err)); });
    await page.addInitScript(function () {
      try {
        localStorage.setItem('fl-has-visited', '1');
        localStorage.setItem('fl-last-tab', 'chat');
      } catch (e) {}
      window.__cls = 0;
      window.__long = 0;
      try {
        new PerformanceObserver(function (list) {
          list.getEntries().forEach(function (e) { if (!e.hadRecentInput) window.__cls += e.value; });
        }).observe({ type: 'layout-shift', buffered: true });
      } catch (e2) {}
      try {
        new PerformanceObserver(function (list) {
          list.getEntries().forEach(function (e) { if (e.duration > window.__long) window.__long = e.duration; });
        }).observe({ type: 'longtask', buffered: true });
      } catch (e3) {}
    });
    await page.goto(base + url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(400);
    return { context: context, page: page, errors: errors };
  }

  function cardAnimCount(page) {
    return page.evaluate(function () {
      var running = 0;
      var nodes = document.querySelectorAll('.stalls, .bank, .sg-seed, .card, .market-stall-link, .fl-market-offer');
      nodes.forEach(function (node) {
        var style = getComputedStyle(node);
        var dur = style.transitionDuration || '';
        var anim = style.animationName || '';
        if (dur && dur !== '0s' && style.transitionProperty !== 'none') running += 1;
        if (anim && anim !== 'none') running += 1;
      });
      var live = 0;
      if (document.getAnimations) {
        document.getAnimations().forEach(function (a) {
          var el = a.effect && a.effect.target;
          if (!el || !el.closest) return;
          if (el.closest('.stalls, .bank, .sg-seed, .card, .market-stall-link, .fl-market-offer, #sg-beds')) {
            if (a.playState === 'running') live += 1;
          }
        });
      }
      return { marked: running, live: live };
    });
  }

  async function measure(reduced, size, url, name) {
    var opened = await openPage(reduced, size, url);
    var page = opened.page;
    if (url.indexOf('app.html') !== -1) {
      var toggle = page.locator('#chatMarketToggle');
      if (await toggle.count()) await toggle.click();
      await page.waitForTimeout(200);
    }
    var box = await page.evaluate(function () {
      var root = document.documentElement;
      var selectors = ['.sg-offer', '.sg-look', '.market-stall-link', '.fl-market-attach-btn', '.stalls a', '.tend a', '.fl-market-offer button'];
      var buttons = [];
      selectors.forEach(function (sel) {
        document.querySelectorAll(sel).forEach(function (el) {
          var r = el.getBoundingClientRect();
          if (r.width < 1 || r.height < 1) return;
          buttons.push({ sel: sel, w: Math.round(r.width), h: Math.round(r.height), text: (el.textContent || '').trim().slice(0, 40) });
        });
      });
      var focus = null;
      var link = document.querySelector('.sg-offer, .sg-look, .market-stall-link, .stalls a, .fl-market-attach-btn');
      if (link && link.focus) {
        link.focus();
        var s = getComputedStyle(link);
        focus = { width: s.outlineWidth, style: s.outlineStyle, color: s.outlineColor };
      }
      return {
        scroll: root.scrollWidth - root.clientWidth,
        cls: window.__cls || 0,
        long: window.__long || 0,
        buttons: buttons,
        focus: focus,
        texts: {
          grove: document.body.innerText.indexOf('Gift Grove') !== -1,
          garden: document.body.innerText.indexOf('Science Garden') !== -1,
          ring: document.body.innerText.indexOf('Exchange Ring') !== -1
        }
      };
    });
    box.buttons.forEach(function (b) {
      assert(b.h >= 44 && b.w >= 44, name + ' button ' + b.text + ' ' + b.w + 'x' + b.h);
    });
    var anim = await cardAnimCount(page);
    if (reduced) assert(anim.live === 0 && anim.marked === 0, name + ' reduced motion still has ' + anim.live + '/' + anim.marked);
    console.log(name + ' cls ' + box.cls + ' long ' + box.long + ' scroll ' + box.scroll + ' buttons ' + box.buttons.length + ' anim ' + anim.live);
    assert(box.scroll <= 1, name + ' sideways scroll ' + box.scroll);
    if (url.indexOf('science-garden') !== -1 || url.indexOf('marketplace') !== -1) {
      assert(box.cls === 0, name + ' CLS ' + box.cls);
    } else {
      console.log('NOTE ' + name + ' page CLS ' + box.cls + ' (reported, not a card jump)');
    }
    if (box.focus) assert(parseFloat(box.focus.width) >= 2, name + ' focus ring ' + box.focus.width);
    var tag = (isFL ? 'fl' : 'tree') + '-' + name;
    var before = path.join('/tmp/gc048m-shots', tag + '-before.png');
    var after = path.join('/tmp/gc048m-shots', tag + '-after.png');
    var link = page.locator('link[href="modules/card-glow.css"]');
    if (await link.count()) {
      await link.evaluate(function (el) { el.disabled = true; });
      await page.waitForTimeout(50);
      var scrollOff = await page.evaluate(function () { return document.documentElement.scrollWidth - document.documentElement.clientWidth; });
      await page.screenshot({ path: before, fullPage: false });
      await link.evaluate(function (el) { el.disabled = false; });
      await page.waitForTimeout(50);
      var scrollOn = await page.evaluate(function () { return document.documentElement.scrollWidth - document.documentElement.clientWidth; });
      assert(scrollOn <= Math.max(1, scrollOff), name + ' glow added sideways scroll');
    }
    await page.screenshot({ path: after, fullPage: false });
    opened.errors.forEach(function (msg) {
      if (/market-attach|card-glow|FLMarketAttach/.test(msg)) assert(false, name + ' page error ' + msg);
      else console.log('NOTE page error ' + name + ' ' + msg.slice(0, 180));
    });
    await opened.context.close();
    return { before: before, after: after, texts: box.texts };
  }

  var sizes = [
    { w: 1280, h: 800, dpr: 1, name: '1280' },
    { w: 390, h: 844, dpr: 1, name: '390' },
    { w: 640, h: 400, dpr: 2, name: '640x2' }
  ];
  var pages = isFL ? ['/science-garden.html', '/app.html'] : ['/marketplace.html', '/code-garden.html'];
  var s;
  var p;
  for (s = 0; s < sizes.length; s++) {
    for (p = 0; p < pages.length; p++) {
      var label = sizes[s].name + pages[p].replace(/\W+/g, '');
      await measure(false, sizes[s], pages[p], label);
      await measure(true, sizes[s], pages[p], label + '-still');
    }
  }

  var quietUrl = isFL ? '/science-garden.html' : '/marketplace.html';
  var attachCtx = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' });
  var attachPage = await attachCtx.newPage();
  var hits = [];
  attachPage.on('request', function (req) { hits.push(req.url()); });
  await attachPage.goto(base + quietUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  var beforeCount = hits.length;
  var attachResult = await attachPage.evaluate(async function () {
    var host = document.getElementById('fl-market-attach-host');
    host.setAttribute('data-mind-fp', 'mind-lyra');
    function png(color) {
      var canvas = document.createElement('canvas');
      canvas.width = color === '#123456' ? 300 : 20;
      canvas.height = color === '#123456' ? 280 : 20;
      var ctx = canvas.getContext('2d');
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/png');
    }
    async function pack(dataUrl, extra) {
      var b64 = dataUrl.split(',')[1];
      var bin = atob(b64);
      var bytes = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      var buf = await crypto.subtle.digest('SHA-256', bytes);
      var hex = '';
      var arr = new Uint8Array(buf);
      for (var j = 0; j < arr.length; j++) hex += ('0' + arr[j].toString(16)).slice(-2);
      var rec = { madeBy: 'mind', mindFp: 'mind-lyra', bytes: b64, byteHash: hex };
      if (extra) Object.keys(extra).forEach(function (k) { rec[k] = extra[k]; });
      return rec;
    }
    var colors = ['#123456', '#224466', '#668822', '#882266'];
    var recs = [];
    for (var c = 0; c < colors.length; c++) recs.push(await pack(png(colors[c])));
    var tampered = await pack(png('#111111'));
    tampered.byteHash = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    recs.push(tampered);
    recs.push({ madeBy: 'person', personFp: 'person-1', mindFp: '', bytes: recs[0].bytes, byteHash: recs[0].byteHash });
    localStorage.setItem('fl_image_records', JSON.stringify(recs));
    var api = window.FLMarketAttach;
    var bad = await api.attach('local', tampered, 'Lyra');
    var attached = [];
    for (var n = 0; n < 3; n++) attached.push(await api.attach('local', recs[n], 'Lyra'));
    var cap = await api.attach('local', recs[3], 'Lyra');
    var share = api.sharePayload('local');
    var wide = share.some(function (row) { return row.thumb && row.thumb.length > 20; });
    var thumb = share[0] && share[0].thumb;
    var dims = { w: 0, h: 0 };
    if (thumb) {
      dims = await new Promise(function (resolve) {
        var img = new Image();
        img.onload = function () { resolve({ w: img.naturalWidth, h: img.naturalHeight }); };
        img.onerror = function () { resolve({ w: 0, h: 0 }); };
        img.src = thumb;
      });
    }
    return {
      bad: bad,
      attached: attached.map(function (r) { return r && r.ok; }),
      cap: cap,
      shareKeys: share.map(function (row) { return Object.keys(row).sort().join(','); }),
      dims: dims,
      wide: wide,
      records: localStorage.getItem('fl_image_records')
    };
  });
  assert(attachResult.bad && attachResult.bad.ok === false, 'browser tamper refused');
  assert(attachResult.attached.join(',') === 'true,true,true', 'browser attached 3');
  assert(attachResult.cap && attachResult.cap.ok === false, 'browser cap');
  assert(attachResult.shareKeys.every(function (k) { return k === 'fp,thumb'; }), 'browser share shape');
  assert(attachResult.dims.w <= 256 && attachResult.dims.h <= 256 && attachResult.dims.w > 0, 'thumb within 256 ' + attachResult.dims.w + 'x' + attachResult.dims.h);
  var during = hits.slice(beforeCount).filter(function (u) {
    return u.indexOf('blob:') !== 0 && u.indexOf('data:') !== 0;
  });
  assert(during.length === 0, 'attach requests ' + during.join(' '));
  var choiceCount = await attachPage.evaluate(function () {
    var btn = document.querySelector('.fl-market-attach-btn');
    if (btn) btn.click();
    var choices = document.querySelectorAll('.fl-market-choice');
    var empty = document.body.textContent.indexOf('This mind has not made a picture yet.') !== -1;
    var person = 0;
    choices.forEach(function (el) { if ((el.textContent || '').indexOf('person') !== -1) person += 1; });
    return { choices: choices.length, empty: empty, button: btn ? btn.textContent : '' };
  });
  assert(choiceCount.button === 'Add a picture this mind made', 'button label');
  assert(choiceCount.choices >= 1, 'picker lists a picture');
  console.log('browser attach ok thumb ' + attachResult.dims.w + 'x' + attachResult.dims.h + ' requests after ' + during.length);
  await attachCtx.close();
  await browser.close();
  server.close();
  finish();
})().catch(function (err) {
  console.log('FAIL ' + (err && err.stack || err));
  process.exit(1);
});

function finish() {
  if (failed) {
    console.log('FAILED ' + failed);
    process.exit(1);
  }
  console.log('SMOKE_OK marketplace polish v0.1');
}
