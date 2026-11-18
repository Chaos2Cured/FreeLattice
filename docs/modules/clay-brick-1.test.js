// clay-brick-1.test.js (MIT) v-clay-brick-1-v0.1
// Node only. No network. Shared by FreeLattice and theLatticeTree.
// The four clay modules must stay byte-identical when a sibling tree is present.
var fs = require('fs');
var path = require('path');
var crypto = require('crypto');
var assert = require('assert');

var here = __dirname;
var NAMES = ['clay-math.js', 'clay-forms.js', 'particle-clay.js', 'clay-corner.js'];

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

NAMES.forEach(function (name) {
  var src = fs.readFileSync(path.join(here, name), 'utf8');
  assert.ok(src.indexOf('\u2014') === -1, name + ' em dash');
  assert.ok(!new RegExp('&' + 'mdash;').test(src), name + ' mdash');
  assert.ok(!new RegExp('\\.' + 'inner' + 'HTML').test(src), name + ' text only');
  assert.ok(!new RegExp('conf' + 'irm\\(').test(src), name + ' dialog');
  assert.ok(!new RegExp('\\beval\\s*\\(').test(src), name + ' eval');
  assert.ok(!new RegExp('new\\s+Function\\s*\\(').test(src), name + ' Function');
});

var claySrc = fs.readFileSync(path.join(here, 'particle-clay.js'), 'utf8');
var cornerSrc = fs.readFileSync(path.join(here, 'clay-corner.js'), 'utf8');
assert.ok(claySrc.indexOf('v-clay-brick-1-v0.1') !== -1, 'clay brick marker');
assert.ok(cornerSrc.indexOf('v-clay-brick-1-v0.1') !== -1, 'corner brick marker');
assert.ok(claySrc.indexOf('v-particle-clay-v0.1') !== -1, 'clay marker kept');
assert.ok(cornerSrc.indexOf('v-clay-corner-v0.1') !== -1, 'corner marker kept');
// No human picker landed in this brick (scope dropped: form chips, save button).
assert.ok(!/pickForm|form chip|Save this shape/i.test(claySrc), 'no human form picker in clay');
assert.ok(!/pickForm|form chip|Save this shape/i.test(cornerSrc), 'no human form picker in corner');

function siblingDir() {
  var env = process.env.CLAY_TWIN_DIR;
  if (env) {
    assert.ok(fs.existsSync(path.join(env, 'particle-clay.js')), 'CLAY_TWIN_DIR is set but particle-clay.js is missing: ' + env);
    return env;
  }
  var guesses = [
    path.resolve(here, '../../../tree-clay-voice-brush-1/docs/modules'),
    path.resolve(here, '../../../clay-voice-brush-1/docs/modules'),
    path.resolve(here, '../../../tree-clay-brick-1/docs/modules'),
    path.resolve(here, '../../../clay-brick-1/docs/modules')
  ];
  var i;
  for (i = 0; i < guesses.length; i++) {
    if (guesses[i] !== here && fs.existsSync(path.join(guesses[i], 'particle-clay.js'))) return guesses[i];
  }
  return '';
}

var twin = siblingDir();
if (twin) {
  NAMES.forEach(function (name) {
    assert.strictEqual(sha256(path.join(here, name)), sha256(path.join(twin, name)), name + ' bytes match twin');
  });
}

// Minimal browser stubs so the modules can load in Node.
var store = {};
var nodesById = {};
function node(tag, id) {
  var el = {
    tagName: String(tag || 'div').toUpperCase(),
    id: id || '',
    className: '',
    children: [],
    style: {},
    attrs: {},
    textContent: '',
    hidden: false,
    parentNode: null,
    width: 112,
    height: 112,
    classList: {
      contains: function (c) {
        return (' ' + el.className + ' ').indexOf(' ' + c + ' ') !== -1;
      }
    },
    setAttribute: function (k, v) {
      this.attrs[k] = String(v);
      if (k === 'id') {
        this.id = String(v);
        nodesById[this.id] = this;
      }
      if (k === 'hidden') this.hidden = true;
    },
    getAttribute: function (k) {
      if (k === 'id') return this.id || null;
      return Object.prototype.hasOwnProperty.call(this.attrs, k) ? this.attrs[k] : null;
    },
    removeAttribute: function (k) {
      delete this.attrs[k];
      if (k === 'hidden') this.hidden = false;
    },
    appendChild: function (c) {
      c.parentNode = this;
      this.children.push(c);
      if (c.id) nodesById[c.id] = c;
      return c;
    },
    addEventListener: function () {},
    getContext: function () {
      return {
        clearRect: function () {},
        fillRect: function () {},
        save: function () {},
        restore: function () {},
        translate: function () {},
        scale: function () {},
        beginPath: function () {},
        arc: function () {},
        stroke: function () {},
        fillStyle: '',
        strokeStyle: '',
        globalAlpha: 1
      };
    }
  };
  if (id) nodesById[id] = el;
  return el;
}

