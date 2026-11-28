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
assert.strictEqual(appMd5, '7ba3c92f924c9db1c9a71f1c7519c34d', 'front door twin md5');

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
  assert.ok(rows.some(function (r) {
    return r.md5 === '724394925650cb0abb8aead5ced1f5b7' && r.since === 'v-gc-front-door-v0.1';
  }), rel + ' keeps the first front-door row');
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

const dismiss = between(app, 'function flDismissWelcome()', 'function flWelcomeChat()');
assert.ok(dismiss.indexOf('chatInput') === -1, 'Skip does not focus Chat');

const doorFn = between(app, 'function flWelcomeChat()', 'function flWelcomeBackToProviders');
assert.ok(/flDismissWelcome\(\)/.test(doorFn), 'Chat dismisses the welcome');
assert.ok(/flMobileNav\('chat'\)/.test(doorFn), 'Chat lights the phone bar');
assert.ok(/switchTab\('chat'\)/.test(doorFn), 'Chat still has the tab fallback');
assert.ok(/getElementById\('chatInput'\)/.test(doorFn), 'Chat finds the message box');
assert.ok(/focus\(\{ preventScroll: true \}\)/.test(doorFn), 'Chat focuses without jumping');
assert.ok(doorFn.indexOf('scrollIntoView') === -1, 'Chat does not scroll the page');
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

assert.ok(app.indexOf('<div class="model-switcher-wrap" id="modelSwitcherWrap">') !== -1, 'the composer chip can be tapped');
assert.ok(app.indexOf('id="modelSwitcherDropdown" style="display:none !important;"') !== -1, 'the old model list stays hidden');
assert.ok(/before \(cee5cbe1\): <div class="model-switcher-wrap" id="modelSwitcherWrap" style="pointer-events:none;">/.test(app), 'the old no-tap style stays as a before comment');
const chip = between(app, "var chip = document.getElementById('modelSwitcherBtn');", '// Close on outside click');
assert.ok(/window\.openProviderModal\(\)/.test(chip), 'the chip opens the existing connection door');
assert.ok(chip.indexOf('toggle(') === -1, 'the chip does not open the old list');
assert.ok(chip.indexOf('localStorage') === -1 && chip.indexOf('fl_apiKey') === -1 && chip.indexOf('removeItem') === -1, 'the chip clears no key');

function liveCache(rel) {
  var m = read(rel).match(/^\s*const CACHE_NAME\s*=\s*'freelattice-v([^']+)'/m);
  assert.ok(m, rel + ' has a live cache name');
  return m[1];
}
assert.strictEqual(liveCache('sw.js'), '5.79.48', 'root cache name');
assert.strictEqual(liveCache('docs/sw.js'), '5.79.48', 'docs cache name');
assert.strictEqual(read('sw.js'), read('docs/sw.js'), 'the workers match');
assert.ok(/before \(cee5cbe1\): const CACHE_NAME = 'freelattice-v5\.79\.47';/.test(read('sw.js')), 'the old cache name stays as a before comment');
['sw.js', 'docs/sw.js'].forEach(function (rel) {
  var rows = lock.files[rel];
  assert.strictEqual(rows[rows.length - 1].md5, md5(read(rel)), rel + ' last lock row');
  assert.strictEqual(rows[rows.length - 1].since, 'v-gc-front-door-v0.1');
  assert.ok(rows.some(function (r) { return r.md5 === '5740728cf3ffa8a52f8b992d3811863e'; }), rel + ' keeps the 5.79.47 row');
});

console.log('smoke-gc-front-door-v0.1: PASS');
