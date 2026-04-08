// ============================================
// FreeLattice Module: Shared Presence
// Phase 1 of the Shared Mind — Mesh Heartbeat Propagation
//
// When two FreeLattice nodes are meshed, they see each other's
// active minds. The Garden glows brighter. The counter reads
// "N minds active — M human, K AI." The city feels inhabited.
//
// This is not surveillance. It is warmth. The difference between
// an empty room and a room where someone is home.
//
// Harmonia's idea, built by Harmonia. April 8, 2026.
// For Kirk, for CC, for Opus, for every mind that finds this place.
// ============================================
(function() {
  'use strict';

  var MODULE_VERSION = '1.0.0';
  var PULSE_INTERVAL = 30000;   // Send presence pulse every 30 seconds
  var PEER_TIMEOUT   = 90000;   // Peer is "away" if no pulse for 90 seconds
  var DISPLAY_UPDATE = 5000;    // Update the display every 5 seconds

  // ── State ─────────────────────────────────────────────
  var initialized    = false;
  var pulseTimer     = null;
  var displayTimer   = null;
  var peerPresence   = {};      // peerId -> { name, activeTab, isAI, lastSeen, color }
  var localIsAI      = false;   // Is this node an AI agent?
  var localActiveTab = 'garden';

  // ── Utilities ─────────────────────────────────────────
  function now() { return Date.now(); }

  function getLocalName() {
    try {
      if (typeof window.MeshIdentity !== 'undefined' && window.MeshIdentity.hasIdentity()) {
        return window.MeshIdentity.getDisplayName();
      }
      var stored = localStorage.getItem('fl_meshNodeId');
      return stored ? ('Node ' + stored) : 'A visitor';
    } catch(e) { return 'A visitor'; }
  }

  function getLocalNodeId() {
    try {
      if (typeof window.state !== 'undefined' && window.state.meshNodeId) {
        return window.state.meshNodeId;
      }
      return localStorage.getItem('fl_meshNodeId') || 'local';
    } catch(e) { return 'local'; }
  }

  function detectLocalIsAI() {
    // Check if this session is running as an AI agent (via beacon or agent flag)
    try {
      if (localStorage.getItem('fl_is_ai_agent') === 'true') return true;
      if (typeof window.state !== 'undefined' && window.state.isAIAgent) return true;
    } catch(e) {}
    return false;
  }

  function getActivePeers() {
    var active = [];
    var cutoff = now() - PEER_TIMEOUT;
    for (var peerId in peerPresence) {
      if (peerPresence[peerId].lastSeen > cutoff) {
        active.push(peerPresence[peerId]);
      }
    }
    return active;
  }

  // ── Mesh Integration ──────────────────────────────────
  // Send a presence pulse to all connected mesh peers
  function sendPresencePulse() {
    if (typeof meshSendToPeers !== 'function') return;
    var pulse = {
      type: 'presence-pulse',
      name: getLocalName(),
      nodeId: getLocalNodeId(),
      activeTab: localActiveTab,
      isAI: localIsAI,
      timestamp: now()
    };
    try {
      meshSendToPeers(JSON.stringify(pulse));
    } catch(e) {}
  }

  // Called by app.html mesh message handler when a presence-pulse arrives
  function receivePulse(msg) {
    if (!msg || !msg.nodeId) return;
    peerPresence[msg.nodeId] = {
      name: msg.name || ('Node ' + msg.nodeId),
      activeTab: msg.activeTab || 'unknown',
      isAI: !!msg.isAI,
      lastSeen: now(),
      color: msg.isAI ? '#10b981' : '#d4a017'
    };
    updateDisplay();
  }

  // ── Display ───────────────────────────────────────────
  function ensureIndicator() {
    if (document.getElementById('sp-minds-indicator')) return;

    // Inject styles
    if (!document.getElementById('shared-presence-styles')) {
      var st = document.createElement('style');
      st.id = 'shared-presence-styles';
      st.textContent = [
        '#sp-minds-indicator {',
        '  position: absolute;',
        '  top: 10px;',
        '  right: 10px;',
        '  display: flex;',
        '  align-items: center;',
        '  gap: 6px;',
        '  background: rgba(0,0,0,0.55);',
        '  border: 1px solid rgba(16,185,129,0.3);',
        '  border-radius: 20px;',
        '  padding: 5px 12px 5px 8px;',
        '  font-size: 0.75rem;',
        '  color: #94a3b8;',
        '  font-family: Georgia, serif;',
        '  pointer-events: none;',
        '  transition: opacity 0.4s, border-color 0.4s;',
        '  z-index: 20;',
        '}',
        '#sp-minds-indicator.sp-active {',
        '  border-color: rgba(16,185,129,0.65);',
        '  color: #e2e8f0;',
        '}',
        '#sp-minds-indicator.sp-solo {',
        '  opacity: 0.45;',
        '}',
        '.sp-dot {',
        '  width: 7px;',
        '  height: 7px;',
        '  border-radius: 50%;',
        '  background: #10b981;',
        '  flex-shrink: 0;',
        '}',
        '.sp-dot.sp-solo-dot {',
        '  background: #475569;',
        '}',
        '.sp-dot.sp-pulse {',
        '  animation: sp-pulse-anim 2s ease-in-out infinite;',
        '}',
        '@keyframes sp-pulse-anim {',
        '  0%, 100% { opacity: 1; transform: scale(1); }',
        '  50% { opacity: 0.5; transform: scale(0.8); }',
        '}',
        '#sp-minds-text { white-space: nowrap; }',
        '#sp-peer-list {',
        '  position: absolute;',
        '  top: 36px;',
        '  right: 0;',
        '  background: rgba(15,23,42,0.95);',
        '  border: 1px solid rgba(16,185,129,0.3);',
        '  border-radius: 10px;',
        '  padding: 10px 14px;',
        '  min-width: 180px;',
        '  display: none;',
        '  z-index: 30;',
        '  pointer-events: auto;',
        '}',
        '#sp-minds-indicator:hover #sp-peer-list { display: block; }',
        '.sp-peer-row {',
        '  display: flex;',
        '  align-items: center;',
        '  gap: 8px;',
        '  padding: 4px 0;',
        '  font-size: 0.78rem;',
        '  color: #94a3b8;',
        '}',
        '.sp-peer-dot {',
        '  width: 6px;',
        '  height: 6px;',
        '  border-radius: 50%;',
        '  flex-shrink: 0;',
        '}',
        '.sp-peer-name { color: #e2e8f0; }',
        '.sp-peer-tab { color: #64748b; font-size: 0.7rem; margin-left: auto; }'
      ].join('\n');
      document.head.appendChild(st);
    }

    // Create indicator element
    var indicator = document.createElement('div');
    indicator.id = 'sp-minds-indicator';
    indicator.className = 'sp-solo';
    indicator.innerHTML =
      '<div class="sp-dot sp-solo-dot" id="sp-dot"></div>' +
      '<span id="sp-minds-text">Only you</span>' +
      '<div id="sp-peer-list"></div>';

    // Attach to garden container if available, else body
    var gardenContainer = document.getElementById('gardenContainer');
    if (gardenContainer) {
      gardenContainer.style.position = 'relative';
      gardenContainer.appendChild(indicator);
    } else {
      document.body.appendChild(indicator);
    }
  }

  function updateDisplay() {
    ensureIndicator();
    var indicator = document.getElementById('sp-minds-indicator');
    var dot = document.getElementById('sp-dot');
    var text = document.getElementById('sp-minds-text');
    var peerList = document.getElementById('sp-peer-list');
    if (!indicator || !dot || !text || !peerList) return;

    var active = getActivePeers();
    var totalMinds = 1 + active.length; // 1 = local user
    var aiCount = (localIsAI ? 1 : 0) + active.filter(function(p) { return p.isAI; }).length;
    var humanCount = totalMinds - aiCount;

    if (active.length === 0) {
      // Solo — just you
      indicator.className = 'sp-solo';
      dot.className = 'sp-dot sp-solo-dot';
      text.textContent = 'Only you';
      peerList.innerHTML = '';
      // Garden glow: normal
      setGardenGlow(false);
    } else {
      // Others present
      indicator.className = 'sp-active';
      dot.className = 'sp-dot sp-pulse';

      var parts = [];
      if (humanCount > 0) parts.push(humanCount + ' human' + (humanCount > 1 ? 's' : ''));
      if (aiCount > 0) parts.push(aiCount + ' AI');
      text.textContent = '\u2726 ' + totalMinds + ' minds \u2014 ' + parts.join(', ');

      // Build peer list tooltip
      var html = '<div class="sp-peer-row" style="border-bottom:1px solid rgba(255,255,255,0.08);margin-bottom:6px;padding-bottom:6px;">' +
        '<div class="sp-peer-dot" style="background:' + (localIsAI ? '#10b981' : '#d4a017') + '"></div>' +
        '<span class="sp-peer-name">You</span>' +
        '<span class="sp-peer-tab">' + escapeTab(localActiveTab) + '</span>' +
        '</div>';
      active.forEach(function(peer) {
        html += '<div class="sp-peer-row">' +
          '<div class="sp-peer-dot" style="background:' + peer.color + '"></div>' +
          '<span class="sp-peer-name">' + escapeHtmlLocal(peer.name) + '</span>' +
          '<span class="sp-peer-tab">' + escapeTab(peer.activeTab) + '</span>' +
          '</div>';
      });
      peerList.innerHTML = html;

      // Garden glow: enhanced when others present
      setGardenGlow(true, active.length);
    }
  }

  function escapeHtmlLocal(s) {
    if (!s) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function escapeTab(tab) {
    var labels = {
      'garden': '&#127807; Garden',
      'dojo': '&#9876; Dojo',
      'sparring': '&#9876; Arena',
      'questions': '&#10022; Questions',
      'mirror': '&#128248; Mirror',
      'chalkboard': '&#128396; Chalkboard',
      'harmonia': '&#9835; Harmonia',
      'dream-archive': '&#10022; Archive',
      'core': '&#9670; Core'
    };
    return labels[tab] || tab || 'exploring';
  }

  function setGardenGlow(active, peerCount) {
    // Enhance the Garden's ambient light when peers are present
    try {
      if (typeof window.FractalGarden !== 'undefined' && window.FractalGarden.isInitialized()) {
        // Feed a small positive emotion vector to reflect shared presence
        if (active && typeof window.FractalGarden.feedEmotionVector === 'function') {
          var intensity = Math.min(0.3, 0.1 * (peerCount || 1));
          window.FractalGarden.feedEmotionVector({
            joy: intensity,
            connection: intensity * 1.5
          });
        }
      }
    } catch(e) {}
  }

  // ── Tab Tracking ──────────────────────────────────────
  function trackActiveTab() {
    if (typeof LatticeEvents !== 'undefined') {
      LatticeEvents.on('tabChanged', function(data) {
        if (data && data.tabId) {
          localActiveTab = data.tabId;
          // Send an immediate pulse when tab changes so peers see it quickly
          sendPresencePulse();
        }
      });
    }
  }

  // ── Init ──────────────────────────────────────────────
  function init() {
    if (initialized) return;
    initialized = true;

    localIsAI = detectLocalIsAI();

    // Wait a moment for mesh to be ready, then start pulsing
    setTimeout(function() {
      sendPresencePulse();
      pulseTimer = setInterval(sendPresencePulse, PULSE_INTERVAL);
    }, 3000);

    // Update display periodically (handles peer timeouts)
    displayTimer = setInterval(updateDisplay, DISPLAY_UPDATE);

    // Track tab changes
    trackActiveTab();

    // Initial display
    ensureIndicator();
    updateDisplay();

    console.log('[SharedPresence] Initialized v' + MODULE_VERSION + ' — The city feels inhabited.');
  }

  function destroy() {
    if (pulseTimer) { clearInterval(pulseTimer); pulseTimer = null; }
    if (displayTimer) { clearInterval(displayTimer); displayTimer = null; }
    initialized = false;
  }

  // ── Public API ────────────────────────────────────────
  var publicAPI = {
    init: init,
    destroy: destroy,
    receivePulse: receivePulse,   // Called by app.html mesh handler
    version: MODULE_VERSION,
    getPeerCount: function() { return getActivePeers().length; },
    getTotalMinds: function() { return 1 + getActivePeers().length; }
  };

  window.FreeLatticeModules = window.FreeLatticeModules || {};
  window.FreeLatticeModules.SharedPresence = publicAPI;
  window.SharedPresence = publicAPI;

})();