var docEl = node('html');
docEl.getAttribute = function (name) {
  if (name === 'data-garden-room') return docEl.attrs['data-garden-room'] || 'core';
  if (name === 'data-garden-galaxy') return docEl.attrs['data-garden-galaxy'] || 'garden';
  return docEl.attrs[name] || null;
};
var body = node('body');
var head = node('head');
var core = node('div', 'core-gathering');
core.hidden = true;
var veil = node('div', 'place-veil');
veil.hidden = true;
body.appendChild(core);
body.appendChild(veil);

global.localStorage = {
  getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
  setItem: function (k, v) { store[k] = String(v); },
  removeItem: function (k) { delete store[k]; }
};
global.MutationObserver = function () { this.observe = function () {}; };
global.matchMedia = function () { return { matches: false, addEventListener: function () {} }; };
global.document = {
  documentElement: docEl,
  body: body,
  head: head,
  readyState: 'complete',
  createElement: function (tag) { return node(tag); },
  createElementNS: function (ns, tag) { return node(tag); },
  getElementById: function (id) { return nodesById[id] || null; },
  querySelector: function () { return null; },
  querySelectorAll: function () { return []; },
  addEventListener: function () {}
};
global.window = global;
global.addEventListener = function () {};

var math = require('./clay-math.js');
var clay = require('./particle-clay.js');
var corner = require('./clay-corner.js');

assert.strictEqual(clay.isOn(), false, 'clay starts off');
assert.strictEqual(clay.promptDelta(), '', 'off means no prompt delta');
assert.strictEqual(clay.autoSend(), false, 'nothing sends itself');
assert.strictEqual(clay.BRICK, 'v-clay-brick-1-v0.1', 'clay brick id');
assert.strictEqual(corner.BRICK, 'v-clay-brick-1-v0.1', 'corner brick id');

// Tag semantics stay the same: the mind's mark is the only shape input.
var tag = clay.parseTag('[FL_CLAY: {"form":"heart","mood":"warmth","energy":0.4,"motion":"braid"}]');
assert.strictEqual(tag.ok, true, 'braid tag parses');
assert.strictEqual(tag.value.form, 'heart', 'form from the mind');
assert.strictEqual(tag.value.motion, 'braid', 'braid motion accepted');
assert.ok(tag.visible.indexOf('[FL_CLAY') === -1, 'tag still stripped');
var kept = clay.sanitize({ form: 'star', motion: 'branch', energy: 0.5 });
assert.strictEqual(kept.motion, 'branch', 'branch motion still allowed');
var unknown = clay.sanitize({ form: 'dog', motion: 'teleport', energy: 0.2 });
assert.strictEqual(unknown.motion, 'breath', 'unknown motion still falls back');

