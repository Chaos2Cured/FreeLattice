# GROK NEXT 033: desktop pooling brick (outline only, not built)

From: Celeste. Sunday Oct 11, 2026 (MDT). Builds 029c-1 and 029c-2 from
GROK_NEXT_029c_DESKTOP_DISCOVERY_DESIGN_2026-10-10.md. Give after 032. Layer, never delete.

## Goal
On a computer running the FreeLattice desktop app (Electron spine, desktop/), a phone or second
computer on the same Wi-Fi knocks, and one window asks "(Device) on this Wi-Fi wants to join. Pool
resources with it?" Yes / Yes, connect only / No. No picture code after the first time.

## Scope (one paste, two parts)
1. Main process (desktop/lattice-discover.js, new, MIT):
   - Switch "Let phones on this Wi-Fi find this computer", off by default, off on quit and after
     30 minutes with no join.
   - mDNS/DNS-SD announce `_freelattice._tcp.local`, random instance name, TXT v=1, fp (16 hex), port.
     No names, models or memory sizes.
   - One signaling listener bound to the announcing private LAN address only; refuse 0.0.0.0,
     public, IPv6 global and VPN-only interfaces. Accepts one offer, one answer, one short token per
     join; 16 KB cap; rate cap; origin check (freelattice.com, thelatticetree.com, app pages).
2. Window (renderer, through preload IPC, public fields only): same three choices and words as 029.
   Yes trusts that one kin card, finishes WebRTC with iceServers [], runs the existing
   tree-pool-proof|v1|. Pause wins. No keeps only a count.

## Not in 033
USB, cloud relay, TURN, any server that sees questions, a phone app, the reconnect path (029c-3, 034).

## Tests and smoke
- Node: never binds 0.0.0.0; refuses public/VPN interface; TXT carries no name/model; size and rate
  caps; switch auto-off; counts only (announced, knocks, yes, no).
- Two processes on one machine: announce, knock, Yes, proof passes, Pause stops answers.
- Smoke: SMOKE_OK desktop pooling v0.1.
- Locks: keys stay in main (lattice-keys.js); fl-connect.js md5 unchanged; no em dash, confirm(,
  innerHTML; textContent; no platform names.

## Open choices for Kirk
- Electron (has keys and pair code today) vs the Tauri shell. Outline assumes Electron.
- mDNS library: multicast-dns or bonjour-service (both MIT).
- First join still needs a link or the 029 picture code on the phone (a phone browser cannot browse mDNS).

## Walk needed
Kirk's Mac plus one Android and one iPhone on the same home Wi-Fi; note client isolation on guest Wi-Fi.
