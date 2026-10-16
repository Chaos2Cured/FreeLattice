// smoke-workspace-mirror.js (MIT) v-workspace-desktop-v0.1
// Node only. The desktop copy is append-only. Restore merges. Nothing is overwritten.
var fs = require('fs');
var path = require('path');
var os = require('os');
var assert = require('assert');

var rootDir = path.join(__dirname, '..', '..');
var mirror = require(path.join(__dirname, '..', 'workspace-mirror.js'));
var src = fs.readFileSync(path.join(__dirname, '..', 'workspace-mirror.js'), 'utf8');
var preload = fs.readFileSync(path.join(__dirname, '..', 'preload.js'), 'utf8');
var mainSrc = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');

assert.ok(src.indexOf('v-workspace-desktop-v0.1') !== -1, 'marker');
assert.ok(src.indexOf('writeFile') === -1, 'no rewrite');
assert.ok(src.indexOf('truncate') === -1, 'no truncate');
assert.ok(src.indexOf('appendFile') !== -1, 'append only');
assert.ok(src.indexOf('child_process') === -1, 'no shell');
assert.ok(src.indexOf('exec(') === -1, 'no shell call');
assert.ok(src.indexOf('spawn') === -1, 'no spawn');
assert.ok(preload.indexOf("exposeInMainWorld('flWorkspaceMirror'") !== -1, 'preload exposes the mirror');
assert.ok(preload.indexOf('fl-workspace-mirror-append') !== -1, 'preload append');
assert.ok(preload.indexOf('fl-workspace-mirror-head') !== -1, 'preload head');
assert.ok(preload.indexOf('fl-workspace-mirror-restore') !== -1, 'preload restore');
assert.ok(mainSrc.indexOf('fl-workspace-mirror-append') !== -1, 'main append');
assert.ok(mainSrc.indexOf('fl-workspace-mirror-head') !== -1, 'main head');
assert.ok(mainSrc.indexOf('fl-workspace-mirror-restore') !== -1, 'main restore');