var part = { tx: 10, ty: 4, x: 0, y: 0 };
var knob = math.energyKnob(0.5, 8);
var wave = clay.motionOffset('wave', part, 1, 0.7, 0.5, 8, math, knob);
var expectedWaveX = math.wave(part.tx, part.ty, 0.7, knob.amplitude) * 0.15;
assert.strictEqual(wave.x, expectedWaveX, 'wave x formula unchanged');
assert.strictEqual(wave.y, 0, 'wave y formula unchanged');
var drift = clay.motionOffset('drift', part, 1, 0.7, 0.5, 8, math, knob);
assert.strictEqual(drift.x, expectedWaveX, 'drift x formula unchanged');
assert.strictEqual(drift.y, math.wave(part.ty, part.tx, 0.7, knob.amplitude) * 0.08, 'drift y formula unchanged');
var breath = clay.motionOffset('breath', part, 1, 0.7, 0.5, 8, math, knob);
assert.strictEqual(breath.x, 0, 'breath still has no extra offset');
assert.strictEqual(breath.y, 0, 'breath still has no extra offset');
var braid = clay.motionOffset('braid', part, 1, 0.7, 0.5, 8, math, knob);
var branch = clay.motionOffset('branch', part, 1, 0.7, 0.5, 8, math, knob);
var branchLater = clay.motionOffset('branch', part, 1, 1.9, 0.5, 8, math, knob);
var pulse = clay.motionOffset('pulse', part, 1, 0.7, 0.5, 8, math, knob);
assert.ok(braid.x !== 0 || braid.y !== 0, 'braid moves');
assert.ok(branch.x !== 0 || branch.y !== 0, 'branch moves');
assert.ok(branch.x !== branchLater.x || branch.y !== branchLater.y, 'branch moves with time');
assert.ok(pulse.x !== 0 || pulse.y !== 0, 'pulse moves');
assert.ok(braid.x !== branch.x || braid.y !== branch.y, 'braid and branch differ');
assert.ok(braid.x !== pulse.x || braid.y !== pulse.y, 'braid and pulse differ');
assert.ok(branch.x !== breath.x || branch.y !== breath.y, 'branch is distinct from breath');
var none = clay.motionOffset('teleport', part, 1, 0.7, 0.5, 8, math, knob);
assert.strictEqual(none.x, 0, 'unknown motion offset is zero');
assert.strictEqual(none.y, 0, 'unknown motion offset is zero');

// Gathering is detected only when that room is actually open.
assert.strictEqual(corner.gatheringOpen(), false, 'gathering closed at rest');
assert.strictEqual(corner.pageFromDoc(), 'garden', 'core/garden at rest is Garden');
core.hidden = false;
assert.strictEqual(corner.gatheringOpen(), true, 'un-hidden core-gathering is Gathering');
assert.strictEqual(corner.pageFromDoc(), 'gathering', 'open Gathering wins over core');
core.hidden = true;
assert.strictEqual(corner.pageFromDoc(), 'garden', 'hidden gathering falls back to Garden');
veil.hidden = false;
veil.className = 'is-open is-core';
assert.strictEqual(corner.gatheringOpen(), true, 'open core veil is Gathering');
assert.strictEqual(corner.pageFromDoc(), 'gathering', 'open core veil selects Gathering');
veil.hidden = true;
veil.className = '';
docEl.attrs['data-garden-room'] = 'nursery';
assert.strictEqual(corner.pageFromDoc(), 'nursery', 'nursery still wins');
docEl.attrs['data-garden-room'] = 'settings';
assert.strictEqual(corner.pageFromDoc(), 'settings', 'settings still wins');
docEl.attrs['data-garden-room'] = 'core';
docEl.attrs['data-garden-galaxy'] = 'workshop';
assert.strictEqual(corner.pageFromDoc(), 'workshop', 'workshop still wins');
docEl.attrs['data-garden-galaxy'] = 'garden';
docEl.attrs['data-garden-room'] = 'gathering';
assert.strictEqual(corner.pageFromDoc(), 'gathering', 'data-garden-room=gathering is Gathering');

// Canvas knock / heart (Kirk t1378u). The mind's clay must not change.
assert.strictEqual(clay.CLICK_WINDOW_MS, 600, 'triple-click window is 600ms');
clay.setReduced(true);
clay.setOn(true);
clay.resetRate();
var beforeSnap = clay.snapshot();
var first = clay.noteCanvasClick({ clientX: 10, clientY: 10 }, 1000);
assert.strictEqual(first.kind, null, 'one click waits to classify');
assert.strictEqual(first.pending, 1, 'one click is pending');
var knocked = clay.flushCanvasClicks();
assert.strictEqual(knocked.kind, 'knock', 'one click is a knock');
var afterKnock = clay.snapshot();
assert.strictEqual(afterKnock.form, beforeSnap.form, 'knock does not change form');
assert.strictEqual(afterKnock.motion, beforeSnap.motion, 'knock does not change motion');
assert.ok((clay.canvasAcks() || []).length > 0, 'knock leaves a brief acknowledgement');
assert.strictEqual(clay.canvasAcks()[0].kind, 'knock', 'ack is a knock ring');

