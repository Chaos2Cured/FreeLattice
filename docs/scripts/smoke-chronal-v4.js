#!/usr/bin/env node
// Thin smoke: Chronal V4 Amplified Seam — honesty locks.
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const v4 = fs.readFileSync(path.join(root, 'chronal-simulation-v4.html'), 'utf8');
const v3 = fs.readFileSync(path.join(root, 'chronal-simulation-v3.html'), 'utf8');
const py = fs.readFileSync(path.join(root, 'simulation', 'chronal_amplified_seam_v4.py'), 'utf8');
const report = fs.readFileSync(path.join(root, 'library', 'CHRONAL_AMPLIFIED_SEAM_V4.md'), 'utf8');
const flint = fs.readFileSync(path.join(root, 'Flint.html'), 'utf8');
const protocol = fs.readFileSync(path.join(root, 'library', 'LATTICE_PROTOCOL_v0.1.md'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.html'), 'utf8');

assert.ok(/v-chronal-amplified-seam-v4/.test(v4 + report), 'marker');
assert.ok(/The Amplified Seam/.test(v4), 'title');
assert.ok(/Abstract/.test(v4), 'has abstract');

// Abstract must not claim "first cross-sector"
const absMatch = v4.match(/<strong>Abstract\.<\/strong>[\s\S]*?<\/div>/i);
assert.ok(absMatch, 'abstract block');
assert.ok(!/first cross-sector/i.test(absMatch[0]), 'no first cross-sector in abstract');
assert.ok(!/first cross-sector/i.test(v4.replace(/More[\s\S]*$/i, '')), 'no first cross-sector in physics body');

// Forbid the V3 conflation claim ("85σ at/vs the bound"); allow "no 85σ" / "85σ bug" rejection language.
assert.ok(!/85\s*σ\s*(vs|at|against)|at\s*85\s*σ|85\s*σ\s*vs\s*null/i.test(v4 + py), 'no 85σ-as-bound claim');
assert.ok(/No 85σ|no 85σ|no_85sigma|85σ bug/i.test(py + v4 + report), 'explicitly rejects 85σ conflation');

assert.ok(/Ashby|Lange|Damour/i.test(v4), 'ancestor cites');
assert.ok(/Damour/.test(v4) && /Donoghue/i.test(v4), 'Damour–Donoghue');
assert.ok(/3\.3\s*[×x]?\s*10|3\.3e-10|3\.3×10/i.test(v4 + py), 'annual ΔU');
assert.ok(/5900/.test(v4 + py), 'K_alpha Th');

// Snowflake quarantined off physics spine — may appear only under More
const beforeMore = v4.split(/<h2>More<\/h2>/i)[0] || v4;
assert.ok(!/Snowflake|φ market|phi market/i.test(beforeMore), 'Snowflake not in V4 physics spine');
assert.ok(/Snowflake|market-gauge|market gauge/i.test(v4), 'Snowflake quarantined under More');

assert.ok(/chronal-simulation-v4\.html/.test(v3), 'V3 links V4');
assert.ok(/V4 — The Amplified Seam|V4 &mdash; The Amplified Seam|Amplified Seam/.test(v3), 'V3 banner');
assert.ok(fs.existsSync(path.join(root, 'simulation', 'chronal_amplified_seam_v4.png')), 'figure png');
assert.ok(/not_yet_reproduced|not yet reproduced/i.test(py), 'Lange fail-closed');
assert.ok(/6aef962/.test(report + flint), 'Held tip gift sprites');
assert.ok(/CHRONAL_AMPLIFIED_SEAM_V4/.test(protocol), 'Protocol LAYER');
assert.ok(/Amplified Seam|Chronal V4/i.test(flint), 'Flint ledger');
assert.ok(/sw\.js/.test(app), 'leave sw.js on app.html');

console.log('SMOKE_OK chronal V4 amplified seam');
console.log('no first · no 85σ · ancestors · Snowflake quarantined · V3 kept');
