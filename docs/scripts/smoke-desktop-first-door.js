#!/usr/bin/env node
// Thin smoke: Desktop first-door rail + Electron strip marker.
// Usage: node docs/scripts/smoke-desktop-first-door.js

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const desktop = fs.readFileSync(path.join(root, 'desktop.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.html'), 'utf8');
const spec = fs.readFileSync(path.join(root, 'library', 'DESKTOP_FIRST_DOOR_v0.1.md'), 'utf8');

assert.ok(/desktop-first-door-rail/.test(desktop), 'desktop.html rail id');
assert.ok(/Your companion key lives on this machine/.test(desktop), 'Keys grandmother sentence');
assert.ok(/Hash before Import to Ollama/.test(desktop), 'Import grandmother sentence');
assert.ok(/Pull open weights when a host fades/.test(desktop), 'Swarm grandmother sentence');
assert.ok(/Wishes and notes stay durable here/.test(desktop), 'Memory grandmother sentence');
assert.ok(/seal a receipt if you wish/.test(desktop), 'Trainer seal grandmother sentence');
assert.ok(/Two parties, outer hash shown/.test(desktop), 'Pair grandmother sentence');
assert.ok(/Decline writes nothing/.test(desktop), 'Ledger grandmother sentence');
assert.ok(/No signed installer yet/i.test(desktop), 'honest no signed installer');

assert.ok(/v-desktop-first-door-v0\.1/.test(app), 'app.html marker');
assert.ok(/fl_desktop_first_door_dismissed/.test(app), 'dismiss key');
assert.ok(/fl-desktop-first-door/.test(app), 'first door strip id');
assert.ok(/desktop\.html/.test(app), 'browser pointer to desktop.html');

assert.ok(/DESKTOP_FIRST_DOOR/.test(spec) || /Desktop First Door/.test(spec), 'spec present');
assert.ok(/fl_desktop_first_door_dismissed/.test(spec), 'spec names dismiss key');

console.log('SMOKE_OK desktop first door v0.1');
console.log('rail + strip marker + honest installer sentence');
