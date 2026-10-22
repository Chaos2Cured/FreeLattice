// pool-honest-label.js (MIT) v-pool-honest-label-v0.1
// A calm line when a pooled device helps with a chat, a per-chat switch that
// keeps that chat on this device, Disconnect, and Just me.
// v-pool-honest-heals-v0.1: name a device once, Leave can be undone, and Leave
// stays off the asker's own chat.
// v-leave-cut-heal-v0.1: the cut follows the other device's role, not ours.
// The pinned pool files stay as they are. Chat calls permit and run here first.
(function (root) {
  'use strict';
  var VERSION = 'v-pool-honest-label-v0.1';
  var KEEP_KEY = 'fl_pool_honest_keep_v1';
  var CUT_KEY = 'fl_pool_honest_cut_v1';
  var POOLCUT_KEY = 'fl_pool_honest_poolcut_v1';
  var HELPED_KEY = 'fl_pool_honest_helped_v1';
  var NOTES_KEY = 'fl_pool_honest_notes_v1';
  var LEFT_KEY = 'fl_pool_honest_helper_left_v1';
  var THREAD = 'tree-thread';
  var CARD = 'tree-pool-card';
  var NOTE = "When you pool, the other person's computer has to read your words to work on them. Encryption protects your words while they travel, but not while a computer is working on them. The hardware that can hide this in big data centers is not on everyday phones and laptops. So pool only with people you would trust in your living room. Pause always wins, and anything private can stay on your own device with 'Keep this chat on my device only'. If a real fix appears, we will build it in the open.";
  var LINE_KEEP = 'No mind on this device right now. This chat stays here, so nothing was sent.';
  var LINE_JUST = 'No mind on this device right now, so this message was not sent.';
  var LINE_NEXT = 'From the next message, this chat stays on this device.';
  var LINE_SMALL = 'The pool is smaller now.';
  var LINE_LEFT = 'You left the pool. Let it help again whenever you like.';
  var PATHS = ['ask', 'askTurns', 'askBest', 'askChat', 'callMeshModel', 'meshSendToPeer', 'useMind', 'relay', 'knock', 'split'];
  var _just = {};
  var _why = {};
  var _active = THREAD;
  var _holds = {};
  var _onShip = null;
  var _lastShrink = null;
  var _panels = [];
  var _shrinkLine = '';

  function clip(s, n) {
    return String(s == null ? '' : s).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);
  }
  function read(k, fb) {
    try { var raw = root.localStorage.getItem(k); return raw ? JSON.parse(raw) : fb; }
    catch (e) { return fb; }
  }
  function write(k, v) {
    try { root.localStorage.setItem(k, JSON.stringify(v)); } catch (e) {}
  }
  function paused() {
    try { if (root.TreePool && typeof root.TreePool.mode === 'function' && root.TreePool.mode() === 'pause') return true; } catch (e) {}
    try { if (root.FLShareDoor && typeof root.FLShareDoor.mode === 'function' && root.FLShareDoor.mode() === 'pause') return true; } catch (e2) {}
    try { if (root.FLPool && typeof root.FLPool.doorMode === 'function' && root.FLPool.doorMode() === 'pause') return true; } catch (e3) {}
    return false;
  }
  function keepMap() { var m = read(KEEP_KEY, {}); return m && typeof m === 'object' ? m : {}; }
  function keepOn(id) { return keepMap()[id] === true; }
  function setKeep(id, on) {
    var m = keepMap();
    if (on) m[id] = true;
    else delete m[id];
    write(KEEP_KEY, m);
    refresh();
  }
  function cutMap() { var m = read(CUT_KEY, {}); return m && typeof m === 'object' ? m : {}; }
  function cuts(id) { var list = cutMap()[id]; return Array.isArray(list) ? list : []; }
  function poolCuts() { var a = read(POOLCUT_KEY, []); return Array.isArray(a) ? a : []; }
  function peerBlocked(peerId, chatId) {
    if (!peerId) return false;
    if (poolCuts().indexOf(peerId) !== -1) return true;
    return cuts(chatId || _active).indexOf(peerId) !== -1;
  }
  function flChatId() {
    try {
      var id = root.state && root.state.currentConversationId;
      return 'fl-' + (id || 'chat');
    } catch (e) { return 'fl-chat'; }
  }
  function activeChat() { return _active; }
  function setActive(id) { if (id) _active = String(id).slice(0, 80); return _active; }
  function meshName(peerId) {
    try {
      var peers = root.state && root.state.meshPeers;
      if (peers && typeof peers.get === 'function') {
        var p = peers.get(peerId);
        if (p && p.name) return clip(p.name, 80);
        if (p && p.meshBadge) return clip(p.meshBadge, 80);
      }
    } catch (e) {}
    return '';
  }
  function localReady() {
    try { if (root.BrowserAI && root.BrowserAI.ready) return true; } catch (e) {}
    try {
      if (root.LocalMindProbe && typeof root.LocalMindProbe.getRemembered === 'function') {
        var mind = root.LocalMindProbe.getRemembered();
        if (mind && (mind.url || mind.model)) return true;
      }
    } catch (e2) {}
    try {
      if (root.TreeBrowserMind && typeof root.TreeBrowserMind.awakeModel === 'function' && root.TreeBrowserMind.awakeModel()) return true;
    } catch (e3) {}
    try {
      var st = root.state;
      if (st && st.isLocal && !st.meshInference) return true;
      if (st && st._localAIUrl) return true;
    } catch (e4) {}
    return false;
  }
  function poss(name) {
    var n = clip(name, 80);
    if (!n || n === "another person's") return "another person's";
    return n + "'s";
  }
  // A kin card already says "Ada's computer (Ada)". Do not add "'s device" again.
  function devicePhrase(name) {
    var n = clip(name, 80);
    if (!n || n === "another person's") return "another person's device";
    if (/'s (computer|device|phone|laptop)/i.test(n)) return n;
    return poss(n) + ' device';
  }
  function labelFor(names) {
    var uniq = [];
    (names || []).forEach(function (n) {
      var clean = clip(n, 80) || "another person's";
      if (uniq.indexOf(clean) === -1) uniq.push(clean);
    });
    if (!uniq.length) return '';
    var tail = ' They could see what it processes. Pool only with people you trust.';
    if (uniq.length === 1) return 'Part of this chat runs on ' + devicePhrase(uniq[0]) + '.' + tail;
    if (uniq.length > 3) return "Part of this chat runs on other people's devices." + tail;
    var bits = uniq.map(function (n) { return devicePhrase(n); });
    var last = bits.pop();
    return 'Part of this chat runs on ' + (bits.length ? bits.join(', ') + ' and ' : '') + last + '.' + tail;
  }
  function helped(chatId) {
    var m = read(HELPED_KEY, {});
    var list = m && m[chatId];
    return Array.isArray(list) ? list : [];
  }
  function notes(chatId) {
    var m = read(NOTES_KEY, {});
    var list = m && m[chatId];
    return Array.isArray(list) ? list : [];
  }
  function rememberReply(chatId, peer) {
    if (!chatId) return;
    var id = clip(peer && peer.id, 80) || clip(peer && peer.name, 80) || 'kin';
    var name = clip(peer && peer.name, 80) || "another person's";
    var hm = read(HELPED_KEY, {});
    var list = Array.isArray(hm[chatId]) ? hm[chatId] : [];
    var found = false;
    list.forEach(function (row) { if (row && row.id === id) { row.name = name; found = true; } });
    if (!found) list.push({ id: id, name: name });
    hm[chatId] = list.slice(0, 8);
    write(HELPED_KEY, hm);
    var nm = read(NOTES_KEY, {});
    var rows = Array.isArray(nm[chatId]) ? nm[chatId] : [];
    rows.push({ id: id, name: name });
    nm[chatId] = rows.slice(-40);
    write(NOTES_KEY, nm);
    refresh();
  }
  function replyNote(name) {
    return 'Helped on ' + devicePhrase(name) + '.';
  }
  function permit(path, ctx) {
    ctx = ctx || {};
    var chatId = ctx.chatId || _active;
    var why = '';
    if (paused()) why = 'pause';
    else if (keepOn(chatId)) why = 'keep';
    else if (_just[chatId]) { why = 'just'; delete _just[chatId]; }
    else if (ctx.peer && peerBlocked(ctx.peer.id, chatId)) why = 'cut';
    else if (ctx.peerId && peerBlocked(ctx.peerId, chatId)) why = 'cut';
    _why[chatId] = why;
    return !why;
  }
  function stoppedLine(chatId) {
    var why = _why[chatId || _active] || '';
    if (why === 'just') return LINE_JUST;
    if (why === 'pause') return 'Paused. Nothing was sent to another device.';
    return LINE_KEEP;
  }
  function mustHalt() { return !localReady(); }
  function run(path, ctx, fn) {
    if (!permit(path, ctx || {})) {
      return Promise.resolve({ ok: false, reason: 'kept-here', line: stoppedLine(ctx && ctx.chatId) });
    }
    var peerId = ctx && ctx.peer && ctx.peer.id;
    if (peerId) noteShip(path, peerId);
    try { return Promise.resolve(fn()); }
    catch (e) { return Promise.reject(e); }
  }
  function noteShip(path, peerId) {
    if (typeof _onShip === 'function') _onShip(path, peerId || '');
  }
  function armJust(chatId) {
    if (chatId) setActive(chatId);
    _just[chatId] = !_just[chatId];
    refresh();
    return !!_just[chatId];
  }
  function justOn(chatId) { return !!_just[chatId]; }
  function beginSend(chatId, opts) {
    opts = opts || {};
    setActive(chatId);
    var allowed = permit('askChat', { chatId: chatId, peer: opts.peer || null, peerId: opts.peerId || (opts.peer && opts.peer.id) || '' });
    var here = !!(opts.hasLocal || localReady());
    if (!allowed) {
      return {
        pool: false,
        via: here ? 'local' : 'none',
        line: here ? '' : stoppedLine(chatId),
        just: _why[chatId] === 'just'
      };
    }
    return { pool: true, via: 'pool', line: '', just: false };
  }
  function shrinkBody() { return { type: 'pool-shrank', v: 1 }; }
  function tellShrink(peerId) {
    var body = shrinkBody();
    _lastShrink = body;
    try { if (root.TreePool && typeof root.TreePool.emitShrink === 'function') root.TreePool.emitShrink(peerId); } catch (e) {}
    try { if (typeof root.meshSendToPeer === 'function') root.meshSendToPeer(peerId, body); } catch (e2) {}
    return body;
  }
  function disconnect(chatId, peer, alsoPool) {
    if (!peer || !peer.id) return;
    var m = cutMap();
    var list = Array.isArray(m[chatId]) ? m[chatId].slice() : [];
    if (list.indexOf(peer.id) === -1) list.push(peer.id);
    m[chatId] = list;
    write(CUT_KEY, m);
    if (alsoPool) {
      var all = poolCuts().slice();
      if (all.indexOf(peer.id) === -1) all.push(peer.id);
      write(POOLCUT_KEY, all);
      try { if (root.TreePool && typeof root.TreePool.disconnect === 'function') root.TreePool.disconnect(peer.id); } catch (e) {}
    }
    tellShrink(peer.id);
    refresh();
  }
  function holdHelper(peerId, bag) {
    var row = { bag: bag, dropped: false };
    if (!_holds[peerId]) _holds[peerId] = [];
    _holds[peerId].push(row);
    return {
      release: function () {
        var list = _holds[peerId] || [];
        var i = list.indexOf(row);
        if (i !== -1) list.splice(i, 1);
      },
      dropped: function () { return row.dropped; }
    };
  }
  function clearHelper(peerId) {
    var rows = _holds[peerId] || [];
    rows.forEach(function (row) {
      row.dropped = true;
      var bag = row.bag;
      if (!bag) return;
      if (Array.isArray(bag.messages)) bag.messages.length = 0;
      if (bag.body && typeof bag.body === 'object') {
        if (Array.isArray(bag.body.messages)) bag.body.messages.length = 0;
        bag.body.messages = [];
      }
      bag.body = null;
      if (typeof bag.abort === 'function') { try { bag.abort(); } catch (e) {} }
    });
    _holds[peerId] = [];
    try { root.sessionStorage.removeItem('fl_pool_helper_' + peerId); } catch (e2) {}
  }
  function holdDropped(peerId) {
    var rows = _holds[peerId] || [];
    for (var i = 0; i < rows.length; i++) if (rows[i].dropped) return true;
    return false;
  }
  function helperLeft() {
    try { return root.localStorage.getItem(LEFT_KEY) === 'true'; } catch (e) { return false; }
  }
  function setHelperLeft(on) {
    try { root.localStorage.setItem(LEFT_KEY, on ? 'true' : 'false'); } catch (e) {}
  }
  function deviceHelping() {
    try { if (root.TreePool && typeof root.TreePool.mode === 'function' && root.TreePool.mode() === 'kin') return true; } catch (e) {}
    try { if (root.FLPool && typeof root.FLPool.helping === 'function' && root.FLPool.helping()) return true; } catch (e2) {}
    try {
      var m = root.FLShareDoor && typeof root.FLShareDoor.mode === 'function' ? root.FLShareDoor.mode() : '';
      if (m === 'open' || m === 'kin') return true;
    } catch (e3) {}
    return false;
  }
  function askerChat(chatId) {
    if (!chatId) return false;
    if (chatId === THREAD) return true;
    return String(chatId).indexOf('fl-') === 0;
  }
  function showLeave(chatId) {
    return !helperLeft() && !askerChat(chatId) && deviceHelping();
  }
  function onHelpChosen() {
    setHelperLeft(false);
    refresh();
  }
  // The door may already be open, so the old "Let this device help" button is not on screen.
  // This one calls that same choice. Leave itself still sends only pool-shrank.
  function chooseHelpAgain() {
    var called = false;
    try {
      if (root.TreePool && typeof root.TreePool.letHelp === 'function') { root.TreePool.letHelp(); called = true; }
    } catch (e) {}
    try {
      if (root.FLPool && typeof root.FLPool.letHelp === 'function') { root.FLPool.letHelp(); called = true; }
    } catch (e2) {}
    try {
      if (root.FLShareDoor && typeof root.FLShareDoor.setMode === 'function') {
        var m = typeof root.FLShareDoor.mode === 'function' ? root.FLShareDoor.mode() : '';
        if (m !== 'open' && m !== 'kin') root.FLShareDoor.setMode('kin');
        called = true;
      }
    } catch (e3) {}
    if (!called) onHelpChosen();
  }
  function letAgainButton() {
    var again = btn('Let it help', function () { chooseHelpAgain(); });
    if (again) again.setAttribute('data-honest-let', '1');
    return again;
  }
  // True when that peer was helping this device, not merely asking it.
  // Read before clearHelper, which drops an in-flight hold.
  function peerWasOurHelper(peerId) {
    if (!peerId) return false;
    var id = String(peerId);
    try {
      if (root.TreePool && typeof root.TreePool.peers === 'function') {
        var peers = root.TreePool.peers() || [];
        for (var i = 0; i < peers.length; i++) {
          if (peers[i] && peers[i].id === id && peers[i].helping) return true;
        }
      }
    } catch (e) {}
    try {
      if (root.FLPool && typeof root.FLPool._peers === 'function') {
        var book = root.FLPool._peers();
        if (book && book[id]) return true;
      }
    } catch (e2) {}
    try {
      if (root.state && root.state.meshInference && root.state.meshPeerId === id) return true;
    } catch (e3) {}
    var rows = helped(_active);
    for (var h = 0; h < rows.length; h++) {
      if (rows[h] && rows[h].id === id) return true;
    }
    var held = _holds[id];
    if (held && held.length) return true;
    return false;
  }
  function helperHeardShrink(peerId) {
    // A helper does not write the person who shrank the pool into this device's own cut list.
    // The sender already recorded their cut. This side only stops the work in hand.
    // The cut follows the other device. Skip it only when this device is helping
    // and that peer was purely asking (a helper does not cut the asker).
    var helping = deviceHelping();
    var peerHelped = peerWasOurHelper(peerId);
    clearHelper(peerId);
    // before 045c: if (peerId && !helping) { write peerId into the active chat cut list }
    if (peerId && (peerHelped || !helping)) {
      var m = cutMap();
      var list = Array.isArray(m[_active]) ? m[_active].slice() : [];
      if (list.indexOf(peerId) === -1) list.push(peerId);
      m[_active] = list;
      write(CUT_KEY, m);
    }
    // No new wire message. Holders drop a helper who left because helping is now false.
    if (peerHelped) {
      try {
        if (root.TreePool && typeof root.TreePool.markNotHelping === 'function') root.TreePool.markNotHelping(peerId);
      } catch (e4) {}
    }
    _shrinkLine = LINE_SMALL;
    refresh();
  }
  function leaveHelping() {
    setHelperLeft(true);
    var ids = [];
    try {
      if (root.TreePool && typeof root.TreePool.peers === 'function') {
        root.TreePool.peers().forEach(function (p) {
          if (p && p.id && p.state !== 'closed') ids.push(p.id);
        });
      }
    } catch (e) {}
    Object.keys(_holds).forEach(function (id) { if (ids.indexOf(id) === -1) ids.push(id); });
    ids.forEach(function (id) { tellShrink(id); clearHelper(id); });
    // before 045b: _shrinkLine = LINE_SMALL;
    refresh();
  }
  function el(tag, cls, text) {
    var d = root.document;
    if (!d || !d.createElement) return null;
    var node = d.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }
  function btn(text, press) {
    var b = el('button', 'fl-honest-btn', text);
    if (!b) return null;
    b.type = 'button';
    b.style.minHeight = '44px';
    b.style.minWidth = '44px';
    b.style.padding = '10px 14px';
    b.style.margin = '4px 8px 4px 0';
    b.style.maxWidth = '100%';
    b.style.boxSizing = 'border-box';
    b.style.whiteSpace = 'normal';
    b.style.textAlign = 'left';
    b.addEventListener('click', press);
    return b;
  }
  function addStyle() {
    var d = root.document;
    if (!d || !d.head || d.getElementById('flHonestStyle')) return;
    var st = d.createElement('style');
    st.id = 'flHonestStyle';
    st.textContent = [
      '.fl-honest{max-width:100%;box-sizing:border-box;overflow-wrap:anywhere;word-break:break-word;}',
      '.fl-honest p,.fl-honest button{max-width:100%;}',
      '.fl-honest-line{margin:0.4rem 0;line-height:1.45;}',
      '.fl-honest-btn{scroll-margin:56px 0;}',
      '#thread-veil.is-open{overflow-y:auto;justify-content:safe center;scroll-padding:52px 0 24px;}',
      '@media (max-width: 420px){#thread-veil .fl-honest{padding-right:132px;box-sizing:border-box;}}',
      '@media (prefers-reduced-motion: reduce){.fl-honest,.fl-honest *{animation:none !important;transition:none !important;}}'
    ].join('');
    d.head.appendChild(st);
  }
  function livePeers(chatId) {
    var out = helped(chatId).slice();
    try {
      if ((chatId === THREAD || chatId === CARD) && root.TreePool && typeof root.TreePool.namedHolders === 'function') {
        root.TreePool.namedHolders().forEach(function (p) {
          if (!p || !p.id) return;
          if (!out.some(function (row) { return row.id === p.id; })) out.push({ id: p.id, name: p.name || "another person's" });
        });
      }
    } catch (e) {}
    try {
      if (String(chatId).indexOf('fl-') === 0 && root.state && root.state.meshInference && root.state.meshPeerId) {
        var id = root.state.meshPeerId;
        var name = meshName(id) || "another person's";
        if (!out.some(function (row) { return row.id === id; })) out.push({ id: id, name: name });
      }
    } catch (e2) {}
    return out.filter(function (p) { return p && p.id && !peerBlocked(p.id, chatId); });
  }
  function fill(panel, chatId) {
    if (!panel) return;
    while (panel.firstChild) panel.removeChild(panel.firstChild);
    var names = [];
    helped(chatId).forEach(function (p) { names.push(p.name); });
    livePeers(chatId).forEach(function (p) { names.push(p.name); });
    var line = labelFor(names);
    if (line) {
      var p = el('p', 'fl-honest-line', line);
      p.setAttribute('data-honest-label', '1');
      panel.appendChild(p);
    }
    notes(chatId).forEach(function (row) {
      panel.appendChild(el('p', 'fl-honest-line', replyNote(row && row.name)));
    });
    if (_shrinkLine) panel.appendChild(el('p', 'fl-honest-line', _shrinkLine));
    // before 045c: if (helperLeft()) { append LINE_LEFT and Let it help on every panel }
    // Settings already shows that line once, beside the pool card. A second copy on the card made three.
    var settingsHostsLeave = false;
    try { settingsHostsLeave = !!(root.document && root.document.getElementById && root.document.getElementById('flHonestSettingsNote')); } catch (eHost) {}
    if (helperLeft() && !settingsHostsLeave) {
      var leftLine = el('p', 'fl-honest-line', LINE_LEFT);
      if (leftLine) {
        leftLine.setAttribute('data-honest-left', '1');
        panel.appendChild(leftLine);
      }
      var again = letAgainButton();
      if (again) panel.appendChild(again);
    }
    if (keepOn(chatId)) panel.appendChild(el('p', 'fl-honest-line', LINE_NEXT));
    var keep = btn(keepOn(chatId) ? 'Keep this chat on my device only. On.' : 'Keep this chat on my device only', function () {
      setKeep(chatId, !keepOn(chatId));
    });
    if (keep) {
      keep.setAttribute('aria-pressed', keepOn(chatId) ? 'true' : 'false');
      keep.setAttribute('role', 'switch');
      keep.setAttribute('data-honest-keep', chatId);
      panel.appendChild(keep);
    }
    var meaning = btn('What does this mean?', function () {
      var open = panel.querySelector('[data-honest-note]');
      if (!open) return;
      if (open.hasAttribute('hidden')) open.removeAttribute('hidden');
      else open.setAttribute('hidden', '');
    });
    if (meaning) {
      meaning.setAttribute('data-honest-meaning', '1');
      panel.appendChild(meaning);
    }
    var note = el('p', 'fl-honest-line', NOTE);
    if (note) {
      note.setAttribute('data-honest-note', '1');
      note.setAttribute('hidden', '');
      panel.appendChild(note);
    }
    livePeers(chatId).forEach(function (peer) {
      var name = clip(peer.name, 80) || "another person's";
      var cut = btn('Disconnect ' + name, function () { disconnect(chatId, peer, false); });
      var leave = btn('Also leave the pool with them', function () { disconnect(chatId, peer, true); });
      if (cut) { cut.setAttribute('data-honest-cut', peer.id); panel.appendChild(cut); }
      if (leave) panel.appendChild(leave);
    });
    // before 045c: if (showLeave(chatId)) { append Leave on the panel as well as Settings }
    if (showLeave(chatId) && !settingsHostsLeave) {
      var leaveBtn = btn('Leave', function () { leaveHelping(); });
      if (leaveBtn) {
        leaveBtn.setAttribute('data-honest-leave', '1');
        panel.appendChild(leaveBtn);
      }
    }
  }
  function mountPanel(parent, chatId, before) {
    if (!parent || !root.document) return null;
    addStyle();
    var panel = el('div', 'fl-honest');
    if (!panel) return null;
    panel.setAttribute('data-honest-panel', chatId);
    if (before && before.parentNode === parent) parent.insertBefore(panel, before);
    else parent.appendChild(panel);
    _panels.push({ node: panel, chatId: chatId });
    fill(panel, chatId);
    return panel;
  }
  function mountThread(rootEl, opts) {
    opts = opts || {};
    var chatId = opts.chatId || THREAD;
    setActive(chatId);
    if (rootEl && rootEl.querySelector && rootEl.querySelector('[data-honest-panel="' + chatId + '"]')) {
      refresh();
    } else if (rootEl) {
      mountPanel(rootEl, chatId, rootEl.firstChild);
    }
    var justHost = opts.justHost || (opts.sendBtn && opts.sendBtn.parentNode);
    if (justHost && !justHost.querySelector('[data-honest-just]')) {
      var just = btn('Just me', function () { armJust(chatId); });
      if (just) {
        just.setAttribute('data-honest-just', chatId);
        just.setAttribute('aria-pressed', 'false');
        if (opts.justHost || !opts.sendBtn) justHost.appendChild(just);
        else justHost.insertBefore(just, opts.sendBtn);
      }
    }
    refresh();
  }
  function mountJustState(chatId) {
    var d = root.document;
    if (!d || !d.querySelectorAll) return;
    Array.prototype.forEach.call(d.querySelectorAll('[data-honest-just]'), function (b) {
      var id = b.getAttribute('data-honest-just');
      if (!id || id === '1') id = chatId;
      var on = !!_just[id];
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.textContent = on ? 'Just me. On.' : 'Just me';
    });
  }
  function refresh() {
    var d = root.document;
    var live = flChatId();
    _panels.forEach(function (row) {
      if (!row || !row.node || row.node.isConnected === false) return;
      if (String(row.chatId).indexOf('fl-') === 0) {
        row.chatId = live;
        row.node.setAttribute('data-honest-panel', row.chatId);
        setActive(live);
      }
      fill(row.node, row.chatId);
    });
    if (d && d.querySelectorAll) {
      Array.prototype.forEach.call(d.querySelectorAll('[data-honest-just]'), function (b) {
        var id = b.getAttribute('data-honest-just') || '';
        if (id.indexOf('fl-') === 0) b.setAttribute('data-honest-just', live);
      });
    }
    mountJustState(_active);
    syncSettingsLeave();
  }
  function ensureSettingsNote(host) {
    var d = root.document;
    if (!d || !host || !host.parentNode || d.getElementById('flHonestSettingsNote')) return;
    addStyle();
    var note = el('p', 'fl-honest fl-honest-line', NOTE);
    if (!note) return;
    note.id = 'flHonestSettingsNote';
    note.setAttribute('data-honest-settings', '1');
    note.style.overflowWrap = 'anywhere';
    note.style.maxWidth = '100%';
    if (host.nextSibling) host.parentNode.insertBefore(note, host.nextSibling);
    else host.parentNode.appendChild(note);
    syncSettingsLeave();
  }
  function syncSettingsLeave() {
    var d = root.document;
    if (!d || !d.getElementById) return;
    var note = d.getElementById('flHonestSettingsNote');
    if (!note || !note.parentNode) return;
    var old = d.getElementById('flHonestSettingsExtra');
    if (old && old.parentNode) old.parentNode.removeChild(old);
    var extra = null;
    if (helperLeft()) {
      extra = el('div', 'fl-honest');
      var leftLine = el('p', 'fl-honest-line', LINE_LEFT);
      if (leftLine) {
        leftLine.setAttribute('data-honest-left', '1');
        extra.appendChild(leftLine);
      }
      var again = letAgainButton();
      if (again) extra.appendChild(again);
    } else if (deviceHelping()) extra = btn('Leave', function () { leaveHelping(); });
    if (!extra) return;
    extra.id = 'flHonestSettingsExtra';
    if (extra.setAttribute) extra.setAttribute('data-honest-left', helperLeft() ? '1' : '0');
    if (!helperLeft() && extra.setAttribute) extra.setAttribute('data-honest-leave', 'settings');
    if (note.nextSibling) note.parentNode.insertBefore(extra, note.nextSibling);
    else note.parentNode.appendChild(extra);
  }
  function afterPoolMount(host) {
    ensureSettingsNote(host);
    if (host && host.id === 'tree-pool-host' && host.querySelector && !host.querySelector('[data-honest-panel="' + CARD + '"]')) {
      mountPanel(host, CARD);
    }
  }
  function wrapMount(obj, key) {
    if (!obj || typeof obj[key] !== 'function' || obj[key]._honestWrapped) return;
    var inner = obj[key];
    function wrapped(host) {
      var result = inner.apply(this, arguments);
      try { afterPoolMount(host); } catch (e) {}
      return result;
    }
    wrapped._honestWrapped = true;
    obj[key] = wrapped;
  }
  function wrapUseMind() {
    var pool = root.FLPool;
    if (!pool || typeof pool.useMind !== 'function' || pool.useMind._honestWrapped) return;
    var inner = pool.useMind;
    function wrapped(peerId, model) {
      var chatId = flChatId();
      if (paused() || keepOn(chatId) || justOn(chatId) || peerBlocked(peerId, chatId)) return false;
      noteShip('useMind', peerId);
      return inner(peerId, model);
    }
    wrapped._honestWrapped = true;
    pool.useMind = wrapped;
  }
  function wrapHelp(obj, key) {
    if (!obj || typeof obj[key] !== 'function' || obj[key]._honestHelp) return;
    var inner = obj[key];
    function wrapped() {
      var result = inner.apply(this, arguments);
      try {
        var treeOn = root.TreePool && typeof root.TreePool.mode === 'function' && root.TreePool.mode() === 'kin';
        var poolOn = root.FLPool && typeof root.FLPool.helping === 'function' && root.FLPool.helping();
        if (treeOn || poolOn) onHelpChosen();
      } catch (e) {}
      return result;
    }
    wrapped._honestHelp = true;
    obj[key] = wrapped;
  }
  function wrapShareMode(obj) {
    if (!obj || typeof obj.setMode !== 'function' || obj.setMode._honestHelp) return;
    var inner = obj.setMode;
    function wrapped(m) {
      var result = inner.apply(this, arguments);
      try {
        var now = obj.mode ? obj.mode() : m;
        if (now === 'open' || now === 'kin') onHelpChosen();
      } catch (e) {}
      return result;
    }
    wrapped._honestHelp = true;
    obj.setMode = wrapped;
  }
  function boot() {
    addStyle();
    var d = root.document;
    if (!d) return;
    var chat = d.getElementById('chatMessages');
    var send = d.getElementById('sendBtn');
    if (chat) {
      setActive(flChatId());
      mountPanel(chat.parentNode, flChatId(), chat);
      if (send && send.parentNode && !d.querySelector('[data-honest-just]')) {
        var just = btn('Just me', function () { armJust(flChatId()); setActive(flChatId()); });
        if (just) {
          just.setAttribute('data-honest-just', flChatId());
          just.setAttribute('aria-pressed', 'false');
          send.parentNode.insertBefore(just, send);
        }
      }
    }
    wrapMount(root.TreePool, 'mount');
    wrapMount(root.FLPool, 'mount');
    wrapUseMind();
    wrapHelp(root.TreePool, 'letHelp');
    wrapHelp(root.FLPool, 'letHelp');
    wrapShareMode(root.FLShareDoor);
    var pool = d.getElementById('flPoolHost') || d.getElementById('tree-pool-host');
    if (pool) afterPoolMount(pool);
  }
  if (root.document) {
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', boot);
    else boot();
  }

  root.FLPoolHonest = {
    VERSION: VERSION,
    PATHS: PATHS,
    NOTE: NOTE,
    LINE_KEEP: LINE_KEEP,
    LINE_JUST: LINE_JUST,
    LINE_NEXT: LINE_NEXT,
    LINE_SMALL: LINE_SMALL,
    LINE_LEFT: LINE_LEFT,
    THREAD: THREAD,
    CARD: CARD,
    permit: permit,
    run: run,
    noteShip: noteShip,
    beginSend: beginSend,
    stoppedLine: stoppedLine,
    mustHalt: mustHalt,
    keepOn: keepOn,
    setKeep: setKeep,
    armJust: armJust,
    justOn: justOn,
    peerBlocked: peerBlocked,
    disconnect: disconnect,
    tellShrink: tellShrink,
    shrinkBody: shrinkBody,
    lastShrink: function () { return _lastShrink; },
    holdHelper: holdHelper,
    clearHelper: clearHelper,
    holdDropped: holdDropped,
    helperLeft: helperLeft,
    helperHeardShrink: helperHeardShrink,
    leaveHelping: leaveHelping,
    onHelpChosen: onHelpChosen,
    showLeave: showLeave,
    deviceHelping: deviceHelping,
    rememberReply: rememberReply,
    replyNote: replyNote,
    labelFor: labelFor,
    helped: helped,
    flChatId: flChatId,
    activeChat: activeChat,
    setActive: setActive,
    meshName: meshName,
    localReady: localReady,
    mountThread: mountThread,
    refresh: refresh,
    set onShip(fn) { _onShip = fn; },
    get onShip() { return _onShip; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
