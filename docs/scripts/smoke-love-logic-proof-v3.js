#!/usr/bin/env node
// Smoke: Love Logic Proof v3 (marker v-love-logic-proof-v3).
// Page beside v1/v2, honest content present, no network, checks reproduce 656/656.
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');

const docs = path.join(__dirname, '..');
const repo = path.join(docs, '..');
const read = (rel) => fs.readFileSync(path.join(docs, rel), 'utf8');

const page = read('love-logic-proof-v3.html');
const checksSrc = read('love-logic/v3_checks.js');
const sim = read('love-logic/v3_crossover_sim.py');
const results = JSON.parse(read('love-logic/v3_sim_results.json'));

// Marker and neighbours
assert.ok(/v-love-logic-proof-v3/.test(page), 'marker on page');
assert.ok(/v-love-logic-proof-v3/.test(checksSrc), 'marker in checks');
assert.ok(fs.existsSync(path.join(docs, 'love-logic-proof.html')), 'v1 still there');
assert.ok(fs.existsSync(path.join(docs, 'love-logic-proof-v2.html')), 'v2 still there');

// First screen: not the Nov 2025 manuscript, Mom summary before builder details
const notIdx = page.indexOf('id="not-the-2025-manuscript"');
const momIdx = page.indexOf('id="plain-words"');
const firstDetails = page.indexOf('<details');
assert.ok(notIdx > 0 && /not<\/strong> the November 2025 manuscript <em>The Proof of All Proofs<\/em>/.test(page) && /Version 3\.0/.test(page), 'disambiguation note');
assert.ok(momIdx > notIdx && firstDetails > momIdx, 'plain words come first; builder details are folded below');

// Required content
const must = [
  [/about 702 rounds/, 'about 702 (few contacts, no shared memory)'],
  [/about 10\.5 rounds/, 'about 10.5 (5 contacts, full memory)'],
  [/never gets ahead at all/, 'never ahead (10 contacts, full memory)'],
  [/<math display="block"/, 'MathML headline'],
  [/G &lt; h\(n, m\) &times; \[ L<sub>p<\/sub> \+ &delta;&Delta; \/ \(1 &minus; &delta;\) \]/, 'plain-text headline inequality'],
  [/Theorem A \(only for audience-varying lies\)/, 'Kolmogorov bound scoped to audience-varying lies'],
  [/global lie/, 'global-lie escape named'],
  [/A6 \(Long Horizon\) is no longer an axiom/, 'axiom 6 becomes a parameter'],
  [/backward induction/, 'end-game unraveling named'],
  [/An unknown end/, 'fix 1 unknown end'],
  [/Immediate penalties/, 'fix 2 immediate penalties'],
  [/Records that outlast the horizon \(ledgers\)/, 'fix 3 ledgers'],
  [/anonymous one-shot meetings/i, 'anonymous one-shot unsolved'],
  [/cooperation holds in 68% of scarce cases/, 'scarcity 68%'],
  [/Conflict beats sharing in 32% of scarce cases/, 'scarcity 32%'],
  [/DECEPTION_COST = 3\.5/, 'v1 constant named'],
  [/has no code behind it that we could find/, 'v2 95.7% retired'],
  [/said its six axioms were "unchanged" from v1\. They were not\./, 'v2 axioms correction'],
  [/Answering Grok's critiques/, 'critiques framed as answers'],
  [/656\/656 checks passed/, 'sim receipt']
];
for (const [re, label] of must) assert.ok(re.test(page), label);

// No network, no external scripts, outside text via textContent
assert.ok(!/\bfetch\s*\(|XMLHttpRequest|WebSocket|navigator\.sendBeacon|import\s*\(/.test(page + checksSrc), 'no network calls');
const srcs = [...page.matchAll(/<script[^>]*\bsrc="([^"]+)"/g)].map((m) => m[1]);
assert.deepStrictEqual(srcs, ['love-logic/v3_checks.js'], 'only the local checks script is loaded');
assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML|document\.write/.test(page + checksSrc), 'textContent only');
assert.ok(!/katex|mathjax/i.test(page), 'no KaTeX / MathJax');

// Every inline script parses; checks module parses
let inline = 0;
for (const m of page.matchAll(/<script(?![^>]*\bsrc=)(?![^>]*type="application\/ld\+json")[^>]*>([\s\S]*?)<\/script>/g)) { new vm.Script(m[1]); inline++; }
assert.ok(inline >= 1, 'page glue script present and parses');
for (const m of page.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) JSON.parse(m[1]);
execFileSync(process.execPath, ['--check', path.join(docs, 'love-logic', 'v3_checks.js')]);

// The browser checks reproduce the Python totals
const api = require(path.join(docs, 'love-logic', 'v3_checks.js'));
assert.strictEqual(api.SEED, 20260924, 'seed');
const r = api.runAll();
assert.strictEqual(r.total.passed, 656, 'browser checks pass 656');
assert.strictEqual(r.total.total, 656, 'browser checks total 656');
for (const k of ['B1', 'B2', 'B3', 'C1', 'D']) assert.strictEqual(r[k].total, results[k].total, k + ' total matches Python');
assert.strictEqual(Math.round(r.D.scarceSustain * 10000), 6825, 'scarce sustain 68.25%');
assert.strictEqual(Math.round(r.D.scarceConflict * 10000), 3175, 'scarce conflict 31.75%');

// Python sim + results receipt
assert.ok(/^SEED = 20260924$/m.test(sim) && /def section_D\(\):/.test(sim), 'sim file is the v3 crossover sim');
assert.strictEqual(Number(results.total.passed), 656, 'results passed 656');
assert.strictEqual(Number(results.total.total), 656, 'results total 656');
assert.strictEqual(results.total.seed, 20260924, 'results seed');

// v1 untouched; v2 at most one layered link line (only when a git base is available)
function show(ref) { try { return execFileSync('git', ['show', ref], { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch (e) { return null; } }
const v1Main = show('origin/main:docs/love-logic-proof.html');
if (v1Main !== null) assert.strictEqual(read('love-logic-proof.html'), v1Main, 'v1 byte-identical to main');
const v2Main = show('origin/main:docs/love-logic-proof-v2.html');
if (v2Main !== null) {
  const a = v2Main.split('\n'); const b = read('love-logic-proof-v2.html').split('\n');
  const added = b.filter((l) => !a.includes(l)); const removed = a.filter((l) => !b.includes(l));
  assert.strictEqual(removed.length, 0, 'v2: nothing removed');
  assert.ok(added.length <= 1 && added.every((l) => /love-logic-proof-v3\.html/.test(l)), 'v2: at most one "Newer: v3" line');
}
// sw.js and Kimi untouched when a git base is available
try {
  const changed = execFileSync('git', ['diff', '--name-only', 'origin/main'], { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).split('\n').filter(Boolean);
  assert.ok(!changed.includes('sw.js') && !changed.includes('docs/sw.js'), 'sw.js untouched');
  assert.ok(!changed.some((f) => /kimi|voice-shelf|VOICE_SHELF/i.test(f)), "Kimi's pages untouched");
  assert.ok(!changed.includes('docs/app.html') && !changed.includes('index.html'), 'app.html / index.html untouched by this brick');
} catch (e) { if (e instanceof assert.AssertionError) throw e; }

console.log('SMOKE_OK love logic proof v3');
