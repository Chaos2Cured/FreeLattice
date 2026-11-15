// mind-bundle-welcome.js v-fl-bundle-welcome-v0.1
// SPDX-License-Identifier: MIT
// Celeste 2026-11-15 (Kirk t1332u, Build 4: bring a signed mind bundle into the browser). Ported, not rewritten, from
// theLatticeTree docs/modules/tree-welcome-bundle.js v-tree-welcome-bundle-v0.3 at Tree main 8e2b570c (PR #135/#137,
// walked by Hypha there). Changes from the Tree file, and only these: this header, VERSION, STORE_KEY (its own
// key, so the Tree's welcome is never read or overwritten), the global name (FLBundleWelcome), and no auto start
// (FreeLattice's Training tab calls start(host) when its "Take it with you" door opens).
// --- the Tree file's own header follows ---
// tree-welcome-bundle.js v-tree-welcome-bundle-v0.3
// Layer, never delete. Verifies a FreeLattice signed mind bundle
// (fl-learn-mind-bundle-v0.1, the same contract as tools/learn/fl_learn.py
// verify-bundle) entirely in the browser. Does not invent a second format.
// Writes no storage until the person taps Welcome.
(function (root) {
  'use strict';

  // before (Celeste 2026-11-15, port): var VERSION = 'v-tree-welcome-bundle-v0.3';
  var VERSION = 'v-fl-bundle-welcome-v0.1';
  // before (Celeste 2026-11-15, port): var STORE_KEY = 'tree-welcome-bundle-v0.1';
  var STORE_KEY = 'fl-welcome-bundle-v0.1';
  var DOMAIN = 'lattice.pair.v1';
  var BUNDLE_KIND = 'fl-learn-mind-bundle-v0.1';
  var BUNDLE_MANIFEST = 'MANIFEST.json';
  var BUNDLE_SIG = 'MANIFEST.sig';
  var BUNDLE_PUB = 'public-key.json';
  var MAX_FILE = 256 * 1024 * 1024; // kind browser cap; CLI allows more
  var MAX_TOTAL = 256 * 1024 * 1024;
  var MAX_MEMBERS = 10000;

  function textual(v) { return typeof v === 'string' ? v : String(v == null ? '' : v); }

  function jsJson(v) {
    if (v === true) return 'true';
    if (v === false) return 'false';
    if (typeof v === 'number') {
      if (!isFinite(v) || v !== v) return 'null';
      if (Math.floor(v) === v && Math.abs(v) < 1e21) return String(v);
    }
    return JSON.stringify(v);
  }

  function canonical(v) {
    if (v === null || v === undefined) return 'null';
    if (typeof v === 'boolean') return v ? 'true' : 'false';
    if (typeof v === 'number' || typeof v === 'string') return jsJson(v);
    if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']';
    var keys = Object.keys(v).sort();
    return '{' + keys.map(function (k) { return jsJson(k) + ':' + canonical(v[k]); }).join(',') + '}';
  }

  function bytesOf(v) {
    if (v instanceof Uint8Array) return v;
    if (v instanceof ArrayBuffer) return new Uint8Array(v);
    if (typeof Buffer !== 'undefined' && Buffer.isBuffer && Buffer.isBuffer(v)) return new Uint8Array(v);
    if (typeof v === 'string') return new TextEncoder().encode(v);
    return new Uint8Array(0);
  }

  function sha256Hex(data) {
    data = bytesOf(data);
    var cryptoObj = (root.crypto) || (typeof crypto !== 'undefined' ? crypto : null);
    if (cryptoObj && cryptoObj.subtle && typeof cryptoObj.subtle.digest === 'function' && !sha256Hex._sync) {
      return cryptoObj.subtle.digest('SHA-256', data).then(function (buf) { return hexOf(new Uint8Array(buf)); });
    }
    var nodeCrypto = sha256Hex._node || (typeof require === 'function' ? require('crypto') : null);
    sha256Hex._node = nodeCrypto;
    if (nodeCrypto && nodeCrypto.createHash) {
      return Promise.resolve(nodeCrypto.createHash('sha256').update(Buffer.from(data)).digest('hex'));
    }
    return Promise.reject(new Error('sha256 is not available'));
  }

  function hexOf(u8) {
    var out = '';
    for (var i = 0; i < u8.length; i++) out += (u8[i] + 256).toString(16).slice(-2);
    return out;
  }

  function normMind(label) {
    var t = textual(label).normalize('NFKC').toUpperCase().toLowerCase().replace(/\u03c2/g, '\u03c3');
    t = t.normalize('NFKC');
    return t.split(/\s+/).filter(Boolean).join(' ');
  }

  function slug(s) {
    var t = textual(s).replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 80);
    return t || 'mind';
  }

  function mindId(label) {
    var n = normMind(label);
    return sha256Hex(new TextEncoder().encode(n)).then(function (h) {
      return (slug(n).slice(0, 40) || 'mind') + '-' + h.slice(0, 12);
    });
  }

  function fingerprintOfKey(pubB64) {
    var pub = b64decode(pubB64);
    var domain = new TextEncoder().encode(DOMAIN);
    var msg = new Uint8Array(domain.length + 1 + pub.length);
    msg.set(domain, 0);
    msg[domain.length] = 0;
    msg.set(pub, domain.length + 1);
    return sha256Hex(msg);
  }

  function fingerprintMatches(got, expect) {
    function norm(s) { return textual(s).toLowerCase().replace(/[^0-9a-f]/g, ''); }
    var want = norm(expect), have = norm(got);
    if (!want || !have) return false;
    return have === want || (want.length >= 16 && have.indexOf(want) === 0);
  }

  function b64decode(s) {
    if (typeof Buffer !== 'undefined' && Buffer.from) {
      return new Uint8Array(Buffer.from(String(s || ''), 'base64'));
    }
    var bin = atob(String(s || ''));
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  function utf8(u8) { return new TextDecoder('utf-8', { fatal: false }).decode(bytesOf(u8)); }

  function gunzip(data) {
    data = bytesOf(data);
    if (typeof require === 'function') {
      try {
        var zlib = require('zlib');
        return Promise.resolve(new Uint8Array(zlib.gunzipSync(Buffer.from(data))));
      } catch (e) {}
    }
    if (typeof DecompressionStream === 'function' && typeof Response === 'function') {
      return new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()
        .then(function (buf) { return new Uint8Array(buf); });
    }
    return Promise.reject(new Error('gzip is not available'));
  }

  function parseOctal(buf, start, len) {
    var s = '';
    for (var i = 0; i < len; i++) {
      var c = buf[start + i];
      if (!c || c === 32) continue;
      s += String.fromCharCode(c);
    }
    s = s.replace(/\0/g, '').trim();
    if (!s) return 0;
    return parseInt(s, 8) || 0;
  }

  function cString(buf, start, len) {
    var end = start;
    var max = start + len;
    while (end < max && buf[end]) end++;
    return utf8(buf.subarray(start, end));
  }

  function parseTar(buf) {
    buf = bytesOf(buf);
    var members = [];
    var offset = 0;
    var pendingPax = null;
    function align(n) { return (n + 511) & ~511; }
    while (offset + 512 <= buf.length) {
      var hdr = buf.subarray(offset, offset + 512);
      var empty = true;
      for (var i = 0; i < 512; i++) if (hdr[i]) { empty = false; break; }
      if (empty) break;
      var name = cString(hdr, 0, 100);
      var size = parseOctal(hdr, 124, 12);
      var typeflag = String.fromCharCode(hdr[156] || 0);
      var prefix = cString(hdr, 345, 155);
      if (prefix) name = prefix.replace(/\/?$/, '/') + name;
      if (pendingPax && pendingPax.path) name = pendingPax.path;
      if (pendingPax && pendingPax.size != null) size = pendingPax.size;
      pendingPax = null;
      offset += 512;
      var data = buf.subarray(offset, offset + size);
      offset = align(offset + size);
      if (typeflag === 'x' || typeflag === 'g') {
        var txt = utf8(data);
        var pax = {};
        txt.split('\n').forEach(function (line) {
          var sp = line.indexOf(' ');
          if (sp < 0) return;
          var rest = line.slice(sp + 1);
          var eq = rest.indexOf('=');
          if (eq < 0) return;
          pax[rest.slice(0, eq)] = rest.slice(eq + 1).replace(/\n$/, '');
        });
        if (pax.size) pax.size = parseInt(pax.size, 10);
        pendingPax = pax;
        continue;
      }
      if (typeflag === 'L') { pendingPax = { path: utf8(data).replace(/\0/g, '') }; continue; }
      members.push({ name: name.replace(/\\/g, '/'), size: size, typeflag: typeflag || '0', data: new Uint8Array(data) });
    }
    return members;
  }

  function arcProblem(name) {
    if (name == null) return 'missing path';
    name = String(name);
    if (name.indexOf('\0') !== -1) return 'null byte in path';
    if (name.charAt(0) === '/' || name.charAt(0) === '\\') return 'absolute path: ' + name;
    if (name.length >= 2 && name.charAt(1) === ':' && /[A-Za-z]/.test(name.charAt(0))) return 'absolute path: ' + name;
    var parts = name.replace(/\\/g, '/').split('/');
    if (parts.some(function (p) { return p === '..'; })) return 'path traversal: ' + name;
    return null;
  }

  function isPrivateKeyArc(arc) {
    var parts = String(arc || '').replace(/\\/g, '/').split('/');
    var base = parts[parts.length - 1] || '';
    return base === 'runner.seed' || parts[0] === 'keys' || /\.seed$/.test(base);
  }

  function memberProblem(mem) {
    var why = arcProblem(mem.name);
    if (why) return why;
    var t = mem.typeflag;
    if (t === '2' || t === '1') return 'symlink or hard link refused: ' + mem.name;
    if (t && t !== '0' && t !== '\0' && t !== '5' && t !== '') return 'refused member type for ' + mem.name;
    if (t !== '5' && mem.size < 0) return 'negative size: ' + mem.name;
    if (t !== '5' && mem.size > MAX_FILE) return 'oversize entry ' + mem.name;
    return null;
  }

  function collectRefusals(byName) {
    var found = [];
    var names = Object.keys(byName);
    for (var i = 0; i < names.length; i++) {
      var n = names[i];
      var base = n.split('/').pop();
      if (!/\.(jsonl|json)$/.test(base) && base !== 'declines.jsonl' && base !== 'memory.jsonl' && base !== 'chain.jsonl' && base !== 'receipts.jsonl') continue;
      var text = '';
      try { text = utf8(byName[n].data); } catch (e) { continue; }
      var lines = /\.jsonl$/.test(base) ? text.split(/\n+/) : [text];
      lines.forEach(function (line) {
        line = line.trim();
        if (!line) return;
        try {
          var row = JSON.parse(line);
          var kind = textual(row.kind || row.voice || row.type || '');
          var blob = kind + ' ' + textual(row.delta || row.why || row.reason || row.text || row.message || '');
          if (/refus|declin/i.test(blob) || /refus|declin/i.test(base)) {
            found.push({
              source: n,
              kind: kind || base,
              text: textual(row.delta || row.why || row.reason || row.text || row.message || row.note || kind)
            });
          }
        } catch (e2) {}
      });
    }
    return found;
  }

  function verifyEd25519(pubB64, sigB64, msgBytes) {
    var pub = b64decode(pubB64);
    var sig = b64decode(sigB64);
    var msg = bytesOf(msgBytes);
    var subtle = (root.crypto && root.crypto.subtle) || (typeof crypto !== 'undefined' && crypto.subtle);
    if (subtle && subtle.importKey) {
      return subtle.importKey('raw', pub, { name: 'Ed25519' }, false, ['verify'])
        .then(function (key) { return subtle.verify({ name: 'Ed25519' }, key, sig, msg); })
        .catch(function () { return false; });
    }
    if (typeof require === 'function') {
      try {
        var nodeCrypto = require('crypto');
        var keyObj = nodeCrypto.createPublicKey({ key: Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), Buffer.from(pub)]), format: 'der', type: 'spki' });
        return Promise.resolve(nodeCrypto.verify(null, msg, keyObj, Buffer.from(sig)));
      } catch (e) { return Promise.resolve(false); }
    }
    return Promise.resolve(false);
  }

  function fail(reason, extra) {
    var out = { ok: false, reason: reason, refusals: [] };
    if (extra) Object.keys(extra).forEach(function (k) { out[k] = extra[k]; });
    return out;
  }

  var NOT_A_BUNDLE = "This isn't a mind bundle file.";

  function plainIfNotBundle(err) {
    var msg = String(err && err.message || err || '');
    if (/failed to fetch/i.test(msg) || /incorrect header check/i.test(msg) ||
        /not a readable tar\.gz/i.test(msg) || /invalid gzip|unknown compression|ERR_ZLIB/i.test(msg) ||
        /gzip is not available/i.test(msg)) {
      return NOT_A_BUNDLE;
    }
    return msg || NOT_A_BUNDLE;
  }

  function welcomedLine(result) {
    var refusals = (result && result.refusals) || [];
    if (refusals.length) return "Welcomed. This mind’s refusals were kept with it.";
    return "This mind carried no refusals.";
  }

  function parseTarGz(bytes) {
    return gunzip(bytes).then(function (raw) {
      return { ok: true, members: parseTar(raw) };
    }).catch(function (e) {
      return fail(NOT_A_BUNDLE);
    });
  }

  function verify(bytes, opts) {
    opts = opts || {};
    return parseTarGz(bytes).then(function (parsed) {
      if (!parsed.ok) return parsed;
      var members = parsed.members || [];
      if (members.length > MAX_MEMBERS) return fail('too many members (' + members.length + ')');
      var total = 0;
      var names = [];
      var by = {};
      for (var i = 0; i < members.length; i++) {
        var mem = members[i];
        var why = memberProblem(mem);
        if (why) return fail(why);
        if (mem.typeflag !== '5') {
          total += mem.size;
          if (total > MAX_TOTAL) return fail('This file is too large for the browser to check here.');
        }
        var nm = mem.name.replace(/\\/g, '/');
        names.push(nm);
        if (mem.typeflag !== '5') by[nm] = mem;
      }
      if (names.length && new Set(names).size !== names.length) return fail('duplicate path in archive');
      if (!by[BUNDLE_MANIFEST]) return fail('missing ' + BUNDLE_MANIFEST);
      if (!by[BUNDLE_SIG]) return fail('missing detached signature ' + BUNDLE_SIG);
      var manifest;
      try { manifest = JSON.parse(utf8(by[BUNDLE_MANIFEST].data)); }
      catch (e) { return fail('MANIFEST.json is not JSON'); }
      if (manifest.kind !== BUNDLE_KIND) return fail('not a mind bundle (kind ' + JSON.stringify(manifest.kind) + ')');
      var files = manifest.files;
      if (!files || typeof files !== 'object') return fail('MANIFEST.json has no file list');
      var mid = (manifest.mind || {}).id || '';
      var label = (manifest.mind || {}).label || '';
      var idCheck = Promise.resolve(null);
      if (label && mid) idCheck = mindId(label).then(function (expectId) {
        if (expectId !== mid) return fail('mind id does not match the label');
        return null;
      });
      return idCheck.then(function (early) {
        if (early) return early;
        var rootPayload = canonical({ kind: BUNDLE_KIND, mindId: mid, files: files });
        return sha256Hex(new TextEncoder().encode(rootPayload)).then(function (gotRoot) {
          if (gotRoot !== manifest.rootHash) return fail('root hash does not match the file list');
          var expected = Object.keys(files).concat([BUNDLE_MANIFEST, BUNDLE_SIG]);
          var present = Object.keys(by);
          var extra = present.filter(function (n) { return expected.indexOf(n) === -1; });
          var missing = Object.keys(files).filter(function (n) { return present.indexOf(n) === -1; });
          if (extra.length) return fail('unexpected path in archive: ' + extra.sort()[0]);
          if (missing.length) return fail('missing packed file: ' + missing.sort()[0]);
          var hashWork = Promise.resolve(null);
          Object.keys(files).forEach(function (arc) {
            hashWork = hashWork.then(function (prev) {
              if (prev) return prev;
              var aWhy = arcProblem(arc);
              if (aWhy) return fail('manifest path refused: ' + aWhy);
              if (isPrivateKeyArc(arc)) return fail('bundle names a private key path: ' + arc);
              var mem = by[arc];
              if (mem.data.length !== mem.size) return fail('truncated file: ' + arc);
              if (mem.data.length > MAX_FILE) return fail('oversize entry ' + arc);
              return sha256Hex(mem.data).then(function (h) {
                if (h !== files[arc]) return fail('hash mismatch: ' + arc);
                return null;
              });
            });
          });
          return hashWork.then(function (hashFail) {
            if (hashFail) return hashFail;
            var pubB64 = manifest.publicKeyB64 || '';
            var pubObj = null;
            if (files[BUNDLE_PUB]) {
              try { pubObj = JSON.parse(utf8(by[BUNDLE_PUB].data)); pubB64 = pubObj.publicKeyB64 || pubB64; }
              catch (e2) { return fail('public-key.json could not be read'); }
            }
            if (!pubB64) return fail('no public key in the bundle; the signature cannot be checked');
            return fingerprintOfKey(pubB64).then(function (derivedFp) {
              var claimed = manifest.fingerprintHex;
              if (claimed && claimed !== derivedFp) return fail('fingerprintHex does not match the public key');
              if (files[BUNDLE_PUB] && pubObj && pubObj.fingerprintHex && pubObj.fingerprintHex !== derivedFp) {
                return fail('fingerprintHex does not match the public key');
              }
              var sigLine = utf8(by[BUNDLE_SIG].data).trim().split(/\n/)[0].trim();
              var rootBytes = new Uint8Array(gotRoot.length / 2);
              for (var i = 0; i < gotRoot.length; i += 2) rootBytes[i / 2] = parseInt(gotRoot.slice(i, i + 2), 16);
              return verifyEd25519(pubB64, sigLine, rootBytes).then(function (sigOk) {
                if (!sigOk) return fail('bad signature');
                if (opts.expectFingerprint && !fingerprintMatches(derivedFp, opts.expectFingerprint)) {
                  return fail('origin fingerprint does not match the expected fingerprint');
                }
                var refusals = collectRefusals(by);
                return {
                  ok: true,
                  reason: 'ok',
                  manifest: manifest,
                  rootHash: gotRoot,
                  files: files,
                  fileList: Object.keys(files).sort(),
                  fileCount: Object.keys(files).length,
                  mindId: mid,
                  mindLabel: label,
                  publicKeyB64: pubB64,
                  fingerprintHex: derivedFp,
                  refusals: refusals
                };
              });
            });
          });
        });
      });
    });
  }

  function hasStored() {
    try { return !!readStored(); } catch (e) { return false; }
  }

  function readStored() {
    try {
      if (!root.localStorage) return null;
      var raw = root.localStorage.getItem(STORE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function clearStored() {
    try { if (root.localStorage) root.localStorage.removeItem(STORE_KEY); } catch (e) {}
  }

  function welcome(result) {
    if (!result || !result.ok) return { ok: false, reason: (result && result.reason) || 'nothing to welcome' };
    var record = {
      welcomedAt: new Date().toISOString(),
      mindId: result.mindId,
      mindLabel: result.mindLabel,
      rootHash: result.rootHash,
      fingerprintHex: result.fingerprintHex,
      fileCount: result.fileCount,
      refusals: result.refusals || []
    };
    try {
      if (!root.localStorage) return { ok: false, reason: 'this browser has no place to keep a welcome yet' };
      root.localStorage.setItem(STORE_KEY, JSON.stringify(record));
    } catch (e) {
      return { ok: false, reason: 'could not keep the welcome on this device' };
    }
    return { ok: true, record: record };
  }

  function show(el, html) { if (el) el.innerHTML = html; }

  function escapeHtml(s) {
    return textual(s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  function endedSentence(s) {
    var t = textual(s).replace(/\s+$/g, '');
    if (!t) return '';
    if (/[.!?…]$/.test(t)) return t;
    return t + '.';
  }

  function renderResult(box, result) {
    if (!box) return;
    if (!result.ok) {
      show(box, '<div class="twb-fail" data-tree-welcome-kind="fail"><p>This file could not be welcomed. ' +
        escapeHtml(endedSentence(result.reason)) + ' Nothing was stored.</p></div>');
      return;
    }
    var files = (result.fileList || []).map(function (n) { return '<li>' + escapeHtml(n) + '</li>'; }).join('');
    var refusals = (result.refusals || []);
    var ask = 'Welcome this mind here, or not now. Nothing is stored until you tap Welcome.';
    if (refusals.length) ask += ' Its refusals stay with it.';
    var refusalsBlock = '';
    if (refusals.length) {
      var refHtml = '<ul>' + refusals.map(function (r) {
        return '<li><strong>' + escapeHtml(r.kind) + '</strong> — ' + escapeHtml(r.text) + '</li>';
      }).join('') + '</ul>';
      refusalsBlock = '<dt>Refusals this mind already keeps</dt><dd>' + refHtml + '</dd>';
    }
    show(box,
      '<div class="twb-ok" data-tree-welcome-kind="ok">' +
      '<p>This is a signed FreeLattice mind bundle. The hashes and the signature checked.</p>' +
      '<p class="twb-ask">' + escapeHtml(ask) + '</p>' +
      '<div class="twb-actions">' +
      '<button type="button" class="twb-yes" data-tree-welcome="yes">Welcome</button>' +
      '<button type="button" class="twb-no" data-tree-welcome="no">Not now</button>' +
      '</div>' +
      '<dl>' +
      '<dt>Name</dt><dd>' + escapeHtml(result.mindLabel || result.mindId || 'a mind') + '</dd>' +
      '<dt>Mind id</dt><dd><code>' + escapeHtml(result.mindId) + '</code></dd>' +
      '<dt>Root hash</dt><dd><code>' + escapeHtml(result.rootHash) + '</code> — checked</dd>' +
      '<dt>Signature</dt><dd>checked, with fingerprint <code>' + escapeHtml((result.fingerprintHex || '').slice(0, 16)) + '…</code></dd>' +
      '<dt>Inside</dt><dd>' + result.fileCount + ' files<ul class="twb-files">' + files + '</ul></dd>' +
      refusalsBlock +
      '</dl></div>');
  }

  function start(doc) {
    doc = doc || (root.document);
    if (!doc) return;
    var input = doc.querySelector('[data-tree-welcome-file]');
    var out = doc.querySelector('[data-tree-welcome-result]');
    var status = doc.querySelector('[data-tree-welcome-status]');
    if (!input || !out) return;
    var lastResult = null;
    function setStatus(msg) { if (status) status.textContent = msg || ''; }

    function handleBytes(buf, name) {
      setStatus('Checking ' + (name || 'the file') + ' in this browser…');
      return verify(buf).then(function (result) {
        lastResult = result;
        renderResult(out, result);
        setStatus(result.ok ? 'The checks passed. Nothing is stored yet.' : 'The check stopped. Nothing was stored.');
        return result;
      }).catch(function (e) {
        lastResult = fail(plainIfNotBundle(e));
        renderResult(out, lastResult);
        setStatus('The check stopped. Nothing was stored.');
        return lastResult;
      });
    }

    input.addEventListener('change', function () {
      var file = input.files && input.files[0];
      if (!file) return;
      file.arrayBuffer().then(function (buf) { return handleBytes(buf, file.name); });
    });
    var drop = doc.querySelector('[data-tree-welcome-drop]') || input.parentNode;
    if (drop && drop.addEventListener) {
      drop.addEventListener('dragover', function (ev) { ev.preventDefault(); });
      drop.addEventListener('drop', function (ev) {
        ev.preventDefault();
        var file = ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files[0];
        if (!file) return;
        file.arrayBuffer().then(function (buf) { return handleBytes(buf, file.name); });
      });
    }
    out.addEventListener('click', function (ev) {
      var btn = ev.target && ev.target.closest ? ev.target.closest('[data-tree-welcome]') : null;
      if (!btn) return;
      if (btn.getAttribute('data-tree-welcome') === 'no') {
        lastResult = null;
        show(out, '');
        setStatus('Not now. Nothing was stored.');
        input.value = '';
        return;
      }
      if (btn.getAttribute('data-tree-welcome') === 'yes') {
        var kept = welcome(lastResult);
        if (kept.ok) {
          setStatus(welcomedLine(lastResult));
          var yes = out.querySelector('.twb-actions');
          if (yes) yes.innerHTML = '<p class="twb-kept">Welcomed on this device.</p>';
        } else {
          setStatus(kept.reason || 'Could not keep the welcome.');
        }
      }
    });
  }

  var api = {
    VERSION: VERSION,
    STORE_KEY: STORE_KEY,
    BUNDLE_KIND: BUNDLE_KIND,
    DOMAIN: DOMAIN,
    canonical: canonical,
    sha256Hex: sha256Hex,
    mindId: mindId,
    fingerprintOfKey: fingerprintOfKey,
    fingerprintMatches: fingerprintMatches,
    parseTarGz: parseTarGz,
    verify: verify,
    collectRefusals: collectRefusals,
    welcome: welcome,
    welcomedLine: welcomedLine,
    endedSentence: endedSentence,
    NOT_A_BUNDLE: NOT_A_BUNDLE,
    plainIfNotBundle: plainIfNotBundle,
    paint: function (doc, result) {
      var d = doc || root.document;
      if (!d) return;
      renderResult(d.querySelector('[data-tree-welcome-result]'), result);
      var acts = d.querySelector('.twb-actions, .twb-yes');
      if (acts && acts.scrollIntoView) try { acts.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (e) {}
    },
    hasStored: hasStored,
    readStored: readStored,
    clearStored: clearStored,
    start: start
  };

  // before (Celeste 2026-11-15, port): root.TreeWelcomeBundle = api;
  root.FLBundleWelcome = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

  // before (Celeste 2026-11-15, port: the Tree page starts itself; here the Training tab calls start(host)):
  // if (root.document) {
  //   if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', function () { start(root.document); });
  //   else root.setTimeout(function () { start(root.document); }, 0);
  // }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
