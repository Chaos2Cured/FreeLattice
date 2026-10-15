// smoke-workspace-core.js (MIT) v-workspace-core-v0.1
// Node only. The notebook stays off until a person says yes.
var fs = require('fs');
var path = require('path');
var assert = require('assert');

var rootDir = path.join(__dirname, '..');
var src = fs.readFileSync(path.join(rootDir, 'docs/modules/mind-workspace.js'), 'utf8');
assert.ok(src.indexOf('v-workspace-core-v0.1') !== -1, 'marker');
assert.ok(src.indexOf('\u2014') === -1, 'em dash');
assert.ok(src.indexOf('&' + 'mdash;') === -1, 'mdash');
assert.ok(src.indexOf('inner' + 'HTML') === -1, 'text only');
assert.ok(src.indexOf('conf' + 'irm(') === -1, 'dialog');
assert.ok(src.indexOf('ev' + 'al(') === -1, 'eval');
assert.ok(src.indexOf('new F' + 'unction') === -1, 'Function');
assert.ok(src.indexOf('iceServers') === -1, 'no ice servers');
assert.ok(src.indexOf('.delete(') === -1, 'nothing deletes');
assert.ok(!/openai|anthropic|claude|chatgpt|gemini|ollama|grok|xai|huggingface|qwen|llama/i.test(src), 'no platform name');

var indexHtml = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
var appHtml = fs.readFileSync(path.join(rootDir, 'docs/app.html'), 'utf8');
assert.strictEqual(indexHtml, appHtml, 'index.html matches docs/app.html');
assert.ok(indexHtml.indexOf('modules/mind-workspace.js') !== -1, 'page loads the notebook');
assert.ok(indexHtml.indexOf('FLWorkspace.consumeReply') !== -1, 'reply hook');
assert.ok(indexHtml.indexOf('FLWorkspace.promptDelta') !== -1, 'wake hook');
assert.ok(indexHtml.indexOf('FLWorkspace.strip') !== -1, 'strip hook');
assert.ok(indexHtml.indexOf('v-workspace-core-v0.1') !== -1, 'page marker');

