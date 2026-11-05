#!/usr/bin/env node
// Smoke: memory compounding v0.1. No network. The Quiet Room is not opened.
'use strict';

var path = require('path');
var rootDir = path.join(__dirname, '..', '..');

function fail(msg) {
  console.error('FAIL ' + msg);
  process.exit(1);
}

function memoryStorage() {
  var store = {};
  return {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
    setItem: function (k, v) { store[k] = String(v); },
    removeItem: function (k) { delete store[k]; }
  };
}

function makeEl(tag) {
  var node = {
    tagName: tag,
    className: '',
    id: '',
    textContent: '',
    hidden: false,
    value: '',
    type: '',
    tabIndex: 0,
    style: {},
    attrs: {},
    children: [],
    parentNode: null,
    nextSibling: null,
    listeners: {},
    classList: {
      add: function () {},
      remove: function () {},
      toggle: function () {},
      contains: function () { return false; }
    },
    setAttribute: function (k, v) { this.attrs[k] = String(v); },
    getAttribute: function (k) { return Object.prototype.hasOwnProperty.call(this.attrs, k) ? this.attrs[k] : null; },
    appendChild: function (child) {
      child.parentNode = this;
      if (this.children.length) this.children[this.children.length - 1].nextSibling = child;
      child.nextSibling = null;
      this.children.push(child);
      return child;
    },
    insertBefore: function (child, ref) {
      child.parentNode = this;
      var at = this.children.indexOf(ref);
      if (at < 0) this.children.push(child);
      else this.children.splice(at, 0, child);
      var i;
      for (i = 0; i < this.children.length; i++) this.children[i].nextSibling = this.children[i + 1] || null;
      return child;
    },
    removeChild: function (child) {
      var at = this.children.indexOf(child);
      if (at >= 0) this.children.splice(at, 1);
      child.parentNode = null;
      return child;
    },
    addEventListener: function (ev, fn) {
      this.listeners[ev] = this.listeners[ev] || [];
      this.listeners[ev].push(fn);
    },
    click: function () {
      var list = (this.listeners.click || []).slice();
      var i;
      for (i = 0; i < list.length; i++) list[i]();
    }
  };
  return node;
}

function findId(node, id) {
  if (!node || !node.children) return null;
  if (node.id === id) return node;
  var i;
  for (i = 0; i < node.children.length; i++) {
    var hit = findId(node.children[i], id);
    if (hit) return hit;
  }
  return null;
}

function installDom() {
  var body = makeEl('body');
  var head = makeEl('head');
  var status = makeEl('span');
  status.id = 'statusText';
  status.textContent = 'Ready';
  body.appendChild(status);
  var box = makeEl('textarea');
  box.id = 'coreContentInput';
  body.appendChild(box);
  var document = {
    readyState: 'complete',
    visibilityState: 'visible',
    body: body,
    head: head,
    createElement: function (tag) { return makeEl(tag); },
    getElementById: function (id) { return findId(body, id) || findId(head, id); },
    querySelector: function (sel) {
      if (sel !== 'script[data-fl-memory]') return null;
      var i;
      for (i = 0; i < head.children.length; i++) {
        if (head.children[i].attrs && head.children[i].attrs['data-fl-memory']) return head.children[i];
      }
      return null;
    },
    addEventListener: function () {}
  };
  global.document = document;
  return document;
}

