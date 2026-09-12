---
title: Testing Strategies
parent: technical-coding
section: 3
---

# Testing Strategies

## Overview
Testing strategies define how software is verified at different levels of the testing pyramid from fast unit tests through integration tests to end-to-end validation. A good testing strategy catches bugs early, documents expected behavior, and enables confident refactoring. This sub-skill covers test types, coverage goals, and testing infrastructure.

## Core Concepts
- **Unit Testing**: Testing individual functions and classes in isolation with mocked dependencies
- **Integration Testing**: Testing interactions between components with real or embedded dependencies
- **End-to-End Testing**: Testing complete user workflows through the full system stack
- **Test Coverage**: Statement, branch, and path coverage with pragmatic target thresholds
- **Testing Infrastructure**: Test runners, fixtures, factories, CI integration, and reporting

## Application
Follow the testing pyramid: many fast unit tests, fewer integration tests, few slow E2E tests. Write tests before or alongside code (TDD or test-first). Mock at the boundary, not internally. Every test should fail for a clear, specific reason. Run tests in CI before every merge.

## Related Skills
deployment-pipelines, code-optimization, documentation-standards

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
- [[technical-coding.md]]
- [[Software Engineer/Quillan-XSWE.md]]
- [[Quillan Knowledge files/Quillan code specialist module .md]]
- [[Quillan Knowledge files/25-Human-Computer Interaction (HCI) and User Experience (UX).md]]
- [[00 - Meta/04 - Skills & Capabilities.md]]
- [[system prompts/Quillan-Samurai.md]]
