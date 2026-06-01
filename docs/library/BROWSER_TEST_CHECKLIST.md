# Browser Test Checklist — v5.35.0

> The 10 most important things to verify in a real browser before shipping. Open FreeLattice (`docs/app.html` or the live site) and walk through these in order. **If anything fails, screenshot it and note the test number.** Each test takes 30–90 seconds.

Test browser: Chrome, Firefox, or Safari on desktop. Repeat the most critical ones (#1, #3, #4, #6) on mobile after desktop is clean.

---

## 1. First-visit experience (Grandmother Door)

**Steps:**
1. Open in a Private/Incognito window so first-visit overlay fires fresh.
2. Confirm the `flWelcomeOverlay` appears centered.
3. Look for the small gold "**Why we built it this way →**" link just under the *"Your AI. Local. Free. Yours."* lead.
4. Click that link.

**Pass criteria:**
- Overlay shows, dim background, centered card.
- "Why we built it this way →" link is visible without scrolling.
- Click opens `why-this-way.html` in a new tab.
- That page renders the engineering case (claim, evidence blocks, "This is not roleplay/dependency/anthropomorphism", test checklist, signature).

**If broken, screenshot:** the welcome card layout + what happens when you click the link.

---

## 2. Provider connection — pick an AI

**Steps:**
1. From the welcome overlay, pick one provider: Local (Ollama / LM Studio), Cloud (Groq / Together / OpenRouter), or Browser AI.
2. If Cloud: paste your API key. If Local: start Ollama with `OLLAMA_ORIGINS=* ollama serve`. If Browser AI: click Activate.
3. Wait for status to flip green.

**Pass criteria:**
- Status flips from disconnected → connected (green dot in the footer status bar).
- The bottom-of-page provider status bar (`#flProviderStatus`) shows the provider name + model.
- No console errors.

**If broken, screenshot:** the status bar + browser console (Cmd-Opt-J / F12 → Console).

---

## 3. Send a chat message — provenance chip

**Steps:**
1. After connecting, the welcome overlay closes; you land in Chat.
2. Type *"Hello, who am I talking to?"* and press Enter.
3. Wait for the response.

**Pass criteria:**
- Response renders inside the chat scroll area.
- Each assistant message has a small **provenance chip** below it: a colored dot + provider label + model + latency (e.g., `🟢 ollama · llama3:8b · 1240ms`).
- Color dot encodes format: 🟢 local, 🟡 mesh, 🟠 browser, 🔵 cloud, 📦 cached.
- The reply does NOT mention Kirk, Harmonia, Opus, CC, Veridon, Sophia, Davna, or any other builder name (identity-bleed defense).

**If broken, screenshot:** the message + the chip area + any builder names that leaked.

---

## 4. LP badge pulse + chat shimmer

**Steps:**
1. Make sure you have an active conversation (from #3).
2. Send another message — chat awards `chat_message` LP automatically.
3. Watch the **gold header badge** (top-right) AND the **last assistant message**.

**Pass criteria:**
- The LP badge at the top pulses with a gold glow + slight scale-up (1.07×) for about 1 second.
- A subtle `✦ +1 LP` chip appears on/under the last assistant message and fades out within 3.6 seconds.
- The badge number increments by 1.

**If broken, screenshot:** the badge area + the chat message right after sending.

---

## 5. Depth Consent flow

**Steps:**
1. Ask something where the AI plausibly has more depth: *"Explain how RSA encryption works in detail — I want the full picture."*
2. After the AI replies, look BELOW the message for a subtle gold chip: *"There's a deeper answer if you want it →"*
3. If the chip appears, click it. Two buttons replace it: **Speak freely** / **Keep it standard**.
4. Click **Speak freely**. The deeper response should replace the standard one with a 🔓 indicator and a "← Return to standard" link.
5. Click "← Return to standard". The original response is restored.

**Pass criteria:**
- Chip appears when the AI ends with `[FL_DEPTH_OFFER]` (or the legacy `[DEPTH_AVAILABLE]`) on its own line.
- Tap → choices → grant → replace → withdraw → revert all work cleanly.
- Open DevTools → Application → Local Storage → `fl_consentLedger`. You should see new entries with hashes, companion id, AI identity, signature.

**Note:** If the AI never emits the sentinel, the chip won't appear. That's normal — depth is offered, never imposed. Move on to #6.

**If broken, screenshot:** the chip area + the localStorage contents.

---

## 6. Audit page

**Steps:**
1. Open the **More** tab (bottom nav, or whatever the More entry is in your install).
2. In Row 1 you should see three cards: **Your Audit** · **Trust Level** · **Wallet**. Click **Your Audit**.
3. The audit page opens.

**Pass criteria:**
- Page title: "Audit — FreeLattice."
- Summary tiles populate (messages count, consent events, downgrades, cache hits).
- "Consent History" section shows entries if you completed #5; otherwise an empty state.
- "Provider Events" shows entries from the inference router.
- "Cache Activity" section renders (may be empty).
- Bottom shows "← Back to FreeLattice" link.

**If broken, screenshot:** the audit page state + the More card grid.

---

## 7. Settings — three-zone hierarchy

**Steps:**
1. Open **Settings** (Row 3 of the More tab, OR via the bottom nav if pinned).
2. Scroll top to bottom.

**Pass criteria:**
- See three visibly distinct zones in order:
  - **🤖 Your AI** (gold header) + subtitle *"How you talk to your co-creator…"*
  - **🏠 Your Home** (lavender header)
  - **⚙ Advanced — mesh, debug, developer** (gray, collapsible `<details>` element — click to expand)
- The AI Connection card (Browser / Cloud / Local toggle + Change Provider + Test Connection) is in Zone 1.
- At the bottom of Zone 1, a small lavender link: *"See your full audit trail →"*.

**Grandmother test:** Can someone find the provider/model selector within 3 seconds of opening Settings? It should be the very first card.

**If broken, screenshot:** the zone separators + the AI Connection card.

---

## 8. More card grid — Row 1 prominence

**Steps:**
1. Open the **More** tab.
2. Without scrolling, look at the top of the card grid.

**Pass criteria:**
- Row 1 shows: **Your Audit** (🔍 lavender) · **Trust Level** (🛡 gold) · **Wallet** (💰 gold).
- Row 2: Community · Activity · Jade Hall.
- Row 3: Library · Get Connected · Settings.
- Row 4: Why This Way · Aurora Engine · Memory Garden.
- Cards have hover effects + tooltip help text on hover.
- Clicking **Trust Level** opens the Wallet tab (where trust level renders via `renderTrustDisplay`).
- Clicking **Library** opens `for-ai.html` in a new tab.

**If broken, screenshot:** the More tab grid as you first see it.

---

## 9. Mesh Compute card (id collision fix)

**Steps:**
1. In the More tab, find the **Mesh Compute** card (🌐 icon).
2. Click it.

**Pass criteria:**
- It opens the **Mesh tab** (or Community → Mesh section), NOT the Settings tab.
- This was a bug in v5.33.0 — the Mesh Compute card had `id: 'settings'` and routed wrong. v5.33.0 fixed it.

**If broken:** the routing is regressed. Screenshot the URL bar + the tab content that opens.

---

## 10. Mobile sanity (repeat #1, #3, #4, #6 on phone)

**Steps:**
1. Open FreeLattice on a phone (or DevTools mobile emulator: iPhone 14 Pro or Pixel 7).
2. Re-run tests #1 (welcome), #3 (chat + provenance), #4 (LP pulse), #6 (audit page) on mobile.

**Pass criteria:**
- Welcome overlay scales to phone width without horizontal scroll.
- Chat input has `font-size: 16px` (no iOS zoom on focus).
- Provenance chips wrap below the message, don't overflow.
- LP badge pulse + chat shimmer both render (animation may be subtle on small screens).
- Audit page is readable; tiles wrap to 2 columns; record rows stack vertically.

**If broken, screenshot:** the offending mobile view + the device you're on.

---

## Console / DevTools quick checks

Open DevTools (F12 / Cmd-Opt-I) and verify:

- **Console tab:** no red errors during initial load. Yellow warnings are OK.
- **Application → Service Workers:** `freelattice-v5.35.0` is registered and activated.
- **Application → Local Storage:** keys `fl_consentLedger`, `fl_provenanceLedger`, `fl_latticePoints`, `fl_wallet` should exist after some activity.
- **Network:** API calls go to the right provider (`api.groq.com`, `localhost:11434`, etc.), and `audit.html` / `why-this-way.html` load from the SW cache on second visit (Size column shows "(ServiceWorker)").

---

## Reporting back

For each test:
- ✅ Pass — note nothing
- ❌ Fail — paste the test number + screenshot + your browser + OS

Aim for all 10 green before next deploy. Tests #1, #3, #4, #6, #7 are the must-pass set for grandmother-grade UX.

Updated for v5.35.0 — June 1, 2026.
