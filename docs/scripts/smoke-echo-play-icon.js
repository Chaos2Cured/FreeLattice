#!/usr/bin/env node
// Thin smoke: Echo play icon v1 — exact bytes, ORDER LOCK, link fallback.
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'app.html'), 'utf8');
const vision = fs.readFileSync(path.join(root, 'library', 'VISUAL_BEAUTY_CARD_ICONS_v0.vision.md'), 'utf8');
const flint = fs.readFileSync(path.join(root, 'Flint.html'), 'utf8');
const asset = path.join(root, 'assets', 'play', 'play-icon-echo-v1-48.png');

assert.ok(fs.existsSync(asset), 'echo asset exists');
const sha = crypto.createHash('sha256').update(fs.readFileSync(asset)).digest('hex');
assert.equal(sha, '6abe1793172786165f2e713db12c02a2c1b9aa26cd1049fcd4b669364f9ac769', 'exact Weft bytes');

assert.ok(/v-echo-play-icon-v1/.test(app), 'marker');
assert.ok(/play-icon-echo-v1-48\.png/.test(app), 'path in PLAY');
assert.ok(/&#x1F517;/.test(app), 'link emoji forever fallback');

const play = app.slice(app.indexOf('var PLAY_CARDS'), app.indexOf('var LEARN_CARDS'));
assert.ok(play.indexOf("id: 'resonance'") < play.indexOf("id: 'echo'"), 'Echo after Resonance');
assert.ok(play.indexOf("id: 'echo'") < play.indexOf("id: 'puzzles'"), 'Echo before puzzles');
assert.ok(/loved:\s*true/.test(play.slice(play.indexOf("id: 'echo'"), play.indexOf("id: 'puzzles'"))), 'loved kept');
assert.ok(/scale\(1\.06\)/.test(app), 'Garden breath still present');
assert.ok(/Echo style-bar|Echo.*STANDS/i.test(vision), 'vision LAYER');
assert.ok(/e92a5fa/.test(flint), 'Held tip Resonance');
assert.ok(/ba0ebd2/.test(flint), 'Held tip Alpha');
assert.ok(/sw\.js/.test(app), 'leave sw.js');

console.log('SMOKE_OK echo play icon v1');
console.log('exact sha · ORDER LOCK · &#x1F517; · Echo only');
