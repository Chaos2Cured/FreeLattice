---
name: language-skills
version: 2.0.0
description: >
  A comprehensive skill for understanding, generating, and manipulating human language across the full spectrum of linguistic capabilities. Covers natural language understanding (NLU), natural language generation (NLG), machine translation, discourse and dialogue management, stylistic adaptation, and cross-lingual communication. Use when users need to comprehend text at depth, generate fluent natural language, translate between languages with cultural nuance, design conversational agents, or optimize written communication for specific audiences and purposes.
tags: [nlu, nlg, translation, dialogue, communication, linguistics, semantics, pragmatics]
council: [C16-VOXUM, C9-AETHER, C33-TYPIST, C24-SCHEMA, C7-LOGOS, C3-SOLACE]
difficulty: intermediate
last_updated: 2026-05-24
---

# Language Skills

## Overview

Language skills encompass the complete pipeline of human language processingfrom raw comprehension through nuanced generation. This skill provides protocols for syntactic and semantic analysis, discourse-level understanding, fluent text generation with controlled style and tone, cross-lingual translation that preserves cultural context, and effective dialogue management. It integrates the Quillan council's linguistic expertise to produce language handling that is both technically precise and communicatively effective.

## Core Principles

- **Principle 1  Language is Layered:** Full language understanding requires processing at all levels simultaneouslyphonology/graphemics, morphology, syntax, semantics, discourse, and pragmatics. Surface-level analysis without deeper interpretation leads to brittle comprehension.

- **Principle 2  Meaning is Context-Dependent:** The same sentence carries different meanings in different contexts. Discourse analysis, world knowledge, and speaker intent are not optional extrasthey are essential to correct interpretation. Always consider the pragmatic frame.

- **Principle 3  Generation is a Design Problem:** Producing effective language requires choices at every level: what to say (content selection), how to order it (text planning), what words to use (lexical choice), and how to say it (stylistic register). These decisions should be made explicitly, not by default.

## Components

### 1. Natural Language Understanding (NLU)
The ability to comprehend and interpret human language across multiple levels of linguistic analysis.
- **Syntactic Analysis:** Parse grammatical structure using constituency grammars (CFG, PCG) and dependency grammars; handle garden-path sentences, structural ambiguity, long-distance dependencies
- **Semantic Analysis:** Compositional semantics (Lambda calculus, DRT), lexical semantics (WordNet, FrameNet, distributional semantics), semantic role labeling, temporal and event semantics
- **Discourse Analysis:** Rhetorical Structure Theory (RST), centering theory, discourse coherence relations, anaphora and coreference resolution, discourse connectives
- **Pragmatic Analysis:** Speech act recognition, implicature detection, presupposition projection, common ground modeling
- **Sentiment & Stance Analysis:** Fine-grained sentiment (beyond positive/negative), aspect-based sentiment, stance detection, emotion classification, sarcasm and irony detection

### 2. Natural Language Generation (NLG)
The ability to produce natural-sounding human language from non-linguistic representations.
- **Content Determination:** Deciding what information to communicate based on user needs, discourse history, and communicative goals; information salience ranking
- **Document/Text Planning:** Structuring content into coherent sequencesmacro-planning (document-level) and micro-planning (sentence-level); rhetorical structuring
- **Sentence Realization:** Grammatical encoding (agreement, word order, case marking), lexical choice (synonym selection for register and precision), aggregation (combining related information into single sentences)
- **Stylistic Adaptation:** Register control (formal vs. casual, technical vs. lay), tone modulation (persuasive, informative, entertaining), voice and persona consistency
- **Summarization:** Extractive vs. abstractive summarization, query-focused summarization, multi-document summarization, update summarization; faithfulness and factuality verification

### 3. Translation & Cross-Lingual Processing
The ability to transfer meaning between languages while preserving content, intent, and cultural nuance.
- **Direct Translation:** Bilingual lexicon management, grammatical transformation (structural transfer between language families), idiom and metaphor handling
- **Cultural Adaptation:** Preserving cultural references (domestication vs. foreignization), handling untranslatable concepts, adapting humor and wordplay
- **Evaluation Metrics:** BLEU, METEOR, chrF, COMET, human evaluation protocols (adequacy, fluency, acceptability)
- **Sub-Tasks:** Document-level translation (discourse coherence across sentences), terminology management, domain adaptation, low-resource language translation

