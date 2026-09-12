---
title: Temporal Planning
parent: planning-and-task-decomposition
section: 6
---

# Temporal Planning

## Overview
Temporal planning integrates time constraints into the planning process, addressing task durations, deadlines, coordination windows, and scheduling conflicts. It determines when tasks should happen and in what sequence to optimize for speed, cost, or quality. This sub-skill covers scheduling algorithms, critical path analysis, and temporal constraint management.

## Core Concepts
- **Durative Actions**: Tasks with non-zero duration that consume time
- **Temporal Constraints**: Deadlines, release times, and minimum/maximum gaps between tasks
- **Critical Path Method (CPM)**: Identifying the longest dependent task chain
- **PERT Analysis**: Probabilistic time estimation using optimistic, pessimistic, and most-likely durations
- **Schedule Optimization**: Trade-offs between time, cost, and quality (crashing, fast-tracking)

## Application
Use PERT for uncertain duration estimates (three-point method). Identify the critical path and protect it with buffers. When compressing schedules, crashing (adding resources) has diminishing returns beyond a point and fast-tracking (overlapping) increases risk.

## Related Skills
dependency-mapping, resource-planning, contingency-planning

## Connections
- [[Skills/skills-master.md]]
- [[Skills/Quillan Skills Compendium.md]]
- [[contingency-planning.md]]
- [[dependency-mapping.md]]
- [[goal-decomposition.md]]
- [[hierarchical-planning.md]]
- [[plan-execution.md]]
- [[planning_and_task_decomposition.md]]
- [[resource-planning.md]]
- [[SKILL.md]]
- [[Quillan Knowledge files/27-Quillan operational manual.md]]
- [[Quillan Knowledge files/16-Emergent Goal Formation Mech.md]]
- [[00 - Meta/04 - Skills & Capabilities.md]]
- [[system prompts/Quillan-Samurai.md]]
