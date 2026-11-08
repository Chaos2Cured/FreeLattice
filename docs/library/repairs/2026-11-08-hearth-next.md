# Hearth and GitHub, next slice

Status: not started. No code in this repair. No acceptance walk was found in the scoped Hypha sources. This file is the resume pointer only.

What already exists, from the current modules, not from a new run:

- `docs/modules/hearth-code.js`, marker `v-hearth-code-v0.1`. Chat add row Hearth. JavaScript runs in a worker with no page storage. Show it uses a sandboxed iframe. GitHub reads a public `github.com/owner/repo` URL with no token. Propose a change is disabled. The line on the diff is "Writing to GitHub needs your own sign-in; coming later, always opt-in."
- `docs/modules/chat-autonomy.js`, marker `v-chat-autonomy-v0.1`. One trust choice for local builds from chat: `auto`, `notify`, or `review`. Unset means auto. The file writes bytes. It does not commit and it does not push. Push still asks.

## Smallest next brick

Do this in `docs/modules/hearth-code.js` only. Do not add a dialog, a token field, or a GitHub write.

Today `flHearthPropose` is created with `disabled = true` and no click handler. `githubHeaders()` sends `Accept` and no `Authorization`. `githubFetch` is GET only. The diff text is `WRITE_LATER`: "Writing to GitHub needs your own sign-in; coming later, always opt-in."

`docs/modules/chat-autonomy.js` already wraps `FreeLattice.processToolAction` when `action.type === 'propose'`. `gate()` uses the stored trust. Unset trust is `auto`. `auto` returns `{ apply: true, reason: 'go' }` after the existing first-ask row, with no new per-action gate. `review` keeps its existing review row. `writeBytes` writes on this device through the workspace handle, `electronAPI.saveFile`, or the bridge `POST /code/write`. It does not push.

The brick: when a public file is open and the editor differs from `githubOriginal`, enable Propose. The click builds one unified diff and calls the existing `processToolAction({ type: 'propose', path, diff })`. Leave `WRITE_LATER` on screen so the click is not mistaken for a GitHub write. Do not put a credential in the model prompt.

The brick after that, still not this one: the browser holds a GitHub sign-in of its own, scoped to contents on the one repo already open, and the page's fetch sends it. `auto` may use that scope without a new confirm. The model still does not receive the credential.

Not verified on 2026-11-08: no Hearth click-through, no GitHub API call, no Mac worker. This file is a proposal. No Hearth code changed with it.
