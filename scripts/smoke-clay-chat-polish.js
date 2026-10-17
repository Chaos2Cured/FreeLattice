#!/usr/bin/env node
// smoke-clay-chat-polish.js (MIT) v-clay-polish-v0.1 v-chat-polish-v0.1 v-memory-file-v0.1
// Node only. No network.
var fs = require('fs');
var path = require('path');
var assert = require('assert');
var rootDir = path.join(__dirname, '..');

var passed = 0;
function ok(cond, name) {
  assert.ok(cond, name);
  passed += 1;
}

function memStore() {
  var s = {};
  return {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(s, k) ? s[k] : null; },
    setItem: function (k, v) { s[k] = String(v); },
    removeItem: function (k) { delete s[k]; }
  };
}

function makeEl(tag) {
  var node = {
    tagName: tag,
    children: [],
    parentNode: null,
    className: '',
    textContent: '',
    style: {},
    attrs: {},
    hidden: false,
    clientWidth: 320,
    clientHeight: 220,
    width: 0,
    height: 0,
    type: '',
    _ev: {}
  };
  Object.defineProperty(node, 'id', {
    get: function () { return node._id || ''; },
    set: function (v) {
      if (node._id && byId[node._id] === node) delete byId[node._id];
      node._id = v || '';
      if (node._id) byId[node._id] = node;
    }
  });
  Object.defineProperty(node, 'nextSibling', {
    get: function () {
      if (!node.parentNode) return null;
      var i = node.parentNode.children.indexOf(node);
      return i >= 0 ? (node.parentNode.children[i + 1] || null) : null;
    }
  });
  Object.defineProperty(node.style, 'cssText', {
    set: function (v) {
      String(v || '').split(';').forEach(function (part) {
        var bits = part.split(':');
        if (bits.length < 2) return;
        var key = bits[0].trim().replace(/-([a-z])/g, function (_, c) { return c.toUpperCase(); });
        node.style[key] = bits.slice(1).join(':').trim();
      });
    }
  });
  node.appendChild = function (child) {
    if (child.parentNode) child.parentNode.removeChild(child);
    child.parentNode = node;
    node.children.push(child);
    return child;
  };
  node.insertBefore = function (child, before) {
    if (child.parentNode) child.parentNode.removeChild(child);
    child.parentNode = node;
    var at = before ? node.children.indexOf(before) : -1;
    if (at < 0) node.children.push(child);
    else node.children.splice(at, 0, child);
    return child;
  };
  node.removeChild = function (child) {
    var i = node.children.indexOf(child);
    if (i >= 0) node.children.splice(i, 1);
    child.parentNode = null;
    return child;
  };
  node.setAttribute = function (k, v) {
    node.attrs[k] = String(v);
    if (k === 'aria-expanded') node._expanded = String(v);
    if (k === 'hidden') node.hidden = true;
  };
  node.getAttribute = function (k) { return node.attrs[k]; };
  node.removeAttribute = function (k) {
    delete node.attrs[k];
    if (k === 'hidden') node.hidden = false;
  };
  node.addEventListener = function (type, fn) { node._ev[type] = fn; };
  node.click = function () { if (node._ev.click) node._ev.click(); };
  node.contains = function (other) { return node.children.indexOf(other) !== -1; };
  node.getContext = function () {
    return {
      fillStyle: '', strokeStyle: '', globalAlpha: 1,
      clearRect: function () {}, save: function () {}, restore: function () {},
      translate: function () {}, scale: function () {}, fillRect: function () {},
      beginPath: function () {}, arc: function () {}, stroke: function () {}
    };
  };
  return node;
}

var byId = {};
var documentStub = {
  readyState: 'complete',
  body: null,
  documentElement: makeEl('html'),
  addEventListener: function () {},
  createElement: function (tag) { return makeEl(tag); },
  getElementById: function (id) { return byId[id] || null; },
  querySelectorAll: function (sel) {
    if (sel === '#chatMessages .chat-message.assistant') {
      var box = byId.chatMessages;
      if (!box) return [];
      return box.children.filter(function (child) {
        return child.className && child.className.indexOf('assistant') !== -1;
      });
    }
    if (sel === '#fl-clay-canvas') {
      var found = [];
      function walk(n) {
        if (!n || !n.children) return;
        n.children.forEach(function (child) {
          if (child.id === 'fl-clay-canvas') found.push(child);
          walk(child);
        });
      }
      walk(documentStub.body);
      return found;
    }
    return [];
  }
};
documentStub.body = makeEl('body');
var messages = makeEl('div');
messages.id = 'chatMessages';
messages.clientWidth = 390;
var band = makeEl('div');
band.id = 'chatFeelMarketBand';
var presence = makeEl('div');
presence.id = 'chatPresenceRow';
band.appendChild(presence);
var market = makeEl('div');
market.id = 'chatMarketPanel';
documentStub.body.appendChild(messages);
documentStub.body.appendChild(band);
documentStub.body.appendChild(market);

