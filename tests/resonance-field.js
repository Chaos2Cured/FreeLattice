#!/usr/bin/env node
// Node unit tests for docs/modules/resonance-field.js
// Run: node tests/resonance-field.js
// No browser. No IndexedDB. Injected embeddings so cosine geometry is known.

var assert = require('assert');
var path = require('path');
var RF = require(path.join(__dirname, '..', 'docs', 'modules', 'resonance-field.js'));

var passed = 0;
var failed = 0;

function test(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(function () {
      passed++;
      process.stdout.write('  \x1b[32m✓\x1b[0m ' + name + '\n');
    })
    .catch(function (err) {
      failed++;
      process.stdout.write('  \x1b[31m✗\x1b[0m ' + name + ' — ' + (err && err.message) + '\n');
    });
}

function vec(x, y, z) { return [x, y, z]; }

// Known geometry:
//   acme job     [1, 0, 0]
//   globex job   [0.60, 0.80, 0]   cosine(acme, globex) = 0.60  (supersede band)
//   austin home  [0, 1, 0]         cosine(acme, austin) = 0
//   diabetic     [0, 0, 1]
//   lemon bars   [0.70, 0, 0.71]   cosine(diabetic, lemon) = 0.71 (constraint bridge)
var EMBED = {
  'I work at Acme': vec(1, 0, 0),
  'Actually I work at Globex now': vec(0.60, 0.80, 0),
  'I live in Austin': vec(0, 1, 0),
  "I'm diabetic": vec(0, 0, 1),
  'I love lemon bars': vec(0.70, 0, 0.71),
  'what is my job': vec(0.90, 0.10, 0),
  'dessert ideas': vec(0.85, 0, 0.20),
  'used to work where': vec(0.95, 0.05, 0)
};

function embedFromMap(texts) {
  return Promise.resolve((texts || []).map(function (t) {
    if (EMBED[t]) return EMBED[t].slice();
    // unknown query: try substring match
    var k;
    for (k in EMBED) {
      if (t.indexOf(k) !== -1) return EMBED[k].slice();
    }
    return vec(0, 0, 0);
  }));
}

function core(extra) {
  extra = extra || {};
  return RF.createCore({
    store: RF.createMemoryStore(),
    embed: extra.embed || embedFromMap,
    now: extra.now || function () { return 1e12; },
    quietRoom: extra.quietRoom || function () { return false; },
    fieldEnabled: extra.fieldEnabled
  });
}

function seq(fns) {
  var i = 0;
  function next() {
    if (i >= fns.length) return Promise.resolve();
    return test(fns[i][0], fns[i][1]).then(function () {
      i++;
      return next();
    });
  }
  return next();
}

