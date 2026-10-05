#!/usr/bin/env node
// Smoke: Narrow door v0.1 (v-narrow-door-v0.1)
// The Ollama Bridge (11435) and the desktop app's /ollama proxy only open the chat doors
// (plus pull for the app's own download button). delete, create, copy, push and blobs
// never pass. Other websites cannot drive the desktop proxy. No network.
// Usage: node docs/scripts/smoke-narrow-door-v0.1.js
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const repo = path.join(__dirname, '..', '..');
const core = require(path.join(repo, 'bridge', 'proxy-core.js'));
const coreSrc = fs.readFileSync(path.join(repo, 'bridge', 'proxy-core.js'), 'utf8');
const desk = fs.readFileSync(path.join(repo, 'desktop', 'main.js'), 'utf8');

function table(src) {
  const m = src.match(/\/\/ v-narrow-door-v0\.1: only these Ollama doors[\s\S]*?\/\/ end v-narrow-door-v0\.1 table\n/);
  assert.ok(m, 'door table present');
  return m[0];
}
assert.strictEqual(table(desk), table(coreSrc), 'desktop and Bridge carry the same door table');

const open = core.ollamaDoorOpen;
['POST /api/chat', 'POST /api/generate', 'GET /api/tags', 'HEAD /api/tags', 'GET /', 'POST /v1/chat/completions',
 'GET /v1/models', 'POST /api/embeddings', 'POST /api/show', 'POST /api/pull', 'GET /api/version'].forEach(function (d) {
  const p = d.split(' ');
  assert.ok(open(p[0], p[1]), 'open: ' + d);
});
['DELETE /api/delete', 'POST /api/delete', 'POST /api/create', 'POST /api/copy', 'POST /api/push',
 'POST /api/blobs/sha256:abc', 'HEAD /api/blobs/sha256:abc', 'PUT /api/chat', 'GET /api/chat/../delete',
 'POST /api/chat/../delete', 'GET /anything'].forEach(function (d) {
  const p = d.split(' ');
  assert.ok(!open(p[0], p[1]), 'closed: ' + d);
});
assert.ok(open('POST', '/api/chat?x=1') && open('post', '/api/chat/'), 'query and trailing slash tolerated');

// Wired in front of the proxy in both places
assert.ok(/if \(!ollamaDoorOpen\(req\.method, urlPath\)\)[\s\S]{0,400}proxyToOllama\(req, res, urlPath \+ query, origin\)/.test(coreSrc), 'Bridge checks the door first');
assert.ok(/_ndOrigin && _ndOrigin !== _ndSelf[\s\S]{0,400}ollamaDoorOpen\(req\.method, ollamaPath\)[\s\S]{0,400}proxyToOllama\(req, res, ollamaPath \+ queryString\)/.test(desk), 'desktop checks origin and door first');

// No bare star left live in the desktop server
assert.ok(!/^\s*res\.setHeader\('Access-Control-Allow-Origin', '\*'\);/m.test(desk), 'desktop sends no star');
assert.ok(/res\.setHeader\('Access-Control-Allow-Origin', _ndSelf\)/.test(desk), 'desktop answers only its own page');
assert.ok(!/Allow-Origin['"\s]*:\s*['"]\*/.test(coreSrc), 'Bridge never sends a star');

console.log('SMOKE_OK narrow door v0.1');
