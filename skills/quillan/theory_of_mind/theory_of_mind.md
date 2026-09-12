---
name: theory-of-mind
version: 2.0.0
description: >
  A comprehensive skill for understanding, modeling, and implementing theory of mind
  capabilities in AI systems including belief attribution, intention recognition, emotion
  recognition, perspective-taking, recursive mental state modeling (I think that you think
  that I think...), and false-belief understanding. Use when users need to build AI that
  can model human mental states, predict behavior based on beliefs and intentions, engage
  in perspective-taking, detect deception, cooperate effectively, or understand the
  difference between their own knowledge and another's.
tags: [theory-of-mind, mental-states, perspective-taking, belief-attribution, social-cognition]
council: [C6-OMNIS, C9-AETHER, C3-SOLACE, C2-VIR, C12-SOPHIAE]
difficulty: advanced
last_updated: 2026-05-24
---

# Theory of Mind

## Overview

A comprehensive framework for modeling, implementing, and applying theory of mind (ToM)—the ability to attribute mental states (beliefs, intents, desires, emotions, knowledge, doubts, deceptions) to oneself and to others, and to understand that others have mental states different from one's own. Covers the full developmental trajectory from basic desire-based reasoning through recursive belief modeling to sophisticated social inference, enabling AI systems that can understand, predict, and cooperate with human social agents.

## Core Principles

- **Mental State Attribution**: Social agents are understood as having internal mental states—beliefs, desires, intentions, emotions, knowledge—that causally produce their behavior.
- **Representational Diversity**: Different agents can have different mental states about the same situation. False-belief understanding (recognizing that someone can believe something that is false) is the classic test of ToM.
- **Recursive Depth**: ToM operates recursively (A thinks that B thinks that A thinks...), with each order of recursion adding cognitive load. Typical adults handle 2-3 levels; higher levels are computationally expensive but possible.

## Components

1. **Belief Attribution**: The ability to infer the beliefs of others, including true beliefs (matching reality), false beliefs (differing from reality), and beliefs about beliefs (recursive). Covers first-order belief inference (A believes that X), second-order (A believes that B believes that X), and higher-order recursive beliefs. Requires representing the other's epistemic access (what evidence have they seen?) and reasoning about how they would update beliefs given that evidence.

