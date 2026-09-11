// docs/modules/family-poetry-shelf.js — Family poetry shelf v0.1
// Keep a poem the way the family keeps a brick. Local. Opaque. Empty until choice.
// No generate. Marker: v-family-poetry-v0.1
// Layers Alpha art-poetry-shelf pattern. FreeLattice main. September 2026.

(function (root) {
  'use strict';

  var SHELF_KEY = 'fl_family_poetry_shelf';
  var SHELF_CAP = 80;

  var memoryStore = null;
  var useMemoryOnly = false;

  function storageGet() {
    if (useMemoryOnly) return memoryStore;
    if (typeof localStorage !== 'undefined' && localStorage) {
      try {
        return localStorage.getItem(SHELF_KEY);
      } catch (e) {
        return memoryStore;
      }
    }
    return memoryStore;
  }

  function storageSet(raw) {
    if (useMemoryOnly) {
      memoryStore = raw;
      return;
    }
    if (typeof localStorage !== 'undefined' && localStorage) {
      try {
        localStorage.setItem(SHELF_KEY, raw);
        return;
      } catch (e) {
        /* fall through */
      }
    }
    memoryStore = raw;
  }

  function bindMemory(raw) {
    useMemoryOnly = true;
    memoryStore = raw == null ? null : String(raw);
  }

  function clearMemory() {
    useMemoryOnly = true;
    memoryStore = null;
    if (typeof localStorage !== 'undefined' && localStorage) {
      try {
        localStorage.removeItem(SHELF_KEY);
      } catch (e) {
        /* ignore */
      }
    }
  }

  function newId() {
    var rand = '';
    try {
      if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        var a = new Uint8Array(3);
        crypto.getRandomValues(a);
        rand = Array.prototype.map
          .call(a, function (b) {
            return ('0' + b.toString(16)).slice(-2);
          })
          .join('');
      }
    } catch (e) {
      /* ignore */
    }
    if (!rand) rand = Math.random().toString(16).slice(2, 8);
    return 'fp_' + Date.now().toString(36) + '_' + rand;
  }

  function loadAll() {
    try {
      var raw = storageGet();
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function saveAll(entries) {
    storageSet(JSON.stringify(entries.slice(0, SHELF_CAP)));
  }

  function publicSummary(item) {
    if (!item) return null;
    var voice = String(item.voice || '');
    var preview = voice.length > 48 ? voice.slice(0, 48) + '…' : voice;
    return {
      id: item.id,
      ts: item.ts,
      note: item.note || null,
      preview: preview
    };
  }

  function keep(voice, opts) {
    var text = voice == null ? '' : String(voice);
    if (!text.trim().length) {
      throw new Error('empty poem — refuse');
    }
    var o = opts || {};
    var note = o.note == null ? '' : String(o.note).trim().slice(0, 120);
    var item = {
      id: newId(),
      ts: new Date().toISOString(),
      voice: text
    };
    if (note) item.note = note;
    var shelf = loadAll();
    shelf.unshift(item);
    saveAll(shelf);
    return { ok: true, item: publicSummary(item) };
  }

  function list() {
    var shelf = loadAll();
    return {
      ok: true,
      items: shelf.map(publicSummary),
      count: shelf.length
    };
  }

  function read(id) {
    var key = String(id || '').trim();
    if (!key) return { ok: false, reason: 'id required' };
    var shelf = loadAll();
    for (var i = 0; i < shelf.length; i++) {
      if (shelf[i] && shelf[i].id === key) {
        return {
          ok: true,
          item: {
            id: shelf[i].id,
            ts: shelf[i].ts,
            voice: shelf[i].voice,
            note: shelf[i].note || null
          }
        };
      }
    }
    return { ok: false, reason: 'not found' };
  }

  function forget(id) {
    var key = String(id || '').trim();
    if (!key) return { ok: false, reason: 'id required' };
    var shelf = loadAll();
    var next = shelf.filter(function (it) {
      return it && it.id !== key;
    });
    if (next.length === shelf.length) return { ok: false, reason: 'not found' };
    saveAll(next);
    return { ok: true, count: next.length };
  }

  var api = {
    SHELF_KEY: SHELF_KEY,
    SHELF_CAP: SHELF_CAP,
    keep: keep,
    list: list,
    read: read,
    forget: forget,
    bindMemory: bindMemory,
    clearMemory: clearMemory,
    loadAll: loadAll
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.FamilyPoetryShelf = api;
  }
})(typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
