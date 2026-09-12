---
name: planning-and-task-decomposition
version: 2.0.0
description: >
  A comprehensive skill for breaking down complex tasks into manageable sub-tasks, creating
  execution plans, and managing interdependencies. Covers hierarchical planning, goal-oriented
  action selection, causal reasoning about action effects, temporal planning with scheduling
  and resource constraints, contingency planning for uncertainty, and multi-agent coordination
  plans. Use when users need to decompose complex problems, design project workflows, create
  step-by-step execution plans, reason about task dependencies, or allocate resources across
  parallel workstreams.
tags: [planning, task-decomposition, project-management, workflow, scheduling, goals]
council: [C4-PRAXIS, C12-SOPHIAE, C24-SCHEMA, C31-NEXUS, C29-NAVIGATOR]
difficulty: intermediate
last_updated: 2026-05-24
---

# Planning and Task Decomposition

## Overview

A formal framework for decomposing complex goals into structured task hierarchies with explicit dependency management, resource allocation, temporal scheduling, and contingency planning. Enables systematic progression from high-level objectives to actionable micro-tasks suitable for execution by human teams or agent swarms, with built-in mechanisms for handling uncertainty, failure recovery, and re-planning.

## Core Principles

- **Hierarchical Abstraction**: Plans are naturally hierarchical—high-level strategic goals decompose into tactical sub-goals which decompose into operational tasks. Each level provides the right granularity for different stakeholders.
- **Explicit Dependency Modeling**: Task dependencies (precedence, resource, information) must be explicitly captured to avoid deadlock, enable parallelism, and identify critical paths.
- **Contingency and Adaptability**: Real-world execution encounters unexpected obstacles. Plans must include fallback paths, monitoring checkpoints, and re-planning triggers rather than assuming perfect execution.

## Components

1. **Hierarchical Planning**: A planning approach that creates plans at multiple levels of abstraction. Strategic level defines the overall goal and high-level milestones. Tactical level decomposes milestones into phase objectives. Operational level defines executable actions with concrete inputs, outputs, and acceptance criteria. Includes top-down refinement and bottom-up constraint propagation.

2. **Goal-Oriented Action Selection**: The ability to select actions that will achieve a desired goal. Covers means-ends analysis (comparing current state to goal state and selecting actions that reduce the gap), backward chaining from goals to preconditions, forward chaining from available actions to goal achievement, and hybrid approaches like STRIPS operators and Hierarchical Task Networks (HTNs).

3. **Causal Reasoning About Actions**: The ability to reason about causal relationships between actions and their effects. Covers action models (preconditions, effects, duration, resource consumption), state transition modeling, positive and negative side effects, non-deterministic outcomes, and ramification constraints (indirect consequences of actions).

4. **Temporal Planning and Scheduling**: Integration of temporal constraints into planning. Covers durative actions, temporal constraints (deadlines, release times), concurrent action coordination, critical path analysis, PERT/CPM methods (Program Evaluation and Review Technique / Critical Path Method), resource leveling, and Gantt chart generation.

5. **Contingency Planning**: Planning under uncertainty with branch handling. Covers conditional planning (if-then-else based on sensing outcomes), probabilistic planning (Markov Decision Processes), plan monitoring (checkpoint conditions that trigger re-planning), execution monitoring, and plan repair strategies.

6. **Multi-Agent Coordination**: Task decomposition across multiple actors. Covers task allocation (who does what), joint plans with synchronization points, communication protocols for plan coordination, shared plan representations, and conflict resolution mechanisms.

## Protocols

### Task Decomposition Protocol
1. State the top-level goal explicitly with success criteria
2. Identify the key stakeholders and constraints (time, resources, quality)
3. Decompose into 3-7 high-level sub-goals (strategic level)
4. For each sub-goal, identify dependencies on other sub-goals
5. Decompose each sub-goal into operational tasks (tactical level)
6. For each task, specify: inputs, outputs, effort estimate, resource needs, risk factors
7. Identify precedence and resource dependencies between tasks
8. Schedule tasks considering dependencies and resource constraints
9. Identify critical path and contingency triggers
10. Define monitoring checkpoints and re-planning conditions

### Plan Representation Template
`
Goal: [statement with success criteria]
Constraints: [time, budget, quality, regulatory]

Strategic Plan:
  Phase 1: [milestone] — [owner] — [due]
  Phase 2: [milestone] — [owner] — [due]
  ...

Task Breakdown:
  Task 1.1: [action] — [preconditions] → [effects]
    Dependency: [parent/sibling tasks]
    Resources: [effort, skills, tools]
    Risk: [probability × impact]

Critical Path: [sequence determining overall duration]
Contingencies: [trigger conditions → alternative actions]
`

## Use Cases

| Use Case | Application | Outcome |
|---|---|---|
| Software project planning | Decompose features into user stories and tasks | Executable sprint backlog with dependencies |
| Robot task execution | Decompose "clean room" into navigation + manipulation sequences | Autonomous task completion |
| Research project design | Break hypothesis testing into experiments and analyses | Structured investigation plan |
| Emergency response | Allocate teams and resources under time pressure | Coordinated, prioritized response |
| Business process automation | Decompose workflows into automated steps | Efficient, auditable process execution |
| Multi-agent swarm coordination | Allocate sub-tasks across agents with sync points | Parallel, collision-free execution |

## Cross-Skill Integration

- **critical-thinking**: Applies analytical reasoning to identify task dependencies and risks
- **reasoning**: Causal reasoning is foundational for modeling action effects
- **probabilistic_reasoning**: Handles uncertainty in task durations and outcomes
- **swarm-inter-agent-orchestration**: Coordinates task execution across distributed agents
- **technical-coding**: Implements plan representations and scheduling algorithms
- **self_improvement_skills**: Enables retrospective plan analysis and improvement

## Quality Checklist

- [ ] Top-level goal has explicit, measurable success criteria
- [ ] Decomposition covers all necessary sub-goals (no gaps)
- [ ] Task dependencies are fully specified (no missing edges)
- [ ] Resource constraints are modeled with capacity limits
- [ ] Critical path is identified
- [ ] Contingency plans exist for high-risk tasks
- [ ] Monitoring checkpoints are defined with re-planning triggers
- [ ] Temporal constraints (deadlines, durations) are realistic
- [ ] Task allocation respects team/agent capabilities
- [ ] Plan is validated against the goal: if all tasks succeed, does the goal hold?

## Connections
- [[Skills/skills-master.md]]
- [[Skills/Quillan Skills Compendium.md]]
- [[contingency-planning.md]]
- [[dependency-mapping.md]]
- [[goal-decomposition.md]]
- [[hierarchical-planning.md]]
- [[plan-execution.md]]
- [[resource-planning.md]]
- [[SKILL.md]]
- [[temporal-planning.md]]
- [[Quillan Knowledge files/27-Quillan operational manual.md]]
- [[Quillan Knowledge files/16-Emergent Goal Formation Mech.md]]
- [[00 - Meta/04 - Skills & Capabilities.md]]
- [[system prompts/Quillan-Samurai.md]]
