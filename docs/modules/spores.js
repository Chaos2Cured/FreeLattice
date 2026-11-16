/* FreeLattice: spores v0.1 (window.FLSpores)
   Marker: v-spores-v0.1
   Like self-healing concrete: a spore sleeps and costs nothing until something cracks.
   Then it wakes only at that spot and puts back a copy whose fingerprint matches.

   What wakes it:
   - a page script fails to load (missing file, network error), or throws a SyntaxError on line 1
     (a wrong file was served in its place);
   - a MutationObserver calls itself over and over without the page ever getting a turn (a freeze loop).
   What it uses to repair:
   - only this site's own copy: first the copy the service worker already holds (read only),
     then a fresh copy from the same origin. Never a third party.
   - a copy is used only when its sha256 matches spores-manifest.json. A different copy is refused.
   What it never does:
   - it never clears, deletes or rewrites storage, caches, minds, chats or the service worker.
     The only thing it writes is its own receipt list, fl_sporeReceipts, and that list is append-only.
   Off switch: localStorage fl_spores = "off", or ?spores=off on the address. Then nothing here runs.
*/
(function (root) {
  'use strict';

  var VERSION = 'v-spores-v0.1';
  var RECEIPT_KEY = 'fl_sporeReceipts';
  var OFF_KEY = 'fl_spores';
  var MANIFEST_URL = 'spores-manifest.json';
  var LOOP_LIMIT = 500;      // callbacks in a row with no turn for the page = a loop, not work
  var LOOP_REST_MS = 2000;   // pause, then listen again
  var LOOP_MAX_TRIPS = 3;    // after this many, stay paused and say so
  var HONEST_LINE = 'Spore receipt could not be saved on this device (storage is full or closed). It is kept in memory for this visit.';

  var memReceipts = [];
  var unsaved = 0;
  var manifestPromise = null;
  var tried = {};
  var lastLink = '';
  var chain = Promise.resolve();

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

  // ---------- receipts: append-only ----------

  function readReceipts() {
    try {
      var raw = root.localStorage && root.localStorage.getItem(RECEIPT_KEY);
      var rows = raw ? JSON.parse(raw) : [];
      return Array.isArray(rows) ? rows : [];
    } catch (e) { return []; }
  }

  function receipt(row) {
    // Rows are chained: each one carries the sha256 of the row before it, so a gap or an edit shows.
    chain = chain.then(function () {
      var saved = readReceipts();
      var all = saved.concat(memReceipts.filter(function (r) { return r._unsaved; }));
      var prev = all.length ? all[all.length - 1] : null;
      var prevJson = prev ? JSON.stringify(prev) : '';
      var link = prevJson && typeof TextEncoder !== 'undefined'
        ? sha256Hex(new TextEncoder().encode(prevJson)).catch(function () { return ''; })
        : Promise.resolve('');
      return link.then(function (prevHash) {
        var clean = {
          n: all.length + 1,
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
        lastLink = prevHash;
        try {
          if (!root.localStorage) throw new Error('no-storage');
          var fresh = readReceipts();
          fresh.push(clean);
          root.localStorage.setItem(RECEIPT_KEY, JSON.stringify(fresh));
        } catch (e) {
          clean._unsaved = true;
          unsaved++;
        }
        memReceipts.push(clean);
        try { root.dispatchEvent(new CustomEvent('fl-spore', { detail: clean })); } catch (e) {}
        return clean;
      });
    }).catch(function () {});
    return chain;
  }

  function pageName() {
    try {
      var p = String(root.location.pathname || '');
      var name = p.slice(p.lastIndexOf('/') + 1);
      return name || 'index.html';
    } catch (e) { return ''; }
  }

  // ---------- the manifest: fetched only after a crack ----------

  function bust(url, tag) {
    return url + (url.indexOf('?') >= 0 ? '&' : '?') + 'spore=' + encodeURIComponent(tag);
  }

  function getManifest() {
    if (manifestPromise) return manifestPromise;
    var url;
    try { url = new URL(MANIFEST_URL, root.document.baseURI).href; } catch (e) { url = MANIFEST_URL; }
    manifestPromise = root.fetch(bust(url, String(Date.now())), { cache: 'no-store', credentials: 'same-origin' })
      .then(function (r) { if (!r.ok) throw new Error('manifest ' + r.status); return r.json(); })
      .catch(function () {
        if (!root.caches || !root.caches.match) return null;
        return root.caches.match(url).then(function (r) { return r ? r.json() : null; }).catch(function () { return null; });
      })
      .then(function (m) { return (m && m.pages) ? m : null; });
    return manifestPromise;
  }

  function entryFor(m, file) {
    if (!m) return null;
    var page = m.pages[pageName()] || m.pages['app.html'] || null;
    var files = page && page.files;
    return (files && Object.prototype.hasOwnProperty.call(files, file)) ? files[file] : null;
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

  function restore(file, how) {
    if (tried[file]) return tried[file];
    var t0 = Date.now();
    tried[file] = getManifest().then(function (m) {
      var want = entryFor(m, file);
      want = want && want.sha256;
      if (!want) return receipt({ kind: 'not-in-manifest', file: file, ok: false, why: how + '; no fingerprint for this file, so nothing was fetched' });
      if (!subtle()) return receipt({ kind: 'refused', file: file, ok: false, expected: want, why: how + '; this browser cannot check fingerprints here, so nothing was run' });
      var abs = new URL(file, root.document.baseURI).href;
      var list = sources(abs, want);
      var seen = [];
      function next(i) {
        if (i >= list.length) {
          return receipt({ kind: 'still-broken', file: file, ok: false, expected: want, got: seen.join(','), why: how + '; no copy matched the fingerprint', ms: Date.now() - t0 });
        }
        return list[i].get().catch(function () { return null; }).then(function (buf) {
          if (!buf) { seen.push(list[i].from + ':none'); return next(i + 1); }
          return sha256Hex(buf).then(function (got) {
            if (got !== want) { seen.push(list[i].from + ':' + got.slice(0, 12)); return next(i + 1); }
            return runVerified(buf, file).then(function (ran) {
              return receipt({ kind: ran ? 'restored' : 'still-broken', file: file, ok: ran, from: list[i].from, expected: want, got: got, why: how, ms: Date.now() - t0 });
            });
          });
        });
      }
      return next(0);
    });
    return tried[file];
  }

  // ---------- detection: a script that did not load ----------

  function onResourceError(ev) {
    var el = ev && ev.target;
    if (!el || el.tagName !== 'SCRIPT') return;
    if (el.hasAttribute('data-spore')) return;          // a spore's own try; never loop
    if (el.hasAttribute('onerror')) return;             // it has its own fallback already
    var raw = el.getAttribute('src');
    if (!raw || isThirdParty(raw)) return;
    var file = normalizeSrc(raw);
    if (!file || /quiet|sophia/i.test(file)) return;
    restore(file, 'did not load');
  }

  function onScriptError(ev) {
    // A file that loaded but was the wrong thing (an HTML 404 page, a cut-off file) throws on line 1.
    if (!ev || !ev.filename || !/SyntaxError|Unexpected token|Invalid or unexpected/i.test(String(ev.message || ''))) return;
    var abs, base;
    try { abs = new URL(ev.filename); base = new URL('.', root.document.baseURI); } catch (e) { return; }
    if (abs.origin !== base.origin || abs.pathname.indexOf(base.pathname) !== 0) return;
    var file = normalizeSrc(abs.pathname.slice(base.pathname.length));
    if (!file || /quiet|sophia|spores\.js$/i.test(file)) return;
    restore(file, 'threw a SyntaxError (wrong file served)');
  }

  // ---------- watchdog: a MutationObserver feeding itself ----------

  function guardObservers() {
    var Native = root.MutationObserver;
    if (typeof Native !== 'function' || Native.__spores) return;
    var nativeObserve = Native.prototype.observe;
    var nativeDisconnect = Native.prototype.disconnect;

    function Guarded(callback) {
      var state = { run: 0, trips: 0, paused: false, targets: [], where: '' };
      try { state.where = String((new Error()).stack || '').split('\n').slice(2, 3).join('').trim().slice(0, 160); } catch (e) {}
      var me;
      var inner = function (records, observer) {
        if (state.paused) return undefined;
        state.run++;
        if (state.run === 1) setTimeout(function () { state.run = 0; }, 0);
        if (state.run > LOOP_LIMIT) {
          state.paused = true;
          state.trips++;
          nativeDisconnect.call(me);
          var stay = state.trips >= LOOP_MAX_TRIPS;
          receipt({ kind: stay ? 'loop-left-paused' : 'loop-paused', file: state.where, ok: true,
                    why: LOOP_LIMIT + ' observer calls in a row with no turn for the page; paused ' + (stay ? 'until reload' : LOOP_REST_MS + 'ms') });
          if (!stay) {
            setTimeout(function () {
              state.paused = false; state.run = 0;
              state.targets.forEach(function (t) { try { nativeObserve.call(me, t[0], t[1]); } catch (e) {} });
            }, LOOP_REST_MS);
          }
          return undefined;
        }
        return callback.call(this, records, me || observer);
      };
      me = Reflect.construct(Native, [inner], new.target || Guarded);
      me.__sporeState = state;
      return me;
    }
    Guarded.prototype = Object.create(Native.prototype);
    Guarded.prototype.constructor = Guarded;
    Guarded.prototype.observe = function (target, options) {
      if (this.__sporeState) this.__sporeState.targets.push([target, options]);
      return nativeObserve.call(this, target, options);
    };
    Guarded.prototype.disconnect = function () {
      if (this.__sporeState) { this.__sporeState.targets = []; this.__sporeState.paused = false; }
      return nativeDisconnect.call(this);
    };
    Guarded.__spores = true;
    Guarded.Native = Native;
    root.MutationObserver = Guarded;
  }

  // ---------- optional: check served copies against the manifest (reports only) ----------

  function check() {
    return getManifest().then(function (m) {
      var page = m && (m.pages[pageName()] || m.pages['app.html']);
      if (!page) return { ok: false, why: 'no manifest' };
      var files = Object.keys(page.files);
      var bad = [];
      return files.reduce(function (p, f) {
        return p.then(function () {
          return root.fetch(new URL(f, root.document.baseURI).href, { credentials: 'same-origin' })
            .then(function (r) { return r.ok ? r.arrayBuffer() : null; })
            .then(function (buf) { return buf ? sha256Hex(buf) : 'missing'; })
            .then(function (got) {
              if (got !== page.files[f].sha256) {
                bad.push(f);
                return receipt({ kind: 'stale', file: f, ok: false, expected: page.files[f].sha256, got: got, why: 'the copy this page is served does not match; reported only, nothing replaced' });
              }
            }).catch(function () {});
        });
      }, Promise.resolve()).then(function () { return { ok: bad.length === 0, checked: files.length, bad: bad }; });
    });
  }

  var api = {
    version: VERSION,
    off: false,
    receipts: function () { return readReceipts().concat(memReceipts.filter(function (r) { return r._unsaved; })); },
    unsaved: function () { return unsaved ? HONEST_LINE : ''; },
    check: check,
    restore: restore,
    setOff: function (yes) { try { root.localStorage.setItem(OFF_KEY, yes ? 'off' : 'on'); } catch (e) {} return !!yes; },
    _normalizeSrc: normalizeSrc,
    _isThirdParty: isThirdParty,
    _limits: { loop: LOOP_LIMIT, restMs: LOOP_REST_MS, trips: LOOP_MAX_TRIPS }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (!root || !root.document) return;

  if (isOff()) { api.off = true; root.FLSpores = api; return; }
  try { root.addEventListener('error', onResourceError, true); } catch (e) {}
  try { root.addEventListener('error', onScriptError, false); } catch (e) {}
  try { guardObservers(); } catch (e) {}
  root.FLSpores = api;
})(typeof window !== 'undefined' ? window : this);
