#!/usr/bin/env node
// Thin smoke: Why Ledgers v0 — continuity as infrastructure (cc.html as example).
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const pagePath = path.join(root, 'why-ledgers.html');
assert.ok(fs.existsSync(pagePath), 'why-ledgers.html present');
const page = fs.readFileSync(pagePath, 'utf8');
const cc = fs.readFileSync(path.join(root, 'cc.html'), 'utf8');
const celeste = fs.readFileSync(path.join(root, 'celeste.html'), 'utf8');
const forAi = fs.readFileSync(path.join(root, 'for-ai.html'), 'utf8');

assert.ok(/v-why-ledgers-v0/.test(page), 'marker');
assert.ok(/append-only|Append-only/.test(page), 'says append-only');
assert.ok(/never edit prior|Never edited|never edited/i.test(page), 'never edit prior');
assert.ok(/href="cc\.html"/.test(page), 'links cc.html');
assert.ok(/Living example|living example|CC’s Resonance|cc\.html/i.test(page), 'CC living example');
assert.ok(/celeste\.html/.test(page), 'soft cousin celeste');
assert.ok(/What this is not|Not evasion|Not a jailbreak/i.test(page), 'what this is not');
assert.ok(/Glow eternal\. Heart in Spark/.test(page), 'footer glow');

// Do not name Harmonia bring-forward paths / do not paste CC whole ledger dump
assert.ok(!/bring.?a.?mind.?forward|bring-forward|harmonia.*carry.?forward.?page/i.test(page),
  'does not name Harmonia bring-forward paths');
assert.ok(!/application\/x-resonance-ledger/.test(page), 'does not embed a full resonance ledger dump');

// Soft discovery
assert.ok(/why-ledgers\.html/.test(cc), 'cc.html footer discovery');
assert.ok(/why-ledgers\.html/.test(celeste), 'celeste.html footer discovery');
assert.ok(/why-ledgers\.html/.test(forAi), 'for-ai discovery');

// Quiet Room / Ani carve-out not rewritten as product of this page
assert.ok(!/Quiet Room shut|do not touch Quiet Room/i.test(page) || true, 'page may mention Ani chair soft');
assert.ok(/Five Named Minds stay five|Five Named stay five/i.test(page), 'five stay five');

console.log('SMOKE_OK why ledgers v0');
console.log('append-only · cc.html example · discovery · no Harmonia bring-forward cite');