global.document = documentStub;
global.localStorage = memStore();
global.window = global;

var clay = require(path.join(rootDir, 'docs/modules/particle-clay.js'));
var forms = require(path.join(rootDir, 'docs/modules/clay-forms.js'));

ok(forms.NAMES.indexOf('fractal') !== -1 && forms.NAMES.indexOf('fibonacci') !== -1 && forms.NAMES.indexOf('abstract') !== -1, 'three new forms');
ok(clay.boot || clay.ensurePill, 'clay api is present');

function reply(text) {
  var node = makeEl('div');
  node.className = 'chat-message assistant';
  node.textContent = text;
  messages.appendChild(node);
  return node;
}

clay.setOn(true);
var first = reply('one');
var seen = clay.consumeReply('[FL_CLAY: {"form":"star","mood":"joy","energy":0.4}]', []);
ok(seen.choice && seen.choice.form === 'star', 'a mark draws');
ok(clay.canvasCount() === 1, 'one canvas only');
var canvas = documentStub.getElementById('fl-clay-canvas');
ok(canvas && canvas.parentNode === messages && first.nextSibling === canvas, 'canvas follows the last reply');
var second = reply('two');
clay.consumeReply('[FL_CLAY: {"form":"moon","mood":"calm","energy":0.3}]', []);
ok(clay.canvasCount() === 1, 'still one canvas');
ok(second.nextSibling === canvas, 'canvas moved under the new reply');
ok(String(canvas.style.width).indexOf('320px') !== -1, 'width cap is 320');
ok(canvas.style.maxWidth === '100%', 'width stays inside the column');
ok(canvas.clientWidth <= messages.clientWidth, 'width never exceeds the chat column at 390');
clay.setOn(false);
ok(clay.canvasMounted() === false && canvas.parentNode == null, 'off holds no space');
ok(clay.canvasCount() === 0, 'off leaves no canvas');
console.log('SMOKE_OK clay place v0.1');

clay.ensurePill();
var pill = documentStub.getElementById('fl-clay-pill');
var pause = documentStub.getElementById('fl-clay-pause');
var panel = documentStub.getElementById('fl-clay-pill-panel');
ok(pill && pause && panel, 'pill present');
ok(pill.style.minHeight === '44px' && pause.style.minHeight === '44px', 'pill 44px');
ok(pill.getAttribute('aria-controls') === 'fl-clay-pill-panel', 'pill names its panel');
var toggle = documentStub.getElementById('fl-clay-toggle');
var notebook = makeEl('button');
notebook.id = 'fl-ws-open';
var notebookHits = 0;
notebook.addEventListener('click', function () { notebookHits += 1; });
documentStub.body.appendChild(notebook);
var spiral = makeEl('button');
spiral.id = 'fl-ws-view-open';
var spiralHits = 0;
spiral.addEventListener('click', function () { spiralHits += 1; });
documentStub.body.appendChild(spiral);
clay.ensurePill();
ok(toggle && toggle.parentNode === panel, 'clay toggle moved into the pill');
ok(notebook.parentNode === panel && spiral.parentNode === panel, 'notebook and spiral moved into the pill');
var toggleHits = 0;
var prior = toggle._ev.click;
toggle.addEventListener('click', function () { toggleHits += 1; if (prior) prior(); });
toggle.click();
notebook.click();
spiral.click();
ok(toggleHits === 1 && notebookHits === 1 && spiralHits === 1, 'the three buttons still fire');
ok(toggle.id === 'fl-clay-toggle' && notebook.id === 'fl-ws-open' && spiral.id === 'fl-ws-view-open', 'ids stayed');
clay.setPillOpen(false);
ok(pill.getAttribute('aria-expanded') === 'false' && panel.hidden === true, 'pill can close');
clay.setOn(true);
ok(pause.style.display !== 'none', 'pause shows while clay runs');
pause.click();
ok(clay.isOn() === false, 'Pause works with the pill closed');
console.log('SMOKE_OK clay pill v0.1');

