#!/usr/bin/env node
// Smoke: Mesh share warmth v0.1 (v-mesh-share-warmth-v0.1)
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const repo = path.join(__dirname, '..', '..');
const src = fs.readFileSync(path.join(repo, 'docs/modules/fl-share-warmth.js'), 'utf8');
const app = fs.readFileSync(path.join(repo, 'docs/app.html'), 'utf8');
const idx = fs.readFileSync(path.join(repo, 'index.html'), 'utf8');

assert.ok(src.includes('v-mesh-share-warmth-v0.1'), 'marker');
assert.ok(src.includes('Porch lantern'), 'lantern copy');
assert.ok(src.includes('Welcome. This porch lantern'), 'welcome');
assert.ok(src.includes('Other lit lanterns nearby'), 'resting pointer');
assert.ok(src.includes('Thank you for sharing'), 'thank-you');
assert.ok(src.includes('Move them to trusted kin'), 'guest-to-kin');
assert.ok(src.includes("trust the ledger, not because we're careless") || src.includes('trust the ledger, not because we\\\'re careless'), 'Reed line');
assert.ok(!/\u2014/.test(src), 'no emdash');
assert.ok(!/confirm\(/.test(src), 'no confirm');
assert.ok(!/\.innerHTML\s*=/.test(src), 'no innerHTML');
assert.ok(!/localhost/.test(src), 'no loopback name');

assert.ok(app.includes('modules/fl-share-warmth.js'), 'app loads warmth');
assert.ok(app.includes('flShareWarmthHost'), 'app host');
assert.ok(app.includes('FLShareWarmth.mount'), 'app mounts');
assert.strictEqual(app.includes('modules/fl-share-warmth.js'), idx.includes('modules/fl-share-warmth.js'), 'index sync script');
assert.strictEqual(app.includes('flShareWarmthHost'), idx.includes('flShareWarmthHost'), 'index sync host');

// Soft resting lines stay on the door; warmth owns the pointer helper
const door = fs.readFileSync(path.join(repo, 'docs/modules/fl-share-door.js'), 'utf8');
assert.ok(door.includes('This lantern is resting'), 'door soft lines held');

console.log('SMOKE_OK mesh share warmth v0.1');
