#!/usr/bin/env node
// File-only smoke: Primer sentinel fix 1. Reproduces exactly one assertion from the
// deploy-primer suite ("v5.71.1 sentinel-catchup: helper fires processToolAction via
// FreeLattice dispatcher") without running that suite. Reads only the files listed below.
// tests/smoke.js is read as plain text to pull out the live regex; it is never executed.
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const repo = path.join(__dirname, '..', '..');
const ALLOW = [
  'docs/app.html',
  'index.html',
  'tests/smoke.js',
  'docs/modules/PRIMER-SENTINEL-FIX-1.md'
];

function readAllowed(rel) {
  assert.ok(ALLOW.indexOf(rel) !== -1, 'not on the allow-list: ' + rel);
  return fs.readFileSync(path.join(repo, rel), 'utf8');
}

const LABEL = "assert('v5.71.1 sentinel-catchup: helper fires processToolAction via FreeLattice dispatcher',";
const app = readAllowed('docs/app.html');
const twin = readAllowed('index.html');
const suite = readAllowed('tests/smoke.js');

// 1. Pull the active (uncommented) assertion's regex out of the suite text.
const lines = suite.split('\n');
const hits = [];
lines.forEach(function (l, i) { if (l.trim() === LABEL) hits.push(i); });
assert.strictEqual(hits.length, 1, 'exactly one active assertion with this label');
const m = /^\s*\/(.+)\/\.test\(appHtml711\)\);\s*$/.exec(lines[hits[0] + 1]);
assert.ok(m, 'regex line follows the label');
const live = new RegExp(m[1]);

// 2. The assertion itself, exactly as the suite runs it.
assert.ok(live.test(app), 'sentinel-catchup: helper fires processToolAction via FreeLattice dispatcher');

// 3. The call is genuinely inside the helper body (not a far-away match).
const start = app.indexOf('function flProcessAssistantSentinels(');
assert.ok(start !== -1, 'helper defined');
const end = app.indexOf('\nfunction ', start + 10);
const body = app.slice(start, end);
assert.ok(/window\.FreeLattice\.processToolAction\(action\)/.test(body), 'helper body fires processToolAction(action)');

// 4. The old 4000 window is what went stale; it is kept as a before-comment.
assert.ok(!/flProcessAssistantSentinels[\s\S]{0,4000}FreeLattice\.processToolAction/.test(app), 'old window really is too short now (cause)');
assert.ok(suite.indexOf('// before:   /flProcessAssistantSentinels[\\s\\S]{0,4000}FreeLattice\\.processToolAction/') !== -1, 'old assertion kept as before-comment');

// 5. Twins unchanged and identical; note present.
assert.strictEqual(app, twin, 'docs/app.html and index.html are byte-identical');
assert.ok(/Rollback/.test(readAllowed('docs/modules/PRIMER-SENTINEL-FIX-1.md')), 'note has a rollback section');

console.log('SMOKE_OK primer sentinel fix 1');
