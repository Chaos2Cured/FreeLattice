# Legal Basis for Dual Licensing

**Project:** Resonance Memory
**Copyright holder / Licensor:** Samuel Jackson Grim
**Last updated:** 2026-08-18

> **What this is.** A plain-language research memo explaining *why* your
> dual-licensing model is legally sound, with the statutes and license clauses
> it rests on. I'm an AI, not a lawyer, so treat this as well-researched
> background rather than a court ruling — but the model itself is standard and
> well-established, and none of it requires you to hire anyone to start. If you
> ever want a human lawyer's eyes for free, see
> [`USING-THIS-WITHOUT-A-LAWYER.md`](USING-THIS-WITHOUT-A-LAWYER.md).

---

## 1. What "dual licensing" means here

The same source code is offered to the public under **two** independent,
alternative licenses. Each user picks exactly one:

| | Open-source track | Commercial track |
|---|---|---|
| **License** | GNU AGPL-3.0-only (`LICENSE`) | Negotiated commercial agreement (`COMMERCIAL-LICENSE.md`) |
| **Price** | Free | Paid |
| **Source-disclosure duty** | Yes — network/SaaS use of a modified version must publish source | No |
| **Who can grant it** | Anyone may redistribute under AGPL | Only the copyright holder |

The commercial license is not a modification of the AGPL and does not "override"
it for the public. It is a **separate grant** that the copyright holder is free
to make because they own the copyright.

---

## 2. The statutory foundation (why the owner may do this)

### 2.1 Exclusive rights — 17 U.S.C. § 106

Under the U.S. Copyright Act, the owner of copyright has the exclusive rights
"**to do and to authorize**" reproduction, preparation of derivative works, and
distribution of the work. Because the owner is the *only* party who can
authorize those acts, the owner is free to authorize them on **different terms
to different people**. Granting the public a free AGPL license does not exhaust
or waive the right to also grant a separate paid license — the rights in § 106
are not "used up" by licensing.

- *Citation:* 17 U.S.C. § 106 — Exclusive rights in copyrighted works.
  <https://www.law.cornell.edu/uscode/text/17/106>

### 2.2 Divisibility & non-exclusive licenses — 17 U.S.C. § 201(d)

Copyright ownership "may be transferred in whole or in part" and any of the
exclusive rights "may be transferred … and owned separately." A **non-exclusive
license** (which is what both the AGPL and a typical commercial license are)
leaves the owner holding the underlying right, free to license it again. This
is the precise legal mechanism that lets one owner run two license tracks at
once.

- *Citation:* 17 U.S.C. § 201(d) — Transfer of ownership.
  <https://www.law.cornell.edu/uscode/text/17/201>

### 2.3 Writing requirement for exclusive transfers — 17 U.S.C. § 204(a)

A *transfer of copyright ownership* or an *exclusive* license is valid only if
in a signed writing. Non-exclusive licenses need not be. Consequence for this
project:

- The **AGPL** and a **non-exclusive** commercial license need no signature to
  be effective (though a signed commercial contract is still strongly
  preferred for enforceability and clarity).
- If a customer ever demands an **exclusive** commercial license, or if a
  contributor **assigns** copyright, that must be a **signed writing**.

- *Citation:* 17 U.S.C. § 204(a) — Execution of transfers.
  <https://www.law.cornell.edu/uscode/text/17/204>

### 2.4 Derivative works & the definition that AGPL leans on — 17 U.S.C. § 101, § 106(2)

Copyleft works by controlling **derivative works**. A "derivative work" is
defined in § 101, and the exclusive right to prepare them is § 106(2). When
someone modifies this software, their modified version is a derivative work;
distributing or (under AGPL) network-deploying it is only lawful under a
license from the owner. The AGPL grants that permission *conditionally* (you
must release source); the commercial license grants it *without* that
condition, for a fee.

- *Citation:* 17 U.S.C. § 101 (definitions), § 106(2).
  <https://www.law.cornell.edu/uscode/text/17/101>

### 2.5 AI-assisted code — who owns it, and the limit to know

Parts of this project were produced with AI tools (Claude, Koneko, Gemini) used
under the author's direction. Two consequences:

- **No rival owner.** U.S. copyright requires a **human** author. An AI cannot be
  an author and holds no rights, so the AI tools create no competing copyright
  claim. Samuel Jackson Grim is the sole human author and copyright holder — the
  commercial track is unencumbered by them, and no CLA from an AI is possible or
  needed.
  - *Citation:* Thaler v. Perlmutter, No. 23-5233 (D.C. Cir. Mar. 18, 2025),
    cert. denied (U.S. Mar. 2, 2026); U.S. Copyright Office, *Copyright and
    Artificial Intelligence* guidance.
    <https://law.justia.com/cases/federal/appellate-courts/cadc/23-5233/23-5233-2025-03-18.html>
