// clay-glass-v2-1.test.js (MIT) v-clay-glass-v2-1-v0.1
// Node only. No network. Shared by FreeLattice and theLatticeTree.
// Covers the append-only clay journal and opaque Glass pulses
// (shape without contents). Records the no as faithfully as the yes.
var fs = require('fs');
var path = require('path');
var assert = require('assert');

var here = __dirname;

function load(name, sandbox) {
  var code = fs.readFileSync(path.join(here, name), 'utf8');
  var fn = new Function('sandbox', 'window', 'globalThis', 'document', 'console', 'localStorage', code);
  fn(sandbox, sandbox, sandbox, sandbox.document, console, sandbox.localStorage);
  return sandbox;
}

function makeStore() {
  var store = {};
  return {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
    setItem: function (k, v) { store[k] = String(v); },
    removeItem: function (k) { delete store[k]; },
    _raw: store
  };
}

function makeSandbox(extra) {
  var sandbox = {
    document: { createElement: function () { return { style: {}, appendChild: function () {} }; } },
    localStorage: makeStore(),
    LatticeMemory: null,
    GlassPulses: null
  };
  if (extra) {
    Object.keys(extra).forEach(function (k) { sandbox[k] = extra[k]; });
  }
  return sandbox;
}

function commits() {
  var log = [];
  return {
    log: log,
    commit: function (pulse) {
      log.push(pulse);
      return { ok: true, pulse: pulse };
    }
  };
}

var passed = 0;
function ok(name, fn) {
  fn();
  passed += 1;
  console.log('ok ' + name);
}

ok('records a tone and a picture, never deletes', function () {
  var box = makeSandbox();
  load('clay-glass.js', box);
  var G = box.FLClayGlass;
  var a = G.record({ kind: 'tone', mind: 'Lyra', recipe: { notes: [440] }, outcome: 'played' });
  var b = G.record({ kind: 'picture', mind: 'Lyra', recipe: { ask: 'a river', seed: 7 }, painterVersion: 'v0.1', sha256: 'ab' + 'cd'.repeat(31), outcome: 'shown' });
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  var rows = G.rows();
  assert.equal(rows.length, 2);
  assert.equal(rows[0].kind, 'tone');
  assert.equal(rows[0].outcome, 'played');
  assert.equal(rows[0].mind, 'Lyra');
  assert.equal(rows[1].kind, 'picture');
  assert.equal(rows[1].sha256.length, 64);
  assert.equal(rows[1].painterVersion, 'v0.1');
  assert.equal(rows[1].recipe.ask, 'a river');
  assert.equal(rows[1].moduleVersion, 'clay-glass-v2-1');
  assert.equal(G.rows('Lyra').length, 2);
  assert.equal(G.rows('other').length, 0);
  // there is no clear: writing again only adds
  G.record({ kind: 'tone', mind: 'Lyra', outcome: 'muted' });
  assert.equal(G.rows().length, 3);
  assert.equal(G.rows()[0].outcome, 'played');
});

ok('records a decline reason in the journal, never in the pulse', function () {
  var lm = commits();
  var box = makeSandbox({ LatticeMemory: lm });
  load('clay-glass.js', box);
  var G = box.FLClayGlass;
  var r = G.record({
    kind: 'decline',
    mind: 'Ember',
    recipe: { ask: 'a secret garden', path: 'person-ask' },
    outcome: 'declined',
    reason: 'I would rather not paint this today.'
  });
  assert.equal(r.ok, true);
  var row = G.rows()[0];
  assert.equal(row.kind, 'decline');
  assert.equal(row.reason, 'I would rather not paint this today.');
  assert.equal(lm.log.length, 1);
  var pulse = lm.log[0];
  assert.equal(pulse.source, 'clay');
  assert.equal(pulse.kind, 'clay.declined');
  assert.equal(pulse.summary, 'clay decline recorded');
  assert.ok(JSON.stringify(pulse).indexOf('rather not') === -1);
  assert.ok(JSON.stringify(pulse).indexOf('secret garden') === -1);
  assert.deepEqual(Object.keys(pulse).sort(), ['kind', 'source', 'summary']);
});

