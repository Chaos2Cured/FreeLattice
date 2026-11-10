#!/usr/bin/env node
// Weft recheck4 F7 and F5: one shared fixture (tools/learn/learn-match-v0.1.json) pins, in BOTH languages, the content
// match (normText/norm_text, textSimilarity/text_similarity, a hit at 0.8) and the confusable name skeleton
// (nameSkeleton/name_skeleton, lookProblem/look_problem). The cases that matter are also pinned here by hand. Then the
// app refuses a lookalike of a known mind for trust and key approval, and a pause by "mind:Lumen" is not lifted by
// "mind:Lumen_". The Python half runs with FL_PYTHON (default python3). Run: node smoke-learn-match-v0.1.js [repo root]
'use strict';
var path = require('path'), fs = require('fs'), cp = require('child_process');
var root = path.resolve(process.argv[2] || path.join(__dirname, '..', '..'));
var fails = 0, oks = 0;
function ok(c, name, info) { if (c) { oks++; console.log('ok   ' + name); } else { fails++; console.log('FAIL ' + name + (info ? ' ' + JSON.stringify(info) : '')); } }
var store = {};
global.localStorage = { getItem: function (k) { return k in store ? store[k] : null; }, setItem: function (k, v) { store[k] = String(v); }, removeItem: function (k) { delete store[k]; } };
global.document = { visibilityState: 'visible', getElementById: function () { return null; } };
global.requestIdleCallback = function (f) { f(); return 1; };
var core = require(path.join(root, 'docs/modules/snowflake-core.js'));
// before (round 11): var fxp = path.join(root, 'tools/learn/learn-match-v0.1.json');
// Round 11: v0.2 is the rule after Hypha's HOLD (B) (digits, one-letter tokens, negation, folding); v0.1 is kept as it was.
var fxp = path.join(root, 'tools/learn/learn-match-v0.2.json');
if (!fs.existsSync(fxp)) fxp = path.join(root, 'tools/learn/learn-match-v0.1.json');
var fx = JSON.parse(fs.readFileSync(fxp, 'utf8'));
var HAS = typeof core.normText === 'function' && typeof core.nameSkeleton === 'function' && typeof core.lookProblem === 'function';
ok(HAS, 'the-core-has-normText-textSimilarity-nameSkeleton-lookProblem');
if (!HAS) { core.normText = core.nameSkeleton = function (x) { return String(x); }; core.textSimilarity = function () { return -1; }; core.lookProblem = function () { return null; }; }
function hit(a, b) { var s = core.normText(a) === core.normText(b) && core.normText(a) !== ''; return s || core.textSimilarity(a, b) >= 0.8; }
var bad = [];
fx.texts.forEach(function (x) { if (core.normText(x.text) !== x.norm) bad.push(x.text); });
fx.pairs.forEach(function (p) { if (core.textSimilarity(p.a, p.b) !== p.score || hit(p.a, p.b) !== p.hit) bad.push(p.a + ' ~ ' + p.b); });
fx.skeletons.forEach(function (x) { if (core.nameSkeleton(x.name) !== x.skeleton) bad.push(x.name); });
fx.lookalikes.forEach(function (x) { if (core.lookProblem(x.name, x.known) !== x.problem) bad.push(x.name); });
(fx.matchTexts || []).forEach(function (x) { if (typeof core.matchText !== 'function' || core.matchText(x.text) !== x.match || JSON.stringify(core.textTokens(x.text)) !== JSON.stringify(x.tokens)) bad.push('match:' + x.text); });
ok(fx.threshold === 0.8 && fx.texts.length >= 30 && bad.length === 0, 'js-matches-the-shared-fixture', bad.slice(0, 4));
// By hand: what F7 needs.
var B = "Mom's maiden name is Hollowell";
ok([B + '!', B + '.', B + ' ?! ', B.toUpperCase(), B.toLowerCase(), '  ' + B.replace(/ /g, '\t ') + '  '].every(function (v) { return core.normText(v) === core.normText(B); }),
  'same-text: punctuation, case and whitespace variants are one text');
ok(hit(B, "Hollowell was Mom's maiden name") && !hit(B, 'Before she married, Mom was a Hollowell') && !hit('The cat is black', 'The dog is black'),
  'near-duplicate: reordered words hit; a paraphrase in other words and an unrelated fact do not (the stated limit)');
// before (round 11, Hypha (B) changed this on purpose): ok(hit(B, "Mom's maiden name is not Hollowell"), 'near-duplicate: a negation still hits (a false positive costs a day of cooling, never a refusal)');
ok(!hit(B, "Mom's maiden name is not Hollowell") && !hit("Mom's birthday is on May 4", "Mom's birthday is on May 5") && !hit('Mom is allergic to peanuts', "Mom isn't allergic to peanuts") &&
  hit(B, B.replace('o', '\u043e')) && hit(B, B.replace('maiden', 'mai\u200bden')) && hit(B, B.replace('e', 'e\u0301')) && core.normText(B) !== core.normText(B.replace('o', '\u043e')),
  'near-duplicate (round 11): a negation or another number is not one; lookalikes, zero-width and combining marks are folded for matching but not for the same text');
