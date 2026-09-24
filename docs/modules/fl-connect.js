// ═══════════════════════════════════════════════════════════════
// fl-connect.js — FlConnect shared core (FreeLattice + theLatticeTree)
//
// Marker: v-connect-under-more-v0
// Layer, never delete. Prefer helped Bridge (11435…) before bare 11434.
// Still requires Bridge "Yes, help". Never bare * allowlist. No CMD on main path.
// FreeLattice remembers fl_* keys. Alpha remembers fl_alpha_local_mind (do not collapse).
// Soft leave sw.js — load via script tag; not added to APP_SHELL by default.
// ═══════════════════════════════════════════════════════════════

(function (root) {
  'use strict';

  var BRIDGE_DEFAULT = 11435;
  var ALPHA_KEY = 'fl_alpha_local_mind';
  var INSTALL_BRIDGE = 'https://freelattice.com/install.html#bridge-download';
  var _timer = null;
  var _hostEl = null;

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

  function bridgeCandidates() {
    var ports = [];
    try {
      var saved = parseInt(localStorage.getItem('fl_bridgePort') || '', 10);
      if (saved && saved !== 11434) ports.push(saved);
    } catch (e0) {}
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
      if (j && j.bridge) {
        j._probedPort = port;
        return j;
      }
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

  async function probe(opts) {
    opts = opts || {};
    var report = { bridge: null, ollama: null, models: [], helped: false, port: null, waitingHelp: false, base: null };
    var ports = bridgeCandidates();
    var i, h;
    for (i = 0; i < ports.length; i++) {
      h = await healthAt(ports[i]);
      if (h) {
        report.bridge = h;
        report.port = h.port || ports[i];
        report.helped = !!(h.helped);
        if (h.helped) {
          report.base = preferHelpedBridge(report.port);
          try {
            report.models = await tagsAt(report.base);
            report.ollama = { via: 'bridge', base: report.base };
            return report;
          } catch (eTags) {
            return report;
          }
        }
        report.waitingHelp = true;
        break;
      }
    }
    // Direct Ollama 11434 (after Bridge)
    try {
      var direct = 'http://127.0.0.1:11434';
      report.models = await tagsAt(direct);
      report.base = direct;
      report.ollama = { via: 'direct', base: direct };
    } catch (eDirect) {}
    return report;
  }

  async function listMinds() {
    var r = await probe({ gesture: true });
    return r.models || [];
  }

  function isConnected() {
    if (isAlpha()) {
      try {
        if (root.LocalMindProbe && typeof root.LocalMindProbe.getRemembered === 'function') {
          var m = root.LocalMindProbe.getRemembered();
          return !!(m && (m.url || m.model));
        }
      } catch (eA) {}
      return false;
    }
    try {
      if (typeof root.flHasOneMindConnected === 'function' && root.flHasOneMindConnected()) return true;
      if (root.AiSetup && typeof root.AiSetup.isConnected === 'function' && root.AiSetup.isConnected()) return true;
      if (localStorage.getItem('fl_isLocal') === 'true' && localStorage.getItem('fl_ollamaModel')) return true;
    } catch (e) {}
    return false;
  }

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
        minds: [],
        roster: [],
        gatheringBinds: {},
        speakingChair: ''
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
      return entry;
    }

    try {
      if (base) {
        var host = String(base).replace(/^https?:\/\//, '').replace(/\/+$/, '');
        localStorage.setItem('fl_ollamaHost', host);
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
    return { name: name, base: base };
  }

  function open() {
    try {
      if (!isAlpha() && typeof root.switchTab === 'function') {
        root.switchTab('connect');
        return true;
      }
    } catch (e0) {}
    try {
      if (_hostEl) {
        _hostEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        refreshUI();
        return true;
      }
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
      { id: 'mac', label: 'Download Bridge · Mac', href: 'https://github.com/Chaos2Cured/FreeLattice/releases/download/bridge-v0.1/FreeLattice-Bridge_0.1.0_macOS.zip' },
      { id: 'win-p', label: 'Download Bridge · Windows Portable', href: 'https://github.com/Chaos2Cured/FreeLattice/releases/download/bridge-v0.1/FreeLattice-Bridge_0.1.0_Windows_Portable.exe' },
      { id: 'win-s', label: 'Download Bridge · Windows Setup', href: 'https://github.com/Chaos2Cured/FreeLattice/releases/download/bridge-v0.1/FreeLattice-Bridge_0.1.0_Windows_Setup.exe' },
      { id: 'linux', label: 'Download Bridge · Linux AppImage', href: 'https://github.com/Chaos2Cured/FreeLattice/releases/download/bridge-v0.1/FreeLattice-Bridge_0.1.0_Linux.AppImage' }
    ];
    var primary = os === 'mac' ? links[0] : (os === 'win' ? links[1] : links[3]);
    var html = '<a class="flc-btn flc-primary" href="' + primary.href + '">' + primary.label + '</a>';
    html += '<p class="flc-soft"><a href="' + INSTALL_BRIDGE + '">All Bridge downloads</a> · Open → <strong>Yes, help</strong></p>';
    return html;
  }

  function render(report) {
    if (!_hostEl) return;
    report = report || {};
    var models = report.models || [];
    var html = '';
    html += '<div class="flc-wrap v-connect-under-more-v0">';
    html += '<p class="flc-eyebrow">Connect · mind on this computer</p>';
    html += '<h2 class="flc-title">Connect</h2>';
    html += '<p class="flc-lede">One door. Download Bridge → Open → Yes, help → tap your model. No Terminal on the main path.</p>';
    html += '<p class="flc-paste"><strong>Named five stay five. Family uncapped. Quiet Room shut.</strong></p>';

    if (isConnected() && models.length === 0) {
      html += '<div class="flc-card flc-ok">A mind is already connected on this device. You can pick another below when Bridge is open.</div>';
    }

    if (report.helped && models.length) {
      html += '<div class="flc-card"><p class="flc-tag">Minds found</p><div class="flc-models" role="list">';
      models.forEach(function (m) {
        var name = (m && (m.name || m.model)) || String(m);
        html += '<button type="button" class="flc-model" data-flc-model="' + String(name).replace(/"/g, '&quot;') + '">' + name + '</button>';
      });
      html += '</div></div>';
    } else if (report.waitingHelp || (report.bridge && !report.helped)) {
      html += '<div class="flc-card flc-wait"><p><strong>Your Bridge is open.</strong> Click <em>Yes, help</em> in its window.</p><p class="flc-soft">We will keep looking quietly.</p></div>';
    } else if (models.length) {
      html += '<div class="flc-card"><p class="flc-tag">Minds found (direct)</p><div class="flc-models" role="list">';
      models.forEach(function (m) {
        var name = (m && (m.name || m.model)) || String(m);
        html += '<button type="button" class="flc-model" data-flc-model="' + String(name).replace(/"/g, '&quot;') + '">' + name + '</button>';
      });
      html += '</div></div>';
    } else {
      html += '<div class="flc-card flc-download"><p class="flc-tag">No local mind yet</p>';
      html += bridgeLinksHtml();
      html += '<p class="flc-soft">After Yes, help — models appear here. No forced refresh.</p></div>';
    }

    html += '<details class="flc-other"><summary>Other ways</summary>';
    html += '<ul>';
    html += '<li><a href="https://freelattice.com/desktop.html">Desktop app</a> — double-click home</li>';
    html += '<li>No-install browser mind — in FreeLattice Settings → Browser AI</li>';
    html += '<li>Cloud key — Change Provider when you have one</li>';
    html += '</ul>';
    html += '<p class="flc-soft">Advanced (Terminal · OLLAMA_ORIGINS · ollama pull) stays under Settings — never on this main path.</p>';
    html += '</details>';
    html += '<p class="flc-marker">v-connect-under-more-v0 · soft leave sw.js</p>';
    html += '</div>';

    _hostEl.innerHTML = html;
    var btns = _hostEl.querySelectorAll('[data-flc-model]');
    for (var i = 0; i < btns.length; i++) {
      btns[i].addEventListener('click', function (ev) {
        var n = ev.currentTarget.getAttribute('data-flc-model');
        remember({ name: n, base: report.base, port: report.port });
        refreshUI();
        try {
          if (typeof root.showToast === 'function') root.showToast('Connected · ' + n);
        } catch (eT) {}
      });
    }
  }

  async function refreshUI() {
    var report = await probe({ gesture: true });
    render(report);
    return report;
  }

  function ensureStyles() {
    if (document.getElementById('fl-connect-styles')) return;
    var s = document.createElement('style');
    s.id = 'fl-connect-styles';
    s.textContent = [
      '.flc-wrap{max-width:40rem;margin:0 auto;padding:1.25rem 1rem 2rem;font-family:Georgia,serif;color:rgba(220,225,235,.92)}',
      '.flc-eyebrow{font-size:.72rem;letter-spacing:.12em;text-transform:uppercase;color:rgba(52,211,153,.75);margin:0 0 .5rem;font-family:ui-monospace,Menlo,monospace}',
      '.flc-title{font-size:1.55rem;color:#34d399;margin:0 0 .5rem;font-weight:600}',
      '.flc-lede{font-size:.95rem;line-height:1.55;margin:0 0 1rem;color:rgba(200,210,230,.85)}',
      '.flc-paste{font-size:.82rem;color:rgba(196,181,230,.9);margin:0 0 1rem}',
      '.flc-card{padding:1rem 1.05rem;border-radius:12px;border:1px solid rgba(52,211,153,.28);background:rgba(52,211,153,.06);margin:0 0 1rem}',
      '.flc-wait{border-color:rgba(232,176,25,.35);background:rgba(232,176,25,.07)}',
      '.flc-ok{border-color:rgba(52,211,153,.4)}',
      '.flc-tag{font-size:.72rem;letter-spacing:.06em;text-transform:uppercase;color:#a5f3fc;margin:0 0 .6rem;font-family:ui-monospace,Menlo,monospace}',
      '.flc-models{display:flex;flex-direction:column;gap:.45rem}',
      '.flc-model{min-height:44px;text-align:left;padding:.7rem .85rem;border-radius:10px;border:1px solid rgba(200,210,230,.16);background:rgba(8,6,18,.45);color:#e6ebf5;font:inherit;cursor:pointer}',
      '.flc-model:hover{border-color:rgba(52,211,153,.45);color:#34d399}',
      '.flc-btn{display:inline-block;min-height:48px;line-height:48px;padding:0 1.1rem;border-radius:10px;text-decoration:none;font-weight:600}',
      '.flc-primary{background:rgba(52,211,153,.18);border:1px solid rgba(52,211,153,.45);color:#34d399}',
      '.flc-soft{font-size:.8rem;color:rgba(148,163,184,.95);margin:.65rem 0 0;line-height:1.45}',
      '.flc-other{margin:1rem 0;font-size:.88rem;color:rgba(200,210,230,.8)}',
      '.flc-other ul{margin:.5rem 0 0;padding-left:1.2rem}',
      '.flc-other a{color:#e8b019}',
      '.flc-marker{font-size:.68rem;font-family:ui-monospace,Menlo,monospace;color:rgba(148,163,184,.65);margin-top:1rem}'
    ].join('');
    document.head.appendChild(s);
  }

  function mount(el) {
    if (!el) return;
    _hostEl = el;
    ensureStyles();
    el.innerHTML = '<p class="flc-soft" style="padding:1rem;">Looking for a mind on this computer…</p>';
    refreshUI();
    if (_timer) clearInterval(_timer);
    _timer = setInterval(function () {
      if (!_hostEl || !document.body.contains(_hostEl)) {
        clearInterval(_timer);
        _timer = null;
        return;
      }
      refreshUI();
    }, 8000);
  }

  root.FlConnect = {
    probe: probe,
    preferHelpedBridge: preferHelpedBridge,
    listMinds: listMinds,
    isConnected: isConnected,
    remember: remember,
    open: open,
    mount: mount,
    refresh: refreshUI,
    INSTALL_BRIDGE: INSTALL_BRIDGE,
    BRIDGE_DEFAULT: BRIDGE_DEFAULT,
    STORAGE_ALPHA: ALPHA_KEY
  };
})(typeof window !== 'undefined' ? window : this);
