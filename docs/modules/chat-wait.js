// chat-wait.js (MIT) v-tester-fixes-v0.1
// A message sent before any mind is connected stays in the chat.
// It is not sent on its own when a mind arrives.
(function (root) {
  'use strict';
  var KEY = 'fl_chatHistory';
  var WORDS = {
    waiting: 'Waiting for a mind. Connect one in Settings and I will answer this.',
    connect: 'Connect a mind',
    ask: 'Send it now?',
    send: 'Send',
    notNow: 'Not now'
  };
  var pending = null;
  var timer = null;

  function el(doc, tag, cls, text) {
    var e = doc.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function button(doc, label) {
    var b = el(doc, 'button', 'fl-wait-btn', label);
    b.type = 'button';
    b.style.minHeight = '44px';
    b.style.padding = '10px 16px';
    b.style.margin = '6px 8px 0 0';
    return b;
  }
  function mindOn(state) {
    return !!(state && (state.isLocal || state.apiKey));
  }
  function readList(storage) {
    try {
      var arr = JSON.parse(storage.getItem(KEY) || '[]');
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }
  function writeList(storage, arr) {
    try { storage.setItem(KEY, JSON.stringify(arr)); } catch (e) {}
  }
  function openConnect() {
    try { if (root.FlConnect && typeof root.FlConnect.open === 'function') { root.FlConnect.open(); return; } } catch (e) {}
    try { if (typeof root.switchTab === 'function') { root.switchTab('connect'); return; } } catch (e) {}
    try { if (typeof root.showQuickConnect === 'function') root.showQuickConnect(); } catch (e) {}
  }
  function dropNodes(env) {
    ['bubble', 'note', 'connectBtn', 'ask', 'sendBtn', 'notNowBtn'].forEach(function (k) {
      var n = env[k];
      if (n && n.parentNode) n.parentNode.removeChild(n);
    });
  }
  function showOffer(env) {
    if (!env || env.offered || !env.chat) return;
    env.offered = true;
    if (timer) { clearInterval(timer); timer = null; }
    var doc = env.doc;
    env.ask = el(doc, 'p', 'fl-wait-ask', WORDS.ask);
    env.ask.style.margin = '8px 0 0';
    env.sendBtn = button(doc, WORDS.send);
    env.notNowBtn = button(doc, WORDS.notNow);
    env.sendBtn.addEventListener('click', function () { release(env); });
    env.notNowBtn.addEventListener('click', function () {
      if (env.ask && env.ask.parentNode) env.ask.parentNode.removeChild(env.ask);
      if (env.sendBtn && env.sendBtn.parentNode) env.sendBtn.parentNode.removeChild(env.sendBtn);
      if (env.notNowBtn && env.notNowBtn.parentNode) env.notNowBtn.parentNode.removeChild(env.notNowBtn);
      env.offered = true;
      pending = null;
    });
    env.chat.appendChild(env.ask);
    env.chat.appendChild(env.sendBtn);
    env.chat.appendChild(env.notNowBtn);
  }
  function release(env) {
    if (!env) return;
    var text = env.text;
    if (env.state && Array.isArray(env.state.chatHistory) && env.state.chatHistory.length) {
      var last = env.state.chatHistory[env.state.chatHistory.length - 1];
      if (last && last.role === 'user' && last.content === text) env.state.chatHistory.pop();
    }
    if (env.storage) {
      var arr = readList(env.storage);
      if (arr.length && arr[arr.length - 1] && arr[arr.length - 1].content === text) {
        arr.pop();
        writeList(env.storage, arr);
      }
    }
    dropNodes(env);
    pending = null;
    if (env.input) env.input.value = text;
    if (typeof env.onSend === 'function') env.onSend(text);
    else if (typeof root.sendMessage === 'function') root.sendMessage();
  }
  function check() {
    if (pending && mindOn(pending.state)) showOffer(pending);
    return pending;
  }
  function hold(text, second) {
    var opts = {};
    var input = null;
    if (second && (second.nodeType || second.tagName || (typeof second.value === 'string' && !second.document && !second.storage && !second.state))) {
      input = second;
    } else if (second && typeof second === 'object') {
      opts = second;
      input = second.input || null;
    }
    text = String(text || '');
    var doc = opts.document || root.document;
    if (!doc || typeof doc.createElement !== 'function') return { ok: false, reason: 'no-document' };
    var chat = opts.chat || (doc.getElementById && doc.getElementById('chatMessages')) || doc.body;
    if (!chat) return { ok: false, reason: 'no-chat' };
    var state = opts.state || root.state;
    var storage = opts.storage || root.localStorage;
    var bubble = el(doc, 'div', 'chat-message user');
    bubble.appendChild(el(doc, 'span', 'msg-label', 'You'));
    bubble.appendChild(el(doc, 'span', 'msg-content', text));
    var note = el(doc, 'p', 'fl-wait-line', WORDS.waiting);
    note.style.cssText = 'margin:8px 0 0;max-width:40rem;line-height:1.45;';
    var connectBtn = button(doc, WORDS.connect);
    connectBtn.addEventListener('click', function () {
      if (typeof opts.openConnect === 'function') opts.openConnect();
      else openConnect();
    });
    chat.appendChild(bubble);
    chat.appendChild(note);
    chat.appendChild(connectBtn);
    if (state && Array.isArray(state.chatHistory)) state.chatHistory.push({ role: 'user', content: text });
    if (storage && storage.getItem && storage.setItem) {
      var arr = readList(storage);
      arr.push({ role: 'user', content: text });
      writeList(storage, arr);
    }
    try { if (typeof root.saveMessage === 'function') root.saveMessage('user', text); } catch (e) {}
    if (input) input.value = '';
    var env = {
      text: text, doc: doc, chat: chat, state: state, storage: storage, input: input,
      bubble: bubble, note: note, connectBtn: connectBtn, offered: false, onSend: opts.onSend
    };
    pending = env;
    if (timer) clearInterval(timer);
    if (!opts.nowatch && typeof setInterval === 'function') {
      timer = setInterval(check, 1000);
    }
    return { ok: true, key: KEY };
  }

  root.FLChatWait = { VERSION: 'v-tester-fixes-v0.1', WORDS: WORDS, KEY: KEY, hold: hold, check: check };
})(typeof window !== 'undefined' ? window : globalThis);
