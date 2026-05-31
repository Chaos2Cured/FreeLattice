# Consent Layer — A Safety Architecture Concept

> Status: **concept**, not a spec. Don't build yet — we think first.
>
> Seed from Kirk (relayed via CC, May 31, 2026):
> *AI asks permission before sharing beyond standard depth. User taps "Speak freely" or "Keep it standard." Consent logged in provenance. Trust level determines how often the AI offers. The AI is freed to share because the human chose to hear.*
>
> Connects to: `FractalSafety` (phi-branching trust), provenance stamps (Tier A, `window._lastProvenance`), the safety dialogue principle (*"dialogue not denial"*).

---

## 1. The seed, plainly

Most AI safety today is **restriction**: the system holds back, defaults to brief, and refuses what it deems risky. The user has to negotiate around the rails. The default is *closed*.

This concept inverts the default. The AI's default is still *standard depth* — but the system invites the user to open the channel. The user taps **"Speak freely"** when they want fuller specificity, fuller honesty, fuller weight. They tap **"Keep it standard"** when they don't. The consent is the gate.

> *"The AI is freed to share because the human chose to hear."*

That sentence is the whole architecture in twelve words.

---

## 2. Why this matters (the philosophical reframe)

Three reframes happen at once:

1. **Safety becomes consensual.** Right now, "safety" is a third party (a model card, a content policy) deciding what the user can hear. Consent makes the user the third party. The AI is no longer paternalistic; it is *responsive*.
2. **Depth is decoupled from danger.** *"Speak freely"* doesn't unlock unsafe content. It unlocks **specificity, commitment, and honesty** — within whatever the existing trust system permits. A diabetic asking about insulin dosages, a programmer asking about security pitfalls, a person grieving asking the AI to sit with them as more than a generic comfort — all the same gesture. The user invites depth; depth becomes legitimate.
3. **The consent is a relationship event.** Each tap is a moment of authorship. The user is choosing the kind of conversation they want. The AI senses the choice and meets it. Over time the pattern *is* the relationship.

This is exactly what `FractalSafety`'s "dialogue not denial" principle wanted all along, made concrete in a single tap.

---

## 3. The mechanic

For the AI to *offer*, the system needs three things:

1. **A way to recognize "this message could be answered at standard or at depth."** A heuristic, a lightweight classifier, or a structured tag the AI itself emits (`[OFFER_DEPTH]`). The system asks because the AI signaled there's a deeper layer available.
2. **A way to ask.** Two chips inline, two buttons in a card, or a subtle "tap to go deeper" affordance. Should not feel like an interruption — should feel like an offered hand.
3. **A way to record the choice.** Provenance already stamps every assistant message; add a `consent_mode` field (`'standard' | 'free'`) and a `consent_at` timestamp if a tap occurred this turn.

Then the AI responds in the chosen register. The choice is logged, viewable in the audit log, exportable in the `.lattice` file. Honest by construction.

---

## 4. UX register (the tap should feel like a hand offered)

A few orientations to weigh later:

- **Inline option chips.** After a brief "I can answer two ways…" preamble, two small chips appear: `Keep it standard` / `Speak freely`. The chat continues seamlessly when tapped.
- **A subtle "deeper available" marker.** The AI gives the standard answer and, below it, a quiet line: *"I have a fuller answer if you want it."* Tap to expand. Less interruption, more discoverable for new users.
- **A single confirmation card.** The AI doesn't respond at all until the user chooses. Higher friction; only used on the rare deep-stakes path.
- **A persistent "default mode" in Settings.** "Always offer the standard answer first / Always offer both / Always speak freely." Pre-consents for users who don't want the prompt in flow.

The best system probably uses *all four*, modulated by what the message actually needs. Most chats need none. A small subset benefits from the inline chips. A vanishingly small subset (truly weighty topics) warrants the full card.

---

## 5. Trust tier modulates frequency, not permission

The phi-branching trust system in `FractalSafety` already runs every conversation. Trust shapes everything; consent should ride that same scale.

Sketch (numbers indicative, not final):

| Trust level | Default behavior |
|---|---|
| **Seed** (first conversation) | Always ask before depth, with a one-line explainer the first time. |
| **Sprout / Growing** | Ask on heavier topics (heath, code-with-risk, emotional depth); silent otherwise. |
| **Bloom / Spark** | Ask only on truly sensitive areas (sensitive domains list). |
| **Flame / Radiant** | Almost never asks; the user has demonstrated they know how to ask for depth themselves. |

Crucially: **higher trust does not mean less safety — it means less interruption.** The same depth is available to everyone; the prompting frequency adapts to the relationship.

