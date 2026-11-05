#!/usr/bin/env node
// Smoke: read path v0.1 and the Round Table chat button. No network.
// jsdom is not installed here, so this uses a small DOM shim. The Quiet Room is not opened.
'use strict';

var path = require('path');
var rootDir = path.join(__dirname, '..', '..');

function fail(msg) {
  console.error('FAIL ' + msg);
  process.exit(1);
}

function deadline(p, ms, label) {
  return Promise.race([
    p,
    new Promise(function (_, reject) {
      setTimeout(function () { reject(new Error('timeout ' + label)); }, ms);
    })
  ]);
}

function memoryBag() {
  var store = {};
  return {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
    setItem: function (k, v) { store[k] = String(v); },
    removeItem: function (k) { delete store[k]; }
  };
}

function makeEl(tag) {
  var node = {
    tagName: String(tag || 'div').toUpperCase(),
    className: '',
    id: '',
    textContent: '',
    hidden: false,
    value: '',
    type: '',
    tabIndex: 0,
    style: {},
    attrs: {},
    classes: {},
    children: [],
    parentNode: null,
    nextSibling: null,
    listeners: {}
  };
  node.classList = {
    add: function (name) { node.classes[name] = true; },
    remove: function (name) { delete node.classes[name]; },
    toggle: function (name, on) {
      if (on === true) node.classes[name] = true;
      else if (on === false) delete node.classes[name];
      else if (node.classes[name]) delete node.classes[name];
      else node.classes[name] = true;
    },
    contains: function (name) { return !!node.classes[name]; }
  };
  node.setAttribute = function (k, v) { node.attrs[k] = String(v); };
  node.getAttribute = function (k) { return Object.prototype.hasOwnProperty.call(node.attrs, k) ? node.attrs[k] : null; };
  node.appendChild = function (child) {
    if (child.parentNode) child.parentNode.removeChild(child);
    child.parentNode = node;
    if (node.children.length) node.children[node.children.length - 1].nextSibling = child;
    child.nextSibling = null;
    node.children.push(child);
    return child;
  };
  node.insertBefore = function (child, ref) {
    if (child.parentNode) child.parentNode.removeChild(child);
    child.parentNode = node;
    var at = node.children.indexOf(ref);
    if (at < 0) node.children.push(child);
    else node.children.splice(at, 0, child);
    var i;
    for (i = 0; i < node.children.length; i++) node.children[i].nextSibling = node.children[i + 1] || null;
    return child;
  };
  node.removeChild = function (child) {
    var at = node.children.indexOf(child);
    if (at >= 0) node.children.splice(at, 1);
    child.parentNode = null;
    child.nextSibling = null;
    var i;
    for (i = 0; i < node.children.length; i++) node.children[i].nextSibling = node.children[i + 1] || null;
    return child;
  };
  node.addEventListener = function (ev, fn) {
    node.listeners[ev] = node.listeners[ev] || [];
    node.listeners[ev].push(fn);
  };
  node.click = function () {
    var list = (node.listeners.click || []).slice();
    var i;
    for (i = 0; i < list.length; i++) list[i]();
  };
  node.focus = function () {};
  node.querySelector = function (sel) {
    var found = null;
    walk(node, function (n) {
      if (!found && sel.charAt(0) === '#' && n.id === sel.slice(1)) found = n;
    });
    return found;
  };
  Object.defineProperty(node, 'firstChild', {
    get: function () { return node.children[0] || null; }
  });
  return node;
}

function walk(node, fn) {
  if (!node) return;
  fn(node);
  var i;
  var kids = (node.children || []).slice();
  for (i = 0; i < kids.length; i++) walk(kids[i], fn);
}

