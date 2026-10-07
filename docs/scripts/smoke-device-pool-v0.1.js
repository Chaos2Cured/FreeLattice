#!/usr/bin/env node
// Smoke: Device Pool v0.1 (v-device-pool-v0.1)
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const repo = path.join(__dirname, '..', '..');
const srcPath = path.join(repo, 'docs/modules/fl-pool.js');
const src = fs.readFileSync(srcPath, 'utf8');
const app = fs.readFileSync(path.join(repo, 'docs/app.html'), 'utf8');
const idx = fs.readFileSync(path.join(repo, 'index.html'), 'utf8');

assert.ok(src.includes('v-device-pool-v0.1'), 'marker');
assert.ok(src.includes('Let this device help'), 'one tap');
assert.ok(src.includes('classroom lab') && src.includes('teacher machine'), 'classroom lab words');
assert.ok(src.includes('Memory is not joined over a network'), 'honest line');
assert.ok(!/\u2014/.test(src) && !/&mdash;/.test(src), 'no emdash');
assert.ok(!/confirm\(/.test(src), 'no confirm');
assert.ok(!/\.innerHTML/.test(src), 'no innerHTML');
assert.ok(!/localhost/.test(src), 'no loopback name');
assert.ok(app.includes('modules/fl-pool.js') && app.includes('flPoolHost') && app.includes("case 'pool-hello'"), 'app wired');
assert.ok(app === idx, 'index matches app');
assert.strictEqual(crypto.createHash('md5').update(fs.readFileSync(path.join(repo, 'docs/modules/fl-connect.js'))).digest('hex'), 'aaff2bf1b037656989a9e1a89bb05908', 'fl-connect untouched');

// Behavior, headless
const store = {};
let quietOn = false;
const sent = [];
const routed = [];
const win = {
  localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
  navigator: { deviceMemory: 4, hardwareConcurrency: 8 },
  FLKin: { isQuietRoom: () => quietOn },
  FLShareDoor: { _m: 'off', mode() { return this._m; }, setMode(m) { this._m = m; }, markAsked() {} }
};
new Function('window', src + '\n;')(win);
const P = win.FLPool;
const peerV = { id: 'p1', name: 'Old phone', verified: true, send: o => sent.push(o) };
const peerU = { id: 'p2', name: 'Stranger', verified: false, send: o => sent.push(o) };
P.use({ peers: () => [peerV, peerU], localModels: () => [{ name: 'llama3.2', size: 2e9 }], route: (id, m) => routed.push([id, m]) });

assert.strictEqual(P.helping(), false, 'off by default');
(async () => {
  assert.strictEqual(await P.sayHello(), 0, 'no hello before consent');
  P.letHelp();
  assert.strictEqual(win.FLShareDoor._m, 'kin', 'one tap opens to kin only');
  await new Promise(r => setTimeout(r, 10));
  assert.strictEqual(sent.length, 1, 'hello only to verified');
  const h = sent[0];
  assert.deepStrictEqual(Object.keys(h).sort(), ['browserAI', 'cores', 'mem', 'models', 'type', 'v'], 'hello carries no keys or words');
  assert.strictEqual(h.mem, 4);
  assert.ok(!P.receive(h, peerU).ok, 'unverified dropped');
  assert.ok(P.receive(h, peerV).ok, 'verified taken');
  assert.deepStrictEqual(P.whoHas('llama3.2').map(x => x.id), ['p1'], 'whoHas');
  assert.ok(P.useMind('p1', 'llama3.2') && routed.length === 1, 'route whole question');
  quietOn = true;
  assert.ok(!P.receive(h, peerV).ok, 'quiet room drops');
  assert.strictEqual(P.useMind('p1', 'llama3.2'), false, 'quiet room no route');
  quietOn = false;
  P.stopHelp();
  assert.strictEqual(win.FLShareDoor._m, 'pause', 'stop pauses');
  const counts = JSON.parse(store.fl_pool_counts);
  Object.values(counts).forEach(v => assert.strictEqual(typeof v, 'number', 'counts only'));
  console.log('SMOKE_OK device pool v0.1');
})().catch(e => { console.error(e); process.exit(1); });
