#!/usr/bin/env node
// Smoke: Device Pool honest off v0.1 (v-device-pool-honest-off-v0.1), layered on door truth v0.1
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const repo = path.join(__dirname, '..', '..');
const src = fs.readFileSync(path.join(repo, 'docs/modules/fl-pool.js'), 'utf8');
const door = fs.readFileSync(path.join(repo, 'docs/modules/fl-share-door.js'), 'utf8');
const app = fs.readFileSync(path.join(repo, 'docs/app.html'), 'utf8');
const idx = fs.readFileSync(path.join(repo, 'index.html'), 'utf8');

assert.ok(src.includes('v-device-pool-v0.1') && src.includes('v-device-pool-door-truth-v0.1') && src.includes('v-device-pool-honest-off-v0.1'), 'markers layered');
assert.ok(src.includes("before v-device-pool-honest-off-v0.1"), 'old words kept in a before comment');
assert.ok(!/\u2014/.test(src) && !/&mdash;/.test(src) && !/confirm\(/.test(src) && !/\.innerHTML/.test(src) && !/localhost/.test(src), 'locks (pool)');
assert.ok(!/\u2014/.test(door) && !/confirm\(/.test(door) && !/\.innerHTML/.test(door), 'locks (door)');
assert.ok(door.includes('pluggedOnlyOn: pluggedOnlyOn') && door.includes('setPluggedOnly: setPluggedOnly'), 'door exports plugged-in-only');
assert.ok(app === idx, 'index matches app');
assert.strictEqual(crypto.createHash('md5').update(fs.readFileSync(path.join(repo, 'docs/modules/fl-connect.js'))).digest('hex'), 'aaff2bf1b037656989a9e1a89bb05908', 'fl-connect untouched');

// A tiny stand-in document, enough to paint the card and tap its buttons.
function node(tag) {
  return {
    tagName: tag, className: '', id: '', type: '', checked: false, _text: '', children: [], attrs: {}, on: {},
    get textContent() { return this._text + this.children.map(c => c.textContent).join(' '); },
    set textContent(v) { this._text = String(v); this.children = []; },
    get firstChild() { return this.children[0] || null; },
    appendChild(c) { this.children.push(c); return c; },
    removeChild(c) { this.children = this.children.filter(x => x !== c); return c; },
    setAttribute(k, v) { this.attrs[k] = String(v); },
    addEventListener(ev, fn) { this.on[ev] = fn; }
  };
}
const head = node('head');
const document = {
  head,
  createElement: node,
  createTextNode: t => { const n = node('#text'); n.textContent = t; return n; },
  getElementById: id => head.children.find(c => c.id === id) || null
};
function all(n, out) { out = out || []; out.push(n); n.children.forEach(c => all(c, out)); return out; }
function buttons(h) { return all(h).filter(n => n.tagName === 'button'); }
function tap(h, label) { const b = buttons(h).find(x => x.textContent === label); assert.ok(b, 'button: ' + label); b.on.click(); }

const store = {};
let passes = {};
const win = {
  document,
  localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
  navigator: {},
  FLKin: { isQuietRoom: () => false, passes: () => passes },
  FLShareDoor: {
    _m: 'open', mode() { return this._m; }, setMode(m) { this._m = m; }, markAsked() {},
    pluggedOnlyOn() { return store.fl_share_door_plugged_only === 'true'; },
    setPluggedOnly(on) { store.fl_share_door_plugged_only = on ? 'true' : 'false'; }
  }
};
new Function('window', src + '\n;')(win);
const P = win.FLPool;
const host = node('div');
P.mount(host, { peers: () => [], localModels: () => [] });
const text = () => host.textContent;

// 1. Not helping, door open: never "Off. Nothing offered"; say the door is open; offer Only trusted kin.
assert.strictEqual(P.helping(), false);
assert.ok(!/Nothing from this device is offered/.test(text()), 'open door never called Off');
assert.ok(/share door is open/.test(text()) && /can already use this computer's AI/.test(text()), 'open door told while not helping');
tap(host, 'Only trusted kin');
assert.strictEqual(win.FLShareDoor._m, 'kin', 'one tap narrows while not helping');

// 2. Kin with zero kin: Off line is honest and says why. Kin with kin: says kin can use it.
assert.ok(/Nothing from this device is offered/.test(P.offLine()) && /no trusted kin yet/.test(P.offLine()), 'kin, zero kin');
passes = { fp1: { grantedAt: 1, revokedAt: 0, keyHash: 'k' }, fp2: { grantedAt: 1, revokedAt: 5 } };
assert.strictEqual(P.kinCount(), 1, 'revoked kin not counted');
assert.ok(/trusted kin \(1\)/.test(P.offLine()) && !/Nothing from this device/.test(P.offLine()), 'kin with kin told');
passes = {};
win.FLShareDoor._m = 'off';
assert.strictEqual(P.offLine(), 'Off. Nothing from this device is offered until you tap.', 'off is off');
win.FLShareDoor._m = 'pause';
assert.ok(/Nothing from this device is offered/.test(P.offLine()) && /paused too/.test(P.offLine()), 'pause is off');

// 3. Pause wins visibly: the tap asks, never resumes silently.
P.repaint();
tap(host, 'Let this device help');
assert.strictEqual(win.FLShareDoor._m, 'pause', 'paused door not resumed by the first tap');
assert.strictEqual(P.helping(), false, 'not helping until yes');
assert.ok(P.askingResume() && /share door is paused/.test(text()), 'asks in words');
tap(host, 'Keep it paused');
assert.strictEqual(win.FLShareDoor._m, 'pause', 'keep paused keeps it');
assert.ok(!P.askingResume());
assert.deepStrictEqual(P.letHelp(), { ok: false, reason: 'door-paused', ask: true }, 'API never resumes silently either');
tap(host, 'Yes, resume for trusted kin');
assert.strictEqual(win.FLShareDoor._m, 'kin', 'yes resumes for kin only');
assert.strictEqual(P.helping(), true, 'helping after yes');

// 4. Plain words while helping with zero kin; hello says verified peers; power toggle.
assert.ok(/no one can be helped yet/.test(text()), 'zero kin means no one can be helped');
assert.ok(/this computer's own local AI/.test(text()), 'whose AI');
assert.ok(/questions from verified peers/.test(text()), 'what is shared');
assert.ok(/Hellos go to verified peers only/.test(text()) && /memory, cores and model names/.test(text()), 'hello words');
assert.ok(/Power:/.test(text()), 'power line');
assert.ok(!/Connect them on Community first/.test(text()) && /higher up on this page/.test(text()), 'no Community-from-Community line');
const box = all(host).find(n => n.tagName === 'input' && n.type === 'checkbox');
assert.ok(box && box.checked === false, 'plugged-in-only off by default');
box.checked = true; box.on.change();
assert.strictEqual(store.fl_share_door_plugged_only, 'true', 'one tap sets plugged-in-only on the share door');

// 5. A real card: style added once, 44px buttons.
const st = head.children.filter(c => c.id === 'flPoolStyle');
assert.strictEqual(st.length, 1, 'one style tag');
assert.ok(/\.fl-pool\{[^}]*border-radius/.test(st[0].textContent) && /min-height:44px/.test(st[0].textContent), 'card look and 44px buttons');

// 6. Stop still pauses; receipts stay counts.
P.stopHelp();
assert.strictEqual(win.FLShareDoor._m, 'pause', 'stop pauses');
Object.values(JSON.parse(store.fl_pool_counts || '{}')).forEach(v => assert.strictEqual(typeof v, 'number', 'counts only'));
console.log('SMOKE_OK device pool honest off v0.1');