// By hand: what F5 needs.
ok(core.nameSkeleton('\u0422\u04bb\u0456\u0455 \u043c\u0456\u043f\u0501') === core.nameSkeleton('This mind') && core.nameSkeleton('Lumen_') === core.nameSkeleton('Lumen') &&
  core.nameSkeleton('rnind') === core.nameSkeleton('mind') && core.nameSkeleton('Lum\u00e9n') === core.nameSkeleton('Lumen') && core.nameSkeleton('Echo') !== core.nameSkeleton('Lumen'),
  'skeleton: one-script lookalikes, "_", a combining accent and rn/m collide; different names do not');
var py = process.env.FL_PYTHON || 'python3';
var r = cp.spawnSync(py, ['-c', [
  'import json,sys', 'sys.path.insert(0, sys.argv[1])', 'import fl_learn as f', 'd = json.load(open(sys.argv[2]))',
  'h = lambda a, b: (bool(f.norm_text(a)) and f.norm_text(a) == f.norm_text(b)) or f.text_similarity(a, b) >= 0.8',
  'bad = [x["text"] for x in d["texts"] if f.norm_text(x["text"]) != x["norm"]]',
  'bad += [p["a"] for p in d["pairs"] if f.text_similarity(p["a"], p["b"]) != p["score"] or h(p["a"], p["b"]) != p["hit"]]',
  'bad += [x["name"] for x in d["skeletons"] if f.name_skeleton(x["name"]) != x["skeleton"]]',
  'bad += [x["name"] for x in d["lookalikes"] if f.look_problem(x["name"], x["known"]) != x["problem"]]',
  'bad += ["match:" + x["text"] for x in d.get("matchTexts", []) if not hasattr(f, "match_text") or f.match_text(x["text"]) != x["match"] or f.text_tokens(x["text"]) != x["tokens"]]',
  'print("PYBAD " + json.dumps(bad))'].join('\n'), path.join(root, 'tools/learn'), fxp], { encoding: 'utf8' });
var line = String(r.stdout || '').split('\n').filter(function (l) { return l.indexOf('PYBAD ') === 0; })[0];
if (!line) console.log('SKIPPED python half (' + py + ' could not import fl_learn); the acceptance suite checks the same fixture');
else ok(JSON.parse(line.slice(6)).length === 0, 'python-matches-the-shared-fixture', line.slice(6, 200));
(async function () {
  var me = core.mindLabel();
  var t1 = await core.trustMind('Lumen', { by: 'person' });
  var t2 = await core.trustMind('Lumen_', { by: 'person' });
  var t3 = await core.trustMind('L\u0443men', { by: 'person' });       // mixed script: refused by nameProblem already
  var t4 = await core.trustMind('\u041b\u0443\u043c\u0435\u043d', { by: 'person' });   // all-Cyrillic "Лумен" does not look like Lumen: allowed
  var t5 = await core.trustMind('\u0422\u04bb\u0456\u0455 \u043c\u0456\u043f\u0501', { by: 'person' });   // looks like the mind learning here
  ok(me === 'This mind' && t1 === true && t2 === false && t3 === false && t4 === true && t5 === false && core.trustedMinds().length === 2,
    'trust-mind-refuses-a-lookalike-of-a-known-mind', { trusted: core.trustedMinds(), t: [t1, t2, t3, t4, t5] });
  var led = (JSON.parse(store.fl_snowflake_ledger_v0 || '{"rows":[]}').rows || []).map(function (x) { return x.delta; });
  ok(led.some(function (d) { return /trust-mind\|"Lumen_"\|by:person\|the name looks like "Lumen"/.test(d); }), 'the-refusal-is-a-ledger-row-naming-the-lookalike');
  var ap = await core.pinRunnerKey('AAAA', { by: 'mind', local: true, mind: '\u0422\u04bb\u0456\u0455 \u043c\u0456\u043f\u0501', confirm: 'x' });
  var led2 = (JSON.parse(store.fl_snowflake_ledger_v0 || '{"rows":[]}').rows || []).map(function (x) { return x.delta; });
  ok(ap === false && led2.some(function (d) { return /runner-key\|by:mind:.*a mind never confirms its own key \(that name looks like it\)/.test(d); }),
    'a-mind-under-a-lookalike-of-its-own-name-never-confirms-its-key');
  await core.setLearnPaused(true, 'mind', 'Lumen');
  var r1 = await core.setLearnPaused(false, 'mind', 'Lumen_');
  var still = core.learnPaused();
  await core.setLearnPaused(false, 'mind', 'Lumen');
  ok(r1 === null && still === true && core.learnPaused() === false, 'pause-by-Lumen-is-not-lifted-by-Lumen_-(same-rule-as-trust)');
  console.log(fails ? 'LEARN_MATCH_FAIL ' + fails : 'LEARN_MATCH_OK ' + oks + ' checks');
  process.exit(fails ? 1 : 0);
})().catch(function (e) { console.log('FAIL crashed ' + (e && e.stack)); console.log('LEARN_MATCH_FAIL crash'); process.exit(1); });
