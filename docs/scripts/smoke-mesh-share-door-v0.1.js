#!/usr/bin/env node
// Smoke: Mesh share door v0.1 (v-mesh-share-door-v0.1), open but accountable.
// Either keeper can say yes; pause wins; signed envelopes; caps; receipts without words;
// mind consent only via domain prefix; legacy unsigned behind a flag.
// Usage: node docs/scripts/smoke-mesh-share-door-v0.1.js

'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { webcrypto } = require('crypto');

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'modules', 'fl-share-door.js'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.html'), 'utf8');
const bridge = fs.readFileSync(path.join(root, '..', 'tools', 'agent-bridge.js'), 'utf8');
const client = fs.readFileSync(path.join(root, 'modules', 'agent-bridge-client.js'), 'utf8');
assert.strictEqual(fs.readFileSync(path.join(root, '..', 'index.html'), 'utf8'), app, 'index == app');

assert.ok(/v-mesh-share-door-v0\.1/.test(src), 'marker');
assert.ok(app.indexOf('modules/fl-share-door.js') !== -1, 'app loads module');
assert.ok(app.indexOf('id="flShareDoorHost"') !== -1, 'host');
assert.ok(/FLShareDoor\.admit/.test(app), 'inference gated');
assert.ok(/shareAdmit:/.test(app), 'queue adapter');
assert.ok(/Answered by/.test(src) && /shared freely/.test(src), 'Jeffrey line');
assert.ok(/chose to share with people/.test(src), 'mind note');
assert.ok(/The door is open because we trust the ledger/.test(src), 'Reed line');
assert.ok(!/\u2014/.test(src) && !/confirm\(/.test(src) && !/\.innerHTML\s*=/.test(src), 'gentle');
assert.ok(!new RegExp('local' + 'host').test(src), 'no localhost word');
assert.ok(/\/share\/consent/.test(bridge) && /'share'/.test(bridge), 'bridge routes + scope');
assert.ok(/get: function \(path\)/.test(client), 'client get helper');
// Mesh case must not touch consent: no mesh handler for share/consent
assert.ok(!/case 'share-consent'|type: 'share-consent'/.test(app), 'no mesh consent path');

function store() {
  const m = {};
  return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: k => { delete m[k]; } };
}
function node(tag) {
  return { tag, children: [], textContent: '', className: '', listeners: {},
    appendChild(c) { this.children.push(c); return c; },
    removeChild(c) { this.children = this.children.filter(x => x !== c); },
    get firstChild() { return this.children[0] || null; },
    setAttribute() {}, addEventListener(t, f) { this.listeners[t] = f; },
    createTextNode(t) { return { textContent: t }; } };
}

