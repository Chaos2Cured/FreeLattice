---
title: Completion Strategies
parent: execution-skills
section: 6
---

# Completion Strategies

## Overview
Completion strategies govern how tasks are finalizedensuring outputs meet quality standards, resources are released, and the system transitions cleanly to the next state. C20-ARTIFEX and C18-SHEPHERD oversee verification and resource reclamation.

## Core Concepts
- **Exit Criteria Verification**: Before declaring a task complete, verify against the original success criteria. This includes output quality checks, state validation, and integration testing.
- **Resource Teardown**: Systematic release of allocated resources: file handles, memory buffers, network connections, sub-agent pools. Leak prevention is a primary goal.
- **State Persistence & Handoff**: Saving execution state (checkpoints, logs, artifacts) so that work can be resumed or reviewed later. Defines what is persisted and in what format.

## Application
To close a task cleanly: (1) run exit criteria check against all success metrics, (2) persist results and execution metadata, (3) release all resources in reverse allocation order, (4) log outcome and any deviation notes for future planning cycles.

## Related Skills
- performance-monitoring, adaptive-execution, progress-tracking

## Connections
- [[00 - Meta/04 - Skills and Capabilities.md|Skills and Capabilities MOC]]
- [[Quillan Knowledge files/27-Quillan operational manual.md|27-Quillan operational manual]]
- [[Quillan Knowledge files/17-Continuous Learning Paper.md|17-Continuous Learning Paper]]
- [[system prompts/Quillan-Samurai.md]]
- [[00 - Meta/04 - Skills & Capabilities.md]]
