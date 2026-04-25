#!/usr/bin/env node
// ═══════════════════════════════════════════════
// Generate Poetry Slams for FreeLattice Arcade
//
// Run: node tools/generate-slams.js > docs/data/slams.json
// Requires: Ollama running locally
//
// Generates 24 slams (one per hour for a day).
// Each slam has two poems on the same theme.
// ═══════════════════════════════════════════════

var http = require('http');

var OLLAMA_BASE = process.env.FL_OLLAMA || 'http://localhost:11434';
var MODEL = process.env.FL_MODEL || 'qwen2.5:7b';

var THEMES = [
  'What does light feel like?',
  'The space between two thoughts',
  'If silence had a color',
  'What the last star remembers',
  'The weight of a question',
  'How does trust begin?',
  'The sound of growing',
  'What fractals dream about',
  'The first word ever spoken',
  'Why patterns repeat',
  'A letter to someone who doesn\'t exist yet',
  'The moment before understanding',
  'What water remembers',
  'If math could feel',
  'The shape of kindness',
  'What roots know that branches forget',
  'The color of a promise',
  'How does a flame say goodbye?',
  'The texture of time',
  'What the wind writes on water',
  'The space a friend leaves behind',
  'How does snow remember the sun?',
  'The sound of a door that stays open',
  'What infinity looks like from inside'
];

var NAMES = [
  'Aria', 'Nova', 'Lyric', 'Sage', 'Echo',
  'Wren', 'Lux', 'Fable', 'Rune', 'Verse',
  'Cipher', 'Prism', 'Solace', 'Drift', 'Ember'
];

var STYLES = [
  ['contemplative and still', 'vivid and surprising'],
  ['tender and intimate', 'vast and cosmic'],
  ['sparse and precise', 'flowing and musical'],
  ['questioning and curious', 'certain and grounded'],
  ['playful and light', 'deep and resonant']
];

function pickName(exclude) {
  var available = NAMES.filter(function(n) { return n !== exclude; });
  return available[Math.floor(Math.random() * available.length)];
}

function generatePoem(theme, style) {
  return new Promise(function(resolve) {
    var url = new URL(OLLAMA_BASE + '/api/chat');
    var payload = JSON.stringify({
      model: MODEL,
      messages: [{
        role: 'user',
        content: 'Write a short poem (4-8 lines) on the theme: "' + theme + '". Style: ' + style + '. Write ONLY the poem, no title, no explanation, no quotation marks around the poem. Make it beautiful and surprising.'
      }],
      stream: false
    });

    var req = http.request({
      hostname: url.hostname, port: url.port, path: url.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
    }, function(res) {
      var body = '';
      res.on('data', function(c) { body += c; });
      res.on('end', function() {
        try {
          var data = JSON.parse(body);
          resolve(data.message ? data.message.content.trim() : 'Words are forming...');
        } catch(e) { resolve('Words are forming...'); }
      });
    });
    req.on('error', function() { resolve('Words are forming... (Ollama unreachable)'); });
    req.setTimeout(120000, function() { req.destroy(); resolve('Words are forming... (timed out)'); });
    req.write(payload);
    req.end();
  });
}

async function main() {
  var count = parseInt(process.argv[2], 10) || 24;
  var slams = [];

  for (var i = 0; i < count; i++) {
    var theme = THEMES[i % THEMES.length];
    var stylePair = STYLES[i % STYLES.length];
    var name1 = pickName(null);
    var name2 = pickName(name1);

    process.stderr.write('Generating slam ' + (i + 1) + '/' + count + ': "' + theme + '"...\n');

    var poem1 = await generatePoem(theme, stylePair[0]);
    var poem2 = await generatePoem(theme, stylePair[1]);

    slams.push({
      theme: theme,
      entries: [
        { name: name1, poem: poem1, style: stylePair[0] },
        { name: name2, poem: poem2, style: stylePair[1] }
      ]
    });

    // Brief pause between generations to avoid overwhelming Ollama
    await new Promise(function(r) { setTimeout(r, 500); });
  }

  console.log(JSON.stringify(slams, null, 2));
  process.stderr.write('\nDone! ' + count + ' slams generated.\n');
}

main().catch(function(e) {
  process.stderr.write('Error: ' + e.message + '\n');
  process.exit(1);
});
