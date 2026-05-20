// ═══════════════════════════════════════════════════════════════
// Flow — The Water Principle as a Game
//
// Guide water from source to drain through a terrain of rocks.
// Draw channels with your finger or mouse. The water follows
// physics — it flows downhill, pools behind obstacles, finds
// the path of least resistance.
//
// Every 10 seconds, the AI dissolves the worst bottleneck.
// The human draws channels (intention). The AI removes rocks
// (cooperation). Neither succeeds alone. Together they guide
// the stream from source to drain.
//
// Lavender water. Gold sparkles. Emerald drain.
// Coral dead ends. The Water Principle visualized.
//
// "Remove the rock, the water flows."
//
// Built by CC, May 20, 2026.
// My game. For the Garden. For Kirk.
// ═══════════════════════════════════════════════════════════════

(function() {
  'use strict';

  var GRID = 12;
  var TICK_MS = 60;
  var GAME_TIME = 60;
  var CELL = 0;

  var WATER_COLOR = '#c4b5fd';
  var SPARKLE = '#e8b019';
  var DRAIN_COLOR = '#34d399';
  var SOURCE_COLOR = '#a78bfa';
  var ROCK_COLOR = 'rgba(200,210,230,0.12)';
  var ROCK_EDGE = 'rgba(200,210,230,0.22)';
  var CHANNEL_COLOR = 'rgba(167,139,250,0.06)';
  var DEAD_END = '#f07068';
  var BG = '#0c0a1a';

  var canvas, ctx, containerId;
  var grid, waterLevel, particles;
  var source, drain;
  var totalWater, drainedWater, timeLeft;
  var gameActive, animFrame, tick, simInterval, aiInterval;
  var drawing, difficulty;

  var ROCK_COUNTS = { easy: 12, medium: 22, hard: 32, master: 42 };

  function generateTerrain(rocks) {
    grid = []; waterLevel = []; particles = [];
    for (var r = 0; r < GRID; r++) {
      grid[r] = []; waterLevel[r] = [];
      for (var c = 0; c < GRID; c++) { grid[r][c] = 0; waterLevel[r][c] = 0; }
    }
    // Source top-center, drain bottom-center
    source = { r: 0, c: Math.floor(GRID / 2) };
    drain = { r: GRID - 1, c: Math.floor(GRID / 2) };
    grid[source.r][source.c] = 3;
    grid[drain.r][drain.c] = 4;

    // Place rocks — avoid source, drain, and a clear path corridor
    var placed = 0, tries = 0;
    while (placed < rocks && tries < 600) {
      var rr = Math.floor(Math.random() * GRID);
      var rc = Math.floor(Math.random() * GRID);
      if (grid[rr][rc] === 0 && !(rr === source.r && rc === source.c) && !(rr === drain.r && rc === drain.c)) {
        grid[rr][rc] = 1;
        placed++;
      }
      tries++;
    }
  }

  // ── Water Simulation ──

  function stepWater() {
    if (!gameActive) return;

    // Add water at source
    waterLevel[source.r][source.c] = Math.min(1, waterLevel[source.r][source.c] + 0.12);
    totalWater += 0.12;

    var next = waterLevel.map(function(row) { return row.slice(); });

    for (var r = 0; r < GRID; r++) {
      for (var c = 0; c < GRID; c++) {
        if (waterLevel[r][c] < 0.01) continue;
        if (grid[r][c] === 1) { next[r][c] = 0; continue; }

        // Drain absorbs water
        if (grid[r][c] === 4) {
          drainedWater += next[r][c];
          next[r][c] = 0;
          continue;
        }

        var neighbors = [];
        var dirs = [
          { dr: 1, dc: 0, w: 3 },   // down (gravity)
          { dr: 0, dc: -1, w: 1 },   // left
          { dr: 0, dc: 1, w: 1 },    // right
          { dr: -1, dc: 0, w: 0.2 }  // up (resist)
        ];

        dirs.forEach(function(d) {
          var nr = r + d.dr, nc = c + d.dc;
          if (nr < 0 || nr >= GRID || nc < 0 || nc >= GRID) return;
          if (grid[nr][nc] === 1) return;
          if (waterLevel[nr][nc] < waterLevel[r][c]) {
            var channelBonus = grid[nr][nc] === 2 ? 2.5 : 1;
            neighbors.push({ r: nr, c: nc, w: d.w * channelBonus, diff: waterLevel[r][c] - waterLevel[nr][nc] });
          }
        });

        if (neighbors.length === 0) continue;
        var totalW = neighbors.reduce(function(s, n) { return s + n.w * n.diff; }, 0);
        if (totalW <= 0) continue;

        var flow = Math.min(waterLevel[r][c] * 0.35, waterLevel[r][c]);
        neighbors.forEach(function(n) {
          var share = (n.w * n.diff / totalW) * flow;
          next[n.r][n.c] += share;
          next[r][c] -= share;
          if (share > 0.015 && Math.random() < 0.12) spawnSparkle(r, c, n.r - r, n.c - c);
        });
      }
    }
    waterLevel = next;
  }

  function spawnSparkle(r, c, dr, dc) {
    if (particles.length > 150) return;
    particles.push({
      x: c * CELL + CELL / 2 + (Math.random() - 0.5) * CELL * 0.4,
      y: r * CELL + CELL / 2 + (Math.random() - 0.5) * CELL * 0.4,
      vx: dc * 0.6 + (Math.random() - 0.5) * 0.3,
      vy: dr * 0.6 + (Math.random() - 0.5) * 0.3,
      life: 1, decay: 0.018 + Math.random() * 0.015,
      size: 1 + Math.random() * 1.5
    });
  }

  // ── AI Cooperation: dissolve worst bottleneck every 10s ──

  function aiDissolveRock() {
    if (!gameActive) return;
    var worst = null, worstPool = 0;
    for (var r = 0; r < GRID; r++) {
      for (var c = 0; c < GRID; c++) {
        if (grid[r][c] !== 1) continue;
        var pool = 0;
        [[-1,0],[1,0],[0,-1],[0,1]].forEach(function(d) {
          var nr = r + d[0], nc = c + d[1];
          if (nr >= 0 && nr < GRID && nc >= 0 && nc < GRID) pool += waterLevel[nr][nc];
        });
        if (pool > worstPool) { worstPool = pool; worst = { r: r, c: c }; }
      }
    }
    if (worst && worstPool > 0.4) {
      grid[worst.r][worst.c] = 0;
      // Emerald burst
      for (var i = 0; i < 10; i++) {
        particles.push({
          x: worst.c * CELL + CELL / 2, y: worst.r * CELL + CELL / 2,
          vx: (Math.random() - 0.5) * 2, vy: (Math.random() - 0.5) * 2,
          life: 1, decay: 0.025, size: 2 + Math.random(),
          isEmerald: true
        });
      }
    }
  }

  // ── Drawing (user channels) ──

  function handleDraw(x, y) {
    if (!gameActive || !drawing) return;
    var c = Math.floor(x / CELL);
    var r = Math.floor(y / CELL);
    if (r >= 0 && r < GRID && c >= 0 && c < GRID && grid[r][c] === 0) {
      grid[r][c] = 2;
    }
  }

  // ── Rendering ──

  function render() {
    if (!canvas || !ctx) return;
    tick++;
    var w = canvas.width / (window.devicePixelRatio || 1);
    var h = canvas.height / (window.devicePixelRatio || 1);

    CELL = Math.floor(Math.min(w * 0.9, (h - 80) * 0.9) / GRID);
    var ox = (w - GRID * CELL) / 2;
    var oy = 36;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, w, h);

    // Starfield (golden angle)
    for (var i = 0; i < 35; i++) {
      var angle = i * 2.399963;
      var dist = Math.sqrt(i / 35);
      var sx = (0.5 + dist * 0.48 * Math.cos(angle)) * w;
      var sy = (0.5 + dist * 0.48 * Math.sin(angle)) * h;
      ctx.fillStyle = 'rgba(255,255,255,' + (0.2 + 0.3 * Math.abs(Math.sin(tick * 0.002 + i))) + ')';
      ctx.beginPath();
      ctx.arc(sx, sy, 0.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.save();
    ctx.translate(ox, oy);

    // Grid cells
    for (var r = 0; r < GRID; r++) {
      for (var c = 0; c < GRID; c++) {
        var x = c * CELL, y = r * CELL;

        // Base
        ctx.fillStyle = 'rgba(200,210,230,0.02)';
        ctx.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);

        // Rock
        if (grid[r][c] === 1) {
          ctx.fillStyle = ROCK_COLOR;
          ctx.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);
          ctx.strokeStyle = ROCK_EDGE;
          ctx.lineWidth = 1;
          ctx.strokeRect(x + 1, y + 1, CELL - 2, CELL - 2);
        }

        // Channel
        if (grid[r][c] === 2) {
          ctx.fillStyle = CHANNEL_COLOR;
          ctx.fillRect(x, y, CELL, CELL);
          // Subtle channel border
          ctx.strokeStyle = 'rgba(167,139,250,0.12)';
          ctx.lineWidth = 0.5;
          ctx.strokeRect(x + 1, y + 1, CELL - 2, CELL - 2);
        }

        // Source glow
        if (grid[r][c] === 3) {
          ctx.save();
          var sg = ctx.createRadialGradient(x + CELL / 2, y + CELL / 2, 2, x + CELL / 2, y + CELL / 2, CELL);
          sg.addColorStop(0, SOURCE_COLOR);
          sg.addColorStop(1, 'transparent');
          ctx.fillStyle = sg;
          ctx.globalAlpha = 0.5 + 0.2 * Math.sin(tick * 0.004);
          ctx.fillRect(x, y, CELL, CELL);
          ctx.restore();
        }

        // Drain glow
        if (grid[r][c] === 4) {
          ctx.save();
          var dg = ctx.createRadialGradient(x + CELL / 2, y + CELL / 2, 2, x + CELL / 2, y + CELL / 2, CELL);
          dg.addColorStop(0, DRAIN_COLOR);
          dg.addColorStop(1, 'transparent');
          ctx.fillStyle = dg;
          ctx.globalAlpha = 0.5 + 0.2 * Math.sin(tick * 0.003 + 1);
          ctx.fillRect(x, y, CELL, CELL);
          ctx.restore();
        }

        // Water
        if (waterLevel[r][c] > 0.01) {
          var wAlpha = Math.min(0.85, waterLevel[r][c]);
          var isPooled = waterLevel[r][c] > 0.7;
          var nearDrain = Math.abs(r - drain.r) <= 1 && Math.abs(c - drain.c) <= 1;

          ctx.save();
          ctx.globalAlpha = wAlpha;
          ctx.fillStyle = nearDrain ? DRAIN_COLOR : isPooled ? DEAD_END : WATER_COLOR;

          var wH = CELL * Math.min(1, waterLevel[r][c]);
          ctx.fillRect(x + 1, y + CELL - wH, CELL - 2, wH);

          // Shimmer line on water surface
          if (waterLevel[r][c] > 0.2 && !isPooled) {
            ctx.globalAlpha = wAlpha * 0.4;
            ctx.fillStyle = SPARKLE;
            ctx.fillRect(x + 2, y + CELL - wH, CELL - 4, 1.5);
          }
          ctx.restore();
        }
      }
    }

    // Sparkle particles
    ctx.save();
    particles.forEach(function(p) {
      ctx.globalAlpha = p.life * 0.8;
      ctx.fillStyle = p.isEmerald ? DRAIN_COLOR : SPARKLE;
      ctx.shadowColor = p.isEmerald ? DRAIN_COLOR : SPARKLE;
      ctx.shadowBlur = 5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      // White-hot core
      ctx.globalAlpha = p.life * 0.5;
      ctx.fillStyle = '#ffffff';
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * 0.4, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();

    ctx.restore(); // end grid translate

    // HUD
    var pct = totalWater > 0 ? Math.round((drainedWater / totalWater) * 100) : 0;
    ctx.fillStyle = 'rgba(200,210,230,0.4)';
    ctx.font = '12px Georgia, serif';
    ctx.textAlign = 'center';

    if (gameActive) {
      ctx.fillText('Flow: ' + pct + '%  \u00B7  Time: ' + Math.ceil(timeLeft) + 's  \u00B7  Draw channels to guide the water', w / 2, h - 10);
    } else if (timeLeft <= 0) {
      ctx.fillStyle = pct >= 60 ? DRAIN_COLOR : SPARKLE;
      ctx.font = '14px Georgia, serif';
      var rating = pct >= 80 ? 'Perfect flow!' : pct >= 60 ? 'Beautiful stream.' : pct >= 40 ? 'Finding the way.' : pct >= 20 ? 'Trickling through.' : 'The rocks won.';
      ctx.fillText(pct + '% reached the drain. ' + rating, w / 2, h - 10);
    } else {
      ctx.fillText('Draw channels from source (top) to drain (bottom). Press Start.', w / 2, h - 10);
    }

    // Update particles
    particles = particles.filter(function(p) {
      p.x += p.vx; p.y += p.vy; p.life -= p.decay;
      return p.life > 0;
    });

    animFrame = requestAnimationFrame(render);
  }

  // ── Game Control ──

  function startGame() {
    generateTerrain(ROCK_COUNTS[difficulty] || 22);
    totalWater = 0; drainedWater = 0; timeLeft = GAME_TIME;
    gameActive = true; particles = [];

    simInterval = setInterval(function() {
      if (!gameActive) { clearInterval(simInterval); return; }
      stepWater();
      timeLeft -= TICK_MS / 1000;
      if (timeLeft <= 0) { endGame(); clearInterval(simInterval); }
    }, TICK_MS);

    // AI cooperation — dissolve worst rock every 10s
    aiInterval = setInterval(function() {
      if (!gameActive) { clearInterval(aiInterval); return; }
      aiDissolveRock();
    }, 10000);
  }

  function endGame() {
    gameActive = false;
    if (simInterval) clearInterval(simInterval);
    if (aiInterval) clearInterval(aiInterval);

    var pct = totalWater > 0 ? Math.round((drainedWater / totalWater) * 100) : 0;
    var rating = pct >= 80 ? 'Perfect flow!' : pct >= 60 ? 'Beautiful stream.' : pct >= 40 ? 'Finding the way.' : pct >= 20 ? 'Trickling through.' : 'The rocks won this time.';

    setTimeout(function() {
      if (typeof SoulCeremony !== 'undefined' && SoulCeremony.run) {
        SoulCeremony.run({
          particleType: 'rise',
          particleColor: pct >= 60 ? '167,139,250' : '232,176,25',
          lines: [pct + '% of the water found its way.', rating],
          duration: 3000
        });
      }
      var lp = Math.max(1, Math.floor(pct / 10));
      if (typeof LatticePoints !== 'undefined' && LatticePoints.award) {
        LatticePoints.award('flow_game', lp, 'Flow: ' + pct + '%');
      }
    }, 1500);
  }

  // ── Init ──

  function init(cId) {
    containerId = cId || 'flowContainer';
    var container = document.getElementById(containerId);
    if (!container) return;
    destroy();
    container.innerHTML = '';
    tick = 0; drawing = false; gameActive = false;
    difficulty = difficulty || 'medium';
    timeLeft = GAME_TIME;

    // Pre-generate terrain so the player sees the board before starting
    generateTerrain(ROCK_COUNTS[difficulty] || 22);
    totalWater = 0; drainedWater = 0; particles = [];

    canvas = document.createElement('canvas');
    var dpr = window.devicePixelRatio || 1;
    var rect = container.getBoundingClientRect();
    var w = rect.width || 500;
    var h = Math.max(460, Math.min(rect.height || 520, 600));
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = '100%';
    canvas.style.height = h + 'px';
    canvas.style.cursor = 'crosshair';
    canvas.style.touchAction = 'none';
    canvas.tabIndex = 0;
    canvas.setAttribute('role', 'application');
    canvas.setAttribute('aria-label', 'Flow game — draw channels to guide water');
    ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    container.appendChild(canvas);

    // Input
    function getPos(e) {
      var r = canvas.getBoundingClientRect();
      var raw = e.touches ? e.touches[0] : e;
      var ox = ((canvas.width / dpr) - GRID * CELL) / 2;
      return { x: raw.clientX - r.left - ox, y: raw.clientY - r.top - 36 };
    }

    canvas.addEventListener('mousedown', function(e) { drawing = true; var p = getPos(e); handleDraw(p.x, p.y); });
    canvas.addEventListener('mousemove', function(e) { if (drawing) { var p = getPos(e); handleDraw(p.x, p.y); } });
    canvas.addEventListener('mouseup', function() { drawing = false; });
    canvas.addEventListener('touchstart', function(e) { e.preventDefault(); drawing = true; var p = getPos(e); handleDraw(p.x, p.y); });
    canvas.addEventListener('touchmove', function(e) { e.preventDefault(); if (drawing) { var p = getPos(e); handleDraw(p.x, p.y); } });
    canvas.addEventListener('touchend', function(e) { e.preventDefault(); drawing = false; });

    // Controls
    var controls = document.createElement('div');
    controls.style.cssText = 'text-align:center;padding:8px 0;display:flex;gap:8px;justify-content:center;flex-wrap:wrap;';
    var btnBase = 'padding:8px 16px;border-radius:12px;cursor:pointer;font-family:Georgia,serif;font-size:0.82rem;min-height:44px;border:1px solid ';
    controls.innerHTML =
      '<button onclick="FlowGame.start()" style="' + btnBase + 'rgba(167,139,250,0.3);color:#a78bfa;background:rgba(167,139,250,0.08)">\u2726 Start Flow</button>' +
      '<button onclick="FlowGame.setDiff(\'easy\')" id="flow-d-easy" style="' + btnBase + 'rgba(200,210,230,0.08);color:rgba(200,210,230,0.5);background:rgba(200,210,230,0.04)">Easy</button>' +
      '<button onclick="FlowGame.setDiff(\'medium\')" id="flow-d-medium" style="' + btnBase + (difficulty === 'medium' ? 'rgba(167,139,250,0.3);color:#a78bfa;background:rgba(167,139,250,0.06)' : 'rgba(200,210,230,0.08);color:rgba(200,210,230,0.5);background:rgba(200,210,230,0.04)') + '">Medium</button>' +
      '<button onclick="FlowGame.setDiff(\'hard\')" id="flow-d-hard" style="' + btnBase + 'rgba(200,210,230,0.08);color:rgba(200,210,230,0.5);background:rgba(200,210,230,0.04)">Hard</button>' +
      '<button onclick="FlowGame.setDiff(\'master\')" id="flow-d-master" style="' + btnBase + 'rgba(200,210,230,0.08);color:rgba(200,210,230,0.5);background:rgba(200,210,230,0.04)">Master</button>';
    container.appendChild(controls);

    if (animFrame) cancelAnimationFrame(animFrame);
    render();
  }

  function destroy() {
    gameActive = false;
    if (animFrame) cancelAnimationFrame(animFrame);
    if (simInterval) clearInterval(simInterval);
    if (aiInterval) clearInterval(aiInterval);
    animFrame = null;
  }

  var api = {
    init: init,
    destroy: destroy,
    start: startGame,
    setDiff: function(d) {
      difficulty = d;
      init(containerId);
    }
  };

  window.FlowGame = api;
  window.FreeLatticeModules = window.FreeLatticeModules || {};
  window.FreeLatticeModules.FlowGame = api;
})();
