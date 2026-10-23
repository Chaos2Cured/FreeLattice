#!/usr/bin/env node
'use strict';
// v-mind-make-core-v0.1
// Local only. Node checks the door. Playwright drives the Chrome on this Mac for the card.
var fs = require('fs');
var path = require('path');
var crypto = require('crypto');
var http = require('http');
var vm = require('vm');

var root = path.join(__dirname, '..');
var clayPin = '2da32883c514e4ad2a3cd8571e7a7b15';
var scrollPin = '84fed10c603c9e89e9452ada564c8c65';
var shots = '/tmp/gc047-shots';

function fail(msg) {
  console.error('FAIL ' + msg);
  process.exit(1);
}
function md5(file) {
  return crypto.createHash('md5').update(fs.readFileSync(file)).digest('hex');
}
function sha8(text) {
  return crypto.createHash('sha256').update(String(text)).digest('hex').slice(0, 8);
}

var clay = path.join(root, 'docs/modules/particle-clay.js');
if (md5(clay) !== clayPin) fail('particle-clay.js ' + md5(clay));
var treeClay = process.env.TREE_CLAY || '/tmp/tree-scroll-046/docs/modules/particle-clay.js';
if (fs.existsSync(treeClay) && md5(treeClay) !== clayPin) fail('tree particle-clay.js ' + md5(treeClay));
var scroll = path.join(root, 'docs/modules/chat-scroll-release.js');
if (md5(scroll) !== scrollPin) fail('chat-scroll-release.js ' + md5(scroll));
['docs/modules/clay-math.js', 'docs/modules/clay-forms.js', 'docs/modules/mind-workspace.js'].forEach(function (rel) {
  var pin = {
    'docs/modules/clay-math.js': '144c33cdd9583c7e3d77f3cca6460bb1',
    'docs/modules/clay-forms.js': 'dd193fa7b519d4c2a011a346d7993e5a',
    'docs/modules/mind-workspace.js': 'f1c88664d3e99362e02c625defb241bc'
  }[rel];
  if (md5(path.join(root, rel)) !== pin) fail(rel + ' moved');
});

var app = fs.readFileSync(path.join(root, 'docs/app.html'));
var index = fs.readFileSync(path.join(root, 'index.html'));
if (!app.equals(index)) fail('index.html differs from docs/app.html');
var appText = app.toString('utf8');
if (appText.indexOf('modules/chat-scroll-release.js') > appText.indexOf('modules/particle-clay.js')) fail('scroll module loads after clay');
if (appText.indexOf('modules/mind-make.js') < appText.indexOf('modules/particle-clay.js')) fail('mind-make loads before clay');
if (appText.indexOf('id="fl-make-consent-mount"') === -1) fail('settings mount missing');
if (appText.indexOf('FLMake.onReply') === -1) fail('reply path missing');
if (appText.indexOf('FLMake.promptDelta') === -1) fail('prompt line missing');

var modPath = path.join(root, 'docs/modules/mind-make.js');
var mod = fs.readFileSync(modPath, 'utf8');
['innerHTML', 'eval(', 'new Function', 'confirm(', '\u2014', '&mdash;', 'fetch(', 'XMLHttpRequest'].forEach(function (tok) {
  if (mod.indexOf(tok) !== -1) fail('module has ' + tok);
});
if (mod.indexOf("version: 'v0.1'") === -1 && mod.indexOf('version: VERSION') === -1) fail('module version');
console.log('mind-make.js ' + md5(modPath));

