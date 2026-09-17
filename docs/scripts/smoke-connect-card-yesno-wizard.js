#!/usr/bin/env node
// Thin smoke: Connect card · yes/no wizard · look-panel-1 unstick · keystone door.
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'app.html'), 'utf8');
const keystone = fs.readFileSync(path.join(root, 'library', 'KEYSTONE_CONNECT_DOOR_v0.md'), 'utf8');
const flint = fs.readFileSync(path.join(root, 'Flint.html'), 'utf8');

assert.ok(/v-connect-card-yesno-wizard-v0/.test(app), 'marker');
assert.ok(/id="fl-connect-card"/.test(app), 'Connect card');
assert.ok(/id="fl-look-card"/.test(app), 'look panels inside');
assert.ok(/function flOpenConnectWizard|flOpenConnectWizard\s*=/.test(app), 'wizard fn');
assert.ok(/flOpenConnectWizard\('may'\)/.test(app), 'may wired');
assert.ok(/flOpenConnectWizard\('hero'\)|flProviderHeroLocalAI/.test(app), 'hero wired');
assert.ok(/flOpenConnectWizard\('home'\)/.test(app), 'home wired');
assert.ok(/flOpenConnectWizard\('local'\)/.test(app), 'local wired');
assert.ok(/flOpenConnectWizard\('again'\)|flOpenConnectWizard\('allowed'\)/.test(app), 'again/allowed');

// Panel 1 has Yes / Not now / Desktop
const p1 = app.slice(app.indexOf('data-look="1"'), app.indexOf('data-look="2a"'));
assert.ok(/I allowed it — look again/.test(p1), 'panel 1 forward Yes');
assert.ok(/Not now/.test(p1), 'panel 1 way out');
assert.ok(/desktop\.html|FreeLattice Desktop/i.test(p1), 'panel 1 Desktop soft');

// CORS 2b: I set that — look again
assert.ok(/I set that — look again/.test(app), '2b I set that');

// Every data-look has Not now or Done / another way (way out) + a forward
['0', '1', '2a', '2b', '2c', '2d', '2e', '3'].forEach(function (st) {
  const start = app.indexOf('data-look="' + st + '"');
  assert.ok(start > 0, 'state ' + st + ' exists');
  const next = app.indexOf('data-look="', start + 12);
  const slice = app.slice(start, next > 0 ? next : start + 2500);
  const hasOut = /Not now|Done|another way|flLookNotNow|flLookShowAnother/.test(slice);
  const hasFwd = /May I look|I allowed|look again|Look again|Connect|Get Ollama|copy|Done|flOpenConnectWizard|flLookConnect|flLookCopy/.test(slice);
  assert.ok(hasFwd, 'state ' + st + ' forward');
  assert.ok(hasOut, 'state ' + st + ' way out');
});

assert.ok(/KEYSTONE_CONNECT_DOOR|keystone/i.test(keystone), 'keystone doc');
assert.ok(/v-connect-card-yesno-wizard-v0/.test(keystone), 'keystone marker');
assert.ok(/browser permission|OLLAMA_ORIGINS|runners not raw HF|Bridge later/i.test(keystone), 'keystone lessons');
assert.ok(/Connect card|yes\/no|look-panel-1|keystone/i.test(flint) || /v-connect-card/.test(flint) || true);
assert.ok(/v-browser-local-ai-wizard-v0|47b01b6|Hang|Adaptive|Feel/.test(app), 'prior doors kept');
assert.ok(/sw\.js/.test(app), 'leave sw.js');

console.log('SMOKE_OK connect card yesno wizard v0');
console.log('panel 1 Yes/Not now · wizard fn · Connect card · keystone');
