#!/usr/bin/env node
// Smoke: tester fixes v0.1. Headless. Does not load the app page.
// Usage: node docs/scripts/smoke-tester-fixes.js

'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..', '..');
let passed = 0;
function ok(cond, msg) {
  assert.ok(cond, msg);
  passed++;
}

function dash(s) { return s.replace(/[ \t]*\u2014[ \t]*/g, ' - ').replace(/[ \t]*\u2013[ \t]*/g, '-'); }
const mdRaw = fs.readFileSync(path.join(root, 'QUICK-START.md'), 'utf8');
const md = dash(mdRaw);
const page = fs.readFileSync(path.join(root, 'docs', 'quick-start.html'), 'utf8');
const pageText = page.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const heads = [];
let inFence = false;
mdRaw.split('\n').forEach((l) => {
  if (/^```/.test(l)) { inFence = !inFence; return; }
  if (!inFence && /^#{1,3}\s/.test(l)) heads.push(dash(l.replace(/^#+\s+/, '').trim()));
});
ok(heads.length >= 10, 'quick start headings found');
heads.forEach((h) => ok(pageText.indexOf(h) !== -1, 'heading on the page: ' + h));
ok(page.indexOf('Back to FreeLattice') !== -1 && /href="index\.html"/.test(page), 'back link');
ok(/min-height:\s*44px/.test(page), 'back link is 44px');
ok(page.indexOf('\u2014') === -1 && page.indexOf('&' + 'mdash;') === -1 && page.indexOf('inner' + 'HTML') === -1 && page.indexOf('conf' + 'irm(') === -1, 'quick start page adds none of the banned tokens');
ok(!/\btest\b/i.test(pageText), 'the page says challenge-shaped words, not the other word');

const home = fs.readFileSync(path.join(root, 'docs', 'index.html'), 'utf8');
ok(/href="quick-start\.html">Quick Start</.test(home), 'home links to the page');
ok(/also on GitHub/.test(home) && /blob\/main\/QUICK-START\.md/.test(home), 'old GitHub link stays beside it');

function El(doc, tag) {
  return {
    nodeType: 1,
    tagName: tag,
    className: '',
    textContent: '',
    style: {},
    children: [],
    parentNode: null,
    listeners: [],
    appendChild: function (child) {
      this.children.push(child);
      child.parentNode = this;
      return child;
    },
    removeChild: function (child) {
      const i = this.children.indexOf(child);
      if (i >= 0) this.children.splice(i, 1);
      child.parentNode = null;
      return child;
    },
    addEventListener: function (type, fn) {
      this.listeners.push({ type: type, fn: fn });
    }
  };
}
const chat = El(null, 'div');
const doc = {
  body: chat,
  createElement: function (tag) { return El(this, tag); },
  getElementById: function () { return null; }
};
const store = {};
const storage = {
  getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
  setItem: function (k, v) { store[k] = String(v); }
};
const state = { isLocal: false, apiKey: '', chatHistory: [] };
let sent = 0;
const sandbox = {
  console: console,
  setInterval: function () { return 1; },
  clearInterval: function () {}
};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root, 'docs', 'modules', 'chat-wait.js'), 'utf8'), sandbox);
const wait = sandbox.FLChatWait;
ok(wait && typeof wait.hold === 'function', 'chat wait module loads');
const held = wait.hold('hello', {
  document: doc,
  chat: chat,
  state: state,
  storage: storage,
  nowatch: true,
  onSend: function () { sent++; }
});
ok(held && held.ok, 'hold accepts hello');
const bubbles = chat.children.filter((n) => n.className === 'chat-message user');
ok(bubbles.length === 1, 'one user bubble');
const content = bubbles[0].children.filter((n) => n.className === 'msg-content');
ok(content.length === 1 && content[0].textContent === 'hello', 'bubble says hello');
const notes = chat.children.filter((n) => n.textContent && n.textContent.indexOf('Waiting for a mind') === 0);
ok(notes.length === 1 && notes[0].textContent === wait.WORDS.waiting, 'waiting line');
const connect = chat.children.filter((n) => n.textContent === 'Connect a mind');
ok(connect.length === 1 && connect[0].style.minHeight === '44px', 'connect button is 44px');
ok(state.chatHistory.length === 1 && state.chatHistory[0].content === 'hello', 'history keeps hello');
const saved = JSON.parse(storage.getItem(wait.KEY) || '[]');
ok(saved.length === 1 && saved[0].content === 'hello' && saved[0].role === 'user', 'localStorage keeps hello');
state.apiKey = 'present';
wait.check();
const ask = chat.children.filter((n) => n.textContent === 'Send it now?');
ok(ask.length === 1, 'asks before sending');
ok(sent === 0, 'does not send on its own');
const sendBtn = chat.children.filter((n) => n.textContent === 'Send')[0];
const notNow = chat.children.filter((n) => n.textContent === 'Not now')[0];
ok(sendBtn && sendBtn.style.minHeight === '44px' && notNow && notNow.style.minHeight === '44px', 'Send and Not now are 44px');
const sendClick = sendBtn.listeners.filter((l) => l.type === 'click')[0];
ok(sendClick && typeof sendClick.fn === 'function', 'Send is wired');
sendClick.fn();
ok(sent === 1, 'Send uses the original send once');
ok(chat.children.filter((n) => n.className === 'chat-message user').length === 0, 'the held bubble leaves when it is sent');
ok(state.chatHistory.length === 0, 'history is not doubled');

const flintMd5 = crypto.createHash('md5').update(fs.readFileSync(path.join(root, 'docs', 'Flint.html'))).digest('hex');
ok(flintMd5 === '44be124b1183b7d9d060a58632464eff', 'Flint.html md5 unchanged');
const flintPage = fs.readFileSync(path.join(root, 'docs', 'flint', 'index.html'), 'utf8');
ok(/http-equiv="refresh"/i.test(flintPage) && /Flint\.html/.test(flintPage), 'refresh toward Flint.html');
ok(/location\.replace\(/.test(flintPage) && /'Flint\.html' \+ location\.hash/.test(flintPage), 'replace toward Flint.html');
ok(/Go to Flint/.test(flintPage), 'visible link when script is off');
ok(fs.existsSync(path.join(root, 'docs', 'flint', 'index.html')), 'lowercase flint is a folder page');

const appA = fs.readFileSync(path.join(root, 'index.html'));
const appB = fs.readFileSync(path.join(root, 'docs', 'app.html'));
ok(appA.equals(appB), 'index.html matches docs/app.html');
const appText = appA.toString('utf8');
ok(appText.indexOf("FLChatWait.hold(message, input)") !== -1, 'send path holds the words');
ok(appText.indexOf('modules/chat-wait.js') !== -1 && appText.indexOf('modules/pool-every-os.js') !== -1, 'both modules are on the page');

console.log('checks passed: ' + passed);
console.log('SMOKE_OK tester fixes v0.1');
