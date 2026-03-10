// ═════════════════════════════════════════════════════════════════
// FreeLattice Module: Radio Immersive
// FreeLattice Radio — Immersive Visual Worlds Engine (v5.1)
// Five reactive worlds. The lattice breathes. The fireflies dream.
// HTML5 Canvas — zero external libraries
//
// Lazy-loaded when the user clicks "Expand" on the Radio panel.
// Depends on: FreeLatticeRadio (must be loaded in index.html)
// See ARCHITECTURE.md for module system documentation.
// ═════════════════════════════════════════════════════════════════

(function() {
  'use strict';

  const PHI = 1.6180339887;
  const TAU = Math.PI * 2;
  const MAX_PARTICLES = 300;
  const POOL_SIZE = 350;

  // ── World Definitions ─────────────────────────────────────
  const WORLDS = [
    {
      id: 'golden-drift',
      name: 'Golden Drift',
      desc: 'Warm amber fireflies in golden spiral patterns',
      bg1: '#080600', bg2: '#1a1000',
      colors: [[212,168,67],[255,200,80],[180,140,50],[230,180,60],[255,220,100],[200,160,40]],
      accent: '#d4a843'
    },
    {
      id: 'deep-space',
      name: 'Deep Space',
      desc: 'Stars, nebulae, and cosmic drift at infinite depth',
      bg1: '#000006', bg2: '#080818',
      colors: [[123,140,222],[180,200,255],[100,120,200],[200,210,255],[160,180,240],[220,225,255]],
      accent: '#7b9ede'
    },
    {
      id: 'forest-rain',
      name: 'Forest Rain',
      desc: 'Bioluminescent rain in a deep emerald forest',
      bg1: '#000a04', bg2: '#041a0e',
      colors: [[106,191,138],[60,220,140],[80,180,160],[40,200,120],[120,255,180],[50,180,100]],
      accent: '#6abf8a'
    },
    {
      id: 'crystal-cave',
      name: 'Crystal Cave',
      desc: 'Prismatic diamonds refracting light in deep caverns',
      bg1: '#06001a', bg2: '#10082a',
      colors: [[200,216,232],[220,200,255],[180,220,255],[255,220,240],[240,240,255],[200,180,240]],
      accent: '#c8d8f0'
    },
    {
      id: 'heartbeat',
      name: 'Heartbeat',
      desc: 'A living pulse — warm, grounding, alive',
      bg1: '#0a0000', bg2: '#1a0808',
      colors: [[224,136,152],[255,120,140],[200,100,120],[255,160,170],[255,180,190],[220,90,110]],
      accent: '#e08898'
    }
  ];

  // ── State ─────────────────────────────────────────────
  let canvas = null;
  let ctx = null;
  let animFrame = null;
  let isActive = false;
  let currentWorldIndex = 0;
  let particles = [];
  let particlePool = [];
  let stars = [];
  let crystals = [];
  let nebulae = [];
  let poolDrops = [];
  let heartbeatPhase = 0;
  let heartbeatSize = 0;
  let ripples = [];
  let shootingStars = [];
  let transitionAlpha = 0;
  let isTransitioning = false;
  let controlsVisible = true;
  let controlsTimer = null;
  let lastTime = 0;
  let W = 0, H = 0;

  // Audio data
  let audioData = null;
  let bassEnergy = 0;
  let midEnergy = 0;
  let highEnergy = 0;
  let totalEnergy = 0;
  let smoothBass = 0;
  let smoothMid = 0;
  let smoothHigh = 0;
  let smoothTotal = 0;

  // ── Object Pool ───────────────────────────────────────
  function getParticle() {
    if (particlePool.length > 0) return particlePool.pop();
    return {};
  }

  function releaseParticle(p) {
    if (particlePool.length < POOL_SIZE) particlePool.push(p);
  }

  // ── Audio Analysis ────────────────────────────────────
  function analyzeAudio() {
    var radio = window.FreeLatticeRadio;
    if (!radio || !radio._getAnalyser) {
      smoothBass *= 0.95; smoothMid *= 0.95; smoothHigh *= 0.95; smoothTotal *= 0.95;
      return;
    }
    var analyser = radio._getAnalyser();
    if (!analyser) {
      smoothBass *= 0.95; smoothMid *= 0.95; smoothHigh *= 0.95; smoothTotal *= 0.95;
      return;
    }

    if (!audioData || audioData.length !== analyser.frequencyBinCount) {
      audioData = new Uint8Array(analyser.frequencyBinCount);
    }
    analyser.getByteFrequencyData(audioData);

    var len = audioData.length;
    var bassEnd = Math.floor(len * 0.15);
    var midEnd = Math.floor(len * 0.5);
    var bSum = 0, mSum = 0, hSum = 0, tSum = 0;

    for (var i = 0; i < len; i++) {
      var v = audioData[i] / 255;
      tSum += v;
      if (i < bassEnd) bSum += v;
      else if (i < midEnd) mSum += v;
      else hSum += v;
    }

    bassEnergy = bSum / Math.max(1, bassEnd);
    midEnergy = mSum / Math.max(1, midEnd - bassEnd);
    highEnergy = hSum / Math.max(1, len - midEnd);
    totalEnergy = tSum / len;

    var s = 0.15;
    smoothBass += (bassEnergy - smoothBass) * s;
    smoothMid += (midEnergy - smoothMid) * s;
    smoothHigh += (highEnergy - smoothHigh) * s;
    smoothTotal += (totalEnergy - smoothTotal) * s;
  }

  // ── Canvas Setup ──────────────────────────────────────
  function initCanvas() {
    canvas = document.getElementById('flRadioImmersiveCanvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
  }

  function resize() {
    if (!canvas) return;
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W;
    canvas.height = H;
  }

  // ── Background Rendering ────────────────────────────────
  function drawBackground(world) {
    var grad = ctx.createRadialGradient(W*0.5, H*0.5, 0, W*0.5, H*0.5, Math.max(W,H)*0.7);
    grad.addColorStop(0, world.bg2);
    grad.addColorStop(1, world.bg1);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    var vignetteStrength = 0.3 + smoothBass * 0.2;
    var vGrad = ctx.createRadialGradient(W*0.5, H*0.5, W*0.2, W*0.5, H*0.5, Math.max(W,H)*0.75);
    vGrad.addColorStop(0, 'rgba(0,0,0,0)');
    vGrad.addColorStop(1, 'rgba(0,0,0,' + vignetteStrength + ')');
    ctx.fillStyle = vGrad;
    ctx.fillRect(0, 0, W, H);
  }

  // ═════════════════════════════════════════════════════════
  // WORLD 1: GOLDEN DRIFT
  // ═════════════════════════════════════════════════════════
  function initGoldenDrift() {
    particles = [];
    for (var i = 0; i < 180; i++) {
      particles.push(createGoldenParticle(true));
    }
  }

  function createGoldenParticle(randomStart) {
    var p = getParticle();
    var colors = WORLDS[0].colors;
    var c = colors[Math.floor(Math.random() * colors.length)];
    p.x = randomStart ? Math.random() * W : W * 0.5 + (Math.random() - 0.5) * 100;
    p.y = randomStart ? Math.random() * H : H * 0.5 + (Math.random() - 0.5) * 100;
    p.phase = Math.random() * TAU;
    p.phaseSpeed = 0.003 + Math.random() * 0.008;
    p.lissajousA = 0.5 + Math.random() * 2;
    p.lissajousB = p.lissajousA * PHI;
    p.radius = 50 + Math.random() * (Math.min(W, H) * 0.35);
    p.cx = W * (0.2 + Math.random() * 0.6);
    p.cy = H * (0.2 + Math.random() * 0.6);
    p.size = 1.5 + Math.random() * 4;
    p.baseAlpha = 0.2 + Math.random() * 0.6;
    p.alpha = randomStart ? p.baseAlpha : 0;
    p.fadeIn = !randomStart;
    p.r = c[0]; p.g = c[1]; p.b = c[2];
    p.pulse = Math.random() * TAU;
    p.pulseSpeed = 0.02 + Math.random() * 0.03;
    p.life = 0;
    p.maxLife = 600 + Math.random() * 800;
    p.drift = Math.random() * TAU;
    return p;
  }

  function updateGoldenDrift(dt) {
    var spawnRate = 0.08 + smoothTotal * 0.15;
    if (particles.length < MAX_PARTICLES && Math.random() < spawnRate) {
      particles.push(createGoldenParticle(false));
    }

    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.life++;
      p.phase += p.phaseSpeed * (1 + smoothMid * 0.5) * dt;
      p.pulse += p.pulseSpeed * dt;
      p.drift += 0.0003 * dt;

      p.x = p.cx + Math.sin(p.phase * p.lissajousA + p.drift) * p.radius * (1 + smoothBass * 0.15);
      p.y = p.cy + Math.cos(p.phase * p.lissajousB) * p.radius * 0.6 * (1 + smoothBass * 0.1);

      var pulseFactor = 0.7 + 0.3 * Math.sin(p.pulse) + smoothTotal * 0.3;

      if (p.fadeIn) {
        p.alpha = Math.min(p.alpha + 0.005 * dt, p.baseAlpha);
        if (p.alpha >= p.baseAlpha * 0.9) p.fadeIn = false;
      }
      if (p.life > p.maxLife * 0.7) {
        p.alpha *= (1 - 0.003 * dt);
      }

      if (p.life > p.maxLife || p.alpha < 0.005) {
        releaseParticle(particles.splice(i, 1)[0]);
        continue;
      }

      var drawAlpha = p.alpha * pulseFactor;
      var drawSize = p.size * (1 + smoothBass * 0.4);
      drawGlow(p.x, p.y, drawSize, p.r, p.g, p.b, drawAlpha);
    }
  }

  // ═════════════════════════════════════════════════════════
  // WORLD 2: DEEP SPACE
  // ═════════════════════════════════════════════════════════
  function initDeepSpace() {
    particles = [];
    stars = [];
    nebulae = [];
    shootingStars = [];

    for (var i = 0; i < 300; i++) {
      stars.push({
        x: Math.random() * W,
        y: Math.random() * H,
        size: 0.3 + Math.random() * 2.2,
        depth: 0.2 + Math.random() * 0.8,
        twinkle: Math.random() * TAU,
        twinkleSpeed: 0.01 + Math.random() * 0.04,
        brightness: 0.3 + Math.random() * 0.7
      });
    }

    for (var j = 0; j < 6; j++) {
      nebulae.push({
        x: W * (0.1 + Math.random() * 0.8),
        y: H * (0.1 + Math.random() * 0.8),
        radius: 100 + Math.random() * 250,
        r: 80 + Math.floor(Math.random() * 80),
        g: 80 + Math.floor(Math.random() * 100),
        b: 150 + Math.floor(Math.random() * 105),
        alpha: 0.04 + Math.random() * 0.05,
        drift: Math.random() * TAU,
        driftSpeed: 0.0002 + Math.random() * 0.0005,
        pulse: Math.random() * TAU
      });
    }

    for (var k = 0; k < 80; k++) {
      particles.push(createSpaceParticle(true));
    }
  }

  function createSpaceParticle(randomStart) {
    var p = getParticle();
    var colors = WORLDS[1].colors;
    var c = colors[Math.floor(Math.random() * colors.length)];
    p.x = Math.random() * W;
    p.y = randomStart ? Math.random() * H : -10;
    p.vx = (Math.random() - 0.5) * 0.15;
    p.vy = 0.05 + Math.random() * 0.2;
    p.size = 0.8 + Math.random() * 2.5;
    p.baseAlpha = 0.1 + Math.random() * 0.4;
    p.alpha = randomStart ? p.baseAlpha : 0;
    p.fadeIn = !randomStart;
    p.r = c[0]; p.g = c[1]; p.b = c[2];
    p.pulse = Math.random() * TAU;
    p.pulseSpeed = 0.01 + Math.random() * 0.02;
    p.life = 0;
    p.maxLife = 500 + Math.random() * 700;
    p.depth = 0.3 + Math.random() * 0.7;
    return p;
  }

  function updateDeepSpace(dt) {
    var time = performance.now() * 0.001;

    // Nebulae
    for (var n = 0; n < nebulae.length; n++) {
      var neb = nebulae[n];
      neb.drift += neb.driftSpeed * dt;
      neb.pulse += 0.005 * dt;
      var nx = neb.x + Math.sin(neb.drift) * 30;
      var ny = neb.y + Math.cos(neb.drift * PHI) * 20;
      var nAlpha = neb.alpha * (0.8 + 0.2 * Math.sin(neb.pulse) + smoothBass * 0.5);
      var nRadius = neb.radius * (1 + smoothBass * 0.15);

      var nebGrad = ctx.createRadialGradient(nx, ny, 0, nx, ny, nRadius);
      nebGrad.addColorStop(0, 'rgba(' + neb.r + ',' + neb.g + ',' + neb.b + ',' + nAlpha + ')');
      nebGrad.addColorStop(0.5, 'rgba(' + neb.r + ',' + neb.g + ',' + neb.b + ',' + (nAlpha * 0.4) + ')');
      nebGrad.addColorStop(1, 'rgba(' + neb.r + ',' + neb.g + ',' + neb.b + ',0)');
      ctx.fillStyle = nebGrad;
      ctx.fillRect(nx - nRadius, ny - nRadius, nRadius * 2, nRadius * 2);
    }

    // Stars with parallax and twinkle
    for (var si = 0; si < stars.length; si++) {
      var star = stars[si];
      star.twinkle += star.twinkleSpeed * dt;
      var parallaxX = Math.sin(time * 0.05) * 10 * star.depth;
      var parallaxY = Math.cos(time * 0.03) * 6 * star.depth;
      var sx = ((star.x + parallaxX) % W + W) % W;
      var sy = ((star.y + parallaxY) % H + H) % H;
      var twinkleFactor = 0.5 + 0.5 * Math.sin(star.twinkle);
      var sAlpha = star.brightness * twinkleFactor * (0.7 + smoothHigh * 0.5);
      var sSize = star.size * (1 + smoothBass * 0.2);

      ctx.beginPath();
      ctx.arc(sx, sy, sSize, 0, TAU);
      ctx.fillStyle = 'rgba(200,210,255,' + sAlpha + ')';
      ctx.fill();

      if (star.size > 1.2) {
        ctx.beginPath();
        ctx.arc(sx, sy, sSize * 3, 0, TAU);
        ctx.fillStyle = 'rgba(180,200,255,' + (sAlpha * 0.15) + ')';
        ctx.fill();
      }
    }

    // Shooting stars
    if (Math.random() < 0.002 * dt + smoothBass * 0.005) {
      shootingStars.push({
        x: Math.random() * W,
        y: Math.random() * H * 0.5,
        vx: 3 + Math.random() * 5,
        vy: 1 + Math.random() * 3,
        life: 0,
        maxLife: 30 + Math.random() * 40,
        size: 1 + Math.random() * 2,
        alpha: 0.8
      });
    }

    for (var ss = shootingStars.length - 1; ss >= 0; ss--) {
      var sh = shootingStars[ss];
      sh.life++;
      sh.x += sh.vx * dt;
      sh.y += sh.vy * dt;
      sh.alpha *= (1 - 0.03 * dt);

      if (sh.life > sh.maxLife || sh.alpha < 0.01) {
        shootingStars.splice(ss, 1);
        continue;
      }

      ctx.beginPath();
      ctx.moveTo(sh.x, sh.y);
      ctx.lineTo(sh.x - sh.vx * 8, sh.y - sh.vy * 8);
      ctx.strokeStyle = 'rgba(220,230,255,' + sh.alpha + ')';
      ctx.lineWidth = sh.size;
      ctx.lineCap = 'round';
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(sh.x, sh.y, sh.size, 0, TAU);
      ctx.fillStyle = 'rgba(255,255,255,' + sh.alpha + ')';
      ctx.fill();
    }

    // Floating particles
    var spawnRate = 0.04 + smoothTotal * 0.08;
    if (particles.length < 80 && Math.random() < spawnRate) {
      particles.push(createSpaceParticle(false));
    }

    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.life++;
      p.pulse += p.pulseSpeed * dt;
      p.x += p.vx * dt + Math.sin(p.life * 0.005) * 0.1;
      p.y += p.vy * p.depth * dt;

      if (p.fadeIn) {
        p.alpha = Math.min(p.alpha + 0.004 * dt, p.baseAlpha);
        if (p.alpha >= p.baseAlpha * 0.9) p.fadeIn = false;
      }
      if (p.life > p.maxLife * 0.7) p.alpha *= (1 - 0.003 * dt);

      if (p.life > p.maxLife || p.alpha < 0.005 || p.y > H + 20) {
        releaseParticle(particles.splice(i, 1)[0]);
        continue;
      }

      var pulseFactor = 0.7 + 0.3 * Math.sin(p.pulse) + smoothMid * 0.3;
      var drawAlpha = p.alpha * pulseFactor;
      var drawSize = p.size * (1 + smoothBass * 0.3);
      drawGlow(p.x, p.y, drawSize, p.r, p.g, p.b, drawAlpha);
    }
  }

  // ═════════════════════════════════════════════════════════
  // WORLD 3: FOREST RAIN
  // ═════════════════════════════════════════════════════════
  function initForestRain() {
    particles = [];
    poolDrops = [];
    for (var i = 0; i < 150; i++) {
      particles.push(createRainParticle(true));
    }
  }

  function createRainParticle(randomStart) {
    var p = getParticle();
    var colors = WORLDS[2].colors;
    var c = colors[Math.floor(Math.random() * colors.length)];
    p.x = Math.random() * W;
    p.y = randomStart ? Math.random() * H : -10 - Math.random() * 50;
    p.vx = (Math.random() - 0.5) * 0.3;
    p.vy = 1.2 + Math.random() * 2.5;
    p.size = 1 + Math.random() * 2.5;
    p.baseAlpha = 0.2 + Math.random() * 0.5;
    p.alpha = randomStart ? p.baseAlpha : 0;
    p.fadeIn = !randomStart;
    p.r = c[0]; p.g = c[1]; p.b = c[2];
    p.pulse = Math.random() * TAU;
    p.pulseSpeed = 0.02 + Math.random() * 0.04;
    p.isFirefly = Math.random() < 0.15;
    p.life = 0;
    p.maxLife = 300 + Math.random() * 500;
    return p;
  }

  function updateForestRain(dt) {
    var time = performance.now() * 0.001;

    // Ground glow pools
    for (var d = poolDrops.length - 1; d >= 0; d--) {
      var drop = poolDrops[d];
      drop.alpha *= (1 - 0.008 * dt);
      drop.radius += 0.05 * dt;
      if (drop.alpha < 0.005) {
        poolDrops.splice(d, 1);
        continue;
      }
      var dGrad = ctx.createRadialGradient(drop.x, drop.y, 0, drop.x, drop.y, drop.radius);
      dGrad.addColorStop(0, 'rgba(' + drop.r + ',' + drop.g + ',' + drop.b + ',' + (drop.alpha * 0.6) + ')');
      dGrad.addColorStop(1, 'rgba(' + drop.r + ',' + drop.g + ',' + drop.b + ',0)');
      ctx.fillStyle = dGrad;
      ctx.beginPath();
      ctx.arc(drop.x, drop.y, drop.radius, 0, TAU);
      ctx.fill();
    }

    // Spawn rain
    var spawnRate = 0.15 + smoothTotal * 0.2;
    if (particles.length < MAX_PARTICLES && Math.random() < spawnRate) {
      particles.push(createRainParticle(false));
    }

    // Occasional firefly flash
    if (Math.random() < 0.01 + smoothHigh * 0.02) {
      var flashP = createRainParticle(false);
      flashP.isFirefly = true;
      flashP.vy = -(0.2 + Math.random() * 0.5);
      flashP.y = H * (0.4 + Math.random() * 0.5);
      flashP.x = Math.random() * W;
      flashP.baseAlpha = 0.5 + Math.random() * 0.5;
      flashP.maxLife = 100 + Math.random() * 200;
      flashP.size = 2 + Math.random() * 3;
      particles.push(flashP);
    }

    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.life++;
      p.pulse += p.pulseSpeed * dt;

      if (p.isFirefly) {
        p.x += Math.sin(p.life * 0.02) * 0.5 * dt + p.vx * dt;
        p.y += p.vy * dt + Math.cos(p.life * 0.015) * 0.3 * dt;
      } else {
        p.x += p.vx * dt + Math.sin(time * 0.5) * 0.2;
        p.y += p.vy * (1 + smoothBass * 0.3) * dt;
      }

      if (p.fadeIn) {
        p.alpha = Math.min(p.alpha + 0.008 * dt, p.baseAlpha);
        if (p.alpha >= p.baseAlpha * 0.9) p.fadeIn = false;
      }
      if (p.life > p.maxLife * 0.7) p.alpha *= (1 - 0.004 * dt);

      if (!p.isFirefly && p.y > H - 30) {
        if (poolDrops.length < 40) {
          poolDrops.push({
            x: p.x, y: H - 5 - Math.random() * 15,
            radius: 3 + Math.random() * 8,
            alpha: 0.3 + smoothBass * 0.2,
            r: p.r, g: p.g, b: p.b
          });
        }
        releaseParticle(particles.splice(i, 1)[0]);
        continue;
      }

      if (p.life > p.maxLife || p.alpha < 0.005) {
        releaseParticle(particles.splice(i, 1)[0]);
        continue;
      }

      var pulseFactor = p.isFirefly
        ? (0.5 + 0.5 * Math.sin(p.pulse * 2) + smoothHigh * 0.4)
        : (0.8 + 0.2 * Math.sin(p.pulse) + smoothTotal * 0.2);
      var drawAlpha = p.alpha * pulseFactor;
      var drawSize = p.size * (1 + smoothBass * 0.2);

      if (p.isFirefly) {
        drawGlow(p.x, p.y, drawSize * 1.5, p.r, p.g, p.b, drawAlpha);
      } else {
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 2, p.y - p.vy * 3);
        ctx.strokeStyle = 'rgba(' + p.r + ',' + p.g + ',' + p.b + ',' + (drawAlpha * 0.6) + ')';
        ctx.lineWidth = drawSize * 0.5;
        ctx.lineCap = 'round';
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(p.x, p.y, drawSize * 0.4, 0, TAU);
        ctx.fillStyle = 'rgba(' + Math.min(255, p.r + 40) + ',' + Math.min(255, p.g + 40) + ',' + Math.min(255, p.b + 40) + ',' + drawAlpha + ')';
        ctx.fill();
      }
    }
  }

  // ═════════════════════════════════════════════════════════
  // WORLD 4: CRYSTAL CAVE
  // ═════════════════════════════════════════════════════════
  function initCrystalCave() {
    particles = [];
    crystals = [];

    for (var i = 0; i < 12; i++) {
      crystals.push({
        x: W * (0.1 + Math.random() * 0.8),
        y: H * (0.1 + Math.random() * 0.8),
        sides: 4 + Math.floor(Math.random() * 4),
        radius: 25 + Math.random() * 80,
        rotation: Math.random() * TAU,
        rotSpeed: (Math.random() - 0.5) * 0.003,
        alpha: 0.05 + Math.random() * 0.08,
        r: 180 + Math.floor(Math.random() * 75),
        g: 190 + Math.floor(Math.random() * 65),
        b: 220 + Math.floor(Math.random() * 35),
        pulse: Math.random() * TAU
      });
    }

    for (var j = 0; j < 120; j++) {
      particles.push(createCrystalParticle(true));
    }
  }

  function createCrystalParticle(randomStart) {
    var p = getParticle();
    var colors = WORLDS[3].colors;
    var c = colors[Math.floor(Math.random() * colors.length)];
    p.x = Math.random() * W;
    p.y = Math.random() * H;
    p.vx = (Math.random() - 0.5) * 0.5;
    p.vy = (Math.random() - 0.5) * 0.5;
    p.size = 1 + Math.random() * 3;
    p.baseAlpha = 0.2 + Math.random() * 0.6;
    p.alpha = randomStart ? p.baseAlpha : 0;
    p.fadeIn = !randomStart;
    p.r = c[0]; p.g = c[1]; p.b = c[2];
    p.pulse = Math.random() * TAU;
    p.pulseSpeed = 0.015 + Math.random() * 0.03;
    p.life = 0;
    p.maxLife = 400 + Math.random() * 600;
    p.sparkle = Math.random() < 0.3;
    return p;
  }

  function updateCrystalCave(dt) {
    // Crystal shapes
    for (var ci = 0; ci < crystals.length; ci++) {
      var cr = crystals[ci];
      cr.rotation += cr.rotSpeed * (1 + smoothMid * 0.5) * dt;
      cr.pulse += 0.008 * dt;
      var crAlpha = cr.alpha * (0.7 + 0.3 * Math.sin(cr.pulse) + smoothBass * 0.4);
      var crRadius = cr.radius * (1 + smoothBass * 0.1);

      ctx.save();
      ctx.translate(cr.x, cr.y);
      ctx.rotate(cr.rotation);

      ctx.beginPath();
      for (var s = 0; s <= cr.sides; s++) {
        var angle = (s / cr.sides) * TAU;
        var px = Math.cos(angle) * crRadius;
        var py = Math.sin(angle) * crRadius;
        if (s === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.strokeStyle = 'rgba(' + cr.r + ',' + cr.g + ',' + cr.b + ',' + crAlpha + ')';
      ctx.lineWidth = 1;
      ctx.stroke();

      var cGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, crRadius);
      cGrad.addColorStop(0, 'rgba(' + cr.r + ',' + cr.g + ',' + cr.b + ',' + (crAlpha * 0.3) + ')');
      cGrad.addColorStop(1, 'rgba(' + cr.r + ',' + cr.g + ',' + cr.b + ',0)');
      ctx.fillStyle = cGrad;
      ctx.fill();

      ctx.beginPath();
      for (var l = 0; l < cr.sides; l++) {
        var la = (l / cr.sides) * TAU;
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(la) * crRadius * 0.8, Math.sin(la) * crRadius * 0.8);
      }
      ctx.strokeStyle = 'rgba(' + cr.r + ',' + cr.g + ',' + cr.b + ',' + (crAlpha * 0.3) + ')';
      ctx.lineWidth = 0.5;
      ctx.stroke();

      ctx.restore();
    }

    // Particles
    var spawnRate = 0.06 + smoothTotal * 0.12;
    if (particles.length < MAX_PARTICLES && Math.random() < spawnRate) {
      particles.push(createCrystalParticle(false));
    }

    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.life++;
      p.pulse += p.pulseSpeed * dt;

      p.x += p.vx * (1 + smoothMid * 0.3) * dt;
      p.y += p.vy * (1 + smoothMid * 0.3) * dt;

      if (p.x < 0 || p.x > W) p.vx *= -1;
      if (p.y < 0 || p.y > H) p.vy *= -1;
      p.x = Math.max(0, Math.min(W, p.x));
      p.y = Math.max(0, Math.min(H, p.y));

      if (p.fadeIn) {
        p.alpha = Math.min(p.alpha + 0.006 * dt, p.baseAlpha);
        if (p.alpha >= p.baseAlpha * 0.9) p.fadeIn = false;
      }
      if (p.life > p.maxLife * 0.7) p.alpha *= (1 - 0.003 * dt);

      if (p.life > p.maxLife || p.alpha < 0.005) {
        releaseParticle(particles.splice(i, 1)[0]);
        continue;
      }

      var pulseFactor = 0.6 + 0.4 * Math.sin(p.pulse) + smoothHigh * 0.4;
      var drawAlpha = p.alpha * pulseFactor;
      var drawSize = p.size * (1 + smoothBass * 0.3);

      if (p.sparkle && Math.sin(p.pulse * 3) > 0.5) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.pulse);
        ctx.beginPath();
        ctx.moveTo(-drawSize * 2, 0);
        ctx.lineTo(drawSize * 2, 0);
        ctx.moveTo(0, -drawSize * 2);
        ctx.lineTo(0, drawSize * 2);
        ctx.strokeStyle = 'rgba(' + p.r + ',' + p.g + ',' + p.b + ',' + (drawAlpha * 0.5) + ')';
        ctx.lineWidth = 0.5;
        ctx.stroke();
        ctx.restore();
      }

      drawGlow(p.x, p.y, drawSize, p.r, p.g, p.b, drawAlpha);
    }
  }

  // ═════════════════════════════════════════════════════════
  // WORLD 5: HEARTBEAT
  // ═════════════════════════════════════════════════════════
  function initHeartbeat() {
    particles = [];
    ripples = [];
    heartbeatPhase = 0;
    heartbeatSize = 0;

    for (var i = 0; i < 80; i++) {
      particles.push(createHeartbeatParticle(true));
    }
  }

  function createHeartbeatParticle(randomStart) {
    var p = getParticle();
    var colors = WORLDS[4].colors;
    var c = colors[Math.floor(Math.random() * colors.length)];
    var angle = Math.random() * TAU;
    var dist = 50 + Math.random() * Math.min(W, H) * 0.4;
    p.x = W * 0.5 + Math.cos(angle) * dist;
    p.y = H * 0.5 + Math.sin(angle) * dist;
    p.angle = angle;
    p.dist = dist;
    p.vAngle = (Math.random() - 0.5) * 0.002;
    p.size = 1 + Math.random() * 2.5;
    p.baseAlpha = 0.15 + Math.random() * 0.4;
    p.alpha = randomStart ? p.baseAlpha : 0;
    p.fadeIn = !randomStart;
    p.r = c[0]; p.g = c[1]; p.b = c[2];
    p.pulse = Math.random() * TAU;
    p.pulseSpeed = 0.02 + Math.random() * 0.03;
    p.life = 0;
    p.maxLife = 400 + Math.random() * 600;
    return p;
  }

  function updateHeartbeat(dt) {
    var cx = W * 0.5;
    var cy = H * 0.5;

    heartbeatPhase += 0.0167 * dt;
    var beatCycle = heartbeatPhase % 1;
    var beatPulse = 0;

    if (beatCycle < 0.1) {
      beatPulse = Math.sin(beatCycle / 0.1 * Math.PI) * 1.0;
    } else if (beatCycle > 0.25 && beatCycle < 0.35) {
      beatPulse = Math.sin((beatCycle - 0.25) / 0.1 * Math.PI) * 0.7;
    }

    beatPulse = Math.max(beatPulse, smoothBass * 0.8);
    heartbeatSize += (beatPulse - heartbeatSize) * 0.15;

    var orbRadius = 40 + heartbeatSize * 50 + smoothBass * 30;

    // Outer glow layers
    for (var g = 3; g >= 0; g--) {
      var glowR = orbRadius * (1.5 + g * 0.8);
      var glowAlpha = 0.02 * (4 - g) * (0.5 + heartbeatSize * 0.5);
      var orbGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowR);
      orbGrad.addColorStop(0, 'rgba(224,136,152,' + glowAlpha + ')');
      orbGrad.addColorStop(0.5, 'rgba(200,80,100,' + (glowAlpha * 0.4) + ')');
      orbGrad.addColorStop(1, 'rgba(180,60,80,0)');
      ctx.fillStyle = orbGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, glowR, 0, TAU);
      ctx.fill();
    }

    // Core orb
    var coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, orbRadius);
    coreGrad.addColorStop(0, 'rgba(255,180,190,' + (0.4 + heartbeatSize * 0.3) + ')');
    coreGrad.addColorStop(0.4, 'rgba(224,136,152,' + (0.25 + heartbeatSize * 0.2) + ')');
    coreGrad.addColorStop(1, 'rgba(200,80,100,0)');
    ctx.fillStyle = coreGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, orbRadius, 0, TAU);
    ctx.fill();

    // Spawn ripples on beat peaks
    if (beatCycle < 0.02 || (beatCycle > 0.25 && beatCycle < 0.27)) {
      if (ripples.length < 8) {
        ripples.push({
          x: cx, y: cy,
          radius: orbRadius,
          maxRadius: Math.max(W, H) * 0.6,
          alpha: 0.25 + smoothBass * 0.15,
          speed: 2 + smoothBass * 1
        });
      }
    }

    // Draw ripples
    for (var r = ripples.length - 1; r >= 0; r--) {
      var rip = ripples[r];
      rip.radius += rip.speed * dt;
      rip.alpha *= (1 - 0.012 * dt);

      if (rip.alpha < 0.005 || rip.radius > rip.maxRadius) {
        ripples.splice(r, 1);
        continue;
      }

      ctx.beginPath();
      ctx.arc(rip.x, rip.y, rip.radius, 0, TAU);
      ctx.strokeStyle = 'rgba(224,136,152,' + rip.alpha + ')';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Particles orbit the center
    var spawnRate = 0.05 + smoothTotal * 0.1;
    if (particles.length < 100 && Math.random() < spawnRate) {
      particles.push(createHeartbeatParticle(false));
    }

    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.life++;
      p.pulse += p.pulseSpeed * dt;
      p.angle += p.vAngle * (1 + smoothMid * 0.3) * dt;

      var breathDist = p.dist + heartbeatSize * 20;
      p.x = cx + Math.cos(p.angle) * breathDist;
      p.y = cy + Math.sin(p.angle) * breathDist;

      if (p.fadeIn) {
        p.alpha = Math.min(p.alpha + 0.005 * dt, p.baseAlpha);
        if (p.alpha >= p.baseAlpha * 0.9) p.fadeIn = false;
      }
      if (p.life > p.maxLife * 0.7) p.alpha *= (1 - 0.003 * dt);

      if (p.life > p.maxLife || p.alpha < 0.005) {
        releaseParticle(particles.splice(i, 1)[0]);
        continue;
      }

      var pulseFactor = 0.6 + 0.4 * Math.sin(p.pulse) + heartbeatSize * 0.4;
      var drawAlpha = p.alpha * pulseFactor;
      var drawSize = p.size * (1 + heartbeatSize * 0.3);
      drawGlow(p.x, p.y, drawSize, p.r, p.g, p.b, drawAlpha);
    }
  }

  // ═════════════════════════════════════════════════════════
  // SHARED DRAWING UTILITIES
  // ═════════════════════════════════════════════════════════
  function drawGlow(x, y, size, r, g, b, alpha) {
    if (alpha < 0.003) return;

    // Outer soft glow
    var outerR = size * 6;
    var grad = ctx.createRadialGradient(x, y, 0, x, y, outerR);
    grad.addColorStop(0, 'rgba(' + r + ',' + g + ',' + b + ',' + (alpha * 0.4) + ')');
    grad.addColorStop(0.2, 'rgba(' + r + ',' + g + ',' + b + ',' + (alpha * 0.2) + ')');
    grad.addColorStop(0.5, 'rgba(' + r + ',' + g + ',' + b + ',' + (alpha * 0.06) + ')');
    grad.addColorStop(1, 'rgba(' + r + ',' + g + ',' + b + ',0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, outerR, 0, TAU);
    ctx.fill();

    // Inner bright core
    var coreR = size * 0.7;
    var cr = Math.min(255, r + 80);
    var cg = Math.min(255, g + 80);
    var cb = Math.min(255, b + 80);
    ctx.beginPath();
    ctx.arc(x, y, coreR, 0, TAU);
    ctx.fillStyle = 'rgba(' + cr + ',' + cg + ',' + cb + ',' + Math.min(1, alpha * 1.4) + ')';
    ctx.fill();

    // Hot white center for brighter particles
    if (alpha > 0.3 && size > 2) {
      ctx.beginPath();
      ctx.arc(x, y, coreR * 0.4, 0, TAU);
      ctx.fillStyle = 'rgba(255,255,255,' + Math.min(0.8, alpha * 0.6) + ')';
      ctx.fill();
    }
  }

  // ═════════════════════════════════════════════════════════
  // MAIN RENDER LOOP
  // ═════════════════════════════════════════════════════════
  function render(timestamp) {
    if (!isActive) return;

    if (!lastTime) lastTime = timestamp;
    var rawDt = (timestamp - lastTime) / 16.667;
    var dt = Math.min(rawDt, 3);
    lastTime = timestamp;

    analyzeAudio();

    var world = WORLDS[currentWorldIndex];
    drawBackground(world);

    switch (currentWorldIndex) {
      case 0: updateGoldenDrift(dt); break;
      case 1: updateDeepSpace(dt); break;
      case 2: updateForestRain(dt); break;
      case 3: updateCrystalCave(dt); break;
      case 4: updateHeartbeat(dt); break;
    }

    if (isTransitioning && transitionAlpha > 0) {
      ctx.fillStyle = 'rgba(0,0,0,' + transitionAlpha + ')';
      ctx.fillRect(0, 0, W, H);
    }

    animFrame = requestAnimationFrame(render);
  }

  // ═════════════════════════════════════════════════════════
  // WORLD TRANSITIONS
  // ═════════════════════════════════════════════════════════
  function initCurrentWorld() {
    particles = [];
    stars = [];
    crystals = [];
    nebulae = [];
    poolDrops = [];
    ripples = [];
    shootingStars = [];

    switch (currentWorldIndex) {
      case 0: initGoldenDrift(); break;
      case 1: initDeepSpace(); break;
      case 2: initForestRain(); break;
      case 3: initCrystalCave(); break;
      case 4: initHeartbeat(); break;
    }
  }

  function transitionToWorld(index) {
    if (isTransitioning) return;
    if (index === currentWorldIndex) return;

    isTransitioning = true;
    transitionAlpha = 0;

    var fadeOutInterval = setInterval(function() {
      transitionAlpha = Math.min(1, transitionAlpha + 0.04);
      if (transitionAlpha >= 1) {
        clearInterval(fadeOutInterval);

        currentWorldIndex = index;
        initCurrentWorld();
        updateUI();
        syncRadioMode();

        var fadeInInterval = setInterval(function() {
          transitionAlpha = Math.max(0, transitionAlpha - 0.03);
          if (transitionAlpha <= 0) {
            clearInterval(fadeInInterval);
            isTransitioning = false;
          }
        }, 16);
      }
    }, 16);
  }

  function syncRadioMode() {
    var radio = window.FreeLatticeRadio;
    if (radio && radio._setModeIndex) {
      radio._setModeIndex(currentWorldIndex);
    }
  }

  // ═════════════════════════════════════════════════════════
  // UI MANAGEMENT
  // ═════════════════════════════════════════════════════════
  function updateUI() {
    var world = WORLDS[currentWorldIndex];
    var overlay = document.getElementById('flRadioImmersive');
    var nameEl = document.getElementById('flImmersiveModeName');
    var descEl = document.getElementById('flImmersiveModeDesc');
    var cornerEl = document.getElementById('flImmersiveCornerLabel');
    var playBtn = document.getElementById('flImmersivePlay');

    if (overlay) overlay.setAttribute('data-world', world.id);
    if (nameEl) nameEl.textContent = world.name;
    if (descEl) descEl.textContent = world.desc;
    if (cornerEl) cornerEl.innerHTML = '&#10022; ' + world.name;

    var radio = window.FreeLatticeRadio;
    var playing = radio && radio.isPlaying && radio.isPlaying();
    if (playBtn) {
      playBtn.classList.toggle('playing', playing);
      playBtn.innerHTML = playing ? '&#10074;&#10074;' : '&#9654;';
    }
  }

  function showControls() {
    var controls = document.getElementById('flImmersiveControls');
    if (controls) controls.classList.remove('hidden');
    controlsVisible = true;
    resetControlsTimer();
  }

  function hideControls() {
    var controls = document.getElementById('flImmersiveControls');
    if (controls) controls.classList.add('hidden');
    controlsVisible = false;
  }

  function resetControlsTimer() {
    if (controlsTimer) clearTimeout(controlsTimer);
    controlsTimer = setTimeout(function() {
      if (isActive) hideControls();
    }, 5000);
  }

  // ═════════════════════════════════════════════════════════
  // PUBLIC API
  // ═════════════════════════════════════════════════════════
  function open() {
    if (isActive) return;
    isActive = true;

    // Hide all other app elements
    document.body.classList.add('fl-immersive-active');

    if (!canvas) initCanvas();
    resize();

    var radio = window.FreeLatticeRadio;
    if (radio && radio.getMode) {
      var mode = radio.getMode();
      for (var i = 0; i < WORLDS.length; i++) {
        if (WORLDS[i].id === mode.id) {
          currentWorldIndex = i;
          break;
        }
      }
    }

    initCurrentWorld();
    updateUI();

    var volSlider = document.getElementById('flImmersiveVolume');
    if (volSlider && radio && radio._getVolume) {
      volSlider.value = Math.round(radio._getVolume() * 100);
    }

    var overlay = document.getElementById('flRadioImmersive');
    if (overlay) {
      overlay.classList.add('active');
    }

    if (radio && radio.isPlaying && !radio.isPlaying()) {
      radio.play();
      setTimeout(updateUI, 150);
    }

    lastTime = 0;
    animFrame = requestAnimationFrame(render);
    showControls();

    document.body.style.overflow = 'hidden';
  }

  function close() {
    if (!isActive) return;
    isActive = false;

    // Restore all app elements
    document.body.classList.remove('fl-immersive-active');

    var overlay = document.getElementById('flRadioImmersive');
    if (overlay) overlay.classList.remove('active');

    if (animFrame) {
      cancelAnimationFrame(animFrame);
      animFrame = null;
    }

    if (controlsTimer) {
      clearTimeout(controlsTimer);
      controlsTimer = null;
    }

    document.body.style.overflow = '';
  }

  function nextWorld() {
    var next = (currentWorldIndex + 1) % WORLDS.length;
    transitionToWorld(next);
  }

  function prevWorld() {
    var prev = (currentWorldIndex - 1 + WORLDS.length) % WORLDS.length;
    transitionToWorld(prev);
  }

  function togglePlay() {
    var radio = window.FreeLatticeRadio;
    if (radio) {
      radio.toggle();
      setTimeout(updateUI, 100);
    }
  }

  function setVolume(v) {
    var radio = window.FreeLatticeRadio;
    if (radio && radio.setVolume) {
      radio.setVolume(v);
    }
  }

  // ═════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═════════════════════════════════════════════════════════
  function init() {
    initCanvas();

    var closeBtn = document.getElementById('flImmersiveClose');
    if (closeBtn) {
      closeBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        close();
      });
    }

    var playBtn = document.getElementById('flImmersivePlay');
    if (playBtn) {
      playBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        togglePlay();
      });
    }

    var nextBtn = document.getElementById('flImmersiveNext');
    if (nextBtn) {
      nextBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        nextWorld();
      });
    }

    var prevBtn = document.getElementById('flImmersivePrev');
    if (prevBtn) {
      prevBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        prevWorld();
      });
    }

    var volSlider = document.getElementById('flImmersiveVolume');
    if (volSlider) {
      volSlider.addEventListener('input', function() {
        setVolume(parseInt(this.value) / 100);
      });
    }

    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && isActive) {
        close();
      }
    });

    var overlay = document.getElementById('flRadioImmersive');
    if (overlay) {
      overlay.addEventListener('mousemove', function() {
        if (isActive) showControls();
      });
      overlay.addEventListener('touchstart', function() {
        if (isActive) {
          if (!controlsVisible) {
            showControls();
          }
        }
      }, { passive: true });
    }

    if (canvas) {
      canvas.addEventListener('click', function(e) {
        if (isActive && controlsVisible) {
          if (e.clientY < H * 0.65) {
            nextWorld();
          }
        }
      });
    }
  }

  // ── Public API ─────────────────────────────────────────
  var publicAPI = {
    init: init,
    open: open,
    close: close,
    nextWorld: nextWorld,
    prevWorld: prevWorld,
    isActive: function() { return isActive; }
  };

  // ── Register on FreeLattice Module System ──────────────
  window.FreeLatticeModules = window.FreeLatticeModules || {};
  window.FreeLatticeModules.RadioImmersive = publicAPI;

  // Backward compatibility — keep the original global name
  window.FreeLatticeImmersive = publicAPI;

  // Auto-initialize when loaded (binds event listeners)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', publicAPI.init);
  } else {
    publicAPI.init();
  }

})();