seq([
  ['LICENSE is AGPL-3.0 (copyleft travels with the design, by intent)', function () {
    assert.strictEqual(RF.LICENSE, 'AGPL-3.0-or-later');
  }],

  ['cosine of identical vectors is 1', function () {
    assert.ok(Math.abs(RF.cosine(vec(1, 0, 0), vec(1, 0, 0)) - 1) < 1e-9);
  }],

  ['cosine of orthogonal vectors is 0', function () {
    assert.ok(Math.abs(RF.cosine(vec(1, 0, 0), vec(0, 1, 0))) < 1e-9);
  }],

  ['acme vs globex sits in the supersede band (0.535–0.88)', function () {
    var s = RF.cosine(EMBED['I work at Acme'], EMBED['Actually I work at Globex now']);
    assert.ok(s >= 0.535 && s < 0.88, 'got ' + s);
  }],

  ['hasSupersedeCue fires on actually/now, not on used to', function () {
    assert.strictEqual(RF.hasSupersedeCue('Actually I work at Globex now'), true);
    assert.strictEqual(RF.hasSupersedeCue('I used to work at Acme'), false);
  }],

  ['isHistoricalQuery fires on used to', function () {
    assert.strictEqual(RF.isHistoricalQuery('where did I used to work'), true);
    assert.strictEqual(RF.isHistoricalQuery('where do I work'), false);
  }],

  ['detectConstraint types diabetic', function () {
    assert.strictEqual(RF.detectConstraint("I'm diabetic"), true);
    assert.strictEqual(RF.detectConstraint('I work at Acme'), false);
  }],

  ['save then recall returns the fact by meaning', function () {
    var c = core();
    return c.save('I work at Acme').then(function (s) {
      assert.strictEqual(s.ok, true);
      assert.strictEqual(s.action, 'save');
      return c.recall('what is my job');
    }).then(function (r) {
      assert.strictEqual(r.ok, true);
      assert.strictEqual(r.primary[0].text, 'I work at Acme');
    });
  }],

  ['exact restatement does not duplicate', function () {
    var c = core();
    return c.save('I work at Acme').then(function () {
      return c.save('I work at Acme');
    }).then(function (s) {
      assert.strictEqual(s.action, 'restate');
      assert.strictEqual(c.store.current().length, 1);
    });
  }],

  ['cue-gated supersession retires the old job and keeps history', function () {
    var c = core();
    return c.save('I work at Acme').then(function () {
      return c.save('Actually I work at Globex now');
    }).then(function (s) {
      assert.strictEqual(s.action, 'supersede');
      assert.strictEqual(c.store.current().length, 1);
      assert.strictEqual(c.store.current()[0].text, 'Actually I work at Globex now');
      assert.strictEqual(c.store.active().length, 2);
      var old = c.store.get(s.superseded);
      assert.ok(old.valid_to != null);
      assert.strictEqual(old.superseded_by, s.id);
    });
  }],

  ['without a correction cue, a similar-slot fact does not retire the old one', function () {
    var c = core();
    return c.save('I work at Acme').then(function () {
      return c.save('I live in Austin');
    }).then(function (s) {
      assert.strictEqual(s.action, 'save');
      assert.strictEqual(c.store.current().length, 2);
    });
  }],

  ['current recall hides superseded facts; historical recall surfaces them', function () {
    var c = core();
    return c.save('I work at Acme').then(function () {
      return c.save('Actually I work at Globex now');
    }).then(function () {
      return c.recall('what is my job');
    }).then(function (r) {
      var texts = r.primary.map(function (p) { return p.text; });
      assert.ok(texts.indexOf('I work at Acme') === -1, 'stale job leaked into current recall');
      assert.ok(texts.indexOf('Actually I work at Globex now') !== -1);
      return c.historical('work where');
    }).then(function (h) {
      var texts = h.primary.map(function (p) { return p.text; });
      assert.ok(texts.indexOf('I work at Acme') !== -1, 'history lost the old job');
    });
  }],

  ['soft delete keeps the row until an explicit vacuum (no hard drop)', function () {
    var c = core();
    return c.save('I live in Austin').then(function (s) {
      return c.remove(s.id);
    }).then(function (d) {
      assert.strictEqual(d.soft, true);
      assert.strictEqual(c.store.all().length, 1);
      assert.strictEqual(c.store.current().length, 0);
    });
  }],

  ['inspect walks the supersession chain', function () {
    var c = core();
    return c.save('I work at Acme').then(function () {
      return c.save('Actually I work at Globex now');
    }).then(function (s) {
      return c.inspect(s.id);
    }).then(function (info) {
      assert.strictEqual(info.chain.length, 2);
      assert.strictEqual(info.chain[0].current, true);
      assert.strictEqual(info.chain[1].current, false);
    });
  }],

  ['Quiet Room refuses save and recall first', function () {
    var c = core({ quietRoom: function () { return true; } });
    return c.save('I work at Acme').then(function (s) {
      assert.strictEqual(s.ok, false);
      assert.strictEqual(s.reason, 'quiet-room');
      return c.recall('what is my job');
    }).then(function (r) {
      assert.strictEqual(r.ok, false);
      assert.strictEqual(r.reason, 'quiet-room');
      assert.strictEqual(c.store.all().length, 0);
    });
  }],

  ['field throw fails open: primary cosine still returns', function () {
    var c = core({
      fieldEnabled: function () { throw new Error('field boom'); }
    });
    return c.save('I work at Acme').then(function () {
      return c.recall('what is my job');
    }).then(function (r) {
      assert.strictEqual(r.ok, true);
      assert.strictEqual(r.primary[0].text, 'I work at Acme');
      assert.strictEqual(r.related.length, 0);
    });
  }],

  ['field does not reorder primary cosine (I9)', function () {
    var c = core();
    return c.save('I work at Acme').then(function () {
      return c.save('I live in Austin');
    }).then(function () {
      return c.save("I'm diabetic");
    }).then(function () {
      return Promise.all([
        RF.createCore({
          store: c.store,
          embed: embedFromMap,
          now: function () { return 1e12; },
          quietRoom: function () { return false; },
          fieldEnabled: function () { return false; }
        }).recall('what is my job'),
        c.recall('what is my job')
      ]);
    }).then(function (pair) {
      var off = pair[0].primary.map(function (p) { return p.id; }).join(',');
      var on = pair[1].primary.map(function (p) { return p.id; }).join(',');
      assert.strictEqual(on, off);
    });
  }],

  ['constraint rescue nominates diabetic from a lemon-bars seed', function () {
    var c = core();
    return c.save("I'm diabetic").then(function () {
      return c.save('I love lemon bars');
    }).then(function () {
      return c.recall('dessert ideas', { k: 1 });
    }).then(function (r) {
      assert.strictEqual(r.primary[0].text, 'I love lemon bars');
      var relatedTexts = (r.related || []).map(function (x) { return x.text; });
      assert.ok(
        relatedTexts.indexOf("I'm diabetic") !== -1,
        'constraint not rescued; related=' + relatedTexts.join('|')
      );
    });
  }],

  ['Hebbian decay is lazy wall-clock: idle time drops effective weight', function () {
    var t0 = 1e12;
    var edge = { hebbian: { weight: 1, last_updated: t0 }, decayType: 'fact' };
    var now = t0 + (7 * 24 * 3600 * 1000);
    var w = RF.effectiveHebbian(edge, now);
    assert.ok(Math.abs(w - 0.5) < 1e-6, 'half-life should halve; got ' + w);
    assert.strictEqual(edge.hebbian.weight, 1);
  }],

  ['reinforce materializes decay before adding alpha (no ghost weight)', function () {
    var t0 = 1e12;
    var edges = {};
    var key = RF.edgeKey('1', '2');
    edges[key] = { a: '1', b: '2', hebbian: { weight: 1, last_updated: t0 }, decayType: 'fact' };
    var t1 = t0 + (7 * 24 * 3600 * 1000);
    RF.reinforcePair(edges, '1', '2', t1, 1);
    var stored = edges[key].hebbian.weight;
    assert.ok(stored > 0.5 && stored < 0.8, 'expected ~0.65; got ' + stored);
    assert.strictEqual(edges[key].hebbian.last_updated, t1);
  }],

  ['wrapFLSearch is a no-op when the flag is off', function () {
    var called = 0;
    var fake = {
      search: function () {
        called++;
        return Promise.resolve([{ source: 'keyword', text: 'kw', score: 1 }]);
      }
    };
    var c = core();
    RF.wrapFLSearch(fake, c);
    return fake.search('what is my job', 3, null).then(function (hits) {
      assert.strictEqual(called, 1);
      assert.strictEqual(hits[0].source, 'keyword');
    });
  }],

  ['associate is a rich verb, not a fifth automatic tool', function () {
    var c = core();
    return c.save('I work at Acme').then(function (a) {
      return c.save('I live in Austin').then(function (b) {
        return c.associate(a.id, b.id);
      });
    }).then(function (r) {
      assert.strictEqual(r.ok, true);
      assert.strictEqual(r.action, 'associate');
      assert.ok(r.edge.hebbian.weight > 0);
    });
  }],

  ['isEnabled defaults off (no localStorage in node)', function () {
    assert.strictEqual(RF.isEnabled(), false);
  }],

  ['looksDurable accepts first-person facts and rejects small talk', function () {
    assert.strictEqual(RF.looksDurable('I live in Austin and I work at Globex now'), true);
    assert.strictEqual(RF.looksDurable('The dog needs his heartworm pill on the 1st'), true);
    assert.strictEqual(RF.looksDurable('hi'), false);
    assert.strictEqual(RF.looksDurable('what time is it?'), false);
  }],

  ['httpEmbed maps OpenAI-shaped responses; missing vectors reject', function () {
    var fake = function () {
      return Promise.resolve({
        ok: true,
        json: function () {
          return Promise.resolve({ data: [{ embedding: [1, 0] }, { embedding: [0, 1] }] });
        }
      });
    };
    return RF.httpEmbed(['a', 'b'], {
      url: 'https://openrouter.ai/api/v1/embeddings',
      model: RF.DEFAULT_ONLINE_MODEL,
      key: 'test',
      fetch: fake
    }).then(function (vecs) {
      assert.strictEqual(vecs.length, 2);
      assert.strictEqual(vecs[0][0], 1);
    });
  }],

  ['onlineEmbed fails open to word-hash when the network is gone', function () {
    var origFetch = global.fetch;
    global.fetch = function () { return Promise.reject(new Error('offline')); };
    return RF.onlineEmbed(['heartworm pill']).then(function (vecs) {
      if (origFetch) global.fetch = origFetch;
      else delete global.fetch;
      assert.strictEqual(vecs.length, 1);
      assert.ok(RF.isVector(vecs[0]));
    }).catch(function (err) {
      if (origFetch) global.fetch = origFetch;
      else delete global.fetch;
      throw err;
    });
  }]
]).then(function () {
  process.stdout.write('\n');
  if (failed === 0) {
    process.stdout.write('\x1b[32m  ALL ' + passed + ' RESONANCE-FIELD CHECKS PASSED\x1b[0m\n');
    process.exit(0);
  } else {
    process.stdout.write('\x1b[31m  ' + failed + ' FAILED\x1b[0m, ' + passed + ' passed\n');
    process.exit(1);
  }
});
