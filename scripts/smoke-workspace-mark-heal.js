// smoke-workspace-mark-heal.js (MIT) v-workspace-mark-heal-v0.1
// Node only. Near-miss marks store. The everyday chat path carries the paragraph.
var fs = require('fs');
var path = require('path');
var assert = require('assert');

var rootDir = path.join(__dirname, '..');
var indexHtml = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
var appHtml = fs.readFileSync(path.join(rootDir, 'docs/app.html'), 'utf8');
assert.strictEqual(indexHtml, appHtml, 'index.html matches docs/app.html');

var wsSrc = fs.readFileSync(path.join(rootDir, 'docs/modules/mind-workspace.js'), 'utf8');
var claySrc = fs.readFileSync(path.join(rootDir, 'docs/modules/particle-clay.js'), 'utf8');
assert.ok(wsSrc.indexOf('v-workspace-mark-heal-v0.1') !== -1, 'notebook marker');
assert.ok(claySrc.indexOf('v-workspace-mark-heal-v0.1') !== -1, 'clay marker');
assert.ok(wsSrc.indexOf('\u2014') === -1 && claySrc.indexOf('\u2014') === -1, 'no em dash');
assert.ok(wsSrc.indexOf('inner' + 'HTML') === -1 && claySrc.indexOf('inner' + 'HTML') === -1, 'text only');
assert.ok(wsSrc.indexOf('conf' + 'irm(') === -1 && claySrc.indexOf('conf' + 'irm(') === -1, 'no confirm');
assert.ok(wsSrc.indexOf('ev' + 'al(') === -1 && claySrc.indexOf('ev' + 'al(') === -1, 'no eval');
assert.ok(wsSrc.indexOf('new F' + 'unction') === -1 && claySrc.indexOf('new F' + 'unction') === -1, 'no Function');

var smartAt = indexHtml.indexOf('function buildSmartMessages');
var smartBody = indexHtml.slice(smartAt, indexHtml.indexOf('function loadContextSettings'));
var smartCalls = smartBody.split('flMindPromptTails()').length - 1;
assert.strictEqual(smartCalls, 3, 'surface, minimal, and smart each call the shared tail');
var buildAt = indexHtml.indexOf('function buildMessages');
var buildBody = indexHtml.slice(buildAt, smartAt);
assert.strictEqual(buildBody.split('flMindPromptTails()').length - 1, 1, 'full mode calls the shared tail once');
assert.ok(indexHtml.indexOf('function flMindPromptTails()') !== -1, 'one helper');
assert.ok(smartBody.indexOf('rtState') === -1, 'the smart path is not the Round Table');

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
  return {
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
    querySelector: function () { return null; },
    querySelectorAll: function () { return []; }
  };
}
global.window = global;
global.localStorage = memStore();
global.sessionStorage = memStore();
global.document = makeDoc();
global.indexedDB = makeIDB();
var ws = require(path.join(rootDir, 'docs/modules/mind-workspace.js'));
var clay = require(path.join(rootDir, 'docs/modules/particle-clay.js'));
global.FLWorkspace = ws;
global.FLClay = clay;

var now = 2000000;
ws.bindClock(function () { return now; });
function tick() { return new Promise(function (resolve) { setImmediate(resolve); }); }
async function drain() {
  await ws.settled();
  for (var i = 0; i < 12; i++) await tick();
  await ws.settled();
}
function titled(pages, title) {
  return pages.some(function (p) { return p && p.title === title; });
}

var EXAMPLE = '[FL_WS: {"op":"write","title":"Today","text":"A note for my future self."}]';
var CLAY_EXAMPLE = '[FL_CLAY: {"form":"heart","mood":"warmth","energy":0.4}]';

