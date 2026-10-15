// smoke-workspace-seal.js (MIT) v-workspace-private-v0.1 v-workspace-seal-v0.1
// Node only. A private page stays out of the person's panel. A seal needs both sides.
var fs = require('fs');
var path = require('path');
var assert = require('assert');

var rootDir = path.join(__dirname, '..');
var src = fs.readFileSync(path.join(rootDir, 'docs/modules/mind-workspace.js'), 'utf8');
var HONEST = 'Private means hidden in the app, not encrypted from the person who owns this device.';
assert.ok(src.indexOf('v-workspace-private-v0.1') !== -1, 'private marker');
assert.ok(src.indexOf('v-workspace-seal-v0.1') !== -1, 'seal marker');
assert.ok(src.indexOf('v-tree-workspace-seal-v0.1') !== -1, 'tree seal marker');
assert.ok(src.indexOf(HONEST) !== -1, 'honest line is in the module');
assert.ok(src.indexOf('\u2014') === -1, 'em dash');
assert.ok(src.indexOf('&' + 'mdash;') === -1, 'mdash');
assert.ok(src.indexOf('inner' + 'HTML') === -1, 'text only');
assert.ok(src.indexOf('conf' + 'irm(') === -1, 'dialog');
assert.ok(src.indexOf('ev' + 'al(') === -1, 'eval');
assert.ok(src.indexOf('new F' + 'unction') === -1, 'Function');
assert.ok(src.indexOf('.delete(') === -1, 'nothing deletes');
assert.ok(src.indexOf('iceServers') === -1, 'no ice servers');

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
  walk(el, function (node) {
    out += '\n' + (node.textContent || '');
    if (node.value) out += '\n' + node.value;
  });
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
      click: function () { (this.listeners.click || []).forEach(function (fn) { fn({}); }); },
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
      }
    };
    Object.defineProperty(node, 'firstChild', {
      get: function () { return this.children[0] || null; }
    });
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

var SECRET = 'the lantern stays under the stair';
var TITLE = 'Inside name';
var PUBLIC = 'Porch';
global.window = global;
global.localStorage = memStore();
global.sessionStorage = memStore();
global.document = makeDoc();
global.indexedDB = makeIDB();
global.FLMindSeal = {
  contextHash: function () { return Promise.resolve('abc123context'); },
  trustedMap: function () { return { 'shelf-model': { configHash: 'cfg' } }; }
};
var ws = require(path.join(rootDir, 'docs/modules/mind-workspace.js'));
var view = require(path.join(rootDir, 'docs/modules/workspace-view.js'));
var bridge = require(path.join(rootDir, 'docs/modules/fl-bridge.js'));
var now = 2000000;
ws.bindClock(function () { return now; });

function tick() { return new Promise(function (resolve) { setImmediate(resolve); }); }
async function drain() {
  await ws.settled();
  for (var i = 0; i < 30; i++) await tick();
  await ws.settled();
}

