#!/usr/bin/env node
// Round 11 (Weft recheck5 F9; Hypha's HOLD (A) and (B) on 3d9b062a): ONE confirm gate. On every mind keep / second yes,
// proposals included: a matching person no newer than the row's start makes it a disagreement, and for a day after
// any person no a row that cooled less than a day waits until that no + 24 h. A repeat attaches to an open proposal
// only when the text is the same; a correction ("May 5", "not allergic") is its own row. Must fail on 3d9b062.
// Run: node smoke-learn-confirm-gate-v0.1.js [repo root]
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
var E;
function rowText(r) { return ((r && r.items) || []).map(function (x) { return x.output || x.response || ''; }).join(' '); }
function personNo(E, id) { var ls = rowOf(E, id).layers, i; for (i = ls.length - 1; i >= 0; i--) if (ls[i].by === 'person' && /^(faded|unkept)$/.test(ls[i].status)) return ls[i]; return {}; }
(async function () {
  var r, id, orig, P, L;
  // ---- (A) Weft recheck5 F9: a row chosen BEFORE the person's no, a paraphrase the matcher can't see (J < 0.8).
  E = fresh();
  var pre = await remember(E, 'The entrance to the garden is the green gate', 'mine', 'now');
  orig = await remember(E, 'The garden door is the green gate', 'r', 'now'); await keep(E, orig);
  await E.core.confirmLearning(orig, { keep: false, unkeep: true, by: 'person', reason: 'Undo' });
  await keep(E, pre);
  r = rowOf(E, pre); L = r.layers[r.layers.length - 1];
  ok(r.status === 'cooling' && !exported(E, pre) && L.status === 'still-cooling' && L.personNoDay === orig &&
     Date.parse(L.until) - Date.parse(personNo(E, orig).t) >= 24 * H - 5 &&
     ledger(E).some(function (l) { return l.indexOf('still-cooling|' + pre + '|until:') !== -1 && l.indexOf('|person-no-day:' + orig) !== -1; }),
     'F9-garden-gate-paraphrase-chosen-before-the-undo-waits-a-day-from-the-no', { s: r.status, L: L });
  E.core.learnClockForTest(25 * H); await keep(E, pre); E.core.learnClockForTest(0);
  ok(rowOf(E, pre).status === 'confirmed' && exported(E, pre), 'F9-after-that-day-it-may-confirm (the stated paraphrase limit)');
  // A row the mind gave a full day itself is not held longer.
  E = fresh();
  var fullDay = await remember(E, 'The pond freezes in January', 'mine');
  orig = await undoneByMom(E);
  E.core.learnClockForTest(24 * H + 60000); await keep(E, fullDay); E.core.learnClockForTest(0);
  ok(rowOf(E, fullDay).status === 'confirmed', 'F9-a-row-that-cooled-a-full-day-is-not-held-again');
  // ---- (A) Hypha 3d9b062a: X and Y have the same text. Mom undoes X; the mind keeps X -> P. A day passes. Mom undoes
  // Y (0 min ago). The mind keeps P: it must NOT confirm (a new proposal, a full day from now).
  E = fresh();
  var Y = await remember(E, BASE, 'reason y', 'now');
  var X = await remember(E, BASE, 'reason x', 'now'); await keep(E, X);
  await E.core.confirmLearning(X, { keep: false, unkeep: true, by: 'person', reason: 'Undo' });
  P = await E.core.confirmLearning(X, { keep: true, by: 'mind', reason: 'still' });
  ok(P && P.proposalOf === X && P.status === 'cooling', 'XYP-setup-the-keep-of-X-is-proposal-P', P && { p: P.proposalOf });
  E.core.learnClockForTest(25 * H);
  await E.core.confirmLearning(Y, { keep: false, unkeep: true, by: 'person', reason: 'Undo' });
  await keep(E, P.learnId);
  E.core.learnClockForTest(0);
  var P2 = E.core.learnQueue().filter(function (x) { return x.proposalOf === P.learnId; });
  ok(rowOf(E, P.learnId).status !== 'confirmed' && !exported(E, P.learnId) && P2.length === 1 && P2[0].contentOf === Y && coolH(P2[0]) >= 23.9 &&
     ledger(E).some(function (l) { return l.indexOf('new-proposal|' + P.learnId + '>' + P2[0].learnId) !== -1 && l.indexOf('content-of:' + Y) !== -1; }),
     'XYP-a-fresh-person-no-on-Y-stops-the-keep-of-P', { s: rowOf(E, P.learnId).status, p2: P2.length });
  // Control (Q2 as today): without Y's undo, P confirms after its day.
  E = fresh();
  X = await remember(E, BASE, 'reason x', 'now'); await keep(E, X);
  await E.core.confirmLearning(X, { keep: false, unkeep: true, by: 'person', reason: 'Undo' });
  P = await E.core.confirmLearning(X, { keep: true, by: 'mind', reason: 'still' });
  E.core.learnClockForTest(25 * H); await keep(E, P.learnId); E.core.learnClockForTest(0);
  ok(rowOf(E, P.learnId).status === 'confirmed' && !exported(E, X), 'XYP-control-without-a-new-no-P-confirms-after-its-day');
  // Near duplicate: Y is a reordering (similar-to), undone after P began: P waits too.
  E = fresh();
  Y = await remember(E, "Hollowell was Mom's maiden name", 'reason y', 'now');
  X = await remember(E, BASE, 'reason x', 'now'); await keep(E, X);
  await E.core.confirmLearning(X, { keep: false, unkeep: true, by: 'person', reason: 'Undo' });
  P = await E.core.confirmLearning(X, { keep: true, by: 'mind', reason: 'still' });
  E.core.learnClockForTest(25 * H);
  await E.core.confirmLearning(Y, { keep: false, unkeep: true, by: 'person', reason: 'Undo' });
  await keep(E, P.learnId); E.core.learnClockForTest(0);
  ok(rowOf(E, P.learnId).status !== 'confirmed' && !exported(E, P.learnId), 'XYP-near-duplicate-Y-undone-later-stops-P too');
  // Tie at the same millisecond goes to the person (Y's no at exactly P's start).
  E = fresh();
  var RealDate = Date, frozen = RealDate.now();
  global.Date = class extends RealDate { constructor() { if (arguments.length) super(...arguments); else super(frozen); } static now() { return frozen; } };
  try {
    Y = await remember(E, BASE, 'reason y', 'now');
    X = await remember(E, BASE, 'reason x', 'now'); await keep(E, X);
    await E.core.confirmLearning(X, { keep: false, unkeep: true, by: 'person', reason: 'Undo' });
    P = await E.core.confirmLearning(X, { keep: true, by: 'mind', reason: 'still' });
    await E.core.confirmLearning(Y, { keep: false, unkeep: true, by: 'person', reason: 'Undo' });
  } finally { global.Date = RealDate; }
  E.core.learnClockForTest(25 * H); await keep(E, P.learnId); E.core.learnClockForTest(0);
  ok(P && P.t === personNo(E, Y).t && rowOf(E, P.learnId).status !== 'confirmed' && !exported(E, P.learnId), 'tie-at-the-same-ms-goes-to-the-person', P && { pt: P.t, yt: personNo(E, Y).t });
  // ---- (B) Hypha 3d9b062a: attach to an open proposal only when the text is the same; a correction is its own row.
  async function openThenSay(first, second) {
    var E2 = fresh(); var o = await remember(E2, first, 'r', 'now'); await keep(E2, o);
    await E2.core.confirmLearning(o, { keep: false, unkeep: true, by: 'person', reason: 'Undo' });
    var p = await remember(E2, first, 'again', 'now');
    var n0 = ledger(E2).length;
    var c = await remember(E2, second, 'a correction', 'now');
    return { E: E2, orig: o, p: p, c: c, newLedger: ledger(E2).slice(n0) };
  }
  var R = await openThenSay("Mom's birthday is on May 4", "Mom's birthday is on May 5");
  r = rowOf(R.E, R.c);
  ok(R.c && R.c !== R.p && r && /May 5/.test(rowText(r)) && !r.proposalOf && r.earlyIgnored && R.newLedger.some(function (l) { return l.indexOf('learn-choose:') === 0 && l.indexOf(R.c) !== -1; }) &&
     (rowOf(R.E, R.p).againCount || 0) === 0 && R.E.core.textSimilarity("Mom's birthday is on May 4", "Mom's birthday is on May 5") === 0,
     'B-May-4-vs-May-5-the-correction-is-its-own-row-with-a-ledger-row', { c: R.c, p: R.p, led: R.newLedger });
  R = await openThenSay('Mom is allergic to peanuts', 'Mom is not allergic to peanuts');
  r = rowOf(R.E, R.c);
  ok(R.c && R.c !== R.p && r && /not allergic/.test(rowText(r)) && !r.proposalOf && R.newLedger.length >= 1 && (rowOf(R.E, R.p).againCount || 0) === 0,
     'B-allergic-vs-not-allergic-is-its-own-row', { c: R.c, p: R.p });
  ok(R.E.core.textSimilarity('Mom is allergic to peanuts', "Mom isn't allergic to peanuts") === 0 && R.E.core.textSimilarity('Mom is allergic to peanuts', 'Mom is never allergic to peanuts') === 0 &&
     R.E.core.textSimilarity("Mom isn't allergic to peanuts", 'Mom is not allergic to peanuts') === 1, "B-not-no-never-and-n't-are-content");
  // A near duplicate (>= 0.8, not the same text) while a proposal is open: stored as its own proposal, a ledger row.
  R = await openThenSay("The lantern in Kirk's garden is named Veloria", "Veloria is the name of the lantern in Kirk's garden");
  r = rowOf(R.E, R.c);
  ok(R.c && R.c !== R.p && r && r.proposalOf === R.orig && /^Veloria is the name/.test(rowText(r)) && r.similarTo && coolH(r) >= 23.9 &&
     R.newLedger.some(function (l) { return l.indexOf('new-proposal|' + R.orig + '>' + R.c) !== -1; }) && (rowOf(R.E, R.p).againCount || 0) === 0,
     'B-a-near-duplicate-correction-is-stored-while-a-proposal-is-open', { c: R.c, p: R.p, sim: r && r.similarTo });
  // The same text still attaches (F8 stays closed), even after a correction was stored.
  var again = await remember(R.E, "The lantern in Kirk's garden is named Veloria!", 'again 2', 'now');
  ok(again === R.p && rowOf(R.E, R.p).againCount === 1, 'B-the-same-text-still-attaches-to-its-open-proposal', { again: again, p: R.p });
  // ---- Softs: lookalike letters, zero-width spaces and combining marks are folded for matching.
  E = fresh(); orig = await undoneByMom(E);
  var tricks = { cyrillic: BASE.replace('o', '\u043e'), zwsp: BASE.replace('maiden', 'mai\u200bden'), combining: BASE.replace('e', 'e\u0301') };
  for (var k in tricks) {
    id = await remember(E, tricks[k], 'again ' + k, 'now'); await keep(E, id);
    r = rowOf(E, id);
    ok(r && r.proposalOf === orig && held(E, id) && (r.similarTo || '').indexOf(', 1') !== -1, 'soft-' + k + '-is-matched-as-content', r && { p: r.proposalOf, sim: r.similarTo });
  }
  // A row made while a test moved the clock says so.
  E = fresh(); E.core.learnClockForTest(5 * H); id = await remember(E, 'A clock test row', 'r'); E.core.learnClockForTest(0);
  ok(rowOf(E, id).clockInjectedMs === 5 * H && rowOf(E, id).layers[0].clockInjectedMs === 5 * H, 'soft-a-row-made-under-a-moved-test-clock-is-marked');
  console.log((fails ? 'CONFIRM_GATE_FAIL ' + fails : 'CONFIRM_GATE_OK ' + oks) + ' checks');
  process.exit(fails ? 1 : 0);
})().catch(function (e) { console.log('FAIL crashed ' + (e && e.stack || e)); console.log('CONFIRM_GATE_FAIL crash'); process.exit(1); });
