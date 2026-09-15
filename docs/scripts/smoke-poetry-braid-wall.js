#!/usr/bin/env node
// Thin smoke: Poetry braid wall vision — device shelf sacred, no generate.
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const vision = fs.readFileSync(path.join(root, 'library', 'POETRY_BRAID_WALL_v0.vision.md'), 'utf8');
const page = fs.readFileSync(path.join(root, 'poetry.html'), 'utf8');
const shelfSpec = fs.readFileSync(path.join(root, 'library', 'FAMILY_POETRY_SHELF_v0.1.md'), 'utf8');
const flint = fs.readFileSync(path.join(root, 'Flint.html'), 'utf8');
const protocol = fs.readFileSync(path.join(root, 'library', 'LATTICE_PROTOCOL_v0.1.md'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.html'), 'utf8');
const moduleJs = fs.readFileSync(path.join(root, 'modules', 'family-poetry-shelf.js'), 'utf8');

assert.ok(/v-poetry-braid-wall-vision/.test(vision + page), 'marker');
assert.ok(/9f8c200/.test(vision + flint), 'Held tip family poetry');
assert.ok(/184e0d9/.test(vision + flint), 'Held tip Celeste λ4');
assert.ok(/446da60/.test(vision + flint), 'Held tip travel wallet');

assert.ok(/No fake generate|no fake generate|No generate|does not generate/i.test(vision + page), 'no generate');
assert.ok(!/oauth\.com\/authorize|Connect with X|Sign in with Facebook/i.test(vision + page), 'no OAuth');
assert.ok(/consent/i.test(page + vision), 'consent language');
assert.ok(/fl_family_poetry_shelf/.test(moduleJs + shelfSpec), 'device shelf key present');
assert.ok(/fl_poetry_braid_wall/.test(page), 'braid stub separate key');
assert.ok(/device shelf|Device shelf/i.test(page + vision), 'device shelf named');
assert.ok(/Anonymous braid/.test(page + vision), 'anonymous braid');
assert.ok(/family-poetry-shelf|Keep a poem/i.test(page), 'device shelf UI still present');
assert.ok(/braid-consent|Consent every keep/i.test(page), 'consent checkbox');
assert.ok(/POETRY_BRAID_WALL/.test(protocol + shelfSpec), 'LAYER cites');
assert.ok(/Poetry braid wall/i.test(flint), 'Flint');
assert.ok(/sw\.js/.test(app), 'leave sw.js');

console.log('SMOKE_OK poetry braid wall vision');
console.log('no generate · device shelf sacred · consent · no OAuth');
