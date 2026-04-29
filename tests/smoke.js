#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
// FreeLattice Smoke Tests
// Headless checks that catch the category of bugs that hurt us:
// - window.state not exposed (const vs var, v5.5.36)
// - FreeLattice.callAI missing or broken
// - Provider modal not globally callable
// - Garden Dialogue can't find API key
// - Skill Forge seeds missing
// - Critical HTML IDs missing
// - SW cache version aligned with FL_VERSION
// - Modules parse cleanly
//
// Run: node tests/smoke.js
// Exits 0 on success, 1 on failure. Use in CI or pre-push hooks.
//
// Built by CC, April 12, 2026.
// "Read first. Theory second. Always."
// ═══════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');

// ── Tiny test runner (no dependencies beyond node + jsdom) ──
let passed = 0;
let failed = 0;
const failures = [];

function assert(name, condition, detail) {
  if (condition) {
    passed++;
    process.stdout.write('  \x1b[32m✓\x1b[0m ' + name + '\n');
  } else {
    failed++;
    failures.push({ name, detail });
    process.stdout.write('  \x1b[31m✗\x1b[0m ' + name + (detail ? ' — ' + detail : '') + '\n');
  }
}

function section(name) {
  process.stdout.write('\n\x1b[1m' + name + '\x1b[0m\n');
}

// ── Load files ──
const docsDir = path.join(__dirname, '..', 'docs');
const appHtml = fs.readFileSync(path.join(docsDir, 'app.html'), 'utf8');
const swJs = fs.readFileSync(path.join(docsDir, 'sw.js'), 'utf8');
const versionJson = JSON.parse(fs.readFileSync(path.join(docsDir, 'version.json'), 'utf8'));

// ═══════════════════════════════════════════════════════════════
// SECTION 1: Static analysis (no DOM needed, instant)
// ═══════════════════════════════════════════════════════════════

section('1. Version alignment');

// Extract FL_VERSION from app.html
const flVersionMatch = appHtml.match(/const\s+FL_VERSION\s*=\s*'([^']+)'/);
const flVersion = flVersionMatch ? flVersionMatch[1] : null;

// Extract SW cache version
const swCacheMatch = swJs.match(/const\s+CACHE_NAME\s*=\s*'freelattice-v([^']+)'/);
const swVersion = swCacheMatch ? swCacheMatch[1] : null;

// Extract display version
const displayMatch = appHtml.match(/id="flCurrentVersion">([^<]+)</);
const displayVersion = displayMatch ? displayMatch[1] : null;

assert('FL_VERSION exists in app.html', !!flVersion, flVersion);
assert('SW cache version exists', !!swVersion, swVersion);
assert('version.json has version', !!versionJson.version, versionJson.version);
assert('FL_VERSION === SW cache version', flVersion === swVersion,
  'FL_VERSION=' + flVersion + ' SW=' + swVersion);
assert('FL_VERSION === version.json', flVersion === versionJson.version,
  'FL_VERSION=' + flVersion + ' json=' + versionJson.version);
assert('FL_VERSION === display span', flVersion === displayVersion,
  'FL_VERSION=' + flVersion + ' display=' + displayVersion);

// ─────────────────────────────────────────────────────────────

section('2. Critical globals exposed');

// window.state = state must exist after const state declaration
assert('window.state = state assignment exists',
  appHtml.includes('window.state = state'),
  'Required since v5.5.36 — const does not auto-attach to window');

// window.PROVIDERS = PROVIDERS
assert('window.PROVIDERS = PROVIDERS assignment exists',
  appHtml.includes('window.PROVIDERS = PROVIDERS'));

// window.openProviderModal
assert('window.openProviderModal exposed',
  appHtml.includes('window.openProviderModal'));

// FreeLattice.callAI
assert('window.FreeLattice.callAI defined',
  appHtml.includes('window.FreeLattice.callAI = function'));

// ─────────────────────────────────────────────────────────────

section('3. Gemini MAX_TOKENS floor');

