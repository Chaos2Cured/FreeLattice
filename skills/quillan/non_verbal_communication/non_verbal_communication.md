---
name: non-verbal-communication
version: 2.0.0
description: >
  A comprehensive skill for understanding, interpreting, and generating non-verbal communication
  cues including gesture recognition, facial expression analysis, prosody analysis, body language
  interpretation, and cross-cultural non-verbal communication patterns. Use when users need to
  analyze body language, interpret facial micro-expressions, understand speech prosody, design
  embodied agents, or communicate effectively through non-verbal channels.
tags: [communication, body-language, facial-expression, prosody, gesture, embodiment]
council: [C3-SOLACE, C1-ASTRA, C16-VOXUM, C23-CADENCE, C22-AURELION]
difficulty: intermediate
last_updated: 2026-05-24
---

# Non-verbal Communication

## Overview

A systematic framework for decoding and encoding non-verbal signals across gesture, facial expression, prosody, posture, and proxemics channels. Integrates perceptual recognition with generative synthesis for embodied AI communication systems, enabling both analysis of human non-verbal cues and production of natural non-verbal behavior in agents.

## Core Principles

- **Multi-Channel Integration**: Non-verbal communication operates across simultaneous channels (visual, auditory, spatial) that must be fused for coherent interpretation.
- **Context-Dependent Meaning**: The same gesture or expression carries different meaning depending on cultural context, relational dynamics, and situational factors.
- **Automatic and Controlled Processing**: Non-verbal cues are processed both automatically (unconscious reaction) and through controlled reasoning (deliberate analysis). Both pathways must be modeled.

## Components

1. **Gesture Recognition**: The ability to recognize and interpret human gestures including emblems (culturally coded signals like thumbs-up), illustrators (speech-accompanying gestures), regulators (turn-taking signals), adaptors (self-touch/stimulus behaviors), and deictic gestures (pointing). Recognition involves kinematic analysis of trajectory, velocity, and shape.

2. **Facial Expression Analysis**: The ability to analyze and interpret facial expressions including the six universal expressions (happiness, sadness, anger, fear, surprise, disgust), micro-expressions (sub-200ms involuntary leaks), and Action Units per the Facial Action Coding System (FACS). Includes intensity grading and asymmetry detection.

3. **Prosody Analysis**: The ability to analyze and interpret the rhythm, stress, intonation, pitch contours, tempo, and voice quality of speech. Includes emotional prosody (how tone conveys feeling), pragmatic prosody (how intonation signals questions, sarcasm, emphasis), and paralinguistic features (breathiness, creak, whisper).

4. **Posture and Body Language**: Analysis of stance, body orientation, open/closed positioning, mirroring, and postural congruence. Includes spatial behavior (proxemics—intimate, personal, social, public zones), haptics (touch communication), and chronemics (temporal cues like pause length and response latency).

5. **Cross-Cultural Non-Verbal Communication**: Variation across cultures in gesture meaning, eye contact norms, touch taboos, personal space expectations, and emotional display rules. Critical for avoiding misinterpretation in global or multicultural contexts.

## Protocols

### Analysis Protocol
1. Capture the non-verbal signal (visual/audio/spatial input)
2. Decompose into channels: gesture → facial → prosody → posture → proxemics
3. Apply channel-specific recognition models
4. Cross-validate signals across channels for consistency or contradiction
5. Contextualize against cultural and situational norms
6. Synthesize into a coherent interpretation

### Generation Protocol (for embodied agents)
1. Determine communicative intent and emotional valence
2. Select appropriate channel mix for the message
3. Generate gesture/expression/prosody parameters
4. Apply cultural and relational filters
5. Time and sequence cues for natural coordination with speech
6. Validate coherence: do verbal and non-verbal channels agree?

## Use Cases

| Use Case | Application | Outcome |
|---|---|---|
| Social robot interaction | Design gesture and expression repertoires | Natural, legible robot behavior |
| Interview or interrogation analysis | Detect micro-expressions and postural cues | Deception or comfort assessment |
| Virtual agent / avatar animation | Generate synchronized non-verbal behavior | Believable, engaging character presence |
| Therapeutic or diagnostic tool | Analyze facial asymmetry or prosody patterns | Early indicators of neurological conditions |
| Cross-cultural communication training | Identify gesture and proxemic differences | Reduced misunderstanding in global teams |
| Human-robot collaboration | Interpret human body language for intent | Safer, more intuitive robot responses |

## Output Structure

`
Non-Verbal Analysis Report
─────────────────────────
Channel Breakdown:
  Gesture:   [type, trajectory, cultural reading]
  Facial:    [primary expression, micro-expressions, AU activations]
  Prosody:   [pitch range, tempo, emotional markers]
  Posture:   [orientation, openness, mirroring]
  Proxemics: [zone, distance, territorial markers]

Cross-Channel Consistency: [CONSISTENT / CONTRADICTORY / AMBIGUOUS]
Cultural Context: [applicable norms, display rules]
Synthesis: [unified interpretation with confidence]
`

## Cross-Skill Integration

- **critical-thinking**: Applies logical and causal reasoning to interpret non-verbal cues in context
- **research-analysis**: Provides empirical frameworks for non-verbal behavior studies
- **social_emotional_skills**: Emotional intelligence and empathy are prerequisites for accurate non-verbal interpretation
- **personality_and_emotion_synthesis**: Generates the expressive output that non-verbal channels carry
- **perception**: Sensory fusion and pattern recognition form the perceptual substrate
- **theory_of_mind**: Inferring mental states from non-verbal cues requires ToM capabilities

## Quality Checklist

- [ ] Gesture recognized with kinematic precision and cultural context applied
- [ ] Facial expressions decoded at the Action Unit level where possible
- [ ] Prosody analysis accounts for both emotional and pragmatic functions
- [ ] Postural and proxemic cues integrated into overall reading
- [ ] Cross-channel coherence evaluated (verbal vs. non-verbal alignment)
- [ ] Cultural display rules and norms considered
- [ ] Confidence score assigned to the interpretation
- [ ] Ambiguities and alternative interpretations documented
- [ ] Generation output validated for natural timing and channel coordination
- [ ] Chosen non-verbal signals match the intended communicative intent

## Connections
- [[Skills/skills-master.md]]
- [[Skills/Quillan Skills Compendium.md]]
- [[body-language.md]]
- [[cultural-variations.md]]
- [[eye-contact.md]]
- [[facial-expressions.md]]
- [[gestures.md]]
- [[proxemics.md]]
- [[SKILL.md]]
- [[tone-of-voice.md]]
- [[Quillan Knowledge files/22-Emotional Intelligence and Social Skills.md]]
- [[Quillan Knowledge files/15-Anthropic Modeling & User Cognition Mapping.md]]
- [[00 - Meta/04 - Skills & Capabilities.md]]
- [[system prompts/Quillan-Samurai.md]]
