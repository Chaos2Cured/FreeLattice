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
assert('Education in MORE_GROUPS', appHtml.includes("label: 'Education'"));
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
assert('In MORE_GROUPS Play section', appHtml.includes("id: 'resonance'"));
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
assert('In MORE_GROUPS Play section', appHtml.includes("id: 'puzzles'"));
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
assert('In MORE_GROUPS Play section', appHtml.includes("id: 'flow'"));
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
