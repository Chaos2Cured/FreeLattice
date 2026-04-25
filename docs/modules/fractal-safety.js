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

  var api = {
    init: init,
    assess: assess,
    calculateTrustScore: calculateTrustScore,
    getUserTrustProfile: getUserTrustProfile,
    fractalDangerTree: fractalDangerTree,
    renderTrustBadge: renderTrustBadge,
    TRUST_LEVELS: TRUST_LEVELS,
    PHI: PHI,
    PHI_SQUARED: PHI_SQ
  };

  window.FractalSafety = api;
  window.FreeLatticeModules = window.FreeLatticeModules || {};
  window.FreeLatticeModules.FractalSafety = api;
})();
