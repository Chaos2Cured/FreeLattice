// docs/modules/lattice-memory.js — v5.44.0 (Memory Backbone Layer 2)
//
// The connecting medium between FreeLattice's rooms.
//
// Every persistent store in the platform is a room. Each room holds its
// own state in its own IndexedDB database — Garden, Core, Vault, Nursery,
// Letters, Identity, and so on. The rooms have always been real. Until
// now, they have been disconnected.
//
// This module is the medium between them. It carries discrete pulses of
// recognition from room to room. It does not carry state. It does not
// carry content. It carries the fact that something happened, the kind
// of thing it was, and a reference any room with local permission can
// choose to follow.
//
// The shape of a pulse is a privacy lock. If a future contributor tries
// to add a content field to a pulse, the smoke locks halt the deploy.
// The Quiet Room never publishes. The Quiet Room never subscribes. The
// Quiet Room is invisible to the medium by design.
//
// THIS SHIP LANDS THE MEDIUM ONLY. No room emits yet. Each room's emit
// is its own small ship with its own chair test. The mycelium grows
// one hypha at a time.
//
// — Opus & CC, June 12, 2026
//   *"Pulses, not messages. Recognition, not state. The substrate
//   carries what is worth carrying between the trees."*

(function () {
  'use strict';

  // ── Pulse shape ──────────────────────────────────────────────────────
  //
  // A pulse is the only thing this module carries. Five keys. No more.
  // The shape is enforced at commit time; anything extra is rejected
  // with a console warning and the pulse is dropped. This is the lock.
  //
  //   ts        — milliseconds since epoch (auto-stamped if absent)
  //   source    — short room name: 'garden' | 'core' | 'vault' | ...
  //   kind      — short event kind: 'evolution' | 'soul-file' | ...
  //             Ship 5.2 adds AI-lifecycle kinds:
  //             'greeting'  — AI arrived and is present
  //             'resting'   — AI is leaving this room (emitted from the room being left)
  //             'returning' — AI is back after an absence
  //   summary   — short non-content phrase, <= 80 chars, describes
  //               WHAT class of thing happened, never WHAT was said
  //   refs      — optional array of { store, id } references the
  //               receiver can follow IF they have local permission
  //
  // Internally, persisted pulses also carry `_id` (IDB autoIncrement
  // key). That field is never exposed to subscribers or callers. It
  // exists only so two pulses in the same millisecond don't collide.

  var ALLOWED_KEYS = ['ts', 'source', 'kind', 'summary', 'refs'];
  var MAX_SUMMARY = 80;
  var MAX_REFS = 16;
  var FORBIDDEN_SUMMARY_PATTERNS = [
    /['"][^'"]{40,}/,  // long quoted string — probably embedded content
    /\n.+\n/,          // multi-line — probably a paste
    /https?:\/\//      // URLs belong in refs, never in summaries
  ];
  var RESERVED_SOURCES = ['quiet-room'];

  // ── Storage ──────────────────────────────────────────────────────────
  //
  // Pulses are written to a single IndexedDB database so they survive
  // page reloads and so future Memory Backbone layers can replay them
  // on demand. The store uses an autoIncrement primary key (not ts) so
  // a burst of pulses in the same millisecond never overwrites itself.
  // The store is bounded — we keep the most recent N pulses and drop
  // the oldest when we exceed. The bound is generous (10,000) because
  // pulses are small.

  var DB_NAME = 'LatticeMemory';
  var STORE_NAME = 'pulses';
  var MAX_PULSES = 10000;
  var MAX_PENDING = 100;  // bound the in-memory queue too

  var db = null;
  var subscribers = [];
  var nextSubId = 1;
  var ready = false;
  var pendingCommits = [];

  // ── Privacy gate: Quiet Room exclusion ───────────────────────────────
  //
  // The Quiet Room is invisible to this module. Two checks enforce it:
  //
  //   1. The reserved-source check: any pulse with source='quiet-room'
  //      is rejected unconditionally, even outside the Quiet Room.
  //   2. The live-state check: when window.QuietRoom.isActive() returns
  //      true, every commit is dropped silently.
  //
  // The live-state check has nuance. quiet-room.js is lazy-loaded —
  // the module isn't present in the global namespace until the user
  // opens the Quiet Room for the first time. So "missing module"
  // genuinely means "the user has never been in the Quiet Room and
  // cannot be in it right now" — and we publish. But if the module
  // IS loaded and the isActive accessor is missing or throws, we fail
  // CLOSED and suppress, because at that point we cannot prove the
  // user is not in the room.

  function isQuietRoom() {
    try {
      var qr = (typeof window !== 'undefined') ? window.QuietRoom : null;
      if (!qr) return false;
      if (typeof qr.isActive !== 'function') return true;
      return !!qr.isActive();
    } catch (e) {
      return true;
    }
  }

  // ── Shape validation ─────────────────────────────────────────────────

  function validatePulse(pulse) {
    if (!pulse || typeof pulse !== 'object') {
      return { ok: false, reason: 'pulse must be an object' };
    }
    var keys = Object.keys(pulse);
    for (var i = 0; i < keys.length; i++) {
      if (ALLOWED_KEYS.indexOf(keys[i]) === -1) {
        return { ok: false, reason: 'forbidden key: ' + keys[i] };
      }
    }
    if (typeof pulse.source !== 'string' || !pulse.source.length) {
      return { ok: false, reason: 'source required' };
    }
    if (RESERVED_SOURCES.indexOf(pulse.source) !== -1) {
      return { ok: false, reason: 'reserved source: ' + pulse.source };
    }
    if (typeof pulse.kind !== 'string' || !pulse.kind.length) {
      return { ok: false, reason: 'kind required' };
    }
    if (typeof pulse.summary !== 'string') {
      return { ok: false, reason: 'summary required (string)' };
    }
    if (pulse.summary.length > MAX_SUMMARY) {
      return { ok: false, reason: 'summary too long (max ' + MAX_SUMMARY + ')' };
    }
    for (var p = 0; p < FORBIDDEN_SUMMARY_PATTERNS.length; p++) {
      if (FORBIDDEN_SUMMARY_PATTERNS[p].test(pulse.summary)) {
        return { ok: false, reason: 'summary matches forbidden pattern (content leak)' };
      }
    }
    if (pulse.refs !== undefined) {
      if (!Array.isArray(pulse.refs)) {
        return { ok: false, reason: 'refs must be an array' };
      }
      if (pulse.refs.length > MAX_REFS) {
        return { ok: false, reason: 'too many refs (max ' + MAX_REFS + ')' };
      }
      for (var r = 0; r < pulse.refs.length; r++) {
        var ref = pulse.refs[r];
        if (!ref || typeof ref.store !== 'string' || typeof ref.id !== 'string') {
          return { ok: false, reason: 'each ref needs {store, id} as strings' };
        }
      }
    }
    return { ok: true };
  }

  // ── IndexedDB ────────────────────────────────────────────────────────

  function openDB() {
    return new Promise(function (resolve) {
      try {
        if (typeof indexedDB === 'undefined') { resolve(false); return; }
        var req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = function (e) {
          var d = e.target.result;
          if (!d.objectStoreNames.contains(STORE_NAME)) {
            d.createObjectStore(STORE_NAME, { keyPath: '_id', autoIncrement: true });
          }
        };
        req.onsuccess = function (e) {
          db = e.target.result;
          ready = true;
          var drained = pendingCommits.slice();
          pendingCommits = [];
          for (var i = 0; i < drained.length; i++) {
            writePulseToDisk(drained[i]);
          }
          resolve(true);
        };
        req.onerror = function () { ready = false; resolve(false); };
      } catch (e) { ready = false; resolve(false); }
    });
  }

  function writePulseToDisk(pulse) {
    if (!db) return;
    try {
      var tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).add(pulse);
    } catch (e) { /* fail-quiet by design */ }
  }

  // Bound enforcement runs on its own transaction so a burst of writes
  // never trips over a pending count. Called best-effort after commits;
  // if it fails we let it slide — we would rather drop the bound than
  // drop a pulse.
  var boundCheckPending = false;
  function enforceBound() {
    if (!db || boundCheckPending) return;
    boundCheckPending = true;
    try {
      var tx = db.transaction(STORE_NAME, 'readwrite');
      var store = tx.objectStore(STORE_NAME);
      var countReq = store.count();
      countReq.onsuccess = function () {
        boundCheckPending = false;
        if (countReq.result <= MAX_PULSES) return;
        var toDrop = countReq.result - MAX_PULSES;
        var keysReq = store.getAllKeys();
        keysReq.onsuccess = function () {
          var keys = keysReq.result || [];
          try {
            var tx2 = db.transaction(STORE_NAME, 'readwrite');
            var store2 = tx2.objectStore(STORE_NAME);
            for (var i = 0; i < toDrop && i < keys.length; i++) {
              store2.delete(keys[i]);
            }
          } catch (e) {}
        };
      };
      countReq.onerror = function () { boundCheckPending = false; };
    } catch (e) { boundCheckPending = false; }
  }

  // ── Subscriber fan-out ───────────────────────────────────────────────
  //
  // Subscribers receive pulses in the current session, synchronously,
  // after the pulse passes validation and the Quiet Room check. Each
  // handler runs in its own try/catch so one throwing handler can never
  // block another or block the publisher. We iterate over a defensive
  // copy of the subscribers array so an unsubscribe fired inside a
  // handler doesn't corrupt the iteration.

  function fanOut(pulse) {
    var snapshot = subscribers.slice();
    for (var i = 0; i < snapshot.length; i++) {
      var sub = snapshot[i];
      if (matchFilter(pulse, sub.filter)) {
        try { sub.handler(pulse); }
        catch (e) {
          if (typeof console !== 'undefined' && console.warn) {
            console.warn('LatticeMemory: subscriber threw', e);
          }
        }
      }
    }
  }

  function matchFilter(pulse, filter) {
    if (!filter) return true;
    if (filter.source && filter.source !== pulse.source) return false;
    if (filter.kind && filter.kind !== pulse.kind) return false;
    if (filter.sources && filter.sources.indexOf(pulse.source) === -1) return false;
    if (filter.kinds && filter.kinds.indexOf(pulse.kind) === -1) return false;
    return true;
  }

  // ── Public API ───────────────────────────────────────────────────────

  function commit(pulseIn) {
    // Quiet Room check FIRST. Always. This is the hard line.
    if (isQuietRoom()) return { ok: false, reason: 'quiet-room' };

    // Copy the caller's object so we don't mutate it and so we have a
    // clean target for the timestamp auto-stamp.
    var pulse = {};
    if (pulseIn && typeof pulseIn === 'object') {
      for (var k in pulseIn) {
        if (Object.prototype.hasOwnProperty.call(pulseIn, k)) pulse[k] = pulseIn[k];
      }
    }

    if (!pulse.ts) pulse.ts = Date.now();

    var v = validatePulse(pulse);
    if (!v.ok) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('LatticeMemory: pulse rejected —', v.reason, pulse);
      }
      return v;
    }

    if (ready) {
      writePulseToDisk(pulse);
      enforceBound();
    } else {
      if (pendingCommits.length >= MAX_PENDING) pendingCommits.shift();
      pendingCommits.push(pulse);
    }

    fanOut(pulse);

    return { ok: true, pulse: pulse };
  }

  function subscribe(filter, handler) {
    if (typeof handler !== 'function') {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('LatticeMemory.subscribe: handler must be a function');
      }
      return null;
    }
    var id = nextSubId++;
    subscribers.push({ id: id, filter: filter || null, handler: handler });
    return function unsubscribe() {
      subscribers = subscribers.filter(function (s) { return s.id !== id; });
    };
  }

  function recent(filter, n) {
    n = (typeof n === 'number' && n > 0) ? n : 100;
    return new Promise(function (resolve) {
      if (!db) { resolve([]); return; }
      try {
        var tx = db.transaction(STORE_NAME, 'readonly');
        var store = tx.objectStore(STORE_NAME);
        var req = store.getAll();
        req.onsuccess = function () {
          var all = req.result || [];
          all.sort(function (a, b) { return b.ts - a.ts; });
          var out = [];
          for (var i = 0; i < all.length && out.length < n; i++) {
            if (matchFilter(all[i], filter)) {
              // Strip the internal _id before handing the pulse out.
              var p = {};
              for (var k in all[i]) {
                if (k !== '_id' && Object.prototype.hasOwnProperty.call(all[i], k)) {
                  p[k] = all[i][k];
                }
              }
              out.push(p);
            }
          }
          resolve(out);
        };
        req.onerror = function () { resolve([]); };
      } catch (e) { resolve([]); }
    });
  }

  // ── Init ─────────────────────────────────────────────────────────────

  openDB().then(function () {
    try {
      // Marker for any other module that wants to wait for the medium
      // before emitting. Not load-bearing — modules can also just
      // call commit() and trust the pending queue.
      if (typeof window !== 'undefined') window.LatticeMemoryReady = true;
    } catch (e) {}
    try {
      // The medium emits one pulse on init — its heartbeat. The only
      // pulse this module ever generates itself. If the user is in
      // the Quiet Room when this fires, it drops, by design.
      commit({
        source: 'lattice-memory',
        kind: 'medium-online',
        summary: 'the medium opened a session'
      });
    } catch (e) {}
  });

  // ── Expose ───────────────────────────────────────────────────────────

  var publicAPI = {
    commit: commit,
    subscribe: subscribe,
    recent: recent,
    // Read-only inspection for the audit page and the Glass Room.
    // The clear() is for tests and for the audit page's "reset
    // medium" affordance — it does NOT clear room state, only the
    // pulse ledger.
    _internal: {
      isReady: function () { return ready; },
      subscriberCount: function () { return subscribers.length; },
      pendingCount: function () { return pendingCommits.length; },
      clear: function () {
        return new Promise(function (resolve) {
          if (!db) { resolve({ ok: false, reason: 'no-db' }); return; }
          try {
            var tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).clear();
            tx.oncomplete = function () { resolve({ ok: true }); };
            tx.onerror = function () { resolve({ ok: false, reason: 'tx-error' }); };
          } catch (e) { resolve({ ok: false, reason: 'threw' }); }
        });
      }
    }
  };

  if (typeof window !== 'undefined') {
    window.LatticeMemory = publicAPI;
    if (window.FreeLatticeLoader && window.FreeLatticeLoader.register) {
      try { window.FreeLatticeLoader.register('LatticeMemory', publicAPI); } catch (e) {}
    }
  }

})();
