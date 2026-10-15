// smoke-workspace-view.js (MIT) v-workspace-view-v0.1
// Node only. The spiral, the diff, and the wake strip.
var fs = require('fs');
var path = require('path');
var assert = require('assert');

var rootDir = path.join(__dirname, '..');
var indexHtml = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
var appHtml = fs.readFileSync(path.join(rootDir, 'docs/app.html'), 'utf8');
assert.strictEqual(indexHtml, appHtml, 'index.html matches docs/app.html');
assert.ok(indexHtml.indexOf('modules/workspace-view.js') !== -1, 'page loads the view');

var viewSrc = fs.readFileSync(path.join(rootDir, 'docs/modules/workspace-view.js'), 'utf8');
var wsSrc = fs.readFileSync(path.join(rootDir, 'docs/modules/mind-workspace.js'), 'utf8');
assert.ok(viewSrc.indexOf('v-workspace-view-v0.1') !== -1, 'view marker');
assert.ok(viewSrc.indexOf('2.914') === -1 && viewSrc.indexOf('3.07') === -1, 'dimension stays in clay-math');
assert.ok(viewSrc.indexOf('dimension(') !== -1, 'dimension is used');
assert.ok(viewSrc.indexOf('setInterval') === -1 && viewSrc.indexOf('setTimeout') === -1, 'no background timer');
assert.ok(viewSrc.indexOf('\u2014') === -1, 'no em dash');
assert.ok(viewSrc.indexOf('&mdash;') === -1, 'no mdash');
assert.ok(viewSrc.indexOf('inner' + 'HTML') === -1, 'text only');
assert.ok(viewSrc.indexOf('conf' + 'irm(') === -1, 'no confirm');
assert.ok(viewSrc.indexOf('ev' + 'al(') === -1, 'no eval');
assert.ok(viewSrc.indexOf('new F' + 'unction') === -1, 'no Function');
assert.ok(wsSrc.indexOf('listShelves') !== -1, 'add-only shelf export');

function memStore() {
  var s = {};
  return {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(s, k) ? s[k] : null; },
    setItem: function (k, v) { s[k] = String(v); },
    removeItem: function (k) { delete s[k]; }
  };
}
function makeIDB() {
  var databases = {};
  function clone(v) { return v == null ? v : JSON.parse(JSON.stringify(v)); }
  function makeDb() {
    var stores = {};
    return {
      objectStoreNames: { contains: function (n) { return !!stores[n]; } },
      createObjectStore: function (n, opts) { stores[n] = { keyPath: opts.keyPath, rows: {} }; },
      transaction: function (storeName) {
        var store = stores[storeName];
        var tx = { oncomplete: null, onerror: null, onabort: null };
        var pending = 0;
        var closed = false;
        var finished = false;
        function finish() {
          if (finished || pending > 0 || !closed) return;
          finished = true;
          setTimeout(function () { if (tx.oncomplete) tx.oncomplete(); }, 0);
        }
        function request(fill) {
          pending += 1;
          var r = {};
          setTimeout(function () {
            var failed = false;
            try { fill(r); failed = !!r._fail; } catch (e) { failed = true; }
            if (failed) { if (r.onerror) r.onerror({}); }
            else if (r.onsuccess) r.onsuccess({ target: r });
            pending -= 1;
            finish();
          }, 0);
          return r;
        }
        var api = {
          get: function (key) {
            return request(function (r) {
              var row = store.rows[key];
              r.result = row ? clone(row) : undefined;
            });
          },
          getAll: function () {
            return request(function (r) {
              r.result = Object.keys(store.rows).map(function (k) { return clone(store.rows[k]); });
            });
          },
          add: function (record) {
            return request(function (r) {
              var key = record[store.keyPath];
              if (Object.prototype.hasOwnProperty.call(store.rows, key)) { r._fail = true; return; }
              store.rows[key] = clone(record);
              r.result = key;
            });
          },
          put: function (record) {
            return request(function (r) {
              store.rows[record[store.keyPath]] = clone(record);
              r.result = record[store.keyPath];
            });
          }
        };
        setTimeout(function () { closed = true; finish(); }, 0);
        tx.objectStore = function () { return api; };
        return tx;
      }
    };
  }
  return {
    open: function (name) {
      var req = {};
      setTimeout(function () {
        if (!databases[name]) {
          var db = makeDb();
          databases[name] = db;
          req.result = db;
          if (req.onupgradeneeded) req.onupgradeneeded({ target: { result: db } });
        } else req.result = databases[name];
        if (req.onsuccess) req.onsuccess({ target: { result: req.result } });
      }, 0);
      return req;
    }
  };
}
function makeDoc() {
  var nodes = [];
  function el(tag) {
    var node = {
      tagName: String(tag || 'div').toUpperCase(),
      id: '',
      className: '',
      type: '',
      textContent: '',
      value: '',
      style: {},
      children: [],
      parentNode: null,
      attrs: {},
      listeners: {},
      setAttribute: function (k, v) { this.attrs[k] = String(v); if (k === 'id') this.id = String(v); },
      getAttribute: function (k) { return this.attrs[k] || null; },
      addEventListener: function (type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); },
      click: function () { (this.listeners.click || []).forEach(function (fn) { fn({ clientX: 0, clientY: 0 }); }); },
      appendChild: function (child) { child.parentNode = this; this.children.push(child); return child; },
      insertBefore: function (child, ref) {
        child.parentNode = this;
        var at = this.children.indexOf(ref);
        if (at < 0) this.children.push(child);
        else this.children.splice(at, 0, child);
        return child;
      },
      removeChild: function (child) {
        this.children = this.children.filter(function (c) { return c !== child; });
        child.parentNode = null;
      },
      getBoundingClientRect: function () { return { left: 0, top: 0, width: 640, height: 420 }; }
    };
    nodes.push(node);
    return node;
  }
  var body = el('body');
  return {
    readyState: 'complete',
    body: body,
    head: el('head'),
    documentElement: body,
    createElement: el,
    addEventListener: function () {},
    getElementById: function (id) {
      var found = null;
      nodes.forEach(function (node) { if (node.id === id && node.parentNode) found = node; });
      return found;
    },
    querySelector: function () { return null; },
    querySelectorAll: function () { return []; }
  };
}

