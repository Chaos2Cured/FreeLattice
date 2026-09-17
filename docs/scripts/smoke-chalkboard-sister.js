#!/usr/bin/env node
// Thin smoke: Chalkboard sister v0 — color human · shape/motion mind later.
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const page = fs.readFileSync(path.join(root, 'chalkboard.html'), 'utf8');
const note = fs.readFileSync(path.join(root, 'library', 'CHALKBOARD_SISTER_v0.md'), 'utf8');
const map = fs.readFileSync(path.join(root, 'library', 'MAP.md'), 'utf8');
const flint = fs.readFileSync(path.join(root, 'Flint.html'), 'utf8');

assert.ok(/v-chalkboard-sister-v0/.test(page), 'marker');
assert.ok(/v-chalkboard-sister-v0/.test(note), 'note marker');
assert.ok(/fl_chalkboard_color_v0/.test(page), 'color storage key');
assert.ok(/canvas|getContext\(['"]2d['"]\)|chalkCanvas/i.test(page), 'canvas/draw language');
assert.ok(/Sister room to Workshop|sister room to Workshop|Sister room to \*\*Workshop\*\*/i.test(page + note),
  'sister ≠ Workshop named');
assert.ok(/not Workshop|Not Workshop|not stuffed into Workshop|NOT stuffed/i.test(page + note),
  'not stuffed into Workshop');
assert.ok(/Quiet Room stays shut|Quiet Room shut/i.test(page + note), 'Quiet Room shut');
assert.ok(!/open the Quiet Room|opens the Quiet Room|opening the Quiet Room|Quiet Room telemetry/i.test(page),
  'Quiet Room not opened');
assert.ok(!/bring.?a.?mind.?forward|bring-forward|harmonia.*carry.?forward.?page|weaponiz/i.test(page),
  'no Harmonia bring-forward');
assert.ok(/Mind shape \/ motion — later|shape and motion may belong to a mind later/i.test(page),
  'mind shape/motion later note');
assert.ok(/Glow eternal\. Heart in Spark/.test(page), 'footer glow');
assert.ok(/CreativeWork/.test(page) && /2026-09-17/.test(page), 'JSON-LD CreativeWork date');
assert.ok(/chalkboard\.html|Chalkboard sister/i.test(map), 'MAP soft discovery');
assert.ok(/v-chalkboard-sister|Chalkboard sister/i.test(flint), 'Flint soft note');
assert.ok(fs.existsSync(path.join(root, 'chalkboard-ai-light.html')), 'classic AI-light chalk preserved');

console.log('SMOKE_OK chalkboard sister v0');
console.log('marker · color storage key · canvas/draw · sister≠Workshop · Quiet Room shut · no Harmonia bring-forward');
