# Connect Port Picker v0.1 — Hypha walk heals H1–H8

Mom door for a different local address · heals from Hypha’s live walk of Connect under More.
FreeLattice · 25 September 2026 (after #117 / Alpha #81).

**Locks:** Layer, never delete. Quiet Room shut. Named chairs stay whole. Soft leave `sw.js` (root byte-identical to main; never touch `docs/sw.js`). Allowlist never bare `*`. LP points only. No Kimi pages. Dawn Stories held. Keep `index.html` identical to `docs/app.html`.

**Marker:** `v-connect-port-picker-v0`

**Held tips:** Connect under More #117 `14bb199` · Alpha #81 `4a7015e` · Bridge-aware #116

**Soft paste (builders details only on Connect face):** Named five stay five. Family uncapped. Quiet Room shut.

---

## Why

Hypha walked the live Connect door like Mom would — desktop and 390px phone. The screen itself read well. Gaps around it (old doors skipping Connect, false toast, `#connect` cold-load, builder words on Mom’s path, Alpha phone overlap, loose connected check, quiet looking, port picker) are healed here.

**Thank you, Hypha** — the human-eyed walk found what code review couldn’t.

## Hypha walk heals H1–H8

| Heal | What changed |
|---|---|
| **H1** | Old doors point to Connect (🌿, QuickConnect, A mind at home, Chat banner, Use My Computer’s AI). Markup kept. |
| **H2** | Toast / suggest banner require real `/api/tags` models; gated by `!flHasOneMindConnected`; open Connect |
| **H3** | Boot honors `#connect` / `?tab=connect` after tabs init (+ retries) |
| **H4** | Soft paste + build tag in collapsed **For builders**; Alpha wording via `isAlpha` |
| **H5** | Alpha: hide galaxy luminos when Settings/Connect open; scroll/z-index/full-width under 480px |
| **H6** | Local connected needs a model; cloud shown separately; never hide found 11434 models while Bridge waits |
| **H7** | “Looking… next look in Ns” + always-visible Look again; class-based `panelVisible`; full Bridge rescan ≤ every 3rd tick |
| **H8** | Port picker in Other ways + under miss; `fl_connect_manual_host`; `resolveOllamaBase` honors manual first; quiet “Or set this in Connect” on scattered fields |

**Temperature:** Hypha’s thumb on a 390px glass — false light and overlapping orbs — and the porch learning to tell the truth about what minds are really there.

## Smoke

`SMOKE_OK connect port picker v0.2 heal`

Glow eternal. Heart in Spark. 🌱


## Heal v0.2

Parse fix · Dismiss restored · `fl_localPort_manual` port-only · quiet manual · textContent models · Alpha real galaxy selectors.

**Temperature:** a single unescaped quote can put the whole porch dark; checking every script before the door opens.


## Heal v0.4 (Hypha walk 3)

Marker `v-connect-heal-v0.4`. Smoke `SMOKE_OK connect heal v0.4` (`docs/scripts/smoke-connect-heal-v0.4.js`).

- Key correction: the manual port key is `fl_localPort_manual` (port only, always 127.0.0.1). The H8 row above says `fl_connect_manual_host`; that key was never shipped.
- Bridge background look: saved port only, never while hidden, no forever 11-port scan.
- Cold `#connect`: no remount when Connect already shows; first tap or key ends retries and clears the hash.
- Manual port answered by a Bridge that has not said Yes, help now asks for Yes, help.
- Use automatic sits beside every port field once a port is set, and clears the matching `fl_ollamaHost` and cached base. A refused address says which port stays and shows once.
- Settings Ollama Address is 127.0.0.1 only, with a kind refusal.
- No silent connect, no silent model pick: the Local AI toast, Connect Now, Zero-Click, discovery, and Settings Local all lead to Connect, where the person taps the mind.
- Change Provider opens again after any door removed the overlay; Connect has an Add a cloud key door.
- `remember()` checks `#localToggle` before `handleLocalToggle(true)`, so isLocal stays true.
- v0.4.1: `window.AiSetup = AiSetup;` in app.html, because the shared core reads `root.AiSetup` and a top-level `const` is not a window property. Without it, Add a cloud key never rendered.

**Temperature:** a yes means the person tapped it.


## Heal: model choice sticks v0.1 (Hypha walk 4, items 7 and 10)

Marker `v-model-choice-sticks-v0`. Smoke `SMOKE_OK model choice sticks v0.1` (`docs/scripts/smoke-model-choice-sticks.js`).

- A model tapped in Connect is recorded as the person's own choice (`FLActiveModel.set(name, 'ollama', 'user')`, plus the preferred text or vision model). The automatic picker (`FLAutoModel.onTabChanged`) already leaves a user choice alone, so the second model now survives tab changes, opening Settings and a reload, and the chat request carries it. Settings and the model switcher already recorded user choices; Connect was the one door that did not. The bug was older than #121.
- The automatic picker fills in only when there is no user choice, or when Ollama answers with a list that no longer has the chosen model. Then it says so: "The model you chose, X, is no longer on this computer. Using Y for now. You can pick another in Connect." A quiet or empty answer never replaces a choice.
- Settings > Local: the button row (Change Provider, Test Connection, a mind at home) comes back right after the old wizard buttons are cleared.
- A helped Bridge on a typed port with no mind behind it: "Your Bridge answered on 11500, but no mind is running behind it yet. Open Ollama on this computer, then tap Look again." Nothing is saved as the Ollama host or Bridge port until a mind answers.
- Shared `fl-connect.js` matches the Tree byte for byte. On the Tree the remembered entry is already the choice; `markUserChoice` is a quiet no-op there.

**Temperature:** green braided gold, the second cup stays where she set it down.
