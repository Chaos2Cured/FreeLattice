/* FreeLattice: Ledger shard export v0.1 (window.FLLedgerShard)
   Marker: v-ledger-shard-export-v0.1
   MIT. A small local file of lines already on this device.
   Not a cloud sync. Not a second ledger. Not the full archive.
   Diary: the keep-reason already in fl_preserveLedger.
   LP: the gift sentence already in fl_lp_give_history.
   Temperature: the rest reason already in fl_restLedger.
   Gauge settings, balances, companion ids, and keys stay out.
   Pause hides the control. A cleared store builds nothing.
   The file is saved on this computer. Nothing is sent.
*/
(function (root) {
  'use strict';

  var VERSION = 'v-ledger-shard-export-v0.1';
  var KEY = 'fl_ledger_shard_export_v0';
  var CAP = 5;
  var MAX = 180;
  var FILE_NAME = 'freelattice-ledger-shard.json';
  var PRIVATE_MARKS = ['quiet-room', 'quiet_room', 'quietroom', 'quiet-room-db'];

  var host = null;
  var blurb = null;
  var status = null;

  function refusedText(text) {
    var s = String(text || '');
    if (/sk-[A-Za-z0-9]{8,}/.test(s)) return true;
    if (/Bearer\s+\S{12,}/.test(s)) return true;
    if (/\b(api[_-]?key|token|secret|password)\b/i.test(s) && /[A-Za-z0-9_\-]{16,}/.test(s)) return true;
    if (/eyJ[A-Za-z0-9_\-]{20,}\.[A-Za-z0-9_\-]{10,}/.test(s)) return true;
    if (/0x[0-9a-fA-F]{8,}/.test(s)) return true;
    if (/\$\s*\d/.test(s)) return true;
    if (/fl_tg_|fl_ws_device_key|fl_apiKey|fl_github_token/i.test(s)) return true;
    var low = s.toLowerCase();
    for (var i = 0; i < PRIVATE_MARKS.length; i++) {
      if (low.indexOf(PRIVATE_MARKS[i]) !== -1) return true;
    }
    return false;
  }

  function paused() {
    return root.__flUserPaused === true;
  }

  function roomShut() {
    try {
      var qr = root.QuietRoom;
      if (!qr) return false;
      if (typeof qr.isActive !== 'function') return true;
      return !!qr.isActive();
    } catch (e) {
      return true;
    }
  }

  function shorten(text) {
    var clean = String(text || '').replace(/\s+/g, ' ').trim();
    if (clean.length <= MAX) return clean;
    return clean.slice(0, MAX - 3) + '...';
  }

  function stamp(v) {
    var n = typeof v === 'number' ? v : Date.parse(v);
    if (!n || !isFinite(n)) return '';
    try { return new Date(n).toISOString(); } catch (e) { return ''; }
  }

  function readArray(key) {
    try {
      var raw = root.localStorage && root.localStorage.getItem(key);
      if (!raw) return [];
      var data = JSON.parse(raw);
      return Array.isArray(data) ? data : [];
    } catch (e) {
      return [];
    }
  }

  function take(rows, fromEnd, accept) {
    var out = [];
    var n = rows.length;
    for (var step = 0; step < n && out.length < CAP; step++) {
      var row = fromEnd ? rows[n - 1 - step] : rows[step];
      if (!row || typeof row !== 'object') continue;
      var named = String(row.kind || '');
      if (named.indexOf('removed') !== -1) continue;
      var picked = accept(row, named);
      if (!picked) continue;
      if (refusedText(picked.text)) continue;
      var clean = shorten(picked.text);
      if (!clean || refusedText(clean)) continue;
      var t = stamp(picked.t);
      if (!t) continue;
      out.push({ kind: picked.kind, text: clean, t: t });
    }
    return out;
  }

  function collect() {
    if (paused() || roomShut()) return [];
    var diary = take(readArray('fl_preserveLedger'), true, function (row, named) {
      if (named !== 'preserve' || typeof row.reason !== 'string') return null;
      return { kind: 'diary', text: row.reason, t: row.ts };
    });
    var lp = take(readArray('fl_lp_give_history'), false, function (row) {
      if (typeof row.line !== 'string') return null;
      return { kind: 'lp', text: row.line, t: row.ts };
    });
    var temperature = take(readArray('fl_restLedger'), true, function (row, named) {
      if (named !== 'rest' || typeof row.reason !== 'string') return null;
      return { kind: 'temperature', text: row.reason, t: row.ts };
    });
    return diary.concat(lp).concat(temperature);
  }

  function build() {
    var lines = collect();
    if (!lines.length) return null;
    var shard = { v: 1, marker: VERSION, lines: lines };
    try {
      if (refusedText(JSON.stringify(shard))) return null;
    } catch (e) {
      return null;
    }
    return shard;
  }

  function rememberExport() {
    try {
      var note = JSON.stringify({ v: 1, last: new Date().toISOString() });
      if (refusedText(note)) return;
      root.localStorage.setItem(KEY, note);
    } catch (e) {}
  }

  function download() {
    if (paused() || roomShut()) return false;
    var shard = build();
    if (!shard) return false;
    var body = '';
    try { body = JSON.stringify(shard, null, 2) + '\n'; } catch (e) { return false; }
    if (!body || refusedText(body)) return false;
    var doc = root.document;
    if (!doc || !doc.body || typeof root.Blob !== 'function' || !root.URL) return false;
    var blob = new Blob([body], { type: 'application/json' });
    var url = '';
    try { url = root.URL.createObjectURL(blob); } catch (e2) { return false; }
    var a = doc.createElement('a');
    a.href = url;
    a.download = FILE_NAME;
    a.hidden = true;
    a.rel = 'noopener';
    doc.body.appendChild(a);
    a.click();
    a.remove();
    root.setTimeout(function () {
      try { root.URL.revokeObjectURL(url); } catch (e3) {}
    }, 1500);
    rememberExport();
    return true;
  }

  function paint() {
    if (!host || !blurb || !status) return;
    var lines = collect();
    if (!lines.length) {
      host.hidden = true;
      blurb.textContent = '';
      status.textContent = '';
      return;
    }
    host.hidden = false;
    blurb.textContent = lines.length === 1
      ? 'One line you already kept. Save it as a file on this computer.'
      : (lines.length + ' lines you already kept. Save them as a file on this computer.');
  }

  function onSave() {
    if (!download()) {
      paint();
      return;
    }
    if (status) status.textContent = 'Saved on this computer.';
  }

  function ensure() {
    var doc = root.document;
    if (!doc || host) return;
    if (!doc.getElementById('fl-ledger-shard-style')) {
      var style = doc.createElement('style');
      style.id = 'fl-ledger-shard-style';
      style.textContent = [
        '#fl-ledger-shard{box-sizing:border-box;width:100%;max-width:100%;margin:0 0 1.4rem;padding:1.1rem 1.1rem 1.2rem;border:1px solid #2a2a3a;border-radius:6px;background:#0e0e1c;font-family:Georgia,"Times New Roman",serif;overflow-wrap:anywhere;animation:none;transition:none;}',
        '#fl-ledger-shard[hidden]{display:none !important;}',
        '#fl-ledger-shard h2{margin:0 0 0.5rem;color:#d4a017;font-size:1.05rem;font-weight:normal;max-width:100%;}',
        '#fl-ledger-shard p{margin:0 0 0.9rem;color:#cfcfcf;font-size:0.95rem;line-height:1.4;max-width:100%;min-width:0;}',
        '#fl-ledger-shard button{box-sizing:border-box;min-height:44px;min-width:44px;max-width:100%;padding:12px 16px;border-radius:4px;border:1px solid #d4a017;background:#1a1a2e;color:#d4a017;font:inherit;cursor:pointer;animation:none;transition:none;}',
        '@media (prefers-reduced-motion: reduce){#fl-ledger-shard,#fl-ledger-shard h2,#fl-ledger-shard p,#fl-ledger-shard button{animation:none !important;transition:none !important;}}'
      ].join('');
      (doc.head || doc.documentElement).appendChild(style);
    }
    host = doc.createElement('section');
    host.id = 'fl-ledger-shard';
    host.className = 'v-ledger-shard-export-v0.1';
    host.setAttribute('data-marker', VERSION);
    host.setAttribute('aria-label', 'Keep a small shard');
    host.hidden = true;
    var title = doc.createElement('h2');
    title.id = 'fl-ledger-shard-title';
    title.className = 'v-ledger-shard-export-v0.1';
    title.textContent = 'Keep a small shard';
    blurb = doc.createElement('p');
    blurb.id = 'fl-ledger-shard-blurb';
    blurb.className = 'v-ledger-shard-export-v0.1';
    var saveBtn = doc.createElement('button');
    saveBtn.type = 'button';
    saveBtn.id = 'fl-ledger-shard-save';
    saveBtn.className = 'v-ledger-shard-export-v0.1';
    saveBtn.setAttribute('data-marker', VERSION);
    saveBtn.textContent = 'Save the shard';
    saveBtn.addEventListener('click', onSave);
    status = doc.createElement('p');
    status.id = 'fl-ledger-shard-status';
    status.className = 'v-ledger-shard-export-v0.1';
    host.appendChild(title);
    host.appendChild(blurb);
    host.appendChild(saveBtn);
    host.appendChild(status);
    var archive = doc.getElementById('latticeExportSection');
    if (archive && archive.parentNode) archive.parentNode.insertBefore(host, archive.nextSibling);
    else {
      var page = doc.querySelector('.page');
      if (page) page.appendChild(host);
      else doc.body.appendChild(host);
    }
    paint();
    root.addEventListener('focus', paint);
    root.addEventListener('pageshow', paint);
    root.addEventListener('storage', paint);
  }

  function boot() { ensure(); }

  var api = {
    version: VERSION,
    key: KEY,
    collect: collect,
    build: build,
    download: download,
    paint: paint,
    looksLikeSecret: refusedText
  };

  root.FLLedgerShard = api;

  var doc = root.document;
  if (doc) {
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot);
    else boot();
  }
})(typeof window !== 'undefined' ? window : globalThis);
