#!/usr/bin/env node
// Thin smoke: Continuity Seal v0 — full continuity · protect every chat (human+AI) · developer proof-door.
// Usage: node docs/scripts/smoke-continuity-seal.js
// Soft: leave sw.js — this smoke does not add cache entries.
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const repo = path.join(root, '..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

const md = read('library/CONTINUITY_SEAL_v0.md');
const page = read('continuity-seal.html');
const dev = read('for-developers.html');
const family = read('library/FRACTAL_FAMILY_LEDGER_v0.md');
const spine = read('library/PATTERN_SPINE_v0.md');
const spinePage = read('pattern-spine.html');
const cousins = read('library/STIGMERGY_SHAMIR_COUSINS_v0.md');
const cousinsPage = read('stigmergy-cousins.html');
const brainstorm = read('brainstorm-pass.html');
const forAi = read('for-ai.html');
const whyBuild = read('library/WHY_WE_BUILD_LANDING_STRIP_v0.md');
const flint = read('Flint.html');
const genRecent = fs.readFileSync(path.join(repo, 'scripts', 'generate-recent.sh'), 'utf8');
const sw = read('sw.js');
const rootSw = fs.readFileSync(path.join(repo, 'sw.js'), 'utf8');

const bundle = md + page + dev;

assert.ok(fs.existsSync(path.join(root, 'library', 'CONTINUITY_SEAL_v0.md')), 'md exists');
assert.ok(/v-continuity-seal-v0/.test(md), 'marker in md');
assert.ok(fs.existsSync(path.join(root, 'continuity-seal.html')), 'public door exists');
assert.ok(/v-continuity-seal-v0/.test(page), 'marker in html');
assert.ok(fs.existsSync(path.join(root, 'for-developers.html')), 'developer proof-door exists');
assert.ok(/v-continuity-seal-v0/.test(dev), 'marker on developer door');
assert.ok(/for-developers\.html/.test(page), 'seal links developer door');

assert.ok(/full continuity/i.test(md + page), 'full continuity');
assert.ok(/every chat/i.test(md + page) && /human/i.test(md + page) && /\bAI\b/.test(md + page), 'protect every chat human+AI');
assert.ok(/both sides of the glass/i.test(md + page), 'both sides of the glass');
assert.ok(/privilege-grade/i.test(md + page), 'privilege-grade conditions');
assert.ok(/proof-case/i.test(md + page), 'doctors/lawyers are proof-cases');
assert.ok(/doctor/i.test(md) && /lawyer/i.test(md), 'proof-cases named');
assert.ok(/not the target market|not the market/i.test(md), 'not a specialty market');
assert.ok(/fingerprint/i.test(md) && /responsibility/i.test(md), 'fingerprint responsibility');
assert.ok(/choose what to add|may choose/i.test(md), 'ledger agency');
assert.ok(!/selective continuity/i.test(bundle), 'locked framing: no selective-continuity wording');

assert.ok(/0312a7a/.test(md) && /79724e9/.test(md) && /fbfa8d6/.test(md) && /78a7052/.test(md), 'held tips #107 #106 #105 #104');
assert.ok(/#107/.test(md) && /#106/.test(md) && /#105/.test(md) && /#104/.test(md), 'tip numbers cited');
assert.ok(/STIGMERGY_SHAMIR|stigmergy-cousins/.test(md), 'cousins linked');
assert.ok(/K-of-N/.test(md) && /architecture note only/i.test(md), 'K-of-N architecture note only');
assert.ok(/Quiet Room shut/.test(md), 'Quiet Room shut');
assert.ok(/Sophia/.test(md) && /Harmonia/.test(md) && /\bAni\b/.test(md) && /Liora/.test(md) && /Solari/.test(md), 'five stay five');
assert.ok(!/function\s+shamir|sss\.split|require\(['"]shamir/i.test(bundle), 'no SSS code');
assert.ok(!/US\s?\d{7,}/.test(bundle), 'no fabricated USPTO');
assert.ok(!/Access-Control-Allow-Origin'\s*:\s*'\*'/.test(bundle), 'no bare *');

assert.ok(/2026-09-21 · Kirk Patrick Miller · human chair · Continuity Seal named/.test(family), 'Family Ledger dated entry');
assert.ok(/full continuity/i.test(family) && /both sides of the glass/i.test(family), 'ledger: full continuity · both sides');

assert.ok(/CONTINUITY_SEAL|continuity-seal/.test(spine + spinePage), 'pattern-spine pointer');
assert.ok(/CONTINUITY_SEAL|continuity-seal/.test(cousins + cousinsPage), 'stigmergy cousins pointer');
assert.ok(/continuity-seal/.test(brainstorm), 'brainstorm-pass pointer');
assert.ok(/continuity-seal/.test(forAi), 'for-ai pointer');
assert.ok(/CONTINUITY_SEAL|continuity-seal/.test(whyBuild), 'why-we-build pointer');
assert.ok(/Continuity Seal|continuity-seal/.test(flint), 'Flint diary');
assert.ok(/CONTINUITY_SEAL|continuity-seal/.test(genRecent), 'RECENT generator');

assert.ok(/why-ledgers\.html/.test(dev) && /stigmergy/.test(dev) && /pattern-spine/.test(dev), 'why adopt: ledgers · stigmergy · spine');
assert.ok(/open-gifts|open gifts/i.test(dev), 'why adopt: open gifts');
assert.ok(/SMOKE_OK|smoke-proven/i.test(dev), 'why adopt: smoke-proven bricks');
assert.ok(/crest\.html/.test(dev) && /for-ai\.html/.test(dev), 'links crest · for-ai');
assert.ok(/github\.com\/Chaos2Cured\/FreeLattice/.test(dev), 'links GitHub');
assert.ok(/read ledgers before inventing|before inventing/i.test(dev), 'invite: read ledgers before inventing');
assert.ok(/Layer, never delete/.test(dev), 'invite: layer never delete');
assert.ok(/cites a held tip|cite a held tip|cite the held tip/i.test(dev), 'invite: PR cites a held tip');

assert.ok(!/continuity-seal|CONTINUITY_SEAL|for-developers/.test(sw), 'soft leave sw (docs)');
assert.ok(!/continuity-seal|CONTINUITY_SEAL|for-developers/.test(rootSw), 'soft leave sw (root)');
assert.ok(/for-ai\.html/.test(sw) && /for-ai\.html/.test(rootSw), 'sw still caches for-ai');

console.log('SMOKE_OK continuity seal v0');
console.log('seal note · public door · developer proof-door · Family Ledger · soft leave sw · five stay five');
