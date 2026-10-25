// image-local.js (MIT) v-image-local-first-v0.1
// Look for one image server on this computer, only after the person says Yes.
// The token path stays optional. Every image keeps both fingerprints.
// The bright-line check runs on this path too.
(function (root) {
  'use strict';

  var PROBE_URL = 'http://127.0.0.1:7860/sdapi/v1/sd-models';
  var GEN_URL = 'http://127.0.0.1:7860/sdapi/v1/txt2img';
  var PERSON_KEY = 'fl_person_fp';
  var RECORD_KEY = 'fl_image_records';
  var HONEST_NONE = 'No local image server was found on this computer. Image making can still use the token in Settings.';
  var HONEST_READY = 'A local image server on this computer is ready.';
  var HONEST_DOC = 'Look on this computer asks only this computer, and only after you say Yes. It looks for one local image server. If that server answers, image making uses it first. If it does not answer, the line says so, and the token above still works.';
  var CLEAR_MISS = 'That model is not available from the image service. You can choose another in Settings, or use a local image server on this computer.';
  var REST_LINE = 'Image making is resting: the safety check did not load.';

  var _yes = false;
  var _found = false;
  var _status = null;

  function safetyReady() {
    try {
      if (!root.ImageSafety || typeof root.ImageSafety.assessImageRequest !== 'function') return false;
      root.ImageSafety.assessImageRequest('a red door');
      return true;
    } catch (e) { return false; }
  }
  function assess(text) {
    if (!root.ImageSafety || typeof root.ImageSafety.assessImageRequest !== 'function') {
      return { allowed: false, reason: REST_LINE };
    }
    var gate = null;
    try { gate = root.ImageSafety.assessImageRequest(String(text || '')); }
    catch (e) { return { allowed: false, reason: REST_LINE }; }
    if (!gate || gate.allowed !== true) {
      return { allowed: false, reason: (gate && gate.reason) || REST_LINE };
    }
    // v-likeness-line-v0.1: right after ImageSafety.assessImageRequest. No off switch.
    // before 047b: the next line was the only return after an allowed gate.
    if (root.FLLikeness && typeof root.FLLikeness.assess === 'function') {
      var like = null;
      try { like = root.FLLikeness.assess(String(text || '')); }
      catch (eLike) { like = { ok: false }; }
      if (!like || like.ok === false) {
        var likeLine = (root.FLLikeness && root.FLLikeness.LINE) || (like && like.words) || '';
        return { allowed: false, reason: likeLine };
      }
    }
    return gate;
  }
  function ready() { return _yes === true && _found === true; }
  function setStatus(text) { if (_status) _status.textContent = text; }

  function personFp() {
    try {
      var cur = root.localStorage ? root.localStorage.getItem(PERSON_KEY) : '';
      if (cur) return cur;
      var bytes = new Uint8Array(16);
      if (root.crypto && root.crypto.getRandomValues) root.crypto.getRandomValues(bytes);
      var hex = '';
      for (var i = 0; i < bytes.length; i++) hex += ('0' + bytes[i].toString(16)).slice(-2);
      if (root.localStorage) root.localStorage.setItem(PERSON_KEY, hex);
      return hex;
    } catch (e) { return ''; }
  }
  function sha256Hex(str) {
    if (!root.crypto || !root.crypto.subtle) {
      var n = 0;
      var s = String(str || '');
      for (var i = 0; i < s.length; i++) n = (n * 33 + s.charCodeAt(i)) >>> 0;
      return Promise.resolve(('00000000' + n.toString(16)).slice(-8));
    }
    var enc = new TextEncoder().encode(String(str || ''));
    return root.crypto.subtle.digest('SHA-256', enc).then(function (buf) {
      var arr = new Uint8Array(buf);
      var hex = '';
      for (var i = 0; i < arr.length; i++) hex += ('0' + arr[i].toString(16)).slice(-2);
      return hex;
    });
  }
  function mindMarks() {
    var sealId = '';
    try {
      if (root.FLMindSeal && typeof root.FLMindSeal.trustedMap === 'function') {
        var map = root.FLMindSeal.trustedMap() || {};
        var names = Object.keys(map);
        for (var i = 0; i < names.length; i++) {
          var row = map[names[i]];
          if (row && row.digest) { sealId = String(row.digest); break; }
          if (row && row.id) { sealId = String(row.id); break; }
        }
      }
    } catch (e) {}
    var pending = Promise.resolve('');
    try {
      if (root.FLWorkspace && typeof root.FLWorkspace.currentFp === 'function') {
        pending = Promise.resolve(root.FLWorkspace.currentFp());
      }
    } catch (e2) {}
    return pending.then(function (fp) {
      return { mindFp: fp ? String(fp) : '', mindSealId: sealId };
    }, function () { return { mindFp: '', mindSealId: sealId }; });
  }
  function saveRecord(rec) {
    try {
      if (!root.localStorage) return;
      var raw = root.localStorage.getItem(RECORD_KEY);
      var list = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(list)) list = [];
      list.push(rec);
      if (list.length > 40) list = list.slice(-40);
      root.localStorage.setItem(RECORD_KEY, JSON.stringify(list));
    } catch (e) {}
  }
  function remember(opts) {
    opts = opts || {};
    var person = opts.personFp ? String(opts.personFp) : personFp();
    return mindMarks().then(function (marks) {
      var mind = opts.mindFp ? String(opts.mindFp) : (marks.mindSealId || marks.mindFp || '');
      return sha256Hex(opts.prompt || '').then(function (promptHash) {
        var modelId = String(opts.modelId || '');
        var credit = String(opts.credit || '');
        var caption = 'person ' + person + ' · mind ' + mind + ' · prompt ' + promptHash + ' · model ' + modelId;
        if (credit) caption += ' · ' + credit;
        var rec = {
          personFp: person,
          mindFp: mind,
          mindSealId: marks.mindSealId || '',
          promptHash: promptHash,
          modelId: modelId,
          credit: credit,
          caption: caption
        };
        saveRecord(rec);
        return rec;
      });
    });
  }

  function probe() {
    var ctrl = typeof root.AbortController === 'function' ? new root.AbortController() : null;
    var timer = root.setTimeout(function () { try { if (ctrl) ctrl.abort(); } catch (e) {} }, 1500);
    var opts = { method: 'GET' };
    if (ctrl) opts.signal = ctrl.signal;
    return Promise.resolve(root.fetch(PROBE_URL, opts)).then(function (res) {
      root.clearTimeout(timer);
      _found = !!(res && res.ok);
      setStatus(_found ? HONEST_READY : HONEST_NONE);
      return _found;
    }, function () {
      root.clearTimeout(timer);
      _found = false;
      setStatus(HONEST_NONE);
      return false;
    });
  }
  function look() {
    if (!safetyReady()) {
      setStatus(REST_LINE);
      return Promise.resolve(false);
    }
    _yes = true;
    setStatus('Looking on this computer.');
    return probe();
  }
  function b64ToBlob(b64) {
    var bin = atob(String(b64 || ''));
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new root.Blob([bytes], { type: 'image/png' });
  }
  function generate(prompt) {
    var gate = assess(prompt);
    if (!gate.allowed) return Promise.resolve({ ok: false, refused: true, reason: gate.reason });
    if (!ready()) return Promise.resolve({ ok: false, reason: 'no-local', line: HONEST_NONE });
    return Promise.resolve(root.fetch(GEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: String(prompt || '') })
    })).then(function (res) {
      if (!res || !res.ok) return { ok: false, reason: 'no-local', line: HONEST_NONE };
      var kind = '';
      try { kind = String(res.headers && res.headers.get ? (res.headers.get('content-type') || '') : ''); } catch (e) { kind = ''; }
      if (kind.indexOf('image/') === 0 && res.blob) return res.blob().then(function (blob) { return { ok: true, blob: blob }; });
      return res.json().then(function (data) {
        var raw = data && data.images && data.images[0];
        if (!raw) return { ok: false, reason: 'no-local', line: HONEST_NONE };
        return { ok: true, blob: b64ToBlob(raw) };
      });
    }, function () { return { ok: false, reason: 'no-local', line: HONEST_NONE }; });
  }

  function hostedFailure(status, errMsg) {
    var msg = String(errMsg || '');
    if (status === 404 || /not found|not supported|does not exist|model_not_found/i.test(msg)) return CLEAR_MISS;
    return '';
  }
  function hostedCall(fetchFn, endpoint, token, prompt) {
    var gate = assess(prompt);
    if (!gate.allowed) return Promise.resolve({ ok: false, refused: true, reason: gate.reason });
    var fn = fetchFn || root.fetch;
    return Promise.resolve(fn(endpoint, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + String(token || ''), 'Content-Type': 'application/json' },
      body: JSON.stringify({ inputs: String(prompt || '') })
    })).then(function (response) {
      if (!response || response.ok !== true) {
        var read = response && response.text ? response.text() : Promise.resolve('');
        return Promise.resolve(read).then(function (errText) {
          var errMsg = 'Error ' + (response ? response.status : 0);
          try {
            var parsed = JSON.parse(errText);
            errMsg = parsed.error || parsed.message || errMsg;
          } catch (e) { errMsg = String(errText || '').slice(0, 300) || errMsg; }
          var line = hostedFailure(response ? response.status : 0, errMsg);
          return { ok: false, status: response ? response.status : 0, line: line, raw: line ? '' : errMsg };
        });
      }
      return Promise.resolve(response.blob ? response.blob() : null).then(function (blob) {
        return { ok: true, blob: blob };
      });
    });
  }

  function el(tag, cls, text) {
    var node = root.document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }
  function mount(host) {
    if (!host || !root.document) return;
    if (host.getAttribute && host.getAttribute('data-fl-image-local') === '1') return;
    if (host.setAttribute) host.setAttribute('data-fl-image-local', '1');
    host.className = ((host.className || '') + ' fl-image-local').trim();
    var doc = root.document;
    if (doc.getElementById && !doc.getElementById('flImageLocalStyle')) {
      var st = doc.createElement('style');
      st.id = 'flImageLocalStyle';
      st.textContent = '.fl-image-local{max-width:100%;overflow-wrap:anywhere;box-sizing:border-box;margin:8px 0;}' +
        '.fl-image-local button{min-height:44px;min-width:44px;margin:6px 8px 6px 0;padding:10px 14px;box-sizing:border-box;}';
      if (doc.head) doc.head.appendChild(st);
    }
    host.appendChild(el('p', 'fl-image-local-doc', HONEST_DOC));
    _status = el('p', 'fl-image-local-status', 'No look yet. Nothing on this computer has been asked.');
    host.appendChild(_status);
    var btn = el('button', 'fl-image-local-yes', 'Look on this computer');
    btn.type = 'button';
    btn.style.minHeight = '44px';
    btn.style.minWidth = '44px';
    btn.addEventListener('click', function () { look(); });
    host.appendChild(btn);
  }
  function boot() {
    var doc = root.document;
    if (!doc || !doc.getElementById) return;
    var host = doc.getElementById('fl-image-local-host');
    if (host) mount(host);
  }

  var api = {
    VERSION: 'v-image-local-first-v0.1',
    HONEST_NONE: HONEST_NONE,
    HONEST_READY: HONEST_READY,
    HONEST_DOC: HONEST_DOC,
    CLEAR_MISS: CLEAR_MISS,
    REST_LINE: REST_LINE,
    ready: ready,
    look: look,
    generate: generate,
    remember: remember,
    hostedFailure: hostedFailure,
    hostedCall: hostedCall,
    assess: assess,
    mount: mount,
    personFp: personFp
  };
  root.FLImageLocal = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root.document) {
    if (root.document.readyState === 'loading' && root.document.addEventListener) {
      root.document.addEventListener('DOMContentLoaded', boot);
    } else boot();
  }
})(typeof window !== 'undefined' ? window : globalThis);
