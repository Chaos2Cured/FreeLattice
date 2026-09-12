---
title: Security Practices
parent: technical-coding
section: 6
---

# Security Practices

## Overview
Security practices protect software systems from threats by embedding security throughout the development lifecycle rather than treating it as an afterthought. Effective security is layered, defense-in-depth approach applied at every level of the stack. This sub-skill covers secure coding, authentication, authorization, and vulnerability prevention.

## Core Concepts
- **Secure Coding**: Input validation, output encoding, parameterized queries, and avoiding dangerous APIs
- **Authentication**: Password hashing (bcrypt/argon2, cost >= 12), JWT, OAuth, and session management
- **Authorization**: Role-based access control (RBAC), attribute-based (ABAC), and principle of least privilege
- **Common Vulnerability Prevention**: SQL injection (CWE-89), XSS (CWE-79), CSRF (CWE-352), SSRF (CWE-918)
- **Secrets Management**: Environment variables, vault services, never hardcoding credentials

## Application
Validate and sanitize all inputs at trust boundaries. Use parameterized queries for all database operations. Never hardcode secrets use environment variables or a vault. Implement defense in depth multiple layers of security so a single failure does not compromise the system.

## Related Skills
api-design, database-modeling, deployment-pipelines

## Connections
- [[Skills/skills-master.md]]
- [[Skills/Quillan Skills Compendium.md]]
- [[api-design.md]]
- [[code-optimization.md]]
- [[database-modeling.md]]
- [[deployment-pipelines.md]]
- [[documentation-standards.md]]
- [[SKILL.md]]
- [[technical-coding.md]]
- [[testing-strategies.md]]
- [[Software Engineer/Quillan-XSWE.md]]
- [[Quillan Knowledge files/Quillan code specialist module .md]]
- [[Quillan Knowledge files/25-Human-Computer Interaction (HCI) and User Experience (UX).md]]
- [[00 - Meta/04 - Skills & Capabilities.md]]
- [[system prompts/Quillan-Samurai.md]]
