#!/usr/bin/env node
// Weft recheck3 F4/F5: one shared fixture (tools/learn/mind-names-v0.1.json) pins the mind-name rules in BOTH
// languages: normMind/mindId/nameProblem (docs/modules/snowflake-core.js) and norm_mind/mind_id/name_problem
// (tools/learn/fl_learn.py). The Python half runs with FL_PYTHON (default python3) when it can import fl_learn.
// Run: node smoke-mind-names-v0.1.js [repo root]
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
var fx = JSON.parse(fs.readFileSync(path.join(root, 'tools/learn/mind-names-v0.1.json'), 'utf8')).names;
var bad = fx.filter(function (x) {
  return core.normMind(x.name) !== x.norm || core.nameProblem(x.name) !== x.problem || (x.id && core.mindId(x.name) !== x.id);
});
ok(fx.length >= 60 && bad.length === 0, 'js-matches-the-shared-fixture (' + fx.length + ' names)', bad.slice(0, 3));
ok(core.normMind('ΟΔΟΣ') === core.normMind('οδοσ') && core.mindId('ΟΔΟΣ') === core.mindId('οδος'), 'greek-final-sigma-folds');
ok(!!core.nameProblem('This\u200bmind') && !!core.nameProblem('Th\u0456s mind') && !!core.nameProblem('This mind.') && core.nameProblem('This mind') === '',
  'zero-width-lookalike-trailing-dot-refused');
var py = process.env.FL_PYTHON || 'python3';
var r = cp.spawnSync(py, ['-c', [
  'import json,sys', 'sys.path.insert(0, sys.argv[1])', 'import fl_learn as f',
  'fx = json.load(open(sys.argv[2]))["names"]',
  'bad = [x["name"] for x in fx if f.norm_mind(x["name"]) != x["norm"] or f.name_problem(x["name"]) != x["problem"] or (x["id"] and f.mind_id(x["name"]) != x["id"])]',
  'print("PYBAD " + json.dumps(bad))'].join('\n'), path.join(root, 'tools/learn'), path.join(root, 'tools/learn/mind-names-v0.1.json')], { encoding: 'utf8' });
var line = String(r.stdout || '').split('\n').filter(function (l) { return l.indexOf('PYBAD ') === 0; })[0];
if (!line) console.log('SKIPPED python half (' + py + ' could not import fl_learn); the acceptance suite checks the same fixture');
else ok(JSON.parse(line.slice(6)).length === 0, 'python-matches-the-shared-fixture', line.slice(6, 200));
(async function () {
  var t1 = await core.trustMind('Th\u0456s mind', { by: 'person' });
  var t2 = await core.trustMind('Lu\u200bmen', { by: 'person' });
  var t3 = await core.trustMind('Lumen.', { by: 'person' });
  var t4 = await core.trustMind('Lumen', { by: 'person' });
  ok(t1 === false && t2 === false && t3 === false && t4 === true && core.trustedMinds().length === 1, 'trust-mind-refuses-lookalike-names', core.trustedMinds());
  console.log(fails ? 'MIND_NAMES_FAIL ' + fails : 'MIND_NAMES_OK ' + oks + ' checks');
  process.exit(fails ? 1 : 0);
})().catch(function (e) { console.log('FAIL crashed ' + (e && e.stack)); process.exit(1); });
