/* FreeLattice: self-healing and capture windows v0.1 (window.FLSelfHeal)
   Marker: v-self-heal-v0.1
   Pieces keep their own hashes. A bad piece is fetched again. A good piece stays.
   Capture windows are experimental and local. Nothing here trains.
*/
(function (root) {
  'use strict';

  var VERSION = 'v-self-heal-v0.1';
  var PIECE = 64 * 1024;
  var LEDGER_KEY = 'fl_healLedger';
  var WINDOW_KEY = 'fl_captureWindows';
  var MEASURE_KEY = 'fl_healMeasure';
  var MAX_TRIES = 3;
  var LABEL = "Experimental: Kirk's hypothesis that trim moments are the best time to learn. Being measured, not assumed.";
  var mem = {};

  function bucket() {
    try {
      if (root.localStorage && typeof root.localStorage.getItem === 'function') return root.localStorage;
    } catch (e) {}
    return {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; },
      setItem: function (k, v) { mem[k] = String(v); },
      removeItem: function (k) { delete mem[k]; }
    };
  }

  function readList(key) {
    try {
      var raw = bucket().getItem(key);
      if (!raw) return [];
      var data = JSON.parse(raw);
      return Array.isArray(data) ? data : [];
    } catch (e) { return []; }
  }

  function writeList(key, rows) {
    try { bucket().setItem(key, JSON.stringify(rows)); return true; } catch (e) { return false; }
  }

  function toUint8(bytes) {
    if (bytes instanceof Uint8Array) return bytes;
    if (bytes instanceof ArrayBuffer) return new Uint8Array(bytes);
    if (typeof Buffer !== 'undefined' && Buffer.isBuffer && Buffer.isBuffer(bytes)) {
      return new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    }
    if (Array.isArray(bytes)) return new Uint8Array(bytes);
    return new Uint8Array(0);
  }

  function isBytes(value) {
    return value instanceof Uint8Array || value instanceof ArrayBuffer ||
      (typeof Buffer !== 'undefined' && Buffer.isBuffer && Buffer.isBuffer(value));
  }

  function hexOf(buf) {
    var bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    var out = '';
    var i;
    for (i = 0; i < bytes.length; i++) out += ('0' + bytes[i].toString(16)).slice(-2);
    return out;
  }

  function sha256Hex(data) {
    var bytes = typeof data === 'string' ? new TextEncoder().encode(data) : toUint8(data);
    var copy = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    var subtle = root.crypto && root.crypto.subtle;
    if (subtle && typeof subtle.digest === 'function') {
      return subtle.digest('SHA-256', copy).then(function (digest) { return hexOf(digest); });
    }
    if (typeof require === 'function') {
      try {
        var nodeCrypto = require('crypto');
        return Promise.resolve(nodeCrypto.createHash('sha256').update(Buffer.from(copy)).digest('hex'));
      } catch (e) {}
    }
    return Promise.reject(new Error('no-sha256'));
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
    if (isBytes(value)) return JSON.stringify(hexOf(toUint8(value)));
    var keys = Object.keys(value).sort();
    var body = [];
    for (i = 0; i < keys.length; i++) {
      if (value[keys[i]] === undefined) continue;
      body.push(JSON.stringify(keys[i]) + ':' + canonical(value[keys[i]]));
    }
    return '{' + body.join(',') + '}';
  }

  function rowMode(input, pieceSize) {
    if (pieceSize === 'rows') return true;
    if (isBytes(input)) return false;
    return Array.isArray(input);
  }

  function pieceCount(input, size, rows) {
    if (rows) return input.length;
    if (!input || !input.length) return 0;
    return Math.ceil(input.length / size);
  }

  function pieceBytes(input, i, size) {
    var start = i * size;
    var end = Math.min(input.length, start + size);
    return input.subarray(start, end);
  }

  function manifest(input, pieceSize) {
    var rows = rowMode(input, pieceSize);
    var size = rows ? 'rows' : (typeof pieceSize === 'number' && pieceSize > 0 ? pieceSize : PIECE);
    var data = rows ? (Array.isArray(input) ? input : []) : toUint8(input);
    var n = pieceCount(data, size, rows);
    var pieces = [];
    var i = 0;
    function next() {
      if (i >= n) {
        var wholeSrc = rows ? canonical(data) : data;
        return sha256Hex(wholeSrc).then(function (whole) {
          return { version: VERSION, mode: rows ? 'rows' : 'bytes', pieceSize: size, pieces: pieces, whole: whole };
        });
      }
      var slice = rows ? canonical(data[i]) : pieceBytes(data, i, size);
      var index = i;
      return sha256Hex(slice).then(function (hex) {
        pieces.push({ i: index, sha256: hex });
        i += 1;
        return next();
      });
    }
    return next();
  }

  function verify(man, data) {
    if (!man || !Array.isArray(man.pieces)) return Promise.resolve({ ok: false, bad: [] });
    var rows = man.mode === 'rows' || man.pieceSize === 'rows';
    var body = rows ? (Array.isArray(data) ? data : []) : toUint8(data);
    var size = rows ? 'rows' : (man.pieceSize || PIECE);
    var bad = [];
    var i = 0;
    function next() {
      if (i >= man.pieces.length) {
        var wholeSrc = rows ? canonical(body) : body;
        return sha256Hex(wholeSrc).then(function (whole) {
          var sameLen = rows ? body.length === man.pieces.length : pieceCount(body, size, false) === man.pieces.length;
          return { ok: bad.length === 0 && whole === man.whole && sameLen, bad: bad };
        });
      }
      var spec = man.pieces[i];
      var slice = rows ? (spec.i < body.length ? canonical(body[spec.i]) : '') : (pieceBytes(body, spec.i, size));
      if (!rows && (spec.i * size >= body.length)) slice = new Uint8Array(0);
      return sha256Hex(slice).then(function (hex) {
        if (hex !== spec.sha256) bad.push(spec.i);
        i += 1;
        return next();
      });
    }
    return next();
  }

  function unpack(got) {
    if (isBytes(got)) return { value: toUint8(got), from: 'source' };
    if (got && typeof got === 'object' && (Object.prototype.hasOwnProperty.call(got, 'bytes') || Object.prototype.hasOwnProperty.call(got, 'row') || got.from)) {
      var value = Object.prototype.hasOwnProperty.call(got, 'bytes') ? got.bytes : got.row;
      return { value: value, from: got.from || 'source' };
    }
    return { value: got, from: 'source' };
  }

  function spliceBytes(bytes, index, size, chunk) {
    var next = toUint8(chunk);
    var start = index * size;
    var orig = Math.min(size, Math.max(0, bytes.length - start));
    var out = new Uint8Array(bytes.length - orig + next.length);
    out.set(bytes.subarray(0, start), 0);
    out.set(next, start);
    out.set(bytes.subarray(start + orig), start + next.length);
    return out;
  }

  function appendLedger(row) {
    var rows = readList(LEDGER_KEY);
    rows.push(row);
    writeList(LEDGER_KEY, rows);
    return row;
  }

  function heal(man, data, fetchPiece, meta) {
    meta = meta || {};
    var what = meta.what || 'pieces';
    if (!man || typeof fetchPiece !== 'function') {
      var missing = { at: new Date().toISOString(), what: what, whole: man && man.whole || '', bad: [], healedFrom: '', tries: 0, ok: false, stillBad: [], data: data };
      appendLedger(missing);
      paint();
      return Promise.resolve(missing);
    }
    var rows = man.mode === 'rows' || man.pieceSize === 'rows';
    var size = rows ? 'rows' : (man.pieceSize || PIECE);
    var working = rows ? (Array.isArray(data) ? data.slice() : []) : toUint8(data);
    return verify(man, working).then(function (first) {
      var bad = first.bad.slice();
      var tries = 0;
      var froms = [];
      var still = [];
      var p = 0;
      function onePiece() {
        if (p >= bad.length) {
          return verify(man, working).then(function (again) {
            var ok = !!(again.ok && still.length === 0);
            var from = froms.length ? froms.filter(function (v, idx, arr) { return arr.indexOf(v) === idx; }).join(',') : '';
            var row = {
              at: new Date().toISOString(),
              what: what,
              whole: man.whole,
              bad: bad.slice(),
              healedFrom: from,
              tries: tries,
              ok: ok,
              stillBad: ok ? [] : (still.length ? still.slice() : again.bad.slice()),
              data: working
            };
            appendLedger(row);
            paint();
            return row;
          });
        }
        var index = bad[p];
        var spec = null;
        var s;
        for (s = 0; s < man.pieces.length; s++) if (man.pieces[s].i === index) spec = man.pieces[s];
        var attempt = 0;
        function attemptOnce() {
          if (!spec || attempt >= MAX_TRIES) {
            still.push(index);
            p += 1;
            return onePiece();
          }
          attempt += 1;
          tries += 1;
          return Promise.resolve().then(function () { return fetchPiece(index); }).then(function (got) {
            var packed = unpack(got);
            var slice = rows ? canonical(packed.value) : toUint8(packed.value);
            return sha256Hex(slice).then(function (hex) {
              if (hex === spec.sha256) {
                if (rows) working[index] = packed.value;
                else working = spliceBytes(working, index, size, packed.value);
                if (froms.indexOf(packed.from) === -1) froms.push(packed.from);
                p += 1;
                return onePiece();
              }
              return attemptOnce();
            });
          }, function () { return attemptOnce(); });
        }
        return attemptOnce();
      }
      return onePiece();
    });
  }

  function counts() {
    var rows = readList(LEDGER_KEY);
    var n = 0;
    var m = 0;
    var i;
    for (i = 0; i < rows.length; i++) {
      if (rows[i] && rows[i].ok) n += 1;
      else m += 1;
    }
    return { repairs: n, broken: m };
  }

  function settingsText() {
    var c = counts();
    return 'Self-healing: ' + c.repairs + ' repairs, ' + c.broken + ' still broken';
  }

  function clip(text, n) {
    var s = String(text == null ? '' : text);
    if (s.length <= n) return s;
    return s.slice(0, n);
  }

  function lastTwo(turns) {
    var list = Array.isArray(turns) ? turns : (turns == null ? [] : [turns]);
    var out = [];
    var i;
    for (i = Math.max(0, list.length - 2); i < list.length; i++) out.push(clip(list[i], 400));
    return out;
  }

  function temperatureOf(kind) {
    if (root.FLTemperature && typeof root.FLTemperature.read === 'function') {
      try {
        var got = root.FLTemperature.read(kind);
        if (got && typeof got.value === 'number') return { value: got.value, word: String(got.word || kind) };
      } catch (e) {}
    }
    if (kind === 'refusal-sentinel') return { value: 0.8, word: 'pulled back' };
    if (kind === 'stop-here') return { value: 0.7, word: 'stopped' };
    if (kind === 'self-correction') return { value: 0.6, word: 'corrected' };
    if (kind === 'length-cap') return { value: 0.4, word: 'cut short' };
    return { value: 0.5, word: 'noticed' };
  }

  function roomShut() {
    try {
      var qr = root.QuietRoom;
      if (qr && typeof qr.isActive === 'function' && qr.isActive()) return true;
    } catch (e) { return true; }
    return false;
  }

  function noteTrim(kind, before, extra) {
    if (roomShut()) return null;
    var row = {
      at: new Date().toISOString(),
      before: lastTwo(before),
      temperature: temperatureOf(kind),
      kind: String(kind || 'noticed'),
      candidateLearning: true,
      label: LABEL
    };
    if (extra && extra.reason) row.reason = clip(extra.reason, 120);
    var rows = readList(WINDOW_KEY);
    rows.push(row);
    writeList(WINDOW_KEY, rows);
    paint();
    return row;
  }

  function classify(text) {
    var s = String(text || '');
    if (s.indexOf('[FL_DECLINE]') !== -1) return 'refusal-sentinel';
    if (/let me stop here/i.test(s)) return 'stop-here';
    if (/self-correct|let me correct|I meant to say/i.test(s)) return 'self-correction';
    var cap = typeof root.FLSelfHealCap === 'number' && root.FLSelfHealCap > 0 ? root.FLSelfHealCap : 4000;
    if (s.length > cap) return 'length-cap';
    return '';
  }

  function noteReply(text, before) {
    var kind = classify(text);
    if (!kind) return null;
    return noteTrim(kind, before);
  }

  function windows() { return readList(WINDOW_KEY); }

  function deleteWindow(at) {
    var rows = readList(WINDOW_KEY).filter(function (row) { return !row || row.at !== at; });
    writeList(WINDOW_KEY, rows);
    paint();
    return rows;
  }

  function readMeasure() {
    try {
      var raw = bucket().getItem(MEASURE_KEY);
      var data = raw ? JSON.parse(raw) : null;
      if (!data || typeof data !== 'object') data = {};
      if (!Array.isArray(data.withWindow)) data.withWindow = [];
      if (!Array.isArray(data.without)) data.without = [];
      return data;
    } catch (e) {
      return { withWindow: [], without: [] };
    }
  }

  function noteRun(hadWindow, score) {
    var book = readMeasure();
    var row = { at: new Date().toISOString(), score: typeof score === 'number' ? score : null };
    if (hadWindow) book.withWindow.push(row);
    else book.without.push(row);
    try { bucket().setItem(MEASURE_KEY, JSON.stringify(book)); } catch (e) {}
    paint();
    return book;
  }

  function measureText() {
    var book = readMeasure();
    var questions = root.GROWTH_QUESTIONS || (root.FLGrowth && root.FLGrowth.GROWTH_QUESTIONS) || null;
    var line = 'Windows captured: ' + windows().length + '. Runs with windows: ' + book.withWindow.length + '. Runs without: ' + book.without.length + '.';
    if (questions && questions.length) line += ' Growth questions on this device: ' + questions.length + '.';
    if (book.withWindow.length < 20 || book.without.length < 20) return line + ' not enough data yet';
    function avg(list) {
      var sum = 0;
      var n = 0;
      var i;
      for (i = 0; i < list.length; i++) {
        if (typeof list[i].score === 'number') { sum += list[i].score; n += 1; }
      }
      return n ? (sum / n) : null;
    }
    return line + ' with ' + avg(book.withWindow) + ', without ' + avg(book.without) + '.';
  }

  function el(tag, cls, text) {
    var d = root.document;
    if (!d || !d.createElement) return null;
    var node = d.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  function addStyle() {
    var d = root.document;
    if (!d || !d.getElementById || d.getElementById('flSelfHealStyle')) return;
    var style = el('style');
    if (!style) return;
    style.id = 'flSelfHealStyle';
    style.textContent = [
      '.fl-heal-btn{min-height:44px;min-width:44px;padding:10px 14px;margin:4px 8px 4px 0;background:var(--glass-bg,transparent);color:var(--text-primary,inherit);border:1px solid var(--glass-border,rgba(255,255,255,.15));border-radius:var(--btn-radius,8px);font:inherit;cursor:pointer;appearance:none;-webkit-appearance:none;}',
      '.fl-heal-note{margin:0.35rem 0;max-width:100%;overflow-wrap:anywhere;}'
    ].join('');
    (d.head || d.documentElement).appendChild(style);
  }

  function paint() {
    var d = root.document;
    if (!d || !d.getElementById) return;
    var host = d.getElementById('flSelfHealHost');
    if (!host) return;
    while (host.firstChild) host.removeChild(host.firstChild);
    addStyle();
    var title = el('p', 'fl-heal-note', settingsText());
    if (title) {
      title.id = 'flSelfHealLine';
      host.appendChild(title);
    }
    var measure = el('p', 'fl-heal-note', measureText());
    if (measure) {
      measure.id = 'flHealMeasureLine';
      host.appendChild(measure);
    }
    var label = el('p', 'fl-heal-note', LABEL);
    if (label) {
      label.id = 'flCaptureLabel';
      host.appendChild(label);
    }
    var list = windows();
    var i;
    for (i = 0; i < list.length; i++) {
      (function (row) {
        var view = el('p', 'fl-heal-note', LABEL + ' ' + row.kind + ' ' + (row.temperature && row.temperature.word || ''));
        if (view) view.setAttribute('data-capture-window', row.at);
        var btn = el('button', 'fl-heal-btn', 'Delete this window');
        if (btn) {
          btn.type = 'button';
          btn.setAttribute('data-capture-delete', row.at);
          btn.addEventListener('click', function () { deleteWindow(row.at); });
        }
        if (view) host.appendChild(view);
        if (btn) host.appendChild(btn);
      })(list[i]);
    }
  }

  function mountSettings(parent) {
    var d = root.document;
    if (!d || roomShut()) return null;
    addStyle();
    var host = d.getElementById('flSelfHealHost');
    if (!host) {
      host = el('section');
      if (!host) return null;
      host.id = 'flSelfHealHost';
      var where = parent || d.getElementById('tab-settings') || d.body;
      if (!where) return null;
      where.appendChild(host);
    }
    paint();
    return host;
  }

  function onRefusal(ev) {
    var detail = (ev && ev.detail) || {};
    var ctx = detail.context || {};
    var before = ctx.before || ctx.turns || [ctx.messageText || ''];
    noteTrim('refusal-sentinel', before, { reason: detail.reason || '' });
  }

  function boot() {
    mountSettings();
    try {
      if (root.document && root.document.addEventListener) {
        root.document.addEventListener('fl-ai-refusal', onRefusal);
      }
    } catch (e) {}
  }

  var api = {
    VERSION: VERSION,
    LABEL: LABEL,
    PIECE: PIECE,
    manifest: manifest,
    verify: verify,
    heal: heal,
    ledger: function () { return readList(LEDGER_KEY); },
    counts: counts,
    settingsText: settingsText,
    noteTrim: noteTrim,
    noteReply: noteReply,
    classify: classify,
    windows: windows,
    deleteWindow: deleteWindow,
    noteRun: noteRun,
    measureText: measureText,
    temperatureOf: temperatureOf,
    mountSettings: mountSettings,
    canonical: canonical,
    sha256Hex: sha256Hex
  };

  root.FLSelfHeal = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root.document) {
    if (root.document.readyState === 'loading' && root.document.addEventListener) {
      root.document.addEventListener('DOMContentLoaded', boot);
    } else {
      boot();
    }
  }
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this);
