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

Glow eternal. Heart in Spark.