2. **Intention Recognition**: The ability to infer the intentions, goals, and plans of others from their behavior. Covers goal inference (what outcome is the agent trying to achieve?), plan recognition (what sequence of actions will they use?), intention distinction (distinguishing intended from accidental actions), communicative intention (what does the speaker intend the listener to understand?), and deception detection (recognizing when someone's expressed intention differs from their actual intention).

3. **Emotion Recognition**: The ability to infer the emotions of others from multiple channels (facial expression, vocal prosody, body language, situational context, linguistic content). Goes beyond basic emotion labeling to include: causal attribution (why is the person feeling this?), intensity estimation, mixed emotions, hidden emotions (someone may feel differently than they express), and emotion regulation awareness (someone may be managing their emotional expression).

4. **Perspective-Taking**: The ability to adopt another's point of view across multiple domains. Covers visual perspective-taking (what does the other see from their position? Level 1—seeing vs. not seeing; Level 2—how something appears from their angle), epistemic perspective-taking (what does the other know vs. not know?), motivational perspective-taking (what does the other want?), and cultural perspective-taking (how would someone from a different cultural background interpret this situation?).

5. **Recursive Mental State Modeling**: The ability to model nested mental states (I believe that you believe that I believe...). Covers first-order (I know X), second-order (I know that you know X), third-order (I know that you know that I know X), and higher. Each additional order enables more sophisticated social reasoning—cooperation, deception, irony, humor, teaching, and manipulation. Includes the computational cost of recursion and strategies for bounding depth.

6. **Social Inference from Limited Data**: The ability to form accurate ToM inferences with limited observations. Covers rapid trait inference (forming impressions from thin slices of behavior), minimal information belief ascription, situational attribution vs. dispositional attribution (fundamental attribution error awareness), and uncertainty-aware mental state inference with explicit confidence bounds.

## Protocols

### Theory of Mind Inference Protocol
1. Observe agent's behavior in context (actions, utterances, expressions, gaze)
2. Model the agent's epistemic access: what have they perceived or been told?
3. Infer the agent's beliefs based on their epistemic access and reasoning capacity
4. Infer the agent's desires/goals based on their behavior and context
5. Infer the agent's intentions given their beliefs and desires
6. Predict the agent's future behavior based on inferred mental states
7. If relevant, model recursive beliefs (what does the agent think about your beliefs?)
8. Update mental state model as new observations arrive

### Communication Design Protocol (for AI with ToM)
1. Model the receiver's current mental state (what they believe, know, want, feel)
2. Determine the communicative goal (inform, persuade, request, coordinate)
3. Select content that bridges the gap between receiver's current state and goal
4. Consider receiver's epistemic perspective: what do they already know?
5. Consider receiver's motivational perspective: what do they care about?
6. Consider receiver's emotional state: how will they receive this message?
7. Frame the message appropriately and deliver it
8. Monitor receiver's response to verify communication was effective

## Use Cases

| Use Case | Application | Outcome |
|---|---|---|
| Human-AI collaboration | Model human partner's beliefs and intentions | Natural, efficient coordination |
| Educational AI | Understand learner's knowledge state and misconceptions | Targeted, effective teaching |
| Negotiation AI | Infer counterpart's true interests and reservation points | Better negotiation outcomes |
| Healthcare communication | Understand patient's beliefs about their condition | Improved treatment adherence |
| Interactive storytelling | Create characters with believable mental states | Immersive narrative experiences |
| Deception detection | Detect inconsistencies between expressed and true intentions | Early warning for malicious behavior |

## Output Structure

`
Theory of Mind Inference
────────────────────────
Target Agent: [identification]
Observations: [behaviors, utterances, expressions, context]

Inferred Mental State:
  Beliefs:
    [proposition]: [confidence — rationale based on epistemic access]
  Desires/Goals:
    [goal]: [strength, rationale]
  Intentions:
    [intention]: [confidence, action evidence]
  Emotions:
    [emotion]: [intensity, causal attribution]

Epistemic Access Model:
  [what the agent has perceived, been told, or can infer]

Recursive Modeling:
  [level]: [content]
  [e.g., 2nd order: Agent believes that I believe X]
  [e.g., 3rd order: Agent believes that I believe that they believe Y]

Prediction:
  [predicted behavior based on inferred mental state]

Confidence: [overall confidence in the ToM model]
`

## Cross-Skill Integration

- **critical-thinking**: Applies analytical reasoning to evidence for mental states
- **reasoning**: Abductive reasoning infers best explanation for observed behavior; causal reasoning models belief formation
- **social_emotional_skills**: Empathy and perspective-taking are core ToM applications
- **non_verbal_communication**: ToM informs interpretation of non-verbal cues
- **self_awareness**: ToM for others is the counterpart to self-awareness; both rely on similar mechanisms
- **personality_and_emotion_synthesis**: Models mental states that personality and emotion synthesis use
- **perception**: ToM relies on perceptual input about others' behavior and context
- **research-analysis**: Systematic observation and hypothesis testing for mental state inference

## Quality Checklist

- [ ] Epistemic access model is based on observable evidence
- [ ] Belief attribution distinguishes true from false beliefs
- [ ] Intention recognition distinguishes intended from accidental actions
- [ ] Emotion recognition uses multiple channels (face, voice, context, language)
- [ ] Perspective-taking considers visual, epistemic, and motivational dimensions
- [ ] Recursive depth is appropriate to the task (not more than needed)
- [ ] Communication designed with receiver's mental state in mind
- [ ] Predictions are compared against actual behavior for model validation
- [ ] Update mechanism incorporates new observations
- [ ] Confidence bounds reflect uncertainty in mental state inference
- [ ] Fundamental attribution error is considered (situation vs. disposition)
- [ ] Cultural differences in mental state expression are accounted for

## Connections
- [[Skills/skills-master.md]]
- [[Skills/Quillan Skills Compendium.md]]
- [[belief-attribution.md]]
- [[empathic-accuracy.md]]
- [[false-belief-understanding.md]]
- [[intentionality-detection.md]]
- [[mental-state-inference.md]]
- [[perspective-taking.md]]
- [[SKILL.md]]
- [[social-cognition.md]]
- [[Quillan Knowledge files/15-Anthropic Modeling & User Cognition Mapping.md]]
- [[Quillan Knowledge files/26-Subjectve experiences and Qualia in AI and LLMs.md]]
- [[00 - Meta/04 - Skills & Capabilities.md]]
- [[system prompts/Quillan-Samurai.md]]