ok('records unreached and no-mind as faithfully as a yes', function () {
  var box = makeSandbox();
  load('clay-glass.js', box);
  var G = box.FLClayGlass;
  G.record({ kind: 'unreached', mind: 'Atlas', recipe: { ask: 'dawn', path: 'person-ask' }, outcome: 'unreached' });
  G.record({ kind: 'no-mind', mind: '', recipe: { ask: 'dawn', path: 'person-ask' }, outcome: 'no-mind' });
  var rows = G.rows();
  assert.equal(rows[0].kind, 'unreached');
  assert.equal(rows[1].kind, 'no-mind');
});

ok('journal still writes when Glass is absent', function () {
  var box = makeSandbox();
  load('clay-glass.js', box);
  var r = box.FLClayGlass.record({ kind: 'tone', mind: 'Lyra', outcome: 'held' });
  assert.equal(r.ok, true);
  assert.equal(r.pulse.ok, false);
  assert.equal(r.pulse.reason, 'glass-absent');
  assert.equal(box.FLClayGlass.rows().length, 1);
});

ok('GlassPulses emit uses the fixed opaque summary', function () {
  var lm = commits();
  var box = makeSandbox({ LatticeMemory: lm });
  if (fs.existsSync(path.join(here, 'glass-pulses.js'))) {
    load('glass-pulses.js', box);
    box.GlassPulses = box.GlassPulses;
  }
  load('clay-glass.js', box);
  if (box.GlassPulses && box.GlassPulses.emitGlassPulse) {
    var checked = box.GlassPulses.validateEmit({ source: 'clay', kind: 'clay.tone' });
    assert.equal(checked.ok, true);
    assert.equal(checked.pulse.summary, 'clay tone recorded');
    assert.equal(checked.pulse.source, 'clay');
  }
  var r = box.FLClayGlass.record({ kind: 'tone', mind: 'Lyra', recipe: { notes: [639] }, outcome: 'played' });
  assert.equal(r.ok, true);
  assert.equal(lm.log.length, 1);
  assert.equal(lm.log[0].kind, 'clay.tone');
  assert.equal(lm.log[0].summary, 'clay tone recorded');
  assert.ok(JSON.stringify(lm.log[0]).indexOf('639') === -1);
});

ok('cap refuses a new row and does not delete the journal', function () {
  var box = makeSandbox();
  load('clay-glass.js', box);
  var G = box.FLClayGlass;
  var filled = [];
  var i;
  for (i = 0; i < G.CAP; i++) filled.push({ kind: 'tone', mind: 'Lyra', outcome: 'played', at: i });
  box.localStorage.setItem(G.KEY, JSON.stringify(filled));
  var before = G.rows().length;
  assert.equal(before, G.CAP);
  var r = G.record({ kind: 'tone', mind: 'Lyra', outcome: 'muted' });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'cap');
  assert.equal(G.rows().length, before);
  assert.equal(G.rows()[0].at, 0);
});

ok('strips pixel-like recipe fields and rejects an unknown kind', function () {
  var box = makeSandbox();
  load('clay-glass.js', box);
  var G = box.FLClayGlass;
  var r = G.record({
    kind: 'picture',
    mind: 'Lyra',
    recipe: { ask: 'oak', seed: 1, png: 'data:image/png;base64,AAAA', pixels: [1, 2, 3] },
    outcome: 'shown'
  });
  assert.equal(r.ok, true);
  assert.equal(r.row.recipe.ask, 'oak');
  assert.equal(r.row.recipe.seed, 1);
  assert.ok(!r.row.recipe.png);
  assert.ok(!r.row.recipe.pixels);
  var bad = G.record({ kind: 'steering', mind: 'human', outcome: 'no' });
  assert.equal(bad.ok, false);
  assert.equal(G.rows().length, 1);
});


