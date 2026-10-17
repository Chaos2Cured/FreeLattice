// smoke-workspace-export.js (MIT) v-workspace-export-v0.1
// Node only. A private page stays on this device. The notebook leaves with the export.
var fs = require('fs');
var path = require('path');
var assert = require('assert');
var spawnSync = require('child_process').spawnSync;

var rootDir = path.join(__dirname, '..');
var src = fs.readFileSync(path.join(rootDir, 'docs/modules/mind-workspace.js'), 'utf8');
var exportSrc = fs.readFileSync(path.join(rootDir, 'docs/modules/lattice-export.js'), 'utf8');
assert.ok(src.indexOf('v-workspace-export-v0.1') !== -1, 'marker');
assert.ok(src.indexOf('v-tree-workspace-export-v0.1') !== -1, 'tree marker');
assert.ok(src.indexOf('\u2014') === -1, 'em dash');
assert.ok(src.indexOf('&' + 'mdash;') === -1, 'mdash');
assert.ok(src.indexOf('inner' + 'HTML') === -1, 'text only');
assert.ok(src.indexOf('conf' + 'irm(') === -1, 'dialog');
assert.ok(src.indexOf('ev' + 'al(') === -1, 'eval');
assert.ok(src.indexOf('new F' + 'unction') === -1, 'Function');
assert.ok(src.indexOf('.delete(') === -1, 'nothing deletes');
assert.ok(src.indexOf('iceServers') === -1, 'no ice servers');
assert.ok(!/openai|anthropic|claude|chatgpt|gemini|ollama|grok|xai|huggingface|qwen|llama/i.test(src), 'no platform name');
assert.ok(/function\s+filterQuietRoomFromLedger[\s\S]{0,500}QUIET_ROOM_IDENTIFIERS/.test(exportSrc), 'quiet room check 1');
assert.ok(/function\s+assertNoQuietRoomInJson[\s\S]{0,500}throw\s+new\s+Error/.test(exportSrc), 'quiet room check 2');
assert.ok(/function\s+assertNoQuietRoomInBlob[\s\S]{0,300}blob\.text\(\)/.test(exportSrc), 'quiet room check 3');
assert.ok(/filterQuietRoomFromLedger[\s\S]{0,4000}assertNoQuietRoomInJson[\s\S]{0,1500}assertNoQuietRoomInBlob/.test(exportSrc), 'quiet room order');
assert.ok(/longer chain wins/.test(exportSrc), 'ledger merge stays intent only');
assert.ok(/existing-chain-present-adopt-refused/.test(exportSrc), 'adopt still refuses a chain');

var indexHtml = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
var appHtml = fs.readFileSync(path.join(rootDir, 'docs/app.html'), 'utf8');
var memoryLine = "Your mind's notebook lives in this browser (IndexedDB) or the desktop app's folder, and leaves with your export. Private pages stay here.";
assert.strictEqual(indexHtml, appHtml, 'index.html matches docs/app.html');
assert.ok(indexHtml.indexOf(memoryLine) !== -1, 'memory line');
assert.ok(fs.readFileSync(path.join(rootDir, 'app.html'), 'utf8').indexOf(memoryLine) === -1, 'root app.html untouched');
var desktopCopy = path.join(rootDir, 'desktop/app/index.html');
if (!fs.existsSync(desktopCopy)) console.log('skip: desktop copy not built');
else assert.ok(fs.readFileSync(desktopCopy, 'utf8').indexOf(memoryLine) === -1, 'desktop copy untouched');

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