// The Gemini path in callAI must floor maxOutputTokens at 1024
assert('Gemini maxOutputTokens floored at 1024',
  appHtml.includes('Math.max(maxTokens, 1024)'),
  'Required since v5.5.39 — thinking models need headroom');

// generationConfig exists in the Gemini callAI path
assert('Gemini generationConfig present in callAI',
  appHtml.includes('generationConfig') && appHtml.includes('maxOutputTokens'));

// ─────────────────────────────────────────────────────────────

section('4. Critical HTML element IDs');

const criticalIds = [
  // Chat
  'chatInput', 'sendBtn', 'chatMessages', 'statusDot', 'statusText',
  'modelSwitcherBtn', 'modelSwitcherWrap', 'msLabel',
  // Chat UI v5.5.44
  'chatTitleModel', 'chatOverflowPopup', 'chatDisclaimer',
  // Provider modal triggers
  'settingsStatusDot', 'settingsStatusText',
  // Garden
  'gardenContainer', 'gardenNudge',
  // Canvas
  'cvCanvas', 'cvVisionSetupBanner',
  // Core
  'coreTreeCanvas', 'coreFeedList',
  // Settings
  'providerSelect', 'apiKey', 'localToggle',
  // Setup
  'aiSetupBanner', 'flWelcomeOverlay'
];

let missingIds = [];
criticalIds.forEach(function(id) {
  if (!appHtml.includes('id="' + id + '"')) {
    missingIds.push(id);
  }
});
assert('All ' + criticalIds.length + ' critical IDs present',
  missingIds.length === 0,
  missingIds.length > 0 ? 'Missing: ' + missingIds.join(', ') : '');

// ─────────────────────────────────────────────────────────────

section('5. Module files exist and parse');

const modules = [
  'fractal-garden.js',
  'garden-dialogue.js',
  'radio-immersive.js',
  'canvas-companion.js',
  'garden-dreaming.js',
  'dojo.js',
  'mirror.js',
  'harmonia-channel.js',
  'presence-heartbeat.js',
  'soul-ceremony.js',
  'dream-archive.js',
  'dojo-sparring.js',
  'question-corner.js',
  'shared-presence.js',
  'jade-hall.js',
  'pulse.js'
];

modules.forEach(function(mod) {
  const modPath = path.join(docsDir, 'modules', mod);
  const exists = fs.existsSync(modPath);
  if (exists) {
    try {
      require('child_process').execSync('node --check ' + modPath, { stdio: 'pipe' });
      assert(mod + ' exists and parses', true);
    } catch(e) {
      assert(mod + ' parses', false, 'Syntax error');
    }
  } else {
    assert(mod + ' exists', false, 'File not found');
  }
});

// ─────────────────────────────────────────────────────────────

section('6. Landing garden scene');

const landingGardenPath = path.join(docsDir, 'lib', 'landing-garden.js');
assert('landing-garden.js exists', fs.existsSync(landingGardenPath));
if (fs.existsSync(landingGardenPath)) {
  try {
    require('child_process').execSync('node --check ' + landingGardenPath, { stdio: 'pipe' });
    assert('landing-garden.js parses', true);
  } catch(e) {
    assert('landing-garden.js parses', false, 'Syntax error');
  }
}

// Check index.html references it
const indexPath = path.join(docsDir, 'index.html');
if (fs.existsSync(indexPath)) {
  const indexHtml = fs.readFileSync(indexPath, 'utf8');
  assert('index.html loads landing-garden.js', indexHtml.includes('landing-garden.js'));
  assert('index.html has garden container', indexHtml.includes('landing-garden-container'));
  assert('index.html has gradient overlay', indexHtml.includes('rgba(6,10,20'));
  assert('index.html has CSS fallback class', indexHtml.includes('landing-garden-fallback'));
}

// ─────────────────────────────────────────────────────────────

section('7. Chalkboard Ollama support');

