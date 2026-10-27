// mind-image.js (MIT)
// v-mind-image-v0.1
// A mind may offer a picture. The person decides. Nothing leaves this computer.
// Image safety, then the likeness line, then either the local image server or the browser canvas.
// mind-make.js, image-local.js, and image-safety.js stay as they are.
(function (root) {
  'use strict';

  var SERVER = 'http://127.0.0.1:7860/sdapi/v1/txt2img';
  var STEPS = 20;
  var SERVER_SIZE = 512;
  var DB_NAME = 'FreeLatticeMindImages';
  var STORE = 'pictures';
  var made = [];
  var crcTable = null;

  function clip(text, n) {
    var s = String(text == null ? '' : text).replace(/\s+/g, ' ').trim();
    if (s.length > n) s = s.slice(0, n);
    return s;
  }

  function blocked() {
    try {
      if (root.__flUserPaused === true) return true;
      if (root.localStorage && root.localStorage.getItem('fl_autonomous_user_paused') === 'true') return true;
    } catch (e) {}
    try {
      if (root.__flQuietRoom === true) return true;
      var d = root.document;
      if (!d || !d.querySelector) return false;
      var b = d.querySelector('.tab-btn.active, [data-tab].active');
      var t = b && b.dataset && b.dataset.tab;
      if (!t) return false;
      var name = String(t).toLowerCase();
      return name === 'quiet' || name === 'quiet-room' || name === 'sanctuary';
    } catch (e2) { return false; }
  }

  function mindName() {
    var name = '';
    try {
      var mind = root.LocalMindProbe && root.LocalMindProbe.getRemembered && root.LocalMindProbe.getRemembered();
      if (mind && mind.name) name = String(mind.name);
    } catch (e) {}
    try {
      if (!name && root.state && (root.state.mindName || root.state.aiName)) name = String(root.state.mindName || root.state.aiName);
    } catch (e2) {}
    return clip(name, 80) || 'Your mind';
  }

  function safety(ask) {
    var line = 'That one I cannot make.';
    var calm = (root.FLLikeness && root.FLLikeness.LINE) || line;
    try {
      if (!root.ImageSafety || typeof root.ImageSafety.assessImageRequest !== 'function') return { ok: false, line: line };
      var gate = root.ImageSafety.assessImageRequest(ask);
      if (!gate || gate.allowed !== true) return { ok: false, line: line };
    } catch (e) { return { ok: false, line: line }; }
    try {
      if (!root.FLLikeness || typeof root.FLLikeness.assess !== 'function') return { ok: false, line: calm };
      var like = root.FLLikeness.assess(ask);
      if (!like || like.ok === false) return { ok: false, line: calm };
    } catch (e2) { return { ok: false, line: calm }; }
    return { ok: true, line: '' };
  }

  function serverReady() {
    try { return !!(root.FLImageLocal && typeof root.FLImageLocal.ready === 'function' && root.FLImageLocal.ready()); }
    catch (e) { return false; }
  }

  function rawArt() {
    var raw = '';
    try { raw = String(root.__flMindImageRaw || ''); } catch (e) { raw = ''; }
    var at = raw.indexOf('[FL_MAKE:');
    if (at < 0) return null;
    var start = raw.indexOf('{', at);
    if (start < 0) return null;
    var depth = 0;
    var inStr = false;
    var esc = false;
    var end = -1;
    var i;
    for (i = start; i < raw.length && i < start + 4096; i++) {
      var ch = raw.charAt(i);
      if (inStr) {
        if (esc) { esc = false; continue; }
        if (ch === '\\') { esc = true; continue; }
        if (ch === '"') inStr = false;
        continue;
      }
      if (ch === '"') { inStr = true; continue; }
      if (ch === '{') depth += 1;
      else if (ch === '}') {
        depth -= 1;
        if (depth === 0) { end = i; break; }
      }
    }
    if (end < 0) return null;
    try {
      var value = JSON.parse(raw.slice(start, end + 1));
      if (!value || String(value.kind || '').toLowerCase() !== 'image') return null;
      return value.art || null;
    } catch (err) { return null; }
  }

  function crc32(bytes) {
    if (!crcTable) {
      crcTable = new Uint32Array(256);
      var n;
      var k;
      for (n = 0; n < 256; n++) {
        var c = n;
        for (k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
        crcTable[n] = c >>> 0;
      }
    }
    var sum = 0xffffffff;
    var i;
    for (i = 0; i < bytes.length; i++) sum = crcTable[(sum ^ bytes[i]) & 255] ^ (sum >>> 8);
    return (sum ^ 0xffffffff) >>> 0;
  }

  function concat(parts) {
    var n = 0;
    var i;
    for (i = 0; i < parts.length; i++) n += parts[i].length;
    var out = new Uint8Array(n);
    var o = 0;
    for (i = 0; i < parts.length; i++) {
      out.set(parts[i], o);
      o += parts[i].length;
    }
    return out;
  }

  function u32(n) {
    return new Uint8Array([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]);
  }

  function asciiJson(obj) {
    var s = JSON.stringify(obj);
    var out = '';
    var i;
    for (i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      if (c < 128) out += s.charAt(i);
      else out += '\\u' + ('0000' + c.toString(16)).slice(-4);
    }
    return out;
  }

  function withText(png, obj) {
    var at = 8;
    var iend = -1;
    while (at + 12 <= png.length) {
      var len = ((png[at] << 24) | (png[at + 1] << 16) | (png[at + 2] << 8) | png[at + 3]) >>> 0;
      var type = String.fromCharCode(png[at + 4], png[at + 5], png[at + 6], png[at + 7]);
      if (type === 'IEND') { iend = at; break; }
      at += 12 + len;
    }
    if (iend < 0) return png;
    var keyword = 'FreeLattice';
    var text = asciiJson(obj);
    var data = new Uint8Array(keyword.length + 1 + text.length);
    var i;
    for (i = 0; i < keyword.length; i++) data[i] = keyword.charCodeAt(i);
    data[keyword.length] = 0;
    for (i = 0; i < text.length; i++) data[keyword.length + 1 + i] = text.charCodeAt(i) & 255;
    var typeBytes = new Uint8Array([116, 69, 88, 116]);
    var crc = crc32(concat([typeBytes, data]));
    var chunk = concat([u32(data.length), typeBytes, data, u32(crc)]);
    return concat([png.subarray(0, iend), chunk, png.subarray(iend)]);
  }

  function sha256(bytes) {
    var subtle = root.crypto && root.crypto.subtle;
    if (!subtle) return Promise.resolve('');
    var copy = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    return subtle.digest('SHA-256', copy).then(function (buf) {
      var arr = new Uint8Array(buf);
      var hex = '';
      var i;
      for (i = 0; i < arr.length; i++) hex += ('0' + arr[i].toString(16)).slice(-2);
      return hex;
    });
  }

  function b64ToBytes(raw) {
    var s = String(raw || '');
    var comma = s.indexOf('base64,');
    if (comma >= 0) s = s.slice(comma + 7);
    var bin = atob(s);
    var out = new Uint8Array(bin.length);
    var i;
    for (i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i) & 255;
    return out;
  }

  function bytesToB64(bytes) {
    var s = '';
    var i;
    for (i = 0; i < bytes.length; i += 0x8000) {
      s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(s);
  }

  function proofFor(row, path) {
    var proof = {
      kind: 'image',
      path: path,
      ask: row.ask,
      seed: row.seed,
      mind: row.mind
    };
    if (path === 'server') {
      proof.size = [SERVER_SIZE, SERVER_SIZE];
      proof.server = { steps: STEPS, width: SERVER_SIZE, height: SERVER_SIZE, seed: row.seed };
    } else {
      proof.size = [row.size, row.size];
      proof.recipe = {
        palette: row.palette,
        forms: row.forms,
        mood: row.mood,
        orb: !!row.orb
      };
    }
    return proof;
  }

  function seal(png, proof) {
    var bytes = withText(png, proof);
    return sha256(bytes).then(function (fingerprint) {
      return { bytes: bytes, fingerprint: fingerprint, proof: proof };
    });
  }

  function ensureStyle() {
    var d = root.document;
    if (!d || !d.getElementById || d.getElementById('fl-mind-image-style')) return;
    var style = d.createElement('style');
    style.id = 'fl-mind-image-style';
    style.textContent = [
      '.fl-mind-image,.fl-mind-image-note{max-width:100%;box-sizing:border-box;margin:8px 0 0;overflow-wrap:anywhere;}',
      '.fl-mind-image img{width:100%;height:auto;display:block;background:#0c0a1a;}',
      '.fl-mind-image button,.fl-mind-image summary{min-height:44px;min-width:44px;box-sizing:border-box;}',
      '.fl-mind-image button{margin:6px 8px 0 0;padding:10px 14px;font:inherit;}',
      '.fl-mind-image summary{display:flex;align-items:center;cursor:pointer;}',
      '.fl-mind-image button:focus-visible,.fl-mind-image summary:focus-visible{outline:2px solid #f3d98a;outline-offset:2px;}',
      '.fl-mind-image-thumbs img{width:96px;height:96px;object-fit:cover;}',
      '@media (prefers-reduced-motion: reduce){.fl-mind-image,.fl-mind-image *{animation:none !important;transition:none !important;}}'
    ].join('');
    if (d.head) d.head.appendChild(style);
  }

  function replyBubble() {
    var d = root.document;
    if (!d || !d.getElementById) return null;
    var card = d.getElementById('fl-make-offer');
    var node = card;
    while (node && node.classList && !node.classList.contains('chat-message')) node = node.parentNode;
    if (node && node.classList && node.classList.contains('chat-message')) return node;
    return d.getElementById('chatMessages');
  }

  function place(node) {
    var bubble = replyBubble();
    if (!bubble || !bubble.parentNode) return;
    if (bubble.id === 'chatMessages') bubble.appendChild(node);
    else if (bubble.nextSibling) bubble.parentNode.insertBefore(node, bubble.nextSibling);
    else bubble.parentNode.appendChild(node);
  }

  function say(line) {
    var d = root.document;
    if (!d || !line) return;
    ensureStyle();
    var p = d.createElement('p');
    p.className = 'fl-mind-image-note';
    p.textContent = line;
    place(p);
  }

  function download(fig) {
    var d = root.document;
    if (!d || !fig || !fig._flPngBytes || !root.URL) return;
    var blob = new Blob([fig._flPngBytes], { type: 'image/png' });
    var url = root.URL.createObjectURL(blob);
    var a = d.createElement('a');
    a.href = url;
    a.download = 'mind-image.png';
    a.textContent = 'mind-image.png';
    d.body.appendChild(a);
    a.click();
    d.body.removeChild(a);
    try { root.URL.revokeObjectURL(url); } catch (e) {}
  }

  function samePixels(a, b) {
    if (!a || !b || a.length !== b.length) return false;
    var i;
    for (i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return false;
    return true;
  }

  function verify(fig, out) {
    if (!fig || !fig._flPngBytes) {
      out.textContent = 'Does not match';
      return Promise.resolve();
    }
    return sha256(fig._flPngBytes).then(function (hex) {
      var hashOk = hex && hex === fig._flFp;
      if (fig._flPath !== 'canvas' || !fig._flRecipe || !root.FLMindCanvas) {
        out.textContent = hashOk ? 'Matches' : 'Does not match';
        return;
      }
      var scratch = root.document.createElement('canvas');
      return root.FLMindCanvas.paint(scratch, fig._flRecipe).then(function (canvas) {
        var ctx = canvas.getContext('2d', { willReadFrequently: true });
        var again = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        var pixelsOk = samePixels(fig._flPixels, again);
        out.textContent = hashOk && pixelsOk ? 'Matches' : 'Does not match';
      });
    }).catch(function () { out.textContent = 'Does not match'; });
  }

  function show(meta) {
    var d = root.document;
    if (!d) return;
    ensureStyle();
    var fig = d.createElement('figure');
    fig.className = 'fl-mind-image';
    if (meta.title) {
      var title = d.createElement('p');
      title.className = 'fl-mind-image-title';
      title.textContent = meta.title;
      fig.appendChild(title);
    }
    var img = d.createElement('img');
    img.alt = meta.ask || '';
    img.width = meta.width;
    img.height = meta.height;
    img.style.aspectRatio = meta.width + ' / ' + meta.height;
    img.style.width = '100%';
    img.style.height = 'auto';
    fig.appendChild(img);
    var path = d.createElement('p');
    path.textContent = meta.pathLine;
    fig.appendChild(path);
    if (meta.voice) {
      var voice = d.createElement('p');
      voice.textContent = meta.voice;
      fig.appendChild(voice);
    }
    var short = d.createElement('p');
    short.textContent = meta.fingerprint.slice(0, 16);
    fig.appendChild(short);
    var details = d.createElement('details');
    var summary = d.createElement('summary');
    summary.textContent = 'Full fingerprint';
    var full = d.createElement('p');
    full.textContent = meta.fingerprint;
    details.appendChild(summary);
    details.appendChild(full);
    fig.appendChild(details);
    var save = d.createElement('button');
    save.type = 'button';
    save.textContent = 'Save image';
    var check = d.createElement('button');
    check.type = 'button';
    check.textContent = 'Check fingerprint';
    var result = d.createElement('p');
    result.className = 'fl-mind-image-check';
    save.addEventListener('click', function () { download(fig); });
    check.addEventListener('click', function () { verify(fig, result); });
    fig.appendChild(save);
    fig.appendChild(check);
    fig.appendChild(result);
    fig._flPngBytes = meta.bytes;
    fig._flFp = meta.fingerprint;
    fig._flPath = meta.path;
    fig._flRecipe = meta.recipe || null;
    fig._flPixels = meta.pixels || null;
    place(fig);
    var blob = new Blob([meta.bytes], { type: 'image/png' });
    img.src = root.URL.createObjectURL(blob);
  }

  function openDb() {
    return new Promise(function (resolve, reject) {
      if (!root.indexedDB) { reject(new Error('no-db')); return; }
      var req = root.indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'fingerprint' });
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }

  function rememberLocal(ask, path, fingerprint) {
    try {
      if (root.FLImageLocal && typeof root.FLImageLocal.remember === 'function') {
        root.FLImageLocal.remember({
          prompt: ask,
          modelId: path === 'server' ? 'mind-server' : 'mind-canvas',
          credit: fingerprint.slice(0, 16)
        });
      }
    } catch (e) {}
  }

  function keep(meta) {
    var row = {
      fingerprint: meta.fingerprint,
      bytes: meta.bytes,
      b64: bytesToB64(meta.bytes),
      ask: meta.ask,
      path: meta.path,
      seed: meta.seed,
      mind: meta.mind,
      mindFp: 'mind:' + meta.mind,
      t: new Date().toISOString(),
      width: meta.width,
      height: meta.height
    };
    made.push(row);
    rememberLocal(meta.ask, meta.path, meta.fingerprint);
    openDb().then(function (db) {
      try {
        var tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(row);
      } catch (e) {}
    }).catch(function () {});
    return meta.fingerprint.slice(0, 8);
  }

  function serverMake(row) {
    var ctrl = typeof root.AbortController === 'function' ? new root.AbortController() : null;
    var timer = root.setTimeout(function () { try { if (ctrl) ctrl.abort(); } catch (e) {} }, 60000);
    return Promise.resolve(root.fetch(SERVER, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: row.ask,
        seed: row.seed,
        steps: STEPS,
        width: SERVER_SIZE,
        height: SERVER_SIZE
      }),
      signal: ctrl ? ctrl.signal : undefined
    })).then(function (res) {
      root.clearTimeout(timer);
      if (!res || !res.ok) return null;
      var kind = '';
      try { kind = String(res.headers && res.headers.get ? (res.headers.get('content-type') || '') : ''); } catch (e) { kind = ''; }
      if (kind.indexOf('image/') === 0 && res.arrayBuffer) {
        return res.arrayBuffer().then(function (buf) { return new Uint8Array(buf); });
      }
      return res.json().then(function (data) {
        var raw = data && data.images && data.images[0];
        if (!raw) return null;
        return b64ToBytes(raw);
      });
    }, function () {
      root.clearTimeout(timer);
      return null;
    }).then(function (png) {
      if (!png || !png.length) return null;
      return seal(png, proofFor(row, 'server')).then(function (sealed) {
        show({
          bytes: sealed.bytes,
          fingerprint: sealed.fingerprint,
          ask: row.ask,
          title: row.title,
          width: SERVER_SIZE,
          height: SERVER_SIZE,
          path: 'server',
          pathLine: 'Made on this computer by your image server',
          voice: row.hand || '',
          recipe: null,
          pixels: null
        });
        return keep({
          fingerprint: sealed.fingerprint,
          bytes: sealed.bytes,
          ask: row.ask,
          path: 'server',
          seed: row.seed,
          mind: row.mind,
          width: SERVER_SIZE,
          height: SERVER_SIZE
        });
      });
    }).catch(function () { return null; });
  }

  function canvasMake(row) {
    var d = root.document;
    if (!d || !root.FLMindCanvas || typeof root.FLMindCanvas.paint !== 'function') return Promise.resolve('none');
    var canvas = d.createElement('canvas');
    return root.FLMindCanvas.paint(canvas, row).then(function () {
      var ctx = canvas.getContext('2d', { willReadFrequently: true });
      var pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      var copy = new Uint8ClampedArray(pixels.length);
      copy.set(pixels);
      return new Promise(function (resolve, reject) {
        canvas.toBlob(function (blob) {
          if (!blob || !blob.arrayBuffer) { reject(new Error('png')); return; }
          blob.arrayBuffer().then(function (buf) { resolve(new Uint8Array(buf)); }, reject);
        }, 'image/png');
      }).then(function (png) {
        return seal(png, proofFor(row, 'canvas')).then(function (sealed) {
          show({
            bytes: sealed.bytes,
            fingerprint: sealed.fingerprint,
            ask: row.ask,
            title: row.title,
            width: row.size,
            height: row.size,
            path: 'canvas',
            pathLine: 'Drawn in your browser by ' + (row.mind || mindName()),
            voice: root.FLMindCanvas.speak(row),
            recipe: row,
            pixels: copy
          });
          return keep({
            fingerprint: sealed.fingerprint,
            bytes: sealed.bytes,
            ask: row.ask,
            path: 'canvas',
            seed: row.seed,
            mind: row.mind,
            width: row.size,
            height: row.size
          });
        });
      });
    });
  }

  function run(offer) {
    if (blocked()) return Promise.resolve('none');
    var ask = clip(offer && offer.ask, 280);
    if (!ask) return Promise.resolve('none');
    var gate = safety(ask);
    if (!gate.ok) {
      say(gate.line);
      return Promise.resolve('none');
    }
    if (!root.FLMindCanvas || typeof root.FLMindCanvas.recipe !== 'function') return Promise.resolve('none');
    var art = null;
    try { art = (offer && offer.art) || rawArt(); } catch (e) { art = null; }
    var mind = mindName();
    return root.FLMindCanvas.recipe(ask, mind, art).then(function (row) {
      if (blocked()) return 'none';
      if (serverReady()) {
        return serverMake(row).then(function (fp8) {
          if (fp8) return fp8;
          say('The image server on this computer did not finish this picture.');
          return canvasMake(row);
        });
      }
      return canvasMake(row);
    }).then(function (fp8) {
      return fp8 || 'none';
    }, function () {
      say('That picture did not finish.');
      return 'none';
    });
  }

  function paintThumbs(view) {
    if (!made.length || !root.document) return;
    var d = root.document;
    var box = d.createElement('div');
    box.className = 'fl-mind-image-thumbs';
    made.forEach(function (row) {
      var item = d.createElement('figure');
      var img = d.createElement('img');
      img.width = 96;
      img.height = 96;
      img.alt = row.ask || '';
      if (row.bytes && root.URL) img.src = root.URL.createObjectURL(new Blob([row.bytes], { type: 'image/png' }));
      var cap = d.createElement('p');
      cap.textContent = String(row.fingerprint || '').slice(0, 16);
      item.appendChild(img);
      item.appendChild(cap);
      box.appendChild(item);
    });
    view.appendChild(box);
  }

  function watchLedger() {
    var d = root.document;
    if (!d || !d.body || typeof MutationObserver !== 'function') return;
    try {
      var obs = new MutationObserver(function () {
        var view = d.getElementById('fl-make-ledger');
        if (!view || view.hidden || view.querySelector('.fl-mind-image-thumbs')) return;
        paintThumbs(view);
      });
      obs.observe(d.body, { childList: true, subtree: true });
    } catch (e) {}
  }

  function loadStore() {
    openDb().then(function (db) {
      var tx = db.transaction(STORE, 'readonly');
      var req = tx.objectStore(STORE).getAll();
      req.onsuccess = function () {
        var rows = req.result || [];
        rows.forEach(function (row) {
          if (!row || !row.fingerprint) return;
          if (made.some(function (have) { return have.fingerprint === row.fingerprint; })) return;
          made.push(row);
        });
      };
    }).catch(function () {});
  }

  function toList(row) {
    return {
      mindFp: row.mindFp || ('mind:' + (row.mind || '')),
      mindName: row.mind || '',
      byteHash: row.fingerprint,
      hash: row.fingerprint,
      bytes: row.b64 || (row.bytes ? bytesToB64(row.bytes) : ''),
      madeBy: 'mind',
      ask: row.ask || '',
      path: row.path || ''
    };
  }

  function boot() {
    if (!root.FLMake || typeof root.FLMake.register !== 'function' || root.__flMindImageBoot) return;
    root.__flMindImageBoot = true;
    var prevReply = root.FLMake.onReply;
    if (typeof prevReply === 'function') {
      root.FLMake.onReply = function (text, anchor) {
        try { root.__flMindImageRaw = String(text || ''); } catch (e) {}
        return prevReply.apply(root.FLMake, arguments);
      };
    }
    var prevDelta = root.FLMake.promptDelta;
    if (typeof prevDelta === 'function') {
      root.FLMake.promptDelta = function () {
        var base = prevDelta();
        return base + ' You may offer an image the same way, with kind image. You may add art with palette, forms, seed, and a short hand line. The person decides. You do not make it yourself.';
      };
    }
    root.FLMake.register('image', {
      describe: function () { return 'Image'; },
      offer: function (row) { return row; },
      run: run
    });
    ensureStyle();
    watchLedger();
    loadStore();
  }

  root.FLMindImage = { version: 'v0.1', run: run };
  root.FLMindImages = {
    list: function () { return made.map(toList); }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = { run: run };
  boot();
  if (!root.__flMindImageBoot && root.document && root.document.addEventListener) {
    root.document.addEventListener('DOMContentLoaded', boot);
  }
})(typeof window !== 'undefined' ? window : globalThis);
