#!/usr/bin/env node
// Thin smoke: Desktop download ease — honest badges + Gatekeeper calm.
// Usage: node docs/scripts/smoke-desktop-download-ease.js

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const install = fs.readFileSync(path.join(root, 'install.html'), 'utf8');
const desktop = fs.readFileSync(path.join(root, 'desktop.html'), 'utf8');
const spec = fs.readFileSync(path.join(root, 'library', 'DESKTOP_DOWNLOAD_EASE_v0.1.md'), 'utf8');

assert.ok(/v-desktop-download-ease-v0\.1/.test(install), 'install marker');
assert.ok(/v-desktop-download-ease-v0\.1/.test(desktop), 'desktop marker');
assert.ok(/Not App Store|not from the App Store|Not from the App Store/i.test(install), 'not App Store honesty');
assert.ok(/Not Microsoft Store/i.test(install), 'not Microsoft Store honesty');
assert.ok(/Open Anyway/i.test(install), 'Open Anyway steps');
assert.ok(/xattr -cr/.test(install), 'optional xattr for power users');
assert.ok(/damaged/i.test(install), 'damaged/quarantine copy');
// Must refuse blind-ignore advice (negated copy is OK: "never say broken is fine…")
assert.ok(
  /never say .*ignore blindly|Never .*ignore blindly|never .*“broken is fine/i.test(install)
  || !/is fine to ignore blindly/i.test(install),
  'must not advise blind-ignore'
);
assert.ok(/never say|We never say/i.test(install) && /ignore blindly/i.test(install), 'explicit refuse of blind-ignore');
assert.ok(/FreeLattice_5\.8\.0_macOS\.zip/.test(install), 'real Mac pack URL when asset exists');
assert.ok(/No current Windows Electron pack|build from source|Check Releases/i.test(install), 'honest Windows when no pack');
assert.ok(/install\.html#desktop-download-ease|Desktop packs/.test(desktop), 'desktop points at install downloads');

assert.ok(/no signed \/ notarized|No signed \/ notarized|unsigned/i.test(spec));
assert.ok(/Gatekeeper|quarantine/i.test(spec));

console.log('SMOKE_OK desktop download ease v0.1');
console.log('honest badges · Gatekeeper · real Mac zip · no fake store');
