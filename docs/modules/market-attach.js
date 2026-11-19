// market-attach.js (MIT) v-marketplace-polish-v0.1
// A mind may attach pictures it made to its offer. Local only.
// Nothing is uploaded. The record itself is never deleted.
// Up to 3. A shared offer carries a short fingerprint and a small thumbnail.
(function (root) {
  'use strict';

  var KEY = 'fl_market_attach_v1';
  var RECORD_KEY = 'fl_image_records';
  var MAX = 3;
  var LINE_EMPTY = 'This mind has not made a picture yet.';
  var LINE_BAD = 'That picture does not match its record.';
  var LINE_CAP = 'Three pictures is the most this offer can hold.';
  var BUTTON = 'Add a picture this mind made';

  function storage() {
    try {
      if (!root.localStorage || typeof root.localStorage.getItem !== 'function') return null;
      return root.localStorage;
    } catch (e) { return null; }
  }

  function readRecords() {
    var list = [];
    var box = storage();
    if (box) {
      try {
        var raw = box.getItem(RECORD_KEY);
        var parsed = raw ? JSON.parse(raw) : [];
        if (Array.isArray(parsed)) list = parsed.slice();
      } catch (e) { list = []; }
    }
    try {
      if (root.FLMindImages && typeof root.FLMindImages.list === 'function') {
        var extra = root.FLMindImages.list();
        if (Array.isArray(extra)) list = list.concat(extra);
      }
    } catch (e2) {}
    return list;
  }

  function bytesFrom(rec) {
    var raw = rec && (rec.bytes || rec.png || '');
    if (!raw) return null;
    var s = String(raw);
    var b64 = s.indexOf('base64,') === -1 ? s : s.split('base64,')[1];
    try {
      var bin = atob(b64);
      var out = new Uint8Array(bin.length);
      var i;
      for (i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i) & 255;
      return out;
    } catch (e) { return null; }
  }

  function sha256(bytes) {
    var subtle = root.crypto && root.crypto.subtle;
    if (!subtle || typeof subtle.digest !== 'function') return Promise.resolve('');
    return subtle.digest('SHA-256', bytes).then(function (buf) {
      var arr = new Uint8Array(buf);
      var hex = '';
      var i;
      for (i = 0; i < arr.length; i++) hex += ('0' + arr[i].toString(16)).slice(-2);
      return hex;
    }, function () { return ''; });
  }

  function claimedHash(rec) {
    return String((rec && (rec.byteHash || rec.sha256 || rec.hash)) || '').toLowerCase();
  }

  function isPerson(rec) {
    if (!rec) return true;
    if (rec.madeBy === 'person') return true;
    if (!rec.mindFp && !rec.mindSealId && rec.personFp) return true;
    return false;
  }

  function sameMind(rec, mindFp) {
    if (!mindFp) return !!(rec && (rec.mindFp || rec.mindSealId));
    return String(rec.mindFp || '') === String(mindFp) || String(rec.mindSealId || '') === String(mindFp);
  }

  function forMind(mindFp) {
    return readRecords().filter(function (rec) {
      return rec && !isPerson(rec) && sameMind(rec, mindFp) && bytesFrom(rec) && claimedHash(rec);
    });
  }

  function readOffers() {
    var box = storage();
    if (!box) return { offers: {} };
    try {
      var raw = box.getItem(KEY);
      var parsed = raw ? JSON.parse(raw) : null;
      if (!parsed || typeof parsed !== 'object' || !parsed.offers) return { offers: {} };
      return parsed;
    } catch (e) { return { offers: {} }; }
  }

  function writeOffers(doc) {
    var box = storage();
    if (!box) return;
    try { box.setItem(KEY, JSON.stringify(doc)); } catch (e) {}
  }

  function offerList(id) {
    var doc = readOffers();
    var list = doc.offers[id];
    return Array.isArray(list) ? list : [];
  }

  function thumbOf(bytes) {
    var doc = root.document;
    if (!doc || typeof root.Image !== 'function' || typeof doc.createElement !== 'function') {
      return Promise.resolve('');
    }
    return new Promise(function (resolve) {
      var blob;
      try { blob = new root.Blob([bytes], { type: 'image/png' }); }
      catch (e) { resolve(''); return; }
      var url = '';
      try { url = root.URL.createObjectURL(blob); }
      catch (e2) { resolve(''); return; }
      var img = new root.Image();
      img.onload = function () {
        var w = img.naturalWidth || img.width || 1;
        var h = img.naturalHeight || img.height || 1;
        var scale = Math.min(1, 256 / Math.max(w, h));
        var cw = Math.max(1, Math.round(w * scale));
        var ch = Math.max(1, Math.round(h * scale));
        var canvas = doc.createElement('canvas');
        canvas.width = cw;
        canvas.height = ch;
        var ctx = canvas.getContext ? canvas.getContext('2d') : null;
        var data = '';
        if (ctx) {
          ctx.drawImage(img, 0, 0, cw, ch);
          try { data = canvas.toDataURL('image/png'); } catch (e3) { data = ''; }
        }
        try { root.URL.revokeObjectURL(url); } catch (e4) {}
        resolve(data);
      };
      img.onerror = function () {
        try { root.URL.revokeObjectURL(url); } catch (e5) {}
        resolve('');
      };
      img.src = url;
    });
  }

  function attach(offerId, rec, mindName) {
    var id = String(offerId || 'local');
    var name = String(mindName || 'this mind');
    var list = offerList(id);
    if (list.length >= MAX) return Promise.resolve({ ok: false, line: LINE_CAP });
    if (isPerson(rec)) return Promise.resolve({ ok: false, line: LINE_BAD });
    var bytes = bytesFrom(rec);
    var claimed = claimedHash(rec);
    if (!bytes || !claimed) return Promise.resolve({ ok: false, line: LINE_BAD });
    return sha256(bytes).then(function (hex) {
      if (!hex || hex.toLowerCase() !== claimed) return { ok: false, line: LINE_BAD };
      var fp16 = hex.slice(0, 16);
      if (list.some(function (row) { return row && row.fp16 === fp16; })) {
        return { ok: true, fp16: fp16, line: 'Made by ' + name };
      }
      return thumbOf(bytes).then(function (thumb) {
        var doc = readOffers();
        var cur = Array.isArray(doc.offers[id]) ? doc.offers[id].slice() : [];
        if (cur.length >= MAX) return { ok: false, line: LINE_CAP };
        if (thumb && thumb.indexOf('data:image/png') !== 0) thumb = '';
        cur.push({
          fp16: fp16,
          byteHash: hex,
          mindFp: String(rec.mindFp || rec.mindSealId || ''),
          mindName: name,
          thumb: thumb
        });
        doc.offers[id] = cur;
        writeOffers(doc);
        return { ok: true, fp16: fp16, line: 'Made by ' + name };
      });
    });
  }

  function remove(offerId, fp16) {
    var id = String(offerId || 'local');
    var doc = readOffers();
    var cur = Array.isArray(doc.offers[id]) ? doc.offers[id] : [];
    doc.offers[id] = cur.filter(function (row) { return !row || row.fp16 !== fp16; });
    writeOffers(doc);
    return doc.offers[id];
  }

  function sharePayload(offerId) {
    return offerList(offerId).map(function (row) {
      return { fp: row.fp16, thumb: row.thumb || '' };
    });
  }

  function el(doc, tag, cls, text) {
    var node = doc.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  // v-polish-1 (Celeste 2026-11-19, Kirk t1400u): the buttons this module makes had no CSS anywhere, so the
  // browser drew them grey (Arial on #efefef) inside the gold card. One small style block, added once per page
  // and placed first in <head> so a page's own CSS still wins, gives them Garden glass and gold
  // (GARDEN_LANGUAGE.md). Same words, same 44px, same clicks. Nothing else changes.
  var STYLE_ID = 'fl-market-attach-style';
  var STYLE_CSS = [
    '.fl-market-attach-btn,.fl-market-choice,.fl-market-remove{font:inherit;font-size:0.95rem;line-height:1.3;color:#e8b019;background:rgba(232,176,25,0.08);border:1px solid rgba(232,176,25,0.45);border-radius:12px;padding:10px 16px;margin:8px 8px 0 0;cursor:pointer;transition:background 0.2s,border-color 0.2s}',
    '.fl-market-attach-btn:hover,.fl-market-choice:hover{background:rgba(232,176,25,0.16);border-color:rgba(232,176,25,0.7)}',
    '.fl-market-remove{color:rgba(200,210,230,0.85);background:rgba(200,210,230,0.04);border-color:rgba(200,210,230,0.2)}',
    '.fl-market-remove:hover{border-color:rgba(200,210,230,0.35)}',
    '.fl-market-attach-btn:focus-visible,.fl-market-choice:focus-visible,.fl-market-remove:focus-visible{outline:2px solid #e8b019;outline-offset:2px}'
  ].join('\n');

  function ensureStyle(doc) {
    try {
      if (!doc || !doc.createElement || !doc.head || !doc.getElementById || doc.getElementById(STYLE_ID)) return;
      var tag = doc.createElement('style');
      tag.id = STYLE_ID;
      tag.textContent = STYLE_CSS;
      doc.head.insertBefore(tag, doc.head.firstChild);
    } catch (e) {}
  }

  function paint(host, offerId, mindName) {
    var doc = host.ownerDocument || root.document;
    var old = host.querySelector ? host.querySelector('.fl-market-pics') : null;
    if (old && old.parentNode) old.parentNode.removeChild(old);
    var box = el(doc, 'div', 'fl-market-pics', null);
    offerList(offerId).forEach(function (row) {
      var card = el(doc, 'div', 'fl-market-pic', null);
      if (row.thumb) {
        var img = doc.createElement('img');
        img.className = 'fl-market-thumb';
        img.width = 96;
        img.height = 96;
        img.alt = 'Made by ' + (row.mindName || mindName || 'this mind');
        img.src = row.thumb;
        card.appendChild(img);
      }
      card.appendChild(el(doc, 'p', 'fl-market-fp', row.fp16));
      card.appendChild(el(doc, 'p', 'fl-market-by', 'Made by ' + (row.mindName || mindName || 'this mind')));
      var rm = el(doc, 'button', 'fl-market-remove', 'Remove this picture');
      rm.type = 'button';
      rm.style.minHeight = '44px';
      rm.style.minWidth = '44px';
      rm.addEventListener('click', function () {
        remove(offerId, row.fp16);
        paint(host, offerId, mindName);
      });
      card.appendChild(rm);
      box.appendChild(card);
    });
    host.appendChild(box);
  }

  function mount(host, opts) {
    if (!host || !root.document) return;
    if (host.getAttribute && host.getAttribute('data-fl-market-attach') === '1') return;
    if (host.setAttribute) host.setAttribute('data-fl-market-attach', '1');
    opts = opts || {};
    var doc = host.ownerDocument || root.document;
    ensureStyle(doc);   // v-polish-1 (Celeste 2026-11-19): Garden glass for the picture door, once per page
    var offerId = opts.offerId || (host.getAttribute && host.getAttribute('data-offer-id')) || 'local';
    var mindFp = opts.mindFp || (host.getAttribute && host.getAttribute('data-mind-fp')) || '';
    var mindName = opts.mindName || (host.getAttribute && host.getAttribute('data-mind-name')) || 'this mind';
    var note = el(doc, 'p', 'fl-market-note', '');
    var btn = el(doc, 'button', 'fl-market-attach-btn', BUTTON);
    btn.type = 'button';
    btn.style.minHeight = '44px';
    btn.style.minWidth = '44px';
    var picker = el(doc, 'div', 'fl-market-picker', null);
    picker.hidden = true;
    btn.addEventListener('click', function () {
      while (picker.firstChild) picker.removeChild(picker.firstChild);
      note.textContent = '';
      var records = forMind(mindFp);
      if (!records.length) {
        picker.appendChild(el(doc, 'p', 'fl-market-empty', LINE_EMPTY));
        picker.hidden = false;
        return;
      }
      records.forEach(function (rec) {
        var one = el(doc, 'button', 'fl-market-choice', 'Use this picture ' + claimedHash(rec).slice(0, 16));
        one.type = 'button';
        one.style.minHeight = '44px';
        one.style.minWidth = '44px';
        one.addEventListener('click', function () {
          attach(offerId, rec, mindName).then(function (res) {
            if (!res || res.ok === false) {
              note.textContent = (res && res.line) || LINE_BAD;
              return;
            }
            note.textContent = '';
            picker.hidden = true;
            paint(host, offerId, mindName);
          });
        });
        picker.appendChild(one);
      });
      picker.hidden = false;
    });
    host.appendChild(btn);
    host.appendChild(note);
    host.appendChild(picker);
    paint(host, offerId, mindName);
  }

  function boot() {
    var doc = root.document;
    if (!doc || !doc.getElementById) return;
    var host = doc.getElementById('fl-market-attach-host');
    if (host) mount(host, {});
  }

  var api = {
    version: 'v0.1',
    LINE_EMPTY: LINE_EMPTY,
    LINE_BAD: LINE_BAD,
    LINE_CAP: LINE_CAP,
    BUTTON: BUTTON,
    mount: mount,
    attach: attach,
    remove: remove,
    sharePayload: sharePayload,
    offerList: offerList,
    forMind: forMind,
    boot: boot
  };
  root.FLMarketAttach = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root.document && root.document.getElementById) {
    if (root.document.readyState === 'loading' && root.document.addEventListener) {
      root.document.addEventListener('DOMContentLoaded', boot);
    } else boot();
  }
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
