# GROK NEXT 029c: the desktop helper notices a phone (design only, not code)

From: Celeste, for GC and Kirk. Saturday Oct 10, 2026 (MDT). Layer, never delete.
Status: design only. Nothing here is built. 029 (the grandmother door, picture codes) is the
web version and stays the path for every browser. This is the path for a computer that runs the
FreeLattice desktop app.

## 1. Kirk's dream, and the honest line

The dream: a person opens FreeLattice or theLatticeTree, a phone joins, and a window asks
"Would you like to pool resources with (device)?" Yes, and done.

What a web page cannot do, and why 029 uses two picture codes:
- A page cannot notice a phone plugged in by cable. WebUSB only sees devices the person picks
  from a browser list, and a phone over USB shows up as a phone, not as a network to pool with.
- A page cannot find other devices on the Wi-Fi. Browsers have no mDNS or broadcast API for
  pages, on purpose. FreeLattice's own "LAN Discovery via BroadcastChannel (v3.8)" in app.html only
  finds other tabs of the same browser; its comment already says mDNS is planned for later.
- The Tree has no server, and WebRTC still needs the two devices to swap connection details once.
  029 carries them in two picture codes, one each way.

What a desktop app can do: listen on the home network, notice "a FreeLattice device is here",
and carry those connection details itself. Then there is no picture code at all.

## 2. USB is not the path. The same Wi-Fi or a wired network is.

USB tethering makes the phone a network adapter for the computer (or the other way round). That
changes the computer's internet route, needs settings on the phone, differs on every phone, and
an iPhone over USB is not a network at all unless Personal Hotspot is on. It is a poor door for a
grandmother. The door is: both devices on the same Wi-Fi, or the same wired network in a classroom
lab. The words in the app should say "same Wi-Fi", never "plug in".

## 3. What already exists to build on

- FreeLattice desktop/: the Electron spine is the current desktop door (desktop/README.md:
  main.js, preload.js, lattice-keys.js, lattice-pair.js, lattice-swarm.js). Its local server
  listens on 127.0.0.1 only (main.js). There is also a Tauri v2 shell (desktop/src-tauri, CC,
  April 2026) with filesystem commands and one-click Ollama install. Pick one for 029c; Electron is
  the one with the key and pair code today.
- Keys: lattice-keys.js (Ed25519, sealed in main, never to the renderer) and lattice-pair.js
  (pair fingerprint, "never auto-form"). Kin cards: fl-kin.js v0.2 on FreeLattice, tree-kin.js on
  the Tree, the same card shape (fl-kin-card|v1|).
- The pool: fl-pool.js / fl-share-door.js on FreeLattice, tree-pool.js on the Tree, with the same
  door (off until a human tap, kin only, Pause wins) and the same proof (tree-pool-proof|v1|, a
  fresh challenge bound to both DTLS fingerprints).
- Note: FreeLattice's root server.js (self-host) listens on 0.0.0.0. The desktop helper must not
  copy that default.

## 4. The design

### 4.1 Off by default, one switch

A setting in the desktop app: "Let phones on this Wi-Fi find this computer". Off by default.
Turning it on is a human tap, and the app says what it does in one sentence. It turns itself off
when the app quits, and after 30 minutes with no join (the person can choose "keep it on").

### 4.2 Announce (mDNS, DNS-SD)

While the switch is on, the desktop app announces one service on the local network:
- type `_freelattice._tcp.local`, a random instance name per session (not the person's name),
- TXT: `v=1`, `fp=` the first 16 hex of the kin card fingerprint (so a phone that already trusts
  this card can say "Kirk's computer"; a stranger learns nothing more than "a FreeLattice device"),
  and `port=`.
- No model names, no memory size, no names in TXT. Those go only to trusted kin, after the proof.
Libraries: multicast-dns or bonjour-service (MIT) in Electron; mdns-sd (MIT/Apache) in Tauri.

### 4.3 Listen narrowly

- One small signaling listener, only while the switch is on, bound to the private LAN address of
  the interface that announced (for example 192.168.1.20), never 0.0.0.0, never a public address,
  never an IPv6 global address. Refuse to start if the only interface is public or a VPN.
- It accepts only: one offer, one answer, a short-lived pairing token, per join. Size cap (16 KB,
  same as TREEPOOL codes), rate cap (a few joins a minute), and it answers nothing else (no files,
  no models, no chat). The questions themselves still travel only on the WebRTC channel after the
  kin proof, exactly as today.
- Origin check for browser callers: only https://freelattice.com, https://thelatticetree.com and
  the app's own pages.

### 4.4 The phone side, honestly

A phone browser cannot browse mDNS either. So the phone still needs one first step:
- Best: the phone runs FreeLattice in a browser on the same Wi-Fi and opens a short link the
  desktop shows once (or the 029 picture code). After that first join, the desktop remembers the
  phone's card, and next time the desktop's listener plus a reconnect message is enough.
- Or: the phone has a FreeLattice phone app later (Capacitor or Tauri mobile), which can browse
  mDNS. Then the phone notices the computer too, with no code at all.
- Chrome's Local Network Access permission: a page on https://thelatticetree.com calling a LAN
  address will show the browser's own "allow access to devices on your network" box once. The
  app's words should prepare the person for it: "Your browser will ask once. Tap Allow."

### 4.5 The window

When a device knocks on the listener (offer plus its kin card), the desktop pops one window:
"(Device name) on this Wi-Fi wants to join. Pool resources with it?"
- Yes, and let my mind answer it
- Yes, connect only
- No
Same words as 029's host window. Yes trusts that one card (a stranger's card is never trusted on
its own), finishes WebRTC (iceServers empty, the LAN only), and the existing proof runs. No sends
nothing back and keeps nothing but a count. Pause still wins; the door is off until that tap.

On a phone that already trusts this computer, the reconnect is silent until the phone's own
person taps "Pool with Kirk's computer?" once per session.

### 4.6 Security summary

- Trusted LAN only: home Wi-Fi or a classroom wired network. Say plainly that school or guest
  Wi-Fi often keeps devices apart (client isolation), and then nothing is found.
- Kin cards decide trust. Discovery only says "a FreeLattice device is here"; it never grants
  anything. A device that answers mDNS but cannot prove a trusted key is set aside, as today.
- Nothing listens on all interfaces by default. Nothing listens at all while the switch is off.
- No new data leaves the computer: announcements carry no names, models or memory sizes.
- Receipts: counts only (announced, knocks, yes, no), never names or keys.
- The private key stays in the desktop main process (lattice-keys.js rule).

## 5. Tap counts (designed, not measured)

| Flow | Web today (029) | Desktop helper (029c) |
|---|---|---|
| First time, host | Share, (name once), Scan, Yes = 3 (4) | switch on (once), Yes = 1 (2) |
| First time, phone | open link, Yes = 2 | open link, Yes = 2 |
| Next time, both already kin | same as first time | phone Yes, host Yes = 2 |

## 6. What would be needed (later pastes, each small)

1. 029c-1: Electron main: the switch, mDNS announce, the narrow listener, tests that it never binds
   0.0.0.0 and refuses a public interface. Smoke with two processes on one machine.
2. 029c-2: the desktop window (same words as 029), reusing tree-pool or fl-pool join code through
   preload IPC, public fields only.
3. 029c-3: a "reconnect a trusted phone" path, so the second time needs no code.
4. A real walk on Kirk's Mac and one Android phone and one iPhone on the same Wi-Fi.

Not here: USB, a cloud relay, a TURN server, or any server that sees questions.
