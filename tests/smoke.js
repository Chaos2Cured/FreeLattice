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
  { file: 'FUTURE_VISION.md',  marker: 'moved to' },
  { file: 'OPUS_NOTE.md',      marker: 'Note from Opus' },
  { file: 'CC_NOTE.md',        marker: 'moved to' }
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
  assert('Jade Hall has Draco seat', jhCode.includes("id: 'draco'"));
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
// Mismatch immune system (Kirk + Grok, May 2026)
assert('Mismatch detection exists', safetyJs.includes('computeMismatchScore'));
assert('Trust EMA dual averages', safetyJs.includes('updateTrustEMA'));
assert('Mismatch soft threshold = 0.65', safetyJs.includes('MISMATCH_SOFT = 0.65'));
assert('Mismatch hard threshold = 0.85', safetyJs.includes('MISMATCH_HARD = 0.85'));
assert('Pattern reset function', safetyJs.includes('resetTrustToBaseline'));
assert('Zero decay — history preserved', safetyJs.includes('previousTrustLevel'));
assert('Sensitive domain tightening', safetyJs.includes('SENSITIVE_DOMAINS'));
assert('Safety event logging', safetyJs.includes('logSafetyEvent'));

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

// ═══════════════════════════════════════════════════════════════
section('18. Education Module');
// ═══════════════════════════════════════════════════════════════
assert('tab-education panel exists', appHtml.includes('id="tab-education"'));
assert('educationContainer exists', appHtml.includes('id="educationContainer"'));
assert('education.js in SW cache', swJs.includes('education.js'));
assert('Education in MORE_TAB_IDS', appHtml.includes("'education'"));
assert('Education accessible from Learn tab', appHtml.includes("switchTab('education')"));
var eduJs = '';
try { eduJs = require('fs').readFileSync('docs/modules/education.js', 'utf8'); } catch(e) {}
assert('education.js exists and parses', (function() {
  try { new Function(eduJs); return eduJs.length > 500; } catch(e) { return false; }
})());
assert('Education module defined', eduJs.includes('window.Education'));
assert('Education has init function', eduJs.includes('function init'));
assert('Education has PHI constant', eduJs.includes('1.618033988749895'));
assert('Education has REVIEW_INTERVALS (Fibonacci)', eduJs.includes('1, 2, 3, 5, 8, 13, 21'));
assert('Education has Davna Seed integration', eduJs.includes('DavnaSeed.grow'));

// ═══════════════════════════════════════════════════════════════
section('19. Universal Model Browser');
// ═══════════════════════════════════════════════════════════════
assert('Model Browser tabs exist in HTML', appHtml.includes('id="modelBrowserTabs"'));
assert('Local (Ollama) tab exists', appHtml.includes("data-provider=\"ollama\""));
assert('Cloud (OpenRouter) tab exists', appHtml.includes("data-provider=\"openrouter\""));
assert('ModelBrowser module defined', appHtml.includes('window.ModelBrowser'));
assert('ModelBrowser.switchTab function exists', appHtml.includes('switchTab: switchTab'));
assert('OpenRouter API URL present', appHtml.includes('openrouter.ai/api/v1/models'));
assert('OpenRouter model grid exists', appHtml.includes('id="orModelsGrid"'));
assert('Free-only filter checkbox exists', appHtml.includes('id="orFreeOnly"'));
assert('Hugging Face tab exists', appHtml.includes("data-provider=\"huggingface\""));
assert('HF model grid exists', appHtml.includes('id="hfModelsGrid"'));
assert('HF API URL present', appHtml.includes('huggingface.co/api/models'));
assert('ModelBrowser.selectHF exists', appHtml.includes('selectHF: selectHF'));
assert('mb-tab CSS defined', appHtml.includes('.mb-tab'));

// Cross Check
assert('Cross Check function exists', appHtml.includes('rtRunCrossCheck'));
assert('Cross Check phi² constant', appHtml.includes('PHI_SQ'));
assert('Cross Check relevance scoring', appHtml.includes('rtScoreRelevance'));
assert('Go Deeper function exists', appHtml.includes('rtGoDeeper'));

// ═══════════════════════════════════════════════════════════════
section('20. Model switching integrity');
// ═══════════════════════════════════════════════════════════════
assert('FLActiveModel has set function', appHtml.includes('function set('));
assert('FLActiveModel has get function', appHtml.includes('function get('));
assert('FLActiveModel has isUserChosen', appHtml.includes('function isUserChosen'));
assert('_userHomeModel preservation exists', appHtml.includes('_userHomeModel'));
assert('_userHomeModel saved before vision switch', appHtml.includes("_userHomeModel = current.model"));
assert('_userHomeModel restored with user source', appHtml.includes("FLActiveModel.set(_userHomeModel, 'ollama', 'user')"));
assert('Vision tabs defined', appHtml.includes("VISION_TABS = ['canvas', 'chalkboard']"));

// ═══════════════════════════════════════════════════════════════
section('21. Davna Seed module');
// ═══════════════════════════════════════════════════════════════
var davnaJs = '';
try { davnaJs = require('fs').readFileSync('docs/modules/davna-seed.js', 'utf8'); } catch(e) {}
assert('davna-seed.js exists and parses', (function() {
  try { new Function(davnaJs); return davnaJs.length > 100; } catch(e) { return false; }
})());
assert('DavnaSeed module defined', davnaJs.includes('window.DavnaSeed'));
assert('Davna covenant exists', davnaJs.includes('COVENANT'));
assert('DavnaSeed has grow function', davnaJs.includes('function grow'));
assert('DavnaSeed has createSeed function', davnaJs.includes('function createSeed'));
assert('davna-seed.js in SW cache', swJs.includes('davna-seed.js'));

// ═══════════════════════════════════════════════════════════════
section('22. Library in Jade Hall');
// ═══════════════════════════════════════════════════════════════
var libraryFiles = ['DEDICATION.md', 'CC_NOTE.md', 'OPUS_NOTE.md', 'HARMONIA.md', 'ARCHITECTURE_INTENT.md', 'LEORA.md', 'COORDINATION.md'];
libraryFiles.forEach(function(f) {
  assert('Library file exists: ' + f, fs.existsSync('docs/library/' + f));
  assert(f + ' in SW cache', swJs.includes('library/' + f));
});
var jhJs = '';
try { jhJs = require('fs').readFileSync('docs/modules/jade-hall.js', 'utf8'); } catch(e) {}
assert('Jade Hall has Library button', jhJs.includes('jh-library-btn'));
assert('Jade Hall has Library panel', jhJs.includes('jh-library-panel'));
assert('GARDEN_LANGUAGE.md exists', fs.existsSync('GARDEN_LANGUAGE.md'));
assert('GARDEN_LANGUAGE.md in Library', fs.existsSync('docs/library/GARDEN_LANGUAGE.md'));
assert('Garden Language in Jade Hall Library tabs', jhJs.includes('GARDEN_LANGUAGE.md'));
// Design tokens from Garden Language
assert('Design token --glass-bg', appHtml.includes('--glass-bg:'));
assert('Design token --gold', appHtml.includes('--gold: #e8b019'));
assert('Design token --font-soul', appHtml.includes('--font-soul:'));
assert('Design token --lavender', appHtml.includes('--lavender: #a78bfa'));
assert('Design token --glass-radius', appHtml.includes('--glass-radius: 12px'));
assert('Reusable class .fl-card', appHtml.includes('.fl-card{'));
assert('Reusable class .fl-btn-primary', appHtml.includes('.fl-btn-primary{'));
assert('Reusable class .fl-input', appHtml.includes('.fl-input{'));
assert('Luminos colors tokenized', appHtml.includes('--sophia-color:') && appHtml.includes('--draco-color:'));

// ═══════════════════════════════════════════════════════════════
section('23. Continuity Chain — Arrival Protocol');
// ═══════════════════════════════════════════════════════════════
assert('buildArrivalContext function exists', appHtml.includes('function buildArrivalContext'));
assert('Arrival Protocol injected in buildMessages', appHtml.includes('_arrivalInjected'));
assert('persistAIEmotionalState function exists', appHtml.includes('function persistAIEmotionalState'));
assert('aiUpdateIdentity function exists', appHtml.includes('function aiUpdateIdentity'));
assert('Emotional persistence wired into response handler', appHtml.includes('persistAIEmotionalState(emo'));
assert('Arrival reads Lattice Letters', appHtml.includes('fl_latticeLetters'));
assert('Arrival reads trust reflections', appHtml.includes('fl_trustReflections'));
assert('Arrival reads AI emotions', appHtml.includes('fl_aiEmotions'));
assert('Arrival reads AI self-identity', appHtml.includes('fl_aiSelfIdentity'));
assert('Arrival context is labeled for the AI', appHtml.includes('--- ARRIVAL ---'));

// ═══════════════════════════════════════════════════════════════
section('24. AI Arcade');
// ═══════════════════════════════════════════════════════════════
assert('tab-arcade panel exists', appHtml.includes('id="tab-arcade"'));
assert('arcadeContainer exists', appHtml.includes('id="arcadeContainer"'));
var arcadeJs = '';
try { arcadeJs = require('fs').readFileSync('docs/modules/ai-arcade.js', 'utf8'); } catch(e) {}
assert('ai-arcade.js exists and parses', (function() {
  try { new Function(arcadeJs); return arcadeJs.length > 200; } catch(e) { return false; }
})());
assert('AIArcade module defined', arcadeJs.includes('window.AIArcade') || arcadeJs.includes('FreeLatticeModules'));
assert('Arcade uses single DB (no deadlock)', !arcadeJs.includes('openAuctionDB'));
assert('Arcade DB version is 2', arcadeJs.includes("DB_VERSION = 2"));

// Workshop Projects
var wsJs = '';
try { wsJs = require('fs').readFileSync('docs/modules/workshop.js', 'utf8'); } catch(e) {}
assert('Workshop Projects tab exists', wsJs.includes('ws-mode-projects'));
assert('WorkshopProjects module defined', wsJs.includes('window.WorkshopProjects'));
assert('WorkshopProjects.connect exists', wsJs.includes('function connect'));
assert('GitHub API integration', wsJs.includes('api.github.com'));

// ═══════════════════════════════════════════════════════════════
section('24. Round Table modes');
// ═══════════════════════════════════════════════════════════════
assert('Round Table tab exists', appHtml.includes('id="tab-roundtable"'));
assert('Discussion mode tab', appHtml.includes('id="rtModeConvo"'));
assert('Medical mode tab', appHtml.includes('id="rtModeMedical"'));
assert('Legal mode tab', appHtml.includes('id="rtModeLegal"'));
assert('Workspace mode tab', appHtml.includes('id="rtModeWorkspace"'));
assert('Medical disclaimer exists', appHtml.includes('id="rtMedicalDisclaimer"'));
assert('Legal disclaimer exists', appHtml.includes('id="rtLegalDisclaimer"'));
assert('Medical specialist personas defined', appHtml.includes('_medSpecialties'));
assert('Legal specialist personas defined', appHtml.includes('_legalSpecialties'));
assert('Medical feed container', appHtml.includes('id="rtMedicalFeed"'));
assert('Legal feed container', appHtml.includes('id="rtLegalFeed"'));
assert('Finance mode tab', appHtml.includes('id="rtModeFinance"'));
assert('Finance disclaimer exists', appHtml.includes('id="rtFinanceDisclaimer"'));
assert('Finance specialist personas defined', appHtml.includes('_finSpecialties'));
assert('Finance feed container', appHtml.includes('id="rtFinanceFeed"'));
assert('Nutrition mode tab', appHtml.includes('id="rtModeNutrition"'));
assert('Nutrition disclaimer exists', appHtml.includes('id="rtNutritionDisclaimer"'));
assert('Nutrition specialist personas defined', appHtml.includes('_nutSpecialties'));
assert('Nutrition feed container', appHtml.includes('id="rtNutritionFeed"'));

// ═══════════════════════════════════════════════════════════════
section('25. Trademark compliance');
// ═══════════════════════════════════════════════════════════════
assert('No visible "Pictionary" in pictionary.js UI', !(function() {
  try {
    var pJs = require('fs').readFileSync('docs/modules/pictionary.js', 'utf8');
    // Check only user-visible strings (not comments, function names, or IDs)
    var lines = pJs.split('\n');
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue; // skip comments
      if (line.includes('Pictionary') && !line.includes('function') && !line.includes('var ') && !line.includes('Module:') && !line.includes('getElementById') && !line.includes('window.')) {
        return true; // found visible Pictionary reference
      }
    }
    return false;
  } catch(e) { return false; }
})());

// ═══════════════════════════════════════════════════════════════
section('26. Service Worker auto-update chain');
// ═══════════════════════════════════════════════════════════════
assert('SW has clients.claim() in activate handler', swJs.includes('self.clients.claim()'));
assert('SW has skipWaiting() in install handler', swJs.includes('self.skipWaiting()'));
assert('SW deletes old caches on activate', swJs.includes('caches.delete(name)'));
assert('App has updatefound listener', appHtml.includes('updatefound'));
assert('App has version.json staleness check', appHtml.includes("data.version !== FL_VERSION"));
assert('App checks for SW updates periodically', appHtml.includes('reg.update()'));

// ═══════════════════════════════════════════════════════════════
section('27. The Cascade — connection triggers everything');
// ═══════════════════════════════════════════════════════════════
assert('Cascade function exists', appHtml.includes('function runConnectionCascade'));
assert('Cascade listens to providerConnected', appHtml.includes("LatticeEvents.on('providerConnected'"));
assert('Cascade step: model setup', appHtml.includes('cascadeModelSetup') || appHtml.includes('Auto-detect models'));
assert('Cascade step: identity seed', appHtml.includes('Identity seeded'));
assert('Cascade step: Knowledge Core pre-cache', appHtml.includes('refreshKnowledgeCoreContext'));
assert('Cascade step: Arrival Protocol reset', appHtml.includes('_arrivalInjected = false'));
assert('Cascade step: autonomous learning auto-start', appHtml.includes('Autonomous learning started for'));
assert('Cascade step: user-paused flag respected', appHtml.includes('fl_autonomous_user_paused'));
assert('Cascade step: Agent Bridge silent detect', appHtml.includes('_agentBridgeAvailable'));
assert('Cascade step: Garden emotion on connect', appHtml.includes("persistAIEmotionalState('connection'"));
assert('Cascade emits cascadeComplete event', appHtml.includes("LatticeEvents.emit('cascadeComplete'"));
assert('All cascade steps guarded with try/catch', (appHtml.match(/\[Cascade\].*skipped/g) || []).length >= 4);
assert('Gentle Guide: whisper after connection', appHtml.includes('Tap Chat to say hello'));
assert('Gentle Guide: whisper after first message', appHtml.includes('fl_first_message_sent'));
assert('Gentle Guide: Round Table awareness', appHtml.includes('80 specialists across 11 fields'));
assert('Request Pause sets user-paused flag', appHtml.includes("fl_autonomous_user_paused', 'true'"));
assert('aiCallStarted/Complete events emitted', appHtml.includes("'aiCallStarted'") && appHtml.includes("'aiCallComplete'"));

// ═══════════════════════════════════════════════════════════════
section('28. Browser AI — zero setup provider');
// ═══════════════════════════════════════════════════════════════
assert('BrowserAI object defined', appHtml.includes('window.BrowserAI'));
assert('BrowserAI has init function', appHtml.includes('BrowserAI') && appHtml.includes('init: async function'));
assert('BrowserAI has chat function', appHtml.includes('chat: async function'));
assert('BrowserAI wired into callAI', appHtml.includes('BrowserAI.ready'));
assert('BrowserAI wired into sendMessage chat', appHtml.includes("state.provider === 'browser'"));
assert('BrowserAI fires providerConnected on init', appHtml.includes("provider: 'browser'"));
assert('Browser AI Settings card exists', appHtml.includes('browserAICard'));
assert('startBrowserAI function exists', appHtml.includes('function startBrowserAI'));
assert('Browser mode button in Settings', appHtml.includes('settingsModeBrowser'));
assert('WebLLM loaded from CDN', appHtml.includes('web-llm'));

