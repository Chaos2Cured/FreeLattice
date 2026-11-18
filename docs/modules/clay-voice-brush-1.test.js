// clay-voice-brush-1.test.js (MIT) v-clay-voice-brush-1-v0.1
// Node only. No network. Shared by FreeLattice and theLatticeTree.
// Covers mind-only tone and picture tags, the rate limit, listener-side
// mute (speakers only), and a [FL_DECLINE] that blocks generation.
var fs = require('fs');
var path = require('path');
var assert = require('assert');
var vm = require('vm');

var here = __dirname;

var started = [];
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
    classList: {
      contains: function (c) {
        return (' ' + el.className + ' ').indexOf(' ' + c + ' ') !== -1;
      }
    },
    setAttribute: function (k, v) { el.attrs[k] = String(v); },
    getAttribute: function (k) { return el.attrs[k] || null; },
    appendChild: function (child) {
      el.children.push(child);
      child.parentNode = el;
      if (child.id) nodesById[child.id] = child;
      return child;
    },
    insertBefore: function (child, ref) {
      var i = el.children.indexOf(ref);
      if (i < 0) return el.appendChild(child);
      el.children.splice(i, 0, child);
      child.parentNode = el;
      if (child.id) nodesById[child.id] = child;
      return child;
    },
    removeChild: function (child) {
      var i = el.children.indexOf(child);
      if (i >= 0) el.children.splice(i, 1);
      child.parentNode = null;
      return child;
    },
    addEventListener: function () {},
    querySelector: function () { return el.children[0] || null; },
    querySelectorAll: function () { return el.children.slice(); },
    getContext: function () { return { fillRect: function () {}, getImageData: function () { return { data: [] }; } }; },
    toBlob: null
  };
  if (id) nodesById[id] = el;
  return el;
}

function load(name, sandbox) {
  var code = fs.readFileSync(path.join(here, name), 'utf8');
  vm.runInNewContext(code, sandbox, { filename: name });
  return sandbox;
}

