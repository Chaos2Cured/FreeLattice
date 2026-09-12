---
title: Consensus Protocols
parent: swarm-inter-agent-orchestration
section: 7
---

# Consensus Protocols

## Overview
Consensus protocols enable multiple agents to agree on a single value or state despite the possibility of failures. They are fundamental to distributed coordination, ensuring that all agents operate on a consistent view of the system state. This sub-skill covers Paxos, Raft, PBFT, and their application in agent-based systems.

## Core Concepts
- **Paxos**: Classic consensus protocol focusing on safety over simplicity
- **Raft**: Understandable consensus with leader election and log replication
- **Byzantine Fault Tolerance (PBFT)**: Consensus under arbitrary node failures or malicious behavior
- **Quorum Requirements**: Minimum participants needed to reach a valid decision
- **Leader Election**: Process for selecting a coordinating node in decentralized systems

## Application
Use Raft for most agent-based systems where Byzantine faults are not a concern. Use PBFT when agents may be malicious or compromised. Balance consensus robustness against performance overhead the stronger the guarantees, the higher the communication cost.

## Related Skills
state-synchronization, failure-recovery, topology-management

## Connections
- [[Skills/skills-master.md]]
- [[Skills/Quillan Skills Compendium.md]]
- [[agent-dispatch.md]]
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
