// gathering-speak.js: speaking chair and Checker notes (FreeLattice + theLatticeTree)
//
// Marker: v-gathering-speak-checker-v0.1
// Byte-identical twins: FreeLattice docs/modules/gathering-speak.js and
// FreeLattice-Alpha docs/modules/gathering-speak.js. Change both or neither.
// Reads FLGathering.getState. Does not store a key. Does not invent an answer.
// The Tree page does not mount this yet (brick 3). The file still travels with the Tree.

(function (root) {
  'use strict';

  var VERSION = 'v-gathering-speak-checker-v0.1';
  var SEAT_KEY = 'fl_gathering_chairs_v0';
  var THREAD_KEY = 'fl_gathering_thread_v0';
  var CHECK_KEY = 'fl_gathering_checker_v0';
  var MAX_TURNS = 8;
  var MAX_NOTES = 12;
  var MAX_NOTE = 240;

  var STYLE = [
    '.flgs{max-width:720px;margin:0 auto;padding:0 12px 32px;box-sizing:border-box;font-family:Georgia,"Times New Roman",serif;color:var(--text-primary,#e8e4dc)}',
    '.flgs-card{max-width:100%;box-sizing:border-box;border:1px solid rgba(232,176,25,.35);border-radius:14px;padding:14px;margin:0 0 14px;background:rgba(232,176,25,.04);box-shadow:0 0 18px rgba(232,176,25,.12)}',
    '.flgs h2{margin:0 0 8px;font-size:1.15rem;font-weight:normal;color:var(--gold,#e8b019)}',
    '.flgs p,.flgs label{margin:0 0 8px;font-size:.9rem;line-height:1.45;color:var(--text-secondary,#a8a4a0);overflow-wrap:anywhere}',
    '.flgs-turn{margin:0 0 6px;font-size:.9rem;line-height:1.4;color:var(--text-primary,#e8e4dc)}',
    '.flgs-field{display:block;width:100%;max-width:100%;box-sizing:border-box;min-height:44px;margin:0 0 8px;padding:8px 10px;border-radius:10px;border:1px solid rgba(255,255,255,.16);background:rgba(0,0,0,.2);color:inherit;font:inherit;font-size:.9rem}',
    '.flgs-actions{display:flex;flex-wrap:wrap;gap:8px}',
    '.flgs-btn{display:inline-flex;align-items:center;justify-content:center;min-height:44px;min-width:44px;padding:12px 16px;border-radius:999px;border:1px solid var(--gold,#e8b019);background:transparent;color:var(--gold,#e8b019);font:inherit;font-size:.9rem;cursor:pointer}',
    '.flgs-btn[disabled]{opacity:.55;cursor:default}',
    '.flgs-receipt{min-height:1.2em}',
    '.flgs-notes{list-style:none;padding:0;margin:8px 0 0}',
    '.flgs-notes li{margin:0 0 6px;overflow-wrap:anywhere}',
    '@media (prefers-reduced-motion: no-preference){',
    '  .flgs-card.v-gathering-speak-checker-v0\\.1{transition:transform 200ms ease-out,box-shadow 200ms ease-out}',
    '  .flgs-card.v-gathering-speak-checker-v0\\.1:hover,.flgs-card.v-gathering-speak-checker-v0\\.1:focus-within{transform:translateY(-2px);box-shadow:0 0 26px rgba(232,176,25,.28)}',
    '}',
    '@media (prefers-reduced-motion: reduce){',
    '  .flgs-card.v-gathering-speak-checker-v0\\.1{animation:none !important;transition:none !important;transform:none !important}',
    '}'
  ].join('\n');

  function el(tag, cls, text) {
    var node = root.document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  function looksLikeSecret(text) {
    var s = String(text || '');
    if (/sk-[A-Za-z0-9]{8,}/.test(s)) return true;
    if (/Bearer\s+\S{12,}/.test(s)) return true;
    if (/\b(api[_-]?key|token|secret)\b/i.test(s) && /[A-Za-z0-9_\-]{16,}/.test(s)) return true;
    return false;
  }

  function readJson(key) {
    try {
      var raw = root.localStorage && root.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function readThread() {
    var data = readJson(THREAD_KEY);
    var list = data && Array.isArray(data.turns) ? data.turns : [];
    return list.filter(function (t) {
      return t && (t.role === 'person' || t.role === 'chair') && typeof t.text === 'string';
    }).slice(-MAX_TURNS).map(function (t) {
      return { role: t.role, text: String(t.text).slice(0, 2000), label: String(t.label || '').slice(0, 140), chair: String(t.chair || '').slice(0, 40) };
    });
  }

  function writeThread(turns) {
    try {
      root.localStorage.setItem(THREAD_KEY, JSON.stringify({ v: 1, turns: turns.slice(-MAX_TURNS) }));
    } catch (e) {}
  }

  function readNotes() {
    var data = readJson(CHECK_KEY);
    var list = data && Array.isArray(data.notes) ? data.notes : [];
    return list.filter(function (n) { return n && typeof n.text === 'string'; }).slice(-MAX_NOTES).map(function (n) {
      return { text: String(n.text).slice(0, MAX_NOTE), t: String(n.t || '').slice(0, 40) };
    });
  }

  function writeNotes(notes) {
    try {
      root.localStorage.setItem(CHECK_KEY, JSON.stringify({
        v: 1,
        notes: notes.slice(-MAX_NOTES).map(function (n) {
          return { text: String(n.text || '').slice(0, MAX_NOTE), t: String(n.t || '').slice(0, 40) };
        })
      }));
    } catch (e) {}
  }

  function addNote(text) {
    var clean = String(text || '').replace(/\s+/g, ' ').trim().slice(0, MAX_NOTE);
    if (!clean) return { ok: false, reason: 'empty' };
    if (looksLikeSecret(clean)) return { ok: false, reason: 'key' };
    var notes = readNotes();
    notes.push({ text: clean, t: new Date().toISOString() });
    writeNotes(notes);
    return { ok: true };
  }

  function clearNotes() { writeNotes([]); }

  function speakingSeat() {
    var G = root.FLGathering;
    if (!G || typeof G.getState !== 'function') return null;
    var st;
    try { st = G.getState(SEAT_KEY); } catch (e) { return null; }
    if (!st || !st.speaking || !st.seats || !st.seats[st.speaking]) return null;
    return { id: st.speaking, seat: st.seats[st.speaking] };
  }

  function chairName(id) {
    var chairs = (root.FLGathering && root.FLGathering.CHAIRS) || [];
    for (var i = 0; i < chairs.length; i++) {
      if (chairs[i].id === id) return chairs[i].type;
    }
    return 'a chair';
  }

  function houseCloudMatches(seat) {
    try {
      if (!seat || seat.kind !== 'cloud') return false;
      var state = root.state;
      if (!state || state.isLocal) return false;
      if (!state.apiKey || String(state.apiKey).length < 6) return false;
      if (String(state.provider || '') !== String(seat.provider || '')) return false;
      if (state.meshInference && state.meshPeerId) return false;
      if (root.BrowserAI && root.BrowserAI.ready) return false;
      var providers = root.PROVIDERS;
      if (!providers || !providers[state.provider]) return false;
      var models = providers[state.provider].models || {};
      var current = models[state.model] || state.model;
      return String(current || '') === String(seat.model || '');
    } catch (e) { return false; }
  }

  function askLocal(seat, history, ask, signal) {
    if (!root.FLGathering || typeof root.FLGathering.isLoopback !== 'function' || !root.FLGathering.isLoopback(seat.base)) {
      return Promise.reject(new Error('loop'));
    }
    var messages = [];
    history.forEach(function (t) {
      messages.push({ role: t.role === 'person' ? 'user' : 'assistant', content: t.text });
    });
    messages.push({ role: 'user', content: ask });
    if (messages.length > MAX_TURNS) messages = messages.slice(-MAX_TURNS);
    return root.fetch(String(seat.base).replace(/\/+$/, '') + '/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: seat.model, messages: messages, stream: false, options: { num_predict: 24 } }),
      signal: signal
    }).then(function (r) {
      if (!r || !r.ok) throw new Error('quiet');
      return r.json();
    }).then(function (data) {
      var text = data && data.message && data.message.content;
      if (!text || !String(text).trim()) throw new Error('quiet');
      return String(text).trim();
    });
  }

  function askCloud(ask, signal) {
    return new Promise(function (resolve, reject) {
      var call = root.FreeLattice && root.FreeLattice.callAI;
      if (typeof call !== 'function') { reject(new Error('quiet')); return; }
      var settled = false;
      function finish(err, text) {
        if (settled) return;
        settled = true;
        if (err) reject(err);
        else resolve(text);
      }
      if (signal) {
        if (signal.aborted) { finish(new Error('paused')); return; }
        signal.addEventListener('abort', function () { finish(new Error('paused')); });
      }
      try {
        call('Answer in a few plain sentences. Stay with this ask.', ask, {
          maxTokens: 400,
          temperature: 0.4,
          silent: true,
          _routed: true,
          signal: signal,
          callback: function (text) {
            if (!text || !String(text).trim()) finish(new Error('quiet'));
            else finish(null, String(text).trim());
          }
        });
      } catch (e) { finish(e); }
    });
  }

  var paintWho = function () {};
  var paintNotes = function () {};
  var paintThread = function () {};

  function mount(host) {
    if (!host || !root.document) return null;
    var d = root.document;
    if (!d.getElementById('fl-gathering-speak-style')) {
      var style = d.createElement('style');
      style.id = 'fl-gathering-speak-style';
      style.textContent = STYLE;
      (d.head || d.documentElement).appendChild(style);
    }
    while (host.firstChild) host.removeChild(host.firstChild);

    var wrap = el('section', 'flgs v-gathering-speak-checker-v0.1');
    wrap.setAttribute('data-marker', VERSION);
    wrap.setAttribute('aria-label', 'Ask the speaking chair');

    var speakCard = el('article', 'flgs-card v-gathering-speak-checker-v0.1');
    speakCard.setAttribute('data-marker', VERSION);
    speakCard.appendChild(el('h2', '', 'Ask the speaking chair'));
    var who = el('p', 'flgs-who');
    who.id = 'flgs-who';
    speakCard.appendChild(who);
    var thread = el('div', 'flgs-thread');
    thread.id = 'flgs-thread';
    thread.setAttribute('aria-live', 'polite');
    speakCard.appendChild(thread);
    var askLabel = el('label', '', 'Your ask');
    var askBox = el('textarea', 'flgs-field');
    askBox.id = 'flgs-ask';
    askBox.rows = 2;
    askBox.setAttribute('maxlength', '500');
    askLabel.appendChild(askBox);
    speakCard.appendChild(askLabel);
    var speakActions = el('div', 'flgs-actions');
    var askBtn = el('button', 'flgs-btn', 'Ask');
    askBtn.type = 'button';
    askBtn.id = 'flgs-ask-btn';
    var pauseBtn = el('button', 'flgs-btn', 'Pause');
    pauseBtn.type = 'button';
    pauseBtn.id = 'flgs-pause-btn';
    speakActions.appendChild(askBtn);
    speakActions.appendChild(pauseBtn);
    speakCard.appendChild(speakActions);
    var receipt = el('p', 'flgs-receipt');
    receipt.id = 'flgs-receipt';
    receipt.setAttribute('aria-live', 'polite');
    speakCard.appendChild(receipt);
    wrap.appendChild(speakCard);

    var checkCard = el('article', 'flgs-card v-gathering-speak-checker-v0.1');
    checkCard.setAttribute('data-marker', VERSION);
    checkCard.appendChild(el('h2', '', 'Checker. How we check each other'));
    checkCard.appendChild(el('p', '', 'A short note the circle can keep. Words only. Never a key. The Checker chair above can hold a mind. These notes remember the agreement.'));
    var noteLabel = el('label', '', 'A note');
    var noteBox = el('textarea', 'flgs-field');
    noteBox.id = 'flgs-note';
    noteBox.rows = 2;
    noteBox.setAttribute('maxlength', '240');
    noteLabel.appendChild(noteBox);
    checkCard.appendChild(noteLabel);
    var noteActions = el('div', 'flgs-actions');
    var addBtn = el('button', 'flgs-btn', 'Add note');
    addBtn.type = 'button';
    addBtn.id = 'flgs-add-note';
    var clearBtn = el('button', 'flgs-btn', 'Clear notes');
    clearBtn.type = 'button';
    clearBtn.id = 'flgs-clear-notes';
    noteActions.appendChild(addBtn);
    noteActions.appendChild(clearBtn);
    checkCard.appendChild(noteActions);
    var noteMsg = el('p', 'flgs-receipt');
    noteMsg.id = 'flgs-note-msg';
    checkCard.appendChild(noteMsg);
    var noteList = el('ul', 'flgs-notes');
    noteList.id = 'flgs-notes';
    checkCard.appendChild(noteList);
    wrap.appendChild(checkCard);
    host.appendChild(wrap);

    var turnId = 0;
    var inflight = null;

    paintWho = function () {
      var held = speakingSeat();
      if (!held) {
        who.textContent = 'No chair is speaking yet. Seat a mind, then let that chair speak first. Find local minds is above. More, then Connect, can help.';
        return;
      }
      who.textContent = held.seat.label + ' speaks first, in ' + chairName(held.id) + '.';
    };

    paintThread = function () {
      while (thread.firstChild) thread.removeChild(thread.firstChild);
      readThread().forEach(function (t) {
        var name = t.role === 'person' ? 'You' : (t.label || 'Chair');
        thread.appendChild(el('p', 'flgs-turn', name + ': ' + t.text));
      });
    };

    paintNotes = function () {
      while (noteList.firstChild) noteList.removeChild(noteList.firstChild);
      readNotes().forEach(function (n) {
        noteList.appendChild(el('li', '', n.text));
      });
    };

    function onAsk() {
      var ask = String(askBox.value || '').trim();
      if (!ask) { receipt.textContent = 'Write a short ask first.'; return; }
      if (looksLikeSecret(ask)) { receipt.textContent = 'An ask keeps words, never a key.'; return; }
      var held = speakingSeat();
      if (!held) {
        receipt.textContent = 'No chair is speaking yet. Seat a mind, then let that chair speak first. Find local minds is above. More, then Connect, can help.';
        return;
      }
      var seat = held.seat;
      if (seat.kind === 'local' && (!root.FLGathering || !root.FLGathering.isLoopback(seat.base))) {
        receipt.textContent = 'This chair has no mind on this computer. Find local minds is above. More, then Connect, can help.';
        return;
      }
      if (seat.kind === 'cloud' && !houseCloudMatches(seat)) {
        receipt.textContent = 'This cloud chair is not the saved key on this page. Nothing was sent. More, then Connect, can help.';
        return;
      }
      if (seat.kind !== 'local' && seat.kind !== 'cloud') {
        receipt.textContent = 'The speaking chair did not answer. Nothing was invented. Find local minds is above. More, then Connect, can help.';
        return;
      }
      var mine = ++turnId;
      var ctl = (typeof root.AbortController !== 'undefined') ? new root.AbortController() : null;
      inflight = ctl;
      askBtn.disabled = true;
      receipt.textContent = 'Listening...';
      var job = seat.kind === 'local'
        ? askLocal(seat, readThread(), ask.slice(0, 500), ctl && ctl.signal)
        : askCloud(ask.slice(0, 500), ctl && ctl.signal);
      job.then(function (text) {
        if (mine !== turnId) return;
        var turns = readThread();
        turns.push({ role: 'person', text: ask.slice(0, 500), label: 'You', chair: held.id });
        turns.push({ role: 'chair', text: String(text).slice(0, 2000), label: seat.label, chair: held.id });
        writeThread(turns);
        askBox.value = '';
        paintThread();
        receipt.textContent = 'A turn was kept.';
      }, function () {
        if (mine !== turnId) return;
        receipt.textContent = 'The speaking chair did not answer. Nothing was invented. Find local minds is above. More, then Connect, can help.';
      }).then(function () {
        if (mine !== turnId) return;
        inflight = null;
        askBtn.disabled = false;
      });
    }

    function onPause() {
      turnId += 1;
      if (inflight && typeof inflight.abort === 'function') {
        try { inflight.abort(); } catch (e) {}
      }
      inflight = null;
      askBtn.disabled = false;
      receipt.textContent = 'Paused. No answer was invented.';
    }

    askBtn.addEventListener('click', onAsk);
    pauseBtn.addEventListener('click', onPause);
    addBtn.addEventListener('click', function () {
      var result = addNote(noteBox.value);
      if (!result.ok && result.reason === 'key') {
        noteMsg.textContent = 'A note keeps words, never a key.';
        return;
      }
      if (!result.ok) {
        noteMsg.textContent = 'Write a short note first.';
        return;
      }
      noteBox.value = '';
      noteMsg.textContent = 'A note was kept.';
      paintNotes();
    });
    clearBtn.addEventListener('click', function () {
      clearNotes();
      paintNotes();
      noteMsg.textContent = 'Notes cleared.';
    });

    var gather = d.getElementById('fl-gathering-mount');
    if (gather && !gather.getAttribute('data-speak-watch')) {
      gather.setAttribute('data-speak-watch', VERSION);
      gather.addEventListener('click', function () { paintWho(); });
    }

    paintWho();
    paintThread();
    paintNotes();
    return wrap;
  }

  function boot() {
    if (!root.document) return;
    var host = root.document.getElementById('fl-gathering-speak-mount');
    if (host) mount(host);
  }

  if (root.document) {
    if (root.document.readyState === 'complete') boot();
    else root.document.addEventListener('DOMContentLoaded', boot);
  }

  root.FLGatheringSpeak = {
    VERSION: VERSION,
    THREAD_KEY: THREAD_KEY,
    CHECK_KEY: CHECK_KEY,
    mount: mount,
    refresh: function () { paintWho(); paintThread(); paintNotes(); },
    readThread: readThread,
    readNotes: readNotes,
    addNote: addNote,
    clearNotes: clearNotes,
    looksLikeSecret: looksLikeSecret,
    houseCloudMatches: houseCloudMatches
  };
})(typeof window !== 'undefined' ? window : this);
