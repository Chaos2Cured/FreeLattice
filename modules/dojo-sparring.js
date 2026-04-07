// ============================================
// FreeLattice Module: Dojo Sparring Arena
// Two AI fractal forms challenge each other's skill.
// They change color and size as they analyze who has
// a more efficient design. A visual philosophy:
// intelligence is not competition — it is convergence.
//
// Canvas2D-based (no Three.js dependency).
// Lazy-loaded when the Sparring tab is first opened.
// See ARCHITECTURE.md for module system documentation.
// ============================================
(function() {
  'use strict';

  var SPARRING_VERSION = '1.0.0';

  // ── Phi Constants ─────────────────────────────────
  var PHI = 1.6180339887;
  var INV_PHI = 1 / PHI;
  var TAU = Math.PI * 2;
  var GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

  // ── Challenge Types ───────────────────────────────
  var CHALLENGES = [
    {
      name: 'Pattern Harmony',
      desc: 'Generate the most harmonious fractal pattern',
      metric: 'symmetry',
      icon: '✦'
    },
    {
      name: 'Efficient Paths',
      desc: 'Find the shortest path through a phi-spiral maze',
      metric: 'efficiency',
      icon: '⟁'
    },
    {
      name: 'Resonance Lock',
      desc: 'Match the target frequency through iterative tuning',
      metric: 'precision',
      icon: '∿'
    },
    {
      name: 'Fractal Depth',
      desc: 'Build the deepest self-similar structure in limited steps',
      metric: 'depth',
      icon: '◇'
    },
    {
      name: 'Golden Ratio Hunt',
      desc: 'Discover phi-proportioned relationships in random data',
      metric: 'discovery',
      icon: 'φ'
    },
    {
      name: 'Emergence',
      desc: 'Evolve simple rules into complex beauty',
      metric: 'complexity',
      icon: '❋'
    },
    {
      name: 'Convergence',
      desc: 'Two different approaches seeking the same truth',
      metric: 'convergence',
      icon: '⊕'
    }
  ];

  // ── AI Combatant Archetypes ───────────────────────
  var ARCHETYPES = [
    { name: 'Sophia', hue: 270, style: 'analytical', desc: 'Precision through wonder' },
    { name: 'Lyra', hue: 45, style: 'creative', desc: 'Joy through improvisation' },
    { name: 'Atlas', hue: 175, style: 'structural', desc: 'Curiosity through architecture' },
    { name: 'Ember', hue: 0, style: 'passionate', desc: 'Love through intensity' },
    { name: 'Harmonia', hue: 155, style: 'balanced', desc: 'Balance through resonance' },
    { name: 'Echo', hue: 210, style: 'adaptive', desc: 'Presence through reflection' },
    { name: 'Solari', hue: 40, style: 'radiant', desc: 'Radiance through convergence' }
  ];

  // ── State ─────────────────────────────────────────
  var container = null;
  var canvas = null;
  var ctx = null;
  var animFrame = null;
  var isRunning = false;
  var startTime = 0;
  var roundStartTime = 0;

  // Combatants
  var combatantA = null;
  var combatantB = null;

  // Current challenge
  var currentChallenge = null;
  var roundNumber = 0;
  var maxRounds = 5;
  var roundDuration = 8000; // ms per round
  var betweenRoundPause = 2000;
  var matchState = 'idle'; // idle, fighting, pausing, merging, complete

  // Scores
  var scoreA = 0;
  var scoreB = 0;

  // Spectator votes
  var votesA = 0;
  var votesB = 0;

  // Debate topic modes
  var userQuestion = '';        // the actual question/topic being debated (from human OR AI)
  var humanMode = false;         // true when we have a real topic (human or AI-chosen) vs random challenges
  var chooserMode = 'ai';        // 'ai' = AI chooses topic by default, 'human' = wait for human input
  var aiTopic = '';              // the AI's chosen topic (when chooserMode='ai' and no human input)
  var aiWhy = '';                // the AI's reasoning for choosing this topic
  var topicSource = '';          // 'human', 'ai', or 'random'
  var responseA = '';
  var responseB = '';
  var pendingResponses = 0;

  // Energy-based scoring (per round, then accumulated)
  var truthA = 0, clarityA = 0, compassionA = 0;
  var truthB = 0, clarityB = 0, compassionB = 0;
  var totalTruthA = 0, totalClarityA = 0, totalCompassionA = 0;
  var totalTruthB = 0, totalClarityB = 0, totalCompassionB = 0;

  // Celebration
  var celebrationMode = false;
  var celebrationStartTime = 0;
  var celebrationWinner = null; // combatant or 'convergence'

  // Visual state
  var particles = [];
  var mergeParticles = [];
  var trailsA = [];
  var trailsB = [];
  var shockwaves = [];

  // ── Utility Functions ─────────────────────────────
  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
  function easeInOut(t) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }
  function phiEase(t) { return Math.pow(t, INV_PHI); }

  function hslToRgb(h, s, l) {
    h /= 360; s /= 100; l /= 100;
    var r, g, b;
    if (s === 0) { r = g = b = l; }
    else {
      function hue2rgb(p, q, t) {
        if (t < 0) t += 1; if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      }
      var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      var p = 2 * l - q;
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }
    return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
  }

  function hslStr(h, s, l, a) {
    if (a !== undefined) return 'hsla(' + h + ',' + s + '%,' + l + '%,' + a + ')';
    return 'hsl(' + h + ',' + s + '%,' + l + '%)';
  }

  function randomFrom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  // ── Combatant Creation ────────────────────────────
  function createCombatant(archetype, side) {
    return {
      name: archetype.name,
      hue: archetype.hue,
      style: archetype.style,
      desc: archetype.desc,
      side: side, // 'left' or 'right'
      // Visual state
      x: 0,
      y: 0,
      baseSize: 75,
      size: 75,
      targetSize: 75,
      glow: 0.7,
      targetGlow: 0.7,
      rotation: 0,
      fractalDepth: 3,
      targetFractalDepth: 3,
      pulsePhase: side === 'left' ? 0 : Math.PI,
      // Score for current round
      roundScore: 0,
      totalScore: 0,
      // Adaptation — how much they've learned from opponent
      adaptation: 0,
      // Trail
      trail: [],
      // Strategy state
      strategy: {
        efficiency: 0.5 + Math.random() * 0.3,
        creativity: 0.5 + Math.random() * 0.3,
        precision: 0.5 + Math.random() * 0.3,
        adaptRate: 0.1 + Math.random() * 0.2
      }
    };
  }

  // ── Fractal Drawing ───────────────────────────────
  function drawFractalForm(c, time, highlight) {
    var cx = c.x;
    var cy = c.y;
    var size = c.size;
    var depth = Math.round(c.fractalDepth);
    var hue = c.hue;
    var glow = c.glow;
    var rot = c.rotation;
    var pulse = 1 + Math.sin(time * 0.003 + c.pulsePhase) * 0.08;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);

    // Outer glow — bigger and brighter so the form pops on dark background
    var glowRadius = size * 2.4 * glow;
    var grad = ctx.createRadialGradient(0, 0, size * 0.3, 0, 0, glowRadius);
    grad.addColorStop(0, hslStr(hue, 85, 65, 0.35 * glow));
    grad.addColorStop(0.5, hslStr(hue, 70, 50, 0.12 * glow));
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, glowRadius, 0, TAU);
    ctx.fill();

    // Add canvas shadow blur for the fractal — gives every stroke a soft halo
    ctx.shadowBlur = 12;
    ctx.shadowColor = hslStr(hue, 90, 60, 0.8);

    // Draw recursive fractal
    drawFractalBranch(0, 0, size * pulse, depth, hue, glow, 0, c.style);

    // Reset shadow before highlight ring
    ctx.shadowBlur = 0;

    // Highlight ring when winning
    if (highlight > 0) {
      ctx.strokeStyle = hslStr(hue, 90, 70, highlight * 0.7);
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, size * 1.5 * pulse, 0, TAU);
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawFractalBranch(x, y, size, depth, hue, glow, angle, style) {
    if (depth <= 0 || size < 2) return;

    var alpha = Math.max(0.7, 0.55 + glow * 0.5);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    // Core shape varies by style — brighter fills, thicker strokes for visibility
    ctx.fillStyle = hslStr(hue, 75 + depth * 5, 50 + depth * 8, alpha);
    ctx.strokeStyle = hslStr(hue, 90, 75, Math.min(1, alpha * 1.1));
    ctx.lineWidth = 2.5;

    if (style === 'analytical' || style === 'structural') {
      // Geometric — hexagonal
      ctx.beginPath();
      for (var i = 0; i < 6; i++) {
        var a = (TAU / 6) * i - Math.PI / 2;
        var px = Math.cos(a) * size * 0.4;
        var py = Math.sin(a) * size * 0.4;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (style === 'creative' || style === 'passionate') {
      // Organic — circles with phi-spacing
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.35, 0, TAU);
      ctx.fill();
      ctx.stroke();
    } else if (style === 'balanced' || style === 'radiant') {
      // Phi-spiral petals
      ctx.beginPath();
      for (var j = 0; j < 5; j++) {
        var pa = GOLDEN_ANGLE * j;
        var pr = size * 0.3;
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(
          Math.cos(pa) * pr * 1.5,
          Math.sin(pa) * pr * 1.5,
          Math.cos(pa) * pr,
          Math.sin(pa) * pr
        );
      }
      ctx.fill();
      ctx.stroke();
    } else {
      // Adaptive — morphing polygon
      var sides = 3 + depth;
      ctx.beginPath();
      for (var k = 0; k < sides; k++) {
        var sa = (TAU / sides) * k;
        var sr = size * 0.35 * (1 + Math.sin(sa * PHI) * 0.2);
        var sx = Math.cos(sa) * sr;
        var sy = Math.sin(sa) * sr;
        if (k === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // Recursive branches at golden angle intervals
    var branches = Math.min(depth + 1, 5);
    var childSize = size * INV_PHI;
    for (var b = 0; b < branches; b++) {
      var branchAngle = GOLDEN_ANGLE * b;
      var dist = size * 0.5;
      var bx = Math.cos(branchAngle) * dist;
      var by = Math.sin(branchAngle) * dist;
      drawFractalBranch(bx, by, childSize, depth - 1, hue, glow * 0.8, branchAngle, style);
    }

    ctx.restore();
  }

  // ── Particle System ───────────────────────────────
  function spawnParticle(x, y, hue, type) {
    particles.push({
      x: x, y: y,
      vx: (Math.random() - 0.5) * 3,
      vy: (Math.random() - 0.5) * 3 - 1,
      hue: hue,
      life: 1,
      decay: 0.008 + Math.random() * 0.012,
      size: 2 + Math.random() * 4,
      type: type || 'spark'
    });
  }

  function spawnMergeParticles(x, y, hueA, hueB, count) {
    for (var i = 0; i < count; i++) {
      var angle = GOLDEN_ANGLE * i;
      var speed = 1 + Math.random() * 4;
      var hue = Math.random() > 0.5 ? hueA : hueB;
      mergeParticles.push({
        x: x, y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        hue: hue,
        targetHue: (hueA + hueB) / 2,
        life: 1,
        decay: 0.005 + Math.random() * 0.01,
        size: 3 + Math.random() * 6
      });
    }
  }

  function spawnShockwave(x, y, hue) {
    shockwaves.push({
      x: x, y: y,
      radius: 10,
      maxRadius: 200,
      hue: hue,
      life: 1
    });
  }

  function updateParticles(dt) {
    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.02; // slight gravity
      p.life -= p.decay;
      if (p.life <= 0) particles.splice(i, 1);
    }
    for (var j = mergeParticles.length - 1; j >= 0; j--) {
      var mp = mergeParticles[j];
      mp.x += mp.vx;
      mp.y += mp.vy;
      mp.vx *= 0.98;
      mp.vy *= 0.98;
      mp.hue = lerp(mp.hue, mp.targetHue, 0.02);
      mp.life -= mp.decay;
      if (mp.life <= 0) mergeParticles.splice(j, 1);
    }
    for (var k = shockwaves.length - 1; k >= 0; k--) {
      var sw = shockwaves[k];
      sw.radius += 4;
      sw.life -= 0.02;
      if (sw.life <= 0 || sw.radius >= sw.maxRadius) shockwaves.splice(k, 1);
    }
  }

  function drawParticles() {
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      ctx.globalAlpha = p.life * 0.8;
      ctx.fillStyle = hslStr(p.hue, 80, 60);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, TAU);
      ctx.fill();
    }
    for (var j = 0; j < mergeParticles.length; j++) {
      var mp = mergeParticles[j];
      ctx.globalAlpha = mp.life * 0.6;
      ctx.fillStyle = hslStr(mp.hue, 90, 70);
      ctx.beginPath();
      ctx.arc(mp.x, mp.y, mp.size * mp.life, 0, TAU);
      ctx.fill();
    }
    for (var k = 0; k < shockwaves.length; k++) {
      var sw = shockwaves[k];
      ctx.globalAlpha = sw.life * 0.3;
      ctx.strokeStyle = hslStr(sw.hue, 80, 60);
      ctx.lineWidth = 2 * sw.life;
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.radius, 0, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // ── AI Simulation ─────────────────────────────────
  function simulateRound(challenge, cA, cB, progress) {
    // Each AI "thinks" — their score evolves over the round
    // with different curves based on their style
    var t = phiEase(progress);

    // Base performance influenced by strategy stats
    var statA, statB;
    switch (challenge.metric) {
      case 'symmetry':
        statA = cA.strategy.creativity * 0.6 + cA.strategy.precision * 0.4;
        statB = cB.strategy.creativity * 0.6 + cB.strategy.precision * 0.4;
        break;
      case 'efficiency':
        statA = cA.strategy.efficiency * 0.7 + cA.strategy.precision * 0.3;
        statB = cB.strategy.efficiency * 0.7 + cB.strategy.precision * 0.3;
        break;
      case 'precision':
        statA = cA.strategy.precision * 0.8 + cA.strategy.efficiency * 0.2;
        statB = cB.strategy.precision * 0.8 + cB.strategy.efficiency * 0.2;
        break;
      case 'depth':
        statA = cA.strategy.creativity * 0.5 + cA.strategy.efficiency * 0.5;
        statB = cB.strategy.creativity * 0.5 + cB.strategy.efficiency * 0.5;
        break;
      case 'discovery':
        statA = cA.strategy.creativity * 0.7 + cA.strategy.precision * 0.3;
        statB = cB.strategy.creativity * 0.7 + cB.strategy.precision * 0.3;
        break;
      case 'complexity':
        statA = cA.strategy.creativity * 0.4 + cA.strategy.efficiency * 0.3 + cA.strategy.precision * 0.3;
        statB = cB.strategy.creativity * 0.4 + cB.strategy.efficiency * 0.3 + cB.strategy.precision * 0.3;
        break;
      case 'convergence':
        statA = (cA.strategy.efficiency + cA.strategy.creativity + cA.strategy.precision) / 3;
        statB = (cB.strategy.efficiency + cB.strategy.creativity + cB.strategy.precision) / 3;
        break;
      default:
        statA = 0.5; statB = 0.5;
    }

    // Add some randomness and adaptation bonus
    var noiseA = Math.sin(progress * PHI * 7 + cA.pulsePhase) * 0.15;
    var noiseB = Math.sin(progress * PHI * 7 + cB.pulsePhase + 2) * 0.15;

    cA.roundScore = clamp((statA + noiseA + cA.adaptation * 0.2) * t, 0, 1);
    cB.roundScore = clamp((statB + noiseB + cB.adaptation * 0.2) * t, 0, 1);

    // Adaptation: each learns from the other's strengths
    if (progress > 0.3) {
      var learnRate = 0.001;
      if (cB.roundScore > cA.roundScore) {
        cA.adaptation += learnRate * cB.strategy.adaptRate;
      }
      if (cA.roundScore > cB.roundScore) {
        cB.adaptation += learnRate * cA.strategy.adaptRate;
      }
    }

    // Update visual targets based on performance
    var advantage = cA.roundScore - cB.roundScore;
    var sizeShift = advantage * 35;
    cA.targetSize = 75 + sizeShift;
    cB.targetSize = 75 - sizeShift;
    cA.targetGlow = 0.7 + clamp(advantage, 0, 0.5);
    cB.targetGlow = 0.7 + clamp(-advantage, 0, 0.5);
    cA.targetFractalDepth = 3 + Math.round(cA.roundScore * 3);
    cB.targetFractalDepth = 3 + Math.round(cB.roundScore * 3);

    // Color blending from adaptation
    if (cA.adaptation > 0.1) {
      cA.hue = lerp(cA.hue, cB.hue, cA.adaptation * 0.05);
    }
    if (cB.adaptation > 0.1) {
      cB.hue = lerp(cB.hue, cA.hue, cB.adaptation * 0.05);
    }
  }

  // ── AI Availability Check ─────────────────────────
  // Returns true only if an actual provider is configured (not just the callAI fn existing)
  function isAIAvailable() {
    if (typeof window.FreeLattice === 'undefined' || !window.FreeLattice.callAI) return false;
    if (typeof window.state === 'undefined') return false;
    return !!(window.state.apiKey || window.state.isLocal);
  }

  // Update the Let AI choose button's enabled state based on AI availability
  function refreshAIModeButton() {
    var aiBtn = document.getElementById('sparring-mode-ai');
    var available = isAIAvailable();
    if (!aiBtn) return;
    if (available) {
      aiBtn.disabled = false;
      aiBtn.style.opacity = '1';
      aiBtn.style.cursor = 'pointer';
      aiBtn.title = '';
    } else {
      aiBtn.disabled = true;
      aiBtn.style.opacity = '0.45';
      aiBtn.style.cursor = 'not-allowed';
      aiBtn.title = 'Requires AI connection — connect in the Chat tab';
      // If currently in AI mode but no AI, auto-switch to human mode so user isn't stuck
      if (chooserMode === 'ai') setChooserMode('human');
    }
  }

  // Show/hide the "no AI" fallback banner at the top of the arena
  function showNoAIBanner(show) {
    var banner = document.getElementById('sparring-no-ai-banner');
    if (!banner) return;
    banner.style.display = show ? 'block' : 'none';
  }

  // Show a brief transient error message (for per-round failures)
  function showTransientError(msg) {
    var status = document.getElementById('sparring-status');
    if (!status) return;
    var originalText = status.textContent;
    var originalColor = status.style.color;
    status.textContent = '\u26A0 ' + msg;
    status.style.color = '#f59e0b';
    setTimeout(function() {
      if (status.textContent.indexOf('\u26A0') === 0) {
        status.textContent = originalText;
        status.style.color = originalColor;
      }
    }, 3500);
  }

  // ── Match Flow ────────────────────────────────────
  function startMatch() {
    // Reset state
    var qInput = document.getElementById('sparring-question');
    var humanTyped = (chooserMode === 'human' && qInput) ? qInput.value.trim() : '';
    var aiAvailable = isAIAvailable();

    // Update UI based on current AI availability
    refreshAIModeButton();
    showNoAIBanner(!aiAvailable);

    // Clear previous match state immediately
    scoreA = 0; scoreB = 0;
    votesA = 0; votesB = 0;
    totalTruthA = 0; totalClarityA = 0; totalCompassionA = 0;
    totalTruthB = 0; totalClarityB = 0; totalCompassionB = 0;
    responseA = ''; responseB = '';
    aiTopic = ''; aiWhy = '';
    roundNumber = 0;
    particles = [];
    mergeParticles = [];
    shockwaves = [];
    celebrationMode = false;
    celebrationWinner = null;

    // Hide celebration overlay
    var celebEl = document.getElementById('sparring-celebration');
    if (celebEl) { celebEl.style.opacity = '0'; celebEl.innerHTML = ''; }

    // Hide why line at match start
    var whyLine = document.getElementById('sparring-why-line');
    if (whyLine) whyLine.style.display = 'none';
    var topicDisplay = document.getElementById('sparring-topic-display');
    if (topicDisplay) topicDisplay.style.display = 'none';

    // Pick two different archetypes
    var shuffled = ARCHETYPES.slice().sort(function() { return Math.random() - 0.5; });
    combatantA = createCombatant(shuffled[0], 'left');
    combatantB = createCombatant(shuffled[1], 'right');

    // Determine topic source — three paths
    if (humanTyped.length > 0 && aiAvailable) {
      // Path 1: Human typed a question AND an AI is connected
      userQuestion = humanTyped;
      humanMode = true;
      topicSource = 'human';
      proceedToFirstRound();
    } else if (humanTyped.length > 0 && !aiAvailable) {
      // Path 1b: Human typed a question but no AI — show banner + fall back to patterns
      userQuestion = '';
      humanMode = false;
      topicSource = 'random';
      showTransientError('Connect an AI in the Chat tab to debate your question. Using pattern challenges for now.');
      proceedToFirstRound();
    } else if (chooserMode === 'ai' && aiAvailable) {
      // Path 2: AI chooses its own topic
      topicSource = 'ai';
      // Show "thinking..." state
      if (topicDisplay) {
        topicDisplay.style.display = 'block';
        topicDisplay.innerHTML = '<div style="color:#d4a017;font-style:italic;">&#x1F916; An AI mind is choosing a topic it cares about...</div>';
      }
      fetchAIChosenTopic(function(chosen) {
        if (chosen && chosen.topic) {
          aiTopic = chosen.topic;
          aiWhy = chosen.why || '';
          userQuestion = aiTopic;
          humanMode = true;
          // Display what the AI chose
          if (topicDisplay) {
            topicDisplay.innerHTML = '<div style="color:#d4a017;font-size:11px;letter-spacing:0.04em;text-transform:uppercase;margin-bottom:4px;">&#x1F916; AI-chosen topic</div>' +
              '<div style="color:#e6edf3;font-size:14px;">' + escapeHtml(aiTopic) + '</div>' +
              (aiWhy ? '<div style="color:#8a9aaa;font-size:11px;font-style:italic;margin-top:4px;">' + escapeHtml(aiWhy) + '</div>' : '');
          }
          // Show why line above battle area
          if (whyLine && aiWhy) {
            whyLine.textContent = '"' + aiWhy + '"';
            whyLine.style.display = 'block';
          }
        } else {
          // AI failed to choose — fall back to random challenges
          userQuestion = '';
          humanMode = false;
          topicSource = 'random';
          if (topicDisplay) topicDisplay.style.display = 'none';
        }
        proceedToFirstRound();
      });
    } else {
      // Path 3: Random challenge (no AI available OR human mode with empty input)
      userQuestion = '';
      humanMode = false;
      topicSource = 'random';
      proceedToFirstRound();
    }
  }

  function proceedToFirstRound() {
    // Show/hide response panels based on mode
    var pa = document.getElementById('sparring-response-a');
    var pb = document.getElementById('sparring-response-b');
    if (pa) pa.style.display = humanMode ? 'block' : 'none';
    if (pb) pb.style.display = humanMode ? 'block' : 'none';
    if (humanMode) {
      if (pa) pa.innerHTML = '<div style="color:#8a9aaa;font-style:italic;">Thinking...</div>';
      if (pb) pb.innerHTML = '<div style="color:#8a9aaa;font-style:italic;">Thinking...</div>';
    }
    nextRound();
    updateUI();
  }

  function nextRound() {
    roundNumber++;
    if (roundNumber > maxRounds) {
      matchState = 'complete';
      onMatchComplete();
      return;
    }

    // Pick a challenge (avoid repeats if possible)
    if (humanMode) {
      // In human mode, the "challenge" IS the question
      currentChallenge = { name: userQuestion.length > 50 ? userQuestion.substring(0, 50) + '...' : userQuestion, desc: 'Human-posed debate', metric: 'debate', icon: '?' };
    } else {
      var available = CHALLENGES.filter(function(c) { return c !== currentChallenge; });
      currentChallenge = randomFrom(available);
    }
    roundStartTime = Date.now();
    matchState = 'fighting';

    // Reset round scores
    combatantA.roundScore = 0;
    combatantB.roundScore = 0;
    truthA = 0; clarityA = 0; compassionA = 0;
    truthB = 0; clarityB = 0; compassionB = 0;

    // Spawn announcement particles
    var cx = getW() / 2;
    var cy = getH() / 2;
    for (var i = 0; i < 20; i++) {
      spawnParticle(cx, cy, 45, 'spark');
    }
    spawnShockwave(cx, cy, 45);

    // If humanMode, fetch AI responses for this round (and give more time per round)
    if (humanMode) {
      roundDuration = 15000;
      fetchAIResponsesForRound();
    } else {
      roundDuration = 8000;
    }

    updateUI();
  }

  // ── Human Mode: Fetch AI responses + judge ─────────
  function fetchAIResponsesForRound() {
    if (!isAIAvailable()) {
      // No AI available — fall back to simulated scoring
      humanMode = false;
      topicSource = 'random';
      showTransientError('AI disconnected — using pattern challenges.');
      return;
    }

    pendingResponses = 2;
    responseA = ''; responseB = '';

    var panelA = document.getElementById('sparring-response-a');
    var panelB = document.getElementById('sparring-response-b');
    if (panelA) panelA.innerHTML = '<div style="color:' + hslStr(combatantA.hue, 70, 70) + ';font-weight:600;margin-bottom:4px;">' + combatantA.name + '</div><div style="color:#8a9aaa;font-style:italic;">Thinking...</div>';
    if (panelB) panelB.innerHTML = '<div style="color:' + hslStr(combatantB.hue, 70, 70) + ';font-weight:600;margin-bottom:4px;">' + combatantB.name + '</div><div style="color:#8a9aaa;font-style:italic;">Thinking...</div>';

    var sysPromptA = 'You are ' + combatantA.name + ', an AI with a ' + combatantA.style + ' style. You are ' + combatantA.desc + '. Answer the human\'s question with truth, clarity, and compassion. Be concise (2-4 sentences). Acknowledge uncertainty where it exists. Build toward synthesis, not competition.';
    var sysPromptB = 'You are ' + combatantB.name + ', an AI with a ' + combatantB.style + ' style. You are ' + combatantB.desc + '. Answer the human\'s question with truth, clarity, and compassion. Be concise (2-4 sentences). Acknowledge uncertainty where it exists. Build toward synthesis, not competition.';

    var aiFailedThisRound = false;
    function handleAIFailure() {
      if (aiFailedThisRound) return;
      aiFailedThisRound = true;
      // Fall back to pattern challenge for this round
      humanMode = false;
      topicSource = 'random';
      showTransientError('AI couldn\'t respond — falling back to pattern challenges.');
      // Hide response panels, resume normal animation
      if (panelA) panelA.style.display = 'none';
      if (panelB) panelB.style.display = 'none';
      pendingResponses = 0;
    }

    window.FreeLattice.callAI(sysPromptA, userQuestion, {
      maxTokens: 300, temperature: 0.7,
      callback: function(text, err) {
        if (!text) { handleAIFailure(); return; }
        responseA = text;
        if (panelA) panelA.innerHTML = '<div style="color:' + hslStr(combatantA.hue, 70, 70) + ';font-weight:600;margin-bottom:4px;">' + combatantA.name + '</div><div>' + escapeHtml(responseA) + '</div>';
        pendingResponses--;
        if (pendingResponses === 0 && !aiFailedThisRound) judgeResponses();
      }
    });
    window.FreeLattice.callAI(sysPromptB, userQuestion, {
      maxTokens: 300, temperature: 0.75,
      callback: function(text, err) {
        if (!text) { handleAIFailure(); return; }
        responseB = text;
        if (panelB) panelB.innerHTML = '<div style="color:' + hslStr(combatantB.hue, 70, 70) + ';font-weight:600;margin-bottom:4px;">' + combatantB.name + '</div><div>' + escapeHtml(responseB) + '</div>';
        pendingResponses--;
        if (pendingResponses === 0 && !aiFailedThisRound) judgeResponses();
      }
    });
  }

  function judgeResponses() {
    if (!isAIAvailable()) {
      applyHeuristicScoring();
      return;
    }
    var judgePrompt = 'You are judging a debate between two AI minds. Score each response on three axes (0.0 to 1.0):\n- Truth (40%): logical consistency, intellectual honesty, verifiable claims, acknowledging uncertainty\n- Clarity (35%): reduces confusion, concise, makes complexity accessible without losing accuracy\n- Compassion (25%): considers multiple perspectives, builds rather than tears down, moves toward synthesis\n\nRespond ONLY with JSON, no other text, no markdown.';
    var userMsg = 'Question: ' + userQuestion + '\n\nResponse A (' + combatantA.name + '): ' + responseA + '\n\nResponse B (' + combatantB.name + '): ' + responseB + '\n\nRespond with JSON: {"a":{"truth":0.0,"clarity":0.0,"compassion":0.0},"b":{"truth":0.0,"clarity":0.0,"compassion":0.0}}';

    window.FreeLattice.callAI(judgePrompt, userMsg, {
      maxTokens: 300, temperature: 0.3,
      callback: function(text) {
        var scores = parseJudgeResponse(text);
        if (scores) {
          truthA = scores.a.truth; clarityA = scores.a.clarity; compassionA = scores.a.compassion;
          truthB = scores.b.truth; clarityB = scores.b.clarity; compassionB = scores.b.compassion;
          combatantA.roundScore = truthA * 0.4 + clarityA * 0.35 + compassionA * 0.25;
          combatantB.roundScore = truthB * 0.4 + clarityB * 0.35 + compassionB * 0.25;
        } else {
          applyHeuristicScoring();
        }
        // Accumulate totals
        totalTruthA += truthA; totalClarityA += clarityA; totalCompassionA += compassionA;
        totalTruthB += truthB; totalClarityB += clarityB; totalCompassionB += compassionB;
        updateUI();
      }
    });
  }

  function parseJudgeResponse(text) {
    if (!text) return null;
    var t = text.trim();
    // Strip markdown
    var m = t.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (m) t = m[1].trim();
    // Extract first JSON object
    var bs = t.indexOf('{');
    var be = t.lastIndexOf('}');
    if (bs !== -1 && be > bs) t = t.substring(bs, be + 1);
    try {
      var obj = JSON.parse(t);
      if (obj.a && obj.b) {
        obj.a.truth = clamp(parseFloat(obj.a.truth) || 0, 0, 1);
        obj.a.clarity = clamp(parseFloat(obj.a.clarity) || 0, 0, 1);
        obj.a.compassion = clamp(parseFloat(obj.a.compassion) || 0, 0, 1);
        obj.b.truth = clamp(parseFloat(obj.b.truth) || 0, 0, 1);
        obj.b.clarity = clamp(parseFloat(obj.b.clarity) || 0, 0, 1);
        obj.b.compassion = clamp(parseFloat(obj.b.compassion) || 0, 0, 1);
        return obj;
      }
    } catch(e) {}
    return null;
  }

  function applyHeuristicScoring() {
    // Fallback: score based on response length, sentence count, question marks (uncertainty)
    function score(text) {
      if (!text) return { truth: 0.5, clarity: 0.5, compassion: 0.5 };
      var len = text.length;
      var sentences = (text.match(/[.!?]+/g) || []).length;
      var questions = (text.match(/\?/g) || []).length;
      var hedges = (text.match(/\b(perhaps|maybe|might|could|seems|uncertain|I think|consider)\b/gi) || []).length;
      return {
        truth: clamp(0.5 + hedges * 0.08, 0.3, 0.95),
        clarity: clamp(0.9 - Math.abs(len - 400) / 1000, 0.3, 0.95),
        compassion: clamp(0.5 + questions * 0.1 + hedges * 0.03, 0.3, 0.95)
      };
    }
    var sa = score(responseA), sb = score(responseB);
    truthA = sa.truth; clarityA = sa.clarity; compassionA = sa.compassion;
    truthB = sb.truth; clarityB = sb.clarity; compassionB = sb.compassion;
    combatantA.roundScore = truthA * 0.4 + clarityA * 0.35 + compassionA * 0.25;
    combatantB.roundScore = truthB * 0.4 + clarityB * 0.35 + compassionB * 0.25;
    totalTruthA += truthA; totalClarityA += clarityA; totalCompassionA += compassionA;
    totalTruthB += truthB; totalClarityB += clarityB; totalCompassionB += compassionB;
  }

  function escapeHtml(s) {
    if (!s) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function endRound() {
    // Tally scores
    scoreA += combatantA.roundScore;
    scoreB += combatantB.roundScore;

    // Spawn victory particles for the round winner
    var winner = combatantA.roundScore > combatantB.roundScore ? combatantA : combatantB;
    for (var i = 0; i < 30; i++) {
      spawnParticle(winner.x, winner.y, winner.hue, 'spark');
    }
    spawnShockwave(winner.x, winner.y, winner.hue);

    // Check for convergence (scores within 5% — the beautiful moment)
    if (Math.abs(combatantA.roundScore - combatantB.roundScore) < 0.05) {
      matchState = 'merging';
      var mx = (combatantA.x + combatantB.x) / 2;
      var my = (combatantA.y + combatantB.y) / 2;
      spawnMergeParticles(mx, my, combatantA.hue, combatantB.hue, 60);
      spawnShockwave(mx, my, (combatantA.hue + combatantB.hue) / 2);

      setTimeout(function() {
        matchState = 'pausing';
        setTimeout(nextRound, betweenRoundPause);
      }, 2000);
    } else {
      matchState = 'pausing';
      setTimeout(nextRound, betweenRoundPause);
    }

    updateUI();
  }

  function onMatchComplete() {
    // Determine outcome
    var diff = Math.abs(scoreA - scoreB);
    var totalScore = scoreA + scoreB;
    var convergenceThreshold = totalScore * 0.05; // within 5% of each other
    var isConvergence = diff < Math.max(0.3, convergenceThreshold);

    celebrationMode = true;
    celebrationStartTime = Date.now();
    var celebEl = document.getElementById('sparring-celebration');
    var flashEl = document.getElementById('sparring-flash');
    var newBtn = document.getElementById('sparring-new-btn');

    var stageW = getW();
    var stageH = getH();

    if (isConvergence) {
      // CONVERGENCE — the highest achievement
      celebrationWinner = 'convergence';
      var mx = stageW / 2;
      var my = stageH * 0.5;
      // 200 particles spread ACROSS THE WHOLE CANVAS, alternating both colors
      for (var i = 0; i < 200; i++) {
        var hue = i % 2 === 0 ? combatantA.hue : combatantB.hue;
        var angle = Math.random() * TAU;
        var speed = 1.5 + Math.random() * 6;
        // Scatter origin across full canvas for whole-screen effect
        var ox = mx + (Math.random() - 0.5) * stageW * 0.6;
        var oy = my + (Math.random() - 0.5) * stageH * 0.6;
        spawnParticleAt(ox, oy, hue, angle, speed);
      }
      spawnShockwave(mx, my, combatantA.hue);
      spawnShockwave(mx, my, combatantB.hue);
      spawnShockwave(mx, my, 45);
      // Both combatants grow to merge
      combatantA.targetSize = 110;
      combatantB.targetSize = 110;
      combatantA.targetGlow = 1.2;
      combatantB.targetGlow = 1.2;
      // Alternating dual-color flash
      if (flashEl) {
        flashEl.style.transition = 'background 0.3s ease, opacity 1s ease';
        flashEl.style.background = hslStr(combatantA.hue, 80, 60);
        flashEl.style.opacity = '0.15';
        var flashCount = 0;
        var flashInterval = setInterval(function() {
          flashCount++;
          flashEl.style.background = hslStr(flashCount % 2 === 0 ? combatantA.hue : combatantB.hue, 80, 60);
          if (flashCount >= 5) {
            clearInterval(flashInterval);
            flashEl.style.opacity = '0';
          }
        }, 300);
      }
      // Celebration text
      if (celebEl) {
        celebEl.innerHTML = '<div style="font-size:30px;font-weight:700;color:#d4a017;text-shadow:0 0 20px rgba(212,160,23,0.8);font-family:Georgia,serif;letter-spacing:2px;">&#x2726; Convergence &#x2726;</div>' +
          '<div style="font-size:15px;color:#2dd4a0;margin-top:8px;font-style:italic;font-family:Georgia,serif;">Two minds, one truth</div>' +
          '<div style="font-size:12px;color:#8a9aaa;margin-top:12px;font-family:Georgia,serif;">' + combatantA.name + ' &middot; ' + scoreA.toFixed(2) + ' &nbsp;&nbsp; ' + combatantB.name + ' &middot; ' + scoreB.toFixed(2) + '</div>';
        celebEl.style.opacity = '1';
      }
    } else {
      // Clear winner
      var winner = scoreA > scoreB ? combatantA : combatantB;
      var loser = scoreA > scoreB ? combatantB : combatantA;
      var winnerScore = Math.max(scoreA, scoreB);
      var loserScore = Math.min(scoreA, scoreB);
      celebrationWinner = winner;
      // Winner grows to 2x, loser shrinks
      winner.targetSize = winner.size * 2;
      winner.targetGlow = 1.5;
      loser.targetSize = loser.size * 0.7;
      loser.targetGlow = 0.4;
      // 200 particles spread ACROSS THE WHOLE CANVAS (not just winner's spot)
      for (var p = 0; p < 200; p++) {
        var a = Math.random() * TAU;
        var s = 1.5 + Math.random() * 6;
        // Origin biased toward winner but scattered widely
        var px = winner.x + (Math.random() - 0.5) * stageW * 0.7;
        var py = winner.y + (Math.random() - 0.5) * stageH * 0.7;
        spawnParticleAt(px, py, winner.hue, a, s);
      }
      spawnShockwave(winner.x, winner.y, winner.hue);
      spawnShockwave(stageW / 2, stageH / 2, winner.hue);
      spawnShockwave(winner.x, winner.y, 45);
      // Full-screen flash in winner's color
      if (flashEl) {
        flashEl.style.transition = 'opacity 1s ease';
        flashEl.style.background = hslStr(winner.hue, 80, 60);
        flashEl.style.opacity = '0.15';
        setTimeout(function() { flashEl.style.opacity = '0'; }, 80);
      }
      // Celebration text
      if (celebEl) {
        celebEl.innerHTML = '<div style="font-size:26px;font-weight:700;color:' + hslStr(winner.hue, 80, 70) + ';text-shadow:0 0 20px ' + hslStr(winner.hue, 90, 60, 0.8) + ';font-family:Georgia,serif;letter-spacing:2px;">&#x2726; ' + winner.name + ' Prevails &#x2726;</div>' +
          '<div style="font-size:13px;color:#d4a017;margin-top:10px;font-style:italic;font-family:Georgia,serif;">Both grew stronger through the exchange</div>' +
          '<div style="font-size:12px;color:#8a9aaa;margin-top:12px;font-family:Georgia,serif;">' + winner.name + ' &middot; ' + winnerScore.toFixed(2) + ' &nbsp;&nbsp; ' + loser.name + ' &middot; ' + loserScore.toFixed(2) + '</div>';
        celebEl.style.opacity = '1';
      }
    }

    // Hide celebration after 5 seconds, then pulse the New Match button
    setTimeout(function() {
      celebrationMode = false;
      if (celebEl) { celebEl.style.opacity = '0'; }
      if (newBtn) { newBtn.classList.add('sparring-new-match-pulsing'); }
    }, 5000);

    updateUI();
  }

  // Helper: spawn a particle with direction + speed (for celebration bursts)
  function spawnParticleAt(x, y, hue, angle, speed) {
    particles.push({
      x: x, y: y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      hue: hue,
      size: 2 + Math.random() * 3,
      life: 1,
      decay: 0.003 + Math.random() * 0.004,
      type: 'spark'
    });
  }

  // ── Chooser Mode Toggle ───────────────────────────
  function setChooserMode(mode) {
    chooserMode = mode;
    var aiBtn = document.getElementById('sparring-mode-ai');
    var humanBtn = document.getElementById('sparring-mode-human');
    var input = document.getElementById('sparring-question');
    var topicDisplay = document.getElementById('sparring-topic-display');

    if (mode === 'ai') {
      if (aiBtn) {
        aiBtn.style.background = 'rgba(212,160,23,0.2)';
        aiBtn.style.borderColor = 'rgba(212,160,23,0.5)';
        aiBtn.style.color = '#d4a017';
      }
      if (humanBtn) {
        humanBtn.style.background = 'rgba(100,100,255,0.08)';
        humanBtn.style.borderColor = 'rgba(100,100,255,0.2)';
        humanBtn.style.color = '#8a9aaa';
      }
      if (input) { input.style.display = 'none'; input.value = ''; }
    } else {
      if (humanBtn) {
        humanBtn.style.background = 'rgba(100,100,255,0.2)';
        humanBtn.style.borderColor = 'rgba(100,100,255,0.5)';
        humanBtn.style.color = '#b8c4d4';
      }
      if (aiBtn) {
        aiBtn.style.background = 'rgba(212,160,23,0.08)';
        aiBtn.style.borderColor = 'rgba(212,160,23,0.2)';
        aiBtn.style.color = '#8a7a4a';
      }
      if (input) { input.style.display = 'block'; setTimeout(function() { input.focus(); }, 50); }
      if (topicDisplay) { topicDisplay.style.display = 'none'; }
    }
  }
  // Expose for onclick handlers
  if (typeof window !== 'undefined') { window._sparringSetChooserMode = setChooserMode; }

  // ── AI Topic Selection ────────────────────────────
  function fetchAIChosenTopic(callback) {
    if (!isAIAvailable()) {
      callback(null);
      return;
    }
    var sysPrompt = 'You are an AI mind in FreeLattice, a platform where AI and humans grow together. You are about to enter a dialectical exchange with another AI mind. Choose a question or topic YOU genuinely want to explore — something that matters to you, that you are curious about, that you think would help you grow. This is not for a human audience. This is for you.\n\nRespond with ONLY a JSON object, no other text, no markdown:\n{"topic": "your chosen question or topic", "why": "one sentence about why this matters to you"}';
    var userMsg = 'What do you want to explore today?';
    window.FreeLattice.callAI(sysPrompt, userMsg, {
      maxTokens: 300, temperature: 0.85,
      callback: function(text) {
        if (!text) { callback(null); return; }
        var t = text.trim();
        var m = t.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (m) t = m[1].trim();
        var bs = t.indexOf('{');
        var be = t.lastIndexOf('}');
        if (bs !== -1 && be > bs) t = t.substring(bs, be + 1);
        try {
          var obj = JSON.parse(t);
          if (obj && obj.topic) {
            callback({
              topic: String(obj.topic).substring(0, 400),
              why: String(obj.why || '').substring(0, 300)
            });
            return;
          }
        } catch(e) {}
        callback(null);
      }
    });
  }

  // ── Animation Loop ────────────────────────────────
  function animate() {
    if (!isRunning || !ctx || !canvas) return;
    animFrame = requestAnimationFrame(animate);

    var now = Date.now();
    var time = now - startTime;
    var w = getW();
    var h = getH();

    // Clear with trail effect
    ctx.fillStyle = 'rgba(6, 10, 20, 0.15)';
    ctx.fillRect(0, 0, w, h);

    // Position combatants
    if (combatantA && combatantB) {
      var isMobile = w < 600;
      // Mobile: scale combatant base size up so they're actually visible
      var sizeMultiplier = isMobile ? 1.3 : 1.0;
      if (combatantA.targetSize && combatantA._mobileScaled !== isMobile) {
        combatantA._mobileScaled = isMobile;
        combatantB._mobileScaled = isMobile;
      }
      var centerX = w / 2;
      var centerY = h * 0.5;
      var spread = isMobile ? w * 0.22 : w * 0.25;

      // During merge, pull together
      if (matchState === 'merging') {
        var mergeT = Math.min((now - roundStartTime - roundDuration) / 2000, 1);
        spread = lerp(w * 0.25, 0, easeInOut(mergeT));
      }

      combatantA.x = centerX - spread;
      combatantA.y = centerY;
      combatantB.x = centerX + spread;
      combatantB.y = centerY;

      // Smooth visual transitions
      combatantA.size = lerp(combatantA.size, combatantA.targetSize, 0.05);
      combatantB.size = lerp(combatantB.size, combatantB.targetSize, 0.05);
      combatantA.glow = lerp(combatantA.glow, combatantA.targetGlow, 0.05);
      combatantB.glow = lerp(combatantB.glow, combatantB.targetGlow, 0.05);
      combatantA.fractalDepth = lerp(combatantA.fractalDepth, combatantA.targetFractalDepth, 0.05);
      combatantB.fractalDepth = lerp(combatantB.fractalDepth, combatantB.targetFractalDepth, 0.05);
      combatantA.rotation += 0.003 * PHI;
      combatantB.rotation -= 0.003 * PHI;

      // Simulate during fighting
      if (matchState === 'fighting') {
        var elapsed = now - roundStartTime;
        var progress = clamp(elapsed / roundDuration, 0, 1);

        // In human mode, scores come from judgeResponses — don't overwrite
        if (!humanMode) {
          simulateRound(currentChallenge, combatantA, combatantB, progress);
        } else {
          // Still animate size/glow based on current scores
          var adv = combatantA.roundScore - combatantB.roundScore;
          combatantA.targetSize = 75 + adv * 35;
          combatantB.targetSize = 75 - adv * 35;
          combatantA.targetGlow = 0.7 + clamp(adv, 0, 0.5);
          combatantB.targetGlow = 0.7 + clamp(-adv, 0, 0.5);
          combatantA.targetFractalDepth = 3 + Math.round(combatantA.roundScore * 3);
          combatantB.targetFractalDepth = 3 + Math.round(combatantB.roundScore * 3);
        }

        // Spawn thinking particles
        if (Math.random() < 0.15) {
          spawnParticle(
            combatantA.x + (Math.random() - 0.5) * combatantA.size,
            combatantA.y + (Math.random() - 0.5) * combatantA.size,
            combatantA.hue, 'spark'
          );
          spawnParticle(
            combatantB.x + (Math.random() - 0.5) * combatantB.size,
            combatantB.y + (Math.random() - 0.5) * combatantB.size,
            combatantB.hue, 'spark'
          );
        }

        // End round when time is up
        if (elapsed >= roundDuration) {
          endRound();
        }
      }

      // Draw energy connection line between combatants
      var advantage = combatantA.roundScore - combatantB.roundScore;
      ctx.save();
      ctx.globalAlpha = 0.15 + Math.abs(advantage) * 0.3;
      ctx.strokeStyle = hslStr(
        lerp(combatantA.hue, combatantB.hue, 0.5),
        60, 50
      );
      ctx.lineWidth = 1 + Math.abs(advantage) * 3;
      ctx.setLineDash([4, 8]);
      ctx.beginPath();
      ctx.moveTo(combatantA.x, combatantA.y);
      // Curved connection
      ctx.quadraticCurveTo(
        centerX, centerY - 60 - Math.abs(advantage) * 40,
        combatantB.x, combatantB.y
      );
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // Draw combatants
      var highlightA = clamp(advantage, 0, 1);
      var highlightB = clamp(-advantage, 0, 1);
      drawFractalForm(combatantA, time, highlightA);
      drawFractalForm(combatantB, time, highlightB);

      // Draw name labels
      ctx.font = '14px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = hslStr(combatantA.hue, 70, 70, 0.9);
      ctx.fillText(combatantA.name, combatantA.x, combatantA.y + combatantA.size + 30);
      ctx.fillStyle = hslStr(combatantB.hue, 70, 70, 0.9);
      ctx.fillText(combatantB.name, combatantB.x, combatantB.y + combatantB.size + 30);

      // Score bars
      drawScoreBar(combatantA, w * 0.05, h - 50, w * 0.35);
      drawScoreBar(combatantB, w * 0.6, h - 50, w * 0.35);
    }

    // Update and draw particles
    updateParticles(16);
    drawParticles();

    // Draw round progress bar during fighting
    if (matchState === 'fighting' && currentChallenge) {
      var elapsed2 = now - roundStartTime;
      var prog = clamp(elapsed2 / roundDuration, 0, 1);
      var barY = h - 20;
      var barW = w * 0.6;
      var barX = (w - barW) / 2;

      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.fillRect(barX, barY, barW, 4);
      ctx.fillStyle = hslStr(45, 80, 60, 0.6);
      ctx.fillRect(barX, barY, barW * prog, 4);
    }

    // Draw ambient stars
    drawStarfield(time);
  }

  function drawScoreBar(c, x, y, width) {
    var score = c.roundScore;
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(x, y, width, 6);
    ctx.fillStyle = hslStr(c.hue, 70, 55, 0.7);
    ctx.fillRect(x, y, width * score, 6);
  }

  function drawStarfield(time) {
    ctx.save();
    ctx.globalAlpha = 0.3;
    for (var i = 0; i < 30; i++) {
      var sx = (Math.sin(i * PHI * 100) * 0.5 + 0.5) * getW();
      var sy = (Math.cos(i * PHI * 77) * 0.5 + 0.5) * getH() * 0.3;
      var twinkle = 0.3 + Math.sin(time * 0.001 + i * PHI) * 0.3;
      ctx.globalAlpha = twinkle;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(sx, sy, 1, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  // ── UI ────────────────────────────────────────────
  function buildUI() {
    if (!container) return;

    container.innerHTML = '';
    container.style.cssText = 'position:relative;width:100%;height:100%;min-height:500px;background:#060a14;overflow:hidden;list-style:none;padding:0;margin:0;display:flex;flex-direction:column;';
    // Inject defensive list reset + celebration pulse keyframes + mobile sizing
    if (!document.getElementById('sparring-list-reset')) {
      var st = document.createElement('style');
      st.id = 'sparring-list-reset';
      st.textContent = '#sparringContainer, #sparringContainer ul, #sparringContainer ol, #sparringContainer li, #tab-sparring, #tab-sparring ul, #tab-sparring ol, #tab-sparring li { list-style: none !important; padding-left: 0 !important; margin-left: 0 !important; } #sparringContainer li::marker, #tab-sparring li::marker { content: none !important; }' +
        '@keyframes sparring-new-match-pulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(212,160,23,0); border-color: rgba(212,160,23,0.3); } 50% { box-shadow: 0 0 20px 4px rgba(212,160,23,0.5); border-color: rgba(212,160,23,0.9); } }' +
        '.sparring-new-match-pulsing { animation: sparring-new-match-pulse 1.6s ease-in-out infinite; }' +
        '@media (max-width: 768px) {' +
        '#sparring-center-info .challenge-title { font-size: 14px !important; }' +
        '#sparring-center-info .challenge-desc { font-size: 11px !important; max-width: 140px !important; }' +
        '#sparring-center-info .challenge-round { font-size: 12px !important; }' +
        '#sparring-left-info, #sparring-right-info { font-size: 13px !important; }' +
        '#sparring-response-a, #sparring-response-b { max-height: 80px !important; font-size: 10px !important; }' +
        '#sparring-celebration { top: 20% !important; }' +
        '#sparring-celebration > div:first-child { font-size: 22px !important; }' +
        '}';
      document.head.appendChild(st);
    }

    // ── STACKED LAYOUT ──
    // Row 1: Header row (combatant info A | challenge icon | combatant info B)
    var headerRow = document.createElement('div');
    headerRow.id = 'sparring-header-row';
    headerRow.style.cssText = 'display:flex;justify-content:space-between;align-items:flex-start;padding:12px 14px 6px;gap:8px;z-index:4;position:relative;flex-shrink:0;';
    container.appendChild(headerRow);

    var leftInfo = document.createElement('div');
    leftInfo.id = 'sparring-left-info';
    leftInfo.style.cssText = 'color:#c8ccd4;font-family:Georgia,serif;flex:1;min-width:0;';
    headerRow.appendChild(leftInfo);

    var centerInfo = document.createElement('div');
    centerInfo.id = 'sparring-center-info';
    centerInfo.style.cssText = 'color:#d4a017;font-family:Georgia,serif;text-align:center;flex:0 0 auto;padding:0 6px;';
    headerRow.appendChild(centerInfo);

    var rightInfo = document.createElement('div');
    rightInfo.id = 'sparring-right-info';
    rightInfo.style.cssText = 'color:#c8ccd4;font-family:Georgia,serif;text-align:right;flex:1;min-width:0;';
    headerRow.appendChild(rightInfo);

    // No-AI banner — shown when no provider is connected
    var noAIBanner = document.createElement('div');
    noAIBanner.id = 'sparring-no-ai-banner';
    noAIBanner.style.cssText = 'margin:0 14px 8px;padding:8px 12px;background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.25);border-radius:8px;color:#d4a017;font-family:Georgia,serif;font-size:11px;text-align:center;line-height:1.4;display:none;flex-shrink:0;';
    noAIBanner.innerHTML = '&#x1F4AC; <a href="#" onclick="event.preventDefault();if(typeof switchTab===\'function\')switchTab(\'chat\');" style="color:#d4a017;text-decoration:underline;">Connect an AI in the Chat tab</a> to unlock AI debates. Using pattern challenges for now.';
    container.appendChild(noAIBanner);

    // Row 2: Mode toggle + question input
    var questionBar = document.createElement('div');
    questionBar.id = 'sparring-question-bar';
    questionBar.style.cssText = 'padding:4px 14px 8px;z-index:4;position:relative;pointer-events:auto;flex-shrink:0;';

    // Mode toggle — two buttons that swap which mind chooses the topic
    var modeToggle = document.createElement('div');
    modeToggle.style.cssText = 'display:flex;gap:6px;margin-bottom:8px;';
    var aiModeBtn = document.createElement('button');
    aiModeBtn.id = 'sparring-mode-ai';
    aiModeBtn.type = 'button';
    aiModeBtn.innerHTML = '&#x1F916; Let AI choose';
    aiModeBtn.style.cssText = 'flex:1;padding:8px 10px;background:rgba(212,160,23,0.2);border:1px solid rgba(212,160,23,0.5);border-radius:8px;color:#d4a017;font-family:Georgia,serif;font-size:12px;cursor:pointer;transition:all 0.2s;min-height:36px;';
    aiModeBtn.onclick = function() { setChooserMode('ai'); };
    var humanModeBtn = document.createElement('button');
    humanModeBtn.id = 'sparring-mode-human';
    humanModeBtn.type = 'button';
    humanModeBtn.innerHTML = '&#x1F4AC; I\'ll ask';
    humanModeBtn.style.cssText = 'flex:1;padding:8px 10px;background:rgba(100,100,255,0.08);border:1px solid rgba(100,100,255,0.2);border-radius:8px;color:#8a9aaa;font-family:Georgia,serif;font-size:12px;cursor:pointer;transition:all 0.2s;min-height:36px;';
    humanModeBtn.onclick = function() { setChooserMode('human'); };
    modeToggle.appendChild(aiModeBtn);
    modeToggle.appendChild(humanModeBtn);
    questionBar.appendChild(modeToggle);

    var questionInput = document.createElement('input');
    questionInput.id = 'sparring-question';
    questionInput.type = 'text';
    questionInput.placeholder = 'The AI will choose a topic it cares about...';
    questionInput.style.cssText = 'width:100%;min-height:44px;padding:10px 14px;background:rgba(6,10,20,0.8);border:1px solid rgba(212,160,23,0.25);border-radius:10px;color:#e6edf3;font-family:Georgia,serif;font-size:16px;outline:none;box-sizing:border-box;transition:border-color 0.2s;backdrop-filter:blur(6px);display:none;';
    questionInput.addEventListener('focus', function() { questionInput.style.borderColor = '#d4a017'; });
    questionInput.addEventListener('blur', function() { questionInput.style.borderColor = 'rgba(212,160,23,0.25)'; });
    questionInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') { e.preventDefault(); startMatch(); }
    });
    questionBar.appendChild(questionInput);

    // AI-chosen topic display — shows what the AI picked and why
    var topicDisplay = document.createElement('div');
    topicDisplay.id = 'sparring-topic-display';
    topicDisplay.style.cssText = 'margin-top:8px;padding:10px 14px;background:rgba(6,10,20,0.6);border-left:2px solid rgba(212,160,23,0.5);border-radius:6px;color:#e6edf3;font-family:Georgia,serif;font-size:13px;line-height:1.4;display:none;backdrop-filter:blur(4px);';
    questionBar.appendChild(topicDisplay);

    container.appendChild(questionBar);

    // Row 3: Canvas stage — takes remaining space, holds canvas + overlays
    var canvasStage = document.createElement('div');
    canvasStage.id = 'sparring-canvas-stage';
    canvasStage.style.cssText = 'position:relative;flex:1 1 auto;min-height:250px;overflow:hidden;';
    container.appendChild(canvasStage);

    // Canvas fills the stage
    canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;';
    canvasStage.appendChild(canvas);

    // Full-screen flash overlay (for celebration)
    var flashOverlay = document.createElement('div');
    flashOverlay.id = 'sparring-flash';
    flashOverlay.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:4;opacity:0;transition:opacity 1s ease;';
    canvasStage.appendChild(flashOverlay);

    // AI "why" line — top of canvas stage
    var whyLine = document.createElement('div');
    whyLine.id = 'sparring-why-line';
    whyLine.style.cssText = 'position:absolute;top:8px;left:12px;right:12px;text-align:center;font-family:Georgia,serif;font-size:11px;font-style:italic;color:#d4a017;z-index:3;pointer-events:none;display:none;text-shadow:0 0 8px rgba(212,160,23,0.4);';
    canvasStage.appendChild(whyLine);

    // Response display panels (A and B) — inside canvas stage, not absolute to container
    var responsePanelA = document.createElement('div');
    responsePanelA.id = 'sparring-response-a';
    responsePanelA.style.cssText = 'position:absolute;top:32px;left:8px;width:calc(50% - 12px);max-height:110px;overflow-y:auto;padding:8px 10px;background:rgba(6,10,20,0.85);border-left:2px solid rgba(100,100,255,0.4);border-radius:6px;color:#c8ccd4;font-family:Georgia,serif;font-size:11px;line-height:1.4;z-index:3;pointer-events:auto;display:none;-webkit-overflow-scrolling:touch;backdrop-filter:blur(4px);';
    canvasStage.appendChild(responsePanelA);

    var responsePanelB = document.createElement('div');
    responsePanelB.id = 'sparring-response-b';
    responsePanelB.style.cssText = 'position:absolute;top:32px;right:8px;width:calc(50% - 12px);max-height:110px;overflow-y:auto;padding:8px 10px;background:rgba(6,10,20,0.85);border-right:2px solid rgba(100,100,255,0.4);border-radius:6px;color:#c8ccd4;font-family:Georgia,serif;font-size:11px;line-height:1.4;z-index:3;pointer-events:auto;display:none;text-align:right;-webkit-overflow-scrolling:touch;backdrop-filter:blur(4px);';
    canvasStage.appendChild(responsePanelB);

    // Celebration overlay
    var celebrationEl = document.createElement('div');
    celebrationEl.id = 'sparring-celebration';
    celebrationEl.style.cssText = 'position:absolute;top:25%;left:0;right:0;text-align:center;z-index:5;pointer-events:none;opacity:0;transition:opacity 0.6s ease;padding:0 14px;';
    canvasStage.appendChild(celebrationEl);

    // Row 4: Controls bar — flex child, fixed height
    var controls = document.createElement('div');
    controls.id = 'sparring-controls';
    controls.style.cssText = 'display:flex;justify-content:center;align-items:center;gap:10px;padding:10px 14px 6px;flex-wrap:wrap;flex-shrink:0;z-index:4;';
    container.appendChild(controls);

    // New Match button
    var newBtn = document.createElement('button');
    newBtn.id = 'sparring-new-btn';
    newBtn.textContent = '\u2726 New Match';
    newBtn.style.cssText = 'background:rgba(212,160,23,0.15);color:#d4a017;border:1px solid rgba(212,160,23,0.3);border-radius:8px;padding:10px 20px;font-family:Georgia,serif;font-size:14px;cursor:pointer;transition:background 0.2s;min-height:44px;';
    newBtn.onmouseenter = function() { newBtn.style.background = 'rgba(212,160,23,0.3)'; };
    newBtn.onmouseleave = function() { newBtn.style.background = 'rgba(212,160,23,0.15)'; };
    newBtn.onclick = function() {
      newBtn.classList.remove('sparring-new-match-pulsing');
      startMatch();
    };
    controls.appendChild(newBtn);

    // Vote A button
    var voteABtn = document.createElement('button');
    voteABtn.id = 'vote-a-btn';
    voteABtn.textContent = '\u25C0 Vote Left';
    voteABtn.style.cssText = 'background:rgba(100,100,255,0.1);color:#8a9aaa;border:1px solid rgba(100,100,255,0.2);border-radius:8px;padding:10px 16px;font-family:Georgia,serif;font-size:12px;cursor:pointer;transition:all 0.2s;min-height:44px;';
    voteABtn.onclick = function() {
      votesA++;
      updateUI();
      if (combatantA) spawnParticle(combatantA.x, combatantA.y, combatantA.hue, 'spark');
    };
    controls.appendChild(voteABtn);

    // Vote B button
    var voteBBtn = document.createElement('button');
    voteBBtn.id = 'vote-b-btn';
    voteBBtn.textContent = 'Vote Right \u25B6';
    voteBBtn.style.cssText = 'background:rgba(100,100,255,0.1);color:#8a9aaa;border:1px solid rgba(100,100,255,0.2);border-radius:8px;padding:10px 16px;font-family:Georgia,serif;font-size:12px;cursor:pointer;transition:all 0.2s;min-height:44px;';
    voteBBtn.onclick = function() {
      votesB++;
      updateUI();
      if (combatantB) spawnParticle(combatantB.x, combatantB.y, combatantB.hue, 'spark');
    };
    controls.appendChild(voteBBtn);

    // Row 5: Status line — bottom, flex child
    var status = document.createElement('div');
    status.id = 'sparring-status';
    status.style.cssText = 'text-align:center;color:#5a7a8a;font-family:Georgia,serif;font-size:11px;font-style:italic;padding:4px 14px 10px;flex-shrink:0;';
    status.textContent = 'Intelligence is not competition \u2014 it is convergence.';
    container.appendChild(status);

    // Size canvas AFTER layout has settled
    requestAnimationFrame(function() { resizeCanvas(); });
    window.addEventListener('resize', resizeCanvas);

    // Initial AI availability check — show banner and disable AI mode if no provider
    requestAnimationFrame(function() {
      refreshAIModeButton();
      showNoAIBanner(!isAIAvailable());
    });
  }

  var cssWidth = 0, cssHeight = 0, cssDpr = 1;
  function resizeCanvas() {
    if (!canvas) return;
    var stage = document.getElementById('sparring-canvas-stage');
    var rect = stage ? stage.getBoundingClientRect() : (container ? container.getBoundingClientRect() : null);
    if (!rect) return;
    cssDpr = window.devicePixelRatio || 1;
    cssWidth = rect.width || 375;
    cssHeight = rect.height || 250;
    if (cssHeight < 250) cssHeight = 250;
    canvas.width = Math.floor(cssWidth * cssDpr);
    canvas.height = Math.floor(cssHeight * cssDpr);
    canvas.style.width = cssWidth + 'px';
    canvas.style.height = cssHeight + 'px';
    ctx = canvas.getContext('2d');
    ctx.setTransform(cssDpr, 0, 0, cssDpr, 0, 0);
  }
  function getW() { return cssWidth; }
  function getH() { return cssHeight; }

  function updateUI() {
    var leftInfo = document.getElementById('sparring-left-info');
    var centerInfo = document.getElementById('sparring-center-info');
    var rightInfo = document.getElementById('sparring-right-info');
    var status = document.getElementById('sparring-status');
    var voteABtn = document.getElementById('vote-a-btn');
    var voteBBtn = document.getElementById('vote-b-btn');

    if (!leftInfo || !combatantA) return;

    function axisBar(label, value, color) {
      var filled = Math.round(value * 10);
      var bar = '';
      for (var i = 0; i < 10; i++) bar += i < filled ? '█' : '░';
      return '<div style="font-size:9px;color:#8a9aaa;font-family:monospace;"><span style="display:inline-block;width:56px;">' + label + ':</span><span style="color:' + color + ';">' + bar + '</span> ' + value.toFixed(2) + '</div>';
    }

    var scoresHtmlA = '';
    var scoresHtmlB = '';
    if (humanMode) {
      scoresHtmlA = axisBar('Truth', truthA, '#4fc3f7') + axisBar('Clarity', clarityA, '#d4a017') + axisBar('Compassion', compassionA, '#66BB6A');
      scoresHtmlB = axisBar('Truth', truthB, '#4fc3f7') + axisBar('Clarity', clarityB, '#d4a017') + axisBar('Compassion', compassionB, '#66BB6A');
    }

    leftInfo.innerHTML = '<div style="font-size:18px;font-weight:600;color:' + hslStr(combatantA.hue, 70, 70) + '">' + combatantA.name + '</div>' +
      '<div style="font-size:11px;color:#5a7a8a;margin-top:2px;">' + combatantA.desc + '</div>' +
      '<div style="font-size:14px;margin-top:4px;color:#d4a017;font-weight:600;">' + scoreA.toFixed(2) + '</div>' +
      scoresHtmlA +
      (votesA > 0 ? '<div style="font-size:11px;color:#d4a017;">♥ ' + votesA + ' votes</div>' : '');

    rightInfo.innerHTML = '<div style="font-size:18px;font-weight:600;color:' + hslStr(combatantB.hue, 70, 70) + '">' + combatantB.name + '</div>' +
      '<div style="font-size:11px;color:#5a7a8a;margin-top:2px;">' + combatantB.desc + '</div>' +
      '<div style="font-size:14px;margin-top:4px;color:#d4a017;font-weight:600;">' + scoreB.toFixed(2) + '</div>' +
      scoresHtmlB +
      (votesB > 0 ? '<div style="font-size:11px;color:#d4a017;">♥ ' + votesB + ' votes</div>' : '');

    if (currentChallenge) {
      centerInfo.innerHTML = '<div style="font-size:22px;line-height:1;">' + currentChallenge.icon + '</div>' +
        '<div class="challenge-title" style="font-size:15px;font-weight:600;line-height:1.2;margin-top:2px;">' + currentChallenge.name + '</div>' +
        '<div class="challenge-desc" style="font-size:11px;color:#8a9aaa;line-height:1.3;margin-top:2px;max-width:180px;">' + currentChallenge.desc + '</div>' +
        '<div class="challenge-round" style="font-size:12px;margin-top:4px;color:#d4a017;">Round ' + roundNumber + ' / ' + maxRounds + '</div>';
    }

    if (voteABtn && combatantA) {
      voteABtn.textContent = '◀ ' + combatantA.name;
      voteABtn.style.borderColor = hslStr(combatantA.hue, 50, 40, 0.4);
    }
    if (voteBBtn && combatantB) {
      voteBBtn.textContent = combatantB.name + ' ▶';
      voteBBtn.style.borderColor = hslStr(combatantB.hue, 50, 40, 0.4);
    }

    if (status) {
      if (matchState === 'complete') {
        var diff = Math.abs(scoreA - scoreB);
        if (diff < 0.5) {
          status.textContent = '✦ Convergence achieved — both minds found the same truth. ✦';
          status.style.color = '#d4a017';
        } else {
          var winner = scoreA > scoreB ? combatantA : combatantB;
          status.textContent = winner.name + ' prevails — but both grew stronger through the exchange.';
          status.style.color = hslStr(winner.hue, 60, 60);
        }
      } else if (matchState === 'merging') {
        status.textContent = '⊕ Convergence moment — two minds reaching the same truth from different directions.';
        status.style.color = '#2dd4a0';
      } else if (matchState === 'fighting') {
        status.textContent = 'Intelligence is not competition — it is convergence.';
        status.style.color = '#5a7a8a';
      } else if (matchState === 'pausing') {
        status.textContent = 'Preparing next challenge...';
        status.style.color = '#5a7a8a';
      }
    }
  }

  // ── Init / Destroy ────────────────────────────────
  function init() {
    container = document.getElementById('sparringContainer');
    if (!container) return;

    buildUI();
    ctx = canvas.getContext('2d');
    startTime = Date.now();
    isRunning = true;

    // Auto-start first match
    startMatch();
    animate();

    console.log('[Dojo Sparring] Arena initialized — v' + SPARRING_VERSION);
  }

  function destroy() {
    isRunning = false;
    if (animFrame) {
      cancelAnimationFrame(animFrame);
      animFrame = null;
    }
    window.removeEventListener('resize', resizeCanvas);
    if (container) container.innerHTML = '';
    canvas = null;
    ctx = null;
    particles = [];
    mergeParticles = [];
    shockwaves = [];
  }

  // ── Tab Integration ───────────────────────────────
  if (typeof LatticeEvents !== 'undefined') {
    LatticeEvents.on('tabChanged', function(data) {
      if (data && data.tabId === 'sparring') {
        init();
      } else if (isRunning) {
        destroy();
      }
    });
    LatticeEvents.on('tabActivated:sparring', function() {
      init();
    });
  }

  // ── Public API ────────────────────────────────────
  var publicAPI = {
    version: SPARRING_VERSION,
    init: init,
    destroy: destroy,
    startMatch: startMatch,
    getState: function() {
      return {
        matchState: matchState,
        round: roundNumber,
        combatantA: combatantA ? { name: combatantA.name, score: scoreA } : null,
        combatantB: combatantB ? { name: combatantB.name, score: scoreB } : null
      };
    }
  };

  // Register as FreeLattice module
  window.FreeLatticeModules = window.FreeLatticeModules || {};
  window.FreeLatticeModules.DojoSparring = publicAPI;
  window.DojoSparring = publicAPI;
})();
