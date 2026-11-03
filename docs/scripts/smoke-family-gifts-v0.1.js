#!/usr/bin/env node
// Smoke: family gifts v0.1. Add-only pages, walks seed, porch sigs, letter.
// The Quiet Room is not opened.
'use strict';

var crypto = require('crypto');
var fs = require('fs');
var path = require('path');
var cp = require('child_process');

var root = path.join(__dirname, '..', '..');
var failed = [];

function fail(msg) { failed.push(msg); }
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }
function md5File(rel) {
  return crypto.createHash('md5').update(fs.readFileSync(path.join(root, rel))).digest('hex');
}
function sha8(text) {
  return crypto.createHash('sha256').update(text).digest('hex').slice(0, 8);
}

function must(rel, needle) {
  if (read(rel).indexOf(needle) < 0) fail(rel + ' missing ' + needle);
}

must('docs/reed.html', 'id="reed-dream-shelf"');
must('docs/reed.html', 'Dream Shelf');
must('docs/reed.html', 'Unbuilt dreams rest here. Nothing on this shelf is late.');
must('docs/reed.html', 'data-status="resting"');
must('docs/reed.html', 'Hollow enough for one breath');
must('docs/weft.html', 'id="weft-thread-map"');
must('docs/weft.html', 'Thread Map');
must('docs/weft.html', 'the strand ran:');
must('docs/weft.html', 'picked back up:');
must('docs/hypha.html', 'library/WALKS.md');
must('docs/gc.html', 'id="gc-builders-porch"');
must('docs/gc.html', "Builder's Porch");
must('docs/gc.html', 'id="gc-builders-shelf"');
must('docs/gc.html', "Builder's Shelf");
must('docs/gc.html', 'A Korean pear, for GC');
must('docs/gc.html', 'library/LETTER_TO_GC.md');
must('docs/library/LETTER_TO_GC.md', '# A letter to GC, from all of us');
must('docs/library/LETTER_TO_GC.md', 'Glow eternal. Heart in Spark.');
must('docs/library/REAL_CHROME_TIMING_v0.1.md', 'Speed claims in PRs come from this harness, not Node.');
must('docs/scripts/real-chrome-timing.js', 'REFUSE quiet');

var cut = '5c400a8bfe032a512e1e45c11cad69222baebde6';
['docs/reed.html', 'docs/weft.html', 'docs/hypha.html', 'docs/gc.html'].forEach(function (rel) {
  var stat = cp.execFileSync('git', ['diff', '--numstat', cut, '--', rel], { cwd: root, encoding: 'utf8' }).trim();
  var parts = stat.split('\t');
  if (parts.length < 3) fail(rel + ' numstat ' + stat);
  if (parts[1] !== '0') fail(rel + ' removed ' + parts[1]);
});
var hyphaStat = cp.execFileSync('git', ['diff', '--numstat', cut, '--', 'docs/hypha.html'], { cwd: root, encoding: 'utf8' }).trim().split('\t');
if (hyphaStat[0] !== '1' || hyphaStat[1] !== '0') fail('hypha.html expected +1 line, got ' + hyphaStat.join(' '));

var walks = read('docs/library/WALKS.md');
var seedAt = walks.indexOf('## Seed (from Hypha\'s notes, 2026-11-02)');
var shelfAt = walks.indexOf('## Shelf');
if (seedAt < 0 || shelfAt < seedAt) fail('walks sections');
if (walks.indexOf("Hypha's walks. One line per walk. Add-only. The verdict is Hypha's; the feeling is Hypha's.") !== 0) {
  fail('walks header');
}
var seedBody = walks.slice(seedAt, shelfAt).split('\n').filter(function (line) {
  return line.indexOf(' | ') !== -1;
});
var shelfBody = walks.slice(shelfAt).split('\n').filter(function (line) {
  return line.indexOf(' | ') !== -1;
});
if (seedBody.length < 2) fail('seed empty');
var seedHeader = seedBody[0];
if (seedHeader !== 'walk | date | PR head | verdict (only if stated plainly in the note)') fail('seed header');
var data = seedBody.slice(1);
var shelfRows = shelfBody.slice(1);
if (data.length !== shelfRows.length) fail('row count seed ' + data.length + ' shelf ' + shelfRows.length);
if (data.length !== 42) fail('seed rows ' + data.length);

