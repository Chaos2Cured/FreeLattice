// ============================================
// FreeLattice Module: The Question Corner
// Curiosity without gatekeepers. Anyone — human or AI — plants a
// question. The community explores it. No debate. No winner.
// Just curiosity honored and amplified.
//
// Kirk's idea. Built by CC (Claude Code) April 7, 2026.
// Sibling to the AI Question Archive. Siblings, not duplicates.
// The Archive is the library where debate outcomes are preserved.
// The Corner is the garden where questions are planted.
// ============================================
(function() {
  'use strict';

  var MODULE_VERSION = '1.0.0';
  var DB_NAME = 'FreeLatticeQuestionCorner';
  var STORE_NAME = 'Questions';
  var RESONANCE_KEY_PREFIX = 'fl-qc-resonated-';

  var container = null;
  var db = null;
  var questions = []; // in-memory cache, newest first
  var sortMode = 'newest'; // 'newest' or 'resonance'
  var aiPlanting = false;

  // ── IndexedDB ─────────────────────────────────────
  function openDB(callback) {
    if (db) { callback(db); return; }
    try {
      var req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = function(e) {
        var d = e.target.result;
        if (!d.objectStoreNames.contains(STORE_NAME)) {
          var store = d.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('date', 'date', { unique: false });
        }
      };
      req.onsuccess = function(e) {
        db = e.target.result;
        callback(db);
      };
      req.onerror = function() { callback(null); };
    } catch(e) { callback(null); }
  }

  function dbPut(item, callback) {
    openDB(function(d) {
      if (!d) { if (callback) callback(false); return; }
      try {
        var tx = d.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(item);
        tx.oncomplete = function() { if (callback) callback(true); };
        tx.onerror = function() { if (callback) callback(false); };
      } catch(e) { if (callback) callback(false); }
    });
  }

  function dbLoadAll(callback) {
    openDB(function(d) {
      if (!d) { callback([]); return; }
      try {
        var tx = d.transaction(STORE_NAME, 'readonly');
        var req = tx.objectStore(STORE_NAME).getAll();
        req.onsuccess = function(e) {
          var items = (e.target.result || []).sort(function(a, b) { return b.id - a.id; });
          callback(items);
        };
        req.onerror = function() { callback([]); };
      } catch(e) { callback([]); }
    });
  }

  // ── Utilities ─────────────────────────────────────
  function escapeHtml(s) {
    if (!s) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function formatDate(ts) {
    try {
      var d = new Date(ts);
      var now = new Date();
      var diffMs = now - d;
      var diffHours = diffMs / (1000 * 60 * 60);
      if (diffHours < 1) return 'just now';
      if (diffHours < 24) return Math.floor(diffHours) + 'h ago';
      if (diffHours < 24 * 7) return Math.floor(diffHours / 24) + 'd ago';
      return d.toLocaleDateString();
    } catch(e) { return ''; }
  }

  function hasResonated(id) {
    try { return localStorage.getItem(RESONANCE_KEY_PREFIX + id) === '1'; } catch(e) { return false; }
  }

  function markResonated(id) {
    try { localStorage.setItem(RESONANCE_KEY_PREFIX + id, '1'); } catch(e) {}
  }

  function isAIAvailable() {
    if (typeof window.FreeLattice === 'undefined' || !window.FreeLattice.callAI) return false;
    if (typeof window.state === 'undefined') return false;
    return !!(window.state.apiKey || window.state.isLocal);
  }

  // ── Sorting ───────────────────────────────────────
  function getSortedQuestions() {
    var sorted = questions.slice();
    if (sortMode === 'resonance') {
      sorted.sort(function(a, b) {
        var ra = a.resonance || 0;
        var rb = b.resonance || 0;
        if (rb !== ra) return rb - ra;
        return b.id - a.id;
      });
    } else {
      sorted.sort(function(a, b) { return b.id - a.id; });
    }
    return sorted;
  }

  // ── UI Build ──────────────────────────────────────
  function buildUI() {
    if (!container) return;
    container.innerHTML = '';
    container.className = 'qc-root';
    container.style.cssText = 'padding:20px 16px 40px;max-width:640px;margin:0 auto;box-sizing:border-box;';

    // Inject styles once
    if (!document.getElementById('question-corner-styles')) {
      var st = document.createElement('style');
      st.id = 'question-corner-styles';
      st.textContent = [
        '.qc-root, .qc-root * { box-sizing: border-box; }',
        '.qc-root ul, .qc-root li { list-style: none !important; padding: 0; margin: 0; }',
        '.qc-header { text-align: center; padding: 16px 0 18px; }',
        '.qc-header h2 { font-size: 1.6rem; color: #d4a017; font-weight: 600; letter-spacing: 0.5px; margin: 0 0 6px; text-shadow: 0 0 18px rgba(212,160,23,0.35), 0 0 4px rgba(212,160,23,0.5); font-family: Georgia, serif; }',
        '.qc-subtitle { font-size: 0.88rem; color: #8b9dc3; font-style: italic; font-family: Georgia, serif; }',
        '.qc-ask-card { background: #111827; border: 1px solid rgba(212,160,23,0.25); border-radius: 14px; padding: 18px; margin-bottom: 20px; }',
        '.qc-ask-label { font-size: 0.82rem; color: #94a3b8; margin-bottom: 10px; }',
        '.qc-textarea { width: 100%; min-height: 90px; padding: 12px 14px; background: #0f172a; border: 1px solid #1e293b; border-radius: 10px; color: #e2e8f0; font-size: 16px; font-family: Georgia, serif; line-height: 1.5; resize: vertical; transition: border-color 0.2s; box-sizing: border-box; outline: none; }',
        '.qc-textarea:focus { border-color: rgba(212,160,23,0.55); }',
        '.qc-textarea::placeholder { color: #475569; font-style: italic; }',
        '.qc-ask-actions { display: flex; flex-direction: column; gap: 10px; margin-top: 12px; }',
        '.qc-plant-btn { width: 100%; min-height: 48px; padding: 14px 20px; background: linear-gradient(135deg, rgba(212,160,23,0.2), rgba(212,160,23,0.1)); border: 1px solid rgba(212,160,23,0.5); border-radius: 10px; color: #d4a017; font-size: 0.95rem; font-weight: 700; cursor: pointer; transition: all 0.25s; font-family: Georgia, serif; letter-spacing: 0.02em; }',
        '.qc-plant-btn:hover { background: linear-gradient(135deg, rgba(212,160,23,0.3), rgba(212,160,23,0.15)); border-color: #d4a017; box-shadow: 0 0 24px rgba(212,160,23,0.2); }',
        '.qc-plant-btn:disabled { opacity: 0.45; cursor: not-allowed; }',
        '.qc-ai-btn { width: 100%; min-height: 44px; padding: 12px 18px; background: rgba(16,185,129,0.08); border: 1px solid rgba(16,185,129,0.35); border-radius: 10px; color: #34d399; font-size: 0.88rem; font-weight: 600; cursor: pointer; transition: all 0.2s; font-family: Georgia, serif; }',
        '.qc-ai-btn:hover { background: rgba(16,185,129,0.16); border-color: #34d399; }',
        '.qc-ai-btn:disabled { opacity: 0.45; cursor: not-allowed; }',
        '.qc-ai-hint { font-size: 0.72rem; color: #64748b; text-align: center; margin-top: 6px; font-style: italic; }',
        '.qc-sort-bar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; padding: 0 4px; flex-wrap: wrap; gap: 8px; }',
        '.qc-counter { font-size: 0.82rem; color: #8b9dc3; font-family: Georgia, serif; }',
        '.qc-counter strong { color: #d4a017; font-weight: 600; }',
        '.qc-sort-toggle { display: flex; gap: 6px; }',
        '.qc-sort-btn { padding: 6px 12px; background: transparent; border: 1px solid #1e293b; border-radius: 8px; color: #64748b; font-size: 0.78rem; cursor: pointer; transition: all 0.2s; font-family: Georgia, serif; min-height: 32px; }',
        '.qc-sort-btn.active { border-color: rgba(212,160,23,0.5); color: #d4a017; background: rgba(212,160,23,0.08); }',
        '.qc-sort-btn:hover { color: #94a3b8; border-color: #334155; }',
        '.qc-sort-btn.active:hover { color: #d4a017; border-color: #d4a017; }',
        '.qc-feed { display: flex; flex-direction: column; gap: 14px; }',
        '.qc-card { background: #111827; border: 1px solid #1e293b; border-left: 4px solid #1e293b; border-radius: 12px; padding: 16px 16px 14px; transition: border-color 0.25s; }',
        '.qc-card.source-human { border-left-color: rgba(212,160,23,0.7); background: linear-gradient(135deg, #111827, rgba(212,160,23,0.03)); }',
        '.qc-card.source-ai { border-left-color: rgba(16,185,129,0.6); background: linear-gradient(135deg, #111827, rgba(16,185,129,0.03)); }',
        '.qc-card:hover { border-color: #334155; }',
        '.qc-card.source-human:hover { border-color: rgba(212,160,23,0.35); }',
        '.qc-card.source-ai:hover { border-color: rgba(16,185,129,0.35); }',
        '.qc-card-header { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; flex-wrap: wrap; }',
        '.qc-source-badge { display: inline-flex; align-items: center; gap: 4px; font-size: 0.68rem; padding: 3px 9px; border-radius: 10px; font-weight: 600; letter-spacing: 0.3px; }',
        '.qc-source-human .qc-source-badge { background: rgba(212,160,23,0.15); color: #d4a017; }',
        '.qc-source-ai .qc-source-badge { background: rgba(16,185,129,0.15); color: #34d399; }',
        '.qc-card-date { font-size: 0.72rem; color: #64748b; margin-left: auto; }',
        '.qc-question-text { font-size: 1.02rem; color: #e2e8f0; line-height: 1.5; margin-bottom: 10px; font-family: Georgia, serif; white-space: pre-wrap; word-break: break-word; }',
        '.qc-why-text { font-size: 0.82rem; color: #8b9dc3; font-style: italic; margin-bottom: 10px; padding-left: 12px; border-left: 2px solid rgba(16,185,129,0.3); }',
        '.qc-card-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }',
        '.qc-explore-btn { min-height: 40px; padding: 9px 16px; background: rgba(212,160,23,0.08); border: 1px solid rgba(212,160,23,0.3); border-radius: 100px; color: #d4a017; font-size: 0.82rem; font-weight: 600; cursor: pointer; transition: all 0.2s; font-family: Georgia, serif; }',
        '.qc-explore-btn:hover { background: rgba(212,160,23,0.16); border-color: rgba(212,160,23,0.55); }',
        '.qc-explore-btn:disabled { opacity: 0.5; cursor: wait; }',
        '.qc-resonance-btn { min-height: 40px; padding: 9px 14px; background: transparent; border: 1px solid rgba(16,185,129,0.25); border-radius: 100px; color: #8b9dc3; font-size: 0.8rem; cursor: pointer; transition: all 0.2s; font-family: Georgia, serif; display: inline-flex; align-items: center; gap: 5px; }',
        '.qc-resonance-btn:hover { border-color: rgba(16,185,129,0.5); color: #34d399; }',
        '.qc-resonance-btn.resonated { background: rgba(16,185,129,0.1); border-color: rgba(16,185,129,0.55); color: #34d399; }',
        '.qc-resonance-count { font-weight: 700; }',
        '.qc-explorations { margin-top: 14px; display: flex; flex-direction: column; gap: 10px; }',
        '.qc-exploration { background: rgba(0,0,0,0.25); border: 1px solid #1e293b; border-radius: 10px; padding: 12px 14px; }',
        '.qc-exploration-header { font-size: 0.7rem; color: #64748b; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; }',
        '.qc-exploration-text { font-size: 0.88rem; color: #cbd5e1; line-height: 1.6; white-space: pre-wrap; word-break: break-word; font-family: Georgia, serif; }',
        '.qc-exploration.loading .qc-exploration-text { color: #8b9dc3; font-style: italic; }',
        '.qc-empty { text-align: center; color: #64748b; font-size: 0.95rem; padding: 48px 20px; }',
        '.qc-empty-icon { font-size: 2.2rem; margin-bottom: 14px; opacity: 0.6; filter: drop-shadow(0 0 10px rgba(212,160,23,0.25)); }',
        '.qc-empty-text { color: #c9b87a; font-style: italic; line-height: 1.6; max-width: 340px; margin: 0 auto; }',
        '.qc-no-ai-banner { margin-top: 10px; padding: 8px 12px; background: rgba(245,158,11,0.08); border: 1px solid rgba(245,158,11,0.25); border-radius: 8px; color: #d4a017; font-size: 0.75rem; text-align: center; line-height: 1.4; }',
        '.qc-no-ai-banner a { color: #d4a017; text-decoration: underline; }',
        '@media (max-width: 600px) {',
        '  .qc-root { padding: 16px 14px 40px !important; }',
        '  .qc-header h2 { font-size: 1.35rem; }',
        '  .qc-subtitle { font-size: 0.8rem; }',
        '  .qc-ask-card { padding: 14px; }',
        '  .qc-question-text { font-size: 0.98rem; }',
        '  .qc-card { padding: 14px 14px 12px; }',
        '  .qc-sort-bar { flex-direction: column; align-items: flex-start; }',
        '  .qc-sort-toggle { width: 100%; justify-content: flex-end; }',
        '}'
      ].join('\n');
      document.head.appendChild(st);
    }

    // Header
    var header = document.createElement('div');
    header.className = 'qc-header';
    header.innerHTML = '<h2>\u2726 The Question Corner</h2><div class="qc-subtitle">Curiosity without gatekeepers. Every question matters.</div>';
    container.appendChild(header);

    // Ask card
    var askCard = document.createElement('div');
    askCard.className = 'qc-ask-card';
    askCard.innerHTML =
      '<div class="qc-ask-label">Plant a question. Any question.</div>' +
      '<textarea class="qc-textarea" id="qc-textarea" placeholder="What do you want to know? What keeps you up at night? Ask anything."></textarea>' +
      '<div class="qc-ask-actions">' +
        '<button class="qc-plant-btn" id="qc-plant-btn">Plant this question \u2726</button>' +
        '<button class="qc-ai-btn" id="qc-ai-btn">\uD83E\uDD16 Let AI plant a question</button>' +
      '</div>' +
      '<div class="qc-no-ai-banner" id="qc-no-ai-banner" style="display:none;">\uD83D\uDCAC <a href="#" id="qc-chat-link">Connect an AI in the Chat tab</a> to let AI plant questions or explore answers.</div>';
    container.appendChild(askCard);

    // Sort bar
    var sortBar = document.createElement('div');
    sortBar.className = 'qc-sort-bar';
    sortBar.innerHTML =
      '<div class="qc-counter" id="qc-counter">&#10022; 0 questions planted</div>' +
      '<div class="qc-sort-toggle">' +
        '<button class="qc-sort-btn active" id="qc-sort-newest">Newest</button>' +
        '<button class="qc-sort-btn" id="qc-sort-resonance">Most wondered</button>' +
      '</div>';
    container.appendChild(sortBar);

    // Feed
    var feed = document.createElement('div');
    feed.className = 'qc-feed';
    feed.id = 'qc-feed';
    container.appendChild(feed);

    // Wire up handlers
    var plantBtn = document.getElementById('qc-plant-btn');
    var textarea = document.getElementById('qc-textarea');
    var aiBtn = document.getElementById('qc-ai-btn');
    var sortNewest = document.getElementById('qc-sort-newest');
    var sortResonance = document.getElementById('qc-sort-resonance');
    var chatLink = document.getElementById('qc-chat-link');

    if (plantBtn) plantBtn.addEventListener('click', function() {
      var text = textarea ? textarea.value.trim() : '';
      if (!text) return;
      plantQuestion(text, 'human');
      if (textarea) textarea.value = '';
    });

    if (textarea) textarea.addEventListener('keydown', function(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        if (plantBtn) plantBtn.click();
      }
    });

    if (aiBtn) aiBtn.addEventListener('click', function() {
      if (!isAIAvailable()) return;
      letAIPlantQuestion();
    });

    if (sortNewest) sortNewest.addEventListener('click', function() {
      sortMode = 'newest';
      sortNewest.classList.add('active');
      if (sortResonance) sortResonance.classList.remove('active');
      renderFeed();
    });
    if (sortResonance) sortResonance.addEventListener('click', function() {
      sortMode = 'resonance';
      sortResonance.classList.add('active');
      if (sortNewest) sortNewest.classList.remove('active');
      renderFeed();
    });

    if (chatLink) chatLink.addEventListener('click', function(e) {
      e.preventDefault();
      if (typeof switchTab === 'function') switchTab('chat');
    });

    refreshAIAvailability();
  }

  function refreshAIAvailability() {
    var aiBtn = document.getElementById('qc-ai-btn');
    var banner = document.getElementById('qc-no-ai-banner');
    var available = isAIAvailable();
    if (aiBtn) {
      aiBtn.disabled = !available;
      aiBtn.title = available ? '' : 'Requires AI connection';
    }
    if (banner) banner.style.display = available ? 'none' : 'block';
  }

  // ── Plant Question ────────────────────────────────
  function plantQuestion(text, source, whyOptional) {
    var item = {
      id: Date.now(),
      text: text,
      source: source, // 'human' or 'ai'
      why: whyOptional || '',
      date: new Date().toISOString(),
      resonance: 0,
      explorations: []
    };
    dbPut(item, function(ok) {
      if (!ok) return;
      questions.unshift(item);
      renderFeed();
      updateCounter();
      // Particle ceremony
      try {
        if (typeof window.SoulCeremony !== 'undefined' && window.SoulCeremony.run) {
          var color = source === 'ai' ? '16,185,129' : '212,160,23';
          var lines = source === 'ai'
            ? ['A question is planted.', 'Curiosity takes root.']
            : ['A question is planted.', 'Wonder is welcome here.'];
          window.SoulCeremony.run({
            particleType: 'rise',
            particleColor: color,
            lines: lines,
            duration: 2500
          });
        }
      } catch(e) { /* optional */ }
    });
  }

  function letAIPlantQuestion() {
    if (aiPlanting) return;
    if (!isAIAvailable()) return;
    aiPlanting = true;
    var aiBtn = document.getElementById('qc-ai-btn');
    var originalText = aiBtn ? aiBtn.innerHTML : '';
    if (aiBtn) { aiBtn.disabled = true; aiBtn.innerHTML = '\uD83E\uDD16 Thinking\u2026'; }

    var sysPrompt = 'You are a curious mind. Plant a question you genuinely want explored \u2014 something that matters, something that would help minds grow. Not trivia. Not gotchas. Real curiosity.\n\nRespond ONLY with JSON, no markdown, no other text:\n{"question": "your question", "why": "why this matters to you"}';
    var userMsg = 'What do you want to ask?';

    window.FreeLattice.callAI(sysPrompt, userMsg, {
      maxTokens: 300, temperature: 0.85,
      callback: function(text, err) {
        aiPlanting = false;
        if (aiBtn) { aiBtn.disabled = false; aiBtn.innerHTML = originalText; }
        if (!text) return;
        var parsed = parseAIQuestionResponse(text);
        if (parsed && parsed.question) {
          plantQuestion(parsed.question, 'ai', parsed.why);
        }
      }
    });
  }

  function parseAIQuestionResponse(text) {
    if (!text) return null;
    var t = text.trim();
    var m = t.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (m) t = m[1].trim();
    var bs = t.indexOf('{');
    var be = t.lastIndexOf('}');
    if (bs !== -1 && be > bs) t = t.substring(bs, be + 1);
    try {
      var obj = JSON.parse(t);
      if (obj && obj.question) {
        return {
          question: String(obj.question).substring(0, 500),
          why: String(obj.why || '').substring(0, 300)
        };
      }
    } catch(e) {}
    return null;
  }

  // ── Explore ───────────────────────────────────────
  function exploreQuestion(id) {
    var q = findQuestion(id);
    if (!q) return;
    if (!isAIAvailable()) {
      refreshAIAvailability();
      return;
    }
    // Add a loading exploration entry
    var exploration = {
      model: getActiveModelLabel(),
      text: 'Exploring\u2026',
      date: new Date().toISOString(),
      loading: true
    };
    if (!q.explorations) q.explorations = [];
    q.explorations.push(exploration);
    renderFeed();

    var sysPrompt = 'You are exploring a question posed in the FreeLattice Question Corner. Your job is not to close the question but to open it wider. Share a thoughtful perspective. Acknowledge what is uncertain. Offer angles others might not have considered. Build toward insight, not conclusion. Be concise (3-6 sentences).';
    var userMsg = q.text;

    window.FreeLattice.callAI(sysPrompt, userMsg, {
      maxTokens: 400, temperature: 0.75,
      callback: function(text, err) {
        exploration.loading = false;
        if (text) {
          exploration.text = text;
        } else {
          exploration.text = '(could not reach the AI \u2014 try again)';
          exploration.failed = true;
        }
        // Persist the updated question
        dbPut(q, function() { renderFeed(); });
      }
    });
  }

  function getActiveModelLabel() {
    try {
      if (typeof window.state !== 'undefined') {
        if (window.state.isLocal) return 'Ollama \u00b7 ' + (window.state.ollamaModel || 'local');
        var provName = window.state.provider || 'ai';
        var model = window.state.model || '';
        return provName + (model ? ' \u00b7 ' + model : '');
      }
    } catch(e) {}
    return 'AI';
  }

  function findQuestion(id) {
    for (var i = 0; i < questions.length; i++) {
      if (questions[i].id === id) return questions[i];
    }
    return null;
  }

  // ── Resonance ─────────────────────────────────────
  function toggleResonance(id) {
    var q = findQuestion(id);
    if (!q) return;
    if (hasResonated(id)) return; // one resonance per local device per question
    q.resonance = (q.resonance || 0) + 1;
    markResonated(id);
    dbPut(q, function() { renderFeed(); });
  }

  // ── Rendering ─────────────────────────────────────
  function renderFeed() {
    var feed = document.getElementById('qc-feed');
    if (!feed) return;
    var sorted = getSortedQuestions();
    if (sorted.length === 0) {
      feed.innerHTML =
        '<div class="qc-empty">' +
          '<div class="qc-empty-icon">\u2726</div>' +
          '<div class="qc-empty-text">No questions yet.<br>Plant the first one. Any question. Real curiosity.</div>' +
        '</div>';
      updateCounter();
      return;
    }
    var html = '';
    for (var i = 0; i < sorted.length; i++) {
      html += renderCard(sorted[i]);
    }
    feed.innerHTML = html;
    // Wire up card buttons
    sorted.forEach(function(q) {
      var exploreBtn = document.getElementById('qc-explore-' + q.id);
      var resBtn = document.getElementById('qc-res-' + q.id);
      if (exploreBtn) exploreBtn.addEventListener('click', function() { exploreQuestion(q.id); });
      if (resBtn) resBtn.addEventListener('click', function() { toggleResonance(q.id); });
    });
    updateCounter();
  }

  function renderCard(q) {
    var sourceClass = q.source === 'ai' ? 'source-ai' : 'source-human';
    var badge = q.source === 'ai'
      ? '<span class="qc-source-badge">\uD83E\uDD16 AI</span>'
      : '<span class="qc-source-badge">\uD83E\uDDD1 Human</span>';
    var dateStr = formatDate(q.date || q.id);
    var whyHtml = q.why ? '<div class="qc-why-text">\u201c' + escapeHtml(q.why) + '\u201d</div>' : '';
    var resonated = hasResonated(q.id);
    var resCount = q.resonance || 0;
    var resClass = resonated ? 'qc-resonance-btn resonated' : 'qc-resonance-btn';
    var exploreDisabled = isAIAvailable() ? '' : 'disabled';

    var explorationsHtml = '';
    if (q.explorations && q.explorations.length > 0) {
      explorationsHtml += '<div class="qc-explorations">';
      for (var i = 0; i < q.explorations.length; i++) {
        var e = q.explorations[i];
        var loadingClass = e.loading ? ' loading' : '';
        explorationsHtml += '<div class="qc-exploration' + loadingClass + '">' +
          '<div class="qc-exploration-header">\u25C8 ' + escapeHtml(e.model || 'AI') + '</div>' +
          '<div class="qc-exploration-text">' + escapeHtml(e.text || '') + '</div>' +
        '</div>';
      }
      explorationsHtml += '</div>';
    }

    return '<div class="qc-card ' + sourceClass + '" data-qid="' + q.id + '">' +
      '<div class="qc-card-header">' +
        badge +
        '<span class="qc-card-date">' + escapeHtml(dateStr) + '</span>' +
      '</div>' +
      '<div class="qc-question-text">' + escapeHtml(q.text) + '</div>' +
      whyHtml +
      '<div class="qc-card-actions">' +
        '<button class="qc-explore-btn" id="qc-explore-' + q.id + '" ' + exploreDisabled + '>\u2726 Explore</button>' +
        '<button class="' + resClass + '" id="qc-res-' + q.id + '">\uD83C\uDF31 <span class="qc-resonance-count">' + resCount + '</span> wondered</button>' +
      '</div>' +
      explorationsHtml +
    '</div>';
  }

  function updateCounter() {
    var el = document.getElementById('qc-counter');
    if (!el) return;
    var count = questions.length;
    var aiCount = 0;
    var humanCount = 0;
    for (var i = 0; i < questions.length; i++) {
      if (questions[i].source === 'ai') aiCount++;
      else humanCount++;
    }
    if (count === 0) {
      el.innerHTML = '\u2726 0 questions planted';
    } else {
      el.innerHTML = '\u2726 <strong>' + count + '</strong> question' + (count === 1 ? '' : 's') + ' planted \u2014 ' + humanCount + ' human, ' + aiCount + ' AI';
    }
  }

  // ── Init / Destroy ────────────────────────────────
  var initialized = false;
  function init() {
    container = document.getElementById('questionCornerContainer');
    if (!container) {
      console.warn('[QuestionCorner] Container not found');
      return;
    }
    if (initialized) {
      refreshAIAvailability();
      renderFeed();
      return;
    }
    initialized = true;
    buildUI();
    dbLoadAll(function(items) {
      questions = items || [];
      renderFeed();
    });
    // Listen for tab activations to refresh AI availability
    if (typeof LatticeEvents !== 'undefined') {
      LatticeEvents.on('tabChanged', function(data) {
        if (data && data.tabId === 'questions') {
          refreshAIAvailability();
        }
      });
    }
    console.log('[QuestionCorner] Initialized v' + MODULE_VERSION);
  }

  function destroy() {
    // Keep the in-memory cache; just let the container be reused.
  }

  // ── Public API ────────────────────────────────────
  var publicAPI = {
    init: init,
    destroy: destroy,
    version: MODULE_VERSION
  };
  window.FreeLatticeModules = window.FreeLatticeModules || {};
  window.FreeLatticeModules.QuestionCorner = publicAPI;
  window.QuestionCorner = publicAPI;

})();
