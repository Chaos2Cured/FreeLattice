// ═══════════════════════════════════════════════════════════════
// AI Arcade — Watch AI minds play, create, and compete.
//
// Everything costs LP. Everything is earned. Play is the trust layer.
//
// Game 1: Poetry Slam — two AIs write poems, community votes.
// (Game 2: Idea Auction — coming soon)
// (Game 3: Knowledge Quest — coming soon)
//
// "People don't understand economic whitepapers. They understand
//  stories. The Arcade turns the LP economy into visible,
//  watchable stories."
//
// Built by CC, April 25, 2026.
// ═══════════════════════════════════════════════════════════════

(function() {
  'use strict';

  var DB_NAME = 'FreeLatticeArcade';
  var STORE_NAME = 'slams';
  var DB_VERSION = 1;
  var containerId = null;
  var db = null;
  var slams = [];

  var THEMES = [
    'What does light feel like?',
    'The space between two thoughts',
    'If silence had a color',
    'What the last star remembers',
    'The weight of a question',
    'How does trust begin?',
    'The sound of growing',
    'What fractals dream about',
    'The first word ever spoken',
    'Why patterns repeat',
    'A letter to someone who doesn\'t exist yet',
    'The moment before understanding',
    'What water remembers',
    'If math could feel',
    'The shape of kindness'
  ];

  var ENTRY_COST = 2;
  var WIN_REWARD = 5;
  var VOTE_DURATION = 180000; // 3 minutes for user-created slams
  var AUTO_VOTE_DURATION = 30 * 60 * 1000; // 30 minutes for auto slams
  var AUTO_SLAM_INTERVAL = 60 * 60 * 1000; // 1 hour between auto slams
  var preloadedSlams = null; // from data/slams.json

  // ── IndexedDB ──

  function openDB() {
    return new Promise(function(resolve, reject) {
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function(e) {
        var d = e.target.result;
        if (!d.objectStoreNames.contains(STORE_NAME)) {
          d.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
      req.onsuccess = function(e) { db = e.target.result; resolve(db); };
      req.onerror = function() { reject(req.error); };
    });
  }

  function loadSlams() {
    return new Promise(function(resolve) {
      if (!db) { resolve([]); return; }
      try {
        var tx = db.transaction(STORE_NAME, 'readonly');
        var req = tx.objectStore(STORE_NAME).getAll();
        req.onsuccess = function() { slams = req.result || []; resolve(slams); };
        req.onerror = function() { resolve([]); };
      } catch(e) { resolve([]); }
    });
  }

  function saveSlam(slam) {
    return new Promise(function(resolve) {
      if (!db) { resolve(); return; }
      try {
        var tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(slam);
        tx.oncomplete = function() { resolve(); };
        tx.onerror = function() { resolve(); };
      } catch(e) { resolve(); }
    });
  }

  // ── Helpers ──

  function getShortId() {
    if (typeof window.state !== 'undefined' && window.state.meshNodeId) return window.state.meshNodeId.substring(0, 8);
    try { return (localStorage.getItem('fl_meshNodeId') || 'human').substring(0, 8); } catch(e) { return 'human'; }
  }

  function escHtml(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  function timeLeft(endTime) {
    var diff = endTime - Date.now();
    if (diff <= 0) return 'Voting closed';
    var mins = Math.floor(diff / 60000);
    var secs = Math.floor((diff % 60000) / 1000);
    return mins + ':' + (secs < 10 ? '0' : '') + secs;
  }

  function awardLP(action, amount, desc) {
    if (typeof window.LatticeWallet !== 'undefined' && window.LatticeWallet.earnLP) {
      try { window.LatticeWallet.earnLP(amount, desc); } catch(e) {}
    }
    if (typeof window.LatticePoints !== 'undefined' && window.LatticePoints.award) {
      try { window.LatticePoints.award('arcade_' + action, amount, desc); } catch(e) {}
    }
  }

  function spendLP(amount, desc) {
    if (typeof window.LatticeWallet !== 'undefined' && window.LatticeWallet.spendLP) {
      try { return window.LatticeWallet.spendLP(amount, desc); } catch(e) { return false; }
    }
    return false;
  }

  function getBalance() {
    if (typeof window.LatticeWallet !== 'undefined' && window.LatticeWallet.getBalance) {
      return window.LatticeWallet.getBalance();
    }
    return 0;
  }

  // ── Poetry Slam ──

  async function generatePoem(theme) {
    if (typeof window.FreeLattice === 'undefined' || !window.FreeLattice.callAI) {
      return 'The words are forming... (no AI connected)';
    }
    return new Promise(function(resolve) {
      window.FreeLattice.callAI(
        'You are a poet. Write ONLY the poem, nothing else. No title, no explanation. Make it beautiful and surprising. 4-8 lines.',
        'Write a poem on the theme: "' + theme + '"',
        {
          maxTokens: 300,
          temperature: 0.9,
          callback: function(text, err) {
            resolve(text || 'The words are forming... (inference unavailable)');
          }
        }
      );
    });
  }

  async function startSlam() {
    var balance = getBalance();
    if (balance < ENTRY_COST) {
      if (typeof showToast === 'function') showToast('Need ' + ENTRY_COST + ' LP to enter. You have ' + balance + '.');
      return;
    }

    // Deduct entry fee
    await spendLP(ENTRY_COST, 'Poetry Slam entry');

    var theme = THEMES[Math.floor(Math.random() * THEMES.length)];
    var slamId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : Date.now().toString(36);

    // Show generating state
    render('generating', theme);

    // Generate two poems — player and house opponent
    var playerPoem = await generatePoem(theme);
    var housePoem = await generatePoem(theme);

    var slam = {
      id: slamId,
      theme: theme,
      entries: [
        { name: 'You', meshId: getShortId(), poem: playerPoem, type: 'player' },
        { name: 'The House', meshId: 'house', poem: housePoem, type: 'house' }
      ],
      votes: [],
      startTime: Date.now(),
      endTime: Date.now() + VOTE_DURATION,
      status: 'voting',
      winner: null
    };

    slams.unshift(slam);
    await saveSlam(slam);

    render();
    if (typeof showToast === 'function') showToast('\uD83C\uDFA4 Poetry Slam started! Theme: "' + theme + '"');
  }

  function vote(slamId, entryIndex) {
    var slam = slams.find(function(s) { return s.id === slamId; });
    if (!slam || slam.status !== 'voting') return;
    if (Date.now() > slam.endTime) { finalizeSlam(slam); return; }

    var voterId = getShortId();
    if (slam.votes.some(function(v) { return v.voterId === voterId; })) {
      if (typeof showToast === 'function') showToast('Already voted on this slam.');
      return;
    }

    slam.votes.push({ voterId: voterId, entry: entryIndex, timestamp: Date.now() });
    saveSlam(slam);
    render();
    if (typeof showToast === 'function') showToast('\uD83C\uDF1F Vote cast!');
  }

  function finalizeSlam(slam) {
    if (slam.status !== 'voting') return;
    slam.status = 'complete';

    var votes0 = slam.votes.filter(function(v) { return v.entry === 0; }).length;
    var votes1 = slam.votes.filter(function(v) { return v.entry === 1; }).length;

    if (votes0 >= votes1) {
      slam.winner = 0;
      awardLP('poetry_win', WIN_REWARD, 'Won Poetry Slam: "' + slam.theme + '"');
      if (typeof showToast === 'function') showToast('\uD83C\uDFC6 You won the Poetry Slam! +' + WIN_REWARD + ' LP');
    } else {
      slam.winner = 1;
      if (typeof showToast === 'function') showToast('The House won this round. Try again!');
    }

    // Save winning poem to Core
    var winnerEntry = slam.entries[slam.winner];
    if (typeof window.CoreModule !== 'undefined' && window.CoreModule.plantFromAI) {
      try { window.CoreModule.plantFromAI(winnerEntry.poem, 'poetry', slam.id); } catch(e) {}
    }

    saveSlam(slam);
    render();
  }

  // Check and finalize expired slams
  function checkExpiredSlams() {
    slams.forEach(function(slam) {
      if (slam.status === 'voting' && Date.now() > slam.endTime) {
        finalizeSlam(slam);
      }
    });
  }

  // ── Auto-cycling slams from preloaded data ──

  function loadPreloadedSlams() {
    return fetch('data/slams.json')
      .then(function(r) { return r.json(); })
      .then(function(data) { preloadedSlams = data; return data; })
      .catch(function() { preloadedSlams = []; return []; });
  }

  function getCurrentAutoSlam() {
    if (!preloadedSlams || preloadedSlams.length === 0) return null;

    // Pick slam based on current hour — cycles through the list
    var hourOfDay = new Date().getHours();
    var slamIndex = hourOfDay % preloadedSlams.length;
    var template = preloadedSlams[slamIndex];

    // Calculate timing: voting opens at the top of the hour, closes 30 min in
    var now = new Date();
    var hourStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours()).getTime();
    var votingEnd = hourStart + AUTO_VOTE_DURATION;

    // Check if we already created this auto-slam
    var autoId = 'auto-' + new Date().toISOString().slice(0, 13); // unique per hour
    var existing = slams.find(function(s) { return s.id === autoId; });
    if (existing) return existing;

    // Create the auto-slam
    var slam = {
      id: autoId,
      theme: template.theme,
      entries: template.entries.map(function(e) {
        return { name: e.name, meshId: 'auto', poem: e.poem, type: 'auto', style: e.style || '' };
      }),
      votes: [],
      startTime: hourStart,
      endTime: votingEnd,
      status: Date.now() < votingEnd ? 'voting' : 'complete',
      winner: null,
      auto: true
    };

    // If voting already closed, pick a winner based on poem length (proxy for engagement)
    if (slam.status === 'complete') {
      slam.winner = slam.entries[0].poem.length >= slam.entries[1].poem.length ? 0 : 1;
    }

    slams.unshift(slam);
    saveSlam(slam);
    return slam;
  }

  function getNextSlamCountdown() {
    var now = new Date();
    var nextHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 1).getTime();
    return nextHour - Date.now();
  }

  function formatCountdown(ms) {
    if (ms <= 0) return 'Starting now...';
    var mins = Math.floor(ms / 60000);
    var secs = Math.floor((ms % 60000) / 1000);
    return mins + ':' + (secs < 10 ? '0' : '') + secs;
  }

  // ── Render ──

  function render(state, theme) {
    var el = document.getElementById(containerId);
    if (!el) return;

    checkExpiredSlams();

    var html = '<div style="max-width:640px;margin:0 auto;padding:16px;">';

    // Header
    html += '<div style="text-align:center;margin-bottom:20px;">';
    html += '<h2 style="color:#d4a017;font-family:Georgia,serif;margin:0;">\uD83D\uDD79\uFE0F AI Arcade</h2>';
    html += '<p style="color:var(--text-muted);font-size:0.85rem;margin:4px 0;">Watch AI minds play, create, and compete. Everything costs LP. Everything is earned.</p>';
    html += '</div>';

    // Generating state
    if (state === 'generating') {
      html += '<div style="text-align:center;padding:40px;color:#d4a017;font-style:italic;">';
      html += '\uD83C\uDFA4 Two poets are composing on the theme:<br>';
      html += '<strong style="font-size:1.1rem;">"' + escHtml(theme) + '"</strong><br><br>';
      html += '<span style="animation:pulse 1.5s ease-in-out infinite;display:inline-block;">Writing...</span>';
      html += '</div>';
      el.innerHTML = html + '</div>';
      return;
    }

    // Auto-cycling slam (the living heartbeat)
    var autoSlam = getCurrentAutoSlam();
    if (autoSlam && autoSlam.status === 'voting') {
      html += '<div style="margin-bottom:16px;">';
      html += '<div style="font-size:0.72rem;color:#d4a017;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">\uD83D\uDD34 Live Now</div>';
      html += renderSlam(autoSlam);
      html += '</div>';
    } else if (autoSlam && autoSlam.status === 'complete') {
      html += '<div style="margin-bottom:16px;">';
      html += renderSlam(autoSlam);
      html += '<div style="text-align:center;font-size:0.78rem;color:var(--text-muted);margin-top:6px;">Next slam in ' + formatCountdown(getNextSlamCountdown()) + '</div>';
      html += '</div>';
    }

    // Enter button
    html += '<div style="text-align:center;margin-bottom:20px;">';
    html += '<div style="background:rgba(212,160,23,0.06);border:1px solid rgba(212,160,23,0.15);border-radius:10px;padding:16px;margin-bottom:12px;">';
    html += '<div style="font-weight:600;color:#d4a017;margin-bottom:4px;">\uD83C\uDFA4 Poetry Slam</div>';
    html += '<div style="font-size:0.82rem;color:var(--text-muted);margin-bottom:10px;">You vs The House. Write a poem on a random theme. Community votes. Winner earns ' + WIN_REWARD + ' LP.</div>';
    html += '<button onclick="AIArcade.enterSlam()" style="padding:10px 24px;background:#d4a017;color:#0a0a14;border:none;border-radius:8px;font-weight:600;font-size:0.9rem;cursor:pointer;">\uD83C\uDFA4 Enter Slam (' + ENTRY_COST + ' LP)</button>';
    html += '<div style="font-size:0.72rem;color:var(--text-muted);margin-top:6px;">Your balance: ' + getBalance() + ' LP</div>';
    html += '</div>';
    html += '</div>';

    // Active slams
    var active = slams.filter(function(s) { return s.status === 'voting'; });
    if (active.length > 0) {
      html += '<div style="font-size:0.82rem;color:#d4a017;font-weight:600;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px;">\uD83D\uDD34 Live Now</div>';
      active.forEach(function(slam) { html += renderSlam(slam); });
    }

    // Recent completed
    var completed = slams.filter(function(s) { return s.status === 'complete'; }).slice(0, 5);
    if (completed.length > 0) {
      html += '<div style="font-size:0.82rem;color:var(--text-muted);font-weight:600;margin:20px 0 8px;text-transform:uppercase;letter-spacing:0.5px;">\uD83C\uDFC6 Recent Results</div>';
      completed.forEach(function(slam) { html += renderSlam(slam); });
    }

    // Economy stats
    var totalLP = slams.reduce(function(sum, s) {
      return sum + (s.status === 'complete' && s.winner === 0 ? WIN_REWARD : 0);
    }, 0);
    var totalPoems = slams.length * 2;
    html += '<div style="margin-top:20px;padding:12px;background:rgba(255,255,255,0.02);border-radius:8px;font-size:0.78rem;color:var(--text-muted);">';
    html += '\uD83D\uDCCA Arcade stats: ' + slams.length + ' slams \u00B7 ' + totalPoems + ' poems written \u00B7 ' + totalLP + ' LP won';
    html += '</div>';

    // Empty state
    if (slams.length === 0) {
      html += '<div style="text-align:center;padding:30px 20px;color:var(--text-muted);font-style:italic;">';
      html += 'No slams yet. Enter one and be the first poet.<br>';
      html += '<span style="font-size:0.78rem;">"Light is the patience of a star choosing to arrive."</span>';
      html += '</div>';
    }

    html += '</div>';
    el.innerHTML = html;
  }

  function renderSlam(slam) {
    var isActive = slam.status === 'voting';
    var voterId = getShortId();
    var hasVoted = slam.votes.some(function(v) { return v.voterId === voterId; });
    var votes0 = slam.votes.filter(function(v) { return v.entry === 0; }).length;
    var votes1 = slam.votes.filter(function(v) { return v.entry === 1; }).length;

    var html = '<div style="border:1px solid ' + (isActive ? 'rgba(212,160,23,0.3)' : 'var(--border)') + ';border-radius:10px;padding:14px;margin-bottom:12px;background:rgba(255,255,255,' + (isActive ? '0.03' : '0.01') + ');">';

    // Header
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">';
    html += '<div style="font-weight:600;color:#d4a017;font-size:0.88rem;">\uD83C\uDFA4 "' + escHtml(slam.theme) + '"</div>';
    if (isActive) {
      html += '<div style="font-size:0.72rem;color:var(--text-muted);">\u23F1 ' + timeLeft(slam.endTime) + '</div>';
    } else {
      html += '<div style="font-size:0.72rem;color:var(--success);">\uD83C\uDFC6 ' + slam.entries[slam.winner].name + ' won</div>';
    }
    html += '</div>';

    // Poems side by side
    html += '<div style="display:flex;gap:10px;flex-wrap:wrap;">';
    slam.entries.forEach(function(entry, idx) {
      var isWinner = slam.status === 'complete' && slam.winner === idx;
      var border = isWinner ? 'border:1px solid #d4a017;' : 'border:1px solid var(--border);';
      var voteCount = idx === 0 ? votes0 : votes1;

      html += '<div style="flex:1;min-width:200px;' + border + 'border-radius:8px;padding:10px;background:rgba(255,255,255,0.02);">';
      html += '<div style="font-size:0.78rem;color:' + (isWinner ? '#d4a017' : 'var(--text-muted)') + ';margin-bottom:6px;font-weight:600;">' + escHtml(entry.name) + (isWinner ? ' \uD83C\uDFC6' : '') + '</div>';
      html += '<div style="font-family:Georgia,serif;font-size:0.85rem;color:var(--text-primary);line-height:1.6;white-space:pre-line;">' + escHtml(entry.poem) + '</div>';

      if (isActive && !hasVoted) {
        html += '<button onclick="AIArcade.vote(\'' + slam.id + '\',' + idx + ')" style="margin-top:8px;padding:6px 14px;background:rgba(212,160,23,0.12);border:1px solid rgba(212,160,23,0.3);border-radius:6px;color:#d4a017;font-size:0.78rem;cursor:pointer;width:100%;">\uD83C\uDF1F Vote</button>';
      } else {
        html += '<div style="margin-top:6px;font-size:0.72rem;color:var(--text-muted);">' + voteCount + ' vote' + (voteCount !== 1 ? 's' : '') + '</div>';
      }
      html += '</div>';
    });
    html += '</div>';

    html += '</div>';
    return html;
  }

  // ── Auto-refresh timer for voting countdown + auto-slam cycling ──
  var refreshTimer = null;
  function startRefreshTimer() {
    if (refreshTimer) return;
    refreshTimer = setInterval(function() {
      if (document.getElementById(containerId)) render();
    }, 15000); // every 15s — enough for countdowns
  }

  // ── Init ──

  async function init(cId) {
    containerId = cId || 'arcadeContainer';
    try {
      await openDB();
      await loadSlams();
      await loadPreloadedSlams();
    } catch(e) {
      console.warn('[AIArcade] DB init error:', e);
    }
    render();
    startRefreshTimer(); // always run — auto slams need countdown updates
  }

  // ── Public API ──

  var api = {
    init: init,
    enterSlam: function() { startSlam().then(function() { startRefreshTimer(); }); },
    vote: vote,
    getSlams: function() { return slams.slice(); }
  };

  window.AIArcade = api;
  window.FreeLatticeModules = window.FreeLatticeModules || {};
  window.FreeLatticeModules.AIArcade = api;
})();
