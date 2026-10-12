// pool-reconnect-desk.js (MIT) v-tree-reconnect-v0.1 (034)
// Trusted devices on the Mesh Compute card, and the line that tells the truth
// about keep-on. A page can read keep-on. It cannot set it. Forget is one tap.
// Undo lives 10 seconds, in memory only. No dialog box.
(function (root) {
  'use strict';
  var VERSION = 'v-tree-reconnect-v0.1';
  var UNDO_MS = 10000;
  var WORDS = {
    keepOnLine: 'On. Stays on until you turn it off.',
    turnsOff: 'On. Turns off at ',
    turnsOffTail: ' if nobody joins.',
    title: 'Trusted devices',
    forget: 'Forget this device',
    forgetAll: 'Forget all devices',
    forgetAllAsk: 'Forget every trusted device? Each one will need a new join link.',
    forgotten: 'Forgotten.',
    undo: 'Undo',
    notNow: 'Not now',
    help: 'Help',
    connect: 'Connect only',
    empty: 'No trusted device yet. A phone joins with a link first.'
  };
  var _host = null, _undo = null, _timer = null, _poll = null, _asking = false;

  function api() {
    var a = root.electronAPI;
    return a && typeof a.latticeDiscoverKin === 'function' ? a : null;
  }
  function el(tag, cls, text) {
    var e = root.document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function btn(label, fn) {
    var b = el('button', 'pool-reconnect-btn', label);
    b.type = 'button';
    b.style.minHeight = '44px';
    b.style.maxWidth = '100%';
    b.addEventListener('click', function () { fn(); });
    return b;
  }
  function clock(ms) {
    try {
      var d = new Date(ms);
      if (isNaN(d.getTime())) return '';
      var h = d.getHours(), m = d.getMinutes();
      var ap = h >= 12 ? 'PM' : 'AM';
      h = h % 12; if (h === 0) h = 12;
      return h + ':' + (m < 10 ? '0' : '') + m + ' ' + ap;
    } catch (e) { return ''; }
  }
  function truth(st) {
    if (!st || !st.on) return '';
    if (st.keepOn) return WORDS.keepOnLine;
    var t = clock(st.offAt);
    if (!t) return 'On. Turns off if nobody joins.';
    return WORDS.turnsOff + t + WORDS.turnsOffTail;
  }
  function choiceWord(c) { return c === 'help' ? WORDS.help : WORDS.connect; }
  function seenWords(ms) {
    if (!ms) return '';
    var d = Math.max(0, Date.now() - Number(ms));
    if (d < 60000) return 'last seen just now';
    var m = Math.floor(d / 60000);
    if (m < 60) return 'last seen ' + m + (m === 1 ? ' minute ago' : ' minutes ago');
    var h = Math.floor(m / 60);
    if (h < 48) return 'last seen ' + h + (h === 1 ? ' hour ago' : ' hours ago');
    var days = Math.floor(h / 24);
    return 'last seen ' + days + (days === 1 ? ' day ago' : ' days ago');
  }
  function clear() { if (!_host) return; while (_host.firstChild) _host.removeChild(_host.firstChild); }
  function box() {
    var b = el('div', 'pool-reconnect');
    b.style.maxWidth = '100%';
    b.style.overflowWrap = 'anywhere';
    return b;
  }

  function paintUndo() {
    clear();
    var b = box();
    b.appendChild(el('p', 'pool-reconnect-line', WORDS.forgotten));
    b.appendChild(btn(WORDS.undo, function () { undo(); }));
    _host.appendChild(b);
  }
  function askAll() {
    _asking = true;
    clear();
    var b = box();
    b.appendChild(el('p', 'pool-reconnect-ask', WORDS.forgetAllAsk));
    var row = el('div', 'pool-reconnect-row');
    row.style.display = 'flex';
    row.style.flexWrap = 'wrap';
    row.style.gap = '8px';
    row.appendChild(btn(WORDS.forgetAll, function () { doForgetAll(); }));
    row.appendChild(btn(WORDS.notNow, function () { _asking = false; paint(); }));
    b.appendChild(row);
    _host.appendChild(b);
  }
  function rememberUndo(fps, snaps) {
    _undo = { fps: fps.slice(), until: Date.now() + UNDO_MS };
    if (_timer) root.clearTimeout(_timer);
    _timer = root.setTimeout(function () {
      if (_undo && Date.now() >= _undo.until) { _undo = null; paint(); }
    }, UNDO_MS);
    paintUndo();
  }
  function forgetOne(fp) {
    var a = api();
    if (!a) return;
    Promise.resolve(a.latticeDiscoverForget(fp)).then(function (r) {
      if (!r || !r.ok) { paint(); return; }
      rememberUndo([fp]);
    }, function () { paint(); });
  }
  function doForgetAll() {
    var a = api();
    _asking = false;
    if (!a) return;
    Promise.resolve(a.latticeDiscoverKin()).then(function (rows) {
      var list = Array.isArray(rows) ? rows : [];
      var fps = list.map(function (r) { return r && r.fp; }).filter(Boolean);
      return Promise.all(fps.map(function (fp) { return a.latticeDiscoverForget(fp); })).then(function () { return fps; });
    }).then(function (fps) {
      if (fps && fps.length) rememberUndo(fps);
      else paint();
    }, function () { paint(); });
  }
  function undo() {
    var a = api();
    if (!_undo || Date.now() >= _undo.until || !a) { _undo = null; paint(); return; }
    var fps = _undo.fps.slice();
    _undo = null;
    if (_timer) { root.clearTimeout(_timer); _timer = null; }
    Promise.all(fps.map(function (fp) { return a.latticeDiscoverForgetUndo(fp); })).then(function () { paint(); }, function () { paint(); });
  }
  function draw(st, rows) {
    if (!_host || _undo || _asking) return;
    clear();
    var b = box();
    var line = truth(st);
    if (line) b.appendChild(el('p', 'pool-reconnect-truth', line));
    b.appendChild(el('strong', 'pool-reconnect-title', WORDS.title));
    var list = Array.isArray(rows) ? rows : [];
    if (!list.length) b.appendChild(el('p', 'pool-reconnect-empty', WORDS.empty));
    list.forEach(function (r) {
      if (!r || !r.fp) return;
      var row = el('div', 'pool-reconnect-row');
      row.style.display = 'flex';
      row.style.flexWrap = 'wrap';
      row.style.gap = '8px';
      row.style.alignItems = 'center';
      row.style.maxWidth = '100%';
      row.appendChild(el('span', 'pool-reconnect-name', String(r.name || r.fp).slice(0, 60)));
      row.appendChild(el('span', 'pool-reconnect-choice', choiceWord(r.choice)));
      var seen = seenWords(r.lastAt);
      if (seen) row.appendChild(el('span', 'pool-reconnect-seen', seen));
      row.appendChild(btn(WORDS.forget, function () { forgetOne(r.fp); }));
      b.appendChild(row);
    });
    if (list.length) b.appendChild(btn(WORDS.forgetAll, function () { askAll(); }));
    _host.appendChild(b);
  }
  function paint() {
    var a = api();
    if (!a || !_host || _undo || _asking) return;
    var stP = (typeof a.latticeDiscoverStatus === 'function') ? Promise.resolve(a.latticeDiscoverStatus()) : Promise.resolve(null);
    var kinP = Promise.resolve(a.latticeDiscoverKin());
    Promise.all([stP, kinP]).then(function (two) { draw(two[0], two[1]); }, function () { draw(null, []); });
  }
  function mount(host) {
    if (!host || !api()) return false;
    _host = host;
    paint();
    if (_poll) root.clearInterval(_poll);
    _poll = root.setInterval(paint, 3000);
    return true;
  }
  function boot() {
    if (!root.document) return;
    var h = root.document.getElementById('pool-reconnect-host');
    if (h) mount(h);
  }
  root.PoolReconnectDesk = {
    VERSION: VERSION,
    WORDS: WORDS,
    mount: mount,
    paint: paint,
    truth: truth
  };
  if (root.document && root.document.addEventListener) {
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', boot);
    else boot();
  }
})(typeof window !== 'undefined' ? window : this);
