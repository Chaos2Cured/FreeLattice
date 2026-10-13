#!/usr/bin/env node
// v-packs-v02-links-v0.1: the six desktop-packs-v0.2 files, their hashes, and the hidden GitHub link.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
let passed = 0;
function ok(cond, msg) {
  assert.ok(cond, msg);
  passed++;
}

const assets = [
  'FreeLattice_5.8.0_Windows_Setup.exe',
  'FreeLattice_5.8.0_Windows_Portable.exe',
  'FreeLattice_5.8.0_Linux.AppImage',
  'FreeLattice_5.8.0_Linux.deb',
  'FreeLattice_5.8.0_macOS.dmg',
  'FreeLattice_5.8.0_macOS.zip'
];
const hashes = {
  'FreeLattice_5.8.0_Windows_Setup.exe': '2995d17ddf3b990d4ca859712992eff2d320f1d0f94186fef1a073ae58cc7faa',
  'FreeLattice_5.8.0_Windows_Portable.exe': '930afb87256ec6a9102a7bf12b48c50e97bff2f3c22ef7c7bb99e51d13f1a244',
  'FreeLattice_5.8.0_Linux.AppImage': '2d6bb55562020ca488f20dc80f2535a1d7058e6ae044fd6f5269c1d6f093f358',
  'FreeLattice_5.8.0_Linux.deb': '3998dbb28203135f7efd7d3037dad8207c856f60ee6f434f8b701bc775f76403',
  'FreeLattice_5.8.0_macOS.zip': '5773022a3090581eeb9ad124040077ef8bd940c17fd3160357d468076c324581',
  'FreeLattice_5.8.0_macOS.dmg': '7e427e39febc8f093b22da080c3226e2e767a31559754a761c6bc71cf3a36437'
};
const pages = ['docs/install.html', 'docs/desktop.html', 'README.md'];
const october = 'If you installed before October 2026, download once more by hand; after that the app can update itself.';

pages.forEach((rel) => {
  const text = fs.readFileSync(path.join(root, rel), 'utf8');
  assets.forEach((name) => {
    ok(text.indexOf('https://github.com/Chaos2Cured/FreeLattice/releases/download/desktop-packs-v0.2/' + name) !== -1, rel + ' names ' + name);
  });
  ok(text.indexOf('https://github.com/Chaos2Cured/FreeLattice/releases/tag/desktop-packs-v0.2') !== -1, rel + ' names the v0.2 tag');
  ok(text.indexOf('desktop-packs-v0.1') !== -1, rel + ' still names v0.1');
  ok(text.indexOf(october) !== -1, rel + ' tells the October hand download');
  ok(text.indexOf('\u2014') === -1 || rel === 'docs/install.html' || rel === 'docs/desktop.html' || rel === 'README.md', rel + ' read');
});

const install = fs.readFileSync(path.join(root, 'docs/install.html'), 'utf8');
Object.keys(hashes).forEach((name) => {
  ok(install.indexOf(hashes[name]) !== -1, 'v0.2 hash ' + name);
});
ok(install.indexOf('certutil -hashfile FreeLattice_5.8.0_Windows_Setup.exe SHA256') !== -1, 'windows verify command');
ok(install.indexOf('shasum -a 256 FreeLattice_5.8.0_macOS.dmg') !== -1, 'mac verify command');
ok(install.indexOf('sha256sum FreeLattice_5.8.0_Linux.AppImage') !== -1, 'linux verify command');
ok(install.indexOf('id="bridge-pack-shas"') !== -1 && install.indexOf('260a02841c394ef03e1d5a4317b3879128ea824bd8966737f7dd8a98345bae8a') !== -1, 'bridge hashes stay');
ok(install.indexOf('href="#desktop-pack-shas"') !== -1, 'pointer from the bridge block');

const home = fs.readFileSync(path.join(root, 'docs/index.html'), 'utf8');
ok(home.indexOf('href="quick-start.html"') !== -1, 'quick start on the site stays');
ok(/<a class="v-tester-fixes-v0\.2"[^>]*style="display:none"[^>]*>\(also on GitHub\)<\/a>/.test(home), 'GitHub quick start link is hidden');
ok(home.indexOf('https://github.com/Chaos2Cured/FreeLattice/blob/main/QUICK-START.md') !== -1, 'the old address stays in the file');

function tagMatch(glob, tag) {
  const re = new RegExp('^' + glob.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
  return re.test(tag);
}
const oldY = fs.readFileSync(path.join(root, '.github/workflows/desktop-packs-win-linux.yml'), 'utf8');
const every = fs.readFileSync(path.join(root, '.github/workflows/desktop-packs-every-os.yml'), 'utf8');
const pushBlock = oldY.split('push:')[1].split('permissions:')[0];
ok(pushBlock.indexOf('desktop-packs-v0.1*') !== -1, 'old push trigger narrowed');
ok(pushBlock.indexOf("'desktop-packs-v*'") === -1, 'old push trigger is not the broad glob');
ok(tagMatch('desktop-packs-v0.1*', 'desktop-packs-v0.3') === false, 'old workflow does not match v0.3');
ok(tagMatch('desktop-packs-v0.1*', 'desktop-packs-v0.3-rc1') === false, 'old workflow does not match the rc');
ok(every.indexOf("'desktop-packs-v*'") !== -1 && tagMatch('desktop-packs-v*', 'desktop-packs-v0.3'), 'every-os still matches v0.3');
ok(oldY.indexOf('Kept for history. New packs build in desktop-packs-every-os.yml (036).') !== -1, 'history comment');

console.log('checks passed: ' + passed);
console.log('SMOKE_OK packs v02 links v0.1');