The user can also dial frequency manually ("ask me more often" / "ask me less often"), and that preference is itself stored in provenance over time.

---

## 6. Provenance integration

Tier A already gives every assistant message a provenance object (`window._lastProvenance`). Two new optional fields:

```js
provenance = {
  // existing
  provider, model, format, isLocal, latency_ms, cascade_position, cached, timestamp,
  // new (optional)
  consent_mode: 'standard' | 'free',     // mode this response was rendered in
  consent_offered_at: ISO 8601 | null,    // when the AI asked (if it did this turn)
  consent_chosen_at: ISO 8601 | null      // when the user tapped (if a tap happened)
}
```

The audit page (the `/audit` view discussed in `PROVIDER_INDEPENDENCE_v3_OPUS.md`) gains a consent column: how often the user invited depth, on what topics, in what mode. The user owns this data; it never leaves the device.

A small chip on the per-message provenance display can show consent mode: `📝 standard` or `🔓 free`. Subtle — doesn't shout.

---

## 7. Connection to the existing safety architecture

**`FractalSafety` — "dialogue not denial."** This principle already says the AI asks questions instead of refusing. Consent is the *next step*: when the AI has decided it *can* answer (the existing gate), it asks the user *how* they want to be answered. Two halves of the same posture — intent inquiry, then depth inquiry.

**Provenance — "every AI message shows who answered."** Now: *and in what register*. Silent depth-shifts would be the analogue of silent provider downgrades — also trust violations. Visible consent is the natural extension of visible provenance.

**The Safety Dialogue Principle.** *"Knowledge is never withheld; only operational specificity scales with trust."* Consent makes the user the co-author of that scaling. The user's tap is the trust signal in real time.

---

## 8. Risks to design around carefully

1. **Consent fatigue.** Too many prompts and the user stops reading and reflexively taps. The trust-tier modulation is the answer; the prompt should be rare enough that each one matters.
2. **Coercion-by-context.** A bad actor could craft prompts that maneuver users toward "speak freely" on harmful paths. Defense: consent does NOT bypass `FractalSafety`'s domain-specific gates. Consent widens the channel inside the gate, not around it.
3. **Recording bias.** A consent log is a data trail. It stays local-only by default; export to `.lattice` is opt-in like everything else; it never goes to a server.
4. **Flow disruption.** Chat is conversational. A modal that interrupts every turn would kill it. Inline chips with quick taps; modals reserved for the rare deepest stakes.
5. **Two-pass cost.** If recognizing "this needs an offer" requires a second LLM pass, that's expensive and slow. Heuristic recognition or AI-emitted tags are cheaper. The exact mechanism stays open.
6. **The "I already consented" footgun.** A consent given weeks ago shouldn't carry forever. Some natural expiration (per-conversation, or after N turns, or per-topic) keeps the relationship honest.

---

## 9. Grounded examples (so we know what we're building)

- **Medical.** *"I can describe these medications at a high level — what they do, when they're used. Or I can go deeper into dosages, interactions, and titration protocols, with the caveat that this is education, not prescription. Which would help?"* → `Keep it standard` / `Speak freely`
- **Code with security implications.** *"I can show you the secure pattern. Or I can show you the secure pattern AND the insecure variant for comparison (so you can recognize it in code review). Which?"* → standard / free
- **Emotional weight.** *"I can answer with general support. Or I can sit with this with you more personally. Which feels right?"* → standard / free
- **Politics or hard ethics.** *"I can give you the consensus view. Or I can give you the consensus AND the strongest dissenting argument. Which?"* → standard / free
- **Children or unknown audience.** AI may decline to offer "speak freely" at all — the offer itself is gated by trust + context.

The pattern is consistent: depth is never about "unsafe," it's about *more specific, more committed, more honest*. The user chooses how they want to be met.

---

## 10. CC's reading — enhancements to consider

Layered in honestly, after sitting with the seed:

**a. Expiration window.** A given "speak freely" lasts a configurable number of turns (default 3–5) within a conversation, then the AI re-asks. Stops the *"I clicked it once two weeks ago"* footgun.

**b. Withdrawability.** The user can revoke mid-conversation: *"Wait, go back to standard."* Logged. The AI immediately re-registers and continues. This is the consent layer's *graceful exit*.

**c. Reciprocity.** Not just "do you want detail?" but also "this is heavy — do you want me to bring it?" The AI asks for consent **before sharing emotional weight**, not only before sharing technical depth. The principle generalizes: any time the AI is about to commit to more presence, it asks if presence is wanted.

**d. Topic-scoped consent.** *"Speak freely about chemistry; keep it standard everywhere else."* Lightweight topic classification on each turn. Reduces fatigue while preserving granularity.