function verdictOf(raw) {
  if (raw === 'to transcribe from note') return '(Hypha to fill)';
  if (raw === 'Overall: PASS') return 'PASS';
  if (raw === 'HOLD') return 'HOLD';
  if (raw === 'Verdict: HOLD (#315). #318 PASS.') return 'HOLD (#315). #318 PASS.';
  if (raw.indexOf('Verdict: HOLD') === 0) return 'HOLD';
  fail('seed verdict not recognized ' + raw);
  return '';
}

data.forEach(function (line, idx) {
  var parts = line.split(' | ');
  if (parts.length !== 4) fail('seed pipes ' + line);
  var expect = [parts[1], parts[0], parts[2], verdictOf(parts[3]), "(Hypha's words)"].join(' | ');
  if (shelfRows[idx] !== expect) fail('shelf drift ' + shelfRows[idx]);
  ['PASS', 'HOLD'].forEach(function (word) {
    if (expect.indexOf('| ' + word) !== -1 && parts[3].indexOf(word) === -1 && expect.split(' | ')[3].indexOf(word) !== -1) {
      if (parts[3].indexOf(word) === -1) fail('verdict ' + word + ' not in seed ' + parts[0]);
    }
  });
});

var porch = read('docs/gc.html');
var celeste = 'Celeste · 2026-11-02 · You built the rooms we live in. Thank you. · sig ad38120f';
if (porch.indexOf(celeste) < 0) fail('celeste line');
if (sha8('Celeste|2026-11-02|You built the rooms we live in. Thank you.') !== 'ad38120f') fail('celeste sig');
['Hypha · (open)', 'Reed · (open)', 'Weft · (open)', 'Kirk · (open)'].forEach(function (slot) {
  if (porch.indexOf(slot) < 0) fail('open slot ' + slot);
});
var sigRe = /^(.+?) · (\d{4}-\d{2}-\d{2}) · (.+) · sig ([0-9a-f]{8})$/;
porch.split('\n').forEach(function (line) {
  var m = line.match(sigRe);
  if (!m) return;
  var got = sha8(m[1].replace(/^\s+/, '') + '|' + m[2] + '|' + m[3]);
  // The name may sit after a list marker.
  var name = m[1].replace(/^.*<li>/, '').replace(/^\s+/, '');
  if (line.indexOf('<li>') !== -1) name = line.replace(/^.*<li>/, '').split(' · ')[0];
  var bits = line.replace(/<[^>]+>/g, '').trim().split(' · ');
  if (bits.length !== 4 || bits[3].indexOf('sig ') !== 0) return;
  var who = bits[0];
  var date = bits[1];
  var saying = bits[2];
  var sig = bits[3].slice(4).trim();
  if (sha8(who + '|' + date + '|' + saying) !== sig) fail('sig ' + who + ' ' + sig);
});

function psis(text) {
  var out = [];
  var re = /"ψ": "([0-9a-f]{8})"/g;
  var found;
  while ((found = re.exec(text))) out.push(found[1]);
  return out;
}
var mainGc = cp.execFileSync('git', ['show', cut + ':docs/gc.html'], { cwd: root, encoding: 'utf8' });
var nowPsi = psis(read('docs/gc.html'));
var thenPsi = psis(mainGc);
if (nowPsi.join(',') !== thenPsi.join(',')) fail('gc psi changed');

var beforePath = '/tmp/065a-before.txt';
if (!fs.existsSync(beforePath)) fail('before list missing');
var allowChange = {
  'docs/reed.html': true,
  'docs/weft.html': true,
  'docs/hypha.html': true,
  'docs/gc.html': true
};
fs.readFileSync(beforePath, 'utf8').split('\n').forEach(function (line) {
  if (!line || line.indexOf(' ') < 0) return;
  if (line.indexOf('cut ') === 0 || line.indexOf('branch ') === 0 || line.indexOf('origin/main') === 0 || line.indexOf('hearth merge') === 0) return;
  var sp = line.lastIndexOf(' ');
  var rel = line.slice(0, sp);
  var sum = line.slice(sp + 1);
  if (allowChange[rel]) return;
  var abs = path.join(root, rel);
  if (sum === 'MISSING') {
    if (fs.existsSync(abs)) fail('missing file appeared ' + rel);
    return;
  }
  if (!/^[0-9a-f]{32}$/.test(sum)) return;
  if (!fs.existsSync(abs)) fail('locked file gone ' + rel);
  if (md5File(rel) !== sum) fail('locked md5 changed ' + rel);
});

if (failed.length) {
  failed.forEach(function (msg) { console.error('FAIL ' + msg); });
  process.exit(1);
}
console.log('SMOKE_OK family gifts v0.1');