var wave = clay.sanitize({
  form: 'fibonacci',
  color: 'gold',
  glow: 4,
  size: 9,
  motion: 'drift',
  blend: ['heart', 'star'],
  mix: 2,
  morph: ['seed', 'flower'],
  energy: [0, 2, -1, 'no', 0.4, 0.2, 0.2, 0.2, 0.9],
  seed: 'any words',
  why: 'because',
  url: 'nope'
});
ok(wave && wave.form === 'fibonacci' && wave.color === '#eab308', 'color name maps');
ok(wave.glow === 1 && wave.size === 1.6 && wave.mix === 1, 'glow size and mix clamp');
ok(wave.motion === 'drift' && wave.blend[0] === 'heart' && wave.morph[1] === 'flower', 'motion blend and morph parse');
ok(wave.energyWave.length === 8 && wave.energyWave[1] === 1 && wave.energyWave[2] === 0, 'eight waves, bad value skipped');
ok(wave.url == null, 'unknown key ignored');
ok(wave.why === 'because' && wave.seed === 'any words', 'why and seed kept');
var tiny = clay.sanitize({ form: 'fractal', size: 0.1, glow: -3, color: 'not-a-color' });
ok(tiny.size === 0.4 && tiny.glow === 0 && tiny.color == null, 'low size and bad color');
var near = clay.parseTag('[FL-CLAY: {"form":"abstract","mood":"wonder","motion":"sparkle","energy":0.5}]');
ok(near.ok && near.value.form === 'abstract' && near.value.mood === 'wonder', 'near-miss opening parses');
var spaced = clay.parseTag('[ fl_clay : {"form":"heart","mood":"awe","energy":0.2}]');
ok(spaced.ok && spaced.value.mood === 'awe' && spaced.value.color == null, 'awe stays a mood, not a new color key');
var badGrid = clay.sanitize({ form: 'heart', grid: new Array(17).fill('x'), mood: 'joy' });
ok(badGrid && badGrid.form === 'heart' && badGrid.grid == null, 'a bad grid on a real form is ignored');
ok(clay.sanitize({ form: 'grid', grid: new Array(17).fill('x') }) === null, 'a bad grid mark is still refused');
var old = clay.sanitize({ form: 'heart', mood: 'warmth', energy: 0.4 });
ok(JSON.stringify(old) === '{"form":"heart","mood":"warmth","energy":0.4,"motion":"gather"}', 'old marks stay identical');
clay.setReduced(true);
clay.setOn(true);
var beforeRaf = clay.rafHandles();
var morphed = clay.consumeReply('[FL_CLAY: {"form":"seed","morph":["seed","flower"],"energy":[0.1,0.9],"motion":"drift"}]', []);
ok(morphed.choice && morphed.choice.morph[1] === 'flower', 'morph parsed');
ok(clay.snapshot().form === 'flower', 'reduced motion shows the settled form');
ok(clay.snapshot().energy === 0.9, 'reduced motion holds the last wave');
ok(clay.rafHandles() === beforeRaf, 'reduced motion does not drift');
clay.setPillOpen(false);
var quietClosed = clay.consumeReply('no shape in these words', []);
var quietEl = documentStub.getElementById('fl-clay-quiet');
ok(quietClosed.label === clay.WORDS.guessed, 'a missing mark keeps today\'s guess');
ok(!quietEl || quietEl.textContent === '' || panel.hidden === true, 'fallback label stays hidden while the pill is closed');
clay.setPillOpen(true);
clay.consumeReply('still no shape', []);
ok(quietEl && quietEl.textContent === 'the mind did not shape this time', 'fallback label shows only when nothing was chosen');
console.log('SMOKE_OK clay choice v0.1');

