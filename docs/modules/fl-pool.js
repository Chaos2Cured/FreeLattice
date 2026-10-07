// fl-pool.js: Device Pool v0.1 (old phones and laptops helping each other)
//
// Marker: v-device-pool-v0.1
// Soft marker: v-device-pool-door-truth-v0.1 (the note shows the real share door state; one tap narrows to kin)
// Soft marker: v-device-pool-honest-off-v0.1 (not helping also reads the door; pause wins visibly; plain words; a real card)
// One card lists this device and each connected, verified device: rough memory
// (navigator.deviceMemory, which browsers round and cap), cores, the local minds it
// holds (Ollama model names and sizes, or Browser AI). "Let this device help" is one
// tap: it sets the share door to trusted kin only and says hello to verified peers.
// "Use this mind" sends whole questions to the device that holds that mind, through
// the existing mesh path (ModelSwitcher.selectMesh). Nothing new is opened.
// Honest: memory is never merged across a network. Each mind runs whole on one
// device. The total shown is the pool's memory side by side, not one bigger memory.
// Classroom lab: a teacher machine asks, student machines help. Each machine taps
// its own yes. Wired LAN is the expected home; Wi-Fi also works for whole questions.
// Splitting one model across machines is a later Workshop experiment (wired LAN).
// Quiet Room: closed. Nothing sent or taken in while it is open.
// Words by textContent only. No dialogs. No keys, prompts or answers in a hello.
// Receipts are counts only.