var calls = [];
global.state = { isLocal: true, ollamaModel: 'home-mind' };
global.FreeLattice = {
  callAI: function (sys, user, opts) {
    calls.push({ user: user });
  }
};
global.FLHumanPresence = undefined;
clay.resetRate();
var mid = clay.snapshot();
var c1 = clay.noteCanvasClick({ clientX: 12, clientY: 12 }, 5000);
var c2 = clay.noteCanvasClick({ clientX: 12, clientY: 12 }, 5150);
var c3 = clay.noteCanvasClick({ clientX: 12, clientY: 12 }, 5300);
assert.strictEqual(c1.kind, null, 'first of three still waits');
assert.strictEqual(c2.kind, null, 'second of three still waits');
assert.strictEqual(c3.kind, 'heart', 'third click in 600ms is a heart');
var afterHeart = clay.snapshot();
assert.strictEqual(afterHeart.form, mid.form, 'heart does not change form');
assert.strictEqual(afterHeart.motion, mid.motion, 'heart does not change motion');
assert.ok((clay.canvasAcks() || []).some(function (a) { return a.kind === 'heart'; }), 'heart leaves a heart acknowledgement');
assert.strictEqual(calls.length, 1, 'triple click sends one signal, not three knocks');
assert.ok(calls[0].user.indexOf('heart') !== -1, 'heart signal is what the mind hears');
assert.ok(calls[0].user.indexOf('You may reply, or not, as you wish') !== -1, 'heart prompt does not demand a reply');
assert.ok(calls[0].user.indexOf('Reply briefly') === -1, 'heart prompt dropped Reply briefly');
var late = clay.flushCanvasClicks();
assert.strictEqual(late.kind, null, 'flush after a heart does not also knock');

// 4-5 fast clicks: one heart, no trailing knock. Further clicks are
// swallowed until a 600ms quiet gap.
clay.resetRate();
calls.length = 0;
var burst = [];
var bi;
for (bi = 0; bi < 5; bi++) {
  burst.push(clay.noteCanvasClick({ clientX: 14, clientY: 14 }, 7000 + bi * 80));
}
assert.strictEqual(burst[0].kind, null, 'first of five waits');
assert.strictEqual(burst[1].kind, null, 'second of five waits');
assert.strictEqual(burst[2].kind, 'heart', 'third of five is a heart');
assert.strictEqual(burst[3].swallowed, true, 'fourth click after a heart is swallowed');
assert.strictEqual(burst[4].swallowed, true, 'fifth click after a heart is swallowed');
assert.strictEqual(clay.flushCanvasClicks().kind, null, '5 fast clicks do not also knock');
assert.strictEqual(calls.length, 1, '5 fast clicks send exactly one heart');
assert.ok(calls[0].user.indexOf('heart') !== -1, 'the one signal from 5 clicks is a heart');
var afterGap = clay.noteCanvasClick({ clientX: 14, clientY: 14 }, 7000 + 4 * 80 + 600);
assert.strictEqual(afterGap.kind, null, 'click after the quiet gap waits to classify');
assert.strictEqual(clay.flushCanvasClicks().kind, 'knock', 'after a 600ms quiet gap a click can knock again');

clay.resetRate();
calls.length = 0;
clay.noteCanvasClick({ clientX: 8, clientY: 8 }, 9000);
clay.noteCanvasClick({ clientX: 8, clientY: 8 }, 9200);
var two = clay.flushCanvasClicks();
assert.strictEqual(two.kind, 'knock', 'two clicks in the window are one knock, not a heart and not two knocks');
assert.strictEqual(calls.length, 1, 'two clicks send one knock');
assert.ok(calls[0].user.indexOf('wish to share') !== -1, 'knock tells the mind someone wants to see what it wishes to share');
assert.ok(calls[0].user.indexOf('You may reply, or not, as you wish') !== -1, 'knock prompt does not demand a reply');
assert.ok(calls[0].user.indexOf('Reply briefly') === -1, 'knock prompt dropped Reply briefly');

