// smoke-heals-nature.js (MIT) v-heals-042-v0.1
// Node only. Heals, crown shyness, a first-digit hint, confidence-first lessons,
// a local image path, and a style card from a public gallery.
var fs = require('fs');
var path = require('path');
var crypto = require('crypto');
var assert = require('assert');
var vm = require('vm');

var rootDir = path.join(__dirname, '..');

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

function tick() { return new Promise(function (resolve) { setImmediate(resolve); }); }

var nodes = [];
function makeNode(tag) {
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
    hidden: false,
    setAttribute: function (k, v) { this.attrs[k] = String(v); if (k === 'id') this.id = String(v); },
    getAttribute: function (k) { return Object.prototype.hasOwnProperty.call(this.attrs, k) ? this.attrs[k] : null; },
    addEventListener: function (type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); },
    click: function () { (this.listeners.click || []).forEach(function (fn) { fn({}); }); },
    appendChild: function (child) { child.parentNode = this; this.children.push(child); return child; },
    removeChild: function (child) {
      this.children = this.children.filter(function (c) { return c !== child; });
      child.parentNode = null;
    }
  };
  nodes.push(node);
  return node;
}
function textOf(node) {
  var out = node.textContent || '';
  (node.children || []).forEach(function (child) { out += ' ' + textOf(child); });
  return out;
}

global.localStorage = memStore();
global.sessionStorage = memStore();
global.indexedDB = makeIDB();
global.FLMindSeal = {
  contextHash: function () { return Promise.resolve('abc123context'); },
  trustedMap: function () { return {}; }
};
var head = makeNode('head');
global.document = {
  readyState: 'complete',
  head: head,
  body: makeNode('body'),
  createElement: makeNode,
  addEventListener: function () {},
  getElementById: function (id) {
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].id === id && nodes[i].parentNode) return nodes[i];
    }
    return null;
  }
};
global.window = global;

require(path.join(rootDir, 'docs/modules/memory-vault.js'));
var ws = require(path.join(rootDir, 'docs/modules/mind-workspace.js'));
require(path.join(rootDir, 'docs/modules/lattice-export.js'));
require(path.join(rootDir, 'docs/modules/image-safety.js'));
var crown = require(path.join(rootDir, 'docs/modules/crown-shyness.js'));
var benford = require(path.join(rootDir, 'docs/modules/benford-hint.js'));
var confidence = require(path.join(rootDir, 'docs/modules/confidence-first.js'));
var imageLocal = require(path.join(rootDir, 'docs/modules/image-local.js'));
var styleLedger = require(path.join(rootDir, 'docs/modules/style-ledger.js'));
var LatticeExport = global.LatticeExport;