(function (root) {
  'use strict';

  var VERSION = 'v-device-pool-v0.1';
  var HELP_KEY = 'fl_pool_helping';      // 'true' when this device said yes
  var COUNTS_KEY = 'fl_pool_counts';     // { hellosSent, hellosTaken, routed } counts only
  var STALE_MS = 10 * 60 * 1000;
  var MAX_MODELS = 24;
  var HONEST = 'Memory is not joined over a network. Each mind runs whole on one device. The pool lets every question go to the device that can hold it.';
  var _a = {};
  var _host = null;
  var _peers = {};   // peerId -> { name, mem, cores, browserAI, models, at }

  function safeGet(k) { try { return root.localStorage.getItem(k); } catch (e) { return null; } }
  function safeSet(k, v) { try { root.localStorage.setItem(k, v); } catch (e) {} }
  function clip(s, n) { return String(s == null ? '' : s).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n); }
  function num(x, max) { x = Number(x); return isFinite(x) && x >= 0 ? Math.min(x, max) : 0; }
  function count(field) {
    var c = {};
    try { c = JSON.parse(safeGet(COUNTS_KEY) || '{}') || {}; } catch (e) { c = {}; }
    c[field] = (Number(c[field]) || 0) + 1;
    safeSet(COUNTS_KEY, JSON.stringify(c));
  }
  function quiet() { try { return !!(root.FLKin && root.FLKin.isQuietRoom && root.FLKin.isQuietRoom()); } catch (e) { return false; } }
  function helping() { return safeGet(HELP_KEY) === 'true'; }
  function gb(bytes) { return Math.round((Number(bytes) || 0) / 1e8) / 10; }

  function el(tag, cls, text) {
    var e = root.document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  // What this device can say about itself. Coarse on purpose.
  function selfInfo() {
    var nav = root.navigator || {};
    var info = { mem: num(nav.deviceMemory, 64), cores: num(nav.hardwareConcurrency, 256), browserAI: '', models: [] };
    try { if (root.BrowserAI && root.BrowserAI.ready) info.browserAI = clip(root.BrowserAI.modelId || 'Browser AI', 80); } catch (e) {}
    return Promise.resolve(_a.localModels ? _a.localModels() : []).then(function (ms) {
      info.models = (Array.isArray(ms) ? ms : []).slice(0, MAX_MODELS).map(function (m) {
        return { name: clip(m && m.name, 80), size: num(m && m.size, 1e12) };
      }).filter(function (m) { return m.name; });
      return info;
    }, function () { return info; });
  }

  function hello(info) {
    return { type: 'pool-hello', v: 1, mem: info.mem, cores: info.cores, browserAI: info.browserAI, models: info.models };
  }

  function sayHello() {
    if (quiet() || !helping()) return Promise.resolve(0);
    return selfInfo().then(function (info) {
      var sent = 0;
      (_a.peers ? _a.peers() : []).forEach(function (p) {
        if (!p || !p.verified || typeof p.send !== 'function') return;
        try { p.send(hello(info)); sent++; } catch (e) {}
      });
      if (sent) count('hellosSent');
      return sent;
    });
  }

  // Taken only from a verified peer, outside the Quiet Room. Fields are clipped.
  function receive(msg, peer) {
    if (quiet()) return { ok: false, reason: 'quiet-room' };
    if (!peer || !peer.verified || !peer.id) return { ok: false, reason: 'not-verified' };
    if (!msg || msg.type !== 'pool-hello' || msg.v !== 1) return { ok: false, reason: 'shape' };
    _peers[peer.id] = {
      name: clip(peer.name || peer.id, 40),
      mem: num(msg.mem, 64),
      cores: num(msg.cores, 256),
      browserAI: clip(msg.browserAI, 80),
      models: (Array.isArray(msg.models) ? msg.models : []).slice(0, MAX_MODELS).map(function (m) {
        return { name: clip(m && m.name, 80), size: num(m && m.size, 1e12) };
      }).filter(function (m) { return m.name; }),
      at: Date.now()
    };
    count('hellosTaken');
    paint();
    return { ok: true };
  }

  function letHelp(opts) {
    if (quiet()) return { ok: false, reason: 'quiet-room' };
    // v-device-pool-honest-off-v0.1: pause wins visibly. A paused door is never resumed
    // by this tap alone. The card asks once; only "Yes, resume for trusted kin" passes resume.
    if (doorMode() === 'pause' && !(opts && opts.resume)) {
      _askResume = true;
      paint();
      return { ok: false, reason: 'door-paused', ask: true };
    }
    _askResume = false;
    safeSet(HELP_KEY, 'true');
    // Trusted kin only. A person can open the door wider on the share door card.
    try {
      if (root.FLShareDoor) {
        var m = root.FLShareDoor.mode ? root.FLShareDoor.mode() : '';
        if (m !== 'open') root.FLShareDoor.setMode('kin', 'human');
        if (root.FLShareDoor.markAsked) root.FLShareDoor.markAsked();
      }
    } catch (e) {}
    try { if (_a.advertise) _a.advertise(); } catch (e) {}
    sayHello();
    paint();
    return { ok: true };
  }

  function stopHelp() {
    _askResume = false;
    safeSet(HELP_KEY, 'false');
    try { if (root.FLShareDoor) root.FLShareDoor.setMode('pause', 'human'); } catch (e) {}
    paint();
    return { ok: true };
  }

  function useMind(peerId, model) {
    if (quiet()) return false;
    if (!_a.route) return false;
    try { _a.route(peerId, model); count('routed'); return true; } catch (e) { return false; }
  }

  // The device that holds a model, biggest memory first. Whole requests only.
  function whoHas(model) {
    var out = [];
    Object.keys(_peers).forEach(function (id) {
      var p = _peers[id];
      if (Date.now() - p.at > STALE_MS) return;
      if (p.models.some(function (m) { return m.name === model; })) out.push({ id: id, name: p.name, mem: p.mem });
    });
    return out.sort(function (a, b) { return b.mem - a.mem; });
  }

  function memLine(mem, cores) {
    var a = mem ? ('about ' + mem + ' GB memory (the browser rounds this)') : 'memory not shared by this browser';
    return a + (cores ? ', ' + cores + ' cores' : '');
  }

  // v-device-pool-door-truth-v0.1: tell the truth about the share door.
  function doorMode() {
    try { return root.FLShareDoor && root.FLShareDoor.mode ? String(root.FLShareDoor.mode()) : ''; } catch (e) { return ''; }
  }
  function doorLine() {
    var m = doorMode();
    if (m === 'open') return 'This device helps people you have connected with, because the share door is open. Tap Only trusted kin to narrow it. Receipts keep counts, never words.';
    if (m === 'pause') return 'Helping is on, but the share door is paused, so no one can use this device right now.';
    if (m === 'off') return 'Helping is on, but sharing is off on the share door, so no one can use this device right now.';
    return 'This device helps trusted kin only. Pause any time. Receipts keep counts, never words.';
  }
  function narrowToKin() {
    try { if (root.FLShareDoor && root.FLShareDoor.setMode) root.FLShareDoor.setMode('kin', 'human'); } catch (e) {}
    paint();
    return doorMode() === 'kin';
  }

  // v-device-pool-honest-off-v0.1 (paste 016b): the not-helping line reads the share door
  // the same way FLShareDoor.admit does. admit lets a peer through when the door is open
  // (any connected, verified peer) or kin (trusted kin only). Pause and off let no one in.
  // Helping or not, the pool flag only gates hellos; the share door is the real gate.
  var OFF_LINE = 'Off. Nothing from this device is offered until you tap.';
  var _askResume = false;
  var POOL_CSS = [
    '.fl-pool{background:var(--bg-card,#1a1830);border:1px solid var(--border,#2a2840);border-radius:var(--radius,13px);box-shadow:var(--shadow,0 2px 13px rgba(0,0,0,0.3));padding:16px;font-size:1rem;line-height:1.55;color:rgba(255,255,255,0.88);}',
    '.fl-pool p{margin:8px 0;}',
    '.fl-pool button{min-height:44px;min-width:44px;font-size:1rem;padding:10px 16px;margin:6px 8px 6px 0;border-radius:10px;border:1px solid #d4a017;background:#3b2f0b;color:#fff;cursor:pointer;font-family:inherit;}',
    '.fl-pool button.fl-pool-help,.fl-pool button.fl-pool-resume{background:var(--accent,#e8b019);border-color:var(--accent,#e8b019);color:var(--bg-primary,#0e0c1e);font-weight:600;}',
    '.fl-pool-honest,.fl-pool-later,.fl-pool-means{color:var(--text-secondary,#a0a5b8);font-size:0.95rem;}',
    '.fl-pool-note,.fl-pool-door,.fl-pool-ask{color:#fff;}',
    '.fl-pool-means{margin:8px 0;padding-left:20px;}',
    '.fl-pool-means li{margin:4px 0;}',
    '.fl-pool-power{display:flex;align-items:center;gap:10px;min-height:44px;cursor:pointer;}',
    '.fl-pool-power input{width:22px;height:22px;flex:0 0 auto;}',
    '.fl-pool-row{padding:12px 0;border-top:1px solid rgba(255,255,255,0.12);}',
    '.fl-pool-who{font-weight:600;color:#fff;}',
    '@media (max-width:480px){.fl-pool{padding:14px 12px;}.fl-pool button{display:block;width:100%;margin:8px 0;}}'
  ].join('\n');
  function addStyle() {
    var d = root.document;
    if (!d || !d.createElement || !d.head || (d.getElementById && d.getElementById('flPoolStyle'))) return;
    var st = d.createElement('style');
    st.id = 'flPoolStyle';
    st.textContent = POOL_CSS;
    d.head.appendChild(st);
  }
  // Trusted kin the share door would let in (same test as the door: granted, not revoked).
  // -1 means this page cannot tell (no FLKin), so the card says nothing about it.
  function kinCount() {
    try {
      if (root.FLKin && typeof root.FLKin.passes === 'function') {
        var p = root.FLKin.passes() || {};
        return Object.keys(p).filter(function (fp) { var x = p[fp]; return !!(x && x.grantedAt && !x.revokedAt); }).length;
      }
    } catch (e) {}
    return -1;
  }
  function pluggedOnly() {
    try { if (root.FLShareDoor && root.FLShareDoor.pluggedOnlyOn) return !!root.FLShareDoor.pluggedOnlyOn(); } catch (e) {}
    return safeGet('fl_share_door_plugged_only') === 'true';
  }
  function setPluggedOnly(on) {
    try { if (root.FLShareDoor && root.FLShareDoor.setPluggedOnly) { root.FLShareDoor.setPluggedOnly(!!on); paint(); return; } } catch (e) {}
    safeSet('fl_share_door_plugged_only', on ? 'true' : 'false');
    paint();
  }
  function offLine() {
    var m = doorMode();
    var k = kinCount();
    if (m === 'open') return 'Not helping in the pool, but your share door is open: people you connected with can already use this computer\'s AI. Tap Only trusted kin to narrow it.';
    if (m === 'kin' && k > 0) return 'Not helping in the pool, but your share door lets your trusted kin (' + k + ') use this computer\'s AI. No one else.';
    if (m === 'kin' && k === 0) return OFF_LINE + ' Your share door is set to trusted kin only, and you have no trusted kin yet.';
    if (m === 'kin') return 'Not helping in the pool, but your share door lets trusted kin use this computer\'s AI. No one else.';
    if (m === 'pause') return OFF_LINE + ' Your share door is paused too.';
    return OFF_LINE;
  }
  function kinZeroLine() {
    return (doorMode() === 'kin' && kinCount() === 0)
      ? 'Trusted kin only, with no trusted kin yet, means no one can be helped yet. Tap Trust this AI on a connected person\'s card above to add them.'
      : '';
  }

  function paint() {
    var host = _host;
    if (!host || !root.document) return;
    addStyle();
    while (host.firstChild) host.removeChild(host.firstChild);
    var wrap = el('div', 'fl-pool');
    wrap.setAttribute('data-device-pool', VERSION);
    wrap.appendChild(el('div', 'section-title', 'Device Pool: your phones and laptops, helping'));
    wrap.appendChild(el('p', 'fl-pool-line', 'Old phones and laptops, or a whole classroom lab, can each hold a mind. Tap once on each device you trust, then ask from any of them. In a lab the teacher machine asks and the student machines help.'));
    wrap.appendChild(el('p', 'fl-pool-honest', HONEST));
    if (quiet()) { wrap.appendChild(el('p', 'fl-pool-note', 'The Quiet Room is closed to the pool.')); host.appendChild(wrap); return; }

    var btn = el('button', 'fl-pool-help', helping() ? 'Stop helping (pause sharing)' : 'Let this device help');
    btn.type = 'button';
    // before v-device-pool-honest-off-v0.1: btn.addEventListener('click', function () { if (helping()) stopHelp(); else letHelp(); });
    btn.addEventListener('click', function () { if (helping()) stopHelp(); else letHelp(); }); // letHelp now asks first when the door is paused
    wrap.appendChild(btn);
    // before v-device-pool-door-truth-v0.1: the note always said "trusted kin only" while helping,
    // even when the share door was already open. Now the note reads the real door.
    // before v-device-pool-honest-off-v0.1: the not-helping side always said
    // 'Off. Nothing from this device is offered until you tap.' even with the door open.
    wrap.appendChild(el('p', 'fl-pool-note', helping()
      ? doorLine()
      : offLine()));
    if (!helping() && _askResume && doorMode() === 'pause') {
      var ask = el('div', 'fl-pool-ask');
      ask.appendChild(el('p', 'fl-pool-ask-line', 'Your share door is paused. Helping would resume it for trusted kin only, not for everyone. Resume for trusted kin?'));
      var yes = el('button', 'fl-pool-resume', 'Yes, resume for trusted kin');
      yes.type = 'button';
      yes.addEventListener('click', function () { letHelp({ resume: true }); });
      var keep = el('button', 'fl-pool-keep', 'Keep it paused');
      keep.type = 'button';
      keep.addEventListener('click', function () { _askResume = false; paint(); });
      ask.appendChild(yes);
      ask.appendChild(keep);
      wrap.appendChild(ask);
    }
    if (!helping() && doorMode() === 'open') {
      var narrowOff = el('button', 'fl-pool-narrow', 'Only trusted kin');
      narrowOff.type = 'button';
      narrowOff.addEventListener('click', function () { narrowToKin(); });
      wrap.appendChild(narrowOff);
    }
    var kz = helping() ? kinZeroLine() : ''; // not helping: offLine already says it
    if (kz) wrap.appendChild(el('p', 'fl-pool-door', kz));
    var means = el('ul', 'fl-pool-means');
    means.appendChild(el('li', '', 'Whose AI: this computer\'s own local AI, the minds listed under This device below.'));
    means.appendChild(el('li', '', 'What is shared: questions from verified peers you connected with run on that AI, and the answers go back to them.'));
    means.appendChild(el('li', '', 'Hellos go to verified peers only and carry this device\'s rough memory, cores and model names. No chats, no keys.'));
    means.appendChild(el('li', '', 'Power: answering uses this computer\'s power and battery. Stop helping pauses the whole share door.'));
    wrap.appendChild(means);
    var pw = el('label', 'fl-pool-power');
    var pwIn = root.document.createElement('input');
    pwIn.type = 'checkbox';
    pwIn.checked = pluggedOnly();
    pwIn.addEventListener('change', function () { setPluggedOnly(pwIn.checked); });
    pw.appendChild(pwIn);
    pw.appendChild(el('span', '', 'Only help while plugged in (some browsers cannot tell; then this does not stop help)'));
    wrap.appendChild(pw);
    if (helping() && doorMode() === 'open') {
      var narrow = el('button', 'fl-pool-narrow', 'Only trusted kin');
      narrow.type = 'button';
      narrow.addEventListener('click', function () { narrowToKin(); });
      wrap.appendChild(narrow);
    }

    var list = el('div', 'fl-pool-list');
    var total = 0;
    var me = el('div', 'fl-pool-row');
    me.appendChild(el('div', 'fl-pool-who', 'This device'));
    var meLine = el('div', 'fl-pool-mem', 'Checking...');
    me.appendChild(meLine);
    list.appendChild(me);
    selfInfo().then(function (info) {
      var minds = info.models.map(function (m) { return m.name + (m.size ? ' (' + gb(m.size) + ' GB)' : ''); });
      if (info.browserAI) minds.push(info.browserAI + ' in this browser');
      meLine.textContent = memLine(info.mem, info.cores) + '. Minds: ' + (minds.length ? minds.join(', ') : 'none yet');
      total += info.mem;
      sum.textContent = 'Side by side: about ' + total + ' GB across ' + (1 + live.length) + ' device' + (live.length ? 's' : '') + '. Not one memory.';
    });

    var live = Object.keys(_peers).filter(function (id) { return Date.now() - _peers[id].at <= STALE_MS; });
    live.forEach(function (id) {
      var p = _peers[id];
      total += p.mem;
      var row = el('div', 'fl-pool-row');
      row.appendChild(el('div', 'fl-pool-who', p.name));
      row.appendChild(el('div', 'fl-pool-mem', memLine(p.mem, p.cores) + (p.browserAI ? '. Browser AI: ' + p.browserAI : '')));
      p.models.forEach(function (m) {
        var b = el('button', 'fl-pool-use', 'Use ' + m.name + (m.size ? ' (' + gb(m.size) + ' GB)' : '') + ' on this device');
        b.type = 'button';
        b.addEventListener('click', function () {
          var ok = useMind(id, m.name);
          note.textContent = ok ? ('Questions now go to ' + m.name + ' on ' + p.name + '. Pick another model any time to stop.') : 'That device is not reachable right now.';
        });
        row.appendChild(b);
      });
      if (!p.models.length) row.appendChild(el('div', 'fl-pool-note', 'No local mind shared yet.'));
      list.appendChild(row);
    });
    // before v-device-pool-honest-off-v0.1: 'No other devices yet. Connect them on Community first, then tap Let this device help on each one.'
    // (the card already lives on Community, so it points up the page instead)
    if (!live.length) list.appendChild(el('p', 'fl-pool-empty', 'No other devices yet. Connect them with Create Connection, higher up on this page, then tap Let this device help on each one.'));
    var sum = el('p', 'fl-pool-sum', '');
    var note = el('div', 'fl-pool-note'); note.setAttribute('aria-live', 'polite');
    wrap.appendChild(list);
    wrap.appendChild(sum);
    wrap.appendChild(note);
    wrap.appendChild(el('p', 'fl-pool-later', 'Later, in the Workshop: a classroom lab on one wired network can split one big model across several computers (llama.cpp RPC), with the teacher machine leading. Each machine says yes on its own screen. Not in this card.'));
    host.appendChild(wrap);
  }

  function use(adapter) { _a = adapter || {}; }
  function mount(host, adapter) {
    if (adapter) use(adapter);
    _host = host || null;
    paint();
    if (helping()) sayHello();
  }

  root.FLPool = {
    VERSION: VERSION,
    HONEST: HONEST,
    use: use,
    mount: mount,
    receive: receive,
    sayHello: sayHello,
    letHelp: letHelp,
    stopHelp: stopHelp,
    useMind: useMind,
    whoHas: whoHas,
    helping: helping,
    repaint: paint,
    doorLine: doorLine,
    narrowToKin: narrowToKin,
    offLine: offLine,
    kinCount: kinCount,
    pluggedOnly: pluggedOnly,
    setPluggedOnly: setPluggedOnly,
    askingResume: function () { return _askResume; },
    _peers: function () { return _peers; }
  };
})(typeof window !== 'undefined' ? window : this);
