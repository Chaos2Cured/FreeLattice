#!/usr/bin/env node
// Thin smoke: Connect Play lab · bottom 🌿 · yes/no/please · gate Change Provider · keep #95.
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'app.html'), 'utf8');
const ledger = fs.readFileSync(path.join(root, 'library', 'CONNECT_PLAY_LAB_LEDGER_v0.md'), 'utf8');
const flint = fs.readFileSync(path.join(root, 'Flint.html'), 'utf8');

assert.ok(/v-connect-play-lab-v0/.test(app), 'marker');
assert.ok(/id="fl-connect-play"/.test(app), 'bottom #fl-connect-play');
assert.ok(/&#127807; Connect|🌿 Connect/.test(app), '🌿 Connect label');
assert.ok(/function flOpenConnectPlay|flOpenConnectPlay\s*=/.test(app), 'flOpenConnectPlay');
assert.ok(/window\.flOpenConnectPlay\s*=/.test(app), 'flOpenConnectPlay exposed');
assert.ok(/function flOpenConnectWizard|flOpenConnectWizard\s*=/.test(app), 'wizard kept');
assert.ok(/window\.flOpenConnectWizard\s*=/.test(app), 'wizard still exposed');
assert.ok(/id="fl-connect-card"/.test(app), '#95 Connect card kept');

// Steps Welcome → allow → minds → cors → empty → done
['welcome', 'allow', 'minds', 'cors', 'empty', 'done'].forEach(function (st) {
  assert.ok(new RegExp('data-play="' + st + '"').test(app), 'step ' + st);
});

// Every step Yes · Not now · Please explain
const panelStart = app.indexOf('id="fl-connect-play-panel"');
assert.ok(panelStart > 0, 'play panel');
const panelEnd = app.indexOf('chatDisclaimer', panelStart);
const panel = app.slice(panelStart, panelEnd > 0 ? panelEnd : panelStart + 12000);
['welcome', 'allow', 'minds', 'cors', 'empty', 'done'].forEach(function (st) {
  const start = panel.indexOf('data-play="' + st + '"');
  assert.ok(start >= 0, 'panel step ' + st);
  const next = panel.indexOf('data-play="', start + 12);
  const slice = panel.slice(start, next > 0 ? next : start + 2000);
  assert.ok(/flPlayYes|Yes/.test(slice), st + ' Yes');
  assert.ok(/flPlayNotNow|Not now/.test(slice), st + ' Not now');
  assert.ok(/flPlayExplain|Please explain/.test(slice), st + ' Please explain');
});

assert.ok(/Copy note|flPlayCopyNote/.test(app), 'Copy note');
assert.ok(/I did that/.test(app), 'I did that');
assert.ok(/desktop\.html/.test(panel), 'Desktop soft');
assert.ok(/flPlayGateProvider|Gate Change Provider|flHasOneMindConnected/.test(app), 'gate helpers');
assert.ok(/openProviderModal[\s\S]{0,400}flPlayGateProvider/.test(app), 'Change Provider gated');

assert.ok(/CONNECT_PLAY_LAB_LEDGER|v-connect-play-lab-v0/.test(ledger), 'ledger');
assert.ok(/nexus|trust/i.test(ledger), 'soft nexus/trust vision line');
assert.ok(/Bridge binary|custom browser|delete.*#95|Out of scope/i.test(ledger), 'out of scope named');
assert.ok(/flOpenConnectWizard/.test(ledger), 'do not break wizard named');
assert.ok(/Connect Play|connect-play|v-connect-play-lab/i.test(flint) || /v-connect-play-lab-v0/.test(flint), 'Flint diary');
assert.ok(/sw\.js/.test(app), 'leave sw.js');
assert.ok(/v-connect-card-yesno-wizard-v0/.test(app), '#95 marker kept');
assert.ok(/v-browser-local-ai-wizard-v0|47b01b6|bfba3f3/.test(app + ledger), 'held tips');

console.log('SMOKE_OK connect play lab v0');
console.log('bottom lab · yes/no/please · gate · #95 kept · wizard intact');
