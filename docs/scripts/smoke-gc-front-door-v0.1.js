#!/usr/bin/env node
// File-only smoke: GC front door v0.1.
// One Chat step on the welcome door. Skip still dismisses. Providers stay.
// A connected setup card hides. It does not replace its own markup.
// Reads the twins, the lock, and the two service workers. Never opens a browser.
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const repo = path.join(__dirname, '..', '..');

function read(rel) {
  return fs.readFileSync(path.join(repo, rel), 'utf8');
}
function md5(text) {
  return crypto.createHash('md5').update(text, 'utf8').digest('hex');
}
function between(src, start, end) {
  const a = src.indexOf(start);
  const b = src.indexOf(end, a + start.length);
  assert.ok(a !== -1 && b !== -1, 'missing slice ' + start);
  return src.slice(a, b);
}
function liveLines(src) {
  return src.split('\n').filter(function (line) {
    const t = line.trim();
    if (t.indexOf('before (') !== -1) return false;
    if (t.indexOf('//') === 0 || t.indexOf('/*') === 0 || t.indexOf('*') === 0) return false;
    return true;
  }).join('\n');
}

const app = read('docs/app.html');
const index = read('index.html');
assert.strictEqual(app, index, 'docs/app.html and index.html must be byte-identical');
const appMd5 = md5(app);
assert.strictEqual(appMd5, '724394925650cb0abb8aead5ced1f5b7', 'front door twin md5');

const lock = JSON.parse(read('docs/library/LOCK_MANIFEST_v0.1.json'));
['docs/app.html', 'index.html'].forEach(function (rel) {
  const rows = lock.files[rel];
  assert.ok(rows.length >= 14, rel + ' keeps prior lock rows');
  assert.strictEqual(rows[rows.length - 1].md5, appMd5, rel + ' last lock row');
  assert.strictEqual(rows[rows.length - 1].since, 'v-gc-front-door-v0.1');
  assert.strictEqual(rows[rows.length - 1].by, 'GC');
  assert.ok(rows.some(function (r) {
    return r.md5 === '5fcc913fc6b5ff3a20f828c1026ff2a0' && r.since === 'v-chat-clay-calm-v0.1';
  }), rel + ' keeps the clay-calm row');
});

const chatBtn = app.indexOf('<button type="button" class="fl-welcome-chat" id="flWelcomeChat" aria-label="Chat. The message box stays ready.">Chat</button>');
assert.ok(chatBtn !== -1, 'Chat button is at the top of the welcome');
const lead = app.indexOf('<p class="fl-welcome-lead">Your AI. Local. Free. Yours.</p>');
const providers = app.indexOf('Connect to an AI:');
assert.ok(lead !== -1 && chatBtn > lead && chatBtn < providers, 'Chat sits after the lead and before the providers');
const chatCss = between(app, '.fl-welcome-chat {', '}');
assert.ok(/min-height:\s*44px/.test(chatCss), 'chat button is a 44px tap');
assert.ok(/width:\s*100%/.test(chatCss), 'chat button is full width');
assert.ok(app.indexOf('class="fl-welcome-skip" onclick="flDismissWelcome()"') !== -1, 'Skip still dismisses');
assert.ok(app.indexOf('Skip &mdash; just explore') !== -1, 'Skip copy stays');

['flWelcomePickLocal()', 'flWelcomePickLMStudio()', "flWelcomePickCloud('groq')", "flWelcomePickCloud('huggingface')", "flWelcomePickCloud('google')", "flWelcomePickCloud('openai')", "flWelcomePickCloud('anthropic')", "flWelcomePickCloud('xai')"].forEach(function (call) {
  assert.ok(app.indexOf(call) !== -1, 'provider stays: ' + call);
});

const doorFn = between(app, 'function flWelcomeChat()', 'function flWelcomeBackToProviders');
assert.ok(/flDismissWelcome\(\)/.test(doorFn), 'Chat dismisses the welcome');
assert.ok(/switchTab\('chat'\)/.test(doorFn), 'Chat opens Chat');
assert.ok(/},\s*550\)/.test(doorFn), 'Chat waits for the overlay to leave');
assert.ok(doorFn.indexOf('FLWizard') === -1, 'Chat does not open a second wizard');
assert.ok(doorFn.indexOf('confirm(') === -1, 'Chat adds no confirm');
assert.ok(doorFn.indexOf('localStorage') === -1, 'Chat writes no storage of its own');
assert.ok(doorFn.indexOf('fl_apiKey') === -1 && doorFn.indexOf('fl_isLocal') === -1, 'Chat does not clear a connection');
assert.ok(/getElementById\('flWelcomeChat'\)/.test(doorFn) && /addEventListener\('click', flWelcomeChat\)/.test(doorFn), 'the click reaches the function');

const refresh = between(app, 'function refreshBanner()', 'function showFull()');
const connected = between(refresh, 'if (isConnected())', '} else {');
const connectedLive = liveLines(connected);
assert.ok(/banner\.style\.display = 'none'/.test(connectedLive), 'a connected card hides');
assert.ok(connectedLive.indexOf('banner.innerHTML') === -1, 'a connected card does not replace itself');
assert.ok(/before \(472de215\): banner\.innerHTML/.test(connected), 'the old replacement stays as a before comment');
assert.ok(/function showFull\(\)/.test(app), 'showFull stays');

assert.ok(/\.ollama-suggest-actions button \{[^}]*min-height:\s*44px;/.test(app), 'the local offer taps are 44px');
assert.ok(app.indexOf('id="ollamaSuggestBanner"') !== -1, 'the existing local offer stays');
assert.ok(app.indexOf('owAcceptSuggestion()') !== -1 && app.indexOf('owDismissSuggestion()') !== -1, 'offer buttons stay');

assert.strictEqual((read('sw.js').match(/freelattice-v5\.79\.47/g) || []).length > 0, true, 'root cache name stays');
assert.strictEqual((read('docs/sw.js').match(/freelattice-v5\.79\.47/g) || []).length > 0, true, 'docs cache name stays');
assert.ok(read('sw.js').indexOf('freelattice-v5.79.48') === -1, 'this brick does not bump the cache');

console.log('smoke-gc-front-door-v0.1: PASS');
