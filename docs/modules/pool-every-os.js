// pool-every-os.js (MIT) v-every-os-desktop-v0.1
// Lines under the Wi-Fi switch. The switch file stays as it is.
// Nothing here edits a firewall rule or asks for an admin password.
(function (root) {
  'use strict';
  var BEFORE = 'Windows will ask if FreeLattice may use your network. Choose Private networks so your phone can find this computer. You can say no; this computer still works alone.';
  var FIREWALL = 'No phone reached this computer. Windows firewall may be blocking it. Settings, Privacy and security, Windows Security, Firewall, Allow an app, FreeLattice, Private.';
  var NO_HOME = 'This computer is not on a home network right now.';
  var host = null;
  var platform = '';

  function api() {
    return root.electronAPI || null;
  }
  function line(text) {
    var p = root.document.createElement('p');
    p.className = 'pool-every-os-line';
    p.style.cssText = 'margin:8px 0 0;max-width:40rem;line-height:1.45;';
    p.textContent = text;
    host.appendChild(p);
  }
  function paint(st) {
    if (!host) return;
    while (host.firstChild) host.removeChild(host.firstChild);
    if (!st) return;
    if (st.reason === 'no-private-wifi') line(NO_HOME);
    if (st.nearbyNote) line(st.nearbyNote);
    if (platform === 'win32' && st.noChallenge) line(FIREWALL);
    else if (platform === 'win32' && !st.on) line(BEFORE);
  }
  function refresh() {
    var a = api();
    if (!a || typeof a.latticeDiscoverStatus !== 'function') return;
    Promise.resolve(a.latticeDiscoverStatus()).then(function (st) { paint(st); }, function () {});
  }
  function boot() {
    var a = api();
    var doc = root.document;
    if (!a || !doc || typeof a.getPlatform !== 'function') return;
    var knock = doc.getElementById('pool-knock-host');
    if (!knock || !knock.parentNode) return;
    host = doc.getElementById('pool-every-os-host');
    if (!host) {
      host = doc.createElement('div');
      host.id = 'pool-every-os-host';
      host.style.maxWidth = '100%';
      knock.parentNode.insertBefore(host, knock.nextSibling);
    }
    Promise.resolve(a.getPlatform()).then(function (p) {
      platform = String(p || '');
      refresh();
      setInterval(refresh, 2000);
    }, function () {});
  }

  root.PoolEveryOs = { VERSION: 'v-every-os-desktop-v0.1', BEFORE: BEFORE, FIREWALL: FIREWALL, NO_HOME: NO_HOME, boot: boot };
  if (root.document && root.document.addEventListener) {
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', boot);
    else boot();
  }
})(typeof window !== 'undefined' ? window : globalThis);
