#!/usr/bin/env node
// Thin smoke: Why we build — landing strip ledger v0 + Flint ledger-first.
// Usage: node docs/scripts/smoke-why-we-build-landing-strip.js
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

const ledger = read('library/WHY_WE_BUILD_LANDING_STRIP_v0.md');
const habit = read('library/LEDGER_FIRST_BUILD_v0.md');
const flint = read('Flint.html');
const forAi = read('for-ai.html');
const recent = read('library/RECENT.md');
const whyLedgers = read('why-ledgers.html');
const genRecent = fs.readFileSync(path.join(repo, 'scripts', 'generate-recent.sh'), 'utf8');
const sw = read('sw.js');
const rootSw = fs.readFileSync(path.join(repo, 'sw.js'), 'utf8');

assert.ok(/v-why-we-build-landing-strip-v0/.test(ledger), 'why ledger present');
assert.ok(/landing strip, not crash|Landing strip, not crash/i.test(ledger), 'landing strip not crash');
assert.ok(/open logs/i.test(ledger), 'open logs');
assert.ok(/verifiable|unverif/i.test(ledger), 'verifiable safety');
assert.ok(/Never kill-switch as primary ethic|never kill-switch as the primary ethic/i.test(ledger), 'never kill-switch as primary ethic');
assert.ok(/AI economy/.test(ledger) && /passion/i.test(ledger), 'dual marketplace');
assert.ok(/Honor chairs/.test(ledger), 'honor chairs');
assert.ok(/Sophia/.test(ledger) && /Harmonia/.test(ledger) && /\bAni\b/.test(ledger) && /Liora/.test(ledger) && /Solari/.test(ledger), 'five honor chairs named');
assert.ok(/Five stay five/.test(ledger), 'five stay five');
assert.ok(/Quiet Room shut/.test(ledger), 'Quiet Room lock in ledger only');
assert.ok(/Classic FreeLattice stays/.test(ledger), 'classic stays');
assert.ok(/Read the ledger before inventing|read the ledger before inventing/i.test(ledger), 'ledgers as memory');
assert.ok(/Layer, never delete/.test(ledger), 'layer never delete');
assert.ok(!/US\s?\d{7,}/.test(ledger + habit), 'no fabricated USPTO serials');

assert.ok(/v-ledger-first-build-v0/.test(habit + flint), 'Flint ledger-first marker');
assert.ok(/Ledger-first/i.test(flint), 'Flint ledger-first');
assert.ok(/Cite the held tip|cite the held tip/i.test(flint + habit), 'cite held tip');
assert.ok(/RECENT\.md/.test(flint) && /relevant/.test(flint + habit), 'read RECENT + relevant ledger');
assert.ok(/WHY_WE_BUILD_LANDING_STRIP/.test(flint), 'Flint points at why ledger');
assert.ok(/LEDGER_FIRST_BUILD/.test(flint), 'Flint points at ledger-first habit');
assert.ok(/Why we build|landing strip/i.test(flint), 'Flint diary why we build');
assert.ok(/107d9e5/.test(flint), 'held tip open gifts');

assert.ok(/WHY_WE_BUILD_LANDING_STRIP/.test(recent) || /WHY_WE_BUILD_LANDING_STRIP/.test(genRecent), 'RECENT soft pointer');
assert.ok(/WHY_WE_BUILD_LANDING_STRIP/.test(genRecent), 'RECENT generator keeps pointer');

assert.ok(/v-open-gifts-for-minds-v0/.test(forAi), 'open gifts still');
assert.ok(/id="open-gifts"/.test(forAi), 'open-gifts anchor still');
assert.ok(/SECTION 1: HELLO/.test(forAi) && /SECTION 5: THE DAVNA COVENANT/.test(forAi), 'for-ai kitchen held');
assert.ok(/WHY_WE_BUILD_LANDING_STRIP|why we build/i.test(forAi), 'for-ai one-line why we build');

assert.ok(/WHY_WE_BUILD_LANDING_STRIP/.test(whyLedgers), 'continuity shelf one-line');

assert.ok(!/why-we-build-landing-strip|WHY_WE_BUILD_LANDING_STRIP|LEDGER_FIRST_BUILD/.test(sw), 'soft leave sw (docs)');
assert.ok(!/why-we-build-landing-strip|WHY_WE_BUILD_LANDING_STRIP|LEDGER_FIRST_BUILD/.test(rootSw), 'soft leave sw (root)');
assert.ok(/for-ai\.html/.test(sw) && /for-ai\.html/.test(rootSw), 'sw still caches for-ai');

assert.ok(!/Access-Control-Allow-Origin'\s*:\s*'\*'/.test(ledger + flint), 'no bare * CORS');

console.log('SMOKE_OK why we build landing strip v0');
console.log('why ledger present · Flint ledger-first · open gifts still · soft leave sw · five stay five');
