/* FreeLattice: self-healing and capture windows v0.1 (window.FLSelfHeal)
   Marker: v-self-heal-v0.1
   Pieces keep their own hashes. A bad piece is fetched again. A good piece stays.
   Capture windows are experimental and local. Nothing here trains.
   062b: a receipt stores facts only. The healed bytes stay on the returned result.
*/
(function (root) {
  'use strict';

  // before 062b: var VERSION = 'v-self-heal-v0.1';
  var VERSION = 'v-self-heal-v0.2';
  var VERSION_V1 = 'v-self-heal-v0.1';
  var PIECE = 64 * 1024;
  var WHOLE_LIMIT = 64 * 1024 * 1024;
  var LEDGER_KEY = 'fl_healLedger';
  var WINDOW_KEY = 'fl_captureWindows';
  var MEASURE_KEY = 'fl_healMeasure';
  var MAX_TRIES = 3;
  var HONEST_LINE = 'Heal receipt could not be saved on this device (storage is full).';
  var LABEL = "Experimental: Kirk's hypothesis that trim moments are the best time to learn. Being measured, not assumed.";
  var mem = {};
  var seq = 0;
  var pending = [];
  var pendingWindows = [];
  var migrated = false;
  var maxGap = 0;
  var gapStart = 0;
  var yieldCount = 0;

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

  function isQuota(err) {
    if (!err) return false;
    var name = String(err.name || '');
    if (name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED') return true;
    if (err.code === 22 || err.code === 1014) return true;
    return false;
  }

  function writeList(key, rows) {
    try {
      bucket().setItem(key, JSON.stringify(rows));
      return { ok: true };
    } catch (e) {
      return { ok: false, reason: isQuota(e) ? 'quota' : 'unavailable' };
    }
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

  function isBlob(value) {
    return typeof Blob !== 'undefined' && value instanceof Blob;
  }

  function isBytes(value) {
    return value instanceof Uint8Array || value instanceof ArrayBuffer ||
      (typeof Buffer !== 'undefined' && Buffer.isBuffer && Buffer.isBuffer(value));
  }

  function byteLength(input) {
    if (input == null) return 0;
    if (isBlob(input)) return input.size;
    if (typeof input.length === 'number') return input.length;
    if (typeof input.byteLength === 'number') return input.byteLength;
    return 0;
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
    // A piece, a short string, or a digest. Not a hex dump of a whole file.
    if (typeof data !== 'string' && bytes.length > WHOLE_LIMIT) {
      return Promise.reject(new Error('too-large-for-one-hash'));
    }
    var inNode = typeof process !== 'undefined' && process.versions && process.versions.node && typeof require === 'function';
    if (inNode) {
      try {
        var nodeCrypto = require('crypto');
        var buf = typeof data === 'string' ? Buffer.from(String(data)) : Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        return Promise.resolve(nodeCrypto.createHash('sha256').update(buf).digest('hex'));
      } catch (e) {}
    }
    var copy = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    var subtle = root.crypto && root.crypto.subtle;
    if (subtle && typeof subtle.digest === 'function') {
      return subtle.digest('SHA-256', copy).then(function (digest) { return hexOf(digest); });
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
    // before 062b: byte values were hex-encoded and then JSON-encoded here, which held the whole buffer as one string.
    if (isBytes(value) || isBlob(value)) return 'null';
    var keys = Object.keys(value).sort();
    var body = [];
    for (i = 0; i < keys.length; i++) {
      if (value[keys[i]] === undefined) continue;
      body.push(JSON.stringify(keys[i]) + ':' + canonical(value[keys[i]]));
    }
    return '{' + body.join(',') + '}';
  }

  function newId() {
    seq += 1;
    var n = Math.floor(Math.random() * 0x10000);
    var hex = ('000' + n.toString(16)).slice(-4);
    return Date.now().toString(36) + '-' + seq + '-' + hex;
  }

  function clipTo(text, n) {
    var s = String(text == null ? '' : text);
    if (s.length <= n) return s;
    return s.slice(0, n);
  }

  function asList(value) {
    if (!Array.isArray(value)) return [];
    var out = [];
    var i;
    for (i = 0; i < value.length; i++) out.push(value[i]);
    return out;
  }

  function receiptOf(result, meta) {
    var src = result || {};
    var extra = meta || {};
    var from = src.healedFrom != null ? src.healedFrom : (extra.healedFrom || '');
    return {
      id: src.id || extra.id || newId(),
      at: src.at || extra.at || new Date().toISOString(),
      what: src.what || extra.what || 'pieces',
      whole: src.whole || extra.whole || '',
      pieceSize: src.pieceSize != null ? src.pieceSize : (extra.pieceSize != null ? extra.pieceSize : ''),
      pieces: typeof src.pieces === 'number' ? src.pieces : (typeof extra.pieces === 'number' ? extra.pieces : 0),
      bytes: typeof src.bytes === 'number' ? src.bytes : (typeof extra.bytes === 'number' ? extra.bytes : 0),
      bad: asList(src.bad),
      stillBad: asList(src.stillBad),
      healedFrom: clipTo(from, 80),
      tries: typeof src.tries === 'number' ? src.tries : 0,
      fetches: typeof src.fetches === 'number' ? src.fetches : (typeof extra.fetches === 'number' ? extra.fetches : 0),
      ms: typeof src.ms === 'number' ? src.ms : (typeof extra.ms === 'number' ? extra.ms : 0),
      ok: !!src.ok
    };
  }

  function rowMode(input, pieceSize) {
    if (pieceSize === 'rows') return true;
    if (isBytes(input) || isBlob(input)) return false;
    return Array.isArray(input);
  }

  function pieceCountOf(total, size) {
    if (!total || !size) return 0;
    return Math.ceil(total / size);
  }

  function pieceBytes(input, i, size) {
    var start = i * size;
    var end = Math.min(input.length, start + size);
    return input.subarray(start, end);
  }

  function pieceSlice(input, i, size) {
    var total = byteLength(input);
    var start = i * size;
    var end = Math.min(total, start + size);
    if (end <= start) return Promise.resolve(new Uint8Array(0));
    if (isBlob(input)) {
      return input.slice(start, end).arrayBuffer().then(function (buf) {
        return new Uint8Array(buf);
      });
    }
    var bytes = input instanceof Uint8Array ? input : toUint8(input);
    return Promise.resolve(pieceBytes(bytes, i, size));
  }

  function beginGap() { gapStart = Date.now(); }

  function endGap() {
    if (!gapStart) return;
    var gap = Date.now() - gapStart;
    if (gap > maxGap) maxGap = gap;
    gapStart = 0;
  }

  function breathe(done) {
    if (done % 8 !== 0) return Promise.resolve();
    endGap();
    yieldCount += 1;
    return new Promise(function (resolve) {
      setTimeout(function () {
        beginGap();
        resolve();
      }, 0);
    });
  }

  function openWholeHasher(total) {
    if (total > WHOLE_LIMIT) return null;
    if (typeof require === 'function') {
      try {
        return require('crypto').createHash('sha256');
      } catch (e) {}
    }
    return { kind: 'browser' };
  }

  function feedWhole(hasher, piece) {
    if (!hasher || hasher.kind === 'browser') return;
    var view = piece instanceof Uint8Array ? piece : toUint8(piece);
    hasher.update(Buffer.from(view.buffer, view.byteOffset, view.byteLength));
  }

  function finishWhole(hasher, original) {
    if (!hasher) return Promise.resolve('');
    if (hasher.kind === 'browser') {
      if (isBlob(original)) {
        return original.arrayBuffer().then(function (buf) {
          return sha256Hex(new Uint8Array(buf));
        });
      }
      return sha256Hex(original instanceof Uint8Array ? original : toUint8(original));
    }
    return Promise.resolve(hasher.digest('hex'));
  }

  function hashJoined(hexes) {
    return sha256Hex(hexes.join(''));
  }

  function manifestRows(rowsInput) {
    var n = Array.isArray(rowsInput) ? rowsInput.length : 0;
    var pieces = [];
    var hexes = [];
    var i = 0;
    beginGap();
    function next() {
      if (i >= n) {
        return hashJoined(hexes).then(function (root) {
          return sha256Hex(canonical(rowsInput)).then(function (whole) {
            endGap();
            return {
              version: VERSION,
              mode: 'rows',
              pieceSize: 'rows',
              pieces: pieces,
              whole: whole,
              root: root
            };
          });
        });
      }
      var index = i;
      return sha256Hex(canonical(rowsInput[index])).then(function (hex) {
        pieces.push({ i: index, sha256: hex });
        hexes.push(hex);
        i += 1;
        return breathe(i).then(next);
      });
    }
    return next();
  }

  function manifestBytes(input, pieceSize) {
    var size = typeof pieceSize === 'number' && pieceSize > 0 ? pieceSize : PIECE;
    var total = byteLength(input);
    var n = pieceCountOf(total, size);
    var pieces = [];
    var hexes = [];
    var hasher = openWholeHasher(total);
    var i = 0;
    beginGap();
    function next() {
      if (i >= n) {
        return hashJoined(hexes).then(function (root) {
          return finishWhole(hasher, input).then(function (whole) {
            endGap();
            var man = {
              version: VERSION,
              mode: 'bytes',
              pieceSize: size,
              pieces: pieces,
              root: root
            };
            if (total <= WHOLE_LIMIT) man.whole = whole;
            return man;
          });
        });
      }
      return pieceSlice(input, i, size).then(function (slice) {
        feedWhole(hasher, slice);
        var index = i;
        return sha256Hex(slice).then(function (hex) {
          pieces.push({ i: index, sha256: hex });
          hexes.push(hex);
          i += 1;
          return breathe(i).then(next);
        });
      });
    }
    return next();
  }

  function manifest(input, pieceSize) {
    if (rowMode(input, pieceSize)) return manifestRows(Array.isArray(input) ? input : []);
    return manifestBytes(input, pieceSize);
  }

  function verifyRows(man, rowsInput) {
    var bad = [];
    var hexes = [];
    var i = 0;
    var list = Array.isArray(rowsInput) ? rowsInput : [];
    beginGap();
    function next() {
      if (i >= man.pieces.length) {
        return hashJoined(hexes).then(function (root) {
          return sha256Hex(canonical(list)).then(function (whole) {
            endGap();
            var sameLen = list.length === man.pieces.length;
            var rootOk = !man.root || root === man.root;
            var wholeOk = man.version === VERSION_V1 ? whole === man.whole : (!man.whole || whole === man.whole);
            return { ok: bad.length === 0 && wholeOk && rootOk && sameLen, bad: bad };
          });
        });
      }
      var spec = man.pieces[i];
      var cell = spec.i < list.length ? canonical(list[spec.i]) : '';
      return sha256Hex(cell).then(function (hex) {
        hexes.push(hex);
        if (hex !== spec.sha256) bad.push(spec.i);
        i += 1;
        return breathe(i).then(next);
      });
    }
    return next();
  }

  function verifyBytes(man, input) {
    var size = man.pieceSize || PIECE;
    var total = byteLength(input);
    var bad = [];
    var hexes = [];
    var hasher = openWholeHasher(total);
    var i = 0;
    beginGap();
    function next() {
      if (i >= man.pieces.length) {
        return hashJoined(hexes).then(function (root) {
          return finishWhole(hasher, input).then(function (whole) {
            endGap();
            var sameLen = pieceCountOf(total, size) === man.pieces.length;
            var rootOk = !man.root || root === man.root;
            var v1 = man.version === VERSION_V1 || (!man.root && man.whole);
            var wholeOk = true;
            if (v1) wholeOk = whole === man.whole;
            else if (man.whole && total <= WHOLE_LIMIT) wholeOk = whole === man.whole;
            return { ok: bad.length === 0 && wholeOk && rootOk && sameLen, bad: bad };
          });
        });
      }
      var spec = man.pieces[i];
      return pieceSlice(input, spec.i, size).then(function (slice) {
        if (!slice.length && spec.i * size >= total) slice = new Uint8Array(0);
        feedWhole(hasher, slice);
        return sha256Hex(slice).then(function (hex) {
          hexes.push(hex);
          if (hex !== spec.sha256) bad.push(spec.i);
          i += 1;
          return breathe(i).then(next);
        });
      });
    }
    return next();
  }

  function verify(man, data) {
    if (!man || !Array.isArray(man.pieces)) return Promise.resolve({ ok: false, bad: [] });
    var rows = man.mode === 'rows' || man.pieceSize === 'rows';
    if (rows) return verifyRows(man, data);
    return verifyBytes(man, data);
  }

  function unpack(got) {
    if (isBytes(got)) return { value: toUint8(got), from: 'source' };
    if (isBlob(got)) return { value: got, from: 'source' };
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
    // before 062b: a new Uint8Array was allocated and both sides were copied on every healed piece.
    if (next.length === orig) {
      bytes.set(next, start);
      return bytes;
    }
    var out = new Uint8Array(bytes.length - orig + next.length);
    out.set(bytes.subarray(0, start), 0);
    out.set(next, start);
    out.set(bytes.subarray(start + orig), start + next.length);
    return out;
  }

  function appendLedger(row) {
    var clean = receiptOf(row);
    var rows = readList(LEDGER_KEY);
    rows.push(clean);
    var wrote = writeList(LEDGER_KEY, rows);
    if (!wrote.ok) {
      wrote = writeList(LEDGER_KEY, rows.slice(-500));
    }
    if (!wrote.ok) {
      pending.push(clean);
      return { saved: false, row: clean, reason: wrote.reason || 'quota' };
    }
    return { saved: true, row: clean };
  }

  function deliver(stored, data, saved) {
    var result = receiptOf(stored);
    result.data = data;
    result.receiptSaved = !!saved;
    result.line = saved ? settingsText() : HONEST_LINE;
    return result;
  }

  function heal(man, data, fetchPiece, meta) {
    meta = meta || {};
    var what = meta.what || 'pieces';
    var started = Date.now();
    if (!man || typeof fetchPiece !== 'function') {
      // before 062b: var missing = { at: new Date().toISOString(), what: what, whole: man && man.whole || '', bad: [], healedFrom: '', tries: 0, ok: false, stillBad: [], data: data };
      var missingFacts = {
        at: new Date().toISOString(),
        what: what,
        whole: man && (man.whole || man.root) || '',
        pieceSize: man && man.pieceSize != null ? man.pieceSize : '',
        pieces: man && man.pieces ? man.pieces.length : 0,
        bytes: byteLength(data),
        bad: [],
        stillBad: [],
        healedFrom: '',
        tries: 0,
        fetches: 0,
        ms: Date.now() - started,
        ok: false
      };
      var missingStored = receiptOf(missingFacts);
      var missingSave = appendLedger(missingStored);
      paint();
      return Promise.resolve(deliver(missingStored, data, missingSave.saved));
    }
    var rows = man.mode === 'rows' || man.pieceSize === 'rows';
    var size = rows ? 'rows' : (man.pieceSize || PIECE);
    var blobInput = !rows && isBlob(data);
    var working;
    if (rows) working = Array.isArray(data) ? data.slice() : [];
    else if (blobInput) working = data;
    else {
      var srcBytes = toUint8(data);
      working = new Uint8Array(srcBytes.length);
      working.set(srcBytes);
    }
    var replacements = {};
    return verify(man, working).then(function (first) {
      var bad = first.bad.slice();
      var tries = 0;
      var fetches = 0;
      var froms = [];
      var still = [];
      var p = 0;
      function onePiece() {
        if (p >= bad.length) {
          var from = froms.length ? froms.filter(function (v, idx, arr) { return arr.indexOf(v) === idx; }).join(',') : '';
          var outData;
          if (blobInput) outData = rebuiltBlob();
          else outData = working;
          return verify(man, outData).then(function (again) {
            var ok = !!(again.ok && still.length === 0);
            // before 062b: the stored row was the same object as the return value and held data: working
            var facts = {
              at: new Date().toISOString(),
              what: what,
              whole: man.whole || man.root || '',
              pieceSize: size,
              pieces: man.pieces.length,
              bytes: byteLength(outData),
              bad: bad.slice(),
              healedFrom: from,
              tries: tries,
              fetches: fetches,
              ms: Date.now() - started,
              ok: ok,
              stillBad: ok ? [] : (still.length ? still.slice() : again.bad.slice())
            };
            var stored = receiptOf(facts);
            var save = appendLedger(stored);
            paint();
            return deliver(stored, outData, save.saved);
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
          fetches += 1;
          return Promise.resolve().then(function () { return fetchPiece(index); }).then(function (got) {
            var packed = unpack(got);
            var slicePromise;
            if (rows) slicePromise = Promise.resolve(packed.value);
            else if (isBlob(packed.value)) slicePromise = packed.value.arrayBuffer().then(function (buf) { return new Uint8Array(buf); });
            else slicePromise = Promise.resolve(toUint8(packed.value));
            return slicePromise.then(function (slice) {
              var hashed = rows ? canonical(slice) : slice;
              return sha256Hex(hashed).then(function (hex) {
                if (hex === spec.sha256) {
                  if (rows) working[index] = packed.value;
                  else if (blobInput) replacements[index] = slice;
                  else working = spliceBytes(working, index, size, slice);
                  if (froms.indexOf(packed.from) === -1) froms.push(packed.from);
                  p += 1;
                  return onePiece();
                }
                return attemptOnce();
              });
            });
          }, function () { return attemptOnce(); });
        }
        return attemptOnce();
      }
      function rebuiltBlob() {
        var parts = [];
        var n;
        for (n = 0; n < man.pieces.length; n++) {
          var idx = man.pieces[n].i;
          if (replacements[idx]) parts.push(replacements[idx]);
          else {
            var start = idx * size;
            var end = Math.min(data.size, start + size);
            parts.push(data.slice(start, end));
          }
        }
        return new Blob(parts);
      }
      return onePiece();
    });
  }

  // before 062b: ledger rows kept the healed bytes. A one-time rewrite stores facts only. The note lives in the doc, not in storage.
  function migrateLedger() {
    if (migrated) return;
    var rows = readList(LEDGER_KEY);
    var dirty = false;
    var next = [];
    var i;
    for (i = 0; i < rows.length; i++) {
      var row = rows[i];
      if (row && Object.prototype.hasOwnProperty.call(row, 'data')) {
        dirty = true;
        next.push(receiptOf(row));
      } else {
        next.push(row);
      }
    }
    if (!dirty) {
      migrated = true;
      return;
    }
    var wrote = writeList(LEDGER_KEY, next);
    if (!wrote.ok) wrote = writeList(LEDGER_KEY, next.slice(-500));
    if (wrote.ok) migrated = true;
  }

  function counts() {
    migrateLedger();
    var rows = readList(LEDGER_KEY);
    var seen = {};
    var repairs = 0;
    var broken = 0;
    function tally(row) {
      if (!row || typeof row !== 'object') return;
      var key = row.id || (String(row.at || '') + '|' + String(row.what || '') + '|' + (row.ok ? '1' : '0') + '|' + String(row.whole || ''));
      if (seen[key]) return;
      seen[key] = true;
      if (row.ok) repairs += 1;
      else broken += 1;
    }
    var i;
    for (i = 0; i < rows.length; i++) tally(rows[i]);
    for (i = 0; i < pending.length; i++) tally(pending[i]);
    return { repairs: repairs, broken: broken, unsaved: pending.length };
  }

  function settingsText() {
    var c = counts();
    var line = 'Self-healing: ' + c.repairs + ' repairs, ' + c.broken + ' still broken';
    if (c.unsaved > 0) line += '; ' + c.unsaved + ' receipts not saved (storage full)';
    return line;
  }

  function clip(text, n) {
    return clipTo(text, n);
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

  function saveRows(key, rows) {
    var wrote = writeList(key, rows);
    if (!wrote.ok) wrote = writeList(key, rows.slice(-500));
    return wrote;
  }

  function noteTrim(kind, before, extra) {
    if (roomShut()) return null;
    // before 062b: the window row had no id, so two saves in the same millisecond shared `at` and one Delete removed both.
    var row = {
      id: newId(),
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
    var wrote = saveRows(WINDOW_KEY, rows);
    if (wrote.ok) row.receiptSaved = true;
    else {
      pendingWindows.push(row);
      row.receiptSaved = false;
      row.line = HONEST_LINE;
    }
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

  function windows() {
    return readList(WINDOW_KEY).concat(pendingWindows);
  }

  function deleteWindow(id) {
    var rows = readList(WINDOW_KEY);
    var next = [];
    var removed = false;
    var i;
    for (i = 0; i < rows.length; i++) {
      if (!removed && rows[i] && rows[i].id && rows[i].id === id) {
        removed = true;
        continue;
      }
      next.push(rows[i]);
    }
    if (!removed) {
      // before 062b: every row whose `at` matched was removed.
      next = [];
      for (i = 0; i < rows.length; i++) {
        var legacy = rows[i];
        if (!removed && legacy && !legacy.id && legacy.at === id) {
          removed = true;
          continue;
        }
        next.push(legacy);
      }
    }
    var kept = [];
    var droppedPending = false;
    for (i = 0; i < pendingWindows.length; i++) {
      var pw = pendingWindows[i];
      if (!droppedPending && pw && ((pw.id && pw.id === id) || (!pw.id && pw.at === id))) {
        droppedPending = true;
        continue;
      }
      kept.push(pw);
    }
    pendingWindows = kept;
    saveRows(WINDOW_KEY, next);
    paint();
    return next.concat(pendingWindows);
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
    if (pending.length || pendingWindows.length) {
      var honest = el('p', 'fl-heal-note', HONEST_LINE);
      if (honest) {
        honest.id = 'flHealUnsavedLine';
        host.appendChild(honest);
      }
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
        var key = row.id || row.at;
        var view = el('p', 'fl-heal-note', LABEL + ' ' + row.kind + ' ' + (row.temperature && row.temperature.word || ''));
        if (view) view.setAttribute('data-capture-window', key);
        var btn = el('button', 'fl-heal-btn', 'Delete this window');
        if (btn) {
          btn.type = 'button';
          btn.setAttribute('data-capture-delete', key);
          btn.addEventListener('click', function () { deleteWindow(key); });
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
    HONEST_LINE: HONEST_LINE,
    manifest: manifest,
    verify: verify,
    heal: heal,
    receiptOf: receiptOf,
    ledger: function () { return readList(LEDGER_KEY); },
    pendingReceipts: function () { return pending.slice(); },
    counts: counts,
    settingsText: settingsText,
    maxWorkGap: function () { return maxGap; },
    resetWorkGap: function () { maxGap = 0; yieldCount = 0; gapStart = 0; },
    yieldCount: function () { return yieldCount; },
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
