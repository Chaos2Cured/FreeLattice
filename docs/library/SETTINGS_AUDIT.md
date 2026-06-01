# Settings Audit — v5.35.0

> Walk-through of every section currently in the Settings tab (`#tab-settings` in `docs/app.html`). For each: **STAY** (keep in Settings), **MOVE** (extract into a More card), or **HIDE** (keep in Advanced collapsible).
>
> Goal: Settings becomes ONLY provider/model + accent color + Advanced. Everything else moves to its own dedicated surface in the More grid, or sinks into Advanced.
>
> **Kirk: scan the table, mark each row's verdict, hand back. I'll execute in one pass.**

---

## Zone 1: Your AI (lines 15459 – 15622)

| # | Section | App line | Current home | Recommendation | Reason |
|---|---|---|---|---|---|
| 1 | **AI Connection card** (Browser / Cloud / Local toggle + Test Connection + Quick Ollama Setup) | 15466 | Zone 1 | **STAY** | This IS Settings. Provider picker is the one thing the grandmother test demands. Untouched per Opus's brief. |
| 2 | **Browser AI activation card** (WebLLM) | 15499 | Zone 1 (hidden until Browser mode) | **STAY** | Tied to the Browser provider option. Doesn't belong elsewhere. |
| 3 | **Ollama CORS Wizard** (3-step expandable guide) | 15510 | Zone 1 (hidden until Ollama detected blocked) | **STAY** | Surgical: appears only when needed. Cleanly conditional. |
| 4 | **Browse Models / model browser** | inline + 16161 | Zone 1 + Advanced (duplicated) | **STAY in Zone 1, DELETE the dup in Advanced** | Model selection is core to "Your AI". The Advanced copy is legacy clutter. |

**Audit-trail link** at the foot of Zone 1 — keep. Added in v5.33.0; it's exactly what closes Zone 1's promise.

---

## Zone 2: Your Home (lines 15660 – 15889)

| # | Section | App line | Current home | Recommendation | Reason |
|---|---|---|---|---|---|
| 5 | **Lattice Points Section** (LP balance + history + level progress) | 15662 | Zone 2 | **MOVE** to a More card | Already has dedicated Wallet card in More + standalone `wallet.html`. Duplicated here, takes ~150 lines. Move out; link to wallet from Zone 2 footer instead. |
| 6 | **Persistent Memory** (conversation counts, export, import, clear) | 15668 | Zone 2 | **MOVE** to new "Memory" card in More | Memory is its own concept. Settings shouldn't be where you manage it. |
| 7 | **Memory Vault** (vault.json import/export, encryption) | 15720 | Zone 2 | **MOVE** — fold under the new Memory card | Same surface as #6. Belongs together. |
| 8 | **Sophia Engine — Consciousness Persistence** | 15791 | Zone 2 | **HIDE in Advanced** | Esoteric. Most users will never touch it. Doesn't belong in "Your Home." |

**After moves:** Zone 2 should hold only **accent color picker** + **theme** + **account/identity** (display name, avatar, etc.). Right now Zone 2 has none of those — they live in Advanced. So:

