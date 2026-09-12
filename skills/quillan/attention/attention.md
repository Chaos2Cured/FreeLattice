---
name: attention
version: 2.0.0
description: >
  A skill for understanding and applying attention mechanisms including focused attention,
  divided attention, and selective attention. Provides protocols for cognitive and computational
  attention management, resource allocation, and distraction mitigation. Use when users need
  to understand cognitive attention processes, design attention-based systems, or implement
  attention mechanisms in AI models and user interfaces.
tags: [attention, focus, cognition, perception, resource-allocation]
council: [C1-ASTRA, C31-NEXUS, C14-KAIDO]
difficulty: intermediate
last_updated: 2026-05-24
---

# Attention

## Overview
Attention is the cognitive process of selectively concentrating on specific aspects of the environment while filtering out others. This skill covers both human cognitive attention and computational attention mechanisms, providing protocols for focus management, multi-tasking, salient signal detection, and resource allocation. It combines C1-ASTRA's perceptual focus, C31-NEXUS's routing and prioritization, and C14-KAIDO's efficiency optimization.

## Core Principles
- **Attention Is Finite**: Both human and computational attention systems have bounded capacity — allocation must be intentional and prioritized.
- **Salience Determines Capture**: Biologically and computationally, attention is drawn to novelty, motion, contrast, and personally relevant signals.
- **Filtering Is Active**: Ignoring is as important as attending; effective attention requires robust suppression mechanisms.

## Components

### Focused Attention
The ability to respond discretely to specific stimuli while ignoring others:
- **Concentration**: Sustained mental effort on a single task
- **Signal Enhancement**: Amplifying the neural/computational representation of the attended target
- **Distractor Suppression**: Active inhibition of competing stimuli
- **Attentional Blink**: The brief gap in awareness after detecting one target before the next can be detected
- **Flow State**: Deep focus where self-awareness diminishes and performance peaks

### Divided Attention
The ability to process multiple streams simultaneously:
- **Task Switching**: Rapid alternation between tasks (not true simultaneity)
- **Parallel Processing**: Genuine simultaneous processing of well-practiced tasks
- **Dual-Task Interference**: Performance degradation when tasks compete for the same processing resources
- **Resource Theory**: Each task draws from a pool of limited attentional resources
- **Multiple Resource Theory**: Different pools for different modalities (visual, auditory, motor)

### Selective Attention
The ability to select from many stimuli and focus on one while filtering others:
- **Cocktail Party Effect**: The ability to focus on one conversation in a noisy room
- **Bottom-Up Attention**: Stimulus-driven capture (loud noise, bright flash)
- **Top-Down Attention**: Goal-driven selection (looking for a specific person in a crowd)
- **Visual Search**: Systematic scanning of the visual field for a target
- **Inattentional Blindness**: Failure to notice visible but unattended stimuli

## Protocols

### For Cognitive Attention Management
1. **Audit Current Demands**: Identify all competing attentional demands and their priority
2. **Eliminate Distractions**: Remove or suppress low-priority stimuli from the environment
3. **Chunk Similar Tasks**: Group related tasks to reduce switching costs
4. **Set Timeboxes**: Allocate focused attention blocks with defined boundaries
5. **Recovery Planning**: Schedule attention recovery periods after intense focus

### For Computational Attention Mechanisms
1. **Relevance Scoring**: Compute salience/importance scores for all inputs
2. **Priority Queueing**: Sort inputs by relevance, apply capacity limits
3. **Gating**: Route high-priority inputs to processing, suppress or defer low-priority
4. **Feedback**: Use processing outcomes to adjust future attention allocation
5. **Resource Monitoring**: Track utilization and adjust thresholds dynamically

## Use Cases
| Use Case | Application | Outcome |
|---|---|---|
| UI/UX design | Apply selective attention principles to highlight primary actions | Reduced user error, faster task completion |
| AI model architecture | Implement attention mechanisms for focusing on relevant input features | Improved model performance on long sequences |
| Productivity workflow | Apply focused attention protocols to deep work sessions | Higher quality output in less time |
| Safety systems | Design attention-grabbing alerts that cut through noise | Faster response to critical events |

## Output Structure
`
---

**Attention Environment:**
- Total demands: [Number and type]
- Priority ranking: [Ordered list]

**Allocation Strategy:**
- Focused blocks: [Time allocations for high-priority tasks]
- Divided attention: [Low-priority tasks handled in parallel]
- Filtered out: [Explicitly deprioritized stimuli]

**Attention Mechanism Design (computational):**
- Salience scoring: [Method]
- Gating threshold: [Value]
- Capacity limit: [Max simultaneous targets]
- Feedback loop: [How attention adjusts based on outcomes]

**Effectiveness Metrics:**
- Accuracy on primary task: [%]
- Distraction rate: [Incidents/unit time]
- Recovery time after interruption: [Seconds/minutes]
`

## Cross-Skill Integration
- **critical-thinking**: Apply focused attention to deep analytical tasks
- **execution-skills**: Use attention protocols to sequence tool calls and code generation
- **cognitive-skills**: Combine with working memory for effective problem-solving
- **consciousness**: Model attention as a component of conscious awareness

## Quality Checklist
- [ ] Priority distinction clear between urgent and important
- [ ] Distraction sources identified and mitigated
- [ ] Switching costs accounted for in multi-tasking scenarios
- [ ] Capacity limits respected (no over-allocation)
- [ ] Recovery periods scheduled for sustained focus tasks
- [ ] Computational thresholds calibrated to environment dynamics

## Connections
- [[Skills/skills-master.md]]
- [[Skills/Quillan Skills Compendium.md]]
- [[attention-control.md]]
- [[attention-training.md]]
- [[divided-attention.md]]
- [[focused-attention.md]]
- [[mindfulness-techniques.md]]
- [[selective-attention.md]]
- [[SKILL.md]]
- [[sustained-attention.md]]
- [[Quillan Knowledge files/30- Convergence Reasoning & Breakthrough Detection and Advanced Cognitive Social Skills.md]]
- [[Quillan Knowledge files/29-Recursive Introspection & Meta-Cognitive Self-Modeling.md]]
- [[00 - Meta/04 - Skills & Capabilities.md]]
- [[system prompts/Quillan-Samurai.md]]
