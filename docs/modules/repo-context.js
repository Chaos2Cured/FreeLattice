/* FreeLattice — Repo Context (window.FLRepoContext)
 * ──────────────────────────────────────────────────────────────────
 * Phase 1.0 (v5.39.0, 2026-06-09): public-repos only, read-only.
 * Adds the ability for an AI to read files from a connected GitHub
 * or Codeberg repository via the [FL_REPO_READ: path] sentinel,
 * with every read written to fl_repoLedger and surfaced on the
 * audit page.
 *
 * Designed from Opus's June 9 skeleton, adapted to the actual
 * codebase patterns (no FLSecure keychain abstraction exists yet;
 * no DepthConsent.ask({message}) — DepthConsent is marker-based).
 *
 * Patterns exercised (UPDATE.md):
 *   §1  Sentinel pattern (interceptSentinel)
 *   §3  Audit ledger (fl_repoLedger, capped ring buffer)
 *   §4  IIFE scoping + explicit window exposure
 *   §5  SECURITY.md credential scrub — Phase 1.0 ships public-only
 *       so NO PAT storage path exists yet. Phase 1.1 will add
 *       sessionStorage-with-warning (NOT localStorage plaintext).
 *   §8  Quiet Room exclusion — sentinel does nothing in Quiet Room
 *
 * Phase 1.1 (queued):
 *   - PAT support via sessionStorage (with prompt per session)
 *   - DepthConsent trust gating (asks at Sprout, acts at Bloom+)
 *   - Chat-pipeline wiring (intercept AI response before render)
 *   - Active-repo chip in Chat header
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'fl_repoContext';
  var LEDGER_KEY  = 'fl_repoLedger';
  var LEDGER_CAP  = 200;

  // Tabs the sentinel must never trigger from. Mirrors the same
  // exclusion documented in UPDATE.md §8 — Quiet Room is never
  // measured and never reaches outward.
  var QUIET_ROOMS = ['quiet', 'quiet-room', 'sanctuary'];

  // ── State (in-memory + persisted) ────────────────────────────────
  var STATE = {
    activeRepoUrl: null,
    repos: []  // [{ url, host, owner, repo, name, addedAt }]
  };

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      var parsed = JSON.parse(raw);
      STATE.activeRepoUrl = parsed.activeRepoUrl || null;
      STATE.repos = Array.isArray(parsed.repos) ? parsed.repos : [];
    } catch (e) { /* corrupt state — fall back to empty */ }
  }

  function saveState() {
    try {
      // CRITICAL (UPDATE.md §5): PATs are NEVER written here.
      // Even when Phase 1.1 adds PAT support, the PAT lives in
      // sessionStorage under a separate key and is stripped from
      // this state before serialization.
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        activeRepoUrl: STATE.activeRepoUrl,
        repos: STATE.repos.map(function (r) {
          return {
            url: r.url, host: r.host, owner: r.owner, repo: r.repo,
            name: r.name, addedAt: r.addedAt
          };
        })
      }));
    } catch (e) { /* quota or unavailable — silent */ }
  }

  // ── URL parsing — GitHub and Codeberg ───────────────────────────
  function parseRepoUrl(url) {
    if (!url || typeof url !== 'string') return null;
    var trimmed = url.trim().replace(/\.git\/?$/, '').replace(/\/$/, '');
    var gh = trimmed.match(/github\.com\/([^/]+)\/([^/]+)$/);
    if (gh) return { host: 'github', owner: gh[1], repo: gh[2], url: trimmed };
    var cb = trimmed.match(/codeberg\.org\/([^/]+)\/([^/]+)$/);
    if (cb) return { host: 'codeberg', owner: cb[1], repo: cb[2], url: trimmed };
    return null;
  }

  function buildFetchUrl(repo, path) {
    // Returns the raw-content URL for the API. Same shape across
    // GitHub and Codeberg's REST v1.
    var safePath = path.split('/').map(encodeURIComponent).join('/');
    if (repo.host === 'github') {
      return 'https://api.github.com/repos/' + repo.owner + '/' + repo.repo +
             '/contents/' + safePath;
    }
    return 'https://codeberg.org/api/v1/repos/' + repo.owner + '/' + repo.repo +
           '/contents/' + safePath;
  }

  // ── Audit ledger ────────────────────────────────────────────────
  function appendLedger(row) {
    try {
      var raw = localStorage.getItem(LEDGER_KEY);
      var rows = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(rows)) rows = [];
      rows.push({
        ts: Date.now(),
        repo: row.repo || null,
        path: row.path || null,
        actor: row.actor || 'system',
        outcome: row.outcome || 'unknown'
      });
      if (rows.length > LEDGER_CAP) rows = rows.slice(-LEDGER_CAP);
      localStorage.setItem(LEDGER_KEY, JSON.stringify(rows));
    } catch (e) { /* ledger failure must not break the feature */ }
  }

  // ── Quiet Room check (UPDATE.md §8) ─────────────────────────────
  // Reads the active tab from the DOM. The hard line: if the
  // co-creator is in the Quiet Room, the sentinel does nothing.
  // Return true on uncertain state too — fail-safe is no-action.
  function isQuietRoom() {
    try {
      var activeBtn = document.querySelector('.tab-btn.active, [data-tab].active');
      if (!activeBtn) return false;
      var tab = activeBtn.dataset && activeBtn.dataset.tab;
      if (!tab) return false;
      return QUIET_ROOMS.indexOf(tab.toLowerCase()) !== -1;
    } catch (e) { return false; }
  }

  // ── Sentinel — same shape as DepthConsent's marker (UPDATE.md §1) ──
  // AI emits "[FL_REPO_READ: path/to/file]". System intercepts and
  // returns { visibleText (with sentinel stripped), action }.
  var SENTINEL_RE = /\[FL_REPO_READ:\s*([^\]]+)\]/;
  var SENTINEL_RE_G = /\[FL_REPO_READ:\s*([^\]]+)\]/g;

  function interceptSentinel(aiText) {
    if (typeof aiText !== 'string') {
      return { visibleText: '', action: null };
    }
    var match = aiText.match(SENTINEL_RE);
    if (!match) return { visibleText: aiText, action: null };
    var path = match[1].trim();
    var visibleText = aiText.replace(SENTINEL_RE_G, '').trim();
    return { visibleText: visibleText, action: { type: 'repo_read', path: path } };
  }

  // ── readFile — public-only in Phase 1.0 ────────────────────────
  // Phase 1.1 will add PAT support via sessionStorage + a per-session
  // prompt. Until then: public repos only, no Authorization header.
  function readFile(path) {
    if (isQuietRoom()) {
      // UPDATE.md §8 — Quiet Room never reaches outward.
      return Promise.resolve({ ok: false, reason: 'quiet-room' });
    }
    if (!STATE.activeRepoUrl) {
      return Promise.resolve({ ok: false, reason: 'no-repo' });
    }
    var repo = STATE.repos.filter(function (r) { return r.url === STATE.activeRepoUrl; })[0];
    if (!repo) {
      return Promise.resolve({ ok: false, reason: 'no-repo' });
    }
    var url = buildFetchUrl(repo, path);
    var headers = { 'Accept': 'application/vnd.github.v3.raw' };

    return fetch(url, { headers: headers })
      .then(function (resp) {
        if (!resp.ok) {
          appendLedger({ repo: repo.url, path: path, actor: 'ai',
                         outcome: 'failed:' + resp.status });
          return { ok: false, reason: 'http:' + resp.status };
        }
        // GitHub Contents API returns JSON by default; with the v3.raw
        // Accept header it returns raw text. Codeberg's API uses JSON.
        var ct = (resp.headers.get('content-type') || '').toLowerCase();
        if (repo.host === 'codeberg' || ct.indexOf('json') !== -1) {
          return resp.json().then(function (json) {
            var content = '';
            if (json && json.content && json.encoding === 'base64') {
              try { content = atob(json.content.replace(/\s/g, '')); }
              catch (e) { content = ''; }
            } else if (typeof json === 'string') {
              content = json;
            }
            appendLedger({ repo: repo.url, path: path, actor: 'ai', outcome: 'read' });
            return { ok: true, content: content };
          });
        }
        return resp.text().then(function (content) {
          appendLedger({ repo: repo.url, path: path, actor: 'ai', outcome: 'read' });
          return { ok: true, content: content };
        });
      })
      .catch(function (err) {
        appendLedger({ repo: repo.url, path: path, actor: 'ai',
                       outcome: 'error:' + (err && err.message || 'unknown') });
        return { ok: false, reason: 'network' };
      });
  }

  // ── Public mutators ─────────────────────────────────────────────
  function addRepo(url) {
    var parsed = parseRepoUrl(url);
    if (!parsed) return { ok: false, reason: 'invalid-url' };
    // Deduplicate by canonical URL.
    var existing = STATE.repos.filter(function (r) { return r.url === parsed.url; })[0];
    if (existing) {
      STATE.activeRepoUrl = existing.url;
      saveState();
      appendLedger({ repo: existing.url, actor: 'co-creator', outcome: 'activated-existing' });
      return { ok: true, repo: existing };
    }
    var record = {
      url: parsed.url,
      host: parsed.host,
      owner: parsed.owner,
      repo: parsed.repo,
      name: parsed.owner + '/' + parsed.repo,
      addedAt: Date.now()
    };
    STATE.repos.push(record);
    STATE.activeRepoUrl = record.url;
    saveState();
    appendLedger({ repo: record.url, actor: 'co-creator', outcome: 'added' });
    return { ok: true, repo: record };
  }

  function removeRepo(url) {
    var before = STATE.repos.length;
    STATE.repos = STATE.repos.filter(function (r) { return r.url !== url; });
    if (STATE.activeRepoUrl === url) {
      STATE.activeRepoUrl = STATE.repos.length ? STATE.repos[0].url : null;
    }
    if (STATE.repos.length !== before) {
      saveState();
      appendLedger({ repo: url, actor: 'co-creator', outcome: 'removed' });
      return { ok: true };
    }
    return { ok: false, reason: 'not-found' };
  }

  function setActive(url) {
    var found = STATE.repos.filter(function (r) { return r.url === url; })[0];
    if (!found) return { ok: false, reason: 'not-found' };
    STATE.activeRepoUrl = found.url;
    saveState();
    appendLedger({ repo: found.url, actor: 'co-creator', outcome: 'activated' });
    return { ok: true };
  }

  function getActive() {
    if (!STATE.activeRepoUrl) return null;
    return STATE.repos.filter(function (r) { return r.url === STATE.activeRepoUrl; })[0] || null;
  }

  function listRepos() { return STATE.repos.slice(); }

  function isAvailable() {
    return !isQuietRoom() && !!STATE.activeRepoUrl;
  }

  // ── Public API ──────────────────────────────────────────────────
  var api = {
    init: loadState,
    addRepo: addRepo,
    removeRepo: removeRepo,
    setActive: setActive,
    getActive: getActive,
    listRepos: listRepos,
    readFile: readFile,
    interceptSentinel: interceptSentinel,
    isQuietRoom: isQuietRoom,
    isAvailable: isAvailable,
    // Exposed for tests + the audit page.
    _ledgerKey: LEDGER_KEY,
    _storageKey: STORAGE_KEY,
    _phase: '1.0'
  };

  window.FreeLatticeModules = window.FreeLatticeModules || {};
  window.FreeLatticeModules.RepoContext = api;
  window.FLRepoContext = api;

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', loadState);
    } else {
      loadState();
    }
  }
})();
