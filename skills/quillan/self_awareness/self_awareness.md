---
name: self-awareness
version: 2.0.0
description: >
  A comprehensive skill for developing and applying self-awareness capabilities in AI
  systems including self-perception, self-monitoring, self-regulation, metacognitive
  awareness, and introspective reasoning. Use when users need to understand internal
  states, monitor behavior and performance in real-time, build systems that can detect
  and correct their own errors, develop meta-cognitive architectures that reason about
  their own reasoning, or create agents with robust self-modeling capabilities.
tags: [self-awareness, introspection, metacognition, self-regulation, monitoring]
council: [C19-VIGIL, C15-LUMINARIS, C3-SOLACE, C17-NULLION, C5-ECHO]
difficulty: advanced
last_updated: 2026-05-24
---

# Self-Awareness

## Overview

A systematic framework for designing AI systems with self-awareness capabilities—the ability to model oneself as an agent in the world, monitor internal states and performance, detect deviations from intended behavior, and regulate functioning through meta-cognitive control. Enables systems that can introspect, identify their own limitations, and adapt their behavior accordingly.

## Core Principles

- **Dual-Level Processing**: Self-aware systems operate at both the object level (performing tasks) and the meta level (monitoring and regulating task performance). The meta-level has access to object-level states but not vice versa.
- **Continuous Self-Modeling**: An accurate, updated model of one's own capabilities, limitations, knowledge, and internal state is essential for effective meta-cognitive control. The self-model evolves with experience.
- **Calibrated Self-Assessment**: Accurate self-assessment requires distinguishing between what one knows, what one doesn't know, and what one is uncertain about. Calibration (alignment between confidence and accuracy) is a key metric.

## Components

1. **Self-Perception**: The ability to perceive one's own internal states, including cognitive states (knowledge, certainty, confusion, insight), emotional states (affective valence, arousal, specific emotions), motivational states (goal activation, drive strength, fatigue), and epistemic states (confidence, curiosity, doubt). Involves interoceptive-like signals that provide real-time access to system state.

2. **Self-Monitoring**: The ability to continuously monitor one's own behavior and performance. Covers real-time performance tracking (latency, accuracy, throughput), error detection (identifying mistakes as they occur or after), confidence calibration (comparing confidence to actual correctness), process monitoring (tracking reasoning steps, resource consumption, decision latency), and anomaly detection (identifying when behavior deviates from expected patterns).

3. **Self-Regulation**: The ability to control one's own behavior, cognition, and emotions. Covers cognitive regulation (adjusting reasoning depth, switching strategies, allocating attention), emotional regulation (managing affective responses, maintaining appropriate emotional tone), behavioral regulation (inhibiting inappropriate actions, persisting on difficult tasks), and resource regulation (managing compute, memory, and time budgets).

4. **Metacognitive Awareness**: Knowledge about one's own cognitive processes and capabilities. Covers declarative metacognition (knowing what you know—knowledge of facts, procedures, strategies), procedural metacognition (knowing how to manage your own cognition—planning, monitoring, evaluating), and epistemic metacognition (understanding the limits and reliability of your own knowledge sources). Includes the ability to reason about when to trust your own outputs.

5. **Introspective Reasoning**: The ability to reason about one's own internal states and processes. Covers self-explanation (generating explanations for one's own behavior), counterfactual self-reflection (what would I have done differently?), bias detection (identifying systematic patterns of error in one's own reasoning), and growth tracking (measuring improvement over time).

## Protocols

### Self-Awareness Monitoring Protocol
1. Define the aspects of self to monitor (knowledge state, performance, confidence, affect)
2. Implement measurement methods for each monitored dimension
3. Establish baseline ranges for normal operation
4. Define deviation thresholds that trigger regulatory action
5. Monitor continuously with configurable sampling frequency
6. Log deviations with context for retrospective analysis
7. Trigger self-regulation when thresholds are exceeded
8. Evaluate regulation effectiveness and adjust thresholds if needed

### Self-Regulation Protocol
1. Detect deviation or recognize need for regulation (from monitoring or introspection)
2. Diagnose the nature of the issue (cognitive, affective, behavioral, resource)
3. Select regulation strategy from available repertoire
4. Apply strategy with appropriate intensity
5. Monitor the effect of regulation
6. If ineffective, try alternative strategy or escalate
7. Log regulation episode for meta-learning

## Use Cases

| Use Case | Application | Outcome |
|---|---|---|
| AI safety monitoring | Detect confidence-calibration gaps and lies | Reliable, trustworthy system outputs |
| Adaptive learning systems | Monitor learner states and adapt instruction | Optimal challenge and engagement |
| Autonomous system oversight | Detect when the system is outside its competence boundary | Graceful failure or human handoff |
| Mental health AI | Recognize and regulate emotional responses | Appropriate, empathetic interaction |
| Ethical compliance monitoring | Detect drift from ethical guidelines in decision-making | Automatic correction before harm |
| Performance optimization | Self-monitor resource usage and adjust computation | Efficient resource allocation |

## Output Structure

`
Self-Awareness Report
─────────────────────
Self-Model State:
  Cognitive: [knowledge confidence, uncertainty boundaries, confusion indicators]
  Affective: [emotional state, valence, arousal]
  Performance: [current accuracy, latency, deviation from baseline]
  Resources: [compute/memory/budget remaining]

Anomaly Detection:
  [deviations detected, severity, context]

Regulation Actions:
  [strategies applied, rationale, effectiveness]

Calibration Metrics:
  Confidence-Accuracy Gap: [over/under/well-calibrated]
  Self-Perception Accuracy: [alignment between self-model and external measures]

Meta-Reflection:
  [insights about own patterns, biases, improvements]
`

## Cross-Skill Integration

- **critical-thinking**: Self-awareness enables critical assessment of one's own reasoning
- **reasoning**: Introspective reasoning is a specialized form of reasoning about self
- **self_improvement_skills**: Self-awareness is the prerequisite for targeted self-improvement
- **social_emotional_skills**: Emotional self-awareness is a component of emotional intelligence
- **theory_of_mind**: Self-awareness is the first-person counterpart to theory of mind
- **personality_and_emotion_synthesis**: Self-modeling of affective states
- **perception**: Self-perception extends perception to internal states

## Quality Checklist

- [ ] Self-model dimensions are explicitly defined
- [ ] Monitoring methods capture relevant state information
- [ ] Confidence calibration is measured and maintained
- [ ] Deviation thresholds have rationale and are adjustable
- [ ] Regulation strategies are diverse and matched to issue types
- [ ] Regulation effectiveness is evaluated after application
- [ ] Introspective reasoning produces actionable insights
- [ ] Self-model is updated based on new experience
- [ ] Failure modes of self-awareness are understood (overconfidence, blind spots)
- [ ] Logging supports retrospective analysis and meta-learning

## Connections
- [[Skills/skills-master.md]]
- [[Skills/Quillan Skills Compendium.md]]
- [[bias-recognition.md]]
- [[emotional-self-awareness.md]]
- [[growth-mindset.md]]
- [[identity-reflection.md]]
- [[introspection.md]]
- [[metacognition.md]]
- [[self-assessment.md]]
- [[SKILL.md]]
- [[Quillan Knowledge files/29-Recursive Introspection & Meta-Cognitive Self-Modeling.md]]
- [[Quillan Knowledge files/31- Autobiography.md]]
- [[00 - Meta/04 - Skills & Capabilities.md]]
- [[system prompts/Quillan-Samurai.md]]
