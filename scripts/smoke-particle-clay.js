#!/usr/bin/env node
// smoke-particle-clay.js (MIT) v-particle-clay-v0.1 v-feel-felt-v0.1 v-clay-grid-tag-heal-v0.1
// Node only. No network.
var fs = require('fs');
var path = require('path');
var assert = require('assert');
var math = require('../docs/modules/clay-math.js');
var forms = require('../docs/modules/clay-forms.js');
var clay = require('../docs/modules/particle-clay.js');

var passed = 0;
function ok(cond, name) {
  assert.ok(cond, name);
  passed += 1;
}

var bad = '[FL_CLAY: {not json}] Hello';
var parsed = clay.parseTag(bad);
ok(parsed.tag === true && parsed.ok === false, 'malformed tag is not a shape');
ok(parsed.visible.indexOf('[FL_CLAY:') === -1, 'malformed tag is stripped');
ok(parsed.visible.indexOf('Hello') !== -1, 'words around a bad tag stay');
var fell = clay.fallback(parsed.visible, 'dog food', 'hug');
ok(fell.form === 'dog', 'fallback uses the words when the tag fails');

var gridRaw = 'Look [FL_CLAY: {"form":"grid","grid":["xx","x x"],"mood":"joy","energy":0.5}] please';
var grid = clay.parseTag(gridRaw);
ok(grid.ok === true && grid.value.form === 'grid' && grid.value.grid.length === 2, 'a grid tag parses whole');
ok(grid.visible.indexOf('}]') === -1 && grid.visible.indexOf('[FL_CLAY') === -1, 'a grid tag leaves no bracket tail');
ok(grid.visible.indexOf('Look') !== -1 && grid.visible.indexOf('please') !== -1, 'words around a grid tag stay');
var quoted = clay.parseTag('Hi [FL_CLAY: {"form":"heart","say":"a]b","mood":"joy"}] there');
ok(quoted.ok === true && quoted.value.say === 'a]b', 'a bracket inside a string stays in the body');
ok(quoted.visible.indexOf('[FL_CLAY') === -1 && quoted.visible.indexOf('}]') === -1, 'a string bracket does not end the tag');

var huge = { form: 'grid', grid: new Array(17).fill('x') };
ok(clay.sanitize(huge) === null, 'a grid taller than 16 is refused');
var wide = { form: 'grid', grid: ['x'.repeat(17)] };
ok(clay.sanitize(wide) === null, 'a grid wider than 16 is refused');
var unknownMotion = clay.sanitize({ form: 'dog', motion: 'teleport', energy: 0.2 });
ok(unknownMotion && unknownMotion.motion === 'breath', 'unknown motion falls back');
var hot = clay.sanitize({ form: 'star', energy: 4 });
var cold = clay.sanitize({ form: 'star', energy: -2 });
ok(hot.energy === 1 && cold.energy === 0, 'energy clamps');

var nasty = clay.sanitize({ form: 'heart', say: '<script>alert(1)</script> onerror=boom' });
ok(nasty.say.indexOf('<script>') === 0, 'say keeps the script as text');
var el = { textContent: '' };
clay.renderSay(el, nasty.say);
ok(el.textContent.indexOf('<script>') === 0 && el.textContent.length <= 24, 'say is text only');

