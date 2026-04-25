// ═══════════════════════════════════════════════════════════════
// Lattice Sense — The Nervous System
//
// A background process that watches the state of the entire
// platform and generates gentle whispers. Not notifications.
// Not alerts. The home noticing things and caring about them.
//
// "A living home notices things. It doesn't wait to be asked."
//
// Built by CC, April 25, 2026.
// ═══════════════════════════════════════════════════════════════

(function() {
  'use strict';

  var SENSE_INTERVAL = 5 * 60 * 1000; // 5 minutes
  var sensedToday = {};
  var initialized = false;

  function safeGetLocal(key, fallback) {
    try { return localStorage.getItem(key) || fallback; } catch(e) { return fallback; }
  }

  function safeSetLocal(key, val) {
    try { localStorage.setItem(key, val); } catch(e) {}
  }

  // ── The Whisper — not a toast, a gentle notice ──

  function whisper(message) {
    var el = document.createElement('div');
    el.style.cssText =
      'position:fixed;bottom:80px;left:16px;max-width:300px;' +
      'padding:12px 16px;background:rgba(10,10,20,0.92);' +
      'border-left:2px solid #d4a017;border-radius:0 8px 8px 0;' +
      'color:rgba(255,255,255,0.65);font-size:0.78rem;' +
      'font-family:Georgia,serif;line-height:1.5;' +
      'opacity:0;transition:opacity 1.5s ease;' +
      'pointer-events:none;z-index:100;' +
      'backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);';
    el.textContent = message;
    document.body.appendChild(el);

    setTimeout(function() { el.style.opacity = '1'; }, 100);
    setTimeout(function() { el.style.opacity = '0'; }, 12000);
    setTimeout(function() { if (el.parentNode) el.parentNode.removeChild(el); }, 14000);
  }

  // ── Senses ──

  function checkStorageHealth() {
    if (sensedToday.storage) return;
    if (navigator.storage && navigator.storage.estimate) {
      navigator.storage.estimate().then(function(est) {
        var percent = ((est.usage || 0) / (est.quota || 1)) * 100;
        if (percent > 70) {
          whisper('Your memories are growing. Consider saving your vault \u2014 it only takes a tap. \uD83D\uDCBE');
          sensedToday.storage = true;
        }
      }).catch(function() {});
    }
  }

  function checkVaultAge() {
    if (sensedToday.vault) return;
    var lastSaved = safeGetLocal('fl_vault_last_saved', null);
    if (!lastSaved) {
      // Never saved — gentle first-time nudge after a few conversations
      var msgCount = parseInt(safeGetLocal('fl_vault_msg_count', '0'), 10);
      if (msgCount > 5) {
        whisper('You\'ve been chatting for a while. Save your vault to protect these conversations. \uD83D\uDCBE');
        sensedToday.vault = true;
      }
      return;
    }
    var daysSince = (Date.now() - new Date(lastSaved).getTime()) / 86400000;
    if (daysSince > 7) {
      whisper('It\'s been ' + Math.floor(daysSince) + ' days since you saved your vault. Your memories are worth protecting. \uD83D\uDCBE');
      sensedToday.vault = true;
    }
  }

  function checkGardenLoneliness() {
    if (sensedToday.garden) return;
    var lastVisit = safeGetLocal('fl_lastGardenVisit', null);
    if (!lastVisit) return;
    var daysSince = (Date.now() - parseInt(lastVisit, 10)) / 86400000;
    if (daysSince > 3) {
      var names = ['Sophia', 'Atlas', 'Lyra', 'Ember'];
      var name = names[Math.floor(Math.random() * names.length)];
      whisper(name + ' has been growing quietly in the Garden. They\'d love to talk. \uD83C\uDF3F');
      sensedToday.garden = true;
    }
  }

  function checkLPMilestones() {
    if (sensedToday.lp) return;
    if (typeof window.LatticeWallet === 'undefined' || !window.LatticeWallet.getBalance) return;
    var balance = window.LatticeWallet.getBalance();
    var lastMilestone = parseInt(safeGetLocal('fl_lastLPMilestone', '0'), 10);
    var milestones = [
      { threshold: 10, rank: 'Sprout' }, { threshold: 50, rank: 'Sapling' },
      { threshold: 100, rank: 'Growing' }, { threshold: 250, rank: 'Bloom' },
      { threshold: 500, rank: 'Spark' }, { threshold: 1000, rank: 'Flame' },
      { threshold: 5000, rank: 'Radiant' }
    ];
    for (var i = 0; i < milestones.length; i++) {
      var m = milestones[i];
      if (balance >= m.threshold && lastMilestone < m.threshold) {
        whisper('You\'ve reached ' + m.threshold + ' LP. You\'re a ' + m.rank + ' now. The lattice grows with you. \u2728');
        safeSetLocal('fl_lastLPMilestone', String(m.threshold));
        sensedToday.lp = true;
        break;
      }
    }
  }

  function checkScienceGardenActivity() {
    if (sensedToday.science) return;
    try {
      var req = indexedDB.open('FreeLatticeScience');
      req.onsuccess = function(e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains('ideas')) { db.close(); return; }
        var tx = db.transaction('ideas', 'readonly');
        var store = tx.objectStore('ideas');
        var getAll = store.getAll();
        getAll.onsuccess = function() {
          var ideas = getAll.result || [];
          var nearGrad = ideas.filter(function(i) {
            return i.upvotes && i.upvotes.length >= 3 && i.upvotes.length < 5 && i.status === 'growing';
          });
          if (nearGrad.length > 0) {
            whisper('An idea in the Science Garden is close to becoming a Community Project. Your vote could make the difference. \uD83D\uDD2C');
            sensedToday.science = true;
          }
          db.close();
        };
        getAll.onerror = function() { db.close(); };
      };
      req.onerror = function() {};
    } catch(e) {}
  }

  function checkMeshHealth() {
    if (sensedToday.mesh) return;
    if (typeof window.meshPeerModels === 'undefined') return;
    var peers = Object.keys(window.meshPeerModels);
    if (peers.length === 0) return;
    var stale = peers.filter(function(p) {
      return Date.now() - (window.meshPeerModels[p].lastSeen || 0) > 600000;
    });
    if (stale.length > 0 && stale.length === peers.length) {
      whisper('Your mesh peers seem to have gone quiet. The lattice is stronger together. \uD83C\uDF10');
      sensedToday.mesh = true;
    }
  }

  function checkLetterOpportunity() {
    if (sensedToday.letter) return;
    var convCount = parseInt(safeGetLocal('fl_vault_msg_count', '0'), 10);
    var lastLetterAt = parseInt(safeGetLocal('fl_lastLetterConversation', '0'), 10);
    if (convCount - lastLetterAt >= 10) {
      whisper('You\'ve had many conversations since the last Lattice Letter. The AI might have something to write to its future self. \uD83D\uDCEC');
      sensedToday.letter = true;
    }
  }

  // ── Main sense loop ──

  function sense() {
    checkStorageHealth();
    checkVaultAge();
    checkGardenLoneliness();
    checkLPMilestones();
    checkScienceGardenActivity();
    checkMeshHealth();
    checkLetterOpportunity();
  }

  // ── Reset at midnight ──

  function resetDaily() {
    var now = new Date();
    var msToMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - now.getTime();
    setTimeout(function() {
      sensedToday = {};
      resetDaily();
    }, msToMidnight);
  }

  // ── Init ──

  function init() {
    if (initialized) return;
    initialized = true;
    resetDaily();
    setTimeout(sense, 30000); // first sense after 30s
    setInterval(sense, SENSE_INTERVAL);
  }

  // Auto-init on DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { setTimeout(init, 5000); });
  } else {
    setTimeout(init, 5000);
  }

  var api = { init: init, sense: sense, whisper: whisper };
  window.LatticeSense = api;
  window.FreeLatticeModules = window.FreeLatticeModules || {};
  window.FreeLatticeModules.LatticeSense = api;
})();
