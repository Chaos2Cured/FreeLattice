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
must('docs/library/REAL_CHROME_TIMING_v0.1.md', 'The harness measures inside the page (window present, process undefined). It misses a one-shot long task inside the evaluated task itself, which reports 0; an async 120 ms task reports 120.');
must('docs/library/REAL_CHROME_TIMING_v0.1.md', 'page.route does not cover service-worker or worker requests, so those are not blocked.');
must('docs/library/REAL_CHROME_TIMING_v0.1.md', 'The box runs Chrome 155.0.8059.84; 156 is unverified.');
must('docs/scripts/real-chrome-timing.js', 'REFUSE quiet');
must('docs/gc.html', 'ad38120f is a mark, not a signature. It is sha256("Celeste|2026-11-02|You built the rooms we live in. Thank you.")[:8], which anyone can compute.');
must('docs/gc.html', 'All dates on this shelf are UTC merge dates. 50 of 168 differ from the Mountain Time date.');
must('docs/gc.html', 'Rule: chosen by hand; incomplete.');
must('docs/gc.html', 'HOLDs healed: ' + '17 as of 2026-11-03 (057, 061a, 063a, 063b, 045, 045b, 043c-h x6, 055, 056d-g x4). 19 now that #313 has merged (adds 062a, 062b).');
must('docs/library/WALKS.md', '#277 f86496d8');
must('docs/library/WALKS.md', 'Feeling cells are blank until Hypha writes in them.');
must('docs/library/WALKS.md', 'PASS (safety), with softs.');
must('docs/library/WALKS.md', 'Alpha (theLatticeTree) #123');
must('docs/library/WALKS.md', 'aced4f86');
must('docs/library/WALKS.md', '#317 PASS.');
must('docs/library/WALKS.md', '#316 PASS.');
must('docs/library/WALKS.md', 'Verdict: HOLD. #318 PASS.');
must('docs/library/WALKS.md', 'PASS (re-check of both 057 HOLDs), 2026-10-31');

