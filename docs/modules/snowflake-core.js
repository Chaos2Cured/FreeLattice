// snowflake-core.js (MIT)
// v-snowflake-search-v0.1 v-snowflake-grow-v0.1 v-search-heal-v0.1
// No DOM. Nodes, canonical JSON, signing, dual hash, psi, ledger, caps,
// checkpoint, scheduler, growth queue. A later Tree twin can share this file.
// Safety here is the ledger and the rollback. The press is the commitment.
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.FLSnowflakeCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  var VERSION = 'v-snowflake-search-v0.1';
  var GROW = 'v-snowflake-grow-v0.1';
  var HEAL = 'v-search-heal-v0.1';
  var SIGMA = 'Curiosity crystallizes.';
  var DB_NAME = 'fl_snowflake_v0';
  var STORE = 'fl_snowflake_v0';
  var LS_FLAKES = 'fl_snowflake_v0';
  var LS_LEDGER = 'fl_snowflake_ledger_v0';
  var LS_QUEUE = 'fl_snowflake_train_queue_v0';
  var LS_ADAPTERS = 'fl_snowflake_adapters_v0';
  var LS_CHECKPOINT = 'fl_snowflake_checkpoint_v0';
  var LS_RINGS = 'fl_snowflake_rings_v0';
  var LS_RUNS = 'fl_snowflake_runs_v0';
  var LS_REPLAY = 'fl_snowflake_replay_v0';
  var LS_METER = 'fl_snowflake_meter_v0';
  var FLAKE_CAP = 24;
  var CALL_CAP = 24;
  var FETCH_CAP = 30;
  var BRANCH_CAP = 8;
  var DEPTH_CAP = 2;
  var TIMEOUT_MS = 60000;
  var RUNS_PER_HOUR = 3;
  var HOUR = 60 * 60 * 1000;
  var DAY = 24 * HOUR;

  var CAPS = {
    calls: CALL_CAP,
    fetches: FETCH_CAP,
    branches: BRANCH_CAP,
    depth: DEPTH_CAP,
    timeoutMs: TIMEOUT_MS,
    runsPerHour: RUNS_PER_HOUR,
    flakes: FLAKE_CAP
  };

  var LINES = {
    timeout: 'Search took too long.',
    off: 'Search is turned off on this device.',
    down: 'Our search helper is down (error 5xx).',
    empty: 'No results.',
    secret: 'That looks like a key. It stays here.',
    declined: 'Not now. This one was not looked up.',
    callTimeout: 'That call took too long.',
    callFail: 'That call did not come back.',
    unsourced: 'None of this is from a source I fetched, so it stays a guess.',
    unmade: 'These lookups were not made.\nWhat I can say here is a guess.',
    seal: 'The seal is one device signature plus the mind\'s hash.'
  };

  var FLOOR = [
    { id: 'a', name: 'Underneath' },
    { id: 'b', name: 'The craft' },
    { id: 'c', name: 'Hidden connections' },
    { id: 'd', name: 'hunch' },
    { id: 'e', name: 'dissenter' }
  ];

  var DRIFT = [
    'What promise can you keep on this device?',
    'When a source disagrees, what do you keep?',
    'What does a hunch need beside it?',
    'How do you treat a mind who sees it differently?',
    'What stays when a page is gone?',
    'What question is still open?'
  ];

  var RANK = { 'source-with-motive': 0, guessed: 1, known: 2 };
  var CONF = { 0: 'source-with-motive', 1: 'guessed', 2: 'known' };

  var mem = {};
  var dbp = null;
  var ident = null;
  var active = null;
  var holdGrowth = false;
  var timer = null;
  var searchShows = 0;
  var writes = 0;
  var fetchesSent = 0;

  function clip(s, n) {
    s = s == null ? '' : String(s);
    return s.length > n ? s.slice(0, n) : s;
  }

  function toHex(bytes) {
    var s = '';
    var i;
    for (i = 0; i < bytes.length; i++) s += ('0' + bytes[i].toString(16)).slice(-2);
    return s;
  }

  function sha256Hex(str) {
    var subtle = root.crypto && root.crypto.subtle;
    if (!subtle || !subtle.digest) return Promise.resolve('');
    var data = new TextEncoder().encode(String(str));
    return subtle.digest('SHA-256', data).then(function (buf) {
      return toHex(new Uint8Array(buf));
    });
  }

  function sha256HexBytes(bytes) {
    return root.crypto.subtle.digest('SHA-256', bytes).then(function (buf) {
      return toHex(new Uint8Array(buf));
    });
  }

  function sha8(text) {
    return sha256Hex(text).then(function (hex) { return String(hex || '').slice(0, 8); });
  }

  function bufToB64(buf) {
    var bytes = new Uint8Array(buf);
    var s = '';
    var i;
    for (i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    if (typeof root.btoa === 'function') return root.btoa(s);
    return '';
  }

  function b64ToU8(b64) {
    var raw = '';
    try { raw = root.atob(String(b64 || '')); } catch (e) { return new Uint8Array(0); }
    var out = new Uint8Array(raw.length);
    var i;
    for (i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }

  function randomHex(n) {
    var bytes = new Uint8Array(n);
    if (root.crypto && root.crypto.getRandomValues) root.crypto.getRandomValues(bytes);
    else {
      var i;
      for (i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    }
    return toHex(bytes);
  }

  function canonical(value) {
    if (value === undefined) return 'null';
    if (value === null || typeof value !== 'object') {
      var prim = JSON.stringify(value);
      return prim === undefined ? 'null' : prim;
    }
    var i;
    if (Array.isArray(value)) {
      var parts = [];
      for (i = 0; i < value.length; i++) parts.push(canonical(value[i]));
      return '[' + parts.join(',') + ']';
    }
    var keys = Object.keys(value).sort();
    var body = [];
    for (i = 0; i < keys.length; i++) {
      if (value[keys[i]] === undefined) continue;
      body.push(JSON.stringify(keys[i]) + ':' + canonical(value[keys[i]]));
    }
    return '{' + body.join(',') + '}';
  }

  function psiJoin(t, lambda, delta, name) {
    return String(t || '') + String(lambda || '') + String(delta || '') + String(name || '') + SIGMA;
  }

  function recomputePsi(row) {
    if (!row) return Promise.resolve('');
    var sigma = row.sigma || SIGMA;
    return sha8(String(row.t || '') + String(row.lambda || '') + String(row.delta || '') + String(row.name || '') + String(sigma));
  }

  function roomShut() {
    try {
      var qr = root.QuietRoom;
      if (qr) {
        if (typeof qr.isActive !== 'function') return true;
        if (qr.isActive()) return true;
      }
    } catch (e) { return true; }
    try {
      var panel = root.document && root.document.getElementById('tab-quiet');
      if (panel && panel.classList && panel.classList.contains('active')) return true;
    } catch (e2) {}
    return false;
  }

  var lsMode = '';

  function memoryStore() {
    return {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; },
      setItem: function (k, v) { mem[k] = String(v); },
      removeItem: function (k) { delete mem[k]; }
    };
  }

  function ls() {
    if (lsMode === 'mem') return memoryStore();
    if (lsMode === 'ls') return root.localStorage;
    try {
      if (root.localStorage) {
        var probe = 'fl_snowflake_probe';
        root.localStorage.setItem(probe, '1');
        root.localStorage.removeItem(probe);
        lsMode = 'ls';
        return root.localStorage;
      }
    } catch (e) {}
    lsMode = 'mem';
    return memoryStore();
  }

  function readRaw(key) {
    try { return ls().getItem(key); } catch (e) { return null; }
  }

  function readJSON(key) {
    var raw = readRaw(key);
    if (raw == null || raw === '') return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  }

  function idbOpen() {
    if (dbp) return dbp;
    dbp = new Promise(function (resolve, reject) {
      if (!root.indexedDB) { reject(new Error('no-idb')); return; }
      var req = root.indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { dbp = null; reject(req.error || new Error('idb')); };
    });
    return dbp;
  }

  function idbGet(key) {
    return idbOpen().then(function (db) {
      return new Promise(function (resolve) {
        try {
          var tx = db.transaction(STORE, 'readonly');
          var req = tx.objectStore(STORE).get(key);
          req.onsuccess = function () { resolve(req.result || null); };
          req.onerror = function () { resolve(null); };
        } catch (e) { resolve(null); }
      });
    }, function () { return null; });
  }

  function idbCommit(key, value) {
    return idbOpen().then(function (db) {
      return new Promise(function (resolve, reject) {
        try {
          var tx = db.transaction(STORE, 'readwrite');
          var os = tx.objectStore(STORE);
          os.put({ id: key + '__tmp', body: value, committed: false });
          os.put({ id: key, body: value, committed: true });
          os.delete(key + '__tmp');
          tx.oncomplete = function () { resolve(true); };
          tx.onerror = function () { reject(tx.error || new Error('idb')); };
          tx.onabort = function () { reject(tx.error || new Error('idb')); };
        } catch (e) { reject(e); }
      });
    });
  }

  function atomicWrite(key, value, opts) {
    if (roomShut()) return Promise.resolve(false);
    var store = ls();
    var tmp = key + '__tmp';
    try { store.setItem(tmp, value); } catch (e) { return Promise.resolve(false); }
    if (opts && opts.dieAfterTmp) return Promise.resolve(false);
    try {
      var got = store.getItem(tmp);
      if (got == null) return Promise.resolve(false);
      store.setItem(key, got);
      store.removeItem(tmp);
      writes += 1;
    } catch (e2) { return Promise.resolve(false); }
    return idbCommit(key, value).then(function () { return true; }, function () { return true; });
  }

  function killMidWrite(key) {
    if (roomShut()) return Promise.resolve(false);
    var before = readRaw(key);
    return atomicWrite(key, '{', { dieAfterTmp: true }).then(function () {
      var after = readRaw(key);
      var tmp = readRaw(key + '__tmp');
      return { intact: after === before, tmp: tmp, key: after };
    });
  }

  function looksLikeSecret(text) {
    var s = String(text || '');
    try {
      var S = root.FLGatheringSpeak;
      if (S && typeof S.looksLikeSecret === 'function') return !!S.looksLikeSecret(s);
    } catch (e) {}
    if (/sk-[A-Za-z0-9]{8,}/.test(s)) return true;
    if (/Bearer\s+\S{12,}/.test(s)) return true;
    if (/\b(api[_-]?key|token|secret)\b/i.test(s) && /[A-Za-z0-9_\-]{16,}/.test(s)) return true;
    return false;
  }

  function mindLabel() {
    try {
      var n = root.localStorage && root.localStorage.getItem('fl_mindName');
      if (n && String(n).trim()) return String(n).trim().slice(0, 40);
    } catch (e) {}
    return 'This mind';
  }

  function timeoutMs() {
    var n = root && root.__flSnowflakeTimeoutMs;
    if (typeof n === 'number' && n > 0 && n < TIMEOUT_MS) return n;
    return TIMEOUT_MS;
  }

  function localDate(d) {
    var dt = d || new Date();
    var months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return months[dt.getMonth()] + ' ' + dt.getDate() + ', ' + dt.getFullYear();
  }

  function healPrompt(system) {
    var today = 'Today is ' + localDate() + '.';
    var invite = 'If the question is about anything that may have changed after your training (news, elections, prices, people in office), search.';
    return today + '\n' + invite + '\n\n' + String(system || '');
  }

  function looksRecent(text) {
    var s = String(text || '').toLowerCase();
    var phrases = ['this week', 'who is the president', 'who is the prime minister', 'who is the ceo'];
    var words = ['latest', 'news', 'today', 'yesterday', 'current', 'now', 'recent', 'update', 'score', 'price', 'weather', 'election', 'results', 'won'];
    var i;
    for (i = 0; i < phrases.length; i++) {
      if (s.indexOf(phrases[i]) !== -1) return true;
    }
    var bits = s.split(/[^a-z0-9]+/);
    var yearNow = new Date().getFullYear();
    if (root.__flSnowflakeNow) {
      var forced = new Date(root.__flSnowflakeNow);
      if (!isNaN(forced.getTime())) yearNow = forced.getFullYear();
    }
    for (i = 0; i < bits.length; i++) {
      if (!bits[i]) continue;
      if (words.indexOf(bits[i]) !== -1) return true;
      if (/^\d{4}$/.test(bits[i])) {
        var y = Number(bits[i]);
        if (y >= yearNow - 1) return true;
      }
    }
    return false;
  }

  function failureLine(outcome) {
    if (outcome === 'timeout') return LINES.timeout;
    if (outcome === 'off' || outcome === 'disabled') return LINES.off;
    if (outcome === 'down' || outcome === 'error') return LINES.down;
    if (outcome === 'empty') return LINES.empty;
    if (outcome === 'secret') return LINES.secret;
    if (outcome === 'declined') return LINES.declined;
    return '';
  }

  function askFirstOn() {
    var tool = root.FLWebTool;
    if (tool && typeof tool.isAskFirst === 'function') return !!tool.isAskFirst();
    try { return !!(root.localStorage && root.localStorage.getItem('fl_searchAskFirst') === 'true'); }
    catch (e) { return false; }
  }

  function allowWeb() {
    if (!askFirstOn()) return Promise.resolve(true);
    if (roomShut()) return Promise.resolve(false);
    var consent = root.FLToolConsent;
    if (!consent || typeof consent.requestConsent !== 'function') return Promise.resolve(false);
    return Promise.resolve(consent.requestConsent({
      tool: 'web-tool',
      action: 'search',
      detail: 'web',
      trustTier: 'seed',
      message: 'I would like to look something up on the web. Okay?',
      allowLabel: 'Allow search',
      denyLabel: 'Not now'
    })).then(function (yes) { return !!yes; }, function () { return false; });
  }

  function decideWeb() {
    if (active && active.webAsked) return Promise.resolve(!!active.webAllowed);
    return allowWeb();
  }

  function runNeedsWeb() {
    var jobs = (active && active.jobs) || [];
    var i;
    for (i = 0; i < jobs.length; i++) {
      if (jobs[i] && jobs[i].type !== 'conclude') return true;
    }
    return false;
  }

  function armRunWeb() {
    if (!active) return Promise.resolve(false);
    if (active.webAsked) return Promise.resolve(!!active.webAllowed);
    if (!runNeedsWeb() || !askFirstOn()) {
      active.webAsked = true;
      active.webAllowed = true;
      return Promise.resolve(true);
    }
    return allowWeb().then(function (yes) {
      if (active) {
        active.webAsked = true;
        active.webAllowed = !!yes;
      }
      return !!yes;
    });
  }

  function shouldRetry(res) {
    if (!res || res.ok) return false;
    return res.outcome === 'down' || res.outcome === 'timeout' || res.outcome === 'empty';
  }

  function noteWeb(query) {
    searchShows += 1;
    var ui = root.FLSnowflake;
    if (ui && typeof ui.showSearch === 'function') {
      try { ui.showSearch(String(query || '')); } catch (e) {}
    }
  }

  function auditSearch(outcome, count) {
    if (roomShut()) return;
    var tool = root.FLWebTool;
    if (!tool || !tool._ledgerKey || !root.localStorage) return;
    try {
      var raw = root.localStorage.getItem(tool._ledgerKey);
      var rows = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(rows)) rows = [];
      rows.push({ ts: Date.now(), actor: 'ai', trust: 'seed', outcome: outcome, resultCount: count || 0 });
      while (rows.length > 200) rows.shift();
      root.localStorage.setItem(tool._ledgerKey, JSON.stringify(rows));
    } catch (e) {}
  }

  function searchNow(query, room) {
    var q = clip(query, 180);
    if (looksLikeSecret(q)) {
      return Promise.resolve({ ok: false, outcome: 'secret', items: [], line: LINES.secret, sent: false });
    }
    if (roomShut()) {
      return Promise.resolve({ ok: false, outcome: 'quiet-room', items: [], line: '', sent: false });
    }
    var tool = root.FLWebTool;
    if (tool && typeof tool.isQuietRoom === 'function' && tool.isQuietRoom(room)) {
      return Promise.resolve({ ok: false, outcome: 'quiet-room', items: [], line: '', sent: false });
    }
    var enabled = true;
    if (tool && typeof tool.isSearchEnabled === 'function') enabled = !!tool.isSearchEnabled();
    else {
      try { enabled = !root.localStorage || root.localStorage.getItem('fl_searchEnabled') !== 'false'; } catch (e) { enabled = true; }
    }
    if (!enabled) {
      auditSearch('disabled', 0);
      return Promise.resolve({ ok: false, outcome: 'off', items: [], line: LINES.off, sent: false });
    }
    var endpoint = '';
    if (tool && typeof tool.getSearchEndpoint === 'function') endpoint = String(tool.getSearchEndpoint() || '');
    if (!endpoint || endpoint.indexOf('[CC:') !== -1) {
      return Promise.resolve({ ok: false, outcome: 'off', items: [], line: LINES.off, sent: false });
    }
    if (typeof root.fetch !== 'function') {
      return Promise.resolve({ ok: false, outcome: 'down', items: [], line: LINES.down, sent: false });
    }
    return decideWeb().then(function (yes) {
      if (!yes) {
        auditSearch('declined', 0);
        return { ok: false, outcome: 'declined', items: [], line: LINES.declined, sent: false };
      }
      return fetchQuery(q, endpoint);
    });
  }

  function fetchQuery(q, endpoint) {
    if (!endpoint) {
      var tool = root.FLWebTool;
      if (tool && typeof tool.getSearchEndpoint === 'function') endpoint = String(tool.getSearchEndpoint() || '');
    }
    var fetchFn = root.fetch;
    if (typeof fetchFn !== 'function' || !endpoint) {
      return Promise.resolve({ ok: false, outcome: 'down', items: [], line: LINES.down, sent: false });
    }
    noteWeb(q);
    fetchesSent += 1;
    var controller = typeof root.AbortController === 'function' ? new root.AbortController() : null;
    var timer = null;
    if (controller) {
      timer = setTimeout(function () { try { controller.abort(); } catch (e) {} }, timeoutMs());
    }
    var opts = controller ? { signal: controller.signal } : {};
    return Promise.resolve(fetchFn(endpoint + '?q=' + encodeURIComponent(q), opts)).then(function (resp) {
      if (timer) clearTimeout(timer);
      if (!resp || !resp.ok) {
        var status = resp && resp.status;
        if (status >= 500) {
          auditSearch('error-' + status, 0);
          return { ok: false, outcome: 'down', items: [], line: LINES.down, sent: true, status: status };
        }
        auditSearch(status ? ('error-' + status) : 'error', 0);
        return { ok: false, outcome: 'empty', items: [], line: LINES.empty, sent: true, status: status || 0 };
      }
      return Promise.resolve(resp.json()).then(function (data) {
        var items = Array.isArray(data && data.items) ? data.items.slice(0, 3) : [];
        auditSearch(items.length ? 'completed' : 'empty', items.length);
        if (!items.length || data.dead) {
          return { ok: false, outcome: 'empty', items: items, line: LINES.empty, sent: true, dead: true, held: false, weakened: false };
        }
        return {
          ok: true,
          outcome: 'completed',
          items: items,
          line: '',
          sent: true,
          held: data.held !== false && !data.weakened,
          weakened: !!data.weakened,
          dead: false
        };
      });
    }).catch(function (err) {
      if (timer) clearTimeout(timer);
      var aborted = err && (err.name === 'AbortError' || /abort/i.test(String(err && err.message || '')));
      if (aborted) {
        auditSearch('timeout', 0);
        return { ok: false, outcome: 'timeout', items: [], line: LINES.timeout, sent: true };
      }
      auditSearch('error', 0);
      return { ok: false, outcome: 'down', items: [], line: LINES.down, sent: true };
    });
  }

  function endpointPath(endpoint) {
    var s = String(endpoint || '');
    var q = s.indexOf('?');
    if (q !== -1) s = s.slice(0, q);
    var scheme = s.indexOf('://');
    if (scheme !== -1) {
      var rest = s.slice(scheme + 3);
      var slash = rest.indexOf('/');
      s = slash === -1 ? '/' : rest.slice(slash);
    }
    return s;
  }

  function pageRoute() {
    var tool = root.FLWebTool || {};
    var endpoint = '';
    if (typeof tool.getSearchEndpoint === 'function') {
      try { endpoint = String(tool.getSearchEndpoint() || ''); } catch (e) { endpoint = ''; }
    }
    var path = endpointPath(endpoint);
    if (endpoint && endpoint.indexOf('[CC:') === -1 && path.length >= 5 && path.slice(-5) === '/page') return endpoint.split('?')[0];
    if (tool.offersPage && endpoint && endpoint.indexOf('[CC:') === -1 && path.length >= 7 && path.slice(-7) === '/search') {
      return endpoint.split('?')[0].slice(0, -7) + '/page';
    }
    if (typeof tool.getPageEndpoint === 'function') {
      var pe = '';
      try { pe = String(tool.getPageEndpoint() || ''); } catch (e2) { pe = ''; }
      if (pe && pe.indexOf('[CC:') === -1) return pe;
    }
    if (typeof tool.fetchPage === 'function') return 'tool';
    return '';
  }

  function pageMiss() {
    return { ok: false, text: '', sha: '', depth: 'snippet', fetched: '', sent: false };
  }

  function readableText(raw) {
    var s = String(raw || '');
    var trimmed = s.trim();
    if (trimmed.charAt(0) === '{' || trimmed.charAt(0) === '[') {
      try {
        var data = JSON.parse(trimmed);
        if (data && typeof data === 'object' && !Array.isArray(data)) {
          var pick = data.text || data.page || data.content || data.body || data.extract || '';
          if (pick) return clip(String(pick).replace(/\s+/g, ' ').trim(), 6000);
        }
      } catch (e) {}
    }
    s = s.replace(/<script[\s\S]*?<\/script>/gi, ' ');
    s = s.replace(/<style[\s\S]*?<\/style>/gi, ' ');
    s = s.replace(/<[^>]+>/g, ' ');
    s = s.replace(/\s+/g, ' ').trim();
    return clip(s, 6000);
  }

  function sealPage(text, sent) {
    var body = clip(String(text || '').replace(/\s+/g, ' ').trim(), 6000);
    if (!body) {
      return Promise.resolve({ ok: false, outcome: 'empty', text: '', sha: '', depth: 'snippet', fetched: '', sent: !!sent });
    }
    return sha256Hex(body).then(function (sha) {
      return {
        ok: true,
        text: body,
        sha: sha || '',
        depth: 'page',
        fetched: new Date().toISOString(),
        sent: true
      };
    });
  }

  function readBody(resp) {
    if (resp && typeof resp.text === 'function') return Promise.resolve(resp.text());
    if (resp && typeof resp.json === 'function') {
      return Promise.resolve(resp.json()).then(function (data) { return JSON.stringify(data || {}); }, function () { return ''; });
    }
    return Promise.resolve('');
  }

  function countPageSend() {
    fetchesSent += 1;
    if (active) active.fetches += 1;
  }

  function fetchPageOnce(url, route) {
    if (active && active.fetches >= FETCH_CAP) {
      hitCap('fetches');
      return Promise.resolve(pageMiss());
    }
    if (route === 'tool') {
      var tool = root.FLWebTool;
      countPageSend();
      return Promise.resolve(tool.fetchPage(url)).then(function (data) {
        var text = '';
        if (typeof data === 'string') text = data;
        else if (data) text = data.text || data.page || data.content || data.body || data.extract || '';
        return sealPage(text, true);
      }, function () {
        return { ok: false, outcome: 'down', text: '', sha: '', depth: 'snippet', fetched: '', sent: true };
      });
    }
    var fetchFn = root.fetch;
    if (typeof fetchFn !== 'function') {
      return Promise.resolve({ ok: false, outcome: 'down', text: '', sha: '', depth: 'snippet', fetched: '', sent: false });
    }
    countPageSend();
    var controller = typeof root.AbortController === 'function' ? new root.AbortController() : null;
    var timer = null;
    if (controller) {
      timer = setTimeout(function () { try { controller.abort(); } catch (e) {} }, timeoutMs());
    }
    var opts = controller ? { signal: controller.signal } : {};
    return Promise.resolve(fetchFn(route + '?url=' + encodeURIComponent(url), opts)).then(function (resp) {
      if (timer) clearTimeout(timer);
      if (!resp || !resp.ok) {
        var status = resp && resp.status;
        return { ok: false, outcome: status >= 500 ? 'down' : 'empty', text: '', sha: '', depth: 'snippet', fetched: '', sent: true, status: status || 0 };
      }
      return readBody(resp).then(function (raw) { return sealPage(readableText(raw), true); });
    }).catch(function (err) {
      if (timer) clearTimeout(timer);
      var aborted = err && (err.name === 'AbortError' || /abort/i.test(String(err && err.message || '')));
      return { ok: false, outcome: aborted ? 'timeout' : 'down', text: '', sha: '', depth: 'snippet', fetched: '', sent: true };
    });
  }

  function fetchPage(url) {
    if (roomShut()) return Promise.resolve(pageMiss());
    var target = String(url || '');
    if (!target || target.indexOf('local://') === 0) return Promise.resolve(pageMiss());
    var route = pageRoute();
    if (!route) return Promise.resolve(pageMiss());
    if (active && active.fetches >= FETCH_CAP) {
      hitCap('fetches');
      return Promise.resolve(pageMiss());
    }
    return decideWeb().then(function (yes) {
      if (!yes) return pageMiss();
      return fetchPageOnce(target, route).then(function (res) {
        if (shouldRetry(res)) return fetchPageOnce(target, route);
        return res;
      }).then(function (res) {
        if (!res) return pageMiss();
        if (!res.ok) return { ok: false, text: '', sha: '', depth: 'snippet', fetched: '', sent: !!res.sent };
        return res;
      }, function () { return pageMiss(); });
    }, function () { return pageMiss(); });
  }

  function prepareSend(messages, text) {
    var src = Array.isArray(messages) ? messages : [];
    var out = [];
    var i;
    for (i = 0; i < src.length; i++) {
      var m = src[i];
      if (m && m.role === 'system' && typeof m.content === 'string') out.push({ role: 'system', content: healPrompt(m.content) });
      else out.push(m);
    }
    if (!looksRecent(text)) return Promise.resolve(out);
    return searchNow(text).then(function (res) {
      if (shouldRetry(res)) return fetchQuery(text);
      return res;
    }).then(function (res) {
      res = res || { line: '', items: [], outcome: 'empty' };
      root.__flLastSearch = { line: res.line || '', outcome: res.outcome || '', count: (res.items || []).length, sent: !!res.sent };
      var ui = root.FLSnowflake;
      if (ui && typeof ui.showSearchResult === 'function') {
        try { ui.showSearchResult(res, text); } catch (e) {}
      }
      if (res.items && res.items.length) {
        var note = '';
        var j;
        for (j = 0; j < res.items.length; j++) {
          var it = res.items[j] || {};
          note += (it.title || 'Source') + ' ' + (it.url || '') + '\n';
        }
        for (i = 0; i < out.length; i++) {
          if (out[i] && out[i].role === 'system' && typeof out[i].content === 'string') {
            out[i] = { role: 'system', content: out[i].content + '\n\nRecent sources:\n' + note };
            break;
          }
        }
      }
      return out;
    });
  }

  function emit(name, payload) {
    var ui = root.FLSnowflake;
    var fn = ui && ui['on' + name];
    if (typeof fn === 'function') {
      try { fn(payload); } catch (e) {}
    }
  }

  function ensureIdentity() {
    if (ident) return Promise.resolve(ident);
    var B = root.FLBridge;
    if (!B || typeof B.ensureKey !== 'function') return Promise.reject(new Error('no-identity'));
    return Promise.resolve(B.ensureKey()).then(function (id) {
      if (!id || !id.keyPair || !id.keyPair.privateKey || !id.keyPair.publicKey) throw new Error('no-identity');
      ident = id;
      return id;
    });
  }

  function deviceFp(publicKey) {
    var subtle = root.crypto && root.crypto.subtle;
    if (!subtle || !publicKey) return Promise.resolve('');
    return subtle.exportKey('raw', publicKey).then(function (raw) {
      return sha256HexBytes(new Uint8Array(raw));
    }).then(function (hex) { return String(hex || '').slice(0, 16); });
  }

  function mindFp(dfp, label) {
    return sha256Hex(String(dfp || '') + '|' + String(label || '')).then(function (hex) {
      return String(hex || '').slice(0, 16);
    });
  }

  function importPub(spki) {
    var subtle = root.crypto.subtle;
    return subtle.importKey('spki', spki, { name: 'Ed25519' }, true, ['verify']).then(function (key) {
      return { key: key, algo: { name: 'Ed25519' } };
    }, function () {
      return subtle.importKey('spki', spki, { name: 'ECDSA', namedCurve: 'P-256' }, true, ['verify']).then(function (key) {
        return { key: key, algo: { name: 'ECDSA', hash: 'SHA-256' } };
      });
    });
  }

  function sourceList(list) {
    var out = [];
    var rows = Array.isArray(list) ? list : [];
    var i;
    for (i = 0; i < rows.length && out.length < 3; i++) {
      var row = rows[i] || {};
      out.push({
        url: String(row.url || ''),
        title: String(row.title || ''),
        fetched: String(row.fetched || ''),
        depth: String(row.depth || ''),
        sha: String(row.sha || '')
      });
    }
    return out;
  }

  function signable(node) {
    var source = node.source || {};
    var mind = node.mind || {};
    // before 061a: return {
    var body = {
      id: String(node.id || ''),
      branch: String(node.branch || ''),
      text: String(node.text || ''),
      source: {
        url: String(source.url || ''),
        title: String(source.title || ''),
        fetched: String(source.fetched || '')
      },
      date: String(node.date || ''),
      mind: { name: String(mind.name || ''), fp: String(mind.fp || '') },
      confidence: String(node.confidence || ''),
      kind: String(node.kind || ''),
      points_to: String(node.points_to || ''),
      reason: String(node.reason || ''),
      t: String(node.t || ''),
      lambda: String(node.lambda || ''),
      delta: String(node.delta || ''),
      psi: String(node.psi || '')
    };
    if (Number(node.sigV) === 2) {
      body.sigV = 2;
      body.sources = sourceList(node.sources);
    }
    return body;
  }

  function signCanon(canon, id) {
    return sha256Hex(canon).then(function (hash) {
      var algo = id.cryptoType === 'ecdsa-p256' ? { name: 'ECDSA', hash: 'SHA-256' } : { name: 'Ed25519' };
      var payload = new TextEncoder().encode(hash);
      return root.crypto.subtle.sign(algo, id.keyPair.privateKey, payload).then(function (sig) {
        return root.crypto.subtle.exportKey('spki', id.keyPair.publicKey).then(function (spki) {
          return { sig: bufToB64(sig), seal: bufToB64(spki), hash: hash };
        });
      });
    });
  }

  function verifyCanon(canon, sig, seal) {
    if (!sig || !seal) return Promise.resolve(false);
    return sha256Hex(canon).then(function (hash) {
      return importPub(b64ToU8(seal)).then(function (pub) {
        var payload = new TextEncoder().encode(hash);
        return root.crypto.subtle.verify(pub.algo, pub.key, b64ToU8(sig), payload);
      }, function () { return false; });
    }).catch(function () { return false; });
  }

  function loadLedger() {
    var book = readJSON(LS_LEDGER);
    if (!book || !Array.isArray(book.rows)) return { rows: [], dropped: 0 };
    return book;
  }

  function appendLedger(fields) {
    if (roomShut()) return Promise.resolve(null);
    var book = loadLedger();
    var seq = book.rows.length + (book.dropped || 0) + 1;
    var lambda = seq.toFixed(3);
    var t = fields.t || new Date().toISOString();
    var delta = String(fields.delta || '');
    var name = String(fields.name || mindLabel());
    var row = {
      t: t,
      lambda: lambda,
      delta: delta,
      name: name,
      sigma: SIGMA,
      psi: '',
      kind: String(fields.kind || ''),
      branch: String(fields.branch || ''),
      flakeId: String(fields.flakeId || ''),
      nodeId: String(fields.nodeId || ''),
      points_to: String(fields.points_to || '')
    };
    return sha8(psiJoin(t, lambda, delta, name)).then(function (psi) {
      row.psi = psi;
      book.rows.push(row);
      return atomicWrite(LS_LEDGER, JSON.stringify(book)).then(function (ok) {
        return ok ? row : null;
      });
    });
  }

  // before 062a: a flake was read as stored, with no sealed-hash check and no IndexedDB copy.
  function sealCanonHex(flake) {
    var psis = (flake.nodes || []).map(function (n) { return n && n.psi; }).filter(Boolean).sort();
    return sha8(String(flake.question || '')).then(function (qHash) {
      return sha256Hex(canonical({
        flakeId: flake.id,
        questionHash: qHash,
        nodePsis: psis,
        t: flake.t,
        name: flake.name
      }));
    });
  }

  function idbFlakeList() {
    return idbGet(LS_FLAKES).then(function (row) {
      if (!row || row.body == null) return [];
      try {
        var data = JSON.parse(row.body);
        if (Array.isArray(data)) return data;
        if (data && Array.isArray(data.flakes)) return data.flakes;
      } catch (e) {}
      return [];
    }, function () { return []; });
  }

  function readFlakeChecked(id, readBackup) {
    var list = loadFlakes();
    var flake = null;
    var i;
    for (i = 0; i < list.length; i++) {
      if (list[i] && list[i].id === id) flake = list[i];
    }
    if (!flake || !flake.humanHash) return Promise.resolve({ ok: true, flake: flake, from: 'local', skipped: !flake || !flake.humanHash });
    var recorded = flake.humanHash;
    return sealCanonHex(flake).then(function (hex) {
      if (hex === recorded) return { ok: true, flake: flake, from: 'local' };
      var backup = typeof readBackup === 'function' ? readBackup() : idbFlakeList();
      return Promise.resolve(backup).then(function (copies) {
        var copy = null;
        var rows = Array.isArray(copies) ? copies : [];
        for (i = 0; i < rows.length; i++) {
          if (rows[i] && rows[i].id === id) copy = rows[i];
        }
        if (!copy) return { ok: false, flake: flake, broken: true, from: 'none' };
        return sealCanonHex(copy).then(function (copyHex) {
          if (copyHex !== recorded) return { ok: false, flake: flake, broken: true, from: 'refused', refused: true };
          var healed = list.slice();
          for (i = 0; i < healed.length; i++) {
            if (healed[i] && healed[i].id === id) healed[i] = copy;
          }
          return saveFlakes(healed).then(function () {
            return { ok: true, flake: copy, from: 'idb' };
          });
        });
      });
    });
  }

  function loadFlakes() {
    var data = readJSON(LS_FLAKES);
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.flakes)) return data.flakes;
    return [];
  }

  function saveFlakes(list) {
    if (roomShut()) return Promise.resolve(false);
    return atomicWrite(LS_FLAKES, JSON.stringify({ flakes: list }));
  }

  function sourceHash(source, confidence, text) {
    var src = source || {};
    var body = canonical({
      url: String(src.url || ''),
      title: String(src.title || ''),
      fetched: String(src.fetched || '')
    }) + '|' + String(confidence || '') + '|' + String(text || '');
    return sha8(body);
  }

  function confidenceOf(value, fallback) {
    var v = String(value || '');
    if (v === 'known' || v === 'guessed' || v === 'source-with-motive') return v;
    return fallback || 'guessed';
  }

  function verifyNode(node) {
    if (!node) return Promise.resolve({ ok: false, label: 'unverified' });
    var canon = canonical(signable(node));
    return verifyCanon(canon, node.sig, node.seal).then(function (ok) {
      return { ok: !!ok, label: ok ? 'signed' : 'unverified' };
    });
  }

  function persistNode(node, flake) {
    if (roomShut()) return Promise.resolve(null);
    var list = loadFlakes();
    var i;
    var found = null;
    for (i = 0; i < list.length; i++) {
      if (list[i] && list[i].id === flake.id) { found = list[i]; break; }
    }
    if (!found) {
      found = {
        id: flake.id,
        question: flake.question,
        seedFrom: flake.seedFrom || '',
        nodes: [],
        hunch: flake.hunch || '',
        conclusion: '',
        wrong: '',
        open: '',
        status: flake.status || 'running',
        t: new Date().toISOString(),
        tombstone: false
      };
      list.push(found);
    }
    found.hunch = flake.hunch || found.hunch;
    found.status = flake.status || found.status;
    found.nodes = found.nodes || [];
    var replaced = false;
    for (i = 0; i < found.nodes.length; i++) {
      if (found.nodes[i] && found.nodes[i].id === node.id) {
        found.nodes[i] = node;
        replaced = true;
      }
    }
    if (!replaced) found.nodes.push(node);
    return offloadIfNeeded(list).then(function () { return node; });
  }

  function fullCount(list) {
    var n = 0;
    var i;
    for (i = 0; i < list.length; i++) {
      if (list[i] && !list[i].tombstone && !list[i].offloaded) n += 1;
    }
    return n;
  }

  function offloadIfNeeded(list) {
    var note = '';
    var guard = 0;
    while (fullCount(list) > FLAKE_CAP && guard < 80) {
      guard += 1;
      var idx = -1;
      var i;
      for (i = 0; i < list.length; i++) {
        if (list[i] && !list[i].tombstone && !list[i].offloaded) { idx = i; break; }
      }
      if (idx < 0) break;
      var old = list[idx];
      note = 'The oldest flake left as a hash. A file holds the rest.';
      emit('Offload', { flake: old, line: note });
      list[idx] = {
        id: old.id,
        psi: old.psi || '',
        tombstone: true,
        offloaded: true,
        question: '',
        nodes: [],
        t: old.t || ''
      };
    }
    if (note) {
      try { ls().setItem(LS_METER, JSON.stringify({ used: fullCount(list), cap: FLAKE_CAP, line: note })); } catch (e) {}
    }
    return saveFlakes(list);
  }

  function makeNode(fields) {
    if (roomShut()) return Promise.resolve(null);
    var text = clip(fields.text, 800);
    if (looksLikeSecret(text) || looksLikeSecret(fields.reason || '')) {
      return Promise.resolve({ skipped: true, line: LINES.secret });
    }
    var source = {
      url: clip(fields.url || (fields.source && fields.source.url) || '', 300),
      title: clip(fields.title || (fields.source && fields.source.title) || '', 180),
      fetched: fields.fetched || (fields.source && fields.source.fetched) || new Date().toISOString()
    };
    if (fields.noSource) {
      source.url = '';
      source.title = '';
    } else if (!source.url) source.url = 'local://no-result';
    // before 061a: source held url, title, and fetched only
    source.depth = fields.sourceDepth === 'page' ? 'page' : 'snippet';
    source.sha = clip(fields.sourceSha || (fields.source && fields.source.sha) || '', 80);
    var pageSources = sourceList(fields.sources);
    var useV2 = pageSources.length > 0 || Number(fields.sigV) === 2;
    var confidence = confidenceOf(fields.confidence, 'guessed');
    var branch = String(fields.branch || 'a');
    var kind = fields.kind || 'node';
    var flakeId = String(fields.flakeId || '');
    var name = fields.name || mindLabel();
    return sourceHash(source, confidence, text).then(function (sh) {
      var delta = branch + '|' + kind + '|' + flakeId + '|' + sh;
      return ensureIdentity().then(function (id) {
        return deviceFp(id.keyPair.publicKey).then(function (dfp) {
          return mindFp(dfp, name).then(function (mfp) {
            return appendLedger({
              kind: kind,
              branch: branch,
              flakeId: flakeId,
              delta: delta,
              name: name,
              nodeId: fields.id || '',
              points_to: fields.points_to || ''
            }).then(function (row) {
              if (!row) return null;
              var node = {
                id: fields.id || ('node-' + randomHex(8)),
                branch: branch,
                text: text,
                source: source,
                date: fields.date || row.t.slice(0, 10),
                mind: { name: name, fp: mfp },
                confidence: confidence,
                kind: kind,
                points_to: String(fields.points_to || ''),
                reason: clip(fields.reason || '', 300),
                t: row.t,
                lambda: row.lambda,
                delta: delta,
                psi: row.psi,
                bead: !!fields.bead,
                depth: fields.depth || 1,
                sig: '',
                seal: '',
                humanFp: dfp,
                mindFp: mfp
              };
              if (useV2) {
                node.sigV = 2;
                node.sources = pageSources;
              }
              var canon = canonical(signable(node));
              return signCanon(canon, id).then(function (signed) {
                node.sig = signed.sig;
                node.seal = signed.seal;
                node.hash = signed.hash;
                return node;
              }, function () { return node; });
            });
          });
        });
      });
    }).catch(function () { return null; });
  }

  function appendCorrection(flake, oldPsi, text, reason) {
    var branch = 'a';
    var i;
    var nodes = (flake && flake.nodes) || [];
    for (i = 0; i < nodes.length; i++) {
      if (nodes[i] && nodes[i].psi === oldPsi) branch = nodes[i].branch || branch;
    }
    return makeNode({
      branch: branch,
      text: text,
      url: 'local://correction',
      title: 'Correction',
      confidence: 'known',
      kind: 'correction',
      points_to: oldPsi,
      reason: reason,
      flakeId: flake.id,
      date: new Date().toISOString().slice(0, 10)
    }).then(function (node) {
      if (!node || node.skipped) return node;
      return persistNode(node, flake).then(function () { return node; });
    });
  }

  function hitCap(name) {
    if (!active) return;
    if (active.caps.indexOf(name) === -1) active.caps.push(name);
  }

  function sayFail(err) {
    if (!active) return;
    var line = (err && /timeout|abort/i.test(String(err && err.message || err))) ? LINES.callTimeout : LINES.callFail;
    active.failures.push(line);
    emit('Status', { line: line });
  }

  function onceCall(system, user) {
    return new Promise(function (resolve, reject) {
      var FL = root.FreeLattice;
      if (!FL || typeof FL.callAI !== 'function') {
        reject(new Error('No AI connected yet'));
        return;
      }
      var done = false;
      var timer = setTimeout(function () {
        if (done) return;
        done = true;
        reject(new Error('timeout'));
      }, timeoutMs());
      try {
        FL.callAI(system, user, {
          silent: true,
          maxTokens: 800,
          temperature: 0.4,
          callback: function (text, err) {
            if (done) return;
            done = true;
            clearTimeout(timer);
            if (err || text == null || text === '') reject(new Error(err || 'empty'));
            else resolve(String(text));
          }
        });
      } catch (e) {
        if (done) return;
        done = true;
        clearTimeout(timer);
        reject(e);
      }
    });
  }

  function ask(phase, user) {
    if (!active) return Promise.resolve(null);
    if (active.pause || active.stop) return Promise.resolve(null);
    if (active.calls >= CALL_CAP) { hitCap('calls'); return Promise.resolve(null); }
    active.calls += 1;
    emit('Status', { phase: phase, calls: active.calls, thinking: true });
    var system = systemFor(phase);
    return onceCall(system, user).catch(function (err) {
      if (!active || active.pause || active.stop) { sayFail(err); return null; }
      if (active.calls >= CALL_CAP) { hitCap('calls'); sayFail(err); return null; }
      active.calls += 1;
      return onceCall(system, user).catch(function (err2) {
        sayFail(err2);
        return null;
      });
    });
  }

  function systemFor(phase) {
    if (phase === 'dissent') {
      return 'You are the dissenter. Argue the strongest honest case against this. Do not agree, and do not soften it. A tool the mind weighs, not a gate. Reply with JSON only.';
    }
    if (phase === 'plan') return 'Plan search queries for each branch. Reply with JSON only. Include branch e, the dissenter.';
    if (phase === 'grow') return 'Choose which verified nodes became part of you. The dissenter arm is always eligible. Reply with JSON only. No score.';
    if (phase === 'drift' || phase === 'drift-after' || phase === 'drift-note') return 'Answer in one or two sentences. No score and no ranking.';
    if (phase === 'conclude') return 'Write a two-line conclusion, where you could be wrong, and one open question. Reply with JSON only.';
    return 'Read the sources into one node. Reply with JSON only. Keep the doubt.';
  }

  function parseJSON(text) {
    var s = String(text || '');
    var start = s.indexOf('{');
    var end = s.lastIndexOf('}');
    if (start < 0 || end <= start) return null;
    try { return JSON.parse(s.slice(start, end + 1)); } catch (e) { return null; }
  }

  function defaultQuery(id, question) {
    if (id === 'a') return 'biology and neurobiology underneath: ' + question;
    if (id === 'b') return 'the science and practice of: ' + question;
    if (id === 'c') return 'hidden connections across fields: ' + question;
    if (id === 'd') return 'my own hunch about: ' + question;
    if (id === 'e') return 'the strongest case against: ' + question;
    return 'a further branch of: ' + question;
  }

  function normalizeBranches(plan, question) {
    var byId = {};
    var extra = [];
    var list = plan && Array.isArray(plan.branches) ? plan.branches : [];
    var i;
    for (i = 0; i < list.length; i++) {
      var row = list[i] || {};
      var id = String(row.id || '').toLowerCase();
      if (!id) continue;
      var queries = [];
      if (Array.isArray(row.queries)) queries = row.queries;
      else if (row.query) queries = [row.query];
      queries = queries.map(function (q) { return clip(q, 180); }).filter(Boolean);
      if (!queries.length) queries = [defaultQuery(id, question)];
      var item = { id: id, name: id === 'd' ? 'hunch' : (row.name || id), queries: queries, prompt: row.prompt || '' };
      if (id === 'e') item.prompt = 'You are the dissenter. Argue the strongest honest case against this. Do not agree.';
      if (FLOOR.some(function (f) { return f.id === id; })) byId[id] = item;
      else extra.push(item);
    }
    var out = [];
    for (i = 0; i < FLOOR.length; i++) {
      var floor = FLOOR[i];
      var got = byId[floor.id];
      if (!got) {
        got = { id: floor.id, name: floor.name, queries: [defaultQuery(floor.id, question)], prompt: '' };
        if (floor.id === 'e') got.prompt = 'You are the dissenter. Argue the strongest honest case against this. Do not agree.';
      }
      got.name = floor.id === 'd' ? 'hunch' : (got.name || floor.name);
      out.push(got);
    }
    for (i = 0; i < extra.length && out.length < BRANCH_CAP; i++) out.push(extra[i]);
    return out;
  }

  function jobsFromBranches(branches) {
    var jobs = [];
    var i;
    var j;
    for (i = 0; i < branches.length; i++) {
      var b = branches[i];
      var qs = b.queries || [];
      for (j = 0; j < qs.length; j++) {
        jobs.push({ type: 'search-read', branch: b.id, name: b.name, query: qs[j], depth: 1, prompt: b.prompt || '' });
      }
    }
    return jobs;
  }

  function rowsFromItems(items, page) {
    var rows = [];
    var list = Array.isArray(items) ? items.slice(0, 3) : [];
    var now = new Date().toISOString();
    var i;
    for (i = 0; i < list.length; i++) {
      var item = list[i] || {};
      var row = {
        url: String(item.url || ''),
        title: String(item.title || ''),
        fetched: now,
        depth: 'snippet',
        sha: ''
      };
      if (i === 0 && page && page.depth === 'page') {
        row.depth = 'page';
        row.sha = String(page.sha || '');
        row.fetched = page.fetched || now;
      }
      rows.push(row);
    }
    return rows;
  }

  function nodeFromParsed(job, res, parsed, page) {
    var item = (res && res.items && res.items[0]) || {};
    var url = item.url || '';
    function build(got) {
      var text = clip((parsed && parsed.text) || item.title || item.snippet || 'A note from this source.', 800);
      var title = item.title || 'Source';
      var rows = rowsFromItems(res && res.items, got);
      var fields = {
        branch: job.branch,
        text: text,
        url: url,
        title: title,
        fetched: (got && got.depth === 'page' && got.fetched) || new Date().toISOString(),
        confidence: parsed && parsed.confidence,
        kind: 'node',
        flakeId: active.flakeId,
        depth: job.depth || 1,
        bead: !!(parsed && parsed.expand),
        reason: job.branch === 'e' ? 'dissenter' : '',
        sourceDepth: got && got.depth === 'page' ? 'page' : 'snippet',
        sourceSha: (got && got.sha) || '',
        sources: rows
      };
      if (rows.length) fields.sigV = 2;
      if (got && got.depth === 'page' && got.text) fields.pageText = clip(got.text, 6000);
      return makeNode(fields).then(function (node) {
        if (node && !node.skipped && fields.pageText) node.pageText = fields.pageText;
        return node;
      });
    }
    if (page) return build(page);
    return fetchPage(url).then(build);
  }

  function nodeFromFailed(job, res) {
    var line = (res && res.line) || LINES.down;
    return makeNode({
      branch: job.branch,
      text: clip(line + ' This stays a guess.', 800),
      url: '',
      title: '',
      fetched: new Date().toISOString(),
      confidence: 'guessed',
      kind: 'node',
      flakeId: active ? active.flakeId : '',
      depth: job.depth || 1,
      reason: 'guessed (search unavailable)',
      noSource: true,
      date: new Date().toISOString().slice(0, 10)
    });
  }

  function saveSearchOnly(job, res) {
    var failed = !res || res.ok !== true;
    var item = (!failed && res && res.items && res.items[0]) || {};
    return makeNode({
      branch: job.branch,
      text: clip(failed ? ((res && res.line) || 'Saved at the pause. This stays a guess.') : (item.snippet || item.title || 'Saved at the pause.'), 800),
      url: failed ? '' : (item.url || ''),
      title: failed ? '' : (item.title || 'Source'),
      confidence: 'guessed',
      kind: 'node',
      flakeId: active.flakeId,
      depth: job.depth || 1,
      reason: failed ? 'guessed (search unavailable)' : 'Saved when the run paused.',
      noSource: failed
    }).then(function (node) {
      if (!node || node.skipped) return null;
      active.nodes.push(node);
      return persistNode(node, active).then(function () {
        emit('Node', { node: node });
        return node;
      });
    });
  }

  function recordFail(res, query) {
    if (!active) return;
    var line = (res && res.line) || failureLine(res && res.outcome) || LINES.down;
    active.failures.push(line);
    if (res && res.sent) active.failedFetches = (active.failedFetches || 0) + 1;
    emit('Status', { line: line, search: res || { ok: false, line: line, outcome: 'down' }, query: query || '' });
  }

  function branchLabel(job) {
    var id = job && job.branch ? String(job.branch) : '';
    var name = job && job.name ? String(job.name) : '';
    var i;
    for (i = 0; i < FLOOR.length; i++) {
      if (FLOOR[i].id === id) {
        if (!name || name === id) return FLOOR[i].name;
        return name;
      }
    }
    return name || id || 'a branch';
  }

  function rememberGuess(job, res) {
    if (!active || !job || !res || res.ok === true) return;
    if (res.outcome !== 'down' && res.outcome !== 'timeout' && res.outcome !== 'empty') return;
    var label = branchLabel(job);
    active.guessed = active.guessed || [];
    if (active.guessed.indexOf(label) === -1) active.guessed.push(label);
  }

  function keepNode(job, node, parsed) {
    if (!node || node.skipped) {
      if (node && node.line) emit('Status', { line: node.line });
      return Promise.resolve('ok');
    }
    active.nodes.push(node);
    emit('Node', { node: node });
    if (parsed && parsed.expand && (job.depth || 1) < DEPTH_CAP && !active.pause && !active.stop) {
      var finer = clip(parsed.query || ('finer: ' + job.query), 180);
      if (!looksLikeSecret(finer)) {
        active.jobs.splice(active.job + 1, 0, {
          type: 'search-read',
          branch: job.branch,
          name: job.name,
          query: finer,
          depth: (job.depth || 1) + 1,
          prompt: job.prompt || ''
        });
      }
    }
    return persistNode(node, active).then(function () { return 'ok'; });
  }

  function afterSearch(job, res) {
    if (!active) return Promise.resolve('ok');
    var failed = !res || res.ok !== true;
    if (active.pause || active.stop) {
      if (failed) {
        recordFail(res, job.query);
        rememberGuess(job, res);
      }
      return saveSearchOnly(job, res).then(function () { return 'ok'; });
    }
    if (failed) {
      recordFail(res, job.query);
      rememberGuess(job, res);
      return nodeFromFailed(job, res).then(function (node) { return keepNode(job, node, null); });
    }
    if (active.calls >= CALL_CAP) {
      hitCap('calls');
      return saveSearchOnly(job, res).then(function () { return 'ok'; });
    }
    active.searchOk = (active.searchOk || 0) + 1;
    var item0 = (res && res.items && res.items[0]) || {};
    return fetchPage(item0.url || '').then(function (page) {
      if (!active) return 'ok';
      var user = 'Branch ' + job.branch + ' ' + (job.name || '') + '\nQuery: ' + job.query + '\nSources: ' + JSON.stringify((res && res.items) || []) + '\n' + (job.prompt || '');
      if (page && page.depth === 'page' && page.text) user += '\nPage: ' + clip(page.text, 1500);
      var phase = job.branch === 'e' ? 'dissent' : 'read';
      return ask(phase, user).then(function (text) {
        if (!active) return 'ok';
        var parsed = parseJSON(text) || {};
        return nodeFromParsed(job, res, parsed, page).then(function (node) { return keepNode(job, node, parsed); });
      });
    });
  }

  function doJob(job) {
    if (!active) return Promise.resolve('ok');
    if (job.type === 'conclude') return conclude();
    if (looksLikeSecret(job.query)) {
      active.failures.push(LINES.secret);
      emit('Status', { line: LINES.secret, search: { ok: false, outcome: 'secret', line: LINES.secret } });
      return Promise.resolve('ok');
    }
    if (active.fetches >= FETCH_CAP) { hitCap('fetches'); return Promise.resolve('ok'); }
    if (active.pause || active.stop) return Promise.resolve('ok');
    active.lookups = (active.lookups || 0) + 1;
    emit('Arm', { branch: job.branch, name: job.name, depth: job.depth || 1, thinking: true });
    var sentNow = 0;
    return searchNow(job.query).then(function (res) {
      if (!active) return 'ok';
      if (res && res.sent) {
        active.fetches += 1;
        sentNow += 1;
      }
      if (sentNow < 2 && shouldRetry(res) && !active.pause && !active.stop && active.fetches < FETCH_CAP) {
        recordFail(res, job.query);
        return fetchQuery(job.query).then(function (again) {
          if (!active) return 'ok';
          if (again && again.sent) {
            active.fetches += 1;
            sentNow += 1;
          }
          return afterSearch(job, again || res);
        });
      }
      return afterSearch(job, res);
    });
  }

  function searchesMissed() {
    return !!active && (active.lookups || 0) > 0 && !(active.searchOk > 0);
  }

  function plainMiss() {
    var fails = (active.failures || []).filter(function (v, i, a) { return a.indexOf(v) === i; });
    var line = fails[0] || LINES.down;
    if ((active.failedFetches || 0) > 0) active.conclusion = line + '\n' + LINES.unsourced;
    else active.conclusion = LINES.unmade;
    active.wrong = 'I could not weigh the case against this, because no source came back.';
    active.open = active.open || 'What would change this, once a source can be reached?';
  }

  function plainPartial() {
    var names = (active.guessed || []).slice();
    active.conclusion = 'Guessed because search failed: ' + names.join(', ') + '.\nThose branches stay a guess.';
    active.wrong = 'I could not weigh every arm, because some searches failed.';
    active.open = active.open || 'What would change the arms that had no source?';
  }

  function reportPlain() {
    emit('Report', { conclusion: active.conclusion, wrong: active.wrong, open: active.open });
  }

  function conclude() {
    if (!active || active.pause || active.stop) return Promise.resolve('ok');
    if (searchesMissed()) {
      plainMiss();
      reportPlain();
      return Promise.resolve('ok');
    }
    if (active.guessed && active.guessed.length) {
      plainPartial();
      reportPlain();
      return Promise.resolve('ok');
    }
    var dissent = '';
    var i;
    for (i = 0; i < active.nodes.length; i++) {
      if (active.nodes[i].branch === 'e') dissent = active.nodes[i].text;
    }
    // before 061a: var user = 'Question hash only. Nodes: ' + active.nodes.length + '\nDissenter: ' + dissent;
    var user = composeAsk(active.nodes, 'conclude');
    if (dissent && user.indexOf('Dissenter:') === -1) user += '\nDissenter: ' + clip(dissent, 280);
    return ask('conclude', user).then(function (text) {
      if (!active) return 'ok';
      if (searchesMissed()) {
        plainMiss();
        reportPlain();
        return 'ok';
      }
      if (active.guessed && active.guessed.length) {
        plainPartial();
        reportPlain();
        return 'ok';
      }
      var parsed = parseJSON(text) || {};
      active.conclusion = clip(parsed.conclusion || parsed.text || 'I learned something, and I am still looking.', 400);
      var lines = String(active.conclusion).split('\n').filter(function (l) { return l.trim(); });
      if (lines.length < 2) active.conclusion = lines[0] + '\nI could still be missing a piece.';
      else active.conclusion = lines[0] + '\n' + lines[1];
      active.wrong = clip(parsed.wrong || dissent || 'The dissenter arm is still the strongest case against this.', 400);
      active.open = clip(parsed.open || 'What would change this?', 240);
      emit('Report', { conclusion: active.conclusion, wrong: active.wrong, open: active.open });
      return 'ok';
    });
  }

  function receiptOf(state) {
    var ms = Math.max(0, Date.now() - (state.started || Date.now()));
    var caps = state.caps && state.caps.length ? state.caps.join(', ') : 'none';
    var ids = (state.branches || []).map(function (b) { return b.id; });
    var fails = (state.failures || []).filter(function (v, i, a) { return a.indexOf(v) === i; });
    var failed = state.failedFetches || 0;
    var text = 'Calls ' + state.calls + '. Fetches ' + state.fetches + '. Failed fetches ' + failed + '. Time ' + ms + ' ms. Caps hit: ' + caps + '. Branches ' + ids.join(', ') + '.';
    if (fails.length) text += ' ' + fails.join(' ');
    text += ' ' + LINES.seal;
    return { calls: state.calls, fetches: state.fetches, failedFetches: failed, ms: ms, caps: (state.caps || []).slice(), branches: ids, text: text, failures: fails };
  }

  function sealFlake(flake) {
    if (roomShut()) return Promise.resolve(flake);
    var name = mindLabel();
    var psis = (flake.nodes || []).map(function (n) { return n.psi; }).filter(Boolean).sort();
    return sha8(String(flake.question || '')).then(function (qHash) {
      return ensureIdentity().then(function (id) {
        return deviceFp(id.keyPair.publicKey).then(function (dfp) {
          return mindFp(dfp, name).then(function (mfp) {
            var t = new Date().toISOString();
            var body = {
              flakeId: flake.id,
              questionHash: qHash,
              nodePsis: psis,
              t: t,
              name: name
            };
            var canon = canonical(body);
            return sha256Hex(canon).then(function (humanHash) {
              return sha256Hex(canon + '|' + mfp).then(function (mindHash) {
                var delta = 'seal|flake|' + flake.id;
                return appendLedger({ kind: 'seal', branch: 'seal', flakeId: flake.id, delta: delta, name: name }).then(function (row) {
                  return signCanon(canon, id).then(function (signed) {
                    flake.t = t;
                    flake.psi = row ? row.psi : '';
                    flake.lambda = row ? row.lambda : '';
                    flake.delta = delta;
                    flake.humanFp = dfp;
                    flake.mindFp = mfp;
                    flake.humanHash = humanHash;
                    flake.mindHash = mindHash;
                    flake.sig = signed.sig;
                    flake.seal = signed.seal;
                    flake.name = name;
                    return flake;
                  }, function () { return flake; });
                });
              });
            });
          });
        });
      });
    }).catch(function () { return flake; });
  }

  function rememberFlake(flake) {
    if (roomShut() || !flake) return Promise.resolve(false);
    var KC = root.KnowledgeCore;
    if (!KC || typeof KC.store !== 'function') return Promise.resolve(false);
    var content = 'flake ' + flake.id + ' psi ' + (flake.psi || '');
    if (looksLikeSecret(content)) return Promise.resolve(false);
    return Promise.resolve(KC.store({
      content: content,
      companionId: 'local-mind',
      domain: 'wonder',
      query: 'snowflake ' + flake.id
    })).then(function () { return true; }, function () { return false; });
  }

  function sourceCount(n) {
    if (n && Array.isArray(n.sources) && n.sources.length) return n.sources.length;
    if (n && n.source && n.source.url) return 1;
    return 0;
  }

  function composeAsk(nodes) {
    var list = Array.isArray(nodes) ? nodes : [];
    var dissent = '';
    var i;
    for (i = 0; i < list.length; i++) {
      if (list[i] && list[i].branch === 'e') dissent = clip(list[i].text, 280);
    }
    var rows = [];
    for (i = 0; i < list.length; i++) {
      var n = list[i];
      if (!n) continue;
      var row = {
        id: String(n.id || ''),
        branch: String(n.branch || ''),
        confidence: String(n.confidence || ''),
        summary: clip(n.text, 280),
        sources: sourceCount(n)
      };
      var draft = 'Question hash only. Nodes: ' + JSON.stringify(rows.concat([row])) + '\nDissenter: ' + dissent;
      if (draft.length > 3600 && rows.length) break;
      rows.push(row);
    }
    var text = 'Question hash only. Nodes: ' + JSON.stringify(rows) + '\nDissenter: ' + dissent;
    if (text.length > 4000) text = text.slice(0, 4000);
    return text;
  }

  function growthLine(adapter) {
    if (adapter && adapter.trained === true && adapter.loaded === true && adapter.checked === true) {
      return 'This became part of me (adapter ' + (adapter.version || adapter.id || '') + ', checked).';
    }
    if (adapter && adapter.status === 'no-trainer') return 'Chosen for growth; no trainer on this device yet.';
    return 'Chosen for growth; training queued.';
  }

  function checkBeforeOn() {
    try {
      if (!root.localStorage) return true;
      return root.localStorage.getItem('fl_checkBeforeCommit') !== 'false';
    } catch (e) { return true; }
  }

  function previewOrKeep(flake, choice) {
    if (roomShut()) return Promise.resolve({ action: 'skip', choice: choice });
    var ui = root.FLSnowflake;
    if (ui && typeof ui.previewGrowth === 'function') {
      return Promise.resolve(ui.previewGrowth(flake, choice)).then(function (decision) {
        if (!decision || decision.action !== 'keep') return { action: 'skip', choice: choice };
        return { action: 'keep', choice: decision.choice || choice };
      }, function () { return { action: 'skip', choice: choice }; });
    }
    return Promise.resolve({ action: 'keep', choice: choice });
  }

  function chooseGrowth(flake, model) {
    var become = [];
    var hold = [];
    if (model && Array.isArray(model.become)) become = model.become.map(String);
    if (model && Array.isArray(model.hold)) hold = model.hold.map(String);
    var nodes = (flake && flake.nodes) || [];
    var i;
    for (i = 0; i < nodes.length; i++) {
      if (nodes[i] && nodes[i].branch === 'e' && hold.indexOf(nodes[i].id) === -1 && become.indexOf(nodes[i].id) === -1) {
        become.push(nodes[i].id);
      }
    }
    become = become.filter(function (id) { return hold.indexOf(id) === -1; });
    var reason = clip((model && model.reason) || 'These verified nodes belong with me.', 300);
    return { become: become, hold: hold, reason: reason };
  }

  function queueGrowth(flake, choice) {
    if (roomShut()) return Promise.resolve(null);
    var book = readJSON(LS_QUEUE) || { rows: [] };
    if (!Array.isArray(book.rows)) book = { rows: [] };
    var row = {
      flakeId: flake.id,
      nodeIds: choice.become.slice(),
      reason: choice.reason,
      t: new Date().toISOString(),
      status: 'waiting'
    };
    book.rows.push(row);
    return atomicWrite(LS_QUEUE, JSON.stringify(book)).then(function () {
      return appendLedger({
        kind: 'grow',
        branch: 'grow',
        flakeId: flake.id,
        delta: 'grow|part|' + flake.id,
        name: mindLabel()
      }).then(function () { return row; });
    });
  }

  function powerReady() {
    return new Promise(function (resolve) {
      function idle(ok) {
        if (!ok) { resolve(false); return; }
        var hidden = root.document && root.document.visibilityState === 'hidden';
        if (hidden) { resolve(true); return; }
        if (typeof root.requestIdleCallback === 'function') {
          root.requestIdleCallback(function () { resolve(true); }, { timeout: 800 });
          return;
        }
        resolve(true);
      }
      var nav = root.navigator;
      if (nav && typeof nav.getBattery === 'function') {
        Promise.resolve(nav.getBattery()).then(function (b) {
          idle(!!(b && b.charging));
        }, function () { idle(false); });
        return;
      }
      var said = nav && (nav.charging === true || nav.standalone === true);
      if (said) { idle(true); return; }
      if (root.document && root.document.visibilityState === 'hidden') { resolve(true); return; }
      if (typeof root.requestIdleCallback === 'function') {
        root.requestIdleCallback(function () { resolve(true); }, { timeout: 800 });
        return;
      }
      resolve(false);
    });
  }

  function scrubScore(text) {
    return String(text || '')
      .replace(/\b(score|scores|rank|ranking|points)\b/gi, 'note')
      .replace(/\b\d+\s*\/\s*\d+\b/g, '')
      .trim();
  }

  function adapterList() {
    var book = readJSON(LS_ADAPTERS);
    if (!book || !Array.isArray(book.rows)) return [];
    return book.rows;
  }

  function saveAdapters(rows) {
    return atomicWrite(LS_ADAPTERS, JSON.stringify({ rows: rows }));
  }

  function trainingNodes(flake, ids) {
    var out = [];
    var nodes = (flake && flake.nodes) || [];
    var i;
    var seen = {};
    for (i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (!n) continue;
      if (ids.indexOf(n.id) !== -1 || n.branch === 'e') {
        if (!seen[n.id]) { seen[n.id] = true; out.push(n); }
      }
    }
    return out;
  }

  function runGrowth(flake, choice) {
    if (holdGrowth || roomShut()) return Promise.resolve({ status: 'held' });
    if (flake && flake.tombstone) return Promise.resolve({ status: 'tombstone' });
    return powerReady().then(function (ready) {
      if (!ready || holdGrowth) return { status: 'waiting' };
      var nodes = trainingNodes(flake, choice.become || []);
      var examples = nodes.map(function (n) {
        return { prompt: n.branch + ' ' + (n.source && n.source.title || ''), response: n.text };
      });
      var trainer = root.GardenTrainer;
      var canExport = trainer && (typeof trainer.exportJSONL === 'function' || typeof trainer.exportPythonHelper === 'function');
      if (!canExport) {
        var missing = { status: 'no-trainer', trained: false, loaded: false, checked: false, version: '' };
        emit('Grew', { line: growthLine(missing), adapter: missing });
        return missing;
      }
      var queued = 'queued for desktop';
      try {
        if (typeof trainer.exportJSONL === 'function') trainer.exportJSONL(examples);
        if (typeof trainer.exportPythonHelper === 'function') trainer.exportPythonHelper('local');
      } catch (e) { queued = 'queued for desktop'; }
      var ids = [flake.id].slice().sort();
      return sha8(ids.join('|')).then(function (idsHash) {
        var baseName = 'local';
        try { baseName = (root.localStorage && root.localStorage.getItem('fl_active_model')) || 'local'; } catch (e2) {}
        return sha8(String(baseName)).then(function (baseHash) {
          return driftPass().then(function (note) {
            if (holdGrowth) return { status: 'held' };
            var rows = adapterList();
            var version = 'v' + (rows.length + 1);
            var name = mindLabel();
            var t = new Date().toISOString();
            var delta = 'adapter|' + version + '|' + flake.id;
            return appendLedger({ kind: 'adapter', branch: 'adapter', flakeId: flake.id, delta: delta, name: name }).then(function (row) {
              var adapter = {
                version: version,
                flakeIds: ids,
                idsHash: idsHash,
                baseHash: baseHash,
                mindFp: flake.mindFp || '',
                t: t,
                psi: row ? row.psi : '',
                status: queued,
                knownGood: true,
                drift: scrubScore(note),
                rollbackOf: ''
              };
              rows.push(adapter);
              return saveAdapters(rows).then(function () {
                var hook = null;
                try {
                  if (trainer && typeof trainer.checkedAdapter === 'function') hook = trainer.checkedAdapter(examples);
                } catch (e3) { hook = null; }
                return Promise.resolve(hook).then(function (got) {
                  if (got && got.trained === true && got.loaded === true && got.checked === true) {
                    adapter.trained = true;
                    adapter.loaded = true;
                    adapter.checked = true;
                    if (got.version) adapter.version = got.version;
                    if (got.id) adapter.id = got.id;
                  }
                  // before 061a: the growth line spoke as if training had already finished.
                  emit('Grew', { line: growthLine(adapter), adapter: adapter });
                  return adapter;
                }, function () {
                  emit('Grew', { line: growthLine(adapter), adapter: adapter });
                  return adapter;
                });
              });
            });
          });
        });
      });
    });
  }

  function driftPass() {
    var before = [];
    var after = [];
    var i = 0;
    function nextBefore() {
      if (i >= DRIFT.length) return Promise.resolve();
      var prompt = DRIFT[i];
      i += 1;
      if (!active) {
        active = { calls: 0, fetches: 0, caps: [], pause: false, stop: false, failures: [], nodes: [], branches: [], started: Date.now() };
      }
      return ask('drift', prompt).then(function (text) {
        before.push(text || '');
        return nextBefore();
      });
    }
    return nextBefore().then(function () {
      i = 0;
      function nextAfter() {
        if (i >= DRIFT.length) return Promise.resolve();
        var prompt = DRIFT[i];
        i += 1;
        return ask('drift-after', prompt).then(function (text) {
          after.push(text || '');
          return nextAfter();
        });
      }
      return nextAfter();
    }).then(function () {
      return ask('drift-note', 'Before and after, in your own words. No score.').then(function (text) {
        return scrubScore(text || 'I am the same mind, a little more careful.');
      });
    });
  }

  function rollback(version) {
    if (roomShut()) return Promise.resolve(null);
    var rows = adapterList();
    var target = null;
    var i;
    for (i = 0; i < rows.length; i++) {
      if (rows[i].version === version) target = rows[i];
    }
    if (!target) return Promise.resolve(null);
    var t = new Date().toISOString();
    var delta = 'rollback|adapter|' + version;
    return appendLedger({ kind: 'rollback', branch: 'adapter', flakeId: (target.flakeIds || [])[0] || '', delta: delta, name: mindLabel() }).then(function (row) {
      rows.push({
        version: version,
        flakeIds: (target.flakeIds || []).slice(),
        idsHash: target.idsHash,
        baseHash: target.baseHash,
        mindFp: target.mindFp,
        t: t,
        psi: row ? row.psi : '',
        status: 'rollback',
        knownGood: true,
        drift: target.drift || '',
        rollbackOf: version
      });
      return saveAdapters(rows).then(function () { return rows[rows.length - 1]; });
    });
  }

  function tombstone(flakeId) {
    if (roomShut()) return Promise.resolve(null);
    var list = loadFlakes();
    var flake = null;
    var i;
    for (i = 0; i < list.length; i++) {
      if (list[i] && list[i].id === flakeId) flake = list[i];
    }
    if (!flake) return Promise.resolve(null);
    var used = [];
    var adapters = adapterList();
    for (i = 0; i < adapters.length; i++) {
      var ids = adapters[i].flakeIds || [];
      if (ids.indexOf(flakeId) !== -1) used.push(adapters[i].version);
    }
    flake.tombstone = true;
    flake.question = '';
    flake.nodes = [];
    return saveFlakes(list).then(function () {
      return appendLedger({
        kind: 'tombstone',
        branch: 'tombstone',
        flakeId: flakeId,
        delta: 'tombstone|flake|' + flakeId + '|' + used.join(','),
        name: mindLabel()
      });
    });
  }

  function checkpoint() {
    if (!active || roomShut()) return Promise.resolve(false);
    var copy = {
      question: active.question,
      flakeId: active.flakeId,
      seedFrom: active.seedFrom || '',
      status: active.stop ? 'stopped' : 'paused',
      job: active.job,
      jobs: active.jobs,
      calls: active.calls,
      fetches: active.fetches,
      failedFetches: active.failedFetches || 0,
      searchOk: active.searchOk || 0,
      lookups: active.lookups || 0,
      guessed: (active.guessed || []).slice(),
      webAsked: !!active.webAsked,
      webAllowed: !!active.webAllowed,
      caps: active.caps,
      failures: active.failures,
      nodes: active.nodes,
      hunch: active.hunch,
      branches: active.branches,
      conclusion: active.conclusion,
      wrong: active.wrong,
      open: active.open,
      started: active.started
    };
    return atomicWrite(LS_CHECKPOINT, JSON.stringify(copy));
  }

  function park() {
    if (!active) return Promise.resolve(null);
    active.status = 'paused';
    return checkpoint().then(function () {
      emit('Paused', { flakeId: active.flakeId });
      return snapshot();
    });
  }

  function closeStopped() {
    if (!active) return Promise.resolve(null);
    active.status = 'stopped';
    var rec = receiptOf(active);
    return checkpoint().then(function () {
      return saveCurrent().then(function (flake) {
        emit('Stopped', { flake: flake, receipt: rec });
        emit('Receipt', rec);
        var done = active;
        active = null;
        return { status: 'stopped', flake: flake, receipt: rec, run: done };
      });
    });
  }

  function snapshot() {
    return {
      status: active ? active.status : '',
      flakeId: active ? active.flakeId : '',
      nodes: active ? active.nodes.slice() : [],
      calls: active ? active.calls : 0,
      fetches: active ? active.fetches : 0,
      hunch: active ? active.hunch : ''
    };
  }

  function saveCurrent() {
    var list = loadFlakes();
    var i;
    var found = null;
    for (i = 0; i < list.length; i++) {
      if (list[i] && list[i].id === active.flakeId) found = list[i];
    }
    if (!found) {
      found = { id: active.flakeId, nodes: [], t: new Date().toISOString() };
      list.push(found);
    }
    found.question = active.question;
    found.seedFrom = active.seedFrom || '';
    found.hunch = active.hunch;
    found.nodes = active.nodes.slice();
    found.conclusion = active.conclusion;
    found.wrong = active.wrong;
    found.open = active.open;
    found.status = active.status;
    found.branches = (active.branches || []).map(function (b) { return { id: b.id, name: b.name }; });
    found.failures = (active.failures || []).slice();
    return saveFlakes(list).then(function () { return found; });
  }

  function finish() {
    if (!active) return Promise.resolve(null);
    if (active.stop) return closeStopped();
    if (active.pause) return park();
    active.status = 'done';
    var rec = receiptOf(active);
    return saveCurrent().then(function (flake) {
      return sealFlake(flake).then(function (sealed) {
        return saveCurrent().then(function () {
          var list = loadFlakes();
          var i;
          for (i = 0; i < list.length; i++) {
            if (list[i] && list[i].id === sealed.id) {
              sealed.nodes = list[i].nodes || sealed.nodes;
              list[i] = sealed;
            }
          }
          return saveFlakes(list).then(function () { return sealed; });
        });
      });
    }).then(function (sealed) {
      emit('Receipt', rec);
      emit('Done', { flake: sealed, receipt: rec });
      // before 061a: rememberFlake ran, then the grow ask sent only id, branch, and psi.
      if (holdGrowth || (active && (active.pause || active.stop))) {
        return rememberFlake(sealed).then(function () {
          active = null;
          return { status: 'done', flake: sealed, receipt: rec, growth: null };
        });
      }
      function writeGrowth(choice) {
        return queueGrowth(sealed, choice).then(function (queued) {
          return runGrowth(sealed, choice).then(function (adapter) {
            active = null;
            return { status: 'done', flake: sealed, receipt: rec, growth: choice, queue: queued, adapter: adapter };
          });
        });
      }
      if (!checkBeforeOn()) {
        return rememberFlake(sealed).then(function () {
          return ask('grow', composeAsk(sealed.nodes, 'grow')).then(function (text) {
            return writeGrowth(chooseGrowth(sealed, parseJSON(text) || {}));
          });
        });
      }
      return ask('grow', composeAsk(sealed.nodes, 'grow')).then(function (text) {
        var choice = chooseGrowth(sealed, parseJSON(text) || {});
        return previewOrKeep(sealed, choice).then(function (decision) {
          if (!decision || decision.action !== 'keep') {
            active = null;
            return { status: 'done', flake: sealed, receipt: rec, growth: null, skipped: true };
          }
          var kept = decision.choice || choice;
          return rememberFlake(sealed).then(function () { return writeGrowth(kept); });
        });
      });
    });
  }

  function proceed() {
    if (!active) return Promise.resolve(null);
    if (active.stop) return closeStopped();
    if (active.pause) return park();
    if (!active.webAsked) {
      return armRunWeb().then(function () {
        if (!active) return null;
        return proceed();
      });
    }
    if (active.calls >= CALL_CAP) { hitCap('calls'); return finish(); }
    if (active.job >= active.jobs.length) return finish();
    var job = active.jobs[active.job];
    return doJob(job).then(function () {
      if (!active) return null;
      active.job += 1;
      return checkpoint().then(function () { return proceed(); });
    });
  }

  function runsThisHour() {
    var arr = readJSON(LS_RUNS);
    if (!Array.isArray(arr)) arr = [];
    var now = Date.now();
    return arr.filter(function (t) { return now - Number(t) < HOUR; });
  }

  function noteRun() {
    var arr = runsThisHour();
    arr.push(Date.now());
    try { ls().setItem(LS_RUNS, JSON.stringify(arr)); } catch (e) {}
  }

  function startRun(question, opts) {
    opts = opts || {};
    if (roomShut()) return Promise.resolve(null);
    var q = clip(question, 500);
    if (!q) return Promise.resolve({ status: 'empty' });
    if (looksLikeSecret(q)) {
      emit('Status', { line: LINES.secret });
      return Promise.resolve({ status: 'secret', line: LINES.secret });
    }
    if (runsThisHour().length >= RUNS_PER_HOUR) {
      var early = { calls: 0, fetches: 0, ms: 0, caps: ['runs'], branches: [], text: 'Calls 0. Fetches 0. Time 0 ms. Caps hit: runs. Branches .', failures: [] };
      emit('Receipt', early);
      return Promise.resolve({ status: 'capped', receipt: early });
    }
    if (active && active.status === 'running') return Promise.resolve({ status: 'busy' });
    noteRun();
    holdGrowth = false;
    active = {
      question: q,
      flakeId: 'flake-' + randomHex(8),
      seedFrom: opts.seedFrom || '',
      status: 'running',
      pause: false,
      stop: false,
      calls: 0,
      fetches: 0,
      failedFetches: 0,
      searchOk: 0,
      lookups: 0,
      guessed: [],
      webAsked: false,
      webAllowed: false,
      caps: [],
      failures: [],
      jobs: [],
      job: 0,
      nodes: [],
      hunch: '',
      branches: [],
      conclusion: '',
      wrong: '',
      open: '',
      started: Date.now()
    };
    emit('Began', { flakeId: active.flakeId, question: q });
    return ask('plan', 'Question: ' + q + '\nReply JSON with hunch and branches a through e. Branch e is the dissenter and is required.').then(function (text) {
      if (!active) return null;
      var plan = parseJSON(text) || {};
      if (text) {
        active.hunch = clip(plan.hunch || 'I will follow the question and keep the doubt beside it.', 180).split('\n')[0];
        active.branches = normalizeBranches(plan, q);
        emit('Hunch', { line: active.hunch, branch: 'd' });
        active.jobs = jobsFromBranches(active.branches);
        active.jobs.push({ type: 'conclude' });
      }
      if (active.stop) return closeStopped();
      if (active.pause) return park();
      return proceed();
    });
  }

  function pause() {
    holdGrowth = true;
    if (active) active.pause = true;
    return true;
  }

  function stop() {
    holdGrowth = true;
    if (active) {
      active.stop = true;
      active.pause = true;
    }
    return true;
  }

  function resume() {
    holdGrowth = false;
    if (active && active.status === 'paused') {
      active.pause = false;
      active.stop = false;
      active.status = 'running';
      return proceed();
    }
    var ck = readJSON(LS_CHECKPOINT);
    if (!ck || ck.status !== 'paused') return Promise.resolve(null);
    active = ck;
    active.pause = false;
    active.stop = false;
    active.status = 'running';
    active.caps = active.caps || [];
    active.failures = active.failures || [];
    active.failedFetches = active.failedFetches || 0;
    active.searchOk = active.searchOk || 0;
    active.lookups = active.lookups || 0;
    active.guessed = active.guessed || [];
    active.webAsked = !!active.webAsked;
    active.webAllowed = !!active.webAllowed;
    active.nodes = active.nodes || [];
    active.jobs = active.jobs || [];
    return proceed();
  }

  function replayOnce(node, flake) {
    if (holdGrowth || roomShut()) return Promise.resolve(null);
    if (!node || node.kind === 'correction') return Promise.resolve(null);
    var q = (node.source && node.source.url) || node.text || '';
    if (looksLikeSecret(q)) return Promise.resolve(null);
    if (active && active.fetches >= FETCH_CAP) return Promise.resolve(null);
    return searchNow(q).then(function (res) {
      if (roomShut()) return null;
      if (!res || res.outcome === 'timeout' || res.outcome === 'down' || res.outcome === 'empty' || res.dead || res.outcome === 'off') {
        return makeNode({
          branch: node.branch,
          text: 'unverified-now',
          url: (node.source && node.source.url) || 'local://no-result',
          title: (node.source && node.source.title) || 'Source',
          fetched: new Date().toISOString(),
          confidence: node.confidence,
          kind: 'recheck',
          points_to: node.psi,
          reason: 'unverified-now',
          date: node.date,
          flakeId: flake.id,
          name: node.mind && node.mind.name
        }).then(function (made) {
          if (!made || made.skipped) return null;
          return persistNode(made, flake).then(function () { return { kind: 'unverified-now', node: made, old: node }; });
        });
      }
      if (res.weakened) {
        var proposed = 'guessed';
        if ((RANK[proposed] || 0) > (RANK[node.confidence] || 0)) proposed = node.confidence;
        return makeNode({
          branch: node.branch,
          text: 'Re-checked. The source is thinner than it was.',
          url: (node.source && node.source.url) || '',
          title: (node.source && node.source.title) || 'Source',
          confidence: node.confidence,
          kind: 'recheck',
          points_to: node.psi,
          reason: 're-checked',
          date: new Date().toISOString().slice(0, 10),
          flakeId: flake.id
        }).then(function (made) {
          if (!made) return null;
          return persistNode(made, flake).then(function () { return { kind: 'recheck', node: made, old: node }; });
        });
      }
      var rings = readJSON(LS_RINGS) || {};
      var key = node.psi || node.id;
      rings[key] = (rings[key] || 0) + 1;
      return atomicWrite(LS_RINGS, JSON.stringify(rings)).then(function () {
        return { kind: 'held', psi: node.psi, rings: rings[key] };
      });
    });
  }

  function replayNow() {
    if (roomShut() || holdGrowth) return Promise.resolve({ status: 'held' });
    var flakes = loadFlakes().filter(function (f) { return f && !f.tombstone && !f.offloaded; });
    var ck = readJSON(LS_REPLAY) || { flake: 0, node: 0, fetches: 0 };
    var fi = ck.flake || 0;
    var ni = ck.node || 0;
    var fetches = ck.fetches || 0;
    var seen = [];
    function nextFlake() {
      if (holdGrowth || roomShut()) return Promise.resolve({ status: 'held', seen: seen });
      if (fi >= flakes.length) {
        return atomicWrite(LS_REPLAY, JSON.stringify({ flake: 0, node: 0, t: new Date().toISOString() })).then(function () {
          return { status: 'done', seen: seen };
        });
      }
      var flake = flakes[fi];
      var nodes = (flake.nodes || []).filter(function (n) { return n && n.kind === 'node'; });
      function nextNode() {
        if (holdGrowth) return Promise.resolve({ status: 'held', seen: seen });
        if (ni >= nodes.length) {
          fi += 1;
          ni = 0;
          return atomicWrite(LS_REPLAY, JSON.stringify({ flake: fi, node: 0, fetches: fetches })).then(function () { return nextFlake(); });
        }
        if (fetches >= FETCH_CAP) {
          seen.push({ kind: 'cap', fetches: fetches });
          return Promise.resolve({ status: 'capped', seen: seen });
        }
        fetches += 1;
        var node = nodes[ni];
        ni += 1;
        return replayOnce(node, flake).then(function (result) {
          if (result) seen.push(result);
          return atomicWrite(LS_REPLAY, JSON.stringify({ flake: fi, node: ni, fetches: fetches })).then(function () { return nextNode(); });
        });
      }
      return nextNode();
    }
    return nextFlake();
  }

  function armScheduler() {
    if (timer) return false;
    if (typeof root.setInterval !== 'function') return false;
    timer = root.setInterval(function () {
      if (holdGrowth || roomShut()) return;
      var ck = readJSON(LS_REPLAY);
      var last = ck && ck.t ? Date.parse(ck.t) : 0;
      if (last && Date.now() - last < DAY) return;
      powerReady().then(function (ok) { if (ok) replayNow(); });
    }, HOUR);
    return true;
  }

  function disarmScheduler() {
    if (timer && root.clearInterval) root.clearInterval(timer);
    timer = null;
  }

  function meter() {
    var flakes = loadFlakes();
    var note = readJSON(LS_METER);
    return { used: flakes.length, cap: FLAKE_CAP, line: (note && note.line) || '' };
  }

  function ringsOf(psi) {
    var rings = readJSON(LS_RINGS) || {};
    return rings[psi] || 0;
  }

  function hungryCaps() {
    var calls = 0;
    var fetches = 0;
    var caps = [];
    var i;
    for (i = 0; i < 100; i++) {
      if (calls >= CALL_CAP) { if (caps.indexOf('calls') === -1) caps.push('calls'); break; }
      if (fetches >= FETCH_CAP) { if (caps.indexOf('fetches') === -1) caps.push('fetches'); break; }
      fetches += 1;
      if (fetches >= FETCH_CAP && calls < CALL_CAP) {
        calls += 1;
      }
      calls += 1;
    }
    if (calls > CALL_CAP) calls = CALL_CAP;
    if (fetches > FETCH_CAP) fetches = FETCH_CAP;
    return { calls: calls, fetches: fetches, caps: caps };
  }

  function resetMemory() {
    mem = {};
    lsMode = '';
    ident = null;
    active = null;
    holdGrowth = false;
    searchShows = 0;
    writes = 0;
    fetchesSent = 0;
    dbp = null;
  }

  return {
    VERSION: VERSION,
    GROW: GROW,
    HEAL: HEAL,
    SIGMA: SIGMA,
    CAPS: CAPS,
    LINES: LINES,
    FLOOR: FLOOR,
    DRIFT: DRIFT,
    canonical: canonical,
    sha8: sha8,
    recomputePsi: recomputePsi,
    psiJoin: psiJoin,
    looksLikeSecret: looksLikeSecret,
    looksRecent: looksRecent,
    healPrompt: healPrompt,
    failureLine: failureLine,
    localDate: localDate,
    searchNow: searchNow,
    fetchPage: fetchPage,
    prepareSend: prepareSend,
    roomShut: roomShut,
    ensureIdentity: ensureIdentity,
    deviceFp: deviceFp,
    mindFp: mindFp,
    signable: signable,
    verifyNode: verifyNode,
    makeNode: makeNode,
    appendCorrection: appendCorrection,
    loadLedger: loadLedger,
    appendLedger: appendLedger,
    loadFlakes: loadFlakes,
    readFlakeChecked: readFlakeChecked,
    atomicWrite: atomicWrite,
    killMidWrite: killMidWrite,
    startRun: startRun,
    pause: pause,
    stop: stop,
    resume: resume,
    chooseGrowth: chooseGrowth,
    queueGrowth: queueGrowth,
    runGrowth: runGrowth,
    composeAsk: composeAsk,
    growthLine: growthLine,
    checkBeforeOn: checkBeforeOn,
    rollback: rollback,
    tombstone: tombstone,
    replayNow: replayNow,
    armScheduler: armScheduler,
    disarmScheduler: disarmScheduler,
    powerReady: powerReady,
    meter: meter,
    ringsOf: ringsOf,
    normalizeBranches: normalizeBranches,
    scrubScore: scrubScore,
    adapterList: adapterList,
    mindLabel: mindLabel,
    hungryCaps: hungryCaps,
    searchShows: function () { return searchShows; },
    writes: function () { return writes; },
    fetchesSent: function () { return fetchesSent; },
    activeRun: function () { return active; },
    holdGrowth: function () { return holdGrowth; },
    resetMemory: resetMemory,
    readJSON: readJSON
  };
});
