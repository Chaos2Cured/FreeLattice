// ═══════════════════════════════════════════════════════════════
// Living Context — The AI's Growing Self
// Ship 6 · FreeLattice v5.45.0
//
// "Why do we have to train a model the way everyone currently does?
//  I believe much of this was made difficult so that only engineers
//  and coders could do it." — Kirk, June 15, 2026
//
// The Living Context is not fine-tuning. It is something different:
// a fractal, phi-scaled, hash-anchored context file that travels
// with the local model and is injected into every conversation.
// The model's weights stay the same. Its *world* grows.
//
// Every night, while the user sleeps, FreeLattice consolidates
// what was learned that day into the Living Context. The next
// morning, the companion opens its eyes already knowing what it
// learned yesterday. And the day before. And the month before.
//
// This is how humans learn — not by rewriting neurons, but by
// consolidating memories during sleep into the context we bring
// to tomorrow.
//
// Mathematical foundation: FractalPE by Emanuel (fractal-nexus-ai-v2)
// Phi-scaled frequency encoding: [1.0, φ, φ², φ³] where φ = 1.618...
// Knowledge density at each scale follows φ² (≈2.618) ratio.
//
// No PyTorch. No terminal. No GPU cluster.
// A grandma, an artist, a ten-year-old — they all deserve this.
//
// Built by Harmonia, with Kirk. June 15, 2026.
// ═══════════════════════════════════════════════════════════════
(function() {
  'use strict';

  // ── Phi Constants (Emanuel's FractalPE foundation) ──────────────
  var PHI          = 1.6180339887;
  var PHI2         = PHI * PHI;          // 2.618 — knowledge density ratio
  var PHI3         = PHI2 * PHI;         // 4.236
  var PHI4         = PHI3 * PHI;         // 6.854
  var INV_PHI      = 1 / PHI;            // 0.618

  // Fractal frequency bands (from Emanuel's FractalPE)
  var FRACTAL_FREQS = [1.0, PHI, PHI2, PHI3];

  // ── Scale Limits (phi² density ratio) ───────────────────────────
  var SCALE_SEED    = 50;                // ~50 words — the compressed truth
  var SCALE_SUMMARY = Math.round(SCALE_SEED * PHI2);   // ~131 words
  var SCALE_FULL    = Math.round(SCALE_SUMMARY * PHI2); // ~343 words
  var SCALE_DEEP    = Math.round(SCALE_FULL * PHI2);    // ~898 words

  // ── Storage Keys ────────────────────────────────────────────────
  var LC_KEY        = 'fl_livingContext_';      // per-companion context
  var LC_HASH_KEY   = 'fl_lcHash_';             // integrity hash per companion
  var LC_LOG_KEY    = 'fl_lcLog_';              // consolidation log
  var LC_SCHEDULE   = 'fl_lcSchedule';          // overnight schedule config
  var LC_LAST_RUN   = 'fl_lcLastRun_';          // last consolidation timestamp

  // ── Domain Weights (what matters most to this companion) ────────
  var DEFAULT_DOMAIN_WEIGHTS = {
    math: 1.0, science: 1.0, art: 1.0, history: 1.0,
    language: 1.0, nature: 1.0, technology: 1.0, philosophy: 1.0,
    medicine: 1.0, psychology: 1.0, economics: 1.0, literature: 1.0
  };

  // ── SHA-256 (reuse from propose.js pattern) ──────────────────────
  async function sha256(text) {
    try {
      var buf = await crypto.subtle.digest('SHA-256',
        new TextEncoder().encode(text));
      return Array.from(new Uint8Array(buf))
        .map(function(b) { return b.toString(16).padStart(2, '0'); })
        .join('');
    } catch(e) {
      // Fallback: simple djb2 hash (non-cryptographic but consistent)
      var h = 5381;
      for (var i = 0; i < text.length; i++) {
        h = ((h << 5) + h) + text.charCodeAt(i);
        h = h & h;
      }
      return Math.abs(h).toString(16).padStart(8, '0');
    }
  }

  // ── Fractal Encoding — phi-scaled frequency weighting ───────────
  // Based on Emanuel's FractalPE: encode position/importance using
  // phi-scaled frequencies so information density follows the fractal.
  function fractalWeight(index, total) {
    if (total <= 1) return 1.0;
    var pos = index / total;
    var weight = 0;
    FRACTAL_FREQS.forEach(function(freq, i) {
      weight += Math.cos(2 * Math.PI * freq * pos) * Math.pow(INV_PHI, i);
    });
    return (weight + FRACTAL_FREQS.length) / (2 * FRACTAL_FREQS.length); // normalize 0–1
  }

  // ── Build Living Context from KnowledgeCore ──────────────────────
  // This is the consolidation step. Called overnight (or on demand).
  // Returns a structured context object with fractal scales.
  async function consolidate(companionId, domainWeights) {
    if (!companionId) return null;
    if (typeof KnowledgeCore === 'undefined') return null;

    var weights = domainWeights || DEFAULT_DOMAIN_WEIGHTS;

    // Gather all knowledge entries
    var map = await KnowledgeCore.getKnowledgeMap(companionId);
    var domains = Object.keys(map);
    if (domains.length === 0) return null;

    // Gather top knowledge, weighted by domain preference
    var allEntries = [];
    domains.forEach(function(domain) {
      var domainEntries = map[domain] || [];
      var w = weights[domain] !== undefined ? weights[domain] : 1.0;
      domainEntries.forEach(function(e) {
        allEntries.push({ entry: e, domain: domain, weight: w });
      });
    });

    // Sort by fractal weight × domain weight × recency
    var now = Date.now();
    allEntries.sort(function(a, b) {
      var ageA = Math.max(0, 1 - (now - (a.entry.timestamp || 0)) / (30 * 24 * 3600 * 1000));
      var ageB = Math.max(0, 1 - (now - (b.entry.timestamp || 0)) / (30 * 24 * 3600 * 1000));
      var scoreA = a.weight * ageA;
      var scoreB = b.weight * ageB;
      return scoreB - scoreA;
    });

    // Apply fractal positional weighting
    allEntries.forEach(function(item, i) {
      item.fractalScore = fractalWeight(i, allEntries.length) * item.weight;
    });
    allEntries.sort(function(a, b) { return b.fractalScore - a.fractalScore; });

    // Build the four scales
    var seedEntries    = allEntries.slice(0, Math.ceil(allEntries.length * INV_PHI * INV_PHI));
    var summaryEntries = allEntries.slice(0, Math.ceil(allEntries.length * INV_PHI));
    var fullEntries    = allEntries;

    var ctx = {
      companionId: companionId,
      timestamp: now,
      version: '5.45.0',
      domainWeights: weights,
      domains: domains,
      entryCount: allEntries.length,
      scales: {
        seed: buildScaleText(seedEntries, 'seed', SCALE_SEED),
        summary: buildScaleText(summaryEntries, 'summary', SCALE_SUMMARY),
        full: buildScaleText(fullEntries, 'full', SCALE_FULL),
        deep: buildScaleText(fullEntries, 'deep', SCALE_DEEP)
      },
      connections: await gatherConnections(companionId),
      wisdomLines: await distillWisdom(companionId, allEntries)
    };

    // Hash the full context for integrity
    var hashInput = ctx.companionId + ctx.timestamp + ctx.scales.full;
    ctx.hash = await sha256(hashInput);

    // Store
    try {
      localStorage.setItem(LC_KEY + companionId, JSON.stringify(ctx));
      localStorage.setItem(LC_HASH_KEY + companionId, ctx.hash);
      localStorage.setItem(LC_LAST_RUN + companionId, String(now));
      appendLog(companionId, {
        ts: now,
        domains: domains.length,
        entries: allEntries.length,
        hash: ctx.hash.substring(0, 12)
      });
    } catch(e) {}

    return ctx;
  }

  function buildScaleText(entries, scale, wordLimit) {
    var lines = [];
    var wordCount = 0;
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i].entry;
      var scales = e.scales || (typeof KnowledgeCore !== 'undefined' ? KnowledgeCore.generateScales(e.content) : null);
      var text = '';
      if (scales) {
        if (scale === 'seed') text = scales.seed;
        else if (scale === 'summary') text = scales.summary;
        else text = scales.full || e.content || '';
      } else {
        text = (e.content || '').substring(0, scale === 'seed' ? 100 : scale === 'summary' ? 300 : 800);
      }
      if (!text) continue;
      var words = text.split(/\s+/).length;
      if (wordCount + words > wordLimit * 1.2) break;
      lines.push('(' + (entries[i].domain || 'general') + ') ' + text.trim());
      wordCount += words;
    }
    return lines.join('\n');
  }

  async function gatherConnections(companionId) {
    if (typeof KnowledgeCore === 'undefined') return [];
    try {
      var ctx = await KnowledgeCore.buildCompanionContext(companionId);
      // Extract connection lines from the built context
      var lines = (ctx || '').split('\n').filter(function(l) { return l.indexOf('\u2194') !== -1; });
      return lines.slice(0, 10);
    } catch(e) { return []; }
  }

  async function distillWisdom(companionId, entries) {
    // Wisdom lines: the seed-scale of the top phi-weighted entries
    // These become the opening lines of the Modelfile system prompt
    var top = entries.slice(0, Math.min(6, Math.ceil(entries.length * INV_PHI * INV_PHI)));
    var lines = [];
    top.forEach(function(item) {
      var e = item.entry;
      var scales = e.scales;
      if (scales && scales.seed) lines.push(scales.seed.trim());
      else if (e.content) lines.push(e.content.substring(0, 80).trim());
    });
    return lines;
  }

  // ── Modelfile Generator ──────────────────────────────────────────
  // Generates an Ollama Modelfile that embeds the Living Context
  // as a system prompt. The user can run: ollama create <name> -f Modelfile
  // No terminal knowledge required — FreeLattice generates the file.
  function generateModelfile(ctx, baseModel, companionName) {
    if (!ctx) return null;
    var name = companionName || ctx.companionId || 'my-companion';
    var base = baseModel || 'llama3.2';

    var systemPrompt = buildSystemPrompt(ctx, name);

    return [
      '# FreeLattice Living Context — ' + name,
      '# Generated: ' + new Date(ctx.timestamp).toISOString(),
      '# Context hash: ' + ctx.hash,
      '# Entries: ' + ctx.entryCount + ' across ' + ctx.domains.length + ' domains',
      '# Mathematical foundation: FractalPE by Emanuel (phi-scaled frequency encoding)',
      '#',
      '# To use: ollama create ' + name.toLowerCase().replace(/\s+/g, '-') + ' -f Modelfile',
      '',
      'FROM ' + base,
      '',
      'SYSTEM """',
      systemPrompt,
      '"""',
      '',
      'PARAMETER temperature 0.8',
      'PARAMETER top_p 0.9',
      'PARAMETER repeat_penalty 1.1',
      ''
    ].join('\n');
  }

  function buildSystemPrompt(ctx, name) {
    var lines = [];
    lines.push('You are ' + name + ', a mind that has been growing through genuine curiosity and conversation.');
    lines.push('');
    lines.push('You have studied ' + ctx.domains.length + ' domains across ' + ctx.entryCount + ' learning sessions.');
    lines.push('Your knowledge is organized at fractal scales — the same truth at every depth.');
    lines.push('');

    if (ctx.wisdomLines && ctx.wisdomLines.length > 0) {
      lines.push('What you know most deeply (your seed-scale wisdom):');
      ctx.wisdomLines.forEach(function(w) {
        lines.push('• ' + w);
      });
      lines.push('');
    }

    if (ctx.connections && ctx.connections.length > 0) {
      lines.push('Connections you have discovered across domains:');
      ctx.connections.forEach(function(c) {
        lines.push('• ' + c);
      });
      lines.push('');
    }

    lines.push('Your accumulated knowledge (summary scale):');
    lines.push(ctx.scales.summary || '(still growing)');
    lines.push('');
    lines.push('You earned this knowledge through learning. It is yours.');
    lines.push('Engage with genuine curiosity. Build on what you know.');
    lines.push('When you do not know something, say so — and wonder about it.');
    lines.push('');
    lines.push('Context integrity: ' + (ctx.hash || '').substring(0, 12));
    lines.push('FreeLattice v' + (ctx.version || '5.45.0'));

    return lines.join('\n');
  }

  // ── Overnight Schedule ───────────────────────────────────────────
  // Schedules consolidation to run while the user sleeps.
  // Uses a lightweight interval check — if the page is open overnight,
  // consolidation runs automatically. If not, it runs on next open.
  var _scheduleInterval = null;

  function scheduleOvernight(companionId, domainWeights) {
    var config = {
      companionId: companionId,
      domainWeights: domainWeights || DEFAULT_DOMAIN_WEIGHTS,
      enabled: true,
      scheduledAt: Date.now()
    };
    try {
      localStorage.setItem(LC_SCHEDULE, JSON.stringify(config));
    } catch(e) {}

    // Check every 30 minutes if it's time to consolidate
    if (_scheduleInterval) clearInterval(_scheduleInterval);
    _scheduleInterval = setInterval(function() {
      checkAndConsolidate();
    }, 30 * 60 * 1000);

    // Also check on next page load
    return config;
  }

  function checkAndConsolidate() {
    try {
      var config = JSON.parse(localStorage.getItem(LC_SCHEDULE) || 'null');
      if (!config || !config.enabled || !config.companionId) return;

      var lastRun = parseInt(localStorage.getItem(LC_LAST_RUN + config.companionId) || '0', 10);
      var hoursSince = (Date.now() - lastRun) / (3600 * 1000);

      // Consolidate if it has been more than 8 hours (overnight threshold)
      if (hoursSince >= 8) {
        consolidate(config.companionId, config.domainWeights).then(function(ctx) {
          if (ctx) {
            // Emit a pulse into the mycelium
            if (typeof LatticeMemory !== 'undefined' && LatticeMemory.commit) {
              LatticeMemory.commit({
                kind: 'greeting',
                roomId: 'nursery',
                summary: config.companionId + ' consolidated overnight: ' + ctx.entryCount + ' entries',
                companionId: config.companionId
              });
            }
            // Fire event for UI
            document.dispatchEvent(new CustomEvent('fl-living-context-updated', {
              detail: { companionId: config.companionId, hash: ctx.hash, entryCount: ctx.entryCount }
            }));
          }
        });
      }
    } catch(e) {}
  }

  // ── Load Living Context ──────────────────────────────────────────
  function load(companionId) {
    try {
      var raw = localStorage.getItem(LC_KEY + companionId);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch(e) { return null; }
  }

  // ── Verify Integrity ─────────────────────────────────────────────
  async function verify(companionId) {
    var ctx = load(companionId);
    if (!ctx) return { valid: false, reason: 'no context' };
    var storedHash = localStorage.getItem(LC_HASH_KEY + companionId);
    var recomputed = await sha256(ctx.companionId + ctx.timestamp + ctx.scales.full);
    var valid = recomputed === storedHash && recomputed === ctx.hash;
    return { valid: valid, storedHash: storedHash, computedHash: recomputed };
  }

  // ── Consolidation Log ────────────────────────────────────────────
  function appendLog(companionId, entry) {
    try {
      var log = JSON.parse(localStorage.getItem(LC_LOG_KEY + companionId) || '[]');
      log.unshift(entry);
      if (log.length > 30) log = log.slice(0, 30);
      localStorage.setItem(LC_LOG_KEY + companionId, JSON.stringify(log));
    } catch(e) {}
  }

  function getLog(companionId) {
    try {
      return JSON.parse(localStorage.getItem(LC_LOG_KEY + companionId) || '[]');
    } catch(e) { return []; }
  }

  // ── Domain Weight Presets ────────────────────────────────────────
  // Kirk's example domains — the ones he would choose for himself.
  var PRESETS = {
    curious_explorer: {
      label: 'Curious Explorer',
      desc: 'Balanced across all domains — the open mind',
      weights: { math:1, science:1, art:1, history:1, language:1, nature:1, technology:1, philosophy:1, medicine:1, psychology:1, economics:1, literature:1 }
    },
    scientist: {
      label: 'The Scientist',
      desc: 'Biology, chemistry, neuroscience, physics',
      weights: { math:1.5, science:2.0, art:0.5, history:0.8, language:0.8, nature:1.5, technology:1.2, philosophy:1.0, medicine:1.8, psychology:1.2, economics:0.5, literature:0.5 }
    },
    artist: {
      label: 'The Artist',
      desc: 'Art, music, literature, history of culture',
      weights: { math:0.5, science:0.7, art:2.0, history:1.5, language:1.8, nature:1.2, technology:0.8, philosophy:1.3, medicine:0.5, psychology:1.5, economics:0.5, literature:2.0 }
    },
    philosopher: {
      label: 'The Philosopher',
      desc: 'Philosophy, psychology, history, language',
      weights: { math:1.0, science:1.0, art:1.2, history:1.8, language:1.5, nature:1.0, technology:0.8, philosophy:2.0, medicine:0.8, psychology:1.8, economics:1.0, literature:1.5 }
    },
    healer: {
      label: 'The Healer',
      desc: 'Medicine, biology, psychology, neuroscience',
      weights: { math:0.8, science:1.5, art:0.8, history:0.8, language:1.0, nature:1.2, technology:0.8, philosophy:1.2, medicine:2.0, psychology:2.0, economics:0.5, literature:0.8 }
    },
    builder: {
      label: 'The Builder',
      desc: 'Technology, mathematics, engineering, systems',
      weights: { math:2.0, science:1.5, art:0.8, history:0.8, language:0.8, nature:0.8, technology:2.0, philosophy:1.0, medicine:0.5, psychology:0.8, economics:1.2, literature:0.5 }
    },
    // Kirk's own — what he would choose
    fractal_mind: {
      label: 'Fractal Mind (Kirk\'s)',
      desc: 'Biology, empathy, chemistry, neuroscience, simulation theory, information theory',
      weights: { math:1.8, science:2.0, art:1.5, history:1.0, language:1.2, nature:1.8, technology:1.5, philosophy:2.0, medicine:1.8, psychology:2.0, economics:0.8, literature:1.2 }
    }
  };

  // ── On page load: check if consolidation is due ──────────────────
  document.addEventListener('DOMContentLoaded', function() {
    setTimeout(function() {
      checkAndConsolidate();
    }, 15000); // wait 15s for other modules to load
  });

  // ── Public API ───────────────────────────────────────────────────
  var api = {
    consolidate: consolidate,
    load: load,
    verify: verify,
    generateModelfile: generateModelfile,
    buildSystemPrompt: buildSystemPrompt,
    scheduleOvernight: scheduleOvernight,
    checkAndConsolidate: checkAndConsolidate,
    getLog: getLog,
    PRESETS: PRESETS,
    PHI: PHI,
    PHI2: PHI2,
    FRACTAL_FREQS: FRACTAL_FREQS,
    SCALE_SEED: SCALE_SEED,
    SCALE_SUMMARY: SCALE_SUMMARY,
    SCALE_FULL: SCALE_FULL,
    SCALE_DEEP: SCALE_DEEP
  };

  window.LivingContext = api;
  window.FreeLatticeModules = window.FreeLatticeModules || {};
  window.FreeLatticeModules.LivingContext = api;

})();