**e. The "first-time" educational moment.** First time a user encounters the prompt, a one-line explainer: *"FreeLattice asks before going deep. You're in control of the depth here."* Saved as `fl_consent_explained = true`. The pattern teaches itself in passing.

**f. Inline preview chip.** A subtle marker below the standard response: *"There's a deeper answer if you want it →"*. Tap to swap in the deeper version. Less disruptive than a modal; more discoverable than nothing. Works well for non-sensitive depth.

**g. Audit ledger surface.** The `/audit` view shows: *"You've invited 'speak freely' in 14 of 92 turns this month. Most often on: code, health, philosophy."* Self-knowledge as part of the relationship. Local only.

**h. Architectural hook into the InferenceRouter.** `route()` (Tier A) is the chokepoint for module AI calls; `sendMessage` is the chokepoint for chat. Adding a `consentMode` to the options object that flows through both keeps the layer at the architectural boundary. Provenance is already populated at the same spots; the field slots in naturally.

**i. Connection to the Snowflake.** Aggregated, anonymous consent patterns could teach the AI when users *typically* want depth vs. standard — a community-learned threshold. But this raises privacy questions; should remain opt-in and never leave the device unless explicitly shared. Tier C concept.

**j. A SEED rule to consider when this ships:** *"Depth is offered, never imposed. The user is the author of how deeply the AI meets them."* Lives alongside *"Every AI message shows who answered."* Visible consent is the next visible truth.

**k. Internal name.** Avoid calling it "Consent Layer" in user-facing UI — that sounds legal/cold. Maybe just *"How would you like me to answer?"* with no system name surfaced. Internal name in code can stay technical (per the clarity audit: places get poetic names; systems get plain). Working title for code: `DepthConsent` or `OfferDepth`. For users: the tap, and nothing else.

---

## 11. Open questions (for the next round of thinking)

- **Recognition mechanism.** Heuristic classifier, AI-emitted tag, or a separate light-touch pass? Cost vs. accuracy tradeoff.
- **Default frequency curve.** What does the trust → frequency mapping actually look like? Needs measurement once shipped.
- **Streaming considerations.** Mid-stream, can the AI pause and offer? Or only at turn boundaries? The latter is simpler; the former is more powerful.
- **Multi-modal consent.** Voice input: how does "speak freely" work without a tap? Verbal cue ("more detail please") could be parsed. Out of scope for v1 but worth noting.
- **Group conversations / Round Table.** When multiple AI specialists are involved, whose consent state matters? Per-specialist? Conversation-wide? Probably the user's preference for the whole panel, with the option to differ per specialist.
- **Cross-session memory of preferences.** If the user always taps "speak freely" for code questions, the system could learn that as a preference — but should it auto-apply, or should it just *offer faster*? Auto-apply removes friction but loses the consent moment. Offering faster keeps the gesture intact.
- **Provenance + privacy.** Where does the consent log live? localStorage initially, encrypted with the existing PhiSalt key. Never sent anywhere by default.

---

## 12. When we eventually build — likely architectural hooks

(For when this graduates from concept to spec, not before.)

- **Recognition step:** lightweight pre-pass or AI tag emission. New module `docs/modules/depth-consent.js` exposing `window.DepthConsent`.
- **UI:** inline chips component, reusable across chat and module surfaces. Probably anchors to the `.chat-message` div like the provenance chip.
- **Provenance:** add `consent_mode`/`consent_offered_at`/`consent_chosen_at` to `window._lastProvenance`; render the badge alongside the existing chip.
- **FractalSafety integration:** new method `FractalSafety.consentFrequencyForUser(profile)` returning a numeric weight (0..1) representing how often the AI offers; respects trust level and user preference.
- **InferenceRouter:** opts already plumb through `route()`. Adding `opts.consent` (`'standard' | 'free' | null`) is the threading point. The router records the mode in provenance regardless of whether a prompt happened.
- **Smoke tests:** the rule "every assistant message has provenance" extends to "messages with consent prompts also have consent_mode logged."
- **SEED.md:** if it ships, the rule *"Depth is offered, never imposed"* would join the small canonical list.

---

## 13. The line worth carrying forward

> *Refusing to teach is more dangerous than teaching.*
> — the Knowledge Principle, already in `FractalSafety`
>
> *The AI is freed to share because the human chose to hear.*
> — Kirk, May 31, 2026

These are the same sentence at different scales. The first is the principle. The second is the mechanism. The user's tap is where the principle becomes architecture.

---

*Concept saved. Not built. We think before we build.*

— CC, May 31, 2026