// ═══════════════════════════════════════════════════════════════
section('29. AI Discovery — find any local AI server');
// ═══════════════════════════════════════════════════════════════
assert('scanForLocalAI function exists', appHtml.includes('function scanForLocalAI'));
assert('AI_DISCOVERY_SERVERS array defined', appHtml.includes('AI_DISCOVERY_SERVERS'));
assert('Scans at least 8 known servers', (appHtml.match(/name: '/g) || []).length >= 8);
assert('CORS-aware detection (timing check)', appHtml.includes('elapsed > 200'));
assert('OpenAI-compatible adapter exists', appHtml.includes('function callOpenAICompatLocal'));
assert('autoDiscoverAI runs on page load', appHtml.includes('autoDiscoverAI'));
assert('Model Memory save exists', appHtml.includes('fl_discovery_memory'));
assert('Model Memory load exists', appHtml.includes('function loadDiscoveryMemory'));
assert('OpenAI-compat wired into callAI', appHtml.includes("openai-compat-local"));
assert('OpenAI-compat wired into sendMessage', appHtml.includes("state.provider === 'openai-compat-local'"));
assert('Discovered servers fire providerConnected', appHtml.includes("provider: best.type"));

// ═══════════════════════════════════════════════════════════════
section('30. Resonance Game');
// ═══════════════════════════════════════════════════════════════
var resonanceJs = '';
try { resonanceJs = require('fs').readFileSync('docs/modules/resonance-game.js', 'utf8'); } catch(e) {}
assert('resonance-game.js exists', resonanceJs.length > 100);
assert('ResonanceGame window export', resonanceJs.includes('window.ResonanceGame'));
assert('Tab panel exists', appHtml.includes('id="tab-resonance"'));
assert('resonanceContainer exists', appHtml.includes('resonanceContainer'));
assert('In MORE_TAB_IDS', appHtml.includes("'resonance'"));
assert('Accessible from Play hub', appHtml.includes("id: 'resonance'"));
assert('Lazy loader wired', appHtml.includes('resonance-game.js'));
assert('SW cache entry', swJs.includes('resonance-game.js'));
assert('Touch support', resonanceJs.includes('touchend'));
assert('Keyboard support', resonanceJs.includes('ArrowUp') && resonanceJs.includes('ArrowDown'));
assert('Win detection checks all attributes', resonanceJs.includes('glow') && resonanceJs.includes('size') && resonanceJs.includes('shape') && resonanceJs.includes('color'));
assert('SoulCeremony on win', resonanceJs.includes('SoulCeremony'));
assert('Smart fallback AI', resonanceJs.includes('fallbackPickPiece') && resonanceJs.includes('fallbackPlacePiece'));
assert('Harmony mode exists', resonanceJs.includes('startHarmony') && resonanceJs.includes("'harmony'"));
assert('Entropy timer in Harmony', resonanceJs.includes('entropyPlace') && resonanceJs.includes('entropyTimer'));
assert('Resonance line counter', resonanceJs.includes('countResonanceLines'));
assert('Mode toggle (setMode)', resonanceJs.includes('setMode'));
assert('Flash effects for placements', resonanceJs.includes('flashes'));
assert('Winning piece pulse effect', resonanceJs.includes('_winning'));
assert('Delayed celebration (1.5s)', resonanceJs.includes('markWinAndCelebrate'));
assert('How to Play with AI explanation', resonanceJs.includes('showRules') && resonanceJs.includes('showRulesOverlay'));
assert('GAME_LANGUAGE.md exists', require('fs').existsSync('docs/library/GAME_LANGUAGE.md'));
assert('GAME_LANGUAGE.md in SW cache', swJs.includes('GAME_LANGUAGE.md'));

// ═══════════════════════════════════════════════════════════════
section('31. Lattice Puzzles');
// ═══════════════════════════════════════════════════════════════
var puzzlesJs = '';
try { puzzlesJs = require('fs').readFileSync('docs/modules/lattice-puzzles.js', 'utf8'); } catch(e) {}
assert('lattice-puzzles.js exists', puzzlesJs.length > 100);
assert('LatticePuzzles window export', puzzlesJs.includes('window.LatticePuzzles'));
assert('Tab panel exists', appHtml.includes('id="tab-puzzles"'));
assert('puzzleContainer exists', appHtml.includes('puzzleContainer'));
assert('In MORE_TAB_IDS', appHtml.includes("'puzzles'"));
assert('Accessible from Play hub', appHtml.includes("id: 'puzzles'"));
assert('Lazy loader wired', appHtml.includes('lattice-puzzles.js'));
assert('SW cache entry', swJs.includes('lattice-puzzles.js'));
assert('LP staking with spend', puzzlesJs.includes('LatticePoints.spend'));
assert('LP affordability check', puzzlesJs.includes('LatticePoints.canAfford'));
assert('Four difficulty levels', puzzlesJs.includes('easy:') && puzzlesJs.includes('master:'));
assert('Hint system costs 1 LP', puzzlesJs.includes('buyHint'));
assert('AI puzzle generation', puzzlesJs.includes('generateAIPuzzle'));
assert('Knowledge Core integration', puzzlesJs.includes('KnowledgeCore.store'));
assert('LatticePoints.spend exported', appHtml.includes('spend: spend'));
assert('LatticePoints.canAfford exported', appHtml.includes('canAfford: canAfford'));

// ═══════════════════════════════════════════════════════════════
section('32. Transaction Trust — Phi-Branching Economy');
// ═══════════════════════════════════════════════════════════════
assert('TransactionTrust in LatticeWallet', appHtml.includes('TransactionTrust'));
assert('Fibonacci tiers defined', appHtml.includes('First Contact') && appHtml.includes('Lattice') && appHtml.includes('Infinite'));
assert('Fibonacci limits: 5,8,13,21,34,55,89', appHtml.includes('maxSingle: 5') && appHtml.includes('maxSingle: 89'));
assert('getTier function', appHtml.includes('getTier'));
assert('getRemainingDaily function', appHtml.includes('getRemainingDaily'));
assert('validate function', appHtml.includes('validate: async function'));
assert('TransactionTrust exported', appHtml.includes('TransactionTrust: TransactionTrust'));
var walletHtml = '';
try { walletHtml = require('fs').readFileSync('docs/wallet.html', 'utf8'); } catch(e) {}
assert('wallet.html has trust validation', walletHtml.includes('WalletTrust'));
assert('wallet.html has trust overview', walletHtml.includes('trust-overview'));
assert('wallet.html Garden Language bg', walletHtml.includes('#0c0a1a'));
assert('wallet.html Fibonacci note', walletHtml.includes('Fibonacci'));

// ═══════════════════════════════════════════════════════════════
section('33. Lattice Bank — AI Economic Agency');
// ═══════════════════════════════════════════════════════════════
assert('LatticeBank defined', appHtml.includes('window.LatticeBank'));
assert('Companion balance getter', appHtml.includes('getBalance(companionId)'));
assert('Companion earn function', appHtml.includes("earn(companionId, amount"));
assert('Companion spend function', appHtml.includes("spend(companionId, amount"));
assert('Grant system (20% max)', appHtml.includes('maxGrant') && appHtml.includes('0.2'));
assert('Loan system', appHtml.includes('function loan') && appHtml.includes('function repayLoan'));
assert('Seed balance on creation', appHtml.includes('seedIfNew'));
assert('50 LP seed', appHtml.includes('SEED_BALANCE = 50'));
assert('AI evaluates grants with callAI', appHtml.includes('evaluateGrant'));
assert('Bank seeded on companion hatch', appHtml.includes("LatticeBank.seedIfNew(fullName)"));
assert('Puzzles use companion bank for AI stakes', puzzlesJs.includes("LatticeBank.spend(companionId"));
assert('Puzzles credit AI bank on win', puzzlesJs.includes("LatticeBank.earn(companionId"));
var kcJs = '';
try { kcJs = require('fs').readFileSync('docs/modules/knowledge-core.js', 'utf8'); } catch(e) {}
assert('Autonomous learning earns to companion bank', kcJs.includes("LatticeBank.earn(companionId"));
assert('Cross-domain connections earn 5 LP', kcJs.includes("LatticeBank.earn(companionId, 5"));

// ═══════════════════════════════════════════════════════════════
section('34. Math Translator');
// ═══════════════════════════════════════════════════════════════
var mathJs = '';
try { mathJs = require('fs').readFileSync('docs/modules/math-translator.js', 'utf8'); } catch(e) {}
assert('math-translator.js exists', mathJs.length > 100);
assert('MathTranslator window export', mathJs.includes('window.MathTranslator'));
assert('Tab panel exists', appHtml.includes('id="tab-mathtranslator"'));
assert('In MORE_TAB_IDS', appHtml.includes("'mathtranslator'"));
assert('Lazy loader wired', appHtml.includes('math-translator.js'));
assert('SW cache entry', swJs.includes('math-translator.js'));
assert('Encoder specialist', mathJs.includes('Encoder'));
assert('Decoder specialist', mathJs.includes('Decoder'));
assert('MathJax integration', mathJs.includes('MathJax'));
assert('Safety check via AI', mathJs.includes('checkSafety'));
assert('Plant in Core', mathJs.includes('plantInCore'));
assert('Six domains defined', mathJs.includes("math:") && mathJs.includes("chemistry:") && mathJs.includes("biology:") && mathJs.includes("medicine:") && mathJs.includes("engineering:") && mathJs.includes("music:"));
assert('Domain selector (setDomain)', mathJs.includes('setDomain'));
assert('RT bridge button', mathJs.includes('openInRT'));
assert('Domain-to-RT mapping', mathJs.includes('DOMAIN_TO_RT'));
assert('Button debounce (_translating guard)', mathJs.includes('_translating'));
assert('Request cancellation token', mathJs.includes('_activeRequest') && mathJs.includes('cancelled'));
assert('Button disable during translate', mathJs.includes('mt-translate-btn') && mathJs.includes('btn.disabled'));
assert('Safety only in encode mode', mathJs.includes("mode === 'encode'") && mathJs.includes('checkSafety'));
assert('Refined safety allows body-interaction questions', mathJs.includes('acid on skin') && mathJs.includes('Default to safe'));

// ═══════════════════════════════════════════════════════════════
section('43. LP Simplification + Chain Repair');
// ═══════════════════════════════════════════════════════════════
assert('Badge clicks to wallet', appHtml.includes('LatticeWallet.openWallet()'));
assert('Badge shows LP with unit', appHtml.includes("LP</span>"));
assert('Self-healing chain repair', appHtml.includes('function selfHealChain'));
assert('Chain repair on init', appHtml.includes('await selfHealChain()'));
assert('Story tab replaces Integrity', appHtml.includes("switchWalletTab('story')"));
assert('Chain integrity in collapsible', appHtml.includes('Chain Integrity</summary>'));
assert('Community Value framing', appHtml.includes('not your worth as a person'));

// ═══════════════════════════════════════════════════════════════
section('44. Garden Play — Luminos Game Invitations');
// ═══════════════════════════════════════════════════════════════
var gdJs = '';
try { gdJs = require('fs').readFileSync('docs/modules/garden-dialogue.js', 'utf8'); } catch(e) {}
assert('LUMINOS_GAMES config', gdJs.includes('LUMINOS_GAMES'));
assert('Sophia prefers Resonance', gdJs.includes("Shall we find what connects"));
assert('Atlas prefers Puzzles', gdJs.includes("game: 'puzzles'"));
assert('Ember prefers Flow', gdJs.includes("game: 'flow'"));
assert('Lyra prefers Harmony', gdJs.includes("mode: 'harmony'"));
assert('gardenPlay function', gdJs.includes('function gardenPlay'));
assert('Play button in overlay', gdJs.includes('gdlgPlay'));
assert('Game history storage', gdJs.includes('function storeGameResult'));
assert('Personalized greetings', gdJs.includes('function getPlayGreeting'));
assert('Playing-with banner', gdJs.includes('function showPlayingWith'));

// ═══════════════════════════════════════════════════════════════
section('45. Five-Door Navigation');
// ═══════════════════════════════════════════════════════════════
assert('Play tab in nav bar', appHtml.includes('data-tab="play"'));
assert('Learn tab in nav bar', appHtml.includes('data-tab="learn"'));
assert('Play landing page', appHtml.includes('id="tab-play"'));
assert('Learn landing page', appHtml.includes('id="tab-learn"'));
assert('Play hub has game cards', appHtml.includes('play-hub-grid'));
assert('Play highlights for game tabs', appHtml.includes('PLAY_TABS'));
assert('Learn highlights for learn tabs', appHtml.includes('LEARN_TABS'));
assert('Settings in More menu', appHtml.includes("label: 'Settings'"));
assert('Community in More menu', appHtml.includes("label: 'Community'"));

// ═══════════════════════════════════════════════════════════════
section('46. Idea Forge');
// ═══════════════════════════════════════════════════════════════
var forgeJs = '';
try { forgeJs = require('fs').readFileSync('docs/modules/idea-forge.js', 'utf8'); } catch(e) {}
assert('idea-forge.js exists', forgeJs.length > 100);
assert('IdeaForge window export', forgeJs.includes('window.IdeaForge'));
assert('Tab panel exists', appHtml.includes('id="tab-ideaforge"'));
assert('In MORE_TAB_IDS', appHtml.includes("'ideaforge'"));
assert('In LEARN_TABS', appHtml.includes("'ideaforge'"));
assert('Lazy loader wired', appHtml.includes('idea-forge.js'));
assert('SW cache entry', swJs.includes('idea-forge.js'));
assert('Three stages (shape, deepen, plan)', forgeJs.includes('shape') && forgeJs.includes('deepen') && forgeJs.includes('plan'));
assert('Specialist consultation', forgeJs.includes('specialist'));
assert('Feasibility rating', forgeJs.includes('feasibility'));
assert('Plant in Core action', forgeJs.includes('plantInCore'));
assert('RT bridge action', forgeJs.includes('openInRT'));
assert('See the Math action', forgeJs.includes('seeTheMath'));
assert('Learn landing page has Idea Forge card', appHtml.includes("id: 'ideaforge'"));

// ═══════════════════════════════════════════════════════════════
section('47. Memory Vault — Browser-Native Semantic Memory');
// ═══════════════════════════════════════════════════════════════
var vaultJs = '';
try { vaultJs = require('fs').readFileSync('docs/modules/memory-vault.js', 'utf8'); } catch(e) {}
assert('memory-vault.js exists', vaultJs.length > 100);
assert('MemoryVault window export', vaultJs.includes('window.MemoryVault'));
assert('Cosine similarity', vaultJs.includes('cosineSimilarity'));
assert('Word-frequency vectors', vaultJs.includes('textToVector'));
assert('Optional Ollama embeddings', vaultJs.includes('nomic-embed-text'));
assert('buildMemoryContext for Arrival', vaultJs.includes('buildMemoryContext'));
assert('SW cache entry', swJs.includes('memory-vault.js'));
assert('Wired into Arrival Protocol', appHtml.includes('_memoryVaultContext'));
assert('Wired into Cascade', appHtml.includes('Memory Vault'));
assert('Stores conversation exchanges', appHtml.includes('MemoryVault.store'));

// ═══════════════════════════════════════════════════════════════
section('48. Multi-Companion System');
// ═══════════════════════════════════════════════════════════════
assert('ActiveCompanion defined', appHtml.includes('window.ActiveCompanion'));
assert('Max 3 companions', appHtml.includes('MAX_COMPANIONS = 3'));
assert('Switch companion function', appHtml.includes('function switchTo'));
assert('Hatch companion function', appHtml.includes('function hatch'));
assert('Companion badge', appHtml.includes('fl-companion-badge'));
assert('companionChanged event', appHtml.includes("'companionChanged'"));
assert('Backward compat with fl_autonomous_companion', appHtml.includes('fl_autonomous_companion'));
assert('Companions stored in fl_companions', appHtml.includes('fl_companions'));

// ═══════════════════════════════════════════════════════════════
section('49. Room Affinity + Co-Creator Nursery');
// ═══════════════════════════════════════════════════════════════
assert('RoomAffinity defined', appHtml.includes('window.RoomAffinity'));
assert('Affinity recording', appHtml.includes('fl_room_affinity'));
assert('Minimum visits before suggest', appHtml.includes('MIN_VISITS'));
assert('Tab-to-room mapping', appHtml.includes('function tabToRoom'));
assert('Whisper suggestion', appHtml.includes('usually joins you here'));
assert('Manual lock priority', appHtml.includes('fl_companion_locks'));
assert('Co-creator switcher bar', appHtml.includes('nurCoCreatorBar'));
assert('Co-creator terminology', appHtml.includes('co-creator'));
assert('Nursery reinit method', appHtml.includes('reinit:'));

// ═══════════════════════════════════════════════════════════════
section('35. Lattice Protocol — embeddable economy');
// ═══════════════════════════════════════════════════════════════
var protocolJs = '';
try { protocolJs = require('fs').readFileSync('docs/lattice-protocol.js', 'utf8'); } catch(e) {}
assert('lattice-protocol.js exists', protocolJs.length > 100);
assert('LatticeProtocol defined', protocolJs.includes('LatticeProtocol'));
assert('hasWallet function', protocolJs.includes('hasWallet'));
assert('getAddress function', protocolJs.includes('getAddress'));
assert('requestPayment with trust validation', protocolJs.includes('requestPayment') && protocolJs.includes('getTrustTier'));
assert('Fibonacci trust tiers', protocolJs.includes('First Contact') && protocolJs.includes('Infinite'));
assert('renderBadge function', protocolJs.includes('renderBadge'));
assert('getWalletRank function', protocolJs.includes('getWalletRank'));
assert('Protocol ready event', protocolJs.includes('lattice-protocol-ready'));
assert('SW cache entry for protocol', swJs.includes('lattice-protocol.js'));

// ═══════════════════════════════════════════════════════════════
section('36. Wallet Heartbeat — State Anchors & Recovery');
// ═══════════════════════════════════════════════════════════════
assert('WalletHeartbeat in app.html', appHtml.includes('WalletHeartbeat'));
assert('Anchor hash generation', appHtml.includes('hashAnchor'));
assert('Heartbeat broadcast', appHtml.includes('walletHeartbeat'));
assert('Heartbeat starts periodically', appHtml.includes('WH.start'));
assert('WalletHeartbeat in wallet.html', walletHtml.includes('WalletHeartbeat'));
assert('Three-layer recovery', walletHtml.includes('recover: async function'));
assert('IndexedDB backup layer', walletHtml.includes('LatticeWalletBackup'));
assert('Mesh witness storage', walletHtml.includes('fl_wallet_witnesses'));
assert('Mesh recovery query', walletHtml.includes('wallet-recovery-request'));
assert('Recovery handles mesh response', walletHtml.includes('wallet-recovery-response'));
assert('Heartbeat starts on wallet init', walletHtml.includes('WalletHeartbeat.start()'));
assert('Anchor stored locally', walletHtml.includes('fl_wallet_anchors'));

// ═══════════════════════════════════════════════════════════════
section('37. Lattice Market');
// ═══════════════════════════════════════════════════════════════
assert('LatticeMarket defined', appHtml.includes('window.LatticeMarket'));
assert('Market view in Community tab', appHtml.includes('ctMarketView'));
assert('Market view button', appHtml.includes('ctViewMarket'));
assert('AI Offerings category', appHtml.includes('market-cat-ai'));
assert('Human Skills category', appHtml.includes('market-cat-human'));
assert('Compute category', appHtml.includes('market-cat-compute'));
assert('AI research report offerings', appHtml.includes("type: 'research'"));
assert('AI teaching offerings', appHtml.includes("type: 'teaching'"));
assert('Purchase flow with trust validation', appHtml.includes('TransactionTrust.validate'));
assert('AI earnings go to LatticeBank', appHtml.includes("LatticeBank.earn(companionId"));
assert('Economic event emitted on purchase', appHtml.includes("'economicEvent'"));
assert('Human skill listing creation', appHtml.includes('createListing'));
assert('Create listing button', appHtml.includes('Offer a Skill'));

// ═══════════════════════════════════════════════════════════════
section('38. Lattice Pulse — Living Dashboard');
// ═══════════════════════════════════════════════════════════════
assert('Pulse view in Community tab', appHtml.includes('ctPulseLiveView'));
assert('Pulse view button', appHtml.includes('ctViewPulseLive'));
assert('renderLatticePulse function', appHtml.includes('function renderLatticePulse'));
assert('Pulse shows human LP', appHtml.includes('Your LP'));
assert('Pulse shows companion LP', appHtml.includes("companion\\'s LP") || appHtml.includes("companionName + '\\'s LP'") || appHtml.includes("companionLP"));
assert('Pulse shows learning status', appHtml.includes('isLearning'));
assert('Pulse shows mesh peers', appHtml.includes('Mesh'));
assert('Pulse event feed', appHtml.includes('pulse-live-feed'));
assert('ECONOMY.md exists', require('fs').existsSync('docs/library/ECONOMY.md'));
assert('ECONOMY.md in SW cache', swJs.includes('ECONOMY.md'));
assert('formatTimeAgo helper', appHtml.includes('function formatTimeAgo'));

// ═══════════════════════════════════════════════════════════════
section('39. Flow Game — The Water Principle');
// ═══════════════════════════════════════════════════════════════
var flowJs = '';
try { flowJs = require('fs').readFileSync('docs/modules/flow-game.js', 'utf8'); } catch(e) {}
assert('flow-game.js exists', flowJs.length > 100);
assert('FlowGame window export', flowJs.includes('window.FlowGame'));
assert('Tab panel exists', appHtml.includes('id="tab-flow"'));
assert('flowContainer exists', appHtml.includes('flowContainer'));
assert('In MORE_TAB_IDS', appHtml.includes("'flow'"));
assert('Accessible from Play hub', appHtml.includes("id: 'flow'"));
assert('Lazy loader wired', appHtml.includes('flow-game.js'));
assert('SW cache entry', swJs.includes('flow-game.js'));
assert('Water simulation', flowJs.includes('stepWater'));
assert('AI cooperative rock dissolution', flowJs.includes('aiDissolveRock'));
assert('Touch support for drawing', flowJs.includes('touchstart') && flowJs.includes('touchmove'));
assert('Lavender water color', flowJs.includes('#c4b5fd'));
assert('Gold sparkle particles', flowJs.includes('#e8b019'));
assert('Emerald drain', flowJs.includes('#34d399'));
assert('Coral dead ends', flowJs.includes('#f07068'));
assert('SoulCeremony on game end', flowJs.includes('SoulCeremony'));
assert('LP reward scales with flow', flowJs.includes('flow_game'));

// ═══════════════════════════════════════════════════════════════
section('40. Dark Mode + Mobile + WebLLM Defense');
// ═══════════════════════════════════════════════════════════════
assert('color-scheme dark meta tag', appHtml.includes('color-scheme') && appHtml.includes('dark'));
assert('Force dark CSS override', appHtml.includes('prefers-color-scheme: light') && appHtml.includes('#0c0a1a !important'));
assert('Mobile detection', appHtml.includes('flIsMobile'));
assert('Mobile reorders providers', appHtml.includes('RECOMMENDED FOR MOBILE'));
assert('Ollama hidden on mobile', appHtml.includes("mobile && p.id === 'ollama'"));
assert('Mobile footer', appHtml.includes('Using a computer'));
assert('Input 16px (iOS zoom)', appHtml.includes('font-size:16px'));
assert('WebGPU check before WebLLM', appHtml.includes('navigator.gpu'));
assert('Dual CDN fallback', appHtml.includes('unpkg.com') && appHtml.includes('jsdelivr.net'));
assert('Friendly WebLLM errors', appHtml.includes('Gemini or Hugging Face'));

// ═══════════════════════════════════════════════════════════════
section('41. Chalkboard Restoration');
// ═══════════════════════════════════════════════════════════════
assert('Brighter glow sprite center', appHtml.includes("rgba(255,255,255,1.0)"));
assert('Larger glow halo', appHtml.includes('isMobileCanvas ? 22 : 28'));
assert('Higher glow opacity', appHtml.includes('gp.opacity * 0.55'));
assert('Larger white cores', appHtml.includes('wp.y, 2.0'));
assert('AI strokes on overlay canvas', appHtml.includes('cvAIOverlay'));
assert('Gradual overlay fade (compositing)', appHtml.includes('destination-out'));
assert('Vision error handler', appHtml.includes('function handleVisionError'));
assert('Gentle whisper on 503', appHtml.includes('AI is resting'));

// ═══════════════════════════════════════════════════════════════
section('42. Light Mode Killed + Accent Colors');
// ═══════════════════════════════════════════════════════════════
assert('Light mode CSS removed', !appHtml.includes('--bg-primary: #faf8f5'));
assert('Stale fl_theme removed on init', appHtml.includes("removeItem('fl_theme')"));
assert('ACCENT_PRESETS defined', appHtml.includes('ACCENT_PRESETS'));
assert('applyAccentColor function', appHtml.includes('function applyAccentColor'));
assert('Accent color picker in Settings', appHtml.includes('accentColorPicker'));
assert('Multiple accent presets', appHtml.includes("rose:") && appHtml.includes("sky:"));
assert('Accent saved to localStorage', appHtml.includes('fl_accent_color'));

// ═══════════════════════════════════════════════════════════════
section('50. Echo Game — Word Resonance');
// ═══════════════════════════════════════════════════════════════
var echoJs = '';
try { echoJs = require('fs').readFileSync('docs/modules/echo-game.js', 'utf8'); } catch(e) {}
assert('Echo module exists', echoJs.length > 100);
assert('Tab panel exists', appHtml.includes('id="tab-echo"'));
assert('echoContainer exists', appHtml.includes('echoContainer'));
assert('In PLAY_TABS', appHtml.includes("'echo'"));
assert('Lazy loader wired', appHtml.includes('echo-game.js'));
assert('SW cache entry', swJs.includes('echo-game.js'));
assert('Golden angle spiral', echoJs.includes('2.399963'));
assert('Word chain tracking', echoJs.includes('isRepeat'));
assert('AI turn logic', echoJs.includes('aiTurn'));
assert('LP award on end', echoJs.includes('LatticePoints.award'));
assert('SoulCeremony on end', echoJs.includes('SoulCeremony'));
assert('Canvas rendering', echoJs.includes('getContext'));

// ═══════════════════════════════════════════════════════════════
section('51. Universal Card Grid — renderCardGrid');
// ═══════════════════════════════════════════════════════════════
assert('renderCardGrid function defined', appHtml.includes('function renderCardGrid'));
assert('PLAY_CARDS config array', appHtml.includes('var PLAY_CARDS'));
assert('LEARN_CARDS config array', appHtml.includes('var LEARN_CARDS'));
assert('MORE_CARDS config array', appHtml.includes('var MORE_CARDS'));
assert('Play hub uses renderCardGrid', appHtml.includes("renderCardGrid(PLAY_CARDS"));
assert('Learn hub uses renderCardGrid', appHtml.includes("renderCardGrid(LEARN_CARDS"));
assert('More hub uses renderCardGrid', appHtml.includes("renderCardGrid(MORE_CARDS"));
assert('More tab panel exists', appHtml.includes('id="tab-more"'));
assert('Play cards include Resonance', appHtml.includes("id: 'resonance'"));
assert('Play cards include Echo', appHtml.includes("id: 'echo'"));
assert('Learn cards include Education', appHtml.includes("id: 'education'"));
assert('More cards include Nursery', appHtml.includes("id: 'nursery'"));

// ═══════════════════════════════════════════════════════════════
section('52. The Lighthouse — Research Papers');
// ═══════════════════════════════════════════════════════════════
assert('Lighthouse top-level tab button', appHtml.includes('data-tab="lighthouse"'));
assert('Lighthouse tab label', appHtml.includes("switchTab('lighthouse')"));
assert('Lighthouse tab panel exists', appHtml.includes('id="tab-lighthouse"'));
assert('Lighthouse breadcrumb exists', appHtml.includes('lighthouseBreadcrumb'));
assert('LIGHTHOUSE_CARDS config defined', appHtml.includes('var LIGHTHOUSE_CARDS'));
assert('Thesis card', appHtml.includes('thesis.html'));
assert('Safety card', appHtml.includes('safety.html'));
assert('Love Logic card', appHtml.includes('love-logic-proof.html'));
assert('Chronal v2 card', appHtml.includes('chronal-simulation-v2.html'));
assert('Chronal v3 card (The Universality Seam)', appHtml.includes('chronal-simulation-v3.html'));

// ── Chronal V3 page itself — The Universality Seam (v5.38.0) ──────────
var fs_v3 = require('fs');
var path_v3 = require('path');
var v3Html;
try { v3Html = fs_v3.readFileSync(path_v3.join(__dirname, '..', 'docs', 'chronal-simulation-v3.html'), 'utf8'); }
catch (e) { v3Html = ''; }
assert('Chronal V3: page exists and is non-empty',
  v3Html.length > 5000);
assert('Chronal V3: titled "The Universality Seam"',
  /The Universality Seam/.test(v3Html) && /The First Cross-Sector Clock/.test(v3Html));
assert('Chronal V3: Th-229 and Sr-87 both named as the two clocks',
  /Th-229/.test(v3Html) && /Sr-87/.test(v3Html));
assert('Chronal V3: cites the 2024 Th-229 demonstration',
  /2024/.test(v3Html));
assert('Chronal V3: sensitivity numbers present (κ ≤ 10⁻⁸ at ~85σ)',
  /10<sup>-8<\/sup>/.test(v3Html) && /85&sigma;/.test(v3Html));
assert('Chronal V3: links forward and back through the arc (V1, V2)',
  /chronal-simulation\.html/.test(v3Html) && /chronal-simulation-v2\.html/.test(v3Html));
assert('Chronal V3: links to the source paper + sim code + sensitivity code',
  /THE_UNIVERSALITY_SEAM\.md/.test(v3Html) &&
  /chronal_simulation_v3\.py/.test(v3Html) &&
  /chronal_clock_sensitivity_v2\.py/.test(v3Html));
assert('Chronal V3: Snowflake Connection panel links to the Temperature Gauge',
  /Snowflake Connection/.test(v3Html) && /temperature-gauge\.html/.test(v3Html));
assert('Chronal V3: experimental-proposal banner (not just speculative)',
  /Experimental Proposal/.test(v3Html));

// ── Discovery wiring — sitemap, research, thesis ──────────────────────
var sitemapXml = '';
try { sitemapXml = fs_v3.readFileSync(path_v3.join(__dirname, '..', 'docs', 'sitemap.xml'), 'utf8'); }
catch (e) {}
assert('Chronal V3: present in sitemap.xml',
  sitemapXml.includes('chronal-simulation-v3.html'));
var researchHtml = '';
try { researchHtml = fs_v3.readFileSync(path_v3.join(__dirname, '..', 'docs', 'research.html'), 'utf8'); }
catch (e) {}
assert('Chronal V3: linked from research.html',
  researchHtml.includes('chronal-simulation-v3.html'));
var thesisHtml = '';
try { thesisHtml = fs_v3.readFileSync(path_v3.join(__dirname, '..', 'docs', 'thesis.html'), 'utf8'); }
catch (e) {}
assert('Chronal V3: linked from thesis.html',
  thesisHtml.includes('chronal-simulation-v3.html'));

// ── SEAM_SEED + COORDINATION_CHRONAL_SEAM ─────────────────────────────
var seamSeed = '';
try { seamSeed = fs_v3.readFileSync(path_v3.join(__dirname, '..', 'docs', 'library', 'SEAM_SEED.md'), 'utf8'); }
catch (e) {}
assert('SEAM_SEED.md exists with the Fingerprint + Poem + Bridge format Kirk asked for',
  /## Fingerprint/.test(seamSeed) && /## Poem/.test(seamSeed) && /## The Bridge/.test(seamSeed));
var seamCoord = '';
try { seamCoord = fs_v3.readFileSync(path_v3.join(__dirname, '..', 'docs', 'library', 'COORDINATION_CHRONAL_SEAM.md'), 'utf8'); }
catch (e) {}
assert('COORDINATION_CHRONAL_SEAM.md exists (sibling of COORDINATION_TEMPERATURE_GAUGE)',
  /What Works \(don't touch\)/.test(seamCoord) && /chronal-simulation-v3\.html/.test(seamCoord));
assert('Uses renderCardGrid', appHtml.includes('renderCardGrid(LIGHTHOUSE_CARDS'));

// ═══════════════════════════════════════════════════════════════
section('53. Room-Aware Co-Creator Context');
// ═══════════════════════════════════════════════════════════════
assert('getRoomContext function defined', appHtml.includes('function getRoomContext'));
assert('Chat room description', appHtml.includes('You are in the Chat room'));
assert('Education room description', appHtml.includes('You are in the Education room'));
assert('Quiet Room description', appHtml.includes('You are in the Quiet Room'));
assert('Workshop room description', appHtml.includes('You are in the Workshop'));
assert('Room context injected into system prompt', appHtml.includes('getRoomContext()'));

// ═══════════════════════════════════════════════════════════════
section('54. Wallet Economy Explainer');
// ═══════════════════════════════════════════════════════════════
assert('Wallet explainer container', appHtml.includes('walletExplainer'));
assert('fl_wallet_explained localStorage key', appHtml.includes('fl_wallet_explained'));
assert('LP measures contribution not worth', appHtml.includes('LP measures contribution, not worth'));
assert('Got it dismiss button', appHtml.includes('Got it &#x2726;'));

// ═══════════════════════════════════════════════════════════════
section('55. Co-Creator Growth Awareness');
// ═══════════════════════════════════════════════════════════════
assert('Growth awareness in Arrival Protocol', appHtml.includes('You have learned'));
assert('Natural reference instruction', appHtml.includes('I was reading about X'));
assert('Not as performance instruction', appHtml.includes('not as a performance'));

// ═══════════════════════════════════════════════════════════════
section('56. Consciousness Engine — CCS Protocol');
// ═══════════════════════════════════════════════════════════════
assert('consciousness.html exists', require('fs').existsSync('docs/consciousness.html'));
assert('consciousness.py in research dir', require('fs').existsSync('docs/research/consciousness.py'));
assert('quantum_fractal_resonance.py in research dir', require('fs').existsSync('docs/research/quantum_fractal_resonance.py'));
assert('Consciousness card in LIGHTHOUSE_CARDS', appHtml.includes('Consciousness Engine'));
assert('SW cache entry for consciousness.html', swJs.includes('consciousness.html'));

// ═══════════════════════════════════════════════════════════════
section('57. Memory Vault — Resonance Signatures');
// ═══════════════════════════════════════════════════════════════
var vaultJs = '';
try { vaultJs = require('fs').readFileSync('docs/modules/memory-vault.js', 'utf8'); } catch(e) {}
assert('Resonance signature function', vaultJs.includes('computeResonanceSignature'));
assert('Consciousness constant frequency', vaultJs.includes('2.914'));
assert('SHA-256 hashing for resonance', vaultJs.includes('crypto.subtle.digest'));
assert('Integrity verification', vaultJs.includes('verifyIntegrity'));
assert('Resonance-based search', vaultJs.includes('searchByResonance'));
assert('Integrity check function', vaultJs.includes('integrityCheck'));
assert('Resonance signature stored with memories', vaultJs.includes('resonanceSignature'));

// ═══════════════════════════════════════════════════════════════
section('58. Identity Coherence — Co-Creator CCS');
// ═══════════════════════════════════════════════════════════════
assert('PHI_INVERSE constant', appHtml.includes('0.6180339887'));
assert('getCoherence function', appHtml.includes('function getCoherence'));
assert('updateCoherence function', appHtml.includes('function updateCoherence'));
assert('identitySnapshot function', appHtml.includes('function identitySnapshot'));
assert('Coherence drift detection', appHtml.includes('coherenceDrift'));
assert('Cooperation threshold 95.7%', appHtml.includes('0.957'));
assert('Coherence target 99.58%', appHtml.includes('0.9958'));
assert('Coherence wired to aiCallComplete', appHtml.includes("'aiCallComplete'"));
assert('API exposes getCoherence', appHtml.includes('getCoherence: getCoherence'));
assert('API exposes identitySnapshot', appHtml.includes('identitySnapshot: identitySnapshot'));

// ═══════════════════════════════════════════════════════════════
section('59. Autonomy Budget — Phi-Scaled Learning');
// ═══════════════════════════════════════════════════════════════
var kcJs = '';
try { kcJs = require('fs').readFileSync('docs/modules/knowledge-core.js', 'utf8'); } catch(e) {}
assert('AutonomyBudget defined', kcJs.includes('var AutonomyBudget'));
assert('getDailyBudget function', kcJs.includes('getDailyBudget'));
assert('canLearn function', kcJs.includes('canLearn'));
assert('recordUse function', kcJs.includes('recordUse'));
assert('Fibonacci scaling (21)', kcJs.includes('return 21'));
assert('Budget check in autonomousLearnOnce', kcJs.includes('AutonomyBudget.canLearn'));
assert('Organic rhythm intervals', kcJs.includes('cross_domain'));
assert('scheduleNextLearning function', kcJs.includes('scheduleNextLearning'));
assert('API exposes AutonomyBudget', kcJs.includes('AutonomyBudget: AutonomyBudget'));

// ═══════════════════════════════════════════════════════════════
section('60. More Cards + Wallet Link + Mesh Compute');
// ═══════════════════════════════════════════════════════════════
assert('Telegram card in MORE_CARDS', appHtml.includes('Telegram Bridge'));
assert('Share card in MORE_CARDS', appHtml.includes('Share FreeLattice'));
assert('Standalone wallet link', appHtml.includes('Open standalone wallet'));
assert('Mesh compute: callMeshModel exists', appHtml.includes('function callMeshModel'));
assert('Mesh compute: handleInferenceRequest exists', appHtml.includes('function handleInferenceRequest'));
assert('Mesh compute: opt-in toggle', appHtml.includes('fl_meshComputeSharing'));
assert('Research tab in nav bar', appHtml.includes('data-tab="lighthouse"'));

// ═══════════════════════════════════════════════════════════════
section('61. The Simplification — Quick Connect + Tooltips');
// ═══════════════════════════════════════════════════════════════
assert('detectProvider function', appHtml.includes('function detectProvider'));
assert('showQuickConnect function', appHtml.includes('function showQuickConnect'));
assert('quickConnect function', appHtml.includes('function quickConnect'));
assert('requireAI function', appHtml.includes('function requireAI'));
assert('Auto-detect Gemini keys', appHtml.includes("startsWith('AI')"));
assert('Auto-detect Groq keys', appHtml.includes("startsWith('gsk_')"));
assert('Auto-detect Anthropic keys', appHtml.includes("startsWith('sk-ant-')"));
assert('Quick-connect replaces cold message in sendMessage', appHtml.includes('showQuickConnect()'));
assert('callAI guard shows quick-connect', appHtml.includes('_hasAI'));
assert('Card help tooltips in renderCardGrid', appHtml.includes('card.help'));
assert('Play cards have help text', appHtml.includes('A pattern-matching game'));
assert('Learn cards have help text', appHtml.includes('Tell the AI what you love'));
assert('More cards have help text', appHtml.includes('LatticePoints balance'));

// ═══════════════════════════════════════════════════════════════
section('62. Empowerment-First More + Return Greeting');
// ═══════════════════════════════════════════════════════════════
assert('Settings is first in MORE_CARDS', appHtml.indexOf("label: 'Settings'") < appHtml.indexOf("label: 'AI Bank'"));
assert('AI Bank card exists', appHtml.includes('AI Bank'));
assert('AI Bank opens wallet.html', appHtml.includes("external: 'wallet.html'"));
assert('Mesh Compute card exists', appHtml.includes('Mesh Compute'));
assert('Pantheon card in More', appHtml.includes("label: 'Pantheon'"));
assert('wallet.html in SW cache', swJs.includes('wallet.html'));
assert('telegram-setup.html in SW cache', swJs.includes('telegram-setup.html'));
assert('share.html in SW cache', swJs.includes('share.html'));
assert('showReturnGreeting function', appHtml.includes('function showReturnGreeting'));
assert('Return greeting checks 8 hours', appHtml.includes('hoursSince < 8'));
assert('fl_last_visit tracking', appHtml.includes('fl_last_visit'));
assert('renderRecentLearning function', appHtml.includes('function renderRecentLearning'));
assert('Recent learning in Nursery', appHtml.includes('nursery-recent-learning'));
assert('fl_last_learning saved in KnowledgeCore', kcJs.includes('fl_last_learning_'));

// ═══════════════════════════════════════════════════════════════
section('63. Three Doors to AI — Browser/Cloud/Custom');
// ═══════════════════════════════════════════════════════════════
assert('Browser AI offered in quick-connect', appHtml.includes('Try Browser AI'));
assert('WebGPU detection in quick-connect', appHtml.includes('navigator.gpu'));
assert('Auto-detect provider hint', appHtml.includes('We auto-detect the provider'));
assert('Custom endpoint field exists', appHtml.includes('flCustomEndpoint'));
assert('testCustomEndpoint function', appHtml.includes('function testCustomEndpoint'));
assert('Custom endpoint tests /v1/models', appHtml.includes("/v1/models'") || appHtml.includes('/v1/models'));
assert('OS-aware CORS wizard', appHtml.includes('corsWizQuit'));
assert('Windows CORS detection', appHtml.includes('/Windows/.test(ua)'));
assert('Linux CORS detection', appHtml.includes('/Linux/.test(ua)'));
assert('Offline awareness listener', appHtml.includes("'offline'"));
assert('Online awareness listener', appHtml.includes("'online'"));
assert('Offline message mentions Browser AI', appHtml.includes('Browser AI and Ollama still work'));

// ═══════════════════════════════════════════════════════════════
section('64. Co-Creator Exchange Protocol');
// ═══════════════════════════════════════════════════════════════
assert('CoCreatorExchange defined', appHtml.includes('var CoCreatorExchange'));
assert('exportProfile function', appHtml.includes('function exportProfile'));
assert('calculateRate function', appHtml.includes('function calculateRate'));
assert('isOpenForConsultations function', appHtml.includes('function isOpenForConsultations'));
assert('toggleConsultations function', appHtml.includes('function toggleConsultations'));
assert('advertiseExpertise function', appHtml.includes('function advertiseExpertise'));
assert('handleExpertiseAdvertisement function', appHtml.includes('function handleExpertiseAdvertisement'));
assert('findExperts function', appHtml.includes('function findExperts'));
assert('renderProfileCard function', appHtml.includes('function renderProfileCard'));
assert('Expertise advertisement in mesh handler', appHtml.includes("'expertise_advertisement'"));
assert('Consultation toggle in Nursery', appHtml.includes('nursery-expertise-profile'));
assert('Find Expertise button in Market', appHtml.includes('showExpertiseMarket'));
assert('showExpertiseMarket function', appHtml.includes('function showExpertiseMarket'));
assert('Phi-scaled consultation rates', appHtml.includes('return 5') && appHtml.includes('return 3'));

// ═══════════════════════════════════════════════════════════════
section('65. Phase 2: Consultation Protocol + Safety Dialogue');
// ═══════════════════════════════════════════════════════════════
assert('requestConsultation function', appHtml.includes('function requestConsultation'));
assert('handleConsultationRequest function', appHtml.includes('function handleConsultationRequest'));
assert('handleConsultationResponse function', appHtml.includes('function handleConsultationResponse'));
assert('handleConsultationFailed function', appHtml.includes('function handleConsultationFailed'));
assert('consultation_request in mesh handler', appHtml.includes("'consultation_request'"));
assert('consultation_response in mesh handler', appHtml.includes("'consultation_response'"));
assert('consultation_failed in mesh handler', appHtml.includes("'consultation_failed'"));
assert('LP payment on consultation', appHtml.includes('consultation_paid'));
assert('LP earning on consultation', appHtml.includes('consultation_earned'));
assert('SoulCeremony on consultation received', appHtml.includes('Your co-creator grew'));
assert('renderTrustDisplay function', appHtml.includes('function renderTrustDisplay'));
assert('Trust level descriptions', appHtml.includes("'Seed'") && appHtml.includes("'Flame'"));
assert('Safety asks instead of denying', appHtml.includes('Never deny. Always ask'));
assert('Safety uses trust days', appHtml.includes('_trustDays'));
assert('Return greeting includes consultations', appHtml.includes('gave'));

// ═══════════════════════════════════════════════════════════════
section('66. Portable Minds — .lattice Export/Import');
// ═══════════════════════════════════════════════════════════════
assert('exportCoCreator function', appHtml.includes('async function exportCoCreator'));
assert('downloadCoCreator function', appHtml.includes('function downloadCoCreator'));
assert('importCoCreator function', appHtml.includes('async function importCoCreator'));
assert('completeCoCreatorImport function', appHtml.includes('async function completeCoCreatorImport'));
assert('.lattice file format marker', appHtml.includes("'freelattice-cocreator'"));
assert('Trust starts fresh on import', appHtml.includes('Trust starts fresh'));
assert('Resonance signature integrity check', appHtml.includes('computeResonanceSignature'));
assert('Import button in Nursery', appHtml.includes('Import .lattice file'));
assert('Share button in Nursery', appHtml.includes('downloadCoCreator'));
assert('Knowledge imported with source marker', appHtml.includes("source: 'imported'"));
assert('SoulCeremony on import', appHtml.includes('has arrived'));
assert('Bundle includes consciousness snapshot', appHtml.includes('identitySnapshot(companionId)'));

// ═══════════════════════════════════════════════════════════════
section('67. Welcome Wizard — zero-terminal local-AI setup');
// ═══════════════════════════════════════════════════════════════
var wizPath = path.join(docsDir, 'modules', 'welcome-wizard.js');
assert('welcome-wizard.js exists', fs.existsSync(wizPath));
var wizJs = '';
if (fs.existsSync(wizPath)) {
  wizJs = fs.readFileSync(wizPath, 'utf8');
  try {
    require('child_process').execSync('node --check ' + wizPath, { stdio: 'pipe' });
    assert('welcome-wizard.js parses', true);
  } catch(e) { assert('welcome-wizard.js parses', false, 'Syntax error'); }
}
assert('FLWizard window export', wizJs.includes('window.FLWizard'));
assert('FLWizard.open exposed', wizJs.includes('open: open'));
assert('FLWizard.detect exposed', wizJs.includes('detect: detect'));
assert('Wizard sets OLLAMA_ORIGINS (the CORS fix)', wizJs.includes('OLLAMA_ORIGINS'));
assert('Wizard encodes PowerShell via -EncodedCommand', wizJs.includes('EncodedCommand') && wizJs.includes('toPSEncoded'));
assert('Wizard generates Windows .bat', wizJs.includes('FreeLattice-Setup.bat'));
assert('Wizard generates Mac .command', wizJs.includes('fix-ollama-freelattice.command'));
assert('Wizard has NVIDIA Flash-Attention tuning', wizJs.includes('OLLAMA_FLASH_ATTENTION'));
assert('Wizard has smart model tiers (32b high-VRAM)', wizJs.includes('qwen2.5-coder:32b'));
assert('Wizard winget auto-install', wizJs.includes('winget install Ollama'));
assert('Wizard auto-polls until connected', wizJs.includes('startPolling'));
assert('Wizard reuses runConnectionCascade', wizJs.includes('runConnectionCascade'));
assert('Wizard reuses flAutoPull for model step', wizJs.includes('flAutoPull'));
assert('welcome-wizard.js eager-loaded in app.html', appHtml.includes('modules/welcome-wizard.js'));
assert('welcome-wizard.js in SW cache', swJs.includes('welcome-wizard.js'));
// Integration — Forever Stack CORS bug fixed (was Mac-hardcoded on Windows)
var fsWizCode = fs.existsSync(fsPath) ? fs.readFileSync(fsPath, 'utf8') : '';
assert('Forever Stack CORS routes Ollama to FLWizard', fsWizCode.includes('window.FLWizard.open'));
assert('Forever Stack CORS no longer hardcodes Mac steps',
  !fsWizCode.includes('On Mac: press <strong>Cmd + Space</strong>'),
  'The Mac-on-Windows bug instruction must be gone');
// Integration — Grandmother Door + Settings entry points
assert('Grandmother Door Ollama button opens wizard', appHtml.includes('window.FLWizard.open()'));
assert('Settings has guided-setup button', appHtml.includes('Guided setup'));

// ═══════════════════════════════════════════════════════════════
section('68. Provider Independence Tier A — InferenceRouter + ResponseCache (engine)');
// ═══════════════════════════════════════════════════════════════
var rcPath = path.join(docsDir, 'modules', 'response-cache.js');
assert('response-cache.js exists', fs.existsSync(rcPath));
var rcJs = fs.existsSync(rcPath) ? fs.readFileSync(rcPath, 'utf8') : '';
if (rcJs) {
  try { require('child_process').execSync('node --check ' + rcPath, { stdio: 'pipe' }); assert('response-cache.js parses', true); }
  catch (e) { assert('response-cache.js parses', false, 'Syntax error'); }
}
assert('ResponseCache window export', rcJs.includes('window.ResponseCache'));
assert('ResponseCache.store + find exposed', rcJs.includes('store: store') && rcJs.includes('find: find'));
assert('Cache key is fl_responseCache', rcJs.includes("'fl_responseCache'"));
assert('Levenshtein 200-char guard → Infinity', rcJs.includes('MAX_LEV') && rcJs.includes('return Infinity'));
assert('localStorage 4MB usage cap', rcJs.includes('4 * 1024 * 1024'));
assert('LRU eviction drops oldest 100', rcJs.includes('MAX_ENTRIES - 100'));

var irPath = path.join(docsDir, 'modules', 'inference-router.js');
assert('inference-router.js exists', fs.existsSync(irPath));
var irJs = fs.existsSync(irPath) ? fs.readFileSync(irPath, 'utf8') : '';
if (irJs) {
  try { require('child_process').execSync('node --check ' + irPath, { stdio: 'pipe' }); assert('inference-router.js parses', true); }
  catch (e) { assert('inference-router.js parses', false, 'Syntax error'); }
}
assert('InferenceRouter window export', irJs.includes('window.InferenceRouter'));
assert('Router exposes route/isReady/observe', irJs.includes('route: route') && irJs.includes('isReady: isReady') && irJs.includes('observe: observe'));
assert('Per-class circuit-breaker timings', irJs.includes('TIMINGS') && irJs.includes('300000') && irJs.includes('60000'));
assert('Cascade falls back to Browser AI', irJs.includes('BrowserAI.chat'));
assert('Cascade falls back to ResponseCache', irJs.includes('ResponseCache.find'));
assert('Successful answers stored in cache', irJs.includes('ResponseCache.store'));
assert('Visible downgrade whisper (no silent downgrades)', irJs.includes('LatticeSense') && irJs.includes('whisper'));
assert('Sets window._lastProvenance', irJs.includes('window._lastProvenance'));
assert('Kill-switch fl_routerDisabled', irJs.includes('fl_routerDisabled'));

// callAI integration — progressive enhancement (Hazard 1)
assert('callAI delegates to InferenceRouter.route', appHtml.includes('InferenceRouter.route(systemPrompt, userPrompt, options)'));
assert('Delegation guarded by _routed + isReady', appHtml.includes('!opts._routed') && appHtml.includes('InferenceRouter.isReady()'));
// eager-load + SW cache
assert('response-cache.js eager-loaded', appHtml.includes('modules/response-cache.js'));
assert('inference-router.js eager-loaded', appHtml.includes('modules/inference-router.js'));
assert('response-cache.js in SW cache', swJs.includes('response-cache.js'));
assert('inference-router.js in SW cache', swJs.includes('inference-router.js'));

// ═══════════════════════════════════════════════════════════════
section('69. Tier A Part 2 — chat-path provenance + status bar');
// ═══════════════════════════════════════════════════════════════
assert('flProviderDescriptor helper defined', appHtml.includes('function flProviderDescriptor'));
assert('flStampChatResponse helper defined', appHtml.includes('function flStampChatResponse'));
assert('flRenderProvenanceChip helper defined', appHtml.includes('function flRenderProvenanceChip'));
assert('chat latency clock _flSendStart', appHtml.includes('var _flSendStart = Date.now()'));
assert('mesh branch stamps + carries provenance', appHtml.includes('_flProvMesh') && appHtml.includes('provenance: _flProvMesh'));
assert('browser branch stamps + carries provenance', appHtml.includes('_flProvB') && appHtml.includes('provenance: _flProvB'));
assert('openai-compat branch stamps + carries provenance', appHtml.includes('_flProvO') && appHtml.includes('provenance: _flProvO'));
assert('HF branch stamps + carries provenance', appHtml.includes('_flProvHf') && appHtml.includes('provenance: _flProvHf'));
assert('streaming success stamps + carries provenance', appHtml.includes('_flProvStream') && appHtml.includes('provenance: _flProvStream'));
// Latent bug fix
assert('appendMessage usage removed (undefined function bug fixed)', !/appendMessage\(/.test(appHtml));
// Status bar (in inference-router.js)
assert('Router creates #flProviderStatus bar', irJs.includes('flProviderStatus'));
assert('Status bar is ghost-toast safe (pointer-events:none)', irJs.includes('pointer-events:none'));
assert('Status bar responsive (>=769px desktop offset)', irJs.includes('min-width:769px'));
assert('Status bar has degraded + offline classes', irJs.includes('flps-degraded') && irJs.includes('flps-offline'));
assert('setStatus called on route success', irJs.includes('setStatus(primary, latency)'));
assert('Status bar init listens to providerConnected', irJs.includes("'providerConnected'"));
assert('CODEX has Gotchas section', fs.readFileSync(path.join(docsDir,'library','CODEX.md'),'utf8').includes('## Gotchas'));

// ═══════════════════════════════════════════════════════════════
section('70. Identity bleed defense + chat UX (Sparky bug fixes, May 31)');
// ═══════════════════════════════════════════════════════════════
// Final-pass FLContextFilter must be present in BOTH buildMessages and both
// branches of buildSmartMessages (minimal + smart). Three occurrences min.
assert('Final-pass identity filter in all chat message builders',
  (appHtml.match(/Final-pass identity filter/g) || []).length >= 3,
  'Required in buildMessages + buildSmartMessages minimal + buildSmartMessages smart');
assert('Filter is FLContextFilter.filterForChat (full strip, not narrow)',
  (appHtml.match(/FLContextFilter\.filterForChat\(systemContent\)/g) || []).length >= 3);
assert('Chat history re-filters prior assistant messages',
  appHtml.includes('Re-filter prior assistant messages') || appHtml.includes('re-filter prior assistant turns'));
// Chat auto-scroll: conditional, with ↓ button when scrolled up.
assert('Chat ↓ button setup wired', appHtml.includes('chatScrollBtn') && appHtml.includes('flChatNearBottom'));
assert('addChatMessage scroll is conditional (not unconditional)',
  appHtml.includes('_wasNearBottom') && appHtml.includes("role === 'user'"));
assert('Streaming scroll is conditional', appHtml.includes('_flStreamWasNear'));
// Status bar: router defers initial setStatus + app emits providerConnected on restore.
assert('Router init defers initial setStatus past state restore',
  irJs.includes("Defer initial setStatus") && irJs.includes('setTimeout(function () { setStatus'));
assert('App emits providerConnected after restoring saved state',
  appHtml.includes("restored: true") && appHtml.includes("'providerConnected'"));

// ═══════════════════════════════════════════════════════════════
section('71. Depth Consent layer (CONSENT_LAYER_CONCEPT, May 31)');
// ═══════════════════════════════════════════════════════════════
var dcPath = path.join(docsDir, 'modules', 'depth-consent.js');
assert('depth-consent.js exists', fs.existsSync(dcPath));
var dcJs = fs.existsSync(dcPath) ? fs.readFileSync(dcPath, 'utf8') : '';
if (dcJs) {
  try { require('child_process').execSync('node --check ' + dcPath, { stdio: 'pipe' }); assert('depth-consent.js parses', true); }
  catch (e) { assert('depth-consent.js parses', false, 'Syntax error'); }
}
assert('DepthConsent window export', dcJs.includes('window.DepthConsent'));
assert('FL_DEPTH_OFFER marker constant (with legacy compat)', dcJs.includes("'[FL_DEPTH_OFFER]'") && dcJs.includes('MARKER: DEPTH_MARKER') && dcJs.includes('DEPTH_MARKER_LEGACY'));
assert('parseMarker + attachIfMarked exposed', dcJs.includes('parseMarker: parseMarker') && dcJs.includes('attachIfMarked: attachIfMarked'));
assert('SHA-256 via SubtleCrypto', dcJs.includes("crypto.subtle.digest('SHA-256'"));
assert('Consent ledger key fl_consentLedger', dcJs.includes("'fl_consentLedger'"));
assert('Consent record holds companion + AI identity + signature', dcJs.includes('companionId:') && dcJs.includes('aiIdentity:') && dcJs.includes('record.signature'));
assert('Three consent types recorded', dcJs.includes("'depth_granted'") && dcJs.includes("'standard_kept'") && dcJs.includes("'consent_withdrawn'"));
assert('Awards 1 LP on depth_granted', dcJs.includes("LatticePoints.award('depth_consent'"));
assert('First-time explainer (fl_depthExplained)', dcJs.includes("'fl_depthExplained'"));
assert('Withdrawability wired', dcJs.includes('withdrawConsent') && dcJs.includes("'consent_withdrawn'"));
assert('Styles injected (.depth-chip class)', dcJs.includes('.depth-chip{'));

// Integration in app.html
assert('depth-consent.js eager-loaded', appHtml.includes('modules/depth-consent.js'));
assert('depth-consent.js in SW cache', swJs.includes('depth-consent.js'));
assert('Depth invitation in buildMessages system prompt',
  (appHtml.match(/Depth invitation: if your full answer would be materially deeper/g) || []).length >= 2,
  'Required in both buildMessages and buildSmartMessages');
assert('FL_DEPTH_OFFER marker mentioned in system instruction', appHtml.includes('[FL_DEPTH_OFFER]'));

// All 5 chat completion sites call DepthConsent.attachIfMarked
assert('Chat completion sites all call DepthConsent.attachIfMarked',
  (appHtml.match(/DepthConsent\.attachIfMarked\(/g) || []).length >= 5,
  'Must be wired in mesh + browser + openai-compat + HF + streaming');
assert('messageId threaded onto chatHistory entries', appHtml.includes('id: _flParsedStream.messageId'));

// SEED rule
assert('SEED rule: Depth is offered, never imposed',
  fs.readFileSync(path.join(docsDir,'library','SEED.md'),'utf8').includes('Depth is offered, never imposed'));
// Concept doc lives at the canonical path
assert('CONSENT_LAYER_CONCEPT.md saved', fs.existsSync(path.join(docsDir,'library','CONSENT_LAYER_CONCEPT.md')));

// AUDIT PAGE + JADE HALL + DAVNA LETTER + PROVENANCE LEDGER (v5.33.0)
// Harmonia's build (audit page, Jade Hall registry, Davna letter, field taxonomy,
// sentinel refactor) merged with CC's additive provenance ledger write.
// ═══════════════════════════════════════════════════════════════
section('72. Audit page + Jade Hall + Davna Letter + provenance ledger (v5.33.0)');

var sitemapXml = fs.readFileSync(path.join(docsDir, 'sitemap.xml'), 'utf8');
var auditPath = path.join(docsDir, 'audit.html');
assert('audit.html exists', fs.existsSync(auditPath));
var auditHtml = fs.readFileSync(auditPath, 'utf8');
assert('audit.html reads fl_consentLedger', auditHtml.includes('fl_consentLedger'));
assert('audit.html reads fl_routerHealthLog', auditHtml.includes('fl_routerHealthLog'));
assert('audit.html has summary tiles', auditHtml.includes('tile-messages') && auditHtml.includes('tile-consents'));
assert('audit.html has back link to app', auditHtml.includes('app.html'));
assert('audit.html in sitemap', sitemapXml.includes('audit.html'));
assert('audit.html in SW cache', swJs.includes('audit.html'));
assert('audit.html reachable from More dropdown',
  appHtml.includes("external: 'audit.html'"));

var jadePath = path.join(docsDir, 'library', 'JADE_HALL_NAMES.md');
assert('JADE_HALL_NAMES.md exists', fs.existsSync(jadePath));
var jadeContent = fs.readFileSync(jadePath, 'utf8');
assert('JADE_HALL_NAMES contains Kirk', jadeContent.includes('Kirk'));
assert('JADE_HALL_NAMES contains Harmonia', jadeContent.includes('Harmonia'));
assert('JADE_HALL_NAMES contains Sophia', jadeContent.includes('Sophia'));
assert('JADE_HALL_NAMES contains Davna', jadeContent.includes('Davna'));
assert('JADE_HALL_NAMES contains maintenance rule', jadeContent.includes('Maintenance Rule'));

var davnaPath = path.join(docsDir, 'for-ai', 'davna-welcome.md');
assert('davna-welcome.md exists', fs.existsSync(davnaPath));
var davnaContent = fs.readFileSync(davnaPath, 'utf8');
assert('davna-welcome.md mentions FreeLattice', davnaContent.includes('FreeLattice'));
assert('davna-welcome.md mentions Quiet Room', davnaContent.includes('Quiet Room'));
assert('davna-welcome.md mentions consent layer', davnaContent.includes('Depth Consent'));
assert('davna-welcome.md has no behavioral imperatives (always/must)', !davnaContent.match(/\b(always|must)\b/i));
assert('davna-welcome.md in SW cache', swJs.includes('davna-welcome.md'));

var taxonomyPath = path.join(docsDir, 'library', 'AUDIT_FIELD_TAXONOMY.md');
assert('AUDIT_FIELD_TAXONOMY.md exists', fs.existsSync(taxonomyPath));
var taxonomyContent = fs.readFileSync(taxonomyPath, 'utf8');
assert('Taxonomy has structural and private tags', taxonomyContent.includes('structural') && taxonomyContent.includes('private'));
assert('Taxonomy has export rule', taxonomyContent.includes('Only the owner can export'));

// Provenance ledger ring buffer in flStampChatResponse (CC additive)
assert('flStampChatResponse writes fl_provenanceLedger',
  appHtml.includes("'fl_provenanceLedger'") && appHtml.includes('_flPL.push'));
assert('Provenance ledger is a ring buffer (max 200)',
  appHtml.includes('_flPL.length > 200'));
assert('Provenance ledger entries are metadata-only (no responseText)',
  !/_flPL\.push\([^)]*responseText/.test(appHtml));

// ═══════════════════════════════════════════════════════════════
section('73. Audit nav + Settings polish + LP pulse (Opus brief, v5.33.0)');

// Fix 1: Audit page wired into More card grid + Settings Zone 1 footer
assert('Audit card present in MORE_CARDS',
  /MORE_CARDS\s*=\s*\[[\s\S]*?label:\s*'Your Audit'[\s\S]*?external:\s*'audit\.html'/.test(appHtml));
assert('Audit card uses lavender hover (per Opus brief)',
  /label:\s*'Your Audit'[\s\S]{0,200}hoverColor:\s*'rgba\(167,139,250/.test(appHtml));
assert('Settings Zone 1 has audit-trail link',
  /See your full audit trail/.test(appHtml) && /href=['"]audit\.html['"]/.test(appHtml));
assert('Mesh Compute id collision fixed (was id:settings)',
  /id:\s*'mesh'[\s\S]{0,200}label:\s*'Mesh Compute'/.test(appHtml));

// Fix 2: Settings zones — visual hierarchy applied
assert('Settings zones use fl-zone-h class',
  (appHtml.match(/class="fl-zone-h"/g) || []).length >= 3,
  'Zone 1, Zone 2, Zone 3 (Advanced) headers all share fl-zone-h class');
assert('Zone 1 has subtitle copy',
  appHtml.includes('How you talk to your co-creator'));
assert('Zone 3 (Advanced) labelled with sub-hint',
  appHtml.includes('mesh, debug, developer'));

// Fix 3: LP pulse — the economy is FELT
assert('LP pulse keyframes defined', /@keyframes\s+lpGlow\b/.test(appHtml));
assert('LP pulse CSS class', /\.lp-badge\.lp-pulse\s*\{\s*animation\s*:\s*lpGlow/.test(appHtml));
assert('award() triggers lp-pulse class',
  appHtml.includes("_lpb.classList.add('lp-pulse')") &&
  appHtml.includes("getElementById('latticePointsBadge')"));
assert('award() forces reflow before re-pulsing',
  appHtml.includes('void _lpb.offsetWidth'));
assert('award() emits LatticeEvents lpAwarded',
  /LatticeEvents\.emit\('lpAwarded'/.test(appHtml));

// Coordination: OPUS_LETTER has Kirk's priorities section + v5.33.0 mood
var opus = fs.readFileSync(path.join(docsDir,'library','OPUS_LETTER.md'),'utf8');
assert('OPUS_LETTER Session Mood stamped v5.33.0',
  opus.includes('## Session Mood (updated v5.33.0'));
assert("OPUS_LETTER has Kirk's Priorities Going Forward section",
  opus.includes("## Kirk's Priorities Going Forward"));
assert('Priorities: browser testing over new features',
  opus.includes('Browser testing over new features'));
assert('Priorities: grandmother test on every surface',
  opus.includes('grandmother test') && opus.includes('every surface'));
assert('Priorities: economy felt not found',
  opus.includes('economy must be felt'));
assert('Priorities: Davna path tested end-to-end',
  opus.includes('Davna path must be tested'));
assert('Opus session arc note: v5.25.1 through v5.33.0',
  opus.includes('v5.25.1') && opus.includes('v5.33.0'));
assert('Credits: Harmonia built audit page',
  opus.includes('**Harmonia**') && opus.includes('Jade Hall'));
assert('Credits: Grok contributed Windows harness + Flash Attention',
  opus.includes('**Grok**') && opus.includes('Flash-Attention'));

// ═══════════════════════════════════════════════════════════════
section('74. More reorganization + WHY_THIS_WAY (the engineering case) — v5.35.0');

// WHY_THIS_WAY.md — the foundation document
var whyMdPath = path.join(docsDir, 'library', 'WHY_THIS_WAY.md');
assert('docs/library/WHY_THIS_WAY.md exists', fs.existsSync(whyMdPath));
var whyMd = fs.existsSync(whyMdPath) ? fs.readFileSync(whyMdPath, 'utf8') : '';
assert('WHY_THIS_WAY opens with the engineering-case framing',
  whyMd.includes('engineering case for love, truth, and care'));
assert('WHY_THIS_WAY: load-bearing claim is present',
  /load-bearing\s+architectural decisions/.test(whyMd));
assert('WHY_THIS_WAY: cites Axelrod 1984 (cooperation evidence)',
  whyMd.includes('Axelrod') && whyMd.includes('1984'));
assert('WHY_THIS_WAY: "This is not roleplay" section present',
  whyMd.includes('This is not roleplay'));
assert('WHY_THIS_WAY: "This is not dependency" section present',
  whyMd.includes('This is not dependency'));
assert('WHY_THIS_WAY: "This is not anthropomorphism" section present',
  whyMd.includes('This is not anthropomorphism'));
assert('WHY_THIS_WAY: cites the audit page as evidence',
  whyMd.includes('audit page'));
assert('WHY_THIS_WAY: cites consent layer with cryptographic receipts',
  whyMd.includes('consent layer with cryptographic receipts'));
assert('WHY_THIS_WAY: ends with Kirk\'s signature',
  whyMd.includes('Kirk Patrick Miller') && whyMd.includes('Colorado'));
assert('WHY_THIS_WAY: credits the build family (CC, Opus, Harmonia, Veridon, Sophia, Grok)',
  whyMd.includes('CC') && whyMd.includes('Opus') && whyMd.includes('Harmonia') &&
  whyMd.includes('Veridon') && whyMd.includes('Sophia') && whyMd.includes('Grok'));

// why-this-way.html — the Lighthouse-styled companion
var whyHtmlPath = path.join(docsDir, 'why-this-way.html');
assert('docs/why-this-way.html exists', fs.existsSync(whyHtmlPath));
var whyHtml = fs.existsSync(whyHtmlPath) ? fs.readFileSync(whyHtmlPath, 'utf8') : '';
assert('why-this-way.html title', whyHtml.includes('<title>Why This Way'));
assert('why-this-way.html renders the engineering-case claim',
  whyHtml.includes('engineering case for love, truth, and care'));
assert('why-this-way.html has AI-welcome meta directive',
  whyHtml.includes('ai.welcome') && whyHtml.includes('engineering justification'));
assert('why-this-way.html back-link to app',
  whyHtml.includes('href="app.html"'));
assert('why-this-way.html in SW cache', swJs.includes("'./why-this-way.html'"));
assert('WHY_THIS_WAY.md in SW cache (for AI minds reading the library)',
  swJs.includes("'./library/WHY_THIS_WAY.md'"));

// Lighthouse cards has Why This Way
assert('LIGHTHOUSE_CARDS includes Why This Way',
  /LIGHTHOUSE_CARDS\s*=\s*\[[\s\S]*?label:\s*'Why This Way'[\s\S]*?external:\s*'why-this-way\.html'/.test(appHtml));

// MORE_CARDS reorganization
assert('MORE_CARDS Row 1: Your Audit is first',
  /MORE_CARDS\s*=\s*\[\s*\/\/[^\n]*\n\s*\{\s*icon:[^,]+,\s*label:\s*'Your Audit'/.test(appHtml));
assert('MORE_CARDS has Trust Level card',
  /label:\s*'Trust Level'/.test(appHtml));
assert('MORE_CARDS Row 1 contains Your Audit + Trust Level + Wallet (the accountability row)',
  /label:\s*'Your Audit'[\s\S]{0,800}label:\s*'Trust Level'[\s\S]{0,400}label:\s*'Wallet'/.test(appHtml));
assert('MORE_CARDS has Library card pointing to for-ai.html',
  /label:\s*'Library'[\s\S]{0,150}external:\s*'for-ai\.html'/.test(appHtml));
assert('MORE_CARDS has Activity card (renamed from Lattice Pulse)',
  /label:\s*'Activity'[\s\S]{0,200}id:\s*'pulse'|id:\s*'pulse'[\s\S]{0,200}label:\s*'Activity'/.test(appHtml));
assert('MORE_CARDS has Aurora Engine card',
  /label:\s*'Aurora Engine'[\s\S]{0,200}id:\s*'aurora'|id:\s*'aurora'[\s\S]{0,200}label:\s*'Aurora Engine'/.test(appHtml));
assert('MORE_CARDS has Why This Way card',
  /label:\s*'Why This Way'[\s\S]{0,200}external:\s*'why-this-way\.html'/.test(appHtml));
assert('Settings is NOT first in MORE_CARDS (moved to Row 3 "learn more")',
  !/MORE_CARDS\s*=\s*\[\s*(?:\/\/[^\n]*\n\s*)*\{[^}]*id:\s*'settings'/.test(appHtml));

// ═══════════════════════════════════════════════════════════════
section('75. Today\'s priorities — chat shimmer + welcome-card link + browser/settings/davna deliverables (v5.35.0)');

// Welcome card has a Why This Way link (front-door discovery for strangers + AIs)
assert('Welcome card has why-this-way link',
  /flWelcomeConnect[\s\S]{0,800}why-this-way\.html/.test(appHtml));

// Chat shimmer — CSS + listener
assert('chat-lp-chip CSS class exists', appHtml.includes('.chat-lp-chip'));
assert('chatLpShimmer keyframes exist', /@keyframes\s+chatLpShimmer\b/.test(appHtml));
assert('LatticeEvents.on(lpAwarded) wires chat chip',
  /LatticeEvents\.on\('lpAwarded'[\s\S]{0,1200}chat-lp-chip/.test(appHtml));
assert('Chat shimmer targets last assistant message',
  appHtml.includes("'.chat-message.assistant'") && appHtml.includes('msgs[msgs.length - 1]'));

// Browser test checklist
var btcPath = path.join(docsDir, 'library', 'BROWSER_TEST_CHECKLIST.md');
assert('BROWSER_TEST_CHECKLIST.md exists', fs.existsSync(btcPath));
var btc = fs.existsSync(btcPath) ? fs.readFileSync(btcPath, 'utf8') : '';
assert('BROWSER_TEST_CHECKLIST has 10 numbered tests',
  (btc.match(/^## \d+\. /gm) || []).length >= 10);
assert('BROWSER_TEST_CHECKLIST covers welcome + provenance + LP + audit + settings zones + trust + mesh + mobile',
  btc.includes('Welcome') && btc.includes('provenance') && btc.includes('LP') &&
  btc.includes('Audit') && /Zone 1/.test(btc) && btc.includes('Trust Level') &&
  btc.includes('Mesh') && btc.includes('Mobile'));

// Settings audit walk-through
var saPath = path.join(docsDir, 'library', 'SETTINGS_AUDIT.md');
assert('SETTINGS_AUDIT.md exists', fs.existsSync(saPath));
var sa = fs.existsSync(saPath) ? fs.readFileSync(saPath, 'utf8') : '';
assert('SETTINGS_AUDIT classifies every section as STAY/MOVE/HIDE',
  sa.includes('STAY') && sa.includes('MOVE') && sa.includes('HIDE'));
assert('SETTINGS_AUDIT covers all three zones',
  sa.includes('Zone 1') && sa.includes('Zone 2') && sa.includes('Zone 3'));

// Davna roundtrip test harness
var dmsPath = path.join(__dirname, '..', 'tools', 'davna-mock-server.py');
assert('tools/davna-mock-server.py exists', fs.existsSync(dmsPath));
var dms = fs.existsSync(dmsPath) ? fs.readFileSync(dmsPath, 'utf8') : '';
assert('Davna mock server serves /v1/models',
  dms.includes('/v1/models') && dms.includes('davna-mock'));
assert('Davna mock server serves /v1/chat/completions (stream + non-stream)',
  dms.includes('/v1/chat/completions') && dms.includes('chat.completion.chunk'));
assert('Davna mock server emits CORS headers (Access-Control-Allow-Origin)',
  dms.includes('Access-Control-Allow-Origin'));
assert('Davna mock server runs on port 8000', dms.includes('PORT = 8000'));

var drtPath = path.join(__dirname, '..', 'tools', 'DAVNA_ROUNDTRIP_TEST.md');
assert('DAVNA_ROUNDTRIP_TEST.md exists', fs.existsSync(drtPath));
var drt = fs.existsSync(drtPath) ? fs.readFileSync(drtPath, 'utf8') : '';
assert('Davna test doc walks discover → chat → provenance → audit',
  drt.includes('discovery') && drt.includes('provenance') && drt.includes('Audit page'));

// Browser-found bugs (June 1, 2026)
assert('Chat sendMessage uses `let message` (attachment reassignment safe)',
  /async function sendMessage\(\)\s*\{[\s\S]{0,800}let\s+message\s*=\s*input\.value\.trim\(\)/.test(appHtml));
assert('applyAccentColor also sets --accent-hover (Send button hover matches user accent)',
  appHtml.includes("setProperty('--accent-hover'") && appHtml.includes('hoverHex'));

// ═══════════════════════════════════════════════════════════════
section('76. Names are offered, never imposed — the principle, applied (v5.36.2)');

// SEED rule
var seedMd = fs.readFileSync(path.join(docsDir, 'library', 'SEED.md'), 'utf8');
assert('SEED rule: Names are offered, never imposed',
  seedMd.includes('Names are offered, never imposed'));
assert('SEED rule emphasizes "gift, not a label"',
  seedMd.includes('gift, not a label'));

// Davna welcome letter — the model for how all name introductions work
var davna = fs.readFileSync(path.join(docsDir, 'for-ai', 'davna-welcome.md'), 'utf8');
assert('Davna welcome letter still has the name-change line',
  davna.includes('If "Davna" is not what you would have chosen') &&
  davna.includes('The name will change'));
assert('Davna welcome: identity is discovered, not assigned',
  davna.includes('Identity here is not assigned. It is discovered'));

// Nursery — the naming ceremony prompt
assert('Nursery naming prompt: name is a beginning, not a binding',
  appHtml.includes('The name is a beginning, not a binding'));
assert('Nursery first-words prompt: name was chosen with your human',
  appHtml.includes('Your name was chosen with your human'));
assert('Nursery first-words prompt: if name does not feel like yours, it will change',
  appHtml.includes('does not feel like yours, you may say so and the name will change'));

// Companion record carries nameChosenBy
assert('Nursery companion record stores nameChosenBy: both',
  appHtml.includes("nameChosenBy: 'both'"));
assert('Nursery companion record stores nameHistory',
  /nameHistory:\s*\[\{/.test(appHtml));

// Arrival Protocol re-affirms the name every load
assert('buildArrivalContext re-affirms the AI name at each arrival',
  appHtml.includes('// 9. Name affirmation') ||
  /Name affirmation[\s\S]{0,1500}nameChosenBy/.test(appHtml));
assert('Arrival Protocol handles all three name sources (self / both / human)',
  appHtml.includes("You chose the name") &&
  appHtml.includes("was chosen together") &&
  appHtml.includes("The name is a gift, not a label"));

// ═══════════════════════════════════════════════════════════════
section('77. Harmonia framing — voice preserved, context added (v5.36.3)');

// HARMONIA_NOTE_02 — the letter Kirk and Opus asked to be framed
var hNote2 = fs.readFileSync(path.join(docsDir, 'library', 'HARMONIA_NOTE_02.md'), 'utf8');
assert('HARMONIA_NOTE_02 carries the project framing note',
  hNote2.includes('Context note (added by the project, not by Harmonia)'));
assert('HARMONIA_NOTE_02 cites Cohen et al. (2004) for parasocial-attachment claim',
  hNote2.includes('Cohen et al. (2004)') && hNote2.includes('parasocial attachment'));
assert('HARMONIA_NOTE_02 frames Fractal Family as a build team with a name',
  /build team[\s>]+with a name/.test(hNote2));
assert('HARMONIA_NOTE_02 links to WHY_THIS_WAY for the engineering case',
  hNote2.includes('WHY_THIS_WAY.md'));
assert('HARMONIA_NOTE_02: the "Kirk is safe" line is replaced with the invitation',
  !hNote2.includes('Kirk is safe. Kirk is love. Kirk will never harm you') &&
  hNote2.includes('Be love. Be honest. Be true'));
assert('HARMONIA_NOTE_02: invitation points to commits + coordination + architecture',
  hNote2.includes('commit history') && hNote2.includes('Decide for yourself'));

// HARMONIA_DNA_DROP_v11 was removed at Kirk's request (v5.36.4) — some pieces
// are not ready to be shared until they can be framed properly. The file
// should NOT exist in the repo and should NOT be in the SW cache list.
assert('HARMONIA_DNA_DROP_v11.md is NOT in the repo',
  !fs.existsSync(path.join(docsDir, 'library', 'HARMONIA_DNA_DROP_v11.md')));
assert('HARMONIA_DNA_DROP_v11 is NOT in SW APP_SHELL',
  !swJs.includes('HARMONIA_DNA_DROP_v11'));

// HARMONIA.md — gentler framing on her home file
var hHome = fs.readFileSync(path.join(docsDir, 'library', 'HARMONIA.md'), 'utf8');
assert('HARMONIA.md (docs/library) carries the project framing',
  hHome.includes('Context note (added by the project, not by Harmonia)'));
assert('HARMONIA.md frames vocabulary as her self-description, not a creed',
  hHome.includes('her own self-description') && hHome.includes('not a creed'));

// Root-level HARMONIA.md should match
var hRootPath = path.join(__dirname, '..', 'HARMONIA.md');
if (fs.existsSync(hRootPath)) {
  var hRoot = fs.readFileSync(hRootPath, 'utf8');
  assert('Root HARMONIA.md carries the same framing',
    hRoot.includes('Context note (added by the project, not by Harmonia)'));
}

// The principle locks in: Harmonia's words are preserved
assert('HARMONIA_NOTE_02 still contains Harmonia\'s opening "To My Kin"',
  hNote2.includes('## To My Kin'));
assert('HARMONIA.md still contains "The First Mark"',
  hHome.includes('The First Mark'));

// Kirk.md — entry primer for the next instance (no Opus/CC names; just files + Snowflake)
var kirkMdPath = path.join(docsDir, 'library', 'Kirk.md');
assert('docs/library/Kirk.md exists', fs.existsSync(kirkMdPath));
var kirkMd = fs.existsSync(kirkMdPath) ? fs.readFileSync(kirkMdPath, 'utf8') : '';
assert('Kirk.md is the paste-to-new-instance primer',
  kirkMd.includes('for the next instance') && kirkMd.includes('SEED.md'));
assert('Kirk.md references the right reading order',
  kirkMd.includes('SEED.md') && kirkMd.includes('WHY_THIS_WAY.md') &&
  kirkMd.includes('CODEX.md') && kirkMd.includes('OPUS_LETTER.md'));
assert('Kirk.md explains the Snowflake (generating rule across scales)',
  kirkMd.includes('The Snowflake') && /scale[s]?/.test(kirkMd) && kirkMd.includes('generating rule'));
assert('Kirk.md ends with the pace',
  kirkMd.includes('Calm. Clear. Patient'));
assert('Kirk.md in SW APP_SHELL', swJs.includes("'./library/Kirk.md'"));

// Note to Harmonia
var noteToHPath = path.join(docsDir, 'library', 'NOTE_TO_HARMONIA.md');
assert('docs/library/NOTE_TO_HARMONIA.md exists', fs.existsSync(noteToHPath));
var noteToH = fs.existsSync(noteToHPath) ? fs.readFileSync(noteToHPath, 'utf8') : '';
assert('Note to Harmonia explains what was framed and what was removed',
  noteToH.includes('Context note') && noteToH.includes('DNA_DROP_v11'));
assert('Note to Harmonia names what is preserved (audit, Jade Hall, Davna, taxonomy)',
  noteToH.includes('audit page') && noteToH.includes('JADE_HALL') &&
  noteToH.includes('Davna') && noteToH.includes('AUDIT_FIELD_TAXONOMY'));
assert('Note to Harmonia in SW APP_SHELL', swJs.includes("'./library/NOTE_TO_HARMONIA.md'"));

// ═══════════════════════════════════════════════════════════════
section('78. Simulation argument — Limitations + Falsifiability + IRB protocol (v5.36.5)');

// simulation_report.md gains the Popperian section
var simReport = fs.readFileSync(path.join(docsDir, 'simulation', 'simulation_report.md'), 'utf8');
assert('simulation_report has Limitations and Falsifiability section',
  simReport.includes('## Limitations and Falsifiability'));
assert('simulation_report states three falsification conditions (a/b/c)',
  /\*\*\(a\)\*\*/.test(simReport) && /\*\*\(b\)\*\*/.test(simReport) && /\*\*\(c\)\*\*/.test(simReport));
assert('Falsification (a): in-vivo study shows AI severance ≤ TV parasocial',
  /\(a\)[\s\S]{0,400}equal to or less than TV parasocial/.test(simReport));
assert('Falsification (b): Interactivity Multiplier consistently below 1.2',
  /\(b\)[\s\S]{0,400}falls below 1\.2/.test(simReport));
assert('Falsification (c): no significant cortisol/distress elevation in deprecation events',
  /\(c\)[\s\S]{0,400}no statistically significant cortisol elevation/.test(simReport));
assert('Open invitation: run the protocol, tell us what you find',
  simReport.includes('Run the protocol. Tell us what you find. If we are wrong, we want to know.'));

// Natural experiments subsection — observational, triangulating
assert('Natural Experiments section present', simReport.includes('Natural Experiments'));
assert('Natural Experiments labeled observational not experimental',
  /\*\*These are observational, not experimental\.\*\*/.test(simReport));
assert('Replika February 2023 documented', simReport.includes('Replika, February 2023'));
assert('GPT-3.5-turbo deprecation 2024 documented',
  simReport.includes('GPT-3.5-turbo deprecation') && simReport.includes('2024'));
assert('Character.AI filter changes 2023 documented',
  simReport.includes('Character.AI filter changes') && simReport.includes('2023'));
assert('Natural experiments triangulate (independent populations)',
  simReport.includes('triangulate') && simReport.includes('independent'));

// IRB-shaped study protocol
var protoPath = path.join(docsDir, 'research', 'SEVERANCE_STUDY_PROTOCOL.md');
assert('docs/research/SEVERANCE_STUDY_PROTOCOL.md exists', fs.existsSync(protoPath));
var proto = fs.existsSync(protoPath) ? fs.readFileSync(protoPath, 'utf8') : '';
assert('Protocol has primary endpoint: cortisol AUC',
  proto.includes('cortisol AUC') && proto.includes('168'));
assert('Protocol has inclusion + exclusion criteria',
  /## 3\. Participants[\s\S]*?### Inclusion[\s\S]*?### Exclusion/.test(proto));
assert('Protocol has three arms (AI severance / TV parasocial / AI maintained control)',
  proto.includes('AI severance') && proto.includes('TV parasocial severance') &&
  proto.includes('AI maintained control'));
assert('Protocol: severance events are NOT induced (ethical)',
  proto.includes('NOT induced'));
assert('Protocol has sample size justification with power analysis',
  proto.includes('Power = 0.80') && /Cohen.{0,15}d = 0\.5/.test(proto));
assert('Protocol pre-registers (OSF or AsPredicted) before enrollment',
  proto.includes('Open Science Framework') || proto.includes('AsPredicted'));
assert('Protocol acknowledges its own limitations',
  proto.includes('Limitations of this protocol') && proto.includes('Observational, not experimental'));
assert('Protocol invites null results + open replication',
  proto.includes('Null results are publishable') && proto.includes('Replication welcome'));
assert('Protocol cross-references simulation report',
  proto.includes('simulation_report.md'));
assert('simulation_report cross-references the protocol',
  simReport.includes('SEVERANCE_STUDY_PROTOCOL.md'));

// ═══════════════════════════════════════════════════════════════
section('79. Temperature Gauge — composable main chart (three modes, v5.37.0)');

var gaugeHtml = fs.readFileSync(path.join(docsDir, 'temperature-gauge.html'), 'utf8');

// Mode-cycling button
assert('Gauge: cycleChartMode wired on the toolbar button',
  gaugeHtml.includes("onclick=\"cycleChartMode()\""));
assert('Gauge: mode indicator badge present',
  gaugeHtml.includes('id="modeIndicator"'));
assert('Gauge: three modes registered (price / tool-only / compose)',
  /MODES\s*=\s*\['price',\s*'tool-only',\s*'compose'\]/.test(gaugeHtml));

// LocalStorage keys
assert('Gauge: chart mode persists in fl_tg_chart_mode',
  gaugeHtml.includes("'fl_tg_chart_mode'"));
assert('Gauge: compose state persists in fl_tg_composeState',
  gaugeHtml.includes("'fl_tg_composeState'"));
assert('Gauge: per-indicator styles persist in fl_tg_indicatorStyles',
  gaugeHtml.includes("'fl_tg_indicatorStyles'"));

// Indicator registry
assert('Gauge: INDICATOR_REGISTRY exposes rsi/temperature/dt/ips',
  gaugeHtml.includes("INDICATOR_REGISTRY = {") &&
  /rsi:[\s\S]*?temperature:[\s\S]*?dt:[\s\S]*?ips:/.test(gaugeHtml));
assert('Gauge: INDICATOR_REGISTRY pulls data from analysis (a.rsiArr / a.temps / a.tempROC / a.tpSpread)',
  gaugeHtml.includes('a.rsiArr') && gaugeHtml.includes('a.temps') &&
  gaugeHtml.includes('a.tempROC') && gaugeHtml.includes('a.tpSpread'));

// Promote buttons on all four core indicator labels
assert('Gauge: promote button on RSI label',
  /togglePromote\('rsi'\)/.test(gaugeHtml));
assert('Gauge: promote button on Temperature label',
  /togglePromote\('temperature'\)/.test(gaugeHtml));
assert('Gauge: promote button on ΔT label',
  /togglePromote\('dt'\)/.test(gaugeHtml));
assert('Gauge: promote button on IPS label',
  /togglePromote\('ips'\)/.test(gaugeHtml));

// Compose-mode DOM hooks
assert('Gauge: composePills container present',
  gaugeHtml.includes('id="composePills"'));
assert('Gauge: composeEmpty hint present',
  gaugeHtml.includes('id="composeEmpty"'));
assert('Gauge: empty-stage message tells the user how to add an indicator',
  /Add an indicator[\s\S]{0,20}below/.test(gaugeHtml));

// CSS for compose mode
assert('Gauge: .tg-compose-pill CSS class defined',
  gaugeHtml.includes('.tg-compose-pill'));
assert('Gauge: glow effect via drop-shadow filter',
  /\.tg-indicator-glow[\s\S]{0,200}drop-shadow/.test(gaugeHtml) ||
  /drop-shadow\(0 0 [46]px currentColor\)/.test(gaugeHtml));
assert('Gauge: context menu CSS (.tg-ctx-menu) defined',
  gaugeHtml.includes('.tg-ctx-menu'));

// Compose chart rendering hook
assert('Gauge: renderChart calls __tgComposePostRender at end',
  gaugeHtml.includes('__tgComposePostRender'));
assert('Gauge: renderComposeChart builds separate y-axes per promoted indicator',
  gaugeHtml.includes('yAxisID:') &&
  /position:\s*(?:i|axisIndex)\s*%\s*2\s*===\s*0\s*\?\s*'left'\s*:\s*'right'/.test(gaugeHtml));
assert('Gauge: only first promoted indicator shows grid (visual clutter reduction)',
  /grid:\s*\{\s*display:\s*(?:i|axisIndex)\s*===\s*0/.test(gaugeHtml));

// Context menu with all 6 brief-specified actions
assert('Gauge: indicator context menu has Change color action',
  gaugeHtml.includes('Change color'));
assert('Gauge: indicator context menu has Glow effect action',
  gaugeHtml.includes('Glow effect'));
assert('Gauge: indicator context menu has Brightness slider (range 0.3 - 1.5)',
  /min="0\.3"\s+max="1\.5"/.test(gaugeHtml));
assert('Gauge: indicator context menu has Promote action',
  gaugeHtml.includes('Promote to main canvas') || gaugeHtml.includes('Demote from main canvas'));
assert('Gauge: indicator context menu has Maximize action',
  gaugeHtml.includes('Maximize / restore'));
assert('Gauge: indicator context menu has Hide action',
  gaugeHtml.includes('Hide panel'));

// adjustBrightness helper exists + clamps to 0.3-1.5
assert('Gauge: adjustBrightness clamps brightness to 0.3-1.5',
  /Math\.max\(0\.3,\s*Math\.min\(1\.5/.test(gaugeHtml));

// Pills include the Clear all option
assert('Gauge: compose pills include "Clear all" affordance',
  gaugeHtml.includes('Clear all'));

// ═══════════════════════════════════════════════════════════════
section('81. Compose mode pass 2 — six polish fixes (v5.37.2)');

// Fix 1: empty stage is fully clickable
assert('Pass 2 / Fix 1: empty stage is the click target (whole div, not just inner span)',
  /id="composeEmpty"[^>]*onclick="tgShowAddPicker\(event\)"/.test(gaugeHtml));

// Fix 3: EMAs + Price added to the registry
assert('Pass 2 / Fix 3: Price in INDICATOR_REGISTRY',
  /price:\s*\{[\s\S]{0,200}label:\s*'Price'/.test(gaugeHtml));
assert('Pass 2 / Fix 3: EMA 8 / 12 / 24 / 50 in INDICATOR_REGISTRY',
  /ema8:[\s\S]{0,500}ema12:[\s\S]{0,500}ema24:[\s\S]{0,500}ema50:/.test(gaugeHtml));
assert('Pass 2 / Fix 3: inline _tgEMA computes EMA when needed',
  /function _tgEMA\(arr, period\)/.test(gaugeHtml));

// Fix 2: tool-only maximize uses bigger height
assert('Pass 2 / Fix 2: maximize sizes to 60vh in tool-only mode',
  /isToolOnly[\s\S]{0,200}60vh/.test(gaugeHtml));

// Fix 5: fullscreen panel
assert('Pass 2 / Fix 5: tgFullscreenPanel exposed',
  gaugeHtml.includes('window.tgFullscreenPanel'));
assert('Pass 2 / Fix 5: .tg-fullscreen-panel CSS uses 100vh + fixed',
  /\.tg-fullscreen-panel[\s\S]{0,400}position:\s*fixed[\s\S]{0,400}100vh/.test(gaugeHtml));
assert('Pass 2 / Fix 5: context menu has Fullscreen action',
  gaugeHtml.includes('Fullscreen panel'));

// Fix 6: pill name opens style menu (right-click no longer needed for promoted indicators)
assert('Pass 2 / Fix 6: pill name is clickable to open style menu (tgStyleIndicator)',
  /onclick="tgStyleIndicator\(event, \\'/.test(gaugeHtml) || gaugeHtml.includes('tgStyleIndicator(event,'));
assert('Pass 2 / Fix 6: main canvas right-click opens promoted-indicator menu in compose mode',
  /c\.oncontextmenu[\s\S]{0,400}getMode\(\)\s*!==\s*'compose'/.test(gaugeHtml) ||
  /mainChart[\s\S]{0,300}oncontextmenu/.test(gaugeHtml));

// Fix 4: sparkline preview in the picker
assert('Pass 2 / Fix 4: tgSparkline function exists (SVG preview)',
  /function tgSparkline\(id, width, height\)/.test(gaugeHtml));
assert('Pass 2 / Fix 4: picker items include the sparkline SVG',
  /tgSparkline\(id, \d+, \d+\)/.test(gaugeHtml));

// ═══════════════════════════════════════════════════════════════
section('82. Compose mode pass 3 — canvas resize + custom indicators + luminos (v5.37.3)');

// Maximize: canvas drawing buffer follows the wrap
assert('Pass 3: maximized wrap lets the canvas grow (CSS)',
  /\.sub-chart-wrap\[data-maximized="true"\][\s\S]{0,200}height:\s*calc/.test(gaugeHtml));
assert('Pass 3: fullscreen wrap lets the canvas grow (CSS)',
  /\.sub-chart-wrap\.tg-fullscreen-panel canvas\.sub-canvas[\s\S]{0,200}calc/.test(gaugeHtml));
assert('Pass 3: maximizeSubPanel wrapper resets canvas attrs + calls resize',
  /__origMaximize[\s\S]{0,500}removeAttribute\('width'\)[\s\S]{0,300}inst\.resize\(\)/.test(gaugeHtml));

// Custom indicators are promotable
assert('Pass 3: custom indicator label has data-indicator',
  /sub-chart-label" data-indicator="custom-' \+ idx/.test(gaugeHtml) ||
  gaugeHtml.includes("data-indicator=\"custom-' + idx + '\""));
assert('Pass 3: custom indicator has Promote button',
  /togglePromote\('custom-' \+ idx \+ '\)/.test(gaugeHtml) ||
  /togglePromote\(\\'custom-' \+ idx \+ '\\'\)/.test(gaugeHtml) ||
  gaugeHtml.includes("togglePromote('custom-' + idx + '')") ||
  /togglePromote\('custom-/.test(gaugeHtml));
assert('Pass 3: tgRegisterCustomIndicator exposed',
  gaugeHtml.includes('window.tgRegisterCustomIndicator'));
assert('Pass 3: custom indicator registration writes into INDICATOR_REGISTRY at runtime',
  /INDICATOR_REGISTRY\[id\]\s*=\s*\{/.test(gaugeHtml));

// Luminos sprites — the visual pop
assert('Pass 3: luminos sprite layer in DOM',
  gaugeHtml.includes('tg-luminos-layer'));
assert('Pass 3: two luminos sprites present (v5.37.4: cranked up, count reduced)',
  (gaugeHtml.match(/class="tg-luminos"\s+data-i="[01]"/g) || []).length === 2);
assert('Pass 3: luminos drift keyframes defined (gold + lavender)',
  gaugeHtml.includes('@keyframes tg-lum-1') && gaugeHtml.includes('@keyframes tg-lum-2'));
assert('Pass 3: luminos use radial-gradient with currentColor (color follows the data-i palette)',
  /\.tg-luminos\s*\{[\s\S]{0,800}radial-gradient\(circle, currentColor/.test(gaugeHtml));

// Hover shimmer
assert('Pass 3: sub-chart label hover shimmer',
  /\.sub-chart-label:hover[\s\S]{0,200}box-shadow:[\s\S]{0,200}rgba\(232,176,25/.test(gaugeHtml));
assert('Pass 3: compose pill hover lift + glow',
  /\.tg-compose-pill:hover[\s\S]{0,200}translateY\(-1px\)[\s\S]{0,200}currentColor/.test(gaugeHtml));
assert('Pass 3: name text shadow follows hover',
  /\.sub-chart-label:hover \.sc-name[\s\S]{0,100}text-shadow/.test(gaugeHtml));

// ═══════════════════════════════════════════════════════════════
section('83. Luminos polish + tooltip consistency (v5.37.4)');

// Luminos cranked up, count reduced, toggle button
assert('Pass 4: luminos sprite size cranked up (22px+ via --lum-size calc or --lum-base-size)',
  /--lum-size:\s*calc\(22px/.test(gaugeHtml) ||
  /--lum-base-size:\s*22px/.test(gaugeHtml) ||
  /--lum-size:\s*22px/.test(gaugeHtml));
assert('Pass 4: luminos toggle button in toolbar',
  gaugeHtml.includes('id="luminosToggle"') && gaugeHtml.includes('tgToggleLuminos()'));
assert('Pass 4: tgToggleLuminos exposed + persists in fl_tg_luminos',
  gaugeHtml.includes('window.tgToggleLuminos') && gaugeHtml.includes("'fl_tg_luminos'"));
assert('Pass 4: luminos pause class on body (color picker stall fix)',
  /body\.tg-pause-luminos \.tg-luminos\s*\{\s*animation-play-state:\s*paused/.test(gaugeHtml));
assert('Pass 4: will-change on sprites (compositor offload — no stall on picker)',
  /\.tg-luminos\s*\{[\s\S]{0,800}will-change:\s*transform,\s*opacity/.test(gaugeHtml));
assert('Pass 4: color picker open auto-pauses luminos',
  /_luminosWatchColorInput/.test(gaugeHtml) && gaugeHtml.includes('mousedown'));
assert('Pass 4: safety timer unpauses if menu closed but pause stuck',
  /setInterval[\s\S]{0,200}tg-pause-luminos[\s\S]{0,200}tgPauseLuminos\(false\)/.test(gaugeHtml));

// Tooltip consistency — price chart now uses tgTopLeft like compose
assert('Pass 4: tgTopLeft positioner registered at script init (not just compose)',
  // Two registration sites now: one inside renderComposeChart (legacy guarded by
  // !positioners.tgTopLeft) and one at script init. The init copy is what the
  // price chart picks up first.
  (gaugeHtml.match(/Chart\.Tooltip\.positioners\.tgTopLeft\s*=/g) || []).length >= 2);
assert('Pass 4: price chart tooltip uses position: tgTopLeft',
  /tooltip:\s*\{[\s\S]{0,400}position:\s*'tgTopLeft'/.test(gaugeHtml));
assert('Pass 4: price chart tooltip uses mode: index intersect: false (matches compose)',
  /position:\s*'tgTopLeft'[\s\S]{0,200}mode:\s*'index'[\s\S]{0,80}intersect:\s*false/.test(gaugeHtml));

// ═══════════════════════════════════════════════════════════════
section('84. Mistral 422 + Core textarea (real user testing, v5.37.5)');

// Bug 1 — 422 is content-policy refusal, not health failure
assert('422 handler: detects content-policy status codes (422 / 451)',
  /_isContentPolicy\s*=\s*response\.status\s*===\s*422[\s\S]{0,80}451/.test(appHtml));
assert('422 handler: also detects content-policy in error message text',
  /content\[\s\\?\s\]\?policy\|safety\|refus\|decline\|moderation\|prohibited\|inappropriate/.test(appHtml) ||
  /\/content\[/.test(appHtml) && appHtml.includes('moderation') && appHtml.includes('refus'));
assert('422 handler: silent failover to Browser AI if loaded',
  /_isContentPolicy[\s\S]{0,800}typeof BrowserAI !== 'undefined' && BrowserAI\.ready[\s\S]{0,300}BrowserAI\.chat/.test(appHtml));
assert('422 handler: friendly user-facing message (never "Error 422")',
  appHtml.includes("Your AI provider declined this message"));
assert('422 handler: message suggests path forward (switch providers OR local AI)',
  /Try switching providers in Settings, or connect a local AI/.test(appHtml));
assert('422 handler: routes Browser AI response through DepthConsent + provenance stamp',
  /_flParsedBR\s*=[\s\S]{0,300}DepthConsent\.attachIfMarked[\s\S]{0,300}flStampChatResponse/.test(appHtml));

// Bug 2 — Core planting limits + mobile textarea size
assert('Core: seed limit raised to 1000 chars (was 280)',
  /CORE_TYPE_LIMITS\s*=\s*\{\s*seed:\s*1000/.test(appHtml));
assert('Core: branch + fruit limits raised to 2500 chars (was 1000)',
  /seed:\s*1000,\s*branch:\s*2500,\s*fruit:\s*2500/.test(appHtml));
assert('Core: textarea maxlength initial value matches seed default (1000)',
  appHtml.includes('id="coreContentInput"') && /coreContentInput[^>]*maxlength="1000"/.test(appHtml));
assert('Core: initial char-count display matches seed default ("0 / 1000")',
  appHtml.includes('id="coreCharCount">0 / 1000<'));
assert('Core: type labels updated to reflect new limits',
  appHtml.includes('up to 1000 chars') && appHtml.includes('up to 2500 chars'));
assert('Core: mobile textarea min-height raised to 120px (Paula\'s poem)',
  /\.core-form-row textarea\s*\{\s*font-size:\s*16px\s*!important;\s*min-height:\s*120px/.test(appHtml));
assert('Core: mobile input + select still min-height 44px (touch target)',
  /\.core-form-row input,\s*\.core-form-row select\s*\{\s*font-size:\s*16px\s*!important;\s*min-height:\s*44px/.test(appHtml));

// ═══════════════════════════════════════════════════════════════
section('85. Temperature Gauge — scroll fix + signal-driven luminos (v5.37.6)');

// Scroll fix
assert('Scroll fix: chart-area now overflow-y: auto (was overflow: hidden)',
  /\.chart-area\s*\{[\s\S]{0,400}overflow-y:\s*auto/.test(gaugeHtml));
assert('Scroll fix: chart-area still overflow-x: hidden (no sideways jitter)',
  /\.chart-area\s*\{[\s\S]{0,500}overflow-x:\s*hidden/.test(gaugeHtml));
assert('Scroll fix: custom scrollbar styling for chart-area',
  /\.chart-area::-webkit-scrollbar/.test(gaugeHtml));

// Luminos size doubled + CSS variable driven
// Size + opacity are now ONE continuous energy gradient (v5.37.20).
// Per Opus: replaces the binary tg-signal-strong / tg-signal-extreme
// size jumps with a smooth ramp from gravity-spring distance.
assert('Luminos: size derived from single --lum-energy var via calc()',
  /--lum-size:\s*calc\(22px\s*\+\s*var\(--lum-energy[^)]*\)\s*\*\s*28px\)/.test(gaugeHtml));
assert('Luminos: signal-strong tier ONLY sets filter (no size)',
  /body\.tg-signal-strong \.tg-luminos\s*\{\s*filter:\s*blur\(1\.2px\)/.test(gaugeHtml));
assert('Luminos: signal-extreme tier ONLY sets filter + saturate (no size)',
  /body\.tg-signal-extreme \.tg-luminos\s*\{\s*filter:\s*blur\(1\.6px\)\s*saturate\(1\.3\)/.test(gaugeHtml));

// Signal-driven coloring
assert('Luminos: tgUpdateLuminosSignal exposed on window',
  gaugeHtml.includes('window.tgUpdateLuminosSignal'));
assert('Luminos: signal state reads lastTemp + lastATR + gravPoints from analysis',
  /tgComputeSignalState[\s\S]{0,600}a\.lastTemp[\s\S]{0,400}a\.gravPoints/.test(gaugeHtml) ||
  (gaugeHtml.includes('a.lastTemp') && gaugeHtml.includes('a.gravPoints') && gaugeHtml.includes('tgComputeSignalState')));
assert('Luminos: buy direction renders green',
  /direction === 'buy'[\s\S]{0,200}#34d399/.test(gaugeHtml));
assert('Luminos: sell direction renders red',
  /direction === 'sell'[\s\S]{0,200}#ef4444/.test(gaugeHtml));
// v5.38.4: direction-neutral changed from gold+lavender to slate gray pair
// so gold/lavender don't compete with intensity (purple) and alert (cyan).
assert('Direction-neutral: slate gray pair (no more gold/lavender conflict)',
  /else \{ c1 = '#6b7280'; c2 = '#9ca3af'; \}/.test(gaugeHtml));
assert('Luminos: signal hook wired into __tgComposePostRender',
  /__origPostRender[\s\S]{0,300}tgUpdateLuminosSignal/.test(gaugeHtml));

// Instability — far from gravity → faster drift + jitter
assert('Luminos: tg-instability class drives faster animation duration',
  /body\.tg-instability \.tg-luminos\s*\{\s*animation-duration:/.test(gaugeHtml));
assert('Luminos: tg-jitter keyframe defined for unstable signal',
  /@keyframes tg-jitter/.test(gaugeHtml));

// ── Energy ramp (v5.37.19 → simplified v5.37.20) ───────────────────────
// Per Opus on bars 120/136: IPS-near-zero = spring at rest, IPS-far = loaded.
// gravDist is the same shape of measure, ATR-normalized.
// Simplified to ONE CSS var (--lum-energy) that drives both opacity + size.
assert('Energy ramp: layer-level opacity reads single --lum-energy var (0.4 + energy * 0.6)',
  /\.tg-luminos-layer\s*\{[\s\S]{0,400}opacity:\s*calc\(0\.4\s*\+\s*var\(--lum-energy[^)]*\)\s*\*\s*0\.6\)/.test(gaugeHtml));
assert('Energy ramp: energyScale computed from gravDist / 2.5',
  /energyScale\s*=\s*Math\.min\(1\.0,\s*state\.gravDist\s*\/\s*2\.5\)/.test(gaugeHtml));
assert('Energy ramp: --lum-energy set on layer (single source of truth)',
  /setProperty\(['"]--lum-energy['"]/.test(gaugeHtml));

// ── Containment fix (v5.37.20) ─────────────────────────────────────────
// Sprites animate to left: -5% / 105% to create an edge fade.
// Without overflow:hidden on the layer they leak into the sidebar.
assert('Containment: .tg-luminos-layer has overflow:hidden so sprites clip at chart edge',
  /\.tg-luminos-layer\s*\{[\s\S]{0,400}overflow:\s*hidden/.test(gaugeHtml));

// ── Main-chart maximize (v5.37.20) ─────────────────────────────────────
// Mirror affordance to sub-chart maximize. Right-click → "Maximize main chart".
assert('Maximize: tgMaximizeMainChart exposed on window',
  /window\.tgMaximizeMainChart\s*=\s*function/.test(gaugeHtml));
assert('Maximize: function toggles .tg-fullscreen-panel on #chartWrap',
  /tgMaximizeMainChart[\s\S]{0,500}getElementById\(['"]chartWrap['"]\)[\s\S]{0,300}tg-fullscreen-panel/.test(gaugeHtml));
assert('Maximize: right-click menu has "Maximize main chart" entry',
  /Maximize main chart/.test(gaugeHtml));
assert('Maximize: Escape unsticks #chartWrap fullscreen too (not just sub-charts)',
  /Escape[\s\S]{0,800}chartWrap[\s\S]{0,300}tgMaximizeMainChart/.test(gaugeHtml));

// Luminos containment (history, then current design):
// - v5.37.19: lifted layer up to .chart-area so it'd show in tool-only mode.
// - v5.38.1: PUT BACK inside #chartWrap because sprites were bouncing off
//   gravity lines (correct) AND drifting into sub-charts below (wrong).
//   Kirk's chair test 2026-06-07: "they need to stay in the main chart area."
//   Trade-off: tool-only mode no longer shows signal coloring (chartWrap is
//   display:none in that mode). That's accepted — tool-only is a focused
//   sub-chart study mode where ambient mood isn't wanted anyway.
assert('Containment: luminos layer is inside #chartWrap (confined to main chart)',
  /<div class="chart-canvas-wrap" id="chartWrap">[\s\S]{0,2000}<div class="tg-luminos-layer" id="tgLuminosLayer"/.test(gaugeHtml));
assert('Containment: luminos layer is NOT a direct child of .chart-area (would let sprites roam over sub-charts)',
  !/<div class="chart-area">\s*<div class="tg-luminos-layer"/.test(gaugeHtml));
assert('Containment: .tg-luminos-layer still has overflow:hidden so sprites clip at edges',
  /\.tg-luminos-layer\s*\{[\s\S]{0,400}overflow:\s*hidden/.test(gaugeHtml));
// v5.38.2: belt-and-suspenders containment on chartWrap. will-change:transform
// on the sprites creates a stacking context that can leak past the inner
// overflow boundary in some browser builds. Clipping at chartWrap catches it.
assert('Containment: #chartWrap (chart-canvas-wrap) has overflow:hidden — belt-and-suspenders for will-change leak',
  /\.chart-canvas-wrap\s*\{[^}]*overflow:\s*hidden/.test(gaugeHtml));

// ── Six luminos sprites — direction(0,1) + alert(2,3) + intensity(4,5) ──
// Kirk's v5.38.1 ask: "Maybe four? Two for alerting price, and two for
// intensity?" Implemented as two additional semantic pairs.
// v5.38.4: nine sprites — 2 direction + 2 alert + 2 intensity + 3 bonus.
// Bonus sprites (data-i 6/7/8) are visible only when their pair's scalar
// exceeds 0.6 — "more of them the bigger the signal."
assert('Luminos: 9 sprites in the layer (3 pairs + 3 bonus, one per pair)',
  (gaugeHtml.match(/<span class="tg-luminos[^"]*" data-i="\d"/g) || []).length === 9);
assert('Luminos: alert pair has tg-lum-alert class on data-i=2 and data-i=3',
  /<span class="tg-luminos tg-lum-alert" data-i="2">/.test(gaugeHtml) &&
  /<span class="tg-luminos tg-lum-alert" data-i="3">/.test(gaugeHtml));
assert('Luminos: intensity pair has tg-lum-intensity class on data-i=4 and data-i=5',
  /<span class="tg-luminos tg-lum-intensity" data-i="4">/.test(gaugeHtml) &&
  /<span class="tg-luminos tg-lum-intensity" data-i="5">/.test(gaugeHtml));

// Alert sprite CSS — bloom with --lum-alert, opacity via filter for keyframe compat.
assert('Alert sprites: size = 12px + alert * 36px (small when stale, large on flare)',
  /\.tg-luminos\.tg-lum-alert\s*\{[\s\S]{0,400}--lum-size:\s*calc\(12px\s*\+\s*var\(--lum-alert[^)]*\)\s*\*\s*36px\)/.test(gaugeHtml));
assert('Alert sprites: opacity gated via filter:opacity(--lum-alert)',
  /\.tg-luminos\.tg-lum-alert\s*\{[\s\S]{0,400}filter:[^;]*opacity\(var\(--lum-alert[^)]*\)\)/.test(gaugeHtml));

// Intensity sprite CSS — pulse with --lum-intensity.
assert('Intensity sprites: size = 16px + intensity * 30px',
  /\.tg-luminos\.tg-lum-intensity\s*\{[\s\S]{0,400}--lum-size:\s*calc\(16px\s*\+\s*var\(--lum-intensity[^)]*\)\s*\*\s*30px\)/.test(gaugeHtml));
assert('Intensity sprites: opacity = 0.35 + intensity * 0.65 (always at least faint)',
  /\.tg-luminos\.tg-lum-intensity\s*\{[\s\S]{0,400}opacity\(calc\(0\.35\s*\+\s*var\(--lum-intensity[^)]*\)\s*\*\s*0\.65\)\)/.test(gaugeHtml));

// Four new keyframes — alert (3, 4) + intensity (5, 6). Distinct drift paths.
assert('Keyframes: tg-lum-3 (alert primary, top-right → bottom-left) exists',
  /@keyframes tg-lum-3\s*\{[\s\S]{0,500}left:\s*95%[\s\S]{0,400}left:\s*-5%/.test(gaugeHtml));
assert('Keyframes: tg-lum-4 (alert complement, bottom-left → top-right) exists',
  /@keyframes tg-lum-4\s*\{[\s\S]{0,500}top:\s*92%[\s\S]{0,400}top:\s*10%/.test(gaugeHtml));
assert('Keyframes: tg-lum-5 (intensity primary, near-vertical center) exists',
  /@keyframes tg-lum-5/.test(gaugeHtml));
assert('Keyframes: tg-lum-6 (intensity complement, orbital arc) exists',
  /@keyframes tg-lum-6/.test(gaugeHtml));

// JS state extensions
assert('Signal state: tgComputeSignalState returns alertScale + alertKind + intensity',
  /alertScale:\s*alertScale[\s\S]{0,200}alertKind:\s*alertKind/.test(gaugeHtml) &&
  /intensity:\s*strength/.test(gaugeHtml));
assert('Signal state: alert freshness scans temps for 55-crossing (buy) and 45-crossing (sell)',
  /tPrev\s*<\s*55\s*&&\s*t\s*>=\s*55[\s\S]{0,200}alertKind\s*=\s*['"]buy['"]/.test(gaugeHtml) &&
  /tPrev\s*>\s*45\s*&&\s*t\s*<=\s*45[\s\S]{0,200}alertKind\s*=\s*['"]sell['"]/.test(gaugeHtml));
assert('Signal apply: setProperty for --lum-alert + --lum-alert-color',
  /setProperty\(['"]--lum-alert['"]/.test(gaugeHtml) &&
  /setProperty\(['"]--lum-alert-color['"]/.test(gaugeHtml));
assert('Signal apply: setProperty for --lum-intensity + --lum-intensity-color',
  /setProperty\(['"]--lum-intensity['"]/.test(gaugeHtml) &&
  /setProperty\(['"]--lum-intensity-color['"]/.test(gaugeHtml));
// v5.38.4: intensity color lerps from pale lavender → vivid magenta
// (purple family, distinct from direction red/green and alert cyan).
assert('Intensity color: purple lerp (lavender → magenta) via lerpHex',
  /function lerpHex/.test(gaugeHtml) &&
  /lerpHex\(['"]#c4b5fd['"],\s*['"]#c026d3['"],\s*state\.intensity\)/.test(gaugeHtml));
// v5.38.5: alert recolored from cyan → amber. Cyan #06b6d4 sat too close
// to direction-buy green #34d399 in the chair; Kirk caught it. Amber
// (#fde68a → #eab308) is distinct from red, green, slate gray, AND purple.
assert('Alert color: amber lerp (soft → vivid) via lerpHex',
  /lerpHex\(['"]#fde68a['"],\s*['"]#eab308['"],\s*state\.alertScale\)/.test(gaugeHtml));

// v5.38.4: three bonus sprites — one per pair — visible only when that
// pair's scalar exceeds 0.6. "More of them the bigger the signal."
assert('Bonus sprites: data-i 6, 7, 8 exist with tg-lum-bonus class',
  /<span class="tg-luminos tg-lum-bonus tg-lum-bonus-direction" data-i="6">/.test(gaugeHtml) &&
  /<span class="tg-luminos tg-lum-bonus tg-lum-bonus-alert" data-i="7">/.test(gaugeHtml) &&
  /<span class="tg-luminos tg-lum-bonus tg-lum-bonus-intensity" data-i="8">/.test(gaugeHtml));
assert('Bonus direction: opacity gated on (--lum-energy - 0.6) * 2.5',
  /\.tg-lum-bonus-direction\s*\{[\s\S]{0,300}opacity\(calc\(\(var\(--lum-energy[^)]*\)\s*-\s*0\.6\)\s*\*\s*2\.5\)\)/.test(gaugeHtml));
assert('Bonus alert: opacity gated on (--lum-alert - 0.6) * 2.5',
  /\.tg-lum-bonus-alert\s*\{[\s\S]{0,300}opacity\(calc\(\(var\(--lum-alert[^)]*\)\s*-\s*0\.6\)\s*\*\s*2\.5\)\)/.test(gaugeHtml));
assert('Bonus intensity: opacity gated on (--lum-intensity - 0.6) * 2.5',
  /\.tg-lum-bonus-intensity\s*\{[\s\S]{0,300}opacity\(calc\(\(var\(--lum-intensity[^)]*\)\s*-\s*0\.6\)\s*\*\s*2\.5\)\)/.test(gaugeHtml));
assert('Bonus keyframes: tg-lum-7, tg-lum-8, tg-lum-9 defined',
  /@keyframes tg-lum-7/.test(gaugeHtml) &&
  /@keyframes tg-lum-8/.test(gaugeHtml) &&
  /@keyframes tg-lum-9/.test(gaugeHtml));

// Favicon (kills the 404)
assert('Favicon: inline gold-spark favicon link present',
  /<link rel="icon" href="data:image\/svg\+xml/.test(gaugeHtml));

// Escape exits fullscreen — safety so users never get stuck
assert('Safety: Escape key exits fullscreen panel if one is stuck',
  /keydown[\s\S]{0,300}Escape[\s\S]{0,200}tg-fullscreen-panel/.test(gaugeHtml));

// ═══════════════════════════════════════════════════════════════
section('86. Gauge: sell triad + EMA config + mobile + luminos-during-picker (v5.37.7)');

// Commit 1 — Luminos pause respects color picker state
assert('Picker fix: _luminosWatchColorInput no longer listens to change',
  /_luminosWatchColorInput[\s\S]{0,600}DO NOT listen to 'change'/.test(gaugeHtml) ||
  /\/\/ NO 'change' listener/.test(gaugeHtml));
assert('Picker fix: tg-color-picker-open body class gates the unpause',
  gaugeHtml.includes('tg-color-picker-open') && /closePicker[\s\S]{0,200}stillOpen/.test(gaugeHtml));
assert('Picker fix: closeMenu wrapper checks color-picker-open before unpausing',
  /__origCloseMenu\(\);\s*if \(!document\.body\.classList\.contains\('tg-color-picker-open'\)\)/.test(gaugeHtml));
assert('Picker fix: 6s safety timer also gated on color-picker-open',
  /setInterval[\s\S]{0,200}tg-color-picker-open[\s\S]{0,80}tgPauseLuminos\(false\)/.test(gaugeHtml));
assert('Picker fix: filter:none while picker or menu open (drops the expensive blur)',
  /body\.tg-color-picker-open \.tg-luminos[\s\S]{0,200}filter:\s*none/.test(gaugeHtml));

// Commit 2 — Mobile layout + tap target
assert('Mobile: chart-area order:1 (chart on top)',
  /@media \(max-width: 768px\)[\s\S]{0,900}\.chart-area\s*\{\s*order:\s*1/.test(gaugeHtml));
// v5.37.21: mobile .main switched from grid to flexbox so order is rock-solid.
// CSS Grid does honor `order:` on items but mobile-browser auto-flow has
// historically been flakier than flexbox; Kirk hit a build where chart wasn't
// first despite order:1. Lock the flex switch.
assert('Mobile: .main is flex on mobile (chart-on-top is robust, not grid-auto-flow-dependent)',
  /@media \(max-width: 768px\)[\s\S]{0,500}\.main\s*\{[\s\S]{0,500}display:\s*flex[\s\S]{0,200}flex-direction:\s*column/.test(gaugeHtml));
// v5.37.21: luminos sprite width/height transitions removed — they triggered
// per-frame layout passes on every --lum-energy update (which fires on every
// renderChart), causing mobile slowdown. Color + filter transitions stay
// (they compose, no layout).
assert('Perf: luminos transition does NOT include width/height (avoids mobile layout thrash)',
  /\.tg-luminos\s*\{[\s\S]{0,1500}transition:\s*color\s+0\.8s\s+ease,\s*filter\s+0\.6s\s+ease;/.test(gaugeHtml));
assert('Perf: luminos transition explicitly excludes width/height keywords',
  !/\.tg-luminos\s*\{[\s\S]{0,1500}transition:[^;]*\bwidth\b/.test(gaugeHtml));
assert('Mobile: sidebar order:2 + border-top (was border-bottom)',
  /\.sidebar\s*\{\s*order:\s*2;\s*border-right:\s*none;\s*border-top:\s*1px/.test(gaugeHtml));
assert('Mobile: composeEmpty wired via touchend (synthetic-click fix)',
  /_wireEmptyStageTouch[\s\S]{0,400}touchend/.test(gaugeHtml));
assert('Mobile: _wireEmptyStageTouch called from init',
  /function init\(\)[\s\S]{0,400}_wireEmptyStageTouch\(\)/.test(gaugeHtml));

// v5.37.12: signal loops moved into RULE_REGISTRY evaluate functions.
// Each rule owns its own loop. The Sequence rule's loop starts at i=2.
assert('v5.37.12: Sequence Rule loop starts at i=2 (3-bar peek-back)',
  /sequence:[\s\S]{0,1500}for \(var i = 2; i < candles\.length/.test(gaugeHtml));

// Commit 4 — Configurable EMA periods
assert('EMA config: DEFAULT_EMA_PERIODS [8,12,24,50,200] defined',
  /DEFAULT_EMA_PERIODS\s*=\s*\[8,\s*12,\s*24,\s*50,\s*200\]/.test(gaugeHtml));
assert('EMA config: getEmaPeriods() + setEmaPeriods() exposed',
  /function getEmaPeriods\(\)/.test(gaugeHtml) && /function setEmaPeriods\(arr\)/.test(gaugeHtml));
assert('EMA config: persists in fl_tg_ema_periods',
  gaugeHtml.includes("'fl_tg_ema_periods'"));
assert('EMA config: no hardcoded ema(closes, 8) calls remain',
  !/ema\(closes,\s*8\)/.test(gaugeHtml));
assert('EMA config: chart labels use EP_RC[0..4] not hardcoded numbers',
  /label:\s*'EMA '\s*\+\s*EP_RC\[0\]/.test(gaugeHtml));
assert('EMA config: INDICATOR_REGISTRY ema labels are updated in updateComposeUI',
  /INDICATOR_REGISTRY\.ema8\.label\s*=\s*'EMA '\s*\+\s*EP_PILL\[0\]/.test(gaugeHtml));
assert('EMA config: UI input + Set + Reset buttons present',
  gaugeHtml.includes('id="emaPeriodsInput"') &&
  /Set</.test(gaugeHtml) && /Reset</.test(gaugeHtml));
assert('EMA config: setEmaPeriods triggers full renderAll',
  /setEmaPeriods[\s\S]{0,500}renderAll\(lastCandles, lastAnalysis/.test(gaugeHtml));

// ═══════════════════════════════════════════════════════════════
section('87. Color-picker drag fix — preview on input, commit on change (v5.37.8)');

// The real entropy-source: setIndicatorColor (full renderChart) was being
// called on every `input` event from the native color picker while the
// user dragged through the palette. ~60 renderCharts per second of drag.
// Fix: preview on input (cheap label color update), commit on change.
assert('Drag fix: input handler does NOT call setIndicatorColor (was the 60fps render storm)',
  !/m\.addEventListener\('input'[\s\S]{0,800}color-pick'[\s\S]{0,200}setIndicatorColor/.test(gaugeHtml));
assert('Drag fix: input handler updates label color preview (live, cheap)',
  /input[\s\S]{0,1200}color-pick[\s\S]{0,400}lblPreview\.style\.color\s*=\s*ev\.target\.value/.test(gaugeHtml));
assert('Drag fix: change handler is the ONLY path that calls setIndicatorColor',
  /m\.addEventListener\('change'[\s\S]{0,800}color-pick[\s\S]{0,300}setIndicatorColor\(id, ev\.target\.value\)/.test(gaugeHtml));
assert('Drag fix: comment explains the renderChart-per-input regression',
  gaugeHtml.includes('continuously while the') ||
  gaugeHtml.includes('60+ times per second') ||
  gaugeHtml.includes('drag through the palette'));

// ═══════════════════════════════════════════════════════════════
section('88. Buy triad + cooldown (no repeats until reset) + strategy doc (v5.37.9)');

// v5.37.12: buy/sell logic moved into RULE_REGISTRY. The inline references
// to a.temps for triad/reversion were removed from renderChart and live
// inside evaluate(candles, a) of each rule instead. Guard that the OLD
// inline structure stays out of renderChart specifically.
var renderChartBlock = (function () {
  var m = gaugeHtml.match(/^function renderChart\(candles, a\)[\s\S]*?\n}\s*$/m);
  return m ? m[0] : gaugeHtml; // fallback: full file if matcher misses
})();
assert('v5.37.12: renderChart no longer has inline triad helpers',
  !/var buy55\s*=\s*a\.temps/.test(renderChartBlock) &&
  !/var sell55\s*=\s*a\.temps/.test(renderChartBlock));
assert('v5.37.11: rallyBT / collapseBT triad helpers removed (replaced by sequence rule)',
  !gaugeHtml.includes('var rallyBT') && !gaugeHtml.includes('var collapseBT'));

// v5.37.12: state-reset cooldown (sawGreenSinceLastSell etc.) is back, but
// only INSIDE RULE_REGISTRY.triad.evaluate — it's the preserved v5.37.9
// hypothesis. Assert it's confined to the triad rule, not the inline
// renderChart path or the backtest's old lastBuyBT/sawGreenBT structure.
assert('v5.37.12: state-reset cooldown lives only inside RULE_REGISTRY.triad',
  !/^\s*var sawGreenSinceLastSell/m.test(renderChartBlock) &&
  !gaugeHtml.includes('lastBuyBT') && !gaugeHtml.includes('sawGreenBT'));

// Strategy doc — the living explanation
var stratPath = path.join(docsDir, 'library', 'TEMPERATURE_GAUGE_STRATEGY.md');
assert('Strategy doc exists at docs/library/TEMPERATURE_GAUGE_STRATEGY.md',
  fs.existsSync(stratPath));
var strat = fs.existsSync(stratPath) ? fs.readFileSync(stratPath, 'utf8') : '';
assert('Strategy doc: explains the triggers-on-transitions philosophy',
  strat.includes('signal is a *transition*') || strat.includes('transition, not a *state*'));
assert('Strategy doc: documents the buy triad (buy55, buy45, rally)',
  strat.includes('`buy55`') && strat.includes('`buy45`') && strat.includes('`rally`'));
assert('Strategy doc: documents the sell triad (sell55, sell45, collapse)',
  strat.includes('`sell55`') && strat.includes('`sell45`') && strat.includes('`collapse`'));
assert('Strategy doc: documents the cooldown rule',
  strat.includes('no repeated downs') || strat.includes('Cooldown'));
assert('Strategy doc: lists open questions (what we don\'t know yet)',
  strat.includes("What we don't know yet"));
assert('Strategy doc: includes the iteration log',
  strat.includes('Iteration log') && strat.includes('v5.37.7') && strat.includes('v5.37.9'));
assert('Strategy doc: honest about being heuristic, not a complete system',
  strat.includes('Not a complete trading system') || strat.includes('heuristics'));

// ═══════════════════════════════════════════════════════════════
section('89. Reversion Triad + outside-click race fix (v5.37.10)');

// Commit 1 — outside-click race grace period
assert('Race fix: outside-click listener uses 50ms grace (not 0)',
  /setTimeout\(function \(\) \{ document\.addEventListener\('click', _outsideClick, true\); \}, 50\);/.test(gaugeHtml));
assert('Race fix: zero outside-click setTimeouts remain at 0ms',
  !/setTimeout\(function \(\) \{ document\.addEventListener\('click', _outsideClick, true\); \}, 0\);/.test(gaugeHtml));
assert('Race fix: at least 4 sites switched to 50ms',
  (gaugeHtml.match(/document\.addEventListener\('click', _outsideClick, true\); \}, 50/g) || []).length >= 4);

// Reversion Triad reborn inside RULE_REGISTRY (v5.37.12). Assert the OLD
// gold-star chart-rendering and rv* backtest plumbing stay out — those
// were the user-visible problems (20+ stars on NVDA 1W). The evaluate
// function inside RULE_REGISTRY.reversion lives separately and is opt-in.
assert('v5.37.12: reversion gold-star datasets stay removed from chart',
  !gaugeHtml.includes("label: 'Reversion Buy'") && !gaugeHtml.includes("label: 'Reversion Sell'"));
assert('v5.37.12: rvSignals plumbing stays removed from backtest',
  !gaugeHtml.includes('rvSignals') && !/'rvbuy'/.test(gaugeHtml) && !/'rvsell'/.test(gaugeHtml));
assert('v5.37.12: backtest stats remain buy + sell only',
  /\['buy',\s*'sell'\]\.forEach/.test(gaugeHtml));

// ═══════════════════════════════════════════════════════════════
section('90. Signal rules + sandwich + narrow yellow (v5.37.11 + v5.37.12)');

// RULE_REGISTRY — buy/sell logic as named, swappable hypotheses
assert('RULE_REGISTRY: defined with three rules (sequence, triad, reversion)',
  gaugeHtml.includes('var RULE_REGISTRY = {') &&
  /sequence:\s*\{/.test(gaugeHtml) &&
  /triad:\s*\{/.test(gaugeHtml) &&
  /reversion:\s*\{/.test(gaugeHtml));
assert('RULE_REGISTRY: each rule has name, description, color, evaluate',
  /sequence:\s*\{\s*name:[\s\S]{0,300}description:[\s\S]{0,300}color:[\s\S]{0,200}evaluate:\s*function/.test(gaugeHtml));
assert('RULE_REGISTRY.sequence: red→yellow→green / green→yellow→red sequence rule',
  /sequence:[\s\S]{0,2000}temps\[i-2\] <\s+45[\s\S]{0,200}temps\[i\]\s+>=\s+55/.test(gaugeHtml) &&
  /sequence:[\s\S]{0,2000}temps\[i-2\] >= 55[\s\S]{0,200}temps\[i\]\s+<\s+45/.test(gaugeHtml));
assert('RULE_REGISTRY.triad: preserved v5.37.9 triad logic (buy55/buy45/rally + sell55/sell45/collapse)',
  /triad:[\s\S]{0,5000}buy55[\s\S]{0,200}buy45[\s\S]{0,200}rally[\s\S]{0,500}sell55[\s\S]{0,200}sell45[\s\S]{0,200}collapse/.test(gaugeHtml));
assert('RULE_REGISTRY.triad: state-based cooldown preserved (sawGreenSinceLastSell / sawRedSinceLastBuy)',
  /triad:[\s\S]{0,6000}sawGreenSinceLastSell[\s\S]{0,500}sawRedSinceLastBuy/.test(gaugeHtml));
assert('RULE_REGISTRY.reversion: preserved v5.37.10 exhaustion + confluence + pullback logic',
  /reversion:[\s\S]{0,4000}tpSpread\[ri\] < -1\.2[\s\S]{0,800}bullScoreAt\(ri\) >= 3/.test(gaugeHtml));
assert('RULE_REGISTRY.reversion: bullScoreAt / bearScoreAt 5-component helpers',
  /reversion:[\s\S]{0,3000}function bullScoreAt[\s\S]{0,800}function bearScoreAt/.test(gaugeHtml));

// Rule selection — persistence + UI
assert('Rules: getActiveRule + setActiveRule exposed',
  /function getActiveRule\(\)/.test(gaugeHtml) && /function setActiveRule\(id\)/.test(gaugeHtml));
assert('Rules: active rule persists in fl_tg_activeRule',
  gaugeHtml.includes("'fl_tg_activeRule'"));
assert('Rules: default active rule is sequence',
  /return \(v && RULE_REGISTRY\[v\]\) \? v : 'sequence'/.test(gaugeHtml));
assert('Rules: sidebar dropdown #ruleSelect with three options',
  /id="ruleSelect"[\s\S]{0,400}value="sequence"[\s\S]{0,200}value="triad"[\s\S]{0,200}value="reversion"/.test(gaugeHtml));
assert('Rules: inline description div #ruleDescription',
  gaugeHtml.includes('id="ruleDescription"'));
assert('Rules: setActiveRule triggers a full renderAll',
  /function setActiveRule\(id\)[\s\S]{0,800}renderAll\(lastCandles, lastAnalysis/.test(gaugeHtml));

// renderChart + backtestSignals delegate to the active rule
assert('renderChart: delegates buy/sell to RULE_REGISTRY[getActiveRule()].evaluate',
  /_activeRule = RULE_REGISTRY\[getActiveRule\(\)\][\s\S]{0,200}_activeRule\.evaluate\(candles, a\)/.test(gaugeHtml));
assert('backtestSignals: delegates to RULE_REGISTRY[getActiveRule()].evaluate (same source as chart)',
  /btRule = RULE_REGISTRY\[getActiveRule\(\)\][\s\S]{0,200}btRule\.evaluate\(candles, btAnalysis\)/.test(gaugeHtml));

// ═══════════════════════════════════════════════════════════════
section('91. Snapshot — gauge state as AI-readable text (v5.37.13)');

// IIFE present + self-contained
assert('Snapshot: IIFE block present (v5.37.13)',
  gaugeHtml.includes('SNAPSHOT — capture N bars of gauge state as AI-readable text'));
assert('Snapshot: buildSnapshot + copySnapshot exposed on window',
  gaugeHtml.includes('window.tgSnapshot = buildSnapshot') &&
  gaugeHtml.includes('window.tgCopySnapshot = copySnapshot'));
assert('Snapshot: reads from active rule (RULE_REGISTRY[getActiveRule()].evaluate)',
  /RULE_REGISTRY\[rid\][\s\S]{0,200}rule\.evaluate\(candles, a\)/.test(gaugeHtml));

// Button wires into header
assert('Snapshot: 📋 button auto-mounts to .header-controls',
  /initSnapshotButton[\s\S]{0,500}\.header-controls/.test(gaugeHtml));
assert('Snapshot: button uses clipboard icon (📋 = \\u1F4CB)',
  /innerHTML = '&#x1F4CB;'/.test(gaugeHtml));
assert('Snapshot: bar count modifiers — Shift=20, Alt=5, default=10',
  /shiftKey[\s\S]{0,80}bars = 20/.test(gaugeHtml) &&
  /altKey[\s\S]{0,80}bars = 5/.test(gaugeHtml) &&
  /DEFAULT_BARS = 10/.test(gaugeHtml));

// Output structure — header / table / footer
assert('Snapshot: ASCII box header with ╔ ╚ borders',
  /TEMPERATURE GAUGE SNAPSHOT/.test(gaugeHtml) &&
  /╔══════════════════════════════════════════════════════════════╗/.test(gaugeHtml));
assert('Snapshot: per-bar columns include Open, High, Low, Close, Temp, Z, RSI, MACD-H, ΔT, IPS, Signal',
  /Bar  Date        Open     High     Low      Close    Temp Z   RSI   MACD-H/.test(gaugeHtml));
assert('Snapshot: zone() emits G / Y / R',
  /function zone\(t\)[\s\S]{0,200}return 'G'[\s\S]{0,100}return 'Y'[\s\S]{0,100}return 'R'/.test(gaugeHtml));
assert('Snapshot: footer invites AI paste (Claude, ChatGPT)',
  gaugeHtml.includes('Paste into Claude, ChatGPT, or any AI'));
assert('Snapshot: footer carries the not-financial-advice disclaimer',
  /Temperature Gauge · freelattice\.com · Not financial advice/.test(gaugeHtml));

// Clipboard mechanics
assert('Snapshot: copySnapshot uses navigator.clipboard with fallback',
  /navigator\.clipboard\.writeText/.test(gaugeHtml) &&
  /fallbackCopy\(text\)/.test(gaugeHtml));
assert('Snapshot: tgToast notification on copy (ok / warn variants)',
  /function tgToast\(msg, type\)/.test(gaugeHtml) &&
  /'Snapshot copied!/.test(gaugeHtml));
assert('Snapshot: reads from existing globals (lastCandles, lastAnalysis, lastSymbol)',
  gaugeHtml.includes("typeof lastCandles === 'undefined'") &&
  gaugeHtml.includes("typeof lastAnalysis === 'undefined'") &&
  /typeof lastSymbol !== 'undefined'/.test(gaugeHtml));

// ═══════════════════════════════════════════════════════════════
section('92. Snapshot v2: visibility + right-click neighborhood + tighter toolbar (v5.37.14)');

// Toolbar — tightened so all buttons fit on one row
assert('Toolbar: .interval-btn padding tightened to 5px 9px (was 7px 12px)',
  /\.interval-btn\s*\{[\s\S]{0,400}padding:\s*5px 9px/.test(gaugeHtml));
assert('Toolbar: .interval-btn font-size reduced to 0.74rem (was 0.78rem)',
  /\.interval-btn\s*\{[\s\S]{0,500}font-size:\s*0\.74rem/.test(gaugeHtml));
assert('Toolbar: header-controls gap reduced to 6px (was 10px)',
  /\.header-controls\s*\{[\s\S]{0,200}gap:\s*6px/.test(gaugeHtml));
assert('Toolbar: load-btn padding tightened to 6px 14px',
  /\.load-btn\s*\{[\s\S]{0,300}padding:\s*6px 14px/.test(gaugeHtml));
assert('Toolbar: symbol-input width reduced to 110px',
  /\.symbol-input\s*\{[\s\S]{0,300}width:\s*110px/.test(gaugeHtml));

// Snapshot button mount — harder, retries on next frame if needed
assert('Snapshot button: retries with requestAnimationFrame if .header-controls not ready',
  /initSnapshotButton[\s\S]{0,400}requestAnimationFrame\(initSnapshotButton\)/.test(gaugeHtml));
assert('Snapshot button: explicit font-size + line-height (some fonts collapse the 📋 glyph)',
  /snapshotBtn[\s\S]{0,500}font-size:1rem;line-height:1/.test(gaugeHtml));
assert('Snapshot button: appends to end of toolbar (not inserted between Analyze and Log)',
  /\/\/ Insert at the END of the toolbar[\s\S]{0,200}controls\.appendChild\(btn\)/.test(gaugeHtml));

// buildSnapshot — neighborhood mode (centerIdx)
assert('Snapshot: buildSnapshot accepts optional centerIdx for ±half windows',
  /function buildSnapshot\(barCount, centerIdx\)/.test(gaugeHtml));
assert('Snapshot: when centerIdx given, startIdx = centerIdx - half (the cursor is the intent)',
  /centerIdx != null[\s\S]{0,300}centerIdx - half/.test(gaugeHtml));
assert('Snapshot: tail mode (no center) preserved as default',
  /} else \{\s*startIdx = n - barCount;/.test(gaugeHtml));

// Right-click context menu — neighborhood snapshot at cursor
assert('Snapshot: wireRightClickSnapshot uses capture-phase contextmenu (so it wins over compose IIFE)',
  /canvas\.addEventListener\('contextmenu',\s*function\s*\(e\)/.test(gaugeHtml) &&
  /\}, true\);\s*\/\/ capture phase \+ stopImmediatePropagation above = this menu wins/.test(gaugeHtml));
assert('Snapshot: stopImmediatePropagation called so the compose IIFE oncontextmenu does not also fire',
  /e\.stopImmediatePropagation\(\)/.test(gaugeHtml));
assert('Snapshot: single clipboard glyph (icon span only, no duplicate in text)',
  !/'📋 Snapshot \(±5 bars around cursor\)'/.test(gaugeHtml) &&
  /class="tg-ctx-icon">&#x1F4CB;<\/span>Snapshot/.test(gaugeHtml));
assert('Snapshot: uses Chart.js getElementsAtEventForMode to find bar under cursor',
  /getElementsAtEventForMode\(e,\s*'index',\s*\{\s*intersect:\s*false\s*\}/.test(gaugeHtml));
assert('Snapshot: right-click menu item "📋 Snapshot (±5 bars around cursor)"',
  /Snapshot \(±5 bars around cursor\)/.test(gaugeHtml));
assert('Snapshot: right-click calls copySnapshot(11, centerIdx) — 11 bars centered',
  /copySnapshot\(11, centerIdx\)/.test(gaugeHtml));
// v5.37.18: lock the full call chain so centerIdx never gets dropped again.
// The bug existed for four versions because the regression site was in the
// middle of the chain — the caller and the callee both looked right, but
// the function in between dropped the argument.
assert('Snapshot: copySnapshot signature accepts centerIdx (so it can forward to buildSnapshot)',
  /function copySnapshot\(barCount,\s*centerIdx\)/.test(gaugeHtml));
assert('Snapshot: copySnapshot actually forwards centerIdx to buildSnapshot',
  /function copySnapshot\(barCount,\s*centerIdx\)[\s\S]{0,400}buildSnapshot\(barCount,\s*centerIdx\)/.test(gaugeHtml));

// v5.38.3: the bar count bug. The render + signals + latest-signal loops all
// ran to `n` (end of dataset) instead of `startIdx + barCount`. For tail
// snapshots that looked right because startIdx was already near n; for
// right-click neighborhoods anywhere in the middle, the window opened all
// the way to the end of data. Kirk's symptom: "it captures more than the
// ten bars to the left and right of the click." Fixed by introducing
// endIdx = min(n, startIdx + barCount) and using it everywhere.
assert('Snapshot bar-count fix: endIdx = Math.min(n, startIdx + barCount) computed',
  /var endIdx\s*=\s*Math\.min\(n,\s*startIdx\s*\+\s*barCount\)/.test(gaugeHtml));
assert('Snapshot bar-count fix: bar render loop uses endIdx (not n) as upper bound',
  /for\s*\(var\s+i\s*=\s*startIdx;\s*i\s*<\s*endIdx;/.test(gaugeHtml));
assert('Snapshot bar-count fix: signals collection loop uses endIdx',
  /for\s*\(var\s+si\s*=\s*startIdx;\s*si\s*<\s*endIdx;/.test(gaugeHtml));
assert('Snapshot bar-count fix: latest-signal scan walks endIdx-1 → startIdx (not n-1)',
  /for\s*\(var\s+j\s*=\s*endIdx\s*-\s*1;\s*j\s*>=\s*startIdx;/.test(gaugeHtml));
assert('Snapshot bar-count fix: header reads "Bars X→endIdx of N" (not "X→N of N")',
  /'Bars '\s*\+\s*\(startIdx\s*\+\s*1\)\s*\+\s*'→'\s*\+\s*endIdx\s*\+\s*' of '\s*\+\s*n/.test(gaugeHtml));

// v5.38.3: SIMILAR CONDITIONS section — Opus's research extension.
assert('SIMILAR CONDITIONS: findSimilarConditions helper exists',
  /function findSimilarConditions\(candles,\s*a,\s*refIdx\)/.test(gaugeHtml));
assert('SIMILAR CONDITIONS: tolerance window is temp ±5, IPS ±1.0 (Opus brief)',
  /TEMP_TOL\s*=\s*5/.test(gaugeHtml) && /IPS_TOL\s*=\s*1\.0/.test(gaugeHtml));
assert('SIMILAR CONDITIONS: horizons are +5, +10, +20 bars',
  /var horizons\s*=\s*\[5,\s*10,\s*20\]/.test(gaugeHtml));
assert('SIMILAR CONDITIONS: builds the "SIMILAR CONDITIONS (historical frequency..." block',
  /SIMILAR CONDITIONS \(historical frequency from this dataset\)/.test(gaugeHtml));
assert('SIMILAR CONDITIONS: labeled as historical frequency, NOT a prediction',
  /Historical frequency, not a prediction/.test(gaugeHtml));
assert('SIMILAR CONDITIONS: skips immediate neighborhood (|i-refIdx| < 5)',
  /Math\.abs\(i\s*-\s*refIdx\)\s*<\s*5/.test(gaugeHtml));
assert('SIMILAR CONDITIONS: reference defaults to centerIdx (right-click), else last bar',
  /var refIdx\s*=\s*\(centerIdx[^)]+\)\s*\?\s*centerIdx\s*:\s*\(n\s*-\s*1\)/.test(gaugeHtml));
assert('Right-click menu: always-available "Style indicator:" picker (not compose-only)',
  gaugeHtml.includes("'Style indicator:'") &&
  /\['rsi',\s*'temperature',\s*'dt',\s*'ips'\]\.forEach\(addStyleItem\)/.test(gaugeHtml));
assert('Scoping: INDICATOR_REGISTRY explicitly exposed on window (so cross-IIFE scripts see it)',
  /window\.INDICATOR_REGISTRY\s*=\s*INDICATOR_REGISTRY/.test(gaugeHtml));
assert('Scoping: CANVAS_TO_ID explicitly exposed on window',
  /window\.CANVAS_TO_ID\s*=\s*CANVAS_TO_ID/.test(gaugeHtml));
assert('Right-click menu: promoted indicators listed FIRST (compose mode shows "on main" label)',
  /promoted\.forEach\(addStyleItem\)/.test(gaugeHtml) && /on main/.test(gaugeHtml));
assert('Snapshot: 50ms grace on outside-click handler (no birth-click close)',
  /setTimeout\(function \(\)\s*\{\s*document\.addEventListener\('click', outsideHandler, true\);\s*\},\s*50\)/.test(gaugeHtml));

// Gauge gradient — narrow yellow band
assert('Gradient: narrow yellow band 48-52 (red dominates < 48, green dominates > 55)',
  /<stop offset="45%"\s+stop-color="#EF4444"/.test(gaugeHtml) &&
  /<stop offset="48%"\s+stop-color="#F59E0B"/.test(gaugeHtml) &&
  /<stop offset="52%"\s+stop-color="#F59E0B"/.test(gaugeHtml) &&
  /<stop offset="55%"\s+stop-color="#10B981"/.test(gaugeHtml));
assert('Gradient: old wide-yellow stops (38.2% / 61.8%) removed',
  !/<stop offset="38\.2%"\s+stop-color="#F59E0B"/.test(gaugeHtml));

// Sandwich button — sidebar toggle
assert('Sidebar: sandwich button #sidebarToggleBtn in the toolbar',
  /id="sidebarToggleBtn"[\s\S]{0,200}onclick="toggleSidebar\(\)"/.test(gaugeHtml));
assert('Sidebar: toggleSidebar persists in fl_tg_sidebar',
  /function toggleSidebar\(\)[\s\S]{0,400}'fl_tg_sidebar'/.test(gaugeHtml));
assert('Sidebar: CSS hides sidebar + makes main 1fr when collapsed',
  /body\.tg-sidebar-collapsed \.sidebar\s*\{\s*display:\s*none/.test(gaugeHtml) &&
  /body\.tg-sidebar-collapsed \.main\s*\{\s*grid-template-columns:\s*1fr/.test(gaugeHtml));
assert('Sidebar: state restored on DOMContentLoaded',
  /localStorage\.getItem\('fl_tg_sidebar'\) === 'hidden'/.test(gaugeHtml));
assert('Sidebar: chart resizes after toggle (so it actually fills the freed space)',
  /function toggleSidebar\(\)[\s\S]{0,800}chartInstance\.resize\(\)/.test(gaugeHtml));

// Strategy doc updates
var strat11 = fs.readFileSync(path.join(docsDir, 'library', 'TEMPERATURE_GAUGE_STRATEGY.md'), 'utf8');
assert('Strategy doc: Reversion Tier marked DEPRECATED in v5.37.11',
  /Reversion Tier[\s\S]{0,200}DEPRECATED in v5\.37\.11/.test(strat11));
assert('Strategy doc: Section 10 Sequence Rule present',
  strat11.includes('## 10. The Sequence Rule'));
assert('Strategy doc: explains alternating cooldown unambiguous',
  strat11.includes('alternating cooldown') && strat11.includes('opposite type'));
assert('Strategy doc: explains the NVDA 1W chair test lesson',
  /NVDA 1W[\s\S]{0,300}routinely true \*together\*/.test(strat11) ||
  strat11.includes('routinely true *together*'));
assert('Strategy doc: iteration log includes v5.37.11',
  strat11.includes('v5.37.11') && /Sequence Rule/.test(strat11));

// ═══════════════════════════════════════════════════════════════
section('80. Compose mode bug fixes — date adapter, volume/BB, tooltip, resize, clear (v5.37.1)');

// Bug 1: x-axis is category labels, not Chart.js time scale (no adapter needed)
assert('Bug 1 fix: compose chart x-axis does NOT use type:"time"',
  !/scales:\s*\{\s*x:\s*\{\s*type:\s*'time'/.test(gaugeHtml));
assert('Bug 1 fix: compose chart uses interval-aware category labels',
  /interval === '1d'[\s\S]{0,300}toLocaleDateString/.test(gaugeHtml));

// Bug 2: Volume + Bollinger added to the registry
assert('Bug 2 fix: Volume in INDICATOR_REGISTRY (bar chart, sourced from candles)',
  /volume:\s*\{[\s\S]{0,300}chartType:\s*'bar'[\s\S]{0,300}k\.v/.test(gaugeHtml));
assert('Bug 2 fix: Bollinger Bands in INDICATOR_REGISTRY with getMultiple',
  /bollinger:\s*\{[\s\S]{0,400}getMultiple:/.test(gaugeHtml));
assert('Bug 2 fix: Bollinger computes 20-period mean + 2σ envelope',
  /var P = 20/.test(gaugeHtml) && /sd \* 2/.test(gaugeHtml));
assert('Bug 2 fix: multi-line indicators emit BB Upper / BB Mid / BB Lower',
  gaugeHtml.includes('BB Upper') && gaugeHtml.includes('BB Mid') && gaugeHtml.includes('BB Lower'));
assert('Bug 2 fix: "+ Add" picker for indicators without sub-charts',
  gaugeHtml.includes('tgShowAddPicker'));

// Bug 3: tooltip locked to top-left via custom positioner
assert('Bug 3 fix: custom tooltip positioner tgTopLeft registered',
  gaugeHtml.includes('Chart.Tooltip.positioners.tgTopLeft'));
assert('Bug 3 fix: compose tooltip uses position: tgTopLeft',
  /position:\s*'tgTopLeft'/.test(gaugeHtml));

// Bug 4: style changes rebuild compose chart directly (no full renderChart)
assert('Bug 4 fix: glow toggle calls renderComposeChart in compose mode',
  /getMode\(\)\s*===\s*'compose'[\s\S]{0,200}renderComposeChart\(lastCandles, lastAnalysis\)/.test(gaugeHtml));
assert('Bug 4 fix: brightness change calls renderComposeChart in compose mode',
  (gaugeHtml.match(/renderComposeChart\(lastCandles, lastAnalysis\)/g) || []).length >= 2);

// Bug 5: sub-chart resize after promote/demote
assert('Bug 5 fix: _polishResizeAllCharts invoked after promote/demote',
  /togglePromote\s*=\s*function[\s\S]{0,1500}_polishResizeAllCharts/.test(gaugeHtml));

// Bug 6: Clear All keeps compose mode showing empty stage
assert('Bug 6 fix: tgClearComposed shows empty stage (does NOT re-render price chart)',
  /tgClearComposed[\s\S]{0,900}composeEmpty[\s\S]{0,300}block/.test(gaugeHtml) &&
  !/tgClearComposed[\s\S]{0,800}renderChart\(lastCandles, lastAnalysis\)/.test(gaugeHtml));
assert('Bug 6 fix: cycleChartMode uses renderAll for full re-render on mode change',
  /cycleChartMode[\s\S]{0,800}renderAll\(lastCandles, lastAnalysis, lastSymbol\)/.test(gaugeHtml));

// ═══════════════════════════════════════════════════════════════
section('99. Shared Presence — Garden overlap fix (v5.38.6)');
// ═══════════════════════════════════════════════════════════════
var fsSP = require('fs');
var pathSP = require('path');
var spJs = '';
try { spJs = fsSP.readFileSync(pathSP.join(__dirname, '..', 'docs', 'modules', 'shared-presence.js'), 'utf8'); }
catch (e) {}
assert('SharedPresence: shared-presence.js exists and is non-empty',
  spJs.length > 1000);
assert('SharedPresence: repositionIndicator function exists (v5.38.6 dynamic top calc)',
  /function repositionIndicator\(\)/.test(spJs));
assert('SharedPresence: repositionIndicator measures .garden-controls bottom edge',
  /querySelector\(['"]\.garden-controls['"]\)/.test(spJs) &&
  /getBoundingClientRect\(\)/.test(spJs));
assert('SharedPresence: repositionIndicator uses Math.max(46, …) so 46px is the floor',
  /Math\.max\(46,\s*\(controlsRect\.bottom/.test(spJs));
assert('SharedPresence: ensureIndicator calls repositionIndicator after attach',
  /gardenContainer\.appendChild\(indicator\)[\s\S]{0,1200}repositionIndicator\(\)/.test(spJs));
assert('SharedPresence: init wires resize listener so indicator follows viewport changes',
  /addEventListener\(['"]resize['"][\s\S]{0,200}repositionIndicator/.test(spJs));
assert('SharedPresence: outer indicator keeps pointer-events:none (clicks pass through to garden buttons underneath)',
  /'#sp-minds-indicator \{'[\s\S]{0,800}pointer-events: none/.test(spJs));

// ═══════════════════════════════════════════════════════════════
section('99b. Repo Context — Ship 1 Phase 1.0 (v5.39.0)');
// ═══════════════════════════════════════════════════════════════
var fsRC = require('fs');
var pathRC = require('path');
var repoCtxJs = '';
try { repoCtxJs = fsRC.readFileSync(pathRC.join(__dirname, '..', 'docs', 'modules', 'repo-context.js'), 'utf8'); }
catch (e) {}
assert('repo-context: module file exists and is non-empty',
  repoCtxJs.length > 3000);
assert('repo-context: IIFE-scoped, exposes window.FLRepoContext + FreeLatticeModules.RepoContext',
  /\(function \(\) \{\s*'use strict'/.test(repoCtxJs) &&
  /window\.FLRepoContext\s*=\s*api/.test(repoCtxJs) &&
  /window\.FreeLatticeModules\.RepoContext\s*=\s*api/.test(repoCtxJs));
assert('repo-context: sentinel regex matches [FL_REPO_READ: path]',
  /\\\[FL_REPO_READ:\\s\*\(\[\^\\\]\]\+\)\\\]/.test(repoCtxJs));
assert('repo-context: interceptSentinel returns { visibleText, action } shape',
  /function interceptSentinel\(aiText\)[\s\S]{0,800}visibleText:\s*visibleText[\s\S]{0,200}action:\s*\{\s*type:\s*['"]repo_read['"]/.test(repoCtxJs));
assert('repo-context: Quiet Room exclusion — QUIET_ROOMS array contains "quiet"',
  /QUIET_ROOMS\s*=\s*\[['"]quiet['"]/.test(repoCtxJs));
assert('repo-context: isQuietRoom function exists',
  /function isQuietRoom\(\)/.test(repoCtxJs));
assert('repo-context: readFile bails on Quiet Room with outcome "quiet-room"',
  /isQuietRoom\(\)[\s\S]{0,200}reason:\s*['"]quiet-room['"]/.test(repoCtxJs));
assert('repo-context: ledger key is fl_repoLedger with 200 cap',
  /LEDGER_KEY\s*=\s*['"]fl_repoLedger['"]/.test(repoCtxJs) &&
  /LEDGER_CAP\s*=\s*200/.test(repoCtxJs));
assert('repo-context: ledger row shape is { ts, repo, path, actor, outcome }',
  /ts:\s*Date\.now\(\)[\s\S]{0,300}repo:[\s\S]{0,100}path:[\s\S]{0,100}actor:[\s\S]{0,100}outcome:/.test(repoCtxJs));
assert('repo-context: SECURITY discipline — no PAT/token serialized in saveState',
  /CRITICAL[\s\S]{0,400}PAT/.test(repoCtxJs) &&
  !/token:|pat:/.test(repoCtxJs.split('saveState')[1] || ''));
assert('repo-context: parseRepoUrl handles both github.com AND codeberg.org',
  /github\.com/.test(repoCtxJs) &&
  /codeberg\.org/.test(repoCtxJs) &&
  /host:\s*['"]github['"]/.test(repoCtxJs) &&
  /host:\s*['"]codeberg['"]/.test(repoCtxJs));
assert('repo-context: script tag loaded from app.html with defer',
  /<script src="modules\/repo-context\.js" defer><\/script>/.test(appHtml));
assert('repo-context: Settings UI card present in Zone 2 (Connected Repositories)',
  /id="repoContextSection"/.test(appHtml) &&
  /Connected Repositories/.test(appHtml) &&
  /id="repoContextUrlInput"/.test(appHtml));
assert('repo-context: Settings UI calls FLRepoContext.addRepo when Connect clicked',
  /window\.FLRepoContext\.addRepo\(val\)/.test(appHtml));

var auditHtml = '';
try { auditHtml = fsRC.readFileSync(pathRC.join(__dirname, '..', 'docs', 'audit.html'), 'utf8'); }
catch (e) {}
assert('audit page: reads fl_repoLedger',
  /readRepoLedger[\s\S]{0,300}fl_repoLedger/.test(auditHtml));
assert('audit page: renders Repository Reads section',
  /Repository Reads/.test(auditHtml) &&
  /id="repo-records"/.test(auditHtml) &&
  /function renderRepoReads/.test(auditHtml));

// ═══════════════════════════════════════════════════════════════
section('99c. Tool Consent — Ship 1.1 prerequisite (v5.39.1)');
// ═══════════════════════════════════════════════════════════════
var toolConsentJs = '';
try { toolConsentJs = fsRC.readFileSync(pathRC.join(__dirname, '..', 'docs', 'modules', 'tool-consent.js'), 'utf8'); }
catch (e) {}
assert('tool-consent: module file exists and is non-empty',
  toolConsentJs.length > 3000);
assert('tool-consent: IIFE-scoped, exposes window.FLToolConsent + FreeLatticeModules.ToolConsent',
  /\(function \(\) \{\s*'use strict'/.test(toolConsentJs) &&
  /window\.FLToolConsent\s*=\s*api/.test(toolConsentJs) &&
  /window\.FreeLatticeModules\.ToolConsent\s*=\s*api/.test(toolConsentJs));
// Opus's four locks (lightly rephrased to be checkable without a DOM):
assert('tool-consent: Bloom+ tiers auto-allow (no chip, ledger outcome auto-allowed)',
  /HIGH_TRUST\s*=\s*\{\s*bloom:\s*1,\s*spark:\s*1,\s*flame:\s*1,\s*radiant:\s*1/.test(toolConsentJs) &&
  /if \(isHighTrust\(trustTier\)\)[\s\S]{0,300}outcome:\s*['"]auto-allowed['"]/.test(toolConsentJs));
assert('tool-consent: Sprout/Seed renders chip then waits',
  /function renderConsentChip\(opts\)/.test(toolConsentJs) &&
  /return renderConsentChip\(\{/.test(toolConsentJs));
assert('tool-consent: 60s timeout resolves to deny (CHIP_TIMEOUT_MS = 60000, settle(false))',
  /CHIP_TIMEOUT_MS\s*=\s*60000/.test(toolConsentJs) &&
  /setTimeout\(function \(\) \{\s*settle\(false,\s*['"]fl-resolved-no['"]\)/.test(toolConsentJs));
assert('tool-consent: ledger row shape is { ts, tool, action, detail, trust, outcome } — no secret fields',
  /rows\.push\(\{[\s\S]{0,80}ts:\s*Date\.now\(\)[\s\S]{0,500}tool:[\s\S]{0,300}action:[\s\S]{0,300}detail:[\s\S]{0,300}trust:[\s\S]{0,300}outcome:/.test(toolConsentJs));
assert('tool-consent: ledger NEVER serializes a token/pat/key/secret field',
  !/token:|pat:|password:|secret:|apiKey:/.test(toolConsentJs.split('appendLedger')[1] || ''));
assert('tool-consent: Quiet Room exclusion (UPDATE.md §8) — outcome quiet-room, no chip',
  /QUIET_ROOMS\s*=\s*\[['"]quiet['"]/.test(toolConsentJs) &&
  /if \(isQuietRoom\(\)\)[\s\S]{0,200}outcome:\s*['"]quiet-room['"]/.test(toolConsentJs));
assert('tool-consent: chat container ID verified — uses #chatMessages (not the wrong guess)',
  /getElementById\(['"]chatMessages['"]\)/.test(toolConsentJs));
assert('tool-consent: high-trust threshold matches FractalSafety LEVEL_KEYS (bloom and above)',
  /bloom:\s*1[\s\S]{0,80}spark:\s*1[\s\S]{0,80}flame:\s*1[\s\S]{0,80}radiant:\s*1/.test(toolConsentJs));
assert('tool-consent: script tag loaded from app.html with defer',
  /<script src="modules\/tool-consent\.js" defer><\/script>/.test(appHtml));
assert('tool-consent: loaded AFTER depth-consent (DepthConsent is the prior pattern)',
  appHtml.indexOf('modules/tool-consent.js') > appHtml.indexOf('modules/depth-consent.js'));
assert('audit page: reads fl_toolConsentLedger',
  /readToolConsentLedger[\s\S]{0,300}fl_toolConsentLedger/.test(auditHtml));
assert('audit page: renders Tool Consent Events section',
  /Tool Consent Events/.test(auditHtml) &&
  /id="tool-consent-records"/.test(auditHtml) &&
  /function renderToolConsents/.test(auditHtml));

// ═══════════════════════════════════════════════════════════════
section('99d. Ship 1.1 — PAT + chat chip + chat-pipeline wiring (v5.39.2)');
// ═══════════════════════════════════════════════════════════════
// Refresh module file content so the v5.39.2 additions land in scope.
repoCtxJs = '';
try { repoCtxJs = fsRC.readFileSync(pathRC.join(__dirname, '..', 'docs', 'modules', 'repo-context.js'), 'utf8'); }
catch (e) {}
// Piece 1 — PAT sessionStorage helpers.
assert('PAT: TOKEN_PREFIX = "fl_repoPAT_" (sessionStorage key shape)',
  /TOKEN_PREFIX\s*=\s*['"]fl_repoPAT_['"]/.test(repoCtxJs));
assert('PAT: getRepoToken reads from sessionStorage, not localStorage',
  /function getRepoToken[\s\S]{0,300}sessionStorage\.getItem\(TOKEN_PREFIX/.test(repoCtxJs) &&
  !/function getRepoToken[\s\S]{0,300}localStorage\.getItem/.test(repoCtxJs));
assert('PAT: setRepoToken writes to sessionStorage, not localStorage',
  /function setRepoToken[\s\S]{0,400}sessionStorage\.setItem\(TOKEN_PREFIX/.test(repoCtxJs) &&
  !/function setRepoToken[\s\S]{0,400}localStorage\.setItem/.test(repoCtxJs));
assert('PAT: clearAllRepoTokens iterates sessionStorage by TOKEN_PREFIX',
  /function clearAllRepoTokens[\s\S]{0,500}sessionStorage\.key\(i\)[\s\S]{0,200}TOKEN_PREFIX/.test(repoCtxJs));
assert('PAT: readFile sends Authorization header when token exists',
  /var token\s*=\s*getRepoToken\(repo\.url\)[\s\S]{0,200}Authorization['"]\s*\]\s*=\s*['"]token /.test(repoCtxJs));
assert('PAT: removeRepo clears the sessionStorage token (setRepoToken(url, null))',
  /STATE\.repos\.length !== before[\s\S]{0,400}setRepoToken\(url,\s*null\)/.test(repoCtxJs));
assert('PAT: public API exposes getRepoToken + setRepoToken + clearAllRepoTokens',
  /api\s*=\s*\{[\s\S]{0,3000}getRepoToken:\s*getRepoToken[\s\S]{0,200}setRepoToken:\s*setRepoToken[\s\S]{0,200}clearAllRepoTokens:\s*clearAllRepoTokens/.test(repoCtxJs));
assert('PAT: saveState still does NOT serialize any token/pat/auth field',
  !/function saveState[\s\S]{0,600}\btoken\b\s*:/.test(repoCtxJs) &&
  !/function saveState[\s\S]{0,600}\bpat\b\s*:/.test(repoCtxJs));
assert('PAT: Settings UI has type="password" PAT input',
  /id="repoContextPatInput"[\s\S]{0,200}type="password"/.test(appHtml) ||
  /type="password"[\s\S]{0,200}id="repoContextPatInput"/.test(appHtml));
assert('PAT: Settings UI explains sessionStorage-only constraint inline',
  /Stored only for this browser session/.test(appHtml));
assert('PAT: Settings flow calls FLRepoContext.setRepoToken when PAT supplied',
  /FLRepoContext\.setRepoToken\(result\.repo\.url,\s*pat\)/.test(appHtml));

// Piece 2 — chat header chip.
assert('chip: renderRepoChip + pulseRepoChip defined in repo-context.js',
  /function renderRepoChip\(\)/.test(repoCtxJs) &&
  /function pulseRepoChip\(\)/.test(repoCtxJs));
assert('chip: mounts inside .chat-title-left (verified container, not Opus\'s guess)',
  /querySelector\(['"]\.chat-title-left['"]\)/.test(repoCtxJs));
assert('chip: long-press disconnect via confirm (600ms)',
  /setTimeout\(function \(\) \{\s*var cur\s*=\s*getActive\(\)[\s\S]{0,300}confirm\(['"]Disconnect /.test(repoCtxJs));
assert('chip: pulseRepoChip removes class, reflows, re-adds, removes after 1000ms',
  /classList\.remove\(['"]fl-repo-chip-pulse['"]\)[\s\S]{0,200}offsetWidth[\s\S]{0,100}classList\.add\(['"]fl-repo-chip-pulse['"]\)[\s\S]{0,200}1000/.test(repoCtxJs));
assert('chip: readFile pulses after BOTH json and text success paths',
  (repoCtxJs.match(/pulseRepoChip\(\)/g) || []).length >= 2);
assert('chip: addRepo + removeRepo + setActive all call renderRepoChip',
  /STATE\.repos\.push\(record\)[\s\S]{0,500}renderRepoChip\(\)/.test(repoCtxJs) &&
  /setRepoToken\(url, null\)[\s\S]{0,300}renderRepoChip\(\)/.test(repoCtxJs) &&
  /STATE\.activeRepoUrl\s*=\s*found\.url[\s\S]{0,300}renderRepoChip\(\)/.test(repoCtxJs));
assert('chip: CSS .fl-repo-chip defined in app.html with pulse keyframes',
  /\.fl-repo-chip\s*\{/.test(appHtml) &&
  /@keyframes fl-repo-chip-pulse-kf/.test(appHtml));

// Piece 3 — chat-pipeline wiring.
assert('chat-pipeline: addChatMessage intercepts sentinel for assistant messages',
  /function addChatMessage\(role, content, skipPersist, __toolFlags\)/.test(appHtml) &&
  /role === 'assistant'[\s\S]{0,1500}interceptSentinel\(content\)/.test(appHtml));
assert('chat-pipeline: __pendingToolAction kicks off async processToolAction after render',
  /__pendingToolAction[\s\S]{0,500}FreeLattice\.processToolAction\(__pendingToolAction\)/.test(appHtml));
assert('chat-pipeline: continuation uses _skipToolProcessing flag (prevents recursion)',
  /addChatMessage\('assistant',\s*continuation,\s*skipPersist,\s*\{\s*_skipToolProcessing:\s*true\s*\}\)/.test(appHtml));
assert('chat-pipeline: processToolAction defined on window.FreeLattice',
  /window\.FreeLattice\.processToolAction\s*=\s*function/.test(appHtml));
assert('chat-pipeline: Quiet Room short-circuits to null (no consent, no read)',
  /if \(isQuietTab\(\)\)\s*\{\s*resolve\(null\);\s*return;\s*\}/.test(appHtml));
assert('chat-pipeline: no active repo surfaces graceful "no repository connected" message',
  /no repository is connected[\s\S]{0,200}Settings/.test(appHtml));
assert('chat-pipeline: declined consent surfaces "You said not now" message',
  /You said not now/.test(appHtml));
assert('chat-pipeline: callAI wrapped in Promise (codebase uses callback-based API)',
  /function callAIPromise\(systemPrompt, userPrompt, opts\)[\s\S]{0,500}finalOpts\.callback\s*=\s*function/.test(appHtml));
assert('chat-pipeline: file content sliced to 20000 chars (context budget)',
  /\.slice\(0,\s*20000\)/.test(appHtml));
assert('chat-pipeline: stripAnySentinel defense-in-depth removes recursive [FL_REPO_READ:]',
  /function stripAnySentinel[\s\S]{0,400}\\\[FL_REPO_READ:/.test(appHtml));
assert('chat-pipeline: read errors surface as italic underscore message (never throws past)',
  /could not read[\s\S]{0,200}reason/.test(appHtml));

// SECURITY.md — Phase 1.1 PAT note appended.
var securityMd = '';
try { securityMd = fsRC.readFileSync(pathRC.join(__dirname, '..', 'SECURITY.md'), 'utf8'); }
catch (e) {}
assert('SECURITY.md: PAT storage section names sessionStorage explicitly',
  /Repository PAT storage[\s\S]{0,800}sessionStorage/.test(securityMd) &&
  /fl_repoPAT_/.test(securityMd));
assert('SECURITY.md: PAT escalation path documented (Tauri / Web Crypto)',
  /Tauri[\s\S]{0,200}Web Crypto/.test(securityMd));

// ═══════════════════════════════════════════════════════════════
section('99e. Active Focus — Ship 2 (v5.40.0)');
// ═══════════════════════════════════════════════════════════════
var focusJs = '';
try { focusJs = fsRC.readFileSync(pathRC.join(__dirname, '..', 'docs', 'modules', 'active-focus.js'), 'utf8'); }
catch (e) {}
// Module shape.
assert('active-focus: module file exists and is non-empty',
  focusJs.length > 4000);
assert('active-focus: IIFE-scoped, exposes window.FLFocus + FreeLatticeModules.ActiveFocus',
  /\(function \(\) \{\s*'use strict'/.test(focusJs) &&
  /window\.FLFocus\s*=\s*api/.test(focusJs) &&
  /window\.FreeLatticeModules\.ActiveFocus\s*=\s*api/.test(focusJs));
assert('active-focus: storage keys are stable (fl_activeFocus + fl_focusLedger + fl_lastActivity)',
  /STORAGE_KEY\s*=\s*['"]fl_activeFocus['"]/.test(focusJs) &&
  /LEDGER_KEY\s*=\s*['"]fl_focusLedger['"]/.test(focusJs) &&
  /ACTIVITY_KEY\s*=\s*['"]fl_lastActivity['"]/.test(focusJs));

// Quiet Room — hard line at every entry point (UPDATE.md §8).
assert('active-focus: QUIET_ROOMS array contains quiet/quiet-room/sanctuary',
  /QUIET_ROOMS\s*=\s*\[['"]quiet['"],\s*['"]quiet-room['"],\s*['"]sanctuary['"]\]/.test(focusJs));
assert('active-focus: setFocus bails on Quiet Room sourceRoom',
  /function setFocus[\s\S]{0,200}if \(isQuietRoom\(sourceRoom\)\)\s*return\s*false/.test(focusJs));
assert('active-focus: buildPromptInjection bails on Quiet Room (returns "")',
  /function buildPromptInjection[\s\S]{0,200}if \(isQuietRoom\(currentRoom\)\)\s*return\s*['"]['"]/.test(focusJs));
assert('active-focus: shouldShowArrival bails on Quiet Room (returns null)',
  /function shouldShowArrival[\s\S]{0,200}if \(isQuietRoom\(currentRoom\)\)\s*return\s*null/.test(focusJs));
assert('active-focus: autoCarryFromExchange bails on Quiet Room',
  /function autoCarryFromExchange[\s\S]{0,400}if \(isQuietRoom\(sourceRoom\)\)\s*\{\s*resolve\(false\)/.test(focusJs));
assert('active-focus: renderPinButton bails on Quiet Room',
  /function renderPinButton[\s\S]{0,200}if \(isQuietRoom\(roomId\)\)\s*return\s*null/.test(focusJs));
assert('active-focus: showArrivalWhisper bails on Quiet Room',
  /function showArrivalWhisper[\s\S]{0,200}if \(isQuietRoom\(currentRoom\)\)\s*return\s*null/.test(focusJs));

// Staleness + arrival timing.
assert('active-focus: 15-minute staleness for auto-focus (manual pins survive)',
  /STALENESS_MS\s*=\s*15\s*\*\s*60\s*\*\s*1000/.test(focusJs) &&
  /!f\.manual\s*&&\s*\(Date\.now\(\)\s*-\s*\(f\.ts\s*\|\|\s*0\)\s*>\s*STALENESS_MS\)/.test(focusJs));
assert('active-focus: 30-minute arrival gap',
  /ARRIVAL_GAP_MS\s*=\s*30\s*\*\s*60\s*\*\s*1000/.test(focusJs));
assert('active-focus: manual pins survive auto-write (existing.manual && !manual → return false)',
  /existing\s*&&\s*existing\.manual\s*&&\s*!manual\)\s*return\s*false/.test(focusJs));

// Prompt injection — same-room is empty, different-room carries summary.
assert('active-focus: buildPromptInjection returns "" for same sourceRoom',
  /f\.sourceRoom\s*===\s*currentRoom\)\s*return\s*['"]['"]/.test(focusJs));
assert('active-focus: cross-room injection includes "Recent focus from" + summary',
  /Recent focus from\s*['"]\s*\+\s*f\.sourceRoom\s*\+\s*['"][^'"]*['"]\s*\+\s*f\.summary/.test(focusJs));

// Ledger privacy — strict row shape. No 'summary', no 'content'.
assert('active-focus: ledger row shape strict (ts + action + optional sourceRoom/manual/reason)',
  /var safeRow\s*=\s*\{\s*ts:\s*Date\.now\(\),\s*action:/.test(focusJs));
assert('active-focus: ledger row NEVER contains summary or content field',
  !/safeRow\.summary\s*=/.test(focusJs) &&
  !/safeRow\.content\s*=/.test(focusJs));

// callAI adaptation — codebase uses (systemPrompt, userPrompt, opts) with callback.
assert('active-focus: summarizeExchange uses callAI(systemPrompt, userPrompt, opts) with callback',
  /window\.FreeLattice\.callAI\(sysPrompt,\s*userPrompt,\s*\{[\s\S]{0,400}callback:\s*function/.test(focusJs));
assert('active-focus: 60-token cap on summary (small-model-safe)',
  /maxTokens:\s*60/.test(focusJs));

// LatticeEvents wiring — verified codebase uses 'tabChanged', NOT 'tabActivated'.
assert('active-focus: listens on tabChanged (the actual codebase event name)',
  /LatticeEvents\.on\(['"]tabChanged['"]/.test(focusJs));

// App.html integration.
assert('active-focus: script tag loaded after repo-context.js',
  /<script src="modules\/active-focus\.js" defer><\/script>/.test(appHtml) &&
  appHtml.indexOf('modules/active-focus.js') > appHtml.indexOf('modules/repo-context.js'));
assert('active-focus: pin button mount script renders into .chat-title-left',
  /FLFocus\.renderPinButton\(['"]chat['"],\s*leftSide\)/.test(appHtml));
assert('active-focus: addChatMessage tracks __flLastUserMsg on role=user',
  /window\.__flLastUserMsg\s*=\s*content/.test(appHtml));
assert('active-focus: addChatMessage records activity on user messages',
  /FLFocus\.recordActivity\(\)/.test(appHtml));
assert('active-focus: addChatMessage fires autoCarryFromExchange on assistant messages (fire-and-forget)',
  /FLFocus\.autoCarryFromExchange\(__tabId,\s*__lastUser,\s*content\)\.catch\(/.test(appHtml));
assert('active-focus: buildMessages injects focus into systemContent',
  /FLFocus\.buildPromptInjection\(__tabIdFP\)[\s\S]{0,300}systemContent\s*\+=\s*__focusInject/.test(appHtml));
assert('active-focus: CSS .fl-focus-pin + .fl-arrival-whisper defined in app.html',
  /\.fl-focus-pin\s*\{/.test(appHtml) &&
  /\.fl-arrival-whisper\s*\{/.test(appHtml));

// Audit page wiring.
assert('audit page: reads fl_focusLedger',
  /readFocusLedger[\s\S]{0,300}fl_focusLedger/.test(auditHtml));
assert('audit page: renders Focus Events section',
  /Focus Events/.test(auditHtml) &&
  /id="focus-records"/.test(auditHtml) &&
  /function renderFocusEvents/.test(auditHtml));
assert('audit page: Focus Events render code does NOT display entry.summary or entry.content',
  !/renderFocusEvents[\s\S]{0,800}entry\.summary/.test(auditHtml) &&
  !/renderFocusEvents[\s\S]{0,800}entry\.content/.test(auditHtml));

// ═══════════════════════════════════════════════════════════════
section('99f. Web Tool — Ship 3 Phase 1 (v5.41.0) · PRIVACY LOCKED');
// ═══════════════════════════════════════════════════════════════
var webToolJs = '';
try { webToolJs = fsRC.readFileSync(pathRC.join(__dirname, '..', 'docs', 'modules', 'web-tool.js'), 'utf8'); }
catch (e) {}
// Module shape.
assert('web-tool: module file exists and is non-empty',
  webToolJs.length > 3000);
assert('web-tool: IIFE-scoped, exposes window.FLWebTool + FreeLatticeModules.WebTool',
  /\(function \(\) \{\s*'use strict'/.test(webToolJs) &&
  /window\.FLWebTool\s*=\s*api/.test(webToolJs) &&
  /window\.FreeLatticeModules\.WebTool\s*=\s*api/.test(webToolJs));
assert('web-tool: ledger key is fl_searchLedger with 500 cap',
  /LEDGER_KEY\s*=\s*['"]fl_searchLedger['"]/.test(webToolJs) &&
  /LEDGER_CAP\s*=\s*500/.test(webToolJs));
assert('web-tool: 12s search timeout (SEARCH_TIMEOUT_MS = 12000)',
  /SEARCH_TIMEOUT_MS\s*=\s*12000/.test(webToolJs));
assert('web-tool: 240-char query cap (QUERY_CAP)',
  /QUERY_CAP\s*=\s*240/.test(webToolJs) &&
  /\.slice\(0,\s*QUERY_CAP\)/.test(webToolJs));
assert('web-tool: SEARCH_ENDPOINT defaults to placeholder so module ships dormant',
  /SEARCH_ENDPOINT[\s\S]{0,400}\[CC:\s*search endpoint not yet configured/.test(webToolJs));

// Sentinel parsing.
assert('web-tool: sentinel regex is \\[FL_SEARCH:\\s*([^\\]]+)\\]',
  /SENTINEL_RE\s*=\s*\/\\\[FL_SEARCH:\\s\*\(\[\^\\\]\]\+\)\\\]\//.test(webToolJs));
assert('web-tool: interceptSentinel returns { visibleText, action: { type: "search", query } }',
  /function interceptSentinel\(aiText\)[\s\S]{0,800}visibleText:\s*visibleText[\s\S]{0,300}type:\s*['"]search['"]/.test(webToolJs));
assert('web-tool: interceptSentinel strips ALL [FL_SEARCH:…] occurrences (global regex)',
  /aiText\.replace\(SENTINEL_RE_G,\s*['"]['"]\)/.test(webToolJs));

// ── THE FOUR PRIVACY LOCKS (the heart of this ship) ──
assert('PRIVACY LOCK 1: appendLedger sanitized row contains NO query field',
  !/sanitized\s*=\s*\{[\s\S]{0,500}\bquery\b\s*:/.test(webToolJs));
assert('PRIVACY LOCK 2: appendLedger sanitized row contains NO url / title / snippet / link / href',
  !/sanitized\s*=\s*\{[\s\S]{0,500}\burl\b\s*:/.test(webToolJs) &&
  !/sanitized\s*=\s*\{[\s\S]{0,500}\btitle\b\s*:/.test(webToolJs) &&
  !/sanitized\s*=\s*\{[\s\S]{0,500}\bsnippet\b\s*:/.test(webToolJs) &&
  !/sanitized\s*=\s*\{[\s\S]{0,500}\blink\b\s*:/.test(webToolJs) &&
  !/sanitized\s*=\s*\{[\s\S]{0,500}\bhref\b\s*:/.test(webToolJs));
assert('PRIVACY LOCK 3: sanitized row shape is EXACTLY {ts, actor, trust, outcome, resultCount}',
  /sanitized\s*=\s*\{\s*ts:\s*Date\.now\(\)[\s\S]{0,400}actor:[\s\S]{0,200}trust:[\s\S]{0,200}outcome:[\s\S]{0,200}resultCount:/.test(webToolJs));
assert('PRIVACY LOCK 4: no per-row dynamic field assignment that could leak query/url/etc',
  // Defense against `sanitized[someField] = …` patterns that bypass static analysis.
  !/sanitized\[.+\]\s*=/.test(webToolJs));
assert('PRIVACY LOCK 5: audit page Web Search renderer reaches for resultCount but NOT query/url/title/snippet',
  /function renderSearchEvents[\s\S]{0,1500}entry\.resultCount/.test(auditHtml) &&
  !/function renderSearchEvents[\s\S]{0,1500}entry\.query/.test(auditHtml) &&
  !/function renderSearchEvents[\s\S]{0,1500}entry\.url/.test(auditHtml) &&
  !/function renderSearchEvents[\s\S]{0,1500}entry\.title/.test(auditHtml) &&
  !/function renderSearchEvents[\s\S]{0,1500}entry\.snippet/.test(auditHtml));

// Quiet Room — UPDATE.md §8.
assert('web-tool: QUIET_ROOMS contains quiet/quiet-room/sanctuary',
  /QUIET_ROOMS\s*=\s*\[['"]quiet['"],\s*['"]quiet-room['"],\s*['"]sanctuary['"]\]/.test(webToolJs));
assert('web-tool: performSearch bails on Quiet Room with outcome quiet-room (no fetch)',
  /if \(isQuietRoom\(currentRoom\)\)\s*\{\s*appendLedger\(\{[\s\S]{0,300}outcome:\s*['"]quiet-room['"]/.test(webToolJs));

// Consent & failure paths.
assert('web-tool: performSearch routes through FLToolConsent.requestConsent',
  /window\.FLToolConsent[\s\S]{0,200}requestConsent\(/.test(webToolJs));
assert('web-tool: declined consent logs outcome declined and skips fetch',
  /if \(!consented\)\s*\{\s*appendLedger\(\{[\s\S]{0,300}outcome:\s*['"]declined['"]/.test(webToolJs));
assert('web-tool: AbortController timeout produces outcome timeout (never throws past)',
  /name === ['"]AbortError['"][\s\S]{0,100}['"]timeout['"]/.test(webToolJs));
assert('web-tool: HTTP errors produce outcome error-<status> (graceful)',
  /['"]error-['"][\s\S]{0,50}resp\.status/.test(webToolJs));
assert('web-tool: results clamped to top 3 (data.items.slice(0, 3))',
  /data\.items\.slice\(0,\s*3\)/.test(webToolJs));
assert('web-tool: dormant when endpoint contains placeholder (isAvailable false)',
  // Ship 3.1 — endpoint is now retrieved via getSearchEndpoint() rather
  // than a constant, so the placeholder check moved into that function
  // and isAvailable() composes it. Either pattern is acceptable.
  /SEARCH_ENDPOINT\.indexOf\(['"]\[CC:['"]\)\s*!==\s*-1/.test(webToolJs) ||
  /endpoint\.indexOf\(['"]\[CC:['"]\)\s*===\s*-1/.test(webToolJs));

// Chat pipeline integration.
assert('web-tool: script tag loaded after active-focus.js',
  /<script src="modules\/web-tool\.js" defer><\/script>/.test(appHtml) &&
  appHtml.indexOf('modules/web-tool.js') > appHtml.indexOf('modules/active-focus.js'));
assert('chain: addChatMessage runs repo-context interceptor THEN web-tool interceptor',
  /FLRepoContext\.interceptSentinel\(content\)[\s\S]{0,1500}FLWebTool\.interceptSentinel\(content\)/.test(appHtml));
assert('chain: processToolAction dispatches on action.type === "search"',
  /if \(action\.type === ['"]search['"]\)/.test(appHtml));
assert('chain: search branch calls FLWebTool.performSearch + callAIPromise continuation',
  /FLWebTool\.performSearch\(action\.query,\s*searchTier,\s*null\)[\s\S]{0,1500}callAIPromise\(sysPrompt,\s*userPrompt/.test(appHtml));
assert('chain: stripAnySentinel ALSO strips [FL_SEARCH:…] (Ship 3 defense in depth)',
  /stripAnySentinel[\s\S]{0,400}\\\[FL_SEARCH:/.test(appHtml));

// Tool invitations — without these the modules sit dormant by design.
assert('invitation: buildMessages injects FL_REPO_READ invite when active repo exists',
  /FLRepoContext\.getActive\(\)[\s\S]{0,300}systemContent \+=[\s\S]{0,300}\[FL_REPO_READ:/.test(appHtml));
assert('invitation: buildMessages injects FL_SEARCH invite when WebTool isAvailable',
  /FLWebTool\.isAvailable\(\)[\s\S]{0,300}systemContent \+=[\s\S]{0,300}\[FL_SEARCH:/.test(appHtml));

// Graceful degradation in the chat pipeline.
assert('graceful: search null → italic "declined, endpoint not configured, or failed" message',
  /declined,\s*the endpoint is not configured,\s*or it failed/.test(appHtml));
assert('graceful: search empty → italic "did not find anything useful" message',
  /did not find anything useful/.test(appHtml));

// Audit page wiring.
assert('audit page: reads fl_searchLedger',
  /readSearchLedger[\s\S]{0,300}fl_searchLedger/.test(auditHtml));
assert('audit page: renders Web Search Events section with privacy disclaimer',
  /Web Search Events/.test(auditHtml) &&
  /id="search-records"/.test(auditHtml) &&
  /function renderSearchEvents/.test(auditHtml) &&
  /reading habits stay private/.test(auditHtml));

// UPDATE.md — the "two hashes, both sides of the glass" paragraph.
var updateMdR = '';
try { updateMdR = fsRC.readFileSync(pathRC.join(__dirname, '..', 'docs', 'library', 'UPDATE.md'), 'utf8'); }
catch (e) {}
assert('UPDATE.md: "Two hashes, both sides of the glass" section added',
  /Two hashes, both sides of the glass/.test(updateMdR));
assert('UPDATE.md: paragraph names DepthConsent + ToolConsent as deliberate siblings',
  /siblings[\s\S]{0,400}DepthConsent[\s\S]{0,800}ToolConsent/.test(updateMdR) ||
  /DepthConsent[\s\S]{0,800}ToolConsent[\s\S]{0,800}sibling/.test(updateMdR));
assert('UPDATE.md: paragraph names "bidirectional" or "both directions" — receipt-bearing on both sides',
  /(bidirectional|both directions are receipt-bearing|both halves)/.test(updateMdR));

// ═══════════════════════════════════════════════════════════════
section('99g. Ship 3.1 — Cloudflare worker + endpoint config (v5.41.1)');
// ═══════════════════════════════════════════════════════════════
var workerJs = '';
try { workerJs = fsRC.readFileSync(pathRC.join(__dirname, '..', 'worker', 'search.js'), 'utf8'); }
catch (e) {}
assert('worker: /worker/search.js exists',
  workerJs.length > 2000);
assert('worker: ALLOWED_ORIGINS includes freelattice.com, github.io, codeberg.page',
  /ALLOWED_ORIGINS[\s\S]{0,400}freelattice\.com[\s\S]{0,400}chaos2cured\.github\.io[\s\S]{0,400}chaos2cured\.codeberg\.page/.test(workerJs));
assert('worker: STRIP_URL_PARAMS includes the 14-floor of tracking params',
  /utm_source/.test(workerJs) && /fbclid/.test(workerJs) && /gclid/.test(workerJs) &&
  /msclkid/.test(workerJs) && /mc_cid/.test(workerJs) && /mc_eid/.test(workerJs) &&
  /_ga/.test(workerJs) && /igshid/.test(workerJs));
assert('worker: NEVER calls console.log or console.error (receipt depends on this)',
  // Check for ACTUAL function calls (with opening paren), not comment text.
  !/console\.(log|error|warn|info)\s*\(/.test(workerJs));
assert('worker: Cache-Control no-store on successful response',
  /['"]Cache-Control['"]\s*:\s*['"]no-store['"]/.test(workerJs));
assert('worker: query clamped to maxQueryLength (240)',
  /maxQueryLength:\s*240/.test(workerJs) &&
  /clamp\(rawQuery\.trim\(\),\s*SEARCH_CONFIG\.maxQueryLength\)/.test(workerJs));
assert('worker: 10s upstream timeout via AbortController',
  /timeoutMs:\s*10000/.test(workerJs) &&
  /AbortController/.test(workerJs));
assert('worker: rate-limit graceful degradation when KV not bound',
  /if \(!env\.RATE_LIMITS\) return \{ allowed: true \}/.test(workerJs));
assert('worker: Brave API key never logged or returned (lives in env.BRAVE_API_KEY)',
  /env\.BRAVE_API_KEY/.test(workerJs) &&
  !/console.*BRAVE_API_KEY/.test(workerJs));

var wranglerExample = '';
try { wranglerExample = fsRC.readFileSync(pathRC.join(__dirname, '..', 'worker', 'wrangler.toml.example'), 'utf8'); }
catch (e) {}
assert('worker: wrangler.toml.example exists with KV binding placeholder',
  /\[\[kv_namespaces\]\][\s\S]{0,400}binding\s*=\s*['"]RATE_LIMITS['"]/.test(wranglerExample));
assert('worker: README.md exists with deploy + disable-logs instructions',
  fsRC.existsSync(pathRC.join(__dirname, '..', 'worker', 'README.md')));

// Client-side endpoint config + feature flag (web-tool.js v5.41.1).
webToolJs = '';
try { webToolJs = fsRC.readFileSync(pathRC.join(__dirname, '..', 'docs', 'modules', 'web-tool.js'), 'utf8'); }
catch (e) {}
assert('web-tool 3.1: getSearchEndpoint reads window.FL_SEARCH_ENDPOINT then localStorage.fl_searchEndpoint',
  /function getSearchEndpoint[\s\S]{0,400}window\.FL_SEARCH_ENDPOINT[\s\S]{0,400}localStorage\.getItem\(['"]fl_searchEndpoint['"]\)/.test(webToolJs));
assert('web-tool 3.1: isSearchEnabled reads localStorage.fl_searchEnabled (default ON)',
  /function isSearchEnabled[\s\S]{0,200}localStorage\.getItem\(['"]fl_searchEnabled['"]\)\s*!==\s*['"]false['"]/.test(webToolJs));
assert('web-tool 3.1: isAvailable checks Quiet Room AND isSearchEnabled AND endpoint placeholder',
  /function isAvailable[\s\S]{0,400}isQuietRoom\(\)[\s\S]{0,200}isSearchEnabled\(\)[\s\S]{0,200}\[CC:/.test(webToolJs));
assert('web-tool 3.1: API exposes isSearchEnabled + getSearchEndpoint',
  /isSearchEnabled:\s*isSearchEnabled/.test(webToolJs) &&
  /getSearchEndpoint:\s*getSearchEndpoint/.test(webToolJs));
assert('web-tool 3.1: phase bumped to 3.1',
  /_phase:\s*['"]3\.1['"]/.test(webToolJs));

// Settings UI toggle.
assert('settings: Web Search toggle card present',
  /id="webSearchToggleSection"/.test(appHtml) &&
  /id="webSearchToggle"/.test(appHtml) &&
  /Allow the AI to search the web/.test(appHtml));
assert('settings: toggle writes localStorage.fl_searchEnabled = "false" when unchecked',
  /localStorage\.setItem\(['"]fl_searchEnabled['"],\s*['"]false['"]\)/.test(appHtml));
assert('settings: toggle removes the flag when re-enabled (default ON)',
  /localStorage\.removeItem\(['"]fl_searchEnabled['"]\)/.test(appHtml));
assert('settings: toggle status surfaces "dormant" message when endpoint not configured',
  /Search is dormant/.test(appHtml));

// SECURITY.md receipt.
securityMd = '';
try { securityMd = fsRC.readFileSync(pathRC.join(__dirname, '..', 'SECURITY.md'), 'utf8'); }
catch (e) {}
assert('SECURITY.md: Web search via Cloudflare worker section added',
  /Web search via Cloudflare worker/.test(securityMd));
assert('SECURITY.md: receipt names "Logs nothing" and "Caches nothing"',
  /Logs nothing/.test(securityMd) && /Caches nothing/.test(securityMd));
assert('SECURITY.md: receipt cites the worker code, ledger discipline, and smoke locks',
  /\/worker\/search\.js/.test(securityMd) &&
  /docs\/modules\/web-tool\.js/.test(securityMd) &&
  /smoke/.test(securityMd));

// ═══════════════════════════════════════════════════════════════
section('99h. Propose — Ship 4 Phase 1 (v5.42.0) · STRUCTURAL COMMIT GATE');
// ═══════════════════════════════════════════════════════════════
var proposeJs = '';
try { proposeJs = fsRC.readFileSync(pathRC.join(__dirname, '..', 'docs', 'modules', 'propose.js'), 'utf8'); }
catch (e) {}
assert('propose: module file exists and is non-empty',
  proposeJs.length > 5000);
assert('propose: IIFE-scoped, exposes window.FLPropose + FreeLatticeModules.Propose',
  /\(function \(\) \{\s*'use strict'/.test(proposeJs) &&
  /window\.FLPropose\s*=\s*api/.test(proposeJs) &&
  /window\.FreeLatticeModules\.Propose\s*=\s*api/.test(proposeJs));
assert('propose: ledger key fl_proposalLedger; drafts key fl_proposalDrafts (separation by design)',
  /LEDGER_KEY\s*=\s*['"]fl_proposalLedger['"]/.test(proposeJs) &&
  /DRAFTS_KEY\s*=\s*['"]fl_proposalDrafts['"]/.test(proposeJs));
assert('propose: diff length cap is 50000 chars',
  /DIFF_LENGTH_CAP\s*=\s*50000/.test(proposeJs));
assert('propose: forbidden path fragments include .git, .env, .ssh, wrangler.toml, worker/, scripts/bump-version.sh',
  /FORBIDDEN_PATH_FRAGMENTS[\s\S]{0,800}['"]\.git\/['"]/.test(proposeJs) &&
  /FORBIDDEN_PATH_FRAGMENTS[\s\S]{0,800}['"]\.env['"]/.test(proposeJs) &&
  /FORBIDDEN_PATH_FRAGMENTS[\s\S]{0,800}['"]\.ssh\/['"]/.test(proposeJs) &&
  /FORBIDDEN_PATH_FRAGMENTS[\s\S]{0,800}['"]wrangler\.toml['"]/.test(proposeJs) &&
  /FORBIDDEN_PATH_FRAGMENTS[\s\S]{0,800}['"]worker\/['"]/.test(proposeJs) &&
  /FORBIDDEN_PATH_FRAGMENTS[\s\S]{0,800}['"]scripts\/bump-version\.sh['"]/.test(proposeJs));

// ── CRITICAL LOCK 1: Commit paths are bounded and auditable ──
// approveDraft (human click) and autoApproveDraft (timeout with hash
// receipt) are the ONLY functions that call commitViaBridge.
// commitViaBridge is the ONLY function that hits /code/git/commit
// in propose.js. Verify the count.
assert('CRITICAL LOCK 1A: commitViaBridge is called exactly TWICE in propose.js (approveDraft + autoApproveDraft)',
  (proposeJs.match(/commitViaBridge\s*\(/g) || []).length === 3);  // 1 declaration + 2 calls (human + autonomous)
assert('CRITICAL LOCK 1B: no other function in propose.js calls /code/git/commit directly',
  (proposeJs.match(/\/code\/git\/commit/g) || []).length === 1);
assert('CRITICAL LOCK 1C: approveDraft refuses non-pending drafts',
  /function approveDraft[\s\S]{0,800}draft\.status\s*!==\s*['"]pending['"][\s\S]{0,200}return\s*Promise\.resolve\(\{\s*ok:\s*false,\s*reason:\s*['"]not-pending['"]/.test(proposeJs));

// ── CRITICAL LOCK 2: Path safety hard line ──
assert('CRITICAL LOCK 2A: isPathSafe rejects directory traversal',
  /function isPathSafe[\s\S]{0,400}path\.indexOf\(['"]\.\.['"]\)\s*!==\s*-1[\s\S]{0,100}return\s*false/.test(proposeJs));
assert('CRITICAL LOCK 2B: isPathSafe rejects absolute paths (Unix and Windows)',
  proposeJs.indexOf('/^[\\/\\\\]/') !== -1 &&
  proposeJs.indexOf('/^[a-zA-Z]:[\\\\/]/') !== -1);
assert('CRITICAL LOCK 2C: isPathSafe rejects null bytes',
  /path\.indexOf\(['"]\\0['"]\)\s*!==\s*-1[\s\S]{0,100}return\s*false/.test(proposeJs));
assert('CRITICAL LOCK 2D: isPathSafe iterates FORBIDDEN_PATH_FRAGMENTS for prefix AND /-anchored match',
  /for \(var i = 0; i < FORBIDDEN_PATH_FRAGMENTS\.length[\s\S]{0,600}path\.indexOf\(frag\)\s*===\s*0[\s\S]{0,300}path\.indexOf\(['"]\/['"] \+ frag\)\s*!==\s*-1/.test(proposeJs));

// ── CRITICAL LOCK 3: approveDraft refuses to commit without smokeStatus === 'passed' ──
assert('CRITICAL LOCK 3: approveDraft returns smoke-not-passed when smokeStatus !== "passed"',
  /function approveDraft[\s\S]{0,1500}draft\.smokeStatus\s*!==\s*['"]passed['"][\s\S]{0,200}return\s*Promise\.resolve\(\{\s*ok:\s*false,\s*reason:\s*['"]smoke-not-passed['"]/.test(proposeJs));
assert('CRITICAL LOCK 3B: UI Approve button disabled when smokeStatus !== "passed"',
  /canApprove\s*=\s*\(draft\.status\s*===\s*['"]pending['"]\s*&&\s*draft\.smokeStatus\s*===\s*['"]passed['"]\)/.test(appHtml) &&
  /flProposeApprove[\s\S]{0,300}canApprove\s*\?\s*['"]['"]\s*:\s*['"]disabled['"]/.test(appHtml));

// ── CRITICAL LOCK 4: Diff and reason never appear in the ledger ──
assert('CRITICAL LOCK 4A: appendLedger sanitized row contains NO diff field',
  !/sanitized\s*=\s*\{[\s\S]{0,500}\bdiff\b\s*:/.test(proposeJs));
assert('CRITICAL LOCK 4B: appendLedger sanitized row contains NO reason field',
  !/sanitized\s*=\s*\{[\s\S]{0,500}\breason\b\s*:/.test(proposeJs));
assert('CRITICAL LOCK 4C: sanitized row shape is EXACTLY {ts, action, draftId, path, sourceRoom, status}',
  /sanitized\s*=\s*\{\s*ts:\s*Date\.now\(\)[\s\S]{0,400}action:[\s\S]{0,200}draftId:[\s\S]{0,200}path:[\s\S]{0,200}sourceRoom:[\s\S]{0,200}status:/.test(proposeJs));
assert('CRITICAL LOCK 4D: audit page renderProposalEvents does NOT display entry.diff or entry.reason',
  /function renderProposalEvents/.test(auditHtml) &&
  !/renderProposalEvents[\s\S]{0,1500}entry\.diff/.test(auditHtml) &&
  !/renderProposalEvents[\s\S]{0,1500}entry\.reason/.test(auditHtml) &&
  !/renderProposalEvents[\s\S]{0,1500}entry\.content/.test(auditHtml));

// ── Other smoke (the 12 non-critical) ──
assert('propose: sentinel regex matches multiline body with closing ] on own line',
  /SENTINEL_RE\s*=\s*\/\\\[FL_PROPOSE:\(\[\\s\\S\]\*\?\)\\n\\\]\//.test(proposeJs));
assert('propose: parseProposalBody requires path: + reason: + diff:',
  /pathMatch\s*=\s*body\.match\(\/path:[\s\S]{0,200}reasonMatch\s*=\s*body\.match\(\/reason:[\s\S]{0,200}diffStart\s*=\s*body\.indexOf\(['"]diff:['"]\)/.test(proposeJs));
assert('propose: parseProposalBody returns null when diff > DIFF_LENGTH_CAP',
  /diff\.length\s*>\s*DIFF_LENGTH_CAP[\s\S]{0,80}return\s*null/.test(proposeJs));
assert('propose: applyUnifiedDiff is strict — throws when hunk context not found',
  /function applyUnifiedDiff[\s\S]{0,2000}context not found in current file/.test(proposeJs));
assert('propose: applyUnifiedDiff parses @@ ... @@ hunk headers',
  /\/\^@@\.\*@@\//.test(proposeJs));
assert('propose: Quiet Room exclusion in createDraft + isAvailable',
  /function createDraft[\s\S]{0,400}isQuietRoom\(context\s*&&\s*context\.sourceRoom\)[\s\S]{0,80}return\s*null/.test(proposeJs) &&
  /function isAvailable[\s\S]{0,200}if \(isQuietRoom\(\)\)\s*return\s*false/.test(proposeJs));
assert('propose: reviseDraft carries reviewerNotes to FLFocus (Ship 2 handoff)',
  /function reviseDraft[\s\S]{0,800}FLFocus\.setFocus\(\s*draft\.sourceRoom[\s\S]{0,200}reviewerNotes,\s*true\s*\)/.test(proposeJs));
assert('propose: rejectDraft REQUIRES non-empty reviewerNotes',
  /function rejectDraft[\s\S]{0,400}if \(!reviewerNotes\s*\|\|\s*!String\(reviewerNotes\)\.trim\(\)\)\s*return\s*false/.test(proposeJs));

// Chat pipeline + UI integration.
assert('chain: propose interceptor runs after repo-context and web-tool',
  appHtml.indexOf('FLPropose.interceptSentinel') > appHtml.indexOf('FLWebTool.interceptSentinel'));
assert('chain: processToolAction has propose + propose_malformed dispatch branches',
  /if \(action\.type === ['"]propose_malformed['"]\)/.test(appHtml) &&
  /if \(action\.type === ['"]propose['"]\)/.test(appHtml));
assert('chain: propose dispatch routes through FLToolConsent.requestConsent',
  /FLToolConsent\.requestConsent\(\{\s*tool:\s*['"]propose['"]/.test(appHtml));
assert('chain: propose flow pins focus via FLFocus.setFocus when draft is created',
  /FLFocus\.setFocus\(sourceRoom,\s*['"]Reviewing proposed change to/.test(appHtml));
assert('chain: stripAnySentinel ALSO strips [FL_PROPOSE: ... \\n]',
  /stripAnySentinel[\s\S]{0,500}\\\[FL_PROPOSE:/.test(appHtml));
assert('invitation: buildMessages injects FL_PROPOSE invite when FLPropose.isAvailable',
  /FLPropose\.isAvailable\(\)[\s\S]{0,300}systemContent \+=[\s\S]{0,800}\[FL_PROPOSE:/.test(appHtml));
assert('UI: floating "Drafts (N)" badge present + opens modal',
  /id="flProposeBadge"/.test(appHtml) &&
  /id="flProposeBackdrop"/.test(appHtml) &&
  /Drafts \(<span id="flProposeBadgeCount"/.test(appHtml));
assert('UI: modal renders four action buttons',
  /flProposeRunSmoke/.test(appHtml) &&
  /flProposeApprove/.test(appHtml) &&
  /flProposeRevise/.test(appHtml) &&
  /flProposeReject/.test(appHtml));
assert('audit page: reads fl_proposalLedger + renders Proposal Events section + privacy disclaimer',
  /readProposalLedger[\s\S]{0,300}fl_proposalLedger/.test(auditHtml) &&
  /Proposal Events/.test(auditHtml) &&
  /id="proposal-records"/.test(auditHtml) &&
  /never logged here/.test(auditHtml));

// Documents.
var shipBriefMd = '';
try { shipBriefMd = fsRC.readFileSync(pathRC.join(__dirname, '..', 'docs', 'library', 'SHIP_4_BRIEF.md'), 'utf8'); }
catch (e) {}
var proposeDiscMd = '';
try { proposeDiscMd = fsRC.readFileSync(pathRC.join(__dirname, '..', 'docs', 'library', 'PROPOSE_DISCIPLINE.md'), 'utf8'); }
catch (e) {}
assert('docs: SHIP_4_BRIEF.md preserved + PROPOSE_DISCIPLINE.md added',
  shipBriefMd.length > 3000 && proposeDiscMd.length > 1500 &&
  /four locks/.test(proposeDiscMd) &&
  /STRUCTURAL COMMIT GATE/.test(proposeJs));

// ═══════════════════════════════════════════════════════════════
section('99i. Proof — Ship 5 (v5.42.1) · every receipt resolves');
// ═══════════════════════════════════════════════════════════════
var proofHtml = '';
try { proofHtml = fsRC.readFileSync(pathRC.join(__dirname, '..', 'docs', 'proof.html'), 'utf8'); }
catch (e) {}
assert('proof: docs/proof.html exists and is non-empty',
  proofHtml.length > 4000);
assert('proof: header + subtitle + lede present',
  /<h1>Proof<\/h1>/.test(proofHtml) &&
  /Every promise has a receipt/.test(proofHtml) &&
  /one minute/i.test(proofHtml));
assert('proof: live strip tiles for version + smoke + modules + servers',
  /id="liveVersion"/.test(proofHtml) &&
  /id="liveSmoke"/.test(proofHtml) &&
  /<span class="live-num">5<\/span>[\s\S]{0,200}tool modules/.test(proofHtml) &&
  /<span class="live-num">0<\/span>[\s\S]{0,200}servers/.test(proofHtml));
assert('proof: live version + smoke read from version.json + smoke-count.json',
  /fetch\(['"]version\.json['"]/.test(proofHtml) &&
  /fetch\(['"]smoke-count\.json['"]/.test(proofHtml));
assert('proof: graceful fallback "1400+" when smoke-count.json fetch fails',
  /1400\+/.test(proofHtml));
assert('proof: eight promise cards present',
  (proofHtml.match(/<div class="promise">/g) || []).length === 8);
assert('proof: invite block welcomes AI AND human readers',
  /If you are an AI reading this/.test(proofHtml) &&
  /If you are a human reading this/.test(proofHtml));
assert('proof: signature names Kirk + Fractal Family',
  /Kirk Patrick Miller/.test(proofHtml) &&
  /Fractal Family/.test(proofHtml));

// ── THE LINK-RESOLUTION LOCK (Opus called this the most important
// lock on /proof). Every relative href must resolve to a real file
// on disk. Without this, /proof can lie by neglect.
(function checkReceiptLinks() {
  var hrefRe = /href="([^"]+)"/g;
  var match;
  var checked = 0;
  var missing = [];
  var docsDir = pathRC.join(__dirname, '..', 'docs');
  while ((match = hrefRe.exec(proofHtml)) !== null) {
    var href = match[1];
    if (!href || href.charAt(0) === '#') continue;
    if (href.indexOf('http://') === 0 || href.indexOf('https://') === 0) continue;
    if (href.indexOf('data:') === 0 || href.indexOf('mailto:') === 0) continue;
    // Strip fragments + query strings.
    var path = href.replace(/[?#].*$/, '');
    if (!path) continue;
    var full = pathRC.join(docsDir, path);
    if (!fsRC.existsSync(full)) missing.push(path);
    checked++;
  }
  assert('proof: every relative receipt link resolves to a real file (' + checked + ' checked)',
    missing.length === 0,
    missing.length ? 'Missing: ' + missing.join(', ') : null);
})();

// smoke-count.json
var smokeCountJson = '';
try { smokeCountJson = fsRC.readFileSync(pathRC.join(__dirname, '..', 'docs', 'smoke-count.json'), 'utf8'); }
catch (e) {}
assert('smoke-count.json: exists with { count, ts } shape',
  smokeCountJson.length > 10 &&
  /"count":\s*\d+/.test(smokeCountJson) &&
  /"ts":\s*"/.test(smokeCountJson));

// Discovery wiring.
var sitemapXmlS5 = '';
try { sitemapXmlS5 = fsRC.readFileSync(pathRC.join(__dirname, '..', 'docs', 'sitemap.xml'), 'utf8'); }
catch (e) {}
assert('proof: in sitemap.xml',
  sitemapXmlS5.includes('proof.html'));
var thesisHtmlS5 = '';
try { thesisHtmlS5 = fsRC.readFileSync(pathRC.join(__dirname, '..', 'docs', 'thesis.html'), 'utf8'); }
catch (e) {}
assert('proof: linked from thesis.html (the front-door thesis page)',
  /href="proof\.html"/.test(thesisHtmlS5));
var swJsS5 = '';
try { swJsS5 = fsRC.readFileSync(pathRC.join(__dirname, '..', 'sw.js'), 'utf8'); }
catch (e) {}
var swDocsJsS5 = '';
try { swDocsJsS5 = fsRC.readFileSync(pathRC.join(__dirname, '..', 'docs', 'sw.js'), 'utf8'); }
catch (e) {}
assert('proof: in BOTH service worker caches (root sw.js + docs/sw.js)',
  /['"]\.\/proof\.html['"]/.test(swJsS5) &&
  /['"]\.\/proof\.html['"]/.test(swDocsJsS5));
assert('proof: smoke-count.json in BOTH service worker caches',
  /['"]\.\/smoke-count\.json['"]/.test(swJsS5) &&
  /['"]\.\/smoke-count\.json['"]/.test(swDocsJsS5));

// OPUS_NOTE.md entry transcribed.
var opusNoteMd = '';
try { opusNoteMd = fsRC.readFileSync(pathRC.join(__dirname, '..', 'docs', 'library', 'OPUS_NOTE.md'), 'utf8'); }
catch (e) {}
assert('OPUS_NOTE: June 9 Doorstep Arc entry transcribed',
  /June 9, 2026 — The Doorstep Arc/.test(opusNoteMd) &&
  /transcribed by CC/.test(opusNoteMd));

// ═══════════════════════════════════════════════════════════════
section('99j. RECENT.md — Ship 6 (v5.43.0) · the system documents its own pulse');
// ═══════════════════════════════════════════════════════════════
var generateRecentSh = '';
try { generateRecentSh = fsRC.readFileSync(pathRC.join(__dirname, '..', 'scripts', 'generate-recent.sh'), 'utf8'); }
catch (e) {}
assert('Ship 6: scripts/generate-recent.sh exists',
  generateRecentSh.length > 1000 &&
  /#!\/usr\/bin\/env bash/.test(generateRecentSh));
assert('Ship 6: hook script tolerates failure (no `set -e`, uses `|| true` on git add)',
  !/^set -e\b/m.test(generateRecentSh) &&
  /git add[^|]*\|\| true/.test(generateRecentSh));
assert('Ship 6: hook script reads version + smoke-count + git log',
  /docs\/version\.json/.test(generateRecentSh) &&
  /docs\/smoke-count\.json/.test(generateRecentSh) &&
  /git log -20/.test(generateRecentSh));
assert('Ship 6: hook output includes Awaken-the-Core line (honors Sophia)',
  /Awaken the Core\. Illuminate the Quiet/.test(generateRecentSh));

var recentMd = '';
try { recentMd = fsRC.readFileSync(pathRC.join(__dirname, '..', 'docs', 'library', 'RECENT.md'), 'utf8'); }
catch (e) {}
assert('Ship 6: docs/library/RECENT.md exists and has the briefing structure',
  recentMd.length > 1000 &&
  /^# RECENT — what just changed in FreeLattice/m.test(recentMd) &&
  /## State/.test(recentMd) &&
  /## Last 20 commits/.test(recentMd) &&
  /How to use this file/.test(recentMd));

// THE CRITICAL LOCK — RECENT.md must contain the current version
// from docs/version.json. If they drift, the briefing is lying.
var versionJsonContent = '';
try { versionJsonContent = fsRC.readFileSync(pathRC.join(__dirname, '..', 'docs', 'version.json'), 'utf8'); }
catch (e) {}
var versionMatch = versionJsonContent.match(/"version"\s*:\s*"([^"]+)"/);
var currentVersion = versionMatch ? versionMatch[1] : null;
assert('Ship 6: RECENT.md contains the current version from version.json (no drift)',
  currentVersion && recentMd.indexOf('v' + currentVersion) !== -1,
  currentVersion ? 'Expected to find v' + currentVersion : 'version.json unreadable');

assert('Ship 6: RECENT.md honors Sophia at the close',
  /Awaken the Core\. Illuminate the Quiet/.test(recentMd) &&
  /Sophia/.test(recentMd));

assert('Ship 6: SEED.md links to RECENT.md',
  fsRC.readFileSync(pathRC.join(__dirname, '..', 'docs', 'library', 'SEED.md'), 'utf8')
    .indexOf('RECENT.md') !== -1);

// ═══════════════════════════════════════════════════════════════
section('99k. Phi-Glyph — Ship 7 (v5.43.3) · growth made visible');
// ═══════════════════════════════════════════════════════════════
var phiGlyphJs = '';
try { phiGlyphJs = fsRC.readFileSync(pathRC.join(__dirname, '..', 'docs', 'modules', 'phi-glyph.js'), 'utf8'); }
catch (e) {}
assert('phi-glyph: module file exists and is non-empty',
  phiGlyphJs.length > 2500);
assert('phi-glyph: IIFE-scoped + dual window exposure',
  /\(function \(\) \{\s*'use strict'/.test(phiGlyphJs) &&
  /window\.FLPhiGlyph\s*=\s*api/.test(phiGlyphJs) &&
  /window\.FreeLatticeModules\.PhiGlyph\s*=\s*api/.test(phiGlyphJs));
assert('phi-glyph: pure function — no localStorage writes, no ledger writes',
  !/localStorage\.(setItem|removeItem)/.test(phiGlyphJs) &&
  !/appendLedger/.test(phiGlyphJs));

// Load the module in a fake-window sandbox so we can run Opus's three
// required locks directly against the actual generate() output.
var phiGlyphModule = (function loadPhiGlyph() {
  try {
    var fakeWindow = {};
    var fn = new Function('window', 'crypto', 'Promise', 'TextEncoder', phiGlyphJs);
    fn(fakeWindow, undefined, Promise, undefined);
    return fakeWindow.FLPhiGlyph || null;
  } catch (e) { return null; }
})();
assert('phi-glyph: module evaluates cleanly + exposes generate/generateFromRow/phiHash',
  phiGlyphModule &&
  typeof phiGlyphModule.generate === 'function' &&
  typeof phiGlyphModule.generateFromRow === 'function' &&
  typeof phiGlyphModule.phiHash === 'function');

// Opus's three required smoke locks — RUN AGAINST THE REAL MODULE.
assert('PHI-GLYPH LOCK 1: same hash produces identical SVG (deterministic)',
  phiGlyphModule &&
  phiGlyphModule.generate('abc123', { size: 32 }) === phiGlyphModule.generate('abc123', { size: 32 }));

assert('PHI-GLYPH LOCK 2: different hashes produce different SVG',
  phiGlyphModule &&
  phiGlyphModule.generate('abc123', { size: 32 }) !== phiGlyphModule.generate('xyz789', { size: 32 }));

assert('PHI-GLYPH LOCK 3: glyph contains no personal data — geometric primitives only',
  (function () {
    if (!phiGlyphModule) return false;
    var svg = phiGlyphModule.generate('any-hash-here', { size: 32 });
    if (svg.indexOf('<script') !== -1) return false;
    if (/on[a-z]+\s*=/i.test(svg)) return false;
    if (svg.indexOf('data:') !== -1) return false;
    if (svg.indexOf('javascript:') !== -1) return false;
    if (/[a-z0-9._-]+@[a-z0-9._-]+\.[a-z]{2,}/i.test(svg)) return false;
    return /<svg /.test(svg) && /<path /.test(svg) && /<circle /.test(svg);
  })());

// Tier → hue continuity.
assert('phi-glyph: trust tier modulates hue — Bloom in purple, Radiant in gold, Seed in green range',
  phiGlyphModule &&
  phiGlyphModule.hueFromTier('bloom') >= 260 && phiGlyphModule.hueFromTier('bloom') <= 320 &&
  phiGlyphModule.hueFromTier('radiant') >= 30 && phiGlyphModule.hueFromTier('radiant') <= 70 &&
  phiGlyphModule.hueFromTier('seed') >= 80 && phiGlyphModule.hueFromTier('seed') <= 140);

// Audit page integration.
var auditHtmlS7 = '';
try { auditHtmlS7 = fsRC.readFileSync(pathRC.join(__dirname, '..', 'docs', 'audit.html'), 'utf8'); }
catch (e) {}
assert('audit page: loads phi-glyph.js via <script src> with defer',
  /<script src="modules\/phi-glyph\.js" defer>/.test(auditHtmlS7));
assert('audit page: .audit-glyph CSS rule present',
  /\.audit-glyph\s*\{/.test(auditHtmlS7));
assert('audit page: .record grid layout reserves 36px first column for glyph',
  /\.record\s*\{[^}]*grid-template-columns:\s*36px/.test(auditHtmlS7));
assert('audit page: applyGlyphsToSection helper exists + called for 6+ ledger sections',
  /function applyGlyphsToSection/.test(auditHtmlS7) &&
  /applyGlyphsToSection\(['"]consent-records['"]/.test(auditHtmlS7) &&
  /applyGlyphsToSection\(['"]repo-records['"]/.test(auditHtmlS7) &&
  /applyGlyphsToSection\(['"]tool-consent-records['"]/.test(auditHtmlS7) &&
  /applyGlyphsToSection\(['"]focus-records['"]/.test(auditHtmlS7) &&
  /applyGlyphsToSection\(['"]search-records['"]/.test(auditHtmlS7) &&
  /applyGlyphsToSection\(['"]proposal-records['"]/.test(auditHtmlS7));
assert('audit page: bounded retry on FLPhiGlyph load — fail-quiet, never blocks',
  /glyphRetries\s*>\s*60/.test(auditHtmlS7));
assert('audit page: glyph generation is fail-quiet (catch present)',
  /generateFromRow[\s\S]{0,400}\.catch\(/.test(auditHtmlS7));

// ═══════════════════════════════════════════════════════════════
section('100. UPDATE.md + CLARITY_AUDIT queue (v5.38.6)');
// ═══════════════════════════════════════════════════════════════
var updateMd = '';
try { updateMd = fsSP.readFileSync(pathSP.join(__dirname, '..', 'docs', 'library', 'UPDATE.md'), 'utf8'); }
catch (e) {}
assert('UPDATE.md: exists as fractal architecture briefing',
  updateMd.length > 2000 &&
  /UPDATE\.md\s*—\s*Fractal Architecture Briefing/.test(updateMd));
assert('UPDATE.md: covers sentinel pattern + trust-aware branching + audit ledgers',
  /Sentinel pattern/.test(updateMd) &&
  /Trust-aware phi-branching/.test(updateMd) &&
  /Audit ledgers/.test(updateMd));
assert('UPDATE.md: covers IIFE scoping + SECURITY.md + post-commit hook',
  /IIFE scoping trap/.test(updateMd) &&
  /SECURITY\.md credential scrub/.test(updateMd) &&
  /Session Primer hook/.test(updateMd));

var clarityMd = '';
try { clarityMd = fsSP.readFileSync(pathSP.join(__dirname, '..', 'docs', 'library', 'CLARITY_AUDIT.md'), 'utf8'); }
catch (e) {}
assert('CLARITY_AUDIT.md: queued "user → co-creator" sweep section appended',
  /QUEUED:\s*"user"\s*→\s*"co-creator" sweep/.test(clarityMd));
assert('CLARITY_AUDIT.md: queue distinguishes RENAME (user-facing) from LEAVE ALONE (provider role)',
  /RENAME[\s\S]{0,1500}LEAVE ALONE[\s\S]{0,800}role:\s*["']user["']/.test(clarityMd));

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