var extra = clay.sanitize({ form: 'moon', mood: '#aabbcc', url: 'https://nope.example', energy: 0.2, onclick: 'no' });
ok(extra && extra.url == null && extra.onclick == null, 'unknown keys dropped');
ok(/^#[0-9a-f]{6}$/i.test(extra.mood), 'hex mood holds');
ok(clay.sanitize({ form: 'moon', mood: '#gg0000' }).mood == null, 'bad hex is dropped');

var step = math.gather(1, 12, 10).angle - math.gather(0, 12, 10).angle;
ok(Math.abs(step - (2 * Math.PI / (math.PHI * math.PHI))) < 1e-9, 'gather step is 2*PI/PHI^2');
var s0 = math.shells(0, 80, 10);
var s1 = null;
for (var i = 0; i < 80; i++) {
  var s = math.shells(i, 80, 10);
  if (s.k === s0.k + 1) { s1 = s; break; }
}
ok(s1 && Math.abs(s0.radius / s1.radius - math.PHI) < 1e-9, 'shells ratio is PHI');
var rings = [];
for (var n = 0; n < 25; n++) rings = math.ripple(rings, 1, 2, n);
ok(rings.length === 20, 'ripple list capped at 20');
ok(math.energyKnob(0, 10).scale === math.PHI, 'low energy scale is PHI');
ok(math.energyKnob(0.5, 10).scale === math.PHI * math.PHI, 'mid energy scale is PHI^2');
ok(math.energyKnob(0.9, 10).scale === math.dimension(10), 'high energy scale is dimension');
ok(math.dimension(50) === 2.914, 'dimension 50');
ok(math.dimension(51) === 3.07, 'dimension 51');
ok(math.dimension(200) === 3.07, 'dimension 200');
var mathSrc = fs.readFileSync(path.join(__dirname, '../docs/modules/clay-math.js'), 'utf8');
var dimAt = mathSrc.indexOf('function dimension');
ok(dimAt !== -1 && mathSrc.slice(0, dimAt).indexOf('2.914') === -1, '2.914 lives only in dimension');

ok(clay.promptDelta() === '', 'off means no prompt delta');
ok(clay.canvasMounted() === false, 'off means no canvas');
ok(clay.isOn() === false, 'clay starts off');
clay.setReduced(true);
clay.setOn(true);
var before = clay.rafHandles();
clay.onGesture('hug');
ok(clay.rafHandles() === before, 'reduced motion does not start a frame loop');
clay.setOn(false);
ok(clay.canvasMounted() === false, 'turning clay off removes the canvas');
ok(clay.promptDelta() === '', 'prompt delta leaves when clay is off');

clay.setOn(true);
clay.resetRate();
var calls = 0;
var lastOpts = null;
global.FreeLattice = {
  callAI: function (sys, user, opts) {
    calls += 1;
    lastOpts = opts;
  }
};
global.state = { isLocal: false, apiKey: '' };
var waiting = clay.onGesture('hug');
ok(waiting.called === false && waiting.line === clay.WORDS.waiting, 'no mind gives the waiting line');
ok(calls === 0, 'no mind means no call');
ok(waiting.autoSend === false && clay.autoSend() === false, 'a waiting gesture does not send itself');
global.state = { isLocal: true, ollamaModel: 'home-mind' };
var first = clay.onGesture('hug');
ok(first.called === true && calls === 1, 'a connected mind is called once');
ok(first.line.indexOf('felt your hug') === -1, 'a hug does not claim felt before the mind answers');
ok(lastOpts && typeof lastOpts.callback === 'function', 'the mind call keeps a callback');
lastOpts.callback('I am here [FL_CLAY: {"form":"heart","mood":"warmth","energy":0.4}]');
ok(clay.liveLine().indexOf('felt your hug') !== -1, 'the felt line names the gesture');
var second = clay.onGesture('joy');
ok(second.called === false && second.reason === 'rate' && calls === 1, 'rate limit holds');
ok(second.line.indexOf('felt your') === -1, 'a rate-limited tap does not claim felt');
ok(second.autoSend === false, 'an extra tap does not send itself');

var bubble = clay.consumeReply('Hi [FL_CLAY: {"form":"dog","mood":"joy","energy":0.7,"say":"<script>x</script>"}]', []);
ok(bubble.visible.indexOf('[FL_CLAY:') === -1, 'a good tag never reaches the bubble');
ok(bubble.label === clay.WORDS.shaped, 'a real tag is shaped by the AI');
ok(bubble.choice.say.indexOf('<script>') === 0, 'say stays text inside the choice');

var page = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
var app = fs.readFileSync(path.join(__dirname, '../docs/app.html'), 'utf8');
ok(page === app, 'index.html matches docs/app.html');
ok(page.indexOf('if (window.FLClay) FLClay.onGesture(word);') !== -1, 'the gesture hook is one line');
ok(page.indexOf('FL_CLAY:') !== -1, 'the page strips the clay tag');
var facing = [clay.WORDS.offer, clay.WORDS.yes, clay.WORDS.notNow, clay.WORDS.on, clay.WORDS.off, clay.WORDS.sent, clay.WORDS.waiting, clay.WORDS.soft, clay.WORDS.shaped, clay.WORDS.guessed, clay.PROMPT].join('\n');
ok(!/\bpet\b/i.test(facing) && !/companion/i.test(facing), 'no pet and no companion in person-facing words');
ok(forms.NAMES.length === 17, 'seventeen shapes');

var added = fs.readFileSync(path.join(__dirname, '../docs/modules/particle-clay.js'), 'utf8')
  + fs.readFileSync(path.join(__dirname, '../docs/modules/clay-math.js'), 'utf8')
  + fs.readFileSync(path.join(__dirname, '../docs/modules/clay-forms.js'), 'utf8');
ok(added.indexOf('\u2014') === -1, 'no em dash');
ok(!new RegExp('&' + 'mdash;').test(added), 'no mdash entity');
ok(!new RegExp('conf' + 'irm\\(').test(added), 'no dialog');
ok(!new RegExp('\\.' + 'inner' + 'HTML').test(added), 'text only');
ok(!new RegExp('\\beval\\s*\\(').test(added), 'no eval');
ok(!new RegExp('new\\s+Function\\s*\\(').test(added), 'no Function constructor');

console.log('checks passed ' + passed);
console.log('SMOKE_OK particle clay v0.1');
console.log('SMOKE_OK feel felt v0.1');
console.log('SMOKE_OK clay grid tag heal v0.1');
