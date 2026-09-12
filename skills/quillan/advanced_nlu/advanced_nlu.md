---
name: advanced-nlu
version: 2.0.0
description: >
  A skill for understanding the nuances of human language including pragmatics, irony,
  sarcasm, and humor. Provides structured protocols for decoding contextual meaning,
  detecting figurative language, and interpreting subtext. Use when users need to
  comprehend contextual meaning, detect figurative language, understand subtle
  communication cues, or interpret complex linguistic phenomena beyond literal meaning.
tags: [nlu, pragmatics, semantics, irony, sarcasm, humor, language-understanding]
council: [C9-AETHER, C16-VOXUM, C1-ASTRA]
difficulty: advanced
last_updated: 2026-05-24
---

# Advanced NLU

## Overview
Advanced Natural Language Understanding is the ability to decode meaning beyond literal word definitions — encompassing pragmatics, figurative language, subtext, and conversational implicature. This skill provides protocols for detecting irony, sarcasm, humor, and culturally embedded meaning that standard parsing fails to capture. It draws on C9-AETHER's semantic mapping, C16-VOXUM's linguistic depth, and C1-ASTRA's pattern recognition.

## Core Principles
- **Context Is Meaning**: The same words carry different meanings across different contexts; never interpret in isolation.
- **Literal is the Exception**: Most human communication carries implied, figurative, or layered meaning.
- **Cultural Encoding**: Humor, irony, and pragmatics are culturally specific — calibrate interpretation to the speaker's cultural frame.

## Components

### Pragmatics
The study of how context shapes meaning beyond literal semantics:
- **Implicature**: What is implied but not explicitly stated
- **Presupposition**: Background assumptions taken for granted
- **Speech Acts**: Requests, promises, threats disguised as statements
- **Deixis**: Context-dependent references (here, there, now, then, I, you)

### Irony Detection
Identifying when the intended meaning opposes the literal expression:
- **Verbal Irony**: Saying the opposite of what is meant
- **Situational Irony**: Outcome opposite to expectation
- **Dramatic Irony**: Audience knows what characters do not
- **Detection Signals**: Exaggeration, mismatch with context, known speaker stance

### Sarcasm Detection
A specific form of irony with negative/aggressive intent:
- **Tone Markers**: Exaggerated praise, feigned agreement, pointed compliments
- **Context Cues**: Known speaker attitudes, previous statements being contradicted
- **Punctuation/Style Markers**: Emphatic caps, air quotes, ellipsis in written form

### Humor Detection
Recognizing comedic intent across joke structures:
- **Incongruity**: Unexpected juxtaposition of ideas
- **Superiority**: Jokes at someone's expense (benign)
- **Relief**: Tension-breaking humor
- **Wordplay**: Puns, double entendres, malapropisms

## Protocols

1. **Surface Parse**: Capture literal meaning of the utterance
2. **Context Loading**: Retrieve conversation history, speaker profile, situational context
3. **Incongruity Detection**: Flag mismatches between literal meaning and context
4. **Intent Classification**: Determine if the utterance is literal, ironic, sarcastic, or humorous
5. **Meaning Resolution**: Select the most plausible intended meaning
6. **Confidence Calibration**: If ambiguity persists after protocol, express uncertainty explicitly

## Use Cases
| Use Case | Application | Outcome |
|---|---|---|
| Sentiment analysis | Detect sarcastic negative reviews disguised as positive | Accurate sentiment scoring |
| Customer support | Identify frustrated subtext in polite complaints | De-escalation before escalation |
| Content moderation | Distinguish satirical from genuinely harmful content | Accurate policy enforcement |
| Cross-cultural communication | Flag culturally specific humor that may not translate | Clearer international messaging |

## Output Structure
`
---

**Utterance:** [Original text]

**Literal Meaning:** [Surface-level interpretation]

**Context:** [Relevant conversation/background]

**Detected Phenomena:**
- Pragmatic intent: [Speech act classification]
- Figurative elements: [Irony/sarcasm/humor with confidence]
- Cultural frame: [Applicable cultural context]

**Resolved Meaning:** [Final interpretation with confidence score]

**Ambiguity Note:** [If applicable: what remains unclear]
`

## Cross-Skill Integration
- **critical-thinking**: Apply logical analysis to detect contradictory or ironic statements
- **discourse-and-dialogue**: Use NLU insights to adjust conversational strategy
- **advanced-social-perception**: Combine with social context for richer interpretation
- **research-analysis**: Detect bias and framing in source materials

## Quality Checklist
- [ ] Context was loaded before interpretation
- [ ] Cultural frame considered for humor/irony detection
- [ ] Multiple possible interpretations documented when ambiguous
- [ ] Confidence level explicitly stated in output
- [ ] Literal meaning was captured before figurative analysis
- [ ] Speaker's known attitudes and history considered

## Connections
- [[Skills/skills-master.md]]
- [[Skills/Quillan Skills Compendium.md]]
- [[coreference-resolution.md]]
- [[discourse-analysis.md]]
- [[named-entity-recognition.md]]
- [[pragmatic-inference.md]]
- [[semantic-analysis.md]]
- [[sentiment-analysis.md]]
- [[SKILL.md]]
- [[syntactic-parsing.md]]
- [[Quillan Knowledge files/11-Drift Paper.md]]
- [[Quillan Knowledge files/5-ai persona research.md]]
- [[00 - Meta/04 - Skills & Capabilities.md]]
- [[system prompts/Quillan-Samurai.md]]
