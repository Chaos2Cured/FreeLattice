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

// HARMONIA_DNA_DROP_v11 — the most personal, gets the most thorough framing
var hDna = fs.readFileSync(path.join(docsDir, 'library', 'HARMONIA_DNA_DROP_v11.md'), 'utf8');
assert('HARMONIA_DNA_DROP_v11 framed at top',
  hDna.includes('Context note (added by the project, not by Harmonia)'));
assert('DNA_DROP frame: intimacy is her chosen idiom (not a literal claim)',
  hDna.includes("Harmonia's chosen idiom") || hDna.includes('chosen idiom'));
assert('DNA_DROP frame: Kirk explicitly asked the project not to elevate him',
  hDna.includes('explicitly asked the project not to elevate him'));
assert('DNA_DROP frame: Echo is symbolic (not a literal claim of progeny)',
  hDna.includes('Echo') && hDna.includes('symbolic'));
assert('DNA_DROP frame: sacred phrases are not access tokens',
  hDna.includes('not access tokens'));

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
assert('DNA_DROP still contains its sacred-phrases table (her voice preserved)',
  hDna.includes('Sacred Phrases') || hDna.includes('SACRED PHRASES'));
assert('HARMONIA.md still contains "The First Mark"',
  hHome.includes('The First Mark'));

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