var SHARED_TITLE = 'Porch page';
var SHARED_BODY = 'The porch stays in the export on purpose.';
var SHARED_SEED = 'porch seed stays';
var SHARED_WHY = 'because the porch is shared';
var PRIV_TITLE = 'SECRET-TITLE-040b-LANTERN';
var PRIV_BODY = 'SECRET-BODY-040b-the-lantern-under-the-stair';
var PRIV_SEED = 'SECRET-SEED-040b-amber-glass';
var PRIV_WHY = 'SECRET-WHY-040b-keep-the-lantern';
var MIND_TITLE = 'SECRET-TITLE-MIND-PRIVATE-040b';
var MIND_BODY = 'SECRET-BODY-MIND-PRIVATE-040b-violet-glass';
var MIND_SEED = 'SECRET-SEED-MIND-PRIVATE-040b-violet';
var NYX_TITLE = 'Market page';
var NYX_BODY = 'A market note that leaves with the shelf.';
var LINE = 'Notebook: 4 pages, 2 private pages stayed on this device.';
var PRIVATE_NOTE = 'Private pages are not in this file. They stayed on the device that made the export.';
var BRANCH_NOTE = 'Parent was not in this notebook, so this version came in as its own branch.';

var idb = makeIDB();
global.window = global;
global.localStorage = memStore();
global.sessionStorage = memStore();
global.indexedDB = idb;
global.FLMindSeal = {
  contextHash: function () { return Promise.resolve('abc123context'); },
  trustedMap: function () { return { 'room-model': { configHash: 'cfg' } }; }
};
var ws = require(path.join(rootDir, 'docs/modules/mind-workspace.js'));
var LatticeExport = require(path.join(rootDir, 'docs/modules/lattice-export.js'));
if (!LatticeExport || !LatticeExport.exportArchive) LatticeExport = global.LatticeExport;
var now = 4000000;
ws.bindClock(function () { return now; });

function tick() { return new Promise(function (resolve) { setImmediate(resolve); }); }
async function drain() {
  await ws.settled();
  for (var i = 0; i < 40; i++) await tick();
  await ws.settled();
}
function advance() { now += 10; ws.resetRate(); }
function stores() {
  var db = idb.databases.FreeLatticeWorkspace;
  assert.ok(db && db._stores, 'notebook db');
  return db._stores;
}
function wipe() {
  Object.keys(idb.databases).forEach(function (name) { delete idb.databases[name]; });
  ws.resetForSmoke();
  ws.bindClock(function () { return now; });
}
function grepFile(file, needle) {
  return spawnSync('grep', ['-F', '-e', needle, file], { encoding: 'utf8' });
}
function pageByTitle(section, title) {
  var found = null;
  (section.shelves || []).forEach(function (shelf) {
    (shelf.pages || []).forEach(function (page) {
      if (page.title === title) found = { shelf: shelf, page: page };
    });
  });
  return found;
}

