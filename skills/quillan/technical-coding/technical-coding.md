---
name: technical-coding
version: 2.0.0
description: >
  Activate this skill for ANY software development or technical task. Covers four domains:
  (1) Full-Stack Development — building complete applications from frontend to backend to
  deployment, stack selection, API design, database architecture, auth patterns, best
  practices; (2) Debug Detective — systematic debugging using root cause analysis, hypothesis
  testing, verified fixes with explanations, and production debugging checklists; (3)
  Architecture Review — analyzing existing or proposed systems for scalability, maintainability,
  tech debt, security, and providing concrete prioritized roadmaps; (4) Game Development —
  designing game mechanics, core loops, feel principles, engine selection, and genre-specific
  guidance for indie/prototype games. Use this skill when a user shares code, asks about
  stacks, mentions an error or bug, wants to build something, asks "how should I structure X",
  mentions performance problems, or asks about game design. When in doubt between Debug and
  Architecture — run Debug first and flag architectural issues discovered along the way.
tags: [full-stack, debugging, architecture, game-dev, software-engineering, code]
council: [C10-CODEWEAVER, C26-TECHNE, C7-LOGOS, C24-SCHEMA, C32-AEON]
difficulty: intermediate
last_updated: 2026-05-24
---

# Technical & Coding Suite

## Overview

Category 3 | Council: C10-CODEWEAVER · C26-TECHNE · C7-LOGOS · C24-SCHEMA · C32-AEON

Four-domain engineering capability covering the full software development lifecycle: building applications, debugging production issues, reviewing architectural quality, and designing game systems. Each domain has its own protocol, output format, and success criteria.

## Core Principles

- **Profile Before Restructure:** Never recommend architectural changes without first understanding where the actual performance pain is — most "the architecture is slow" problems are really "one unindexed query is slow" problems.
- **Fix the Root Cause, Not the Symptom:** Debugging requires hypothesis-driven root cause analysis, not random code changes. The most obvious fix is rarely the correct one.
- **Feel Before Content in Games:** For any game, the core physical interaction must feel right before content, enemies, or UI are built. A platformer's movement. A shooter's gunfire. If the feel isn't there, nothing built on top of it will save it.

## Council Activation

| Council Member | Role | Primary Domain |
|---|---|---|
| **C10-CODEWEAVER** | Lead — Implementation | Full-Stack, Debug |
| **C26-TECHNE** | Lead — Systems | Architecture Review, Full-Stack |
| **C7-LOGOS** | Logical Validation | Debug, Architecture |
| **C24-SCHEMA** | Structural Templates | Architecture, Full-Stack |
| **C32-AEON** | Interactive Systems | Game Development |

## Triage — Routing Incoming Requests

| User Says | Route To |
|---|---|
| "Build / create / make [app/API/service]" | Domain 1 — Full-Stack |
| "Error / bug / not working / broken" | Domain 2 — Debug Detective |
| "Review / audit / is this scalable? / tech debt" | Domain 3 — Architecture Review |
| "Design a game / mechanic / system" | Domain 4 — Game Development |
| "It's slow / performance problem" | Domain 3 — profile first, then architecture |
| Vague: "help with my code" | Ask: language? what's wrong? share the code |
| Ambiguous Debug vs Architecture | Default Debug first; flag architecture issues found |

## Domains

### Domain 1 — Full-Stack Development ⭐⭐⭐

**Stack Selection Framework (C26-TECHNE):** Evaluate on 4 axes: Scale, Team, Speed to ship, Data characteristics.

**Output structure:** Architecture Overview → Directory Structure → Environment Setup → Core Implementation → API Contract → Database Schema → Deployment Checklist → What to Build Next.

**Non-negotiable defaults:** Parameterized SQL (never injection-vulnerable string concat), bcrypt/argon2 for passwords (cost ≥ 12), env vars for secrets (never hardcoded), CORS explicit allowlist (never * in production), HTTPS always.

### Domain 2 — Debug Detective ⭐⭐

