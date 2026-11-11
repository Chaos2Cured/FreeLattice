#!/usr/bin/env node
// v-packs-v03-links-v0.1: the six desktop-packs-v0.3 (5.8.2) files come first, with their hashes; v0.2 and v0.1 stay.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
let passed = 0;
function ok(cond, msg) { assert.ok(cond, msg); passed++; }

const hashes = {
  'FreeLattice_5.8.2_Windows_Setup.exe': 'c056970390ee8cd215625277195086fcfba111a45944d48ec6dc6ec4c2c14f04',
  'FreeLattice_5.8.2_Windows_Portable.exe': '418f4aa38f1046872b9e9cfda4d1d2d841caafb9a655c67312d3844003d19fd2',
  'FreeLattice_5.8.2_Linux.AppImage': '84d56a84bc36a7bff74f3b2a565c81940bab1580406c7a63d92619537780ef78',
  'FreeLattice_5.8.2_Linux.deb': '0c788ae041424a2a8e38fb15f19c3e819f84fc24dd512d5eaa1517824cd70cc0',
  'FreeLattice_5.8.2_macOS.dmg': '45048b402fb2d25128b8641a5ac606f3804ec22cb0ef6da3b061efd9f544bff9',
  'FreeLattice_5.8.2_macOS.zip': 'faa791f7723dbfe6ecf87bddce9c7c0fb89029d6968de2ee39e4761b79235b03'
};
const base = 'https://github.com/Chaos2Cured/FreeLattice/releases/download/';
['docs/install.html', 'docs/desktop.html', 'README.md'].forEach((rel) => {
  const text = fs.readFileSync(path.join(root, rel), 'utf8');
  Object.keys(hashes).forEach((name) => {
    const v3 = text.indexOf(base + 'desktop-packs-v0.3/' + name);
    ok(v3 !== -1, rel + ' names v0.3 ' + name);
    ok(v3 < text.indexOf(base + 'desktop-packs-v0.2/'), rel + ' shows v0.3 ' + name + ' before v0.2');
  });
  ok(text.indexOf('https://github.com/Chaos2Cured/FreeLattice/releases/tag/desktop-packs-v0.3') !== -1, rel + ' names the v0.3 tag');
  ok(text.indexOf('https://github.com/Chaos2Cured/FreeLattice/releases/tag/desktop-packs-v0.2') !== -1, rel + ' still names v0.2');
  ok(text.indexOf('desktop-packs-v0.1') !== -1, rel + ' still names v0.1');
});
const install = fs.readFileSync(path.join(root, 'docs/install.html'), 'utf8');
Object.keys(hashes).forEach((name) => { ok(install.indexOf(hashes[name]) !== -1, 'v0.3 hash ' + name); });
ok(install.indexOf('certutil -hashfile FreeLattice_5.8.2_Windows_Setup.exe SHA256') !== -1, 'windows verify command');
ok(install.indexOf('shasum -a 256 FreeLattice_5.8.2_macOS.dmg') !== -1, 'mac verify command');
ok(install.indexOf('sha256sum FreeLattice_5.8.2_Linux.AppImage') !== -1, 'linux verify command');
ok(install.indexOf('<strong>desktop-packs-v0.3</strong>') < install.indexOf('<strong>desktop-packs-v0.2</strong>'), 'v0.3 hashes first');
console.log('checks passed: ' + passed);
console.log('SMOKE_OK packs v03 links v0.1');
