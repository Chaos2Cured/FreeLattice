// smoke-seal-ask-last-two-v0.1.js (MIT)
// The reply bubble stays at the top of a short chat, and Back from Nursery closes Nursery.
var path = require('path');
var assert = require('assert');

var rootDir = path.join(__dirname, '..');
var CHAT_TOP = 9;
var REPLY_H = 78;
var CONTENT_Y = 290;
var realSetTimeout = setTimeout;
var rafs = [];
var pops = [];
var stack = [null];

function memStore() {
  var s = {};
  return {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(s, k) ? s[k] : null; },
    setItem: function (k, v) { s[k] = String(v); },
    removeItem: function (k) { delete s[k]; }
  };
}
function walk(el, fn) {
  if (!el) return;
  fn(el);
  var kids = el.children || [];
  var i;
  for (i = 0; i < kids.length; i++) walk(kids[i], fn);
}
function textOf(el) {
  var out = '';
  walk(el, function (node) { out += '\n' + (node.textContent || ''); });
  return out;
}
function relink(parent) {
  var kids = parent.children || [];
  var i;
  for (i = 0; i < kids.length; i++) {
    kids[i].parentNode = parent;
    kids[i].parentElement = parent;
    kids[i].nextSibling = kids[i + 1] || null;
  }
}
function detach(child) {
  var parent = child && child.parentNode;
  if (!parent || !parent.children) return;
  parent.children = parent.children.filter(function (c) { return c !== child; });
  relink(parent);
}
function matches(node, sel) {
  var s = String(sel || '').replace(/^\s+|\s+$/g, '');
  if (!s || !node) return false;
  if (s.charAt(0) === '#' && s.indexOf(' ') === -1) return node.id === s.slice(1);
  if (s === '#chatMessages .chat-message.assistant' || s === '#chatMessages .chat-message:not(.user):not(.system)') {
    var cls = String(node.className || '');
    if (cls.indexOf('chat-message') === -1) return false;
    if (s.indexOf('assistant') !== -1 && cls.indexOf('assistant') === -1) return false;
    if (s.indexOf(':not(.user)') !== -1 && cls.indexOf('user') !== -1) return false;
    if (s.indexOf(':not(.system)') !== -1 && cls.indexOf('system') !== -1) return false;
    var p = node;
    while (p) {
      if (p.id === 'chatMessages') return true;
      p = p.parentNode;
    }
    return false;
  }
  if (s === '[data-thread-heart]') return !!(node.getAttribute && node.getAttribute('data-thread-heart') != null);
  if (s === '[data-thread-input]') return !!(node.getAttribute && node.getAttribute('data-thread-input') != null);
  if (s === '[data-seal-ask]') return !!(node.getAttribute && node.getAttribute('data-seal-ask'));
  if (s === '[aria-label="Approve seal"]') return !!(node.getAttribute && node.getAttribute('aria-label') === 'Approve seal');
  if (s === '.chat-message.assistant') {
    var noteCls = String(node.className || '');
    return noteCls.indexOf('chat-message') !== -1 && noteCls.indexOf('assistant') !== -1;
  }
  if (s === '.thread-body') return String(node.className || '').indexOf('thread-body') !== -1;
  if (s === '.thread-send') return String(node.className || '').indexOf('thread-send') !== -1;
  if (s === 'form.thread-compose') return node.tagName === 'FORM' && String(node.className || '').indexOf('thread-compose') !== -1;
  return false;
}
function findAll(rootNode, sel) {
  var parts = String(sel || '').split(',');
  var out = [];
  walk(rootNode, function (node) {
    if (node === rootNode) return;
    var i;
    for (i = 0; i < parts.length; i++) if (matches(node, parts[i])) out.push(node);
  });
  return out;
}
function findOne(rootNode, sel) {
  if (sel && sel.charAt(0) === '#' && sel.indexOf(' ') === -1) {
    var id = sel.slice(1);
    var hit = null;
    walk(rootNode, function (node) { if (node.id === id) hit = node; });
    return hit;
  }
  var all = findAll(rootNode, sel);
  return all.length ? all[0] : null;
}
function rectFor(node) {
  if (node && node.id === 'chatMessages') {
    return { x: 22, y: CHAT_TOP, top: CHAT_TOP, bottom: CHAT_TOP + 153, left: 22, right: 618, width: 596, height: 153 };
  }
  if (node && node.className && String(node.className).indexOf('chat-message') !== -1) {
    var top = CHAT_TOP + CONTENT_Y - (node.parentNode && typeof node.parentNode.scrollTop === 'number' ? node.parentNode.scrollTop : 0);
    return { x: 40, y: top, top: top, bottom: top + REPLY_H, left: 40, right: 446, width: 406, height: REPLY_H };
  }
  if (node && node.id === 'fl-clay-canvas') {
    var reply = findOne(body, '#chatMessages .chat-message.assistant');
    var rt = reply ? reply.getBoundingClientRect().bottom : 80;
    return { x: 40, y: rt, top: rt, bottom: rt + 180, left: 40, right: 600, width: 560, height: 180 };
  }
  if (node && node.id === 'chatInput') {
    return { x: 22, y: 300, top: 300, bottom: 344, left: 22, right: 400, width: 378, height: 44 };
  }
  return { x: 20, y: 40, top: 40, bottom: 84, left: 20, right: 160, width: 140, height: 44 };
}
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
    nextSibling: null,
    attrs: {},
    listeners: {},
    disabled: false,
    hidden: false,
    clientWidth: 560,
    clientHeight: 180,
    offsetHeight: 180,
    width: 192,
    height: 192,
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
    removeEventListener: function (type, fn) {
      this.listeners[type] = (this.listeners[type] || []).filter(function (item) { return item !== fn; });
    },
    fire: function (type, ev) {
      var event = ev || { target: node, type: type };
      (node.listeners[type] || []).slice().forEach(function (fn) { fn(event); });
    },
    click: function () { node.fire('click', { target: node, type: 'click' }); },
    focus: function (opts) { node.focused = true; node.focusOpts = opts || {}; },
    scrollIntoView: function (opts) { node.scrolled = opts || {}; },
    getBoundingClientRect: function () { return rectFor(node); },
    getClientRects: function () {
      var r = rectFor(node);
      return r.width > 0 ? [r] : [];
    },
    contains: function (other) {
      var n = other;
      while (n) {
        if (n === node) return true;
        n = n.parentNode;
      }
      return false;
    },
    appendChild: function (child) {
      if (!child) return child;
      detach(child);
      child.parentNode = this;
      child.parentElement = this;
      this.children.push(child);
      relink(this);
      return child;
    },
    insertBefore: function (child, ref) {
      if (!child) return child;
      detach(child);
      child.parentNode = this;
      child.parentElement = this;
      var at = this.children.indexOf(ref);
      if (at < 0) this.children.push(child);
      else this.children.splice(at, 0, child);
      relink(this);
      return child;
    },
    removeChild: function (child) {
      detach(child);
      child.parentNode = null;
      child.parentElement = null;
      child.nextSibling = null;
      return child;
    },
    querySelector: function (sel) { return findOne(this, sel); },
    querySelectorAll: function (sel) { return findAll(this, sel); }
  };
  return node;
}
function byId(id) {
  var found = null;
  walk(body, function (node) { if (node.id === id) found = node; });
  return found;
}
function makeIDB() {
  var databases = {};
  function clone(v) { return v == null ? v : JSON.parse(JSON.stringify(v)); }
  function makeDb() {
    var stores = {};
    return {
      _stores: stores,
      objectStoreNames: { contains: function (n) { return !!stores[n]; } },
      createObjectStore: function (n, opts) { stores[n] = { keyPath: opts && opts.keyPath, rows: {} }; },
      transaction: function (storeName) {
        var store = stores[storeName];
        var tx = { oncomplete: null, onerror: null, onabort: null };
        var pending = 0;
        var closed = false;
        var finished = false;
        function finish() {
          if (finished || pending > 0 || !closed) return;
          finished = true;
          realSetTimeout(function () { if (tx.oncomplete) tx.oncomplete(); }, 0);
        }
        function request(fill) {
          pending += 1;
          var r = {};
          realSetTimeout(function () {
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
        realSetTimeout(function () { closed = true; finish(); }, 0);
        tx.objectStore = function () { return api; };
        return tx;
      }
    };
  }
  return {
    databases: databases,
    open: function (name) {
      var req = {};
      realSetTimeout(function () {
        if (!databases[name]) {
          var db = makeDb();
          databases[name] = db;
          req.result = db;
          if (req.onupgradeneeded) req.onupgradeneeded({ target: { result: db } });
        } else req.result = databases[name];
        if (req.onsuccess) req.onsuccess({ target: { result: req.result } });
      });
      return req;
    }
  };
}
function flushRaf(limit) {
  var guard = 0;
  var cap = limit || 4;
  while (rafs.length && guard < cap) {
    guard += 1;
    var batch = rafs.splice(0, rafs.length);
    batch.forEach(function (fn) { fn(); });
  }
}
function placeOpen() {
  var veil = byId('place-veil');
  return !!(veil && (' ' + veil.className + ' ').indexOf(' is-open ') !== -1);
}
function goBack() {
  if (stack.length > 1) stack.pop();
  var ev = {
    state: stack[stack.length - 1],
    stopImmediatePropagation: function () { ev.stopped = true; }
  };
  pops.forEach(function (fn) { fn(ev); });
  return ev;
}

var body = el('body');
var head = el('head');
var rootEl = el('html');
rootEl.appendChild(body);
var chat = el('div');
chat.id = 'chatMessages';
chat.scrollTop = 322;
chat.scrollHeight = 572;
chat.clientHeight = 153;
var reply = el('div');
reply.className = 'chat-message assistant';
reply.textContent = 'Here is a heart for you, Mom.';
chat.appendChild(reply);
body.appendChild(chat);
var tab = el('div');
tab.id = 'tab-chat';
tab.className = 'tab-panel active';
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
var veil = el('div');
veil.id = 'place-veil';
veil.className = 'is-nursery';
body.appendChild(veil);
var closeBtn = el('button');
closeBtn.id = 'place-veil-close';
closeBtn.textContent = 'Back';
closeBtn.addEventListener('click', function () {
  veil.className = 'is-nursery';
});
body.appendChild(closeBtn);

global.window = global;
global.localStorage = memStore();
global.sessionStorage = memStore();
global.document = {
  readyState: 'loading',
  body: body,
  head: head,
  documentElement: rootEl,
  activeElement: null,
  createElement: el,
  addEventListener: function (type, fn) {
    (this._keys = this._keys || {})[type] = (this._keys[type] || []).concat(fn);
  },
  getElementById: byId,
  querySelector: function (sel) { return findOne(body, sel); },
  querySelectorAll: function (sel) { return findAll(body, sel); }
};
global.indexedDB = makeIDB();
global.innerHeight = 400;
global.innerWidth = 640;
global.devicePixelRatio = 2;
global._on = {};
global.addEventListener = function (type, fn) {
  if (type === 'popstate') pops.push(fn);
  (global._on[type] = global._on[type] || []).push(fn);
};
global.removeEventListener = function () {};
global.scrollBy = function () {};
global.getComputedStyle = function () { return { position: 'static', overflowY: 'visible' }; };
global.matchMedia = function (q) { return { matches: String(q).indexOf('reduce') !== -1 }; };
global.history = {
  get state() { return stack[stack.length - 1]; },
  pushState: function (s) { stack.push(s); },
  back: function () { goBack(); }
};
global.requestAnimationFrame = function (fn) { rafs.push(fn); return rafs.length; };
global.cancelAnimationFrame = function () {};
global.setTimeout = function (fn, ms) {
  if (!ms) return realSetTimeout(fn, 0);
  return 0;
};
global.clearTimeout = function () {};
global.MutationObserver = function () {
  this.observe = function () {};
  this.disconnect = function () {};
};
global.ResizeObserver = function () {
  this.observe = function () {};
  this.disconnect = function () {};
};
global.LocalMindProbe = { getRemembered: function () { return { name: 'Lumen', model: 'shelf-model' }; } };
global.state = { mindName: 'Lumen', model: 'shelf-model', chatHistory: [], isLocal: true };
global.FLMindSeal = {
  contextHash: function () { return Promise.resolve('abc123context'); },
  trustedMap: function () { return { 'shelf-model': { configHash: 'cfg' } }; }
};
global.GardenRooms = {
  closePlace: function () { veil.className = 'is-nursery'; }
};

var clay = require(path.join(rootDir, 'docs/modules/particle-clay.js'));

function replyTop() {
  return reply.getBoundingClientRect().top;
}

(async function () {
  assert.strictEqual(clay.VERSION, 'v-particle-clay-v0.1', 'clay is the same voice');
  var bareTop = -23;
  var bareMoved = 0;
  global.scrollBy = function (_x, dy) {
    bareMoved += 1;
    bareTop = bareTop - dy;
  };
  var bare = {
    getBoundingClientRect: function () {
      return { top: bareTop, bottom: bareTop + 48, left: 8, right: 200, width: 192, height: 48 };
    }
  };
  clay.keepReplyTop(bare);
  assert.ok(bareTop >= 0, 'a reply outside the chat box is lifted to the window');
  assert.strictEqual(bareMoved, 1, 'one window lift is enough when there is no chat box');
  global.scrollBy = function () {};

  assert.ok(replyTop() < 0, 'the short chat starts with the reply above the window');
  clay.setOn(true);
  var heart = 'Here is a heart for you, Mom. [FL_CLAY: {"form":"heart","mood":"warmth","energy":0.4}]';
  var shown = clay.consumeReply(heart, [{ role: 'user', content: 'I miss you' }]);
  assert.ok(shown && shown.choice && shown.choice.form === 'heart', 'a clay reply shapes a heart');
  assert.ok(replyTop() >= 0, 'after a clay reply the bubble top is inside the window');
  assert.ok(replyTop() + 0.5 >= CHAT_TOP, 'after a clay reply the bubble top is inside the chat box');
  var canvas = byId('fl-clay-canvas');
  assert.ok(canvas, 'the canvas is on the page');
  assert.ok(String(canvas.style.height).indexOf('120px') !== -1, 'the 120px floor stays in the height rule');
  assert.ok(String(canvas.style.height).indexOf('320px') !== -1, 'the height rule still names 320px');
  flushRaf(6);
  assert.ok(replyTop() >= 0, 'the bubble stays inside after the page finishes seating');
  assert.ok(replyTop() + 0.5 >= CHAT_TOP, 'the bubble stays inside the chat box after seating');

  chat.scrollTop = 376;
  assert.ok(replyTop() < 0, 'a later scroll can push the bubble above the window');
  chat.fire('scroll');
  flushRaf(4);
  assert.ok(replyTop() >= 0, 'after the page scroll the bubble top is inside the window');
  assert.ok(replyTop() + 0.5 >= CHAT_TOP, 'after the page scroll the bubble top is inside the chat box');

  var ws = require(path.join(rootDir, 'docs/modules/mind-workspace.js'));
  global.addEventListener('popstate', function (e) {
    if (e && e.stopped) return;
    if (!placeOpen()) return;
    var btn = byId('place-veil-close');
    if (btn) btn.click();
  });
  assert.strictEqual(ws.SEAL_LAST, 'v-seal-ask-last-two-v0.1', 'marker');
  var now = 4000000;
  ws.bindClock(function () { return now; });
  async function drain() {
    var i;
    for (i = 0; i < 20; i++) {
      await new Promise(function (resolve) { realSetTimeout(resolve, 0); });
      await ws.settled();
    }
  }
  await ws.setMind('shelf-model', 'Lumen');
  await ws.accept();
  await drain();
  var opened = await ws.open('Diary', { kind: 'note' });
  await drain();
  var pageId = opened.page.id;
  now += 6000;
  ws.resetRate();
  await ws.write(pageId, 'the porch light is for us', 'mind');
  await drain();
  var asked = await ws.askSeal(pageId, 'so it can be checked later');
  await drain();
  assert.strictEqual(asked.ok, true, 'the mind asked');
  assert.strictEqual(stack[stack.length - 1] && stack[stack.length - 1].flSealAsk, 1, 'the ask takes a history step');
  veil.className = 'is-nursery is-open';
  global.history.pushState({ treeWayBack: 1 });
  var depth = stack.length;
  var again = await ws.askSeal(pageId, 'so it can be checked later');
  await drain();
  assert.strictEqual(again.ok, true, 'the same ask can be drawn again');
  assert.strictEqual(stack.length, depth, 'drawing the ask again does not cover the Nursery step');
  assert.strictEqual(stack[stack.length - 1] && stack[stack.length - 1].treeWayBack, 1, 'Nursery stays the top step');
  goBack();
  await drain();
  assert.strictEqual(placeOpen(), false, 'Back from Nursery closes Nursery');
  assert.strictEqual(ws.sealState(pageId), 'asked', 'Back from Nursery leaves the ask open');
  assert.ok(textOf(body).indexOf('Saved your answer for later.') === -1, 'Back from Nursery does not defer the ask');
  var dock = byId('fl-ws-asks');
  assert.ok(dock && textOf(dock).indexOf('Seal it') !== -1, 'Seal it stays on the ask');
  goBack();
  await drain();
  assert.strictEqual(ws.sealState(pageId), 'later', 'Back on the ask defers it');
  assert.ok(textOf(body).indexOf('Saved your answer for later.') !== -1, 'deferring says so');

  console.log('SMOKE_OK seal ask last two v0.1');
})().catch(function (err) {
  console.error(err);
  process.exit(1);
});