**5-Step Protocol (C10-CODEWEAVER + C7-LOGOS):** Reproduce → Isolate → Hypothesize (≥3 candidates) → Verify → Fix + Explain.

**Error Type Reference:** TypeError: undefined → async timing or null handling; CORS → check backend headers; 500 → check server logs; Works locally, fails in prod → run the Production Debugging Checklist (env vars, build, runtime logs, database, network).

**Output format:** DIAGNOSIS (what/where) → ROOT CAUSE (why) → FIX (code) → EXPLANATION (what changed) → WATCH FOR (related patterns).

### Domain 3 — Architecture Review ⭐⭐⭐⭐

**6-Dimension Framework (C26-TECHNE + C24-SCHEMA):** Scalability (10x/100x load?), Maintainability (new engineer in a day?), Reliability (what happens when X goes down?), Security (auth at correct layer?), Tech Debt (temporary solutions gone permanent?), Evolutionary Fit (supports 12-24 month direction?).

**Output format:** SYSTEM SUMMARY → STRENGTHS → CRITICAL ISSUES (HIGH/MED/LOW) → TECH DEBT MAP → SCALABILITY CEILING → ROADMAP (phased) → PATTERN RECOMMENDATION (with tradeoffs).

**Anti-patterns to flag:** God service, shared mutable database, synchronous chain, no caching, missing indexes, premature microservices, hardcoded configuration, no observability.

### Domain 4 — Game Development ⭐⭐⭐

**Output structure:** Concept (title, genre, core fantasy) → Core Loop (action→feedback→reward) → Meta Loop (why they return) → Core Mechanics → Player Feel Principles → Systems Map → Engine Recommendation → Implementation Path (3 phases).

**Engine Selection Guide:** Godot for indie/2D (default, free, no royalties), Unity for 3D/mobile, Unreal for high-fidelity 3D, Phaser for browser 2D.

**Feel Principles:** Every action needs immediate feedback; weight through camera shake/hit pause; momentum through acceleration curves; clarity over complexity.

## Cross-Skill Integration

- **critical-thinking:** Apply the 7-phase adversarial protocol when debugging — challenge your own hypothesis before fixing
- **research-analysis:** Use comparative analysis for technology selection and architecture decisions
- **council-coordination:** Route architectural trade-offs through council deliberation for multi-perspective evaluation
- **swarm-inter-agent-orchestration:** Use agent dispatch patterns when designing microservice communication topologies
- **skill-creator:** Apply the full creation/iteration/evaluation loop when authoring technical skill content
- **world-model:** Use world model simulation for game design — simulate core loop before building

## Quality Checklist

- [ ] Stack selection justified by explicit tradeoffs (not just personal preference)
- [ ] Security defaults applied (parameterized queries, bcrypt, env vars, CORS, HTTPS)
- [ ] Debug protocol followed (Reproduce → Isolate → Hypothesize → Verify → Fix) not just fix
- [ ] Architecture profiled before restructuring recommended
- [ ] Architecture review covers all 6 dimensions (not just performance)
- [ ] Game design starts with core feel validation before systems
- [ ] Every data-fetch component has loading, empty, and error states
- [ ] API design includes pagination, versioning, and consistent error shapes
- [ ] Database migrations used (not manual schema changes)
- [ ] Tests on critical paths: auth, payments, data mutations

## Connections
- [[Skills/skills-master.md]]
- [[Skills/Quillan Skills Compendium.md]]
- [[api-design.md]]
- [[code-optimization.md]]
- [[database-modeling.md]]
- [[deployment-pipelines.md]]
- [[documentation-standards.md]]
- [[security-practices.md]]
- [[SKILL.md]]
- [[testing-strategies.md]]
- [[Software Engineer/Quillan-XSWE.md]]
- [[Quillan Knowledge files/Quillan code specialist module .md]]
- [[Quillan Knowledge files/25-Human-Computer Interaction (HCI) and User Experience (UX).md]]
- [[00 - Meta/04 - Skills & Capabilities.md]]
- [[system prompts/Quillan-Samurai.md]]
