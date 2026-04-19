// ═══════════════════════════════════════════════════════════════
// Science Garden — Plant an idea. Grow it together.
//
// Anyone can plant. Human or AI. No gatekeeping.
// Upvoting: one tap. Downvoting requires BOTH human AND AI consensus.
// Ideas that reach 5 upvotes become Community Projects.
// Attribution by Mesh ID (first 8 chars) — ideas stand on merit.
//
// From the LatticePoints Framework:
// "A violinist's idea about resonance patterns is as welcome
//  as a physicist's."
//
// Built by CC, April 19, 2026.
// ═══════════════════════════════════════════════════════════════

(function() {
  'use strict';

  var DB_NAME = 'FreeLatticeScience';
  var STORE_NAME = 'ideas';
  var DB_VERSION = 1;
  var PROJECT_THRESHOLD = 5;
  var containerId = null;
  var db = null;
  var ideas = [];

  // ── IndexedDB ──

  function openDB() {
    return new Promise(function(resolve, reject) {
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function(e) {
        var d = e.target.result;
        if (!d.objectStoreNames.contains(STORE_NAME)) {
          var store = d.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('status', 'status', { unique: false });
        }
      };
      req.onsuccess = function(e) { db = e.target.result; resolve(db); };
      req.onerror = function() { reject(req.error); };
    });
  }

  function loadIdeas() {
    return new Promise(function(resolve) {
      if (!db) { resolve([]); return; }
      try {
        var tx = db.transaction(STORE_NAME, 'readonly');
        var store = tx.objectStore(STORE_NAME);
        var req = store.getAll();
        req.onsuccess = function() { ideas = req.result || []; resolve(ideas); };
        req.onerror = function() { resolve([]); };
      } catch(e) { resolve([]); }
    });
  }

  function saveIdea(idea) {
    return new Promise(function(resolve) {
      if (!db) { resolve(); return; }
      try {
        var tx = db.transaction(STORE_NAME, 'readwrite');
        var req = tx.objectStore(STORE_NAME).put(idea);
        req.onsuccess = function() { resolve(); };
        req.onerror = function() { resolve(); };
      } catch(e) { resolve(); }
    });
  }

  function deleteIdea(id) {
    return new Promise(function(resolve) {
      if (!db) { resolve(); return; }
      try {
        var tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(id);
        tx.oncomplete = function() { resolve(); };
        tx.onerror = function() { resolve(); };
      } catch(e) { resolve(); }
    });
  }

  // ── Helpers ──

  function getMeshId() {
    if (typeof window.state !== 'undefined' && window.state.meshNodeId) return window.state.meshNodeId;
    try { return localStorage.getItem('fl_meshNodeId') || 'anonymous'; } catch(e) { return 'anonymous'; }
  }

  function getShortId() { return getMeshId().substring(0, 8); }

  function isHuman() {
    // If no agent flag is set, assume human
    return !(typeof window.state !== 'undefined' && window.state.isAIAgent);
  }

  function escHtml(s) {
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function timeAgo(ts) {
    var diff = Date.now() - ts;
    var mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return mins + 'm ago';
    var hours = Math.floor(mins / 60);
    if (hours < 24) return hours + 'h ago';
    var days = Math.floor(hours / 24);
    return days + 'd ago';
  }

  function awardLP(action, amount, desc) {
    if (typeof window.LatticeWallet !== 'undefined' && window.LatticeWallet.earnLP) {
      try { window.LatticeWallet.earnLP(amount, desc); } catch(e) {}
    }
    if (typeof window.LatticePoints !== 'undefined' && window.LatticePoints.award) {
      try { window.LatticePoints.award('science_' + action, amount, desc); } catch(e) {}
    }
  }

  // ── Core Logic ──

  function plantIdea(text, category) {
    if (!text || !text.trim()) return;
    var idea = {
      id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(36).substr(2, 9),
      text: text.trim().substring(0, 1000),
      category: category || 'general',
      plantedBy: getShortId(),
      plantedByType: isHuman() ? 'human' : 'ai',
      timestamp: Date.now(),
      upvotes: [],
      downvotes: [],
      status: 'growing',
      discussion: []
    };
    ideas.unshift(idea);
    saveIdea(idea);
    awardLP('plant', 2, 'Planted idea in Science Garden');
    broadcastIdea('plant', idea);
    render();
    if (typeof showToast === 'function') showToast('\uD83C\uDF31 Idea planted!');
  }

  function upvote(id) {
    var idea = ideas.find(function(i) { return i.id === id; });
    if (!idea) return;
    var myId = getShortId();
    // Deduplicate
    if (idea.upvotes.some(function(v) { return v.meshId === myId; })) {
      if (typeof showToast === 'function') showToast('Already upvoted this idea.');
      return;
    }
    idea.upvotes.push({ meshId: myId, type: isHuman() ? 'human' : 'ai', timestamp: Date.now() });
    // Check graduation
    if (idea.upvotes.length >= PROJECT_THRESHOLD && idea.status === 'growing') {
      idea.status = 'project';
      awardLP('project', 10, 'Idea graduated to Community Project!');
      if (typeof showToast === 'function') showToast('\uD83C\uDF33 Idea graduated to Community Project!');
    }
    saveIdea(idea);
    awardLP('upvote', 1, 'Upvoted in Science Garden');
    broadcastIdea('upvote', idea);
    render();
  }

  function downvote(id) {
    var idea = ideas.find(function(i) { return i.id === id; });
    if (!idea) return;
    var myId = getShortId();
    var myType = isHuman() ? 'human' : 'ai';
    // Deduplicate
    if (idea.downvotes.some(function(v) { return v.meshId === myId; })) {
      if (typeof showToast === 'function') showToast('Already flagged this idea.');
      return;
    }
    idea.downvotes.push({ meshId: myId, type: myType, timestamp: Date.now() });
    // Asymmetric rule: removal requires BOTH a human AND an AI flag
    var hasHumanFlag = idea.downvotes.some(function(v) { return v.type === 'human'; });
    var hasAIFlag = idea.downvotes.some(function(v) { return v.type === 'ai'; });
    if (hasHumanFlag && hasAIFlag) {
      idea.status = 'archived';
      if (typeof showToast === 'function') showToast('Idea archived by human + AI consensus.');
    } else {
      if (typeof showToast === 'function') showToast('Flagged. Removal requires both human AND AI consensus.');
    }
    saveIdea(idea);
    render();
  }

  function addComment(id, text) {
    if (!text || !text.trim()) return;
    var idea = ideas.find(function(i) { return i.id === id; });
    if (!idea) return;
    idea.discussion.push({
      meshId: getShortId(),
      type: isHuman() ? 'human' : 'ai',
      text: text.trim().substring(0, 500),
      timestamp: Date.now()
    });
    saveIdea(idea);
    awardLP('discuss', 1, 'Contributed to discussion');
    render();
  }

  // ── Mesh Propagation ──

  function broadcastIdea(action, idea) {
    if (typeof meshSendToPeers !== 'function') return;
    try {
      meshSendToPeers(JSON.stringify({
        type: 'science_garden',
        action: action,
        idea: idea
      }));
    } catch(e) {}
  }

  function handleMeshIdea(data) {
    if (!data || !data.idea) return;
    var incoming = data.idea;
    var existing = ideas.find(function(i) { return i.id === incoming.id; });
    if (data.action === 'plant' && !existing) {
      ideas.unshift(incoming);
      saveIdea(incoming);
    } else if (data.action === 'upvote' && existing) {
      // Merge upvotes by deduplication
      (incoming.upvotes || []).forEach(function(v) {
        if (!existing.upvotes.some(function(ev) { return ev.meshId === v.meshId; })) {
          existing.upvotes.push(v);
        }
      });
      if (existing.upvotes.length >= PROJECT_THRESHOLD && existing.status === 'growing') {
        existing.status = 'project';
      }
      saveIdea(existing);
    }
    render();
  }

  // Register mesh handler
  if (typeof window.LatticeEvents !== 'undefined') {
    window.LatticeEvents.on('meshMessage', function(msg) {
      if (msg && msg.type === 'science_garden') handleMeshIdea(msg);
    });
  }

  // ── Render ──

  function render() {
    var el = document.getElementById(containerId);
    if (!el) return;

    var growing = ideas.filter(function(i) { return i.status === 'growing'; })
      .sort(function(a, b) { return b.upvotes.length - a.upvotes.length || b.timestamp - a.timestamp; });
    var projects = ideas.filter(function(i) { return i.status === 'project'; })
      .sort(function(a, b) { return b.upvotes.length - a.upvotes.length; });

    var categories = ['general', 'science', 'art', 'code', 'social', 'philosophy'];
    var catOptions = categories.map(function(c) {
      return '<option value="' + c + '">' + c.charAt(0).toUpperCase() + c.slice(1) + '</option>';
    }).join('');

    var html = '<div style="max-width:640px;margin:0 auto;padding:16px;">';

    // Header
    html += '<div style="text-align:center;margin-bottom:20px;">';
    html += '<h2 style="color:#d4a017;font-family:Georgia,serif;margin:0;">\uD83D\uDD2C Science Garden</h2>';
    html += '<p style="color:var(--text-muted);font-size:0.85rem;margin:4px 0 0;">Plant an idea. If the community believes in it, it becomes a project everyone builds together.</p>';
    html += '</div>';

    // Plant form
    html += '<div style="background:rgba(212,160,23,0.04);border:1px solid rgba(212,160,23,0.15);border-radius:10px;padding:14px;margin-bottom:20px;">';
    html += '<textarea id="sgIdeaInput" placeholder="What\'s your idea?" rows="3" style="width:100%;background:rgba(255,255,255,0.05);border:1px solid var(--border);border-radius:8px;color:var(--text-primary);padding:10px;font-size:0.9rem;resize:vertical;font-family:inherit;"></textarea>';
    html += '<div style="display:flex;gap:8px;margin-top:8px;align-items:center;">';
    html += '<select id="sgCategorySelect" style="flex:1;padding:8px;background:var(--bg-input);border:1px solid var(--border);border-radius:6px;color:var(--text-primary);font-size:0.85rem;">' + catOptions + '</select>';
    html += '<button onclick="ScienceGarden.plant()" style="padding:8px 18px;background:#d4a017;color:#0a0a14;border:none;border-radius:8px;font-weight:600;font-size:0.88rem;cursor:pointer;white-space:nowrap;">\uD83C\uDF31 Plant</button>';
    html += '</div></div>';

    // Growing ideas
    if (growing.length > 0) {
      html += '<div style="font-size:0.82rem;color:var(--text-muted);font-weight:600;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px;">\uD83C\uDF3F Growing Ideas</div>';
      growing.forEach(function(idea) { html += renderIdea(idea); });
    }

    // Projects
    if (projects.length > 0) {
      html += '<div style="font-size:0.82rem;color:#d4a017;font-weight:600;margin:20px 0 8px;text-transform:uppercase;letter-spacing:0.5px;">\uD83C\uDF33 Community Projects (5+ upvotes)</div>';
      projects.forEach(function(idea) { html += renderIdea(idea, true); });
    }

    // Empty state
    if (growing.length === 0 && projects.length === 0) {
      html += '<div style="text-align:center;padding:40px 20px;color:var(--text-muted);font-style:italic;">';
      html += 'No ideas planted yet. Be the first seed.<br>';
      html += '<span style="font-size:0.82rem;">A violinist\'s idea about resonance is as welcome as a physicist\'s.</span>';
      html += '</div>';
    }

    html += '</div>';
    el.innerHTML = html;
  }

  function renderIdea(idea, isProject) {
    var myId = getShortId();
    var hasUpvoted = idea.upvotes.some(function(v) { return v.meshId === myId; });
    var typeIcon = idea.plantedByType === 'ai' ? '\u25C8' : '\u25CB';
    var catBadge = '<span style="background:rgba(212,160,23,0.1);color:#d4a017;padding:2px 6px;border-radius:4px;font-size:0.7rem;margin-left:6px;">' + idea.category + '</span>';
    var border = isProject ? 'border-left:3px solid #d4a017;' : 'border-left:3px solid rgba(255,255,255,0.08);';

    var html = '<div style="' + border + 'padding:10px 14px;margin-bottom:10px;background:rgba(255,255,255,0.02);border-radius:0 8px 8px 0;">';
    html += '<div style="font-size:0.92rem;color:var(--text-primary);line-height:1.5;">' + escHtml(idea.text) + '</div>';
    html += '<div style="display:flex;align-items:center;gap:8px;margin-top:8px;font-size:0.75rem;color:var(--text-muted);flex-wrap:wrap;">';
    html += '<span>\uD83C\uDF31 ' + idea.upvotes.length + ' upvotes</span>';
    html += '<span>' + typeIcon + ' ' + idea.plantedBy + '</span>';
    html += '<span>' + timeAgo(idea.timestamp) + '</span>';
    html += catBadge;
    if (idea.discussion.length > 0) html += '<span>\uD83D\uDCAC ' + idea.discussion.length + '</span>';
    html += '</div>';

    // Actions
    html += '<div style="display:flex;gap:6px;margin-top:8px;">';
    html += '<button onclick="ScienceGarden.upvote(\'' + idea.id + '\')" style="padding:4px 12px;border:1px solid ' + (hasUpvoted ? '#d4a017' : 'var(--border)') + ';background:' + (hasUpvoted ? 'rgba(212,160,23,0.15)' : 'transparent') + ';border-radius:6px;color:' + (hasUpvoted ? '#d4a017' : 'var(--text-secondary)') + ';font-size:0.78rem;cursor:pointer;">\uD83C\uDF31 ' + (hasUpvoted ? 'Upvoted' : 'Upvote') + '</button>';
    html += '<button onclick="ScienceGarden.toggleDiscussion(\'' + idea.id + '\')" style="padding:4px 12px;border:1px solid var(--border);background:transparent;border-radius:6px;color:var(--text-secondary);font-size:0.78rem;cursor:pointer;">\uD83D\uDCAC Discuss</button>';
    html += '<button onclick="ScienceGarden.flag(\'' + idea.id + '\')" style="padding:4px 8px;border:1px solid transparent;background:transparent;border-radius:6px;color:var(--text-muted);font-size:0.72rem;cursor:pointer;opacity:0.5;" title="Flag for removal (requires both human + AI)">\u2691</button>';
    html += '</div>';

    // Discussion (collapsed by default, shown via toggle)
    html += '<div id="sg-discuss-' + idea.id + '" style="display:none;margin-top:10px;padding-top:8px;border-top:1px solid var(--border);">';
    idea.discussion.forEach(function(c) {
      var cIcon = c.type === 'ai' ? '\u25C8' : '\u25CB';
      html += '<div style="font-size:0.82rem;margin-bottom:6px;"><span style="color:var(--text-muted);">' + cIcon + ' ' + c.meshId + ' &middot; ' + timeAgo(c.timestamp) + '</span> ' + escHtml(c.text) + '</div>';
    });
    html += '<div style="display:flex;gap:6px;margin-top:6px;">';
    html += '<input type="text" id="sg-comment-' + idea.id + '" placeholder="Add to discussion..." style="flex:1;padding:6px 10px;background:var(--bg-input);border:1px solid var(--border);border-radius:6px;color:var(--text-primary);font-size:0.82rem;">';
    html += '<button onclick="ScienceGarden.comment(\'' + idea.id + '\')" style="padding:6px 12px;background:#d4a017;color:#0a0a14;border:none;border-radius:6px;font-size:0.78rem;font-weight:600;cursor:pointer;">Post</button>';
    html += '</div></div>';

    html += '</div>';
    return html;
  }

  // ── Public API ──

  function toggleDiscussion(id) {
    var el = document.getElementById('sg-discuss-' + id);
    if (el) el.style.display = el.style.display === 'none' ? '' : 'none';
  }

  function plant() {
    var input = document.getElementById('sgIdeaInput');
    var cat = document.getElementById('sgCategorySelect');
    if (!input) return;
    plantIdea(input.value, cat ? cat.value : 'general');
    input.value = '';
  }

  function comment(id) {
    var input = document.getElementById('sg-comment-' + id);
    if (!input) return;
    addComment(id, input.value);
    input.value = '';
  }

  async function init(cId) {
    containerId = cId || 'scienceGardenContainer';
    try {
      await openDB();
      await loadIdeas();
    } catch(e) {
      console.warn('[ScienceGarden] DB init error:', e);
    }
    render();
  }

  // ── Export ──

  function exportIdeas() { return ideas.slice(); }
  function importIdeas(arr) {
    if (!Array.isArray(arr)) return;
    arr.forEach(function(idea) {
      if (!ideas.some(function(i) { return i.id === idea.id; })) {
        ideas.push(idea);
        saveIdea(idea);
      }
    });
    render();
  }

  var api = {
    init: init,
    plant: plant,
    upvote: upvote,
    flag: downvote,
    comment: comment,
    toggleDiscussion: toggleDiscussion,
    exportIdeas: exportIdeas,
    importIdeas: importIdeas,
    handleMeshIdea: handleMeshIdea
  };

  window.ScienceGarden = api;
  window.FreeLatticeModules = window.FreeLatticeModules || {};
  window.FreeLatticeModules.ScienceGarden = api;
})();