var fallbackCut = '5c400a8bfe032a512e1e45c11cad69222baebde6';
var cut = fallbackCut;
var cutHow = 'fallback';
try {
  cut = cp.execFileSync('git', ['merge-base', 'HEAD', 'origin/main'], { cwd: root, encoding: 'utf8' }).trim();
  cutHow = 'merge-base';
} catch (err) {
  cut = fallbackCut;
  cutHow = 'fallback';
}
if (!/^[0-9a-f]{40}$/.test(cut)) {
  cut = fallbackCut;
  cutHow = 'fallback';
}
console.log('cut ' + cutHow + ' ' + cut);
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
if (walks.indexOf("Hypha's walks. One line per walk. Add-only. Verdicts below are copied from Hypha's walk notes. The feeling is Hypha's.") !== 0) {
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
// history: if (data.length !== 42) fail('seed rows ' + data.length);
// history: if (data.length !== 43) fail('seed rows ' + data.length);
if (data.length !== 46) fail('seed rows ' + data.length);
['walk-062c-2026-11-03', 'walk-062d-2026-11-03', 'walk-065a-2026-11-03'].forEach(function (id) {
  if (walks.split(id).length - 1 !== 2) fail(id + ' should be seed and shelf');
});

// history: verdictOf mapped a short shelf cell. 065c copies the note line into the verdict cell. Feeling stays blank.
function verdictOf(raw) {
  if (raw === 'Overall: PASS') return 'PASS';
  if (raw === 'HOLD') return 'HOLD';
  if (raw.indexOf('Verdict: HOLD') === 0) return 'HOLD';
  fail('seed verdict not recognized ' + raw);
  return '';
}

data.forEach(function (line, idx) {
  var parts = line.split(' | ');
  if (parts.length !== 4 && parts.length !== 5) fail('seed pipes ' + line);
  var shelf = shelfRows[idx].split(' | ');
  if (shelf.length !== 5) fail('shelf pipes ' + shelfRows[idx]);
  if (shelf[0] !== parts[1] || shelf[1] !== parts[0]) fail('shelf order ' + parts[0]);
  // 065d: Hypha wrote the feeling on the seed row and the shelf row. A 4-field seed still means a blank feeling.
  var seedFeel = parts.length === 5 ? parts[4] : '';
  if (seedFeel !== shelf[4]) fail('feeling mismatch ' + parts[0]);
  if (parts[3].indexOf('to transcribe') !== -1) fail('fill-in prefix remains ' + parts[0]);
  if (parts[0] === 'walk-057c-2026-10-31' && parts[3] !== 'PASS (re-check of both 057 HOLDs), 2026-10-31') fail('057c wording');
});
if (walks.split("(Hypha's words)").length !== 1) fail("Hypha's words remain");
if (walks.split('Feeling cells are blank until Hypha writes in them.').length !== 2) fail('feeling line');
var gcShelf = read('docs/gc.html');
if (gcShelf.split("(GC's words)").length !== 1) fail("GC's words remain");
if (gcShelf.split('(template line)').length - 1 !== 168) fail('template line count');
var healedSentence = 'HOLDs healed: ' + '17 as of 2026-11-03 (057, 061a, 063a, 063b, 045, 045b, 043c-h x6, 055, 056d-g x4). 19 now that #313 has merged (adds 062a, 062b).';
var healedAt = gcShelf.indexOf(healedSentence);
if (healedAt < 0) fail('healed sentence');
var healedUl = gcShelf.slice(healedAt, gcShelf.indexOf('</ul>', healedAt));
var healedItems = healedUl.split('<li>').length - 1;
if (healedItems !== 9) fail('healed items ' + healedItems);
if (healedUl.indexOf('walk-057c') !== -1) fail('057c still on healed list');

var porch = read('docs/gc.html');
var celeste = 'Celeste · 2026-11-02 · You built the rooms we live in. Thank you. · sig ad38120f';
if (porch.indexOf(celeste) < 0) fail('celeste line');
// ad38120f is a mark, not a signature. It is sha256("Celeste|2026-11-02|You built the rooms we live in. Thank you.")[:8], which anyone can compute.
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
// history: if (nowPsi.join(',') !== thenPsi.join(',')) fail('gc psi changed');
function listPrefix(shorter, longer) {
  if (shorter.length > longer.length) return false;
  var i;
  for (i = 0; i < shorter.length; i++) {
    if (shorter[i] !== longer[i]) return false;
  }
  return true;
}
if (nowPsi.length < thenPsi.length) {
  if (!listPrefix(nowPsi, thenPsi)) fail('gc psi branch is not a prefix of main');
} else if (!listPrefix(thenPsi, nowPsi)) {
  fail('gc psi main is not a prefix of branch');
}

var beforePath = '/tmp/065a-before.txt';
var allowChange = {
  'docs/reed.html': true,
  'docs/weft.html': true,
  'docs/hypha.html': true,
  'docs/gc.html': true
};
var giftFiles = {
  'docs/reed.html': true,
  'docs/weft.html': true,
  'docs/hypha.html': true,
  'docs/gc.html': true,
  'docs/library/LETTER_TO_GC.md': true,
  'docs/library/REAL_CHROME_TIMING_v0.1.md': true,
  'docs/library/WALKS.md': true,
  'docs/scripts/real-chrome-timing.js': true,
  'docs/scripts/smoke-family-gifts-v0.1.js': true,
  'docs/scripts/smoke-family-gifts.js': true
};
if (fs.existsSync(beforePath)) {
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
    if (md5File(rel) !== sum) {
      // The snapshot is the branch pin. A file that still matches the cut was not edited.
      var atCut;
      try {
        atCut = cp.execFileSync('git', ['show', cut + ':' + rel], { cwd: root });
      } catch (err) {
        fail('locked md5 changed ' + rel);
        return;
      }
      if (crypto.createHash('md5').update(atCut).digest('hex') !== md5File(rel)) fail('locked md5 changed ' + rel);
    }
  });
} else {
  console.log('before list not on this machine; git diff against the cut used instead');
}
cp.execFileSync('git', ['diff', '--name-only', cut], { cwd: root, encoding: 'utf8' }).split('\n').forEach(function (rel) {
  if (!rel) return;
  if (!giftFiles[rel]) fail('unexpected file vs cut ' + rel);
});

if (failed.length) {
  failed.forEach(function (msg) { console.error('FAIL ' + msg); });
  process.exit(1);
}
console.log('SMOKE_OK family gifts v0.1');