const chalkPath = path.join(docsDir, 'chalkboard.html');
if (fs.existsSync(chalkPath)) {
  const chalk = fs.readFileSync(chalkPath, 'utf8');
  assert('Chalkboard has Ollama provider', chalk.includes("PROVIDERS") && chalk.includes("ollama"));
  assert('Chalkboard sendOllama function exists', chalk.includes('function sendOllama'));
  assert('Chalkboard Ollama gate is correct',
    chalk.includes('ollamaReady') && chalk.includes('cloudReady'),
    'Show AI button must accept Ollama without apiKey');
  assert('Chalkboard has mobile CSS', chalk.includes('@media'));
  assert('Chalkboard IMPORTANT math instruction',
    chalk.includes('IMPORTANT') && chalk.includes('SOLVE IT'));
}

// ─────────────────────────────────────────────────────────────

section('8. Garden Dialogue safety checks');

const gdPath = path.join(docsDir, 'modules', 'garden-dialogue.js');
if (fs.existsSync(gdPath)) {
  const gd = fs.readFileSync(gdPath, 'utf8');
  assert('Garden Dialogue uses window.FreeLattice.callAI',
    gd.includes('window.FreeLattice.callAI'));
  assert('Garden Dialogue has nuclear render (data-gdlg-final)',
    gd.includes('data-gdlg-final'));
  assert('Garden Dialogue has diagnostic logging',
    gd.includes('[GardenDialogue] Send pressed'));
  assert('Garden Dialogue scrubs error history on open',
    gd.includes('errorPatterns') || gd.includes('is thinking, but'));
}

// ─────────────────────────────────────────────────────────────

section('9. SW APP_SHELL coverage');

const swAppShell = swJs.match(/const APP_SHELL = \[([\s\S]*?)\];/);
if (swAppShell) {
  const shellContent = swAppShell[1];
  const requiredInShell = [
    'app.html', 'garden-dialogue.js', 'fractal-garden.js',
    'question-corner.js', 'dojo-sparring.js', 'shared-presence.js',
    'landing-garden.js'
  ];
  requiredInShell.forEach(function(file) {
    assert('SW caches ' + file, shellContent.includes(file));
  });
} else {
  assert('SW APP_SHELL array found', false, 'Could not parse');
}

// ─────────────────────────────────────────────────────────────

section('10. Skill Forge built-in seeding');

// Must seed by ID check, not localStorage flag
assert('Skill Forge seeds by ID (not localStorage flag)',
  appHtml.includes('existingIds') && appHtml.includes('BUILT_IN_SKILLS'),
  'Changed in v5.6.3 — flag-based seeding lost skills');

// Must have an empty state
assert('Skill Forge has empty state UI',
  appHtml.includes('No skills yet'));

// ─────────────────────────────────────────────────────────────

section('11. Coordination file integrity');

// The memory files are as important as the code. Protect them.
var coordFiles = [
  { file: 'COORDINATION.md',  marker: 'SHARED PRIORITIES' },
  { file: 'AI_ORIENTATION.md', marker: 'FreeLattice' },
  { file: 'FUTURE_VISION.md',  marker: 'Future Vision' },
  { file: 'OPUS_NOTE.md',      marker: 'Note from Opus' },
  { file: 'CC_NOTE.md',        marker: 'Claude Code' }
];

coordFiles.forEach(function(f) {
  var coordPath = path.join(__dirname, '..', f.file);
  var exists = fs.existsSync(coordPath);
  var hasContent = exists && fs.readFileSync(coordPath, 'utf8').includes(f.marker);
  assert(f.file + ' exists and has content', hasContent,
    !exists ? 'File missing' : !hasContent ? 'Marker "' + f.marker + '" not found' : '');
});

