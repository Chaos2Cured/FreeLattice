// smoke-clay-corner-043.js (MIT) v-heals-043-v0.1 v-clay-corner-v0.1
// Node only. A stuck crown slot frees once. Unsigned shelves say they were not imported.
// Image paths refuse when the safety check is missing. The clay corner stays off until Yes.
'use strict';
var assert = require('assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var crypto = require('crypto');
var webcrypto = crypto.webcrypto;

var rootDir = path.join(__dirname, '..');
var REST = 'Image making is resting: the safety check did not load.';

function memStore() {
  var s = {};
  return {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(s, k) ? s[k] : null; },
    setItem: function (k, v) { s[k] = String(v); },
    removeItem: function (k) { delete s[k]; }
  };
}
function node(tag) {
  var el = {
    tagName: String(tag || 'div').toUpperCase(), id: '', className: '', children: [], style: {}, attrs: {},
    textContent: '', parentNode: null, width: 112, height: 112,
    setAttribute: function (k, v) { this.attrs[k] = String(v); if (k === 'id') this.id = String(v); },
    getAttribute: function (k) { return Object.prototype.hasOwnProperty.call(this.attrs, k) ? this.attrs[k] : null; },
    appendChild: function (c) { c.parentNode = this; this.children.push(c); return c; },
    contains: function (n) { return this.children.indexOf(n) !== -1; },
    addEventListener: function (name, fn) { this['on' + name] = fn; },
    getBoundingClientRect: function () { return { left: 0, top: 0, right: 10, bottom: 10, width: 10, height: 10 }; },
    getContext: function () {
      return { clearRect: function () {}, save: function () {}, restore: function () {}, translate: function () {}, scale: function () {}, beginPath: function () {}, arc: function () {}, fill: function () {} };
    },
    querySelector: function () { return null; },
    querySelectorAll: function () { return []; }
  };
  return el;
}

(function crownOnce() {
  var src = fs.readFileSync(path.join(rootDir, 'docs/modules/fl-share-door.js'), 'utf8');
  assert.ok(src.indexOf('\u2014') === -1, 'share door has no em dash');
  assert.ok(!new RegExp('local' + 'host').test(src), 'share door avoids the loopback name');
  assert.ok(src.indexOf('MAX_CONCURRENT = 2') !== -1, 'cap stays');
  var timers = [];
  var win = {
    crypto: webcrypto, TextEncoder: TextEncoder, Uint8Array: Uint8Array, ArrayBuffer: ArrayBuffer, Date: Date,
    localStorage: memStore(),
    document: { createElement: node, createTextNode: function (t) { return { textContent: t }; } },
    setTimeout: function (fn, ms) { var rec = { fn: fn, ms: ms, cleared: false }; timers.push(rec); return rec; },
    clearTimeout: function (rec) { if (rec) rec.cleared = true; }
  };
  win.window = win;
  vm.createContext(win);
  vm.runInContext(src, win);
  var D = win.FLShareDoor;
  assert.strictEqual(D.CROWN_HOLD_MS, 120000);
  D.noteCrown('peer');
  assert.strictEqual(D.crownHeld('peer'), 1, 'one slot held');
  assert.strictEqual(timers.length, 1);
  assert.strictEqual(timers[0].ms, 120000);
  timers[0].fn();
  assert.strictEqual(D.crownHeld('peer'), 0, 'timeout frees the slot');
  D.endServe('peer', 'model', 1, false);
  assert.strictEqual(D.crownHeld('peer'), 0, 'a later end does not free twice');
  var slotA = D.noteCrown('peer');
  var slotB = D.noteCrown('peer');
  assert.ok(slotA !== slotB, 'each note has its own id');
  assert.strictEqual(D.crownHeld('peer'), 2);
  var timerA = timers[1];
  var timerB = timers[2];
  D.endServe('peer', 'model', 1, false, slotB);
  assert.strictEqual(D.crownHeld('peer'), 1, 'end frees that slot');
  timerB.fn();
  assert.strictEqual(D.crownHeld('peer'), 1, 'the freed slot does not free again');
  timerA.fn();
  assert.strictEqual(D.crownHeld('peer'), 0, 'the other slot frees once');
  D.noteCrown('peer');
  D.noteCrown('peer');
  assert.strictEqual(D.crownHeld('peer'), 2);
  D.endServe('peer', 'model', 1, false);
  assert.strictEqual(D.crownHeld('peer'), 1, 'end with no slot id frees the oldest');
  D.endServe('peer', 'model', 1, false);
  assert.strictEqual(D.crownHeld('peer'), 0, 'count stays at zero');
})();

