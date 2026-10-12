// pool-knock-link.js (MIT) v-phone-knocks-v0.1 (033c)
// Desktop app only. When the home Wi-Fi switch is on, one tap shows a join link and its
// picture code for one phone. The phone opens it on the Tree and knocks; this computer still
// asks its person in a native window first. The link is single use and lasts 10 minutes.
// Outside the desktop app this file does nothing at all.
(function (root) {
  'use strict';
  var VERSION = 'v-phone-knocks-v0.1';
  var WORDS = {
    show: 'Show a join link for a phone',
    hint: 'Open this on the phone (camera on the picture code, or type the link). Works once, for 10 minutes, while the switch is on. The phone needs this same Wi-Fi.',
    off: 'Turn on "Let phones on this Wi-Fi find this computer" first.',
    noPic: 'The picture code could not be drawn here; the link below works the same.'
  };
  var _host = null;
  function api() { var a = root.electronAPI; return a && typeof a.latticeDiscoverLink === 'function' ? a : null; }
  function el(tag, cls, text) { var e = root.document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function loadQr() {
    if (root.qrcodegen) return Promise.resolve(root.qrcodegen);
    return new Promise(function (resolve) {
      var s = root.document.createElement('script');
      s.src = 'lib/qrcodegen.js';
      s.addEventListener('load', function () { resolve(root.qrcodegen || null); });
      s.addEventListener('error', function () { resolve(null); });
      root.document.head.appendChild(s);
    });
  }
  function draw(Q, text) {
    var qr = null;
    try { qr = Q.QrCode.encodeText(String(text), Q.QrCode.Ecc.LOW); } catch (e) { return null; }
    var scale = 6, border = 4, n = qr.size + border * 2;
    var c = root.document.createElement('canvas');
    c.width = c.height = n * scale;
    c.setAttribute('aria-label', 'Picture code of the join link');
    var g = c.getContext && c.getContext('2d');
    if (!g) return null;
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = '#000000';
    for (var y = 0; y < qr.size; y++) for (var x = 0; x < qr.size; x++) if (qr.getModule(x, y)) g.fillRect((x + border) * scale, (y + border) * scale, scale, scale);
    return c;
  }
  function show() {
    var a = api();
    if (!a || !_host) return Promise.resolve(null);
    return Promise.resolve(a.latticeDiscoverLink()).then(function (r) {
      var out = _host.querySelector('.pool-knock-link-out');
      while (out.firstChild) out.removeChild(out.firstChild);
      if (!r || !r.ok || typeof r.url !== 'string' || r.url.indexOf('https://thelatticetree.com/') !== 0) { out.appendChild(el('p', '', WORDS.off)); return r; }
      return loadQr().then(function (Q) {
        var pic = Q ? draw(Q, r.url) : null;
        if (pic) out.appendChild(pic); else out.appendChild(el('p', '', WORDS.noPic));
        out.appendChild(el('p', 'pool-knock-link-hint', WORDS.hint));
        var code = el('code', 'pool-knock-link-url', r.url);
        code.style.wordBreak = 'break-all';
        out.appendChild(code);
        return r;
      });
    }, function () { return null; });
  }
  function mount(host) {
    if (!host || !api()) return false;
    _host = host;
    while (host.firstChild) host.removeChild(host.firstChild);
    var b = el('button', 'pool-knock-link-btn', WORDS.show); b.type = 'button'; b.style.minHeight = '44px';
    b.addEventListener('click', function () { show(); });
    host.appendChild(b);
    host.appendChild(el('div', 'pool-knock-link-out'));
    return true;
  }
  root.PoolKnockLink = { VERSION: VERSION, WORDS: WORDS, mount: mount, show: show };
  function boot() { var h = root.document.getElementById('pool-knock-link-host'); if (h) mount(h); }
  if (root.document && root.document.addEventListener) {
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', boot);
    else boot();
  }
})(typeof window !== 'undefined' ? window : this);