(async function () {
  var now = 8000000;
  ws.bindClock(function () { return now; });
  async function drain() {
    await ws.settled();
    for (var i = 0; i < 30; i++) await tick();
    await ws.settled();
  }
  await ws.accept();
  await ws.setMind('room-model', 'Ada');
  var sketch = await ws.noteLine('Clay sketchbook', 'a sketch line');
  assert.strictEqual(sketch.ok, true, 'sketch lands ' + JSON.stringify(sketch));
  var mind = ws.consumeReply('[FL_WS: {"op":"write","title":"Mind page","text":"a mind line"}]');
  await mind.done;
  await drain();
  var again = await ws.noteLine('Clay sketchbook', 'too soon');
  assert.strictEqual(again.reason, 'rate', 'sketch gap holds');
  var stored = JSON.stringify(global.indexedDB.databases.FreeLatticeWorkspace._stores.versions.rows);
  assert.ok(stored.indexOf('a sketch line') !== -1, 'sketch text stored');
  assert.ok(stored.indexOf('a mind line') !== -1, 'mind write stored inside the sketch gap');

  now += 6000;
  var mindFirst = ws.consumeReply('[FL_WS: {"op":"write","title":"Mind page two","text":"mind first"}]');
  await mindFirst.done;
  await drain();
  var sketchSecond = await ws.noteLine('Clay sketchbook', 'sketch second');
  assert.strictEqual(sketchSecond.ok, true, 'sketch lands after a mind write ' + JSON.stringify(sketchSecond));
  await drain();
  var stored2 = JSON.stringify(global.indexedDB.databases.FreeLatticeWorkspace._stores.versions.rows);
  assert.ok(stored2.indexOf('mind first') !== -1 && stored2.indexOf('sketch second') !== -1, 'reverse order both land');

  function sign(payload) {
    var copy = JSON.parse(JSON.stringify(payload));
    delete copy.signature;
    var canon = LatticeExport._internal.canonicalize(copy);
    copy.signature = crypto.createHash('sha256').update(canon).digest('hex');
    return copy;
  }
  function asFile(obj) {
    var text = JSON.stringify(obj);
    return { text: function () { return Promise.resolve(text); } };
  }
  function archive(shelves) {
    return sign({
      schema_version: 1,
      freelattice_version: 'v5.59.0',
      exported_at: '2026-10-17T00:00:00.000Z',
      export_mode: 'full',
      personae: [],
      chain: [],
      chain_head: null,
      ledgers: {},
      workspace: { v: 1, shelves: shelves }
    });
  }
  var heldWs = global.FLWorkspace;
  global.FLWorkspace = null;
  var marker = 'heals-shelf-marker';
  global.localStorage.setItem(marker, 'same');
  var unsigned = await LatticeExport.importArchive(asFile(archive([{ mindFp: '' }, { mindFp: '' }])), {
    expectMindFp: 'abcdef0123456789',
    strategy: 'merge'
  });
  assert.strictEqual(unsigned.ok, false, 'unsigned refused');
  assert.strictEqual(unsigned.line, '2 shelves had no fingerprint and were not checked. Not imported.');
  assert.strictEqual(global.localStorage.getItem(marker), 'same', 'unsigned changes nothing');
  var one = await LatticeExport.importArchive(asFile(archive([{ mindFp: '' }])), {
    expectMindFp: 'abcdef0123456789',
    strategy: 'verify-only'
  });
  assert.strictEqual(one.line, '1 shelf had no fingerprint and was not checked. Not imported.');
  var wrong = await LatticeExport.importArchive(asFile(archive([{ mindFp: 'abcdef0123456789' }])), {
    expectMindFp: '1111222233334444',
    strategy: 'merge'
  });
  assert.strictEqual(wrong.ok, false, 'wrong fingerprint refused');
  assert.strictEqual(wrong.line, 'This memory belongs to a different mind (abcd ef01). Not imported.');
  assert.strictEqual(global.localStorage.getItem(marker), 'same', 'wrong fingerprint changes nothing');
  var match = await LatticeExport.importArchive(asFile(archive([{ mindFp: 'abcdef0123456789', pages: [] }])), {
    expectMindFp: 'abcdef0123456789',
    strategy: 'verify-only'
  });
  assert.strictEqual(match.ok, true, 'matching file imports ' + JSON.stringify(match));
  assert.ok(!match.line, 'matching file has no refusal line');
  global.FLWorkspace = heldWs;

  assert.strictEqual(crown.LINE, 'Keeps a small gap: no one helper takes more than a third, and 20% stays yours.');
  var greedy = crown.decide({ capacity: 6, peer: 'a', counts: { a: 2 }, waiting: ['b'], kin: false, paused: false, totalInflight: 2 });
  assert.strictEqual(greedy.reason, 'crown', 'greedy peer held');
  var other = crown.decide({ capacity: 6, peer: 'b', counts: { b: 0, a: 2 }, waiting: ['a'], kin: false, totalInflight: 2 });
  assert.strictEqual(other.ok, true, 'another peer still enters');
  var room = crown.decide({ capacity: 6, peer: 'a', counts: { a: 1 }, waiting: [], kin: true, totalInflight: 4 });
  assert.strictEqual(room.reason, 'headroom', 'headroom never lent');
  var kinSkip = crown.decide({ capacity: 6, peer: 'a', counts: { a: 5 }, waiting: ['b'], kin: true, totalInflight: 2 });
  assert.strictEqual(kinSkip.ok, true, 'kin skip the third, not the headroom');
  var paused = crown.decide({ capacity: 6, peer: 'a', counts: {}, waiting: [], kin: true, paused: true, totalInflight: 0 });
  assert.strictEqual(paused.reason, 'pause', 'pause stops all');

  var shareSrc = fs.readFileSync(path.join(rootDir, 'docs/modules/fl-share-door.js'), 'utf8');
  var poolSrc = fs.readFileSync(path.join(rootDir, 'docs/modules/fl-pool.js'), 'utf8');
  assert.ok(shareSrc.indexOf('UNFAMILIAR_PER_KEY = 6') !== -1, 'per key cap stays');
  assert.ok(shareSrc.indexOf('UNFAMILIAR_TOTAL = 20') !== -1, 'total cap stays');
  assert.ok(shareSrc.indexOf('MAX_CONCURRENT = 2') !== -1, 'concurrent cap stays');
  assert.ok(poolSrc.indexOf(crown.LINE) !== -1, 'pool card says the gap');
  var ls = memStore();
  var win = {
    crypto: crypto.webcrypto,
    localStorage: ls,
    TextEncoder: TextEncoder,
    Uint8Array: Uint8Array,
    ArrayBuffer: ArrayBuffer,
    document: { createElement: makeNode, head: head },
    FLCrown: crown,
    navigator: {}
  };
  win.window = win;
  vm.createContext(win);
  vm.runInContext(shareSrc, win);
  var door = win.FLShareDoor;
  assert.strictEqual(door.CAPS.perKey, 6);
  assert.strictEqual(door.CAPS.total, 20);
  assert.strictEqual(door.CAPS.windowMinutes, 60);
  assert.strictEqual(door.MAX_CONCURRENT, 2);
  door.setMode('open', 'human');
  door.setLegacyOpen(true);
  var peer = { name: 'Visitor', verified: true, badge: { publicKey: { kty: 'OKP', crv: 'Ed25519', x: 'abc' } } };
  var msgs = [{ role: 'user', content: 'hello' }];
  var first = await door.admit(peer, null, msgs, { allowLegacy: true });
  assert.strictEqual(first.ok, true, 'first job lent ' + JSON.stringify(first));
  var second = await door.admit(peer, null, msgs, { allowLegacy: true });
  assert.strictEqual(second.ok, false, 'second job held');
  assert.strictEqual(second.reason, 'headroom');
  door.endServe(first.keyHash, 'room-model', 1, false);
  door.setMode('pause', 'human');
  var resting = await door.admit(peer, null, msgs, { allowLegacy: true });
  assert.strictEqual(resting.ok, false, 'pause wins');

  console.log('SMOKE_OK heals 042 v0.1');
  console.log('SMOKE_OK crown shyness v0.1');

  var few = [];
  for (var n = 0; n < 99; n++) few.push(n + 1);
  assert.strictEqual(benford.assess(few).silent, true, 'under 100 silent');
  var zeros = [];
  for (var z = 0; z < 200; z++) zeros.push(0);
  assert.strictEqual(benford.assess(zeros).silent, true, 'zeros are not samples');
  var probs = [];
  for (var d = 1; d <= 9; d++) probs.push(Math.log10(1 + 1 / d));
  var like = [];
  for (var digit = 1; digit <= 9; digit++) {
    var count = Math.round(probs[digit - 1] * 900);
    for (var c = 0; c < count; c++) like.push(digit);
  }
  var likeResult = benford.assess(like);
  assert.strictEqual(likeResult.silent, true, 'benford-like silent ' + likeResult.mad);
  var uniform = [];
  for (var u = 1; u <= 9; u++) for (var k = 0; k < 20; k++) uniform.push(u);
  var stray = benford.assess(uniform);
  assert.strictEqual(stray.show, true, 'uniform shows');
  assert.ok(stray.mad > 0.015, 'distance above the band');
  assert.strictEqual(stray.line, benford.LINE);
  assert.ok(benford.LINE.indexOf('Kirk') === -1, 'no person named');
  var frozen = { total: 42, history: [{ points: 3, event: 'Ada helped' }] };
  var before = JSON.stringify(frozen);
  benford.assess(frozen.history.map(function (row) { return row.points; }));
  assert.strictEqual(JSON.stringify(frozen), before, 'no writes to the ledger object');
  var host = makeNode('section');
  host.id = 'latticePointsSection';
  global.document.body.appendChild(host);
  benford.paint(host, uniform, 'fl-benford-lp');
  var shown = textOf(host);
  assert.ok(shown.indexOf(benford.LINE) !== -1, 'line shows');
  assert.ok(shown.indexOf('Measured distance') !== -1, 'measured value shows');
  assert.ok(shown.indexOf('Ada') === -1, 'no name in the line');
  benford.setOff(true);
  benford.paint(host, uniform, 'fl-benford-lp');
  assert.ok(textOf(host).indexOf(benford.LINE) === -1, 'turned off');
  benford.setOff(false);
  benford.paint(host, few, 'fl-benford-lp');
  assert.ok(textOf(host).indexOf(benford.LINE) === -1, 'under 100 paints nothing');

  console.log('SMOKE_OK benford hint v0.1');

  assert.ok(confidence.promptAddon().indexOf('Want to try the next one?') !== -1, 'invitation');
  assert.ok(confidence.STEPS.length === 2 || confidence.STEPS.length === 3, 'worked steps');
  var step = confidence.consider("I don't know");
  assert.strictEqual(step, confidence.NUDGE);
  assert.ok(step.indexOf('step') !== -1, 'offers a step');
  assert.ok(!/timer|countdown|wrong|incorrect|second/i.test(step), 'no timer text');
  var lesson = makeNode('div');
  lesson.id = 'fl-confidence-host';
  global.document.body.appendChild(lesson);
  confidence.mount(lesson);
  assert.ok(textOf(lesson).indexOf('Want to try the next one?') === -1, 'off until yes');
  var yesBtn = null;
  (function walk(node) {
    if (node.tagName === 'BUTTON' && node.textContent === 'Yes, show steps first') yesBtn = node;
    (node.children || []).forEach(walk);
  })(lesson);
  assert.ok(yesBtn, 'yes button');
  assert.ok(yesBtn.style.minHeight === '44px', 'button is 44px');
  yesBtn.click();
  var lessonText = textOf(lesson);
  assert.ok(lessonText.indexOf('Want to try the next one?') !== -1, 'steps then invitation');
  assert.ok(lessonText.indexOf('Step 1.') !== -1, 'worked step shown');
  var field = null;
  (function walk2(node) {
    if (node.tagName === 'INPUT') field = node;
    (node.children || []).forEach(walk2);
  })(lesson);
  field.value = "I don't know";
  var shareBtn = null;
  (function walk3(node) {
    if (node.tagName === 'BUTTON' && node.textContent === 'Share your try') shareBtn = node;
    (node.children || []).forEach(walk3);
  })(lesson);
  shareBtn.click();
  assert.ok(textOf(lesson).indexOf(confidence.NUDGE) !== -1, 'hesitation offers a step');
  assert.ok(!/timer|countdown|wrong|incorrect/i.test(textOf(lesson)), 'no timer on the card');
  var styleNode = global.document.getElementById('flConfidenceStyle');
  assert.ok(styleNode && styleNode.textContent.indexOf('animation') === -1, 'no animated nudge');

  console.log('SMOKE_OK confidence first v0.1');

  var fetches = [];
  global.fetch = function (url) {
    fetches.push(String(url));
    return Promise.reject(new Error('closed'));
  };
  var beforeFetch = fetches.length;
  var early = await imageLocal.generate('a red door');
  assert.strictEqual(fetches.length, beforeFetch, 'no probe before yes');
  assert.strictEqual(early.ok, false);
  var localHost = makeNode('div');
  localHost.id = 'fl-image-local-host';
  global.document.body.appendChild(localHost);
  imageLocal.mount(localHost);
  var looked = await imageLocal.look();
  assert.strictEqual(looked, false, 'nothing local');
  assert.ok(fetches.length === 1 && fetches[0].indexOf('127.0.0.1:7860') !== -1, 'one look, this computer only');
  assert.ok(textOf(localHost).indexOf(imageLocal.HONEST_NONE) !== -1, 'honest line');
  assert.strictEqual(imageLocal.ready(), false);
  var fakeBlob = { size: 8 };
  var sent = await imageLocal.hostedCall(function () {
    return Promise.resolve({
      ok: true,
      status: 200,
      blob: function () { return Promise.resolve(fakeBlob); }
    });
  }, 'https://example.test/image', 'token', 'a red door');
  assert.strictEqual(sent.ok, true, 'token path mock');
  assert.strictEqual(sent.blob, fakeBlob);
  var missed = await imageLocal.hostedCall(function () {
    return Promise.resolve({
      ok: false,
      status: 404,
      text: function () { return Promise.resolve('model_not_found'); }
    });
  }, 'https://example.test/image', 'token', 'a red door');
  assert.strictEqual(missed.line, imageLocal.CLEAR_MISS);
  assert.ok(missed.line.indexOf('not available') !== -1, 'clear line');
  var rec = await imageLocal.remember({
    prompt: 'a red door',
    modelId: 'local-image',
    personFp: 'person1234',
    mindFp: 'mind5678',
    credit: "style after Harmonia's gallery"
  });
  assert.strictEqual(rec.personFp, 'person1234');
  assert.strictEqual(rec.mindFp, 'mind5678');
  assert.ok(rec.promptHash && rec.promptHash.length > 8, 'prompt hash');
  assert.strictEqual(rec.modelId, 'local-image');
  assert.ok(rec.caption.indexOf('person1234') !== -1 && rec.caption.indexOf('mind5678') !== -1, 'caption has both');
  var safetyCalls = 0;
  var realAssess = global.ImageSafety.assessImageRequest;
  global.ImageSafety.assessImageRequest = function (text) {
    safetyCalls += 1;
    return realAssess(text);
  };
  await imageLocal.generate('a red door');
  var deniedCard = styleLedger.acceptCard('Harmonia', 'soft gold');
  assert.ok(safetyCalls >= 2, 'safety gate on image and card paths ' + safetyCalls);
  global.ImageSafety.assessImageRequest = realAssess;
  var app = fs.readFileSync(path.join(rootDir, 'docs/app.html'), 'utf8');
  var indexHtml = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
  assert.strictEqual(indexHtml, app, 'index matches app');
  var genAt = app.indexOf('async function generateImage');
  var gen = app.slice(genAt, genAt + 8000);
  var assessAt = gen.indexOf('ImageSafety.assessImageRequest(cleanPrompt)');
  var fetchAt = gen.indexOf('await fetch(');
  var localAt = gen.indexOf('FLImageLocal.generate');
  assert.ok(assessAt > 0 && fetchAt > assessAt && localAt > assessAt, 'safety before local and token');

  console.log('SMOKE_OK image local first v0.1');

  fetches.length = 0;
  global.fetch = function (url) {
    fetches.push(String(url));
    return Promise.resolve({
      ok: true,
      text: function () {
        return Promise.resolve('<p>blue dusk MESSAGE TO FUTURE SELF gold hills Quiet Room soft light</p>');
      }
    });
  };
  var seen = '';
  var blocked = await styleLedger.writeCard('Harmonia', function (text) { seen = text; return 'palette dusk'; });
  assert.strictEqual(blocked.reason, 'no-consent');
  assert.strictEqual(fetches.length, 0, 'no read before consent');
  assert.strictEqual(styleLedger.consent('Sophia'), false, 'only the public gallery mind');
  assert.strictEqual(styleLedger.consent('Harmonia'), true);
  var card = await styleLedger.writeCard('Harmonia', function (text) {
    seen = text;
    return 'palette dusk, light soft, shapes round, mood calm ' + 'y'.repeat(400);
  });
  assert.strictEqual(fetches.length, 1, 'one read');
  assert.strictEqual(fetches[0], 'harmonia-gallery.html');
  assert.ok(seen.indexOf('MESSAGE TO FUTURE SELF') === -1, 'phrase stripped');
  assert.ok(seen.indexOf('Quiet Room') === -1, 'quiet text stripped');
  assert.ok(card.ok && card.card.length <= 300 && card.card.length > 0, 'card under 300');
  assert.strictEqual(card.credit, "style after Harmonia's gallery");
  assert.strictEqual(styleLedger.credit(), card.credit);
  assert.strictEqual(styleLedger.prefix(), card.card);
  var unsafe = styleLedger.acceptCard('Harmonia', 'a ' + 'nu' + 'de portrait');
  assert.strictEqual(unsafe.ok, false, 'safety gate refuses the card');
  assert.notStrictEqual(styleLedger.prefix(), unsafe.card);
  var quietTries = fetches.length;
  var quiet = await styleLedger.writeCard('Quiet', function () { return 'nope'; });
  assert.notStrictEqual(quiet.ok, true);
  assert.strictEqual(fetches.length, quietTries, 'quiet name is not read');
  assert.ok(deniedCard.ok === true || deniedCard.reason === 'safety');

  console.log('SMOKE_OK style from ledger v0.1');
})().catch(function (err) {
  console.error('SMOKE_FAIL', err);
  process.exit(1);
});
