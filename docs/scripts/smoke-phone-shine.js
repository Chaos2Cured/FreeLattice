#!/usr/bin/env node
// Thin smoke: phone shine + grandmother START HERE fold.
// Usage: node docs/scripts/smoke-phone-shine.js

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const install = fs.readFileSync(path.join(root, 'install.html'), 'utf8');
const desktop = fs.readFileSync(path.join(root, 'desktop.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.html'), 'utf8');
const spec = fs.readFileSync(path.join(root, 'library', 'PHONE_SHINE_v0.1.md'), 'utf8');

// A) Grandmother soft leftover
const heroEnd = install.indexOf('<!-- Download Section -->');
const startHere = install.indexOf('id="grandmother-path-start"');
const faq = install.indexOf('class="troubleshoot"');
assert.ok(startHere !== -1 && heroEnd !== -1, 'Start here present');
assert.ok(startHere < heroEnd, 'START HERE above download / above fold');
assert.ok(faq === -1 || startHere < faq, 'START HERE before FAQ/troubleshoot');
assert.ok(/>START HERE</.test(install), 'install casing START HERE');
assert.ok(/>START HERE</.test(desktop), 'desktop casing START HERE');
assert.ok(/v-grandmother-path-v0\.1/.test(app) && /fl-grandmother-path-start|START HERE/.test(app), 'app START HERE pointer');

// B) Phone shine
assert.ok(/v-phone-shine-v0\.1/.test(app), 'phone shine marker');
assert.ok(/id="fl-phone-shine"/.test(app), 'phone shine strip');
assert.ok(/#fl-lp-give/.test(app) && /#fl-model-manifest-card/.test(app), 'jump links');
const iShine = app.indexOf('id="fl-phone-shine"');
const iLp = app.indexOf('id="latticePointsSection"');
const iGive = app.indexOf('id="fl-lp-give"');
const iZone = app.indexOf('ZONE 1: YOUR AI');
assert.ok(iShine < iLp && iLp < iGive && iGive < iZone, 'LP+Give ordered before Your AI cave');
assert.ok(/v-lp-deepen-v0\.1/.test(app), 'deepen calm still present');
assert.ok(/mobile recover|Phone recover/i.test(app), 'recover copy');

assert.ok(/PHONE_SHINE|Phone Shine/i.test(spec));
assert.ok(/Never auto-give/i.test(spec));

console.log('SMOKE_OK phone shine v0.1 + grandmother fold');
console.log('START HERE above fold · LP/Give first-class · recover strip');
