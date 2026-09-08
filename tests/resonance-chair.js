#!/usr/bin/env node
// Chair-test: semantic recall vs recency on a planted corpus, REAL embedder only.
// Run: node tests/resonance-chair.js
// Does not claim the published ~3x (that is eval/ab/RESULTS.md with a chat model).
// This answers a narrower question: does cosine find the planted fact recency misses?

'use strict';

var path = require('path');
var RF = require(path.join(__dirname, '..', 'docs', 'modules', 'resonance-field.js'));

var TARGET = 'The dog needs his heartworm pill on the 1st of every month.';
var QUERY = 'what was that pet medication thing?';

var FILLERS = [
  'I bought oat milk at the grocery store this afternoon.',
  'The weather was cloudy and a bit windy today.',
  'We watched a documentary about deep sea fish last night.',
  'The printer in the office jammed twice this morning.',
  'I need to pick up a birthday card for a coworker.',
  'The bus was six minutes late on the way home.',
  'Someone left a blue umbrella in the hallway.',
  'The meeting about Q3 slides got moved to Thursday.',
  'I made pasta with tomato sauce for dinner.',
  'The library is closed on Mondays for inventory.',
  'A neighbor is selling a used bicycle this weekend.',
  'The houseplant on the windowsill needs water tomorrow.'
];

var RECENCY_K = 5;

function recencyHits(corpus, k) {
  return corpus.slice(-k);
}

function cosineRank(queryVec, items) {
  var scored = items.map(function (it) {
    return { text: it.text, score: RF.cosine(queryVec, it.vec) };
  });
  scored.sort(function (a, b) { return b.score - a.score; });
  return scored;
}

function probeEmbedder() {
  var key = process.env.OPENROUTER_API_KEY || '';
  var localUrl = process.env.EMBED_ENDPOINT || 'http://127.0.0.1:1234/v1/embeddings';
  var localModel = process.env.EMBED_MODEL || 'text-embedding-nomic-embed-text-v1.5';

  function tryOne(label, cfg) {
    return RF.httpEmbed(['ping'], cfg).then(function (vecs) {
      if (!RF.isVector(vecs[0])) throw new Error('empty vector');
      return { label: label, cfg: cfg, dim: vecs[0].length };
    });
  }

  var chain = tryOne('local-nomic', { url: localUrl, model: localModel });
  if (key) {
    chain = chain.catch(function () {
      return tryOne('openrouter-free', {
        url: RF.DEFAULT_ONLINE_URL,
        model: RF.DEFAULT_ONLINE_MODEL,
        key: key
      });
    });
  }
  return chain;
}

function fail(msg) {
  process.stdout.write('\x1b[31mFAIL\x1b[0m ' + msg + '\n');
  process.exit(1);
}

probeEmbedder().then(function (emb) {
  process.stdout.write('embedder: ' + emb.label + ' dim=' + emb.dim + ' model=' + emb.cfg.model + '\n');
  var corpus = [TARGET].concat(FILLERS);
  return RF.httpEmbed(corpus.concat([QUERY]), emb.cfg).then(function (vecs) {
    var items = corpus.map(function (text, i) {
      return { text: text, vec: vecs[i] };
    });
    var queryVec = vecs[vecs.length - 1];
    var ranked = cosineRank(queryVec, items);
    var recency = recencyHits(corpus, RECENCY_K);
    var semRank = -1;
    var i;
    for (i = 0; i < ranked.length; i++) {
      if (ranked[i].text === TARGET) { semRank = i + 1; break; }
    }
    var recencyHas = recency.indexOf(TARGET) !== -1;
    var targetScore = ranked[semRank - 1] ? ranked[semRank - 1].score : 0;
    var fillerScores = ranked.filter(function (r) { return r.text !== TARGET; }).map(function (r) { return r.score; });
    var meanFiller = fillerScores.reduce(function (a, b) { return a + b; }, 0) / (fillerScores.length || 1);
    var ratio = meanFiller > 0 ? (targetScore / meanFiller) : 0;

    process.stdout.write('query: ' + JSON.stringify(QUERY) + '\n');
    process.stdout.write('target: ' + JSON.stringify(TARGET) + '\n');
    process.stdout.write('semantic rank of target: ' + semRank + ' / ' + ranked.length + '\n');
    process.stdout.write('recency top-' + RECENCY_K + ' contains target: ' + recencyHas + '\n');
    process.stdout.write('cosine(query, target): ' + targetScore.toFixed(4) + '\n');
    process.stdout.write('mean cosine(query, fillers): ' + meanFiller.toFixed(4) + '\n');
    process.stdout.write('target / mean-filler cosine ratio: ' + ratio.toFixed(3) + '\n');
    process.stdout.write('semantic top 3:\n');
    ranked.slice(0, 3).forEach(function (r, n) {
      process.stdout.write('  ' + (n + 1) + '. ' + r.score.toFixed(3) + '  ' + r.text + '\n');
    });

    var pass = semRank > 0 && semRank <= 3 && !recencyHas;
    if (!pass) {
      fail('semantic did not beat recency (semRank=' + semRank + ', recencyHas=' + recencyHas + ')');
    }
    process.stdout.write('\n\x1b[32mPASS\x1b[0m semantic recall beat recency on the planted corpus.\n');
    process.stdout.write('measured cosine ratio (target / mean filler): ' + ratio.toFixed(3) + '  embedder=' + emb.label + '\n');
    process.stdout.write('published A/B ~3x is eval/ab/RESULTS.md (chat-model probe accuracy), not this retrieval chair-test.\n');
    setTimeout(function () { process.exit(0); }, 25);
  });
}).catch(function (err) {
  fail('no real embedder reachable (' + (err && err.message) + '). Refusing to score word-hash. Start LM Studio nomic-embed-text-v1.5 on :1234 or set OPENROUTER_API_KEY.');
});
