// docs/modules/phone-swarm.js — Phone / browser swarm v0.1
// Pull + SHA-256 before trust. OPFS/IDB store. No Import to Ollama. No re-seed.
// Desktop lattice-swarm.js unchanged. Never auto-pull. Never auto-seed.
// — Flint / Celeste brief, September 2026

(function (root) {
  'use strict';

  /** @type {Map<string, object>} */
  var jobs = typeof Map !== 'undefined' ? new Map() : null;
  if (!jobs) {
    // Extremely old hosts — fail closed with a tiny shim
    var _store = {};
    jobs = {
      set: function (k, v) { _store[k] = v; },
      get: function (k) { return _store[k]; },
      has: function (k) { return Object.prototype.hasOwnProperty.call(_store, k); },
      delete: function (k) { delete _store[k]; },
      forEach: function (fn) {
        for (var k in _store) {
          if (Object.prototype.hasOwnProperty.call(_store, k)) fn(_store[k], k);
        }
      }
    };
  }

  var WebTorrentCtor = null;
  var wtClient = null;
  var wtLoadPromise = null;

  // Pinned browser build. SRI optional — fail closed if load fails.
  var WT_CDN = 'https://cdn.jsdelivr.net/npm/webtorrent@2.6.3/dist/webtorrent.min.js';
  var WT_SRI = ''; // leave empty when tag drifts; integrity checked by host CSP when set

  var DESKTOP_HINT =
    'Swarm pull needs a modern browser (or Desktop). Import to Ollama stays on Desktop.';

  // v0.2 Quillan: Metronet-safe — HTTPS-first, torrent opt-in fallback.
  // Mirrors desktop/lattice-swarm.js transport. Browser uses localStorage
  // flags FL_NO_TORRENT / FL_TRANSPORT so Metronet users can hard-disable
  // torrent (no DHT/tracker packets). Default https+torrent-fallback.
  function getTransportMode() {
    try {
      var raw = (typeof localStorage !== 'undefined' ? localStorage.getItem('FL_TRANSPORT') : '') || '';
      raw = String(raw).trim().toLowerCase();
      var noTor = (typeof localStorage !== 'undefined' ? localStorage.getItem('FL_NO_TORRENT') : '') || '';
      // also honor process env when running under Node smoke
      if (typeof process !== 'undefined' && process.env) {
        if (!raw && process.env.FL_TRANSPORT) raw = String(process.env.FL_TRANSPORT).trim().toLowerCase();
        if (!String(noTor).trim() && process.env.FL_NO_TORRENT) noTor = String(process.env.FL_NO_TORRENT).trim().toLowerCase();
      }
      noTor = String(noTor).trim().toLowerCase();
      if (raw === 'https-only' || raw === 'webseed-only' || raw === 'https') return 'https-only';
      if (raw === 'https+torrent-fallback' || raw === 'https+torrent' || raw === 'fallback') return 'https+torrent-fallback';
      if (raw === 'torrent-first' || raw === 'magnet-first' || raw === 'legacy') return 'torrent-first';
      if (noTor === '1' || noTor === 'true' || noTor === 'yes' || noTor === 'on') return 'https-only';
      return 'https+torrent-fallback';
    } catch(e) { return 'https+torrent-fallback'; }
  }
  function isTorrentDisabled() { return getTransportMode() === 'https-only'; }
  function isTorrentAllowed() { return !isTorrentDisabled(); }

  function isZeroHash(sha) {
    var s = String(sha || '').trim().toLowerCase();
    return !s || /^0+$/.test(s);
  }

  function isExampleRow(opts) {
    var o = opts || {};
    var notes = String(o.notes || '');
    if (/EXAMPLE ONLY/i.test(notes)) return true;
    if (isZeroHash(o.expectedSha256 || o.sha256)) return true;
    return false;
  }

  function assertAllowedSource(magnet, webseedUrl) {
    var m = magnet ? String(magnet) : '';
    var w = webseedUrl ? String(webseedUrl) : '';
    if (!m && !w) throw new Error('magnet or HTTPS webseed required');
    if (m) {
      if (!/^magnet:\?/i.test(m)) throw new Error('magnet URI required');
      if (/file:/i.test(m)) throw new Error('file:// peers refused');
    }
    if (w) {
      var parsed;
      try {
        parsed = new URL(w);
      } catch (e) {
        throw new Error('invalid webseed url');
      }
      if (parsed.protocol === 'file:') throw new Error('file:// refused');
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        throw new Error('webseed must be http(s)');
      }
      if (parsed.protocol === 'http:') {
        var h = parsed.hostname;
        if (h !== '127.0.0.1' && h !== 'localhost' && h !== '::1') {
          throw new Error('webseed HTTP only allowed on loopback');
        }
      }
    }
  }

  function newJobId() {
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
    return 'ps_' + Date.now().toString(36) + '_' + rand;
  }

  function publicJob(job) {
    if (!job) return null;
    return {
      id: job.id,
      state: job.state,
      progress: typeof job.progress === 'number' ? job.progress : 0,
      name: job.name,
      error: job.error || null,
      matched: !!job.matched,
      verified: !!job.verified,
      willNotImport: !!job.willNotImport,
      saved: !!job.saved,
      source: job.source || null,
      desktopHint: job.desktopHint || null
    };
  }

  function status(id) {
    if (id) {
      return { ok: true, job: publicJob(jobs.get(String(id))), webtorrent: !!WebTorrentCtor };
    }
    var list = [];
    jobs.forEach(function (j) {
      list.push(publicJob(j));
    });
    return {
      ok: true,
      jobs: list,
      active: list.filter(function (j) {
        return j.state === 'pulling' || j.state === 'hashing';
      }).length,
      webtorrent: !!WebTorrentCtor
    };
  }

  function bufToHex(buf) {
    var bytes = buf instanceof ArrayBuffer ? new Uint8Array(buf) : buf;
    var out = '';
    for (var i = 0; i < bytes.length; i++) {
      out += ('0' + bytes[i].toString(16)).slice(-2);
    }
    return out;
  }

  function sha256Hex(bytes) {
    // Browser: SubtleCrypto. Node smoke: crypto.createHash.
    if (
      typeof crypto !== 'undefined' &&
      crypto.subtle &&
      typeof crypto.subtle.digest === 'function'
    ) {
      var ab;
      if (bytes instanceof ArrayBuffer) ab = bytes;
      else if (bytes && bytes.buffer && bytes.byteLength !== undefined) {
        ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
      } else if (typeof Buffer !== 'undefined' && Buffer.isBuffer && Buffer.isBuffer(bytes)) {
        ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
      } else {
        return Promise.reject(new Error('unsupported bytes for hash'));
      }
      return crypto.subtle.digest('SHA-256', ab).then(function (digest) {
        return bufToHex(digest);
      });
    }
    if (typeof require === 'function') {
      try {
        var nodeCrypto = require('crypto');
        var h = nodeCrypto.createHash('sha256');
        h.update(bytes);
        return Promise.resolve(h.digest('hex'));
      } catch (e) {
        /* fall through */
      }
    }
    return Promise.reject(new Error('SubtleCrypto unavailable'));
  }

  function toUint8(bytes) {
    if (bytes instanceof Uint8Array) return bytes;
    if (bytes instanceof ArrayBuffer) return new Uint8Array(bytes);
    if (typeof Buffer !== 'undefined' && Buffer.isBuffer && Buffer.isBuffer(bytes)) {
      return new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    }
    if (Array.isArray(bytes)) return new Uint8Array(bytes);
    throw new Error('unsupported bytes');
  }

  function storeVerified(job, u8) {
    job.blob = u8;
    job.verifiedLabel = 'verified';
    // Prefer OPFS; fall back to IndexedDB; memory blob always kept for Save.
    var id = job.modelId || job.id;
    var name = String(job.name || id || 'verified.bin');

    function tryIdb() {
      return new Promise(function (resolve) {
        if (typeof indexedDB === 'undefined') {
          resolve(false);
          return;
        }
        try {
          var req = indexedDB.open('freelattice-phone-swarm', 1);
          req.onupgradeneeded = function () {
            var db = req.result;
            if (!db.objectStoreNames.contains('verified')) {
              db.createObjectStore('verified', { keyPath: 'id' });
            }
          };
          req.onsuccess = function () {
            try {
              var db = req.result;
              var tx = db.transaction('verified', 'readwrite');
              tx.objectStore('verified').put({
                id: id,
                name: name,
                sha256: job.expectedSha256,
                label: 'verified',
                bytes: u8,
                savedAt: Date.now()
              });
              tx.oncomplete = function () {
                job.stored = 'idb';
                resolve(true);
              };
              tx.onerror = function () {
                resolve(false);
              };
            } catch (e) {
              resolve(false);
            }
          };
          req.onerror = function () {
            resolve(false);
          };
        } catch (e) {
          resolve(false);
        }
      });
    }

    function tryOpfs() {
      return new Promise(function (resolve) {
        if (
          typeof navigator === 'undefined' ||
          !navigator.storage ||
          typeof navigator.storage.getDirectory !== 'function'
        ) {
          resolve(false);
          return;
        }
        navigator.storage
          .getDirectory()
          .then(function (rootDir) {
            return rootDir.getDirectoryHandle('freelattice-verified', { create: true });
          })
          .then(function (dir) {
            return dir.getFileHandle(String(id).replace(/[^a-zA-Z0-9._-]+/g, '_') + '.bin', {
              create: true
            });
          })
          .then(function (fh) {
            return fh.createWritable();
          })
          .then(function (writable) {
            return writable.write(u8).then(function () {
              return writable.close();
            });
          })
          .then(function () {
            job.stored = 'opfs';
            resolve(true);
          })
          .catch(function () {
            resolve(false);
          });
      });
    }

    return tryOpfs().then(function (ok) {
      if (ok) return true;
      return tryIdb();
    });
  }

  function handoffBuffer(job, bytes) {
    job.state = 'hashing';
    job.progress = 100;
    var u8 = toUint8(bytes);
    return sha256Hex(u8).then(function (hex) {
      var got = String(hex || '').toLowerCase();
      var want = String(job.expectedSha256 || '')
        .trim()
        .toLowerCase();
      if (got && want && got === want) {
        job.matched = true;
        job.verified = true;
        job.willNotImport = true; // browser never Import to Ollama
        job.state = 'verified';
        job.error = null;
        return storeVerified(job, u8).then(function () {
          return publicJob(job);
        });
      }
      job.matched = false;
      job.verified = false;
      job.willNotImport = true;
      job.state = 'mismatch';
      job.error = 'hash mismatch — will not trust on this device';
      job.blob = null;
      return publicJob(job);
    });
  }

  /**
   * Smoke / tests: pretend download completed; still must pass hash path.
   */
  function completeWithBuffer(jobId, bytes) {
    var job = jobs.get(String(jobId));
    if (!job) throw new Error('unknown job');
    if (job.state === 'cancelled') throw new Error('cancelled');
    return handoffBuffer(job, bytes);
  }

  function cancel(id) {
    var job = jobs.get(String(id));
    if (!job) return { ok: true, cancelled: false, reason: 'unknown' };
    job.state = 'cancelled';
    job.progress = job.progress || 0;
    if (job.abortRef) job.abortRef.aborted = true;
    if (job.abortRef && job.abortRef.controller) {
      try {
        job.abortRef.controller.abort();
      } catch (e) {
        /* ignore */
      }
    }
    if (job.torrent) {
      try {
        job.torrent.destroy();
      } catch (e) {
        /* ignore */
      }
      job.torrent = null;
    }
    return { ok: true, cancelled: true, job: publicJob(job) };
  }

  function loadWebTorrentScript() {
    return new Promise(function (resolve) {
      if (typeof document === 'undefined') {
        resolve(null);
        return;
      }
      if (root && root.WebTorrent) {
        resolve(root.WebTorrent);
        return;
      }
      var s = document.createElement('script');
      s.src = WT_CDN;
      if (WT_SRI) {
        s.integrity = WT_SRI;
        s.crossOrigin = 'anonymous';
      }
      s.async = true;
      s.onload = function () {
        resolve((root && root.WebTorrent) || null);
      };
      s.onerror = function () {
        resolve(null);
      };
      document.head.appendChild(s);
    });
  }

  function tryLoadWebTorrent() {
    if (isTorrentDisabled()) return Promise.resolve(null);
    if (WebTorrentCtor) return Promise.resolve(WebTorrentCtor);
    if (wtLoadPromise) return wtLoadPromise;
    wtLoadPromise = loadWebTorrentScript()
      .then(function (ctor) {
        WebTorrentCtor = ctor || null;
        if (!WebTorrentCtor) wtLoadPromise = null;
        return WebTorrentCtor;
      })
      .catch(function () {
        WebTorrentCtor = null;
        wtLoadPromise = null;
        return null;
      });
    return wtLoadPromise;
  }

  function ensureWebTorrent() {
    if (isTorrentDisabled()) return Promise.resolve(false);
    return tryLoadWebTorrent().then(function (ctor) {
      return !!ctor;
    });
  }

  function getClient() {
    if (isTorrentDisabled()) return Promise.resolve(null);
    return tryLoadWebTorrent().then(function (WT) {
      if (!WT) return null;
      if (!wtClient) {
        try {
          wtClient = new WT();
        } catch (e) {
          return null;
        }
      }
      return wtClient;
    });
  }

  function fetchWebseed(job) {
    var abortRef = { aborted: false, controller: null };
    job.abortRef = abortRef;
    job.source = 'webseed';
    job.state = 'pulling';

    if (typeof fetch !== 'function') {
      return Promise.reject(new Error('fetch unavailable'));
    }

    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    if (controller) abortRef.controller = controller;

    return fetch(job.webseedUrl, {
      method: 'GET',
      signal: controller ? controller.signal : undefined,
      credentials: 'omit',
      cache: 'no-store'
    }).then(function (res) {
      if (job.state === 'cancelled' || abortRef.aborted) throw new Error('cancelled');
      if (!res.ok) throw new Error('download status ' + res.status);
      var len = parseInt(res.headers.get('content-length') || '0', 10) || 0;
      if (!res.body || typeof res.body.getReader !== 'function') {
        return res.arrayBuffer().then(function (ab) {
          job.progress = 99;
          return ab;
        });
      }
      var reader = res.body.getReader();
      var chunks = [];
      var total = 0;
      var MAX = 512 * 1024 * 1024;

      function pump() {
        return reader.read().then(function (result) {
          if (job.state === 'cancelled' || abortRef.aborted) throw new Error('cancelled');
          if (result.done) {
            var out = new Uint8Array(total);
            var offset = 0;
            for (var i = 0; i < chunks.length; i++) {
              out.set(chunks[i], offset);
              offset += chunks[i].length;
            }
            return out.buffer;
          }
          var value = result.value;
          total += value.length;
          if (total > MAX) throw new Error('download too large');
          chunks.push(value);
          job.progress = len
            ? Math.min(99, Math.floor((total / len) * 100))
            : Math.min(90, Math.floor(total / 1024));
          job.state = 'pulling';
          return pump();
        });
      }
      return pump();
    });
  }

  function startWebseedJob(job) {
    return fetchWebseed(job)
      .then(function (buf) {
        if (job.state === 'cancelled') return publicJob(job);
        return handoffBuffer(job, buf);
      })
      .catch(function (e) {
        if (job.state === 'cancelled') return publicJob(job);
        job.state = 'error';
        job.error = String(e && e.message ? e.message : e);
        return publicJob(job);
      });
  }

  function startMagnetJob(job) {
    return getClient().then(function (client) {
      if (!client) {
        if (job.webseedUrl) return startWebseedJob(job);
        job.state = 'error';
        job.error = 'WebTorrent missing — ' + DESKTOP_HINT;
        job.desktopHint = DESKTOP_HINT;
        return publicJob(job);
      }
      return new Promise(function (resolve) {
        job.source = 'magnet';
        job.state = 'pulling';
        var opts = {};
        if (job.webseedUrl) opts.urlList = [job.webseedUrl];
        var torrent;
        try {
          torrent = client.add(job.magnet, opts);
        } catch (e) {
          job.state = 'error';
          job.error = String(e && e.message ? e.message : e);
          resolve(publicJob(job));
          return;
        }
        job.torrent = torrent;
        torrent.on('download', function () {
          if (job.state === 'cancelled') return;
          job.state = 'pulling';
          job.progress = Math.min(99, Math.floor((torrent.progress || 0) * 100));
        });
        torrent.on('error', function (err) {
          if (job.state === 'cancelled') {
            resolve(publicJob(job));
            return;
          }
          job.state = 'error';
          job.error = String(err && err.message ? err.message : err);
          resolve(publicJob(job));
        });
        torrent.on('done', function () {
          if (job.state === 'cancelled') {
            resolve(publicJob(job));
            return;
          }
          try {
            var file = torrent.files && torrent.files[0];
            if (!file) {
              job.state = 'error';
              job.error = 'torrent had no files';
              resolve(publicJob(job));
              return;
            }
            file.getBuffer(function (err, buf) {
              if (job.state === 'cancelled') {
                resolve(publicJob(job));
                return;
              }
              if (err) {
                job.state = 'error';
                job.error = String(err.message || err);
                resolve(publicJob(job));
                return;
              }
              handoffBuffer(job, buf).then(resolve, function (e2) {
                job.state = 'error';
                job.error = String(e2 && e2.message ? e2.message : e2);
                resolve(publicJob(job));
              });
            });
          } catch (e) {
            job.state = 'error';
            job.error = String(e && e.message ? e.message : e);
            resolve(publicJob(job));
          }
        });
      });
    });
  }

  /**
   * Gesture pull. Never auto. Hash before trust.
   * @param {{ magnet?: string, webseedUrl?: string, expectedSha256: string, id?: string, name?: string, redistributable?: boolean, notes?: string }} opts
   */
  function startPull(opts) {
    var o = opts || {};
    if (o.redistributable === false) {
      return Promise.reject(new Error('non-redistributable — refuse swarm'));
    }
    // When caller passes redistributable explicitly false we refuse; when omitted,
    // UI is expected to gate — still refuse EXAMPLE / zero-hash here.
    if (isZeroHash(o.expectedSha256) || isExampleRow(o)) {
      return Promise.reject(new Error('zero-hash / EXAMPLE — refuse swarm'));
    }
    if (o.redistributable !== undefined && o.redistributable !== true) {
      return Promise.reject(new Error('non-redistributable — refuse swarm'));
    }

    var magnet = o.magnet ? String(o.magnet) : '';
    var webseedUrl = o.webseedUrl ? String(o.webseedUrl) : '';
    assertAllowedSource(magnet, webseedUrl);

    var id = newJobId();
    var job = {
      id: id,
      state: 'pulling',
      progress: 0,
      name: String(o.name || o.id || 'swarm'),
      modelId: String(o.id || o.name || id),
      expectedSha256: String(o.expectedSha256),
      magnet: magnet || null,
      webseedUrl: webseedUrl || null,
      matched: false,
      verified: false,
      willNotImport: true,
      saved: false,
      blob: null,
      stored: null
    };
    jobs.set(id, job);

    var run;
    var mode = getTransportMode();
    if (webseedUrl) {
      run = startWebseedJob(job).then(function(res) {
        // verified / mismatch: keep it, don't fallback to torrent on tamper
        if (res && (res.state === 'verified' || res.state === 'mismatch')) return res;
        if (res && res.state === 'error' && magnet && isTorrentAllowed() && mode !== 'https-only') {
          return startMagnetJob(job);
        }
        return res;
      });
    } else if (magnet) {
      if (isTorrentDisabled()) {
        job.state = 'error';
        job.error = 'torrent disabled (Metronet-safe HTTPS-only mode) — provide HTTPS webseedUrl';
        run = Promise.resolve(publicJob(job));
      } else {
        run = startMagnetJob(job);
      }
    } else {
      job.state = 'error';
      job.error = 'magnet or HTTPS webseed required';
      run = Promise.resolve(publicJob(job));
    }
    job.promise = run;
    run.catch(function (e) {
      if (job.state === 'cancelled') return;
      job.state = 'error';
      job.error = String(e && e.message ? e.message : e);
    });
    return Promise.resolve({ ok: true, job: publicJob(job), awaitable: true });
  }

  function waitJob(id, timeoutMs) {
    var job = jobs.get(String(id));
    if (!job) return Promise.reject(new Error('unknown job'));
    var ms = timeoutMs || 120000;
    if (!job.promise) return Promise.resolve(publicJob(job));
    return Promise.race([
      job.promise,
      new Promise(function (_, reject) {
        setTimeout(function () {
          reject(new Error('swarm job timeout'));
        }, ms);
      })
    ]).then(function () {
      return publicJob(job);
    });
  }

  /**
   * Offer Save file… for a verified job. Gesture only.
   */
  function saveVerified(id) {
    var job = jobs.get(String(id));
    if (!job || !job.verified || !job.blob) {
      return Promise.resolve({ ok: false, reason: 'not verified' });
    }
    var u8 = toUint8(job.blob);
    var name = String(job.name || job.modelId || 'verified.bin').replace(/[^\w.\-]+/g, '_');
    var blob =
      typeof Blob !== 'undefined'
        ? new Blob([u8], { type: 'application/octet-stream' })
        : null;

    if (
      typeof window !== 'undefined' &&
      typeof window.showSaveFilePicker === 'function' &&
      blob
    ) {
      return window
        .showSaveFilePicker({
          suggestedName: name,
          types: [
            {
              description: 'Verified file',
              accept: { 'application/octet-stream': ['.bin', '.txt', '.gguf'] }
            }
          ]
        })
        .then(function (handle) {
          return handle.createWritable().then(function (writable) {
            return writable.write(blob).then(function () {
              return writable.close();
            });
          });
        })
        .then(function () {
          job.saved = true;
          return { ok: true, saved: true, method: 'picker' };
        })
        .catch(function (e) {
          if (e && e.name === 'AbortError') return { ok: false, reason: 'cancelled' };
          // Fall through to anchor download
          return downloadAnchor(blob, name, job);
        });
    }

    if (blob) return Promise.resolve(downloadAnchor(blob, name, job));
    return Promise.resolve({ ok: false, reason: 'save unavailable' });
  }

  function downloadAnchor(blob, name, job) {
    if (typeof document === 'undefined' || typeof URL === 'undefined') {
      return { ok: false, reason: 'save unavailable' };
    }
    try {
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      setTimeout(function () {
        try {
          URL.revokeObjectURL(url);
          a.remove();
        } catch (e) {
          /* ignore */
        }
      }, 1500);
      job.saved = true;
      return { ok: true, saved: true, method: 'download' };
    } catch (e) {
      return { ok: false, reason: String(e && e.message ? e.message : e) };
    }
  }

  function getVerifiedBlob(id) {
    var job = jobs.get(String(id));
    if (!job || !job.verified || !job.blob) return null;
    return toUint8(job.blob);
  }

  function destroyClient() {
    if (wtClient) {
      try {
        wtClient.destroy(function () {});
      } catch (e) {
        /* ignore */
      }
      wtClient = null;
    }
  }

  var api = {
    startPull: startPull,
    cancel: cancel,
    status: status,
    completeWithBuffer: completeWithBuffer,
    waitJob: waitJob,
    ensureWebTorrent: ensureWebTorrent,
    assertAllowedSource: assertAllowedSource,
    saveVerified: saveVerified,
    getVerifiedBlob: getVerifiedBlob,
    destroyClient: destroyClient,
    isZeroHash: isZeroHash,
    isExampleRow: isExampleRow,
    DESKTOP_HINT: DESKTOP_HINT,
    /** @private smoke */ jobs: jobs
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.PhoneSwarm = api;
  }
})(typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
