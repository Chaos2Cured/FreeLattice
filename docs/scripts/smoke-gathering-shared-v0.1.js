#!/usr/bin/env node
// Smoke: The Gathering shared core v0.1 (fl-gathering.js twin + Learn card). No browser needed.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');
const docs = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(docs, 'modules', 'fl-gathering.js'), 'utf8');
const app = fs.readFileSync(path.join(docs, 'app.html'), 'utf8');
const root = fs.readFileSync(path.join(docs, '..', 'index.html'), 'utf8');

// Twin lock: the Tree carries the same bytes (FreeLattice-Alpha docs/modules/fl-gathering.js).
const TWIN_MD5 = 'ef514ece89405182a8b7cd0370e1ade9';
assert.strictEqual(crypto.createHash('md5').update(src).digest('hex'), TWIN_MD5, 'fl-gathering.js twin bytes');
assert.ok(/v-gathering-shared-v0\.1/.test(src));
assert.ok(!/innerHTML|confirm\(|localhost|\u2014/.test(src), 'textContent only, no confirm, 127.0.0.1 only, no em dash');
assert.ok(!/apiKey/.test(src), 'the shared core never touches a key');

const store = {};
const ctx = { window: {}, localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } } };
ctx.window.localStorage = ctx.localStorage;
vm.runInNewContext(src, ctx);
const G = ctx.window.FLGathering;
assert.strictEqual(G.CHAIRS.length, 7);
assert.deepStrictEqual(Array.from(G.CHAIRS.filter((c) => c.later).map((c) => c.id)), ['seat-5', 'seat-6', 'seat-7']);
assert.ok(G.isLoopback('http://127.0.0.1:11434') && !G.isLoopback('http://localhost:11434') && !G.isLoopback('http://10.0.0.2:11434'));
assert.strictEqual(G.normalizeSeat({ kind: 'local', model: 'm', base: 'http://evil.example:11434' }), null);
const cloud = G.normalizeSeat({ kind: 'cloud', model: 'x', provider: 'groq', providerName: 'Groq', apiKey: 'SECRET' });
assert.ok(cloud && !('apiKey' in cloud) && cloud.label === 'Groq: x', 'a seat keeps a name, never a key');
store.k = JSON.stringify({ seats: { cortex: { kind: 'local', model: 'a', base: 'http://127.0.0.1:11434' }, 'seat-5': { kind: 'local', model: 'b', base: 'http://127.0.0.1:11434' } }, speaking: 'seat-5' });
const st = G.getState('k');
assert.ok(st.seats.cortex && !st.seats['seat-5'] && st.speaking === '', 'later seats stay empty');
assert.strictEqual(G.cloudOptions({ cloudMinds: () => [{ provider: 'groq', model: 'a' }, { provider: 'groq', model: 'a' }] }).length, 1);

// FreeLattice wiring: a Learn card, a panel, the module loaded, index.html a byte copy.
assert.ok(/\{ id: 'gathering', icon: '&#x1FA91;', label: 'The Gathering'/.test(app), 'Learn card');
assert.ok(/'skills', 'gathering'\];/.test(app), 'Learn stays lit on the Gathering tab');
assert.ok(/<div class="tab-panel" id="tab-gathering">/.test(app) && /FLGathering\.mount\(host, \{/.test(app));
assert.ok(/<script src="modules\/fl-gathering\.js" defer><\/script>/.test(app));
assert.ok(/NOT_CLOUD = \['ollama', 'lmstudio', 'custom', 'custom-openai', 'browser'\]/.test(app));
assert.strictEqual(root, app, 'index.html equals docs/app.html');
console.log('SMOKE_OK gathering shared v0.1');