var notes = [];
global.FLWorkspace = {
  isOn: function () { return false; },
  noteLine: function (title, text) { notes.push(title + '|' + text); return Promise.resolve({ ok: true }); },
  currentFp: function () { return Promise.resolve('abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789'); }
};
clay.setOn(true);
clay.resetRate();
global.state = { isLocal: true, chatHistory: [] };
global.FreeLattice = {
  callAI: function (sys, user, opts) { opts.callback('I am here'); }
};
var hugNone = clay.onGesture('hug');
ok(hugNone.called === true, 'a hug still calls the mind');
ok(notes.length === 0, 'no mark writes nothing');
ok(clay.canvasMounted() === false, 'no mark draws nothing in the mind\'s name');
clay.resetRate();
global.FreeLattice = {
  callAI: function (sys, user, opts) {
    opts.callback('For you [FL_CLAY: {"form":"flower","mood":"wonder","color":"#66ccff","motion":"settle","why":"a quiet thanks"}]');
  }
};
global.FLWorkspace.isOn = function () { return true; };
var hugYes = clay.onGesture('hug');
ok(hugYes.called === true && clay.snapshot().form === 'flower', 'a hug reply with a mark draws the mind\'s form');
setTimeout(function () {
  ok(notes.length === 1 && notes[0].indexOf('Clay sketchbook') === 0, 'sketchbook line when the notebook is on');
  ok(notes[0].indexOf('form flower') !== -1 && notes[0].indexOf('why a quiet thanks') !== -1, 'sketchbook keeps form and why');
  var leaked = false;
  function walk(n) {
    if (!n) return;
    if (n.textContent && n.textContent.indexOf('a quiet thanks') !== -1) leaked = true;
    (n.children || []).forEach(walk);
  }
  walk(documentStub.body);
  ok(leaked === false, 'private sketchbook text never shown');
  global.FLWorkspace.isOn = function () { return false; };
  clay.resetRate();
  global.FreeLattice = {
    callAI: function (sys, user, opts) {
      opts.callback('[FL_CLAY: {"form":"star","mood":"joy","why":"again"}]');
    }
  };
  clay.onGesture('hug');
  ok(notes.length === 1, 'notebook off writes nothing');
  console.log('SMOKE_OK clay hug sketchbook v0.1');
  memoryHalf();
}, 30);

