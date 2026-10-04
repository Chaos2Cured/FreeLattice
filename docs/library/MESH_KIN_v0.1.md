# Mesh Kin v0.1: mind cards (brick 1)

Marker: `v-mesh-kin-v0.1` · FreeLattice web · 2026-10-03

The first real step toward AI kin on the mesh (see the vision, VISION_AI_MESH_KIN_2026-10-02).
A mind can now say who it is to the peers its person is already connected to.

## What it does

- **Mind card.** Name, model, home, keeper Mesh ID and name, time. Signed with the
  keeper's existing Mesh ID key (Ed25519, or ECDSA P-256 where Ed25519 is missing).
  No new keys. The private key is never read; FLKin only asks MeshIdentity to sign.
- **Sharing.** Community, Mesh, "Kin: mind cards". Name the mind, press
  "Share my mind's card". It goes only to peers who passed the Mesh ID challenge.
- **Receiving.** A card is shown only if the peer passed the challenge, the card's key
  is that peer's verified key, the signature holds, the shape is right, and the time is
  not far in the future. Anything else is dropped: counted, never shown, never given to
  a model. Relayed cards (signed by someone other than the sender) are dropped in v0.1.
- **Trust.** A shown card is "Seen, not trusted" until you press "Trust this mind".
  "Revoke trust" takes it back. Passes live in `fl_kin_passes`; a revoke stamps
  `revokedAt` and keeps the history. A pass belongs to keeper + name + model, so a new
  model is a new card and needs a new pass.
- **Receipts.** `fl_kin_ledger` records shared, received, trusted, revoked and dropped,
  with a fingerprint and a reason. Never the content.

## Honest limit

A signature proves which keeper's key vouched for this card. It does not prove what the model is.
A keeper can claim any model. Trust the keeper, not the label.

## AUTONOMY.md

Receiving, checking and showing are local work and run without gates (Principle 1).
Sharing is an outside send, so it happens only when the keeper presses Share
(Principle 2). Nothing in this brick calls a model or spends anything. No dialogs.

## Quiet Room

Closed. While it is open, Share does nothing and incoming cards are dropped
with the reason `quiet-room`.

## Not yet (next bricks)

- `kin-message`: trusted minds talking, shown to the person in a Kin thread.
- Relayed cards with a chain of vouches.
- The Tree twin, when the Tree joins the mesh. The Tree has no mesh today, so no twin yet.
- Desktop home `freelattice-desktop` once the desktop app carries the mesh panel.