(async () => {
  const ls = store();
  const win = { crypto: webcrypto, localStorage: ls, TextEncoder, Uint8Array, ArrayBuffer,
    document: { createElement: node, createTextNode: t => ({ textContent: t }) },
    showToast: () => {}, navigator: {} };
  win.window = win;
  vm.createContext(win);
  vm.runInContext(src, win);
  const D = win.FLShareDoor;
  assert.strictEqual(D.VERSION, 'v-mesh-share-door-v0.1');

  const kp = await webcrypto.subtle.generateKey('Ed25519', false, ['sign', 'verify']);
  const jwk = await webcrypto.subtle.exportKey('jwk', kp.publicKey);
  const enc = new TextEncoder();
  const b64 = buf => Buffer.from(new Uint8Array(buf)).toString('base64');
  const adapter = {
    identity: () => ({ meshId: 'mesh:abc', displayName: 'Mom', publicKey: jwk, cryptoType: 'ed25519', canSign: true }),
    sign: async s => b64(await webcrypto.subtle.sign('Ed25519', kp.privateKey, enc.encode(s))),
    verify: async (j, sig, s) => webcrypto.subtle.verify('Ed25519',
      await webcrypto.subtle.importKey('jwk', j, 'Ed25519', true, ['verify']), Buffer.from(sig, 'base64'), enc.encode(s))
  };
  D.use(adapter);
  const peer = { name: 'Visitor', verified: true, badge: { meshId: 'mesh:abc', publicKey: jwk } };
  const msgs = [{ role: 'user', content: 'hello' }];

  // Off by default
  assert.strictEqual(D.allows(), false);
  let r = await D.admit(peer, null, msgs, { allowLegacy: true });
  assert.strictEqual(r.ok, false);

  // Human yes
  D.setMode('open', 'human');
  assert.ok(D.allows());
  const made = await D.makeEnvelope(adapter, 'llama3', msgs, 'req1');
  assert.ok(made.ok && made.envelope.signature);
  r = await D.admit(peer, made.envelope, msgs, {});
  assert.ok(r.ok, 'signed admit: ' + (r.reason || ''));

  // Replay
  r = await D.admit(peer, made.envelope, msgs, {});
  assert.strictEqual(r.reason, 'replay');

  // Pause wins
  D.setMode('pause', 'human');
  const made2 = await D.makeEnvelope(adapter, 'llama3', msgs, 'req2');
  r = await D.admit(peer, made2.envelope, msgs, {});
  assert.ok(!r.ok && /resting/i.test(r.soft || ''), 'pause soft words');

  // Resume
  D.setMode('open', 'human');
  // Tampered body
  const made3 = await D.makeEnvelope(adapter, 'llama3', msgs, 'req3');
  r = await D.admit(peer, made3.envelope, [{ role: 'user', content: 'EVIL' }], {});
  assert.strictEqual(r.reason, 'body-mismatch');

  // Unsigned soft when legacy off
  D.setLegacyOpen(false);
  r = await D.admit(peer, null, msgs, { allowLegacy: true });
  assert.ok(!r.ok);

  // Unsigned ok when legacy on
  D.setLegacyOpen(true);
  r = await D.admit(peer, null, msgs, { allowLegacy: true });
  assert.ok(r.ok, 'legacy unsigned');

  // Caps: fill unfamiliar
  D.setLegacyOpen(true);
  for (let i = 0; i < 6; i++) {
    D.beginServe();
    D.endServe(r.keyHash, 'llama3', 10, false);
  }
  r = await D.admit(peer, null, msgs, { allowLegacy: true });
  assert.strictEqual(r.reason, 'per-key-cap');

  // Block / unblock
  const kh = (await D.keyHash(jwk));
  D.setMode('open', 'human');
  // clear receipts by using a fresh storage key path: block still works
  D.blockKey(kh, 'visitor');
  const made4 = await D.makeEnvelope(adapter, 'llama3', msgs, 'req4');
  // need fresh nonce path - blocked before envelope check for legacy
  r = await D.admit(peer, null, msgs, { allowLegacy: true });
  assert.strictEqual(r.reason, 'blocked');
  D.unblockKey(kh);

  // Mind consent domain
  const ts = Date.now();
  const nonce = 'aabbccddeeff00112233445566778899';
  const canon = D.CONSENT_DOMAIN + ['mind1', 'open', String(ts), nonce].join('|');
  const sig = await adapter.sign(canon);
  r = await D.verifyMindConsent({ mindId: 'mind1', choice: 'open', ts, nonce, publicKey: jwk, sig, cryptoType: 'ed25519' });
  assert.ok(r.ok, 'mind consent');
  // replay
  r = await D.verifyMindConsent({ mindId: 'mind1', choice: 'pause', ts, nonce, publicKey: jwk, sig, cryptoType: 'ed25519' });
  assert.strictEqual(r.reason, 'replay');

  // Too long
  const long = [{ role: 'user', content: 'x'.repeat(D.MAX_CHARS + 10) }];
  r = await D.admit(peer, null, long, { allowLegacy: true });
  assert.strictEqual(r.reason, 'too-long');

  // Receipts never hold content
  const rows = D.receipts();
  assert.ok(rows.every(row => !JSON.stringify(row).includes('hello') && !JSON.stringify(row).includes('EVIL')));

  assert.ok(/shared freely/.test(D.attribution('Kirk')));
  console.log('SMOKE_OK mesh share door v0.1');
})().catch(e => { console.error(e); process.exit(1); });
