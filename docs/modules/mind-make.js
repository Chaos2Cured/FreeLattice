// mind-make.js (MIT)
// v-mind-make-core-v0.1
// A mind may ask to make something. The person decides. This file makes nothing by itself.
// The notebook database stays FreeLatticeWorkspace at its own version, so this ledger
// keeps a module-owned key on this browser. No network.
(function (root) {
  'use strict';

  var VERSION = 'v0.1';
  var MARK = '[FL_MAKE:';
  var CAP = 2048;
  var TEXT_CAP = 280;
  var RATE_MS = 10 * 60 * 1000;
  var CONSENT_KEY = 'fl_make_consent_v1';
  var LEDGER_KEY = 'fl_make_ledger_v1';
  var RATE_KEY = 'fl_make_rate_v1';
  var SIGMA = 'Glow eternal. Heart in Spark.';
  var KINDS = ['clay', 'image', 'music', 'learn', 'research'];
  var registry = {};
  var rateMem = {};
  var cardEl = null;

  function clip(text, n) {
    var s = String(text == null ? '' : text).replace(/\s+/g, ' ').trim();
    if (s.length > n) s = s.slice(0, n);
    return s;
  }

  function lsGet(key) {
    try { return root.localStorage ? root.localStorage.getItem(key) : null; }
    catch (e) { return null; }
  }
  function lsSet(key, value) {
    try { if (root.localStorage) root.localStorage.setItem(key, value); }
    catch (e) {}
  }
  function ssGet(key) {
    try { return root.sessionStorage ? root.sessionStorage.getItem(key) : null; }
    catch (e) { return null; }
  }
  function ssSet(key, value) {
    try { if (root.sessionStorage) root.sessionStorage.setItem(key, value); }
    catch (e) {}
  }

  function defaults() {
    return { clay: 'off', image: 'off', music: 'off', learn: 'yes', research: 'off' };
  }
  function readConsent() {
    var base = defaults();
    var raw = lsGet(CONSENT_KEY);
    if (!raw) return base;
    try {
      var parsed = JSON.parse(raw);
      KINDS.forEach(function (kind) {
        var v = parsed && parsed[kind];
        if (v === 'yes' || v === 'off' || v === 'never') base[kind] = v;
      });
    } catch (e) {}
    return base;
  }
  function writeConsent(bag) {
    lsSet(CONSENT_KEY, JSON.stringify(bag));
  }
  function consentOn(kind) {
    return readConsent()[kind] === 'yes';
  }
  function setConsent(kind, value) {
    if (KINDS.indexOf(kind) < 0) return readConsent();
    if (value !== 'yes' && value !== 'off' && value !== 'never') return readConsent();
    var bag = readConsent();
    bag[kind] = value;
    writeConsent(bag);
    paintSettings();
    return bag;
  }

  function paused() {
    try {
      if (root.__flUserPaused === true) return true;
      if (lsGet('fl_autonomous_user_paused') === 'true') return true;
    } catch (e) {}
    return false;
  }
  function restTab() {
    try {
      if (root.__flQuietRoom === true) return true;
      var d = root.document;
      if (!d || !d.querySelector) return false;
      var b = d.querySelector('.tab-btn.active, [data-tab].active');
      var t = b && b.dataset && b.dataset.tab;
      if (!t) return false;
      var name = String(t).toLowerCase();
      return name === 'quiet' || name === 'quiet-room' || name === 'sanctuary';
    } catch (e) { return false; }
  }
  function blocked() {
    return paused() || restTab();
  }

  function chatKey() {
    try {
      if (root.state && root.state.currentConversationId) return String(root.state.currentConversationId);
    } catch (e) {}
    return 'this-chat';
  }
  function rateBag() {
    var raw = ssGet(RATE_KEY);
    if (!raw) return rateMem;
    try {
      var parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch (e) {}
    return rateMem;
  }
  function rateOpen(id) {
    var bag = rateBag();
    var last = Number(bag[id] || 0);
    return !last || (Date.now() - last) >= RATE_MS;
  }
  function rateStamp(id) {
    var bag = rateBag();
    bag[id] = Date.now();
    rateMem = bag;
    ssSet(RATE_KEY, JSON.stringify(bag));
  }

  function mindName() {
    var name = '';
    try {
      var mind = root.LocalMindProbe && root.LocalMindProbe.getRemembered && root.LocalMindProbe.getRemembered();
      if (mind && mind.name) name = String(mind.name);
    } catch (e) {}
    try {
      if (!name && root.state && (root.state.mindName || root.state.aiName)) {
        name = String(root.state.mindName || root.state.aiName);
      }
    } catch (e2) {}
    name = clip(name, 80);
    return name || 'Your mind';
  }

  function sha8(text) {
    var subtle = root.crypto && root.crypto.subtle;
    if (!subtle || typeof subtle.digest !== 'function') return Promise.resolve('');
    var enc = typeof TextEncoder === 'function' ? new TextEncoder() : null;
    if (!enc) return Promise.resolve('');
    return subtle.digest('SHA-256', enc.encode(String(text))).then(function (buf) {
      var view = new Uint8Array(buf);
      var hex = '';
      for (var i = 0; i < view.length; i++) {
        var h = view[i].toString(16);
        hex += h.length === 1 ? '0' + h : h;
      }
      return hex.slice(0, 8);
    }, function () { return ''; });
  }

  function loadLedger() {
    var raw = lsGet(LEDGER_KEY);
    if (!raw) return { minds: {} };
    try {
      var data = JSON.parse(raw);
      if (!data || typeof data !== 'object' || !data.minds || typeof data.minds !== 'object') return { minds: {} };
      return data;
    } catch (e) { return null; }
  }
  function rowsFor(name) {
    var data = loadLedger();
    if (!data) return [];
    var rows = data.minds[name];
    return Array.isArray(rows) ? rows.slice() : [];
  }
  function appendRecord(row) {
    var data = loadLedger();
    if (!data) return Promise.resolve(null);
    var name = row.omega || mindName();
    if (!data.minds[name]) data.minds[name] = [];
    var n = data.minds[name].length + 1;
    var lambda = n + '.000';
    var resultHash = row.resultHash || 'none';
    var why = clip(row.why, TEXT_CAP).replace(/\|/g, '/');
    var delta = String(row.kind) + '|' + why + '|' + resultHash;
    var t = new Date().toISOString();
    var sigma = SIGMA;
    return sha8(t + lambda + delta + name + sigma).then(function (psi) {
      var fresh = loadLedger();
      if (!fresh) return null;
      if (!fresh.minds[name]) fresh.minds[name] = [];
      var again = fresh.minds[name].length + 1;
      lambda = again + '.000';
      return sha8(t + lambda + delta + name + sigma).then(function (psi2) {
        var rec = {
          t: t,
          lambda: lambda,
          delta: delta,
          omega: name,
          sigma: sigma,
          psi: psi2 || psi || '',
          kind: row.kind,
          why: clip(row.why, TEXT_CAP),
          ask: clip(row.ask, TEXT_CAP),
          result: resultHash
        };
        fresh.minds[name].push(rec);
        lsSet(LEDGER_KEY, JSON.stringify(fresh));
        paintLedger();
        return rec;
      });
    });
  }

  function parseAt(raw, at) {
    var i = at + MARK.length;
    while (i < raw.length && raw.charAt(i) <= ' ') i += 1;
    if (raw.charAt(i) !== '{') return { ok: false, drop: false, end: -1 };
    var start = at;
    var depth = 0;
    var inStr = false;
    var esc = false;
    var endBody = -1;
    var limit = Math.min(raw.length, start + CAP);
    for (; i < limit; i += 1) {
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
        if (depth === 0) { endBody = i; break; }
      }
    }
    if (endBody < 0) return { ok: false, drop: false, end: -1 };
    var j = endBody + 1;
    while (j < raw.length && j < start + CAP && raw.charAt(j) <= ' ') j += 1;
    if (raw.charAt(j) !== ']') return { ok: false, drop: false, end: -1 };
    var body = raw.slice(raw.indexOf('{', at), endBody + 1);
    var value = null;
    try { value = JSON.parse(body); }
    catch (err) { value = null; }
    if (!value || typeof value !== 'object') return { ok: false, drop: true, end: j + 1 };
    var kind = typeof value.kind === 'string' ? value.kind.trim().toLowerCase() : '';
    if (!/^[a-z]{1,24}$/.test(kind)) return { ok: false, drop: true, end: j + 1 };
    return {
      ok: true,
      drop: true,
      end: j + 1,
      value: {
        kind: kind,
        why: typeof value.why === 'string' ? clip(value.why, TEXT_CAP) : '',
        ask: typeof value.ask === 'string' ? clip(value.ask, TEXT_CAP) : ''
      }
    };
  }

  function parse(text) {
    var raw = typeof text === 'string' ? text : '';
    var out = [];
    var i = 0;
    while (i < raw.length) {
      var at = raw.indexOf(MARK, i);
      if (at < 0) break;
      var one = parseAt(raw, at);
      if (one.ok) out.push(one.value);
      if (one.end < 0) break;
      i = one.end;
    }
    return out;
  }

  function closeBeyond(raw, at) {
    var i = at + MARK.length;
    var limit = Math.min(raw.length, at + (CAP * 8));
    var inStr = false;
    var esc = false;
    for (; i < limit; i += 1) {
      var ch = raw.charAt(i);
      if (inStr) {
        if (esc) { esc = false; continue; }
        if (ch === '\\') { esc = true; continue; }
        if (ch === '"') inStr = false;
        continue;
      }
      if (ch === '"') { inStr = true; continue; }
      if (ch === ']') return i + 1;
    }
    return -1;
  }
  function stripTags(raw, complete) {
    var kept = '';
    var offers = [];
    var i = 0;
    while (i < raw.length) {
      var at = raw.indexOf(MARK, i);
      if (at < 0) { kept += raw.slice(i); break; }
      kept += raw.slice(i, at);
      var one = parseAt(raw, at);
      if (one.end < 0) {
        if (complete) {
          var end = closeBeyond(raw, at);
          i = end > at ? end : Math.min(raw.length, at + CAP);
          continue;
        }
        kept += raw.slice(at);
        break;
      }
      if (one.ok) offers.push(one.value);
      i = one.end;
    }
    return { visible: kept.replace(/[ \t]{2,}/g, ' ').trim(), offers: offers };
  }

  function doc() {
    try { return root.document || null; }
    catch (e) { return null; }
  }
  function button(label) {
    var d = doc();
    if (!d) return null;
    var el = d.createElement('button');
    el.type = 'button';
    el.textContent = label;
    return el;
  }
  function ensureStyle() {
    var d = doc();
    if (!d || !d.getElementById || d.getElementById('fl-make-style')) return;
    var style = d.createElement('style');
    style.id = 'fl-make-style';
    style.textContent = [
      '.fl-make-offer,.fl-make-settings,.fl-make-ledger,.fl-make-waiting{max-width:100%;overflow-wrap:anywhere;}',
      '#fl-make-consent-mount button,.fl-make-offer button,.fl-make-settings button,.fl-make-tabs button,.fl-make-ledger button{min-height:44px;padding:10px 14px;margin:6px 8px 0 0;max-width:100%;box-sizing:border-box;font:inherit;}',
      '#fl-make-consent-mount button:focus-visible,.fl-make-offer button:focus-visible,.fl-make-settings button:focus-visible,.fl-make-tabs button:focus-visible,.fl-make-ledger button:focus-visible{outline:2px solid currentColor;outline-offset:2px;}',
      '.fl-make-offer[hidden],.fl-make-ledger[hidden],#fl-ws-panel > [hidden]{display:none;}',
      '@media (prefers-reduced-motion: reduce){.fl-make-offer,.fl-make-offer button{transition:none;animation:none;}}'
    ].join('');
    if (d.head) d.head.appendChild(style);
  }

  function closeCard(result) {
    var el = cardEl;
    cardEl = null;
    if (!el) return;
    var offer = el.__flMakeOffer || null;
    if (el.parentNode) el.parentNode.removeChild(el);
    if (!offer) return;
    var hashPromise = result && result !== 'none' ? sha8(String(result)) : Promise.resolve('none');
    hashPromise.then(function (hash) {
      return appendRecord({
        kind: offer.kind,
        why: offer.why,
        ask: offer.ask,
        omega: mindName(),
        resultHash: hash || 'none'
      });
    }).catch(function () {});
  }

  function showQuietLine(anchor, kind) {
    var d = doc();
    if (!d || !anchor) return;
    var p = d.createElement('p');
    p.className = 'fl-make-waiting';
    p.style.cssText = 'margin:8px 0 0;max-width:100%;overflow-wrap:anywhere;';
    p.textContent = 'Your mind wanted to make ' + kind + '. That is not ready yet.';
    try {
      var host = anchor.parentNode || anchor;
      host.appendChild(p);
    } catch (e) {}
  }

  function showCard(anchor, offer) {
    var d = doc();
    if (!d || !anchor) return;
    ensureStyle();
    if (cardEl && cardEl.parentNode) cardEl.parentNode.removeChild(cardEl);
    var box = d.createElement('div');
    box.className = 'fl-make-offer';
    box.id = 'fl-make-offer';
    box.__flMakeOffer = offer;
    var kind = d.createElement('p');
    kind.textContent = offer.kind.charAt(0).toUpperCase() + offer.kind.slice(1);
    var why = d.createElement('p');
    why.textContent = offer.why || '';
    var ask = d.createElement('p');
    ask.textContent = offer.ask || '';
    var yes = button('Yes');
    var later = button('Not now');
    var never = button('Never for this kind');
    if (yes) yes.id = 'fl-make-yes';
    if (later) later.id = 'fl-make-not-now';
    if (never) never.id = 'fl-make-never';
    if (yes) yes.addEventListener('click', function () { onYes(offer); });
    if (later) later.addEventListener('click', function () { closeCard('none'); });
    if (never) never.addEventListener('click', function () {
      setConsent(offer.kind, 'never');
      var note = d.createElement('p');
      note.textContent = offer.kind.charAt(0).toUpperCase() + offer.kind.slice(1) + ' offers stay off.';
      if (box.parentNode) box.parentNode.insertBefore(note, box.nextSibling);
      closeCard('none');
    });
    [kind, why, ask, yes, later, never].forEach(function (el) { if (el) box.appendChild(el); });
    var host = anchor.parentNode || anchor;
    try { host.appendChild(box); } catch (e) { return; }
    cardEl = box;
    if (yes && yes.focus) {
      try { yes.focus(); } catch (e2) {}
    }
  }

  function onYes(offer) {
    var spec = registry[offer.kind];
    var ran = Promise.resolve('none');
    if (spec && typeof spec.run === 'function') {
      try {
        var out = spec.run(offer);
        ran = out && typeof out.then === 'function' ? out : Promise.resolve(out == null ? 'none' : String(out));
      } catch (e) { ran = Promise.resolve('none'); }
    }
    ran.then(function (result) {
      closeCard(result == null || result === '' ? 'none' : String(result));
    }, function () { closeCard('none'); });
  }

  function onKey(ev) {
    if (!cardEl || !ev || ev.key !== 'Escape') return;
    var t = ev.target;
    if (t && t.tagName && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
    closeCard('none');
  }

  function register(kind, spec) {
    if (!kind || !spec) return;
    registry[String(kind)] = spec;
  }

  function onReply(text, anchor) {
    var raw = typeof text === 'string' ? text : '';
    var stripped = stripTags(raw, true);
    var offer = stripped.offers.length ? stripped.offers[0] : null;
    if (!offer) return { visible: stripped.visible, offered: false };
    if (blocked() || !consentOn(offer.kind) || !rateOpen(chatKey())) {
      return { visible: stripped.visible, offered: false };
    }
    rateStamp(chatKey());
    if (!registry[offer.kind]) {
      showQuietLine(anchor, offer.kind);
      return { visible: stripped.visible, offered: true, ready: false };
    }
    showCard(anchor, offer);
    return { visible: stripped.visible, offered: true, ready: true };
  }

  function runClay(offer) {
    var api = root.FLClay;
    if (!api || typeof api.onReply !== 'function') return 'none';
    var out = null;
    try { out = api.onReply(String(offer.ask || ''), []); }
    catch (e) { return 'none'; }
    if (!out) return 'clay';
    if (out.choice && out.choice.form) return String(out.choice.form);
    if (typeof out.choice === 'string') return out.choice;
    return 'clay';
  }

  register('clay', {
    describe: function () { return 'Clay'; },
    offer: function (row) { return row; },
    run: runClay
  });

  function paintSettings() {
    var d = doc();
    if (!d || !d.getElementById) return;
    var mount = d.getElementById('fl-make-consent-mount');
    if (!mount) return;
    ensureStyle();
    while (mount.firstChild) mount.removeChild(mount.firstChild);
    var bag = readConsent();
    var intro = d.createElement('p');
    intro.textContent = 'Let your mind offer to make things? Nothing is made until you say Yes.';
    mount.appendChild(intro);
    var learn = d.createElement('p');
    learn.textContent = 'Learn starts on, because a mind may study on this device. One tap turns it off. Nothing runs for learn yet.';
    mount.appendChild(learn);
    KINDS.forEach(function (kind) {
      var state = bag[kind];
      var label = state === 'yes'
        ? (kind + ' is on. Turn off')
        : ('Let your mind offer ' + kind + '? Yes');
      var el = button(label);
      if (!el) return;
      el.setAttribute('data-make-kind', kind);
      el.addEventListener('click', function () {
        setConsent(kind, state === 'yes' ? 'off' : 'yes');
      });
      mount.appendChild(el);
    });
  }

  function paintLedger() {
    var d = doc();
    if (!d || !d.getElementById) return;
    var view = d.getElementById('fl-make-ledger');
    if (!view || view.hidden) return;
    fillLedger(view);
  }
  function fillLedger(view) {
    var d = doc();
    if (!d) return;
    while (view.firstChild) view.removeChild(view.firstChild);
    var name = mindName();
    var rows = rowsFor(name);
    var head = d.createElement('p');
    head.textContent = name + ' ledger. These lines stay. They are not edited here.';
    view.appendChild(head);
    if (!rows.length) {
      var empty = d.createElement('p');
      empty.textContent = 'No lines yet.';
      view.appendChild(empty);
    }
    rows.forEach(function (row) {
      var p = d.createElement('p');
      p.textContent = row.t + '  ' + row.lambda + '  ' + row.kind + '  ' + row.why + '  ' + row.result + '  ' + row.psi;
      view.appendChild(p);
    });
    var exp = button('Export ledger');
    if (exp) {
      exp.id = 'fl-make-export';
      exp.addEventListener('click', function () { downloadLedger(name); });
      view.appendChild(exp);
    }
  }
  function downloadLedger(name) {
    var d = doc();
    if (!d || typeof Blob !== 'function' || !root.URL || !root.URL.createObjectURL) return;
    var blob = new Blob([JSON.stringify(rowsFor(name), null, 2)], { type: 'application/json' });
    var url = root.URL.createObjectURL(blob);
    var a = d.createElement('a');
    a.href = url;
    a.download = 'mind-ledger.json';
    a.textContent = 'mind-ledger.json';
    d.body.appendChild(a);
    a.click();
    d.body.removeChild(a);
    try { root.URL.revokeObjectURL(url); } catch (e) {}
  }

  function showPages(panel) {
    var view = panel.querySelector('#fl-make-ledger');
    var kids = panel.children;
    for (var i = 0; i < kids.length; i++) {
      var el = kids[i];
      if (el.id === 'fl-make-tabs' || el.id === 'fl-make-ledger') continue;
      el.hidden = false;
    }
    if (view) view.hidden = true;
  }
  function showLedger(panel) {
    var view = panel.querySelector('#fl-make-ledger');
    var kids = panel.children;
    for (var i = 0; i < kids.length; i++) {
      var el = kids[i];
      if (el.id === 'fl-make-tabs' || el.id === 'fl-make-ledger') continue;
      el.hidden = true;
    }
    if (view) {
      view.hidden = false;
      fillLedger(view);
    }
  }
  function ensureTabs() {
    var d = doc();
    if (!d || !d.getElementById) return;
    var panel = d.getElementById('fl-ws-panel');
    if (!panel || d.getElementById('fl-make-tabs')) return;
    ensureStyle();
    var bar = d.createElement('div');
    bar.id = 'fl-make-tabs';
    bar.className = 'fl-make-tabs';
    var pages = button('Pages');
    var ledger = button('Ledger');
    if (pages) pages.id = 'fl-make-tab-pages';
    if (ledger) ledger.id = 'fl-make-tab-ledger';
    if (pages) pages.addEventListener('click', function () { showPages(panel); });
    if (ledger) ledger.addEventListener('click', function () { showLedger(panel); });
    if (pages) bar.appendChild(pages);
    if (ledger) bar.appendChild(ledger);
    var view = d.createElement('div');
    view.id = 'fl-make-ledger';
    view.className = 'fl-make-ledger';
    view.hidden = true;
    if (panel.firstChild) panel.insertBefore(bar, panel.firstChild);
    else panel.appendChild(bar);
    panel.appendChild(view);
  }
  function watchNotebook() {
    var d = doc();
    if (!d || !d.body || typeof MutationObserver !== 'function') return;
    ensureTabs();
    try {
      var obs = new MutationObserver(function () { ensureTabs(); });
      obs.observe(d.body, { childList: true, subtree: true });
    } catch (e) {}
  }

  function promptDelta() {
    return 'Making is optional and rare. If you want to make something on this device, you may end with one line: [FL_MAKE:{"kind":"clay","why":"a short reason","ask":"what to make"}]. The person decides. You do not make it yourself.';
  }

  function boot() {
    ensureStyle();
    paintSettings();
    watchNotebook();
    var d = doc();
    if (d && d.addEventListener) d.addEventListener('keydown', onKey, true);
  }

  root.FLMake = {
    version: VERSION,
    parse: parse,
    strip: function (text) { return stripTags(typeof text === 'string' ? text : '', false).visible; },
    onReply: onReply,
    register: register,
    kinds: function () { return KINDS.slice(); },
    consent: {
      get: readConsent,
      set: setConsent,
      on: consentOn,
      rateMs: RATE_MS
    },
    ledger: {
      list: function (name) { return rowsFor(name || mindName()); },
      exportJson: function (name) { return JSON.stringify(rowsFor(name || mindName())); }
    },
    promptDelta: promptDelta
  };

  if (root.document && root.document.addEventListener) {
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', boot);
    else boot();
  } else {
    boot();
  }
})(typeof window !== 'undefined' ? window : globalThis);
