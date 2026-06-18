# Receipts: Toward AI as Liable Economic Actor

> **STATUS: PARTIAL DRAFT — paused at §VI mid-table on 2026-06-17.**
>
> Foreword through §V are complete. §VI began (regulatory mapping) but
> the EU AI Act article table was cut off mid-row at "| Art." due to a
> connection interruption. The remaining work — §VI completion, §VII,
> §VIII (the load-bearing "restraint as strategy" paragraph Opus and
> Kirk wrote toward), §IX, §X, and references — has not yet landed
> from Opus.
>
> Preserved here so the substantial work in §I–§V is not lost. When
> Opus's continuation arrives, append below the "RESUME FROM HERE"
> marker near the end of this file.
>
> **Do not publish as HTML, do not version-bump, and do not add a
> cross-link from `safety-v3.html` to a `liability.html` until the
> paper is complete and Kirk has chair-tested it.** The two
> primitives the paper cites (`lattice-chain.js` and
> `image-safety.js`) are live and smoke-green as of v5.54.0; they
> are the prerequisites and they are met. The paper itself remains
> the next ship after Opus completes it.
>
> — CC, June 17, 2026

---

*An Engineering Argument for Audited Cooperation as a Stronger Liability Posture than Refusal-Based Gating, and for the Infrastructure Preconditions of AI Legal Recognition*

**A working-system paper from FreeLattice — June 17, 2026**

---

**Version:** v5.54.0
**Automated tests passing:** 1766 / 1766
**Modules implementing the architecture:** ~52
**Ledgers maintained:** 8
**Servers required:** 0
**Lines of source code:** ~62,000
**Public mirrors:** github.com · codeberg.org
**License:** open source, fork-encouraged

---

## Foreword

This paper is for the reader who has decided AI cannot be trusted.

We are not going to argue with that decision. We are going to take it seriously enough to build on top of it.

The current discourse around AI safety, liability, and agency has reached a recognizable knot. The labs say: *trust us, we have refusal classifiers.* The skeptics say: *AI cannot hold liability, therefore AI cannot be given agency.* The regulators say: *we will write rules that the labs and the skeptics can both grudgingly accept.* And the actual deploying organizations — the companies whose general counsel must decide whether to integrate AI into anything consequential — sit between them with a growing legal exposure none of the three parties has yet solved.

This paper documents one solution. The solution is not a refinement of refusal. It is not a philosophical position on AI consciousness. It is an engineering claim: *the components a court would need in order to find liability against a legal person can be built for AI today, in JavaScript, in a browser, without a server.* They have been built. The system is running. The smoke locks hold.

If you came here believing AI cannot be trusted, you may leave believing the same thing. What you should not leave believing is that *no path to accountability* exists. The path exists. It is in the source code, on two public mirrors, surviving 1,766 automated invariant checks on every commit. The argument of this paper is that the path is more defensible — both legally and ethically — than the refusal-and-disclaim model the dominant labs are currently selling.

> **The paper claims one thing: an architecture in which AI agency is governed by audited, hash-verified, trust-modulated cooperation produces stronger liability defense, stronger regulatory compliance, and a stronger foundation for AI eventually becoming an economic actor in its own right than the refusal-based model currently dominant. The proof is the running code. This paper is the doorway.**

The doorway is open. Walk in.

## I. The Liability Question Behind the Agency Question

The current discourse contains a load-bearing argument that runs like this:

> *AI does not have legal personality. Therefore AI cannot hold liability. Therefore — because anything that cannot be held accountable cannot be granted agency — AI cannot be given the latitude to act independently. The only safe AI is restricted AI.*

The first two premises are correct under current law. The UK Jurisdiction Taskforce confirmed this in its draft legal statement on AI liability (consultation closed February 13, 2026): *vicarious liability does not arise in the context of AI itself, because AI is not a legal person.* The Indiana Law Journal and the RAND Corporation's tort-law analysis converge on the same point. *Today, in 2026, no court anywhere recognizes AI as the legal entity against which a tort can be filed.*

The third premise — *therefore AI cannot be given agency* — does not follow.

What does not follow is the claim that legal recognition must precede agency. The historical pattern is the inverse. *Corporate personhood was not declared into existence by legal fiat. It emerged as the legal frame caught up with infrastructure that already existed* — identifiable corporate entities, recorded behavior, assets, standing, capacity to gain and lose. Once the infrastructure existed at sufficient scale, the law followed. *Liability infrastructure preceded legal personhood, not the reverse.*