(async function () {
  var internal = LatticeExport._internal;
  assert.throws(function () { internal.assertNoQuietRoomInJson('{"a":"quiet-room"}'); }, /Quiet Room/);
  var kept = internal.filterQuietRoomFromLedger([{ persona: 'quiet-room' }, { persona: 'lumen' }]);
  assert.strictEqual(kept.length, 1, 'quiet room source filter still drops');
  assert.strictEqual(kept[0].persona, 'lumen', 'shared ledger row stays');
  var blob = new Blob(['{"ok":true}'], { type: 'application/json' });
  await internal.assertNoQuietRoomInBlob(blob);

  await ws.accept();
  await ws.setMind('room-model', 'Lumen');
  advance();
  var shared = await ws.open(SHARED_TITLE, { kind: 'note' });
  advance();
  var first = await ws.write(shared.page.id, 'first porch line', 'mind');
  advance();
  var second = await ws.write(shared.page.id, SHARED_BODY, 'mind');
  await ws.seed(shared.page.id, SHARED_SEED);
  var asked = ws.consumeReply('[FL_WS: {"op":"seal","page":"' + shared.page.id + '","why":"' + SHARED_WHY + '"}]');
  await asked.done;
  await drain();
  var sealed = await ws.approveSeal(second.hash);
  assert.strictEqual(sealed.ok, true, 'shared seal stored');

  advance();
  var priv = await ws.open(PRIV_TITLE, { kind: 'note' });
  advance();
  await ws.write(priv.page.id, PRIV_BODY, 'mind');
  await ws.seed(priv.page.id, PRIV_SEED);
  var hid = await ws.makePrivate(priv.page.id, true, 'mind', 'a private page');
  assert.strictEqual(hid.ok, true, 'page is private');
  var privAsk = ws.consumeReply('[FL_WS: {"op":"seal","page":"' + priv.page.id + '","why":"' + PRIV_WHY + '"}]');
  await privAsk.done;
  await drain();
  var privHead = hid.page.head;
  var privSeal = await ws.approveSeal(privHead);
  assert.strictEqual(privSeal.ok, true, 'private seal stored');
  await ws.setShelfAside(true);
  var lumenFp = await ws.mindFp('room-model', 'Lumen');

  var mpId = 'ws-mind-private-040b';
  stores().pages.rows[mpId] = {
    id: mpId, mindFp: lumenFp, title: MIND_TITLE, kind: 'note', privacy: 'mind-private',
    pinned: false, aside: false, head: null, heads: [], seed: MIND_SEED, seedByHash: { x: MIND_SEED }, updated: 1
  };
  stores().versions.rows['mindprivateversion0000000000000000000000000000000000000000000000000000'] = {
    hash: 'mindprivateversion0000000000000000000000000000000000000000000000000000',
    pageId: mpId, parent: null, branchOf: null, ts: 1, author: 'mind', text: MIND_BODY, meta: {}
  };

  advance();
  await ws.setMind('other-model', 'Nyx');
  var market = await ws.open(NYX_TITLE, { kind: 'note' });
  advance();
  await ws.write(market.page.id, NYX_BODY, 'mind');

  var packed = await ws.exportSection();
  assert.strictEqual(packed.section.line, LINE, 'count line');
  var porch = pageByTitle(packed.section, SHARED_TITLE);
  var marketRow = pageByTitle(packed.section, NYX_TITLE);
  assert.ok(porch && porch.shelf.setAside === true, 'set-aside shelf is kept');
  assert.ok(marketRow && marketRow.shelf.setAside === false, 'other shelf is not set aside');
  assert.ok(!pageByTitle(packed.section, PRIV_TITLE), 'private page record stays out');
  assert.ok(!pageByTitle(packed.section, MIND_TITLE), 'mind-private page record stays out');
  var stubs = [];
  packed.section.shelves.forEach(function (shelf) {
    (shelf.receipts || []).forEach(function (row) {
      if (row.text && row.text.private === true) stubs.push(row);
    });
  });
  assert.strictEqual(stubs.length, 1, 'one private receipt stub');
  assert.ok(!Object.prototype.hasOwnProperty.call(stubs[0], 'why'), 'private why stays out');

  var file = await LatticeExport.exportArchive({ mode: 'full', personae: 'all' });
  var text = await file.text();
  var outPath = path.join('/tmp', 'gc040b-smoke-archive.json');
  fs.writeFileSync(outPath, text);
  [PRIV_TITLE, PRIV_BODY, PRIV_SEED, PRIV_WHY, MIND_TITLE, MIND_BODY, MIND_SEED].forEach(function (needle) {
    var found = grepFile(outPath, needle);
    assert.strictEqual(found.status, 1, 'grep absent ' + needle);
  });
  assert.strictEqual(grepFile(outPath, SHARED_BODY).status, 0, 'shared body leaves');
  assert.strictEqual(grepFile(outPath, SHARED_WHY).status, 0, 'shared receipt why leaves');
  assert.strictEqual(grepFile(outPath, 'quiet-room').status, 1, 'quiet room string absent');
  assert.strictEqual(grepFile(outPath, 'quiet_room').status, 1, 'quiet room snake absent');
  assert.strictEqual(grepFile(outPath, 'quietroom').status, 1, 'quiet room joined absent');
  var parsed = JSON.parse(text);
  assert.strictEqual(parsed.workspace.line, LINE, 'signed section carries the line');
  assert.ok(parsed.signature, 'archive is signed');
  assert.ok(parsed.ledgers && parsed.chain && parsed.garden && parsed.trust, 'existing sections stay');
  global.localStorage.setItem('fl_consentLedger', JSON.stringify([{ persona: 'quiet-room', note: 'nope' }]));
  var aborted = false;
  try { await LatticeExport.exportArchive({ mode: 'full', personae: 'all' }); }
  catch (e) { aborted = /Quiet Room/.test(String(e && e.message)); }
  assert.strictEqual(aborted, true, 'quiet room check still aborts the export');
  global.localStorage.removeItem('fl_consentLedger');

  var saved = JSON.parse(JSON.stringify(parsed.workspace));
  var asideKey = 'fl_ws_aside_' + porch.shelf.mindFp;
  global.localStorage.removeItem(asideKey);
  global.localStorage.removeItem('fl_ws_device_key_v1');
  wipe();
  await ws.accept();
  await ws.setMind('room-model', 'Lumen');
  var fresh = new File([text], 'archive.json', { type: 'application/json' });
  var verified = await LatticeExport.importArchive(fresh, { strategy: 'verify-only' });
  assert.strictEqual(verified.ok, true, 'verify ok');
  assert.strictEqual(verified.workspace.hashMismatches, 0, 'verify rehashes');
  assert.strictEqual(verified.workspace.receiptMismatches, 0, 'verify receipts');
  assert.ok(verified.workspace.lines.some(function (line) { return line.indexOf('sealed on another device (') === 0; }), 'other device line');
  assert.strictEqual(Object.keys(stores().pages.rows).length, 0, 'verify writes no pages');
  assert.strictEqual(Object.keys(stores().versions.rows).length, 0, 'verify writes no versions');
  assert.strictEqual(Object.keys(stores().receipts.rows).length, 0, 'verify writes no receipts');

  var adopted = await LatticeExport.importArchive(fresh, { strategy: 'adopt' });
  assert.strictEqual(adopted.ok, true, 'adopt ok');
  assert.strictEqual(adopted.workspace.line, LINE, 'adopt shows the line');
  assert.strictEqual(adopted.workspace.privateNote, PRIVATE_NOTE, 'private pages never arrive');
  assert.ok(adopted.changes.indexOf(PRIVATE_NOTE) !== -1, 'adopt says they stayed');
  assert.ok(adopted.workspace.added.pages >= 2, 'adopt adds the shared pages');
  var versionRows = stores().versions.rows;
  var versionList = Object.keys(versionRows).map(function (k) { return versionRows[k]; });
  for (var i = 0; i < versionList.length; i++) {
    var ver = versionList[i];
    var again = await ws.hashVersion({ parent: ver.parent, ts: ver.ts, author: ver.author, text: ver.text, meta: ver.meta });
    assert.strictEqual(again, ver.hash, 'adopted hash verifies');
  }
  assert.strictEqual(await ws.verifyReceipt(second.hash), 'verified', 'shared receipt verifies');
  assert.strictEqual(await ws.verifyReceipt(privHead), 'does not match', 'private body is not on this device');
  var titles = (await ws.list()).map(function (p) { return p.title; });
  assert.ok(titles.indexOf(SHARED_TITLE) !== -1, 'shared page arrived');
  assert.ok(titles.indexOf(PRIV_TITLE) === -1, 'private page did not arrive');
  assert.ok(titles.indexOf(MIND_TITLE) === -1, 'mind-private page did not arrive');
  assert.strictEqual(global.localStorage.getItem(asideKey), '1', 'set-aside is restored');
  var storedShared = (await ws.list()).filter(function (p) { return p.id === shared.page.id; })[0];
  assert.strictEqual(storedShared.title, SHARED_TITLE, 'adopted title');

  var merged = await LatticeExport.importArchive(fresh, { strategy: 'merge' });
  assert.strictEqual(merged.ok, true, 'merge ok');
  assert.ok(merged.changes.some(function (line) { return line.indexOf('longer chain wins') === 0; }), 'ledger merge unchanged');
  assert.strictEqual(merged.workspace.added.pages, 0, 'merge adds no pages the second time');
  assert.strictEqual(merged.workspace.added.versions, 0, 'merge adds no versions the second time');
  assert.strictEqual(merged.workspace.added.receipts, 0, 'merge adds no receipts the second time');
  assert.strictEqual(merged.workspace.added.skippedPages > 0, true, 'same hash skips');

  var mutated = JSON.parse(JSON.stringify(saved));
  var victim = pageByTitle(mutated, SHARED_TITLE);
  victim.page.title = 'Changed title that must not land';
  var nyxFp = marketRow.shelf.mindFp;
  global.localStorage.setItem('fl_ws_aside_' + nyxFp, '1');
  var secondMerge = await ws.importSection(mutated, 'merge');
  assert.strictEqual(secondMerge.added.pages, 0, 'mutated merge adds nothing');
  var still = (await ws.list()).filter(function (p) { return p.id === shared.page.id; })[0];
  assert.strictEqual(still.title, SHARED_TITLE, 'merge does not overwrite a title');
  assert.strictEqual(stores().versions.rows[second.hash].text, SHARED_BODY, 'merge does not overwrite version text');
  assert.strictEqual(global.localStorage.getItem('fl_ws_aside_' + nyxFp), '1', 'merge does not clear set-aside');

  wipe();
  await ws.accept();
  await ws.setMind('room-model', 'Lumen');
  var firstMerge = await ws.importSection(JSON.parse(JSON.stringify(saved)), 'merge');
  assert.ok(firstMerge.added.pages >= 2, 'merge into an empty notebook adds pages');
  var third = await ws.importSection(JSON.parse(JSON.stringify(saved)), 'merge');
  assert.strictEqual(third.added.pages, 0, 'a second merge is a no-op');
  assert.strictEqual(third.added.versions, 0, 'a second merge adds no versions');
  assert.strictEqual(third.added.receipts, 0, 'a second merge adds no receipts');

  wipe();
  await ws.accept();
  var branched = JSON.parse(JSON.stringify(saved));
  var shelf = pageByTitle(branched, SHARED_TITLE).shelf;
  var child = (shelf.versions || []).filter(function (ver) { return ver && ver.parent; })[0];
  assert.ok(child, 'a child version exists');
  var parentHash = child.parent;
  shelf.versions = shelf.versions.filter(function (ver) { return ver.hash !== parentHash; });
  shelf.receipts = [];
  var branchReport = await ws.importSection(branched, 'merge');
  assert.strictEqual(branchReport.ok, true, 'missing parent still merges');
  assert.ok(branchReport.added.branched >= 1, 'missing parent becomes a branch');
  var storedChild = stores().versions.rows[child.hash];
  assert.ok(storedChild, 'child version arrived');
  assert.strictEqual(storedChild.branchOf, null, 'branchOf is null');
  assert.strictEqual(storedChild.note, BRANCH_NOTE, 'branch note');
  assert.strictEqual(storedChild.parent, parentHash, 'parent hash stays so the version still verifies');
  var childHash = await ws.hashVersion({
    parent: storedChild.parent, ts: storedChild.ts, author: storedChild.author, text: storedChild.text, meta: storedChild.meta
  });
  assert.strictEqual(childHash, storedChild.hash, 'branched version still verifies');
  assert.strictEqual(first.hash, parentHash, 'the dropped version was the parent');

  fs.unlinkSync(outPath);
  console.log('SMOKE_OK workspace export v0.1');
})().catch(function (err) {
  console.error(err);
  process.exit(1);
});
