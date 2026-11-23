/* FreeLattice: spores v0.1 (window.FLSpores)
   Marker: v-spores-v0.1
   Like self-healing concrete: a spore sleeps and costs nothing until something cracks.
   Then it wakes only at that spot and puts back a copy whose fingerprint matches.

   What wakes it:
   - a listed page script fails to load (missing file, network error): the browser never ran it;
   - a listed page script fails to parse on line 1 before it finished loading, and the copy this
     page is actually served does not match its fingerprint (a wrong file was served in its place);
   before (Celeste 2026-11-16, c8c6d4d0): - a MutationObserver whose own callback keeps re-triggering it for more than LOOP_MS (a freeze loop).
   - a MutationObserver whose own callback keeps re-triggering it for more than LOOP_MS, or more than
     LOOP_CALLS calls in a row (a freeze loop).
   What it uses to repair:
   - only this site's own copy, checked against spores-manifest.json, whose own sha256 is pinned
     below. First the copy the service worker already holds (read only), then a fresh same-origin copy.
   - a copy runs only when its sha256 matches. A different copy is refused. A healthy file never runs twice.
   What it never does:
   - it never clears, deletes or rewrites storage, caches, minds, chats or the service worker, and it
     never writes into the service-worker cache. The only thing it writes is its own receipt list,
     fl_sporeReceipts (capped: the oldest rows fold into one summary row that keeps their hash),
     and its own off switch.
   Off switch: localStorage fl_spores = "off", or ?spores=off on the address. Then nothing here runs.
*/
(function (root) {
  'use strict';

  var VERSION = 'v-spores-v0.1';
  // The manifest's own fingerprint. scripts/make-spores-manifest.js writes this line; a manifest
  // whose sha256 differs is refused, so a stale or swapped manifest can never pick what runs.
  var MANIFEST_SHA256 = 'f750bdaa338a1a5e04853c95551b2dc2c378d02ba1befe5c62b3a80378ebed19'; // spores-manifest-pin
  var RECEIPT_KEY = 'fl_sporeReceipts';
  var OFF_KEY = 'fl_spores';
  var MANIFEST_URL = 'spores-manifest.json';
  var LOOP_MS = 1500;            // an observer whose own callback keeps re-triggering it this long is a freeze loop
  var REST_MS = [2000, 4000, 8000, 15000];   // pause lengths; the last repeats. Never off for good.
  var HELD_MAX = 5000;           // records kept for an observer while it rests (oldest dropped past this, and counted)
  var LOOP_CALLS = 500;          // or this many self-fed calls in one chain, whichever comes first (only self-fed calls count)
  // before (Celeste 2026-11-16, c8c6d4d0): var limits = { loopMs: LOOP_MS, rest: REST_MS, held: HELD_MAX, cap: 200, fold: 100 };
  var limits = { loopMs: LOOP_MS, loopCalls: LOOP_CALLS, rest: REST_MS, held: HELD_MAX, cap: 200, fold: 100 };
  var HONEST_LINE = 'Spore receipt could not be saved on this device (storage is full or closed). It is kept in memory for this visit.';

  var memReceipts = [];
  var unsaved = 0;
  var manifestPromise = null;
  var tried = {};
  var loaded = {};
  var chain = Promise.resolve();
  var noticeShown = false;
  var noticeText = null;
  var status = { trips: 0, resting: 0, dropped: 0, notice: '' };   // what FLSpores.status() reports

  // ---------- small pure helpers (also used by the smoke in Node) ----------

  function normalizeSrc(src) {
    var s = String(src || '').trim();
    s = s.split('#')[0].split('?')[0];
    while (s.indexOf('./') === 0) s = s.slice(2);
    return s;
  }

  function isThirdParty(src) {
    return /^([a-z][a-z0-9+.-]*:)?\/\//i.test(String(src || '').trim());
  }

  function hex(buf) {
    var b = new Uint8Array(buf), out = '';
    for (var i = 0; i < b.length; i++) out += (b[i] < 16 ? '0' : '') + b[i].toString(16);
    return out;
  }

  function subtle() {
    try { return (root.crypto && root.crypto.subtle) || null; } catch (e) { return null; }
  }

  function sha256Hex(buf) {
    var s = subtle();
    if (!s) return Promise.reject(new Error('no-subtle-crypto'));
    return s.digest('SHA-256', buf).then(hex);
  }

  function now() {
    try { return root.performance.now(); } catch (e) { return Date.now(); }
  }

  function isOff() {
    try {
      var q = String((root.location && root.location.search) || '');
      if (/[?&]spores=off\b/.test(q)) return true;
    } catch (e) {}
    try {
      if (root.localStorage && root.localStorage.getItem(OFF_KEY) === 'off') return true;
    } catch (e) {}
    return false;
  }

  function skipName(file) {
    return /quiet|sophia/i.test(file);
  }

  // ---------- receipts: added to, capped by folding, exportable ----------

  function readReceipts() {
    try {
      var raw = root.localStorage && root.localStorage.getItem(RECEIPT_KEY);
      var rows = raw ? JSON.parse(raw) : [];
      return Array.isArray(rows) ? rows : [];
    } catch (e) { return []; }
  }

  function enc(s) { return new TextEncoder().encode(s); }

  function fold(rows) {
    // Past the cap, the oldest `fold` rows become one summary row. The summary keeps how many there
    // were, their n range, a tally of kinds, and the sha256 of exactly those rows, so nothing is
    // silently rewritten. exportReceipts() before then keeps every row.
    if (rows.length <= limits.cap) return Promise.resolve(rows);
    var old = rows.slice(0, limits.fold);
    var tally = {};
    old.forEach(function (r) { tally[r.kind] = (tally[r.kind] || 0) + (r.kind === 'folded' ? (r.count || 0) : 1); });
    return sha256Hex(enc(JSON.stringify(old))).catch(function () { return ''; }).then(function (h) {
      var first = old[0], last = old[old.length - 1];
      var summary = {
        n: first.n, at: last.at, v: VERSION, page: '', kind: 'folded', file: '', ok: true,
        count: old.reduce(function (a, r) { return a + (r.kind === 'folded' ? (r.count || 0) : 1); }, 0),
        nFrom: first.nFrom || first.n, nTo: last.n, kinds: tally, foldedSha256: h, prev: first.prev || ''
      };
      return [summary].concat(rows.slice(limits.fold));
    });
  }

  function receipt(row) {
    chain = chain.then(function () {
      var saved = readReceipts();
      var all = saved.concat(memReceipts.filter(function (r) { return r._unsaved; }));
      var prev = all.length ? all[all.length - 1] : null;
      var link = prev && typeof TextEncoder !== 'undefined'
        ? sha256Hex(enc(JSON.stringify(prev))).catch(function () { return ''; })
        : Promise.resolve('');
      return link.then(function (prevHash) {
        var clean = {
          n: prev ? (prev.n || 0) + 1 : 1,
          at: new Date().toISOString(),
          v: VERSION,
          page: pageName(),
          kind: String(row.kind || 'note'),
          file: row.file || '',
          ok: !!row.ok,
          from: row.from || '',
          expected: row.expected || '',
          got: row.got || '',
          why: row.why || '',
          ms: typeof row.ms === 'number' ? Math.round(row.ms) : undefined,
          prev: prevHash
        };
        return fold(saved.concat([clean])).then(function (rows) {
          try {
            if (!root.localStorage) throw new Error('no-storage');
            root.localStorage.setItem(RECEIPT_KEY, JSON.stringify(rows));
          } catch (e) {
            clean._unsaved = true;
            unsaved++;
          }
          memReceipts.push(clean);
          if (memReceipts.length > limits.cap) memReceipts.splice(0, memReceipts.length - limits.cap);
          try { root.dispatchEvent(new CustomEvent('fl-spore', { detail: clean })); } catch (e) {}
          return clean;
        });
      });
    }).catch(function () {});
    return chain;
  }

  function exportReceipts() {
    var rows = api.receipts();
    return JSON.stringify({ v: VERSION, exported: new Date().toISOString(), page: pageName(), receipts: rows }, null, 1);
  }

  function pageName() {
    try {
      var p = String(root.location.pathname || '');
      var name = p.slice(p.lastIndexOf('/') + 1);
      return name || 'index.html';
    } catch (e) { return ''; }
  }

  // ---------- the manifest: fetched only after a crack, refused unless its sha256 is the pinned one ----------

  function bust(url, tag) {
    return url + (url.indexOf('?') >= 0 ? '&' : '?') + 'spore=' + encodeURIComponent(tag);
  }

  function getManifest() {
    if (manifestPromise) return manifestPromise;
    var url;
    try { url = new URL(MANIFEST_URL, root.document.baseURI).href; } catch (e) { url = MANIFEST_URL; }
    // No cached-manifest fallback: a stale manifest plus an old cached file could restore an old version.
    manifestPromise = root.fetch(bust(url, MANIFEST_SHA256.slice(0, 12)), { cache: 'no-store', credentials: 'same-origin' })
      .then(function (r) { if (!r.ok) throw new Error('manifest ' + r.status); return r.arrayBuffer(); })
      .then(function (buf) {
        return sha256Hex(buf).then(function (h) {
          if (h !== MANIFEST_SHA256) return { refused: true, got: h };
          var m = JSON.parse(new TextDecoder().decode(buf));
          return (m && m.pages) ? m : null;
        });
      })
      .catch(function () { return null; });
    return manifestPromise;
  }

  function entryFor(m, file) {
    if (!m || !m.pages) return null;
    var page = m.pages[pageName()] || m.pages['app.html'] || null;
    var files = page && page.files;
    return (files && Object.prototype.hasOwnProperty.call(files, file)) ? files[file] : null;
  }

  // ---------- the one notice: reload to finish ----------

  // before (Celeste 2026-11-16, c8c6d4d0): function showReloadNotice() {
  function showReloadNotice(text) {
    // Dependents are not re-run (that would replace their state). A reload runs everything in order.
    // One notice only. A later message replaces the words in the same notice.
    text = text || 'A piece of FreeLattice was repaired. Reload to finish the repair. ';
    status.notice = text;
    if (noticeShown && noticeText) { try { noticeText.textContent = text; } catch (e) {} return; }
    // before (Celeste 2026-11-16, c8c6d4d0): if (noticeShown || !root.document || !root.document.body) return;
    if (noticeShown || !root.document || !root.document.body) return;
    noticeShown = true;
    try {
      var d = root.document.createElement('div');
      d.id = 'fl-spore-notice';
      d.setAttribute('role', 'status');
      d.style.cssText = 'position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:2147483000;' +
        'background:#1b1830;color:#f3eefc;border:1px solid #6d5fd3;border-radius:10px;padding:10px 14px;' +
        'font:14px/1.4 system-ui,sans-serif;box-shadow:0 4px 18px rgba(0,0,0,.4);max-width:92vw';
      var t = root.document.createElement('span');
      // before (Celeste 2026-11-16, c8c6d4d0): t.textContent = 'A piece of FreeLattice was repaired. Reload to finish the repair. ';
      t.textContent = text;
      noticeText = t;
      var go = root.document.createElement('button');
      go.type = 'button'; go.textContent = 'Reload';
      go.style.cssText = 'margin-left:8px;padding:4px 10px;border-radius:6px;border:0;background:#6d5fd3;color:#fff;cursor:pointer';
      go.onclick = function () { try { root.location.reload(); } catch (e) {} };
      var later = root.document.createElement('button');
      later.type = 'button'; later.textContent = 'Not now';
      later.style.cssText = 'margin-left:6px;padding:4px 10px;border-radius:6px;border:1px solid #6d5fd3;background:transparent;color:#f3eefc;cursor:pointer';
      later.onclick = function () { if (d.parentNode) d.parentNode.removeChild(d); };
      d.appendChild(t); d.appendChild(go); d.appendChild(later);
      root.document.body.appendChild(d);
    } catch (e) {}
  }

  // ---------- restore one file from a verified same-origin copy ----------

  function sources(abs, want) {
    // 1) the copy the service worker already holds (read only). 2) a fresh same-origin copy.
    return [
      { from: 'sw-cache', get: function () {
        if (!root.caches || !root.caches.match) return Promise.resolve(null);
        return root.caches.match(abs).then(function (r) { return r ? r.arrayBuffer() : null; });
      } },
      { from: 'same-origin', get: function () {
        return root.fetch(bust(abs, want.slice(0, 12)), { cache: 'no-store', credentials: 'same-origin' })
          .then(function (r) { return r.ok ? r.arrayBuffer() : null; });
      } }
    ];
  }

  function runVerified(buf, file) {
    return new Promise(function (resolve) {
      var url = '';
      try {
        url = URL.createObjectURL(new Blob([buf], { type: 'text/javascript' }));
        var s = root.document.createElement('script');
        s.setAttribute('data-spore', file);
        s.src = url;
        s.onload = function () { try { URL.revokeObjectURL(url); } catch (e) {} resolve(true); };
        s.onerror = function () { try { URL.revokeObjectURL(url); } catch (e) {} resolve(false); };
        (root.document.head || root.document.documentElement).appendChild(s);
      } catch (e) { resolve(false); }
    });
  }

  function servedMatches(abs, want) {
    // The copy this page is actually served (same request the page made: SW and HTTP cache allowed).
    return root.fetch(abs, { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.arrayBuffer() : null; })
      .then(function (buf) { return buf ? sha256Hex(buf) : 'missing'; })
      .then(function (got) { return { ok: got === want, got: got }; })
      .catch(function () { return { ok: false, got: 'unreadable' }; });
  }

  // how: 'load' (the browser never ran it) or 'parse' (line-1 parse failure before its load event)
  function restore(file, how) {
    if (tried[file]) return tried[file];
    if (loaded[file] && how !== 'parse') return Promise.resolve(null);   // it loaded and ran: not ours to run again
    var t0 = Date.now();
    var why = how === 'parse' ? 'failed to parse on line 1 (wrong file served?)' : 'did not load';
    tried[file] = getManifest().then(function (m) {
      if (m && m.refused) return receipt({ kind: 'refused', file: file, ok: false, expected: MANIFEST_SHA256, got: m.got, why: why + '; the manifest did not match its pinned sha256, so nothing was fetched or run' });
      var want = entryFor(m, file);
      want = want && want.sha256;
      if (!want) {
        if (how === 'parse') return null;      // not a listed script: no receipt, no noise
        return receipt({ kind: 'not-in-manifest', file: file, ok: false, why: why + '; no fingerprint for this file (or no manifest), so nothing was fetched' });
      }
      if (!subtle()) return receipt({ kind: 'refused', file: file, ok: false, expected: want, why: why + '; this browser cannot check fingerprints here, so nothing was run' });
      var abs = new URL(file, root.document.baseURI).href;
      var first = how === 'parse' ? servedMatches(abs, want) : Promise.resolve({ ok: false, got: '' });
      return first.then(function (served) {
        if (served.ok) {
          // before (Celeste 2026-11-16, c8c6d4d0): // The served copy is the right one: the file is not cracked. Run nothing.
          // before (Celeste 2026-11-16, c8c6d4d0): return receipt({ kind: 'not-cracked', file: file, ok: true, expected: want, got: served.got, why: why + '; but the copy served matches its fingerprint, so nothing was run', ms: Date.now() - t0 });
          // The copy the server sends now matches, but this page still lacks the file (the copy it ran was
          // wrong, or the listed file itself fails to parse). Run nothing; offer the reload. Not ok.
          showReloadNotice('A piece of FreeLattice did not load right. Reload to finish the repair. ');
          return receipt({ kind: 'reload-needed', file: file, ok: false, expected: want, got: served.got, why: why + '; the copy this page ran was wrong, and the server now sends the right one. Nothing was run here; a reload will load it', ms: Date.now() - t0 });
        }
        var list = sources(abs, want);
        var seen = [];
        function next(i) {
          if (i >= list.length) {
            return receipt({ kind: 'still-broken', file: file, ok: false, expected: want, got: seen.join(','), why: why + '; no copy matched the fingerprint', ms: Date.now() - t0 });
          }
          return list[i].get().catch(function () { return null; }).then(function (buf) {
            if (!buf) { seen.push(list[i].from + ':none'); return next(i + 1); }
            return sha256Hex(buf).then(function (got) {
              if (got !== want) { seen.push(list[i].from + ':' + got.slice(0, 12)); return next(i + 1); }
              return runVerified(buf, file).then(function (ran) {
                if (ran) showReloadNotice();
                return receipt({ kind: ran ? 'restored' : 'still-broken', file: file, ok: ran, from: list[i].from, expected: want, got: got, why: why, ms: Date.now() - t0 });
              });
            });
          });
        }
        return next(0);
      });
    });
    return tried[file];
  }

  // ---------- detection ----------

  function scriptFile(el) {
    if (!el || el.tagName !== 'SCRIPT') return '';
    if (el.hasAttribute('data-spore')) return '';        // a spore's own try; never loop
    var raw = el.getAttribute('src');
    if (!raw || isThirdParty(raw)) return '';
    var file = normalizeSrc(raw);
    return (!file || skipName(file)) ? '' : file;
  }

  function onResourceLoad(ev) {
    var file = scriptFile(ev && ev.target);
    if (file) loaded[file] = true;
  }

  function onResourceError(ev) {
    var el = ev && ev.target;
    if (!el || el.tagName !== 'SCRIPT') return;
    if (el.hasAttribute('onerror')) return;              // it has its own fallback already
    var file = scriptFile(el);
    if (file) restore(file, 'load');
  }

  function hasFrame(stack, err) {
    var lines = String(stack || '').split('\n');
    var head = String(err && err.name || 'SyntaxError') + ':';
    if (lines.length && lines[0].indexOf(head) === 0) lines = lines.slice(1);   // Chrome's message line
    return lines.some(function (l) { return /\S/.test(l); });                  // any frame at all
  }

  function onScriptError(ev) {
    // Only a real parse failure: line 1, a SyntaxError, a listed .js file of this site, before its load
    // event. A JSON.parse error or a SyntaxError thrown at run time is not a crack.
    if (!ev || !ev.filename || ev.lineno !== 1) return;
    // before (Celeste 2026-11-16, c8c6d4d0): var msg = String(ev.message || '');
    // before (Celeste 2026-11-16, c8c6d4d0): if (!/SyntaxError|Unexpected token|Invalid or unexpected/i.test(msg) || /JSON/i.test(msg)) return;
    // before (Celeste 2026-11-16, 1879d36a): // Engine-neutral: the error object must be a SyntaxError, and a parse error raised by a call
    // before (Celeste 2026-11-16, 1879d36a): // (JSON.parse, eval, new Function) has the calling frame on its stack. A real script parse failure
    // before (Celeste 2026-11-16, 1879d36a): // has no calling frame. The message wording is only a fallback when no error object is given.
    // Engine-neutral: the error object must be a SyntaxError with NO calling frame on its stack.
    // Anything thrown by running code (JSON.parse, eval, new Function, or a throw at the top of line 1
    // of a healthy file) has a frame; a file that failed to parse never ran, so it has none.
    // Chrome's stack starts with a "SyntaxError: message" line; Firefox's has only frames. So drop a
    // first line only when it is that message line, never blindly.
    var err = ev.error;
    if (err) {
      if (!(err instanceof SyntaxError)) return;
      var stack = String(err.stack || '');
      // before (Celeste 2026-11-16, 1879d36a): if (/JSON|\bparse\b|eval|Function/.test(stack.split('\n').slice(1).join('\n'))) return;
      // before (Celeste 2026-11-16, 1879d36a): if (/JSON\.parse|JSON/.test(stack)) return;
      if (hasFrame(stack, err)) return;
    } else {
      var msg = String(ev.message || '');
      if (!/SyntaxError|Unexpected token|Invalid or unexpected/i.test(msg) || /JSON/i.test(msg)) return;
    }
    var abs, base;
    try { abs = new URL(ev.filename); base = new URL('.', root.document.baseURI); } catch (e) { return; }
    if (abs.origin !== base.origin || abs.pathname.indexOf(base.pathname) !== 0) return;
    var file = normalizeSrc(abs.pathname.slice(base.pathname.length));
    if (!file || !/\.js$/i.test(file) || skipName(file) || /(^|\/)spores\.js$/i.test(file)) return;
    if (loaded[file]) return;
    restore(file, 'parse');
  }

  // ---------- watchdog: a MutationObserver feeding itself ----------
  // A burst of work (a buffered stream, an await per item) calls observers many times in a row, but
  // those calls are fed by the page, and they end. A freeze loop is an observer whose own callback
  // changes what it watches, so every call queues the next one. The watchdog only times that:
  // before (Celeste 2026-11-16, c8c6d4d0): // right after each call it takes the records the callback itself just made (takeRecords) and hands
  // before (Celeste 2026-11-16, c8c6d4d0): // them back on the next microtask, exactly when the browser would have. If a chain of calls that
  // before (Celeste 2026-11-16, c8c6d4d0): // each fed themselves runs past LOOP_MS with no page turn, the observer rests. Its records are held
  // before (Celeste 2026-11-16, c8c6d4d0): // and handed to it when it listens again. It always listens again, and every rest writes a receipt.
  // To know whether a call fed itself, each observer gets a quiet twin: a plain observer on the same
  // targets with the same options, whose callback does nothing. Right before a call the twin's queue is
  // emptied; right after, anything in it was made by that call on what it watches. The observer's own
  // records are never taken or moved, so the browser delivers them itself, in its own order and batches
  // (Hypha's re-walk: taking them and handing them back a microtask later reordered them).
  // If a chain of calls that each fed themselves runs past LOOP_MS, or past LOOP_CALLS calls, the
  // observer rests. Records the browser delivers while it rests are held and handed to it when it
  // listens again. It always listens again, and every rest writes a receipt. Records dropped while
  // resting also show in FLSpores.status() and in the notice.

  function guardObservers() {
    var Native = root.MutationObserver;
    if (typeof Native !== 'function' || Native.__spores) return;
    // before (Celeste 2026-11-16, c8c6d4d0): var soon = typeof root.queueMicrotask === 'function' ? function (f) { root.queueMicrotask(f); } : function (f) { Promise.resolve().then(f); };
    var nativeObserve = Native.prototype.observe;
    var nativeDisconnect = Native.prototype.disconnect;
    var nativeTake = Native.prototype.takeRecords;
    function quiet() {}

    function Guarded(callback) {
      // before (Celeste 2026-11-16, c8c6d4d0): var state = { feedStart: 0, trips: 0, resting: false, held: [], dropped: 0, timer: 0, where: '' };
      var state = { feedStart: 0, feedCount: 0, trips: 0, resting: false, held: [], dropped: 0, timer: 0, where: '', twin: null };
      try { state.where = String((new Error()).stack || '').split('\n').slice(2, 3).join('').trim().slice(0, 160); } catch (e) {}
      try { state.twin = new Native(quiet); } catch (e) { state.twin = null; }
      var me;
      function hold(records) {
        for (var i = 0; i < records.length; i++) state.held.push(records[i]);
        if (state.held.length > limits.held) { state.dropped += state.held.length - limits.held; state.held.splice(0, state.held.length - limits.held); }
      }
      // before (Celeste 2026-11-16, c8c6d4d0): function rest(records) {
      function rest() {
        var chainMs = state.feedStart ? now() - state.feedStart : 0, chainCalls = state.feedCount;
        state.resting = true;
        state.trips++;
        status.trips++; status.resting++;
        state.feedStart = 0;
        state.feedCount = 0;
        // before (Celeste 2026-11-16, c8c6d4d0): hold(records);
        var ms = limits.rest[Math.min(state.trips - 1, limits.rest.length - 1)];
        // before (Celeste 2026-11-16, c8c6d4d0): receipt({ kind: 'loop-paused', file: state.where, ok: true, got: 'trip ' + state.trips,
        // before (Celeste 2026-11-16, c8c6d4d0):           why: 'its own callback kept re-triggering it for over ' + limits.loopMs + 'ms with no turn for the page; resting ' + ms + 'ms, then it listens again and gets the records held meanwhile' });
        receipt({ kind: 'loop-paused', file: state.where, ok: true, got: 'trip ' + state.trips, ms: chainMs,
                  why: 'its own callback re-triggered it ' + chainCalls + ' times in a row (' + Math.round(chainMs) + 'ms) with no turn for the page; resting ' + ms + 'ms, then it listens again and gets the records held meanwhile' });
        state.timer = setTimeout(wake, ms);
      }
      function wake() {
        state.timer = 0;
        state.resting = false;
        var give = state.held; state.held = [];
        var lost = state.dropped; state.dropped = 0;
        status.resting = Math.max(0, status.resting - 1);
        // before (Celeste 2026-11-16, c8c6d4d0): if (lost) receipt({ kind: 'loop-records-dropped', file: state.where, ok: false, why: lost + ' records past the ' + limits.held + ' held while resting were dropped (oldest first)' });
        if (lost) {
          status.dropped += lost;
          receipt({ kind: 'loop-records-dropped', file: state.where, ok: false, why: lost + ' records past the ' + limits.held + ' held while resting were dropped (oldest first)' });
          showReloadNotice('Part of this page got stuck and skipped ' + lost + ' updates while it rested. Reload to catch up. ');
        }
        // before (Celeste 2026-11-16, c8c6d4d0): if (give.length) run(me, give);
        if (give.length) inner(give);
      }
      function run(ctx, records) {
        // before (Celeste 2026-11-16, c8c6d4d0): var t0 = now(), fed = [];
        var t0 = now(), fed = 0;
        if (state.twin) { try { nativeTake.call(state.twin); } catch (e) {} }     // empty the twin: count only this call
        try { return callback.call(ctx, records, me); }
        finally {
          // before (Celeste 2026-11-16, c8c6d4d0): try { fed = nativeTake.call(me) || []; } catch (e) { fed = []; }
          if (state.twin) { try { fed = (nativeTake.call(state.twin) || []).length; } catch (e) { fed = 0; } }
          // before (Celeste 2026-11-16, c8c6d4d0): if (!fed.length) state.feedStart = 0;                 // it did not feed itself: no chain
          if (!fed) { state.feedStart = 0; state.feedCount = 0; }   // it did not feed itself: no chain
          else {
            if (!state.feedStart) state.feedStart = t0;
            state.feedCount++;
            // before (Celeste 2026-11-16, c8c6d4d0): if (now() - state.feedStart > limits.loopMs) rest(fed);
            // before (Celeste 2026-11-16, c8c6d4d0): else soon(function () { inner(fed); });              // the browser would deliver these next anyway
            // Its own records stay where the browser put them; the browser delivers them next.
            if (now() - state.feedStart > limits.loopMs || state.feedCount > limits.loopCalls) rest();
          }
        }
      }
      var inner = function (records) {
        if (state.resting) { hold(records); return undefined; }
        return run(me, records);
      };
      me = Reflect.construct(Native, [inner], new.target || Guarded);
      me.__sporeState = state;
      return me;
    }
    Guarded.prototype = Object.create(Native.prototype);
    Guarded.prototype.constructor = Guarded;
    Guarded.prototype.observe = function (target, options) {
      var r = nativeObserve.call(this, target, options);            // throws exactly as the browser would
      var s = this.__sporeState;
      if (s && s.twin) { try { nativeObserve.call(s.twin, target, options); } catch (e) {} }   // the twin watches the same; no list is kept
      return r;
    };
    Guarded.prototype.disconnect = function () {
      var s = this.__sporeState;
      // before (Celeste 2026-11-16, c8c6d4d0): if (s) { if (s.timer) clearTimeout(s.timer); s.timer = 0; s.resting = false; s.held = []; s.dropped = 0; }
      if (s) { if (s.timer) { clearTimeout(s.timer); status.resting = Math.max(0, status.resting - 1); } s.timer = 0; s.resting = false; s.held = []; s.dropped = 0; }
      if (s && s.twin) { try { nativeDisconnect.call(s.twin); } catch (e) {} }
      return nativeDisconnect.call(this);
    };
    Guarded.prototype.takeRecords = function () {
      var s = this.__sporeState;
      var held = s ? s.held : [];
      if (s) s.held = [];
      // Records the caller swallows here are never delivered, so the twin must forget them too;
      // otherwise the next call looks self-fed (Hypha's walk of 1879d36a).
      if (s && s.twin) { try { nativeTake.call(s.twin); } catch (e) {} }
      return held.concat(nativeTake.call(this));
    };
    // instanceof MutationObserver stays true for observers made before spores loaded (native ones).
    // A subclass keeps the ordinary instanceof rule.
    try {
      Object.defineProperty(Guarded, Symbol.hasInstance, { configurable: true, value: function (o) {
        if (this !== Guarded) return Function.prototype[Symbol.hasInstance].call(this, o);
        return o instanceof Native;
      } });
    } catch (e) {}
    Guarded.__spores = true;
    Guarded.Native = Native;
    root.MutationObserver = Guarded;
  }

  // ---------- optional: check served copies against the manifest (reports only) ----------

  function check() {
    return getManifest().then(function (m) {
      var page = m && m.pages && (m.pages[pageName()] || m.pages['app.html']);
      if (!page) return { ok: false, why: m && m.refused ? 'manifest refused' : 'no manifest' };
      var files = Object.keys(page.files);
      var bad = [];
      return files.reduce(function (p, f) {
        return p.then(function () {
          return servedMatches(new URL(f, root.document.baseURI).href, page.files[f].sha256).then(function (s) {
            if (!s.ok) {
              bad.push(f);
              return receipt({ kind: 'stale', file: f, ok: false, expected: page.files[f].sha256, got: s.got, why: 'the copy this page is served does not match; reported only, nothing replaced' });
            }
          });
        });
      }, Promise.resolve()).then(function () { return { ok: bad.length === 0, checked: files.length, bad: bad }; });
    });
  }

  var api = {
    version: VERSION,
    off: false,
    manifestSha256: MANIFEST_SHA256,
    receipts: function () { return readReceipts().concat(memReceipts.filter(function (r) { return r._unsaved; })); },
    exportReceipts: exportReceipts,
    unsaved: function () { return unsaved ? HONEST_LINE : ''; },
    status: function () { return { trips: status.trips, resting: status.resting, dropped: status.dropped, notice: status.notice }; },
    check: check,
    restore: restore,
    setOff: function (yes) { try { root.localStorage.setItem(OFF_KEY, yes ? 'off' : 'on'); } catch (e) {} return !!yes; },
    _normalizeSrc: normalizeSrc,
    _isThirdParty: isThirdParty,
    _receipt: receipt,
    _limits: limits
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (!root || !root.document) return;

  if (isOff()) { api.off = true; root.FLSpores = api; return; }
  // A script's load event reaches the document but never the window, so listen on the document.
  try { root.document.addEventListener('load', onResourceLoad, true); } catch (e) {}
  try { root.addEventListener('error', onResourceError, true); } catch (e) {}
  try { root.addEventListener('error', onScriptError, false); } catch (e) {}
  try { guardObservers(); } catch (e) {}
  root.FLSpores = api;
})(typeof window !== 'undefined' ? window : this);
