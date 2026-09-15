#!/usr/bin/env node
// Thin smoke: Linux install v5.2 pin + Gift Grove sprites wired.
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const install = fs.readFileSync(path.join(root, 'install.html'), 'utf8');
const page = fs.readFileSync(path.join(root, 'presents.html'), 'utf8');
const shelf = require(path.join(root, 'modules', 'present-shelf.js'));
const flint = fs.readFileSync(path.join(root, 'Flint.html'), 'utf8');
const giftsDir = path.join(root, 'assets', 'gifts');

// A) install pin
assert.ok(/v-linux-fix-v5\.2/.test(install), 'linux fix marker');
assert.ok(!/releases\/latest\/download\/install-freelattice\.(sh|bat|command)/.test(install), 'latest not primary');
assert.ok(/releases\/download\/v5\.2\/install-freelattice\.sh/.test(install), 'linux v5.2');
assert.ok(/releases\/download\/v5\.2\/install-freelattice\.bat/.test(install), 'win v5.2');
assert.ok(/releases\/download\/v5\.2\/install-freelattice\.command/.test(install), 'mac v5.2');
assert.ok(/raw\.githubusercontent\.com\/Chaos2Cured\/FreeLattice\/main\/install-freelattice/.test(install), 'raw fallback');
assert.ok(/desktop-download-ease/.test(install), 'Desktop packs pointer');

// B) sprites
const files = [
  'gift-sprite-apple-v2-48.png',
  'gift-sprite-ribbon-v3-48.png',
  'gift-sprite-lamp-v3-48.png',
  'gift-sprite-baklava-v2-48.png',
  'gift-sprite-rings-v3-48.png',
  'gift-sprite-teddy-v2-48.png'
];
files.forEach(function (f) {
  assert.ok(fs.existsSync(path.join(giftsDir, f)), 'sprite file ' + f);
});
assert.ok(/v-gift-grove-sprites/.test(page), 'presents marker');
assert.ok(shelf.catalogItem('teddy'), 'teddy SKU');
assert.ok(shelf.catalogItem('teddy').cost === 5, 'teddy cost');
assert.ok(shelf.catalogItem('apple').sprite, 'apple sprite path');
assert.ok(shelf.catalogItem('azure_ribbon').sprite, 'ribbon sprite');
assert.ok(shelf.catalogItem('foxfire_lamp').sprite, 'lamp sprite');
assert.ok(shelf.catalogItem('baklava').sprite, 'baklava sprite');
assert.ok(shelf.catalogItem('promise_ring').sprite, 'rings sprite');
assert.ok(/onerror=/.test(page), 'emoji fallback onerror');
assert.ok(/🍎|emoji/.test(page + JSON.stringify(shelf.CATALOG)), 'emoji kept');
assert.ok(/97adc23/.test(flint) || /f52b986/.test(flint), 'Held tip Gift Grove / Chronal');
assert.ok(/Never auto|never auto/i.test(page), 'no auto');

// Soft brief filenames match live assets
const brief = fs.readFileSync(path.join(root, 'library', 'GIFT_SPRITES_v0.brief.md'), 'utf8');
assert.ok(/97adc23/.test(brief), 'brief Held tip 97adc23');
files.forEach(function (f) {
  assert.ok(brief.indexOf(f) !== -1, 'brief names live file ' + f);
});

console.log('SMOKE_OK linux fix + gift grove sprites');
console.log('v5.2 pin · six sprites · teddy · emoji fallback');