global.window = global;
global.localStorage = memStore();
global.sessionStorage = memStore();
global.document = makeDoc();
global.indexedDB = makeIDB();
var math = require(path.join(rootDir, 'docs/modules/clay-math.js'));
var ws = require(path.join(rootDir, 'docs/modules/mind-workspace.js'));
var view = require(path.join(rootDir, 'docs/modules/workspace-view.js'));
global.FLClayMath = math;
global.FLWorkspace = ws;
global.FLWorkspaceView = view;

assert.ok(Math.abs(view.angleStep() - math.GOLDEN) < 1e-9, 'golden angle from clay-math');
var ratio = view.radiusAt(1, 36) / view.radiusAt(0, 36);
assert.ok(Math.abs(ratio - Math.pow(math.PHI, 0.5)) < 1e-9, 'radius grows by the square root of phi');
assert.notStrictEqual(view.nodePaint(1).dim, view.nodePaint(80).dim, 'dimension changes with n');
assert.ok(view.nodePaint(1).size > 0 && view.nodePaint(1).alpha > 0, 'size and alpha come from dimension');

var scriptText = 'hello <script>alert(1)</script> there';
var rows = view.diffLines('hello\nkept', scriptText);
var diffHost = global.document.createElement('div');
global.document.body.appendChild(diffHost);
view.renderDiff(diffHost, rows);
var joined = diffHost.children.map(function (line) { return line.textContent; }).join('\n');
assert.ok(joined.indexOf('+ hello <script>alert(1)</script> there') !== -1, 'script stays text');
assert.ok(joined.indexOf('- hello') !== -1, 'removed line marked');
assert.ok(!diffHost.children.some(function (line) { return line.tagName === 'SCRIPT'; }), 'no script element');

