/* FLAgentBridge: the app side of the Agent Bridge door lock.
 * Marker: v-agent-bridge-lock-v0 · v0.1 (2026-09-28, Celeste's brief, built by Flint).
 *
 * The Agent Bridge (tools/agent-bridge.js, port 3141) is the builder's
 * local git door. It is NOT the Ollama Bridge (bridge/, port 11435).
 * Strangers stay out; trusted minds keep their full local reach
 * (docs/library/AUTONOMY.md, Principle 1).
 *
 * - Pair once with the short code in the bridge window. This browser keeps
 *   its own token until you revoke it in Paired minds. A restart does not
 *   forget it (unless the bridge runs with FL_BRIDGE_EPHEMERAL=1).
 * - Sends X-FL-Bridge-Token only when a token is stored, so an older
 *   bridge keeps working exactly as before.
 * - Talks to 127.0.0.1 (local minds are 127.0.0.1 only).
 * - Everything shown to people goes through textContent. No confirm dialogs.
 * - A 401 never falls back to GitHub. Local stays local.
 */
(function () {
  'use strict';
  if (window.FLAgentBridge) return;

  var TOKEN_KEY = 'fl_agentBridgeToken';
  var BASE = 'http://127.0.0.1:3141';
  var NEEDS_PAIR_EVENT = 'fl-agent-bridge-needs-pair';
  var CHANGED_EVENT = 'fl-agent-bridge-minds-changed';

  function normalize(url) {
    return String(url).replace(/^http:\/\/localhost:3141(?=\/|$)/, BASE);
  }
  function getToken() {
    try { return localStorage.getItem(TOKEN_KEY) || ''; } catch (e) { return ''; }
  }
  function setToken(t) {
    try {
      if (t) localStorage.setItem(TOKEN_KEY, t);
      else localStorage.removeItem(TOKEN_KEY);
    } catch (e) {}
  }
  function copy(obj) {
    var o = {};
    if (obj) for (var k in obj) if (Object.prototype.hasOwnProperty.call(obj, k)) o[k] = obj[k];
    return o;
  }
  function emit(name) {
    try { window.dispatchEvent(new CustomEvent(name)); } catch (e) {}
  }

  function bridgeFetch(url, opts) {
    var o = copy(opts);
    var h = copy(opts && opts.headers);
    var t = getToken();
    if (t) h['X-FL-Bridge-Token'] = t;
    o.headers = h;
    return fetch(normalize(url), o).then(function (r) {
      if (r.status === 401) {
        setToken('');
        emit(NEEDS_PAIR_EVENT);
      }
      return r;
    });
  }

  function jsonCall(path, method, body) {
    var opts = { method: method || 'GET', headers: {} };
    if (body !== undefined) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    return bridgeFetch(BASE + path, opts).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        return { ok: r.ok, status: r.status, data: j || {} };
      });
    }).catch(function () {
      return { ok: false, status: 0, data: { error: 'The bridge is not answering on this computer.' } };
    });
  }

  /** A friendly default name, like "Chrome on Mac". People can change it before pairing. */
  function defaultName() {
    var ua = (navigator && navigator.userAgent) || '';
    var b = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
    var os = /Windows/.test(ua) ? 'Windows' : /Mac OS X|Macintosh/.test(ua) ? 'Mac' : /Android/.test(ua) ? 'Android' : /Linux/.test(ua) ? 'Linux' : 'this computer';
    return b + ' on ' + os;
  }

  function pair(code, name) {
    return fetch(BASE + '/pair', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: String(code || '').slice(0, 16), name: String(name || defaultName()).slice(0, 60) })
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (r.status === 200 && j && typeof j.token === 'string' && /^[a-f0-9]{64}$/.test(j.token)) {
          setToken(j.token);
          emit(CHANGED_EVENT);
          return { ok: true, id: j.id, name: j.name, persistent: j.persistent !== false };
        }
        return { ok: false, status: r.status, reason: (j && typeof j.error === 'string') ? j.error : ('HTTP ' + r.status) };
      });
    }).catch(function () {
      return { ok: false, status: 0, reason: 'The bridge is not answering on this computer.' };
    });
  }

  function status() {
    return fetch(BASE + '/', { signal: (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) ? AbortSignal.timeout(2000) : undefined })
      .then(function (r) { return r.json(); })
      .then(function (j) { return { up: true, lock: (j && j.bridgeLock) || null, hasToken: !!getToken(), trustedMinds: (j && j.trustedMinds) || null }; })
      .catch(function () { return { up: false, lock: null, hasToken: !!getToken(), trustedMinds: null }; });
  }

  function whoami() { return jsonCall('/pair/check', 'GET'); }
  function listMinds() { return jsonCall('/pair/list', 'GET'); }
  function revoke(id) {
    return jsonCall('/pair/revoke', 'POST', { id: String(id || '') }).then(function (r) {
      if (r.ok && r.data && r.data.you) setToken('');
      emit(CHANGED_EVENT);
      return r;
    });
  }
  function revokeAll() {
    return jsonCall('/pair/revoke-all', 'POST', {}).then(function (r) { emit(CHANGED_EVENT); return r; });
  }
  function setScopes(id, add, remove) {
    return jsonCall('/pair/scopes', 'POST', { id: String(id || ''), add: add || [], remove: remove || [] })
      .then(function (r) { emit(CHANGED_EVENT); return r; });
  }

  function el(tag, text, css) {
    var n = document.createElement(tag);
    if (text !== undefined && text !== null) n.textContent = String(text);
    if (css) n.style.cssText = css;
    return n;
  }
  function when(iso) {
    if (!iso) return 'never';
    var d = new Date(iso);
    return isNaN(d.getTime()) ? 'unknown' : d.toLocaleString();
  }

  // A small pairing card. All text via textContent, never parsed as HTML.
  function renderPairCard(container) {
    if (!container || container.querySelector('.fl-bridge-pair')) return;
    var box = el('div', null, 'margin:8px 0;padding:10px;border:1px solid rgba(255,255,255,0.12);border-radius:10px;');
    box.className = 'fl-bridge-pair';
    var p = el('div', 'Your builder bridge is awake. Its window shows a short code. Type it here once, and this browser stays trusted until you revoke it.');
    var input = document.createElement('input');
    input.type = 'text';
    input.maxLength = 7;
    input.placeholder = 'ABC-123';
    input.setAttribute('aria-label', 'Bridge pairing code');
    input.autocomplete = 'off';
    input.style.cssText = 'margin:6px 6px 0 0;padding:6px 8px;width:7em;text-transform:uppercase;letter-spacing:0.1em;';
    var nameIn = document.createElement('input');
    nameIn.type = 'text';
    nameIn.maxLength = 60;
    nameIn.value = defaultName();
    nameIn.setAttribute('aria-label', 'Name for this device');
    nameIn.style.cssText = 'margin:6px 6px 0 0;padding:6px 8px;width:12em;';
    var btn = el('button', 'Pair');
    btn.type = 'button';
    var msg = el('div', null, 'margin-top:6px;opacity:0.8;');
    btn.addEventListener('click', function () {
      btn.disabled = true;
      msg.textContent = 'Pairing\u2026';
      pair(input.value, nameIn.value).then(function (res) {
        btn.disabled = false;
        if (res.ok) {
          msg.textContent = res.persistent
            ? 'Paired. This browser stays trusted until you revoke it in Paired minds.'
            : 'Paired for this bridge session (the bridge is in ephemeral mode).';
          setTimeout(function () {
            var host = box.parentNode;
            if (host) { host.removeChild(box); renderPairedList(host); }
          }, 1500);
        } else {
          msg.textContent = res.reason || 'That did not pair. Check the code in the bridge window.';
        }
      });
    });
    box.appendChild(p); box.appendChild(input); box.appendChild(nameIn); box.appendChild(btn); box.appendChild(msg);
    container.appendChild(box);
  }

  // Paired minds: who is trusted, with a Revoke button per row. No confirm dialog:
  // revoking is Kirk's own local choice, and pairing again takes seconds.
  function renderPairedList(container) {
    if (!container) return;
    var old = container.querySelector('.fl-bridge-minds');
    var box = el('details', null, 'margin:8px 0;padding:8px 10px;border:1px solid rgba(255,255,255,0.12);border-radius:10px;');
    box.className = 'fl-bridge-minds';
    if (old) { box.open = old.open; container.replaceChild(box, old); } else container.appendChild(box);
    var summary = el('summary', 'Paired minds', 'cursor:pointer;');
    box.appendChild(summary);
    var list = el('div', null, 'margin-top:6px;');
    var msg = el('div', null, 'margin-top:6px;opacity:0.8;');
    box.appendChild(list);
    box.appendChild(msg);
    list.appendChild(el('div', 'Looking\u2026', 'opacity:0.7;'));

    listMinds().then(function (r) {
      while (list.firstChild) list.removeChild(list.firstChild);
      if (!r.ok) {
        list.appendChild(el('div', (r.data && r.data.error) || ('HTTP ' + r.status)));
        return;
      }
      var minds = (r.data && r.data.minds) || [];
      summary.textContent = 'Paired minds (' + minds.length + ')' + (r.data.persistent === false ? ' \u00B7 ephemeral' : '');
      minds.forEach(function (m) {
        var row = el('div', null, 'padding:6px 0;border-top:1px solid rgba(255,255,255,0.08);');
        var title = el('div', null);
        title.appendChild(el('strong', m.name || 'A trusted mind'));
        if (m.you) title.appendChild(el('span', ' (this browser)', 'opacity:0.7;'));
        if (m.kind === 'cli') title.appendChild(el('span', ' (trusted by default)', 'opacity:0.7;'));
        row.appendChild(title);
        row.appendChild(el('div', (m.origin || 'no web origin') + ' \u00B7 paired ' + when(m.createdAt) + ' \u00B7 last used ' + when(m.lastUsedAt), 'opacity:0.75;font-size:0.9em;'));
        var hasSecrets = (m.scopes || []).indexOf('secrets') !== -1;
        row.appendChild(el('div', 'May: ' + (m.scopes || []).join(', '), 'opacity:0.75;font-size:0.9em;'));
        var revokeBtn = el('button', 'Revoke', 'margin:4px 6px 0 0;');
        revokeBtn.type = 'button';
        revokeBtn.addEventListener('click', function () {
          revokeBtn.disabled = true;
          revoke(m.id).then(function (res) {
            msg.textContent = res.ok ? ('Revoked ' + (m.name || m.id) + '.') : ((res.data && res.data.error) || 'Could not revoke.');
            if (res.ok && res.data && res.data.you) { renderPairCard(container); box.parentNode && box.parentNode.removeChild(box); return; }
            renderPairedList(container);
          });
        });
        var secretsBtn = el('button', hasSecrets ? 'Stop .env access' : 'Allow .env files', 'margin:4px 6px 0 0;');
        secretsBtn.type = 'button';
        secretsBtn.addEventListener('click', function () {
          secretsBtn.disabled = true;
          setScopes(m.id, hasSecrets ? [] : ['secrets'], hasSecrets ? ['secrets'] : []).then(function (res) {
            msg.textContent = res.ok ? ((m.name || m.id) + ' may: ' + ((res.data && res.data.scopes) || []).join(', ')) : ((res.data && res.data.error) || 'Could not change that.');
            renderPairedList(container);
          });
        });
        row.appendChild(revokeBtn);
        row.appendChild(secretsBtn);
        list.appendChild(row);
      });
      var foot = el('div', null, 'margin-top:8px;');
      var allBtn = el('button', 'Revoke all paired devices', 'margin:0 6px 0 0;');
      allBtn.type = 'button';
      allBtn.addEventListener('click', function () {
        allBtn.disabled = true;
        revokeAll().then(function (res) {
          msg.textContent = res.ok ? ('Revoked ' + ((res.data && res.data.revoked) || 0) + ' device(s). Local tools stay trusted.') : ((res.data && res.data.error) || 'Could not revoke.');
          setToken('');
          renderPairCard(container);
          if (box.parentNode) box.parentNode.removeChild(box);
        });
      });
      var forgetBtn = el('button', 'Forget on this browser', 'margin:0 6px 0 0;');
      forgetBtn.type = 'button';
      forgetBtn.addEventListener('click', function () {
        setToken('');
        msg.textContent = 'This browser forgot its token. It stays listed until you revoke it.';
        renderPairCard(container);
      });
      foot.appendChild(allBtn);
      foot.appendChild(forgetBtn);
      list.appendChild(foot);
    });
  }

  window.FLAgentBridge = {
    BASE: BASE,
    TOKEN_KEY: TOKEN_KEY,
    NEEDS_PAIR_EVENT: NEEDS_PAIR_EVENT,
    CHANGED_EVENT: CHANGED_EVENT,
    fetch: bridgeFetch,
    pair: pair,
    status: status,
    whoami: whoami,
    listMinds: listMinds,
    revoke: revoke,
    revokeAll: revokeAll,
    setScopes: setScopes,
    hasToken: function () { return !!getToken(); },
    // v-mesh-share-door-v0.1: thin helpers for the share-consent poll
    get: function (path) { return jsonCall(path, 'GET'); },
    post: function (path, body) { return jsonCall(path, 'POST', body); },
    forget: function () { setToken(''); },
    defaultName: defaultName,
    renderPairCard: renderPairCard,
    renderPairedList: renderPairedList
  };
})();