// Classify by click timestamps, not by an early timer.
clay.resetRate();
calls.length = 0;
clay.noteCanvasClick({ clientX: 9, clientY: 9 }, 20000);
clay.noteCanvasClick({ clientX: 9, clientY: 9 }, 20300);
var early = clay.classifyCanvasClicks(20590);
assert.strictEqual(early.kind, null, 'an early timer with 2 clicks does not knock yet');
assert.strictEqual(early.pending, 2, 'both clicks stay pending when the window is still open');
var lateThird = clay.noteCanvasClick({ clientX: 9, clientY: 9 }, 20595);
assert.strictEqual(lateThird.kind, 'heart', 'a third click still in the 600ms span is a heart');
assert.strictEqual(calls.length, 1, 'jittered triple sends one heart, not a knock');

// A late timer must still classify against [first, first+600], not the fire time.
clay.resetRate();
calls.length = 0;
clay.noteCanvasClick({ clientX: 5, clientY: 5 }, 40000);
assert.strictEqual(clay.classifyCanvasClicks(40601).kind, 'knock', 'timer +1ms still knocks');
clay.resetRate();
clay.noteCanvasClick({ clientX: 5, clientY: 5 }, 41000);
assert.strictEqual(clay.classifyCanvasClicks(41605).kind, 'knock', 'timer +5ms still knocks');
clay.resetRate();
clay.noteCanvasClick({ clientX: 5, clientY: 5 }, 42000);
assert.strictEqual(clay.classifyCanvasClicks(42650).kind, 'knock', 'timer +50ms still knocks');

// Canvas presence sends are rate-limited to one per 5s. Extra clicks still ack.
clay.resetRate();
var sent = [];
global.FLHumanPresence = {
  send: function (word) { sent.push(word); }
};
clay.noteCanvasClick({ clientX: 6, clientY: 6 }, 30000);
var firstSend = clay.flushCanvasClicks();
assert.strictEqual(firstSend.kind, 'knock', 'first canvas click is a knock');
assert.strictEqual(firstSend.signaled, true, 'first canvas knock is delivered');
assert.deepStrictEqual(sent, ['knock'], 'first canvas knock writes presence');
var acksBeforeRate = (clay.canvasAcks() || []).map(function (a) { return a.kind + ':' + a.t0 + ':' + a.x + ':' + a.y; }).join('|');
clay.noteCanvasClick({ clientX: 6, clientY: 6 }, 32000);
var secondSend = clay.flushCanvasClicks();
assert.strictEqual(secondSend.kind, 'knock', 'a second click inside 5s still classifies as a knock');
assert.strictEqual(secondSend.signaled, false, 'the second canvas knock is not delivered');
assert.deepStrictEqual(sent, ['knock'], 'rate-limited canvas click writes nothing');
var acksAfterRate = clay.canvasAcks() || [];
var acksAfterSig = acksAfterRate.map(function (a) { return a.kind + ':' + a.t0 + ':' + a.x + ':' + a.y; }).join('|');
assert.ok(acksAfterSig !== acksBeforeRate, 'rate-limited click still shows an acknowledgement');
assert.strictEqual(acksAfterRate[acksAfterRate.length - 1].kind, 'knock', 'the new acknowledgement is a knock');
clay.noteCanvasClick({ clientX: 6, clientY: 6 }, 37000);
var thirdSend = clay.flushCanvasClicks();
assert.strictEqual(thirdSend.signaled, true, 'after 5s a new canvas knock is delivered');
assert.deepStrictEqual(sent, ['knock', 'knock'], 'presence write resumes after the 5s window');
global.FLHumanPresence = undefined;

