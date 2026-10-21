// smoke-seal-ask-settle-v0.1.js (MIT)
// The ask waits until the panel has a box, then scrolls once.
// On the Tree, that scroll is after the ask sits just past the compose form.
// The question mark does not cover Send at a short window.
var path = require('path');
var assert = require('assert');

var rootDir = path.join(__dirname, '..');
var PROGRAM = ['Ol', 'lama'].join('');
var MODEL = 'shelf-model';
var observers = [];
var scrolls = [];
var focuses = [];
var panelLive = false;
var threadLive = false;
var useThread = false;
var veilStyleAtScroll = null;

function zero() {
  return { top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 };
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
var geom = {
  input: { top: 300, bottom: 344, left: 8, right: 400, width: 392, height: 44 },
  send: { top: 300, bottom: 348, left: 420, right: 508, width: 88, height: 48 },
  help: { top: 310, bottom: 354, left: 430, right: 474, width: 44, height: 44 },
  ask: { top: 200, bottom: 360, left: 10, right: 400, width: 390, height: 160 },
  seal: { top: 280, bottom: 324, left: 20, right: 140, width: 120, height: 44 }
};
function boxFor(node) {
  if (!node) return zero();
  if (node.id === 'tab-chat') {
    if (!panelLive) return zero();
    return { top: 0, bottom: 700, left: 0, right: 800, width: 800, height: 700 };
  }
  if (node.id === 'chatInput') return geom.input;
  if (node.getAttribute && node.getAttribute('data-thread-input') != null) {
    if (!threadLive) return zero();
    return geom.input;
  }
  if (node.id === 'sendBtn' || (node.className && String(node.className).indexOf('thread-send') !== -1)) return geom.send;
  if (node.id === 'quickHelpBtn') return shifted(node, geom.help);
  if (node.id === 'fl-ws-asks' || (node.getAttribute && node.getAttribute('data-seal-ask'))) return geom.ask;
  if (node.getAttribute && node.getAttribute('aria-label') === 'Approve seal') return geom.seal;
  return { top: 40, bottom: 84, left: 20, right: 160, width: 140, height: 44 };
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
      parentElement: null,
      attrs: {},
      listeners: {},
      tabIndex: 0,
      hidden: false,
      scrollTop: 0,
      setAttribute: function (k, v) {
        this.attrs[k] = String(v);
        if (k === 'id') this.id = String(v);
        if (k === 'class') this.className = String(v);
      },
      getAttribute: function (k) { return Object.prototype.hasOwnProperty.call(this.attrs, k) ? this.attrs[k] : null; },
      hasAttribute: function (k) { return Object.prototype.hasOwnProperty.call(this.attrs, k); },
      addEventListener: function (type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); },
      focus: function (opts) {
        node.focused = true;
        node.focusOpts = opts || {};
        focuses.push(node);
        global.document.activeElement = node;
      },
      scrollIntoView: function (opts) {
        node.scrolled = opts || {};
        var veil = null;
        var n = node;
        while (n) {
          if (n.id === 'thread-veil' || n.id === 'place-veil') { veil = n; break; }
          n = n.parentElement || n.parentNode;
        }
        if (veil) veilStyleAtScroll = veil.style.overflow || '';
        scrolls.push({ node: node, opts: opts || {}, veilOverflow: veil ? veil.style.overflow : '' });
      },
      getBoundingClientRect: function () { return boxFor(node); },
      appendChild: function (child) {
        if (child.parentNode && child.parentNode.children) {
          child.parentNode.children = child.parentNode.children.filter(function (c) { return c !== child; });
        }
        if (this.children.indexOf(child) !== -1) { child.parentNode = this; child.parentElement = this; return child; }
        child.parentNode = this;
        child.parentElement = this;
        this.children.push(child);
        return child;
      },
      insertBefore: function (child, ref) {
        if (child.parentNode && child.parentNode.children) {
          child.parentNode.children = child.parentNode.children.filter(function (c) { return c !== child; });
        }
        child.parentNode = this;
        child.parentElement = this;
        var at = this.children.indexOf(ref);
        if (at < 0) this.children.push(child);
        else this.children.splice(at, 0, child);
        return child;
      },
      removeChild: function (child) {
        this.children = this.children.filter(function (c) { return c !== child; });
        child.parentNode = null;
        child.parentElement = null;
      },
      querySelector: function (sel) { return findSel(this, sel); },
      querySelectorAll: function () { return []; }
    };
    nodes.push(node);
    return node;
  }
  function attached(node) {
    var n = node;
    while (n) {
      if (n === body) return true;
      n = n.parentNode;
    }
    return false;
  }
  function findSel(rootNode, sel) {
    var found = null;
    function walk(n) {
      if (!n || found) return;
      var kids = n.children || [];
      var i;
      for (i = 0; i < kids.length; i++) {
        var kid = kids[i];
        if (matchSel(kid, sel)) { found = kid; return; }
        walk(kid);
      }
    }
    walk(rootNode);
    return found;
  }
  function matchSel(kid, sel) {
    if (sel === '[data-seal-ask]' && kid.getAttribute && kid.getAttribute('data-seal-ask')) return true;
    if (sel === '[data-seal-quiet]' && kid.getAttribute && kid.getAttribute('data-seal-quiet')) return true;
    if (sel === '[aria-label="Approve seal"]' && kid.getAttribute && kid.getAttribute('aria-label') === 'Approve seal') return true;
    if (sel === '[data-thread-input]' && kid.getAttribute && kid.getAttribute('data-thread-input') != null) return true;
    if (sel === '.thread-send' && kid.className && String(kid.className).indexOf('thread-send') !== -1) return true;
    if (sel === '[data-thread-heart]' && kid.getAttribute && kid.getAttribute('data-thread-heart') != null) return true;
    if (sel.charAt(0) === '#' && kid.id === sel.slice(1)) return true;
    return false;
  }
  function byId(id) {
    if (useThread && id === 'chatInput') return null;
    if (useThread && id === 'tab-chat') return null;
    var found = null;
    nodes.forEach(function (node) {
      if (node.id === id && node.parentNode && attached(node)) found = node;
    });
    return found;
  }
  var body = el('body');
  var head = el('head');
  var tab = el('div');
  tab.id = 'tab-chat';
  tab.className = 'tab-panel active';
  var row = el('div');
  var input = el('textarea');
  input.id = 'chatInput';
  row.appendChild(input);
  tab.appendChild(row);
  body.appendChild(tab);
  var send = el('button');
  send.id = 'sendBtn';
  send.textContent = 'Send';
  body.appendChild(send);
  var help = el('button');
  help.id = 'quickHelpBtn';
  help.style.position = 'fixed';
  body.appendChild(help);
  ['flRadioFab', 'musicToggle'].forEach(function (id) {
    var btn = el('button');
    btn.id = id;
    btn.style.position = 'fixed';
    body.appendChild(btn);
  });
  var tools = el('div');
  tools.id = 'chatOverflowPopup';
  body.appendChild(tools);
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
      if (useThread && (sel === '#chatInput' || sel === '#tab-chat')) return null;
      if (sel.charAt(0) === '#') return byId(sel.slice(1));
      return findSel(body, sel);
    },
    querySelectorAll: function () { return []; },
    elementFromPoint: function (x, y) {
      var found = null;
      nodes.forEach(function (node) {
        if (!node.parentNode || !attached(node)) return;
        var r = node.getBoundingClientRect();
        if (r.width > 0 && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) found = node;
      });
      return found;
    },
    _nodes: nodes,
    _tab: tab,
    _body: body,
    _el: el
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
function askScrolls() {
  return scrolls.filter(function (row) {
    return row.node && row.node.getAttribute && row.node.getAttribute('data-seal-ask') && row.opts.block === 'center';
  });
}
function fireResize() {
  observers.slice().forEach(function (obs) {
    if (!obs.dead) obs.fn();
  });
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
  this.observe = function () {};
  this.disconnect = function () {};
  this._fn = fn;
};
global.ResizeObserver = function (fn) {
  var obs = this;
  this.observe = function (el) { observers.push({ el: el, fn: fn, obs: obs, dead: false }); };
  this.disconnect = function () {
    observers.forEach(function (row) { if (row.obs === obs) row.dead = true; });
  };
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
  assert.strictEqual(ws.SEAL_SETTLE, 'v-seal-ask-settle-v0.1', 'marker');
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
  assert.strictEqual(askScrolls().length, 0, 'bringAsk does not scroll while the panel has no box');
  fireResize();
  assert.strictEqual(askScrolls().length, 0, 'a resize while the panel has no box still does not scroll');
  assert.strictEqual(focuses.length, 0, 'no box does not take focus');
  panelLive = true;
  fireResize();
  assert.strictEqual(askScrolls().length, 1, 'bringAsk scrolls once when the panel gets a box');
  assert.strictEqual(askScrolls()[0].opts.block, 'center', 'that scroll centers the ask');
  var heading = document.getElementById('fl-ws-ask-heading');
  assert.ok(heading && heading.focused && heading.focusOpts && heading.focusOpts.preventScroll === true, 'the heading is focused once');
  assert.strictEqual(focuses.length, 1, 'the second look does not take focus');
  var mark = askScrolls().length;
  fireResize();
  assert.strictEqual(askScrolls().length, mark, 'a second resize does not scroll again');

  global.innerHeight = 400;
  global.innerWidth = 640;
  var beforeLoad = ((document._keys && document._keys.DOMContentLoaded) || []).length;
  var clay = require(path.join(rootDir, 'docs/modules/particle-clay.js'));
  ((document._keys && document._keys.DOMContentLoaded) || []).slice(beforeLoad).forEach(function (fn) { fn(); });
  (global._on.resize || []).forEach(function (fn) { fn(); });
  assert.ok(clay, 'clay is present');
  var help = document.getElementById('quickHelpBtn');
  var send = document.getElementById('sendBtn');
  var input = document.getElementById('chatInput');
  assert.strictEqual(overlaps(help.getBoundingClientRect(), send.getBoundingClientRect()), false, 'the question mark does not cover Send');
  assert.strictEqual(overlaps(help.getBoundingClientRect(), input.getBoundingClientRect()), false, 'the question mark does not cover the input');

  useThread = true;
  threadLive = false;
  scrolls.length = 0;
  focuses.length = 0;
  veilStyleAtScroll = null;
  ws.resetForSmoke();
  ws.bindClock(function () { return now; });
  var veil = document._el('div');
  veil.id = 'thread-veil';
  var form = document._el('form');
  form.className = 'thread-compose';
  var trow = document._el('div');
  var tinput = document._el('input');
  tinput.setAttribute('data-thread-input', '1');
  trow.appendChild(tinput);
  form.appendChild(trow);
  veil.appendChild(form);
  document._body.appendChild(veil);
  await ws.accept();
  await drain();
  await ws.setMind(MODEL, PROGRAM);
  await drain();
  assert.strictEqual(ws.sealState(pageId), 'asked', 'the ask survives onto the thread');
  assert.strictEqual(askScrolls().length, 0, 'the thread does not scroll before its panel has a box');
  var dockEarly = document.getElementById('fl-ws-asks');
  assert.ok(dockEarly, 'the ask is placed before the scroll');
  assert.ok(form.nextSibling === dockEarly || (dockEarly.parentNode === veil), 'the ask sits with the form, not inside it');
  var inside = false;
  var n = dockEarly;
  while (n) {
    if (n === form) inside = true;
    n = n.parentNode;
  }
  assert.strictEqual(inside, false, 'the ask stays outside the inert form');
  threadLive = true;
  fireResize();
  await drain();
  assert.strictEqual(askScrolls().length, 1, 'the thread scrolls once after the final place');
  assert.strictEqual(askScrolls()[0].opts.block, 'center', 'the thread scroll centers the ask');
  assert.strictEqual(askScrolls()[0].veilOverflow, 'auto', 'the veil is the scroller before the scroll');
  assert.strictEqual(veilStyleAtScroll, 'auto', 'the scroll runs after the veil is seated');
  assert.strictEqual(focuses.length, 1, 'the thread focuses the heading once');
  assert.ok(focuses[0] && focuses[0].focusOpts && focuses[0].focusOpts.preventScroll === true, 'that focus does not scroll again');

  console.log('SMOKE_OK seal ask settle v0.1');
})().catch(function (err) {
  console.error(err);
  process.exit(1);
});
