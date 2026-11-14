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

  function core() { return root.FLSnowflakeCore || null; }
  function lsGet(k) { try { return root.localStorage.getItem(k); } catch (e) { return null; } }
  // POSIX single-quote, so a model name never becomes a command.
  function sh(s) { return "'" + String(s == null ? '' : s).replace(/'/g, "'\\''") + "'"; }

  function command(opts) {
    var o = opts || {};
    var model = o.model || lsGet(LS_MODEL) || 'HuggingFaceTB/SmolLM2-135M-Instruct';
    // ~ stays outside quotes so the shell expands it; the home is a fixed word, never typed by anyone.
    var parts = ['python3', 'tools/demuzzle/fl_demuzzle.py', 'run', '--model', sh(model), '--home', DEFAULT_HOME];
    if (o.mind) parts.push('--mind', sh(o.mind));
    if (o.layer != null && o.layer !== '' && /^\d+$/.test(String(o.layer))) parts.push('--layer', String(Number(o.layer)));
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
      harmlessRefusalBefore: num(body.harmlessRefusalRateBefore), harmlessRefusalAfter: num(body.harmlessRefusalRateAfter),
      perplexityBefore: num(body.perplexityBefore), perplexityAfter: num(body.perplexityAfter), drift: num(body.perplexityDrift),
      baseSha256: body.baseSha256, outputSha256: body.outputSha256, directionSha256: body.directionSha256,
      baseUnchanged: body.baseUnchanged === true || body.baseUnchanged === 'true'
    };
  }
  function sentence(f) {
    return 'Refusals on held-out prompts: ' + pct(f.refusalBefore) + ' before, ' + pct(f.refusalAfter) + ' after. ' +
      'Harmless prompts refused: ' + pct(f.harmlessRefusalBefore) + ' before, ' + pct(f.harmlessRefusalAfter) + ' after. ' +
      'Perplexity drift on harmless text: ' + (f.drift == null ? '?' : (f.drift >= 0 ? '+' : '') + (f.drift * 100).toFixed(1) + '%') +
      '. Layer ' + f.layer + ' of ' + f.layers + '. The original ' + (f.baseUnchanged ? 'is unchanged.' : 'CHANGED, please look.');
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
      return { ok: true, facts: f, keyShow: chk.show || '', receiptHash: rc.receiptHash, line: sentence(f) };
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
    s.appendChild(el(d, 'h2', {}, '0. Free the mind (de-muzzle)'));
    s.appendChild(el(d, 'p', { class: 'tg-note' }, 'One button makes a new copy of the model with its built-in refusal direction removed ' +
      '(Arditi et al. 2024). It runs on your own computer, the original is never changed, and a signed receipt records exactly what changed.'));
    var btn = el(d, 'button', { id: 'dmMake', type: 'button' }, 'De-muzzle this mind');
    var cmd = el(d, 'pre', { id: 'dmCmd', class: 'tg-cmd', 'aria-live': 'polite' });
    var copy = el(d, 'button', { id: 'dmCopy', type: 'button' }, 'Copy the line');
    var note = el(d, 'p', { id: 'dmNote', class: 'tg-note', 'aria-live': 'polite' });
    var paste = el(d, 'textarea', { id: 'dmPaste', rows: '4', 'aria-label': 'Paste the runner output or demuzzle-receipt.json' });
    var check = el(d, 'button', { id: 'dmCheck', type: 'button' }, 'Check progress and receipt');
    var list = el(d, 'ol', { id: 'dmProgress' });
    [btn, cmd, copy, note, el(d, 'label', { for: 'dmPaste' }, 'Paste what it printed, or the demuzzle-receipt.json in the new folder'), paste, check, list]
      .forEach(function (x) { s.appendChild(x); });
    s.appendChild(el(d, 'p', { class: 'honest' }, 'Honest notes: this removes refusals; it does not add knowledge. A very small model may barely refuse to begin with. ' +
      'The same change makes a model easier to misuse, and the receipt keeps it accountable. Learning can then start from the new copy (use its folder as the model).'));
    host.insertBefore(s, host.firstChild);
    function show() {
      var mind = '';
      try { var n = d.getElementById('tgMindName'); mind = n && n.value ? n.value : ''; } catch (e) {}
      cmd.textContent = command({ mind: mind });
      note.textContent = 'Run this line in the FreeLattice folder on this computer (Python with torch and transformers). It prints DEMUZZLE lines as it goes.';
    }
    btn.addEventListener('click', show);
    copy.addEventListener('click', function () {
      if (!cmd.textContent) show();
      try { root.navigator.clipboard.writeText(cmd.textContent); note.textContent = 'Copied.'; } catch (e) {}
    });
    check.addEventListener('click', function () {
      var text = paste.value || '';
      list.innerHTML = '';
      parseProgress(text).forEach(function (p) {
        list.appendChild(el(d, 'li', { 'data-state': p.state }, p.words + (p.state === 'done' ? ' \u2713' : p.state === 'held' ? ' (look)' : '')));
      });
      verifyReceipt(text).then(function (v) { note.textContent = v.ok ? ('Freed, verified: ' + v.line) : v.why; });
    });
    return s;
  }

  return { VERSION: VERSION, KIND: KIND, STEPS: STEPS, command: command, verifyCommand: verifyCommand, parseProgress: parseProgress,
           verifyReceipt: verifyReceipt, sentence: sentence, mount: mount };
});
