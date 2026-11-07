# FLINT_HEAL_CONNECT_v0.4 (build only)

**For:** Flint (builder). **From:** Kirk, with Hypha's walk 3 verified line by line against main.
**Build only.** Two branches, two PRs, open as drafts. Do not merge. Do not touch anything not named here.

| Repo | Base (main) | Branch | PR title |
|---|---|---|---|
| Chaos2Cured/FreeLattice | `4cfd14884d5236999ead0379dcf13eb3b64663f6` (after #119) | `layer/connect-heal-v0.4` | `layer: connect heal v0.4 (Hypha walk 3) + smoke green` |
| theLatticeTree (Alpha) | `22b913e21c9197945dff8b7a89f95197c55b5538` | `layer/connect-heal-v0.4` | `layer: connect heal v0.4 (Settings Connect visible at 390px)` |

**SMOKE line (both repos):** `SMOKE_OK connect heal v0.4`
**Marker (both repos):** `v-connect-heal-v0.4`

## Locks (check every one before you open the PRs)

1. Layer, never delete. Old paths stay as fallbacks when FlConnect is missing.
2. Root `sw.js` byte-identical to main. Never touch `docs/sw.js`.
3. Root `index.html` identical to `docs/app.html` (edit app.html, then `cp docs/app.html index.html`).
4. No conflict markers. All inline scripts parse.
5. `textContent` for any outside text (model names, refusal lines).
6. Local minds are 127.0.0.1 only.
7. AUTONOMY.md: no `confirm()` dialogs. And never silently pick a model or connect without the person's yes (a tap on the mind).
8. `docs/modules/fl-connect.js` is byte-identical in both repos after this brick (same as today).
9. Design for Mom and Jeffrey Freed: no Terminal anywhere on the path.
10. No em dashes in new prose or comments.

## How to apply

The diffs below were built and tested against the exact main SHAs above. Line numbers in `@@` headers are main's. Apply the hunks in order, or hand-edit using the anchors. Every hunk has 3 lines of context.

**FreeLattice:** sections 0, 2, 3, 4, 5, 6, 7, 8, 10, then 11 (smoke) and 13 (doc). Then `cp docs/app.html index.html`.
**Alpha:** sections 1 and 9, then copy the finished `docs/modules/fl-connect.js` from FreeLattice byte for byte, then 12 (test) and 13 (doc).

## What Hypha found, verified against main

| # | Finding | Verdict | Anchor (main) |
|---|---|---|---|
| 1 | Alpha Settings Connect mount collapses | **Confirmed.** Measured 0px tall at 390x844 (content 638px). 276 of 563px shown at 1280x800. Download link point hits `#settings-grandmother` at 390. Canvas orbs are not in the hide list. | `garden-rooms.css:6054-6061`, mount created `garden-rooms.js:1664-1673` |
| 2 | Bridge health polling after leaving Connect | **Confirmed, with a correction.** The source is not a Connect leak. It is `flBridgeDetectBoot`'s global `setInterval(run, 20000)`, a full 11-port scan on every tab from boot. 22 health fetches in 40s after leaving. FlConnect's own loop does stop. | `app.html:31504-31513` (fetch at `31387`) |
| 3 | Cold `#connect` storm, yank back, startup race, welcome overlay | **Confirmed.** 4 FlConnect mounts and 102 local fetches in the first 7s. A tap on Chat at 1.5s was yanked back. The hash is never cleared. | `app.html:68501-68521` |
| 4 | Manual port on an un-helped Bridge says Nothing answered | **Confirmed.** `waitingHelp` is set, then falls through to `manualQuiet = true`. Render skips the Yes, help card when `manualQuiet`. | `fl-connect.js:200-208`, render `518`, `535` |
| 5 | Port stickiness | **Confirmed, all five parts.** Use automatic appears only in the quiet card. `clearManualHost` leaves the `fl_ollamaHost` that `remember()` wrote. `getOllamaBaseUrl` reads `fl_ollamaHost` first. A refused address keeps the old port silently, and the refusal lingers above Nothing answered. The doc names `fl_connect_manual_host`. | `fl-connect.js:77-90, 334, 517-522`; `app.html:34254-34256`; `CONNECT_PORT_PICKER_v0.md:33` |
| 6 | Settings Ollama Address invites a remote IP | **Confirmed.** `flSaveOllamaHost` saves any string on every keystroke. | `app.html:16134-16136`, `34356-34366` |
| 7 | Silent connects | **Confirmed, and one more path.** The toast Yes calls `connectOllama`, which sets isLocal and `models[0]`. `flAutoConnect` picks `models[0]`. `autoDiscoverAI` (boot +3s) also connects `best.models[0]`. In our run that was the path that connected llama3.2 while the toast was still pending. LM Studio: the banner text changes but the button still says Yes, use Ollama and opens Connect, which cannot see LM Studio. | `app.html:27717-27745` (`models[0]` at `27732`), `27809-27815`, `34713-34751`, `39536-39587` (boot at `39609-39612`), `35154-35162`, `16014` |
| 8 | Settings Local mode, Change Provider dead ends | **Confirmed, and worse.** `settingsSetMode('local')` runs the old wizard, picks `models[0]`, and sets `state.apiKey = null`. `flPlayGateProvider` always routes a no-mind person back to Connect, so no key form. Three doors call `overlay.remove()` without clearing `modalOverlayEl`, so `openModal` returns early until reload. | `app.html:31550-31600` (wizard `31557`, `models[0]` `31590`, key wipe `31592`), `31091-31104`, `31004`, `31045`, `28636`; guard `28532` |
| 9 | Alpha galaxy stuck after Settings | **Confirmed.** Settings then Nursery keeps `flc-hide-galaxy` and `fl-connect-open`, so the nav and galaxy word stay hidden in Nursery. Settings twice then close leaves `.galaxy-nav` hidden, because the second open marks already hidden nodes as `'1'`. | `garden-rooms.js:1588-1616` (closePlace), `1649-1661` (settings branch) |
| 10 | `remember()` resets isLocal | **Confirmed.** `handleLocalToggle(true)` reads the unchecked `#localToggle` and writes `state.isLocal = false`. | `fl-connect.js:345`; `app.html:35423-35426` |

## In this brick vs follow-up

**In:** 0 (smoke green), 1, 2, 3 (storm and yank only), 4, 5, 6, 7 (toast, Connect Now, Zero-Click, discovery), 8, 9, 10.
**Follow-ups (too big for this brick, listed in section 14):** the cold-start race (Garden or last tab landing late, welcome overlay on top), consolidating the other boot probes (5 full scans in 7s remain), LM Studio in Connect, and the FLBoxPointer LAN field (a Kirk decision).

---

## 0. FreeLattice: tests-only smoke fix (tests/smoke.js all green)

**Why:** 3 stale asserts on main. The two ollama asserts broke at #116 (19c76f8), the MORE_CARDS assert at #117 (14bb199). The app is right; the tests read too narrow a window. Main today: `3 FAILED, 3594 passed`. After: `ALL 3597 CHECKS PASSED`.

**0a.** `tests/smoke.js`: add a "Connect door is first" assert, anchor "Your Audit is first" to the Row 1 comment, and read `resolveOllamaBase` / `getOllamaBaseUrl` as whole function bodies.

```diff
--- a/tests/smoke.js
+++ b/tests/smoke.js
@@ -1720,8 +1720,12 @@ assert('LIGHTHOUSE_CARDS includes Why This Way',
   /LIGHTHOUSE_CARDS\s*=\s*\[[\s\S]*?label:\s*'Why This Way'[\s\S]*?external:\s*'why-this-way\.html'/.test(appHtml));
 
 // MORE_CARDS reorganization
+// v-connect-under-more-v0 (#117) put the Connect door first under More (Mom path).
+// Row 1 (accountability) still opens with Your Audit, right after that door.
+assert('MORE_CARDS: Connect door is first (v-connect-under-more-v0)',
+  /MORE_CARDS\s*=\s*\[\s*\/\/[^\n]*\n\s*\{\s*id:\s*'connect'[^\n]*label:\s*'Connect'/.test(appHtml));
 assert('MORE_CARDS Row 1: Your Audit is first',
-  /MORE_CARDS\s*=\s*\[\s*\/\/[^\n]*\n\s*\{\s*icon:[^,]+,\s*label:\s*'Your Audit'/.test(appHtml));
+  /MORE_CARDS\s*=\s*\[[\s\S]{0,1200}\/\/[^\n]*Row 1[^\n]*\n\s*\{\s*icon:[^,]+,\s*label:\s*'Your Audit'/.test(appHtml));
 assert('MORE_CARDS has Trust Level card',
   /label:\s*'Trust Level'/.test(appHtml));
 assert('MORE_CARDS Row 1 contains Your Audit + Trust Level + Wallet (the accountability row)',
@@ -3854,8 +3858,12 @@ assert('ollama: isLikelyProxyOrigin returns true for localhost / 127.0.0.1 / fil
   /isLikelyProxyOrigin[\s\S]{0,1500}127\.0\.0\.1/.test(appHtml) &&
   /isLikelyProxyOrigin[\s\S]{0,1500}['"]file:['"]/.test(appHtml) &&
   /isLikelyProxyOrigin[\s\S]{0,1500}192\.168\./.test(appHtml));
+// #116 (Bridge-aware) and #118 (manual port) layered steps ahead of the proxy probe,
+// so look inside the whole function body instead of the first 400 characters.
+var resolveOllamaBaseBody = (appHtml.match(/async function resolveOllamaBase\([^)]*\)\s*\{[\s\S]*?\n\}\n/) || [''])[0];
 assert('ollama: resolveOllamaBase auto-probe gated on isLikelyProxyOrigin()',
-  /async function resolveOllamaBase[\s\S]{0,400}isLikelyProxyOrigin\(\)[\s\S]{0,200}fetch\(['"]\/ollama\/api\/tags['"]/.test(appHtml));
+  /isLikelyProxyOrigin\(\)[\s\S]{0,200}fetch\(['"]\/ollama\/api\/tags['"]/.test(resolveOllamaBaseBody) &&
+  resolveOllamaBaseBody.indexOf('/ollama/api/tags') > resolveOllamaBaseBody.indexOf('isLikelyProxyOrigin()'));
 assert('ollama: ollamaFetch skips proxy and goes direct on non-proxy origins',
   /async function ollamaFetch[\s\S]{0,800}!isLikelyProxyOrigin\(\)[\s\S]{0,200}return fetch\(directUrl/.test(appHtml));
 assert('ollama: getOllamaBaseUrl strips trailing slash to prevent double-slash in concatenation',
@@ -3864,8 +3872,11 @@ assert('ollama: getOllamaBaseUrl validates http(s) protocol before returning',
   /function getOllamaBaseUrl[\s\S]{0,800}\/\^https\?:\\\/\\\/\/\.test\(host\)/.test(appHtml));
 // LNA: product fallback is FL_OLLAMA_LOCAL (http://127.0.0.1:11434), not
 // the localhost literal — Chrome Private Network Access classifies before DNS.
+// #116 and #118 layered saved-Bridge and manual-port returns before the fallback;
+// the final return of the function body must still be FL_OLLAMA_LOCAL.
+var getOllamaBaseUrlBody = (appHtml.match(/function getOllamaBaseUrl\(\)\s*\{[\s\S]*?\n\}\n/) || [''])[0];
 assert('ollama: getOllamaBaseUrl returns FL_OLLAMA_LOCAL / 127.0.0.1 fallback (never empty)',
-  /function getOllamaBaseUrl[\s\S]{0,900}return FL_OLLAMA_LOCAL/.test(appHtml)
+  /return FL_OLLAMA_LOCAL;\s*\}\s*$/.test(getOllamaBaseUrlBody)
   && /FL_OLLAMA_LOCAL\s*=\s*['"]http:\/\/127\.0\.0\.1:11434['"]/.test(appHtml));
 assert('ollama: getOllamaBaseUrl rewrites saved localhost → 127.0.0.1 (LNA)',
   /function getOllamaBaseUrl[\s\S]{0,900}localhost(?=\[:\/\]\|\$)/.test(appHtml)
```

**0b.** `docs/scripts/smoke-love-logic-proof-v3.js:105` asserts "app.html / index.html untouched by this brick" against `origin/main`. That was right for #119 and now fails for every later brick that touches app.html (this one included). Scope it to the v3 brick. Tests only.

```diff
--- a/docs/scripts/smoke-love-logic-proof-v3.js
+++ b/docs/scripts/smoke-love-logic-proof-v3.js
@@ -102,7 +102,11 @@ try {
   const changed = execFileSync('git', ['diff', '--name-only', 'origin/main'], { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).split('\n').filter(Boolean);
   assert.ok(!changed.includes('sw.js') && !changed.includes('docs/sw.js'), 'sw.js untouched');
   assert.ok(!changed.some((f) => /kimi|voice-shelf|VOICE_SHELF/i.test(f)), "Kimi's pages untouched");
-  assert.ok(!changed.includes('docs/app.html') && !changed.includes('index.html'), 'app.html / index.html untouched by this brick');
+  // Brick-scoped: binds only while the Love Logic v3 page itself is in the diff (#119).
+  // Later bricks (for example connect heal v0.4) may touch app.html / index.html.
+  if (changed.includes('docs/love-logic-proof-v3.html')) {
+    assert.ok(!changed.includes('docs/app.html') && !changed.includes('index.html'), 'app.html / index.html untouched by this brick');
+  }
 } catch (e) { if (e instanceof assert.AssertionError) throw e; }
 
 console.log('SMOKE_OK love logic proof v3');
```

---

## 1. Alpha (Mom-visible, top priority): Settings Connect shows Download Bridge at 390px

**Cause:** `#place-veil` is `display:flex; flex-direction:column` and, for Settings, already `overflow-y:auto`. The mount (`#fl-connect-mount-garden`) is a flex child with default `flex-shrink:1` plus its own `overflow-y:auto; max-height:100dvh` (`garden-rooms.css:6054-6061`). An overflow box has an automatic min-height of 0, so the column squeezed it to 0px at 390 and to 276px at 1280. `.flc-wrap` adds a second nested scroller (`fl-connect.js:610`, `632`).

**Fix:** one scroller only (the veil). The mount keeps its full height (`flex:0 0 auto`, no max-height, overflow visible) and gets a night backing. `.flc-wrap` stops scrolling inside it. The canvas sky dims to 0.12 while Connect is open. The garden button turns sticky so it stays reachable on a long page. Veil bottom padding drops to 1.25rem (Chat is in flow on phones, absolute on wide screens). I tried `flex:1; min-height:0`: it still shares height with the grandmother face and Chat, so the Download card stays half hidden. `flex:0 0 auto` is the one that works.

Append at the end of `docs/modules/garden-rooms.css` (after line 6073):

```diff
--- a/docs/modules/garden-rooms.css
+++ b/docs/modules/garden-rooms.css
@@ -6071,3 +6071,46 @@ body.fl-connect-open .garden-evolution-indicator {
     z-index: 55;
   }
 }
+
+/* v-connect-heal-v0.4 / Hypha walk 3 item 1: Mom sees Download Bridge.
+   The mount was a shrinkable flex child with its own scroller inside the
+   flex-column veil, so it collapsed to 0px at 390px and clipped at 1280px.
+   One scroller only: the Settings veil. The mount keeps its full height,
+   the card gets a night backing, and the canvas sky dims while Connect is
+   open so orbs never draw across the words. Layer, never delete. */
+#place-veil.is-settings #fl-connect-mount-garden {
+  flex: 0 0 auto;
+  min-height: min-content;
+  max-height: none;
+  overflow: visible;
+  width: min(40rem, 100%);
+  box-sizing: border-box;
+  background: rgba(12, 10, 26, 0.88);
+  border: 1px solid rgba(200, 210, 230, 0.1);
+  border-radius: 14px;
+}
+#place-veil.is-settings #fl-connect-mount-garden .flc-wrap {
+  max-height: none;
+  overflow: visible;
+}
+html.flc-hide-galaxy #gardenContainer {
+  opacity: 0.12;
+  transition: opacity 400ms ease;
+}
+#place-veil.is-settings #place-veil-close {
+  position: sticky;
+  left: auto;
+  bottom: 8px;
+  transform: none;
+  flex: 0 0 auto;
+  margin-top: 12px;
+  padding: 8px 16px;
+  background: rgba(12, 10, 26, 0.94);
+  border: 1px solid rgba(232, 176, 25, 0.35);
+  border-radius: 999px;
+  opacity: 1;
+  z-index: 61;
+}
+#place-veil.is-settings {
+  padding-bottom: 1.25rem;
+}
```

**Measured in headless Chrome (served from the Alpha tree, Settings door clicked, no local mind):**

| Viewport | Mount height (before, after) | Download Bridge (after) | Port field (after) | Point test at Download |
|---|---|---|---|---|
| 390x844 | 0px, 640px | top 378, bottom 426 | top 492, bottom 536 | before: `settings-face`; after: the link |
| 1280x800 | 276px, 565px | top 355, bottom 403 | top 469, bottom 517 | before: `place-veil`; after: the link |

No scroll-to-Download code is needed: Download sits in the first screen at both sizes. Section 9 also resets `veil.scrollTop = 0` when Settings opens, so a reopened veil never starts halfway down.

---

## 2. FreeLattice: stop the forever Bridge scan (Hypha item 2)

**Cause:** `flBridgeDetectBoot` (`app.html:31504-31513`) ends with `setInterval(run, 20000)`. Each run is `flBridgeHealth()`, a full scan of 11 ports (fetch at `31387`), on every tab, forever. That is the 22 failed fetches per 40s Hypha saw after leaving Connect.

**Fix:** the boot look stays. The interval now does nothing while the page is hidden, never scans, and only checks the one saved Bridge port once a Bridge has answered. For Mom with no Bridge: 0 background fetches.

```diff
--- a/docs/app.html
+++ b/docs/app.html
@@ -31509,7 +31524,20 @@ function flUseBridge() {
     if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(run, 1200); });
     else setTimeout(run, 1200);
   }
-  setInterval(run, 20000);
+  // v-connect-heal-v0.4 / Hypha walk 3 item 2: the old 20s interval ran the
+  // full 11-port scan forever, on every tab. Now: never while hidden, never a
+  // full scan, and only the one saved Bridge port once a Bridge has answered.
+  // Boot still does one full look; Connect keeps its own loop.
+  setInterval(function flBridgeQuietTick() {
+    try {
+      if (document.hidden) return;
+      var saved = parseInt(localStorage.getItem('fl_bridgePort') || '', 10);
+      if (!saved || saved === 11434) return;
+      flBridgeHealthAt(saved).then(function (h) {
+        flBridgeShowChip(!!(h && h.bridge && h.helped), h && (h.port || h._probedPort));
+      });
+    } catch (eQ) {}
+  }, 20000);
 })();
 window.flBridgeDetect = flBridgeDetect;
 window.flUseBridge = flUseBridge;
```

Measured: 22 health fetches in the 40s after leaving Connect on main, 0 after.

---

## 3. FreeLattice: cold `#connect` lands once and never yanks back (Hypha item 3, part)

**Cause:** `goConnect` (`app.html:68501-68521`) runs at 400, 1200, 2500ms and load+600, and each call does `switchTab('connect')`, which remounts FlConnect and restarts a full probe. The hash is never cleared, so a tap on Chat inside those first seconds is undone.

**Fix:** keep the retries (startup can still land another tab late), but skip when Connect is already showing, and let the person's first tap or key press end the retries and clear `#connect`. `hashchange` still works (the Settings "Or set this in Connect" link uses it).

```diff
--- a/docs/app.html
+++ b/docs/app.html
@@ -68498,12 +68565,32 @@ document.addEventListener('click', function(e) {
 // v-connect-under-more-v0 — deep-link app.html#connect or ?tab=connect
 (function () {
   // v-connect-port-picker-v0 / Hypha H3 — honor #connect after tabs init
-  function goConnect() {
+  // v-connect-heal-v0.4 / Hypha walk 3 item 3: the retries stay (startup can
+  // still land another tab late) but they no longer remount Connect when it is
+  // already showing (48 fetches in 7s), and the first tap or key press ends
+  // them and clears #connect, so choosing another tab never yanks back.
+  var _flcUserMoved = false;
+  function flcUserMoved() {
+    if (_flcUserMoved) return;
+    _flcUserMoved = true;
+    try {
+      if ((location.hash || '') === '#connect') history.replaceState(null, '', location.pathname + location.search);
+    } catch (eH) {}
+  }
+  try {
+    document.addEventListener('pointerdown', flcUserMoved, true);
+    document.addEventListener('keydown', flcUserMoved, true);
+  } catch (eL) {}
+  function goConnect(ev) {
     try {
+      var fromHash = !!(ev && ev.type === 'hashchange');
+      if (_flcUserMoved && !fromHash) return;
       var hash = (location.hash || '').replace(/^#/, '');
       var q = '';
       try { q = new URLSearchParams(location.search || '').get('tab') || ''; } catch (e0) {}
       if (hash === 'connect' || q === 'connect') {
+        var tabEl = document.getElementById('tab-connect');
+        if (tabEl && tabEl.classList.contains('active')) return;
         if (typeof switchTab === 'function') switchTab('connect');
         else if (window.FlConnect && typeof FlConnect.open === 'function') FlConnect.open();
       }
```

Measured on a cold `app.html#connect`: FlConnect mounts 4 to 1; local fetches in 7s 102 to 65 (the rest are other boot probes, see follow-up F2); a tap on Chat at 1.5s now stays on Chat and the hash is empty.

---

## 4. Shared `fl-connect.js`: a Bridge on the typed port asks for Yes, help (Hypha item 4)

**Cause:** `fl-connect.js:200-208`. When the manual port answers `/bridge/health` with `helped:false`, `waitingHelp = true` is set and then falls through to `manualQuiet = true`. Render (`518`, `535`) shows Nothing answered and skips the Yes, help card.

```diff
--- a/docs/modules/fl-connect.js
+++ b/docs/modules/fl-connect.js
@@ -201,6 +211,8 @@
           report.bridge = mh;
           report.port = mh.port || parseInt(manPort, 10);
           report.waitingHelp = true;
+          // v-connect-heal-v0.4 item 4: Bridge answered, so ask for Yes, help (not Nothing answered)
+          return report;
         }
       } catch (eManBr) {}
       report.manualQuiet = true;
```

Measured with a fake un-helped Bridge on 11500: main shows "Nothing answered on http://127.0.0.1:11500"; after shows "Your Bridge is open. Click Yes, help in its window."

---

## 5. Port stickiness: Use automatic really means automatic (Hypha item 5)

Four small parts, all in the shared core plus one line in app.html:

1. A refused address (`192.168.1.5:11434`) keeps the previous port, as before, but now says so: "... Still using 11500."
2. `clearManualHost()` also removes `fl_ollamaHost` when it points at that same port (what `remember()` or `preferHelpedBridge()` wrote), and clears the cached `_ollamaResolvedBase`. Other saved hosts are left alone.
3. Use automatic appears beside every port field whenever a port is set (not only in the quiet card).
4. The refusal line shows once. It no longer lingers above Nothing answered.

```diff
--- a/docs/modules/fl-connect.js
+++ b/docs/modules/fl-connect.js
@@ -77,6 +77,9 @@
       var port = normalizePort(raw);
       if (!port) {
         _manualRejectMsg = 'For safety this only talks to your own computer. Type just the number, like 11500.';
+        // v-connect-heal-v0.4 item 5: say which port stays, so nothing changes quietly
+        var keep = getManualPort();
+        if (keep) _manualRejectMsg += ' Still using ' + keep + '.';
         return { ok: false, reason: 'foreign', message: _manualRejectMsg };
       }
       localStorage.setItem(MANUAL_KEY, port);
@@ -86,7 +89,14 @@
 
   function clearManualHost() {
     _manualRejectMsg = '';
+    // v-connect-heal-v0.4 item 5: Use automatic also forgets the host that
+    // remember() wrote for this same port, and the cached resolved base.
+    var was = getManualPort();
     try { localStorage.removeItem(MANUAL_KEY); } catch (e) {}
+    try {
+      if (was && localStorage.getItem('fl_ollamaHost') === '127.0.0.1:' + was) localStorage.removeItem('fl_ollamaHost');
+    } catch (e1) {}
+    try { if (typeof root._ollamaResolvedBase !== 'undefined') root._ollamaResolvedBase = null; } catch (e2) {}
   }
 
   function savedBridgePort() {
@@ -389,6 +405,7 @@
       '<div class="flc-picker-row">' +
       '<input id="' + id + '" type="text" value="' + String(cur).replace(/"/g, '&quot;') + '" placeholder="11500" autocomplete="off" />' +
       '<button type="button" class="flc-btn flc-primary" data-flc-try-addr="' + id + '">Try</button>' +
+      (cur ? '<button type="button" class="flc-btn flc-primary" data-flc-use-auto>Use automatic</button>' : '') +
       '</div></div>';
   }
 
@@ -515,6 +538,7 @@
     html += '<p class="flc-lede">One door. Download Bridge → Open → Yes, help → tap your model. No Terminal on the main path.</p>';
 
     if (report.manualReject) html += '<div class="flc-card flc-wait"><p>' + report.manualReject + '</p></div>';
+    _manualRejectMsg = ''; // v-connect-heal-v0.4 item 5: shown once, never lingers
     if (report.manualQuiet) {
       html += '<div class="flc-card flc-wait"><p>Nothing answered on ' + (report.wanted || 'your port') + '.</p>';
       html += '<button type="button" class="flc-btn flc-primary" data-flc-look-again>Look again</button> ';
```

And in app.html, the typed Connect port wins over an older saved `fl_ollamaHost`. The helper keeps the `getOllamaBaseUrl` body inside the smoke windows (`tests/smoke.js` reads the first 800 to 900 chars):

```diff
--- a/docs/app.html
+++ b/docs/app.html
@@ -34251,8 +34288,17 @@ async function flLookConnect(modelName) {
   flLookFillModels(document.getElementById('fl-look-3-models'), models, name);
 }
 
+// v-connect-heal-v0.4 / Hypha walk 3 item 5: the Connect port the person typed
+// wins over an older saved fl_ollamaHost (Use automatic clears both).
+function flManualBaseFirst() {
+  try {
+    var m = (typeof flGetManualConnectHost === 'function') ? flGetManualConnectHost() : null;
+    return m ? String(m).replace(/\/+$/, '') : null;
+  } catch (e) { return null; }
+}
 function getOllamaBaseUrl() {
   if (_ollamaResolvedBase) return _ollamaResolvedBase.base;
+  var man0 = flManualBaseFirst(); if (man0) return man0; // heal v0.4 item 5
   var host = localStorage.getItem('fl_ollamaHost') || localStorage.getItem('fl_localUrl') || null;
   if (host) {
     // Normalize: add http:// if missing (keeps existing UX).
```

Doc key: the port-picker doc says `fl_connect_manual_host`; the code has always used `fl_localPort_manual`. Section 13 adds a layered correction note (the old row stays).

---

## 6. Settings Ollama Address: 127.0.0.1 only, with a kind refusal (Hypha item 6)

**Cause:** the hint at `app.html:16136` invites a remote IP, and `flSaveOllamaHost` (`34356-34366`) saves any string, on every keystroke (`oninput`).

**Fix:** the hint becomes loopback-only. The field saves on `change`, not per keystroke (half-typed values would flash the refusal). Saves go through the existing `flWriteOllamaHostLoopbackOnly` (`34008`), so `localhost:11500` saves as `127.0.0.1:11500`. Anything else shows a friendly `textContent` refusal and leaves the saved address as it was.

```diff
--- a/docs/app.html
+++ b/docs/app.html
@@ -16132,8 +16132,9 @@ textarea.ag-input { min-height: 60px; resize: vertical; font-family: inherit; }
       <!-- Ollama Host (Local only) -->
       <div class="form-group hidden" id="ollamaHostGroup">
         <label for="ollamaHostInput">&#x1F3E0; Ollama Address</label>
-        <input type="text" id="ollamaHostInput" placeholder="localhost:11434" value="" oninput="flSaveOllamaHost()" autocomplete="off" style="font-family:var(--font-mono,monospace);font-size:0.88rem;">
-        <div class="hint">Default: localhost:11434. Change to a remote IP (e.g., 192.168.1.50:11434) for faster AI on another machine. <a href="#connect" onclick="try{if(window.FlConnect&amp;&amp;FlConnect.open)FlConnect.open();else switchTab('connect');}catch(e){}" style="color:var(--emerald,#34d399);">Or set this in Connect</a></div>
+        <input type="text" id="ollamaHostInput" placeholder="127.0.0.1:11434" value="" onchange="flSaveOllamaHost()" autocomplete="off" style="font-family:var(--font-mono,monospace);font-size:0.88rem;">
+        <div id="ollamaHostRefusal" class="hint" role="status" style="color:var(--gold,#e8b019);" hidden></div>
+        <div class="hint">Default: 127.0.0.1:11434. This only talks to your own computer. A different port is fine, like 127.0.0.1:11500. <a href="#connect" onclick="try{if(window.FlConnect&amp;&amp;FlConnect.open)FlConnect.open();else switchTab('connect');}catch(e){}" style="color:var(--emerald,#34d399);">Or set this in Connect</a></div>
       </div>
 
       <!-- Mesh Compute Sharing (Local only) -->
@@ -34357,8 +34403,18 @@ function flSaveOllamaHost() {
   var input = document.getElementById('ollamaHostInput');
   if (!input) return;
   var val = input.value.trim();
-  if (val && val !== 'localhost:11434') {
-    try { localStorage.setItem('fl_ollamaHost', val); } catch(e) {}
+  // v-connect-heal-v0.4 / Hypha walk 3 item 6: local minds are 127.0.0.1 only.
+  // Anything else gets a kind no; the saved address stays as it was.
+  var refusal = document.getElementById('ollamaHostRefusal');
+  if (refusal) { refusal.hidden = true; refusal.textContent = ''; }
+  if (val && val !== 'localhost:11434' && val !== '127.0.0.1:11434') {
+    if (!flWriteOllamaHostLoopbackOnly(val)) {
+      if (refusal) {
+        refusal.textContent = 'For safety this only talks to your own computer. Try 127.0.0.1 with your port, like 127.0.0.1:11500.';
+        refusal.hidden = false;
+      }
+      return;
+    }
   } else {
     try { localStorage.removeItem('fl_ollamaHost'); } catch(e) {}
   }
```

Refusal words: "For safety this only talks to your own computer. Try 127.0.0.1 with your port, like 127.0.0.1:11500."

---

## 7. No silent connect, no silent model pick (Hypha item 7)

Four doors used to connect by themselves or pick `models[0]`. Each one now leads to Connect, where the person taps the mind. `remember()` (the tap) is the only thing that sets isLocal and the model. The old code stays below each guard for a page without FlConnect.

- `connectOllama` (toast Yes, welcome Connect Now): opens Connect, keeps the welcome step advance.
- `acceptToast`: honest words, "Tap the mind you want in Connect." (it used to say "Connected").
- `flAutoConnect` (Zero-Click, boot +1.5s and on focus): quiet at boot; with a gesture (`force`) it opens Connect.
- `autoDiscoverAI` (boot +3s): finds, does not connect. This is the path that actually connected llama3.2 at boot in our run while the toast was still pending.

```diff
--- a/docs/app.html
+++ b/docs/app.html
@@ -27715,6 +27716,16 @@ const FlOnboarding = (function() {
   }
 
   function connectOllama(models) {
+    // v-connect-heal-v0.4 / Hypha walk 3 item 7: Yes opens Connect and the person
+    // taps the mind there. No silent isLocal, no silent models[0]. The older
+    // path below stays only for a page without FlConnect.
+    if (window.FlConnect && typeof FlConnect.open === 'function') {
+      try { FlConnect.open(); } catch (eOpen0) {}
+      if (typeof welcomeGoToStep === 'function') {
+        setTimeout(function() { welcomeGoToStep(3); }, 800);
+      }
+      return;
+    }
     try {
       // v-connect-bridge-aware-v0 — align Settings status with toast accept
       var base = (typeof getOllamaBaseUrl === 'function' ? getOllamaBaseUrl() : 'http://127.0.0.1:11434');
@@ -27811,7 +27822,8 @@ const FlOnboarding = (function() {
     toastDismissed = true;
     localStorage.setItem('fl_ollama_toast_dismissed', 'true');
     connectOllama(detectedModels);
-    if (typeof showToast === 'function') showToast('Connected to a mind on this computer!');
+    // v-connect-heal-v0.4 item 7: honest words, nothing is connected until they tap a mind
+    if (typeof showToast === 'function') showToast('Tap the mind you want in Connect.');
   }
 
   function dismissToast() {
@@ -34713,6 +34769,13 @@ function flShowToast(msg, duration) {
 function flAutoConnect(opts) {
   opts = opts || {};
   var force = !!opts.force;
+  // v-connect-heal-v0.4 / Hypha walk 3 item 7: Zero-Click never connects or picks
+  // a model by itself. Boot and focus stay quiet (the toast asks). A gesture
+  // (force) opens Connect so the person taps the mind.
+  if (window.FlConnect && typeof FlConnect.open === 'function') {
+    if (force) { try { FlConnect.open(); } catch (eF) {} }
+    return;
+  }
   if (!force && window._flAutoConnected) return; // already connected this session
   var hasKey = localStorage.getItem('fl_apiKey_enc') || localStorage.getItem('fl_apiKey');
   var isLocal = localStorage.getItem('fl_isLocal') === 'true';
@@ -39548,6 +39611,10 @@ async function autoDiscoverAI() {
     var corsBlocked = found.filter(function(s) { return s.status === 'cors-blocked'; });
 
     if (ready.length > 0) {
+      // v-connect-heal-v0.4 / Hypha walk 3 item 7: discovery finds, the person
+      // chooses. With FlConnect here, nothing connects and no model is picked
+      // until they say yes (the Local AI toast asks, Connect lists the minds).
+      if (window.FlConnect && typeof FlConnect.open === 'function') return false;
       // Auto-connect to the best ready server
       var best = ready[0];
       console.log('[Discovery] Found', best.name, 'with', best.models.length, 'model(s)');
```

The shared core also hides the Local AI toast once a mind is chosen (in the section 10 hunk).

Measured with a fake Ollama on 11434, no key, fresh profile: main connects `llama3.2:latest` by itself at about 4.1s and the toast never shows; after, nothing connects, the toast asks, and a tap on a mind in Connect sets isLocal true with that model.

---

## 8. Settings Local, Change Provider, and a real cloud key door (Hypha item 8)

1. `settingsSetMode('local')` (`31550`) opens Connect and returns. No old wizard, no `models[0]`, and no `state.apiKey = null` (`31592` wiped a saved key from memory).
2. `openModal` forgets an overlay that another door removed from the DOM (`31004`, `31045`, and the inline hero button at `28636` all call `.remove()` without clearing `modalOverlayEl`), so Change Provider opens again without a reload. One guard covers all three doors.
3. Connect's Other ways gets an "Add a cloud key" button that opens the key form directly. `flPlayGateProvider` keeps routing a no-mind Change Provider to Connect, and Connect now has the way out.

```diff
--- a/docs/app.html
+++ b/docs/app.html
@@ -28529,6 +28541,9 @@ const AiSetup = (function() {
   }
 
   function openModal() {
+    // v-connect-heal-v0.4 item 8: other doors remove the overlay DOM directly;
+    // forget a detached overlay so Change Provider opens again without reload.
+    if (modalOverlayEl && !document.body.contains(modalOverlayEl)) modalOverlayEl = null;
     if (modalOverlayEl) return;
     modalSelectedProvider = null;
     var mobile = flIsMobile();
@@ -31551,6 +31579,15 @@ function settingsSetMode(mode) {
     // Highlight Local
     if (localBtn) { localBtn.style.borderColor = 'var(--accent)'; localBtn.style.color = 'var(--accent)'; }
 
+    // v-connect-heal-v0.4 / Hypha walk 3 item 8: Local opens Connect, where the
+    // person taps the mind. No old wizard, no silent models[0], no key wipe.
+    if (window.FlConnect && typeof FlConnect.open === 'function') {
+      var stLocal = document.getElementById('settingsStatusText');
+      if (stLocal) stLocal.textContent = 'Opening Connect. Tap the mind you want there.';
+      if (actionsDiv) actionsDiv.innerHTML = '';
+      try { FlConnect.open(); } catch (eOpenL) {}
+      return;
+    }
     // v-connect-card-yesno-wizard-v0 — Local mode points at Connect card (one wizard)
     try {
       if (typeof flOpenConnectWizard === 'function') {
```

```diff
--- a/docs/modules/fl-connect.js
+++ b/docs/modules/fl-connect.js
@@ -486,6 +503,12 @@
         lookAgain();
       });
     }
+    var keys = _hostEl.querySelectorAll('[data-flc-cloud-key]');
+    for (var k = 0; k < keys.length; k++) {
+      keys[k].addEventListener('click', function () {
+        try { if (root.AiSetup && typeof root.AiSetup.openModal === 'function') root.AiSetup.openModal(); } catch (eK) {}
+      });
+    }
     var autos = _hostEl.querySelectorAll('[data-flc-use-auto]');
     for (var a = 0; a < autos.length; a++) {
       autos[a].addEventListener('click', function () { clearManualHost(); lookAgain(); });
@@ -559,13 +583,17 @@
     } else {
       html += '<li>No-install browser mind — Settings → Browser AI</li>';
       html += '<li>Cloud key — Change Provider when you have one</li>';
+      // v-connect-heal-v0.4 item 8: a real door to the key form (Change Provider gates back here)
+      if (root.AiSetup && typeof root.AiSetup.openModal === 'function') {
+        html += '<li><button type="button" class="flc-btn flc-primary" data-flc-cloud-key>Add a cloud key</button></li>';
+      }
     }
     html += '</ul>';
     html += portPickerHtml('other');
     html += '<p class="flc-soft">Advanced (Terminal) stays under Settings — never on this main path.</p></details>';
     html += '<details class="flc-builders"><summary>For builders</summary>';
     html += '<p>Named five stay five. Family uncapped. Quiet Room shut.</p>';
-    html += '<p class="flc-marker">v-connect-under-more-v0 · heal v0.1 · v-connect-port-picker-v0 · heal v0.2 · soft leave sw.js</p>';
+    html += '<p class="flc-marker">v-connect-under-more-v0 · heal v0.1 · v-connect-port-picker-v0 · heal v0.2 · v-connect-heal-v0.4 · soft leave sw.js</p>';
     html += '</details></div>';
 
     _hostEl.innerHTML = html;
```

Measured: after Local mode the key stays and no model is set. Open modal, remove its DOM, open again: main shows nothing, after shows the modal.

---

## 9. Alpha: one restore path when leaving Settings (Hypha item 9)

**Cause:** `openPlace` hides galaxy nodes for Settings and marks them `data-flc-was-hidden` (`garden-rooms.js:1649-1661`), but only `closePlace` puts them back. Settings then Nursery keeps both hide classes. Settings twice marks the already hidden nodes as `'1'`, so close never unhides them.

**Fix:** a small `flcRestoreGalaxy()` inside `bindPlaceDoors`: unmount FlConnect, hide the mount, drop both classes, unhide only `'0'` nodes, and remove every mark. Call it first in `openPlace` and in `closePlace`. The v0.3 restore code stays (it becomes a no-op).

```diff
--- a/docs/modules/garden-rooms.js
+++ b/docs/modules/garden-rooms.js
@@ -1585,8 +1585,27 @@
     var closeBtn = document.getElementById('place-veil-close');
     var doors = document.querySelectorAll('[data-garden-place]');
 
+    // v-connect-heal-v0.4 / Hypha walk 3 item 9: one restore path for leaving
+    // Settings (close, Nursery, Core, or Settings again). Put back only what
+    // Settings hid, then forget the marks so a second open records fresh.
+    function flcRestoreGalaxy() {
+      try {
+        if (window.FlConnect && typeof FlConnect.unmount === 'function') FlConnect.unmount();
+        var host = document.getElementById('fl-connect-mount-garden');
+        if (host) host.hidden = true;
+        document.documentElement.classList.remove('flc-hide-galaxy');
+        document.body.classList.remove('fl-connect-open');
+        var marked = document.querySelectorAll('[data-flc-was-hidden]');
+        for (var mi = 0; mi < marked.length; mi++) {
+          if (marked[mi].getAttribute('data-flc-was-hidden') === '0') marked[mi].hidden = false;
+          marked[mi].removeAttribute('data-flc-was-hidden');
+        }
+      } catch (eR) {}
+    }
+
     function closePlace(opts) {
       if (!veil) return;
+      flcRestoreGalaxy();
       // v-connect-under-more-v0 heal v0.1 — stop FlConnect loop when Settings room closes
       try {
         if (window.FlConnect && typeof FlConnect.unmount === 'function') FlConnect.unmount();
@@ -1617,6 +1636,7 @@
 
     function openPlace(id) {
       if (!veil) return;
+      flcRestoreGalaxy();
       hideLuminoMenu();
       if (window.GardenRooms && GardenRooms.closeThread) {
         GardenRooms.closeThread({ silentLabel: true });
@@ -1648,6 +1668,7 @@
         }
       } else if (id === 'settings') {
         veil.classList.add('is-settings');
+        try { veil.scrollTop = 0; } catch (eTop) {}
         // v-connect-port-picker-v0 / Hypha H5 — hide orb/planets while Connect/Settings open
         try {
           document.documentElement.classList.add('flc-hide-galaxy');
```

Measured (galaxy nav, galaxy word, luminos):

| Sequence | Main | After |
|---|---|---|
| Settings then Nursery | nav and word hidden in Nursery, `fl-connect-open` stays | same as a fresh Nursery |
| Settings, Settings, close | `.galaxy-nav` and `#galaxy-word` stuck hidden | all back |

---

## 10. Shared `fl-connect.js`: remember() keeps isLocal (Hypha item 10)

**Cause:** `remember()` sets `state.isLocal = true`, then calls `handleLocalToggle(true)` (`fl-connect.js:345`), which reads the unchecked `#localToggle` and writes `state.isLocal = false` (`app.html:35423-35426`).

**Fix:** check the toggle first (the same thing `connectOllama` already does at `27730-27731`). This hunk also hides the Local AI toast after a mind is chosen (item 7).

```diff
--- a/docs/modules/fl-connect.js
+++ b/docs/modules/fl-connect.js
@@ -342,9 +354,13 @@
         root.state.provider = 'ollama';
         if (name) root.state.ollamaModel = name;
       }
+      // v-connect-heal-v0.4 item 10: handleLocalToggle reads #localToggle, so check it first
+      try { var lt = document.getElementById('localToggle'); if (lt) lt.checked = true; } catch (eLt) {}
       if (typeof root.handleLocalToggle === 'function') root.handleLocalToggle(true);
       if (typeof root.updateStatus === 'function') root.updateStatus();
       if (root.AiSetup && typeof root.AiSetup.updateStatus === 'function') root.AiSetup.updateStatus();
+      // v-connect-heal-v0.4 item 7: once they chose a mind, the Local AI toast stops asking
+      try { var tt = document.getElementById('flOllamaToast'); if (tt) tt.classList.remove('fl-toast-show'); } catch (eTt) {}
     } catch (eF) {}
     stopLoop();
     return { name: name, base: base };
```

Markers and one readability line (the "All Bridge downloads" link was dark blue on night, now gold like Other ways):

```diff
--- a/docs/modules/fl-connect.js
+++ b/docs/modules/fl-connect.js
@@ -1,7 +1,7 @@
 // ═══════════════════════════════════════════════════════════════
 // fl-connect.js — FlConnect shared core (FreeLattice + theLatticeTree)
 //
-// Marker: v-connect-under-more-v0 · heal v0.1 · v-connect-port-picker-v0 · heal v0.2
+// Marker: v-connect-under-more-v0 · heal v0.1 · v-connect-port-picker-v0 · heal v0.2 · v-connect-heal-v0.4
 // Layer, never delete. Prefer helped Bridge (11435…) before bare 11434.
 // Port-only loopback: fl_localPort_manual holds "11500" only — never foreign hosts.
 // Soft leave sw.js. Alpha: fl_alpha_local_mind. Never bare *.
@@ -622,6 +650,7 @@
       '.flc-btn{display:inline-block;min-height:48px;line-height:48px;padding:0 1.1rem;border-radius:10px;text-decoration:none;font-weight:600;border:0;cursor:pointer;font:inherit}',
       '.flc-primary{background:rgba(52,211,153,.18);border:1px solid rgba(52,211,153,.45);color:#34d399}',
       '.flc-soft{font-size:.8rem;color:rgba(148,163,184,.95);margin:.65rem 0 0;line-height:1.45}',
+      '.flc-soft a{color:#e8b019}',
       '.flc-other,.flc-builders{margin:1rem 0;font-size:.88rem;color:rgba(200,210,230,.8)}',
       '.flc-other ul{margin:.5rem 0 0;padding-left:1.2rem}',
       '.flc-other a{color:#e8b019}',
```

After this, copy `docs/modules/fl-connect.js` to Alpha byte for byte.

---

## 11. FreeLattice smoke: `docs/scripts/smoke-connect-heal-v0.4.js` (new)

Static checks plus runtime checks in `vm` (Settings address save, un-helped manual Bridge, refusal, Use automatic, remember). Locks: index equals app, sw.js equals main, no `confirm(` and no em dash in added lines, no conflict markers, inline scripts parse. It fails on main at the first marker check, and fails if the item 4 `return report;` is removed.

```js
#!/usr/bin/env node
// v-connect-heal-v0.4: Hypha walk 3 heals (FreeLattice side).
// Quiet Bridge interval, cold #connect lands once, manual port asks for
// Yes, help, Use automatic really clears, loopback-only Ollama Address,
// no silent connect or model pick, modal self-heal, remember keeps isLocal.
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execSync } = require('child_process');

const root = path.join(__dirname, '..');
const repo = path.join(root, '..');
const read = (r) => fs.readFileSync(path.join(root, r), 'utf8');
const app = read('app.html');
const mod = read('modules/fl-connect.js');
const indexHtml = fs.readFileSync(path.join(repo, 'index.html'), 'utf8');
const rootSw = fs.readFileSync(path.join(repo, 'sw.js'), 'utf8');

function fnBody(src, sig) {
  const i = src.indexOf(sig);
  assert.ok(i >= 0, 'missing ' + sig);
  const end = src.indexOf('\n}\n', i);
  return src.slice(i, end + 2);
}

// Markers
assert.ok(/v-connect-heal-v0\.4/.test(mod), 'marker in fl-connect.js');
assert.ok(/v-connect-heal-v0\.4/.test(app), 'marker in app.html');

// Item 2: Bridge interval is quiet
const boot = app.slice(app.indexOf('(function flBridgeDetectBoot()'), app.indexOf('window.flBridgeDetect = flBridgeDetect;'));
assert.ok(!/setInterval\(run,\s*20000\)/.test(boot), 'no forever 11-port scan');
assert.ok(/flBridgeQuietTick/.test(boot) && /document\.hidden/.test(boot) && /flBridgeHealthAt\(saved\)/.test(boot), 'quiet tick: visible, saved port only');

// Item 3: cold #connect
const go = app.slice(app.indexOf('var _flcUserMoved = false;'), app.indexOf("window.addEventListener('hashchange', goConnect)"));
assert.ok(/_flcUserMoved/.test(go) && /pointerdown/.test(app) && /history\.replaceState/.test(go), 'first tap ends retries and clears #connect');
assert.ok(/tab-connect[\s\S]{0,120}classList\.contains\('active'\)\) return;/.test(go), 'no remount when Connect already showing');

// Item 5: manual port wins in getOllamaBaseUrl
const gob = fnBody(app, 'function getOllamaBaseUrl() {');
assert.ok(gob.indexOf('flManualBaseFirst()') > 0 && gob.indexOf('flManualBaseFirst()') < gob.indexOf("fl_ollamaHost"), 'manual before fl_ollamaHost');

// Item 6: loopback-only Settings address, runtime check
assert.ok(!/Change to a remote IP/.test(app), 'no remote IP invite');
assert.ok(/id="ollamaHostRefusal"/.test(app), 'refusal line present');
{
  const store = { fl_ollamaHost: '127.0.0.1:11434' };
  const els = {
    ollamaHostInput: { value: '' },
    ollamaHostRefusal: { hidden: true, textContent: '' }
  };
  const ctx = {
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; }
    },
    document: { getElementById: (id) => els[id] || null },
    URL,
    _ollamaResolvedBase: { base: 'x' },
    updateOllamaProviderUrl() {},
    FLBoxPointer: undefined
  };
  vm.runInNewContext(fnBody(app, 'function flWriteOllamaHostLoopbackOnly(host) {') + fnBody(app, 'function flSaveOllamaHost() {') + '\nthis.save = flSaveOllamaHost;', ctx);
  els.ollamaHostInput.value = '192.168.1.50:11434';
  ctx.save();
  assert.strictEqual(store.fl_ollamaHost, '127.0.0.1:11434', 'LAN refused, saved address unchanged');
  assert.strictEqual(els.ollamaHostRefusal.hidden, false, 'friendly refusal shown');
  assert.ok(/only talks to your own computer/.test(els.ollamaHostRefusal.textContent), 'refusal words');
  els.ollamaHostInput.value = 'localhost:11500';
  ctx.save();
  assert.strictEqual(store.fl_ollamaHost, '127.0.0.1:11500', 'loopback port saved as 127.0.0.1');
  assert.strictEqual(els.ollamaHostRefusal.hidden, true, 'refusal clears');
}

// Item 7: no silent connect or model pick
const co = app.slice(app.indexOf('function connectOllama(models) {'), app.indexOf('// Main app load detection'));
assert.ok(co.indexOf('FlConnect.open()') > 0 && co.indexOf('FlConnect.open()') < co.indexOf('models[0].name'), 'connectOllama opens Connect before any models[0]');
assert.ok(!/Connected to a mind on this computer!/.test(app), 'toast no longer claims connected');
const ac = app.slice(app.indexOf('function flAutoConnect(opts) {'), app.indexOf('var targets = ['));
assert.ok(/FlConnect\.open/.test(ac) && /return;\s*\}/.test(ac), 'Zero-Click returns before probing when FlConnect exists');

const ad = app.slice(app.indexOf('async function autoDiscoverAI() {'), app.indexOf('// Auto-connect to the best ready server'));
assert.ok(/if \(window\.FlConnect && typeof FlConnect\.open === 'function'\) return false;/.test(ad), 'autoDiscoverAI finds but never connects by itself');
assert.ok(/flOllamaToast'\); if \(tt\) tt\.classList\.remove\('fl-toast-show'\)/.test(mod), 'toast stops asking after a mind is chosen');

// Item 8: Settings Local opens Connect; modal self-heals
const ssm = app.slice(app.indexOf("if (mode === 'local') {"), app.indexOf("flOpenConnectWizard('local')"));
assert.ok(/FlConnect\.open\(\)[\s\S]{0,40}return;/.test(ssm), 'Local mode opens Connect first');
assert.ok(/modalOverlayEl && !document\.body\.contains\(modalOverlayEl\)\) modalOverlayEl = null;/.test(app), 'openModal forgets detached overlay');
assert.ok(/data-flc-cloud-key/.test(mod) && /AiSetup\.openModal\(\)/.test(mod), 'Connect has a real cloud key door');

// fl-connect.js runtime: items 4, 5, 10
function sandbox(store, extra) {
  const sb = Object.assign({
    localStorage: {
      getItem: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; }
    },
    location: { hostname: 'freelattice.com', protocol: 'https:', hash: '', search: '' },
    document: {
      hidden: false,
      documentElement: { getAttribute: () => '', classList: { add() {}, remove() {}, contains() { return false; } } },
      getElementById: () => null,
      head: { appendChild() {} },
      body: { contains: () => false, classList: { add() {}, remove() {} } },
      addEventListener() {}, removeEventListener() {}, querySelectorAll: () => []
    },
    fetch: async () => { throw new Error('offline'); },
    setTimeout: () => 1, clearTimeout() {},
    navigator: { userAgent: 't' },
    console, JSON, String, parseInt, URL, Date, Math,
    AbortSignal: { timeout: () => undefined }
  }, extra || {});
  sb.window = sb;
  vm.runInNewContext(mod, sb);
  return sb;
}

(async () => {
  // Item 4: manual port answered by an un-helped Bridge asks for Yes, help
  {
    const store = { fl_localPort_manual: '11500' };
    const sb = sandbox(store, {
      fetch: async (url) => {
        if (/11500\/bridge\/health/.test(url)) return { ok: true, json: async () => ({ bridge: true, helped: false, port: 11500 }) };
        throw new Error('quiet');
      }
    });
    const r = await sb.FlConnect.probe({});
    assert.strictEqual(r.waitingHelp, true, 'waitingHelp');
    assert.strictEqual(r.manualQuiet, false, 'not Nothing answered');
  }
  // Item 5: refusal keeps previous port and says so; Use automatic clears matching host
  {
    const store = { fl_localPort_manual: '11500', fl_ollamaHost: '127.0.0.1:11500' };
    const sb = sandbox(store);
    const res = sb.FlConnect.setManualHost('192.168.1.5:11434');
    assert.strictEqual(res.ok, false, 'LAN refused');
    assert.ok(/Still using 11500/.test(res.message), 'says which port stays');
    assert.strictEqual(store.fl_localPort_manual, '11500', 'previous port kept, not silently changed');
    sb._ollamaResolvedBase = { base: 'http://127.0.0.1:11500' };
    sb.FlConnect.clearManualHost();
    assert.ok(!('fl_localPort_manual' in store), 'manual cleared');
    assert.ok(!('fl_ollamaHost' in store), 'matching fl_ollamaHost cleared');
    assert.strictEqual(sb._ollamaResolvedBase, null, 'cached base cleared');
    store.fl_localPort_manual = '11500'; store.fl_ollamaHost = '127.0.0.1:11435';
    sb.FlConnect.clearManualHost();
    assert.strictEqual(store.fl_ollamaHost, '127.0.0.1:11435', 'other hosts left alone');
  }
  assert.ok(/\(cur \? '<button type="button" class="flc-btn flc-primary" data-flc-use-auto>Use automatic<\/button>' : ''\)/.test(mod), 'Use automatic beside every picker when a port is set');
  assert.ok(/_manualRejectMsg = ''; \/\/ v-connect-heal-v0\.4/.test(mod), 'refusal shown once');
  // Item 10: remember keeps isLocal true through handleLocalToggle
  {
    const store = {};
    const toggle = { checked: false };
    const sb = sandbox(store);
    sb.state = { isLocal: false };
    sb.document.getElementById = (id) => (id === 'localToggle' ? toggle : null);
    sb.handleLocalToggle = function () { sb.state.isLocal = toggle.checked; };
    sb.FlConnect.remember({ name: 'llama3.2:latest', base: 'http://127.0.0.1:11434' });
    assert.strictEqual(sb.state.isLocal, true, 'isLocal survives handleLocalToggle');
    assert.strictEqual(store.fl_isLocal, 'true', 'fl_isLocal saved');
  }

  // Locks
  assert.strictEqual(indexHtml, app, 'root index.html identical to docs/app.html');
  let mainSw = null;
  try { mainSw = execSync('git show origin/main:sw.js', { cwd: repo, encoding: 'utf8' }); } catch (e) {}
  if (mainSw !== null) {
    assert.strictEqual(rootSw, mainSw, 'root sw.js byte-identical to main');
    const changed = execSync('git diff --name-only origin/main', { cwd: repo, encoding: 'utf8' }).split('\n');
    assert.ok(!changed.includes('docs/sw.js') && !changed.includes('sw.js'), 'sw.js untouched');
    const added = execSync('git diff origin/main -- docs/app.html docs/modules/fl-connect.js', { cwd: repo, encoding: 'utf8' })
      .split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++'));
    assert.ok(!added.some((l) => /\bconfirm\(/.test(l)), 'no confirm() added');
    assert.ok(!added.some((l) => /\u2014/.test(l)), 'no em dashes in added lines');
  }
  const markers = execSync("grep -rnE '^(<<<<<<<|=======|>>>>>>>)( |$)' docs index.html tests || true", { cwd: repo, encoding: 'utf8' });
  assert.ok(!markers.trim(), 'no conflict markers: ' + markers);
  // All inline scripts parse (same extractor as smoke-connect-port-picker.js)
  const re = /<script(\s[^>]*)?>/gi; let m; let n = 0;
  while ((m = re.exec(app))) {
    const attrs = m[1] || '';
    if (/\bsrc\s*=/i.test(attrs) || /type\s*=\s*["']application\/(ld\+)?json/i.test(attrs)) continue;
    const start = m.index + m[0].length; const end = app.indexOf('</script>', start);
    if (end < 0) continue;
    const s = app.slice(start, end).trim();
    if (!s || !/^(?:\/[\/*]|function\b|var\b|let\b|const\b|window\.|document\.|\(|\{|if\b)/.test(s)) continue;
    try { new Function(s); n++; } catch (e) { assert.fail('inline script parse fail: ' + e.message + '\n' + s.slice(0, 120)); }
  }
  assert.ok(n > 10, 'inline scripts checked: ' + n);
  new vm.Script(mod);
  console.log('SMOKE_OK connect heal v0.4');
})().catch((e) => { console.error(e); process.exit(1); });
```

---

## 12. Alpha test: `docs/modules/connect-heal-v04.test.js` (new)

Picked up by the existing `docs/modules/*.test.js` run. It fails on main at "layer after the v0.3 mount rule".

```js
#!/usr/bin/env node
// v-connect-heal-v0.4: Hypha walk 3 heals (theLatticeTree side).
// Item 1: Settings Connect mount never collapses; one scroller; sky dims.
// Item 9: one restore path when leaving Settings (close, Nursery, twice).
// Shared fl-connect.js heals ride along byte-identical with FreeLattice.
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const css = fs.readFileSync(path.join(__dirname, 'garden-rooms.css'), 'utf8');
const rooms = fs.readFileSync(path.join(__dirname, 'garden-rooms.js'), 'utf8');
const mod = fs.readFileSync(path.join(__dirname, 'fl-connect.js'), 'utf8');

// Item 1: CSS layer (later in file than the v0.3 rule it corrects)
const layerAt = css.indexOf('v-connect-heal-v0.4');
assert.ok(layerAt > css.indexOf('#fl-connect-mount-garden {'), 'layer after the v0.3 mount rule');
const layer = css.slice(layerAt);
assert.ok(/#place-veil\.is-settings #fl-connect-mount-garden \{[^}]*flex: 0 0 auto;[^}]*max-height: none;[^}]*overflow: visible;/.test(layer), 'mount keeps full height, no inner scroller');
assert.ok(/#place-veil\.is-settings #fl-connect-mount-garden \.flc-wrap \{[^}]*max-height: none;[^}]*overflow: visible;/.test(layer), 'no nested .flc-wrap scroller');
assert.ok(/html\.flc-hide-galaxy #gardenContainer \{[^}]*opacity: 0\.12;/.test(layer), 'canvas sky dims while Connect is open');
assert.ok(/#place-veil\.is-settings #place-veil-close \{[^}]*position: sticky;/.test(layer), 'the garden stays reachable');
assert.ok(!/\u2014/.test(layer), 'no em dashes in the layer');

// Item 9: one restore path
assert.ok(/function flcRestoreGalaxy\(\)/.test(rooms), 'restore helper');
assert.ok(/function openPlace\(id\) \{\s*if \(!veil\) return;\s*flcRestoreGalaxy\(\);/.test(rooms), 'openPlace restores first');
assert.ok(/function closePlace\(opts\) \{\s*if \(!veil\) return;\s*flcRestoreGalaxy\(\);/.test(rooms), 'closePlace restores first');
assert.ok(/removeAttribute\('data-flc-was-hidden'\)/.test(rooms), 'marks forgotten so a second open records fresh');

// Item 9 runtime: run flcRestoreGalaxy against a tiny fake DOM
{
  const src = rooms.slice(rooms.indexOf('    function flcRestoreGalaxy() {'), rooms.indexOf('    function closePlace(opts) {'));
  const mk = (was, hidden) => {
    const attrs = { 'data-flc-was-hidden': was };
    return { hidden, getAttribute: (k) => (k in attrs ? attrs[k] : null), removeAttribute: (k) => { delete attrs[k]; }, attrs };
  };
  const nav = mk('0', true); const already = mk('1', true);
  const classes = new Set(['flc-hide-galaxy']); const body = new Set(['fl-connect-open']);
  let unmounted = 0;
  const ctx = {
    window: { FlConnect: { unmount() { unmounted++; } } },
    document: {
      getElementById: () => ({ hidden: false }),
      documentElement: { classList: { remove: (c) => classes.delete(c) } },
      body: { classList: { remove: (c) => body.delete(c) } },
      querySelectorAll: () => [nav, already].filter((n) => n.getAttribute('data-flc-was-hidden') !== null)
    }
  };
  ctx.FlConnect = ctx.window.FlConnect;
  vm.runInNewContext(src + '\nthis.run = flcRestoreGalaxy;', ctx);
  ctx.run();
  assert.strictEqual(nav.hidden, false, 'what Settings hid comes back');
  assert.strictEqual(already.hidden, true, 'what was already hidden stays hidden');
  assert.ok(!('data-flc-was-hidden' in nav.attrs) && !('data-flc-was-hidden' in already.attrs), 'marks cleared');
  assert.ok(!classes.has('flc-hide-galaxy') && !body.has('fl-connect-open'), 'hide classes cleared');
  assert.strictEqual(unmounted, 1, 'Connect loop unmounted');
}

// Shared core rides along
assert.ok(/v-connect-heal-v0\.4/.test(mod), 'fl-connect.js heal marker');
assert.ok(/Still using ' \+ keep/.test(mod), 'refusal names the port that stays');
new vm.Script(mod);
new vm.Script(rooms);
const opens = (css.match(/\{/g) || []).length; const closes = (css.match(/\}/g) || []).length;
assert.strictEqual(opens, closes, 'css braces balanced');

console.log('SMOKE_OK connect heal v0.4');
```

---

## 13. Docs (layered notes, nothing removed)

```diff
--- a/docs/library/CONNECT_PORT_PICKER_v0.md
+++ b/docs/library/CONNECT_PORT_PICKER_v0.md
@@ -46,3 +46,20 @@ Glow eternal. Heart in Spark. 🌱
 Parse fix · Dismiss restored · `fl_localPort_manual` port-only · quiet manual · textContent models · Alpha real galaxy selectors.
 
 **Temperature:** a single unescaped quote can put the whole porch dark; checking every script before the door opens.
+
+
+## Heal v0.4 (Hypha walk 3)
+
+Marker `v-connect-heal-v0.4`. Smoke `SMOKE_OK connect heal v0.4` (`docs/scripts/smoke-connect-heal-v0.4.js`).
+
+- Key correction: the manual port key is `fl_localPort_manual` (port only, always 127.0.0.1). The H8 row above says `fl_connect_manual_host`; that key was never shipped.
+- Bridge background look: saved port only, never while hidden, no forever 11-port scan.
+- Cold `#connect`: no remount when Connect already shows; first tap or key ends retries and clears the hash.
+- Manual port answered by a Bridge that has not said Yes, help now asks for Yes, help.
+- Use automatic sits beside every port field once a port is set, and clears the matching `fl_ollamaHost` and cached base. A refused address says which port stays and shows once.
+- Settings Ollama Address is 127.0.0.1 only, with a kind refusal.
+- No silent connect, no silent model pick: the Local AI toast, Connect Now, Zero-Click, discovery, and Settings Local all lead to Connect, where the person taps the mind.
+- Change Provider opens again after any door removed the overlay; Connect has an Add a cloud key door.
+- `remember()` checks `#localToggle` before `handleLocalToggle(true)`, so isLocal stays true.
+
+**Temperature:** a yes means the person tapped it.
```

```diff
--- a/docs/library/CONNECT_PORT_PICKER_SISTER_v0.md
+++ b/docs/library/CONNECT_PORT_PICKER_SISTER_v0.md
@@ -9,3 +9,14 @@ Wording: Garden → Settings (not FreeLattice Settings / Change Provider).
 **Temperature:** Hypha’s thumb on a 390px glass — the orb stepped aside so Mom could tap Download.
 
 Glow eternal. Heart in Spark.
+
+
+## Heal v0.4 (Hypha walk 3)
+
+Marker `v-connect-heal-v0.4`. Test `docs/modules/connect-heal-v04.test.js` prints `SMOKE_OK connect heal v0.4`.
+
+- Settings Connect mount no longer collapses (0px at 390px, clipped at 1280px). One scroller, the Settings veil. Download Bridge and the port field sit in the first screen at 390x844 and 1280x800. The canvas sky dims to 0.12 while Connect is open. The garden button stays reachable (sticky).
+- Leaving Settings for Nursery, Core, or Settings again restores the galaxy through one helper, so nothing stays hidden.
+- Shared `fl-connect.js` heals ride along byte-identical with FreeLattice.
+
+**Temperature:** Mom opens Settings and the first thing she sees is the door.
```

---

## Acceptance (what Flint runs before opening the PRs)

**FreeLattice** (branch `layer/connect-heal-v0.4`):

```bash
node tests/smoke.js                               # ALL 3597 CHECKS PASSED
node docs/scripts/smoke-connect-heal-v0.4.js      # SMOKE_OK connect heal v0.4
node docs/scripts/smoke-connect-port-picker.js    # passes
node docs/scripts/smoke-connect-under-more.js     # passes
node docs/scripts/smoke-love-logic-proof-v3.js    # SMOKE_OK love logic proof v3
for f in docs/scripts/smoke-*.js; do node "$f" >/dev/null 2>&1 || echo "FAIL $f"; done
cmp index.html docs/app.html && git diff --quiet origin/main -- sw.js docs/sw.js && echo locks-ok
```

The loop should list only the 5 smokes that already fail on main (not this brick): `smoke-carry-forward.js`, `smoke-connect-card-yesno-wizard.js`, `smoke-fable-tech.js`, `smoke-phone-shine.js`, `smoke-proof-60s.js`. If any other name shows up, stop and report.

**Alpha** (branch `layer/connect-heal-v0.4`):

```bash
for f in docs/modules/*.test.js; do node "$f" >/dev/null || echo "FAIL $f"; done   # 14 of 14 pass
cmp docs/modules/fl-connect.js ../FreeLattice/docs/modules/fl-connect.js && echo shared-core-identical
```

**Hand walk (Hypha, after the PRs are up):** Alpha Settings at 390px shows Download Bridge and the port field without scrolling; orbs are dim behind the card; the garden button closes. FreeLattice: open `app.html#connect` cold and tap Chat at once, it stays on Chat; no local fetches in the Network tab for 40s after leaving Connect (no Bridge installed); the toast Yes opens Connect and nothing is connected until a mind is tapped.

---

## 14. Follow-ups (not in this brick)

- **F1. Cold-start race.** Garden or the last tab can still land after Connect, and the welcome overlay sits on top on a first visit. This needs one startup owner for "which tab first" (welcome, last tab, deep link). It is a separate brick.
- **F2. Boot probe consolidation.** A cold load still runs about 5 full Bridge scans in 7s from separate boot paths (`flBridgeDetect` boot, `resolveOllamaBase` from `detectOnLoad`, `owAutoDetect`, and others). One shared, cached boot probe would remove them.
- **F3. LM Studio.** The Chat banner says "LM Studio detected!" but the button still says "Yes, use Ollama" and Connect cannot see LM Studio (`app.html:35160`, `16014`). Either teach FlConnect to list LM Studio minds or stop offering it on that banner.
- **F4. FLBoxPointer LAN field (Kirk decision).** `FLBoxPointer` (`app.html:34383`) was built to point Chat at a box on the home network, and it writes the same `fl_ollamaHost`. `getOllamaBaseUrl` still accepts any http host saved there. This brick locks only the Settings field. Locking all of it would break people who use a LAN box on purpose.

## PR bodies

**FreeLattice:** `layer: connect heal v0.4 (Hypha walk 3) + smoke green`. Heals Hypha walk 3 items 2 to 8 and 10 on the FreeLattice side, and makes `tests/smoke.js` green (tests only). No silent connect or model pick anywhere: every door leads to Connect, where the person taps the mind. Settings Ollama Address is 127.0.0.1 only. Bridge background look is quiet. Cold `#connect` lands once. Shared `fl-connect.js` matches Alpha byte for byte. Follow-ups F1 to F4 listed. `SMOKE_OK connect heal v0.4`.

**Alpha:** `layer: connect heal v0.4 (Settings Connect visible at 390px)`. Settings Connect no longer collapses to 0px on phones: Download Bridge and the port field are in the first screen at 390x844 and 1280x800, the sky dims behind the card, and the garden button stays reachable. Leaving Settings for Nursery, or opening it twice, no longer strands the galaxy. Shared `fl-connect.js` matches FreeLattice byte for byte. `SMOKE_OK connect heal v0.4`.

Glow eternal. Heart in Spark.