function mem() {
  var s = {};
  return {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(s, k) ? s[k] : null; },
    setItem: function (k, v) { s[k] = String(v); },
    removeItem: function (k) { delete s[k]; }
  };
}
function element(tag, byId) {
  var node = {
    tagName: String(tag || 'DIV').toUpperCase(),
    children: [],
    style: {},
    dataset: {},
    className: '',
    _id: '',
    hidden: false,
    textContent: '',
    type: '',
    parentNode: null,
    _on: {}
  };
  Object.defineProperty(node, 'id', {
    get: function () { return node._id; },
    set: function (v) { node._id = String(v || ''); if (node._id) byId[node._id] = node; }
  });
  node.appendChild = function (c) { c.parentNode = node; node.children.push(c); if (c.id) byId[c.id] = c; return c; };
  node.removeChild = function (c) {
    var i = node.children.indexOf(c);
    if (i >= 0) node.children.splice(i, 1);
    c.parentNode = null;
    return c;
  };
  node.insertBefore = function (c, ref) {
    c.parentNode = node;
    var i = node.children.indexOf(ref);
    if (i < 0) node.children.push(c); else node.children.splice(i, 0, c);
    if (c.id) byId[c.id] = c;
    return c;
  };
  node.addEventListener = function (type, fn) {
    node._on[type] = node._on[type] || [];
    node._on[type].push(fn);
  };
  node.focus = function () { node.ownerDocument.active = node; };
  node.click = function () { (node._on.click || []).forEach(function (fn) { fn({ target: node }); }); };
  node.setAttribute = function (k, v) { node[k] = v; };
  node.getAttribute = function (k) { return node[k]; };
  node.querySelector = function () { return null; };
  return node;
}
function makeDoc() {
  var byId = {};
  var doc = {
    readyState: 'complete',
    active: null,
    _on: {},
    createElement: function (tag) {
      var node = element(tag, byId);
      node.ownerDocument = doc;
      return node;
    },
    getElementById: function (id) { return byId[id] || null; },
    addEventListener: function (type, fn) {
      doc._on[type] = doc._on[type] || [];
      doc._on[type].push(fn);
    },
    querySelector: function () { return null; }
  };
  doc.head = element('head', byId);
  doc.body = element('body', byId);
  doc.head.ownerDocument = doc;
  doc.body.ownerDocument = doc;
  return doc;
}
function load(extra) {
  var storage = mem();
  var session = mem();
  var doc = makeDoc();
  var sandbox = {
    localStorage: storage,
    sessionStorage: session,
    document: doc,
    crypto: global.crypto,
    TextEncoder: TextEncoder,
    MutationObserver: function () { this.observe = function () {}; this.disconnect = function () {}; },
    console: console,
    Date: Date,
    JSON: JSON,
    Promise: Promise,
    Uint8Array: Uint8Array,
    Math: Math,
    Object: Object,
    Array: Array,
    String: String,
    Number: Number,
    RegExp: RegExp,
    parseInt: parseInt,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  if (extra) Object.keys(extra).forEach(function (k) { sandbox[k] = extra[k]; });
  vm.createContext(sandbox);
  vm.runInContext(mod, sandbox, { filename: 'mind-make.js' });
  sandbox.__doc = doc;
  sandbox.__store = storage;
  return sandbox;
}
function anchor(doc) {
  var host = doc.createElement('div');
  var span = doc.createElement('span');
  host.appendChild(span);
  doc.body.appendChild(host);
  return span;
}
function waitFor(fn, ms) {
  var start = Date.now();
  return new Promise(function (resolve, reject) {
    (function tick() {
      var value;
      try { value = fn(); } catch (err) { reject(err); return; }
      if (value) { resolve(value); return; }
      if (Date.now() - start > (ms || 1500)) { reject(new Error('timed out')); return; }
      setTimeout(tick, 15);
    })();
  });
}
function texts(node) {
  var out = [];
  function walk(el) {
    if (!el) return;
    if (el.textContent) out.push(el.textContent);
    (el.children || []).forEach(walk);
  }
  walk(node);
  return out.join('\n');
}

async function logic() {
  var nested = 'Hi [FL_MAKE:{"kind":"clay","why":"a {nested} brace and \\"quote\\"","ask":"make {it}"}] thanks';
  var box = load();
  var parsed = box.FLMake.parse(nested);
  if (!parsed[0] || parsed[0].why !== 'a {nested} brace and "quote"') fail('nested why ' + JSON.stringify(parsed));
  if (parsed[0].ask !== 'make {it}') fail('nested ask');
  box.FLMake.consent.set('clay', 'yes');
  var seen = box.FLMake.onReply(nested, anchor(box.__doc));
  if (seen.visible.indexOf('[FL_MAKE:') !== -1) fail('tag stayed in the reply');
  if (seen.visible.indexOf('Hi') === -1 || seen.visible.indexOf('thanks') === -1) fail('reply text dropped ' + seen.visible);
  if (!seen.offered) fail('nested offer missing');

  var bad = load();
  bad.FLMake.consent.set('clay', 'yes');
  var broken = bad.FLMake.onReply('Hi [FL_MAKE:{not json}] there', anchor(bad.__doc));
  if (broken.offered) fail('broken tag offered');
  if (broken.visible.indexOf('[FL_MAKE:') !== -1 || broken.visible.indexOf('not json') !== -1) fail('broken tag shown ' + broken.visible);
  if (broken.visible.indexOf('Hi') === -1 || broken.visible.indexOf('there') === -1) fail('broken reply damaged ' + broken.visible);

  var hugeWhy = 'a'.repeat(3000);
  var huge = 'Before [FL_MAKE:{"kind":"clay","why":"' + hugeWhy + '","ask":"x"}] After';
  var over = load();
  over.FLMake.consent.set('clay', 'yes');
  var dropped = over.FLMake.onReply(huge, anchor(over.__doc));
  if (dropped.offered) fail('over-cap tag offered');
  if (dropped.visible.indexOf('[FL_MAKE:') !== -1) fail('over-cap tag shown');
  if (dropped.visible.indexOf('Before') === -1 || dropped.visible.indexOf('After') === -1) fail('over-cap ate the reply ' + dropped.visible.slice(0, 80));

  var off = load();
  var quiet = off.FLMake.onReply('Hello [FL_MAKE:{"kind":"clay","why":"because","ask":"a cup"}]', anchor(off.__doc));
  if (quiet.offered) fail('consent off still offered');
  if (off.__doc.getElementById('fl-make-offer')) fail('card while consent is off');
  if (quiet.visible.indexOf('[FL_MAKE:') !== -1) fail('tag shown while off');

  var paused = load();
  paused.FLMake.consent.set('clay', 'yes');
  paused.__flUserPaused = true;
  var held = paused.FLMake.onReply('Hello [FL_MAKE:{"kind":"clay","why":"because","ask":"a cup"}]', anchor(paused.__doc));
  if (held.offered || paused.__doc.getElementById('fl-make-offer')) fail('pause still offered');

  var room = load();
  room.FLMake.consent.set('clay', 'yes');
  room.__doc.querySelector = function () { return { dataset: { tab: 'quiet' } }; };
  var rested = room.FLMake.onReply('Hello [FL_MAKE:{"kind":"clay","why":"because","ask":"a cup"}]', anchor(room.__doc));
  if (rested.offered || room.__doc.getElementById('fl-make-offer')) fail('rest tab still offered');

  var clayBox = load();
  clayBox.FLMake.consent.set('clay', 'yes');
  var got = null;
  clayBox.FLClay = { onReply: function (ask) { got = ask; return { choice: { form: 'cup' } }; } };
  var host = anchor(clayBox.__doc);
  clayBox.FLMake.onReply('Please [FL_MAKE:{"kind":"clay","why":"a cup helps","ask":"a small cup"}]', host);
  var yes = clayBox.__doc.getElementById('fl-make-yes');
  if (!yes) fail('yes button missing');
  yes.click();
  var row = await waitFor(function () {
    var rows = clayBox.FLMake.ledger.list('Your mind');
    return rows.length ? rows[0] : null;
  });
  if (got !== 'a small cup') fail('clay did not receive the ask ' + got);
  if (row.omega !== 'Your mind') fail('omega ' + row.omega);
  if (sha8(row.t + row.lambda + row.delta + row.omega + row.sigma) !== row.psi) fail('psi ' + row.psi + ' ' + row.delta);
  if (row.delta.indexOf('clay|') !== 0 || row.delta.slice(-8) !== sha8('cup')) fail('delta ' + row.delta);
  var copy = clayBox.FLMake.ledger.list('Your mind');
  copy.pop();
  if (clayBox.FLMake.ledger.list('Your mind').length !== 1) fail('list handed back the real rows');
  ['delete', 'remove', 'update', 'write', 'put', 'clear'].forEach(function (key) {
    if (typeof clayBox.FLMake.ledger[key] === 'function') fail('ledger.' + key + ' exists');
  });

  var later = load();
  later.FLMake.consent.set('clay', 'yes');
  later.FLMake.onReply('Please [FL_MAKE:{"kind":"clay","why":"a cup helps","ask":"a small cup"}]', anchor(later.__doc));
  later.__doc._on.keydown.forEach(function (fn) { fn({ key: 'Escape', target: { tagName: 'DIV' } }); });
  var laterRow = await waitFor(function () {
    var rows = later.FLMake.ledger.list('Your mind');
    return rows.length ? rows[0] : null;
  });
  var left = later.__doc.getElementById('fl-make-offer');
  if (left && left.parentNode) fail('escape left the card');
  if (laterRow.delta.slice(-4) !== 'none') fail('escape delta ' + laterRow.delta);
  if (sha8(laterRow.t + laterRow.lambda + laterRow.delta + laterRow.omega + laterRow.sigma) !== laterRow.psi) fail('escape psi');

  var image = load();
  image.FLMake.consent.set('image', 'yes');
  var imageHost = anchor(image.__doc);
  var unknown;
  try {
    unknown = image.FLMake.onReply('Look [FL_MAKE:{"kind":"image","why":"a sketch","ask":"a fern"}]', imageHost);
  } catch (err) { fail('unknown kind threw ' + err.message); }
  if (!unknown || unknown.visible.indexOf('[FL_MAKE:') !== -1) fail('unknown tag shown');
  if (texts(imageHost.parentNode).indexOf('Your mind wanted to make image. That is not ready yet.') === -1) fail('not ready line missing');
  var odd;
  try { odd = image.FLMake.onReply('No [FL_MAKE:{"kind":"pottery","why":"x","ask":"y"}]', anchor(image.__doc)); }
  catch (err2) { fail('odd kind threw'); }
  if (odd.offered) fail('unlisted kind offered');

  var gate = load();
  gate.FLMake.consent.set('clay', 'yes');
  var first = gate.FLMake.onReply('One [FL_MAKE:{"kind":"clay","why":"first","ask":"cup"}]', anchor(gate.__doc));
  var second = gate.FLMake.onReply('Two [FL_MAKE:{"kind":"clay","why":"second","ask":"bowl"}]', anchor(gate.__doc));
  if (!first.offered || second.offered) fail('rate gate ' + first.offered + ' ' + second.offered);
  if (gate.FLMake.consent.rateMs !== 10 * 60 * 1000) fail('rate ms ' + gate.FLMake.consent.rateMs);
  var bag = gate.sessionStorage.getItem('fl_make_rate_v1');
  if (!bag) fail('rate stamp missing');

  var many = load();
  many.FLMake.consent.set('clay', 'yes');
  var both = 'A [FL_MAKE:{"kind":"clay","why":"one","ask":"cup"}] B [FL_MAKE:{"kind":"clay","why":"two","ask":"bowl"}]';
  var one = many.FLMake.onReply(both, anchor(many.__doc));
  if (many.FLMake.parse(both).length !== 2) fail('parser dropped a second tag');
  if (!one.offered || one.visible.indexOf('[FL_MAKE:') !== -1) fail('second tag stayed visible');
  var offerText = texts(many.__doc.getElementById('fl-make-offer'));
  if (offerText.indexOf('cup') === -1) fail('first offer lost ' + offerText);
  if (offerText.indexOf('bowl') !== -1) fail('second offer shown');

  var defaults = load().FLMake.consent.get();
  if (defaults.clay !== 'off' || defaults.learn !== 'yes') fail('defaults ' + JSON.stringify(defaults));
  var line = load().FLMake.promptDelta();
  if (line.indexOf('[FL_MAKE:') === -1 || line.indexOf('person decides') === -1) fail('prompt line');
  if (line.indexOf('\u2014') !== -1) fail('prompt em dash');
}

function serve(port) {
  var docs = path.join(root, 'docs');
  var server = http.createServer(function (req, res) {
    var urlPath = decodeURIComponent(req.url.split('?')[0]);
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

function cardHarness(base) {
  return '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<style>html,body{margin:0;padding:0}#chatMessages{height:420px;overflow:auto;border:1px solid #333}' +
    '.chat-message{font:16px/22px Georgia,serif;margin:0;padding:8px}#sendBtn{min-height:44px}</style></head><body>' +
    '<div id="chatMessages"></div><button id="sendBtn" type="button">Send</button>' +
    '<script>try{localStorage.setItem("fl_make_consent_v1", JSON.stringify({clay:"yes",image:"off",music:"off",learn:"yes",research:"off"}));}catch(e){}</script>' +
    '<script src="' + base + '/modules/mind-make.js" defer></script></body></html>';
}
function wheelHarness(base) {
  return '<!DOCTYPE html><html><head><meta charset="utf-8">' +
    '<style>#chatMessages{height:420px;overflow:auto;scroll-behavior:smooth;border:1px solid #333}' +
    '.chat-message{font:16px/16px Georgia,serif;margin:0;padding:0;white-space:pre-wrap}</style></head><body>' +
    '<div id="chatMessages"></div><div id="chatPresenceRow"></div>' +
    '<script>try{localStorage.setItem("fl_clay","on");localStorage.setItem("fl_clay_offer","yes");localStorage.setItem("fl_make_consent_v1", JSON.stringify({clay:"yes",image:"off",music:"off",learn:"yes",research:"off"}));}catch(e){}</script>' +
    '<script src="' + base + '/modules/chat-scroll-release.js" defer></script>' +
    '<script src="' + base + '/modules/clay-math.js" defer></script>' +
    '<script src="' + base + '/modules/clay-forms.js" defer></script>' +
    '<script src="' + base + '/modules/particle-clay.js" defer></script>' +
    '<script src="' + base + '/modules/mind-make.js" defer></script>' +
    '</body></html>';
}
function replyText(tag) {
  var rows = [];
  for (var i = 1; i <= 60; i++) rows.push(tag + ' line ' + i + ' of the clay reply.');
  return rows.join('\n');
}

async function cardScene(page, width, height, scale, shot) {
  await page.setViewportSize({ width: width, height: height });
  if (scale && scale !== 1) {
    // viewport was created with the scale; this helper only fills the card
  }
  await page.waitForFunction(function () { return window.FLMake && document.getElementById('chatMessages'); }, null, { timeout: 15000 });
  await page.evaluate(function () {
    var box = document.getElementById('chatMessages');
    var msg = document.createElement('div');
    msg.className = 'chat-message assistant';
    var span = document.createElement('span');
    span.id = 'gc047-reply';
    span.textContent = 'Here is a thought.';
    msg.appendChild(span);
    box.appendChild(msg);
    window.FLMake.onReply('Here is a thought. [FL_MAKE:{"kind":"clay","why":"a small cup would help the evening","ask":"a cup with a longwordwithoutspacesthatmustwrap"}]', span);
  });
  await page.waitForSelector('#fl-make-offer');
  var measure = await page.evaluate(function () {
    var card = document.getElementById('fl-make-offer');
    var reply = document.getElementById('gc047-reply');
    var send = document.getElementById('sendBtn');
    var cr = card.getBoundingClientRect();
    var rr = reply.getBoundingClientRect();
    var sr = send.getBoundingClientRect();
    var ids = ['fl-make-yes', 'fl-make-not-now', 'fl-make-never'];
    var buttons = ids.map(function (id) {
      var el = document.getElementById(id);
      var r = el.getBoundingClientRect();
      return { id: id, h: Math.round(r.height), w: Math.round(r.width), text: el.textContent };
    });
    return {
      card: { x: Math.round(cr.x), y: Math.round(cr.y), w: Math.round(cr.width), h: Math.round(cr.height) },
      belowReply: cr.top >= rr.bottom - 2,
      clearOfSend: cr.bottom <= sr.top + 2 || sr.top >= cr.bottom - 2,
      sendY: Math.round(sr.y),
      buttons: buttons,
      pageSideways: document.documentElement.scrollWidth > window.innerWidth + 1,
      chatSideways: document.getElementById('chatMessages').scrollWidth > document.getElementById('chatMessages').clientWidth + 1,
      focus: document.activeElement ? document.activeElement.id : '',
      reduced: document.getElementById('fl-make-style').textContent.indexOf('prefers-reduced-motion') !== -1
    };
  });
  if (!measure.belowReply) fail(width + ' card is not below the reply ' + JSON.stringify(measure.card));
  if (!measure.clearOfSend) fail(width + ' card covers Send');
  if (measure.pageSideways || measure.chatSideways) fail(width + ' sideways scroll');
  measure.buttons.forEach(function (b) {
    if (b.h < 44) fail(width + ' ' + b.id + ' height ' + b.h);
  });
  if (measure.focus !== 'fl-make-yes') fail(width + ' focus ' + measure.focus);
  if (!measure.reduced) fail('reduced motion rule missing');
  if (shot) await page.screenshot({ path: shot, fullPage: true });
  await page.keyboard.press('Tab');
  var tabbed = await page.evaluate(function () { return document.activeElement ? document.activeElement.id : ''; });
  if (tabbed !== 'fl-make-not-now') fail(width + ' tab landed on ' + tabbed);
  await page.keyboard.press('Escape');
  await page.waitForFunction(function () { return !document.getElementById('fl-make-offer'); }, null, { timeout: 1500 });
  return measure;
}

async function wheels(page, n) {
  await page.evaluate(function () {
    var el = document.getElementById('chatMessages');
    window.__gc047 = { snaps: 0, last: el.scrollTop, down: false };
    el.addEventListener('wheel', function (ev) { window.__gc047.down = ev.deltaY > 0; }, { passive: true, capture: true });
    el.addEventListener('scroll', function () {
      var now = el.scrollTop;
      var bag = window.__gc047;
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
    return {
      top: Math.round(el.scrollTop),
      max: Math.round(el.scrollHeight - el.clientHeight),
      snaps: window.__gc047.snaps,
      card: !!document.getElementById('fl-make-offer'),
      released: !!(window.FLChatScrollRelease && window.FLChatScrollRelease.released())
    };
  });
}

(async function () {
  await logic();
  var port = 8847;
  var server = await serve(port);
  var base = 'http://127.0.0.1:' + port;
  fs.mkdirSync(shots, { recursive: true });
  var pwPath = process.env.FL_PLAYWRIGHT || '/tmp/gc043h-pw/node_modules/playwright-core';
  // before 047: require('/tmp/gc043h-pw/node_modules/playwright-core')
  var pw;
  try { pw = require(pwPath); }
  catch (e) { fail('local playwright-core missing'); }
  // before 047: executablePath '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  var chromePath = process.env.FL_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  var browser = await pw.chromium.launch({ executablePath: chromePath, headless: true });
  var version = browser.version();
  var cardHtml = cardHarness(base);
  var sizes = [
    { name: '1280', width: 1280, height: 800, scale: 1, file: 'card-1280.png' },
    { name: '390', width: 390, height: 844, scale: 1, file: 'card-390.png' },
    { name: '640x2', width: 640, height: 400, scale: 2, file: 'card-640-dpr2.png' }
  ];
  var measures = {};
  for (var s = 0; s < sizes.length; s++) {
    var size = sizes[s];
    var context = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      deviceScaleFactor: size.scale
    });
    var page = await context.newPage();
    var errors = [];
    page.on('pageerror', function (err) { errors.push(String(err)); });
    await page.route('**/gc047-card.html', function (route) {
      route.fulfill({ status: 200, contentType: 'text/html', body: cardHtml });
    });
    await page.goto(base + '/gc047-card.html', { waitUntil: 'domcontentloaded' });
    measures[size.name] = await cardScene(page, size.width, size.height, size.scale, path.join(shots, size.file));
    if (errors.length) fail(size.name + ' page error ' + errors[0]);
    await context.close();
  }

  var wheelHtml = wheelHarness(base);
  async function wheelRun(width, height) {
    var context = await browser.newContext({ viewport: { width: width, height: height }, deviceScaleFactor: 1 });
    var page = await context.newPage();
    await page.route('**/gc047-wheel.html', function (route) {
      route.fulfill({ status: 200, contentType: 'text/html', body: wheelHtml });
    });
    await page.goto(base + '/gc047-wheel.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(function () {
      return window.FLClay && window.FLChatScrollRelease && window.FLMake && document.getElementById('chatMessages');
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
      window.FLMake.onReply(text + ' [FL_MAKE:{"kind":"clay","why":"the hand already let go","ask":"a cup"}]', reply);
      box.scrollTop = box.scrollHeight;
    }, replyText('First'));
    await page.waitForTimeout(500);
    var spun = await wheels(page, 60);
    if (!spun.card) fail(width + ' card missing during the wheel');
    if (spun.snaps !== 0) fail(width + ' snap-backs ' + spun.snaps);
    if (spun.top !== spun.max) fail(width + ' scroll ' + spun.top + '/' + spun.max);
    if (!spun.released) fail(width + ' not released after wheel');
    await page.screenshot({ path: path.join(shots, 'wheel-' + width + '.png'), fullPage: true });
    await context.close();
    return spun;
  }
  var wheel1280 = await wheelRun(1280, 800);
  var wheel1440 = await wheelRun(1440, 900);

  var appContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  var appPage = await appContext.newPage();
  var appErrors = [];
  appPage.on('pageerror', function (err) { appErrors.push(String(err)); });
  await appPage.addInitScript(function () {
    try {
      localStorage.setItem('fl-has-visited', '1');
      localStorage.setItem('fl-last-tab', 'chat');
      localStorage.setItem('fl-welcomed', 'true');
      localStorage.setItem('fl_onboardingComplete', 'true');
    } catch (e) {}
  });
  await appPage.goto(base + '/app.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await appPage.waitForFunction(function () {
    return window.FLMake && document.getElementById('fl-make-consent-mount');
  }, null, { timeout: 20000 });
  var settings = await appPage.evaluate(function () {
    if (typeof window.switchTab === 'function') window.switchTab('settings');
    var mount = document.getElementById('fl-make-consent-mount');
    var buttons = mount ? mount.querySelectorAll('button') : [];
    var heights = [];
    for (var i = 0; i < buttons.length; i++) heights.push(Math.round(buttons[i].getBoundingClientRect().height));
    return {
      text: mount ? mount.textContent : '',
      heights: heights,
      sideways: document.documentElement.scrollWidth > window.innerWidth + 1,
      prompt: window.FLMake.promptDelta()
    };
  });
  if (settings.text.indexOf('Nothing is made until you say Yes.') === -1) fail('settings sentence missing');
  if (settings.text.indexOf('Learn starts on') === -1) fail('learn sentence missing');
  if (settings.heights.length < 5) fail('settings buttons ' + settings.heights.length);
  settings.heights.forEach(function (h) { if (h < 44) fail('settings button height ' + h); });
  if (settings.sideways) fail('settings sideways scroll');
  if (settings.prompt.indexOf('person decides') === -1) fail('live prompt');
  if (appErrors.length) fail('app page error ' + appErrors[0]);
  await appPage.screenshot({ path: path.join(shots, 'settings-1280.png'), fullPage: false });
  await browser.close();
  server.close();
  console.log(JSON.stringify({ chrome: version, card: measures, wheel1280: wheel1280, wheel1440: wheel1440, shots: shots }));
  console.log('SMOKE_OK mind make core v0.1');
})().catch(function (err) {
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