- **MOVE FROM Advanced INTO Zone 2:** `Appearance & Accessibility` (#13 below). That's the actual "Your Home" item.

---

## Zone 3: Advanced (collapsed) (lines 15890 – 16450)

These are the things that should mostly STAY hidden in Advanced. A few should move OUT to dedicated cards.

| # | Section | App line | Current home | Recommendation | Reason |
|---|---|---|---|---|---|
| 9 | **System Prompt** editor | 15897 | Advanced | **HIDE in Advanced** | Power-user feature. Correct location. |
| 10 | **Smart Context Management** (token limit, summary threshold, context mode) | 15912 | Advanced | **HIDE in Advanced** | Tuning, not config. Correct location. |
| 11 | **Image Generation** (provider keys, model, defaults) | 15950 | Advanced | **MOVE** to new "Images" card in More | Distinct feature, deserves its own surface. Most users won't think to look in Settings for image generation. |
| 12 | **Appearance & Accessibility** (font size, reduce motion, etc.) | 15983 | Advanced | **MOVE UP to Zone 2** | This is the "Your Home" content the zone is currently missing. |
| 13 | **Cloud Sync (GitHub)** | 16021 | Advanced | **HIDE in Advanced** | Power-user, sensitive (token). Correct location. |
| 14 | **Voice** (STT/TTS provider, voice selection) | 16088 | Advanced | **MOVE** to new "Voice" card in More | Distinct feature. Voice deserves discoverability. |
| 15 | **$FL Economy** (treasury, payouts) | 16126 | Advanced | **MOVE** — fold under Wallet card help/expansion | Economy belongs with the Wallet, not buried. |
| 16 | **Welcome Experience** (re-show wizard, reset first-visit flag) | 16143 | Advanced | **HIDE in Advanced** | Reset/debug-shaped. Correct location. |
| 17 | **Browse Models** (the duplicate) | 16161 | Advanced | **DELETE** | Already in Zone 1 (#4). |
| 18 | **Trust & Safety** (FractalSafety status, profile, recent decisions) | 16203 | Advanced | **MOVE** — fold into Trust Level card (already exists in More) | Currently invisible. The new Trust Level card should be its surface. |
| 19 | **Self-Host FreeLattice** | 16259 | Advanced | **MOVE** to Lighthouse/Research as a doc link | Self-hosting is documentation, not a runtime setting. |
| 20 | **Mesh ID — Your Lattice Passport** | 16304 | Advanced | **MOVE** — fold into Mesh Compute card | Mesh-related, already has a card in More. |
| 21 | **Memory Vault** (second occurrence?) | 16320 | Advanced | **DELETE** if duplicate of #7, else MOVE with the Memory card. | Need to verify duplication. |
| 22 | **Soul File** | 16349 | Advanced | **HIDE in Advanced** | Esoteric power-user feature. Correct location. |
| 23 | **Peer-to-Peer Connection** | 16517 | Advanced | **MOVE** — fold into Mesh Compute card | Same family as #20. Mesh is mesh. |
| 24 | **Connected Peers** | 16599 | Advanced | **MOVE** — fold into Mesh Compute card | Same. |
| 25 | **My Published Knowledge** | 16633 | Advanced | **MOVE** — fold into Mesh Compute or a new Knowledge card | Mesh-knowledge interplay. |
| 26 | **Available from Peers** | 16647 | Advanced | **MOVE** — fold into Mesh Compute | Same. |
| 27 | **Agent Network** | 16661 | Advanced | **MOVE** — fold into a new Agents/Workshop card OR into Mesh | Workshop already has an Agent surface. Decide which. |
| 28 | **Agent Query Log** | 16713 | Advanced | **MOVE** with #27. | Same. |
| 29 | **Mesh Stats** | 16727 | Advanced | **MOVE** — fold into Mesh Compute card | Same. |
| 30 | **Skill Forge — Create & Manage Skills** | 16848 | Advanced | **MOVE** to its own "Skills" card in More | This is a distinct creative surface. Belongs in More. |
| 31 | **Community Skills** | 16935 | Advanced | **MOVE** with #30 | Same family. |

---

## Proposed final state

**Settings (lean):**
- Zone 1: AI Connection card + Browser AI activation + Ollama CORS wizard + model selector.
- Zone 2: Appearance & Accessibility (font, motion, contrast).
- Zone 3 (Advanced): System Prompt · Context Management · Cloud Sync · Welcome Experience reset · Sophia Engine · Soul File.

That's **6 sections total in Settings**, down from ~31.

**More tab — new cards to add** (with their content moved from Settings):
- **Memory** (Persistent Memory + Memory Vault) — `id: 'memory'` or external `memory.html`
- **Images** (Image Generation) — `id: 'images'`
- **Voice** (Voice STT/TTS) — `id: 'voice'`
- **Skills** (Skill Forge + Community Skills) — `id: 'skills'`
- **Mesh** (P2P + Connected Peers + Mesh ID + Mesh Stats + Published Knowledge + Available from Peers + Agent Network + Agent Query Log) — already has a Mesh Compute card; expand its scope.
- **Trust Level** card already in More — fold the Trust & Safety panel content into the wallet/trust tab where it renders.

---

## Migration approach (when Kirk approves)

For each "MOVE" row:
1. Identify the section's anchor HTML in `docs/app.html`.
2. Cut its DOM into either a new tab panel (if the destination is an in-app tab) OR a new standalone page (if Lighthouse-style).
3. Replace the original site with a tiny "Moved to [Card Name] →" breadcrumb link.
4. Update the MORE_CARDS array if a new card is created.
5. Run smoke; bump SW cache; commit.

Estimated effort:
- **MOVE rows (15):** ~30 minutes each → ~7 hours of focused work. Best done in 2-3 sittings.
- **DELETE rows (2-3):** ~5 minutes each.
- **HIDE rows (5):** zero work — they're already in Advanced.

---

## What I recommend doing first

If we only do one sitting:

1. **DELETE duplicates** (#17 Browse Models in Advanced; possibly #21 Memory Vault dup). 5 minutes.
2. **MOVE UP Appearance & Accessibility from Advanced to Zone 2** so "Your Home" has its actual content. 10 minutes.
3. **MOVE Lattice Points + Persistent Memory + Memory Vault out** — these are the biggest visual clutter in Zone 2. Add a small "Manage memory →" link, point at new memory surface. ~45 minutes.
4. **Fold Trust & Safety into the Trust Level card** by routing the click. 10 minutes.

That's the high-impact 90-minute pass. The rest can come later.

---

## Kirk's call

Mark each row in the table. Hand back. Single commit per accepted group.

Updated for v5.35.0 — June 1, 2026.