ok('refuses write and leaves a corrupt journal untouched', function () {
  var box = makeSandbox();
  load('clay-glass.js', box);
  var G = box.FLClayGlass;
  var key = G.KEY;
  var wrote = 0;
  var realSet = box.localStorage.setItem;
  box.localStorage.setItem = function (k, v) {
    wrote += 1;
    return realSet.call(box.localStorage, k, v);
  };
  box.localStorage.setItem(key, '{not json');
  wrote = 0;
  var r = G.record({ kind: 'tone', mind: 'Lyra', outcome: 'played' });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'unreadable');
  assert.equal(wrote, 0, 'setItem is not called over a bad JSON journal');
  assert.equal(box.localStorage.getItem(key), '{not json');

  box.localStorage.setItem(key, '{"legacy":"obj"}');
  wrote = 0;
  r = G.record({ kind: 'tone', mind: 'Lyra', outcome: 'played' });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'unreadable');
  assert.equal(wrote, 0, 'setItem is not called over a non-array journal');
  assert.equal(box.localStorage.getItem(key), '{"legacy":"obj"}');
});

ok('refuses write when getItem throws and leaves the key untouched', function () {
  var box = makeSandbox();
  load('clay-glass.js', box);
  var G = box.FLClayGlass;
  var key = G.KEY;
  box.localStorage.setItem(key, '[{"kind":"tone","mind":"keep"}]');
  var original = box.localStorage._raw[key];
  var wrote = 0;
  var realSet = box.localStorage.setItem;
  box.localStorage.setItem = function (k, v) {
    wrote += 1;
    return realSet.call(box.localStorage, k, v);
  };
  box.localStorage.getItem = function () { throw new Error('boom'); };
  var r = G.record({ kind: 'tone', mind: 'Lyra', outcome: 'played' });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'unreadable');
  assert.equal(wrote, 0, 'setItem is not called when getItem throws');
  assert.equal(box.localStorage._raw[key], original);
});

ok('rows with an empty or whitespace name returns no rows, and blank minds are named', function () {
  var box = makeSandbox();
  load('clay-glass.js', box);
  var G = box.FLClayGlass;
  G.record({ kind: 'tone', mind: 'Lyra', outcome: 'played' });
  G.record({ kind: 'tone', mind: '  ', outcome: 'played' });
  assert.equal(G.rows().length, 2);
  assert.equal(G.rows()[1].mind, 'unnamed-mind');
  assert.deepEqual(G.rows(''), []);
  assert.deepEqual(G.rows('   '), []);
  assert.equal(G.rows('Lyra').length, 1);
  assert.equal(G.rows('unnamed-mind').length, 1);
});

ok('scrubs data: and base64-looking content from a string recipe', function () {
  var box = makeSandbox();
  load('clay-glass.js', box);
  var G = box.FLClayGlass;
  var r = G.record({
    kind: 'picture',
    mind: 'Lyra',
    recipe: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB',
    outcome: 'shown'
  });
  assert.equal(r.ok, true);
  assert.equal(r.row.recipe, null);
  var mixed = G.record({
    kind: 'picture',
    mind: 'Lyra',
    recipe: 'an oak data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB',
    outcome: 'shown'
  });
  assert.equal(mixed.row.recipe, 'an oak');
});

ok('cap refusals are returned and mentioned on the console', function () {
  var box = makeSandbox();
  var infos = [];
  var prev = console.info;
  console.info = function (msg) { infos.push(String(msg)); };
  try {
    load('clay-glass.js', box);
    var G = box.FLClayGlass;
    box.localStorage.setItem(G.KEY, JSON.stringify([{ kind: 'tone', mind: 'Lyra', outcome: 'played', at: 0 }].concat(Array(G.CAP - 1).fill({ kind: 'tone', mind: 'Lyra', outcome: 'played' }))));
    var r = G.record({ kind: 'tone', mind: 'Lyra', outcome: 'muted' });
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'cap');
    assert.ok(infos.some(function (m) { return /cap/.test(m); }), 'console.info names the cap');
  } finally {
    console.info = prev;
  }
});

