#!/usr/bin/env node
// Thin smoke: Mom dual — Grandmother One-click findable · Desktop Yes/No first-run · Connect Play held.
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const install = fs.readFileSync(path.join(root, 'install.html'), 'utf8');
const desktop = fs.readFileSync(path.join(root, 'desktop.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.html'), 'utf8');
const ledger = fs.readFileSync(path.join(root, 'library', 'MOM_GRANDMOTHER_DESKTOP_DUAL_LEDGER_v0.md'), 'utf8');
const flint = fs.readFileSync(path.join(root, 'Flint.html'), 'utf8');
const mainJs = fs.readFileSync(path.join(root, '..', 'desktop', 'main.js'), 'utf8');

assert.ok(/v-mom-grandmother-desktop-dual-v0/.test(install + desktop + app + ledger), 'marker');
assert.ok(/id="grandmother-path-start"/.test(install), 'grandmother-path-start');
assert.ok(/One-click home|START HERE/i.test(install), 'One-click / Start here');
assert.ok(/Download/.test(install) && /Open the file|Open/.test(install) && /Say yes|Gatekeeper|SmartScreen/i.test(install), 'three beats');
assert.ok(/install-freelattice\.command/.test(install) && /install-freelattice\.bat/.test(install), '.command + .bat');
assert.ok(/#desktop-download-ease|desktop-download-ease/.test(install), 'Prefer Desktop packs');
assert.ok(/releases\/download\/v5\.2\/install-freelattice\.(bat|command|sh)/.test(install), 'v5.2 pin (not broken latest)');
assert.ok(/raw\.githubusercontent\.com.*install-freelattice/.test(install), 'raw fallback');

assert.ok(/install\.html#grandmother-path-start/.test(app), 'Connect Play → grandmother');
assert.ok(/install\.html#desktop-download-ease/.test(app), 'Connect Play Prefer Desktop');
assert.ok(/Tired of browser allow notes|Browser blocked|Double-click Bridge|bridge-download/.test(app), 'soft Prefer / Bridge copy');
assert.ok(/id="fl-connect-play"/.test(app) && /flPlayYes/.test(app), 'Connect Play held');
assert.ok(/Please explain/.test(app), 'Yes/Not now/Please explain kept');

assert.ok(/Double-click home|Yes to local AI/i.test(desktop + install), 'Desktop Mom strip');
assert.ok(/A mind lives on this computer/.test(app), 'first-run question');
assert.ok(/flMomDesktopYesLook|Yes, look/.test(app), 'Yes, look');
assert.ok(/flMomDesktopNotNow|Not now/.test(app), 'Not now');
assert.ok(/flMomDesktopExplain|Please explain/.test(app), 'Please explain');
assert.ok(/getOllamaStatus|flOpenConnectWizard\('allowed'\)/.test(app), 'reuses probe path');
assert.ok(/function checkOllama|proxyToOllama|OLLAMA_HOST/.test(mainJs), 'desktop ollama proxy kept');
assert.ok(/MOM_GRANDMOTHER_DESKTOP_DUAL|Bridge binary held|LP = points|never human currency/i.test(ledger), 'ledger locks');
assert.ok(/Mom dual|grandmother|Desktop Yes\/No|v-mom-grandmother/i.test(flint), 'Flint diary');
assert.ok(/sw\.js/.test(app), 'leave sw.js');
assert.ok(/id="fl-connect-card"/.test(app), '#95 kept');

console.log('SMOKE_OK mom grandmother + desktop dual v0');
console.log('One-click · Desktop Yes/No · Connect Play Prefer Desktop · ollama proxy held');
