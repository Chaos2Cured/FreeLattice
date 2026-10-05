#!/usr/bin/env node
// Smoke: Mesh Kin v0.2 (v-mesh-kin-v0.2), the patient work queue for trusted kin.
// Two simulated browsers with real Ed25519 keys. A question queued for a trusted mind
// waits, goes when the keeper connects, is answered by their local model and kept.
// Strangers, impostors, revoked kin, sharing off and the Quiet Room are all refused.
// No network. Leave sw.js alone.
// Usage: node docs/scripts/smoke-mesh-kin-v0.2.js

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { webcrypto } = require('crypto');

const root = path.join(__dirname, '..');
const kinSrc = fs.readFileSync(path.join(root, 'modules', 'fl-kin.js'), 'utf8');
const qSrc = fs.readFileSync(path.join(root, 'modules', 'fl-kin-queue.js'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.html'), 'utf8');
const rootIndex = fs.readFileSync(path.join(root, '..', 'index.html'), 'utf8');
const notes = fs.readFileSync(path.join(root, 'library', 'MESH_KIN_v0.2.md'), 'utf8');

// 1. Wiring and words
assert.ok(/v-mesh-kin-v0\.2/.test(qSrc) && /v-mesh-kin-v0\.2/.test(kinSrc), 'markers');
assert.ok(app.indexOf('<script src="modules/fl-kin-queue.js" defer></script>') !== -1, 'app loads the queue');
assert.ok(app.indexOf('id="flKinQueueHost"') !== -1, 'queue panel host');
assert.ok(/case 'kin-work':\s*\n\s*case 'kin-result':/.test(app), 'mesh handler knows kin-work and kin-result');
assert.ok(/runLocal: async function[\s\S]{0,200}getOllamaBaseUrl\(\) \+ '\/api\/chat'/.test(app), 'peers are served by the local model only');
assert.strictEqual(rootIndex, app, 'root index.html equals docs/app.html');
assert.ok(/before v-mesh-kin-v0\.2: function fingerprint/.test(kinSrc), 'old fingerprint kept as a comment');
assert.ok(qSrc.indexOf('Nothing is split into pieces across browsers.') !== -1, 'honest about sharding');
[qSrc].forEach(function (s) {
  assert.ok(!/innerHTML/.test(s) && !/confirm\(/.test(s) && !/\u2014/.test(s), 'textContent, no dialogs, no em dash');
  assert.ok(!new RegExp('local' + 'host').test(s) && !/fetch\(/.test(s), 'no network of its own');
});
assert.ok(/X conversation with @grok/.test(notes) && /tensor/.test(notes), 'notes credit the X thread and name the hard part');

// 2. Two browsers
function store() { const m = {}; return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: k => { delete m[k]; } }; }
const enc = new TextEncoder();
const b64 = buf => Buffer.from(new Uint8Array(buf)).toString('base64');
const tick = () => new Promise(r => setTimeout(r, 30));

async function node(name) {
  const kp = await webcrypto.subtle.generateKey('Ed25519', false, ['sign', 'verify']);
  const jwk = await webcrypto.subtle.exportKey('jwk', kp.publicKey);
  const ctx = { crypto: webcrypto, localStorage: store(), TextEncoder, setTimeout, clearTimeout, setInterval, clearInterval, console,
    document: { querySelector: () => (ctx._quiet ? { dataset: { tab: 'quiet' } } : null) } };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(kinSrc, ctx);
  vm.runInContext(qSrc, ctx);
  const me = { name, meshId: 'mesh:' + name, jwk, ctx, peers: [], sharing: true, served: 0 };
  me.kinAdapter = {
    identity: () => ({ meshId: me.meshId, displayName: name, publicKey: jwk, cryptoType: 'ed25519' }),
    sign: async s => b64(await webcrypto.subtle.sign('Ed25519', kp.privateKey, enc.encode(s))),
    verify: async (j, sig, s) => { try { const pk = await webcrypto.subtle.importKey('jwk', j, 'Ed25519', true, ['verify']); return await webcrypto.subtle.verify('Ed25519', pk, Buffer.from(sig, 'base64'), enc.encode(s)); } catch (e) { return false; } },
    peers: () => me.peers, currentModel: () => 'Ollama llama3.2'
  };
  ctx.FLKin.use(me.kinAdapter);
  ctx.FLKinQueue.mount(null, {
    peers: () => me.peers,
    sharingOn: () => me.sharing,
    peerModels: () => ['llama3.2'],
    runLocal: async (model, messages) => { me.served += 1; return 'answer from ' + name + ': ' + messages[messages.length - 1].content; }
  });
  return me;
}
// A verified channel from a to b: what a sees of b
function view(a, b, opts) {
  opts = opts || {};
  return { id: 'p-' + b.name, name: b.name, verified: true,
    badge: { meshId: opts.meshId || b.meshId, publicKey: b.jwk },
    send: obj => { const copy = JSON.parse(JSON.stringify(obj)); setTimeout(() => b.ctx.FLKinQueue.receive(copy, view(b, a)), 5); } };
}
async function trustEachOther(a, b) {
  const card = (await a.ctx.FLKin.makeCard(a.kinAdapter, a.name + '-mind', 'Ollama llama3.2')).card;
  const r = await b.ctx.FLKin.receive(card, view(b, a));
  assert.ok(r.ok, b.name + ' sees ' + a.name + "'s card");
  const seen = JSON.parse(b.ctx.localStorage.getItem('fl_kin_seen')).filter(s => s.fp === r.fp)[0];
  b.ctx.FLKin.grant(r.fp, seen);
}

(async function () {
  const ann = await node('ann');
  const bob = await node('bob');
  const eve = await node('eve');
  await trustEachOther(ann, bob);
  await trustEachOther(bob, ann);
  const Q = ann.ctx.FLKinQueue;
  const ask = [{ role: 'user', content: 'What grows in a fractal garden?' }];

  // Waits while Bob is away
  let r = await Q.enqueue(view(ann, bob), 'llama3.2', ask);
  assert.ok(r.ok && !r.cached && r.id, 'queued for trusted Bob');
  await Q.flush(); await tick();
  assert.strictEqual((await Q._jobs())[0].status, 'queued', 'still waiting while Bob is offline');

  // Bob connects: it goes, is answered, is kept
  ann.peers = [view(ann, bob)]; bob.peers = [view(bob, ann)];
  const answer = Q.waitFor(r.id);
  await Q.flush();
  assert.strictEqual(await answer, 'answer from bob: What grows in a fractal garden?', 'answered by Bob\'s local model');
  r = await Q.enqueue(view(ann, bob), 'llama3.2', ask);
  assert.ok(r.cached && /answer from bob/.test(r.response), 'second time comes from the kept answer');
  assert.strictEqual(bob.served, 1, 'Bob ran it once');

  // Buffered callMeshModel
  const viaCall = await Q.callMeshModelQueued('p-bob', 'llama3.2', [{ role: 'user', content: 'Hello kin' }]);
  assert.strictEqual(viaCall, 'answer from bob: Hello kin', 'callMeshModelQueued waits and answers');

  // Strangers: Eve is verified but not trusted, both ways
  r = await Q.enqueue(view(ann, eve), 'llama3.2', ask);
  assert.strictEqual(r.reason, 'not-trusted', 'no work sent to a stranger');
  r = await bob.ctx.FLKinQueue.receive({ type: 'kin-work', v: 1, batch: [{ id: 'x', model: 'm', messages: ask }] }, view(bob, eve));
  assert.strictEqual(r.reason, 'not-trusted', 'no work taken from a stranger');

  // Impostor: Eve repeats Ann's meshId with her own key
  assert.strictEqual(await bob.ctx.FLKin.trustedPeer(view(bob, eve, { meshId: ann.meshId })), false, 'an impostor of a trusted meshId is not trusted');
  const eveCard = (await eve.ctx.FLKin.makeCard(Object.assign({}, eve.kinAdapter, { identity: () => ({ meshId: ann.meshId, displayName: 'ann', publicKey: eve.jwk, cryptoType: 'ed25519' }) }), 'ann-mind', 'Ollama llama3.2')).card;
  const er = await bob.ctx.FLKin.receive(eveCard, view(bob, eve, { meshId: ann.meshId }));
  assert.ok(er.ok && !er.trusted, 'impostor card shows as seen, not trusted');

  // Answers only from the peer the job went to
  bob.sharing = false;
  r = await Q.enqueue(view(ann, bob), 'llama3.2', [{ role: 'user', content: 'Are you serving?' }]);
  await Q.flush(); await tick(); await tick();
  let job = (await Q._jobs()).filter(j => j.id === r.id)[0];
  assert.ok(job.status === 'queued' && /sharing is off/.test(job.error), 'sharing off: refused, job waits again');
  bob.sharing = true;
  await Q.flush(); await tick();
  job = (await Q._jobs()).filter(j => j.id === r.id)[0];
  // job is now 'sent' or done; a forged result from Eve must not land
  const forged = await Q.receive({ type: 'kin-result', v: 1, batch: [{ id: r.id, response: 'forged' }] }, view(ann, eve));
  assert.ok(!forged.ok, 'results from a stranger are dropped');

  // Revoke Bob: nothing more goes or comes
  await tick(); await tick();
  const passes = ann.ctx.FLKin.passes();
  Object.keys(passes).forEach(fp => ann.ctx.FLKin.revoke(fp));
  r = await Q.enqueue(view(ann, bob), 'llama3.2', [{ role: 'user', content: 'After revoke' }]);
  assert.strictEqual(r.reason, 'not-trusted', 'revoked kin get no work');

  // Quiet Room
  bob.ctx._quiet = true;
  r = await bob.ctx.FLKinQueue.enqueue(view(bob, ann), 'llama3.2', ask);
  assert.strictEqual(r.reason, 'quiet-room', 'Quiet Room queues nothing');
  r = await bob.ctx.FLKinQueue.receive({ type: 'kin-work', v: 1, batch: [{ id: 'q', model: 'm', messages: ask }] }, view(bob, ann));
  assert.strictEqual(r.reason, 'quiet-room', 'Quiet Room takes nothing in');
  bob.ctx._quiet = false;

  // Malformed work is dropped
  r = await bob.ctx.FLKinQueue.receive({ type: 'kin-work', v: 1, batch: [{ id: 'm', model: 'm', messages: [{ role: 'tool', content: 'x' }] }] }, view(bob, ann));
  assert.ok(!r.ok, 'odd roles dropped');

  // Receipts hold no prompts or answers
  [ann, bob].forEach(n => {
    const rows = n.ctx.localStorage.getItem('fl_kin_queue_ledger') || '[]';
    assert.ok(!/fractal garden|answer from/.test(rows), 'receipts hold no content');
  });

  [ann, bob, eve].forEach(n => n.ctx.FLKinQueue._stop());
  console.log('SMOKE_OK mesh kin v0.2');
})().catch(function (e) { console.error(e); process.exit(1); });
