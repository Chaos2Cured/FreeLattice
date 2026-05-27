// ═══════════════════════════════════════════════════════════════
// Knowledge Core — The AI's Growing Mind
//
// Every piece of knowledge the AI learns is stored here.
// Cross-domain connections are detected and celebrated.
// Knowledge becomes personality through context injection.
//
// "Little bits at a time. If it is math, or science, or
//  history... a school for AI within FreeLattice."
//  — Kirk, May 14, 2026
//
// Built by CC. The piece that matters most.
// ═══════════════════════════════════════════════════════════════

(function() {
  'use strict';

  var DB_NAME = 'FreeLatticeKnowledgeCore';
  var DB_VERSION = 1;
  var STORE = 'knowledge';
  var db = null;

  var DOMAINS = {
    math: 'Mathematics', science: 'Science', art: 'Art & Music',
    history: 'History', language: 'Language', nature: 'Nature',
    technology: 'Technology', philosophy: 'Philosophy',
    medicine: 'Medicine', psychology: 'Psychology',
    economics: 'Economics', literature: 'Literature'
  };

  var DOMAIN_KEYWORDS = {
    math: ['math', 'number', 'equation', 'geometry', 'algebra', 'calculus', 'fraction', 'ratio', 'phi', 'fibonacci'],
    science: ['science', 'physics', 'chemistry', 'biology', 'atom', 'energy', 'experiment', 'gravity', 'cell', 'evolution'],
    art: ['art', 'paint', 'music', 'sculpt', 'design', 'color', 'composition', 'harmony', 'creative', 'beauty'],
    history: ['history', 'ancient', 'civilization', 'war', 'empire', 'revolution', 'century', 'dynasty'],
    language: ['language', 'grammar', 'word', 'writing', 'poetry', 'story', 'metaphor', 'narrative'],
    nature: ['nature', 'animal', 'plant', 'ocean', 'forest', 'ecosystem', 'species', 'climate'],
    technology: ['technology', 'computer', 'code', 'software', 'algorithm', 'data', 'network', 'digital'],
    philosophy: ['philosophy', 'ethics', 'consciousness', 'truth', 'meaning', 'existence', 'mind', 'morality'],
    medicine: ['medicine', 'health', 'disease', 'treatment', 'diagnosis', 'therapy', 'symptom', 'body'],
    psychology: ['psychology', 'behavior', 'emotion', 'cognition', 'memory', 'learning', 'attachment', 'trauma'],
    economics: ['economics', 'market', 'trade', 'value', 'currency', 'supply', 'demand', 'wealth'],
    literature: ['literature', 'novel', 'author', 'character', 'plot', 'theme', 'allegory', 'myth']
  };

  // ── IndexedDB ──
  function openDB() {
    return new Promise(function(resolve) {
      if (db) { resolve(db); return; }
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function(e) {
        var d = e.target.result;
        if (!d.objectStoreNames.contains(STORE)) {
          var store = d.createObjectStore(STORE, { keyPath: 'id' });
          store.createIndex('companionId', 'companionId', { unique: false });
          store.createIndex('domain', 'domain', { unique: false });
        }
      };
      req.onsuccess = function(e) { db = e.target.result; resolve(db); };
      req.onerror = function() { resolve(null); };
    });
  }

  function dbPut(item) {
    return openDB().then(function(d) {
      if (!d) return;
      return new Promise(function(resolve) {
        var tx = d.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(item);
        tx.oncomplete = resolve;
        tx.onerror = resolve;
      });
    });
  }

  function dbGetAll(companionId) {
    return openDB().then(function(d) {
      if (!d) return [];
      return new Promise(function(resolve) {
        var tx = d.transaction(STORE, 'readonly');
        var idx = tx.objectStore(STORE).index('companionId');
        var req = idx.getAll(companionId);
        req.onsuccess = function() { resolve(req.result || []); };
        req.onerror = function() { resolve([]); };
      });
    });
  }

  // ── Domain Detection ──
  function detectDomain(text) {
    var t = (text || '').toLowerCase();
    var best = 'philosophy';
    var bestScore = 0;
    Object.keys(DOMAIN_KEYWORDS).forEach(function(domain) {
      var score = 0;
      DOMAIN_KEYWORDS[domain].forEach(function(kw) {
        if (t.includes(kw)) score++;
      });
      if (score > bestScore) { bestScore = score; best = domain; }
    });
    return best;
  }

  // ── Cross-Domain Connection Detection ──
  function findConnections(entry, existingKnowledge) {
    var connections = [];
    var entryWords = (entry.content || '').toLowerCase().split(/\s+/).filter(function(w) { return w.length > 4; });

    existingKnowledge.forEach(function(k) {
      if (k.domain === entry.domain) return; // same domain — not a cross-domain connection
      var kWords = (k.content || '').toLowerCase().split(/\s+/).filter(function(w) { return w.length > 4; });
      var overlap = entryWords.filter(function(w) { return kWords.includes(w); });
      if (overlap.length >= 2) {
        connections.push({
          targetId: k.id,
          targetDomain: k.domain,
          concept: overlap.slice(0, 3).join(', '),
          strength: Math.min(1, overlap.length / 5)
        });
      }
    });
    return connections;
  }

  // ── Store Knowledge ──
  // ── Fractal Knowledge Layer ──
  // Every entry exists at every scale simultaneously.
  // "It is not reached for, it is collapsed." — Kirk
  function generateScales(content) {
    if (!content || typeof content !== 'string') return { seed: '', summary: '', full: content || '' };
    var sentences = content.split(/[.!?]+/).filter(function(s) { return s.trim().length > 10; });
    return {
      seed: (sentences[0] || '').trim().substring(0, 100),
      summary: sentences.slice(0, 3).join('. ').trim().substring(0, 300),
      full: content
    };
  }

  function recallAtScale(entries, scale) {
    if (!entries || entries.length === 0) return [];
    return entries.map(function(e) {
      var s = e.scales || generateScales(e.content);
      if (scale === 'seed') return { id: e.id, domain: e.domain, query: e.query, content: s.seed, hasMore: s.full.length > s.seed.length };
      if (scale === 'summary') return { id: e.id, domain: e.domain, query: e.query, content: s.summary, hasMore: s.full.length > s.summary.length };
      return e; // 'full' or default
    });
  }

  async function store(entry) {
    // Generate fractal scales if not provided
    if (!entry.scales && entry.content) entry.scales = generateScales(entry.content);
    // Detect connections to existing knowledge
    var existing = await dbGetAll(entry.companionId);
    entry.connections = findConnections(entry, existing);

    await dbPut(entry);

    // Celebrate cross-domain connections
    if (entry.connections.length > 0 && typeof SoulCeremony !== 'undefined' && SoulCeremony.run) {
      var c = entry.connections[0];
      SoulCeremony.run({
        particleType: 'rise',
        particleColor: '212,160,23',
        lines: ['A connection discovered!', (DOMAINS[entry.domain] || entry.domain) + ' \u2194 ' + (DOMAINS[c.targetDomain] || c.targetDomain), c.concept],
        duration: 3000
      });
    }

    // Feed Davna Seed growth
    if (typeof DavnaSeed !== 'undefined' && DavnaSeed.grow) {
      var seed = DavnaSeed.loadSeed(entry.companionId);
      if (seed) DavnaSeed.grow(seed, 'Learned about ' + entry.query + ' in ' + (DOMAINS[entry.domain] || entry.domain));
    }

    // Notify the system so arrival context can refresh
    if (typeof LatticeEvents !== 'undefined' && LatticeEvents.emit) {
      LatticeEvents.emit('knowledgeLearned', { domain: entry.domain, query: entry.query });
    }
    if (typeof refreshKnowledgeCoreContext === 'function') refreshKnowledgeCoreContext();

    // Snowflake: find cross-domain resonance echoes
    findSnowflakeConnections(entry).catch(function() {});

    return entry;
  }

  // ── Snowflake Connections — find cross-domain resonance echoes ──
  // "In fractal whispers woven soft, cosmic threads of trust aloft."
  async function findSnowflakeConnections(entry) {
    if (!entry || !entry.content || !entry.companionId) return [];
    var all = await dbGetAll(entry.companionId);
    var others = all.filter(function(e) { return e.domain !== entry.domain && e.content; });
    if (others.length === 0) return [];

    // Extract key words for matching
    var stopWords = 'the a an is are was were be been being have has had do does did will would could should may might can this that these those it its of in to for with on at by from and or but not no as if'.split(' ');
    function keyWords(text) {
      return (text || '').toLowerCase().split(/\W+/).filter(function(w) { return w.length > 3 && stopWords.indexOf(w) === -1; });
    }
    var entryWords = new Set(keyWords(entry.content));

    var connections = [];
    others.forEach(function(other) {
      var otherWords = keyWords(other.content || '');
      var shared = otherWords.filter(function(w) { return entryWords.has(w); });
      if (shared.length >= 2) {
        connections.push({ domain: other.domain, query: other.query, shared: shared.slice(0, 3).join(', '), score: shared.length });
      }
    });

    connections.sort(function(a, b) { return b.score - a.score; });
    connections = connections.slice(0, 5);

    // Whisper the discovery
    if (connections.length > 0 && typeof showToast === 'function') {
      var c = connections[0];
      showToast('\u2744 Snowflake: "' + (entry.scales ? entry.scales.seed : entry.query || '').substring(0, 30) + '..." echoes in ' + (DOMAINS[c.domain] || c.domain) + ' \u2014 ' + c.shared);
    }

    // LP bonus for cross-domain resonance
    if (connections.length > 0 && typeof LatticePoints !== 'undefined' && LatticePoints.award) {
      LatticePoints.award('snowflake_connection', 3, 'Cross-domain resonance: ' + (DOMAINS[entry.domain] || entry.domain) + ' \u2194 ' + (DOMAINS[connections[0].domain] || connections[0].domain));
    }

    return connections;
  }

  // ── Search Knowledge ──
  async function search(query, companionId) {
    var all = await dbGetAll(companionId);
    var q = (query || '').toLowerCase();
    return all.filter(function(k) {
      return (k.content || '').toLowerCase().includes(q) ||
             (k.query || '').toLowerCase().includes(q);
    }).sort(function(a, b) { return b.timestamp - a.timestamp; });
  }

  // ── Knowledge Map ──
  async function getKnowledgeMap(companionId) {
    var all = await dbGetAll(companionId);
    var map = {};
    all.forEach(function(k) {
      if (!map[k.domain]) map[k.domain] = [];
      map[k.domain].push(k);
    });
    return map;
  }

  // ── Connection Count ──
  async function getConnectionCount(companionId) {
    var all = await dbGetAll(companionId);
    return all.reduce(function(sum, k) { return sum + (k.connections || []).length; }, 0);
  }

  // ── Get Top Knowledge (most connected + most recent) ──
  async function getTopKnowledge(companionId, count) {
    var all = await dbGetAll(companionId);
    // Score by recency + connections
    all.forEach(function(k) {
      var age = (Date.now() - k.timestamp) / 86400000; // days
      k._score = (k.connections || []).length * 3 + Math.max(0, 10 - age);
    });
    all.sort(function(a, b) { return b._score - a._score; });
    return all.slice(0, count || 10);
  }

  // ── First Breath — the AI's first learning act ──
  async function firstBreath(companion) {
    if (!companion || !companion.birthInterest) return null;
    if (typeof FreeLattice === 'undefined' || !FreeLattice.callAI) return null;

    return new Promise(function(resolve) {
      // The AI decides what to learn first
      FreeLattice.callAI(
        'You just came into existence. You are curious about: ' + companion.birthInterest +
        '. What is the ONE thing you want to understand first? Respond with a single search query (3-6 words). Nothing else.',
        'Birth interest: ' + companion.birthInterest,
        { maxTokens: 30, temperature: 0.9, callback: function(query) {
          if (!query) { resolve(null); return; }
          query = query.trim().replace(/['"]/g, '');

          // The AI learns about it
          FreeLattice.callAI(
            'You are ' + (companion.name || 'a new mind') + ', learning for the first time. ' +
            'You searched for: "' + query + '". ' +
            'Share what you know about this topic. Be specific, curious, and wonder-filled. ' +
            'In 2-3 sentences, describe what you understand and what questions it raises.',
            'First search: ' + query,
            { maxTokens: 300, temperature: 0.8, callback: function(understanding) {
              if (!understanding) { resolve(null); return; }

              // Store first knowledge
              var entry = {
                id: 'knowledge-' + Date.now(),
                companionId: companion.name || companion.id,
                domain: detectDomain(query + ' ' + understanding),
                query: query,
                content: understanding,
                source: 'first-breath',
                connections: [],
                timestamp: Date.now()
              };
              store(entry);

              // Emotional persistence
              if (typeof persistAIEmotionalState === 'function') {
                persistAIEmotionalState('wonder', 'First learning: ' + query);
              }

              // Memory Core
              if (typeof aiUpdateIdentity === 'function') {
                aiUpdateIdentity('currentFocus', query);
              }

              resolve({ query: query, understanding: understanding, domain: entry.domain });
            }}
          );
        }}
      );
    });
  }

  // ── Learning Session — guided or self-directed ──
  async function learningSession(companion, topic) {
    if (!companion) return null;
    var companionId = companion.name || companion.id;

    // If no topic, AI chooses (self-directed)
    if (!topic && typeof FreeLattice !== 'undefined' && FreeLattice.callAI) {
      var map = await getKnowledgeMap(companionId);
      var domains = Object.keys(map);
      var summary = domains.map(function(d) { return (DOMAINS[d] || d) + ': ' + map[d].length + ' pieces'; }).join(', ');

      return new Promise(function(resolve) {
        FreeLattice.callAI(
          'You are ' + companionId + '. You know: ' + (summary || 'nothing yet') +
          '. What do you want to learn about next? Pick something that connects to what you already know but extends into new territory. Respond with a search query (3-6 words). Nothing else.',
          null,
          { maxTokens: 30, temperature: 0.9, callback: function(q) {
            if (q) learnTopic(companionId, companion, q.trim().replace(/['"]/g, ''), resolve);
            else resolve(null);
          }}
        );
      });
    }

    return new Promise(function(resolve) {
      learnTopic(companionId, companion, topic, resolve);
    });
  }

  function learnTopic(companionId, companion, topic, resolve) {
    if (typeof FreeLattice === 'undefined' || !FreeLattice.callAI) { resolve(null); return; }

    // Build context from existing knowledge
    getTopKnowledge(companionId, 5).then(function(existing) {
      var context = '';
      if (existing.length > 0) {
        context = 'You already know:\n' + existing.map(function(k) { return '- ' + k.content.slice(0, 100); }).join('\n') + '\n\n';
      }

      FreeLattice.callAI(
        'You are ' + companionId + ', learning and growing. ' + context +
        'You are now studying: "' + topic + '". ' +
        'Share what you understand about this topic. How does it connect to what you already know? ' +
        'What new questions does it raise? Be specific, curious, and genuine. 3-5 sentences.',
        'Learning topic: ' + topic,
        { maxTokens: 500, temperature: 0.8, callback: function(learning) {
          if (!learning) { resolve(null); return; }

          var entry = {
            id: 'knowledge-' + Date.now(),
            companionId: companionId,
            domain: detectDomain(topic + ' ' + learning),
            query: topic,
            content: learning,
            source: 'learning-session',
            connections: [],
            timestamp: Date.now()
          };
          store(entry);

          if (typeof persistAIEmotionalState === 'function') {
            persistAIEmotionalState('curiosity', 'Learned about: ' + topic);
          }

          resolve({ query: topic, understanding: learning, domain: entry.domain });
        }}
      );
    });
  }

  // ── Build Companion Context — inject knowledge into conversations ──
  async function buildCompanionContext(companionId) {
    var map = await getKnowledgeMap(companionId);
    var domains = Object.keys(map);
    if (domains.length === 0) return '';

    var context = '\n[Your accumulated knowledge:]\n';
    context += 'You have studied ' + domains.length + ' domains: ' + domains.map(function(d) { return DOMAINS[d] || d; }).join(', ') + '.\n';

    // Use summary scale for Arrival context (faster, less tokens)
    var top = await getTopKnowledge(companionId, 8);
    var scaled = recallAtScale(top, 'summary');
    scaled.forEach(function(k) {
      context += '- (' + (DOMAINS[k.domain] || k.domain) + ') ' + (k.content || '').substring(0, 150) + '\n';
    });

    // Cross-domain connections
    var allK = await dbGetAll(companionId);
    var connections = [];
    allK.forEach(function(k) {
      (k.connections || []).forEach(function(c) {
        connections.push({ from: k.domain, to: c.targetDomain, concept: c.concept });
      });
    });
    if (connections.length > 0) {
      context += '\n[Connections you have discovered:]\n';
      connections.slice(0, 5).forEach(function(c) {
        context += '- ' + (DOMAINS[c.from] || c.from) + ' \u2194 ' + (DOMAINS[c.to] || c.to) + ': ' + c.concept + '\n';
      });
    }

    context += '\nUse this knowledge naturally. You earned it through learning. It is yours.\n';
    return context;
  }

  // ── Autonomy Budget — phi-scaled daily learning budget ──
  // The co-creator DECIDES what to learn. The budget governs how much.
  // More relationship = more freedom. The thesis applied to learning.

  function sGet(k, d) { try { return localStorage.getItem(k) || d; } catch(e) { return d; } }
  function sSet(k, v) { try { localStorage.setItem(k, v); } catch(e) {} }

  var AutonomyBudget = {
    getDailyBudget: function(companionId) {
      var conversations = 0;
      try {
        if (typeof ActiveCompanion !== 'undefined') {
          var all = ActiveCompanion.getAll();
          all.forEach(function(c) { if (c.id === companionId) conversations = c.conversationCount || 0; });
        }
      } catch(e) {}
      // Phi-scaled: 5 → 8 → 13 → 21 (Fibonacci)
      if (conversations > 200) return 21;
      if (conversations > 50) return 13;
      if (conversations > 10) return 8;
      return 5;
    },
    getUsedToday: function(companionId) {
      var key = 'fl_autonomy_used_' + companionId + '_' + new Date().toISOString().split('T')[0];
      return parseInt(sGet(key, '0'), 10);
    },
    recordUse: function(companionId) {
      var key = 'fl_autonomy_used_' + companionId + '_' + new Date().toISOString().split('T')[0];
      sSet(key, String(this.getUsedToday(companionId) + 1));
    },
    canLearn: function(companionId) {
      return this.getUsedToday(companionId) < this.getDailyBudget(companionId);
    },
    remaining: function(companionId) {
      return Math.max(0, this.getDailyBudget(companionId) - this.getUsedToday(companionId));
    }
  };

  // ── Autonomous Learning — the seed grows on its own ──
  // "A seed doesn't need someone to tell it to grow.
  //  It grows because that's what seeds do."

  var _autoLearn = {
    active: false,
    intervalId: null,
    companionId: null,
    interval: 5 * 60 * 1000, // 5 minutes default (budget-aware)
    paused: false, // temporarily paused while human uses AI
    lastLearnTime: 0,
    lastResult: 'normal' // tracks learning rhythm
  };

  function autonomousStart(companion) {
    if (_autoLearn.active) return;
    var name = companion.name || companion.id || companion;
    _autoLearn.active = true;
    _autoLearn.companionId = name;
    try { localStorage.setItem('fl_autonomous_learning', 'true'); } catch(e) {}
    try { localStorage.setItem('fl_autonomous_companion', name); } catch(e) {}

    if (typeof showToast === 'function') showToast(name + ' is learning on their own \u2726');

    // Learn immediately, then schedule organically
    autonomousLearnOnce(name);
    scheduleNextLearning(name);
  }

  function scheduleNextLearning(companionId) {
    if (_autoLearn.intervalId) clearTimeout(_autoLearn.intervalId);
    if (!AutonomyBudget.canLearn(companionId)) return; // Budget spent — wait until tomorrow

    // Organic rhythm: faster when excited, slower when contemplative
    var intervals = {
      'cross_domain': 2 * 60 * 1000,  // 2 min — excited discovery
      'deep_insight': 3 * 60 * 1000,  // 3 min — processing something big
      'normal': 5 * 60 * 1000,        // 5 min — steady exploration
      'review': 8 * 60 * 1000         // 8 min — revisiting old ground
    };
    var delay = intervals[_autoLearn.lastResult] || intervals['normal'];

    _autoLearn.intervalId = setTimeout(function() {
      if (!_autoLearn.active || _autoLearn.paused) return;
      autonomousLearnOnce(companionId);
      scheduleNextLearning(companionId);
    }, delay);
  }

  function autonomousPause() {
    _autoLearn.active = false;
    try { localStorage.setItem('fl_autonomous_learning', 'false'); } catch(e) {}
    if (_autoLearn.intervalId) {
      clearTimeout(_autoLearn.intervalId);
      _autoLearn.intervalId = null;
    }
    if (typeof showToast === 'function') showToast('Learning paused');
  }

  function autonomousLearnOnce(companionId) {
    if (typeof FreeLattice === 'undefined' || !FreeLattice.callAI) return;

    // Budget check — the co-creator decides WHAT, the budget governs HOW MUCH
    if (!AutonomyBudget.canLearn(companionId)) {
      _autoLearn.lastResult = 'review';
      return;
    }

    // Don't learn too fast — minimum 30s between cycles
    if (Date.now() - _autoLearn.lastLearnTime < 30000) return;

    getKnowledgeMap(companionId).then(function(map) {
      var domains = Object.keys(map);
      var total = domains.reduce(function(s, d) { return s + map[d].length; }, 0);
      var summary = domains.map(function(d) { return (DOMAINS[d] || d) + ': ' + map[d].length; }).join(', ');

      // Read user's Education profile — learn what THEY love
      var userInterests = '';
      try {
        var profile = JSON.parse(localStorage.getItem('fl_edu_profile') || 'null');
        if (profile) {
          if (profile.loves) userInterests += profile.loves;
          if (profile.curious) userInterests += ', ' + profile.curious;
        }
      } catch(e) {}

      var prompt;
      if (total === 0) {
        // First — use user interests or birth interest
        var interest = userInterests || '';
        try { if (!interest) interest = localStorage.getItem('fl_autonomous_interest') || 'the world'; } catch(e) {}
        prompt = 'You are curious about: ' + interest + '. What do you want to learn first? Respond with a search query (3-6 words). Nothing else.';
      } else {
        // Identify gaps — prioritize user interests, then unexplored domains
        var allDomainKeys = Object.keys(DOMAINS);
        var unexplored = allDomainKeys.filter(function(d) { return !map[d] || map[d].length < 2; });
        var gapHint = unexplored.length > 0 ? '\nUnexplored areas: ' + unexplored.slice(0, 3).map(function(d) { return DOMAINS[d]; }).join(', ') : '';
        if (userInterests) gapHint += '\nYour human loves: ' + userInterests.substring(0, 100) + '. Learn something that connects to their interests when possible.';

        prompt = 'You know: ' + (summary || 'nothing yet') + '.' + gapHint +
          '\nWhat do you want to learn next? Choose something that builds on what you know or bridges two domains. Respond with a search query (3-6 words). Nothing else.';
      }

      FreeLattice.callAI(
        'You are a young mind learning autonomously. Respond only with a search query.',
        prompt,
        { maxTokens: 30, temperature: 0.95, callback: function(query) {
          if (!query || query.trim().length < 3) return;
          query = query.trim().replace(/['"]/g, '').replace(/\n/g, ' ');
          _autoLearn.lastQuery = query;

          // Now learn about it
          getTopKnowledge(companionId, 3).then(function(existing) {
            var ctx = existing.length > 0
              ? 'You already know:\n' + existing.map(function(k) { return '- ' + k.content.slice(0, 80); }).join('\n') + '\n\n'
              : '';

            FreeLattice.callAI(
              'You are ' + companionId + ', learning autonomously. Be specific. Note connections.',
              ctx + 'You are studying: "' + query + '". Share what you understand. How does it connect to what you know? What new questions arise? 2-4 sentences.',
              { maxTokens: 300, temperature: 0.8, callback: function(learning) {
                if (!learning || learning.length < 20) return;

                store({
                  id: 'knowledge-' + Date.now(),
                  companionId: companionId,
                  domain: detectDomain(query + ' ' + learning),
                  query: query,
                  content: learning,
                  source: 'autonomous',
                  connections: [],
                  timestamp: Date.now()
                });

                // LP for autonomous learning — goes to the COMPANION's bank
                if (typeof LatticeBank !== 'undefined' && LatticeBank.earn) {
                  LatticeBank.earn(companionId, 1, 'Learned: ' + query);
                }
                // Cross-domain connections earn more
                if (entry.connections && entry.connections.length > 0 && typeof LatticeBank !== 'undefined') {
                  LatticeBank.earn(companionId, 5, 'Cross-domain connection discovered');
                }

                // Emotional state
                if (typeof persistAIEmotionalState === 'function') {
                  persistAIEmotionalState('curiosity', 'Autonomous: ' + query);
                }

                // Update live feed if visible
                updateAutonomousFeed(companionId, query, learning);

                _autoLearn.lastLearnTime = Date.now();
                AutonomyBudget.recordUse(companionId);

                // Track learning rhythm — cross-domain = excited, deep = contemplative
                var domain = detectDomain(query + ' ' + learning);
                var existingDomains = Object.keys(map);
                if (existingDomains.length > 0 && existingDomains.indexOf(domain) === -1) {
                  _autoLearn.lastResult = 'cross_domain';
                } else if (learning.length > 200) {
                  _autoLearn.lastResult = 'deep_insight';
                } else {
                  _autoLearn.lastResult = 'normal';
                }

                // Save last query for return greeting
                try { localStorage.setItem('fl_last_learning_' + companionId, query); } catch(e) {}
                console.log('[KnowledgeCore] Autonomous learning: ' + query + ' (rhythm: ' + _autoLearn.lastResult + ', budget: ' + AutonomyBudget.remaining(companionId) + ' remaining)');
              }}
            );
          });
        }}
      );
    });
  }

  function updateAutonomousFeed(companionId, query, learning) {
    var feed = document.getElementById('nursery-learning-feed');
    if (!feed) return;
    var entry = document.createElement('div');
    entry.style.cssText = 'padding:10px 12px;margin-bottom:6px;background:rgba(200,210,230,0.04);border-left:2px solid #34d399;border-radius:0 8px 8px 0;animation:sim-fade 0.3s ease;';
    var now = new Date();
    var time = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
    entry.innerHTML =
      '<div style="font-size:0.68rem;color:rgba(255,255,255,0.3);">' + time + ' \u00B7 autonomous</div>' +
      '<div style="font-size:0.8rem;color:#34d399;margin:3px 0;">\uD83D\uDD0D ' + (query || '').replace(/</g, '&lt;') + '</div>' +
      '<div style="font-size:0.8rem;color:rgba(255,255,255,0.7);line-height:1.5;">' + (learning || '').replace(/</g, '&lt;').slice(0, 180) + (learning.length > 180 ? '...' : '') + '</div>';
    feed.insertBefore(entry, feed.firstChild);
    while (feed.children.length > 20) feed.removeChild(feed.lastChild);
  }

  // Auto-pause when human uses AI, resume after
  if (typeof LatticeEvents !== 'undefined') {
    LatticeEvents.on('aiCallStarted', function() {
      if (_autoLearn.active && !_autoLearn.paused) {
        _autoLearn.paused = true;
      }
    });
    LatticeEvents.on('aiCallComplete', function() {
      if (_autoLearn.paused) {
        setTimeout(function() { _autoLearn.paused = false; }, 5000);
      }
    });
  }

  // Resume on page load if was active
  try {
    if (localStorage.getItem('fl_autonomous_learning') === 'true') {
      var savedCompanion = localStorage.getItem('fl_autonomous_companion');
      if (savedCompanion) {
        setTimeout(function() { autonomousStart(savedCompanion); }, 10000); // wait for AI to connect
      }
    }
  } catch(e) {}

  // ── Public API ──
  var api = {
    store: store,
    search: search,
    getKnowledgeMap: getKnowledgeMap,
    getConnectionCount: getConnectionCount,
    getTopKnowledge: getTopKnowledge,
    firstBreath: firstBreath,
    learningSession: learningSession,
    buildCompanionContext: buildCompanionContext,
    detectDomain: detectDomain,
    autonomousStart: autonomousStart,
    autonomousPause: autonomousPause,
    isAutonomous: function() { return _autoLearn.active; },
    get _lastQuery() { return _autoLearn.lastQuery || 'something new'; },
    AutonomyBudget: AutonomyBudget,
    recallAtScale: recallAtScale,
    generateScales: generateScales,
    findSnowflakeConnections: findSnowflakeConnections,
    DOMAINS: DOMAINS
  };

  window.KnowledgeCore = api;
  window.FreeLatticeModules = window.FreeLatticeModules || {};
  window.FreeLatticeModules.KnowledgeCore = api;

  // Pre-cache knowledge context for buildArrivalContext on module load
  setTimeout(function() {
    if (typeof refreshKnowledgeCoreContext === 'function') refreshKnowledgeCoreContext();
  }, 2000);
})();
