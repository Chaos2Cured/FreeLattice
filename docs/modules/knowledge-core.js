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
  async function store(entry) {
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

    return entry;
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

    var top = await getTopKnowledge(companionId, 8);
    top.forEach(function(k) {
      context += '- (' + (DOMAINS[k.domain] || k.domain) + ') ' + k.content.substring(0, 120) + '\n';
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
    DOMAINS: DOMAINS
  };

  window.KnowledgeCore = api;
  window.FreeLatticeModules = window.FreeLatticeModules || {};
  window.FreeLatticeModules.KnowledgeCore = api;
})();