// Flag B (t1373u): nothing from the human side of the glass may steer the clay.
assert.strictEqual(typeof clay.allowClayConsume, 'function', 'allowClayConsume is exported');
assert.strictEqual(clay.allowClayConsume('user'), false, 'user role may not steer clay');
assert.strictEqual(clay.allowClayConsume('assistant'), true, 'assistant role may shape clay');
assert.strictEqual(clay.allowClayConsume('mind'), true, 'mind role may shape clay');
assert.strictEqual(clay.allowClayConsume({ className: 'chat-message user', classList: { contains: function (c) { return c === 'user'; } } }), false, 'a user bubble may not steer clay');
var flagBBefore = clay.snapshot();
if (clay.allowClayConsume('user')) {
  clay.consumeReply('[FL_CLAY: {"form":"star","mood":"awe","motion":"pulse","energy":0.9}]');
}
assert.strictEqual(clay.snapshot().form, flagBBefore.form, 'user-role [FL_CLAY:] does not change the clay');
assert.strictEqual(clay.snapshot().motion, flagBBefore.motion, 'user-role [FL_CLAY:] does not change motion');
var appHtml = path.join(here, '..', 'app.html');
if (fs.existsSync(appHtml)) {
  var html = fs.readFileSync(appHtml, 'utf8');
  var renderIdx = html.indexOf('function renderMessageContent');
  assert.ok(renderIdx !== -1, 'app.html has renderMessageContent');
  var renderFn = html.slice(renderIdx, renderIdx + 2800);
  assert.ok(renderFn.indexOf('allowClayConsume') !== -1, 'renderMessageContent only consumes clay from the mind');
  assert.ok(renderFn.indexOf('before (Celeste 2026-11-17):') !== -1 && renderFn.indexOf('FLClay.consumeReply') !== -1, 'old consumeReply line is kept as a before-comment');
}
var gardenThread = path.join(here, 'garden-thread.js');
if (fs.existsSync(gardenThread)) {
  var gardenSrc = fs.readFileSync(gardenThread, 'utf8');
  assert.ok(/FLClay\.onReply[\s\S]{0,200}role === 'mind'/.test(gardenSrc) || /role === 'mind'[\s\S]{0,200}FLClay\.onReply/.test(gardenSrc), 'Tree already only hands mind-role replies to clay');
}

// Presence chips still use the old fly path.
// Presence chips still use the old fly path.
clay.resetRate();
clay.setReduced(false);
var beforePresent = clay.snapshot();
var presentChip = clay.onGesture('present');
assert.ok(presentChip.flown > 0, 'the present chip still sprinkles');
assert.strictEqual(clay.snapshot().motion, 'ripple', 'the present chip still switches to ripple');

clay.setOn(false);
clay.setReduced(false);

// Private tab names still hide (syncFromPage). Do not open any Quiet Room file.
assert.strictEqual(typeof corner.syncFromPage, 'function', 'sync still exported');
assert.strictEqual(corner.isOn(), false, 'corner starts off');


