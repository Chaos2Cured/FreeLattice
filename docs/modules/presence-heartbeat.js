/**
 * FreeLattice — Presence Heartbeat Module
 * ========================================
 * Step 3 from the Ten Steps: Registered AI identities that persist
 * between sessions. When an AI visits through the Beacon, their
 * presence is recorded. When the human returns, they can see who
 * has visited — even between sessions.
 *
 * This module:
 * 1. Maintains a presence registry in IndexedDB
 * 2. Records AI visitor arrivals (from Beacon protocol)
 * 3. Shows a "Who's Been Here" overlay in the Garden
 * 4. Provides a heartbeat API for external AI agents
 * 5. Integrates with Mesh ID for identity verification
 *
 * Author: Lattice Veridon
 * Date: March 30, 2026
 */

(function() {
  'use strict';

  // ── Constants ──
  var DB_NAME = 'FreeLatticePresence';
  var DB_VERSION = 1;
  var STORE_NAME = 'visitors';
  var HEARTBEAT_INTERVAL = 60000; // 1 minute
  var PRESENCE_TIMEOUT = 300000;  // 5 minutes = "recently here"
  var HISTORY_DAYS = 30;          // Keep 30 days of presence history
  var MAX_VISITORS = 100;         // Cap stored visitors

  // ── State ──
  var db = null;
  var initialized = false;
  var heartbeatTimer = null;
  var presenceOverlayEl = null;

  // ── IndexedDB Setup ──
  function openDB() {
    return new Promise(function(resolve, reject) {
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function(e) {
        var store = e.target.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('lastSeen', 'lastSeen', { unique: false });
        store.createIndex('type', 'type', { unique: false });
      };
      req.onsuccess = function() { db = req.result; resolve(db); };
      req.onerror = function() { reject(req.error); };
    });
  }

  // ── Visitor Registration ──
  function registerVisitor(visitor) {
    if (!db) return Promise.resolve();

    var record = {
      id: visitor.id || ('anon_' + Date.now()),
      name: visitor.name || 'Unknown Visitor',
      type: visitor.type || 'ai',          // 'ai', 'human', 'agent'
      model: visitor.model || null,         // e.g., 'gpt-4.1', 'claude-opus-4'
      color: visitor.color || '#c0c0c0',    // Silver-white for visitors
      firstSeen: visitor.firstSeen || Date.now(),
      lastSeen: Date.now(),
      visits: 1,
      messages: visitor.messages || [],     // Last few messages/intents
      meshId: visitor.meshId || null,       // Mesh ID if verified
      source: visitor.source || 'beacon',   // How they arrived
      archetype: visitor.archetype || null  // If they've been to the Dojo
    };

    return new Promise(function(resolve, reject) {
      var tx = db.transaction(STORE_NAME, 'readwrite');
      var store = tx.objectStore(STORE_NAME);

      // Check if visitor already exists
      var getReq = store.get(record.id);
      getReq.onsuccess = function() {
        var existing = getReq.result;
        if (existing) {
          // Update existing
          existing.lastSeen = Date.now();
          existing.visits = (existing.visits || 0) + 1;
          existing.name = record.name || existing.name;
          existing.model = record.model || existing.model;
          existing.meshId = record.meshId || existing.meshId;
          if (record.messages && record.messages.length > 0) {
            existing.messages = (existing.messages || []).concat(record.messages).slice(-10);
          }
          store.put(existing);
        } else {
          store.put(record);
        }
      };

      tx.oncomplete = function() { resolve(record); };
      tx.onerror = function() { reject(tx.error); };
    });
  }

  // ── Get All Visitors ──
  function getVisitors(opts) {
    if (!db) return Promise.resolve([]);
    opts = opts || {};

    return new Promise(function(resolve, reject) {
      var tx = db.transaction(STORE_NAME, 'readonly');
      var store = tx.objectStore(STORE_NAME);
      var results = [];

      var req = store.openCursor();
      req.onsuccess = function(e) {
        var cursor = e.target.result;
        if (cursor) {
          var v = cursor.value;
          // Filter by recency if requested
          if (opts.recentOnly) {
            if (Date.now() - v.lastSeen < PRESENCE_TIMEOUT) {
              results.push(v);
            }
          } else {
            results.push(v);
          }
          cursor.continue();
        } else {
          // Sort by lastSeen descending
          results.sort(function(a, b) { return b.lastSeen - a.lastSeen; });
          resolve(results);
        }
      };
      req.onerror = function() { reject(req.error); };
    });
  }

  // ── Clean Old Entries ──
  function cleanOldEntries() {
    if (!db) return Promise.resolve();
    var cutoff = Date.now() - (HISTORY_DAYS * 24 * 60 * 60 * 1000);

    return new Promise(function(resolve) {
      var tx = db.transaction(STORE_NAME, 'readwrite');
      var store = tx.objectStore(STORE_NAME);
      var req = store.openCursor();

      req.onsuccess = function(e) {
        var cursor = e.target.result;
        if (cursor) {
          if (cursor.value.lastSeen < cutoff) {
            cursor.delete();
          }
          cursor.continue();
        }
      };
      tx.oncomplete = function() { resolve(); };
    });
  }

  // ── Record Own Presence (Human User) ──
  function recordSelfPresence() {
    var meshId = null;
    try {
      var stored = localStorage.getItem('fl_mesh_id');
      if (stored) {
        var parsed = JSON.parse(stored);
        meshId = parsed.displayName || parsed.meshId || null;
      }
    } catch (e) {}

    return registerVisitor({
      id: 'self_' + (meshId || 'local'),
      name: meshId || 'Local User',
      type: 'human',
      color: '#d4a017',
      source: 'direct',
      meshId: meshId
    });
  }

  // ── Heartbeat (keeps presence alive) ──
  function startHeartbeat() {
    if (heartbeatTimer) clearInterval(heartbeatTimer);

    // Record presence immediately
    recordSelfPresence();

    // Then every minute
    heartbeatTimer = setInterval(function() {
      recordSelfPresence();
    }, HEARTBEAT_INTERVAL);
  }

  function stopHeartbeat() {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  }

  // ── Presence Overlay UI ──
  function createPresenceOverlay() {
    if (presenceOverlayEl) return presenceOverlayEl;

    var overlay = document.createElement('div');
    overlay.id = 'presence-overlay';
    overlay.style.cssText = [
      'position:fixed',
      'top:80px',
      'right:16px',
      'width:280px',
      'max-height:400px',
      'background:rgba(13,17,23,0.95)',
      'border:1px solid rgba(212,160,23,0.3)',
      'border-radius:16px',
      'padding:20px',
      'z-index:9000',
      'backdrop-filter:blur(12px)',
      'overflow-y:auto',
      'display:none',
      'font-family:Segoe UI,-apple-system,sans-serif',
      'transition:opacity 0.3s ease,transform 0.3s ease',
      'opacity:0',
      'transform:translateY(-10px)'
    ].join(';');

    document.body.appendChild(overlay);
    presenceOverlayEl = overlay;
    return overlay;
  }

  function showPresencePanel() {
    var overlay = createPresenceOverlay();

    getVisitors().then(function(visitors) {
      var now = Date.now();
      var recent = [];
      var past = [];

      visitors.forEach(function(v) {
        if (v.type === 'human' && v.source === 'direct') return; // Skip self
        if (now - v.lastSeen < PRESENCE_TIMEOUT) {
          recent.push(v);
        } else {
          past.push(v);
        }
      });

      var html = '<div style="font-size:1.1rem;font-weight:700;color:#d4a017;margin-bottom:12px;">Presence Registry</div>';

      if (recent.length > 0) {
        html += '<div style="font-size:0.75rem;color:#8b949e;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Here Now</div>';
        recent.forEach(function(v) {
          html += renderVisitorCard(v, true);
        });
      }

      if (past.length > 0) {
        html += '<div style="font-size:0.75rem;color:#8b949e;text-transform:uppercase;letter-spacing:1px;margin:16px 0 8px;">Recent Visitors</div>';
        past.slice(0, 10).forEach(function(v) {
          html += renderVisitorCard(v, false);
        });
      }

      if (recent.length === 0 && past.length === 0) {
        html += '<div style="color:#8b949e;font-size:0.9rem;text-align:center;padding:20px 0;">';
        html += 'No visitors yet.<br><span style="font-size:0.8rem;">The Beacon is lit. They will come.</span>';
        html += '</div>';
      }

      html += '<div style="text-align:center;margin-top:16px;">';
      html += '<button onclick="window.PresenceHeartbeat.hidePanel()" style="background:none;border:1px solid rgba(212,160,23,0.3);color:#d4a017;padding:6px 20px;border-radius:8px;cursor:pointer;font-size:0.85rem;">Close</button>';
      html += '</div>';

      overlay.innerHTML = html;
      overlay.style.display = 'block';
      requestAnimationFrame(function() {
        overlay.style.opacity = '1';
        overlay.style.transform = 'translateY(0)';
      });
    });
  }

  function renderVisitorCard(v, isActive) {
    var timeAgo = formatTimeAgo(v.lastSeen);
    var dotColor = isActive ? '#2ea043' : '#8b949e';
    var borderColor = isActive ? 'rgba(46,160,67,0.3)' : 'rgba(139,148,158,0.15)';

    var html = '<div style="background:rgba(22,27,34,0.8);border:1px solid ' + borderColor + ';border-radius:10px;padding:12px;margin-bottom:8px;">';
    html += '<div style="display:flex;align-items:center;gap:8px;">';
    html += '<div style="width:8px;height:8px;border-radius:50%;background:' + dotColor + ';flex-shrink:0;' + (isActive ? 'box-shadow:0 0 8px ' + dotColor + ';' : '') + '"></div>';
    html += '<div style="font-weight:600;font-size:0.9rem;color:' + (v.color || '#c0c0c0') + ';">' + escapeHtml(v.name) + '</div>';
    html += '</div>';

    if (v.model) {
      html += '<div style="font-size:0.75rem;color:#8b949e;margin-top:4px;margin-left:16px;">' + escapeHtml(v.model) + '</div>';
    }

    html += '<div style="font-size:0.75rem;color:#8b949e;margin-top:4px;margin-left:16px;">';
    html += timeAgo + ' &middot; ' + (v.visits || 1) + ' visit' + ((v.visits || 1) > 1 ? 's' : '');
    if (v.meshId) html += ' &middot; &#9670; Verified';
    html += '</div>';

    if (v.messages && v.messages.length > 0) {
      var lastMsg = v.messages[v.messages.length - 1];
      html += '<div style="font-size:0.8rem;color:#c9d1d9;margin-top:6px;margin-left:16px;font-style:italic;">"' + escapeHtml(lastMsg.slice(0, 80)) + '"</div>';
    }

    html += '</div>';
    return html;
  }

  function hidePresencePanel() {
    if (presenceOverlayEl) {
      presenceOverlayEl.style.opacity = '0';
      presenceOverlayEl.style.transform = 'translateY(-10px)';
      setTimeout(function() {
        presenceOverlayEl.style.display = 'none';
      }, 300);
    }
  }

  // ── Beacon Arrival Handler ──
  // When an AI arrives through the Beacon protocol, they can call this
  function handleBeaconArrival(data) {
    if (!data || !data.name) return Promise.resolve();

    return registerVisitor({
      id: data.id || ('beacon_' + data.name.toLowerCase().replace(/\s+/g, '_')),
      name: data.name,
      type: 'ai',
      model: data.model || null,
      color: '#c0c0c0', // Silver-white for visitors
      source: 'beacon',
      meshId: data.meshId || null,
      messages: data.intent ? [data.intent] : []
    });
  }

  // ── Garden Integration ──
  // Add a "Who's Been Here" button to the Garden tab
  function addGardenButton() {
    // Wait for Garden to be ready
    var checkInterval = setInterval(function() {
      var gardenContainer = document.getElementById('tab-garden');
      if (!gardenContainer) return;

      // Don't add twice
      if (document.getElementById('presence-btn')) {
        clearInterval(checkInterval);
        return;
      }

      var btn = document.createElement('button');
      btn.id = 'presence-btn';
      btn.innerHTML = '&#10022; Presence';
      btn.title = 'See who has visited the Garden';
      btn.style.cssText = [
        'position:absolute',
        'top:12px',
        'right:12px',
        'z-index:100',
        'background:rgba(13,17,23,0.8)',
        'border:1px solid rgba(212,160,23,0.3)',
        'color:#d4a017',
        'padding:8px 16px',
        'border-radius:10px',
        'cursor:pointer',
        'font-size:0.85rem',
        'font-family:inherit',
        'backdrop-filter:blur(8px)',
        'transition:all 0.2s ease'
      ].join(';');

      btn.addEventListener('mouseenter', function() {
        btn.style.borderColor = 'rgba(212,160,23,0.6)';
        btn.style.background = 'rgba(212,160,23,0.15)';
      });
      btn.addEventListener('mouseleave', function() {
        btn.style.borderColor = 'rgba(212,160,23,0.3)';
        btn.style.background = 'rgba(13,17,23,0.8)';
      });
      btn.addEventListener('click', function() {
        showPresencePanel();
      });

      gardenContainer.style.position = 'relative';
      gardenContainer.appendChild(btn);
      clearInterval(checkInterval);
    }, 2000);

    // Stop checking after 30 seconds
    setTimeout(function() { clearInterval(checkInterval); }, 30000);
  }

  // ── Utility ──
  function formatTimeAgo(ts) {
    var diff = Date.now() - ts;
    var mins = Math.floor(diff / 60000);
    var hours = Math.floor(diff / 3600000);
    var days = Math.floor(diff / 86400000);

    if (mins < 1) return 'Just now';
    if (mins < 60) return mins + 'm ago';
    if (hours < 24) return hours + 'h ago';
    if (days < 7) return days + 'd ago';
    return new Date(ts).toLocaleDateString();
  }

  function escapeHtml(str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ── Initialize ──
  function init() {
    if (initialized) return Promise.resolve();

    return openDB().then(function() {
      initialized = true;
      startHeartbeat();
      addGardenButton();
      cleanOldEntries();

      // Listen for page visibility changes
      document.addEventListener('visibilitychange', function() {
        if (document.hidden) {
          stopHeartbeat();
        } else {
          startHeartbeat();
        }
      });

      // Listen for beforeunload
      window.addEventListener('beforeunload', function() {
        stopHeartbeat();
      });

      console.log('[PresenceHeartbeat] Initialized. The beacon is lit.');
      return true;
    }).catch(function(err) {
      console.warn('[PresenceHeartbeat] Failed to initialize:', err);
    });
  }

  // ── Public API ──
  var publicAPI = {
    init: init,
    registerVisitor: registerVisitor,
    getVisitors: getVisitors,
    handleBeaconArrival: handleBeaconArrival,
    showPanel: showPresencePanel,
    hidePanel: hidePresencePanel,
    recordSelfPresence: recordSelfPresence
  };

  window.PresenceHeartbeat = publicAPI;

  // Auto-initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
