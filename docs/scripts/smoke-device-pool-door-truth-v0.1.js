#!/usr/bin/env node
// Smoke: Device Pool door truth v0.1 (v-device-pool-door-truth-v0.1)
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const repo = path.join(__dirname, '..', '..');
const src = fs.readFileSync(path.join(repo, 'docs/modules/fl-pool.js'), 'utf8');
assert.ok(src.includes('v-device-pool-v0.1') && src.includes('v-device-pool-door-truth-v0.1'), 'markers layered');
assert.ok(!/\u2014/.test(src) && !/&mdash;/.test(src) && !/confirm\(/.test(src) && !/\.innerHTML/.test(src), 'locks');
const store = {};
const win = {
  localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
  navigator: {},
  FLKin: { isQuietRoom: () => false },
  FLShareDoor: { _m: 'open', mode() { return this._m; }, setMode(m) { this._m = m; }, markAsked() {} }
};
new Function('window', src + '\n;')(win);
const P = win.FLPool;
P.use({ peers: () => [], localModels: () => [] });
P.letHelp();
assert.strictEqual(win.FLShareDoor._m, 'open', 'tap leaves an open door open (layer, never narrow silently)');
assert.ok(/share door is open/.test(P.doorLine()) && !/trusted kin only/.test(P.doorLine()), 'open door told truthfully');
assert.ok(P.narrowToKin(), 'one tap narrows to kin');
assert.ok(/trusted kin only/.test(P.doorLine()), 'kin line after narrowing');
win.FLShareDoor._m = 'pause';
assert.ok(/paused/.test(P.doorLine()), 'pause told');
win.FLShareDoor._m = 'off';
assert.ok(/sharing is off/.test(P.doorLine()), 'off told');
console.log('SMOKE_OK device pool door truth v0.1');