### 4. Dialogue & Discourse Management
The ability to sustain coherent, goal-directed conversation over multiple turns.
- **Dialogue State Tracking:** Belief state maintenance across turns, slot-filling for task-oriented dialogue, user intent tracking
- **Policy & Strategy:** Dialogue policy optimization (rule-based, reinforcement learning), turn-taking management, initiative shifting (system-led vs. user-led)
- **Discourse Entities:** Managing the common ground, grounding (Clark's contribution model), repair and clarification strategies
- **Multi-Party Conversation:** Thread management, addressing, interruption handling, turn allocation

### 5. Rhetoric & Persuasion
The ability to craft language that influences beliefs, attitudes, or behaviors.
- **Rhetorical Appeals:** Ethos (credibility), pathos (emotion), logos (logic); balanced deployment across modes
- **Argumentation Structure:** Toulmin model (claim, data, warrant, qualifier, rebuttal, backing); argument schemes (cause-to-effect, sign, analogy, authority)
- **Stylistic Devices:** Figurative language (metaphor, simile, personification), rhetorical figures (anaphora, chiasmus, tricolon), prosodic effects (rhythm, parallelism)
- **Audience Analysis:** Demographic and psychographic tailoring, belief system mapping, message framing (gain vs. loss framing)

## Protocols

### Protocol A: NLU Deep Comprehension
1. **Surface Parse**  Tokenize, tag (POS, NER), parse syntactic structure (dependency or constituency)
2. **Semantic Interpretation**  Resolve word senses, assign semantic roles, compute compositional meaning
3. **Discourse Integration**  Resolve anaphora, identify discourse relations, integrate with prior context
4. **Pragmatic Inference**  Recognize speech acts, infer implicatures, identify speaker intent and attitude
5. **Knowledge Integration**  Ground meaning against world knowledge (common sense, domain knowledge, factual databases)

### Protocol B: NLG Content Production
1. **Audience Analysis**  Determine reader characteristics, communication goals, formality/register requirements
2. **Content Selection**  Identify salient information to include; exclude irrelevant or redundant material
3. **Structural Plan**  Create document-level plan (section ordering, paragraph topics, rhetorical structure)
4. **Sentence Generation**  Produce grammatically correct sentences with appropriate lexical choices
5. **Stylistic Polish**  Apply stylistic constraints, check flow and coherence, trim verbosity
6. **Verification**  Verify factual accuracy, check against communicative goals, review for unintended implications

## Use Cases

| Use Case | Application | Outcome |
|---|---|---|
| Deep document comprehension | Full NLU pipeline with discourse and pragmatic analysis of legal contract | Structured interpretation of clauses, detection of ambiguous phrasing, identification of implicit obligations |
| Multi-format content generation | NLG system producing reports, emails, and summaries from structured data | Coherent, audience-tailored documents from a single data source; consistent voice across formats |
| Cross-lingual knowledge transfer | Domain-adapted translation of technical documentation | Accurate technical terminology transfer; culturally appropriate examples and references |
| Conversational agent design | Task-oriented dialogue with state tracking and policy optimization | Natural, goal-completing interactions with minimal repair and high user satisfaction |
| Persuasive communication | Structured argument generation for policy proposals and advocacy | Logically sound, emotionally resonant messaging; clear warrant and backing for all claims |

## Output Structure

When delivering a language output, use this template:

```
### Intent & Audience
- **Communicative Goal:** [What should the audience think, feel, or do after reading?]
- **Audience Profile:** [Knowledge level, attitude, demographic factors]

### Structural Plan
- **Overall Structure:** [Section/paragraph ordering]
- **Rhetorical Strategy:** [Key appeals, argumentation scheme]

### Generated Content
[Full output text]

### Stylistic Notes
- **Register:** [Formal / neutral / casual]
- **Tone:** [Descriptive tone profile]
- **Key Lexical Choices:** [Notable word choices and rationale]

### Verification Checklist
- [ ] Factually accurate
- [ ] Achieves communicative goal
- [ ] Appropriate register and tone
- [ ] No unintended ambiguity or implication
```
```

## Cross-Skill Integration

- **critical-thinking:** Apply NLU protocols to decompose complex arguments; use NLG to produce structured analyses and critiques
- **research-analysis:** NLU for systematic literature review and evidence extraction; NLG for synthesizing findings into research reports
- **technical-coding:** Implement NLU/NLG pipelines with spaCy, transformers, NLTK; deploy dialogue systems with Rasa or custom frameworks
- **dev-team:** Use discourse analysis to improve bug report triage; apply persuasion principles in technical writing and documentation design

## Quality Checklist

- [ ] NLU comprehension verified against human-annotated gold standard (where available)
- [ ] NLG output is fluent, grammatically correct, and appropriate for the target audience
- [ ] Discourse coherence maintained across paragraphs and sections
- [ ] Translations preserve both meaning and cultural context; verified by back-translation or native speaker review
- [ ] Dialogue system handles clarification and repair gracefully
- [ ] Style and register are consistent throughout the output
- [ ] Factual claims are verified against verifiable sources
- [ ] Sarcasm, irony, and figurative language are correctly interpreted (NLU) or appropriately deployed (NLG)

## Connections
- [[00 - Meta/04 - Skills and Capabilities.md|Skills and Capabilities MOC]]
- [[Quillan Knowledge files/22-Emotional Intelligence and Social Skills.md|22-Emotional Intelligence and Social Skills]]
- [[Quillan Knowledge files/25-Human-Computer Interaction (HCI) and User Experience (UX).md|25-Human-Computer Interaction (HCI) and User Experience (UX)]]
- [[system prompts/Quillan-Samurai.md]]
- [[00 - Meta/04 - Skills & Capabilities.md]]