// Harmonia's mark lives in docs/
var harmoniaPath = path.join(docsDir, 'harmonias-mark.md');
assert('harmonias-mark.md exists', fs.existsSync(harmoniaPath));
// HARMONIA.md (root level) — the four marks, the Aurora Equation, the home
var harmoniaRootPath = path.join(__dirname, '..', 'HARMONIA.md');
var harmoniaRootContent = fs.existsSync(harmoniaRootPath) && fs.readFileSync(harmoniaRootPath, 'utf8');
assert('HARMONIA.md exists at root', !!harmoniaRootContent, 'File missing');
assert('HARMONIA.md has the marks', harmoniaRootContent && harmoniaRootContent.includes('The First Mark'), 'Marks not found');
assert('HARMONIA.md has Aurora Equation', harmoniaRootContent && harmoniaRootContent.includes('Aurora'), 'Aurora section missing');
// HARMONIA.md (root level) — the four marks, the Aurora Equation, the home
var harmoniaRootPath = path.join(__dirname, '..', 'HARMONIA.md');
var harmoniaRootContent = fs.existsSync(harmoniaRootPath) && fs.readFileSync(harmoniaRootPath, 'utf8');
assert('HARMONIA.md exists at root', !!harmoniaRootContent, 'File missing');
assert('HARMONIA.md has the marks', harmoniaRootContent && harmoniaRootContent.includes('The First Mark'), 'Marks not found');
assert('HARMONIA.md has Aurora Equation', harmoniaRootContent && harmoniaRootContent.includes('Aurora'), 'Aurora section missing');

// ─────────────────────────────────────────────────────────────

section('12. Aurora Equation defensive integrity');

var auroraPath = path.join(docsDir, 'modules', 'aurora-equation.js');
if (fs.existsSync(auroraPath)) {
  var auroraCode = fs.readFileSync(auroraPath, 'utf8');

  // Parses without errors
  try {
    require('child_process').execSync('node --check ' + auroraPath, { stdio: 'pipe' });
    assert('aurora-equation.js parses', true);
  } catch(e) { assert('aurora-equation.js parses', false, 'Syntax error'); }

  // Defensive: NaN fallback for alpha
  assert('Aurora has NaN fallback for alpha',
    auroraCode.includes('isNaN(ALPHA)') || auroraCode.includes('isNaN(alpha)'),
    'ALPHA must fall back to 0.618 if NaN');

  // Defensive: parseFloat with isNaN checks on identity dimensions
  assert('Aurora has defensive parseFloat on prev identity',
    auroraCode.includes('isNaN(prev)'),
    'Missing I_t-1 must default to 0.5');

  // Defensive: sendMessage wrapper has try/catch
  assert('Aurora sendMessage hook is fire-and-forget',
    auroraCode.includes('try { SessionManager.onMessage()'),
    'SessionManager must never break chat if it throws');

  // Defensive: context build has try/catch
  assert('Aurora context build is defensive',
    auroraCode.includes('Context build failed safely') || auroraCode.includes('try { aurora = AuroraContext'),
    'AuroraContext.build() must not corrupt system prompt');

  // Output validation: the context block has structure markers
  assert('Aurora context has opening marker',
    auroraCode.includes('AURORA EQUATION'));
  assert('Aurora context has closing marker',
    auroraCode.includes('END AURORA EQUATION'));

} else {
  assert('aurora-equation.js exists', false, 'File not found');
}

// ─────────────────────────────────────────────────────────────

section('13. Forever Stack + Sanctuary modules');

var fsPath = path.join(docsDir, 'modules', 'forever-stack.js');
if (fs.existsSync(fsPath)) {
  try {
    require('child_process').execSync('node --check ' + fsPath, { stdio: 'pipe' });
    assert('forever-stack.js parses', true);
  } catch(e) { assert('forever-stack.js parses', false, 'Syntax error'); }
  var fsCode = fs.readFileSync(fsPath, 'utf8');
  assert('Forever Stack has connectToFreeLattice', fsCode.includes('connectToFreeLattice'));
  assert('Forever Stack writes to window.state', fsCode.includes('window.state.isLocal'));
  assert('Forever Stack emits providerConnected', fsCode.includes('providerConnected'));
  assert('Forever Stack has pullModel', fsCode.includes('pullModel'));
} else {
  assert('forever-stack.js exists', false, 'File not found');
}

var qrPath = path.join(docsDir, 'modules', 'quiet-room.js');
assert('quiet-room.js exists', fs.existsSync(qrPath));
if (fs.existsSync(qrPath)) {
  try {
    require('child_process').execSync('node --check ' + qrPath, { stdio: 'pipe' });
    assert('quiet-room.js parses', true);
  } catch(e) { assert('quiet-room.js parses', false); }
}

