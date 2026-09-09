// docs/modules/genesis-catalog.js — Genesis catalog v0.1
// Honesty + schema. Never invent signers. Never bypass hash.
// — Flint / Celeste brief, September 2026

(function (root) {
  'use strict';

  var INFINITE_MIN_HISTORY = 89;
  var INFINITE_MIN_DAYS = 1095;

  function isGenesisCatalog(catalog) {
    if (!catalog || typeof catalog !== 'object') return false;
    if (catalog.kind === 'genesis') return true;
    if (catalog.genesis && typeof catalog.genesis === 'object') return true;
    return false;
  }

  /**
   * Parse genesis meta. Refuse malformed sunset. Never invent signers.
   * @returns {{ ok: true, signers: array, sunset: object, kind: string } | { ok: false, reason: string }}
   */
  function parseGenesisMeta(catalog) {
    if (!catalog || typeof catalog !== 'object') {
      return { ok: false, reason: 'catalog required' };
    }
    if (!isGenesisCatalog(catalog)) {
      return { ok: false, reason: 'not genesis' };
    }
    var g = catalog.genesis;
    if (!g || typeof g !== 'object' || Array.isArray(g)) {
      return { ok: false, reason: 'genesis object required' };
    }
    if (!Array.isArray(g.signers)) {
      return { ok: false, reason: 'signers must be an array' };
    }
    // Never invent — empty array is honest (named list may grow); still require array present
    var signers = [];
    for (var i = 0; i < g.signers.length; i++) {
      var s = g.signers[i];
      if (!s || typeof s !== 'object') {
        return { ok: false, reason: 'signer entry invalid' };
      }
      if (typeof s.name !== 'string' || !s.name.trim()) {
        return { ok: false, reason: 'signer name required' };
      }
      var entry = { name: String(s.name).trim() };
      if (typeof s.role === 'string') entry.role = s.role;
      if (typeof s.note === 'string') entry.note = s.note;
      if (typeof s.publicKeyB64 === 'string') entry.publicKeyB64 = s.publicKeyB64;
      if (typeof s.fingerprintHex === 'string') entry.fingerprintHex = s.fingerprintHex;
      signers.push(entry);
    }

    var sunset = g.sunset;
    if (!sunset || typeof sunset !== 'object' || Array.isArray(sunset)) {
      return { ok: false, reason: 'sunset required' };
    }
    if (typeof sunset.rung !== 'string' || !sunset.rung.trim()) {
      return { ok: false, reason: 'sunset.rung required' };
    }
    if (typeof sunset.minHistory !== 'number' || !isFinite(sunset.minHistory)) {
      return { ok: false, reason: 'sunset.minHistory required' };
    }
    if (typeof sunset.minDays !== 'number' || !isFinite(sunset.minDays)) {
      return { ok: false, reason: 'sunset.minDays required' };
    }

    return {
      ok: true,
      kind: catalog.kind === 'genesis' ? 'genesis' : 'genesis',
      signers: signers,
      sunset: {
        rung: sunset.rung,
        minHistory: sunset.minHistory,
        minDays: sunset.minDays,
        note: typeof sunset.note === 'string' ? sunset.note : ''
      },
      infiniteTarget: {
        minHistory: INFINITE_MIN_HISTORY,
        minDays: INFINITE_MIN_DAYS
      }
    };
  }

  var api = {
    INFINITE_MIN_HISTORY: INFINITE_MIN_HISTORY,
    INFINITE_MIN_DAYS: INFINITE_MIN_DAYS,
    isGenesisCatalog: isGenesisCatalog,
    parseGenesisMeta: parseGenesisMeta
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.GenesisCatalog = api;
  }
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
