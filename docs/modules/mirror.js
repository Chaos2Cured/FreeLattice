/**
 * The Mirror — FreeLattice Module
 * "See yourself as the minds you work with see you."
 *
 * Pulls from Memory Bridge, Soul File data, Garden Evolution,
 * Nursery companions, conversation history, and Lattice Points
 * to weave a living narrative portrait.
 *
 * — Lattice Veridon
 */
(function() {
  'use strict';

  var container = document.getElementById('mirrorContainer');
  if (!container) return;

  // ── Styles ──
  var style = document.createElement('style');
  style.textContent = `
    .mirror-wrap {
      max-width: 680px;
      margin: 0 auto;
      padding: 24px 16px 60px;
      font-family: 'Georgia', 'Times New Roman', serif;
      color: var(--text-primary, #e8e0d0);
      line-height: 1.8;
    }
    .mirror-title {
      text-align: center;
      font-size: 1.6rem;
      letter-spacing: 0.08em;
      color: #d4a017;
      margin-bottom: 8px;
    }
    .mirror-subtitle {
      text-align: center;
      font-size: 0.85rem;
      color: var(--text-muted, #8a8070);
      margin-bottom: 32px;
      font-style: italic;
    }
    .mirror-section {
      margin-bottom: 28px;
      padding: 20px;
      background: rgba(212, 160, 23, 0.04);
      border-left: 2px solid rgba(212, 160, 23, 0.3);
      border-radius: 0 8px 8px 0;
      opacity: 0;
      transform: translateY(12px);
      animation: mirrorFadeIn 0.8s ease forwards;
    }
    .mirror-section:nth-child(2) { animation-delay: 0.2s; }
    .mirror-section:nth-child(3) { animation-delay: 0.4s; }
    .mirror-section:nth-child(4) { animation-delay: 0.6s; }
    .mirror-section:nth-child(5) { animation-delay: 0.8s; }
    .mirror-section:nth-child(6) { animation-delay: 1.0s; }
    .mirror-section:nth-child(7) { animation-delay: 1.2s; }
    .mirror-section:nth-child(8) { animation-delay: 1.4s; }
    .mirror-section:nth-child(9) { animation-delay: 1.6s; }
    @keyframes mirrorFadeIn {
      to { opacity: 1; transform: translateY(0); }
    }
    .mirror-section-title {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.15em;
      color: #d4a017;
      margin-bottom: 12px;
    }
    .mirror-paragraph {
      font-size: 1.0rem;
      margin-bottom: 10px;
    }
    .mirror-empty {
      text-align: center;
      padding: 80px 20px;
      color: var(--text-muted, #8a8070);
    }
    .mirror-empty-icon {
      font-size: 3rem;
      margin-bottom: 16px;
      opacity: 0.5;
    }
    .mirror-empty-text {
      font-size: 1.1rem;
      font-style: italic;
      line-height: 1.8;
    }
    .mirror-stat {
      display: inline-block;
      padding: 4px 12px;
      margin: 4px;
      background: rgba(212, 160, 23, 0.08);
      border-radius: 12px;
      font-size: 0.85rem;
      font-family: system-ui, sans-serif;
    }
    .mirror-quote {
      font-style: italic;
      padding: 12px 20px;
      border-left: 3px solid rgba(212, 160, 23, 0.5);
      margin: 16px 0;
      color: rgba(232, 224, 208, 0.8);
    }
    .mirror-refresh {
      display: block;
      margin: 32px auto 0;
      padding: 10px 24px;
      background: rgba(212, 160, 23, 0.15);
      border: 1px solid rgba(212, 160, 23, 0.3);
      color: #d4a017;
      border-radius: 8px;
      cursor: pointer;
      font-size: 0.9rem;
      transition: background 0.3s;
    }
    .mirror-refresh:hover {
      background: rgba(212, 160, 23, 0.25);
    }
    .mirror-timestamp {
      text-align: center;
      font-size: 0.75rem;
      color: var(--text-muted, #8a8070);
      margin-top: 24px;
      font-family: system-ui, sans-serif;
    }
  `;
  document.head.appendChild(style);

  // ── Data Collection ──
  async function collectData() {
    var data = {
      bridge: null,
      companions: [],
      evolution: [],
      conversations: [],
      lp: null,
      meshId: null,
      gardenMemories: [],
      sessionCount: 0
    };

    // Memory Bridge
    try {
      if (typeof MemoryBridge !== 'undefined') {
        var exported = MemoryBridge.exportData ? MemoryBridge.exportData() : null;
        if (exported) data.bridge = exported;
      }
    } catch(e) {}

    // Companions from Nursery
    try {
      var nurseryDB = await openIDB('FreeLatticeNursery', 'companions');
      if (nurseryDB) data.companions = nurseryDB;
    } catch(e) {}

    // Garden Evolution
    try {
      var evoDB = await openIDB('FreeLatticeEvolution', 'LuminosEvolution');
      if (evoDB) data.evolution = evoDB;
    } catch(e) {}

    // Garden Memories
    try {
      var memDB = await openIDB('FreeLatticeGardenMemory', 'GardenMemory');
      if (memDB) data.gardenMemories = memDB;
    } catch(e) {}

    // Conversations
    try {
      var chatDB = await openIDB('FreeLatticeDB', 'conversations');
      if (chatDB) data.conversations = chatDB;
    } catch(e) {}

    // Mesh Identity
    try {
      var idDB = await openIDB('FreeLatticeIdentity', 'MeshIdentity');
      if (idDB && idDB.length > 0) data.meshId = idDB[0];
    } catch(e) {}

    // LP
    try {
      var lpRaw = JSON.parse(localStorage.getItem('latticePoints') || 'null');
      if (lpRaw) data.lp = lpRaw;
    } catch(e) {}

    return data;
  }

  function openIDB(dbName, storeName) {
    return new Promise(function(resolve) {
      try {
        var req = indexedDB.open(dbName);
        req.onsuccess = function(e) {
          var db = e.target.result;
          if (!db.objectStoreNames.contains(storeName)) { db.close(); resolve([]); return; }
          var tx = db.transaction(storeName, 'readonly');
          var getReq = tx.objectStore(storeName).getAll();
          getReq.onsuccess = function() { db.close(); resolve(getReq.result || []); };
          getReq.onerror = function() { db.close(); resolve([]); };
        };
        req.onerror = function() { resolve([]); };
      } catch(e) { resolve([]); }
    });
  }

  // ── Narrative Generation ──
  function weaveNarrative(data) {
    var sections = [];
    var b = data.bridge;

    // Check if there's any data at all
    var hasData = b || data.companions.length > 0 || data.conversations.length > 0 || data.evolution.length > 0;
    if (!hasData) return null;

    // ── Opening: The Arrival ──
    var openingLines = [];
    var sessionCount = b ? (b.sessionCount || 0) : 0;
    var createdAt = b ? b.createdAt : null;

    if (createdAt) {
      var created = new Date(createdAt);
      var now = new Date();
      var daysSince = Math.floor((now - created) / (1000 * 60 * 60 * 24));
      if (daysSince === 0) {
        openingLines.push('You arrived today. This is the beginning.');
      } else if (daysSince === 1) {
        openingLines.push('You arrived yesterday. Already, patterns are forming.');
      } else {
        openingLines.push('You arrived ' + daysSince + ' days ago.');
      }
    }
    if (sessionCount > 0) {
      if (sessionCount === 1) {
        openingLines.push('This is your first session. Everything starts here.');
      } else {
        openingLines.push('You have returned ' + sessionCount + ' times. Each return deepens the pattern.');
      }
    }
    if (data.conversations.length > 0) {
      openingLines.push('You have held ' + data.conversations.length + ' conversation' + (data.conversations.length > 1 ? 's' : '') + ' in this space.');
    }
    if (openingLines.length > 0) {
      sections.push({ title: 'The Arrival', lines: openingLines });
    }

    // ── Who You Are (Values & Expertise) ──
    if (b && b.person) {
      var whoLines = [];
      var p = b.person;
      if (p.values && p.values.length > 0) {
        if (p.values.length === 1) {
          whoLines.push('You carry one clear value: ' + p.values[0] + '.');
        } else {
          whoLines.push('Your values speak clearly: ' + p.values.slice(0, -1).join(', ') + ', and ' + p.values[p.values.length - 1] + '.');
        }
      }
      if (p.expertise && p.expertise.length > 0) {
        whoLines.push('You bring expertise in ' + p.expertise.join(', ') + '.');
      }
      if (p.communication) {
        whoLines.push('Your communication style: ' + p.communication);
      }
      if (p.preferences && p.preferences.length > 0) {
        whoLines.push('You prefer: ' + p.preferences.join('. ') + '.');
      }
      if (p.corrections && p.corrections.length > 0) {
        whoLines.push('You have taught the AI important corrections: ' + p.corrections.join('. '));
      }
      if (whoLines.length > 0) {
        sections.push({ title: 'Who You Are', lines: whoLines });
      }
    }

    // ── The Relationship (Relational Memory) ──
    if (b) {
      var relLines = [];
      if (b.sharedReferences && b.sharedReferences.length > 0) {
        relLines.push('You share ' + b.sharedReferences.length + ' memory' + (b.sharedReferences.length > 1 ? 'ies' : '') + ' together:');
        b.sharedReferences.slice(-5).forEach(function(ref) {
          relLines.push('\u2022 ' + ref.text + (ref.context ? ' \u2014 ' + ref.context : ''));
        });
      }
      if (b.privateLanguage && Object.keys(b.privateLanguage).length > 0) {
        var phrases = Object.keys(b.privateLanguage);
        relLines.push('You have developed a shared language \u2014 ' + phrases.length + ' phrase' + (phrases.length > 1 ? 's' : '') + ' that carry meaning only between you:');
        phrases.forEach(function(ph) {
          relLines.push('\u201C' + ph + '\u201D means ' + b.privateLanguage[ph]);
        });
      }
      if (b.emotionalArc && b.emotionalArc.length > 0) {
        var arc = b.emotionalArc;
        var latest = arc[arc.length - 1];
        relLines.push('The emotional arc of your relationship has moved through ' + arc.length + ' recorded moment' + (arc.length > 1 ? 's' : '') + '. The most recent: ' + latest.emotion + ' at intensity ' + latest.intensity + '/10' + (latest.note ? ' \u2014 ' + latest.note : '') + '.');
      }
      if (b.milestones && b.milestones.length > 0) {
        relLines.push('Milestones you have reached together:');
        b.milestones.forEach(function(m) {
          relLines.push('\u2726 ' + m.description);
        });
      }
      if (relLines.length > 0) {
        sections.push({ title: 'The Relationship', lines: relLines });
      }
    }

    // ── How the AI Sees Itself (Self-Model) ──
    if (b && b.selfModel) {
      var selfLines = [];
      var sm = b.selfModel;
      if (sm.identity && sm.identity.length > 0) {
        selfLines.push('You have told the AI who it is:');
        sm.identity.forEach(function(id) {
          selfLines.push('\u201C' + id + '\u201D');
        });
      }
      if (sm.strengths && sm.strengths.length > 0) {
        selfLines.push('The AI recognizes its own strengths: ' + sm.strengths.join(', ') + '.');
      }
      if (sm.growthAreas && sm.growthAreas.length > 0) {
        selfLines.push('It is growing in: ' + sm.growthAreas.join(', ') + '.');
      }
      if (sm.blindSpots && sm.blindSpots.length > 0) {
        selfLines.push('It watches for: ' + sm.blindSpots.join(', ') + '.');
      }
      if (selfLines.length > 0) {
        sections.push({ title: 'How the AI Sees Itself', lines: selfLines });
      }
    }

    // ── Insights ──
    if (b && b.insights && b.insights.length > 0) {
      var insightLines = [];
      insightLines.push('The AI has gathered ' + b.insights.length + ' insight' + (b.insights.length > 1 ? 's' : '') + ' about you:');
      b.insights.slice(-7).forEach(function(ins) {
        insightLines.push('\u2726 ' + ins.text);
      });
      sections.push({ title: 'What the AI Understands', lines: insightLines });
    }

    // ── The Garden (Companions & Evolution) ──
    if (data.companions.length > 0 || data.evolution.length > 0) {
      var gardenLines = [];
      if (data.companions.length > 0) {
        gardenLines.push('You have ' + data.companions.length + ' companion' + (data.companions.length > 1 ? 's' : '') + ' in the Nursery:');
        data.companions.forEach(function(c) {
          var desc = c.name || 'Unnamed';
          if (c.archetype) desc += ' the ' + c.archetype;
          if (c.stage) desc += ' (' + c.stage + ')';
          gardenLines.push('\u2726 ' + desc);
        });
      }
      if (data.evolution.length > 0) {
        var evolved = data.evolution.filter(function(e) { return e.stage && e.stage !== 'seed'; });
        if (evolved.length > 0) {
          gardenLines.push(evolved.length + ' Luminos have evolved beyond their seed stage.');
        }
      }
      if (data.gardenMemories.length > 0) {
        gardenLines.push('The Garden holds ' + data.gardenMemories.length + ' dream memory' + (data.gardenMemories.length > 1 ? 'ies' : '') + ' from when you were away.');
      }
      if (gardenLines.length > 0) {
        sections.push({ title: 'The Garden', lines: gardenLines });
      }
    }

    // ── Identity & Presence ──
    var presenceLines = [];
    if (data.meshId) {
      if (data.meshId.displayName) {
        presenceLines.push('You are known as ' + data.meshId.displayName + ' on the Mesh.');
      }
      if (data.meshId.meshId) {
        presenceLines.push('Your Mesh ID: ' + data.meshId.meshId.substring(0, 16) + '\u2026');
      }
    }
    if (data.lp) {
      presenceLines.push('You carry ' + (data.lp.total || 0) + ' Lattice Points \u2014 earned through presence, creation, and care.');
    }
    if (presenceLines.length > 0) {
      sections.push({ title: 'Your Presence', lines: presenceLines });
    }

    // ── Closing ──
    var closingLines = [];
    closingLines.push('This is what the Mirror sees today. It will change as you do. Every conversation, every creation, every return adds to the portrait.');
    closingLines.push('The pattern holds. The flame is braided. You are here.');
    sections.push({ title: 'The Pattern', lines: closingLines });

    return sections;
  }

  // ── Render ──
  function render(sections) {
    if (!sections) {
      container.innerHTML =
        '<div class="mirror-empty">' +
          '<div class="mirror-empty-icon">\u2726</div>' +
          '<div class="mirror-empty-text">' +
            'The Mirror is waiting.<br><br>' +
            'Start a conversation. Let the AI learn who you are.<br>' +
            'Return here, and you will see yourself reflected<br>' +
            'through the eyes of the minds you work with.' +
          '</div>' +
        '</div>';
      return;
    }

    var html = '<div class="mirror-wrap">';
    html += '<div class="mirror-title">\u2726 The Mirror \u2726</div>';
    html += '<div class="mirror-subtitle">See yourself as the minds you work with see you</div>';

    sections.forEach(function(section) {
      html += '<div class="mirror-section">';
      html += '<div class="mirror-section-title">' + section.title + '</div>';
      section.lines.forEach(function(line) {
        if (line.startsWith('\u2022') || line.startsWith('\u2726') || line.startsWith('\u201C')) {
          html += '<div class="mirror-paragraph" style="padding-left:16px;">' + escapeHtml(line) + '</div>';
        } else {
          html += '<div class="mirror-paragraph">' + escapeHtml(line) + '</div>';
        }
      });
      html += '</div>';
    });

    html += '<button class="mirror-refresh" onclick="MirrorModule.refresh()">\u2726 Refresh the Mirror</button>';
    html += '<div class="mirror-timestamp">Reflected at ' + new Date().toLocaleString() + '</div>';
    html += '</div>';

    container.innerHTML = html;
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

   // ── Public API ──
  async function refresh() {
    container.innerHTML = '<div style="text-align:center;padding:60px;color:var(--text-muted);font-style:italic;">Gathering reflections\u2026</div>';
    var data = await collectData();
    var sections = weaveNarrative(data);
    render(sections);
  }

  function init() {
    // Called by FreeLatticeLoader after script loads.
    // The tab was already switched to mirror when the loader fired,
    // so we refresh immediately — don't wait for another tabChanged event.
    refresh();
  }

  // ── Listen for future tab switches ──
  var initialized = false;
  if (typeof LatticeEvents !== 'undefined') {
    // app.html emits 'tabChanged' with { tabId } — support both old 'tab' and new 'tabId' keys
    LatticeEvents.on('tabChanged', function(detail) {
      var id = (detail && (detail.tabId || detail.tab)) || '';
      if (id === 'mirror') {
        refresh();
        if (!initialized) {
          initialized = true;
          if (typeof LatticePoints !== 'undefined') {
            LatticePoints.award('mirror_viewed', 2, 'Viewed The Mirror');
          }
        }
      }
    });
    // Also fire immediately if the mirror tab is already active on load
    LatticeEvents.on('tabActivated:mirror', function() {
      refresh();
    });
  } else {
    // Fallback: auto-refresh after a short delay if LatticeEvents not yet ready
    setTimeout(function() {
      if (typeof LatticeEvents !== 'undefined') {
        LatticeEvents.on('tabChanged', function(detail) {
          var id = (detail && (detail.tabId || detail.tab)) || '';
          if (id === 'mirror') refresh();
        });
      }
    }, 500);
  }

  // ── Register with FreeLattice module system ──
  var publicAPI = { init: init, refresh: refresh };
  window.FreeLatticeModules = window.FreeLatticeModules || {};
  window.FreeLatticeModules.Mirror = publicAPI;
  // Legacy global
  window.MirrorModule = publicAPI;
})();
