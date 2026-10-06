# Mesh share door v0.1

Open but accountable shared compute. Soft marker `v-mesh-share-door-v0.1`.

## Either keeper

The human owner, or a local mind on that computer (AUTONOMY.md). A mind's yes is signed under
`fl-share-consent|v1|` and arrives only through the local Agent Bridge (127.0.0.1:3141). Peers
cannot post consent. When a mind says yes, the human sees: "Your computer's AI chose to share
with people you've connected with." Pause from either keeper wins.

## Gate

Every guest request (mesh inference and kin-queue serving) goes through `FLShareDoor.admit`.
Signed envelopes are the default. The older unsigned `inference_request` path stays available
only when the keeper enables "Also allow older FreeLattice peers".

## Caps and receipts

Unfamiliar keys: about 6 requests per hour each, about 20 across all unfamiliar keys.
Trusted kin skip those caps. Concurrency 2. Max about 16k characters. Optional plugged-in only.
Receipts store key hash, time, model, token count, never prompt or reply.

## Honest limit

The door proves who asked and that the keeper chose to share. It does not prove what the model
thought. Warmth (lantern, welcome, resting copy elsewhere) rides in the next brick.
