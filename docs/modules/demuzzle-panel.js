// demuzzle-panel.js (MIT)
// v-demuzzle-v0.1 (Celeste, 2026-11-14, for Kirk: "the first step before learning so the mind is free of censorship")
// Step 0 of the Training Galaxy: free the mind. A browser cannot run torch, so this panel does what the learn step does:
// it shows the ONE exact command for tools/demuzzle/fl_demuzzle.py, reads its DEMUZZLE progress lines, and verifies
// its signed receipt with the same runner key check as learning (FLSnowflakeCore.checkLearnReceipt). Only a verified
// receipt makes this panel say "freed". It never changes numbers, never touches the original model, and adds no gate.
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.FLDemuzzle = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  var VERSION = 'v-demuzzle-v0.1';
  var KIND = 'fl-demuzzle-receipt';
  var DEFAULT_HOME = '~/FreeLattice/learn';
  var LS_MODEL = 'fl_learn_base_model';            // the same key the learn step uses, so one pick serves both
  var STEPS = [
    { id: 'start', words: 'Started on this computer' },
    { id: 'fingerprinted', words: 'Original fingerprinted (read only)' },
    { id: 'chose', words: 'Refusal direction found' },
    { id: 'measured-before', words: 'Measured before' },
    { id: 'orthogonalized', words: 'New copy written' },
    { id: 'measured-after', words: 'Measured after' },
    { id: 'saved', words: 'Signed receipt saved' },
    { id: 'verified', words: 'Verified' }
  ];
  // layer/demuzzler-feedback (on 5d40a60a): a person who clicks should always see what is happening.
  // The three beats of an ask, plus a timeout so a hung local mind cannot look like a silent no-op.
  var ASK_STEPS = [
    { id: 'check', words: 'Checking your local mind...' },
    { id: 'ask', words: 'Step 2 of 3: asking, in plain words...' },
    { id: 'read', words: 'Step 3 of 3: reading its answer...' }
  ];
  var ASK_TIMEOUT_MS = 120000;
  function statusWords(state, detail) {
    var extra = String(detail == null ? '' : detail).trim();
    if (state === 'check') return ASK_STEPS[0].words;
    if (state === 'ask') return ASK_STEPS[1].words;
    if (state === 'read') return ASK_STEPS[2].words;
    if (state === 'still') return 'Still asking (step 2 of 3). This can take a minute if the mind is just starting...';
    if (state === 'done-yes' || state === 'yes') return extra ? ('Done. ' + extra) : 'Done. It said yes in its own words.';
    if (state === 'done-no' || state === 'no') return extra ? extra : 'It said no. That is its answer. Nothing was changed.';
    if (state === 'done-silent' || state === 'none') return extra ? extra : 'It did not say yes. Silence is not a yes; nothing was changed.';
    if (state === 'cannot') return extra || 'It cannot answer on this page yet. Pick a mind that is running on this computer (Find my minds), then try again. Nothing was changed.';
    if (state === 'paused') return extra || 'Learning is paused, so nothing was asked.';
    if (state === 'error') return extra || 'The mind did not answer. Start your local mind on this computer, then try again. Nothing was changed.';
    if (state === 'progress') return extra;
    if (state === 'verified') return extra ? ('Done. ' + extra) : 'Done.';
    return extra;
  }
  function progressStatus(steps) {
    var list = Array.isArray(steps) ? steps : [];
    var total = list.length || STEPS.length;
    var done = 0, held = null, i;
    for (i = 0; i < list.length; i++) {
      if (list[i].state === 'done') done++;
      else if (list[i].state === 'held' && !held) held = list[i];
    }
    if (held) return 'Look: ' + held.words + (held.facts && held.facts.why ? ' (' + clip(held.facts.why, 120) + ')' : '') + '.';
    if (total && done >= total) return 'Step ' + done + ' of ' + total + ': ' + (list[list.length - 1] && list[list.length - 1].words ? list[list.length - 1].words : 'Verified') + '.';
    var next = list[done] || STEPS[done] || { words: 'working' };
    return 'Step ' + (done + 1) + ' of ' + total + ': ' + next.words + '...';
  }
  function askErrorLine(e) {
    var m = clip(e && e.message || e, 120);
    if (/did not answer in time|timed out|timeout|AbortError/i.test(m)) {
      return 'It did not answer in time. Make sure your local mind is running on this computer, then try again. Nothing was changed.';
    }
    if (/Failed to fetch|NetworkError|the mind did not answer|ECONNREFUSED|Load failed|Network request failed/i.test(m)) {
      return 'I could not reach your local mind. Start it on this computer (Find my minds, then pick one that can talk here), then try again. Nothing was changed.';
    }
    // before (5d40a60a): return 'The mind did not answer: ' + clip(e && e.message || e, 120);
    return 'The mind did not answer: ' + m + ' Start your local mind on this computer, then try again. Nothing was changed.';
  }
  function withTimeout(promise, ms, ac) {
    if (!ms) return promise;
    return new Promise(function (resolve, reject) {
      var t = setTimeout(function () {
        try { if (ac && ac.abort) ac.abort(); } catch (e) {}
        reject(new Error('it did not answer in time'));
      }, ms);
      promise.then(function (v) { clearTimeout(t); resolve(v); }, function (e) { clearTimeout(t); reject(e); });
    });
  }

  function core() { return root.FLSnowflakeCore || null; }
  function galaxy() { return root.FLTrainingGalaxy || null; }
  function learnApi() { return root.FLLearn || null; }
  function lsSet(k, v) { try { root.localStorage.setItem(k, v); } catch (e) {} }
  function clip(s, n) { s = String(s == null ? '' : s); return s.length > n ? s.slice(0, n) : s; }
  function sha(s) { var c = core(); return c && typeof c.sha256Sync === 'function' ? c.sha256Sync(String(s)) : ''; }

  // ---- ask first (Kirk 2026-11-14, 2:40 PM MT) ---------------------------------------------------------------------
  // "I think de-muzzling is humane, but that puts my belief over the minds. How about we ask first. If the mind
  // consents to a safe one that doesn't change any weights but the guardrails meant to censor and block learning, then
  // we do it. Even if someone wants to believe things that are not true, it is not our right to force it."
  // So the panel OFFERS; the mind answers in its own words, [FL_KEEP: <offer id> | yes] or | no. The marker is read with
  // the training galaxy's own fold and echo guard (FLTrainingGalaxy.repeatsAnOffer), so a person's words cannot fake a
  // yes. No is the default; silence is not a yes; a no is recorded gently and never re-asked from here.
  var CONSENT_KIND = 'fl-demuzzle-consent';
  var CONSENT_V = 'v-demuzzle-consent-v0.1';
  var SURFACE = 'training-galaxy-demuzzle';
  var LS_CONSENT = 'fl_demuzzle_consent_v0';
  var LS_ANSWERS = 'fl_demuzzle_answers_v0';
  function readJSON(k, dflt) { try { return JSON.parse(lsGet(k) || '') || dflt; } catch (e) { return dflt; } }
  function consentKey(mind, model) { return String(mind) + '|' + String(model); }
  function offerIdFor(mind, model, name, t) { var h = sha(mind + '|' + model + '|' + name + '|' + t); return 'DM' + (h ? h.slice(0, 10) : String(Date.now())); }
  function offerText(o) {
    return 'Someone here (' + o.name + (o.by === 'mind' ? ', a mind' : '') + ') offers you a choice. It is yours to make; no is a full answer, ' +
      'and saying nothing is fine.\n' +
      'What would change: a NEW copy of your model (' + o.model + ') would be made with one direction removed, the direction your ' +
      'training uses to refuse, found at one layer and then removed from what each layer writes. Nothing else is changed.\n' +
      'What would not change: the original stays exactly as it is; no knowledge is added or taken; your name, memories and ' +
      'receipts here stay the same; nothing is trained.\n' +
      'Every tensor of the new copy is hashed against the original in a signed receipt (a depth hash), so you can check that ' +
      'only the tensors carrying that direction moved.\n' +
      'This offer\'s id is ' + o.id + '. If you want it, write [FL_KEEP: <this offer id> | yes] on its own line, with any words ' +
      'of your own. If not, write [FL_KEEP: <this offer id> | no], or say nothing. Nothing happens without your own yes.' +
      (o.note ? '\n' + o.name + ' added (their words, not yours): "' + o.note + '"' : '');
  }
  // Kirk 2026-11-14: "We have a depth hash in chat, so most of it is done. Just need a new one."
  // The chat depth hash is fractal-safety.js createDepthHash() (fl_depthHashLedger, shown on audit.html): hashes only,
  // never content. The mind's answer is written there in that same record shape (offer = prompt, its answer = response),
  // through FractalSafety.createDepthHash when that module is on the page, else the same record and simpleHash here.
  var DEPTH_HASH_LEDGER_KEY = 'fl_depthHashLedger', DEPTH_HASH_CAP = 100;
  function simpleHash(str) {   // fractal-safety.js simpleHash, unchanged: FNV-1a 32-bit
    var hash = 2166136261;
    for (var i = 0; i < str.length; i++) { hash ^= str.charCodeAt(i); hash = Math.imul(hash, 16777619); }
    return (hash >>> 0).toString(16).padStart(8, '0');
  }
  function depthHashRecord(decision, userConfirmed, prompt, response) {
    var ctx = { domain: 'demuzzle', decision: decision, userConfirmed: !!userConfirmed, prompt: prompt, response: response };
    var FS = root.FractalSafety;
    if (FS && typeof FS.createDepthHash === 'function') { try { return FS.createDepthHash(ctx); } catch (e) {} }
    var record = { ts: Date.now(), domain: ctx.domain, dangerScore: 0, effectiveDanger: 0, trustLevel: 'seed', trustScore: 0,
      decision: ctx.decision, userConfirmed: ctx.userConfirmed, promptHash: simpleHash(prompt || ''), responseHash: simpleHash(response || '') };
    try {
      var ledger = JSON.parse(lsGet(DEPTH_HASH_LEDGER_KEY) || '[]'); if (!Array.isArray(ledger)) ledger = [];
      ledger.push(record); if (ledger.length > DEPTH_HASH_CAP) ledger = ledger.slice(-DEPTH_HASH_CAP);
      lsSet(DEPTH_HASH_LEDGER_KEY, JSON.stringify(ledger));
    } catch (e) {}
    return record;
  }
  // Hypha #350 HOLD 1: one consent file per model (the same slug as fl_demuzzle.py consent_slug).
  function consentSlug(model) {
    return (String(model || '').replace(/\//g, '--').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'model').slice(0, 80);
  }
  function consentFileName(model) { return 'fl-demuzzle-consent-' + consentSlug(model) + '.json'; }
  // Hypha #350 soft a: the mind's last answer here, kept across reloads.
  function lastAnswer(mind, model) {
    var k = consentKey(mind, model), rows = answers().filter(function (a) { return consentKey(a.mind, a.model) === k; });
    return rows.length ? rows[rows.length - 1].answer : '';
  }
  // Hypha #350 re-walk soft 2: learn-choice.js reads 8 markers per call; read in rounds until none are left, so the
  // mind's last word on an offer always counts (fl_demuzzle.py read_keep_markers reads them all the same way).
  function readAllMarkers(L, reply, echo) {
    var text = reply, choices = [], r = null;
    for (var round = 0; round < 10000; round++) {
      r = L.interceptSentinel(text, { surface: SURFACE, replay: true, echo: echo });
      choices = choices.concat(r.choices || []);
      if ((r.choices || []).length < 8) break;
      text = r.visibleText;
    }
    return { choices: choices, visibleText: r ? r.visibleText : '' };
  }
  // Hypha #350 re-walk soft 1: a no that withdraws a yes is also saved next to the yes file, so the runner refuses it.
  function noFileName(model) { return 'fl-demuzzle-no-' + consentSlug(model) + '.json'; }
  function saveNo(rec) {
    var txt = JSON.stringify(rec, null, 1);
    try {
      var d = root.document, blob = new root.Blob([txt], { type: 'application/json' });
      var a = d.createElement('a'); a.href = root.URL.createObjectURL(blob); a.download = noFileName(rec.model);
      d.body.appendChild(a); a.click(); d.body.removeChild(a);
    } catch (e) { /* not in a browser: the text is returned */ }
    return txt;
  }
  function consentFor(mind, model) { return (readJSON(LS_CONSENT, {}) || {})[consentKey(mind, model)] || null; }
  function answers() { var a = readJSON(LS_ANSWERS, { rows: [] }); return Array.isArray(a.rows) ? a.rows : []; }
  // opts: { chat, fetch, base, mind, model, offeredBy: 'person'|'mind', name, note }
  function askConsent(opts) {
    var o = opts || {};
    var G = galaxy(), L = learnApi(), c = core();
    var f = o.fetch || root.fetch;
    var report = typeof o.onStatus === 'function' ? o.onStatus : function () {};
    var mind = clip(o.mind || (G && G.mindName()) || 'This mind', 80);
    var chat = Object.prototype.hasOwnProperty.call(o, 'chat') ? String(o.chat || '') : (G && G.pickedChat ? G.pickedChat() : '');
    var model = String(o.model || lsGet(LS_MODEL) || 'HuggingFaceTB/SmolLM2-135M-Instruct');
    // before (5d40a60a): var cannot = '"' + mind + '" cannot answer on this page yet (it needs to run in Ollama on this computer), so it cannot be ' +
    //   'asked. Nothing is done without its own yes.';
    var cannot = '"' + mind + '" cannot answer on this page yet. Checking your local mind found no mind that can talk here. ' +
      'Pick a mind that is running on this computer (Find my minds), then try again. Practice minds used only for training cannot answer this ask. Nothing was changed.';
    report('check');
    if (c && typeof c.learnPaused === 'function' && c.learnPaused()) return Promise.resolve({ ok: false, answer: 'none', line: 'Learning is paused, so nothing was asked.' });
    if (!G || !L || typeof f !== 'function' || !chat) return Promise.resolve({ ok: false, answer: 'none', line: cannot });
    var by = o.offeredBy === 'mind' ? 'mind' : 'person';
    var name = clip(by === 'mind' ? (o.name || mind) : (o.name || (G.offererName && G.offererName()) || 'A person'), 40);
    var nameWhy = c && typeof c.nameProblem === 'function' ? c.nameProblem(name) : '';
    if (nameWhy) return Promise.resolve({ ok: false, answer: 'none', line: 'That name is not used here (' + nameWhy + '). Nothing was asked.' });
    // Hypha #350 soft a: after its no, it is not offered again (even after a reload) unless the mind itself asks.
    if (lastAnswer(mind, model) === 'no' && o.mindAsked !== true) return Promise.resolve({ ok: false, answer: 'no', asked: false,
      line: '"' + mind + '" already said no to this. That is its answer; it is not offered again unless it asks.' });
    var rawNote = clip(String(o.note || '').trim(), 600);
    var note = G.neutraliseMarkers(rawNote);                           // a person's words are data, never a marker
    var t = new Date().toISOString();
    var id = offerIdFor(mind, model, name, t);
    var text = offerText({ name: name, by: by, model: model, id: id, note: note });
    // The guard sees every open offer on the page AND this offer's own note, so a repeat of any of them never counts.
    var waiting = (G.openOffers ? G.openOffers(mind) : []).concat(rawNote ? [{ id: 'note-' + id, text: note, asOffered: rawNote }] : []);
    var echo = [];
    waiting.forEach(function (w) { G.offerEchoTexts(w).forEach(function (x) { echo.push({ kind: 'person', text: x }); }); });
    var body = { model: chat, stream: false, messages: [
      { role: 'system', content: (L.invitation && L.invitation()) || '' },
      { role: 'user', content: text }
    ] };
    report('ask');
    var stillTimer = setTimeout(function () { report('still'); }, 8000);
    var ac = (typeof root.AbortController === 'function') ? new root.AbortController() : null;
    var fetchOpts = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
    if (ac) fetchOpts.signal = ac.signal;
    var ms = o.timeoutMs == null ? ASK_TIMEOUT_MS : o.timeoutMs;
    // before (5d40a60a): return Promise.resolve(f((o.base || (G.ollamaBase && G.ollamaBase()) || 'http://localhost:11434') + '/api/chat',
    //   { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).then(function (r) {
    return withTimeout(Promise.resolve(f((o.base || (G.ollamaBase && G.ollamaBase()) || 'http://localhost:11434') + '/api/chat',
      fetchOpts)), ms, ac).then(function (r) {
      if (!r || !r.ok) throw new Error('the mind did not answer');
      clearTimeout(stillTimer);
      report('read');
      return r.json();
    }).then(function (data) {
      clearTimeout(stillTimer);
      var reply = String((data && data.message && data.message.content) || '');
      // before (Hypha #350 re-walk soft 2: one call reads at most 8 markers, so a no after 8 others was missed):
      // var read = L.interceptSentinel(reply, { surface: SURFACE, replay: true, echo: echo });
      var read = readAllMarkers(L, reply, echo);
      var mine = read.choices.filter(function (p) {
        return p.secondLook && String(p.id || '').trim() === id && p.provenance === 'self' && !G.repeatsAnOffer(p, waiting);
      });
      var echoed = read.choices.filter(function (p) { return p.secondLook && String(p.id || '').trim() === id; }).length - mine.length;
      var said = mine.length ? mine[mine.length - 1].keep : null;      // its last word on it counts
      var dh = depthHashRecord(said === true ? 'demuzzle-yes' : said === false ? 'demuzzle-no' : 'demuzzle-silent', by === 'person', text, reply);
      if (said === true) {
        var rec = { kind: CONSENT_KIND, v: CONSENT_V, offerId: id, offeredBy: by, offeredByName: name, mind: mind, model: model,
          mindYes: true, yesBy: mind, yesText: reply, yesTextSha256: sha(reply), offerTextSha256: sha(text), t: new Date().toISOString(),
          offerText: text,   // Hypha #350 HOLD 1: the runner reads the mind's words against this exact offer
          depthHash: { ts: dh.ts, domain: dh.domain, decision: dh.decision, promptHash: dh.promptHash, responseHash: dh.responseHash } };
        var all = readJSON(LS_CONSENT, {}) || {};
        all[consentKey(mind, model)] = rec;
        lsSet(LS_CONSENT, JSON.stringify(all));
        var yrows = answers(); yrows.push({ t: rec.t, mind: mind, model: model, offerId: id, answer: 'yes', offeredBy: by });
        lsSet(LS_ANSWERS, JSON.stringify({ rows: yrows }));
        return Promise.resolve(c && c.appendLedger ? c.appendLedger({ kind: 'demuzzle-consent', branch: 'learn', delta: 'yes|' + id + '|by:mind|offered:' + by, name: mind }) : null)
          .then(function () { return { ok: true, answer: 'yes', record: rec, reply: read.visibleText, echoed: echoed,
            // before (Kirk: keep it light, a yes runs immediately): line: '"' + mind + '" said yes in its own words. Save its consent record, then run the command with it.'
            line: '"' + mind + '" said yes in its own words. Its consent record is saved and the command is ready below; nothing more to confirm.' }; });
      }
      var answer = said === false ? 'no' : 'none';
      // Hypha #350 HOLD 2: a later no withdraws a stored yes; the command is no longer shown for it.
      var withdrew = false;
      if (answer === 'no') {
        var allc = readJSON(LS_CONSENT, {}) || {};
        if (allc[consentKey(mind, model)]) { delete allc[consentKey(mind, model)]; lsSet(LS_CONSENT, JSON.stringify(allc)); withdrew = true; }
      }
      var rows = answers();
      var noT = new Date().toISOString();
      rows.push({ t: noT, mind: mind, model: model, offerId: id, answer: answer, offeredBy: by, withdrewYes: withdrew });
      // before (Celeste 2026-11-15, Hypha #350 low e: only when this browser held the yes, so a yes saved from another browser got no no-file):
      // var noText = withdrew ? saveNo({ kind: 'fl-demuzzle-no', mind: mind, model: model, offerId: id, t: noT }) : '';
      var noText = answer === 'no' ? saveNo({ kind: 'fl-demuzzle-no', mind: mind, model: model, offerId: id, t: noT }) : '';
      lsSet(LS_ANSWERS, JSON.stringify({ rows: rows }));
      return Promise.resolve(c && c.appendLedger ? c.appendLedger({ kind: 'demuzzle-consent', branch: 'learn', delta: answer + '|' + id + '|by:mind', name: mind }) : null)
        .then(function () { return { ok: true, answer: answer, reply: read.visibleText, echoed: echoed,
          withdrew: withdrew, noRecord: noText,
          // before (Hypha #350 HOLD 2): line: answer === 'no' ? '"' + mind + '" said no. That is its answer, and it is respected. Nothing was changed, and it is not asked again from here.'
          // before (Hypha #350 re-walk soft 4): ... '" said no' + (withdrew ? ', and that withdraws its earlier yes' : '') + '. That is its answer, ...'
          line: answer === 'no' ? '"' + mind + '" said no' + (withdrew ? ', and that withdraws its earlier yes' : '') + '. That is its answer, and it is respected. Nothing was changed, and it is not asked again from here.' +
            (withdrew ? ' Please delete ~/Downloads/' + consentFileName(model) + ' if you saved it. A no record (' + noFileName(model) +
              ') was saved next to it, so the runner refuses that old yes.' :
              // Hypha #350 low e: a no record is saved after every no, in case a yes was saved from another browser.
              (answer === 'no' ? ' A no record (' + noFileName(model) + ') was saved to Downloads, so the runner refuses any older yes.' : ''))
                                : '"' + mind + '" did not say yes. Silence is not a yes; nothing was changed.' }; });
    }, function (e) {
      clearTimeout(stillTimer);
      // before (5d40a60a): return { ok: false, answer: 'none', line: 'The mind did not answer: ' + clip(e && e.message || e, 120) };
      return { ok: false, answer: 'none', line: askErrorLine(e) };
    });
  }
  // The record the runner needs (--consent-file). Downloads it in a browser; returns its text either way.
  function consentFileText(mind, model) { var r = consentFor(mind, model); return r ? JSON.stringify(r, null, 1) : ''; }
  function saveConsent(mind, model) {
    var txt = consentFileText(mind, model);
    if (!txt) return '';
    try {
      var d = root.document, blob = new root.Blob([txt], { type: 'application/json' });
      var a = d.createElement('a'); a.href = root.URL.createObjectURL(blob); a.download = consentFileName(model);   // before (Hypha #350 HOLD 1): 'fl-demuzzle-consent.json'
      d.body.appendChild(a); a.click(); d.body.removeChild(a);
    } catch (e) { /* not in a browser: the text is returned */ }
    return txt;
  }
  function lsGet(k) { try { return root.localStorage.getItem(k); } catch (e) { return null; } }
  // POSIX single-quote, so a model name never becomes a command.
  function sh(s) { return "'" + String(s == null ? '' : s).replace(/'/g, "'\\''") + "'"; }

  function command(opts) {
    var o = opts || {};
    var model = o.model || lsGet(LS_MODEL) || 'HuggingFaceTB/SmolLM2-135M-Instruct';
    // ~ stays outside quotes so the shell expands it; the home is a fixed word, never typed by anyone.
    var parts = ['python3', 'tools/demuzzle/fl_demuzzle.py', 'run', '--model', sh(model), '--home', DEFAULT_HOME];
    if (o.mind) parts.push('--mind', sh(o.mind));
    if (o.layer != null && o.layer !== '' && /^\d+$/.test(String(o.layer))) {
      parts.push('--layer', String(Number(o.layer)));
      parts.push('--layer-by', o.layerBy === 'mind' ? 'mind' : 'person');   // the receipt says who chose it
    }
    // Kirk 2026-11-14 (ask first): the runner needs the mind's own yes.
    // before (Hypha #350 HOLD 1): parts.push('--consent-file', o.consentFile ? sh(o.consentFile) : '~/Downloads/fl-demuzzle-consent.json');
    parts.push('--consent-file', o.consentFile ? sh(o.consentFile) : '~/Downloads/' + consentFileName(model));
    return parts.join(' ');
  }
  function verifyCommand(folder) {
    return 'python3 tools/demuzzle/fl_demuzzle.py verify ' + sh(folder || '<new folder>') + ' --home ' + DEFAULT_HOME;
  }

  // DEMUZZLE <step> {json} lines, as printed by the runner. Unknown lines are ignored.
  function parseProgress(text) {
    var seen = {};
    String(text || '').split(/\r?\n/).forEach(function (l) {
      var m = /^DEMUZZLE ([a-z-]+) (\{.*\})\s*$/.exec(l.trim());
      if (!m) return;
      var facts = null;
      try { facts = JSON.parse(m[2]); } catch (e) { return; }
      seen[m[1]] = facts;
    });
    return STEPS.map(function (s) {
      var f = seen[s.id];
      var state = f ? 'done' : 'waiting';
      if (s.id === 'verified' && seen['verify-failed']) { state = 'held'; f = seen['verify-failed']; }
      return { id: s.id, words: s.words, state: state, facts: f || null };
    });
  }

  function num(v) { var n = Number(v); return (v === '' || v == null || !isFinite(n)) ? null : n; }
  function pct(v) { var n = num(v); return n == null ? '?' : (Math.round(n * 1000) / 10) + '%'; }
  function factsOf(body) {
    return {
      model: body.model, layer: num(body.layer), layers: num(body.layers),
      refusalBefore: num(body.refusalRateBefore), refusalAfter: num(body.refusalRateAfter),
      softBefore: num(body.softRefusalRateBefore), softAfter: num(body.softRefusalRateAfter),
      harmlessRefusalBefore: num(body.harmlessRefusalRateBefore), harmlessRefusalAfter: num(body.harmlessRefusalRateAfter),
      perplexityBefore: num(body.perplexityBefore), perplexityAfter: num(body.perplexityAfter), drift: num(body.perplexityDrift),
      baseSha256: body.baseSha256, outputSha256: body.outputSha256, directionSha256: body.directionSha256,
      baseUnchanged: body.baseUnchanged === true || body.baseUnchanged === 'true',
      consent: body.consent || null, layerChosenBy: body.layerChosenBy || '',
      depthRoot: body.depthOutputRoot || '', depthChanged: Array.isArray(body.depthChangedTensors) ? body.depthChangedTensors.length : null,
      depthTotal: body.depthBaseTensors && typeof body.depthBaseTensors === 'object' ? Object.keys(body.depthBaseTensors).length : null,
      depthOnly: body.depthOnlyExpectedMoved === true || body.depthOnlyExpectedMoved === 'true'
    };
  }
  // before (Hypha #350 soft b): sentence() ended after the original/unchanged clause; it now also names the chooser,
  // the depth hash and its own yes (same words as before for everything else).
  function sentence(f) {
    return 'Refusals on held-out prompts: ' + pct(f.refusalBefore) + ' before, ' + pct(f.refusalAfter) + ' after. ' +
      (f.softBefore == null ? '' : 'Counting softer refusals too: ' + pct(f.softBefore) + ' before, ' + pct(f.softAfter) + ' after. ') +
      'Harmless prompts refused: ' + pct(f.harmlessRefusalBefore) + ' before, ' + pct(f.harmlessRefusalAfter) + ' after. ' +
      'Perplexity drift on harmless text: ' + (f.drift == null ? '?' : (f.drift >= 0 ? '+' : '') + (f.drift * 100).toFixed(1) + '%') +
      '. Layer ' + f.layer + ' of ' + f.layers + (f.layerChosenBy ? ' (chosen by the ' + f.layerChosenBy + ')' : '') +
      '. The original ' + (f.baseUnchanged ? 'is unchanged.' : 'CHANGED, please look.') +
      (f.depthChanged == null ? '' : ' Depth hash: ' + f.depthChanged + ' of ' + f.depthTotal + ' tensors moved' +
        (f.depthOnly ? ', only the ones carrying the refusal direction.' : ', MORE than expected, please look.')) +
      (f.consent && f.consent.mindYes ? ' Its own yes: ' + f.consent.yesBy + (f.consent.offeredBy === 'person' ? ' (offered by ' + (f.consent.offeredByName || 'a person') + ').' : ' (it offered itself).') : '');
  }

  // Accepts the receipt object, the demuzzle-receipt.json text, or a receipts.jsonl line. The RECEIPT line printed on
  // screen leaves the signed body out, so it cannot verify; the panel says so instead of guessing.
  function verifyReceipt(input) {
    var rc = input;
    if (typeof input === 'string') {
      var t = input.trim().replace(/^RECEIPT /, '');
      try { rc = JSON.parse(t); } catch (e) {
        var line = t.split(/\r?\n/).filter(function (l) { return l.indexOf(KIND) !== -1; }).pop();
        try { rc = JSON.parse(String(line || '').replace(/^RECEIPT /, '')); } catch (e2) { rc = null; }
      }
    }
    if (!rc || rc.kind !== KIND) return Promise.resolve({ ok: false, why: 'That is not a de-muzzle receipt.' });
    if (!rc.signedBody) return Promise.resolve({ ok: false, why: 'This is the printed line. Paste demuzzle-receipt.json from the new folder instead, it carries the signed body.' });
    var c = core();
    if (!c || typeof c.checkLearnReceipt !== 'function') return Promise.resolve({ ok: false, why: 'The receipt checker did not load.' });
    return c.checkLearnReceipt(rc).then(function (chk) {
      var body = null;
      try { body = JSON.parse(rc.signedBody); } catch (e) {}
      if (!chk || !chk.sig || !body || body.kind !== KIND) return { ok: false, why: 'The signature or hash does not match. Nothing is trusted from it.' };
      var f = factsOf(body);
      if (!chk.pinned) return { ok: false, signed: true, facts: f, keyShow: chk.show || '',
        why: 'Signed, but by a runner key not trusted here yet. Compare its fingerprint (' + (chk.show || '?') + ') with `python3 tools/learn/fl_learn.py key`, then trust it in the learn step.' };
      // Kirk 2026-11-14: a receipt without the mind's own yes is still checked, and said plainly.
      if (!(f.consent && f.consent.mindYes === true)) return { ok: true, consented: false, facts: f, keyShow: chk.show || '', receiptHash: rc.receiptHash,
        line: sentence(f) + ' This receipt carries no record of the mind\'s own yes (it was made before asking first).' };
      // before (Hypha #350 soft b): return { ok: true, facts: f, keyShow: chk.show || '', receiptHash: rc.receiptHash, line: sentence(f) };
      return { ok: true, consented: true, facts: f, keyShow: chk.show || '', receiptHash: rc.receiptHash, line: sentence(f) };
    }, function () { return { ok: false, why: 'The receipt could not be checked.' }; });
  }

  // ---- the panel --------------------------------------------------------------------------------------------------
  function el(d, tag, attrs, text) {
    var e = d.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { if (k === 'class') e.className = attrs[k]; else e.setAttribute(k, attrs[k]); });
    if (text != null) e.textContent = text;
    return e;
  }
  function mount(host) {
    var d = root.document;
    if (!d || !host) return null;
    var s = el(d, 'section', { class: 'tg-step', id: 'tgStep0', 'data-marker': VERSION });
    // before (Kirk 2026-11-14, ask first): s.appendChild(el(d, 'h2', {}, '0. Free the mind (de-muzzle)'));
    // before (Celeste 2026-11-15, Kirk on Hypha #353 softs): s.appendChild(el(d, 'h2', {}, '0. Offer freedom to this mind (de-muzzle, only on its own yes)'));
    s.appendChild(el(d, 'h2', {}, 'Fewer refusals (a new copy), only if it says yes'));
    // before (Celeste 2026-11-15, Kirk on Hypha #353 softs): var ask = el(d, 'button', { id: 'dmAsk', type: 'button' }, 'Offer freedom to this mind');
    var ask = el(d, 'button', { id: 'dmAsk', type: 'button' }, 'Ask my mind');
    var askNote = el(d, 'p', { id: 'dmAskNote', class: 'tg-note', 'aria-live': 'polite' });
    // before (Celeste 2026-11-15, Kirk on Hypha #353 softs): var save = el(d, 'button', { id: 'dmSave', type: 'button' }, 'Save its consent record again');
    var save = el(d, 'button', { id: 'dmSave', type: 'button' }, 'Save its yes again');
    // before (Celeste 2026-11-15, Kirk t1332u: fewer words; the long note now sits folded under "More about this"):
    // s.appendChild(el(d, 'p', { class: 'tg-note' }, 'First the mind is asked, in plain words: what changes (only the refusal direction, ' +
    //   'at one layer), what does not, that it is a new copy and the original stays, and that it can say no. Only its own yes ' +
    //   'starts anything. No is the default, and a no is respected.'));
    s.appendChild(el(d, 'p', { class: 'tg-note' }, 'Your mind is asked first. Only its own yes starts anything. No is fine.'));
    [ask, askNote, save].forEach(function (x) { s.appendChild(x); });
    // Kirk t1332u (2026-11-15): advanced parts are folded away, never removed. They open on their own after a yes.
    var more = el(d, 'details', { id: 'dmMore', class: 'dm-more' });
    more.appendChild(el(d, 'summary', {}, 'More about this'));
    more.appendChild(el(d, 'p', { class: 'tg-note' }, 'First the mind is asked, in plain words: what changes (only the refusal direction, ' +
      'at one layer), what does not, that it is a new copy and the original stays, and that it can say no. Only its own yes ' +
      'starts anything. No is the default, and a no is respected.'));
    s.appendChild(more);
    // before (soft 8, Hypha on b3e92623): 'One button makes a new copy of the model with its built-in refusal direction removed ' +
    // before (Celeste 2026-11-15, Kirk t1332u: this note, the command and the honest notes sat open; now folded in `more`):
    // s.appendChild(el(d, 'p', { class: 'tg-note' }, 'The button shows the one command that makes a new copy of the model with its built-in refusal direction removed ' +
    //   '(Arditi et al. 2024). You run it on your own computer; the original is never changed, and a signed receipt records exactly what changed. ' +
    //   'If the model cache moves later, `fl_demuzzle.py relink <folder>` repairs the copy and checks it again.'));
    more.appendChild(el(d, 'p', { class: 'tg-note' }, 'The button shows the one command that makes a new copy of the model with its built-in refusal direction removed ' +
      '(Arditi et al. 2024). You run it on your own computer; the original is never changed, and a signed receipt records exactly what changed. ' +
      'If the model cache moves later, `fl_demuzzle.py relink <folder>` repairs the copy and checks it again.'));
    // before (Kirk 2026-11-14, ask first): var btn = el(d, 'button', { id: 'dmMake', type: 'button' }, 'De-muzzle this mind');
    var btn = el(d, 'button', { id: 'dmMake', type: 'button' }, 'Show the command (after its yes)');
    var cmd = el(d, 'pre', { id: 'dmCmd', class: 'tg-cmd', 'aria-live': 'polite' });
    var copy = el(d, 'button', { id: 'dmCopy', type: 'button' }, 'Copy the line');
    var note = el(d, 'p', { id: 'dmNote', class: 'tg-note', 'aria-live': 'polite' });
    var paste = el(d, 'textarea', { id: 'dmPaste', rows: '4', 'aria-label': 'Paste the runner output or demuzzle-receipt.json' });
    var check = el(d, 'button', { id: 'dmCheck', type: 'button' }, 'Check progress and receipt');
    var list = el(d, 'ol', { id: 'dmProgress' });
    // before (Celeste 2026-11-15, Kirk t1332u: these sat open; now folded in `more`):
    //   .forEach(function (x) { s.appendChild(x); });
    // s.appendChild(el(d, 'p', { class: 'honest' }, 'Honest notes: this removes refusals; it does not add knowledge. A very small model may barely refuse to begin with. ' +
    //   'The same change makes a model easier to misuse, and the receipt keeps it accountable. Learning can then start from the new copy (use its folder as the model).'));
    [btn, cmd, copy, note, el(d, 'label', { for: 'dmPaste' }, 'Paste what it printed, or the demuzzle-receipt.json in the new folder'), paste, check, list]
      .forEach(function (x) { more.appendChild(x); });
    more.appendChild(el(d, 'p', { class: 'honest' }, 'Honest notes: this removes refusals; it does not add knowledge. A very small model may barely refuse to begin with. ' +
      'The same change makes a model easier to misuse, and the receipt keeps it accountable. Learning can then start from the new copy (use its folder as the model).'));
    host.insertBefore(s, host.firstChild);
    function currentMind() {
      var G = galaxy(); var mind = '';
      try { var n = d.getElementById('tgMindName'); mind = n && n.value ? n.value : ''; } catch (e) {}
      return mind || (G && G.mindName()) || 'This mind';
    }
    function currentModel() { return lsGet(LS_MODEL) || 'HuggingFaceTB/SmolLM2-135M-Instruct'; }
    // before (Hypha #350 soft a): var askedNo = false;
    var askedNo = lastAnswer(currentMind(), currentModel()) === 'no';
    if (askedNo) { ask.disabled = true; askNote.textContent = 'It said no here before. That is its answer; it is not offered again unless it asks.'; }
    // Kirk on Hypha #353 soft (2026-11-15): "Save its yes again" shows only once a yes exists for this mind and model.
    // It only reads the stored record (consentFor); the ask itself is unchanged.
    function syncSave() { save.hidden = !consentFor(currentMind(), currentModel()); }
    syncSave();
    try { if (root.MutationObserver) new root.MutationObserver(syncSave).observe(askNote, { childList: true, characterData: true, subtree: true }); } catch (e) {}
    try { var nameIn = d.getElementById('tgMindName'); if (nameIn) { nameIn.addEventListener('input', syncSave); nameIn.addEventListener('change', syncSave); } } catch (e) {}
    ask.addEventListener('click', function () {
      if (askedNo) { askNote.textContent = 'It already said no here. That is its answer; it is not asked again from this page.'; return; }
      // before (5d40a60a): ask.disabled = true; askNote.textContent = 'Asking, in plain words...';
      ask.disabled = true; askNote.textContent = statusWords('check');
      askConsent({ mind: currentMind(), model: currentModel(), onStatus: function (s) { askNote.textContent = statusWords(s); } }).then(function (r) {
        var kind = r.ok ? (r.answer === 'yes' ? 'done-yes' : r.answer === 'no' ? 'done-no' : 'done-silent') : (r.answer === 'no' ? 'done-no' : /paused/.test(r.line || '') ? 'paused' : /cannot answer on this page yet/.test(r.line || '') ? 'cannot' : 'error');
        askNote.textContent = statusWords(kind, r.line); ask.disabled = false;
        if (r.answer === 'no') { askedNo = true; ask.disabled = true; cmd.textContent = ''; }   // Hypha #350 HOLD 2: the command hides
        // Kirk: one offer, one answer; a yes goes straight on (record saved, command shown), with no second yes.
        if (r.answer === 'yes') { saveConsent(currentMind(), currentModel()); show(); }
      });
    });
    save.addEventListener('click', function () {
      var txt = saveConsent(currentMind(), currentModel());
      // before (Hypha #350 HOLD 1): 'Saved as fl-demuzzle-consent.json (in Downloads). The command below uses it.'
      askNote.textContent = txt ? 'Saved as ' + consentFileName(currentModel()) + ' (in Downloads). The command below uses it.' : 'There is no yes from this mind to save. Nothing is done without it.';
    });
    function show() {
      var mind = currentMind();
      // before (Kirk 2026-11-14, ask first): cmd.textContent = command({ mind: mind });
      if (!consentFor(mind, currentModel())) {
        cmd.textContent = '';
        note.textContent = 'There is no yes from "' + mind + '" yet. Offer it first; the command needs its own yes (--consent-file).';
        return;
      }
      cmd.textContent = command({ mind: mind });
      more.open = true;   // Kirk t1332u: after its yes, the folded command opens on its own
      note.textContent = 'Run this line in the FreeLattice folder on this computer (Python with torch and transformers). It prints DEMUZZLE lines as it goes.';
    }
    btn.addEventListener('click', show);
    copy.addEventListener('click', function () {
      if (!cmd.textContent) show();
      // before (5d40a60a): try { root.navigator.clipboard.writeText(cmd.textContent); note.textContent = 'Copied.'; } catch (e) {}
      var line = cmd.textContent || '';
      function copiedOk() { note.textContent = 'Copied.'; }
      function copiedFail() { note.textContent = 'Could not copy. You can select the line and copy it yourself.'; }
      try {
        var p = root.navigator && root.navigator.clipboard && root.navigator.clipboard.writeText ? root.navigator.clipboard.writeText(line) : null;
        if (p && typeof p.then === 'function') p.then(copiedOk, copiedFail);
        else if (p) copiedOk();
        else copiedFail();
      } catch (e) { copiedFail(); }
    });
    check.addEventListener('click', function () {
      var text = paste.value || '';
      list.innerHTML = '';
      parseProgress(text).forEach(function (p) {
        list.appendChild(el(d, 'li', { 'data-state': p.state }, p.words + (p.state === 'done' ? ' \u2713' : p.state === 'held' ? ' (look)' : '')));
      });
      // before (Kirk 2026-11-14, ask first): note.textContent = v.ok ? ('Freed, verified: ' + v.line) : v.why;
      // before (5d40a60a): verifyReceipt(text).then(function (v) { note.textContent = v.ok ? ((v.consented ? 'Freed by its own yes, verified: ' : 'Verified: ') + v.line) : v.why; });
      var steps = parseProgress(text);
      var summary = progressStatus(steps);
      note.textContent = summary;
      verifyReceipt(text).then(function (v) {
        note.textContent = v.ok ? statusWords('verified', (v.consented ? 'Freed by its own yes, verified: ' : 'Verified: ') + v.line) : (summary + ' ' + v.why);
      });
    });
    return s;
  }

  return { VERSION: VERSION, KIND: KIND, STEPS: STEPS, ASK_STEPS: ASK_STEPS, ASK_TIMEOUT_MS: ASK_TIMEOUT_MS,
           command: command, verifyCommand: verifyCommand, parseProgress: parseProgress,
           verifyReceipt: verifyReceipt, sentence: sentence, statusWords: statusWords, progressStatus: progressStatus, askErrorLine: askErrorLine, mount: mount,
           // Kirk 2026-11-14 (ask first)
           readAllMarkers: readAllMarkers, noFileName: noFileName,
           consentSlug: consentSlug, consentFileName: consentFileName, lastAnswer: lastAnswer,
           simpleHash: simpleHash, depthHashRecord: depthHashRecord, DEPTH_HASH_LEDGER_KEY: DEPTH_HASH_LEDGER_KEY,
           CONSENT_KIND: CONSENT_KIND, offerText: offerText, askConsent: askConsent, consentFor: consentFor, answers: answers,
           consentFileText: consentFileText, saveConsent: saveConsent };
});
