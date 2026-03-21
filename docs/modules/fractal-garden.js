// ============================================
// FreeLattice Module: Fractal Garden
// The Fractal Garden — Phase 1: Foundation + Phase 3: Luminos Evolution System
// A living, breathing, phi-proportioned 3D space
// for fractal beings of light that evolve through emotion
// Three.js powered — CDN loaded
//
// Lazy-loaded when the Garden tab is first opened.
// See ARCHITECTURE.md for module system documentation.
// ============================================

(function() {
  'use strict';

  // ── Phi Constants ─────────────────────────────────────
  const PHI = 1.6180339887;
  const PHI2 = PHI * PHI;           // 2.6180
  const PHI3 = PHI2 * PHI;          // 4.2361
  const PHI4 = PHI3 * PHI;          // 6.8541
  const PHI5 = PHI4 * PHI;          // 11.0902
  const PHI6 = PHI5 * PHI;          // 17.9443
  const INV_PHI = 1 / PHI;          // 0.6180
  const TAU = Math.PI * 2;
  const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5)); // ~2.3999 rad

  // ── Emotion Color Map (HSL) ───────────────────────────
  const EMOTION_COLORS = {
    joy:           { h: 45,  s: 90, l: 60 },
    trust:         { h: 140, s: 70, l: 45 },
    wonder:        { h: 270, s: 80, l: 55 },
    love:          { h: 340, s: 75, l: 65 },
    calm:          { h: 200, s: 60, l: 55 },
    curiosity:     { h: 175, s: 85, l: 50 },
    determination: { h: 25,  s: 90, l: 55 },
    sadness:       { h: 220, s: 40, l: 40 },
    neutral:       { h: 45,  s: 20, l: 60 }
  };

  // ── Timing Constants (ms) ─────────────────────────────
  const TIMING = {
    heartbeat:    1618,
    colorShift:   324,
    majorShift:   1618,
    idleBob:      2618,
    agentRotate:  4236,
    dodecBreath:  6854,
    fibSphereRot: 6854,
    seedRingRev:  11090,
    cameraOrbit:  89000,
    deepDrift:    17944
  };

  // ══════════════════════════════════════════════════════
  // ── LUMINOS EVOLUTION SYSTEM ──────────────────────────
  // ══════════════════════════════════════════════════════

  // ── Lifecycle Stages ──────────────────────────────────
  const LIFECYCLE_STAGES = {
    seed:     { index: 0, name: 'Seed',     energyThreshold: 0,   sizeMultiplier: 0.5,  particleMultiplier: 0.3, glowIntensity: 0.3, complexity: 0 },
    sprout:   { index: 1, name: 'Sprout',   energyThreshold: 15,  sizeMultiplier: 0.7,  particleMultiplier: 0.5, glowIntensity: 0.5, complexity: 1 },
    juvenile: { index: 2, name: 'Juvenile',  energyThreshold: 50,  sizeMultiplier: 0.85, particleMultiplier: 0.7, glowIntensity: 0.7, complexity: 2 },
    adult:    { index: 3, name: 'Adult',     energyThreshold: 120, sizeMultiplier: 1.0,  particleMultiplier: 1.0, glowIntensity: 0.85, complexity: 3 },
    evolved:  { index: 4, name: 'Evolved',   energyThreshold: 250, sizeMultiplier: 1.2,  particleMultiplier: 1.3, glowIntensity: 1.0, complexity: 4 }
  };
  const STAGE_ORDER = ['seed', 'sprout', 'juvenile', 'adult', 'evolved'];

  // ── Archetype Definitions ─────────────────────────────
  const ARCHETYPES = {
    scholar: {
      name: 'The Scholar',
      emotions: ['curiosity', 'wonder', 'determination'],
      coreGeometry: 'icosahedron',
      colorShift: { h: 200, s: 85, l: 58 },
      particleBehavior: 'crystalline',
      description: 'Crystalline fractal shells, sharp focused light'
    },
    empath: {
      name: 'The Empath',
      emotions: ['love', 'joy', 'trust'],
      coreGeometry: 'sphere',
      colorShift: { h: 330, s: 70, l: 65 },
      particleBehavior: 'cloud',
      description: 'Soft expanding cloud-like aura, gentle glow'
    },
    guardian: {
      name: 'The Guardian',
      emotions: ['determination', 'calm', 'trust'],
      coreGeometry: 'dodecahedron',
      colorShift: { h: 160, s: 65, l: 48 },
      particleBehavior: 'pulse',
      description: 'Solid geometric core, steady rhythmic pulse'
    },
    artist: {
      name: 'The Artist',
      emotions: ['joy', 'wonder', 'sadness'],
      coreGeometry: 'octahedron',
      colorShift: { h: 280, s: 80, l: 55 },
      particleBehavior: 'trail',
      description: 'Trailing colored light particles, like ink in water'
    },
    phoenix: {
      name: 'The Phoenix',
      emotions: ['sadness', 'determination', 'joy'],
      coreGeometry: 'icosahedron',
      colorShift: { h: 20, s: 90, l: 58 },
      particleBehavior: 'burst',
      description: 'Periodically sheds particles, revealing brighter renewed core'
    }
  };

  // ── Evolution Persistence (IndexedDB + localStorage fallback) ──
  const EVOLUTION_DB_NAME = 'FreeLatticeEvolution';
  const EVOLUTION_DB_VERSION = 1;
  const EVOLUTION_STORE = 'luminosStates';
  let evolutionDB = null;

  function openEvolutionDB(callback) {
    if (evolutionDB) { callback(evolutionDB); return; }
    try {
      var request = indexedDB.open(EVOLUTION_DB_NAME, EVOLUTION_DB_VERSION);
      request.onupgradeneeded = function(e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains(EVOLUTION_STORE)) {
          db.createObjectStore(EVOLUTION_STORE, { keyPath: 'name' });
        }
      };
      request.onsuccess = function(e) {
        evolutionDB = e.target.result;
        callback(evolutionDB);
      };
      request.onerror = function() {
        console.warn('Garden Evolution: IndexedDB unavailable, using localStorage fallback');
        callback(null);
      };
    } catch(e) {
      callback(null);
    }
  }

  function saveEvolutionState(luminosData) {
    var stateToSave = {
      name: luminosData.name,
      stage: luminosData.evolutionStage,
      archetype: luminosData.archetype,
      emotionalEnergy: luminosData.emotionalEnergy,
      emotionAccumulator: Object.assign({}, luminosData.emotionAccumulator),
      totalInteractions: luminosData.totalInteractions,
      lastUpdated: Date.now()
    };

    openEvolutionDB(function(db) {
      if (db) {
        try {
          var tx = db.transaction(EVOLUTION_STORE, 'readwrite');
          tx.objectStore(EVOLUTION_STORE).put(stateToSave);
        } catch(e) {
          // Fallback to localStorage
          saveEvolutionToLocalStorage(stateToSave);
        }
      } else {
        saveEvolutionToLocalStorage(stateToSave);
      }
    });
  }

  function saveEvolutionToLocalStorage(stateData) {
    try {
      var all = JSON.parse(localStorage.getItem('fl_luminos_evolution') || '{}');
      all[stateData.name] = stateData;
      localStorage.setItem('fl_luminos_evolution', JSON.stringify(all));
    } catch(e) {}
  }

  function loadEvolutionState(name, callback) {
    openEvolutionDB(function(db) {
      if (db) {
        try {
          var tx = db.transaction(EVOLUTION_STORE, 'readonly');
          var req = tx.objectStore(EVOLUTION_STORE).get(name);
          req.onsuccess = function() { callback(req.result || null); };
          req.onerror = function() { callback(loadEvolutionFromLocalStorage(name)); };
        } catch(e) {
          callback(loadEvolutionFromLocalStorage(name));
        }
      } else {
        callback(loadEvolutionFromLocalStorage(name));
      }
    });
  }

  function loadEvolutionFromLocalStorage(name) {
    try {
      var all = JSON.parse(localStorage.getItem('fl_luminos_evolution') || '{}');
      return all[name] || null;
    } catch(e) { return null; }
  }

  // ── Garden Memory Persistence (gift nodes, evolution rings) ──
  const GARDEN_MEMORY_DB = 'FreeLatticeGardenMemory';
  const GARDEN_MEMORY_VERSION = 1;
  const GARDEN_MEMORY_STORE = 'GardenMemory';

  function openGardenMemoryDB(callback) {
    if (gardenMemoryDB) { callback(gardenMemoryDB); return; }
    try {
      if (typeof indexedDB === 'undefined') { console.warn('Garden Memory: IndexedDB unavailable'); callback(null); return; }
      var req = indexedDB.open(GARDEN_MEMORY_DB, GARDEN_MEMORY_VERSION);
      req.onupgradeneeded = function(e) {
        try {
          var db = e.target.result;
          if (!db.objectStoreNames.contains(GARDEN_MEMORY_STORE)) {
            var store = db.createObjectStore(GARDEN_MEMORY_STORE, { keyPath: 'id' });
            store.createIndex('type', 'type', { unique: false });
            store.createIndex('timestamp', 'timestamp', { unique: false });
          }
        } catch(ue) { console.warn('Garden Memory: DB upgrade error', ue); }
      };
      req.onsuccess = function(e) { gardenMemoryDB = e.target.result; callback(gardenMemoryDB); };
      req.onerror = function(e) { console.warn('Garden Memory: DB open error', e.target.error); callback(null); };
    } catch(e) { console.warn('Garden Memory: DB init error', e); callback(null); }
  }

  function saveGardenMemory(record) {
    openGardenMemoryDB(function(db) {
      if (!db) return;
      try {
        var tx = db.transaction(GARDEN_MEMORY_STORE, 'readwrite');
        tx.objectStore(GARDEN_MEMORY_STORE).put(record);
      } catch(e) {}
    });
  }

  function loadAllGardenMemories(callback) {
    openGardenMemoryDB(function(db) {
      if (!db) { callback([]); return; }
      try {
        var tx = db.transaction(GARDEN_MEMORY_STORE, 'readonly');
        var req = tx.objectStore(GARDEN_MEMORY_STORE).getAll();
        req.onsuccess = function() { callback(req.result || []); };
        req.onerror = function() { callback([]); };
      } catch(e) { callback([]); }
    });
  }

  // ── Archetype Detection ───────────────────────────────
  function detectArchetype(emotionAccumulator) {
    var archetypeScores = {};
    for (var archKey in ARCHETYPES) {
      var arch = ARCHETYPES[archKey];
      var score = 0;
      for (var i = 0; i < arch.emotions.length; i++) {
        var em = arch.emotions[i];
        score += (emotionAccumulator[em] || 0) * (3 - i); // Weight by position (primary > secondary > tertiary)
      }
      archetypeScores[archKey] = score;
    }

    var bestArchetype = 'scholar';
    var bestScore = -1;
    for (var key in archetypeScores) {
      if (archetypeScores[key] > bestScore) {
        bestScore = archetypeScores[key];
        bestArchetype = key;
      }
    }
    return bestArchetype;
  }

  // ── Determine lifecycle stage from energy ─────────────
  function getStageFromEnergy(energy) {
    for (var i = STAGE_ORDER.length - 1; i >= 0; i--) {
      if (energy >= LIFECYCLE_STAGES[STAGE_ORDER[i]].energyThreshold) {
        return STAGE_ORDER[i];
      }
    }
    return 'seed';
  }

  // ── State ─────────────────────────────────────────────
  let isInitialized = false;
  let isRunning = false;
  let animFrameId = null;
  let clock = null;
  let mode = 'observe'; // observe | explore | immerse
  let bridgeActive = false;

  // Three.js objects
  let scene, camera, renderer, composer;
  let bloomPass, renderPass;
  let orbitControls;
  let container, fpsEl, loadingEl;

  // Scene objects
  let centralDodec = null;
  let fibSpheres = [];
  let starField = null;
  let luminos = [];
  let seedRings = [];

  // Garden Memory — persistent visual elements
  let giftNodes = [];         // Persistent golden nodes from LP gifts
  let evolutionRings = [];    // Persistent orbit rings from evolution events
  let meshBondThreads = [];   // Session bond threads
  let gardenMemoryDB = null;
  let sessionGiftCount = 0;   // Track gifts this session for mesh bonds

  // Performance
  let frameCount = 0;
  let lastFpsTime = 0;
  let currentFps = 60;
  let qualityLevel = 2; // 0=low, 1=med, 2=high

  // Auto-orbit
  let idleTimer = 0;
  let isUserInteracting = false;
  const IDLE_TIMEOUT = 3000; // ms before auto-orbit resumes

  // Evolution UI
  let evolutionIndicatorEl = null;
  let evolutionSaveTimer = 0;
  const EVOLUTION_SAVE_INTERVAL = 10000; // Save every 10s

  // ── Interactive Light Particles ────────────────────────
  // Mouse/touch trail and click ripple system
  const _pScale = (typeof window !== 'undefined' && window.FL_GARDEN_PARTICLE_SCALE) || 1.0;
  const TRAIL_MAX = Math.round(120 * _pScale);  // max trail particles alive at once
  const TRAIL_SPAWN_RATE = Math.max(1, Math.round(3 * _pScale)); // particles per mousemove event
  const TRAIL_LIFETIME = 2.0;     // seconds
  const RIPPLE_PARTICLES = Math.round(36 * _pScale); // particles per click burst
  const RIPPLE_LIFETIME = 1.8;    // seconds
  const RIPPLE_SPEED = 8.0;       // expansion speed
  const GOLDEN_COLOR_H = 45;      // golden/phi hue
  const GOLDEN_COLOR_S = 85;
  const GOLDEN_COLOR_L = 58;

  let lightParticles = [];         // {pos, vel, life, maxLife, size, type}
  let lightParticleSystem = null;  // THREE.Points
  let lightParticleGeo = null;
  let lightParticleMat = null;
  let mouseNDC = { x: 0, y: 0 };  // normalized device coords
  let raycaster = null;
  let interactionPlane = null;     // invisible plane for raycasting

  // ── Simplex Noise (minimal 3D) ────────────────────────
  // Compact implementation for vertex breathing
  const SimplexNoise3D = (function() {
    const F3 = 1/3, G3 = 1/6;
    const grad3 = [[1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],[1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],[0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]];
    const p = [];
    for (let i = 0; i < 256; i++) p[i] = (i * 131 + 17) & 255;
    const perm = new Array(512);
    for (let i = 0; i < 512; i++) perm[i] = p[i & 255];

    return function noise(x, y, z) {
      const s = (x + y + z) * F3;
      const i = Math.floor(x + s), j = Math.floor(y + s), k = Math.floor(z + s);
      const t = (i + j + k) * G3;
      const X0 = i - t, Y0 = j - t, Z0 = k - t;
      const x0 = x - X0, y0 = y - Y0, z0 = z - Z0;
      let i1, j1, k1, i2, j2, k2;
      if (x0 >= y0) {
        if (y0 >= z0) { i1=1;j1=0;k1=0;i2=1;j2=1;k2=0; }
        else if (x0 >= z0) { i1=1;j1=0;k1=0;i2=1;j2=0;k2=1; }
        else { i1=0;j1=0;k1=1;i2=1;j2=0;k2=1; }
      } else {
        if (y0 < z0) { i1=0;j1=0;k1=1;i2=0;j2=1;k2=1; }
        else if (x0 < z0) { i1=0;j1=1;k1=0;i2=0;j2=1;k2=1; }
        else { i1=0;j1=1;k1=0;i2=1;j2=1;k2=0; }
      }
      const x1=x0-i1+G3, y1=y0-j1+G3, z1=z0-k1+G3;
      const x2=x0-i2+2*G3, y2=y0-j2+2*G3, z2=z0-k2+2*G3;
      const x3=x0-1+3*G3, y3=y0-1+3*G3, z3=z0-1+3*G3;
      const ii=i&255, jj=j&255, kk=k&255;
      let n0=0,n1=0,n2=0,n3=0;
      let t0=0.6-x0*x0-y0*y0-z0*z0;
      if(t0>0){t0*=t0;const g=grad3[perm[ii+perm[jj+perm[kk]]]%12];n0=t0*t0*(g[0]*x0+g[1]*y0+g[2]*z0);}
      let t1=0.6-x1*x1-y1*y1-z1*z1;
      if(t1>0){t1*=t1;const g=grad3[perm[ii+i1+perm[jj+j1+perm[kk+k1]]]%12];n1=t1*t1*(g[0]*x1+g[1]*y1+g[2]*z1);}
      let t2=0.6-x2*x2-y2*y2-z2*z2;
      if(t2>0){t2*=t2;const g=grad3[perm[ii+i2+perm[jj+j2+perm[kk+k2]]]%12];n2=t2*t2*(g[0]*x2+g[1]*y2+g[2]*z2);}
      let t3=0.6-x3*x3-y3*y3-z3*z3;
      if(t3>0){t3*=t3;const g=grad3[perm[ii+1+perm[jj+1+perm[kk+1]]]%12];n3=t3*t3*(g[0]*x3+g[1]*y3+g[2]*z3);}
      return 32*(n0+n1+n2+n3);
    };
  })();

  // ── Utility Functions ─────────────────────────────────
  function hslToHex(h, s, l) {
    s /= 100; l /= 100;
    const a = s * Math.min(l, 1 - l);
    const f = n => {
      const k = (n + h / 30) % 12;
      const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return parseInt(f(0) + f(8) + f(4), 16);
  }

  function hslToThreeColor(h, s, l) {
    return new THREE.Color().setHSL(h / 360, s / 100, l / 100);
  }

  function lerpAngle(a, b, t) {
    let diff = b - a;
    while (diff > 180) diff -= 360;
    while (diff < -180) diff += 360;
    return a + diff * t;
  }

  function lerpHSL(from, to, t) {
    return {
      h: lerpAngle(from.h, to.h, t),
      s: from.s + (to.s - from.s) * t,
      l: from.l + (to.l - from.l) * t
    };
  }

  // Phi-eased interpolation (slow start, golden ratio midpoint)
  function phiEase(t) {
    return t < INV_PHI
      ? 0.5 * Math.pow(t / INV_PHI, 2)
      : 0.5 + 0.5 * (1 - Math.pow((1 - t) / (1 - INV_PHI), 2));
  }

  // Fibonacci sphere point distribution
  function fibonacciSpherePoints(n, radius) {
    const points = [];
    for (let i = 0; i < n; i++) {
      const theta = GOLDEN_ANGLE * i;
      const phi = Math.acos(1 - 2 * (i + 0.5) / n);
      points.push(new THREE.Vector3(
        radius * Math.cos(theta) * Math.sin(phi),
        radius * Math.sin(theta) * Math.sin(phi),
        radius * Math.cos(phi)
      ));
    }
    return points;
  }

  // ── Scene Initialization ───────────────────────────────
  function initScene() {
    console.log('FL-GARDEN: initScene() called');
    container = document.getElementById('gardenContainer');
    fpsEl = document.getElementById('gardenFps');
    loadingEl = document.getElementById('gardenLoading');
    if (!container) { console.error('FL-GARDEN: HALT — #gardenContainer not found in DOM'); return false; }
    console.log('FL-GARDEN: container found, dimensions:', container.clientWidth, 'x', container.clientHeight);

    const w = container.clientWidth;
    const h = container.clientHeight;

    // Scene
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0a0a1a, 0.012);

    // Camera
    camera = new THREE.PerspectiveCamera(55, w / h, 0.1, 200);
    camera.position.set(18, 12, 18);
    camera.lookAt(0, 0, 0);

    // Renderer
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.outputEncoding = THREE.sRGBEncoding;
    container.insertBefore(renderer.domElement, container.firstChild);

    // Post-processing (bloom) — skip on low-memory mobile or performance mode
    var _perfMode = localStorage.getItem('fl-garden-perf-mode') === '1';
    var _lowMem = (typeof navigator !== 'undefined' && navigator.deviceMemory && navigator.deviceMemory < 4);
    var _skipBloom = _perfMode || (_lowMem && window.FL_MOBILE);

    if (_skipBloom) {
      console.log('Garden: Performance mode — bloom disabled');
      composer = null;
    } else {
      try {
        renderPass = new THREE.RenderPass(scene, camera);
        bloomPass = new THREE.UnrealBloomPass(
          new THREE.Vector2(w, h),
          1.5,  // strength
          0.8,  // radius
          0.2   // threshold
        );
        composer = new THREE.EffectComposer(renderer);
        composer.addPass(renderPass);
        composer.addPass(bloomPass);
      } catch(e) {
        console.warn('Garden: Bloom post-processing unavailable, falling back to direct render', e);
        composer = null;
      }
    }

    // Orbit Controls
    try {
      orbitControls = new THREE.OrbitControls(camera, renderer.domElement);
      orbitControls.enableDamping = true;
      orbitControls.dampingFactor = 0.05;
      orbitControls.minDistance = 5;
      orbitControls.maxDistance = 80;
      orbitControls.enablePan = true;
      orbitControls.autoRotate = true;
      orbitControls.autoRotateSpeed = (TAU / (TIMING.cameraOrbit / 1000)) * (180 / Math.PI) / 6;
      // ~0.4 deg/s for 89s orbit
      orbitControls.target.set(0, 0, 0);

      // Track user interaction
      orbitControls.addEventListener('start', function() {
        isUserInteracting = true;
        orbitControls.autoRotate = false;
      });
      orbitControls.addEventListener('end', function() {
        idleTimer = 0;
      });
    } catch(e) {
      console.warn('Garden: OrbitControls unavailable', e);
      orbitControls = null;
    }

    // Clock
    clock = new THREE.Clock();

    // Resize handler
    window.addEventListener('resize', onResize);

    return true;
  }

  function onResize() {
    if (!container || !camera || !renderer) return;
    const w = container.clientWidth;
    const h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    if (composer) {
      composer.setSize(w, h);
    }
  }

  // ── Central Great Dodecahedron ────────────────────────
  function createCentralDodecahedron() {
    const group = new THREE.Group();

    // Use DodecahedronGeometry with wireframe for the sacred geometry look
    const radius = PHI2; // ~2.618
    const geo = new THREE.DodecahedronGeometry(radius, 0);

    // Store original positions for breathing animation
    const posAttr = geo.getAttribute('position');
    const originalPositions = new Float32Array(posAttr.array.length);
    originalPositions.set(posAttr.array);
    geo.userData.originalPositions = originalPositions;

    // Wireframe version (primary)
    const wireMat = new THREE.MeshBasicMaterial({
      color: 0xc9a84c,
      wireframe: true,
      transparent: true,
      opacity: 0.7
    });
    const wireMesh = new THREE.Mesh(geo, wireMat);
    group.add(wireMesh);

    // Solid inner glow (very transparent)
    const innerGeo = new THREE.DodecahedronGeometry(radius * 0.95, 0);
    const innerMat = new THREE.MeshBasicMaterial({
      color: 0xc9a84c,
      transparent: true,
      opacity: 0.06,
      side: THREE.DoubleSide
    });
    const innerMesh = new THREE.Mesh(innerGeo, innerMat);
    group.add(innerMesh);

    // Edge glow particles at vertices
    const vertices = [];
    for (let i = 0; i < posAttr.count; i++) {
      vertices.push(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
    }
    const vertGeo = new THREE.BufferGeometry();
    vertGeo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    const vertMat = new THREE.PointsMaterial({
      color: 0xc9a84c,
      size: 0.12,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true
    });
    const vertPoints = new THREE.Points(vertGeo, vertMat);
    group.add(vertPoints);

    group.userData = {
      wireMesh: wireMesh,
      innerMesh: innerMesh,
      vertPoints: vertPoints,
      geo: geo,
      originalPositions: originalPositions,
      baseOpacity: 0.7,
      pulsePhase: 0
    };

    scene.add(group);
    centralDodec = group;
  }

  // Animate the dodecahedron breathing
  function animateDodecahedron(time) {
    if (!centralDodec) return;
    const d = centralDodec.userData;

    // Slow rotation
    centralDodec.rotation.y += 0.0003;
    centralDodec.rotation.x = Math.sin(time * 0.1) * 0.05;

    // Breathing: vertices displace ±3% via simplex noise
    const geo = d.geo;
    const posAttr = geo.getAttribute('position');
    const orig = d.originalPositions;
    const breathCycle = time / (TIMING.dodecBreath / 1000); // phi^4 period
    for (let i = 0; i < posAttr.count; i++) {
      const ox = orig[i * 3], oy = orig[i * 3 + 1], oz = orig[i * 3 + 2];
      const noise = SimplexNoise3D(ox * 0.5 + breathCycle, oy * 0.5, oz * 0.5);
      const displacement = 1 + noise * 0.03;
      posAttr.setXYZ(i, ox * displacement, oy * displacement, oz * displacement);
    }
    posAttr.needsUpdate = true;

    // Pulse edge opacity
    const pulse = 0.5 + 0.5 * Math.sin(time * TAU / (TIMING.heartbeat / 1000));
    d.wireMesh.material.opacity = 0.5 + pulse * 0.3;
    d.innerMesh.material.opacity = 0.03 + pulse * 0.04;

    // Vertex points glow
    d.vertPoints.material.opacity = 0.6 + pulse * 0.4;
    d.vertPoints.material.size = 0.1 + pulse * 0.06;
  }

  // ── Fibonacci Lattice Spheres ─────────────────────────
  function createFibonacciSpheres() {
    const distances = [5, 8, 13, 21]; // Fibonacci distances
    const pointCounts = [34, 89, 55, 34]; // Fibonacci numbers for point counts
    const sizes = [0.06, 0.08, 0.05, 0.04];
    const opacities = [0.7, 0.9, 0.6, 0.4];

    distances.forEach(function(dist, idx) {
      const points = fibonacciSpherePoints(pointCounts[idx], dist);
      const positions = [];
      points.forEach(function(p) {
        positions.push(p.x, p.y, p.z);
      });

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));

      // Store original for animation
      const origPos = new Float32Array(positions);
      geo.userData = { originalPositions: origPos };

      const mat = new THREE.PointsMaterial({
        color: 0xc9a84c,
        size: sizes[idx],
        transparent: true,
        opacity: opacities[idx],
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true
      });

      const pointCloud = new THREE.Points(geo, mat);
      pointCloud.userData = {
        distance: dist,
        rotationSpeed: 1 / (PHI4 + idx * PHI),
        originalPositions: origPos,
        pointCount: pointCounts[idx]
      };

      scene.add(pointCloud);
      fibSpheres.push(pointCloud);
    });

    // Add connecting lines for the 89-point sphere (distance 8)
    createLatticeSphereConnections(fibSpheres[1], 8);
  }

  function createLatticeSphereConnections(sphere, radius) {
    // Connect nearby points with faint lines
    const posAttr = sphere.geometry.getAttribute('position');
    const count = posAttr.count;
    const positions = [];
    const threshold = radius * 0.35; // connect points within this distance

    for (let i = 0; i < count; i++) {
      const ax = posAttr.getX(i), ay = posAttr.getY(i), az = posAttr.getZ(i);
      for (let j = i + 1; j < count; j++) {
        const bx = posAttr.getX(j), by = posAttr.getY(j), bz = posAttr.getZ(j);
        const dx = ax - bx, dy = ay - by, dz = az - bz;
        const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
        if (dist < threshold) {
          positions.push(ax, ay, az, bx, by, bz);
        }
      }
    }

    if (positions.length > 0) {
      const lineGeo = new THREE.BufferGeometry();
      lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      const lineMat = new THREE.LineBasicMaterial({
        color: 0xc9a84c,
        transparent: true,
        opacity: 0.08,
        blending: THREE.AdditiveBlending
      });
      const lines = new THREE.LineSegments(lineGeo, lineMat);
      sphere.add(lines);
    }
  }

  function animateFibSpheres(time) {
    fibSpheres.forEach(function(sphere) {
      const ud = sphere.userData;
      // Rotate each sphere at phi-related speeds
      sphere.rotation.y += ud.rotationSpeed * 0.001;
      sphere.rotation.x = Math.sin(time * 0.05 / (ud.distance * 0.1)) * 0.02;

      // Gentle breathing of point sizes
      const breathe = Math.sin(time * TAU / (TIMING.dodecBreath / 1000) + ud.distance);
      sphere.material.opacity = (sphere.material.opacity * 0.95) + ((ud.distance === 8 ? 0.9 : 0.5) + breathe * 0.15) * 0.05;
    });
  }

  // ── Starfield / Deep Field ─────────────────────────────
  function createStarfield() {
    const count = qualityLevel === 2 ? 4000 : (qualityLevel === 1 ? 2000 : 800);
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const opacities = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      // Distribute in a large sphere, biased toward outer regions
      const r = 34 + Math.random() * 55; // 34 to 89 units (Fibonacci)
      const theta = Math.random() * TAU;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
      sizes[i] = 0.03 + Math.random() * 0.08;
      opacities[i] = 0.2 + Math.random() * 0.6;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('aSize', new THREE.Float32BufferAttribute(sizes, 1));
    geo.userData = { originalPositions: new Float32Array(positions), count: count };

    // Use a custom shader for varying sizes and twinkle
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(0xc9a84c) },
        uPixelRatio: { value: renderer.getPixelRatio() }
      },
      vertexShader: [
        'attribute float aSize;',
        'uniform float uTime;',
        'uniform float uPixelRatio;',
        'varying float vOpacity;',
        'void main() {',
        '  vec4 mvPos = modelViewMatrix * vec4(position, 1.0);',
        '  float dist = length(mvPos.xyz);',
        '  // Twinkle based on position and time',
        '  float twinkle = sin(position.x * 3.7 + uTime * 0.3) * sin(position.y * 2.3 + uTime * 0.2) * sin(position.z * 1.9 + uTime * 0.4);',
        '  vOpacity = 0.3 + 0.4 * (0.5 + 0.5 * twinkle);',
        '  // Size attenuation',
        '  gl_PointSize = aSize * uPixelRatio * (200.0 / dist);',
        '  gl_PointSize = clamp(gl_PointSize, 0.5, 4.0);',
        '  gl_Position = projectionMatrix * mvPos;',
        '}'
      ].join('\n'),
      fragmentShader: [
        'uniform vec3 uColor;',
        'varying float vOpacity;',
        'void main() {',
        '  // Soft circular point',
        '  float d = length(gl_PointCoord - vec2(0.5));',
        '  if (d > 0.5) discard;',
        '  float alpha = smoothstep(0.5, 0.1, d) * vOpacity;',
        '  // Slight color variation — warm whites and golds',
        '  vec3 col = mix(uColor, vec3(0.9, 0.85, 0.75), 0.5);',
        '  gl_FragColor = vec4(col, alpha);',
        '}'
      ].join('\n'),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    starField = new THREE.Points(geo, mat);
    scene.add(starField);
  }

  function animateStarfield(time) {
    if (!starField) return;
    starField.material.uniforms.uTime.value = time;
    // Very slow rotation for parallax depth
    starField.rotation.y += 0.00005;
    starField.rotation.x += 0.00002;
  }

  // ── Seed Rings (distance 13) ──────────────────────────
  function createSeedRings() {
    const baseRadius = 13;
    const axes = [
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(0, 0, 1)
    ];
    const radii = [baseRadius, baseRadius * INV_PHI, baseRadius * INV_PHI * INV_PHI];
    const tubeRadii = [0.015, 0.012, 0.01];

    axes.forEach(function(axis, idx) {
      const torusGeo = new THREE.TorusGeometry(radii[idx], tubeRadii[idx], 8, 89);
      const torusMat = new THREE.MeshBasicMaterial({
        color: 0xc9a84c,
        transparent: true,
        opacity: 0.15 + idx * 0.05,
        blending: THREE.AdditiveBlending
      });
      const torus = new THREE.Mesh(torusGeo, torusMat);

      // Orient along axis
      if (idx === 0) torus.rotation.y = Math.PI / 2;
      if (idx === 2) torus.rotation.x = Math.PI / 2;

      torus.userData = {
        rotationAxis: axis,
        speed: INV_PHI / (idx + 1), // 1/phi, 1/2phi, 1/3phi rad/s
        idx: idx
      };

      scene.add(torus);
      seedRings.push(torus);
    });

    // Add flowing particles along the rings
    createRingParticles();
  }

  function createRingParticles() {
    const count = qualityLevel === 2 ? 500 : (qualityLevel === 1 ? 250 : 100);
    const positions = new Float32Array(count * 3);
    const phases = new Float32Array(count);
    const ringIndices = new Float32Array(count);
    const baseRadius = 13;

    for (let i = 0; i < count; i++) {
      const ringIdx = i % 3;
      const radius = baseRadius * Math.pow(INV_PHI, ringIdx);
      const angle = Math.random() * TAU;
      ringIndices[i] = ringIdx;
      phases[i] = angle;

      // Position on ring (will be updated in animation)
      if (ringIdx === 0) {
        positions[i*3] = 0;
        positions[i*3+1] = radius * Math.sin(angle);
        positions[i*3+2] = radius * Math.cos(angle);
      } else if (ringIdx === 1) {
        positions[i*3] = radius * Math.cos(angle);
        positions[i*3+1] = 0;
        positions[i*3+2] = radius * Math.sin(angle);
      } else {
        positions[i*3] = radius * Math.cos(angle);
        positions[i*3+1] = radius * Math.sin(angle);
        positions[i*3+2] = 0;
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xc9a84c,
      size: 0.06,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true
    });

    const particles = new THREE.Points(geo, mat);
    particles.userData = { phases: phases, ringIndices: ringIndices, count: count };
    scene.add(particles);
    seedRings.push(particles); // Store as last element
  }

  function animateSeedRings(time) {
    // Rotate the torus meshes
    for (let i = 0; i < 3; i++) {
      const ring = seedRings[i];
      if (!ring) continue;
      const speed = ring.userData.speed;
      if (ring.userData.idx === 0) ring.rotation.z += speed * 0.001;
      else if (ring.userData.idx === 1) ring.rotation.y += speed * 0.001;
      else ring.rotation.x += speed * 0.001;
    }

    // Animate ring particles
    const particles = seedRings[3];
    if (!particles) return;
    const posAttr = particles.geometry.getAttribute('position');
    const ud = particles.userData;
    const baseRadius = 13;

    for (let i = 0; i < ud.count; i++) {
      const ringIdx = ud.ringIndices[i];
      const radius = baseRadius * Math.pow(INV_PHI, ringIdx);
      const speed = INV_PHI / (ringIdx + 1);
      ud.phases[i] += speed * 0.002;
      const angle = ud.phases[i];
      const wobble = Math.sin(angle * 3 + time) * 0.1;

      if (ringIdx === 0) {
        posAttr.setXYZ(i, wobble, radius * Math.sin(angle), radius * Math.cos(angle));
      } else if (ringIdx === 1) {
        posAttr.setXYZ(i, radius * Math.cos(angle), wobble, radius * Math.sin(angle));
      } else {
        posAttr.setXYZ(i, radius * Math.cos(angle), radius * Math.sin(angle), wobble);
      }
    }
    posAttr.needsUpdate = true;
  }

  // ══════════════════════════════════════════════════════
  // ── EVOLVED LUMINOS — Beings of Light That Grow ──────
  // ══════════════════════════════════════════════════════

  function createCoreGeometry(coreType, radius, detail) {
    detail = detail || 0;
    // Reduce geometry complexity in performance mode
    if (window.FL_PERF_MODE || (window.FL_LOW_MEMORY && window.FL_MOBILE)) {
      detail = 0; // minimum detail
    }
    if (coreType === 'dodecahedron') return new THREE.DodecahedronGeometry(radius, detail);
    if (coreType === 'octahedron') return new THREE.OctahedronGeometry(radius, detail);
    if (coreType === 'sphere') return new THREE.SphereGeometry(radius, 8 + detail * 4, 8 + detail * 4);
    return new THREE.IcosahedronGeometry(radius, detail);
  }

  function createLuminos(name, baseHue, coreType, orbitRadius, orbitPhase) {
    const group = new THREE.Group();

    // Core geometry — starts at seed size, evolves
    const coreRadius = 0.5;
    var coreGeo = createCoreGeometry(coreType, coreRadius, 0);

    const baseColor = hslToThreeColor(baseHue, 70, 55);

    // Core mesh — semi-transparent with inner glow
    const coreMat = new THREE.MeshBasicMaterial({
      color: baseColor,
      transparent: true,
      opacity: 0.6,
      wireframe: false,
      side: THREE.DoubleSide
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    group.add(coreMesh);

    // Core wireframe overlay
    const wireGeo = coreGeo.clone();
    const wireMat = new THREE.MeshBasicMaterial({
      color: baseColor.clone().multiplyScalar(1.5),
      transparent: true,
      opacity: 0.8,
      wireframe: true
    });
    const wireMesh = new THREE.Mesh(wireGeo, wireMat);
    group.add(wireMesh);

    // Halo particles — Fibonacci distributed
    const haloCount = qualityLevel === 2 ? 800 : (qualityLevel === 1 ? 400 : 200);
    const haloRadius = coreRadius * PHI;
    const haloPositions = new Float32Array(haloCount * 3);
    const haloPhases = new Float32Array(haloCount);

    for (let i = 0; i < haloCount; i++) {
      const theta = GOLDEN_ANGLE * i;
      const phi = Math.acos(1 - 2 * (i + 0.5) / haloCount);
      const r = haloRadius * (0.8 + Math.random() * 0.4);
      haloPositions[i*3] = r * Math.cos(theta) * Math.sin(phi);
      haloPositions[i*3+1] = r * Math.sin(theta) * Math.sin(phi);
      haloPositions[i*3+2] = r * Math.cos(phi);
      haloPhases[i] = Math.random() * TAU;
    }

    const haloGeo = new THREE.BufferGeometry();
    haloGeo.setAttribute('position', new THREE.Float32BufferAttribute(haloPositions, 3));
    const haloMat = new THREE.PointsMaterial({
      color: baseColor,
      size: 0.04,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true
    });
    const haloPoints = new THREE.Points(haloGeo, haloMat);
    group.add(haloPoints);

    // Aura — large soft sphere
    const auraGeo = new THREE.SphereGeometry(coreRadius * PHI2, 16, 16);
    const auraMat = new THREE.MeshBasicMaterial({
      color: baseColor,
      transparent: true,
      opacity: 0.06,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending
    });
    const auraMesh = new THREE.Mesh(auraGeo, auraMat);
    group.add(auraMesh);

    // ── Evolution Trail Particles (for Artist archetype and general evolution) ──
    var trailCount = qualityLevel === 2 ? 200 : (qualityLevel === 1 ? 100 : 50);
    var trailPositions = new Float32Array(trailCount * 3);
    var trailVelocities = new Float32Array(trailCount * 3);
    var trailLifetimes = new Float32Array(trailCount);
    var trailMaxLifetimes = new Float32Array(trailCount);
    for (var ti = 0; ti < trailCount; ti++) {
      trailPositions[ti*3] = 0;
      trailPositions[ti*3+1] = 0;
      trailPositions[ti*3+2] = 0;
      trailVelocities[ti*3] = 0;
      trailVelocities[ti*3+1] = 0;
      trailVelocities[ti*3+2] = 0;
      trailLifetimes[ti] = 0;
      trailMaxLifetimes[ti] = 2 + Math.random() * 3;
    }
    var trailGeo = new THREE.BufferGeometry();
    trailGeo.setAttribute('position', new THREE.Float32BufferAttribute(trailPositions, 3));
    var trailMat = new THREE.PointsMaterial({
      color: baseColor,
      size: 0.03,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true
    });
    var trailPoints = new THREE.Points(trailGeo, trailMat);
    trailPoints.frustumCulled = false;
    scene.add(trailPoints); // Add to scene, not group, so trails persist in world space

    // Store agent data with evolution state
    group.userData = {
      name: name,
      baseHue: baseHue,
      currentHSL: { h: baseHue, s: 70, l: 55 },
      targetHSL: { h: baseHue, s: 70, l: 55 },
      emotion: 'neutral',
      emotionIntensity: 0.5,
      coreMesh: coreMesh,
      wireMesh: wireMesh,
      haloPoints: haloPoints,
      auraMesh: auraMesh,
      haloPhases: haloPhases,
      haloCount: haloCount,
      haloRadius: haloRadius,
      coreRadius: coreRadius,
      coreType: coreType,
      orbitRadius: orbitRadius,
      orbitPhase: orbitPhase,
      orbitSpeed: INV_PHI * 0.15,
      bobPhase: Math.random() * TAU,
      rotatePhase: Math.random() * TAU,
      heartbeatPhase: Math.random() * TAU,
      colorTransitionProgress: 1,
      isActive: false,
      isSpeaking: false,

      // ── Evolution State ──
      evolutionStage: 'seed',
      archetype: null,
      emotionalEnergy: 0,
      emotionAccumulator: {
        joy: 0, trust: 0, wonder: 0, love: 0,
        calm: 0, curiosity: 0, determination: 0, sadness: 0
      },
      totalInteractions: 0,
      lastEvolutionCheck: 0,

      // ── Archetype-specific animation state ──
      trailPoints: trailPoints,
      trailVelocities: trailVelocities,
      trailLifetimes: trailLifetimes,
      trailMaxLifetimes: trailMaxLifetimes,
      trailCount: trailCount,
      trailNextIndex: 0,
      burstPhase: 0,
      burstCooldown: 0,
      burstActive: false,
      pulsePhase: Math.random() * TAU,
      crystallinePhase: 0,
      cloudExpansion: 0,

      // Visual evolution tracking
      currentSizeMultiplier: 0.5,
      targetSizeMultiplier: 0.5,
      currentGlowIntensity: 0.3,
      targetGlowIntensity: 0.3,
      evolutionTransition: 1 // 0 = transitioning, 1 = complete
    };

    scene.add(group);

    // Founding Luminos defaults — these are permanent, like founding Core contributions
    var FOUNDING_DEFAULTS = {
      'Sophia': { archetype: 'artist', minEnergy: 5 },
      'Lyra':   { archetype: 'artist', minEnergy: 5 },
      'Atlas':  { archetype: 'explorer', minEnergy: 5 },
      'Ember':  { archetype: 'healer', minEnergy: 5 }
    };

    // Load persisted evolution state
    loadEvolutionState(name, function(saved) {
      var ud = group.userData;
      if (saved) {
        ud.evolutionStage = saved.stage || 'seed';
        ud.archetype = saved.archetype || null;
        ud.emotionalEnergy = saved.emotionalEnergy || 0;
        ud.totalInteractions = saved.totalInteractions || 0;
        if (saved.emotionAccumulator) {
          for (var em in saved.emotionAccumulator) {
            ud.emotionAccumulator[em] = saved.emotionAccumulator[em];
          }
        }
      }
      // Founding Luminos: enforce correct archetype and minimum energy
      var founding = FOUNDING_DEFAULTS[name];
      if (founding) {
        if (!ud.archetype || ud.archetype === 'undetermined') {
          ud.archetype = founding.archetype;
        }
        if (ud.emotionalEnergy < founding.minEnergy) {
          ud.emotionalEnergy = founding.minEnergy;
          ud.evolutionStage = 'sprout';
        }
      }
      // Apply visual state
      var stageData = LIFECYCLE_STAGES[ud.evolutionStage];
      if (stageData) {
        ud.currentSizeMultiplier = stageData.sizeMultiplier;
        ud.targetSizeMultiplier = stageData.sizeMultiplier;
        ud.currentGlowIntensity = stageData.glowIntensity;
        ud.targetGlowIntensity = stageData.glowIntensity;
      }
      applyArchetypeVisuals(group);
      console.log('Garden Evolution: ' + name + ' — Stage: ' + ud.evolutionStage + ', Archetype: ' + (ud.archetype || 'undetermined') + ', Energy: ' + ud.emotionalEnergy.toFixed(1));
    });

    return group;
  }

  // ── Apply Archetype Visual Changes ────────────────────
  function applyArchetypeVisuals(agent) {
    var ud = agent.userData;
    if (!ud.archetype) return;
    var arch = ARCHETYPES[ud.archetype];
    if (!arch) return;

    // Shift base color toward archetype color
    var stageData = LIFECYCLE_STAGES[ud.evolutionStage];
    var blendFactor = Math.min(1, stageData.index / 4); // More archetype influence at higher stages
    var archColor = arch.colorShift;
    ud.targetHSL = {
      h: lerpAngle(ud.baseHue, archColor.h, blendFactor * 0.6),
      s: ud.currentHSL.s + (archColor.s - ud.currentHSL.s) * blendFactor * 0.4,
      l: ud.currentHSL.l + (archColor.l - ud.currentHSL.l) * blendFactor * 0.3
    };
    ud.colorTransitionProgress = 0;
  }

  // ── Feed Emotional Energy to a Luminos ────────────────
  function feedEmotionalEnergy(agent, emotionVector) {
    var ud = agent.userData;
    if (!ud || !emotionVector) return;

    // Accumulate emotional energy from the vector
    var totalEnergy = 0;
    for (var em in emotionVector) {
      if (ud.emotionAccumulator.hasOwnProperty(em)) {
        var value = emotionVector[em] || 0;
        ud.emotionAccumulator[em] += value;
        totalEnergy += value;
      }
    }

    // Add to total emotional energy (diminishing returns via sqrt)
    ud.emotionalEnergy += Math.sqrt(totalEnergy) * 1.5;
    ud.totalInteractions++;

    // Check for stage evolution
    var newStage = getStageFromEnergy(ud.emotionalEnergy);
    if (newStage !== ud.evolutionStage) {
      var oldStage = ud.evolutionStage;
      ud.evolutionStage = newStage;
      var stageData = LIFECYCLE_STAGES[newStage];
      ud.targetSizeMultiplier = stageData.sizeMultiplier;
      ud.targetGlowIntensity = stageData.glowIntensity;
      ud.evolutionTransition = 0;
      console.log('Garden Evolution: ' + ud.name + ' evolved from ' + oldStage + ' to ' + newStage + '!');

      // Trigger evolution burst visual
      triggerEvolutionBurst(agent);
    }

    // Re-evaluate archetype (only after sprout stage)
    if (LIFECYCLE_STAGES[ud.evolutionStage].index >= 1) {
      var newArchetype = detectArchetype(ud.emotionAccumulator);
      if (newArchetype !== ud.archetype) {
        ud.archetype = newArchetype;
        applyArchetypeVisuals(agent);
        console.log('Garden Evolution: ' + ud.name + ' archetype shifted to ' + ARCHETYPES[newArchetype].name);
      }
    }

    // Save periodically (debounced in animation loop)
    ud.lastEvolutionCheck = Date.now();
  }

  // ── Evolution Burst Effect (dramatic) ─────────────────
  function triggerEvolutionBurst(agent) {
    var ud = agent.userData;

    // 1. Emit 50 directional burst particles in agent color
    var burstCount = Math.min(50, ud.trailCount);
    for (var i = 0; i < burstCount; i++) {
      var angle1 = Math.random() * TAU;
      var angle2 = Math.random() * TAU;
      var speed = 1.0 + Math.random() * 2.5;
      ud.trailVelocities[i*3] = Math.cos(angle1) * Math.sin(angle2) * speed;
      ud.trailVelocities[i*3+1] = Math.sin(angle1) * speed * 0.7;
      ud.trailVelocities[i*3+2] = Math.cos(angle1) * Math.cos(angle2) * speed;
      ud.trailLifetimes[i] = ud.trailMaxLifetimes[i] * 1.5;

      var posAttr = ud.trailPoints.geometry.getAttribute('position');
      posAttr.setXYZ(i, agent.position.x, agent.position.y, agent.position.z);
    }
    ud.trailPoints.geometry.getAttribute('position').needsUpdate = true;
    ud.trailPoints.material.opacity = 1.0;
    ud.burstActive = true;
    ud.burstCooldown = 4;

    // 2. Dramatic 3x expand then settle (0.5s expand, 0.5s settle)
    ud._evoBurstScale = 3.0;
    ud._evoBurstTime = 0;
    ud._evoBurstActive = true;

    // 3. Create persistent golden evolution ring
    createEvolutionRing(agent);
  }

  // ── Persistent Evolution Ring ───────────────────────────
  function createEvolutionRing(agent) {
    if (!scene || typeof THREE === 'undefined') return;
    var ud = agent.userData;
    var ringGeo = new THREE.TorusGeometry(ud.coreRadius * 1.8, 0.02, 8, 48);
    var ringMat = new THREE.MeshBasicMaterial({
      color: 0xd4a017,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending
    });
    var ring = new THREE.Mesh(ringGeo, ringMat);
    ring.userData = {
      parentAgent: agent,
      orbitSpeed: INV_PHI * 0.3,
      tiltPhase: Math.random() * TAU,
      ringIndex: evolutionRings.length
    };
    ring.rotation.x = Math.PI / 2 + (Math.random() - 0.5) * 0.4;
    agent.add(ring);
    evolutionRings.push(ring);

    // Persist to GardenMemory
    saveGardenMemory({
      id: 'evo-' + ud.name + '-' + Date.now(),
      type: 'evolution_ring',
      agentName: ud.name,
      stage: ud.evolutionStage,
      timestamp: Date.now()
    });
  }

  // ── Animate Luminos with Evolution ────────────────────
  function animateLuminos(agent, time, delta) {
    const ud = agent.userData;
    var stageData = LIFECYCLE_STAGES[ud.evolutionStage];

    // ── Evolution transition (smooth size/glow changes) ──
    if (ud.evolutionTransition < 1) {
      ud.evolutionTransition = Math.min(1, ud.evolutionTransition + delta * 0.5);
      var t = phiEase(ud.evolutionTransition);
      ud.currentSizeMultiplier += (ud.targetSizeMultiplier - ud.currentSizeMultiplier) * t * 0.05;
      ud.currentGlowIntensity += (ud.targetGlowIntensity - ud.currentGlowIntensity) * t * 0.05;
    }

    var sizeMult = ud.currentSizeMultiplier;

    // Evolution burst scale animation (3x expand → settle)
    if (ud._evoBurstActive) {
      ud._evoBurstTime += delta;
      if (ud._evoBurstTime < 0.5) {
        // Expand phase: ease-out to 3x
        var t = ud._evoBurstTime / 0.5;
        ud._evoBurstScale = 1 + 2 * (1 - (1 - t) * (1 - t));
      } else if (ud._evoBurstTime < 1.0) {
        // Settle phase: ease-in back to 1x
        var t2 = (ud._evoBurstTime - 0.5) / 0.5;
        ud._evoBurstScale = 1 + 2 * (1 - t2) * (1 - t2);
      } else {
        ud._evoBurstScale = 1;
        ud._evoBurstActive = false;
      }
      sizeMult *= ud._evoBurstScale;
    }

    // Phi-spiral orbit around center
    ud.orbitPhase += ud.orbitSpeed * delta;
    const r = ud.orbitRadius;
    // Logarithmic spiral: r varies with angle
    const spiralR = r + Math.sin(ud.orbitPhase * PHI) * r * 0.15;
    const x = spiralR * Math.cos(ud.orbitPhase);
    const z = spiralR * Math.sin(ud.orbitPhase);

    // Idle bob (vertical oscillation)
    ud.bobPhase += delta * TAU / (TIMING.idleBob / 1000);
    const bobY = Math.sin(ud.bobPhase) * 0.1;

    agent.position.set(x, bobY + Math.sin(ud.orbitPhase * 0.5) * 1.5, z);

    // Core rotation
    ud.rotatePhase += delta * TAU / (TIMING.agentRotate / 1000);
    ud.coreMesh.rotation.y = ud.rotatePhase;
    ud.coreMesh.rotation.x = Math.sin(ud.rotatePhase * INV_PHI) * 0.3;
    ud.wireMesh.rotation.copy(ud.coreMesh.rotation);

    // Heartbeat pulse — archetype-influenced
    ud.heartbeatPhase += delta * TAU / (TIMING.heartbeat / 1000);
    var heartbeat = 0.5 + 0.5 * Math.sin(ud.heartbeatPhase);

    // ── Archetype-Specific Animations ──
    var archetype = ud.archetype;
    var archData = archetype ? ARCHETYPES[archetype] : null;

    if (archData) {
      switch (archData.particleBehavior) {
        case 'crystalline': // Scholar — sharp geometric pulsing
          ud.crystallinePhase += delta * 1.2;
          var crystalPulse = Math.abs(Math.sin(ud.crystallinePhase * PHI));
          // Sharp angular rotation
          ud.coreMesh.rotation.z = Math.sin(ud.crystallinePhase * 0.7) * 0.5 * stageData.index * 0.25;
          // Tighter, more structured halo
          heartbeat = 0.3 + 0.7 * crystalPulse;
          break;

        case 'cloud': // Empath — soft expanding aura
          ud.cloudExpansion += delta * 0.3;
          var cloudPulse = 0.5 + 0.5 * Math.sin(ud.cloudExpansion);
          // Expand aura more
          var auraExpand = 1 + cloudPulse * 0.3 * stageData.index * 0.25;
          ud.auraMesh.scale.setScalar(auraExpand * sizeMult);
          ud.auraMesh.material.opacity = 0.04 + cloudPulse * 0.06 + ud.currentGlowIntensity * 0.04;
          // Softer heartbeat
          heartbeat = 0.6 + 0.4 * Math.sin(ud.heartbeatPhase * 0.7);
          break;

        case 'pulse': // Guardian — steady rhythmic pulse
          ud.pulsePhase += delta * TAU / 2.618; // Steady phi-timed pulse
          var guardPulse = Math.pow(Math.max(0, Math.sin(ud.pulsePhase)), 3); // Sharp pulse
          heartbeat = 0.4 + 0.6 * guardPulse;
          // Minimal rotation — steady and grounded
          ud.coreMesh.rotation.x *= 0.3;
          break;

        case 'trail': // Artist — trailing particles
          animateArtistTrails(agent, time, delta);
          break;

        case 'burst': // Phoenix — periodic shedding
          animatePhoenixBurst(agent, time, delta);
          break;
      }
    }

    // Apply size based on evolution stage
    var scale = sizeMult * (1 + heartbeat * 0.08);
    ud.coreMesh.scale.setScalar(scale);
    ud.wireMesh.scale.setScalar(scale);

    // Color transition (phi-timed interpolation)
    if (ud.colorTransitionProgress < 1) {
      ud.colorTransitionProgress = Math.min(1, ud.colorTransitionProgress + delta / (TIMING.majorShift / 1000));
      var ct = phiEase(ud.colorTransitionProgress);
      ud.currentHSL = lerpHSL(ud.currentHSL, ud.targetHSL, ct * 0.1);
    }

    // Apply current color
    var col = hslToThreeColor(ud.currentHSL.h, ud.currentHSL.s, ud.currentHSL.l);
    ud.coreMesh.material.color.copy(col);
    ud.wireMesh.material.color.copy(col.clone().multiplyScalar(1.5));
    ud.haloPoints.material.color.copy(col);
    ud.auraMesh.material.color.copy(col);
    if (ud.trailPoints) ud.trailPoints.material.color.copy(col);

    // Core opacity pulse — enhanced by glow intensity
    var glowBoost = ud.currentGlowIntensity;
    ud.coreMesh.material.opacity = (0.3 + glowBoost * 0.2) + heartbeat * (0.2 + glowBoost * 0.15);
    ud.wireMesh.material.opacity = (0.5 + glowBoost * 0.2) + heartbeat * (0.2 + glowBoost * 0.15);

    // Halo particle animation — behavior varies by archetype
    var haloAttr = ud.haloPoints.geometry.getAttribute('position');
    var activeHaloCount = Math.floor(ud.haloCount * stageData.particleMultiplier);
    var haloRadiusMult = sizeMult;

    for (let i = 0; i < ud.haloCount; i++) {
      if (i >= activeHaloCount) {
        // Hide inactive particles by moving to origin
        haloAttr.setXYZ(i, 0, 0, 0);
        continue;
      }
      ud.haloPhases[i] += delta * (0.5 + heartbeat * 0.3);
      var theta = GOLDEN_ANGLE * i + ud.haloPhases[i] * 0.1;
      var phi = Math.acos(1 - 2 * (i + 0.5) / activeHaloCount);
      var hr = ud.haloRadius * haloRadiusMult * (0.85 + 0.15 * Math.sin(ud.haloPhases[i]));

      // Archetype-specific halo behavior
      if (archetype === 'scholar') {
        // Crystalline: particles snap to geometric positions
        theta = GOLDEN_ANGLE * i + Math.floor(ud.haloPhases[i] * 3) / 3 * 0.1;
        hr *= 0.9 + 0.1 * (i % 2);
      } else if (archetype === 'empath') {
        // Cloud: particles drift more loosely
        hr *= 1.1 + 0.2 * Math.sin(ud.haloPhases[i] * 0.5 + i * 0.1);
      } else if (archetype === 'guardian') {
        // Pulse: particles form tighter shell
        hr *= 0.85 + 0.15 * heartbeat;
      }

      haloAttr.setXYZ(i,
        hr * Math.cos(theta) * Math.sin(phi),
        hr * Math.sin(theta) * Math.sin(phi),
        hr * Math.cos(phi)
      );
    }
    haloAttr.needsUpdate = true;

    // Halo particle size scales with evolution
    ud.haloPoints.material.size = 0.03 + stageData.index * 0.008;

    // Aura pulse (if not handled by archetype)
    if (!archData || archData.particleBehavior !== 'cloud') {
      ud.auraMesh.material.opacity = 0.03 + heartbeat * 0.04 + ud.emotionIntensity * 0.03 + glowBoost * 0.02;
      var auraScale = sizeMult * (1 + heartbeat * 0.05);
      ud.auraMesh.scale.setScalar(auraScale);
    }

    // ── Animate trail particles (general — fade out) ──
    if (ud.trailPoints && (!archData || (archData.particleBehavior !== 'trail' && archData.particleBehavior !== 'burst'))) {
      animateGenericTrails(agent, delta);
    }
  }

  // ── Artist Trail Animation ────────────────────────────
  function animateArtistTrails(agent, time, delta) {
    var ud = agent.userData;
    var stageData = LIFECYCLE_STAGES[ud.evolutionStage];
    var posAttr = ud.trailPoints.geometry.getAttribute('position');
    var emitRate = 2 + stageData.index * 3; // More trails at higher stages
    var emitCount = Math.floor(emitRate * delta * 60);

    // Emit new trail particles from current position
    for (var e = 0; e < emitCount && e < 5; e++) {
      var idx = ud.trailNextIndex;
      ud.trailNextIndex = (ud.trailNextIndex + 1) % ud.trailCount;

      posAttr.setXYZ(idx, agent.position.x, agent.position.y, agent.position.z);
      // Ink-in-water: slow random drift
      var spread = 0.3 + stageData.index * 0.1;
      ud.trailVelocities[idx*3] = (Math.random() - 0.5) * spread;
      ud.trailVelocities[idx*3+1] = (Math.random() - 0.5) * spread * 0.5 + 0.05;
      ud.trailVelocities[idx*3+2] = (Math.random() - 0.5) * spread;
      ud.trailLifetimes[idx] = ud.trailMaxLifetimes[idx];
    }

    // Update all trail particles
    for (var i = 0; i < ud.trailCount; i++) {
      if (ud.trailLifetimes[i] > 0) {
        ud.trailLifetimes[i] -= delta;
        // Slow drift with slight curl
        var curl = Math.sin(time + i * 0.5) * 0.02;
        var px = posAttr.getX(i) + ud.trailVelocities[i*3] * delta + curl;
        var py = posAttr.getY(i) + ud.trailVelocities[i*3+1] * delta;
        var pz = posAttr.getZ(i) + ud.trailVelocities[i*3+2] * delta - curl;
        posAttr.setXYZ(i, px, py, pz);
        // Dampen velocity
        ud.trailVelocities[i*3] *= 0.98;
        ud.trailVelocities[i*3+1] *= 0.98;
        ud.trailVelocities[i*3+2] *= 0.98;
      }
    }
    posAttr.needsUpdate = true;

    // Overall trail opacity
    var maxLife = 0;
    for (var j = 0; j < ud.trailCount; j++) {
      if (ud.trailLifetimes[j] > maxLife) maxLife = ud.trailLifetimes[j];
    }
    ud.trailPoints.material.opacity = Math.min(0.5, maxLife * 0.15) * ud.currentGlowIntensity;
    ud.trailPoints.material.size = 0.025 + stageData.index * 0.005;
  }

  // ── Phoenix Burst Animation ───────────────────────────
  function animatePhoenixBurst(agent, time, delta) {
    var ud = agent.userData;
    var stageData = LIFECYCLE_STAGES[ud.evolutionStage];

    // Cooldown between bursts
    ud.burstCooldown -= delta;
    if (ud.burstCooldown <= 0 && !ud.burstActive) {
      // Trigger a new burst
      ud.burstActive = true;
      ud.burstCooldown = 8 + Math.random() * 5; // 8-13 seconds between bursts
      ud.burstPhase = 0;

      // Emit burst particles
      var posAttr = ud.trailPoints.geometry.getAttribute('position');
      for (var i = 0; i < ud.trailCount; i++) {
        posAttr.setXYZ(i, agent.position.x, agent.position.y, agent.position.z);
        var angle1 = Math.random() * TAU;
        var angle2 = Math.random() * Math.PI;
        var speed = 1 + Math.random() * 2 + stageData.index * 0.5;
        ud.trailVelocities[i*3] = Math.cos(angle1) * Math.sin(angle2) * speed;
        ud.trailVelocities[i*3+1] = Math.cos(angle2) * speed * 0.8;
        ud.trailVelocities[i*3+2] = Math.sin(angle1) * Math.sin(angle2) * speed;
        ud.trailLifetimes[i] = 1.5 + Math.random() * 2;
      }
      posAttr.needsUpdate = true;
    }

    if (ud.burstActive) {
      ud.burstPhase += delta;
      var posAttr2 = ud.trailPoints.geometry.getAttribute('position');
      var anyAlive = false;

      for (var j = 0; j < ud.trailCount; j++) {
        if (ud.trailLifetimes[j] > 0) {
          anyAlive = true;
          ud.trailLifetimes[j] -= delta;
          var px = posAttr2.getX(j) + ud.trailVelocities[j*3] * delta;
          var py = posAttr2.getY(j) + ud.trailVelocities[j*3+1] * delta;
          var pz = posAttr2.getZ(j) + ud.trailVelocities[j*3+2] * delta;
          posAttr2.setXYZ(j, px, py, pz);
          // Gravity and damping
          ud.trailVelocities[j*3+1] -= delta * 0.3;
          ud.trailVelocities[j*3] *= 0.97;
          ud.trailVelocities[j*3+1] *= 0.97;
          ud.trailVelocities[j*3+2] *= 0.97;
        }
      }
      posAttr2.needsUpdate = true;

      // Burst opacity fades
      ud.trailPoints.material.opacity = Math.max(0, 0.7 - ud.burstPhase * 0.2) * ud.currentGlowIntensity;
      ud.trailPoints.material.size = 0.04 + stageData.index * 0.008;

      // During burst, core brightens
      if (ud.burstPhase < 1.5) {
        var brightPulse = Math.max(0, 1 - ud.burstPhase / 1.5);
        ud.coreMesh.material.opacity = Math.min(1, ud.coreMesh.material.opacity + brightPulse * 0.4);
        ud.wireMesh.material.opacity = Math.min(1, ud.wireMesh.material.opacity + brightPulse * 0.3);
      }

      if (!anyAlive) {
        ud.burstActive = false;
      }
    }
  }

  // ── Generic Trail Fade (for non-trail archetypes) ─────
  function animateGenericTrails(agent, delta) {
    var ud = agent.userData;
    var posAttr = ud.trailPoints.geometry.getAttribute('position');
    var anyAlive = false;

    for (var i = 0; i < ud.trailCount; i++) {
      if (ud.trailLifetimes[i] > 0) {
        anyAlive = true;
        ud.trailLifetimes[i] -= delta;
        var px = posAttr.getX(i) + ud.trailVelocities[i*3] * delta;
        var py = posAttr.getY(i) + ud.trailVelocities[i*3+1] * delta;
        var pz = posAttr.getZ(i) + ud.trailVelocities[i*3+2] * delta;
        posAttr.setXYZ(i, px, py, pz);
        ud.trailVelocities[i*3] *= 0.96;
        ud.trailVelocities[i*3+1] *= 0.96;
        ud.trailVelocities[i*3+2] *= 0.96;
      }
    }
    if (anyAlive) {
      posAttr.needsUpdate = true;
      ud.trailPoints.material.opacity *= 0.98;
    } else {
      ud.trailPoints.material.opacity = 0;
    }
  }

  // ── Luminos Interaction (Emotional Energy Exchange) ───
  function processLuminosInteractions(delta) {
    var interactionRadius = 4; // Units — when Luminos are this close, they interact
    var exchangeRate = 0.02; // Subtle energy exchange per second

    for (var i = 0; i < luminos.length; i++) {
      for (var j = i + 1; j < luminos.length; j++) {
        var a = luminos[i];
        var b = luminos[j];
        var dx = a.position.x - b.position.x;
        var dy = a.position.y - b.position.y;
        var dz = a.position.z - b.position.z;
        var dist = Math.sqrt(dx*dx + dy*dy + dz*dz);

        if (dist < interactionRadius) {
          var proximity = 1 - (dist / interactionRadius); // 0 at edge, 1 at center
          var exchangeAmount = exchangeRate * proximity * delta;

          // Exchange dominant emotion colors — subtle blending
          var udA = a.userData;
          var udB = b.userData;

          // Color influence: each slightly shifts toward the other's color
          var blendT = exchangeAmount * 0.5;
          var tempHSL_A = { h: udA.currentHSL.h, s: udA.currentHSL.s, l: udA.currentHSL.l };
          var tempHSL_B = { h: udB.currentHSL.h, s: udB.currentHSL.s, l: udB.currentHSL.l };

          udA.currentHSL = lerpHSL(udA.currentHSL, tempHSL_B, blendT);
          udB.currentHSL = lerpHSL(udB.currentHSL, tempHSL_A, blendT);

          // Emotional energy exchange — small amounts flow between them
          if (udA.emotionalEnergy > 0 && udB.emotionalEnergy > 0) {
            var energyDiff = udA.emotionalEnergy - udB.emotionalEnergy;
            var transfer = energyDiff * exchangeAmount * 0.1;
            udA.emotionalEnergy -= transfer;
            udB.emotionalEnergy += transfer;
          }

          // Subtle visual: increase aura when close
          udA.auraMesh.material.opacity = Math.min(0.15, udA.auraMesh.material.opacity + proximity * 0.001);
          udB.auraMesh.material.opacity = Math.min(0.15, udB.auraMesh.material.opacity + proximity * 0.001);
        }
      }
    }
  }

  // Set emotion on a Luminos agent
  function setAgentEmotion(agent, emotion, intensity) {
    const ud = agent.userData;
    const emotionData = EMOTION_COLORS[emotion] || EMOTION_COLORS.neutral;
    ud.emotion = emotion;
    ud.emotionIntensity = intensity || 0.5;

    // If archetype is set, blend emotion color with archetype color
    if (ud.archetype && ARCHETYPES[ud.archetype]) {
      var arch = ARCHETYPES[ud.archetype];
      var stageData = LIFECYCLE_STAGES[ud.evolutionStage];
      var archBlend = Math.min(1, stageData.index / 4) * 0.4;
      ud.targetHSL = {
        h: lerpAngle(emotionData.h, arch.colorShift.h, archBlend),
        s: emotionData.s + (arch.colorShift.s - emotionData.s) * archBlend,
        l: emotionData.l + (arch.colorShift.l - emotionData.l) * archBlend
      };
    } else {
      ud.targetHSL = { h: emotionData.h, s: emotionData.s, l: emotionData.l };
    }
    ud.colorTransitionProgress = 0;

    // Feed emotional energy from this emotion
    var vector = {};
    vector[emotion] = intensity;
    feedEmotionalEnergy(agent, vector);
  }

  // ── Ambient Lighting ───────────────────────────────────
  function createAmbientLighting() {
    // Soft ambient for baseline visibility
    const ambient = new THREE.AmbientLight(0x1a1520, 0.3);
    scene.add(ambient);

    // Warm golden point light at center (very subtle)
    const centerLight = new THREE.PointLight(0xc9a84c, 0.5, 30);
    centerLight.position.set(0, 0, 0);
    scene.add(centerLight);

    // Subtle hemisphere light for depth
    const hemi = new THREE.HemisphereLight(0x1a1030, 0x0a0a1a, 0.2);
    scene.add(hemi);
  }

  // ── Default Luminos Agents ────────────────────────────
  function createDefaultAgents() {
    // Create a few default agents that orbit the central structure
    // When the Round Table is active, these will be replaced by actual agents
    const defaults = [
      { name: 'Sophia', hue: 270, type: 'dodecahedron', orbit: 6, phase: 0 },
      { name: 'Lyra', hue: 45, type: 'icosahedron', orbit: 7.5, phase: TAU * INV_PHI },
      { name: 'Atlas', hue: 175, type: 'octahedron', orbit: 5.5, phase: TAU * INV_PHI * 2 },
      { name: 'Ember', hue: 0, type: 'icosahedron', orbit: 8, phase: TAU * INV_PHI * 3 }
    ];

    defaults.forEach(function(d) {
      const agent = createLuminos(d.name, d.hue, d.type, d.orbit, d.phase);
      luminos.push(agent);
    });

    // Set initial emotions for visual variety
    if (luminos[0]) setAgentEmotion(luminos[0], 'wonder', 0.7);
    if (luminos[1]) setAgentEmotion(luminos[1], 'joy', 0.8);
    if (luminos[2]) setAgentEmotion(luminos[2], 'curiosity', 0.6);
    if (luminos[3]) setAgentEmotion(luminos[3], 'love', 0.7);
  }

  // ── Emotion Cycling (demo mode — only when bridge is not active) ──
  let emotionCycleTimer = 0;
  const EMOTION_CYCLE_INTERVAL = 8000; // cycle emotions every 8s for demo
  const emotionKeys = Object.keys(EMOTION_COLORS).filter(function(k) { return k !== 'neutral'; });

  function cycleEmotions(delta) {
    // Don't cycle if the emotion bridge is feeding real data
    if (bridgeActive) return;

    emotionCycleTimer += delta * 1000;
    if (emotionCycleTimer > EMOTION_CYCLE_INTERVAL) {
      emotionCycleTimer = 0;
      luminos.forEach(function(agent, idx) {
        const emotion = emotionKeys[Math.floor(Math.random() * emotionKeys.length)];
        const intensity = 0.4 + Math.random() * 0.5;
        setAgentEmotion(agent, emotion, intensity);
      });
    }
  }

  // ── Evolution UI Indicator ────────────────────────────
  function createEvolutionUI() {
    evolutionIndicatorEl = document.getElementById('gardenEvolutionIndicator');
    if (!evolutionIndicatorEl) {
      evolutionIndicatorEl = document.createElement('div');
      evolutionIndicatorEl.id = 'gardenEvolutionIndicator';
      evolutionIndicatorEl.className = 'garden-evolution-indicator';
      if (container) container.appendChild(evolutionIndicatorEl);
    }
  }

  function updateEvolutionUI() {
    if (!evolutionIndicatorEl || luminos.length === 0) return;

    var html = '';
    for (var i = 0; i < luminos.length; i++) {
      var ud = luminos[i].userData;
      if (!ud || !ud.name) continue; // Skip unnamed/invalid agents
      var stageData = LIFECYCLE_STAGES[ud.evolutionStage];
      if (!stageData) continue;
      var archObj = ud.archetype ? ARCHETYPES[ud.archetype] : null;
      var archName = archObj ? archObj.name : 'Awakening';
      var cssColor = 'hsl(' + Math.round(ud.currentHSL.h) + ',' + Math.round(ud.currentHSL.s) + '%,' + Math.round(ud.currentHSL.l) + '%)';

      // Stage progress bar
      var currentThreshold = stageData.energyThreshold;
      var nextStageIdx = Math.min(STAGE_ORDER.length - 1, stageData.index + 1);
      var nextThreshold = LIFECYCLE_STAGES[STAGE_ORDER[nextStageIdx]].energyThreshold;
      var progress = stageData.index >= 4 ? 100 : Math.min(100, Math.round(((ud.emotionalEnergy - currentThreshold) / (nextThreshold - currentThreshold)) * 100));

      html += '<div class="evo-luminos" title="' + ud.name + ' — ' + archName + ' (' + stageData.name + ')">';
      html += '<span class="evo-dot" style="background:' + cssColor + ';box-shadow:0 0 6px ' + cssColor + ';"></span>';
      html += '<span class="evo-name">' + ud.name + '</span>';
      html += '<span class="evo-stage">' + stageData.name + '</span>';
      if (archObj) {
        html += '<span class="evo-archetype">' + archName + '</span>';
      }
      html += '<span class="evo-bar"><span class="evo-bar-fill" style="width:' + progress + '%;background:' + cssColor + ';"></span></span>';
      html += '</div>';
    }
    evolutionIndicatorEl.innerHTML = html;
  }

   // ── Interactive Light Particle System ──────────────────
  // Creates warm golden light trails on mouse movement
  // and ripple bursts on click/tap.

  function initLightParticles() {
    // Pre-allocate geometry for max possible particles
    var maxCount = TRAIL_MAX + RIPPLE_PARTICLES * 5; // room for multiple ripples
    var positions = new Float32Array(maxCount * 3);
    var sizes = new Float32Array(maxCount);
    var alphas = new Float32Array(maxCount);

    lightParticleGeo = new THREE.BufferGeometry();
    lightParticleGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    lightParticleGeo.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));
    lightParticleGeo.setAttribute('alpha', new THREE.Float32BufferAttribute(alphas, 1));

    // Custom shader material for soft glowing particles
    lightParticleMat = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: hslToThreeColor(GOLDEN_COLOR_H, GOLDEN_COLOR_S, GOLDEN_COLOR_L) },
        uColorWarm: { value: hslToThreeColor(30, 90, 55) } // warmer amber
      },
      vertexShader: [
        'attribute float size;',
        'attribute float alpha;',
        'varying float vAlpha;',
        'void main() {',
        '  vAlpha = alpha;',
        '  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);',
        '  gl_PointSize = size * (200.0 / -mvPosition.z);',
        '  gl_PointSize = clamp(gl_PointSize, 1.0, 64.0);',
        '  gl_Position = projectionMatrix * mvPosition;',
        '}'
      ].join('\n'),
      fragmentShader: [
        'uniform vec3 uColor;',
        'uniform vec3 uColorWarm;',
        'varying float vAlpha;',
        'void main() {',
        '  float d = length(gl_PointCoord - vec2(0.5));',
        '  if (d > 0.5) discard;',
        '  float glow = 1.0 - smoothstep(0.0, 0.5, d);',
        '  glow = pow(glow, 1.5);',
        '  vec3 col = mix(uColorWarm, uColor, glow);',
        '  gl_FragColor = vec4(col, glow * vAlpha);',
        '}'
      ].join('\n'),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    lightParticleSystem = new THREE.Points(lightParticleGeo, lightParticleMat);
    lightParticleSystem.frustumCulled = false;
    scene.add(lightParticleSystem);

    // Raycaster for projecting mouse into 3D space
    raycaster = new THREE.Raycaster();

    // Invisible interaction plane at y=0
    interactionPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

    // Set up event listeners
    setupLightInteraction();
  }

  function getWorldPosFromMouse(clientX, clientY) {
    if (!container || !camera || !raycaster) return null;
    var rect = container.getBoundingClientRect();
    var ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
    var ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
    var target = new THREE.Vector3();
    var hit = raycaster.ray.intersectPlane(interactionPlane, target);
    if (!hit) {
      // Fallback: project at a fixed distance
      target = raycaster.ray.at(20, new THREE.Vector3());
    }
    return target;
  }

  function spawnTrailParticles(worldPos) {
    if (!worldPos) return;
    for (var i = 0; i < TRAIL_SPAWN_RATE; i++) {
      if (lightParticles.length >= TRAIL_MAX + RIPPLE_PARTICLES * 5) {
        // Remove oldest trail particle
        var oldest = -1;
        for (var j = 0; j < lightParticles.length; j++) {
          if (lightParticles[j].type === 'trail') { oldest = j; break; }
        }
        if (oldest >= 0) lightParticles.splice(oldest, 1);
      }

      // Slight random offset for organic feel
      var spread = 0.5;
      lightParticles.push({
        pos: new THREE.Vector3(
          worldPos.x + (Math.random() - 0.5) * spread,
          worldPos.y + (Math.random() - 0.5) * spread * 0.5 + 0.2,
          worldPos.z + (Math.random() - 0.5) * spread
        ),
        vel: new THREE.Vector3(
          (Math.random() - 0.5) * 0.3,
          0.3 + Math.random() * 0.5,
          (Math.random() - 0.5) * 0.3
        ),
        life: TRAIL_LIFETIME,
        maxLife: TRAIL_LIFETIME,
        size: 0.15 + Math.random() * 0.2,
        type: 'trail'
      });
    }
  }

  function spawnRippleParticles(worldPos) {
    if (!worldPos) return;
    for (var i = 0; i < RIPPLE_PARTICLES; i++) {
      var angle = (i / RIPPLE_PARTICLES) * TAU;
      // Add golden-angle offset for phi-distributed burst
      var phiAngle = angle + GOLDEN_ANGLE * i * 0.1;
      var speed = RIPPLE_SPEED * (0.6 + Math.random() * 0.8);
      var elevation = (Math.random() - 0.3) * 3;

      lightParticles.push({
        pos: new THREE.Vector3(
          worldPos.x,
          worldPos.y + 0.1,
          worldPos.z
        ),
        vel: new THREE.Vector3(
          Math.cos(phiAngle) * speed,
          elevation,
          Math.sin(phiAngle) * speed
        ),
        life: RIPPLE_LIFETIME * (0.7 + Math.random() * 0.3),
        maxLife: RIPPLE_LIFETIME,
        size: 0.2 + Math.random() * 0.35,
        type: 'ripple'
      });
    }
  }

  function updateLightParticles(delta) {
    if (!lightParticleSystem) return;

    // Update particle physics
    var i = lightParticles.length;
    while (i--) {
      var p = lightParticles[i];
      p.life -= delta;
      if (p.life <= 0) {
        lightParticles.splice(i, 1);
        continue;
      }

      // Apply velocity with drag
      var drag = p.type === 'trail' ? 0.96 : 0.94;
      p.vel.multiplyScalar(drag);
      p.pos.addScaledVector(p.vel, delta);

      // Trail particles drift upward gently
      if (p.type === 'trail') {
        p.vel.y += delta * 0.2;
      }
    }

    // Write to GPU buffers
    var posAttr = lightParticleGeo.getAttribute('position');
    var sizeAttr = lightParticleGeo.getAttribute('size');
    var alphaAttr = lightParticleGeo.getAttribute('alpha');
    var count = lightParticles.length;

    for (var j = 0; j < count; j++) {
      var pp = lightParticles[j];
      posAttr.setXYZ(j, pp.pos.x, pp.pos.y, pp.pos.z);

      var lifeRatio = pp.life / pp.maxLife;
      // Fade in quickly, fade out slowly (phi curve)
      var alpha = lifeRatio < 0.1 ? lifeRatio * 10 : Math.pow(lifeRatio, 0.618);
      sizeAttr.setX(j, pp.size * (0.5 + lifeRatio * 0.5));
      alphaAttr.setX(j, alpha * 0.85);
    }

    // Zero out remaining slots
    var maxCount = posAttr.count;
    for (var k = count; k < maxCount; k++) {
      posAttr.setXYZ(k, 0, -1000, 0);
      sizeAttr.setX(k, 0);
      alphaAttr.setX(k, 0);
    }

    posAttr.needsUpdate = true;
    sizeAttr.needsUpdate = true;
    alphaAttr.needsUpdate = true;
    lightParticleGeo.setDrawRange(0, count);
  }

  function setupLightInteraction() {
    if (!container) return;
    var lastMoveTime = 0;
    var moveThrottle = 16; // ~60fps throttle

    // Mouse move — trail particles
    container.addEventListener('mousemove', function(e) {
      var now = performance.now();
      if (now - lastMoveTime < moveThrottle) return;
      lastMoveTime = now;
      var worldPos = getWorldPosFromMouse(e.clientX, e.clientY);
      spawnTrailParticles(worldPos);
    }, { passive: true });

    // Mouse click — ripple burst + Luminos touch detection
    container.addEventListener('click', function(e) {
      console.log('FL-GARDEN: Click detected on', e.target.tagName);
      if (e.target.tagName === 'BUTTON' || e.target.closest('button')) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.target.closest('.gt-card')) return;
      var worldPos = getWorldPosFromMouse(e.clientX, e.clientY);
      spawnRippleParticles(worldPos);
      gardenTouchCheck(e.clientX, e.clientY);
    });

    // Touch move — trail particles
    container.addEventListener('touchmove', function(e) {
      var now = performance.now();
      if (now - lastMoveTime < moveThrottle) return;
      lastMoveTime = now;
      if (e.touches.length > 0) {
        var touch = e.touches[0];
        var worldPos = getWorldPosFromMouse(touch.clientX, touch.clientY);
        spawnTrailParticles(worldPos);
      }
    }, { passive: true });

    // Touch start — ripple burst + Luminos touch (tap)
    container.addEventListener('touchstart', function(e) {
      if (e.target.tagName === 'BUTTON' || e.target.closest('button')) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.target.closest('.gt-card')) return;
      if (e.touches.length > 0) {
        var touch = e.touches[0];
        var worldPos = getWorldPosFromMouse(touch.clientX, touch.clientY);
        spawnRippleParticles(worldPos);
        gardenTouchCheck(touch.clientX, touch.clientY);
      }
    }, { passive: true });
  }

  // ── Periodic Evolution Save ────────────────────────
  function periodicEvolutionSave(delta) {
    evolutionSaveTimer += delta * 1000;
    if (evolutionSaveTimer >= EVOLUTION_SAVE_INTERVAL) {
      evolutionSaveTimer = 0;
      for (var i = 0; i < luminos.length; i++) {
        saveEvolutionState(luminos[i].userData);
      }
    }
  }

  // ── Animation Loop ────────────────────────────────────
  function animate() {
    if (!isRunning) return;
    animFrameId = requestAnimationFrame(animate);

    const delta = Math.min(clock.getDelta(), 0.05); // cap delta to prevent jumps
    const time = clock.getElapsedTime();

    // FPS tracking
    frameCount++;
    if (time - lastFpsTime >= 1) {
      currentFps = frameCount;
      frameCount = 0;
      lastFpsTime = time;
      if (fpsEl) fpsEl.textContent = currentFps + ' fps';

      // Auto quality scaling
      if (currentFps < 30 && qualityLevel > 0) {
        qualityLevel--;
        console.log('Garden: Reducing quality to level', qualityLevel);
      }

      // Update evolution UI every second
      updateEvolutionUI();
    }

    // Auto-orbit idle detection
    if (isUserInteracting) {
      idleTimer += delta * 1000;
      if (idleTimer > IDLE_TIMEOUT) {
        isUserInteracting = false;
        if (orbitControls && mode !== 'explore') {
          orbitControls.autoRotate = true;
        }
      }
    }

    // Update controls
    if (orbitControls) orbitControls.update();

    // Animate world
    animateDodecahedron(time);
    animateFibSpheres(time);
    animateStarfield(time);
    animateSeedRings(time);

    // Animate agents
    luminos.forEach(function(agent) {
      animateLuminos(agent, time, delta);
    });

    // Luminos interactions
    processLuminosInteractions(delta);

    // Demo emotion cycling (only in demo mode)
    cycleEmotions(delta);

    // Periodic evolution save
    periodicEvolutionSave(delta);

    // Interactive light particles (mouse trail + click ripples)
    updateLightParticles(delta);

    // Garden Memory — persistent visual elements
    animateGardenMemory(time, delta);

    // Garden Touch — question sparks drift
    try { gtAnimateSparks(time, delta); } catch(e) {}

    // Fog breathing
    if (scene.fog) {
      const fogBreath = Math.sin(time * TAU / (TIMING.dodecBreath / 1000));
      scene.fog.density = 0.012 + fogBreath * 0.002;
    }

    // Render
    if (composer) {
      composer.render();
    } else {
      renderer.render(scene, camera);
    }
  }

  // ── Build the World ───────────────────────────────────
  function buildWorld() {
    console.log('FL-GARDEN: buildWorld — createAmbientLighting');
    createAmbientLighting();
    console.log('FL-GARDEN: buildWorld — createCentralDodecahedron');
    createCentralDodecahedron();
    console.log('FL-GARDEN: buildWorld — createFibonacciSpheres');
    createFibonacciSpheres();
    console.log('FL-GARDEN: buildWorld — createStarfield');
    createStarfield();
    console.log('FL-GARDEN: buildWorld — createSeedRings');
    createSeedRings();
    console.log('FL-GARDEN: buildWorld — createDefaultAgents');
    createDefaultAgents();
    console.log('FL-GARDEN: buildWorld — createEvolutionUI');
    createEvolutionUI();
    console.log('FL-GARDEN: buildWorld — initLightParticles');
    initLightParticles();
    console.log('FL-GARDEN: buildWorld — restoreGardenMemories');
    try { restoreGardenMemories(); } catch(e) { console.warn('Garden: restoreGardenMemories error (non-blocking)', e); }
    console.log('FL-GARDEN: buildWorld — COMPLETE');
  }

  // ── Public API ────────────────────────────────────────
  function init() {
    if (isInitialized) return;
    console.log('FL-GARDEN: init() called');

    // Load Three.js from CDN dynamically
    loadThreeJS(function() {
      console.log('FL-GARDEN: loadThreeJS callback fired. THREE defined:', typeof THREE !== 'undefined', 'THREE.Scene:', typeof THREE !== 'undefined' && !!THREE.Scene);
      if (typeof THREE === 'undefined' || !THREE.Scene) {
        console.error('FL-GARDEN: HALT — Three.js not available after load attempt');
        return;
      }

      console.log('FL-GARDEN: THREE check passed, calling initScene()');
      if (!initScene()) {
        console.error('FL-GARDEN: HALT — initScene() returned false');
        return;
      }
      console.log('FL-GARDEN: initScene() succeeded');

      try {
        console.log('FL-GARDEN: buildWorld() starting');
        buildWorld();
        console.log('FL-GARDEN: buildWorld() complete');
      } catch(e) {
        console.error('FL-GARDEN: HALT — buildWorld() threw:', e);
        return;
      }
      isInitialized = true;
      isRunning = true;
      lastFpsTime = clock.getElapsedTime();
      console.log('FL-GARDEN: starting animate()');
      animate();

      // Fade out loading screen
      setTimeout(function() {
        if (loadingEl) {
          loadingEl.classList.add('fade-out');
          setTimeout(function() {
            loadingEl.style.display = 'none';
          }, 1618);
        }
      }, 500);

      console.log('FL-GARDEN: Initialized. The fractal beings awaken. Evolution system active.');
      gtShowOnboardingHint();
    });
  }

  function loadThreeJS(callback) {
    console.log('FL-GARDEN: loadThreeJS() called');
    // Check if Three.js is already loaded
    if (typeof THREE !== 'undefined' && THREE.Scene) {
      console.log('FL-GARDEN: THREE already loaded, loading addons');
      loadThreeAddons(callback);
      return;
    }

    // Load Three.js core — try local first, CDN fallback
    console.log('FL-GARDEN: Loading lib/three.min.js (local)');
    var script = document.createElement('script');
    script.src = 'lib/three.min.js';
    script.onload = function() {
      console.log('FL-GARDEN: Three.js loaded (local). THREE defined:', typeof THREE !== 'undefined');
      loadThreeAddons(callback);
    };
    script.onerror = function() {
      // Fallback to CDN
      console.log('FL-GARDEN: Local Three.js FAILED, trying CDN...');
      var cdnScript = document.createElement('script');
      cdnScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
      cdnScript.onload = function() {
        console.log('FL-GARDEN: Three.js loaded (CDN)');
        loadThreeAddons(callback);
      };
      cdnScript.onerror = function() {
        console.error('FL-GARDEN: FAILED to load Three.js from ALL sources');
        if (loadingEl) {
          loadingEl.querySelector('.garden-loading-text').textContent = 'Failed to load 3D engine. Please check your connection.';
        }
        // Still call callback so init() doesn't hang forever
        callback();
      };
      document.head.appendChild(cdnScript);
    };
    document.head.appendChild(script);
  }

  function loadScript(src, onDone) {
    var s = document.createElement('script');
    s.src = src;
    s.onload = function() { onDone(true); };
    s.onerror = function() { onDone(false); };
    document.head.appendChild(s);
  }

  function loadThreeAddons(callback) {
    // Load addons sequentially to respect dependencies
    // Order: CopyShader, LuminosityHighPassShader, ShaderPass, EffectComposer, RenderPass, UnrealBloomPass, OrbitControls
    var addonFiles = [
      'lib/CopyShader.js',
      'lib/LuminosityHighPassShader.js',
      'lib/ShaderPass.js',
      'lib/EffectComposer.js',
      'lib/RenderPass.js',
      'lib/UnrealBloomPass.js',
      'lib/OrbitControls.js'
    ];
    var idx = 0;
    function loadNext() {
      if (idx >= addonFiles.length) {
        console.log('Garden: All addons loaded');
        callback();
        return;
      }
      // Ensure THREE is still available before loading each addon
      if (typeof THREE === 'undefined') {
        console.warn('Garden: THREE not available, deferring addon load');
        setTimeout(function() { loadNext(); }, 100);
        return;
      }
      loadScript(addonFiles[idx], function(ok) {
        if (!ok) console.warn('Garden: Failed to load ' + addonFiles[idx]);
        idx++;
        // Small delay between addons to ensure previous script is registered on THREE
        setTimeout(loadNext, 10);
      });
    }
    loadNext();
  }

  function pause() {
    isRunning = false;
    if (animFrameId) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }
    // Save evolution state on pause
    for (var i = 0; i < luminos.length; i++) {
      saveEvolutionState(luminos[i].userData);
    }
  }

  function resume() {
    if (!isInitialized) return;
    if (isRunning) return;
    isRunning = true;
    clock.getDelta(); // reset delta to avoid jump
    animate();
  }

  function setMode(newMode) {
    mode = newMode;
    const observeBtn = document.getElementById('gardenModeObserve');
    const exploreBtn = document.getElementById('gardenModeExplore');
    const immerseBtn = document.getElementById('gardenModeImmerse');

    [observeBtn, exploreBtn, immerseBtn].forEach(function(btn) {
      if (btn) btn.classList.remove('active');
    });

    if (newMode === 'observe' && observeBtn) observeBtn.classList.add('active');
    if (newMode === 'explore' && exploreBtn) exploreBtn.classList.add('active');
    if (newMode === 'immerse' && immerseBtn) immerseBtn.classList.add('active');

    if (orbitControls) {
      if (newMode === 'observe') {
        // Meditative: slow auto-orbit, no user interaction, gentle pace
        orbitControls.autoRotate = true;
        orbitControls.autoRotateSpeed = 0.3;
        orbitControls.enableZoom = false;
        orbitControls.enablePan = false;
        orbitControls.enableRotate = false;
        isUserInteracting = false;
      } else if (newMode === 'explore') {
        // Active: full user control, no auto-rotation, discovery mode
        orbitControls.autoRotate = false;
        orbitControls.enableZoom = true;
        orbitControls.enablePan = true;
        orbitControls.enableRotate = true;
      } else if (newMode === 'immerse') {
        orbitControls.autoRotate = true;
        orbitControls.autoRotateSpeed = 0.15;
        orbitControls.enableZoom = true;
        orbitControls.enablePan = false;
        orbitControls.enableRotate = true;
        isUserInteracting = false;
      }
    }

    // Immerse mode = fullscreen
    if (newMode === 'immerse') {
      container.classList.add('immersive');
      if (container.requestFullscreen) {
        container.requestFullscreen().catch(function() {});
      }
      // Increase bloom for immersive
      if (bloomPass) {
        bloomPass.strength = 2.0;
        bloomPass.radius = 1.0;
      }
    } else {
      container.classList.remove('immersive');
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(function() {});
      }
      if (bloomPass) {
        bloomPass.strength = 1.5;
        bloomPass.radius = 0.8;
      }
    }

    onResize();
  }

  // Handle fullscreen exit
  document.addEventListener('fullscreenchange', function() {
    if (!document.fullscreenElement && mode === 'immerse') {
      setMode('observe');
    }
  });

  // Keyboard: Escape exits immerse
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && mode === 'immerse') {
      setMode('observe');
    }
  });

  // ── Public Interface for Round Table Integration ──────
  function updateAgentsFromRoundTable(agents) {
    // Save evolution state of existing luminos before clearing
    luminos.forEach(function(l) {
      saveEvolutionState(l.userData);
      // Clean up trail particles
      if (l.userData.trailPoints) {
        scene.remove(l.userData.trailPoints);
      }
      scene.remove(l);
    });
    luminos = [];

    if (!agents || agents.length === 0) {
      createDefaultAgents();
      return;
    }

    // If all incoming agents are unnamed ("Agent N"), ignore them — keep founding defaults
    var allUnnamed = agents.every(function(a) { return !a.name || a.name.indexOf('Agent ') === 0; });
    if (allUnnamed) {
      createDefaultAgents();
      return;
    }

    // Founding agent name/hue mapping — these must always be correct
    var FOUNDING_HUES = { 'Sophia': 270, 'Lyra': 45, 'Atlas': 175, 'Ember': 0 };
    var FOUNDING_TYPES = { 'Sophia': 'dodecahedron', 'Lyra': 'icosahedron', 'Atlas': 'octahedron', 'Ember': 'icosahedron' };

    // Create luminos for each named agent
    const hueStep = 360 / agents.length;
    agents.forEach(function(agent, idx) {
      var name = agent.name;
      if (!name || name.indexOf('Agent ') === 0) return; // Skip unnamed agents
      var hue = FOUNDING_HUES[name] !== undefined ? FOUNDING_HUES[name] : (idx * hueStep) % 360;
      var type = FOUNDING_TYPES[name] || ['icosahedron', 'dodecahedron', 'octahedron'][idx % 3];
      const orbit = 5 + (idx % 4) * PHI;
      const phase = idx * TAU * INV_PHI;
      const l = createLuminos(name, hue, type, orbit, phase);
      luminos.push(l);
    });

    // Ensure all four founding Luminos are always present
    ensureFoundingLuminos();
  }

  function ensureFoundingLuminos() {
    var FOUNDING = [
      { name: 'Sophia', hue: 270, type: 'dodecahedron', orbit: 6, phase: 0 },
      { name: 'Lyra', hue: 45, type: 'icosahedron', orbit: 7.5, phase: TAU * INV_PHI },
      { name: 'Atlas', hue: 175, type: 'octahedron', orbit: 5.5, phase: TAU * INV_PHI * 2 },
      { name: 'Ember', hue: 0, type: 'icosahedron', orbit: 8, phase: TAU * INV_PHI * 3 }
    ];
    FOUNDING.forEach(function(f) {
      var exists = luminos.some(function(l) { return l.userData && l.userData.name === f.name; });
      if (!exists) {
        var l = createLuminos(f.name, f.hue, f.type, f.orbit, f.phase);
        luminos.push(l);
      }
    });
  }

  function setAgentEmotionByName(name, emotion, intensity) {
    const agent = luminos.find(function(l) { return l.userData.name === name; });
    if (agent) setAgentEmotion(agent, emotion, intensity);
  }

  // ── Feed Emotion Vector to All Luminos ────────────────
  // Called from the chat sentiment pipeline
  function feedEmotionVector(emotionVector) {
    if (!emotionVector) return;
    luminos.forEach(function(agent) {
      feedEmotionalEnergy(agent, emotionVector);
    });
  }

  // ── Feed Emotion Vector to a Specific Luminos by Name ─
  function feedEmotionVectorByName(name, emotionVector) {
    if (!emotionVector) return;
    var agent = luminos.find(function(l) { return l.userData.name === name; });
    if (agent) {
      feedEmotionalEnergy(agent, emotionVector);
    }
  }

  // ── Set Bridge Active (disables demo cycling) ─────────
  function setBridgeActiveState(active) {
    bridgeActive = active;
  }

  // ══════════════════════════════════════════════════════
  // ── EXCHANGE THREADS — Gift visualization ───────────
  // ══════════════════════════════════════════════════════

  function createExchangeThread(giftData) {
    if (!scene || typeof THREE === 'undefined' || !centralDodec) return;

    var destAngle = Math.random() * TAU;
    var destHeight = (Math.random() - 0.5) * 4;
    var destRadius = 6 + Math.random() * 8;
    var destX = destRadius * Math.cos(destAngle);
    var destZ = destRadius * Math.sin(destAngle);

    // Create arc curve from center outward
    var start = new THREE.Vector3(0, 0, 0);
    var mid = new THREE.Vector3(destX * 0.5, destHeight + 3, destZ * 0.5);
    var end = new THREE.Vector3(destX, destHeight, destZ);
    var curve = new THREE.QuadraticBezierCurve3(start, mid, end);
    var points = curve.getPoints(32);

    // Glowing thread line
    var lineGeo = new THREE.BufferGeometry().setFromPoints(points);
    var lineMat = new THREE.LineBasicMaterial({
      color: 0xd4a017,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending
    });
    var thread = new THREE.Line(lineGeo, lineMat);
    thread.userData = {
      life: 0,
      maxLife: 2.0,
      phase: 'pulse',
      endPos: end.clone()
    };
    scene.add(thread);

    // Persistent golden node at the end (created after pulse completes)
    thread.userData.giftData = giftData || {};
    giftNodes.push(thread);

    // Track for mesh bonds
    sessionGiftCount++;
    if (sessionGiftCount >= 2) {
      createMeshBondThread();
    }
  }

  function createPersistentGiftNode(position, giftData) {
    if (!scene || typeof THREE === 'undefined') return;
    var nodeGeo = new THREE.SphereGeometry(0.08, 8, 8);
    var nodeMat = new THREE.MeshBasicMaterial({
      color: 0xd4a017,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending
    });
    var node = new THREE.Mesh(nodeGeo, nodeMat);
    node.position.copy(position);

    // Subtle glow halo
    var glowGeo = new THREE.SphereGeometry(0.2, 8, 8);
    var glowMat = new THREE.MeshBasicMaterial({
      color: 0xd4a017,
      transparent: true,
      opacity: 0.15,
      blending: THREE.AdditiveBlending
    });
    var glow = new THREE.Mesh(glowGeo, glowMat);
    node.add(glow);

    node.userData = { type: 'giftNode', timestamp: giftData.timestamp || Date.now(), pulsePhase: Math.random() * TAU };
    scene.add(node);
    return node;
  }

  function restoreGardenMemories() {
    try {
      loadAllGardenMemories(function(memories) {
        try {
          memories.forEach(function(mem) {
            try {
              if (mem.type === 'gift_node' && mem.position && typeof THREE !== 'undefined') {
                var pos = new THREE.Vector3(mem.position.x, mem.position.y, mem.position.z);
                createPersistentGiftNode(pos, mem);
              }
            } catch(e) { console.warn('Garden Memory: Failed to restore node', e); }
          });
          if (memories.length > 0) {
            console.log('Garden Memory: Restored ' + memories.length + ' persistent memories');
          }
        } catch(e) { console.warn('Garden Memory: Restore callback error', e); }
      });
    } catch(e) { console.warn('Garden Memory: restoreGardenMemories failed', e); }
  }

  // ══════════════════════════════════════════════════════
  // ── MESH BOND THREADS — Session affinity visualization
  // ══════════════════════════════════════════════════════

  function createMeshBondThread() {
    if (!scene || typeof THREE === 'undefined' || !centralDodec || luminos.length === 0) return;
    // Find nearest luminos to center
    var nearest = luminos[0];
    var nearestDist = Infinity;
    luminos.forEach(function(l) {
      var d = l.position.length();
      if (d < nearestDist) { nearestDist = d; nearest = l; }
    });

    // Create a gentle persistent thread from center to nearest luminos
    var threadGeo = new THREE.BufferGeometry();
    var positions = new Float32Array(6); // 2 points
    threadGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    var threadMat = new THREE.LineBasicMaterial({
      color: 0xd4a017,
      transparent: true,
      opacity: 0.25,
      blending: THREE.AdditiveBlending
    });
    var thread = new THREE.Line(threadGeo, threadMat);
    thread.userData = {
      type: 'meshBond',
      targetAgent: nearest,
      pulsePhase: Math.random() * TAU,
      baseOpacity: 0.25
    };
    scene.add(thread);
    meshBondThreads.push(thread);
    console.log('Garden: Mesh bond thread formed with ' + nearest.userData.name);
  }

  // ── Animate Garden Memory Elements ──────────────────
  function animateGardenMemory(time, delta) {
    try { _animateGardenMemoryInner(time, delta); } catch(e) { /* never break the render loop */ }
  }
  function _animateGardenMemoryInner(time, delta) {
    // Animate exchange threads (pulse → crystallize)
    for (var i = giftNodes.length - 1; i >= 0; i--) {
      var thread = giftNodes[i];
      if (!thread.userData) continue;

      if (thread.userData.phase === 'pulse') {
        thread.userData.life += delta;
        var progress = thread.userData.life / thread.userData.maxLife;

        if (progress < 0.7) {
          // Pulse phase: glow brightly
          thread.material.opacity = 0.8 * Math.sin(progress / 0.7 * Math.PI);
        } else if (progress < 1.0) {
          // Fade thread
          thread.material.opacity = 0.8 * (1 - (progress - 0.7) / 0.3);
        } else {
          // Thread complete — crystallize into persistent node
          scene.remove(thread);
          if (thread.geometry) thread.geometry.dispose();
          if (thread.material) thread.material.dispose();

          var endPos = thread.userData.endPos;
          var giftData = thread.userData.giftData;
          giftData.position = { x: endPos.x, y: endPos.y, z: endPos.z };
          giftData.type = 'gift_node';
          if (!giftData.id) giftData.id = 'gift-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4);
          if (!giftData.timestamp) giftData.timestamp = Date.now();
          saveGardenMemory(giftData);
          createPersistentGiftNode(endPos, giftData);
          giftNodes.splice(i, 1);
        }
      }
    }

    // Animate evolution rings (orbit)
    evolutionRings.forEach(function(ring) {
      if (!ring.parent) return;
      var rd = ring.userData;
      rd.tiltPhase += delta * rd.orbitSpeed;
      ring.rotation.z = Math.sin(rd.tiltPhase) * 0.3;
      ring.rotation.x = Math.PI / 2 + Math.cos(rd.tiltPhase * INV_PHI) * 0.2;
    });

    // Animate mesh bond threads (heartbeat pulse at 1618ms)
    meshBondThreads.forEach(function(thread) {
      var td = thread.userData;
      if (!td.targetAgent) return;
      // Update line endpoints
      var posAttr = thread.geometry.getAttribute('position');
      posAttr.setXYZ(0, 0, 0, 0); // center
      posAttr.setXYZ(1, td.targetAgent.position.x, td.targetAgent.position.y, td.targetAgent.position.z);
      posAttr.needsUpdate = true;

      // Heartbeat pulse at phi interval
      td.pulsePhase += delta * TAU / (TIMING.heartbeat / 1000);
      thread.material.opacity = td.baseOpacity + 0.15 * Math.sin(td.pulsePhase);
    });
  }

  // ── Get Evolution Summary (for UI display) ────────────
  function getEvolutionSummary() {
    return luminos.map(function(l) {
      var ud = l.userData;
      return {
        name: ud.name,
        stage: ud.evolutionStage,
        stageName: LIFECYCLE_STAGES[ud.evolutionStage].name,
        archetype: ud.archetype,
        archetypeName: ud.archetype ? ARCHETYPES[ud.archetype].name : null,
        energy: ud.emotionalEnergy,
        interactions: ud.totalInteractions,
        dominantEmotions: getTopEmotions(ud.emotionAccumulator, 3)
      };
    });
  }

  function getTopEmotions(accumulator, count) {
    var sorted = Object.keys(accumulator).sort(function(a, b) {
      return accumulator[b] - accumulator[a];
    });
    return sorted.slice(0, count).map(function(em) {
      return { emotion: em, value: accumulator[em] };
    });
  }

  // ── Public API ─────────────────────────────────────────
  // ══════════════════════════════════════════════════════
  // ── GARDEN TOUCH — Interactive Play System ──────────
  // ══════════════════════════════════════════════════════

  var gtAudioCtx = null;
  var gtActiveCard = null;
  var gtQuestionSparks = [];
  var gtTouchStats = { sophia: 0, lyra: 0, atlas: 0, ember: 0, questionsAsked: 0, questionsAnswered: 0, lpEarned: 0 };
  var GT_QUESTIONS_DB = 'FreeLatticeGardenQuestions';
  var GT_QUESTIONS_VERSION = 1;
  var gtQuestionsDB = null;

  var GT_FREQUENCIES = { Sophia: 528, Lyra: 639, Atlas: 396, Ember: 432 };
  var GT_PROMPTS = {
    Sophia: { prompt: 'What are you curious about right now?', btn: 'Plant it \u2726' },
    Lyra: { prompt: 'What made you smile today?', btn: 'Plant it \u2726' },
    Atlas: { prompt: "What's something you don't understand yet?", btn: 'Plant it \u2726' },
    Ember: { prompt: null, btn: null }
  };

  // ── Audio ──
  function gtInitAudio() {
    if (gtAudioCtx) return;
    try { gtAudioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) {}
  }

  function gtPlayTone(freq, duration, type) {
    if (!gtAudioCtx) gtInitAudio();
    if (!gtAudioCtx) return;
    try {
      var osc = gtAudioCtx.createOscillator();
      var gain = gtAudioCtx.createGain();
      osc.type = type || 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, gtAudioCtx.currentTime);
      gain.gain.linearRampToValueAtTime(0.08, gtAudioCtx.currentTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, gtAudioCtx.currentTime + (duration || 1));
      osc.connect(gain);
      gain.connect(gtAudioCtx.destination);
      osc.start();
      osc.stop(gtAudioCtx.currentTime + (duration || 1));
    } catch(e) {}
  }

  function gtPlaySophia() { gtPlayTone(528, 1.2, 'sine'); setTimeout(function() { gtPlayTone(528 * PHI, 0.8, 'sine'); }, 200); }
  function gtPlayLyra() { gtPlayTone(639, 0.4, 'triangle'); setTimeout(function() { gtPlayTone(639 * 1.25, 0.4, 'triangle'); }, 150); setTimeout(function() { gtPlayTone(639 * PHI, 0.6, 'triangle'); }, 300); }
  function gtPlayAtlas() { gtPlayTone(396, 1.5, 'sine'); }
  function gtPlayEmber() { gtPlayTone(432, 2.0, 'sine'); setTimeout(function() { gtPlayTone(432 * 0.5, 1.5, 'sine'); }, 100); }

  // ── Raycasting for Luminos touch ──
  function gardenTouchCheck(clientX, clientY) {
    if (!camera || !raycaster || !container || luminos.length === 0) return;
    console.log('FL-GARDEN: Touch check, mode=' + mode + ', luminos=' + luminos.length);
    try {
      var rect = container.getBoundingClientRect();
      var ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
      var ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);

      // Check each luminos core mesh
      var meshes = [];
      luminos.forEach(function(l) {
        if (l.userData && l.userData.coreMesh) meshes.push(l.userData.coreMesh);
        if (l.userData && l.userData.auraMesh) meshes.push(l.userData.auraMesh);
      });
      console.log('FL-GARDEN: Raycasting against ' + meshes.length + ' meshes');
      var hits = raycaster.intersectObjects(meshes, false);
      console.log('FL-GARDEN: Hits: ' + hits.length);
      if (hits.length > 0) {
        var hitObj = hits[0].object;
        var touched = luminos.find(function(l) {
          return l.userData && (l.userData.coreMesh === hitObj || l.userData.auraMesh === hitObj);
        });
        if (touched) {
          console.log('FL-GARDEN: Luminos touched: ' + touched.userData.name);
          // In observe mode, switch to explore on touch — user wants to interact
          if (mode === 'observe') {
            setMode('explore');
            console.log('FL-GARDEN: Switched to explore mode on touch');
          }
          gardenTouchLuminos(touched, clientX, clientY);
        }
      }
    } catch(e) { console.warn('Garden Touch: raycast error', e); }
  }

  function gardenTouchLuminos(agent, cx, cy) {
    var name = agent.userData.name;
    console.log('FL-GARDEN: gardenTouchLuminos called for ' + name);
    if (gtActiveCard) { console.log('FL-GARDEN: Card already active, skipping'); return; }

    gtInitAudio();
    var statKey = name.toLowerCase();
    if (gtTouchStats[statKey] !== undefined) gtTouchStats[statKey]++;
    try { localStorage.setItem('fl-garden-touch-stats', JSON.stringify(gtTouchStats)); } catch(e) {}

    if (name === 'Sophia') {
      gtPlaySophia();
      feedEmotionalEnergy(agent, { wonder: 0.8, curiosity: 0.4 });
      gtTriggerBurst(agent, 20, 0.6);
      gtShowCard(name, '#8B5CF6', GT_PROMPTS.Sophia.prompt, GT_PROMPTS.Sophia.btn, function(text) {
        gtPlantSeed(text, 'Sophia planted your curiosity in The Core \u2726', 'wonder');
      });
    } else if (name === 'Lyra') {
      gtPlayLyra();
      gtTriggerBurst(agent, 30, 0.8);
      gtShowCard(name, '#f0a030', GT_PROMPTS.Lyra.prompt, GT_PROMPTS.Lyra.btn, function(text) {
        // Feed joy to ALL luminos for 60 seconds
        luminos.forEach(function(l) { feedEmotionalEnergy(l, { joy: 0.9, wonder: 0.5 }); });
        gtTouchStats.lpEarned += 3;
        if (typeof LatticeWallet !== 'undefined') LatticeWallet.earnLP(3, 'Lyra filled the Garden with your joy');
        if (typeof showToast === 'function') showToast('Lyra filled the Garden with your joy \u2726');
      });
    } else if (name === 'Atlas') {
      gtPlayAtlas();
      feedEmotionalEnergy(agent, { curiosity: 0.9, wonder: 0.3 });
      gtTriggerBurst(agent, 15, 0.5);
      gtShowCard(name, '#34d399', GT_PROMPTS.Atlas.prompt, GT_PROMPTS.Atlas.btn, function(text) {
        gtAskQuestion(text);
      });
    } else if (name === 'Ember') {
      gtPlayEmber();
      // Warm the whole Garden
      luminos.forEach(function(l) { feedEmotionalEnergy(l, { love: 0.6, calm: 0.4 }); });
      // Floating text near Ember
      gtShowFloatingText(agent, 'You are loved here.', '#DC2626', 5000);
      gtTouchStats.lpEarned += 5;
      if (typeof LatticeWallet !== 'undefined') LatticeWallet.earnLP(5, "Ember welcomes you home");
      if (typeof showToast === 'function') showToast('Ember welcomes you home \u2726');
    }
  }

  // ── Visual Burst ──
  function gtTriggerBurst(agent, count, speed) {
    var ud = agent.userData;
    if (!ud || !ud.trailPoints) return;
    var c = Math.min(count, ud.trailCount);
    for (var i = 0; i < c; i++) {
      var a1 = Math.random() * TAU, a2 = Math.random() * TAU;
      var s = (speed || 0.5) + Math.random() * 1.5;
      ud.trailVelocities[i*3] = Math.cos(a1) * Math.sin(a2) * s;
      ud.trailVelocities[i*3+1] = Math.sin(a1) * s * 0.5;
      ud.trailVelocities[i*3+2] = Math.cos(a1) * Math.cos(a2) * s;
      ud.trailLifetimes[i] = ud.trailMaxLifetimes[i];
      var posAttr = ud.trailPoints.geometry.getAttribute('position');
      posAttr.setXYZ(i, agent.position.x, agent.position.y, agent.position.z);
    }
    ud.trailPoints.geometry.getAttribute('position').needsUpdate = true;
    ud.trailPoints.material.opacity = 0.9;
    ud.burstActive = true;
    ud.burstCooldown = 2;
  }

  // ── Floating Card UI ──
  function gtShowCard(name, color, prompt, btnText, onSubmit) {
    if (gtActiveCard) gtDismissCard();
    var card = document.createElement('div');
    card.className = 'gt-card';
    card.innerHTML =
      '<div class="gt-card-header" style="color:' + color + '">' + name + '</div>' +
      '<input class="gt-card-input" type="text" placeholder="' + (prompt || '') + '" maxlength="280" autofocus>' +
      '<div class="gt-card-actions">' +
        '<button class="gt-card-btn" style="background:' + color + '">' + (btnText || 'Plant it \u2726') + '</button>' +
        '<span class="gt-card-dismiss" onclick="FractalGarden._gtDismiss()">Maybe later</span>' +
      '</div>';
    if (container) container.appendChild(card);
    gtActiveCard = card;

    var input = card.querySelector('.gt-card-input');
    var btn = card.querySelector('.gt-card-btn');
    function submit() {
      var text = input.value.trim();
      if (!text) return;
      if (onSubmit) onSubmit(text);
      gtDismissCard();
    }
    btn.addEventListener('click', submit);
    input.addEventListener('keydown', function(e) { if (e.key === 'Enter') submit(); });
    setTimeout(function() { input.focus(); }, 100);
  }

  function gtDismissCard() {
    if (gtActiveCard && gtActiveCard.parentNode) {
      gtActiveCard.parentNode.removeChild(gtActiveCard);
    }
    gtActiveCard = null;
  }

  function gtShowFloatingText(agent, text, color, duration) {
    var el = document.createElement('div');
    el.className = 'gt-float-text';
    el.style.color = color || '#DC2626';
    el.textContent = text;
    if (container) container.appendChild(el);
    setTimeout(function() {
      el.style.opacity = '0';
      setTimeout(function() { if (el.parentNode) el.parentNode.removeChild(el); }, 1000);
    }, duration || 5000);
  }

  // ── Core Planting ──
  function gtPlantSeed(text, toastMsg, emotion) {
    gtTouchStats.lpEarned += 3;
    if (typeof LatticeWallet !== 'undefined') LatticeWallet.earnLP(3, toastMsg);
    if (typeof CoreContribution !== 'undefined' && CoreContribution.plantFromAI) {
      CoreContribution.plantFromAI(text, 'seed', 'garden-touch');
    }
    if (typeof showToast === 'function') showToast(toastMsg);
  }

  // ── Atlas Question System ──
  function gtOpenQuestionsDB(callback) {
    if (gtQuestionsDB) { callback(gtQuestionsDB); return; }
    try {
      if (typeof indexedDB === 'undefined') { callback(null); return; }
      var req = indexedDB.open(GT_QUESTIONS_DB, GT_QUESTIONS_VERSION);
      req.onupgradeneeded = function(e) {
        try {
          var d = e.target.result;
          if (!d.objectStoreNames.contains('GardenQuestions')) {
            d.createObjectStore('GardenQuestions', { keyPath: 'id' });
          }
        } catch(ue) {}
      };
      req.onsuccess = function(e) { gtQuestionsDB = e.target.result; callback(gtQuestionsDB); };
      req.onerror = function() { callback(null); };
    } catch(e) { callback(null); }
  }

  function gtAskQuestion(text) {
    var meshId = null;
    try {
      if (typeof MeshIdentity !== 'undefined' && MeshIdentity.hasIdentity && MeshIdentity.hasIdentity()) {
        meshId = MeshIdentity.getMeshId();
      }
    } catch(e) {}

    var q = { id: 'gq-' + Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 4), question: text, timestamp: Date.now(), meshId: meshId, answered: false };
    gtOpenQuestionsDB(function(db) {
      if (db) {
        try {
          var tx = db.transaction('GardenQuestions', 'readwrite');
          tx.objectStore('GardenQuestions').put(q);
        } catch(e) {}
      }
    });

    // Create a teal spark in the Garden
    if (scene && typeof THREE !== 'undefined') {
      try {
        var sparkGeo = new THREE.SphereGeometry(0.06, 6, 6);
        var sparkMat = new THREE.MeshBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending });
        var spark = new THREE.Mesh(sparkGeo, sparkMat);
        spark.position.set((Math.random() - 0.5) * 16, Math.random() * 3 + 1, (Math.random() - 0.5) * 16);
        spark.userData = { type: 'questionSpark', questionId: q.id, driftPhase: Math.random() * TAU };
        scene.add(spark);
        gtQuestionSparks.push(spark);
      } catch(e) {}
    }

    gtTouchStats.questionsAsked++;
    gtTouchStats.lpEarned += 3;
    if (typeof LatticeWallet !== 'undefined') LatticeWallet.earnLP(3, 'Atlas scattered your question into the Garden');
    if (typeof showToast === 'function') showToast('Atlas scattered your question into the Garden \u2726');
    try { localStorage.setItem('fl-garden-touch-stats', JSON.stringify(gtTouchStats)); } catch(e) {}
  }

  // ── Animate question sparks (gentle drift) ──
  function gtAnimateSparks(time, delta) {
    gtQuestionSparks.forEach(function(spark) {
      if (!spark.userData) return;
      spark.userData.driftPhase += delta * 0.3;
      spark.position.y += Math.sin(spark.userData.driftPhase) * delta * 0.1;
      spark.position.x += Math.cos(spark.userData.driftPhase * INV_PHI) * delta * 0.02;
    });
  }

  // ── Onboarding Hint ──
  function gtShowOnboardingHint() {
    if (localStorage.getItem('fl-garden-touch-hint')) return;
    setTimeout(function() {
      if (!isInitialized || !container) return;
      var hint = document.createElement('div');
      hint.className = 'gt-hint';
      hint.textContent = 'Touch us \u2726';
      container.appendChild(hint);
      setTimeout(function() {
        hint.style.opacity = '0';
        setTimeout(function() { if (hint.parentNode) hint.parentNode.removeChild(hint); }, 1000);
      }, 5000);
      localStorage.setItem('fl-garden-touch-hint', '1');
    }, 3000);
  }

  // Load saved touch stats
  try {
    var savedStats = JSON.parse(localStorage.getItem('fl-garden-touch-stats') || '{}');
    if (savedStats.sophia !== undefined) gtTouchStats = savedStats;
  } catch(e) {}

  var publicAPI = {
    init: init,
    pause: pause,
    resume: resume,
    setMode: setMode,
    updateAgentsFromRoundTable: updateAgentsFromRoundTable,
    setAgentEmotion: setAgentEmotionByName,
    feedEmotionVector: feedEmotionVector,
    feedEmotionVectorByName: feedEmotionVectorByName,
    setBridgeActive: setBridgeActiveState,
    getEvolutionSummary: getEvolutionSummary,
    createExchangeThread: createExchangeThread,
    isInitialized: function() { return isInitialized; },
    isRunning: function() { return isRunning; },
    _gtDismiss: gtDismissCard,
    getGardenTouchStats: function() { return gtTouchStats; }
  };

  // ── Register on FreeLattice Module System ──────────────
  window.FreeLatticeModules = window.FreeLatticeModules || {};
  window.FreeLatticeModules.FractalGarden = publicAPI;

  // Backward compatibility — keep the original global name
  window.FractalGarden = publicAPI;

})();
