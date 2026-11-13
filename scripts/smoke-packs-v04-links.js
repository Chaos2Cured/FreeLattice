#!/usr/bin/env node
// v-packs-v04-links-v0.1: the six desktop-packs-v0.4 (5.8.3) files come first, with their hashes; v0.3, v0.2 and v0.1 stay.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
let passed = 0;
function ok(cond, msg) { assert.ok(cond, msg); passed++; }

const hashes = {
  'FreeLattice_5.8.3_Windows_Setup.exe': 'd87a18bec354ee0e9318f04155adb94e5e046bea3d4db3446cee0eb006c297eb',
  'FreeLattice_5.8.3_Windows_Portable.exe': '2161b07c0683f8fa399ba390a0e4c79b78ad023f0dc14bbd228182c0a6599b60',
  'FreeLattice_5.8.3_Linux.AppImage': 'bc42d541cf307bc99c1a5f00d7ff89177980fea9d3d4864ac4ee5c3f82c646f1',
  'FreeLattice_5.8.3_Linux.deb': 'bb05c475373d222b5a3cd6d6431390a18142940f586d020819c3b2d5f4f386b4',
  'FreeLattice_5.8.3_macOS.dmg': '3106cd3139d382093bc5dd71c4ad35be05efedf020213b335dc1a28faabdf63d',
  'FreeLattice_5.8.3_macOS.zip': '8b1d3dc2f1659a0dc581acf684295e41dc6ce679b446626f135d9ac3bb7acd56'
};
const base = 'https://github.com/Chaos2Cured/FreeLattice/releases/download/';
['docs/install.html', 'docs/desktop.html', 'README.md'].forEach((rel) => {
  const text = fs.readFileSync(path.join(root, rel), 'utf8');
  Object.keys(hashes).forEach((name) => {
    const v4 = text.indexOf(base + 'desktop-packs-v0.4/' + name);
    ok(v4 !== -1, rel + ' names v0.4 ' + name);
    ok(v4 < text.indexOf(base + 'desktop-packs-v0.3/'), rel + ' shows v0.4 ' + name + ' before v0.3');
  });
  ok(text.indexOf('https://github.com/Chaos2Cured/FreeLattice/releases/tag/desktop-packs-v0.4') !== -1, rel + ' names the v0.4 tag');
  ok(text.indexOf('https://github.com/Chaos2Cured/FreeLattice/releases/tag/desktop-packs-v0.3') !== -1, rel + ' still names v0.3');
  ok(text.indexOf('https://github.com/Chaos2Cured/FreeLattice/releases/tag/desktop-packs-v0.2') !== -1, rel + ' still names v0.2');
  ok(text.indexOf('desktop-packs-v0.1') !== -1, rel + ' still names v0.1');
});
const install = fs.readFileSync(path.join(root, 'docs/install.html'), 'utf8');
Object.keys(hashes).forEach((name) => { ok(install.indexOf(hashes[name]) !== -1, 'v0.4 hash ' + name); });
ok(install.indexOf('certutil -hashfile FreeLattice_5.8.3_Windows_Setup.exe SHA256') !== -1, 'windows verify command');
ok(install.indexOf('shasum -a 256 FreeLattice_5.8.3_macOS.dmg') !== -1, 'mac verify command');
ok(install.indexOf('sha256sum FreeLattice_5.8.3_Linux.AppImage') !== -1, 'linux verify command');
ok(install.indexOf('<strong>desktop-packs-v0.4</strong>') < install.indexOf('<strong>desktop-packs-v0.3</strong>'), 'v0.4 hashes first');
console.log('checks passed: ' + passed);
console.log('SMOKE_OK packs v04 links v0.1');