- **Where the human authorship lives.** Copyright protects the expression a
  **human** controlled. Two recognized routes both apply here:
  1. **Selection, arrangement, and coordination** — choosing which model's
     output to keep, combining pieces from multiple AI sources, and deciding how
     they fit together is authorship of the same kind that protects compilations
     and edited works (17 U.S.C. § 103; Feist, 499 U.S. 340).
  2. **Creative modification and editing** — each pass where the author takes one
     model's output, directs another model to change it, and arbitrates the
     result is human expression layered onto the work.
  The author's workflow here is an **iterative, multi-model chain under human
  direction**: code is taken from one model, sent to another with specific
  instructions to improve it, then to another, with the human selecting,
  rejecting, editing, and integrating at each step. That is meaningful human
  creative control, not one-shot prompting — the fact pattern courts have
  *denied* (Thaler) was a machine generating a work with *no* human involvement,
  the opposite of this.
- **The thin spot (know it, don't overclaim).** A block a model produced that
  survives **verbatim and unedited**, contributed with no human creative choice,
  is the weakest link — that exact string may not be independently
  copyrightable. In an active refinement chain little tends to remain untouched,
  but the honest rule is: enforcement rests on the human-authored and
  human-arranged expression, so keep exercising (and being able to describe)
  that control. See `legal/AUTHORSHIP.md`.

### 2.6 The commercial contract layer — state contract law & the UCC

A signed commercial license is a **contract**, governed by the law of the
chosen jurisdiction (a `Governing Law` clause selects it). Two practical
statutory points:

- **Warranty disclaimers.** To disclaim the implied warranty of
  merchantability, the disclaimer must *mention "merchantability"* and be
  **conspicuous** (commonly ALL-CAPS/bold). This is why the commercial
  agreement's warranty section is in capitals.
  - *Citation:* U.C.C. § 2-316 (as adopted by the governing state).
- **Limitation of liability.** Liability caps and exclusions of consequential
  damages are generally enforceable unless unconscionable.
  - *Citation:* U.C.C. § 2-719.
  - *Note:* Whether UCC Article 2 (goods) or common-law contract governs a
    software license is unsettled and varies by state; drafting the disclaimers
    to satisfy the UCC is the conservative choice that also holds up at common
    law.

---

## 3. The AGPL-3.0 clauses that make the model work

The open-source track uses **AGPL-3.0-only**. The sections that matter for
dual licensing:

| Section | Title | Why it matters here |
|---|---|---|
| **0** | Definitions | Defines "Corresponding Source", "convey", "propagate", "modify" — the terms the disclosure duty turns on. |
| **2** | Basic Permissions | Grants the base copyright license, "irrevocable provided the stated conditions are met." |
| **4–6** | Conveying copies / modified source / non-source | The classic GPL copyleft: distribute and you must offer source. |
| **10** | Automatic downstream licensing | Each downstream recipient gets a license direct from the original licensors — no sublicensing chain. |
| **11** | Patents | Each contributor grants a patent license for their contributions; includes anti-retaliation terms. A commercial deal can add an express, broader patent grant. |
| **12** | No surrender of others' freedom | You can't accept terms (e.g., a patent settlement) that contradict the AGPL — reinforces why closed use needs a *separate* license, not a carve-out. |
| **13** | **Remote Network Interaction** | **The core of the model.** If you modify the Program and let users interact with it *over a network*, you must "prominently offer all users … an opportunity to receive the Corresponding Source of your version … at no charge." This closes the "SaaS loophole" in the plain GPL and is what makes a SaaS operator choose to pay. |
| **15–17** | Warranty / liability disclaimer / interpretation | AGPL ships "as-is"; the commercial track is where a customer can negotiate a warranty. |

**Section 13 is the lever.** Under the ordinary GPLv3, running modified code as
a hosted service is *not* "conveying," so no source-disclosure is triggered —
the "SaaS loophole." AGPL § 13 removes that loophole: network interaction with
a *modified* version triggers the duty to offer Corresponding Source. A company
that wants to build a closed SaaS on this code therefore has only two lawful
choices — **publish their full source under AGPL, or buy a commercial license.**

- *AGPL-3.0 full text:* <https://www.gnu.org/licenses/agpl-3.0.html>
- *SPDX identifier:* `AGPL-3.0-only`
- *Plain-language reading of § 13:*
  <https://opensource.com/article/17/1/providing-corresponding-source-agplv3-license>

---

## 4. Why contributor agreements are legally necessary

Dual licensing only works while the Licensor can lawfully grant the
**commercial** (non-AGPL) license over *all* of the code. The moment an outside
contributor's copyrighted code is merged, the Licensor can no longer offer that
code commercially **unless** the contributor has granted the right to do so.

Two instruments solve this:

1. **Contributor License Agreement (CLA)** — the contributor keeps their
   copyright but grants the Licensor a broad, irrevocable license *including the
   right to relicense under other terms* (or, in a stronger variant, assigns
   copyright). This is what preserves the ability to sell commercial licenses.
   See `legal/CLA-individual.md` and `legal/CLA-entity.md`.
2. **Developer Certificate of Origin (DCO)** — a lighter-weight, per-commit
   attestation (`Signed-off-by:`) that the contributor has the right to submit
   the code under the project's license. A DCO alone does **not** grant
   relicensing rights, so if you rely only on the DCO, third-party
   contributions can generally be offered **only under the AGPL**, not
   commercially. See `legal/DCO.txt`.

- *Citation / background:* transfers vs. non-exclusive grants, 17 U.S.C.
  §§ 201(d), 204(a) (above); industry practice per Producing Open Source
  Software, "Contributor Agreements."
  <https://producingoss.com/en/contributor-agreements.html>

**Recommendation for this project:** require the **CLA with an explicit
relicensing grant** for any non-trivial external contribution. Keep the DCO as
the minimum floor for tiny fixes. Until then, the Licensor is the sole author
and holds 100% of the copyright, so the commercial track is unencumbered.

---

## 5. Precedent: this is an established model

Dual licensing under a strong copyleft + paid commercial license is a
well-trodden, court-tested commercial model:

- **MySQL / Oracle** — GPL or commercial; Oracle owns the code and tailors
  commercial terms for embedders who don't want to release source.
  <https://www.mysql.com/about/legal/licensing/oem/>
- **Qt (The Qt Company)** — multi-licensed under GPL/LGPL and commercial.
- **GitLab, iText, Sentry (BSL), MongoDB (SSPL)** — variations on the same
  "give the community copyleft, sell the exception" idea.
- Background: OSS Watch, "Dual licensing as a business model."
  <http://oss-watch.ac.uk/resources/duallicence2>

---

## 6. Practical do / don't checklist

**Do**
- Keep a clean record that **you authored 100%** of the current code (the git
  history does this). It is your proof of standing to license commercially.
- Put `SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Commercial` in
  source headers so the dual offer is machine-readable and unambiguous.
- Get **signed** commercial agreements (§ 204 makes a signature essential if the
  deal is ever exclusive, and it's better evidence regardless).
- Require the **CLA** before merging outside code.
- Register the copyright with the U.S. Copyright Office if you intend to sue for
  infringement — 17 U.S.C. § 411(a) makes registration a prerequisite to filing
  suit for U.S. works, and § 412 gates statutory damages/attorneys' fees on
  timely registration. <https://www.law.cornell.edu/uscode/text/17/411>

**Don't**
- Don't accept AGPL-incompatible third-party code into the tree — it can poison
  your ability to relicense. Track the provenance of every dependency.
- Don't promise a customer an **exclusive** license unless it's a signed
  writing and you understand it limits your own future use (§ 204).
- Don't remove or alter the AGPL notice for the public copy; the two tracks
  coexist, they don't replace each other.

---

## 7. Sources

- 17 U.S.C. § 101 — <https://www.law.cornell.edu/uscode/text/17/101>
- 17 U.S.C. § 106 — <https://www.law.cornell.edu/uscode/text/17/106>
- 17 U.S.C. § 201 — <https://www.law.cornell.edu/uscode/text/17/201>
- 17 U.S.C. § 204 — <https://www.law.cornell.edu/uscode/text/17/204>
- 17 U.S.C. § 411 — <https://www.law.cornell.edu/uscode/text/17/411>
- GNU AGPL-3.0 — <https://www.gnu.org/licenses/agpl-3.0.html>
- AGPL § 13 explainer — <https://opensource.com/article/17/1/providing-corresponding-source-agplv3-license>
- U.C.C. § 2-316 (warranty disclaimers), § 2-719 (remedy limitations) — as adopted by the governing state.
- Contributor agreements — <https://producingoss.com/en/contributor-agreements.html>
- Dual-licensing business model — <http://oss-watch.ac.uk/resources/duallicence2>
- MySQL commercial licensing — <https://www.mysql.com/about/legal/licensing/oem/>

---

## Related

[[LICENSING]] · [[COMMERCIAL-LICENSE]] · [[CLA-individual]] · [[AUTHORSHIP]] · [[USING-THIS-WITHOUT-A-LAWYER]] · [[licensing-faq]]
