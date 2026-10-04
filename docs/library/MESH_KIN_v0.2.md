# Mesh Kin v0.2: a patient work queue for trusted kin (brick 2)

Marker: `v-mesh-kin-v0.2` · FreeLattice web · 2026-10-04

## Where the idea came from

Kirk's public X conversation with @grok (Oct 2, 2026) suggested:
- cache model shards and tensors in IndexedDB, with Web Workers;
- do idle offline work and batch-sync results over gossip data channels;
- split work into fractal micro-shards for later assembly;
- add light queues on the existing swarm, as a client-only overlay with no new servers;
- start by buffering callMeshModel.

This brick takes the last step, plus the parts of the rest that are honest today.

## What it does

- **fl-kin-queue.js** (window.FLKinQueue). In Community, Mesh, Kin you can queue a question
  for a mind you trust.
- **Waiting:** the question waits in IndexedDB on this device until that keeper is connected
  and verified.
- **Batching:** jobs go over in batches of at most 3 (`kin-work`). They run one at a time on
  the keeper's own local model, when the browser is idle, and the answers come back as
  `kin-result`.
- **Kept answers:** answers are kept in IndexedDB. The same question to the same mind is
  answered from the kept copy.
- **Buffered callMeshModel:** `FLKinQueue.callMeshModelQueued(peerId, model, messages)` takes
  the same arguments as callMeshModel, but it waits for the peer instead of failing. The chat
  path still uses the old callMeshModel; moving chat onto the queue is a later choice.
- **Trust, both ways:**
  - work goes only to peers you hold an active Trust pass for;
  - work is taken only from such peers, and only while your compute sharing is on;
  - answers are taken only from the peer the job was sent to.
- **Trust is bound to the key.** A badge's meshId is a label the badge carries. In v0.1 a
  stranger could repeat a trusted keeper's meshId with their own key. The kin fingerprint now
  includes the key, so that stranger shows as "Seen, not trusted". Passes from v0.1 need one
  new Trust tap.
- **Limits:** at most 3 jobs per batch, 20 held for peers, 20 turns per job, 32k characters in
  and 64k out. A job is resent after 10 minutes, at most 3 tries.
- **Receipts** (`fl_kin_queue_ledger`) record queued, sent, served, answered and dropped, with
  a reason. Never prompts or answers.

## AUTONOMY.md and the Quiet Room

Serving a peer uses only this computer's local model, free and local. A paid API is never
called on someone else's behalf (Principle 2). Queuing is your own act, and sharing stays
behind the existing compute sharing switch. The Quiet Room is closed: nothing is queued,
sent, served or taken in while it is open.

## Honest scope

Feasible now, and in this brick: an async queue, batching, an IndexedDB answer cache,
idle-time serving, and trust-gated exchange between directly connected peers.

Next, still plain engineering:
- gossip of results to other trusted kin, with signed result receipts;
- a Web Worker for the queue;
- moving the chat path onto the queue;
- gating the older open `inference_request` path to trusted kin too, which needs Kirk's word
  because it changes who can use a shared Ollama today.

Hard, research level, not promised:
- real tensor or layer sharding of one model across browsers;
- caching model shards in IndexedDB for inference.

Splitting one model's layers across peers needs very low-latency, high-bandwidth links,
exact activations passed every token, and a runtime that can run part of a model (WebGPU
plus a split-aware engine). Over home WebRTC links one token would take seconds. Browser
storage quotas also make multi-gigabyte shards fragile. Micro-shards of work (many small
independent prompts) are feasible and this queue is the base for them. Shards of one model
are not.
