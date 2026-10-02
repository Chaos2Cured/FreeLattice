#!/usr/bin/env node
// v-tree-any-model-v0: FreeLattice twin of Alpha "Tree any model v0.1".
// The shared fl-connect.js is byte-identical in both repos. On the Tree a
// Connect tap merges into the sky (LocalMindProbe.mergeFound). FreeLattice's
// own remember() path is unchanged: fl_provider, fl_isLocal, fl_ollamaModel.
// The chosen model button says so (aria-pressed, is-chosen). No network.
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const repo = path.join(root, '..');
const mod = fs.readFileSync(path.join(root, 'modules', 'fl-connect.js'), 'utf8');

assert.ok(/v-tree-any-model-v0/.test(mod), 'marker in fl-connect.js');
assert.ok(/function chosenModelName\(\)/.test(mod), 'chosenModelName helper');
assert.ok(/function doorNameFor\(/.test(mod), 'doorNameFor helper');
assert.ok(/setAttribute\('aria-pressed'/.test(mod) && /is-chosen/.test(mod), 'chosen model is marked');
assert.ok(/v-connect-heal-v0\.4/.test(mod) && /v-model-choice-sticks-v0/.test(mod), 'earlier layers kept');
assert.ok(!/\bconfirm\(/.test(mod.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n')), 'no confirm()');

function storage(seed) {
  const s = Object.assign({}, seed || {});
  return {
    s,
    ls: {
      getItem: (k) => (Object.prototype.hasOwnProperty.call(s, k) ? s[k] : null),
      setItem: (k, v) => { s[k] = String(v); },
      removeItem: (k) => { delete s[k]; }
    }
  };
}
function sandbox(host, st, extra) {
  const ctx = Object.assign({
    localStorage: st.ls,
    location: { hostname: host, protocol: 'https:', hash: '', search: '' },
    navigator: { userAgent: 't' },
    document: {
      hidden: false,
      documentElement: { getAttribute: () => '', classList: { add() {}, remove() {}, contains() { return false; } } },
      getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
      head: { appendChild() {} }, body: { contains: () => true, classList: { add() {}, remove() {} } },
      addEventListener() {}, removeEventListener() {}
    },
    console: { log() {}, warn() {}, error() {} },
    JSON, String, parseInt, URL, Date, Math, Promise, Object, Array,
    setTimeout: () => 1, clearTimeout() {}, setInterval: () => 1, clearInterval() {},
    fetch: () => { throw new Error('no network in this smoke'); }
  }, extra || {});
  ctx.window = ctx;
  vm.runInNewContext(mod, ctx);
  return ctx;
}

// 1. FreeLattice: remember() still writes the FreeLattice keys, never the Tree key
{
  const st = storage();
  const fl = sandbox('freelattice.com', st);
  fl.state = { isLocal: false, provider: 'groq', ollamaModel: 'llama3.2' };
  fl.FlConnect.remember({ name: 'qwen2.5:latest', base: 'http://127.0.0.1:11434', models: [{ name: 'llama3.2:latest' }, { name: 'qwen2.5:latest' }] });
  assert.strictEqual(st.s.fl_provider, 'ollama', 'fl_provider');
  assert.strictEqual(st.s.fl_isLocal, 'true', 'fl_isLocal');
  assert.strictEqual(st.s.fl_ollamaModel, 'qwen2.5:latest', 'fl_ollamaModel');
  assert.strictEqual(fl.state.ollamaModel, 'qwen2.5:latest', 'state follows');
  assert.ok(!('fl_alpha_local_mind' in st.s), 'FreeLattice never writes the Tree key');
}

// 2. Tree: a Connect tap merges (all models, the door named), the old replace path stays as fallback
{
  const st = storage();
  const calls = [];
  const t = sandbox('thelatticetree.com', st, {
    LocalMindProbe: {
      mergeFound: (f) => { calls.push(f); return { url: f.url, model: f.model, models: f.models, minds: [] }; },
      getRemembered: () => null, remember() {}
    }
  });
  const out = t.FlConnect.remember({ name: 'qwen2.5:latest', base: 'http://127.0.0.1:11435', models: [{ name: 'llama3.2:latest' }, { name: 'qwen2.5:latest' }] });
  assert.strictEqual(calls.length, 1, 'mergeFound called once');
  assert.strictEqual(calls[0].name, 'Bridge', 'door named Bridge for 11435');
  assert.strictEqual(calls[0].url, 'http://127.0.0.1:11435/api/tags');
  assert.strictEqual(calls[0].models.length, 2, 'every model passed along');
  assert.strictEqual(out.model, 'qwen2.5:latest');
  assert.ok(!('fl_ollamaModel' in st.s) && !('fl_provider' in st.s), 'the Tree never writes FreeLattice keys');
}

// 3. Locks: sw.js untouched by this layer, root index.html == docs/app.html
assert.strictEqual(
  fs.readFileSync(path.join(repo, 'index.html'), 'utf8'),
  fs.readFileSync(path.join(root, 'app.html'), 'utf8'),
  'root index.html matches docs/app.html');
assert.ok(!/v-tree-any-model-v0/.test(fs.readFileSync(path.join(repo, 'sw.js'), 'utf8')), 'sw.js untouched');

console.log('SMOKE_OK tree any model twin v0.1');