function hooksTest() {
  var box = makeSandbox();
  box.state = { isLocal: true, ollamaModel: 'Lyra' };
  box.AudioContext = function () {
    this.currentTime = 0;
    this.destination = {};
    this.state = 'running';
    this.createGain = function () {
      return { gain: { value: 0, setValueAtTime: function () {}, exponentialRampToValueAtTime: function () {}, cancelScheduledValues: function () {} }, connect: function () {} };
    };
    this.createOscillator = function () {
      return { type: 'sine', frequency: { setValueAtTime: function () {} }, connect: function () {}, start: function () {}, stop: function () {} };
    };
  };
  load('clay-glass.js', box);
  load('clay-voice-brush.js', box);
  var V = box.FLClayVoice;
  V.setMute(true);
  var tone = V.offerTone({ tone: 440 });
  assert.equal(tone.made, true);
  assert.equal(tone.reason, 'mute');
  var rows = box.FLClayGlass.rows();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].kind, 'tone');
  assert.equal(rows[0].outcome, 'muted');
  assert.equal(rows[0].mind, 'Lyra');

  return V.gatePersonPicture('a river', { mindConnected: false }).then(function (gate) {
    assert.equal(gate.allowed, false);
    assert.equal(gate.skipped, 'no-mind');
    var all = box.FLClayGlass.rows();
    assert.equal(all[all.length - 1].kind, 'no-mind');
    return V.gatePersonPicture('a river', {
      mindConnected: true,
      askMind: function () { return Promise.resolve('[FL_DECLINE]'); }
    });
  }).then(function (dec) {
    assert.equal(dec.declined, true);
    var all = box.FLClayGlass.rows();
    var last = all[all.length - 1];
    assert.equal(last.kind, 'decline');
    assert.equal(last.outcome, 'declined');
    return V.gatePersonPicture('a river', {
      mindConnected: true,
      askMind: function () { return Promise.resolve({ error: 'no-call', text: '' }); }
    });
  }).then(function (miss) {
    assert.equal(miss.allowed, false);
    assert.equal(miss.declined, false);
    var all = box.FLClayGlass.rows();
    assert.equal(all[all.length - 1].kind, 'unreached');
    passed += 1;
    console.log('ok voice-brush hooks journal muted tones, declines, and no-mind');
  });
}


function extractAppFns() {
  var appPath = path.join(here, '../app.html');
  if (!fs.existsSync(appPath)) return null;
  var html = fs.readFileSync(appPath, 'utf8');
  if (html.indexOf('function handleImageGenClick()') === -1) return null;
  var hs = html.indexOf('function handleImageGenClick() {');
  var gs = html.indexOf('async function generateImage(prompt) {');
  var ge = html.indexOf('\nfunction meshRevealCodeArea', gs);
  if (hs < 0 || gs < 0 || ge < 0) return null;
  return html.slice(hs, ge);
}