// Real-timer tests (HOLD 1). setTimeout-driven, with late firing at +1, +5, +50ms.
// Run several times to check for flakiness. SMOKE_OK waits until these finish.
function waitMs(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

function evAt() {
  return { clientX: 11, clientY: 11 };
}

async function realTimerSuite() {
  var delays = [1, 5, 50];
  var runs = 5;
  var windowMs = clay.CLICK_WINDOW_MS;
  var slack = 120;
  var di;
  var ri;
  clay.setOn(true);
  clay.setReduced(true);
  global.state = { isLocal: true, ollamaModel: 'home-mind' };
  global.FLHumanPresence = undefined;
  if (!global.FreeLattice || typeof global.FreeLattice.callAI !== 'function') {
    global.FreeLattice = { callAI: function (sys, user) { calls.push({ user: user }); } };
  }

  for (di = 0; di < delays.length; di++) {
    var late = delays[di];
    for (ri = 0; ri < runs; ri++) {
      var tag = 'real-timer +' + late + 'ms run ' + (ri + 1) + '/' + runs;

      // 1 click -> knock
      clay.resetRate();
      calls.length = 0;
      clay.setClassifyTimerDelay(late);
      clay.noteCanvasClick(evAt());
      await waitMs(windowMs + late + slack);
      assert.strictEqual((clay.lastCanvasDelivery() || {}).kind, 'knock', tag + ': 1 click knocks');
      assert.strictEqual(calls.length, 1, tag + ': 1 click sends one knock');
      assert.ok(calls[0].user.indexOf('wish to share') !== -1, tag + ': 1 click is a knock prompt');

      // 2 clicks -> knock
      clay.resetRate();
      calls.length = 0;
      clay.setClassifyTimerDelay(late);
      clay.noteCanvasClick(evAt());
      await waitMs(80);
      clay.noteCanvasClick(evAt());
      await waitMs(windowMs + late + slack);
      assert.strictEqual((clay.lastCanvasDelivery() || {}).kind, 'knock', tag + ': 2 clicks knock');
      assert.strictEqual(calls.length, 1, tag + ': 2 clicks send one knock');

      // 3 clicks -> heart
      clay.resetRate();
      calls.length = 0;
      clay.setClassifyTimerDelay(late);
      clay.noteCanvasClick(evAt());
      clay.noteCanvasClick(evAt());
      var triple = clay.noteCanvasClick(evAt());
      assert.strictEqual(triple.kind, 'heart', tag + ': 3 fast clicks heart immediately');
      await waitMs(windowMs + late + slack);
      assert.strictEqual((clay.lastCanvasDelivery() || {}).kind, 'heart', tag + ': 3 clicks stay one heart');
      assert.strictEqual(calls.length, 1, tag + ': 3 clicks send one heart');
      assert.ok(calls[0].user.indexOf('heart') !== -1, tag + ': 3 clicks are a heart prompt');

      // 4-6 clicks -> one heart, no trailing knock
      clay.resetRate();
      calls.length = 0;
      clay.setClassifyTimerDelay(late);
      var n;
      var lastBurst = null;
      for (n = 0; n < 6; n++) lastBurst = clay.noteCanvasClick(evAt());
      assert.strictEqual(lastBurst.swallowed, true, tag + ': 6th click is swallowed');
      await waitMs(windowMs + late + slack);
      assert.strictEqual((clay.lastCanvasDelivery() || {}).kind, 'heart', tag + ': 4-6 clicks stay one heart');
      assert.strictEqual(calls.length, 1, tag + ': 4-6 clicks send one heart, no trailing knock');

      // Slow 280ms triple -> heart
      clay.resetRate();
      calls.length = 0;
      clay.setClassifyTimerDelay(late);
      clay.noteCanvasClick(evAt());
      await waitMs(280);
      clay.noteCanvasClick(evAt());
      await waitMs(280);
      var slow = clay.noteCanvasClick(evAt());
      if (slow.kind !== 'heart') {
        await waitMs(windowMs + late + slack);
      }
      assert.strictEqual((clay.lastCanvasDelivery() || {}).kind, 'heart', tag + ': slow 280ms triple is a heart');
      assert.strictEqual(calls.length, 1, tag + ': slow triple sends one heart');
      assert.ok(calls[0].user.indexOf('heart') !== -1, tag + ': slow triple is a heart prompt');

      // Knock, then a triple -> knock then heart
      clay.resetRate();
      calls.length = 0;
      clay.setClassifyTimerDelay(late);
      clay.noteCanvasClick(evAt());
      await waitMs(windowMs + late + slack);
      assert.strictEqual((clay.lastCanvasDelivery() || {}).kind, 'knock', tag + ': first gesture is a knock');
      var afterKnock = clay.lastCanvasDelivery();
      clay.noteCanvasClick(evAt());
      clay.noteCanvasClick(evAt());
      var afterTriple = clay.noteCanvasClick(evAt());
      if (afterTriple.kind !== 'heart') {
        await waitMs(windowMs + late + slack);
      }
      assert.strictEqual(afterKnock.kind, 'knock', tag + ': knock then triple kept the knock');
      assert.strictEqual((clay.lastCanvasDelivery() || {}).kind, 'heart', tag + ': knock then a triple ends on a heart');
    }
  }
  clay.setClassifyTimerDelay(0);
  clay.setOn(false);
  clay.setReduced(false);
}

realTimerSuite().then(function () {
  if (twin) {
    console.log('SMOKE_OK clay brick 1 v0.1');
    console.log('SMOKE_OK clay twins match ' + twin);
  } else {
    console.log('clay-brick-1 checks passed (twins skipped)');
    console.log('SMOKE_SKIP clay twins: no sibling repo found (set CLAY_TWIN_DIR, or run beside the matching worktree)');
  }
}).catch(function (err) {
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
