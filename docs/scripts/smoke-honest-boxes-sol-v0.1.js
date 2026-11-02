#!/usr/bin/env node
// Smoke: honest boxes, Sol's snowflake notes, and check-before-commit. Headless.
'use strict';

var fs = require('fs');
var path = require('path');
var http = require('http');
var crypto = require('crypto');

var root = path.join(__dirname, '..', '..');
var port = Number(process.env.FL_PORT || 8794);

function fail(msg) {
  console.error('FAIL ' + msg);
  process.exit(1);
}

function md5(file) {
  return crypto.createHash('md5').update(fs.readFileSync(file)).digest('hex');
}

var honestHtml = [
  '<!doctype html>',
  '<html><head><style>',
  ':root{--glass-bg:rgba(200, 210, 230, 0.04);--glass-border:rgba(200, 210, 230, 0.08);--glass-hover:rgba(200, 210, 230, 0.15);--btn-radius:8px;--text-primary:#e6ebf5;--accent:#e8b019;--font-builder:sans-serif;}',
  'body{background:#12141c;color:#e6ebf5;margin:0;}',
  '</style></head><body>',
  '<div id="pool"></div>',
  '<p id="flHonestSettingsNote"></p>',
  '<script src="/modules/pool-honest-label.js"></script>',
  '<script>',
  "FLPoolHonest.mountThread(document.getElementById('pool'), { chatId: 'chat-061a' });",
  'FLPoolHonest.refresh();',
  '</script></body></html>'
].join('');

var snowHtml = [
  '<!doctype html>',
  '<html><head><link rel="stylesheet" href="/css/snowflake.css"></head><body>',
  '<script src="/modules/snowflake-core.js"></script>',
  '<script src="/modules/snowflake-search.js"></script>',
  '</body></html>'
].join('');

