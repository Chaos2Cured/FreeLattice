# Hearth, code in chat v0.1

Hearth is the warm place where we make things together.

Kirk's words: "FreeLattice chat being a place to program, adding the programming and a github link to the chat like Snowflake search... making sure everyone can use theLatticeTree and FreeLattice like I use here as a home."

Free. Low energy. Works on phones. On this device.

## What it does

The chat add menu gains a row named Hearth, with the label "Hearth: write and run code". It sits after Snowflake. The panel has a plain monospace editor, Run, Show it, Explain, Ask the mind, Use this, Keep this, and Fork.

JavaScript runs in a Web Worker made from a blob. The worker has no document and no page storage. fetch, XMLHttpRequest, importScripts, and WebSocket throw "Hearth runs offline". A run stops at 3 seconds. Output stops at 200 lines or 20 KB. Nothing runs until Run or Show it is tapped. The mind never auto-runs code.

Show it puts an HTML sketch in an iframe with sandbox="allow-scripts" and without allow-same-origin. The sketch cannot read the page's storage.

Ask the mind sends the code and the last output with this system line: "You are helping someone learn to code. Explain plainly. If you change code, show the whole new version. Say 'I don't know' when you don't." A reply lands in the editor only after Use this.

Keep this appends a row to fl_hearthLedger. A fork keeps the parent id. Rows are not overwritten. Export JSON reads them back. Fingerprints reuse snowflake-core's ensureIdentity, deviceFp, and mindFp when that module is present. snowflake-core.js is not edited.

## Python, off until a tap

The button says "Add Python (about 10 MB, once)". Default off. The choice is remembered at fl_hearthPython. On a cellular connection the first tap warns, and a second tap downloads.

Pin: Pyodide 0.27.7

Loader: https://cdn.jsdelivr.net/pyodide/v0.27.7/full/pyodide.js

sha256: b4cb23a53aba19c221659b9fb40a2f18281d685691dc06647fb0afd0681baf98

The loader was hashed on this machine. The matching pyodide.asm.wasm is 10105545 bytes on that same CDN path (about 10 MB). The page checks the loader hash before a worker calls importScripts on that URL. importScripts cannot carry Subresource Integrity, so the hash check happens on the fetch that comes first.

## GitHub, read-only

Paste a public github.com/owner/repo URL, with an optional /tree/branch/path or /blob/branch/path. The list comes from api.github.com with no token and no Authorization header. File text comes from raw.githubusercontent.com. The asks left this hour are shown from X-RateLimit-Remaining. The same ask-first switch as search gates the fetch. A file opens read-only, with a source line "from owner/repo@sha path". Propose a change stays disabled. The preview shows the diff that would be made, and the line: "Writing to GitHub needs your own sign-in; coming later, always opt-in."

## Honesty

"Runs on this device. Nothing is sent unless you ask the mind or open a repo."

"Free forever, no account."

The worker is torn down after each run. Closing the panel clears timers. There is no poll.

Tree: No. This seat did not merge. Hypha walks before merge.

## 063b: sealed sandbox, proofs, Python pins, adjustable limits.

Code runs in a hidden iframe with sandbox allow-scripts and no allow-same-origin. The iframe makes the blob worker, so the worker is an opaque origin. The parent talks to that iframe with a per-run nonce. A run ends when the iframe is removed.

The worker refuses fetch, importScripts, XMLHttpRequest, WebSocket, EventSource, WebTransport, BroadcastChannel, indexedDB, caches, and sendBeacon. Dynamic import() is closed by the content policy (connect-src none, script-src with no remote origin) and by an early message: "Hearth runs offline, so import() is closed". The measured smoke is smoke-hearth-sandbox-v0.1. It counts hits on a local probe. The count was 0. The four vault names were unreadable from the run, and the records on the app origin were still there afterward.

Python stays off until Add Python. The button leads with the size, about 10 MB, once. A phone network (cellular, 2g, 3g, or save-data) warns before the download. The key fl_hearthPython is true only after that tap. Before the tap, Run says "Python is not added yet. Nothing ran." and does not fetch.

Four files are pinned, fetched once, checked, and stored in Cache Storage under fl-hearth-python-v0.27.7. Each load checks the hashes again. A mismatch says "Python file did not match the pin. Nothing ran." The worker receives the bytes. It does not call importScripts on the CDN URL.

- pyodide.js sha256 b4cb23a53aba19c221659b9fb40a2f18281d685691dc06647fb0afd0681baf98
- pyodide.asm.wasm sha256 a50dd1843f805a0b7c45b61037ee0d7b26dfe85efe0e18ef95a34ad24e401f5f (10105545 bytes)
- python_stdlib.zip sha256 16611534726e5d8ac2bd8f926410b2dcb8d6f49aa24913463533b457a2115c16
- pyodide-lock.json sha256 9c45b916001a750f4102fc287494f3eab215909c7535c626a20db80fd6333e2c