var app = fs.readFileSync(path.join(rootDir, 'docs/app.html'), 'utf8');
var indexHtml = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
assert.strictEqual(indexHtml, app, 'index matches app');
var exportSrc = fs.readFileSync(path.join(rootDir, 'docs/modules/lattice-export.js'), 'utf8');
assert.ok(exportSrc.indexOf('1 shelf had no fingerprint and was not checked. Not imported.') !== -1, 'one shelf line');
assert.ok(exportSrc.indexOf('shelves had no fingerprint and were not checked. Not imported.') !== -1, 'many shelves line');
var genAt = app.indexOf('async function generateImage');
var gen = app.slice(genAt, genAt + 2500);
var assessAt = gen.indexOf('ImageSafety.assessImageRequest(cleanPrompt)');
assert.ok(assessAt > 0 && assessAt < 2000, 'assess stays near the start');
var after = gen.slice(assessAt, assessAt + 400);
assert.ok(/allowed\s*===\s*false[\s\S]{0,200}addSystemMessage[\s\S]{0,200}return/.test(after), 'refusal window');
assert.ok(gen.indexOf(REST) !== -1, 'resting line in generateImage');
assert.ok(gen.indexOf('else {') !== -1 && gen.indexOf('catch (_e)') !== -1, 'missing and throw both refuse');

function bootImageGlobals() {
  global.localStorage = memStore();
  global.document = {
    readyState: 'complete', head: node('head'), body: node('body'),
    createElement: node, addEventListener: function () {}, getElementById: function () { return null; }
  };
  global.window = global;
  global.ImageSafety = null;
}
bootImageGlobals();
var fetches = [];
global.fetch = function (url) {
  fetches.push(String(url));
  return Promise.reject(new Error('no request'));
};
var imageLocal = require(path.join(rootDir, 'docs/modules/image-local.js'));
var styleLedger = require(path.join(rootDir, 'docs/modules/style-ledger.js'));