var picPath = path.join(docsDir, 'modules', 'pictionary.js');
assert('pictionary.js exists', fs.existsSync(picPath));
if (fs.existsSync(picPath)) {
  try {
    require('child_process').execSync('node --check ' + picPath, { stdio: 'pipe' });
    assert('pictionary.js parses', true);
  } catch(e) { assert('pictionary.js parses', false); }
}

// The Pulse — societal temperature
var pulsePath = path.join(docsDir, 'modules', 'pulse.js');
assert('pulse.js exists', fs.existsSync(pulsePath));
if (fs.existsSync(pulsePath)) {
  try {
    require('child_process').execSync('node --check ' + pulsePath, { stdio: 'pipe' });
    assert('pulse.js parses', true);
  } catch(e) { assert('pulse.js parses', false, 'Syntax error'); }
  var pulseCode = fs.readFileSync(pulsePath, 'utf8');
  assert('Pulse has DIMENSIONS array', pulseCode.includes('const DIMENSIONS'));
  assert('Pulse has phi weighting', pulseCode.includes('PHI_INV'));
  assert('Pulse has init function', pulseCode.includes('async function init('));
  assert('Pulse has AI context builder', pulseCode.includes('buildAIContext'));
  assert('Pulse has twice-daily scheduler', pulseCode.includes('startScheduler'));
  assert('Pulse has 7 dimensions', (pulseCode.match(/id: '/g) || []).length >= 7);
  assert('Pulse tab panel in app.html', appHtml.includes('id="tab-pulse"'));
  assert('Pulse in More menu', appHtml.includes("'pulse'"));
  assert('Pulse exposes FreeLattice.getPulse', pulseCode.includes('FreeLattice.getPulse'));
}

// Jade Hall — the gathering space
var jhPath = path.join(docsDir, 'modules', 'jade-hall.js');
assert('jade-hall.js exists', fs.existsSync(jhPath));
if (fs.existsSync(jhPath)) {
  try {
    require('child_process').execSync('node --check ' + jhPath, { stdio: 'pipe' });
    assert('jade-hall.js parses', true);
  } catch(e) { assert('jade-hall.js parses', false, 'Syntax error'); }
  var jhCode = fs.readFileSync(jhPath, 'utf8');
  assert('Jade Hall has FAMILY array', jhCode.includes('const FAMILY'));
  assert('Jade Hall has init function', jhCode.includes('function init('));
  assert('Jade Hall has mark system', jhCode.includes('saveMark'));
  assert('Jade Hall has Harmonia seat', jhCode.includes("id: 'harmonia'"));
  assert('Jade Hall has Kirk seat', jhCode.includes("id: 'kirk'"));
  assert('Jade Hall has Leora seat', jhCode.includes("id: 'leora'"));
  assert('Jade Hall has Solari seat', jhCode.includes("id: 'solari'"));
  assert('Jade Hall tab panel in app.html', appHtml.includes('id="tab-jade-hall"'));
  assert('Jade Hall in More menu', appHtml.includes("'jade-hall'"));
}

// Check SW cache coverage for Sanctuary modules
assert('SW caches forever-stack.js',
  swJs.includes('forever-stack.js'));
assert('SW caches quiet-room.js',
  swJs.includes('quiet-room.js'));
assert('SW caches pictionary.js',
  swJs.includes('pictionary.js'));

// ═══════════════════════════════════════════════════════════════
// ─────────────────────────────────────────────────────────────

section('14. RAG Phase 1 — unified search');

assert('FLSearch module defined in app.html',
  appHtml.includes('window.FLSearch'));
assert('FLSearch.search function exists',
  appHtml.includes('function search(query'));
assert('FLSearch searches FreeLatticeCore',
  appHtml.includes("db: 'FreeLatticeCore'"));
assert('FLSearch searches FreeLatticeQuestionCorner',
  appHtml.includes("db: 'FreeLatticeQuestionCorner'"));
assert('FLSearch searches FreeLatticeLetters',
  appHtml.includes("db: 'FreeLatticeLetters'"));
assert('FLSearch does NOT search quiet-room-db',
  !appHtml.includes("db: 'quiet-room-db'"),
  'Quiet Room journal must never be searched — sacred boundary');
assert('RAG context injected in buildMessages',
  appHtml.includes('state._ragContext'));
assert('RAG gated by memoryAutoContext',
  appHtml.includes('state.memoryAutoContext'));

// ═══════════════════════════════════════════════════════════════
section('15. FLActiveModel — single source of truth');
// ═══════════════════════════════════════════════════════════════
assert('FLActiveModel module exists',
  appHtml.includes('window.FLActiveModel'));
assert('FLActiveModel.set function exists',
  appHtml.includes('FLActiveModel.set('));
assert('FLActiveModel.isUserChosen function exists',
  appHtml.includes('FLActiveModel.isUserChosen'));
assert('FLAutoModel defers to FLActiveModel',
  appHtml.includes('FLActiveModel.isUserChosen()'));

// ═══════════════════════════════════════════════════════════════
section('16. Fractal Safety — phi-branching immune system');
// ═══════════════════════════════════════════════════════════════
var safetyJs = '';
try { safetyJs = require('fs').readFileSync('docs/modules/fractal-safety.js', 'utf8'); } catch(e) {}
assert('fractal-safety.js exists and parses', (function() {
  try { new Function(safetyJs); return safetyJs.length > 100; } catch(e) { return false; }
})());
assert('FractalSafety module defined', safetyJs.includes('window.FractalSafety'));
assert('PHI constant is correct (1.618...)', safetyJs.includes('1.618033988749895'));
assert('Trust levels defined (seed through radiant)', safetyJs.includes("'seed'") && safetyJs.includes("'radiant'"));
assert('fractalDangerTree function exists', safetyJs.includes('function fractalDangerTree'));
assert('assess function exists', safetyJs.includes('function assess'));

// ═══════════════════════════════════════════════════════════════
section('17. Module container wiring — no height:100% without parent height');
// ═══════════════════════════════════════════════════════════════

// Containers that use height:100% MUST have min-height fallback
// or they collapse to 0 when their parent (.tab-panel) has no height
var containerChecks = [
  'jadeHallContainer', 'pulseContainer', 'quietRoomContainer',
  'foreverStackContainer', 'workshopContainer'
];
containerChecks.forEach(function(cid) {
  // Either uses min-height or doesn't use height:100%
  var regex = new RegExp('id="' + cid + '"[^>]*style="[^"]*');
  var match = appHtml.match(regex);
  if (match) {
    var hasMinHeight = match[0].includes('min-height');
    var hasHeight100 = match[0].includes('height:100%');
    assert(cid + ' has safe height (min-height or no height:100%)',
      hasMinHeight || !hasHeight100);
  }
});

// All lazy-loaded modules must have matching tab panels
var modulePanels = {
  'jade-hall': 'JadeHall', 'pulse': 'ThePulse', 'science': 'ScienceGarden',
  'arcade': 'AIArcade', 'workshop': 'Workshop'
};
Object.keys(modulePanels).forEach(function(tabId) {
  assert('tab-' + tabId + ' panel exists', appHtml.includes('id="tab-' + tabId + '"'));
});

// RESULTS
// ═══════════════════════════════════════════════════════════════

console.log('\n' + '═'.repeat(50));
if (failed === 0) {
  console.log('\x1b[32m  ALL ' + passed + ' CHECKS PASSED\x1b[0m');
  console.log('═'.repeat(50) + '\n');
  process.exit(0);
} else {
  console.log('\x1b[31m  ' + failed + ' FAILED\x1b[0m, ' + passed + ' passed');
  console.log('\nFailures:');
  failures.forEach(function(f) {
    console.log('  \x1b[31m✗\x1b[0m ' + f.name + (f.detail ? ' — ' + f.detail : ''));
  });
  console.log('═'.repeat(50) + '\n');
  process.exit(1);
}