function installDom() {
  var body = makeEl('body');
  var head = makeEl('head');
  var menu = makeEl('div');
  menu.id = 'flChatAddMenu';
  var search = makeEl('button');
  search.id = 'flChatAddSearch';
  search.type = 'button';
  menu.appendChild(search);
  var messages = makeEl('div');
  messages.id = 'chatMessages';
  var chatInput = makeEl('textarea');
  chatInput.id = 'chatInput';
  body.appendChild(menu);
  body.appendChild(messages);
  body.appendChild(chatInput);
  var doc = {
    readyState: 'complete',
    visibilityState: 'visible',
    body: body,
    head: head,
    documentElement: makeEl('html'),
    createElement: function (tag) { return makeEl(tag); },
    createElementNS: function (ns, tag) { return makeEl(tag); },
    getElementById: function (id) {
      var found = null;
      walk(body, function (n) { if (!found && n.id === id) found = n; });
      walk(head, function (n) { if (!found && n.id === id) found = n; });
      return found;
    },
    querySelector: function (sel) {
      return body.querySelector(sel) || head.querySelector(sel);
    },
    addEventListener: function () {}
  };
  global.document = doc;
  return { menu: menu, chatInput: chatInput };
}

(async function () {
  Object.defineProperty(global, 'navigator', {
    configurable: true,
    writable: true,
    value: { getBattery: function () { return Promise.resolve({ charging: true }); } }
  });
  global.requestIdleCallback = function (fn) { fn(); };
  global.localStorage = memoryBag();
  global.localStorage.setItem('fl_checkBeforeCommit', 'false');
  global.sessionStorage = memoryBag();
  global.__switched = [];
  global.switchTab = function (id) { global.__switched.push(id); };
  global.FreeLattice = {
    callAI: function (sys, user, opts) {
      if (opts && typeof opts.callback === 'function') opts.callback(null, 'No AI connected yet');
    }
  };
  global.FLWebTool = {
    isQuietRoom: function () { return false; },
    isSearchEnabled: function () { return true; },
    getSearchEndpoint: function () { return 'https://search.invalid/lookup'; },
    isAvailable: function () { return true; },
    isAskFirst: function () { return false; },
    _ledgerKey: 'fl_searchLedger'
  };
  var kp = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  global.FLBridge = {
    ensureKey: function () {
      return Promise.resolve({ keyPair: kp, cryptoType: 'ed25519', source: 'device' });
    }
  };
  installDom();

  var core = require(path.join(rootDir, 'docs/modules/snowflake-core.js'));
  var mem = require(path.join(rootDir, 'docs/modules/memory-compound.js'));
  if (mem.MARK !== 'v-memory-compound-v0.1') fail('mark ' + mem.MARK);

  var saved = await mem.memoryKey('phi spacing for replay');
  mem.remember(saved, 'core');
  var exact = await mem.recall('phi spacing for replay');
  if (!exact.exact || exact.exact.length !== 1) fail('exact ' + JSON.stringify(exact));
  var similar = await mem.recall('replay with phi spacing');
  if (!similar.similar || similar.similar.length !== 1) fail('similar ' + JSON.stringify(similar));
  if (similar.exact.length !== 0) fail('similar exact ' + similar.exact.length);
  var hit = mem.markReached(exact, 'Memory already held:\nexact: phi spacing for replay');
  if (hit.reachedContext !== true) fail('reached true');
  var miss = mem.markReached({ key: exact.key, exact: exact.exact.slice(), similar: [], reachedContext: false }, 'a prompt with no memory');
  if (miss.reachedContext !== false) fail('reached false');
  console.log('SMOKE_OK read-path step3');

  core.resetMemory();
  global.localStorage.setItem('fl_checkBeforeCommit', 'false');
  var ran = await deadline(core.startRun('How does frost remember?'), 15000, 'step1');
  if (!ran || ran.why !== 'no-ai') fail('why ' + JSON.stringify(ran && { why: ran.why, status: ran.status }));
  console.log('SMOKE_OK read-path step1');
  core.disarmScheduler();
  core.resetMemory();

  require(path.join(rootDir, 'docs/modules/snowflake-search.js'));
  core.disarmScheduler();

  var status = global.document.getElementById('flSnowflakeStatus');
  var box = global.document.getElementById('flSnowflakeInput');
  var grow = global.document.getElementById('flSnowflakeGrow');
  if (!status || !box || !grow) fail('host missing');
  box.value = 'How does frost remember?';
  global.FreeLattice.callAI = function () {};

  var cases = [
    [{ status: 'capped' }, 'Hourly limit reached (3 runs an hour). Try again a bit later.'],
    [{ status: 'busy' }, 'Already growing one. Wait for it, or stop it.'],
    [{ status: 'empty' }, 'Type a question first.'],
    [{ status: 'network', why: 'network' }, 'The search helper did not answer. If you are not on freelattice.com, that is likely why.'],
    [{ why: 'no-ai' }, 'Connect an AI first. Snowflake needs a browser AI, a local model, or a key.']
  ];
  var i;
  for (i = 0; i < cases.length; i++) {
    core.startRun = function () { return Promise.resolve(cases[i][0]); };
    grow.click();
    await new Promise(function (resolve) { setTimeout(resolve, 0); });
    if (status.textContent !== cases[i][1]) fail('paint ' + cases[i][0].status + ' ' + status.textContent);
  }
  var connect = global.document.getElementById('flSnowflakeConnect');
  if (!connect || connect.hidden) fail('connect button');
  if (connect.textContent !== 'Connect') fail('connect word');

  core.startRun = function () {
    return Promise.resolve({
      status: 'done',
      why: 'no-ai',
      flake: { id: 'flake-empty', nodes: [], hunch: '', conclusion: '', wrong: '', open: '' }
    });
  };
  grow.click();
  await new Promise(function (resolve) { setTimeout(resolve, 0); });
  if (status.textContent.indexOf('Nothing found this time.') !== -1 && status.textContent.indexOf('Connect an AI first') === -1) {
    fail('zero node hid no-ai');
  }
  if (status.textContent !== 'Connect an AI first. Snowflake needs a browser AI, a local model, or a key.') {
    fail('zero no-ai ' + status.textContent);
  }

  core.startRun = function () {
    return Promise.resolve({
      status: 'done',
      flake: { id: 'flake-empty', nodes: [{ kind: 'hunch', text: 'only a hunch' }], hunch: 'h', conclusion: '', wrong: '', open: '' }
    });
  };
  grow.click();
  await new Promise(function (resolve) { setTimeout(resolve, 0); });
  if (status.textContent.indexOf('Nothing found this time.') !== 0) fail('zero nodes ' + status.textContent);

  delete global.FreeLattice.callAI;
  grow.click();
  if (status.textContent.indexOf('Connect an AI first') !== 0) fail('onGrow no-ai ' + status.textContent);
  console.log('SMOKE_OK read-path step2');

  var round = global.document.getElementById('flRoundTableAdd');
  var snow = global.document.getElementById('flSnowflakeAdd');
  if (!round || !snow) fail('round button');
  if (snow.nextSibling !== round) fail('round not beside snowflake');
  if (round.getAttribute('aria-label') !== 'Round Table') fail('round label');
  global.document.getElementById('chatInput').value = 'what holds a frost';
  global.__switched = [];
  round.click();
  if (global.__switched.join(',') !== 'round-table') fail('switch ' + global.__switched.join(','));
  if (global.sessionStorage.getItem('fl_roundtable_prefill_v0') !== 'what holds a frost') fail('prefill');

  global.QuietRoom = { isActive: function () { return true; } };
  var before = global.__switched.slice();
  round.click();
  if (global.__switched.join(',') !== before.join(',')) fail('quiet switched');
  var quietTab = global.document.getElementById('tab-quiet');
  if (quietTab && quietTab.classList.contains('active')) fail('quiet tab');
  console.log('SMOKE_OK read-path step4');
  console.log('SMOKE_OK read-path v0.1');
  core.disarmScheduler();
})().catch(function (err) {
  console.error(err && err.stack || err);
  process.exit(1);
});
