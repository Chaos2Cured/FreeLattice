#!/usr/bin/env node
// Smoke: Narrow door v0.2 (desktop session CORS bypass)
// Soft marker: v-narrow-door-v0.2
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const repo = path.join(__dirname, '..', '..');
const desk = fs.readFileSync(path.join(repo, 'desktop/main.js'), 'utf8');

assert.ok(desk.includes('v-narrow-door-v0.2'), 'marker');
assert.ok(/ses\.webRequest\.onBeforeRequest/.test(desk), 'onBeforeRequest present');
assert.ok(/ollamaDoorOpen\(method, path\)/.test(desk) || /ollamaDoorOpen\(method, path\)/.test(desk.replace(/\s/g,'')), 'door check in bypass');
assert.ok(desk.includes('ALLOWED_PAGE_ORIGINS') || desk.includes("https://freelattice.com"), 'allowed pages');
assert.ok(desk.includes('https://thelatticetree.com'), 'tree origin');
assert.ok(desk.includes("http://127.0.0.1:"), 'local app origin shape');

// Live star must not remain in setupCORSBypass body
const bypass = desk.match(/function setupCORSBypass\(\) \{[\s\S]*?\n\}/);
assert.ok(bypass, 'setupCORSBypass found');
const body = bypass[0];
const live = body.replace(/\/\/.*?$/gm, '');
assert.ok(!/Access-Control-Allow-Origin'\] = \['\*'\]/.test(live), 'no star assign in bypass');
assert.ok(!/Allow-Origin['"\s]*:\s*['"]\*/.test(live), 'no star literal in bypass');
assert.ok(/Access-Control-Allow-Origin'\] = \[origin\]/.test(body), 'echoes allowed origin');
assert.ok(body.includes('before v-narrow-door-v0.2'), 'before comment kept');
assert.ok(/callback\(\{ cancel: true \}\)/.test(body), 'cancels closed doors');
assert.ok(!/\u2014/.test(body), 'no emdash in bypass');

// v0.1 still holds
assert.ok(desk.includes('v-narrow-door-v0.1'), 'v0.1 table held');
assert.ok(!/^\s*res\.setHeader\('Access-Control-Allow-Origin', '\*'\);/m.test(desk), 'local server still no star');

console.log('SMOKE_OK narrow door v0.2');
