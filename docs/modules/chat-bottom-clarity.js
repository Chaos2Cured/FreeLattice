// chat-bottom-clarity.js (MIT)
// v-chat-bottom-clarity-v0.1
// One Add menu for the tools already under the chat.
// The old buttons stay in the page. Their jobs move into the menu.
// Nothing here changes what those jobs do.
(function (root) {
  'use strict';

  var MARK = 'v-chat-bottom-clarity-v0.1';
  var ADD_LABEL = 'Add: Drive, files, photo, voice, picture, search';
  var JUST_LABEL = 'Just me: keep this chat on this device, never ask the pool';
  var BOX_LABEL = "Your computer's AI address (optional)";
  var CLAY_LABEL = 'Clay: let the mind shape light here';
  var NS = 'http://www.w3.org/2000/svg';
  var open = false;
  var arranging = false;

  function doc() {
    return root.document;
  }

  function svg(parts) {
    var el = doc().createElementNS(NS, 'svg');
    el.setAttribute('viewBox', '0 0 24 24');
    el.setAttribute('width', '20');
    el.setAttribute('height', '20');
    el.setAttribute('fill', 'none');
    el.setAttribute('stroke', 'currentColor');
    el.setAttribute('stroke-width', '2');
    el.setAttribute('stroke-linecap', 'round');
    el.setAttribute('stroke-linejoin', 'round');
    el.setAttribute('aria-hidden', 'true');
    var i;
    for (i = 0; i < parts.length; i++) {
      var node = doc().createElementNS(NS, parts[i].tag);
      var key;
      for (key in parts[i].a) {
        if (Object.prototype.hasOwnProperty.call(parts[i].a, key)) node.setAttribute(key, parts[i].a[key]);
      }
      el.appendChild(node);
    }
    return el;
  }

  function path(d) {
    return { tag: 'path', a: { d: d } };
  }

  function words(btn, label, sub) {
    while (btn.firstChild) btn.removeChild(btn.firstChild);
    var copy = doc().createElement('span');
    copy.className = 'fl-add-copy';
    var word = doc().createElement('span');
    word.className = 'fl-add-word';
    word.textContent = label;
    copy.appendChild(word);
    if (sub) {
      var line = doc().createElement('span');
      line.className = 'fl-add-sub';
      line.textContent = sub;
      copy.appendChild(line);
    }
    return copy;
  }

  function fillItem(btn, icon, label, sub) {
    var copy = words(btn, label, sub);
    btn.appendChild(icon);
    btn.appendChild(copy);
    btn.classList.add('fl-add-item');
    btn.setAttribute('aria-label', label);
    if (btn.style) btn.style.opacity = '1';
  }

  function cameraOk() {
    try {
      var touch = (root.navigator && root.navigator.maxTouchPoints > 0) || ('ontouchstart' in root);
      var input = doc().createElement('input');
      return !!(touch && input && ('capture' in input));
    } catch (e) {
      return false;
    }
  }

  function menuEl() {
    return doc().getElementById('flChatAddMenu');
  }

  function addBtn() {
    return doc().getElementById('flChatAddBtn');
  }

  function placeMenu() {
    var menu = menuEl();
    var btn = addBtn();
    if (!menu) return;
    if (!open || !btn) {
      if (menu.style.top) menu.style.top = '';
      if (menu.style.left) menu.style.left = '';
      if (menu.style.maxHeight) menu.style.maxHeight = '';
      return;
    }
    var margin = 12;
    var gap = 8;
    var vh = root.innerHeight || 0;
    var vw = root.innerWidth || 0;
    if (!vh || !vw) return;
    var rect = btn.getBoundingClientRect();
    var above = rect.top - margin;
    var below = vh - rect.bottom - margin;
    var cap = vh - 24;
    if (cap < 44) cap = 44;
    var down = above < 120 && below > above;
    var room = down ? below : above;
    if (room < 44) room = down ? above : below;
    if (room > cap) room = cap;
    if (room < 44) room = cap;
    var left = rect.left;
    if (left < margin) left = margin;
    var widest = Math.min(360, vw - margin * 2);
    if (left > vw - margin - widest) left = Math.max(margin, vw - margin - widest);
    var maxStr = Math.round(room) + 'px';
    var leftStr = Math.round(left) + 'px';
    if (menu.style.maxHeight !== maxStr) menu.style.maxHeight = maxStr;
    if (menu.style.left !== leftStr) menu.style.left = leftStr;
    if (menu.style.right !== 'auto') menu.style.right = 'auto';
    if (menu.style.bottom !== 'auto') menu.style.bottom = 'auto';
    var hold = down ? (rect.bottom + gap) : margin;
    if (menu.style.top !== Math.round(hold) + 'px') menu.style.top = Math.round(hold) + 'px';
    var height = menu.getBoundingClientRect().height || room;
    var topValue = down ? (rect.bottom + gap) : (rect.top - gap - height);
    if (topValue < margin) topValue = margin;
    if (topValue + height > vh - margin) topValue = Math.max(margin, vh - margin - height);
    var topStr = Math.round(topValue) + 'px';
    if (menu.style.top !== topStr) menu.style.top = topStr;
    menu.setAttribute('data-fl-menu-side', down ? 'down' : 'up');
  }

  function setOpen(next) {
    var menu = menuEl();
    var btn = addBtn();
    open = !!next;
    if (menu) menu.setAttribute('data-open', open ? '1' : '0');
    if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    placeMenu();
    if (!open && btn && doc().activeElement && menu && menu.contains(doc().activeElement)) {
      try { btn.focus(); } catch (e) {}
    }
  }

  function closeMenu() {
    var btn = addBtn();
    setOpen(false);
    if (btn) {
      try { btn.focus(); } catch (e) {}
    }
  }

  function toggleMenu() {
    var menu = menuEl();
    if (!menu) return;
    if (open) closeMenu();
    else {
      setOpen(true);
      syncSearchWords();
      var first = menu.querySelector('.fl-add-item:not([hidden])');
      if (first) {
        try { first.focus(); } catch (e) {}
      }
    }
  }

  function makeItem(id, icon, label, sub, press) {
    var btn = doc().createElement('button');
    btn.type = 'button';
    btn.id = id;
    fillItem(btn, icon, label, sub);
    btn.addEventListener('click', function () {
      closeMenu();
      if (press) press();
    });
    return btn;
  }

  function adopt(id, icon, label, sub, lead) {
    var btn = doc().getElementById(id);
    if (!btn) return null;
    btn.removeAttribute('style');
    btn.type = 'button';
    fillItem(btn, icon, label, sub);
    if (lead) btn.classList.add('fl-add-lead');
    if (!btn.__flBottomClose) {
      btn.__flBottomClose = true;
      btn.addEventListener('click', function () { closeMenu(); });
    }
    return btn;
  }

  function speakShown() {
    var mic = doc().getElementById('micBtn');
    if (!mic || !mic.style) return false;
    return mic.style.display !== 'none';
  }

  function syncSpeak() {
    var item = doc().getElementById('flChatAddSpeak');
    if (!item) return;
    if (speakShown()) item.removeAttribute('hidden');
    else item.setAttribute('hidden', '');
  }

  function syncSearchWords() {
    var item = doc().getElementById('flChatAddSearch');
    var toggle = doc().getElementById('flChatSearchToggle');
    if (!item || !toggle) return;
    var text = toggle.textContent || '';
    var pressed = toggle.getAttribute('aria-pressed') === 'true';
    var on = pressed || (text.indexOf('on') !== -1 && text.indexOf('off') === -1);
    var label = on ? 'Search the web: on' : 'Search the web: off';
    var word = item.querySelector('.fl-add-word');
    if (word && word.textContent !== label) word.textContent = label;
    if (item.getAttribute('aria-label') !== label) item.setAttribute('aria-label', label);
  }

  function buildMenu() {
    var d = doc();
    if (!d || d.getElementById('flChatAddMenu')) return;
    var row = d.querySelector('#tab-chat .chat-input-row');
    if (!row) return;
    var btn = d.createElement('button');
    btn.type = 'button';
    btn.id = 'flChatAddBtn';
    btn.className = 'fl-chat-add';
    btn.setAttribute('data-marker', MARK);
    btn.setAttribute('aria-label', ADD_LABEL);
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', 'flChatAddMenu');
    btn.textContent = '+';
    btn.addEventListener('click', function (ev) {
      if (ev && ev.stopPropagation) ev.stopPropagation();
      toggleMenu();
    });
    var menu = d.createElement('div');
    menu.id = 'flChatAddMenu';
    menu.setAttribute('role', 'menu');
    menu.setAttribute('data-marker', MARK);
    menu.setAttribute('data-open', '0');
    var drive = adopt('chatDriveBtn', svg([path('M7 18h10a4 4 0 0 0 .4-8 6 6 0 0 0-11.5-1.6A3.5 3.5 0 0 0 7 18z')]), 'Bring from Google Drive', 'Give the mind a document from your Drive', true);
    var attach = adopt('chatAttachBtn', svg([path('M21.4 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48')]), 'Attach a file or photo', '');
    var camera = null;
    var cameraInput = d.createElement('input');
    cameraInput.type = 'file';
    cameraInput.id = 'flChatCameraInput';
    cameraInput.accept = 'image/*';
    cameraInput.setAttribute('capture', 'environment');
    cameraInput.hidden = true;
    cameraInput.addEventListener('change', function () {
      var file = cameraInput.files && cameraInput.files[0];
      if (file && typeof root.flHandleAttachment === 'function') root.flHandleAttachment(file);
    });
    if (cameraOk()) {
      camera = makeItem('flChatAddCamera', svg([
        { tag: 'path', a: { d: 'M4 8h3l2-2h6l2 2h3a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2z' } },
        { tag: 'circle', a: { cx: '12', cy: '13', r: '3' } }
      ]), 'Take a photo', '', function () { cameraInput.click(); });
    }
    var scan = adopt('chatScanFolderBtn', svg([path('M3 7h6l2 2h10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z')]), 'Scan a folder', '');
    var speak = makeItem('flChatAddSpeak', svg([
      { tag: 'rect', a: { x: '9', y: '2', width: '6', height: '11', rx: '3' } },
      path('M19 10v1a7 7 0 0 1-14 0v-1'),
      { tag: 'line', a: { x1: '12', y1: '19', x2: '12', y2: '22' } }
    ]), 'Speak', '', function () {
      if (typeof root.toggleVoiceInput === 'function') root.toggleVoiceInput();
    });
    var picture = makeItem('flChatAddPicture', svg([
      { tag: 'rect', a: { x: '3', y: '3', width: '18', height: '18', rx: '2' } },
      { tag: 'circle', a: { cx: '8.5', cy: '8.5', r: '1.5' } },
      { tag: 'polyline', a: { points: '21 15 16 10 5 21' } }
    ]), 'Make a picture', '', function () {
      if (typeof root.handleImageGenClick === 'function') root.handleImageGenClick();
    });
    var search = makeItem('flChatAddSearch', svg([
      { tag: 'circle', a: { cx: '12', cy: '12', r: '9' } },
      path('M3 12h18'),
      path('M12 3a14 14 0 0 1 0 18'),
      path('M12 3a14 14 0 0 0 0 18')
    ]), 'Search the web: on', '', function () {
      var toggle = d.getElementById('flChatSearchToggle');
      if (toggle) toggle.click();
      syncSearchWords();
    });
    if (drive) menu.appendChild(drive);
    if (attach) menu.appendChild(attach);
    if (camera) menu.appendChild(camera);
    if (scan) menu.appendChild(scan);
    menu.appendChild(speak);
    menu.appendChild(picture);
    menu.appendChild(search);
    row.insertBefore(btn, row.firstChild);
    row.appendChild(menu);
    d.body.appendChild(cameraInput);
    syncSpeak();
    syncSearchWords();
  }

  function pillRow() {
    var d = doc();
    var row = d.getElementById('flChatPillRow');
    if (row) return row;
    var band = d.getElementById('chatFeelMarketBand');
    if (!band) return null;
    row = d.createElement('div');
    row.id = 'flChatPillRow';
    row.className = 'fl-chat-pill-row';
    row.setAttribute('data-marker', MARK);
    band.insertBefore(row, band.firstChild);
    return row;
  }

  function place(id, parent) {
    var el = doc().getElementById(id);
    if (!el || !parent || el.parentNode === parent) return;
    parent.appendChild(el);
  }

  function markClay() {
    var d = doc();
    var pill = d.getElementById('fl-clay-pill');
    if (pill) {
      if (pill.getAttribute('title') !== CLAY_LABEL) pill.setAttribute('title', CLAY_LABEL);
      if (pill.getAttribute('aria-label') !== CLAY_LABEL) pill.setAttribute('aria-label', CLAY_LABEL);
    }
    var buttons = d.querySelectorAll('#fl-clay-dock button, #fl-clay-pill-panel button');
    var i;
    for (i = 0; i < buttons.length; i++) {
      var text = (buttons[i].textContent || '').replace(/\s+/g, ' ').trim();
      if (text === 'Yes') buttons[i].classList.add('fl-bottom-yes');
    }
  }

  function markJust() {
    var nodes = doc().querySelectorAll('[data-honest-just]');
    var i;
    for (i = 0; i < nodes.length; i++) {
      if (nodes[i].getAttribute('title') !== JUST_LABEL) nodes[i].setAttribute('title', JUST_LABEL);
      if (nodes[i].getAttribute('aria-label') !== JUST_LABEL) nodes[i].setAttribute('aria-label', JUST_LABEL);
    }
  }

  function markBox() {
    var d = doc();
    var input = d.getElementById('flBoxPointerInput');
    if (!input || input.getAttribute('data-fl-box-help') === '1') return;
    input.setAttribute('data-fl-box-help', '1');
    input.setAttribute('title', BOX_LABEL);
    input.setAttribute('aria-label', BOX_LABEL);
    var help = d.createElement('p');
    help.id = 'flBoxPointerHelp';
    help.hidden = true;
    help.textContent = BOX_LABEL + '. It stays on this device.';
    input.addEventListener('focus', function () { help.hidden = false; });
    input.addEventListener('blur', function () { help.hidden = true; });
    if (input.parentNode) input.parentNode.appendChild(help);
  }

  function markCorners() {
    var d = doc();
    var radio = d.getElementById('flRadioFab');
    var help = d.getElementById('quickHelpBtn');
    var music = d.getElementById('musicToggle');
    var more = d.getElementById('chatOverflowBtn');
    if (radio && radio.getAttribute('aria-label') !== 'Radio: calm background tones') {
      radio.setAttribute('aria-label', 'Radio: calm background tones');
      radio.setAttribute('title', 'Radio: calm background tones');
    }
    if (help && help.getAttribute('aria-label') !== 'Quick help') {
      help.setAttribute('aria-label', 'Quick help');
      help.setAttribute('title', 'Quick help');
    }
    if (music && music.getAttribute('aria-label') !== 'Ambient music') {
      music.setAttribute('aria-label', 'Ambient music');
      music.setAttribute('title', 'Ambient music');
    }
    if (more) {
      if (more.getAttribute('aria-label') !== 'More') more.setAttribute('aria-label', 'More');
      if (more.getAttribute('title') !== 'More') more.setAttribute('title', 'More');
      if (!more.__flBottomAlias) {
        more.__flBottomAlias = true;
        more.addEventListener('click', function () {
          setOpen(true);
          if (root.FLChatOverflow && typeof root.FLChatOverflow.close === 'function') {
            try { root.FLChatOverflow.close(); } catch (e) {}
          }
        });
      }
    }
  }

  function calmLine() {
    var d = doc();
    var line = d.getElementById('flChatCalmLine');
    if (line) return line;
    var row = d.querySelector('#tab-chat .chat-input-row');
    if (!row || !row.parentNode) return null;
    line = d.createElement('div');
    line.id = 'flChatCalmLine';
    line.className = 'fl-chat-calm-line';
    row.parentNode.insertBefore(line, row.nextSibling);
    return line;
  }

  function sayPlaceholder() {
    var input = doc().getElementById('chatInput');
    if (!input) return;
    if (input.getAttribute('placeholder') !== 'Say something...') {
      input.setAttribute('placeholder', 'Say something...');
    }
    if (input.getAttribute('aria-label') !== 'Say something...') {
      input.setAttribute('aria-label', 'Say something...');
    }
  }

  function arrange() {
    if (arranging) return;
    arranging = true;
    try {
      buildMenu();
      var pills = pillRow();
      if (pills) {
        place('fl-connect-play-toggle', pills);
        place('chatPresenceToggle', pills);
        place('chatMarketToggle', pills);
        place('fl-clay-pill', pills);
      }
      var calm = calmLine();
      if (calm) {
        place('modelSwitcherWrap', calm);
        place('flBoxPointer', calm);
        place('flChatUpdateRow', calm);
      }
      markClay();
      markJust();
      markBox();
      markCorners();
      sayPlaceholder();
      syncSpeak();
      syncSearchWords();
    } catch (e) {}
    arranging = false;
  }

  function onDocClick(ev) {
    if (!open) return;
    var menu = menuEl();
    var btn = addBtn();
    var t = ev && ev.target;
    if (menu && t && menu.contains(t)) return;
    if (btn && t && (t === btn || btn.contains(t))) return;
    closeMenu();
  }

  function onKey(ev) {
    if (!open) return;
    var key = ev && ev.key;
    if (key !== 'Escape' && key !== 'Esc') return;
    if (ev.preventDefault) ev.preventDefault();
    if (ev.stopPropagation) ev.stopPropagation();
    closeMenu();
  }

  function boot() {
    var d = doc();
    if (!d || !d.getElementById) return;
    arrange();
    if (!root.__flBottomKeys) {
      root.__flBottomKeys = true;
      d.addEventListener('click', onDocClick);
      d.addEventListener('keydown', onKey, true);
      function onPlace(ev) {
        if (!open) return;
        var menu = menuEl();
        var t = ev && ev.target;
        if (menu && t && (t === menu || (menu.contains && menu.contains(t)))) return;
        placeMenu();
      }
      root.addEventListener('resize', onPlace);
      d.addEventListener('scroll', onPlace, true);
    }
    if (typeof root.MutationObserver === 'function' && !root.__flBottomWatch) {
      root.__flBottomWatch = true;
      var passes = 0;
      var obs = new root.MutationObserver(function () {
        if (arranging) return;
        passes += 1;
        if (passes > 12) {
          try { obs.disconnect(); } catch (eStop) {}
          return;
        }
        arrange();
      });
      function watch(node, opts) {
        if (!node) return;
        try { obs.observe(node, opts); } catch (eWatch) {}
      }
      watch(d.querySelector('#tab-chat .chat-input-row'), { childList: true });
      watch(d.getElementById('chatFeelMarketBand'), { childList: true });
      watch(d.getElementById('fl-connect-play'), { childList: true });
      watch(d.getElementById('chatInputSecondary'), { childList: true });
      watch(d.getElementById('micBtn'), { attributes: true, attributeFilter: ['style'] });
      watch(d.getElementById('flChatSearchToggle'), { attributes: true, attributeFilter: ['aria-pressed'] });
    }
  }

  var api = {
    VERSION: 'v0.1',
    MARK: MARK,
    cameraOk: cameraOk,
    open: function () { setOpen(true); },
    close: closeMenu,
    arrange: arrange
  };
  root.FLChatBottom = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root.document) {
    if (root.document.readyState === 'loading' && root.document.addEventListener) {
      root.document.addEventListener('DOMContentLoaded', boot);
    } else boot();
  }
})(typeof window !== 'undefined' ? window : globalThis);