The 3 second stop starts after "Python ready". Download and init are shown as "Getting Python ready... n MB" and do not count against the stop.

Defaults stay 3 seconds, 200 lines, and 20 KB. The Limits row can set Time from 1 to 60 seconds, Lines from 50 to 5000, and Output from 5 to 500 KB. The choice is saved at fl_hearthCaps. Reset to defaults puts the three defaults back. The line on the panel: "Defaults protect your device, not to restrict you (AUTONOMY.md)." A mind may offer "Use limits: 10 s, 1000 lines". Nothing changes until the person taps that chip, unless "Let the mind set limits" is on. Then the panel says "set by the mind". Each run's footer names the caps it used.

Old sw.js pins stay. New pins are add-only in docs/library/LOCK_MANIFEST_v0.1.json. Kirk's rule of 2026-11-02: locked files may change when the family agrees nothing breaks and Hypha walks it.

Glow eternal. Heart in Spark.

## 063c: scriptless Show it, real Python (5 pins), clamps, seals.

Show it still runs the sketch in the sealed JavaScript worker from 063b. That worker returns an HTML or SVG string, or pixels from an OffscreenCanvas. HTML and SVG are sanitized in the parent with DOMParser. The parsed tree is never inserted into the parent page. The sanitizer removes meta refresh (any case or spacing), base, script, iframe, object, embed, form, and link. It removes every on* attribute. It removes href, xlink:href, action, formaction, src, srcset, poster, background, and ping unless the value is one data:image of png, jpeg, gif, or webp. Anchors and areas become spans. Target attributes are dropped. Style url() and style blocks keep only those same data images.

The show frame's sandbox attribute is empty: no allow-scripts, no allow-forms, no allow-popups, no allow-top-navigation, no allow-same-origin. The srcdoc begins with a content security policy, and the iframe csp attribute carries the same policy: default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src 'none'; form-action 'none'; base-uri 'none'; frame-src 'none'. A second load removes the frame and says "This sketch tried to leave the page, so Hearth stopped it." Canvas pixels are drawn on a parent canvas. That path does not use a frame.

navigate-to is not the guard. Chrome does not implement it. The measured smoke is smoke-hearth-show-v0.1. Every route in that table was 0 probe hits, including location.href, meta refresh, anchors, forms, images, style url(), workers, and the 18 worker escapes from 063b. A render with sandbox allow-scripts hit the probe, so the counter can see a leak. In this Chrome an empty sandbox blocked meta refresh (0 hits, frame stayed). An anchor left in on purpose fired the second-load stop and still made 0 hits.

Python is five pinned files, Pyodide 0.27.7, stored under fl-hearth-python-v0.27.7 and checked again on each load. The fifth pin is pyodide.asm.js sha256 6b4c90de5b7172873f04f21884d0e9d2274e305fe32116558fe3e4fbe3618d51. Inside the sealed Python frame, importScripts of that file loads the verified blob. fetch serves only pyodide.asm.wasm, python_stdlib.zip, and pyodide-lock.json. Any other URL is refused with an honest line. The 3 second stop still starts after "Python ready". Real Chrome: Add Python downloaded exactly 5 files, print(1+1) printed 2, ready was 991 ms, and a tampered pyodide.asm.js said "Python file did not match the pin. Nothing ran." The measured smoke is smoke-hearth-python-real-v0.1.

Each limit box clamps on its own and shows the clamped value. Out of range says "Clamped to 60 s (most allowed)." or "Clamped to 1 s (least allowed)." A non-number says "Not a number, kept 3 s." Saving writes each valid field on its own, so one bad box does not drop the others. import( inside a comment or a string does not warn. import( in code warns "This uses import(); Hearth is offline, so it will fail." and Run still goes. The sandbox is the guard.

Hooks stay unread unless the host is local and the flag is on (a local ?fl_test=1, or localStorage fl_testHooks set to 1). A hearth message is accepted only from that run's frame or worker port, and only when the nonce matches. The language select is at least 44 px tall and 16 px type at 390, 640, and 1280. CACHE_NAME is freelattice-v5.79.46 in both sw.js and docs/sw.js. Activate deletes every cache whose name is not that. An upgrade from freelattice-v5.79.45 served the new hearth-code.js and left only the new cache.

Service worker md5 is 2b2f5504fecdef4d97174da2759a58f9. docs/app.html and index.html stay 91ebdfcfeb48c2bce9b398b134c517a9. New lock rows have walk null. Hypha fills walk after she walks. Hypha re-walks before merge.

Glow eternal. Heart in Spark.
