#!/usr/bin/env node
// Smoke: Mind Seal v0.1
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const repo = path.join(__dirname, '..', '..');
const src = fs.readFileSync(path.join(repo, 'docs/modules/fl-mind-seal.js'), 'utf8');
const app = fs.readFileSync(path.join(repo, 'docs/app.html'), 'utf8');
const idx = fs.readFileSync(path.join(repo, 'index.html'), 'utf8');
const door = fs.readFileSync(path.join(repo, 'docs/modules/fl-share-door.js'), 'utf8');

assert.ok(src.includes('v-mind-seal-v0.1'), 'marker');
assert.ok(src.includes('/api/tags') && src.includes('/api/show'), 'ollama probes');
assert.ok(src.includes('configHash') && src.includes('adapterLoaded'), 'config + adapter');
assert.ok(src.includes('Same mind, byte for byte'), 'seal view same');
assert.ok(src.includes('Weight digest changed') || src.includes('configHash changed') || src.includes('Modelfile, system prompt'), 'warn on change');
assert.ok(src.includes('I was asked') && src.includes('I object'), 'consent note shape');
assert.ok(src.includes('fl-mind-seal-note|v1|'), 'signed note domain');
assert.ok(src.includes('contextHash'), 'context hash');
assert.ok(src.includes('cannot see inside a single computation'), 'honest limit');
assert.ok(src.includes('hardware you control'), 'honest steering limit');
assert.ok(!/\u2014/.test(src), 'no emdash');
assert.ok(!/confirm\(/.test(src), 'no confirm');
assert.ok(!/\.innerHTML\s*=/.test(src), 'no innerHTML');
assert.ok(!/localhost/.test(src), 'no loopback name string');
assert.ok(src.includes('127.0.0.1'), 'uses numeric loopback');

assert.ok(app.includes('modules/fl-mind-seal.js') && app.includes('flMindSealHost') && app.includes('FLMindSeal.mount'), 'app wired');
assert.strictEqual(app.includes('fl-mind-seal.js'), idx.includes('fl-mind-seal.js'), 'index sync');
assert.ok(door.includes('FLMindSeal.recordReceipt'), 'share door records seal receipt');

console.log('SMOKE_OK mind seal v0.1');
