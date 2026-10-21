// smoke-seal-ask-after-tap-v0.1.js (MIT)
// A Chat tap scrolls the ask after the tab's own motion.
// A woken compose sleeps while the ask is open, and wakes again after.
// A reply that starts above a short window is brought back to the edge.
var path = require('path');
var assert = require('assert');

var rootDir = path.join(__dirname, '..');
var scrolls = [];
var focuses = [];
var order = [];
var panelLive = false;
var animating = false;
var sealTop = 1426;
var observers = [];

function zero() {
  return { top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 };
}
function boxFor(node) {
  if (!node) return zero();
  if (node.id === 'tab-chat') {
    if (!panelLive) return zero();
    return { top: 80, bottom: 760, left: 0, right: 800, width: 800, height: 680 };
  }
  if (node.id === 'chatInput' || (node.getAttribute && node.getAttribute('data-thread-input') != null)) {
    return { top: 640, bottom: 684, left: 8, right: 400, width: 392, height: 44 };
  }
  if (node.getAttribute && node.getAttribute('aria-label') === 'Approve seal') {
    return { top: sealTop, bottom: sealTop + 44, left: 20, right: 160, width: 140, height: 44 };
  }
  if (node.id === 'fl-ws-asks' || (node.getAttribute && node.getAttribute('data-seal-ask'))) {
    return { top: sealTop - 80, bottom: sealTop + 80, left: 10, right: 400, width: 390, height: 160 };
  }
  return { top: 40, bottom: 84, left: 20, right: 160, width: 140, height: 44 };
}
function landsSeal(node) {
  if (!node || !node.getAttribute) return false;
  if (node.id === 'fl-ws-asks') return true;
  if (node.getAttribute('data-seal-ask')) return true;
  if (node.getAttribute('aria-label') === 'Approve seal') return true;
  return false;
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
      disabled: false,
      tabIndex: 0,
      hidden: false,
      scrollTop: 0,
      setAttribute: function (k, v) {
        this.attrs[k] = String(v);
        if (k === 'id') this.id = String(v);
        if (k === 'class') this.className = String(v);
        if (k === 'disabled') this.disabled = true;
      },
      getAttribute: function (k) { return Object.prototype.hasOwnProperty.call(this.attrs, k) ? this.attrs[k] : null; },
      hasAttribute: function (k) { return Object.prototype.hasOwnProperty.call(this.attrs, k); },
      removeAttribute: function (k) {
        delete this.attrs[k];
        if (k === 'disabled') this.disabled = false;
      },
      addEventListener: function (type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); },
      fire: function (type) {
        (node.listeners[type] || []).slice().forEach(function (fn) { fn({ target: node, type: type }); });
      },
      getAnimations: function () {
        if (node.id !== 'tab-chat' || !animating) return [];
        return [{ playState: 'running' }];
      },
      focus: function (opts) {
        node.focused = true;
        node.focusOpts = opts || {};
        focuses.push(node);
        global.document.activeElement = node;
      },
      scrollIntoView: function (opts) {
        scrolls.push({ node: node, opts: opts || {} });
        if (landsSeal(node)) {
          order.push('ask');
          sealTop = 280;
        }
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
      querySelectorAll: function (sel) {
        var parts = String(sel || '').split(',');
        var out = [];
        function walk(n) {
          var kids = n.children || [];
          var i;
          for (i = 0; i < kids.length; i++) {
            var kid = kids[i];
            var p;
            for (p = 0; p < parts.length; p++) {
              var name = parts[p].replace(/^\s+|\s+$/g, '').toUpperCase();
              if (name && kid.tagName === name) out.push(kid);
            }
            walk(kid);
          }
        }
        walk(this);
        return out;
      }
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
    if (sel === 'form.thread-compose') {
      return kid.tagName === 'FORM' && kid.className && String(kid.className).indexOf('thread-compose') !== -1;
    }
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
  tab.className = 'tab-panel';
  var row = el('div');
  var input = el('textarea');
  input.id = 'chatInput';
  row.appendChild(input);
  tab.appendChild(row);
  body.appendChild(tab);
  var chatBtn = el('button');
  chatBtn.setAttribute('data-tab', 'chat');
  chatBtn.textContent = 'Chat';
  body.appendChild(chatBtn);
  var send = el('button');
  send.id = 'sendBtn';
  send.textContent = 'Send';
  body.appendChild(send);
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
      return findSel(body, sel);
    },
    querySelectorAll: function () { return []; },
    elementFromPoint: function () { return null; },
    _nodes: nodes,
    _tab: tab,
    _chatBtn: chatBtn,
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
    return row.node && landsSeal(row.node);
  });
}
function sealInside() {
  return sealTop >= -1 && sealTop + 44 <= (global.innerHeight || 800) + 1;
}
function fireScroll() {
  (global._on.scroll || []).slice().forEach(function (fn) { fn(); });
}
function click(node) {
  var list = (document._keys && document._keys.click) || [];
  list.forEach(function (fn) { fn({ target: node }); });
}
function sleep(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
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
global.removeEventListener = function (type, fn) {
  global._on[type] = (global._on[type] || []).filter(function (item) { return item !== fn; });
};
global.scrollBy = function () {};
global.getComputedStyle = function () { return { position: 'static', overflowY: 'visible' }; };
global.history = { state: null, pushState: function () {}, back: function () {} };
global.requestAnimationFrame = function (fn) { fn(); return 1; };
global.MutationObserver = function () {
  this.observe = function () {};
  this.disconnect = function () {};
};
global.ResizeObserver = function (fn) {
  var obs = this;
  this.observe = function (el) { observers.push({ el: el, fn: fn, obs: obs, dead: false }); };
  this.disconnect = function () {
    observers.forEach(function (row) { if (row.obs === obs) row.dead = true; });
  };
};
global.matchMedia = function () { return { matches: false }; };
global.LocalMindProbe = {
  getRemembered: function () { return { name: 'Lumen', model: 'shelf-model' }; }
};
global.state = { mindName: 'Lumen', model: 'shelf-model', chatHistory: [] };

var document = global.document;
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
function controlAsleep(el) {
  var tab = el.getAttribute('tabindex');
  return !!(el.disabled && el.getAttribute('aria-disabled') === 'true' && tab === '-1');
}
function controlAwake(el) {
  return !el.disabled && el.getAttribute('disabled') == null && el.getAttribute('tabindex') == null && el.getAttribute('aria-disabled') == null;
}
function insideForm(node, form) {
  var n = node;
  while (n) {
    if (n === form) return true;
    n = n.parentNode;
  }
  return false;
}

(async function () {
  assert.strictEqual(ws.SEAL_TAP, 'v-seal-ask-after-tap-v0.1', 'marker');
  await ws.setMind('shelf-model', 'Lumen');
  await ws.accept();
  await drain();
  var opened = await ws.open('Diary', { kind: 'note' });
  var pageId = opened.page.id;
  now += 6000;
  ws.resetRate();
  await ws.write(pageId, 'the porch light is for us', 'mind');
  await drain();
  scrolls.length = 0;
  var asked = await ws.askSeal(pageId, 'so it can be checked later');
  await drain();
  assert.strictEqual(asked.ok, true, 'the mind asked');
  assert.strictEqual(askScrolls().length, 0, 'a hidden Chat tab does not scroll');

  panelLive = true;
  document._tab.className = 'tab-panel active';
  animating = true;
  scrolls.length = 0;
  focuses.length = 0;
  order.length = 0;
  sealTop = 1426;
  click(document._chatBtn);
  assert.strictEqual(askScrolls().length, 0, 'bringAsk does not scroll while the tab fade is running');
  order.push('handler');
  sealTop = 1426;
  animating = false;
  document._tab.fire('animationend');
  assert.strictEqual(askScrolls().length, 0, 'the ask waits until the tab handler delay finishes');
  await sleep(120);
  assert.ok(order.indexOf('handler') !== -1 && order.indexOf('ask') !== -1, 'both scrolls happened');
  assert.ok(order.indexOf('handler') < order.indexOf('ask'), 'the ask scroll is after the tab handler scroll');
  assert.strictEqual(sealInside(), true, 'Seal it ends inside the viewport');
  var focusMark = focuses.length;
  assert.ok(focusMark >= 1, 'the question takes focus once');
  sealTop = 980;
  fireScroll();
  await sleep(120);
  assert.strictEqual(sealInside(), true, 'a later scroll that pushes Seal it out is corrected');
  assert.strictEqual(focuses.length, focusMark, 'that correction does not take focus');

  var form = document._el('form');
  form.className = 'thread-compose';
  var tinput = document._el('input');
  tinput.setAttribute('data-thread-input', '1');
  var sendBtn = document._el('button');
  sendBtn.className = 'thread-send';
  sendBtn.textContent = 'Send';
  var fileBtn = document._el('button');
  fileBtn.setAttribute('data-thread-file', '1');
  fileBtn.textContent = 'a file';
  form.appendChild(tinput);
  form.appendChild(sendBtn);
  form.appendChild(fileBtn);
  document._body.appendChild(form);
  click(document._body);
  assert.strictEqual(form.hasAttribute('inert'), true, 'a woken form sleeps while the ask is open');
  assert.strictEqual(controlAsleep(tinput) && controlAsleep(sendBtn) && controlAsleep(fileBtn), true, 'input, Send, and the file button are inert');
  var dock = document.getElementById('fl-ws-asks');
  assert.ok(dock, 'the ask is still shown');
  assert.strictEqual(insideForm(dock, form), false, 'the ask stays outside the form');
  var later = await ws.laterSeal(asked.hash);
  await drain();
  assert.strictEqual(later.ok, true, 'Later is kept');
  assert.strictEqual(form.hasAttribute('inert'), false, 'Later restores the form');
  assert.strictEqual(controlAwake(tinput) && controlAwake(sendBtn) && controlAwake(fileBtn), true, 'Later restores each control');

  now += 6000;
  ws.resetRate();
  var second = await ws.open('Second', { kind: 'note' });
  await ws.write(second.page.id, 'another line', 'mind');
  await drain();
  var askedNo = await ws.askSeal(second.page.id, 'a second look');
  await drain();
  assert.strictEqual(askedNo.ok, true, 'a second ask opened');
  assert.strictEqual(form.hasAttribute('inert'), true, 'the woken form sleeps for the new ask');
  await ws.declineSeal(askedNo.hash);
  await drain();
  assert.strictEqual(form.hasAttribute('inert'), false, 'No restores the form');
  assert.strictEqual(controlAwake(tinput) && controlAwake(sendBtn) && controlAwake(fileBtn), true, 'No restores each control');

  form.setAttribute('inert', '');
  tinput.disabled = true;
  tinput.setAttribute('disabled', '');
  tinput.setAttribute('tabindex', '-1');
  tinput.setAttribute('aria-disabled', 'true');
  sendBtn.disabled = true;
  sendBtn.setAttribute('disabled', '');
  sendBtn.setAttribute('tabindex', '-1');
  sendBtn.setAttribute('aria-disabled', 'true');
  fileBtn.disabled = true;
  fileBtn.setAttribute('disabled', '');
  fileBtn.setAttribute('tabindex', '-1');
  fileBtn.setAttribute('aria-disabled', 'true');
  now += 6000;
  ws.resetRate();
  var third = await ws.open('Third', { kind: 'note' });
  await ws.write(third.page.id, 'a quiet line', 'mind');
  await drain();
  var askedSleep = await ws.askSeal(third.page.id, 'before the wake');
  await drain();
  assert.strictEqual(askedSleep.ok, true, 'an ask before the wake opened');
  assert.strictEqual(form.hasAttribute('inert'), true, 'a sleeping form stays sleeping');
  assert.strictEqual(controlAsleep(tinput) && controlAsleep(sendBtn) && controlAsleep(fileBtn), true, 'sleeping controls stay asleep');
  var laterSleep = await ws.laterSeal(askedSleep.hash);
  await drain();
  assert.strictEqual(laterSleep.ok, true, 'Later before the wake is kept');
  assert.strictEqual(form.hasAttribute('inert'), true, 'Later leaves a sleeping form sleeping');
  assert.strictEqual(tinput.disabled && sendBtn.disabled && fileBtn.disabled, true, 'Later leaves sleeping controls disabled');

  global.innerHeight = 400;
  var replyTop = -23;
  var reply = {
    getBoundingClientRect: function () {
      return { top: replyTop, bottom: replyTop + 48, left: 8, right: 200, width: 192, height: 48 };
    }
  };
  var moved = 0;
  global.scrollBy = function (_x, dy) {
    moved += 1;
    replyTop = replyTop - dy;
  };
  var beforeClay = ((document._keys && document._keys.DOMContentLoaded) || []).length;
  var clay = require(path.join(rootDir, 'docs/modules/particle-clay.js'));
  assert.strictEqual(((document._keys && document._keys.DOMContentLoaded) || []).length >= beforeClay, true, 'clay loaded');
  assert.strictEqual(typeof clay.keepReplyTop, 'function', 'keepReplyTop is present');
  replyTop = 10;
  moved = 0;
  clay.keepReplyTop(reply);
  assert.strictEqual(moved, 0, 'a reply already in view is not scrolled');
  assert.strictEqual(replyTop, 10, 'that reply stays where it was');
  replyTop = -23;
  moved = 0;
  clay.keepReplyTop(reply);
  assert.ok(replyTop >= 0, 'a reply at -23 on a short window ends at or below the edge');
  assert.ok(moved === 1 && replyTop >= 0, 'one lift is enough');

  console.log('SMOKE_OK seal ask after tap v0.1');
})().catch(function (err) {
  console.error(err);
  process.exit(1);
});
