#!/usr/bin/env node
// Thin smoke: Visual beauty · card icons vision — ORDER LOCK, no paint tonight.
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const vision = fs.readFileSync(path.join(root, 'library', 'VISUAL_BEAUTY_CARD_ICONS_v0.vision.md'), 'utf8');
const poetry = fs.readFileSync(path.join(root, 'poetry.html'), 'utf8');
const gift = fs.readFileSync(path.join(root, 'library', 'GIFT_SPRITES_v0.brief.md'), 'utf8');
const flint = fs.readFileSync(path.join(root, 'Flint.html'), 'utf8');
const protocol = fs.readFileSync(path.join(root, 'library', 'LATTICE_PROTOCOL_v0.1.md'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.html'), 'utf8');

assert.ok(/v-visual-beauty-card-icons-vision/.test(vision), 'marker');
assert.ok(/d3479e2/.test(vision + flint), 'Held tip poetry braid');
assert.ok(/ORDER LOCK|Never reshuffle|never reshuffle/i.test(vision), 'ORDER LOCK');
assert.ok(/Resonance/.test(vision) && /style-bar/i.test(vision), 'Resonance style-bar');
assert.ok(/Quiet Room/.test(vision) && /no interior|veil|moon/i.test(vision), 'Quiet Room veil only');
assert.ok(/LIGHTHOUSE locked|LIGHTHOUSE/.test(vision), 'LIGHTHOUSE locked');
assert.ok(/Flow/.test(vision) && /MORE/.test(vision), 'Flow in MORE');
assert.ok(/emoji fallback|Emoji fallback/i.test(vision), 'emoji fallback');
assert.ok(/This stays on your phone until you choose to share/.test(poetry), 'grandmother line');
assert.ok(/fl_family_poetry_shelf/.test(poetry) || /device shelf/i.test(poetry), 'device shelf still named');
assert.ok(/fl_poetry_braid_wall/.test(poetry), 'braid key separate');
assert.ok(/VISUAL_BEAUTY_CARD_ICONS/.test(gift + protocol), 'LAYER cites');
assert.ok(/Out of scope tonight|Painting every icon/i.test(vision), 'not painting tonight');
assert.ok(!/oauth\.com\/authorize/i.test(vision + poetry), 'no OAuth');
assert.ok(/sw\.js/.test(app), 'leave sw.js');
// ORDER LOCK: PLAY_CARDS still present in app
assert.ok(/var PLAY_CARDS\s*=/.test(app) && /var LEARN_CARDS\s*=/.test(app) && /var MORE_CARDS\s*=/.test(app), 'card arrays present');

console.log('SMOKE_OK visual beauty card icons vision');
console.log('ORDER LOCK · Resonance style-bar · grandmother line · no paint tonight');
