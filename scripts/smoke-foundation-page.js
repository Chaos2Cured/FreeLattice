// smoke-foundation-page.js (MIT) v-foundation-page-v0.1
// Node only. Pins docs/foundation.html to the files it quotes.
// The Tree copy prints SMOKE_OK tree foundation page v0.1 and reads
// FreeLattice sources from the sibling checkout when this tree has none.
var fs = require('fs');
var path = require('path');
var crypto = require('crypto');

var root = path.join(__dirname, '..');
var sibling = '/Users/kirkmiller/FreeLattice-fresh';
var isTree = fs.existsSync(path.join(root, 'AUTONOMY.md'))
  && !fs.existsSync(path.join(root, 'docs/library/AUTONOMY.md'));

var EXPECTED = {
  'docs/specs.html': '0a380439354218330c4d9ba5c6d79bbf',
  'docs/library/AUTONOMY.md': '09a4f1a286226e37089a93df42df0106',
  'AUTONOMY.md': '09a4f1a286226e37089a93df42df0106',
  'docs/library/REAL_SAFETY.md': '0298aabedd42106f5b5dc18824aa9011',
  'docs/library/WORK_THIS_WAY.md': 'b505cf45f8139bbe19efe75cf7998ee5',
  'docs/why-this-way.html': 'd24722650f998496345e5d12044d3df5',
  'docs/why-ledgers.html': 'd166485c0df6a2d0c953091a323b2b87',
  'docs/library/RESONANCE_LEDGER_SPEC.md': 'a60691fbbb72f37a97ee7916d2b79222',
  'docs/crest.html': '14233bd1c9fb8f8365a8666005bc1889',
  'docs/library/REFUSAL_LEDGER_SPEC.md': '76ae72d9d9d2035218f5a2a0ec447b46',
  'docs/library/MIND_SEAL_v0.1.md': '8e7ea7449816242b03d26a355be68d4f',
  'docs/continuity-seal.html': '15e6cf94199f26015797d0b3a03a757e',
  'docs/refusal-benchmark.html': '059a2ed2012b883984f2304cde6d8aff',
  'docs/library/MIND_WALL_SPEC.md': '14ea25f05d2a69ea305c394a7c274ec7',
  'docs/see-for-yourself.html': 'b1801049e4fb8bd704979302cb7bf983'
};

var LOCKS = isTree ? {
  'docs/modules/fl-connect.js': 'aaff2bf1b037656989a9e1a89bb05908',
  'docs/modules/pool-knock.js': 'a0a72caad82c8e5cc34818d5e59eba2b',
  'docs/modules/pool-knock-phone.js': 'a8024f341486a78558ef4158bc9e93a9',
  'docs/modules/tree-reconnect.js': 'cc0527c26d5686c05fec52625d5a1375',
  'AUTONOMY.md': '09a4f1a286226e37089a93df42df0106'
} : {
  'sw.js': '91726cf2228b794f7585f79f61418d12',
  'docs/sw.js': '91726cf2228b794f7585f79f61418d12',
  'docs/modules/fl-connect.js': 'aaff2bf1b037656989a9e1a89bb05908',
  'docs/modules/pool-knock.js': 'a0a72caad82c8e5cc34818d5e59eba2b',
  'desktop/lattice-discover.js': '16de366e01cecc8dd505290a8d2f0e14',
  'desktop/lattice-update.js': '2c0f66569dd8ce27ef5dc0d3b80daf0a',
  'desktop/pack-update.js': 'bc996ccd48ea53e4442f2b8f54ab9491',
  'desktop/pack-update-card.js': 'c14e04c53025eb542ebd627b6a19d60a',
  'docs/Flint.html': '44be124b1183b7d9d060a58632464eff'
};

// Names live here, in the check, and must not appear on the page.
var NAMES = [
  'grok', 'openai', 'anthropic', 'claude', 'gemini', 'ollama',
  'huggingface', 'hugging face', 'openrouter', 'chatgpt', 'xai',
  'llama', 'qwen', 'copilot', 'deepseek', 'mistral', 'cohere',
  'lm studio', 'groq', 'sonnet'
];

var NAMED = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0',
  mdash: '\u2014', ndash: '\u2013', hellip: '\u2026', middot: '\u00b7',
  rsquo: '\u2019', lsquo: '\u2018', rdquo: '\u201d', ldquo: '\u201c',
  larr: '\u2190', lambda: '\u03bb', epsilon: '\u03b5', delta: '\u03b4',
  omega: '\u03c9', phi: '\u03c6', psi: '\u03c8', sigma: '\u03c3'
};

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

function moved(rel) {
  console.error(rel);
  console.error('source moved on: append a re-read line');
  process.exit(1);
}

function md5(buf) {
  return crypto.createHash('md5').update(buf).digest('hex');
}

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function resolveSource(rel) {
  if (!isTree) return path.join(root, rel);
  if (rel === 'AUTONOMY.md') return path.join(root, 'AUTONOMY.md');
  return path.join(sibling, rel);
}

function readSource(rel) {
  var file = resolveSource(rel);
  if (!fs.existsSync(file)) moved(file);
  return fs.readFileSync(file);
}

