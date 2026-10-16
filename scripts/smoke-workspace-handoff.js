// smoke-workspace-handoff.js (MIT) v-workspace-handoff-v0.1
// Node only. A private page is refused. A shared page becomes a sealed letter. Nothing is sent.
var fs = require('fs');
var path = require('path');
var os = require('os');
var assert = require('assert');

var rootDir = path.join(__dirname, '..');
var fetches = 0;
global.fetch = function () {
  fetches += 1;
  return Promise.reject(new Error('no request'));
};

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
      objectStoreNames: {
        contains: function (n) { return !!stores[n]; },
        get length() { return Object.keys(stores).length; }
      },
      createObjectStore: function (n, opts) { stores[n] = { keyPath: opts && opts.keyPath, rows: {} }; },
      close: function () {},
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
        tx.objectStore = function () {
          return {
            get: function (key) {
              return request(function (r) {
                var row = store && store.rows[key];
                r.result = row ? clone(row) : undefined;
              });
            },
            getAll: function () {
              return request(function (r) {
                r.result = store ? Object.keys(store.rows).map(function (k) { return clone(store.rows[k]); }) : [];
              });
            },
            add: function (record) {
              return request(function (r) {
                var key = store.keyPath ? record[store.keyPath] : 'primary';
                if (Object.prototype.hasOwnProperty.call(store.rows, key)) { r._fail = true; return; }
                store.rows[key] = clone(record);
                r.result = key;
              });
            },
            put: function (record, key) {
              return request(function (r) {
                var id = key != null ? key : (store.keyPath ? record[store.keyPath] : 'primary');
                store.rows[id] = clone(record);
                r.result = id;
              });
            }
          };
        };
        setTimeout(function () { closed = true; finish(); }, 0);
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

global.window = global;
global.localStorage = memStore();
global.sessionStorage = memStore();
global.indexedDB = makeIDB();
global.document = {
  readyState: 'loading',
  body: { appendChild: function () {} },
  addEventListener: function () {},
  getElementById: function () { return null; },
  createElement: function () {
    return {
      style: {},
      children: [],
      appendChild: function (c) { this.children.push(c); return c; },
      addEventListener: function () {},
      setAttribute: function () {},
      click: function () {}
    };
  }
};
global.FLMindSeal = {
  contextHash: function () { return Promise.resolve('abc123context'); },
  trustedMap: function () { return { 'room-model': { configHash: 'cfg' } }; }
};

var ws = require(path.join(rootDir, 'docs/modules/mind-workspace.js'));
var bridge = require(path.join(rootDir, 'docs/modules/fl-bridge.js'));
var door = require(path.join(rootDir, 'desktop/bridge-door.js'));
var bridgeSrc = fs.readFileSync(path.join(rootDir, 'docs/modules/fl-bridge.js'), 'utf8');
assert.ok(bridgeSrc.indexOf('fe' + 'tch') === -1, 'the bridge file makes no request');
assert.ok(ws.HANDOFF === 'v-workspace-handoff-v0.1', 'handoff marker');
assert.ok(ws.TREE_HANDOFF === 'v-tree-workspace-handoff-v0.1', 'tree handoff marker');

var now = 9000000;
ws.bindClock(function () { return now; });
var SECRET = 'SECRET-HANDOFF-041-private-page-text';
var SHARED = 'The porch page may be handed to Celeste.';

(async function () {
  await ws.accept();
  await ws.setMind('room-model', 'Lumen');
  bridge.setOn(true);
  var porch = await ws.open('Porch page', { kind: 'note' });
  var wrote = await ws.write(porch.page.id, SHARED, 'mind');
  assert.ok(wrote.hash, 'shared version hash');
  var lantern = await ws.open('Lantern', { kind: 'note' });
  await ws.write(lantern.page.id, SECRET, 'mind');
  now += 10;
  ws.resetRate();
  var priv = ws.consumeReply('[FL_WS: {"op":"private","page":"' + lantern.page.id + '","on":true}]');
  await priv.done;
  now += 10;
  ws.resetRate();
  var refused = ws.consumeReply('[FL_WS: {"op":"handoff","page":"' + lantern.page.id + '","note":"please read this"}]');
  var refusedLines = await refused.done;
  assert.ok(refusedLines.join('\n').indexOf('This page is private. The mind must share it first.') !== -1, 'private page refused');
  assert.ok(JSON.stringify(bridge.outboxView()).indexOf(SECRET) === -1, 'private text is not in the outbox');
  assert.ok(!bridge.outboxView().some(function (row) { return row.kind === 'letter'; }), 'no letter for a private page');

  now += 10;
  ws.resetRate();
  var asked = ws.consumeReply('[FL_WS: {"op":"handoff","page":"' + porch.page.id + '","note":"the porch light"}]');
  var askedLines = await asked.done;
  assert.ok(askedLines.join('\n').indexOf('would like to hand Porch page (version ' + wrote.hash.slice(0, 8) + ') to Celeste. Note: the porch light') !== -1, 'the person sees the ask');
  var early = await ws.prepareHandoff(porch.page.id);
  assert.strictEqual(early.ok, false, 'no letter before the knock');
  assert.strictEqual(early.line, 'Knock first: Celeste has not met this device yet', 'knock first');
  assert.strictEqual(fetches, 0, 'the refusal makes no request');

  var knock = await bridge.sealKnock();
  assert.strictEqual(knock.ok, true, 'the person seals the knock');
  var prepared = await ws.prepareHandoff(porch.page.id);
  assert.strictEqual(prepared.ok, true, 'prepare seals a letter');
  assert.strictEqual(prepared.sent, false, 'prepare does not send');
  assert.strictEqual(prepared.state, 'sealed', 'the letter is sealed');
  var raw = JSON.stringify(prepared.envelope);
  assert.ok(raw.indexOf(SECRET) === -1, 'private text is absent');
  assert.ok(raw.indexOf(SHARED) !== -1, 'the shared version is the body');
  assert.ok(prepared.envelope.letter.subject.indexOf('Page from Lumen: Porch page') === 0, 'subject');
  assert.ok(prepared.envelope.letter.attach_hashes.indexOf(wrote.hash) !== -1, 'version hash is attached');
  assert.strictEqual(prepared.envelope.letter.mind.model, 'room-model', 'mind is the seal id');
  var letter = bridge.outboxView().filter(function (row) { return row.kind === 'letter' && row.state === 'sealed'; });
  assert.strictEqual(letter.length, 1, 'one sealed letter in the outbox');
  assert.ok(!bridge.outboxView().some(function (row) { return row.state === 'sent'; }), 'nothing was sent');
  assert.strictEqual(fetches, 0, 'sealing makes no request');

  var tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fl-ws-handoff-'));
  door.bindSmoke({ root: tmp, safeStorage: null });
  var doorResult = await door.send(prepared.envelope);
  assert.strictEqual(doorResult.ok, false, 'placeholder door refuses');
  assert.strictEqual(doorResult.reason, 'unset', 'placeholder url is unset');
  assert.strictEqual(fetches, 0, 'requests made: 0');

  await ws.refreshWake();
  assert.ok(/Handed Porch page to Celeste on \d{4}-\d{2}-\d{2} \(not answered yet\)\./.test(ws.promptDelta()), 'wake names the handoff');
  ws.noteReply('Celeste wrote back ' + prepared.envelope.hash);
  await ws.refreshWake();
  assert.ok(ws.promptDelta().indexOf('Celeste answered.') !== -1, 'a reply that names the hash is an answer');

  console.log('SMOKE_OK workspace handoff v0.1');
})().catch(function (err) {
  console.error(err);
  process.exit(1);
});
