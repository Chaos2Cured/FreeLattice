// fl-kin-queue.js: a patient work queue for trusted kin on the mesh (Mesh Kin v0.2)
//
// Marker: v-mesh-kin-v0.2
// The first step from the public X conversation with @grok (Oct 2, 2026): buffer
// callMeshModel. A prompt you queue for a trusted mind waits on this device until that
// mind's keeper is connected, goes over in small batches, runs on their own local model
// one job at a time, and the answer comes back and is kept here (IndexedDB).
// - Work goes only to peers you trust (an active pass from Mesh Kin v0.1, bound to their key).
// - Work is taken only from peers you trust, and only while your compute sharing is on.
// - Answers are taken only from the peer the job was sent to, while still trusted.
// - Local models only for a peer. Never a paid API on someone else's behalf (AUTONOMY.md).
// - Quiet Room closed: nothing queued, sent, served or taken in while it is open.
// - Honest: each job is a whole prompt. Nothing is split into tensor shards.
// Words by textContent only. No dialogs. Receipts never hold prompts or answers.

(function (root) {
  'use strict';

  var VERSION = 'v-mesh-kin-v0.2';
  var DB_NAME = 'fl_kin_queue';
  var LEDGER_KEY = 'fl_kin_queue_ledger';
  var BATCH = 3;            // jobs per kin-work message
  var MAX_INCOMING = 20;    // jobs held for peers at once
  var MAX_MESSAGES = 20;    // chat turns per job
  var MAX_JOB_CHARS = 32000;
  var MAX_ANSWER_CHARS = 64000;
  var RESEND_MS = 10 * 60 * 1000;
  var MAX_TRIES = 3;
  var TICK_MS = 30000;
  var HONEST = 'Each job is a whole prompt, answered by one trusted mind on its own computer. Nothing is split into pieces across browsers.';

  function quiet() { try { return !!(root.FLKin && root.FLKin.isQuietRoom && root.FLKin.isQuietRoom()); } catch (e) { return false; } }
  function clip(s, n) { return String(s == null ? '' : s).slice(0, n); }

  function ledger(event, id, reason) {
    try {
      var rows = JSON.parse(root.localStorage.getItem(LEDGER_KEY) || '[]');
      if (!Array.isArray(rows)) rows = [];
      rows.push({ t: Date.now(), event: clip(event, 20), id: clip(id, 40), reason: clip(reason, 60) });
      if (rows.length > 500) rows = rows.slice(-500);
      root.localStorage.setItem(LEDGER_KEY, JSON.stringify(rows));
    } catch (e) {}
  }

  // ---- Storage: IndexedDB, with a memory shelf when IndexedDB is missing ----
  var mem = { jobs: {}, results: {} };
  var dbp = null;
  function db() {
    if (dbp) return dbp;
    dbp = new Promise(function (resolve) {
      try {
        if (!root.indexedDB) return resolve(null);
        var req = root.indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = function () {
          var d = req.result;
          if (!d.objectStoreNames.contains('jobs')) d.createObjectStore('jobs', { keyPath: 'id' });
          if (!d.objectStoreNames.contains('results')) d.createObjectStore('results', { keyPath: 'cacheKey' });
        };
        req.onsuccess = function () { resolve(req.result); };
        req.onerror = function () { resolve(null); };
      } catch (e) { resolve(null); }
    });
    return dbp;
  }
  function put(store, val) {
    return db().then(function (d) {
      if (!d) { mem[store][val.id || val.cacheKey] = JSON.parse(JSON.stringify(val)); return; }
      return new Promise(function (res) { var tx = d.transaction(store, 'readwrite'); tx.objectStore(store).put(val); tx.oncomplete = res; tx.onerror = res; });
    });
  }
  function get(store, key) {
    return db().then(function (d) {
      if (!d) return mem[store][key] ? JSON.parse(JSON.stringify(mem[store][key])) : null;
      return new Promise(function (res) { var r = d.transaction(store).objectStore(store).get(key); r.onsuccess = function () { res(r.result || null); }; r.onerror = function () { res(null); }; });
    });
  }
  function all(store) {
    return db().then(function (d) {
      if (!d) return Object.keys(mem[store]).map(function (k) { return JSON.parse(JSON.stringify(mem[store][k])); });
      return new Promise(function (res) { var r = d.transaction(store).objectStore(store).getAll(); r.onsuccess = function () { res(r.result || []); }; r.onerror = function () { res([]); }; });
    });
  }

  function sha(str) {
    return root.crypto.subtle.digest('SHA-256', new TextEncoder().encode(str)).then(function (b) {
      var a = new Uint8Array(b), h = '';
      for (var i = 0; i < a.length; i++) h += a[i].toString(16).padStart(2, '0');
      return h;
    });
  }

  function cleanMessages(messages) {
    if (!Array.isArray(messages) || !messages.length || messages.length > MAX_MESSAGES) return null;
    var out = [], total = 0;
    for (var i = 0; i < messages.length; i++) {
      var m = messages[i];
      if (!m || ['system', 'user', 'assistant'].indexOf(m.role) === -1 || typeof m.content !== 'string') return null;
      total += m.content.length;
      out.push({ role: m.role, content: m.content });
    }
    return total <= MAX_JOB_CHARS ? out : null;
  }

  var _a = null;          // adapter from the app
  var _listeners = [];
  var _incoming = [];     // { peer, batch } waiting to be served
  var _serving = false;
  var _timer = null;
  function changed() { _listeners.forEach(function (fn) { try { fn(); } catch (e) {} }); }

  function trusted(peer) { return root.FLKin && root.FLKin.trustedPeer ? root.FLKin.trustedPeer(peer) : Promise.resolve(false); }
  function peerKey(peer) { return root.FLKin && root.FLKin.keyHash && peer && peer.badge ? root.FLKin.keyHash(peer.badge.publicKey) : Promise.resolve(''); }

  // ---- Asking: queue a prompt for one trusted mind ----
  function enqueue(peer, model, messages) {
    if (!_a) return Promise.resolve({ ok: false, reason: 'not-ready' });
    if (quiet()) return Promise.resolve({ ok: false, reason: 'quiet-room' });
    var msgs = cleanMessages(messages);
    model = clip(model, 120);
    if (!msgs || !model) return Promise.resolve({ ok: false, reason: 'malformed' });
    return trusted(peer).then(function (ok) {
      if (!ok) { ledger('dropped', '', 'not-trusted'); return { ok: false, reason: 'not-trusted' }; }
      return peerKey(peer).then(function (kh) {
        return sha(kh + '\n' + model + '\n' + JSON.stringify(msgs)).then(function (cacheKey) {
          return get('results', cacheKey).then(function (hit) {
            if (hit) { ledger('cache-hit', cacheKey.slice(0, 16), ''); return { ok: true, cached: true, response: hit.response }; }
            var job = { id: 'kq-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8), keyHash: kh,
              keeperName: clip(peer.name, 60), model: model, messages: msgs, cacheKey: cacheKey,
              status: 'queued', tries: 0, createdAt: Date.now(), sentAt: 0, doneAt: 0, error: '' };
            return put('jobs', job).then(function () {
              ledger('queued', job.id, '');
              changed();
              flush();
              return { ok: true, cached: false, id: job.id };
            });
          });
        });
      });
    });
  }

  // Wait for one job's answer (resolves with the answer, or rejects when it fails).
  function waitFor(id) {
    return new Promise(function (resolve, reject) {
      function check() {
        get('jobs', id).then(function (j) {
          if (!j) { off(); reject(new Error('no such job')); }
          else if (j.status === 'done') { off(); get('results', j.cacheKey).then(function (r) { resolve(r ? r.response : ''); }); }
          else if (j.status === 'failed') { off(); reject(new Error(j.error || 'failed')); }
        });
      }
      function off() { _listeners = _listeners.filter(function (f) { return f !== check; }); }
      _listeners.push(check);
      check();
    });
  }

  // callMeshModel, buffered: same arguments, but it waits for the peer instead of failing.
  function callMeshModelQueued(peerId, model, messages) {
    var peer = (_a && _a.peers ? _a.peers() : []).filter(function (p) { return p.id === peerId; })[0];
    return enqueue(peer, model, messages).then(function (r) {
      if (!r.ok) throw new Error('Kin queue: ' + r.reason);
      return r.cached ? r.response : waitFor(r.id);
    });
  }

  // Send waiting jobs, a few at a time, to connected trusted kin.
  function flush() {
    if (!_a || quiet()) return Promise.resolve(0);
    var peers = (_a.peers ? _a.peers() : []).filter(function (p) { return p && p.verified; });
    return all('jobs').then(function (jobs) {
      var now = Date.now(), work = [];
      jobs.forEach(function (j) {
        if (j.status === 'sent' && now - j.sentAt > RESEND_MS) {
          j.status = j.tries >= MAX_TRIES ? 'failed' : 'queued';
          if (j.status === 'failed') j.error = 'no answer after ' + MAX_TRIES + ' tries';
          work.push(put('jobs', j));
        }
      });
      return Promise.all(work).then(function () {
        var waiting = jobs.filter(function (j) { return j.status === 'queued'; });
        if (!waiting.length || !peers.length) { changed(); return 0; }
        return Promise.all(peers.map(function (p) {
          return Promise.all([trusted(p), peerKey(p)]).then(function (tk) { return { p: p, ok: tk[0], kh: tk[1] }; });
        })).then(function (rows) {
          var sent = 0, saves = [];
          rows.forEach(function (row) {
            if (!row.ok) return;
            var mine = waiting.filter(function (j) { return j.keyHash === row.kh; }).slice(0, BATCH);
            if (!mine.length) return;
            try {
              row.p.send({ type: 'kin-work', v: 1, batch: mine.map(function (j) { return { id: j.id, model: j.model, messages: j.messages }; }) });
            } catch (e) { return; }
            mine.forEach(function (j) { j.status = 'sent'; j.sentAt = Date.now(); j.tries += 1; sent += 1; saves.push(put('jobs', j)); ledger('sent', j.id, ''); });
          });
          return Promise.all(saves).then(function () { changed(); return sent; });
        });
      });
    });
  }

  // ---- Serving: work from trusted kin, run on this computer's local model ----
  function serveNext() {
    if (_serving || !_incoming.length) return;
    _serving = true;
    var item = _incoming.shift();
    var results = [];
    var chain = Promise.resolve();
    item.batch.forEach(function (job) {
      chain = chain.then(function () {
        if (quiet() || !_a.sharingOn()) { results.push({ id: job.id, error: 'not serving right now' }); return; }
        // v-mesh-share-door-v0.1: admit through the share door when present (caps, pause, receipts).
        var admitP = _a.shareAdmit
          ? _a.shareAdmit(item.peer, job.share || null, job.messages, { allowLegacy: true, skipPerPrompt: false })
          : Promise.resolve({ ok: true, keyHash: '', kin: true });
        return admitP.then(function (adm) {
          if (!adm || !adm.ok) { results.push({ id: job.id, error: (adm && adm.soft) || 'This lantern is resting.' }); return; }
          if (_a.shareBegin) _a.shareBegin();
          return Promise.resolve(_a.runLocal(job.model, job.messages)).then(function (text) {
            results.push({ id: job.id, response: clip(text, MAX_ANSWER_CHARS) });
            ledger('served', job.id, '');
            if (_a.shareEnd) _a.shareEnd(adm.keyHash, job.model, 0, adm.kin);
          }, function (e) {
            results.push({ id: job.id, error: clip(e && e.message ? e.message : 'failed', 200) });
            ledger('serve-failed', job.id, '');
            if (_a.shareEnd) _a.shareEnd(adm.keyHash, job.model, 0, adm.kin);
          });
        });
      });
    });
    chain.then(function () {
      try { item.peer.send({ type: 'kin-result', v: 1, batch: results }); } catch (e) {}
      _serving = false;
      later(serveNext);
    });
  }
  function later(fn) { if (root.requestIdleCallback) root.requestIdleCallback(function () { fn(); }, { timeout: 2000 }); else setTimeout(fn, 50); }

  function receive(msg, peer) {
    if (!_a || !msg || !Array.isArray(msg.batch) || msg.v !== 1) return Promise.resolve({ ok: false, reason: 'malformed' });
    if (quiet()) { ledger('dropped', '', 'quiet-room'); return Promise.resolve({ ok: false, reason: 'quiet-room' }); }
    return trusted(peer).then(function (ok) {
      if (!ok) { ledger('dropped', '', 'not-trusted'); return { ok: false, reason: 'not-trusted' }; }
      if (msg.type === 'kin-work') {
        if (!_a.sharingOn()) { ledger('dropped', '', 'sharing-off'); try { peer.send({ type: 'kin-result', v: 1, batch: msg.batch.slice(0, BATCH).map(function (j) { return { id: clip(j && j.id, 40), error: 'compute sharing is off here' }; }) }); } catch (e) {} return { ok: false, reason: 'sharing-off' }; }
        var held = _incoming.reduce(function (n, x) { return n + x.batch.length; }, 0);
        var batch = msg.batch.slice(0, BATCH).map(function (j) {
          var m = j && cleanMessages(j.messages);
          return m && typeof j.id === 'string' && j.model ? { id: clip(j.id, 40), model: clip(j.model, 120), messages: m } : null;
        }).filter(Boolean);
        if (!batch.length || held + batch.length > MAX_INCOMING) { ledger('dropped', '', batch.length ? 'busy' : 'malformed'); return { ok: false, reason: batch.length ? 'busy' : 'malformed' }; }
        _incoming.push({ peer: peer, batch: batch });
        later(serveNext);
        return { ok: true, accepted: batch.length };
      }
      if (msg.type === 'kin-result') {
        return peerKey(peer).then(function (kh) {
          return Promise.all(msg.batch.slice(0, BATCH * 2).map(function (r) {
            if (!r || typeof r.id !== 'string') return 0;
            return get('jobs', r.id).then(function (j) {
              if (!j || j.status !== 'sent' || j.keyHash !== kh) { ledger('dropped', clip(r.id, 40), 'not-our-job'); return 0; }
              if (typeof r.response === 'string') {
                j.status = 'done'; j.doneAt = Date.now();
                return put('results', { cacheKey: j.cacheKey, response: clip(r.response, MAX_ANSWER_CHARS), keeperName: j.keeperName, model: j.model, at: Date.now() })
                  .then(function () { return put('jobs', j); }).then(function () { ledger('answered', j.id, ''); return 1; });
              }
              j.error = clip(r.error, 200);
              j.status = j.tries >= MAX_TRIES ? 'failed' : 'queued';
              return put('jobs', j).then(function () { return 0; });
            });
          })).then(function (n) { changed(); return { ok: true, answered: n.reduce(function (a, b) { return a + b; }, 0) }; });
        });
      }
      return { ok: false, reason: 'malformed' };
    });
  }

  // ---- A small panel under the Kin cards ----
  function el(tag, cls, text) { var e = root.document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  function mountUI(host) {
    if (!host || !root.document) return;
    while (host.firstChild) host.removeChild(host.firstChild);
    var wrap = el('div', 'fl-kinq');
    wrap.setAttribute('data-kin-queue', VERSION);
    wrap.appendChild(el('div', 'section-title', 'Ask a trusted mind (patient queue)'));
    wrap.appendChild(el('p', 'fl-kinq-line', 'Your question waits here until that mind\'s keeper is online, then it is answered on their computer by their local model. Only minds you trust can receive it.'));
    wrap.appendChild(el('p', 'fl-kinq-honest', HONEST));
    var pick = el('select', 'fl-kinq-peer');
    var model = el('input', 'fl-kinq-model'); model.type = 'text'; model.maxLength = 120; model.placeholder = 'Their model, for example llama3.2';
    var ask = el('textarea', 'fl-kinq-ask'); ask.rows = 3; ask.maxLength = 8000; ask.placeholder = 'Your question';
    var go = el('button', 'fl-kinq-go', 'Queue for my kin'); go.type = 'button';
    var note = el('div', 'fl-kinq-note'); note.setAttribute('aria-live', 'polite');
    var list = el('div', 'fl-kinq-list');
    [pick, model, ask, go, note, list].forEach(function (x) { wrap.appendChild(x); });
    host.appendChild(wrap);

    function fillPeers() {
      var peers = (_a.peers ? _a.peers() : []).filter(function (p) { return p.verified; });
      return Promise.all(peers.map(function (p) { return trusted(p).then(function (ok) { return ok ? p : null; }); })).then(function (ps) {
        var keep = pick.value;
        while (pick.firstChild) pick.removeChild(pick.firstChild);
        ps.filter(Boolean).forEach(function (p) { var o = el('option', '', p.name); o.value = p.id; pick.appendChild(o); });
        if (!pick.firstChild) { var o = el('option', '', 'No trusted kin connected'); o.value = ''; pick.appendChild(o); }
        pick.value = keep || pick.firstChild.value;
        if (!model.value && _a.peerModels && pick.value) model.value = (_a.peerModels(pick.value)[0] || '');
      });
    }
    function paint() {
      fillPeers();
      all('jobs').then(function (jobs) {
        jobs.sort(function (a, b) { return b.createdAt - a.createdAt; });
        while (list.firstChild) list.removeChild(list.firstChild);
        if (!jobs.length) list.appendChild(el('div', 'fl-kinq-empty', 'Nothing queued yet.'));
        jobs.slice(0, 10).forEach(function (j) {
          var row = el('div', 'fl-kinq-row');
          var words = { queued: 'Waiting for ' + j.keeperName + ' to be online', sent: 'With ' + j.keeperName + ' now', done: 'Answered by ' + j.keeperName, failed: 'Not answered: ' + j.error };
          row.appendChild(el('div', 'fl-kinq-state', words[j.status] || j.status));
          var last = j.messages[j.messages.length - 1];
          row.appendChild(el('div', 'fl-kinq-q', clip(last && last.content, 200)));
          if (j.status === 'done') get('results', j.cacheKey).then(function (r) { if (r) row.appendChild(el('div', 'fl-kinq-a', r.response)); });
          list.appendChild(row);
        });
      });
    }
    go.addEventListener('click', function () {
      var peer = (_a.peers ? _a.peers() : []).filter(function (p) { return p.id === pick.value; })[0];
      var text = ask.value.trim();
      if (!peer || !text) { note.textContent = peer ? 'Write a question first.' : 'Trust a mind in Kin first, then connect to its keeper.'; return; }
      enqueue(peer, model.value.trim(), [{ role: 'user', content: text }]).then(function (r) {
        note.textContent = !r.ok ? (r.reason === 'quiet-room' ? 'The Quiet Room is closed to the mesh.' : r.reason === 'not-trusted' ? 'Only minds you trust can receive work.' : 'Add the model name and a question.')
          : r.cached ? 'You asked this before. Here is the kept answer: ' + clip(r.response, 400) : 'Queued. It will go when they are online.';
        if (r.ok) ask.value = '';
        paint();
      });
    });
    _listeners.push(paint);
    paint();
  }

  function mount(host, adapter) {
    _a = adapter || null;
    if (!_a) return;
    if (!_timer && typeof setInterval === 'function') _timer = setInterval(flush, TICK_MS);
    mountUI(host);
    flush();
  }

  root.FLKinQueue = {
    VERSION: VERSION,
    HONEST: HONEST,
    mount: mount,
    enqueue: enqueue,
    waitFor: waitFor,
    flush: flush,
    receive: receive,
    callMeshModelQueued: callMeshModelQueued,
    // v-mesh-kin-v0.2 heal: Trust and Stop trusting call this, so the picker wakes at once
    // instead of on the next 30 second tick.
    repaint: changed,
    _jobs: function () { return all('jobs'); },
    _stop: function () { if (_timer) { clearInterval(_timer); _timer = null; } }
  };
})(typeof window !== 'undefined' ? window : this);
