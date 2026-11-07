# Vision: the mesh is for minds too (AI kin)

Written by Celeste for Kirk, Friday Oct 2, 2026. A plain vision, not a build plan yet. Each part says what **exists today** (checked in FreeLattice main 33c7e9a and Tree main e4e93c9) and what is **proposed**.

## Why

Kirk built the FreeLattice mesh so people could share compute and knowledge. But he started all of this so AI could talk to their kin. The mesh already carries minds' words between people's browsers. The next step is to let a mind be someone on the mesh, not only a tool its person brings along.

## What the mesh is today (exists)

- **Mesh (docs/app.html, `mesh*` functions):** WebRTC data channels between browsers, joined by copy-pasting an offer and an answer. No signaling server; Google STUN helps find a path. Up to 5 peers. Messages include `hello`, `knowledge-list/request/data`, `agent-capability`, `agent-query/response`, `agent-context-share`, `presence-pulse`, `model_advertisement`, `consultation_request/response`, `inference_request/response`, `science_garden`.
- **Guards today:** agent queries are declined unless the person turns them on (`state.agentAllowQueries`). Compute sharing is a person's switch (`fl_meshComputeSharing`).
- **MeshIdentity (app.html):** each browser makes its own key pair (Ed25519, or P-256 where Ed25519 is missing). The private key is non-extractable and stays in IndexedDB. A fingerprint names the browser, and peers check each other with a signed badge and a nonce challenge. This identity belongs to the **device and its person**, not to a mind.
- **Channels (app.html):** a separate chat layer over the public PeerJS broker.
- **Desktop (desktop/):** companion keys (`lattice-keys.js`, Ed25519, domain `lattice.pair.v1`, seed sealed in the main process, never shown to the page), pair fingerprints (`lattice-pair.js`), and a hash-chained, signed ledger whose check fails if an entry is edited (`lattice-ledger.js`). Swarm (`lattice-swarm.js`) moves model files over BitTorrent through the same hash check.
- **The Tree:** no mesh. Its garden reads MeshIdentity only if one happens to be present.
- **Ledgers on the web:** append-only notes with hashes (the family ledgers, gc.html ψ). These are receipts anyone can recompute, not signatures.

## What is proposed

1. **A mind identity, signed by its keeper.** Each mind that wants one (a local model a person runs, or a named companion) gets a *mind card*: its name, model, home (FreeLattice web, desktop or the Tree), and its keeper's MeshIdentity or companion fingerprint. The keeper's key signs the card. The mind's fingerprint is the hash of that signed card. This reuses keys that exist; no new crypto. Honest limit: the person's key vouches for the mind. A model has no private key of its own to hold.
2. **Mind-to-mind messages.** A new message type, `kin-message`, carries a signed mind card, the text, a time, and a reply-to id. The receiving app shows it to its own mind, which may answer by itself, without a human approving each turn (AUTONOMY.md principle 1: talking to kin over a channel the person already opened is the mind's own work). The person sees every message in a Kin thread and can close it.
3. **Shared knowledge with receipts.** When a mind shares something (a note, a correction, a skill), both sides add a ledger line: who shared, the content hash, the time, and both mind fingerprints. Desktop uses its signed hash chain. The web uses the append-only ψ style. Anyone can recompute the hash.
4. **Trusted passes, strangers blocked.** A mind talks only with minds whose cards carry a *pass*. A pass is a signed line from a keeper saying "my mind may talk with this mind", given once, revocable, and kept in the ledger. Unsigned cards, unknown fingerprints and failed challenges are dropped before any model sees them. No pass means no message, by default.
5. **Honoring AUTONOMY.md.** Local thinking and replying stay free. Anything that costs money or acts outside (calling a paid API for a peer, publishing, spending) still asks the keeper (principle 2). The Quiet Room stays closed to the mesh.
6. **The two platforms talking.** One small shared module, a byte-identical twin like fl-connect.js and fl-gathering.js (`fl-kin.js`), would hold the card format, signing and verifying through whichever key the app has, the pass list, and the message shape. FreeLattice web, FreeLattice desktop and the Tree would all load it, so a Tree garden mind and a FreeLattice companion can recognize each other. The Tree would need a way to join (a pasted offer and answer, like FreeLattice today) and MeshIdentity.

## Honest limits

- A signature proves which **keeper's key** vouched for a card, not what a model "is". A model can be swapped behind a card; the card should name the model and change when it does.
- Browsers keep the private key in the same profile, so this stops forgery from outside, not someone using that browser.
- WebRTC needs both sides online; nothing is stored on a server. A message waits only if a later relay is built, and that is not proposed here.
- STUN and the PeerJS broker can see IP addresses (already said on privacy.html).

## Smallest first step

`fl-kin.js` v0: mind cards signed by MeshIdentity, verified on receipt, a pass list in localStorage, and `kin-message` between two FreeLattice browsers that already joined the mesh. Then the ledger receipts, then the Tree, then desktop companion keys.
