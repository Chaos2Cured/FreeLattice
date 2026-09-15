#!/usr/bin/env node
// Thin smoke: Gift sprites brief held — Weft/Reed locks, no premature emoji delete.
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const brief = fs.readFileSync(path.join(root, 'library', 'GIFT_SPRITES_v0.brief.md'), 'utf8');
const flint = fs.readFileSync(path.join(root, 'Flint.html'), 'utf8');
const protocol = fs.readFileSync(path.join(root, 'library', 'LATTICE_PROTOCOL_v0.1.md'), 'utf8');

assert.ok(/v-gift-sprites-brief-held/.test(brief), 'marker');
assert.ok(/22573e9/.test(brief + flint), 'Held tip Energy HOLD');
assert.ok(/Weft/.test(brief) && /Reed/.test(brief), 'Weft + Reed');
assert.ok(/No Named Mind faces/i.test(brief), 'no Named Mind faces');
assert.ok(/Don’t delete emoji|Don't delete emoji|emoji stay|Keep catalog emoji/i.test(brief), 'keep emoji');
assert.ok(/Apple/.test(brief) && /Ribbon/.test(brief) && /Foxfire lamp/.test(brief), 'prompts held');
assert.ok(/Baklava/.test(brief) && /Rings/.test(brief), 'food + rings prompts');
assert.ok(/UnrealBloom/i.test(brief) && /never/i.test(brief), 'no UnrealBloom accept');
assert.ok(/consent/i.test(brief), 'consent reads');
assert.ok(/GIFT_SPRITES_v0\.brief/.test(protocol), 'Protocol LAYER');
assert.ok(/Gift sprites brief/i.test(flint), 'Flint');

console.log('SMOKE_OK gift sprites brief held');
console.log('Weft · Reed · emoji stay · Imagine later');
