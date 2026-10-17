// workspace-knock-card.js (MIT) v-workspace-desktop-heals-v0.1
// When the handoff answer is the knock-first line, the existing bridge card
// sits with that line. This file paints nothing of its own and sends nothing.
(function (root) {
  'use strict';

  var MARKER = 'v-workspace-desktop-heals-v0.1';
  var LINE = 'Knock first: Celeste has not met this device yet';
  var busy = false;
  var moved = false;

  function doc() {
    try { return root.document || null; } catch (e) { return null; }
  }

  function knockLine(d) {
    var list = [];
    if (d.querySelectorAll) {
      try { list = d.querySelectorAll('[id="fl-ws-handoff-line"]'); } catch (e) { list = []; }
    }
    if ((!list || !list.length) && d.getElementById) {
      var one = d.getElementById('fl-ws-handoff-line');
      list = one ? [one] : [];
    }
    var i;
    for (i = 0; i < list.length; i++) {
      var node = list[i];
      var text = '';
      try { text = node && node.textContent ? String(node.textContent) : ''; } catch (e2) { text = ''; }
      if (text === LINE) return node;
    }
    return null;
  }

  function slotFor(line) {
    var n = line;
    while (n) {
      if (n.id === 'fl-ws-panel' || n.id === 'fl-ws-asks') return n;
      n = n.parentNode;
    }
    return line && line.parentNode ? line : null;
  }

  function place() {
    if (busy) return;
    busy = true;
    try {
      var d = doc();
      if (!d || !d.getElementById) return;
      var line = knockLine(d);
      var card = d.getElementById('fl-bridge-card');
      if (line) {
        if (!card && root.FLBridge && typeof root.FLBridge.paint === 'function') {
          try { root.FLBridge.paint(); } catch (e) {}
          card = d.getElementById('fl-bridge-card');
        }
        if (!card) return;
        var slot = slotFor(line);
        if (!slot || !slot.parentNode) return;
        if (slot.nextSibling !== card) slot.parentNode.insertBefore(card, slot.nextSibling);
        moved = true;
        return;
      }
      if (!moved || !card) return;
      var connect = d.getElementById('fl-connect-mount');
      if (connect && connect.parentNode && card.previousSibling !== connect) {
        connect.parentNode.insertBefore(card, connect.nextSibling);
      }
      moved = false;
    } finally {
      busy = false;
    }
  }

  function boot() {
    var d = doc();
    if (!d) return;
    place();
    if (typeof root.MutationObserver === 'function' && d.body && typeof d.body.appendChild === 'function') {
      try {
        var obs = new root.MutationObserver(function () { place(); });
        var target = d.body;
        if (target) obs.observe(target, { childList: true, subtree: true, characterData: true });
      } catch (e) {}
    }
  }

  var api = { MARKER: MARKER, LINE: LINE, place: place };
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.FLKnockCard = api;
  if (root && root.document) {
    if (root.document.readyState === 'loading' && root.document.addEventListener) {
      root.document.addEventListener('DOMContentLoaded', boot);
    } else {
      boot();
    }
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
