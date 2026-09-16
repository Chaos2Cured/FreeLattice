#!/usr/bin/env node
// Thin smoke: Style Ledger v0 — dense Garden night grammar.
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const ledger = fs.readFileSync(path.join(root, 'library', 'STYLE_LEDGER_v0.md'), 'utf8');
const vision = fs.readFileSync(path.join(root, 'library', 'VISUAL_BEAUTY_CARD_ICONS_v0.vision.md'), 'utf8');
const flint = fs.readFileSync(path.join(root, 'Flint.html'), 'utf8');
const protocol = fs.readFileSync(path.join(root, 'library', 'LATTICE_PROTOCOL_v0.1.md'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.html'), 'utf8');

assert.ok(/v-style-ledger-v0/.test(ledger), 'marker');
assert.ok(/e92a5fa/.test(ledger + flint), 'Held tip Resonance');
assert.ok(/ba0ebd2/.test(ledger + flint), 'Held tip Alpha');
assert.ok(/ORDER LOCK/i.test(ledger), 'ORDER LOCK');
assert.ok(/#0c0a1a/.test(ledger) && /#e8b019/.test(ledger), 'palette');
assert.ok(/Garden breath|1\.06/.test(ledger), 'Garden breath');
assert.ok(/Never.*UnrealBloom|never UnrealBloom/i.test(ledger), 'no UnrealBloom');
assert.ok(/play-icon-<id>-vN-48\.png|play-icon-/.test(ledger), 'asset grammar');
assert.ok(/attach.*bytes|in-session/i.test(ledger), 'attach-bytes lesson');
assert.ok(/Echo/.test(ledger) && /awaiting chip|awaiting chip bytes/i.test(ledger), 'Echo paused honest');
assert.ok(/STYLE_LEDGER_v0/.test(vision + protocol), 'LAYER cites');
assert.ok(/Style Ledger/i.test(flint), 'Flint');
assert.ok(/sw\.js/.test(app), 'leave sw.js');
assert.ok(!/oauth\.com\/authorize/i.test(ledger), 'no OAuth');

console.log('SMOKE_OK style ledger v0');
console.log('ORDER LOCK · palette · breath · attach-bytes lesson · Echo awaits');
