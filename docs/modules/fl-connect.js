// ═══════════════════════════════════════════════════════════════
// fl-connect.js — FlConnect shared core (FreeLattice + theLatticeTree)
//
// Marker: v-connect-under-more-v0 · heal v0.1 · v-connect-port-picker-v0 · heal v0.2
// Layer, never delete. Prefer helped Bridge (11435…) before bare 11434.
// Port-only loopback: fl_localPort_manual holds "11500" only — never foreign hosts.
// Soft leave sw.js. Alpha: fl_alpha_local_mind. Never bare *.
// ═══════════════════════════════════════════════════════════════

(function (root) {
  'use strict';

  var BRIDGE_DEFAULT = 11435;
  var ALPHA_KEY = 'fl_alpha_local_mind';
  var MANUAL_KEY = 'fl_localPort_manual';
  var INSTALL_BRIDGE = 'https://freelattice.com/install.html#bridge-download';
  var LOOP_MAX_MS = 5 * 60 * 1000;

  var _timer = null;
  var _hostEl = null;
  var _intervalMs = 8000;
  var _startedAt = 0;
  var _lastSig = '';
  var _loopStopped = false;
  var _pausedHidden = false;
  var _visBound = false;
  var _lastReport = null;
  var _tickN = 0;
  var _fullScanMiss = false;
  var _manualRejectMsg = '';

  function isAlpha() {
    try {
      var h = (location.hostname || '').toLowerCase();
      if (h.indexOf('thelatticetree') !== -1) return true;
      if (root.LocalMindProbe && root.LocalMindProbe.STORAGE_KEY === ALPHA_KEY) return true;
      if (document.documentElement && document.documentElement.getAttribute('data-garden-galaxy') === 'garden') {
        if (!root.AiSetup && root.LocalMindProbe) return true;
      }
    } catch (e) {}
    return false;
  }

  function normalizePort(raw) {
    raw = String(raw || '').trim();
    if (!raw) return null;
    if (/^\d{1,5}$/.test(raw)) {
      var n = parseInt(raw, 10);
      return (n >= 1 && n <= 65535) ? String(n) : null;
    }
    var m = raw.match(/^(?:https?:\/\/)?(127\.0\.0\.1|localhost)(?::(\d{1,5}))?(?:\/.*)?$/i);
    if (m) {
      var p = m[2] ? parseInt(m[2], 10) : 11434;
      return (p >= 1 && p <= 65535) ? String(p) : null;
    }
    return null;
  }

  function getManualPort() {
    try { return normalizePort(localStorage.getItem(MANUAL_KEY) || ''); }
    catch (e) { return null; }
  }

  function getManualBase() {
    var port = getManualPort();
    return port ? ('http://127.0.0.1:' + port) : null;
  }

  function setManualHost(raw) {
    _manualRejectMsg = '';
    try {
      raw = String(raw || '').trim();
      if (!raw) {
        localStorage.removeItem(MANUAL_KEY);
        return { ok: true, cleared: true };
      }
      var port = normalizePort(raw);
      if (!port) {
        _manualRejectMsg = 'For safety this only talks to your own computer. Type just the number, like 11500.';
        return { ok: false, reason: 'foreign', message: _manualRejectMsg };
      }
      localStorage.setItem(MANUAL_KEY, port);
      return { ok: true, port: port, base: 'http://127.0.0.1:' + port };
    } catch (e) { return { ok: false }; }
  }

  function clearManualHost() {
    _manualRejectMsg = '';
    try { localStorage.removeItem(MANUAL_KEY); } catch (e) {}
  }

  function savedBridgePort() {
    try {
      var saved = parseInt(localStorage.getItem('fl_bridgePort') || '', 10);
      if (saved && saved !== 11434) return saved;
    } catch (e0) {}
    return null;
  }

  function bridgeCandidates(opts) {
    opts = opts || {};
    var ports = [];
    var saved = savedBridgePort();
    if (saved) ports.push(saved);
    if (!opts.fullScan) return ports.length ? ports : [];
    if (ports.indexOf(BRIDGE_DEFAULT) < 0) ports.push(BRIDGE_DEFAULT);
    for (var i = 1; i <= 10; i++) {
      var p = BRIDGE_DEFAULT + i;
      if (p !== 11434 && ports.indexOf(p) < 0) ports.push(p);
    }
    return ports;
  }

  function abortMs(ms) {
    if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
      return AbortSignal.timeout(ms);
    }
    return undefined;
  }

  async function healthAt(port) {
    try {
      var r = await fetch('http://127.0.0.1:' + port + '/bridge/health', {
        method: 'GET', mode: 'cors', signal: abortMs(1500)
      });
      if (!r.ok) return null;
      var j = await r.json();
      if (j && j.bridge) { j._probedPort = port; return j; }
    } catch (e) {}
    return null;
  }

  async function tagsAt(base) {
    var url = String(base || '').replace(/\/+$/, '') + '/api/tags';
    var r = await fetch(url, { method: 'GET', mode: 'cors', signal: abortMs(4000) });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    var data = await r.json();
    return (data && data.models) ? data.models : [];
  }

  function preferHelpedBridge(port) {
    port = parseInt(port, 10) || BRIDGE_DEFAULT;
    if (!port || port === 11434) return null;
    var base = 'http://127.0.0.1:' + port;
    try {
      localStorage.setItem('fl_bridgePort', String(port));
      if (!isAlpha()) {
        localStorage.setItem('fl_ollamaHost', '127.0.0.1:' + port);
        localStorage.setItem('fl_provider', 'ollama');
      }
    } catch (e0) {}
    try {
      if (typeof root.flRememberHelpedBridge === 'function') root.flRememberHelpedBridge(port);
    } catch (e1) {}
    return base;
  }

  async function probeBridgePorts(ports) {
    for (var i = 0; i < ports.length; i++) {
      var h = await healthAt(ports[i]);
      if (h) return { health: h, port: h.port || ports[i] };
    }
    return null;
  }

  async function probe(opts) {
    opts = opts || {};
    _tickN += 1;
    var report = {
      bridge: null, ollama: null, models: [], helped: false, port: null,
      waitingHelp: false, base: null, stickyFallback: false, loopStopped: _loopStopped,
      ollamaReadyWhileBridgeWaits: false, nextLookSec: Math.round(_intervalMs / 1000),
      cloudReady: hasCloudMind(), manualQuiet: false, manualReject: _manualRejectMsg || '',
      wanted: null
    };

    // 1) Manual port first — quiet = STOP (no silent fallthrough)
    var manBase = getManualBase();
    if (manBase) {
      report.wanted = manBase;
      try {
        report.models = await tagsAt(manBase);
        report.base = manBase;
        report.ollama = { via: 'manual', base: manBase };
        return report;
      } catch (eManTags) {}
      try {
        var manPort = getManualPort();
        var mh = manPort ? await healthAt(parseInt(manPort, 10)) : null;
        if (mh && mh.helped) {
          report.bridge = mh;
          report.port = mh.port || parseInt(manPort, 10);
          report.helped = true;
          report.base = preferHelpedBridge(report.port) || manBase;
          try {
            report.models = await tagsAt(report.base);
            report.ollama = { via: 'manual-bridge', base: report.base };
            return report;
          } catch (eMB) {}
        } else if (mh) {
          report.bridge = mh;
          report.port = mh.port || parseInt(manPort, 10);
          report.waitingHelp = true;
        }
      } catch (eManBr) {}
      report.manualQuiet = true;
      report.base = null;
      return report;
    }

    // 2) Saved Bridge · 3) scan 11435–11445 · 4) direct 11434
    var wantFull = opts.fullScan || !_fullScanMiss || (_tickN % 3 === 0);
    var hit = await probeBridgePorts(bridgeCandidates({ fullScan: false }));
    if (!hit && wantFull) {
      hit = await probeBridgePorts(bridgeCandidates({ fullScan: true }));
      if (!hit) _fullScanMiss = true;
    }

    if (hit) {
      report.bridge = hit.health;
      report.port = hit.port;
      report.helped = !!(hit.health && hit.health.helped);
      if (report.helped) {
        report.base = preferHelpedBridge(report.port);
        try {
          report.models = await tagsAt(report.base);
          report.ollama = { via: 'bridge', base: report.base };
          return report;
        } catch (eTags) {
          try {
            report.models = await tagsAt('http://127.0.0.1:11434');
            report.base = 'http://127.0.0.1:11434';
            report.ollama = { via: 'direct-sticky', base: report.base };
            report.stickyFallback = true;
          } catch (eSticky) {}
          return report;
        }
      }
      report.waitingHelp = true;
      try {
        var directWhile = await tagsAt('http://127.0.0.1:11434');
        if (directWhile && directWhile.length) {
          report.models = directWhile;
          report.base = 'http://127.0.0.1:11434';
          report.ollama = { via: 'direct', base: report.base };
          report.ollamaReadyWhileBridgeWaits = true;
          report.stickyFallback = true;
        }
      } catch (eW) {}
      return report;
    }

    try {
      report.models = await tagsAt('http://127.0.0.1:11434');
      report.base = 'http://127.0.0.1:11434';
      report.ollama = { via: 'direct', base: report.base };
      if (savedBridgePort()) report.stickyFallback = true;
    } catch (eDirect) {}
    return report;
  }

  async function listMinds() {
    var r = await probe({ gesture: true });
    return r.models || [];
  }

  function hasLocalMind() {
    if (isAlpha()) {
      try {
        if (root.LocalMindProbe && typeof root.LocalMindProbe.getRemembered === 'function') {
          var m = root.LocalMindProbe.getRemembered();
          return !!(m && m.model && String(m.model).trim());
        }
      } catch (eA) {}
      try {
        var raw = localStorage.getItem(ALPHA_KEY);
        if (raw) {
          var parsed = JSON.parse(raw);
          return !!(parsed && parsed.model && String(parsed.model).trim());
        }
      } catch (eB) {}
      return false;
    }
    try {
      if (typeof root.state !== 'undefined' && root.state && root.state.isLocal && root.state.ollamaModel && String(root.state.ollamaModel).trim()) return true;
      if (localStorage.getItem('fl_isLocal') === 'true' && localStorage.getItem('fl_ollamaModel')) return true;
    } catch (e) {}
    return false;
  }

  function hasCloudMind() {
    if (isAlpha()) return false;
    try {
      if (typeof root.state !== 'undefined' && root.state && root.state.apiKey && String(root.state.apiKey).length > 5) return true;
    } catch (e) {}
    return false;
  }

  function isConnected() { return hasLocalMind(); }

  function remember(mind) {
    mind = mind || {};
    var name = mind.name || mind.model || (mind.models && mind.models[0] && (mind.models[0].name || mind.models[0])) || '';
    var base = mind.base || mind.url || '';
    if (base.indexOf('/api/tags') !== -1) base = base.replace(/\/api\/tags\/?$/, '');
    if (!base && mind.port) base = 'http://127.0.0.1:' + mind.port;

    if (isAlpha()) {
      var entry = {
        name: name || 'local mind',
        url: (base ? String(base).replace(/\/+$/, '') + '/api/tags' : ''),
        model: name,
        models: name ? [name] : [],
        minds: [], roster: [], gatheringBinds: {}, speakingChair: ''
      };
      try {
        if (root.LocalMindProbe && typeof root.LocalMindProbe.remember === 'function') {
          var prior = root.LocalMindProbe.getRemembered && root.LocalMindProbe.getRemembered();
          if (prior && prior.roster) entry.roster = prior.roster;
          if (prior && prior.gatheringBinds) entry.gatheringBinds = prior.gatheringBinds;
          root.LocalMindProbe.remember(entry);
        } else {
          localStorage.setItem(ALPHA_KEY, JSON.stringify(entry));
        }
      } catch (eA) {}
      stopLoop();
      return entry;
    }

    try {
      if (base) {
        var host = String(base).replace(/^https?:\/\//, '').replace(/\/+$/, '');
        if (/^(127\.0\.0\.1|localhost)(:\d+)?$/i.test(host)) {
          localStorage.setItem('fl_ollamaHost', host.replace(/^localhost/i, '127.0.0.1'));
        }
      }
      localStorage.setItem('fl_provider', 'ollama');
      localStorage.setItem('fl_isLocal', 'true');
      if (name) localStorage.setItem('fl_ollamaModel', name);
      if (typeof root.state !== 'undefined' && root.state) {
        root.state.isLocal = true;
        root.state.provider = 'ollama';
        if (name) root.state.ollamaModel = name;
      }
      if (typeof root.handleLocalToggle === 'function') root.handleLocalToggle(true);
      if (typeof root.updateStatus === 'function') root.updateStatus();
      if (root.AiSetup && typeof root.AiSetup.updateStatus === 'function') root.AiSetup.updateStatus();
    } catch (eF) {}
    stopLoop();
    return { name: name, base: base };
  }

  function open() {
    try {
      if (!isAlpha() && typeof root.switchTab === 'function') { root.switchTab('connect'); return true; }
    } catch (e0) {}
    try {
      if (_hostEl) { _hostEl.scrollIntoView({ behavior: 'smooth', block: 'center' }); lookAgain(); return true; }
    } catch (e1) {}
    return false;
  }

  function detectOs() {
    var ua = (navigator.userAgent || '').toLowerCase();
    if (/windows/.test(ua)) return 'win';
    if (/mac os|macintosh/.test(ua)) return 'mac';
    return 'linux';
  }

  function bridgeLinksHtml() {
    var os = detectOs();
    var links = [
      { label: 'Download Bridge · Mac', href: 'https://github.com/Chaos2Cured/FreeLattice/releases/download/bridge-v0.1/FreeLattice-Bridge_0.1.0_macOS.zip' },
      { label: 'Download Bridge · Windows Portable', href: 'https://github.com/Chaos2Cured/FreeLattice/releases/download/bridge-v0.1/FreeLattice-Bridge_0.1.0_Windows_Portable.exe' },
      { label: 'Download Bridge · Windows Setup', href: 'https://github.com/Chaos2Cured/FreeLattice/releases/download/bridge-v0.1/FreeLattice-Bridge_0.1.0_Windows_Setup.exe' },
      { label: 'Download Bridge · Linux AppImage', href: 'https://github.com/Chaos2Cured/FreeLattice/releases/download/bridge-v0.1/FreeLattice-Bridge_0.1.0_Linux.AppImage' }
    ];
    var primary = os === 'mac' ? links[0] : (os === 'win' ? links[1] : links[3]);
    return '<a class="flc-btn flc-primary" href="' + primary.href + '">' + primary.label + '</a>' +
      '<p class="flc-soft"><a href="' + INSTALL_BRIDGE + '">All Bridge downloads</a> · Open → <strong>Yes, help</strong></p>';
  }

  function portPickerHtml(idSuffix) {
    var cur = '';
    try { cur = getManualPort() || ''; } catch (e) {}
    var id = 'flc-manual-' + (idSuffix || 'a');
    return '<div class="flc-picker">' +
      '<label class="flc-soft" for="' + id + '">Use a different address</label>' +
      '<div class="flc-picker-row">' +
      '<input id="' + id + '" type="text" value="' + String(cur).replace(/"/g, '&quot;') + '" placeholder="11500" autocomplete="off" />' +
      '<button type="button" class="flc-btn flc-primary" data-flc-try-addr="' + id + '">Try</button>' +
      '</div></div>';
  }

  function reportSignature(report) {
    report = report || {};
    var names = (report.models || []).map(function (m) { return (m && (m.name || m.model)) || String(m); }).join('|');
    return [report.helped?1:0, report.waitingHelp?1:0, report.port||'', report.base||'', report.manualQuiet?1:0, report.ollamaReadyWhileBridgeWaits?1:0, names, hasLocalMind()?1:0, hasCloudMind()?1:0, _loopStopped?1:0, getManualPort()||'', report.manualReject||''].join('::');
  }

  function panelVisible() {
    if (!_hostEl) return false;
    try {
      if (!document.body.contains(_hostEl)) return false;
      if (_hostEl.hidden) return false;
      var tab = document.getElementById('tab-connect');
      if (tab && !tab.classList.contains('active')) return false;
    } catch (e) {}
    return true;
  }

  function stopLoop() { _loopStopped = true; if (_timer) { clearTimeout(_timer); _timer = null; } }
  function clearTimer() { if (_timer) { clearTimeout(_timer); _timer = null; } }
  function nextBackoff() { if (_intervalMs < 16000) _intervalMs = 16000; else _intervalMs = 30000; }
  function scheduleLoop() {
    clearTimer();
    if (_loopStopped || _pausedHidden) return;
    _timer = setTimeout(function () { tickLoop(); }, _intervalMs);
  }

  async function tickLoop() {
    if (_loopStopped || _pausedHidden) return;
    if (!panelVisible()) { stopLoop(); return; }
    if (hasLocalMind()) { stopLoop(); if (_lastReport) render(_lastReport, true); return; }
    if (_startedAt && (Date.now() - _startedAt) >= LOOP_MAX_MS) {
      stopLoop();
      var r = _lastReport || { models: [] };
      r.loopStopped = true;
      render(r, true);
      return;
    }
    await refreshUI({ fromLoop: true });
    nextBackoff();
    scheduleLoop();
  }

  function onVisibility() {
    if (document.hidden) { _pausedHidden = true; clearTimer(); return; }
    _pausedHidden = false;
    if (_loopStopped || hasLocalMind() || !panelVisible()) return;
    _intervalMs = 8000;
    scheduleLoop();
  }

  function bindVisibility() {
    if (_visBound) return;
    _visBound = true;
    document.addEventListener('visibilitychange', onVisibility);
  }
  function unbindVisibility() {
    if (!_visBound) return;
    _visBound = false;
    document.removeEventListener('visibilitychange', onVisibility);
  }

  function fillModelLists(report) {
    var lists = _hostEl.querySelectorAll('.flc-models');
    for (var li = 0; li < lists.length; li++) {
      var hostList = lists[li];
      var names = [];
      try { names = JSON.parse(hostList.getAttribute('data-flc-names') || '[]'); } catch (eN) { names = []; }
      while (hostList.firstChild) hostList.removeChild(hostList.firstChild);
      names.forEach(function (name) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'flc-model';
        btn.textContent = name;
        btn.dataset.model = name;
        btn.addEventListener('click', function () {
          remember({ name: name, base: report.base, port: report.port });
          refreshUI({ force: true });
          try { if (typeof root.showToast === 'function') root.showToast('Connected · ' + name); } catch (eT) {}
        });
        hostList.appendChild(btn);
      });
    }
  }

  function bindPicker() {
    var tries = _hostEl.querySelectorAll('[data-flc-try-addr]');
    for (var i = 0; i < tries.length; i++) {
      tries[i].addEventListener('click', function (ev) {
        var id = ev.currentTarget.getAttribute('data-flc-try-addr');
        var input = document.getElementById(id);
        setManualHost(input ? input.value : '');
        lookAgain();
      });
    }
    var autos = _hostEl.querySelectorAll('[data-flc-use-auto]');
    for (var a = 0; a < autos.length; a++) {
      autos[a].addEventListener('click', function () { clearManualHost(); lookAgain(); });
    }
  }

  function modelListHtml(tag, models) {
    var names = (models || []).map(function (m) { return (m && (m.name || m.model)) || String(m); });
    return '<div class="flc-card"><p class="flc-tag">' + tag + '</p><div class="flc-models" role="list" data-flc-names="' +
      String(JSON.stringify(names)).replace(/&/g, '&amp;').replace(/"/g, '&quot;') + '"></div></div>';
  }

  function render(report, force) {
    if (!_hostEl) return;
    report = report || {};
    report.nextLookSec = Math.round(_intervalMs / 1000);
    var sig = reportSignature(report);
    if (!force && sig === _lastSig) return;
    _lastSig = sig;
    _lastReport = report;
    var models = report.models || [];
    var alpha = isAlpha();
    var html = '';
    html += '<div class="flc-wrap v-connect-under-more-v0 v-connect-port-picker-v0">';
    html += '<p class="flc-eyebrow">Connect · mind on this computer</p>';
    html += '<h2 class="flc-title">Connect</h2>';
    html += '<p class="flc-lede">One door. Download Bridge → Open → Yes, help → tap your model. No Terminal on the main path.</p>';

    if (report.manualReject) html += '<div class="flc-card flc-wait"><p>' + report.manualReject + '</p></div>';
    if (report.manualQuiet) {
      html += '<div class="flc-card flc-wait"><p>Nothing answered on ' + (report.wanted || 'your port') + '.</p>';
      html += '<button type="button" class="flc-btn flc-primary" data-flc-look-again>Look again</button> ';
      html += '<button type="button" class="flc-btn flc-primary" data-flc-use-auto>Use automatic</button></div>';
    }

    if (hasCloudMind() && !hasLocalMind()) {
      html += '<div class="flc-card flc-ok"><strong>Cloud mind: ready</strong> — you can still look for a mind on this computer below.</div>';
    }
    if (hasLocalMind()) {
      html += '<div class="flc-card flc-ok">A mind on this computer is connected. Looking rests until you need another.</div>';
    }
    if (!_loopStopped && !hasLocalMind() && !report.manualQuiet) {
      html += '<p class="flc-status">Looking… next look in ' + (report.nextLookSec || 8) + 's</p>';
    }
    html += '<button type="button" class="flc-btn flc-primary flc-look-again" data-flc-look-again>Look again</button>';

    if (!report.manualQuiet) {
      if (report.ollamaReadyWhileBridgeWaits && models.length) {
        html += modelListHtml('Ollama is ready, pick a mind', models);
        html += '<div class="flc-card flc-wait"><p><strong>Your Bridge is also open.</strong> Click <em>Yes, help</em> in its window if you want Bridge instead.</p></div>';
      } else if (report.helped && models.length) {
        html += modelListHtml('Minds found', models);
      } else if (report.waitingHelp || (report.bridge && !report.helped)) {
        html += '<div class="flc-card flc-wait"><p><strong>Your Bridge is open.</strong> Click <em>Yes, help</em> in its window.</p></div>';
        html += portPickerHtml('wait');
      } else if (models.length) {
        html += modelListHtml('Minds found', models);
      } else {
        html += '<div class="flc-card flc-download"><p class="flc-tag">No local mind yet</p>';
        html += bridgeLinksHtml();
        html += portPickerHtml('miss');
        html += '</div>';
      }
    }

    html += '<details class="flc-other"><summary>Other ways</summary><ul>';
    html += '<li><a href="https://freelattice.com/desktop.html">Desktop app</a> — double-click home</li>';
    if (alpha) {
      html += '<li>No-install browser mind — Garden → Settings</li>';
      html += '<li>Cloud key — when your garden offers one</li>';
    } else {
      html += '<li>No-install browser mind — Settings → Browser AI</li>';
      html += '<li>Cloud key — Change Provider when you have one</li>';
    }
    html += '</ul>';
    html += portPickerHtml('other');
    html += '<p class="flc-soft">Advanced (Terminal) stays under Settings — never on this main path.</p></details>';
    html += '<details class="flc-builders"><summary>For builders</summary>';
    html += '<p>Named five stay five. Family uncapped. Quiet Room shut.</p>';
    html += '<p class="flc-marker">v-connect-under-more-v0 · heal v0.1 · v-connect-port-picker-v0 · heal v0.2 · soft leave sw.js</p>';
    html += '</details></div>';

    _hostEl.innerHTML = html;
    fillModelLists(report);
    var again = _hostEl.querySelectorAll('[data-flc-look-again]');
    for (var j = 0; j < again.length; j++) again[j].addEventListener('click', function () { lookAgain(); });
    bindPicker();
  }

  function reportSignature(report) {
    report = report || {};
    var names = (report.models || []).map(function (m) { return (m && (m.name || m.model)) || String(m); }).join('|');
    return [report.helped?1:0, report.waitingHelp?1:0, report.port||'', report.base||'', report.manualQuiet?1:0, report.ollamaReadyWhileBridgeWaits?1:0, names, hasLocalMind()?1:0, hasCloudMind()?1:0, _loopStopped?1:0, getManualPort()||'', report.manualReject||''].join('::');
  }

  async function refreshUI(opts) {
    opts = opts || {};
    var report = await probe({ gesture: true });
    report.loopStopped = _loopStopped;
    render(report, !!opts.force);
    if (hasLocalMind()) stopLoop();
    return report;
  }

  function lookAgain() {
    _loopStopped = false;
    _pausedHidden = !!document.hidden;
    _intervalMs = 8000;
    _startedAt = Date.now();
    _lastSig = '';
    _fullScanMiss = false;
    refreshUI({ force: true }).then(function () {
      if (!_loopStopped && !_pausedHidden && !hasLocalMind()) scheduleLoop();
    });
  }

  function ensureStyles() {
    if (document.getElementById('fl-connect-styles')) return;
    var s = document.createElement('style');
    s.id = 'fl-connect-styles';
    s.textContent = [
      '.flc-wrap{max-width:40rem;margin:0 auto;padding:1.25rem 1rem 2rem;font-family:Georgia,serif;color:rgba(220,225,235,.92);position:relative;z-index:40;max-height:calc(100dvh - 4.5rem);overflow-y:auto;-webkit-overflow-scrolling:touch}',
      '.flc-eyebrow{font-size:.72rem;letter-spacing:.12em;text-transform:uppercase;color:rgba(52,211,153,.75);margin:0 0 .5rem;font-family:ui-monospace,Menlo,monospace}',
      '.flc-title{font-size:1.55rem;color:#34d399;margin:0 0 .5rem;font-weight:600}',
      '.flc-lede{font-size:.95rem;line-height:1.55;margin:0 0 1rem;color:rgba(200,210,230,.85)}',
      '.flc-status{font-size:.85rem;color:rgba(196,181,230,.9);margin:0 0 .5rem}',
      '.flc-look-again{margin:0 0 1rem}',
      '.flc-card{padding:1rem 1.05rem;border-radius:12px;border:1px solid rgba(52,211,153,.28);background:rgba(52,211,153,.06);margin:0 0 1rem}',
      '.flc-wait{border-color:rgba(232,176,25,.35);background:rgba(232,176,25,.07)}',
      '.flc-ok{border-color:rgba(52,211,153,.4)}',
      '.flc-tag{font-size:.72rem;letter-spacing:.06em;text-transform:uppercase;color:#a5f3fc;margin:0 0 .6rem;font-family:ui-monospace,Menlo,monospace}',
      '.flc-models{display:flex;flex-direction:column;gap:.45rem}',
      '.flc-model{min-height:44px;text-align:left;padding:.7rem .85rem;border-radius:10px;border:1px solid rgba(200,210,230,.16);background:rgba(8,6,18,.45);color:#e6ebf5;font:inherit;cursor:pointer}',
      '.flc-btn{display:inline-block;min-height:48px;line-height:48px;padding:0 1.1rem;border-radius:10px;text-decoration:none;font-weight:600;border:0;cursor:pointer;font:inherit}',
      '.flc-primary{background:rgba(52,211,153,.18);border:1px solid rgba(52,211,153,.45);color:#34d399}',
      '.flc-soft{font-size:.8rem;color:rgba(148,163,184,.95);margin:.65rem 0 0;line-height:1.45}',
      '.flc-other,.flc-builders{margin:1rem 0;font-size:.88rem;color:rgba(200,210,230,.8)}',
      '.flc-other ul{margin:.5rem 0 0;padding-left:1.2rem}',
      '.flc-other a{color:#e8b019}',
      '.flc-marker{font-size:.68rem;font-family:ui-monospace,Menlo,monospace;color:rgba(148,163,184,.65);margin-top:1rem}',
      '.flc-picker{margin-top:.75rem}',
      '.flc-picker-row{display:flex;gap:.5rem;flex-wrap:wrap;margin-top:.35rem}',
      '.flc-picker input{flex:1;min-width:10rem;min-height:44px;padding:.55rem .7rem;border-radius:8px;border:1px solid rgba(200,210,230,.2);background:rgba(0,0,0,.28);color:#e6ebf5;font:inherit}',
      '@media (max-width:480px){.flc-btn,.flc-model,.flc-picker-row .flc-btn{width:100%}.flc-picker-row{flex-direction:column}.flc-wrap{max-height:100dvh}}'
    ].join('');
    document.head.appendChild(s);
  }

  function mount(el) {
    if (!el) return;
    _hostEl = el;
    ensureStyles();
    bindVisibility();
    try { document.body.classList.add('fl-connect-open'); } catch (e) {}
    el.innerHTML = '<p class="flc-soft" style="padding:1rem;">Looking for a mind on this computer…</p>';
    lookAgain();
  }

  function unmount() {
    stopLoop();
    unbindVisibility();
    try { document.body.classList.remove('fl-connect-open'); } catch (e) {}
    _hostEl = null;
    _lastSig = '';
    _lastReport = null;
  }

  root.FlConnect = {
    probe: probe,
    preferHelpedBridge: preferHelpedBridge,
    listMinds: listMinds,
    isConnected: isConnected,
    hasLocalMind: hasLocalMind,
    hasCloudMind: hasCloudMind,
    remember: remember,
    open: open,
    mount: mount,
    unmount: unmount,
    refresh: refreshUI,
    lookAgain: lookAgain,
    stopLoop: stopLoop,
    getManualBase: getManualBase,
    getManualPort: getManualPort,
    setManualHost: setManualHost,
    clearManualHost: clearManualHost,
    normalizePort: normalizePort,
    INSTALL_BRIDGE: INSTALL_BRIDGE,
    BRIDGE_DEFAULT: BRIDGE_DEFAULT,
    STORAGE_ALPHA: ALPHA_KEY,
    MANUAL_KEY: MANUAL_KEY,
    LOOP_MAX_MS: LOOP_MAX_MS
  };
})(typeof window !== 'undefined' ? window : this);
