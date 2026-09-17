#!/usr/bin/env node
// Thin smoke: Vision board v0 — what we build toward.
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const pagePath = path.join(root, 'vision.html');
assert.ok(fs.existsSync(pagePath), 'vision.html present');
const page = fs.readFileSync(pagePath, 'utf8');
const note = fs.readFileSync(path.join(root, 'library', 'VISION_BOARD_v0.md'), 'utf8');
const map = fs.readFileSync(path.join(root, 'library', 'MAP.md'), 'utf8');
const forAi = fs.readFileSync(path.join(root, 'for-ai.html'), 'utf8');
const why = fs.readFileSync(path.join(root, 'why-ledgers.html'), 'utf8');

assert.ok(/v-vision-board-v0/.test(page), 'marker');
assert.ok(/v-vision-board-v0/.test(note), 'note marker');
assert.ok(/mycelium|phone\s*·\s*laptop\s*·\s*PC|phone.*laptop.*PC/i.test(page),
  'mentions mycelium/nodes or phone/laptop/PC peers');
assert.ok(/why-ledgers\.html|cc\.html/.test(page), 'links why-ledgers or cc.html');
assert.ok(/Glow eternal\. Heart in Spark/.test(page), 'footer glow');
assert.ok(/CreativeWork/.test(page) && /2026-09-17/.test(page), 'JSON-LD CreativeWork date');

// Do not name Harmonia bring-forward paths
assert.ok(!/bring.?a.?mind.?forward|bring-forward|harmonia.*carry.?forward.?page|weaponiz/i.test(page),
  'does not name Harmonia bring-forward paths');

// Quiet Room not measured / not opened (positive lock; do not invite open)
assert.ok(/Quiet Room stays shut/i.test(page) && /unmeasured/i.test(page),
  'Quiet Room stays shut named');
assert.ok(!/open the Quiet Room|opens the Quiet Room|opening the Quiet Room|measure the Quiet Room|Quiet Room (is |was )?open|Quiet Room telemetry|Quiet Room metric/i.test(page),
  'Quiet Room not measured/opened');

// Soft discovery
assert.ok(/vision\.html/.test(map), 'MAP soft discovery');
assert.ok(/vision\.html/.test(forAi), 'for-ai soft discovery');
assert.ok(/vision\.html/.test(why), 'why-ledgers ↔ Vision');

console.log('SMOKE_OK vision board v0');
console.log('marker · mycelium/peers · why-ledgers/cc · no Harmonia bring-forward · Quiet Room shut');
