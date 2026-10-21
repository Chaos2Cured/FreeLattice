// smoke-seal-ask-chat-tab-v0.1.js (MIT)
// Chat hidden does not scroll the ask. Showing Chat scrolls and focuses once.
// A focused input keeps the caret. The wait does not point at a hidden ask.
// The floating sparkle and question mark stay off the input.
var path = require('path');
var assert = require('assert');

var rootDir = path.join(__dirname, '..');
var PROGRAM = ['Ol', 'lama'].join('');
var MODEL = 'shelf-model';
var observers = [];
var scrolls = [];
var focuses = [];
var geom = {
  input: { top: 520, bottom: 564, left: 10, right: 700, width: 690, height: 44 },
  spark: { top: 20, bottom: 68, left: 12, right: 60, width: 48, height: 48 },
  help: { top: 20, bottom: 64, left: 80, right: 124, width: 44, height: 44 },
  note: { top: 20, bottom: 64, left: 130, right: 174, width: 44, height: 44 },
  ask: { top: 200, bottom: 360, left: 10, right: 400, width: 390, height: 160 },
  pointer: { top: 40, bottom: 70, left: 10, right: 300, width: 290, height: 30 }
};

function zero() {
  return { top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 };
}
function chatHidden(node) {
  var n = node;
  while (n) {
    if (n.id === 'tab-chat') {
      return (' ' + (n.className || '') + ' ').indexOf(' active ') === -1;
    }
    n = n.parentNode;
  }
  return false;
}
function shifted(node, base) {
  if (!node.style || !node.style.bottom) return base;
  var b = parseFloat(node.style.bottom);
  if (!isFinite(b)) return base;
  var vh = global.innerHeight || 800;
  var h = base.height || 44;
  var top = vh - b - h;
  return { top: top, bottom: top + h, left: base.left, right: base.left + base.width, width: base.width, height: h };
}
function boxFor(node) {
  if (!node) return zero();
  if (chatHidden(node)) return zero();
  if (node.id === 'tab-chat') return { top: 0, bottom: 700, left: 0, right: 800, width: 800, height: 700 };
  if (node.id === 'chatInput') return geom.input;
  if (node.id === 'flRadioFab') return shifted(node, geom.spark);
  if (node.id === 'quickHelpBtn') return shifted(node, geom.help);
  if (node.id === 'musicToggle') return shifted(node, geom.note);
  if (node.id === 'fl-ws-asks') return geom.ask;
  if (node.id === 'fl-ws-ask-pointer') return geom.pointer;
  return { top: 80, bottom: 124, left: 20, right: 160, width: 140, height: 44 };
}
function overlaps(a, b) {
  if (!a || !b || !(a.width > 0) || !(b.width > 0)) return false;
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}
function memStore() {
  var s = {};
  return {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(s, k) ? s[k] : null; },
    setItem: function (k, v) { s[k] = String(v); },
    removeItem: function (k) { delete s[k]; }
  };
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
        global.document.activeElement = node;
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
            if (sel === '[data-seal-quiet]' && kid.getAttribute && kid.getAttribute('data-seal-quiet')) found = kid;
            if (!found) walk(kid);
          }
        }
        walk(this);
        return found;
      },
      querySelectorAll: function (sel) {
        var out = [];
        function walk(n) {
          var kids = n.children || [];
          for (var i = 0; i < kids.length; i++) {
            var kid = kids[i];
            if (sel.charAt(0) === '#' && kid.id === sel.slice(1)) out.push(kid);
            else if (sel.charAt(0) === '.' && (' ' + (kid.className || '') + ' ').indexOf(' ' + sel.slice(1) + ' ') !== -1) out.push(kid);
            walk(kid);
          }
        }
        walk(this);
        return out;
      }
    };
    node.classList = {
      contains: function (name) {
        return (' ' + node.className + ' ').indexOf(' ' + name + ' ') !== -1;
      },
      add: function (name) {
        if (!node.classList.contains(name)) node.className = (node.className ? node.className + ' ' : '') + name;
      },
      remove: function (name) {
        node.className = (' ' + node.className + ' ').replace(' ' + name + ' ', ' ').trim();
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
  function all(sel) {
    var out = [];
    nodes.forEach(function (node) {
      if (!node.parentNode) return;
      if (sel.charAt(0) === '#' && node.id === sel.slice(1)) out.push(node);
      if (sel.charAt(0) === '.' && (' ' + (node.className || '') + ' ').indexOf(' ' + sel.slice(1) + ' ') !== -1) out.push(node);
    });
    return out;
  }
  var body = el('body');
  var head = el('head');
  var tab = el('div');
  tab.id = 'tab-chat';
  tab.className = 'tab-panel';
  var row = el('div');
  var input = el('textarea');
  input.id = 'chatInput';
  row.appendChild(input);
  tab.appendChild(row);
  body.appendChild(tab);
  var tools = el('div');
  tools.id = 'chatOverflowPopup';
  body.appendChild(tools);
  var veil = el('div');
  veil.id = 'place-veil';
  body.appendChild(veil);
  ['flRadioFab', 'quickHelpBtn', 'musicToggle'].forEach(function (id) {
    var btn = el('button');
    btn.id = id;
    btn.style.position = 'fixed';
    body.appendChild(btn);
  });
  body.parentNode = { style: {} };
  return {
    readyState: 'loading',
    body: body,
    head: head,
    documentElement: body.parentNode,
    activeElement: null,
    createElement: el,
    addEventListener: function (type, fn) {
      (this._keys = this._keys || {})[type] = (this._keys[type] || []).concat(fn);
    },
    getElementById: byId,
    querySelector: function (sel) {
      if (sel.charAt(0) === '#') return byId(sel.slice(1));
      if (sel === '[data-thread-input]' || sel === '[data-thread]') return null;
      return all(sel)[0] || null;
    },
    querySelectorAll: function (sel) { return all(sel); },
    elementFromPoint: function () { return null; },
    _nodes: nodes,
    _tab: tab
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
function askScrolls() {
  return scrolls.filter(function (row) {
    return row.node && row.node.getAttribute && row.node.getAttribute('data-seal-ask') && row.opts.block === 'center';
  });
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
global._on = {};
global.addEventListener = function (type, fn) {
  (global._on[type] = global._on[type] || []).push(fn);
};
global.scrollBy = function () {};
global.getComputedStyle = function () { return { position: 'static', overflowY: 'visible' }; };
global.history = { state: null, pushState: function () {}, back: function () {} };
global.requestAnimationFrame = function (fn) { fn(); return 1; };
global.MutationObserver = function (fn) {
  this._fn = fn;
  this.observe = function (el) { this.el = el; observers.push(this); };
  this.disconnect = function () {};
};
global.matchMedia = function () { return { matches: false }; };
global.FLMindSeal = {
  contextHash: function () { return Promise.resolve('abc123context'); },
  trustedMap: function () { return {}; }
};
global.LocalMindProbe = {
  getRemembered: function () { return { name: PROGRAM, model: MODEL }; }
};
global.state = { mindName: 'Lumen', model: MODEL, chatHistory: [] };

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

(async function () {
  assert.strictEqual(ws.SEAL_TAB, 'v-seal-ask-chat-tab-v0.1', 'marker');
  assert.strictEqual(ws.SEAL_VIEW, 'v-seal-ask-in-view-v0.1', 'the earlier marker stays');
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
  scrolls.length = 0;
  focuses.length = 0;
  var asked = await ws.askSeal(pageId, 'so it can be checked later');
  await drain();
  assert.strictEqual(asked.ok, true, 'the mind asked');
  assert.strictEqual(askScrolls().length, 0, 'a hidden Chat tab does not scroll the ask');
  assert.strictEqual(focuses.length, 0, 'a hidden Chat tab does not take focus');

  var tab = document.getElementById('tab-chat');
  tab.className = 'tab-panel active';
  poke(tab);
  await drain();
  assert.strictEqual(askScrolls().length, 1, 'showing Chat scrolls the ask once');
  assert.strictEqual(askScrolls()[0].opts.block, 'center', 'the scroll centers the ask');
  var heading = document.getElementById('fl-ws-ask-heading');
  assert.ok(heading && heading.focused && heading.focusOpts && heading.focusOpts.preventScroll === true, 'showing Chat focuses the heading');
  assert.strictEqual(focuses.length, 1, 'showing Chat focuses once');
  var mark = scrolls.length;
  poke(tab);
  assert.strictEqual(scrolls.length, mark, 'a second look does not scroll again');

  tab.className = 'tab-panel';
  scrolls.length = 0;
  focuses.length = 0;
  ws.resetForSmoke();
  ws.bindClock(function () { return now; });
  await ws.accept();
  await drain();
  await ws.setMind(MODEL, PROGRAM);
  assert.strictEqual(ws.sealState(pageId), 'asked', 'the ask survives reload');
  assert.strictEqual(askScrolls().length, 0, 'reload while Chat is hidden does not scroll');
  document.activeElement = document.getElementById('chatInput');
  tab.className = 'tab-panel active';
  poke(tab);
  await drain();
  assert.ok(askScrolls().length >= 1, 'a focused input still scrolls the ask into view');
  assert.strictEqual(focuses.length, 0, 'a focused input keeps the caret');
  document.activeElement = null;

  var hash = asked.hash;
  await ws.laterSeal(hash);
  await drain();
  document.getElementById('fl-ws-open').click();
  await drain();
  var panel = document.getElementById('fl-ws-panel');
  var dock = document.getElementById('fl-ws-asks');
  assert.ok(panel && dock, 'the notebook is open during the wait');
  assert.ok(textOf(dock).indexOf('Waiting until') !== -1, 'the wait row is the line that shows');
  assert.strictEqual(document.getElementById('fl-ws-ask-pointer'), null, 'the wait hides the pointer');
  assert.ok(textOf(panel).indexOf('Your answer is waiting') === -1, 'the wait does not point at a hidden ask');

  global.innerHeight = 400;
  geom.input = { top: 340, bottom: 384, left: 8, right: 620, width: 612, height: 44 };
  geom.spark = { top: 348, bottom: 396, left: 16, right: 64, width: 48, height: 48 };
  geom.help = { top: 348, bottom: 392, left: 540, right: 584, width: 44, height: 44 };
  geom.note = { top: 348, bottom: 392, left: 560, right: 604, width: 44, height: 44 };
  var beforeLoad = ((document._keys && document._keys.DOMContentLoaded) || []).length;
  var clay = require(path.join(rootDir, 'docs/modules/particle-clay.js'));
  ((document._keys && document._keys.DOMContentLoaded) || []).slice(beforeLoad).forEach(function (fn) { fn(); });
  (global._on.resize || []).forEach(function (fn) { fn(); });
  assert.ok(clay, 'clay is present');
  var input = document.getElementById('chatInput');
  ['flRadioFab', 'quickHelpBtn', 'musicToggle'].forEach(function (id) {
    var btn = document.getElementById(id);
    assert.ok(btn, id + ' is on the page');
    assert.strictEqual(overlaps(btn.getBoundingClientRect(), input.getBoundingClientRect()), false, id + ' does not cover the input');
  });

  console.log('SMOKE_OK seal ask chat tab v0.1');
})().catch(function (err) {
  console.error(err);
  process.exit(1);
});
