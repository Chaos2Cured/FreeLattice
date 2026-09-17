#!/usr/bin/env node
// Thin smoke: Workshop porch v0 — Create calm · History · Stop.
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const ws = fs.readFileSync(path.join(root, 'modules', 'workshop.js'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.html'), 'utf8');
const mirror = fs.readFileSync(path.join(root, 'code-workshop.html'), 'utf8');
const doc = fs.readFileSync(path.join(root, 'library', 'WORKSHOP_PORCH_v0.md'), 'utf8');
const flint = fs.readFileSync(path.join(root, 'Flint.html'), 'utf8');

assert.ok(/v-workshop-porch-v0/.test(ws), 'workshop marker');
assert.ok(/v-workshop-porch-v0/.test(doc), 'doc marker');
assert.ok(/v-workshop-porch-v0/.test(mirror), 'code-workshop mirror note');

// Create primary · Code/Projects secondary
assert.ok(/ws-mode-create/.test(ws) && /Create/.test(ws), 'Create mode');
assert.ok(/ws-mode-secondary/.test(ws), 'Code/Projects secondary chrome');
assert.ok(/EXAMPLE_CHIPS|ws-chip|wsPorchChips/.test(ws), 'example chips');
assert.ok((ws.match(/ws-chip|EXAMPLE_CHIPS/g) || []).length >= 1, 'chips present');
assert.ok(/Simple calculator|Pomodoro|Color palette/.test(ws), '3–5 example prompts');

// History shelf
assert.ok(/fl_workshop_history_v0/.test(ws), 'history storage key');
assert.ok(/Remix|remixHistory|data-ws-remix/.test(ws), 'Remix');
assert.ok(/Clear|clearHistoryConsent|wsHistoryClear/.test(ws), 'consent clear');
assert.ok(/Load|data-ws-load|loadHistoryItem/.test(ws), 'Load');

// Hang Cancel Stop · workshop scope
assert.ok(/FLHangCancel\.begin\('workshop'\)/.test(ws), 'Create begin workshop');
assert.ok(/FLHangCancel\.abort\('workshop'\)/.test(ws), 'abort workshop');
assert.ok(/signal:\s*signal/.test(ws) || /signal: signal/.test(ws), 'signal to callAI');
assert.ok(/workshop/.test(app) && /_normScope|_slots/.test(app), 'FLHangCancel workshop scope');
assert.ok(/Cancel ≠ timeout|no kill-timer|no time limit/i.test(ws + doc), 'Cancel ≠ timeout');

// Sandbox sacred · API names
assert.ok(/sandbox="allow-scripts"/.test(ws), 'sandbox allow-scripts only');
assert.ok(!/sandbox="[^"]*allow-same-origin|allow-net|allow-top-navigation/.test(ws),
  'no extra sandbox perms');
assert.ok(/window\.Workshop\s*=|window\.Workshop =/.test(ws) || /Workshop = \{/.test(ws), 'Workshop name');
assert.ok(/window\.AutoBuilder/.test(ws), 'AutoBuilder name');

assert.ok(/Workshop porch|v-workshop-porch/i.test(flint), 'Flint note');
assert.ok(/487440b|fe564d9|d14eaf8/.test(flint + doc), 'Held tip lineage');

console.log('SMOKE_OK workshop porch v0');
console.log('Create porch · chips · History · Stop · sandbox allow-scripts');