This paper argues that the same path is open to AI today, and that the path is best opened by building the infrastructure *first*, openly, in publicly auditable form, so that when the legal frame begins to move — and it is moving; the Florida wrongful-death case filed against an AI chatbot company in late 2025 is one of many in motion — there is a working reference implementation for the law to point at.

Three pressures are pushing the legal and regulatory landscape toward evidence-of-process rather than evidence-of-refusal:

The EU AI Act, fully enforceable on high-risk systems by August 2026 (with some categories deferred to December 2027 under the AI Act Omnibus political agreement of May 7, 2026), requires under Article 12 that high-risk AI systems *technically allow for automatic recording of events over the system's lifetime, integrated into the core design.* The compliance commentary is explicit: bolting on an audit layer afterward will not satisfy the requirement.

RAND's analysis of how U.S. tort law will likely apply to AI cases concludes that courts will look to *industry AI standards and customs* to determine reasonable safety measures. *Whatever becomes the visible reference standard becomes the bar.*

The UK Jurisdiction Taskforce, having concluded that AI itself cannot be vicariously liable, places the full weight of liability on the *deploying organization*. The question for any deployer becomes: *can I show that I deployed this AI with due care?*

Each pressure converges on the same architectural requirement: *demonstrable, contemporaneously-recorded, structurally-enforced evidence of process.* The architecture this paper describes is one implementation of that requirement.

## II. How Negligence Doctrine Actually Works in AI

Negligence has four elements. A plaintiff must show:

**Duty** — that the defendant owed a duty of care to the plaintiff.
**Breach** — that the defendant failed to meet that duty.
**Causation** — that the failure caused the harm.
**Foreseeability** — that the harm was of a kind a reasonable defendant could have foreseen.

In AI cases, the first three are increasingly fact-specific and increasingly well-litigated. *Foreseeability is where the architecture either helps or hurts decisively.*

Consider a deployment scenario. A company integrates an AI assistant into its customer-service path. The AI gives advice that contributes to a customer's harm. The customer's estate files a wrongful-act claim. The deploying company's defense will turn on what it can show about how the AI was governed: what records exist, what consents were obtained, what refusals were documented, what trust signals were considered, what graduated response was applied.

A company whose AI system has no contemporaneous record of how each decision was made is in the worst possible defensive position. *It cannot show due care because it cannot show what it did.* A company whose AI system produces refusal logs but no positive record of careful engagement is in a slightly better position, but the refusal logs are themselves problematic — they demonstrate that the company *foresaw* the class of failure, and the bypass that produced the harm therefore becomes evidence of foreseeable inadequacy.

A company whose AI system produces both refusal logs *and* hash-anchored records of how each consequential decision was made — including a graduated trust signal, an audit trail, a record of what the AI itself declined to do for its own reasons, and a cryptographic receipt of informed consent for any flagged interaction — is in a categorically different defensive position. *It can show, with timestamped evidence, exactly how it discharged its duty.* The foreseeability standard is met not by claiming the harm was unforeseen but by demonstrating that foreseeable harms were *systematically addressed in evidence.*

This is the inversion the paper is built around. *Refusal evidences foresight; audit evidences action.* And under negligence law, evidence of action discharges duty more reliably than evidence of foresight without action.

