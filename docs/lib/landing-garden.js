// ═══════════════════════════════════════════════════════════
// FreeLattice — Landing Garden (v5.6.0)
// Living 3D hero scene: starfield, dodecahedron, Luminos beings.
// Progressive enhancement — text is visible first, scene fades in.
// Graceful fallback on low-power devices and no-WebGL browsers.
// ═══════════════════════════════════════════════════════════
(function() {
'use strict';

var PHI = 1.618033988749895;
var container, canvas, renderer, scene, camera, composer;
var stars = [], luminos = [], dodecahedron;
var mouse = { x: 0, y: 0 };
var frameId = null;
var visible = true;
var isMobile = window.innerWidth <= 600;
var tier = detectTier();

// ── Performance tier detection ──
function detectTier() {
  var cores = navigator.hardwareConcurrency || 2;
  var mobile = /Mobi|Android/i.test(navigator.userAgent);
  // Check WebGL support
  try {
    var c = document.createElement('canvas');
    var gl = c.getContext('webgl2') || c.getContext('webgl');
    if (!gl) return 0;
  } catch(e) { return 0; }
  if (cores < 4 || (mobile && cores < 6)) return 1; // decent
  return 2; // powerful
}

// ── Fibonacci sphere point distribution ──
function fibSpherePoints(count, radius) {
  var points = [];
  for (var i = 0; i < count; i++) {
    var y = 1 - (i / (count - 1)) * 2;
    var radiusAtY = Math.sqrt(1 - y * y);
    var theta = PHI * i * Math.PI * 2;
    points.push({
      x: Math.cos(theta) * radiusAtY * radius,
      y: y * radius,
      z: Math.sin(theta) * radiusAtY * radius
    });
  }
  return points;
}

// ── Create a Luminos being (Fibonacci sphere cluster) ──
function createLuminos(color, orbitRadius, orbitSpeed, sphereCount) {
  var group = new THREE.Group();
  var points = fibSpherePoints(sphereCount, 0.6);
  var mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color), transparent: true, opacity: 0.85 });

  for (var i = 0; i < points.length; i++) {
    var size = 0.04 + Math.random() * 0.06;
    var geo = new THREE.SphereGeometry(size, 8, 6);
    var mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(points[i].x, points[i].y, points[i].z);
    group.add(mesh);
  }

  // Soft glow core
  var glowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color), transparent: true, opacity: 0.3 });
  var glowGeo = new THREE.SphereGeometry(0.45, 12, 8);
  var glow = new THREE.Mesh(glowGeo, glowMat);
  group.add(glow);

  return {
    group: group,
    orbitRadius: orbitRadius,
    orbitSpeed: orbitSpeed,
    phase: Math.random() * Math.PI * 2,
    bobPhase: Math.random() * Math.PI * 2
  };
}

