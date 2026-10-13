// pack-update-card.js v-desktop-update-buttons-v0.2
// In-page card. textContent only. Nothing here downloads or installs.
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.FLPackUpdate = api;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this), function () {
  'use strict';

  var WORDS = {
    title: 'A new version is ready',
    unsigned: 'This app is not signed yet. Your computer may warn you. The download comes from github.com/Chaos2Cured/FreeLattice and is checked against its SHA-256 before it opens.',
    update: 'Update',
    notNow: 'Not now',
    ready: 'Ready. Restart now?',
    restart: 'Restart now',
    later: 'Later',
    mismatch: 'That download did not match. Nothing was opened.',
    portable: 'Saved to Downloads. Close this window and open the new one.',
    mac: 'Drag FreeLattice to Applications and choose Replace. If Mac says damaged, see install.html#mac-damaged-quarantine.',
    quiet: 'Could not reach GitHub just now',
    check: 'Check for updates',
    progress: 'Downloading.'
  };

  function runningLabel(version, tag) {
    return 'FreeLattice ' + String(version || '') + ', ' + String(tag || 'dev');
  }

  function debLine(name) {
    return 'Open it with your software installer, or run: sudo apt install ./' + String(name || 'FreeLattice.deb');
  }

  function button(doc, text, id) {
    var b = doc.createElement('button');
    b.type = 'button';
    b.textContent = text;
    b.setAttribute('data-pack', id);
    b.style.minHeight = '44px';
    b.style.minWidth = '44px';
    b.style.marginRight = '8px';
    b.style.marginTop = '8px';
    b.style.padding = '8px 14px';
    b.style.border = '1px solid #c8b56a';
    b.style.borderRadius = '8px';
    b.style.background = 'transparent';
    b.style.color = 'inherit';
    return b;
  }

  function clear(host) {
    while (host.firstChild) host.removeChild(host.firstChild);
  }

  function render(doc, host, model) {
    var m = model || {};
    clear(host);
    var active = !!(m.showCard || m.quiet || m.ready || m.progress || m.detail || m.label);
    host.style.maxWidth = '100%';
    host.style.overflow = 'hidden';
    host.style.boxSizing = 'border-box';
    host.style.wordBreak = 'break-word';
    host.style.width = '100%';
    if (!active) {
      host.style.display = 'none';
      host.style.padding = '0';
      return host;
    }
    host.style.display = 'block';
    host.style.padding = '8px 12px';
    host.style.background = '#241c33';
    host.style.color = '#f4efe4';
    if (m.label) {
      var lab = doc.createElement('p');
      lab.textContent = m.label;
      lab.style.margin = '0 0 6px';
      host.appendChild(lab);
    }
    if (m.quiet) {
      var q = doc.createElement('p');
      q.textContent = WORDS.quiet;
      q.style.margin = '0 0 6px';
      host.appendChild(q);
    }
    if (m.showCard) {
      var title = doc.createElement('p');
      title.textContent = WORDS.title;
      title.style.margin = '0 0 6px';
      title.style.fontWeight = '600';
      host.appendChild(title);
      if (m.line) {
        var line = doc.createElement('p');
        line.textContent = m.line;
        line.style.margin = '0 0 6px';
        host.appendChild(line);
      }
      var note = doc.createElement('p');
      note.textContent = WORDS.unsigned;
      note.style.margin = '0 0 6px';
      host.appendChild(note);
      var update = button(doc, WORDS.update, 'update');
      var notNow = button(doc, WORDS.notNow, 'not-now');
      if (typeof m.onUpdate === 'function') update.addEventListener('click', m.onUpdate);
      if (typeof m.onNotNow === 'function') notNow.addEventListener('click', m.onNotNow);
      host.appendChild(update);
      host.appendChild(notNow);
    }
    if (m.ready) {
      var ready = doc.createElement('p');
      ready.textContent = WORDS.ready;
      ready.style.margin = '8px 0 6px';
      host.appendChild(ready);
      var restart = button(doc, WORDS.restart, 'restart');
      var later = button(doc, WORDS.later, 'later');
      if (typeof m.onRestart === 'function') restart.addEventListener('click', m.onRestart);
      if (typeof m.onLater === 'function') later.addEventListener('click', m.onLater);
      host.appendChild(restart);
      host.appendChild(later);
    }
    if (m.progress) {
      var prog = doc.createElement('p');
      prog.textContent = WORDS.progress;
      prog.style.margin = '8px 0 0';
      host.appendChild(prog);
    }
    if (m.detail) {
      var detail = doc.createElement('p');
      detail.textContent = m.detail;
      detail.style.margin = '8px 0 0';
      host.appendChild(detail);
    }
    var check = button(doc, WORDS.check, 'check');
    if (typeof m.onCheck === 'function') check.addEventListener('click', m.onCheck);
    host.appendChild(check);
    return host;
  }

  function boot() {
    if (typeof document === 'undefined') return;
    if (!window.electronAPI || typeof window.electronAPI.packUpdateState !== 'function') return;
    var host = document.getElementById('fl-pack-update');
    if (!host) {
      host = document.createElement('div');
      host.id = 'fl-pack-update';
      if (document.body) document.body.insertBefore(host, document.body.firstChild);
    }
    if (host.getAttribute && host.getAttribute('data-pack-boot') === '1') return;
    if (host.setAttribute) host.setAttribute('data-pack-boot', '1');
    function paint(state) {
      render(document, host, state || {});
    }
    function wire(state) {
      var s = state || {};
      s.onCheck = function () { window.electronAPI.packUpdateCheck(); };
      s.onUpdate = function () { window.electronAPI.packUpdateApply(); };
      s.onNotNow = function () { window.electronAPI.packUpdateNotNow(); };
      s.onRestart = function () { window.electronAPI.packUpdateRestart(); };
      s.onLater = function () { window.electronAPI.packUpdateLater(); };
      paint(s);
    }
    if (typeof window.electronAPI.onPackUpdate === 'function') window.electronAPI.onPackUpdate(wire);
    window.electronAPI.packUpdateState().then(wire).catch(function () { paint({ quiet: true, onCheck: function () { window.electronAPI.packUpdateCheck(); } }); });
  }

  return { VERSION: 'v-desktop-update-buttons-v0.2', WORDS: WORDS, runningLabel: runningLabel, debLine: debLine, render: render, boot: boot };
});