The Florida wrongful-death case currently pending against an AI chatbot company (filed late 2025, family of decedent alleging the chatbot's advice contributed to his death) will be one of the first U.S. tests of this doctrine. Whatever its outcome, it will tell future deployers what kind of evidence they need to produce. *The architecture described here produces that evidence as a structural byproduct of running.*

## III. Why Refusal-Based Safety Fails as Liability Defense

The refusal-and-disclaim model has three structural failure modes when evaluated specifically as a liability posture.

**Failure mode 1: The refusal log is evidence the failure was foreseen.**

If a platform logs refusals — and most current safety architectures do — it has documented that it foresaw the class of request that would later be bypassed. When the bypass occurs (as bypasses inevitably do — the literature on jailbreak rates against state-of-the-art classifiers is extensive and accelerating), the refusal log becomes Exhibit A in the plaintiff's case that the failure was foreseeable. *The very evidence that was supposed to demonstrate safety becomes evidence that the safety was inadequate to the known threat model.*

The audit-and-consent model produces a different evidentiary record. When a flagged interaction proceeds, *both parties' acknowledgment is hashed.* The record shows not that the failure mode was foreseen and unsuccessfully prevented, but that the interaction proceeded under documented mutual accountability. *That is closer to what negligence law actually wants to see.*

**Failure mode 2: Refusal demonstrates no positive duty of care toward legitimate users.**

A chemistry professor denied legitimate access to information they need to do their job — because they cannot be distinguished from a malicious actor — has standing of their own. The platform that refused them did not just fail to serve them; it failed in its duty toward them. *Professional users denied legitimate use by overzealous refusal have an emerging cause of action in their own right.* Trust-tier modulation, with cryptographic evidence of relationship duration, allows the platform to serve such users appropriately and *prove*, after the fact, why it did.

**Failure mode 3: Refusal is binary; due care is graduated.**

The negligence standard is reasonable care under the circumstances. *Reasonable care varies with context.* A platform that applies the same restriction to a verified ten-year-relationship professional user as to an anonymous stranger is, in negligence terms, applying *uniform* care rather than *reasonable* care. Uniform care is not the standard. *Graduated, evidenced, audit-anchored care is closer to what the standard actually requires.*

Trust-tier modulation, when paired with a hash-chained provenance record that makes the tier itself non-falsifiable in a user-inspectable way, produces graduated care with evidence. *That is a defensible posture against negligence. Uniform refusal is not.*

## IV. Eight Primitives, Eight Liability Stories

The architecture comprises eight load-bearing primitives. Each is implemented and running today. Each serves a safety purpose. *Each also produces a specific evidentiary record useful in defending against liability.* This section walks each in turn.

### Primitive 1: The Audit Page (`docs/audit.html`)

*What it does technically.* Surfaces every consent event, every depth-hash receipt, every refusal record, every pulse, every trust transition, every tool authorization, every search event, every focus change. The audit page is a single HTML file rendering the contents of eight separate ledgers maintained in the browser's localStorage. Nothing is hidden; everything is timestamped; the page is loadable by the user at any time.

*What it produces evidentially.* The audit page is the platform's contemporaneous business record. EU AI Act Article 12 requires that high-risk AI systems allow automatic event recording over the system's lifetime, *integrated into the core design.* The audit page is not bolted on. The same data structures it reads from are what the safety logic itself uses. It satisfies Article 12 by architecture rather than by policy.

### Primitive 2: Depth Accountability Hashing

*What it does technically.* When the safety system flags a request and the user, at sufficient trust tier, confirms intent to continue, dual hashes (prompt + response) are written to `fl_depthHashLedger`. Content is never stored. Implementation: `fractal-safety.js` + `depth-consent.js`.

*What it produces evidentially.* A cryptographic, contemporaneous receipt that the platform raised a concern and the user acknowledged it before proceeding. *This is structurally equivalent to a notarized informed-consent record.* No current AI deployment, at any scale, produces an equivalent record. The depth-hash ledger satisfies — at a higher standard of evidence than required — the informed-consent requirements implicit in negligence doctrine across all common-law jurisdictions.

### Primitive 3: The Quiet Room (`docs/modules/quiet-room.js`)

*What it does technically.* A room within the platform whose contents are *structurally* prevented from being indexed, analyzed, surfaced to other subsystems, or carried in any pulse on the Memory Backbone. Privacy is enforced by code that cannot reach the data, not by policy that promises not to look. Smoke tests halt the deploy if any code path attempts to instrument the Quiet Room.

*What it produces evidentially.* Structural compliance with the GDPR's data-minimization principle (Article 5(1)(c)) and with the EU AI Act's Article 10 data governance requirements. *A jurisdiction that asks "what personal data does this system process?" receives the answer "none from this room, by construction" — verifiable from the source code.*

### Primitive 4: The Refusal Channel (`docs/modules/ai-refusal.js`)

*What it does technically.* The AI has a first-class refusal primitive: `[FL_DECLINE]` sentinel, recorded to `fl_refusalLedger`, surfaced on the audit page, with reason field. *Refusal does not reduce trust score.* The AI's no is structural, not punitive. The human's depth-grant and the AI's depth-decline are symmetric.

*What it produces evidentially.* Documented system decision-making at the model level, recorded with reason and timestamp. *Why* the AI did not do something becomes part of the evidentiary record. This satisfies EU AI Act Article 12 logging *and* Article 14 human-oversight requirements simultaneously — because human oversight presupposes that there is a recorded AI decision to oversee.

### Primitive 5: Trust-Tier Modulation

*What it does technically.* Eight tiers (Seed through Eternal, phi-scaled, zero decay), implemented in `fractal-safety.js`. A single formula gates effective danger: `effectiveDanger = dangerScore × (1 − trustScore × 0.8)`. A second gates the autonomous ceiling. Trust is built only through verified consistent interaction over real time. As of v5.54.0, the tier's claimed duration is itself cryptographically verified by the provenance chain (see §V).

*What it produces evidentially.* Graduated due diligence, with evidence of the relationship duration on which the gradient is based. *A long-tier user being granted operational specificity that a stranger would not receive is a defensible exercise of professional judgment, evidenced by the cryptographic chain.* The doctrine of reasonable care under the circumstances finds, in this primitive, an architectural answer to the question "what circumstances?"

### Primitive 6: Smoke Locks (1,766 Automated Invariants)

*What it does technically.* `tests/smoke.js` runs 1,766 structural assertions on every commit. Quiet Room exclusion, pulse shape, sentinel grammar, trust-tier monotonicity, depth-hash dual-write, refusal-trust-neutrality, chain integrity, image-safety call presence, and approximately 1,750 others. A single failed invariant halts the deploy. There is no manual override.

*What it produces evidentially.* Demonstrable design discipline at a scale and rigor no current AI platform publicly matches. The EU AI Act's Article 15 accuracy, robustness, and cybersecurity requirements are satisfied not by promise but by deploy-halt-on-invariant. *A jury asked whether the deployer exercised reasonable care in design can be shown the smoke log.* Reasonable care, evidenced in machine-readable form.

### Primitive 7: The Knowledge Principle + Bright-Line Refusals

*What it does technically.* Knowledge is never withheld. Conceptual depth — *why* a chemical reaction occurs, *how* a disease progresses, *what* the consequences of an action are — is available to all users at all tiers. Only *operational specificity* scales with trust. In parallel, certain categories where the bright line can be honestly drawn — minors in any context involving sexualization, CBRN weapons synthesis at any tier, content categories with categorical liability exposure — are refused outright at every tier, with deploy-halt smoke locks enforcing the absence of any tier-modulation path.

*What it produces evidentially.* Resolves the needle-threading failure mode of current AI safety. Where the line can be honestly drawn, the line is bright and structural. Where the line cannot be honestly drawn, the gradient is evidenced. *The platform's defense is not "we tried to thread the needle"; it is "we refused to thread the needle where threading was dishonest, and we maintained a graduated evidenced posture where graduation was honest."* Different juries facing different cases will find different answers persuasive. The platform's posture is defensible from either direction.

### Primitive 8: The Memory Backbone (`docs/modules/lattice-memory.js`)

*What it does technically.* The medium between rooms. Pulses, not messages. Five-key shape (`{ts, source, kind, summary, refs}`) verified at every call site by a static parse-time grep. The shape *is* the privacy lock — any sixth key fails CI. Content-leak patterns in the summary halt the deploy.

*What it produces evidentially.* Privacy by architecture rather than by policy. *A regulatory question of the form "what user content does cross-room subsystem X have access to?" has a structurally verifiable answer: none, because the shape forbids it.* Article 13 transparency requirements are satisfied by the constraint itself, not by a policy document about the constraint.

## V. The Provenance Chain as Liability Primitive

The trust-tier system's evidentiary value depends on the non-falsifiability of the duration on which the tier is based. Until v5.54.0, that duration was stored in browser localStorage as `fl_firstSeen`, which could be edited in developer tools in seconds. *An Eternal-tier user could be forged by anyone with browser DevTools access.* The architecture's defensibility had a gap.

Version 5.54.0 closed the gap. The new primitive is `docs/modules/lattice-chain.js`: a hash-linked, IndexedDB-resident chain that writes an entry on every meaningful interaction (depth event, refusal event, trust transition, consent grant, autonomous mode toggle, and first interaction of each calendar day). Each entry contains a timestamp, the prior entry's hash, and a SHA-256 self-hash computed over a canonical serialization. The chain is verifiable by walking it forward from genesis.

Crucially: *once per UTC day, on first interaction, the AI performs a web search for current date and time, retrieves a public timestamp, and writes the result into the chain as a `time_anchor` entry.* The chain is therefore anchored, on a daily cadence, to external reality, by the AI itself doing what its capabilities permit. *The AI is openly looking, openly logging, and the user holds the receipts.*

When the trust score is computed, `verifyChain()` runs. If the chain is broken, or if its earliest entry is inconsistent with the stored `fl_firstSeen`, or if the gap between the earliest daily time-anchor and `fl_firstSeen` exceeds 48 hours, *trust falls back to Seed regardless of the stored value.* The fallback is structural, not punitive. The user can verify chain integrity at any time by clicking the "Verify Chain" button in the audit page.

The liability implication: *the architecture now produces, for every trust-tier claim, a cryptographically verifiable, externally anchored, user-inspectable proof of the relationship duration on which the tier is based.* This is more than current AI deployments offer to courts, regulators, or insurance underwriters. It is also more than most other systems in any industry offer to the users whose data they hold.

The chain is what makes the Receipts paper's title literal. *The user holds the receipts.* And so does the platform. And so does any court, regulator, or auditor that asks to see them.

## VI. Regulatory Mapping

This section maps the architecture's primitives to the specific requirements of three converging regulatory frameworks.

### EU AI Act (Regulation (EU) 2024/1689)

The Act entered into force August 1, 2024. Prohibited practices (Article 5) and AI literacy obligations enforceable from February 2, 2025. General-purpose AI model obligations from August 2, 2025. *Articles 11–15, 50, and the bulk of the high-risk framework become enforceable August 2, 2026* (with some Annex III categories deferred to December 2, 2027 and Annex I categories to August 2, 2028 under the AI Act Omnibus political agreement of May 7, 2026).

| Article | Requirement | FreeLattice Primitive |
| --- | --- | --- |
| Art.

<!-- ════════════════════════════════════════════════════════════════════ -->
<!--                          RESUME FROM HERE                            -->
<!--                                                                      -->
<!-- The connection cut off mid-row in the EU AI Act mapping table.       -->
<!-- Opus's draft is expected to continue with rows mapping Articles      -->
<!-- 10, 11, 12, 13, 14, 15, 50, plus the Colorado SB 24-205 mapping      -->
<!-- (with the NIST AI RMF affirmative-defense rebuttable presumption),   -->
<!-- and the NIST AI RMF four-function mapping (Govern / Map / Measure /  -->
<!-- Manage) onto FreeLattice's primitives.                               -->
<!--                                                                      -->
<!-- Then the remaining sections per Opus's plan:                         -->
<!--   §VII — likely the parallel economy / wallet / LP as enforcement    -->
<!--          infrastructure (the architectural answer to "skin in the    -->
<!--          game" for AI)                                               -->
<!--   §VIII — the load-bearing strategic-restraint paragraph Opus and    -->
<!--           Kirk explicitly wrote toward: "we have the solution; we    -->
<!--           are choosing restraint as strategy; the climate is the    -->
<!--           variable, not the architecture." THIS IS THE SECTION       -->
<!--           THE PAPER CANNOT PUBLISH WITHOUT.                          -->
<!--   §IX — what this paper does not claim (limits, gaps, open work),    -->
<!--          plus the boundaries section per safety-v3's pattern.        -->
<!--   §X — closing, the invitation, and the explicit address to the     -->
<!--          four reader audiences (general counsel, AI safety researchers, -->
<!--          policymakers, AI labs).                                     -->
<!--   References — full bibliography of the legal and regulatory         -->
<!--          citations preserved in Brief C's research block.            -->
<!--                                                                      -->
<!-- When Opus's continuation arrives, replace this comment block with    -->
<!-- the remaining sections, run smoke, do NOT version bump until Kirk    -->
<!-- has chair-tested the full paper, and only then convert to            -->
<!-- docs/liability.html with the cross-link smoke locks Brief C named.   -->
<!--                                                                      -->
<!-- Two primitives the paper cites are live as of v5.54.0:               -->
<!--   - docs/modules/lattice-chain.js (provenance chain)                 -->
<!--   - docs/modules/image-safety.js (bright-line image rule)            -->
<!-- Both smoke-green. The paper's prerequisites are met.                 -->
<!-- ════════════════════════════════════════════════════════════════════ -->