function memStore() {
  var s = {};
  return {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(s, k) ? s[k] : null; },
    setItem: function (k, v) { s[k] = String(v); },
    removeItem: function (k) { delete s[k]; }
  };
}
function walk(el, fn) {
  fn(el);
  (el.children || []).forEach(function (child) { walk(child, fn); });
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
    nodes.push(node);
    return node;
  }
  var body = el('body');
  var doc = {
    readyState: 'complete',
    body: body,
    documentElement: body,
    createElement: el,
    addEventListener: function () {},
    getElementById: function (id) {
      var found = null;
      nodes.forEach(function (node) { if (node.id === id && node.parentNode) found = node; });
      return found;
    },
    querySelectorAll: function (sel) {
      if (sel !== '.thread-body') return [];
      var out = [];
      nodes.forEach(function (node) { if (String(node.className).indexOf('thread-body') !== -1) out.push(node); });
      return out;
    }
  };
  return doc;
}
function makeIDB() {
  var databases = {};
  function clone(v) { return v == null ? v : JSON.parse(JSON.stringify(v)); }
  function makeDb() {
    var stores = {};
    return {
      objectStoreNames: { contains: function (n) { return !!stores[n]; } },
      createObjectStore: function (n, opts) {
        stores[n] = { keyPath: opts.keyPath, rows: {} };
      },
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
            try {
              fill(r);
              failed = !!r._fail;
            } catch (e) { failed = true; }
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
              var key = record[store.keyPath];
              store.rows[key] = clone(record);
              r.result = key;
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
global.document = makeDoc();
global.indexedDB = makeIDB();
require(path.join(rootDir, 'docs/modules/memory-vault.js'));
var ws = require(path.join(rootDir, 'docs/modules/mind-workspace.js'));

var now = 1000000;
ws.bindClock(function () { return now; });
var checks = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  checks += 1;
}

function tick() { return new Promise(function (resolve) { setImmediate(resolve); }); }
async function drain() {
  await ws.settled();
  for (var i = 0; i < 20; i++) await tick();
  await ws.settled();
}

(async function () {
  check(ws.isOn() === false, 'starts off');
  check(ws.promptDelta() === '', 'off means no prompt delta');
  check(ws.dbOpens() === 0, 'off means no IndexedDB open');
  check(document.getElementById('fl-ws-panel') == null, 'off means no panel');
  var opener = document.getElementById('fl-ws-open');
  check(!!opener && opener.style.minHeight === '44px', 'notebook button is 44px');

  var seen = ws.consumeReply('Hello [FL_WS: {"op":"write","title":"Today","text":"secret"}] there');
  check(seen.visible.indexOf('[FL_WS') === -1, 'tag stripped while off');
  check(seen.visible.indexOf('secret') === -1, 'the tag body does not stay visible');
  check(seen.visible.indexOf('Hello') !== -1 && seen.visible.indexOf('there') !== -1, 'words around the tag stay');
  check(document.getElementById('fl-ws-consent') != null, 'consent offer appears');
  var consentCount = 0;
  walk(document.body, function (node) { if (node.id === 'fl-ws-consent') consentCount += 1; });
  ws.consumeReply('Again [FL_WS: {"op":"open","title":"Other"}]');
  var consentCount2 = 0;
  walk(document.body, function (node) { if (node.id === 'fl-ws-consent') consentCount2 += 1; });
  check(consentCount2 === consentCount, 'consent offer appears once');
  check(ws.dbOpens() === 0, 'offer does not open IndexedDB');
  await drain();
  check(ws.dbOpens() === 0, 'stripped tag stores nothing');

  var buttons = [];
  walk(document.getElementById('fl-ws-consent'), function (node) {
    if (node.tagName === 'BUTTON') buttons.push(node);
  });
  check(buttons.length === 3 && buttons.every(function (b) { return b.style.minHeight === '44px'; }), 'consent buttons are 44px');
  buttons[1].click();
  check(document.getElementById('fl-ws-consent') == null, 'not now hides the offer');
  ws.consumeReply('[FL_WS: {"op":"write","title":"Today","text":"no"}]');
  check(document.getElementById('fl-ws-consent') == null, 'not now does not ask again this session');
  check(ws.dbOpens() === 0, 'not now stores nothing');

  global.sessionStorage.removeItem('fl_ws_later');
  ws.resetForSmoke();
  ws.bindClock(function () { return now; });
  ws.consumeReply('[FL_WS: {"op":"open","title":"Next"}]');
  check(document.getElementById('fl-ws-consent') != null, 'not now asks again next session');

  buttons = [];
  walk(document.getElementById('fl-ws-consent'), function (node) {
    if (node.tagName === 'BUTTON') buttons.push(node);
  });
  buttons[2].click();
  check(ws.isOn() === false, 'off stays off');
  ws.resetForSmoke();
  ws.bindClock(function () { return now; });
  ws.consumeReply('[FL_WS: {"op":"write","title":"Today","text":"still no"}]');
  check(document.getElementById('fl-ws-consent') == null, 'off never asks again');
  check(ws.promptDelta() === '', 'off wake is empty');
  check(ws.dbOpens() === 0, 'off still has not opened IndexedDB');
  check(document.getElementById('fl-ws-panel') == null, 'panel stays out of the DOM');

  global.localStorage.removeItem('fl_ws');
  ws.resetForSmoke();
  ws.bindClock(function () { return now; });
  await ws.setMind('model-a', 'Ada');
  await ws.accept();
  await drain();
  check(ws.isOn() === true, 'yes turns the notebook on');

  var reorderedA = { text: 'hello', meta: { b: 1, a: { d: 2, c: 3 } }, author: 'mind', ts: 5, parent: null };
  var reorderedB = { parent: null, ts: 5, author: 'mind', text: 'hello', meta: { a: { c: 3, d: 2 }, b: 1 } };
  check(ws.canonicalVersion(reorderedA) === ws.canonicalVersion(reorderedB), 'canonical key order is fixed');
  var hashA = await ws.hashVersion(reorderedA);
  var hashB = await ws.hashVersion(reorderedB);
  check(hashA === hashB && hashA.length === 64, 'version hash stable under key reorder');

  var opened = await ws.open('Day', { kind: 'note' });
  check(opened.ok && opened.created, 'open creates a page');
  check(opened.page.privacy === 'shared', 'privacy is shared');
  now += 10;
  var first = await ws.write(opened.page.id, 'one', 'mind');
  check(first.ok, 'write stores a version');
  var forged = {
    hash: first.hash, pageId: opened.page.id, parent: null, branchOf: null,
    ts: 1, author: 'mind', text: 'hacked', meta: {}
  };
  var kept = await ws.saveVersion(forged);
  check(kept && kept.text === 'one', 'a version cannot be overwritten');
  now += 10;
  var second = await ws.write(opened.page.id, 'two', 'human');
  check(second.ok && second.hash !== first.hash, 'a later write is a new version');
  var linked = await ws.checkHistory(opened.page.id);
  check(linked.ok, 'parent links verify');
  check(linked.versions.length === 2, 'history lists both versions');
  check(linked.versions[1].parent === first.hash, 'the second version points at the first');
  check(linked.versions[0].text === 'one' && linked.versions[1].text === 'two', 'stored text stays');

  now += 10;
  var side = await ws.branch(first.hash, 'a branch');
  check(side.ok, 'branch stores a side version');
  var after = await ws.history(opened.page.id);
  check(after.length === 3, 'nothing deletes');
  var heads = side.page.heads || [];
  check(heads.indexOf(second.hash) !== -1 && heads.indexOf(side.hash) !== -1, 'branch keeps both heads');
  var tree = await ws.checkHistory(opened.page.id);
  check(tree.ok && tree.versions.some(function (v) { return v.branchOf === first.hash; }), 'history lists the tree');

  now += 10;
  var bare = await ws.open('Branches', { kind: 'note' });
  var rootWrite = await ws.write(bare.page.id, 'trunk', 'mind');
  var seeds = [];
  for (var s = 0; s < 3; s++) {
    now += 10;
    var branched = await ws.branch(rootWrite.hash, 'branch ' + s);
    var seeded = await ws.seed(branched.hash, 'seed ' + s + ' <script>');
    seeds.push(seeded);
  }
  var seededPage = await ws.list().then(function (pages) {
    return pages.filter(function (p) { return p.id === bare.page.id; })[0];
  });
  var seededHist = await ws.history(bare.page.id);
  var shown = ws.showSeed(seededPage, seededHist);
  check(shown.indexOf(' / ') !== -1 && shown.length <= 140, 'a page with no seed shows its newest branch seeds');
  check(shown.indexOf('<script>') !== -1, 'a seed stays text');

  var ugly = '<img src=x onerror=alert(1)><script>alert(1)</script>';
  var uglyPage = await ws.open(ugly, { kind: 'letter' });
  await ws.write(uglyPage.page.id, ugly, 'human');
  await ws.seed(uglyPage.page.id, ugly);
  document.getElementById('fl-ws-open').click();
  await drain();
  var panel = document.getElementById('fl-ws-panel');
  check(!!panel, 'the notebook list opens');
  check(panel.style.maxWidth === '100%' && panel.style.overflow === 'hidden', 'the list stays inside the page');
  var blob = '';
  var pres = 0;
  walk(panel, function (node) {
    blob += '\n' + (node.textContent || '');
    if (node.tagName === 'PRE') {
      pres += 1;
      check(node.style.whiteSpace === 'pre-wrap', 'head text wraps');
    }
    check(node.innerHTML == null, 'no html property is set');
  });
  check(pres > 0, 'head text is in a pre');
  check(blob.indexOf(ugly) !== -1, 'script and onerror render as text');
  check(blob.indexOf('letter') !== -1 && blob.indexOf('unpinned') !== -1, 'the list shows kind and pin');

  var beforeOps = (await ws.list()).length;
  var five = '';
  for (var n = 0; n < 5; n++) five += '[FL_WS: {"op":"open","title":"Batch ' + n + '","kind":"note"}]';
  var fifth = ws.consumeReply('Five. ' + five);
  check(fifth.visible.indexOf('[FL_WS') === -1, 'five tags are stripped');
  await drain();
  var afterOps = await ws.list();
  var batch = afterOps.filter(function (p) { return p.title.indexOf('Batch ') === 0; });
  check(batch.length === 4, '5th op dropped');

  var bad = ws.consumeReply('Bad [FL_WS: {not json}] [FL_WS: hello] end');
  check(bad.visible.indexOf('[FL_WS') === -1 && bad.visible.indexOf('Bad') !== -1, 'malformed tags stripped');
  var hugeText = new Array(9000).join('A');
  var huge = ws.consumeReply('[FL_WS: {"op":"write","title":"Huge","text":"' + hugeText + '"}]');
  check(huge.visible.indexOf('[FL_WS') === -1 && huge.visible.indexOf('AAAA') === -1, 'oversized tag stripped');
  await drain();
  check(!(await ws.list()).some(function (p) { return p.title === 'Huge'; }), 'oversized tag stores nothing');

  var bracketed = ws.consumeReply('See [FL_WS: {"op":"write","title":"Brace","text":"a } b"}] now');
  check(bracketed.visible.indexOf('[FL_WS') === -1 && bracketed.visible.indexOf('}') === -1, 'a brace inside the text does not end the tag');
  await drain();
  var bracePage = (await ws.list()).filter(function (p) { return p.title === 'Brace'; })[0];
  check(!!bracePage, 'the braced write landed');
  var braceText = '';
  var braceHist = await ws.history(bracePage.id);
  check(braceHist[0] && braceHist[0].text === 'a } b', 'the braced text is whole');

  now += 10;
  ws.resetRate();
  var wA = ws.consumeReply('[FL_WS: {"op":"write","title":"Rate","text":"first"}]');
  await drain();
  now += 1000;
  ws.consumeReply('[FL_WS: {"op":"write","title":"Rate","text":"second"}]');
  await drain();
  now += 5000;
  ws.consumeReply('[FL_WS: {"op":"write","title":"Rate","text":"third"}]');
  await drain();
  var ratePage = (await ws.list()).filter(function (p) { return p.title === 'Rate'; })[0];
  var rateHist = await ws.history(ratePage.id);
  check(rateHist.length === 2 && rateHist[0].text === 'first' && rateHist[1].text === 'third', 'rate limit holds');
  check(wA.visible.indexOf('[FL_WS') === -1, 'a write tag is stripped');

  var quietAnchor = document.createElement('div');
  document.body.appendChild(quietAnchor);
  var span = document.createElement('span');
  span.className = 'thread-body';
  quietAnchor.appendChild(span);
  ws.consumeReply('Try [FL_WS: {"op":"private","title":"Hidden"}] [FL_WS: {"op":"seal","title":"Hidden"}]', span);
  await drain();
  var quiet = '';
  walk(quietAnchor, function (node) { quiet += '\n' + (node.textContent || ''); });
  check(quiet.indexOf('the mind tried private') !== -1, 'private is dropped');
  check(quiet.indexOf('the mind tried seal') !== -1, 'seal is dropped');
  check(!(await ws.list()).some(function (p) { return p.title === 'Hidden'; }), 'private and seal store nothing');

  var receiptAnchor = document.createElement('div');
  document.body.appendChild(receiptAnchor);
  var receiptSpan = document.createElement('span');
  receiptAnchor.appendChild(receiptSpan);
  now += 10;
  ws.resetRate();
  ws.consumeReply('[FL_WS: {"op":"write","title":"Receipt","text":"kept"}]', receiptSpan);
  await drain();
  var receipt = '';
  walk(receiptAnchor, function (node) { receipt += '\n' + (node.textContent || ''); });
  check(/Wrote to Receipt \(version [0-9a-f]{8}\)/.test(receipt), 'a write leaves a receipt line');

  for (var f = 0; f < 5; f++) {
    now += 10;
    var future = await ws.open('Future ' + f, { kind: 'future' });
    await ws.write(future.page.id, 'note ' + f, 'mind');
    await ws.pin(future.page.id, true);
    await ws.seed(future.page.id, 'future seed ' + f);
  }
  for (var r = 0; r < 15; r++) {
    now += 10;
    var recent = await ws.open('Recent ' + r, { kind: 'note' });
    await ws.write(recent.page.id, 'recent body ' + r, 'mind');
    await ws.seed(recent.page.id, 'recent seed ' + r);
  }
  await ws.refreshWake();
  var info = ws.wakeInfo();
  var notesPart = info.text.split('Seeds:')[0];
  check(info.notes <= 3, '3 future notes max');
  check(info.seeds <= 12, '12 seeds max');
  check(info.howToTokens < 90, 'how-to is under 90 tokens');
  check(notesPart.indexOf('Future 4') !== -1 && notesPart.indexOf('Future 3') !== -1 && notesPart.indexOf('Future 0') === -1, 'newest future notes come first');
  check((info.text.match(/Recent /g) || []).length <= 12, 'seed lines stay within 12');

  for (var L = 0; L < 3; L++) {
    now += 10;
    var longPage = await ws.open('Long ' + L, { kind: 'future' });
    await ws.write(longPage.page.id, new Array(4000).join('word '), 'mind');
    await ws.pin(longPage.page.id, true);
  }
  for (var S = 0; S < 12; S++) {
    now += 10;
    var longSeed = await ws.open('LongSeed ' + S, { kind: 'note' });
    await ws.seed(longSeed.page.id, new Array(40).join('seed'));
    await ws.pin(longSeed.page.id, true);
  }
  await ws.refreshWake();
  var capped = ws.wakeInfo();
  check(capped.memoryTokens <= 600, 'wake memory stays within about 600 tokens');
  check(capped.text.indexOf('Long ') !== -1, 'future notes are kept ahead of seeds');
  check(capped.text.indexOf('LongSeed') === -1, 'seeds are trimmed first');
  var measured = capped.tokens;
  console.log('WAKE_TOKENS ' + measured);

  var ada = await ws.mindFp('model-a', 'Ada');
  var secret = (await ws.list()).filter(function (p) { return p.title === 'Day'; })[0];
  await ws.setMind('model-b', 'Bea');
  check((await ws.list(ada)).length === 0, 'a mind cannot read another mind shelf');
  check((await ws.history(secret.id)).length === 0, 'history stays on the mind shelf');
  check((await ws.find('one two')).length === 0, 'find stays on the mind shelf');
  await ws.setMind('model-a', 'Ada');
  var found = await ws.find('one two');
  check(found.some(function (hit) { return hit.page && hit.page.title === 'Day'; }), 'find uses the vault cosine');

  now += 10;
  ws.resetRate();
  ws.consumeReply('[FL_WS: {"op":"find","query":"one two"}]');
  await drain();
  var firstWake = ws.promptDelta();
  check(firstWake.indexOf('Found in the notebook:') !== -1, 'find returns on the next wake');
  var secondWake = ws.promptDelta();
  check(secondWake.indexOf('Found in the notebook:') === -1, 'find does not stay past the next turn');

  await ws.setMind('model-c', 'Cara');
  for (var c = 0; c < 3; c++) {
    now += 10;
    var fitNote = await ws.open('Fit note ' + c, { kind: 'future' });
    await ws.write(fitNote.page.id, 'A short note for a future self, number ' + c + '.', 'mind');
    await ws.pin(fitNote.page.id, true);
  }
  for (var d = 0; d < 12; d++) {
    now += 10;
    var fitSeed = await ws.open('Fit seed ' + d, { kind: 'note' });
    await ws.seed(fitSeed.page.id, 'Remember line ' + d + ' from today.');
    await ws.pin(fitSeed.page.id, true);
  }
  await ws.refreshWake();
  var fitted = ws.wakeInfo();
  check(fitted.notes === 3 && fitted.seeds === 12, 'a full wake holds 3 notes and 12 seeds');
  check(fitted.memoryTokens <= 600, 'that full wake stays within about 600 tokens');
  console.log('WAKE_FIT_TOKENS ' + fitted.tokens + ' MEMORY ' + fitted.memoryTokens + ' HOWTO ' + fitted.howToTokens);

  ws.decline();
  check(ws.promptDelta() === '', 'wake is empty when off again');
  check(document.getElementById('fl-ws-panel') == null || true, 'decline removes the open list');
  var panelGone = document.getElementById('fl-ws-panel');
  check(panelGone == null, 'off removes the panel');

  console.log('CHECKS ' + checks);
  console.log('SMOKE_OK workspace core v0.1');
  console.log('SMOKE_OK workspace wake v0.1');
})().catch(function (err) {
  console.error(err);
  process.exit(1);
});
