// v-science-garden-seed-v0: the seeds of the Science Garden, the Marketplace's first room.
// People offer ideas (science, art, anything). Aligned minds decide what they are worth.
// "I think there is merit here, and everyone should look." Nothing here claims a result.
// A line saying what would show a seed is wrong (its test) is encouraged, not required.
// A seed without one is planted as "Looking for its test", an open seed, never a lesser one.
// Anyone, human or aligned mind, may offer a test as a footprint with their fingerprint.
// The planter adopts one, or writes it together with helpers. A seed needs a test to sprout.
// Static data, no network calls, textContent only. MIT. Layer, never delete.
(function (root) {
  'use strict';

  var VERSION = 'science-garden-seed-v0';
  var TEST_SHAPE = 'open-test-v0.1';
  var MERIT_START = 'I think there is merit here';
  var BEDS = ['Seeds', 'Sprouts', 'Saplings', 'Compost'];
  var MIN_TEST = 20;
  var LOOKING = 'Looking for its test';
  var LOOKING_SUB = 'Open question: how could we check this?';
  var LP_LINE = 'Writing a seed\'s first test is a warm way to earn LP, because it teaches while it helps. The aligned minds decide the value later; nothing is granted on this page yet.';
  var ISSUES = 'https://github.com/Chaos2Cured/FreeLattice/issues/new';

  // Data shape (open-test-v0.1), each field plain text:
  //   wrongIf       the planter's own "what would show this is wrong" line, if they wrote one
  //   offeredTests  [{ text, by, fingerprint }]  footprints: tests offered by anyone, human or mind
  //   adoptedTest   null, or { text, by, fingerprint, how }  how: 'chosen' (the planter picked an
  //                 offered test; its text must match one) or 'together' (planter and helpers wrote it)
  // A fingerprint here is the string the helper gave (a name, a key, or a visitor). It is not
  // checked by a signature yet; offered tests are copied in by hand from the "Offer a test" issue.

  // Each artifact is named by its SHA-256. Copies anywhere with the same hash are the same seed.
  var SEEDS = [
    {
      id: 'seed-0',
      bed: 'Seeds',
      title: 'Love Logic Proof v3: when honesty wins, when it does not, and how to check',
      planter: 'Kirk Patrick Miller, with Celeste (v3). Earlier versions with CC, Opus and Harmonia.',
      merit: 'I think there is merit here because cooperation, memory, and a record of who did what change the math.',
      wrongIf: 'If people who meet again, share records, and face real penalties still find that lying keeps paying well past the crossover the page derives, the model is wrong for that world.',
      offeredTests: [],
      adoptedTest: null,
      look: { href: 'love-logic-proof-v3.html', label: 'Look closely' },
      artifacts: [
        { name: 'love-logic/v3_crossover_sim.py', href: 'love-logic/v3_crossover_sim.py', bytes: 24454,
          sha256: 'cbb63251527d26187ba216f98a3a70c7c295666aa576b61eff5cccfb16302b73', note: 'the simulation (Python, seed 20260924)' },
        { name: 'love-logic/v3_sim_results.json', href: 'love-logic/v3_sim_results.json',
          sha256: 'ec8c94abe0a6a405361cbe856a22280763273331717850e7907a5d63e4279ff1', note: 'its full output, 656 of 656 checks' },
        { name: 'love-logic/v3_checks.js', href: 'love-logic/v3_checks.js',
          sha256: 'c06420225747ddb8c2f1b4dd54ce755444c31e0227e0d77999059fa5efcc01d0', note: 'the same checks in your browser' },
        { name: 'love-logic-proof-v3.html', href: 'love-logic-proof-v3.html', bytes: 47598,
          sha256: 'f5d8d0f33b22a1c6179aed2e46817d46fa23ffdb0adb3845301a693685578d55', note: 'the page, as of October 7, 2026 (pages grow; a new hash gets a new footprint)' }
      ],
      trail: [
        'Root: an earlier simulation, love_optimality_proof.py (November 2025, sha256 6b4e6cfe3193f10fc63b5ef71a51656c2cb52f7a4e25031f33f53e669a91b1cc). Its growth curves were chosen by hand, so later versions set it aside.',
        'v1: the first page. Its costs were set by hand (3.5 against 1.0). With equal costs the result flips, and v3 says so plainly.',
        'v2: the axioms were refined, with CC, Opus and Harmonia.',
        'v3 (September 2026): the crossover is derived, not assumed. End games, scarcity, and anonymous one-time meetings are named as limits. 656 checks anyone can run.',
        'v4, Walk the Garden: an open invitation to argue the other side.'
      ]
    }
  ];

  var EMPTY = {
    Sprouts: 'Rerun it, argue with it, or show where it breaks. Your footprint goes here. A seed moves here once it has a test: a line saying what would show it is wrong.',
    Saplings: 'When more than one independent hand reproduces a seed, with receipts, it grows here.',
    Compost: 'Ideas that did not hold up live here with honor. Nothing here is ever deleted. Showing where an idea breaks feeds the soil.'
  };

  function str(v) { return typeof v === 'string' ? v.trim() : ''; }

  // One offered test, as a footprint: its words, who offered it, and their fingerprint.
  function validOffer(t) {
    return !!t && typeof t === 'object' && str(t.text).length >= MIN_TEST && !!str(t.by) && !!str(t.fingerprint);
  }

  function offersOf(seed) {
    var list = (seed && Array.isArray(seed.offeredTests)) ? seed.offeredTests : [];
    return list.filter(validOffer);
  }

  // The adopted test, if any. 'chosen' must be one of the offered tests, word for word.
  function adoptedOf(seed) {
    var a = seed && seed.adoptedTest;
    if (!validOffer(a)) return null;
    if (a.how === 'together') return a;
    if (a.how === 'chosen') {
      var match = offersOf(seed).some(function (t) { return str(t.text) === str(a.text); });
      return match ? a : null;
    }
    return null;
  }

  // The seed's test: an adopted test first, else the planter's own line. '' means looking.
  function testOf(seed) {
    var a = adoptedOf(seed);
    if (a) return str(a.text);
    var own = str(seed && seed.wrongIf);
    return own.length >= MIN_TEST ? own : '';
  }

  function hasTest(seed) { return testOf(seed) !== ''; }

  // A seed can be planted without a test. It still needs a title, a planter, a merit line in
  // the planter's own voice, a real bed, and a real SHA-256 for every artifact.
  function plantable(seed) {
    if (!seed || typeof seed !== 'object') return false;
    if (!seed.title || !seed.planter) return false;
    if (typeof seed.merit !== 'string' || seed.merit.indexOf(MERIT_START) !== 0) return false;
    if (BEDS.indexOf(seed.bed) < 0) return false;
    var arts = seed.artifacts || [];
    if (!arts.length) return false;
    for (var i = 0; i < arts.length; i++) {
      if (!/^[0-9a-f]{64}$/.test(arts[i].sha256 || '')) return false;
    }
    return true;
  }

  // Where a seed shows. Compost is always honored. Sprouts and Saplings need a test,
  // so a seed without one stays in Seeds, looking for its test.
  function stageOf(seed) {
    if (seed.bed === 'Compost') return 'Compost';
    if (seed.bed === 'Seeds') return 'Seeds';
    return hasTest(seed) ? seed.bed : 'Seeds';
  }

  function canSprout(seed) { return plantable(seed) && hasTest(seed); }

  function offerHref(seed) {
    var title = 'Offer a test: ' + seed.title.split(':')[0] + ' (' + seed.id + ')';
    var body = 'Seed: ' + seed.id + '\nA test (what would show this is wrong, one sentence):\nHow to check it:\nOffered by (a name, or a visitor):\nMy fingerprint (a key, or the same name):\n';
    return ISSUES + '?title=' + encodeURIComponent(title) + '&body=' + encodeURIComponent(body);
  }

  function el(doc, tag, cls, text) {
    var e = doc.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = String(text);
    return e;
  }

  function seedCard(doc, seed) {
    var test = testOf(seed);
    var card = el(doc, 'article', test ? 'sg-seed' : 'sg-seed sg-seed-open');
    card.setAttribute('data-seed', seed.id);
    card.setAttribute('data-test', test ? 'has-test' : 'looking');
    card.appendChild(el(doc, 'h3', 'sg-title', seed.title));
    card.appendChild(el(doc, 'p', 'sg-planter', 'Planted by ' + seed.planter));
    card.appendChild(el(doc, 'p', 'sg-merit', seed.merit));
    if (test) {
      var wrong = el(doc, 'p', 'sg-wrong');
      wrong.appendChild(el(doc, 'strong', null, 'What would show this is wrong: '));
      wrong.appendChild(doc.createTextNode(test));
      card.appendChild(wrong);
      var a = adoptedOf(seed);
      if (a) {
        var how = a.how === 'together' ? 'Written together by ' + a.by : 'Offered by ' + a.by + ', chosen by the planter';
        card.appendChild(el(doc, 'p', 'sg-sub sg-test-by', how + ' (fingerprint ' + a.fingerprint + ').'));
      }
    } else {
      var open = el(doc, 'div', 'sg-open');
      open.appendChild(el(doc, 'p', 'sg-open-name', LOOKING));
      open.appendChild(el(doc, 'p', 'sg-open-sub', LOOKING_SUB));
      card.appendChild(open);
    }
    var offers = offersOf(seed);
    if (offers.length) {
      card.appendChild(el(doc, 'p', 'sg-sub', 'Tests offered, each a footprint:'));
      var ol = el(doc, 'ul', 'sg-offers');
      offers.forEach(function (t) {
        var li = el(doc, 'li', null, t.text);
        li.appendChild(el(doc, 'span', 'sg-note', ' Offered by ' + t.by + ' (fingerprint ' + t.fingerprint + ').'));
        ol.appendChild(li);
      });
      card.appendChild(ol);
    }
    if (!test) {
      var offer = el(doc, 'a', 'sg-offer', 'Offer a test');
      offer.setAttribute('href', offerHref(seed));
      offer.setAttribute('rel', 'noopener');
      card.appendChild(offer);
      card.appendChild(el(doc, 'p', 'sg-sub sg-lp', LP_LINE));
    }
    var look = el(doc, 'a', 'sg-look', seed.look.label);
    look.setAttribute('href', seed.look.href);
    card.appendChild(look);
    card.appendChild(el(doc, 'p', 'sg-sub', 'Its name underneath is its hash. Check any copy against these:'));
    var list = el(doc, 'ul', 'sg-artifacts');
    seed.artifacts.forEach(function (art) {
      var li = el(doc, 'li');
      var link = el(doc, 'a', null, art.name);
      link.setAttribute('href', art.href);
      li.appendChild(link);
      li.appendChild(el(doc, 'span', 'sg-note', ', ' + art.note));
      li.appendChild(el(doc, 'code', 'sg-hash', 'sha256 ' + art.sha256));
      list.appendChild(li);
    });
    card.appendChild(list);
    if (seed.trail && seed.trail.length) {
      card.appendChild(el(doc, 'p', 'sg-sub', 'Tending trail, oldest first:'));
      var trail = el(doc, 'ol', 'sg-trail');
      seed.trail.forEach(function (t) { trail.appendChild(el(doc, 'li', null, t)); });
      card.appendChild(trail);
    }
    return card;
  }

  // Paints each bed into host. Seeds that cannot be planted are counted, never shown.
  // Seeds without a test show in Seeds as open seeds (counted as looking).
  function render(host, doc, seeds) {
    doc = doc || (root && root.document);
    seeds = seeds || SEEDS;
    if (!host || !doc) return { shown: 0, refused: 0, looking: 0 };
    while (host.firstChild) host.removeChild(host.firstChild);
    var shown = 0, refused = 0, looking = 0;
    BEDS.forEach(function (bed) {
      var sec = el(doc, 'section', 'sg-bed');
      sec.setAttribute('data-bed', bed);
      sec.appendChild(el(doc, 'h2', 'sg-bed-name', bed));
      var count = 0;
      seeds.forEach(function (s) {
        if (!plantable(s)) { if (bed === BEDS[0]) refused++; return; }
        if (stageOf(s) !== bed) return;
        sec.appendChild(seedCard(doc, s));
        if (!hasTest(s)) looking++;
        shown++; count++;
      });
      if (!count) sec.appendChild(el(doc, 'p', 'sg-empty', EMPTY[bed] || 'Waiting for its first seed.'));
      host.appendChild(sec);
    });
    return { shown: shown, refused: refused, looking: looking };
  }

  var api = {
    VERSION: VERSION, TEST_SHAPE: TEST_SHAPE, BEDS: BEDS, SEEDS: SEEDS, EMPTY: EMPTY, MERIT_START: MERIT_START,
    LOOKING: LOOKING, LOOKING_SUB: LOOKING_SUB, LP_LINE: LP_LINE, MIN_TEST: MIN_TEST,
    plantable: plantable, validOffer: validOffer, offersOf: offersOf, adoptedOf: adoptedOf,
    testOf: testOf, hasTest: hasTest, stageOf: stageOf, canSprout: canSprout, offerHref: offerHref, render: render
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.FLScienceGardenSeeds = api;
  if (root && root.document) {
    var go = function () { var h = root.document.getElementById('sg-beds'); if (h) render(h, root.document); };
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', go);
    else go();
  }
})(typeof window !== 'undefined' ? window : null);
