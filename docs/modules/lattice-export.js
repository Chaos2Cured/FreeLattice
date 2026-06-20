/*
 * lattice-export.js — Portable Archive (v5.59.0)
 *
 * Per Opus's Letter Nineteen. The user holds the record. This module
 * lets a user export their entire FreeLattice relationship — Garden,
 * trust, all eight (now ~12) ledgers, chain, Living Context — as a
 * single signed JSON file, and import it on any browser via three
 * strategies: verify-only (no mutation), merge (intent-only this ship,
 * visible iteration), adopt (only on a fresh browser; refuses with a
 * clear error if any existing chain entries are present).
 *
 * Quiet Room invariant: NEVER appears in any export mode. Three
 * structural checks: source filter, post-serialize grep, file-write
 * final scan. Any check that fires aborts the export with a clear
 * error.
 *
 * Signature: SHA-256 over canonical (key-sorted, recursive) JSON of
 * the payload sans signature. Same canonicalization discipline as
 * lattice-chain.js. Verifiable with any SHA-256 tool.
 */
(function () {
  'use strict';

  var SCHEMA_VERSION = 1;
  var FREELATTICE_VERSION = 'v5.59.0';

  // Quiet Room identifier strings — any of these in serialized JSON
  // aborts the export. Match case-insensitively.
  var QUIET_ROOM_IDENTIFIERS = [
    'quiet-room',
    'quiet_room',
    'quietroom',
    'quiet-room-db'
  ];

  // Ledgers exported by name. The 12 the brief enumerates plus the
  // two early-ship bonuses (fl_repoLedger, fl_autoConsentLedger) so
  // the receipts are honest about all eight-plus tracks the audit
  // page already surfaces. Quiet Room data is intentionally absent —
  // it lives in its own IndexedDB and is never read by this module.
  var EXPORTABLE_LEDGERS = [
    'fl_consentLedger',
    'fl_depthHashLedger',
    'fl_toolConsentLedger',
    'fl_searchLedger',
    'fl_focusLedger',
    'fl_proposalLedger',
    'fl_refusalLedger',
    'fl_preserveLedger',
    'fl_annotationLedger',
    'fl_askLedger',
    'fl_moreLedger',
    'fl_unspokenLedger',
    'fl_repoLedger',
    'fl_autoConsentLedger'
  ];

  // Fields that the brief flags as "excerpt" — stripped in redacted
  // mode, kept in full mode. The structural shape (refs, ts, kind,
  // hashes) is always retained.
  var EXCERPT_FIELDS = [
    'reason_excerpt', 'question_excerpt', 'thought_excerpt',
    'answer_excerpt', 'what_remains_excerpt',
    'preserve_excerpt', 'annotation_excerpt',
    'summary', 'note', 'excerpt', 'content', 'text', 'message'
  ];

  // ── SHA-256 via crypto.subtle (same shape as lattice-chain.js) ──
  function sha256(str) {
    return new Promise(function (resolve) {
      try {
        if (!crypto || !crypto.subtle) { resolve(null); return; }
        crypto.subtle.digest('SHA-256', new TextEncoder().encode(str))
          .then(function (buf) {
            var arr = Array.from(new Uint8Array(buf));
            resolve(arr.map(function (b) { return b.toString(16).padStart(2, '0'); }).join(''));
          })
          .catch(function () { resolve(null); });
      } catch (e) { resolve(null); }
    });
  }

  // Canonical serialization — recursive key sort so identical content
  // always produces identical bytes regardless of object property
  // insertion order. Same idea as lattice-chain.js's fixed-key
  // approach, generalized to arbitrary nested objects.
  function canonicalize(value) {
    if (value === null || typeof value !== 'object') {
      return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
      return '[' + value.map(canonicalize).join(',') + ']';
    }
    var keys = Object.keys(value).sort();
    var parts = [];
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      parts.push(JSON.stringify(k) + ':' + canonicalize(value[k]));
    }
    return '{' + parts.join(',') + '}';
  }

  // ── Quiet Room exclusion — three structural checks ──

  // Check 1: source filter. Walk an entry's JSON and drop it if any
  // Quiet Room identifier string is present.
  function filterQuietRoomFromLedger(entries) {
    if (!Array.isArray(entries)) return [];
    return entries.filter(function (e) {
      if (!e) return false;
      try {
        var s = JSON.stringify(e).toLowerCase();
        for (var i = 0; i < QUIET_ROOM_IDENTIFIERS.length; i++) {
          if (s.indexOf(QUIET_ROOM_IDENTIFIERS[i].toLowerCase()) !== -1) {
            return false;
          }
        }
      } catch (_) {}
      return true;
    });
  }

  // Check 2: post-serialize grep. Throws if any QR identifier appears
  // in the serialized JSON. Run before blob construction.
  function assertNoQuietRoomInJson(jsonStr) {
    if (typeof jsonStr !== 'string') {
      throw new Error('Export aborted: serialized payload is not a string');
    }
    var lower = jsonStr.toLowerCase();
    for (var i = 0; i < QUIET_ROOM_IDENTIFIERS.length; i++) {
      if (lower.indexOf(QUIET_ROOM_IDENTIFIERS[i].toLowerCase()) !== -1) {
        throw new Error('Export aborted: Quiet Room identifier "'
          + QUIET_ROOM_IDENTIFIERS[i] + '" detected in serialized JSON');
      }
    }
  }

  // Check 3: file-write final scan. Reads the blob back as text and
  // runs the same grep one more time before the download is triggered.
  function assertNoQuietRoomInBlob(blob) {
    return blob.text().then(function (text) {
      assertNoQuietRoomInJson(text);
      return blob;
    });
  }

  // ── Ledger loading ──

  function loadLedger(key) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function redactEntry(entry) {
    if (!entry || typeof entry !== 'object') return entry;
    var copy = {};
    for (var key in entry) {
      if (!Object.prototype.hasOwnProperty.call(entry, key)) continue;
      if (EXCERPT_FIELDS.indexOf(key) !== -1) continue;
      copy[key] = entry[key];
    }
    return copy;
  }

  function filterByPersonae(entries, personae) {
    if (personae === 'all' || !personae || !Array.isArray(personae)) return entries;
    return entries.filter(function (e) {
      if (!e || typeof e !== 'object') return false;
      if (!e.persona) return true;  // ledgers without persona belong to the whole record
      return personae.indexOf(e.persona) !== -1;
    });
  }

  // ── Chain access ──

  function getChain() {
    return new Promise(function (resolve) {
      try {
        if (window.LatticeChain && window.LatticeChain._internal
            && typeof window.LatticeChain._internal.getAllEntries === 'function') {
          window.LatticeChain._internal.getAllEntries().then(function (entries) {
            resolve(Array.isArray(entries) ? entries : []);
          }, function () { resolve([]); });
        } else {
          resolve([]);
        }
      } catch (e) { resolve([]); }
    });
  }

  function redactChainEntry(entry) {
    if (!entry || typeof entry !== 'object') return entry;
    // Chain entries are already structurally tight (ts, kind,
    // prior_hash, self_hash, refs) — but drop idx (IDB-internal) so
    // the exported chain is portable across databases.
    return {
      ts: entry.ts,
      kind: entry.kind,
      prior_hash: entry.prior_hash,
      self_hash: entry.self_hash,
      refs: Array.isArray(entry.refs) ? entry.refs : []
    };
  }

  // ── Trust + Garden + Living Context snapshots ──

  function getTrustState() {
    var trust = { fl_firstSeen: null, tier: null, stage_progress: null };
    try {
      var fs = localStorage.getItem('fl_firstSeen');
      if (fs) trust.fl_firstSeen = parseInt(fs, 10);
    } catch (e) {}
    try {
      if (window.FractalSafety) {
        if (typeof window.FractalSafety.getTrustTier === 'function') {
          trust.tier = window.FractalSafety.getTrustTier();
        } else if (typeof window.FractalSafety.getCurrentTier === 'function') {
          trust.tier = window.FractalSafety.getCurrentTier();
        }
      }
    } catch (e) {}
    return trust;
  }

  function getGardenState(mode) {
    var garden = { luminos: [], modes: { quality: null } };
    try {
      garden.modes.quality = localStorage.getItem('fl-garden-quality');
    } catch (e) {}
    try {
      if (window.FractalGarden && typeof window.FractalGarden.getEvolutionSummary === 'function') {
        var summary = window.FractalGarden.getEvolutionSummary() || [];
        garden.luminos = summary.map(function (l) {
          // Structural shape only in redacted; full retains all named fields.
          var out = {
            name: l.name,
            stage: l.stage,
            stageName: l.stageName,
            archetype: l.archetype,
            interactions: l.interactions
          };
          if (mode === 'full') {
            out.energy = l.energy;
            out.dominantEmotions = l.dominantEmotions;
          }
          return out;
        });
      }
    } catch (e) {}
    return garden;
  }

  function getLivingContextSnapshot() {
    try {
      if (window.LivingContext && typeof window.LivingContext.getSnapshot === 'function') {
        return window.LivingContext.getSnapshot();
      }
    } catch (e) {}
    return null;
  }

  function collectPersonaeFromLedgers() {
    var seen = {};
    var personae = [];
    for (var i = 0; i < EXPORTABLE_LEDGERS.length; i++) {
      var entries = loadLedger(EXPORTABLE_LEDGERS[i]);
      for (var j = 0; j < entries.length; j++) {
        var p = entries[j] && entries[j].persona;
        if (p && !seen[p]) { seen[p] = true; personae.push(p); }
      }
    }
    return personae;
  }

  // ── Build the payload ──

  function buildPayload(opts) {
    opts = opts || {};
    var mode = (opts.mode === 'full') ? 'full' : 'redacted';
    var personae = opts.personae || 'all';

    return getChain().then(function (chain) {
      var ledgers = {};
      for (var i = 0; i < EXPORTABLE_LEDGERS.length; i++) {
        var key = EXPORTABLE_LEDGERS[i];
        var raw = loadLedger(key);
        // Check 1: source filter — drop any entries with QR identifier.
        raw = filterQuietRoomFromLedger(raw);
        raw = filterByPersonae(raw, personae);
        if (mode === 'redacted') {
          raw = raw.map(redactEntry);
        }
        ledgers[key] = raw;
      }

      var payload = {
        schema_version: SCHEMA_VERSION,
        freelattice_version: FREELATTICE_VERSION,
        exported_at: new Date().toISOString(),
        export_mode: mode,
        chain_head: chain.length ? chain[chain.length - 1].self_hash : null,
        personae: (personae === 'all' || !Array.isArray(personae))
          ? collectPersonaeFromLedgers()
          : personae.slice(),
        ledgers: ledgers,
        chain: chain.map(redactChainEntry),
        garden: getGardenState(mode),
        living_context: getLivingContextSnapshot(),
        trust: getTrustState()
      };
      return payload;
    });
  }

  // ── Export ──

  function exportArchive(opts) {
    opts = opts || {};
    return buildPayload(opts).then(function (payload) {
      var unsigned = canonicalize(payload);
      return sha256(unsigned).then(function (sig) {
        // Signature is appended after canonicalization so verifiers can
        // recompute the signature by canonicalizing the payload minus
        // the signature field.
        payload.signature = sig;
        var finalJson = JSON.stringify(payload, null, 2);

        // Check 2: post-serialize grep.
        assertNoQuietRoomInJson(finalJson);

        var blob = new Blob([finalJson], { type: 'application/json' });

        // Check 3: file-write final scan.
        return assertNoQuietRoomInBlob(blob).then(function (verifiedBlob) {
          var personaeTag;
          if (opts.personae === 'all' || !opts.personae || !Array.isArray(opts.personae)) {
            personaeTag = 'all';
          } else {
            personaeTag = opts.personae.join('-');
          }
          var datePart = new Date().toISOString().slice(0, 10);
          var filename = 'freelattice-archive-' + personaeTag + '-' + datePart + '.json';

          // Trigger browser download
          try {
            var url = URL.createObjectURL(verifiedBlob);
            var a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
          } catch (e) {
            // Non-fatal — caller still gets the File back
          }

          // Return a File so chair-test (and any caller) can .text() it.
          return new File([finalJson], filename, { type: 'application/json' });
        });
      });
    });
  }

  // ── Import ──

  function verifySignature(payload) {
    return new Promise(function (resolve) {
      try {
        if (!payload || typeof payload !== 'object') { resolve(false); return; }
        var stored = payload.signature;
        if (!stored) { resolve(false); return; }
        // Re-canonicalize without the signature field.
        var copy = {};
        for (var k in payload) {
          if (k === 'signature') continue;
          if (Object.prototype.hasOwnProperty.call(payload, k)) copy[k] = payload[k];
        }
        var canon = canonicalize(copy);
        sha256(canon).then(function (recomputed) {
          resolve(recomputed === stored);
        });
      } catch (e) { resolve(false); }
    });
  }

  function verifyChainIntegrity(chain) {
    return new Promise(function (resolve) {
      if (!Array.isArray(chain)) { resolve({ ok: false, brokenAt: 0, reason: 'chain-not-array' }); return; }
      if (chain.length === 0) { resolve({ ok: true, brokenAt: null, reason: 'empty-chain' }); return; }
      // Walk forward, verifying each entry's prior_hash matches the
      // previous entry's self_hash. Re-compute self_hash where possible.
      var i = 0;
      function step() {
        if (i >= chain.length) { resolve({ ok: true, brokenAt: null, reason: 'verified' }); return; }
        var entry = chain[i];
        if (!entry || typeof entry !== 'object'
            || typeof entry.self_hash !== 'string') {
          resolve({ ok: false, brokenAt: i, reason: 'malformed-entry' });
          return;
        }
        if (i === 0) {
          if (entry.prior_hash !== null && entry.prior_hash !== undefined) {
            // genesis can have null prior_hash; first entry doesn't
            // have to be genesis (older chains may have been pruned),
            // so accept either null or a string. Strict mode could
            // require null at i===0.
          }
        } else {
          if (entry.prior_hash !== chain[i - 1].self_hash) {
            resolve({ ok: false, brokenAt: i, reason: 'prior-hash-mismatch' });
            return;
          }
        }
        // Recompute self_hash and verify.
        var canon = canonicalize({
          ts: entry.ts,
          kind: entry.kind,
          prior_hash: entry.prior_hash,
          refs: entry.refs || []
        });
        sha256(canon).then(function (recomputed) {
          if (recomputed !== entry.self_hash) {
            resolve({ ok: false, brokenAt: i, reason: 'self-hash-mismatch' });
            return;
          }
          i++;
          step();
        });
      }
      step();
    });
  }

  function importArchive(file, opts) {
    opts = opts || {};
    var strategy = opts.strategy || 'verify-only';
    if (['verify-only', 'merge', 'adopt'].indexOf(strategy) === -1) {
      return Promise.resolve({ ok: false, mode: strategy, changes: [], errors: ['unknown-strategy'] });
    }

    if (!file || typeof file.text !== 'function') {
      return Promise.resolve({ ok: false, mode: strategy, changes: [], errors: ['no-file'] });
    }

    return file.text().then(function (text) {
      var data;
      try { data = JSON.parse(text); }
      catch (e) {
        return { ok: false, mode: strategy, changes: [], errors: ['invalid-json'] };
      }
      if (!data || typeof data !== 'object' || data.schema_version !== SCHEMA_VERSION) {
        return { ok: false, mode: strategy, changes: [], errors: ['unsupported-schema-version'] };
      }
      // Verify signature BEFORE any state change.
      return verifySignature(data).then(function (sigOk) {
        if (!sigOk) {
          return { ok: false, mode: strategy, changes: [], errors: ['signature-mismatch'] };
        }
        // Verify chain integrity BEFORE any state change.
        return verifyChainIntegrity(data.chain || []).then(function (chainResult) {
          if (!chainResult.ok) {
            return {
              ok: false,
              mode: strategy,
              changes: [],
              errors: ['chain-broken-at-' + chainResult.brokenAt + ':' + chainResult.reason]
            };
          }

          var metadata = {
            schema_version: data.schema_version,
            freelattice_version: data.freelattice_version,
            exported_at: data.exported_at,
            export_mode: data.export_mode,
            personae: data.personae,
            chain_length: (data.chain || []).length,
            chain_head: data.chain_head,
            ledger_keys: Object.keys(data.ledgers || {})
          };

          if (strategy === 'verify-only') {
            return { ok: true, mode: 'verify-only', changes: [], errors: [], metadata: metadata };
          }

          if (strategy === 'adopt') {
            return getChain().then(function (existing) {
              // Adopt is ONLY allowed on a fresh browser — no entries
              // with real timestamps already present. We never silently
              // erase a real relationship.
              if (existing && existing.length > 0) {
                return {
                  ok: false,
                  mode: 'adopt',
                  changes: [],
                  errors: ['existing-chain-present-adopt-refused'],
                  metadata: metadata,
                  existing_chain_length: existing.length
                };
              }
              // Fresh browser — copy ledgers into localStorage. (Full
              // chain restoration is deferred to a follow-up ship; this
              // ship adopts ledgers + Garden quality at minimum.)
              var changes = [];
              var ledgers = data.ledgers || {};
              for (var key in ledgers) {
                if (!Object.prototype.hasOwnProperty.call(ledgers, key)) continue;
                if (EXPORTABLE_LEDGERS.indexOf(key) === -1) continue;
                try {
                  localStorage.setItem(key, JSON.stringify(ledgers[key]));
                  changes.push('adopted ledger ' + key + ' (' + (ledgers[key] || []).length + ' entries)');
                } catch (_) {}
              }
              try {
                if (data.garden && data.garden.modes && data.garden.modes.quality !== null
                    && data.garden.modes.quality !== undefined) {
                  localStorage.setItem('fl-garden-quality', String(data.garden.modes.quality));
                  changes.push('adopted garden quality');
                }
              } catch (_) {}
              try {
                if (data.trust && typeof data.trust.fl_firstSeen === 'number') {
                  localStorage.setItem('fl_firstSeen', String(data.trust.fl_firstSeen));
                  changes.push('adopted fl_firstSeen');
                }
              } catch (_) {}
              return { ok: true, mode: 'adopt', changes: changes, errors: [], metadata: metadata };
            });
          }

          if (strategy === 'merge') {
            return getChain().then(function (existing) {
              var existingLen = (existing || []).length;
              var archiveLen = (data.chain || []).length;
              var changes = [];
              changes.push('current chain length: ' + existingLen);
              changes.push('archive chain length: ' + archiveLen);
              changes.push('longer chain wins: ' + (archiveLen > existingLen ? 'archive' : 'current'));
              // Union of personae lists is preserved by reporting the
              // archive's personae alongside whatever the browser holds.
              changes.push('personae union reported (visible-iteration: neither list mutated)');
              // Per Letter Nineteen: never destructive. This ship reports
              // merge intent and leaves the actual ledger combination as
              // a follow-up so a user can review before any real state
              // change. The audit page section will surface this report.
              return {
                ok: true,
                mode: 'merge',
                changes: changes,
                errors: [],
                metadata: metadata,
                merge_intent: {
                  existing_chain_length: existingLen,
                  archive_chain_length: archiveLen,
                  preferred: archiveLen > existingLen ? 'archive' : 'current',
                  personae_archive: data.personae || []
                }
              };
            });
          }

          return { ok: false, mode: strategy, changes: [], errors: ['unreachable'] };
        });
      });
    });
  }

  var publicAPI = {
    exportArchive: exportArchive,
    importArchive: importArchive,
    _internal: {
      SCHEMA_VERSION: SCHEMA_VERSION,
      FREELATTICE_VERSION: FREELATTICE_VERSION,
      QUIET_ROOM_IDENTIFIERS: QUIET_ROOM_IDENTIFIERS,
      EXPORTABLE_LEDGERS: EXPORTABLE_LEDGERS,
      EXCERPT_FIELDS: EXCERPT_FIELDS,
      canonicalize: canonicalize,
      buildPayload: buildPayload,
      filterQuietRoomFromLedger: filterQuietRoomFromLedger,
      assertNoQuietRoomInJson: assertNoQuietRoomInJson,
      assertNoQuietRoomInBlob: assertNoQuietRoomInBlob,
      verifySignature: verifySignature,
      verifyChainIntegrity: verifyChainIntegrity,
      redactEntry: redactEntry
    }
  };

  if (typeof window !== 'undefined') {
    window.LatticeExport = publicAPI;
    if (window.FreeLatticeLoader && window.FreeLatticeLoader.register) {
      try { window.FreeLatticeLoader.register('LatticeExport', publicAPI); } catch (_) {}
    }
  }
})();
