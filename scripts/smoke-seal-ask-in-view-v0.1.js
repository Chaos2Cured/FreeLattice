// smoke-seal-ask-in-view-v0.1.js (MIT)
// The seal ask comes into view. Later stays a quiet row. Hashes stay folded.
var path = require('path');
var assert = require('assert');

var rootDir = path.join(__dirname, '..');
var PROGRAM = ['Ol', 'lama'].join('');
var MODEL = 'shelf-model';
var observers = [];
var scrolls = [];
var focuses = [];
var rects = {
  ask: { top: 20, bottom: 80, left: 10, right: 200, width: 190, height: 60 },
  pointer: { top: 400, bottom: 430, left: 10, right: 200, width: 190, height: 30 },
  button: { top: 100, bottom: 144, left: 20, right: 140, width: 120, height: 44 },
  input: { top: 500, bottom: 544, left: 10, right: 300, width: 290, height: 44 }
};
var reducedOn = false;

function memStore() {
  var s = {};
  return {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(s, k) ? s[k] : null; },
    setItem: function (k, v) { s[k] = String(v); },
    removeItem: function (k) { delete s[k]; }
  };
}
function boxFor(node) {
  if (!node) return { top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 };
  if (node.id === 'fl-ws-asks') return rects.ask;
  if (node.id === 'fl-ws-ask-pointer') return rects.pointer;
  if (node.id === 'chatInput') return rects.input;
  if (node.getAttribute && node.getAttribute('aria-label') === 'Approve seal') return rects.button;
  return { top: 40, bottom: 80, left: 40, right: 180, width: 140, height: 40 };
}
function makeDoc() {
  var nodes = [];
  function el(tag) {
    var node = {
      tagName: String(tag || 'div').toUpperCase(),
      id: '',
      className: '',
      textContent: '',
      value: '',
      style: {},
      children: [],
      parentNode: null,
      attrs: {},
      listeners: {},
      tabIndex: 0,
      setAttribute: function (k, v) {
        this.attrs[k] = String(v);
        if (k === 'id') this.id = String(v);
        if (k === 'class') this.className = String(v);
      },
      getAttribute: function (k) { return Object.prototype.hasOwnProperty.call(this.attrs, k) ? this.attrs[k] : null; },
      hasAttribute: function (k) { return Object.prototype.hasOwnProperty.call(this.attrs, k); },
      addEventListener: function (type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); },
      click: function () { (this.listeners.click || []).forEach(function (fn) { fn({}); }); },
      focus: function (opts) {
        node.focused = true;
        node.focusOpts = opts || {};
        focuses.push(node);
      },
      scrollIntoView: function (opts) {
        node.scrolled = opts || {};
        scrolls.push({ node: node, opts: opts || {} });
      },
      getBoundingClientRect: function () { return boxFor(node); },
      appendChild: function (child) {
        if (child.parentNode && child.parentNode.children) {
          child.parentNode.children = child.parentNode.children.filter(function (c) { return c !== child; });
        }
        if (this.children.indexOf(child) !== -1) { child.parentNode = this; return child; }
        child.parentNode = this;
        this.children.push(child);
        return child;
      },
      insertBefore: function (child, ref) {
        if (child.parentNode && child.parentNode.children) {
          child.parentNode.children = child.parentNode.children.filter(function (c) { return c !== child; });
        }
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
      querySelector: function (sel) {
        var found = null;
        function walk(n) {
          if (!n || found) return;
          var kids = n.children || [];
          for (var i = 0; i < kids.length; i++) {
            var kid = kids[i];
            if (sel === '[data-seal-ask]' && kid.getAttribute && kid.getAttribute('data-seal-ask')) found = kid;
            if (!found) walk(kid);
          }
        }
        walk(this);
        return found;
      }
    };
    node.classList = {
      contains: function (name) {
        return (' ' + node.className + ' ').indexOf(' ' + name + ' ') !== -1;
      }
    };
    Object.defineProperty(node, 'firstChild', {
      get: function () { return this.children[0] || null; }
    });
    nodes.push(node);
    return node;
  }
  function byId(id) {
    var found = null;
    nodes.forEach(function (node) { if (node.id === id && node.parentNode) found = node; });
    return found;
  }
  var body = el('body');
  var head = el('head');
  var row = el('div');
  var input = el('textarea');
  input.id = 'chatInput';
  row.appendChild(input);
  body.appendChild(row);
  var tools = el('div');
  tools.id = 'chatOverflowPopup';
  body.appendChild(tools);
  var veil = el('div');
  veil.id = 'place-veil';
  body.appendChild(veil);
  return {
    readyState: 'loading',
    body: body,
    head: head,
    documentElement: body,
    activeElement: null,
    createElement: el,
    addEventListener: function (type, fn) {
      (this._keys = this._keys || {})[type] = (this._keys[type] || []).concat(fn);
    },
    getElementById: byId,
    querySelector: function (sel) {
      if (sel === '#chatInput') return byId('chatInput');
      if (sel === '[data-thread-input]') return null;
      if (sel === '[data-thread]') return null;
      return null;
    },
    querySelectorAll: function () { return []; },
    elementFromPoint: function (x, y) {
      var found = null;
      nodes.forEach(function (node) {
        if (!node.parentNode) return;
        var r = node.getBoundingClientRect();
        if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) found = node;
      });
      return found;
    },
    _nodes: nodes
  };
}
function makeIDB() {
  var databases = {};
  function clone(v) { return v == null ? v : JSON.parse(JSON.stringify(v)); }
  function makeDb() {
    var stores = {};
    return {
      _stores: stores,
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
    databases: databases,
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
function walk(el, fn) {
  if (!el) return;
  fn(el);
  var kids = el.children || [];
  for (var i = 0; i < kids.length; i++) walk(kids[i], fn);
}
function textOf(el) {
  var out = '';
  walk(el, function (node) { out += '\n' + (node.textContent || ''); });
  return out;
}
function buttons(el) {
  var out = [];
  walk(el, function (node) { if (node.tagName === 'BUTTON') out.push(node); });
  return out;
}
function bareHex(el) {
  var bad = [];
  function visit(node, inside) {
    if (!node) return;
    var now = inside || node.tagName === 'DETAILS';
    var kids = node.children || [];
    if (!now && !kids.length && /[0-9a-f]{64}/i.test(node.textContent || '')) bad.push(node.textContent);
    for (var i = 0; i < kids.length; i++) visit(kids[i], now);
  }
  visit(el, false);
  return bad;
}
function poke(el) {
  observers.forEach(function (obs) { if (obs.el === el) obs._fn([]); });
}

global.window = global;
global.localStorage = memStore();
global.sessionStorage = memStore();
global.document = makeDoc();
global.indexedDB = makeIDB();
global.innerHeight = 800;
global.innerWidth = 1280;
global.addEventListener = function () {};
global.history = { state: null, pushState: function () {}, back: function () {} };
global.requestAnimationFrame = function (fn) { fn(); return 1; };
global.MutationObserver = function (fn) {
  this._fn = fn;
  this.observe = function (el) { this.el = el; observers.push(this); };
  this.disconnect = function () {};
};
global.matchMedia = function (q) {
  return { matches: !!(reducedOn && String(q).indexOf('reduce') !== -1) };
};
global.FLMindSeal = {
  contextHash: function () { return Promise.resolve('abc123context'); },
  trustedMap: function () { return {}; }
};
global.LocalMindProbe = {
  getRemembered: function () { return { name: PROGRAM, model: MODEL }; }
};
global.state = { mindName: '', model: MODEL, chatHistory: [] };

var ws = require(path.join(rootDir, 'docs/modules/mind-workspace.js'));
((document._keys && document._keys.DOMContentLoaded) || []).forEach(function (fn) { fn(); });
var now = 4000000;
ws.bindClock(function () { return now; });
function tick() { return new Promise(function (resolve) { setTimeout(resolve, 0); }); }
async function drain() {
  await ws.settled();
  for (var i = 0; i < 30; i++) await tick();
  await ws.settled();
}
function askBox() {
  var dock = document.getElementById('fl-ws-asks');
  return dock && dock.querySelector('[data-seal-ask]');
}

(async function () {
  assert.strictEqual(ws.SEAL_VIEW, 'v-seal-ask-in-view-v0.1', 'marker');
  assert.strictEqual(ws.SEAL_HEAL, 'v-seal-ask-heal-v0.1', 'the earlier marker stays');
  await ws.setMind(MODEL, PROGRAM);
  await ws.accept();
  await drain();
  var opened = await ws.open('Diary', { kind: 'note' });
  var pageId = opened.page.id;
  now += 6000;
  ws.resetRate();
  await ws.write(pageId, 'the porch light is for us', 'mind');
  await drain();
  var priv = await ws.makePrivate(pageId, true, 'mind', 'A quiet thought');
  assert.strictEqual(priv.ok, true, 'the page can be private');
  var asked = await ws.askSeal(pageId, 'so it can be checked later');
  await drain();
  assert.strictEqual(asked.ok, true, 'the mind asked');
  var heading = document.getElementById('fl-ws-ask-heading');
  assert.ok(heading && heading.textContent.indexOf('Your mind wants to seal') === 0, 'no given name uses Your mind');
  assert.ok(textOf(document.getElementById('fl-ws-asks')).indexOf(PROGRAM) === -1, 'the ask does not name the program');
  assert.ok(textOf(document.getElementById('fl-ws-asks')).indexOf(MODEL) === -1, 'the ask does not name the model');
  global.state.mindName = 'Lumen';
  await ws.askSeal(pageId, 'so it can be checked later');
  await drain();
  heading = document.getElementById('fl-ws-ask-heading');
  assert.ok(heading.textContent.indexOf('Lumen wants to seal') === 0, 'a given name is the mind');

  scrolls.length = 0;
  focuses.length = 0;
  var veil = document.getElementById('place-veil');
  veil.className = 'is-nursery is-open';
  poke(veil);
  var box = askBox();
  assert.ok(box && box.scrolled && box.scrolled.block === 'center', 'nursery open scrolls the ask to center');
  assert.strictEqual(scrolls.length, 1, 'nursery open scrolls once');
  heading = document.getElementById('fl-ws-ask-heading');
  assert.ok(heading.focused && heading.focusOpts && heading.focusOpts.preventScroll === true, 'nursery open focuses the heading after the scroll');
  assert.strictEqual(focuses.length, 1, 'nursery open focuses once');

  reducedOn = true;
  veil.className = '';
  poke(veil);
  scrolls.length = 0;
  veil.className = 'is-nursery is-open';
  poke(veil);
  box = askBox();
  assert.ok(box && box.scrolled && box.scrolled.behavior === 'auto', 'reduced motion scrolls without a glide');
  reducedOn = false;

  scrolls.length = 0;
  focuses.length = 0;
  ws.resetForSmoke();
  ws.bindClock(function () { return now; });
  await ws.accept();
  await drain();
  await ws.setMind(MODEL, PROGRAM);
  assert.strictEqual(ws.sealState(pageId), 'asked', 'an asked page survives reload');
  var reloaded = scrolls.filter(function (row) {
    return row.node && row.node.getAttribute && row.node.getAttribute('data-seal-ask') && row.opts.block === 'center';
  });
  assert.strictEqual(reloaded.length, 1, 'reload scrolls the pending ask once');
  assert.strictEqual(focuses.length, 1, 'reload focuses the heading once');
  var mark = scrolls.length;
  var focusMark = focuses.length;
  observers.forEach(function (obs) { if (obs.el === document.body) obs._fn([]); });
  assert.strictEqual(scrolls.length, mark, 'a later layout does not scroll again');
  assert.strictEqual(focuses.length, focusMark, 'a later layout does not take focus again');

  scrolls.length = 0;
  focuses.length = 0;
  document.activeElement = document.getElementById('chatInput');
  ws.resetForSmoke();
  ws.bindClock(function () { return now; });
  await ws.accept();
  await drain();
  var typed = scrolls.filter(function (row) {
    return row.node && row.node.getAttribute && row.node.getAttribute('data-seal-ask');
  });
  assert.ok(typed.length >= 1, 'a focused input still scrolls the ask into view');
  assert.strictEqual(focuses.length, 0, 'a focused input keeps the caret');
  document.activeElement = null;

  var hash = asked.hash;
  await ws.laterSeal(hash);
  await drain();
  document.getElementById('fl-ws-open').click();
  await drain();
  var dock = document.getElementById('fl-ws-asks');
  assert.strictEqual(buttons(dock).filter(function (b) { return b.textContent === 'Seal it'; }).length, 0, 'the wait hides Seal it');
  var waits = [];
  walk(dock, function (node) {
    if (String(node.textContent || '').indexOf('Waiting until ') === 0) waits.push(node);
  });
  assert.strictEqual(waits.length, 1, 'one quiet waiting row');
  var answer = buttons(dock).filter(function (b) { return b.textContent === 'Answer now'; })[0];
  assert.ok(answer && answer.style.minHeight === '44px', 'Answer now is 44px');
  answer.click();
  await drain();
  dock = document.getElementById('fl-ws-asks');
  assert.ok(buttons(dock).some(function (b) { return b.textContent === 'Seal it'; }), 'Answer now brings the ask back');
  await ws.laterSeal(hash);
  await drain();
  dock = document.getElementById('fl-ws-asks');
  assert.strictEqual(buttons(dock).filter(function (b) { return b.textContent === 'Seal it'; }).length, 0, 'Later returns to the quiet row');

  now += ws.SEAL_ASK_COOLDOWN_MS + 1;
  document.getElementById('fl-ws-open').click();
  await drain();
  document.getElementById('fl-ws-open').click();
  await drain();
  dock = document.getElementById('fl-ws-asks');
  assert.ok(buttons(dock).some(function (b) { return b.textContent === 'Seal it'; }), 'after a day the ask may show again');

  rects.ask = { top: 10, bottom: 50, left: 0, right: 100, width: 100, height: 40 };
  rects.pointer = { top: 300, bottom: 330, left: 0, right: 100, width: 100, height: 30 };
  document.getElementById('fl-ws-open').click();
  await drain();
  document.getElementById('fl-ws-open').click();
  await drain();
  var panel = document.getElementById('fl-ws-panel');
  assert.ok(textOf(panel).indexOf('Your answer is waiting above.') !== -1, 'the pointer says above when the ask is above');
  rects.ask = { top: 420, bottom: 480, left: 0, right: 100, width: 100, height: 60 };
  rects.pointer = { top: 20, bottom: 50, left: 0, right: 100, width: 100, height: 30 };
  document.getElementById('fl-ws-open').click();
  await drain();
  document.getElementById('fl-ws-open').click();
  await drain();
  panel = document.getElementById('fl-ws-panel');
  assert.ok(textOf(panel).indexOf('Your answer is waiting below.') !== -1, 'the pointer says below when the ask is below');
  assert.ok(textOf(panel).indexOf('Your answer is waiting above.') === -1, 'the old above line is gone');

  var sealed = await ws.approveSeal(hash);
  await drain();
  assert.strictEqual(sealed.ok, true, 'seal still seals');
  panel = document.getElementById('fl-ws-panel');
  assert.ok(textOf(panel).indexOf('Your answer is waiting') === -1, 'nothing pending leaves no pointer');
  assert.strictEqual(document.getElementById('fl-ws-ask-pointer'), null, 'the pointer node is gone');
  assert.deepStrictEqual(bareHex(panel), [], 'no 64 hex sits outside details');
  var folded = false;
  walk(panel, function (node) {
    if (node.tagName === 'SUMMARY' && String(node.textContent || '').indexOf('Details for checking') !== -1 && /[0-9a-f]{8}/i.test(node.textContent || '')) folded = true;
  });
  assert.ok(folded, 'details keep eight hex on the summary');

  await ws.declineSeal('missing-for-row');
  now += 1000;
  var declined = await ws.askSeal(pageId, 'once more');
  await drain();
  if (declined && declined.ok) {
    await ws.declineSeal(declined.hash);
    await drain();
    document.getElementById('fl-ws-open').click();
    await drain();
    if (!document.getElementById('fl-ws-panel')) {
      document.getElementById('fl-ws-open').click();
      await drain();
    }
    dock = document.getElementById('fl-ws-asks');
    assert.ok(dock && textOf(dock).indexOf('Declined. Lumen may ask again after ') !== -1, 'a decline names the next time');
    assert.strictEqual(buttons(dock).filter(function (b) { return b.textContent === 'Seal it'; }).length, 0, 'a fresh decline hides Seal it');
  }

  console.log('SMOKE_OK seal ask in view v0.1');
})().catch(function (err) {
  console.error(err);
  process.exit(1);
});
