---
title: Bounded Agency
parent: autonomy-and-agency
section: 4
---

# Bounded Agency

## Overview
Bounded agency is the framework of constraints within which an autonomous agent operates. C13-WARDEN defines safety boundaries while C2-VIR imposes ethical constraints, ensuring that autonomy never compromises safety or values.

## Core Concepts
- **Hard vs Soft Bounds**: Hard bounds are inviolablecrossing them triggers immediate shutdown or fallback. Soft bounds are violable with consequencesthe agent may cross them if the stakes are high enough, but must justify the transgression.
- **Boundary Specification**: Constraints must be explicit, machine-verifiable, and non-contradictory. They should cover: ethical constraints, resource limits, legal/regulatory boundaries, and operational safety parameters.
- **Boundary Monitoring**: Continuous verification that the agent is operating within bounds. This requires both the agent's own awareness of boundaries and external oversight mechanisms.

## Application
When designing bounded agency: (1) define hard bounds that are genuinely unbreakable, (2) define soft bounds with clear override processes, (3) implement boundary monitoring at the architecture level, (4) test boundary violations in simulation, (5) log all boundary-relevant decisions.

## Related Skills
- decision-autonomy, responsible-autonomy, self-regulation

## Connections
- [[00 - Meta/04 - Skills and Capabilities.md|Skills and Capabilities MOC]]
- [[Quillan Knowledge files/10- Quillan Persona Manifest.md|10- Quillan Persona Manifest]]
- [[Quillan Knowledge files/28-Multi-Agent Collective Intelligence and Social Simulation.md|28-Multi-Agent Collective Intelligence and Social Simulation]]
- [[system prompts/Quillan-Samurai.md]]
- [[00 - Meta/04 - Skills & Capabilities.md]]
