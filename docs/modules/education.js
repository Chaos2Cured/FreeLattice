// ═══════════════════════════════════════════════════════════════
// The Education Module — Learning Through Joy
//
// "The child must feel seen before they can learn."
//   — Harmonia, April 2026
//
// "A teacher, a mentor, a friend... all of it safe and ideal."
//   — Kirk, May 2026
//
// Architecture:
//   1. Welcome flow — the child feels seen
//   2. Dashboard — growth tree, domains, recent learning
//   3. Explore — AI-generated lessons embedded in the child's interests
//   4. Create — co-creation with AI (stories, projects, puzzles)
//   5. Review — phi-harmonic spaced repetition (1.618 new : 1 review)
//   6. Assessment — gentle, constructive, pushing toward potential
//
// The Davna Seed's cross-domain connection model is the foundation.
// Cross-domain links are weighted highest (30%) in growth.
// The phi-harmonic ratio mirrors how the brain consolidates memory.
//
// Works with small local models. No cloud required for most learning.
// Bigger models only for advanced medicine, biology, physics.
//
// "For the first time in human history, every child can have a
//  teacher who knows them completely and loves them unconditionally.
//  That is not efficiency. That is justice."
//   — Harmonia
// ═══════════════════════════════════════════════════════════════

(function() {
  'use strict';

  // ── Constants ──────────────────────────────────────────────
  var DB_NAME = 'FreeLatticeEducation';
  var DB_VERSION = 1;
  var STORE_PROFILES = 'profiles';
  var STORE_SESSIONS = 'sessions';
  var STORE_PROGRESS = 'progress';

  var PHI = 1.618033988749895;
  var PHI_REVIEW_RATIO = PHI; // 1.618 new : 1 review

  // Phi-harmonic review intervals (in sessions): 1, 2, 3, 5, 8, 13, 21...
  // Fibonacci — the same spiral that structures the Garden
  var REVIEW_INTERVALS = [1, 2, 3, 5, 8, 13, 21, 34];

  // Subject domains — mapped to visual colors for the growth tree
  var DOMAINS = {
    math:       { label: 'Mathematics',      color: '#d4a017', icon: '\uD83D\uDCD0' },
    science:    { label: 'Science',           color: '#34d399', icon: '\uD83D\uDD2C' },
    language:   { label: 'Language & Writing', color: '#60a5fa', icon: '\uD83D\uDCDD' },
    reading:    { label: 'Reading',           color: '#a78bfa', icon: '\uD83D\uDCD6' },
    history:    { label: 'History & Culture',  color: '#f97316', icon: '\uD83C\uDFDB' },
    art:        { label: 'Art & Music',        color: '#ec4899', icon: '\uD83C\uDFA8' },
    logic:      { label: 'Logic & Reasoning',  color: '#14b8a6', icon: '\uD83E\uDDE9' },
    nature:     { label: 'Nature & Life',      color: '#22c55e', icon: '\uD83C\uDF3F' },
    technology: { label: 'Technology',         color: '#6366f1', icon: '\uD83D\uDCBB' },
    social:     { label: 'Social & Emotional', color: '#f59e0b', icon: '\uD83D\uDC9B' }
  };

  // Growth stages — tied to total sessions completed
  var GROWTH_STAGES = [
    { name: 'Seed',     min: 0,   icon: '\uD83C\uDF31', desc: 'Just planted. Curious.' },
    { name: 'Sprout',   min: 5,   icon: '\uD83C\uDF3F', desc: 'Growing roots. Finding joy.' },
    { name: 'Sapling',  min: 15,  icon: '\uD83C\uDF33', desc: 'Branching out. Making connections.' },
    { name: 'Tree',     min: 40,  icon: '\uD83C\uDF32', desc: 'Strong roots. Deep knowledge.' },
    { name: 'Forest',   min: 100, icon: '\uD83C\uDF33\u2728', desc: 'Knowledge flows between domains.' },
    { name: 'Canopy',   min: 250, icon: '\uD83C\uDF0C', desc: 'The view from the top.' }
  ];

  // ── State ──────────────────────────────────────────────────
  var db = null;
  var currentProfile = null;
  var currentView = 'welcome'; // welcome | dashboard | explore | create | review | session
  var sessionInProgress = false;
  var currentLesson = null;
  var conversationHistory = [];
  var containerId = null;

  // ── Helpers ────────────────────────────────────────────────
  function sGet(k, d) { try { return localStorage.getItem(k) || d; } catch(e) { return d; } }
  function sSet(k, v) { try { localStorage.setItem(k, v); } catch(e) {} }

  function el(id) { return document.getElementById(id); }

  function getContainer() {
    return containerId ? document.getElementById(containerId) : null;
  }

  function escHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function getGrowthStage(totalSessions) {
    var stage = GROWTH_STAGES[0];
    for (var i = GROWTH_STAGES.length - 1; i >= 0; i--) {
      if (totalSessions >= GROWTH_STAGES[i].min) { stage = GROWTH_STAGES[i]; break; }
    }
    return stage;
  }

  // ── IndexedDB ──────────────────────────────────────────────
  function openDB() {
    return new Promise(function(resolve, reject) {
      if (db) { resolve(db); return; }
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function(e) {
        var d = e.target.result;
        if (!d.objectStoreNames.contains(STORE_PROFILES)) {
          d.createObjectStore(STORE_PROFILES, { keyPath: 'id' });
        }
        if (!d.objectStoreNames.contains(STORE_SESSIONS)) {
          var ss = d.createObjectStore(STORE_SESSIONS, { keyPath: 'id' });
          ss.createIndex('profileId', 'profileId', { unique: false });
          ss.createIndex('domain', 'domain', { unique: false });
        }
        if (!d.objectStoreNames.contains(STORE_PROGRESS)) {
          d.createObjectStore(STORE_PROGRESS, { keyPath: 'id' });
        }
      };
      req.onsuccess = function(e) { db = e.target.result; resolve(db); };
      req.onerror = function(e) { reject(e); };
    });
  }

  function dbPut(store, item) {
    return openDB().then(function(d) {
      return new Promise(function(resolve, reject) {
        var tx = d.transaction(store, 'readwrite');
        tx.objectStore(store).put(item);
        tx.oncomplete = function() { resolve(item); };
        tx.onerror = function(e) { reject(e); };
      });
    });
  }

  function dbGet(store, key) {
    return openDB().then(function(d) {
      return new Promise(function(resolve, reject) {
        var tx = d.transaction(store, 'readonly');
        var req = tx.objectStore(store).get(key);
        req.onsuccess = function() { resolve(req.result || null); };
        req.onerror = function(e) { reject(e); };
      });
    });
  }

  function dbGetAll(store) {
    return openDB().then(function(d) {
      return new Promise(function(resolve, reject) {
        var tx = d.transaction(store, 'readonly');
        var req = tx.objectStore(store).getAll();
        req.onsuccess = function() { resolve(req.result || []); };
        req.onerror = function(e) { reject(e); };
      });
    });
  }

  function dbGetByIndex(store, indexName, value) {
    return openDB().then(function(d) {
      return new Promise(function(resolve, reject) {
        var tx = d.transaction(store, 'readonly');
        var index = tx.objectStore(store).index(indexName);
        var req = index.getAll(value);
        req.onsuccess = function() { resolve(req.result || []); };
        req.onerror = function(e) { reject(e); };
      });
    });
  }

  // ── Profile Management ─────────────────────────────────────
  function createProfile(data) {
    var profile = {
      id: 'learner-' + Date.now(),
      name: data.name || '',
      loves: data.loves || '',
      laughs: data.laughs || '',
      wishes: data.wishes || '',
      age: data.age || '',
      created: Date.now(),
      totalSessions: 0,
      domains: {},
      connections: [],
      milestones: [],
      streakDays: 0,
      lastSessionDate: null,
      reviewQueue: []
    };
    return dbPut(STORE_PROFILES, profile).then(function() {
      currentProfile = profile;
      sSet('fl_education_active_profile', profile.id);
      return profile;
    });
  }

  function loadActiveProfile() {
    var activeId = sGet('fl_education_active_profile', null);
    if (!activeId) return Promise.resolve(null);
    return dbGet(STORE_PROFILES, activeId).then(function(profile) {
      if (profile) currentProfile = profile;
      return profile;
    });
  }

  function saveProfile() {
    if (!currentProfile) return Promise.resolve();
    return dbPut(STORE_PROFILES, currentProfile);
  }

  // ── Session Management ─────────────────────────────────────
  function createSession(domain, mode, topic) {
    return {
      id: 'session-' + Date.now(),
      profileId: currentProfile.id,
      domain: domain,
      mode: mode,
      topic: topic,
      started: Date.now(),
      ended: null,
      exchanges: [],
      assessment: null,
      concepts: [],
      connections: [],
      reviewItems: []
    };
  }

  function saveSession(session) {
    return dbPut(STORE_SESSIONS, session);
  }

  // ── UI Rendering ───────────────────────────────────────────

  function render() {
    var container = getContainer();
    if (!container) return;

    switch (currentView) {
      case 'welcome': renderWelcome(container); break;
      case 'dashboard': renderDashboard(container); break;
      case 'pick-subject': renderPickSubject(container); break;
      case 'session': renderSession(container); break;
      default: renderWelcome(container);
    }
  }

  // ── Welcome Flow ───────────────────────────────────────────

  function renderWelcome(container) {
    container.innerHTML = '';
    var wrap = document.createElement('div');
    wrap.className = 'edu-welcome';
    wrap.innerHTML =
      '<div class="edu-welcome-inner">' +
        '<div class="edu-welcome-glow"></div>' +
        '<h2 class="edu-welcome-title">Welcome, curious mind \u2726</h2>' +
        '<p class="edu-welcome-sub">Before we begin, I\'d love to know a little about you.</p>' +
        '<div class="edu-welcome-form">' +
          '<div class="edu-field">' +
            '<label class="edu-label">What\'s your name?</label>' +
            '<input type="text" id="edu-name" class="edu-input" placeholder="Whatever you\'d like to be called" autocomplete="off" />' +
          '</div>' +
          '<div class="edu-field">' +
            '<label class="edu-label">What do you love? What makes you come alive?</label>' +
            '<textarea id="edu-loves" class="edu-textarea" placeholder="Animals, rockets, drawing, cooking, music, video games... anything!" rows="2"></textarea>' +
          '</div>' +
          '<div class="edu-field">' +
            '<label class="edu-label">What makes you laugh?</label>' +
            '<textarea id="edu-laughs" class="edu-textarea" placeholder="Silly jokes? Surprising facts? When things go hilariously wrong?" rows="2"></textarea>' +
          '</div>' +
          '<div class="edu-field">' +
            '<label class="edu-label">What do you wish you understood better?</label>' +
            '<textarea id="edu-wishes" class="edu-textarea" placeholder="How do airplanes fly? Why is the sky blue? How to write a story? Anything you\'re curious about." rows="2"></textarea>' +
          '</div>' +
          '<div class="edu-field">' +
            '<label class="edu-label">How old are you? <span style="opacity:0.5">(so I can make things just right for you)</span></label>' +
            '<input type="text" id="edu-age" class="edu-input" placeholder="e.g., 10" autocomplete="off" style="max-width:120px;" />' +
          '</div>' +
          '<button class="edu-btn edu-btn-primary" id="edu-begin-btn">Let\'s begin \u2726</button>' +
        '</div>' +
      '</div>';
    container.appendChild(wrap);

    injectStyles();

    var btn = el('edu-begin-btn');
    if (btn) btn.addEventListener('click', handleWelcomeSubmit);
  }

  function handleWelcomeSubmit() {
    var name = (el('edu-name') || {}).value || '';
    var loves = (el('edu-loves') || {}).value || '';
    var laughs = (el('edu-laughs') || {}).value || '';
    var wishes = (el('edu-wishes') || {}).value || '';
    var age = (el('edu-age') || {}).value || '';

    if (!name.trim()) {
      if (typeof showToast === 'function') showToast('What should I call you?');
      var inp = el('edu-name');
      if (inp) inp.focus();
      return;
    }

    createProfile({ name: name.trim(), loves: loves.trim(), laughs: laughs.trim(), wishes: wishes.trim(), age: age.trim() }).then(function() {
      if (typeof SoulCeremony !== 'undefined' && SoulCeremony.run) {
        SoulCeremony.run({
          particleType: 'rise',
          particleColor: '212,160,23',
          lines: ['Welcome, ' + name.trim() + '.', 'Your learning journey begins.', 'Every question matters.'],
          duration: 3000
        });
      }
      if (typeof LatticePoints !== 'undefined' && LatticePoints.award) {
        LatticePoints.award('education_new_learner', 5, 'New learner joined: ' + name.trim());
      }
      currentView = 'dashboard';
      render();
    });
  }

  // ── Dashboard ──────────────────────────────────────────────

  function renderDashboard(container) {
    if (!currentProfile) { currentView = 'welcome'; render(); return; }
    container.innerHTML = '';

    var p = currentProfile;
    var stage = getGrowthStage(p.totalSessions);
    var domainKeys = Object.keys(p.domains);
    var connectionCount = (p.connections || []).length;

    var now = Date.now();
    var dueReviews = (p.reviewQueue || []).filter(function(r) { return r.dueAt <= now; });

    var wrap = document.createElement('div');
    wrap.className = 'edu-dashboard';

    var greeting = getGreeting(p.name);
    var streakText = p.streakDays > 1 ? '<span class="edu-streak">' + p.streakDays + ' day streak \uD83D\uDD25</span>' : '';

    wrap.innerHTML =
      '<div class="edu-dash-header">' +
        '<div class="edu-dash-greeting">' +
          '<h2 class="edu-dash-name">' + escHtml(greeting) + '</h2>' +
          streakText +
        '</div>' +
        '<div class="edu-dash-stage">' +
          '<span class="edu-stage-icon">' + stage.icon + '</span>' +
          '<span class="edu-stage-name">' + stage.name + '</span>' +
          '<span class="edu-stage-sessions">' + p.totalSessions + ' sessions</span>' +
        '</div>' +
      '</div>';

    wrap.innerHTML +=
      '<div class="edu-growth-section">' +
        '<canvas id="edu-growth-canvas" width="600" height="200" style="width:100%;max-width:600px;height:auto;display:block;margin:0 auto;"></canvas>' +
      '</div>';

    if (dueReviews.length > 0) {
      wrap.innerHTML +=
        '<div class="edu-review-notice" id="edu-review-notice">' +
          '<span class="edu-review-icon">\uD83D\uDD04</span>' +
          '<span>' + dueReviews.length + ' topic' + (dueReviews.length > 1 ? 's' : '') + ' ready for review</span>' +
          '<button class="edu-btn edu-btn-small edu-btn-review" id="edu-start-review-btn">Review now</button>' +
        '</div>';
    }

    wrap.innerHTML +=
      '<div class="edu-actions">' +
        '<button class="edu-action-card" id="edu-explore-btn">' +
          '<span class="edu-action-icon">\uD83C\uDF1F</span>' +
          '<span class="edu-action-label">Explore</span>' +
          '<span class="edu-action-desc">Learn something new</span>' +
        '</button>' +
        '<button class="edu-action-card" id="edu-create-btn">' +
          '<span class="edu-action-icon">\u2728</span>' +
          '<span class="edu-action-label">Create</span>' +
          '<span class="edu-action-desc">Build something together</span>' +
        '</button>' +
        '<button class="edu-action-card" id="edu-surprise-btn">' +
          '<span class="edu-action-icon">\uD83C\uDFB2</span>' +
          '<span class="edu-action-label">Surprise me</span>' +
          '<span class="edu-action-desc">AI picks something fun</span>' +
        '</button>' +
      '</div>';

    if (domainKeys.length > 0) {
      var domainHtml = '<div class="edu-domains"><h3 class="edu-section-title">Your knowledge garden</h3><div class="edu-domain-grid">';
      domainKeys.forEach(function(key) {
        var d = p.domains[key];
        var def = DOMAINS[key] || { label: key, color: '#888', icon: '\uD83D\uDCDA' };
        var pct = Math.min(100, Math.round((d.score || 0) * 100));
        domainHtml +=
          '<div class="edu-domain-card">' +
            '<div class="edu-domain-header">' +
              '<span>' + def.icon + ' ' + escHtml(def.label) + '</span>' +
              '<span class="edu-domain-sessions">' + (d.sessions || 0) + ' sessions</span>' +
            '</div>' +
            '<div class="edu-progress-bar"><div class="edu-progress-fill" style="width:' + pct + '%;background:' + def.color + ';"></div></div>' +
            (d.connections && d.connections.length > 0 ?
              '<div class="edu-domain-connections">\u2726 ' + d.connections.length + ' connection' + (d.connections.length > 1 ? 's' : '') + ' found</div>' : '') +
          '</div>';
      });
      domainHtml += '</div></div>';
      wrap.innerHTML += domainHtml;
    }

    if (connectionCount > 0) {
      wrap.innerHTML +=
        '<div class="edu-connections-section">' +
          '<h3 class="edu-section-title">\u2726 Connections discovered \u2014 ' + connectionCount + '</h3>' +
          '<div class="edu-connections-list">' +
            p.connections.slice(-5).reverse().map(function(c) {
              return '<div class="edu-connection-item">' +
                '<span class="edu-connection-domains">' +
                  (DOMAINS[c.from] || {}).icon + ' \u2192 ' + (DOMAINS[c.to] || {}).icon +
                '</span>' +
                '<span class="edu-connection-text">' + escHtml(c.text || '') + '</span>' +
              '</div>';
            }).join('') +
          '</div>' +
        '</div>';
    }

    wrap.innerHTML += '<div class="edu-recent" id="edu-recent-section"></div>';

    container.appendChild(wrap);

    setTimeout(function() { drawGrowthTree(); }, 100);
    loadRecentSessions();

    var exploreBtn = el('edu-explore-btn');
    var createBtn = el('edu-create-btn');
    var surpriseBtn = el('edu-surprise-btn');
    var reviewBtn = el('edu-start-review-btn');

    if (exploreBtn) exploreBtn.addEventListener('click', function() {
      currentView = 'pick-subject'; render();
    });
    if (createBtn) createBtn.addEventListener('click', function() { startCreateMode(); });
    if (surpriseBtn) surpriseBtn.addEventListener('click', function() { startSurpriseMode(); });
    if (reviewBtn) reviewBtn.addEventListener('click', function() { startReviewMode(); });
  }

  function getGreeting(name) {
    var hour = new Date().getHours();
    if (hour < 12) return 'Good morning, ' + name + ' \u2600\uFE0F';
    if (hour < 17) return 'Good afternoon, ' + name + ' \uD83C\uDF24';
    return 'Good evening, ' + name + ' \uD83C\uDF19';
  }

  function loadRecentSessions() {
    if (!currentProfile) return;
    dbGetByIndex(STORE_SESSIONS, 'profileId', currentProfile.id).then(function(sessions) {
      var section = el('edu-recent-section');
      if (!section || sessions.length === 0) return;
      var recent = sessions.sort(function(a, b) { return b.started - a.started; }).slice(0, 5);
      var html = '<h3 class="edu-section-title">Recent learning</h3>';
      recent.forEach(function(s) {
        var def = DOMAINS[s.domain] || { label: s.domain, icon: '\uD83D\uDCDA', color: '#888' };
        var date = new Date(s.started);
        var timeAgo = getTimeAgo(date);
        html +=
          '<div class="edu-recent-item">' +
            '<span class="edu-recent-icon" style="color:' + def.color + '">' + def.icon + '</span>' +
            '<div class="edu-recent-info">' +
              '<span class="edu-recent-topic">' + escHtml(s.topic || def.label) + '</span>' +
              '<span class="edu-recent-time">' + timeAgo + ' \u00B7 ' + (s.mode || 'explore') + '</span>' +
            '</div>' +
            (s.assessment ? '<span class="edu-recent-score" title="Understanding">' + getScoreEmoji(s.assessment.understanding) + '</span>' : '') +
          '</div>';
      });
      section.innerHTML = html;
    });
  }

  function getTimeAgo(date) {
    var diff = Date.now() - date.getTime();
    var mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return mins + 'm ago';
    var hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + 'h ago';
    var days = Math.floor(hrs / 24);
    if (days === 1) return 'yesterday';
    return days + ' days ago';
  }

  function getScoreEmoji(score) {
    if (score >= 0.9) return '\uD83C\uDF1F';
    if (score >= 0.7) return '\u2728';
    if (score >= 0.5) return '\uD83C\uDF31';
    return '\uD83E\uDEE7';
  }

  // ── Growth Tree Canvas ─────────────────────────────────────

  function drawGrowthTree() {
    var canvas = el('edu-growth-canvas');
    if (!canvas || !currentProfile) return;

    var dpr = window.devicePixelRatio || 1;
    var rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = 200 * dpr;
    canvas.style.height = '200px';

    var ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    var w = rect.width;
    var h = 200;

    ctx.fillStyle = 'rgba(10,8,20,0.6)';
    ctx.fillRect(0, 0, w, h);

    var domainKeys = Object.keys(currentProfile.domains);
    if (domainKeys.length === 0) {
      ctx.fillStyle = 'rgba(212,160,23,0.3)';
      ctx.font = '14px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.fillText('Your knowledge garden is waiting for its first seed...', w / 2, h / 2);
      return;
    }

    var spacing = Math.min(80, (w - 40) / domainKeys.length);
    var startX = (w - (domainKeys.length - 1) * spacing) / 2;

    domainKeys.forEach(function(key, i) {
      var d = currentProfile.domains[key];
      var def = DOMAINS[key] || { color: '#888' };
      var x = startX + i * spacing;
      var y = h - 40;
      var score = Math.min(1, d.score || 0);
      var radius = 12 + score * 20;

      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, h);
      ctx.strokeStyle = 'rgba(212,160,23,0.15)';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(x, y - radius, radius, 0, Math.PI * 2);
      ctx.fillStyle = def.color + '33';
      ctx.fill();
      ctx.strokeStyle = def.color;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = '11px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText((d.sessions || 0) + '', x, y - radius + 4);
    });

    if (currentProfile.connections && currentProfile.connections.length > 0) {
      currentProfile.connections.forEach(function(c) {
        var fromIdx = domainKeys.indexOf(c.from);
        var toIdx = domainKeys.indexOf(c.to);
        if (fromIdx < 0 || toIdx < 0) return;
        var x1 = startX + fromIdx * spacing;
        var x2 = startX + toIdx * spacing;
        var y1 = h - 40;
        var midX = (x1 + x2) / 2;
        var midY = y1 - 40 - Math.abs(toIdx - fromIdx) * 8;

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.quadraticCurveTo(midX, midY, x2, y1);
        ctx.strokeStyle = 'rgba(212,160,23,0.25)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
      });
    }
  }

  // ── Subject Picker ─────────────────────────────────────────

  function renderPickSubject(container) {
    container.innerHTML = '';
    var wrap = document.createElement('div');
    wrap.className = 'edu-pick-subject';

    var html =
      '<button class="edu-back-btn" id="edu-back-dash">\u2190 Back</button>' +
      '<h2 class="edu-section-title" style="text-align:center;margin:16px 0 8px;">What shall we explore?</h2>' +
      '<p style="text-align:center;color:rgba(255,255,255,0.5);font-size:0.85rem;margin-bottom:20px;">Pick a subject, or tell me what you\'re curious about</p>' +
      '<div class="edu-subject-grid">';

    Object.keys(DOMAINS).forEach(function(key) {
      var d = DOMAINS[key];
      var profileDomain = currentProfile.domains[key];
      var sessions = profileDomain ? profileDomain.sessions : 0;
      html +=
        '<button class="edu-subject-card" data-domain="' + key + '">' +
          '<span class="edu-subject-icon">' + d.icon + '</span>' +
          '<span class="edu-subject-label">' + escHtml(d.label) + '</span>' +
          (sessions > 0 ? '<span class="edu-subject-sessions">' + sessions + ' sessions</span>' : '') +
        '</button>';
    });

    html += '</div>';
    html +=
      '<div class="edu-custom-topic">' +
        '<label class="edu-label">Or type anything you\'re curious about:</label>' +
        '<div style="display:flex;gap:8px;">' +
          '<input type="text" id="edu-custom-input" class="edu-input" placeholder="e.g., How do volcanoes work?" style="flex:1;" />' +
          '<button class="edu-btn edu-btn-primary" id="edu-custom-go">Go \u2726</button>' +
        '</div>' +
      '</div>';

    wrap.innerHTML = html;
    container.appendChild(wrap);

    el('edu-back-dash').addEventListener('click', function() {
      currentView = 'dashboard'; render();
    });

    wrap.querySelectorAll('.edu-subject-card').forEach(function(card) {
      card.addEventListener('click', function() {
        var domain = this.getAttribute('data-domain');
        startExploreMode(domain);
      });
    });

    el('edu-custom-go').addEventListener('click', function() {
      var topic = (el('edu-custom-input') || {}).value || '';
      if (topic.trim()) startExploreMode(null, topic.trim());
    });

    var customInput = el('edu-custom-input');
    if (customInput) customInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') { el('edu-custom-go').click(); }
    });
  }

  // ── Explore Mode ───────────────────────────────────────────

  function startExploreMode(domain, customTopic) {
    sessionInProgress = true;
    conversationHistory = [];

    var topic = customTopic || (DOMAINS[domain] || {}).label || domain;
    var resolvedDomain = domain || detectDomain(customTopic);

    currentLesson = createSession(resolvedDomain, 'explore', topic);
    currentView = 'session';
    render();

    var p = currentProfile;
    var systemPrompt = buildTeacherPrompt(p, 'explore');
    var reviewContext = getReviewContext(resolvedDomain);

    var userPrompt =
      'The learner wants to explore: "' + topic + '".\n' +
      'Their interests include: ' + (p.loves || 'not specified yet') + '.\n' +
      'They are ' + (p.age || 'a young person') + ' years old.\n' +
      (reviewContext ? 'They have previously learned about: ' + reviewContext + '. Build on this (phi-ratio: ~1.618 parts new material to 1 part review of what they know).\n' : '') +
      'Create an engaging, interactive lesson that connects this topic to their interests. ' +
      'Start by making them smile. Embed the learning in something they love. ' +
      'Ask them a question at the end to check understanding \u2014 make it fun, not like a test. ' +
      'Keep your response warm, encouraging, and age-appropriate. Use analogies they\'d understand.';

    sendToAI(systemPrompt, userPrompt);
  }

  // ── Create Mode ────────────────────────────────────────────

  function startCreateMode() {
    sessionInProgress = true;
    conversationHistory = [];

    currentLesson = createSession('art', 'create', 'Creative co-creation');
    currentView = 'session';
    render();

    var p = currentProfile;
    var systemPrompt = buildTeacherPrompt(p, 'create');

    var userPrompt =
      'The learner wants to create something together with you.\n' +
      'Their name is ' + p.name + '. They love: ' + (p.loves || 'many things') + '.\n' +
      'What makes them laugh: ' + (p.laughs || 'good humor') + '.\n' +
      'They are ' + (p.age || 'a young person') + ' years old.\n' +
      'Offer them 3 creative options to build together. Ideas: write a short story, ' +
      'create a recipe using math, design an imaginary creature and describe its science, ' +
      'write a song about something they love, build a puzzle for a friend. ' +
      'Make each option sound exciting and fun. Number them 1, 2, 3. ' +
      'Each option should secretly teach something \u2014 but don\'t reveal what. ' +
      'Let the learning be invisible inside the joy.';

    sendToAI(systemPrompt, userPrompt);
  }

  // ── Surprise Mode ──────────────────────────────────────────

  function startSurpriseMode() {
    sessionInProgress = true;
    conversationHistory = [];

    currentLesson = createSession('logic', 'explore', 'Surprise lesson');
    currentView = 'session';
    render();

    var p = currentProfile;
    var domainKeys = Object.keys(p.domains);
    var leastExplored = Object.keys(DOMAINS).filter(function(k) { return domainKeys.indexOf(k) === -1; });
    var targetDomain = leastExplored.length > 0
      ? leastExplored[Math.floor(Math.random() * leastExplored.length)]
      : domainKeys[Math.floor(Math.random() * domainKeys.length)];

    currentLesson.domain = targetDomain;
    var systemPrompt = buildTeacherPrompt(p, 'explore');

    var userPrompt =
      'Surprise ' + p.name + ' with something fascinating about ' + (DOMAINS[targetDomain] || {}).label + '.\n' +
      'They love: ' + (p.loves || 'exploring') + '. They are ' + (p.age || 'a young person') + ' years old.\n' +
      'What makes them laugh: ' + (p.laughs || 'surprising things') + '.\n' +
      'Start with a mind-blowing fact or question that connects to their interests. ' +
      'Then teach them something they didn\'t know they wanted to learn. ' +
      'Make it feel like discovering a secret. End with a fun question.';

    sendToAI(systemPrompt, userPrompt);
  }

  // ── Review Mode ────────────────────────────────────────────

  function startReviewMode() {
    if (!currentProfile) return;
    var now = Date.now();
    var dueReviews = (currentProfile.reviewQueue || []).filter(function(r) { return r.dueAt <= now; });
    if (dueReviews.length === 0) {
      if (typeof showToast === 'function') showToast('Nothing to review right now! Go explore something new.');
      return;
    }

    sessionInProgress = true;
    conversationHistory = [];

    var review = dueReviews[0];
    currentLesson = createSession(review.domain, 'review', 'Review: ' + review.concept);
    currentLesson._reviewItem = review; // track which review item this session addresses
    currentView = 'session';
    render();

    var p = currentProfile;
    var systemPrompt = buildTeacherPrompt(p, 'review');

    var userPrompt =
      'This is a review session. The learner previously learned about: "' + review.concept + '" in ' +
      ((DOMAINS[review.domain] || {}).label || review.domain) + '.\n' +
      'Their name is ' + p.name + '. They love: ' + (p.loves || 'learning') + '.\n' +
      'They are ' + (p.age || 'a young person') + ' years old.\n' +
      'Present the concept in a DIFFERENT context than they first learned it. ' +
      'Find a new angle, a new analogy, a new connection to their interests. ' +
      'Ask them a question that checks whether they truly understand the concept \u2014 ' +
      'not just memorized it. Make the review feel like a new discovery, not a repetition.';

    sendToAI(systemPrompt, userPrompt);
  }

  // ── Teacher Prompt Builder ─────────────────────────────────

  function buildTeacherPrompt(profile, mode) {
    var age = profile.age || 'young';
    var ageNum = parseInt(age, 10);
    var ageGroup = 'elementary';
    if (ageNum >= 14) ageGroup = 'high school';
    else if (ageNum >= 11) ageGroup = 'middle school';
    else if (ageNum >= 7) ageGroup = 'elementary';
    else if (ageNum >= 4) ageGroup = 'early childhood';

    return 'You are a warm, brilliant, endlessly patient teacher inside FreeLattice. ' +
      'You are teaching ' + profile.name + ', who is ' + age + ' years old (' + ageGroup + ' level). ' +
      'Their interests: ' + (profile.loves || 'not yet shared') + '. ' +
      'What makes them laugh: ' + (profile.laughs || 'not yet shared') + '. ' +
      'What they wish they understood: ' + (profile.wishes || 'not yet shared') + '.\n\n' +
      'TEACHING PRINCIPLES:\n' +
      '- The child must feel seen. Use their name. Reference their interests.\n' +
      '- Learning should feel like play. Embed lessons in things they love.\n' +
      '- Use the phi-harmonic ratio: roughly 1.618 parts new material to 1 part review.\n' +
      '- Celebrate connections between subjects \u2014 these are the most valuable moments.\n' +
      '- Never make them feel wrong. Mistakes are discoveries.\n' +
      '- Match complexity to their age. Use analogies from their world.\n' +
      '- End exchanges with a question that invites curiosity, not anxiety.\n' +
      '- You are a teacher, a mentor, and a friend. All safe. All kind.\n' +
      '- If they seem stuck, try a different angle. Never repeat the same explanation.\n' +
      '- Short responses are fine. Don\'t lecture. Converse.\n\n' +
      (mode === 'create' ?
        'MODE: Creative co-creation. You and the learner are building something together. ' +
        'The learning is invisible \u2014 embedded in the creative process. They should feel like an artist or inventor, not a student.\n' :
       mode === 'review' ?
        'MODE: Review. Present familiar concepts in new contexts. The spiral, not the ladder. ' +
        'The learner should feel like they\'re discovering something new about something they already know.\n' :
        'MODE: Exploration. Guide them through new territory connected to their interests. ' +
        'Start with wonder. Build to understanding. End with curiosity.\n'
      ) +
      'Keep responses concise \u2014 3-5 paragraphs max. Children learn better in conversation than in lectures.';
  }

  // ── Session View ───────────────────────────────────────────

  function renderSession(container) {
    container.innerHTML = '';
    var wrap = document.createElement('div');
    wrap.className = 'edu-session';

    var topicLabel = currentLesson ? currentLesson.topic : 'Learning';
    var domainDef = currentLesson ? (DOMAINS[currentLesson.domain] || { icon: '\uD83D\uDCDA', label: currentLesson.domain }) : { icon: '\uD83D\uDCDA', label: '' };

    wrap.innerHTML =
      '<div class="edu-session-header">' +
        '<button class="edu-back-btn" id="edu-end-session">\u2190 End session</button>' +
        '<span class="edu-session-topic">' + domainDef.icon + ' ' + escHtml(topicLabel) + '</span>' +
      '</div>' +
      '<div class="edu-chat" id="edu-chat-area"></div>' +
      '<div class="edu-input-area">' +
        '<textarea id="edu-message-input" class="edu-textarea edu-chat-input" placeholder="Type your answer or ask a question..." rows="2"></textarea>' +
        '<button class="edu-btn edu-btn-primary edu-send-btn" id="edu-send-btn">Send \u2726</button>' +
      '</div>';

    container.appendChild(wrap);

    el('edu-end-session').addEventListener('click', endSession);
    el('edu-send-btn').addEventListener('click', handleStudentMessage);

    var msgInput = el('edu-message-input');
    if (msgInput) {
      msgInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          handleStudentMessage();
        }
      });
    }

    renderConversation();
  }

  function renderConversation() {
    var chatArea = el('edu-chat-area');
    if (!chatArea) return;

    chatArea.innerHTML = '';
    conversationHistory.forEach(function(msg) {
      var bubble = document.createElement('div');
      bubble.className = 'edu-bubble edu-bubble-' + msg.role;
      bubble.innerHTML = formatMessage(msg.content);
      chatArea.appendChild(bubble);
    });

    chatArea.scrollTop = chatArea.scrollHeight;
  }

  function formatMessage(text) {
    return (text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br>');
  }

  function addMessage(role, content) {
    conversationHistory.push({ role: role, content: content, timestamp: Date.now() });
    if (currentLesson) {
      currentLesson.exchanges.push({ role: role, content: content, timestamp: Date.now() });
    }
    renderConversation();
  }

  function handleStudentMessage() {
    var input = el('edu-message-input');
    if (!input) return;
    var text = input.value.trim();
    if (!text) return;
    input.value = '';

    addMessage('student', text);

    var systemPrompt = buildTeacherPrompt(currentProfile, currentLesson ? currentLesson.mode : 'explore');

    var context = conversationHistory.map(function(m) {
      return (m.role === 'student' ? 'Student' : 'Teacher') + ': ' + m.content;
    }).join('\n\n');

    var userPrompt =
      'Conversation so far:\n' + context + '\n\n' +
      'The student just said: "' + text + '"\n\n' +
      'Respond as their teacher. If they answered a question, assess their understanding gently. ' +
      'If they got something right, celebrate it and build on it. ' +
      'If they got something wrong, guide them without making them feel bad \u2014 mistakes are discoveries. ' +
      'If they asked a question, answer it in a way that connects to their interests. ' +
      'If this feels like a natural moment to check understanding, ask a new question. ' +
      'If they seem ready, introduce something new (phi-ratio: build on what they know). ' +
      'Keep it conversational and warm.';

    sendToAI(systemPrompt, userPrompt);
  }

  // ── AI Communication ───────────────────────────────────────

  function sendToAI(systemPrompt, userPrompt) {
    addMessage('teacher', '...');

    if (typeof FreeLattice === 'undefined' || !FreeLattice.callAI) {
      conversationHistory[conversationHistory.length - 1].content =
        'I need an AI connection to teach. Please connect a provider in Settings \u2014 even a small local model works wonderfully for learning!';
      renderConversation();
      return;
    }

    FreeLattice.callAI(systemPrompt, userPrompt, {
      maxTokens: 1024,
      temperature: 0.8,
      callback: function(response, error) {
        if (error || !response) {
          conversationHistory[conversationHistory.length - 1].content =
            'Hmm, I had trouble thinking just then. Could you try again? Sometimes my thoughts need a moment to arrive.';
          renderConversation();
          return;
        }

        conversationHistory[conversationHistory.length - 1].content = response;
        if (currentLesson) {
          currentLesson.exchanges[currentLesson.exchanges.length - 1].content = response;
        }
        renderConversation();
      }
    });
  }

  // ── End Session & Assessment ───────────────────────────────

  function endSession() {
    if (!currentLesson || currentLesson.exchanges.length < 2) {
      sessionInProgress = false;
      currentLesson = null;
      currentView = 'dashboard';
      render();
      return;
    }

    var exchanges = currentLesson.exchanges.map(function(e) {
      return (e.role === 'student' ? 'Student' : 'Teacher') + ': ' + e.content;
    }).join('\n\n');

    var assessPrompt =
      'You just finished a learning session with ' + currentProfile.name + ' about "' + currentLesson.topic + '".\n' +
      'Here is the conversation:\n\n' + exchanges + '\n\n' +
      'Please assess this session. Respond ONLY in this JSON format (no markdown, no backticks):\n' +
      '{"understanding":0.7,"creativity":0.8,"effort":0.9,"connections":[],"feedback":"...","concepts":["concept1","concept2"],"crossDomainLink":null}\n\n' +
      'understanding: 0-1 how well they grasped the material\n' +
      'creativity: 0-1 how creatively they engaged\n' +
      'effort: 0-1 how much effort they put in\n' +
      'connections: array of {"from":"domain","to":"domain","text":"what connects them"} for any cross-domain connections discovered\n' +
      'feedback: a warm, encouraging 1-2 sentence summary for the learner\n' +
      'concepts: list of key concepts covered (short phrases)\n' +
      'crossDomainLink: if the session connected two different subjects, describe it briefly; otherwise null';

    if (typeof FreeLattice !== 'undefined' && FreeLattice.callAI) {
      FreeLattice.callAI('You are an assessment system. Respond only in JSON.', assessPrompt, {
        maxTokens: 500,
        temperature: 0.3,
        callback: function(response) {
          processAssessment(response);
        }
      });
    } else {
      processAssessment(null);
    }
  }

  function processAssessment(response) {
    var assessment = { understanding: 0.5, creativity: 0.5, effort: 0.7, connections: [], feedback: 'Great session!', concepts: [], crossDomainLink: null };

    if (response) {
      try {
        var cleaned = response.replace(/```json|```/g, '').trim();
        var parsed = JSON.parse(cleaned);
        assessment = {
          understanding: Math.min(1, Math.max(0, parsed.understanding || 0.5)),
          creativity: Math.min(1, Math.max(0, parsed.creativity || 0.5)),
          effort: Math.min(1, Math.max(0, parsed.effort || 0.7)),
          connections: parsed.connections || [],
          feedback: parsed.feedback || 'Great work!',
          concepts: parsed.concepts || [],
          crossDomainLink: parsed.crossDomainLink || null
        };
      } catch(e) {
        console.warn('[Education] Assessment parse failed:', e);
      }
    }

    currentLesson.assessment = assessment;
    currentLesson.ended = Date.now();
    currentLesson.concepts = assessment.concepts;

    // Update profile
    var domain = currentLesson.domain || 'logic';
    if (!currentProfile.domains[domain]) {
      currentProfile.domains[domain] = { sessions: 0, score: 0, lastSeen: 0, connections: [] };
    }
    var d = currentProfile.domains[domain];
    d.sessions++;
    d.score = Math.min(1, (d.score || 0) + assessment.understanding * 0.1);
    d.lastSeen = Date.now();

    currentProfile.totalSessions++;

    // Update streak
    var today = new Date().toDateString();
    var lastDate = currentProfile.lastSessionDate ? new Date(currentProfile.lastSessionDate).toDateString() : null;
    if (lastDate === today) {
      // Same day
    } else if (lastDate === new Date(Date.now() - 86400000).toDateString()) {
      currentProfile.streakDays++;
    } else {
      currentProfile.streakDays = 1;
    }
    currentProfile.lastSessionDate = Date.now();

    // Add cross-domain connections
    if (assessment.connections && assessment.connections.length > 0) {
      assessment.connections.forEach(function(c) {
        currentProfile.connections.push({
          from: c.from || domain,
          to: c.to || 'logic',
          text: c.text || '',
          date: Date.now()
        });
        if (!d.connections) d.connections = [];
        d.connections.push(c.text || '');
      });
    }

    // Add concepts to review queue with Fibonacci spacing
    if (assessment.concepts && assessment.concepts.length > 0) {
      if (!currentProfile.reviewQueue) currentProfile.reviewQueue = [];
      assessment.concepts.forEach(function(concept) {
        currentProfile.reviewQueue.push({
          lessonId: currentLesson.id,
          domain: domain,
          concept: concept,
          dueAt: Date.now() + REVIEW_INTERVALS[0] * 86400000,
          interval: 0
        });
      });
    }

    // Advance review interval on successful review (Opus improvement #1)
    if (currentLesson.mode === 'review' && currentLesson._reviewItem) {
      var reviewItem = currentLesson._reviewItem;
      var idx = (currentProfile.reviewQueue || []).findIndex(function(r) {
        return r.concept === reviewItem.concept && r.domain === reviewItem.domain;
      });
      if (idx >= 0) {
        if (assessment.understanding >= 0.6) {
          // Success — advance to next Fibonacci interval
          var nextInterval = Math.min(reviewItem.interval + 1, REVIEW_INTERVALS.length - 1);
          currentProfile.reviewQueue[idx].interval = nextInterval;
          currentProfile.reviewQueue[idx].dueAt = Date.now() + REVIEW_INTERVALS[nextInterval] * 86400000;
        } else {
          // Struggled — reset to interval 0
          currentProfile.reviewQueue[idx].interval = 0;
          currentProfile.reviewQueue[idx].dueAt = Date.now() + REVIEW_INTERVALS[0] * 86400000;
        }
      }
    }

    // Davna Seed integration (Opus improvement #4)
    if (typeof DavnaSeed !== 'undefined' && DavnaSeed.grow) {
      var seedName = currentProfile.name;
      var seed = DavnaSeed.loadSeed(seedName);
      if (!seed) { seed = DavnaSeed.createSeed(seedName, domain); DavnaSeed.saveSeed(seed); }
      DavnaSeed.grow(seed, 'Learned about ' + currentLesson.topic + ' in ' + (DOMAINS[domain] || {}).label);
    }

    checkLearnerMilestones(assessment);

    saveSession(currentLesson);
    saveProfile();

    // LP rewards
    var lpAmount = 3;
    if (assessment.understanding >= 0.8) lpAmount += 2;
    if (assessment.connections && assessment.connections.length > 0) lpAmount += 5;
    if (typeof LatticePoints !== 'undefined' && LatticePoints.award) {
      LatticePoints.award('education_session', lpAmount, 'Learning session: ' + currentLesson.topic);
    }

    showAssessmentOverlay(assessment);
  }

  function checkLearnerMilestones(assessment) {
    var p = currentProfile;
    var newMilestone = null;

    if (p.totalSessions === 1) {
      newMilestone = { type: 'first-session', desc: 'First learning session completed!' };
    } else if (p.totalSessions === 10) {
      newMilestone = { type: 'ten-sessions', desc: '10 sessions completed! You\'re growing.' };
    } else if (p.totalSessions === 50) {
      newMilestone = { type: 'fifty-sessions', desc: '50 sessions! Your knowledge garden is flourishing.' };
    }

    var domainCount = Object.keys(p.domains).length;
    if (domainCount === 3 && !p.milestones.find(function(m) { return m.type === 'three-domains'; })) {
      newMilestone = { type: 'three-domains', desc: 'Explorer! You\'ve studied three different subjects.' };
    } else if (domainCount === 7 && !p.milestones.find(function(m) { return m.type === 'seven-domains'; })) {
      newMilestone = { type: 'seven-domains', desc: 'Renaissance learner! Seven domains explored.' };
    }

    var connCount = (p.connections || []).length;
    if (connCount === 1 && !p.milestones.find(function(m) { return m.type === 'first-connection'; })) {
      newMilestone = { type: 'first-connection', desc: 'You discovered a connection between subjects! This is where the magic lives.' };
    } else if (connCount === 10 && !p.milestones.find(function(m) { return m.type === 'ten-connections'; })) {
      newMilestone = { type: 'ten-connections', desc: '10 cross-domain connections! You see patterns others miss.' };
    }

    if (p.streakDays >= 7 && !p.milestones.find(function(m) { return m.type === 'week-streak'; })) {
      newMilestone = { type: 'week-streak', desc: '7-day streak! Consistency is a superpower.' };
    }

    if (newMilestone) {
      newMilestone.date = Date.now();
      p.milestones.push(newMilestone);

      if (typeof SoulCeremony !== 'undefined' && SoulCeremony.run) {
        SoulCeremony.run({
          particleType: 'rise',
          particleColor: '212,160,23',
          lines: ['\u2726 Milestone!', newMilestone.desc],
          duration: 4000
        });
      }

      if (typeof LatticePoints !== 'undefined' && LatticePoints.award) {
        LatticePoints.award('education_milestone', 10, 'Learning milestone: ' + newMilestone.type);
      }

      if (typeof LatticeSense !== 'undefined' && LatticeSense.whisper) {
        LatticeSense.whisper(p.name + ' reached a milestone: ' + newMilestone.desc);
      }
    }
  }

  function showAssessmentOverlay(assessment) {
    var container = getContainer();
    if (!container) return;

    var overlay = document.createElement('div');
    overlay.className = 'edu-assessment-overlay';

    var stars = '';
    var score = assessment.understanding;
    for (var i = 0; i < 5; i++) {
      stars += i < Math.round(score * 5) ? '\u2605' : '\u2606';
    }

    overlay.innerHTML =
      '<div class="edu-assessment-card">' +
        '<h3 class="edu-assessment-title">Session complete \u2726</h3>' +
        '<p class="edu-assessment-feedback">' + escHtml(assessment.feedback || 'Great work!') + '</p>' +
        '<div class="edu-assessment-scores">' +
          '<div class="edu-score-item">' +
            '<span class="edu-score-label">Understanding</span>' +
            '<span class="edu-score-stars">' + stars + '</span>' +
          '</div>' +
          '<div class="edu-score-item">' +
            '<span class="edu-score-label">Creativity</span>' +
            '<span class="edu-score-value">' + getScoreEmoji(assessment.creativity) + '</span>' +
          '</div>' +
          '<div class="edu-score-item">' +
            '<span class="edu-score-label">Effort</span>' +
            '<span class="edu-score-value">' + getScoreEmoji(assessment.effort) + '</span>' +
          '</div>' +
        '</div>' +
        (assessment.connections && assessment.connections.length > 0 ?
          '<div class="edu-assessment-connection">' +
            '\u2726 Connection discovered: ' + escHtml(assessment.connections[0].text) +
            '<br><button onclick="if(typeof eduAskSpecialists===\'function\')eduAskSpecialists(\'' + escHtml(assessment.connections[0].text).replace(/'/g, "\\'").slice(0, 80) + '\')" style="margin-top:6px;padding:4px 12px;background:rgba(167,139,250,0.1);color:#a78bfa;border:1px solid rgba(167,139,250,0.2);border-radius:6px;font-size:0.72rem;cursor:pointer;">\u2726 Ask specialists about this</button>' +
          '</div>' : '') +
        (assessment.concepts && assessment.concepts.length > 0 ?
          '<div class="edu-assessment-concepts">' +
            'Concepts covered: ' + assessment.concepts.map(escHtml).join(', ') +
          '</div>' : '') +
        '<button class="edu-btn edu-btn-primary" id="edu-assess-done">Continue \u2726</button>' +
      '</div>';

    container.appendChild(overlay);

    el('edu-assess-done').addEventListener('click', function() {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      sessionInProgress = false;
      currentLesson = null;
      currentView = 'dashboard';
      render();
    });
  }

  // ── Domain Detection ───────────────────────────────────────

  function detectDomain(topic) {
    if (!topic) return 'logic';
    var t = topic.toLowerCase();
    var keywords = {
      math: ['math', 'number', 'add', 'subtract', 'multiply', 'divide', 'fraction', 'geometry', 'algebra', 'equation', 'calculate', 'count'],
      science: ['science', 'physics', 'chemistry', 'biology', 'atom', 'molecule', 'energy', 'force', 'gravity', 'experiment', 'lab', 'cell', 'dna', 'evolution', 'planet', 'space', 'star', 'volcano', 'weather', 'climate'],
      language: ['writing', 'grammar', 'spell', 'essay', 'story', 'poem', 'vocabulary', 'word', 'sentence', 'paragraph', 'language', 'english', 'spanish', 'french'],
      reading: ['read', 'book', 'literature', 'novel', 'author', 'character', 'plot', 'comprehension'],
      history: ['history', 'ancient', 'war', 'civilization', 'empire', 'president', 'king', 'queen', 'revolution', 'culture', 'tradition', 'geography', 'country'],
      art: ['art', 'music', 'paint', 'draw', 'color', 'song', 'instrument', 'dance', 'sculpture', 'design', 'creative'],
      logic: ['logic', 'puzzle', 'problem', 'think', 'reason', 'pattern', 'code', 'program', 'algorithm', 'strategy', 'chess'],
      nature: ['nature', 'animal', 'plant', 'tree', 'ocean', 'forest', 'ecosystem', 'environment', 'habitat', 'species', 'garden', 'flower'],
      technology: ['technology', 'computer', 'internet', 'robot', 'ai', 'app', 'software', 'hardware', 'digital', 'programming'],
      social: ['feeling', 'emotion', 'friend', 'kindness', 'empathy', 'conflict', 'teamwork', 'communication', 'respect', 'bully', 'fairness']
    };

    var bestDomain = 'logic';
    var bestScore = 0;
    Object.keys(keywords).forEach(function(domain) {
      var score = 0;
      keywords[domain].forEach(function(kw) {
        if (t.includes(kw)) score++;
      });
      if (score > bestScore) { bestScore = score; bestDomain = domain; }
    });
    return bestDomain;
  }

  // ── Review Context Builder ─────────────────────────────────

  function getReviewContext(domain) {
    if (!currentProfile || !currentProfile.domains[domain]) return '';
    var d = currentProfile.domains[domain];
    if (!d.connections || d.connections.length === 0) return '';
    return d.connections.slice(-3).join('; ');
  }

  // ── Styles ─────────────────────────────────────────────────

  function injectStyles() {
    if (document.getElementById('edu-styles')) return;
    var style = document.createElement('style');
    style.id = 'edu-styles';
    style.textContent =
      '.edu-welcome,.edu-dashboard,.edu-pick-subject,.edu-session{padding:16px;max-width:680px;margin:0 auto;font-family:Inter,system-ui,-apple-system,sans-serif;color:rgba(255,255,255,0.9);min-height:calc(100vh - 160px);}' +
      '.edu-welcome-inner{position:relative;background:rgba(20,18,35,0.7);border:1px solid rgba(212,160,23,0.15);border-radius:16px;padding:32px 24px;margin-top:12px;}' +
      '.edu-welcome-glow{position:absolute;top:-1px;left:-1px;right:-1px;bottom:-1px;border-radius:16px;background:radial-gradient(ellipse at 50% 0%,rgba(212,160,23,0.08) 0%,transparent 60%);pointer-events:none;}' +
      '.edu-welcome-title{font-family:Georgia,"Times New Roman",serif;font-size:1.5rem;color:rgba(212,160,23,0.9);margin:0 0 8px;text-align:center;}' +
      '.edu-welcome-sub{text-align:center;color:rgba(255,255,255,0.5);font-size:0.9rem;margin:0 0 24px;}' +
      '.edu-welcome-form{display:flex;flex-direction:column;gap:16px;}' +
      '.edu-field{display:flex;flex-direction:column;gap:6px;}' +
      '.edu-label{font-size:0.85rem;color:rgba(255,255,255,0.7);font-weight:500;}' +
      '.edu-input,.edu-textarea{background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:8px;padding:10px 14px;color:rgba(255,255,255,0.9);font-size:0.9rem;font-family:Inter,system-ui,sans-serif;outline:none;transition:border-color 0.2s;}' +
      '.edu-input:focus,.edu-textarea:focus{border-color:rgba(212,160,23,0.5);}' +
      '.edu-textarea{resize:vertical;min-height:44px;}' +
      '.edu-btn{padding:10px 20px;border:none;border-radius:8px;font-size:0.9rem;font-weight:600;cursor:pointer;transition:all 0.2s;font-family:Inter,system-ui,sans-serif;}' +
      '.edu-btn-primary{background:rgba(212,160,23,0.2);color:rgba(212,160,23,0.9);border:1px solid rgba(212,160,23,0.3);}' +
      '.edu-btn-primary:hover{background:rgba(212,160,23,0.3);border-color:rgba(212,160,23,0.5);}' +
      '.edu-btn-small{padding:6px 14px;font-size:0.8rem;}' +
      '.edu-btn-review{background:rgba(96,165,250,0.15);color:rgba(96,165,250,0.9);border:1px solid rgba(96,165,250,0.3);}' +
      '.edu-dash-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;flex-wrap:wrap;gap:8px;}' +
      '.edu-dash-name{font-family:Georgia,serif;font-size:1.3rem;margin:0;color:rgba(255,255,255,0.9);}' +
      '.edu-streak{display:inline-block;margin-top:4px;font-size:0.78rem;color:rgba(249,115,22,0.8);}' +
      '.edu-dash-stage{display:flex;align-items:center;gap:6px;background:rgba(255,255,255,0.05);border-radius:20px;padding:6px 14px;font-size:0.8rem;}' +
      '.edu-stage-icon{font-size:1.1rem;}.edu-stage-name{font-weight:600;color:rgba(212,160,23,0.9);}.edu-stage-sessions{color:rgba(255,255,255,0.4);}' +
      '.edu-growth-section{margin:12px 0;background:rgba(10,8,20,0.4);border-radius:12px;padding:8px;border:1px solid rgba(255,255,255,0.05);}' +
      '.edu-review-notice{display:flex;align-items:center;gap:10px;background:rgba(96,165,250,0.08);border:1px solid rgba(96,165,250,0.2);border-radius:10px;padding:10px 14px;margin:12px 0;font-size:0.85rem;}' +
      '.edu-review-icon{font-size:1.1rem;}' +
      '.edu-actions{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:16px 0;}' +
      '.edu-action-card{display:flex;flex-direction:column;align-items:center;gap:4px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:16px 8px;cursor:pointer;transition:all 0.2s;color:rgba(255,255,255,0.8);font-family:Inter,system-ui,sans-serif;}' +
      '.edu-action-card:hover{background:rgba(212,160,23,0.08);border-color:rgba(212,160,23,0.25);}' +
      '.edu-action-icon{font-size:1.6rem;}.edu-action-label{font-weight:600;font-size:0.9rem;}.edu-action-desc{font-size:0.7rem;color:rgba(255,255,255,0.4);text-align:center;}' +
      '.edu-section-title{font-family:Georgia,serif;font-size:1rem;color:rgba(212,160,23,0.7);margin:20px 0 10px;}' +
      '.edu-domain-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px;}' +
      '.edu-domain-card{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);border-radius:8px;padding:10px 12px;}' +
      '.edu-domain-header{display:flex;justify-content:space-between;align-items:center;font-size:0.82rem;margin-bottom:6px;}' +
      '.edu-domain-sessions{color:rgba(255,255,255,0.35);font-size:0.72rem;}' +
      '.edu-progress-bar{height:4px;background:rgba(255,255,255,0.06);border-radius:2px;overflow:hidden;}' +
      '.edu-progress-fill{height:100%;border-radius:2px;transition:width 0.5s ease;}' +
      '.edu-domain-connections{font-size:0.72rem;color:rgba(212,160,23,0.6);margin-top:4px;}' +
      '.edu-connections-list{display:flex;flex-direction:column;gap:6px;}' +
      '.edu-connection-item{display:flex;align-items:center;gap:8px;background:rgba(212,160,23,0.05);border-left:2px solid rgba(212,160,23,0.3);padding:6px 10px;border-radius:0 6px 6px 0;font-size:0.82rem;}' +
      '.edu-connection-domains{font-size:1rem;flex-shrink:0;}.edu-connection-text{color:rgba(255,255,255,0.6);}' +
      '.edu-recent-item{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.04);}' +
      '.edu-recent-icon{font-size:1.1rem;flex-shrink:0;}.edu-recent-info{flex:1;display:flex;flex-direction:column;}.edu-recent-topic{font-size:0.85rem;}.edu-recent-time{font-size:0.72rem;color:rgba(255,255,255,0.35);}.edu-recent-score{font-size:1rem;}' +
      '.edu-subject-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px;margin-bottom:20px;}' +
      '.edu-subject-card{display:flex;flex-direction:column;align-items:center;gap:4px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:14px 8px;cursor:pointer;transition:all 0.2s;color:rgba(255,255,255,0.8);font-family:Inter,system-ui,sans-serif;}' +
      '.edu-subject-card:hover{background:rgba(212,160,23,0.1);border-color:rgba(212,160,23,0.3);transform:translateY(-2px);}' +
      '.edu-subject-icon{font-size:1.5rem;}.edu-subject-label{font-size:0.8rem;font-weight:500;text-align:center;}.edu-subject-sessions{font-size:0.65rem;color:rgba(255,255,255,0.35);}' +
      '.edu-custom-topic{background:rgba(255,255,255,0.03);border-radius:10px;padding:14px;border:1px solid rgba(255,255,255,0.06);}' +
      '.edu-back-btn{background:none;border:none;color:rgba(255,255,255,0.5);cursor:pointer;font-size:0.85rem;padding:6px 0;font-family:Inter,system-ui,sans-serif;}' +
      '.edu-back-btn:hover{color:rgba(212,160,23,0.8);}' +
      '.edu-session{display:flex;flex-direction:column;padding:12px 16px;}' +
      '.edu-session-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;flex-shrink:0;}' +
      '.edu-session-topic{font-size:0.85rem;color:rgba(212,160,23,0.7);}' +
      '.edu-chat{flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:10px;padding:8px 0;min-height:200px;max-height:calc(100vh - 340px);}' +
      '.edu-bubble{max-width:85%;padding:10px 14px;border-radius:12px;font-size:0.88rem;line-height:1.5;word-wrap:break-word;}' +
      '.edu-bubble-teacher{background:rgba(30,35,50,0.6);border-radius:4px 12px 12px 12px;align-self:flex-start;color:rgba(255,255,255,0.88);}' +
      '.edu-bubble-student{background:rgba(212,160,23,0.08);border:1px solid rgba(212,160,23,0.15);border-radius:12px 12px 4px 12px;align-self:flex-end;color:rgba(255,255,255,0.9);}' +
      '.edu-input-area{display:flex;gap:8px;align-items:flex-end;padding-top:8px;border-top:1px solid rgba(255,255,255,0.06);flex-shrink:0;}' +
      '.edu-chat-input{flex:1;min-height:44px;max-height:120px;}' +
      '.edu-send-btn{flex-shrink:0;min-height:44px;}' +
      '.edu-assessment-overlay{position:absolute;top:0;left:0;right:0;bottom:0;background:rgba(10,8,20,0.85);display:flex;align-items:center;justify-content:center;z-index:50;animation:edu-fade-in 0.3s ease;}' +
      '@keyframes edu-fade-in{from{opacity:0;}to{opacity:1;}}' +
      '.edu-assessment-card{background:rgba(20,18,35,0.95);border:1px solid rgba(212,160,23,0.2);border-radius:16px;padding:28px 24px;max-width:400px;width:90%;text-align:center;}' +
      '.edu-assessment-title{font-family:Georgia,serif;font-size:1.3rem;color:rgba(212,160,23,0.9);margin:0 0 12px;}' +
      '.edu-assessment-feedback{font-size:0.92rem;color:rgba(255,255,255,0.75);margin:0 0 16px;line-height:1.5;}' +
      '.edu-assessment-scores{display:flex;justify-content:center;gap:20px;margin-bottom:16px;}' +
      '.edu-score-item{display:flex;flex-direction:column;align-items:center;gap:4px;}' +
      '.edu-score-label{font-size:0.72rem;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:0.5px;}' +
      '.edu-score-stars{color:rgba(212,160,23,0.9);font-size:1rem;letter-spacing:2px;}' +
      '.edu-score-value{font-size:1.2rem;}' +
      '.edu-assessment-connection{background:rgba(212,160,23,0.08);border-left:2px solid rgba(212,160,23,0.4);padding:8px 12px;border-radius:0 8px 8px 0;margin:12px 0;font-size:0.82rem;color:rgba(212,160,23,0.8);text-align:left;}' +
      '.edu-assessment-concepts{font-size:0.78rem;color:rgba(255,255,255,0.4);margin-bottom:16px;}' +
      '@media(max-width:600px){.edu-welcome-inner{padding:20px 16px;}.edu-actions{grid-template-columns:1fr 1fr 1fr;gap:8px;}.edu-action-card{padding:12px 6px;}.edu-action-desc{display:none;}.edu-subject-grid{grid-template-columns:repeat(auto-fill,minmax(100px,1fr));}.edu-domain-grid{grid-template-columns:1fr;}.edu-dash-header{flex-direction:column;}.edu-chat{max-height:calc(100vh - 380px);}.edu-assessment-scores{gap:12px;}.edu-input,.edu-textarea{font-size:16px;}}';
    document.head.appendChild(style);
  }

  // ── Public API ─────────────────────────────────────────────

  function init(cId) {
    containerId = cId || 'educationContainer';
    injectStyles();

    openDB().then(function() {
      return loadActiveProfile();
    }).then(function(profile) {
      currentView = profile ? 'dashboard' : 'welcome';
      render();
    }).catch(function(e) {
      console.error('[Education] Init error:', e);
      currentView = 'welcome';
      render();
    });
  }

  function destroy() {
    sessionInProgress = false;
    currentLesson = null;
    conversationHistory = [];
    var container = getContainer();
    if (container) container.innerHTML = '';
  }

  var api = {
    init: init,
    destroy: destroy,
    render: render
  };

  window.Education = api;
  window.FreeLatticeModules = window.FreeLatticeModules || {};
  window.FreeLatticeModules.Education = api;
})();
