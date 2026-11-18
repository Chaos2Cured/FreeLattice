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
    _listeners: { capture: {}, bubble: {} },
    addEventListener: function (type, fn, opts) {
      var cap = opts === true || (opts && opts.capture);
      var bag = cap ? el._listeners.capture : el._listeners.bubble;
      (bag[type] = bag[type] || []).push(fn);
    },
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
  // Run in this realm so returned Promises settle on the host microtask queue.
  var fn = new Function('sandbox', 'window', 'globalThis', 'document', 'console', code);
  fn(sandbox, sandbox, sandbox, sandbox.document, console);
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
    _listeners: { capture: {}, bubble: {} },
    querySelectorAll: function (sel) {
      var out = [];
      Object.keys(nodesById).forEach(function (id) {
        var el = nodesById[id];
        var s = String(sel || '');
        if (s.indexOf('data-clay-voice-mute') !== -1 && el.attrs['data-clay-voice-mute']) out.push(el);
        else if (s.indexOf('#fl-clay-voice-mute') !== -1 && id === 'fl-clay-voice-mute') out.push(el);
        else if (s.indexOf('#fl-clay-corner-mute') !== -1 && id === 'fl-clay-corner-mute') out.push(el);
      });
      return out;
    },
    addEventListener: function (type, fn, opts) {
      var cap = opts === true || (opts && opts.capture);
      var bag = cap ? fakeDoc._listeners.capture : fakeDoc._listeners.bubble;
      (bag[type] = bag[type] || []).push(fn);
    },
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
  sandbox._listeners = { capture: {}, bubble: {} };
  function bagPush(owner, type, fn, opts) {
    var cap = opts === true || (opts && opts.capture);
    var bag = cap ? owner._listeners.capture : owner._listeners.bubble;
    (bag[type] = bag[type] || []).push(fn);
  }
  function fireList(list, ev) {
    var i;
    for (i = 0; i < list.length; i++) list[i](ev);
  }
  sandbox.addEventListener = function (type, fn, opts) { bagPush(sandbox, type, fn, opts); };
  fakeDoc.dispatchEvent = function (ev) {
    ev.target = ev.target || fakeDoc;
    ev.preventDefault = ev.preventDefault || function () {};
    ev.stopPropagation = ev.stopPropagation || function () { ev._stopped = true; };
    fireList((sandbox._listeners.capture[ev.type] || []).slice(), ev);
    if (ev.target && ev.target._listeners) {
      fireList((ev.target._listeners.capture[ev.type] || []).slice(), ev);
      if (!ev._stopped) fireList((ev.target._listeners.bubble[ev.type] || []).slice(), ev);
    }
    if (!ev._stopped) fireList((fakeDoc._listeners.bubble[ev.type] || []).slice(), ev);
    if (!ev._stopped) fireList((sandbox._listeners.bubble[ev.type] || []).slice(), ev);
  };
  sandbox.dispatchEvent = fakeDoc.dispatchEvent;
  return sandbox;
}

