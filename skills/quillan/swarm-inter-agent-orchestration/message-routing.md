---
title: Message Routing
parent: swarm-inter-agent-orchestration
section: 3
---

# Message Routing

## Overview
Message routing directs communication between agents, routers, and swarms through the system event bus. Proper routing ensures messages reach their intended recipients with appropriate priority and reliability guarantees. This sub-skill covers routing topologies, queue management, priority handling, and delivery semantics.

## Core Concepts
- **Routing Topologies**: Point-to-point, publish-subscribe, topic-based, and content-based routing
- **Message Queues**: FIFO, priority, and dead-letter queues for managing message flow
- **Delivery Semantics**: At-most-once, at-least-once, and exactly-once delivery guarantees
- **Priority Handling**: CRITICAL, HIGH, MEDIUM, LOW priority levels with preemption logic
- **Message Schema**: Standardized format with message_id, type, vector, sender, receiver, and payload

## Application
Use publish-subscribe for broadcast messages (A2S) and point-to-point for direct agent communication (A2A). Always include priority levels to ensure critical messages are not delayed behind routine traffic. Implement dead-letter queues for messages that cannot be delivered.

## Related Skills
agent-dispatch, load-balancing, topology-management

## Connections
- [[Skills/skills-master.md]]
- [[Skills/Quillan Skills Compendium.md]]
- [[agent-dispatch.md]]
- [[consensus-protocols.md]]
- [[failure-recovery.md]]
- [[load-balancing.md]]
- [[SKILL.md]]
- [[state-synchronization.md]]
- [[swarm-inter-agent-orchestration.md]]
- [[topology-management.md]]
- [[Quillan Knowledge files/28-Multi-Agent Collective Intelligence & Social Simulation.md]]
- [[Quillan Knowledge files/27-Quillan operational manual.md]]
- [[00 - Meta/04 - Skills & Capabilities.md]]
- [[system prompts/Quillan-Samurai.md]]
