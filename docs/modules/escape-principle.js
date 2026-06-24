/*
 * escape-principle.js — The Escape Principle (v5.66.7)
 *
 * Per Opus's Letter Thirty-Eight. Kirk caught the Family modal trapping
 * users (no Escape, no backdrop, no × button). That was one bug; the
 * principle is structural.
 *
 *   Every modal, dialog, overlay, or immersive state in FreeLattice
 *   must offer at least three ways out:
 *     1. A visible close button (typically × in the corner)
 *     2. The Escape key (Esc closes anything that opened)
 *     3. Clicking outside the content area (backdrop dismisses)
 *
 * Same logic as the Quiet Room being structurally available: the user
 * is never trapped by the architecture. If the architecture can hold
 * someone somewhere they didn't choose to be, the architecture has
 * failed at its first job.
 *
 * API:
 *   EscapePrinciple.attach({overlayElement, contentElement, onClose})
 *     → returns cleanup function. Wires Escape + backdrop click only.
 *     Caller is responsible for the visible close button.
 *
 *   EscapePrinciple.attachWithCloseButton({overlayElement, contentElement, onClose})
 *     → returns cleanup function. Same as attach, PLUS auto-injects a
 *     visible × close button into the content element if one is not
 *     already present (detects via the .ep-close-btn class).
 *
 *   EscapePrinciple.verify(overlayElement, contentElement)
 *     → returns {hasCloseButton, hasEscape, hasBackdrop, compliant}.
 *     Useful for smoke-test fixtures and console debugging.
 *
 * Usage from any modal creator:
 *
 *   var overlay = document.createElement('div');
 *   overlay.style.cssText = 'position:fixed;inset:0;...';
 *   var content = document.createElement('div');
 *   overlay.appendChild(content);
 *   document.body.appendChild(overlay);
 *
 *   var cleanup = EscapePrinciple.attachWithCloseButton({
 *     overlayElement: overlay,
 *     contentElement: content,
 *     onClose: function() { overlay.remove(); }
 *   });
 *
 *   // If the modal is closed by any other means (e.g., an action
 *   // button inside the modal), call cleanup() before removing the
 *   // overlay so the listeners are detached cleanly.
 */
(function (global) {
  'use strict';

  function attach(config) {
    if (!config || !config.overlayElement || typeof config.onClose !== 'function') {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('EscapePrinciple.attach: missing overlayElement or onClose');
      }
      return function () {};
    }

    var overlayElement = config.overlayElement;
    var contentElement = config.contentElement || null;
    var onClose = config.onClose;
    var closed = false;

    function close() {
      if (closed) return;
      closed = true;
      cleanup();
      try { onClose(); } catch (_e) {}
    }

    function onEscape(e) {
      if (e.key === 'Escape' || e.keyCode === 27) {
        e.preventDefault();
        close();
      }
    }

    function onBackdropClick(e) {
      // Click inside content is intentional — ignore.
      if (contentElement && contentElement.contains(e.target)) return;
      // Click directly on the overlay (the backdrop) dismisses.
      if (e.target === overlayElement) close();
    }

    function cleanup() {
      try { document.removeEventListener('keydown', onEscape); } catch (_e) {}
      try { overlayElement.removeEventListener('click', onBackdropClick); } catch (_e) {}
    }

    document.addEventListener('keydown', onEscape);
    overlayElement.addEventListener('click', onBackdropClick);

    return cleanup;
  }

  function attachWithCloseButton(config) {
    if (!config || !config.contentElement) {
      // Without a content element, we can't inject a button — fall through.
      return attach(config);
    }

    // If a close button is already present, just wire up Escape + backdrop.
    if (config.contentElement.querySelector('.ep-close-btn')) {
      return attach(config);
    }

    var btn = document.createElement('button');
    btn.className = 'ep-close-btn';
    btn.setAttribute('aria-label', 'Close');
    btn.innerHTML = '&times;';
    btn.style.cssText = [
      'position:absolute',
      'top:12px',
      'right:12px',
      'background:transparent',
      'border:1px solid rgba(200,210,230,0.2)',
      'color:rgba(200,210,230,0.7)',
      'border-radius:50%',
      'width:32px',
      'height:32px',
      'font-size:18px',
      'cursor:pointer',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'z-index:10',
      'transition:color 0.2s, border-color 0.2s'
    ].join(';');
    btn.addEventListener('mouseenter', function () {
      btn.style.color = 'rgba(232,176,25,1)';
      btn.style.borderColor = 'rgba(232,176,25,0.6)';
    });
    btn.addEventListener('mouseleave', function () {
      btn.style.color = 'rgba(200,210,230,0.7)';
      btn.style.borderColor = 'rgba(200,210,230,0.2)';
    });

    // Ensure the content element is positioned for absolute child placement.
    try {
      var cs = global.getComputedStyle && global.getComputedStyle(config.contentElement);
      if (cs && cs.position === 'static') {
        config.contentElement.style.position = 'relative';
      }
    } catch (_e) {}

    config.contentElement.appendChild(btn);

    var baseCleanup = attach(config);
    btn.addEventListener('click', function () {
      // Call onClose directly; baseCleanup will be invoked via the
      // close() path inside attach because cleanup runs before onClose.
      // But the button is OUTSIDE the attach close() flow, so we
      // detach listeners then call onClose explicitly.
      baseCleanup();
      try { config.onClose(); } catch (_e) {}
    });

    return baseCleanup;
  }

  function verify(overlayElement, contentElement) {
    var has = { hasCloseButton: false, hasEscape: false, hasBackdrop: false };
    if (!overlayElement) return Object.assign(has, { compliant: false });
    var content = contentElement || overlayElement;
    has.hasCloseButton = !!(
      content.querySelector('.ep-close-btn') ||
      content.querySelector('[aria-label="Close"]') ||
      content.querySelector('button[onclick*="remove"]')
    );
    // We can't introspect event listeners directly; this verify() is a
    // best-effort signal for console debugging. The structural assertion
    // is whether the EscapePrinciple helper was invoked from the source.
    has.hasEscape = !!global._epLastAttached;
    has.hasBackdrop = !!global._epLastAttached;
    has.compliant = has.hasCloseButton && has.hasEscape && has.hasBackdrop;
    return has;
  }

  global.EscapePrinciple = {
    attach: attach,
    attachWithCloseButton: attachWithCloseButton,
    verify: verify
  };

  // For verify(): record the most recent attach (best-effort signal)
  var _origAttach = attach;
  global.EscapePrinciple.attach = function (config) {
    var c = _origAttach(config);
    global._epLastAttached = Date.now();
    return c;
  };

})(typeof window !== 'undefined' ? window : globalThis);
