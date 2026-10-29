/* FreeLattice: Continuity doorway note v0.1 (window.FLContinuityDoorway)
   Marker: v-continuity-doorway-v0.1
   MIT. One calm line of last intent. Local only. Not a second transcript.
   Store: fl_continuity_doorway_v0 holds short text, a place, and a time.
   Never a key. Pause and Clear win. Quiet when nothing recent is kept.
   This file does not send a message and does not invent an answer.
*/
(function (root) {
  'use strict';

  var VERSION = 'v-continuity-doorway-v0.1';
  var KEY = 'fl_continuity_doorway_v0';
  var MAX = 72;
  var WEEK = 7 * 24 * 60 * 60 * 1000;
  var PLACES = { chat: true, connect: true, gathering: true };

  var host = null;
  var line = null;
  var goBtn = null;

  function looksLikeSecret(text) {
    var s = String(text || '');
    if (/sk-[A-Za-z0-9]{8,}/.test(s)) return true;
    if (/Bearer\s+\S{12,}/.test(s)) return true;
    if (/\b(api[_-]?key|token|secret|password)\b/i.test(s) && /[A-Za-z0-9_\-]{16,}/.test(s)) return true;
    return false;
  }

  function paused() {
    return root.__flUserPaused === true;
  }

  function shorten(text) {
    var clean = String(text || '').replace(/\s+/g, ' ').trim();
    if (clean.length <= MAX) return clean;
    return clean.slice(0, MAX - 3) + '...';
  }

  function drop() {
    try { if (root.localStorage) root.localStorage.removeItem(KEY); } catch (e) {}
  }

  function read() {
    var data = null;
    try {
      var raw = root.localStorage && root.localStorage.getItem(KEY);
      if (!raw) return null;
      data = JSON.parse(raw);
    } catch (e) {
      drop();
      return null;
    }
    if (!data || data.v !== 1 || !PLACES[data.place] || typeof data.text !== 'string') {
      drop();
      return null;
    }
    if (looksLikeSecret(data.text) || looksLikeSecret(JSON.stringify(data))) {
      drop();
      return null;
    }
    var when = Date.parse(data.t || '');
    if (!when || (Date.now() - when) > WEEK) {
      drop();
      return null;
    }
    return { text: shorten(data.text), place: data.place, t: data.t };
  }

  function write(note) {
    try {
      root.localStorage.setItem(KEY, JSON.stringify({
        v: 1,
        text: note.text,
        place: note.place,
        t: note.t
      }));
    } catch (e) {}
  }

  function forget() {
    try { root.localStorage.removeItem(KEY); } catch (e) {}
    paint();
  }

  function remember(text, place) {
    if (paused()) return false;
    if (!PLACES[place]) return false;
    if (looksLikeSecret(text)) return false;
    var clean = shorten(text);
    if (!clean) return false;
    if (looksLikeSecret(clean)) return false;
    write({ text: clean, place: place, t: new Date().toISOString() });
    paint();
    return true;
  }

  function sentence(note) {
    if (note.place === 'connect') return "Here's what we were doing: Connect. " + note.text;
    if (note.place === 'gathering') return "Here's what we were doing: Gathering. " + note.text;
    return "Here's what we were doing: " + note.text;
  }

  function paint() {
    if (!host || !line) return;
    var note = read();
    if (!note || paused()) {
      host.hidden = true;
      line.textContent = '';
      host.removeAttribute('data-place');
      return;
    }
    host.hidden = false;
    host.setAttribute('data-place', note.place);
    line.textContent = sentence(note);
  }

  function continueTo() {
    if (paused()) return;
    var note = read();
    if (!note) return;
    var tab = note.place === 'gathering' ? 'gathering' : (note.place === 'connect' ? 'connect' : 'chat');
    if (typeof root.switchTab === 'function') root.switchTab(tab);
  }

  function ensure() {
    var doc = root.document;
    if (!doc || host) return;
    if (!doc.getElementById('fl-continuity-doorway-style')) {
      var style = doc.createElement('style');
      style.id = 'fl-continuity-doorway-style';
      style.textContent = [
        '#fl-continuity-doorway{display:flex;flex-wrap:wrap;align-items:center;gap:8px;box-sizing:border-box;width:100%;max-width:100%;margin:0;padding:8px 12px;font-family:Georgia,"Times New Roman",serif;font-size:0.95rem;line-height:1.4;}',
        '#fl-continuity-doorway[hidden]{display:none !important;}',
        '#fl-continuity-doorway p{margin:0;flex:1 1 12rem;min-width:0;overflow-wrap:anywhere;}',
        '#fl-continuity-doorway button{box-sizing:border-box;min-height:44px;min-width:44px;padding:12px 16px;border-radius:999px;border:1px solid rgba(232,176,25,0.7);background:transparent;color:inherit;font:inherit;cursor:pointer;}',
        '@media (prefers-reduced-motion: reduce){#fl-continuity-doorway,#fl-continuity-doorway button{animation:none !important;transition:none !important;}}'
      ].join('');
      (doc.head || doc.documentElement).appendChild(style);
    }
    host = doc.createElement('section');
    host.id = 'fl-continuity-doorway';
    host.className = 'fl-continuity-doorway v-continuity-doorway-v0.1';
    host.setAttribute('data-marker', VERSION);
    host.setAttribute('aria-label', 'What we were doing');
    host.hidden = true;
    line = doc.createElement('p');
    line.id = 'fl-continuity-doorway-line';
    line.className = 'v-continuity-doorway-v0.1';
    goBtn = doc.createElement('button');
    goBtn.type = 'button';
    goBtn.id = 'fl-continuity-doorway-continue';
    goBtn.className = 'v-continuity-doorway-v0.1';
    goBtn.textContent = 'Continue';
    goBtn.addEventListener('click', continueTo);
    host.appendChild(line);
    host.appendChild(goBtn);
    var nav = doc.querySelector('.tab-nav-wrap');
    if (nav && nav.parentNode) nav.parentNode.insertBefore(host, nav.nextSibling);
    else doc.body.appendChild(host);
  }

  function fromChatInput() {
    var input = root.document && root.document.getElementById('chatInput');
    if (!input) return;
    remember(input.value, 'chat');
  }

  function onClick(ev) {
    var t = ev && ev.target;
    if (!t || !t.closest) return;
    if (t.closest('#sendBtn')) {
      fromChatInput();
      return;
    }
    if (t.closest('#flgs-pause-btn')) {
      root.setTimeout(function () {
        var receipt = root.document.getElementById('flgs-receipt');
        var said = receipt ? receipt.textContent : '';
        var cur = read();
        if (said.indexOf('Paused') !== -1 && cur && cur.place === 'gathering') forget();
        else paint();
      }, 0);
      return;
    }
    if (t.closest('#flgs-ask-btn')) {
      var ask = root.document.getElementById('flgs-ask');
      if (ask) remember(ask.value, 'gathering');
      return;
    }
    var apply = t.closest('button');
    if (apply && apply.closest('#tab-chat') && String(apply.textContent || '').trim() === 'Apply') {
      remember('Apply a local build', 'chat');
      return;
    }
    var conn = t.closest('#fl-connect-mount a, #fl-connect-mount button, #fl-also-connect a, #fl-also-connect button');
    if (conn) {
      var label = String(conn.textContent || '').replace(/\s+/g, ' ').trim();
      remember(label, 'connect');
    }
  }

  function onKey(ev) {
    if (!ev || ev.key !== 'Enter' || ev.shiftKey) return;
    if (!ev.target || ev.target.id !== 'chatInput') return;
    fromChatInput();
  }

  function hook(name, make) {
    var orig = root[name];
    if (typeof orig !== 'function' || orig.__flDoor053) return;
    var wrapped = make(orig);
    wrapped.__flDoor053 = true;
    root[name] = wrapped;
  }

  function hookSend() {
    hook('sendMessage', function (orig) {
      return function () {
        try { fromChatInput(); } catch (e) {}
        return orig.apply(this, arguments);
      };
    });
  }

  function hookNewChat() {
    hook('confirmNewConversation', function (orig) {
      return function () {
        var p;
        try { p = orig.apply(this, arguments); }
        catch (err) {
          var cur = read();
          if (cur && cur.place === 'chat') forget();
          throw err;
        }
        var after = function () {
          var cur = read();
          if (cur && cur.place === 'chat') forget();
        };
        if (p && typeof p.then === 'function') {
          return p.then(function (v) { after(); return v; }, function (err) { after(); throw err; });
        }
        after();
        return p;
      };
    });
  }

  function hookClearMemory() {
    hook('confirmClearMemory', function (orig) {
      return function () {
        var show = root.showConfirm;
        var restored = false;
        if (typeof show === 'function') {
          root.showConfirm = function () {
            restored = true;
            root.showConfirm = show;
            var p = show.apply(this, arguments);
            if (p && typeof p.then === 'function') {
              return p.then(function (ok) {
                if (ok) forget();
                return ok;
              });
            }
            return p;
          };
        }
        try { return orig.apply(this, arguments); }
        finally { if (!restored && typeof show === 'function') root.showConfirm = show; }
      };
    });
  }

  function boot() {
    if (!root.document || !root.document.body) return;
    ensure();
    hookSend();
    hookNewChat();
    hookClearMemory();
    if (!root.document.__flDoor053) {
      root.document.addEventListener('click', onClick, true);
      root.document.addEventListener('keydown', onKey, true);
      root.document.addEventListener('visibilitychange', function () {
        if (root.document.visibilityState === 'visible') paint();
      });
      root.addEventListener('pageshow', paint);
      root.document.__flDoor053 = true;
    }
    paint();
  }

  root.FLContinuityDoorway = {
    version: VERSION,
    key: KEY,
    remember: remember,
    forget: forget,
    read: read,
    paint: paint,
    looksLikeSecret: looksLikeSecret
  };

  if (root.document) {
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', boot);
    else boot();
  }
})(typeof window !== 'undefined' ? window : globalThis);
