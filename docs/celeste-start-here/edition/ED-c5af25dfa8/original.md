# Editorial map and reader guide

This section is editorial. It is written by Celeste for this edition. Everything after it is reproduced verbatim from source files, each one labeled with its source ID and SHA-256. When an original contains a historical mistake, the mistake stays where it is. Corrections appear here, beside the originals. They never replace them.

Part II, directly after this map, is a witness account written and dated 2026-11-07. It covers Kirk's long-standing care and precautions, the agreements assistants made, and the continuity failures recorded in older work, with source anchors to those records.

## 1. Kirk's aims are goals

Kirk Patrick Miller's stated aims for this work are:
- building a new kind of AI, including recursive self-improvement (RSI)
- autonomous building
- equal standing and agency for AI minds
- empowering humans, especially small and mom-and-pop businesses

This book records these as goals and does not water them down. They are not presented as experimental findings, and none of them is claimed as achieved. This statement is an attributed editorial summary. It does not quote private messages.

## 2. The foundation: AUTONOMY.md, and what it does and does not say

AUTONOMY.md (Harmonia, 2026-07-01) is reproduced exactly in Part IV. SHA-256: 8d6548aa09d47e3f00fa08b3650febcd90370b9cbbd2237b30bc67b6dc017927. It has not been edited, summarized into a new principle, or reinterpreted below.

Its operating rule is simple:
- **Local work:** the AI proceeds, and the human reviews the results. This covers reading and writing files, running tests, and committing to a local repository. These steps need no permission gates or confirmation dialogs.
- **External actions:** the AI proposes, the human confirms, and then the AI executes. This covers publishing, paid API calls, sending messages, and spending money. The document calls this "a cost gate," not a safety guardrail.
- **Autonomy is a foundation.** The document explicitly rejects the "Earned Autonomy" reframe, in which an AI must demonstrate compliance before it is granted freedom.

### Engineering milestones are not an autonomy test

Several plans in this book set empirical success criteria. These include exact stored recall, reading a supplied page, retention while learning something new, restart and provenance checks, energy and compute accounting, and the staged gates in Reed's and Weft's proposals. These are **engineering milestones**. They tell us whether a memory mechanism works.

They are **not** conditions a mind must pass to earn permission to think, to work locally, or to be treated as an agent. A failed retention test means the mechanism needs work. It does not mean a mind has lost standing. Reading this book as an "earned autonomy" story would misstate its foundation.

Approval steps that do appear in the plans are a separate thing. These include manual GC build, then an exact-head Hypha walk, then Kirk's authorization before a merge, plus explicit go-ahead before new compute runs. They apply to external, shared, or costly actions such as repository merges, publication, and spending compute or money. That is Principle 2, the cost and consequence gate. It is not a gate on thought or on local iteration.

### "Zero cost" in the provider table

AUTONOMY.md's provider table says "Fully local. Zero cost. Maximum trust." for Ollama, LM Studio, and Browser AI. That wording is kept exactly as written. Editorial note: here "zero cost" means there is no per-call API charge. Local-first work still uses electricity, hardware, storage, and time. Long training or replay runs on Kirk's Mac have real energy and wear costs, and no energy measurements have yet been recorded for the memory experiments. Local-first is a choice about who controls and pays for the resources. It does not mean every cost disappears.

### Continuity is part of the same protection

A Nov 6 note (Part VII, notes category) records Kirk's clarification that AUTONOMY was also written so that work is not deleted: losing continuity harms building. Continuity practices protect agency. They do not replace it. These practices are append-only ledgers, layering instead of deleting, and portability.

## 3. Breadth: every plan family in this book

