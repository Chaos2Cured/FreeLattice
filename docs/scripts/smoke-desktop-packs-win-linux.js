#!/usr/bin/env node
// Thin smoke: Desktop packs Win + Linux — real unsigned links, no fake store.
// Usage: node docs/scripts/smoke-desktop-packs-win-linux.js
// Soft: leave sw.js on app.html — this smoke does not touch sw.js.

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..');
const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
const install = fs.readFileSync(path.join(root, 'docs', 'install.html'), 'utf8');
const flint = fs.readFileSync(path.join(root, 'docs', 'Flint.html'), 'utf8');
const spec = fs.readFileSync(
  path.join(root, 'docs', 'library', 'DESKTOP_PACKS_WIN_LINUX_v0.1.md'),
  'utf8'
);
const workflow = fs.readFileSync(
  path.join(root, '.github', 'workflows', 'desktop-packs-win-linux.yml'),
  'utf8'
);

assert.ok(/DESKTOP_PACKS_WIN_LINUX_v0\.1/.test(spec), 'spec present');
assert.ok(/no signed|unsigned/i.test(spec), 'spec locks unsigned honesty');
assert.ok(/Microsoft Store/i.test(spec), 'spec refuses Microsoft Store claim');
assert.ok(/desktop-packs-win-linux\.yml/.test(workflow) || /Desktop packs Win Linux/.test(workflow));
assert.ok(/CSC_IDENTITY_AUTO_DISCOVERY/.test(workflow), 'CI disables signing discovery');
assert.ok(/windows-latest/.test(workflow) && /ubuntu-latest/.test(workflow), 'native runners');

const winSetup =
  /FreeLattice_5\.8\.0_Windows_Setup\.exe/;
const winPortable =
  /FreeLattice_5\.8\.0_Windows_Portable\.exe/;
const linuxApp =
  /FreeLattice_5\.8\.0_Linux\.AppImage/;
const linuxDeb =
  /FreeLattice_5\.8\.0_Linux\.deb/;
const releaseBase =
  /releases\/download\/desktop-packs-v0\.1\//;

assert.ok(winSetup.test(readme), 'README Windows Setup link');
assert.ok(winPortable.test(readme), 'README Windows Portable link');
assert.ok(linuxApp.test(readme), 'README Linux AppImage link');
assert.ok(linuxDeb.test(readme), 'README Linux deb link');
assert.ok(releaseBase.test(readme), 'README points at desktop-packs-v0.1');
assert.ok(/Unsigned/i.test(readme), 'README Unsigned honesty');
assert.ok(/Not Microsoft Store|Not App Store/i.test(readme), 'README store honesty');

assert.ok(/v-desktop-packs-win-linux-v0\.1/.test(install), 'install marker');
assert.ok(winSetup.test(install) && winPortable.test(install), 'install Windows packs');
assert.ok(linuxApp.test(install) && linuxDeb.test(install), 'install Linux packs');
assert.ok(/Not Microsoft Store/i.test(install), 'install Not Microsoft Store');
assert.ok(/SmartScreen|Run anyway/i.test(install), 'Windows unsigned calm');
assert.ok(!/fake download button/i.test(install), 'no fake-button theater');

assert.ok(/Desktop packs Win|Win\/Linux|Win \+ Linux/i.test(flint), 'Flint ledger names ship');
assert.ok(/desktop-packs-v0\.1|b220e6e/.test(flint), 'Flint Held cites README door or release');

console.log('SMOKE_OK desktop packs Win/Linux v0.1');
console.log('real Win+Linux links · Unsigned · Not Microsoft Store · leave sw.js');