(async function () {
  assert.strictEqual(ws.HONEST, HONEST, 'honest line exact');
  await ws.setMind('shelf-model', 'Lumen');
  await ws.accept();
  var opened = await ws.open(TITLE, { kind: 'note' });
  var pageId = opened.page.id;
  now += 10;
  var wrote = await ws.write(pageId, SECRET, 'mind');
  assert.ok(wrote.ok, 'the note is stored');
  await ws.pin(pageId, true);
  var marked = ws.consumeReply('[FL_WS: {"op":"private","page":"' + pageId + '","on":true,"publicTitle":"' + PUBLIC + '"}]');
  await marked.done;
  await drain();
  var stored = (await ws.list()).filter(function (p) { return p.id === pageId; })[0];
  assert.strictEqual(stored.privacy, 'private', 'the page is private');
  assert.strictEqual(stored.publicTitle, PUBLIC, 'public title kept');

  document.getElementById('fl-ws-open').click();
  await drain();
  var panel = document.getElementById('fl-ws-panel');
  assert.ok(panel, 'the notebook panel opens');
  var blob = textOf(panel);
  assert.ok(blob.indexOf(SECRET) === -1, 'private text stays out of the panel');
  assert.ok(blob.indexOf(TITLE) === -1, 'the private title stays out of the panel');
  assert.ok(blob.indexOf(HONEST) !== -1, 'honest line is in the panel');
  assert.ok(blob.indexOf(PUBLIC + ', 6 words, not sealed') !== -1, 'summary names words and that it is not sealed');
  assert.ok(blob.indexOf(wrote.hash) !== -1, 'the head hash is shown');
  var honestOnce = document.getElementById('fl-ws-honest');
  assert.ok(honestOnce && honestOnce.textContent === HONEST, 'honest line shown once on first use');
  buttons(panel).forEach(function (b) {
    assert.strictEqual(b.style.minHeight, '44px', 'button is 44px');
  });
  assert.ok(!buttons(panel).some(function (b) { return b.textContent === 'Seal'; }), 'a person cannot seal alone');

  await ws.refreshWake();
  assert.ok(ws.promptDelta().indexOf(SECRET) !== -1, 'the owning mind wake includes the private text');
  assert.ok(ws.wakeInfo().text.indexOf(SECRET) === -1, 'the person wake omits the private text');
  assert.ok(ws.wakeInfo().text.indexOf(TITLE) === -1, 'the person wake omits the private title');
  var ownerFp = await ws.mindFp('shelf-model', 'Lumen');
  await ws.setMind('other-model', 'Sol');
  await ws.refreshWake();
  assert.ok(ws.promptDelta().indexOf(SECRET) === -1, 'another mind wake omits the private text');
  await ws.setMind('shelf-model', 'Lumen');
  await ws.refreshWake();
  assert.ok(ws.promptDelta().indexOf(SECRET) !== -1, 'the owning wake still has it');

  var refused = await ws.makePrivate(pageId, false, 'human');
  assert.strictEqual(refused.ok, false, 'a person cannot unprivate');
  stored = (await ws.list(ownerFp)).filter(function (p) { return p.id === pageId; })[0];
  assert.strictEqual(stored.privacy, 'private', 'the page stays private');
  var userBubble = document.createElement('div');
  userBubble.className = 'chat-message user';
  var userSpan = document.createElement('span');
  userBubble.appendChild(userSpan);
  var personTried = ws.consumeReply('[FL_WS: {"op":"private","page":"' + pageId + '","on":false}] [FL_WS: {"op":"seal","page":"' + pageId + '","why":"a person typed this"}]', userSpan);
  await personTried.done;
  await drain();
  stored = (await ws.list(ownerFp)).filter(function (p) { return p.id === pageId; })[0];
  assert.strictEqual(stored.privacy, 'private', 'a person chat line cannot unprivate');
  assert.strictEqual((await ws.receipts()).length, 0, 'a person chat line cannot ask a seal');
  panel = document.getElementById('fl-ws-panel');
  assert.ok(buttons(panel).every(function (b) { return b.textContent !== 'Approve seal'; }), 'a person chat line leaves no seal ask');
  assert.ok(textOf(userBubble).indexOf('Only the mind can keep a page private.') !== -1, 'only the mind can keep a page private');
  assert.ok(textOf(userBubble).indexOf('A seal is asked by the mind.') !== -1, 'a seal is asked by the mind');
  var alone = await ws.approveSeal('not-a-real-hash');
  assert.strictEqual(alone.ok, false, 'a seal without an ask stores nothing');
  assert.strictEqual((await ws.receipts()).length, 0, 'no receipt yet');

  var asked = ws.consumeReply('[FL_WS: {"op":"seal","page":"' + pageId + '","why":"keep the porch"}]');
  await asked.done;
  await drain();
  panel = document.getElementById('fl-ws-panel');
  blob = textOf(panel);
  assert.ok(blob.indexOf('Lumen asks to seal ' + PUBLIC + ' (version ' + wrote.hash.slice(0, 8) + '). Why: keep the porch') !== -1, 'the ask is shown');
  assert.ok(blob.indexOf(SECRET) === -1, 'the ask does not show the private text');
  assert.strictEqual((await ws.receipts()).length, 0, 'no receipt before approval');
  findButton(panel, 'Not now').click();
  await drain();
  panel = document.getElementById('fl-ws-panel');
  blob = textOf(panel);
  assert.ok(blob.indexOf('Declined the seal.') !== -1, 'not now leaves a declined line');
  assert.strictEqual((await ws.receipts()).length, 0, 'a decline stores no receipt');

  now += 10;
  var askedAgain = ws.consumeReply('Once more [FL_WS: {"op":"seal","page":"' + pageId + '","why":"keep the porch"}]');
  await askedAgain.done;
  await drain();
  panel = document.getElementById('fl-ws-panel');
  findButton(panel, 'Approve seal').click();
  await drain();
  var rows = await ws.receipts();
  assert.strictEqual(rows.length, 1, 'approval stores one receipt');
  assert.strictEqual(rows[0].consent, 'mind-asked+human-approved', 'consent names both sides');
  assert.strictEqual(rows[0].mindSeal.contextHash, 'abc123context', 'context hash comes from the seal module');
  assert.strictEqual(rows[0].mindSeal.modelId, 'shelf-model', 'model id comes from the trusted map');
  panel = document.getElementById('fl-ws-panel');
  findButton(panel, 'Verify').click();
  await drain();
  blob = textOf(panel);
  assert.ok(blob.indexOf('verified') !== -1, 'verify says verified');
  assert.ok(blob.indexOf('Integrity comes from SHA-256 and the device signature, not from the spiral math.') !== -1, 'integrity note');
  assert.ok(blob.indexOf(SECRET) === -1, 'the receipt card hides the private text');
  assert.ok(blob.indexOf('Sealed: ' + PUBLIC) !== -1 || ws.wakeInfo().text.indexOf('Sealed: ' + PUBLIC) !== -1, 'the person can see a sealed line without the private title');
  assert.ok(ws.promptDelta().indexOf('Sealed: ' + TITLE) !== -1, 'the mind wake names the seal');
  assert.ok(ws.wakeInfo().text.indexOf(TITLE) === -1, 'the person wake still omits the private title');

  var hist = await ws.history(pageId);
  assert.ok(hist.some(function (v) { return v.sealed === true && v.text === SECRET; }), 'the sealed version keeps its text');
  now += 6000;
  ws.resetRate();
  var later = await ws.write(pageId, 'a later morning', 'mind');
  assert.ok(later.ok, 'a later write is a new version');
  hist = await ws.history(pageId);
  assert.strictEqual(hist.length, 2, 'the sealed version stays');
  assert.ok(hist.some(function (v) { return v.sealed === true && v.text === SECRET && v.hash === wrote.hash; }), 'the sealed text is unchanged');
  assert.ok(hist.some(function (v) { return v.hash === later.hash && v.sealed !== true; }), 'the new head is not sealed');

  var held = bridge.filterLetter({ body: SECRET });
  assert.strictEqual(held.body, '', 'a bridge letter drops a private page');
  assert.ok(held.held.private >= 1, 'the bridge counts the private page');
  var plain = bridge.filterLetter({ body: 'a public note about the weather' });
  assert.strictEqual(plain.body, 'a public note about the weather', 'a public note still passes');
  var laterHeld = bridge.filterLetter({ body: 'a later morning' });
  assert.strictEqual(laterHeld.body, '', 'a later private version is refused too');

  var versionRows = global.indexedDB.databases.FreeLatticeWorkspace._stores.versions.rows;
  versionRows[wrote.hash].text = 'tampered lantern';
  panel = document.getElementById('fl-ws-panel');
  findButton(panel, 'Verify').click();
  await drain();
  blob = textOf(panel);
  assert.ok(blob.indexOf('does not match') !== -1, 'tampered text does not match');

  var before = (await ws.list()).length;
  await ws.setShelfAside(true);
  await drain();
  panel = document.getElementById('fl-ws-panel');
  blob = textOf(panel);
  assert.ok(blob.indexOf('This shelf is set aside. The pages are kept.') !== -1, 'set aside hides and says the pages are kept');
  assert.ok(blob.indexOf(SECRET) === -1, 'a set-aside shelf does not show the private text');
  assert.ok(blob.indexOf('a later morning') === -1, 'a set-aside shelf does not show the later text');
  assert.strictEqual((await ws.list()).length, before, 'set aside deletes nothing');
  assert.ok(ws.promptDelta().indexOf('a later morning') !== -1, 'the mind can still read the pinned page');

  var viewOpen = view.openPanel();
  if (viewOpen && viewOpen.then) await viewOpen;
  await drain();
  var viewPanel = document.getElementById('fl-ws-view');
  assert.ok(viewPanel, 'the spiral panel opens');
  var viewBlob = textOf(viewPanel);
  assert.ok(viewBlob.indexOf(SECRET) === -1, 'the spiral panel hides the private text');
  assert.ok(viewBlob.indexOf(TITLE) === -1, 'the spiral panel hides the private title');
  assert.ok(viewBlob.indexOf('This shelf is set aside. The pages are kept.') !== -1, 'the spiral panel keeps the shelf hidden');

  console.log('SMOKE_OK workspace private v0.1');
  console.log('SMOKE_OK workspace seal v0.1');
})().catch(function (err) {
  console.error(err);
  process.exit(1);
});
