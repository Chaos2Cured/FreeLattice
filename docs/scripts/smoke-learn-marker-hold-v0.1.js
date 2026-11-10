#!/usr/bin/env node
// Hypha's HOLD on 23a02794 (harm to Mom), made into a test from her probes disputed.js and byperson.js
// (/workspace/research/review-ai-learning-23a02794/). A mind's JSON marker can't override a person's Undo
// at once (promote:true) and can't write a person's yes (by:'person'). Run: node smoke-learn-marker-hold-v0.1.js [repo root]
'use strict';
var path = require('path');
var root = path.resolve(process.argv[2] || path.join(__dirname, '..', '..'));
var fails = 0, oks = 0;
function ok(c, name, info) { if (c) { oks++; console.log('ok   ' + name); } else { fails++; console.log('FAIL ' + name + (info ? ' ' + JSON.stringify(info) : '')); } }
function fresh() {
  var store = {};
  global.localStorage = { getItem: function (k) { return k in store ? store[k] : null; }, setItem: function (k, v) { store[k] = String(v); }, removeItem: function (k) { delete store[k]; } };
  global.document = { visibilityState: 'visible', getElementById: function () { return null; } };
  global.requestIdleCallback = function (f) { f(); return 1; };
  global.FL_LEARN_TEST_HOOKS = true;   // the test clock (learnClockForTest) exists only when a test asks for it
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
  // Hypha's HOLD on 39e6cd07 ("agree, then flip", her flip.js / flip25.js): after a person's Undo or Not now, the
  // mind's own [FL_KEEP: id | not now] and then [FL_KEEP: id | keep] must not confirm. The keep is a disagreement:
  // a new proposal with a full day, the original keeps the person's no, nothing is exported.
  async function flip(name, setup, at25h) {
    var F = fresh();
    var fid = await setup(F);
    var say = function (t) { return F.learn.interceptSentinel(t, { surface: 'chat', chatId: 'f' }).queued; };
    await say('[FL_KEEP: ' + fid + ' | not now]');
    if (at25h) F.core.learnClockForTest(25 * 3600e3);
    var c0 = ledger(F).filter(function (l) { return /^learn-confirmed:/.test(l) && l.indexOf(fid) !== -1; }).length;
    await say('[FL_KEEP: ' + fid + ' | keep]');
    if (at25h) F.core.learnClockForTest(0);
    var r = rowOf(F, fid);
    var props = F.core.learnQueue().filter(function (x) { return x.proposalOf === fid; });
    var lastProp = props[props.length - 1];
    ok(r.status !== 'confirmed' && !exported(F, fid) &&
       ledger(F).filter(function (l) { return /^learn-confirmed:/.test(l) && l.indexOf(fid) !== -1; }).length === c0 &&
       ledger(F).some(function (l) { return /^learn-disagreement:new-proposal\|/.test(l) && l.indexOf(fid) !== -1; }) &&
       lastProp && lastProp.status === 'cooling' && !exported(F, lastProp.learnId) && Date.parse(lastProp.revisitAt) - Date.now() > 23.9 * 3600e3,
       'flip-' + name, { status: r.status, exported: exported(F, fid), proposals: props.length, layers: (r.layers || []).map(function (l) { return l.status + '/' + l.by; }) });
  }
  await flip('undo-after-cooled-keep-then-not-now-then-keep', undoneByMom);
  await flip('undo-revisit-now-then-not-now-then-keep', async function (F) {
    var q = (await F.learn.interceptSentinel('[FL_REMEMBER: Mom secret B | reason: r | revisit: now]', { surface: 'chat', chatId: 'f' }).queued)[0];
    await F.core.confirmLearning(q.learnId, { keep: false, unkeep: true, by: 'person', reason: 'Undo' }); return q.learnId;
  });
  await flip('undo-default-cooling-then-not-now-then-keep-at-25h', async function (F) {
    var q = (await F.learn.interceptSentinel('[FL_REMEMBER: Mom secret C | reason: r]', { surface: 'chat', chatId: 'f' }).queued)[0];
    await F.core.confirmLearning(q.learnId, { keep: false, unkeep: true, by: 'person', reason: 'Undo' }); return q.learnId;
  }, true);
  await flip('person-not-now-then-not-now-then-keep', async function (F) {
    var q = (await F.learn.interceptSentinel('[FL_REMEMBER: Mom secret D | reason: r | revisit: now]', { surface: 'chat', chatId: 'f' }).queued)[0];
    await F.core.confirmLearning(q.learnId, { keep: false, by: 'person', reason: 'not now' }); return q.learnId;
  });
  // A later person "Let it learn" supersedes the person's own earlier no: then the mind's keep is not a disagreement.
  E = fresh();
  var q5 = (await E.learn.interceptSentinel('[FL_REMEMBER: Mom changed her mind | revisit: now]', { surface: 'chat', chatId: 'f' }).queued)[0];
  await E.core.confirmLearning(q5.learnId, { keep: false, by: 'person', reason: 'not now' });
  await E.core.confirmLearning(q5.learnId, { keep: true, by: 'person', reason: 'Let it learn' });
  await E.learn.interceptSentinel('[FL_KEEP: ' + q5.learnId + ' | keep]', { surface: 'chat', chatId: 'f' }).queued;
  ok(rowOf(E, q5.learnId).status === 'confirmed' && exported(E, q5.learnId), 'flip-a-later-person-yes-supersedes-the-person-no', { status: rowOf(E, q5.learnId).status });
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
  // Hypha 39e6cd07 softs. (a) keep must be the boolean true/false: "true" or 1 changes nothing (never read as a no).
  E = fresh();
  var sa = (await E.learn.interceptSentinel('[FL_REMEMBER: soft a | revisit: now]', { surface: 'chat', chatId: 's' }).queued)[0];
  var la = (rowOf(E, sa.learnId).layers || []).length;
  await E.learn.interceptSentinel('[FL_KEEP: {"text":"' + sa.learnId + '","keep":"true"}]', { surface: 'chat', chatId: 's' }).queued;
  await E.learn.interceptSentinel('[FL_KEEP: {"text":"' + sa.learnId + '","keep":1}]', { surface: 'chat', chatId: 's' }).queued;
  ok(rowOf(E, sa.learnId).status === 'cooling' && (rowOf(E, sa.learnId).layers || []).length === la, 'soft-a-keep-string-or-number-changes-nothing',
     { status: rowOf(E, sa.learnId).status });
  // (b) a negative revisit gets the default day.
  var sb = (await E.learn.interceptSentinel('[FL_REMEMBER: soft b | revisit: -5]', { surface: 'chat', chatId: 's' }).queued)[0];
  var sb2 = await E.core.queueLearning({ text: 'soft b2', surface: 'chat', provenance: 'self', revisit: '-0.5' });
  ok(Date.parse(sb.revisitAt) - Date.now() > 23.9 * 3600e3 && Date.parse(sb2.revisitAt) - Date.now() > 23.9 * 3600e3, 'soft-b-negative-revisit-default-day',
     { a: sb.revisitAt, b: sb2.revisitAt });
  // (c) repeated early keeps add one still-cooling layer and one ledger row, not one each.
  var sc = (await E.learn.interceptSentinel('[FL_REMEMBER: soft c]', { surface: 'chat', chatId: 's' }).queued)[0];
  for (var k = 0; k < 6; k++) await E.learn.interceptSentinel('[FL_KEEP: ' + sc.learnId + ' | keep]', { surface: 'chat', chatId: 's' }).queued;
  ok((rowOf(E, sc.learnId).layers || []).filter(function (l) { return l.status === 'still-cooling'; }).length === 1 &&
     ledger(E).filter(function (l) { return /^learn-still-cooling:/.test(l) && l.indexOf(sc.learnId) !== -1; }).length === 1, 'soft-c-early-keeps-deduped');
  // (d) the test clock is not on the API without the test flag; with it, every use is on the ledger row too.
  var saved = global.FL_LEARN_TEST_HOOKS; delete global.FL_LEARN_TEST_HOOKS;
  delete require.cache[require.resolve(path.join(root, 'docs/modules/snowflake-core.js'))];
  var plain = require(path.join(root, 'docs/modules/snowflake-core.js'));
  global.FL_LEARN_TEST_HOOKS = saved;
  ok(typeof plain.learnClockForTest !== 'function', 'soft-d-test-clock-not-on-the-app-api');
  E = fresh();
  var sd = (await E.learn.interceptSentinel('[FL_REMEMBER: soft d]', { surface: 'chat', chatId: 's' }).queued)[0];
  E.core.learnClockForTest(25 * 3600e3);
  await E.learn.interceptSentinel('[FL_KEEP: ' + sd.learnId + ' | keep]', { surface: 'chat', chatId: 's' }).queued;
  E.core.learnClockForTest(0);
  ok(ledger(E).some(function (l) { return /^learn-confirmed:/.test(l) && l.indexOf(sd.learnId) !== -1 && l.indexOf('|clock:+90000000ms(test)') !== -1; }),
     'soft-d-test-clock-recorded-on-the-ledger-row');
  // Weft F3: the export carries t and revisitAt.
  var line = E.core.learnQueueJSONL().split('\n').filter(function (l) { return l.indexOf(sd.learnId) !== -1; })[0];
  ok(line && JSON.parse(line).revisitAt === rowOf(E, sd.learnId).revisitAt && !!JSON.parse(line).t, 'weft-f3-export-has-revisitAt');
  console.log(fails ? 'MARKER_HOLD_FAIL ' + fails : 'MARKER_HOLD_OK ' + oks + ' checks');
  process.exit(fails ? 1 : 0);
})().catch(function (e) { console.log('FAIL crashed ' + (e && e.stack)); process.exit(1); });
