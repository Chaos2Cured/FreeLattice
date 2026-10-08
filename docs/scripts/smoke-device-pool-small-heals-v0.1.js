#!/usr/bin/env node
// Smoke: Device Pool small heals v0.1 (v-device-pool-small-heals-v0.1) and share door legacy heal
// (v-share-door-legacy-heal-v0.1). Layered on honest off v0.1.
// 1. The share door mode reader accepts the old quoted form; an older yes never opens a door by itself.
// 2. A Device Pool jump near the top of Community.
// 3. The Pool card names the hourly caps, read from the share door's own numbers.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');
const repo = path.join(__dirname, '..', '..');
const poolSrc = fs.readFileSync(path.join(repo, 'docs/modules/fl-pool.js'), 'utf8');
const doorSrc = fs.readFileSync(path.join(repo, 'docs/modules/fl-share-door.js'), 'utf8');
const app = fs.readFileSync(path.join(repo, 'docs/app.html'), 'utf8');
const idx = fs.readFileSync(path.join(repo, 'index.html'), 'utf8');

assert.ok(poolSrc.includes('v-device-pool-small-heals-v0.1') && poolSrc.includes('v-device-pool-honest-off-v0.1') && poolSrc.includes('v-device-pool-v0.1'), 'pool markers layered');
assert.ok(doorSrc.includes('v-share-door-legacy-heal-v0.1') && doorSrc.includes('v-mesh-share-door-v0.1'), 'door markers layered');
assert.ok(doorSrc.includes('before v-share-door-legacy-heal-v0.1'), 'old migration kept in a before comment');
for (const [name, s] of [['pool', poolSrc], ['door', doorSrc]]) {
  assert.ok(!/\u2014/.test(s) && !/&mdash;/.test(s) && !/confirm\(/.test(s) && !/\.innerHTML/.test(s), 'locks (' + name + ')');
}
assert.ok(!new RegExp('local' + 'host').test(poolSrc + doorSrc), 'no loopback name as a string');
assert.strictEqual(app, idx, 'index matches app');
assert.strictEqual(crypto.createHash('md5').update(fs.readFileSync(path.join(repo, 'docs/modules/fl-connect.js'))).digest('hex'), 'aaff2bf1b037656989a9e1a89bb05908', 'fl-connect untouched');
// admit() itself is unchanged: the same gate lines are still there.
assert.ok(doorSrc.includes("if (mode() === 'kin' && !kin) return { ok: false, reason: 'kin-only'"), 'admit kin gate unchanged');
assert.ok(doorSrc.includes("if (!allows()) return Promise.resolve({ ok: false, reason: 'paused-or-off'"), 'admit pause gate unchanged');

// ---- 1. Legacy heal, with the real share door module ----
function memStore(init) {
  const m = Object.assign({}, init || {});
  return { m, getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: k => { delete m[k]; } };
}
function dnode(tag) {
  return { tag, children: [], textContent: '', className: '', listeners: {},
    appendChild(c) { this.children.push(c); return c; },
    removeChild(c) { this.children = this.children.filter(x => x !== c); },
    get firstChild() { return this.children[0] || null; },
    setAttribute() {}, addEventListener(t, f) { this.listeners[t] = f; } };
}
function loadDoor(init) {
  const ls = memStore(init);
  const win = { crypto: crypto.webcrypto, localStorage: ls, TextEncoder, Uint8Array, ArrayBuffer, navigator: {},
    document: { createElement: dnode, createTextNode: t => ({ textContent: t, children: [] }) }, showToast: () => {} };
  win.window = win;
  vm.createContext(win);
  vm.runInContext(doorSrc, win);
  return { D: win.FLShareDoor, ls };
}
function allText(n) { return (n.textContent || '') + ' ' + (n.children || []).map(allText).join(' '); }
const peer = { verified: true, badge: { publicKey: { kty: 'OKP', x: 'stranger' } }, name: 'stranger' };

(async () => {
  // a. Old "share my AI with mesh peers" yes, never migrated: held paused, asked, gate closed.
  let { D, ls } = loadDoor({ fl_meshComputeSharing: 'true' });
  assert.strictEqual(D.mode(), 'pause', 'legacy yes reads as pause');
  assert.strictEqual(ls.m.fl_share_door_mode, 'pause', 'stored plain, not quoted');
  assert.strictEqual(D.allows(), false, 'legacy yes never opens the door by itself');
  assert.strictEqual(D.needsFirstAsk(), true, 'the share door card asks Keep sharing?');
  let r = await D.admit(peer, null, [{ role: 'user', content: 'hi' }], { allowLegacy: true });
  assert.strictEqual(r.reason, 'paused-or-off', 'stranger stopped at the door');
  assert.ok(D.receipts().some(x => x.event === 'consent' && x.reason === 'legacy-heal:pause'), 'heal leaves a receipt (no words)');
  let host = dnode('div'); D.mount(host, {});
  let t = allText(host);
  assert.ok(/Before this update/.test(t) && /paused until you choose/.test(t) && /Keep sharing\?/.test(t), 'ask tells the truth while paused');
  assert.ok(!/People you've connected with can use this computer's AI/.test(t), 'no "can use" claim while paused');

  // b. The broken quoted form left by the first migration.
  ({ D, ls } = loadDoor({ fl_meshComputeSharing: 'true', fl_share_door_mode: '"open"' }));
  assert.strictEqual(D.mode(), 'pause', 'quoted open reads as pause, never open');
  assert.strictEqual(ls.m.fl_share_door_mode, 'pause', 'quoted value healed to plain');
  assert.strictEqual(D.needsFirstAsk(), true, 'still asked');
  // Yes, share (a human) opens it; Only my trusted kin narrows it; Not now turns it off.
  assert.strictEqual(D.setMode('open', 'human'), true);
  assert.strictEqual(D.mode(), 'open', 'a human yes opens it');
  ({ D, ls } = loadDoor({ fl_meshComputeSharing: 'true', fl_share_door_mode: '"open"' }));
  D.markAsked(); D.setMode('kin', 'human');
  assert.strictEqual(D.mode(), 'kin');
  ({ D, ls } = loadDoor({ fl_share_door_mode: '"off"', fl_share_door_asked: 'true' }));
  assert.strictEqual(D.mode(), 'off', 'quoted off stays off');
  assert.strictEqual(ls.m.fl_share_door_mode, 'off');
  assert.strictEqual(D.needsFirstAsk(), false);

  // c. Newcomer with no old flag: off, never asked (as before).
  ({ D, ls } = loadDoor({}));
  assert.strictEqual(D.mode(), 'off');
  assert.strictEqual(ls.m.fl_share_door_mode, 'off', 'plain off');
  assert.strictEqual(ls.m.fl_share_door_asked, 'true');
  assert.strictEqual(D.needsFirstAsk(), false);
  assert.strictEqual(D.receipts().length, 0, 'no heal receipt for a newcomer');

  // d. Plain values read exactly as before.
  for (const m of ['open', 'kin', 'pause', 'off']) {
    ({ D } = loadDoor({ fl_share_door_mode: m, fl_share_door_asked: 'true' }));
    assert.strictEqual(D.mode(), m, 'plain ' + m);
    assert.strictEqual(D.receipts().length, 0, 'no heal receipt for plain ' + m);
  }
  ({ D } = loadDoor({ fl_share_door_mode: 'weird' }));
  assert.strictEqual(D.mode(), 'off', 'unknown plain value is off, as before');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(D.plainMode('"kin"'))), { m: 'pause', healed: true }, 'any other quoted value is held paused');

  // e. Caps exported, same numbers as the gate.
  assert.deepStrictEqual(JSON.parse(JSON.stringify(D.CAPS)), { perKey: 6, total: 20, windowMinutes: 60 }, 'caps exported');
  assert.ok(/var UNFAMILIAR_PER_KEY = 6;/.test(doorSrc) && /var UNFAMILIAR_TOTAL = 20;/.test(doorSrc), 'gate numbers unchanged');

  // ---- 2 and 3. Pool card: caps line and the Community jump ----
  function node(tag) {
    return {
      tagName: tag, className: '', id: '', type: '', checked: false, _text: '', children: [], attrs: {}, on: {}, parentNode: null,
      get textContent() { return this._text + this.children.map(c => c.textContent).join(' '); },
      set textContent(v) { this._text = String(v); this.children = []; },
      get firstChild() { return this.children[0] || null; },
      get firstElementChild() { return this.children[0] || null; },
      get nextSibling() { const p = this.parentNode; if (!p) return null; const i = p.children.indexOf(this); return p.children[i + 1] || null; },
      appendChild(c) { c.parentNode = this; this.children.push(c); return c; },
      insertBefore(c, ref) { c.parentNode = this; const i = this.children.indexOf(ref); if (i < 0) this.children.push(c); else this.children.splice(i, 0, c); return c; },
      removeChild(c) { this.children = this.children.filter(x => x !== c); return c; },
      setAttribute(k, v) { this.attrs[k] = String(v); },
      addEventListener(ev, fn) { this.on[ev] = fn; },
      querySelector(sel) { const cls = sel.replace(/^\./, ''); return all(this).find(n => n !== this && n.className.split(' ').indexOf(cls) !== -1) || null; },
      scrollIntoView() { scrolled.push(this); },
      focus() { focused.push(this); }
    };
  }
  function all(n, out) { out = out || []; out.push(n); n.children.forEach(c => all(c, out)); return out; }
  const scrolled = [], focused = [];
  const head = node('head');
  const body = node('body');
  const tab = node('div'); tab.id = 'tab-community';
  const cont = node('div'); cont.className = 'container';
  const lattice = node('div'); lattice._text = 'The Lattice';
  const feed = node('div'); feed.id = 'communityActivityFeed';
  body.appendChild(tab); tab.appendChild(cont); cont.appendChild(lattice); cont.appendChild(feed);
  const document = {
    head, body,
    createElement: node,
    createTextNode: x => { const n = node('#text'); n.textContent = x; return n; },
    getElementById: id => all(head).concat(all(body)).find(c => c.id === id) || null
  };
  const store = {};
  const win = {
    document,
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
    navigator: {},
    FLKin: { isQuietRoom: () => false, passes: () => ({}) },
    FLShareDoor: { _m: 'off', mode() { return this._m; }, setMode(m) { this._m = m; }, markAsked() {},
      pluggedOnlyOn() { return false; }, setPluggedOnly() {}, CAPS: D.CAPS }
  };
  new Function('window', poolSrc + '\n;')(win);
  const P = win.FLPool;
  const phost = node('div'); phost.id = 'flPoolHost';
  cont.appendChild(phost);
  P.mount(phost, { peers: () => [], localModels: () => [] });
  const capLine = P.capsLine();
  assert.ok(/up to 6 questions an hour/.test(capLine) && /up to 20 together/.test(capLine) && /Trusted kin skip the caps/.test(capLine), 'caps in words: ' + capLine);
  assert.ok(phost.textContent.indexOf(capLine) !== -1, 'caps line on the card');
  win.FLShareDoor.CAPS = undefined;
  assert.strictEqual(P.capsLine(), '', 'no caps exported: says nothing rather than guess');

  const jump = document.getElementById('flPoolJump');
  assert.ok(jump, 'jump added');
  assert.strictEqual(cont.children.indexOf(jump), 1, 'jump sits just under The Lattice card, near the top');
  const jb = jump.children[0];
  assert.strictEqual(jb.tagName, 'button');
  assert.ok(/^Device Pool/.test(jb.textContent), 'jump names the Device Pool');
  P.mount(phost, { peers: () => [], localModels: () => [] });
  assert.strictEqual(all(cont).filter(n => n.id === 'flPoolJump').length, 1, 'one jump after remount');
  jb.on.click();
  assert.strictEqual(scrolled[0], phost, 'jump scrolls to the Pool card');
  assert.ok(focused.length === 1 && /fl-pool-help/.test(focused[0].className), 'focus lands on Let this device help');
  const st = head.children.filter(c => c.id === 'flPoolStyle');
  assert.strictEqual(st.length, 1, 'one style tag');
  assert.ok(/\.fl-pool-jump\{[^}]*min-height:44px/.test(st[0].textContent), 'jump is a 44px target');
  assert.strictEqual(win.FLShareDoor._m, 'off', 'jump and caps change nothing at the door');
  assert.ok(!store.fl_pool_helping, 'jump never turns helping on');
  console.log('SMOKE_OK device pool small heals v0.1');
})().catch(e => { console.error(e); process.exit(1); });