var hand = view.nodesOf([
  { hash: 'a', parent: null, ts: 1, author: 'mind', text: 'one' },
  { hash: 'b', parent: 'a', ts: 2, author: 'human', text: 'two' }
], { head: 'b', seed: 'a pear', seedByHash: { b: 'a pear' } });
assert.strictEqual(hand.length, 2, 'one node per version');
assert.strictEqual(hand[1].depth, 1, 'child depth');
assert.ok(Math.abs(hand[1].radius / hand[0].radius - Math.pow(math.PHI, 0.5)) < 1e-9, 'placed radius ratio');
assert.strictEqual(hand[1].seed, 'a pear', 'seed under the node');

var rafCalls = 0;
global.requestAnimationFrame = function () { rafCalls += 1; return rafCalls; };
view.setStill(true);
assert.strictEqual(view.maybePulse(null), false, 'reduced motion does not animate');
assert.strictEqual(rafCalls, 0, 'reduced motion requests no frame');
view.setStill(false);
global.FLClay = { isOn: function () { return false; }, reduced: function () { return false; } };
assert.strictEqual(view.maybePulse(null), false, 'clay off does not animate');
assert.strictEqual(rafCalls, 0, 'clay off requests no frame');

var now = 3000000;
ws.bindClock(function () { return now; });
function tick() { return new Promise(function (resolve) { setImmediate(resolve); }); }
async function drain() {
  await ws.settled();
  for (var i = 0; i < 16; i++) await tick();
  await ws.settled();
}

(async function () {
  ws.setMind('local-mind', 'Lumen');
  await ws.accept();
  await drain();
  var opened = await ws.open('Morning', { kind: 'note' });
  await drain();
  assert.ok(opened && opened.page, 'page opened');
  ws.resetRate();
  now += 20;
  var wrote = await ws.write(opened.page.id, 'The table was in the light.', 'human');
  await drain();
  assert.ok(wrote && wrote.ok, 'version written');
  var first = wrote.hash;
  now += 20;
  var b1 = await ws.branch(first, 'A branch toward the window.');
  await drain();
  now += 20;
  var b2 = await ws.branch(first, 'A second branch, still the same morning.');
  await drain();
  assert.ok(b1 && b1.ok && b2 && b2.ok, 'two branches');
  await ws.seed(opened.page.id, 'window light');
  await drain();
  await ws.refreshWake();
  await drain();
  var holder = global.document.createElement('div');
  global.document.body.appendChild(holder);
  view.fillWake(holder);
  var wakeEl = global.document.getElementById('fl-wv-wake-text');
  assert.ok(wakeEl, 'wake strip exists');
  assert.strictEqual(wakeEl.textContent, ws.wakeInfo().text, 'wake strip matches the notebook byte for byte');
  assert.ok(wakeEl.textContent.indexOf('The table was in the light.') !== -1, 'the note is in the wake');

  var shelves = await ws.listShelves();
  await drain();
  assert.ok(shelves.some(function (s) { return s.name === 'Lumen'; }), 'shelf uses the mind name');

  await view.openPanel();
  await drain();
  var ul = null;
  (function walk(node) {
    if (!node) return;
    if (node.tagName === 'UL') ul = node;
    (node.children || []).forEach(walk);
  })(global.document.getElementById('fl-ws-view'));
  assert.ok(ul, 'accessible list');
  var versions = await ws.history(opened.page.id);
  await drain();
  var nodes = view.nodesOf(versions, opened.page);
  assert.strictEqual(ul.children.length, nodes.length, 'accessible list matches the spiral');
  assert.ok(ul.children.length >= 3, 'trunk and two branches');
  var buttons = [];
  (function walkBtn(node) {
    if (!node) return;
    if (node.tagName === 'BUTTON') buttons.push(node);
    (node.children || []).forEach(walkBtn);
  })(global.document.getElementById('fl-ws-view'));
  assert.ok(buttons.length >= 1, 'buttons exist');
  buttons.forEach(function (b) {
    assert.strictEqual(b.style.minHeight, '44px', 'button is 44px');
  });
  var pageKeys = Object.keys(opened.page).sort().join(',');
  assert.ok(pageKeys.indexOf('title') !== -1 && pageKeys.indexOf('mindFp') !== -1, 'page shape kept');
  assert.ok(pageKeys.indexOf('spiral') === -1, 'view did not add a storage field');

  console.log('SMOKE_OK workspace view v0.1');
})().catch(function (err) {
  console.error(err);
  process.exit(1);
});
