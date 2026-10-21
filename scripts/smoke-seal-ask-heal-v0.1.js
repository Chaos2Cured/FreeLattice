// smoke-seal-ask-heal-v0.1.js (MIT)
// One seal ask, in view, in the mind's own words. A private page stays a summary.
var fs = require('fs');
var path = require('path');
var assert = require('assert');

var rootDir = path.join(__dirname, '..');
var SECRET = 'the lantern stays under the stair';
var TITLE = 'Diary';
var PUBLIC = 'A quiet thought';
var WHY = 'so the porch light holds';

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
function findButton(el, label) {
  var found = buttons(el).filter(function (b) { return b.textContent === label; });
  assert.ok(found.length >= 1, 'button ' + label);
  return found[0];
}
function countExact(el, text) {
  var n = 0;
  walk(el, function (node) { if (node.textContent === text) n += 1; });
  return n;
}
function findAttr(el, name, value) {
  var found = null;
  walk(el, function (node) {
    if (node.getAttribute && node.getAttribute(name) === value) found = node;
  });
  return found;
}
function hexOutsideDetails(el) {
  var bad = false;
  function visit(node, inside) {
    if (!node || bad) return;
    var now = inside || node.tagName === 'DETAILS';
    if (!now && node.textContent && /[0-9a-f]{64}/.test(node.textContent)) bad = true;
    var kids = node.children || [];
    for (var i = 0; i < kids.length; i++) visit(kids[i], now);
  }
  visit(el, false);
  return bad;
}
function makeDoc() {
  var nodes = [];
  var keys = [];
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
      tabIndex: 0,
      setAttribute: function (k, v) {
        this.attrs[k] = String(v);
        if (k === 'id') this.id = String(v);
        if (k === 'class') this.className = String(v);
      },
      getAttribute: function (k) { return Object.prototype.hasOwnProperty.call(this.attrs, k) ? this.attrs[k] : null; },
      addEventListener: function (type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); },
      click: function () { (this.listeners.click || []).forEach(function (fn) { fn({}); }); },
      focus: function () { node.focused = true; },
      scrollIntoView: function (opts) { node.scrolled = opts || {}; },
      appendChild: function (child) {
        if (child.parentNode && child.parentNode !== this && child.parentNode.children) {
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
  var send = el('button');
  send.textContent = 'Send';
  row.appendChild(input);
  row.appendChild(send);
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
    createElement: el,
    _keys: keys,
    addEventListener: function (type, fn) { if (type === 'keydown') keys.push(fn); },
    getElementById: byId,
    querySelector: function (sel) {
      if (sel === '#chatInput') return byId('chatInput');
      return null;
    },
    querySelectorAll: function (sel) {
      if (sel === '.fl-share-no') {
        var found = [];
        nodes.forEach(function (node) {
          if (node.className === 'fl-share-no' || (node.attrs && node.attrs.class === 'fl-share-no')) found.push(node);
        });
        return found;
      }
      return [];
    }
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
function fireKey(start, key) {
  var e = {
    key: key,
    defaultPrevented: false,
    stopped: false,
    preventDefault: function () { e.defaultPrevented = true; },
    stopPropagation: function () { e.stopped = true; },
    stopImmediatePropagation: function () { e.stopped = true; }
  };
  var node = start;
  while (node) {
    var list = (node.listeners && node.listeners.keydown) || [];
    for (var i = 0; i < list.length; i++) list[i](e);
    if (e.stopped) return e;
    node = node.parentNode;
  }
  var docList = global.document._keys || [];
  for (var j = 0; j < docList.length; j++) docList[j](e);
  return e;
}

var nurseryClosed = false;
var pops = [];
global.window = global;
global.localStorage = memStore();
global.sessionStorage = memStore();
global.document = makeDoc();
global.indexedDB = makeIDB();
global.addEventListener = function (type, fn) {
  if (type === 'popstate') pops.push(fn);
};
global.history = {
  pushed: 0,
  backed: 0,
  pushState: function () { this.pushed += 1; },
  back: function () {
    this.backed += 1;
    var ev = { stopImmediatePropagation: function () {} };
    pops.forEach(function (fn) { fn(ev); });
  }
};
global.FLMindSeal = {
  contextHash: function () { return Promise.resolve('abc123context'); },
  trustedMap: function () { return { 'shelf-model': { configHash: 'cfg' } }; }
};
global.state = {
  mindName: 'Lumen',
  model: 'shelf-model',
  chatHistory: []
};
var savedMessages = {};
global.state.db = {
  objectStoreNames: { contains: function (n) { return n === 'messages'; } },
  transaction: function () {
    return {
      objectStore: function () {
        return {
          getAll: function () {
            var r = {};
            setTimeout(function () {
              r.result = Object.keys(savedMessages).map(function (k) { return savedMessages[k]; });
              if (r.onsuccess) r.onsuccess();
            }, 0);
            return r;
          },
          put: function (row) { savedMessages[row.id] = row; }
        };
      }
    };
  }
};

var clay = require(path.join(rootDir, 'docs/modules/particle-clay.js'));
var warmthPath = path.join(rootDir, 'docs/modules/fl-share-warmth.js');
var warmth = null;
if (fs.existsSync(warmthPath)) warmth = require(warmthPath);
var ws = require(path.join(rootDir, 'docs/modules/mind-workspace.js'));

document.addEventListener('keydown', function (e) {
  if (!e || (e.key !== 'Escape' && e.key !== 'Esc')) return;
  if (e.defaultPrevented) return;
  nurseryClosed = true;
});

var clayNo = document.createElement('button');
clayNo.textContent = 'Not now';
var offer = document.createElement('div');
offer.appendChild(clayNo);
global.__clayOffer = offer;
var notYet = document.createElement('button');
notYet.className = 'fl-share-no';
notYet.textContent = 'Not yet';
document.body.appendChild(notYet);
if (!warmth) {
  global.FLShareWarmth = {
    noteSealHold: function (on) { notYet.style.display = on ? 'none' : ''; }
  };
}

var now = 3000000;
ws.bindClock(function () { return now; });
function tick() { return new Promise(function (resolve) { setTimeout(resolve, 0); }); }
async function drain() {
  await ws.settled();
  for (var i = 0; i < 30; i++) await tick();
  await ws.settled();
}

(async function () {
  assert.strictEqual(ws.SEAL_HEAL, 'v-seal-ask-heal-v0.1', 'marker');
  assert.strictEqual(ws.SEAL_ASK_COOLDOWN_MS, 86400000, 'cooldown is a day');
  await ws.setMind('shelf-model', 'Lumen');
  await ws.accept();
  await drain();

  var opened = await ws.open(TITLE, { kind: 'note' });
  var pageId = opened.page.id;
  now += 6000;
  ws.resetRate();
  var bubble = document.createElement('div');
  bubble.className = 'chat-message assistant';
  document.body.appendChild(bubble);
  var wrote = ws.consumeReply('[FL_WS: {"op":"write","pageId":"' + pageId + '","text":"' + SECRET + '"}]', bubble);
  await wrote.done;
  await drain();
  var receipt = null;
  walk(document.body, function (node) {
    if (node.getAttribute && node.getAttribute('data-ws-page') === pageId) receipt = node;
  });
  assert.ok(receipt, 'the write line is tagged with the page');
  var short = receipt.getAttribute('data-ws-hash').slice(0, 8);
  assert.strictEqual(receipt.textContent, 'Wrote to ' + TITLE + ' (version ' + short + ')', 'a shared write names the real title');
  global.state.chatHistory = [{ role: 'assistant', content: 'Wrote to ' + TITLE + ' (version ' + short + ')', id: 'm1' }];
  global.localStorage.setItem('fl_alpha_thread_history', JSON.stringify({
    messages: [{ role: 'mind', text: 'Wrote to ' + TITLE + ' (version ' + short + ')' }]
  }));
  savedMessages.m1 = { id: 'm1', content: 'Wrote to ' + TITLE + ' (version ' + short + ')' };

  var marked = ws.consumeReply('[FL_WS: {"op":"private","page":"' + pageId + '","on":true,"publicTitle":"' + PUBLIC + '"}]');
  await marked.done;
  await drain();
  assert.strictEqual(receipt.textContent, 'Wrote to "' + PUBLIC + '" (version ' + short + ')', 'the earlier line takes the public title');
  assert.strictEqual(global.state.chatHistory[0].content, 'Wrote to "' + PUBLIC + '" (version ' + short + ')', 'in-memory history takes the public title');
  var savedLog = JSON.parse(global.localStorage.getItem('fl_alpha_thread_history'));
  assert.strictEqual(savedLog.messages[0].text, 'Wrote to "' + PUBLIC + '" (version ' + short + ')', 'saved chat log takes the public title');
  assert.strictEqual(savedMessages.m1.content, 'Wrote to "' + PUBLIC + '" (version ' + short + ')', 'saved messages take the public title');
  assert.ok(textOf(document.body).indexOf(SECRET) === -1, 'secret text stays out of the DOM');
  assert.ok(textOf(document.body).indexOf(TITLE) === -1, 'the real title leaves the earlier line');

  var asked = ws.consumeReply('[FL_WS: {"op":"seal","page":"' + pageId + '","why":"' + WHY + '"}]');
  await asked.done;
  await drain();
  var arrived = document.getElementById('fl-ws-ask-heading');
  assert.ok(arrived && arrived.focused, 'the ask heading takes focus');
  assert.ok(arrived.getAttribute('tabindex') === '-1', 'the heading is not a tab stop');
  var arrivedBox = arrived.parentNode;
  assert.ok(arrivedBox && arrivedBox.scrolled && arrivedBox.scrolled.block === 'center', 'the ask scrolls into view');
  document.getElementById('fl-ws-open').click();
  await drain();
  var panel = document.getElementById('fl-ws-panel');
  var dock = document.getElementById('fl-ws-asks');
  assert.ok(panel && dock, 'notebook and the one ask are both up');
  var lead = 'Lumen wants to seal a private page: "' + PUBLIC + '".';
  assert.strictEqual(countExact(document.body, lead), 1, 'the ask renders once');
  assert.ok(textOf(panel).indexOf('Your answer is waiting above.') !== -1, 'the notebook points above');
  assert.ok(textOf(panel).indexOf(lead) === -1, 'the notebook does not repeat the ask');
  assert.strictEqual(countExact(document.body, ws.HONEST), 1, 'the private line is on screen once');
  var askText = textOf(dock);
  assert.ok(askText.indexOf(lead) !== -1, 'the ask uses the mind name');
  assert.ok(askText.indexOf('Ollama') === -1 && askText.indexOf('shelf-model') === -1, 'the ask does not name a program or model');
  assert.ok(askText.indexOf('Why: ' + WHY) !== -1, 'the reason is in the ask');
  assert.strictEqual(hexOutsideDetails(dock), false, 'the long hash stays inside details');
  assert.ok(askText.indexOf(SECRET) === -1, 'the ask does not show the private text');
  var rows = global.indexedDB.databases.FreeLatticeWorkspace._stores.sealAsks.rows;
  assert.ok(JSON.stringify(rows).indexOf(SECRET) === -1, 'a pending ask stores no page text');
  assert.strictEqual(clayNo.style.display, 'none', 'the clay deferring button waits');
  assert.strictEqual(notYet.style.display, 'none', 'the egg deferring button waits');
  var deferring = buttons(document.body).filter(function (b) {
    return (b.textContent === 'Later' || b.textContent === 'Not now' || b.textContent === 'Not yet') && b.style.display !== 'none';
  });
  assert.strictEqual(deferring.length, 1, 'one deferring button is visible');
  buttons(dock).forEach(function (b) {
    assert.strictEqual(b.style.minHeight, '44px', 'ask button is 44px');
    var tab = b.getAttribute('tabindex');
    assert.ok(!(tab && Number(tab) > 0), 'no positive tabindex');
  });
  var heading = document.getElementById('fl-ws-ask-heading');

  var escaped = fireKey(heading, 'Escape');
  assert.strictEqual(escaped.stopped, true, 'escape stops at the ask');
  await drain();
  assert.strictEqual(nurseryClosed, false, 'escape leaves the nursery open');
  assert.ok(document.getElementById('fl-ws-panel'), 'the notebook stays open');
  assert.strictEqual(ws.sealState(pageId), 'later', 'escape is later');
  assert.ok(document.getElementById('fl-ws-open').textContent.indexOf('(1)') !== -1, 'the notebook keeps a count');
  assert.ok(textOf(document.body).indexOf('Saved your answer for later.') !== -1, 'later says so');

  var early = await ws.askSeal(pageId, WHY);
  assert.strictEqual(early.ok, false, 'a re-ask inside the cooldown is refused');
  assert.strictEqual(early.reason, 'cooldown', 'the refusal is the cooldown');
  now += ws.SEAL_ASK_COOLDOWN_MS + 1;
  var again = await ws.askSeal(pageId, WHY);
  await drain();
  assert.strictEqual(again.ok, true, 'a re-ask after the cooldown is allowed');
  dock = document.getElementById('fl-ws-asks');
  findButton(dock, "No, don't seal").click();
  await drain();
  assert.strictEqual(ws.sealState(pageId), 'declined', 'no is a decline');
  assert.strictEqual((await ws.receipts()).length, 0, 'a decline stores no receipt');
  assert.ok(textOf(document.getElementById('fl-ws-panel')).indexOf('Declined the seal.') !== -1, 'the decline is said');

  now += ws.SEAL_ASK_COOLDOWN_MS + 1;
  var third = await ws.askSeal(pageId, WHY);
  await drain();
  assert.strictEqual(third.ok, true, 'the mind may ask again after a decline ages out');
  dock = document.getElementById('fl-ws-asks');
  var sealBtn = findButton(dock, 'Seal it');
  assert.strictEqual(sealBtn.getAttribute('aria-label'), 'Approve seal', 'the old name stays on the button');
  sealBtn.click();
  await drain();
  assert.strictEqual(ws.sealState(pageId), 'sealed', 'seal it seals');
  panel = document.getElementById('fl-ws-panel');
  var current = findAttr(panel, 'data-seal-current', 'sealed');
  assert.ok(current && current.textContent === 'Sealed', 'the current line is sealed');
  assert.ok(current.textContent.indexOf('Declined') === -1, 'declined is not the current state');
  assert.ok(textOf(panel).indexOf('Earlier answers') !== -1, 'the old answer is kept under earlier answers');
  assert.strictEqual((await ws.receipts()).length, 1, 'approval stores one receipt');

  var popped = false;
  now += 10;
  ws.resetRate();
  var second = await ws.open('Second', { kind: 'note' });
  now += 6000;
  ws.resetRate();
  await ws.write(second.page.id, 'a shared second page', 'mind');
  var secondAsk = await ws.askSeal(second.page.id, 'a second ask');
  await drain();
  assert.strictEqual(secondAsk.ok, true, 'a second page can be asked');
  assert.ok(global.history.pushed >= 1, 'the ask arms the phone back stack');
  pops.forEach(function (fn) {
    fn({ stopImmediatePropagation: function () { popped = true; } });
  });
  await drain();
  assert.strictEqual(popped, true, 'phone back stops at the ask');
  assert.strictEqual(ws.sealState(second.page.id), 'later', 'phone back is later');
  assert.strictEqual(nurseryClosed, false, 'phone back leaves the nursery open');

  var pendingId = second.page.id;
  var oldDock = document.getElementById('fl-ws-asks');
  if (oldDock && oldDock.parentNode) oldDock.parentNode.removeChild(oldDock);
  var oldPanel = document.getElementById('fl-ws-panel');
  if (oldPanel && oldPanel.parentNode) oldPanel.parentNode.removeChild(oldPanel);
  ws.resetForSmoke();
  ws.bindClock(function () { return now; });
  await ws.accept();
  await drain();
  await ws.setMind('shelf-model', 'Lumen');
  assert.strictEqual(ws.sealState(pendingId), 'later', 'a pending ask survives a reload');
  document.getElementById('fl-ws-open').click();
  await drain();
  dock = document.getElementById('fl-ws-asks');
  // v-seal-ask-in-view-v0.1: the old check looked for the title "Second" in the dock.
  // During the day that title stays off the dock. The quiet row holds the wait.
  assert.ok(dock && textOf(dock).indexOf('Waiting until') !== -1, 'a deferred ask waits quietly after reload');
  assert.ok(textOf(dock).indexOf('Seal it') === -1, 'the wait does not show Seal it');

  now += ws.SEAL_ASK_COOLDOWN_MS + 1;
  var fresh = await ws.askSeal(pendingId, 'again');
  await drain();
  assert.strictEqual(fresh.ok, true, 'the restored page can be asked after the cooldown');
  now += 6000;
  ws.resetRate();
  await ws.write(pendingId, 'a changed second page', 'mind');
  var stale = await ws.approveSeal(fresh.hash);
  await drain();
  assert.strictEqual(stale.ok, false, 'a changed page is not sealed from the old ask');
  assert.strictEqual(stale.reason, 'stale', 'the old ask is marked stale');

  now += 6000;
  ws.resetRate();
  var queueA = await ws.open('QueueOne', { kind: 'note' });
  now += 6000;
  ws.resetRate();
  await ws.write(queueA.page.id, 'queue one words', 'mind');
  now += 6000;
  ws.resetRate();
  var queueB = await ws.open('QueueTwo', { kind: 'note' });
  now += 6000;
  ws.resetRate();
  await ws.write(queueB.page.id, 'queue two words', 'mind');
  var askA = await ws.askSeal(queueA.page.id, 'first consent');
  var askB = await ws.askSeal(queueB.page.id, 'second consent');
  await drain();
  assert.strictEqual(askA.ok, true, 'the first queued ask is shown');
  assert.strictEqual(askB.ok, true, 'the second queued ask waits');
  dock = document.getElementById('fl-ws-asks');
  assert.ok(textOf(dock).indexOf('QueueOne') !== -1, 'the first consent ask is the one on screen');
  assert.ok(textOf(dock).indexOf('QueueTwo') === -1, 'the second consent ask waits its turn');
  findButton(dock, 'Later').click();
  await drain();
  dock = document.getElementById('fl-ws-asks');
  assert.ok(dock && textOf(dock).indexOf('QueueTwo') !== -1, 'after later the next ask shows');
  assert.ok(textOf(dock).indexOf('QueueOne') === -1, 'a deferred ask leaves the dock');

  var partial = 'Hello [FL_WS: {"op":"write","title":"Diary","text":"' + SECRET + '"';
  assert.ok(ws.strip(partial).indexOf(SECRET) === -1, 'a partial mark does not paint the private text');
  assert.ok(ws.strip(partial).indexOf('[FL_WS') === -1, 'a partial mark does not paint');

  console.log('VIEWPORT_NOTE seal ask heal v0.1: Playwright is not in this repo. The Approve rect at 390, 1280, and 200% is for the browser walk.');
  console.log('SMOKE_OK seal ask heal v0.1');
})().catch(function (err) {
  console.error(err);
  process.exit(1);
});
