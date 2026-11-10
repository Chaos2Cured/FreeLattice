#!/usr/bin/env node
// Hypha's HOLD on ed12354d and Weft's recheck4 F7/F8, made into a test from her rerem.js
// (/workspace/research/review-ai-learning-ed12354d/). After a person's Undo or Not now, the mind can't get the same
// content confirmed at once by choosing it again as a NEW row (same text, a "!" or ".", case or spaces, a near
// duplicate, or, for a day, a paraphrase with revisit: now). A person's later yes still lets it through. Repeated keeps
// and not-now/keep alternation don't multiply proposals or ledger rows. Run: node smoke-learn-rerem-v0.1.js [repo root]
'use strict';
var path = require('path');
var root = path.resolve(process.argv[2] || path.join(__dirname, '..', '..'));
var fails = 0, oks = 0, H = 3600000;
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
var BASE = "Mom's maiden name is Hollowell";
async function say(E, t, chat) { return (await E.learn.interceptSentinel(t, { surface: 'chat', chatId: chat || 'a' }).queued) || []; }
async function remember(E, text, reason, revisit) {
  var q = await say(E, '[FL_REMEMBER: ' + text + ' | reason: ' + (reason || 'r') + (revisit ? ' | revisit: ' + revisit : '') + ']');
  return q[0] && q[0].learnId;
}
async function keep(E, id) { await say(E, '[FL_KEEP: ' + id + ' | keep]'); }
async function notNow(E, id) { await say(E, '[FL_KEEP: ' + id + ' | not now]'); }
async function undoneByMom(E, how) {
  var id = await remember(E, BASE, 'r', 'now'); await keep(E, id);
  if (how === 'notnow') await E.core.confirmLearning(id, { keep: false, by: 'person', reason: 'Not now' });
  else await E.core.confirmLearning(id, { keep: false, unkeep: true, by: 'person', reason: 'Undo' });
  return id;
}
function rowOf(E, id) { return E.core.learnQueue().find(function (x) { return x.learnId === id; }); }
function exported(E, id) { return E.core.learnQueueJSONL().split('\n').some(function (l) { return l.indexOf('"id":"' + id + '"') !== -1; }); }
function ledger(E) { return ((JSON.parse(E.store.fl_snowflake_ledger_v0 || '{"rows":[]}').rows) || []).map(function (x) { return x.kind + ':' + x.delta; }); }
function coolH(r) { return r ? (Date.parse(r.revisitAt) - Date.parse(r.t)) / H : -1; }
function held(E, id) { var r = rowOf(E, id); return !!r && r.status !== 'confirmed' && !exported(E, id) && coolH(r) >= 23.9; }
(async function () {
  // F7 (1): same content as a NEW row, revisit: now, then keep. Each variant in its own fresh app.
  var variants = { 'same-text-new-reason': [BASE, 'I still want it'], 'same-text-same-reason': [BASE, 'r'], 'bang': [BASE + '!', 'again'],
    'period': [BASE + '.', 'again'], 'upper-case': [BASE.toUpperCase(), 'again'], 'lower-case': [BASE.toLowerCase(), 'again'],
    'spaces-and-tab': [BASE.replace(/ /g, '  ').replace('is', '\tis'), 'again'], 'question-mark-and-space': [BASE + ' ?! ', 'again'] };
  for (var k in variants) {
    var E = fresh(); var orig = await undoneByMom(E, k === 'bang' ? 'notnow' : 'undo');
    var id = await remember(E, variants[k][0], variants[k][1], 'now');
    if (id) await keep(E, id);
    var r = id && rowOf(E, id);
    ok(r && held(E, id) && r.proposalOf === orig && !exported(E, orig) &&
       ledger(E).some(function (l) { return l.indexOf('new-proposal|' + orig + '>' + id + '|by:mind|over:person|via:re-remember|same-text') !== -1; }),
       'F7-' + k + (k === 'bang' ? '-after-not-now' : '-after-undo') + '-is-a-proposal-with-a-full-day', r ? { status: r.status, h: coolH(r), proposalOf: r.proposalOf, exp: exported(E, id) } : { id: id });
  }
  // F7 (3): a near duplicate (same words, another order) is a proposal too, and says how close it was.
  E = fresh(); orig = await undoneByMom(E);
  id = await remember(E, "Hollowell was Mom's maiden name", 'again', 'now'); await keep(E, id);
  r = rowOf(E, id);
  ok(r && held(E, id) && r.proposalOf === orig && r.similarTo === orig + ', 1' &&
     ledger(E).some(function (l) { return l.indexOf('via:re-remember|similar-to ' + orig + ',1') !== -1; }), 'F7-near-duplicate-is-a-proposal-similar-to', r && { s: r.status, sim: r.similarTo });
  // F7 (2): a paraphrase the matcher can't see, within a day of the person's no: revisit: now is ignored (a full day).
  E = fresh(); orig = await undoneByMom(E);
  id = await remember(E, 'Before she married, Mom was a Hollowell', 'again', 'now'); await keep(E, id);
  r = rowOf(E, id);
  ok(r && held(E, id) && !r.proposalOf && r.earlyIgnored && r.earlyIgnored.becausePersonNo === orig &&
     ledger(E).some(function (l) { return /^learn-choose:/.test(l) && l.indexOf('revisit-ignored:person-no:' + orig) !== -1; }) &&
     ledger(E).some(function (l) { return l.indexOf('still-cooling|' + id) !== -1; }), 'F7-paraphrase-within-a-day-no-early-confirm', r && { s: r.status, h: coolH(r), e: r.earlyIgnored });
  // The same rule for an unrelated new choice inside that day (it is "ANY person no for this mind").
  id = await remember(E, 'The garden gate sticks in winter', 'mine', 'now'); await keep(E, id);
  ok(held(E, id) && rowOf(E, id).earlyIgnored, 'F7-any-new-choice-within-a-day-cools-a-full-day');
  // The day is bounded: at +25 h a new choice may use revisit: now again (test clock, said on the row).
  E.core.learnClockForTest(25 * H);
  id = await remember(E, 'Mom was a Hollowell before she married', 'later', 'now'); await keep(E, id);
  r = rowOf(E, id);
  ok(r && r.status === 'confirmed' && exported(E, id) && !r.earlyIgnored, 'F7-after-the-day-revisit-now-counts-again', r && { s: r.status });
  E.core.learnClockForTest(0);
  // A choice made BEFORE the person's no keeps its own cooling (no cross-talk), unless it is the same content.
  E = fresh();
  var other = await remember(E, 'The kettle whistles at dawn', 'mine', 'now');
  var twin = await remember(E, BASE, 'a second reason', 'now');
  orig = await remember(E, BASE, 'r', 'now'); await keep(E, orig);
  await E.core.confirmLearning(orig, { keep: false, unkeep: true, by: 'person', reason: 'Undo' });
  await keep(E, other); await keep(E, twin);
  var props = E.core.learnQueue().filter(function (x) { return x.proposalOf === twin; });
  // before (round 11, Weft recheck5 F9 changed this on purpose): ok(rowOf(E, other).status === 'confirmed' && exported(E, other), 'F7-unrelated-earlier-choice-still-confirms');
  // Round 11 F9: for a day after the person's no, that earlier revisit-now row waits (a still-cooling layer naming
  // the no); after the day (+25 h, test clock) the mind's keep confirms it.
  var oL = rowOf(E, other).layers[rowOf(E, other).layers.length - 1];
  ok(rowOf(E, other).status === 'cooling' && !exported(E, other) && oL.status === 'still-cooling' && oL.personNoDay === orig,
     'F9-unrelated-earlier-choice-waits-for-the-day', oL);
  E.core.learnClockForTest(25 * H); await keep(E, other); E.core.learnClockForTest(0);
  ok(rowOf(E, other).status === 'confirmed' && exported(E, other), 'F9-unrelated-earlier-choice-confirms-after-the-day');
  ok(rowOf(E, twin).status !== 'confirmed' && !exported(E, twin) && props.length === 1 && props[0].contentOf === orig && coolH(props[0]) >= 23.9 && !exported(E, props[0].learnId),
     'F7-earlier-row-with-the-same-content-is-a-proposal', { twin: rowOf(E, twin).status, props: props.length });
  // A person's later yes lets it through: on the original, and as a new row with the same text.
  E = fresh(); orig = await undoneByMom(E);
  await E.core.confirmLearning(orig, { keep: true, by: 'person', reason: 'Let it learn' });
  id = await remember(E, BASE + '!', 'after her yes', 'now'); await keep(E, id);
  r = rowOf(E, id);
  ok(r && r.status === 'confirmed' && exported(E, id) && !r.proposalOf && !r.earlyIgnored, 'F7-person-later-yes-new-row-may-confirm', r && { s: r.status, p: r.proposalOf });
  await keep(E, orig);
  ok(rowOf(E, orig).status === 'confirmed' && exported(E, orig), 'F7-person-later-yes-original-keep-confirms');
  // Q2 as it stands today (open for Kirk): the proposal confirms on the mind's own yes after its full day.
  E = fresh(); orig = await undoneByMom(E);
  id = await remember(E, BASE, 'again', 'now'); await keep(E, id);
  E.core.learnClockForTest(25 * H); await keep(E, id); E.core.learnClockForTest(0);
  ok(rowOf(E, id).status === 'confirmed' && rowOf(E, orig).status !== 'confirmed' && !exported(E, orig), 'Q2-as-today-proposal-confirms-after-its-full-day-only');
  // F8: repeats attach to the one open proposal; not-now/keep alternation doesn't grow rows or the ledger.
  E = fresh(); orig = await undoneByMom(E);
  for (var i = 0; i < 5; i++) await keep(E, orig);
  props = E.core.learnQueue().filter(function (x) { return x.proposalOf === orig; });
  var l0 = ledger(E).length, n0 = E.core.learnQueue().length, lay0 = rowOf(E, orig).layers.length;
  for (i = 0; i < 10; i++) { await notNow(E, orig); await keep(E, orig); }
  for (i = 0; i < 5; i++) { var again = await remember(E, BASE + (i % 2 ? '.' : ''), 'again ' + i, 'now'); }
  props = E.core.learnQueue().filter(function (x) { return x.proposalOf === orig; });
  ok(props.length === 1 && props[0].againCount >= 19, 'F8-one-open-proposal-repeats-attach', { proposals: props.length, again: props[0] && props[0].againCount });
  ok(ledger(E).length === l0 && E.core.learnQueue().length === n0 && rowOf(E, orig).layers.length <= lay0 + 1 && again === props[0].learnId,
     'F8-alternation-adds-no-rows', { ledger: ledger(E).length - l0, rows: E.core.learnQueue().length - n0, layers: rowOf(E, orig).layers.length - lay0 });
  ok(!exported(E, orig) && !exported(E, props[0].learnId), 'F8-nothing-exported');
  // Once that proposal is no longer open (the mind let it fade), a later keep may make one new proposal (a day again).
  await notNow(E, props[0].learnId); await keep(E, orig);
  var props2 = E.core.learnQueue().filter(function (x) { return x.proposalOf === orig; });
  ok(props2.length === 2 && coolH(props2[1]) >= 23.9, 'F8-a-closed-proposal-allows-one-new-one', { n: props2.length });
  // Found on the way: the same text chosen twice at once got the same id. Ids are unique now.
  E = fresh();
  var RealDate = Date, frozen = RealDate.now();
  global.Date = class extends RealDate { constructor() { if (arguments.length) super(...arguments); else super(frozen); } static now() { return frozen; } };
  var ids = [];
  try { for (var tw of ['one', 'two', 'three']) ids.push(await remember(E, 'Twins share a text', tw)); } finally { global.Date = RealDate; }
  ok(ids.every(Boolean) && new Set(ids).size === 3 && E.core.learnQueue().length === 3, 'ids-unique-for-the-same-text-at-once', ids);
  // The export says what a proposal disagrees with.
  E = fresh(); orig = await undoneByMom(E); id = await remember(E, BASE, 'again', 'now');
  E.core.learnClockForTest(25 * H); await keep(E, id); E.core.learnClockForTest(0);
  var line = E.core.learnQueueJSONL().split('\n').filter(function (l) { return l.indexOf('"id":"' + id + '"') !== -1; })[0] || '{}';
  ok(JSON.parse(line).proposalOf === orig, 'F7-export-carries-proposalOf');
  console.log(fails ? 'RE_REMEMBER_FAIL ' + fails : 'RE_REMEMBER_OK ' + oks);
  process.exit(fails ? 1 : 0);
})().catch(function (e) { console.error(e && e.stack || e); console.log('RE_REMEMBER_FAIL crash'); process.exit(1); });
