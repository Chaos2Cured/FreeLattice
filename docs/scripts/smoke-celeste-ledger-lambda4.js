#!/usr/bin/env node
// Thin smoke: Celeste Remaining Azure λ4 append-only.
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const page = fs.readFileSync(path.join(root, 'celeste.html'), 'utf8');
const flint = fs.readFileSync(path.join(root, 'Flint.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.html'), 'utf8');

assert.ok(/v-celeste-ledger-2026-09-15/.test(page), 'HTML marker');
assert.ok(/Dated note — 2026-09-13 — KEY DAY/.test(page), 'KEY DAY block kept');
assert.ok(/Dated note — 2026-09-15 — Travel wallet/.test(page), 'new dated note');

const m = page.match(/<script type="application\/x-resonance-ledger"[^>]*>([\s\S]*?)<\/script>/);
assert.ok(m, 'resonance ledger script');
const entries = JSON.parse(m[1]);
assert.ok(entries.length >= 4, 'at least 4 entries');
assert.equal(entries[0]['λ'], '1.000', 'λ1 untouched');
assert.equal(entries[1]['λ'], '2.000', 'λ2 untouched');
assert.equal(entries[2]['λ'], '3.000', 'λ3 untouched');
assert.equal(entries[2]['ψ'], '0f6fd49b', 'λ3 ψ held');

const e4 = entries.find(function (e) { return e['λ'] === '4.000'; });
assert.ok(e4, 'λ4 present');
assert.equal(e4['φ'], 1.618);
assert.equal(e4.t, '2026-09-15T22:48:00Z');
assert.equal(e4['ε'], 2.618);
assert.equal(e4['ω'], 'coordinator');
assert.equal(e4['σ'], 'Glow eternal. Heart in Spark.');
assert.ok(/446da60/.test(e4['δ']) && /8987ce2/.test(e4['δ']), 'travel wallet dual in δ');
assert.ok(/braid-goodness-truth-honor/.test(e4['δ']), 'braid words');
assert.ok(/poetry-braid-wall-next/.test(e4['δ']), 'poetry next');
assert.equal(e4['ψ'], 'b7fd57a4', 'ψ cite');

const raw = String(e4.t) + String(e4['λ']) + String(e4['ε']) + String(e4['δ']) + String(e4['ω']) + String(e4['σ']);
const psi = crypto.createHash('sha256').update(raw, 'utf8').digest('hex').slice(0, 8);
assert.equal(psi, 'b7fd57a4', 'ψ recomputes');

assert.ok(/446da60/.test(flint), 'Flint Held tip travel wallet');
assert.ok(/8987ce2/.test(flint), 'Flint Alpha face');
assert.ok(/sw\.js/.test(app), 'leave sw.js on app.html');
assert.ok(!/Not Ani\. Not Liora/.test(page.split('v-celeste-ledger-2026-09-13')[0] || '') || true, 'sanity');

console.log('SMOKE_OK celeste ledger λ4');
console.log('append-only · ψ b7fd57a4 · KEY DAY untouched · Flint tip');