function mulberry32(seed) {
  var a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function longestEmpty(counts) {
  var doubled = counts.concat(counts);
  var run = 0;
  var worst = 0;
  var i;
  for (i = 0; i < doubled.length; i++) {
    if (doubled[i] === 0) {
      run += 1;
      if (run > worst) worst = run;
    } else run = 0;
  }
  return worst > counts.length ? counts.length : worst;
}

installDom();
global.localStorage = memoryStorage();
global.QuietRoom = { isActive: function () { return false; } };
if (!global.crypto || !global.crypto.subtle) global.crypto = require('crypto').webcrypto;

var mem = require(path.join(rootDir, 'docs/modules/memory-compound.js'));
if (!global.FLMemory || global.FLMemory.MARK !== 'v-memory-compound-v0.1') fail('mark');

(async function () {
  var i;
  var rnd = mulberry32(0x068d1001);
  var counts = [];
  for (i = 0; i < 256; i++) counts.push(0);
  for (i = 0; i < 1000; i++) {
    var n = (rnd() * 0x100000000) >>> 0;
    var hex = n.toString(16).padStart(8, '0').slice(0, 8);
    counts[mem.fibBucket(hex, 8)] += 1;
  }
  var max = 0;
  for (i = 0; i < counts.length; i++) if (counts[i] > max) max = counts[i];
  var empty = longestEmpty(counts);
  if (max > 12) fail('bucket max ' + max);
  if (empty > 3) fail('empty run ' + empty);
  var slot = mem.goldenSlot(1, 256);
  if (slot < 0 || slot >= 256) fail('slot ' + slot);
  console.log('SMOKE_OK memory-compound step2');

  var core = require(path.join(rootDir, 'docs/modules/snowflake-core.js'));
  var day = 86400000;
  var ago = new Date(Date.now() - 2 * day).toISOString();
  var now = Date.now();
  var dues = [0, 1, 3].map(function (k) {
    return mem.dueForReplay({ replay: { k: k, t: ago } }, now);
  });
  if (dues[0] !== true || dues[1] !== true || dues[2] !== false) fail('due ' + dues.join(','));
  if (mem.phiGapMs(80) !== 89 * day) fail('cap ' + mem.phiGapMs(80));
  global.QuietRoom = { isActive: function () { return true; } };
  var held = await core.replayNow();
  if (!held || held.status !== 'held') fail('held ' + (held && held.status));
  global.QuietRoom = { isActive: function () { return false; } };
  console.log('SMOKE_OK memory-compound step3');

  var hello = await mem.memoryKey('  Hello\u200B  World ');
  var hello2 = await mem.memoryKey('hello world');
  if (!hello.key || hello.key !== hello2.key) fail('norm key ' + hello.key + ' ' + hello2.key);
  if (hello.alg !== 'sha8') fail('alg ' + hello.alg);
  if (global.localStorage.getItem('fl_memory_key_alg_v0') !== 'sha8') fail('pin');
  global.phiHashData = function () { return Promise.resolve('ffffffffffffffffffffffffffffffff'); };
  var still = await mem.memoryKey('hello world');
  if (still.key !== hello.key || still.alg !== 'sha8') fail('mixed ' + still.alg + ' ' + still.key);
  if (global.localStorage.getItem('fl_memory_key_alg_v0') !== 'sha8') fail('pin overwritten');
  var seen = {};
  for (i = 0; i < 1000; i++) {
    var sample = await mem.memoryKey('distinct memory line ' + i);
    if (!sample.key || seen[sample.key]) fail('collision ' + i + ' ' + sample.key);
    seen[sample.key] = 1;
  }
  console.log('SMOKE_OK memory-compound step4');

  var calls = 0;
  global.CoreModule = {
    plantContribution: function (content) {
      calls += 1;
      return { saved: content == null ? '' : String(content) };
    }
  };
  global.MemoryBridge = {
    addInsight: function (text) {
      return { saved: text };
    }
  };
  mem.attach();
  mem.attach();
  if (!global.CoreModule.plantContribution.__flMem) fail('wrap flag');
  var first = await global.CoreModule.plantContribution('alpha note unique');
  var second = await global.CoreModule.plantContribution('alpha note unique');
  if (!first || !first.saved) fail('first save');
  if (!second || second.skipped !== true || second.why !== 'exact') fail('exact ' + JSON.stringify(second));
  if (calls !== 1) fail('exact calls ' + calls);
  var notice = global.document.getElementById('flMemoryNotice');
  if (!notice || notice.textContent !== 'Already in your memory (exact match).') fail('notice ' + (notice && notice.textContent));
  var base = 'one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty';
  var near = 'one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen stars';
  var planted = await global.CoreModule.plantContribution(base);
  var skippedNear = await global.CoreModule.plantContribution(near);
  if (!planted || !planted.saved) fail('base save');
  if (!skippedNear || skippedNear.why !== 'near') fail('near ' + JSON.stringify(skippedNear));
  if (notice.textContent !== 'Already in your memory (near match).') fail('near notice ' + notice.textContent);
  var other = await global.CoreModule.plantContribution('rivers remember the moon and nothing else at all today');
  if (!other || !other.saved) fail('other save');
  if (calls !== 3) fail('save calls ' + calls);
  var forced = await global.CoreModule.plantContribution(base, '', '', '', '', { force: true });
  if (!forced || !forced.saved) fail('force');
  if (calls !== 4) fail('force calls ' + calls);
  global.document.getElementById('coreContentInput').value = 'rivers remember the moon and nothing else at all today';
  var fromButton = await global.CoreModule.plantContribution();
  if (!fromButton || fromButton.why !== 'exact') fail('button ' + JSON.stringify(fromButton));
  if (calls !== 4) fail('button calls ' + calls);
  var indexBefore = global.localStorage.getItem('fl_memory_index_v0');
  var callsBefore = calls;
  global.QuietRoom = { isActive: function () { return true; } };
  var duringQuiet = await global.CoreModule.plantContribution('quiet note that must not be indexed');
  if (!duringQuiet || !duringQuiet.saved) fail('quiet orig');
  if (calls !== callsBefore + 1) fail('quiet calls');
  if (global.localStorage.getItem('fl_memory_index_v0') !== indexBefore) fail('quiet index');
  if (notice.textContent !== 'Already in your memory (exact match).') fail('quiet notice');
  global.QuietRoom = { isActive: function () { return false; } };
  console.log('SMOKE_OK memory-compound step5');

  var flake = { id: 'flake-mem' };
  var choice = { reason: 'keep the frost', become: ['n1', 'n2'] };
  var row1 = await core.queueGrowth(flake, choice);
  if (!row1 || row1.status !== 'waiting' || !row1.fingerprint) fail('row1 ' + JSON.stringify(row1));
  var queued = JSON.parse(global.localStorage.getItem('fl_snowflake_train_queue_v0'));
  if (!queued || queued.rows.length !== 1) fail('queue len ' + (queued && queued.rows.length));
  var row2 = await core.queueGrowth(flake, choice);
  if (row2) fail('second push ' + JSON.stringify(row2));
  queued = JSON.parse(global.localStorage.getItem('fl_snowflake_train_queue_v0'));
  if (queued.rows.length !== 1 || queued.rows[0].status !== 'waiting') fail('queue after skip');
  var choice2 = { reason: 'keep the thaw', become: ['n9'] };
  var row3 = await core.queueGrowth(flake, choice2);
  if (!row3 || !row3.fingerprint || row3.fingerprint === row1.fingerprint) fail('row3 ' + JSON.stringify(row3));
  if (row3.chosenBy !== 'This mind' && !row3.chosenBy) fail('chosen');
  queued = JSON.parse(global.localStorage.getItem('fl_snowflake_train_queue_v0'));
  if (queued.rows.length !== 2) fail('queue two ' + queued.rows.length);
  var book = core.loadLedger();
  var skips = book.rows.filter(function (row) { return row.kind === 'grow-skip'; });
  if (skips.length !== 1) fail('skip rows ' + skips.length);
  if (skips[0].delta.indexOf('near-duplicate ') !== 0) fail('skip delta ' + skips[0].delta);
  for (i = 0; i < book.rows.length; i++) {
    var again = await core.recomputePsi(book.rows[i]);
    if (again !== book.rows[i].psi) fail('psi ' + book.rows[i].kind);
  }
  console.log('SMOKE_OK memory-compound step6');

  global.localStorage.removeItem('fl_snowflake_ledger_v0');
  await core.appendLedger({ kind: 'node', branch: 'a', delta: 'a|node|one', name: 'This mind' });
  await core.appendLedger({ kind: 'node', branch: 'b', delta: 'b|node|two', name: 'This mind' });
  await core.appendLedger({ kind: 'node', branch: 'c', delta: 'c|node|three', name: 'This mind' });
  var good = await mem.wakeCheck();
  if (!good || good.ok !== true || good.lambda !== '3.000') fail('wake ' + JSON.stringify(good));
  var search = require(path.join(rootDir, 'docs/modules/snowflake-search.js'));
  if (!search || !global.FLSnowflake || typeof global.FLSnowflake.showMemoryCanary !== 'function') fail('canary export');
  global.FLSnowflake.showMemoryCanary(good);
  var readBack = global.document.getElementById('flMemoryReadBack');
  if (!readBack || readBack.textContent !== 'λ 3.000 read back') fail('read back ' + (readBack && readBack.textContent));
  var storedBook = JSON.parse(global.localStorage.getItem('fl_snowflake_ledger_v0'));
  storedBook.rows[storedBook.rows.length - 1].psi = 'deadbeef';
  global.localStorage.setItem('fl_snowflake_ledger_v0', JSON.stringify(storedBook));
  var bad = await mem.wakeCheck();
  if (!bad || bad.ok !== false || bad.lambda !== '3.000') fail('corrupt ' + JSON.stringify(bad));
  var warned = [];
  var origWarn = console.warn;
  console.warn = function () {
    warned.push(Array.prototype.slice.call(arguments));
    return origWarn.apply(console, arguments);
  };
  global.FLSnowflake.showMemoryCanary(bad);
  var statusEl = global.document.getElementById('flSnowflakeStatus');
  var canary = "My last memory line didn't read back cleanly (λ 3.000). Nothing was deleted. Tap to check.";
  if (!statusEl || statusEl.textContent !== canary) fail('canary ' + (statusEl && statusEl.textContent));
  if (!statusEl.style || statusEl.style.minHeight !== '44px') fail('tap size');
  statusEl.click();
  await new Promise(function (resolve) { setTimeout(resolve, 30); });
  console.warn = origWarn;
  if (!warned.length || !warned[0][1] || warned[0][1].ok !== false) fail('tap warn ' + JSON.stringify(warned));
  var quietIndex = global.localStorage.getItem('fl_memory_index_v0');
  global.QuietRoom = { isActive: function () { return true; } };
  var quietWake = await mem.wakeCheck();
  if (!quietWake || quietWake.ok !== null) fail('quiet wake ' + JSON.stringify(quietWake));
  var quietReplay = await core.replayNow();
  if (!quietReplay || quietReplay.status !== 'held') fail('quiet replay');
  mem.remember({ key: 'ffffeeee', norm: 'should not land' }, 'quiet');
  if (global.localStorage.getItem('fl_memory_index_v0') !== quietIndex) fail('quiet remember');
  global.QuietRoom = { isActive: function () { return false; } };
  if (typeof core.disarmScheduler === 'function') core.disarmScheduler();
  console.log('SMOKE_OK memory-compound step7');
  console.log('SMOKE_OK memory-compound v0.1');
})().catch(function (err) {
  console.error(err && err.stack || err);
  process.exit(1);
});