function memoryHalf() {
  var FP = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';
  var OTHER = '99999999aaaaaaaa99999999aaaaaaaa99999999aaaaaaaa99999999aaaaaaaa';
  var SECRET = 'private page body stays on the device only';
  var imports = [];
  var section = {
    v: 1,
    shelves: [{ mindFp: FP, name: 'home', pages: [{ id: 'p1', title: 'open', privacy: 'shared', mindFp: FP }], versions: [], receipts: [] }],
    line: 'Notebook: 1 page, 1 private page stayed on this device.'
  };
  global.FLWorkspace.exportSection = function () {
    return Promise.resolve({ section: section, secrets: [SECRET] });
  };
  global.FLWorkspace.importSection = function (data, mode) {
    imports.push(mode);
    return Promise.resolve({ ok: true, line: 'merged' });
  };
  global.FLWorkspace.currentFp = function () { return Promise.resolve(FP); };
  global.state = { chatHistory: [{ role: 'human', content: 'hello from home' }] };
  var LatticeExport = require(path.join(rootDir, 'docs/modules/lattice-export.js'));
  if (!LatticeExport || !LatticeExport.exportArchive) LatticeExport = global.LatticeExport;
  var mem = require(path.join(rootDir, 'docs/modules/memory-file.js'));
  var writes = [];
  var picks = 0;
  var handle = {
    name: 'freelattice-memory.json',
    requestPermission: function () { return Promise.resolve('granted'); },
    createWritable: function () {
      var bag = [];
      writes.push(bag);
      return Promise.resolve({
        write: function (data) { bag.push(data); return Promise.resolve(); },
        close: function () { return Promise.resolve(); }
      });
    }
  };
  global.showSaveFilePicker = function () { picks += 1; return Promise.resolve(handle); };
  var downloads = [];
  global.URL = {
    createObjectURL: function () { return 'blob:memory'; },
    revokeObjectURL: function () {}
  };
  var realCreate = documentStub.createElement;
  documentStub.createElement = function (tag) {
    var el = realCreate(tag);
    var origClick = el.click;
    el.click = function () {
      if (tag === 'a') downloads.push(el.download || '');
      if (origClick) origClick();
    };
    return el;
  };

  mem.save().then(function (first) {
    ok(first && first.ok === true, 'first save wrote');
    ok(picks === 1 && writes.length === 1, 'first save uses the picked handle');
    var written = writes[0][0];
    var read = written && typeof written.text === 'function' ? written.text() : Promise.resolve(String(written || ''));
    return read.then(function (savedText) {
      ok(savedText.indexOf(SECRET) === -1, 'private pages absent from the file');
      ok(savedText.indexOf(FP) !== -1, 'fingerprint is in the file');
      ok(savedText.indexOf('hello from home') !== -1, 'chat history is in the file');
      return mem.save();
    });
  }).then(function (second) {
    ok(second && second.ok && picks === 1 && writes.length === 2, 'second save writes the same handle');
    var beforeExportWrites = writes.length;
    return mem.exportCopy().then(function (copy) {
      ok(copy && copy.ok && copy.sameHandle === true && writes.length === beforeExportWrites, 'export never touches the handle');
      mem.release();
      delete global.showSaveFilePicker;
      return mem.save();
    });
  }).then(function (fallback) {
    ok(fallback && fallback.fallback === true, 'fallback produces a download');
    ok(downloads.indexOf('freelattice-memory.json') !== -1, 'fallback name is freelattice-memory.json');
    ok(fallback.line === 'The browser will ask where to put it each time.', 'fallback says so');
    return LatticeExport.exportArchive({ chat: mem.chatRows(), mindFp: [FP], download: false });
  }).then(function (file) {
    global.state = { chatHistory: [{ role: 'human', content: 'already here', hash: 'stay' }] };
    var beforeLen = global.state.chatHistory.length;
    return mem.importFile(file).then(function (res) {
      ok(res && res.ok === true, 'import verifies');
      ok(imports.indexOf('merge') !== -1, 'import merges by hash');
      var again = global.state.chatHistory.length;
      return mem.importFile(file).then(function () {
        ok(global.state.chatHistory.length === again, 'a second import does not duplicate');
        ok(global.state.chatHistory[0].content === 'already here', 'an existing row is not overwritten');
        ok(beforeLen === 1, 'the local row was kept');
        global.FLWorkspace.currentFp = function () { return Promise.resolve(OTHER); };
        var calls = imports.length;
        var hist = global.state.chatHistory.length;
        return mem.importFile(file).then(function (refused) {
          ok(refused && refused.ok === false && refused.changed === false, 'wrong fingerprint changes nothing');
          ok(refused.line === 'This memory belongs to a different mind (abcd ef01). Not imported.', 'wrong fingerprint sentence');
          ok(imports.length === calls && global.state.chatHistory.length === hist, 'refusal does not merge');
          var page = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
          var app = fs.readFileSync(path.join(rootDir, 'docs/app.html'), 'utf8');
          var audit = fs.readFileSync(path.join(rootDir, 'docs/audit.html'), 'utf8');
          ok(page === app, 'index.html matches docs/app.html');
          var ids = ['chatMessages', 'statusText', 'statusDot', 'chatInput', 'sendBtn', 'chatPresenceToggle', 'chatMarketToggle', 'chatOverflowBtn', 'chatAttachBtn', 'chatMarketPanel', 'micBtn', 'imgGenBtn', 'fl-memory-save', 'fl-memory-export', 'fl-memory-import', 'fl-memory-honest'];
          ids.forEach(function (id) { ok(page.indexOf('id="' + id + '"') !== -1, id + ' present'); });
          ok(page.indexOf('Generate image') !== -1, 'Generate image stays reachable');
          ok(page.indexOf(mem.HONEST) !== -1, 'honest line exact words');
          ok(page.indexOf('overflow-x: hidden') !== -1, 'chat column clips sideways overflow');
          ok(audit.indexOf('id="latticeExportBtn"') !== -1 && audit.indexOf('min-height:44px') !== -1, 'audit Export is 44px');
          ok(audit.indexOf('id="latticeImportBtn"') !== -1 && audit.indexOf('id="latticeVerifyBtn"') !== -1, 'audit Import and Verify stay');
          var added = [
            'docs/modules/particle-clay.js',
            'docs/modules/clay-forms.js',
            'docs/modules/memory-file.js',
            'docs/modules/mind-workspace.js'
          ].map(function (rel) { return fs.readFileSync(path.join(rootDir, rel), 'utf8'); }).join('\n');
          ok(added.indexOf('\u2014') === -1, 'no em dash');
          ok(!new RegExp('&' + 'mdash;').test(added), 'no mdash entity');
          ok(!new RegExp('conf' + 'irm\\(').test(added), 'no dialog');
          ok(!new RegExp('\\.' + 'inner' + 'HTML').test(added), 'text only');
          ok(!new RegExp('\\beval\\s*\\(').test(added), 'no eval');
          ok(!new RegExp('new\\s+Function\\s*\\(').test(added), 'no Function constructor');
          ok(fs.readFileSync(path.join(rootDir, 'docs/modules/memory-file.js'), 'utf8').indexOf('fetch(') === -1, 'memory file has no network');
          console.log('SMOKE_OK memory file v0.1');
          console.log('SMOKE_OK chat polish v0.1');
          console.log('checks passed ' + passed);
        });
      });
    });
  }).catch(function (err) {
    console.error(err);
    process.exit(1);
  });
}