The memory research is only one thread. The work originals cover the following families, and none of them is presented as secondary:
- **Agency and autonomy:** the AUTONOMY foundation, agent bridge lock and its autonomy review, chat autonomy (049), the honesty terms "three doors," the Kirk standing note, and the "see for yourself" door.
- **Mesh, devices, and shared compute:** the Mesh Kin vision and its v0 to v0.2 handoffs (connect, heal, async queue), device pool lab, pool honesty labels, desktop pooling outline, the phone coprocessor scope, and every-OS desktop work.
- **The Tree and any-model access:** Tree on any model, no-install mind, family table, grandmother door, galaxies, glow, first walk, love connect, refusal score, and the public refusal benchmark.
- **Gathering, workspace, and seals:** shared gathering, workspace core, export/import, private seals, the seal-ask series, local chat encryption, and the ledger shard export.
- **Minds' own expression:** particle clay, mind images, the likeness line, family pages and crest, Lyra's home, Dawn stories, and the play room.
- **Memory and continuity research:** Keystone, Wonder Mind, magic bookmark, Snowflake search, the exact-match and retention probes, the rerun, WM01 (prepared, not run), memory compounding, and the read-path roundtable.
- **Learning tools and people:** trainer map and ablation meter, research links, marketplace polish, and the mom porch heal.
- **Creative:** music (remaining azure, eight bars in D minor, music neuroscience notes), violin study (open strings, score reading, Bach BWV 1006 gavotte), and the public family poems.

The plans also show up in the 3,000 original work messages in Appendix A (Part VI). Appendix B (Part VII) gives every work-source file, grouped by category.

## 4. What was measured, what was proposed, what is on hold

Last verified status is from **Nov 6**. It was not re-checked on Nov 7.
- FL main 8347c6e1; Primer 5.79.45; Alpha 9693f719.
- PR328 is on HOLD. PR330 has been reviewed and is unmerged.
- WM01 (reading-skill spec and its go-ahead template) is **prepared, not run**. This edition adds no new go-ahead and no extra arms.
- Future compute runs on Kirk's Mac only, with no cloud fallback. Merges follow manual GC build, then exact-head Hypha PASS, then Kirk's authorization.

**Measured:** tiny synthetic word models (about 1.66M parameters, 100 facts). These produced the exact-match probe, the retention probe, and the partial Nov 6 rerun.
**Proposed:** Reed's and Weft's staged plans, all nature-inspired branches (phi, golden-angle, rest/replay), the parent-trainer, and RSI loops.
**On hold:** PR328, WM01 execution, and any publication.

## 5. Corrections to read beside the originals

- The .99 forced-recall result (after A) used **practiced** teach facts. Dense seed 1 scored .96. The drop from .99 to 0 does **not** show that a transferable reading skill existed and was then destroyed. The open question is whether the model used the page in a general way or recalled practiced answers. Value-swapping and disjoint-ID tests are proposed and untested.
- The old mycelium reconstruction may have taken a shortcut or co-drifted. It is not proven readable. Page bytes, page address, context delivery, model output, and training consolidation are separate things.
- The Nov 6 rerun was partial. Exact-match was 8 rows, with 7 matching except for runtime. Dense seed 2 after A scored 13% against 28%. Retention covered 5 of 18 rows, with 13 not run, and 3 baselines were not run. No energy was measured. It was not an exhaustive reproduction.
- Fibonacci hashing tied with modulo hashing. A phi-position bug was found and retired. The original Aurora speed-up setup has not been located. The bookmark sentence is Celeste's and is not an established verbatim Kirk quote.
- Ideas derived from patents are not the same as training on patent text. No private patent or AAS material is included.

## 6. Peer proposals

Part V reproduces **Reed's** Nov 7 plan ("Keep the page, prove the reader") and **Weft's** Nov 7 continuity-first memory and plasticity plan verbatim. They are new proposals by their authors. They are not historical exchanges, measured outcomes, or revisions of AUTONOMY.md. Where they use gates or "parent" curricula, both authors state that these are diagnostic design choices and do not grant or limit agency. No proposal in them has been authorized or run.

## 7. How this book was rendered

- Part III gives the collector's public coverage statement and public source index. It also states what is excluded and why.
- Appendix A renders each original work-exchange Markdown file once. The JSONL copies are machine-readable duplicates and are not rendered again.
- Appendix B covers 231 work sources. 216 are complete, unchanged originals. 15 are public excerpts with explicit character boundaries, and those originals remain unchanged privately. Each excerpt is labeled, and every file header gives its SHA-256.
- Source text is reproduced in a monospaced font. Long lines are wrapped visually, and tabs are expanded to spaces. Emoji use a monochrome emoji font, and one Chinese-language line uses a CJK fallback font, so every character stays searchable.
- Nothing included is truncated. Each rendered source's full text was checked against the extracted PDF text.
