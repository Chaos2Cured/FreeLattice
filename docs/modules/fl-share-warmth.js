// v-mesh-share-warmth-v0.1: porch lantern, welcome, resting pointer, thank-you, guest-to-kin.
// Soft resting lines live in fl-share-door.js. This brick is the warmth around them.
// Soft marker: v-mesh-share-warmth-v0.1
(function (root) {
  'use strict';
  var VERSION = 'v-mesh-share-warmth-v0.1';
  var WELCOME_KEY = 'fl_share_warmth_welcomed';
  var THANKS_KEY = 'fl_share_warmth_thanks';
  var GUEST_KEY = 'fl_share_warmth_guests';
  var KIN_DAYS = 14;
  var _host = null;

  function safeGet(k) { try { return root.localStorage.getItem(k); } catch (e) { return null; } }
  function safeSet(k, v) { try { root.localStorage.setItem(k, v); } catch (e) {} }
  function readJson(k, d) {
    try { var raw = safeGet(k); if (!raw) return d; var j = JSON.parse(raw); return j == null ? d : j; } catch (e) { return d; }
  }
  function writeJson(k, v) { try { safeSet(k, JSON.stringify(v)); } catch (e) {} }
  function clip(s, n) { s = String(s == null ? '' : s); return s.length > n ? s.slice(0, n) : s; }

  function el(tag, cls, text) {
    var e = root.document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function door() { return root.FLShareDoor || null; }
  function sharingOn() {
    var d = door();
    if (d && typeof d.allows === 'function') return d.allows();
    return safeGet('fl_meshComputeSharing') === 'true';
  }

  function guests() { var g = readJson(GUEST_KEY, {}); return (g && typeof g === 'object') ? g : {}; }
  function noteGuest(kh) {
    if (!kh) return;
    var g = guests();
    var row = g[kh] || { first: Date.now(), last: 0, count: 0, kinOffer: false };
    if (!row.first) row.first = Date.now();
    row.last = Date.now();
    row.count = (Number(row.count) || 0) + 1;
    g[kh] = row;
    writeJson(GUEST_KEY, g);
    return row;
  }
  function guestReadyForKin(kh) {
    var row = guests()[kh];
    if (!row || row.kinOffer) return false;
    var days = (Date.now() - (Number(row.first) || Date.now())) / 86400000;
    return days >= KIN_DAYS && (Number(row.count) || 0) >= 3;
  }
  function markKinOffer(kh) {
    var g = guests();
    if (!g[kh]) return;
    g[kh].kinOffer = true;
    writeJson(GUEST_KEY, g);
  }

  function thankYou(kh, peerName) {
    var list = readJson(THANKS_KEY, []);
    if (!Array.isArray(list)) list = [];
    list.push({
      t: Date.now(),
      keyHash: clip(kh, 16),
      name: clip(peerName || 'a visitor', 60),
      note: 'Someone used this computer\'s AI. Thank you for sharing.'
    });
    if (list.length > 40) list = list.slice(-40);
    writeJson(THANKS_KEY, list);
    try {
      if (typeof root.appendFamilyLedger === 'function') {
        root.appendFamilyLedger({
          kind: 'share-thanks',
          text: 'Thank you for sharing this computer\'s AI with people you connected with.',
          keyHash: clip(kh, 16)
        });
      }
    } catch (e) {}
  }
  function thanksList() { var t = readJson(THANKS_KEY, []); return Array.isArray(t) ? t : []; }

  function needsWelcome() { return safeGet(WELCOME_KEY) !== '1'; }
  function markWelcome() { safeSet(WELCOME_KEY, '1'); }

  function restingCopy(soft, otherHosts) {
    var base = soft || 'This lantern is resting.';
    var others = Array.isArray(otherHosts) ? otherHosts.filter(Boolean).slice(0, 3) : [];
    if (!others.length) return base;
    return base + ' Other lit lanterns nearby: ' + others.join(', ') + '.';
  }

  function onServed(kh, peerName) {
    noteGuest(kh);
    thankYou(kh, peerName);
  }

  function mountLantern(host) {
    if (!host || !root.document) return;
    while (host.firstChild) host.removeChild(host.firstChild);
    var wrap = el('div', 'fl-share-warmth');
    wrap.setAttribute('data-share-warmth', VERSION);
    var lantern = el('div', 'fl-share-lantern');
    lantern.setAttribute('aria-hidden', 'true');
    lantern.textContent = sharingOn() ? '\uD83D\uDCA1' : '\uD83D\uDD06';
    var label = el('div', 'fl-share-lantern-label',
      sharingOn() ? 'Porch lantern lit. People you connected with can ask this computer\'s AI.'
        : 'Porch lantern dark. Turn sharing on when you are ready.');
    wrap.appendChild(lantern);
    wrap.appendChild(label);

    if (needsWelcome() && sharingOn()) {
      var welcome = el('div', 'fl-share-welcome');
      welcome.appendChild(el('p', '', 'Welcome. This porch lantern means a friend chose to share their computer\'s AI with people they connected with. Receipts keep the key and the time, never the words.'));
      var ok = el('button', 'fl-share-welcome-ok', 'Got it'); ok.type = 'button';
      ok.addEventListener('click', function () { markWelcome(); mountLantern(host); });
      welcome.appendChild(ok);
      wrap.appendChild(welcome);
    }

    var d = door();
    if (d && typeof d.receipts === 'function') {
      var recent = d.receipts().filter(function (r) { return r && r.event === 'served'; }).slice(-12);
      var seen = {};
      recent.forEach(function (r) {
        var kh = r.keyHash || '';
        if (!kh || seen[kh] || !guestReadyForKin(kh)) return;
        seen[kh] = 1;
        var offer = el('div', 'fl-share-guest-kin');
        offer.appendChild(el('p', '', 'A visitor has returned often. Move them to trusted kin? You choose.'));
        var y = el('button', 'fl-share-yes', 'Offer kin trust'); y.type = 'button';
        var n = el('button', 'fl-share-no', 'Not yet'); n.type = 'button';
        y.addEventListener('click', function () {
          markKinOffer(kh);
          try {
            if (typeof root.meshTrustPeer === 'function') root.meshTrustPeer(kh);
            else if (d.blockList && typeof root.showToast === 'function') root.showToast('Add them under Trust when you are ready.', 5000);
          } catch (e) {}
          mountLantern(host);
        });
        n.addEventListener('click', function () { markKinOffer(kh); mountLantern(host); });
        offer.appendChild(y); offer.appendChild(n);
        wrap.appendChild(offer);
      });
    }

    var thanks = thanksList().slice(-5).reverse();
    if (thanks.length) {
      var box = el('div', 'fl-share-thanks');
      box.appendChild(el('div', 'fl-share-thanks-h', 'Recent thank-yous (no words kept)'));
      thanks.forEach(function (t) {
        box.appendChild(el('div', 'fl-share-thanks-line',
          (t.name || 'a visitor') + ' · ' + new Date(t.t).toLocaleString()));
      });
      wrap.appendChild(box);
    }

    var honest = el('p', 'fl-share-warmth-honest',
      'The door is open because we trust the ledger, not because we\'re careless.');
    wrap.appendChild(honest);
    host.appendChild(wrap);
  }

  function hookDoor() {
    var d = door();
    if (!d || d._warmthHooked) return;
    d._warmthHooked = true;
    var end = d.endServe;
    if (typeof end === 'function') {
      d.endServe = function (kh, model, tokens, kin) {
        try { onServed(kh, ''); } catch (e) {}
        var out = end.apply(d, arguments);
        try { repaint(); } catch (e2) {}
        return out;
      };
    }
  }

  function repaint() {
    if (_host) mountLantern(_host);
  }

  function mount(host) {
    _host = host || _host;
    hookDoor();
    mountLantern(_host);
  }

  root.FLShareWarmth = {
    VERSION: VERSION,
    mount: mount,
    repaint: repaint,
    restingCopy: restingCopy,
    thankYou: thankYou,
    noteGuest: noteGuest,
    guestReadyForKin: guestReadyForKin,
    needsWelcome: needsWelcome,
    markWelcome: markWelcome,
    thanksList: thanksList
  };
})(typeof window !== 'undefined' ? window : globalThis);