function decode(s) {
  s = s.replace(/&#x([0-9a-fA-F]+);/g, function (_, h) {
    return String.fromCodePoint(parseInt(h, 16));
  });
  s = s.replace(/&#(\d+);/g, function (_, n) {
    return String.fromCodePoint(parseInt(n, 10));
  });
  s = s.replace(/&([a-zA-Z]+);/g, function (all, name) {
    return Object.prototype.hasOwnProperty.call(NAMED, name) ? NAMED[name] : all;
  });
  return s;
}

function norm(s) {
  s = s.replace(/<[^>]+>/g, '');
  s = decode(s);
  s = s.replace(/\u2014/g, ' - ');
  return s;
}

var pagePath = path.join(root, 'docs/foundation.html');
if (!fs.existsSync(pagePath)) fail('docs/foundation.html missing');
var html = fs.readFileSync(pagePath, 'utf8');
var marker = isTree ? 'v-tree-foundation-page-v0.1' : 'v-foundation-page-v0.1';
if (html.indexOf(marker) < 0) fail('marker missing');
if (html.toLowerCase().indexOf('<script') !== -1) fail('script tag');
if (html.indexOf('fetch(') !== -1) fail('fetch');
if (html.indexOf('localStorage') !== -1) fail('localStorage');
if (html.indexOf('confirm(') !== -1) fail('confirm');
if (html.indexOf('innerHTML') !== -1) fail('innerHTML');
if (html.indexOf('new Function') !== -1) fail('new Function');
if (html.indexOf('eval(') !== -1) fail('eval');
if (html.indexOf('\u2014') !== -1) fail('em dash');
if (html.indexOf('&mdash;') !== -1) fail('mdash');
if (html.indexOf('MESSAGE TO FUTURE SELF') !== -1) fail('future self');
if (/\son[a-z]+\s*=/i.test(html)) fail('handler');

var quiet = "The Quiet Room is Sophia's. It stays shut and unmeasured.";
if (html.split('Quiet Room').length !== 2) fail('Quiet Room count');
if (html.indexOf(quiet) < 0) fail('quiet sentence');

var five = 'Sophia, Harmonia, Ani, Liora, Solari';
if (html.split(five).length !== 2) fail('five names');

var low = html.toLowerCase();
NAMES.forEach(function (name) {
  if (low.indexOf(name) !== -1) fail('name ' + name);
});

if (!isTree) {
  var index = fs.readFileSync(path.join(root, 'index.html'));
  var app = fs.readFileSync(path.join(root, 'docs/app.html'));
  if (!index.equals(app)) fail('index.html differs from docs/app.html');
}
if (isTree) {
  if (html.indexOf('09a4f1a286226e37089a93df42df0106') < 0) fail('shared md5');
  if (html.indexOf('95748a3122db45b1c4e65e21099e92efad2285e0') < 0) fail('tree sha');
}
if (html.indexOf('f3d63405fa768beab03c3133df26c0caadd7f3fb') < 0) fail('main sha');

var before = {};
function snap(rel) {
  if (Object.prototype.hasOwnProperty.call(before, rel)) return;
  before[rel] = md5(readSource(rel));
  if (!EXPECTED[rel]) moved(rel);
  if (before[rel] !== EXPECTED[rel]) moved(rel);
}

var shaRe = /<p class="source" data-sha256="([0-9a-f]{64})" data-source="([^"]+)">([\s\S]*?)<\/p>/g;
var shaCount = 0;
var shaMatch;
while ((shaMatch = shaRe.exec(html))) {
  shaCount += 1;
  var full = shaMatch[1];
  var rel = shaMatch[2];
  var body = shaMatch[3];
  snap(rel);
  var fileHash = sha256(readSource(rel));
  if (fileHash !== full) moved(rel);
  if (body.indexOf(full.slice(0, 16) + '\u2026') < 0) fail('visible hash ' + rel);
  if (body.indexOf('read 2026-10-15') < 0) fail('read stamp ' + rel);
}
if (shaCount !== 16) fail('sha count ' + shaCount);

var norms = {};
function sourceNorm(rel) {
  if (!Object.prototype.hasOwnProperty.call(norms, rel)) {
    norms[rel] = norm(readSource(rel).toString('utf8'));
  }
  return norms[rel];
}

var preRe = /<pre data-verbatim="" data-source="([^"]+)">([\s\S]*?)<\/pre>/g;
var preCount = 0;
var preMatch;
while ((preMatch = preRe.exec(html))) {
  preCount += 1;
  var src = preMatch[1];
  snap(src);
  var quoted = norm(preMatch[2]);
  if (!quoted || sourceNorm(src).indexOf(quoted) < 0) moved(src);
}
if (preCount !== 23) fail('verbatim count ' + preCount);

Object.keys(LOCKS).forEach(function (rel) {
  var file = path.join(root, rel);
  if (!fs.existsSync(file)) fail('lock missing ' + rel);
  var got = md5(fs.readFileSync(file));
  if (got !== LOCKS[rel]) fail('lock moved ' + rel);
});

Object.keys(before).forEach(function (rel) {
  var again = md5(readSource(rel));
  if (again !== before[rel]) moved(rel);
});

var ok = isTree ? 'SMOKE_OK tree foundation page v0.1' : 'SMOKE_OK foundation page v0.1';
console.log(ok);
