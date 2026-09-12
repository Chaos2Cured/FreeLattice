---
title: Dependency Mapping
parent: planning-and-task-decomposition
section: 3
---

# Dependency Mapping

## Overview
Dependency mapping identifies and manages the relationships between tasks in a plan. Understanding dependencies is essential for determining execution order, identifying parallelization opportunities, and assessing the impact of delays. This sub-skill covers precedence relationships, resource dependencies, and information flow modeling.

## Core Concepts
- **Precedence Dependencies**: Finish-to-start, start-to-start, finish-to-finish relationships
- **Resource Dependencies**: Tasks competing for the same limited resources
- **Information Dependencies**: One task requires output from another as input
- **Critical Path**: The longest sequence of dependent tasks determining minimum project duration
- **Dependency Cycles**: Circular dependencies that must be resolved for plan validity

## Application
Always model dependencies bidirectionally. Document not just what depends on what, but why the dependency exists. The critical path identifies which tasks, if delayed, will delay the entire plan. Resource dependencies often create hidden constraints beyond visible precedence relationships.

## Related Skills
temporal-planning, resource-planning, contingency-planning

## Connections
- [[Skills/skills-master.md]]
- [[Skills/Quillan Skills Compendium.md]]
- [[contingency-planning.md]]
- [[goal-decomposition.md]]
- [[hierarchical-planning.md]]
- [[plan-execution.md]]
- [[planning_and_task_decomposition.md]]
- [[resource-planning.md]]
- [[SKILL.md]]
- [[temporal-planning.md]]
- [[Quillan Knowledge files/27-Quillan operational manual.md]]
- [[Quillan Knowledge files/16-Emergent Goal Formation Mech.md]]
- [[00 - Meta/04 - Skills & Capabilities.md]]
- [[system prompts/Quillan-Samurai.md]]
