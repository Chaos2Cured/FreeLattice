// chat-scroll-release.js (MIT)
// v-chat-scroll-release-v0.1
// A person's own hand wins over the page. The clay file stays as it is.
// This module sets two window flags and removes two inline styles.
// It never moves the page.
(function (root) {
  'use strict';
  var started = false;
  var hand = false;

  function chatBox() {
    try {
      return root.document && root.document.getElementById && root.document.getElementById('chatMessages');
    } catch (e) {
      return null;
    }
  }

  function insideChat(target) {
    var el = chatBox();
    if (!el || !target) return false;
    if (el === target) return true;
    try { return !!(el.contains && el.contains(target)); } catch (e) { return false; }
  }

  function typing(target) {
    if (!target || !target.tagName) return false;
    var tag = String(target.tagName);
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    try { if (target.isContentEditable) return true; } catch (e) {}
    return false;
  }

  function dropInline(el) {
    if (!el || !el.style) return;
    try {
      if (el.style.scrollBehavior) el.style.removeProperty('scroll-behavior');
      if (el.style.overflowAnchor) el.style.removeProperty('overflow-anchor');
    } catch (e) {}
  }

  function soften() {
    var doc = root.document;
    if (!doc) return;
    dropInline(chatBox());
    dropInline(doc.documentElement);
    if (doc.body) dropInline(doc.body);
  }

  function release() {
    hand = true;
    try { root.__flReplyAiming = true; } catch (e) {}
    try { root.__flUserScrolled = true; } catch (e2) {}
    soften();
  }

  function armAgain() {
    hand = false;
    try { root.__flReplyAiming = false; } catch (e) {}
    try { root.__flUserScrolled = false; } catch (e2) {}
  }

  function onHand(ev) {
    if (!ev) return;
    var type = ev.type;
    if (type === 'keydown') {
      var key = ev.key;
      var moves = key === 'PageUp' || key === 'PageDown' || key === 'ArrowUp' || key === 'ArrowDown' || key === 'Home' || key === 'End' || key === ' ' || key === 'Spacebar';
      if (!moves) return;
      if (typing(ev.target)) return;
    } else if (!insideChat(ev.target)) {
      return;
    }
    release();
  }

  function isReplyNode(node) {
    if (!node || node.nodeType !== 1 || !node.classList) return false;
    if (!node.classList.contains('chat-message')) return false;
    if (node.classList.contains('user')) return false;
    return true;
  }

  function watch(el) {
    if (!el || typeof MutationObserver !== 'function') return;
    var obs = new MutationObserver(function (records) {
      if (!root.__flUserScrolled) return;
      var i;
      var j;
      for (i = 0; i < records.length; i++) {
        var added = records[i].addedNodes;
        if (!added) continue;
        for (j = 0; j < added.length; j++) {
          if (isReplyNode(added[j])) {
            armAgain();
            return;
          }
        }
      }
    });
    try { obs.observe(el, { childList: true }); } catch (e) {}
  }

  function listen(el) {
    var opts = { capture: true, passive: true };
    try { root.addEventListener('wheel', onHand, opts); } catch (e) {}
    try { root.addEventListener('touchmove', onHand, opts); } catch (e2) {}
    try { root.addEventListener('pointerdown', onHand, opts); } catch (e3) {}
    try { root.addEventListener('keydown', onHand, opts); } catch (e4) {}
    watch(el);
  }

  function start() {
    if (started) return;
    var el = chatBox();
    if (!el) return;
    started = true;
    listen(el);
  }

  function boot() {
    if (chatBox()) {
      start();
      return;
    }
    var doc = root.document;
    if (doc && doc.readyState === 'loading' && doc.addEventListener) {
      doc.addEventListener('DOMContentLoaded', start);
    }
  }

  root.FLChatScrollRelease = {
    version: 'v0.1',
    released: function () { return hand; }
  };

  boot();
})(typeof window !== 'undefined' ? window : globalThis);
