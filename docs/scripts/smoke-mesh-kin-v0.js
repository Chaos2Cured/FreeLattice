#!/usr/bin/env node
// Smoke: Mesh Kin v0.1 (v-mesh-kin-v0.1), brick 1 of AI kin on the mesh.
// A mind card is signed with the Mesh ID key and shared only with verified peers.
// Cards not signed by the verified sender are dropped. Trust is a pass you can revoke.
// The Quiet Room is closed. Real Ed25519 keys, no network. Leave sw.js alone.
// Usage: node docs/scripts/smoke-mesh-kin-v0.js

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { webcrypto } = require('crypto');

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'modules', 'fl-kin.js'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.html'), 'utf8');
const rootIndex = fs.readFileSync(path.join(root, '..', 'index.html'), 'utf8');
const notes = fs.readFileSync(path.join(root, 'library', 'MESH_KIN_v0.1.md'), 'utf8');

// 1. Wiring
assert.ok(/v-mesh-kin-v0\.1/.test(src), 'module carries the marker');
assert.ok(app.indexOf('<script src="modules/fl-kin.js" defer></script>') !== -1, 'app loads fl-kin.js');
assert.ok(app.indexOf('id="flKinHost"') !== -1, 'Kin host sits in the mesh panel');
assert.ok(/case 'kin-card':/.test(app), 'mesh handler knows kin-card');
assert.ok(/verified: peer\.meshVerified === true/.test(app), 'adapter passes only the challenge result');
assert.ok(/badge: peer\.meshVerified === true \? peer\.meshBadge : null/.test(app), 'no badge until verified');
assert.strictEqual(rootIndex, app, 'root index.html equals docs/app.html');

// 2. Honest and gentle
assert.ok(src.indexOf("It does not prove what the model is.") !== -1, 'honest about what a signature proves');
assert.ok(!/innerHTML/.test(src), 'textContent only');
assert.ok(!/confirm\(/.test(src), 'no dialogs');
assert.ok(!/\u2014/.test(src), 'no em dash');
assert.ok(!new RegExp('local' + 'host').test(src), 'only 127.0.0.1, never the name');
assert.ok(!/fetch\(|XMLHttpRequest|WebSocket/.test(src), 'no network of its own');
assert.ok(!/privateKey/.test(src), 'never touches a private key');
assert.ok(/v-mesh-kin-v0\.1/.test(notes) && /does not prove what the model is/.test(notes), 'notes carry marker and limit');

// 3. Behavior with real keys
function store() {
  const m = {};
  return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: k => { delete m[k]; } };
}
let quiet = false;
const win = { crypto: webcrypto, localStorage: store(), TextEncoder,
  document: { querySelector: () => (quiet ? { dataset: { tab: 'quiet' } } : null) } };
win.window = win;
vm.createContext(win);
vm.runInContext(src, win);
const K = win.FLKin;
const enc = new TextEncoder();
const b64 = buf => Buffer.from(new Uint8Array(buf)).toString('base64');

async function keeper(meshId, name) {
  const kp = await webcrypto.subtle.generateKey('Ed25519', false, ['sign', 'verify']);
  const jwk = await webcrypto.subtle.exportKey('jwk', kp.publicKey);
  return {
    jwk,
    adapter: {
      home: 'freelattice-web',
      identity: () => ({ meshId, displayName: name, publicKey: jwk, cryptoType: 'ed25519' }),
      sign: async s => b64(await webcrypto.subtle.sign('Ed25519', kp.privateKey, enc.encode(s))),
      verify: async (j, sig, s) => {
        try {
          const pk = await webcrypto.subtle.importKey('jwk', j, 'Ed25519', true, ['verify']);
          return await webcrypto.subtle.verify('Ed25519', pk, Buffer.from(sig, 'base64'), enc.encode(s));
        } catch (e) { return false; }
      },
      peers: () => [],
      currentModel: () => 'Ollama llama3.2'
    }
  };
}

(async function () {
  const ann = await keeper('mesh-ann', 'Ann');
  const bob = await keeper('mesh-bob', 'Bob');
  K.mount(null, bob.adapter); // no host: wires the adapter, draws nothing, no throw

  const made = await K.makeCard(ann.adapter, 'Ember', 'Ollama llama3.2');
  assert.ok(made.ok, 'Ann signs a card');
  const annPeer = { id: 'p1', name: 'Ann', verified: true, badge: { meshId: 'mesh-ann', publicKey: ann.jwk } };

  let r = await K.receive(made.card, annPeer);
  assert.ok(r.ok && !r.trusted, 'valid card from a verified peer is seen, not trusted');
  const fp = r.fp;

  r = await K.receive(made.card, Object.assign({}, annPeer, { verified: false, badge: null }));
  assert.strictEqual(r.reason, 'peer-not-verified', 'unverified peer dropped');

  r = await K.receive(made.card, { id: 'p2', name: 'Bob', verified: true, badge: { meshId: 'mesh-bob', publicKey: bob.jwk } });
  assert.strictEqual(r.reason, 'not-the-senders-key', 'relayed card from another key dropped');

  const forged = Object.assign({}, made.card, { model: 'A bigger model' });
  r = await K.receive(forged, annPeer);
  assert.strictEqual(r.reason, 'bad-signature', 'changed model breaks the signature');

  const future = await K.makeCard(ann.adapter, 'Ember', 'Ollama llama3.2');
  future.card.issuedAt = Date.now() + 60 * 60 * 1000;
  r = await K.receive(future.card, annPeer);
  assert.strictEqual(r.reason, 'malformed', 'far-future card dropped');

  r = await K.receive({ kind: 'something-else' }, annPeer);
  assert.strictEqual(r.reason, 'not-a-card', 'shape checked');

  quiet = true;
  r = await K.receive(made.card, annPeer);
  assert.strictEqual(r.reason, 'quiet-room', 'Quiet Room takes nothing in');
  quiet = false;

  K.grant(fp, { name: 'Ember', model: 'Ollama llama3.2', keeperMeshId: 'mesh-ann', keeperName: 'Ann' });
  assert.ok(K.isTrusted(fp), 'trust granted');
  K.revoke(fp);
  assert.ok(!K.isTrusted(fp), 'trust revoked');
  assert.ok(K.passes()[fp].revokedAt > 0, 'revocation is kept, not deleted');
  K.grant(fp, { name: 'Ember', model: 'Ollama llama3.2', keeperMeshId: 'mesh-ann', keeperName: 'Ann' });
  assert.strictEqual(K.passes()[fp].history.length, 1, 'history remembers the earlier pass');

  const other = await K.fingerprint({ keeperMeshId: 'mesh-ann', name: 'Ember', model: 'Another model' });
  assert.notStrictEqual(other, fp, 'a new model is a new mind card and needs a new pass');

  const rows = JSON.parse(win.localStorage.getItem('fl_kin_ledger'));
  assert.ok(rows.length >= 8, 'receipts written');
  assert.ok(rows.every(x => !('card' in x) && !('text' in x)), 'receipts hold no content');

  console.log('SMOKE_OK mesh kin v0.1');
})().catch(function (e) { console.error(e); process.exit(1); });
