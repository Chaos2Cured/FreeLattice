// confidence-first.js (MIT) v-confidence-first-v0.1
// Show a few worked steps, then invite a try.
// If the learner hesitates, offer the next step. Never a score, never a scolding.
// Off until the person says Yes. The trainer file itself is left as it is.
(function (root) {
  'use strict';

  var KEY = 'fl_confidence_on';
  var WAIT_MS = 20000;
  var INVITE = 'Want to try the next one?';
  var NUDGE = 'Here is one more step. Then it is your turn.';
  var ADDON = 'Show 2 or 3 worked steps. Then ask: Want to try the next one?';
  var LABEL = 'A lesson, shown in steps.';
  var STEPS = [
    'Step 1. Read the question once.',
    'Step 2. Name what you already know.',
    'Step 3. Try one small piece.'
  ];
  var EXTRA = 'Step 4. Say the next piece in your own words.';
  var HES = {
    'i don\'t know': true,
    'i dont know': true,
    'i do not know': true,
    'idk': true,
    'not sure': true,
    'i\'m not sure': true,
    'im not sure': true,
    'no idea': true,
    'i\'m stuck': true,
    'im stuck': true
  };

  var _host = null;
  var _timer = null;
  var _nudge = null;

  function safeGet(k) {
    try { return root.localStorage ? root.localStorage.getItem(k) : null; }
    catch (e) { return null; }
  }
  function safeSet(k, v) {
    try { if (root.localStorage) root.localStorage.setItem(k, v); }
    catch (e) {}
  }
  function isOn() { return safeGet(KEY) === 'yes'; }
  function clearTimer() {
    if (_timer && root.clearTimeout) root.clearTimeout(_timer);
    _timer = null;
  }
  function el(tag, cls, text) {
    var node = root.document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }
  function button(label, fn) {
    var b = el('button', 'fl-confidence-btn', label);
    b.type = 'button';
    b.style.minHeight = '44px';
    b.style.minWidth = '44px';
    b.addEventListener('click', fn);
    return b;
  }
  function ensureStyle() {
    var doc = root.document;
    if (!doc || !doc.getElementById || doc.getElementById('flConfidenceStyle')) return;
    var st = doc.createElement('style');
    st.id = 'flConfidenceStyle';
    st.textContent = '.fl-confidence{max-width:100%;overflow-wrap:anywhere;box-sizing:border-box;margin:8px 0;}' +
      '.fl-confidence button{min-height:44px;min-width:44px;margin:6px 8px 6px 0;padding:10px 14px;box-sizing:border-box;}' +
      '.fl-confidence input{min-height:44px;max-width:100%;box-sizing:border-box;}' +
      '.fl-confidence p,.fl-confidence li{margin:6px 0;}';
    if (doc.head) doc.head.appendChild(st);
    else if (doc.body) doc.body.appendChild(st);
  }
  function promptAddon() { return ADDON; }

  function showNudge() {
    if (_nudge) _nudge.textContent = NUDGE;
    return NUDGE;
  }
  function arm() {
    clearTimer();
    if (!isOn() || !root.setTimeout) return;
    _timer = root.setTimeout(function () {
      _timer = null;
      showNudge();
    }, WAIT_MS);
  }
  function consider(text) {
    clearTimer();
    var raw = String(text || '').trim().toLowerCase().replace(/[.!]+$/g, '');
    if (HES[raw]) return showNudge();
    return '';
  }
  function fillLesson(box) {
    while (box.firstChild) box.removeChild(box.firstChild);
    if (!isOn()) {
      box.appendChild(el('p', 'fl-confidence-off', 'Steps stay hidden until you want them.'));
      box.appendChild(button('Yes, show steps first', function () {
        safeSet(KEY, 'yes');
        fillLesson(box);
        arm();
      }));
      return;
    }
    box.appendChild(el('p', 'fl-confidence-label', LABEL));
    var list = el('ol', 'fl-confidence-steps');
    for (var i = 0; i < STEPS.length; i++) list.appendChild(el('li', '', STEPS[i]));
    box.appendChild(list);
    box.appendChild(el('p', 'fl-confidence-invite', INVITE));
    _nudge = el('p', 'fl-confidence-nudge', '');
    box.appendChild(_nudge);
    var field = el('input', 'fl-confidence-try');
    field.type = 'text';
    field.setAttribute('aria-label', 'Your try');
    box.appendChild(field);
    box.appendChild(button('Share your try', function () { consider(field.value); }));
    box.appendChild(button('Pause this', function () {
      safeSet(KEY, 'no');
      clearTimer();
      fillLesson(box);
    }));
  }
  function mount(host) {
    if (!host || !root.document) return host;
    if (host.getAttribute && host.getAttribute('data-fl-confidence') === '1') return host;
    if (host.setAttribute) host.setAttribute('data-fl-confidence', '1');
    ensureStyle();
    host.className = ((host.className || '') + ' fl-confidence').trim();
    _host = host;
    fillLesson(host);
    return host;
  }
  function offer(topic) {
    if (!isOn()) return '';
    if (_host) fillLesson(_host);
    arm();
    return promptAddon() + (topic ? (' Topic: ' + String(topic)) : '');
  }
  function boot() {
    var doc = root.document;
    if (!doc || !doc.getElementById) return;
    var host = doc.getElementById('fl-confidence-host');
    if (host) mount(host);
  }

  var api = {
    VERSION: 'v-confidence-first-v0.1',
    INVITE: INVITE,
    NUDGE: NUDGE,
    STEPS: STEPS,
    EXTRA: EXTRA,
    promptAddon: promptAddon,
    isOn: isOn,
    consider: consider,
    offer: offer,
    showNudge: showNudge,
    arm: arm,
    mount: mount,
    clearTimer: clearTimer
  };
  root.FLConfidence = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root.document) {
    if (root.document.readyState === 'loading' && root.document.addEventListener) {
      root.document.addEventListener('DOMContentLoaded', boot);
    } else boot();
  }
})(typeof window !== 'undefined' ? window : globalThis);
