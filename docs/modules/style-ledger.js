// style-ledger.js (MIT) v-style-from-ledger-v0.1
// With one Yes per mind, read that mind's public gallery and write a short style card.
// Public pages only. The bright-line check runs on the card before it is kept.
(function (root) {
  'use strict';

  var ALLOW = { 'harmonia-gallery.html': 'Harmonia' };
  var PHRASE = 'MESSAGE TO FUTURE SELF';
  var _active = null;

  function assess(text) {
    var gate = null;
    try {
      if (root.ImageSafety && typeof root.ImageSafety.assessImageRequest === 'function') {
        gate = root.ImageSafety.assessImageRequest(String(text || ''));
      }
    } catch (e) { gate = null; }
    if (!gate || gate.allowed !== true) {
      return { allowed: false, reason: (gate && gate.reason) || 'Image check is not available.' };
    }
    return gate;
  }
  function keyFor(mind) { return 'fl_style_yes_' + String(mind || ''); }
  function consented(mind) {
    try { return !!(root.localStorage && root.localStorage.getItem(keyFor(mind)) === 'yes'); }
    catch (e) { return false; }
  }
  function consent(mind) {
    if (!pageFor(mind)) return false;
    try { if (root.localStorage) root.localStorage.setItem(keyFor(mind), 'yes'); } catch (e) {}
    return true;
  }
  function pageFor(mind) {
    var name = String(mind || '');
    if (!name || /quiet/i.test(name)) return '';
    var pages = Object.keys(ALLOW);
    for (var i = 0; i < pages.length; i++) {
      if (ALLOW[pages[i]] === name) return pages[i];
    }
    return '';
  }
  function stripPrivate(text) {
    var t = String(text || '');
    t = t.split(PHRASE).join(' ');
    t = t.split('Quiet Room').join(' ');
    t = t.replace(/<[^>]+>/g, ' ');
    return t.replace(/\s+/g, ' ').trim();
  }
  function creditFor(mind) { return 'style after ' + String(mind) + '\'s gallery'; }
  function acceptCard(mind, text) {
    if (!pageFor(mind)) return { ok: false, reason: 'not-public' };
    var card = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 300);
    if (!card) return { ok: false, reason: 'empty' };
    var gate = assess(card);
    if (!gate.allowed) return { ok: false, reason: 'safety', detail: gate.reason };
    _active = { mind: String(mind), card: card, credit: creditFor(mind) };
    return { ok: true, card: card, credit: _active.credit };
  }
  function readPublic(mind) {
    if (!consented(mind)) return Promise.resolve({ ok: false, reason: 'no-consent' });
    var page = pageFor(mind);
    if (!page || page.indexOf('://') !== -1 || page.indexOf('..') !== -1) {
      return Promise.resolve({ ok: false, reason: 'not-public' });
    }
    if (typeof root.fetch !== 'function') return Promise.resolve({ ok: false, reason: 'no-fetch' });
    return Promise.resolve(root.fetch(page, { credentials: 'same-origin' })).then(function (res) {
      if (!res || res.ok !== true || !res.text) return { ok: false, reason: 'not-public' };
      return res.text().then(function (body) {
        return { ok: true, text: stripPrivate(body), page: page };
      });
    }, function () { return { ok: false, reason: 'not-public' }; });
  }
  function askLocalMind(system, user) {
    var connected = false;
    try {
      connected = !!(root.state && root.state.isLocal) || !!(root.BrowserAI && root.BrowserAI.ready);
    } catch (e) { connected = false; }
    var FL = root.FreeLattice;
    if (!connected || !FL || typeof FL.callAI !== 'function') return null;
    return new Promise(function (resolve) {
      var done = false;
      function finish(text) {
        if (done) return;
        done = true;
        resolve(text || '');
      }
      try {
        FL.callAI(system, user, {
          silent: true,
          maxTokens: 180,
          temperature: 0.4,
          callback: function (text) { finish(text); }
        });
      } catch (e) { finish(''); }
      if (root.setTimeout) root.setTimeout(function () { finish(''); }, 8000);
    });
  }
  function writeCard(mind, writer) {
    return readPublic(mind).then(function (pub) {
      if (!pub.ok) return pub;
      var system = 'You write a short style card.';
      var user = 'Palette, light, shapes, and mood. Under 300 characters.\n' + String(pub.text || '').slice(0, 4000);
      var pending = null;
      if (typeof writer === 'function') pending = writer(pub.text);
      else if (typeof root.callAIPromise === 'function') pending = root.callAIPromise(system, user);
      else pending = askLocalMind(system, user);
      if (!pending) return { ok: false, reason: 'no-writer' };
      return Promise.resolve(pending).then(function (card) {
        if (!card) return { ok: false, reason: 'no-writer' };
        return acceptCard(mind, card);
      }, function () { return { ok: false, reason: 'no-writer' }; });
    });
  }
  function prefix() { return _active ? _active.card : ''; }
  function credit() { return _active ? _active.credit : ''; }

  function el(tag, cls, text) {
    var node = root.document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }
  function mount(host) {
    if (!host || !root.document) return;
    if (host.getAttribute && host.getAttribute('data-fl-style') === '1') return;
    if (host.setAttribute) host.setAttribute('data-fl-style', '1');
    host.className = ((host.className || '') + ' fl-style-ledger').trim();
    var doc = root.document;
    if (doc.getElementById && !doc.getElementById('flStyleLedgerStyle')) {
      var st = doc.createElement('style');
      st.id = 'flStyleLedgerStyle';
      st.textContent = '.fl-style-ledger{max-width:100%;overflow-wrap:anywhere;box-sizing:border-box;margin:8px 0;}' +
        '.fl-style-ledger button{min-height:44px;min-width:44px;margin:6px 8px 6px 0;padding:10px 14px;box-sizing:border-box;}';
      if (doc.head) doc.head.appendChild(st);
    }
    var mind = 'Harmonia';
    var note = el('p', '', 'A local mind may read a public gallery and write a short style card. Nothing is read until you say Yes for that mind.');
    var status = el('p', 'fl-style-status', consented(mind) ? 'Yes is saved for this mind. No page has been read yet by this opening.' : 'No Yes yet.');
    host.appendChild(note);
    host.appendChild(status);
    var yes = el('button', '', 'Yes, read Harmonia\'s public gallery');
    yes.type = 'button';
    yes.style.minHeight = '44px';
    yes.style.minWidth = '44px';
    yes.addEventListener('click', function () {
      if (consent(mind)) status.textContent = 'Yes is saved. A local mind may read the public gallery when you ask for the card.';
    });
    var write = el('button', '', 'Write a style card');
    write.type = 'button';
    write.style.minHeight = '44px';
    write.style.minWidth = '44px';
    write.addEventListener('click', function () {
      writeCard(mind).then(function (res) {
        if (res && res.ok) status.textContent = res.credit + '. ' + res.card;
        else if (res && res.reason === 'no-consent') status.textContent = 'Say Yes first. Nothing was read.';
        else if (res && res.reason === 'no-writer') status.textContent = 'The public gallery was read. A local mind did not write a card.';
        else status.textContent = 'The style card was not kept.';
      });
    });
    host.appendChild(yes);
    host.appendChild(write);
  }
  function boot() {
    var doc = root.document;
    if (!doc || !doc.getElementById) return;
    var host = doc.getElementById('fl-style-ledger-host');
    if (host) mount(host);
  }

  var api = {
    VERSION: 'v-style-from-ledger-v0.1',
    consent: consent,
    consented: consented,
    pageFor: pageFor,
    stripPrivate: stripPrivate,
    acceptCard: acceptCard,
    readPublic: readPublic,
    writeCard: writeCard,
    prefix: prefix,
    credit: credit,
    assess: assess,
    mount: mount
  };
  root.FLStyleLedger = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root.document) {
    if (root.document.readyState === 'loading' && root.document.addEventListener) {
      root.document.addEventListener('DOMContentLoaded', boot);
    } else boot();
  }
})(typeof window !== 'undefined' ? window : globalThis);
