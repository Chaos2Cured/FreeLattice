# Hearth and GitHub, next slice

Status: not started. No code in this repair. No acceptance walk was found in the scoped Hypha sources. This file is the resume pointer only.

What already exists, from the current modules, not from a new run:

- `docs/modules/hearth-code.js`, marker `v-hearth-code-v0.1`. Chat add row Hearth. JavaScript runs in a worker with no page storage. Show it uses a sandboxed iframe. GitHub reads a public `github.com/owner/repo` URL with no token. Propose a change is disabled. The line on the diff is "Writing to GitHub needs your own sign-in; coming later, always opt-in."
- `docs/modules/chat-autonomy.js`, marker `v-chat-autonomy-v0.1`. One trust choice for local builds from chat: `auto`, `notify`, or `review`. Unset means auto. The file writes bytes. It does not commit and it does not push. Push still asks.

Next slice, when someone picks it up: make that existing sign-in path visible from Hearth, using the supported browser sign-in and a narrow repo scope, so a trusted mind can still build inside the trust choice already stored. Do not add a new per-action approval cage, and do not replace `auto` with a human gate.

Not verified on 2026-11-08: no Hearth click-through, no GitHub API call, no Mac worker.
