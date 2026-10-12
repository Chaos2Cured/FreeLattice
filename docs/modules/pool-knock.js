// pool-knock.js (MIT) v-page-answers-knock-v0.1 (033b)
// The page half of desktop pooling (033). The FreeLattice desktop app hears a knock on the
// home Wi-Fi, checks the kin card in main, and asks a person in a native window. After a Yes,
// main hands this page public fields only: { joinId, offer, fp, name, choice }. This page then
// answers the TREEPOOL1 invite with the existing tree-pool.js joiner flow (TreePool.readInvite,
// TreePool.join: WebRTC, iceServers [], tree-pool-proof|v1| on the channel) and gives the
// reply code back through electronAPI.latticeDiscoverAnswer(joinId, code).
// Pause wins: a paused pool never turns help on, and a help Yes while paused is connect only.
// This page never opens the switch by itself: Turn on and Resume each open a native window in
// the desktop app. Outside the desktop app this file does nothing at all.
(function (root) {
  'use strict';
  var VERSION = 'v-page-answers-knock-v0.1';
  var POOL_PREFIX = 'TREEPOOL1:';
  var MAX_CODE = 16 * 1024;              // same cap as main (MAX_BODY) and TREEPOOL codes
  var CHOICES = ['help', 'connect'];
  var WORDS = {
    title: 'Let phones on this Wi-Fi find this computer',
    on: 'Turn on',
    off: 'Turn off',
    pause: 'Pause',
    resume: 'Resume',
    isOff: 'Off. No phone on this Wi-Fi can find this computer.',
    isOn: 'On. Phones on this Wi-Fi can find this computer. Each knock still asks you first.',
    isPaused: 'Paused. A knock can only connect, and no one can ask this computer\'s AI.',
    noWifi: 'No private home Wi-Fi was found, so the switch stays off.',
    joined: 'A device you said Yes to was answered. It joins when the channel opens.',
    notAnswered: 'A knock could not be answered, so that device hears no-answer.'
  };
  var _api = null, _pool = null, _busy = false, _host = null, _line = '', _off = null;
  var _counts = { knocks: 0, answered: 0, notAnswered: 0, helpTurnedOn: 0, pausedToConnect: 0 };

  function api() { return _api || (root.electronAPI && root.electronAPI.onLatticeDiscoverKnock ? root.electronAPI : null); }
  function pool() { return _pool || root.TreePool || null; }
  function isDesktop() { var a = api(); return !!(a && typeof a.onLatticeDiscoverKnock === 'function' && typeof a.latticeDiscoverAnswer === 'function'); }
  function str(x, n) { return typeof x === 'string' && x.length <= n ? x : ''; }
  function poolMode() { try { var p = pool(); return p && p.mode ? p.mode() : 'off'; } catch (e) { return 'off'; } }

  function give(joinId, code) {
    var a = api();
    try { return Promise.resolve(a.latticeDiscoverAnswer(joinId, code)).catch(function () { return { ok: false }; }); }
    catch (e) { return Promise.resolve({ ok: false }); }
  }
  function notAnswered(joinId, why) {
    _counts.notAnswered++;
    _line = WORDS.notAnswered;
    paint();
    return give(joinId, '').then(function () { return { ok: false, reason: why }; });
  }

  // One knock, after a person said Yes in the desktop window.
  function handle(k) {
    _counts.knocks++;
    var joinId = str(k && k.joinId, 64), offer = str(k && k.offer, MAX_CODE), fp = str(k && k.fp, 64);
    var choice = CHOICES.indexOf(k && k.choice) !== -1 ? k.choice : '';
    if (!joinId) return Promise.resolve({ ok: false, reason: 'no-join' });
    if (!offer || offer.indexOf(POOL_PREFIX) !== 0 || !choice) return notAnswered(joinId, 'not-an-invite');
    var P = pool();
    if (!P || typeof P.readInvite !== 'function' || typeof P.join !== 'function') return notAnswered(joinId, 'no-pool');
    if (_busy) return notAnswered(joinId, 'busy');             // one join at a time, like main
    // Pause wins, here as in main.
    if (choice === 'help' && poolMode() === 'pause') { choice = 'connect'; _counts.pausedToConnect++; }
    _busy = true;
    return Promise.resolve(P.readInvite(offer)).then(function (r) {
      if (!r || !r.ok || typeof r.sdp !== 'string') return notAnswered(joinId, 'not-an-invite');
      // A card carried in the invite must be the same card main checked and the person said Yes to.
      if (r.card) {
        if (!r.card.ok || (fp && r.card.fp !== fp)) return notAnswered(joinId, 'card-mismatch');
        try { if (P.trustCarried) P.trustCarried(r.card); } catch (e) {}
      }
      return Promise.resolve(P.join(r.sdp)).then(function (j) {
        if (!j || !j.ok || typeof j.code !== 'string' || j.code.indexOf(POOL_PREFIX) !== 0 || j.code.length > MAX_CODE) {
          return notAnswered(joinId, (j && j.reason) || 'cannot');
        }
        // "Yes, and let my mind answer it" opens a closed door for trusted kin. It never resumes a pause.
        if (choice === 'help' && poolMode() === 'off' && P.letHelp) { try { P.letHelp(); _counts.helpTurnedOn++; } catch (e) {} }
        return give(joinId, j.code).then(function () {
          _counts.answered++;
          _line = WORDS.joined;
          paint();
          return { ok: true, peerId: j.peerId, choice: choice };
        });
      });
    }).catch(function () { return notAnswered(joinId, 'cannot'); })
      .then(function (out) { _busy = false; return out; }, function (e) { _busy = false; throw e; });
  }

  function attach(a, p) {
    if (a) _api = a;
    if (p) _pool = p;
    if (!isDesktop()) return { ok: false, reason: 'not-desktop' };
    if (_off) return { ok: true, already: true };
    var ret = api().onLatticeDiscoverKnock(function (k) { handle(k); });
    _off = typeof ret === 'function' ? ret : function () {};
    return { ok: true };
  }
  function detach() { try { if (_off) _off(); } catch (e) {} _off = null; }

  // ---- the small switch (textContent only) ----
  function el(tag, cls, text) { var e = root.document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function stateLine(s) {
    if (!s) return WORDS.isOff;
    if (s.reason === 'no-private-wifi') return WORDS.noWifi;
    if (s.paused) return WORDS.isPaused;
    return s.on ? WORDS.isOn : WORDS.isOff;
  }
  function act(name) {
    var a = api();
    if (!a || typeof a[name] !== 'function') return Promise.resolve(null);
    return Promise.resolve(a[name]()).then(function (s) {
      // Pause wins on both doors: pausing the Wi-Fi switch pauses the pool door too.
      if (name === 'latticeDiscoverPause') { try { var P = pool(); if (P && P.pause && P.mode() === 'kin') P.pause(); } catch (e) {} }
      _line = ''; paint(s); return s;
    }, function () { paint(); return null; });
  }
  function paint(s) {
    if (!_host || !root.document) return;
    var a = api();
    var draw = function (st) {
      while (_host.firstChild) _host.removeChild(_host.firstChild);
      var box = el('div', 'pool-knock');
      box.appendChild(el('strong', 'pool-knock-title', WORDS.title));
      box.appendChild(el('p', 'pool-knock-line', stateLine(st)));
      if (_line) box.appendChild(el('p', 'pool-knock-note', _line));
      var row = el('div', 'pool-knock-row');
      function b(label, name) { var x = el('button', 'pool-knock-btn', label); x.type = 'button'; x.style.minHeight = '44px'; x.addEventListener('click', function () { act(name); }); row.appendChild(x); }
      if (!st || !st.on) b(WORDS.on, 'latticeDiscoverOn');
      else {
        if (st.paused) b(WORDS.resume, 'latticeDiscoverResume'); else b(WORDS.pause, 'latticeDiscoverPause');
        b(WORDS.off, 'latticeDiscoverOff');
      }
      box.appendChild(row);
      _host.appendChild(box);
    };
    if (s) return draw(s);
    if (!a || typeof a.latticeDiscoverStatus !== 'function') return draw(null);
    Promise.resolve(a.latticeDiscoverStatus()).then(draw, function () { draw(null); });
  }
  function mount(host) {
    if (!host || !isDesktop()) return false;   // the switch only exists inside the desktop app
    _host = host;
    paint();
    return true;
  }

  // ---- boot: the desktop app only. On a page without tree-pool.js, load the same-origin copies. ----
  function loadScript(src) {
    return new Promise(function (resolve) {
      var s = root.document.createElement('script');
      s.src = src; s.async = false;
      s.addEventListener('load', function () { resolve(true); });
      s.addEventListener('error', function () { resolve(false); });
      root.document.head.appendChild(s);
    });
  }
  function boot() {
    if (!isDesktop() || !root.document) return Promise.resolve({ ok: false, reason: 'not-desktop' });
    var need = root.TreePool ? Promise.resolve(true)
      : (root.TreeKin ? Promise.resolve(true) : loadScript('modules/tree-kin.js')).then(function () { return root.TreePool ? true : loadScript('modules/tree-pool.js'); });
    return need.then(function () {
      var r = attach();
      var h = root.document.getElementById('pool-knock-host');
      if (h) mount(h);
      return r;
    });
  }

  root.PoolKnock = {
    VERSION: VERSION,
    WORDS: WORDS,
    attach: attach,
    detach: detach,
    handle: handle,
    mount: mount,
    boot: boot,
    isDesktop: isDesktop,
    counts: function () { var o = {}; Object.keys(_counts).forEach(function (k) { o[k] = _counts[k]; }); return o; }
  };
  if (root.document && root.document.addEventListener) {
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', function () { boot(); });
    else boot();
  }
})(typeof window !== 'undefined' ? window : this);