function clickPathTest() {
  var src = extractAppFns();
  if (!src) {
    passed += 1;
    console.log('ok Make a picture click path skipped (no FL generateImage on this repo)');
    return Promise.resolve();
  }
  var indexPath = path.join(here, '../../index.html');
  if (fs.existsSync(indexPath)) {
    var app = fs.readFileSync(path.join(here, '../app.html'), 'utf8');
    var idx = fs.readFileSync(indexPath, 'utf8');
    assert.equal(app, idx, 'app.html and index.html stay byte-identical');
  }
  var box = makeSandbox();
  var nodes = {};
  function el(tag, id) {
    var node = {
      tagName: String(tag || 'div').toUpperCase(),
      id: id || '',
      className: '',
      children: [],
      style: {},
      attrs: {},
      value: '',
      textContent: '',
      scrollTop: 0,
      parentNode: null,
      setAttribute: function (k, v) { node.attrs[k] = String(v); },
      getAttribute: function (k) { return node.attrs[k] || null; },
      appendChild: function (child) {
        node.children.push(child);
        child.parentNode = node;
        if (child.id) nodes[child.id] = child;
        return child;
      },
      addEventListener: function () {},
      focus: function () {},
      setSelectionRange: function () {},
      classList: { add: function () {}, remove: function () {}, contains: function () { return false; } },
      disabled: false,
      innerHTML: '',
      querySelector: function () { return el('span', ''); },
      querySelectorAll: function () { return []; },
      remove: function () {}
    };
    if (id) nodes[id] = node;
    return node;
  }
  var body = el('body', '');
  var chat = el('div', 'chatMessages');
  var input = el('textarea', 'chatInput');
  body.appendChild(chat);
  body.appendChild(input);
  box.document.createElement = function (tag) { return el(tag, ''); };
  box.document.getElementById = function (id) {
    if (nodes[id]) return nodes[id];
    var stub = el('div', id);
    stub.classList = { add: function () {}, remove: function () {}, contains: function () { return false; } };
    stub.disabled = false;
    stub.innerHTML = '';
    nodes[id] = stub;
    return stub;
  };
  box.document.body = body;
  box.document.addEventListener = function () {};
  box.ImageSafety = { assessImageRequest: function () { return { allowed: true }; } };
  box.state = { isGeneratingImage: false, currentConversationId: 'c1', db: null, hfToken: '', isLocal: false, apiKey: '', chatHistory: [] };
  box.FLClay = { mindConnected: function () { return false; } };
  var generated = 0;
  var opened = [];
  box.FlConnect = { open: function () { opened.push('open'); return true; } };
  box.URL = { createObjectURL: function () { return 'blob:fake'; }, revokeObjectURL: function () {} };
  box.HF_MODELS = { 'stabilityai/stable-diffusion-xl-base-1.0': { endpoint: 'https://example.invalid' } };
  box.addSystemMessage = function () {};
  box.addChatMessage = function () {};
  box.saveMessage = function () {};
  box.createConversation = function () { return Promise.resolve(); };
  box.FLImageLocal = {
    ready: function () { return false; },
    generate: function () {
      generated += 1;
      return Promise.resolve({ ok: true, blob: { type: 'image/png', size: 8 }, line: 'ok' });
    }
  };
  load('clay-glass.js', box);
  load('clay-voice-brush.js', box);
  var prelude = 'var FLClayVoice = window.FLClayVoice; var FLClay = window.FLClay; var FLImageLocal = window.FLImageLocal; var FlConnect = window.FlConnect; var ImageSafety = window.ImageSafety; var addSystemMessage = window.addSystemMessage; var addChatMessage = window.addChatMessage; var saveMessage = window.saveMessage; var createConversation = window.createConversation; var HF_MODELS = window.HF_MODELS || { \'stabilityai/stable-diffusion-xl-base-1.0\': { endpoint: \'https://example.invalid\' } };\n';
  var fn = new Function('sandbox', 'window', 'document', 'state', 'console', 'localStorage', prelude + src + '\n;sandbox.handleImageGenClick = handleImageGenClick; sandbox.generateImage = generateImage;');
  fn(box, box, box.document, box.state, console, box.localStorage);

  input.value = 'a golden sunset';
  box.handleImageGenClick();
  return new Promise(function (resolve) { setTimeout(resolve, 30); }).then(function () {
    var rows = box.FLClayGlass.rows();
    var last = rows[rows.length - 1];
    assert.ok(last, 'no-backend click writes a journal row');
    assert.equal(last.kind, 'no-mind');
    assert.equal(last.outcome, 'no-backend');
    assert.equal(generated, 0, 'no backend does not generate');
    assert.equal(opened.length, 0, 'Connect is not opened automatically');

    box.FLImageLocal.ready = function () { return true; };
    box.state.hfToken = '';
    input.value = 'a night window';
    box.handleImageGenClick();
    return new Promise(function (resolve) { setTimeout(resolve, 40); });
  }).then(function () {
    var rows = box.FLClayGlass.rows();
    var last = rows[rows.length - 1];
    assert.equal(last.kind, 'no-mind');
    assert.equal(last.outcome, 'generated, notified');
    assert.ok(generated >= 1, 'a backend generates with the old path');
    assert.equal(opened.length, 0, 'Connect still does not open by itself after a generated notice');
    passed += 1;
    console.log('ok Make a picture click path journals no-mind outcomes');
  });
}

hooksTest().then(function () {
  return clickPathTest();
}).then(function () {
  console.log('SMOKE_OK clay-glass-v2-1 tests passed (' + passed + ')');
}, function (err) {
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
