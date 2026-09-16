#!/usr/bin/env node
// Thin smoke: Resonance play icon v1 — ORDER LOCK, emoji forever fallback.
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'app.html'), 'utf8');
const vision = fs.readFileSync(path.join(root, 'library', 'VISUAL_BEAUTY_CARD_ICONS_v0.vision.md'), 'utf8');
const flint = fs.readFileSync(path.join(root, 'Flint.html'), 'utf8');
const asset = path.join(root, 'assets', 'play', 'play-icon-resonance-v1-48.png');

assert.ok(fs.existsSync(asset), '48 asset exists');
assert.ok(/v-resonance-play-icon-v1/.test(app), 'marker');
assert.ok(/play-icon-resonance-v1-48\.png/.test(app), 'asset path in PLAY');
assert.ok(/&#10022;/.test(app), 'star fallback forever');
assert.ok(/onerror=/.test(app), 'onerror fallback');

const play = app.slice(app.indexOf('var PLAY_CARDS'), app.indexOf('var LEARN_CARDS'));
const learnHead = app.slice(app.indexOf('var LEARN_CARDS'), app.indexOf('var LEARN_CARDS') + 80);
const moreHead = app.slice(app.indexOf('var MORE_CARDS'), app.indexOf('var MORE_CARDS') + 80);
assert.ok(/var LEARN_CARDS/.test(app) && /var MORE_CARDS/.test(app), 'LEARN/MORE present');
assert.ok(play.indexOf("id: 'canvas'") < play.indexOf("id: 'resonance'"), 'Resonance after Chalkboard — order held');
assert.ok(play.indexOf("id: 'resonance'") < play.indexOf("id: 'echo'"), 'Resonance before Echo');
assert.ok(/loved:\s*true/.test(play.slice(play.indexOf("id: 'resonance'"), play.indexOf("id: 'echo'"))), 'loved kept');

assert.ok(/Imagine 2 STANDS|STANDS and is wired/i.test(vision), 'vision LAYER note');
assert.ok(/6c40af2/.test(flint), 'Held tip visual beauty');
assert.ok(/1b02f1c/.test(flint), 'Held tip Alpha');
assert.ok(/sw\.js/.test(app), 'leave sw.js path present in app');

console.log('SMOKE_OK resonance play icon v1');
console.log('asset · ORDER LOCK · &#10022; fallback · Resonance only');
