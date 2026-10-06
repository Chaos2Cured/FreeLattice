// fl-gathering.js: The Gathering, shared core (FreeLattice + theLatticeTree)
//
// Marker: v-gathering-shared-v0.1
// Byte-identical twins: FreeLattice docs/modules/fl-gathering.js and
// FreeLattice-Alpha docs/modules/fl-gathering.js. Change both or neither.
// Chairs that wait. Unnamed, with choice. Not a router. Empty chairs stay empty.
// A chair can seat a mind on this computer (127.0.0.1 only) or a cloud mind the
// person already pays for with their own key. A seat never stores a key.
// Looks for local minds only when asked. Words by textContent only.
// Brick 1 seats minds. Speaking from a chair comes in the next brick.

(function (root) {
  'use strict';

  var VERSION = 'v-gathering-shared-v0.1';
  var CHAIRS = [
    { id: 'cortex', type: 'cortex', later: false },
    { id: 'memory', type: 'memory', later: false },
    { id: 'continuity', type: 'continuity', later: false },
    { id: 'dream', type: 'dream', later: false },
    { id: 'seat-5', type: 'a seat, later', later: true },
    { id: 'seat-6', type: 'a seat, later', later: true },
    { id: 'seat-7', type: 'a seat, later', later: true }
  ];
  var LOCAL_DOORS = ['http://127.0.0.1:11435', 'http://127.0.0.1:11434'];
  var LOOPBACK_RE = /^http:\/\/127\.0\.0\.1:\d{1,5}$/;
  var WORDS = {
    title: 'The Gathering',
    line: 'Chairs that wait. Seat a mind on this computer, or a cloud mind with your own key. Empty chairs stay empty.',
    find: 'Find local minds',
    finding: 'Looking on this computer (127.0.0.1 only)...',
    foundSome: function (n) { return 'Found ' + n + ' local ' + (n === 1 ? 'mind' : 'minds') + '. Tap a chair to seat one.'; },
    foundNone: 'No mind answered on this computer. If Ollama or the Bridge is running, try again. Connect, under More, can help.',
    secureNote: ' Some browsers keep a secure page from reaching 127.0.0.1; the desktop app does not have that limit.',
    local: 'On this computer',
    localEmpty: 'None found yet. Tap Find local minds first.',
    cloud: 'Cloud, with your own key',
    cloudEmpty: 'No cloud key saved here yet. Add one in Settings, then come back.',
    notNow: 'Not now',
    clear: 'Clear this chair',
    speak: 'Let this chair speak first',
    speaking: 'speaks first',
    empty: 'empty',
    later: 'Not yet. These seats open later.',
    seated: function (chair, label) { return label + ' sits in ' + chair + '.'; },
    cleared: function (chair) { return 'Cleared. ' + chair + ' is empty again.'; },
    pickFor: function (chair) { return 'Who sits in ' + chair + '?'; },
    foot: 'Seating only for now. Seated minds speak in the next brick. A seat keeps the mind\'s name, never a key.'
  };

  function isLoopback(base) { return LOOPBACK_RE.test(String(base || '')); }

  // A seat is data only: kind, model, a short label, and where it lives.
  function normalizeSeat(s) {
    if (!s || typeof s !== 'object') return null;
    var kind = s.kind === 'cloud' ? 'cloud' : (s.kind === 'local' ? 'local' : '');
    var model = String(s.model || '').trim().slice(0, 120);
    if (!kind || !model) return null;
    var out = { kind: kind, model: model };
    if (kind === 'local') {
      if (!isLoopback(s.base)) return null;
      out.base = String(s.base);
    } else {
      out.provider = String(s.provider || '').replace(/[^a-z0-9_-]/gi, '').slice(0, 40);
      if (!out.provider) return null;
      out.providerName = String(s.providerName || out.provider).slice(0, 60);
    }
    out.label = String(s.label || (kind === 'cloud' ? out.providerName + ': ' + model : model)).slice(0, 140);
    return out;
  }

  function shortName(model) {
    var m = String(model || '');
    var i = m.lastIndexOf('/');
    return i >= 0 ? m.slice(i + 1) : m;
  }

  function readState(key) {
    try {
      var raw = root.localStorage && root.localStorage.getItem(key);
      var st = raw ? JSON.parse(raw) : {};
      var seats = {};
      CHAIRS.forEach(function (c) {
        if (c.later) return;
        var s = normalizeSeat(st && st.seats && st.seats[c.id]);
        if (s) seats[c.id] = s;
      });
      var speaking = st && typeof st.speaking === 'string' && seats[st.speaking] ? st.speaking : '';
      return { seats: seats, speaking: speaking };
    } catch (e) { return { seats: {}, speaking: '' }; }
  }

  function writeState(key, st) {
    try { root.localStorage.setItem(key, JSON.stringify({ v: 1, seats: st.seats, speaking: st.speaking })); } catch (e) {}
  }

  function tagsAt(base, ms) {
    var ctl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    var t = ctl ? setTimeout(function () { try { ctl.abort(); } catch (e) {} }, ms || 4000) : null;
    return root.fetch(base + '/api/tags', ctl ? { signal: ctl.signal } : {}).then(function (r) {
      if (t) clearTimeout(t);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (data) {
      return ((data && data.models) || []).map(function (m) {
        var name = String((m && (m.name || m.model)) || '');
        return name ? { kind: 'local', model: name, base: base, label: shortName(name) } : null;
      }).filter(Boolean);
    }, function (e) { if (t) clearTimeout(t); throw e; });
  }

  // Read only: asks the doors, changes nothing in the app's own settings.
  function findLocal(adapter) {
    var doors = LOCAL_DOORS.slice();
    try {
      var manual = adapter && typeof adapter.manualBase === 'function' ? adapter.manualBase() : '';
      manual = String(manual || '').replace(/\/+$/, '');
      if (isLoopback(manual) && doors.indexOf(manual) === -1) doors.unshift(manual);
    } catch (e) {}
    return Promise.all(doors.map(function (b) {
      return tagsAt(b, 4000).catch(function () { return []; });
    })).then(function (lists) {
      var seen = {}, out = [];
      lists.forEach(function (l) {
        l.forEach(function (m) {
          if (seen[m.model]) return;
          seen[m.model] = true;
          out.push(m);
        });
      });
      return out;
    });
  }

  function cloudOptions(adapter) {
    var list = [];
    try { list = (adapter && typeof adapter.cloudMinds === 'function') ? (adapter.cloudMinds() || []) : []; } catch (e) { list = []; }
    var seen = {};
    return list.map(function (c) { return normalizeSeat(Object.assign({ kind: 'cloud' }, c)); })
      .filter(function (s) {
        if (!s) return false;
        var k = s.provider + '|' + s.model;
        if (seen[k]) return false;
        seen[k] = true;
        return true;
      });
  }

  var STYLE = [
    '.flg{max-width:720px;margin:0 auto;padding:16px 12px 40px;font-family:Georgia,\'Times New Roman\',serif;color:var(--text-primary,#e8e4dc)}',
    '.flg h2{margin:0 0 6px;font-size:1.3rem;color:var(--gold,#e8b019);font-weight:normal}',
    '.flg-line{margin:0 0 14px;font-size:.9rem;color:var(--text-secondary,#a8a4a0);line-height:1.5}',
    '.flg-find{background:transparent;color:var(--gold,#e8b019);border:1px solid var(--gold,#e8b019);border-radius:999px;padding:8px 16px;font:inherit;font-size:.88rem;cursor:pointer;min-height:40px}',
    '.flg-chairs{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin:16px 0}',
    '.flg-chair{text-align:left;background:rgba(232,176,25,.05);border:1px solid rgba(232,176,25,.25);border-radius:14px;padding:12px;color:inherit;font:inherit;cursor:pointer;min-height:72px}',
    '.flg-chair.is-later{opacity:.55;border-style:dashed}',
    '.flg-chair.is-bound{border-color:rgba(52,211,153,.55);background:rgba(52,211,153,.07)}',
    '.flg-type{display:block;font-size:.95rem}',
    '.flg-who{display:block;font-size:.78rem;color:var(--text-secondary,#a8a4a0);margin-top:4px;word-break:break-word}',
    '.flg-speaks{display:inline-block;margin-top:4px;font-size:.72rem;color:#34d399}',
    '.flg-picker{border:1px solid rgba(232,176,25,.3);border-radius:14px;padding:12px;margin:0 0 14px}',
    '.flg-picker h3{margin:0 0 8px;font-size:1rem;font-weight:normal}',
    '.flg-group{margin:8px 0 4px;font-size:.78rem;color:var(--text-muted,#8a8680);text-transform:lowercase}',
    '.flg-opt,.flg-act{display:block;width:100%;text-align:left;margin:4px 0;padding:8px 10px;border-radius:10px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.03);color:inherit;font:inherit;font-size:.85rem;cursor:pointer;min-height:40px}',
    '.flg-act{text-align:center;color:var(--text-secondary,#a8a4a0)}',
    '.flg-note{min-height:20px;font-size:.85rem;color:var(--text-secondary,#a8a4a0);margin:10px 0}',
    '.flg-foot{font-size:.75rem;color:var(--text-muted,#8a8680);margin-top:18px}'
  ].join('\n');

  var _host = null;

  function el(tag, cls, text) {
    var e = root.document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function ensureStyle() {
    var d = root.document;
    if (d.getElementById('fl-gathering-style')) return;
    var s = d.createElement('style');
    s.id = 'fl-gathering-style';
    s.textContent = STYLE;
    (d.head || d.documentElement).appendChild(s);
  }

  function mount(host, adapter) {
    if (!host || !root.document) return null;
    adapter = adapter || {};
    var key = String(adapter.storageKey || 'fl_gathering_chairs_v0');
    ensureStyle();
    unmount();
    _host = host;
    var st = readState(key);
    var found = [];

    var wrap = el('section', 'flg');
    wrap.setAttribute('data-gathering', VERSION);
    wrap.appendChild(el('h2', '', WORDS.title));
    wrap.appendChild(el('p', 'flg-line', WORDS.line));
    var findBtn = el('button', 'flg-find', WORDS.find);
    findBtn.type = 'button';
    wrap.appendChild(findBtn);
    var note = el('div', 'flg-note');
    note.setAttribute('aria-live', 'polite');
    wrap.appendChild(note);
    var picker = el('div', 'flg-picker');
    picker.hidden = true;
    wrap.appendChild(picker);
    var ring = el('div', 'flg-chairs');
    wrap.appendChild(ring);
    wrap.appendChild(el('p', 'flg-foot', WORDS.foot));

    function say(msg) { note.textContent = msg; }

    function paint() {
      while (ring.firstChild) ring.removeChild(ring.firstChild);
      CHAIRS.forEach(function (c) {
        var b = el('button', 'flg-chair' + (c.later ? ' is-later' : ''));
        b.type = 'button';
        b.setAttribute('data-chair', c.id);
        b.appendChild(el('span', 'flg-type', c.type));
        var seat = st.seats[c.id];
        b.appendChild(el('span', 'flg-who', c.later ? WORDS.later : (seat ? seat.label : WORDS.empty)));
        if (seat) {
          b.classList.add('is-bound');
          if (st.speaking === c.id) b.appendChild(el('span', 'flg-speaks', WORDS.speaking));
        }
        b.addEventListener('click', function () {
          if (c.later) { say(WORDS.later); return; }
          openPicker(c);
        });
        ring.appendChild(b);
      });
    }

    function closePicker() {
      picker.hidden = true;
      while (picker.firstChild) picker.removeChild(picker.firstChild);
    }

    function option(seat, chair) {
      var o = el('button', 'flg-opt', seat.label);
      o.type = 'button';
      o.addEventListener('click', function () {
        st.seats[chair.id] = seat;
        if (!st.speaking) st.speaking = chair.id;
        writeState(key, st);
        closePicker();
        paint();
        say(WORDS.seated(chair.type, seat.label));
        if (typeof adapter.onChange === 'function') { try { adapter.onChange(st); } catch (e) {} }
      });
      return o;
    }

    function openPicker(chair) {
      closePicker();
      picker.hidden = false;
      picker.appendChild(el('h3', '', WORDS.pickFor(chair.type)));
      picker.appendChild(el('div', 'flg-group', WORDS.local));
      if (found.length) found.forEach(function (s) { picker.appendChild(option(s, chair)); });
      else picker.appendChild(el('div', 'flg-line', WORDS.localEmpty));
      picker.appendChild(el('div', 'flg-group', WORDS.cloud));
      var clouds = cloudOptions(adapter);
      if (clouds.length) clouds.forEach(function (s) { picker.appendChild(option(s, chair)); });
      else picker.appendChild(el('div', 'flg-line', WORDS.cloudEmpty));
      if (st.seats[chair.id]) {
        if (st.speaking !== chair.id) {
          var sp = el('button', 'flg-act', WORDS.speak);
          sp.type = 'button';
          sp.addEventListener('click', function () {
            st.speaking = chair.id; writeState(key, st); closePicker(); paint();
          });
          picker.appendChild(sp);
        }
        var cl = el('button', 'flg-act', WORDS.clear);
        cl.type = 'button';
        cl.addEventListener('click', function () {
          delete st.seats[chair.id];
          if (st.speaking === chair.id) st.speaking = Object.keys(st.seats)[0] || '';
          writeState(key, st); closePicker(); paint(); say(WORDS.cleared(chair.type));
          if (typeof adapter.onChange === 'function') { try { adapter.onChange(st); } catch (e) {} }
        });
        picker.appendChild(cl);
      }
      var no = el('button', 'flg-act', WORDS.notNow);
      no.type = 'button';
      no.addEventListener('click', closePicker);
      picker.appendChild(no);
    }

    findBtn.addEventListener('click', function () {
      findBtn.disabled = true;
      say(WORDS.finding);
      findLocal(adapter).then(function (list) {
        found = list;
        var secure = root.location && root.location.protocol === 'https:';
        say(list.length ? WORDS.foundSome(list.length) : WORDS.foundNone + (secure ? WORDS.secureNote : ''));
      }).then(function () { findBtn.disabled = false; });
    });

    paint();
    host.appendChild(wrap);
    return wrap;
  }

  function unmount() {
    if (_host) {
      var w = _host.querySelector('[data-gathering]');
      if (w && w.parentNode) w.parentNode.removeChild(w);
    }
    _host = null;
  }

  root.FLGathering = {
    VERSION: VERSION,
    CHAIRS: CHAIRS,
    WORDS: WORDS,
    mount: mount,
    unmount: unmount,
    getState: function (key) { return readState(String(key || 'fl_gathering_chairs_v0')); },
    findLocal: findLocal,
    cloudOptions: cloudOptions,
    normalizeSeat: normalizeSeat,
    isLoopback: isLoopback
  };
})(typeof window !== 'undefined' ? window : this);