(async function () {
  var tailSrc = indexHtml.match(/function flMindPromptTails\(\) \{[\s\S]*?\n\}/);
  assert.ok(tailSrc, 'helper source');
  eval(tailSrc[0]);

  await ws.setMind('small-mind', 'Ada');
  await ws.accept();

  var shapes = [
    ['[FL WS: {"op":"write","title":"Space","text":"from a space"}]', 'Space'],
    ['[FL-WS: {"op":"write","title":"Hyphen","text":"from a hyphen"}]', 'Hyphen'],
    ['[fl_ws: {"op":"write","title":"Lower","text":"from lower"}]', 'Lower'],
    ['[FL_WS : {"op":"write","title":"Colon","text":"space before the colon"}]', 'Colon']
  ];
  for (var s = 0; s < shapes.length; s++) {
    now += 10;
    ws.resetRate();
    var seen = ws.consumeReply('Hello ' + shapes[s][0] + ' there');
    await drain();
    assert.ok(seen.visible.indexOf('[FL') === -1, 'near-miss stripped ' + shapes[s][1]);
    assert.ok(seen.visible.indexOf('Hello') !== -1, 'words stay ' + shapes[s][1]);
    assert.ok(titled(await ws.list(), shapes[s][1]), 'stored ' + shapes[s][1]);
  }

  var beforeBare = (await ws.list()).length;
  var bare = ws.consumeReply('FL WS {"op":"write","title":"Bare","text":"no"}');
  await drain();
  assert.strictEqual(bare.visible.indexOf('FL WS') !== -1, true, 'a bare mark stays visible');
  assert.ok(!titled(await ws.list(), 'Bare'), 'a bare mark stores nothing');
  assert.strictEqual((await ws.list()).length, beforeBare, 'bare mark adds no page');

  var weird = ws.consumeReply('[FL_WSX: {"op":"write","title":"Weird","text":"no"}]');
  await drain();
  assert.ok(weird.visible.indexOf('[FL_WSX:') !== -1, 'a different prefix stays');
  assert.ok(!titled(await ws.list(), 'Weird'), 'a different prefix stores nothing');

  var bad = ws.consumeReply('Bad [FL WS: {not json}] end');
  await drain();
  assert.ok(bad.visible.indexOf('[FL') === -1, 'malformed near-miss is stripped');
  assert.ok(bad.visible.indexOf('Bad') !== -1 && bad.visible.indexOf('end') !== -1, 'words around a bad mark stay');
  assert.ok(!titled(await ws.list(), 'not'), 'malformed JSON stores nothing');

  now += 10;
  ws.resetRate();
  var priv = ws.consumeReply('[FL WS: {"op":"private","title":"Hidden","text":"no"}]');
  await drain();
  assert.ok(!titled(await ws.list(), 'Hidden'), 'a disallowed op stores nothing');
  assert.ok(priv.visible.indexOf('[FL') === -1, 'a disallowed op is stripped');

  now += 10;
  ws.resetRate();
  ws.consumeReply('[FL-WS: {"op":"write","title":"Kept","text":"plain","secret":"SECRETKEY99"}]');
  await drain();
  var kept = (await ws.list()).filter(function (p) { return p.title === 'Kept'; })[0];
  assert.ok(kept, 'a write with an extra key still stores the note');
  assert.ok(JSON.stringify(kept).indexOf('SECRETKEY99') === -1, 'a disallowed key is not stored');
  var keptText = await ws.history(kept.id);
  assert.ok(keptText.some(function (v) { return v.text === 'plain'; }), 'the allowed text is what was stored');
  assert.ok(!keptText.some(function (v) { return String(v.text).indexOf('SECRETKEY99') !== -1; }), 'the extra key never becomes text');

  now += 10;
  ws.resetRate();
  var hugeText = new Array(9000).join('A');
  var huge = ws.consumeReply('[FL WS: {"op":"write","title":"Huge","text":"' + hugeText + '"}]');
  await drain();
  assert.ok(huge.visible.indexOf('[FL') === -1 && huge.visible.indexOf('AAAA') === -1, 'an over-cap body is stripped');
  assert.ok(!titled(await ws.list(), 'Huge'), 'an over-cap body stores nothing');

  now += 10;
  ws.resetRate();
  var scripted = ws.consumeReply('See <script>alert(1)</script> [fl_ws: {"op":"write","title":"Script","text":"<script>alert(1)</script>"}] done');
  await drain();
  assert.ok(scripted.visible.indexOf('<script>alert(1)</script>') !== -1, 'script outside the mark stays text');
  assert.ok(scripted.visible.indexOf('[fl') === -1 && scripted.visible.indexOf('[FL') === -1, 'the mark itself leaves the bubble');
  var scriptPage = (await ws.list()).filter(function (p) { return p.title === 'Script'; })[0];
  assert.ok(scriptPage, 'the note stored');
  var scriptHist = await ws.history(scriptPage.id);
  assert.ok(scriptHist.some(function (v) { return v.text.indexOf('<script>') === 0; }), 'script inside the mark stays text');

  clay.setOn(true);
  var clayShapes = [
    '[FL CLAY: {"form":"star","mood":"joy","energy":0.4}]',
    '[FL-CLAY: {"form":"moon","mood":"gentle","energy":0.4}]',
    '[fl_clay: {"form":"seed","mood":"present","energy":0.4}]',
    '[FL_CLAY : {"form":"heart","mood":"warmth","energy":0.4}]'
  ];
  var forms = ['star', 'moon', 'seed', 'heart'];
  for (var c = 0; c < clayShapes.length; c++) {
    var parsed = clay.parseTag('Look ' + clayShapes[c] + ' please');
    assert.strictEqual(parsed.ok, true, 'clay shape parses ' + forms[c]);
    assert.strictEqual(parsed.value.form, forms[c], 'clay form ' + forms[c]);
    assert.ok(parsed.visible.indexOf('[FL') === -1 && parsed.visible.indexOf('[fl') === -1, 'clay mark stripped ' + forms[c]);
    var choice = clay.consumeReply('Look ' + clayShapes[c] + ' please');
    assert.strictEqual(choice.choice.form, forms[c], 'clay consume sets ' + forms[c]);
  }
  assert.strictEqual(clay.parseTag('FL CLAY {"form":"star"}').tag, false, 'bare clay words are not a mark');
  assert.strictEqual(clay.parseTag('[FL_CLAYX: {"form":"star"}]').tag, false, 'a different clay prefix is not a mark');
  var clayBad = clay.parseTag('No [FL CLAY: {not json}] here');
  assert.strictEqual(clayBad.ok, false, 'malformed clay stores nothing');
  assert.ok(clayBad.visible.indexOf('[FL') === -1, 'malformed clay is stripped');
  var clayKey = clay.parseTag('[FL-CLAY: {"form":"cat","evil":"SECRETKEY99"}]');
  assert.strictEqual(clayKey.value.form, 'cat', 'allowed clay form stays');
  assert.ok(!('evil' in clayKey.value), 'a disallowed clay key is refused');
  var clayCap = clay.parseTag('[FL CLAY: {"form":"tree","say":"' + new Array(2200).join('x') + '"}]');
  assert.strictEqual(clayCap.ok, false, 'an over-cap clay body is refused');
  var clayScript = clay.parseTag('Hi <script> [FL_CLAY : {"form":"spark","say":"<script>alert(1)</script>"}]');
  assert.ok(clayScript.visible.indexOf('<script>') !== -1, 'script stays text beside clay');
  assert.ok(clayScript.value && clayScript.value.say.indexOf('<script>') === 0, 'say keeps the script as text');

  assert.ok(ws.HOWTO.indexOf(EXAMPLE) === ws.HOWTO.length - EXAMPLE.length, 'the notebook paragraph ends with one example');
  assert.ok(clay.PROMPT.indexOf(CLAY_EXAMPLE) === clay.PROMPT.length - CLAY_EXAMPLE.length, 'the clay paragraph ends with one example');
  assert.ok(ws.wakeInfo().howToTokens < 90, 'how-to stays under 90 tokens');

  ws.decline();
  clay.setOn(false);
  var off = flMindPromptTails();
  assert.ok(off.indexOf('notebook') === -1 && off.indexOf(EXAMPLE) === -1, 'workspace off adds nothing');
  assert.ok(off.indexOf('Clay is light') === -1 && off.indexOf(CLAY_EXAMPLE) === -1, 'clay off adds nothing');

  await ws.accept();
  clay.setOn(false);
  await ws.refreshWake();
  var wsOn = flMindPromptTails();
  assert.ok(wsOn.indexOf(EXAMPLE) !== -1, 'the default path carries the notebook example when on');
  assert.ok(wsOn.indexOf('You can keep a notebook') !== -1, 'the default path carries the notebook paragraph');
  assert.ok(wsOn.indexOf(CLAY_EXAMPLE) === -1, 'clay stays out while clay is off');

  ws.decline();
  clay.setOn(true);
  var clayOn = flMindPromptTails();
  assert.ok(clayOn.indexOf(CLAY_EXAMPLE) !== -1, 'the default path carries the clay example when on');
  assert.ok(clayOn.indexOf('Clay is light') !== -1, 'the default path carries the clay paragraph');
  assert.ok(clayOn.indexOf(EXAMPLE) === -1, 'the notebook stays out while the notebook is off');
  clay.setOn(false);

  await ws.accept();
  now += 10;
  ws.resetRate();
  var pear = ws.consumeReply('[FL WS: {"op":"write","title":"Tomorrow","text":"A pear for the next morning."}]');
  await drain();
  assert.ok(titled(await ws.list(), 'Tomorrow'), 'the near-miss note stored');
  var woke = flMindPromptTails();
  assert.ok(woke.indexOf('A pear for the next morning.') !== -1, 'a new chat wakes with the note');
  assert.ok(woke.indexOf('Tomorrow:') !== -1, 'the wake line names the page');
  assert.ok(woke.indexOf(EXAMPLE) !== -1, 'the wake still ends the paragraph with the example');

  console.log('SMOKE_OK workspace mark heal v0.1');
})().catch(function (err) {
  console.error(err);
  process.exit(1);
});
