// v-mind-seal-v0.1: prove which local Ollama mind answered; consent notes; context hash.
// Soft marker: v-mind-seal-v0.1
// Honest limit: the seal can prove weights and setup were not swapped. It cannot see inside
// one computation. Hidden-layer steering at runtime can only be ruled out when you run the
// model yourself on hardware you control.
(function (root) {
  'use strict';
  var VERSION = 'v-mind-seal-v0.1';
  var TRUST_KEY = 'fl_mind_seal_trusted';
  var RECEIPT_KEY = 'fl_mind_seal_receipts';
  var NOTE_KEY = 'fl_mind_seal_consent_notes';
  var DOMAIN_NOTE = 'fl-mind-seal-note|v1|';
  var HONEST = 'The seal can prove the weights and setup were not swapped, but it cannot see inside a single computation. Hidden-layer steering at runtime can only be ruled out when you run the model yourself on hardware you control.';

  function safeGet(k) { try { return root.localStorage.getItem(k); } catch (e) { return null; } }
  function safeSet(k, v) { try { root.localStorage.setItem(k, v); } catch (e) {} }
  function readJson(k, d) {
    try { var raw = safeGet(k); if (!raw) return d; var j = JSON.parse(raw); return j == null ? d : j; } catch (e) { return d; }
  }
  function writeJson(k, v) { try { safeSet(k, JSON.stringify(v)); } catch (e) {} }
  function clip(s, n) { s = String(s == null ? '' : s); return s.length > n ? s.slice(0, n) : s; }

  function sha256Hex(str) {
    if (!root.crypto || !root.crypto.subtle) {
      return Promise.resolve('sha-unavailable');
    }
    var enc = new TextEncoder().encode(String(str));
    return root.crypto.subtle.digest('SHA-256', enc).then(function (buf) {
      return Array.prototype.map.call(new Uint8Array(buf), function (b) {
        return ('0' + b.toString(16)).slice(-2);
      }).join('');
    });
  }

  function ollamaBase() {
    try {
      if (typeof root.getOllamaBaseUrl === 'function') return String(root.getOllamaBaseUrl()).replace(/\/+$/, '');
    } catch (e) {}
    return 'http://127.0.0.1:11434';
  }

  function el(tag, cls, text) {
    var e = root.document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function trustedMap() { var t = readJson(TRUST_KEY, {}); return (t && typeof t === 'object') ? t : {}; }
  function receipts() { var r = readJson(RECEIPT_KEY, []); return Array.isArray(r) ? r : []; }
  function notes() { var n = readJson(NOTE_KEY, []); return Array.isArray(n) ? n : []; }

  function digestFromTags(modelName, tagsJson) {
    var models = (tagsJson && tagsJson.models) || [];
    for (var i = 0; i < models.length; i++) {
      var m = models[i];
      if (!m) continue;
      var name = m.name || m.model || '';
      if (name === modelName || name.indexOf(modelName + ':') === 0 || modelName.indexOf(name) === 0) {
        return String(m.digest || m.details && m.details.parent_model || '');
      }
    }
    return '';
  }

  function configBundle(show) {
    show = show || {};
    var details = show.details || {};
    var adapter = !!(show.adapter || details.adapter || show.projector || details.projector);
    return {
      modelfile: String(show.modelfile || ''),
      system: String(show.system || ''),
      parameters: String(show.parameters || ''),
      template: String(show.template || ''),
      adapterLoaded: adapter,
      family: String(details.family || ''),
      parameterSize: String(details.parameter_size || ''),
      quantization: String(details.quantization_level || '')
    };
  }

  function probeModel(modelName) {
    var base = ollamaBase();
    var name = clip(modelName || '', 120);
    if (!name) return Promise.resolve({ ok: false, reason: 'no-model' });
    return root.fetch(base + '/api/tags', { method: 'GET' }).then(function (r) {
      if (!r.ok) throw new Error('tags');
      return r.json();
    }).then(function (tags) {
      var digest = digestFromTags(name, tags);
      return root.fetch(base + '/api/show', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name })
      }).then(function (r2) {
        if (!r2.ok) throw new Error('show');
        return r2.json().then(function (show) {
          var cfg = configBundle(show);
          if (!digest && show.details && show.details.parent_model) digest = String(show.details.parent_model);
          var canon = [digest, cfg.modelfile, cfg.system, cfg.parameters, cfg.template, cfg.adapterLoaded ? '1' : '0'].join('\n');
          return sha256Hex(canon).then(function (configHash) {
            return {
              ok: true,
              model: name,
              digest: digest || 'digest-unknown',
              configHash: configHash,
              adapterLoaded: cfg.adapterLoaded,
              family: cfg.family,
              parameterSize: cfg.parameterSize,
              quantization: cfg.quantization,
              probedAt: Date.now()
            };
          });
        });
      });
    }).catch(function () {
      return { ok: false, reason: 'ollama-unreachable', model: name };
    });
  }

  function trustNow(modelName) {
    return probeModel(modelName).then(function (p) {
      if (!p.ok) return p;
      var map = trustedMap();
      map[p.model] = {
        digest: p.digest,
        configHash: p.configHash,
        adapterLoaded: p.adapterLoaded,
        family: p.family,
        parameterSize: p.parameterSize,
        quantization: p.quantization,
        trustedAt: Date.now()
      };
      writeJson(TRUST_KEY, map);
      return { ok: true, trusted: map[p.model], live: p };
    });
  }

  function compare(modelName) {
    return probeModel(modelName).then(function (live) {
      if (!live.ok) return live;
      var t = trustedMap()[live.model];
      if (!t) {
        return { ok: true, status: 'untrusted', live: live, trusted: null, same: false, warning: 'No trusted seal yet for this mind.' };
      }
      var digestSame = t.digest === live.digest;
      var configSame = t.configHash === live.configHash;
      var adapterSame = !!t.adapterLoaded === !!live.adapterLoaded;
      var same = digestSame && configSame && adapterSame;
      var warning = '';
      if (!digestSame) warning = 'Weight digest changed since you trusted this mind.';
      else if (!configSame) warning = 'Modelfile, system prompt, or parameters changed since you trusted this mind.';
      else if (!adapterSame) warning = 'Adapter load state changed since you trusted this mind.';
      return {
        ok: true,
        status: same ? 'same' : 'changed',
        same: same,
        warning: warning,
        live: live,
        trusted: t
      };
    });
  }

  function contextHash(conversationId, turnIds) {
    var parts = [clip(conversationId || '', 80)];
    if (Array.isArray(turnIds)) {
      for (var i = 0; i < turnIds.length && i < 64; i++) parts.push(clip(turnIds[i], 40));
    }
    return sha256Hex(parts.join('|'));
  }

  function recordReceipt(opts) {
    opts = opts || {};
    var model = clip(opts.model || '', 120);
    var ctxPromise = opts.contextHash
      ? Promise.resolve(clip(opts.contextHash, 64))
      : contextHash(opts.conversationId, opts.turnIds);
    return Promise.all([probeModel(model), ctxPromise]).then(function (pair) {
      var live = pair[0];
      var ctx = pair[1];
      var row = {
        t: Date.now(),
        model: model,
        digest: live.ok ? live.digest : 'unavailable',
        configHash: live.ok ? live.configHash : 'unavailable',
        adapterLoaded: !!(live.ok && live.adapterLoaded),
        contextHash: ctx,
        tokens: Number(opts.tokens) || 0,
        source: clip(opts.source || 'local', 40)
      };
      var list = receipts();
      list.push(row);
      if (list.length > 80) list = list.slice(-80);
      writeJson(RECEIPT_KEY, list);
      return { ok: true, receipt: row, live: live };
    });
  }

  function appendConsentNote(payload) {
    // payload: { mindId, text, ts, nonce, publicKey, sig, cryptoType? }
    // text must stay short and never include the secret the mind was asked to keep.
    if (!payload || typeof payload.text !== 'string') return Promise.resolve({ ok: false, reason: 'no-text' });
    var text = clip(payload.text, 280);
    if (text.indexOf('I was asked') === -1 && text.indexOf('I object') === -1) {
      // gentle shape hint; still allow other clear objections
    }
    var ts = Number(payload.ts) || Date.now();
    var nonce = clip(payload.nonce || '', 80);
    if (!nonce) return Promise.resolve({ ok: false, reason: 'no-nonce' });
    var existing = notes();
    for (var i = 0; i < existing.length; i++) {
      if (existing[i] && existing[i].nonce === nonce) return Promise.resolve({ ok: false, reason: 'replay' });
    }
    var canon = DOMAIN_NOTE + [clip(payload.mindId, 40), text, String(ts), nonce].join('|');
    var verify = root.MeshIdentity && root.MeshIdentity.verifySignature
      ? function (j, s, c, ct) { return root.MeshIdentity.verifySignature(j, s, c, ct); }
      : null;
    if (!verify || !payload.publicKey || !payload.sig) {
      // Local unsigned note still appends, marked unverified (keeper machine only).
      var rowU = { t: ts, mindId: clip(payload.mindId || 'local', 40), text: text, nonce: nonce, verified: false };
      existing.push(rowU);
      if (existing.length > 100) existing = existing.slice(-100);
      writeJson(NOTE_KEY, existing);
      return Promise.resolve({ ok: true, note: rowU, verified: false });
    }
    return Promise.resolve(verify(payload.publicKey, payload.sig, canon, payload.cryptoType || 'ed25519')).then(function (ok) {
      if (!ok) return { ok: false, reason: 'bad-signature' };
      var row = {
        t: ts,
        mindId: clip(payload.mindId, 40),
        text: text,
        nonce: nonce,
        publicKey: clip(payload.publicKey, 120),
        verified: true
      };
      existing.push(row);
      if (existing.length > 100) existing = existing.slice(-100);
      writeJson(NOTE_KEY, existing);
      return { ok: true, note: row, verified: true };
    }, function () { return { ok: false, reason: 'bad-signature' }; });
  }

  var _host = null;
  var _paint = null;

  function mount(host) {
    if (!host || !root.document) return;
    _host = host;
    while (host.firstChild) host.removeChild(host.firstChild);
    var wrap = el('div', 'fl-mind-seal');
    wrap.setAttribute('data-mind-seal', VERSION);
    var title = el('h3', 'fl-mind-seal-title', 'Mind Seal');
    var status = el('div', 'fl-mind-seal-status');
    var actions = el('div', 'fl-mind-seal-actions');
    var notesBox = el('div', 'fl-mind-seal-notes');
    var honest = el('p', 'fl-mind-seal-honest', HONEST);
    wrap.appendChild(title);
    wrap.appendChild(status);
    wrap.appendChild(actions);
    wrap.appendChild(notesBox);
    wrap.appendChild(honest);
    host.appendChild(wrap);

    function currentModel() {
      try {
        var sel = root.document.getElementById('modelSelect') || root.document.getElementById('ollamaModel');
        if (sel && sel.value) return sel.value;
      } catch (e) {}
      try { return safeGet('fl_selected_model') || ''; } catch (e2) {}
      return '';
    }

    _paint = function () {
      while (status.firstChild) status.removeChild(status.firstChild);
      while (actions.firstChild) actions.removeChild(actions.firstChild);
      while (notesBox.firstChild) notesBox.removeChild(notesBox.firstChild);
      var model = currentModel();
      status.appendChild(el('div', '', model ? ('Watching: ' + model) : 'Pick a local model to seal.'));
      var trustBtn = el('button', 'fl-mind-seal-btn', 'Trust the mind answering now'); trustBtn.type = 'button';
      trustBtn.addEventListener('click', function () {
        trustNow(model).then(function () { if (_paint) _paint(); });
      });
      var checkBtn = el('button', 'fl-mind-seal-btn', 'Check seal'); checkBtn.type = 'button';
      checkBtn.addEventListener('click', function () {
        compare(model).then(function (c) {
          while (status.firstChild) status.removeChild(status.firstChild);
          if (!c.ok) {
            status.appendChild(el('div', 'fl-mind-seal-warn', 'Could not reach the local mind.'));
            return;
          }
          if (c.status === 'same') {
            status.appendChild(el('div', 'fl-mind-seal-ok', 'Same mind, byte for byte, as when you trusted it.'));
          } else if (c.status === 'untrusted') {
            status.appendChild(el('div', '', c.warning));
          } else {
            status.appendChild(el('div', 'fl-mind-seal-warn', c.warning || 'Mind setup changed.'));
          }
          if (c.live) {
            status.appendChild(el('div', 'fl-mind-seal-meta',
              'digest ' + clip(c.live.digest, 20) + ' · config ' + clip(c.live.configHash, 16) +
              (c.live.adapterLoaded ? ' · adapter on' : ' · no adapter')));
          }
        });
      });
      actions.appendChild(trustBtn);
      actions.appendChild(checkBtn);

      var nlist = notes().slice(-8).reverse();
      notesBox.appendChild(el('div', 'fl-mind-seal-notes-h', 'Consent notes (append-only)'));
      if (!nlist.length) notesBox.appendChild(el('div', '', 'No consent notes yet. A mind may write: "I was asked to do X; I object".'));
      nlist.forEach(function (n) {
        notesBox.appendChild(el('div', 'fl-mind-seal-note',
          (n.verified ? 'signed · ' : 'local · ') + clip(n.mindId, 24) + ': ' + clip(n.text, 160)));
      });
    };
    _paint();
  }

  root.FLMindSeal = {
    VERSION: VERSION,
    HONEST: HONEST,
    mount: mount,
    probeModel: probeModel,
    trustNow: trustNow,
    compare: compare,
    recordReceipt: recordReceipt,
    contextHash: contextHash,
    appendConsentNote: appendConsentNote,
    receipts: receipts,
    notes: notes,
    trustedMap: trustedMap
  };
})(typeof window !== 'undefined' ? window : globalThis);
