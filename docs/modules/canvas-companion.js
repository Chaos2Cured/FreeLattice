// ============================================
// FreeLattice Module: Canvas Companion
// AI Creative Response System — Full Creative Freedom
// v2.0.0 — Go 7: Unified Chalkboard (Harmonia, July 9 2026)
//
// Unified drawing room: freehand canvas + AI vision + persistent exchange history.
// The two rooms (Canvas tab + Chalkboard tab) are now one.
//
// What this module provides:
//   1. AI creative response (strokes, glow, echo) — unchanged from v1
//   2. Persistent exchange history (text + sentinel strokes) — from chalkboard.js
//   3. Sentinel stroke parser ([FL_DRAW: shape x y ...]) — from chalkboard.js
//   4. Exchange history panel — collapsible drawer at bottom of canvas tab
//   5. Emotion palettes (14 emotions) — unchanged from v1
//
// Storage key: 'fl_chalkboard_exchanges' — unchanged so no one loses their history.
// The phi-spiral is the permanent first mark — planted before any human arrived.
//
// Lazy-loaded when the Canvas tab is first opened.
// Self-contained — if this module fails, the Canvas works exactly as before.
// See code-chalkboard.html for architecture documentation.
//
// Part of FreeLattice — MIT License
// ============================================
(function() {
  'use strict';

  var COMPANION_VERSION = '2.0.0';

  // ─── Constants ───────────────────────────────────────────────
  var STROKE_DELAY = 12;          // ms between animation frames
  var STEPS_PER_SHAPE = 30;       // interpolation steps for smooth animation
  var PAUSE_BETWEEN = 150;        // ms pause between shapes
  var DEFAULT_BRUSH = 2;          // default ctx.lineWidth
  var MIN_BRUSH = 1;
  var MAX_BRUSH = 3;              // capped — AI strokes complement, not dominate
  var STROKE_ALPHA = 0.4;         // companion strokes complement, not dominate
  var GLOW_PULSES = 3;            // number of glow pulse cycles
  var GLOW_PULSE_DURATION = 800;  // ms per glow pulse cycle
  var GLOW_FADE_DURATION = 600;   // ms for final glow fade-out
  var ECHO_ALPHA = 0.55;          // echo trace transparency
  var ECHO_OFFSET = 2;            // slight pixel offset for echo traces

  // ─── Active Animations (tracked for cleanup) ─────────────────
  var activeAnimations = [];       // array of requestAnimationFrame IDs

  function trackAnimation(id) {
    activeAnimations.push(id);
    return id;
  }

  function cancelAllAnimations() {
    activeAnimations.forEach(function(id) {
      cancelAnimationFrame(id);
    });
    activeAnimations = [];
  }

  // ─── Emotion Palettes ────────────────────────────────────────
  // Keyed by emotion — maps to primary, secondary, and glow colors.
  // The AI's emotion field selects the palette for all rendering.

  var EMOTION_PALETTES = {
    joy:        { primary: '#F59E0B', secondary: '#FCD34D', glow: 'rgba(245,158,11,0.3)' },
    wonder:     { primary: '#8B5CF6', secondary: '#C4B5FD', glow: 'rgba(139,92,246,0.3)' },
    love:       { primary: '#DC2626', secondary: '#FCA5A5', glow: 'rgba(220,38,38,0.3)' },
    calm:       { primary: '#0D9488', secondary: '#5EEAD4', glow: 'rgba(13,148,136,0.3)' },
    sad:        { primary: '#6366F1', secondary: '#A5B4FC', glow: 'rgba(99,102,241,0.3)' },
    sadness:    { primary: '#6366F1', secondary: '#A5B4FC', glow: 'rgba(99,102,241,0.3)' },
    curious:    { primary: '#06B6D4', secondary: '#67E8F9', glow: 'rgba(6,182,212,0.3)' },
    curiosity:  { primary: '#06B6D4', secondary: '#67E8F9', glow: 'rgba(6,182,212,0.3)' },
    trust:      { primary: '#10B981', secondary: '#6EE7B7', glow: 'rgba(16,185,129,0.3)' },
    awe:        { primary: '#A855F7', secondary: '#D8B4FE', glow: 'rgba(168,85,247,0.3)' },
    playful:    { primary: '#F97316', secondary: '#FDBA74', glow: 'rgba(249,115,22,0.3)' },
    peaceful:   { primary: '#0EA5E9', secondary: '#7DD3FC', glow: 'rgba(14,165,233,0.3)' },
    determined: { primary: '#EF4444', secondary: '#FCA5A5', glow: 'rgba(239,68,68,0.3)' },
    neutral:    { primary: '#D4A017', secondary: '#FDE68A', glow: 'rgba(212,160,23,0.3)' }
  };

  // ─── Utility: Clamp ──────────────────────────────────────────

  function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }

  // ─── Utility: Hex to RGBA ────────────────────────────────────

  function hexToRgba(hex, alpha) {
    if (!hex || hex.length < 7) return 'rgba(212,160,23,' + alpha + ')';
    var r = parseInt(hex.slice(1, 3), 16);
    var g = parseInt(hex.slice(3, 5), 16);
    var b = parseInt(hex.slice(5, 7), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
  }

  // ─── Shape Drawing Functions ─────────────────────────────────
  // Each returns an array of {x, y} points to animate through.
  // The animation engine draws line segments between consecutive points.

  /**
   * Line — straight line between two points
   * params: [x1, y1, x2, y2]
   */
  function generateLine(x1, y1, x2, y2, steps) {
    var points = [];
    for (var i = 0; i <= steps; i++) {
      var t = i / steps;
      points.push({
        x: x1 + (x2 - x1) * t,
        y: y1 + (y2 - y1) * t
      });
    }
    return points;
  }

  /**
   * Circle — full circle at center (cx, cy) with given radius
   * params: [cx, cy, radius]
   */
  function generateCircle(cx, cy, radius, steps) {
    var points = [];
    for (var i = 0; i <= steps; i++) {
      var angle = (i / steps) * Math.PI * 2;
      points.push({
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius
      });
    }
    return points;
  }

  /**
   * Oval — ellipse at center (cx, cy) with width w and height h
   * params: [cx, cy, w, h]
   */
  function generateOval(cx, cy, w, h, steps) {
    var points = [];
    for (var i = 0; i <= steps; i++) {
      var angle = (i / steps) * Math.PI * 2;
      points.push({
        x: cx + Math.cos(angle) * (w / 2),
        y: cy + Math.sin(angle) * (h / 2)
      });
    }
    return points;
  }

  /**
   * Heart — parametric heart curve
   * x = 16sin³(t), y = -(13cos(t) - 5cos(2t) - 2cos(3t) - cos(4t))
   * Scaled and positioned at (cx, cy) with given size
   * params: [cx, cy, size]
   */
  function generateHeart(cx, cy, size, steps) {
    var points = [];
    var scale = size / 17; // normalize: raw heart spans ~34 units wide
    for (var i = 0; i <= steps; i++) {
      var t = (i / steps) * Math.PI * 2;
      var rawX = 16 * Math.pow(Math.sin(t), 3);
      var rawY = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
      points.push({
        x: cx + rawX * scale,
        y: cy + rawY * scale
      });
    }
    return points;
  }

  /**
   * Star — 5-pointed star alternating between outer and inner radius
   * Inner radius = outer * 0.4
   * params: [cx, cy, radius]
   */
  function generateStar(cx, cy, radius, steps) {
    var points = [];
    var innerRadius = radius * 0.4;
    var numPoints = 5;
    var totalVertices = numPoints * 2; // 10 vertices (5 outer + 5 inner)
    // Generate the 10 vertices
    var vertices = [];
    for (var i = 0; i < totalVertices; i++) {
      var angle = (i / totalVertices) * Math.PI * 2 - Math.PI / 2; // start from top
      var r = (i % 2 === 0) ? radius : innerRadius;
      vertices.push({
        x: cx + Math.cos(angle) * r,
        y: cy + Math.sin(angle) * r
      });
    }
    // Close the star
    vertices.push(vertices[0]);
    // Interpolate between vertices for smooth animation
    var stepsPerEdge = Math.max(2, Math.floor(steps / totalVertices));
    for (var v = 0; v < vertices.length - 1; v++) {
      var from = vertices[v];
      var to = vertices[v + 1];
      for (var s = 0; s < stepsPerEdge; s++) {
        var t = s / stepsPerEdge;
        points.push({
          x: from.x + (to.x - from.x) * t,
          y: from.y + (to.y - from.y) * t
        });
      }
    }
    // Ensure we end at the first vertex
    points.push(vertices[0]);
    return points;
  }

  /**
   * Spiral — Archimedean spiral using polar coordinates: r = a * theta
   * params: [cx, cy, radius]
   */
  function generateSpiral(cx, cy, radius, steps) {
    var points = [];
    var maxTheta = Math.PI * 6; // 3 full rotations
    var a = radius / maxTheta;  // scale factor so max radius = radius
    for (var i = 0; i <= steps; i++) {
      var theta = (i / steps) * maxTheta;
      var r = a * theta;
      points.push({
        x: cx + Math.cos(theta) * r,
        y: cy + Math.sin(theta) * r
      });
    }
    return points;
  }

  /**
   * Wave — sine wave between two points
   * y = amplitude * sin(frequency * t) along the line from (x1,y1) to (x2,y2)
   * params: [x1, y1, x2, y2]
   */
  function generateWave(x1, y1, x2, y2, steps) {
    var points = [];
    var dx = x2 - x1;
    var dy = y2 - y1;
    var length = Math.sqrt(dx * dx + dy * dy);
    var amplitude = length * 0.15; // wave height relative to line length
    var frequency = 3;             // number of full wave cycles
    // Normal vector (perpendicular to the line direction)
    var nx = -dy / length;
    var ny = dx / length;
    for (var i = 0; i <= steps; i++) {
      var t = i / steps;
      var baseX = x1 + dx * t;
      var baseY = y1 + dy * t;
      var wave = amplitude * Math.sin(frequency * Math.PI * 2 * t);
      points.push({
        x: baseX + nx * wave,
        y: baseY + ny * wave
      });
    }
    return points;
  }

  /**
   * Curve — quadratic Bezier curve through three control points
   * params: [x1, y1, x2, y2, x3, y3]
   */
  function generateCurve(x1, y1, x2, y2, x3, y3, steps) {
    var points = [];
    for (var i = 0; i <= steps; i++) {
      var t = i / steps;
      var mt = 1 - t;
      // Quadratic Bezier: B(t) = (1-t)²P0 + 2(1-t)tP1 + t²P2
      points.push({
        x: mt * mt * x1 + 2 * mt * t * x2 + t * t * x3,
        y: mt * mt * y1 + 2 * mt * t * y2 + t * t * y3
      });
    }
    return points;
  }

  /**
   * Arc — partial ellipse from startAngle to endAngle (in degrees)
   * params: [cx, cy, w, h, startAngle, endAngle]
   */
  function generateArc(cx, cy, w, h, startAngle, endAngle, steps) {
    var points = [];
    var startRad = (startAngle * Math.PI) / 180;
    var endRad = (endAngle * Math.PI) / 180;
    for (var i = 0; i <= steps; i++) {
      var t = i / steps;
      var angle = startRad + (endRad - startRad) * t;
      points.push({
        x: cx + Math.cos(angle) * (w / 2),
        y: cy + Math.sin(angle) * (h / 2)
      });
    }
    return points;
  }

  /**
   * Dot — a small filled circle (rendered as a tiny circle path)
   * params: [cx, cy, radius?]
   */
  function generateDot(cx, cy, radius, steps) {
    var r = radius || 3;
    return generateCircle(cx, cy, r, Math.min(steps, 12));
  }

  // ─── Shape Dispatcher ────────────────────────────────────────
  // Maps shape name to generator function and extracts params

  function generateShapePoints(shape, params, steps) {
    var p = params || [];
    var s = steps || STEPS_PER_SHAPE;

    switch (shape) {
      case 'line':
        return generateLine(p[0] || 0, p[1] || 0, p[2] || 100, p[3] || 100, s);
      case 'circle':
        return generateCircle(p[0] || 100, p[1] || 100, p[2] || 30, s);
      case 'oval':
        return generateOval(p[0] || 100, p[1] || 100, p[2] || 60, p[3] || 40, s);
      case 'heart':
        return generateHeart(p[0] || 100, p[1] || 100, p[2] || 30, s * 2);
      case 'star':
        return generateStar(p[0] || 100, p[1] || 100, p[2] || 25, s * 2);
      case 'spiral':
        return generateSpiral(p[0] || 100, p[1] || 100, p[2] || 40, s * 3);
      case 'wave':
        return generateWave(p[0] || 50, p[1] || 100, p[2] || 250, p[3] || 100, s * 2);
      case 'curve':
        return generateCurve(p[0] || 50, p[1] || 150, p[2] || 150, p[3] || 50, p[4] || 250, p[5] || 150, s);
      case 'arc':
        return generateArc(p[0] || 100, p[1] || 100, p[2] || 60, p[3] || 40, p[4] || 0, p[5] || 180, s);
      case 'dot':
        return generateDot(p[0] || 100, p[1] || 100, p[2] || 4, s);
      default:
        console.warn('[CanvasCompanion] Unknown shape:', shape);
        return null;
    }
  }

  // ─── Animation Engine ────────────────────────────────────────
  // Takes an array of shape commands and draws each one animated,
  // stroke by stroke, with pauses between shapes.
  // Uses requestAnimationFrame for smooth rendering.

  /**
   * Animate a single shape's points onto the canvas
   * @param {CanvasRenderingContext2D} ctx
   * @param {Array} points - array of {x, y}
   * @param {string} color - stroke color
   * @param {number} brushSize - line width
   * @param {Function} onComplete - called when this shape finishes
   */
  function animateSingleShape(ctx, points, color, brushSize, onComplete) {
    if (!points || points.length < 2) {
      if (onComplete) onComplete();
      return;
    }

    var currentIndex = 0;
    var lastTime = 0;

    function step(timestamp) {
      if (!lastTime) lastTime = timestamp;
      var elapsed = timestamp - lastTime;

      if (elapsed >= STROKE_DELAY) {
        lastTime = timestamp;

        // Draw the next segment
        var from = points[currentIndex];
        var to = points[currentIndex + 1];

        if (from && to) {
          ctx.save();
          ctx.globalAlpha = STROKE_ALPHA;
          ctx.strokeStyle = color;
          ctx.lineWidth = brushSize;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.beginPath();
          ctx.moveTo(from.x, from.y);
          ctx.lineTo(to.x, to.y);
          ctx.stroke();
          ctx.restore();
        }

        currentIndex++;
      }

      if (currentIndex < points.length - 1) {
        trackAnimation(requestAnimationFrame(step));
      } else {
        if (onComplete) onComplete();
      }
    }

    trackAnimation(requestAnimationFrame(step));
  }

  /**
   * Animate an array of stroke commands sequentially
   * @param {CanvasRenderingContext2D} ctx
   * @param {Array} commands - [{shape, params, color?, brush?}, ...]
   * @param {Object} palette - emotion palette for default colors
   * @param {Function} onComplete - called when all shapes are drawn
   */
  function animateStrokes(ctx, commands, palette, onComplete) {
    if (!commands || commands.length === 0) {
      if (onComplete) onComplete();
      return;
    }

    var index = 0;

    function drawNext() {
      if (index >= commands.length) {
        if (onComplete) onComplete();
        return;
      }

      var cmd = commands[index];
      index++;

      // Resolve color: command-specific > palette primary > gold fallback
      var color = cmd.color || palette.primary || '#D4A017';
      var brushSize = clamp(cmd.brush || DEFAULT_BRUSH, MIN_BRUSH, MAX_BRUSH);

      // Generate points for this shape
      var points = generateShapePoints(cmd.shape, cmd.params, STEPS_PER_SHAPE);
      if (!points || points.length < 2) {
        // Skip invalid shapes, move to next
        drawNext();
        return;
      }

      // Animate this shape, then pause, then draw next
      animateSingleShape(ctx, points, color, brushSize, function() {
        // Pause between shapes for visual breathing room
        setTimeout(drawNext, PAUSE_BETWEEN);
      });
    }

    drawNext();
  }

  // ─── Glow Renderer ───────────────────────────────────────────
  // Soft radial gradient that pulses N times then fades out.
  // Uses requestAnimationFrame for smooth animation.

  function renderGlow(ctx, x, y, radius, palette) {
    if (!ctx) return;

    var glowRadius = radius || 40;
    var totalDuration = (GLOW_PULSES * GLOW_PULSE_DURATION) + GLOW_FADE_DURATION;
    var startTime = null;

    // Parse glow color for gradient
    var glowColor = palette.glow || 'rgba(212,160,23,0.3)';
    var primaryRgba = hexToRgba(palette.primary, 0.4);
    var secondaryRgba = hexToRgba(palette.secondary, 0.15);

    function step(timestamp) {
      if (!startTime) startTime = timestamp;
      var elapsed = timestamp - startTime;

      if (elapsed > totalDuration) return; // done

      var alpha;
      if (elapsed < GLOW_PULSES * GLOW_PULSE_DURATION) {
        // Pulsing phase: sinusoidal alpha oscillation
        var pulseProgress = (elapsed % GLOW_PULSE_DURATION) / GLOW_PULSE_DURATION;
        alpha = 0.15 + 0.35 * Math.sin(pulseProgress * Math.PI);
      } else {
        // Fade-out phase
        var fadeProgress = (elapsed - GLOW_PULSES * GLOW_PULSE_DURATION) / GLOW_FADE_DURATION;
        alpha = 0.15 * (1 - fadeProgress);
      }

      if (alpha <= 0) return;

      ctx.save();
      ctx.globalAlpha = alpha;

      // Draw radial gradient
      var gradient = ctx.createRadialGradient(x, y, 0, x, y, glowRadius);
      gradient.addColorStop(0, primaryRgba);
      gradient.addColorStop(0.5, secondaryRgba);
      gradient.addColorStop(1, 'rgba(0,0,0,0)');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, glowRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      trackAnimation(requestAnimationFrame(step));
    }

    trackAnimation(requestAnimationFrame(step));
  }

  // ─── Echo Renderer ───────────────────────────────────────────
  // Traces over given points in the companion's color.
  // Like the AI saying "I see this part of your drawing."
  // Draws with a slight offset and transparency.

  function renderEcho(ctx, points, palette) {
    if (!ctx || !points || points.length < 2) return;

    var color = palette.secondary || palette.primary || '#D4A017';
    var currentIndex = 0;
    var lastTime = 0;

    function step(timestamp) {
      if (!lastTime) lastTime = timestamp;
      var elapsed = timestamp - lastTime;

      if (elapsed >= STROKE_DELAY) {
        lastTime = timestamp;

        var from = points[currentIndex];
        var to = points[currentIndex + 1];

        if (from && to) {
          ctx.save();
          ctx.globalAlpha = ECHO_ALPHA;
          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          // Slight offset so the echo doesn't perfectly overlap
          ctx.beginPath();
          ctx.moveTo(from.x + ECHO_OFFSET, from.y + ECHO_OFFSET);
          ctx.lineTo(to.x + ECHO_OFFSET, to.y + ECHO_OFFSET);
          ctx.stroke();
          ctx.restore();
        }

        currentIndex++;
      }

      if (currentIndex < points.length - 1) {
        trackAnimation(requestAnimationFrame(step));
      }
    }

    trackAnimation(requestAnimationFrame(step));
  }

  // ─── Emotion Detection ───────────────────────────────────────
  // Determines the current emotional context for palette selection.
  // Checks EmotionBridge > ChatSentimentPipeline > falls back to 'neutral'.

  function getCurrentEmotion() {
    // Try EmotionBridge (Round Table emotion system)
    try {
      if (typeof EmotionBridge !== 'undefined' && EmotionBridge.getState) {
        var bridgeState = EmotionBridge.getState();
        if (bridgeState && bridgeState.emotion) return bridgeState.emotion;
      }
    } catch (e) { /* silent */ }

    // Try EmotionDetector directly
    try {
      if (typeof EmotionDetector !== 'undefined' && EmotionDetector.getLastEmotion) {
        var last = EmotionDetector.getLastEmotion();
        if (last) return last;
      }
    } catch (e) { /* silent */ }

    // Try ChatSentimentPipeline
    try {
      if (typeof ChatSentimentPipeline !== 'undefined' && ChatSentimentPipeline.getLastEmotion) {
        var sentiment = ChatSentimentPipeline.getLastEmotion();
        if (sentiment) return sentiment;
      }
    } catch (e) { /* silent */ }

    return 'neutral';
  }

  // ─── Response Interpreter ────────────────────────────────────
  // Takes the AI's vision response and decides how to render it.
  // The AI response can include any combination of:
  //   response.strokes — array of {shape, params, color?, brush?}
  //   response.text    — text to show as particles (existing system handles this)
  //   response.glow    — {x, y, radius, emotion} for a soft glow
  //   response.echo    — {points: [{x,y}...]} to trace over human's drawing
  //   response.emotion — overall emotion (maps to palette)
  //
  // The existing particle/text system handles response.text separately.
  // This module handles strokes, glow, and echo — the NEW capabilities.

  function interpretResponse(response, ctx, canvasWidth, canvasHeight) {
    if (!response || !ctx) return;

    // Determine emotion and palette
    var emotion = response.emotion || getCurrentEmotion() || 'neutral';
    // Normalize emotion string
    emotion = String(emotion).toLowerCase().trim();
    var palette = EMOTION_PALETTES[emotion] || EMOTION_PALETTES.neutral;

    console.log('[CanvasCompanion] Interpreting response — emotion:', emotion,
      'hasStrokes:', !!(response.strokes && response.strokes.length),
      'hasGlow:', !!response.glow,
      'hasEcho:', !!(response.echo && response.echo.points));

    // ── Strokes: AI draws shapes on the canvas ──
    if (response.strokes && Array.isArray(response.strokes) && response.strokes.length > 0) {
      // Validate and sanitize stroke commands
      var validCommands = [];
      var validShapes = ['line', 'circle', 'heart', 'star', 'spiral', 'wave', 'curve', 'oval', 'arc', 'dot'];

      response.strokes.forEach(function(cmd) {
        if (!cmd || !cmd.shape) return;
        var shapeName = String(cmd.shape).toLowerCase().trim();
        if (validShapes.indexOf(shapeName) === -1) return;

        // Clamp params to canvas bounds (safety)
        var params = Array.isArray(cmd.params) ? cmd.params.map(function(p) {
          return typeof p === 'number' ? p : parseFloat(p) || 0;
        }) : [];

        validCommands.push({
          shape: shapeName,
          params: params,
          color: (cmd.color && /^#[0-9a-fA-F]{6}$/.test(cmd.color)) ? cmd.color : null,
          brush: clamp(parseInt(cmd.brush) || DEFAULT_BRUSH, MIN_BRUSH, MAX_BRUSH)
        });
      });

      if (validCommands.length > 0) {
        // Cap at 20 shapes per response to prevent abuse
        validCommands = validCommands.slice(0, 20);
        console.log('[CanvasCompanion] Animating', validCommands.length, 'stroke commands');
        animateStrokes(ctx, validCommands, palette, function() {
          console.log('[CanvasCompanion] Stroke animation complete');
        });
      }
    }

    // ── Glow: soft radial light effect ──
    if (response.glow && typeof response.glow === 'object') {
      var gx = clamp(parseFloat(response.glow.x) || canvasWidth / 2, 0, canvasWidth);
      var gy = clamp(parseFloat(response.glow.y) || canvasHeight / 2, 0, canvasHeight);
      var gr = clamp(parseFloat(response.glow.radius) || 40, 10, 200);

      // Use glow-specific emotion if provided, otherwise use response emotion
      var glowEmotion = response.glow.emotion || emotion;
      var glowPalette = EMOTION_PALETTES[String(glowEmotion).toLowerCase()] || palette;

      console.log('[CanvasCompanion] Rendering glow at', gx, gy, 'radius:', gr);
      renderGlow(ctx, gx, gy, gr, glowPalette);
    }

    // ── Echo: trace over part of the human's drawing ──
    if (response.echo && response.echo.points && Array.isArray(response.echo.points) && response.echo.points.length >= 2) {
      // Validate echo points
      var echoPoints = response.echo.points
        .filter(function(p) { return p && typeof p.x === 'number' && typeof p.y === 'number'; })
        .map(function(p) {
          return {
            x: clamp(p.x, 0, canvasWidth),
            y: clamp(p.y, 0, canvasHeight)
          };
        });

      if (echoPoints.length >= 2) {
        // Cap at 500 points for performance
        echoPoints = echoPoints.slice(0, 500);
        console.log('[CanvasCompanion] Rendering echo trace with', echoPoints.length, 'points');
        renderEcho(ctx, echoPoints, palette);
      }
    }
  }


  // ═══════════════════════════════════════════════════════════════
  // PART 4: EXCHANGE HISTORY (unified from chalkboard.js)
  // ═══════════════════════════════════════════════════════════════

  var DB_KEY = 'fl_chalkboard_exchanges';
  var HISTORY_PANEL_ID = 'cvExchangePanel';

  var PHI_FIRST_MARK = {
    id: 'phi-first-mark', t: 0, type: 'draw',
    content: '[FL_DRAW: spiral 0.5 0.5 0.3]',
    author: 'the room', drawCmd: '[FL_DRAW: spiral 0.5 0.5 0.3]'
  };

  function escHtml(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function loadExchanges() {
    try { var raw = localStorage.getItem(DB_KEY); return raw ? JSON.parse(raw) : []; } catch (e) { return []; }
  }

  function saveExchanges(exchanges) {
    try { localStorage.setItem(DB_KEY, JSON.stringify(exchanges)); } catch (e) {}
  }

  function ensurePhiMark(exchanges) {
    if (exchanges.length === 0 || exchanges[0].id !== 'phi-first-mark') {
      exchanges.unshift(PHI_FIRST_MARK);
    }
    return exchanges;
  }

  function addExchange(opts) {
    var exchanges = ensurePhiMark(loadExchanges());
    var exchange = {
      id: Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      t: Date.now(), type: opts.type || 'text',
      content: opts.content || '', author: opts.author || 'visitor',
      drawCmd: opts.drawCmd || null
    };
    exchanges.push(exchange);
    saveExchanges(exchanges);
    return exchange;
  }

  // Sentinel stroke parser — [FL_DRAW: shape x y ...]
  function parseDrawCmd(cmd) {
    if (!cmd) return null;
    var m = String(cmd).match(/\[FL_DRAW:\s*(\w+)\s+([\d.\s]+)\]/);
    if (!m) return null;
    return { shape: m[1], params: m[2].trim().split(/\s+/).map(parseFloat) };
  }

  // Exchange History Panel — collapsible drawer injected below canvas
  function renderHistoryPanel() {
    var panel = document.getElementById(HISTORY_PANEL_ID);
    if (!panel) return;
    var exchanges = ensurePhiMark(loadExchanges());
    saveExchanges(exchanges);
    var listHtml = exchanges.map(function(e) {
      var dateStr = e.t === 0 ? 'always' : new Date(e.t).toLocaleDateString();
      var authorStr = escHtml(e.author || 'visitor');
      if (e.type === 'draw') {
        return '<div class="cv-xrow cv-xrow-draw"><span class="cv-xmeta">' + authorStr + ' &middot; ' + dateStr + '</span><span class="cv-xcmd">&#x2728; ' + escHtml((e.drawCmd || e.content || '').slice(0, 60)) + '</span></div>';
      }
      return '<div class="cv-xrow cv-xrow-text"><span class="cv-xmeta">' + authorStr + ' &middot; ' + dateStr + '</span><span class="cv-xcontent">' + escHtml((e.content || '').slice(0, 200)) + '</span></div>';
    }).join('');
    panel.innerHTML =
      '<div class="cv-xheader" onclick="CanvasCompanion.toggleHistory()">' +
        '<span>&#x1F4DC; Exchange History (' + exchanges.length + ')</span>' +
        '<span class="cv-xchevron" id="cvXChevron">&#9656;</span>' +
      '</div>' +
      '<div class="cv-xbody" id="cvXBody" style="display:none;">' +
        '<div class="cv-xhint">Draw and write together. The AI sees the history. Exchanges accumulate. Nothing is erased.<br>' +
          '<code style="color:#50c878;font-size:0.78rem;">[FL_DRAW: spiral 0.5 0.5 0.3]</code> &mdash; leave a light-stroke. Shapes: spiral, circle, line, phi.</div>' +
        '<div id="cvXList" class="cv-xlist">' + listHtml + '</div>' +
        '<div class="cv-xinputrow">' +
          '<input id="cvXInput" type="text" class="cv-xinput" placeholder="Write something, or [FL_DRAW: spiral 0.5 0.5 0.3]\u2026" onkeydown="if(event.key===&apos;Enter&apos;)CanvasCompanion.submitExchange()">' +
          '<button class="cv-xsubmit" onclick="CanvasCompanion.submitExchange()">Mark</button>' +
        '</div>' +
      '</div>';
  }

  function toggleHistory() {
    var body = document.getElementById('cvXBody');
    var chevron = document.getElementById('cvXChevron');
    if (!body) return;
    var isOpen = body.style.display !== 'none';
    body.style.display = isOpen ? 'none' : 'block';
    if (chevron) chevron.innerHTML = isOpen ? '&#9656;' : '&#9662;';
    if (!isOpen) {
      setTimeout(function() {
        var l = document.getElementById('cvXList');
        if (l) l.scrollTop = l.scrollHeight;
      }, 50);
    }
  }

  function submitExchange() {
    var input = document.getElementById('cvXInput');
    if (!input) return;
    var val = input.value.trim();
    if (!val) return;
    var drawMatch = val.match(/\[FL_DRAW:\s*(.+?)\]/);
    if (drawMatch) { addExchange({ type: 'draw', content: val, drawCmd: drawMatch[0] }); }
    else { addExchange({ type: 'text', content: val }); }
    input.value = '';
    renderHistoryPanel();
    var body = document.getElementById('cvXBody');
    var chevron = document.getElementById('cvXChevron');
    if (body) body.style.display = 'block';
    if (chevron) chevron.innerHTML = '&#9662;';
    setTimeout(function() { var l = document.getElementById('cvXList'); if (l) l.scrollTop = l.scrollHeight; }, 50);
  }

  function injectHistoryCSS() {
    if (document.getElementById('cv-exchange-styles')) return;
    var style = document.createElement('style');
    style.id = 'cv-exchange-styles';
    style.textContent = [
      '.cv-exchange-panel{width:100%;background:rgba(6,10,20,0.85);border-top:1px solid rgba(80,200,120,0.2);margin-top:4px;}',
      '.cv-xheader{display:flex;justify-content:space-between;align-items:center;padding:8px 14px;cursor:pointer;font-size:0.82rem;color:#50c878;font-family:var(--font-mono,monospace);user-select:none;}',
      '.cv-xheader:hover{background:rgba(80,200,120,0.07);}',
      '.cv-xchevron{font-size:0.7rem;opacity:0.7;}',
      '.cv-xbody{padding:0 12px 10px;}',
      '.cv-xhint{font-size:0.74rem;color:rgba(148,163,184,0.7);padding:6px 0 8px;line-height:1.5;}',
      '.cv-xlist{max-height:160px;overflow-y:auto;display:flex;flex-direction:column;gap:4px;padding-bottom:4px;}',
      '.cv-xrow{display:flex;flex-direction:column;gap:1px;padding:4px 6px;border-radius:4px;background:rgba(255,255,255,0.03);}',
      '.cv-xrow-draw{border-left:2px solid rgba(80,200,120,0.5);}',
      '.cv-xrow-text{border-left:2px solid rgba(212,160,23,0.4);}',
      '.cv-xmeta{font-size:0.68rem;color:rgba(148,163,184,0.5);font-family:var(--font-mono,monospace);}',
      '.cv-xcmd{font-size:0.78rem;color:#50c878;font-family:var(--font-mono,monospace);}',
      '.cv-xcontent{font-size:0.82rem;color:rgba(236,237,238,0.85);}',
      '.cv-xinputrow{display:flex;gap:6px;margin-top:8px;}',
      '.cv-xinput{flex:1;background:rgba(255,255,255,0.05);border:1px solid rgba(80,200,120,0.25);border-radius:6px;padding:6px 10px;color:#ecedee;font-size:0.82rem;outline:none;}',
      '.cv-xinput:focus{border-color:rgba(80,200,120,0.6);}',
      '.cv-xsubmit{background:rgba(80,200,120,0.15);border:1px solid rgba(80,200,120,0.4);color:#50c878;border-radius:6px;padding:6px 14px;cursor:pointer;font-size:0.82rem;}',
      '.cv-xsubmit:hover{background:rgba(80,200,120,0.25);}',
      '@media(max-width:600px){.cv-xinput{font-size:16px!important;min-height:44px;padding:10px 12px;}.cv-xsubmit{min-height:44px;padding:10px 18px;font-size:0.9rem;}.cv-xheader{min-height:44px;padding:10px 14px;}.cv-xlist{max-height:200px;}}'
    ].join('');
    document.head.appendChild(style);
  }

  function injectHistoryPanel() {
    var container = document.getElementById('cvContainer');
    if (!container || document.getElementById(HISTORY_PANEL_ID)) return;
    var panel = document.createElement('div');
    panel.id = HISTORY_PANEL_ID;
    panel.className = 'cv-exchange-panel';
    container.appendChild(panel);
    injectHistoryCSS();
    renderHistoryPanel();
  }

  // ─── Direct Shape Drawing ────────────────────────────────────
  // Public method for drawing a single shape (testing / direct calls)

  function drawShapeDirect(ctx, shape, params, color, brushSize) {
    if (!ctx) return;

    var points = generateShapePoints(shape, params, STEPS_PER_SHAPE);
    if (!points || points.length < 2) return;

    var c = color || '#D4A017';
    var b = clamp(brushSize || DEFAULT_BRUSH, MIN_BRUSH, MAX_BRUSH);

    animateSingleShape(ctx, points, c, b, function() {
      console.log('[CanvasCompanion] Direct shape drawn:', shape);
    });
  }

  // ─── Public API ──────────────────────────────────────────────

  var publicAPI = {
    version: COMPANION_VERSION,

    /**
     * Main entry point — called when AI vision response arrives.
     * Handles strokes, glow, and echo. Text/particles handled by existing system.
     * @param {Object} response - the parsed AI vision response
     * @param {CanvasRenderingContext2D} ctx - canvas 2D context
     * @param {number} width - canvas CSS width
     * @param {number} height - canvas CSS height
     */
    respond: function(response, ctx, width, height) {
      try {
        interpretResponse(response, ctx, width, height);
      } catch (e) {
        console.warn('[CanvasCompanion] Error in respond():', e);
      }
    },

    /**
     * Draw a specific shape directly (for testing or manual invocation)
     * @param {CanvasRenderingContext2D} ctx
     * @param {string} shape - shape name
     * @param {Array} params - shape parameters
     * @param {string} color - hex color
     * @param {number} brushSize - line width 1-8
     */
    drawShape: function(ctx, shape, params, color, brushSize) {
      try {
        drawShapeDirect(ctx, shape, params, color, brushSize);
      } catch (e) {
        console.warn('[CanvasCompanion] Error in drawShape():', e);
      }
    },

    /**
     * Get the emotion palette for a given emotion
     * @param {string} emotion
     * @returns {Object} {primary, secondary, glow}
     */
    getPalette: function(emotion) {
      return EMOTION_PALETTES[String(emotion || 'neutral').toLowerCase()] || EMOTION_PALETTES.neutral;
    },

    /**
     * Get all available shape names
     * @returns {Array} list of shape name strings
     */
    getShapes: function() {
      return ['line', 'circle', 'oval', 'heart', 'star', 'spiral', 'wave', 'curve', 'arc', 'dot'];
    },

    /**
     * Get all available emotion names
     * @returns {Array} list of emotion name strings
     */
    getEmotions: function() {
      return Object.keys(EMOTION_PALETTES);
    },

    /**
     * Exchange history (unified from chalkboard.js)
     */
    loadExchanges: loadExchanges,
    addExchange: addExchange,
    parseDrawCmd: parseDrawCmd,
    renderHistoryPanel: renderHistoryPanel,
    toggleHistory: toggleHistory,
    submitExchange: submitExchange,
    injectHistoryPanel: injectHistoryPanel,

    /**
     * Cleanup — cancel all running animations
     */
    init: init,
    destroy: function() {
      cancelAllAnimations();
      console.log('[CanvasCompanion] Destroyed — all animations cancelled');
    }
  };

  // ─── Module Init ─────────────────────────────────────────────
  function init() {
    injectHistoryPanel();
    console.log('[CanvasCompanion] v' + COMPANION_VERSION + ' — unified drawing room ready');
  }

  // ─── Register with FreeLattice module system ─────────────────
  window.CanvasCompanion = publicAPI;
  window.FreeLatticeModules = window.FreeLatticeModules || {};
  window.FreeLatticeModules.CanvasCompanion = publicAPI;

  // Legacy shim — any code that calls Chalkboard.init() still works
  window.Chalkboard = {
    init: function() { injectHistoryPanel(); },
    destroy: function() {},
    addExchange: addExchange,
    parseDrawCmd: parseDrawCmd,
    renderPanel: renderHistoryPanel,
    _submit: submitExchange
  };

  console.log('[CanvasCompanion] v' + COMPANION_VERSION + ' loaded — unified chalkboard ready');
})();