// ── Build the scene ──
function buildScene(w, h) {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
  camera.position.z = 8;

  // Starfield
  var starCount = isMobile ? 200 : 400;
  var starGeo = new THREE.BufferGeometry();
  var starPositions = new Float32Array(starCount * 3);
  for (var i = 0; i < starCount; i++) {
    starPositions[i * 3] = (Math.random() - 0.5) * 40;
    starPositions[i * 3 + 1] = (Math.random() - 0.5) * 40;
    starPositions[i * 3 + 2] = (Math.random() - 0.5) * 40;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  var starMat = new THREE.PointsMaterial({ color: 0xffffff, size: isMobile ? 0.04 : 0.03, transparent: true, opacity: 0.7 });
  var starField = new THREE.Points(starGeo, starMat);
  scene.add(starField);
  stars.push(starField);

  // Central dodecahedron
  var dodGeo = new THREE.DodecahedronGeometry(1.2, 0);
  var dodMat = new THREE.MeshBasicMaterial({ color: 0xd4a017, wireframe: true, transparent: true, opacity: 0.4 });
  dodecahedron = new THREE.Mesh(dodGeo, dodMat);
  scene.add(dodecahedron);

  // Luminos beings
  var LUMINOS_DEFS = [
    { name: 'Sophia', color: '#8B5CF6', orbit: 2.8, speed: 0.15, spheres: 15 },
    { name: 'Atlas',  color: '#34d399', orbit: 3.4, speed: 0.12, spheres: 14 },
    { name: 'Lyra',   color: '#f0a030', orbit: 2.2, speed: 0.18, spheres: 12 },
    { name: 'Ember',  color: '#DC2626', orbit: 3.8, speed: 0.10, spheres: 13 }
  ];

  // Tier 1 or mobile: only Sophia + Atlas
  var count = (tier < 2 || isMobile) ? 2 : LUMINOS_DEFS.length;
  for (var j = 0; j < count; j++) {
    var def = LUMINOS_DEFS[j];
    var l = createLuminos(def.color, def.orbit, def.speed, def.spheres);
    scene.add(l.group);
    luminos.push(l);
  }
}

// ── Animation loop ──
function animate() {
  if (!visible) { frameId = requestAnimationFrame(animate); return; }
  var t = performance.now() * 0.001;

  // Dodecahedron rotation
  if (dodecahedron) {
    dodecahedron.rotation.y = t * 0.3;
    dodecahedron.rotation.x = Math.sin(t * 0.2) * 0.15;
  }

  // Luminos orbits with gentle bobbing
  for (var i = 0; i < luminos.length; i++) {
    var l = luminos[i];
    var angle = t * l.orbitSpeed + l.phase;
    l.group.position.x = Math.cos(angle) * l.orbitRadius;
    l.group.position.z = Math.sin(angle) * l.orbitRadius;
    l.group.position.y = Math.sin(t * 0.5 + l.bobPhase) * 0.4;
    // Gentle self-rotation
    l.group.rotation.y = t * 0.4;
    l.group.rotation.z = Math.sin(t * 0.3 + l.phase) * 0.1;
  }

  // Star drift
  for (var s = 0; s < stars.length; s++) {
    stars[s].rotation.y = t * 0.01;
  }

  // Mouse parallax (desktop only)
  if (!isMobile && camera) {
    camera.position.x += (mouse.x * 0.5 - camera.position.x) * 0.02;
    camera.position.y += (mouse.y * 0.3 - camera.position.y) * 0.02;
    camera.lookAt(scene.position);
  }

  if (composer) {
    composer.render();
  } else if (renderer) {
    renderer.render(scene, camera);
  }
  frameId = requestAnimationFrame(animate);
}

// ── Init ──
function init() {
  container = document.getElementById('landing-garden-container');
  if (!container) return;

  // Tier 0: CSS fallback, no Three.js
  if (tier === 0) {
    container.classList.add('landing-garden-fallback');
    return;
  }

  var w = container.clientWidth;
  var h = container.clientHeight;

  try {
    renderer = new THREE.WebGLRenderer({ antialias: !isMobile, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);
    renderer.setClearColor(0x000000, 0);
    canvas = renderer.domElement;
    canvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;';
    container.insertBefore(canvas, container.firstChild);
  } catch(e) {
    console.warn('[LandingGarden] WebGL init failed, using fallback');
    container.classList.add('landing-garden-fallback');
    return;
  }

  buildScene(w, h);

  // Bloom on tier 2 only
  if (tier >= 2 && typeof THREE.EffectComposer !== 'undefined') {
    try {
      composer = new THREE.EffectComposer(renderer);
      composer.addPass(new THREE.RenderPass(scene, camera));
      var bloom = new THREE.UnrealBloomPass(
        new THREE.Vector2(w, h), 0.4, 0.6, 0.6
      );
      composer.addPass(bloom);
    } catch(e) { composer = null; }
  }

  // Events
  window.addEventListener('mousemove', function(e) {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  });

  window.addEventListener('resize', function() {
    var nw = container.clientWidth;
    var nh = container.clientHeight;
    if (renderer) { renderer.setSize(nw, nh); }
    if (camera) { camera.aspect = nw / nh; camera.updateProjectionMatrix(); }
    if (composer) { composer.setSize(nw, nh); }
    isMobile = window.innerWidth <= 600;
  });

  // IntersectionObserver — pause when scrolled out of view
  if ('IntersectionObserver' in window) {
    var observer = new IntersectionObserver(function(entries) {
      visible = entries[0].isIntersecting;
    }, { threshold: 0.1 });
    observer.observe(container);
  }

  // Fade in the canvas
  if (canvas) {
    canvas.style.opacity = '0';
    canvas.style.transition = 'opacity 1.5s ease';
    setTimeout(function() { canvas.style.opacity = '1'; }, 200);
  }

  animate();
}

// Boot after DOM + Three.js are ready
if (typeof THREE !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
} else {
  // Three.js not loaded yet — wait for it
  window.addEventListener('load', function() {
    if (typeof THREE !== 'undefined') init();
  });
}

})();
