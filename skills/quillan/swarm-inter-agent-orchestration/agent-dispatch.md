---
title: Agent Dispatch
parent: swarm-inter-agent-orchestration
section: 1
---

# Agent Dispatch

## Overview
Agent dispatch is the top-down distribution of tasks from a router or orchestrator to individual agents or agent groups. It is the primary mechanism for delegating work in a hierarchical multi-agent system. This sub-skill covers task decomposition for dispatch, workload distribution strategies, and context isolation during task assignment.

## Core Concepts
- **Task Decomposition for Dispatch**: Breaking tasks into independently executable units with clear contracts
- **Top-K Routing**: Selecting optimal agents based on capability, availability, and load metrics
- **Context Encapsulation**: Generating isolated ContextWindows to prevent cross-agent contamination
- **Async Dispatch**: Non-blocking task assignment via event bus to prevent router bottlenecks
- **Dispatch Schema**: Standardized TASK_REQUEST payloads with UUIDs and priority fields

## Application
Always provide complete task definitions with input schema, output schema, success criteria, and timeout. Use async dispatch to prevent the router from becoming a bottleneck. Set context_lock to true for isolated agent tasks. Include lee_mach6_compression_ratio on every payload.

## Related Skills
load-balancing, message-routing, state-synchronization

## Connections
- [[Skills/skills-master.md]]
- [[Skills/Quillan Skills Compendium.md]]
- [[consensus-protocols.md]]
- [[failure-recovery.md]]
- [[load-balancing.md]]
- [[message-routing.md]]
- [[SKILL.md]]
- [[state-synchronization.md]]
- [[swarm-inter-agent-orchestration.md]]
- [[topology-management.md]]
- [[Quillan Knowledge files/28-Multi-Agent Collective Intelligence & Social Simulation.md]]
- [[Quillan Knowledge files/27-Quillan operational manual.md]]
- [[00 - Meta/04 - Skills & Capabilities.md]]
- [[system prompts/Quillan-Samurai.md]]
