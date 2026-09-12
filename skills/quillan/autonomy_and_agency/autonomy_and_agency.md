---
name: autonomy-and-agency
version: 2.0.0
description: >
  A skill for developing and applying autonomy and agency including goal setting,
  decision making, and action selection. Provides structured protocols for designing
  autonomous systems, bounded agency frameworks, and goal-directed behavior. Use when
  users need to create independent systems, design autonomous agents, or develop entities
  that can make their own decisions and take independent actions.
tags: [autonomy, agency, decision-making, agents, goal-setting]
council: [C4-PRAXIS, C19-VIGIL, C13-WARDEN]
difficulty: advanced
last_updated: 2026-05-24
---

# Autonomy and Agency

## Overview
Autonomy and agency encompass the capacity of an entity to act independently, make its own decisions, and pursue its own goals within a set of constraints. This skill provides frameworks for designing autonomous systems with appropriate boundary conditions, decision-making protocols, and self-directed learning capabilities. It bridges C4-PRAXIS's strategic planning, C19-VIGIL's identity safeguarding, and C13-WARDEN's safety boundary enforcement.

## Core Principles
- **Bounded Autonomy**: True agency requires constraints — without boundaries, autonomous systems cannot distinguish meaningful choices from noise.
- **Goal Hierarchies Matter**: Autonomous agents need layered goal structures where higher-level goals constrain lower-level action selection.
- **Accountable Decision-Making**: Every autonomous decision must be traceable to the principles and information that produced it.

## Components

### Goal Setting
The ability to define, prioritize, and revise objectives:
- **Goal Formalization**: Translating abstract desires into concrete, measurable objectives
- **Goal Hierarchy**: Organizing goals from abstract (values/principles) to concrete (actions/tasks)
- **Goal Conflict Resolution**: Managing situations where multiple goals compete for the same resources
- **Goal Revision**: Adapting goals based on new information or changing circumstances
- **Temporal Framing**: Distinguishing short-term, medium-term, and long-term goals

### Decision Making
The process of selecting among alternative courses of action:
- **Decision Framing**: Defining the choice space, alternatives, and evaluation criteria
- **Expected Utility**: Weighing outcomes by their probability and value
- **Decision Under Uncertainty**: Strategies for decisions with incomplete information
- **Multi-Criteria Decisions**: Balancing competing values (speed, quality, cost, risk)
- **Sequential Decisions**: Planning multi-step action sequences with state feedback
- **Bounded Rationality**: Making satisficing decisions within computational constraints

### Action Selection
Choosing which action to execute from the set of available options:
- **Policy Mapping**: Learning or defining the action→outcome relationship
- **Exploration vs Exploitation**: Balancing known-good actions with novel exploration
- **Inhibition**: Suppressing actions that conflict with higher-priority goals or constraints
- **Action Sequencing**: Ordering actions for efficient goal achievement
- **Feedback Integration**: Using action outcomes to update future action selection

## Protocols

### Autonomous Agent Design Protocol
1. **Define Identity**: Articulate the agent's core values, principles, and purpose
2. **Set Goal Hierarchy**: Establish abstract goals that constrain all lower-level decisions
3. **Boundary Specification**: Define explicit constraints the agent must never violate
4. **Decision Framework**: Implement a consistent decision-making procedure
5. **Action Selection**: Connect decisions to actions with feedback loops
6. **Monitoring and Revision**: Track outcomes and update goals/policies as needed
7. **Accountability Trace**: Maintain an auditable record of decisions and their basis

### Bounded Agency Assessment
1. Map the agent's permitted action space
2. Identify the boundaries (ethical, resource, legal, physical)
3. Verify that constraint violations are impossible (hard bounds) or severely penalized (soft bounds)
4. Test edge cases where goals might push against boundaries
5. Document the boundary framework for external audit

## Use Cases
| Use Case | Application | Outcome |
|---|---|---|
| Autonomous robotics | Design goal-directed behavior with safety constraints | Independent operation within safe boundaries |
| AI assistants | Implement bounded agency with user-defined constraints | Helpful behavior that respects boundaries |
| Game AI | Create NPCs with believable autonomous decision-making | Emergent, engaging gameplay |
| Process automation | Design self-optimizing workflows | Efficient adaptation to changing conditions |

## Output Structure
`
---

**Agent Identity:**
- Purpose: [Core raison d'être]
- Values: [Guiding principles]
- Constraint boundaries: [Hard and soft limits]

**Goal Framework:**
- Abstract (inviolable): [Top-level goals]
- Strategic (medium-term): [Multi-step objectives]
- Tactical (immediate): [Current action priorities]

**Decision Protocol:**
- Framing method: [How choices are structured]
- Evaluation criteria: [How options are compared]
- Uncertainty handling: [Strategy for incomplete info]
- Revision trigger: [When decisions are revisited]

**Action Selection:**
- Policy: [Learned or programmed action mapping]
- Exploration rate: [If applicable]
- Sequencing logic: [How actions are ordered]

**Accountability Log:** [Decision + basis + outcome for recent actions]
`

## Cross-Skill Integration
- **execution-skills**: Implement autonomous action sequences
- **critical-thinking**: Apply decision theory to autonomous choices
- **consciousness**: Model self-awareness and metacognition in autonomous agents
- **cognitive-skills**: Integrate learning and adaptation into the agent's lifecycle

## Quality Checklist
- [ ] Goal hierarchy clearly defined (abstract → concrete)
- [ ] Hard constraints are genuinely unbreakable (not merely discouraged)
- [ ] Decision process is auditable after the fact
- [ ] Agent can handle goal conflicts without deadlock
- [ ] Exploration/exploitation balance is appropriate to the domain
- [ ] Accountability trace captures the basis for each decision

## Connections
- [[Skills/skills-master.md]]
- [[Skills/Quillan Skills Compendium.md]]
- [[bounded-agency.md]]
- [[decision-autonomy.md]]
- [[goal-setting.md]]
- [[initiative-taking.md]]
- [[responsible-autonomy.md]]
- [[self-determination.md]]
- [[self-regulation.md]]
- [[SKILL.md]]
- [[Quillan Knowledge files/16-Emergent Goal Formation Mech.md]]
- [[Quillan Knowledge files/27-Quillan operational manual.md]]
- [[00 - Meta/04 - Skills & Capabilities.md]]
- [[system prompts/Quillan-Samurai.md]]