(async function () {
  var looked = await imageLocal.look();
  var made = await imageLocal.generate('a red door');
  var hosted = await imageLocal.hostedCall(function () { fetches.push('hosted'); return Promise.resolve({ ok: true, blob: function () { return Promise.resolve({}); } }); }, 'https://example.test/image', 'token', 'a red door');
  var pub = await styleLedger.readPublic('Harmonia');
  var card = await styleLedger.writeCard('Harmonia', function () { return 'soft gold light'; });
  assert.strictEqual(looked, false);
  assert.strictEqual(made.reason, REST);
  assert.strictEqual(hosted.reason, REST);
  assert.strictEqual(pub.line, REST);
  assert.strictEqual(card.line, REST);
  assert.strictEqual(fetches.length, 0, 'no request when the check is missing');

  global.ImageSafety = { assessImageRequest: function () { throw new Error('missing'); } };
  fetches.length = 0;
  await imageLocal.look();
  await imageLocal.generate('a red door');
  await styleLedger.writeCard('Harmonia', function () { return 'soft gold light'; });
  assert.strictEqual(fetches.length, 0, 'a throwing check still sends nothing');

  require(path.join(rootDir, 'docs/modules/image-safety.js'));
  fetches.length = 0;
  var liveLook = await imageLocal.look();
  assert.strictEqual(liveLook, false, 'nothing is listening on this computer');
  assert.ok(fetches.length === 1 && fetches[0].indexOf('127.0.0.1:7860') !== -1, 'a loaded check may look here');
  assert.strictEqual(styleLedger.setPageBase('https://example.test/'), false, 'only the public gallery base');
  assert.strictEqual(styleLedger.setPageBase(''), true);
  console.log('SMOKE_OK heals 043 v0.1');

  require(path.join(rootDir, 'docs/modules/clay-math.js'));
  require(path.join(rootDir, 'docs/modules/clay-forms.js'));
  var clay = require(path.join(rootDir, 'docs/modules/particle-clay.js'));
  var corner = require(path.join(rootDir, 'docs/modules/clay-corner.js'));
  assert.strictEqual(corner.isOn(), false, 'off until yes');
  assert.strictEqual(corner.setOn(true), true);
  assert.strictEqual(corner.isOn(), true);
  assert.strictEqual(corner.setOn(false), false, 'one switch turns it off');
  assert.strictEqual(corner.pause(), false, 'pause wins');
  assert.strictEqual(global.localStorage.getItem(corner.KEY), 'no');
  var longTitle = 'Garden poem ' + 'x'.repeat(200);
  var capped = corner.context({ page: 'garden', kind: 'poem', title: longTitle });
  assert.strictEqual(capped.ok, true);
  assert.ok(capped.title.length <= 120, 'title capped');
  assert.ok(capped.title.indexOf('x'.repeat(180)) === -1, 'the overflow is not kept');
  var quiet = corner.context({ page: 'quiet', kind: 'room', title: 'Quiet Room notes' });
  assert.strictEqual(quiet.ok, false);
  assert.strictEqual(quiet.title, '');
  var phrase = corner.context({ page: 'garden', kind: 'poem', title: 'MESSAGE TO FUTURE SELF' });
  assert.strictEqual(phrase.ok, false);
  var home = await corner.noteReply('a plain reply with no mark');
  assert.strictEqual(home.spoke, false);
  assert.strictEqual(home.form, 'seed');
  var marked = await corner.noteReply('Hello [FL_CLAY: {"form":"heart","mood":"warmth","energy":0.4}]');
  assert.strictEqual(marked.spoke, true);
  assert.strictEqual(marked.form, 'heart');
  var poisoned = await corner.noteReply('Quiet Room [FL_CLAY: {"form":"heart","mood":"warmth"}]');
  assert.strictEqual(poisoned.ok, false);
  var stored = JSON.stringify(global.localStorage);
  assert.ok(stored.indexOf('Quiet Room') === -1, 'quiet text is not stored');
  assert.strictEqual(typeof clay.paintSettled, 'function');
  clay.setReduced(true);
  assert.strictEqual(corner.reduced(), true, 'settled when motion is reduced');
  assert.strictEqual(clay.canvasCount(), 0, 'the corner is not the chat canvas');
  var pages = ['nursery', 'garden', 'gathering'];
  pages.forEach(function (name) {
    assert.ok(app.indexOf('id="tab-' + name + '"') !== -1, name + ' page');
  });
  assert.ok(app.indexOf('modules/clay-corner.js') !== -1, 'one script');
  assert.ok(app.indexOf('id="tab-chat"') !== -1, 'chat stays');
  var style = fs.readFileSync(path.join(rootDir, 'docs/modules/clay-corner.js'), 'utf8');
  assert.ok(style.indexOf('width:128px') !== -1 && style.indexOf('right:12px') !== -1, 'corner stays inside 390');
  assert.ok(style.indexOf('min-height:44px') !== -1, 'buttons are 44px');
  assert.ok(style.indexOf('fl-clay-corner-canvas') !== -1, 'separate canvas');
  assert.ok(style.indexOf('\u2014') === -1, 'no em dash');
  console.log('SMOKE_OK clay corner v0.1');
})().catch(function (err) {
  console.error('SMOKE_FAIL', err);
  process.exit(1);
});