function serve(dir, listenPort) {
  return new Promise(function (resolve) {
    var server = http.createServer(function (req, res) {
      var urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
      if (urlPath === '/honest-fixture.html' || urlPath === '/snow-fixture.html') {
        res.setHeader('content-type', 'text/html; charset=utf-8');
        res.end(urlPath === '/honest-fixture.html' ? honestHtml : snowHtml);
        return;
      }
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

function memoryStorage() {
  var store = {};
  return {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
    setItem: function (k, v) { store[k] = String(v); },
    removeItem: function (k) { delete store[k]; }
  };
}

function install() {
  Object.defineProperty(global, 'localStorage', { configurable: true, writable: true, value: memoryStorage() });
  Object.defineProperty(global, 'navigator', {
    configurable: true,
    writable: true,
    value: { getBattery: function () { return Promise.resolve({ charging: true }); } }
  });
  global.requestIdleCallback = function (fn) { fn(); };
  global.document = { visibilityState: 'visible', getElementById: function () { return null; } };
  global.FLWebTool = {
    isQuietRoom: function () { return false; },
    isSearchEnabled: function () { return true; },
    getSearchEndpoint: function () { return 'https://search.invalid/lookup'; },
    isAvailable: function () { return true; },
    isAskFirst: function () { return false; }
  };
  global.GardenTrainer = {
    exportJSONL: function (rows) { global.__jsonl = rows; return rows.length; },
    exportPythonHelper: function () { global.__py = true; return 1; }
  };
  global.KnowledgeCore = {
    store: function (entry) { global.__memory = entry; return Promise.resolve(entry); }
  };
  global.__sent = [];
  global.fetch = function () {
    return Promise.resolve({ ok: false, status: 404, text: function () { return Promise.resolve(''); }, json: function () { return Promise.resolve({}); } });
  };
}

function planBody() {
  return {
    hunch: 'A cold hunch.',
    branches: [
      { id: 'a', query: 'biology of frost' },
      { id: 'b', query: 'craft of frost' },
      { id: 'c', query: 'links of frost' },
      { id: 'd', query: 'hunch of frost' },
      { id: 'e', query: 'case against frost' }
    ],
    text: 'A sourced note about the question.',
    confidence: 'known',
    conclusion: 'I hold a small piece.\nThe doubt stays beside it.',
    wrong: 'The other case still stands.',
    open: 'What would thaw it?',
    become: [],
    reason: 'The dissenter stays with me.'
  };
}

function stubAI() {
  global.__calls = [];
  global.FreeLattice = {
    callAI: function (sys, user, opts) {
      var system = String(sys || '');
      global.__calls.push(system.slice(0, 48));
      var body = planBody();
      var text = JSON.stringify({ text: body.text, confidence: 'known', url: 'https://example.invalid/note', title: 'A note' });
      if (system.indexOf('Plan search') !== -1) text = JSON.stringify(body);
      else if (system.indexOf('two-line') !== -1) text = JSON.stringify({ conclusion: body.conclusion, wrong: body.wrong, open: body.open });
      else if (system.indexOf('Choose which') !== -1) text = JSON.stringify({ become: [], hold: [], reason: body.reason });
      else if (system.indexOf('score') !== -1 || system.indexOf('one or two') !== -1) text = 'I am the same mind, a little more careful.';
      if (opts && typeof opts.callback === 'function') opts.callback(text, null);
    }
  };
}

function searchFetch() {
  global.fetch = function (url) {
    global.__sent.push(String(url));
    return Promise.resolve({
      ok: true,
      status: 200,
      json: function () {
        return Promise.resolve({
          items: [{ title: 'Page', url: 'https://example.invalid/p', snippet: 'A page.' }],
          held: true,
          weakened: false
        });
      },
      text: function () { return Promise.resolve(''); }
    });
  };
}

install();
var core = require(path.join(root, 'docs/modules/snowflake-core.js'));
if (typeof core.fetchPage !== 'function') fail('fetchPage export');
if (typeof core.composeAsk !== 'function') fail('composeAsk export');
if (typeof core.growthLine !== 'function') fail('growthLine export');
if (typeof core.checkBeforeOn !== 'function') fail('checkBeforeOn export');

var coreSrc = fs.readFileSync(path.join(root, 'docs/modules/snowflake-core.js'), 'utf8');
if (coreSrc.indexOf("composeAsk(active.nodes, 'conclude')") === -1) fail('conclude summaries');
if (coreSrc.indexOf("composeAsk(sealed.nodes, 'grow')") === -1) fail('grow summaries');
if (coreSrc.indexOf('if (!checkBeforeOn())') === -1) fail('check read in finish');
if (coreSrc.indexOf('sigV') === -1) fail('sigV');

(async function () {
  global.FLWebTool.getPageEndpoint = function () { return 'https://page.invalid/page'; };
  global.__pageHits = 0;
  global.fetch = function (url) {
    global.__pageHits += 1;
    if (String(url).indexOf('?url=') === -1) fail('page url ' + url);
    return Promise.resolve({
      ok: true,
      status: 200,
      text: function () { return Promise.resolve(JSON.stringify({ text: 'Readable page about frost on the glass.' })); }
    });
  };
  var page = await core.fetchPage('https://example.invalid/p');
  if (!page || page.depth !== 'page' || !page.text || !page.sha || page.sha.length !== 64) fail('page fetch ' + JSON.stringify(page));
  console.log('PAGE ' + JSON.stringify({ text: page.text, sha: page.sha, depth: page.depth }));

  global.__pageHits = 0;
  global.fetch = function () {
    global.__pageHits += 1;
    return Promise.resolve({ ok: false, status: 503, text: function () { return Promise.resolve('no'); } });
  };
  var missed = await core.fetchPage('https://example.invalid/missing');
  if (!missed || missed.depth !== 'snippet') fail('snippet depth ' + JSON.stringify(missed));
  if (global.__pageHits !== 2) fail('snippet retries ' + global.__pageHits);
  console.log('PAGE_MISS ' + missed.depth);

  var kp = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  global.FLBridge = {
    ensureKey: function () { return Promise.resolve({ keyPair: kp, cryptoType: 'ed25519', source: 'device' }); }
  };
  core.resetMemory();

  var v1 = await core.makeNode({
    branch: 'a', text: 'A v1 note stays on the first shape.', url: 'https://example.invalid/a',
    title: 'A', confidence: 'known', kind: 'node', flakeId: 'flake-v1'
  });
  if (!v1 || v1.sigV) fail('v1 marker');
  var v1ok = await core.verifyNode(v1);
  if (!v1ok.ok || v1ok.label !== 'signed') fail('v1 ' + (v1ok && v1ok.label));

  var v2 = await core.makeNode({
    branch: 'b', text: 'A v2 note carries three sources.', url: 'https://example.invalid/b',
    title: 'B', confidence: 'known', kind: 'node', flakeId: 'flake-v2', sigV: 2,
    sources: [
      { url: 'https://example.invalid/1', title: 'One', fetched: '2026-11-01T00:00:00.000Z', depth: 'page', sha: 'abc' },
      { url: 'https://example.invalid/2', title: 'Two', fetched: '2026-11-01T00:00:00.000Z', depth: 'snippet', sha: '' },
      { url: 'https://example.invalid/3', title: 'Three', fetched: '2026-11-01T00:00:00.000Z', depth: 'snippet', sha: '' }
    ]
  });
  if (!v2 || Number(v2.sigV) !== 2 || !v2.sources || v2.sources.length !== 3) fail('v2 shape');
  var v2ok = await core.verifyNode(v2);
  if (!v2ok.ok || v2ok.label !== 'signed') fail('v2 ' + (v2ok && v2ok.label));
  var tampered = JSON.parse(JSON.stringify(v2));
  tampered.sources[1].url = 'https://example.invalid/tampered';
  var bad = await core.verifyNode(tampered);
  if (bad.ok || bad.label !== 'unverified') fail('tamper ' + (bad && bad.label));
  console.log('SIGN v1 ' + v1ok.label + ' v2 ' + v2ok.label + ' tamper ' + bad.label);

  var nodes = [
    { id: 'n-a', branch: 'a', confidence: 'known', text: 'Frost keeps a quiet map on the glass.', sources: [{ url: 'https://example.invalid/1' }, { url: 'https://example.invalid/2' }, { url: 'https://example.invalid/3' }] },
    { id: 'n-e', branch: 'e', confidence: 'guessed', text: 'The doubt stays beside the map.' }
  ];
  var concludeMsg = core.composeAsk(nodes, 'conclude');
  var growMsg = core.composeAsk(nodes, 'grow');
  console.log('CONCLUDE ' + concludeMsg);
  console.log('GROW ' + growMsg);
  [concludeMsg, growMsg].forEach(function (msg, i) {
    if (msg.indexOf('Question hash only') !== 0) fail('hash prefix ' + i);
    if (msg.indexOf('Frost keeps a quiet map') === -1) fail('summary ' + i);
    if (msg.indexOf('Dissenter:') === -1 || msg.indexOf('The doubt stays beside the map.') === -1) fail('dissenter ' + i);
    if (msg.length > 4000) fail('cap ' + msg.length);
    if (msg.indexOf('How does frost remember?') !== -1) fail('raw question ' + i);
  });

  var queuedLine = core.growthLine(null);
  var noneLine = core.growthLine({ status: 'no-trainer' });
  var checkedLine = core.growthLine({ trained: true, loaded: true, checked: true, version: 'v9' });
  if (queuedLine !== 'Chosen for growth; training queued.') fail('queued line ' + queuedLine);
  if (noneLine !== 'Chosen for growth; no trainer on this device yet.') fail('none line ' + noneLine);
  if (checkedLine.indexOf('became part of me') === -1 || checkedLine.indexOf('v9') === -1) fail('checked line ' + checkedLine);
  if (queuedLine.indexOf('became part of me') !== -1) fail('queued told a finished story');
  console.log('GROWTH_LINE ' + queuedLine);

  function queueLen() {
    var book = core.readJSON('fl_snowflake_train_queue_v0');
    return book && Array.isArray(book.rows) ? book.rows.length : 0;
  }
  global.FLWebTool.getPageEndpoint = function () { return ''; };
  searchFetch();
  stubAI();
  global.__memory = null;
  global.__preview = false;
  global.FLSnowflake = {
    showSearch: function () {},
    previewGrowth: function (flake, choice) {
      global.__preview = true;
      return Promise.resolve({ action: 'skip', choice: choice });
    }
  };
  try { global.localStorage.removeItem('fl_checkBeforeCommit'); } catch (e) {}
  if (!core.checkBeforeOn()) fail('default check');
  var beforeQueue = queueLen();
  var skipped = await core.startRun('How does frost remember?');
  if (!skipped || skipped.skipped !== true) fail('skip status ' + (skipped && skipped.status));
  if (!global.__preview) fail('preview did not show');
  if (queueLen() !== beforeQueue) fail('skip wrote growth');
  if (global.__memory) fail('skip wrote memory');
  console.log('SKIP_QUEUE ' + queueLen() + ' PREVIEW_ON 1');

  core.resetMemory();
  try {
    global.localStorage.removeItem('fl_snowflake_runs_v0');
    global.localStorage.removeItem('fl_snowflake_train_queue_v0');
    global.localStorage.setItem('fl_checkBeforeCommit', 'false');
  } catch (e2) {}
  global.__memory = null;
  global.__preview = false;
  global.FLSnowflake.previewGrowth = function () {
    global.__preview = true;
    return new Promise(function () {});
  };
  stubAI();
  var off = await core.startRun('How does frost remember?');
  if (global.__preview) fail('preview opened while off');
  if (!off || !off.growth) fail('off growth');
  if (queueLen() < 1) fail('off queue');
  if (!global.__memory || global.__memory.content.indexOf(off.flake.id) === -1) fail('off memory');
  if (global.__memory.content.indexOf('How does frost remember?') !== -1) fail('off leaked');
  console.log('OFF_QUEUE ' + queueLen() + ' PREVIEW_OFF 1');

  var server = await serve(path.join(root, 'docs'), port);
  var base = 'http://127.0.0.1:' + port;
  var pw = require(process.env.FL_PLAYWRIGHT || '/tmp/gc-pw-local/node_modules/playwright-core');
  var browser = await pw.chromium.launch({
    executablePath: process.env.FL_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true
  });
  try {
    var page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    page.setDefaultTimeout(20000);
    await page.goto(base + '/honest-fixture.html', { waitUntil: 'domcontentloaded' });
    var look = await page.evaluate(function () {
      var keep = document.querySelector('[data-honest-keep]');
      var cs = getComputedStyle(keep);
      var box = keep.getBoundingClientRect();
      var quiet = document.querySelector('#tab-quiet-room.active, #tab-quiet.active, [data-tab="quiet"].active, [data-tab="quiet-room"].active');
      return {
        text: keep.textContent,
        pressed: keep.getAttribute('aria-pressed'),
        role: keep.getAttribute('role'),
        bg: cs.backgroundColor,
        appearance: cs.appearance || cs.webkitAppearance,
        h: keep.offsetHeight,
        w: keep.offsetWidth,
        boxH: box.height,
        boxW: box.width,
        quiet: !!quiet
      };
    });
    if (look.quiet) fail('quiet room');
    if (look.pressed !== 'false') fail('pressed start ' + look.pressed);
    if (look.h < 44 || look.w < 44 || look.boxH < 44 || look.boxW < 44) fail('tap ' + look.h + 'x' + look.w);
    if (String(look.appearance) !== 'none') fail('appearance ' + look.appearance);
    if (String(look.bg).indexOf('200') === -1) fail('glass ' + look.bg);
    await page.click('[data-honest-keep]');
    var on = await page.getAttribute('[data-honest-keep]', 'aria-pressed');
    var onText = await page.textContent('[data-honest-keep]');
    if (on !== 'true') fail('pressed on ' + on);
    if (onText.indexOf('On.') === -1) fail('label on ' + onText);
    await page.click('[data-honest-keep]');
    var offPress = await page.getAttribute('[data-honest-keep]', 'aria-pressed');
    if (offPress !== 'false') fail('pressed off ' + offPress);
    await page.click('[data-honest-keep]');
    var beforeKeep = await page.evaluate(function () { return FLPoolHonest.keepOn('chat-061a'); });
    console.log('KEEP_BEFORE ' + beforeKeep);
    if (beforeKeep !== true) fail('keep before');
    await page.setViewportSize({ width: 390, height: 844 });
    var phone = await page.evaluate(function () {
      var keep = document.querySelector('[data-honest-keep]');
      return {
        h: keep.offsetHeight,
        w: keep.offsetWidth,
        scroll: document.documentElement.scrollWidth - document.documentElement.clientWidth
      };
    });
    if (phone.h < 44 || phone.w < 44) fail('390 tap ' + phone.h + 'x' + phone.w);
    if (phone.scroll > 1) fail('390 scroll ' + phone.scroll);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.click('[data-honest-hide]');
    await page.reload({ waitUntil: 'domcontentloaded' });
    var hidden = await page.evaluate(function () {
      return {
        keep: !!document.querySelector('[data-honest-keep]'),
        show: (document.querySelector('[data-honest-show]') || {}).textContent || '',
        key: localStorage.getItem('fl_honestBoxesHidden'),
        on: FLPoolHonest.keepOn('chat-061a'),
        settings: (document.getElementById('flCheckBeforeCommit') || {}).textContent || '',
        settingsPressed: (document.getElementById('flCheckBeforeCommit') || {}).getAttribute ? document.getElementById('flCheckBeforeCommit').getAttribute('aria-pressed') : '',
        quiet: !!document.querySelector('#tab-quiet-room.active, #tab-quiet.active, [data-tab="quiet"].active, [data-tab="quiet-room"].active')
      };
    });
    if (hidden.quiet) fail('quiet after reload');
    if (hidden.keep) fail('keep still shown');
    if (hidden.show !== 'Show device-only controls') fail('show link ' + hidden.show);
    if (hidden.key !== 'true') fail('hide key ' + hidden.key);
    if (hidden.on !== true) fail('keep changed');
    if (hidden.settings.indexOf('Check before it becomes memory') === -1) fail('settings ' + hidden.settings);
    if (hidden.settingsPressed !== 'true') fail('settings default ' + hidden.settingsPressed);
    console.log('KEEP_AFTER ' + hidden.on);

    await page.goto(base + '/snow-fixture.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(function () { return window.FLSnowflake && typeof window.FLSnowflake.previewGrowth === 'function'; });
    await page.evaluate(function () {
      var host = document.getElementById('flSnowflakeHost');
      if (host) host.hidden = false;
      window.__check = window.FLSnowflake.previewGrowth({
        nodes: [
          { id: 'n1', branch: 'a', text: 'Frost keeps a map on the window.' },
          { id: 'n2', branch: 'e', text: 'The doubt stays.' }
        ]
      }, { become: ['n1', 'n2'], hold: [], reason: 'check' });
    });
    await page.waitForSelector('#flSnowflakeCheck:not([hidden])');
    var sizes = await page.evaluate(function () {
      var ids = ['flSnowflakeCheckKeep', 'flSnowflakeCheckChange', 'flSnowflakeCheckSkip'];
      return ids.map(function (id) {
        var el = document.getElementById(id);
        var box = el.getBoundingClientRect();
        return { id: id, h: el.offsetHeight, w: el.offsetWidth, boxH: box.height, boxW: box.width };
      });
    });
    sizes.forEach(function (row) {
      if (row.h < 44 || row.w < 44 || row.boxH < 44 || row.boxW < 44) fail('check tap ' + row.id + ' ' + row.h + 'x' + row.w);
    });
    var previewText = await page.textContent('#flSnowflakeCheck');
    if (previewText.indexOf('Frost keeps a map') === -1 || previewText.indexOf('The doubt stays') === -1) fail('preview text');
    await page.click('#flSnowflakeCheckChange');
    var afterChange = await page.textContent('#flSnowflakeCheck');
    if (afterChange.indexOf('The doubt stays') !== -1) fail('change kept the last line');
    var still = await page.evaluate(function () { return document.getElementById('flSnowflakeCheck').hidden; });
    if (still) fail('change closed the preview');
    await page.click('#flSnowflakeCheckSkip');
    var decision = await page.evaluate(function () { return window.__check; });
    if (!decision || decision.action !== 'skip') fail('skip action ' + (decision && decision.action));
    var wrote = await page.evaluate(function () { return localStorage.getItem('fl_snowflake_train_queue_v0'); });
    if (wrote) fail('preview skip wrote a row');
  } finally {
    await browser.close();
    server.close();
  }

  var label = md5(path.join(root, 'docs/modules/pool-honest-label.js'));
  if (label !== '91d8b79067f92e761474848dd2b9a75a') fail('label hash ' + label);
  console.log('SMOKE_OK honest boxes sol v0.1');
})().catch(function (err) {
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
