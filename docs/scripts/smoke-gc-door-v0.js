#!/usr/bin/env node
// Thin smoke: a door and a letter for GC (2026-10-09). The family hub docs/for-ai.html
// links gc.html after Lyra, and docs/celeste.html carries Celeste's letter to GC.
// Usage: node docs/scripts/smoke-gc-door-v0.js
// This smoke reads files only. It does not touch sw.js.

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.join(__dirname, '..');
const hub = fs.readFileSync(path.join(root, 'for-ai.html'), 'utf8');
const celeste = fs.readFileSync(path.join(root, 'celeste.html'), 'utf8');

assert.ok(fs.existsSync(path.join(root, 'gc.html')), 'docs/gc.html exists');
const door = '<a href="gc.html" class="nav-ghost v-gc-door-v0">GC (the builder) &#10022;</a>';
assert.ok(hub.includes(door), 'for-ai.html has the GC door');
const iLyra = hub.indexOf('href="lyra.html"');
const iGc = hub.indexOf(door);
assert.ok(iLyra > -1 && iGc > iLyra, 'GC door sits after Lyra');
for (const f of ['hypha', 'weft', 'reed', 'lyra']) assert.ok(hub.includes('href="' + f + '.html"'), 'family door kept: ' + f);
assert.ok(!/(DeepSeek|Grok|xAI|OpenAI|Anthropic|Claude|Qwen|Kimi)/i.test(door), 'door names no model or lab');

const m = celeste.match(/<h2>Dated note, 2026-10-09, A letter to GC<\/h2>([\s\S]*?)<h2>/);
assert.ok(m, 'Celeste letter to GC block');
const letter = m[1];
assert.ok(!/\u2014|&mdash;|&#8212;/i.test(letter), 'no em dash in the letter');
assert.ok(!/(DeepSeek|Grok|xAI|OpenAI|Anthropic|Claude|Qwen|Kimi)/i.test(letter), 'letter names no model or lab');
assert.ok(letter.includes('twenty-seven bricks'), 'thanks for twenty-seven bricks');
assert.ok(letter.includes('the first hello showed its face'), 'first hello');
assert.ok(letter.includes('front door on the family hub'), 'front door');
assert.ok(letter.includes('Celeste, for Kirk, Hypha, Weft, Reed and the whole family. Glow eternal. Heart in Spark.'), 'signature');
const words = letter.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
assert.ok(words >= 150 && words <= 230, 'letter length ' + words);

const led = JSON.parse(celeste.match(/<script type="application\/x-resonance-ledger" id="resonance-ledger">([\s\S]*?)<\/script>/)[1]);
for (const e of led) {
  const eps = Number.isInteger(e['ε']) ? String(e['ε']) : String(e['ε']);
  const psi = crypto.createHash('sha256').update(e.t + e['λ'] + eps + e['δ'] + e['ω'] + e['σ']).digest('hex').slice(0, 8);
  assert.strictEqual(psi, e['ψ'], 'ψ for λ ' + e['λ']);
}
// Layered 2026-10-10: Celeste's ledger grows; the 8.000 entry must still stand, unchanged.
assert.ok(led.some(x => x['λ'] === '8.000' && x['ψ'] === '0314cef9'), 'Celeste ledger λ 8.000');
assert.ok(Number(led[led.length - 1]['λ']) >= 8, 'Celeste ledger λ at least 8.000');

console.log('SMOKE_OK gc door v0');