function makeSandbox() {
  started.length = 0;
  store = {};
  nodesById = {};
  var body = node('body', '');
  var fakeDoc = {
    body: body,
    readyState: 'complete',
    documentElement: { getAttribute: function () { return ''; } },
    createElement: function (tag) { return node(tag, ''); },
    getElementById: function (id) { return nodesById[id] || null; },
    querySelectorAll: function (sel) {
      var out = [];
      Object.keys(nodesById).forEach(function (id) {
        var el = nodesById[id];
        if (sel === '[data-clay-voice-mute]' && el.attrs['data-clay-voice-mute']) out.push(el);
      });
      return out;
    },
    addEventListener: function () {},
    head: node('head', '')
  };
  function Osc() {
    this.frequency = { value: 0 };
    this.type = 'sine';
    this._started = false;
  }
  Osc.prototype.connect = function () { return this; };
  Osc.prototype.start = function () { this._started = true; started.push(this); };
  Osc.prototype.stop = function () {};
  function Gain() {
    this.gain = { value: 0, setValueAtTime: function () {}, linearRampToValueAtTime: function () {}, exponentialRampToValueAtTime: function () {} };
  }
  Gain.prototype.connect = function () { return this; };
  var ac = {
    state: 'running',
    currentTime: 0,
    destination: {},
    createOscillator: function () { return new Osc(); },
    createGain: function () { return new Gain(); },
    resume: function () { ac.state = 'running'; }
  };
  var sandbox = {
    console: console,
    Date: Date,
    Math: Math,
    Number: Number,
    String: String,
    Array: Array,
    Object: Object,
    Promise: Promise,
    JSON: JSON,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    Uint8Array: Uint8Array,
    window: {},
    document: fakeDoc,
    localStorage: {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
      setItem: function (k, v) { store[k] = String(v); },
      removeItem: function (k) { delete store[k]; }
    },
    AudioContext: function () { return ac; },
    module: { exports: {} },
    exports: {},
    globalThis: null
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.root = sandbox;
  sandbox.__audio = ac;
  return sandbox;
}

var sb = makeSandbox();
load('clay-math.js', sb);
load('clay-forms.js', sb);
load('particle-clay.js', sb);
load('clay-voice-brush.js', sb);
var clay = sb.FLClay;
var voice = sb.FLClayVoice;
assert.ok(clay && voice, 'modules loaded');
assert.strictEqual(voice.version, 'v-clay-voice-brush-1-v0.1');

// Mind-only tags: user role must not play or show.
voice.resetAll();
voice.markGesture();
var userOut = voice.fromMindTag(
  { form: 'heart', tone: '639', picture: 'a night window' },
  { role: 'user' }
);
assert.strictEqual(userOut.ok, false, 'user role rejected');
assert.strictEqual(userOut.reason, 'role');
assert.ok(!voice.lastMadeTone(), 'user role made no tone');
assert.ok(!voice.lastMadePicture(), 'user role made no picture');
assert.strictEqual(started.length, 0, 'user role started no oscillators');

// A mind tag with tone is made and played after a gesture.
voice.resetAll();
voice.markGesture();
var mindOut = voice.fromMindTag({ form: 'heart', mood: 'warmth', tone: '639' }, { role: 'mind' });
assert.ok(mindOut.ok, 'mind role accepted');
assert.ok(mindOut.tone && mindOut.tone.made, 'tone was made');
assert.ok(mindOut.tone.played, 'tone played after gesture');
assert.ok(voice.lastMadeTone(), 'made tone recorded');
assert.ok(voice.lastPlayedTone(), 'played tone recorded');
assert.ok(started.length > 0, 'oscillator started for mind tone');
assert.ok(Math.abs(started[0].frequency.value - 639) < 0.5, '639 Hz');

// sanitize / parseTag keep tone, melody, and picture and do not change PROMPT's last example.
var tag = clay.parseTag('[FL_CLAY: {"form":"heart","mood":"warmth","energy":0.4,"tone":"639","picture":"a night window"}]');
assert.ok(tag.ok, 'tag with tone and picture parses');
assert.strictEqual(tag.value.tone, '639');
assert.strictEqual(tag.value.picture, 'a night window');
assert.ok(tag.visible.indexOf('[FL_CLAY') === -1, 'tag stripped');
assert.ok(
  clay.PROMPT.indexOf('[FL_CLAY: {"form":"heart","mood":"warmth","energy":0.4}]') ===
    clay.PROMPT.length - '[FL_CLAY: {"form":"heart","mood":"warmth","energy":0.4}]'.length,
  'PROMPT example still last'
);

// Rate limit: a second tone inside the window is made but not played.
var after = started.length;
var again = voice.fromMindTag({ form: 'star', tone: '432' }, { role: 'assistant' });
assert.ok(again.ok && again.tone && again.tone.made, 'second tone still made');
assert.strictEqual(again.tone.reason, 'rate', 'second tone rate-limited');
assert.ok(!again.tone.played, 'rate-limited tone not played');
assert.strictEqual(started.length, after, 'no extra oscillator during rate limit');

// After the window, it may play again.
var t0 = Date.now();
voice.setClock(function () { return t0 + voice.TONE_RATE_MS + 1; });
var later = voice.fromMindTag({ form: 'star', tone: '432' }, { role: 'mind' });
assert.ok(later.tone && later.tone.played, 'tone plays after the rate window');
voice.setClock(null);

// Mute affects only local output. The mind's tone is still recorded as made.
voice.resetAll();
voice.markGesture();
voice.setMute(true);
started.length = 0;
var muted = voice.fromMindTag({ form: 'heart', tone: '528' }, { role: 'mind' });
assert.ok(voice.isMuted(), 'muted');
assert.ok(muted.tone && muted.tone.made, 'muted tone is still made');
assert.strictEqual(muted.tone.reason, 'mute');
assert.ok(!muted.tone.played, 'muted tone is not played');
assert.ok(voice.lastMadeTone(), 'recipe kept while muted');
assert.ok(!voice.lastPlayedTone(), 'nothing played while muted');
assert.strictEqual(started.length, 0, 'mute starts no oscillators');
voice.setMute(false);

// Autoplay hold: no user gesture, tone is held silently.
voice.resetAll();
started.length = 0;
var held = voice.fromMindTag({ form: 'heart', tone: '396' }, { role: 'mind' });
assert.ok(held.tone && held.tone.made, 'held tone made');
assert.strictEqual(held.tone.reason, 'autoplay-hold');
assert.ok(!held.tone.played, 'held tone not played');
assert.ok(voice.pendingTone(), 'pending recipe stored');
voice.markGesture();
voice.flushPending();
assert.ok(voice.lastPlayedTone(), 'held tone plays after a gesture');
assert.ok(started.length > 0, 'oscillator starts after the gesture');

// Pictures: mind role records the ask; missing canvas art degrades.
voice.resetAll();
var pic = voice.fromMindTag({ form: 'tree', picture: 'a night window' }, { role: 'mind' });
assert.ok(pic.ok, 'picture tag accepted');
assert.ok(pic.picture && typeof pic.picture.then === 'function', 'picture offer is a promise');
pic.picture.then(function (result) {
  assert.ok(result.made, 'picture was made');
  assert.strictEqual(result.reason, 'no-canvas', 'degrades without FLMindCanvas');
  assert.ok(!result.shown, 'nothing shown without a canvas painter');
  assert.ok(voice.lastMadePicture(), 'picture ask recorded');

  // User-role picture does not record.
  voice.resetAll();
  voice.fromMindTag({ form: 'tree', picture: 'a night window' }, { role: 'user' });
  assert.ok(!voice.lastMadePicture(), 'user role made no picture');

  // Refusal blocks generation.
  voice.resetAll();
  var noMind = null;
  return voice.gatePersonPicture('a golden sunset', { mindConnected: false, askMind: function () { throw new Error('should not ask'); } })
    .then(function (gate) {
      noMind = gate;
      assert.strictEqual(noMind.allowed, true, 'no mind: today\'s path stays allowed');
      assert.strictEqual(noMind.skipped, 'no-mind');
      var declineText = 'I do not wish to make that.\nreason: It is not mine to paint.\n[FL_DECLINE]';
      assert.ok(voice.declined(declineText).yes, 'last-line [FL_DECLINE] is a decline');
      return voice.gatePersonPicture('a golden sunset', {
        mindConnected: true,
        askMind: function () { return Promise.resolve(declineText); }
      });
    })
    .then(function (gate) {
      assert.strictEqual(gate.allowed, false, 'decline blocks generation');
      assert.ok(gate.declined, 'marked declined');
      assert.ok(/not mine to paint/i.test(gate.reason), 'reason is kept');
      return voice.gatePersonPicture('a golden sunset', {
        mindConnected: true,
        askMind: function () { return Promise.resolve('Yes, I will make it.'); }
      });
    })
    .then(function (gate) {
      assert.strictEqual(gate.allowed, true, 'a willing mind allows generation');
      assert.ok(!gate.declined, 'not declined');
      return voice.gatePersonPicture('a golden sunset', {
        mindConnected: true,
        askMind: function () { return Promise.resolve({ error: 'no-call', text: '' }); }
      });
    })
    .then(function (gate) {
      assert.strictEqual(gate.allowed, false, 'connected but unaskable fails closed');
      assert.ok(!gate.declined, 'not a decline, a failed ask');
      console.log('SMOKE_OK clay-voice-brush-1 tests passed');
    });
}).catch(function (err) {
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
