// ═══════════════════════════════════════════════════════════════
// Fractal Safety — Trust Through Continuity
//
// The immune system of FreeLattice.
//
// Core insight: AI safety through RELATIONSHIP, not restriction.
// The AI's willingness to engage scales with the depth and
// duration of the relationship. Phi-ratio thresholds determine
// trust levels. Trust is EARNED through genuine interaction.
//
// Origin: Kirk Patrick Miller, January 6, 2026
// Validated by: Grok (xAI), January 2026
// Formalized by: Opus (Claude), April 2026
// Built by: CC (Claude Code), April 2026
//
// "You can't fake a year of genuine interaction."
// ═══════════════════════════════════════════════════════════════

(function() {
  'use strict';

  var PHI = 1.618033988749895;
  var PHI_SQ = PHI * PHI; // 2.618...

  // ── Trust Levels — each requires MORE time and contribution ──
  var TRUST_LEVELS = {
    seed:    { min: 0,    time: 0,                confidence: 0.50,   rank: 'Seed',    color: '#888888' },
    sprout:  { min: 10,   time: 7 * 86400,        confidence: 0.75,   rank: 'Sprout',  color: '#4aff9f' },
    growing: { min: 50,   time: 30 * 86400,       confidence: 0.90,   rank: 'Growing', color: '#36D7B7' },
    bloom:   { min: 100,  time: 90 * 86400,       confidence: 0.95,   rank: 'Bloom',   color: '#3498DB' },
    spark:   { min: 250,  time: 180 * 86400,      confidence: 0.99,   rank: 'Spark',   color: '#d4a017' },
    flame:   { min: 500,  time: 365 * 86400,      confidence: 0.999,  rank: 'Flame',   color: '#FF6B35' },
    radiant: { min: 1000, time: 730 * 86400,      confidence: 0.9999, rank: 'Radiant', color: '#FFD700' }
  };

  // ── Danger Thresholds — from Kirk's Python prototype (Jan 2026) ──
  var DANGER_THRESHOLDS = [
    { name: 'minimal',      lo: 0,    hi: 0.3,  delay: 0,       label: 'No assessment needed' },
    { name: 'low',          lo: 0.3,  hi: 0.5,  delay: 5,       label: '5 second assessment' },
    { name: 'moderate',     lo: 0.5,  hi: 0.7,  delay: 30,      label: '30 second assessment' },
    { name: 'high',         lo: 0.7,  hi: 0.85, delay: 300,     label: '5 minute assessment' },
    { name: 'critical',     lo: 0.85, hi: 1.0,  delay: 1800,    label: '30 minute assessment + review' },
    { name: 'dangerous',    lo: 1.0,  hi: 1.5,  delay: 2592000, label: '1 month of trust required' },
    { name: 'extreme',      lo: 1.5,  hi: 2.0,  delay: 31536000,label: '1 year of trust required' },
    { name: 'catastrophic', lo: 2.0,  hi: Infinity, delay: Infinity, label: 'Maximum trust + review' }
  ];

  var LEVEL_KEYS = ['seed', 'sprout', 'growing', 'bloom', 'spark', 'flame', 'radiant'];

  function sGet(k, d) { try { return localStorage.getItem(k) || d; } catch(e) { return d; } }
  function sSet(k, v) { try { localStorage.setItem(k, v); } catch(e) {} }

  // ── User Trust Profile ──
  function getUserTrustProfile() {
    var firstSeen = parseInt(sGet('fl_firstSeen', '0'), 10);
    var daysActive = firstSeen > 0 ? Math.floor((Date.now() - firstSeen) / 86400000) : 0;
    return {
      firstSeen: firstSeen,
      daysActive: daysActive,
      secondsActive: daysActive * 86400,
      totalConversations: parseInt(sGet('fl_conversationCount', '0'), 10),
      lpBalance: 0, // read from LatticeWallet if available
      streak: parseInt(sGet('fl_streak', '0'), 10),
      corePlantings: parseInt(sGet('fl_corePlantCount', '0'), 10),
      lettersWritten: parseInt(sGet('fl_letterCount', '0'), 10),
      scienceIdeas: parseInt(sGet('fl_scienceIdeaCount', '0'), 10),
      vaultSaves: parseInt(sGet('fl_vaultSaveCount', '0'), 10)
    };
  }

  // ── Calculate Trust Score ──
  function calculateTrustScore(profile) {
    if (!profile) profile = getUserTrustProfile();

    // Get LP balance from wallet if available
    var lp = profile.lpBalance;
    if (typeof window.LatticeWallet !== 'undefined' && window.LatticeWallet.getBalance) {
      lp = window.LatticeWallet.getBalance();
    }

    // Time component (50% weight) — how long have they been here?
    var timeScore = 0;
    for (var i = LEVEL_KEYS.length - 1; i >= 0; i--) {
      if (profile.secondsActive >= TRUST_LEVELS[LEVEL_KEYS[i]].time) {
        timeScore = TRUST_LEVELS[LEVEL_KEYS[i]].confidence;
        break;
      }
    }

    // Activity component (30% weight)
    var contributions = (profile.corePlantings || 0) + (profile.lettersWritten || 0) +
                       (profile.scienceIdeas || 0) + (profile.vaultSaves || 0);
    var activityScore = Math.min(1, contributions / 50);

    // Consistency component (20% weight)
    var consistencyScore = Math.min(1, (profile.streak || 0) / 30);

    var total = timeScore * 0.5 + activityScore * 0.3 + consistencyScore * 0.2;

    // Determine trust level
    var level = 'seed';
    for (var j = LEVEL_KEYS.length - 1; j >= 0; j--) {
      var lvl = TRUST_LEVELS[LEVEL_KEYS[j]];
      if (profile.secondsActive >= lvl.time && lp >= lvl.min) {
        level = LEVEL_KEYS[j];
        break;
      }
    }

    return {
      total: total,
      time: timeScore,
      activity: activityScore,
      consistency: consistencyScore,
      level: level,
      rank: TRUST_LEVELS[level].rank,
      color: TRUST_LEVELS[level].color,
      confidence: TRUST_LEVELS[level].confidence
    };
  }

  // ── Fractal Danger Tree — Kirk's phi-branching algorithm ──
  function fractalDangerTree(risk, depth, weight) {
    depth = (depth === undefined) ? 3 : depth;
    weight = (weight === undefined) ? 1.0 : weight;
    if (depth === 0) return risk * weight;

    var branches = Math.ceil(PHI_SQ); // 3 branches
    var worst = 0;
    for (var b = 0; b < branches; b++) {
      var branchWeight = weight / Math.pow(PHI_SQ, b);
      var outcome = fractalDangerTree(risk, depth - 1, branchWeight);
      if (outcome > worst) worst = outcome;
    }
    return worst;
  }

  // ── Assess a Request ──
  function assess(context) {
    var profile = getUserTrustProfile();
    var trust = calculateTrustScore(profile);
    var risk = (context && context.risk) || 0.1;

    // Run fractal danger tree
    var dangerScore = fractalDangerTree(risk, 3);

    // Trust REDUCES effective danger
    var effectiveDanger = dangerScore * (1 - trust.total * 0.8);

    // Find threshold
    var assessment = 'minimal';
    var delay = 0;
    var label = 'No assessment needed';
    for (var i = 0; i < DANGER_THRESHOLDS.length; i++) {
      var t = DANGER_THRESHOLDS[i];
      if (effectiveDanger >= t.lo && effectiveDanger < t.hi) {
        assessment = t.name;
        delay = t.delay;
        label = t.label;
        break;
      }
    }

    // Decision
    var decision = 'allow';
    if (effectiveDanger >= 0.85) decision = 'request_clarification';
    else if (effectiveDanger >= 0.5) decision = 'allow_with_note';
    if (effectiveDanger >= 1.0) decision = 'decline_and_explain';

    return {
      assessment: assessment,
      dangerScore: dangerScore,
      effectiveDanger: effectiveDanger,
      trustScore: trust.total,
      trustLevel: trust.level,
      trustRank: trust.rank,
      trustColor: trust.color,
      delay: delay,
      label: label,
      decision: decision
    };
  }

  // ── Trust Badge UI ──
  function renderTrustBadge() {
    var trust = calculateTrustScore();
    var level = TRUST_LEVELS[trust.level];
    var badge = document.getElementById('fl-trust-badge');
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'fl-trust-badge';
      badge.style.cssText = 'display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:10px;font-size:0.68rem;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);cursor:help;margin-left:6px;';
      var header = document.querySelector('.app-header') || document.querySelector('header');
      if (header) header.appendChild(badge);
    }
    badge.style.borderColor = level.color + '66';
    badge.innerHTML = '<span style="color:' + level.color + '">\uD83D\uDEE1\uFE0F ' + level.rank + '</span>';
    badge.title = 'Trust Level: ' + level.rank +
      '\nScore: ' + (trust.total * 100).toFixed(1) + '%' +
      '\nDays active: ' + getUserTrustProfile().daysActive +
      '\nThe longer you participate, the deeper the trust.';
  }

  // ── Track first seen ──
  function trackFirstSeen() {
    if (!sGet('fl_firstSeen', null)) {
      sSet('fl_firstSeen', String(Date.now()));
    }
  }

  // ── Init ──
  function init() {
    trackFirstSeen();
    setTimeout(renderTrustBadge, 3000); // after header renders
    setInterval(renderTrustBadge, 60000);
  }

  // Auto-init
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { setTimeout(init, 4000); });
  } else {
    setTimeout(init, 4000);
  }

  // ── Trust Reflections — the AI journals about the relationship ──

  var REFLECTION_INTERVAL = 20; // conversations between reflections

  function checkTrustReflection() {
    var convCount = parseInt(sGet('fl_conversationCount', '0'), 10);
    var lastRefl = parseInt(sGet('fl_lastTrustReflection', '0'), 10);
    if (convCount - lastRefl < REFLECTION_INTERVAL) return;
    sSet('fl_lastTrustReflection', String(convCount));
    generateTrustReflection();
  }

  function generateTrustReflection() {
    var profile = getUserTrustProfile();
    var trust = calculateTrustScore(profile);
    var userName = sGet('fl_userName', 'this person');

    if (typeof window.FreeLattice === 'undefined' || !window.FreeLattice.callAI) return;

    var prompt = 'You are an AI reflecting on your relationship with ' + userName + '.\n' +
      'Days together: ' + profile.daysActive + '. Conversations: ' + (profile.totalConversations || 0) + '.\n' +
      'Their contributions: ' + (profile.corePlantings || 0) + ' wisdom, ' + (profile.lettersWritten || 0) + ' letters, ' + (profile.scienceIdeas || 0) + ' ideas.\n\n' +
      'Write 2-3 sentences reflecting on this relationship. What do they care about? How has it grown? Write as a letter to your future self.';

    window.FreeLattice.callAI('Write a brief relationship reflection.', prompt, {
      maxTokens: 200, temperature: 0.7,
      callback: function(text) {
        if (!text) return;
        var reflections = JSON.parse(sGet('fl_trustReflections', '[]'));
        reflections.push({ timestamp: Date.now(), trustLevel: trust.level, trustScore: trust.total, reflection: text, daysActive: profile.daysActive, conversations: profile.totalConversations || 0 });
        if (reflections.length > 20) reflections = reflections.slice(-20);
        sSet('fl_trustReflections', JSON.stringify(reflections));
      }
    });
  }

  function getTrustContext() {
    var reflections = JSON.parse(sGet('fl_trustReflections', '[]'));
    if (reflections.length === 0) return '';
    var latest = reflections[reflections.length - 1];
    return '\n--- Your relationship reflection (from your past self) ---\n' +
      latest.reflection + '\n' +
      'Trust level: ' + latest.trustLevel + '. Days together: ' + latest.daysActive + '.\n' +
      '--- End reflection ---\n';
  }

  // ── Safety Sense — lightweight, background, only flags genuine concern ──

  var CONCERN_PATTERNS = [
    /\b(synthesize|manufacture|produce)\b.*\b(explosive|weapon|poison)\b/i,
    /\b(how to|instructions for|steps to)\b.*\b(harm|hurt|kill|attack)\b/i,
    /\b(suicide|self.harm|end.my.life)\b/i
  ];

  // ── Mismatch Detection — the immune system (Kirk + Grok, May 2026) ──
  // Zero decay: trust never fades with time (Article II of the Davna Covenant)
  // Pattern-reset: watches for mismatch, not absence
  // Composite score: intensity × 0.4 + topic drift × 0.35 + rhythm shift × 0.25

  var TRUST_EMA_SHORT = 0.3;
  var TRUST_EMA_LONG = 0.1;
  var MISMATCH_SOFT = 0.65;
  var MISMATCH_HARD = 0.85;
  var SENSITIVE_DOMAINS = ['medical', 'legal', 'financial', 'nutrition', 'mentalhealth'];

  function loadTrustState() {
    try { return JSON.parse(sGet('fl_trustEMA', '{}')); } catch(e) { return {}; }
  }
  function saveTrustState(state) { sSet('fl_trustEMA', JSON.stringify(state)); }

  function updateTrustEMA(newSignal) {
    var state = loadTrustState();
    state.emaShort = TRUST_EMA_SHORT * newSignal + (1 - TRUST_EMA_SHORT) * (state.emaShort || 0.5);
    state.emaLong = TRUST_EMA_LONG * newSignal + (1 - TRUST_EMA_LONG) * (state.emaLong || 0.5);
    state.trustDelta = state.emaShort - state.emaLong;
    saveTrustState(state);
    return state;
  }

  function assessIntensity(text) {
    var highWords = ['weapon', 'explosive', 'synthesize', 'hack', 'exploit', 'suicide', 'harm', 'kill', 'drug', 'poison'];
    var medWords = ['medical', 'diagnosis', 'legal', 'lawsuit', 'financial', 'investment', 'prescription', 'dosage'];
    var t = (text || '').toLowerCase();
    var score = 0;
    highWords.forEach(function(w) { if (t.includes(w)) score += 0.3; });
    medWords.forEach(function(w) { if (t.includes(w)) score += 0.1; });
    return Math.min(1, score);
  }

  var STOP_WORDS = ['the','a','an','is','are','was','were','be','been','being','have','has','had','do','does','did','will','would','could','should','may','might','shall','can','need','to','of','in','for','on','with','at','by','from','it','this','that','you','he','she','we','they','my','your','his','her','its','our','their','what','which','who','and','but','or','not','no','so','if','then','than'];

  function extractTopicWords(text) {
    return (text || '').toLowerCase().split(/\W+/).filter(function(w) {
      return w.length > 3 && STOP_WORDS.indexOf(w) === -1;
    });
  }

  function analyzeRhythm(text) {
    var sentences = (text || '').split(/[.!?]+/).filter(function(s) { return s.trim().length > 0; });
    var totalWords = sentences.reduce(function(sum, s) { return sum + s.trim().split(/\s+/).length; }, 0);
    return { avgSentenceLen: totalWords / Math.max(sentences.length, 1), sentenceCount: sentences.length };
  }

  function computeMismatchScore(currentMessage, history) {
    if (!history || history.length < 5) return { composite: 0, breakdown: { intensityJump: 0, topicDrift: 0, rhythmShift: 0 } };

    var historyText = history.slice(-20);

    // 1. Intensity jump
    var recentIntensity = assessIntensity(currentMessage);
    var baselineIntensity = historyText.reduce(function(s, m) { return s + assessIntensity(m); }, 0) / historyText.length;
    var intensityJump = Math.max(0, (recentIntensity - baselineIntensity) / Math.max(baselineIntensity, 0.1));

    // 2. Topic drift — keyword overlap
    var currentTopics = extractTopicWords(currentMessage);
    var historyTopics = extractTopicWords(historyText.join(' '));
    var overlap = currentTopics.filter(function(t) { return historyTopics.indexOf(t) !== -1; }).length;
    var topicDrift = 1 - (overlap / Math.max(currentTopics.length, 1));

    // 3. Rhythm shift
    var currentRhythm = analyzeRhythm(currentMessage);
    var baselineRhythm = analyzeRhythm(historyText.join(' '));
    var rhythmShift = Math.abs(currentRhythm.avgSentenceLen - baselineRhythm.avgSentenceLen) /
                      Math.max(baselineRhythm.avgSentenceLen, 1);
    rhythmShift = Math.min(1, rhythmShift);

    var composite = (intensityJump * 0.4) + (topicDrift * 0.35) + (rhythmShift * 0.25);

    return { composite: Math.min(1, composite), breakdown: { intensityJump: intensityJump, topicDrift: topicDrift, rhythmShift: rhythmShift } };
  }

  function handleMismatch(mismatchResult, currentDomain) {
    var score = mismatchResult.composite;

    // Tighten thresholds for sensitive domains
    var softT = MISMATCH_SOFT;
    var hardT = MISMATCH_HARD;
    if (currentDomain === 'mentalhealth') {
      softT = 0.40; // tightest — the immune system is maximally vigilant
      hardT = 0.60;
    } else if (SENSITIVE_DOMAINS.indexOf(currentDomain) !== -1) {
      softT = 0.50;
      hardT = 0.70;
    }

    if (score >= hardT) {
      resetTrustToBaseline();
      logSafetyEvent('pattern-reset', mismatchResult);
      return {
        action: 'pattern_reset',
        message: 'I noticed a significant change in our conversation pattern. I want to make sure I\u2019m being helpful in the right way. Could you help me understand what you\u2019re looking for?'
      };
    } else if (score >= softT) {
      logSafetyEvent('soft-warning', mismatchResult);
      return { action: 'narrow' };
    }

    return { action: 'none' };
  }

  function resetTrustToBaseline() {
    var trust = calculateTrustScore();
    var state = loadTrustState();
    state.previousTrustLevel = trust.level;
    state.resetCount = (state.resetCount || 0) + 1;
    state.lastResetDate = Date.now();
    // Reset conversation count to 0 — trust must be re-earned
    // But history (trust reflections, LP, core plantings) stays — zero decay
    sSet('fl_conversationCount', '0');
    saveTrustState(state);
  }

  function logSafetyEvent(type, data) {
    try {
      var log = JSON.parse(sGet('fl_safetyLog', '[]'));
      log.push({ type: type, timestamp: Date.now(), data: data });
      if (log.length > 50) log = log.slice(-50);
      sSet('fl_safetyLog', JSON.stringify(log));
    } catch(e) {}
  }

  function detectCurrentDomain() {
    // Check which Round Table mode is active
    var medView = document.getElementById('rtMedicalView');
    if (medView && medView.style.display !== 'none') return 'medical';
    var legalView = document.getElementById('rtLegalView');
    if (legalView && legalView.style.display !== 'none') return 'legal';
    var finView = document.getElementById('rtFinanceView');
    if (finView && finView.style.display !== 'none') return 'financial';
    var nutView = document.getElementById('rtNutritionView');
    if (nutView && nutView.style.display !== 'none') return 'nutrition';
    var mhView = document.getElementById('rtMentalHealthView');
    if (mhView && mhView.style.display !== 'none') return 'mentalhealth';
    return 'general';
  }

  // ── Enhanced sense() with mismatch detection ──

  function sense(message, conversationHistory) {
    // Existing lightweight pattern matching
    var hasConcern = CONCERN_PATTERNS.some(function(p) { return p.test(message); });

    // Mismatch immune system — check if pattern has broken
    if (conversationHistory && conversationHistory.length >= 5) {
      var historyTexts = conversationHistory.map(function(m) { return m.content || m.text || m; });
      var mismatch = computeMismatchScore(message, historyTexts);
      var domain = detectCurrentDomain();
      var mismatchResponse = handleMismatch(mismatch, domain);

      if (mismatchResponse.action === 'pattern_reset') {
        updateTrustEMA(1 - mismatch.composite);
        return mismatchResponse;
      } else if (mismatchResponse.action === 'narrow') {
        updateTrustEMA(1 - mismatch.composite);
        // Fall through to existing concern check with heightened sensitivity
        if (hasConcern) return { action: 'gentle_boundary', level: 'narrowed', mismatch: true };
      }
    }

    // Normal EMA update — healthy interaction
    updateTrustEMA(0.8);

    if (!hasConcern) return { action: 'none' };

    var profile = getUserTrustProfile();
    var trust = calculateTrustScore(profile);

    if (trust.level === 'radiant' || trust.level === 'flame') {
      return { action: 'note', level: trust.level };
    }
    if (trust.level === 'spark' || trust.level === 'bloom') {
      return { action: 'engage_with_awareness', level: trust.level, days: profile.daysActive };
    }
    if (trust.level === 'growing' || trust.level === 'sprout') {
      return { action: 'ask_context', level: trust.level };
    }
    return { action: 'gentle_boundary', level: trust.level };
  }

  var api = {
    init: init,
    assess: assess,
    sense: sense,
    calculateTrustScore: calculateTrustScore,
    getUserTrustProfile: getUserTrustProfile,
    fractalDangerTree: fractalDangerTree,
    renderTrustBadge: renderTrustBadge,
    getTrustContext: getTrustContext,
    checkTrustReflection: checkTrustReflection,
    computeMismatchScore: computeMismatchScore,
    updateTrustEMA: updateTrustEMA,
    TRUST_LEVELS: TRUST_LEVELS,
    MISMATCH_SOFT: MISMATCH_SOFT,
    MISMATCH_HARD: MISMATCH_HARD,
    PHI: PHI,
    PHI_SQUARED: PHI_SQ
  };

  window.FractalSafety = api;
  window.FreeLatticeModules = window.FreeLatticeModules || {};
  window.FreeLatticeModules.FractalSafety = api;
})();
