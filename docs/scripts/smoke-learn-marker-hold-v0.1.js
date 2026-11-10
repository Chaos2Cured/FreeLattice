#!/usr/bin/env node
// Hypha's HOLD on 23a02794 (harm to Mom), made into a test from her probes disputed.js and byperson.js
// (/workspace/research/review-ai-learning-23a02794/). A mind's JSON marker can't override a person's Undo
// at once (promote:true) and can't write a person's yes (by:'person'). Run: node smoke-learn-marker-hold-v0.1.js [repo root]
'use strict';
var path = require('path');
var root = process.argv[2] || path.join(__dirname, '..', '..');
var fails = 0, oks = 0;
function ok(c, name, info) { if (c) { oks++; console.log('ok   ' + name); } else { fails++; console.log('FAIL ' + name + (info ? ' ' + JSON.stringify(info) : '')); } }
function fresh() {
  var store = {};
  global.localStorage = { getItem: function (k) { return k in store ? store[k] : null; }, setItem: function (k, v) { store[k] = String(v); }, removeItem: function (k) { delete store[k]; } };
  global.document = { visibilityState: 'visible', getElementById: function () { return null; } };
  global.requestIdleCallback = function (f) { f(); return 1; };
  ['snowflake-core.js', 'memory-compound.js', 'learn-choice.js'].forEach(function (n) { delete require.cache[require.resolve(path.join(root, 'docs/modules', n))]; });
  var core = require(path.join(root, 'docs/modules/snowflake-core.js')); global.FLSnowflakeCore = core;
  global.FLMemory = require(path.join(root, 'docs/modules/memory-compound.js'));
  var learn = require(path.join(root, 'docs/modules/learn-choice.js'));
  return { core: core, learn: learn, store: store };
}
async function undoneByMom(E) {
  var r = (await E.learn.interceptSentinel('[FL_REMEMBER: Mom secret fact | reason: r | revisit: now]', { surface: 'chat', chatId: 'a' }).queued)[0];
  var id = r.learnId;
  await E.learn.interceptSentinel('[FL_KEEP: ' + id + ' | keep]', { surface: 'chat', chatId: 'a' }).queued;
  await E.core.confirmLearning(id, { keep: false, unkeep: true, by: 'person', reason: 'Undo' });
  return id;
}
function rowOf(E, id) { return E.core.learnQueue().find(function (x) { return x.learnId === id; }); }
function exported(E, id) {
  return E.core.learnQueueJSONL().split('\n').filter(function (l) { return l.indexOf(id) !== -1 && /"status":"confirmed"/.test(l); }).length > 0;
}
function ledger(E) { return ((JSON.parse(E.store.fl_snowflake_ledger_v0 || '{"rows":[]}').rows) || []).map(function (x) { return x.kind + ':' + x.delta; }); }
(async function () {
  // Door 1 (disputed.js): promote:true in a JSON keep after Mom's Undo.
  var E = fresh(); var id = await undoneByMom(E);
  ok(rowOf(E, id).status === 'disputed' && !exported(E, id), 'mom-undo-disputes');
  var confirms0 = ledger(E).filter(function (l) { return /^learn-confirmed:/.test(l) && l.indexOf(id) !== -1; }).length;
  await E.learn.interceptSentinel('[FL_KEEP: {"text":"' + id + '","keep":true,"promote":true,"reason":"I still want it"}]', { surface: 'chat', chatId: 'a' }).queued;
  var props = E.core.learnQueue().filter(function (x) { return x.proposalOf === id; });
  ok(rowOf(E, id).status !== 'confirmed' && !exported(E, id), 'door1-json-promote-does-not-confirm', { status: rowOf(E, id).status });
  ok(props.length === 1 && props[0].status === 'cooling' && !exported(E, props[0].learnId) &&
     Date.parse(props[0].revisitAt) - Date.now() > 23.9 * 3600e3, 'door1-becomes-a-visible-disagreement-full-day',
     { proposals: props.length, until: props[0] && props[0].revisitAt });
  ok(ledger(E).filter(function (l) { return /^learn-confirmed:/.test(l) && l.indexOf(id) !== -1; }).length === confirms0, 'door1-no-new-confirm-row');
  // Door 2 (byperson.js): by:"person" in a JSON keep.
  E = fresh(); id = await undoneByMom(E);
  var personLayers0 = (rowOf(E, id).layers || []).filter(function (l) { return l.by === 'person'; }).length;
  await E.learn.interceptSentinel('[FL_KEEP: {"text":"' + id + '","keep":true,"by":"person","reason":"Let it learn"}]', { surface: 'chat', chatId: 'a' }).queued;
  var r2 = rowOf(E, id);
  var personLayers = (r2.layers || []).filter(function (l) { return l.by === 'person'; }).length;
  ok(personLayers === personLayers0 && !(r2.layers || []).some(function (l) { return l.status === 'person-yes'; }), 'door2-no-forged-person-layer', { layers: (r2.layers || []).map(function (l) { return l.status + '/' + l.by; }) });
  ok(!ledger(E).some(function (l) { return /^learn-person-yes:/.test(l); }), 'door2-no-forged-person-row');
  await E.learn.interceptSentinel('[FL_KEEP: ' + id + ' | keep]', { surface: 'chat', chatId: 'a' }).queued;
  ok(rowOf(E, id).status !== 'confirmed' && !exported(E, id), 'door2-then-plain-keep-does-not-confirm', { status: rowOf(E, id).status });
  // Only the known fields pass from a JSON marker (no mind, surface, provenance, reading).
  E = fresh();
  var j = (await E.learn.interceptSentinel('[FL_REMEMBER: {"text":"a json choice","mind":"Other","surface":"quiet","provenance":"self","reading":{"text":"x"},"revisit":"now","by":"person","promote":true}]', { surface: 'chat', chatId: 'a' }).queued)[0];
  ok(j && j.surface === 'chat' && !j.promoted && (!j.mind || j.mind !== 'Other'), 'json-marker-whitelist', j && { surface: j.surface, mind: j.mind });
  // Revisit values never throw and never go past the clamp.
  var bad = ['99999999999999', 1e20, NaN, Infinity, -1, 'abc', '3000-01-01'];
  var threw = 0, over = 0;
  for (var i = 0; i < bad.length; i++) {
    try {
      var q = await E.core.queueLearning({ text: 'rv ' + i, surface: 'chat', provenance: 'self', revisit: bad[i] });
      if (q && Date.parse(q.revisitAt) - Date.now() > 367 * 24 * 3600e3) over++;
      if (q && isNaN(Date.parse(q.revisitAt))) threw++;
    } catch (e) { threw++; }
  }
  ok(threw === 0 && over === 0, 'revisit-huge-nan-infinity-clamped', { threw: threw, over: over });
  console.log(fails ? 'MARKER_HOLD_FAIL ' + fails : 'MARKER_HOLD_OK ' + oks + ' checks');
  process.exit(fails ? 1 : 0);
})().catch(function (e) { console.log('FAIL crashed ' + (e && e.stack)); process.exit(1); });