var fp = 'ab'.repeat(32);
var winRoot = 'C:\\Users\\Kirk\\AppData\\Roaming\\FreeLattice';
var winFile = path.win32.join(winRoot, 'workspace', fp + '.jsonl');
assert.strictEqual(mirror.joined(winRoot, fp, path.win32), winFile, 'windows path');
assert.ok(winFile.indexOf('/') === -1, 'windows separators');
assert.throws(function () { mirror.joined(winRoot, '../etc/passwd', path.win32); }, 'a path cannot escape');

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
        tx.objectStore = function () {
          return {
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

var tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fl-ws-mirror-'));
mirror.bindSmoke(tmp);
global.window = global;
global.localStorage = memStore();
global.sessionStorage = memStore();
global.indexedDB = makeIDB();
global.document = {
  readyState: 'loading',
  body: null,
  addEventListener: function () {},
  getElementById: function () { return null; },
  createElement: function () {
    return { style: {}, appendChild: function (c) { return c; }, addEventListener: function () {}, setAttribute: function () {} };
  }
};
global.flWorkspaceMirror = {
  append: function (line) { return mirror.append(line); },
  head: function (mindFp) { return mirror.head(mindFp); },
  restore: function (mindFp) { return mirror.restore(mindFp); }
};
var ws = require(path.join(rootDir, 'docs/modules/mind-workspace.js'));
var now = 8000000;
ws.bindClock(function () { return now; });
var SECRET = 'SECRET-LANTERN-041-stays-on-this-device';
var SHARED = 'The porch page stays shared.';

(async function () {
  await ws.accept();
  await ws.setMind('room-model', 'Lumen');
  var mind = await ws.mindFp('room-model', 'Lumen');
  var porch = await ws.open('Porch page', { kind: 'note' });
  var wrote = await ws.write(porch.page.id, SHARED, 'mind');
  assert.ok(wrote.ok, 'shared version');
  var lantern = await ws.open('Lantern', { kind: 'note' });
  await ws.write(lantern.page.id, SECRET, 'mind');
  var priv = ws.consumeReply('[FL_WS: {"op":"private","page":"' + lantern.page.id + '","on":true}]');
  await priv.done;
  var file = mirror.fileFor(mind);
  var good = fs.readFileSync(file, 'utf8');
  assert.ok(good.indexOf(mirror.HONEST) !== -1, 'header repeats the honest line');
  assert.ok(good.indexOf(SECRET) !== -1, 'a private page is mirrored on this device');
  assert.ok(good.indexOf(SHARED) !== -1, 'a shared page is mirrored');
  var check = mirror.verify(mind);
  assert.strictEqual(check.ok, true, 'lines chain');
  var parsed = good.split('\n').filter(Boolean).map(function (line) { return JSON.parse(line); });
  assert.strictEqual(parsed[0].kind, 'header', 'header is first');
  assert.strictEqual(parsed.filter(function (row) { return row.kind === 'header'; }).length, 1, 'one header');
  var prev = null;
  parsed.forEach(function (row, i) {
    if (i === 0) assert.strictEqual(row.prevLineHash, '0000000000000000000000000000000000000000000000000000000000000000', 'genesis');
    else assert.strictEqual(row.prevLineHash, prev, 'each line carries the previous hash');
    prev = row.lineHash;
  });
  var firstLine = good.split('\n')[0];
  now += 10;
  ws.resetRate();
  await ws.pin(porch.page.id, true);
  var after = fs.readFileSync(file, 'utf8');
  assert.ok(after.indexOf(firstLine) === 0, 'later lines do not rewrite the first');

  var lines = good.split('\n');
  var at = -1;
  for (var i = 0; i < lines.length; i++) {
    if (!lines[i]) continue;
    var row = JSON.parse(lines[i]);
    if (row.kind === 'version' && row.body && row.body.text === SHARED) { at = i; break; }
  }
  assert.ok(at > 0, 'a version line to tamper');
  var tampered = JSON.parse(lines[at]);
  tampered.body.text = 'tampered';
  lines[at] = JSON.stringify(tampered);
  fs.writeFileSync(file, lines.join('\n'));
  var broken = mirror.verify(mind);
  assert.strictEqual(broken.ok, false, 'tamper breaks verify');
  assert.strictEqual(broken.at, at, 'verify breaks at that line');
  fs.writeFileSync(file, good);

  var kept = await ws.history(porch.page.id);
  assert.strictEqual(kept[0].text, SHARED, 'text before restore');
  var again = await ws.importSection(mirror.restore(mind).section, 'merge', { sameDevice: true });
  assert.strictEqual(again.ok, true, 'restore merge');
  assert.strictEqual(again.added.versions, 0, 'same hash is skipped');
  var still = await ws.history(porch.page.id);
  assert.strictEqual(still[0].text, SHARED, 'nothing overwritten');

  Object.keys(global.indexedDB.databases).forEach(function (name) { delete global.indexedDB.databases[name]; });
  ws.resetForSmoke();
  ws.bindClock(function () { return now; });
  await ws.accept();
  await ws.setMind('room-model', 'Lumen');
  var back = await ws.importSection(mirror.restore(mind).section, 'merge', { sameDevice: true });
  assert.strictEqual(back.ok, true, 'fresh notebook accepts the copy');
  assert.ok(back.added.pages >= 2, 'pages return');
  var titles = (await ws.list()).map(function (p) { return p.title; });
  assert.ok(titles.indexOf('Porch page') !== -1, 'shared page restored');
  assert.ok(titles.indexOf('Lantern') !== -1, 'private page restored');
  var hidden = (await ws.list()).filter(function (p) { return p.title === 'Lantern'; })[0];
  assert.strictEqual(hidden.privacy, 'private', 'privacy stays private');
  var hiddenText = (await ws.history(hidden.id)).map(function (v) { return v.text; }).join('\n');
  assert.ok(hiddenText.indexOf(SECRET) !== -1, 'private text came back from this device');
  var twice = await ws.importSection(mirror.restore(mind).section, 'merge', { sameDevice: true });
  assert.strictEqual(twice.added.pages, 0, 'second restore adds no pages');
  assert.strictEqual(twice.added.versions, 0, 'second restore adds no versions');
  var refused = await ws.importSection(mirror.restore(mind).section, 'merge');
  assert.ok(refused.added.refusedPrivate >= 1, 'a file merge still refuses a private page');

  console.log('SMOKE_OK workspace desktop v0.1');
})().catch(function (err) {
  console.error(err);
  process.exit(1);
});