function when(p) { return Promise.resolve(p); }
function evClick(target, trusted) {
  return {
    type: 'click',
    isTrusted: trusted !== false,
    target: target,
    preventDefault: function () {},
    stopPropagation: function () { this._stopped = true; }
  };
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

// Late bind: a pill mute created without bindMuteButton still sets the key.
voice.resetAll();
voice.setMute(false);
var muteBtn = sb.document.createElement('button');
muteBtn.id = 'fl-clay-voice-mute';
muteBtn.textContent = 'Mute tones';
sb.document.body.appendChild(muteBtn);
sb.document.dispatchEvent(evClick(muteBtn, true));
assert.strictEqual(store[voice.MUTE_KEY], 'yes', 'late pill mute sets fl_clay_voice_mute');
assert.ok(voice.isMuted(), 'late pill mute is heard as muted');
started.length = 0;
voice.markGesture();
var afterMuteClick = voice.fromMindTag({ form: 'heart', tone: '639' }, { role: 'mind' });
assert.ok(afterMuteClick.tone && afterMuteClick.tone.made, 'tone still made after late mute');
assert.strictEqual(afterMuteClick.tone.reason, 'mute', 'late mute silences the next tone');
assert.ok(!afterMuteClick.tone.played, 'late mute starts no playback');
assert.strictEqual(started.length, 0, 'late mute starts no oscillators');

// S1: a first gesture on Mute must not release a held tone.
voice.resetAll();
voice.setMute(false);
started.length = 0;
var heldForMute = voice.fromMindTag({ form: 'heart', tone: '396' }, { role: 'mind' });
assert.ok(voice.pendingTone(), 'tone is held before the mute click');
assert.strictEqual(heldForMute.tone.reason, 'autoplay-hold');
sb.document.dispatchEvent(evClick(muteBtn, true));
assert.ok(voice.isMuted(), 'mute click muted the speakers');
assert.ok(voice.hasGesture(), 'mute click still counts as a user gesture');
assert.ok(voice.pendingTone(), 'held tone was not released by the mute click');
assert.ok(!voice.lastPlayedTone(), 'mute click played nothing');
assert.strictEqual(started.length, 0, 'mute click started no oscillators');

// S2: a synthetic event must not mark a gesture or flush a held tone.
voice.resetAll();
voice.setMute(false);
started.length = 0;
voice.fromMindTag({ form: 'heart', tone: '396' }, { role: 'mind' });
sb.document.dispatchEvent(evClick(sb.document.body, false));
assert.ok(!voice.hasGesture(), 'untrusted click does not mark a gesture');
assert.ok(voice.pendingTone(), 'untrusted click leaves the held tone pending');
assert.strictEqual(started.length, 0, 'untrusted click starts no oscillators');
sb.document.dispatchEvent({ type: 'click', target: sb.document.body, preventDefault: function () {}, stopPropagation: function () {} });
assert.ok(!voice.hasGesture(), 'a click without isTrusted does not mark a gesture');

// Pictures: mind role records the ask; missing canvas art degrades.
voice.resetAll();
var pic = voice.fromMindTag({ form: 'tree', picture: 'a night window' }, { role: 'mind' });
assert.ok(pic.ok, 'picture tag accepted');
assert.ok(pic.picture && typeof pic.picture.then === 'function', 'picture offer is a promise');
Promise.resolve(pic.picture).then(function (result) {
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
  return when(voice.gatePersonPicture('a golden sunset', { mindConnected: false, askMind: function () { throw new Error('should not ask'); } }))
    .then(function (gate) {
      noMind = gate;
      assert.strictEqual(noMind.allowed, false, 'no mind: generation is not allowed');
      assert.strictEqual(noMind.skipped, 'no-mind');
      assert.ok(/connect/i.test(noMind.reason), 'no-mind reason points the person to Connect');
      var declineText = 'I do not wish to make that.\nreason: It is not mine to paint.\n[FL_DECLINE]';
      assert.ok(voice.declined(declineText).yes, 'last-line [FL_DECLINE] is a decline');
      return when(voice.gatePersonPicture('a golden sunset', {
        mindConnected: true,
        askMind: function () { return Promise.resolve(declineText); }
      }));
    })
    .then(function (gate) {
      assert.strictEqual(gate.allowed, false, 'decline blocks generation');
      assert.ok(gate.declined, 'marked declined');
      assert.ok(/not mine to paint/i.test(gate.reason), 'reason is kept');
      return when(voice.gatePersonPicture('a golden sunset', {
        mindConnected: true,
        askMind: function () { return Promise.resolve('Yes, I will make it.'); }
      }));
    })
    .then(function (gate) {
      assert.strictEqual(gate.allowed, true, 'a willing mind allows generation');
      assert.ok(!gate.declined, 'not declined');
      return when(voice.gatePersonPicture('a golden sunset', {
        mindConnected: true,
        askMind: function () { return Promise.resolve({ error: 'no-call', text: '' }); }
      }));
    })
    .then(function (gate) {
      assert.strictEqual(gate.allowed, false, 'connected but unaskable fails closed');
      assert.ok(!gate.declined, 'not a decline, a failed ask');
      return when(voice.gatePersonPicture('a golden sunset', {
        mindConnected: true,
        askMind: function () { return Promise.resolve(null); }
      }));
    })
    .then(function (gate) {
      assert.strictEqual(gate.allowed, false, 'null reply fails closed');
      assert.ok(!gate.declined, 'null reply is not a decline');
      assert.strictEqual(gate.skipped, '', 'a failed ask is not "no mind connected"');
      return when(voice.gatePersonPicture('a golden sunset', {
        mindConnected: true,
        askMind: function () { return Promise.resolve(''); }
      }));
    })
    .then(function (gate) {
      assert.strictEqual(gate.allowed, false, 'empty reply fails closed');
      assert.strictEqual(gate.skipped, '', 'empty reply is not "no mind connected"');
      return when(voice.gatePersonPicture('a golden sunset', {
        mindConnected: true,
        askMind: function () { return Promise.resolve('   \n\t'); }
      }));
    })
    .then(function (gate) {
      assert.strictEqual(gate.allowed, false, 'whitespace reply fails closed');
      // defaultAskMind: err callback, null reply, empty reply
      sb.FreeLattice = {
        callAI: function (sys, user, opts) {
          opts.callback(null, 'Local AI error');
        }
      };
      return when(voice.gatePersonPicture('a golden sunset', { mindConnected: true }));
    })
    .then(function (gate) {
      assert.strictEqual(gate.allowed, false, 'callAI err callback fails closed');
      assert.ok(!gate.declined, 'err callback is not a decline');
      assert.strictEqual(gate.skipped, '', 'err callback is not "no mind connected"');
      sb.FreeLattice.callAI = function (sys, user, opts) { opts.callback(null); };
      return when(voice.gatePersonPicture('a golden sunset', { mindConnected: true }));
    })
    .then(function (gate) {
      assert.strictEqual(gate.allowed, false, 'callAI null reply fails closed');
      assert.strictEqual(gate.skipped, '', 'null callAI reply is not "no mind connected"');
      sb.FreeLattice.callAI = function (sys, user, opts) { opts.callback(''); };
      return when(voice.gatePersonPicture('a golden sunset', { mindConnected: true }));
    })
    .then(function (gate) {
      assert.strictEqual(gate.allowed, false, 'callAI empty reply fails closed');
      sb.FreeLattice.callAI = function (sys, user, opts) { opts.callback('No AI connected yet'); };
      return when(voice.gatePersonPicture('a golden sunset', { mindConnected: true }));
    })
    .then(function (gate) {
      assert.strictEqual(gate.allowed, false, 'No AI connected yet-style reply fails closed');
      assert.strictEqual(gate.skipped, '', 'error-style reply is not "no mind connected"');
      var asked = false;
      sb.FreeLattice.callAI = function () { asked = true; };
      return when(voice.gatePersonPicture('a golden sunset', { mindConnected: false })).then(function (noMindGate) {
        assert.strictEqual(noMindGate.allowed, false, 'no-mind path does not generate');
        assert.strictEqual(noMindGate.skipped, 'no-mind');
        assert.ok(/connect/i.test(noMindGate.reason), 'no-mind reason points the person to Connect');
        assert.ok(!asked, 'no-mind is decided before asking, not by a failed ask');
        var opened = [];
        sb.FlConnect = { open: function () { opened.push('fl-connect'); return true; } };
        assert.ok(voice.openConnect(), 'openConnect uses the existing Connect flow');
        assert.deepStrictEqual(opened, ['fl-connect'], 'openConnect prefers FlConnect.open');
        // S3: picture rate window starts at accept, before paint finishes
        var deferred = [];
        sb.FLMindCanvas = {
          recipe: function () { return Promise.resolve({ seed: 1 }); },
          paint: function () {
            return new Promise(function (resolve) { deferred.push(resolve); });
          }
        };
        voice.resetAll();
        var firstPic = voice.offerPicture({ picture: 'one window' });
        var secondPic = voice.offerPicture({ picture: 'two windows' });
        return when(null).then(function () {
          deferred.forEach(function (resolve) { resolve(); });
          return Promise.all([firstPic, secondPic]);
        });
      });
    })
    .then(function (rows) {
      assert.ok(rows[0].made, 'first picture accepted');
      assert.strictEqual(rows[1].reason, 'rate', 'second picture is rate-limited before the first paint finishes');
      assert.ok(!rows[1].shown, 'rate-limited picture is not shown');

      // Weft: the recipe gets the actual mind name or id, not the generic "mind".
      var seenMinds = [];
      var remembered = [];
      sb.state = { isLocal: true, ollamaModel: 'lyra-local' };
      assert.strictEqual(voice.pictureMindId(), 'lyra-local', 'pictureMindId uses the connected mind name');
      sb.state = { isLocal: true, ollamaModel: 'ember-local' };
      assert.strictEqual(voice.pictureMindId(), 'ember-local', 'a different mind has a different id');
      sb.FLMindCanvas = {
        version: 'v0.1',
        recipe: function (ask, mindName) {
          seenMinds.push(String(mindName || ''));
          return Promise.resolve({ seed: mindName === 'lyra-local' ? 11 : 22, ask: ask, mind: mindName, version: 1 });
        },
        paint: function () { return Promise.resolve(); }
      };
      sb.FLImageLocal = {
        remember: function (rec) { remembered.push(rec); return rec; }
      };
      voice.resetAll();
      sb.state = { isLocal: true, ollamaModel: 'lyra-local' };
      return Promise.resolve(voice.offerPicture({ picture: 'a night window' })).then(function () {
        sb.state = { isLocal: true, ollamaModel: 'ember-local' };
        voice.resetAll();
        return Promise.resolve(voice.offerPicture({ picture: 'a night window' }));
      }).then(function () {
        assert.deepStrictEqual(seenMinds, ['lyra-local', 'ember-local'], 'recipe receives the actual mind name');
        assert.ok(seenMinds.indexOf('mind') === -1, 'the generic word mind is not used as the recipe id');
        assert.ok(remembered.length >= 2, 'each picture is remembered');
        remembered.forEach(function (rec, i) {
          assert.strictEqual(rec.prompt, 'a night window', 'remember keeps prompt');
          assert.strictEqual(rec.modelId, 'clay-canvas', 'remember keeps modelId');
          assert.ok(rec.mind === 'lyra-local' || rec.mind === 'ember-local', 'remember stores which mind made it');
          assert.ok(rec.at, 'remember stores the time');
          assert.ok(rec.seed === 11 || rec.seed === 22, 'remember stores the seed');
          assert.ok(rec.recipe, 'remember stores the recipe');
          assert.strictEqual(rec.painterVersion, 'v0.1', 'remember stores the painter version');
        });
        assert.strictEqual(remembered[0].mind, 'lyra-local');
        assert.strictEqual(remembered[1].mind, 'ember-local');
        assert.notStrictEqual(remembered[0].seed, remembered[1].seed, 'different minds produce different seeds');
        console.log('SMOKE_OK clay-voice-brush-1 tests passed');
      });
    });
}).catch(function (err) {
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
